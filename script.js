/* ===============================================================================
                                    Intercept Fetch
================================================================================ */
const { fetch: originalFetch } = window;
window.fetch = async (...args) => {
  let [url, options] = args;
  const responseFetch = await originalFetch(url, options);
  const responseClone = responseFetch.clone();
  const responseClone_ = responseFetch.clone();

  const request = options ? { url, options } : { options: url };

  responseClone
    .json()
    .then((res) => {
      const response = { res };
      // console.log("Fetch: ", { request, response });
    })
    .catch(() => {
      const response = { res: responseClone_ };
      // console.log("Fetch: ", { request, response })
    });

  return responseFetch;
};


/* ===============================================================================
                                            Intercept XHR
================================================================================ */
let originalXHR = window.XMLHttpRequest;

window.XMLHttpRequest = function () {
  const XHRReqRes = {}
  let xhr = new originalXHR();
  let originalOpen = xhr.open;

  xhr.open = function (method, url, async) {
    const request = { url, method };
    XHRReqRes["request"] = request;
    originalOpen.apply(this, arguments);
  };

  let originalSend = xhr.send;

  xhr.send = function () {
    let self = this;
    // let originalOnLoad = self.onload;

    function getResponseData(){
      try {
        return JSON.parse(self.responseText);
      } catch { return self.response }
    }

    self.onload = function () {
      const headers = self.getAllResponseHeaders();
      const res = getResponseData();
      const code = self.code;
      const status = self.statusText;
      const type = self.responseType;
      const response = { headers, res, code, status, type };
      XHRReqRes["response"] = response;
      // console.log("XHR :", XHRReqRes);
    };

    originalSend.apply(this, arguments);
  };

  return xhr;
};


/* ===============================================================================
                                Intercept Websocket
================================================================================ */
const WebSocketProxy = new Proxy(window.WebSocket, {
  construct(target, args) {
    const ws = new target(...args);
    // console.log("Websocket: ", args);

    // Configurable hooks
    ws.hooks = {
      beforeSend: () => null,
      beforeReceive: () => null,
    };

    // Intercept send
    const sendProxy = new Proxy(ws.send, {
      apply(target, thisArg, args) {
        if (ws.hooks.beforeSend(args) === false) {
          return;
        }
        if(location.host !== "web.whatsapp.com"){
            // console.log("Websocket Sent: ", {message: args});
          }
        return target.apply(thisArg, args);
      },
    });
    ws.send = sendProxy;

    // Intercept events
    const addEventListenerProxy = new Proxy(ws.addEventListener, {
      apply(target, thisArg, args) {
        if (args[0] === "message" && ws.hooks.beforeReceive(args) === false) {
          return;
        }
        return target.apply(thisArg, args);
      },
    });
    ws.addEventListener = addEventListenerProxy;

    Object.defineProperty(ws, "onmessage", {
      set(func) {
        const onmessage = function onMessageProxy(event) {
          // const message = event.data;
          if(location.host === "web.whatsapp.com"){
            // no action
          }
          if (ws.hooks.beforeReceive(event) === false) {
            return;
          }
          func.call(this, event);
        };
        return addEventListenerProxy.apply(this, ["message", onmessage, false]);
      },
    });

    window._websockets = window._websockets || [];
    window._websockets.push(ws);

    return ws;
  },
});

window.WebSocket = WebSocketProxy;

/* =======================================================================================================
                                          Fungsi Click Simulate
========================================================================================================= */

const mouseClickEvents = ['mousedown', 'click', 'mouseup'];
function simulateMouseClick(element){
  mouseClickEvents.forEach(mouseEventType =>
    element.dispatchEvent(
      new MouseEvent(mouseEventType, {
          view: window,
          bubbles: true,
          cancelable: true,
          buttons: 1
      })
    )
  );
}

/* =======================================================================================================
                                          Fungsi Scroll
========================================================================================================= */
function triggerNewMessage(element){
  simulateMouseClick(element.querySelector('div[data-testid="cell-frame-container"]'))
  const scrollTotal = 3;
  for (let index = 0; index < scrollTotal; index++) {
    setTimeout(scrollUp, (index + 3) * 1000);
  }
  setTimeout(scrollDown, (scrollTotal + 3) * 1000);
}

function scrollUp(){
  const chatRoomListElement = document.querySelector('div[data-testid="conversation-panel-messages"] div[role="application"]');
  if(chatRoomListElement){
    const eachList = [...chatRoomListElement.childNodes];
    const firstRow = eachList[1];
    firstRow.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }
}

function scrollDown(){
  const chatRoomListElement = document.querySelector('div[data-testid="conversation-panel-messages"] div[role="application"]');
  if(chatRoomListElement){
    const toBottom = document.querySelector('div[role="button"][aria-label="Scroll to bottom"]');
    simulateMouseClick(toBottom);
  }
}

