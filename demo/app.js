const connectButton = document.getElementById('connect');
const forceButton = document.getElementById('force');
const statusElement = document.getElementById('status');
const identityElement = document.getElementById('identity');
const verificationElement = document.getElementById('verification');
const languageToggle = document.getElementById('language-toggle');
const languageButtons = languageToggle ? Array.from(languageToggle.querySelectorAll('button')) : [];

const LANGUAGE_STORAGE_KEY = 'sdid-demo-language';
const SUPPORTED_LANGUAGES = ['en', 'zh'];

const translations = {
  en: {
    page: { title: 'SDID Demo dApp' },
    language: { label: 'Language' },
    hero: {
      title: 'SDID Demo dApp',
      subtitle:
        'Connect to the SDID browser extension, approve the login request, and verify the DID signature returned to this page.'
    },
    steps: {
      title: 'How it works',
      step1: 'Install the SDID extension and create at least one DID identity.',
      step2: 'Click “Connect with SDID” to send a login request to the extension.',
      step3: 'Approve and optionally remember this site for next time.',
      step4: 'The demo verifies the signature using the returned public key.'
    },
    actions: {
      title: 'Try it now',
      connect: 'Connect with SDID',
      force: 'Force prompt',
      hint: 'If you previously authorized this site, use “Force prompt” to see the approval dialog again.'
    },
    sections: {
      identity: 'Identity response',
      verification: 'Signature verification'
    },
    footer: {
      note: 'Reload the extension after editing source files to pick up changes.'
    },
    status: {
      waiting: 'Waiting for the SDID extension…',
      ready: 'SDID ready. Click connect to begin.',
      connecting: 'Requesting approval…',
      connected: 'Connected as {label}',
      rejected: 'Login was rejected.',
      error: 'Unable to complete the login request.'
    },
    verification: {
      missing: 'Missing public key or signature.',
      success: 'Signature verified successfully.',
      failure: 'Signature verification failed.',
      error: 'Unable to verify the signature. Check the console for details.',
      mismatch: 'Authentication payload mismatch.'
    },
    login: {
      message: 'Demo dApp requests access'
    },
    labels: {
      unknownIdentity: 'unknown identity'
    }
  },
  zh: {
    page: { title: 'SDID 演示应用' },
    language: { label: '语言' },
    hero: {
      title: 'SDID 演示应用',
      subtitle: '连接 SDID 浏览器扩展，确认登录请求，并在此页面验证返回的 DID 签名。'
    },
    steps: {
      title: '操作流程',
      step1: '安装 SDID 扩展并创建至少一个 DID 身份。',
      step2: '点击“连接 SDID”向扩展发送登录请求。',
      step3: '在确认弹窗中授权，可选择记住此站点以便下次快速通过。',
      step4: '演示应用会使用返回的公钥验证签名。'
    },
    actions: {
      title: '立即体验',
      connect: '连接 SDID',
      force: '强制弹窗',
      hint: '如果之前已授权此站点，可点击“强制弹窗”再次查看确认流程。'
    },
    sections: {
      identity: '身份返回结果',
      verification: '签名验证'
    },
    footer: {
      note: '修改源码后请在 Chrome 扩展页面重新加载以应用更改。'
    },
    status: {
      waiting: '正在等待 SDID 扩展…',
      ready: 'SDID 已就绪，点击按钮开始体验。',
      connecting: '正在请求授权…',
      connected: '已连接身份：{label}',
      rejected: '登录请求被拒绝。',
      error: '登录请求未能完成。'
    },
    verification: {
      missing: '缺少公钥或签名。',
      success: '签名验证通过。',
      failure: '签名验证失败。',
      error: '无法验证签名，请查看控制台日志。',
      mismatch: '认证负载不一致。'
    },
    login: {
      message: '演示应用请求访问'
    },
    labels: {
      unknownIdentity: '未知身份'
    }
  }
};

let currentLanguage = 'en';
let lastStatus = { key: null, replacements: null, message: '', tone: 'info' };
let lastVerification = null;

function sanitizeLanguage(value) {
  return SUPPORTED_LANGUAGES.includes(value) ? value : 'en';
}

function detectLanguage() {
  const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  return lang.startsWith('zh') ? 'zh' : 'en';
}

