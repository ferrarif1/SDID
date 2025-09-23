const IDENTITY_STORAGE_KEY = 'identities';
const LAST_USED_ID_KEY = 'lastUsedIdentityId';
const LOGIN_REQUEST_EVENT = 'SDID_REQUEST_LOGIN';
const LOGIN_RESULT_EVENT = 'SDID_LOGIN_RESULT';
const LOGIN_OVERLAY_ID = 'sdid-login-overlay';

const usernameKeywords = ['user', 'email', 'login', 'account', 'identifier', 'phone'];
const passwordKeywords = ['pass', 'password', 'secret', 'pin', 'code'];

const t = (en, zh) => `${en}｜${zh}`;

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
    return { success: false, reason: t('Missing identity payload.', '缺少身份数据。') };
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
        result.messages.push(t('Unable to populate username field.', '无法填充用户名输入框。'));
      }
    } else {
      result.messages.push(t('No username field detected on this page.', '未在页面上检测到用户名输入框。'));
    }
  }

  if (identity.password) {
    const passwordField =
      findInputByKeywords(passwordKeywords, 'input[type="password"], input[type="text"], input[type="tel"], input') ||
      document.querySelector('input[type="password"]');
    if (passwordField) {
      result.filledPassword = fillElementValue(passwordField, identity.password);
      if (!result.filledPassword) {
        result.messages.push(t('Unable to populate password field.', '无法填充密码输入框。'));
      }
    } else {
      result.messages.push(t('No password field detected on this page.', '未在页面上检测到密码输入框。'));
    }
  }

  if (!identity.username && !identity.password) {
    result.success = false;
    result.messages.push(
      t('Identity does not contain username or password values to fill.', '该身份未包含可用于填充的用户名或密码。')
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

function createLoginOverlay(identities, initialId, requestOrigin, requestMessage) {
  return new Promise((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.id = LOGIN_OVERLAY_ID;
    overlay.className = 'sdid-login-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'sdid-login-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', t('SDID login request', 'SDID 登录请求'));

    const title = document.createElement('h2');
    title.textContent = t('SDID login request', 'SDID 登录请求');
    dialog.appendChild(title);

    if (requestMessage) {
      const message = document.createElement('p');
      message.className = 'sdid-login-message';
      message.textContent = `${requestMessage}`;
      dialog.appendChild(message);
    }

    if (requestOrigin) {
      const originText = document.createElement('p');
      originText.className = 'sdid-login-origin';
      originText.textContent = `${t('Origin', '请求来源')}: ${requestOrigin}`;
      dialog.appendChild(originText);
    }

    const selectLabel = document.createElement('label');
    selectLabel.className = 'sdid-login-select';

    const selectTitle = document.createElement('span');
    selectTitle.textContent = t('Choose identity', '选择登录身份');
    selectLabel.appendChild(selectTitle);

    const select = document.createElement('select');
    identities.forEach((identity) => {
      const option = document.createElement('option');
      option.value = identity.id;
      option.textContent = identity.label || identity.username || t('Untitled identity', '未命名身份');
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
    rememberText.textContent = t('Remember this site for one-click approvals', '记住此站点，下次一键授权');
    rememberWrapper.appendChild(rememberText);

    const rememberHint = document.createElement('p');
    rememberHint.className = 'sdid-login-hint';
    dialog.appendChild(rememberWrapper);
    dialog.appendChild(rememberHint);

    const actions = document.createElement('div');
    actions.className = 'sdid-login-actions';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'sdid-login-cancel';
    cancelButton.textContent = t('Cancel', '取消');

    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'sdid-login-confirm';
    confirmButton.textContent = t('Confirm', '确认');

    actions.appendChild(cancelButton);
    actions.appendChild(confirmButton);
    dialog.appendChild(actions);

    overlay.appendChild(dialog);
    document.documentElement.appendChild(overlay);

    const previousActiveElement = document.activeElement;
    const initialFocusTarget = identities.length === 1 ? confirmButton : select;
    initialFocusTarget.focus({ preventScroll: true });

    let settled = false;

    const cleanup = (result, shouldReject = false) => {
      if (settled) {
        return;
      }
      settled = true;
      overlay.remove();
      document.removeEventListener('keydown', handleKeydown, true);
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

    const updateSummary = (identityId) => {
      const identity = identities.find((item) => item.id === identityId);
      summary.innerHTML = '';
      if (!identity) {
        rememberCheckbox.checked = true;
        rememberHint.textContent = '';
        return;
      }
      const addLine = (text) => {
        const item = document.createElement('li');
        item.textContent = text;
        summary.appendChild(item);
      };
      addLine(`${t('Identity', '身份')}: ${identity.label || t('Untitled identity', '未命名身份')}`);
      if (identity.did) {
        addLine(`${t('DID', 'DID')}: ${identity.did}`);
      }
      if (identity.roles?.length) {
        addLine(`${t('Roles', '角色')}: ${identity.roles.join(', ')}`);
      }
      if (identity.domain) {
        addLine(`${t('Trusted domain', '信任域名')}: ${identity.domain}`);
      }
      if (identity.username) {
        addLine(`${t('Username', '用户名')}: ${identity.username}`);
      }
      if (identity.notes) {
        addLine(`${t('Notes', '备注')}: ${identity.notes}`);
      }

      if (requestOrigin) {
        const authorized = isOriginAuthorized(identity, requestOrigin);
        rememberCheckbox.checked = !authorized;
        rememberHint.textContent = authorized
          ? t('This site is already authorized. Uncheck to require approval next time.', '当前站点已授权，取消勾选则下次重新确认。')
          : t('Keep this checked to approve future logins instantly.', '保持勾选以便下次自动快速授权。');
      }
    };

    updateSummary(select.value || identities[0]?.id);

    select.addEventListener('change', (event) => {
      updateSummary(event.target.value);
    });

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup({ cancelled: true }, true);
      }
    };

    document.addEventListener('keydown', handleKeydown, true);

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
        message: t('Another login request is already pending. Please complete it first.', '已有其他登录请求正在等待处理，请先完成。'),
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
          message: t('No eligible DID identities are saved in SDID.', 'SDID 中尚未保存可用的 DID 身份。'),
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
          message: t('The selected identity could not be located.', '未找到所选择的身份。'),
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
          ? t('Login request cancelled by user.', '用户已取消登录请求。')
          : t('Login request failed.', '登录请求处理失败。'),
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
    const bridgeScript = document.createElement('script');
    bridgeScript.textContent = `(() => {
      const REQUEST_EVENT = '${LOGIN_REQUEST_EVENT}';
      const RESULT_EVENT = '${LOGIN_RESULT_EVENT}';
      if (window.SDID?.requestLogin) {
        return;
      }
      window.SDID = window.SDID || {};
      window.SDID.requestLogin = function requestLogin(options = {}) {
        const opts = typeof options === 'object' && options !== null ? options : {};
        const requestId = opts.requestId || ('sdid-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2));
        const message = typeof opts.message === 'string' ? opts.message : null;
        const identityId = typeof opts.identityId === 'string' ? opts.identityId : null;
        const timeoutMs = Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : 0;
        const challenge = typeof opts.challenge === 'string' ? opts.challenge : null;
        const forcePrompt = Boolean(opts.forcePrompt);

        return new Promise((resolve, reject) => {
          let timeoutHandle;
          const handleResponse = (event) => {
            if (event.source !== window || !event.data || event.data.type !== RESULT_EVENT) {
              return;
            }
            if (event.data.requestId !== requestId) {
              return;
            }
            window.removeEventListener('message', handleResponse);
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
            }
            if (event.data.success) {
              resolve(event.data);
            } else {
              reject(event.data);
            }
          };

          window.addEventListener('message', handleResponse);
          window.postMessage({ type: REQUEST_EVENT, requestId, message, identityId, challenge, forcePrompt }, '*');

          if (timeoutMs) {
            timeoutHandle = window.setTimeout(() => {
              window.removeEventListener('message', handleResponse);
              reject({ success: false, error: 'TIMEOUT', message: 'SDID request timed out', requestId });
            }, timeoutMs);
          }
        });
      };
      window.dispatchEvent(new Event('sdid#initialized'));
    })();`;
    (document.head || document.documentElement).appendChild(bridgeScript);
    bridgeScript.remove();
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
  return false;
});

window.addEventListener('message', handleLoginRequest);
injectPageBridge();

(function applyStyles() {
  const styleId = 'sdid-identity-style';
  if (document.getElementById(styleId)) {
    return;
  }
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .sdid-identity-filled {
      box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.6);
      transition: box-shadow 0.3s ease;
    }
    .sdid-login-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(2px);
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .sdid-login-dialog {
      background: rgba(15, 23, 42, 0.95);
      color: #f8fafc;
      padding: 24px;
      border-radius: 16px;
      width: min(440px, calc(100% - 32px));
      box-shadow: 0 24px 64px rgba(15, 23, 42, 0.45);
      border: 1px solid rgba(148, 163, 184, 0.2);
    }
    .sdid-login-dialog h2 {
      margin: 0 0 12px;
      font-size: 1.25rem;
      letter-spacing: 0.01em;
    }
    .sdid-login-message {
      margin: 0 0 12px;
      color: rgba(148, 163, 184, 0.95);
      font-size: 0.95rem;
      word-break: break-word;
    }
    .sdid-login-origin {
      margin: 0 0 16px;
      font-size: 0.85rem;
      color: rgba(148, 163, 184, 0.9);
    }
    .sdid-login-select {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 0.95rem;
    }
    .sdid-login-select > span {
      font-weight: 600;
    }
    .sdid-login-select select {
      appearance: none;
      border: 1px solid rgba(148, 163, 184, 0.4);
      border-radius: 12px;
      padding: 8px 12px;
      font-size: 0.95rem;
      background: rgba(15, 23, 42, 0.9);
      color: #e2e8f0;
    }
    .sdid-login-select select:disabled {
      opacity: 0.7;
    }
    .sdid-login-summary {
      list-style: none;
      padding: 0;
      margin: 0 0 16px;
      font-size: 0.85rem;
      color: rgba(226, 232, 240, 0.9);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .sdid-login-remember {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 6px;
      font-size: 0.85rem;
    }
    .sdid-login-remember input {
      width: 18px;
      height: 18px;
      accent-color: #22d3ee;
    }
    .sdid-login-hint {
      margin: 0 0 16px;
      font-size: 0.75rem;
      color: rgba(148, 163, 184, 0.85);
    }
    .sdid-login-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .sdid-login-actions button {
      cursor: pointer;
      border-radius: 9999px;
      border: none;
      font-size: 0.95rem;
      padding: 10px 18px;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease;
    }
    .sdid-login-confirm {
      background: linear-gradient(135deg, #0ea5e9, #22d3ee);
      color: #0f172a;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(14, 165, 233, 0.25);
    }
    .sdid-login-confirm:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 40px rgba(14, 165, 233, 0.35);
    }
    .sdid-login-cancel {
      background: rgba(148, 163, 184, 0.2);
      color: rgba(226, 232, 240, 0.9);
    }
    .sdid-login-cancel:hover {
      background: rgba(148, 163, 184, 0.3);
    }
    @media (max-width: 480px) {
      .sdid-login-dialog {
        padding: 20px;
        width: calc(100% - 24px);
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
