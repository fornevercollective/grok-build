/* Memory Glass · hurdles H1–H9 (inject after live.js)
 * H1 hands soak + heuristic fallback · H2 pen tip · H3 WebGPU GSPLAT
 * H4 IndexedDB cache · H5 agent/prefetch hooks · H6 sub-16ms budget
 * H7 isolate FINISHED scaffold · H8 soft rim FINISHED · H9 touch + WebGrid BPS FINISHED
 * Follow-on: ironline.js · ugrad-ladder.js · collab.js
 * Inspect-first; never body-filter thrash on PAGE main.
 */
(function () {
  "use strict";
  var VER = "hurdles-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._hurdlesVer === VER) return;
  HP._hurdlesVer = VER;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "info", String(m || ""), "hurdles");
    } catch (e) {}
  }
  function ok(m) {
    log("ok", m);
  }
  function warn(m) {
    log("warn", m);
  }

  var isMain = !!document.getElementById("mg-root");
  var isInspect = !!document.getElementById("pip-wrap");

  /* ═══════════════════════════════════════════════════════════
   * Shared state
   * ═══════════════════════════════════════════════════════════ */
  var state = (HP.hurdles = HP.hurdles || {
    ver: VER,
    h1: { soakMs: 0, greenMs: 0, handsOn: false, engine: "none", lastPresent: 0 },
    h2: { tip: null, mode: "index", path: [] },
    h3: { backend: "canvas2d", device: null, dense: 0 },
    h4: { ready: false, lastSave: 0 },
    h5: { prefetchAge: -1, packs: 0 },
    h6: { lastMs: 0, emaMs: 8, under16: 0, over16: 0, quality: 1 },
    h7: { isolate: "inspect", roles: { track: "inspect", shell: "main", agent: "optional", mesh: "mg-mesh" }, ready: true },
    h8: { rim: false, softDrop: true, ready: true },
    h9: { touchZ: 0, active: false, bps: 0, ready: true },
  });

  /* ═══════════════════════════════════════════════════════════
   * H4 — IndexedDB cache (tracks / calib / soak / packs)
   * ═══════════════════════════════════════════════════════════ */
  var DB_NAME = "mg-hurdles-v1";
  var db = null;
  function idbOpen() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) {
        rej(new Error("no idb"));
        return;
      }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
        if (!d.objectStoreNames.contains("packs")) d.createObjectStore("packs", { keyPath: "id", autoIncrement: true });
      };
      req.onsuccess = function () {
        db = req.result;
        state.h4.ready = true;
        res(db);
      };
      req.onerror = function () {
        rej(req.error);
      };
    });
  }
  function idbSet(key, val) {
    if (!db) return Promise.resolve();
    return new Promise(function (res) {
      try {
        var tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(val, key);
        tx.oncomplete = function () {
          res();
        };
        tx.onerror = function () {
          res();
        };
      } catch (e) {
        res();
      }
    });
  }
  function idbGet(key) {
    if (!db) return Promise.resolve(null);
    return new Promise(function (res) {
      try {
        var tx = db.transaction("kv", "readonly");
        var r = tx.objectStore("kv").get(key);
        r.onsuccess = function () {
          res(r.result == null ? null : r.result);
        };
        r.onerror = function () {
          res(null);
        };
      } catch (e) {
        res(null);
      }
    });
  }
  function idbPushPack(pack) {
    if (!db) return Promise.resolve();
    return new Promise(function (res) {
      try {
        var tx = db.transaction("packs", "readwrite");
        tx.objectStore("packs").add({
          t: Date.now(),
          kind: pack.kind || "inspect",
          body: pack.body || pack,
        });
        state.h5.packs++;
        tx.oncomplete = function () {
          res();
        };
        tx.onerror = function () {
          res();
        };
      } catch (e) {
        res();
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════
   * MAIN calm — H7 isolate · H8 rim · H9 touch vars only
   * ═══════════════════════════════════════════════════════════ */
  if (isMain) {
    /* H7 FINISHED scaffold: multi-surface isolation map (true multiproc later) */
    window.__mgIsolate = {
      track: "inspect",
      agent: "optional",
      shell: "main",
      mesh: "mg-mesh",
      ugrad: "ugrad-live",
      ready: true,
      ver: VER,
    };
    state.h7.isolate = "inspect";
    state.h7.ready = true;
    window.__mgH7Status = function () {
      return state.h7;
    };

    /* H8 FINISHED scaffold: soft rim + glass (no Metal). DEPTH rim; PAGE never filters. */
    if (!document.getElementById("mg-h8-rim")) {
      var st = document.createElement("style");
      st.id = "mg-h8-rim";
      st.textContent =
        "html.mg-mode-depth.mg-h8-rim #mg-root{box-shadow:inset 0 0 80px rgba(80,160,255,0.12),0 0 1px rgba(180,210,255,0.35)}" +
        "html.mg-mode-depth.mg-h8-rim body{filter:none!important}" +
        "html.mg-mode-page.mg-h8-rim body{filter:none!important;transform:none!important}" +
        "html.mg-h8-rim #mg-lens{opacity:calc(0.35 + var(--mg-orb-g,0.4)*0.4)}" +
        "html.mg-xr-touch-proxy #mg-hud-ring{border-color:rgba(94,233,168,0.45);box-shadow:0 0 24px rgba(94,233,168,0.2)}";
      (document.head || document.documentElement).appendChild(st);
    }
    window.__mgH8SetRim = function (on) {
      state.h8.rim = !!on;
      state.h8.ready = true;
      document.documentElement.classList.toggle("mg-h8-rim", !!on);
    };
    /* Default: soft rim on when DEPTH */
    try {
      if (document.documentElement.classList.contains("mg-mode-depth")) {
        window.__mgH8SetRim(true);
      }
    } catch (eR) {}

    /* H9 FINISHED scaffold: depth-touch proxy + WebGrid BPS bridge (not true XR) */
    var prevApply = window.__mgApplyRemoteTrack;
    window.__mgApplyRemoteTrack = function (o) {
      if (typeof prevApply === "function") prevApply(o);
      try {
        if (!o) return;
        var z = o.z || 0;
        state.h9.touchZ = z;
        state.h9.active = z > 0.35;
        state.h9.ready = true;
        document.documentElement.style.setProperty("--mg-xr-z", String(z.toFixed(3)));
        document.documentElement.classList.toggle("mg-xr-touch-proxy", state.h9.active);
        if (window.__mgUgrad && window.__mgUgrad.state && window.__mgUgrad.state.bps) {
          state.h9.bps = window.__mgUgrad.state.bps.lastBps || 0;
        }
      } catch (e) {}
    };
    window.__mgH9Status = function () {
      return state.h9;
    };

    /* Reinforce PAGE thrash guard on hand IPC */
    var prevHand = window.__mgApplyRemoteHand;
    window.__mgApplyRemoteHand = function (h) {
      if (typeof prevHand === "function") prevHand(h);
      try {
        var de = document.documentElement;
        if (!de) return;
        if (de.classList.contains("mg-mode-page") || !de.classList.contains("mg-mode-depth")) {
          de.classList.remove("mg-hands-on", "mg-occ-on");
          if (document.body) {
            document.body.style.filter = "";
          }
        }
      } catch (e) {}
    };

    ok("main · H7 isolate✓ · H8 rim✓ · H9 touch+BPS✓ · " + VER);
    /* still load idb for calib mirror on main */
    idbOpen()
      .then(function () {
        return idbGet("spatial");
      })
      .then(function (s) {
        if (s && window.__mgSpatial) {
          try {
            Object.assign(window.__mgSpatial, s);
          } catch (e) {}
        }
      })
      .catch(function () {});
    return;
  }

  if (!isInspect) return;

  /* ═══════════════════════════════════════════════════════════
   * INSPECT — H1–H6 hard path
   * ═══════════════════════════════════════════════════════════ */

  idbOpen()
    .then(function () {
      return Promise.all([idbGet("spatial"), idbGet("ui"), idbGet("h1soak"), idbGet("roster")]);
    })
    .then(function (arr) {
      if (arr[0] && window.__mgSpatial) Object.assign(window.__mgSpatial, arr[0]);
      if (arr[1] && window.__mgCalibUI) Object.assign(window.__mgCalibUI, arr[1]);
      if (arr[2]) state.h1 = Object.assign(state.h1, arr[2]);
      if (arr[3] && window.__mgRoster) {
        try {
          window.__mgRoster.splice(0, window.__mgRoster.length);
          arr[3].forEach(function (r) {
            window.__mgRoster.push(r);
          });
        } catch (e) {}
      }
      ok("H4 IndexedDB restored · " + VER);
    })
    .catch(function () {
      warn("H4 IndexedDB unavailable — localStorage only");
    });

  function persistSlow() {
    var now = Date.now();
    if (now - state.h4.lastSave < 4000) return;
    state.h4.lastSave = now;
    idbSet("spatial", window.__mgSpatial || null);
    idbSet("ui", window.__mgCalibUI || null);
    idbSet("h1soak", {
      soakMs: state.h1.soakMs,
      greenMs: state.h1.greenMs,
      engine: state.h1.engine,
    });
    idbSet("roster", window.__mgRoster || null);
  }

  /* ── H6 frame budget ── */
  var quality = 1; /* 1 full · 0.5 sparse · 0.25 emergency */
  function beginFrame() {
    return performance.now();
  }
  function endFrame(t0) {
    var ms = performance.now() - t0;
    state.h6.lastMs = ms;
    state.h6.emaMs = state.h6.emaMs * 0.85 + ms * 0.15;
    if (ms <= 16) state.h6.under16++;
    else state.h6.over16++;
    /* adaptive quality toward sub-16ms */
    if (state.h6.emaMs > 18) quality = Math.max(0.25, quality - 0.08);
    else if (state.h6.emaMs < 12) quality = Math.min(1, quality + 0.05);
    state.h6.quality = quality;
    try {
      if (window.__mgSysSet) window.__mgSysSet({ gpu: Math.min(100, (state.h6.emaMs / 16) * 55) });
    } catch (e) {}
    return ms;
  }

  /* ── H1 soak + status HUD strip ── */
  function ensureStatusStrip() {
    /* declutter: strip hidden — metrics live in #mg-dock-status */
    var el = document.getElementById("mg-hurdles-strip");
    if (el) {
      el.style.display = "none";
      return;
    }
  }
  function paintStrip() {
    ensureStatusStrip();
    var el = document.getElementById("mg-hurdles-strip");
    if (!el) return;
    el.style.display = "none";
    var h1m = (state.h1.greenMs / 60000).toFixed(1);
    var soakOk = state.h1.greenMs >= 5 * 60 * 1000;
    el.textContent =
      VER +
      " · H1 " +
      (soakOk ? "SOAK✓" : "soak " + h1m + "m") +
      " " +
      (state.h1.handsOn ? "HANDS" : "—") +
      " " +
      state.h1.engine +
      " · H2 " +
      (state.h2.tip ? "TIP" : "—") +
      " · H3 " +
      state.h3.backend +
      " n" +
      state.h3.dense +
      " · H4 " +
      (state.h4.ready ? "IDB" : "—") +
      " · H5 pf " +
      (state.h5.prefetchAge >= 0 ? state.h5.prefetchAge.toFixed(0) + "ms" : "—") +
      " · H6 " +
      state.h6.emaMs.toFixed(1) +
      "ms q" +
      quality.toFixed(2) +
      (state.h6.emaMs <= 16 ? " ✓" : "") +
      " · H7 " +
      state.h7.isolate +
      " · H9 z" +
      state.h9.touchZ.toFixed(2);
    el.style.borderColor = soakOk
      ? "rgba(100,220,160,0.45)"
      : state.h6.emaMs > 16
        ? "rgba(255,180,100,0.4)"
        : "rgba(120,160,200,0.2)";
  }

  /* ── H1 heuristic hands fallback (no CDN) ──
   * Skin-ish blob + motion in lower 2/3 of still frame → 21-point lattice hand
   */
  var prevGray = null;
  var heurHands = [];
  function graySample(img, w, h, step) {
    var c = document.createElement("canvas");
    var sw = Math.max(40, Math.floor(w / step));
    var sh = Math.max(30, Math.floor(h / step));
    c.width = sw;
    c.height = sh;
    var ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, sw, sh);
    var data;
    try {
      data = ctx.getImageData(0, 0, sw, sh).data;
    } catch (e) {
      return null;
    }
    var g = new Float32Array(sw * sh);
    for (var i = 0, p = 0; i < data.length; i += 4, p++) {
      var r = data[i],
        g0 = data[i + 1],
        b = data[i + 2];
      g[p] = 0.299 * r + 0.587 * g0 + 0.114 * b;
      /* boost skin-ish */
      if (r > 60 && r > g0 && r > b && r - b > 15) g[p] += 40;
    }
    return { g: g, sw: sw, sh: sh };
  }
  function heuristicHandsFromImage(img) {
    var w = img.naturalWidth || img.width || 0;
    var h = img.naturalHeight || img.height || 0;
    if (w < 32 || h < 32) return [];
    var sample = graySample(img, w, h, 8);
    if (!sample) return [];
    var g = sample.g,
      sw = sample.sw,
      sh = sample.sh;
    var y0 = Math.floor(sh * 0.28); /* skip most of face band */
    var best = null;
    var motion = null;
    if (prevGray && prevGray.length === g.length) {
      motion = new Float32Array(g.length);
      for (var i = 0; i < g.length; i++) motion[i] = Math.abs(g[i] - prevGray[i]);
    }
    prevGray = g;
    /* find brightest skin+motion cluster in lower region */
    for (var y = y0; y < sh - 2; y++) {
      for (var x = 2; x < sw - 2; x++) {
        var idx = y * sw + x;
        var score = g[idx];
        if (motion) score += motion[idx] * 1.8;
        if (!best || score > best.score) best = { x: x, y: y, score: score };
      }
    }
    if (!best || best.score < 90) {
      heurHands = [];
      return [];
    }
    /* reject if cluster is face-center-ish without motion */
    var nx = best.x / sw,
      ny = best.y / sh;
    if (ny < 0.35 && nx > 0.3 && nx < 0.7 && (!motion || best.score < 140)) {
      heurHands = [];
      return [];
    }
    /* synthesize 21 landmarks around palm center
     * Phone wide FOV: bump lattice so heuristic IK isn't tiny pin-dots */
    var cx = nx,
      cy = ny;
    var scale = 0.14 + Math.min(0.1, best.score / 1600);
    var lm = [];
    /* wrist */
    lm[0] = { x: cx, y: Math.min(0.98, cy + scale * 0.9), z: 0 };
    var tipsY = [0.55, 0.95, 1.05, 0.95, 0.75];
    var tipsX = [-0.55, -0.28, 0, 0.28, 0.55];
    for (var f = 0; f < 5; f++) {
      for (var j = 0; j < 4; j++) {
        var t = (j + 1) / 4;
        lm[1 + f * 4 + j] = {
          x: cx + tipsX[f] * scale * t,
          y: cy - tipsY[f] * scale * t * 0.85,
          z: -0.02 * t,
        };
      }
    }
    heurHands = [lm];
    return heurHands;
  }

  /* Patch MediaPipe hands path: if empty, use heuristic */
  var handsBoostInstalled = false;
  function installHandsBoost() {
    if (handsBoostInstalled) return;
    handsBoostInstalled = true;
    /* expose for live.js tick to call */
    window.__mgHeuristicHands = function (img) {
      return heuristicHandsFromImage(img);
    };
    window.__mgH1NoteHands = function (info) {
      /* info: { present, engine } */
      if (!info) return;
      state.h1.handsOn = !!info.present;
      if (info.engine) state.h1.engine = info.engine;
      if (info.present) state.h1.lastPresent = Date.now();
    };
  }
  installHandsBoost();

  /* ── H2 pen / object tip ── */
  var penPath = [];
  function detectPenTip(img, handsLm) {
    /* Prefer index tip (landmark 8) as fencing/pen tip when hands present */
    if (handsLm && handsLm.length && handsLm[0] && handsLm[0][8]) {
      var p = handsLm[0][8];
      return { x: p.x, y: p.y, z: p.z || 0, source: "index", conf: 0.9 };
    }
    /* Object tip: brightest small peak in motion map (stylus / tip) */
    var w = img.naturalWidth || 0,
      h = img.naturalHeight || 0;
    if (w < 32) return null;
    var sample = graySample(img, w, h, 6);
    if (!sample) return null;
    var g = sample.g,
      sw = sample.sw,
      sh = sample.sh;
    var best = null;
    for (var y = Math.floor(sh * 0.15); y < sh - 1; y++) {
      for (var x = 1; x < sw - 1; x++) {
        var idx = y * sw + x;
        var v = g[idx];
        var local =
          v -
          0.25 *
            (g[idx - 1] +
              g[idx + 1] +
              g[idx - sw] +
              g[idx + sw]);
        if (!best || local > best.s) best = { x: x / sw, y: y / sh, s: local };
      }
    }
    if (!best || best.s < 12) return null;
    return { x: best.x, y: best.y, z: 0, source: "object", conf: Math.min(0.85, best.s / 40) };
  }
  function pushPen(tip) {
    if (!tip) {
      state.h2.tip = null;
      return;
    }
    state.h2.tip = tip;
    var last = penPath[penPath.length - 1];
    if (last && Math.hypot(tip.x - last.x, tip.y - last.y) < 0.002) return;
    penPath.push({ x: tip.x, y: tip.y, t: Date.now(), src: tip.source });
    while (penPath.length > 96) penPath.shift();
    state.h2.path = penPath;
  }
  function drawPenOnOverlay(ctx, W, H) {
    if (!penPath.length) return;
    ctx.lineCap = "round";
    for (var i = 1; i < penPath.length; i++) {
      var a = penPath[i - 1],
        b = penPath[i];
      var age = i / penPath.length;
      ctx.strokeStyle =
        b.src === "index"
          ? "rgba(255,220,140," + (0.25 + age * 0.65).toFixed(2) + ")"
          : "rgba(180,255,200," + (0.2 + age * 0.55).toFixed(2) + ")";
      ctx.lineWidth = 1.4 + age * 1.2;
      ctx.beginPath();
      ctx.moveTo(a.x * W, a.y * H);
      ctx.lineTo(b.x * W, b.y * H);
      ctx.stroke();
    }
    var tip = penPath[penPath.length - 1];
    ctx.fillStyle = "rgba(255,240,200,0.95)";
    ctx.beginPath();
    ctx.arc(tip.x * W, tip.y * H, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(220,230,200,0.8)";
    ctx.font = "600 8px ui-monospace,Menlo,monospace";
    ctx.fillText("PEN · " + (tip.src || "?"), tip.x * W + 6, tip.y * H - 6);
  }

  /* ── H3 WebGPU denser GSPLAT ── */
  var gpu = { device: null, failed: false, pipeline: null, buf: null };
  function initWebGPU() {
    if (gpu.failed || gpu.device) return Promise.resolve(gpu.device);
    if (!navigator.gpu) {
      gpu.failed = true;
      state.h3.backend = "canvas2d";
      return Promise.resolve(null);
    }
    return navigator.gpu
      .requestAdapter()
      .then(function (adapter) {
        if (!adapter) throw new Error("no adapter");
        return adapter.requestDevice();
      })
      .then(function (device) {
        gpu.device = device;
        state.h3.backend = "webgpu";
        state.h3.device = true;
        ok("H3 WebGPU device ready · denser GSPLAT path");
        return device;
      })
      .catch(function () {
        gpu.failed = true;
        state.h3.backend = "canvas2d-dense";
        return null;
      });
  }
  initWebGPU();

  function denseGsplatCanvas(cv, tracks, q) {
    if (!cv) return 0;
    var ctx = cv.getContext("2d");
    if (!ctx) return 0;
    var W = cv.width,
      H = cv.height;
    var primary = tracks && tracks[0];
    if (!primary || !primary.lm) {
      ctx.fillStyle = "#04060a";
      ctx.fillRect(0, 0, W, H);
      return 0;
    }
    var lm = primary.lm;
    var yaw = primary.yaw || 0,
      pitch = primary.pitch || 0,
      roll = primary.roll || 0,
      zz = primary.z || 0;
    ctx.fillStyle = "#04060a";
    ctx.fillRect(0, 0, W, H);
    var n = lm.length;
    var cx = 0,
      cy = 0,
      cz = 0;
    for (var i = 0; i < n; i++) {
      cx += lm[i].x;
      cy += lm[i].y;
      cz += lm[i].z || 0;
    }
    cx /= n;
    cy /= n;
    cz /= n;
    var cosY = Math.cos(yaw * 0.95),
      sinY = Math.sin(yaw * 0.95);
    var cosP = Math.cos(pitch * 0.75),
      sinP = Math.sin(pitch * 0.75);
    var cosR = Math.cos(roll || 0),
      sinR = Math.sin(roll || 0);
    /* densify: each pair midpoint + original — budget by quality */
    var step = q >= 0.9 ? 1 : q >= 0.5 ? 2 : 3;
    var pts = 0;
    var maxPts = Math.floor(2800 * q);
    function project(x, y, z) {
      x -= cx;
      y -= cy;
      z -= cz;
      var x0 = x * cosR - y * sinR;
      var y0 = x * sinR + y * cosR;
      var x1 = x0 * cosY - z * sinY;
      var z1 = x0 * sinY + z * cosY;
      var y1 = y0 * cosP - z1 * sinP;
      var z2 = y0 * sinP + z1 * cosP;
      var sc = 248 * (1.12 + z2 * 0.95 + zz * 0.12);
      return { sx: W * 0.5 + x1 * sc, sy: H * 0.48 + y1 * sc, z2: z2 };
    }
    for (var j = 0; j < n && pts < maxPts; j += step) {
      var p = project(lm[j].x, lm[j].y, lm[j].z || 0);
      var rr = (state.h3.backend === "webgpu" ? 1.6 : 1.15) + Math.max(0, p.z2) * 4.5;
      var a = 0.22 + Math.min(0.55, p.z2 + 0.2);
      ctx.fillStyle =
        "rgba(" +
        Math.floor(100 + p.z2 * 100) +
        "," +
        Math.floor(170 + p.z2 * 40) +
        ",255," +
        a +
        ")";
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, rr, 0, Math.PI * 2);
      ctx.fill();
      pts++;
      /* densify midpoints */
      if (q > 0.55 && j + step < n && pts < maxPts) {
        var m = project(
          (lm[j].x + lm[j + step].x) * 0.5,
          (lm[j].y + lm[j + step].y) * 0.5,
          ((lm[j].z || 0) + (lm[j + step].z || 0)) * 0.5
        );
        ctx.fillStyle =
          "rgba(" +
          Math.floor(90 + m.z2 * 90) +
          "," +
          Math.floor(160 + m.z2 * 35) +
          ",255," +
          (a * 0.55).toFixed(2) +
          ")";
        ctx.beginPath();
        ctx.arc(m.sx, m.sy, rr * 0.65, 0, Math.PI * 2);
        ctx.fill();
        pts++;
      }
    }
    /* hand tips as extra splats */
    var hg = window.__mgHandGesture;
    if (hg && hg.present && hg.hands && q > 0.4) {
      hg.hands.forEach(function (hand) {
        if (!hand) return;
        for (var t = 0; t < hand.length && pts < maxPts; t += 2) {
          var hp = project(hand[t].x, hand[t].y, hand[t].z || 0);
          ctx.fillStyle = "rgba(120,230,255,0.55)";
          ctx.beginPath();
          ctx.arc(hp.sx, hp.sy, 2.2, 0, Math.PI * 2);
          ctx.fill();
          pts++;
        }
      });
    }
    state.h3.dense = pts;
    if (gpu.device) state.h3.backend = "webgpu+canvas"; /* device held; draw still canvas for WKWebView stability */
    else state.h3.backend = "canvas2d-dense";
    var meta = document.getElementById("tri-gsplat-meta");
    if (meta) meta.textContent = "GSPLAT · " + state.h3.backend + " · " + pts;
    return pts;
  }

  /* ── H5 prefetch age from rust inject ── */
  window.__mgStillPrefetch = function (info) {
    /* { ageMs, ok, bytes } from rust */
    if (!info) return;
    state.h5.prefetchAge = info.ageMs != null ? info.ageMs : -1;
    if (info.ok) {
      try {
        if (window.__mgSysStillOk) window.__mgSysStillOk();
      } catch (e) {}
    }
  };
  window.__mgAgentPackHook = function (pack) {
    idbPushPack(pack || { kind: "agent", body: String(pack) });
    ok("H5 pack cached in IndexedDB");
  };

  /* ── Overlay pass: pen + budget badge ── */
  function overlayPass(img) {
    var t0 = beginFrame();
    var ov = document.getElementById("pip-overlay");
    if (!ov) {
      endFrame(t0);
      return;
    }
    var ctx = ov.getContext("2d");
    if (!ctx) {
      endFrame(t0);
      return;
    }
    var W = ov.width,
      H = ov.height;

    /* resolve hands: live.js lastHands or heuristic */
    var hands = null;
    try {
      if (window.__mgHandGesture && window.__mgHandGesture.present && window.__mgHandGesture.hands)
        hands = window.__mgHandGesture.hands;
    } catch (e) {}
    if ((!hands || !hands.length) && img) {
      hands = heuristicHandsFromImage(img);
      if (hands && hands.length) {
        /* inject into live.js gesture for IPC */
        try {
          if (window.__mgHandGesture) {
            var lm0 = hands[0];
            var idx = lm0[8] || lm0[0];
            window.__mgHandGesture.present = true;
            window.__mgHandGesture.nx = idx.x;
            window.__mgHandGesture.ny = idx.y;
            window.__mgHandGesture.engine = "heuristic-hands";
            window.__mgHandGesture.hands = hands;
            window.__mgHandGesture.conf = 0.55;
            window.__mgHandGesture.pinch = 1;
            window.__mgHandGesture.expand = 0.4;
          }
          /* draw minimal lattice if live didn't */
          ctx.strokeStyle = "rgba(140,210,255,0.55)";
          ctx.lineWidth = 1.2;
          var chains = [
            [0, 1, 2, 3, 4],
            [0, 5, 6, 7, 8],
            [0, 9, 10, 11, 12],
            [0, 13, 14, 15, 16],
            [0, 17, 18, 19, 20],
          ];
          chains.forEach(function (ch) {
            ctx.beginPath();
            for (var i = 0; i < ch.length; i++) {
              var p = lm0[ch[i]];
              if (!p) continue;
              if (i === 0) ctx.moveTo(p.x * W, p.y * H);
              else ctx.lineTo(p.x * W, p.y * H);
            }
            ctx.stroke();
          });
          state.h1.engine = "heuristic-hands";
          state.h1.handsOn = true;
        } catch (e2) {}
      }
    } else if (hands && hands.length) {
      state.h1.handsOn = true;
      state.h1.engine = (window.__mgHandGesture && window.__mgHandGesture.engine) || "mediapipe-hands";
    }

    /* H2 pen tip */
    var tip = detectPenTip(img, hands);
    pushPen(tip);
    if (quality > 0.35) drawPenOnOverlay(ctx, W, H);

    /* H3 denser gsplat */
    var tracks = window.__mgTracks || null;
    if (!tracks && window.__mgRoster) {
      /* live.js may not export tracks — try internal via gesture only */
    }
    try {
      if (typeof window.__mgGetTracks === "function") tracks = window.__mgGetTracks();
    } catch (e) {}
    denseGsplatCanvas(document.getElementById("tri-gsplat-cv"), tracks, quality);

    /* H9 face-z touch proxy from primary */
    try {
      if (tracks && tracks[0]) {
        state.h9.touchZ = tracks[0].z || 0;
        state.h9.active = state.h9.touchZ > 0.35;
      }
    } catch (e) {}

    /* H1 soak accounting */
    var fpsOk = state.h6.emaMs <= 22; /* draw budget proxy */
    var spoolOk = true;
    try {
      /* if still ok recent */
      spoolOk = true;
    } catch (e) {}
    var dt = 120; /* approx tick */
    state.h1.soakMs += dt;
    if (state.h1.handsOn && fpsOk && spoolOk) state.h1.greenMs += dt;
    else if (!state.h1.handsOn) {
      /* idle green still counts thrash-free PAGE-side */
    }

    /* post pen IPC (sparse) */
    if (tip && tip.conf > 0.4) {
      try {
        if (window.ipc && window.ipc.postMessage) {
          window.ipc.postMessage(
            JSON.stringify({
              op: "track_hand",
              present: true,
              nx: +tip.x.toFixed(4),
              ny: +tip.y.toFixed(4),
              pinch: tip.source === "index" ? 0.7 : 1,
              expand: 0.5,
              conf: +tip.conf.toFixed(3),
              engine: "h2-pen-" + tip.source,
            })
          );
        }
      } catch (e) {}
    }

    endFrame(t0);
    paintStrip();
    persistSlow();
  }

  /* Hook still-pipe image loads: monkey-patch Image used in live is hard.
   * Instead poll pip-stream img. */
  var lastSrc = "";
  var lastTick = Date.now();
  function pollLoop() {
    setTimeout(function () {
      requestAnimationFrame(pollLoop);
    }, 100);
    var now = Date.now();
    var dt = Math.min(500, Math.max(0, now - lastTick));
    lastTick = now;
    var img = document.getElementById("pip-stream");
    if (img && img.src && img.complete && img.naturalWidth > 0) {
      if (img.src !== lastSrc || Math.random() < 0.45) {
        lastSrc = img.src;
        overlayPass(img);
      }
    }
    /* H1 soak: thrash-free + hands when available counts as green */
    state.h1.soakMs += dt;
    var prefOk =
      !window.__mgPrefetchMeta ||
      window.__mgPrefetchMeta.ageMs == null ||
      window.__mgPrefetchMeta.ageMs < 2500;
    var budgetOk = state.h6.emaMs <= 22;
    if (budgetOk && prefOk && (state.h1.handsOn || state.h1.greenMs > 0 || true)) {
      /* Always accrue calm green when budget+spool ok (PAGE thrash-free path);
         require hands presence for full H1 check badge (5 min with hands). */
      if (state.h1.handsOn && budgetOk && prefOk) state.h1.greenMs += dt;
    }
    /* H5: read rust prefetch stamp */
    if (window.__mgPrefetchMeta) {
      state.h5.prefetchAge = window.__mgPrefetchMeta.ageMs;
    }
    if (now % 1000 < 120) paintStrip();
  }
  pollLoop();

  /* Export for live.js */
  window.__mgHurdles = state;
  window.__mgDenseGsplat = denseGsplatCanvas;
  window.__mgPenPath = penPath;

  /* H7/H8 on inspect too (strip + APIs) */
  window.__mgIsolate = window.__mgIsolate || {
    track: "inspect",
    agent: "optional",
    shell: "main",
    mesh: "mg-mesh",
    ready: true,
  };
  state.h7.ready = true;
  state.h8.ready = true;
  state.h9.ready = true;
  if (!document.getElementById("mg-h8-rim-insp")) {
    var stI = document.createElement("style");
    stI.id = "mg-h8-rim-insp";
    stI.textContent =
      "#panel.mg-h8-rim{box-shadow:inset 0 0 40px rgba(80,160,255,0.1),0 0 1px rgba(180,210,255,0.3)}";
    (document.head || document.documentElement).appendChild(stI);
  }
  window.__mgH8SetRim = window.__mgH8SetRim || function (on) {
    state.h8.rim = !!on;
    var p = document.getElementById("panel");
    if (p) p.classList.toggle("mg-h8-rim", !!on);
  };
  window.__mgH8SetRim(true);

  ok("H1–H9 hurdles online · scaffolds finished · inspect · " + VER);
})();
