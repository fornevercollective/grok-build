/**
 * Mobile / PWA / local tricks:
 *  - service worker registration
 *  - pull-to-refresh
 *  - offline banner
 *  - install prompt
 *  - lazy-load docs (IntersectionObserver + SW cache)
 *  - visual viewport safe areas
 */
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  /* Service worker */
  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    // only on http(s) — works on 127.0.0.1
    if (location.protocol === "file:") return;
    navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch((err) => console.warn("[pwa] sw", err));
  }

  /* Offline banner */
  function syncOnline() {
    const b = $("offline-banner");
    if (!b) return;
    b.hidden = navigator.onLine;
  }

  /* Pull to refresh */
  function setupPtr() {
    const ind = $("ptr-indicator");
    const label = $("ptr-label");
    if (!ind) return;
    let startY = 0;
    let pulling = false;
    const threshold = 72;

    function onStart(e) {
      if (window.scrollY > 2) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      startY = t.clientY;
      pulling = true;
    }
    function onMove(e) {
      if (!pulling) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const dy = t.clientY - startY;
      if (dy < 8 || window.scrollY > 2) {
        ind.classList.remove("show", "ready");
        return;
      }
      e.preventDefault();
      ind.classList.add("show");
      ind.style.setProperty("--ptr", Math.min(dy, 120) + "px");
      if (dy > threshold) {
        ind.classList.add("ready");
        if (label) label.textContent = "Release to refresh";
      } else {
        ind.classList.remove("ready");
        if (label) label.textContent = "Pull to refresh";
      }
    }
    function onEnd() {
      if (!pulling) return;
      pulling = false;
      const ready = ind.classList.contains("ready");
      ind.classList.remove("show", "ready");
      ind.style.removeProperty("--ptr");
      if (label) label.textContent = "Pull to refresh";
      if (ready) doRefresh();
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
  }

  async function doRefresh() {
    const label = $("ptr-label");
    if (label) label.textContent = "Refreshing…";
    $("ptr-indicator")?.classList.add("show");
    try {
      // bust SW for nav + content
      if (navigator.serviceWorker?.controller) {
        // soft reload of active tool/docs
      }
      if (window.LabTools) {
        if (document.body.classList.contains("mode-tools")) {
          window.LabTools.refreshTerminal?.();
          window.LabTools.refreshHistory?.();
        }
      }
      // reload current doc page from network
      const article = document.getElementById("article");
      if (article && location.hash && !location.hash.startsWith("#/tool/")) {
        // trigger app.js reload by re-setting hash
        const h = location.hash;
        location.hash = "";
        location.hash = h;
      }
      // process snapshot
      await fetch("/api/health", { cache: "no-store" }).catch(() => {});
    } finally {
      setTimeout(() => {
        $("ptr-indicator")?.classList.remove("show");
        if (label) label.textContent = "Pull to refresh";
      }, 400);
    }
  }

  /* Lazy load: prefetch visible nav links' content when idle */
  function setupLazyPrefetch() {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const a = en.target;
          const id = a.dataset.id;
          if (!id) return;
          // warm cache
          fetch("content/" + id + ".md", { cache: "force-cache" }).catch(() => {});
          io.unobserve(a);
        });
      },
      { rootMargin: "80px" }
    );
    // observe after nav renders
    const watch = () => {
      document.querySelectorAll("#nav .nav-item[data-id]").forEach((a) => io.observe(a));
    };
    setTimeout(watch, 600);
    setTimeout(watch, 2000);
  }

  /* Install prompt */
  let deferredPrompt = null;
  function setupInstall() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallChip();
    });
  }

  function showInstallChip() {
    if (document.getElementById("pwa-install")) return;
    const chip = document.createElement("button");
    chip.id = "pwa-install";
    chip.type = "button";
    chip.className = "pwa-install-chip";
    chip.textContent = "Install app";
    chip.onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      chip.remove();
    };
    document.querySelector(".app-tabs")?.appendChild(chip);
  }

  /* Share API for current page */
  function setupShare() {
    if (!navigator.share) return;
    const tabs = document.querySelector(".app-tabs");
    if (!tabs || document.getElementById("pwa-share")) return;
    const b = document.createElement("button");
    b.id = "pwa-share";
    b.type = "button";
    b.className = "app-tab";
    b.textContent = "Share";
    b.onclick = () => {
      navigator
        .share({
          title: document.title,
          url: location.href,
          text: "Grok Build Grok Build Lab",
        })
        .catch(() => {});
    };
    tabs.appendChild(b);
  }

  function bind() {
    registerSW();
    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    setupPtr();
    setupLazyPrefetch();
    setupInstall();
    setupShare();

    // keyboard refresh
    window.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "r" && e.shiftKey) {
        e.preventDefault();
        doRefresh();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
