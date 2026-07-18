/* Memory Glass · μgrad WebGrid tensor + quantum composer (IBM-style)
 *
 * Learns target dynamics from page-calibrated WebGrid play:
 *   - observe cell index sequence (0..N²-1)
 *   - online logistic / embedding predict next cell
 *   - emit IBM Quantum Composer–style OpenQASM 3 for predicted cell
 *
 * Quantum Neuralink path: measurement of n qubits → cell id (like composer
 * measure → classical bits). Gate palette mirrors IBM Composer (H, X, RZ, CX).
 *
 * VER: ugrad-webgrid-tensor-v1
 */
(function () {
  "use strict";
  var VER = "ugrad-webgrid-tensor-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._ugradWgTensor === VER) return;
  HP._ugradWgTensor = VER;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "ugrad-tensor");
    } catch (e) {}
  }

  /* ── micro-tensor: small online model (no heavy PAGE train) ── */
  function zeros(n) {
    var a = new Float64Array(n);
    return a;
  }
  function softmaxSample(logits, temperature) {
    var t = Math.max(0.05, temperature || 1);
    var max = -Infinity;
    var i;
    for (i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i];
    var sum = 0;
    var ex = new Float64Array(logits.length);
    for (i = 0; i < logits.length; i++) {
      ex[i] = Math.exp((logits[i] - max) / t);
      sum += ex[i];
    }
    var r = Math.random() * sum;
    var c = 0;
    for (i = 0; i < ex.length; i++) {
      c += ex[i];
      if (r <= c) return i;
    }
    return logits.length - 1;
  }
  function argmax(a) {
    var bi = 0,
      bv = -Infinity;
    for (var i = 0; i < a.length; i++) {
      if (a[i] > bv) {
        bv = a[i];
        bi = i;
      }
    }
    return bi;
  }

  /**
   * Online next-cell model:
   * features = one-hot prev cell (dim N²) + bias
   * W is [N², N²+1] sparse via Map of rows
   * update: softmax CE gradient on predicted next
   */
  function createModel(N) {
    var dim = N * N;
    var rows = [];
    for (var i = 0; i < dim; i++) rows.push(zeros(dim + 1));
    return {
      N: N,
      dim: dim,
      W: rows,
      lr: 0.15,
      steps: 0,
      history: [],
      maxHist: 512,
    };
  }

  function logitsFor(model, prevIdx) {
    var dim = model.dim;
    var out = zeros(dim);
    var p = prevIdx >= 0 && prevIdx < dim ? prevIdx : 0;
    for (var j = 0; j < dim; j++) {
      var row = model.W[j];
      /* one-hot prev + bias */
      out[j] = row[p] + row[dim];
    }
    return out;
  }

  function trainStep(model, prevIdx, nextIdx) {
    if (prevIdx < 0 || nextIdx < 0) return;
    var dim = model.dim;
    var logits = logitsFor(model, prevIdx);
    var max = -Infinity,
      i;
    for (i = 0; i < dim; i++) if (logits[i] > max) max = logits[i];
    var ex = zeros(dim),
      sum = 0;
    for (i = 0; i < dim; i++) {
      ex[i] = Math.exp(logits[i] - max);
      sum += ex[i];
    }
    var lr = model.lr;
    for (i = 0; i < dim; i++) {
      var p = ex[i] / sum;
      var g = p - (i === nextIdx ? 1 : 0);
      var row = model.W[i];
      row[prevIdx] -= lr * g;
      row[dim] -= lr * g;
    }
    model.steps++;
  }

  function predict(model, prevIdx, opts) {
    opts = opts || {};
    var logits = logitsFor(model, prevIdx);
    var mode = opts.mode || "argmax";
    var idx = mode === "sample" ? softmaxSample(logits, opts.temperature || 0.8) : argmax(logits);
    var conf = 0;
    var max = -Infinity,
      sum = 0,
      i;
    for (i = 0; i < logits.length; i++) {
      if (logits[i] > max) max = logits[i];
    }
    for (i = 0; i < logits.length; i++) sum += Math.exp(logits[i] - max);
    conf = Math.exp(logits[idx] - max) / sum;
    return {
      index: idx,
      col: idx % model.N,
      row: Math.floor(idx / model.N),
      conf: conf,
      logitsTop: idx,
    };
  }

  /* ── IBM Quantum Composer–style circuit (OpenQASM 3) ──
   * Encode cell index as computational-basis bitstring on n qubits
   * (same idea as composer: prepare |cell⟩ then measure).
   * Optional superposition: H on all + phase oracle sketch for "target heat".
   */
  function qubitsForCells(dim) {
    var n = 1;
    while (1 << n < dim) n++;
    return Math.max(4, Math.min(12, n)); /* 30²=900 → 10 qubits */
  }

  function cellToBits(index, nQ) {
    var bits = [];
    for (var q = 0; q < nQ; q++) bits.push((index >> q) & 1);
    return bits;
  }

  /**
   * Build OpenQASM 3 circuit à la IBM Composer:
   * - reset-like: start |0…0⟩
   * - X on qubits where cell bit is 1
   * - optional H layer for superposition search (quantum-neuralink explore)
   * - measure all → classical register = cell id
   */
  function composeCircuit(pred, opts) {
    opts = opts || {};
    var N = pred.N || 30;
    var dim = N * N;
    var nQ = opts.qubits || qubitsForCells(dim);
    var bits = cellToBits(pred.index | 0, nQ);
    var superpose = !!opts.superpose;
    var lines = [];
    lines.push("// μgrad WebGrid · quantum-neuralink composer");
    lines.push("// IBM Quantum Composer–style OpenQASM 3");
    lines.push("// Predicted cell=" + pred.index + " (" + pred.col + "," + pred.row + ") N=" + N);
    lines.push("// conf=" + (pred.conf != null ? pred.conf.toFixed(4) : "?") + " steps=" + (pred.steps | 0));
    lines.push("OPENQASM 3.0;");
    lines.push('include "stdgates.inc";');
    lines.push("bit[" + nQ + "] c;");
    lines.push("");
    if (superpose) {
      lines.push("// Layer 1: Hadamard superpose (explore full grid Hilbert space)");
      for (var h = 0; h < nQ; h++) lines.push("h $" + h + ";");
      lines.push("// Layer 2: Phase mark predicted cell bits (oracle sketch)");
      for (var q = 0; q < nQ; q++) {
        if (bits[q]) lines.push("rz(3.141592653589793) $" + q + ";");
      }
      lines.push("// Layer 3: Diffuse");
      for (var h2 = 0; h2 < nQ; h2++) lines.push("h $" + h2 + ";");
      lines.push("// Light entanglement (composer-style CX chain)");
      for (var e = 0; e < nQ - 1; e++) lines.push("cx $" + e + ", $" + (e + 1) + ";");
    } else {
      lines.push("// Computational basis prepare |cell⟩ (composer bitstring load)");
      for (var q2 = 0; q2 < nQ; q2++) {
        if (bits[q2]) lines.push("x $" + q2 + ";");
      }
    }
    lines.push("");
    lines.push("// Measure → classical bits = cell index (LSB = $0)");
    for (var m = 0; m < nQ; m++) lines.push("c[" + m + "] = measure $" + m + ";");
    return {
      qasm: lines.join("\n") + "\n",
      qubits: nQ,
      bits: bits,
      cell: pred.index,
      N: N,
      style: superpose ? "superpose-oracle" : "basis-prepare",
      ibmComposerHint: "Paste into https://quantum.ibm.com/composer · " + nQ + " qubits",
    };
  }

  /* ── Runtime state ── */
  var model = null;
  var lastCell = -1;
  var lastPred = null;
  var lastCircuit = null;
  var playLog = [];

  function ensureModel(N) {
    if (!model || model.N !== N) {
      model = createModel(N || 30);
      lastCell = -1;
      log("tensor model reset N=" + (N || 30) + " dim=" + model.dim);
    }
    return model;
  }

  function observeCell(index, N) {
    N = N || 30;
    ensureModel(N);
    if (index == null || index < 0 || index >= model.dim) return null;
    if (lastCell >= 0) trainStep(model, lastCell, index);
    model.history.push(index);
    if (model.history.length > model.maxHist) model.history.shift();
    lastCell = index;
    playLog.push({ t: Date.now(), cell: index, N: N });
    if (playLog.length > 2000) playLog.shift();
    var pred = predict(model, index, { mode: "argmax" });
    pred.N = N;
    pred.steps = model.steps;
    lastPred = pred;
    lastCircuit = composeCircuit(pred, { superpose: false });
    try {
      if (window.__mgMesh && window.__mgMesh.broadcast) {
        window.__mgMesh.broadcast("ugrad-webgrid", {
          cell: index,
          pred: pred.index,
          conf: pred.conf,
          steps: model.steps,
        });
      }
    } catch (eB) {}
    return pred;
  }

  function predictPlay(N, opts) {
    ensureModel(N || 30);
    var prev = lastCell >= 0 ? lastCell : 0;
    var pred = predict(model, prev, opts || { mode: "argmax" });
    pred.N = model.N;
    pred.steps = model.steps;
    lastPred = pred;
    lastCircuit = composeCircuit(pred, {
      superpose: !!(opts && opts.superpose),
    });
    return { pred: pred, circuit: lastCircuit };
  }

  /**
   * Quantum-neuralink play step: predict cell, compose circuit, return CSS click point.
   * Caller fires pointerup (page-calibrated).
   */
  function quantumStep(canvasRect, N, opts) {
    N = N || 30;
    var out = predictPlay(N, opts);
    var pred = out.pred;
    var cellCss = (canvasRect && canvasRect.width ? canvasRect.width : 600) / N;
    var left = canvasRect ? canvasRect.left : 0;
    var top = canvasRect ? canvasRect.top : 0;
    return {
      pred: pred,
      circuit: out.circuit,
      clientX: left + (pred.col + 0.5) * cellCss,
      clientY: top + (pred.row + 0.5) * cellCss,
      qasm: out.circuit.qasm,
    };
  }

  function exportTrainingJSON() {
    return {
      ver: VER,
      N: model ? model.N : null,
      steps: model ? model.steps : 0,
      history: model ? model.history.slice(-200) : [],
      lastPred: lastPred,
      lastCircuit: lastCircuit
        ? {
            cell: lastCircuit.cell,
            qubits: lastCircuit.qubits,
            style: lastCircuit.style,
            qasmPreview: (lastCircuit.qasm || "").slice(0, 400),
          }
        : null,
    };
  }

  function downloadQasm(filename) {
    if (!lastCircuit) return false;
    try {
      var blob = new Blob([lastCircuit.qasm], { type: "text/plain" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename || "webgrid-cell-" + lastCircuit.cell + ".qasm";
      a.click();
      URL.revokeObjectURL(a.href);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* Bridge: when webgrid calib finds a cell, train tensor */
  function hookWebgridCalib() {
    var C = window.__mgWebgridCalib;
    if (!C || C._tensorHooked) return;
    C._tensorHooked = true;
    var origFind = C.findTarget;
    if (typeof origFind === "function") {
      C.findTarget = function () {
        var t = origFind.apply(this, arguments);
        if (t && t.index != null) {
          try {
            observeCell(t.index, t.N || C.detectGridSize());
          } catch (eO) {}
        }
        return t;
      };
    }
  }

  window.__mgUgradWebgrid = {
    ver: VER,
    ensureModel: ensureModel,
    observeCell: observeCell,
    predict: predictPlay,
    composeCircuit: function (pred, opts) {
      return composeCircuit(pred || lastPred || { index: 0, col: 0, row: 0, N: 30 }, opts);
    },
    quantumStep: quantumStep,
    exportTrainingJSON: exportTrainingJSON,
    downloadQasm: downloadQasm,
    getModel: function () {
      return model;
    },
    getLastCircuit: function () {
      return lastCircuit;
    },
    getLastPred: function () {
      return lastPred;
    },
    bpsFromNtpm: function (ntpm, N) {
      N = N || 30;
      return Math.max((Math.log(N * N - 1) / Math.LN2) * (Math.max(0, ntpm) / 60), 0);
    },
  };

  /* extend ugrad ladder if present */
  try {
    if (window.__mgUgrad) {
      window.__mgUgrad.webgridTensor = window.__mgUgradWebgrid;
      window.__mgUgrad.openQuantumComposer = function () {
        try {
          if (window.ipc && window.ipc.postMessage) {
            window.ipc.postMessage(
              JSON.stringify({
                op: "open_tab",
                url: "https://quantum.ibm.com/composer",
                title: "IBM Composer",
              })
            );
          } else {
            window.open("https://quantum.ibm.com/composer", "_blank", "noopener");
          }
        } catch (e) {
          window.open("https://quantum.ibm.com/composer", "_blank", "noopener");
        }
      };
    }
  } catch (eU) {}

  setTimeout(hookWebgridCalib, 800);
  setInterval(hookWebgridCalib, 3000);

  log(VER + " · tensor next-cell · IBM-style QASM composer");
})();