/* =======================================================================================================
                                              Ambil Pesan Seluruh Contact
========================================================================================================= */
function onWhatsAppMessage(){
  const chatListElement = document.querySelector('div[aria-label="Chat list"]');
  const notificationBar = document.querySelector('span[data-testid="chat-butterbar"] button[aria-label="Close"]');
  
  if(notificationBar){
    notificationBar.click();
  }
  
  if(chatListElement){
    const dateNow = new Date();
    const eachList = [...chatListElement.childNodes];
    
    let ALL_MESSAGES = window.localStorage.getItem("messages") ? JSON.parse(window.localStorage.getItem("messages")) : [];

    for (let index = 0; index < eachList.length; index++) {
      try {
        const element = eachList[index];

        const objectMessage = {
          room: "",
          from: "",
          message: "",
          isDoc: false,
          isImage: false,
          dateTime: ""
        }

        const roomSelector = element.querySelector('div[data-testid="cell-frame-title"] span[dir="auto"]');
        if(roomSelector) objectMessage.room = roomSelector.innerText;

        const fromSelector = element.querySelector('span[data-testid="last-msg-status"] span[dir="auto"]');
        if(fromSelector) objectMessage.from = fromSelector.innerText;

        const messageSelector = element.querySelector('span[data-testid="last-msg-status"] span[dir="ltr"]');
        if(messageSelector) objectMessage.message = messageSelector?.innerText;

        const isDocSelector = element.querySelector('span[data-testid="status-document"]');
        if(isDocSelector) {
          const prevElement = isDocSelector.parentElement.previousElementSibling?.previousElementSibling?.innerText;
          objectMessage.isDoc = true;
          objectMessage.from = prevElement || "";
        }

        const isImageSelector = element.querySelector('span[data-testid="status-image"]');
        if(isImageSelector) {
          const prevElement = isImageSelector.parentElement.previousElementSibling?.previousElementSibling?.innerText;
          objectMessage.isImage = true;
          objectMessage.from = prevElement || "";
        }

        if(objectMessage.from == ""){
          objectMessage.from = objectMessage.room;
        }

        const dateTimeSelector = element.querySelector('div[data-testid="cell-frame-primary-detail"]');
        if(dateTimeSelector?.innerText?.includes(":")){
          objectMessage.dateTime = moment(dateTimeSelector?.innerText, "HH:mm").format("YYYY/MM/DD HH:mm");
        }

        const isNew = element.querySelector('span[data-testid="icon-unread-count"]');

        if(objectMessage.dateTime.includes(":")){
          const isDuplicate = ALL_MESSAGES.some(item => JSON.stringify(item) == JSON.stringify(objectMessage));
          if(!isDuplicate){
            console.log(objectMessage);
            ALL_MESSAGES.push(objectMessage);
            if(isNew) triggerNewMessage(element);
          }
        }

      } catch (error) {
        console.log("Debug - AllMessage: ", error);
      }
    }

    if(ALL_MESSAGES.length > 0){
      ALL_MESSAGES.sort((a, b) => moment(a.dateTime, "YYYY/MM/DD HH:mm").unix() - moment(b.dateTime, "YYYY/MM/DD HH:mm").unix());
      window.localStorage.setItem("messages", JSON.stringify(ALL_MESSAGES));
    }
  }
  setTimeout(onWhatsAppMessage, 500);
}


