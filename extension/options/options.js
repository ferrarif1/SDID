const IDENTITY_STORAGE_KEY = 'identities';
const KEY_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' };

const form = document.getElementById('identity-form');
const formTitle = document.getElementById('form-title');
const cancelEditButton = document.getElementById('cancel-edit');
const createDemoButton = document.getElementById('create-demo');
const exportButton = document.getElementById('export');
const importInput = document.getElementById('import-file');
const clearStorageButton = document.getElementById('clear-storage');
const confirmClearDialog = document.getElementById('confirm-clear');
const collection = document.getElementById('identity-collection');

const labelInput = document.getElementById('label');
const rolesInput = document.getElementById('roles');
const domainInput = document.getElementById('domain');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const tagsInput = document.getElementById('tags');
const notesInput = document.getElementById('notes');
const didInput = document.getElementById('did');
const publicKeyTextarea = document.getElementById('public-key');
const privateKeyTextarea = document.getElementById('private-key');
const generateDidButton = document.getElementById('generate-did');
const togglePrivateButton = document.getElementById('toggle-private');
const copyPrivateButton = document.getElementById('copy-private');

const t = (en, zh) => `${en}｜${zh}`;

let identities = [];
let editingId = null;
let currentKeyPair = null;
let isGenerating = false;

function parseList(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTags(value) {
  return parseList(value);
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

function normalizeKeyPair(raw) {
  if (!raw) {
    return null;
  }
  const did = typeof raw.did === 'string' ? raw.did : '';
  const publicKeyJwk = typeof raw.publicKeyJwk === 'string' ? safeParseJson(raw.publicKeyJwk) : raw.publicKeyJwk;
  const privateKeyJwk = typeof raw.privateKeyJwk === 'string' ? safeParseJson(raw.privateKeyJwk) : raw.privateKeyJwk;
  if (!did || !publicKeyJwk || !privateKeyJwk) {
    return null;
  }
  return {
    did,
    publicKeyJwk,
    privateKeyJwk
  };
}

function normalizeIdentity(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const now = new Date().toISOString();
  const normalizedRoles = Array.isArray(raw.roles) ? raw.roles.filter(Boolean) : parseList(raw.roles || raw.role || '');
  const normalizedTags = Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : parseTags(raw.tags || '');
  const keyPair = normalizeKeyPair(raw);
  const authorizedOrigins = Array.isArray(raw.authorizedOrigins)
    ? raw.authorizedOrigins
        .filter((entry) => entry && entry.origin)
        .map((entry) => ({
          origin: String(entry.origin),
          createdAt: entry.createdAt || now,
          lastUsedAt: entry.lastUsedAt || entry.createdAt || now
        }))
    : [];

  return {
    id: raw.id || crypto.randomUUID(),
    label: raw.label ? String(raw.label) : '',
    roles: normalizedRoles,
    domain: raw.domain ? String(raw.domain) : '',
    username: raw.username ? String(raw.username) : '',
    password: raw.password ? String(raw.password) : '',
    tags: normalizedTags,
    notes: raw.notes ? String(raw.notes) : '',
    did: keyPair?.did || String(raw.did || ''),
    publicKeyJwk: keyPair?.publicKeyJwk || (raw.publicKeyJwk && typeof raw.publicKeyJwk === 'object' ? raw.publicKeyJwk : null),
    privateKeyJwk: keyPair?.privateKeyJwk || (raw.privateKeyJwk && typeof raw.privateKeyJwk === 'object' ? raw.privateKeyJwk : null),
    authorizedOrigins,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now
  };
}

function deepClone(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

function buildStoredIdentity(identity) {
  return {
    id: identity.id,
    label: identity.label,
    roles: Array.isArray(identity.roles) ? [...identity.roles] : [],
    domain: identity.domain || '',
    username: identity.username || '',
    password: identity.password || '',
    tags: Array.isArray(identity.tags) ? [...identity.tags] : [],
    notes: identity.notes || '',
    did: identity.did || '',
    publicKeyJwk: identity.publicKeyJwk ? deepClone(identity.publicKeyJwk) : null,
    privateKeyJwk: identity.privateKeyJwk ? deepClone(identity.privateKeyJwk) : null,
    authorizedOrigins: Array.isArray(identity.authorizedOrigins)
      ? identity.authorizedOrigins.map((entry) => ({
          origin: entry.origin,
          createdAt: entry.createdAt,
          lastUsedAt: entry.lastUsedAt
        }))
      : [],
    createdAt: identity.createdAt || new Date().toISOString(),
    updatedAt: identity.updatedAt || new Date().toISOString()
  };
}

async function loadIdentities() {
  const stored = await chrome.storage.sync.get({ [IDENTITY_STORAGE_KEY]: [] });
  const items = Array.isArray(stored[IDENTITY_STORAGE_KEY]) ? stored[IDENTITY_STORAGE_KEY] : [];
  identities = items
    .map(normalizeIdentity)
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  renderCollection();
}

async function saveIdentities(nextIdentities) {
  const stored = nextIdentities.map(buildStoredIdentity);
  await chrome.storage.sync.set({ [IDENTITY_STORAGE_KEY]: stored });
  identities = stored.map(normalizeIdentity).filter(Boolean);
  renderCollection();
}

function formatRoles(roles) {
  if (!roles?.length) {
    return t('No role assigned', '未设置角色');
  }
  return roles.join(', ');
}

function formatDate(value) {
  if (!value) {
    return '';
  }
  try {
    const date = new Date(value);
    return date.toLocaleString();
  } catch (_error) {
    return value;
  }
}

function renderCollection() {
  collection.innerHTML = '';
  if (!identities.length) {
    const empty = document.createElement('li');
    empty.className = 'identity-item';
    empty.innerHTML = `<p>${t('No identities saved yet. Use the form above to add your first decentralized identity.', '还没有保存任何身份，请使用上方表单创建首个去中心化身份。')}</p>`;
    collection.appendChild(empty);
    return;
  }

  identities.forEach((identity) => {
    const item = document.createElement('li');
    item.className = 'identity-item';
    item.dataset.id = identity.id;

    const header = document.createElement('header');
    const title = document.createElement('div');
    const heading = document.createElement('h3');
    heading.textContent = identity.label || t('Untitled identity', '未命名身份');
    title.appendChild(heading);

    if (identity.domain) {
      const domain = document.createElement('p');
      domain.textContent = `${t('Trusted domain', '信任域名')}: ${identity.domain}`;
      title.appendChild(domain);
    }
    header.appendChild(title);

    if (identity.tags?.length) {
      const tagsContainer = document.createElement('div');
      identity.tags.forEach((tag) => {
        const tagElement = document.createElement('span');
        tagElement.className = 'tag-badge';
        tagElement.textContent = tag;
        tagsContainer.appendChild(tagElement);
      });
      header.appendChild(tagsContainer);
    }

    item.appendChild(header);

    const meta = document.createElement('div');
    meta.className = 'meta-line';

    const roleLine = document.createElement('span');
    roleLine.textContent = `${t('Roles', '角色')}: ${formatRoles(identity.roles)}`;
    meta.appendChild(roleLine);

    if (identity.did) {
      const didLine = document.createElement('span');
      didLine.textContent = `${t('DID', 'DID')}: ${identity.did}`;
      meta.appendChild(didLine);
    }

    if (identity.username) {
      const usernameLine = document.createElement('span');
      usernameLine.textContent = `${t('Username', '用户名')}: ${identity.username}`;
      meta.appendChild(usernameLine);
    }

    item.appendChild(meta);

    if (identity.notes) {
      const notes = document.createElement('p');
      notes.textContent = identity.notes;
      item.appendChild(notes);
    }

    if (identity.authorizedOrigins?.length) {
      const authorizedContainer = document.createElement('div');
      authorizedContainer.className = 'authorized-origins';
      const heading = document.createElement('h4');
      heading.textContent = t('Authorized sites', '已授权站点');
      authorizedContainer.appendChild(heading);

      const list = document.createElement('ul');
      identity.authorizedOrigins
        .slice()
        .sort((a, b) => new Date(b.lastUsedAt || b.createdAt).getTime() - new Date(a.lastUsedAt || a.createdAt).getTime())
        .forEach((entry) => {
          const row = document.createElement('li');
          const info = document.createElement('span');
          info.textContent = entry.origin;
          const time = document.createElement('time');
          time.textContent = `${t('Last used', '最近使用')}: ${formatDate(entry.lastUsedAt)}`;
          info.appendChild(time);
          row.appendChild(info);

          const revokeButton = document.createElement('button');
          revokeButton.type = 'button';
          revokeButton.textContent = t('Revoke', '撤销');
          revokeButton.addEventListener('click', () => revokeAuthorization(identity.id, entry.origin));
          row.appendChild(revokeButton);

          list.appendChild(row);
        });
      authorizedContainer.appendChild(list);
      item.appendChild(authorizedContainer);
    }

    const actions = document.createElement('div');
    actions.className = 'identity-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = t('Edit', '编辑');
    editButton.addEventListener('click', () => startEdit(identity.id));
    actions.appendChild(editButton);

    const duplicateButton = document.createElement('button');
    duplicateButton.type = 'button';
    duplicateButton.textContent = t('Duplicate', '复制');
    duplicateButton.addEventListener('click', () => duplicateIdentity(identity.id));
    actions.appendChild(duplicateButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.classList.add('danger');
    deleteButton.textContent = t('Delete', '删除');
    deleteButton.addEventListener('click', () => deleteIdentity(identity.id));
    actions.appendChild(deleteButton);

    item.appendChild(actions);
    collection.appendChild(item);
  });
}

function updateKeyDisplay(keyPair) {
  if (keyPair?.did) {
    didInput.value = keyPair.did;
    publicKeyTextarea.value = JSON.stringify(keyPair.publicKeyJwk, null, 2);
    privateKeyTextarea.value = JSON.stringify(keyPair.privateKeyJwk, null, 2);
  } else {
    didInput.value = '';
    publicKeyTextarea.value = '';
    privateKeyTextarea.value = '';
  }
  setPrivateVisibility(false);
}

function setPrivateVisibility(visible) {
  if (!privateKeyTextarea.value) {
    privateKeyTextarea.dataset.hidden = 'true';
    togglePrivateButton.textContent = t('Show', '显示');
    return;
  }
  if (visible) {
    privateKeyTextarea.dataset.hidden = 'false';
    togglePrivateButton.textContent = t('Hide', '隐藏');
  } else {
    privateKeyTextarea.dataset.hidden = 'true';
    togglePrivateButton.textContent = t('Show', '显示');
  }
}

async function generateDid() {
  if (isGenerating) {
    return;
  }
  try {
    isGenerating = true;
    generateDidButton.disabled = true;
    generateDidButton.textContent = t('Generating…', '正在生成…');
    const keyPair = await crypto.subtle.generateKey(KEY_ALGORITHM, true, ['sign', 'verify']);
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const did = `did:sdid:${publicKeyJwk.x}.${publicKeyJwk.y}`;
    currentKeyPair = { did, publicKeyJwk, privateKeyJwk };
    updateKeyDisplay(currentKeyPair);
    notify(t('Generated new DID and key pair.', '已生成新的 DID 与密钥对。'));
  } catch (error) {
    console.error('DID generation failed', error);
    notify(t('Failed to generate DID. Please ensure Web Crypto is available.', '无法生成 DID，请确认浏览器支持 Web Crypto。'), true);
  } finally {
    isGenerating = false;
    generateDidButton.disabled = false;
    generateDidButton.textContent = t('Generate DID', '生成 DID');
  }
}

function getCurrentIdentity() {
  if (!editingId) {
    return null;
  }
  return identities.find((item) => item.id === editingId) || null;
}

function startEdit(identityId) {
  const identity = identities.find((item) => item.id === identityId);
  if (!identity) {
    return;
  }
  editingId = identity.id;
  formTitle.textContent = t('Edit DID identity', '编辑 DID 身份');
  cancelEditButton.hidden = false;

  labelInput.value = identity.label;
  rolesInput.value = identity.roles?.join(', ') || '';
  domainInput.value = identity.domain || '';
  usernameInput.value = identity.username || '';
  passwordInput.value = identity.password || '';
  tagsInput.value = identity.tags?.join(', ') || '';
  notesInput.value = identity.notes || '';

  currentKeyPair = identity.did && identity.publicKeyJwk && identity.privateKeyJwk
    ? {
        did: identity.did,
        publicKeyJwk: identity.publicKeyJwk,
        privateKeyJwk: identity.privateKeyJwk
      }
    : null;
  updateKeyDisplay(currentKeyPair);
  labelInput.focus();
}

async function duplicateIdentity(identityId) {
  const original = identities.find((item) => item.id === identityId);
  if (!original) {
    return;
  }
  try {
    const keyPair = await crypto.subtle.generateKey(KEY_ALGORITHM, true, ['sign', 'verify']);
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const did = `did:sdid:${publicKeyJwk.x}.${publicKeyJwk.y}`;
    const now = new Date().toISOString();
    const copy = {
      ...original,
      id: crypto.randomUUID(),
      label: `${original.label} (${t('copy', '副本').replace('｜', ' / ')})`,
      did,
      publicKeyJwk,
      privateKeyJwk,
      authorizedOrigins: [],
      createdAt: now,
      updatedAt: now
    };
    const next = [...identities, copy];
    await saveIdentities(next);
    notify(t('Duplicated identity with new DID.', '已复制身份并生成新的 DID。'));
  } catch (error) {
    console.error('Duplicate identity failed', error);
    notify(t('Unable to duplicate identity.', '无法复制该身份。'), true);
  }
}

async function deleteIdentity(identityId) {
  const next = identities.filter((item) => item.id !== identityId);
  await saveIdentities(next);
  if (editingId === identityId) {
    resetForm();
  }
  notify(t('Deleted identity.', '已删除身份。'));
}

async function revokeAuthorization(identityId, origin) {
  const identity = identities.find((item) => item.id === identityId);
  if (!identity) {
    return;
  }
  const next = identities.map((item) => {
    if (item.id !== identityId) {
      return item;
    }
    return {
      ...item,
      authorizedOrigins: item.authorizedOrigins.filter((entry) => entry.origin !== origin),
      updatedAt: new Date().toISOString()
    };
  });
  await saveIdentities(next);
  notify(t('Revoked authorization.', '已撤销授权。'));
}

function resetForm() {
  editingId = null;
  currentKeyPair = null;
  form.reset();
  updateKeyDisplay(null);
  formTitle.textContent = t('Create DID identity', '创建 DID 身份');
  cancelEditButton.hidden = true;
}

function notify(message, isError = false) {
  let banner = document.querySelector('.notification-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'notification-banner';
    document.body.appendChild(banner);
  }
  banner.textContent = message;
  banner.style.background = isError ? 'rgba(248, 113, 113, 0.25)' : 'rgba(45, 212, 191, 0.3)';
  banner.style.color = '#f8fafc';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');

  banner.classList.add('visible');
  setTimeout(() => banner.classList.remove('visible'), 3500);
}

function validateKeyPair() {
  if (currentKeyPair?.did && currentKeyPair?.publicKeyJwk && currentKeyPair?.privateKeyJwk) {
    return true;
  }
  notify(t('Generate a DID before saving.', '请先生成 DID 再保存。'), true);
  generateDidButton.focus();
  return false;
}

function buildIdentityFromForm() {
  const base = getCurrentIdentity();
  const now = new Date().toISOString();
  return {
    id: editingId ?? crypto.randomUUID(),
    label: labelInput.value.trim(),
    roles: parseList(rolesInput.value),
    domain: domainInput.value.trim(),
    username: usernameInput.value.trim(),
    password: passwordInput.value.trim(),
    tags: parseTags(tagsInput.value),
    notes: notesInput.value.trim(),
    did: currentKeyPair?.did || base?.did || '',
    publicKeyJwk: currentKeyPair?.publicKeyJwk || base?.publicKeyJwk || null,
    privateKeyJwk: currentKeyPair?.privateKeyJwk || base?.privateKeyJwk || null,
    authorizedOrigins: base?.authorizedOrigins || [],
    createdAt: base?.createdAt || now,
    updatedAt: now
  };
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!labelInput.value.trim()) {
    labelInput.focus();
    notify(t('Display name is required.', '显示名称不能为空。'), true);
    return;
  }
  if (!validateKeyPair()) {
    return;
  }
  const identity = buildIdentityFromForm();
  const storedIdentity = buildStoredIdentity(identity);
  const next = editingId
    ? identities.map((item) => (item.id === editingId ? storedIdentity : item))
    : [...identities, storedIdentity];
  await saveIdentities(next);
  notify(t('Identity saved.', '身份已保存。'));
  resetForm();
}

async function createDemoIdentities() {
  if (identities.length) {
    notify(t('Clear existing identities before creating demos.', '请先清空现有身份后再生成示例数据。'), true);
    return;
  }
  if (isGenerating) {
    return;
  }
  isGenerating = true;
  createDemoButton.disabled = true;
  createDemoButton.textContent = t('Generating…', '正在生成…');
  try {
    const templates = [
      {
        label: 'Operations Admin',
        roles: ['Admin', 'Approver'],
        domain: 'https://console.example.com',
        notes: t('Full access to internal console with approval powers.', '拥有内部控制台完全访问权限，可审批关键操作。'),
        tags: ['core', 'operations']
      },
      {
        label: 'Finance Signer',
        roles: ['Finance', 'Signer'],
        domain: 'https://billing.example.com',
        notes: t('Use for invoice approvals and settlement workflows.', '用于发票审批与结算流程。'),
        tags: ['finance']
      },
      {
        label: 'Developer Sandbox',
        roles: ['Developer'],
        domain: 'https://sandbox.example.dev',
        notes: t('Grants access to pre-production integrations.', '用于访问预生产集成环境。'),
        tags: ['sandbox', 'dev'],
        authorizedOrigins: [
          {
            origin: 'https://demo.sdid.app',
            createdAt: new Date().toISOString(),
            lastUsedAt: new Date().toISOString()
          }
        ]
      }
    ];

    const now = new Date().toISOString();
    const demoIdentities = [];
    for (const template of templates) {
      const keyPair = await crypto.subtle.generateKey(KEY_ALGORITHM, true, ['sign', 'verify']);
      const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
      const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
      const did = `did:sdid:${publicKeyJwk.x}.${publicKeyJwk.y}`;
      demoIdentities.push({
        id: crypto.randomUUID(),
        label: template.label,
        roles: template.roles,
        domain: template.domain,
        username: '',
        password: '',
        tags: template.tags || [],
        notes: template.notes,
        did,
        publicKeyJwk,
        privateKeyJwk,
        authorizedOrigins: template.authorizedOrigins || [],
        createdAt: now,
        updatedAt: now
      });
    }
    await saveIdentities(demoIdentities);
    notify(t('Demo identities created.', '已生成示例身份。'));
  } catch (error) {
    console.error('Create demo identities failed', error);
    notify(t('Unable to create demo identities.', '无法生成示例身份。'), true);
  } finally {
    isGenerating = false;
    createDemoButton.disabled = false;
    createDemoButton.textContent = t('Create demo identities', '生成示例身份');
  }
}

function handleExport() {
  if (!identities.length) {
    notify(t('No identities to export yet.', '暂时没有可导出的身份。'));
    return;
  }
  const payload = JSON.stringify(identities.map(buildStoredIdentity), null, 2);
  navigator.clipboard
    .writeText(payload)
    .then(() => notify(t('Copied JSON to clipboard.', '已复制 JSON 到剪贴板。')))
    .catch(() =>
      notify(t('Unable to copy JSON. Please allow clipboard permissions.', '无法复制 JSON，请允许剪贴板权限。'), true)
    );
}

function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = async (loadEvent) => {
    try {
      const parsed = JSON.parse(loadEvent.target?.result ?? '[]');
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid payload');
      }
      const sanitized = parsed
        .map(normalizeIdentity)
        .filter(Boolean);
      await saveIdentities(sanitized);
      notify(t(`Imported ${sanitized.length} identities.`, `已导入 ${sanitized.length} 个身份。`));
    } catch (error) {
      console.error('Import failed', error);
      notify(t('Import failed. Please select a valid JSON export.', '导入失败，请选择有效的 JSON 备份。'), true);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function handleClearAll() {
  if (typeof confirmClearDialog.showModal !== 'function') {
    if (window.confirm(t('Delete all identities?', '确定删除所有身份？'))) {
      saveIdentities([]);
      resetForm();
    }
    return;
  }
  confirmClearDialog.showModal();
  confirmClearDialog.addEventListener(
    'close',
    () => {
      if (confirmClearDialog.returnValue === 'confirm') {
        saveIdentities([]);
        resetForm();
      }
    },
    { once: true }
  );
}

form.addEventListener('submit', handleSubmit);
cancelEditButton.addEventListener('click', resetForm);
createDemoButton.addEventListener('click', createDemoIdentities);
exportButton.addEventListener('click', handleExport);
importInput.addEventListener('change', handleImport);
clearStorageButton.addEventListener('click', handleClearAll);
generateDidButton.addEventListener('click', generateDid);
togglePrivateButton.addEventListener('click', () => {
  const isVisible = privateKeyTextarea.dataset.hidden === 'false';
  setPrivateVisibility(!isVisible);
});
copyPrivateButton.addEventListener('click', () => {
  if (!privateKeyTextarea.value) {
    notify(t('Generate a DID first.', '请先生成 DID。'), true);
    return;
  }
  navigator.clipboard
    .writeText(privateKeyTextarea.value)
    .then(() => notify(t('Copied private key to clipboard.', '已复制私钥。')))
    .catch(() => notify(t('Unable to copy private key.', '无法复制私钥。'), true));
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes[IDENTITY_STORAGE_KEY]) {
    const next = changes[IDENTITY_STORAGE_KEY].newValue || [];
    identities = Array.isArray(next)
      ? next.map(normalizeIdentity).filter(Boolean)
      : [];
    renderCollection();
  }
});

loadIdentities();
