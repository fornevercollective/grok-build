/* Memory Glass · PRODUCT MODE
 * One mode: full-screen WebGrid play + clean metrics + no overlapping ghosts.
 * Default ON for neuralink WebGrid unless MG_PRODUCT=0 or ?mg_lab_full=1.
 * VER: product-mode-v2-drawer-aware
 *
 * v2: assertedOnce + never re-collapse user chrome (CTRL / keyboard / boards
 * the user opened). Fixes menu thrash where CTRL opens then force-closes.
 * Drawer-aware: left TOOLS drawer counts as user chrome (replaces permanent CTRL).
 */
(function () {
  "use strict";
  var VER = "product-mode-v2-drawer-aware";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._productModeVer === VER) return;
  HP._productModeVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "product");
    } catch (e) {}
  }

  function isWebgrid() {
    try {
      return (
        /neuralink\.com$/i.test(location.hostname || "") &&
        /webgrid/i.test(location.pathname || "")
      );
    } catch (e) {
      return false;
    }
  }

  function wantProduct() {
    try {
      if (/[?&]mg_lab_full=1\b/i.test(location.search || "")) return false;
      if (/[?&]mg_lab_demo=1\b/i.test(location.search || "")) return false;
      if (/[?&]mg_product=0\b/i.test(location.search || "")) return false;
      if (/[?&]mg_product=1\b/i.test(location.search || "")) return true;
      if (window.__MG_PRODUCT === 0 || window.__MG_PRODUCT === false) return false;
      if (window.__MG_PRODUCT === 1 || window.__MG_PRODUCT === true) return true;
      /* default: product on WebGrid, off elsewhere */
      return isWebgrid();
    } catch (e) {
      return isWebgrid();
    }
  }

  function userTouchedChrome() {
    return !!(window.__mgUserChromeTouch || window.__mgUserOpenedCtrl || window.__mgUserOpenedKb);
  }

  var active = wantProduct();
  window.__mgProductMode = active;
  var assertedOnce = false;

  function ensureCss() {
    var old = document.getElementById("mg-product-mode-css");
    if (old) old.remove();
    if (!active) return;
    var st = document.createElement("style");
    st.id = "mg-product-mode-css";
    st.textContent = [
      "html.mg-product{",
      "  --mg-product:1}",
      /* ghosts: hide lab floats until user opens (display none only if .mg-product-ghost) */
      "html.mg-product .mg-product-ghost{",
      "  display:none!important}",
      /* maze never FILL half-screen in product */
      "html.mg-product #mg-mem-maze.fill{",
      "  width:min(280px,22vw)!important;max-width:min(280px,22vw)!important}",
      "html.mg-product #mg-mem-maze.fill canvas{",
      "  min-height:160px!important;max-height:min(28vh,240px)!important}",
      /* board collapsed = shell top word (INSPECT/PAGE language) */
      "html.mg-product #mg-activity-board.collapsed{",
      "  top:var(--mg-shell-top,2px)!important;",
      "  right:max(12px, calc(12px + var(--mg-top-right-w,168px)))!important;",
      "  background:transparent!important;border:none!important;box-shadow:none!important;",
      "  border-radius:0!important;width:auto!important}",
      /* beats dock bottom — don't float mid-card */
      "html.mg-product #mg-kb-beats{",
      "  max-height:min(28vh,220px)!important}",
      /* body floats always hit-testable on WebGrid (not trapped under #mg-root) */
      "html.mg-product #mg-glass-cap,",
      "html.mg-product #mg-float-kb,",
      "html.mg-product #mg-activity-board,",
      "html.mg-product #mg-board-chip,",
      "html.mg-product #mg-rec-chip,",
      "html.mg-product #mg-search-dock,",
      "html.mg-product #mg-search-peek,",
      "html.mg-product #mg-search,",
      "html.mg-product #mg-dragon,",
      "html.mg-product #mg-panel,",
      "html.mg-product #mg-tabs{",
      "  pointer-events:auto!important}",
      "html.mg-product #mg-glass-cap button,",
      "html.mg-product #mg-glass-cap input,",
      "html.mg-product #mg-float-kb button,",
      "html.mg-product #mg-activity-board button,",
      "html.mg-product #mg-search-dock button,",
      "html.mg-product #mg-search-dock input{",
      "  pointer-events:auto!important;cursor:pointer}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function closeQuiet(api) {
    try {
      if (api && typeof api.close === "function") api.close();
    } catch (e) {}
  }

  function assertLeanChrome(force) {
    if (!active) return;
    try {
      document.documentElement.classList.add("mg-product");
    } catch (e) {}

    /* After first assert: only reflow — never re-close keyboard/user panels */
    if (assertedOnce && !force) {
      try {
        if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
          window.__mgFloatLayout.apply();
      } catch (eR) {}
      return;
    }
    assertedOnce = true;

    /* If user already opened chrome, never fight them on the first assert either */
    var respectUser = userTouchedChrome();

    /* Search bar starts collapsed (peek only) — stop mid-screen float open */
    try {
      if (!window.__mgUserSearchOpen) {
        var sd = document.getElementById("mg-search-dock");
        if (sd) {
          sd.classList.remove("is-open");
          sd.classList.remove("chat-open");
        }
      }
    } catch (eS) {}

    /* close lab ghosts (once) — skip if user already engaged chrome */
    if (!respectUser) {
      closeQuiet(window.__mgMemoryMaze);
      closeQuiet(window.__mgSportsField);
      closeQuiet(window.__mgRaider);
      closeQuiet(window.__mgGeoPattern);
      closeQuiet(window.__mgKeyboardBeats);
      closeQuiet(window.__mgRubikLang);
      try {
        if (window.__mgBlochSolve && window.__mgBlochSolve.close)
          window.__mgBlochSolve.close();
      } catch (eB) {}
    }
    /* keyboard: never auto-close — leave default-closed alone; never fight user launch */
    try {
      /* intentionally do not closeQuiet(__mgFloatKb) */
    } catch (eKb) {}

    [
      "mg-mem-maze",
      "mg-sports-field",
      "mg-raider-stage",
      "mg-geo-float",
      "mg-kb-beats",
      "mg-rubik-float",
      "mg-bloch-float",
    ].forEach(function (id) {
      try {
        var el = document.getElementById(id);
        if (el && el.classList && el.classList.contains("hidden"))
          el.classList.add("mg-product-ghost");
      } catch (e) {}
    });

    /* CTRL: collapse only if user has not opened it */
    if (!respectUser && !window.__mgUserOpenedCtrl) {
      try {
        if (window.__mgGlassCap && window.__mgGlassCap.collapse)
          window.__mgGlassCap.collapse();
        else {
          var cap = document.getElementById("mg-glass-cap");
          if (cap) cap.classList.add("collapsed");
        }
      } catch (eC) {}
    }

    /* LIVE RANK as pill only — don't collapse if user expanded it */
    try {
      if (window.__mgActivityBoard && !window.__mgUserOpenedBoard) {
        if (!window.__mgActivityBoard.isOpen || !window.__mgActivityBoard.isOpen()) {
          window.__mgActivityBoard.open({ collapsed: true });
        } else if (
          window.__mgActivityBoard.isCollapsed &&
          !window.__mgActivityBoard.isCollapsed()
        ) {
          window.__mgActivityBoard.collapse();
        }
      }
    } catch (eA) {}

    try {
      if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
        window.__mgFloatLayout.apply();
    } catch (eL) {}
  }

  function unlockLab() {
    active = false;
    window.__mgProductMode = false;
    try {
      document.documentElement.classList.remove("mg-product");
    } catch (e) {}
    var st = document.getElementById("mg-product-mode-css");
    if (st && st.parentNode) st.parentNode.removeChild(st);
    log(VER + " · lab unlocked");
  }

  /* Capture any user click on MG chrome so timers never re-collapse after */
  try {
    if (!window.__mgProductChromeTouchBound) {
      window.__mgProductChromeTouchBound = true;
      document.addEventListener(
        "pointerdown",
        function (ev) {
          try {
            var t = ev && ev.target;
            if (!t || !t.closest) return;
            if (
              t.closest(
                "#mg-glass-cap,#mg-float-kb,#mg-activity-board,#mg-board-chip," +
                  "#mg-search-dock,#mg-dragon,#mg-panel,#mg-tabs,#mg-mode-menu," +
                  "#mg-rec-chip,#mg-sx-rail,#mg-tools-drawer,#mg-tools-tab,#mg-tools-scrim"
              )
            ) {
              window.__mgUserChromeTouch = true;
              if (t.closest("#mg-glass-cap,#mg-tools-drawer,#mg-tools-tab"))
                window.__mgUserOpenedCtrl = true;
              if (t.closest("#mg-float-kb")) window.__mgUserOpenedKb = true;
              if (t.closest("#mg-activity-board,#mg-board-chip"))
                window.__mgUserOpenedBoard = true;
            }
          } catch (eT) {}
        },
        true
      );
    }
  } catch (eBind) {}

  ensureCss();
  if (active) {
    try {
      document.documentElement.classList.add("mg-product");
    } catch (e) {}
    /* after other modules mount — only first tick does lean collapse */
    setTimeout(assertLeanChrome, 900);
    setTimeout(assertLeanChrome, 1800);
    setTimeout(assertLeanChrome, 3200);
    log(VER + " · PRODUCT on · lean WebGrid chrome (stable)");
  } else {
    log(VER + " · PRODUCT off · full lab allowed");
  }

  window.__mgProduct = {
    ver: VER,
    active: function () {
      return !!window.__mgProductMode;
    },
    assertLean: assertLeanChrome,
    unlockLab: unlockLab,
    markUserChrome: function () {
      window.__mgUserChromeTouch = true;
    },
    report: function () {
      return (
        VER +
        " product=" +
        !!window.__mgProductMode +
        " asserted=" +
        assertedOnce +
        " userChrome=" +
        userTouchedChrome() +
        " host=" +
        (location.hostname || "")
      );
    },
  };
})();
