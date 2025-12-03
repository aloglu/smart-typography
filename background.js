const DEFAULT_SETTINGS = { enabled: true, overrides: {} };
const action = browser.action || browser.browserAction;
const LINE_COLORS = {
  enabled: "#16a34a",
  disabled: "#dc2626",
};
const ICON_SIZES = [32, 64, 128];
const ICON_STATE_IMAGES = { enabled: {}, disabled: {} };
const iconsReady = preloadIconVariants();

let settingsCache = { ...DEFAULT_SETTINGS };

browser.storage.local.get(DEFAULT_SETTINGS).then((stored) => {
  settingsCache = normalizeSettings(stored);
  refreshAllBadges();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  let updated = false;
  if (changes.enabled) {
    settingsCache.enabled = changes.enabled.newValue;
    updated = true;
  }
  if (changes.overrides) {
    settingsCache.overrides = normalizeOverrides(changes.overrides.newValue);
    updated = true;
  }
  if (updated) {
    refreshAllBadges();
  }
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" || changeInfo.url) {
    updateBadgeForTab(tabId, tab?.url);
  }
});

browser.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await browser.tabs.get(tabId);
    updateBadgeForTab(tabId, tab?.url);
  } catch (err) {
    // ignore tabs we can't access
  }
});

function refreshAllBadges() {
  browser.tabs.query({}).then((tabs) => {
    tabs.forEach((tab) => updateBadgeForTab(tab.id, tab.url));
  });
}

function updateBadgeForTab(tabId, url) {
  if (typeof tabId !== "number") return;
  const isEnabled = isPageEnabled(url);
  setIconState(tabId, isEnabled);
}

function isPageEnabled(url) {
  const origin = extractOrigin(url);
  if (origin) {
    const override = settingsCache.overrides?.[origin];
    if (override === "enabled") return true;
    if (override === "disabled") return false;
  }
  return !!settingsCache.enabled;
}

function extractOrigin(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "moz-extension:" ||
      parsed.origin === "null" ||
      parsed.protocol === "about:"
    ) {
      return null;
    }
    return parsed.origin;
  } catch (err) {
    return null;
  }
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

function setIconState(tabId, isEnabled) {
  if (typeof tabId !== "number") return;
  iconsReady
    .then(() => {
      const state = isEnabled ? "enabled" : "disabled";
      action.setIcon({ tabId, imageData: ICON_STATE_IMAGES[state] });
      action.setBadgeText({ text: "", tabId });
    })
    .catch(() => {});
}

function preloadIconVariants() {
  return Promise.all(
    ICON_SIZES.map(async (size) => {
      const baseUrl = browser.runtime.getURL(`icons/icon-${size}.png`);
      const bitmap = await loadBitmap(baseUrl);
      ICON_STATE_IMAGES.enabled[size] = drawLine(
        bitmap,
        size,
        LINE_COLORS.enabled,
      );
      ICON_STATE_IMAGES.disabled[size] = drawLine(
        bitmap,
        size,
        LINE_COLORS.disabled,
      );
    }),
  );
}

async function loadBitmap(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

function drawLine(bitmap, size, color) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(bitmap, 0, 0, size, size);
  const lineHeight = Math.max(2, Math.round(size * 0.08));
  const lineWidth = Math.round(size * 0.55);
  const x = Math.round((size - lineWidth) / 2);
  const y = size - lineHeight;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, lineWidth, lineHeight);
  return ctx.getImageData(0, 0, size, size);
}

function createCanvas(size) {
  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(size, size);
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  return canvas;
}
