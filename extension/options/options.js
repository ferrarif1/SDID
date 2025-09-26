import {
  ready as i18nReady,
  translate,
  setLanguage,
  getLanguage,
  onLanguageChange,
  applyTranslations
} from '../shared/i18n.js';
import { registerTextFit, recalibrateTextFits } from '../shared/textFit.js';

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
const subtitle = document.querySelector('.subtitle');
const importLabel = document.querySelector('.import-button span');

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
const languageToggle = document.getElementById('language-toggle');
const languageButtons = languageToggle ? Array.from(languageToggle.querySelectorAll('button')) : [];

const staticFitTargets = [
  { element: subtitle, options: { maxLines: 3 } },
  { element: formTitle, options: { maxLines: 2 } },
  { element: createDemoButton, options: { maxLines: 1, preserveTitle: false } },
  { element: exportButton, options: { maxLines: 1, preserveTitle: false } },
  { element: clearStorageButton, options: { maxLines: 1, preserveTitle: false } },
  { element: cancelEditButton, options: { maxLines: 1, preserveTitle: false } },
  { element: generateDidButton, options: { maxLines: 1, preserveTitle: false } },
  { element: togglePrivateButton, options: { maxLines: 1, preserveTitle: false } },
  { element: copyPrivateButton, options: { maxLines: 1, preserveTitle: false } },
  { element: importLabel, options: { maxLines: 1 } }
];

staticFitTargets.forEach(({ element, options }) => {
  if (element) {
    registerTextFit(element, options);
  }
});

languageButtons.forEach((button) => registerTextFit(button, { maxLines: 1, preserveTitle: false }));

let currentLanguage = getLanguage();

let identities = [];
let editingId = null;
let currentKeyPair = null;
let isGeneratingDid = false;
let isSeedingDemo = false;

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

function getVerificationMethodId(identity) {
  if (!identity?.did) {
    return '';
  }
  return `${identity.did}#keys-1`;
}

