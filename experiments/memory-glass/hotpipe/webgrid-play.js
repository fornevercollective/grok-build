/* Memory Glass · WebGrid helper (WKWebView only)
 *
 * Calibrated from Neuralink page source:
 *   pages_webgrid.page.*.js
 *   - target fill rgb(10,132,255)
 *   - hit on window pointerup: cell = col + N*row
 *   - BPS = max(log2(N²-1) * NTPM/60, 0)
 *   - NTPM = net hits in last 60s (+1 hit, -1 miss)
 *   - duration 70s; desktop N=30, mobile N=12
 *   - no isTrusted check → synthetic pointerup works if coords match
 *
 * Autoplay off unless ?mg_autoplay=1 | localStorage play_once | AgentPlayOnce
 * VER: webgrid-play-v20-score-truth
 *
 * Safari reference (user screenshots):
 *   ⌘− zoom OUT → dense 30×30 (many small cells)
 *   ⌘+ zoom IN  → big-cell 12×12 (few large cells)
 * Neuralink: resize listener sets N = (innerWidth≤751 || innerHeight≤600) ? 12 : 30
 * WK pageZoom alone often does NOT shrink innerWidth (unlike Safari View→Zoom),
 * so we Safari-emulate effective CSS viewport = base / zoom, then fire resize.
 * Canvas keeps real layout px → 12 cells look big, 30 look dense (matches Safari shots).
 * ⌘0 = 100% / 30×30 desktop.
 * Local LLM pace: ?mg_local_llm=1 polls http://127.0.0.1:9880/pace (llama3.2:1b advisor).
 * P-001 score truth: NEVER use marketing body BPS/grid (10.39 / 40×40); sidebar+peak only.
 * P-002 Intel laptop: auto pace profile + play-perf (throttle redraws, keep floats).
 * P-003 All dual-space floats LIVE during WebGrid play (contrail/maze/bloch/rubik/beats/board/kb).
 * VER: webgrid-play-v23-floats-live
 */
