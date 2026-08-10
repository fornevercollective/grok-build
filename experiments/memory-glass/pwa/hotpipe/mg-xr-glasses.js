/* Memory Glass · XR / VR glasses quick-pipe
 * Auto-detect device class, apply optics presets, WebXR entry, pipe status.
 * VER: mg-xr-glasses-v1
 *
 * API: window.__mgXr
 *   .list() · .detect() · .apply(id|device) · .auto() · .status()
 *   .enterWebXR() · .exitWebXR() · .pipeUrl() · .syncHint()
 *   .loadRegistry() · .setDevice(id)
 */
(function () {
  "use strict";
  var VER = "mg-xr-glasses-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._xrGlassesVer === VER && window.__mgXr) return;
  HP._xrGlassesVer = VER;

  var EMBEDDED = null; /* filled after first registry load attempt */
  var FALLBACK_DEVICES = [
    {
      id: "desktop-proxy",
      brand: "Memory Glass",
      name: "Desktop stereo proxy",
      class: "desktop-proxy",
      uaHints: [],
      dev: { webxr: "sim" },
      mg: { eye: "calibrate", ipd: 14, fov: 1800, fovea: 34, ana: 18, mode: "depth" },
    },
    {
      id: "quest-3",
      brand: "Meta",
      name: "Quest 3",
      class: "standalone-vr",
      uaHints: ["Quest 3", "OculusBrowser", "Quest"],
      dev: { adb: true, webxr: true, hzos: true },
      mg: { eye: "human", ipd: 36, fov: 2200, fovea: 42, ana: 0, mode: "depth" },
    },
    {
      id: "xreal-one",
      brand: "XREAL",
      name: "XREAL One",
      class: "tethered-ar",
      uaHints: ["XREAL", "Nebula"],
      dev: { webxr: "partial" },
      mg: { eye: "calibrate", ipd: 18, fov: 1600, fovea: 48, ana: 0, mode: "page" },
    },
    {
      id: "apple-vision-pro",
      brand: "Apple",
      name: "Vision Pro",
      class: "standalone-vr",
      uaHints: ["Vision", "xrOS"],
      dev: { webxr: true },
      mg: { eye: "human", ipd: 30, fov: 2000, fovea: 52, ana: 0, mode: "depth" },
    },
  ];

  var state = {
    ver: VER,
    registry: null,
    device: null,
    detected: null,
    webxr: { supported: null, session: null, immersive: false },
    appliedAt: 0,
    pipe: { port: 8787, path: "/xr-dev.html" },
    lastErr: "",
  };

  function log(kind, msg) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(kind || "ok", String(msg || ""), "xr");
    } catch (e) {}
    try {
      console.log("[mg-xr]", kind || "ok", msg);
    } catch (e2) {}
  }

  function devices() {
    if (state.registry && state.registry.devices && state.registry.devices.length) {
      return state.registry.devices;
    }
    return FALLBACK_DEVICES;
  }

  function byId(id) {
    var list = devices();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function uaBlob() {
    var parts = [];
    try {
      parts.push(navigator.userAgent || "");
    } catch (e) {}
    try {
      if (navigator.userAgentData && navigator.userAgentData.brands) {
        parts.push(
          navigator.userAgentData.brands
            .map(function (b) {
              return b.brand + " " + b.version;
            })
            .join(" ")
        );
      }
    } catch (e2) {}
    try {
      if (navigator.xr) parts.push("WebXR");
    } catch (e3) {}
    return parts.join(" ").toLowerCase();
  }

  function scoreDevice(d, blob) {
    var score = 0;
    var hints = d.uaHints || [];
    for (var i = 0; i < hints.length; i++) {
      var h = String(hints[i] || "").toLowerCase();
      if (!h) continue;
      if (blob.indexOf(h.toLowerCase()) >= 0) score += 10 + h.length;
    }
    if (d.id === "desktop-proxy") score += 1;
    return score;
  }

  function detect() {
    var blob = uaBlob();
    var list = devices();
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < list.length; i++) {
      var s = scoreDevice(list[i], blob);
      if (s > bestScore) {
        bestScore = s;
        best = list[i];
      }
    }
    if (!best || bestScore < 10) {
      best = byId("desktop-proxy") || list[0];
      bestScore = Math.max(bestScore, 1);
    }
    state.detected = {
      id: best.id,
      name: best.name,
      brand: best.brand,
      class: best.class,
      score: bestScore,
      ua: blob.slice(0, 160),
    };
    return state.detected;
  }

  function setSlider(id, val) {
    var el = document.getElementById(id);
    if (!el) return false;
    el.value = String(val);
    try {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) {
      try {
        var ev = document.createEvent("HTMLEvents");
        ev.initEvent("input", true, false);
        el.dispatchEvent(ev);
      } catch (e2) {}
    }
    return true;
  }

  function clickEye(name) {
    try {
      var btn = document.querySelector('#mg-eyes button[data-eye="' + name + '"]');
      if (btn) {
        btn.click();
        return true;
      }
    } catch (e) {}
    return false;
  }

  function applyMgOptics(mg) {
    if (!mg) return { ok: false, reason: "no mg block" };
    var hits = 0;
    if (mg.eye && clickEye(mg.eye)) hits++;
    if (mg.ipd != null && setSlider("mg-c-ipd", mg.ipd)) hits++;
    if (mg.fov != null && setSlider("mg-c-fov", mg.fov)) hits++;
    if (mg.fovea != null && setSlider("mg-c-fovea", mg.fovea)) hits++;
    if (mg.ana != null && setSlider("mg-c-ana", mg.ana)) hits++;
    try {
      var root = document.documentElement;
      if (mg.mode === "depth") {
        root.classList.add("mg-mode-depth", "mg-xr-on");
        root.classList.remove("mg-mode-page");
      } else if (mg.mode === "page") {
        root.classList.add("mg-mode-page");
        root.classList.remove("mg-mode-depth");
        root.classList.add("mg-xr-on");
      } else {
        root.classList.add("mg-xr-on");
      }
      if (mg.ipd != null) root.style.setProperty("--mg-ipd", mg.ipd + "px");
      if (mg.fovea != null) root.style.setProperty("--mg-fovea-r", mg.fovea + "%");
    } catch (eC) {}
    return { ok: hits > 0 || !!mg.mode, hits: hits };
  }

  function apply(idOrDevice) {
    var d =
      typeof idOrDevice === "string"
        ? byId(idOrDevice)
        : idOrDevice && idOrDevice.id
          ? idOrDevice
          : null;
    if (!d) {
      state.lastErr = "unknown device";
      return { ok: false, error: state.lastErr };
    }
    state.device = d;
    var optics = applyMgOptics(d.mg || {});
    try {
      document.documentElement.setAttribute("data-mg-xr-device", d.id);
      document.documentElement.setAttribute("data-mg-xr-class", d.class || "");
    } catch (eA) {}
    state.appliedAt = Date.now();
    log("ok", "applied " + d.id + " · " + d.name + " · hits=" + (optics.hits || 0));
    try {
      if (window.__mgH9Status) {
        /* keep H9 touch proxy aligned */
      }
    } catch (eH) {}
    paintHud();
    return { ok: true, device: d, optics: optics };
  }

  function auto() {
    var det = detect();
    return apply(det.id);
  }

  function probeWebXR() {
    var out = { supported: false, immersiveVr: false, immersiveAr: false, inline: false };
    try {
      if (!navigator.xr || !navigator.xr.isSessionSupported) {
        state.webxr.supported = false;
        return out;
      }
      out.supported = true;
      state.webxr.supported = true;
    } catch (e) {
      state.webxr.supported = false;
      return out;
    }
    /* async checks via promise helpers */
    return out;
  }

  function checkSessions() {
    if (!navigator.xr || !navigator.xr.isSessionSupported) {
      return Promise.resolve(probeWebXR());
    }
    var modes = ["immersive-vr", "immersive-ar", "inline"];
    return Promise.all(
      modes.map(function (m) {
        return navigator.xr
          .isSessionSupported(m)
          .then(function (ok) {
            return { m: m, ok: !!ok };
          })
          .catch(function () {
            return { m: m, ok: false };
          });
      })
    ).then(function (rows) {
      var out = { supported: true, immersiveVr: false, immersiveAr: false, inline: false };
      rows.forEach(function (r) {
        if (r.m === "immersive-vr") out.immersiveVr = r.ok;
        if (r.m === "immersive-ar") out.immersiveAr = r.ok;
        if (r.m === "inline") out.inline = r.ok;
      });
      state.webxr.supported = true;
      state.webxr.caps = out;
      return out;
    });
  }

  function enterWebXR(mode) {
    mode = mode || "immersive-vr";
    if (!navigator.xr || !navigator.xr.requestSession) {
      state.lastErr = "WebXR unavailable";
      return Promise.reject(new Error(state.lastErr));
    }
    return navigator.xr
      .requestSession(mode, { optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"] })
      .then(function (session) {
        state.webxr.session = session;
        state.webxr.immersive = mode.indexOf("immersive") === 0;
        session.addEventListener("end", function () {
          state.webxr.session = null;
          state.webxr.immersive = false;
          paintHud();
          log("ok", "webxr session end");
        });
        log("ok", "webxr " + mode);
        paintHud();
        return session;
      })
      .catch(function (err) {
        state.lastErr = String(err && err.message ? err.message : err);
        log("err", "webxr " + state.lastErr);
        throw err;
      });
  }

  function exitWebXR() {
    if (state.webxr.session) {
      try {
        return state.webxr.session.end();
      } catch (e) {
        return Promise.resolve();
      }
    }
    return Promise.resolve();
  }

  function pipeUrl(host) {
    var port =
      (state.registry && state.registry.pipe && state.registry.pipe.pwaPort) ||
      state.pipe.port ||
      8787;
    var path =
      (state.registry && state.registry.pipe && state.registry.pipe.path) ||
      state.pipe.path ||
      "/xr-dev.html";
    var h = host || "127.0.0.1";
    var qs = state.device ? "?device=" + encodeURIComponent(state.device.id) : "";
    return "http://" + h + ":" + port + path + qs;
  }

  function syncHint() {
    return {
      sync: "bash experiments/memory-glass/scripts/mg-xr-dev.sh sync",
      serve: "bash experiments/memory-glass/scripts/mg-xr-dev.sh serve",
      auto: "bash experiments/memory-glass/scripts/mg-xr-dev.sh auto",
      hot: "⌘⇧R after mg-hotpipe-sync · or TOOLS → XR",
      quest: "adb reverse tcp:8787 tcp:8787 && open xr-dev on headset browser",
      port: 8787,
      softPathAvoid: [8765, 8766],
    };
  }

  function status() {
    return {
      ver: VER,
      device: state.device
        ? { id: state.device.id, name: state.device.name, class: state.device.class }
        : null,
      detected: state.detected,
      webxr: {
        supported: state.webxr.supported,
        immersive: state.webxr.immersive,
        caps: state.webxr.caps || null,
        hasSession: !!state.webxr.session,
      },
      pipeUrl: pipeUrl(),
      appliedAt: state.appliedAt,
      lastErr: state.lastErr,
      deviceCount: devices().length,
    };
  }

  function list() {
    return devices().map(function (d) {
      return {
        id: d.id,
        brand: d.brand,
        name: d.name,
        class: d.class,
        webxr: d.dev && d.dev.webxr,
        adb: !!(d.dev && d.dev.adb),
        hzos: !!(d.dev && d.dev.hzos),
      };
    });
  }

  function registryUrls() {
    var urls = [];
    try {
      /* PWA / served */
      urls.push("/hotpipe/data/xr-glasses-registry.json");
      urls.push("hotpipe/data/xr-glasses-registry.json");
      urls.push("./data/xr-glasses-registry.json");
    } catch (e) {}
    return urls;
  }

  function loadRegistry() {
    if (EMBEDDED) {
      state.registry = EMBEDDED;
      return Promise.resolve(EMBEDDED);
    }
    var urls = registryUrls();
    var i = 0;
    function tryNext() {
      if (i >= urls.length) {
        state.registry = { ver: "fallback", devices: FALLBACK_DEVICES, pipe: state.pipe };
        return Promise.resolve(state.registry);
      }
      var u = urls[i++];
      return fetch(u, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("http " + r.status);
          return r.json();
        })
        .then(function (j) {
          if (!j || !j.devices) throw new Error("bad registry");
          state.registry = j;
          if (j.pipe) {
            state.pipe.port = j.pipe.pwaPort || state.pipe.port;
            state.pipe.path = j.pipe.path || state.pipe.path;
          }
          EMBEDDED = j;
          log("ok", "registry " + (j.ver || "?") + " · " + j.devices.length + " devices");
          return j;
        })
        .catch(function () {
          return tryNext();
        });
    }
    return tryNext();
  }

  /* lightweight HUD chip (lab) */
  var hudEl = null;
  function paintHud() {
    try {
      if (!document.body) return;
      if (!hudEl) {
        hudEl = document.getElementById("mg-xr-chip");
        if (!hudEl) {
          hudEl = document.createElement("div");
          hudEl.id = "mg-xr-chip";
          hudEl.setAttribute("aria-live", "polite");
          hudEl.style.cssText =
            "position:fixed;right:10px;bottom:10px;z-index:2147483000;pointer-events:auto;" +
            "font:600 11px/1.3 ui-monospace,Menlo,system-ui;padding:6px 10px;border-radius:8px;" +
            "background:rgba(8,14,22,.82);color:#9ef0c8;border:1px solid rgba(94,233,168,.35);" +
            "backdrop-filter:blur(8px);max-width:min(42vw,280px);cursor:pointer";
          hudEl.title = "Memory Glass XR · click to re-auto";
          hudEl.addEventListener("click", function () {
            auto();
          });
          document.documentElement.appendChild(hudEl);
        }
      }
      var d = state.device;
      var det = state.detected;
      var line =
        "XR · " +
        (d ? d.id : "—") +
        (det && det.id !== (d && d.id) ? " (det " + det.id + ")" : "") +
        (state.webxr.immersive ? " · immersive" : "");
      hudEl.textContent = line;
      hudEl.style.display = document.documentElement.classList.contains("mg-xr-hud-off")
        ? "none"
        : "block";
    } catch (e) {}
  }

  function bootFromQuery() {
    try {
      var q = new URLSearchParams(location.search || "");
      var dev = q.get("device") || q.get("xr") || q.get("glasses");
      var doAuto = q.get("mg_xr") === "1" || q.get("mg_xr") === "auto" || !!dev;
      if (dev) {
        apply(dev);
      } else if (doAuto || /xr-dev\.html/i.test(location.pathname || "")) {
        auto();
      }
      if (q.get("mg_xr_webxr") === "1") {
        checkSessions().then(function (c) {
          if (c.immersiveVr) enterWebXR("immersive-vr").catch(function () {});
          else if (c.immersiveAr) enterWebXR("immersive-ar").catch(function () {});
        });
      }
    } catch (e) {}
  }

  var api = {
    ver: VER,
    list: list,
    detect: detect,
    apply: apply,
    setDevice: apply,
    auto: auto,
    status: status,
    enterWebXR: enterWebXR,
    exitWebXR: exitWebXR,
    checkSessions: checkSessions,
    pipeUrl: pipeUrl,
    syncHint: syncHint,
    loadRegistry: loadRegistry,
    byId: byId,
    paintHud: paintHud,
  };

  window.__mgXr = api;
  try {
    if (window.__mgLazy) window.__mgLazy._mark && window.__mgLazy._mark("xr");
  } catch (eL) {}

  loadRegistry()
    .then(function () {
      detect();
      bootFromQuery();
      checkSessions().catch(function () {});
      paintHud();
      log("ok", VER + " · " + devices().length + " devices · det=" + (state.detected && state.detected.id));
    })
    .catch(function (e) {
      state.lastErr = String(e);
      detect();
      bootFromQuery();
      paintHud();
    });
})();
