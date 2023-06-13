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
          const message = event.data;
		      console.log("New Incoming")
          if(location.host === "web.whatsapp.com"){
            setTimeout(onWhatsAppMessage, 200);
          }
          if(location.host !== "web.whatsapp.com"){
            // console.log("Websocket Received: ", { message });
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

function keepMessagesLength(MESSAGES){
  if(MESSAGES.length > 1000){
    MESSAGES.shift();
    keepMessagesLength();
  };
}

function onWhatsAppMessage(){
    const chatListElement = document.querySelector('div[aria-label="Chat list"]');
    const chatRoomListElement = document.querySelector('div[data-testid="conversation-panel-messages"] div[role="application"]');
    
    /* ========================================================================================================
                                      Hanya mengambil pesan dari Tampilan Room
    ========================================================================================================= */
    if(chatRoomListElement != null){
      let messages = []
      let roomOwner = "";
      const eachList = [...chatRoomListElement.childNodes];
      eachList.forEach(item => {
        let message = item.innerText;
        const isDoc = item.querySelector('div[data-testid="document-thumb"][title^="Download"]');
        const isIn = item.querySelector('div[class*="message-in"]') == null ? false : true;
        const isOut = item.querySelector('div[class*="message-out"]') == null ? false : true;
        const room = document.querySelector('div[data-testid="conversation-info-header"][role="button"] span')?.innerText;
        const separator = item.querySelector('div[class*="focusable-list-item"] span')?.innerText;
        const time = item.querySelector('div[data-testid="msg-meta"] span')?.innerText;

        if(isDoc != null) {
          message = item.querySelector('span[data-testid="document-caption"] span')?.innerText;
        } else {
          message = item.querySelector('span[class*="selectable-text copyable-text"] span')?.innerText;
        }

        if(roomOwner == "" && room != null){
          roomOwner = room;
        }

        const objectMessage = { room, isIn, isOut, isDoc: isDoc ? true : false, message, separator, time };
        messages.push(objectMessage)
      })
      window.localStorage.setItem(roomOwner, JSON.stringify(messages));
      console.log(roomOwner, messages)
    }

    /* ========================================================================================================
                                      Hanya mengambil pesan dari Tampilan Umum
    ========================================================================================================= */
    if(chatListElement){
        const eachList = [...chatListElement.childNodes];
        const dateNow = new Date();

        eachList.forEach(item => {

          const messageElement = item.querySelector('div[data-testid="cell-frame-container"]')?.childNodes?.[1];
          const room = messageElement.querySelector('div[data-testid="cell-frame-title"] span[dir="auto"]')?.innerText;
          const message = messageElement.querySelector('span[data-testid="last-msg-status"] span[dir="ltr"]')?.innerText;
          let date = messageElement.querySelector('div[data-testid="cell-frame-title"]')?.parentNode?.childNodes?.[1].innerText;
          const from = messageElement.querySelector('span[data-testid="last-msg-status"] span[dir="auto"]')?.innerText;
          const isNew = messageElement.querySelector('span[data-testid="icon-unread-count"]') == undefined ? false : true;
          const isDoc = messageElement.querySelector('span[data-icon="status-document"]') == undefined ? false : true;
          
          if(date.includes(":")){
            const hour = date.split(":")[0];
            const minute = date.split(":")[1];
            dateNow.setHours(parseInt(hour));
            dateNow.setMinutes(parseInt(minute));
            dateNow.setSeconds(0);
            dateNow.setMilliseconds(0);
            date = dateNow.toISOString();

            const objectMessage = { message, from: from ? from : room, room, date, isNew, isDoc };
            let MESSAGES = window.localStorage.getItem("messages") ? JSON.parse(window.localStorage.getItem("messages")) : []

            if(MESSAGES.filter(item => item.message == message && item.room == room && item.from == from && item.isNew == isNew && item.date == date).length == 0){
              console.log(objectMessage)
              MESSAGES.push(objectMessage)
              const uniqueArray = MESSAGES.filter((value, index) => {
                const _value = JSON.stringify(value);
                return index === MESSAGES.findIndex(obj => {
                  return JSON.stringify(obj) === _value;
                });
              });
              keepMessagesLength(uniqueArray);
              window.localStorage.setItem("messages", JSON.stringify(uniqueArray));
            }
          }
        });
    }
}
