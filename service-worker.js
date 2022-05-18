chrome.tabs.onUpdated.addListener((tabId) => {
    chrome.scripting.executeScript({
        target: {tabId},
        files: ['index.js']
    });
});