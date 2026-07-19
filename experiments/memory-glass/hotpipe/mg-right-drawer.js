/* Memory Glass · RIGHT DATA DRAWER
 * Viewport-fixed on <html> (not body — page-axis transform).
 * Localizes monitor/readout surfaces: Live · Mkt · Inspect · Chat · Grok
 * Pairs with left TOOLS control drawer. Tab docks to right wall and rides open.
 * VER: mg-right-drawer-v9-chrome-stable
 */
(function () {
  "use strict";
  var VER = "mg-right-drawer-v9-chrome-stable";
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
      "  --mg-right-w:min(360px,90vw);",
      "  position:fixed!important;right:0!important;top:0!important;bottom:0!important;",
      "  left:auto!important;width:var(--mg-right-w);",
      "  z-index:2147483634;pointer-events:auto;",
      "  display:flex;flex-direction:column;",
      "  transform:translate3d(100%,0,0)!important;",
      "  transition:transform .22s cubic-bezier(.2,.9,.2,1);",
      "  background:rgba(40,40,44,0.52)!important;",
      "  backdrop-filter:blur(48px) saturate(1.8)!important;",
      "  -webkit-backdrop-filter:blur(48px) saturate(1.8)!important;",
      "  border-left:1px solid rgba(255,255,255,0.12);",
      "  box-shadow:-12px 0 40px rgba(0,0,0,0.32),inset 0 1px 0 rgba(255,255,255,0.12);",
      "  font:500 13px/1.25 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;",
      "  color:rgba(255,255,255,0.92);box-sizing:border-box;overflow:visible;",
      "  margin:0!important;max-height:100vh!important;max-height:100dvh!important}",
      "#mg-right-drawer.open{transform:translate3d(0,0,0)!important}",
      /* Mkt needs filmstrip + charts — widen drawer */
      "#mg-right-drawer.mkt-mode{--mg-right-w:min(440px,94vw)}",
      "#mg-drawer-mkt-host{display:flex;flex-direction:column;min-height:min(70vh,640px);flex:1 1 auto;gap:6px}",
      "#mg-drawer-mkt-host .drw-hint,#mg-right-drawer .drw-hint{",
      "  font:500 11px/1.35 system-ui;color:rgba(255,255,255,0.45);padding:8px 4px}",
      /* Viewport-fixed DATA tab (sibling of drawer — not inside transform) */
      "html > #mg-right-tab,html.mg-webgrid-play > #mg-right-tab{",
      "  position:fixed!important;right:0!important;left:auto!important;top:50%!important;",
      "  z-index:2147483647!important;pointer-events:auto!important;cursor:pointer;",
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
      "html.mg-webgrid-play > #mg-right-drawer,html.mg-webgrid-play > #mg-right-scrim,",
      "html > #mg-right-drawer,html > #mg-right-scrim{",
      "  z-index:2147483634!important;pointer-events:auto!important;visibility:visible!important}",
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
      "  position:fixed!important;inset:0!important;z-index:2147483628;pointer-events:none;",
      "  background:rgba(0,0,0,0.22);opacity:0;transition:opacity .2s;margin:0!important}",
      "#mg-right-scrim.on{opacity:1;pointer-events:auto}",
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

  function paint() {
    if (!body) return;
    unembedAll();
    body.innerHTML = "";
    if (el) el.classList.toggle("mkt-mode", mode === "mkt");
    var tabsHost = el && el.querySelector(".drw-tabs-host");
    if (tabsHost) paintTabs(tabsHost);
    /* Master bar (expand/collapse) is noise on Mkt — filmstrip is the body */
    if (mode !== "mkt") paintMasterBar(body);
    if (mode === "live") paintLive();
    else if (mode === "mkt") paintMkt();
    else if (mode === "inspect") paintInspect();
    else if (mode === "chat") paintChat();
    else if (mode === "grok") paintGrok();
    positionTab();
  }

  function positionTab() {
    if (!tab) return;
    try {
      if (!open) {
        tab.style.right = "0";
        return;
      }
      var w = 360;
      if (el) {
        var pw = parseFloat(getComputedStyle(el).width);
        if (isFinite(pw) && pw > 80) w = pw;
      }
      tab.style.right = Math.round(w) + "px";
    } catch (e) {
      tab.style.right = open ? "min(360px,90vw)" : "0";
    }
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
    positionTab();
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
          !window.__mgRightDrawer || window.__mgRightDrawer.ver !== VER;
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
          ensureCss();
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
      "position:fixed!important;right:0!important;top:0!important;bottom:0!important;" +
      "width:var(--mg-right-w,min(360px,90vw))!important;z-index:2147483634!important;" +
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
      "position:fixed!important;right:0!important;top:50%!important;" +
      "transform:translateY(-50%)!important;z-index:2147483647!important;" +
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
