const IDENTITY_STORAGE_KEY = 'identities';
const LAST_USED_ID_KEY = 'lastUsedIdentityId';
const LOGIN_REQUEST_EVENT = 'SDID_REQUEST_LOGIN';
const LOGIN_RESULT_EVENT = 'SDID_LOGIN_RESULT';
const LOGIN_OVERLAY_ID = 'sdid-login-overlay';

const usernameKeywords = ['user', 'email', 'login', 'account', 'identifier', 'phone'];
const passwordKeywords = ['pass', 'password', 'secret', 'pin', 'code'];

const fallbackTranslations = {
  'content.errors.missingIdentity': 'Missing identity payload.',
  'content.errors.usernameFillFailed': 'Unable to populate username field.',
  'content.errors.usernameMissing': 'No username field detected on this page.',
  'content.errors.passwordFillFailed': 'Unable to populate password field.',
  'content.errors.passwordMissing': 'No password field detected on this page.',
  'content.errors.noCredentials': 'Identity does not contain username or password values to fill.',
  'content.overlay.title': 'SDID login request',
  'content.overlay.origin': 'Origin:',
  'content.overlay.chooseIdentity': 'Choose identity',
  'content.overlay.remember': 'Remember this site for one-click approvals',
  'content.overlay.rememberAuthorized': 'This site is already authorized. Uncheck to require approval next time.',
  'content.overlay.rememberHint': 'Keep this checked to approve future logins instantly.',
  'content.overlay.summaryIdentity': 'Identity:',
  'content.overlay.summaryDid': 'DID:',
  'content.overlay.summaryRoles': 'Roles:',
  'content.overlay.summaryDomain': 'Trusted domain:',
  'content.overlay.summaryUsername': 'Username:',
  'content.overlay.summaryNotes': 'Notes:',
  'content.errors.alreadyPending': 'Another login request is already pending. Please complete it first.',
  'content.errors.noIdentities': 'No eligible DID identities are saved in SDID.',
  'content.errors.identityNotFound': 'The selected identity could not be located.',
  'content.errors.loginCancelled': 'Login request cancelled by user.',
  'content.errors.loginFailed': 'Login request failed.',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.untitledIdentity': 'Untitled identity'
};

let i18nApi = null;
let currentLanguage = 'en';
let supportedLanguages = ['en', 'zh'];

function formatTemplate(template, replacements = {}) {
  if (!replacements || typeof replacements !== 'object') {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, token) => {
    return token in replacements ? String(replacements[token]) : match;
  });
}

let translateText = (key, replacements) => {
  const template = fallbackTranslations[key] || key;
  return formatTemplate(template, replacements);
};

(async () => {
  try {
    const i18nModule = await import(chrome.runtime.getURL('shared/i18n.js'));
    await i18nModule.ready;
    i18nApi = i18nModule;
    translateText = (key, replacements) => i18nModule.translate(key, replacements);
    if (Array.isArray(i18nModule.SUPPORTED_LANGUAGES) && i18nModule.SUPPORTED_LANGUAGES.length) {
      supportedLanguages = i18nModule.SUPPORTED_LANGUAGES;
    }
    if (typeof i18nModule.getLanguage === 'function') {
      currentLanguage = i18nModule.getLanguage();
    }
    i18nModule.onLanguageChange((lang) => {
      currentLanguage = lang;
    });
  } catch (error) {
    console.warn('SDID i18n module unavailable in content script', error);
  }
})();

let loginOverlayVisible = false;

function normalizeString(value) {
  return (value || '').toLowerCase();
}

function findInputByKeywords(keywords, additionalSelector) {
  const selector = additionalSelector || 'input';
  const elements = document.querySelectorAll(selector);
  for (const element of elements) {
    if (element.disabled || element.type === 'hidden') {
      continue;
    }
    const haystack = [element.name, element.id, element.placeholder, element.getAttribute('aria-label')]
      .filter(Boolean)
      .map(normalizeString)
      .join(' ');
    if (!haystack) {
      continue;
    }
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return element;
    }
  }
  return null;
}

function fillElementValue(element, value) {
  if (!element || typeof value !== 'string') {
    return false;
  }

  element.focus();
  element.value = value;

  const inputEvent = new Event('input', { bubbles: true });
  const changeEvent = new Event('change', { bubbles: true });

  element.dispatchEvent(inputEvent);
  element.dispatchEvent(changeEvent);

  element.classList.add('sdid-identity-filled');
  setTimeout(() => element.classList.remove('sdid-identity-filled'), 1500);

  return true;
}

