/* Memory Glass · Quantum Bloch + periodic-table WebGrid training (P-010e)
 * Cell grammar shared with market filmstrip + Neuralink WebGrid.
 * Sources: fornevercollective/composer, IBM Composer metaphor, matrix-periodic-table,
 *          mueee.qbitos.ai/uvqbit.html (concept align), ugrad ants grokGrad*.
 * Educational only — not implant / not hardware quantum claim.
 * VER: quantum-webgrid-v1
 */
(function () {
  "use strict";
  var VER = "quantum-webgrid-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._quantumWgVer === VER) return;
  HP._quantumWgVer = VER;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "info", String(m || ""), "qbit-wg");
    } catch (e) {}
  }

  var GATES = [
    { id: "H", name: "Hadamard", rot: [0, Math.PI / 2, Math.PI] },
    { id: "X", name: "Pauli-X", rot: [Math.PI, 0, 0] },
    { id: "Y", name: "Pauli-Y", rot: [Math.PI, Math.PI / 2, 0] },
    { id: "Z", name: "Pauli-Z", rot: [0, 0, Math.PI] },
    { id: "S", name: "Phase S", rot: [0, 0, Math.PI / 2] },
    { id: "T", name: "T gate", rot: [0, 0, Math.PI / 4] },
  ];

  // Periodic-style concept cells (kbatch school + Meta science map lite)
  var CAPSULES = [
    { z: 1, sym: "H", topic: "Hadamard · superpose", url: "https://quantum.cloud.ibm.com/composer" },
    { z: 2, sym: "X", topic: "NOT / bit flip", url: "https://github.com/fornevercollective/composer" },
    { z: 3, sym: "Y", topic: "Y rotation", url: "https://mueee.qbitos.ai/uvqbit.html" },
    { z: 4, sym: "Z", topic: "Phase flip", url: "https://kbatch.ugrad.ai/" },
    { z: 5, sym: "S", topic: "√Z phase", url: "https://mueee.qbitos.ai/ugrad-r0.html" },
    { z: 6, sym: "T", topic: "π/8 phase", url: "https://arxiv.org/search/?query=quantum+bloch+sphere" },
    { z: 7, sym: "CX", topic: "CNOT entangle", url: "https://quantum.cloud.ibm.com/composer" },
    { z: 8, sym: "μ", topic: "μgrad train", url: "https://mueee.qbitos.ai/webgrid-ugrad.html" },
    { z: 9, sym: "κ", topic: "kbatch glyph", url: "https://kbatch.ugrad.ai/dojo/" },
    { z: 10, sym: "ψ", topic: "statevector", url: "https://github.com/fornevercollective/composer" },
    { z: 11, sym: "M", topic: "measure Z", url: "https://quantum.cloud.ibm.com/composer" },
    { z: 12, sym: "Ω", topic: "Meta science map", url: "https://arxiv.org/list/quant-ph/recent" },
  ];

  var state = {
    ver: VER,
    open: false,
    // Bloch angles (theta, phi) radians — |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ}sin(θ/2)|1⟩
    theta: 0,
    phi: 0,
    target: { theta: Math.PI / 2, phi: 0 }, // |+⟩ default
    sequence: [],
    hits: 0,
    misses: 0,
    trials: 0,
    mode: "bloch", // bloch | periodic
    lastReport: "",
  };

  function applyGate(g) {
    // Simplified educational rotation on Bloch vector
    var th = state.theta;
    var ph = state.phi;
    if (g.id === "X") {
      th = Math.PI - th;
      ph = ph + Math.PI;
    } else if (g.id === "Y") {
      th = Math.PI - th;
      ph = ph + Math.PI / 2;
    } else if (g.id === "Z") {
      ph = ph + Math.PI;
    } else if (g.id === "H") {
      // H: |0⟩→|+⟩, approximate via theta/phi swap toward equator
      var nt = Math.PI / 2 - (th - Math.PI / 2);
      var np = ph === 0 && th < 0.2 ? 0 : ph + Math.PI;
      th = Math.abs(nt);
      ph = np;
    } else if (g.id === "S") {
      ph = ph + Math.PI / 2;
    } else if (g.id === "T") {
      ph = ph + Math.PI / 4;
    }
    state.theta = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (state.theta > Math.PI) state.theta = 2 * Math.PI - state.theta;
    state.phi = ((ph % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    state.sequence.push(g.id);
    paint();
    return { theta: state.theta, phi: state.phi };
  }

  function blochDistance() {
    // chordal distance on Bloch sphere (approx)
    var t0 = state.theta;
    var p0 = state.phi;
    var t1 = state.target.theta;
    var p1 = state.target.phi;
    var x0 = Math.sin(t0) * Math.cos(p0);
    var y0 = Math.sin(t0) * Math.sin(p0);
    var z0 = Math.cos(t0);
    var x1 = Math.sin(t1) * Math.cos(p1);
    var y1 = Math.sin(t1) * Math.sin(p1);
    var z1 = Math.cos(t1);
    var dot = x0 * x1 + y0 * y1 + z0 * z1;
    return Math.acos(Math.max(-1, Math.min(1, dot)));
  }

  function scoreHit() {
    var d = blochDistance();
    var hit = d < 0.35; // ~20°
    state.trials++;
    if (hit) state.hits++;
    else state.misses++;
    var trial = {
      domain: "quantum_webgrid",
      t: Date.now() / 1000,
      label: hit ? 1 : 0,
      features: [state.theta, state.phi, d, state.sequence.length],
      meta: {
        sequence: state.sequence.slice(),
        target: state.target,
        ver: VER,
      },
    };
    try {
      var key = "mg.quantum.trials";
      var arr = JSON.parse(localStorage.getItem(key) || "[]");
      arr.push(trial);
      if (arr.length > 400) arr = arr.slice(-400);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {}
    state.lastReport =
      (hit ? "HIT" : "MISS") +
      " d=" +
      d.toFixed(3) +
      " · " +
      state.hits +
      "/" +
      state.trials +
      " · " +
      state.sequence.join("");
    log(hit ? "ok" : "warn", state.lastReport);
    paint();
    // new target
    if (hit) {
      state.target = {
        theta: Math.random() * Math.PI,
        phi: Math.random() * 2 * Math.PI,
      };
      state.sequence = [];
    }
    return { hit: hit, d: d, trial: trial };
  }

  function resetState() {
    state.theta = 0;
    state.phi = 0;
    state.sequence = [];
    paint();
  }

  function ensureStyles() {
    if (document.getElementById("mg-qwg-css")) return;
    var st = document.createElement("style");
    st.id = "mg-qwg-css";
    st.textContent = [
      "#mg-qwg-rail{position:fixed;bottom:12px;left:48px;z-index:117;display:flex;flex-direction:column;",
      "  font:600 9px/1.25 ui-monospace,Menlo,monospace;pointer-events:none}",
      "#mg-qwg-tab{pointer-events:auto;appearance:none;cursor:pointer;",
      "  border:1px solid rgba(100,220,255,0.4);background:rgba(6,14,18,0.94);",
      "  color:rgba(160,230,255,0.92);padding:6px 10px;border-radius:4px;",
      "  letter-spacing:0.12em;text-transform:uppercase;align-self:flex-start}",
      "#mg-qwg-panel{pointer-events:auto;width:0;max-height:0;overflow:hidden;transition:all .18s ease;",
      "  background:rgba(4,12,16,0.97);border:1px solid rgba(80,180,220,0.28);",
      "  color:rgba(200,230,245,0.92);margin-bottom:6px;border-radius:4px}",
      "#mg-qwg-rail.open #mg-qwg-panel{width:min(420px,94vw);max-height:min(75vh,560px);",
      "  display:flex;flex-direction:column}",
      "#mg-qwg-head{padding:8px 10px;border-bottom:1px solid rgba(80,180,220,0.22);",
      "  display:flex;justify-content:space-between;letter-spacing:0.1em;text-transform:uppercase}",
      "#mg-qwg-canvas-wrap{height:160px;margin:6px 8px;border:1px solid rgba(80,180,220,0.2);",
      "  border-radius:3px;background:rgba(0,0,0,0.35)}",
      "#mg-qwg-canvas-wrap canvas{width:100%;height:100%;display:block}",
      "#mg-qwg-gates{display:flex;flex-wrap:wrap;gap:4px;padding:4px 8px}",
      "#mg-qwg-gates button,#mg-qwg-acts button{appearance:none;cursor:pointer;",
      "  border:1px solid rgba(100,190,230,0.35);background:rgba(8,18,24,0.95);",
      "  color:inherit;padding:5px 8px;border-radius:3px;text-transform:uppercase;letter-spacing:0.06em}",
      "#mg-qwg-acts button.hot{border-color:rgba(255,180,100,0.5);color:rgba(255,220,180,0.95)}",
      "#mg-qwg-acts{display:flex;flex-wrap:wrap;gap:4px;padding:4px 8px}",
      "#mg-qwg-table{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;padding:6px 8px;",
      "  max-height:140px;overflow:auto}",
      "#mg-qwg-table .cell{border:1px solid rgba(80,160,200,0.25);border-radius:2px;padding:4px;",
      "  text-align:center;cursor:pointer;background:rgba(0,20,30,0.5)}",
      "#mg-qwg-table .cell:hover{border-color:rgba(140,220,255,0.55)}",
      "#mg-qwg-status{padding:4px 8px 8px;opacity:0.85;font-weight:500}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  var rail, cv, statusEl;

  function drawBloch() {
    if (!cv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = cv.clientWidth || 380;
    var h = cv.clientHeight || 160;
    cv.width = Math.floor(w * dpr);
    cv.height = Math.floor(h * dpr);
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var cx = w * 0.28;
    var cy = h * 0.5;
    var R = Math.min(w, h) * 0.38;
    // sphere
    ctx.strokeStyle = "rgba(100,180,220,0.45)";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, R, R * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
    // axes
    ctx.strokeStyle = "rgba(140,200,230,0.35)";
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, cy + R);
    ctx.stroke();
    ctx.fillStyle = "rgba(160,200,220,0.6)";
    ctx.fillText("|0⟩", cx + 4, cy - R - 4);
    ctx.fillText("|1⟩", cx + 4, cy + R + 10);
    // state vector
    function vec(th, ph, color, label) {
      var x = Math.sin(th) * Math.cos(ph);
      var y = Math.sin(th) * Math.sin(ph);
      var z = Math.cos(th);
      // simple perspective: x horizontal, z vertical, y depth
      var px = cx + x * R;
      var py = cy - z * R * 0.85 + y * R * 0.15;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      if (label) ctx.fillText(label, px + 6, py);
    }
    vec(state.theta, state.phi, "rgba(120,255,200,0.95)", "ψ");
    vec(state.target.theta, state.target.phi, "rgba(255,200,120,0.85)", "tgt");
    // text panel
    ctx.fillStyle = "rgba(180,220,240,0.85)";
    ctx.fillText("θ=" + state.theta.toFixed(2) + "  φ=" + state.phi.toFixed(2), w * 0.55, 24);
    ctx.fillText("seq " + (state.sequence.join(" ") || "—"), w * 0.55, 40);
    ctx.fillText(
      "d=" + blochDistance().toFixed(3) + "  " + state.hits + "/" + state.trials,
      w * 0.55,
      56
    );
  }

  function paint() {
    drawBloch();
    if (statusEl)
      statusEl.textContent =
        VER +
        " · " +
        state.mode +
        " · " +
        (state.lastReport || "gate filmstrip · hit target on Bloch");
  }

  function setOpen(on) {
    state.open = !!on;
    if (rail) rail.classList.toggle("open", state.open);
    if (state.open) paint();
  }

  function mount() {
    ensureStyles();
    if (document.getElementById("mg-qwg-rail")) return;
    rail = document.createElement("div");
    rail.id = "mg-qwg-rail";
    rail.innerHTML =
      '<div id="mg-qwg-panel">' +
      '  <div id="mg-qwg-head"><span>Quantum · WebGrid</span>' +
      '  <button type="button" id="mg-qwg-x" style="appearance:none;background:transparent;border:0;color:inherit;cursor:pointer">×</button></div>' +
      '  <div id="mg-qwg-canvas-wrap"><canvas id="mg-qwg-cv"></canvas></div>' +
      '  <div id="mg-qwg-gates"></div>' +
      '  <div id="mg-qwg-acts">' +
      '    <button type="button" id="mg-qwg-score" class="hot">SCORE HIT</button>' +
      '    <button type="button" id="mg-qwg-reset">|0⟩</button>' +
      '    <button type="button" id="mg-qwg-composer">COMPOSER</button>' +
      '    <button type="button" id="mg-qwg-uvq">UVQBIT</button>' +
      "  </div>" +
      '  <div id="mg-qwg-table"></div>' +
      '  <div id="mg-qwg-status"></div>' +
      "</div>" +
      '<button type="button" id="mg-qwg-tab" title="Quantum WebGrid">QBIT</button>';
    (document.body || document.documentElement).appendChild(rail);
    cv = rail.querySelector("#mg-qwg-cv");
    statusEl = rail.querySelector("#mg-qwg-status");

    var gatesEl = rail.querySelector("#mg-qwg-gates");
    GATES.forEach(function (g) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = g.id;
      b.title = g.name;
      b.onclick = function () {
        applyGate(g);
      };
      gatesEl.appendChild(b);
    });

    var table = rail.querySelector("#mg-qwg-table");
    CAPSULES.forEach(function (c) {
      var cell = document.createElement("div");
      cell.className = "cell";
      cell.innerHTML = "<b>" + c.sym + "</b><br/>" + c.z;
      cell.title = c.topic;
      cell.onclick = function () {
        // map capsule to gate or open url
        var g = GATES.filter(function (x) {
          return x.id === c.sym;
        })[0];
        if (g) applyGate(g);
        else {
          try {
            if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: c.url }));
            else window.open(c.url, "_blank");
          } catch (e) {}
        }
        state.lastReport = "capsule " + c.sym + " · " + c.topic;
        paint();
      };
      table.appendChild(cell);
    });

    rail.querySelector("#mg-qwg-tab").onclick = function () {
      setOpen(!state.open);
    };
    rail.querySelector("#mg-qwg-x").onclick = function () {
      setOpen(false);
    };
    rail.querySelector("#mg-qwg-score").onclick = function () {
      scoreHit();
    };
    rail.querySelector("#mg-qwg-reset").onclick = function () {
      resetState();
    };
    rail.querySelector("#mg-qwg-composer").onclick = function () {
      var u = "https://quantum.cloud.ibm.com/composer";
      try {
        if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
        else window.open(u, "_blank");
      } catch (e) {}
    };
    rail.querySelector("#mg-qwg-uvq").onclick = function () {
      var u = "https://mueee.qbitos.ai/uvqbit.html";
      try {
        if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
        else window.open(u, "_blank");
      } catch (e) {}
    };

    paint();
    log("ok", VER + " · Bloch + periodic capsules");
  }

  window.__mgQuantum = {
    ver: VER,
    state: state,
    gates: GATES,
    capsules: CAPSULES,
    applyGate: applyGate,
    scoreHit: scoreHit,
    reset: resetState,
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: function () {
      setOpen(!state.open);
    },
    report: function () {
      return VER + " " + state.hits + "/" + state.trials + " seq=" + state.sequence.join("");
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
