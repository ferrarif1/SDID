const IDENTITY_STORAGE_KEY = 'identities';

const identityList = document.getElementById('identity-list');
const searchInput = document.getElementById('search');
const statusMessage = document.getElementById('status-message');
const emptyState = document.getElementById('empty-state');
const createFirstButton = document.getElementById('create-first');
const manageButton = document.getElementById('open-options');

const t = (en, zh) => `${en}｜${zh}`;

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
        currentOrigin = new URL(activeTab.url).origin;
      } catch (_error) {
        currentOrigin = null;
      }
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
  title.textContent = identity.label || t('Untitled identity', '未命名身份');
  container.appendChild(title);

  if (identity.domain) {
    const domain = document.createElement('p');
    domain.className = 'identity-domain';
    domain.textContent = `${t('Trusted domain', '信任域名')}: ${identity.domain}`;
    container.appendChild(domain);
  }

  const meta = document.createElement('div');
  meta.className = 'identity-meta';

  if (identity.roles?.length) {
    const rolesChip = document.createElement('span');
    rolesChip.textContent = `${t('Roles', '角色')}: ${identity.roles.join(', ')}`;
    meta.appendChild(rolesChip);
  }

  if (identity.did) {
    const didChip = document.createElement('span');
    didChip.className = 'mono';
    didChip.textContent = `${t('DID', 'DID')}: ${identity.did}`;
    meta.appendChild(didChip);
  }

  if (identity.tags?.length) {
    const tagsChip = document.createElement('span');
    tagsChip.textContent = `${t('Tags', '标签')}: ${identity.tags.join(', ')}`;
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
      ? t('Authorized for this site', '已授权当前站点')
      : t('Not yet authorized for this site', '尚未授权当前站点');
    status.dataset.state = authorized ? 'authorized' : 'unauthorized';
    container.appendChild(status);
  }

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const copyDidButton = document.createElement('button');
  copyDidButton.className = 'primary';
  copyDidButton.textContent = t('Copy DID', '复制 DID');
  copyDidButton.addEventListener('click', () => copyDid(identity));
  actions.appendChild(copyDidButton);

  const copyKeyButton = document.createElement('button');
  copyKeyButton.className = 'secondary';
  copyKeyButton.textContent = t('Copy public key', '复制公钥');
  copyKeyButton.addEventListener('click', () => copyPublicKey(identity));
  actions.appendChild(copyKeyButton);

  if (identity.username || identity.password) {
    const fillButton = document.createElement('button');
    fillButton.className = 'secondary';
    fillButton.textContent = t('Autofill login', '自动填充登录');
    fillButton.addEventListener('click', () => fillIdentity(identity));
    actions.appendChild(fillButton);
  }

  if (currentOrigin && isAuthorizedForOrigin(identity, currentOrigin)) {
    const revokeButton = document.createElement('button');
    revokeButton.className = 'danger';
    revokeButton.textContent = t('Revoke site', '撤销站点');
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
    setStatus(t('Revoked current site authorization.', '已撤销当前站点授权。'));
    await loadIdentities();
  } catch (error) {
    console.error('Failed to revoke authorization', error);
    setStatus(t('Unable to revoke authorization.', '无法撤销授权。'), true);
  }
}

async function fillIdentity(identity) {
  setStatus(t('Filling identity…', '正在填充登录信息…'));
  try {
    if (!activeTabId) {
      throw new Error(t('No active tab available.', '当前没有可用的浏览器标签页。'));
    }
    const response = await chrome.tabs.sendMessage(activeTabId, {
      type: 'fill-identity',
      identity
    });
    if (!response?.success) {
      throw new Error(
        response?.messages?.join(' ') || t('Unable to fill identity on this page.', '无法在此页面填充身份信息。')
      );
    }
    await chrome.runtime.sendMessage({ type: 'record-last-used', identityId: identity.id });
    setStatus(t(`Filled ${identity.label}`, `已填充 ${identity.label}`));
  } catch (error) {
    console.error('Fill identity failed', error);
    setStatus(error.message, true);
  }
}

async function copyDid(identity) {
  if (!identity.did) {
    setStatus(t('This identity does not have a DID yet.', '该身份尚未生成 DID。'), true);
    return;
  }
  try {
    await navigator.clipboard.writeText(identity.did);
    setStatus(t('Copied DID to clipboard.', '已复制 DID。'));
  } catch (error) {
    console.error('Copy DID failed', error);
    setStatus(t('Unable to copy DID.', '无法复制 DID。'), true);
  }
}

async function copyPublicKey(identity) {
  if (!identity.publicKeyJwk) {
    setStatus(t('No public key available.', '没有可用的公钥。'), true);
    return;
  }
  try {
    const payload = JSON.stringify(identity.publicKeyJwk, null, 2);
    await navigator.clipboard.writeText(payload);
    setStatus(t('Copied public key JSON.', '已复制公钥 JSON。'));
  } catch (error) {
    console.error('Copy public key failed', error);
    setStatus(t('Unable to copy public key.', '无法复制公钥。'), true);
  }
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message || '';
  statusMessage.style.color = isError ? '#fca5a5' : 'rgba(226, 232, 240, 0.9)';
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

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes[IDENTITY_STORAGE_KEY]) {
    const next = changes[IDENTITY_STORAGE_KEY].newValue || [];
    identities = Array.isArray(next) ? next.map(normalizeIdentity).filter(Boolean) : [];
    applyFilter(searchInput.value.trim());
  }
});

(async () => {
  await loadActiveContext();
  await loadIdentities();
})();