(function () {
  "use strict";
  try {
    if (!/neuralink\.com$/i.test(location.hostname) || !/webgrid/i.test(location.pathname)) return;
  } catch (e0) {
    return;
  }
  var VER = "webgrid-play-v23-floats-live";
  if (window.__mgWebgridPlayVer === VER) return;
  /* Hot-reload: tear down prior inject (v15 listeners / intervals) */
  if (typeof window.__mgWebgridPlayTeardown === "function") {
    try {
      window.__mgWebgridPlayTeardown();
    } catch (eTd) {}
  }
  window.__mgWebgridPlayVer = VER;
  window.__mgWebgridChromeV15 = true;
  window.__mgWebgridChromeV16 = true;
  /* Safari goes well past 135% — tall windows need ~2× to trip height≤600 */
  var ZOOM_MIN = 0.5;
  var ZOOM_MAX = 2.5;
  var ZOOM_STEP = 0.1;
  /* Neuralink chunk-2PRjh2Ou: mobileMin=751, mobileMaxHeightLandscape=600 */
  var NL_MOBILE_W = 751;
  var NL_MOBILE_H = 600;

  /* Exact blue from page: fillStyle = "rgb(10, 132, 255)" */
  var TARGET_R = 10,
    TARGET_G = 132,
    TARGET_B = 255;
  var ROUND_S = 70;
  var _fillTimer = null;
  /* Offline pace (webgrid-pace-advisor.py → collector /pace) */
  var PACE_URL = "http://127.0.0.1:9880/pace";
  /* Intel UHD + Retina: sleep_ms 4 is too hot → ghost misses + UI lag */
  var PACE_PROFILES = {
    fast: { sleep_ms: 4, wait_loops: 16, mode: "fast", source: "profile-fast" },
    heavy: { sleep_ms: 9, wait_loops: 13, mode: "heavy-retina", source: "profile-heavy" },
    intel: { sleep_ms: 18, wait_loops: 14, mode: "intel-buffer", source: "profile-intel" },
  };
  var _pace = Object.assign({}, PACE_PROFILES.intel);
  var _paceTimer = null;
  var _imgCache = { t: 0, w: 0, h: 0, data: null, c: null };
  var _scoreCache = { t: 0, sc: null };
  var _playBusy = false;
  var _adaptClicks = 0;

  function wantsLocalLlm() {
    try {
      if (/[?&]mg_local_llm=1\b/i.test(location.search)) return true;
      if (localStorage.getItem("mg.local_llm") === "1") return true;
    } catch (e) {}
    return false;
  }

  /** Detect laptop class for default agent pace (MacBookPro16,1 Intel bench). */
  function detectPaceProfile() {
    try {
      var q = /[?&]mg_pace=(intel|fast|heavy)\b/i.exec(location.search);
      if (q) return q[1].toLowerCase();
    } catch (e0) {}
    try {
      var ls = localStorage.getItem("mg.webgrid.pace_profile");
      if (ls && PACE_PROFILES[ls]) return ls;
    } catch (e1) {}
    try {
      var dpr = window.devicePixelRatio || 1;
      var cores = navigator.hardwareConcurrency || 4;
      var area = (window.innerWidth || 1) * (window.innerHeight || 1) * dpr * dpr;
      var ua = navigator.userAgent || "";
      /* Intel Macs often report "Intel" in UA on older macOS; also high-DPR + ≤8 cores */
      if (/Intel/i.test(ua) || /MacBookPro1[456]/i.test(ua)) return "intel";
      if (cores <= 8 && dpr >= 2) return "intel";
      if (area > 3.5e6) return "heavy";
    } catch (e2) {}
    return "fast";
  }

  function applyPaceProfile(name, source) {
    var p = PACE_PROFILES[name] || PACE_PROFILES.intel;
    _pace.sleep_ms = p.sleep_ms;
    _pace.wait_loops = p.wait_loops;
    _pace.mode = p.mode;
    _pace.source = source || p.source || name;
    try {
      localStorage.setItem("mg.webgrid.pace_profile", name);
    } catch (e) {}
    return _pace;
  }

  function setPlayBusy(on) {
    _playBusy = !!on;
    try {
      window.__mgWebgridPlayBusy = _playBusy;
      document.documentElement.classList.toggle("mg-webgrid-play-busy", _playBusy);
    } catch (e) {}
    /* Keep ALL dual-space floats LIVE during WebGrid play (user lab surface).
       Perf = throttle redraws only — never auto-close maze/bloch/rubik/beats/board/contrail. */
    try {
      if (_playBusy) openPlayFloats();
    } catch (e2) {}
  }

  function openPlayFloats() {
    try {
      if (window.__mgContrail) {
        if (window.__mgContrail.setOverlay) window.__mgContrail.setOverlay(true);
        /* flow optional — leave if user opened it */
      }
    } catch (e) {}
    try {
      if (window.__mgMemoryMaze && window.__mgMemoryMaze.open) window.__mgMemoryMaze.open();
    } catch (e2) {}
    try {
      if (window.__mgBlochSolve) {
        if (window.__mgBlochSolve.setEnabled) window.__mgBlochSolve.setEnabled(true);
        if (window.__mgBlochSolve.open) window.__mgBlochSolve.open();
      }
    } catch (e3) {}
    try {
      if (window.__mgRubikLang && window.__mgRubikLang.open) window.__mgRubikLang.open();
    } catch (e4) {}
    try {
      if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.open)
        window.__mgKeyboardBeats.open();
    } catch (e5) {}
    try {
      if (window.__mgActivityBoard && window.__mgActivityBoard.open)
        window.__mgActivityBoard.open();
    } catch (e6) {}
    try {
      if (window.__mgSportsField && window.__mgSportsField.open)
        window.__mgSportsField.open();
    } catch (e6b) {}
    try {
      if (window.__mgFloatKb && window.__mgFloatKb.open) {
        /* keyboard optional — open only if previously used; leave user control */
      }
    } catch (e7) {}
    log(VER + " · play floats live (contrail/maze/bloch/rubik/beats/board/field)");
  }

  function adaptPace(hitsGuess, missGuess) {
    var total = hitsGuess + missGuess;
    if (total < 12 || total % 10 !== 0) return;
    var missRate = missGuess / Math.max(1, total);
    if (missRate > 0.28 && _pace.sleep_ms < 22) {
      _pace.sleep_ms = Math.min(22, _pace.sleep_ms + 2);
      _pace.wait_loops = Math.max(10, _pace.wait_loops - 1);
      _pace.mode = "adapt-slow";
      _pace.source = "adapt";
      log("pace adapt slower sleep=" + _pace.sleep_ms + " miss%=" + Math.round(missRate * 100));
    } else if (missRate < 0.12 && _pace.sleep_ms > 5) {
      _pace.sleep_ms = Math.max(5, _pace.sleep_ms - 1);
      _pace.mode = "adapt-fast";
      _pace.source = "adapt";
    }
  }

  /* Boot pace profile immediately */
  (function bootPace() {
    var name = detectPaceProfile();
    applyPaceProfile(name, "boot-" + name);
    log(VER + " · pace profile " + name + " sleep=" + _pace.sleep_ms + " wait=" + _pace.wait_loops);
  })();

  function pullPace() {
    if (!wantsLocalLlm()) return;
    try {
      fetch(PACE_URL, { method: "GET", cache: "no-store" })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (j) {
          if (!j || typeof j !== "object") return;
          var s = parseInt(j.sleep_ms, 10);
          var w = parseInt(j.wait_loops, 10);
          if (isFinite(s) && s >= 2 && s <= 40) _pace.sleep_ms = s;
          if (isFinite(w) && w >= 4 && w <= 30) _pace.wait_loops = w;
          if (j.mode) _pace.mode = String(j.mode);
          if (j.source) _pace.source = String(j.source);
          if (j.note) _pace.note = String(j.note).slice(0, 80);
        })
        .catch(function () {});
    } catch (eP) {}
  }

  function startPaceLoop() {
    if (!wantsLocalLlm()) return;
    pullPace();
    if (_paceTimer) return;
    _paceTimer = setInterval(pullPace, 4000);
    log(VER + " · local LLM pace poll → " + PACE_URL);
  }
  var _origInnerW = null;
  var _origInnerH = null;
  var _origClientW = null;
  var _origClientH = null;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "webgrid");
    } catch (e) {}
    try {
      console.log("[mg-webgrid]", m);
    } catch (e2) {}
  }

  /**
   * Neuralink caps the play canvas: max-height: calc(100dvh - 20rem) — leaves empty
   * space when the MG window is filled. We expand the play area + optional zoom.
   * Override zoom: localStorage mg.webgrid.zoom = "0.85" (0.5–2.5), default 1.0.
   */
  function desiredZoom() {
    try {
      var z = parseFloat(localStorage.getItem("mg.webgrid.zoom") || "");
      if (z >= ZOOM_MIN && z <= ZOOM_MAX) return z;
    } catch (e) {}
    /* Prefer layout fill over shrinking the whole page (1.0 = use full window) */
    return 1.0;
  }

  function clampZoom(z) {
    z = Number(z);
    if (!isFinite(z)) z = 1.0;
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z * 100) / 100));
  }

  /** Native getters (before spoof) — Safari-like effective CSS px = base / zoom */
  function installViewportSpoof() {
    if (window.__mgVpSpoofInstalled) return;
    window.__mgVpSpoofInstalled = true;
    window.__mgVpZ = 1;
    window.__mgVpBaseW = 0;
    window.__mgVpBaseH = 0;

    try {
      _origInnerW = Object.getOwnPropertyDescriptor(window, "innerWidth");
      if (!_origInnerW || !_origInnerW.get) {
        _origInnerW = Object.getOwnPropertyDescriptor(Window.prototype, "innerWidth");
      }
      _origInnerH = Object.getOwnPropertyDescriptor(window, "innerHeight");
      if (!_origInnerH || !_origInnerH.get) {
        _origInnerH = Object.getOwnPropertyDescriptor(Window.prototype, "innerHeight");
      }
    } catch (e0) {}

    function nativeW() {
      try {
        if (_origInnerW && _origInnerW.get) return _origInnerW.get.call(window);
      } catch (e) {}
      return window.__mgVpBaseW || 1280;
    }
    function nativeH() {
      try {
        if (_origInnerH && _origInnerH.get) return _origInnerH.get.call(window);
      } catch (e) {}
      return window.__mgVpBaseH || 800;
    }
    window.__mgNativeInnerWidth = nativeW;
    window.__mgNativeInnerHeight = nativeH;

    function refreshBase() {
      var z = window.__mgVpZ || 1;
      /* Only sample native size when not spoofing (z≈1) */
      if (z >= 0.95 && z <= 1.05) {
        window.__mgVpBaseW = nativeW();
        window.__mgVpBaseH = nativeH();
      } else if (!window.__mgVpBaseW || !window.__mgVpBaseH) {
        window.__mgVpBaseW = nativeW();
        window.__mgVpBaseH = nativeH();
      }
    }
    window.__mgVpRefreshBase = refreshBase;
    refreshBase();

    try {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        enumerable: true,
        get: function () {
          var z = window.__mgVpZ || 1;
          if (z >= 0.98 && z <= 1.02) return nativeW();
          var b = window.__mgVpBaseW || nativeW();
          return Math.max(1, Math.round(b / z));
        },
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        enumerable: true,
        get: function () {
          var z = window.__mgVpZ || 1;
          if (z >= 0.98 && z <= 1.02) return nativeH();
          var b = window.__mgVpBaseH || nativeH();
          return Math.max(1, Math.round(b / z));
        },
      });
    } catch (eDef) {
      log("viewport spoof define failed: " + eDef);
    }

    /* documentElement clientWidth/Height also used by some layout paths */
    try {
      var de = Document.prototype;
      _origClientW = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
      _origClientH = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
      /* lighter touch: only patch documentElement via getter override on instance if needed */
    } catch (eC) {}
  }

  /**
   * Apply zoom like Safari View → Zoom In/Out:
   * 1) Emulate CSS viewport shrink (base/z) so Neuralink flips 12↔30
   * 2) Keep WK pageZoom at 1 — cells already grow/shrink with N; pageZoom would crop
   * 3) Fire resize so React useEffect re-evaluates mobile breakpoint
   */
  function applyWebgridZoomOut(force) {
    var z = clampZoom(desiredZoom());
    if (!force && window.__mgWebgridZoom === z) {
      return z;
    }
    installViewportSpoof();
    window.__mgVpZ = z;
    try {
      if (typeof window.__mgVpRefreshBase === "function") window.__mgVpRefreshBase();
    } catch (eR) {}

    try {
      document.documentElement.style.zoom = "1";
      if (document.body) document.body.style.zoom = "1";
      document.documentElement.style.setProperty("--mg-webgrid-zoom", String(z));
    } catch (eZ) {}

    /* pageZoom only when zooming OUT below 100% (fit more chrome); zoom-in uses viewport spoof */
    var pageZ = z < 0.98 ? z : 1.0;
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(JSON.stringify({ op: "page_zoom", scale: pageZ }));
      }
    } catch (eI) {}
    try {
      window.__mgWebgridZoom = z;
    } catch (e2) {}
    try {
      window.dispatchEvent(new Event("resize"));
      kickCanvasResize();
    } catch (eK) {}
    return z;
  }

  function layoutReport() {
    var w = window.innerWidth || 0;
    var h = window.innerHeight || 0;
    var nw = 0,
      nh = 0;
    try {
      nw = window.__mgNativeInnerWidth ? window.__mgNativeInnerWidth() : w;
      nh = window.__mgNativeInnerHeight ? window.__mgNativeInnerHeight() : h;
    } catch (eN) {}
    /* Neuralink: width≤751 OR height≤600 → 12 else 30 */
    var mobile = w <= NL_MOBILE_W || h <= NL_MOBILE_H;
    var expect = mobile ? 12 : 30;
    var sc = null;
    try {
      sc = scrapeScore();
    } catch (e) {}
    var live = sc && sc.grid ? sc.grid : expect + "x" + expect;
    return {
      w: w,
      h: h,
      nativeW: nw,
      nativeH: nh,
      expectN: expect,
      liveGrid: live,
      zoom: window.__mgWebgridZoom || desiredZoom(),
    };
  }

  /** ⌘+ bigger cells (→12×12) · ⌘− denser 30×30 · ⌘0 reset */
  function nudgeZoom(delta) {
    var cur =
      window.__mgWebgridZoom != null && isFinite(window.__mgWebgridZoom)
        ? window.__mgWebgridZoom
        : desiredZoom();
    var next = clampZoom(cur + delta);
    try {
      localStorage.setItem("mg.webgrid.zoom", String(next));
    } catch (e) {}
    window.__mgWebgridZoom = null;
    var z = applyWebgridZoomOut(true);
    setTimeout(function () {
      var r = layoutReport();
      log(
        "zoom " +
          Math.round(z * 100) +
          "% · eff " +
          r.w +
          "×" +
          r.h +
          " (native " +
          r.nativeW +
          "×" +
          r.nativeH +
          ") · expect " +
          r.expectN +
          "×" +
          r.expectN +
          " · live " +
          r.liveGrid +
          " · Safari: ⌘+ →12 / ⌘− →30"
      );
    }, 100);
    return z;
  }

  function resetZoom() {
    try {
      localStorage.removeItem("mg.webgrid.zoom");
    } catch (e) {}
    window.__mgWebgridZoom = null;
    var z = applyWebgridZoomOut(true);
    setTimeout(function () {
      var r = layoutReport();
      log("zoom reset " + Math.round(z * 100) + "% · live " + r.liveGrid);
    }, 100);
    return z;
  }

  /**
   * Snap to Safari screenshot modes:
   * - 30×30 dense: zoom 100% (desktop viewport)
   * - 12×12 big cells: zoom just past mobile breakpoint (W≤751 | H≤600)
   */
  function zoomForGrid(n) {
    n = n === 12 ? 12 : 30;
    installViewportSpoof();
    try {
      if (typeof window.__mgVpRefreshBase === "function") {
        window.__mgVpZ = 1;
        window.__mgVpRefreshBase();
      }
    } catch (eB) {}
    if (n === 30) {
      try {
        localStorage.setItem("mg.webgrid.zoom", "1");
      } catch (e) {}
      window.__mgWebgridZoom = null;
      applyWebgridZoomOut(true);
      log("zoomForGrid 30×30 dense → 100% (Safari zoom-out)");
      return 1;
    }
    var bw = window.__mgVpBaseW || (window.__mgNativeInnerWidth && window.__mgNativeInnerWidth()) || 1280;
    var bh = window.__mgVpBaseH || (window.__mgNativeInnerHeight && window.__mgNativeInnerHeight()) || 800;
    /* need base/z ≤ 751 OR base/z ≤ 600 → z ≥ base/751 or base/600 */
    var zW = (bw + 1) / NL_MOBILE_W;
    var zH = (bh + 1) / NL_MOBILE_H;
    var z = clampZoom(Math.min(ZOOM_MAX, Math.max(zW, zH, 1.15) + 0.02));
    try {
      localStorage.setItem("mg.webgrid.zoom", String(z));
    } catch (e2) {}
    window.__mgWebgridZoom = null;
    applyWebgridZoomOut(true);
    log(
      "zoomForGrid 12×12 big-cell → " +
        Math.round(z * 100) +
        "% (Safari zoom-in · eff ≤" +
        NL_MOBILE_W +
        "×" +
        NL_MOBILE_H +
        ")"
    );
    return z;
  }

  function onZoomKey(ev) {
    /* Cmd on Mac, Ctrl elsewhere */
    if (!(ev.metaKey || ev.ctrlKey) || ev.altKey || ev.shiftKey) return;
    var k = ev.key;
    var code = ev.code;
    /* Zoom out: denser / 30×30 territory (Safari ⌘−) */
    if (k === "-" || k === "_" || code === "Minus" || code === "NumpadSubtract") {
      ev.preventDefault();
      ev.stopPropagation();
      nudgeZoom(-ZOOM_STEP);
      return;
    }
    /* Zoom in: bigger cells / 12×12 territory (Safari ⌘+) */
    if (k === "=" || k === "+" || code === "Equal" || code === "NumpadAdd") {
      ev.preventDefault();
      ev.stopPropagation();
      nudgeZoom(ZOOM_STEP);
      return;
    }
    if (k === "0" || code === "Digit0" || code === "Numpad0") {
      ev.preventDefault();
      ev.stopPropagation();
      resetZoom();
    }
  }

  /** Kick Neuralink's canvas resize (min(clientW, clientH) of container) */
  function kickCanvasResize() {
    try {
      window.dispatchEvent(new Event("resize"));
    } catch (e) {}
    try {
      var c = document.querySelector("canvas._canvas_1wslk_27") || document.querySelector("canvas");
      var box = document.querySelector("._container_1wslk_16");
      if (c && box) {
        var a = Math.min(box.clientWidth, box.clientHeight);
        if (a > 40) {
          c.style.width = a + "px";
          c.style.height = a + "px";
          var dpr = window.devicePixelRatio || 1;
          c.width = Math.floor(a * dpr);
          c.height = Math.floor(a * dpr);
        }
      }
    } catch (e2) {}
  }

  function hideMgChrome() {
    try {
      document.documentElement.classList.add("mg-webgrid-play");
      document.documentElement.style.setProperty("--mg-page-pad-bot", "0px");
      document.documentElement.style.setProperty("--mg-page-pad-top", "0px");
      /* Kill Neuralink nav offset so root can use full height */
      document.documentElement.style.setProperty("--root-nav-height", "0px");
      if (document.body) {
        document.body.style.setProperty("padding-top", "0", "important");
        document.body.style.setProperty("padding-bottom", "0", "important");
        document.body.style.setProperty("margin", "0", "important");
        document.body.style.setProperty("overflow", "hidden", "important");
      }
    } catch (e) {}
    applyWebgridZoomOut();
    var st = document.getElementById("mg-webgrid-chrome-hide");
    if (!st) {
      st = document.createElement("style");
      st.id = "mg-webgrid-chrome-hide";
      (document.head || document.documentElement).appendChild(st);
    }
    st.textContent =
      "html.mg-webgrid-play #mg-tabs," +
      "html.mg-webgrid-play #mg-tab-row," +
      "html.mg-webgrid-play #mg-search-dock," +
      "html.mg-webgrid-play #mg-search-peek," +
      "html.mg-webgrid-play #mg-stoplights," +
      "html.mg-webgrid-play #mg-top-right," +
      "html.mg-webgrid-play #mg-mode-menu," +
      "html.mg-webgrid-play #mg-tab," +
      "html.mg-webgrid-play .mg-edge," +
      "html.mg-webgrid-play .mg-grip," +
      "html.mg-webgrid-play #mg-dragon," +
      "html.mg-webgrid-play #mg-panel," +
      "html.mg-webgrid-play #mg-dev," +
      "html.mg-webgrid-play #mg-scrim{" +
      "  display:none!important;visibility:hidden!important;pointer-events:none!important;opacity:0!important;}" +
      "html.mg-webgrid-play,html.mg-webgrid-play body{" +
      "  padding:0!important;margin:0!important;overflow:hidden!important;height:100%!important;" +
      "  width:100%!important;max-width:100%!important;}" +
      "html.mg-webgrid-play #mg-root{pointer-events:none!important;}" +
      "html.mg-webgrid-play canvas,html.mg-webgrid-play button,html.mg-webgrid-play a,html.mg-webgrid-play input{" +
      "  pointer-events:auto!important;}" +
      /* ── FILL PLAY AREA (override Neuralink max-height: 100dvh - 20rem) ── */ +
      "html.mg-webgrid-play{--root-nav-height:0px!important;}" +
      "html.mg-webgrid-play header," +
      "html.mg-webgrid-play nav," +
      "html.mg-webgrid-play [class*='Nav']," +
      "html.mg-webgrid-play [class*='nav_']," +
      "html.mg-webgrid-play [class*='Header']," +
      "html.mg-webgrid-play [class*='header_']{" +
      "  display:none!important;height:0!important;min-height:0!important;overflow:hidden!important;}" +
      "html.mg-webgrid-play ._root_1bxtc_16{" +
      "  margin-top:0!important;margin:0!important;padding:0.4rem!important;" +
      "  height:100dvh!important;max-height:100dvh!important;width:100%!important;" +
      "  max-width:100vw!important;box-sizing:border-box!important;" +
      "  display:flex!important;align-items:stretch!important;justify-content:center!important;}" +
      "html.mg-webgrid-play ._gameplay_1bxtc_131{" +
      "  height:100%!important;width:100%!important;max-width:100%!important;" +
      "  gap:0.75rem!important;align-items:center!important;justify-content:center!important;" +
      "  box-sizing:border-box!important;}" +
      /* Canvas container: use almost entire viewport (was 100dvh - 20rem) */ +
      "html.mg-webgrid-play ._container_1wslk_16{" +
      "  flex:1 1 auto!important;width:100%!important;height:100%!important;" +
      "  max-height:none!important;max-height:min(98dvh,100%)!important;" +
      "  min-height:0!important;overflow:hidden!important;" +
      "  display:flex!important;align-items:center!important;justify-content:center!important;}" +
      "html.mg-webgrid-play ._canvas_1wslk_27{" +
      "  max-width:min(96vw,96vh)!important;max-height:min(96vw,96vh)!important;" +
      "  width:min(96vw,96vh)!important;height:min(96vw,96vh)!important;}" +
      /* Compact sidebar so grid gets the pixels */ +
      "html.mg-webgrid-play ._sidebar_1bxtc_139{" +
      "  flex:0 0 auto!important;min-width:10rem!important;max-width:16rem!important;" +
      "  margin:0!important;padding:0.5rem!important;}" +
      "html.mg-webgrid-play ._timer_1bxtc_69," +
      "html.mg-webgrid-play ._bigScore_1bxtc_69{" +
      "  font-size:clamp(1.8rem,4vw,3.2rem)!important;letter-spacing:-0.04em!important;}" +
      "html.mg-webgrid-play ._smallScore_1bxtc_74{" +
      "  font-size:clamp(1rem,2vw,1.6rem)!important;margin-top:0!important;}";
    kickCanvasResize();
    log(VER + " · fill play area · zoom " + desiredZoom());
  }

  /** How many agent rounds to run (1–5). URL ?mg_autoplay=3 or localStorage mg.webgrid.play_rounds */
  function autoplayRounds() {
    try {
      var m = location.search.match(/[?&]mg_autoplay=(\d+)\b/);
      if (m) {
        var n = parseInt(m[1], 10);
        if (n >= 1 && n <= 5) return n;
      }
      var ls = parseInt(localStorage.getItem("mg.webgrid.play_rounds") || "", 10);
      if (ls >= 1 && ls <= 5) {
        localStorage.removeItem("mg.webgrid.play_rounds");
        return ls;
      }
    } catch (e) {}
    return 1;
  }

  function wantAutoplay() {
    try {
      if (/[?&]mg_autoplay=\d+\b/.test(location.search)) return true;
      if (localStorage.getItem("mg.webgrid.autoplay") === "1") return true;
      if (localStorage.getItem("mg.webgrid.play_once") === "1") {
        localStorage.removeItem("mg.webgrid.play_once");
        return true;
      }
      if (window.__mgWebgridAgentPlayOnce) {
        window.__mgWebgridAgentPlayOnce = false;
        return true;
      }
    } catch (e) {}
    return false;
  }

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }
  function findButton(re) {
    var nodes = document.querySelectorAll("button, a, [role=button]");
    for (var i = 0; i < nodes.length; i++) {
      var t = (nodes[i].innerText || "").replace(/\s+/g, " ").trim();
      if (re.test(t)) return nodes[i];
    }
    return null;
  }
  function clickEl(el) {
    if (!el) return;
    try {
      el.scrollIntoView({ block: "center", inline: "center" });
    } catch (e0) {}
    try {
      el.click();
    } catch (e) {}
  }
  function clickAtTrusted(x, y) {
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(JSON.stringify({ op: "click_at", x: x, y: y }));
      }
    } catch (e) {}
  }

  /**
   * Page: window.addEventListener("pointerup", r) — ONE event.
   * Multi-firing pointerup+click_at caused hit then immediate miss (NTPM → negative).
   * Emit a single window pointerup with page coords matching the page hit-test.
   */
  function firePointerAt(clientX, clientY) {
    var sx = window.scrollX || 0,
      sy = window.scrollY || 0;
    var pageX = clientX + sx,
      pageY = clientY + sy;
    var common = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: clientX,
      clientY: clientY,
      pageX: pageX,
      pageY: pageY,
      screenX: clientX,
      screenY: clientY,
      button: 0,
      buttons: 0,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      width: 1,
      height: 1,
    };
    try {
      window.dispatchEvent(new PointerEvent("pointerup", common));
    } catch (eP) {
      try {
        window.dispatchEvent(
          new MouseEvent("mouseup", {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: clientX,
            clientY: clientY,
            pageX: pageX,
            pageY: pageY,
            button: 0,
          })
        );
      } catch (eM) {}
    }
  }

  /**
   * Score scrape (P-001 truth):
   * - LIVE: only "MM:SS BPS NTPM · N×N" sidebar while playing
   * - PEAK: only "Your peak score: X BPS (Y NTPM)" on end card
   * - NEVER bare "X BPS" (picks marketing 10.39) or bare "N×N" (picks 40×40 copy)
   * - Grid N only 12 or 30 (public page); ignore 16/35/40 marketing
   */
  function scrapeScore() {
    /* Throttle full body.innerText during agent chase (Intel CPU burn) */
    var now = Date.now();
    var ttl = _playBusy ? 90 : 40;
    if (_scoreCache.sc && now - _scoreCache.t < ttl) return _scoreCache.sc;
    var body = ((document.body && document.body.innerText) || "").replace(/\s+/g, " ");
    var bps = null,
      ntpm = null,
      timer = null,
      grid = null;
    var phase = "lobby";
    var mSide = body.match(
      /(\d{1,2}:\d{2})\s+([\d.]+)\s*BPS\s+(-?[\d.]+)\s*NTPM\s*[·•.]\s*(\d+)\s*[×x]\s*(\d+)/i
    );
    if (mSide) {
      timer = mSide[1];
      bps = parseFloat(mSide[2]);
      ntpm = parseFloat(mSide[3]);
      var nA = parseInt(mSide[4], 10);
      var nB = parseInt(mSide[5], 10);
      if ((nA === 12 || nA === 30) && nA === nB) {
        grid = nA + "x" + nB;
      }
      phase = timer === "00:00" ? "end" : "playing";
      /* Reject absurd live bps if somehow marketing leaked into same line */
      if (bps === 10.39 && ntpm == null) {
        bps = null;
      }
    }
    var peak = null;
    var mP = body.match(/Your peak score:\s*([\d.]+)\s*BPS\s*\((-?[\d.]+)\s*NTPM\)/i);
    if (!mP) {
      mP = body.match(/peak score:\s*([\d.]+)\s*BPS\s*\((-?[\d.]+)\s*NTPM\)/i);
    }
    if (mP) {
      peak = { bps: parseFloat(mP[1]), ntpm: parseFloat(mP[2]) };
      if (!timer) phase = "end";
    }
    /* End card without live sidebar: use peak as display only, not live */
    if (!timer && peak && /play again/i.test(body)) {
      phase = "end";
    }
    var scOut = {
      bps: bps,
      ntpm: ntpm,
      timer: timer,
      grid: grid,
      phase: phase,
      body: body.slice(0, 500),
      peak: peak,
      truth: true,
    };
    _scoreCache = { t: now, sc: scOut };
    return scOut;
  }

  function detectGridSize() {
    var sc = scrapeScore();
    if (sc.grid) {
      var p = sc.grid.split("x");
      var n = parseInt(p[0], 10);
      /* Public WebGrid: only 12 or 30 — never marketing 40 */
      if (n === 12 || n === 30) return n;
    }
    try {
      if (window.innerWidth <= NL_MOBILE_W || window.innerHeight <= NL_MOBILE_H) return 12;
    } catch (e) {}
    return 30;
  }
  function desktopGridOk() {
    try {
      return window.innerWidth > NL_MOBILE_W && window.innerHeight > NL_MOBILE_H;
    } catch (e) {
      return false;
    }
  }

  function canvasEl() {
    return document.querySelector("canvas._canvas_1wslk_27") || document.querySelector("canvas");
  }

  /**
   * Scan cell centers for exact Neuralink blue (page draws rgb(10,132,255)).
   * Canvas is 2D — same-origin inject can read pixels.
   */
  function findTargetFromCanvas(N) {
    var c = canvasEl();
    if (!c || !N) return null;
    var w = c.width,
      h = c.height;
    if (!w || !h) return null;
    var now = Date.now();
    /* Cache full-frame read — wait loops called this 12–18× per click */
    var data;
    var cacheMs = _playBusy ? 12 : 6;
    if (
      _imgCache.data &&
      _imgCache.c === c &&
      _imgCache.w === w &&
      _imgCache.h === h &&
      now - _imgCache.t < cacheMs
    ) {
      data = _imgCache.data;
    } else {
      try {
        var ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return null;
        data = ctx.getImageData(0, 0, w, h).data;
        _imgCache = { t: now, w: w, h: h, data: data, c: c };
      } catch (e) {
        return null;
      }
    }
    var cell = w / N;
    var best = null;
    var bestScore = -1;
    /* Intel: 1 center sample first pass; only refine if hit */
    var samplesLite = [[0.5, 0.5]];
    var samplesFull = [
      [0.5, 0.5],
      [0.35, 0.35],
      [0.65, 0.65],
    ];
    var samples = _pace.sleep_ms >= 10 ? samplesLite : samplesFull;
    for (var row = 0; row < N; row++) {
      for (var col = 0; col < N; col++) {
        var hits = 0;
        for (var s = 0; s < samples.length; s++) {
          var px = Math.min(w - 1, Math.floor((col + samples[s][0]) * cell));
          var py = Math.min(h - 1, Math.floor((row + samples[s][1]) * cell));
          var i = (py * w + px) * 4;
          var R = data[i],
            G = data[i + 1],
            B = data[i + 2];
          if (Math.abs(R - TARGET_R) <= 18 && Math.abs(G - TARGET_G) <= 45 && B >= 200) hits++;
        }
        if (hits > bestScore) {
          bestScore = hits;
          if (hits > 0) best = { col: col, row: row, index: col + N * row, conf: hits };
        }
      }
    }
    if (!best || bestScore < 1) return null;
    var rect = c.getBoundingClientRect();
    var cellCss = rect.width / N;
    return {
      col: best.col,
      row: best.row,
      index: best.index,
      conf: best.conf,
      clientX: rect.left + (best.col + 0.5) * cellCss,
      clientY: rect.top + (best.row + 0.5) * cellCss,
      rect: rect,
      N: N,
    };
  }

  /** BPS from page formula: max(log2(N*N-1) * ntpm / 60, 0) */
  function bpsFromNtpm(ntpm, N) {
    if (!ntpm || ntpm <= 0 || !N) return 0;
    return Math.max((Math.log(N * N - 1) / Math.LN2) * (ntpm / 60), 0);
  }

  function report(kind, extra) {
    try {
      var sc = scrapeScore();
      var o = Object.assign(
        {
          kind: kind,
          ver: VER,
          t: Date.now(),
          bps: sc.bps,
          ntpm: sc.ntpm,
          timer: sc.timer,
          grid: sc.grid,
          peak: sc.peak,
        },
        extra || {}
      );
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({
            op: "dev_log",
            lvl: "info",
            src: "webgrid-watch",
            msg: "MGW:" + JSON.stringify(o),
          })
        );
      }
      window.__mgAgentPlayLast = o;
    } catch (eR) {}
  }

  async function playOneRound(roundIdx, roundsTotal) {
    log(
      VER +
        " · AGENT round " +
        (roundIdx + 1) +
        "/" +
        roundsTotal +
        " · 30×30 blue chase · beat prior 483.58"
    );
    if (!desktopGridOk()) {
      log(
        "WARN viewport " +
          window.innerWidth +
          "x" +
          window.innerHeight +
          " → Neuralink uses 12×12 (need h>600). Resize MG large/fullscreen."
      );
    } else {
      log("viewport " + window.innerWidth + "x" + window.innerHeight + " → expect 30×30");
    }
    /* force desktop zoom so N stays 30 */
    try {
      localStorage.setItem("mg.webgrid.zoom", "1");
      window.__mgWebgridZoom = null;
      applyWebgridZoomOut(true);
    } catch (eZ) {}

    report("agent_start", {
      formula: "BPS=log2(N^2-1)*NTPM/60",
      viewport: [window.innerWidth, window.innerHeight],
      desktopOk: desktopGridOk(),
      round: roundIdx + 1,
      rounds: roundsTotal,
      targetBeat: 483.58,
    });
    await sleep(roundIdx === 0 ? 400 : 250);

    /* cookie / privacy banner — must clear before canvas hits register */
    async function dismissConsent() {
      var tries = [
        /^accept all$/i,
        /accept all/i,
        /^accept$/i,
        /allow all/i,
        /agree/i,
        /^decline$/i,
        /decline/i,
        /essential only/i,
        /reject all/i,
      ];
      for (var pass = 0; pass < 4; pass++) {
        var hit = false;
        for (var ti = 0; ti < tries.length; ti++) {
          var b = findButton(tries[ti]);
          if (b) {
            clickEl(b);
            hit = true;
            log("consent click · " + ((b.innerText || "").slice(0, 40)));
            await sleep(220);
            break;
          }
        }
        if (!hit) break;
        await sleep(120);
      }
    }
    await dismissConsent();

    /* lobby */
    var d = findButton(/^decline$/i) || findButton(/decline/i);
    if (d) {
      clickEl(d);
      await sleep(200);
    }
    for (var t = 0; t < 14; t++) {
      await dismissConsent();
      var s =
        findButton(/^start game$/i) ||
        findButton(/start game/i) ||
        findButton(/^play again$/i) ||
        findButton(/play again/i);
      if (s) {
        clickEl(s);
        await sleep(350);
      }
      if (canvasEl() && scrapeScore().timer) break;
      if (findButton(/blue/i)) {
        await sleep(250);
      }
      await sleep(180);
    }

    /* wait for canvas + timer */
    for (var w = 0; w < 50; w++) {
      if (canvasEl() && (scrapeScore().timer || document.querySelector("._gameplay_1bxtc_131"))) break;
      var s2 = findButton(/^start game$/i) || findButton(/play again/i);
      if (s2) clickEl(s2);
      await sleep(120);
    }

    var N = detectGridSize();
    if (desktopGridOk() && N === 12) {
      log("page still 12×12 despite desktop viewport — restart after resize");
    }
    try {
      if (window.__mgUgradWebgrid) window.__mgUgradWebgrid.ensureModel(N);
    } catch (eT0) {}
    var tEnd = Date.now() + (ROUND_S + 10) * 1000;
    var clicks = 0,
      hitsGuess = 0,
      missGuess = 0;
    var lastIndex = -1;
    var bestBps = 0,
      bestNtpm = 0;
    var livePeakBps = 0,
      livePeakNtpm = 0;

    startPaceLoop();
    setPlayBusy(true);
    log(
      "chase start N=" +
        N +
        " bps/ntpm factor≈" +
        bpsFromNtpm(1, N).toFixed(4) +
        " pace=" +
        _pace.sleep_ms +
        "ms/" +
        _pace.wait_loops +
        " (" +
        (_pace.source || "?") +
        ")"
    );

    try {
    while (Date.now() < tEnd) {
      var stepMs = _pace.sleep_ms || 4;
      var waitMax = _pace.wait_loops || 18;
      var sc = scrapeScore();
      if (sc.peak && clicks > 3) {
        log("peak screen " + sc.peak.bps + " BPS / " + sc.peak.ntpm + " NTPM");
        if (sc.peak.bps > livePeakBps) {
          livePeakBps = sc.peak.bps;
          livePeakNtpm = sc.peak.ntpm;
        }
        report("agent_end", {
          clicks: clicks,
          hitsGuess: hitsGuess,
          missGuess: missGuess,
          peak: sc.peak,
          bestBps: Math.max(bestBps, livePeakBps),
          bestNtpm: Math.max(bestNtpm, livePeakNtpm),
          round: roundIdx + 1,
          pace: { sleep_ms: stepMs, wait_loops: waitMax, mode: _pace.mode, source: _pace.source },
        });
        break;
      }
      if (/play again/i.test(sc.body || "") && clicks > 5 && !sc.timer) break;

      if (sc.grid) {
        var gn = parseInt(sc.grid.split("x")[0], 10);
        if (gn === 12 || gn === 30) N = gn;
      }
      if (typeof sc.ntpm === "number" && sc.ntpm > bestNtpm) bestNtpm = sc.ntpm;
      /* track full live BPS (old code wrongly capped at 40) */
      if (typeof sc.bps === "number" && isFinite(sc.bps) && sc.bps > bestBps) bestBps = sc.bps;

      var tgt = findTargetFromCanvas(N);
      if (tgt) {
        /* skip re-click same cell until canvas shows a new blue */
        if (tgt.index === lastIndex) {
          await sleep(stepMs);
          continue;
        }
        /* ONE pointerup only — page has no isTrusted check */
        firePointerAt(tgt.clientX, tgt.clientY);
        clicks++;
        hitsGuess++;
        lastIndex = tgt.index;
        _adaptClicks++;
        adaptPace(hitsGuess, missGuess);
        try {
          /* ugrad tensor every other click on intel — save CPU */
          if (window.__mgUgradWebgrid && (clicks % 2 === 0 || _pace.sleep_ms < 8)) {
            window.__mgUgradWebgrid.observeCell(tgt.index, N);
          }
        } catch (eOb) {}
        try {
          /* contrail every 3rd agent hop when paced slow */
          if (
            window.__mgContrail &&
            window.__mgContrail.observeAgent &&
            (clicks % 3 === 0 || _pace.sleep_ms < 8)
          ) {
            window.__mgContrail.observeAgent(tgt.clientX, tgt.clientY, tgt.index, tgt.conf);
          }
        } catch (eCt) {}
        if (clicks % 40 === 0) {
          report("agent_tick", {
            clicks: clicks,
            hitsGuess: hitsGuess,
            cell: tgt.index,
            conf: tgt.conf,
            bps: sc.bps,
            ntpm: sc.ntpm,
            timer: sc.timer,
            N: N,
            round: roundIdx + 1,
            pace: stepMs + "/" + waitMax,
          });
          log(
            "shot cell=" +
              tgt.index +
              " conf=" +
              tgt.conf +
              " bps=" +
              sc.bps +
              " ntpm=" +
              sc.ntpm +
              " t=" +
              sc.timer +
              " pace=" +
              stepMs +
              "/" +
              waitMax
          );
        }
        /* wait until blue moves (hit) or timeout — pace from local LLM advisor */
        var moved = false;
        for (var wait = 0; wait < waitMax; wait++) {
          await sleep(stepMs);
          var t2 = findTargetFromCanvas(N);
          if (!t2 || t2.index !== lastIndex) {
            moved = true;
            if (!t2) lastIndex = -1;
            break;
          }
        }
        if (!moved) {
          missGuess++;
          lastIndex = -1;
          await sleep(8);
        }
      } else {
        missGuess++;
        lastIndex = -1;
        await sleep(6);
        if (missGuess > 200 && clicks === 0) {
          var s3 = findButton(/^start game$/i) || findButton(/play again/i);
          if (s3) clickEl(s3);
          missGuess = 0;
          await sleep(300);
        }
      }
      if (sc.timer === "00:00") {
        await sleep(600);
        break;
      }
    }
    } finally {
      setPlayBusy(false);
    }
    var fin = scrapeScore();
    var peakBps = fin.peak ? fin.peak.bps : bestBps;
    var peakNtpm = fin.peak ? fin.peak.ntpm : bestNtpm;
    if (fin.peak && fin.peak.bps > livePeakBps) {
      livePeakBps = fin.peak.bps;
      livePeakNtpm = fin.peak.ntpm;
    }
    peakBps = Math.max(peakBps, livePeakBps, bestBps);
    peakNtpm = Math.max(peakNtpm, livePeakNtpm, bestNtpm);
    var result = {
      clicks: clicks,
      hitsGuess: hitsGuess,
      missGuess: missGuess,
      bestBps: bestBps,
      bestNtpm: bestNtpm,
      finalBps: fin.bps,
      finalNtpm: fin.ntpm,
      peak: fin.peak || { bps: peakBps, ntpm: peakNtpm },
      peakBps: peakBps,
      peakNtpm: peakNtpm,
      pace: { sleep_ms: _pace.sleep_ms, wait_loops: _pace.wait_loops, mode: _pace.mode, source: _pace.source },
      N: N,
      round: roundIdx + 1,
      rounds: roundsTotal,
      beatPrior: peakBps > 483.58,
    };
    report("agent_end", result);
    log(
      "done r" +
        (roundIdx + 1) +
        " clicks=" +
        clicks +
        " bestBps=" +
        bestBps +
        " bestNtpm=" +
        bestNtpm +
        " peak=" +
        peakBps +
        "/" +
        peakNtpm +
        (peakBps > 483.58 ? " BEAT" : " shy")
    );
    try {
      window.__mgWebgridLastPlay = Object.assign({ ver: VER, t: Date.now() }, result);
      if (!window.__mgWebgridSessionPlays) window.__mgWebgridSessionPlays = [];
      window.__mgWebgridSessionPlays.push(window.__mgWebgridLastPlay);
    } catch (eW) {}
    /* also POST to watch collector if present */
    try {
      fetch("http://127.0.0.1:9880/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ kind: "agent_round_result", ver: VER }, result)),
      });
    } catch (eF) {}
    return result;
  }

  function wantsSmallScale() {
    try {
      if (/[?&]mg_scale=small\b/i.test(location.search)) return true;
      if (/[?&]grid=12\b/i.test(location.search)) return true;
      if (/[?&]mg_window=small\b/i.test(location.search)) return true;
      if (localStorage.getItem("mg.webgrid.scale") === "small") return true;
    } catch (e) {}
    return false;
  }

  async function autoplayIfEnabled() {
    if (!wantAutoplay()) {
      log("autoplay off · calibrated ready (set play_once / AgentPlayOnce / ?mg_autoplay=3)");
      return;
    }
    var rounds = autoplayRounds();
    var small = wantsSmallScale();
    log(
      VER +
        " · multi-round agent · rounds=" +
        rounds +
        (small ? " · SMALL window / 12×12 target" : " · large / 30×30") +
        " · prior peak 483.58 BPS"
    );
    if (small) {
      /* let boot layout settle at compact size before Start (page picks N at start) */
      try {
        localStorage.setItem("mg.webgrid.zoom", "1");
        window.__mgVpZ = 1;
        applyWebgridZoomOut(true);
      } catch (eS) {}
      await sleep(900);
      var lr = layoutReport();
      log("small-scale layout eff " + lr.w + "×" + lr.h + " expect " + lr.expectN + "×" + lr.expectN);
    }
    var all = [];
    for (var r = 0; r < rounds; r++) {
      var res = await playOneRound(r, rounds);
      all.push(res);
      if (r + 1 < rounds) {
        /* Play Again interstitial */
        await sleep(400);
        var again = findButton(/^play again$/i) || findButton(/play again/i);
        if (again) {
          clickEl(again);
          await sleep(500);
        }
      }
    }
    var best = all.reduce(function (a, b) {
      var ap = (a && (a.peakBps || (a.peak && a.peak.bps))) || 0;
      var bp = (b && (b.peakBps || (b.peak && b.peak.bps))) || 0;
      return bp >= ap ? b : a;
    }, all[0] || null);
    report("agent_session", {
      rounds: rounds,
      results: all,
      sessionBest: best,
      prior: 483.58,
      beatPrior: best && (best.peakBps || 0) > 483.58,
    });
    log(
      "session done best=" +
        (best ? best.peakBps + " BPS / " + best.peakNtpm + " NTPM" : "?") +
        (best && best.peakBps > 483.58 ? " · BEAT prior" : " · prior still stands")
    );
    try {
      window.__mgWebgridSessionBest = best;
    } catch (eS) {}
  }

  /* public API for calibration debug */
  window.__mgWebgridCalib = {
    ver: VER,
    findTarget: function () {
      return findTargetFromCanvas(detectGridSize());
    },
    detectGridSize: detectGridSize,
    desktopGridOk: desktopGridOk,
    bpsFromNtpm: bpsFromNtpm,
    scrapeScore: scrapeScore,
    pace: function () {
      return Object.assign({}, _pace);
    },
    setPaceProfile: function (name) {
      return applyPaceProfile(name || "intel", "api");
    },
    setPace: function (sleepMs, waitLoops) {
      if (sleepMs != null) _pace.sleep_ms = Math.max(2, Math.min(40, parseInt(sleepMs, 10) || 14));
      if (waitLoops != null)
        _pace.wait_loops = Math.max(4, Math.min(30, parseInt(waitLoops, 10) || 12));
      _pace.source = "api";
      return Object.assign({}, _pace);
    },
    targetRgb: [TARGET_R, TARGET_G, TARGET_B],
    zoomOut: applyWebgridZoomOut,
    setZoom: function (z) {
      z = clampZoom(z);
      try {
        localStorage.setItem("mg.webgrid.zoom", String(z));
      } catch (e) {}
      window.__mgWebgridZoom = null;
      return applyWebgridZoomOut(true);
    },
    nudgeZoom: nudgeZoom,
    resetZoom: resetZoom,
    zoomForGrid: zoomForGrid,
    layoutReport: layoutReport,
    getZoom: function () {
      return window.__mgWebgridZoom != null ? window.__mgWebgridZoom : desiredZoom();
    },
    play: function () {
      window.__mgWebgridAgentPlayOnce = true;
      return autoplayIfEnabled();
    },
    /** Quantum-neuralink step: μgrad tensor predict + IBM-style QASM */
    quantumPredict: function () {
      var N = detectGridSize();
      var c = canvasEl();
      var rect = c ? c.getBoundingClientRect() : { left: 0, top: 0, width: 600, height: 600 };
      if (!window.__mgUgradWebgrid) return null;
      return window.__mgUgradWebgrid.quantumStep(rect, N, { mode: "argmax" });
    },
  };

  hideMgChrome();
  installViewportSpoof();
  applyWebgridZoomOut(true);
  kickCanvasResize();
  /* ⌘− / ⌘+ / ⌘0 — capture phase so page doesn't eat them */
  window.addEventListener("keydown", onZoomKey, true);
  document.addEventListener("keydown", onZoomKey, true);
  /* Keep layout fill after SPA transitions; don't spam zoom IPC */
  _fillTimer = setInterval(function () {
    try {
      hideMgChrome();
      kickCanvasResize();
    } catch (eH) {}
  }, 1500);

  window.__mgWebgridPlayTeardown = function () {
    try {
      window.removeEventListener("keydown", onZoomKey, true);
      document.removeEventListener("keydown", onZoomKey, true);
    } catch (e1) {}
    try {
      if (_fillTimer) clearInterval(_fillTimer);
      _fillTimer = null;
    } catch (e2) {}
    try {
      if (_paceTimer) clearInterval(_paceTimer);
      _paceTimer = null;
    } catch (e3) {}
  };
  var zoomResizeT = 0;
  window.addEventListener("resize", function () {
    clearTimeout(zoomResizeT);
    zoomResizeT = setTimeout(function () {
      hideMgChrome();
      applyWebgridZoomOut(false);
      kickCanvasResize();
    }, 120);
  });

  log(VER + " · ⌘+ bigger · ⌘− smaller · ⌘0 reset");

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      autoplayIfEnabled();
    });
  } else {
    autoplayIfEnabled();
  }
})();