/* =============================================================================================================
                                              Ambil Pesan Pada Room
============================================================================================================== */
function grabMessageOnRoom(){
  const chatRoomListElement = document.querySelector('div[data-testid="conversation-panel-messages"] div[role="application"]');

  if(chatRoomListElement){
    let separatorDate = "";
    
    const room = document.querySelector('div[data-testid="conversation-info-header"][role="button"] span[data-testid="conversation-info-header-chat-title"]')?.innerText;
    const eachList = [...chatRoomListElement.childNodes];

    let ROOM_MESSAGE = window.localStorage.getItem(room) ? JSON.parse(window.localStorage.getItem(room)) : [];
    
    for (let index = 0; index < eachList.length; index++) {
      const element = eachList[index];

      const objectMessage = {
        message: "",
        from: "",
        dateTime: "",
        isIn: false,
        isOut: false,
        isImage: false,
        isDoc: false,
        docName: "",
        id: ""
      }

      try {

        const separatorSelector = element.querySelector('div[class*="focusable-list-item"] div span[dir="auto"]');
        if(separatorSelector){
          const dayname = separatorSelector.innerText.toLowerCase();
          const subtractDay = Array.from({ length: 7 }).map((item, idx) => idx)
            .filter(item => moment().subtract(item, "days").format("dddd").toLowerCase() == dayname);
          if(dayname == "today"){
            separatorDate = moment().format("YYYY/MM/DD");
          }
          if(dayname == "yesterday"){
            separatorDate = moment().subtract(1, "days").format("YYYY/MM/DD");
          }
          if(subtractDay.length != 0){
            separatorDate = moment().subtract(subtractDay[0], "days").format("YYYY/MM/DD");
          }
          if(dayname.match(/\d{2}\/\d{2}\/\d{4}/g)){
            separatorDate = moment(dayname, "DD/MM/YYYY").format("YYYY/MM/DD");
          }
          if(dayname.includes("unread message")){
            simulateMouseClick(separatorSelector);
          }
        }

        const messageSelector = element.querySelector('div[data-testid="msg-container"] span[class*="selectable-text copyable-text"]');
        if(messageSelector){
          const messageArr = [...messageSelector.querySelector('span').childNodes];
          const message = messageArr.map(item => item.textContent || item.alt).join("");
          objectMessage.message = message
        }
        
        const timeSelector = element.querySelector('div[data-testid="msg-meta"] span[dir="auto"]');
        if(timeSelector){
          const time = timeSelector.innerText;
          if(separatorDate != ""){
            objectMessage.dateTime = `${separatorDate} ${time}`;
          }
        }
        
        const fromQuoteSelector = element.querySelector('div[data-testid="msg-container"] div[class*="copyable-text"][data-pre-plain-text]');
        if(fromQuoteSelector && objectMessage.from == ""){
          const fromName = fromQuoteSelector?.getAttribute("data-pre-plain-text").match(/(?<=\[\d+\:\d+\,\s\d+\/\d+\/\d+\]\s).*(?=\:\s?$)/g);
          if(fromName) objectMessage.from = fromName[0];
        }

        const fromMediaSelector = element.querySelector('div[role="button"][data-testid$="-thumb"]');
        if(fromMediaSelector && objectMessage.from == ""){
          const fromName = fromMediaSelector?.parentElement?.previousElementSibling?.getAttribute('aria-label')?.replace(/\:\s?$/g, "");
          objectMessage.from = fromName ? fromName : "";
          if(objectMessage.from == ""){
            const fromNameImg = fromMediaSelector?.parentElement?.parentElement?.
              previousElementSibling?.hasAttribute("data-testid");
            if(!fromNameImg){
              const from = fromMediaSelector?.parentElement?.parentElement?.
                previousElementSibling?.getAttribute("aria-label")?.replace(/\:\s?$/g, "");
                objectMessage.from = from ? from : "";
            }
          }
        }

        const fromTitle = element.querySelector('div[role="button"][data-testid*="-thumb"]');
        if(fromTitle && objectMessage.from == ""){
          const fromName = fromTitle.previousElementSibling?.querySelector('span')?.innerText;
          objectMessage.from = fromName ? fromName : "";
        }

        const docNameSelector = element.querySelector('div[data-testid="document-thumb"][title*="Download"]');
        if(docNameSelector){
          const docname = docNameSelector.title.match(/(?<=\").*(?=\")/g);
          if(docname) objectMessage.docName = docname[0];
        }

        const isImageSelector = element.querySelector('div[data-testid="image-thumb"]');
        if(isImageSelector) objectMessage.isImage = true;

        const isDocSelector = element.querySelector('div[data-testid="document-thumb"]');
        if(isDocSelector) objectMessage.isDoc = true;

        const outComingSelector = element.querySelector('div[class*="message-out"]');
        if(outComingSelector){
          objectMessage.isOut = true
          objectMessage.from = "You"
        };

        const inComingSelector = element.querySelector('div[class*="message-in"]');
        if(inComingSelector) objectMessage.isIn = true;

        const idSelector = element.querySelector('div[role="row"] div');
        if(idSelector){
          const dataId = idSelector.getAttribute("data-testid");
          const matchId = dataId.match(/(?<=\.(us|uk)\_)([a-z0-9]+)/gi);
          if(matchId) objectMessage.id = matchId[0];
          
        }

        const isDuplicate = ROOM_MESSAGE.filter(item => item.id == objectMessage.id).length > 0;

        if(!isDuplicate && objectMessage.dateTime != ""){
          console.log(objectMessage);
          if(!objectMessage.isDoc){
            ROOM_MESSAGE.push(objectMessage);
          };
          if(objectMessage.isDoc && objectMessage.docName != ""){
            ROOM_MESSAGE.push(objectMessage);
            simulateMouseClick(docNameSelector);
          };
        }

      } catch (error) {
        console.log("Debug - RoomMessage: ", error)
      }
    }

    if(ROOM_MESSAGE.length > 0){
      ROOM_MESSAGE.sort((a, b) => moment(a.dateTime, "YYYY/MM/DD HH:mm").unix() - moment(b.dateTime, "YYYY/MM/DD HH:mm").unix());
      window.localStorage.setItem(room, JSON.stringify(ROOM_MESSAGE));
    }
  }
  setTimeout(grabMessageOnRoom, 300);
}

onWhatsAppMessage();
grabMessageOnRoom();