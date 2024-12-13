chrome.tabs.onUpdated.addListener((tabId) => {
    chrome.scripting.executeScript({
        target: {tabId},
        files: ['index.js']
    }).catch(error => {
        console.error('Failed to execute script:', error);
    });
});