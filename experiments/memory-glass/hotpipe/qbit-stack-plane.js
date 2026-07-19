/* Memory Glass · Qbit Stack Plane
 * Bloch sphere + data visualizer ABOVE the gate deck so you can:
 *   - run ugrad-r0 / WebGrid tensor model
 *   - watch live trajectory IN (observed) and OUT (predicted)
 *   - see Bloch state trail as gates fire
 * VER: qbit-stack-plane-v1
 */
(function () {
  "use strict";
  var VER = "qbit-stack-plane-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._qbitStackVer === VER) return;
  HP._qbitStackVer = VER;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "qbit-stack");
    } catch (e) {}
  }

  var state = {
    ver: VER,
    running: false,
    simTimer: 0,
    blochTrail: [], /* {theta, phi, gate, t} */
    inTrail: [], /* observed cell indices */
    outTrail: [], /* predicted cell indices */
    lastPred: null,
    lastCircuit: null,
    N: 30,
    status: "",
  };
  var MAX_BLOCH = 64;
  var MAX_CELL = 120;

  var rootEl = null;
  var blochCv = null;
  var dataCv = null;
  var metaEl = null;
  var qasmEl = null;
  var statusEl = null;
  var anim = 0;

  function Q() {
    return window.__mgQuantum;
  }
  function T() {
    return window.__mgUgradWebgrid;
  }
  function U() {
    return window.__mgUgrad;
  }

  function pushBloch(gate) {
    var q = Q() && Q().state;
    if (!q) return;
    state.blochTrail.push({
      theta: q.theta || 0,
      phi: q.phi || 0,
      gate: gate || "",
      t: Date.now(),
    });
    if (state.blochTrail.length > MAX_BLOCH)
      state.blochTrail = state.blochTrail.slice(-MAX_BLOCH);
  }

  function onGate(g) {
    pushBloch((g && (g.id || g.name)) || g || "");
    paint();
  }

  function onCell(index, pred) {
    if (index == null || index < 0) return;
    state.inTrail.push(index);
    if (state.inTrail.length > MAX_CELL)
      state.inTrail = state.inTrail.slice(-MAX_CELL);
    if (pred && pred.index != null) {
      state.outTrail.push(pred.index);
      if (state.outTrail.length > MAX_CELL)
        state.outTrail = state.outTrail.slice(-MAX_CELL);
      state.lastPred = pred;
    }
    if (T() && T().getLastCircuit) state.lastCircuit = T().getLastCircuit();
    paint();
  }

  /* ── ugrad-r0 / tensor run ── */
  function openUgradR0() {
    try {
      if (U() && U().openR0) {
        U().openR0();
        setStatus("ugrad-r0 opened");
        return;
      }
    } catch (e) {}
    var u = "https://mueee.qbitos.ai/ugrad-r0.html";
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({ op: "open_tab", url: u, title: "μgrad R0" })
        );
      } else window.open(u, "_blank", "noopener");
    } catch (e2) {
      window.open(u, "_blank", "noopener");
    }
    setStatus("ugrad-r0 · mueee");
  }

  function openUgradTensor() {
    try {
      if (U() && U().openLevel) {
        U().openLevel(1); /* microtorch #tensor */
        setStatus("ugrad-r0#tensor");
        return;
      }
    } catch (e) {}
    var u = "https://mueee.qbitos.ai/ugrad-r0.html#tensor";
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({ op: "open_tab", url: u, title: "μgrad tensor" })
        );
      } else window.open(u, "_blank", "noopener");
    } catch (e2) {
      window.open(u, "_blank", "noopener");
    }
  }

  function ensureTensor(N) {
    N = N || state.N;
    state.N = N;
    if (T() && T().ensureModel) T().ensureModel(N);
  }

  /** One live step: observe optional cell, predict OUT, optional gate from path */
  function stepIO(opts) {
    opts = opts || {};
    ensureTensor(opts.N || state.N);
    var tensor = T();
    if (!tensor) {
      setStatus("tensor missing — inject ugrad-webgrid-tensor");
      return null;
    }
    var N = state.N;
    var dim = N * N;
    var cell = opts.cell;
    if (cell == null || cell < 0) {
      /* synthetic walk if no live webgrid cell */
      var last =
        state.inTrail.length > 0
          ? state.inTrail[state.inTrail.length - 1]
          : Math.floor(dim / 2);
      var dr = [-N, -1, 1, N][Math.floor(Math.random() * 4)];
      cell = Math.max(0, Math.min(dim - 1, last + dr));
    }
    var pred = tensor.observeCell(cell, N);
    if (!pred && tensor.predict) {
      var p = tensor.predict(N, { mode: opts.sample ? "sample" : "argmax" });
      pred = p && p.pred;
      if (pred) {
        state.inTrail.push(cell);
        if (state.inTrail.length > MAX_CELL)
          state.inTrail = state.inTrail.slice(-MAX_CELL);
      }
    }
    if (pred) {
      onCell(cell, pred);
      /* map trajectory direction → gate on Bloch */
      var prev =
        state.inTrail.length > 1
          ? state.inTrail[state.inTrail.length - 2]
          : cell;
      var dRow = Math.floor(pred.index / N) - Math.floor(prev / N);
      var dCol = (pred.index % N) - (prev % N);
      var gate = "T";
      if (Math.abs(dRow) > Math.abs(dCol)) gate = dRow < 0 ? "H" : "X";
      else if (dCol !== 0) gate = dCol > 0 ? "Y" : "Z";
      if (Q() && Q().applyGate) {
        Q().applyGate({ id: gate, name: gate, why: "traj-out" });
        onGate(gate);
      }
      if (tensor.getLastCircuit) state.lastCircuit = tensor.getLastCircuit();
    }
    setStatus(
      "IO · in=" +
        cell +
        (pred
          ? " out=" +
            pred.index +
            " conf=" +
            (pred.conf != null ? pred.conf.toFixed(2) : "?")
          : "")
    );
    return { cell: cell, pred: pred };
  }

  function runLive(on) {
    if (on === false || (on == null && state.running)) {
      state.running = false;
      if (state.simTimer) {
        clearInterval(state.simTimer);
        state.simTimer = 0;
      }
      setStatus("trajectory paused");
      paint();
      return;
    }
    state.running = true;
    ensureTensor(state.N);
    if (state.simTimer) clearInterval(state.simTimer);
    state.simTimer = setInterval(function () {
      if (!state.running) return;
      stepIO({ sample: false });
    }, 280);
    setStatus("trajectory LIVE · tensor in/out");
    paint();
  }

  function clearTrails() {
    state.blochTrail = [];
    state.inTrail = [];
    state.outTrail = [];
    state.lastPred = null;
    state.lastCircuit = null;
    setStatus("trails cleared");
    paint();
  }

  function applyGate(id) {
    if (Q() && Q().applyGate) Q().applyGate({ id: id, name: id });
    onGate(id);
    setStatus("gate " + id);
  }

  function setStatus(s) {
    state.status = s || "";
    if (statusEl) statusEl.textContent = VER + " · " + state.status;
  }

  /* ── drawing ── */
  function ensureCss() {
    if (document.getElementById("mg-qbit-stack-css")) return;
    var st = document.createElement("style");
    st.id = "mg-qbit-stack-css";
    st.textContent = [
      "#mg-qbit-stack{display:flex;flex-direction:column;gap:8px;min-height:0}",
      "#mg-qbit-stack .qs-lab{",
      "  font:600 10px/1 -apple-system,system-ui;letter-spacing:0.06em;",
      "  text-transform:uppercase;color:rgba(255,255,255,0.4);padding:2px 2px 0}",
      "#mg-qbit-stack canvas{",
      "  width:100%;display:block;border-radius:14px;",
      "  background:rgba(8,10,14,0.75);border:1px solid rgba(255,255,255,0.1);",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.08)}",
      "#mg-qbit-bloch-cv{height:168px}",
      "#mg-qbit-data-cv{height:148px}",
      "#mg-qbit-stack .qs-hd{",
      "  display:flex;flex-wrap:wrap;gap:6px;align-items:center}",
      "#mg-qbit-stack .qs-hd button{",
      "  appearance:none;cursor:pointer;border:0;border-radius:10px;",
      "  padding:7px 10px;font:600 10px/1 -apple-system,system-ui;",
      "  letter-spacing:0.04em;text-transform:uppercase;",
      "  background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.9)}",
      "#mg-qbit-stack .qs-hd button.hot{background:rgba(10,132,255,0.3)}",
      "#mg-qbit-stack .qs-hd button.ok{background:rgba(48,209,88,0.24)}",
      "#mg-qbit-stack .qs-hd button.warn{background:rgba(255,160,80,0.24)}",
      "#mg-qbit-stack .qs-hd button.on{box-shadow:inset 0 0 0 1px rgba(255,255,255,0.4)}",
      "#mg-qbit-stack .qs-gates{",
      "  display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}",
      "#mg-qbit-stack .qs-gates button{",
      "  appearance:none;cursor:pointer;border:0;border-radius:10px;padding:10px 0;",
      "  font:700 12px/1 system-ui;background:rgba(10,132,255,0.16);",
      "  color:rgba(220,240,255,0.95)}",
      "#mg-qbit-stack .qs-gates button:hover{background:rgba(10,132,255,0.28)}",
      "#mg-qbit-stack .qs-meta{",
      "  font:500 10px/1.35 ui-monospace,Menlo,monospace;color:rgba(255,255,255,0.55);",
      "  padding:4px 2px;white-space:pre-wrap;word-break:break-word}",
      "#mg-qbit-stack .qs-meta b{color:rgba(255,255,255,0.9);font-weight:600}",
      "#mg-qbit-stack .qs-qasm{",
      "  max-height:72px;overflow:auto;padding:8px 10px;border-radius:12px;",
      "  background:rgba(0,0,0,0.28);font:500 9px/1.35 ui-monospace,Menlo,monospace;",
      "  color:rgba(160,220,180,0.9);white-space:pre-wrap}",
      "#mg-qbit-stack .qs-status{",
      "  font:500 10px/1.3 ui-monospace,Menlo,monospace;color:rgba(255,255,255,0.4);",
      "  padding:2px}",
      "#mg-qbit-stack .qs-legend{display:flex;flex-wrap:wrap;gap:10px;",
      "  font:600 9px/1 system-ui;letter-spacing:0.04em;text-transform:uppercase;",
      "  color:rgba(255,255,255,0.4);padding:0 2px}",
      "#mg-qbit-stack .qs-legend i{display:inline-block;width:8px;height:8px;",
      "  border-radius:50%;margin-right:4px;vertical-align:middle}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function sizeCanvas(cv, cssH) {
    if (!cv) return null;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = cv.clientWidth || 320;
    var h = cssH || cv.clientHeight || 160;
    if (cv.width !== Math.floor(w * dpr) || cv.height !== Math.floor(h * dpr)) {
      cv.width = Math.floor(w * dpr);
      cv.height = Math.floor(h * dpr);
    }
    var ctx = cv.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function drawBloch() {
    var s = sizeCanvas(blochCv, 168);
    if (!s || !s.ctx) return;
    var ctx = s.ctx,
      w = s.w,
      h = s.h;
    ctx.clearRect(0, 0, w, h);
    var cx = w * 0.32;
    var cy = h * 0.52;
    var R = Math.min(w, h) * 0.36;

    /* sphere */
    ctx.strokeStyle = "rgba(120,190,230,0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(120,190,230,0.18)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, R, R * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, cy + R);
    ctx.stroke();
    ctx.fillStyle = "rgba(160,200,220,0.55)";
    ctx.font = "600 9px system-ui";
    ctx.fillText("|0⟩", cx + 6, cy - R - 4);
    ctx.fillText("|1⟩", cx + 6, cy + R + 12);

    function toXY(th, ph) {
      var x = Math.sin(th) * Math.cos(ph);
      var y = Math.sin(th) * Math.sin(ph);
      var z = Math.cos(th);
      return { x: cx + x * R, y: cy - z * R * 0.85 + y * R * 0.14 };
    }

    /* trajectory trail on sphere */
    var trail = state.blochTrail;
    if (trail.length > 1) {
      ctx.beginPath();
      for (var i = 0; i < trail.length; i++) {
        var p = toXY(trail[i].theta, trail[i].phi);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = "rgba(120,255,200,0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
      /* pulse head */
      var head = trail[trail.length - 1];
      var hp = toXY(head.theta, head.phi);
      var pulse = 0.5 + 0.5 * Math.sin(Date.now() / 180);
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, 3 + pulse * 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(120,255,200," + (0.6 + pulse * 0.35) + ")";
      ctx.fill();
    }

    var q = Q() && Q().state;
    if (q) {
      var cur = toXY(q.theta || 0, q.phi || 0);
      ctx.strokeStyle = "rgba(120,255,200,0.95)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cur.x, cur.y);
      ctx.stroke();
      ctx.fillStyle = "rgba(120,255,200,0.95)";
      ctx.beginPath();
      ctx.arc(cur.x, cur.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText("ψ", cur.x + 6, cur.y);

      var tgt = q.target || { theta: Math.PI / 2, phi: 0 };
      var tp = toXY(tgt.theta, tgt.phi);
      ctx.fillStyle = "rgba(255,200,120,0.85)";
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText("tgt", tp.x + 6, tp.y);
    }

    /* side readout */
    ctx.fillStyle = "rgba(200,220,240,0.8)";
    ctx.font = "600 10px ui-monospace,Menlo,monospace";
    var th = q ? (q.theta || 0).toFixed(3) : "—";
    var ph = q ? (q.phi || 0).toFixed(3) : "—";
    var seq =
      q && q.sequence && q.sequence.length
        ? q.sequence.slice(-12).join("")
        : "—";
    var lx = w * 0.58;
    ctx.fillText("BLOCH · live", lx, 22);
    ctx.fillStyle = "rgba(180,210,230,0.7)";
    ctx.font = "500 10px ui-monospace,Menlo,monospace";
    ctx.fillText("θ " + th, lx, 42);
    ctx.fillText("φ " + ph, lx, 58);
    ctx.fillText("seq " + seq, lx, 74);
    ctx.fillText("trail " + trail.length, lx, 90);
    var hits = q ? q.hits + "/" + q.trials : "—";
    ctx.fillText("score " + hits, lx, 106);
    if (state.running) {
      ctx.fillStyle = "rgba(80,230,160,0.95)";
      ctx.fillText("● LIVE", lx, 128);
    }
  }

  function drawData() {
    var s = sizeCanvas(dataCv, 148);
    if (!s || !s.ctx) return;
    var ctx = s.ctx,
      w = s.w,
      h = s.h;
    ctx.clearRect(0, 0, w, h);

    var N = state.N || 30;
    var gridW = Math.min(h - 16, w * 0.42);
    var ox = 10;
    var oy = (h - gridW) / 2;
    var cell = gridW / N;

    /* grid */
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(ox, oy, gridW, gridW);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    for (var g = 0; g <= N; g += Math.max(1, Math.floor(N / 10))) {
      var p = g * cell;
      ctx.beginPath();
      ctx.moveTo(ox + p, oy);
      ctx.lineTo(ox + p, oy + gridW);
      ctx.moveTo(ox, oy + p);
      ctx.lineTo(ox + gridW, oy + p);
      ctx.stroke();
    }

    function cellXY(idx) {
      var c = idx % N;
      var r = Math.floor(idx / N);
      return {
        x: ox + (c + 0.5) * cell,
        y: oy + (r + 0.5) * cell,
      };
    }

    function drawPath(arr, color, wline) {
      if (!arr || arr.length < 1) return;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = wline || 1.5;
      ctx.beginPath();
      for (var i = 0; i < arr.length; i++) {
        var pt = cellXY(arr[i]);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      var last = cellXY(arr[arr.length - 1]);
      ctx.beginPath();
      ctx.arc(last.x, last.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    /* IN (observed) green, OUT (predicted) amber */
    drawPath(state.inTrail, "rgba(80,230,160,0.85)", 2);
    drawPath(state.outTrail, "rgba(255,180,80,0.8)", 1.6);

    /* connecting last IN → last OUT */
    if (state.inTrail.length && state.outTrail.length) {
      var a = cellXY(state.inTrail[state.inTrail.length - 1]);
      var b = cellXY(state.outTrail[state.outTrail.length - 1]);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(160,200,255,0.55)";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /* right panel: confidence / steps / logits sketch */
    var rx = ox + gridW + 14;
    ctx.fillStyle = "rgba(200,220,240,0.85)";
    ctx.font = "600 10px ui-monospace,Menlo,monospace";
    ctx.fillText("DATA · trajectory I/O", rx, 20);
    ctx.fillStyle = "rgba(180,210,230,0.65)";
    ctx.font = "500 10px ui-monospace,Menlo,monospace";
    ctx.fillText("N=" + N + "  dim=" + N * N, rx, 38);
    ctx.fillText("IN  n=" + state.inTrail.length, rx, 54);
    ctx.fillText("OUT n=" + state.outTrail.length, rx, 70);

    var pred = state.lastPred || (T() && T().getLastPred && T().getLastPred());
    if (pred) {
      ctx.fillStyle = "rgba(255,200,120,0.9)";
      ctx.fillText(
        "pred (" +
          pred.col +
          "," +
          pred.row +
          ") conf " +
          (pred.conf != null ? pred.conf.toFixed(3) : "?"),
        rx,
        90
      );
      ctx.fillText("steps " + (pred.steps != null ? pred.steps : "—"), rx, 106);
      /* conf bar */
      var bw = Math.min(120, w - rx - 12);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(rx, 114, bw, 8);
      ctx.fillStyle = "rgba(255,180,80,0.85)";
      ctx.fillRect(rx, 114, bw * Math.max(0, Math.min(1, pred.conf || 0)), 8);
    } else {
      ctx.fillText("pred — run STEP / LIVE", rx, 90);
    }

    var m = T() && T().getModel && T().getModel();
    if (m) {
      ctx.fillStyle = "rgba(160,220,180,0.75)";
      ctx.fillText("tensor steps " + (m.steps || 0), rx, 138);
    }
  }

  function paintMeta() {
    if (!metaEl) return;
    var q = Q() && Q().state;
    var lines = [];
    lines.push(
      "Bloch  θ=<b>" +
        (q ? (q.theta || 0).toFixed(3) : "—") +
        "</b>  φ=<b>" +
        (q ? (q.phi || 0).toFixed(3) : "—") +
        "</b>  trail=<b>" +
        state.blochTrail.length +
        "</b>"
    );
    lines.push(
      "Tensor IN=<b>" +
        state.inTrail.length +
        "</b>  OUT=<b>" +
        state.outTrail.length +
        "</b>  N=<b>" +
        state.N +
        "</b>" +
        (state.running ? "  <b style=\"color:#50e6a0\">LIVE</b>" : "")
    );
    var pred = state.lastPred;
    if (pred) {
      lines.push(
        "last OUT cell=<b>" +
          pred.index +
          "</b> (" +
          pred.col +
          "," +
          pred.row +
          ") conf=<b>" +
          (pred.conf != null ? pred.conf.toFixed(3) : "?") +
          "</b>"
      );
    }
    metaEl.innerHTML = lines.join("\n");
    if (qasmEl) {
      var c =
        state.lastCircuit ||
        (T() && T().getLastCircuit && T().getLastCircuit());
      qasmEl.textContent = c && c.qasm
        ? c.qasm.slice(0, 600)
        : "// OpenQASM appears after tensor predict / STEP";
    }
  }

  function paint() {
    drawBloch();
    drawData();
    paintMeta();
    if (statusEl && state.status)
      statusEl.textContent = VER + " · " + state.status;
  }

  function startAnim() {
    if (anim) return;
    function tick() {
      drawBloch();
      if (state.running || state.blochTrail.length) {
        anim = requestAnimationFrame(tick);
      } else {
        anim = 0;
      }
    }
    anim = requestAnimationFrame(tick);
  }

  function embedInto(host) {
    if (!host) return false;
    ensureCss();
    rootEl = host;
    host.innerHTML = "";
    host.id = host.id || "mg-qbit-stack-host";

    var root = document.createElement("div");
    root.id = "mg-qbit-stack";

    var lab1 = document.createElement("div");
    lab1.className = "qs-lab";
    lab1.textContent = "Bloch · state + gate trajectory";
    root.appendChild(lab1);

    blochCv = document.createElement("canvas");
    blochCv.id = "mg-qbit-bloch-cv";
    blochCv.setAttribute("aria-label", "Bloch sphere live trajectory");
    root.appendChild(blochCv);

    var lab2 = document.createElement("div");
    lab2.className = "qs-lab";
    lab2.textContent = "Data · tensor trajectory IN / OUT";
    root.appendChild(lab2);

    var legend = document.createElement("div");
    legend.className = "qs-legend";
    legend.innerHTML =
      '<span><i style="background:#50e6a0"></i>IN observed</span>' +
      '<span><i style="background:#ffb450"></i>OUT predicted</span>' +
      '<span><i style="background:#78ffc8"></i>Bloch trail</span>';
    root.appendChild(legend);

    dataCv = document.createElement("canvas");
    dataCv.id = "mg-qbit-data-cv";
    dataCv.setAttribute("aria-label", "Tensor in/out trajectory");
    root.appendChild(dataCv);

    metaEl = document.createElement("div");
    metaEl.className = "qs-meta";
    root.appendChild(metaEl);

    qasmEl = document.createElement("div");
    qasmEl.className = "qs-qasm";
    root.appendChild(qasmEl);

    var hd = document.createElement("div");
    hd.className = "qs-hd";
    function btn(label, cls, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (cls) b.className = cls;
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        fn(b);
      };
      hd.appendChild(b);
      return b;
    }
    var liveBtn = btn("LIVE", "hot", function (b) {
      runLive();
      b.textContent = state.running ? "PAUSE" : "LIVE";
      b.className = state.running ? "on ok" : "hot";
    });
    btn("STEP", "ok", function () {
      stepIO({});
    });
    btn("R0", "warn", function () {
      openUgradR0();
    });
    btn("TENSOR", "", function () {
      openUgradTensor();
    });
    btn("QASM", "", function () {
      if (T() && T().downloadQasm) {
        T().downloadQasm();
        setStatus("qasm download");
      } else setStatus("no circuit yet");
    });
    btn("CLEAR", "", function () {
      clearTrails();
      liveBtn.textContent = "LIVE";
      liveBtn.className = "hot";
    });
    btn("N30", "", function () {
      state.N = 30;
      ensureTensor(30);
      setStatus("grid 30×30");
      paint();
    });
    btn("N8", "", function () {
      state.N = 8;
      ensureTensor(8);
      setStatus("grid 8×8 (fast)");
      paint();
    });
    root.appendChild(hd);

    var lab3 = document.createElement("div");
    lab3.className = "qs-lab";
    lab3.textContent = "Qbit · gates (drive Bloch + train path)";
    root.appendChild(lab3);

    var gates = document.createElement("div");
    gates.className = "qs-gates";
    ["H", "X", "Y", "Z", "S", "T"].forEach(function (g) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = g;
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        applyGate(g);
      };
      gates.appendChild(b);
    });
    root.appendChild(gates);

    var more = document.createElement("div");
    more.className = "qs-hd";
    function mbtn(label, cls, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (cls) b.className = cls;
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        fn();
      };
      more.appendChild(b);
    }
    mbtn("|0⟩", "muted", function () {
      if (Q() && Q().reset) Q().reset();
      pushBloch("RST");
      setStatus("reset |0⟩");
      paint();
    });
    mbtn("SCORE", "hot", function () {
      if (Q() && Q().scoreHit) Q().scoreHit();
      setStatus(Q() && Q().report ? Q().report() : "score");
      paint();
    });
    mbtn("RAIL", "", function () {
      if (Q() && Q().open) Q().open();
      setStatus("quantum rail open");
    });
    mbtn("COMPOSER", "", function () {
      var u = "https://quantum.cloud.ibm.com/composer";
      try {
        if (window.ipc)
          window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
        else window.open(u, "_blank");
      } catch (e) {
        window.open(u, "_blank");
      }
    });
    mbtn("EXPORT", "", function () {
      exportSnap();
    });
    root.appendChild(more);

    statusEl = document.createElement("div");
    statusEl.className = "qs-status";
    statusEl.textContent = VER + " · ready";
    root.appendChild(statusEl);

    host.appendChild(root);

    /* seed one trail point */
    pushBloch("");
    ensureTensor(state.N);
    paint();
    startAnim();
    setStatus("Bloch + data viz above Qbit · LIVE for tensor I/O");
    return true;
  }

  function exportSnap() {
    var snap = {
      ver: VER,
      t: Date.now(),
      N: state.N,
      blochTrail: state.blochTrail.slice(-80),
      inTrail: state.inTrail.slice(-120),
      outTrail: state.outTrail.slice(-120),
      lastPred: state.lastPred,
      quantum: Q() && Q().state
        ? {
            theta: Q().state.theta,
            phi: Q().state.phi,
            sequence: Q().state.sequence,
            hits: Q().state.hits,
            trials: Q().state.trials,
          }
        : null,
      tensor: T() && T().exportTrainingJSON ? T().exportTrainingJSON() : null,
    };
    try {
      var blob = new Blob([JSON.stringify(snap, null, 2)], {
        type: "application/json",
      });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "mg-qbit-stack-" + Date.now() + ".json";
      a.click();
      setStatus("exported trajectory stack");
    } catch (e) {
      setStatus("export fail");
    }
    return snap;
  }

  /* Hook quantum applyGate for live Bloch trail */
  function hookQuantum() {
    var q = Q();
    if (!q || q._stackHooked) return;
    q._stackHooked = true;
    var orig = q.applyGate;
    if (typeof orig === "function") {
      q.applyGate = function (g) {
        var r = orig.apply(this, arguments);
        try {
          onGate(g);
        } catch (e) {}
        return r;
      };
    }
  }

  /* Hook tensor observe for live IN/OUT */
  function hookTensor() {
    var t = T();
    if (!t || t._stackHooked) return;
    t._stackHooked = true;
    var orig = t.observeCell;
    if (typeof orig === "function") {
      t.observeCell = function (index, N) {
        var pred = orig.apply(this, arguments);
        try {
          onCell(index, pred);
        } catch (e) {}
        return pred;
      };
    }
  }

  setTimeout(hookQuantum, 200);
  setTimeout(hookTensor, 400);
  setInterval(function () {
    hookQuantum();
    hookTensor();
  }, 2500);

  window.__mgQbitStack = {
    ver: VER,
    state: state,
    embedInto: embedInto,
    paint: paint,
    onGate: onGate,
    onCell: onCell,
    stepIO: stepIO,
    runLive: runLive,
    clearTrails: clearTrails,
    openUgradR0: openUgradR0,
    openUgradTensor: openUgradTensor,
    exportSnap: exportSnap,
    report: function () {
      return (
        VER +
        " bloch=" +
        state.blochTrail.length +
        " in=" +
        state.inTrail.length +
        " out=" +
        state.outTrail.length +
        (state.running ? " LIVE" : "")
      );
    },
  };

  log(VER + " · Bloch + data viz + tensor I/O ready");
})();
