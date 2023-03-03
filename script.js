/* ===============================================================================
                                    Intercept Fetch
================================================================================ */
const { fetch: originalFetch } = window;
window.fetch = async (...args) => {
  let [url, options] = args;
  const responseFetch = await originalFetch(url, options);
  const responseClone = responseFetch.clone();

  responseClone
    .json()
    .then((res) => {
      const request = options ? { url, options } : { options: url };
      const response = { res };
      console.log("Fetch: ", { request, response });
    })
    .catch((err) => {
      console.log("Fetch Error: ", "Response bukan sebuah Object.");
    });

  return responseFetch;
};
const originalXHR = window.XMLHttpRequest;


/* ===============================================================================
                                    Intercept XHR
================================================================================ */
function newXHR() {
  const xhr = new originalXHR();
  const requestResponseObject = {};

  xhr.addEventListener("loadstart", function () {
    requestResponseObject.requestUrl = this._url;
    requestResponseObject.requestTimestamp = new Date().toISOString();
    requestResponseObject.requestMethod = this._method;
    requestResponseObject.requestHeader = this._headers;
    requestResponseObject.requestPayload = this._body;
  });

  xhr.addEventListener("load", function () {
    let responseData = (data) => {
      try {
        return JSON.parse(data);
      } catch (error) {
        return "Response bukan sebuah Object.";
      }
    };
    requestResponseObject.responseStatus = this.status;
    requestResponseObject.responseHeader = this.getAllResponseHeaders();
    requestResponseObject.responseText = responseData(this.responseText);
    requestResponseObject.responseTimestamp = new Date().toISOString();

    const requestResponse = {
      request: {
        url: requestResponseObject.requestUrl,
        options: {
          timestamp: requestResponseObject.requestTimestamp,
          method: requestResponseObject.requestMethod,
          header: requestResponseObject.requestHeader,
          payload: requestResponseObject.requestPayload,
        },
      },
      response: {
        status: requestResponseObject.responseStatus,
        header: requestResponseObject.responseHeader,
        res: requestResponseObject.responseText,
        timestamp: requestResponseObject.responseTimestamp,
      },
    };

    console.log("XHR: ", requestResponse);
  });

  return xhr;
}
window.XMLHttpRequest = newXHR;


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

const MESSAGES = {}

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

            if(MESSAGES[room] && isNew && message){
                if(MESSAGES[room].filter(item => item.message == message && item.date == date).length == 0){
                    MESSAGES[room].push(objectMessage);
                    console.log(objectMessage);
                }
            }

            if(!MESSAGES[room] && isNew && message){
                    console.log(objectMessage);
                    MESSAGES[room] = [objectMessage];
            }
        });

        window.localStorage.setItem("messages", JSON.stringify(MESSAGES));
    }
}
