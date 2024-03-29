const nullthrows = (v) => {
    if (v == null) throw new Error("it's a null");
    return v;
}

function injectCode(src) {
    const script = document.createElement("script");
    script.src = src;
    script.onload = function() {
        this.remove();
    };
    nullthrows(document.head || document.documentElement).appendChild(script);
}


injectCode(chrome.runtime.getURL("/moment.js"));
injectCode(chrome.runtime.getURL("/script.js"));