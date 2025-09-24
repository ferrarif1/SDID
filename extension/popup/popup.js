import {
  ready as i18nReady,
  translate,
  setLanguage,
  getLanguage,
  onLanguageChange,
  applyTranslations
} from '../shared/i18n.js';

const IDENTITY_STORAGE_KEY = 'identities';

const identityList = document.getElementById('identity-list');
const searchInput = document.getElementById('search');
const statusMessage = document.getElementById('status-message');
const emptyState = document.getElementById('empty-state');
const createFirstButton = document.getElementById('create-first');
const manageButton = document.getElementById('open-options');
const languageToggle = document.getElementById('language-toggle');
const languageButtons = languageToggle ? Array.from(languageToggle.querySelectorAll('button')) : [];
const permissionBanner = document.getElementById('permission-banner');
const permissionButton = document.getElementById('enable-site');
const permissionOriginValue = document.getElementById('permission-origin-value');

let currentLanguage = getLanguage();

let identities = [];
let filteredIdentities = [];
let currentOrigin = null;
let activeTabId = null;

function parseList(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeParseJson(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function isHttpOrigin(origin) {
  return typeof origin === 'string' && /^https?:\/\//i.test(origin);
}

function toOriginPattern(origin) {
  if (!isHttpOrigin(origin)) {
    return null;
  }
  return `${origin.replace(/\/$/, '')}/*`;
}

function getContentScriptId(pattern) {
  const sanitized = pattern.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `sdid_bridge_${sanitized.slice(0, 120)}`;
}

function getMainWorldScriptId(pattern) {
  const sanitized = pattern.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `sdid_bridge_page_${sanitized.slice(0, 116)}`;
}

function normalizeIdentity(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const roles = Array.isArray(raw.roles) ? raw.roles.filter(Boolean) : parseList(raw.roles || '');
  const tags = Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : parseList(raw.tags || '');
  const publicKeyJwk = typeof raw.publicKeyJwk === 'string' ? safeParseJson(raw.publicKeyJwk) : raw.publicKeyJwk;
  const privateKeyJwk = typeof raw.privateKeyJwk === 'string' ? safeParseJson(raw.privateKeyJwk) : raw.privateKeyJwk;
  const authorizedOrigins = Array.isArray(raw.authorizedOrigins)
    ? raw.authorizedOrigins.filter((entry) => entry && entry.origin)
    : [];

  return {
    id: raw.id || crypto.randomUUID(),
    label: raw.label ? String(raw.label) : '',
    roles,
    domain: raw.domain ? String(raw.domain) : '',
    username: raw.username ? String(raw.username) : '',
    password: raw.password ? String(raw.password) : '',
    tags,
    notes: raw.notes ? String(raw.notes) : '',
    did: raw.did ? String(raw.did) : '',
    publicKeyJwk,
    privateKeyJwk,
    authorizedOrigins
  };
}

async function loadActiveContext() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) {
      activeTabId = activeTab.id;
    }
    if (activeTab?.url) {
      try {
        const parsedOrigin = new URL(activeTab.url).origin;
        currentOrigin = isHttpOrigin(parsedOrigin) ? parsedOrigin : null;
      } catch (_error) {
        currentOrigin = null;
      }
    }
    if (permissionOriginValue) {
      permissionOriginValue.textContent = currentOrigin || '';
    }
  } catch (error) {
    console.error('Unable to determine active tab context', error);
  }
}

async function updatePermissionState() {
  if (!permissionBanner) {
    return false;
  }

  if (permissionOriginValue) {
    permissionOriginValue.textContent = currentOrigin || '';
  }

  const canRequest = Boolean(activeTabId) && isHttpOrigin(currentOrigin);
  if (permissionButton) {
    permissionButton.disabled = !canRequest;
  }

  if (!canRequest) {
    permissionBanner.hidden = true;
    return false;
  }

  const originPattern = toOriginPattern(currentOrigin);
  if (!originPattern) {
    permissionBanner.hidden = true;
    if (permissionButton) {
      permissionButton.disabled = true;
    }
    return false;
  }

  try {
    const hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
    permissionBanner.hidden = hasPermission;
    if (hasPermission) {
      try {
        await ensureContentScriptRegistration(originPattern);
        await ensureBridgeInjectedIntoActiveTab();
      } catch (error) {
        console.warn('Unable to refresh SDID bridge for origin', originPattern, error);
      }
    }
    return hasPermission;
  } catch (error) {
    console.error('Unable to determine SDID permissions for origin', error);
    permissionBanner.hidden = true;
    if (permissionButton) {
      permissionButton.disabled = true;
    }
    return false;
  }
}

async function loadIdentities() {
  const stored = await chrome.storage.sync.get({ [IDENTITY_STORAGE_KEY]: [] });
  const items = Array.isArray(stored[IDENTITY_STORAGE_KEY]) ? stored[IDENTITY_STORAGE_KEY] : [];
  identities = items.map(normalizeIdentity).filter(Boolean);
  applyFilter(searchInput.value.trim());
}

