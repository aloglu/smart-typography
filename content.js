const DEFAULT_SETTINGS = { enabled: true, overrides: {} };
const PAGE_ORIGIN = getPageOrigin();

let enabled = true;
let settingsCache = { ...DEFAULT_SETTINGS };

browser.storage.local.get(DEFAULT_SETTINGS).then((stored) => {
  settingsCache = normalizeSettings(stored);
  refreshEnabledState();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  let changed = false;
  if (changes.enabled) {
    settingsCache.enabled = changes.enabled.newValue;
    changed = true;
  }
  if (changes.overrides) {
    settingsCache.overrides = normalizeOverrides(changes.overrides.newValue);
    changed = true;
  }
  if (changed) refreshEnabledState();
});

const SMART_QUOTES = {
  single: { open: "‘", close: "’" },
  double: { open: "“", close: "”" },
};

const TEXT_REPLACEMENTS = [
  { from: "...", to: "…" },
  { from: "<=", to: "≤" },
  { from: ">=", to: "≥" },
  { from: "/=", to: "≠" },
  { from: "<<", to: "«" },
  { from: ">>", to: "»" },
  { from: "->", to: "→" },
  { from: "<-", to: "←" },
  { from: "--", to: "—" },
];

const SPECIAL_FRACTIONS = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
  "1/5": "⅕",
  "2/5": "⅖",
  "3/5": "⅗",
  "4/5": "⅘",
  "1/6": "⅙",
  "5/6": "⅚",
  "1/7": "⅐",
  "1/8": "⅛",
  "3/8": "⅜",
  "5/8": "⅝",
  "7/8": "⅞",
  "1/9": "⅑",
  "1/10": "⅒",
};

let suppressInput = false;

const SUPERSCRIPTS = {
  0: "⁰",
  1: "¹",
  2: "²",
  3: "³",
  4: "⁴",
  5: "⁵",
  6: "⁶",
  7: "⁷",
  8: "⁸",
  9: "⁹",
};

const SUBSCRIPTS = {
  0: "₀",
  1: "₁",
  2: "₂",
  3: "₃",
  4: "₄",
  5: "₅",
  6: "₆",
  7: "₇",
  8: "₈",
  9: "₉",
};

document.addEventListener("keydown", (event) => {
  if (!enabled) return;

  const target = event.target;

  if (!isEditable(target)) return;

  // Escape mode: "\" + quote -> raw
  if (event.key === "'" || event.key === '"') {
    if (isEscapeMode()) {
      removePreviousChar();
      return; // insert raw normally
    }
  }

  if (event.key === "'") {
    event.preventDefault();
    insert(getSmartSingleQuote());
  }

  if (event.key === '"') {
    event.preventDefault();
    insert(getSmartDoubleQuote());
  }
});

document.addEventListener("input", (event) => {
  if (!enabled || suppressInput) return;

  const target = event.target;
  if (!isEditable(target)) return;

  applyTextTransforms();
});

// Check if previous char is "\"
function isEscapeMode() {
  const prev = getContextChar();
  return prev === "\\";
}

// Remove previous char (for escape mode)
function removePreviousChar() {
  const el = document.activeElement;
  if (el.isContentEditable) {
    document.execCommand("delete", false);
  } else {
    const pos = el.selectionStart;
    el.value = el.value.slice(0, pos - 1) + el.value.slice(pos);
    el.selectionStart = el.selectionEnd = pos - 1;
  }
}

// -------------------- Smart Quote Logic --------------------

function getSmartSingleQuote() {
  const prev = getContextChar();

  if (/[A-Za-z0-9]/.test(prev)) {
    return SMART_QUOTES.single.close;
  }

  return isOpeningContext(prev)
    ? SMART_QUOTES.single.open
    : SMART_QUOTES.single.close;
}

function getSmartDoubleQuote() {
  const prev = getContextChar();

  if (insideDoubleQuotes()) {
    return SMART_QUOTES.double.close;
  }

  return isOpeningContext(prev)
    ? SMART_QUOTES.double.open
    : SMART_QUOTES.double.close;
}

