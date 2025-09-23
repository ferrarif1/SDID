const IDENTITY_STORAGE_KEY = 'identities';

const identityList = document.getElementById('identity-list');
const searchInput = document.getElementById('search');
const statusMessage = document.getElementById('status-message');
const emptyState = document.getElementById('empty-state');
const createFirstButton = document.getElementById('create-first');
const manageButton = document.getElementById('open-options');

let identities = [];
let filteredIdentities = [];

async function loadIdentities() {
  const stored = await chrome.storage.sync.get({ [IDENTITY_STORAGE_KEY]: [] });
  identities = Array.isArray(stored[IDENTITY_STORAGE_KEY]) ? stored[IDENTITY_STORAGE_KEY] : [];
  applyFilter(searchInput.value.trim());
}

function applyFilter(query) {
  const normalized = query.toLowerCase();
  filteredIdentities = identities.filter((identity) => {
    if (!normalized) {
      return true;
    }
    return [identity.label, identity.username, identity.domain]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalized));
  });
  renderIdentities();
}

function renderIdentities() {
  identityList.innerHTML = '';
  if (filteredIdentities.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  filteredIdentities
    .sort((a, b) => a.label.localeCompare(b.label))
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
  title.textContent = identity.label;
  container.appendChild(title);

  if (identity.username) {
    const username = document.createElement('p');
    username.textContent = `Username: ${identity.username}`;
    container.appendChild(username);
  }

  if (identity.domain) {
    const domain = document.createElement('p');
    domain.textContent = identity.domain;
    container.appendChild(domain);
  }

  if (identity.notes) {
    const notes = document.createElement('p');
    notes.textContent = identity.notes;
    container.appendChild(notes);
  }

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const fillButton = document.createElement('button');
  fillButton.className = 'primary';
  fillButton.textContent = 'Fill';
  fillButton.addEventListener('click', () => fillIdentity(identity));

  const copyButton = document.createElement('button');
  copyButton.className = 'secondary';
  copyButton.textContent = 'Copy';
  copyButton.addEventListener('click', () => copyIdentity(identity));

  actions.appendChild(fillButton);
  actions.appendChild(copyButton);
  container.appendChild(actions);

  return container;
}

async function fillIdentity(identity) {
  setStatus('Filling identity…');
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
      throw new Error('No active tab available.');
    }

    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: 'fill-identity',
      identity
    });

    if (!response?.success) {
      throw new Error(response?.messages?.join(' ') || 'Unable to fill identity on this page.');
    }

    await chrome.runtime.sendMessage({ type: 'record-last-used', identityId: identity.id });
    setStatus(`Filled ${identity.label}`);
  } catch (error) {
    console.error('Fill identity failed', error);
    setStatus(error.message, true);
  }
}

async function copyIdentity(identity) {
  try {
    const items = [];
    if (identity.username) {
      items.push(`Username: ${identity.username}`);
    }
    if (identity.password) {
      items.push(`Password: ${identity.password}`);
    }
    if (identity.notes) {
      items.push(`Notes: ${identity.notes}`);
    }
    if (items.length === 0) {
      setStatus('Nothing to copy for this identity.', true);
      return;
    }
    await navigator.clipboard.writeText(items.join('\n'));
    setStatus('Copied to clipboard');
  } catch (error) {
    console.error('Copy failed', error);
    setStatus('Clipboard copy failed. Please check your browser permissions.', true);
  }
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? '#fca5a5' : 'rgba(226, 232, 240, 0.9)';
  if (!message) {
    statusMessage.textContent = '';
  }
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
    identities = changes[IDENTITY_STORAGE_KEY].newValue || [];
    applyFilter(searchInput.value.trim());
  }
});

loadIdentities();
