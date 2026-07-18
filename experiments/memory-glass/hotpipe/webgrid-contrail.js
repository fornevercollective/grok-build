/* Memory Glass · WebGrid contrail tracker v2
 * Path phrasing (kbatch-style) + Neuralink-inspired pattern flow:
 *   - circles unwound in time (intent vs execution variance)
 *   - flat grid heat map (channel/cell density)
 *   - color: success / stress / slowdown / accel / dwell
 * Transcript ref: Neuralink demo (spike→pixel, open-loop intent map, circle timing).
 * VER: webgrid-contrail-v2
 */
(function () {
  "use strict";
  try {
    if (!/neuralink\.com$/i.test(location.hostname) || !/webgrid/i.test(location.pathname)) return;
  } catch (e0) {
    return;
  }
  var VER = "webgrid-contrail-v2";
  if (window.__mgContrailVer === VER) return;
  /* hot-reload prior */
  if (typeof window.__mgContrailTeardown === "function") {
    try {
      window.__mgContrailTeardown();
    } catch (eTd) {}
  }
  window.__mgContrailVer = VER;

  var PATH_MAX = 320;
  var PATH_MIN = 0.0015;
  var ENDPOINT = "http://127.0.0.1:9880/";
  var path = [];
  var strokes = [];
  var cellHeat = {}; /* cellIndex -> count */
  var lastSample = null;
  var lastHit = null; /* {cell, t, ok} */
  var overlay = null;
  var flowPanel = null;
  var showOverlay = true;
  var showFlow = true;
  var Ngrid = 30;
  var stats = {
    samples: 0,
    strokes: 0,
    totalLen: 0,
    meanV: 0,
    maxV: 0,
    turnRate: 0,
    lastPhrase: "",
    successN: 0,
    stressN: 0,
    slowN: 0,
  };

  var listeners = [];

  function on(el, ev, fn, opt) {
    el.addEventListener(ev, fn, opt);
    listeners.push([el, ev, fn, opt]);
  }

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
      if (obj.kind === "contrail_stroke" || obj.kind === "contrail_summary") {
        var key = "mg.contrail.trials";
        var arr = JSON.parse(localStorage.getItem(key) || "[]");
        arr.push(obj);
        if (arr.length > 400) arr = arr.slice(-400);
        localStorage.setItem(key, JSON.stringify(arr));
      }
    } catch (e2) {}
  }

  function dirBin(dx, dy) {
    if (Math.hypot(dx, dy) < 1e-6) return "·";
    var a = (Math.atan2(dy, dx) * 180) / Math.PI;
    var dirs = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
    return dirs[Math.round(((a + 360) % 360) / 45) % 8];
  }

  function curvature(a, b, c) {
    var dx1 = b.nx - a.nx,
      dy1 = b.ny - a.ny;
    var dx2 = c.nx - b.nx,
      dy2 = c.ny - b.ny;
    var cross = dx1 * dy2 - dy1 * dx2;
    var d1 = Math.hypot(dx1, dy1) || 1e-6;
    var d2 = Math.hypot(dx2, dy2) || 1e-6;
    return cross / (d1 * d2);
  }

  /**
   * Trajectory class for color delineation:
   *  success — hit / smooth approach
   *  stress  — miss, thrash, high jerk/curvature
   *  slow    — intentional slowdown / low v
   *  accel   — rising velocity
   *  dwell   — near-stop
   */
  function classifySample(sample, prev) {
    if (sample.outcome === "hit") return "success";
    if (sample.outcome === "miss") return "stress";
    var v = sample.v || 0;
    var pv = prev ? prev.v || 0 : v;
    if (v < 0.12) return "dwell";
    if (v < 0.45 && v <= pv * 0.85) return "slow";
    if (v > pv * 1.35 && v > 0.6) return "accel";
    if (sample.jerk != null && sample.jerk > 2.5) return "stress";
    if (sample.curv != null && Math.abs(sample.curv) > 0.75) return "stress";
    if (v > 1.4) return "accel";
    return "cruise";
  }

  function trajColor(kind, alpha) {
    var a = alpha == null ? 0.85 : alpha;
    switch (kind) {
      case "success":
        return "rgba(80,230,160," + a + ")"; /* hit / smooth */
      case "stress":
        return "rgba(255,110,90," + a + ")"; /* thrash / miss */
      case "slow":
        return "rgba(140,120,255," + a + ")"; /* intentional slowdown */
      case "dwell":
        return "rgba(100,160,220," + a + ")"; /* pause */
      case "accel":
        return "rgba(255,210,100," + a + ")"; /* speed-up */
      default:
        return "rgba(160,210,255," + a + ")"; /* cruise ice */
    }
  }

  function pushPoint(nx, ny, meta) {
    meta = meta || {};
    var now = Date.now();
    if (meta.N === 12 || meta.N === 30) Ngrid = meta.N;
    if (lastSample) {
      var dx = nx - lastSample.nx;
      var dy = ny - lastSample.ny;
      var dist = Math.hypot(dx, dy);
      if (dist < PATH_MIN && !meta.force) return;
      var dt = Math.max(8, now - lastSample.t);
      var v = dist / (dt / 1000);
      var jerk = Math.abs(v - (lastSample.v || 0)) / (dt / 1000);
      var curv = 0;
      if (path.length >= 2) {
        curv = curvature(path[path.length - 2], lastSample, {
          nx: nx,
          ny: ny,
        });
      }
      var sample = {
        nx: nx,
        ny: ny,
        t: now,
        v: v,
        jerk: jerk,
        curv: curv,
        cell: meta.cell != null ? meta.cell : lastSample.cell,
        phase: meta.phase || lastSample.phase || "play",
        src: meta.src || "ptr",
        dir: dirBin(dx, dy),
        outcome: meta.outcome || null,
      };
      sample.traj = classifySample(sample, lastSample);
      path.push(sample);
      stats.samples++;
      stats.totalLen += dist;
      stats.meanV = stats.meanV * 0.9 + v * 0.1;
      if (v > stats.maxV) stats.maxV = v;
      if (sample.traj === "success") stats.successN++;
      if (sample.traj === "stress") stats.stressN++;
      if (sample.traj === "slow" || sample.traj === "dwell") stats.slowN++;
      if (sample.cell != null) cellHeat[sample.cell] = (cellHeat[sample.cell] || 0) + 1;
      lastSample = sample;
    } else {
      lastSample = {
        nx: nx,
        ny: ny,
        t: now,
        v: 0,
        jerk: 0,
        curv: 0,
        cell: meta.cell,
        phase: meta.phase || "play",
        src: meta.src || "ptr",
        dir: "·",
        outcome: meta.outcome || null,
        traj: "dwell",
      };
      path.push(lastSample);
      stats.samples++;
    }
    while (path.length > PATH_MAX) path.shift();
    maybeCloseStroke();
    draw();
    paintFlow();
  }

  function maybeCloseStroke() {
    if (path.length < 6) return;
    var last = path[path.length - 1];
    var idle = Date.now() - last.t > 280;
    var long = path.length >= 56;
    if (!idle && !long) return;
    var seg = path.slice(-Math.min(path.length, 72));
    if (seg.length < 4) return;
    var phrase = [];
    var i = 0;
    var raw = seg.map(function (p) {
      return p.dir || "·";
    });
    while (i < raw.length) {
      var d = raw[i],
        n = 1;
      while (i + n < raw.length && raw[i + n] === d) n++;
      phrase.push(n > 1 ? d + n : d);
      i += n;
    }
    var phraseStr = phrase.join("");
    var turns = 0;
    var trajCounts = { success: 0, stress: 0, slow: 0, dwell: 0, accel: 0, cruise: 0 };
    for (var j = 0; j < seg.length; j++) {
      trajCounts[seg[j].traj || "cruise"] = (trajCounts[seg[j].traj || "cruise"] || 0) + 1;
      if (j >= 2 && Math.abs(curvature(seg[j - 2], seg[j - 1], seg[j])) > 0.55) turns++;
    }
    stats.turnRate = turns / Math.max(1, seg.length);
    stats.lastPhrase = phraseStr.slice(0, 48);
    stats.strokes++;
    var hops = 0;
    for (var k = 1; k < seg.length; k++) {
      if (seg[k].cell != null && seg[k - 1].cell != null && seg[k].cell !== seg[k - 1].cell)
        hops++;
    }
    var dominant = "cruise";
    var maxC = 0;
    Object.keys(trajCounts).forEach(function (k) {
      if (trajCounts[k] > maxC) {
        maxC = trajCounts[k];
        dominant = k;
      }
    });
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
      meanV:
        seg.reduce(function (a, p) {
          return a + (p.v || 0);
        }, 0) / seg.length,
      maxV: seg.reduce(function (a, p) {
        return Math.max(a, p.v || 0);
      }, 0),
      turns: turns,
      turnRate: stats.turnRate,
      hops: hops,
      dominant: dominant,
      trajCounts: trajCounts,
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
        trajCounts.stress || 0,
        trajCounts.success || 0,
        trajCounts.slow || 0,
      ],
      label: dominant === "success" || dominant === "cruise" ? 1 : 0,
      meta: { src: "webgrid", kbatch_style: true, neuralink_circle_unwind: true },
      /* story beat for living books / overnight narrative */
      storyBeat: phraseToBeat(phraseStr, dominant, hops),
    };
    strokes.push(stroke);
    if (strokes.length > 48) strokes.shift();
    post(stroke);
    if (idle) path = path.slice(-3);
    log(
      "stroke «" +
        stroke.phrase.slice(0, 20) +
        "» " +
        dominant +
        " turns=" +
        turns +
        " hops=" +
        hops
    );
  }

  /** Map path phrase → living-book beat (Ants / kids creator) */
  function phraseToBeat(phrase, dominant, hops) {
    var mood =
      dominant === "success"
        ? "triumph"
        : dominant === "stress"
          ? "tension"
          : dominant === "slow" || dominant === "dwell"
            ? "wonder"
            : dominant === "accel"
              ? "rush"
              : "journey";
    return {
      mood: mood,
      glyph: phrase.slice(0, 24) || "·",
      hops: hops || 0,
      hint:
        mood === "triumph"
          ? "The path found its mark."
          : mood === "tension"
            ? "The path twisted — try again carefully."
            : mood === "wonder"
              ? "Slow steps. Look around."
              : mood === "rush"
                ? "A sudden dash across the page!"
                : "Onward along the line.",
    };
  }

  function ensureOverlay() {
    if (overlay || !showOverlay) return;
    overlay = document.createElement("canvas");
    overlay.id = "mg-contrail-ov";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:50;pointer-events:none;width:100%;height:100%";
    (document.body || document.documentElement).appendChild(overlay);
  }

  function ensureFlowPanel() {
    if (flowPanel || !showFlow) return;
    if (!document.getElementById("mg-contrail-flow-css")) {
      var st = document.createElement("style");
      st.id = "mg-contrail-flow-css";
      st.textContent = [
        "#mg-contrail-flow{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);",
        "  z-index:125;width:min(720px,94vw);pointer-events:auto;",
        "  font:600 9px/1.25 ui-monospace,Menlo,monospace;color:rgba(210,225,240,0.92);",
        "  background:rgba(6,8,12,0.92);border:1px solid rgba(160,180,200,0.28);",
        "  border-radius:3px;backdrop-filter:blur(12px);padding:6px 8px 8px}",
        "#mg-contrail-flow .hdr{display:flex;justify-content:space-between;align-items:center;",
        "  letter-spacing:0.12em;text-transform:uppercase;color:rgba(160,210,255,0.95);margin-bottom:4px}",
        "#mg-contrail-flow .hdr button{appearance:none;background:transparent;border:0;",
        "  color:rgba(150,170,190,0.8);cursor:pointer;font:700 12px/1 system-ui}",
        "#mg-contrail-flow .row{display:grid;grid-template-columns:1.2fr 0.9fr 1fr;gap:6px}",
        "#mg-contrail-flow canvas{width:100%;height:72px;display:block;",
        "  background:rgba(0,0,0,0.35);border:1px solid rgba(140,160,180,0.18);border-radius:2px}",
        "#mg-contrail-flow .leg{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;",
        "  color:rgba(150,170,190,0.8);font-weight:500}",
        "#mg-contrail-flow .leg i{display:inline-block;width:8px;height:8px;border-radius:1px;margin-right:3px}",
        "#mg-contrail-flow .beat{margin-top:3px;color:rgba(180,220,255,0.85);font-weight:500;",
        "  max-height:2.4em;overflow:hidden}",
      ].join("");
      (document.head || document.documentElement).appendChild(st);
    }
    flowPanel = document.createElement("div");
    flowPanel.id = "mg-contrail-flow";
    flowPanel.innerHTML =
      '<div class="hdr"><span>Contrail · Pattern flow</span>' +
      '<span><button type="button" id="mg-ct-hide" title="hide">×</button></span></div>' +
      '<div class="row">' +
      '<canvas id="mg-ct-unwind" title="circles unwound in time"></canvas>' +
      '<canvas id="mg-ct-flat" title="flat cell heat map"></canvas>' +
      '<canvas id="mg-ct-composer" title="vertical phrase composer"></canvas>' +
      "</div>" +
      '<div class="leg">' +
      '<span><i style="background:rgba(80,230,160,0.95)"></i>success</span>' +
      '<span><i style="background:rgba(255,110,90,0.95)"></i>stress</span>' +
      '<span><i style="background:rgba(140,120,255,0.95)"></i>slow</span>' +
      '<span><i style="background:rgba(100,160,220,0.95)"></i>dwell</span>' +
      '<span><i style="background:rgba(255,210,100,0.95)"></i>accel</span>' +
      '<span><i style="background:rgba(160,210,255,0.95)"></i>cruise</span>' +
      "</div>" +
      '<div class="beat" id="mg-ct-beat">—</div>';
    (document.body || document.documentElement).appendChild(flowPanel);
    flowPanel.querySelector("#mg-ct-hide").onclick = function () {
      showFlow = false;
      flowPanel.remove();
      flowPanel = null;
    };
  }

  function drawCanvas(cv, w, h, fn) {
    if (!cv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = cv.clientWidth || w;
    var H = cv.clientHeight || h;
    cv.width = Math.floor(W * dpr);
    cv.height = Math.floor(H * dpr);
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    fn(ctx, W, H);
  }

  /** Neuralink-style: circles unwound in time — plot angle vs sample index colored by traj */
  function paintUnwind(ctx, W, H) {
    ctx.fillStyle = "rgba(150,170,190,0.55)";
    ctx.font = "600 8px ui-monospace,Menlo,monospace";
    ctx.fillText("UNWIND · angle×t", 4, 11);
    if (path.length < 3) return;
    var midX = 0.5,
      midY = 0.5;
    var n = path.length;
    for (var i = 0; i < n; i++) {
      var p = path[i];
      var ang = Math.atan2(p.ny - midY, p.nx - midX); // -pi..pi
      var x = (i / Math.max(1, n - 1)) * (W - 8) + 4;
      var y = H * 0.5 - (ang / Math.PI) * (H * 0.38);
      ctx.fillStyle = trajColor(p.traj || "cruise", 0.75);
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.strokeStyle = "rgba(160,180,200,0.2)";
    ctx.beginPath();
    ctx.moveTo(4, H * 0.5);
    ctx.lineTo(W - 4, H * 0.5);
    ctx.stroke();
  }

  /** Flat map: N×N cell heat (channel density metaphor) */
  function paintFlat(ctx, W, H) {
    ctx.fillStyle = "rgba(150,170,190,0.55)";
    ctx.font = "600 8px ui-monospace,Menlo,monospace";
    ctx.fillText("FLAT · " + Ngrid + "×" + Ngrid, 4, 11);
    var N = Ngrid || 30;
    var pad = 4;
    var top = 14;
    var cell = Math.min((W - pad * 2) / N, (H - top - pad) / N);
    var ox = pad + ((W - pad * 2 - cell * N) / 2);
    var maxH = 1;
    Object.keys(cellHeat).forEach(function (k) {
      if (cellHeat[k] > maxH) maxH = cellHeat[k];
    });
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        var idx = c + N * r;
        var h = cellHeat[idx] || 0;
        var a = h ? 0.15 + 0.8 * (h / maxH) : 0.04;
        ctx.fillStyle = "rgba(120,200,255," + a + ")";
        ctx.fillRect(ox + c * cell, top + r * cell, Math.max(1, cell - 0.5), Math.max(1, cell - 0.5));
      }
    }
  }

  /** Vertical composer strip — phrase tokens stacked (ugrad-r0 / IBM composer timeline) */
  function paintComposer(ctx, W, H) {
    ctx.fillStyle = "rgba(150,170,190,0.55)";
    ctx.font = "600 8px ui-monospace,Menlo,monospace";
    ctx.fillText("COMPOSER · phrase", 4, 11);
    var recent = strokes.slice(-12);
    if (!recent.length && stats.lastPhrase) {
      recent = [{ phrase: stats.lastPhrase, dominant: "cruise" }];
    }
    var rowH = Math.max(8, (H - 16) / Math.max(1, recent.length));
    recent.forEach(function (s, i) {
      var y = 14 + i * rowH;
      ctx.fillStyle = trajColor(s.dominant || "cruise", 0.35);
      ctx.fillRect(4, y, W - 8, rowH - 1);
      ctx.fillStyle = "rgba(220,235,250,0.9)";
      ctx.font = "600 8px ui-monospace,Menlo,monospace";
      ctx.fillText((s.phrase || "·").slice(0, 28), 6, y + rowH * 0.72);
    });
  }

  function paintFlow() {
    if (!showFlow) return;
    ensureFlowPanel();
    if (!flowPanel) return;
    drawCanvas(flowPanel.querySelector("#mg-ct-unwind"), 240, 72, paintUnwind);
    drawCanvas(flowPanel.querySelector("#mg-ct-flat"), 180, 72, paintFlat);
    drawCanvas(flowPanel.querySelector("#mg-ct-composer"), 200, 72, paintComposer);
    var beat = flowPanel.querySelector("#mg-ct-beat");
    if (beat) {
      var last = strokes[strokes.length - 1];
      if (last && last.storyBeat) {
        beat.textContent =
          "BEAT · " +
          last.storyBeat.mood +
          " · " +
          last.storyBeat.hint +
          " · «" +
          (last.storyBeat.glyph || "") +
          "»";
      } else {
        beat.textContent =
          VER +
          " · s" +
          stats.successN +
          " x" +
          stats.stressN +
          " z" +
          stats.slowN +
          " · «" +
          (stats.lastPhrase || "—") +
          "»";
      }
    }
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
      var alpha = 0.14 + age * 0.78;
      ctx.strokeStyle = trajColor(a1.traj || a0.traj || "cruise", alpha);
      ctx.lineWidth = 1.5 + age * 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a0.nx * w, a0.ny * h);
      ctx.lineTo(a1.nx * w, a1.ny * h);
      ctx.stroke();
    }
    var tip = path[path.length - 1];
    ctx.fillStyle = trajColor(tip.traj || "cruise", 0.95);
    ctx.beginPath();
    ctx.arc(tip.nx * w, tip.ny * h, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "600 10px ui-monospace,Menlo,monospace";
    ctx.fillStyle = "rgba(160,210,255,0.8)";
    ctx.fillText(
      "CONTRAIL " +
        (tip.traj || "").toUpperCase() +
        " " +
        (stats.lastPhrase || "").slice(0, 28),
      12,
      h - 18
    );
  }

  function onPtr(ev) {
    var w = window.innerWidth || 1;
    var h = window.innerHeight || 1;
    pushPoint(ev.clientX / w, ev.clientY / h, { src: "ptr", phase: "play" });
  }

  function observeAgent(clientX, clientY, cell, conf) {
    var w = window.innerWidth || 1;
    var h = window.innerHeight || 1;
    var outcome = null;
    if (lastHit && lastHit.cell === cell && Date.now() - lastHit.t < 80) {
      outcome = lastHit.ok ? "hit" : "miss";
    }
    /* agent shots treated as intended success unless marked */
    if (outcome == null && conf != null && conf >= 2) outcome = "hit";
    pushPoint(clientX / w, clientY / h, {
      src: "agent",
      cell: cell,
      phase: "agent",
      conf: conf,
      outcome: outcome,
      force: true,
      N: Ngrid,
    });
    if (cell != null) lastHit = { cell: cell, t: Date.now(), ok: outcome !== "miss" };
  }

  function markOutcome(ok, cell) {
    lastHit = { cell: cell, t: Date.now(), ok: !!ok };
    if (path.length) {
      path[path.length - 1].outcome = ok ? "hit" : "miss";
      path[path.length - 1].traj = ok ? "success" : "stress";
      draw();
      paintFlow();
    }
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
        successN: stats.successN,
        stressN: stats.stressN,
        slowN: stats.slowN,
      },
      recent: strokes.slice(-6).map(function (x) {
        return {
          phrase: x.phrase,
          dominant: x.dominant,
          turns: x.turns,
          hops: x.hops,
          storyBeat: x.storyBeat,
        };
      }),
      features: [
        stats.samples,
        stats.strokes,
        stats.totalLen,
        stats.meanV,
        stats.maxV,
        stats.turnRate,
        stats.successN,
        stats.stressN,
      ],
      cellHeatTop: Object.keys(cellHeat)
        .map(function (k) {
          return { cell: +k, n: cellHeat[k] };
        })
        .sort(function (a, b) {
          return b.n - a.n;
        })
        .slice(0, 12),
    };
    post(s);
    return s;
  }

  /** Export story beats for kids-book / kbatch living books */
  function exportStoryBeats() {
    return {
      ver: VER,
      t: Date.now(),
      source: "webgrid_contrail",
      beats: strokes.map(function (s) {
        return s.storyBeat;
      }),
      phrases: strokes.map(function (s) {
        return s.phrase;
      }),
    };
  }

  on(document, "pointermove", onPtr, { passive: true, capture: true });
  on(document, "pointerdown", onPtr, { passive: true, capture: true });
  on(window, "resize", function () {
    draw();
    paintFlow();
  });

  var sumTimer = setInterval(function () {
    if (stats.samples > 8) summary();
  }, 15000);

  window.__mgContrailTeardown = function () {
    listeners.forEach(function (x) {
      try {
        x[0].removeEventListener(x[1], x[2], x[3]);
      } catch (e) {}
    });
    clearInterval(sumTimer);
    if (overlay) overlay.remove();
    if (flowPanel) flowPanel.remove();
  };

  window.__mgContrail = {
    ver: VER,
    path: path,
    strokes: strokes,
    stats: stats,
    cellHeat: cellHeat,
    observeAgent: observeAgent,
    markOutcome: markOutcome,
    pushPoint: pushPoint,
    summary: summary,
    exportStoryBeats: exportStoryBeats,
    setOverlay: function (on) {
      showOverlay = !!on;
      if (!showOverlay && overlay) {
        overlay.remove();
        overlay = null;
      }
    },
    setFlow: function (on) {
      showFlow = !!on;
      if (!showFlow && flowPanel) {
        flowPanel.remove();
        flowPanel = null;
      } else if (showFlow) paintFlow();
    },
    report: function () {
      return (
        VER +
        " n=" +
        stats.samples +
        " s/x/z=" +
        stats.successN +
        "/" +
        stats.stressN +
        "/" +
        stats.slowN +
        " «" +
        (stats.lastPhrase || "—") +
        "»"
      );
    },
  };
  paintFlow();
  log(VER + " · success/stress/slow colors · unwind+flat+composer");
})();