async function ensureContentScriptRegistration(originPattern) {
  if (!originPattern || !chrome?.scripting?.registerContentScripts) {
    return;
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
}

async function ensureBridgeInjectedIntoActiveTab() {
  if (!activeTabId || !chrome?.scripting?.executeScript) {
    return;
  }
  let alreadyInjected = false;
  try {
    const response = await chrome.tabs.sendMessage(activeTabId, { type: 'sdid-ping' });
    alreadyInjected = Boolean(response?.ok);
  } catch (_error) {
    alreadyInjected = false;
  }
  if (alreadyInjected) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        files: ['pageBridge.js'],
        world: 'MAIN'
      });
    } catch (error) {
      console.warn('Unable to refresh SDID page bridge', error);
    }
    return;
  }
  await chrome.scripting.executeScript({
    target: { tabId: activeTabId },
    files: ['contentScript.js']
  });
  await chrome.scripting.executeScript({
    target: { tabId: activeTabId },
    files: ['pageBridge.js'],
    world: 'MAIN'
  });
}

function applyFilter(query) {
  const normalized = query.toLowerCase();
  filteredIdentities = identities.filter((identity) => {
    if (!normalized) {
      return true;
    }
    return [
      identity.label,
      identity.username,
      identity.domain,
      identity.did,
      identity.roles?.join(' ') || ''
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalized));
  });
  renderIdentities();
}

function isAuthorizedForOrigin(identity, origin) {
  if (!origin) {
    return false;
  }
  return identity.authorizedOrigins?.some((entry) => entry.origin === origin);
}

function renderIdentities() {
  identityList.innerHTML = '';
  if (!filteredIdentities.length) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  filteredIdentities
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    .forEach((identity) => {
      const listItem = document.createElement('li');
      listItem.className = 'identity-card';
      listItem.appendChild(createIdentityCard(identity));
      identityList.appendChild(listItem);
    });
}

function createIdentityCard(identity) {
  const container = document.createElement('article');
  
  const title = document.createElement('h2');
  title.textContent = identity.label || translate('common.untitledIdentity');
  container.appendChild(title);

  if (identity.domain) {
    const domain = document.createElement('p');
    domain.className = 'identity-domain';
    domain.textContent = `${translate('popup.meta.domain')} ${identity.domain}`;
    container.appendChild(domain);
  }

  const meta = document.createElement('div');
  meta.className = 'identity-meta';

  if (identity.roles?.length) {
    const rolesChip = document.createElement('span');
    rolesChip.textContent = `${translate('popup.meta.roles')} ${identity.roles.join(', ')}`;
    meta.appendChild(rolesChip);
  }

  if (identity.did) {
    const didChip = document.createElement('span');
    didChip.className = 'mono';
    didChip.textContent = `${translate('popup.meta.did')} ${identity.did}`;
    meta.appendChild(didChip);
  }

  if (identity.tags?.length) {
    const tagsChip = document.createElement('span');
    tagsChip.textContent = `${translate('popup.meta.tags')} ${identity.tags.join(', ')}`;
    meta.appendChild(tagsChip);
  }

  if (meta.childElementCount) {
    container.appendChild(meta);
  }

  if (identity.notes) {
    const notes = document.createElement('p');
    notes.className = 'identity-notes';
    notes.textContent = identity.notes;
    container.appendChild(notes);
  }

  if (currentOrigin) {
    const status = document.createElement('div');
    status.className = 'identity-status';
    const authorized = isAuthorizedForOrigin(identity, currentOrigin);
    status.textContent = authorized
      ? translate('popup.status.authorized')
      : translate('popup.status.unauthorized');
    status.dataset.state = authorized ? 'authorized' : 'unauthorized';
    container.appendChild(status);
  }

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const copyDidButton = document.createElement('button');
  copyDidButton.className = 'primary';
  copyDidButton.textContent = translate('popup.actions.copyDid');
  copyDidButton.addEventListener('click', () => copyDid(identity));
  actions.appendChild(copyDidButton);

  const copyKeyButton = document.createElement('button');
  copyKeyButton.className = 'secondary';
  copyKeyButton.textContent = translate('popup.actions.copyPublicKey');
  copyKeyButton.addEventListener('click', () => copyPublicKey(identity));
  actions.appendChild(copyKeyButton);

  if (identity.username || identity.password) {
    const fillButton = document.createElement('button');
    fillButton.className = 'secondary';
    fillButton.textContent = translate('popup.actions.autofill');
    fillButton.addEventListener('click', () => fillIdentity(identity));
    actions.appendChild(fillButton);
  }

  if (currentOrigin && isAuthorizedForOrigin(identity, currentOrigin)) {
    const revokeButton = document.createElement('button');
    revokeButton.className = 'danger';
    revokeButton.textContent = translate('popup.actions.revokeSite');
    revokeButton.addEventListener('click', () => revokeCurrentOrigin(identity));
    actions.appendChild(revokeButton);
  }

  container.appendChild(actions);
  return container;
}

