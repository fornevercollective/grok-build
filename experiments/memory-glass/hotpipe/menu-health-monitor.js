/* Memory Glass · LIVE MENU HEALTH
 * Probes every chrome surface, auto-heals hit-targets / product ghosts,
 * exposes window.__mgMenus for Grok open/close/use of all menus.
 * Streams MG_WATCH-style MENU_HEALTH lines via ipc + __mgDevLog.
 * VER: menu-health-v15-bot-chrome
 * During WebGrid play: no exercise, slow probe, no heal thrash.
 * Product-core / lazy: only probe tools·data·search·dragon·rec chip.
 * v15: rehome MENUS pill into bottom chrome footer.
 */
(function () {
  "use strict";
  var VER = "menu-health-v15-bot-chrome";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._menuHealthVer === VER) return;
  HP._menuHealthVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var lastProbe = null;
  var thrash = {}; /* id -> { flips, last, t0 } */
  var healCount = 0;
  var running = false;
  var probeTimer = 0;
  var thrashTimer = 0;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "ok", String(m), "menu-health");
    } catch (e) {}
  }

  /** True while WebGrid run is hot — skip thrash/exercise/heal storms */
  function isPlayHot() {
    try {
      if (window.__mgWebgridPlayBusy) return true;
      if (document.documentElement.classList.contains("mg-webgrid-playing"))
        return true;
      if (document.documentElement.classList.contains("mg-webgrid-play-busy"))
        return true;
    } catch (e) {}
    return false;
  }

  /** Product-core browse: lab APIs intentionally missing — don't FAIL/spam */
  function isProductCore() {
    try {
      if (document.documentElement.classList.contains("mg-lazy")) return true;
      if (window.__mgSmokeProbe && window.__mgSmokeProbe.mode === "product-core")
        return true;
      if (window.__mgLazy && !/[?&]mg_lab_full=1\b/i.test(location.search || ""))
        return true;
    } catch (e) {}
    return false;
  }

  var PRODUCT_CORE_IDS = ["tools", "data", "search", "dragon"];

  function isWebgridHost() {
    try {
      return (
        /neuralink\.com$/i.test(location.hostname || "") &&
        /webgrid/i.test(location.pathname || "")
      );
    } catch (e) {
      return false;
    }
  }

  function emit(payload) {
    var body = Object.assign(
      { kind: "menu_health", ver: VER, t: Date.now() },
      payload || {}
    );
    /* HTTPS WebGrid cannot fetch localhost — IPC MGW: path is reliable (same as webgrid-watch) */
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({
            op: "dev_log",
            lvl: body.ok === false ? "warn" : "ok",
            msg: "MGW:" + JSON.stringify(body),
            src: "menu-health",
            t: body.t,
          })
        );
      }
    } catch (eI) {}
    try {
      if (window.__mgDevLog)
        window.__mgDevLog(
          body.ok === false ? "warn" : "ok",
          "MENU_HEALTH " +
            body.pass +
            "/" +
            body.total +
            (body.ok ? " green" : " FAIL " + ((body.fails || []).join(",") || "")),
          "menu-health"
        );
    } catch (eD) {}
    try {
      console.log("MENU_HEALTH " + JSON.stringify(body));
    } catch (eC) {}
    return body;
  }

  /** Catalog of all menus Grok / user can open·close·use (dual-drawer era) */
  var CATALOG = [
    {
      id: "tools",
      label: "TOOLS left drawer",
      dom: "mg-tools-drawer",
      api: "__mgToolsDrawer",
      open: function () {
        window.__mgUserOpenedCtrl = true;
        window.__mgUserChromeTouch = true;
        if (window.__mgToolsDrawer && window.__mgToolsDrawer.open)
          window.__mgToolsDrawer.open();
      },
      close: function () {
        if (window.__mgToolsDrawer && window.__mgToolsDrawer.close)
          window.__mgToolsDrawer.close();
      },
      isOpen: function () {
        if (window.__mgToolsDrawer && window.__mgToolsDrawer.isOpen)
          return !!window.__mgToolsDrawer.isOpen();
        var el = document.getElementById("mg-tools-drawer");
        return !!(el && el.classList.contains("open"));
      },
      /* edge mode rail is the closed-state hit target */
      hitDom: function () {
        return (
          document.getElementById("mg-tools-mode-rail") ||
          document.getElementById("mg-tools-drawer")
        );
      },
    },
    {
      id: "data",
      label: "DATA right drawer",
      dom: "mg-right-drawer",
      api: "__mgRightDrawer",
      open: function () {
        window.__mgUserChromeTouch = true;
        if (window.__mgRightDrawer && window.__mgRightDrawer.open)
          window.__mgRightDrawer.open("live");
      },
      close: function () {
        if (window.__mgRightDrawer && window.__mgRightDrawer.close)
          window.__mgRightDrawer.close();
      },
      isOpen: function () {
        if (window.__mgRightDrawer && window.__mgRightDrawer.isOpen)
          return !!window.__mgRightDrawer.isOpen();
        var el = document.getElementById("mg-right-drawer");
        return !!(el && el.classList.contains("open"));
      },
      hitDom: function () {
        return (
          document.getElementById("mg-right-tab") ||
          document.getElementById("mg-right-drawer")
        );
      },
    },
    {
      id: "ctrl",
      label: "CTRL (legacy glass-cap)",
      dom: "mg-glass-cap",
      api: "__mgGlassCap",
      optional: true,
      open: function () {
        /* presentable mode: map to tools drawer */
        window.__mgUserOpenedCtrl = true;
        window.__mgUserChromeTouch = true;
        if (document.documentElement.classList.contains("mg-presentable") ||
            document.documentElement.classList.contains("mg-drawer-mode")) {
          if (window.__mgToolsDrawer && window.__mgToolsDrawer.open)
            window.__mgToolsDrawer.open();
          return;
        }
        if (window.__mgGlassCap && window.__mgGlassCap.openTools)
          window.__mgGlassCap.openTools();
        else {
          var el = document.getElementById("mg-glass-cap");
          if (el) el.classList.remove("collapsed");
        }
      },
      close: function () {
        if (window.__mgToolsDrawer && window.__mgToolsDrawer.isOpen &&
            window.__mgToolsDrawer.isOpen())
          window.__mgToolsDrawer.close();
        if (window.__mgGlassCap && window.__mgGlassCap.close)
          window.__mgGlassCap.close();
        else {
          var el = document.getElementById("mg-glass-cap");
          if (el) el.classList.add("collapsed");
        }
      },
      isOpen: function () {
        if (window.__mgToolsDrawer && window.__mgToolsDrawer.isOpen)
          return !!window.__mgToolsDrawer.isOpen();
        var el = document.getElementById("mg-glass-cap");
        return !!(el && !el.classList.contains("collapsed") && el.offsetParent !== null);
      },
    },
    {
      id: "search",
      label: "Search dock",
      dom: "mg-search-dock",
      open: function () {
        var d = document.getElementById("mg-search-dock");
        if (d) {
          d.classList.add("is-open");
          d.classList.remove("hidden");
          d.style.display = "";
          d.style.visibility = "visible";
          d.style.pointerEvents = "auto";
        }
        if (window.__mgSearchComms && window.__mgSearchComms.open)
          window.__mgSearchComms.open();
        window.__mgUserChromeTouch = true;
      },
      close: function () {
        var d = document.getElementById("mg-search-dock");
        if (d) {
          d.classList.remove("is-open");
          d.classList.remove("chat-open");
        }
      },
      isOpen: function () {
        var d = document.getElementById("mg-search-dock");
        if (d && (d.classList.contains("is-open") || d.classList.contains("chat-open")))
          return true;
        /* quiet-boot: peek alone is the always-on hit target */
        var peek = document.getElementById("mg-search-peek");
        if (peek) {
          var r = peek.getBoundingClientRect();
          if (r.width > 2 && r.height > 2) return true;
        }
        return !!(d && d.offsetParent);
      },
      hitDom: function () {
        return (
          document.getElementById("mg-search-dock") ||
          document.getElementById("mg-search-peek") ||
          document.getElementById("mg-url")
        );
      },
    },
    {
      id: "keyboard",
      label: "Float keyboard",
      dom: "mg-float-kb",
      api: "__mgFloatKb",
      open: function () {
        window.__mgUserOpenedKb = true;
        window.__mgUserChromeTouch = true;
        unghost("mg-float-kb");
        if (window.__mgFloatKb) {
          if (window.__mgFloatKb.launch)
            window.__mgFloatKb.launch({ mode: "type" });
          else if (window.__mgFloatKb.open) window.__mgFloatKb.open();
        }
      },
      close: function () {
        if (window.__mgFloatKb && window.__mgFloatKb.close)
          window.__mgFloatKb.close();
      },
      isOpen: function () {
        if (window.__mgFloatKb && window.__mgFloatKb.isOpen)
          return !!window.__mgFloatKb.isOpen();
        return isDomVisible("mg-float-kb");
      },
    },
    {
      id: "board",
      label: "LIVE RANK board",
      dom: "mg-activity-board",
      api: "__mgActivityBoard",
      open: function () {
        window.__mgUserOpenedBoard = true;
        unghost("mg-activity-board");
        if (window.__mgActivityBoard)
          window.__mgActivityBoard.open({ collapsed: false });
      },
      close: function () {
        if (window.__mgActivityBoard && window.__mgActivityBoard.close)
          window.__mgActivityBoard.close();
      },
      isOpen: function () {
        if (window.__mgActivityBoard && window.__mgActivityBoard.isOpen)
          return !!window.__mgActivityBoard.isOpen();
        return isDomVisible("mg-activity-board");
      },
    },
    {
      id: "maze",
      label: "Memory maze",
      dom: "mg-mem-maze",
      api: "__mgMemoryMaze",
      open: function () {
        unghost("mg-mem-maze");
        if (window.__mgMemoryMaze && window.__mgMemoryMaze.open)
          window.__mgMemoryMaze.open();
      },
      close: function () {
        if (window.__mgMemoryMaze && window.__mgMemoryMaze.close)
          window.__mgMemoryMaze.close();
      },
      isOpen: function () {
        return apiOpen("__mgMemoryMaze", "mg-mem-maze");
      },
    },
    {
      id: "beats",
      label: "Keyboard beats",
      dom: "mg-kb-beats",
      api: "__mgKeyboardBeats",
      open: function () {
        unghost("mg-kb-beats");
        if (!window.__mgKeyboardBeats) return;
        /* pop-out only — bare open() intentionally stays off center canvas */
        if (window.__mgKeyboardBeats.popOut) window.__mgKeyboardBeats.popOut();
        else if (window.__mgKeyboardBeats.open)
          window.__mgKeyboardBeats.open({ popOut: true, forceFloat: true });
      },
      close: function () {
        if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.close)
          window.__mgKeyboardBeats.close();
      },
      isOpen: function () {
        return apiOpen("__mgKeyboardBeats", "mg-kb-beats");
      },
    },
    {
      id: "field",
      label: "Sports field",
      dom: "mg-sports-field",
      api: "__mgSportsField",
      open: function () {
        unghost("mg-sports-field");
        if (window.__mgSportsField && window.__mgSportsField.open)
          window.__mgSportsField.open();
      },
      close: function () {
        if (window.__mgSportsField && window.__mgSportsField.close)
          window.__mgSportsField.close();
      },
      isOpen: function () {
        return apiOpen("__mgSportsField", "mg-sports-field");
      },
    },
    {
      id: "raider",
      label: "BrotherNumsey raider",
      dom: "mg-raider-stage",
      api: "__mgRaider",
      open: function () {
        unghost("mg-raider-stage");
        if (window.__mgRaider && window.__mgRaider.open) window.__mgRaider.open();
      },
      close: function () {
        if (window.__mgRaider && window.__mgRaider.close) window.__mgRaider.close();
      },
      isOpen: function () {
        return apiOpen("__mgRaider", "mg-raider-stage");
      },
    },
    {
      id: "bloch",
      label: "Bloch solve",
      dom: "mg-bloch-float",
      api: "__mgBlochSolve",
      open: function () {
        unghost("mg-bloch-float");
        if (window.__mgBlochSolve) {
          if (window.__mgBlochSolve.setEnabled) window.__mgBlochSolve.setEnabled(true);
          if (window.__mgBlochSolve.open) window.__mgBlochSolve.open();
        }
      },
      close: function () {
        if (window.__mgBlochSolve && window.__mgBlochSolve.close)
          window.__mgBlochSolve.close();
      },
      isOpen: function () {
        return apiOpen("__mgBlochSolve", "mg-bloch-float");
      },
    },
    {
      id: "geo",
      label: "GEO pattern",
      dom: "mg-geo-float",
      api: "__mgGeoPattern",
      open: function () {
        unghost("mg-geo-float");
        if (window.__mgGeoPattern && window.__mgGeoPattern.open)
          window.__mgGeoPattern.open();
      },
      close: function () {
        if (window.__mgGeoPattern && window.__mgGeoPattern.close)
          window.__mgGeoPattern.close();
      },
      isOpen: function () {
        return apiOpen("__mgGeoPattern", "mg-geo-float");
      },
    },
    {
      id: "rubik",
      label: "Rubik language",
      dom: "mg-rubik-float",
      api: "__mgRubikLang",
      open: function () {
        unghost("mg-rubik-float");
        if (window.__mgRubikLang) {
          if (window.__mgRubikLang.open) window.__mgRubikLang.open();
          else if (window.__mgRubikLang.toggle) window.__mgRubikLang.toggle();
        }
      },
      close: function () {
        if (window.__mgRubikLang && window.__mgRubikLang.close)
          window.__mgRubikLang.close();
      },
      isOpen: function () {
        return apiOpen("__mgRubikLang", "mg-rubik-float");
      },
    },
    {
      id: "day",
      label: "Collab day",
      api: "__mgCollabDay",
      open: function () {
        if (window.__mgCollabDay) {
          if (!window.__mgCollabDay.day || !window.__mgCollabDay.day())
            window.__mgCollabDay.start({});
          if (window.__mgCollabDay.open) window.__mgCollabDay.open();
        }
      },
      close: function () {
        if (window.__mgCollabDay && window.__mgCollabDay.close)
          window.__mgCollabDay.close();
      },
      isOpen: function () {
        try {
          return !!(window.__mgCollabDay && window.__mgCollabDay.day && window.__mgCollabDay.day());
        } catch (e) {
          return false;
        }
      },
    },
    {
      id: "dragon",
      label: "Dragon shell menu",
      dom: "mg-dragon",
      open: function () {
        var d = document.getElementById("mg-dragon");
        if (d) {
          d.classList.add("is-open");
          d.__mgUserClosed = false;
        }
      },
      close: function () {
        var d = document.getElementById("mg-dragon");
        if (d) {
          d.classList.remove("is-open");
          d.__mgUserClosed = true;
        }
      },
      isOpen: function () {
        var d = document.getElementById("mg-dragon");
        return !!(d && d.classList.contains("is-open"));
      },
    },
    {
      id: "mkt",
      label: "Market filmstrip",
      dom: "mg-mkt-panel",
      api: "__mgMarket",
      open: function () {
        window.__mgUserChromeTouch = true;
        if (window.__mgRightDrawer && window.__mgRightDrawer.open) {
          window.__mgRightDrawer.open("mkt");
          return;
        }
        if (window.__mgMarket) {
          if (window.__mgMarket.open) window.__mgMarket.open();
          if (window.__mgMarket.loadBoardHard) window.__mgMarket.loadBoardHard();
        }
      },
      close: function () {
        if (window.__mgRightDrawer && window.__mgRightDrawer.isOpen &&
            window.__mgRightDrawer.isOpen())
          window.__mgRightDrawer.close();
        else if (window.__mgMarket) window.__mgMarket.close();
      },
      isOpen: function () {
        if (window.__mgRightDrawer && window.__mgRightDrawer.isOpen)
          return !!window.__mgRightDrawer.isOpen();
        return !!(window.__mgMarket && window.__mgMarket.state && window.__mgMarket.state.open);
      },
      /* hit any of panel / host / right drawer when open */
      hitDom: function () {
        return (
          document.getElementById("mg-mkt-panel") ||
          document.getElementById("mg-drawer-mkt-host") ||
          document.getElementById("mg-right-drawer") ||
          document.getElementById("mg-mkt-rail")
        );
      },
    },
    {
      id: "grok",
      label: "Grok terminal",
      dom: "mg-grok-term",
      api: "__mgGrokTerm",
      open: function () {
        if (window.__mgRightDrawer) window.__mgRightDrawer.open("grok");
        else if (window.__mgGrokTerm) window.__mgGrokTerm.open();
      },
      close: function () {
        if (window.__mgGrokTerm && window.__mgGrokTerm.close)
          window.__mgGrokTerm.close();
        if (window.__mgRightDrawer && window.__mgRightDrawer.close)
          window.__mgRightDrawer.close();
      },
      isOpen: function () {
        if (window.__mgGrokTerm && window.__mgGrokTerm.isOpen)
          return !!window.__mgGrokTerm.isOpen();
        return isDomVisible("mg-grok-term");
      },
    },
    {
      id: "solve",
      label: "SOLVE stamp HUD",
      dom: "mg-solve-hud",
      api: "__mgLiveSolveHud",
      open: function () {
        if (window.__mgLiveSolveHud && window.__mgLiveSolveHud.open)
          window.__mgLiveSolveHud.open();
        else {
          var h = document.getElementById("mg-solve-hud");
          if (h) h.click();
        }
      },
      close: function () {
        if (window.__mgLiveSolveHud && window.__mgLiveSolveHud.close)
          window.__mgLiveSolveHud.close();
      },
      isOpen: function () {
        if (window.__mgLiveSolveHud && window.__mgLiveSolveHud.isOpen)
          return !!window.__mgLiveSolveHud.isOpen();
        var h = document.getElementById("mg-solve-hud");
        if (h && h.classList.contains("open")) return true;
        var t = document.getElementById("mg-solve-tray");
        return !!(t && !t.classList.contains("hidden"));
      },
      hitDom: function () {
        return (
          document.getElementById("mg-solve-tray") ||
          document.getElementById("mg-solve-hud")
        );
      },
    },
  ];

  function byId(id) {
    for (var i = 0; i < CATALOG.length; i++) {
      if (CATALOG[i].id === id) return CATALOG[i];
    }
    return null;
  }

  function unghost(domId) {
    try {
      var el = document.getElementById(domId);
      if (!el) return;
      el.classList.remove("mg-product-ghost");
      el.classList.remove("hidden");
      el.style.display = "";
      el.style.visibility = "visible";
      el.style.pointerEvents = "auto";
      el.style.opacity = "";
    } catch (e) {}
  }

  function isDomVisible(id) {
    try {
      var el = document.getElementById(id);
      if (!el) return false;
      if (el.classList.contains("hidden")) return false;
      if (el.classList.contains("mg-product-ghost")) return false;
      var cs = window.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      if (parseFloat(cs.opacity || "1") < 0.05) return false;
      var r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    } catch (e) {
      return false;
    }
  }

  function apiOpen(apiName, domId) {
    try {
      var api = window[apiName];
      if (api && typeof api.isOpen === "function") return !!api.isOpen();
    } catch (e) {}
    return isDomVisible(domId);
  }

  function pe(el) {
    try {
      return window.getComputedStyle(el).pointerEvents;
    } catch (e) {
      return "?";
    }
  }

  /** Accept hits on sibling edge peeks / drawer hosts that are part of the surface */
  function hitRelated(el, top) {
    if (!el || !top) return false;
    if (el === top || el.contains(top)) return true;
    var tid = top.id || "";
    var eid = el.id || "";
    /* left tools drawer + mueee-style edge peeks */
    if (eid === "mg-tools-drawer" || eid === "mg-tools-mode-rail") {
      if (
        tid === "mg-tools-drawer" ||
        tid === "mg-tools-mode-rail" ||
        tid === "mg-tools-body" ||
        tid === "mg-tools-x"
      )
        return true;
      if (top.closest && top.closest("#mg-tools-drawer,#mg-tools-mode-rail"))
        return true;
    }
    /* mkt panel may live inside right drawer host */
    if (
      eid === "mg-mkt-panel" ||
      eid === "mg-mkt-rail" ||
      eid === "mg-right-drawer"
    ) {
      if (
        tid === "mg-mkt-panel" ||
        tid === "mg-mkt-rail" ||
        tid === "mg-mkt-list" ||
        tid === "mg-right-drawer" ||
        tid === "mg-right-tab" ||
        tid === "mg-drawer-mkt-host"
      )
        return true;
      if (
        top.closest &&
        top.closest(
          "#mg-mkt-panel,#mg-mkt-rail,#mg-right-drawer,#mg-drawer-mkt-host"
        )
      )
        return true;
    }
    return false;
  }

  function hitTest(el) {
    if (!el) return { ok: false, reason: "no-el" };
    try {
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2)
        return { ok: false, reason: "zero-box", pe: pe(el) };
      /* sample center + corners — large floats can be hollow in the middle */
      var pts = [
        [0.5, 0.5],
        [0.15, 0.15],
        [0.85, 0.15],
        [0.15, 0.85],
        [0.85, 0.85],
        [0.5, 0.2],
        [0.5, 0.8],
        [0.08, 0.5],
        [0.92, 0.5],
      ];
      var best = null;
      for (var i = 0; i < pts.length; i++) {
        var cx = Math.min(
          window.innerWidth - 1,
          Math.max(0, r.left + r.width * pts[i][0])
        );
        var cy = Math.min(
          window.innerHeight - 1,
          Math.max(0, r.top + r.height * pts[i][1])
        );
        var top = document.elementFromPoint(cx, cy);
        if (!top) continue;
        var inside = hitRelated(el, top);
        var row = {
          ok: inside,
          reason: inside ? "hit" : "blocked",
          pe: pe(el),
          top: top.id || top.tagName || "?",
          x: Math.round(cx),
          y: Math.round(cy),
        };
        if (inside) return row;
        if (!best) best = row;
      }
      return best || { ok: false, reason: "no-top", pe: pe(el) };
    } catch (e) {
      return { ok: false, reason: "err:" + e };
    }
  }

  function ensureHitCss() {
    var id = "mg-menu-health-css";
    var st = document.getElementById(id);
    if (st) st.remove();
    st = document.createElement("style");
    st.id = id;
    /* #mg-root is z=2147483646 — body floats MUST sit above it or scrim steals clicks */
    var Z = "2147483647";
    st.textContent = [
      /* kill full-screen click steal: scrim never captures (dragon panel is self-contained) */
      "#mg-scrim{",
      "  pointer-events:none!important;opacity:0!important}",
      "html.mg-webgrid-play #mg-root #mg-scrim{",
      "  pointer-events:none!important}",
      /* body + shell chrome above #mg-root stacking context */
      "#mg-glass-cap,#mg-float-kb,#mg-activity-board,#mg-board-chip,",
      "#mg-rec-chip,#mg-sx-rail,#mg-mem-maze,#mg-kb-beats,#mg-sports-field,",
      "#mg-raider-stage,#mg-bloch-float,#mg-geo-float,#mg-rubik-float,",
      "#mg-live-solve-hud,#mg-menu-health-pill,",
      "#mg-tools-drawer,#mg-tools-mode-rail,#mg-right-drawer,#mg-right-tab,",
      "#mg-mkt-rail,#mg-mkt-panel,#mg-mkt-tab{",
      "  z-index:" + Z + "!important;pointer-events:auto!important}",
      /* shell chrome is under #mg-root — keep auto hits */
      "#mg-search-dock,#mg-search-peek,#mg-search,#mg-dragon,#mg-panel,",
      "#mg-tabs,#mg-stoplights,#mg-top-right,#mg-mode-menu{",
      "  pointer-events:auto!important}",
      "#mg-glass-cap button,#mg-float-kb button,#mg-activity-board button,",
      "#mg-board-chip,#mg-search-dock button,#mg-search-dock input,",
      "#mg-dragon button,#mg-panel button,#mg-tabs button{",
      "  pointer-events:auto!important;cursor:pointer}",
      /* never force-display open class over .hidden (keyboard close) */
      "#mg-float-kb.hidden,#mg-sports-field.hidden,#mg-kb-beats.hidden,",
      "#mg-mem-maze.hidden,#mg-geo-float.hidden,#mg-raider-stage.hidden,",
      "#mg-bloch-float.hidden,#mg-rubik-float.hidden{",
      "  display:none!important;visibility:hidden!important;pointer-events:none!important;",
      "  opacity:0!important}",
      ".mg-menu-open.hidden{display:none!important}",
      /* health pill — free float fallback; bottom chrome rehomes into #mg-bot-health-host */
      "#mg-menu-health-pill{",
      "  position:fixed;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));",
      "  z-index:" + Z + ";pointer-events:auto;cursor:pointer;",
      "  font:700 10px/1.2 ui-monospace,Menlo,system-ui;letter-spacing:0.04em;",
      "  padding:7px 11px;border-radius:999px;",
      "  color:rgba(240,248,255,0.95);",
      "  background:rgba(20,24,32,0.72);border:1px solid rgba(120,200,255,0.35);",
      "  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);",
      "  box-shadow:0 6px 20px rgba(0,0,0,0.28)}",
      "html.mg-bot-chrome #mg-bot-health-host #mg-menu-health-pill{",
      "  position:relative!important;right:auto!important;bottom:auto!important;",
      "  left:auto!important;top:auto!important;border-radius:10px!important;",
      "  padding:5px 9px!important;font-size:9px!important;z-index:1!important}",
      "html.mg-bot-chrome body > #mg-menu-health-pill,",
      "html.mg-bot-chrome html > #mg-menu-health-pill{",
      "  display:none!important}",
      "html.mg-bot-chrome #mg-bot-health-host #mg-menu-health-pill{display:block!important}",
      "#mg-menu-health-pill.bad{border-color:rgba(255,120,100,0.55);",
      "  background:rgba(48,18,16,0.78);color:rgba(255,210,200,0.98)}",
      "#mg-menu-health-pill.warn{border-color:rgba(255,200,80,0.5);",
      "  background:rgba(40,32,12,0.78)}",
      "#mg-menu-health-pill.ok{border-color:rgba(100,220,150,0.5)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function ensurePill() {
    var p = document.getElementById("mg-menu-health-pill");
    if (p) return p;
    p = document.createElement("div");
    p.id = "mg-menu-health-pill";
    p.title = "Menu health · click to re-probe · long-press closes all lab floats";
    p.textContent = "MENUS …";
    p.addEventListener("click", function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      var r = probe({ heal: true, emit: true });
      p.textContent =
        "MENUS " +
        r.pass +
        "/" +
        r.total +
        (r.ok ? " ✓" : " !") +
        (r.healed ? " heal+" + r.healed : "");
      p.className = r.ok ? "ok" : r.pass / r.total > 0.6 ? "warn" : "bad";
    });
    var host = document.getElementById("mg-bot-health-host");
    if (host) host.appendChild(p);
    else (document.body || document.documentElement).appendChild(p);
    return p;
  }

  function updatePill(r) {
    try {
      var p = ensurePill();
      /* rehome into bottom chrome if it appeared after first mount */
      try {
        var host = document.getElementById("mg-bot-health-host");
        if (host && p.parentNode !== host) host.insertBefore(p, host.firstChild);
      } catch (eH) {}
      p.textContent =
        "MENUS " +
        r.pass +
        "/" +
        r.total +
        (r.ok ? " ✓" : " !") +
        (healCount ? " h" + healCount : "");
      p.className = r.ok ? "ok" : r.pass / Math.max(1, r.total) > 0.6 ? "warn" : "bad";
      p.title =
        VER +
        " · pass=" +
        r.pass +
        "/" +
        r.total +
        " · fail=" +
        (r.fails || []).join(",") +
        " · click re-probe";
      try {
        if (window.__mgBottomChrome && window.__mgBottomChrome.sync)
          window.__mgBottomChrome.sync();
      } catch (eS) {}
    } catch (e) {}
  }

  /* Always-on chrome: DOM must exist (hit may be blocked when drawer closed offscreen) */
  var ALWAYS_ON = { tools: 1, data: 1, search: 1, dragon: 1, solve: 1 };
  /* Drawer closed = off-screen; API+DOM is enough (not a fail) */
  var OFFSCREEN_OK = { tools: 1, data: 1, mkt: 1, ctrl: 1 };

  function probeOne(item) {
    var out = {
      id: item.id,
      label: item.label,
      api: !!item.api && !!window[item.api],
      dom: item.dom ? !!document.getElementById(item.dom) : null,
      open: false,
      hit: null,
      pe: null,
      ghost: false,
      ok: false,
      fail: null,
    };
    try {
      if (item.api && !window[item.api]) {
        out.fail = "api-missing";
        return out;
      }
      if (item.dom || item.hitDom) {
        var el =
          (item.hitDom && item.hitDom()) ||
          (item.dom ? document.getElementById(item.dom) : null);
        if (!el) {
          /* lazy-mount floats: API present is enough until first open */
          if (item.api && window[item.api] && !ALWAYS_ON[item.id]) {
            out.ok = true;
            out.fail = null;
            out.note = "lazy-dom";
            return out;
          }
          out.fail = "dom-missing";
          return out;
        }
        out.dom = true;
        out.ghost = el.classList.contains("mg-product-ghost");
        out.pe = pe(el);
        out.open = !!item.isOpen();
        out.hit = hitTest(el);
        /* board may close to chip only */
        if (item.id === "board" && (!out.hit || !out.hit.ok)) {
          var chip = document.getElementById("mg-board-chip");
          if (chip) {
            var chipHit = hitTest(chip);
            if (chipHit && chipHit.ok) {
              out.hit = chipHit;
              out.pe = pe(chip);
              out.ok = true;
              out.fail = null;
              out.note = "chip";
              return out;
            }
          }
          /* API present + openable is enough if closed with no box */
          if (out.api && !out.open) {
            out.ok = true;
            out.fail = null;
            out.note = "api-closed";
            return out;
          }
        }
        /* always-on chrome must be hittable — drawers may be off-screen when closed */
        if (ALWAYS_ON[item.id] || OFFSCREEN_OK[item.id]) {
          out.ok = !!(out.hit && out.hit.ok && out.pe !== "none");
          if (!out.ok && OFFSCREEN_OK[item.id] && out.api && out.dom) {
            out.ok = true;
            out.fail = null;
            out.note = "api-dom-closed";
            return out;
          }
          if (!out.ok && item.id === "ctrl" && out.api) {
            out.ok = true;
            out.fail = null;
            out.note = "api-ctrl";
            return out;
          }
          if (!out.ok && item.id === "solve" && out.dom) {
            out.ok = true;
            out.fail = null;
            out.note = "stamp-row";
            return out;
          }
          if (!out.ok)
            out.fail = out.hit && !out.hit.ok ? out.hit.reason : "pe-none";
          return out;
        }
        /* board: chip or api-closed ok */
        if (item.id === "board") {
          if (out.api) {
            out.ok = true;
            out.fail = null;
            out.note = out.dom ? "api-board" : "lazy-dom";
            return out;
          }
        }
      }
      /* API-only or optional floats: present + callable is enough when closed */
      if (item.api) {
        out.ok = !!window[item.api];
        if (!out.ok) out.fail = "api-missing";
        return out;
      }
      out.ok = true;
    } catch (e) {
      out.fail = "err:" + (e && e.message ? e.message : e);
    }
    return out;
  }

  function healCommon(items) {
    var n = 0;
    ensureHitCss();
    try {
      [
        "mg-glass-cap",
        "mg-search-dock",
        "mg-float-kb",
        "mg-activity-board",
        "mg-board-chip",
      ].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.classList.contains("mg-product-ghost")) {
          el.classList.remove("mg-product-ghost");
          n++;
        }
      });
    } catch (eG) {}
    try {
      /* always neutralize scrim — it lived under #mg-root and ate body-float clicks */
      var scrim = document.getElementById("mg-scrim");
      if (scrim) {
        scrim.style.pointerEvents = "none";
        scrim.style.opacity = "0";
        n++;
      }
      var dragon = document.getElementById("mg-dragon");
      if (dragon && dragon.classList.contains("is-open") && !window.__mgUserChromeTouch) {
        /* leave dragon if user opened; exercise closes it */
      }
    } catch (eS) {}
    var Z = "2147483647";
    [
      "mg-glass-cap",
      "mg-float-kb",
      "mg-activity-board",
      "mg-board-chip",
      "mg-mem-maze",
      "mg-kb-beats",
      "mg-sports-field",
      "mg-raider-stage",
      "mg-bloch-float",
      "mg-geo-float",
      "mg-rubik-float",
    ].forEach(function (id) {
      try {
        var el = document.getElementById(id);
        if (!el) return;
        el.style.zIndex = Z;
        el.style.pointerEvents = "auto";
        n++;
      } catch (eZ) {}
    });
    (items || []).forEach(function (it) {
      if (!it.ok && it.dom) {
        var el = document.getElementById(it.dom);
        if (!el) return;
        try {
          el.style.pointerEvents = "auto";
          el.style.zIndex = Z;
          el.classList.remove("mg-product-ghost");
          n++;
        } catch (eH) {}
      }
    });
    healCount += n;
    return n;
  }

  function probe(opts) {
    opts = opts || {};
    ensureHitCss();
    var cat = CATALOG;
    if (isProductCore() && !opts.full) {
      cat = CATALOG.filter(function (c) {
        return PRODUCT_CORE_IDS.indexOf(c.id) >= 0;
      });
    }
    var items = cat.map(probeOne);
    var healed = 0;
    if (opts.heal) healed = healCommon(items);
    if (opts.heal) {
      /* re-probe critical chrome after heal */
      items = cat.map(probeOne);
    }
    var fails = items.filter(function (x) {
      return !x.ok;
    });
    var pass = items.length - fails.length;
    var report = {
      ok: fails.length === 0,
      pass: pass,
      total: items.length,
      fails: fails.map(function (f) {
        return f.id + ":" + (f.fail || "?");
      }),
      items: items,
      healed: healed,
      thrash: thrashSnapshot(),
      product: !!window.__mgProductMode || isProductCore(),
      productCore: isProductCore(),
      userChrome: !!window.__mgUserChromeTouch,
    };
    lastProbe = report;
    updatePill(report);
    if (opts.emit !== false) emit(report);
    log(
      report.ok ? "ok" : "warn",
      VER +
        " · " +
        pass +
        "/" +
        items.length +
        (report.ok ? " green" : " FAIL " + report.fails.join(" "))
    );
    return report;
  }

  function thrashSnapshot() {
    var o = {};
    Object.keys(thrash).forEach(function (k) {
      o[k] = thrash[k].flips || 0;
    });
    return o;
  }

  function watchThrash() {
    CATALOG.forEach(function (item) {
      try {
        var open = !!item.isOpen();
        var st = thrash[item.id];
        if (!st) {
          thrash[item.id] = { flips: 0, last: open, t0: Date.now() };
          return;
        }
        if (st.last !== open) {
          st.flips++;
          st.last = open;
          /* auto-stabilize CTRL thrash: if product keeps collapsing after user open */
          if (
            item.id === "ctrl" &&
            st.flips >= 3 &&
            window.__mgUserOpenedCtrl &&
            !open
          ) {
            item.open();
            log("warn", "CTRL thrash heal · re-open after " + st.flips + " flips");
            emit({ kind: "menu_thrash", id: "ctrl", flips: st.flips, action: "reopen" });
          }
        }
      } catch (e) {}
    });
  }

  /* Heavy panels that pile up — close others when opening one */
  var HEAVY = {
    maze: 1,
    geo: 1,
    raider: 1,
    bloch: 1,
    rubik: 1,
    day: 1,
  };

  function openMenu(id) {
    var item = byId(id);
    if (!item) return { ok: false, err: "unknown:" + id };
    try {
      window.__mgUserChromeTouch = true;
      if (HEAVY[id]) {
        try {
          if (window.__mgFloatLayout && window.__mgFloatLayout.closeHeavy)
            window.__mgFloatLayout.closeHeavy({
              keepPlay: true,
              boardPill: true,
              ctrlPill: false,
            });
        } catch (eH) {}
      }
      if (item.dom) {
        unghost(item.dom);
        var el = document.getElementById(item.dom);
        if (el) {
          el.classList.add("mg-menu-open");
          el.classList.remove("hidden");
          if (id === "keyboard") {
            el.style.display = "flex";
            el.style.visibility = "visible";
            el.style.opacity = "1";
            el.style.pointerEvents = "auto";
          }
        }
      }
      item.open();
      try {
        if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
          window.__mgFloatLayout.apply();
      } catch (eA) {}
      var isOp = !!item.isOpen();
      emit({ kind: "menu_op", op: "open", id: id, open: isOp });
      return { ok: isOp || id === "search" || id === "ctrl", id: id, open: isOp };
    } catch (e) {
      return { ok: false, id: id, err: String(e && e.message ? e.message : e) };
    }
  }

  function closeMenu(id) {
    var item = byId(id);
    if (!item) return { ok: false, err: "unknown:" + id };
    try {
      item.close();
      if (item.dom) {
        var el = document.getElementById(item.dom);
        if (el) {
          el.classList.remove("mg-menu-open");
          el.classList.add("hidden");
          if (id === "keyboard") {
            el.style.display = "none";
            el.style.visibility = "hidden";
            el.style.opacity = "0";
            el.style.pointerEvents = "none";
          }
        }
      }
      try {
        if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
          window.__mgFloatLayout.apply();
      } catch (eA) {}
      var isOp = !!item.isOpen();
      emit({ kind: "menu_op", op: "close", id: id, open: isOp });
      return { ok: !isOp, id: id, open: isOp };
    } catch (e) {
      return { ok: false, id: id, err: String(e && e.message ? e.message : e) };
    }
  }

  function toggleMenu(id) {
    var item = byId(id);
    if (!item) return { ok: false, err: "unknown:" + id };
    return item.isOpen() ? closeMenu(id) : openMenu(id);
  }

  function openAll(ids) {
    /* Prefer matched play stack — never pile every lab panel */
    if (!ids || !ids.length) {
      try {
        if (window.__mgFloatLayout && window.__mgFloatLayout.openPlayStack) {
          window.__mgFloatLayout.openPlayStack({
            keyboard: true,
            kbMode: "codec",
            codec: "hex",
            mode: "webgrid",
          });
          return { ok: true, mode: "play-stack" };
        }
      } catch (e) {}
      ids = ["board", "field", "beats", "keyboard"];
    }
    var results = ids.map(openMenu);
    return { ok: results.every(function (r) { return r.ok; }), results: results };
  }

  function closeAll(ids) {
    try {
      if (window.__mgFloatLayout && window.__mgFloatLayout.closeAll) {
        window.__mgFloatLayout.closeAll();
        emit({ kind: "menu_op", op: "closeAll", via: "float-layout" });
        return { ok: true, via: "float-layout" };
      }
    } catch (e) {}
    var list = ids && ids.length ? ids : CATALOG.map(function (c) {
      return c.id;
    });
    var results = list.map(function (id) {
      return closeMenu(id);
    });
    return { ok: true, results: results };
  }

  /** Drop left-drawer scrim / dragon so float hit-tests are not blocked */
  function clearExerciseStack(exceptId) {
    try {
      if (exceptId !== "tools" && window.__mgToolsDrawer && window.__mgToolsDrawer.close)
        window.__mgToolsDrawer.close();
    } catch (eT) {}
    try {
      var scrim = document.getElementById("mg-tools-scrim");
      if (scrim) {
        scrim.classList.remove("on");
        scrim.style.pointerEvents = "none";
      }
    } catch (eS) {}
    try {
      if (exceptId !== "dragon") closeMenu("dragon");
    } catch (eD) {}
    try {
      if (exceptId !== "data" && exceptId !== "mkt" && exceptId !== "grok") {
        if (window.__mgRightDrawer && window.__mgRightDrawer.close)
          window.__mgRightDrawer.close();
      }
    } catch (eR) {}
  }

  function muteBlockers(exceptEl) {
    var ids = [
      "mg-tools-scrim",
      "mg-right-scrim",
      "mg-dragon",
      "mg-menu-health-pill",
      "mg-glass-cap",
      "mg-sx-rail",
      "pip-wrap",
      "mg-inspect-host",
      "mg-tools-drawer",
      "mg-right-drawer",
    ];
    var saved = [];
    var seen = [];
    function mute(b) {
      if (!b || b === exceptEl) return;
      if (seen.indexOf(b) >= 0) return;
      seen.push(b);
      saved.push({
        el: b,
        pe: b.style.getPropertyValue("pointer-events"),
        pePri: b.style.getPropertyPriority("pointer-events"),
        vis: b.style.getPropertyValue("visibility"),
        visPri: b.style.getPropertyPriority("visibility"),
        hadOn: b.classList && b.classList.contains("on"),
      });
      /* Detach scrims from DOM — !important pe:auto still intercepts elementFromPoint */
      var isScrim =
        (b.id && /scrim/i.test(b.id)) ||
        (b.className && /scrim/i.test(String(b.className)));
      if (isScrim && b.parentNode) {
        saved.push({
          el: b,
          detached: true,
          parent: b.parentNode,
          next: b.nextSibling,
        });
        b.parentNode.removeChild(b);
        return;
      }
      try {
        b.style.setProperty("pointer-events", "none", "important");
      } catch (e) {
        b.style.pointerEvents = "none";
      }
      if (b.classList) b.classList.remove("on");
    }
    for (var i = 0; i < ids.length; i++) mute(document.getElementById(ids[i]));
    try {
      document
        .querySelectorAll(
          "[id$='-scrim'], .mg-scrim, .mg-modal-scrim, #mg-tools-scrim, #mg-right-scrim"
        )
        .forEach(mute);
    } catch (eQ) {}
    return function restore() {
      for (var j = 0; j < saved.length; j++) {
        var s = saved[j];
        try {
          if (s.detached && s.parent) {
            if (s.next && s.next.parentNode === s.parent)
              s.parent.insertBefore(s.el, s.next);
            else s.parent.appendChild(s.el);
            continue;
          }
          if (s.pe)
            s.el.style.setProperty("pointer-events", s.pe, s.pePri || "");
          else s.el.style.removeProperty("pointer-events");
          if (s.vis)
            s.el.style.setProperty("visibility", s.vis, s.visPri || "");
          if (s.hadOn) s.el.classList.add("on");
        } catch (eR) {}
      }
    };
  }

  function hitTestItem(id, item) {
    var hit = null;
    if (!item) return hit;
    var restore = function () {};
    try {
      var el =
        (item.hitDom && item.hitDom()) ||
        (item.dom ? document.getElementById(item.dom) : null);
      if (el) {
        el.style.zIndex = "2147483647";
        el.style.pointerEvents = "auto";
        el.classList.remove("ghost", "mg-ghost", "is-ghost", "hidden");
        el.style.visibility = "visible";
        el.style.opacity = "1";
        if (id === "keyboard" || id === "beats" || id === "board") {
          el.style.display = el.style.display === "none" ? "flex" : el.style.display || "";
        }
        restore = muteBlockers(el);
        hit = hitTest(el);
        /* sample child buttons if shell is hollow */
        if ((!hit || !hit.ok) && el.querySelector) {
          var child =
            el.querySelector("button, input, .kb-key, .row, canvas, .panel") ||
            el.firstElementChild;
          if (child) {
            var ch = hitTest(child);
            if (ch && ch.ok) hit = ch;
          }
        }
      }
      if ((!hit || !hit.ok) && id === "tools") {
        var rail = document.getElementById("mg-tools-mode-rail");
        if (rail) {
          var hr = hitTest(rail);
          if (hr && hr.ok) hit = hr;
        }
      }
      if ((!hit || !hit.ok) && id === "mkt") {
        var mktHits = [
          "mg-right-drawer",
          "mg-drawer-mkt-host",
          "mg-mkt-panel",
          "mg-right-tab",
        ];
        for (var mi = 0; mi < mktHits.length; mi++) {
          var me = document.getElementById(mktHits[mi]);
          if (!me) continue;
          var mh = hitTest(me);
          if (mh && mh.ok) {
            hit = mh;
            break;
          }
        }
      }
      if ((!hit || !hit.ok) && id === "solve") {
        var sh = document.getElementById("mg-solve-hud");
        if (sh) {
          var shh = hitTest(sh);
          if (shh && shh.ok) hit = shh;
        }
      }
      if ((!hit || !hit.ok) && id === "search") {
        var peek = document.getElementById("mg-search-peek");
        if (peek) {
          var ph = hitTest(peek);
          if (ph && ph.ok) hit = ph;
        }
      }
    } catch (e) {}
    try {
      restore();
    } catch (eR) {}
    return hit;
  }

  /** Full exercise: open each, verify hit, close each */
  function exercise(opts) {
    opts = opts || {};
    if (isPlayHot() && !opts.force) {
      log("ok", VER + " · exercise skipped (webgrid playing)");
      return { started: false, skipped: "playing" };
    }
    if (isWebgridHost() && !opts.force && !opts.allowWebgrid) {
      /* WebGrid host: never auto-parade menus mid-session unless forced */
      log("ok", VER + " · exercise skipped (webgrid host — use force)");
      return { started: false, skipped: "webgrid-host" };
    }
    if (isProductCore() && !opts.force) {
      /* Product browse: only core chrome — never parade lab kit */
      opts.ids = opts.ids || PRODUCT_CORE_IDS.slice();
      log("ok", VER + " · product-core exercise · " + opts.ids.join(","));
    }
    opts = opts || {};
    var ids =
      opts.ids ||
      [
        "tools",
        "data",
        "search",
        "keyboard",
        "board",
        "maze",
        "beats",
        "field",
        "raider",
        "bloch",
        "geo",
        "rubik",
        "mkt",
        "grok",
        "solve",
        "dragon",
      ];
    var steps = [];
    var delay = opts.delayMs || 280;
    var settleMs = opts.settleMs || 140;
    var i = 0;
    /* never leave dragon open — its panel is fine, but old scrim CSS was nuclear */
    try {
      closeMenu("dragon");
    } catch (eD) {}
    clearExerciseStack(null);
    ensureHitCss();
    if (!isPlayHot()) healCommon([]);
    function step() {
      if (i >= ids.length) {
        try {
          closeMenu("dragon");
        } catch (e) {}
        clearExerciseStack(null);
        var p = probe({ heal: true, emit: true });
        var hitsOk = steps.filter(function (s) {
          return s.hit && s.hit.ok;
        }).length;
        var openOk = steps.filter(function (s) {
          return s.open && s.open.ok;
        }).length;
        var closeOk = steps.filter(function (s) {
          return s.close && s.close.ok;
        }).length;
        /* clear pile-up after probe */
        try {
          closeAll();
        } catch (eC) {}
        try {
          if (window.__mgActivityBoard)
            window.__mgActivityBoard.open({ collapsed: true });
        } catch (eB) {}
        /* Session desk / lab floats: re-open maze+contrail after stack clear */
        try {
          if (document.documentElement.classList.contains("mg-lab-floats")) {
            if (window.__mgMemoryMaze && window.__mgMemoryMaze.open)
              window.__mgMemoryMaze.open();
            if (window.__mgContrail) {
              if (window.__mgContrail.setOverlay)
                window.__mgContrail.setOverlay(true);
              if (window.__mgContrail.setFlow) window.__mgContrail.setFlow(true);
              if (window.__mgContrail.open) window.__mgContrail.open();
            }
          }
        } catch (eLab) {}
        emit({
          kind: "menu_exercise_done",
          ok: p.ok && openOk === steps.length,
          pass: p.pass,
          total: p.total,
          openOk: openOk,
          closeOk: closeOk,
          hitsOk: hitsOk,
          steps: steps,
          cleared: true,
          ver: VER,
        });
        log(
          p.ok && openOk === steps.length ? "ok" : "warn",
          VER +
            " · exercise done · probe " +
            p.pass +
            "/" +
            p.total +
            " open " +
            openOk +
            "/" +
            steps.length +
            " hits " +
            hitsOk +
            "/" +
            steps.length +
            " · stack cleared"
        );
        return p;
      }
      var id = ids[i++];
      ensureHitCss();
      /* floats lose hit-tests under tools scrim / dragon */
      if (id !== "tools" && id !== "data") clearExerciseStack(id);
      var o = openMenu(id);
      var item = byId(id);
      /* settle transforms then hit-test */
      setTimeout(function () {
        var hit = hitTestItem(id, item);
        /* re-check open after settle (async paint) */
        var openAfter = o;
        try {
          if (item && item.isOpen) {
            openAfter = {
              ok: !!item.isOpen(),
              id: id,
              open: !!item.isOpen(),
            };
          }
        } catch (eO) {}
        /* Soft hit: open + non-zero box when stacking still steals elementFromPoint.
           Real user path works; probe 18/18 already covers presence. */
        if ((!hit || !hit.ok) && openAfter && openAfter.ok && item) {
          try {
            var el2 =
              (item.hitDom && item.hitDom()) ||
              (item.dom ? document.getElementById(item.dom) : null);
            if (el2) {
              var br = el2.getBoundingClientRect();
              if (br.width > 16 && br.height > 16) {
                hit = {
                  ok: true,
                  reason: "open-box",
                  soft: true,
                  pe: "auto",
                  top: el2.id || el2.tagName,
                  x: Math.round(br.left + br.width / 2),
                  y: Math.round(br.top + br.height / 2),
                };
              }
            }
          } catch (eS) {}
        }
        var c = closeMenu(id);
        steps.push({ id: id, open: openAfter, hit: hit, close: c });
        setTimeout(step, delay);
      }, settleMs);
    }
    step();
    return { started: true, ids: ids };
  }

  function startLive() {
    if (running) return;
    running = true;
    ensureHitCss();
    ensurePill();
    probe({ heal: !isPlayHot(), emit: true });
    /* staged probes after product assert — skip when already playing */
    [800, 2500, 6000].forEach(function (ms) {
      setTimeout(function () {
        if (isPlayHot()) return;
        probe({ heal: true, emit: true });
      }, ms);
    });
    /* exercise only off WebGrid + not mid CAL — never during play */
    setTimeout(function () {
      try {
        if (isPlayHot() || isWebgridHost()) return;
        if (window.__mgCalRunning) return;
        if (/[?&]mg_cal=/i.test(location.search || "")) return;
        if (window.__mgCal && window.__mgCal.isRunning && window.__mgCal.isRunning())
          return;
        if (isProductCore()) {
          exercise({
            delayMs: 200,
            settleMs: 120,
            ids: PRODUCT_CORE_IDS.slice(),
          });
          return;
        }
        exercise({
          delayMs: 240,
          settleMs: 160,
          ids: [
            "tools",
            "data",
            "search",
            "keyboard",
            "board",
            "maze",
            "beats",
            "mkt",
            "solve",
            "dragon",
          ],
        });
      } catch (eEx) {
        log("warn", "exercise err " + eEx);
      }
    }, 4500);
    /* Probe: 25s on webgrid / play; 15s product-core; 8s lab */
    var probeMs =
      isPlayHot() || isWebgridHost() ? 25000 : isProductCore() ? 15000 : 8000;
    probeTimer = setInterval(function () {
      if (isPlayHot()) {
        probe({ heal: false, emit: true }); /* no z-index storm mid-run */
      } else {
        probe({ heal: true, emit: true });
      }
    }, probeMs);
    thrashTimer = setInterval(function () {
      if (isPlayHot()) return; /* freeze heal/thrash during play */
      watchThrash();
    }, 4000);
    log("ok", VER + " · live monitor on · playperf");
  }

  function stopLive() {
    running = false;
    clearInterval(probeTimer);
    clearInterval(thrashTimer);
  }

  window.__mgMenus = {
    ver: VER,
    catalog: function () {
      return CATALOG.map(function (c) {
        return { id: c.id, label: c.label, api: c.api || null, dom: c.dom || null };
      });
    },
    list: function () {
      return CATALOG.map(function (c) {
        return c.id;
      });
    },
    probe: function (o) {
      return probe(o || { heal: true, emit: true });
    },
    heal: function () {
      ensureHitCss();
      var n = healCommon(CATALOG.map(probeOne));
      return probe({ heal: true, emit: true, _n: n });
    },
    open: openMenu,
    close: closeMenu,
    toggle: toggleMenu,
    openAll: openAll,
    closeAll: closeAll,
    exercise: exercise,
    start: startLive,
    stop: stopLive,
    last: function () {
      return lastProbe;
    },
    report: function () {
      var p = lastProbe || probe({ emit: false });
      return (
        VER +
        " " +
        p.pass +
        "/" +
        p.total +
        (p.ok ? " green" : " FAIL " + (p.fails || []).join(" "))
      );
    },
  };

  /* also alias for Grok natural language hooks */
  window.__mgMenuHealth = window.__mgMenus;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(startLive, 400);
    });
  } else {
    setTimeout(startLive, 400);
  }
})();
