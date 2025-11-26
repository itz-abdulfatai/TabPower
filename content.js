// content.js (injected into every page)
(function () {
  // base64 small tones (2 simple beeps). These are short data URIs so no external files.
  const tones = {
    on: "data:audio/wav;base64,UklGRkQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAAAgD8A/wD/AAAA/wAAAP8AAAD/AAAA/wAAAP8A",
    off: "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAAAjz8jP4k/Iz+JPyM/",
    "blocked-excluded":
      "data:audio/wav;base64,UklGRmIAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAAA////",
  };

  function playTone(which) {
    const src = tones[which];
    if (!src) return;
    try {
      const audio = new Audio(src);
      audio.volume = 0.85;
      audio.play().catch(() => {
        // may be blocked by autoplay policies until user interacts with page
      });
    } catch (e) {}
  }

  function showToast(text, color) {
    const old = document.getElementById("__tabpower_toast");
    if (old) old.remove();

    const div = document.createElement("div");
    div.id = "__tabpower_toast";
    div.textContent = text;
    div.style.position = "fixed";
    div.style.top = "18px";
    div.style.right = "18px";
    div.style.padding = "12px 18px";
    div.style.background = color || "seagreen";
    div.style.color = "white";
    div.style.fontSize = "15px";
    div.style.borderRadius = "10px";
    div.style.zIndex = "2147483647";
    div.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
    div.style.opacity = "0";
    div.style.transform = "translateY(-10px)";
    div.style.transition = "opacity 220ms ease, transform 220ms ease";

    document.body.appendChild(div);

    requestAnimationFrame(() => {
      div.style.opacity = "1";
      div.style.transform = "translateY(0)";
    });

    setTimeout(() => {
      div.style.opacity = "0";
      div.style.transform = "translateY(-10px)";
      setTimeout(() => {
        if (div.parentElement) div.remove();
      }, 250);
    }, 1400);
  }

  browser.runtime.onMessage.addListener((msg) => {
    if (!msg || !msg.action) return;
    if (msg.action === "toast") {
      showToast(msg.text, msg.color);
    }
    if (msg.action === "sound") {
      playTone(msg.tone);
    }
  });
})();
