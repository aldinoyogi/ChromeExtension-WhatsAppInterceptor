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
      console.log("Fetch: ", { request, response });
    })
    .catch(() => {
      const response = { res: responseClone_ };
      console.log("Fetch: ", { request, response })
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
      console.log("XHR :", XHRReqRes);
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
    console.log("Websocket: ", args);

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
            console.log("Websocket Sent: ", {message: args});
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
          if(location.host === "web.whatsapp.com"){
            setTimeout(onWhatsAppMessage, 200);
          }
          if(location.host !== "web.whatsapp.com"){
            console.log("Websocket Received: ", { message });
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

const MESSAGES = []

function keepMessagesLength(){
  if(MESSAGES.length > 1000){
    MESSAGES.shift();
    keepMessagesLength();
  };
}

function onWhatsAppMessage(){
    const chatListElement = document.querySelector('div[aria-label="Chat list"]');
    if(chatListElement){
        const eachList = [...chatListElement.childNodes];

        eachList.forEach(item => {

            const messageElement = item.querySelector('div[data-testid="cell-frame-container"]')?.childNodes?.[1];
            const room = messageElement.querySelector('div[data-testid="cell-frame-title"] span[dir="auto"]')?.innerText;
            const message = messageElement.querySelector('span[data-testid="last-msg-status"] span[dir="ltr"]')?.innerText;
            const date = messageElement.querySelector('div[data-testid="cell-frame-title"]')?.parentNode?.childNodes?.[1].innerText;
            const from = messageElement.querySelector('span[data-testid="last-msg-status"] span[dir="auto"]')?.innerText;
            const isNew = messageElement.querySelector('span[data-testid="icon-unread-count"]');

            const objectMessage = { message, from: from ? from : room, room, date };

            if(MESSAGES.length > 0){
              const isDuplicated = MESSAGES.filter(item => item.message == message && item.date == date).length > 0;
              if(!isDuplicated && message && isNew){
                MESSAGES.push(objectMessage)
              }
            } else {
              MESSAGES.push(objectMessage)
            }

            keepMessagesLength();

            // if(MESSAGES[room] && isNew && message){
            //   if(MESSAGES[room].filter(item => item.message == message && item.date == date).length == 0){
            //     MESSAGES[room].push(objectMessage);
            //     console.log(objectMessage);
            //   }
            // }

            // if(!MESSAGES[room] && isNew && message){
            //   console.log(objectMessage);
            //   MESSAGES[room] = [objectMessage];
            // }
        });

        window.localStorage.setItem("messages", JSON.stringify(MESSAGES));
    }
}
