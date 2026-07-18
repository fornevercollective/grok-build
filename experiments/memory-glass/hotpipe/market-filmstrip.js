/* Memory Glass · market filmstrip + iron-condor WebGrid (P-010a/b)
 * Collapsible side rail (same chrome family as video / Lark).
 * Data: window.__mgFilmstripBoard | localStorage mg.filmstrip.board | paste JSON
 * No auto-trading — research / paper / agent train only.
 * VER: market-filmstrip-v1
 */
(function () {
  "use strict";
  var VER = "market-filmstrip-v2";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._marketFilmstripVer === VER) return;
  HP._marketFilmstripVer = VER;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "info", String(m || ""), "mkt");
    } catch (e) {}
  }

  var LS_BOARD = "mg.filmstrip.board";
  var LS_UI = "mg.filmstrip.ui";
  var state = {
    ver: VER,
    open: false,
    rows: [],
    filter: { sector: "", list: "", bias: "", q: "", stableOnly: true },
    focus: null,
    // iron condor corridor (synthetic BB proxy until options chain)
    condor: { wingK: 1.6, midK: 0.35, hits: 0, misses: 0, trials: 0 },
    volBand: { min: 0.02, max: 0.45 }, // BB width fraction "stabilized window"
    stripCursor: 0,
    viewMode: "list", // list | graph
    graphNodes: [],
    graphEdges: [],
    lastReport: "",
  };

  try {
    var ui = JSON.parse(localStorage.getItem(LS_UI) || "{}");
    if (ui && typeof ui === "object") {
      if (ui.open != null) state.open = !!ui.open;
      if (ui.filter) state.filter = Object.assign(state.filter, ui.filter);
      if (ui.condor) state.condor = Object.assign(state.condor, ui.condor);
    }
  } catch (e) {}

  function saveUi() {
    try {
      localStorage.setItem(
        LS_UI,
        JSON.stringify({
          open: state.open,
          filter: state.filter,
          condor: { wingK: state.condor.wingK, midK: state.condor.midK },
        })
      );
    } catch (e) {}
  }

  function dayFrame(r) {
    return ((r && r.frames) || {}).day || ((r && r.frames) || {}).live || {};
  }

  function bbWidthProxy(r) {
    var d = dayFrame(r);
    // synthetic width from flip recency + bias churn
    var dsf = +d.daysSinceFlip || 30;
    var w = Math.max(0.01, Math.min(0.9, 1 / (1 + dsf / 12)));
    if (d.bbPosition === "above" || d.bbPosition === "below") w *= 1.35;
    return w;
  }

  function isStabilized(r) {
    var w = bbWidthProxy(r);
    return w >= state.volBand.min && w <= state.volBand.max;
  }

  function biasScore(r) {
    var d = dayFrame(r);
    var s = 0;
    if (d.macdBias === "bullish") s += 1;
    if (d.macdBias === "bearish") s -= 1;
    if (d.histogramBias === "bullish") s += 0.5;
    if (d.histogramBias === "bearish") s -= 0.5;
    return s;
  }

  function filtered() {
    var f = state.filter;
    var q = (f.q || "").toUpperCase();
    return (state.rows || []).filter(function (r) {
      if (!r || !r.id) return false;
      if (f.stableOnly && !isStabilized(r)) return false;
      if (f.sector && String(r.sector || "") !== f.sector) return false;
      if (f.list) {
        var lists = r.lists || [];
        if (lists.indexOf(f.list) < 0) return false;
      }
      if (f.bias) {
        var d = dayFrame(r);
        if (String(d.macdBias || "") !== f.bias) return false;
      }
      if (q) {
        var hay = (r.id + " " + (r.name || "") + " " + (r.sector || "")).toUpperCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  /** P-010c: force-graph of list/sector co-membership (X cashtag + RH lists) */
  function buildForceGraph(rows) {
    var maxN = Math.min(rows.length, 80);
    var nodes = [];
    var idx = {};
    for (var i = 0; i < maxN; i++) {
      var r = rows[i];
      idx[r.id] = nodes.length;
      nodes.push({
        id: r.id,
        x: 40 + Math.random() * 280,
        y: 30 + Math.random() * 160,
        vx: 0,
        vy: 0,
        bias: biasScore(r),
        sector: r.sector || "",
      });
    }
    var edges = [];
    var listMap = {};
    for (var j = 0; j < maxN; j++) {
      var rr = rows[j];
      (rr.lists || []).concat(rr.sector ? [rr.sector] : []).forEach(function (L) {
        if (!listMap[L]) listMap[L] = [];
        listMap[L].push(rr.id);
      });
    }
    Object.keys(listMap).forEach(function (L) {
      var arr = listMap[L];
      if (arr.length < 2 || arr.length > 24) return;
      for (var a = 0; a < arr.length; a++) {
        for (var b = a + 1; b < Math.min(arr.length, a + 4); b++) {
          if (idx[arr[a]] == null || idx[arr[b]] == null) continue;
          edges.push({ a: idx[arr[a]], b: idx[arr[b]], list: L });
        }
      }
    });
    state.graphNodes = nodes;
    state.graphEdges = edges.slice(0, 200);
  }

  function stepForceGraph() {
    var nodes = state.graphNodes;
    var edges = state.graphEdges;
    if (!nodes.length) return;
    var i, j, n, m, dx, dy, d, f;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      n.vx *= 0.85;
      n.vy *= 0.85;
      // mild center pull
      n.vx += (180 - n.x) * 0.002;
      n.vy += (100 - n.y) * 0.002;
    }
    for (i = 0; i < nodes.length; i++) {
      for (j = i + 1; j < nodes.length; j++) {
        dx = nodes[j].x - nodes[i].x;
        dy = nodes[j].y - nodes[i].y;
        d = Math.sqrt(dx * dx + dy * dy) || 1;
        f = 40 / (d * d);
        nodes[i].vx -= (dx / d) * f;
        nodes[i].vy -= (dy / d) * f;
        nodes[j].vx += (dx / d) * f;
        nodes[j].vy += (dy / d) * f;
      }
    }
    for (i = 0; i < edges.length; i++) {
      var e = edges[i];
      n = nodes[e.a];
      m = nodes[e.b];
      if (!n || !m) continue;
      dx = m.x - n.x;
      dy = m.y - n.y;
      d = Math.sqrt(dx * dx + dy * dy) || 1;
      f = (d - 55) * 0.01;
      n.vx += (dx / d) * f;
      n.vy += (dy / d) * f;
      m.vx -= (dx / d) * f;
      m.vy -= (dy / d) * f;
    }
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      n.x = Math.max(12, Math.min(340, n.x + n.vx));
      n.y = Math.max(12, Math.min(188, n.y + n.vy));
    }
  }

  function drawForceGraph(cv) {
    if (!cv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = cv.clientWidth || 360;
    var h = cv.clientHeight || 200;
    cv.width = Math.floor(w * dpr);
    cv.height = Math.floor(h * dpr);
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var sx = w / 360;
    var sy = h / 200;
    stepForceGraph();
    var edges = state.graphEdges;
    var nodes = state.graphNodes;
    ctx.strokeStyle = "rgba(120,180,150,0.25)";
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      var a = nodes[e.a];
      var b = nodes[e.b];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x * sx, a.y * sy);
      ctx.lineTo(b.x * sx, b.y * sy);
      ctx.stroke();
    }
    for (var j = 0; j < nodes.length; j++) {
      var n = nodes[j];
      ctx.fillStyle =
        n.bias > 0
          ? "rgba(100,220,160,0.9)"
          : n.bias < 0
            ? "rgba(240,140,120,0.9)"
            : "rgba(180,200,190,0.85)";
      ctx.beginPath();
      ctx.arc(n.x * sx, n.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(220,240,230,0.75)";
      ctx.font = "8px ui-monospace,Menlo,monospace";
      ctx.fillText(n.id, n.x * sx + 5, n.y * sy + 3);
    }
  }

  function sectors() {
    var m = {};
    (state.rows || []).forEach(function (r) {
      var s = r.sector || "?";
      m[s] = (m[s] || 0) + 1;
    });
    return Object.keys(m)
      .sort(function (a, b) {
        return m[b] - m[a];
      })
      .slice(0, 40);
  }

  function loadBoard(obj) {
    var rows = Array.isArray(obj) ? obj : obj && obj.rows ? obj.rows : [];
    state.rows = rows;
    try {
      localStorage.setItem(LS_BOARD, JSON.stringify({ n: rows.length, rows: rows.slice(0, 800) }));
    } catch (e) {
      /* large boards may not fit LS — keep memory only */
    }
    log("ok", "board n=" + rows.length);
    paint();
    return rows.length;
  }

  function tryHydrate() {
    if (window.__mgFilmstripBoard) {
      loadBoard(window.__mgFilmstripBoard);
      return;
    }
    try {
      var raw = localStorage.getItem(LS_BOARD);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && o.rows) loadBoard(o);
      }
    } catch (e) {}
  }

  /** Iron condor geometry (BB proxy): corridor between ± wingK * width around mid */
  function condorRails(r) {
    var d = dayFrame(r);
    var px = +d.close || 0;
    if (!px) return null;
    var w = bbWidthProxy(r);
    var mid = px; // batch close as mid proxy
    var halfWing = mid * w * state.condor.wingK * 0.5;
    var halfShort = mid * w * state.condor.midK * 0.5;
    return {
      px: px,
      longPut: mid - halfWing,
      shortPut: mid - halfShort,
      shortCall: mid + halfShort,
      longCall: mid + halfWing,
      stable: isStabilized(r),
      width: w,
    };
  }

  /** WebGrid-style lane hit: price in short corridor = hit; outside long wings = miss */
  function scoreCondorTrial(r, intent) {
    // intent: "in" stay inside short wings, "edge" short-wing touch
    var rails = condorRails(r);
    if (!rails || !rails.stable) return { ok: false, reason: "unstable" };
    var px = rails.px;
    var insideShort = px >= rails.shortPut && px <= rails.shortCall;
    var insideLong = px >= rails.longPut && px <= rails.longCall;
    var hit = intent === "edge" ? insideLong && !insideShort : insideShort;
    state.condor.trials++;
    if (hit) state.condor.hits++;
    else state.condor.misses++;
    var trial = {
      domain: "flip_condor",
      t: Date.now() / 1000,
      symbol: r.id,
      label: hit ? 1 : 0,
      features: [
        biasScore(r),
        rails.width,
        (px - rails.shortPut) / Math.max(1e-6, rails.shortCall - rails.shortPut),
        rails.stable ? 1 : 0,
      ],
      meta: { intent: intent || "in", rails: rails, ver: VER },
    };
    try {
      var key = "mg.filmstrip.trials";
      var arr = JSON.parse(localStorage.getItem(key) || "[]");
      arr.push(trial);
      if (arr.length > 500) arr = arr.slice(-500);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {}
    // emit to train bus shape if collector present
    try {
      if (window.__mgWebGridPlay && window.__mgWebGridPlay.recordExternal) {
        window.__mgWebGridPlay.recordExternal(trial);
      }
    } catch (e2) {}
    state.lastReport =
      (hit ? "HIT" : "MISS") +
      " " +
      r.id +
      " · " +
      state.condor.hits +
      "/" +
      state.condor.trials +
      " · w=" +
      rails.width.toFixed(3);
    log(hit ? "ok" : "warn", state.lastReport);
    paint();
    return { ok: true, hit: hit, trial: trial };
  }

  function ensureStyles() {
    if (document.getElementById("mg-mkt-css")) return;
    var st = document.createElement("style");
    st.id = "mg-mkt-css";
    st.textContent = [
      "#mg-mkt-rail{position:fixed;top:auto;bottom:48px;right:0;z-index:119;max-height:46%;display:flex;flex-direction:row-reverse;",
      "  font:600 9px/1.25 ui-monospace,Menlo,monospace;pointer-events:none}",
      "#mg-mkt-tab{pointer-events:auto;writing-mode:vertical-rl;transform:rotate(180deg);",
      "  appearance:none;cursor:pointer;border:1px solid rgba(160,180,200,0.28);",
      "  background:rgba(10,12,16,0.94);color:rgba(160,210,255,0.95);padding:10px 6px;",
      "  border-radius:4px 0 0 4px;letter-spacing:0.12em;text-transform:uppercase}",
      "#mg-mkt-panel{pointer-events:auto;width:0;overflow:hidden;transition:width .18s ease;",
      "  background:rgba(8,10,14,0.97);border-left:1px solid rgba(160,180,200,0.28);",
      "  color:rgba(210,225,240,0.92);display:flex;flex-direction:column;max-height:calc(100vh - 56px)}",
      "#mg-mkt-rail.open #mg-mkt-panel{width:min(420px,92vw)}",
      "#mg-mkt-head{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;",
      "  border-bottom:1px solid rgba(160,180,200,0.22);letter-spacing:0.1em;text-transform:uppercase}",
      "#mg-mkt-filters{display:flex;flex-wrap:wrap;gap:4px;padding:6px 8px}",
      "#mg-mkt-filters input,#mg-mkt-filters select{appearance:none;background:rgba(0,0,0,0.35);",
      "  border:1px solid rgba(120,160,140,0.3);color:inherit;padding:4px 6px;border-radius:3px;",
      "  font:inherit;max-width:120px}",
      "#mg-mkt-filters label{display:flex;align-items:center;gap:3px;opacity:0.85}",
      "#mg-mkt-acts{display:flex;flex-wrap:wrap;gap:4px;padding:0 8px 6px}",
      "#mg-mkt-acts button{appearance:none;cursor:pointer;border:1px solid rgba(160,180,200,0.28);",
      "  background:rgba(14,18,24,0.95);color:inherit;padding:5px 7px;border-radius:3px;",
      "  text-transform:uppercase;letter-spacing:0.06em}",
      "#mg-mkt-acts button.hot{border-color:rgba(255,180,100,0.5);color:rgba(255,220,180,0.95)}",
      "#mg-mkt-strip{height:56px;margin:0 8px 6px;border:1px solid rgba(160,180,200,0.22);",
      "  border-radius:3px;background:rgba(0,0,0,0.35);position:relative;overflow:hidden}",
      "#mg-mkt-strip canvas{width:100%;height:100%;display:block}",
      "#mg-mkt-graph{height:0;margin:0 8px 6px;border:1px solid rgba(160,180,200,0.22);",
      "  border-radius:3px;background:rgba(0,0,0,0.35);overflow:hidden;transition:height .15s}",
      "#mg-mkt-rail.graph #mg-mkt-graph{height:200px}",
      "#mg-mkt-graph canvas{width:100%;height:100%;display:block}",
      "#mg-mkt-list{flex:1;overflow:auto;padding:0 8px 10px;min-height:120px}",
      "#mg-mkt-list .row{display:grid;grid-template-columns:52px 1fr 48px 56px;gap:4px;",
      "  padding:4px 2px;border-bottom:1px solid rgba(80,120,100,0.15);cursor:pointer}",
      "#mg-mkt-list .row:hover,#mg-mkt-list .row.on{background:rgba(40,80,60,0.25)}",
      "#mg-mkt-list .sym{color:rgba(160,210,255,0.95)}",
      "#mg-mkt-list .bull{color:rgba(120,220,160,0.9)}",
      "#mg-mkt-list .bear{color:rgba(240,140,120,0.9)}",
      "#mg-mkt-condor{padding:6px 8px;border-top:1px solid rgba(100,160,140,0.2);font-weight:500}",
      "#mg-mkt-status{padding:4px 8px 8px;opacity:0.8;font-weight:500}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  var rail, listEl, stripCv, graphCv, statusEl, condorEl, graphRaf;

  function drawStrip(rows) {
    if (!stripCv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = stripCv.clientWidth || 360;
    var h = stripCv.clientHeight || 56;
    stripCv.width = Math.floor(w * dpr);
    stripCv.height = Math.floor(h * dpr);
    var ctx = stripCv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var n = Math.min(rows.length, 120);
    if (!n) {
      ctx.fillStyle = "rgba(140,160,150,0.5)";
      ctx.fillText("no rows — LOAD board / paste JSON", 8, h / 2);
      return;
    }
    var cell = w / n;
    for (var i = 0; i < n; i++) {
      var r = rows[i];
      var rails = condorRails(r);
      var bs = biasScore(r);
      var g = bs > 0 ? 160 + bs * 40 : 80;
      var rd = bs < 0 ? 160 - bs * 40 : 60;
      ctx.fillStyle = "rgba(" + rd + "," + g + ",120," + (rails && rails.stable ? 0.85 : 0.35) + ")";
      var barH = rails ? Math.max(4, Math.min(h - 4, rails.width * h * 2.2)) : 8;
      ctx.fillRect(i * cell + 0.5, h - barH - 2, Math.max(1, cell - 1), barH);
      // condor short corridor mark
      if (rails && rails.stable) {
        ctx.fillStyle = "rgba(255,220,140,0.55)";
        ctx.fillRect(i * cell + 0.5, h * 0.42, Math.max(1, cell - 1), 3);
      }
    }
    // cursor like film strip frame
    var cur = state.stripCursor % n;
    ctx.strokeStyle = "rgba(200,255,220,0.9)";
    ctx.strokeRect(cur * cell, 1, cell, h - 2);
  }

  function paintList(rows) {
    if (!listEl) return;
    listEl.innerHTML = "";
    var show = rows.slice(0, 200);
    show.forEach(function (r, idx) {
      var d = dayFrame(r);
      var el = document.createElement("div");
      el.className = "row" + (state.focus && state.focus.id === r.id ? " on" : "");
      var bias = d.macdBias || "?";
      el.innerHTML =
        '<span class="sym">' +
        r.id +
        '</span><span title="' +
        (r.sector || "") +
        '">' +
        (r.sector || "").slice(0, 22) +
        '</span><span class="' +
        (bias === "bullish" ? "bull" : bias === "bearish" ? "bear" : "") +
        '">' +
        bias.slice(0, 4) +
        '</span><span>' +
        (d.daysSinceFlip != null ? "d" + d.daysSinceFlip : "—") +
        "</span>";
      el.onclick = function () {
        state.focus = r;
        state.stripCursor = idx;
        paint();
      };
      listEl.appendChild(el);
    });
  }

  function paint() {
    var rows = filtered();
    drawStrip(rows);
    paintList(rows);
    if (state.viewMode === "graph") {
      if (!state.graphNodes.length || state.graphNodes.length !== Math.min(rows.length, 80)) {
        buildForceGraph(rows);
      }
      if (rail) rail.classList.add("graph");
      drawForceGraph(graphCv);
      if (!graphRaf) {
        graphRaf = requestAnimationFrame(function tick() {
          if (state.viewMode !== "graph" || !state.open) {
            graphRaf = 0;
            return;
          }
          drawForceGraph(graphCv);
          graphRaf = requestAnimationFrame(tick);
        });
      }
    } else if (rail) {
      rail.classList.remove("graph");
    }
    if (condorEl) {
      var f = state.focus;
      if (f) {
        var rails = condorRails(f);
        condorEl.textContent = rails
          ? f.id +
            " · px " +
            rails.px.toFixed(2) +
            " · wings [" +
            rails.longPut.toFixed(2) +
            " · " +
            rails.shortPut.toFixed(2) +
            " | " +
            rails.shortCall.toFixed(2) +
            " · " +
            rails.longCall.toFixed(2) +
            "] · " +
            (rails.stable ? "STABLE" : "VOL") +
            " w=" +
            rails.width.toFixed(3)
          : f.id + " · no rails";
      } else {
        condorEl.textContent =
          "condor " +
          state.condor.hits +
          "/" +
          state.condor.trials +
          " · stable window BB-proxy · no auto-trade";
      }
    }
    if (statusEl) {
      statusEl.textContent =
        VER +
        " · n " +
        (state.rows || []).length +
        " · view " +
        rows.length +
        (state.lastReport ? " · " + state.lastReport : "");
    }
  }

  function setOpen(on) {
    state.open = !!on;
    if (rail) rail.classList.toggle("open", state.open);
    saveUi();
    if (state.open) paint();
  }

  function mount() {
    ensureStyles();
    if (document.getElementById("mg-mkt-rail")) return;
    rail = document.createElement("div");
    rail.id = "mg-mkt-rail";
    rail.innerHTML =
      '<button type="button" id="mg-mkt-tab" title="Market filmstrip">MKT</button>' +
      '<div id="mg-mkt-panel">' +
      '  <div id="mg-mkt-head"><span>Filmstrip · Iron Condor</span>' +
      '  <button type="button" id="mg-mkt-close" style="appearance:none;background:transparent;border:0;color:inherit;cursor:pointer">×</button></div>' +
      '  <div id="mg-mkt-filters">' +
      '    <input id="mg-mkt-q" placeholder="sym/sector" />' +
      '    <select id="mg-mkt-sec"><option value="">sector</option></select>' +
      '    <select id="mg-mkt-bias"><option value="">bias</option>' +
      '      <option value="bullish">bull</option><option value="bearish">bear</option></select>' +
      '    <label><input type="checkbox" id="mg-mkt-stable" checked /> stable</label>' +
      "  </div>" +
      '  <div id="mg-mkt-acts">' +
      '    <button type="button" id="mg-mkt-load">LOAD</button>' +
      '    <button type="button" id="mg-mkt-reload">FILE</button>' +
      '    <button type="button" id="mg-mkt-paste">PASTE</button>' +
      '    <button type="button" id="mg-mkt-graph-btn">GRAPH</button>' +
      '    <button type="button" id="mg-mkt-hit" class="hot">HIT IN</button>' +
      '    <button type="button" id="mg-mkt-edge">HIT EDGE</button>' +
      '    <button type="button" id="mg-mkt-export">TRIALS→</button>' +
      "  </div>" +
      '  <div id="mg-mkt-strip"><canvas id="mg-mkt-cv"></canvas></div>' +
      '  <div id="mg-mkt-graph"><canvas id="mg-mkt-gcv"></canvas></div>' +
      '  <div id="mg-mkt-list"></div>' +
      '  <div id="mg-mkt-condor"></div>' +
      '  <div id="mg-mkt-status"></div>' +
      "</div>";
    (document.body || document.documentElement).appendChild(rail);
    listEl = rail.querySelector("#mg-mkt-list");
    stripCv = rail.querySelector("#mg-mkt-cv");
    graphCv = rail.querySelector("#mg-mkt-gcv");
    statusEl = rail.querySelector("#mg-mkt-status");
    condorEl = rail.querySelector("#mg-mkt-condor");

    rail.querySelector("#mg-mkt-tab").onclick = function () {
      setOpen(!state.open);
    };
    rail.querySelector("#mg-mkt-close").onclick = function () {
      setOpen(false);
    };
    rail.querySelector("#mg-mkt-q").oninput = function (ev) {
      state.filter.q = ev.target.value || "";
      saveUi();
      paint();
    };
    rail.querySelector("#mg-mkt-bias").onchange = function (ev) {
      state.filter.bias = ev.target.value || "";
      saveUi();
      paint();
    };
    rail.querySelector("#mg-mkt-stable").onchange = function (ev) {
      state.filter.stableOnly = !!ev.target.checked;
      saveUi();
      paint();
    };
    rail.querySelector("#mg-mkt-sec").onchange = function (ev) {
      state.filter.sector = ev.target.value || "";
      saveUi();
      paint();
    };
    rail.querySelector("#mg-mkt-load").onclick = function () {
      tryHydrate();
      // refill sector select
      var sel = rail.querySelector("#mg-mkt-sec");
      var cur = state.filter.sector;
      sel.innerHTML = '<option value="">sector</option>';
      sectors().forEach(function (s) {
        var o = document.createElement("option");
        o.value = s;
        o.textContent = s.slice(0, 28);
        if (s === cur) o.selected = true;
        sel.appendChild(o);
      });
      state.graphNodes = [];
      paint();
    };
    rail.querySelector("#mg-mkt-reload").onclick = function () {
      try {
        if (window.ipc && window.ipc.postMessage) {
          window.ipc.postMessage(JSON.stringify({ op: "load_filmstrip" }));
          state.lastReport = "native filmstrip reload";
        } else {
          tryHydrate();
        }
      } catch (e) {
        tryHydrate();
      }
      paint();
    };
    rail.querySelector("#mg-mkt-graph-btn").onclick = function () {
      state.viewMode = state.viewMode === "graph" ? "list" : "graph";
      state.graphNodes = [];
      paint();
    };
    rail.querySelector("#mg-mkt-paste").onclick = function () {
      var t = prompt("Paste rows.json array or {rows:[...]} (slim ok)");
      if (!t) return;
      try {
        loadBoard(JSON.parse(t));
      } catch (e) {
        log("err", "paste parse fail");
      }
    };
    rail.querySelector("#mg-mkt-hit").onclick = function () {
      if (state.focus) scoreCondorTrial(state.focus, "in");
      else log("warn", "select a symbol");
    };
    rail.querySelector("#mg-mkt-edge").onclick = function () {
      if (state.focus) scoreCondorTrial(state.focus, "edge");
    };
    rail.querySelector("#mg-mkt-export").onclick = function () {
      try {
        var arr = JSON.parse(localStorage.getItem("mg.filmstrip.trials") || "[]");
        var blob = new Blob([JSON.stringify(arr, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "mg-condor-trials.json";
        a.click();
        statusEl.textContent = "exported " + arr.length + " trials";
      } catch (e) {
        log("err", "export fail");
      }
    };

    if (state.open) rail.classList.add("open");
    tryHydrate();
    // sector options
    var sel = rail.querySelector("#mg-mkt-sec");
    sectors().forEach(function (s) {
      var o = document.createElement("option");
      o.value = s;
      o.textContent = s.slice(0, 28);
      sel.appendChild(o);
    });
    paint();
    log("ok", VER + " · collapsible MKT rail");
  }

  window.__mgMarket = {
    ver: VER,
    state: state,
    loadBoard: loadBoard,
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: function () {
      setOpen(!state.open);
    },
    filtered: filtered,
    scoreCondorTrial: scoreCondorTrial,
    condorRails: condorRails,
    isStabilized: isStabilized,
    report: function () {
      return (
        VER +
        " n=" +
        (state.rows || []).length +
        " view=" +
        filtered().length +
        " condor=" +
        state.condor.hits +
        "/" +
        state.condor.trials
      );
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
