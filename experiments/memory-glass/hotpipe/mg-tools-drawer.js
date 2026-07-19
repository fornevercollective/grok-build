/* Memory Glass · LEFT TOOLS DRAWER
 * CTRL Control Center parity: mode tabs + collapsible sections + act tiles.
 * Tab docks to drawer wall and rides open/close.
 * VER: mg-tools-drawer-v26-bloch-live
 * Keys = keyboard + maze/gsplat/contrail. Staff = beats + catalogue lab.
 * Solve embeds live dual-solve Bloch in drawer host.
 * Phone cam page-axis must NOT lean chrome — freeze body transform when open.
 */
(function () {
  "use strict";
  var VER = "mg-tools-drawer-v26-bloch-live";
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
  /* Left control · same quiet vertical tab language as DATA (no emoji / neon).
   * Stack of writing-mode:vertical-rl labels on the left edge. */
  var MODES = [
    { id: "tools", label: "Tools", short: "Tools" },
    { id: "keys", label: "Keys", short: "Keys" },
    { id: "staff", label: "Staff", short: "Staff" },
    { id: "qbit", label: "Qbit", short: "Qbit" },
    { id: "gt", label: "GT", short: "GT" },
    { id: "vid", label: "Vid", short: "Vid" },
    { id: "books", label: "Books", short: "Books" },
    { id: "shell", label: "Shell", short: "Shell" },
  ];
  var staffKind = "scale";
  var staffQuery = "";

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "drawer");
    } catch (e) {}
  }

  var _raiseLast = 0;
  function raiseEdges() {
    try {
      /* freeze during WebGrid play — z-index storms caused shake */
      if (
        window.__mgWebgridPlayBusy ||
        document.documentElement.classList.contains("mg-webgrid-playing")
      )
        return;
      var now = Date.now();
      if (now - _raiseLast < 800) return;
      _raiseLast = now;
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
      /*
       * Phone / face track enables page-axis lean on <body>. Chrome mounts on <html>
       * but body lean makes menus feel like they swim. Freeze body while drawers open
       * or while camera drives viewRay (unless __mgPageAxisWanted).
       */
      "html.mg-left-open body,html.mg-right-open body,html.mg-drawer-open body,",
      "html.mg-chrome-stable body{",
      "  transform:none!important;will-change:auto!important}",
      "html > #mg-tools-drawer,html > #mg-tools-scrim,html > #mg-tools-mode-rail,",
      "html > #mg-right-drawer,html > #mg-right-scrim,html > #mg-right-tab{",
      "  filter:none!important;perspective:none!important}",
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
      "#mg-drawer-kb-host,#mg-drawer-beats-host,#mg-drawer-maze-host,",
      "#mg-drawer-bloch-host{",
      "  display:flex;flex-direction:column;flex:0 0 auto;",
      "  width:100%;min-height:0;margin:0 0 12px;",
      "  border-radius:16px;overflow:visible}",
      "#mg-drawer-kb-host{min-height:300px}",
      "#mg-drawer-beats-host,#mg-staff-beats-host{min-height:220px}",
      "#mg-drawer-maze-host{min-height:240px}",
      "#mg-drawer-bloch-host{min-height:200px}",
      /* Keys stack is the main body — never hide behind collapsible chrome */
      "#mg-tools-drawer .mg-keys-stack{padding:0 0 72px}",
      "#mg-tools-drawer .mg-keys-stack .mg-drawer-stack-label{",
      "  font:600 11px/1 -apple-system,system-ui;letter-spacing:0.02em;text-transform:none;",
      "  color:rgba(255,255,255,0.42);margin:10px 2px 8px}",
      "#mg-drawer-stack-label,.mg-drawer-stack-label{",
      "  font:600 11px/1 -apple-system,system-ui;letter-spacing:0.02em;text-transform:none;",
      "  color:rgba(255,255,255,0.42);margin:10px 2px 8px}",
      ".mg-drawer-stack-label:first-of-type{margin-top:6px}",
      "#mg-tools-drawer.keys-mode .mg-cap-row{margin-bottom:6px}",
      "#mg-tools-drawer.keys-mode .drw-body{padding-bottom:80px!important}",
      "#mg-tools-drawer .staff-list{",
      "  display:flex;flex-direction:column;gap:0;max-height:min(52vh,480px);",
      "  overflow-y:auto;padding-bottom:8px}",
      "#mg-tools-drawer .staff-lab{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}",
      /* ── Quiet vertical mode tabs (same language as DATA tab) ──
       * writing-mode vertical-rl · monochrome glass · type only · no icons/neon.
       * Closed → left edge. Open → rides drawer wall. */
      "html > #mg-tools-mode-rail,html.mg-webgrid-play > #mg-tools-mode-rail{",
      "  position:fixed!important;top:50%;right:auto;bottom:auto;",
      "  left:0!important;z-index:2147483647!important;pointer-events:auto!important;",
      "  transform:translateY(-50%)!important;",
      "  display:flex!important;flex-direction:column;gap:0;",
      "  padding:0;margin:0;visibility:visible!important;opacity:1!important;",
      "  width:auto!important;min-width:28px!important;",
      "  max-height:min(92vh,740px);overflow-y:auto;overflow-x:visible;",
      "  -webkit-overflow-scrolling:touch;",
      "  transition:left .22s cubic-bezier(.2,.9,.2,1);",
      "  backface-visibility:hidden}",
      "html.mg-left-open > #mg-tools-mode-rail{",
      "  left:var(--mg-tools-w,min(340px,88vw))!important}",
      "html.mg-left-open.mg-left-keys > #mg-tools-mode-rail{",
      "  left:var(--mg-tools-w,min(480px,94vw))!important}",
      "#mg-tools-mode-rail button,html.mg-webgrid-play #mg-tools-mode-rail button{",
      "  appearance:none;cursor:pointer;pointer-events:auto!important;",
      "  display:block!important;box-sizing:border-box;visibility:visible!important;",
      "  writing-mode:vertical-rl;text-orientation:mixed;",
      "  padding:16px 8px;margin:0;",
      /* WKWebView: never allow vertical-rl tabs to collapse to 0×0 */
      "  min-width:28px!important;min-height:52px!important;width:28px;",
      "  border:1px solid rgba(255,255,255,0.12);border-left:0;",
      "  border-radius:0;",
      "  background:rgba(36,36,40,0.92)!important;",
      "  backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);",
      "  box-shadow:4px 0 16px rgba(0,0,0,0.28);",
      "  color:rgba(255,255,255,0.88)!important;",
      "  font:600 10px/1 -apple-system,BlinkMacSystemFont,system-ui;",
      "  letter-spacing:0.1em;text-transform:uppercase;",
      "  white-space:nowrap;",
      "  transition:background .12s,color .12s}",
      "#mg-tools-mode-rail button:first-child{border-radius:0 10px 0 0}",
      "#mg-tools-mode-rail button:last-child{border-radius:0 0 10px 0}",
      "#mg-tools-mode-rail button + button{border-top:0}",
      "#mg-tools-mode-rail button .ico{display:none!important}",
      "#mg-tools-mode-rail button .lbl{",
      "  font:inherit;letter-spacing:inherit;text-transform:inherit;",
      "  color:inherit;white-space:nowrap;display:inline-block}",
      "#mg-tools-mode-rail button:hover{",
      "  background:rgba(48,48,54,0.96)!important;color:#fff!important}",
      "#mg-tools-mode-rail button:active{background:rgba(50,52,60,0.96)!important}",
      "#mg-tools-mode-rail button.on{",
      "  background:rgba(50,52,60,0.98)!important;color:#fff!important;",
      "  box-shadow:4px 0 18px rgba(0,0,0,0.32),inset 0 0 0 1px rgba(255,255,255,0.08)}",
      "html.mg-left-open #mg-tools-mode-rail button.on{",
      "  background:rgba(50,52,60,0.98)!important;color:#fff!important}",
      /* drawer + scrim always above webgrid canvas */
      "html.mg-webgrid-play > #mg-tools-drawer,html.mg-webgrid-play > #mg-tools-scrim,",
      "html > #mg-tools-drawer,html > #mg-tools-scrim{",
      "  z-index:2147483635!important;pointer-events:auto!important;visibility:visible!important}",
      /* hide legacy single TOOLS tab if present */
      "#mg-tools-tab{display:none!important}",
      /* header chips retired — vertical mode tabs are primary */
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
      /* keys-stack is always-visible (not collapsible) */
      "staff-quick",
      "staff-lab",
      "staff-browse",
      "qbit-ops",
      "qbit-stack",
      "gt-ops",
      "gt-flow",
      "gt-tree",
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

  /** Quiet vertical tabs — same spine as DATA, one label per mode */
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
      b.title =
        M.label +
        (open && mode === M.id ? " · again to close" : " · open");
      /* type only — no icons / color chips */
      b.innerHTML =
        '<span class="lbl">' + (M.short || M.label).toUpperCase() + "</span>";
      b.style.cssText =
        "appearance:none;cursor:pointer;pointer-events:auto;" +
        "writing-mode:vertical-rl;padding:16px 8px;margin:0;" +
        "min-width:28px;min-height:52px;width:28px;box-sizing:border-box;" +
        "border:1px solid rgba(255,255,255,0.12);border-left:0;" +
        "background:rgba(36,36,40,0.94);color:rgba(255,255,255,0.9);" +
        "font:600 10px/1 -apple-system,system-ui;letter-spacing:0.1em;" +
        "text-transform:uppercase;white-space:nowrap;";
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        window.__mgUserChromeTouch = true;
        if (open && mode === M.id) {
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
        /* Live dual-solve Bloch sphere (path→gate) — always visible in side menu */
        var blochHost = document.createElement("div");
        blochHost.id = "mg-drawer-bloch-host";
        box.appendChild(blochHost);
        function tryEmbedBloch() {
          try {
            if (window.__mgBlochSolve && window.__mgBlochSolve.embedInto) {
              window.__mgBlochSolve.setEnabled(true);
              return !!window.__mgBlochSolve.embedInto(blochHost);
            }
          } catch (eB) {}
          return false;
        }
        if (!tryEmbedBloch()) {
          blochHost.innerHTML =
            '<p class="drw-hint">Live Bloch loading… · path→gate dual-solve</p>';
          var tries = 0;
          var bootB = setInterval(function () {
            tries++;
            if (tryEmbedBloch() || tries > 40) {
              clearInterval(bootB);
              if (!window.__mgBlochSolve || !window.__mgBlochSolve.isEmbedded || !window.__mgBlochSolve.isEmbedded()) {
                blochHost.innerHTML =
                  '<p class="drw-hint">Bloch missing — inject bloch-solve-bus.js · ⌘⇧R</p>';
              }
            }
          }, 120);
        }

        var r = row();
        r.appendChild(
          act(
            "Bloch",
            "primary",
            function () {
              if (window.__mgBlochSolve) {
                window.__mgBlochSolve.setEnabled(true);
                /* prefer re-embed in drawer if host empty; also open float for pop-out */
                var host = document.getElementById("mg-drawer-bloch-host");
                if (host && window.__mgBlochSolve.embedInto)
                  window.__mgBlochSolve.embedInto(host);
                if (window.__mgBlochSolve.toggle) window.__mgBlochSolve.toggle();
                else if (window.__mgBlochSolve.open) window.__mgBlochSolve.open();
                setStatus(
                  window.__mgBlochSolve.report
                    ? window.__mgBlochSolve.report()
                    : "Bloch"
                );
              } else setStatus("Bloch missing");
            },
            { ico: "◉", sub: "Live · float pop-out", keepStatus: true }
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
    /* Quick actions always first for one-tap ugrad-r0 / live */
    into.appendChild(
      collapsible("qbit-ops", "Qbit · run", true, function (box) {
        var h = document.createElement("p");
        h.className = "drw-hint";
        h.textContent =
          "Bloch + data viz above · tensor IN/OUT · ugrad-r0";
        box.appendChild(h);
        var r = row();
        r.appendChild(
          act(
            "DESK",
            "primary",
            function () {
              if (window.__mgAgentDesk && window.__mgAgentDesk.open) {
                window.__mgAgentDesk.open();
                setStatus(window.__mgAgentDesk.report());
              } else setStatus("Agent Desk missing — ⌘⇧R");
            },
            { ico: "α", sub: "αβγδ multi-tier", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "SITREP",
            "ok",
            function () {
              if (window.__mgQbitRace && window.__mgQbitRace.publish) {
                var s = window.__mgQbitRace.publish({});
                setStatus(s.line || window.__mgQbitRace.report());
              } else setStatus("race sitrep missing — ⌘⇧R");
            },
            { ico: "◉", sub: "core-race meters", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "LIVE",
            "hot",
            function () {
              if (window.__mgQbitStack && window.__mgQbitStack.runLive) {
                window.__mgQbitStack.runLive(true);
                setStatus(window.__mgQbitStack.report());
              } else setStatus("qbit stack missing — ⌘⇧R");
            },
            { ico: "▶", sub: "Tensor trajectory", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "STEP",
            "ok",
            function () {
              if (window.__mgQbitStack && window.__mgQbitStack.stepIO) {
                window.__mgQbitStack.stepIO({});
                setStatus(window.__mgQbitStack.report());
              } else setStatus("qbit stack missing");
            },
            { ico: "↦", sub: "One hop I/O", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "ugrad-r0",
            "primary",
            function () {
              if (window.__mgQbitStack && window.__mgQbitStack.openUgradR0)
                window.__mgQbitStack.openUgradR0();
              else if (window.__mgUgrad && window.__mgUgrad.openR0)
                window.__mgUgrad.openR0();
              else nav("https://mueee.qbitos.ai/ugrad-r0.html");
              setStatus("ugrad-r0");
            },
            { ico: "μ", sub: "Full R0 model", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Tensor",
            "hot",
            function () {
              if (window.__mgQbitStack && window.__mgQbitStack.openUgradTensor)
                window.__mgQbitStack.openUgradTensor();
              else nav("https://mueee.qbitos.ai/ugrad-r0.html#tensor");
              setStatus("ugrad-r0#tensor");
            },
            { ico: "▣", sub: "microtorch", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "PAUSE",
            "muted",
            function () {
              if (window.__mgQbitStack && window.__mgQbitStack.runLive)
                window.__mgQbitStack.runLive(false);
              setStatus("trajectory paused");
            },
            { ico: "⏸", sub: "Stop live", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "EXPORT",
            "ok",
            function () {
              if (window.__mgQbitStack && window.__mgQbitStack.exportSnap)
                window.__mgQbitStack.exportSnap();
              setStatus("qbit trajectory export");
            },
            { ico: "↗", sub: "JSON stack", keepStatus: true }
          )
        );
        box.appendChild(r);
      })
    );

    /* Always-visible Bloch + data visualizer + gates (above/around Qbit) */
    into.appendChild(
      collapsible("qbit-stack", "Qbit · Bloch · data · gates", true, function (box) {
        var host = document.createElement("div");
        host.id = "mg-drawer-qbit-stack-host";
        box.appendChild(host);
        function tryEmbed() {
          try {
            if (window.__mgQbitStack && window.__mgQbitStack.embedInto)
              return !!window.__mgQbitStack.embedInto(host);
          } catch (e) {}
          return false;
        }
        if (!tryEmbed()) {
          host.innerHTML =
            '<p class="drw-hint">Loading Qbit stack (Bloch + tensor viz)…</p>';
          function boot(cb) {
            if (window.__mgQbitStack) {
              if (cb) cb(true);
              return;
            }
            var urls = [
              "hotpipe/qbit-stack-plane.js",
              "./qbit-stack-plane.js",
            ];
            var i = 0;
            function next() {
              if (i >= urls.length) {
                if (cb) cb(false);
                return;
              }
              var s = document.createElement("script");
              s.src = urls[i++] + "?v=" + Date.now();
              s.onload = function () {
                if (cb) cb(!!window.__mgQbitStack);
              };
              s.onerror = next;
              (document.head || document.documentElement).appendChild(s);
            }
            next();
          }
          boot(function (ok) {
            if (!ok || !tryEmbed()) {
              host.innerHTML =
                '<p class="drw-hint">Qbit stack missing — inject qbit-stack-plane.js · ⌘⇧R</p>';
            } else {
              setStatus(
                window.__mgQbitStack.report
                  ? window.__mgQbitStack.report()
                  : "Qbit stack on"
              );
            }
          });
        } else {
          setStatus(
            window.__mgQbitStack.report
              ? window.__mgQbitStack.report()
              : "Qbit · Bloch + data"
          );
        }
      })
    );
  }

  function paintGt(into) {
    into.appendChild(
      collapsible("gt-ops", "GT · actions", true, function (box) {
        var h = document.createElement("p");
        h.className = "drw-hint";
        h.textContent =
          "Governance · hop speed · color flow · IP bring-up · popup guard";
        box.appendChild(h);
        var r = row();
        r.appendChild(
          act(
            "SPEED",
            "hot",
            function () {
              if (window.__mgGtFlow && window.__mgGtFlow.runSpeedTest) {
                setStatus("GT · speed test…");
                window.__mgGtFlow.runSpeedTest({}, function (res) {
                  setStatus(
                    res && res.ok
                      ? window.__mgGtFlow.report()
                      : "GT · speed busy/fail"
                  );
                });
              } else setStatus("GT flow missing — hot reload");
            },
            { ico: "⚡", sub: "All hops / edges", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "IP tools",
            "ok",
            function () {
              if (window.__mgGtFlow && window.__mgGtFlow.collectIpTools) {
                window.__mgGtFlow.collectIpTools();
                if (window.__mgGtFlow.paint) window.__mgGtFlow.paint();
                setStatus("GT · IP / connection");
              } else setStatus("GT flow missing");
            },
            { ico: "⌘", sub: "LAN · net · storage", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Popup ON",
            "warn",
            function () {
              if (window.__mgGtFlow && window.__mgGtFlow.setPopupEnabled) {
                var on = true;
                try {
                  on = !(
                    window.__mgGtFlow.state &&
                    window.__mgGtFlow.state.popup &&
                    window.__mgGtFlow.state.popup.enabled
                  );
                } catch (eP) {}
                window.__mgGtFlow.setPopupEnabled(on);
                setStatus("popup mitigation " + (on ? "ON" : "OFF"));
              } else setStatus("popup guard missing");
            },
            { ico: "🛡", sub: "open / flood / _blank", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "TICK",
            "muted",
            function () {
              if (window.__mgLark) window.__mgLark.tick();
              setStatus(window.__mgLark ? window.__mgLark.report() : "gt");
            },
            { ico: "⏱", sub: "Epoch", keepStatus: true }
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
            "EXPORT",
            "hot",
            function () {
              if (window.__mgGtFlow && window.__mgGtFlow.exportFlow)
                window.__mgGtFlow.exportFlow();
              if (window.__mgLark) window.__mgLark.exportSnapshot();
              setStatus("gt flow + tree snapshot");
            },
            { ico: "↗", sub: "Flow + governance", keepStatus: true }
          )
        );
        box.appendChild(r);
      })
    );

    /* Flow plane always visible — speed graph + hop table + IP + popup */
    into.appendChild(
      collapsible("gt-flow", "GT · flow · speed · hops", true, function (box) {
        var host = document.createElement("div");
        host.id = "mg-drawer-gt-flow-host";
        box.appendChild(host);
        function tryEmbed() {
          var ok = false;
          try {
            if (window.__mgGtFlow && window.__mgGtFlow.embedInto)
              ok = !!window.__mgGtFlow.embedInto(host);
          } catch (eF) {}
          if (ok) {
            setStatus(
              window.__mgGtFlow.report
                ? window.__mgGtFlow.report()
                : "GT · flow on"
            );
            return true;
          }
          return false;
        }
        if (!tryEmbed()) {
          host.innerHTML =
            '<p class="drw-hint">Loading GT flow plane…</p>';
          function boot(cb) {
            if (window.__mgLarkEnsureGtFlow) {
              window.__mgLarkEnsureGtFlow(cb);
              return;
            }
            /* direct script bootstrap */
            var s = document.createElement("script");
            s.src = "hotpipe/gt-flow-plane.js?v=" + Date.now();
            s.onload = function () {
              if (cb) cb(!!window.__mgGtFlow);
            };
            s.onerror = function () {
              if (cb) cb(false);
            };
            (document.head || document.documentElement).appendChild(s);
          }
          boot(function (ok) {
            if (!ok || !tryEmbed()) {
              host.innerHTML =
                '<p class="drw-hint">GT flow missing — inject gt-flow-plane.js · ⌘⇧R / rebuild</p>';
            }
          });
        }
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
            (window.__mgGtFlow && window.__mgGtFlow.report
              ? window.__mgGtFlow.report() + " · "
              : "") +
              (window.__mgLark.report ? window.__mgLark.report() : "GT · tree on")
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
    /* Only park left-owned embeds. NEVER touch __mgMarket — it lives in the
     * right DATA drawer; unembedding it empties Mkt while the rail is hidden
     * under html.mg-dual-drawer (display:none).
     * Beats now live under Staff; maze under Keys. */
    try {
      if (window.__mgFloatKb && window.__mgFloatKb.unembed)
        window.__mgFloatKb.unembed();
    } catch (e1) {}
    try {
      if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.unembed)
        window.__mgKeyboardBeats.unembed();
    } catch (e2) {}
    try {
      if (window.__mgMemoryMaze && window.__mgMemoryMaze.unembed)
        window.__mgMemoryMaze.unembed();
    } catch (e3) {}
    try {
      if (window.__mgStaffLab && window.__mgStaffLab.unembedBeats)
        window.__mgStaffLab.unembedBeats();
    } catch (e4) {}
    try {
      if (window.__mgBlochSolve && window.__mgBlochSolve.unembed)
        window.__mgBlochSolve.unembed();
    } catch (e5) {}
  }

  function loadStaffEntry(id, label) {
    /* Prefer full staff lab (chromatic · transpose · research · playalong) */
    if (window.__mgStaffLab && window.__mgStaffLab.loadEntry) {
      window.__mgStaffLab.loadEntry(id, { play: true });
      setStatus(
        window.__mgStaffLab.report
          ? window.__mgStaffLab.report()
          : "staff · " + (label || id)
      );
      return;
    }
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
      collapsible("staff-quick", "Staff · lab run", true, function (box) {
        var meta = document.createElement("p");
        meta.className = "staff-meta";
        meta.innerHTML =
          "KBatch <b>music-staff</b> twin · <b>note wheel L1–L5</b> (pitch pipe · Co5 · degree · phrase) · transpose · playalong.";
        box.appendChild(meta);
        var r = row();
        r.appendChild(
          act(
            "Pipe L1",
            "hot",
            function () {
              if (window.__mgStaffLab && window.__mgStaffLab.setWheelLevel)
                window.__mgStaffLab.setWheelLevel(1);
              else setStatus("staff lab missing — ⌘⇧R");
            },
            { ico: "○", sub: "Pitch pipe", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Co5 L3",
            "ok",
            function () {
              if (window.__mgStaffLab && window.__mgStaffLab.setWheelLevel)
                window.__mgStaffLab.setWheelLevel(3);
              else setStatus("staff lab missing — ⌘⇧R");
            },
            { ico: "↻", sub: "Transpose keys", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Phrase L5",
            "primary",
            function () {
              if (window.__mgStaffLab && window.__mgStaffLab.setWheelLevel)
                window.__mgStaffLab.setWheelLevel(5);
              else setStatus("staff lab missing — ⌘⇧R");
            },
            { ico: "♫", sub: "Build phrase", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Playalong",
            "hot",
            function () {
              if (window.__mgStaffLab && window.__mgStaffLab.startPlayalong)
                window.__mgStaffLab.startPlayalong();
              else setStatus("staff lab missing — ⌘⇧R");
            },
            { ico: "▶", sub: "Scholarly assist", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Chromatic",
            "ok",
            function () {
              if (window.__mgStaffLab && window.__mgStaffLab.loadEntry)
                window.__mgStaffLab.loadEntry("scale-c-chromatic", {
                  play: true,
                });
              else loadStaffEntry("scale-c-chromatic", "Chromatic");
            },
            { ico: "♯", sub: "12-TET chart", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "T+0",
            "primary",
            function () {
              if (window.__mgStaffLab && window.__mgStaffLab.setTranspose)
                window.__mgStaffLab.setTranspose(0);
              setStatus("transpose reset");
            },
            { ico: "T", sub: "Reset transpose", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Lab ↗",
            "muted",
            function () {
              nav("https://kbatch.ugrad.ai/labs/music-staff");
            },
            { ico: "☰", sub: "kbatch staff", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "C Ionian",
            "primary",
            function () {
              if (window.__mgStaffLab && window.__mgStaffLab.loadEntry)
                window.__mgStaffLab.loadEntry("scale-c-ionian", { play: true });
              else loadStaffEntry("scale-c-ionian", "C Ionian");
            },
            { ico: "𝄞", sub: "Major", keepStatus: true }
          )
        );
        r.appendChild(
          act(
            "Ode Joy",
            "ok",
            function () {
              if (window.__mgStaffLab && window.__mgStaffLab.loadEntry)
                window.__mgStaffLab.loadEntry("motif-ode-joy", { play: true });
              else loadStaffEntry("motif-ode-joy", "Ode to Joy");
            },
            { ico: "♫", sub: "PD motif", keepStatus: true }
          )
        );
        box.appendChild(r);
      })
    );

    /* Full lab: chromatic · transpose · research · playalong · beats */
    into.appendChild(
      collapsible("staff-lab", "Staff · beats · chromatic · research", true, function (box) {
        var host = document.createElement("div");
        host.id = "mg-drawer-staff-lab-host";
        box.appendChild(host);
        function tryEmbed() {
          try {
            if (window.__mgStaffLab && window.__mgStaffLab.embedInto)
              return !!window.__mgStaffLab.embedInto(host);
          } catch (e) {}
          return false;
        }
        if (!tryEmbed()) {
          host.innerHTML =
            '<p class="drw-hint">Loading staff lab…</p>';
          var s = document.createElement("script");
          s.src = "hotpipe/staff-lab-plane.js?v=" + Date.now();
          s.onload = function () {
            if (!tryEmbed())
              host.innerHTML =
                '<p class="drw-hint">Staff lab missing — inject staff-lab-plane.js · ⌘⇧R</p>';
            else
              setStatus(
                window.__mgStaffLab.report
                  ? window.__mgStaffLab.report()
                  : "staff lab on"
              );
          };
          s.onerror = function () {
            host.innerHTML =
              '<p class="drw-hint">Staff lab missing — ⌘⇧R / rebuild</p>';
          };
          (document.head || document.documentElement).appendChild(s);
        } else {
          setStatus(
            window.__mgStaffLab.report
              ? window.__mgStaffLab.report()
              : "Staff lab"
          );
        }
      })
    );

    into.appendChild(
      collapsible("staff-browse", "Staff · browse catalogue", true, function (box) {
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
    /* Actions stay collapsible; main stack is always visible (Collapse all
     * used to leave an empty Keys pane — felt broken). */
    secState["keys-actions"] =
      secState["keys-actions"] == null ? true : secState["keys-actions"];
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
                if (window.__mgFloatKb.setMode)
                  window.__mgFloatKb.setMode("type");
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
                if (window.__mgFloatKb.setMode)
                  window.__mgFloatKb.setMode("codec");
                else if (window.__mgFloatKb.launch)
                  window.__mgFloatKb.launch({
                    mode: "codec",
                    codec: "hex",
                    text:
                      (window.__mgFloatKb.buffer &&
                        window.__mgFloatKb.buffer()) ||
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
            "Maze",
            "ok",
            function () {
              if (window.__mgMemoryMaze) {
                if (window.__mgMemoryMaze.open) window.__mgMemoryMaze.open();
                setStatus(
                  window.__mgMemoryMaze.report
                    ? window.__mgMemoryMaze.report()
                    : "maze"
                );
              } else setStatus("maze missing");
            },
            { ico: "⬡", sub: "Gsplat space", keepStatus: true }
          )
        );
        acts.appendChild(
          act(
            "Contrail",
            "hot",
            function () {
              if (window.__mgContrail) {
                if (window.__mgContrail.setFlow)
                  window.__mgContrail.setFlow(true);
                if (window.__mgContrail.setOverlay)
                  window.__mgContrail.setOverlay(true);
                setStatus(
                  window.__mgContrail.report
                    ? window.__mgContrail.report()
                    : "contrail on"
                );
              } else setStatus("contrail missing");
            },
            { ico: "〜", sub: "Path → maze", keepStatus: true }
          )
        );
        acts.appendChild(
          act(
            "Staff →",
            "primary",
            function () {
              mode = "staff";
              paint();
              setStatus("Staff · beats + catalogue");
            },
            { ico: "𝄞", sub: "Beats live here", keepStatus: true }
          )
        );
        acts.appendChild(
          act(
            "Pack",
            "muted",
            function () {
              if (window.__mgMemoryMaze && window.__mgMemoryMaze.cyclePack) {
                var p = window.__mgMemoryMaze.cyclePack();
                setStatus("maze pack · " + (p && p.id ? p.id : "?"));
              }
            },
            { ico: "♫", sub: "Install rain", keepStatus: true }
          )
        );
        acts.appendChild(
          act(
            "Mkt →",
            "hot",
            function () {
              if (window.__mgRightDrawer)
                window.__mgRightDrawer.open("mkt");
              else if (window.__mgMarket && window.__mgMarket.open)
                window.__mgMarket.open();
              setStatus("DATA · Mkt");
            },
            { ico: "📈", sub: "Market filmstrip", keepStatus: true }
          )
        );
        box.appendChild(acts);
      })
    );

    /* Always-visible stack: Maze/gsplat/contrail (where beats used to be) + keyboard */
    var stack = document.createElement("div");
    stack.className = "mg-keys-stack";
    stack.setAttribute("data-sec", "keys-stack");

    var labM = document.createElement("div");
    labM.className = "mg-drawer-stack-label";
    labM.id = "mg-drawer-stack-label-maze";
    labM.textContent = "Maze · gsplat · contrails";
    stack.appendChild(labM);
    var mazeHost = document.createElement("div");
    mazeHost.id = "mg-drawer-maze-host";
    stack.appendChild(mazeHost);

    var lab1 = document.createElement("div");
    lab1.className = "mg-drawer-stack-label";
    lab1.id = "mg-drawer-stack-label-kb";
    lab1.textContent = "Keyboard";
    stack.appendChild(lab1);
    var kbHost = document.createElement("div");
    kbHost.id = "mg-drawer-kb-host";
    stack.appendChild(kbHost);

    into.appendChild(stack);

    function doEmbed() {
      var kbOk = false;
      var mazeOk = false;
      try {
        if (window.__mgMemoryMaze && window.__mgMemoryMaze.embedInto)
          mazeOk = !!window.__mgMemoryMaze.embedInto(mazeHost);
        else if (window.__mgMemoryMaze && window.__mgMemoryMaze.open) {
          window.__mgMemoryMaze.open();
          mazeOk = true;
          mazeHost.innerHTML =
            '<p class="drw-hint">Maze float open · embed API pending hot reload</p>';
        }
      } catch (eM) {}
      try {
        if (window.__mgFloatKb && window.__mgFloatKb.embedInto)
          kbOk = !!window.__mgFloatKb.embedInto(kbHost);
      } catch (eK) {}
      if (!mazeOk) {
        mazeHost.innerHTML =
          '<p class="drw-hint">Maze missing — inject memory-maze-gsplat · contrail feeds pts</p>';
      }
      if (!kbOk) {
        kbHost.innerHTML =
          '<p class="drw-hint">Keyboard missing — hot reload?</p>';
      }
      setStatus(
        "Keys · " +
          (mazeOk ? "maze/gsplat" : "—") +
          " + " +
          (kbOk ? "keyboard" : "—") +
          " · beats→Staff"
      );
      return kbOk || mazeOk;
    }
    if (!doEmbed()) {
      setTimeout(function () {
        if (!document.getElementById("mg-drawer-kb-host")) return;
        doEmbed();
      }, 280);
    }
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

  function syncChromeStable() {
    try {
      var de = document.documentElement;
      if (!de) return;
      var left = de.classList.contains("mg-left-open");
      var right = de.classList.contains("mg-right-open");
      var any = left || right || de.classList.contains("mg-drawer-mode");
      de.classList.toggle("mg-drawer-open", any);
      /*
       * Default: freeze page-axis while camera is driving viewRay, unless user
       * explicitly opted into live page lean (__mgPageAxisWanted = true).
       */
      var ray = window.LabViewRay;
      var cam =
        ray &&
        (ray.source === "camera" || de.classList.contains("mg-track-lock"));
      var forceAxis = !!window.__mgPageAxisWanted;
      de.classList.toggle("mg-chrome-stable", !!(cam && !forceAxis) || any);
      /* Zero lean vars so residual CSS can't drift peeks */
      if (de.classList.contains("mg-chrome-stable")) {
        de.style.setProperty("--mg-px", "0px");
        de.style.setProperty("--mg-py", "0px");
        de.style.setProperty("--mg-pz", "0px");
        de.style.setProperty("--mg-rx", "0deg");
        de.style.setProperty("--mg-ry", "0deg");
        de.style.setProperty("--mg-sc", "1");
      }
    } catch (eS) {}
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
      syncChromeStable();
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

  function forceRemountNodes() {
    [
      "mg-tools-drawer",
      "mg-tools-tab",
      "mg-tools-scrim",
      "mg-tools-mode-rail",
    ].forEach(function (id) {
      var n = document.getElementById(id);
      if (n && n.parentNode) n.parentNode.removeChild(n);
    });
    el = null;
    modeRail = null;
    body = null;
    statusEl = null;
    tab = null;
  }

  function mount() {
    ensureCss();
    if (document.getElementById("mg-tools-drawer")) {
      try {
        var needRemount =
          !window.__mgToolsDrawer ||
          window.__mgToolsDrawer.ver !== VER ||
          !document.getElementById("mg-tools-mode-rail");
        /* zero-box heal: mode rail exists but not paint-sized */
        if (!needRemount) {
          var rail0 = document.getElementById("mg-tools-mode-rail");
          if (rail0) {
            var rr = rail0.getBoundingClientRect();
            if (rr.width < 4 || rr.height < 20) needRemount = true;
          } else needRemount = true;
        }
        if (needRemount) {
          forceRemountNodes();
        } else {
          ensureCss();
          paintModeRail();
          positionModeRail();
          raiseEdges();
          return;
        }
      } catch (e) {
        try {
          forceRemountNodes();
        } catch (e2) {}
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
      '<div class="drw-status" id="mg-tools-status">Control Center</div>';
    /* Critical geometry inline — WKWebView WebGrid CSS often starves drawers */
    el.style.cssText =
      "position:fixed!important;left:0!important;top:0!important;bottom:0!important;" +
      "width:min(340px,88vw)!important;z-index:2147483635!important;" +
      "pointer-events:auto!important;display:flex!important;flex-direction:column!important;" +
      "visibility:visible!important;box-sizing:border-box!important;";
    root.appendChild(el);

    /* Viewport-fixed sibling — outside drawer transform so peeks never clip */
    modeRail = document.createElement("div");
    modeRail.id = "mg-tools-mode-rail";
    modeRail.className = "mg-edge";
    modeRail.setAttribute("role", "tablist");
    modeRail.setAttribute("aria-label", "Control Center modes");
    modeRail.style.cssText =
      "position:fixed!important;left:0!important;top:50%!important;" +
      "transform:translateY(-50%)!important;z-index:2147483647!important;" +
      "display:flex!important;flex-direction:column!important;" +
      "pointer-events:auto!important;visibility:visible!important;" +
      "min-width:28px!important;opacity:1!important;";
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

  /* Keep chrome stable while phone cam head-track is live */
  if (!HP._chromeStableTick) {
    HP._chromeStableTick = true;
    setInterval(function () {
      try {
        if (typeof syncChromeStable === "function") syncChromeStable();
      } catch (eT) {}
    }, 250);
  }
  setTimeout(function () {
    try {
      syncChromeStable();
    } catch (e0) {}
  }, 300);

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
    syncChromeStable: syncChromeStable,
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
