function ScriptOnClient(args){
	console.log(args);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	chrome.scripting.executeScript({
		target: { tabId },
		function: ScriptOnClient,
		args: [tab]
	})
})