function getFromDictionary(language, key) {
  const segments = key.split('.');
  let node = translations[language];
  for (const segment of segments) {
    if (!node || typeof node !== 'object') {
      return null;
    }
    node = node[segment];
  }
  return typeof node === 'string' ? node : null;
}

function formatTemplate(template, replacements = {}) {
  if (!replacements || typeof replacements !== 'object') {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, token) => {
    return token in replacements ? String(replacements[token]) : match;
  });
}

function canonicalizeJson(value) {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function translate(key, replacements = {}, language = currentLanguage) {
  const lang = sanitizeLanguage(language);
  let template = getFromDictionary(lang, key);
  if (!template && lang !== 'en') {
    template = getFromDictionary('en', key);
  }
  if (!template) {
    return key;
  }
  return formatTemplate(template, replacements);
}

function applyTranslations(root = document) {
  const elements = root.querySelectorAll('[data-i18n]');
  elements.forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (!key) {
      return;
    }
    const targetsAttr = element.getAttribute('data-i18n-target');
    const targets = targetsAttr
      ? targetsAttr
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : ['text'];
    const text = translate(key);
    if (targets.includes('text')) {
      element.textContent = text;
    }
    targets
      .filter((target) => target !== 'text')
      .forEach((target) => {
        element.setAttribute(target, text);
      });
  });
  document.title = translate('page.title');
}

function updateLanguageToggleUI(language) {
  languageButtons.forEach((button) => {
    const value = button.dataset.language;
    const isActive = value === language;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function applyStatus() {
  if (!statusElement) {
    return;
  }
  const { key, replacements, message, tone } = lastStatus;
  const text = key ? translate(key, replacements) : message || '';
  statusElement.textContent = text;
  const state = tone === 'success' ? 'success' : tone === 'error' ? 'error' : 'info';
  statusElement.dataset.state = state;
}

function setStatusFromKey(key, replacements = {}, tone = 'info') {
  lastStatus = { key, replacements, message: '', tone };
  applyStatus();
}

function setStatusMessage(message, tone = 'info') {
  lastStatus = { key: null, replacements: null, message: message || '', tone };
  applyStatus();
}

function applyVerification() {
  if (!verificationElement) {
    return;
  }
  verificationElement.innerHTML = '';
  if (!lastVerification) {
    return;
  }
  const { key, replacements, message, verified } = lastVerification;
  const text = key ? translate(key, replacements) : message || '';
  if (!text) {
    return;
  }
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  paragraph.className = verified ? 'success' : 'error';
  verificationElement.appendChild(paragraph);
}

function setVerification(result) {
  if (!verificationElement) {
    return;
  }
  if (!result) {
    lastVerification = null;
    applyVerification();
    return;
  }
  lastVerification = {
    key: result.key || null,
    replacements: result.replacements || null,
    message: result.message || '',
    verified: Boolean(result.verified)
  };
  applyVerification();
}

function formatIdentityPayload(response) {
  if (!response || typeof response !== 'object') {
    return '';
  }
  const payload = {
    identity: response.identity,
    challenge: response.challenge,
    signature: response.signature,
    algorithm: response.algorithm,
    proof: response.proof,
    authentication: response.authentication,
    authorized: response.authorized,
    remembered: response.remembered,
    fill: response.fill,
    requestId: response.requestId
  };
  return JSON.stringify(payload, null, 2);
}

function renderIdentity(response) {
  if (!identityElement) {
    return;
  }
  identityElement.textContent = formatIdentityPayload(response);
}

function disableButtons(disabled) {
  if (connectButton) {
    connectButton.disabled = disabled;
  }
  if (forceButton) {
    forceButton.disabled = disabled;
  }
}

function waitForSdid() {
  if (window.SDID?.requestLogin) {
    return Promise.resolve(window.SDID);
  }
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('sdid#initialized', handleInitialized);
      reject(new Error('SDID bridge not detected.'));
    }, 5000);

    function handleInitialized() {
      window.clearTimeout(timeout);
      window.removeEventListener('sdid#initialized', handleInitialized);
      resolve(window.SDID);
    }

    window.addEventListener('sdid#initialized', handleInitialized);
  });
}

function createChallenge() {
  return `demo:${Date.now().toString(16)}:${crypto.getRandomValues(new Uint32Array(1))[0].toString(16)}`;
}

