/* Memory Glass · RIGHT DATA DRAWER
 * Viewport-fixed on <html> (not body — page-axis transform).
 * Localizes monitor/readout surfaces: Live · Bench · Mkt · Inspect · Chat · Grok
 * Pairs with left TOOLS control drawer. Tab docks to right wall and rides open.
 * VER: mg-right-drawer-v13-dual-safe
 * Drawer must beat #mg-root (z=3646) or INSPECT/PAGE always overlay DATA.
 * Dual-open: same stack as left tools — never cover left menus; clip panel to right.
 */
(function () {
  "use strict";
  var VER = "mg-right-drawer-v13-dual-safe";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._rightDrawerVer === VER) return;
  HP._rightDrawerVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function chromeRoot() {
    return document.documentElement || document.body;
  }

  var open = false;
  var el = null;
  var tab = null;
  var body = null;
  var statusEl = null;
  var mode = "live";
  var MODES = [
    { id: "live", label: "Live" },
    { id: "bench", label: "Bench" },
    { id: "mkt", label: "Mkt" },
    { id: "inspect", label: "Inspect" },
    { id: "chat", label: "Chat" },
    { id: "grok", label: "Grok" },
  ];
  var logBuf = [];
  var secState = {}; /* section id → open */

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "right-drw");
    } catch (e) {}
  }

  var _raiseLast = 0;
  function raiseEdges() {
    try {
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
        nodes[i].style.setProperty("z-index", "2147483647", "important");
        nodes[i].style.setProperty("pointer-events", "auto", "important");
      }
    } catch (e) {}
  }

  function ensureCss() {
    var old = document.getElementById("mg-right-drawer-css");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "mg-right-drawer-css";
    st.textContent = [
      "html.mg-dual-drawer #mg-mkt-rail:not(.mg-mkt-embedded){",
      "  display:none!important}",
      "html > #mg-right-drawer,html > #mg-right-scrim{",
      "  position:fixed!important;backface-visibility:hidden}",
      "#mg-right-drawer{",
      "  --mg-right-tab-w:32px;",
      "  --mg-right-w:min(360px,38vw);",
      "  position:fixed!important;right:0!important;top:0!important;bottom:0!important;",
      "  left:auto!important;width:var(--mg-right-w)!important;",
      "  max-width:min(440px,46vw)!important;",
      "  z-index:2147483634;pointer-events:auto;",
      "  display:flex;flex-direction:column;",
      "  transform:translate3d(100%,0,0)!important;",
      "  transition:transform .22s cubic-bezier(.2,.9,.2,1),width .18s ease;",
      "  background:rgba(40,40,44,0.52)!important;",
      "  backdrop-filter:blur(48px) saturate(1.8)!important;",
      "  -webkit-backdrop-filter:blur(48px) saturate(1.8)!important;",
      "  border-left:1px solid rgba(255,255,255,0.12);",
      "  box-shadow:-12px 0 40px rgba(0,0,0,0.32),inset 0 1px 0 rgba(255,255,255,0.12);",
      "  font:500 13px/1.25 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;",
      "  color:rgba(255,255,255,0.92);box-sizing:border-box;",
      "  overflow-x:hidden!important;overflow-y:hidden!important;",
      "  contain:layout style!important;",
      "  margin:0!important;max-height:100vh!important;max-height:100dvh!important}",
      /* Same open stack as left tools (3645) — dual-open side-by-side, no cover fight */
      "#mg-right-drawer.open{transform:translate3d(0,0,0)!important;",
      "  z-index:2147483645!important}",
      /*
       * #mg-root is z=3646 (shell). Open drawers use 3645; edge tabs 3646.
       * Never let DATA float above left TOOLS menus.
       */
      "html.mg-right-open #mg-root{",
      "  z-index:2147483600!important}",
      "html.mg-right-open #mg-top-right{",
      "  right:calc(var(--mg-right-w, min(360px,38vw)) + 16px)!important;",
      "  z-index:2147483601!important;",
      "  pointer-events:auto!important}",
      "html.mg-right-open #mg-top-right button{",
      "  pointer-events:auto!important}",
      "html.mg-right-open #mg-mode-drop{",
      "  z-index:2147483602!important}",
      /* Widen modestly — leave room for left TOOLS (~340px) on dual-open */
      "#mg-right-drawer.mkt-mode{--mg-right-w:min(400px,40vw)}",
      "#mg-right-drawer.bench-mode{--mg-right-w:min(400px,40vw)}",
      "html.mg-left-open #mg-right-drawer,",
      "html.mg-left-open #mg-right-drawer.bench-mode,",
      "html.mg-left-open #mg-right-drawer.mkt-mode{",
      "  --mg-right-w:min(380px,36vw)!important;",
      "  max-width:min(400px,40vw)!important}",
      /* Dual-open: scrims must not steal clicks from the opposite drawer */
      "html.mg-left-open.mg-right-open #mg-right-scrim.on,",
      "html.mg-left-open.mg-right-open #mg-tools-scrim.on{",
      "  pointer-events:none!important;opacity:0.12!important}",
      "html.mg-left-open #mg-tools-drawer.open{",
      "  z-index:2147483645!important}",
      "html.mg-left-open #mg-tools-mode-rail{",
      "  z-index:2147483646!important}",
      "#mg-drawer-mkt-host{display:flex;flex-direction:column;min-height:min(70vh,640px);flex:1 1 auto;gap:6px;max-width:100%;overflow:hidden}",
      "#mg-drawer-bench-host{display:flex;flex-direction:column;min-height:160px;flex:1 1 auto;gap:6px;margin-top:8px;max-width:100%;overflow:hidden}",
      "#mg-drawer-mkt-host .drw-hint,#mg-right-drawer .drw-hint{",
      "  font:500 11px/1.35 system-ui;color:rgba(255,255,255,0.45);padding:8px 4px}",
      /* Viewport-fixed DATA tab (sibling of drawer — not inside transform) */
      "html > #mg-right-tab,html.mg-webgrid-play > #mg-right-tab{",
      "  position:fixed!important;right:0!important;left:auto!important;top:50%!important;",
      "  z-index:2147483646!important;pointer-events:auto!important;cursor:pointer;",
      "  writing-mode:vertical-rl;text-orientation:mixed;transform:translateY(-50%)!important;",
      "  padding:16px 8px;margin:0;border:0;border-radius:10px 0 0 10px;",
      "  min-width:28px!important;min-height:72px!important;width:28px;",
      "  background:rgba(36,36,40,0.92)!important;",
      "  backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);",
      "  border:1px solid rgba(255,255,255,0.12);border-right:0;",
      "  color:rgba(255,255,255,0.9)!important;",
      "  font:600 10px/1 -apple-system,system-ui;letter-spacing:0.1em;text-transform:uppercase;",
      "  box-shadow:-4px 0 18px rgba(0,0,0,0.28);white-space:nowrap;",
      "  visibility:visible!important;opacity:1!important;display:block!important;",
      "  transition:right .22s cubic-bezier(.2,.9,.2,1)}",
      "html.mg-right-open > #mg-right-tab{",
      "  right:var(--mg-right-w,min(360px,90vw))!important}",
      "#mg-right-tab:hover{background:rgba(48,48,54,0.95)!important;color:#fff!important}",
      "#mg-right-tab.on,html.mg-right-open > #mg-right-tab{",
      "  background:rgba(50,52,60,0.96)!important;color:#fff!important}",
      "html.mg-webgrid-play > #mg-right-drawer,html > #mg-right-drawer{",
      "  z-index:2147483634!important;pointer-events:auto!important;visibility:visible!important}",
      "html.mg-webgrid-play > #mg-right-scrim,html > #mg-right-scrim,",
      "html.mg-webgrid-play #mg-right-scrim,html.mg-webgrid-playing #mg-right-scrim,",
      "html.mg-webgrid-play-busy #mg-right-scrim,html.mg-webgrid-playing #mg-right-scrim.on,",
      "html.mg-webgrid-play-busy #mg-right-scrim.on{",
      "  pointer-events:none!important;opacity:0!important;visibility:hidden!important}",
      "html > #mg-right-scrim:not(.on){pointer-events:none!important;opacity:0!important}",
      "html.mg-right-open > #mg-right-drawer,html.mg-right-open > #mg-right-drawer.open,",
      "html > #mg-right-drawer.open{",
      "  z-index:2147483645!important}",
      "#mg-right-drawer .drw-hd{",
      "  display:flex;align-items:center;justify-content:space-between;gap:8px;",
      "  padding:12px 12px 8px;flex-shrink:0;border-bottom:0}",
      "#mg-right-drawer .drw-hd .ttl{",
      "  font:600 13px/1.1 -apple-system,BlinkMacSystemFont,system-ui;",
      "  letter-spacing:-0.01em;color:rgba(255,255,255,0.88)}",
      "#mg-right-drawer .drw-hd .ttl .dot{",
      "  display:inline-block;width:7px;height:7px;border-radius:50%;",
      "  background:rgba(10,132,255,0.95);margin-right:8px;",
      "  box-shadow:0 0 6px rgba(10,132,255,0.35);vertical-align:middle}",
      "#mg-right-drawer .drw-hd button{",
      "  appearance:none;cursor:pointer;border:0;background:rgba(255,255,255,0.1);",
      "  color:rgba(255,255,255,0.85);width:28px;height:28px;border-radius:50%;",
      "  font:600 14px/1 system-ui}",
      "#mg-right-drawer .drw-hd button:hover{background:rgba(255,255,255,0.18)}",
      /* Segmented tabs — CTRL parity */
      "#mg-right-drawer .drw-tabs{",
      "  display:flex;flex-wrap:nowrap;gap:2px;padding:4px 10px 8px;flex-shrink:0;",
      "  margin:0 8px 2px;border-radius:10px;background:rgba(0,0,0,0.22);",
      "  overflow-x:auto;-webkit-overflow-scrolling:touch}",
      "#mg-right-drawer .drw-tabs button{",
      "  appearance:none;cursor:pointer;border:0;flex:0 0 auto;",
      "  background:transparent;color:rgba(255,255,255,0.5);",
      "  font:600 10px/1 -apple-system,system-ui;letter-spacing:0.02em;",
      "  text-transform:none;padding:6px 9px;border-radius:8px;min-height:26px}",
      "#mg-right-drawer .drw-tabs button:hover{color:rgba(255,255,255,0.9);",
      "  background:rgba(255,255,255,0.06)}",
      "#mg-right-drawer .drw-tabs button.on{",
      "  color:#fff;background:rgba(255,255,255,0.16);",
      "  box-shadow:0 1px 2px rgba(0,0,0,0.18)}",
      "#mg-right-drawer .drw-master{",
      "  display:flex;justify-content:flex-end;gap:12px;padding:2px 12px 6px;flex-shrink:0}",
      "#mg-right-drawer .drw-master button{",
      "  appearance:none;cursor:pointer;border:0;background:transparent;",
      "  font:500 10px/1 -apple-system,system-ui;letter-spacing:0.02em;text-transform:none;",
      "  color:rgba(255,255,255,0.38);padding:4px 2px}",
      "#mg-right-drawer .drw-master button:hover{color:rgba(255,255,255,0.88)}",
      "#mg-right-drawer .mg-sec{border-bottom:0;margin:0 0 4px}",
      "#mg-right-drawer .mg-sec-toggle{",
      "  appearance:none;width:100%;cursor:pointer;user-select:none;",
      "  display:flex;align-items:center;justify-content:space-between;gap:8px;",
      "  padding:8px 4px 6px;margin:0;border:0;border-radius:8px;",
      "  background:transparent;color:rgba(255,255,255,0.42);",
      "  font:600 11px/1 -apple-system,system-ui;letter-spacing:0.02em;",
      "  text-transform:none;text-align:left}",
      "#mg-right-drawer .mg-sec-toggle:hover{color:rgba(255,255,255,0.75);",
      "  background:rgba(255,255,255,0.04)}",
      "#mg-right-drawer .mg-sec.is-open .mg-sec-toggle{color:rgba(255,255,255,0.55)}",
      "#mg-right-drawer .mg-sec-toggle .sec-meta{display:flex;align-items:center;gap:8px;min-width:0}",
      "#mg-right-drawer .mg-sec-toggle .sec-count{",
      "  font:500 10px/1 system-ui;color:rgba(255,255,255,0.28)}",
      "#mg-right-drawer .mg-sec-toggle .chev{",
      "  flex-shrink:0;font-size:8px;opacity:0.35;transition:transform .15s;",
      "  color:rgba(255,255,255,0.45)}",
      "#mg-right-drawer .mg-sec.is-open .mg-sec-toggle .chev{transform:rotate(180deg);opacity:0.55}",
      "#mg-right-drawer .mg-sec-body{display:none;padding:0 0 10px}",
      "#mg-right-drawer .mg-sec.is-open > .mg-sec-body{display:block}",
      "#mg-right-drawer .drw-body{",
      "  flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;",
      "  padding:4px 10px 16px;-webkit-overflow-scrolling:touch;",
      "  display:flex;flex-direction:column}",
      "#mg-right-drawer .drw-status{",
      "  flex-shrink:0;padding:8px 14px 12px;border-top:1px solid rgba(255,255,255,0.06);",
      "  font:500 10px/1.3 -apple-system,ui-monospace,Menlo,monospace;",
      "  color:rgba(255,255,255,0.38);background:transparent;text-align:center}",
      "#mg-right-scrim{",
      "  position:fixed!important;inset:0!important;z-index:2147483628;pointer-events:none!important;",
      "  background:rgba(0,0,0,0.22);opacity:0;transition:opacity .2s;margin:0!important}",
      "#mg-right-scrim.on{opacity:1;pointer-events:auto}",
      "html.mg-webgrid-playing #mg-right-scrim,html.mg-webgrid-play-busy #mg-right-scrim,",
      "html.mg-webgrid-playing #mg-right-scrim.on,html.mg-webgrid-play-busy #mg-right-scrim.on{",
      "  opacity:0!important;pointer-events:none!important;visibility:hidden!important}",
      "#mg-right-drawer .hint{",
      "  font:500 11px/1.35 -apple-system,system-ui;color:rgba(255,255,255,0.4);margin:4px 2px 10px}",
      /* CTRL module tiles (replaces cheesy pill chips) */
      "#mg-right-drawer .mg-cap-row{",
      "  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:8px}",
      "#mg-right-drawer button.act{",
      "  appearance:none;cursor:pointer;border:0;",
      "  display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;",
      "  gap:8px;text-align:left;",
      "  background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.95);",
      "  font:600 12px/1.15 -apple-system,BlinkMacSystemFont,system-ui;",
      "  letter-spacing:-0.01em;text-transform:none;",
      "  padding:12px;border-radius:16px;min-height:72px;",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.14);",
      "  transition:background .12s ease,transform .1s ease}",
      "#mg-right-drawer button.act:hover{background:rgba(255,255,255,0.16)}",
      "#mg-right-drawer button.act:active{transform:scale(0.97);background:rgba(255,255,255,0.2)}",
      "#mg-right-drawer button.act .ico{",
      "  display:flex;align-items:center;justify-content:center;",
      "  width:28px;height:28px;border-radius:50%;",
      "  background:rgba(255,255,255,0.14);font-size:13px;line-height:1;",
      "  color:rgba(255,255,255,0.92);box-shadow:none}",
      "#mg-right-drawer button.act.hot .ico,",
      "#mg-right-drawer button.act.primary .ico{",
      "  background:rgba(10,132,255,0.92);color:#fff}",
      "#mg-right-drawer button.act.ok .ico{",
      "  background:rgba(48,209,88,0.88);color:#fff}",
      "#mg-right-drawer button.act.muted .ico{",
      "  background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.65)}",
      "#mg-right-drawer button.act .lbl{",
      "  font:600 12px/1.2 -apple-system,system-ui;color:rgba(255,255,255,0.95)}",
      "#mg-right-drawer button.act .sub{",
      "  font:500 10px/1.2 -apple-system,system-ui;color:rgba(255,255,255,0.42);margin-top:1px}",
      "#mg-right-drawer button.act.hot{background:rgba(10,132,255,0.14)}",
      "#mg-right-drawer button.act.ok{background:rgba(48,209,88,0.12)}",
      "#mg-right-drawer button.act.primary{background:rgba(10,132,255,0.14)}",
      "#mg-right-drawer button.act.wide{",
      "  grid-column:1 / -1;flex-direction:row;align-items:center;min-height:52px;padding:10px 14px}",
      "#mg-right-drawer button.act.wide .lbl{flex:1}",
      "#mg-right-drawer .log{",
      "  flex:1;min-height:160px;max-height:min(42vh,360px);overflow:auto;",
      "  padding:12px;border-radius:16px;background:rgba(255,255,255,0.08);",
      "  font:500 11px/1.4 ui-monospace,Menlo,monospace;color:rgba(230,235,240,0.88);",
      "  white-space:pre-wrap;word-break:break-word;",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.1);border:0}",
      "#mg-right-drawer .log .err{color:rgba(255,160,160,0.95)}",
      "#mg-right-drawer .log .ok{color:rgba(140,230,170,0.95)}",
      "#mg-right-drawer .metric-grid{",
      "  display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}",
      "#mg-right-drawer .metric{",
      "  padding:12px;border-radius:16px;background:rgba(255,255,255,0.1);",
      "  border:0;box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.12)}",
      "#mg-right-drawer .metric .k{",
      "  font:600 10px/1 -apple-system,system-ui;letter-spacing:0.02em;text-transform:none;",
      "  color:rgba(255,255,255,0.42)}",
      "#mg-right-drawer .metric .v{",
      "  font:600 15px/1.2 -apple-system,ui-monospace,Menlo,monospace;margin-top:6px;",
      "  color:rgba(255,255,255,0.95);letter-spacing:-0.01em}",
      "#mg-right-drawer .chat-in{",
      "  display:flex;gap:8px;margin-top:8px}",
      "#mg-right-drawer .chat-in input{",
      "  flex:1;appearance:none;border-radius:12px;padding:10px 12px;border:0;",
      "  background:rgba(255,255,255,0.08);color:#fff;",
      "  font:500 12px/1.2 -apple-system,system-ui;outline:none;",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.1)}",
      "#mg-right-drawer .chat-in input:focus{background:rgba(255,255,255,0.12)}",
      "#mg-right-drawer .chat-in button{",
      "  appearance:none;cursor:pointer;border:0;border-radius:12px;",
      "  padding:0 16px;font:600 12px/1 -apple-system,system-ui;color:#fff;",
      "  background:rgba(10,132,255,0.9);box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.2)}",
      "#mg-right-drawer .chat-in button:hover{background:rgba(10,132,255,1)}",

      "html.mg-right-open #mg-activity-board.collapsed{",
      "  right:max(12px, calc(12px + var(--mg-right-w, 0px) * 0))!important}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
    try {
      document.documentElement.classList.add("mg-dual-drawer");
      document.documentElement.classList.add("mg-drawer-mode");
    } catch (e) {}
    raiseEdges();
  }

  function setStatus(s) {
    if (statusEl) statusEl.textContent = s || "Data · " + VER;
  }

  function secIsOpen(id, defOpen) {
    if (secState[id] == null) secState[id] = defOpen !== false;
    return !!secState[id];
  }

  function collapsible(id, title, defOpen, fillFn) {
    var wrap = document.createElement("div");
    wrap.className = "mg-sec" + (secIsOpen(id, defOpen) ? " is-open" : "");
    wrap.setAttribute("data-sec", id);
    var bodyEl = document.createElement("div");
    bodyEl.className = "mg-sec-body";
    fillFn(bodyEl);
    var n = bodyEl.querySelectorAll("button").length;
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
    var ids = {};
    Object.keys(secState).forEach(function (k) {
      ids[k] = 1;
    });
    [
      "live-metrics",
      "live-board",
      "mkt-film",
      "inspect-ops",
      "inspect-log",
      "chat-compose",
      "chat-actions",
      "grok-cmds",
      "grok-term",
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

  function unembedAll() {
    try {
      if (window.__mgMarket && window.__mgMarket.unembed)
        window.__mgMarket.unembed();
    } catch (e) {}
    try {
      var gt = document.getElementById("mg-grok-term");
      if (gt && gt.dataset.mgEmbedded === "1") {
        gt.dataset.mgEmbedded = "0";
        gt.classList.add("hidden");
        (document.body || chromeRoot()).appendChild(gt);
      }
    } catch (e2) {}
  }

  function paintTabs(host) {
    host.innerHTML = "";
    var tabs = document.createElement("div");
    tabs.className = "drw-tabs";
    MODES.forEach(function (M) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = M.label;
      b.className = mode === M.id ? "on" : "";
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        mode = M.id;
        paint();
      };
      tabs.appendChild(b);
    });
    host.appendChild(tabs);
  }

  /** CTRL-style glass module tiles (not candy pills) */
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
      } catch (e) {
        setStatus("err " + e);
      }
    };
    return b;
  }

  function actRow(parent, items) {
    var row = document.createElement("div");
    row.className = "mg-cap-row";
    items.forEach(function (it) {
      var cls = it.hot ? "hot" : it.ok ? "ok" : it.muted ? "muted" : "primary";
      var wide = !!it.wide || items.length === 1;
      row.appendChild(
        act(it.label, cls, it.fn, {
          ico: it.ico || (it.hot ? "◆" : "●"),
          sub: it.sub || "",
          wide: wide && items.length <= 2 ? false : it.wide,
        })
      );
    });
    /* odd last tile: allow single full-width if only one */
    if (items.length === 1) {
      var only = row.querySelector("button.act");
      if (only) only.classList.add("wide");
    }
    parent.appendChild(row);
  }

  function paintLive() {
    body.appendChild(
      collapsible("live-metrics", "Live · metrics", true, function (box) {
        var h = document.createElement("p");
        h.className = "hint";
        h.textContent = "Live rank · metrics · board (localized right)";
        box.appendChild(h);
        var grid = document.createElement("div");
        grid.className = "metric-grid";
        var metrics = [
          { k: "Board", v: "—" },
          { k: "Solve", v: "—" },
          { k: "Product", v: window.__mgProductMode ? "on" : "off" },
          { k: "Menus", v: "—" },
        ];
        try {
          if (window.__mgActivityBoard && window.__mgActivityBoard.report)
            metrics[0].v = String(window.__mgActivityBoard.report()).slice(0, 28);
        } catch (e) {}
        try {
          if (window.__mgLiveSolveHud && window.__mgLiveSolveHud.report)
            metrics[1].v = String(window.__mgLiveSolveHud.report()).slice(0, 28);
        } catch (e2) {}
        try {
          if (window.__mgMenus && window.__mgMenus.report)
            metrics[3].v = String(window.__mgMenus.report()).slice(0, 28);
          else if (window.__mgMenuHealth && window.__mgMenuHealth.report)
            metrics[3].v = String(window.__mgMenuHealth.report()).slice(0, 28);
        } catch (e3) {}
        metrics.forEach(function (m) {
          var d = document.createElement("div");
          d.className = "metric";
          d.innerHTML =
            '<div class="k">' +
            m.k +
            '</div><div class="v">' +
            m.v.replace(/</g, "&lt;") +
            "</div>";
          grid.appendChild(d);
        });
        box.appendChild(grid);
      })
    );
    body.appendChild(
      collapsible("live-board", "Live · board controls", true, function (box) {
        actRow(box, [
          {
            label: "Expand board",
            hot: true,
            fn: function () {
              if (window.__mgActivityBoard)
                window.__mgActivityBoard.open({ collapsed: false });
              setStatus("LIVE board open");
            },
          },
          {
            label: "Pill",
            fn: function () {
              if (window.__mgActivityBoard)
                window.__mgActivityBoard.open({ collapsed: true });
              setStatus("LIVE pill");
            },
          },
          {
            label: "Close board",
            fn: function () {
              if (window.__mgActivityBoard && window.__mgActivityBoard.close)
                window.__mgActivityBoard.close();
            },
          },
          {
            label: "SOLVE tray",
            fn: function () {
              if (window.__mgLiveSolveHud) window.__mgLiveSolveHud.toggle();
            },
          },
          {
            label: "Clear floats",
            fn: function () {
              if (window.__mgFloatLayout && window.__mgFloatLayout.closeAll)
                window.__mgFloatLayout.closeAll();
              else if (window.__mgMenus && window.__mgMenus.closeAll)
                window.__mgMenus.closeAll();
              setStatus("floats cleared");
            },
          },
        ]);
      })
    );
    setStatus("Live · board + solve");
  }

  function paintMkt() {
    /* Always-open filmstrip host — Collapse all used to hide the only content. */
    secState["mkt-film"] = true;
    var head = document.createElement("p");
    head.className = "hint";
    head.textContent =
      "Market filmstrip · industry sections · strip · squeeze charts";
    body.appendChild(head);

    var host = document.createElement("div");
    host.id = "mg-drawer-mkt-host";

    function tryEmbedMkt(h) {
      if (!h) return false;
      var ok = false;
      try {
        if (window.__mgMarket && window.__mgMarket.embedInto)
          ok = !!window.__mgMarket.embedInto(h);
      } catch (e) {}
      if (!ok) {
        h.innerHTML =
          '<p class="drw-hint">MKT missing — inject market-filmstrip · try LOAD / hot reload</p>';
        setStatus("MKT missing — hot reload?");
        return false;
      }
      try {
        if (
          window.__mgMarket &&
          window.__mgMarket.loadBoardHard &&
          !(
            window.__mgMarket.state &&
            window.__mgMarket.state.rows &&
            window.__mgMarket.state.rows.length
          )
        ) {
          window.__mgMarket.loadBoardHard(function () {
            setStatus(
              window.__mgMarket.report
                ? window.__mgMarket.report()
                : "MKT board"
            );
          });
        }
      } catch (eB) {}
      setStatus(
        window.__mgMarket.report ? window.__mgMarket.report() : "MKT embed"
      );
      return true;
    }

    actRow(body, [
      {
        label: "LOAD board",
        hot: true,
        fn: function () {
          try {
            if (window.__mgMarket && window.__mgMarket.loadBoardHard)
              window.__mgMarket.loadBoardHard(function () {
                setStatus(
                  window.__mgMarket.report
                    ? window.__mgMarket.report()
                    : "board loaded"
                );
              });
            else if (window.ipc)
              window.ipc.postMessage(JSON.stringify({ op: "load_filmstrip" }));
          } catch (eL) {}
        },
      },
      {
        label: "Re-embed",
        fn: function () {
          tryEmbedMkt(document.getElementById("mg-drawer-mkt-host"));
        },
      },
    ]);

    body.appendChild(host);

    if (!tryEmbedMkt(host)) {
      /* inject race — market-filmstrip may mount a beat later */
      setTimeout(function () {
        var h2 = document.getElementById("mg-drawer-mkt-host");
        if (h2) tryEmbedMkt(h2);
      }, 320);
      setTimeout(function () {
        var h3 = document.getElementById("mg-drawer-mkt-host");
        if (h3 && !h3.querySelector("#mg-mkt-panel")) tryEmbedMkt(h3);
      }, 900);
    }
  }

  function paintInspect() {
    body.appendChild(
      collapsible("inspect-ops", "Inspect · controls", true, function (box) {
        var h = document.createElement("p");
        h.className = "hint";
        h.textContent = "Inspect · log + controls (localized)";
        box.appendChild(h);
        actRow(box, [
          {
            label: "Open inspect",
            hot: true,
            fn: function () {
              try {
                if (window.ipc)
                  window.ipc.postMessage(JSON.stringify({ op: "dev_show" }));
              } catch (e) {}
              setStatus("inspect float");
            },
          },
          {
            label: "Hot reload",
            fn: function () {
              try {
                if (window.ipc)
                  window.ipc.postMessage(JSON.stringify({ op: "hot_reload" }));
              } catch (e) {}
              setStatus("hot reload…");
            },
          },
          {
            label: "Clear log",
            fn: function () {
              logBuf = [];
              paint();
            },
          },
          {
            label: "Menu health",
            fn: function () {
              try {
                if (window.__mgMenus && window.__mgMenus.probe)
                  window.__mgMenus.probe();
                else if (window.__mgMenuHealth && window.__mgMenuHealth.probe)
                  window.__mgMenuHealth.probe();
              } catch (e) {}
              setStatus("probe…");
            },
          },
        ]);
      })
    );
    body.appendChild(
      collapsible("inspect-log", "Inspect · log", true, function (box) {
        var logEl = document.createElement("div");
        logEl.className = "log";
        logEl.id = "mg-right-inspect-log";
        if (!logBuf.length) {
          logEl.innerHTML =
            '<span class="ok">Inspect log · last events appear here</span>\n' +
            "Use Open inspect for native float · Hot reload re-injects menus.";
        } else {
          logEl.innerHTML = logBuf
            .slice(-80)
            .map(function (L) {
              return (
                '<div class="' +
                (L.lvl === "err" || L.lvl === "error"
                  ? "err"
                  : L.lvl === "ok"
                    ? "ok"
                    : "") +
                '">' +
                String(L.msg || "").replace(/</g, "&lt;") +
                "</div>"
              );
            })
            .join("");
        }
        box.appendChild(logEl);
      })
    );
    setStatus("Inspect · " + logBuf.length + " lines");
  }

  function paintChat() {
    body.appendChild(
      collapsible("chat-compose", "Chat · compose", true, function (box) {
        var h = document.createElement("p");
        h.className = "hint";
        h.textContent = "Chat / mesh readout · search dock path when present";
        box.appendChild(h);
        var logEl = document.createElement("div");
        logEl.className = "log";
        logEl.id = "mg-right-chat-log";
        logEl.textContent =
          "Chat ready · type below · GO / CHAT / MESH on search bar still work.";
        box.appendChild(logEl);
        var row = document.createElement("div");
        row.className = "chat-in";
        var inp = document.createElement("input");
        inp.type = "text";
        inp.placeholder = "message…";
        inp.id = "mg-right-chat-in";
        var go = document.createElement("button");
        go.type = "button";
        go.textContent = "SEND";
        function send() {
          var t = (inp.value || "").trim();
          if (!t) return;
          logEl.textContent += "\n› " + t;
          inp.value = "";
          try {
            var sd = document.getElementById("mg-search-dock");
            var si = sd && sd.querySelector("input");
            if (si) {
              si.value = t;
              sd.classList.add("is-open");
              sd.classList.add("chat-open");
            }
            if (window.__mgSearch && window.__mgSearch.send)
              window.__mgSearch.send(t);
            else if (window.__mgMesh && window.__mgMesh.broadcast)
              window.__mgMesh.broadcast({ type: "chat", text: t });
          } catch (e) {}
          setStatus("sent");
          logEl.scrollTop = logEl.scrollHeight;
        }
        go.onclick = function (ev) {
          if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
          }
          send();
        };
        inp.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") {
            ev.preventDefault();
            send();
          }
        });
        row.appendChild(inp);
        row.appendChild(go);
        box.appendChild(row);
      })
    );
    body.appendChild(
      collapsible("chat-actions", "Chat · actions", true, function (box) {
        actRow(box, [
          {
            label: "Open search",
            hot: true,
            fn: function () {
              var sd = document.getElementById("mg-search-dock");
              if (sd) {
                sd.classList.add("is-open");
                setStatus("search open");
              }
            },
          },
          {
            label: "Mesh share",
            fn: function () {
              if (window.__mgCollabDay && window.__mgCollabDay.shareScore)
                window.__mgCollabDay.shareScore();
            },
          },
        ]);
      })
    );
    setStatus("Chat");
  }

  function paintGrok() {
    body.appendChild(
      collapsible("grok-cmds", "Grok · commands", true, function (box) {
        var h = document.createElement("p");
        h.className = "hint";
        h.textContent = "Grok terminal bridge · embed or open TUI";
        box.appendChild(h);
        actRow(box, [
          {
            label: "Open Grok float",
            hot: true,
            fn: function () {
              if (window.__mgGrokTerm) window.__mgGrokTerm.open();
            },
          },
          {
            label: "/status",
            fn: function () {
              if (window.__mgGrokTerm && window.__mgGrokTerm.handle)
                window.__mgGrokTerm.handle("/status");
            },
          },
          {
            label: "/tools",
            fn: function () {
              if (window.__mgGrokTerm && window.__mgGrokTerm.handle)
                window.__mgGrokTerm.handle("/tools");
            },
          },
          {
            label: "/version",
            fn: function () {
              if (window.__mgGrokTerm && window.__mgGrokTerm.handle)
                window.__mgGrokTerm.handle("/version");
            },
          },
          {
            label: "OPEN TUI",
            fn: function () {
              if (window.__mgGrokTerm && window.__mgGrokTerm.handle)
                window.__mgGrokTerm.handle("/open");
              else
                try {
                  if (window.ipc)
                    window.ipc.postMessage(
                      JSON.stringify({ op: "grok_term", action: "open", line: "" })
                    );
                } catch (e) {}
            },
          },
        ]);
      })
    );
    body.appendChild(
      collapsible("grok-term", "Grok · terminal", true, function (box) {
        var host = document.createElement("div");
        host.id = "mg-drawer-grok-host";
        host.style.minHeight = "200px";
        box.appendChild(host);
        try {
          var gt = document.getElementById("mg-grok-term");
          if (gt && window.__mgGrokTerm) {
            gt.classList.remove("hidden");
            gt.dataset.mgEmbedded = "1";
            gt.style.position = "relative";
            gt.style.right = "auto";
            gt.style.bottom = "auto";
            gt.style.width = "100%";
            gt.style.maxHeight = "min(50vh,420px)";
            gt.style.zIndex = "1";
            host.appendChild(gt);
            if (window.__mgGrokTerm.open) window.__mgGrokTerm.open();
          }
        } catch (e) {}
      })
    );
    setStatus(
      window.__mgGrokTerm && window.__mgGrokTerm.report
        ? window.__mgGrokTerm.report()
        : "Grok"
    );
  }

  function paintBench() {
    if (window.__mgDataBench && window.__mgDataBench.paint) {
      window.__mgDataBench.paint(body, setStatus);
      return;
    }
    var miss = document.createElement("p");
    miss.className = "hint";
    miss.textContent =
      "Bench missing — inject mg-data-bench.js (⌘⇧R). Local: http://127.0.0.1:8765/";
    body.appendChild(miss);
    actRow(body, [
      {
        label: "OPEN hexbench (local) ↗",
        hot: true,
        fn: function () {
          try {
            var u = "http://127.0.0.1:8765/hexbench.html";
            if (window.ipc)
              window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
            else window.open(u, "_blank");
          } catch (e) {}
        },
      },
      {
        label: "OPEN freya (local) ↗",
        fn: function () {
          try {
            var u = "http://127.0.0.1:8765/freya.html";
            if (window.ipc)
              window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
            else window.open(u, "_blank");
          } catch (e) {}
        },
      },
    ]);
    setStatus("bench pending");
  }

  function paint() {
    if (!body) return;
    unembedAll();
    body.innerHTML = "";
    if (el) {
      el.classList.toggle("mkt-mode", mode === "mkt");
      el.classList.toggle("bench-mode", mode === "bench");
    }
    var tabsHost = el && el.querySelector(".drw-tabs-host");
    if (tabsHost) paintTabs(tabsHost);
    /* Master bar noise on Mkt/Bench — content is the body */
    if (mode !== "mkt" && mode !== "bench") paintMasterBar(body);
    if (mode === "live") paintLive();
    else if (mode === "bench") paintBench();
    else if (mode === "mkt") paintMkt();
    else if (mode === "inspect") paintInspect();
    else if (mode === "chat") paintChat();
    else if (mode === "grok") paintGrok();
    /* Bench/Mkt width change must re-pin shell so it stays docked right */
    pinDrawerShell();
    positionTab();
    protectLeftMenus();
    try {
      if (window.__mgChromeTokens && window.__mgChromeTokens.pin)
        window.__mgChromeTokens.pin();
    } catch (ePin) {}
  }

  function drawerWidthPx() {
    var w = 360;
    try {
      if (el) {
        var pw = parseFloat(getComputedStyle(el).width);
        if (isFinite(pw) && pw > 80) w = pw;
      }
      /* hard cap so DATA never eats the left TOOLS column */
      var maxW = Math.min(440, Math.floor(window.innerWidth * 0.42));
      if (document.documentElement.classList.contains("mg-left-open")) {
        maxW = Math.min(400, Math.floor(window.innerWidth * 0.38));
      }
      if (w > maxW) w = maxW;
    } catch (e) {}
    return Math.round(w);
  }

  function pinDrawerShell() {
    if (!el) return;
    try {
      var w = drawerWidthPx();
      el.style.setProperty("position", "fixed", "important");
      el.style.setProperty("right", "0", "important");
      el.style.setProperty("left", "auto", "important");
      el.style.setProperty("top", "0", "important");
      el.style.setProperty("bottom", "0", "important");
      el.style.setProperty("width", w + "px", "important");
      el.style.setProperty("max-width", w + "px", "important");
      el.style.setProperty("overflow-x", "hidden", "important");
      el.style.setProperty("overflow-y", "hidden", "important");
      el.style.setProperty("z-index", open ? "2147483645" : "2147483634", "important");
      document.documentElement.style.setProperty("--mg-right-w", w + "px");
    } catch (e) {}
  }

  function positionTab() {
    if (!tab) return;
    try {
      if (!open) {
        tab.style.setProperty("right", "0", "important");
        tab.style.setProperty("left", "auto", "important");
        return;
      }
      var w = drawerWidthPx();
      tab.style.setProperty("right", w + "px", "important");
      tab.style.setProperty("left", "auto", "important");
      tab.style.setProperty("z-index", "2147483646", "important");
    } catch (e) {
      tab.style.right = open ? "360px" : "0";
    }
  }

  function protectLeftMenus() {
    try {
      var left = document.getElementById("mg-tools-drawer");
      var rail = document.getElementById("mg-tools-mode-rail");
      if (left && left.classList.contains("open")) {
        left.style.setProperty("z-index", "2147483645", "important");
        left.style.setProperty("left", "0", "important");
        left.style.setProperty("right", "auto", "important");
      }
      if (rail) {
        rail.style.setProperty("z-index", "2147483646", "important");
      }
      /* dual scrims: don't intercept the other side */
      if (
        document.documentElement.classList.contains("mg-left-open") &&
        document.documentElement.classList.contains("mg-right-open")
      ) {
        var rs = document.getElementById("mg-right-scrim");
        var ls = document.getElementById("mg-tools-scrim");
        if (rs) rs.style.setProperty("pointer-events", "none", "important");
        if (ls) ls.style.setProperty("pointer-events", "none", "important");
      }
    } catch (e) {}
  }

  function setOpen(on) {
    open = !!on;
    if (el) el.classList.toggle("open", open);
    if (tab) tab.classList.toggle("on", open);
    var scrim = document.getElementById("mg-right-scrim");
    if (scrim) scrim.classList.toggle("on", open);
    try {
      document.documentElement.classList.toggle("mg-right-open", open);
      /* freeze page-axis while DATA open (phone cam head-track) */
      if (window.__mgToolsDrawer && window.__mgToolsDrawer.syncChromeStable)
        window.__mgToolsDrawer.syncChromeStable();
      else {
        var de = document.documentElement;
        de.classList.toggle(
          "mg-drawer-open",
          open || de.classList.contains("mg-left-open")
        );
      }
    } catch (e) {}
    if (open) {
      paint();
      window.__mgUserChromeTouch = true;
      /* dual-open allowed: left TOOLS drawer may stay open alongside */
    } else {
      unembedAll();
    }
    /* Re-pin shell: shift INSPECT/PAGE; keep DATA docked; leave left menus usable */
    try {
      if (window.__mgChromeTokens && window.__mgChromeTokens.pin)
        window.__mgChromeTokens.pin();
    } catch (ePin) {}
    try {
      var tr = document.getElementById("mg-top-right");
      var root = document.getElementById("mg-root");
      pinDrawerShell();
      if (open) {
        var rw = drawerWidthPx() + "px";
        if (tr) {
          tr.style.setProperty("right", "calc(" + rw + " + 16px)", "important");
          tr.style.setProperty("z-index", "2147483601", "important");
        }
        if (root) root.style.setProperty("z-index", "2147483600", "important");
      } else {
        if (tr) {
          tr.style.setProperty("right", "12px", "important");
          tr.style.setProperty("z-index", "2147483640", "important");
        }
        if (root) root.style.removeProperty("z-index");
        var rs0 = document.getElementById("mg-right-scrim");
        if (rs0) rs0.style.removeProperty("pointer-events");
      }
    } catch (eHard) {}
    positionTab();
    protectLeftMenus();
    raiseEdges();
    log(VER + " · " + (open ? "open " + mode : "closed"));
  }

  function toggle() {
    setOpen(!open);
  }

  function hookDevLog() {
    if (window.__mgRightLogHooked) return;
    window.__mgRightLogHooked = true;
    var prev = window.__mgDevLog;
    window.__mgDevLog = function (lvl, msg, src) {
      try {
        logBuf.push({
          lvl: String(lvl || "info"),
          msg: "[" + (src || "") + "] " + String(msg || ""),
          t: Date.now(),
        });
        if (logBuf.length > 200) logBuf = logBuf.slice(-160);
        if (open && mode === "inspect") {
          var logEl = document.getElementById("mg-right-inspect-log");
          if (logEl) {
            var div = document.createElement("div");
            div.className =
              lvl === "err" || lvl === "error"
                ? "err"
                : lvl === "ok"
                  ? "ok"
                  : "";
            div.textContent = "[" + (src || "") + "] " + String(msg || "");
            logEl.appendChild(div);
            logEl.scrollTop = logEl.scrollHeight;
          }
        }
      } catch (e) {}
      if (typeof prev === "function") return prev.apply(this, arguments);
    };
  }

  function forceRemountNodes() {
    ["mg-right-drawer", "mg-right-tab", "mg-right-scrim"].forEach(function (id) {
      var n = document.getElementById(id);
      if (n && n.parentNode) n.parentNode.removeChild(n);
    });
    el = null;
    tab = null;
    body = null;
    statusEl = null;
  }

  function mount() {
    ensureCss();
    hookDevLog();
    if (document.getElementById("mg-right-drawer")) {
      try {
        var needRemount =
          !window.__mgRightDrawer ||
          window.__mgRightDrawer.ver !== VER ||
          !document.getElementById("mg-right-drawer-css");
        /* New IIFE after hot-reload: locals null while DOM left behind */
        if (!el || !tab || !body) needRemount = true;
        if (!needRemount) {
          var t0 = document.getElementById("mg-right-tab");
          if (!t0) needRemount = true;
          else {
            var tr = t0.getBoundingClientRect();
            if (tr.width < 4 || tr.height < 20) needRemount = true;
          }
        }
        if (needRemount) {
          forceRemountNodes();
        } else {
          el = document.getElementById("mg-right-drawer");
          tab = document.getElementById("mg-right-tab");
          body =
            document.getElementById("mg-right-body") ||
            (el && el.querySelector("#mg-right-body"));
          statusEl =
            document.getElementById("mg-right-status") ||
            (el && el.querySelector("#mg-right-status"));
          ensureCss();
          positionTab();
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
    scrim.id = "mg-right-scrim";
    scrim.onclick = function () {
      setOpen(false);
    };
    root.appendChild(scrim);

    el = document.createElement("div");
    el.id = "mg-right-drawer";
    el.innerHTML =
      '<div class="drw-hd">' +
      '  <div class="ttl"><span class="dot"></span>Data</div>' +
      '  <button type="button" id="mg-right-x" title="Close">×</button>' +
      "</div>" +
      '<div class="drw-tabs-host"></div>' +
      '<div class="drw-body" id="mg-right-body"></div>' +
      '<div class="drw-status" id="mg-right-status">Right · Live · Mkt · Inspect · Chat · Grok</div>';
    el.style.cssText =
      "position:fixed!important;right:0!important;left:auto!important;top:0!important;bottom:0!important;" +
      "width:var(--mg-right-w,min(360px,38vw))!important;max-width:min(440px,46vw)!important;" +
      "z-index:2147483634!important;overflow:hidden!important;" +
      "pointer-events:auto!important;display:flex!important;flex-direction:column!important;" +
      "visibility:visible!important;box-sizing:border-box!important;";
    root.appendChild(el);

    /* Viewport-fixed sibling — always on right edge (not inside drawer transform) */
    tab = document.createElement("button");
    tab.type = "button";
    tab.id = "mg-right-tab";
    tab.className = "mg-edge";
    tab.textContent = "DATA";
    tab.title = "Open data drawer (Live · Mkt · Inspect · Chat · Grok)";
    tab.style.cssText =
      "position:fixed!important;right:0!important;left:auto!important;top:50%!important;" +
      "transform:translateY(-50%)!important;z-index:2147483646!important;" +
      "writing-mode:vertical-rl;padding:16px 8px;margin:0;" +
      "min-width:28px!important;min-height:72px!important;width:28px;" +
      "pointer-events:auto!important;visibility:visible!important;opacity:1!important;" +
      "display:block!important;cursor:pointer;" +
      "border:1px solid rgba(255,255,255,0.12);border-right:0;" +
      "border-radius:10px 0 0 10px;" +
      "background:rgba(36,36,40,0.94);color:rgba(255,255,255,0.9);" +
      "font:600 10px/1 -apple-system,system-ui;letter-spacing:0.1em;" +
      "text-transform:uppercase;white-space:nowrap;";
    tab.onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      window.__mgUserChromeTouch = true;
      toggle();
    };
    root.appendChild(tab);

    body = el.querySelector("#mg-right-body");
    statusEl = el.querySelector("#mg-right-status");
    el.querySelector("#mg-right-x").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      setOpen(false);
    };

    if (!window.__mgRightDrawerEsc) {
      window.__mgRightDrawerEsc = true;
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
    positionTab();
    raiseEdges();
    var rehomeLast = 0;
    function rehome(force) {
      var now = Date.now();
      if (!force && now - rehomeLast < 400) return;
      rehomeLast = now;
      var r = chromeRoot();
      ["mg-right-drawer", "mg-right-scrim", "mg-right-tab"].forEach(function (
        id
      ) {
        var n = document.getElementById(id);
        if (n && n.parentNode !== r) r.appendChild(n);
      });
    }
    rehome(true);
    window.addEventListener(
      "scroll",
      function () {
        rehome(false);
      },
      { passive: true, capture: true }
    );
    window.addEventListener(
      "resize",
      function () {
        positionTab();
      },
      { passive: true }
    );
    log(VER + " · right data drawer ready");
  }

  window.__mgRightDrawer = {
    ver: VER,
    open: function (m) {
      if (m) mode = m;
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: toggle,
    isOpen: function () {
      return open;
    },
    setMode: function (m) {
      mode = m || "live";
      if (open) paint();
    },
    paint: paint,
    report: function () {
      return VER + " open=" + open + " mode=" + mode;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    setTimeout(mount, 100);
  }
})();

/* === COMPANION_DATA_BENCH (sync bake · source is mg-data-bench.js) === */
/* Memory Glass · DATA Bench v3
 * Working tools from THIS machine — not remote freya.world / pages.dev embeds.
 *   · native panels (load-bal, cable, spectrum, freya calc, BOM)
 *   · local uvspeed apps iframe'd from http://127.0.0.1:8765 (uvspeed/web)
 *   · OPEN FULL → same local URL (or file:// fallback)
 * Serve: python3 -m http.server 8765 --bind 127.0.0.1  (cwd = uvspeed/web)
 * VER: mg-data-bench-v3.1-dual-safe
 */
(function () {
  "use strict";
  var VER = "mg-data-bench-v3.1-dual-safe";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._dataBenchVer === VER) return;
  HP._dataBenchVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var LOCAL =
    window.__mgUvspeedRoot ||
    "/Volumes/qbitOS/00.dev/projects/uvspeed/web";
  /* Loopback so WKWebView can iframe real tools (file:// blocked under https parent). */
  var LOCAL_HTTP =
    window.__mgUvspeedHttp ||
    "http://127.0.0.1:8765";

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "bench");
    } catch (e) {}
  }

  var state = {
    trade: "electric",
    tool: "load-bal",
    notes: [],
    lastGutter: null,
    lastBom: null,
    lastLoad: null,
  };

  var PREFIXES = [
    { id: "import", sym: "-n:", re: /^\s*(import|from|require|#include)/i },
    { id: "class", sym: "+0:", re: /^\s*(class|interface|struct)\b/i },
    { id: "function", sym: "0:", re: /^\s*(function|def|fn)\b/i },
    { id: "comment", sym: "+1:", re: /^\s*(\/\/|#|\/\*)/ },
    { id: "condition", sym: "+n:", re: /^\s*(if|else|switch)\b/i },
    { id: "loop", sym: "+2:", re: /^\s*(for|while)\b/i },
    { id: "return", sym: "-0:", re: /^\s*(return|yield)\b/i },
    { id: "output", sym: "+3:", re: /^\s*(print|console\.)/i },
  ];

  var TRADES = [
    {
      id: "electric",
      label: "Electrician",
      glyph: "⚡",
      hint: "Load balance · phase · VA",
      tools: ["load-bal", "freya-calc", "hexbench", "grid"],
    },
    {
      id: "signal",
      label: "Signal / RF",
      glyph: "📡",
      hint: "Cable · spectrum · freq",
      tools: ["cable-cal", "spectrum", "hexcast", "questcast", "jawta"],
    },
    {
      id: "construct",
      label: "Construction",
      glyph: "🏗️",
      hint: "BOM · sizes → pynote",
      tools: ["pynote", "archflow", "freya-calc", "freya"],
    },
    {
      id: "data",
      label: "Data / Lab",
      glyph: "◈",
      hint: "Full local bench apps",
      tools: ["persona-tensor", "hexbench", "freya", "grid", "feed", "qa", "notepad"],
    },
  ];

  var TOOLS = {
    "load-bal": {
      id: "load-bal",
      label: "Load Balance",
      kind: "native",
      panel: "electric",
      desc: "3φ / 1φ load chart · live bars",
    },
    "cable-cal": {
      id: "cable-cal",
      label: "Cable / Harness",
      kind: "native",
      panel: "signal",
      desc: "Length · dB loss · Z quick cal",
    },
    spectrum: {
      id: "spectrum",
      label: "Frequency / Spectrum",
      kind: "native",
      panel: "spectrum",
      desc: "Band · λ · MHz math",
    },
    "freya-calc": {
      id: "freya-calc",
      label: "Freya Math",
      kind: "native",
      panel: "freya",
      local: "freya.html",
      desc: "Field calc · OPEN FULL → FreyaUnits",
    },
    pynote: {
      id: "pynote",
      label: "Materials BOM",
      kind: "native",
      panel: "pynote",
      desc: "Construction list → desk",
    },
    "persona-tensor": {
      id: "persona-tensor",
      label: "Persona · Tensor",
      kind: "local",
      local: "persona-tensor-scaffold.html",
      desc: "Memory Glass × grok-build day-loop scaffold (L0–L5)",
    },
    hexbench: {
      id: "hexbench",
      label: "Hex Bench",
      kind: "local",
      local: "hexbench.html",
      desc: "Voltage lab · PSU (local uvspeed)",
    },
    archflow: {
      id: "archflow",
      label: "Arch Flow",
      kind: "local",
      local: "archflow.html",
      desc: "Mermaid / architecture (local)",
    },
    hexcast: {
      id: "hexcast",
      label: "Hex Cast",
      kind: "local",
      local: "hexcast.html",
      desc: "Signal cast (local)",
    },
    questcast: {
      id: "questcast",
      label: "Quest Cast",
      kind: "local",
      local: "questcast.html",
      desc: "Quest cast (local)",
    },
    jawta: {
      id: "jawta",
      label: "Jawta Audio",
      kind: "local",
      local: "jawta-audio.html",
      desc: "Audio path (local)",
    },
    feed: {
      id: "feed",
      label: "Feed",
      kind: "local",
      local: "feed.html",
      desc: "Feed board (local)",
    },
    grid: {
      id: "grid",
      label: "Grid",
      kind: "local",
      local: "grid.html",
      desc: "Grid (local)",
    },
    qa: {
      id: "qa",
      label: "QA",
      kind: "local",
      local: "qa.html",
      desc: "QA checklist (local)",
    },
    freya: {
      id: "freya",
      label: "Freya Units",
      kind: "local",
      local: "freya.html",
      desc: "Full FreyaUnits app (local)",
    },
    notepad: {
      id: "notepad",
      label: "Quantum Notepad",
      kind: "local",
      local: "quantum-notepad.html",
      desc: "Notepad (local)",
    },
  };

  function toolById(id) {
    return TOOLS[id] || null;
  }
  function tradeById(id) {
    for (var i = 0; i < TRADES.length; i++)
      if (TRADES[i].id === id) return TRADES[i];
    return TRADES[0];
  }

  function localFileUrl(file) {
    if (!file) return null;
    var root = String(LOCAL).replace(/\/$/, "");
    return "file://" + root + "/" + file.replace(/^\//, "");
  }

  function localHttpUrl(file) {
    if (!file) return null;
    var base = String(LOCAL_HTTP).replace(/\/$/, "");
    return base + "/" + file.replace(/^\//, "");
  }

  /** Prefer loopback HTTP (iframe works). file:// only for full-window nav fallback. */
  function toolUrl(t, preferFile) {
    if (!t || !t.local) return null;
    if (preferFile) return localFileUrl(t.local);
    return localHttpUrl(t.local) || localFileUrl(t.local);
  }

  function navigateUrl(url) {
    if (!url) return false;
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
        return true;
      }
    } catch (e) {}
    try {
      location.href = url;
      return true;
    } catch (e2) {
      return false;
    }
  }

  function openFull(toolId) {
    var t = toolById(toolId || state.tool);
    if (!t) return false;
    if (t.local) {
      var u = toolUrl(t, false) || localFileUrl(t.local);
      log("OPEN FULL local " + u);
      return navigateUrl(u);
    }
    return false;
  }

  /* ── Quantum gutter ── */
  function classifyLine(line) {
    var s = String(line || "");
    for (var i = 0; i < PREFIXES.length; i++) {
      if (PREFIXES[i].re.test(s)) return PREFIXES[i];
    }
    return { id: "default", sym: "0:" };
  }

  function gutterPage() {
    var spine = [];
    ["header", "nav", "main", "aside", "footer", "form", "table", "canvas", "video"].forEach(
      function (tag) {
        var n = document.getElementsByTagName(tag).length;
        if (n) spine.push({ tag: tag, n: n, pfx: classifyLine(tag) });
      }
    );
    var boiler = "html5";
    try {
      var h = (document.documentElement.outerHTML || "").slice(0, 6000).toLowerCase();
      if (h.indexOf("_next") >= 0 || h.indexOf("react") >= 0) boiler = "react";
      else if (document.querySelector("script[type='module']")) boiler = "esm-module";
    } catch (e) {}
    var meta = {
      t: Date.now(),
      url: location.href,
      host: location.hostname || "",
      ready: document.readyState,
      scripts: document.scripts.length,
      links: document.links.length,
      spine: spine,
      boiler: boiler,
    };
    state.lastGutter = meta;
    window.__mgPageGutter = meta;
    return meta;
  }

  function freyaQuickCalc(expr) {
    try {
      var s = String(expr || "")
        .replace(/[^0-9+\-*/().,\s^eE]/g, "")
        .replace(/\^/g, "**");
      if (!s.trim()) return null;
      var v = Function('"use strict";return (' + s + ")")();
      if (typeof v !== "number" || !isFinite(v)) return null;
      return v;
    } catch (e) {
      return null;
    }
  }

  /* ── Native: electrician load balance ── */
  function renderElectric() {
    var box = document.createElement("div");
    box.className = "mg-bench-panel";
    box.innerHTML =
      '<div class="sec-lbl">⚡ Load balance · field chart</div>' +
      '<div class="mg-bench-grid3">' +
      '<label>V <input id="mg-lb-v" type="number" value="120" step="1"/></label>' +
      '<label>φ <select id="mg-lb-ph"><option value="1">1φ</option><option value="3" selected>3φ</option></select></label>' +
      '<label>PF <input id="mg-lb-pf" type="number" value="0.9" min="0.1" max="1" step="0.05"/></label>' +
      "</div>" +
      '<div class="mg-bench-grid3">' +
      '<label>A L1 <input id="mg-lb-a1" type="number" value="18" step="0.1"/></label>' +
      '<label>A L2 <input id="mg-lb-a2" type="number" value="22" step="0.1"/></label>' +
      '<label>A L3 <input id="mg-lb-a3" type="number" value="15" step="0.1"/></label>' +
      "</div>" +
      '<button type="button" class="hot" id="mg-lb-go">Balance chart</button>' +
      '<div id="mg-lb-bars" class="mg-lb-bars"></div>' +
      '<pre id="mg-lb-out" class="mg-bench-out">—</pre>' +
      '<button type="button" id="mg-lb-desk">→ DESK</button>';
    setTimeout(function () {
      function run() {
        var V = parseFloat(box.querySelector("#mg-lb-v").value) || 120;
        var ph = parseInt(box.querySelector("#mg-lb-ph").value, 10) || 1;
        var pf = parseFloat(box.querySelector("#mg-lb-pf").value) || 0.9;
        var a1 = parseFloat(box.querySelector("#mg-lb-a1").value) || 0;
        var a2 = parseFloat(box.querySelector("#mg-lb-a2").value) || 0;
        var a3 = parseFloat(box.querySelector("#mg-lb-a3").value) || 0;
        var amps = ph === 3 ? [a1, a2, a3] : [a1, a2];
        var maxA = Math.max.apply(null, amps.concat([1]));
        var sumA = amps.reduce(function (s, a) {
          return s + a;
        }, 0);
        var avg = sumA / amps.length;
        var imbalance =
          avg > 0
            ? (Math.max.apply(null, amps) - Math.min.apply(null, amps)) / avg
            : 0;
        var kVA =
          ph === 3
            ? (Math.sqrt(3) * V * sumA) / 1000
            : (V * sumA) / 1000;
        var kW = kVA * pf;
        var bars = box.querySelector("#mg-lb-bars");
        bars.innerHTML = amps
          .map(function (a, i) {
            var pct = Math.min(100, (a / maxA) * 100);
            var hot = avg > 0 && Math.abs(a - avg) / avg > 0.15;
            return (
              '<div class="mg-lb-row"><span>L' +
              (i + 1) +
              "</span><div class=\"mg-lb-track\"><div class=\"mg-lb-fill" +
              (hot ? " hot" : "") +
              '" style="width:' +
              pct +
              '%"></div></div><span>' +
              a.toFixed(1) +
              "A</span></div>"
            );
          })
          .join("");
        var out =
          "V=" +
          V +
          " · " +
          ph +
          "φ · PF=" +
          pf +
          "\nΣA=" +
          sumA.toFixed(1) +
          " · kVA≈" +
          kVA.toFixed(2) +
          " · kW≈" +
          kW.toFixed(2) +
          "\nimbalance=" +
          (imbalance * 100).toFixed(1) +
          "%" +
          (imbalance > 0.2 ? "  ⚠ rebalance phases" : "  ✓ ok");
        box.querySelector("#mg-lb-out").textContent = out;
        state.lastLoad = { V: V, ph: ph, pf: pf, amps: amps, kVA: kVA, kW: kW, imbalance: imbalance, out: out };
      }
      box.querySelector("#mg-lb-go").onclick = run;
      ["#mg-lb-v", "#mg-lb-a1", "#mg-lb-a2", "#mg-lb-a3", "#mg-lb-pf", "#mg-lb-ph"].forEach(
        function (sel) {
          var el = box.querySelector(sel);
          if (el) el.addEventListener("change", run);
        }
      );
      box.querySelector("#mg-lb-desk").onclick = function () {
        run();
        var L = state.lastLoad;
        if (!L) return;
        if (window.__mgAgentDesk) {
          if (window.__mgAgentDesk.open) window.__mgAgentDesk.open();
          if (window.__mgAgentDesk.pushLog) {
            window.__mgAgentDesk.pushLog("sys", "Load balance chart");
            window.__mgAgentDesk.pushLog("you", L.out);
            window.__mgAgentDesk.pushLog(
              "ai",
              L.imbalance > 0.2
                ? "Move loads from heaviest leg toward lightest until ΔA < 15%."
                : "Phases within band · still verify breaker ratings vs continuous load ×1.25."
            );
          }
        }
      };
      run();
    }, 0);
    return box;
  }

  /* ── Native: cable / harness ── */
  function renderSignal() {
    var box = document.createElement("div");
    box.className = "mg-bench-panel";
    box.innerHTML =
      '<div class="sec-lbl">📡 Cable / harness cal</div>' +
      '<div class="mg-bench-grid2">' +
      '<label>Length (m) <input id="mg-cb-len" type="number" value="30" step="0.5"/></label>' +
      '<label>Loss dB/100m <input id="mg-cb-loss" type="number" value="6.5" step="0.1"/></label>' +
      '<label>Freq MHz <input id="mg-cb-f" type="number" value="100" step="1"/></label>' +
      '<label>Z Ω <input id="mg-cb-z" type="number" value="50" step="1"/></label>' +
      "</div>" +
      '<button type="button" class="hot" id="mg-cb-go">Calibrate</button>' +
      '<pre id="mg-cb-out" class="mg-bench-out">—</pre>' +
      '<button type="button" id="mg-cb-full">OPEN hexcast FULL →</button>';
    setTimeout(function () {
      function run() {
        var len = parseFloat(box.querySelector("#mg-cb-len").value) || 0;
        var loss = parseFloat(box.querySelector("#mg-cb-loss").value) || 0;
        var f = parseFloat(box.querySelector("#mg-cb-f").value) || 1;
        var z = parseFloat(box.querySelector("#mg-cb-z").value) || 50;
        var totalDb = (loss * len) / 100;
        var ratio = Math.pow(10, -totalDb / 10);
        var lambda = 300 / f; /* free-space m approx for MHz */
        box.querySelector("#mg-cb-out").textContent =
          "len=" +
          len +
          "m · " +
          f +
          " MHz · Z=" +
          z +
          "Ω\n" +
          "path loss≈" +
          totalDb.toFixed(2) +
          " dB · power ratio≈" +
          (ratio * 100).toFixed(1) +
          "%\n" +
          "λ≈" +
          lambda.toFixed(3) +
          " m · λ/4≈" +
          (lambda / 4).toFixed(3) +
          " m\n" +
          (totalDb > 6 ? "⚠ high loss — shorter run or lower-loss cable" : "✓ loss in band for many harnesses");
      }
      box.querySelector("#mg-cb-go").onclick = run;
      box.querySelector("#mg-cb-full").onclick = function () {
        openFull("hexcast");
      };
      run();
    }, 0);
    return box;
  }

  /* ── Native: spectrum / frequency ── */
  function renderSpectrum() {
    var box = document.createElement("div");
    box.className = "mg-bench-panel";
    box.innerHTML =
      '<div class="sec-lbl">Frequency / spectrum</div>' +
      '<div class="mg-bench-grid2">' +
      '<label>f (MHz) <input id="mg-sp-f" type="number" value="2400" step="1"/></label>' +
      '<label>c factor <input id="mg-sp-vf" type="number" value="0.66" step="0.01" title="velocity factor"/></label>' +
      "</div>" +
      '<button type="button" class="hot" id="mg-sp-go">Compute</button>' +
      '<div id="mg-sp-bands" class="mg-sp-bands"></div>' +
      '<pre id="mg-sp-out" class="mg-bench-out">—</pre>';
    setTimeout(function () {
      var bands = [
        { name: "HF", lo: 3, hi: 30 },
        { name: "VHF", lo: 30, hi: 300 },
        { name: "UHF", lo: 300, hi: 3000 },
        { name: "S", lo: 2000, hi: 4000 },
        { name: "WiFi2.4", lo: 2400, hi: 2500 },
        { name: "WiFi5", lo: 5150, hi: 5850 },
      ];
      function run() {
        var f = parseFloat(box.querySelector("#mg-sp-f").value) || 1;
        var vf = parseFloat(box.querySelector("#mg-sp-vf").value) || 0.66;
        var lam = (300 * vf) / f;
        var hit = bands.filter(function (b) {
          return f >= b.lo && f <= b.hi;
        });
        box.querySelector("#mg-sp-bands").innerHTML = bands
          .map(function (b) {
            var on = f >= b.lo && f <= b.hi;
            return (
              '<span class="mg-sp-chip' +
              (on ? " on" : "") +
              '">' +
              b.name +
              "</span>"
            );
          })
          .join("");
        box.querySelector("#mg-sp-out").textContent =
          f +
          " MHz · VF=" +
          vf +
          "\nλ_cable≈" +
          lam.toFixed(4) +
          " m · λ/2≈" +
          (lam / 2).toFixed(4) +
          " m · λ/4≈" +
          (lam / 4).toFixed(4) +
          " m\nband: " +
          (hit.map(function (h) {
            return h.name;
          }).join(", ") || "—");
      }
      box.querySelector("#mg-sp-go").onclick = run;
      run();
    }, 0);
    return box;
  }

  /* ── Native: freya field math ── */
  function renderFreya() {
    var box = document.createElement("div");
    box.className = "mg-bench-panel";
    box.innerHTML =
      '<div class="sec-lbl">Freya / field math</div>' +
      '<div class="mg-bench-acts">' +
      '<input id="mg-fy-in" placeholder="120*20  ·  (3.5*12)/2  ·  15^2"/>' +
      '<button type="button" class="hot" id="mg-fy-go">=</button></div>' +
      '<div class="mg-bench-presets">' +
      '<button type="button" data-e="120*15">120V·15A</button>' +
      '<button type="button" data-e="240*30">240V·30A</button>' +
      '<button type="button" data-e="(3.5*12)">board-ft rough</button>' +
      '<button type="button" data-e="Math.sqrt(3)*208*20/1000">3φ kVA</button></div>' +
      '<pre id="mg-fy-out" class="mg-bench-out">—</pre>' +
      '<button type="button" id="mg-fy-full">OPEN FreyaUnits FULL →</button>';
    setTimeout(function () {
      var inp = box.querySelector("#mg-fy-in");
      var out = box.querySelector("#mg-fy-out");
      function run() {
        var expr = inp.value;
        if (/Math\.sqrt/.test(expr)) {
          try {
            var v = Function('"use strict";return (' + expr + ")")();
            out.textContent = String(v);
            return;
          } catch (e) {}
        }
        var r = freyaQuickCalc(expr);
        out.textContent = r == null ? "—" : String(r);
      }
      box.querySelector("#mg-fy-go").onclick = run;
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Enter") run();
      });
      Array.prototype.forEach.call(box.querySelectorAll("[data-e]"), function (b) {
        b.onclick = function () {
          inp.value = b.getAttribute("data-e");
          run();
        };
      });
      box.querySelector("#mg-fy-full").onclick = function () {
        openFull("freya-calc");
      };
    }, 0);
    return box;
  }

  /* ── Native: pynote BOM ── */
  function buildBom(lines) {
    var items = [];
    String(lines || "")
      .split(/\n/)
      .forEach(function (raw) {
        var line = raw.trim();
        if (!line) return;
        var m = line.match(
          /^(\d+(?:\.\d+)?)\s*([a-zA-Z%]+)?\s+(.+?)(?:\s+(\d+(?:\.\d+)?)\s*(ft|in|m|cm|mm)?)?$/
        );
        if (m) {
          items.push({
            qty: parseFloat(m[1]),
            unit: (m[2] || "ea").toLowerCase(),
            name: m[3].trim(),
            size: m[4] ? m[4] + (m[5] || "") : "",
          });
        } else items.push({ qty: 1, unit: "ea", name: line, size: "" });
      });
    var md = [
      "# Materials BOM · PyNote",
      "",
      "| Qty | Unit | Material | Size |",
      "|-----|------|----------|------|",
    ];
    items.forEach(function (it) {
      md.push(
        "| " + it.qty + " | " + it.unit + " | " + it.name + " | " + (it.size || "—") + " |"
      );
    });
    md.push("");
    md.push("Add 10% waste · suggest substitutions · rough cost band.");
    var note = { t: Date.now(), items: items, md: md.join("\n"), n: items.length };
    state.lastBom = note;
    return note;
  }

  function renderPynote() {
    var box = document.createElement("div");
    box.className = "mg-bench-panel";
    box.innerHTML =
      '<div class="sec-lbl">🏗️ Materials BOM</div>' +
      '<p class="drw-hint">One line: <code>12 ea 2x4 stud 8ft</code></p>' +
      '<textarea id="mg-bom-in" rows="5" placeholder="24 ea 2x4 stud 8ft\n8 ea 4x8 plywood 1/2in"></textarea>' +
      '<div class="mg-bench-acts">' +
      '<button type="button" class="hot" id="mg-bom-go">Build list</button>' +
      '<button type="button" id="mg-bom-desk">→ DESK</button>' +
      '<button type="button" id="mg-bom-copy">Copy</button></div>' +
      '<pre id="mg-bom-out" class="mg-bench-out"></pre>';
    setTimeout(function () {
      var inp = box.querySelector("#mg-bom-in");
      var out = box.querySelector("#mg-bom-out");
      box.querySelector("#mg-bom-go").onclick = function () {
        out.textContent = buildBom(inp.value).md;
      };
      box.querySelector("#mg-bom-desk").onclick = function () {
        var note = state.lastBom || buildBom(inp.value);
        if (window.__mgAgentDesk) {
          if (window.__mgAgentDesk.open) window.__mgAgentDesk.open();
          if (window.__mgAgentDesk.pushLog) {
            window.__mgAgentDesk.pushLog("sys", "BOM · " + note.n + " lines");
            window.__mgAgentDesk.pushLog("you", note.md.slice(0, 700));
          }
        }
      };
      box.querySelector("#mg-bom-copy").onclick = function () {
        var note = state.lastBom || buildBom(inp.value);
        try {
          if (window.ipc)
            window.ipc.postMessage(
              JSON.stringify({ op: "clipboard_copy", text: note.md })
            );
          else if (navigator.clipboard) navigator.clipboard.writeText(note.md);
        } catch (e) {}
      };
    }, 0);
    return box;
  }

  /* ── Local uvspeed app: real tool iframe (loopback), not remote site ── */
  function renderLocalCard(t) {
    var box = document.createElement("div");
    box.className = "mg-bench-panel mg-bench-local";
    var http = toolUrl(t, false);
    var file = localFileUrl(t.local);
    var path = t.local ? LOCAL + "/" + t.local : "";
    box.innerHTML =
      '<div class="sec-lbl">' +
      (t.label || t.id) +
      " · local</div>" +
      '<p class="drw-hint">' +
      (t.desc || "") +
      " · not freya.world / pages.dev</p>" +
      '<div class="mg-bench-acts">' +
      '<button type="button" class="hot" id="mg-loc-open">OPEN FULL →</button>' +
      '<button type="button" id="mg-loc-reload">Reload</button>' +
      '<button type="button" id="mg-loc-file">file://</button></div>' +
      '<p class="drw-hint mono" id="mg-loc-url">' +
      (http || path) +
      "</p>" +
      '<iframe class="mg-bench-iframe" id="mg-loc-frame" title="' +
      (t.label || t.id) +
      '" src="' +
      (http || "") +
      '" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe>' +
      '<p class="drw-hint" id="mg-loc-hint">If blank: serve uvspeed/web → <code>python3 -m http.server 8765 --bind 127.0.0.1</code></p>';
    setTimeout(function () {
      var fr = box.querySelector("#mg-loc-frame");
      box.querySelector("#mg-loc-open").onclick = function () {
        openFull(t.id);
      };
      box.querySelector("#mg-loc-reload").onclick = function () {
        if (fr && http) {
          fr.src = http + (http.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now();
        }
      };
      box.querySelector("#mg-loc-file").onclick = function () {
        if (file) navigateUrl(file);
      };
      /* probe loopback; if down, show file path + open full */
      if (http) {
        try {
          var img = new Image();
          img.onload = img.onerror = function () {
            /* load event alone isn't enough; leave iframe — user sees tool or blank */
          };
        } catch (e) {}
      }
    }, 0);
    return box;
  }

  function embedTool(host, toolId) {
    if (!host) return false;
    var t = toolById(toolId || state.tool);
    host.innerHTML = "";
    if (!t) {
      host.innerHTML = '<p class="drw-hint">Tool missing</p>';
      return false;
    }
    state.tool = t.id;
    var panel = null;
    if (t.kind === "native") {
      if (t.panel === "electric") panel = renderElectric();
      else if (t.panel === "signal") panel = renderSignal();
      else if (t.panel === "spectrum") panel = renderSpectrum();
      else if (t.panel === "freya") panel = renderFreya();
      else if (t.panel === "pynote") panel = renderPynote();
    } else if (t.kind === "local") {
      panel = renderLocalCard(t);
    }
    if (panel) host.appendChild(panel);
    else host.innerHTML = '<p class="drw-hint">No panel for ' + t.id + "</p>";
    return true;
  }

  function ensureCss() {
    if (document.getElementById("mg-data-bench-css")) return;
    var st = document.createElement("style");
    st.id = "mg-data-bench-css";
    st.textContent = [
      "#mg-right-drawer.bench-mode{--mg-right-w:min(400px,40vw)}",
      "html.mg-left-open #mg-right-drawer.bench-mode{--mg-right-w:min(380px,36vw)!important}",
      "#mg-right-drawer.bench-mode .drw-body,#mg-drawer-bench-host,",
      "#mg-right-drawer.bench-mode .mg-bench-panel{",
      "  max-width:100%!important;box-sizing:border-box!important;overflow-x:hidden!important}",
      ".mg-bench-iframe{max-width:100%!important;box-sizing:border-box!important}",
      ".mg-bench-trades{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}",
      ".mg-bench-trade{appearance:none;cursor:pointer;border:1px solid rgba(255,255,255,0.12);",
      "  background:rgba(255,255,255,0.05);color:rgba(230,240,255,0.8);",
      "  border-radius:999px;padding:7px 10px;font:650 10px/1 system-ui}",
      ".mg-bench-trade.on{border-color:rgba(140,200,255,0.5);color:#9fd0ff;",
      "  background:rgba(40,80,140,0.3)}",
      ".mg-bench-tools{display:flex;flex-direction:column;gap:6px;margin:0 0 12px}",
      ".mg-bench-tool{appearance:none;cursor:pointer;text-align:left;",
      "  border:1px solid rgba(255,255,255,0.1);border-radius:12px;",
      "  background:rgba(0,0,0,0.22);color:inherit;padding:10px 12px}",
      ".mg-bench-tool strong{display:block;font:650 12px/1.2 system-ui;margin-bottom:4px}",
      ".mg-bench-tool span{font:500 11px/1.3 system-ui;color:rgba(200,215,235,0.55)}",
      ".mg-bench-tool.on{border-color:rgba(140,200,255,0.45);background:rgba(40,70,120,0.25)}",
      ".mg-bench-panel{margin:0 0 12px}",
      ".mg-bench-panel .sec-lbl,.mg-bench-gutter .sec-lbl{",
      "  font:650 10px/1 system-ui;letter-spacing:0.12em;text-transform:uppercase;",
      "  color:rgba(160,200,255,0.7);margin:0 0 8px}",
      ".mg-bench-grid2,.mg-bench-grid3{display:grid;gap:8px;margin:0 0 8px}",
      ".mg-bench-grid2{grid-template-columns:1fr 1fr}",
      ".mg-bench-grid3{grid-template-columns:1fr 1fr 1fr}",
      ".mg-bench-panel label{display:flex;flex-direction:column;gap:4px;",
      "  font:600 10px/1 system-ui;color:rgba(180,200,220,0.7)}",
      ".mg-bench-panel input,.mg-bench-panel select,.mg-bench-panel textarea{",
      "  appearance:none;border-radius:8px;border:1px solid rgba(255,255,255,0.12);",
      "  background:rgba(0,0,0,0.35);color:inherit;padding:8px;font:500 12px/1 system-ui}",
      ".mg-bench-panel textarea{width:100%;box-sizing:border-box;min-height:90px}",
      ".mg-bench-acts{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}",
      ".mg-bench-acts input{flex:1;min-width:100px}",
      ".mg-bench-panel button,.mg-bench-acts button{",
      "  appearance:none;cursor:pointer;border:1px solid rgba(255,255,255,0.14);",
      "  background:rgba(255,255,255,0.06);color:inherit;border-radius:10px;",
      "  padding:8px 10px;font:650 10px/1 system-ui;margin:0 6px 6px 0}",
      ".mg-bench-panel button.hot,.mg-bench-acts button.hot{",
      "  border-color:rgba(140,200,255,0.45);color:#9fd0ff}",
      ".mg-bench-presets{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 8px}",
      ".mg-bench-out{margin:0 0 8px;padding:8px 10px;border-radius:10px;",
      "  background:rgba(0,0,0,0.28);font:500 11px/1.4 ui-monospace,Menlo,monospace;",
      "  color:rgba(200,220,240,0.85);white-space:pre-wrap;max-height:180px;overflow:auto}",
      ".mg-lb-bars{display:flex;flex-direction:column;gap:6px;margin:8px 0}",
      ".mg-lb-row{display:grid;grid-template-columns:28px 1fr 40px;gap:8px;align-items:center;",
      "  font:600 10px/1 system-ui}",
      ".mg-lb-track{height:10px;border-radius:999px;background:rgba(255,255,255,0.08);overflow:hidden}",
      ".mg-lb-fill{height:100%;border-radius:999px;background:rgba(80,180,255,0.75)}",
      ".mg-lb-fill.hot{background:rgba(248,113,113,0.85)}",
      ".mg-sp-bands{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}",
      ".mg-sp-chip{padding:4px 8px;border-radius:6px;font:650 9px/1 system-ui;",
      "  background:rgba(255,255,255,0.06);color:rgba(200,210,230,0.6)}",
      ".mg-sp-chip.on{background:rgba(40,100,180,0.35);color:#9fd0ff}",
      ".drw-hint.mono{font:500 10px/1.3 ui-monospace,Menlo,monospace;word-break:break-all}",
      ".mg-bench-gutter{margin:0 0 10px}",
      ".mg-bench-iframe{width:100%;height:min(52vh,480px);border:1px solid rgba(255,255,255,0.12);",
      "  border-radius:12px;background:rgba(0,0,0,0.35);display:block;margin:6px 0}",
    ].join("");
    document.documentElement.appendChild(st);
  }

  function paintBenchInto(body, setStatus) {
    if (!body) return;
    ensureCss();
    var g = gutterPage();

    var head = document.createElement("p");
    head.className = "hint";
    head.textContent =
      "Local uvspeed tools · " + LOCAL_HTTP + " · no remote site embeds";
    body.appendChild(head);

    var trades = document.createElement("div");
    trades.className = "mg-bench-trades";
    TRADES.forEach(function (tr) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mg-bench-trade" + (tr.id === state.trade ? " on" : "");
      b.textContent = (tr.glyph || "") + " " + tr.label;
      b.title = tr.hint || "";
      b.onclick = function () {
        state.trade = tr.id;
        if (tr.tools && tr.tools[0]) state.tool = tr.tools[0];
        /* repaint inside body only — avoid full drawer remount that breaks dual layout */
        if (body && body.parentNode) {
          try {
            body.innerHTML = "";
            paintBenchInto(body, setStatus);
          } catch (eRep) {
            if (window.__mgRightDrawer && window.__mgRightDrawer.setMode)
              window.__mgRightDrawer.setMode("bench");
          }
        }
      };
      trades.appendChild(b);
    });
    body.appendChild(trades);

    var tr = tradeById(state.trade);
    var sub = document.createElement("p");
    sub.className = "hint";
    sub.textContent = (tr && tr.hint) || "";
    body.appendChild(sub);

    var tools = document.createElement("div");
    tools.className = "mg-bench-tools";
    (tr.tools || []).forEach(function (id) {
      var t = toolById(id);
      if (!t) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mg-bench-tool" + (id === state.tool ? " on" : "");
      b.innerHTML =
        "<strong>" +
        t.label +
        (t.kind === "local" ? " · local" : "") +
        "</strong><span>" +
        (t.desc || "") +
        "</span>";
      b.onclick = function () {
        state.tool = id;
        var host = document.getElementById("mg-drawer-bench-host");
        embedTool(host, id);
        Array.prototype.forEach.call(tools.querySelectorAll("button"), function (x) {
          x.classList.toggle("on", x === b);
        });
        if (setStatus) setStatus("bench · " + t.label);
      };
      tools.appendChild(b);
    });
    body.appendChild(tools);

    var gut = document.createElement("div");
    gut.className = "mg-bench-gutter";
    gut.innerHTML =
      '<div class="sec-lbl">Quantum gutter · page spine</div>' +
      '<pre class="mg-bench-out">' +
      "host: " +
      (g.host || "?") +
      "\nboiler: " +
      (g.boiler || "?") +
      "\nready: " +
      g.ready +
      " · scripts=" +
      g.scripts +
      " links=" +
      g.links +
      "\n" +
      (g.spine || [])
        .map(function (s) {
          return s.pfx.sym + " <" + s.tag + "> ×" + s.n;
        })
        .join("\n") +
      "</pre>";
    body.appendChild(gut);

    var host = document.createElement("div");
    host.id = "mg-drawer-bench-host";
    body.appendChild(host);
    embedTool(host, state.tool);

    if (setStatus)
      setStatus(
        "bench · " +
          (tr && tr.label) +
          " · " +
          (toolById(state.tool) && toolById(state.tool).label) +
          " · " +
          (g.boiler || "")
      );
  }

  setTimeout(function () {
    try {
      gutterPage();
    } catch (e) {}
  }, 200);
  window.addEventListener("load", function () {
    setTimeout(function () {
      try {
        gutterPage();
      } catch (e) {}
    }, 400);
  });

  ensureCss();

  window.__mgDataBench = {
    ver: VER,
    paint: paintBenchInto,
    openFull: openFull,
    openTool: openFull,
    embedTool: embedTool,
    toolUrl: function (id) {
      return toolUrl(toolById(id || state.tool), false);
    },
    gutter: gutterPage,
    lastGutter: function () {
      return state.lastGutter;
    },
    buildBom: buildBom,
    freyaCalc: freyaQuickCalc,
    setTrade: function (id) {
      state.trade = id;
    },
    setTool: function (id) {
      state.tool = id;
    },
    localRoot: LOCAL,
    localHttp: LOCAL_HTTP,
    report: function () {
      return (
        VER +
        " trade=" +
        state.trade +
        " tool=" +
        state.tool +
        " http=" +
        LOCAL_HTTP +
        " disk=" +
        LOCAL +
        " gutter=" +
        !!(state.lastGutter && state.lastGutter.boiler)
      );
    },
  };

  log(VER + " · local uvspeed " + LOCAL_HTTP + " · " + LOCAL);
})();
