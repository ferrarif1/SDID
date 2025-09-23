const usernameKeywords = ['user', 'email', 'login', 'account', 'identifier', 'phone'];
const passwordKeywords = ['pass', 'password', 'secret', 'pin', 'code'];

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
    return { success: false, reason: 'Missing identity payload.' };
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
        result.messages.push('Unable to populate username field.');
      }
    } else {
      result.messages.push('No username field detected on this page.');
    }
  }

  if (identity.password) {
    const passwordField =
      findInputByKeywords(passwordKeywords, 'input[type="password"], input[type="text"], input[type="tel"], input') ||
      document.querySelector('input[type="password"]');
    if (passwordField) {
      result.filledPassword = fillElementValue(passwordField, identity.password);
      if (!result.filledPassword) {
        result.messages.push('Unable to populate password field.');
      }
    } else {
      result.messages.push('No password field detected on this page.');
    }
  }

  if (!identity.username && !identity.password) {
    result.success = false;
    result.messages.push('Identity does not contain username or password values to fill.');
  }

  if (!result.filledUsername && !result.filledPassword) {
    result.success = false;
  }

  return result;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'fill-identity') {
    const outcome = fillIdentity(message.identity);
    sendResponse(outcome);
    return true;
  }
  return false;
});

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
  `;
  document.documentElement.appendChild(style);
})();