function fillIdentity(identity) {
  if (!identity) {
    return { success: false, reason: translateText('content.errors.missingIdentity') };
  }

  const result = {
    success: true,
    filledUsername: false,
    filledPassword: false,
    messages: []
  };

  if (identity.username) {
    const usernameField =
      findInputByKeywords(usernameKeywords, 'input:not([type="password"])') ||
      document.querySelector('input[type="email"], input[type="text"], input[type="tel"]');
    if (usernameField) {
      result.filledUsername = fillElementValue(usernameField, identity.username);
      if (!result.filledUsername) {
        result.messages.push(translateText('content.errors.usernameFillFailed'));
      }
    } else {
      result.messages.push(translateText('content.errors.usernameMissing'));
    }
  }

  if (identity.password) {
    const passwordField =
      findInputByKeywords(passwordKeywords, 'input[type="password"], input[type="text"], input[type="tel"], input') ||
      document.querySelector('input[type="password"]');
    if (passwordField) {
      result.filledPassword = fillElementValue(passwordField, identity.password);
      if (!result.filledPassword) {
        result.messages.push(translateText('content.errors.passwordFillFailed'));
      }
    } else {
      result.messages.push(translateText('content.errors.passwordMissing'));
    }
  }

  if (!identity.username && !identity.password) {
    result.success = false;
    result.messages.push(
      translateText('content.errors.noCredentials')
    );
  }

  if (!result.filledUsername && !result.filledPassword) {
    result.success = false;
  }

  return result;
}

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
  const authorizedOrigins = Array.isArray(raw.authorizedOrigins)
    ? raw.authorizedOrigins
        .filter((entry) => entry && entry.origin)
        .map((entry) => ({
          origin: String(entry.origin),
          createdAt: entry.createdAt || null,
          lastUsedAt: entry.lastUsedAt || entry.createdAt || null
        }))
    : [];
  const publicKeyJwk = typeof raw.publicKeyJwk === 'string' ? safeParseJson(raw.publicKeyJwk) : raw.publicKeyJwk;
  const privateKeyJwk = typeof raw.privateKeyJwk === 'string' ? safeParseJson(raw.privateKeyJwk) : raw.privateKeyJwk;

  return {
    id: raw.id || crypto.randomUUID(),
    label: raw.label ? String(raw.label) : '',
    username: raw.username ? String(raw.username) : '',
    password: raw.password ? String(raw.password) : '',
    domain: raw.domain ? String(raw.domain) : '',
    notes: raw.notes ? String(raw.notes) : '',
    did: raw.did ? String(raw.did) : '',
    roles,
    tags,
    publicKeyJwk: publicKeyJwk && typeof publicKeyJwk === 'object' ? publicKeyJwk : null,
    privateKeyJwk: privateKeyJwk && typeof privateKeyJwk === 'object' ? privateKeyJwk : null,
    authorizedOrigins,
    updatedAt: raw.updatedAt || null,
    createdAt: raw.createdAt || null
  };
}

function isIdentityEligible(identity) {
  return Boolean(identity?.did && identity?.publicKeyJwk && identity?.privateKeyJwk);
}

