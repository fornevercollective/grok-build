/* Memory Glass · race-shell v4 — max-speed WebGrid + headless/game-dev styling
 *
 * v1: black void bug
 * v2: light page + metrics HUD
 * v3: GPU meters bar
 * v4: speed-stack ladder · gamedev HUD · headless disclosure (never pure void)
 *
 * Modes (URL or localStorage):
 *   mg_race=1          — agent race (default hyper pace)
 *   mg_gamedev=1       — dark game-dev chrome (canvas still visible)
 *   mg_headless=1      — minimal disclosure HUD (metrics float = consent)
 *   mg_pace=hyper      — sleep_ms floor 1 (never 0 — starves WK paint)
 *
 * Stack concept (offline instruments ≠ WebGrid 60Hz paint ceiling):
 *   zig · bun · uv · ruff · tokio · satori · wasm · repel · tauri
 *   → L0 offline bench / side services only
 *   WebGrid BPS is the WK paint-timing instrument (ceiling ~588 BPS / 60 Hz)
 */
(function () {
  "use strict";
  var VER = "race-shell-v4-speed-stack";
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

  var gamedev = qFlag("mg_gamedev") || ls("mg.webgrid.gamedev") === "1";
  var headless = qFlag("mg_headless") || ls("mg.webgrid.headless") === "1";
  if (qFlag("mg_gamedev")) ls("mg.webgrid.gamedev", "1");
  if (qFlag("mg_headless")) ls("mg.webgrid.headless", "1");
  /* headless implies gamedev chrome (dark instrument), not black void */
  if (headless) gamedev = true;

  try {
    ls("mg.webgrid.race", "1");
    ls("mg.webgrid.lab_full", "0");
    ls("mg.webgrid.pace_profile", "hyper");
  } catch (e0) {}

  window.__mgGameDev = gamedev ? 1 : 0;
  window.__mgHeadlessRace = headless ? 1 : 0;

  var STACK =
    "zig · bun · uv · ruff · tokio · satori · wasm · repel · tauri";

  function injectCss() {
    var old = document.getElementById("mg-race-shell-css");
    if (old) old.remove();
    var s = document.createElement("style");
    s.id = "mg-race-shell-css";
    var pageBg = gamedev ? "#0b0f14" : "#f4f4f5";
    var pageFg = gamedev ? "#e8eef5" : "#111";
    var hudBg = gamedev
      ? "rgba(8,12,18,0.92)"
      : "rgba(15,17,21,0.88)";
    var accent = gamedev ? "#5eead4" : "#6ee7a8";
    s.textContent = [
      "html.mg-race-shell,html.mg-race-shell body{",
      "  margin:0!important;padding:0!important;",
      "  background:" + pageBg + "!important;overflow:auto!important;}",
      "html.mg-race-shell body{",
      "  min-height:100vh!important;color:" + pageFg + "!important;}",
      /* Lab chrome off — keep board + race HUD */
      "html.mg-race-shell #mg-tools-drawer,html.mg-race-shell #mg-tools-scrim,",
      "html.mg-race-shell #mg-right-drawer,html.mg-race-shell #mg-right-scrim,",
      "html.mg-race-shell #mg-scrim,html.mg-race-shell #mg-search-dock,",
      "html.mg-race-shell #mg-dragon,html.mg-race-shell #mg-rec-chip,",
      "html.mg-race-shell #mg-mem-maze,html.mg-race-shell #mg-contrail-ov,",
      "html.mg-race-shell #mg-kb-beats,html.mg-race-shell #mg-sports-field,",
      "html.mg-race-shell #mg-float-kb,html.mg-race-shell #mg-sx-rail,",
      "html.mg-race-shell .mg-edge,html.mg-race-shell #mg-bottom-chrome,",
      "html.mg-race-shell #mg-lab-strip,html.mg-race-shell #mg-tools-mode-rail,",
      "html.mg-race-shell #mg-geo-float,html.mg-race-shell #mg-raider-stage,",
      "html.mg-race-shell #mg-bloch-float,html.mg-race-shell #mg-rubik-float{",
      "  display:none!important;pointer-events:none!important;}",
      /* LIVE RANK / board MUST stay findable unless hard headless */
      "html.mg-race-shell #mg-activity-board,html.mg-race-shell #mg-board-chip,",
      "html.mg-race-shell #mg-board-pill,html.mg-race-shell #mg-race-hud,",
      "html.mg-race-shell #mg-speed-stack{",
      "  display:block!important;visibility:visible!important;",
      "  opacity:1!important;pointer-events:auto!important;",
      "  z-index:2147483647!important;}",
      /* Canvas ALWAYS visible — never black hole (headless still shows game) */
      "html.mg-race-shell canvas,html.mg-race-shell canvas._canvas_1wslk_27{",
      "  opacity:1!important;visibility:visible!important;",
      "  max-width:min(92vw,88vh)!important;",
      "  max-height:min(92vw,88vh)!important;",
      "  image-rendering:auto!important;",
      "  box-shadow:0 0 0 1px " +
        (gamedev ? "rgba(94,234,212,0.25)" : "rgba(0,0,0,0.08)") +
        ",0 12px 40px rgba(0,0,0,0.35)!important;}",
      "html.mg-race-shell #mg-sys{",
      "  position:fixed!important;top:36px!important;left:10px!important;",
      "  z-index:2147483646!important;display:flex!important;",
      "  visibility:visible!important;opacity:1!important;}",
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
      /* Speed stack strip — offline L0 instruments (not in click loop) */
      "#mg-speed-stack{",
      "  position:fixed!important;bottom:10px!important;left:10px!important;right:10px!important;",
      "  max-width:720px;padding:8px 12px;",
      "  background:" + hudBg + "!important;color:#dbe4ee!important;",
      "  border:1px solid rgba(255,255,255,0.12);border-radius:10px;",
      "  font:500 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;",
      "  z-index:2147483646!important;pointer-events:none!important;}",
      "#mg-speed-stack b{color:" + accent + ";font-weight:700;}",
      "#mg-speed-stack .dim{opacity:.55;}",
      /* headless: collapse activity board to pill only, keep HUD */
      "html.mg-race-headless #mg-activity-board{",
      "  transform:scale(0.85);transform-origin:top left;opacity:0.92!important;}",
    ].join("");
    (document.head || document.documentElement).appendChild(s);
  }

  function ensureHud() {
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
    var el = document.getElementById("mg-speed-stack");
    if (!el) {
      el = document.createElement("div");
      el.id = "mg-speed-stack";
      (document.body || document.documentElement).appendChild(el);
    }
    el.innerHTML =
      "<b>SPEED STACK</b> <span class='dim'>(offline L0 · not in click loop)</span><br>" +
      STACK +
      "<br><span class='dim'>WebGrid = WK paint timing · kbatch-live/rust = keyboard GEO · one hot path</span>";
    return el;
  }

  function scrapeLite() {
    try {
      var body = ((document.body && document.body.innerText) || "").replace(/\s+/g, " ");
      var m = body.match(
        /(\d{1,2}:\d{2})\s+([\d.]+)\s*BPS\s+(-?[\d.]+)\s*NTPM\s*[·•.]\s*(\d+)\s*[×x]\s*(\d+)/i
      );
      var peak = body.match(/Your peak score:\s*([\d.]+)\s*BPS\s*\((-?[\d.]+)\s*NTPM\)/i);
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
          if (last.clicks != null) o.clicks = last.clicks;
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
    ensureHud();
    ensureStack();
    var o = scrapeLite();
    var set = function (id, v) {
      var n = document.getElementById(id);
      if (n) n.textContent = v;
    };
    var title = "RACE · LIVE";
    if (headless) title = "HEADLESS · DISCLOSE";
    else if (gamedev) title = "GAMEDEV · RACE";
    set("mg-race-hud-title", title);
    set(
      "mg-race-hud-bps",
      o.bps != null && isFinite(o.bps) ? o.bps.toFixed(2) + " BPS" : "— BPS"
    );
    set("mg-race-hud-ntpm", o.ntpm != null ? String(Math.round(o.ntpm)) : "—");
    set("mg-race-hud-timer", o.timer || "—");
    set("mg-race-hud-grid", o.grid || "30×30");
    set(
      "mg-race-hud-peak",
      o.peakBps != null ? o.peakBps.toFixed(1) + " / " + Math.round(o.peakNtpm || 0) : "—"
    );
    var pace = o.pace || "hyper";
    if (o.sleep_ms != null) pace += " · " + o.sleep_ms + "ms";
    set("mg-race-hud-pace", pace);
    set(
      "mg-race-hud-style",
      headless ? "headless+gamedev" : gamedev ? "gamedev" : "race"
    );
    var ceil = "paint ceiling ~588 BPS · 60 Hz · sleep≥1ms (0 starves paint)";
    if (o.bps != null && o.bps >= 580) ceil = "AT CEILING · ~1 hit/frame · don't thrash sleep";
    set("mg-race-hud-ceil", ceil);
  }

  function unhideBoard() {
    if (headless) {
      /* keep pill; don't force full board open */
      ["mg-board-chip", "mg-board-pill"].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        try {
          el.style.removeProperty("display");
          el.style.setProperty("z-index", "2147483647", "important");
        } catch (e) {}
      });
      return;
    }
    ["mg-activity-board", "mg-board-chip", "mg-board-pill"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      try {
        el.style.removeProperty("display");
        el.style.removeProperty("visibility");
        el.style.removeProperty("opacity");
        el.style.setProperty("z-index", "2147483647", "important");
        el.classList.remove("hidden");
      } catch (e) {}
    });
    try {
      if (window.__mgActivityBoard) {
        if (window.__mgActivityBoard.mergeFleetSeed)
          window.__mgActivityBoard.mergeFleetSeed();
        if (window.__mgActivityBoard.open)
          window.__mgActivityBoard.open({ collapsed: true });
      }
    } catch (eB) {}
  }

  function arm() {
    try {
      document.documentElement.classList.add("mg-race-shell", "mg-webgrid-play");
      document.documentElement.classList.remove("mg-product");
      if (gamedev) document.documentElement.classList.add("mg-race-gamedev");
      if (headless) document.documentElement.classList.add("mg-race-headless");
    } catch (e) {}
    injectCss();
    ensureHud();
    ensureStack();
    unhideBoard();
    [
      "mg-tools-drawer",
      "mg-right-drawer",
      "mg-mem-maze",
      "mg-contrail-ov",
      "mg-search-dock",
      "mg-dragon",
      "mg-kb-beats",
      "mg-sports-field",
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      try {
        el.style.setProperty("display", "none", "important");
        el.style.setProperty("pointer-events", "none", "important");
      } catch (eH) {}
    });
  }

  arm();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arm, { once: true });
  }
  setTimeout(arm, 200);
  setTimeout(arm, 900);
  setTimeout(unhideBoard, 1200);
  setInterval(tickHud, 400);
  setInterval(unhideBoard, 2500);

  try {
    if (window.__mgDevLog)
      window.__mgDevLog(
        "ok",
        VER +
          " · gamedev=" +
          (gamedev ? 1 : 0) +
          " headless=" +
          (headless ? 1 : 0),
        "race"
      );
    console.log(
      "[mg]",
      VER,
      "gamedev=" + gamedev,
      "headless=" + headless,
      "stack=",
      STACK
    );
  } catch (eL) {}
})();
