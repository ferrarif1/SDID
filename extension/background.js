const IDENTITY_STORAGE_KEY = 'identities';
const LAST_USED_ID_KEY = 'lastUsedIdentityId';
const DEFAULT_BRIDGE_ORIGINS = ['https://*/*', 'http://*/*'];

function mergeOriginsWithDefaults(origins = []) {
  const normalized = Array.isArray(origins) ? origins.filter(Boolean) : [];
  return [...new Set([...DEFAULT_BRIDGE_ORIGINS, ...normalized])];
}

function getContentScriptId(pattern) {
  const sanitized = pattern.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `sdid_bridge_${sanitized.slice(0, 120)}`;
}

function getMainWorldScriptId(pattern) {
  const sanitized = pattern.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `sdid_bridge_page_${sanitized.slice(0, 116)}`;
}

function isValidOriginPattern(pattern) {
  return typeof pattern === 'string' && /^https?:\/\//i.test(pattern);
}

async function registerBridgeForOrigins(origins = []) {
  if (!chrome?.scripting?.registerContentScripts) {
    return;
  }
  for (const originPattern of mergeOriginsWithDefaults(origins)) {
    if (!isValidOriginPattern(originPattern)) {
      continue;
    }
    const scriptId = getContentScriptId(originPattern);
    const pageScriptId = getMainWorldScriptId(originPattern);
    try {
      await chrome.scripting.unregisterContentScripts({ ids: [scriptId, pageScriptId] });
    } catch (error) {
      const message = String(error?.message || '');
      if (!/no\sregistered\scontent\sscript/i.test(message) && !/invalid\sscript\sid/i.test(message)) {
        console.debug('No existing SDID bridge registration to remove', error);
      }
    }
    try {
      await chrome.scripting.registerContentScripts([
        {
          id: scriptId,
          js: ['contentScript.js'],
          matches: [originPattern],
          runAt: 'document_start',
          persistAcrossSessions: true
        },
        {
          id: pageScriptId,
          js: ['pageBridge.js'],
          matches: [originPattern],
          runAt: 'document_start',
          world: 'MAIN',
          persistAcrossSessions: true
        }
      ]);
    } catch (error) {
      console.error('Failed to register SDID bridge for origin', originPattern, error);
    }
  }
}

async function unregisterBridgeForOrigins(origins = []) {
  if (!chrome?.scripting?.unregisterContentScripts) {
    return;
  }
  for (const originPattern of origins) {
    if (DEFAULT_BRIDGE_ORIGINS.includes(originPattern)) {
      continue;
    }
    if (!isValidOriginPattern(originPattern)) {
      continue;
    }
    const scriptId = getContentScriptId(originPattern);
    const pageScriptId = getMainWorldScriptId(originPattern);
    try {
      await chrome.scripting.unregisterContentScripts({ ids: [scriptId, pageScriptId] });
    } catch (error) {
      const message = String(error?.message || '');
      if (!/no\sregistered\scontent\sscript/i.test(message) && !/invalid\sscript\sid/i.test(message)) {
        console.error('Failed to unregister SDID bridge for origin', originPattern, error);
      }
    }
  }
}

async function syncRegisteredOrigins() {
  if (!chrome?.permissions?.getAll) {
    await registerBridgeForOrigins();
    return;
  }
  try {
    const permissions = await chrome.permissions.getAll();
    const origins = permissions?.origins || [];
    await registerBridgeForOrigins(origins);
  } catch (error) {
    console.error('Unable to synchronize SDID bridge registrations', error);
  }
}

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

  await syncRegisteredOrigins();
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

chrome.permissions.onAdded.addListener((permissions) => {
  if (!permissions?.origins?.length) {
    return;
  }
  registerBridgeForOrigins(permissions.origins).catch((error) => {
    console.error('Unable to register SDID bridge after permission grant', error);
  });
});

chrome.permissions.onRemoved.addListener((permissions) => {
  if (!permissions?.origins?.length) {
    return;
  }
  unregisterBridgeForOrigins(permissions.origins).catch((error) => {
    console.error('Unable to unregister SDID bridge after permission removal', error);
  });
});

syncRegisteredOrigins().catch((error) => {
  console.error('Failed to initialize SDID bridge registrations', error);
});