function isOriginAuthorized(identity, origin) {
  if (!identity || !origin) {
    return false;
  }
  return identity.authorizedOrigins?.some((entry) => entry.origin === origin);
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function generateChallenge() {
  return `sdid:${Date.now().toString(16)}:${crypto.getRandomValues(new Uint32Array(1))[0].toString(16)}`;
}

function sanitizeIdentity(identity, origin) {
  if (!identity) {
    return null;
  }
  return {
    id: identity.id,
    label: identity.label,
    roles: Array.isArray(identity.roles) ? [...identity.roles] : [],
    did: identity.did,
    publicKeyJwk: identity.publicKeyJwk ? JSON.parse(JSON.stringify(identity.publicKeyJwk)) : null,
    username: identity.username,
    domain: identity.domain,
    tags: Array.isArray(identity.tags) ? [...identity.tags] : [],
    notes: identity.notes,
    updatedAt: identity.updatedAt,
    authorized: origin ? isOriginAuthorized(identity, origin) : false
  };
}

async function getStoredIdentities() {
  const stored = await chrome.storage.sync.get({ [IDENTITY_STORAGE_KEY]: [] });
  const items = Array.isArray(stored[IDENTITY_STORAGE_KEY]) ? stored[IDENTITY_STORAGE_KEY] : [];
  return items.map(normalizeIdentity).filter(Boolean);
}

async function selectPreferredIdentity(preferredId, origin) {
  const identities = (await getStoredIdentities()).filter(isIdentityEligible);
  if (!identities.length) {
    return { identities, selected: null, authorizedMatch: null };
  }

  let selected = null;
  if (preferredId) {
    selected = identities.find((identity) => identity.id === preferredId) || null;
  }
  if (!selected) {
    const local = await chrome.storage.local.get({ [LAST_USED_ID_KEY]: null });
    const lastUsedId = local[LAST_USED_ID_KEY];
    selected = lastUsedId ? identities.find((identity) => identity.id === lastUsedId) : null;
  }
  if (!selected) {
    selected = identities[0];
  }

  const authorizedMatch = origin
    ? identities.find((identity) => isOriginAuthorized(identity, origin))
    : null;

  return { identities, selected, authorizedMatch };
}

async function setIdentityAuthorization(identityId, origin, shouldAuthorize) {
  if (!origin) {
    return null;
  }
  const stored = await chrome.storage.sync.get({ [IDENTITY_STORAGE_KEY]: [] });
  const items = Array.isArray(stored[IDENTITY_STORAGE_KEY]) ? stored[IDENTITY_STORAGE_KEY] : [];
  let updatedOrigins = null;
  const updated = items.map((item) => {
    if (item.id !== identityId) {
      return item;
    }
    const now = new Date().toISOString();
    const current = Array.isArray(item.authorizedOrigins)
      ? item.authorizedOrigins.filter((entry) => entry && entry.origin)
      : [];
    let next;
    if (shouldAuthorize) {
      let found = false;
      next = current.map((entry) => {
        if (entry.origin === origin) {
          found = true;
          return { ...entry, lastUsedAt: now };
        }
        return entry;
      });
      if (!found) {
        next.push({ origin, createdAt: now, lastUsedAt: now });
      }
    } else {
      next = current.filter((entry) => entry.origin !== origin);
    }
    updatedOrigins = next;
    return { ...item, authorizedOrigins: next, updatedAt: now };
  });
  await chrome.storage.sync.set({ [IDENTITY_STORAGE_KEY]: updated });
  return updatedOrigins;
}

async function signChallenge(identity, challenge) {
  if (!identity?.privateKeyJwk) {
    throw new Error('Missing private key');
  }
  const privateKey = await crypto.subtle.importKey('jwk', identity.privateKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign'
  ]);
  const data = new TextEncoder().encode(challenge);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: { name: 'SHA-256' } }, privateKey, data);
  return bufferToBase64(signature);
}

function getLanguageDisplayName(language) {
  if (i18nApi?.translate) {
    if (language === 'en') {
      return i18nApi.translate('common.languageEnglish', {}, 'en');
    }
    if (language === 'zh') {
      return i18nApi.translate('common.languageChinese', {}, 'zh');
    }
  }
  if (language === 'zh') {
    return '中文';
  }
  return language ? language.toUpperCase() : '';
}

