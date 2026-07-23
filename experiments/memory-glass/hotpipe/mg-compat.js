/* Memory Glass · Compat / power profile
 * Targets 2019 MacBook Pro (Intel + Touch Bar) and other constrained laptops:
 * fewer layers, less blur, no lab thrash, longer probe intervals.
 * Force: ?mg_low=1 · localStorage mg.power=low · env MG_LOW_POWER (native sets window.__mgPowerHint)
 * VER: mg-compat-v1
 */
(function () {
  "use strict";
  var VER = "mg-compat-v2-scroll";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._compatVer === VER) return;
  HP._compatVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "compat");
    } catch (e) {}
  }

  function forcedLow() {
    try {
      if (window.__mgPowerHint === "low" || window.__mgPowerHint === "lite")
        return true;
      if (/[?&]mg_low=1\b/i.test(location.search || "")) return true;
      if (/[?&]mg_power=low\b/i.test(location.search || "")) return true;
      var ls = localStorage.getItem("mg.power");
      if (ls === "low" || ls === "lite") return true;
    } catch (e) {}
    return false;
  }

  function forcedFull() {
    try {
      if (window.__mgPowerHint === "full") return true;
      if (/[?&]mg_lab_full=1\b/i.test(location.search || "")) return true;
      if (localStorage.getItem("mg.power") === "full") return true;
    } catch (e) {}
    return false;
  }

  /** WebGL renderer — Safari still reports MacIntel on Apple Silicon */
  function isAppleGpu() {
    try {
      var c = document.createElement("canvas");
      var gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) return false;
      var dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (!dbg) return false;
      var r = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "");
      return /Apple\s*M\d|Apple GPU|Apple Inc/i.test(r);
    } catch (e) {
      return false;
    }
  }

  /**
   * Heuristic low power (2019 Intel MBP Touch Bar class).
   * Never treat Apple Silicon as low unless forced (WebKit UA still says "Intel Mac").
   */
  function heuristicLow() {
    try {
      if (isAppleGpu()) return false;
      var cores = navigator.hardwareConcurrency || 8;
      var mem = navigator.deviceMemory || 0;
      /* Very constrained machines only */
      if (cores > 0 && cores <= 4) return true;
      if (mem > 0 && mem <= 8) return true;
      if (navigator.connection && navigator.connection.saveData) return true;
      /* Explicit reduced-motion users often on laggy laptops */
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
        cores > 0 &&
        cores <= 8
      )
        return true;
      /*
       * Intel discrete/iris without Apple GPU — treat ≤12 threads as 2019-MBP-class
       * only when WebGL renderer mentions Intel/AMD (not Apple).
       */
      try {
        var c2 = document.createElement("canvas");
        var gl2 = c2.getContext("webgl");
        if (gl2) {
          var d2 = gl2.getExtension("WEBGL_debug_renderer_info");
          if (d2) {
            var ren = String(gl2.getParameter(d2.UNMASKED_RENDERER_WEBGL) || "");
            if (/Intel|AMD|Radeon|NVIDIA/i.test(ren) && cores <= 12) return true;
          }
        }
      } catch (eG) {}
    } catch (e) {}
    return false;
  }

  var mode = "full";
  if (forcedFull()) mode = "full";
  else if (forcedLow() || heuristicLow()) mode = "low";

  var profile = {
    ver: VER,
    mode: mode,
    low: mode === "low",
    blur: mode === "low" ? "12px" : "48px",
    backdrop: mode === "low" ? false : true,
    menuHealth: mode === "low" ? false : true,
    drawers: mode === "low" ? "lazy" : "eager",
    maxFpsHint: mode === "low" ? 30 : 60,
    glassAlpha: mode === "low" ? 0.82 : 0.55,
  };

  window.__mgCompat = profile;
  window.__mgPower = profile;

  try {
    document.documentElement.classList.toggle("mg-low-power", profile.low);
    document.documentElement.classList.toggle("mg-power-full", !profile.low);
    document.documentElement.setAttribute("data-mg-power", mode);
  } catch (eC) {}

  /* CSS: kill expensive filters on low power */
  if (profile.low) {
    var st = document.getElementById("mg-compat-css");
    if (!st) {
      st = document.createElement("style");
      st.id = "mg-compat-css";
      document.documentElement.appendChild(st);
    }
    st.textContent = [
      "html.mg-low-power #mg-agent-desk,",
      "html.mg-low-power #mg-rec-chip,",
      "html.mg-low-power #mg-tools-drawer,",
      "html.mg-low-power #mg-right-drawer,",
      "html.mg-low-power #mg-row3-glass,",
      "html.mg-low-power #mg-mini-draw-tb,",
      "html.mg-low-power #mg-pick-tip,",
      "html.mg-low-power #mg-annotate-toolbar{",
      "  backdrop-filter:none!important;-webkit-backdrop-filter:none!important;",
      "  background:rgba(12,14,20,0.92)!important}",
      "html.mg-low-power #mg-row3-glass{",
      "  background:rgba(10,12,18,0.78)!important;box-shadow:none!important}",
      "html.mg-low-power .mg-shell-word{",
      "  text-shadow:0 1px 2px rgba(0,0,0,0.7)!important}",
      /* Hide lab ghosts that still cost composite */
      "html.mg-low-power #mg-bloch-orb,html.mg-low-power #mg-rubik-orb,",
      "html.mg-low-power #mg-live-solve-hud,html.mg-low-power #mg-sx-rail{",
      "  display:none!important}",
    ].join("");
  }

  /* Park lab early on low power */
  if (profile.low) {
    setTimeout(function () {
      try {
        if (window.__mgLazy && window.__mgLazy.parkLab) window.__mgLazy.parkLab();
      } catch (e) {}
    }, 0);
  }

  /**
   * Scroll unlock — droplet shell sets html{overflow:hidden;height:100%} so many
   * sites (SpaceX, etc.) cannot window-scroll. Prefer document scrolling; keep
   * WebGrid play locked (game needs fixed viewport).
   */
  function installScrollUnlock() {
    try {
      if (document.getElementById("pip-wrap")) return;
    } catch (e0) {
      return;
    }
    var st = document.getElementById("mg-scroll-unlock-css");
    if (!st) {
      st = document.createElement("style");
      st.id = "mg-scroll-unlock-css";
      (document.head || document.documentElement).appendChild(st);
    }
    st.textContent = [
      "/* browse: let the document scroll (shell droplet was locking html) */",
      "html:not(.mg-webgrid-play):not(.mg-drawing-capture){",
      "  overflow-x:hidden!important;",
      "  overflow-y:auto!important;",
      "  height:auto!important;",
      "  min-height:100%!important;",
      "  overscroll-behavior-y:auto!important}",
      "html:not(.mg-webgrid-play):not(.mg-drawing-capture) body{",
      "  height:auto!important;",
      "  min-height:100%!important;",
      "  overflow-x:hidden!important;",
      "  overflow-y:visible!important;",
      "  overscroll-behavior-y:auto!important}",
      "/* scrims must never eat wheel when closed */",
      "#mg-tools-scrim:not(.on),#mg-right-scrim:not(.on){",
      "  pointer-events:none!important;opacity:0!important}",
      "/* F13 / annotate art layers never capture wheel */",
      "#mg-f13-sketch,#mg-mini-draw-cv:not(.on),#mg-annotate-canvas:not(.on){",
      "  pointer-events:none!important}",
    ].join("");

    function clearBlockers() {
      try {
        var scrim = document.getElementById("mg-tools-scrim");
        if (scrim && !scrim.classList.contains("on")) {
          scrim.style.pointerEvents = "none";
          scrim.style.opacity = "0";
        }
        var rs = document.getElementById("mg-right-scrim");
        if (rs && !rs.classList.contains("on")) {
          rs.style.pointerEvents = "none";
        }
      } catch (eS) {}
      try {
        /* mini-draw full-screen .on blocks scroll — only when truly drawing */
        var md = document.getElementById("mg-mini-draw-cv");
        if (md && md.classList.contains("on")) {
          /* leave if user toggled DRAW intentionally */
        }
      } catch (eM) {}
      try {
        document.documentElement.classList.remove("mg-left-open");
        document.documentElement.classList.remove("mg-right-open");
        document.documentElement.classList.remove("mg-drawer-open");
      } catch (eC) {}
      try {
        if (window.__mgToolsDrawer && window.__mgToolsDrawer.isOpen && window.__mgToolsDrawer.isOpen()) {
          /* user has tools open — do not force close after first boot settle */
          return;
        }
      } catch (eT) {}
    }

    /* boot settle: close accidental scrim/drawer lock from menu-health */
    setTimeout(function () {
      try {
        if (window.__mgToolsDrawer && window.__mgToolsDrawer.close)
          window.__mgToolsDrawer.close();
        if (window.__mgRightDrawer && window.__mgRightDrawer.close)
          window.__mgRightDrawer.close();
      } catch (e) {}
      clearBlockers();
    }, 500);
    setTimeout(clearBlockers, 1800);
    setTimeout(clearBlockers, 3500);

    window.__mgScrollUnlock = {
      ver: VER,
      clear: clearBlockers,
      reinstall: installScrollUnlock,
    };
    log(VER + " · scroll unlock css");
  }
  installScrollUnlock();

  log(
    VER +
      " · power=" +
      mode +
      (profile.low ? " · 2019-MBP-safe lite stack" : " · full")
  );
})();