async function verifySignatureWithKey(publicKeyJwk, data, signature) {
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
  const binary = atob(signature);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const dataBytes = new TextEncoder().encode(data);
  return crypto.subtle.verify({ name: 'ECDSA', hash: { name: 'SHA-256' } }, publicKey, bytes, dataBytes);
}

async function verifyAuthenticationResponse(response) {
  const identity = response?.identity;
  if (!identity?.publicKeyJwk) {
    return { verified: false, key: 'verification.missing' };
  }

  const signature = response?.proof?.signatureValue || response?.signature;
  const canonicalRequest = typeof response?.authentication?.canonicalRequest === 'string'
    ? response.authentication.canonicalRequest
    : null;
  const payload = response?.authentication?.payload || null;

  let dataToVerify = canonicalRequest;
  if (payload && canonicalRequest) {
    const reconstructed = canonicalizeJson(payload);
    if (reconstructed !== canonicalRequest) {
      return { verified: false, key: 'verification.mismatch' };
    }
  }

  if (!dataToVerify) {
    dataToVerify = response?.challenge || null;
  }

  if (!signature || !dataToVerify) {
    return { verified: false, key: 'verification.missing' };
  }

  try {
    const verified = await verifySignatureWithKey(identity.publicKeyJwk, dataToVerify, signature);
    return { verified, key: verified ? 'verification.success' : 'verification.failure' };
  } catch (error) {
    console.error('Signature verification error', error);
    return { verified: false, key: 'verification.error' };
  }
}

function initializeLanguage() {
  let stored = null;
  try {
    stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch (_error) {
    stored = null;
  }
  currentLanguage = sanitizeLanguage(stored || detectLanguage());
  document.documentElement.lang = currentLanguage;
  applyTranslations();
  updateLanguageToggleUI(currentLanguage);
  applyStatus();
  applyVerification();
}

function changeLanguage(language) {
  const nextLanguage = sanitizeLanguage(language);
  if (nextLanguage === currentLanguage) {
    updateLanguageToggleUI(nextLanguage);
    return;
  }
  currentLanguage = nextLanguage;
  document.documentElement.lang = currentLanguage;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  } catch (_error) {
    // Ignore storage failures.
  }
  applyTranslations();
  updateLanguageToggleUI(currentLanguage);
  applyStatus();
  applyVerification();
}

async function requestLogin(forcePrompt = true) {
  disableButtons(true);
  setVerification(null);
  renderIdentity(null);
  setStatusFromKey('status.connecting');
  try {
    const sdid = await waitForSdid();
    const challenge = createChallenge();
    const response = await sdid.requestLogin({
      message: translate('login.message'),
      challenge,
      forcePrompt
    });
    renderIdentity(response);
    const verification = await verifyAuthenticationResponse(response);
    setVerification(verification);
    const label = (response.identity?.label && response.identity.label.trim())
      || response.identity?.did
      || translate('labels.unknownIdentity');
    const tone = verification.verified ? 'success' : 'info';
    setStatusFromKey('status.connected', { label }, tone);
  } catch (error) {
    console.error('Demo login failed', error);
    const rawMessage = typeof error?.message === 'string' ? error.message.trim() : '';
    if (rawMessage) {
      const normalized = rawMessage.toLowerCase();
      if (normalized.includes('cancel') || rawMessage.includes('取消') || rawMessage.includes('拒绝')) {
        setStatusFromKey('status.rejected', {}, 'error');
        setVerification({ verified: false, key: 'verification.failure' });
      } else {
        setStatusMessage(rawMessage, 'error');
        setVerification({ verified: false, message: rawMessage });
      }
    } else {
      setStatusFromKey('status.error', {}, 'error');
      setVerification({ verified: false, key: 'verification.error' });
    }
  } finally {
    disableButtons(false);
  }
}

initializeLanguage();

if (languageButtons.length) {
  languageButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextLanguage = button.dataset.language;
      if (!nextLanguage) {
        return;
      }
      changeLanguage(nextLanguage);
    });
  });
}

if (connectButton) {
  connectButton.addEventListener('click', () => requestLogin());
}

if (forceButton) {
  forceButton.addEventListener('click', () => requestLogin(true));
}

if (!window.SDID?.requestLogin) {
  setStatusFromKey('status.waiting');
  window.addEventListener(
    'sdid#initialized',
    () => {
      setStatusFromKey('status.ready');
    },
    { once: true }
  );
} else {
  setStatusFromKey('status.ready');
}