function createOverlayLanguageSwitch() {
  if (!i18nApi?.setLanguage) {
    return null;
  }
  const languages = supportedLanguages.filter(Boolean);
  if (languages.length <= 1) {
    return null;
  }

  const container = document.createElement('div');
  container.className = 'sdid-language-switch';
  container.setAttribute('role', 'group');

  const buttons = new Map();

  const setActive = (lang) => {
    buttons.forEach((button, code) => {
      const isActive = code === lang;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  const setLabels = () => {
    container.setAttribute('aria-label', translateText('common.languageLabel'));
    buttons.forEach((button, code) => {
      button.textContent = getLanguageDisplayName(code);
    });
  };

  languages.forEach((lang) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.language = lang;
    button.textContent = getLanguageDisplayName(lang);
    button.addEventListener('click', () => {
      const activeLanguage = typeof i18nApi.getLanguage === 'function' ? i18nApi.getLanguage() : currentLanguage;
      if (lang === activeLanguage) {
        return;
      }
      i18nApi.setLanguage(lang).catch((error) => {
        console.warn('Unable to switch SDID language', error);
      });
    });
    container.appendChild(button);
    buttons.set(lang, button);
  });

  const activeLanguage = typeof i18nApi.getLanguage === 'function' ? i18nApi.getLanguage() : currentLanguage;
  setActive(activeLanguage);
  setLabels();

  return {
    container,
    setActive,
    setLabels
  };
}

function createLoginOverlay(identities, initialId, requestOrigin, requestMessage) {
  return new Promise((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.id = LOGIN_OVERLAY_ID;
    overlay.className = 'sdid-login-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'sdid-login-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const header = document.createElement('div');
    header.className = 'sdid-login-header';

    const title = document.createElement('h2');
    header.appendChild(title);

    const languageSwitchControl = createOverlayLanguageSwitch();
    if (languageSwitchControl) {
      header.appendChild(languageSwitchControl.container);
    }

    dialog.appendChild(header);

    if (requestMessage) {
      const message = document.createElement('p');
      message.className = 'sdid-login-message';
      message.textContent = `${requestMessage}`;
      dialog.appendChild(message);
    }

    let originText = null;
    if (requestOrigin) {
      originText = document.createElement('p');
      originText.className = 'sdid-login-origin';
      dialog.appendChild(originText);
    }

    const selectLabel = document.createElement('label');
    selectLabel.className = 'sdid-login-select';

    const selectTitle = document.createElement('span');
    selectLabel.appendChild(selectTitle);

    const select = document.createElement('select');
    identities.forEach((identity) => {
      const option = document.createElement('option');
      option.value = identity.id;
      option.textContent = identity.label || identity.username || translateText('common.untitledIdentity');
      if (identity.id === initialId) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    if (identities.length <= 1) {
      select.disabled = identities.length === 1;
    }

    selectLabel.appendChild(select);
    dialog.appendChild(selectLabel);

    const summary = document.createElement('ul');
    summary.className = 'sdid-login-summary';
    dialog.appendChild(summary);

    const rememberWrapper = document.createElement('label');
    rememberWrapper.className = 'sdid-login-remember';
    rememberWrapper.hidden = !requestOrigin;

    const rememberCheckbox = document.createElement('input');
    rememberCheckbox.type = 'checkbox';
    rememberCheckbox.checked = true;
    rememberWrapper.appendChild(rememberCheckbox);

    const rememberText = document.createElement('span');
    rememberWrapper.appendChild(rememberText);

    const rememberHint = document.createElement('p');
    rememberHint.className = 'sdid-login-hint';
    rememberHint.textContent = '';
    dialog.appendChild(rememberWrapper);
    dialog.appendChild(rememberHint);

    const actions = document.createElement('div');
    actions.className = 'sdid-login-actions';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'sdid-login-cancel';

    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'sdid-login-confirm';

    actions.appendChild(cancelButton);
    actions.appendChild(confirmButton);
    dialog.appendChild(actions);

    overlay.appendChild(dialog);
    document.documentElement.appendChild(overlay);

    const previousActiveElement = document.activeElement;

    let settled = false;
    let detachLanguageListener = null;
    let rememberDirty = false;
    let lastSummaryIdentityId = null;

    const cleanup = (result, shouldReject = false) => {
      if (settled) {
        return;
      }
      settled = true;
      overlay.remove();
      document.removeEventListener('keydown', handleKeydown, true);
      if (typeof detachLanguageListener === 'function') {
        detachLanguageListener();
      }
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus({ preventScroll: true });
      }
      if (shouldReject) {
        if (result && typeof result === 'object') {
          result.isCancelled = true;
        }
        reject(result);
      } else {
        resolve(result);
      }
    };

    function updateSummary(identityId) {
      const identity = identities.find((item) => item.id === identityId);
      summary.innerHTML = '';
      if (!identity) {
        rememberDirty = false;
        if (requestOrigin) {
          rememberCheckbox.checked = true;
        }
        rememberHint.textContent = '';
        lastSummaryIdentityId = null;
        return;
      }
      const identityChanged = identity.id !== lastSummaryIdentityId;
      if (identityChanged) {
        rememberDirty = false;
      }
      const addLine = (text) => {
        const item = document.createElement('li');
        item.textContent = text;
        summary.appendChild(item);
      };
      addLine(`${translateText('content.overlay.summaryIdentity')} ${identity.label || translateText('common.untitledIdentity')}`);
      if (identity.did) {
        addLine(`${translateText('content.overlay.summaryDid')} ${identity.did}`);
      }
      if (identity.roles?.length) {
        addLine(`${translateText('content.overlay.summaryRoles')} ${identity.roles.join(', ')}`);
      }
      if (identity.domain) {
        addLine(`${translateText('content.overlay.summaryDomain')} ${identity.domain}`);
      }
      if (identity.username) {
        addLine(`${translateText('content.overlay.summaryUsername')} ${identity.username}`);
      }
      if (identity.notes) {
        addLine(`${translateText('content.overlay.summaryNotes')} ${identity.notes}`);
      }

      if (requestOrigin) {
        const authorized = isOriginAuthorized(identity, requestOrigin);
        if (!rememberDirty) {
          rememberCheckbox.checked = true;
        }
        rememberHint.textContent = authorized
          ? translateText('content.overlay.rememberAuthorized')
          : translateText('content.overlay.rememberHint');
      } else {
        rememberHint.textContent = '';
      }
      lastSummaryIdentityId = identity.id;
    }

    function refreshSelectOptions() {
      Array.from(select.options).forEach((option) => {
        const identity = identities.find((item) => item.id === option.value);
        if (!identity) {
          return;
        }
        option.textContent = identity.label || identity.username || translateText('common.untitledIdentity');
      });
    }

    function refreshOverlayText() {
      dialog.setAttribute('aria-label', translateText('content.overlay.title'));
      title.textContent = translateText('content.overlay.title');
      if (languageSwitchControl) {
        languageSwitchControl.setLabels();
        const activeLang = typeof i18nApi?.getLanguage === 'function' ? i18nApi.getLanguage() : currentLanguage;
        languageSwitchControl.setActive(activeLang);
      }
      if (originText) {
        originText.textContent = `${translateText('content.overlay.origin')} ${requestOrigin}`;
      }
      selectTitle.textContent = translateText('content.overlay.chooseIdentity');
      rememberText.textContent = translateText('content.overlay.remember');
      cancelButton.textContent = translateText('common.cancel');
      confirmButton.textContent = translateText('common.confirm');
      refreshSelectOptions();
      updateSummary(select.value || identities[0]?.id);
    }

    const activeLanguage = typeof i18nApi?.getLanguage === 'function' ? i18nApi.getLanguage() : currentLanguage;
    if (languageSwitchControl) {
      languageSwitchControl.setActive(activeLanguage);
    }
    refreshOverlayText();

    const initialFocusTarget = identities.length === 1 ? confirmButton : select;
    initialFocusTarget.focus({ preventScroll: true });

    select.addEventListener('change', (event) => {
      rememberDirty = false;
      updateSummary(event.target.value);
    });

    rememberCheckbox.addEventListener('change', () => {
      rememberDirty = true;
    });

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup({ cancelled: true }, true);
      }
    };

    document.addEventListener('keydown', handleKeydown, true);

    if (i18nApi?.onLanguageChange) {
      detachLanguageListener = i18nApi.onLanguageChange((lang) => {
        if (languageSwitchControl) {
          languageSwitchControl.setActive(lang);
          languageSwitchControl.setLabels();
        }
        refreshOverlayText();
      });
    }

    confirmButton.addEventListener('click', () => {
      cleanup({ identityId: select.value || identities[0]?.id, remember: rememberCheckbox.checked });
    });

    cancelButton.addEventListener('click', () => {
      cleanup({ cancelled: true }, true);
    });

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        cleanup({ cancelled: true }, true);
      }
    });
  });
}
async function finalizeAuthorization({ identity, origin, challengeInput, remember, requestId }) {
  const challenge = typeof challengeInput === 'string' && challengeInput.trim() ? challengeInput : generateChallenge();
  const signature = await signChallenge(identity, challenge);

  if (origin) {
    if (remember === true || remember === false) {
      const updatedOrigins = await setIdentityAuthorization(identity.id, origin, remember);
      if (Array.isArray(updatedOrigins)) {
        identity.authorizedOrigins = updatedOrigins;
      }
    } else if (isOriginAuthorized(identity, origin)) {
      const updatedOrigins = await setIdentityAuthorization(identity.id, origin, true);
      if (Array.isArray(updatedOrigins)) {
        identity.authorizedOrigins = updatedOrigins;
      }
    }
  }

  const fillOutcome = fillIdentity(identity);

  chrome.runtime.sendMessage({ type: 'record-last-used', identityId: identity.id }, () => {
    if (chrome.runtime.lastError) {
      console.debug('Unable to record last used identity', chrome.runtime.lastError);
    }
  });

  const authorizedState = origin ? isOriginAuthorized(identity, origin) : false;
  const rememberedState = remember === undefined ? authorizedState : remember;

  window.postMessage(
    {
      type: LOGIN_RESULT_EVENT,
      success: true,
      identity: sanitizeIdentity(identity, origin),
      signature,
      algorithm: 'ECDSA_P256_SHA256',
      challenge,
      fill: fillOutcome,
      authorized: authorizedState,
      remembered: rememberedState,
      requestId
    },
    '*'
  );
}

