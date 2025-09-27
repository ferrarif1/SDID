import {
  ready as i18nReady,
  translate,
  setLanguage,
  getLanguage,
  onLanguageChange,
  applyTranslations
} from '../shared/i18n.js';
import { registerTextFit, recalibrateTextFits, fitTextNow } from '../shared/textFit.js';

const IDENTITY_STORAGE_KEY = 'identities';

const identityList = document.getElementById('identity-list');
const searchInput = document.getElementById('search');
const statusMessage = document.getElementById('status-message');
const emptyState = document.getElementById('empty-state');
const emptyMessage = emptyState ? emptyState.querySelector('.empty-message') : null;
const createFirstButton = document.getElementById('create-first');
const manageButton = document.getElementById('open-options');
const searchLabel = document.querySelector('.search-label');
const languageToggle = document.getElementById('language-toggle');
const languageButtons = languageToggle ? Array.from(languageToggle.querySelectorAll('button')) : [];
let currentLanguage = getLanguage();

const staticFitTargets = [
  { element: searchLabel, options: { maxLines: 1 } },
  { element: createFirstButton, options: { maxLines: 1, preserveTitle: false } },
  { element: manageButton, options: { maxLines: 1, preserveTitle: false } },
  { element: statusMessage, options: { maxLines: 2 } },
  { element: emptyMessage, options: { maxLines: 3 } }
];

staticFitTargets.forEach(({ element, options }) => {
  if (element) {
    registerTextFit(element, options);
  }
});

languageButtons.forEach((button) => {
  registerTextFit(button, { maxLines: 1, preserveTitle: false });
});

function syncStaticFullText() {
  staticFitTargets.forEach(({ element }) => {
    if (element) {
      element.dataset.fullText = element.textContent || '';
    }
  });
  languageButtons.forEach((button) => {
    button.dataset.fullText = button.textContent || '';
  });
}

let identities = [];
let filteredIdentities = [];
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
  } catch (error) {
    console.error('Unable to determine active tab context', error);
  }
}

async function loadIdentities() {
  const stored = await chrome.storage.sync.get({ [IDENTITY_STORAGE_KEY]: [] });
  const items = Array.isArray(stored[IDENTITY_STORAGE_KEY]) ? stored[IDENTITY_STORAGE_KEY] : [];
  identities = items.map(normalizeIdentity).filter(Boolean);
  applyFilter(searchInput.value.trim());
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

function renderIdentities() {
  identityList.innerHTML = '';
  if (!filteredIdentities.length) {
    emptyState.hidden = false;
    recalibrateTextFits();
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

  recalibrateTextFits();
}

function createIdentityCard(identity) {
  const container = document.createElement('article');

  const title = document.createElement('h2');
  title.textContent = identity.label || translate('common.untitledIdentity');
  container.appendChild(title);
  registerTextFit(title, { maxLines: 2 });

  const meta = document.createElement('div');
  meta.className = 'identity-meta';

  if (identity.roles?.length) {
    const rolesChip = document.createElement('span');
    rolesChip.textContent = `${translate('popup.meta.roles')} ${identity.roles.join(', ')}`;
    meta.appendChild(rolesChip);
    registerTextFit(rolesChip, { maxLines: 1 });
  }

  if (identity.did) {
    const didChip = document.createElement('span');
    didChip.className = 'mono';
    didChip.textContent = `${translate('popup.meta.did')} ${identity.did}`;
    meta.appendChild(didChip);
    registerTextFit(didChip, { maxLines: 1 });
  }

  if (identity.tags?.length) {
    const tagsChip = document.createElement('span');
    tagsChip.textContent = `${translate('popup.meta.tags')} ${identity.tags.join(', ')}`;
    meta.appendChild(tagsChip);
    registerTextFit(tagsChip, { maxLines: 1 });
  }

  if (meta.childElementCount) {
    container.appendChild(meta);
  }

  if (identity.notes) {
    const notes = document.createElement('p');
    notes.className = 'identity-notes';
    notes.textContent = identity.notes;
    container.appendChild(notes);
    registerTextFit(notes, { maxLines: 3 });
  }

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const copyDidButton = document.createElement('button');
  copyDidButton.className = 'primary';
  copyDidButton.textContent = translate('popup.actions.copyDid');
  copyDidButton.addEventListener('click', () => { copyDid(identity); });
  actions.appendChild(copyDidButton);
  registerTextFit(copyDidButton, { maxLines: 1, preserveTitle: false });

  const copyKeyButton = document.createElement('button');
  copyKeyButton.className = 'secondary';
  copyKeyButton.textContent = translate('popup.actions.copyPublicKey');
  copyKeyButton.addEventListener('click', () => { copyPublicKey(identity); });
  actions.appendChild(copyKeyButton);
  registerTextFit(copyKeyButton, { maxLines: 1, preserveTitle: false });

  if (identity.username || identity.password) {
    const fillButton = document.createElement('button');
    fillButton.className = 'secondary';
    fillButton.textContent = translate('popup.actions.autofill');
    fillButton.addEventListener('click', () => { fillIdentity(identity); });
    actions.appendChild(fillButton);
    registerTextFit(fillButton, { maxLines: 1, preserveTitle: false });
  }

  container.appendChild(actions);
  return container;
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
    setStatus(translate('popup.status.filled', { label }), false, 'success');
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
    setStatus(translate('popup.status.copiedDid'), false, 'success');
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
    setStatus(translate('popup.status.copiedPublicKey'), false, 'success');
  } catch (error) {
    console.error('Copy public key failed', error);
    setStatus(translate('popup.status.copyPublicKeyError'), true);
  }
}

function setStatus(message, isError = false, tone = 'info') {
  statusMessage.textContent = message || '';
  statusMessage.dataset.fullText = statusMessage.textContent;
  if (!message) {
    statusMessage.removeAttribute('data-state');
    statusMessage.classList.remove('is-visible');
    statusMessage.removeAttribute('title');
    return;
  }
  statusMessage.dataset.state = isError ? 'error' : tone || 'info';
  statusMessage.classList.add('is-visible');
  fitTextNow(statusMessage, { maxLines: 2 });
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
  syncStaticFullText();
  updateLanguageToggleUI(lang);
  applyFilter(searchInput.value.trim());
  recalibrateTextFits();
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
  syncStaticFullText();
  updateLanguageToggleUI(currentLanguage);
  await loadActiveContext();
  await loadIdentities();
  recalibrateTextFits();
}

init().catch((error) => {
  console.error('Failed to initialize popup', error);
});
