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
  'content.overlay.subtitle': 'Review and approve this sign-in request.',
  'content.overlay.origin': 'Origin',
  'content.overlay.chooseIdentity': 'Choose identity',
  'content.overlay.remember': 'Remember this site for one-click approvals',
  'content.overlay.rememberAuthorized': 'This site is already authorized. Uncheck to require approval next time.',
  'content.overlay.rememberHint': 'Keep this checked to approve future logins instantly.',
  'content.overlay.sectionRequest': 'Request details',
  'content.overlay.sectionIdentity': 'Identity preview',
  'content.overlay.summarySite': 'Site',
  'content.overlay.summaryTime': 'Requested at',
  'content.overlay.summaryRequestId': 'Request ID',
  'content.overlay.summaryChallenge': 'Challenge nonce',
  'content.overlay.summaryIdentity': 'Identity',
  'content.overlay.summaryDid': 'DID',
  'content.overlay.summaryRoles': 'Roles',
  'content.overlay.summaryDomain': 'Trusted domain',
  'content.overlay.summaryUsername': 'Username',
  'content.overlay.summaryNotes': 'Notes',
  'content.overlay.summaryVerification': 'Verification method',
  'content.overlay.summaryKeyType': 'Key type',
  'content.overlay.summaryTags': 'Tags',
  'content.errors.alreadyPending': 'Another login request is already pending. Please complete it first.',
  'content.errors.noIdentities': 'No eligible DID identities are saved in SDID.',
  'content.errors.identityNotFound': 'The selected identity could not be located.',
  'content.errors.loginCancelled': 'Login request cancelled by user.',
  'content.errors.loginFailed': 'Login request failed.',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.untitledIdentity': 'Untitled identity',
  'common.languageLabel': 'Language',
  'common.languageEnglish': 'English',
  'common.languageChinese': '中文'
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

function getVerificationMethodId(identity) {
  if (!identity?.did) {
    return '';
  }
  return `${identity.did}#keys-1`;
}

function buildDidDocument(identity) {
  if (!identity?.did || !identity?.publicKeyJwk) {
    return null;
  }
  const verificationMethodId = getVerificationMethodId(identity);
  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: identity.did,
    verificationMethod: [
      {
        id: verificationMethodId,
        type: 'JsonWebKey2020',
        controller: identity.did,
        publicKeyJwk: JSON.parse(JSON.stringify(identity.publicKeyJwk))
      }
    ],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId]
  };
}

function getKeyTypeLabel(publicKeyJwk) {
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

function sanitizeIdentity(identity, origin) {
  if (!identity) {
    return null;
  }
  return {
    id: identity.id,
    label: identity.label,
    roles: Array.isArray(identity.roles) ? [...identity.roles] : [],
    did: identity.did,
    verificationMethod: getVerificationMethodId(identity),
    publicKeyJwk: identity.publicKeyJwk ? JSON.parse(JSON.stringify(identity.publicKeyJwk)) : null,
    username: identity.username,
    domain: identity.domain,
    tags: Array.isArray(identity.tags) ? [...identity.tags] : [],
    notes: identity.notes,
    updatedAt: identity.updatedAt,
    authorized: origin ? isOriginAuthorized(identity, origin) : false,
    didDocument: buildDidDocument(identity)
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

async function signPayload(identity, payload) {
  if (!identity?.privateKeyJwk) {
    throw new Error('Missing private key');
  }
  const privateKey = await crypto.subtle.importKey('jwk', identity.privateKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign'
  ]);
  const data = new TextEncoder().encode(payload);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: { name: 'SHA-256' } }, privateKey, data);
  return bufferToBase64(signature);
}

