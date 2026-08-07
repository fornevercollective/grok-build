/* Memory Glass · race-shell v6 — flat surface · no layer soup
 *
 * v1–v4: race HUD / speed stack / gamedev chrome
 * v5: pure kill lists (still injected HUD under offline arena)
 * v6: OFFLINE LAB PAGES own the UI — strip race HUD + speed stack + GPU bar
 *     so lite-arena / webgrid-ugrad are one flat plane (no floating layers under)
 *
 * Modes:
 *   mg_race=1      Neuralink WebGrid agent race → race HUD ok
 *   mg_gamedev=1   dark chrome
 *   mg_pure=1      no board thrash
 *   offline lab    lite-arena · webgrid-ugrad · cube-viewer → ZERO inject floats
 */
(function () {
  "use strict";
  var VER = "race-shell-v6-flat";
  try {
    if (document.getElementById("pip-wrap") || document.getElementById("insp-root")) return;
  } catch (ePip) {}
  if (window.__mgRaceShellVer === VER) return;
  window.__mgRaceShellVer = VER;
  window.__mgWebgridRace = true;
  window.__mgRaceShell = 1;
  window.__mgForcePlayFloats = false;

  function qFlag(name) {
    try {
      return new RegExp("[?&]" + name + "=1\\b", "i").test(location.search || "");
    } catch (e) {
      return false;
    }
  }
  function ls(key, val) {
    try {
      if (val != null) localStorage.setItem(key, val);
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  /* Offline lab owns presentation — do NOT stack race HUD / speed stack */
  function isOfflineLabPage() {
    try {
      var h = (location.hostname || "").toLowerCase();
      var p = (location.pathname || "").toLowerCase();
      var local =
        h === "127.0.0.1" ||
        h === "localhost" ||
        h === "" ||
        h === "0.0.0.0";
      if (!local && !/^192\.168\./.test(h) && !/^10\./.test(h)) {
        /* still allow file:// */
        if (location.protocol !== "file:") return false;
      }
      if (/lite-arena|webgrid-ugrad|cube-viewer|ugrad-r0|persona-tensor/.test(p))
        return true;
      if (/lite-arena|webgrid-ugrad|cube-viewer/.test(location.href || "")) return true;
      /* page self-identifies */
      if (window.LiteArena || window.WebgridUgrad) return true;
      if (document.body && document.body.classList.contains("gamedev")) return true;
      if (document.getElementById("wg-canvas") && document.getElementById("clk-a"))
        return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function isNeuralinkWebgrid() {
    try {
      return (
        /neuralink\.com$/i.test(location.hostname) &&
        /webgrid/i.test(location.pathname)
      );
    } catch (e) {
      return false;
    }
  }

  var offlineLab = isOfflineLabPage();
  var gamedev =
    qFlag("mg_gamedev") ||
    ls("mg.webgrid.gamedev") === "1" ||
    window.__mgGameDev === 1 ||
    offlineLab;
  var headless = qFlag("mg_headless") || ls("mg.webgrid.headless") === "1";
  var pure =
    qFlag("mg_pure") ||
    ls("mg.webgrid.pure") === "1" ||
    gamedev ||
    headless ||
    offlineLab;
  /* Show race HUD only on Neuralink WebGrid (or explicit mg_race on non-lab) */
  var showRaceHud =
    isNeuralinkWebgrid() ||
    (qFlag("mg_race") && !offlineLab) ||
    (ls("mg.webgrid.force_hud") === "1" && !offlineLab);

  if (qFlag("mg_gamedev") || offlineLab) ls("mg.webgrid.gamedev", "1");
  if (qFlag("mg_headless")) ls("mg.webgrid.headless", "1");
  if (pure) ls("mg.webgrid.pure", "1");
  if (headless) gamedev = true;

  try {
    ls("mg.webgrid.race", showRaceHud ? "1" : "0");
    ls("mg.webgrid.lab_full", "0");
    ls("mg.webgrid.pace_profile", "hyper");
    ls("mg.webgrid.autoplay", "0");
    ls("mg.webgrid.play_once", "0");
  } catch (e0) {}

  window.__mgGameDev = gamedev ? 1 : 0;
  window.__mgHeadlessRace = headless ? 1 : 0;
  window.__mgPureGamedev = pure ? 1 : 0;
  window.__mgOfflineLab = offlineLab ? 1 : 0;
  window.__mgLabFull = 0;
  window.__mgShowRaceHud = showRaceHud ? 1 : 0;

  var STACK =
    "zig · bun · uv · ruff · tokio · satori · wasm · repel · tauri";

  var FLOAT_KILL = [
    "mg-tools-drawer",
    "mg-tools-scrim",
    "mg-right-drawer",
    "mg-right-scrim",
    "mg-scrim",
    "mg-search-dock",
    "mg-dragon",
    "mg-rec-chip",
    "mg-mem-maze",
    "mg-contrail-ov",
    "mg-kb-beats",
    "mg-sports-field",
    "mg-float-kb",
    "mg-sx-rail",
    "mg-bottom-chrome",
    "mg-lab-strip",
    "mg-tools-mode-rail",
    "mg-geo-float",
    "mg-raider-stage",
    "mg-bloch-float",
    "mg-rubik-float",
    "mg-menu-health-pill",
    "mg-menu-health",
    "mg-cal-hud",
    "mg-jump-stack",
    "mg-grok-term",
    "mg-agent-desk",
    "mg-qbit-term",
    "mg-site-annotate",
    "mg-data-bench",
    "mg-deploy-bar",
    "mg-kbatch-float",
    "mg-staff-lab",
    "mg-mkt-rail",
    "mg-lark-rail",
    "mg-live-collab",
    "mg-activity-board",
    "mg-board-chip",
    "mg-board-pill",
    "mg-sys",
    "mg-float-bar",
    "mg-window-bar",
  ];

  /* Always kill inject floats on offline lab; also kill race chrome there */
  if (offlineLab || pure) {
    FLOAT_KILL = FLOAT_KILL.concat([
      "mg-race-hud",
      "mg-speed-stack",
      "mg-race-shell-css",
    ]);
  }

  function nukeEl(el) {
    if (!el) return;
    try {
      el.style.setProperty("display", "none", "important");
      el.style.setProperty("pointer-events", "none", "important");
      el.style.setProperty("visibility", "hidden", "important");
      el.style.setProperty("opacity", "0", "important");
      el.setAttribute("aria-hidden", "true");
      /* remove from layout entirely when offline lab */
      if (offlineLab || !showRaceHud) {
        try {
          el.remove();
        } catch (eR) {}
      }
    } catch (e) {}
  }

  function killChrome() {
    FLOAT_KILL.forEach(function (id) {
      nukeEl(document.getElementById(id));
    });
    /* class-based lab floats */
    try {
      document.querySelectorAll(".mg-lab-float,.mg-edge,#mg-sys").forEach(nukeEl);
    } catch (eQ) {}
    if (offlineLab || !showRaceHud) {
      nukeEl(document.getElementById("mg-race-hud"));
      nukeEl(document.getElementById("mg-speed-stack"));
      nukeEl(document.getElementById("mg-sys"));
    }
  }

  function injectCss() {
    var old = document.getElementById("mg-race-shell-css");
    if (old) old.remove();
    var s = document.createElement("style");
    s.id = "mg-race-shell-css";
    var pageBg = offlineLab ? "transparent" : gamedev ? "#0b0f14" : "#f4f4f5";
    var pageFg = gamedev || offlineLab ? "#e8eef5" : "#111";
    var hudBg = gamedev
      ? "rgba(8,12,18,0.92)"
      : "rgba(15,17,21,0.88)";
    var accent = gamedev || offlineLab ? "#5eead4" : "#6ee7a8";

    var killSel = FLOAT_KILL.map(function (id) {
      return "html.mg-race-shell #" + id;
    }).join(",");

    var rules = [
      "html.mg-race-shell,html.mg-race-shell body{",
      "  margin:0!important;padding:0!important;",
      offlineLab
        ? "  background:transparent!important;overflow:auto!important;"
        : "  background:" + pageBg + "!important;overflow:auto!important;",
      "}",
      "html.mg-race-shell body{min-height:100vh!important;color:" + pageFg + "!important;}",
      /* flatten glass droplet / mask layers under content */
      "html.mg-race-shell body,html.mg-race-flat body{",
      "  -webkit-mask-image:none!important;mask-image:none!important;",
      "  clip-path:none!important;border-radius:0!important;",
      "}",
      "html.mg-race-shell html,html.mg-race-flat{",
      "  -webkit-mask-image:none!important;mask-image:none!important;",
      "  clip-path:none!important;",
      "}",
      killSel +
        ",html.mg-race-shell .mg-lab-float,html.mg-race-shell .mg-edge{",
      "  display:none!important;pointer-events:none!important;",
      "  visibility:hidden!important;opacity:0!important;}",
    ];

    if (offlineLab || !showRaceHud) {
      rules.push(
        "html.mg-race-shell #mg-race-hud,html.mg-race-shell #mg-speed-stack,",
        "html.mg-race-shell #mg-sys,html.mg-race-flat #mg-race-hud,",
        "html.mg-race-flat #mg-speed-stack,html.mg-race-flat #mg-sys{",
        "  display:none!important;pointer-events:none!important;",
        "  visibility:hidden!important;opacity:0!important;}"
      );
    } else {
      /* Neuralink race: keep canvas + race HUD only */
      rules.push(
        "html.mg-race-shell canvas,html.mg-race-shell canvas._canvas_1wslk_27{",
        "  opacity:1!important;visibility:visible!important;",
        "  max-width:min(92vw,88vh)!important;",
        "  max-height:min(92vw,88vh)!important;",
        "  box-shadow:0 0 0 1px " +
          (gamedev ? "rgba(94,234,212,0.25)" : "rgba(0,0,0,0.08)") +
          ",0 12px 40px rgba(0,0,0,0.35)!important;}",
        "#mg-race-hud{",
        "  position:fixed!important;top:40px!important;right:12px!important;",
        "  min-width:176px;max-width:260px;padding:10px 12px;",
        "  background:" + hudBg + "!important;color:#f5f5f7!important;",
        "  border:1px solid " +
          (gamedev ? "rgba(94,234,212,0.28)" : "rgba(255,255,255,0.18)") +
          ";border-radius:12px;",
        "  font:600 12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;",
        "  box-shadow:0 8px 28px rgba(0,0,0,0.45);backdrop-filter:blur(10px);",
        "  z-index:2147483647!important;pointer-events:auto!important;}",
        "#mg-race-hud .t{font-size:10px;letter-spacing:.1em;opacity:.7;margin-bottom:4px;text-transform:uppercase;}",
        "#mg-race-hud .bps{font-size:22px;font-weight:700;letter-spacing:-.03em;color:" +
          accent +
          ";}",
        "#mg-race-hud .row{display:flex;justify-content:space-between;gap:8px;margin-top:3px;opacity:.92;}",
        "#mg-race-hud .mut{opacity:.55;font-weight:500;}",
        "#mg-race-hud .ceil{margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);",
        "  font-size:10px;opacity:.7;line-height:1.35;}",
        "#mg-speed-stack{",
        "  position:fixed!important;bottom:10px!important;left:10px!important;right:10px!important;",
        "  max-width:720px;padding:8px 12px;",
        "  background:" + hudBg + "!important;color:#dbe4ee!important;",
        "  border:1px solid rgba(255,255,255,0.12);border-radius:10px;",
        "  font:500 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;",
        "  z-index:2147483646!important;pointer-events:none!important;}",
        "#mg-speed-stack b{color:" + accent + ";font-weight:700;}",
        "#mg-speed-stack .dim{opacity:.55;}"
      );
    }

    s.textContent = rules.join("");
    (document.head || document.documentElement).appendChild(s);
  }

  function ensureHud() {
    if (!showRaceHud || offlineLab) return null;
    var el = document.getElementById("mg-race-hud");
    if (!el) {
      el = document.createElement("div");
      el.id = "mg-race-hud";
      el.innerHTML =
        '<div class="t" id="mg-race-hud-title">RACE · LIVE</div>' +
        '<div class="bps" id="mg-race-hud-bps">— BPS</div>' +
        '<div class="row"><span class="mut">NTPM</span><span id="mg-race-hud-ntpm">—</span></div>' +
        '<div class="row"><span class="mut">timer</span><span id="mg-race-hud-timer">—</span></div>' +
        '<div class="row"><span class="mut">grid</span><span id="mg-race-hud-grid">—</span></div>' +
        '<div class="row"><span class="mut">peak</span><span id="mg-race-hud-peak">—</span></div>' +
        '<div class="row"><span class="mut">pace</span><span id="mg-race-hud-pace">hyper</span></div>' +
        '<div class="row"><span class="mut">style</span><span id="mg-race-hud-style">race</span></div>' +
        '<div class="ceil" id="mg-race-hud-ceil">paint ceiling ~588 BPS · 60 Hz · sleep≥1ms</div>';
      (document.body || document.documentElement).appendChild(el);
    }
    return el;
  }

  function ensureStack() {
    if (!showRaceHud || offlineLab) return null;
    var el = document.getElementById("mg-speed-stack");
    if (!el) {
      el = document.createElement("div");
      el.id = "mg-speed-stack";
      (document.body || document.documentElement).appendChild(el);
    }
    el.innerHTML =
      "<b>SPEED STACK</b> <span class='dim'>(offline L0 · not in click loop)</span><br>" +
      STACK +
      "<br><span class='dim'>WebGrid = WK paint timing · one hot path</span>";
    return el;
  }

  function scrapeLite() {
    try {
      var body = ((document.body && document.body.innerText) || "").replace(/\s+/g, " ");
      var m = body.match(
        /(\d{1,2}:\d{2})\s+([\d.]+)\s*BPS\s+(-?[\d.]+)\s*NTPM\s*[·•.]\s*(\d+)\s*[×x]\s*(\d+)/i
      );
      var peak = body.match(
        /Your peak score:\s*([\d.]+)\s*BPS\s*\((-?[\d.]+)\s*NTPM\)/i
      );
      var o = {
        timer: m ? m[1] : null,
        bps: m ? parseFloat(m[2]) : null,
        ntpm: m ? parseFloat(m[3]) : null,
        grid: m ? m[4] + "×" + m[5] : null,
        peakBps: peak ? parseFloat(peak[1]) : null,
        peakNtpm: peak ? parseFloat(peak[2]) : null,
      };
      try {
        var last = window.__mgAgentPlayLast;
        if (last && last.kind === "agent_tick") {
          if (last.bps != null) o.bps = last.bps;
          if (last.ntpm != null) o.ntpm = last.ntpm;
          if (last.timer) o.timer = last.timer;
          if (last.pace) o.pace = last.pace;
          if (last.sleep_ms != null) o.sleep_ms = last.sleep_ms;
        }
        if (last && last.peak && last.peak.bps) {
          o.peakBps = last.peak.bps;
          o.peakNtpm = last.peak.ntpm;
        }
      } catch (eL) {}
      return o;
    } catch (e) {
      return {};
    }
  }

  function tickHud() {
    if (!showRaceHud || offlineLab) {
      killChrome();
      return;
    }
    ensureHud();
    ensureStack();
    var o = scrapeLite();
    var set = function (id, v) {
      var n = document.getElementById(id);
      if (n) n.textContent = v;
    };
    set("mg-race-hud-title", gamedev ? "GAMEDEV · RACE" : "RACE · LIVE");
    set(
      "mg-race-hud-bps",
      o.bps != null && isFinite(o.bps) ? o.bps.toFixed(2) + " BPS" : "— BPS"
    );
    set("mg-race-hud-ntpm", o.ntpm != null ? String(Math.round(o.ntpm)) : "—");
    set("mg-race-hud-timer", o.timer || "—");
    set("mg-race-hud-grid", o.grid || "30×30");
    set(
      "mg-race-hud-peak",
      o.peakBps != null
        ? o.peakBps.toFixed(1) + " / " + Math.round(o.peakNtpm || 0)
        : "—"
    );
    var pace = o.pace || "hyper";
    if (o.sleep_ms != null) pace += " · " + o.sleep_ms + "ms";
    set("mg-race-hud-pace", pace);
    set("mg-race-hud-style", gamedev ? "gamedev" : "race");
    set(
      "mg-race-hud-ceil",
      o.bps != null && o.bps >= 580
        ? "AT CEILING · ~1 hit/frame"
        : "paint ceiling ~588 BPS · 60 Hz · sleep≥1ms"
    );
  }

  function flattenGlass() {
    try {
      var de = document.documentElement;
      var b = document.body;
      [de, b].forEach(function (n) {
        if (!n || !n.style) return;
        n.style.setProperty("-webkit-mask-image", "none", "important");
        n.style.setProperty("mask-image", "none", "important");
        n.style.setProperty("clip-path", "none", "important");
        if (offlineLab) {
          n.style.setProperty("border-radius", "0", "important");
          n.style.setProperty("background", offlineLab ? "" : n.style.background);
        }
      });
      if (b && offlineLab) {
        /* let page CSS own background — clear MG shell paint */
        b.style.removeProperty("background");
        b.style.removeProperty("background-color");
      }
    } catch (e) {}
  }

  function arm() {
    try {
      document.documentElement.classList.add("mg-race-shell");
      document.documentElement.classList.remove("mg-product");
      if (offlineLab) {
        document.documentElement.classList.add("mg-race-flat", "mg-race-pure");
        document.documentElement.classList.remove("mg-webgrid-play");
      } else {
        document.documentElement.classList.add("mg-webgrid-play");
        if (gamedev) document.documentElement.classList.add("mg-race-gamedev");
        if (headless) document.documentElement.classList.add("mg-race-headless");
        if (pure) document.documentElement.classList.add("mg-race-pure");
      }
    } catch (e) {}
    injectCss();
    flattenGlass();
    killChrome();
    if (showRaceHud && !offlineLab) {
      ensureHud();
      ensureStack();
    } else {
      /* remove any leftover inject nodes from prior shell */
      ["mg-race-hud", "mg-speed-stack", "mg-sys"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el)
          try {
            el.remove();
          } catch (e) {
            nukeEl(el);
          }
      });
    }
  }

  arm();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arm, { once: true });
  }
  setTimeout(arm, 120);
  setTimeout(arm, 400);
  setTimeout(arm, 1000);
  setInterval(function () {
    killChrome();
    flattenGlass();
    if (showRaceHud && !offlineLab) tickHud();
  }, offlineLab ? 1200 : 400);

  try {
    if (window.__mgDevLog)
      window.__mgDevLog(
        "ok",
        VER +
          " offlineLab=" +
          (offlineLab ? 1 : 0) +
          " hud=" +
          (showRaceHud ? 1 : 0),
        "race"
      );
    console.log(
      "[mg]",
      VER,
      "offlineLab=" + offlineLab,
      "showRaceHud=" + showRaceHud,
      "flat surface"
    );
  } catch (eL) {}
})();
