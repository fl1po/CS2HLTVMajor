chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  chrome.scripting.executeScript({
    target: {tabId},
    files: ['index.js']
  });
});