function canonicalizeJson(value) {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalizeJson(item));
    return `[${items.join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function buildAuthenticationPayload({ identity, origin, challenge, requestId, requestMessage }) {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);
  const payload = {
    iss: identity.did,
    sub: identity.did,
    nonce: challenge,
    iat: issuedAt.toISOString(),
    exp: expiresAt.toISOString(),
    purpose: 'authentication'
  };

  if (origin) {
    payload.aud = origin;
  }
  if (requestId) {
    payload.requestId = requestId;
  }
  if (requestMessage) {
    payload.statement = requestMessage;
  }

  const verificationMethod = getVerificationMethodId(identity);
  if (verificationMethod) {
    payload.verificationMethod = verificationMethod;
  }

  const resources = {};
  if (identity.roles?.length) {
    resources.roles = [...identity.roles];
  }
  if (identity.domain) {
    resources.domain = identity.domain;
  }
  if (identity.tags?.length) {
    resources.tags = [...identity.tags];
  }
  if (identity.label) {
    resources.label = identity.label;
  }
  if (Object.keys(resources).length) {
    payload.resources = resources;
  }

  return payload;
}

async function createAuthenticationProof({ identity, origin, challenge, requestId, requestMessage }) {
  const payload = buildAuthenticationPayload({ identity, origin, challenge, requestId, requestMessage });
  const canonicalRequest = canonicalizeJson(payload);
  const signatureValue = await signPayload(identity, canonicalRequest);
  const proof = {
    type: 'EcdsaSecp256r1Signature2019',
    created: payload.iat,
    proofPurpose: 'authentication',
    verificationMethod: payload.verificationMethod || getVerificationMethodId(identity),
    challenge,
    signatureValue
  };
  if (origin) {
    proof.domain = origin;
  }
  return {
    payload,
    canonicalRequest,
    proof,
    signatureValue
  };
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

function formatTimestamp(date, language) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const locale = language === 'zh' ? 'zh-CN' : language || 'en';
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    return formatter.format(date);
  } catch (error) {
    console.debug('Unable to format timestamp with Intl API, falling back to locale string.', error);
    try {
      return date.toLocaleString(locale);
    } catch (_fallbackError) {
      return date.toISOString();
    }
  }
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function createIconElement(iconName) {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('sdid-icon-symbol');

  const baseStroke = {
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.6',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round'
  };

  const appendShape = (tag, attributes = {}) => {
    const element = document.createElementNS(SVG_NAMESPACE, tag);
    const merged = { ...baseStroke, ...attributes };
    Object.entries(merged).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    svg.appendChild(element);
    return element;
  };

  switch (iconName) {
    case 'lock': {
      appendShape('rect', { x: '6', y: '10', width: '12', height: '10', rx: '2' });
      appendShape('path', { d: 'M9 10V7a3 3 0 0 1 6 0v3' });
      break;
    }
    case 'site': {
      appendShape('circle', { cx: '12', cy: '12', r: '8.5' });
      appendShape('line', { x1: '4', y1: '12', x2: '20', y2: '12' });
      appendShape('line', { x1: '12', y1: '4', x2: '12', y2: '20' });
      break;
    }
    case 'time': {
      appendShape('circle', { cx: '12', cy: '12', r: '8.5' });
      appendShape('line', { x1: '12', y1: '7', x2: '12', y2: '12' });
      appendShape('line', { x1: '12', y1: '12', x2: '16', y2: '14.5' });
      break;
    }
    case 'identity': {
      appendShape('rect', { x: '4', y: '6', width: '16', height: '12', rx: '3' });
      appendShape('circle', { cx: '9', cy: '12', r: '2.5', fill: 'currentColor', stroke: 'none' });
      appendShape('line', { x1: '13', y1: '10', x2: '17', y2: '10' });
      appendShape('line', { x1: '13', y1: '14', x2: '17', y2: '14' });
      break;
    }
    case 'did': {
      appendShape('circle', { cx: '8.5', cy: '12', r: '3' });
      appendShape('circle', { cx: '15.5', cy: '12', r: '3' });
      appendShape('line', { x1: '11.5', y1: '12', x2: '12.5', y2: '12' });
      break;
    }
    case 'roles': {
      appendShape('circle', { cx: '12', cy: '7', r: '2.5' });
      appendShape('circle', { cx: '7.5', cy: '15.2', r: '2.5' });
      appendShape('circle', { cx: '16.5', cy: '15.2', r: '2.5' });
      appendShape('line', { x1: '9.3', y1: '13.4', x2: '10.9', y2: '10.2' });
      appendShape('line', { x1: '14.7', y1: '13.4', x2: '13.1', y2: '10.2' });
      appendShape('line', { x1: '9.8', y1: '16.8', x2: '14.2', y2: '16.8' });
      break;
    }
    case 'domain': {
      appendShape('path', { d: 'M12 4l6 3v5.5c0 3.4-2.3 6.5-6 7.5-3.7-1-6-4.1-6-7.5V7z' });
      break;
    }
    case 'user': {
      appendShape('circle', { cx: '12', cy: '10', r: '3' });
      appendShape('path', { d: 'M6.5 17c1.8-2.3 5-3 5.5-3s3.7 0.7 5.5 3' });
      break;
    }
    case 'notes': {
      appendShape('path', {
        d: 'M8 5h7l3 3v11a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V6.5A1.5 1.5 0 0 1 8 5z'
      });
      appendShape('polyline', { points: '15,5 15,9 19,9' });
      appendShape('line', { x1: '9', y1: '12', x2: '15', y2: '12' });
      appendShape('line', { x1: '9', y1: '15', x2: '15', y2: '15' });
      break;
    }
    case 'key': {
      appendShape('circle', { cx: '9', cy: '12', r: '3' });
      appendShape('line', { x1: '11.5', y1: '12', x2: '19', y2: '12' });
      appendShape('line', { x1: '16.5', y1: '10.5', x2: '16.5', y2: '13.5' });
      break;
    }
    case 'shield': {
      appendShape('path', { d: 'M12 4l6 3v5.6c0 3.7-2.6 7-6 8-3.4-1-6-4.3-6-8V7z' });
      break;
    }
    case 'tag': {
      appendShape('path', { d: 'M5 8.5V5h3.5L19 15.5 15.5 19 5 8.5z' });
      appendShape('circle', { cx: '8', cy: '8', r: '1.5' });
      break;
    }
    case 'hash': {
      appendShape('line', { x1: '8', y1: '7', x2: '6', y2: '17' });
      appendShape('line', { x1: '16', y1: '7', x2: '14', y2: '17' });
      appendShape('line', { x1: '6', y1: '11', x2: '18', y2: '11' });
      appendShape('line', { x1: '5', y1: '15', x2: '17', y2: '15' });
      break;
    }
    default: {
      return null;
    }
  }

  if (!svg.childNodes.length) {
    return null;
  }

  return svg;
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
    const requestedAt = new Date();

    const overlay = document.createElement('div');
    overlay.id = LOGIN_OVERLAY_ID;
    overlay.className = 'sdid-login-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'sdid-login-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const header = document.createElement('div');
    header.className = 'sdid-login-header';

    const headerMain = document.createElement('div');
    headerMain.className = 'sdid-login-header-main';

    const headerIcon = document.createElement('div');
    headerIcon.className = 'sdid-login-icon';
    headerIcon.setAttribute('aria-hidden', 'true');
    const headerIconGraphic = createIconElement('lock');
    if (headerIconGraphic) {
      headerIcon.appendChild(headerIconGraphic);
    } else {
      headerIcon.textContent = '🔐';
    }
    headerMain.appendChild(headerIcon);

    const headerText = document.createElement('div');
    headerText.className = 'sdid-login-header-text';

    const title = document.createElement('h2');
    title.id = `${LOGIN_OVERLAY_ID}-title`;
    headerText.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'sdid-login-subtitle';
    headerText.appendChild(subtitle);

    headerMain.appendChild(headerText);
    header.appendChild(headerMain);

    const languageSwitchControl = createOverlayLanguageSwitch();
    if (languageSwitchControl) {
      header.appendChild(languageSwitchControl.container);
    }

    dialog.setAttribute('aria-labelledby', title.id);
    dialog.appendChild(header);

    let message = null;
    if (requestMessage) {
      message = document.createElement('p');
      message.className = 'sdid-login-message';
      message.textContent = requestMessage;
      dialog.appendChild(message);
    }

    const detailList = document.createElement('ul');
    detailList.className = 'sdid-login-detail-list';
    dialog.appendChild(detailList);

    function createDetailItem(list, iconName) {
      const item = document.createElement('li');
      item.className = 'sdid-login-detail-item';

      const icon = document.createElement('span');
      icon.className = `sdid-login-item-icon icon-${iconName}`;
      icon.setAttribute('aria-hidden', 'true');
      const iconGraphic = createIconElement(iconName);
      if (iconGraphic) {
        icon.appendChild(iconGraphic);
      } else {
        icon.textContent = '•';
      }
      item.appendChild(icon);

      const textWrap = document.createElement('div');
      textWrap.className = 'sdid-login-item-text';

      const label = document.createElement('span');
      label.className = 'sdid-login-item-label';
      textWrap.appendChild(label);

      const value = document.createElement('span');
      value.className = 'sdid-login-item-value';
      textWrap.appendChild(value);

      item.appendChild(textWrap);
      list.appendChild(item);

      return { item, label, value };
    }

    const detailItems = {
      site: createDetailItem(detailList, 'site'),
      time: createDetailItem(detailList, 'time'),
      identity: createDetailItem(detailList, 'identity'),
      did: createDetailItem(detailList, 'did')
    };

    let selectLabel = null;
    let selectTitle = null;
    const select = document.createElement('select');

    const showIdentitySelector = identities.length > 1;
    if (showIdentitySelector) {
      selectLabel = document.createElement('label');
      selectLabel.className = 'sdid-login-select';

      selectTitle = document.createElement('span');
      selectLabel.appendChild(selectTitle);
      selectLabel.appendChild(select);
      dialog.appendChild(selectLabel);
    }

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

    requestAnimationFrame(() => {
      overlay.classList.add('sdid-login-overlay-visible');
    });

    const previousActiveElement = document.activeElement;

    let settled = false;
    let detachLanguageListener = null;
    let overlayClickHandler = null;

    const cleanup = (result, shouldReject = false) => {
      if (settled) {
        return;
      }
      settled = true;

      let exitHandled = false;

      const finalizeRemoval = () => {
        if (exitHandled) {
          return;
        }
        exitHandled = true;
        overlay.removeEventListener('transitionend', handleOverlayExit);
        overlay.removeEventListener('animationend', handleOverlayExit);
        overlay.remove();
        document.removeEventListener('keydown', handleKeydown, true);
        if (overlayClickHandler) {
          overlay.removeEventListener('click', overlayClickHandler);
        }
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

      const handleOverlayExit = (event) => {
        if (event.target !== overlay) {
          return;
        }
        finalizeRemoval();
      };

      overlay.addEventListener('transitionend', handleOverlayExit);
      overlay.addEventListener('animationend', handleOverlayExit);
      overlay.classList.remove('sdid-login-overlay-visible');
      overlay.classList.add('sdid-login-overlay-exit');

      setTimeout(finalizeRemoval, 320);
    };

    const getSelectedIdentityId = () => select.value || initialId || identities[0]?.id || null;

    const refreshSelectOptions = () => {
      select.innerHTML = '';
      identities.forEach((identity) => {
        const option = document.createElement('option');
        option.value = identity.id;
        option.textContent = identity.label || identity.username || translateText('common.untitledIdentity');
        if (identity.id === initialId) {
          option.selected = true;
        }
        select.appendChild(option);
      });
      if (!select.value && identities[0]) {
        select.value = identities[0].id;
      }
    };

    const updateIdentityDetails = (identityId) => {
      const identity = identities.find((item) => item.id === identityId) || identities[0] || null;
      if (!identity) {
        detailItems.identity.item.hidden = true;
        detailItems.did.item.hidden = true;
        return;
      }

      const identityLabel = identity.label || identity.username || translateText('common.untitledIdentity');
      detailItems.identity.value.textContent = identityLabel;
      detailItems.identity.item.hidden = false;

      if (identity.did) {
        detailItems.did.value.textContent = identity.did;
        detailItems.did.item.hidden = false;
      } else {
        detailItems.did.value.textContent = '';
        detailItems.did.item.hidden = true;
      }
    };

    const refreshOverlayText = () => {
      const activeLang = typeof i18nApi?.getLanguage === 'function' ? i18nApi.getLanguage() : currentLanguage;
      title.textContent = translateText('content.overlay.title');
      subtitle.textContent = translateText('content.overlay.subtitle');
      if (message) {
        message.textContent = requestMessage;
      }
      detailItems.site.label.textContent = translateText('content.overlay.summarySite');
      if (requestOrigin) {
        detailItems.site.value.textContent = requestOrigin;
        detailItems.site.item.hidden = false;
      } else {
        detailItems.site.value.textContent = '';
        detailItems.site.item.hidden = true;
      }
      detailItems.time.label.textContent = translateText('content.overlay.summaryTime');
      detailItems.time.value.textContent = formatTimestamp(requestedAt, activeLang);
      detailItems.identity.label.textContent = translateText('content.overlay.summaryIdentity');
      detailItems.did.label.textContent = translateText('content.overlay.summaryDid');

      if (selectLabel && selectTitle) {
        selectTitle.textContent = translateText('content.overlay.chooseIdentity');
      }

      cancelButton.textContent = translateText('common.cancel');
      confirmButton.textContent = translateText('common.confirm');

      refreshSelectOptions();
      updateIdentityDetails(getSelectedIdentityId());
    };

    refreshOverlayText();

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

    if (showIdentitySelector) {
      select.addEventListener('change', (event) => {
        updateIdentityDetails(event.target.value);
      });
    }

    const activeLanguage = typeof i18nApi?.getLanguage === 'function' ? i18nApi.getLanguage() : currentLanguage;
    if (languageSwitchControl) {
      languageSwitchControl.setActive(activeLanguage);
    }

    const initialFocusTarget = showIdentitySelector ? select : confirmButton;
    initialFocusTarget.focus({ preventScroll: true });

    confirmButton.addEventListener('click', () => {
      cleanup({ identityId: getSelectedIdentityId() });
    });

    cancelButton.addEventListener('click', () => {
      cleanup({ cancelled: true }, true);
    });

    overlayClickHandler = (event) => {
      if (event.target === overlay) {
        cleanup({ cancelled: true }, true);
      }
    };
    overlay.addEventListener('click', overlayClickHandler);
  });
}
async function finalizeAuthorization({ identity, origin, challenge, remember, requestId, requestMessage }) {
  const effectiveChallenge = typeof challenge === 'string' && challenge.trim() ? challenge : generateChallenge();
  const authentication = await createAuthenticationProof({
    identity,
    origin,
    challenge: effectiveChallenge,
    requestId,
    requestMessage
  });
  const signature = authentication.signatureValue;

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
      challenge: effectiveChallenge,
      proof: authentication.proof,
      authentication: {
        payload: authentication.payload,
        canonicalRequest: authentication.canonicalRequest
      },
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
    const challenge = challengeInput && challengeInput.trim() ? challengeInput.trim() : generateChallenge();

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
      await finalizeAuthorization({
        identity: candidate,
        origin,
        challenge,
        remember: true,
        requestId,
        requestMessage
      });
      return;
    }

    const initialIdentity = selected ?? identities[0];

    const selection = await createLoginOverlay(
      identities,
      initialIdentity?.id,
      origin,
      requestMessage
    );

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

    const rememberDecision = selection?.remember ?? false;

    await finalizeAuthorization({
      identity: chosen,
      origin,
      challenge,
      remember: rememberDecision,
      requestId,
      requestMessage
    });
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
  const cssVar = (name, fallback) => `var(${name}, ${fallback})`;
  const overlayTheme = {
    fontFamily: "var(--sdid-font-family, 'Inter', 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif)",
    text: cssVar('--sdid-color-text', '#221f1a'),
    muted: cssVar('--sdid-color-muted', '#5b564d'),
    subtle: cssVar('--sdid-color-subtle', '#888379'),
    border: cssVar('--sdid-color-border', '#e4e0d8'),
    borderStrong: cssVar('--sdid-color-border-strong', '#d3cec4'),
    surface: cssVar('--sdid-color-surface', '#ffffff'),
    surfaceStrong: cssVar('--sdid-color-surface-strong', '#ffffff'),
    control: cssVar('--sdid-color-control', '#f7f6f2'),
    controlStrong: cssVar('--sdid-color-control-strong', '#f2f0eb'),
    controlActive: cssVar('--sdid-color-control-active', '#ece9e3'),
    accent: cssVar('--sdid-color-accent', '#221f1a'),
    accentStrong: cssVar('--sdid-color-accent-strong', '#181612'),
    accentSoft: cssVar('--sdid-color-accent-soft', '#f2eee8'),
    success: cssVar('--sdid-color-success', '#2f6d46'),
    danger: cssVar('--sdid-color-danger', '#c4554a'),
    info: cssVar('--sdid-color-info', '#6b665d'),
    overlayBackdrop: cssVar('--sdid-overlay-backdrop', 'rgba(34, 31, 26, 0.34)'),
    overlayHighlight: cssVar('--sdid-overlay-highlight', 'rgba(255, 255, 255, 0.45)'),
    shadowPanel: cssVar('--sdid-shadow-panel', '0 24px 48px rgba(28, 24, 19, 0.14)'),
    shadowFloating: cssVar('--sdid-shadow-floating', '0 20px 40px rgba(28, 24, 19, 0.12)'),
    shadowStrong: cssVar('--sdid-shadow-strong', '0 24px 42px rgba(28, 24, 19, 0.18)'),
    shadowButton: cssVar('--sdid-shadow-button', '0 18px 32px rgba(28, 24, 19, 0.22)')
  };
  style.textContent = `
    .sdid-identity-filled {
      outline: 2px solid rgba(34, 31, 26, 0.24);
      box-shadow: 0 0 0 4px rgba(242, 238, 232, 0.7);
      transition: outline 0.3s ease, box-shadow 0.3s ease;
    }
    .sdid-login-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      padding: 24px;
      background: ${overlayTheme.overlayBackdrop};
      backdrop-filter: blur(8px);
      font-family: ${overlayTheme.fontFamily};
      opacity: 0;
      pointer-events: none;
      transition: opacity 220ms ease;
    }
    .sdid-login-overlay-visible {
      opacity: 1;
      pointer-events: auto;
    }
    .sdid-login-overlay-exit {
      pointer-events: none;
    }
    .sdid-login-dialog {
      background: ${overlayTheme.surface};
      color: ${overlayTheme.text};
      width: min(360px, calc(100% - 32px));
      border-radius: 20px;
      border: 1px solid ${overlayTheme.border};
      box-shadow: ${overlayTheme.shadowPanel};
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      pointer-events: auto;
      opacity: 0;
      transform: translate3d(12px, -12px, 0) scale(0.98);
      transition: opacity 240ms cubic-bezier(0.22, 1, 0.36, 1),
        transform 240ms cubic-bezier(0.22, 1, 0.36, 1),
        box-shadow 240ms ease;
    }
    .sdid-login-overlay-visible .sdid-login-dialog {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
    }
    .sdid-login-overlay-exit .sdid-login-dialog {
      opacity: 0;
      transform: translate3d(6px, -10px, 0) scale(0.97);
      box-shadow: ${overlayTheme.shadowFloating};
    }
    .sdid-login-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .sdid-login-header-main {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .sdid-login-icon {
      width: 44px;
      height: 44px;
      border-radius: 16px;
      background: rgba(34, 31, 26, 0.08);
      color: ${overlayTheme.text};
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: transform 220ms ease;
    }
    .sdid-login-overlay-visible .sdid-login-icon {
      animation: sdid-icon-pop 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .sdid-login-icon svg {
      width: 22px;
      height: 22px;
    }
    .sdid-login-header-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .sdid-login-header-text h2 {
      margin: 0;
      font-size: 1.06rem;
      font-weight: 600;
      color: ${overlayTheme.text};
    }
    .sdid-login-subtitle {
      margin: 0;
      font-size: 0.84rem;
      color: ${overlayTheme.muted};
      line-height: 1.4;
    }
    .sdid-language-switch {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      border-radius: 999px;
      border: 1px solid ${overlayTheme.border};
      background: rgba(244, 242, 238, 0.95);
      box-shadow: 0 10px 22px rgba(28, 24, 19, 0.1);
    }
    .sdid-language-switch button {
      border: none;
      background: transparent;
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 0.72rem;
      font-weight: 600;
      color: ${overlayTheme.subtle};
      cursor: pointer;
      transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
    }
    .sdid-language-switch button:hover {
      color: ${overlayTheme.text};
      background: rgba(210, 204, 195, 0.5);
    }
    .sdid-language-switch button.active {
      background: ${overlayTheme.accent};
      color: ${overlayTheme.control};
      box-shadow: 0 12px 20px rgba(28, 24, 19, 0.24);
    }
    .sdid-language-switch button:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(34, 31, 26, 0.16);
    }
    .sdid-login-message {
      margin: 0;
      padding: 12px 16px;
      border-radius: 16px;
      background: ${overlayTheme.accentSoft};
      color: ${overlayTheme.muted};
      font-size: 0.9rem;
      line-height: 1.45;
      border: 1px solid ${overlayTheme.border};
    }
    .sdid-login-detail-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .sdid-login-detail-item {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 10px 12px;
      border-radius: 16px;
      background: ${overlayTheme.control};
      border: 1px solid ${overlayTheme.border};
      transition: transform 0.22s ease, box-shadow 0.22s ease, background 0.22s ease, border-color 0.22s ease;
    }
    .sdid-login-detail-item:hover {
      transform: translateY(-1px);
      background: ${overlayTheme.controlStrong};
      border-color: ${overlayTheme.borderStrong};
      box-shadow: 0 16px 28px rgba(28, 24, 19, 0.12);
    }
    .sdid-login-item-icon {
      width: 30px;
      height: 30px;
      border-radius: 50px;
      background: ${overlayTheme.accentSoft};
      color: ${overlayTheme.text};
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .sdid-login-item-icon svg {
      width: 16px;
      height: 16px;
    }
    .sdid-login-item-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .sdid-login-item-label {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${overlayTheme.subtle};
      font-weight: 600;
    }
    .sdid-login-item-value {
      font-size: 0.92rem;
      color: ${overlayTheme.text};
      line-height: 1.45;
      word-break: break-word;
    }
    .sdid-login-select {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .sdid-login-select > span {
      font-size: 0.78rem;
      font-weight: 600;
      color: ${overlayTheme.muted};
    }
    .sdid-login-select select {
      border: 1px solid ${overlayTheme.border};
      border-radius: 14px;
      padding: 10px 14px;
      font-size: 0.9rem;
      background: ${overlayTheme.surface};
      color: ${overlayTheme.text};
      transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    }
    .sdid-login-select select:focus-visible {
      outline: none;
      border-color: rgba(32, 28, 22, 0.6);
      box-shadow: 0 0 0 3px rgba(32, 28, 22, 0.12);
      transform: translateY(-1px);
    }
    .sdid-login-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }
    .sdid-login-actions button {
      border-radius: 12px;
      border: 1px solid ${overlayTheme.border};
      padding: 10px 20px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      max-width: 100%;
      background: ${overlayTheme.control};
      color: ${overlayTheme.text};
      box-shadow: 0 12px 22px rgba(28, 24, 19, 0.08);
      white-space: nowrap;
    }
    .sdid-login-actions button:hover {
      transform: translateY(-1px);
      background: ${overlayTheme.controlStrong};
      border-color: ${overlayTheme.borderStrong};
      box-shadow: 0 18px 30px rgba(28, 24, 19, 0.12);
    }
    .sdid-login-actions button:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(34, 31, 26, 0.16), 0 12px 24px rgba(28, 24, 19, 0.12);
    }
    .sdid-login-actions button:active {
      transform: translateY(0);
      background: ${overlayTheme.controlActive};
      box-shadow: 0 8px 16px rgba(28, 24, 19, 0.12);
    }
    .sdid-login-cancel {
      background: ${overlayTheme.controlStrong};
      color: ${overlayTheme.muted};
      border-color: ${overlayTheme.border};
    }
    .sdid-login-cancel:hover,
    .sdid-login-cancel:focus-visible {
      color: ${overlayTheme.text};
    }
    .sdid-login-confirm {
      background: ${overlayTheme.accent};
      border-color: rgba(28, 24, 19, 0.82);
      color: ${overlayTheme.control};
      box-shadow: ${overlayTheme.shadowButton};
      position: relative;
      overflow: hidden;
    }
    .sdid-login-confirm::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: radial-gradient(circle at top, ${overlayTheme.overlayHighlight}, transparent 55%);
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    }
    .sdid-login-confirm:hover,
    .sdid-login-confirm:focus-visible {
      transform: translateY(-1px);
      box-shadow: 0 22px 36px rgba(28, 24, 19, 0.28);
    }
    .sdid-login-confirm:hover::after,
    .sdid-login-confirm:focus-visible::after {
      opacity: 1;
    }
    .sdid-login-overlay-visible .sdid-login-confirm {
      animation: sdid-confirm-pulse 2.4s ease 0.18s 2;
    }
    @keyframes sdid-confirm-pulse {
      0% {
        box-shadow: ${overlayTheme.shadowButton};
      }
      50% {
        box-shadow: ${overlayTheme.shadowStrong};
      }
      100% {
        box-shadow: ${overlayTheme.shadowButton};
      }
    }
    @keyframes sdid-icon-pop {
      0% {
        transform: scale(0.92);
      }
      60% {
        transform: scale(1.05);
      }
      100% {
        transform: scale(1);
      }
    }
    @media (max-width: 600px) {
      .sdid-login-overlay {
        justify-content: center;
        padding: 16px;
      }
      .sdid-login-dialog {
        width: min(360px, calc(100% - 24px));
      }
    }
`
  document.documentElement.appendChild(style);
})();
