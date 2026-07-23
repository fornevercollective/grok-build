/* Memory Glass · LIVE MENU HEALTH
 * Probes every chrome surface, auto-heals hit-targets / product ghosts,
 * exposes window.__mgMenus for Grok open/close/use of all menus.
 * Streams MG_WATCH-style MENU_HEALTH lines via ipc + __mgDevLog.
 * VER: menu-health-v6-dual-drawer
 */
(function () {
  "use strict";
  var VER = "menu-health-v7-less-thrash";
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
        if (d) d.classList.add("is-open");
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
        return !!(d && d.classList.contains("is-open"));
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
        if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.open)
          window.__mgKeyboardBeats.open();
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
        if (window.__mgRightDrawer) window.__mgRightDrawer.open("mkt");
        else if (window.__mgMarket) window.__mgMarket.open();
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
      },
      close: function () {
        if (window.__mgLiveSolveHud && window.__mgLiveSolveHud.close)
          window.__mgLiveSolveHud.close();
      },
      isOpen: function () {
        var t = document.getElementById("mg-solve-tray");
        return !!(t && !t.classList.contains("hidden"));
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
        var inside = el === top || el.contains(top);
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
      "#mg-live-solve-hud,#mg-menu-health-pill{",
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
      /* health pill */
      "#mg-menu-health-pill{",
      "  position:fixed;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));",
      "  z-index:" + Z + ";pointer-events:auto;cursor:pointer;",
      "  font:700 10px/1.2 ui-monospace,Menlo,system-ui;letter-spacing:0.04em;",
      "  padding:7px 11px;border-radius:999px;",
      "  color:rgba(240,248,255,0.95);",
      "  background:rgba(20,24,32,0.72);border:1px solid rgba(120,200,255,0.35);",
      "  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);",
      "  box-shadow:0 6px 20px rgba(0,0,0,0.28)}",
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
    (document.body || document.documentElement).appendChild(p);
    return p;
  }

  function updatePill(r) {
    try {
      var p = ensurePill();
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
      if (item.dom) {
        var el = document.getElementById(item.dom);
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
    var items = CATALOG.map(probeOne);
    var healed = 0;
    if (opts.heal) healed = healCommon(items);
    if (opts.heal) {
      /* re-probe critical chrome after heal */
      items = CATALOG.map(probeOne);
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
      product: !!window.__mgProductMode,
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

  /** Full exercise: open each, verify hit, close each */
  function exercise(opts) {
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
    var delay = opts.delayMs || 220;
    var i = 0;
    /* never leave dragon open — its panel is fine, but old scrim CSS was nuclear */
    try {
      closeMenu("dragon");
    } catch (eD) {}
    ensureHitCss();
    healCommon([]);
    function step() {
      if (i >= ids.length) {
        try {
          closeMenu("dragon");
        } catch (e) {}
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
      var o = openMenu(id);
      var item = byId(id);
      var hit = null;
      try {
        /* rAF so layout settles after open */
        if (item && item.dom) {
          var el = document.getElementById(item.dom);
          if (el) {
            el.style.zIndex = "2147483647";
            el.style.pointerEvents = "auto";
            hit = hitTest(el);
          }
        }
      } catch (e) {}
      var c = closeMenu(id);
      steps.push({ id: id, open: o, hit: hit, close: c });
      setTimeout(step, delay);
    }
    step();
    return { started: true, ids: ids };
  }

  function startLive() {
    if (running) return;
    running = true;
    ensureHitCss();
    ensurePill();
    probe({ heal: true, emit: true });
    /* staged probes after product assert windows (0.9/1.8/3.2s) */
    [500, 1200, 2200, 4000, 7000].forEach(function (ms) {
      setTimeout(function () {
        probe({ heal: true, emit: true });
      }, ms);
    });
    /* light exercise only when full CAL boot is not owning the stage */
    setTimeout(function () {
      try {
        if (window.__mgCalRunning) return;
        if (/[?&]mg_cal=/i.test(location.search || "")) return;
        if (window.__mgCal && window.__mgCal.isRunning && window.__mgCal.isRunning())
          return;
        exercise({
          delayMs: 180,
          ids: [
            "tools",
            "data",
            "search",
            "keyboard",
            "board",
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
    probeTimer = setInterval(function () {
      probe({ heal: true, emit: true });
    }, 8000);
    thrashTimer = setInterval(watchThrash, 2500);
    log("ok", VER + " · live monitor on");
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