function isOpeningContext(char) {
  return char === "" || /\s/.test(char) || /[\(\[\{“‘-]/.test(char);
}

// Count “double quotes” to see if we're inside or outside
function insideDoubleQuotes() {
  const text = getAllTextBeforeCursor();
  const count = (text.match(/[“”]/g) || []).length;
  return count % 2 === 1;
}

// -------------------- Text insertion helpers --------------------

function getContextChar() {
  const el = document.activeElement;

  if (el.isContentEditable) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return "";
    const range = sel.getRangeAt(0).cloneRange();
    range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
    return range.toString();
  } else {
    const pos = el.selectionStart;
    return pos > 0 ? el.value[pos - 1] : "";
  }
}

function getAllTextBeforeCursor() {
  const el = document.activeElement;

  if (el.isContentEditable) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return "";
    const range = sel.getRangeAt(0).cloneRange();
    range.setStart(el, 0);
    return range.toString();
  } else {
    return el.value.slice(0, el.selectionStart);
  }
}

function insert(char) {
  const el = document.activeElement;

  if (el.isContentEditable) {
    document.execCommand("insertText", false, char);
  } else {
    const [start, end] = [el.selectionStart, el.selectionEnd];
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    el.value = before + char + after;
    el.selectionStart = el.selectionEnd = start + char.length;
  }
}

function applyTextTransforms() {
  const text = getAllTextBeforeCursor();
  if (!text) return;

  for (const { from, to } of TEXT_REPLACEMENTS) {
    if (text.endsWith(from)) {
      withSuppressedInput(() => replaceTextBeforeCursor(from.length, to));
      return;
    }
  }

  const fractionMatch = text.match(/(\d+)\/(\d+)$/);
  if (!fractionMatch) return;

  const [, numerator, denominator] = fractionMatch;
  const replacement = formatFraction(numerator, denominator);
  if (replacement) {
    withSuppressedInput(() =>
      replaceTextBeforeCursor(fractionMatch[0].length, replacement),
    );
  }
}

function replaceTextBeforeCursor(length, replacement) {
  const el = document.activeElement;
  if (!el) return;

  if (!el.isContentEditable) {
    if (
      typeof el.selectionStart !== "number" ||
      typeof el.selectionEnd !== "number"
    ) {
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const replaceStart = start - length;
    if (replaceStart < 0) return;
    const before = el.value.slice(0, replaceStart);
    const after = el.value.slice(end);
    el.value = before + replacement + after;
    const caret = replaceStart + replacement.length;
    el.selectionStart = el.selectionEnd = caret;
    return;
  }

  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  const range = selection.getRangeAt(0);

  if (
    range.startContainer.nodeType === Node.TEXT_NODE &&
    range.startOffset >= length
  ) {
    range.setStart(range.startContainer, range.startOffset - length);
    document.execCommand("insertText", false, replacement);
    return;
  }

  if (typeof selection.modify === "function") {
    try {
      for (let i = 0; i < length; i++) {
        selection.modify("extend", "backward", "character");
      }
      document.execCommand("insertText", false, replacement);
    } catch (err) {
      selection.collapseToEnd();
    }
  }
}

function withSuppressedInput(callback) {
  suppressInput = true;
  try {
    callback();
  } finally {
    suppressInput = false;
  }
}

function isEditable(target) {
  if (!target) return false;
  return (
    target.isContentEditable ||
    (target.tagName && ["INPUT", "TEXTAREA"].includes(target.tagName))
  );
}

function toSuperscript(text) {
  return text
    .split("")
    .map((char) => SUPERSCRIPTS[char] || char)
    .join("");
}

function toSubscript(text) {
  return text
    .split("")
    .map((char) => SUBSCRIPTS[char] || char)
    .join("");
}

function formatFraction(numerator, denominator) {
  const key = `${numerator}/${denominator}`;
  if (SPECIAL_FRACTIONS[key]) return SPECIAL_FRACTIONS[key];
  return `${toSuperscript(numerator)}⁄${toSubscript(denominator)}`;
}

function refreshEnabledState() {
  const overrides = settingsCache.overrides || {};
  if (PAGE_ORIGIN) {
    const override = overrides[PAGE_ORIGIN];
    if (override === "enabled") {
      enabled = true;
      return;
    }
    if (override === "disabled") {
      enabled = false;
      return;
    }
  }
  enabled = settingsCache.enabled;
}

function normalizeSettings(stored) {
  const overrides = normalizeOverrides(stored.overrides);
  if (stored.disabledOrigins) {
    Object.keys(stored.disabledOrigins).forEach((origin) => {
      overrides[origin] = "disabled";
    });
  }
  return {
    enabled:
      typeof stored.enabled === "boolean"
        ? stored.enabled
        : DEFAULT_SETTINGS.enabled,
    overrides,
  };
}

function getPageOrigin() {
  try {
    const parsed = new URL(window.location.href);
    return parsed.origin === "null" ? null : parsed.origin;
  } catch (err) {
    return null;
  }
}

function normalizeOverrides(raw) {
  const overrides = {};
  if (!raw) return overrides;
  Object.keys(raw).forEach((origin) => {
    const value = raw[origin];
    if (value === "enabled" || value === "disabled") {
      overrides[origin] = value;
    } else if (value === true) {
      overrides[origin] = "enabled";
    } else if (value === false) {
      overrides[origin] = "disabled";
    }
  });
  return overrides;
}
