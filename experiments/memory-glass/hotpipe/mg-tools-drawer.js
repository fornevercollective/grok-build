/* Memory Glass · LEFT TOOLS DRAWER
 * CTRL Control Center parity: mode tabs + collapsible sections + act tiles.
 * Tab docks to drawer wall and rides open/close.
 * VER: mg-tools-drawer-v4-ctrl-sections
 */
(function () {
  "use strict";
  var VER = "mg-tools-drawer-v16-edge-peeks";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._toolsDrawerVer === VER) return;
  HP._toolsDrawerVer = VER;

  /** Never mount under body — body gets page-axis transform and "fixed" sticks to scroll. */
  function chromeRoot() {
    return document.documentElement || document.body;
  }

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var open = false;
  var el = null;
  var tab = null; /* legacy single tab — replaced by mode rail */
  var modeRail = null;
  var body = null;
  var statusEl = null;
  var mode = "tools";
  var secState = {}; /* section id → open bool */
  /* Left = control / launch + Keys stack. Data → right drawer
   * Edge peeks like mueee search: reader / history / notepad side drawers —
   * always on the left screen edge, one tap opens that pane. */
  var MODES = [
    { id: "tools", label: "Tools", short: "Tools", ico: "◆", accent: "#58a6ff" },
    { id: "keys", label: "Keys", short: "Keys", ico: "⌨", accent: "#c9a84c" },
    { id: "staff", label: "Staff", short: "Staff", ico: "♪", accent: "#a78bfa" },
    { id: "qbit", label: "Qbit", short: "Qbit", ico: "⚛", accent: "#22d3ee" },
    { id: "gt", label: "GT", short: "GT", ico: "🌳", accent: "#34d399" },
    { id: "vid", label: "Vid", short: "Vid", ico: "▶", accent: "#f0883e" },
    { id: "books", label: "Books", short: "Books", ico: "▤", accent: "#e040fb" },
    { id: "shell", label: "Shell", short: "Shell", ico: "⌘", accent: "#94a3b8" },
  ];
  var staffKind = "scale";
  var staffQuery = "";

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "drawer");
    } catch (e) {}
  }

  function raiseEdges() {
    try {
      var nodes = document.querySelectorAll(".mg-edge");
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.style.setProperty("z-index", "2147483647", "important");
        n.style.setProperty("pointer-events", "auto", "important");
      }
    } catch (e) {}
  }

  function nav(url) {
    try {
      if (window.ipc)
        window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
      else window.open(url, "_blank");
    } catch (e) {
      try {
        window.open(url, "_blank");
      } catch (e2) {}
    }
  }

  function ensureCss() {
    var old = document.getElementById("mg-tools-drawer-css");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "mg-tools-drawer-css";
    st.textContent = [
      ".mg-edge{z-index:2147483647!important;pointer-events:auto!important}",
      "html.mg-webgrid-play .mg-edge{z-index:2147483647!important;pointer-events:auto!important}",
      /* Viewport-fixed chrome — direct child of <html>, not <body> (page-axis transform) */
      "html > #mg-tools-drawer,html > #mg-tools-scrim{",
      "  position:fixed!important;backface-visibility:hidden}",
      /* Drop-style see-through glass (page shows through like shell Drop) */
      "#mg-tools-drawer{",
      "  --mg-tools-tab-w:32px;",
      "  --mg-tools-w:min(340px,88vw);",
      "  --mg-drop-a:var(--mg-fill-a,0.38);",
      "  --mg-embed-a:0.36;",
      "  position:fixed!important;left:0!important;top:0!important;bottom:0!important;",
      "  right:auto!important;width:var(--mg-tools-w);",
      "  z-index:2147483635;pointer-events:auto;",
      "  display:flex;flex-direction:column;",
      "  transform:translate3d(-100%,0,0)!important;",
      "  transition:transform .22s cubic-bezier(.2,.9,.2,1),width .2s ease,background .2s;",
      "  background:rgba(40,40,44,0.52)!important;",
      "  backdrop-filter:blur(48px) saturate(1.8)!important;",
      "  -webkit-backdrop-filter:blur(48px) saturate(1.8)!important;",
      "  border-right:1px solid rgba(255,255,255,0.12);",
      "  box-shadow:12px 0 40px rgba(0,0,0,0.32),inset 0 1px 0 rgba(255,255,255,0.12);",
      "  font:500 13px/1.25 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;",
      "  color:rgba(255,255,255,0.92);box-sizing:border-box;overflow:visible;",
      "  margin:0!important;max-height:100vh!important;max-height:100dvh!important}",
      "#mg-tools-drawer.open{transform:translate3d(0,0,0)!important}",
      /* Keys mode: CTRL-width stack so keyboard is not squished */
      "#mg-tools-drawer.keys-mode{--mg-tools-w:min(480px,94vw)}",
      "#mg-tools-drawer.keys-mode .drw-body{",
      "  padding:8px 12px 20px!important;display:flex;flex-direction:column;gap:0}",
      "#mg-tools-scrim{",
      "  position:fixed!important;inset:0!important;margin:0!important;",
      "  background:rgba(0,0,0,0.12)!important}",
      /* soft drop lip on drawer edge */
      "#mg-tools-drawer.open::after{",
      "  content:'';position:absolute;top:0;bottom:0;right:-28px;width:28px;pointer-events:none;",
      "  background:linear-gradient(90deg,rgba(14,16,22,calc(var(--mg-drop-a)*0.55)),transparent)}",
      "#mg-drawer-kb-host,#mg-drawer-beats-host{",
      "  display:flex;flex-direction:column;flex:0 0 auto;",
      "  width:100%;min-height:0;margin:0 0 12px;",
      "  border-radius:16px;overflow:visible}",
      "#mg-drawer-kb-host{min-height:340px}",
      "#mg-drawer-beats-host{min-height:220px}",
      "#mg-drawer-stack-label,.mg-drawer-stack-label{",
      "  font:600 11px/1 -apple-system,system-ui;letter-spacing:0.02em;text-transform:none;",
      "  color:rgba(255,255,255,0.42);margin:10px 2px 8px}",
      ".mg-drawer-stack-label:first-of-type{margin-top:6px}",
      "#mg-tools-drawer.keys-mode .mg-cap-row{margin-bottom:6px}",
      "#mg-tools-drawer .staff-list{",
      "  display:flex;flex-direction:column;gap:0;max-height:min(52vh,480px);",
      "  overflow-y:auto;padding-bottom:8px}",
      "#mg-tools-drawer .staff-lab{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}",
      /* ── Edge mode peeks (mueee: reader / history / notepad side drawers) ──
       * Viewport-fixed sibling of the sliding panel — NOT inside transform —
       * so peeks never clip and stay one-tap reachable on the left edge.
       * Closed → left:0. Open → rides drawer wall (left = drawer width). */
      "html > #mg-tools-mode-rail{",
      "  position:fixed!important;top:50%;right:auto;bottom:auto;",
      "  left:0;z-index:2147483640!important;pointer-events:auto!important;",
      "  transform:translateY(-50%);",
      "  display:flex;flex-direction:column;gap:4px;",
      "  padding:8px 0;margin:0;",
      "  max-height:min(92vh,740px);overflow-y:auto;overflow-x:visible;",
      "  -webkit-overflow-scrolling:touch;",
      "  transition:left .22s cubic-bezier(.2,.9,.2,1);",
      "  backface-visibility:hidden}",
      "html.mg-left-open > #mg-tools-mode-rail{",
      "  left:var(--mg-tools-w,min(340px,88vw))}",
      "html.mg-left-open.mg-left-keys > #mg-tools-mode-rail{",
      "  left:var(--mg-tools-w,min(480px,94vw))}",
      "#mg-tools-mode-rail button{",
      "  appearance:none;cursor:pointer;pointer-events:auto;",
      "  display:flex;flex-direction:column;align-items:center;justify-content:center;",
      "  gap:4px;min-width:48px;min-height:52px;padding:9px 10px 8px;",
      "  margin:0;border:1px solid rgba(255,255,255,0.14);border-left:0;",
      "  border-radius:0 14px 14px 0;",
      "  border-left:3px solid var(--peek-accent,rgba(255,255,255,0.28));",
      "  background:rgba(28,28,32,0.92);",
      "  backdrop-filter:blur(28px) saturate(1.5);-webkit-backdrop-filter:blur(28px) saturate(1.5);",
      "  box-shadow:6px 2px 20px rgba(0,0,0,0.34),inset 0 0.5px 0 rgba(255,255,255,0.12);",
      "  color:rgba(255,255,255,0.78);",
      "  font:600 9px/1 -apple-system,BlinkMacSystemFont,system-ui;",
      "  letter-spacing:0.02em;text-transform:none;",
      "  transition:background .12s,color .12s,transform .12s,box-shadow .12s,min-width .12s}",
      "#mg-tools-mode-rail button .ico{",
      "  font-size:15px;line-height:1;opacity:0.95;",
      "  font-family:-apple-system,system-ui,sans-serif}",
      "#mg-tools-mode-rail button .lbl{",
      "  font:600 9px/1 -apple-system,system-ui;letter-spacing:0.01em;",
      "  white-space:nowrap}",
      "#mg-tools-mode-rail button:hover{",
      "  background:rgba(48,48,54,0.96);color:#fff;transform:translateX(3px);",
      "  box-shadow:8px 2px 22px rgba(0,0,0,0.4),inset 0 0.5px 0 rgba(255,255,255,0.16)}",
      "#mg-tools-mode-rail button:active{transform:translateX(1px) scale(0.98)}",
      "#mg-tools-mode-rail button.on{",
      "  background:rgba(255,255,255,0.14);color:#fff;",
      "  min-width:54px;",
      "  border-left-color:var(--peek-accent,#0a84ff);",
      "  box-shadow:6px 2px 22px rgba(0,0,0,0.38),inset 0 0.5px 0 rgba(255,255,255,0.18),",
      "    0 0 12px color-mix(in srgb,var(--peek-accent,#0a84ff) 40%,transparent)}",
      "html.mg-left-open #mg-tools-mode-rail button.on{",
      "  background:rgba(10,132,255,0.22)}",
      /* hide legacy single TOOLS tab if present */
      "#mg-tools-tab{display:none!important}",
      /* header chips retired — edge peeks are primary (mueee-style) */
      "#mg-tools-drawer .drw-tabs-host{display:none!important}",
      "#mg-tools-drawer .drw-hd{",
      "  display:flex;align-items:center;justify-content:space-between;gap:8px;",
      "  padding:12px 12px 8px;flex-shrink:0;",
      "  border-bottom:1px solid rgba(255,255,255,0.08)}",
      "#mg-tools-drawer .drw-hd .ttl{",
      "  font:600 13px/1.1 -apple-system,BlinkMacSystemFont,system-ui;",
      "  letter-spacing:-0.01em;text-transform:none;",
      "  color:rgba(255,255,255,0.88)}",
      "#mg-tools-drawer .drw-hd .ttl .dot{",
      "  display:inline-block;width:7px;height:7px;border-radius:50%;",
      "  background:rgba(120,220,160,0.95);margin-right:8px;",
      "  box-shadow:0 0 6px rgba(120,220,160,0.4);vertical-align:middle}",
      "#mg-tools-drawer .drw-hd .ttl .mode-tag{",
      "  font:500 11px/1 system-ui;color:rgba(255,255,255,0.4);margin-left:8px;",
      "  letter-spacing:0.02em}",
      "#mg-tools-drawer .drw-hd button{",
      "  appearance:none;cursor:pointer;border:0;background:rgba(255,255,255,0.1);",
      "  color:rgba(255,255,255,0.85);width:28px;height:28px;border-radius:50%;",
      "  font:600 14px/1 system-ui}",
      "#mg-tools-drawer .drw-hd button:hover{background:rgba(255,255,255,0.18)}",
      "#mg-tools-drawer .drw-master{",
      "  display:flex;justify-content:flex-end;gap:12px;padding:2px 12px 6px;flex-shrink:0}",
      "#mg-tools-drawer .drw-master button{",
      "  appearance:none;cursor:pointer;border:0;background:transparent;",
      "  font:500 10px/1 -apple-system,system-ui;letter-spacing:0.02em;text-transform:none;",
      "  color:rgba(255,255,255,0.38);padding:4px 2px}",
      "#mg-tools-drawer .drw-master button:hover{color:rgba(255,255,255,0.88)}",
      "#mg-tools-drawer .drw-body{",
      "  flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;",
      "  padding:4px 10px 16px;-webkit-overflow-scrolling:touch;",
      "  font:500 13px/1.25 -apple-system,BlinkMacSystemFont,system-ui,sans-serif}",
      /* Sections — quiet CTRL labels, not shouty uppercase chrome */
      "#mg-tools-drawer .mg-sec{border-bottom:0;margin:0 0 4px}",
      "#mg-tools-drawer .mg-sec-toggle{",
      "  appearance:none;width:100%;cursor:pointer;user-select:none;",
      "  display:flex;align-items:center;justify-content:space-between;gap:8px;",
      "  padding:8px 4px 6px;margin:0;border:0;border-radius:8px;",
      "  background:transparent;color:rgba(255,255,255,0.42);",
      "  font:600 11px/1 -apple-system,system-ui;letter-spacing:0.02em;",
      "  text-transform:none;text-align:left}",
      "#mg-tools-drawer .mg-sec-toggle:hover{color:rgba(255,255,255,0.75);",
      "  background:rgba(255,255,255,0.04)}",
      "#mg-tools-drawer .mg-sec.is-open .mg-sec-toggle{color:rgba(255,255,255,0.55)}",
      "#mg-tools-drawer .mg-sec-toggle .sec-meta{display:flex;align-items:center;gap:8px;min-width:0}",
      "#mg-tools-drawer .mg-sec-toggle .sec-count{",
      "  font:500 10px/1 system-ui;letter-spacing:0;text-transform:none;",
      "  color:rgba(255,255,255,0.28)}",
      "#mg-tools-drawer .mg-sec-toggle .chev{",
      "  flex-shrink:0;font-size:8px;opacity:0.35;transition:transform .15s;",
      "  color:rgba(255,255,255,0.45)}",
      "#mg-tools-drawer .mg-sec.is-open .mg-sec-toggle .chev{transform:rotate(180deg);opacity:0.55}",
      "#mg-tools-drawer .mg-sec-body{display:none;padding:0 0 10px}",
      "#mg-tools-drawer .mg-sec.is-open > .mg-sec-body{display:block}",
      /* Module tiles — exact CTRL / SpaceXAI Control Center language */
      "#mg-tools-drawer .mg-cap-row, #mg-tools-drawer .staff-quick{",
      "  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:8px}",
      "#mg-tools-drawer .mg-cap-row.row3{grid-template-columns:repeat(3,minmax(0,1fr))}",
      "#mg-tools-drawer button.act{",
      "  appearance:none;cursor:pointer;border:0;",
      "  display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;",
      "  gap:8px;text-align:left;",
      "  background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.95);",
      "  font:600 12px/1.15 -apple-system,BlinkMacSystemFont,system-ui;",
      "  letter-spacing:-0.01em;text-transform:none;",
      "  padding:12px;border-radius:16px;min-height:72px;",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.14);",
      "  transition:background .12s ease,transform .1s ease}",
      "#mg-tools-drawer button.act:hover{background:rgba(255,255,255,0.16)}",
      "#mg-tools-drawer button.act:active{transform:scale(0.97);background:rgba(255,255,255,0.2)}",
      "#mg-tools-drawer button.act .ico{",
      "  display:flex;align-items:center;justify-content:center;",
      "  width:28px;height:28px;border-radius:50%;",
      "  background:rgba(255,255,255,0.14);font-size:13px;line-height:1;",
      "  color:rgba(255,255,255,0.92);box-shadow:none;",
      "  font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif}",
      "#mg-tools-drawer button.act.primary .ico{",
      "  background:rgba(10,132,255,0.92);color:#fff}",
      "#mg-tools-drawer button.act.ok .ico{",
      "  background:rgba(48,209,88,0.88);color:#fff}",
      "#mg-tools-drawer button.act.hot .ico{",
      "  background:rgba(255,159,10,0.9);color:#1a1200}",
      "#mg-tools-drawer button.act.muted .ico{",
      "  background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.65)}",
      "#mg-tools-drawer button.act .lbl{",
      "  font:600 12px/1.2 -apple-system,system-ui;color:rgba(255,255,255,0.95)}",
      "#mg-tools-drawer button.act .sub{",
      "  font:500 10px/1.2 -apple-system,system-ui;color:rgba(255,255,255,0.42);margin-top:1px}",
      "#mg-tools-drawer button.act.hot{background:rgba(255,159,10,0.14)}",
      "#mg-tools-drawer button.act.ok{background:rgba(48,209,88,0.12)}",
      "#mg-tools-drawer button.act.primary{background:rgba(10,132,255,0.14)}",
      "#mg-tools-drawer button.act.muted{background:rgba(255,255,255,0.07)}",
      "#mg-tools-drawer button.act.wide{",
      "  grid-column:1 / -1;flex-direction:row;align-items:center;min-height:52px;padding:10px 14px}",
      "#mg-tools-drawer button.act.wide .lbl{flex:1}",
      /* chips / secondary — quiet glass, not candy pills */
      "#mg-tools-drawer .staff-kinds{",
      "  display:flex;flex-wrap:wrap;gap:4px;margin:0 0 10px}",
      "#mg-tools-drawer .staff-kinds button,",
      "#mg-tools-drawer .staff-lab a,#mg-tools-drawer .staff-lab button{",
      "  appearance:none;cursor:pointer;border:0;",
      "  background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.72);",
      "  font:600 10px/1 -apple-system,system-ui;letter-spacing:0.01em;",
      "  text-transform:none;padding:7px 10px;border-radius:10px;",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.1);text-decoration:none}",
      "#mg-tools-drawer .staff-kinds button:hover,",
      "#mg-tools-drawer .staff-lab a:hover,#mg-tools-drawer .staff-lab button:hover{",
      "  background:rgba(255,255,255,0.14);color:#fff}",
      "#mg-tools-drawer .staff-kinds button.on{",
      "  background:rgba(255,255,255,0.16);color:#fff;",
      "  box-shadow:0 1px 2px rgba(0,0,0,0.18),inset 0 0.5px 0 rgba(255,255,255,0.14)}",
      "#mg-tools-drawer .staff-search{",
      "  width:100%;box-sizing:border-box;margin:0 0 10px;padding:10px 12px;",
      "  border-radius:12px;border:0;",
      "  background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.92);",
      "  font:500 12px/1.2 -apple-system,system-ui;outline:none;",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.1)}",
      "#mg-tools-drawer .staff-search:focus{background:rgba(255,255,255,0.12)}",
      "#mg-tools-drawer .staff-row{",
      "  appearance:none;cursor:pointer;width:100%;text-align:left;border:0;",
      "  display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:16px;",
      "  background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.95);",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.14);margin-bottom:6px}",
      "#mg-tools-drawer .staff-row:hover{background:rgba(255,255,255,0.16)}",
      "#mg-tools-drawer .staff-row .st-title{",
      "  font:600 12px/1.2 -apple-system,system-ui;color:rgba(255,255,255,0.95)}",
      "#mg-tools-drawer .staff-row .st-sub{",
      "  font:500 10px/1.25 ui-monospace,Menlo,monospace;color:rgba(255,255,255,0.42);",
      "  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#mg-tools-drawer .staff-row .st-tags{",
      "  font:500 9px/1 system-ui;letter-spacing:0.02em;text-transform:none;",
      "  color:rgba(255,255,255,0.32)}",
      "#mg-tools-drawer .drw-hint,#mg-tools-drawer .staff-meta{",
      "  font:500 11px/1.35 -apple-system,system-ui;color:rgba(255,255,255,0.4);",
      "  margin:4px 2px 10px}",
      "#mg-tools-drawer .staff-meta b{color:rgba(255,255,255,0.72);font-weight:600}",
      "#mg-tools-drawer .drw-status{",
      "  flex-shrink:0;padding:8px 14px 12px;border-top:1px solid rgba(255,255,255,0.06);",
      "  font:500 10px/1.3 -apple-system,ui-monospace,Menlo,monospace;",
      "  color:rgba(255,255,255,0.38);background:transparent;text-align:center}",
      "#mg-tools-scrim{",
      "  position:fixed!important;inset:0!important;z-index:2147483630;pointer-events:none;",
      "  background:rgba(0,0,0,0.22);opacity:0;transition:opacity .2s}",
      "#mg-tools-scrim.on{opacity:1;pointer-events:auto}",
      "html.mg-drawer-mode #mg-glass-cap{",
      "  display:none!important;visibility:hidden!important;pointer-events:none!important;",
      "  opacity:0!important;width:0!important;height:0!important;overflow:hidden!important}",
      "html.mg-drawer-mode #mg-bloch-orb,html.mg-drawer-mode #mg-rubik-orb,",
      "html.mg-drawer-mode #mg-sx-rail{display:none!important;pointer-events:none!important}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
    try {
      document.documentElement.classList.add("mg-drawer-mode");
    } catch (e) {}
    raiseEdges();
  }

  function setStatus(s) {
    if (statusEl) statusEl.textContent = s || "Control Center · drawer";
  }

  function act(label, cls, fn, opts) {
    opts = opts || {};
    var b = document.createElement("button");
    b.type = "button";
    b.className = "act" + (cls ? " " + cls : "") + (opts.wide ? " wide" : "");
    b.innerHTML =
      '<span class="ico" aria-hidden="true">' +
      (opts.ico || "●") +
      "</span>" +
      '<span class="lbl">' +
      label +
      (opts.sub ? '<div class="sub">' + opts.sub + "</div>" : "") +
      "</span>";
    b.onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      try {
        window.__mgUserChromeTouch = true;
        fn();
        if (!opts.keepStatus) setStatus(label + " · ready");
      } catch (e) {
        setStatus("err " + e);
      }
      try {
        if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
          window.__mgFloatLayout.apply();
      } catch (eA) {}
      raiseEdges();
    };
    return b;
  }

  function row() {
    var r = document.createElement("div");
    r.className = "mg-cap-row";
    return r;
  }

  function secIsOpen(id, defOpen) {
    if (secState[id] == null) secState[id] = defOpen !== false;
    return !!secState[id];
  }

  function collapsible(id, title, defOpen, fillFn) {
    var wrap = document.createElement("div");
    wrap.className = "mg-sec" + (secIsOpen(id, defOpen) ? " is-open" : "");
    wrap.setAttribute("data-sec", id);
    var n = 0;
    var bodyEl = document.createElement("div");
    bodyEl.className = "mg-sec-body";
    fillFn(bodyEl, function count() {
      n++;
    });
    /* count children acts */
    n = bodyEl.querySelectorAll("button.act").length;
    var tog = document.createElement("button");
    tog.type = "button";
    tog.className = "mg-sec-toggle";
    tog.innerHTML =
      '<span class="sec-meta"><span class="sec-title">' +
      title +
      '</span><span class="sec-count">' +
      n +
      "</span></span>" +
      '<span class="chev">▾</span>';
    tog.onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      secState[id] = !secIsOpen(id, defOpen);
      wrap.classList.toggle("is-open", secState[id]);
    };
    wrap.appendChild(tog);
    wrap.appendChild(bodyEl);
    return wrap;
  }

  function setAllSections(openAll) {
    openAll = !!openAll;
    /* remember every known section id (current DOM + stored + mode defaults) */
    var ids = {};
    Object.keys(secState).forEach(function (k) {
      ids[k] = 1;
    });
    [
      "lab",
      "play",
      "solve",
      "kbatch",
      "field",
      "session",
      "system",
      "shell",
      "keys-actions",
      "keys-stack",
      "staff-quick",
      "staff-browse",
      "qbit-ops",
      "gt-ops",
      "vid-ops",
      "books-ops",
    ].forEach(function (k) {
      ids[k] = 1;
    });
    if (body) {
      body.querySelectorAll(".mg-sec[data-sec]").forEach(function (n) {
        var id = n.getAttribute("data-sec");
        if (id) ids[id] = 1;
      });
    }
    Object.keys(ids).forEach(function (k) {
      secState[k] = openAll;
    });
    paint();
  }

  /** Expand all / Collapse all — every mode tab (Tools · Keys · Staff · …) */
  function paintMasterBar(into) {
    var master = document.createElement("div");
    master.className = "drw-master";
    var ex = document.createElement("button");
    ex.type = "button";
    ex.textContent = "Expand all";
    ex.title = "Expand all sections in this menu";
    ex.onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      setAllSections(true);
    };
    var col = document.createElement("button");
    col.type = "button";
    col.textContent = "Collapse all";
    col.title = "Collapse all sections in this menu";
    col.onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      setAllSections(false);
    };
    master.appendChild(ex);
    master.appendChild(col);
    into.appendChild(master);
  }

  function modeMeta(id) {
    for (var i = 0; i < MODES.length; i++) {
      if (MODES[i].id === id) return MODES[i];
    }
    return MODES[0];
  }

  /** Vertical edge peeks — always reachable (closed or open), like mueee side drawers */
  function paintModeRail() {
    if (!modeRail) return;
    modeRail.innerHTML = "";
    MODES.forEach(function (M) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-mode", M.id);
      b.setAttribute("aria-label", M.label);
      b.setAttribute("aria-pressed", open && mode === M.id ? "true" : "false");
      b.className = mode === M.id ? "on" : "";
      if (M.accent) b.style.setProperty("--peek-accent", M.accent);
      b.title =
        M.label +
        (open && mode === M.id ? " · tap again to close" : " · open " + M.label);
      b.innerHTML =
        '<span class="ico" aria-hidden="true">' +
        (M.ico || "●") +
        "</span>" +
        '<span class="lbl">' +
        (M.short || M.label) +
        "</span>";
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        window.__mgUserChromeTouch = true;
        if (open && mode === M.id) {
          /* second tap on active peek closes (mueee reader/history/notepad) */
          setOpen(false);
          return;
        }
        openMode(M.id);
      };
      modeRail.appendChild(b);
    });
    positionModeRail();
  }

  /** Ride drawer wall when open; pin to left edge when closed */
  function positionModeRail() {
    if (!modeRail) return;
    try {
      if (!open) {
        modeRail.style.left = "0";
        return;
      }
      var w = 340;
      if (el) {
        var cs = getComputedStyle(el);
        var pw = parseFloat(cs.width);
        if (isFinite(pw) && pw > 80) w = pw;
      }
      modeRail.style.left = Math.round(w) + "px";
    } catch (e) {
      modeRail.style.left = open ? "min(340px,88vw)" : "0";
    }
  }

  function paintModeTabs(host) {
    /* horizontal chips retired — edge peeks are primary */
    if (host) host.innerHTML = "";
    paintModeRail();
  }

  /** Open drawer straight into a mode (one-tap from edge peek) */
  function openMode(id) {
    var next = id || "tools";
    var known = false;
    for (var i = 0; i < MODES.length; i++) {
      if (MODES[i].id === next) {
        known = true;
        break;
      }
    }
    if (!known) next = "tools";
    mode = next;
    setOpen(true);
  }

  function paintTools(into) {
    into.appendChild(
      collapsible("lab", "Lab", true, function (box) {
        var r = row();
        r.appendChild(
          act(
            "Keys stack",
            "primary",
            function () {
              mode = "keys";
              paint();
              setStatus("Keys · keyboard + beats stacked");
            },
            { ico: "⌨", sub: "KB + Beats in drawer", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Codec",
            "hot",
            function () {
              mode = "keys";
              paint();
              try {
                if (window.__mgFloatKb && window.__mgFloatKb.launch)
                  window.__mgFloatKb.launch({
                    mode: "codec",
                    codec: "hex",
                    text: window.__mgFloatKb.buffer() || "hello MG",
                  });
              } catch (e) {}
              setStatus("Codec · in Keys stack");
            },
            { ico: "⌬", sub: "HEX·BIN·Glyph in Keys", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Maze",
            "primary",
            function () {
              if (window.__mgMemoryMaze) {
                window.__mgMemoryMaze.toggle();
                setStatus(window.__mgMemoryMaze.report());
              } else setStatus("Maze missing");
            },
            { ico: "◈", sub: "Memory rain", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Beats →",
            "ok",
            function () {
              mode = "keys";
              paint();
              setStatus("Beats · stacked under keyboard");
            },
            { ico: "♪", sub: "Staff · piano in drawer", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Staff cat",
            "hot",
            function () {
              mode = "staff";
              paint();
              setStatus("Staff catalogue · KBatch music twin");
            },
            { ico: "𝄞", sub: "183 · scales · motifs", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Contrail",
            "ok",
            function () {
              if (window.__mgContrail) {
                if (window.__mgContrail.toggle) window.__mgContrail.toggle();
                else if (window.__mgContrail.setFlow)
                  window.__mgContrail.setFlow(true);
                if (window.__mgContrail.setOverlay)
                  window.__mgContrail.setOverlay(true);
                setStatus(window.__mgContrail.report());
              } else setStatus("Contrail on WebGrid only");
            },
            { ico: "〰", sub: "Path flow", keepStatus: true }
          )
        );
        box.appendChild(r);
      })
    );

    into.appendChild(
      collapsible("play", "Play", true, function (box) {
        var r = row();
        r.appendChild(
          act(
            "Field",
            "ok",
            function () {
              try {
                if (window.__mgFloatLayout && window.__mgFloatLayout.closeHeavy)
                  window.__mgFloatLayout.closeHeavy({
                    keepPlay: true,
                    boardPill: true,
                    ctrlPill: false,
                  });
              } catch (e) {}
              if (window.__mgSportsField) {
                if (!window.__mgSportsField.isOpen()) {
                  window.__mgSportsField.open();
                  if (window.__mgSportsField.setMode)
                    window.__mgSportsField.setMode("webgrid");
                  if (window.__mgKeyboardBeats) window.__mgKeyboardBeats.open();
                } else {
                  var m =
                    window.__mgSportsField.mode && window.__mgSportsField.mode();
                  if (m === "webgrid") window.__mgSportsField.setMode("go");
                  else if (m === "go") window.__mgSportsField.setMode("chess");
                  else window.__mgSportsField.close();
                }
                setStatus(window.__mgSportsField.report());
              } else nav("https://mueee.qbitos.ai/sports-field-ugrad.html");
            },
            { ico: "▣", sub: "WebGrid · Go · Chess", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Raider",
            "primary",
            function () {
              if (window.__mgRaider) {
                window.__mgRaider.toggle();
                setStatus(window.__mgRaider.report());
              } else setStatus("Raider missing");
            },
            { ico: "▶", sub: "BrotherNumsey", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Board",
            "ok",
            function () {
              if (window.__mgActivityBoard) {
                if (
                  window.__mgActivityBoard.isOpen &&
                  window.__mgActivityBoard.isOpen()
                ) {
                  if (
                    window.__mgActivityBoard.isCollapsed &&
                    window.__mgActivityBoard.isCollapsed()
                  )
                    window.__mgActivityBoard.expand();
                  else window.__mgActivityBoard.close();
                } else window.__mgActivityBoard.open({ collapsed: true });
                setStatus(window.__mgActivityBoard.report());
              } else setStatus("Board missing");
            },
            { ico: "☰", sub: "Live rank", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Play stack",
            "hot",
            function () {
              if (window.__mgFloatLayout && window.__mgFloatLayout.openPlayStack) {
                window.__mgFloatLayout.openPlayStack({
                  keyboard: true,
                  kbMode: "codec",
                  codec: "hex",
                  mode: "webgrid",
                });
                setStatus("Field+Beats+Codec · matched");
              } else if (
                window.__mgFloatLayout &&
                window.__mgFloatLayout.openLabKit
              ) {
                window.__mgFloatLayout.openLabKit();
                setStatus("Lab kit");
              }
            },
            { ico: "✦", sub: "Field · Beats · KB", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Clear",
            "muted",
            function () {
              if (window.__mgMenus && window.__mgMenus.closeAll)
                window.__mgMenus.closeAll();
              else if (window.__mgFloatLayout && window.__mgFloatLayout.closeAll)
                window.__mgFloatLayout.closeAll();
              setStatus("Stack cleared");
            },
            { ico: "⊘", sub: "Close all floats", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Calibrate",
            "primary",
            function () {
              if (window.__mgCal && window.__mgCal.boot) {
                setStatus("CAL → SHOW…");
                window.__mgCal.boot({ mode: "full" }).then(function (r) {
                  setStatus(
                    r && r.ok
                      ? "CAL+SHOW green · " + (r.ms || "?") + "ms"
                      : "CAL done"
                  );
                });
              } else if (window.__mgMenus && window.__mgMenus.exercise) {
                window.__mgMenus.exercise({ delayMs: 120 });
                setStatus("Menu exercise…");
              } else setStatus("Cal missing");
            },
            { ico: "◎", sub: "Fast verify + flourish", keepStatus: true }
          )
        );
        box.appendChild(r);
      })
    );

    into.appendChild(
      collapsible("solve", "Solve", true, function (box) {
        var r = row();
        r.appendChild(
          act(
            "Bloch",
            "primary",
            function () {
              if (window.__mgBlochSolve) {
                window.__mgBlochSolve.setEnabled(true);
                if (window.__mgBlochSolve.toggle) window.__mgBlochSolve.toggle();
                else if (window.__mgBlochSolve.open) window.__mgBlochSolve.open();
                setStatus(
                  window.__mgBlochSolve.report
                    ? window.__mgBlochSolve.report()
                    : "Bloch"
                );
              } else setStatus("Bloch missing");
            },
            { ico: "◉", sub: "Dual solve", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Rubik",
            "hot",
            function () {
              if (window.__mgRubikLang) {
                if (window.__mgRubikLang.toggle) window.__mgRubikLang.toggle();
                else if (window.__mgRubikLang.open) window.__mgRubikLang.open();
                setStatus(
                  window.__mgRubikLang.report
                    ? window.__mgRubikLang.report()
                    : "Rubik"
                );
              } else setStatus("Rubik missing");
            },
            { ico: "▦", sub: "3D lang · solve", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "GEO",
            "hot",
            function () {
              if (window.__mgGeoPattern) {
                window.__mgGeoPattern.toggle();
                setStatus(window.__mgGeoPattern.report());
              } else setStatus("GEO missing");
            },
            { ico: "◎", sub: "Hunt · quake", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "WebGrid",
            "primary",
            function () {
              nav("https://neuralink.com/webgrid/?mg_autoplay=1");
            },
            { ico: "⊞", sub: "Play" }
          )
        );
        r.appendChild(
          act(
            "Hot",
            "muted",
            function () {
              try {
                if (window.ipc)
                  window.ipc.postMessage(JSON.stringify({ op: "hot_reload" }));
                setStatus("Hot reload");
              } catch (e) {
                setStatus("⌘⇧R hot reload");
              }
            },
            { ico: "↻", sub: "Reload menus", keepStatus: true }
          )
        );
        box.appendChild(r);
      })
    );

    into.appendChild(
      collapsible("kbatch", "kbatch · R4-data", false, function (box) {
        var r = row();
        r.appendChild(
          act(
            "kbatch",
            "primary",
            function () {
              if (window.__mgKbatchFleet) window.__mgKbatchFleet.openHome();
              else nav("https://kbatch.ugrad.ai/");
              setStatus(
                window.__mgKbatchFleet
                  ? window.__mgKbatchFleet.report()
                  : "kbatch.ugrad.ai"
              );
            },
            {
              ico: "∇",
              sub: window.__mgKbatchFleet
                ? "R4 · " +
                  ((window.__mgKbatchFleet.snap().metrics || {}).d5Glosses ||
                    "6k") +
                  " glosses"
                : "ugrad.ai",
              keepStatus: true,
            }
          )
        );
        r.appendChild(
          act(
            "Books",
            "ok",
            function () {
              if (window.__mgKbatchFleet) window.__mgKbatchFleet.openLivingBooks();
              else nav("https://kbatch.ugrad.ai/labs/living-books.html");
            },
            { ico: "📘", sub: "MG P0 playfield" }
          )
        );
        r.appendChild(
          act(
            "Learn",
            "ok",
            function () {
              if (window.__mgKbatchFleet) window.__mgKbatchFleet.openLearn();
              else nav("https://kbatch.ugrad.ai/learn");
            },
            { ico: "▤", sub: "Schools 0.80" }
          )
        );
        r.appendChild(
          act(
            "Dojo",
            "muted",
            function () {
              if (window.__mgKbatchFleet) window.__mgKbatchFleet.openDojo();
              else nav("https://kbatch.ugrad.ai/dojo/");
            },
            { ico: "⚔", sub: "Typing 0.77" }
          )
        );
        box.appendChild(r);
      })
    );

    into.appendChild(
      collapsible("field", "Field", false, function (box) {
        var r = row();
        r.appendChild(
          act(
            "Hunt",
            "hot",
            function () {
              if (window.__mgGeoPattern) {
                window.__mgGeoPattern.open();
                if (window.__mgGeoPattern.hunt) window.__mgGeoPattern.hunt();
                setStatus("Hunt clue ready");
              } else setStatus("GEO missing");
            },
            { ico: "⌖", sub: "Scavenger", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Phrase → Dojo",
            "hot",
            function () {
              var phrase =
                (window.__mgContrail &&
                  window.__mgContrail.stats &&
                  window.__mgContrail.stats.lastPhrase) ||
                (window.__mgFloatKb && window.__mgFloatKb.buffer()) ||
                "path";
              if (!window.__mgKbatchDojo) {
                setStatus("kbatch bridge missing");
                return;
              }
              setStatus("Dojo «" + String(phrase).slice(0, 16) + "»…");
              window.__mgKbatchDojo
                .runPhrase(phrase, {
                  canvas: document.getElementById("mg-contrail-ov"),
                  seed:
                    window.__mgFloatKb && window.__mgFloatKb.buffer()
                      ? window.__mgFloatKb.buffer().trim()
                      : null,
                })
                .then(function (rep) {
                  if (!rep) {
                    setStatus("dojo empty");
                    return;
                  }
                  setStatus(
                    "strain " +
                      rep.strain +
                      " · SO " +
                      (Object.keys(rep.phrasingOrders || {}).join("/") || "—")
                  );
                });
            },
            { ico: "⚡", sub: "Contrail → kbatch", wide: true, keepStatus: true }
          )
        );
        box.appendChild(r);
      })
    );

    into.appendChild(
      collapsible("session", "Session", false, function (box) {
        var r = row();
        r.appendChild(
          act(
            "Record",
            "primary",
            function () {
              if (window.__mgSessionRec) {
                if (window.__mgSessionRec.isRecording())
                  window.__mgSessionRec.stop();
                else window.__mgSessionRec.start();
                setStatus(window.__mgSessionRec.report());
              } else setStatus("REC missing");
            },
            { ico: "●", sub: "Session", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Day",
            "ok",
            function () {
              if (window.__mgCollabDay) {
                if (!window.__mgCollabDay.day()) window.__mgCollabDay.start({});
                window.__mgCollabDay.toggle();
                setStatus(window.__mgCollabDay.report());
              } else setStatus("Collab day missing");
            },
            { ico: "▦", sub: "Mesh collab", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Mesh",
            "ok",
            function () {
              if (window.__mgCollabDay) {
                window.__mgCollabDay.shareScore();
                setStatus("Score on mg-mesh");
              } else if (window.__mgMesh)
                setStatus(window.__mgMesh.report());
              else setStatus("Mesh missing");
            },
            { ico: "⬡", sub: "Share", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "X Draft",
            "hot",
            function () {
              if (
                window.__mgCollabDay &&
                window.__mgCollabDay.day &&
                window.__mgCollabDay.day()
              ) {
                window.__mgCollabDay.exportXDraft();
                setStatus("X draft · you post");
              } else if (
                window.__mgSessionRec &&
                window.__mgSessionRec.exportXDraft
              ) {
                window.__mgSessionRec.exportXDraft();
                setStatus("X draft · clipboard");
              } else setStatus("X draft missing");
            },
            { ico: "↗", sub: "Copy only", keepStatus: true }
          )
        );
        box.appendChild(r);
      })
    );
  }

  function paintQbit(into) {
    into.appendChild(
      collapsible("qbit-ops", "Qbit · gates", true, function (box) {
        var h = document.createElement("p");
        h.className = "drw-hint";
        h.textContent = "Quantum · gates · mini Bloch";
        box.appendChild(h);
        var r = row();
        r.className = "mg-cap-row row3";
        r.appendChild(
          act(
            "Open",
            "ok",
            function () {
              if (window.__mgQuantum) {
                var rail = document.getElementById("mg-qwg-rail");
                if (rail) {
                  rail.style.display = "flex";
                  window.__mgQuantum.open();
                }
                setStatus(window.__mgQuantum.report());
              } else setStatus("Quantum not loaded");
            },
            { ico: "⚛", sub: "Full rail", keepStatus: true }
          )
        );
        ["H", "X", "Y", "Z", "S", "T"].forEach(function (g) {
          r.appendChild(
            act(
              g,
              "primary",
              function () {
                if (window.__mgQuantum)
                  window.__mgQuantum.applyGate({ id: g, name: g });
                setStatus(window.__mgQuantum ? window.__mgQuantum.report() : "?");
              },
              { ico: g, sub: "Gate", keepStatus: true }
            )
          );
        });
        r.appendChild(
          act(
            "Score",
            "hot",
            function () {
              if (window.__mgQuantum) window.__mgQuantum.scoreHit();
              setStatus(window.__mgQuantum ? window.__mgQuantum.report() : "?");
            },
            { ico: "★", sub: "Hit", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "|0⟩",
            "muted",
            function () {
              if (window.__mgQuantum) window.__mgQuantum.reset();
            },
            { ico: "↺", sub: "Reset" }
          )
        );
        r.appendChild(
          act(
            "Composer",
            "primary",
            function () {
              nav("https://quantum.cloud.ibm.com/composer");
            },
            { ico: "IBM", sub: "Cloud" }
          )
        );
        box.appendChild(r);
      })
    );
  }

  function paintGt(into) {
    into.appendChild(
      collapsible("gt-ops", "GT · actions", true, function (box) {
        var h = document.createElement("p");
        h.className = "drw-hint";
        h.textContent = "Lark governance tree · IANA · CDN · MG fleet";
        box.appendChild(h);
        var r = row();
        r.appendChild(
          act(
            "TICK",
            "ok",
            function () {
              if (window.__mgLark) window.__mgLark.tick();
              setStatus(window.__mgLark ? window.__mgLark.report() : "gt");
            },
            { ico: "⏱", sub: "Epoch / hops", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Open LARK",
            "primary",
            function () {
              if (window.__mgLark && window.__mgLark.open) window.__mgLark.open();
              else setStatus("Lark missing — hot reload");
            },
            { ico: "🌳", sub: "Float rail", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Expand",
            "muted",
            function () {
              if (window.__mgLark && window.__mgLark.expandAll)
                window.__mgLark.expandAll(true);
              setStatus("tree expand all");
            },
            { ico: "▾", sub: "All nodes", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "EXPORT",
            "hot",
            function () {
              if (window.__mgLark) window.__mgLark.exportSnapshot();
              setStatus("gt snapshot");
            },
            { ico: "↗", sub: "JSON snapshot", keepStatus: true }
          )
        );
        box.appendChild(r);
      })
    );
    into.appendChild(
      collapsible("gt-tree", "GT · governance tree", true, function (box) {
        var host = document.createElement("div");
        host.id = "mg-drawer-lark-host";
        box.appendChild(host);
        var ok = false;
        try {
          if (window.__mgLark && window.__mgLark.embedInto)
            ok = !!window.__mgLark.embedInto(host);
        } catch (e) {}
        if (!ok) {
          var miss = document.createElement("p");
          miss.className = "drw-hint";
          miss.textContent =
            "Lark tree missing — inject lark-governance.js · seed data/lark-governance-tree.json";
          host.appendChild(miss);
          setStatus("GT · tree missing");
        } else {
          setStatus(
            window.__mgLark.report ? window.__mgLark.report() : "GT · tree on"
          );
        }
      })
    );
  }

  function paintVid(into) {
    into.appendChild(
      collapsible("vid-ops", "Vid · stream", true, function (box) {
        var h = document.createElement("p");
        h.className = "drw-hint";
        h.textContent = "ffplay / blank / rail";
        box.appendChild(h);
        var r = row();
        r.appendChild(
          act(
            "SPACEX",
            "hot",
            function () {
              if (window.__mgVideo)
                window.__mgVideo.popBlank(window.__mgVideo.presets.spacex.url);
            },
            { ico: "▶" }
          )
        );
        r.appendChild(
          act(
            "FFPLAY",
            "primary",
            function () {
              if (window.__mgVideo) window.__mgVideo.ffplay();
            },
            { ico: "♫" }
          )
        );
        r.appendChild(
          act(
            "YT-DLP",
            "muted",
            function () {
              if (window.__mgVideo) window.__mgVideo.ytdlp();
            },
            { ico: "⬇" }
          )
        );
        r.appendChild(
          act(
            "OPEN RAIL",
            "ok",
            function () {
              var rail = document.getElementById("mg-vid-rail");
              if (rail) {
                rail.style.display = "flex";
                if (window.__mgVideo) window.__mgVideo.open();
              }
            },
            { ico: "▣" }
          )
        );
        box.appendChild(r);
      })
    );
  }

  function paintBooks(into) {
    into.appendChild(
      collapsible("books-ops", "Books · learn", true, function (box) {
        var h = document.createElement("p");
        h.className = "drw-hint";
        h.textContent = "Living books · Learn · handoff";
        box.appendChild(h);
        var r = row();
        r.appendChild(
          act(
            "LAB",
            "ok",
            function () {
              nav("https://kbatch.ugrad.ai/labs/living-books.html");
            },
            { ico: "📘" }
          )
        );
        r.appendChild(
          act(
            "LEARN",
            "primary",
            function () {
              nav("https://kbatch.ugrad.ai/learn");
            },
            { ico: "▤" }
          )
        );
        r.appendChild(
          act(
            "BEATS→",
            "hot",
            function () {
              if (window.__mgContrail && window.__mgContrail.exportStoryBeats) {
                var b = window.__mgContrail.exportStoryBeats();
                var t = JSON.stringify(b, null, 2);
                if (window.ipc)
                  window.ipc.postMessage(
                    JSON.stringify({ op: "clipboard_copy", text: t })
                  );
                setStatus("beats " + ((b.beats && b.beats.length) || 0));
              }
            },
            { ico: "♪", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "HANDOFF",
            "muted",
            function () {
              nav("https://kbatch.ugrad.ai/handoff/MEMORY-GLASS-KBATCH.md");
            },
            { ico: "↗" }
          )
        );
        box.appendChild(r);
      })
    );
  }

  function paintShell(into) {
    into.appendChild(
      collapsible("shell", "Shell · map · portal", true, function (box) {
        var r = row();
        r.appendChild(
          act(
            "DATA drawer",
            "hot",
            function () {
              if (window.__mgRightDrawer) window.__mgRightDrawer.open("live");
              else setStatus("Right drawer missing");
            },
            { ico: "☰", sub: "Live · Mkt · Inspect · Chat · Grok" }
          )
        );
        r.appendChild(
          act(
            "Mkt →",
            "ok",
            function () {
              if (window.__mgRightDrawer) window.__mgRightDrawer.open("mkt");
            },
            { ico: "▣", sub: "Filmstrip right" }
          )
        );
        r.appendChild(
          act(
            "Portal",
            "primary",
            function () {
              var d = document.getElementById("mg-dragon");
              if (d) {
                d.classList.add("is-open");
                d.__mgUserClosed = false;
              }
            },
            { ico: "◆", sub: "NAV · EYE · MODES · LENS" }
          )
        );
        r.appendChild(
          act(
            "SOLVE",
            "muted",
            function () {
              if (window.__mgLiveSolveHud) window.__mgLiveSolveHud.toggle();
            },
            { ico: "◎", sub: "Stamp-row metrics" }
          )
        );
        box.appendChild(r);
      })
    );
  }

  function unembedLeftStack() {
    try {
      if (window.__mgFloatKb && window.__mgFloatKb.unembed)
        window.__mgFloatKb.unembed();
    } catch (e1) {}
    try {
      if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.unembed)
        window.__mgKeyboardBeats.unembed();
    } catch (e2) {}
    try {
      if (window.__mgMarket && window.__mgMarket.unembed)
        window.__mgMarket.unembed();
    } catch (e3) {}
  }

  function loadStaffEntry(id, label) {
    var B = window.__mgKeyboardBeats;
    if (!B || !B.loadCatalogueId) {
      setStatus("Beats missing · hot reload?");
      return;
    }
    B.open && B.open();
    B.loadCatalogueId(id, function (r) {
      if (r && r.ok)
        setStatus(
          "staff · " +
            (r.title || label || id) +
            " · " +
            (r.notes || 0) +
            "n · " +
            (r.bpm || "") +
            "bpm"
        );
      else setStatus("staff miss · " + (r && r.reason ? r.reason : id));
    });
  }

  function paintStaff(into) {
    into.appendChild(
      collapsible("staff-quick", "Staff · quick picks", true, function (box) {
        var meta = document.createElement("p");
        meta.className = "staff-meta";
        meta.innerHTML =
          "KBatch <b>music staff catalogue</b> — scales · motifs · PD seeds.";
        box.appendChild(meta);
        var quick = document.createElement("div");
        quick.className = "staff-quick";
        function qAct(title, cls, id, sub, ico) {
          quick.appendChild(
            act(
              title,
              cls,
              function () {
                loadStaffEntry(id, title);
              },
              { ico: ico || "♪", sub: sub, keepStatus: true }
            )
          );
        }
        qAct("C Ionian", "primary", "scale-c-ionian", "Major scale", "𝄞");
        qAct("C Blues", "hot", "scale-c-blues", "Hexatonic", "♭");
        qAct("Ode to Joy", "ok", "motif-ode-joy", "PD motif seed", "♫");
        qAct("Twinkle", "ok", "motif-twinkle", "PD motif seed", "✦");
        qAct("Sakura", "primary", "motif-sakura", "World motif", "❀");
        qAct("Bach C", "hot", "motif-bach-c-prelude", "Arpeggio seed", "♭");
        box.appendChild(quick);
      })
    );

    into.appendChild(
      collapsible("staff-browse", "Staff · browse", true, function (box) {
    var kindsHost = document.createElement("div");
    kindsHost.className = "staff-kinds";
    box.appendChild(kindsHost);

    var search = document.createElement("input");
    search.className = "staff-search";
    search.type = "search";
    search.placeholder = "Search scales · chords · motifs · solfege…";
    search.value = staffQuery || "";
    box.appendChild(search);

    var list = document.createElement("div");
    list.className = "staff-list";
    box.appendChild(list);

    var lab = document.createElement("div");
    lab.className = "staff-lab";
    var labA = document.createElement("a");
    labA.href = "https://kbatch.ugrad.ai/labs/music-staff";
    labA.target = "_blank";
    labA.rel = "noopener";
    labA.textContent = "Open lab ↗";
    lab.appendChild(labA);
    var docsA = document.createElement("a");
    docsA.href = "https://kbatch.ugrad.ai/handoff/MUSIC-STAFF-CATALOGUE.md";
    docsA.target = "_blank";
    docsA.rel = "noopener";
    docsA.textContent = "Docs";
    lab.appendChild(docsA);
    var keysBtn = document.createElement("button");
    keysBtn.type = "button";
    keysBtn.textContent = "Keys stack";
    keysBtn.onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      mode = "keys";
      paint();
    };
    lab.appendChild(keysBtn);
    box.appendChild(lab);

    function renderList(entries) {
      list.innerHTML = "";
      if (!entries || !entries.length) {
        var empty = document.createElement("p");
        empty.className = "drw-hint";
        empty.textContent = "No entries · try another kind or refresh seed";
        list.appendChild(empty);
        return;
      }
      entries.slice(0, 80).forEach(function (e) {
        var row = document.createElement("button");
        row.type = "button";
        row.className = "staff-row";
        var tags = (e.tags || []).slice(0, 4).join(" · ");
        row.innerHTML =
          '<span class="st-title">' +
          String(e.title || e.id).replace(/</g, "&lt;") +
          "</span>" +
          '<span class="st-sub">' +
          String(e.id || "") +
          (e.solfege ? " · " + e.solfege : e.modern ? " · " + e.modern : "") +
          "</span>" +
          '<span class="st-tags">' +
          String(e.kind || "") +
          (tags ? " · " + tags : "") +
          (e.rights ? " · " + e.rights : "") +
          "</span>";
        row.onclick = function (ev) {
          if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
          }
          loadStaffEntry(e.id, e.title);
        };
        list.appendChild(row);
      });
    }

    function paintKinds(kinds) {
      kindsHost.innerHTML = "";
      var order = [
        "scale",
        "motif",
        "chord",
        "interval",
        "solfege",
        "rhythm",
        "key-signature",
        "time-signature",
        "dynamic",
        "articulation",
        "clef",
        "geometry-bridge",
      ];
      var seen = {};
      function addChip(k, n) {
        if (seen[k]) return;
        seen[k] = 1;
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = k + (n != null ? " " + n : "");
        if (staffKind === k) b.className = "on";
        b.onclick = function (ev) {
          if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
          }
          staffKind = k;
          refresh();
        };
        kindsHost.appendChild(b);
      }
      addChip("all", null);
      order.forEach(function (k) {
        if (kinds && kinds[k] != null) addChip(k, kinds[k]);
      });
      if (kinds) {
        Object.keys(kinds).forEach(function (k) {
          addChip(k, kinds[k]);
        });
      }
    }

    function refresh() {
      var B = window.__mgKeyboardBeats;
      if (!B) {
        list.innerHTML = '<p class="drw-hint">Beats missing — inject keyboard-beats</p>';
        return;
      }
      function apply() {
        var kinds = (B.catalogueKinds && B.catalogueKinds()) || {};
        paintKinds(kinds);
        var filter = { limit: 80 };
        if (staffKind && staffKind !== "all") filter.kind = staffKind;
        if (staffQuery) filter.q = staffQuery;
        var entries =
          B.listCatalogue ? B.listCatalogue(filter) : [];
        renderList(entries);
        var n = (B.cataloguePack && B.cataloguePack() && B.cataloguePack().entries
          ? B.cataloguePack().entries.length
          : entries.length) || 0;
        setStatus(
          "Staff cat · " +
            n +
            " · " +
            (staffKind || "all") +
            (staffQuery ? " · “" + staffQuery + "”" : "")
        );
      }
      if (B.cataloguePack && B.cataloguePack() && (B.cataloguePack().entries || []).length) {
        apply();
      } else if (B.loadCatalogueSeed) {
        list.innerHTML = '<p class="drw-hint">Loading catalogue…</p>';
        B.loadCatalogueSeed(function (st) {
          if (!st || !st.ok) {
            list.innerHTML =
              '<p class="drw-hint">Catalogue fetch failed · check network / seed</p>';
            setStatus("Staff cat · seed fail");
            return;
          }
          apply();
        });
      } else {
        list.innerHTML = '<p class="drw-hint">No catalogue API</p>';
      }
    }

    var searchTimer = 0;
    search.oninput = function () {
      staffQuery = search.value || "";
      clearTimeout(searchTimer);
      searchTimer = setTimeout(refresh, 120);
    };

    refresh();
      })
    );
  }

  function paintKeys(into) {
    into.appendChild(
      collapsible("keys-actions", "Keys · actions", true, function (box) {
    var acts = document.createElement("div");
    acts.className = "mg-cap-row";
    acts.appendChild(
      act(
        "Type",
        "primary",
        function () {
          if (window.__mgFloatKb) {
            if (window.__mgFloatKb.setMode) window.__mgFloatKb.setMode("type");
            else if (window.__mgFloatKb.launch)
              window.__mgFloatKb.launch({ mode: "type" });
          }
          setStatus("TYPE");
        },
        { ico: "⌨", sub: "QWERTY deck", keepStatus: true }
      )
    );
    acts.appendChild(
      act(
        "Codec",
        "hot",
        function () {
          if (window.__mgFloatKb) {
            if (window.__mgFloatKb.setMode) window.__mgFloatKb.setMode("codec");
            else if (window.__mgFloatKb.launch)
              window.__mgFloatKb.launch({
                mode: "codec",
                codec: "hex",
                text:
                  (window.__mgFloatKb.buffer && window.__mgFloatKb.buffer()) ||
                  "MG",
              });
          }
          setStatus("CODEC");
        },
        { ico: "⌬", sub: "Live feeds", keepStatus: true }
      )
    );
    acts.appendChild(
      act(
        "C major",
        "ok",
        function () {
          loadStaffEntry("scale-c-ionian", "C Ionian");
        },
        { ico: "𝄞", sub: "Staff cat", keepStatus: true }
      )
    );
    acts.appendChild(
      act(
        "Ode Joy",
        "hot",
        function () {
          loadStaffEntry("motif-ode-joy", "Ode to Joy");
        },
        { ico: "♫", sub: "PD motif", keepStatus: true }
      )
    );
    acts.appendChild(
      act(
        "Pop-out",
        "muted",
        function () {
          if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.popOut) {
            window.__mgKeyboardBeats.popOut();
            setStatus("Beats · canvas pop-out");
          } else setStatus("Beats pop-out missing");
        },
        { ico: "↗", sub: "Float beats", keepStatus: true }
      )
    );
    box.appendChild(acts);
      })
    );

    into.appendChild(
      collapsible("keys-stack", "Keys · keyboard · beats", true, function (box) {
    var lab1 = document.createElement("div");
    lab1.className = "mg-drawer-stack-label";
    lab1.id = "mg-drawer-stack-label-kb";
    lab1.textContent = "Keyboard";
    box.appendChild(lab1);
    var kbHost = document.createElement("div");
    kbHost.id = "mg-drawer-kb-host";
    box.appendChild(kbHost);

    var lab2 = document.createElement("div");
    lab2.className = "mg-drawer-stack-label";
    lab2.id = "mg-drawer-stack-label-beats";
    lab2.textContent = "Beats · staff · piano";
    box.appendChild(lab2);
    var beatsHost = document.createElement("div");
    beatsHost.id = "mg-drawer-beats-host";
    box.appendChild(beatsHost);

    var kbOk = false;
    var beatsOk = false;
    try {
      if (window.__mgFloatKb && window.__mgFloatKb.embedInto)
        kbOk = !!window.__mgFloatKb.embedInto(kbHost);
    } catch (eK) {}
    try {
      if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.embedInto)
        beatsOk = !!window.__mgKeyboardBeats.embedInto(beatsHost);
    } catch (eB) {}
    try {
      if (kbOk && beatsOk && window.__mgKeyboardBeats) {
        if (window.__mgKeyboardBeats.requestPaint)
          window.__mgKeyboardBeats.requestPaint(true);
      }
    } catch (eS) {}
    if (!kbOk) {
      kbHost.innerHTML =
        '<p class="drw-hint">Keyboard missing — hot reload?</p>';
    }
    if (!beatsOk) {
      beatsHost.innerHTML =
        '<p class="drw-hint">Beats missing — open after inject</p>';
    }
    setStatus(
      "Keys · " +
        (kbOk ? "keyboard" : "—") +
        " + " +
        (beatsOk ? "piano" : "—") +
        " · synced"
    );
      })
    );
  }

  function paint() {
    if (!body) return;
    unembedLeftStack();
    body.innerHTML = "";
    if (el) el.classList.toggle("keys-mode", mode === "keys");
    try {
      document.documentElement.classList.toggle(
        "mg-left-keys",
        open && mode === "keys"
      );
    } catch (eK) {}
    paintModeRail();
    /* title shows active mode */
    try {
      var ttl = el && el.querySelector(".drw-hd .ttl");
      if (ttl) {
        var M = modeMeta(mode);
        ttl.innerHTML =
          '<span class="dot"></span>Control Center' +
          '<span class="mode-tag">' +
          (M.short || M.label) +
          "</span>";
      }
    } catch (eT) {}

    /* Expand all / Collapse all on every menu tab */
    paintMasterBar(body);

    if (mode === "tools") {
      paintTools(body);
      setStatus("Control Center · Tools");
    } else if (mode === "keys") {
      paintKeys(body);
    } else if (mode === "staff") {
      paintStaff(body);
      setStatus("Staff catalogue · KBatch");
    } else if (mode === "qbit") {
      paintQbit(body);
      setStatus("Qbit");
    } else if (mode === "gt") {
      paintGt(body);
      setStatus("GT · Lark tree");
    } else if (mode === "vid") {
      paintVid(body);
      setStatus("Vid");
    } else if (mode === "books") {
      paintBooks(body);
      setStatus("Books");
    } else if (mode === "shell") {
      paintShell(body);
      setStatus("Shell · left=control");
    }
  }

  function setOpen(on) {
    open = !!on;
    if (el) el.classList.toggle("open", open);
    if (tab) tab.classList.toggle("on", open);
    var scrim = document.getElementById("mg-tools-scrim");
    if (scrim) scrim.classList.toggle("on", open);
    try {
      document.documentElement.classList.toggle("mg-left-open", open);
      document.documentElement.classList.toggle(
        "mg-left-keys",
        open && mode === "keys"
      );
    } catch (e) {}
    if (open) {
      /* sync drop alpha from shell Drop if live */
      try {
        var fa =
          getComputedStyle(document.documentElement).getPropertyValue(
            "--mg-fill-a"
          ) || "";
        var a = parseFloat(fa);
        if (isFinite(a) && a > 0.12 && a < 0.9) {
          el.style.setProperty("--mg-drop-a", String(Math.min(0.55, a * 0.85)));
          el.style.setProperty(
            "--mg-embed-a",
            String(Math.min(0.5, a * 0.75))
          );
        }
      } catch (eA) {}
      paint();
      window.__mgUserChromeTouch = true;
      /* dual-open allowed: right data drawer may stay open alongside */
    } else {
      unembedLeftStack();
      if (el) el.classList.remove("keys-mode");
      paintModeRail(); /* peeks stay on left edge when closed */
    }
    positionModeRail();
    raiseEdges();
    log(VER + " · " + (open ? "open " + mode : "closed · edge peeks"));
  }

  function toggle() {
    setOpen(!open);
  }

  function mount() {
    ensureCss();
    if (document.getElementById("mg-tools-drawer")) {
      try {
        if (window.__mgToolsDrawer && window.__mgToolsDrawer.ver !== VER) {
          [
            "mg-tools-drawer",
            "mg-tools-tab",
            "mg-tools-scrim",
            "mg-tools-mode-rail",
          ].forEach(function (id) {
            var n = document.getElementById(id);
            if (n && n.parentNode) n.parentNode.removeChild(n);
          });
        } else {
          raiseEdges();
          return;
        }
      } catch (e) {
        return;
      }
    }

    var root = chromeRoot();
    var scrim = document.createElement("div");
    scrim.id = "mg-tools-scrim";
    scrim.onclick = function () {
      setOpen(false);
    };
    root.appendChild(scrim);

    el = document.createElement("div");
    el.id = "mg-tools-drawer";
    el.innerHTML =
      '<div class="drw-hd">' +
      '  <div class="ttl"><span class="dot"></span>Control Center' +
      '  <span class="mode-tag">Tools</span></div>' +
      '  <button type="button" id="mg-tools-x" title="Close">×</button>' +
      "</div>" +
      '<div class="drw-tabs-host"></div>' +
      '<div class="drw-body" id="mg-tools-body"></div>' +
      '<div class="drw-status" id="mg-tools-status">Edge peeks · Tools · Keys · Staff · …</div>';
    root.appendChild(el);

    /* Viewport-fixed sibling — outside drawer transform so peeks never clip
     * (mueee history / notepad / reader side peeks stay on-screen always). */
    modeRail = document.createElement("div");
    modeRail.id = "mg-tools-mode-rail";
    modeRail.className = "mg-edge";
    modeRail.setAttribute("role", "tablist");
    modeRail.setAttribute("aria-label", "Control Center modes");
    root.appendChild(modeRail);
    tab = null;

    body = el.querySelector("#mg-tools-body");
    statusEl = el.querySelector("#mg-tools-status");
    el.querySelector("#mg-tools-x").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      setOpen(false);
    };

    if (!window.__mgToolsDrawerEsc) {
      window.__mgToolsDrawerEsc = true;
      document.addEventListener(
        "keydown",
        function (ev) {
          if (ev.key === "Escape" && open) {
            setOpen(false);
            ev.preventDefault();
          }
        },
        true
      );
    }

    paint();
    setOpen(false);
    raiseEdges();
    /* Re-home chrome only when parent is wrong — throttled (no per-scroll DOM churn) */
    var rehomeLast = 0;
    function rehomeChrome(force) {
      var now = Date.now();
      if (!force && now - rehomeLast < 400) return;
      rehomeLast = now;
      var root = chromeRoot();
      [
        "mg-tools-drawer",
        "mg-tools-scrim",
        "mg-tools-mode-rail",
        "mg-mkt-rail",
        "mg-right-drawer",
        "mg-right-scrim",
      ].forEach(function (id) {
        var n = document.getElementById(id);
        if (n && n.parentNode !== root) root.appendChild(n);
      });
    }
    rehomeChrome(true);
    if (!window.__mgChromeRehomeBound) {
      window.__mgChromeRehomeBound = true;
      window.addEventListener(
        "scroll",
        function () {
          rehomeChrome(false);
        },
        { passive: true, capture: true }
      );
      window.addEventListener(
        "resize",
        function () {
          positionModeRail();
        },
        { passive: true }
      );
    }
    setTimeout(function () {
      positionModeRail();
      raiseEdges();
    }, 400);
    setTimeout(raiseEdges, 1200);
    log(VER + " · edge peeks ready (mueee-style)");
  }

  window.__mgToolsDrawer = {
    ver: VER,
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: toggle,
    isOpen: function () {
      return open;
    },
    /** Switch mode; opens drawer if closed */
    setMode: function (m) {
      openMode(m || "tools");
    },
    /** One-tap open a mode from edge peek / external callers */
    openMode: openMode,
    mode: function () {
      return mode;
    },
    paint: paint,
    raiseEdges: raiseEdges,
    report: function () {
      return VER + " open=" + open + " mode=" + mode;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    setTimeout(mount, 80);
  }
})();
