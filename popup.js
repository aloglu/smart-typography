const DEFAULT_SETTINGS = { enabled: true, overrides: {} };

const globalToggle = document.getElementById("global-toggle");
const siteToggle = document.getElementById("site-toggle");
const globalLabel = document.getElementById("global-label");
const siteLabel = document.getElementById("site-label");

let currentSettings = { ...DEFAULT_SETTINGS };
let currentOrigin = null;
let currentHost = "Unknown";
let isUpdatingUI = false;

init();

async function init() {
  const [settings, tab] = await Promise.all([
    browser.storage.local.get(DEFAULT_SETTINGS),
    getActiveTab(),
  ]);

  currentSettings = normalizeSettings(settings);

  const tabInfo = parseURL(tab?.url);
  currentOrigin = tabInfo?.origin || null;
  currentHost = tabInfo?.host || "Unavailable";

  render();
}

globalToggle.addEventListener("change", async () => {
  if (isUpdatingUI) return;
  const enabled = globalToggle.checked;
  currentSettings.enabled = enabled;
  render();
  await browser.storage.local.set({ enabled });
});

siteToggle.addEventListener("change", async () => {
  if (isUpdatingUI || !currentOrigin) return;
  const overrides = { ...(currentSettings.overrides || {}) };
  const isEnabled = siteToggle.checked;

  if (isEnabled) {
    if (currentSettings.enabled) {
      delete overrides[currentOrigin];
    } else {
      overrides[currentOrigin] = "enabled";
    }
  } else {
    overrides[currentOrigin] = "disabled";
  }

  currentSettings.overrides = overrides;
  render();
  await browser.storage.local.set({ overrides });
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  let needsRender = false;

  if (changes.enabled) {
    currentSettings.enabled = changes.enabled.newValue;
    needsRender = true;
  }

  if (changes.overrides) {
    currentSettings.overrides = normalizeOverrides(changes.overrides.newValue);
    needsRender = true;
  }

  if (needsRender) render();
});

function render() {
  isUpdatingUI = true;

  globalToggle.checked = !!currentSettings.enabled;
  globalLabel.textContent = currentSettings.enabled ? "Enabled" : "Disabled";

  if (!currentOrigin) {
    siteToggle.checked = false;
    siteToggle.disabled = true;
    siteLabel.textContent = "Not available on this page";
  } else {
    const override = currentSettings.overrides?.[currentOrigin];
    let siteEnabled;
    if (override === "enabled") {
      siteEnabled = true;
      siteLabel.textContent = `${currentHost} (forced on)`;
    } else if (override === "disabled") {
      siteEnabled = false;
      siteLabel.textContent = `${currentHost} (off)`;
    } else {
      siteEnabled = !!currentSettings.enabled;
      siteLabel.textContent = `${currentHost} (${siteEnabled ? "on" : "off"})`;
    }
    siteToggle.checked = siteEnabled;
    siteToggle.disabled = false;
  }

  isUpdatingUI = false;
}

function getActiveTab() {
  return browser.tabs
    .query({ active: true, currentWindow: true })
    .then((tabs) => tabs[0]);
}

function parseURL(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "moz-extension:" || parsed.origin === "null") {
      return null;
    }
    return { origin: parsed.origin, host: parsed.hostname };
  } catch (err) {
    return null;
  }
}

function normalizeSettings(settings) {
  const overrides = normalizeOverrides(settings.overrides);
  if (settings.disabledOrigins) {
    Object.keys(settings.disabledOrigins).forEach((origin) => {
      overrides[origin] = "disabled";
    });
  }
  return {
    enabled:
      typeof settings.enabled === "boolean"
        ? settings.enabled
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
