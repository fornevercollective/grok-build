/* Memory Glass · WebGrid contrail tracker
 * Phrasing of pointer / agent movement — fencing-style path like live.js hand trails
 * + kbatch.ugrad.ai path geometry language (stroke bins, curvature, dwell, hop).
 * Feeds predictive model features (domain: webgrid_contrail).
 * VER: webgrid-contrail-v1
 */
(function () {
  "use strict";
  try {
    if (!/neuralink\.com$/i.test(location.hostname) || !/webgrid/i.test(location.pathname)) return;
  } catch (e0) {
    return;
  }
  var VER = "webgrid-contrail-v1";
  if (window.__mgContrailVer === VER) return;
  window.__mgContrailVer = VER;

  var PATH_MAX = 240;
  var PATH_MIN = 0.002;
  var ENDPOINT = "http://127.0.0.1:9880/";
  var path = []; /* {nx,ny,t,v,cell,phase,src} */
  var strokes = []; /* closed stroke phrase tokens */
  var lastSample = null;
  var overlay = null;
  var showOverlay = true;
  var stats = {
    samples: 0,
    strokes: 0,
    totalLen: 0,
    meanV: 0,
    maxV: 0,
    turnRate: 0,
    lastPhrase: "",
  };

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "contrail");
    } catch (e) {}
  }

  function post(obj) {
    try {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj),
        mode: "cors",
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
    try {
      var key = "mg.contrail.trials";
      if (obj.kind === "contrail_stroke" || obj.kind === "contrail_summary") {
        var arr = JSON.parse(localStorage.getItem(key) || "[]");
        arr.push(obj);
        if (arr.length > 300) arr = arr.slice(-300);
        localStorage.setItem(key, JSON.stringify(arr));
      }
    } catch (e2) {}
  }

  /* 8-way direction bin — kbatch-like path token */
  function dirBin(dx, dy) {
    if (Math.hypot(dx, dy) < 1e-6) return "·";
    var a = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180, x right y down
    var dirs = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
    var i = Math.round(((a + 360) % 360) / 45) % 8;
    return dirs[i];
  }

  function curvature(a, b, c) {
    // cross product magnitude of segments ab,bc
    var dx1 = b.nx - a.nx,
      dy1 = b.ny - a.ny;
    var dx2 = c.nx - b.nx,
      dy2 = c.ny - b.ny;
    var cross = dx1 * dy2 - dy1 * dx2;
    var d1 = Math.hypot(dx1, dy1) || 1e-6;
    var d2 = Math.hypot(dx2, dy2) || 1e-6;
    return cross / (d1 * d2);
  }

  function pushPoint(nx, ny, meta) {
    meta = meta || {};
    var now = Date.now();
    if (lastSample) {
      var dx = nx - lastSample.nx;
      var dy = ny - lastSample.ny;
      var dist = Math.hypot(dx, dy);
      if (dist < PATH_MIN) return;
      var dt = Math.max(8, now - lastSample.t);
      var v = dist / (dt / 1000);
      var sample = {
        nx: nx,
        ny: ny,
        t: now,
        v: v,
        cell: meta.cell != null ? meta.cell : lastSample.cell,
        phase: meta.phase || lastSample.phase || "play",
        src: meta.src || "ptr",
        dir: dirBin(dx, dy),
      };
      path.push(sample);
      stats.samples++;
      stats.totalLen += dist;
      stats.meanV = stats.meanV * 0.9 + v * 0.1;
      if (v > stats.maxV) stats.maxV = v;
      lastSample = sample;
    } else {
      lastSample = {
        nx: nx,
        ny: ny,
        t: now,
        v: 0,
        cell: meta.cell,
        phase: meta.phase || "play",
        src: meta.src || "ptr",
        dir: "·",
      };
      path.push(lastSample);
      stats.samples++;
    }
    while (path.length > PATH_MAX) path.shift();
    maybeCloseStroke();
    draw();
  }

  function maybeCloseStroke() {
    if (path.length < 6) return;
    var last = path[path.length - 1];
    var idle = Date.now() - last.t > 280;
    var long = path.length >= 48;
    if (!idle && !long) return;
    // take last continuous segment
    var seg = path.slice(-Math.min(path.length, 64));
    if (seg.length < 4) return;
    var phrase = seg.map(function (p) {
      return p.dir || "·";
    });
    // compress runs: EEE → E3
    var compressed = [];
    var i = 0;
    while (i < phrase.length) {
      var d = phrase[i];
      var n = 1;
      while (i + n < phrase.length && phrase[i + n] === d) n++;
      compressed.push(n > 1 ? d + n : d);
      i += n;
    }
    var phraseStr = compressed.join("");
    var turns = 0;
    for (var j = 2; j < seg.length; j++) {
      var c = Math.abs(curvature(seg[j - 2], seg[j - 1], seg[j]));
      if (c > 0.55) turns++;
    }
    stats.turnRate = turns / Math.max(1, seg.length);
    stats.lastPhrase = phraseStr.slice(0, 48);
    stats.strokes++;
    var hops = 0;
    for (var k = 1; k < seg.length; k++) {
      if (seg[k].cell != null && seg[k - 1].cell != null && seg[k].cell !== seg[k - 1].cell)
        hops++;
    }
    var stroke = {
      kind: "contrail_stroke",
      ver: VER,
      t: Date.now(),
      domain: "webgrid_contrail",
      phrase: phraseStr.slice(0, 64),
      n: seg.length,
      len: seg.reduce(function (a, p, ix) {
        if (ix === 0) return 0;
        return a + Math.hypot(p.nx - seg[ix - 1].nx, p.ny - seg[ix - 1].ny);
      }, 0),
      meanV: seg.reduce(function (a, p) {
        return a + (p.v || 0);
      }, 0) / seg.length,
      maxV: seg.reduce(function (a, p) {
        return Math.max(a, p.v || 0);
      }, 0),
      turns: turns,
      turnRate: stats.turnRate,
      hops: hops,
      cells: seg
        .map(function (p) {
          return p.cell;
        })
        .filter(function (c, ix, arr) {
          return c != null && arr.indexOf(c) === ix;
        })
        .slice(0, 24),
      features: [
        seg.length,
        stats.turnRate,
        hops,
        stats.meanV,
        stats.maxV,
      ],
      label: 1, // movement phrasing sample (always positive observation)
      meta: { src: "webgrid", kbatch_style: true },
    };
    strokes.push(stroke);
    if (strokes.length > 40) strokes.shift();
    post(stroke);
    // soft reset path tail so next stroke is distinct
    if (idle) {
      path = path.slice(-3);
    }
    log("stroke «" + stroke.phrase.slice(0, 24) + "» turns=" + turns + " hops=" + hops);
  }

  function ensureOverlay() {
    if (overlay || !showOverlay) return;
    overlay = document.createElement("canvas");
    overlay.id = "mg-contrail-ov";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:50;pointer-events:none;width:100%;height:100%";
    (document.body || document.documentElement).appendChild(overlay);
  }

  function speedColor(v, a) {
    var t = Math.max(0, Math.min(1, v / 1.8));
    var r = Math.floor(100 + t * 140);
    var g = Math.floor(190 + t * 40);
    var b = Math.floor(255 - t * 80);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function draw() {
    if (!showOverlay) return;
    ensureOverlay();
    if (!overlay) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = window.innerWidth;
    var h = window.innerHeight;
    overlay.width = Math.floor(w * dpr);
    overlay.height = Math.floor(h * dpr);
    var ctx = overlay.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (path.length < 2) return;
    for (var i = 1; i < path.length; i++) {
      var a0 = path[i - 1],
        a1 = path[i];
      var age = i / path.length;
      var alpha = 0.12 + age * 0.75;
      ctx.strokeStyle = speedColor((a0.v + a1.v) * 0.5, alpha);
      ctx.lineWidth = 1.6 + age * 1.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a0.nx * w, a0.ny * h);
      ctx.lineTo(a1.nx * w, a1.ny * h);
      ctx.stroke();
    }
    // tip
    var tip = path[path.length - 1];
    ctx.fillStyle = "rgba(160,220,255,0.9)";
    ctx.beginPath();
    ctx.arc(tip.nx * w, tip.ny * h, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // phrase HUD
    if (stats.lastPhrase) {
      ctx.font = "600 10px ui-monospace,Menlo,monospace";
      ctx.fillStyle = "rgba(160,210,255,0.75)";
      ctx.fillText("CONTRAIL " + stats.lastPhrase.slice(0, 36), 12, h - 16);
    }
  }

  function onPtr(ev) {
    var w = window.innerWidth || 1;
    var h = window.innerHeight || 1;
    pushPoint(ev.clientX / w, ev.clientY / h, { src: "ptr", phase: "play" });
  }

  /* Agent API — webgrid-play calls after each shot */
  function observeAgent(clientX, clientY, cell, conf) {
    var w = window.innerWidth || 1;
    var h = window.innerHeight || 1;
    pushPoint(clientX / w, clientY / h, {
      src: "agent",
      cell: cell,
      phase: "agent",
      conf: conf,
    });
  }

  function summary() {
    var s = {
      kind: "contrail_summary",
      ver: VER,
      t: Date.now(),
      domain: "webgrid_contrail",
      stats: {
        samples: stats.samples,
        strokes: stats.strokes,
        totalLen: +stats.totalLen.toFixed(4),
        meanV: +stats.meanV.toFixed(4),
        maxV: +stats.maxV.toFixed(4),
        turnRate: +stats.turnRate.toFixed(4),
        lastPhrase: stats.lastPhrase,
      },
      recent: strokes.slice(-5).map(function (x) {
        return { phrase: x.phrase, turns: x.turns, hops: x.hops, meanV: x.meanV };
      }),
      features: [
        stats.samples,
        stats.strokes,
        stats.totalLen,
        stats.meanV,
        stats.maxV,
        stats.turnRate,
      ],
    };
    post(s);
    return s;
  }

  document.addEventListener("pointermove", onPtr, { passive: true, capture: true });
  document.addEventListener("pointerdown", onPtr, { passive: true, capture: true });
  window.addEventListener("resize", function () {
    draw();
  });

  // periodic summary for train bus
  setInterval(function () {
    if (stats.samples > 8) summary();
  }, 15000);

  window.__mgContrail = {
    ver: VER,
    path: path,
    strokes: strokes,
    stats: stats,
    observeAgent: observeAgent,
    pushPoint: pushPoint,
    summary: summary,
    setOverlay: function (on) {
      showOverlay = !!on;
      if (!showOverlay && overlay) {
        overlay.remove();
        overlay = null;
      }
    },
    report: function () {
      return (
        VER +
        " n=" +
        stats.samples +
        " strokes=" +
        stats.strokes +
        " «" +
        (stats.lastPhrase || "—") +
        "»"
      );
    },
  };
  log(VER + " · path phrasing + kbatch-style tokens → :9880");
})();