async function revokeCurrentOrigin(identity) {
  if (!currentOrigin) {
    return;
  }
  try {
    const stored = await chrome.storage.sync.get({ [IDENTITY_STORAGE_KEY]: [] });
    const items = Array.isArray(stored[IDENTITY_STORAGE_KEY]) ? stored[IDENTITY_STORAGE_KEY] : [];
    const updated = items.map((item) => {
      if (item.id !== identity.id) {
        return item;
      }
      const nextOrigins = Array.isArray(item.authorizedOrigins)
        ? item.authorizedOrigins.filter((entry) => entry && entry.origin !== currentOrigin)
        : [];
      return { ...item, authorizedOrigins: nextOrigins, updatedAt: new Date().toISOString() };
    });
    await chrome.storage.sync.set({ [IDENTITY_STORAGE_KEY]: updated });
    setStatus(translate('popup.status.revokedSuccess'));
    await loadIdentities();
  } catch (error) {
    console.error('Failed to revoke authorization', error);
    setStatus(translate('popup.status.revokedError'), true);
  }
}

async function fillIdentity(identity) {
  setStatus(translate('popup.status.filling'));
  try {
    if (!activeTabId) {
      throw new Error(translate('popup.status.noTab'));
    }
    const response = await chrome.tabs.sendMessage(activeTabId, {
      type: 'fill-identity',
      identity
    });
    if (!response?.success) {
      throw new Error(
        response?.messages?.join(' ') || translate('popup.status.unableFill')
      );
    }
    await chrome.runtime.sendMessage({ type: 'record-last-used', identityId: identity.id });
    const label = identity.label || translate('common.untitledIdentity');
    setStatus(translate('popup.status.filled', { label }));
  } catch (error) {
    console.error('Fill identity failed', error);
    setStatus(error.message, true);
  }
}

async function copyDid(identity) {
  if (!identity.did) {
    setStatus(translate('popup.status.noDid'), true);
    return;
  }
  try {
    await navigator.clipboard.writeText(identity.did);
    setStatus(translate('popup.status.copiedDid'));
  } catch (error) {
    console.error('Copy DID failed', error);
    setStatus(translate('popup.status.copyDidError'), true);
  }
}

async function copyPublicKey(identity) {
  if (!identity.publicKeyJwk) {
    setStatus(translate('popup.status.noPublicKey'), true);
    return;
  }
  try {
    const payload = JSON.stringify(identity.publicKeyJwk, null, 2);
    await navigator.clipboard.writeText(payload);
    setStatus(translate('popup.status.copiedPublicKey'));
  } catch (error) {
    console.error('Copy public key failed', error);
    setStatus(translate('popup.status.copyPublicKeyError'), true);
  }
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message || '';
  statusMessage.dataset.state = isError ? 'error' : 'info';
}

if (permissionButton) {
  permissionButton.addEventListener('click', async () => {
    if (!currentOrigin || !isHttpOrigin(currentOrigin)) {
      setStatus(translate('popup.permissions.noOrigin'), true);
      return;
    }
    const originPattern = toOriginPattern(currentOrigin);
    if (!originPattern) {
      setStatus(translate('popup.permissions.noOrigin'), true);
      return;
    }
    try {
      let hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
      if (!hasPermission) {
        hasPermission = await chrome.permissions.request({ origins: [originPattern] });
      }
      if (!hasPermission) {
        setStatus(translate('popup.permissions.denied'), true);
        return;
      }
      await ensureContentScriptRegistration(originPattern);
      await ensureBridgeInjectedIntoActiveTab();
      await updatePermissionState();
      setStatus(translate('popup.permissions.success'));
    } catch (error) {
      console.error('Unable to enable SDID bridge for origin', error);
      setStatus(translate('popup.permissions.failed'), true);
    }
  });
}

searchInput.addEventListener('input', (event) => {
  applyFilter(event.target.value.trim());
});

createFirstButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

manageButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

function updateLanguageToggleUI(language) {
  languageButtons.forEach((button) => {
    const value = button.dataset.language;
    const isActive = value === language;
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.classList.toggle('active', isActive);
  });
}

if (languageButtons.length) {
  languageButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const nextLanguage = button.dataset.language;
      if (!nextLanguage || nextLanguage === currentLanguage) {
        return;
      }
      await setLanguage(nextLanguage);
    });
  });
}

onLanguageChange((lang) => {
  currentLanguage = lang;
  applyTranslations(document);
  updateLanguageToggleUI(lang);
  applyFilter(searchInput.value.trim());
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes[IDENTITY_STORAGE_KEY]) {
    const next = changes[IDENTITY_STORAGE_KEY].newValue || [];
    identities = Array.isArray(next) ? next.map(normalizeIdentity).filter(Boolean) : [];
    applyFilter(searchInput.value.trim());
  }
});

async function init() {
  await i18nReady;
  currentLanguage = getLanguage();
  applyTranslations(document);
  updateLanguageToggleUI(currentLanguage);
  await loadActiveContext();
  await updatePermissionState();
  await loadIdentities();
}

init().catch((error) => {
  console.error('Failed to initialize popup', error);
});
