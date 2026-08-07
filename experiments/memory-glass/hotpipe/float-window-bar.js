/* Memory Glass · float window bar
 * Top app chrome strip: active float windows as chips + GPU/RAM meter (never buried).
 * VER: float-bar-v1
 */
(function () {
  "use strict";
  var VER = "float-bar-v1";
  if (window.__mgFloatBarVer === VER) return;
  window.__mgFloatBarVer = VER;

  var CATALOG = [
    { id: "mg-sys", label: "GPU", raise: true },
    { id: "mg-race-hud", label: "RACE", raise: true },
    { id: "mg-activity-board", label: "RANK", raise: true },
    { id: "mg-board-chip", label: "BOARD", raise: true },
    { id: "mg-tools-drawer", label: "TOOLS", raise: true },
    { id: "mg-right-drawer", label: "DATA", raise: true },
    { id: "mg-mem-maze", label: "MAZE", raise: true },
    { id: "mg-contrail-ov", label: "PATH", raise: true },
    { id: "mg-kb-beats", label: "BEATS", raise: true },
    { id: "mg-sports-field", label: "FIELD", raise: true },
    { id: "mg-float-kb", label: "KEYS", raise: true },
    { id: "mg-geo-float", label: "GEO", raise: true },
    { id: "mg-bloch-float", label: "BLOCH", raise: true },
    { id: "mg-rubik-float", label: "RUBIK", raise: true },
    { id: "mg-search-dock", label: "SEARCH", raise: true },
    { id: "mg-dragon", label: "MENU", raise: true },
    { id: "mg-solve-hud", label: "SOLVE", raise: true },
    { id: "mg-top-right", label: "TRACK", raise: true },
  ];

  function isOpen(el) {
    if (!el) return false;
    try {
      if (el.classList && el.classList.contains("hidden")) return false;
      if (el.style && el.style.display === "none") return false;
      var cs = window.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0")
        return false;
      var r = el.getBoundingClientRect();
      if (r.width < 2 && r.height < 2) return false;
      return true;
    } catch (e) {
      return !!el;
    }
  }

  function raise(el) {
    if (!el) return;
    try {
      el.classList.remove("hidden");
      el.style.removeProperty("display");
      el.style.removeProperty("visibility");
      el.style.removeProperty("opacity");
      el.style.setProperty("display", el.tagName === "BUTTON" ? "flex" : "block", "important");
      el.style.setProperty("visibility", "visible", "important");
      el.style.setProperty("opacity", "1", "important");
      el.style.setProperty("z-index", "2147483647", "important");
      el.style.setProperty("pointer-events", "auto", "important");
      /* pin GPU sys meters top-left if buried */
      if (el.id === "mg-sys") {
        el.style.setProperty("position", "fixed", "important");
        el.style.setProperty("top", "36px", "important");
        el.style.setProperty("left", "10px", "important");
        el.style.setProperty("right", "auto", "important");
        el.style.setProperty("bottom", "auto", "important");
        el.style.setProperty("width", "min(220px,42vw)", "important");
        el.style.setProperty("background", "rgba(8,10,14,0.9)", "important");
        el.style.setProperty("border", "1px solid rgba(255,255,255,0.14)", "important");
        el.style.setProperty("border-radius", "10px", "important");
        el.style.setProperty("padding", "8px 10px", "important");
      }
      try {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
      } catch (eS) {}
    } catch (e) {}
  }

  function ensureCss() {
    if (document.getElementById("mg-float-bar-css")) return;
    var s = document.createElement("style");
    s.id = "mg-float-bar-css";
    s.textContent = [
      "#mg-float-bar{",
      "  position:fixed!important;top:0!important;left:0!important;right:0!important;",
      "  height:32px!important;z-index:2147483647!important;",
      "  display:flex!important;align-items:center!important;gap:6px!important;",
      "  padding:0 10px 0 78px!important;/* leave room for traffic lights */",
      "  background:linear-gradient(180deg,rgba(12,14,18,0.92),rgba(12,14,18,0.72))!important;",
      "  border-bottom:1px solid rgba(255,255,255,0.1)!important;",
      "  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);",
      "  font:600 10px/1 system-ui,-apple-system,sans-serif!important;",
      "  color:rgba(255,255,255,0.88)!important;pointer-events:auto!important;",
      "  box-sizing:border-box!important;overflow:hidden!important;}",
      "#mg-float-bar .fb-title{opacity:0.45;letter-spacing:0.12em;text-transform:uppercase;",
      "  font-size:9px;margin-right:4px;flex:0 0 auto;}",
      "#mg-float-bar .fb-chips{display:flex;align-items:center;gap:4px;flex:1 1 auto;",
      "  overflow-x:auto;overflow-y:hidden;scrollbar-width:none;}",
      "#mg-float-bar .fb-chips::-webkit-scrollbar{display:none}",
      "#mg-float-bar .fb-chip{",
      "  flex:0 0 auto;appearance:none;border:1px solid rgba(255,255,255,0.16);",
      "  background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.88);",
      "  border-radius:999px;padding:4px 9px;cursor:pointer;",
      "  font:650 9px/1 system-ui,sans-serif;letter-spacing:0.06em;}",
      "#mg-float-bar .fb-chip:hover{background:rgba(255,255,255,0.14);color:#fff}",
      "#mg-float-bar .fb-chip.on{border-color:rgba(110,231,168,0.55);",
      "  background:rgba(40,120,90,0.35);color:#b7f7d4}",
      "#mg-float-bar .fb-chip.ghost{opacity:0.35}",
      "#mg-float-bar .fb-meters{display:flex;align-items:center;gap:8px;flex:0 0 auto;",
      "  margin-left:auto;font:600 9px/1 ui-monospace,Menlo,monospace;}",
      "#mg-float-bar .fb-m{display:flex;align-items:center;gap:4px;opacity:0.9}",
      "#mg-float-bar .fb-m b{font-weight:700;min-width:28px;text-align:right}",
      "#mg-float-bar .fb-m.g b{color:#6ee7a8}",
      "#mg-float-bar .fb-m.warn b{color:#fbbf24}",
      "#mg-float-bar .fb-m.crit b{color:#f87171}",
      /* GPU dock — top left under bar, never under other layers */
      "html.mg-race-shell #mg-sys,html.mg-webgrid-play #mg-sys,#mg-sys.mg-sys-float{",
      "  position:fixed!important;top:36px!important;left:10px!important;",
      "  right:auto!important;bottom:auto!important;",
      "  z-index:2147483646!important;display:flex!important;",
      "  visibility:visible!important;opacity:1!important;",
      "  width:min(220px,42vw)!important;",
      "  background:rgba(8,10,14,0.9)!important;",
      "  border:1px solid rgba(255,255,255,0.14)!important;border-radius:10px!important;",
      "  padding:8px 10px!important;pointer-events:auto!important;}",
      "html.mg-race-shell body,html.mg-webgrid-play body{",
      "  padding-top:32px!important;}",
    ].join("");
    (document.head || document.documentElement).appendChild(s);
  }

  function ensureBar() {
    var bar = document.getElementById("mg-float-bar");
    if (bar) return bar;
    bar = document.createElement("div");
    bar.id = "mg-float-bar";
    bar.innerHTML =
      '<span class="fb-title">FLOATS</span>' +
      '<div class="fb-chips" id="mg-float-bar-chips"></div>' +
      '<div class="fb-meters">' +
      '<span class="fb-m g" id="mg-fb-gpu" title="GPU frame budget"><span>GPU</span><b>—</b></span>' +
      '<span class="fb-m" id="mg-fb-ram" title="JS heap"><span>RAM</span><b>—</b></span>' +
      '<span class="fb-m" id="mg-fb-fps" title="FPS"><span>FPS</span><b>—</b></span>' +
      "</div>";
    (document.documentElement || document.body).appendChild(bar);
    return bar;
  }

  function ensureSysFloat() {
    var el = document.getElementById("mg-sys");
    if (!el) {
      el = document.createElement("div");
      el.id = "mg-sys";
      el.className = "mg-sys-float";
      el.title = "Runtime meters";
      el.innerHTML =
        '<div class="sys-row" style="display:grid;grid-template-columns:40px 1fr 36px;gap:6px;align-items:center;margin:2px 0">' +
        '<span style="font:650 8px/1 system-ui;letter-spacing:.1em;color:rgba(160,200,255,.75)">GPU</span>' +
        '<div style="height:7px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden">' +
        '<div id="sys-gpu" style="height:100%;width:12%;background:linear-gradient(90deg,#50c88c,#78c8ff)"></div></div>' +
        '<span id="sys-gpu-p" style="font:600 9px ui-monospace;text-align:right;color:#c8dcff">—</span></div>' +
        '<div class="sys-row" style="display:grid;grid-template-columns:40px 1fr 36px;gap:6px;align-items:center;margin:2px 0">' +
        '<span style="font:650 8px/1 system-ui;letter-spacing:.1em;color:rgba(160,200,255,.75)">RAM</span>' +
        '<div style="height:7px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden">' +
        '<div id="sys-ram" style="height:100%;width:20%;background:linear-gradient(90deg,#50c88c,#78c8ff)"></div></div>' +
        '<span id="sys-ram-p" style="font:600 9px ui-monospace;text-align:right;color:#c8dcff">—</span></div>' +
        '<div class="sys-row" style="display:grid;grid-template-columns:40px 1fr 36px;gap:6px;align-items:center;margin:2px 0">' +
        '<span style="font:650 8px/1 system-ui;letter-spacing:.1em;color:rgba(160,200,255,.75)">FPS</span>' +
        '<div style="height:7px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden">' +
        '<div id="sys-fps" style="height:100%;width:50%;background:linear-gradient(90deg,#50c88c,#78c8ff)"></div></div>' +
        '<span id="sys-fps-p" style="font:600 9px ui-monospace;text-align:right;color:#c8dcff">—</span></div>' +
        '<div id="sys-sig" style="font:500 8px ui-monospace;color:rgba(255,255,255,.45);margin-top:4px">SYS · boot</div>';
      (document.body || document.documentElement).appendChild(el);
    }
    el.classList.add("mg-sys-float");
    raise(el);
    return el;
  }

  function setMeter(id, pct, pId) {
    var el = document.getElementById(id);
    var p = document.getElementById(pId);
    var v = Math.max(0, Math.min(100, pct | 0));
    if (el) el.style.width = v + "%";
    if (p) p.textContent = v + "%";
    return v;
  }

  var _frames = 0,
    _lastF = performance.now(),
    _fps = 30;

  function sampleSys() {
    _frames++;
    var now = performance.now();
    if (now - _lastF >= 500) {
      _fps = (_frames * 1000) / (now - _lastF);
      _frames = 0;
      _lastF = now;
    }
    var ram = 30;
    try {
      if (performance.memory && performance.memory.jsHeapSizeLimit) {
        ram = 100 * (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit);
      }
    } catch (e) {}
    var fpsBar = Math.min(100, (_fps / 60) * 100);
    var gpu = Math.min(99, Math.max(0, 100 - fpsBar) * 0.7 + 12);
    setMeter("sys-gpu", gpu, "sys-gpu-p");
    setMeter("sys-ram", ram, "sys-ram-p");
    setMeter("sys-fps", fpsBar, "sys-fps-p");
    var sig = document.getElementById("sys-sig");
    if (sig) {
      sig.textContent =
        "OK · fps " +
        _fps.toFixed(0) +
        (gpu >= 70 ? " · GPU_WARN" : "") +
        (ram >= 70 ? " · RAM_WARN" : "");
    }
    /* top bar meters */
    function chip(id, v, invertOk) {
      var n = document.getElementById(id);
      if (!n) return;
      var b = n.querySelector("b");
      if (b) b.textContent = Math.round(v) + (id.indexOf("fps") >= 0 ? "" : "%");
      n.classList.remove("g", "warn", "crit");
      var bad = invertOk ? v < 30 : v >= 88;
      var warn = invertOk ? v < 50 : v >= 70;
      if (bad) n.classList.add("crit");
      else if (warn) n.classList.add("warn");
      else n.classList.add("g");
    }
    chip("mg-fb-gpu", gpu, false);
    chip("mg-fb-ram", ram, false);
    chip("mg-fb-fps", _fps, true);
  }

  function refreshChips() {
    var host = document.getElementById("mg-float-bar-chips");
    if (!host) return;
    var active = [];
    var html = "";
    CATALOG.forEach(function (c) {
      var el = document.getElementById(c.id);
      var on = isOpen(el);
      if (on) active.push(c.label);
      html +=
        '<button type="button" class="fb-chip' +
        (on ? " on" : " ghost") +
        '" data-fid="' +
        c.id +
        '" title="' +
        (on ? "Focus " : "Show ") +
        c.label +
        '">' +
        c.label +
        "</button>";
    });
    host.innerHTML = html;
    host.querySelectorAll(".fb-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-fid");
        var el = document.getElementById(id);
        if (!el && id === "mg-sys") el = ensureSysFloat();
        raise(el);
        /* open APIs when available */
        try {
          if (id === "mg-activity-board" && window.__mgActivityBoard && window.__mgActivityBoard.open)
            window.__mgActivityBoard.open({ collapsed: false });
          if (id === "mg-tools-drawer" && window.__mgToolsDrawer && window.__mgToolsDrawer.open)
            window.__mgToolsDrawer.open();
          if (id === "mg-right-drawer" && window.__mgRightDrawer && window.__mgRightDrawer.open)
            window.__mgRightDrawer.open();
          if (id === "mg-mem-maze" && window.__mgMemoryMaze && window.__mgMemoryMaze.open)
            window.__mgMemoryMaze.open();
        } catch (eA) {}
        refreshChips();
      });
    });
    window.__mgActiveFloats = active;
  }

  function boot() {
    ensureCss();
    ensureBar();
    ensureSysFloat();
    refreshChips();
    sampleSys();
  }

  boot();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  }
  setInterval(function () {
    ensureBar();
    ensureSysFloat();
    sampleSys();
    refreshChips();
  }, 700);

  window.__mgFloatBar = {
    ver: VER,
    refresh: refreshChips,
    raise: function (id) {
      raise(document.getElementById(id) || (id === "mg-sys" ? ensureSysFloat() : null));
    },
    active: function () {
      return (window.__mgActiveFloats || []).slice();
    },
  };

  try {
    if (window.__mgDevLog) window.__mgDevLog("ok", VER + " · top float list + GPU", "float-bar");
  } catch (e) {}
})();
