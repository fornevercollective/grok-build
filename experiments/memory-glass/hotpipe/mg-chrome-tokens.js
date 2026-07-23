/* Memory Glass · CHROME TOKENS (Jump A · presentable craft)
 * Single glass language for left/right drawers, shell words, acts, sections.
 * Inject early (before drawers). Idempotent.
 *
 * v4 · THREE header rows + row-3 frosted glass underlay:
 *   Row 1 metrics  — stamp · SOLVE · LIVE word
 *   Row 2 status   — SITREP
 *   Row 3 controls — ··· · CTRL · INSPECT · PAGE   ← last before page
 *   Glass band only under row 3 (readable on white + dark sites)
 *
 * VER: mg-chrome-tokens-v8-bot-chrome
 * v6: beat #mg-root stacking (INSPECT/PAGE lived above DATA)
 * v7: dual drawers equal stack; scrims don't bury the other side
 * v8: bottom chrome pad (footer lab + readout tabs) mirrors top 3-row
 */
(function () {
  "use strict";
  var VER = "mg-chrome-tokens-v8-bot-chrome";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._chromeTokensVer === VER) return;
  HP._chromeTokensVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var old = document.getElementById("mg-chrome-tokens-css");
  if (old) old.remove();
  var st = document.createElement("style");
  st.id = "mg-chrome-tokens-css";
  st.textContent = [
    ":root{",
    "  --mg-glass-bg:rgba(28,30,36,0.72);",
    "  --mg-glass-bg-strong:rgba(40,40,44,0.55);",
    "  --mg-glass-line:rgba(255,255,255,0.12);",
    "  --mg-glass-line-hot:rgba(140,200,255,0.45);",
    "  --mg-glass-text:rgba(244,246,250,0.94);",
    "  --mg-glass-muted:rgba(200,210,225,0.55);",
    "  --mg-glass-cyan:rgba(160,210,255,0.95);",
    "  --mg-glass-ok:rgba(120,230,160,0.95);",
    "  --mg-glass-hot:rgba(255,200,140,0.95);",
    "  --mg-glass-blur:blur(48px) saturate(1.8);",
    "  --mg-glass-radius:18px;",
    "  --mg-glass-radius-sm:12px;",
    "  --mg-glass-act-radius:16px;",
    "  --mg-glass-shadow:0 18px 48px rgba(0,0,0,0.36),inset 0 1px 0 rgba(255,255,255,0.12);",
    "  --mg-ease:cubic-bezier(.2,.9,.2,1);",
    "  --mg-dur:.22s;",
    "  --mg-hdr-fs:11px;",
    "  --mg-hdr-ls:0.22em;",
    /* three-row geometry */
    "  --mg-row-h:30px;",
    "  --mg-row1-top:4px;",
    "  --mg-row2-top:34px;",
    "  --mg-row3-top:64px;",
    "  --mg-row3-glass-h:32px;",
    "  --mg-shell-top:var(--mg-row1-top);",
    "  --mg-shell-band-h:var(--mg-row-h);",
    "  --mg-chrome-below:calc(var(--mg-row3-top) + var(--mg-row-h) + 8px);",
    "  --mg-page-pad-top:calc(var(--mg-row3-top) + var(--mg-row-h) + 10px);",
    "  --mg-act-min-h:72px;",
    "}",
    "html{",
    "  --mg-row1-top:4px!important;",
    "  --mg-row2-top:34px!important;",
    "  --mg-row3-top:64px!important;",
    "  --mg-row3-glass-h:32px!important;",
    "  --mg-page-pad-top:calc(var(--mg-row3-top) + 30px + 10px)!important;",
    "  --mg-chrome-below:calc(var(--mg-row3-top) + 30px + 8px)!important;",
    /* bottom chrome: readout + glass footer (lab · tabs · health) */
    "  --mg-bot-footer-h:36px!important;",
    "  --mg-bot-readout-h:30px!important;",
    "  --mg-bot-chrome-h:calc(var(--mg-bot-footer-h) + var(--mg-bot-readout-h))!important;",
    "  --mg-page-pad-bot:calc(var(--mg-bot-chrome-h) + 28px + env(safe-area-inset-bottom,0px))!important;",
    "  --mg-search-bottom:calc(var(--mg-bot-chrome-h) + 8px + env(safe-area-inset-bottom,0px))!important;",
    "  --mg-tabs-bottom:calc(var(--mg-bot-footer-h) + 2px + env(safe-area-inset-bottom,0px))!important;",
    "}",
    /* Always reserve pad so sites never paint under CTRL / INSPECT / PAGE / bottom chrome */
    "body{",
    "  padding-top:var(--mg-page-pad-top,104px)!important;",
    "  scroll-padding-top:var(--mg-page-pad-top,104px)!important;",
    "  padding-bottom:var(--mg-page-pad-bot,94px)!important;",
    "  scroll-padding-bottom:var(--mg-page-pad-bot,94px)!important}",

    /* ═══ ROW 3 glass underlay (only behind controls — option B) ═══ */
    "#mg-row3-glass{",
    "  position:fixed!important;",
    "  top:var(--mg-row3-top,64px)!important;",
    "  left:0!important;right:0!important;",
    "  height:var(--mg-row3-glass-h,32px)!important;",
    "  z-index:2147483640!important;",
    "  pointer-events:none!important;",
    "  background:linear-gradient(",
    "    to bottom,",
    "    rgba(10,12,18,0.52),",
    "    rgba(10,12,18,0.38)",
    "  )!important;",
    "  backdrop-filter:blur(22px) saturate(1.45)!important;",
    "  -webkit-backdrop-filter:blur(22px) saturate(1.45)!important;",
    "  border-bottom:1px solid rgba(255,255,255,0.1)!important;",
    "  box-shadow:0 8px 24px rgba(0,0,0,0.18)!important;",
    "}",
    "html.mg-cinema-on #mg-row3-glass,",
    "html.mg-dim-on #mg-row3-glass{opacity:0.35}",

    /* ═══ ROW 1 · metrics ═══ */
    "#mg-build-stamp{",
    "  top:var(--mg-row1-top,4px)!important;",
    "  left:48px!important;",
    "  z-index:2147483641!important;",
    "  max-width:min(36vw,280px)!important}",
    "#mg-solve-hud{",
    "  top:var(--mg-row1-top,4px)!important;",
    "  max-width:min(36vw,320px)!important;",
    "  z-index:2147483641!important}",
    "#mg-activity-board.collapsed,#mg-board-chip{",
    "  top:var(--mg-row1-top,4px)!important;",
    "  right:max(10px, calc(10px + var(--mg-top-right-w, 200px)))!important;",
    "  z-index:2147483642!important;",
    "  max-width:min(28vw,180px)!important}",

    /* ═══ ROW 2 · SITREP ═══ */
    "#mg-sitrep-chip{",
    "  top:var(--mg-row2-top,34px)!important;",
    "  left:50%!important;transform:translateX(-50%)!important;",
    "  max-width:min(70vw,520px)!important;",
    "  z-index:2147483000!important;",
    "  padding:4px 10px!important;font-size:9px!important;",
    "  opacity:0.9}",
    "#mg-sitrep-chip:hover{opacity:1}",

    /* ═══ ROW 3 · controls (above glass, last before page) ═══ */
    "#mg-stoplights{",
    "  top:var(--mg-row3-top,64px)!important;",
    "  left:10px!important;",
    "  z-index:2147483646!important;",
    "  min-height:28px!important;",
    "  pointer-events:auto!important}",
    "#mg-dragon{",
    "  top:var(--mg-row3-top,64px)!important;",
    "  z-index:2147483645!important;",
    "  max-width:min(320px,42vw)!important;",
    "  pointer-events:auto!important}",
    "#mg-top-right{",
    "  top:var(--mg-row3-top,64px)!important;",
    "  right:max(10px, env(safe-area-inset-right,0px))!important;",
    "  z-index:2147483640!important;",
    "  gap:16px!important;",
    "  pointer-events:auto!important}",
    "#mg-top-right button,#mg-dragon #mg-tab,#mg-stoplights button{",
    "  pointer-events:auto!important;cursor:pointer!important}",
    /* Drawers beat #mg-root (3646) so INSPECT/PAGE never cover panel content */
    "html.mg-right-open #mg-root,html.mg-left-open #mg-root{",
    "  z-index:2147483600!important}",
    "html.mg-right-open #mg-top-right{",
    "  right:calc(var(--mg-right-w,min(360px,90vw)) + 16px)!important;",
    "  z-index:2147483601!important;pointer-events:auto!important}",
    "html.mg-left-open #mg-top-right{",
    "  z-index:2147483601!important}",
    /* Equal open stack — dual side-by-side; never bury left under DATA */
    "html.mg-right-open #mg-right-drawer.open,",
    "html > #mg-right-drawer.open{",
    "  z-index:2147483645!important}",
    "html.mg-left-open #mg-tools-drawer.open,",
    "html > #mg-tools-drawer.open{",
    "  z-index:2147483645!important}",
    "html.mg-left-open.mg-right-open #mg-right-scrim.on,",
    "html.mg-left-open.mg-right-open #mg-tools-scrim.on{",
    "  pointer-events:none!important}",

    /* floats open below control row */
    "#mg-glass-cap,",
    "#mg-glass-cap.collapsed{",
    "  top:var(--mg-chrome-below,102px)!important;",
    "  left:10px!important;",
    "  z-index:2147483003!important}",
    "#mg-solve-tray{",
    "  top:calc(var(--mg-row1-top,4px) + 30px)!important}",
    "#mg-bloch-orb,#mg-rubik-orb{",
    "  top:auto!important;",
    "  bottom:calc(200px + var(--mg-kb-h,0px))!important}",

    /* laptop */
    "@media (max-width:1100px){",
    "  #mg-solve-hud .sum{max-width:12vw;overflow:hidden;text-overflow:ellipsis}",
    "  #mg-solve-hud{max-width:min(28vw,200px)!important}",
    "  #mg-sitrep-chip{max-width:min(62vw,380px)!important;font-size:8px!important}",
    "  #mg-dragon{max-width:min(260px,38vw)!important}",
    "  #mg-build-stamp{max-width:min(24vw,180px)!important}",
    "}",
    "@media (max-width:820px){",
    "  html{",
    "    --mg-row1-top:2px!important;",
    "    --mg-row2-top:28px!important;",
    "    --mg-row3-top:54px!important;",
    "    --mg-page-pad-top:92px!important;",
    "    --mg-chrome-below:90px!important}",
    "  #mg-solve-hud .sum{display:none!important}",
    "  #mg-solve-hud{max-width:72px!important}",
    "  #mg-sitrep-chip{max-width:min(78vw,300px)!important}",
    "  #mg-activity-board.collapsed .body,",
    "  #mg-activity-board.collapsed .tbl{display:none!important}",
    "}",

    /* shell words — readable on light + dark (glass bar + dual shadow) */
    ".mg-shell-word,html .mg-shell-word,",
    "#mg-top-right button,#mg-mode-trigger,#mg-dev-toggle,",
    "#mg-dragon #mg-tab .tab-lbl{",
    "  font:600 var(--mg-hdr-fs)/1 system-ui,sans-serif!important;",
    "  letter-spacing:var(--mg-hdr-ls)!important;text-transform:uppercase!important;",
    "  color:rgba(255,255,255,0.94)!important;background:transparent!important;",
    "  border:none!important;box-shadow:none!important;border-radius:0!important;",
    "  text-shadow:0 1px 2px rgba(0,0,0,0.65),0 0 10px rgba(0,0,0,0.35)!important}",
    /* drawers */
    "#mg-tools-drawer,#mg-right-drawer{",
    "  background:rgba(14,16,22,var(--mg-drop-a,var(--mg-fill-a,0.38)))!important;",
    "  backdrop-filter:blur(40px) saturate(1.55)!important;",
    "  -webkit-backdrop-filter:blur(40px) saturate(1.55)!important;",
    "  border-color:var(--mg-glass-line)!important;",
    "  color:var(--mg-glass-text)!important;",
    "  transition:transform var(--mg-dur) var(--mg-ease)!important}",
    "#mg-right-drawer{--mg-drop-a:var(--mg-fill-a,0.4)}",
    "#mg-tools-drawer button.act,#mg-right-drawer button.act,",
    "#mg-glass-cap-body button.act{",
    "  border-radius:16px!important;",
    "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.14)!important}",
    "html.mg-presentable #mg-glass-cap,",
    "html.mg-presentable #mg-mkt-rail:not(.mg-mkt-embedded),",
    "html.mg-presentable #mg-sx-rail,",
    "html.mg-presentable #mg-bloch-orb,",
    "html.mg-presentable #mg-rubik-orb{",
    "  display:none!important;pointer-events:none!important}",
  ].join("");
  (document.head || document.documentElement).appendChild(st);

  function ensureRow3Glass() {
    try {
      var g = document.getElementById("mg-row3-glass");
      if (!g) {
        g = document.createElement("div");
        g.id = "mg-row3-glass";
        g.setAttribute("aria-hidden", "true");
        (document.documentElement || document.body).appendChild(g);
      }
      var r3 =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--mg-row3-top")
          .trim() || "64px";
      var h =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--mg-row3-glass-h")
          .trim() || "32px";
      g.style.setProperty("top", r3, "important");
      g.style.setProperty("height", h, "important");
    } catch (e) {}
  }

  /* Keep pinShellControls from main inject from forcing row1 for controls */
  function pinThreeRow() {
    try {
      var r1 = "4px";
      var r3 =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--mg-row3-top")
          .trim() || "64px";
      var pad =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--mg-page-pad-top")
          .trim() || "104px";
      document.documentElement.style.setProperty("--mg-shell-top", r1);
      document.documentElement.style.setProperty("--mg-page-pad-top", pad);
      if (document.body) {
        document.body.style.setProperty("padding-top", pad, "important");
      }
      ensureRow3Glass();
      var lights = document.getElementById("mg-stoplights");
      var shell = document.getElementById("mg-dragon");
      var topRight = document.getElementById("mg-top-right");
      if (lights) {
        lights.style.setProperty("top", r3, "important");
        lights.style.setProperty("z-index", "2147483646", "important");
        lights.style.setProperty("pointer-events", "auto", "important");
      }
      if (shell) {
        shell.style.setProperty("top", r3, "important");
        shell.style.setProperty("z-index", "2147483645", "important");
        shell.style.setProperty("pointer-events", "auto", "important");
      }
      if (topRight) {
        topRight.style.setProperty("top", r3, "important");
        var rightOpen = false;
        var leftOpen = false;
        try {
          rightOpen = document.documentElement.classList.contains("mg-right-open");
          leftOpen = document.documentElement.classList.contains("mg-left-open");
        } catch (eD) {}
        if (rightOpen) {
          var rw = "360px";
          try {
            var dr = document.getElementById("mg-right-drawer");
            if (dr) {
              var w = getComputedStyle(dr).width;
              if (w && parseFloat(w) > 80) rw = w;
            }
          } catch (eW) {}
          topRight.style.setProperty("right", "calc(" + rw + " + 16px)", "important");
          topRight.style.setProperty("z-index", "2147483601", "important");
          topRight.style.setProperty("pointer-events", "auto", "important");
          try {
            document.documentElement.style.setProperty("--mg-right-w", rw);
          } catch (eV) {}
        } else {
          topRight.style.setProperty("right", "max(10px, env(safe-area-inset-right,0px))", "important");
          topRight.style.setProperty("z-index", "2147483640", "important");
          topRight.style.setProperty("pointer-events", "auto", "important");
        }
        if (leftOpen || rightOpen) {
          try {
            var root = document.getElementById("mg-root");
            if (root) root.style.setProperty("z-index", "2147483600", "important");
          } catch (eR) {}
        } else {
          try {
            var root2 = document.getElementById("mg-root");
            if (root2) root2.style.removeProperty("z-index");
          } catch (eR2) {}
        }
      }
      var stamp = document.getElementById("mg-build-stamp");
      if (stamp) stamp.style.setProperty("top", r1, "important");
    } catch (e) {}
  }
  pinThreeRow();
  setTimeout(pinThreeRow, 100);
  setTimeout(pinThreeRow, 600);
  setTimeout(pinThreeRow, 1500);
  window.addEventListener("resize", function () {
    pinThreeRow();
  });

  try {
    document.documentElement.classList.add("mg-presentable");
    document.documentElement.classList.add("mg-drawer-mode");
    document.documentElement.classList.add("mg-dual-drawer");
    document.documentElement.classList.add("mg-three-row");
    document.documentElement.classList.add("mg-row3-glass");
  } catch (e) {}

  window.__mgChromeTokens = {
    ver: VER,
    pin: pinThreeRow,
    ensureGlass: ensureRow3Glass,
    apply: function () {
      try {
        document.documentElement.classList.add("mg-presentable");
        document.documentElement.classList.add("mg-three-row");
        document.documentElement.classList.add("mg-row3-glass");
        pinThreeRow();
      } catch (e) {}
    },
    report: function () {
      return VER + " · 3-row + row3 glass underlay · pad reserved";
    },
  };

  try {
    if (window.__mgDevLog)
      window.__mgDevLog("ok", VER + " · row3 glass bar", "chrome");
  } catch (eL) {}
})();
