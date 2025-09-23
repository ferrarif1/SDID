const connectButton = document.getElementById('connect');
const forceButton = document.getElementById('force');
const statusElement = document.getElementById('status');
const identityElement = document.getElementById('identity');
const verificationElement = document.getElementById('verification');

const t = (en, zh) => `${en}｜${zh}`;

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.style.color = isError ? '#fca5a5' : '#5eead4';
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
    authorized: response.authorized,
    remembered: response.remembered,
    fill: response.fill
  };
  return JSON.stringify(payload, null, 2);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function verifySignature(identity, challenge, signature) {
  if (!identity?.publicKeyJwk || !signature || !challenge) {
    return { verified: false, message: t('Missing public key or signature.', '缺少公钥或签名。') };
  }
  try {
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      identity.publicKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    const signatureBuffer = base64ToArrayBuffer(signature);
    const data = new TextEncoder().encode(challenge);
    const verified = await crypto.subtle.verify({ name: 'ECDSA', hash: { name: 'SHA-256' } }, publicKey, signatureBuffer, data);
    return {
      verified,
      message: verified
        ? t('Signature verified successfully.', '签名验证通过。')
        : t('Signature verification failed.', '签名验证失败。')
    };
  } catch (error) {
    console.error('Signature verification error', error);
    return {
      verified: false,
      message: t('Unable to verify signature. Check the console for details.', '无法验证签名，请查看控制台日志。')
    };
  }
}

function renderVerification(result) {
  verificationElement.innerHTML = '';
  if (!result) {
    return;
  }
  const paragraph = document.createElement('p');
  paragraph.textContent = result.message;
  paragraph.className = result.verified ? 'success' : 'error';
  verificationElement.appendChild(paragraph);
}

function renderIdentity(response) {
  identityElement.textContent = formatIdentityPayload(response);
}

function disableButtons(disabled) {
  connectButton.disabled = disabled;
  forceButton.disabled = disabled;
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

async function requestLogin(forcePrompt = false) {
  disableButtons(true);
  verificationElement.innerHTML = '';
  renderIdentity(null);
  setStatus(t('Requesting approval…', '正在请求授权…'));
  try {
    const sdid = await waitForSdid();
    const challenge = createChallenge();
    const response = await sdid.requestLogin({
      message: t('Demo dApp requests access', '演示应用请求访问'),
      challenge,
      forcePrompt
    });
    renderIdentity(response);
    const verification = await verifySignature(response.identity, response.challenge, response.signature);
    renderVerification(verification);
    const label = response.identity?.label || response.identity?.did || t('unknown identity', '未知身份');
    setStatus(t(`Connected as ${label}`, `已连接身份：${label}`));
  } catch (error) {
    console.error('Demo login failed', error);
    const message = error?.message || t('Login was rejected.', '登录请求被拒绝。');
    setStatus(message, true);
    renderVerification({ verified: false, message });
  } finally {
    disableButtons(false);
  }
}

connectButton.addEventListener('click', () => requestLogin(false));
forceButton.addEventListener('click', () => requestLogin(true));

if (!window.SDID?.requestLogin) {
  setStatus(t('Waiting for SDID extension…', '等待 SDID 扩展…'));
  window.addEventListener(
    'sdid#initialized',
    () => setStatus(t('SDID ready. Click connect to begin.', 'SDID 已就绪，点击按钮开始体验。')),
    { once: true }
  );
} else {
  setStatus(t('SDID ready. Click connect to begin.', 'SDID 已就绪，点击按钮开始体验。'));
}
