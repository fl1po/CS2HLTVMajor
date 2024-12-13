browser.tabs.onUpdated.addListener((tabId) => {
    browser.tabs.executeScript(tabId, {
        file: 'index.js'
    }).catch(error => {
        console.error('Failed to execute script:', error);
    });
});