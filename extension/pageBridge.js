(() => {
  const currentScript = document.currentScript;
  const requestEvent = currentScript?.dataset?.requestEvent || 'SDID_REQUEST_LOGIN';
  const resultEvent = currentScript?.dataset?.resultEvent || 'SDID_LOGIN_RESULT';

  if (window.SDID?.requestLogin) {
    return;
  }

  window.SDID = window.SDID || {};

  window.SDID.requestLogin = function requestLogin(options = {}) {
    const opts = typeof options === 'object' && options !== null ? options : {};
    const requestId = opts.requestId || `sdid-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
    const message = typeof opts.message === 'string' ? opts.message : null;
    const identityId = typeof opts.identityId === 'string' ? opts.identityId : null;
    const timeoutMs = Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : 0;
    const challenge = typeof opts.challenge === 'string' ? opts.challenge : null;
    const forcePrompt = Boolean(opts.forcePrompt);

    return new Promise((resolve, reject) => {
      let timeoutHandle;

      const handleResponse = (event) => {
        if (event.source !== window || !event.data || event.data.type !== resultEvent) {
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
      window.postMessage(
        { type: requestEvent, requestId, message, identityId, challenge, forcePrompt },
        '*'
      );

      if (timeoutMs) {
        timeoutHandle = window.setTimeout(() => {
          window.removeEventListener('message', handleResponse);
          reject({ success: false, error: 'TIMEOUT', message: 'SDID request timed out', requestId });
        }, timeoutMs);
      }
    });
  };

  window.dispatchEvent(new Event('sdid#initialized'));
})();