function formatKeyType(publicKeyJwk) {
  if (!publicKeyJwk || typeof publicKeyJwk !== 'object') {
    return '';
  }
  const parts = [];
  if (publicKeyJwk.crv) {
    parts.push(publicKeyJwk.crv);
  }
  if (publicKeyJwk.kty) {
    parts.push(publicKeyJwk.kty);
  }
  const base = parts.join(' / ');
  if (publicKeyJwk.alg) {
    return base ? `${base} (${publicKeyJwk.alg})` : publicKeyJwk.alg;
  }
  return base;
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
    return translate('options.roles.none');
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
    empty.className = 'identity-item empty';
    const message = document.createElement('p');
    message.textContent = translate('options.collection.empty');
    empty.appendChild(message);
    collection.appendChild(empty);
    registerTextFit(message, { maxLines: 3 });
    recalibrateTextFits();
    return;
  }

  identities.forEach((identity) => {
    const item = document.createElement('li');
    item.className = 'identity-item';
    item.dataset.id = identity.id;

    const header = document.createElement('header');
    header.className = 'identity-header';
    const title = document.createElement('div');
    title.className = 'identity-title';
    const heading = document.createElement('h3');
    heading.textContent = identity.label || translate('common.untitledIdentity');
    title.appendChild(heading);
    registerTextFit(heading, { maxLines: 2 });

    if (identity.domain) {
      const domain = document.createElement('p');
      domain.textContent = `${translate('options.collection.meta.domain')} ${identity.domain}`;
      title.appendChild(domain);
      registerTextFit(domain, { maxLines: 2 });
    }
    header.appendChild(title);

    if (identity.tags?.length) {
      const tagsContainer = document.createElement('div');
      identity.tags.forEach((tag) => {
        const tagElement = document.createElement('span');
        tagElement.className = 'tag-badge';
        tagElement.textContent = tag;
        tagsContainer.appendChild(tagElement);
        registerTextFit(tagElement, { maxLines: 1 });
      });
      header.appendChild(tagsContainer);
    }

    item.appendChild(header);

    const meta = document.createElement('div');
    meta.className = 'meta-line';

    const roleLine = document.createElement('span');
    roleLine.textContent = `${translate('options.collection.meta.roles')} ${formatRoles(identity.roles)}`;
    meta.appendChild(roleLine);
    registerTextFit(roleLine, { maxLines: 1 });

    if (identity.did) {
      const didLine = document.createElement('span');
      didLine.textContent = `${translate('options.collection.meta.did')} ${identity.did}`;
      meta.appendChild(didLine);
      registerTextFit(didLine, { maxLines: 1 });
    }

    if (identity.did && identity.publicKeyJwk) {
      const verificationLine = document.createElement('span');
      verificationLine.textContent = `${translate('options.collection.meta.verificationMethod')} ${getVerificationMethodId(
        identity
      )}`;
      meta.appendChild(verificationLine);
      registerTextFit(verificationLine, { maxLines: 1 });
    }

    if (identity.publicKeyJwk) {
      const keyType = formatKeyType(identity.publicKeyJwk);
      if (keyType) {
        const keyLine = document.createElement('span');
        keyLine.textContent = `${translate('options.collection.meta.keyType')} ${keyType}`;
        meta.appendChild(keyLine);
        registerTextFit(keyLine, { maxLines: 1 });
      }
    }

    if (identity.username) {
      const usernameLine = document.createElement('span');
      usernameLine.textContent = `${translate('options.collection.meta.username')} ${identity.username}`;
      meta.appendChild(usernameLine);
      registerTextFit(usernameLine, { maxLines: 1 });
    }

    item.appendChild(meta);

    if (identity.notes) {
      const notes = document.createElement('p');
      notes.textContent = identity.notes;
      item.appendChild(notes);
      registerTextFit(notes, { maxLines: 4 });
    }

    if (identity.authorizedOrigins?.length) {
      const authorizedContainer = document.createElement('div');
      authorizedContainer.className = 'authorized-origins';
      const heading = document.createElement('h4');
      heading.textContent = translate('options.collection.authorizedSites');
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
          time.textContent = `${translate('options.collection.lastUsed')} ${formatDate(entry.lastUsedAt)}`;
          info.appendChild(time);
          row.appendChild(info);
          registerTextFit(info, { maxLines: 1 });
          registerTextFit(time, { maxLines: 1 });

          const revokeButton = document.createElement('button');
          revokeButton.type = 'button';
          revokeButton.textContent = translate('options.collection.revoke');
          revokeButton.addEventListener('click', () => revokeAuthorization(identity.id, entry.origin));
          row.appendChild(revokeButton);
          registerTextFit(revokeButton, { maxLines: 1, preserveTitle: false });

          list.appendChild(row);
        });
      authorizedContainer.appendChild(list);
      item.appendChild(authorizedContainer);
    }

    const actions = document.createElement('div');
    actions.className = 'identity-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = translate('options.collection.edit');
    editButton.addEventListener('click', () => startEdit(identity.id));
    actions.appendChild(editButton);
    registerTextFit(editButton, { maxLines: 1, preserveTitle: false });

    const duplicateButton = document.createElement('button');
    duplicateButton.type = 'button';
    duplicateButton.textContent = translate('options.collection.duplicate');
    duplicateButton.addEventListener('click', () => duplicateIdentity(identity.id));
    actions.appendChild(duplicateButton);
    registerTextFit(duplicateButton, { maxLines: 1, preserveTitle: false });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.classList.add('danger');
    deleteButton.textContent = translate('options.collection.delete');
    deleteButton.addEventListener('click', () => deleteIdentity(identity.id));
    actions.appendChild(deleteButton);
    registerTextFit(deleteButton, { maxLines: 1, preserveTitle: false });

    item.appendChild(actions);
    collection.appendChild(item);
  });

  recalibrateTextFits();
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
    togglePrivateButton.textContent = translate('common.show');
    recalibrateTextFits();
    return;
  }
  if (visible) {
    privateKeyTextarea.dataset.hidden = 'false';
    togglePrivateButton.textContent = translate('common.hide');
    recalibrateTextFits();
  } else {
    privateKeyTextarea.dataset.hidden = 'true';
    togglePrivateButton.textContent = translate('common.show');
    recalibrateTextFits();
  }
}

async function generateDid() {
  if (isGeneratingDid) {
    return;
  }
  try {
    isGeneratingDid = true;
    generateDidButton.disabled = true;
    generateDidButton.textContent = translate('common.generating');
    recalibrateTextFits();
    const keyPair = await crypto.subtle.generateKey(KEY_ALGORITHM, true, ['sign', 'verify']);
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const did = `did:sdid:${publicKeyJwk.x}.${publicKeyJwk.y}`;
    currentKeyPair = { did, publicKeyJwk, privateKeyJwk };
    updateKeyDisplay(currentKeyPair);
    notify(translate('options.notifications.generated'));
  } catch (error) {
    console.error('DID generation failed', error);
    notify(translate('options.notifications.generateFailed'), true);
  } finally {
    isGeneratingDid = false;
    generateDidButton.disabled = false;
    generateDidButton.textContent = translate('common.generateDid');
    recalibrateTextFits();
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
  formTitle.textContent = translate('options.form.editTitle');
  cancelEditButton.hidden = false;
  recalibrateTextFits();

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
    const copySuffix = translate('options.collection.copySuffix');
    const baseLabel = original.label || translate('common.untitledIdentity');
    const copy = {
      ...original,
      id: crypto.randomUUID(),
      label: `${baseLabel}${copySuffix}`,
      did,
      publicKeyJwk,
      privateKeyJwk,
      authorizedOrigins: [],
      createdAt: now,
      updatedAt: now
    };
    const next = [...identities, copy];
    await saveIdentities(next);
    notify(translate('options.notifications.duplicateSuccess'));
  } catch (error) {
    console.error('Duplicate identity failed', error);
    notify(translate('options.notifications.duplicateError'), true);
  }
}

async function deleteIdentity(identityId) {
  const next = identities.filter((item) => item.id !== identityId);
  await saveIdentities(next);
  if (editingId === identityId) {
    resetForm();
  }
  notify(translate('options.notifications.deleted'));
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
  notify(translate('options.notifications.revoked'));
}

