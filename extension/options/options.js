const IDENTITY_STORAGE_KEY = 'identities';

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
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const domainInput = document.getElementById('domain');
const tagsInput = document.getElementById('tags');
const notesInput = document.getElementById('notes');

let identities = [];
let editingId = null;

async function loadIdentities() {
  const stored = await chrome.storage.sync.get({ [IDENTITY_STORAGE_KEY]: [] });
  identities = Array.isArray(stored[IDENTITY_STORAGE_KEY]) ? stored[IDENTITY_STORAGE_KEY] : [];
  renderCollection();
}

async function saveIdentities(nextIdentities) {
  identities = nextIdentities;
  await chrome.storage.sync.set({ [IDENTITY_STORAGE_KEY]: identities });
  renderCollection();
}

function handleSubmit(event) {
  event.preventDefault();

  const identity = {
    id: editingId ?? crypto.randomUUID(),
    label: labelInput.value.trim(),
    username: usernameInput.value.trim(),
    password: passwordInput.value.trim(),
    domain: domainInput.value.trim(),
    tags: parseTags(tagsInput.value),
    notes: notesInput.value.trim(),
    updatedAt: new Date().toISOString()
  };

  if (!identity.label) {
    labelInput.focus();
    return;
  }

  if (editingId) {
    const next = identities.map((item) => (item.id === editingId ? { ...item, ...identity } : item));
    saveIdentities(next);
  } else {
    saveIdentities([...identities, identity]);
  }

  resetForm();
}

function renderCollection() {
  collection.innerHTML = '';
  if (identities.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'identity-item';
    empty.innerHTML = '<p>No identities saved yet. Use the form above to add your first identity.</p>';
    collection.appendChild(empty);
    return;
  }

  identities
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))
    .forEach((identity) => {
      const item = document.createElement('li');
      item.className = 'identity-item';
      item.dataset.id = identity.id;

      const header = document.createElement('header');
      const title = document.createElement('div');
      const heading = document.createElement('h3');
      heading.textContent = identity.label;
      title.appendChild(heading);
      if (identity.domain) {
        const domain = document.createElement('p');
        domain.textContent = identity.domain;
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

      if (identity.username) {
        const username = document.createElement('p');
        username.textContent = `Username: ${identity.username}`;
        item.appendChild(username);
      }

      if (identity.password) {
        const password = document.createElement('p');
        password.textContent = `Password: ${'•'.repeat(Math.min(identity.password.length, 12))}`;
        item.appendChild(password);
      }

      if (identity.notes) {
        const notes = document.createElement('p');
        notes.textContent = identity.notes;
        item.appendChild(notes);
      }

      const actions = document.createElement('div');
      actions.className = 'identity-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', () => startEdit(identity.id));
      actions.appendChild(editButton);

      const duplicateButton = document.createElement('button');
      duplicateButton.type = 'button';
      duplicateButton.textContent = 'Duplicate';
      duplicateButton.addEventListener('click', () => duplicateIdentity(identity.id));
      actions.appendChild(duplicateButton);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.classList.add('danger');
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', () => deleteIdentity(identity.id));
      actions.appendChild(deleteButton);

      item.appendChild(actions);
      collection.appendChild(item);
    });
}

function parseTags(value) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function startEdit(identityId) {
  const identity = identities.find((item) => item.id === identityId);
  if (!identity) {
    return;
  }
  editingId = identity.id;
  formTitle.textContent = 'Edit identity';
  cancelEditButton.hidden = false;

  labelInput.value = identity.label;
  usernameInput.value = identity.username ?? '';
  passwordInput.value = identity.password ?? '';
  domainInput.value = identity.domain ?? '';
  tagsInput.value = identity.tags?.join(', ') ?? '';
  notesInput.value = identity.notes ?? '';

  labelInput.focus();
}

function duplicateIdentity(identityId) {
  const original = identities.find((item) => item.id === identityId);
  if (!original) {
    return;
  }
  const copy = {
    ...original,
    id: crypto.randomUUID(),
    label: `${original.label} (copy)`,
    updatedAt: new Date().toISOString()
  };
  saveIdentities([...identities, copy]);
}

function deleteIdentity(identityId) {
  const next = identities.filter((item) => item.id !== identityId);
  saveIdentities(next);
  if (editingId === identityId) {
    resetForm();
  }
}

function resetForm() {
  editingId = null;
  form.reset();
  formTitle.textContent = 'Create identity';
  cancelEditButton.hidden = true;
}

function createDemoIdentities() {
  if (identities.length) {
    return;
  }
  const demoIdentities = [
    {
      id: crypto.randomUUID(),
      label: 'Customer Portal',
      username: 'customer.success@example.com',
      password: 'Passw0rd!',
      domain: 'https://portal.example.com',
      tags: ['customer', 'support'],
      notes: 'Use this account for tier-1 customer escalations.',
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      label: 'Okta Administrator',
      username: 'identity-admin@example.com',
      password: 'Fido2-Key',
      domain: 'https://example.okta.com',
      tags: ['admin', 'sso'],
      notes: 'Requires hardware key for MFA approvals.',
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      label: 'Sandbox Salesforce',
      username: 'salesforce.sandbox@example.com',
      password: 'sfSandbox!2024',
      domain: 'https://sandbox.salesforce.com',
      tags: ['sales', 'sandbox'],
      notes: 'Resets every Sunday at 02:00 UTC.',
      updatedAt: new Date().toISOString()
    }
  ];
  saveIdentities(demoIdentities);
}

function handleExport() {
  if (!identities.length) {
    notify('No identities to export yet.');
    return;
  }
  const payload = JSON.stringify(identities, null, 2);
  navigator.clipboard
    .writeText(payload)
    .then(() => notify('Copied JSON to clipboard.'))
    .catch(() => notify('Unable to copy JSON. Please allow clipboard permissions.', true));
}

function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const parsed = JSON.parse(loadEvent.target?.result ?? '[]');
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid file format');
      }
      const sanitized = parsed
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          id: item.id ?? crypto.randomUUID(),
          label: String(item.label || 'Untitled identity'),
          username: item.username ? String(item.username) : '',
          password: item.password ? String(item.password) : '',
          domain: item.domain ? String(item.domain) : '',
          tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : parseTags(item.tags ?? ''),
          notes: item.notes ? String(item.notes) : '',
          updatedAt: new Date().toISOString()
        }));
      saveIdentities(sanitized);
      notify(`Imported ${sanitized.length} identities.`);
    } catch (error) {
      console.error('Import failed', error);
      notify('Import failed. Please select a valid JSON export.', true);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function handleClearAll() {
  if (typeof confirmClearDialog.showModal !== 'function') {
    if (window.confirm('Delete all identities?')) {
      saveIdentities([]);
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

cancelEditButton.addEventListener('click', () => {
  resetForm();
});

form.addEventListener('submit', handleSubmit);
createDemoButton.addEventListener('click', createDemoIdentities);
exportButton.addEventListener('click', handleExport);
importInput.addEventListener('change', handleImport);
clearStorageButton.addEventListener('click', handleClearAll);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes[IDENTITY_STORAGE_KEY]) {
    identities = changes[IDENTITY_STORAGE_KEY].newValue || [];
    renderCollection();
  }
});

loadIdentities();
