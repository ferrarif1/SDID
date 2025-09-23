const IDENTITY_STORAGE_KEY = 'identities';
const LAST_USED_ID_KEY = 'lastUsedIdentityId';

chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    const stored = await chrome.storage.sync.get({ [IDENTITY_STORAGE_KEY]: [] });
    if (!Array.isArray(stored[IDENTITY_STORAGE_KEY])) {
      await chrome.storage.sync.set({ [IDENTITY_STORAGE_KEY]: [] });
    }
  } catch (error) {
    console.error('Failed to initialize identities', error);
  }

  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    try {
      await chrome.runtime.openOptionsPage();
    } catch (error) {
      console.warn('Unable to open options page automatically.', error);
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'record-last-used' && message.identityId) {
    chrome.storage.local
      .set({ [LAST_USED_ID_KEY]: message.identityId, lastUsedTimestamp: Date.now() })
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error('Unable to record last used identity', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  return false;
});