function resetForm() {
  editingId = null;
  currentKeyPair = null;
  form.reset();
  updateKeyDisplay(null);
  formTitle.textContent = translate('options.form.createTitle');
  cancelEditButton.hidden = true;
  recalibrateTextFits();
}

function notify(message, isError = false) {
  let banner = document.querySelector('.notification-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'notification-banner';
    document.body.appendChild(banner);
    registerTextFit(banner, { maxLines: 2 });
  }
  banner.textContent = message;
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.classList.toggle('is-error', Boolean(isError));

  banner.classList.add('visible');
  setTimeout(() => banner.classList.remove('visible'), 3200);
  recalibrateTextFits();
}

function validateKeyPair() {
  if (currentKeyPair?.did && currentKeyPair?.publicKeyJwk && currentKeyPair?.privateKeyJwk) {
    return true;
  }
  notify(translate('options.notifications.requireDidBeforeSave'), true);
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
    notify(translate('options.notifications.displayNameRequired'), true);
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
  notify(translate('options.notifications.saved'));
  resetForm();
}

async function createDemoIdentities() {
  if (identities.length) {
    notify(translate('options.notifications.clearBeforeDemo'), true);
    return;
  }
  if (isSeedingDemo) {
    return;
  }
  isSeedingDemo = true;
  createDemoButton.disabled = true;
  createDemoButton.textContent = translate('common.generating');
  recalibrateTextFits();
  try {
    const templates = [
      {
        label: translate('options.demo.labels.operationsAdmin'),
        roles: ['Admin', 'Approver'],
        domain: 'https://console.example.com',
        notes: translate('options.demo.notes.operationsAdmin'),
        tags: ['core', 'operations']
      },
      {
        label: translate('options.demo.labels.financeSigner'),
        roles: ['Finance', 'Signer'],
        domain: 'https://billing.example.com',
        notes: translate('options.demo.notes.financeSigner'),
        tags: ['finance']
      },
      {
        label: translate('options.demo.labels.developerSandbox'),
        roles: ['Developer'],
        domain: 'https://sandbox.example.dev',
        notes: translate('options.demo.notes.developerSandbox'),
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
    notify(translate('options.notifications.demoCreated'));
  } catch (error) {
    console.error('Create demo identities failed', error);
    notify(translate('options.notifications.demoFailed'), true);
  } finally {
    isSeedingDemo = false;
    createDemoButton.disabled = false;
    createDemoButton.textContent = translate('options.actions.createDemo');
    recalibrateTextFits();
  }
}

function handleExport() {
  if (!identities.length) {
    notify(translate('options.notifications.noExport'));
    return;
  }
  const payload = JSON.stringify(identities.map(buildStoredIdentity), null, 2);
  navigator.clipboard
    .writeText(payload)
    .then(() => notify(translate('options.notifications.copyJson')))
    .catch(() => notify(translate('options.notifications.copyJsonError'), true));
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
      notify(translate('options.notifications.imported', { count: sanitized.length }));
    } catch (error) {
      console.error('Import failed', error);
      notify(translate('options.notifications.importFailed'), true);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function handleClearAll() {
  if (typeof confirmClearDialog.showModal !== 'function') {
    if (window.confirm(translate('options.confirmClear.title'))) {
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
    notify(translate('options.notifications.needDidFirst'), true);
    return;
  }
  navigator.clipboard
    .writeText(privateKeyTextarea.value)
    .then(() => notify(translate('options.notifications.copyPrivateKey')))
    .catch(() => notify(translate('options.notifications.copyPrivateKeyError'), true));
});

function updateLanguageToggleUI(language) {
  languageButtons.forEach((button) => {
    const value = button.dataset.language;
    const isActive = value === language;
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.classList.toggle('active', isActive);
  });
  recalibrateTextFits();
}

function refreshDynamicText() {
  formTitle.textContent = editingId ? translate('options.form.editTitle') : translate('options.form.createTitle');
  generateDidButton.textContent = isGeneratingDid
    ? translate('common.generating')
    : translate('common.generateDid');
  createDemoButton.textContent = isSeedingDemo
    ? translate('common.generating')
    : translate('options.actions.createDemo');
  const isPrivateVisible = privateKeyTextarea.dataset.hidden === 'false';
  setPrivateVisibility(isPrivateVisible);
  recalibrateTextFits();
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
  refreshDynamicText();
  renderCollection();
  recalibrateTextFits();
});

async function init() {
  await i18nReady;
  currentLanguage = getLanguage();
  applyTranslations(document);
  updateLanguageToggleUI(currentLanguage);
  refreshDynamicText();
  await loadIdentities();
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes[IDENTITY_STORAGE_KEY]) {
    const next = changes[IDENTITY_STORAGE_KEY].newValue || [];
    identities = Array.isArray(next)
      ? next.map(normalizeIdentity).filter(Boolean)
      : [];
    renderCollection();
  }
});

init().catch((error) => {
  console.error('Failed to initialize options page', error);
});