/* __MG_WEBGRID_WATCH_INLINE__ */
/* Memory Glass · WebGrid playthrough watcher
 * Samples score/timer/grid/blues + pointer events → http://127.0.0.1:9880/
 * Learn-from-play harness · no mouse hijack · inspect-safe
 * VER: webgrid-watch-v1
 */
(function () {
  "use strict";
  try {
    if (!/neuralink\.com$/i.test(location.hostname) || !/webgrid/i.test(location.pathname)) return;
  } catch (e0) {
    return;
  }
  if (window.__mgWebgridWatchV1) return;
  window.__mgWebgridWatchV1 = true;
  var VER = "webgrid-watch-v1";
  var ENDPOINT = "http://127.0.0.1:9880/";
  var clicks = 0,
    hits = 0,
    misses = 0,
    lastBlue = null,
    lastPost = 0,
    t0 = Date.now(),
    phases = [],
    lastPhase = "";

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "webgrid-watch");
    } catch (e) {}
  }

  function textOf(el) {
    return ((el && (el.innerText || el.textContent)) || "").replace(/\s+/g, " ").trim();
  }

  function scrape() {
    var body = textOf(document.body);
    var bps = null,
      ntpm = null,
      timer = null,
      grid = null;
    var mBps = body.match(/([\d.]+)\s*BPS/i);
    if (mBps) bps = parseFloat(mBps[1]);
    var mNtpm = body.match(/([\d.]+)\s*NTPM/i);
    if (mNtpm) ntpm = parseFloat(mNtpm[1]);
    var mT = body.match(/\b(\d{1,2}:\d{2})\b/);
    if (mT) timer = mT[1];
    var mG = body.match(/(\d+)\s*[×x]\s*(\d+)/i);
    if (mG) grid = mG[1] + "x" + mG[2];

    var phase = "unknown";
    if (/play again/i.test(body)) phase = "end";
    else if (/start game/i.test(body)) phase = "lobby";
    else if (/decline/i.test(body) && /accept|cookie|privacy/i.test(body)) phase = "consent";
    else if (timer && bps != null) phase = "playing";
    else if (/select|difficulty|grid/i.test(body)) phase = "setup";

    var blues = countBlues();
    return {
      kind: "sample",
      ver: VER,
      t: Date.now(),
      elapsed: Date.now() - t0,
      phase: phase,
      bps: bps,
      ntpm: ntpm,
      timer: timer,
      grid: grid,
      blues: blues,
      clicks: clicks,
      hits: hits,
      misses: misses,
      lastBlue: lastBlue,
      href: location.href,
      title: document.title || "",
      snippet: body.slice(0, 220),
    };
  }

  function countBlues() {
    var c = document.querySelector("canvas");
    if (!c) return null;
    var w = c.width,
      h = c.height;
    if (!w || !h) return null;
    try {
      var tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      var tctx = tmp.getContext("2d");
      tctx.drawImage(c, 0, 0);
      var data = tctx.getImageData(0, 0, w, h).data;
      var n = 0,
        sx = 0,
        sy = 0;
      var step = Math.max(2, Math.floor(Math.min(w, h) / 120));
      for (var y = 1; y < h - 1; y += step) {
        for (var x = 1; x < w - 1; x += step) {
          var i = (y * w + x) * 4;
          var R = data[i],
            G = data[i + 1],
            B = data[i + 2];
          if (B > 160 && R < 110 && B > R + 35) {
            n++;
            sx += x;
            sy += y;
          }
        }
      }
      if (n) {
        lastBlue = {
          nx: sx / n / w,
          ny: sy / n / h,
          n: n,
        };
      }
      return n;
    } catch (e) {
      return null;
    }
  }

  function post(obj) {
    /* https://neuralink cannot fetch http://localhost (mixed content).
     * IPC dev_log → Rust appends ~/.panda/mg-soak/watch/play.jsonl */
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({
            op: "dev_log",
            lvl: "info",
            src: "webgrid-watch",
            msg: "MGW:" + JSON.stringify(obj),
          })
        );
      }
    } catch (eIpc) {}
    /* optional local collector if ever same-origin / allowed */
    try {
      fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj),
      }).catch(function () {});
    } catch (e) {}
    try {
      window.__mgWatchLast = obj;
    } catch (e2) {}
  }

  function sample(force) {
    var now = Date.now();
    if (!force && now - lastPost < 280) return;
    lastPost = now;
    var s = scrape();
    if (s.phase !== lastPhase) {
      phases.push({ t: now, phase: s.phase });
      lastPhase = s.phase;
      post({
        kind: "phase",
        phase: s.phase,
        t: now,
        elapsed: s.elapsed,
        bps: s.bps,
        ntpm: s.ntpm,
        timer: s.timer,
        grid: s.grid,
      });
    }
    post(s);
  }

  /* pointer learning — human play, we only observe */
  function onPtr(ev) {
    if (ev.type === "pointerdown" || ev.type === "mousedown") {
      clicks++;
      var s = scrape();
      var hit = false;
      if (lastBlue && s.blues != null) {
        /* crude: click near last blue centroid in viewport canvas space */
        var c = document.querySelector("canvas");
        if (c) {
          var r = c.getBoundingClientRect();
          var cx = r.left + lastBlue.nx * r.width;
          var cy = r.top + lastBlue.ny * r.height;
          var d = Math.hypot(ev.clientX - cx, ev.clientY - cy);
          hit = d < Math.max(28, Math.min(r.width, r.height) * 0.08);
        }
      }
      if (hit) hits++;
      else misses++;
      post({
        kind: "click",
        t: Date.now(),
        elapsed: Date.now() - t0,
        x: ev.clientX,
        y: ev.clientY,
        hitGuess: hit,
        lastBlue: lastBlue,
        bps: s.bps,
        ntpm: s.ntpm,
        timer: s.timer,
        phase: s.phase,
        clicks: clicks,
        hits: hits,
        misses: misses,
      });
    }
  }
  document.addEventListener("pointerdown", onPtr, true);
  document.addEventListener("mousedown", onPtr, true);

  setInterval(function () {
    sample(false);
  }, 350);
  sample(true);
  log(VER + " · watching playthrough → :9880");
})();

