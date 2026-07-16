/**
 * Auto-load on deploy updates — local serve.sh + GitHub Pages.
 * Polls ./version.json; when sha changes, reloads (after optional toast).
 */
(function () {
  "use strict";

  const POLL_MS = 20000;
  const LS_SHA = "lab.version.sha";
  let known = null;
  let timer = 0;
  let reloading = false;

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg, ms) {
    let el = $("lab-update-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "lab-update-toast";
      el.className = "lab-update-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    el.hidden = false;
    if (ms) {
      setTimeout(() => {
        el.classList.remove("show");
      }, ms);
    }
  }

  function setMeta(v) {
    const el = $("lab-version-meta");
    if (!el || !v) return;
    const short = v.short || (v.sha && String(v.sha).slice(0, 7)) || "—";
    const src = v.source || "";
    el.textContent = src ? short + " · " + src : short;
    el.title = [
      v.sha || "",
      v.ref || "",
      v.built_at || "",
      v.url || location.origin + location.pathname,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function fetchVersion() {
    const r = await fetch("./version.json?_=" + Date.now(), {
      cache: "no-store",
    });
    if (!r.ok) throw new Error("version " + r.status);
    return r.json();
  }

  function hardReload() {
    if (reloading) return;
    reloading = true;
    // Drop SW caches then reload so Pages/local both get fresh shell
    const done = () => {
      location.reload();
    };
    if (navigator.serviceWorker?.getRegistrations) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {})
        .then(() => {
          if (window.caches?.keys) {
            return caches.keys().then((keys) =>
              Promise.all(keys.map((k) => caches.delete(k)))
            );
          }
        })
        .then(done, done);
    } else {
      done();
    }
  }

  async function check(isFirst) {
    try {
      const v = await fetchVersion();
      const sha = String(v.sha || v.short || "");
      if (!sha) return;
      setMeta(v);

      if (isFirst || known === null) {
        known = sha;
        try {
          localStorage.setItem(LS_SHA, sha);
        } catch (_) {}
        // First paint after deploy: if stored sha differs, we already reloaded;
        // keep known current.
        return;
      }

      if (sha !== known) {
        known = sha;
        try {
          localStorage.setItem(LS_SHA, sha);
        } catch (_) {}
        toast("Lab updated · reloading…", 2500);
        // Give toast a beat, then load the new Pages/local build
        setTimeout(hardReload, 900);
      }
    } catch (_) {
      /* offline or API missing — ignore */
    }
  }

  function start() {
    // Visible meta chip if present
    check(true);
    if (timer) clearInterval(timer);
    timer = setInterval(() => check(false), POLL_MS);

    // When tab becomes visible, check immediately (catches Pages deploys)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check(false);
    });

    // SW updatefound → also reload path
    if (navigator.serviceWorker) {
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.addEventListener("updatefound", () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener("statechange", () => {
              if (nw.state === "installed" && navigator.serviceWorker.controller) {
                toast("New lab shell · reloading…", 2000);
                setTimeout(hardReload, 700);
              }
            });
          });
          // periodic SW update poke
          setInterval(() => reg.update().catch(() => {}), 60000);
        })
        .catch(() => {});
    }

    window.LabUpdate = { check: () => check(false), reload: hardReload };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