async function handleLoginRequest(event) {
  if (event.source !== window || !event.data || event.data.type !== LOGIN_REQUEST_EVENT) {
    return;
  }

  const requestId = event.data.requestId ?? null;

  if (loginOverlayVisible) {
    window.postMessage(
      {
        type: LOGIN_RESULT_EVENT,
        success: false,
        error: 'REQUEST_PENDING',
        message: translateText('content.errors.alreadyPending'),
        requestId
      },
      '*'
    );
    return;
  }

  loginOverlayVisible = true;

  try {
    const preferredId = typeof event.data.identityId === 'string' ? event.data.identityId : null;
    const origin = event.origin || window.location.origin;
    const forcePrompt = Boolean(event.data.forcePrompt);
    const requestMessage = typeof event.data.message === 'string' ? event.data.message : null;
    const challengeInput = typeof event.data.challenge === 'string' ? event.data.challenge : null;

    const { identities, selected, authorizedMatch } = await selectPreferredIdentity(preferredId, origin);

    if (identities.length === 0) {
      window.postMessage(
        {
          type: LOGIN_RESULT_EVENT,
          success: false,
          error: 'NO_IDENTITIES',
          message: translateText('content.errors.noIdentities'),
          requestId
        },
        '*'
      );
      return;
    }

    let candidate = null;
    if (!forcePrompt) {
      if (preferredId && selected && isOriginAuthorized(selected, origin)) {
        candidate = selected;
      } else if (!preferredId && authorizedMatch) {
        candidate = authorizedMatch;
      }
    }

    if (candidate) {
      await finalizeAuthorization({ identity: candidate, origin, challengeInput, remember: true, requestId });
      return;
    }

    const initialIdentity = selected ?? identities[0];

    const selection = await createLoginOverlay(identities, initialIdentity?.id, origin, requestMessage);

    const identityId = selection?.identityId ?? initialIdentity?.id;
    const chosen = identities.find((identity) => identity.id === identityId) || initialIdentity;

    if (!chosen) {
      window.postMessage(
        {
          type: LOGIN_RESULT_EVENT,
          success: false,
          error: 'IDENTITY_NOT_FOUND',
          message: translateText('content.errors.identityNotFound'),
          requestId
        },
        '*'
      );
      return;
    }

    const rememberDecision = selection?.remember ?? true;

    await finalizeAuthorization({ identity: chosen, origin, challengeInput, remember: rememberDecision, requestId });
  } catch (error) {
    const isCancelled = Boolean(error?.isCancelled || error?.cancelled);
    if (!isCancelled) {
      console.error('SDID login request failed', error);
    }
    window.postMessage(
      {
        type: LOGIN_RESULT_EVENT,
        success: false,
        cancelled: isCancelled,
        error: isCancelled
          ? translateText('content.errors.loginCancelled')
          : translateText('content.errors.loginFailed'),
        requestId
      },
      '*'
    );
  } finally {
    loginOverlayVisible = false;
  }
}


