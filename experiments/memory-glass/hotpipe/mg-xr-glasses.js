/* Memory Glass · XR / VR glasses quick-pipe v2
 * Auto-detect · optics · WebXR · multi-seat room · AI handoff.
 * VER: mg-xr-glasses-v2
 *
 * API: window.__mgXr
 *   list · detect · apply · auto · status · forAi
 *   enterWebXR · exitWebXR · checkSessions
 *   pipeUrl · syncHint · loadRegistry · setup
 *   room.join/leave/ping/broadcast · room.peers · room.snapshot
 *   exportHandoff · importHandoff
 */
(function () {
  "use strict";
  var VER = "mg-xr-glasses-v2";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  /* allow upgrade from v1 */
  if (HP._xrGlassesVer === VER && window.__mgXr && window.__mgXr.ver === VER) return;
  HP._xrGlassesVer = VER;

  var FALLBACK_DEVICES = [
    {
      id: "desktop-proxy",
      brand: "Memory Glass",
      name: "Desktop stereo proxy",
      class: "desktop-proxy",
      uaHints: [],
      dev: { webxr: "sim" },
      mg: { eye: "calibrate", ipd: 14, fov: 1800, fovea: 34, ana: 18, mode: "depth" },
      setup: ["Run mg-xr-dev.sh auto", "TOOLS → XR or open xr-dev.html"],
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

  var LS_DEVICE = "mg_xr_device";
  var LS_PEER = "mg_xr_peer_id";
  var LS_ROOM = "mg_xr_room";

  var state = {
    ver: VER,
    registry: null,
    device: null,
    detected: null,
    webxr: { supported: null, session: null, immersive: false, caps: null },
    appliedAt: 0,
    pipe: { port: 8787, path: "/xr-dev.html" },
    lastErr: "",
    room: {
      id: "lab",
      peerId: null,
      joined: false,
      last: null,
      timer: 0,
      pollMs: 4000,
    },
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

  function peerId() {
    if (state.room.peerId) return state.room.peerId;
    try {
      var s = localStorage.getItem(LS_PEER);
      if (s) {
        state.room.peerId = s;
        return s;
      }
    } catch (e) {}
    var id =
      "p-" +
      Math.random().toString(36).slice(2, 8) +
      "-" +
      Date.now().toString(36).slice(-4);
    state.room.peerId = id;
    try {
      localStorage.setItem(LS_PEER, id);
    } catch (e2) {}
    return id;
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
    try {
      parts.push("platform:" + (navigator.platform || ""));
    } catch (e4) {}
    return parts.join(" ").toLowerCase();
  }

  function scoreDevice(d, blob) {
    var score = 0;
    var hints = d.uaHints || [];
    for (var i = 0; i < hints.length; i++) {
      var h = String(hints[i] || "").toLowerCase();
      if (!h) continue;
      if (blob.indexOf(h) >= 0) score += 10 + h.length * 2;
    }
    /* Prefer specific HMD over desktop Macintosh */
    if (d.class === "standalone-vr" && /quest|oculus|pico|hololens|magic leap|xros|vision/.test(blob)) {
      score += 25;
    }
    if (d.id === "apple-vision-pro" && /xros|vision/.test(blob)) score += 40;
    if (d.id === "desktop-proxy") {
      /* only win when nothing HMD-like */
      if (!/quest|oculus|pico|xreal|viture|rokid|xros|hololens/.test(blob)) score += 5;
      else score -= 50;
    }
    /* Quest model preference */
    if (d.id === "quest-3" && blob.indexOf("quest 3") >= 0 && blob.indexOf("quest 3s") < 0) score += 30;
    if (d.id === "quest-3s" && blob.indexOf("quest 3s") >= 0) score += 35;
    if (d.id === "quest-2" && blob.indexOf("quest 2") >= 0) score += 30;
    if (d.id === "quest-pro" && blob.indexOf("quest pro") >= 0) score += 30;
    return score;
  }

  function detect() {
    var blob = uaBlob();
    var list = devices();
    var best = null;
    var bestScore = -1e9;
    for (var i = 0; i < list.length; i++) {
      var s = scoreDevice(list[i], blob);
      if (s > bestScore) {
        bestScore = s;
        best = list[i];
      }
    }
    if (!best || bestScore < 5) {
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
    if (!mg) return { ok: false, reason: "no mg block", hits: 0 };
    var hits = 0;
    if (mg.eye && clickEye(mg.eye)) hits++;
    if (mg.ipd != null && setSlider("mg-c-ipd", mg.ipd)) hits++;
    if (mg.fov != null && setSlider("mg-c-fov", mg.fov)) hits++;
    if (mg.fovea != null && setSlider("mg-c-fovea", mg.fovea)) hits++;
    if (mg.ana != null && setSlider("mg-c-ana", mg.ana)) hits++;
    try {
      var root = document.documentElement;
      root.classList.add("mg-xr-on");
      if (mg.mode === "depth") {
        root.classList.add("mg-mode-depth");
        root.classList.remove("mg-mode-page");
      } else if (mg.mode === "page") {
        root.classList.add("mg-mode-page");
        root.classList.remove("mg-mode-depth");
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
      localStorage.setItem(LS_DEVICE, d.id);
    } catch (eA) {}
    state.appliedAt = Date.now();
    log("ok", "applied " + d.id + " · hits=" + (optics.hits || 0));
    paintHud();
    if (state.room.joined) {
      try {
        roomPing({ broadcast: true });
      } catch (eR) {}
    }
    return { ok: true, device: d, optics: optics };
  }

  function auto() {
    var saved = null;
    try {
      saved = localStorage.getItem(LS_DEVICE);
    } catch (e) {}
    var det = detect();
    /* Prefer UA detect on real HMDs; honor saved only on desktop proxy */
    if (saved && byId(saved) && det && det.id === "desktop-proxy" && saved !== "desktop-proxy") {
      return apply(saved);
    }
    if (saved && byId(saved) && det && det.id === saved) return apply(saved);
    return apply(det.id);
  }

  function checkSessions() {
    if (!navigator.xr || !navigator.xr.isSessionSupported) {
      state.webxr.supported = false;
      state.webxr.caps = {
        supported: false,
        immersiveVr: false,
        immersiveAr: false,
        inline: false,
      };
      return Promise.resolve(state.webxr.caps);
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
      state.lastErr = "WebXR unavailable (need secure context or HMD browser)";
      return Promise.reject(new Error(state.lastErr));
    }
    return navigator.xr
      .requestSession(mode, {
        optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"],
      })
      .then(function (session) {
        state.webxr.session = session;
        state.webxr.immersive = mode.indexOf("immersive") === 0;
        session.addEventListener("end", function () {
          state.webxr.session = null;
          state.webxr.immersive = false;
          paintHud();
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

  function originBase() {
    try {
      if (location.protocol === "http:" || location.protocol === "https:") {
        return location.protocol + "//" + location.host;
      }
    } catch (e) {}
    return "http://127.0.0.1:" + (state.pipe.port || 8787);
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
    if (host) {
      var qs = state.device ? "?device=" + encodeURIComponent(state.device.id) + "&mg_xr=1" : "?mg_xr=1";
      return "http://" + host + ":" + port + path + qs;
    }
    try {
      if (/xr-dev\.html/i.test(location.pathname || "")) {
        return location.href.split("#")[0];
      }
    } catch (e2) {}
    var qs2 = state.device ? "?device=" + encodeURIComponent(state.device.id) + "&mg_xr=1" : "?mg_xr=1";
    return originBase() + path + qs2;
  }

  function syncHint() {
    return {
      sync: "bash experiments/memory-glass/scripts/mg-xr-dev.sh auto",
      hot: "bash experiments/memory-glass/scripts/mg-xr-dev.sh hot",
      doctor: "bash experiments/memory-glass/scripts/mg-xr-dev.sh doctor",
      quest: "bash experiments/memory-glass/scripts/mg-xr-dev.sh quest",
      onboard: originBase() + "/xr-onboard.html",
      forAi: originBase() + "/api/xr/for-ai",
      room: originBase() + "/api/xr/room?room=lab",
      port: 8787,
      softPathAvoid: [8765, 8766],
    };
  }

  function setupFor(id) {
    var d = id ? byId(id) : state.device || (state.detected && byId(state.detected.id));
    if (!d) return [];
    if (d.setup && d.setup.length) return d.setup.slice();
    var reg = state.registry;
    if (reg && reg.setup && reg.setup[d.class]) return reg.setup[d.class].slice();
    return [];
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
        secureContext: typeof isSecureContext === "boolean" ? isSecureContext : null,
      },
      pipeUrl: pipeUrl(),
      appliedAt: state.appliedAt,
      lastErr: state.lastErr,
      deviceCount: devices().length,
      room: {
        id: state.room.id,
        joined: state.room.joined,
        peerId: state.room.peerId,
        peers: state.room.last ? Object.keys(state.room.last.peers || {}).length : 0,
      },
      setup: setupFor(),
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

  function forAi() {
    var st = status();
    var hint = syncHint();
    return {
      product: "memory-glass-xr",
      ver: VER,
      ts: new Date().toISOString(),
      status: st,
      sync: hint,
      device: state.device
        ? {
            id: state.device.id,
            class: state.device.class,
            mg: state.device.mg,
            setup: setupFor(state.device.id),
          }
        : null,
      room: state.room.last || null,
      agentRules: [
        "Edit hotpipe JS under experiments/memory-glass/hotpipe",
        "Run bash experiments/memory-glass/scripts/mg-xr-dev.sh hot after edits",
        "Never bind ports 8765/8766 (Soft Path)",
        "Never pkill Memory Glass — use ⌘⇧R / hot",
        "Use __mgXr.room.join for multi-seat LAN",
        "Quest: mg-xr-dev.sh quest then headset browser 127.0.0.1:8787",
      ],
      console: [
        "__mgXr.auto()",
        "__mgXr.apply('quest-3')",
        "__mgXr.forAi()",
        "__mgXr.room.join('lab')",
        "__mgXr.status()",
      ],
    };
  }

  function exportHandoff(note) {
    var h = {
      ver: VER,
      ts: new Date().toISOString(),
      deviceId: state.device && state.device.id,
      optics: state.device && state.device.mg,
      note: note || "",
      forAi: forAi(),
    };
    if (state.room.joined) {
      roomPost({ action: "ping", handoff: h, note: note || "" });
    }
    return h;
  }

  function importHandoff(h) {
    if (!h) return { ok: false };
    if (h.deviceId) apply(h.deviceId);
    else if (h.optics) applyMgOptics(h.optics);
    return { ok: true };
  }

  /* ── multi-seat room ── */
  function roomUrl(path) {
    return originBase() + (path || "/api/xr/room");
  }

  function roomPost(extra) {
    extra = extra || {};
    var body = {
      room: state.room.id,
      action: extra.action || "ping",
      peer: {
        id: peerId(),
        name: extra.name || peerId().slice(0, 10),
        role: extra.role || guessRole(),
        deviceId: state.device && state.device.id,
        class: state.device && state.device.class,
        ua: (navigator.userAgent || "").slice(0, 120),
        url: location.href,
      },
    };
    if (extra.broadcast || extra.action === "join") {
      body.device = state.device
        ? { id: state.device.id, name: state.device.name, class: state.device.class }
        : null;
      body.optics = state.device && state.device.mg;
    }
    if (extra.note != null) body.note = extra.note;
    if (extra.handoff != null) body.handoff = extra.handoff;
    return fetch(roomUrl("/api/xr/room"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
      .then(function (r) {
        if (!r.ok) throw new Error("room http " + r.status);
        return r.json();
      })
      .then(function (j) {
        state.room.last = j;
        if (j.you) state.room.peerId = j.you;
        /* apply host optics if we are glass client and host broadcast device */
        if (extra.follow && j.device && j.device.id && (!state.device || state.device.id !== j.device.id)) {
          apply(j.device.id);
        }
        paintHud();
        return j;
      });
  }

  function guessRole() {
    var blob = uaBlob();
    if (/quest|oculus|pico|xros|vision/.test(blob)) return "glass";
    if (window.__mgAi || / grok|codex|claude /i.test(navigator.userAgent || "")) return "ai";
    try {
      if (window.ipc) return "host";
    } catch (e) {}
    return "human";
  }

  function roomPing(opts) {
    return roomPost(opts || { action: "ping" }).catch(function (e) {
      state.lastErr = "room: " + e;
      return null;
    });
  }

  function roomJoin(roomId, opts) {
    opts = opts || {};
    if (roomId) state.room.id = String(roomId);
    try {
      localStorage.setItem(LS_ROOM, state.room.id);
    } catch (e) {}
    state.room.joined = true;
    if (state.room.timer) clearInterval(state.room.timer);
    return roomPost({ action: "join", name: opts.name, role: opts.role, broadcast: true })
      .then(function (j) {
        state.room.timer = setInterval(function () {
          roomPing({ follow: !!opts.follow });
        }, state.room.pollMs);
        log("ok", "room join " + state.room.id);
        return j;
      })
      .catch(function (e) {
        state.room.joined = false;
        state.lastErr = String(e);
        /* BroadcastChannel fallback same-origin tabs */
        try {
          bcJoin();
        } catch (e2) {}
        throw e;
      });
  }

  function roomLeave() {
    if (state.room.timer) {
      clearInterval(state.room.timer);
      state.room.timer = 0;
    }
    var p = roomPost({ action: "leave" }).catch(function () {
      return null;
    });
    state.room.joined = false;
    try {
      if (bc) bc.postMessage({ type: "leave", id: peerId() });
    } catch (e) {}
    return p;
  }

  var bc = null;
  function bcJoin() {
    if (typeof BroadcastChannel === "undefined") return;
    bc = new BroadcastChannel("mg-xr-room-" + state.room.id);
    bc.onmessage = function (ev) {
      var m = ev.data || {};
      if (m.type === "optics" && m.deviceId) {
        if (m.deviceId !== (state.device && state.device.id)) apply(m.deviceId);
      }
    };
    bc.postMessage({
      type: "join",
      id: peerId(),
      deviceId: state.device && state.device.id,
    });
  }

  function roomSnapshot() {
    return fetch(roomUrl("/api/xr/room?room=" + encodeURIComponent(state.room.id)), {
      cache: "no-store",
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        state.room.last = j;
        return j;
      });
  }

  function registryUrls() {
    return [
      "/hotpipe/data/xr-glasses-registry.json",
      "/data/xr-glasses-registry.json",
      "hotpipe/data/xr-glasses-registry.json",
      "./data/xr-glasses-registry.json",
      originBase() + "/hotpipe/data/xr-glasses-registry.json",
      originBase() + "/data/xr-glasses-registry.json",
    ];
  }

  function loadRegistry() {
    if (state.registry && state.registry.devices && state.registry.ver) {
      return Promise.resolve(state.registry);
    }
    var urls = registryUrls();
    var i = 0;
    function tryNext() {
      if (i >= urls.length) {
        state.registry = {
          ver: "fallback",
          devices: FALLBACK_DEVICES,
          pipe: state.pipe,
          agent: syncHint(),
        };
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
          log("ok", "registry " + (j.ver || "?") + " · " + j.devices.length);
          return j;
        })
        .catch(function () {
          return tryNext();
        });
    }
    return tryNext();
  }

  var hudEl = null;
  function paintHud() {
    try {
      if (!document.body && !document.documentElement) return;
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
            "backdrop-filter:blur(8px);max-width:min(48vw,300px);cursor:pointer";
          hudEl.title = "MG XR · click auto · shift-click join room lab";
          hudEl.addEventListener("click", function (ev) {
            if (ev.shiftKey) {
              roomJoin(state.room.id || "lab").catch(function () {});
            } else {
              auto();
            }
          });
          (document.documentElement || document.body).appendChild(hudEl);
        }
      }
      var d = state.device;
      var nPeers =
        state.room.last && state.room.last.peers
          ? Object.keys(state.room.last.peers).length
          : 0;
      hudEl.textContent =
        "XR · " +
        (d ? d.id : "—") +
        (state.webxr.immersive ? " · immersive" : "") +
        (state.room.joined ? " · room:" + state.room.id + "(" + nPeers + ")" : "");
      hudEl.style.display = document.documentElement.classList.contains("mg-xr-hud-off")
        ? "none"
        : "block";
    } catch (e) {}
  }

  function bootFromQuery() {
    try {
      var q = new URLSearchParams(location.search || "");
      var dev = q.get("device") || q.get("xr") || q.get("glasses");
      var room = q.get("room") || q.get("mg_room");
      var doAuto = q.get("mg_xr") === "1" || q.get("mg_xr") === "auto" || !!dev;
      if (room) {
        try {
          localStorage.setItem(LS_ROOM, room);
        } catch (eR) {}
        state.room.id = room;
      } else {
        try {
          var sr = localStorage.getItem(LS_ROOM);
          if (sr) state.room.id = sr;
        } catch (eS) {}
      }
      if (dev) apply(dev);
      else if (doAuto || /xr-dev\.html/i.test(location.pathname || "")) auto();
      if (q.get("join") === "1" || q.get("mg_join") === "1" || room) {
        roomJoin(state.room.id, { follow: q.get("follow") === "1" }).catch(function () {});
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
    forAi: forAi,
    setup: setupFor,
    enterWebXR: enterWebXR,
    exitWebXR: exitWebXR,
    checkSessions: checkSessions,
    pipeUrl: pipeUrl,
    syncHint: syncHint,
    loadRegistry: loadRegistry,
    byId: byId,
    paintHud: paintHud,
    exportHandoff: exportHandoff,
    importHandoff: importHandoff,
    room: {
      join: roomJoin,
      leave: roomLeave,
      ping: roomPing,
      snapshot: roomSnapshot,
      peers: function () {
        var p = (state.room.last && state.room.last.peers) || {};
        return Object.keys(p).map(function (k) {
          return p[k];
        });
      },
      id: function () {
        return state.room.id;
      },
      get last() {
        return state.room.last;
      },
    },
  };

  window.__mgXr = api;

  loadRegistry()
    .then(function () {
      detect();
      bootFromQuery();
      checkSessions().catch(function () {});
      paintHud();
      log(
        "ok",
        VER +
          " · " +
          devices().length +
          " devices · det=" +
          (state.detected && state.detected.id)
      );
    })
    .catch(function (e) {
      state.lastErr = String(e);
      detect();
      bootFromQuery();
      paintHud();
    });
})();
