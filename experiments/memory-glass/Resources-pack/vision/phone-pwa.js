/* Memory Glass Phone · PWA helper
 * - register service worker
 * - pull-to-refresh (standalone + Safari)
 * - offline banner + install tip
 * - version stamp for iteration
 * VER: phone-pwa-v2
 */
(function () {
  "use strict";
  var VER = "phone-pwa-v4-active";
  if (window.__mgPhonePwaVer === VER) return;
  window.__mgPhonePwaVer = VER;

  function log(msg) {
    try {
      var el = document.getElementById("log");
      if (el) el.textContent = msg + "\n" + (el.textContent || "").slice(0, 1200);
    } catch (e) {}
    try {
      console.log("[mg-pwa]", msg);
    } catch (e2) {}
  }

  /* ── meta / standalone class ── */
  var standalone = false;
  try {
    standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
      /[?&]pwa=1\b/.test(location.search || "");
    document.documentElement.classList.toggle("mg-pwa-standalone", !!standalone);
    document.documentElement.classList.add("mg-phone-pwa");
    if (standalone) document.documentElement.classList.add("mg-pwa-active-shell");
  } catch (e0) {}

  /* ── offline chip (bottom — never steals top wave slot) ── */
  function ensureOfflineBanner() {
    var b = document.getElementById("mg-pwa-offline");
    if (b) return b;
    b = document.createElement("div");
    b.id = "mg-pwa-offline";
    b.setAttribute("role", "status");
    b.style.cssText =
      "display:none;position:fixed;left:12px;right:12px;" +
      "bottom:max(64px,calc(56px + env(safe-area-inset-bottom)));z-index:9999;" +
      "padding:8px 12px;border-radius:10px;" +
      "background:rgba(58,32,16,0.95);border:1px solid #a06030;color:#ffd0a0;" +
      "font:650 12px/1.3 system-ui;text-align:center";
    b.textContent = "Offline · shell cached · pull down to retry";
    document.body.appendChild(b);
    return b;
  }

  function setOnline(on) {
    var b = ensureOfflineBanner();
    b.style.display = on ? "none" : "block";
    document.documentElement.classList.toggle("mg-offline", !on);
  }
  setOnline(navigator.onLine !== false);
  window.addEventListener("online", function () {
    setOnline(true);
    log("online · pull to refresh for latest shell");
  });
  window.addEventListener("offline", function () {
    setOnline(false);
    log("offline · using cached shell");
  });

  /* ── service worker ── */
  function registerSw() {
    if (!("serviceWorker" in navigator)) {
      log("PWA · no serviceWorker (need HTTPS)");
      return;
    }
    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      log("PWA · register on HTTPS :9878 for offline");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(function (reg) {
        log("PWA · sw " + VER + " · scope " + (reg.scope || "/"));
        reg.addEventListener("updatefound", function () {
          var w = reg.installing;
          if (!w) return;
          w.addEventListener("statechange", function () {
            if (w.state === "installed" && navigator.serviceWorker.controller) {
              log("PWA · update ready · pull to refresh");
              showUpdateChip();
            }
          });
        });
        /* check for updates when visible */
        document.addEventListener("visibilitychange", function () {
          if (document.visibilityState === "visible") {
            try {
              reg.update();
            } catch (e) {}
          }
        });
      })
      .catch(function (e) {
        log("PWA · sw fail " + (e && e.message ? e.message : e));
      });

    navigator.serviceWorker.addEventListener("controllerchange", function () {
      log("PWA · controller change");
    });
  }

  function showUpdateChip() {
    if (document.getElementById("mg-pwa-update")) return;
    var c = document.createElement("button");
    c.id = "mg-pwa-update";
    c.type = "button";
    c.textContent = "Update ready · tap to refresh";
    c.style.cssText =
      "position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));" +
      "z-index:10000;min-height:48px;border-radius:12px;border:1px solid #3a7ab8;" +
      "background:#1a4a7a;color:#fff;font:700 14px/1 system-ui;cursor:pointer";
    c.onclick = function () {
      hardRefresh();
    };
    document.body.appendChild(c);
  }

  function hardRefresh() {
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
      }
    } catch (e) {}
    try {
      caches.keys().then(function (keys) {
        return Promise.all(
          keys.filter(function (k) {
            return k.indexOf("mg-phone-pwa") === 0;
          }).map(function (k) {
            return caches.delete(k);
          })
        );
      }).finally(function () {
        location.reload();
      });
    } catch (e2) {
      location.reload();
    }
  }

  /* ── pull to refresh ── */
  function installPullToRefresh() {
    if (document.getElementById("mg-ptr")) return;
    var bar = document.createElement("div");
    bar.id = "mg-ptr";
    bar.innerHTML = '<span id="mg-ptr-lab">pull to refresh</span>';
    bar.style.cssText =
      "position:fixed;left:0;right:0;top:0;z-index:10001;height:0;overflow:hidden;" +
      "display:flex;align-items:flex-end;justify-content:center;" +
      "background:linear-gradient(to bottom,rgba(20,40,70,0.95),rgba(10,14,20,0.4));" +
      "color:#9cf;font:650 12px/1 system-ui;letter-spacing:0.08em;text-transform:uppercase;" +
      "pointer-events:none;transition:height .12s ease";
    document.documentElement.appendChild(bar);

    var startY = 0;
    var pulling = false;
    var armed = false;
    var THRESH = 72;

    function atTop() {
      return (window.scrollY || document.documentElement.scrollTop || 0) <= 2;
    }

    function setPull(dy) {
      var h = Math.min(96, Math.max(0, dy * 0.55));
      bar.style.height = h + "px";
      var lab = document.getElementById("mg-ptr-lab");
      if (!lab) return;
      if (h >= THRESH) {
        lab.textContent = "release to refresh";
        armed = true;
      } else {
        lab.textContent = "pull to refresh";
        armed = false;
      }
    }

    document.addEventListener(
      "touchstart",
      function (ev) {
        if (!atTop()) return;
        if (!ev.touches || !ev.touches[0]) return;
        startY = ev.touches[0].clientY;
        pulling = true;
        armed = false;
      },
      { passive: true }
    );

    document.addEventListener(
      "touchmove",
      function (ev) {
        if (!pulling || !ev.touches || !ev.touches[0]) return;
        var dy = ev.touches[0].clientY - startY;
        if (dy < 0 || !atTop()) {
          setPull(0);
          return;
        }
        setPull(dy);
      },
      { passive: true }
    );

    document.addEventListener(
      "touchend",
      function () {
        if (!pulling) return;
        pulling = false;
        if (armed) {
          var lab = document.getElementById("mg-ptr-lab");
          if (lab) lab.textContent = "refreshing…";
          bar.style.height = "48px";
          setTimeout(hardRefresh, 180);
        } else {
          setPull(0);
        }
      },
      { passive: true }
    );

    /* also desktop: double-click header h1 to refresh */
    document.addEventListener(
      "dblclick",
      function (ev) {
        var t = ev.target;
        if (t && (t.tagName === "H1" || (t.id && t.id.indexOf("hdr") >= 0))) {
          hardRefresh();
        }
      },
      true
    );
  }

  /* ── bottom nav for iteration ── */
  function ensureNav() {
    if (document.getElementById("mg-pwa-nav")) return;
    var path = (location.pathname || "").split("/").pop() || "phone.html";
    var nav = document.createElement("nav");
    nav.id = "mg-pwa-nav";
    nav.setAttribute("aria-label", "MG phone");
    nav.innerHTML =
      '<a href="/phone.html" data-p="phone.html">Cam</a>' +
      '<a href="/phone-talk.html" data-p="phone-talk.html">Talk</a>' +
      '<a href="/phone-chat.html" data-p="phone-chat.html">Chat</a>' +
      '<a href="/phone-setup.html" data-p="phone-setup.html">Setup</a>' +
      '<button type="button" id="mg-pwa-refresh" title="Refresh shell">↻</button>';
    nav.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:9990;" +
      "display:flex;gap:0;padding:6px 4px max(8px,env(safe-area-inset-bottom));" +
      "background:rgba(8,12,18,0.92);border-top:1px solid rgba(255,255,255,0.1);" +
      "backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)";
    var css =
      "#mg-pwa-nav a,#mg-pwa-nav button{flex:1;min-height:40px;appearance:none;border:0;" +
      "background:transparent;color:rgba(200,220,240,0.7);font:650 11px/1 system-ui;" +
      "letter-spacing:0.06em;text-transform:uppercase;text-decoration:none;" +
      "display:flex;align-items:center;justify-content:center}" +
      "#mg-pwa-nav a.on{color:#8ecbff}" +
      "body.mg-phone-pwa,html.mg-phone-pwa body{padding-bottom:max(64px,calc(52px + env(safe-area-inset-bottom)))!important}";
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
    document.body.appendChild(nav);
    Array.prototype.forEach.call(nav.querySelectorAll("a"), function (a) {
      if (a.getAttribute("data-p") === path) a.classList.add("on");
    });
    var rb = document.getElementById("mg-pwa-refresh");
    if (rb)
      rb.onclick = function () {
        hardRefresh();
      };
  }

  /* ── install tip (iOS Add to Home Screen) ── */
  function installTip() {
    try {
      var standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;
      if (standalone) return;
      if (sessionStorage.getItem("mg-pwa-tip") === "1") return;
      var tip = document.createElement("div");
      tip.id = "mg-pwa-tip";
      tip.innerHTML =
        "<b>Install Memory Glass:</b> Share → <b>Add to Home Screen</b> · uses the Memory Glass logo. " +
        "If an old icon sticks, delete the home icon and re-add. Pull down to refresh when iterating.";
      tip.style.cssText =
        "margin:8px 0;padding:10px 12px;border-radius:10px;font:500 12px/1.35 system-ui;" +
        "background:rgba(30,50,80,0.55);border:1px solid rgba(100,160,220,0.35);color:#cde";
      tip.onclick = function () {
        sessionStorage.setItem("mg-pwa-tip", "1");
        tip.remove();
      };
      var h = document.querySelector("h1");
      if (h && h.parentNode) h.parentNode.insertBefore(tip, h.nextSibling);
      else document.body.insertBefore(tip, document.body.firstChild);
    } catch (e) {}
  }

  /* ── keep cam active when PWA shell navigates back to phone.html ── */
  function nudgeCamActive() {
    try {
      var path = (location.pathname || "").split("/").pop() || "";
      if (path !== "phone.html" && path !== "" && path !== "/") return;
      if (!standalone && !/[?&]auto=1\b/.test(location.search || "")) return;
      if (window.__mgPhoneCam && typeof window.__mgPhoneCam.start === "function") {
        if (!window.__mgPhoneCam.isActive || !window.__mgPhoneCam.isActive()) {
          log("PWA · ensuring still-pipe ACTIVE");
          window.__mgPhoneCam.start();
        }
      }
    } catch (e) {}
  }

  function boot() {
    registerSw();
    installPullToRefresh();
    ensureNav();
    if (!standalone) installTip();
    else log("PWA standalone · Memory Glass ACTIVE shell");
    log("PWA " + VER + " · pull↓ refresh · offline shell");
    setTimeout(nudgeCamActive, 500);
    setTimeout(nudgeCamActive, 1600);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") setTimeout(nudgeCamActive, 200);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.__mgPhonePwa = {
    ver: VER,
    refresh: hardRefresh,
    register: registerSw,
  };
})();