function injectPageBridge() {
  try {
    const existingBridge = document.querySelector('script[data-sdid-bridge="true"]');
    if (existingBridge) {
      existingBridge.remove();
    }
    const bridgeScript = document.createElement('script');
    bridgeScript.dataset.sdidBridge = 'true';
    bridgeScript.dataset.requestEvent = LOGIN_REQUEST_EVENT;
    bridgeScript.dataset.resultEvent = LOGIN_RESULT_EVENT;
    bridgeScript.src = chrome.runtime.getURL('pageBridge.js');
    bridgeScript.addEventListener(
      'load',
      () => {
        bridgeScript.remove();
      },
      { once: true }
    );
    bridgeScript.addEventListener(
      'error',
      (event) => {
        console.warn('Failed to inject SDID bridge', event);
        bridgeScript.remove();
      },
      { once: true }
    );
    (document.head || document.documentElement).appendChild(bridgeScript);
  } catch (error) {
    console.warn('Failed to inject SDID bridge', error);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'fill-identity') {
    const outcome = fillIdentity(message.identity);
    sendResponse(outcome);
    return true;
  }
  if (message?.type === 'sdid-ping') {
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

window.addEventListener('message', handleLoginRequest);

(function applyStyles() {
  const styleId = 'sdid-identity-style';
  if (document.getElementById(styleId)) {
    return;
  }
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .sdid-identity-filled {
      outline: 2px solid rgba(37, 99, 235, 0.45);
      transition: outline 0.3s ease;
    }
    .sdid-login-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.28);
      font-family: 'Inter', 'SF Pro Text', system-ui, sans-serif;
    }
    .sdid-login-dialog {
      background: #ffffff;
      color: #111827;
      width: min(420px, calc(100% - 32px));
      border-radius: 16px;
      border: 1px solid #d1d5db;
      box-shadow: 0 18px 36px rgba(15, 23, 42, 0.14);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .sdid-login-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .sdid-language-switch {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px;
      border-radius: 999px;
      border: 1px solid #d1d5db;
      background: #f8fafc;
    }
    .sdid-language-switch button {
      border: none;
      background: transparent;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 0.75rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease;
    }
    .sdid-language-switch button:hover {
      color: #2563eb;
    }
    .sdid-language-switch button.active {
      background: #2563eb;
      color: #ffffff;
    }
    .sdid-language-switch button:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
    }
    .sdid-login-dialog h2 {
      margin: 0;
      font-size: 1.2rem;
      color: #0b1f33;
    }
    .sdid-login-message {
      margin: 0;
      font-size: 0.95rem;
      color: #475569;
      word-break: break-word;
    }
    .sdid-login-origin {
      margin: 0;
      font-size: 0.8rem;
      color: #5f6b7a;
    }
    .sdid-login-select {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 0.95rem;
    }
    .sdid-login-select > span {
      font-weight: 600;
      color: #0b1f33;
    }
    .sdid-login-select select {
      border: 1px solid #d1d5db;
      border-radius: 12px;
      padding: 8px 12px;
      font-size: 0.95rem;
      background: #ffffff;
      color: #111827;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .sdid-login-select select:focus-visible {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
    }
    .sdid-login-summary {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.82rem;
      color: #475569;
    }
    .sdid-login-remember {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      color: #0f172a;
    }
    .sdid-login-remember input {
      width: 18px;
      height: 18px;
      accent-color: #2563eb;
    }
    .sdid-login-hint {
      margin: 0;
      font-size: 0.78rem;
      color: #64748b;
    }
    .sdid-login-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      flex-wrap: wrap;
    }
    .sdid-login-actions button {
      border-radius: 999px;
      border: 1px solid #d1d5db;
      padding: 9px 18px;
      font-size: 0.92rem;
      cursor: pointer;
      background: #ffffff;
      color: #111827;
      transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    }
    .sdid-login-actions button:hover {
      background: #eef2ff;
    }
    .sdid-login-actions button:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
    }
    .sdid-login-confirm {
      background: #2563eb;
      border-color: #2563eb;
      color: #ffffff;
      font-weight: 600;
    }
    .sdid-login-confirm:hover,
    .sdid-login-confirm:focus-visible {
      background: #1d4ed8;
      color: #ffffff;
    }
    .sdid-login-cancel {
      color: #2563eb;
    }
    @media (max-width: 480px) {
      .sdid-login-dialog {
        padding: 20px;
        width: calc(100% - 24px);
      }
      .sdid-login-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
      .sdid-language-switch {
        align-self: flex-start;
      }
      .sdid-login-actions {
        flex-direction: column-reverse;
        align-items: stretch;
      }
      .sdid-login-actions button {
        width: 100%;
      }
    }
  `;
  document.documentElement.appendChild(style);
})();
