const registry = new Set();
let resizeScheduled = false;
let rafHandle = null;

function scheduleAllFits() {
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
  }
  rafHandle = requestAnimationFrame(() => {
    rafHandle = null;
    registry.forEach((entry) => applyFit(entry));
  });
}

function ensureResizeListener() {
  if (resizeScheduled) {
    return;
  }
  resizeScheduled = true;
  window.addEventListener('resize', () => {
    scheduleAllFits();
  });
}

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getLineHeight(style) {
  const raw = style.lineHeight;
  if (!raw || raw === 'normal') {
    const fontSize = toNumber(style.fontSize);
    return fontSize ? fontSize * 1.4 : 16;
  }
  return toNumber(raw);
}

function restoreOriginal(entry) {
  const { element } = entry;
  const original = element.dataset.fullText ?? element.textContent ?? '';
  element.dataset.fullText = original;
  element.textContent = original;
  if (entry.options.preserveTitle !== false && original) {
    element.title = original;
  }
  return original;
}

function fitSingleLine(entry, original, style) {
  const { element, options } = entry;
  const ellipsis = options.ellipsis || '…';
  const availableWidth = element.clientWidth;
  if (availableWidth <= 0) {
    return;
  }
  element.textContent = original;
  if (element.scrollWidth <= availableWidth) {
    return;
  }

  let low = 0;
  let high = original.length;
  let best = '';
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = original.slice(0, mid).trimEnd() + ellipsis;
    element.textContent = candidate;
    if (element.scrollWidth <= availableWidth) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  element.textContent = best || ellipsis;
}

function fitMultiLine(entry, original, style) {
  const { element, options } = entry;
  const ellipsis = options.ellipsis || '…';
  const maxLines = Math.max(2, Number.parseInt(options.maxLines, 10) || 2);
  const lineHeight = getLineHeight(style);
  const padding = toNumber(style.paddingTop) + toNumber(style.paddingBottom);
  const maxHeight = lineHeight * maxLines + padding + 1;

  element.style.display = '-webkit-box';
  element.style.webkitBoxOrient = 'vertical';
  element.style.webkitLineClamp = String(maxLines);
  element.style.overflow = 'hidden';
  element.textContent = original;

  if (element.scrollHeight <= maxHeight) {
    return;
  }

  const words = options.respectWords === false ? null : original.trim().split(/\s+/);
  if (words && words.length > 1) {
    let low = 0;
    let high = words.length;
    let best = '';
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = words.slice(0, mid).join(' ').trimEnd() + ellipsis;
      element.textContent = candidate;
      if (element.scrollHeight <= maxHeight) {
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    element.textContent = best || ellipsis;
    return;
  }

  let low = 0;
  let high = original.length;
  let best = '';
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = original.slice(0, mid).trimEnd() + ellipsis;
    element.textContent = candidate;
    if (element.scrollHeight <= maxHeight) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  element.textContent = best || ellipsis;
}

function applyFit(entry) {
  const { element, options } = entry;
  if (!element || !element.isConnected) {
    registry.delete(entry);
    return;
  }
  const original = restoreOriginal(entry);
  if (!original) {
    return;
  }
  const style = window.getComputedStyle(element);
  if ((options.maxLines || 1) > 1) {
    fitMultiLine(entry, original, style);
  } else {
    fitSingleLine(entry, original, style);
  }
}

export function registerTextFit(element, options = {}) {
  if (!element) {
    return;
  }
  const entry = { element, options: { ellipsis: '…', preserveTitle: true, ...options } };
  registry.add(entry);
  ensureResizeListener();
  queueMicrotask(() => {
    scheduleAllFits();
  });
  return () => {
    registry.delete(entry);
  };
}

export function recalibrateTextFits() {
  scheduleAllFits();
}

export function fitTextNow(element, options = {}) {
  if (!element) {
    return;
  }
  const tempEntry = { element, options: { ellipsis: '…', preserveTitle: true, ...options } };
  applyFit(tempEntry);
}

