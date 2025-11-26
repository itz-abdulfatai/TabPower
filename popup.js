async function setExtensionTitleFromManifest() {
  try {
    const manifest = browser.runtime.getManifest();
    const titleEl = document.getElementById("title");
    if (manifest && manifest.name && titleEl)
      titleEl.textContent = manifest.name;
  } catch (e) {}
}
async function applyBrowserTheme() {
  // graceful: if API missing or returns nothing, do nothing (CSS fallback takes over)
  try {
    if (
      browser &&
      browser.theme &&
      typeof browser.theme.getCurrent === "function"
    ) {
      const themeInfo = await browser.theme.getCurrent();
      if (themeInfo && themeInfo.colors) {
        const c = themeInfo.colors;
        // popup is the panel background; popup_text is the text color inside panels
        if (c.popup)
          document.documentElement.style.setProperty("--popup-bg", c.popup);
        if (c.popup_text)
          document.documentElement.style.setProperty(
            "--popup-text",
            c.popup_text
          );
        if (c.popup_border)
          document.documentElement.style.setProperty(
            "--popup-border",
            c.popup_border
          );

        // optional: pull toolbar/frame as accent if popup not provided
        if (!c.popup && c.toolbar)
          document.documentElement.style.setProperty("--popup-bg", c.toolbar);
        if (!c.popup_text && c.toolbar_text)
          document.documentElement.style.setProperty(
            "--popup-text",
            c.toolbar_text
          );

        // small accessibility tweak: if popup_text not provided, try to pick a readable value
        // (you could extend this to compute contrast and switch to white/black accordingly)
      }
    }
  } catch (e) {
    // ignore problems; CSS fallback will be used
  }
}

async function updateUI(isBlocked, hostname, whitelistEnabled) {
  const btn = document.getElementById("power");
  const label = document.getElementById("label");
  const cb = document.getElementById("whitelistCheckbox");

  if (isBlocked) {
    btn.classList.remove("on");
    btn.classList.add("off");
    btn.style.background = "crimson";
    label.textContent = "internet off for this tab";
  } else {
    btn.classList.remove("off");
    btn.classList.add("on");
    btn.style.background = "seagreen";
    label.textContent = "internet on for this tab";
  }

  if (hostname) {
    cb.checked = !!whitelistEnabled;
    cb.disabled = false;
  } else {
    cb.checked = false;
    cb.disabled = true;
  }
}

async function getHostname(tab) {
  try {
    if (!tab || !tab.url) return null;
    const url = new URL(tab.url);
    return url.hostname;
  } catch (e) {
    return null;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await applyBrowserTheme();
  await setExtensionTitleFromManifest();
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    updateUI(false, null, false);
    return;
  }

  const hostname = await getHostname(tab);

  const status = await browser.runtime.sendMessage({
    action: "status",
    tabId: tab.id,
  });
  const wl = hostname
    ? await browser.runtime.sendMessage({
        action: "getWhitelistStatus",
        hostname,
      })
    : { enabled: false };

  updateUI(Boolean(status.blocked), hostname, Boolean(wl.enabled));

  const btn = document.getElementById("power");
  btn.addEventListener("click", async () => {
    const res = await browser.runtime.sendMessage({
      action: "toggle",
      tabId: tab.id,
    });
    // if excluded, show that message locally too
    if (res && res.excluded) {
      updateUI(false, hostname, true);
      return;
    }
    updateUI(Boolean(res.blocked), hostname, Boolean(wl.enabled));
  });

  const cb = document.getElementById("whitelistCheckbox");
  cb.addEventListener("change", async (e) => {
    const enable = e.target.checked;
    if (!hostname) return;
    await browser.runtime.sendMessage({
      action: "toggleWhitelist",
      hostname,
      enable,
    });
    // reflect immediate change
    const wl2 = await browser.runtime.sendMessage({
      action: "getWhitelistStatus",
      hostname,
    });
    updateUI(Boolean(status.blocked), hostname, Boolean(wl2.enabled));
  });
});
