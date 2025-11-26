// background.js
const blockedTabs = new Set();
let whitelist = new Set();

async function loadState() {
  const data = await browser.storage.local.get(["blockedTabs", "whitelist"]);
  if (Array.isArray(data.blockedTabs))
    data.blockedTabs.forEach((id) => blockedTabs.add(id));
  if (Array.isArray(data.whitelist))
    data.whitelist.forEach((h) => whitelist.add(h));
  // restore badges for currently open tabs
  const tabs = await browser.tabs.query({});
  for (const t of tabs) {
    updateBadgeForTab(t.id);
  }
}

function saveBlocked() {
  browser.storage.local.set({ blockedTabs: [...blockedTabs] });
}

function saveWhitelist() {
  browser.storage.local.set({ whitelist: [...whitelist] });
}

function updateBadgeForTab(tabId) {
  if (blockedTabs.has(tabId)) {
    browser.browserAction.setBadgeText({ text: "OFF", tabId });
    browser.browserAction.setBadgeBackgroundColor({ color: "#cc2222", tabId });
  } else {
    browser.browserAction.setBadgeText({ text: "", tabId });
  }
}

function showVisual(tabId, text, color) {
  browser.tabs
    .sendMessage(tabId, {
      action: "toast",
      text,
      color,
    })
    .catch(() => {});
}

function playSound(tabId, tone) {
  // tell content script to play sound
  browser.tabs
    .sendMessage(tabId, {
      action: "sound",
      tone,
    })
    .catch(() => {});
}

// WebRequest: cancel when tab is in blockedTabs
browser.webRequest.onBeforeRequest.addListener(
  function (details) {
    // ignore requests not associated with a tab
    if (!details.tabId || details.tabId < 0) return {};
    if (blockedTabs.has(details.tabId)) {
      return { cancel: true };
    }
    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

// Toggle or return status from popup or commands
browser.runtime.onMessage.addListener(async (msg, sender) => {
  if (!msg || !msg.action) return {};

  if (msg.action === "toggle") {
    const tabId = msg.tabId;
    const tab = await browser.tabs.get(tabId).catch(() => null);
    const hostname = tab && tab.url ? new URL(tab.url).hostname : null;

    if (blockedTabs.has(tabId)) {
      blockedTabs.delete(tabId);
      saveBlocked();
      updateBadgeForTab(tabId);
      showVisual(tabId, "Internet ON", "seagreen");
      playSound(tabId, "on");
      return { blocked: false };
    } else {
      // if current hostname is in whitelist, do not block
      if (hostname && whitelist.has(hostname)) {
        showVisual(tabId, "Site excluded (whitelist)", "#f39c12");
        playSound(tabId, "blocked-excluded");
        return { blocked: false, excluded: true };
      }
      blockedTabs.add(tabId);
      saveBlocked();
      updateBadgeForTab(tabId);
      showVisual(tabId, "Internet OFF", "crimson");
      playSound(tabId, "off");
      return { blocked: true };
    }
  }

  if (msg.action === "status") {
    return { blocked: blockedTabs.has(msg.tabId) };
  }

  if (msg.action === "toggleWhitelist") {
    const { hostname, enable } = msg;
    if (!hostname) return { ok: false };
    if (enable) {
      whitelist.add(hostname);
    } else {
      whitelist.delete(hostname);
    }
    saveWhitelist();
    // If enabling whitelist for current hostname, ensure any tabs on that host are unblocked
    const tabs = await browser.tabs.query({});
    for (const t of tabs) {
      try {
        const h = t.url ? new URL(t.url).hostname : null;
        if (h === hostname && blockedTabs.has(t.id)) {
          blockedTabs.delete(t.id);
          updateBadgeForTab(t.id);
          showVisual(t.id, "Unblocked: whitelist added", "seagreen");
        }
      } catch (e) {}
    }
    saveBlocked();
    return { ok: true };
  }

  if (msg.action === "getWhitelistStatus") {
    return { enabled: whitelist.has(msg.hostname) };
  }

  return {};
});

// Clean up when tab closes
browser.tabs.onRemoved.addListener((tabId) => {
  if (blockedTabs.has(tabId)) {
    blockedTabs.delete(tabId);
    saveBlocked();
  }
  // clean badge
  browser.browserAction.setBadgeText({ text: "", tabId });
});

// If tab navigates, auto-unblock if host is whitelisted
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && blockedTabs.has(tabId)) {
    try {
      const host = new URL(changeInfo.url).hostname;
      if (whitelist.has(host)) {
        blockedTabs.delete(tabId);
        saveBlocked();
        updateBadgeForTab(tabId);
        showVisual(
          tabId,
          "Unblocked: navigated to whitelisted site",
          "seagreen"
        );
      }
    } catch (e) {}
  }
});

// update badge on activation
browser.tabs.onActivated.addListener(async (activeInfo) => {
  updateBadgeForTab(activeInfo.tabId);
});

// Keyboard shortcut via commands
browser.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-tab") {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return;
    const res = await browser.runtime.sendMessage({
      action: "toggle",
      tabId: tab.id,
    });
    // update badge handled by toggle
  }
});

loadState();
