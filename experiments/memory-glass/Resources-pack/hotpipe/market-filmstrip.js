/* Memory Glass · market filmstrip + iron-condor WebGrid (P-010a/b)
 * Collapsible side rail (same chrome family as video / Lark).
 * Data: window.__mgFilmstripBoard | localStorage mg.filmstrip.board | paste JSON
 * No auto-trading — research / paper / agent train only.
 * VER: market-filmstrip-v6-trade-flow
 * Bottom charts: BB · RSI · MACD + TF set
 * Live trade interactions trail on GRAPH (contrail / pattern-flow twin)
 */
(function () {
  "use strict";
  var VER = "market-filmstrip-v6-trade-flow";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._marketFilmstripVer === VER) return;
  HP._marketFilmstripVer = VER;

  function chromeRoot() {
    return document.documentElement || document.body;
  }

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
    filter: { sector: "", list: "", bias: "", q: "", stableOnly: false },
    focus: null,
    // iron condor corridor (synthetic BB proxy until options chain)
    condor: { wingK: 1.6, midK: 0.35, hits: 0, misses: 0, trials: 0 },
    volBand: { min: 0.02, max: 0.45 }, // BB width fraction "stabilized window"
    stripCursor: 0,
    viewMode: "list", // list | graph
    graphNodes: [],
    graphEdges: [],
    lastReport: "",
    chartTf: "day", // 1h | 5h | day | week | month | quarter
    chartLimit: 120,
    chartData: null,
    chartLoading: false,
    chartReq: 0,
    chartCache: {}, /* cacheKey → { bars, t, kind } */
    /* live trade interaction flow (contrail twin on force graph) */
    tradeFlow: [], /* {t, id, hit, intent, kind, px, bias} */
    tradeHops: [], /* {t, from, to, hit, intent} symbol-to-symbol path */
    lastTradeId: null,
    flowPulse: {}, /* id → until ms for node glow */
  };

  /* robinhood-agentic chart.js timeframe parity */
  var TF_CFG = {
    "1h": { label: "1h", interval: "60m", range: "60d", kind: "hourly", limit: 120, useDateTime: true },
    "5h": { label: "5h", interval: "60m", range: "60d", kind: "hourly5", limit: 90, useDateTime: true },
    day: { label: "D", interval: "1d", range: "2y", kind: "daily", limit: 120, useDateTime: false },
    week: { label: "W", interval: "1d", range: "5y", kind: "week", limit: 104, useDateTime: false },
    month: { label: "M", interval: "1d", range: "10y", kind: "month", limit: 120, useDateTime: false },
    quarter: { label: "Q", interval: "1d", range: "10y", kind: "quarter", limit: 80, useDateTime: false },
  };
  var TF_ORDER = ["1h", "5h", "day", "week", "month", "quarter"];

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
    /* preserve positions when rebuilding so trade trails stay coherent */
    var prev = {};
    (state.graphNodes || []).forEach(function (n) {
      prev[n.id] = n;
    });
    for (var i = 0; i < maxN; i++) {
      var r = rows[i];
      idx[r.id] = nodes.length;
      var p = prev[r.id];
      nodes.push({
        id: r.id,
        x: p ? p.x : 40 + Math.random() * 280,
        y: p ? p.y : 30 + Math.random() * 160,
        vx: p ? p.vx * 0.3 : 0,
        vy: p ? p.vy * 0.3 : 0,
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
    state._graphIdx = idx;
  }

  /**
   * Record a live trade / attention hop — same spirit as contrail strokes + keyboard pattern flow.
   * kind: "hit" | "miss" | "edge" | "select" | "chart" | "observe"
   */
  function recordTradeFlow(row, meta) {
    meta = meta || {};
    if (!row || !row.id) return null;
    var id = String(row.id);
    var now = Date.now();
    var hit = meta.hit;
    var intent = meta.intent || "";
    var kind = meta.kind || (hit === true ? "hit" : hit === false ? "miss" : "select");
    var d = dayFrame(row);
    var ev = {
      t: now,
      id: id,
      hit: hit,
      intent: intent,
      kind: kind,
      px: d.close != null ? +d.close : null,
      bias: biasScore(row),
      width: bbWidthProxy(row),
    };
    state.tradeFlow.push(ev);
    if (state.tradeFlow.length > 96) state.tradeFlow.shift();

    if (state.lastTradeId && state.lastTradeId !== id) {
      state.tradeHops.push({
        t: now,
        from: state.lastTradeId,
        to: id,
        hit: hit,
        intent: intent,
        kind: kind,
      });
      if (state.tradeHops.length > 64) state.tradeHops.shift();
    }
    state.lastTradeId = id;
    state.flowPulse[id] = now + (kind === "hit" || kind === "miss" || kind === "edge" ? 2200 : 900);

    /* auto-open graph so live path is visible (like contrail flow panel) */
    if (meta.showGraph !== false && (kind === "hit" || kind === "miss" || kind === "edge")) {
      if (state.viewMode !== "graph") {
        state.viewMode = "graph";
        state.graphNodes = [];
      }
    }

    try {
      if (window.__mgContrail && window.__mgContrail.observe) {
        /* optional bridge — not all contrail builds expose observe */
        window.__mgContrail.observe({
          src: "mkt-trade",
          id: id,
          kind: kind,
          hit: hit,
        });
      }
    } catch (eC) {}

    try {
      var bc = new BroadcastChannel("mg-mkt-flow");
      bc.postMessage({
        type: "mkt.trade.flow",
        ver: VER,
        event: ev,
        hops: state.tradeHops.length,
        ts: now,
      });
      bc.close();
    } catch (eB) {}

    return ev;
  }

  function nodeById(id) {
    var nodes = state.graphNodes || [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) return nodes[i];
    }
    return null;
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
    /* glass field */
    ctx.fillStyle = "rgba(8,10,14,0.92)";
    ctx.fillRect(0, 0, w, h);
    var sx = w / 360;
    var sy = h / 200;
    stepForceGraph();
    var edges = state.graphEdges;
    var nodes = state.graphNodes;
    var now = Date.now();

    /* base co-membership edges — quiet */
    ctx.strokeStyle = "rgba(120,180,150,0.18)";
    ctx.lineWidth = 1;
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

    /* ── live trade hops = contrail / pattern-flow path on the graph ── */
    var hops = state.tradeHops || [];
    for (var hi = 0; hi < hops.length; hi++) {
      var hop = hops[hi];
      var age = (now - hop.t) / 8000;
      if (age > 1) continue;
      var na = nodeById(hop.from);
      var nb = nodeById(hop.to);
      if (!na || !nb) continue;
      var fade = 1 - age;
      var col =
        hop.kind === "hit" || hop.hit === true
          ? "100,220,160"
          : hop.kind === "miss" || hop.hit === false
            ? "240,120,120"
            : hop.kind === "edge"
              ? "255,180,100"
              : "120,180,255";
      /* soft glow trail */
      ctx.strokeStyle = "rgba(" + col + "," + (0.12 * fade) + ")";
      ctx.lineWidth = 8 * fade;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(na.x * sx, na.y * sy);
      ctx.lineTo(nb.x * sx, nb.y * sy);
      ctx.stroke();
      /* core stroke */
      ctx.strokeStyle = "rgba(" + col + "," + (0.35 + 0.55 * fade) + ")";
      ctx.lineWidth = 1.6 + fade;
      ctx.beginPath();
      ctx.moveTo(na.x * sx, na.y * sy);
      ctx.lineTo(nb.x * sx, nb.y * sy);
      ctx.stroke();
      /* mid arrow / hop bead */
      var mx = (na.x + nb.x) * 0.5 * sx;
      var my = (na.y + nb.y) * 0.5 * sy;
      ctx.fillStyle = "rgba(" + col + "," + (0.5 * fade) + ")";
      ctx.beginPath();
      ctx.arc(mx, my, 2.2 * fade + 1, 0, Math.PI * 2);
      ctx.fill();
    }

    /* nodes */
    for (var j = 0; j < nodes.length; j++) {
      var n = nodes[j];
      var px = n.x * sx;
      var py = n.y * sy;
      var pulseUntil = state.flowPulse[n.id] || 0;
      var pulsing = pulseUntil > now;
      var pulseAge = pulsing ? (pulseUntil - now) / 2200 : 0;

      if (pulsing) {
        ctx.strokeStyle =
          "rgba(160,210,255," + (0.15 + 0.45 * pulseAge) + ")";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 8 + 6 * pulseAge, 0, Math.PI * 2);
        ctx.stroke();
      }

      var r0 = 3.5;
      if (state.focus && state.focus.id === n.id) r0 = 5.5;
      if (pulsing) r0 += 1.5 * pulseAge;

      ctx.fillStyle =
        n.bias > 0
          ? "rgba(100,220,160,0.92)"
          : n.bias < 0
            ? "rgba(240,140,120,0.92)"
            : "rgba(180,200,190,0.85)";
      ctx.beginPath();
      ctx.arc(px, py, r0, 0, Math.PI * 2);
      ctx.fill();

      /* trade ring if recently hit/miss */
      var lastEv = null;
      for (var ti = state.tradeFlow.length - 1; ti >= 0; ti--) {
        if (state.tradeFlow[ti].id === n.id) {
          lastEv = state.tradeFlow[ti];
          break;
        }
      }
      if (lastEv && now - lastEv.t < 6000) {
        var fa = 1 - (now - lastEv.t) / 6000;
        ctx.strokeStyle =
          lastEv.hit === true
            ? "rgba(100,230,160," + (0.7 * fa) + ")"
            : lastEv.hit === false
              ? "rgba(255,120,120," + (0.7 * fa) + ")"
              : "rgba(120,180,255," + (0.55 * fa) + ")";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(px, py, r0 + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle =
        state.focus && state.focus.id === n.id
          ? "rgba(255,255,255,0.92)"
          : "rgba(220,240,230,0.72)";
      ctx.font = "600 8px -apple-system,ui-monospace,Menlo,monospace";
      ctx.fillText(n.id, px + 6, py + 3);
    }

    /* HUD: flow legend + last phrase */
    ctx.fillStyle = "rgba(160,190,210,0.55)";
    ctx.font = "600 8px -apple-system,ui-monospace,Menlo,monospace";
    ctx.fillText("TRADE FLOW · hop path", 8, 12);
    var phrase = (state.tradeFlow || [])
      .slice(-10)
      .map(function (e) {
        return e.id;
      })
      .join("→");
    if (phrase) {
      ctx.fillStyle = "rgba(180,210,240,0.75)";
      ctx.fillText("«" + phrase.slice(0, 48) + "»", 8, h - 8);
    }
    var hits = state.condor.hits || 0;
    var trials = state.condor.trials || 0;
    ctx.fillStyle = "rgba(160,200,180,0.65)";
    ctx.fillText(
      hits + "/" + trials + " · hops " + (state.tradeHops || []).length,
      w - 92,
      12
    );
  }

  /** Compact time-unwind strip of recent trade events (contrail twin) */
  function drawTradeFlowStrip(cv) {
    if (!cv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = cv.clientWidth || 360;
    var h = cv.clientHeight || 48;
    cv.width = Math.floor(w * dpr);
    cv.height = Math.floor(h * dpr);
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(8,10,14,0.9)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(160,190,210,0.5)";
    ctx.font = "600 8px -apple-system,ui-monospace,Menlo,monospace";
    ctx.fillText("UNWIND · trade∠×t", 6, 11);
    ctx.strokeStyle = "rgba(100,130,160,0.22)";
    ctx.beginPath();
    ctx.moveTo(6, h * 0.55);
    ctx.lineTo(w - 6, h * 0.55);
    ctx.stroke();
    var flow = state.tradeFlow || [];
    if (flow.length < 1) {
      ctx.fillStyle = "rgba(140,170,190,0.4)";
      ctx.fillText("HIT IN · EDGE · select → path", 8, h * 0.62);
      return;
    }
    var recent = flow.slice(-48);
    for (var i = 0; i < recent.length; i++) {
      var ev = recent[i];
      var x = 8 + (i / Math.max(1, recent.length - 1)) * (w - 16);
      /* map bias + hit to y */
      var yBias = (ev.bias || 0) * 0.12;
      var yHit = ev.hit === true ? -0.2 : ev.hit === false ? 0.2 : 0;
      var y = h * 0.55 + (yBias + yHit) * (h * 0.35);
      var col =
        ev.hit === true
          ? "100,220,160"
          : ev.hit === false
            ? "240,120,120"
            : ev.kind === "edge"
              ? "255,180,100"
              : "120,180,255";
      ctx.fillStyle = "rgba(" + col + ",0.9)";
      ctx.fillRect(x, y, 2.5, 2.5);
      if (i > 0) {
        var prev = recent[i - 1];
        var px =
          8 + ((i - 1) / Math.max(1, recent.length - 1)) * (w - 16);
        var py =
          h * 0.55 +
          ((prev.bias || 0) * 0.12 +
            (prev.hit === true ? -0.2 : prev.hit === false ? 0.2 : 0)) *
            (h * 0.35);
        ctx.strokeStyle = "rgba(" + col + ",0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
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
      var n0 = loadBoard(window.__mgFilmstripBoard);
      if (n0) {
        state.lastReport = "board n=" + n0 + " · inject";
        return n0;
      }
    }
    try {
      var raw = localStorage.getItem(LS_BOARD);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && o.rows && o.rows.length) {
          var n1 = loadBoard(o);
          state.lastReport = "board n=" + n1 + " · cache";
          return n1;
        }
      }
    } catch (e) {}
    return state.rows.length || 0;
  }

  /**
   * Robust board load: inject memory → LS → native IPC → remote/local seed URLs.
   * Fixes "LOAD fail" when inject raced ahead of market mount or stable filter hid all rows.
   */
  function loadBoardHard(cb) {
    cb = cb || function () {};
    var done = false;
    function finish(res) {
      if (done) return;
      done = true;
      cb(res);
      paint();
    }
    var n = tryHydrate();
    if (n > 0) {
      finish({ ok: true, n: n, source: "hydrate" });
      return;
    }
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(JSON.stringify({ op: "load_filmstrip" }));
        state.lastReport = "requesting filmstrip…";
        if (statusEl) statusEl.textContent = VER + " · loading board…";
      }
    } catch (eI) {}

    var urls = [
      "https://kbatch.ugrad.ai/data/filmstrip-board.json",
      "hotpipe/data/filmstrip-board.json",
      "../hotpipe/data/filmstrip-board.json",
      "./data/filmstrip-board.json",
    ];
    var i = 0;
    function tryUrl() {
      if (done) return;
      n = tryHydrate();
      if (n > 0) {
        finish({ ok: true, n: n, source: "ipc-or-hydrate" });
        return;
      }
      if (i >= urls.length) {
        state.lastReport = "LOAD fail · no board (IPC / seed / paste)";
        if (statusEl) statusEl.textContent = VER + " · " + state.lastReport;
        log("warn", "board load fail");
        finish({ ok: false, reason: "no board" });
        return;
      }
      var url = urls[i++];
      fetch(url, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        })
        .then(function (j) {
          if (done) return;
          var rows = Array.isArray(j) ? j : (j && j.rows) || [];
          if (!rows.length) throw new Error("empty");
          window.__mgFilmstripBoard = j;
          var nn = loadBoard(j);
          state.lastReport =
            "board n=" + nn + " · " + url.replace(/^https?:\/\//, "").slice(0, 40);
          finish({ ok: true, n: nn, source: url });
        })
        .catch(function () {
          tryUrl();
        });
    }
    /* wait briefly for native inject, then walk seed URLs */
    setTimeout(tryUrl, 320);
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
    /* live path on graph — contrail twin */
    recordTradeFlow(r, {
      hit: hit,
      intent: intent || "in",
      kind: intent === "edge" ? "edge" : hit ? "hit" : "miss",
      showGraph: true,
    });
    paint();
    return { ok: true, hit: hit, trial: trial };
  }

  function ensureStyles() {
    if (document.getElementById("mg-mkt-css")) return;
    var st = document.createElement("style");
    st.id = "mg-mkt-css";
    st.textContent = [
      /* fixed to viewport via <html> mount — not body (page-axis transform) */
      "#mg-mkt-rail{position:fixed!important;top:auto!important;bottom:48px!important;right:0!important;",
      "  left:auto!important;z-index:2147483620;max-height:46%;display:flex;flex-direction:row-reverse;",
      "  font:600 9px/1.25 ui-monospace,Menlo,monospace;pointer-events:none;",
      "  margin:0!important;-webkit-transform:translateZ(0);transform:translateZ(0)}",
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
      "#mg-mkt-graph{height:0;margin:0 8px 4px;border:1px solid rgba(255,255,255,0.1);",
      "  border-radius:12px;background:rgba(0,0,0,0.35);overflow:hidden;transition:height .15s}",
      "#mg-mkt-rail.graph #mg-mkt-graph,#mg-mkt-panel.graph #mg-mkt-graph{height:200px}",
      "#mg-mkt-graph canvas{width:100%;height:100%;display:block}",
      "#mg-mkt-flow{height:0;margin:0 8px 6px;border:1px solid rgba(255,255,255,0.1);",
      "  border-radius:12px;background:rgba(8,10,14,0.9);overflow:hidden;transition:height .15s}",
      "#mg-mkt-rail.graph #mg-mkt-flow,#mg-mkt-panel.graph #mg-mkt-flow,",
      "#mg-drawer-mkt-host.graph #mg-mkt-flow{height:52px}",
      "#mg-mkt-flow canvas{width:100%;height:100%;display:block}",
      "#mg-mkt-list{flex:1;overflow:auto;padding:0 8px 10px;min-height:120px}",
      "#mg-mkt-list .row{display:grid;grid-template-columns:52px 1fr 48px 56px;gap:4px;",
      "  padding:4px 2px;border-bottom:1px solid rgba(80,120,100,0.15);cursor:pointer}",
      "#mg-mkt-list .row:hover,#mg-mkt-list .row.on{background:rgba(40,80,60,0.25)}",
      "#mg-mkt-list .sym{color:rgba(160,210,255,0.95)}",
      "#mg-mkt-list .bull{color:rgba(120,220,160,0.9)}",
      "#mg-mkt-list .bear{color:rgba(240,140,120,0.9)}",
      "#mg-mkt-condor{padding:6px 8px;border-top:1px solid rgba(100,160,140,0.2);font-weight:500}",
      "#mg-mkt-status{padding:4px 8px 8px;opacity:0.8;font-weight:500}",
      /* squeeze charts · agentic BB price + RSI + MACD */
      "#mg-mkt-charts{flex-shrink:0;margin:0 8px 6px;padding:8px 8px 6px;",
      "  border:1px solid rgba(160,180,200,0.2);border-radius:12px;",
      "  background:rgba(8,10,14,0.55);display:flex;flex-direction:column;gap:4px}",
      "#mg-mkt-chart-hd{display:flex;align-items:center;flex-wrap:wrap;gap:6px;",
      "  font:600 10px/1.2 system-ui;color:rgba(200,220,240,0.88)}",
      "#mg-mkt-chart-sym{font:700 12px/1 system-ui;letter-spacing:0.04em;",
      "  color:rgba(160,210,255,0.98)}",
      "#mg-mkt-chart-meta{flex:1;min-width:0;font:500 9px/1.2 ui-monospace,Menlo,monospace;",
      "  color:rgba(160,180,200,0.75);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      "#mg-mkt-chart-sq{font:700 9px/1 system-ui;letter-spacing:0.04em;padding:3px 7px;",
      "  border-radius:999px;border:1px solid rgba(255,255,255,0.12);",
      "  background:rgba(255,255,255,0.06);color:rgba(200,210,220,0.85)}",
      "#mg-mkt-chart-sq.on{background:rgba(240,113,120,0.22);border-color:rgba(240,113,120,0.5);",
      "  color:rgba(255,180,180,0.95)}",
      "#mg-mkt-chart-sq.release{background:rgba(61,214,140,0.2);border-color:rgba(61,214,140,0.55);",
      "  color:rgba(160,255,200,0.95)}",
      "#mg-mkt-chart-tf{display:flex;flex-wrap:wrap;gap:3px}",
      "#mg-mkt-chart-tf button{appearance:none;cursor:pointer;border:0;",
      "  background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.65);",
      "  font:600 9px/1 -apple-system,system-ui;padding:5px 7px;border-radius:8px;",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.1)}",
      "#mg-mkt-chart-tf button.on{background:rgba(255,255,255,0.16);color:#fff;",
      "  box-shadow:0 1px 2px rgba(0,0,0,0.18)}",
      "#mg-mkt-chart-tf button:hover{background:rgba(255,255,255,0.14);color:#fff}",
      "#mg-mkt-cv-price{width:100%;height:120px;display:block;border-radius:8px;",
      "  background:rgba(12,15,20,0.95)}",
      "#mg-mkt-cv-rsi{width:100%;height:56px;display:block;border-radius:8px;",
      "  background:rgba(12,15,20,0.95)}",
      "#mg-mkt-cv-macd{width:100%;height:72px;display:block;border-radius:8px;",
      "  background:rgba(12,15,20,0.95)}",
      /* Embedded in DATA drawer Mkt tab */
      "#mg-drawer-mkt-host{display:flex;flex-direction:column;min-height:0;flex:1}",
      "#mg-drawer-mkt-host #mg-mkt-panel{",
      "  position:relative;width:100%!important;max-width:none!important;",
      "  max-height:none!important;overflow:visible!important;",
      "  background:transparent!important;border:none!important;",
      "  pointer-events:auto;display:flex;flex-direction:column;",
      "  color:rgba(210,225,240,0.94);font:600 9px/1.25 ui-monospace,Menlo,monospace}",
      "#mg-drawer-mkt-host #mg-mkt-head{padding:4px 2px 8px;border-bottom:1px solid rgba(255,255,255,0.08)}",
      "#mg-drawer-mkt-host #mg-mkt-list{max-height:min(200px,28vh);min-height:100px}",
      "#mg-drawer-mkt-host #mg-mkt-strip{height:56px}",
      "#mg-drawer-mkt-host #mg-mkt-charts{margin:6px 0 4px}",
      "#mg-drawer-mkt-host #mg-mkt-cv-price{height:132px}",
      "#mg-drawer-mkt-host #mg-mkt-cv-rsi{height:60px}",
      "#mg-drawer-mkt-host #mg-mkt-cv-macd{height:76px}",
      "#mg-drawer-mkt-host.graph #mg-mkt-graph,",
      "#mg-drawer-mkt-host #mg-mkt-panel.graph #mg-mkt-graph,",
      "html.mg-mkt-embed-graph #mg-drawer-mkt-host #mg-mkt-graph{height:180px}",
      "html.mg-mkt-embed-graph #mg-drawer-mkt-host #mg-mkt-flow{height:52px}",
      "#mg-mkt-rail.mg-mkt-embedded{display:none!important}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  var rail, listEl, stripCv, graphCv, flowCv, statusEl, condorEl, graphRaf;
  var chartSymEl, chartMetaEl, chartSqEl, priceCv, rsiCv, macdCv;

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
        recordTradeFlow(r, { kind: "select", showGraph: false });
        paint();
        loadSqueezeChart(r);
      };
      listEl.appendChild(el);
    });
  }

  /* ── Indicators (robinhood-agentic chart.js / squeeze.js parity) ── */
  function ema(values, period) {
    var k = 2 / (period + 1);
    var out = [values[0]];
    var prev = values[0];
    for (var i = 1; i < values.length; i++) {
      prev = values[i] * k + prev * (1 - k);
      out.push(prev);
    }
    return out;
  }

  function sma(values, period) {
    var out = [];
    for (var i = 0; i < values.length; i++) {
      if (i < period - 1) {
        out.push(null);
        continue;
      }
      var sum = 0;
      for (var j = i - period + 1; j <= i; j++) sum += values[j];
      out.push(sum / period);
    }
    return out;
  }

  function stddevAt(values, period, idx) {
    var sum = 0;
    for (var j = idx - period + 1; j <= idx; j++) sum += values[j];
    var mean = sum / period;
    var v = 0;
    for (var k = idx - period + 1; k <= idx; k++) v += (values[k] - mean) * (values[k] - mean);
    return Math.sqrt(v / period);
  }

  function computeBollinger(closes, period, mult) {
    period = period || 20;
    mult = mult || 2;
    var middle = sma(closes, period);
    return closes.map(function (_, i) {
      var mid = middle[i];
      if (mid == null) return { middle: NaN, upper: NaN, lower: NaN };
      var sd = stddevAt(closes, period, i);
      return { middle: mid, upper: mid + mult * sd, lower: mid - mult * sd };
    });
  }

  function computeMacd(closes) {
    var e12 = ema(closes, 12);
    var e26 = ema(closes, 26);
    var macdLine = e12.map(function (v, i) {
      return v - e26[i];
    });
    var signalLine = ema(macdLine, 9);
    return macdLine.map(function (m, i) {
      return { macd: m, signal: signalLine[i], histogram: m - signalLine[i] };
    });
  }

  function computeRsi(closes, period) {
    period = period || 14;
    var out = [];
    if (!closes || closes.length <= period) {
      for (var z0 = 0; z0 < (closes ? closes.length : 0); z0++) out.push(null);
      return out;
    }
    var gains = 0;
    var losses = 0;
    var t;
    for (t = 1; t <= period; t++) {
      var d0 = closes[t] - closes[t - 1];
      if (d0 > 0) gains += d0;
      else losses -= d0;
    }
    var avgG = gains / period;
    var avgL = losses / period;
    for (t = 0; t < period; t++) out.push(null);
    out.push(avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL));
    for (var u = period + 1; u < closes.length; u++) {
      var dd = closes[u] - closes[u - 1];
      var gg = dd > 0 ? dd : 0;
      var ll = dd < 0 ? -dd : 0;
      avgG = (avgG * (period - 1) + gg) / period;
      avgL = (avgL * (period - 1) + ll) / period;
      out.push(avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL));
    }
    return out;
  }

  function analyzeSqueeze(closes) {
    var empty = {
      on: false,
      release: false,
      predicted: false,
      expanding: false,
      widthPctile: 50,
      squeezeScore: 0,
      bandwidth: NaN,
      macdNearCross: false,
    };
    if (!closes || closes.length < 26) return empty;
    var bb = computeBollinger(closes);
    var widths = closes.map(function (c, i) {
      var b = bb[i];
      if (!b || !b.middle) return null;
      return (b.upper - b.lower) / b.middle;
    });
    var macd = computeMacd(closes);
    var i = closes.length - 1;
    var cur = widths[i];
    var prev = widths[i - 1];
    if (cur == null) return empty;
    var lookback = 120;
    var recent = widths.slice(-lookback).filter(function (w) {
      return w != null;
    });
    var rank =
      recent.filter(function (w) {
        return w <= cur;
      }).length / Math.max(1, recent.length);
    var on = rank <= 0.2;
    var expanding = prev != null && cur > prev * 1.02;
    var wasSqueeze = false;
    for (var j = Math.max(0, i - 5); j < i; j++) {
      var w = widths[j];
      if (w == null) continue;
      var slice = widths.slice(Math.max(0, j - lookback + 1), j + 1).filter(function (x) {
        return x != null;
      });
      if (!slice.length) continue;
      var r =
        slice.filter(function (x) {
          return x <= w;
        }).length / slice.length;
      if (r <= 0.2) {
        wasSqueeze = true;
        break;
      }
    }
    var release = wasSqueeze && expanding;
    var m = macd[i];
    var pm = macd[i - 1];
    var span = Math.max(Math.abs(m.signal), 1e-6);
    var macdNearCross = Math.abs(m.macd - m.signal) / span <= 0.15;
    var histMomentum = m.histogram - pm.histogram;
    var histAccel =
      (m.histogram >= 0 && histMomentum > 0) || (m.histogram < 0 && histMomentum < 0);
    var score = 0;
    if (on) score += 35;
    if (release) score += 30;
    if (expanding) score += 15;
    if (macdNearCross) score += 12;
    if (histAccel) score += 8;
    return {
      on: on,
      release: release,
      predicted: release || (on && (macdNearCross || histAccel)),
      expanding: expanding,
      widthPctile: Math.round(rank * 100),
      squeezeScore: Math.min(100, Math.round(score)),
      bandwidth: cur,
      macdNearCross: macdNearCross,
    };
  }

  function squeezeLabel(sq) {
    if (!sq) return "—";
    if (sq.release) return "Squeeze release";
    if (sq.on) return "Squeeze ON";
    if (sq.expanding) return "BB expanding";
    return "Normal";
  }

  function parseYahooBars(result, useDateTime) {
    var timestamps = result.timestamp || [];
    var quote = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
    var bars = [];
    for (var i = 0; i < timestamps.length; i++) {
      var close = quote.close && quote.close[i];
      var open = quote.open && quote.open[i];
      var high = quote.high && quote.high[i];
      var low = quote.low && quote.low[i];
      if (close == null || open == null || high == null || low == null) continue;
      var ts = timestamps[i] * 1000;
      bars.push({
        date: useDateTime
          ? new Date(ts).toISOString().slice(0, 16).replace("T", " ")
          : new Date(ts).toISOString().slice(0, 10),
        open: open,
        high: high,
        low: low,
        close: close,
        volume: (quote.volume && quote.volume[i]) || 0,
      });
    }
    return bars;
  }

  function bucketKey(date, frame) {
    var d0 = String(date).slice(0, 10);
    var parts = d0.split("-").map(Number);
    var y = parts[0];
    var m = parts[1];
    var d = parts[2];
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (frame === "day") return d0;
    if (frame === "week") {
      var day = dt.getUTCDay() || 7;
      dt.setUTCDate(dt.getUTCDate() - day + 1);
      return dt.toISOString().slice(0, 10);
    }
    if (frame === "month") return y + "-" + String(m).padStart(2, "0");
    var q = Math.floor((m - 1) / 3) + 1;
    return y + "-Q" + q;
  }

  function resampleDaily(bars, frame) {
    if (frame === "day" || !frame) return bars;
    var buckets = {};
    var order = [];
    bars.forEach(function (bar) {
      var key = bucketKey(bar.date, frame);
      if (!buckets[key]) {
        buckets[key] = {
          date: key,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume || 0,
        };
        order.push(key);
      } else {
        var ex = buckets[key];
        ex.high = Math.max(ex.high, bar.high);
        ex.low = Math.min(ex.low, bar.low);
        ex.close = bar.close;
        ex.volume += bar.volume || 0;
      }
    });
    return order.map(function (k) {
      return buckets[k];
    });
  }

  function resampleHourly(bars, group) {
    group = group || 5;
    var out = [];
    for (var i = group - 1; i < bars.length; i += group) {
      var chunk = bars.slice(i - group + 1, i + 1);
      out.push({
        date: chunk[chunk.length - 1].date,
        open: chunk[0].open,
        high: Math.max.apply(
          null,
          chunk.map(function (b) {
            return b.high;
          })
        ),
        low: Math.min.apply(
          null,
          chunk.map(function (b) {
            return b.low;
          })
        ),
        close: chunk[chunk.length - 1].close,
        volume: chunk.reduce(function (s, b) {
          return s + (b.volume || 0);
        }, 0),
      });
    }
    return out;
  }

  function buildChartPayload(bars, symbol, tf, limit) {
    var closes = bars.map(function (b) {
      return b.close;
    });
    var macd = computeMacd(closes);
    var bb = computeBollinger(closes);
    var rsi = computeRsi(closes, 14);
    var squeeze = analyzeSqueeze(closes);
    var start = Math.max(0, bars.length - limit);
    var points = [];
    for (var i = start; i < bars.length; i++) {
      var m = macd[i];
      var b = bb[i];
      points.push({
        date: bars[i].date,
        close: bars[i].close,
        bbUpper: b && !isNaN(b.upper) ? b.upper : null,
        bbMiddle: b && !isNaN(b.middle) ? b.middle : null,
        bbLower: b && !isNaN(b.lower) ? b.lower : null,
        macd: m.macd,
        signal: m.signal,
        histogram: m.histogram,
        rsi: rsi[i],
      });
    }
    var last = bars[bars.length - 1];
    return {
      symbol: symbol,
      timeframe: tf,
      asOf: last.date,
      close: last.close,
      points: points,
      squeeze: squeeze,
    };
  }

  var chartPend = {};

  window.__mgOnChartFetch = function (id, data) {
    var p = chartPend[id];
    if (!p) return;
    delete chartPend[id];
    try {
      if (p.timer) clearTimeout(p.timer);
    } catch (e) {}
    if (!data || (data.chart && data.chart.error)) {
      var desc =
        (data && data.chart && data.chart.error && data.chart.error.description) ||
        "native chart fail";
      p.reject(new Error(desc));
      return;
    }
    var result = data.chart && data.chart.result && data.chart.result[0];
    if (!result) p.reject(new Error("No chart data"));
    else p.resolve(result);
  };

  function fetchYahooBrowser(symbol, interval, range) {
    var hosts = [
      "https://query1.finance.yahoo.com",
      "https://query2.finance.yahoo.com",
    ];
    var h = 0;
    function tryHost() {
      if (h >= hosts.length) return Promise.reject(new Error("Yahoo unreachable"));
      var url =
        hosts[h++] +
        "/v8/finance/chart/" +
        encodeURIComponent(symbol) +
        "?interval=" +
        encodeURIComponent(interval) +
        "&range=" +
        encodeURIComponent(range);
      return fetch(url, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (j) {
          var err = j.chart && j.chart.error && j.chart.error.description;
          if (err) throw new Error(err);
          var result = j.chart && j.chart.result && j.chart.result[0];
          if (!result) throw new Error("No chart data");
          return result;
        })
        .catch(function () {
          if (h < hosts.length) return tryHost();
          throw new Error("Yahoo browser fail");
        });
    }
    return tryHost();
  }

  function fetchYahooNative(symbol, interval, range) {
    return new Promise(function (resolve, reject) {
      if (!window.ipc || !window.ipc.postMessage) {
        reject(new Error("no ipc"));
        return;
      }
      var id =
        "c" +
        Date.now().toString(36) +
        "_" +
        Math.floor(Math.random() * 1e6).toString(36);
      chartPend[id] = {
        resolve: resolve,
        reject: reject,
        timer: setTimeout(function () {
          if (chartPend[id]) {
            delete chartPend[id];
            reject(new Error("native chart timeout"));
          }
        }, 20000),
      };
      try {
        window.ipc.postMessage(
          JSON.stringify({
            op: "fetch_chart",
            symbol: symbol,
            interval: interval,
            range: range,
            id: id,
          })
        );
      } catch (e) {
        delete chartPend[id];
        reject(e);
      }
    });
  }

  /** Prefer browser fetch; fall back to native curl IPC (no CORS). */
  function fetchYahooRaw(symbol, interval, range) {
    return fetchYahooBrowser(symbol, interval, range).catch(function () {
      return fetchYahooNative(symbol, interval, range);
    });
  }

  /** Fetch + resample for any TF (agentic parity). */
  function fetchYahooForTf(symbol, tf) {
    var cfg = TF_CFG[tf] || TF_CFG.day;
    var cacheKey = symbol + "|" + cfg.interval + "|" + cfg.range;
    var hit = state.chartCache[cacheKey];
    var now = Date.now();
    var rawP;
    if (hit && hit.bars && now - hit.t < 5 * 60 * 1000) {
      rawP = Promise.resolve(hit.bars);
    } else {
      rawP = fetchYahooRaw(symbol, cfg.interval, cfg.range).then(function (result) {
        var bars = parseYahooBars(result, !!cfg.useDateTime);
        state.chartCache[cacheKey] = { bars: bars, t: Date.now(), kind: cfg.kind };
        return bars;
      });
    }
    return rawP.then(function (bars) {
      if (!bars || bars.length < 10) throw new Error("insufficient bars");
      var use = bars;
      if (cfg.kind === "week") use = resampleDaily(bars, "week");
      else if (cfg.kind === "month") use = resampleDaily(bars, "month");
      else if (cfg.kind === "quarter") use = resampleDaily(bars, "quarter");
      else if (cfg.kind === "hourly5") use = resampleHourly(bars, 5);
      /* hourly / daily: as-is */
      return use;
    });
  }

  function setupCanvas(canvas) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(120, rect.width || canvas.clientWidth || 320);
    var h = Math.max(40, rect.height || canvas.clientHeight || 80);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function scaleRange(values, padPct) {
    padPct = padPct == null ? 0.06 : padPct;
    var nums = values.filter(function (v) {
      return v != null && !isNaN(v);
    });
    if (!nums.length) return { min: 0, max: 1 };
    var min = Math.min.apply(null, nums);
    var max = Math.max.apply(null, nums);
    var pad = (max - min || max * 0.01) * padPct;
    return { min: min - pad, max: max + pad };
  }

  function xAt(i, n, padL, padR, w) {
    return padL + (i / Math.max(1, n - 1)) * (w - padL - padR);
  }

  function yAt(v, min, max, padT, padB, h) {
    return padT + ((max - v) / (max - min || 1)) * (h - padT - padB);
  }

  function drawLine(ctx, pts, min, max, pad, w, h, color, width) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1.5;
    var started = false;
    for (var i = 0; i < pts.length; i++) {
      var v = pts[i];
      if (v == null || isNaN(v)) {
        started = false;
        continue;
      }
      var x = xAt(i, pts.length, pad.l, pad.r, w);
      var y = yAt(v, min, max, pad.t, pad.b, h);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function fmtPx(n) {
    if (n == null || isNaN(n)) return "—";
    if (n >= 1000) return n.toFixed(1);
    if (n >= 1) return n.toFixed(2);
    return n.toFixed(4);
  }

  function renderPricePanel(data) {
    if (!priceCv || !data || !data.points) return;
    var s = setupCanvas(priceCv);
    var ctx = s.ctx;
    var w = s.w;
    var h = s.h;
    var pad = { l: 40, r: 8, t: 8, b: 14 };
    var pts = data.points;
    var closes = pts.map(function (p) {
      return p.close;
    });
    var uppers = pts.map(function (p) {
      return p.bbUpper;
    });
    var lowers = pts.map(function (p) {
      return p.bbLower;
    });
    var mids = pts.map(function (p) {
      return p.bbMiddle;
    });
    var range = scaleRange(closes.concat(uppers).concat(lowers).concat(mids));
    ctx.fillStyle = "#0c0f14";
    ctx.fillRect(0, 0, w, h);
    /* BB fill */
    ctx.beginPath();
    var started = false;
    var i;
    for (i = 0; i < pts.length; i++) {
      if (uppers[i] == null) continue;
      var x = xAt(i, pts.length, pad.l, pad.r, w);
      var y = yAt(uppers[i], range.min, range.max, pad.t, pad.b, h);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    for (i = pts.length - 1; i >= 0; i--) {
      if (lowers[i] == null) continue;
      x = xAt(i, pts.length, pad.l, pad.r, w);
      y = yAt(lowers[i], range.min, range.max, pad.t, pad.b, h);
      ctx.lineTo(x, y);
    }
    if (started) {
      ctx.closePath();
      ctx.fillStyle = "rgba(122,162,247,0.1)";
      ctx.fill();
    }
    drawLine(ctx, lowers, range.min, range.max, pad, w, h, "rgba(122,162,247,0.45)", 1);
    drawLine(ctx, mids, range.min, range.max, pad, w, h, "rgba(154,160,166,0.55)", 1);
    drawLine(ctx, uppers, range.min, range.max, pad, w, h, "rgba(122,162,247,0.45)", 1);
    drawLine(ctx, closes, range.min, range.max, pad, w, h, "#e8eaed", 1.8);
    ctx.fillStyle = "#9aa0a6";
    ctx.font = "9px ui-monospace,Menlo,system-ui";
    ctx.textAlign = "right";
    for (i = 0; i <= 2; i++) {
      var v = range.min + ((range.max - range.min) * i) / 2;
      y = yAt(v, range.min, range.max, pad.t, pad.b, h);
      ctx.fillText(fmtPx(v), pad.l - 3, y + 3);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(160,200,255,0.75)";
    ctx.fillText("BB · price", pad.l + 2, pad.t + 9);
  }

  function renderRsiPanel(data) {
    if (!rsiCv || !data || !data.points) return;
    var s = setupCanvas(rsiCv);
    var ctx = s.ctx;
    var w = s.w;
    var h = s.h;
    var pad = { l: 40, r: 8, t: 10, b: 6 };
    var pts = data.points;
    var rsi = pts.map(function (p) {
      return p.rsi;
    });
    var min = 0;
    var max = 100;
    ctx.fillStyle = "#0c0f14";
    ctx.fillRect(0, 0, w, h);
    /* 30/70 bands */
    function band(y0, y1, color) {
      var ya = yAt(y0, min, max, pad.t, pad.b, h);
      var yb = yAt(y1, min, max, pad.t, pad.b, h);
      ctx.fillStyle = color;
      ctx.fillRect(pad.l, Math.min(ya, yb), w - pad.l - pad.r, Math.abs(yb - ya));
    }
    band(70, 100, "rgba(240,113,120,0.08)");
    band(0, 30, "rgba(61,214,140,0.08)");
    ctx.strokeStyle = "rgba(80,100,120,0.35)";
    ctx.lineWidth = 1;
    [30, 50, 70].forEach(function (lv) {
      var y = yAt(lv, min, max, pad.t, pad.b, h);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
    });
    drawLine(ctx, rsi, min, max, pad, w, h, "#bb9af7", 1.5);
    ctx.fillStyle = "#9aa0a6";
    ctx.font = "9px ui-monospace,Menlo,system-ui";
    ctx.textAlign = "left";
    var last = null;
    for (var i = rsi.length - 1; i >= 0; i--) {
      if (rsi[i] != null) {
        last = rsi[i];
        break;
      }
    }
    ctx.fillStyle = "rgba(187,154,247,0.9)";
    ctx.fillText("RSI14 " + (last != null ? last.toFixed(1) : "—"), pad.l + 2, pad.t + 8);
  }

  function renderMacdPanel(data) {
    if (!macdCv || !data || !data.points) return;
    var s = setupCanvas(macdCv);
    var ctx = s.ctx;
    var w = s.w;
    var h = s.h;
    var pad = { l: 40, r: 8, t: 12, b: 8 };
    var pts = data.points;
    var macd = pts.map(function (p) {
      return p.macd;
    });
    var signal = pts.map(function (p) {
      return p.signal;
    });
    var hist = pts.map(function (p) {
      return p.histogram;
    });
    var range = scaleRange(macd.concat(signal).concat(hist).concat([0]));
    ctx.fillStyle = "#0c0f14";
    ctx.fillRect(0, 0, w, h);
    var y0 = yAt(0, range.min, range.max, pad.t, pad.b, h);
    ctx.strokeStyle = "#2a3038";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, y0);
    ctx.lineTo(w - pad.r, y0);
    ctx.stroke();
    var barW = Math.max(1, ((w - pad.l - pad.r) / pts.length) * 0.65);
    for (var i = 0; i < pts.length; i++) {
      var v = hist[i];
      if (v == null) continue;
      var x = xAt(i, pts.length, pad.l, pad.r, w) - barW / 2;
      var y = yAt(v, range.min, range.max, pad.t, pad.b, h);
      ctx.fillStyle = v >= 0 ? "rgba(61,214,140,0.55)" : "rgba(240,113,120,0.55)";
      ctx.fillRect(x, Math.min(y, y0), barW, Math.abs(y - y0) || 1);
    }
    drawLine(ctx, macd, range.min, range.max, pad, w, h, "#7aa2f7", 1.5);
    drawLine(ctx, signal, range.min, range.max, pad, w, h, "#e6c068", 1.2);
    ctx.font = "9px ui-monospace,Menlo,system-ui";
    ctx.textAlign = "left";
    ctx.fillStyle = "#7aa2f7";
    ctx.fillText("MACD", pad.l + 2, pad.t + 8);
    ctx.fillStyle = "#e6c068";
    ctx.fillText("Signal", pad.l + 40, pad.t + 8);
  }

  function paintSqueezeHeader(data) {
    if (chartSymEl) chartSymEl.textContent = (data && data.symbol) || "—";
    var sq = data && data.squeeze;
    if (chartSqEl) {
      chartSqEl.textContent = sq
        ? squeezeLabel(sq) + " " + sq.squeezeScore
        : "—";
      chartSqEl.className = "";
      chartSqEl.id = "mg-mkt-chart-sq";
      if (sq && sq.release) chartSqEl.classList.add("release");
      else if (sq && sq.on) chartSqEl.classList.add("on");
      chartSqEl.title = sq
        ? "widthPctile=" +
          sq.widthPctile +
          "% · score=" +
          sq.squeezeScore +
          " · predicted=" +
          !!sq.predicted
        : "";
    }
    if (chartMetaEl) {
      if (!data) {
        chartMetaEl.textContent = "select a symbol · BB · RSI · MACD";
        return;
      }
      var tfLab = (TF_CFG[data.timeframe] && TF_CFG[data.timeframe].label) || data.timeframe || "D";
      chartMetaEl.textContent =
        tfLab +
        " · " +
        data.asOf +
        " · " +
        fmtPx(data.close) +
        (sq && sq.macdNearCross ? " · MACD near cross" : "") +
        (sq && sq.predicted ? " · flip likely" : "");
    }
  }

  function renderSqueezeChart(data) {
    state.chartData = data;
    paintSqueezeHeader(data);
    if (!data) {
      [priceCv, rsiCv, macdCv].forEach(function (cv) {
        if (!cv) return;
        var s = setupCanvas(cv);
        s.ctx.fillStyle = "#0c0f14";
        s.ctx.fillRect(0, 0, s.w, s.h);
      });
      return;
    }
    renderPricePanel(data);
    renderRsiPanel(data);
    renderMacdPanel(data);
  }

  function bindChartRefs(root) {
    root = root || document;
    chartSymEl = root.querySelector("#mg-mkt-chart-sym");
    chartMetaEl = root.querySelector("#mg-mkt-chart-meta");
    chartSqEl = root.querySelector("#mg-mkt-chart-sq");
    priceCv = root.querySelector("#mg-mkt-cv-price");
    rsiCv = root.querySelector("#mg-mkt-cv-rsi");
    macdCv = root.querySelector("#mg-mkt-cv-macd");
    var tfHost = root.querySelector("#mg-mkt-chart-tf");
    if (tfHost && !tfHost._mgBound) {
      tfHost._mgBound = true;
      tfHost.addEventListener("click", function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest("button[data-tf]") : null;
        if (!b) return;
        state.chartTf = b.getAttribute("data-tf") || "day";
        Array.prototype.forEach.call(tfHost.querySelectorAll("button"), function (btn) {
          btn.classList.toggle("on", btn.getAttribute("data-tf") === state.chartTf);
        });
        if (state.focus) loadSqueezeChart(state.focus);
      });
    }
  }

  function loadSqueezeChart(row) {
    if (!row || !row.id) {
      renderSqueezeChart(null);
      return;
    }
    var sym = String(row.yahoo || row.id).toUpperCase();
    var tf = state.chartTf || "day";
    var cfg = TF_CFG[tf] || TF_CFG.day;
    var req = ++state.chartReq;
    paintSqueezeHeader({
      symbol: sym,
      asOf: "…",
      close: null,
      timeframe: tf,
      squeeze: null,
    });
    if (chartMetaEl) chartMetaEl.textContent = "loading " + sym + " · " + cfg.label + "…";

    state.chartLoading = true;
    fetchYahooForTf(sym, tf)
      .then(function (bars) {
        if (req !== state.chartReq) return;
        if (!bars || bars.length < 26) {
          if (chartMetaEl)
            chartMetaEl.textContent =
              "insufficient bars for " + sym + " · " + cfg.label + " (" + (bars ? bars.length : 0) + ")";
          return;
        }
        var limit = cfg.limit || state.chartLimit || 120;
        var payload = buildChartPayload(bars, sym, tf, limit);
        renderSqueezeChart(payload);
        recordTradeFlow(row, { kind: "chart", showGraph: false });
        state.lastReport =
          "chart " + sym + " " + cfg.label + " " + payload.points.length + "pts";
        if (statusEl)
          statusEl.textContent =
            VER + " · " + state.lastReport + " · board " + (state.rows || []).length;
      })
      .catch(function (err) {
        if (req !== state.chartReq) return;
        log("warn", "chart " + sym + " " + err);
        var msg = String(err && err.message ? err.message : err).slice(0, 56);
        if (chartMetaEl) chartMetaEl.textContent = "chart fail · " + msg;
        /* last-resort: board close only (shows status, not fake indicators) */
        try {
          var d = dayFrame(row);
          if (d && d.close != null && chartMetaEl) {
            chartMetaEl.textContent =
              "chart fail · " +
              msg +
              " · board close " +
              fmtPx(+d.close) +
              " · try D/W or another sym";
          }
        } catch (eF) {}
      })
      .then(function () {
        if (req === state.chartReq) state.chartLoading = false;
      });
  }

  function paint() {
    var rows = filtered();
    drawStrip(rows);
    paintList(rows);
    var host = document.getElementById("mg-drawer-mkt-host");
    var live = state.open || state.embedded;
    if (state.viewMode === "graph") {
      if (!state.graphNodes.length || state.graphNodes.length !== Math.min(rows.length, 80)) {
        buildForceGraph(rows);
      }
      if (rail) rail.classList.add("graph");
      if (host) host.classList.add("graph");
      try {
        document.documentElement.classList.add("mg-mkt-embed-graph");
      } catch (eG) {}
      drawForceGraph(graphCv);
      drawTradeFlowStrip(flowCv);
      if (!graphRaf) {
        graphRaf = requestAnimationFrame(function tick() {
          if (state.viewMode !== "graph" || !live) {
            graphRaf = 0;
            return;
          }
          live = state.open || state.embedded;
          drawForceGraph(graphCv);
          drawTradeFlowStrip(flowCv);
          graphRaf = requestAnimationFrame(tick);
        });
      }
    } else {
      if (rail) rail.classList.remove("graph");
      if (host) host.classList.remove("graph");
      try {
        document.documentElement.classList.remove("mg-mkt-embed-graph");
      } catch (eG2) {}
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
    /* re-draw charts if data already loaded for focus (no re-fetch on every paint) */
    if (state.focus && state.chartData && state.chartData.symbol === state.focus.id) {
      try {
        renderSqueezeChart(state.chartData);
      } catch (eC) {}
    } else if (!state.focus) {
      paintSqueezeHeader(null);
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
      '    <label><input type="checkbox" id="mg-mkt-stable" /> stable</label>' +
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
      '  <div id="mg-mkt-graph"><canvas id="mg-mkt-gcv" aria-label="co-membership graph with trade flow"></canvas></div>' +
      '  <div id="mg-mkt-flow"><canvas id="mg-mkt-fcv" aria-label="trade interaction unwind"></canvas></div>' +
      '  <div id="mg-mkt-list"></div>' +
      '  <div id="mg-mkt-condor"></div>' +
      '  <div id="mg-mkt-charts">' +
      '    <div id="mg-mkt-chart-hd">' +
      '      <span id="mg-mkt-chart-sym">—</span>' +
      '      <span id="mg-mkt-chart-sq">—</span>' +
      '      <span id="mg-mkt-chart-meta">select a symbol · BB · RSI · MACD</span>' +
      '      <div id="mg-mkt-chart-tf">' +
      '        <button type="button" data-tf="1h">1h</button>' +
      '        <button type="button" data-tf="5h">5h</button>' +
      '        <button type="button" data-tf="day" class="on">D</button>' +
      '        <button type="button" data-tf="week">W</button>' +
      '        <button type="button" data-tf="month">M</button>' +
      '        <button type="button" data-tf="quarter">Q</button>' +
      "      </div>" +
      "    </div>" +
      '    <canvas id="mg-mkt-cv-price" aria-label="Price and Bollinger Bands"></canvas>' +
      '    <canvas id="mg-mkt-cv-rsi" aria-label="RSI 14"></canvas>' +
      '    <canvas id="mg-mkt-cv-macd" aria-label="MACD histogram"></canvas>' +
      "  </div>" +
      '  <div id="mg-mkt-status"></div>' +
      "</div>";
    chromeRoot().appendChild(rail);
    listEl = rail.querySelector("#mg-mkt-list");
    stripCv = rail.querySelector("#mg-mkt-cv");
    graphCv = rail.querySelector("#mg-mkt-gcv");
    flowCv = rail.querySelector("#mg-mkt-fcv");
    statusEl = rail.querySelector("#mg-mkt-status");
    condorEl = rail.querySelector("#mg-mkt-condor");
    bindChartRefs(rail);

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
    function refillSectors() {
      var panel = document.getElementById("mg-mkt-panel") || rail;
      var sel = panel.querySelector("#mg-mkt-sec");
      if (!sel) return;
      var cur = state.filter.sector;
      sel.innerHTML = '<option value="">sector</option>';
      sectors().forEach(function (s) {
        var o = document.createElement("option");
        o.value = s;
        o.textContent = s.slice(0, 28);
        if (s === cur) o.selected = true;
        sel.appendChild(o);
      });
    }
    rail.querySelector("#mg-mkt-load").onclick = function () {
      state.graphNodes = [];
      if (statusEl) statusEl.textContent = VER + " · LOAD…";
      loadBoardHard(function (res) {
        refillSectors();
        if (res && res.ok) {
          state.lastReport = "LOAD ok n=" + res.n + " · " + (res.source || "");
          if (!state.focus && state.rows.length) {
            state.focus = filtered()[0] || state.rows[0];
            loadSqueezeChart(state.focus);
          }
        } else {
          state.lastReport = "LOAD fail · try FILE / PASTE";
        }
        if (statusEl) statusEl.textContent = VER + " · " + state.lastReport;
        paint();
      });
    };
    rail.querySelector("#mg-mkt-reload").onclick = function () {
      state.graphNodes = [];
      if (statusEl) statusEl.textContent = VER + " · FILE reload…";
      loadBoardHard(function (res) {
        refillSectors();
        if (statusEl)
          statusEl.textContent =
            VER +
            " · " +
            (res && res.ok ? "FILE ok n=" + res.n : "FILE fail · paste JSON");
        paint();
      });
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
    if (sel) {
      sectors().forEach(function (s) {
        var o = document.createElement("option");
        o.value = s;
        o.textContent = s.slice(0, 28);
        sel.appendChild(o);
      });
    }
    paint();
    if (!(state.rows && state.rows.length)) {
      loadBoardHard(function () {
        refillSectors();
        paint();
      });
    }
    log("ok", VER + " · collapsible MKT rail · TF 1h/5h/D/W/M/Q");
  }

  /** Park panel back on side rail (before drawer body is wiped). */
  function unembed() {
    if (!state.embedded) return;
    state.embedded = false;
    try {
      document.documentElement.classList.remove("mg-mkt-embed-graph");
    } catch (e) {}
    if (!rail) return;
    var panel = document.getElementById("mg-mkt-panel");
    if (panel && panel.parentNode !== rail) {
      rail.appendChild(panel);
      panel.style.width = "";
      panel.style.maxHeight = "";
      panel.style.overflow = "";
    }
    rail.classList.remove("mg-mkt-embedded");
    /* keep data; collapse floating rail unless user had it open */
    if (!state.open) rail.classList.remove("open");
  }

  /**
   * Mount full filmstrip UI (filters · strip · graph · list · condor) into drawer host.
   * Preserves list/visuals that the Mkt side-rail already implements.
   */
  function embedInto(host) {
    if (!host) return false;
    ensureStyles();
    if (!document.getElementById("mg-mkt-rail")) mount();
    if (!rail) rail = document.getElementById("mg-mkt-rail");
    if (!rail) return false;
    var panel = rail.querySelector("#mg-mkt-panel") || document.getElementById("mg-mkt-panel");
    if (!panel) return false;
    host.innerHTML = "";
    host.id = host.id || "mg-drawer-mkt-host";
    host.appendChild(panel);
    rail.classList.add("mg-mkt-embedded");
    state.embedded = true;
    state.open = true; /* paint/list treat as live */
    /* rebind refs (same nodes) */
    listEl = panel.querySelector("#mg-mkt-list");
    stripCv = panel.querySelector("#mg-mkt-cv");
    graphCv = panel.querySelector("#mg-mkt-gcv");
    flowCv = panel.querySelector("#mg-mkt-fcv");
    statusEl = panel.querySelector("#mg-mkt-status");
    condorEl = panel.querySelector("#mg-mkt-condor");
    bindChartRefs(panel);
    tryHydrate();
    /* sector select refill */
    try {
      var sel = panel.querySelector("#mg-mkt-sec");
      if (sel && sel.options.length <= 1) {
        var cur = state.filter.sector;
        sel.innerHTML = '<option value="">sector</option>';
        sectors().forEach(function (s) {
          var o = document.createElement("option");
          o.value = s;
          o.textContent = s.slice(0, 28);
          if (s === cur) o.selected = true;
          sel.appendChild(o);
        });
      }
    } catch (eS) {}
    paint();
    /* hard-load board if empty, then chart focus */
    try {
      function afterBoard() {
        if (!state.focus) {
          var fr = filtered();
          if (fr.length) state.focus = fr[0];
          else if (state.rows.length) state.focus = state.rows[0];
        }
        if (state.focus) loadSqueezeChart(state.focus);
      }
      if (!(state.rows && state.rows.length)) {
        loadBoardHard(function () {
          afterBoard();
        });
      } else afterBoard();
    } catch (eCh) {}
    log("ok", VER + " · embedded in drawer · squeeze charts");
    return true;
  }

  window.__mgMarket = {
    ver: VER,
    state: state,
    loadBoard: loadBoard,
    loadBoardHard: loadBoardHard,
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: function () {
      setOpen(!state.open);
    },
    embedInto: embedInto,
    unembed: unembed,
    paint: paint,
    tryHydrate: tryHydrate,
    setTimeframe: function (tf) {
      if (!TF_CFG[tf]) return false;
      state.chartTf = tf;
      if (state.focus) loadSqueezeChart(state.focus);
      return true;
    },
    timeframes: function () {
      return TF_ORDER.slice();
    },
    filtered: filtered,
    scoreCondorTrial: scoreCondorTrial,
    recordTradeFlow: recordTradeFlow,
    tradeFlow: function () {
      return (state.tradeFlow || []).slice();
    },
    tradeHops: function () {
      return (state.tradeHops || []).slice();
    },
    clearTradeFlow: function () {
      state.tradeFlow = [];
      state.tradeHops = [];
      state.flowPulse = {};
      state.lastTradeId = null;
    },
    condorRails: condorRails,
    isStabilized: isStabilized,
    loadChart: loadSqueezeChart,
    chartData: function () {
      return state.chartData;
    },
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
        state.condor.trials +
        " flow=" +
        (state.tradeFlow || []).length +
        " hops=" +
        (state.tradeHops || []).length +
        (state.embedded ? " embed" : "") +
        (state.chartData ? " chart=" + state.chartData.symbol : "")
      );
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
