/* Memory Glass · Qbit surface adapters (A–C + D search/mesh + gutter + light GT/Maze)
 * Routes Keys/Qbit stack · Staff/beats · WebGrid tensor · Maze traj ·
 * Search/Chat/Mesh · Dojo gutter · GT flow → __mgQbitBus.
 * Does not rewrite surfaces: monkey-hooks + thin publish helpers.
 * Rule: never edit QbitCodec.SYMBOLS here.
 * VER: qbit-adapters-v3
 */
(function () {
  "use strict";
  var VER = "qbit-adapters-v3";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._qbitAdaptersVer === VER) return;
  HP._qbitAdaptersVer = VER;

  var hooks = {
    stack: false,
    beats: false,
    tensor: false,
    maze: false,
    quantum: false,
    staff: false,
    search: false,
    mesh: false,
    gt: false,
    market: false,
    gutter: false,
  };
  var stats = {
    gate: 0,
    cell: 0,
    note: 0,
    traj: 0,
    classify: 0,
    chat: 0,
    go: 0,
    mesh: 0,
    gt: 0,
    gutter: 0,
  };

  /* coalesce high-rate sources */
  var lastCellPub = 0;
  var lastTrajPub = 0;
  var lastMeshPresencePub = 0;
  var CELL_MIN_MS = 40;
  var TRAJ_MIN_MS = 80;
  var MESH_PRESENCE_MIN_MS = 8000;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "qbit-adapters");
    } catch (e) {}
  }

  function bus() {
    return window.__mgQbitBus || null;
  }

  function dac() {
    return window.__mgQbitDac || null;
  }

  function gateToPrefix(gate) {
    var g = String(gate || "").toUpperCase();
    var map = {
      SWAP: "n:",
      H: "+1:",
      M: "-n:",
      RZ: "+0:",
      I: "0:",
      X: "-1:",
      T: "+n:",
      CZ: "+2:",
      S: "-0:",
      Y: "+3:",
      CNOT: "1:",
      Z: "-0:",
      CX: "1:",
    };
    return map[g] || "0:";
  }

  function pub(partial) {
    var b = bus();
    if (!b) return null;
    try {
      return b.publish(partial);
    } catch (e) {
      return null;
    }
  }

  /* ── Agent A: Qbit stack + quantum gates ── */
  function hookQuantum() {
    var q = window.__mgQuantum;
    if (!q || hooks.quantum) return;
    var orig = q.applyGate;
    if (typeof orig !== "function") return;
    hooks.quantum = true;
    q.applyGate = function (g) {
      var r = orig.apply(this, arguments);
      try {
        var id = (g && (g.id || g.name)) || g || "";
        stats.gate++;
        pub({
          src: "qbit",
          kind: "gate",
          lane: "L3",
          prefix: gateToPrefix(id),
          gate: String(id).toUpperCase(),
          withGlyph: true,
          payload: {
            id: id,
            why: (g && g.why) || null,
            theta: q.state && q.state.theta,
            phi: q.state && q.state.phi,
          },
        });
        if (dac()) dac().pulse("hud", 0.55, 120);
      } catch (eA) {}
      return r;
    };
    log("hook quantum.applyGate");
  }

  function hookStack() {
    var S = window.__mgQbitStack;
    if (!S || hooks.stack) return;
    hooks.stack = true;
    var origStep = S.stepIO;
    if (typeof origStep === "function") {
      S.stepIO = function (opts) {
        var r = origStep.apply(this, arguments);
        try {
          if (r) {
            pub({
              src: "qbit",
              kind: "traj",
              lane: "L3",
              prefix: "0:",
              withGlyph: true,
              payload: {
                cell: r.cell,
                pred: r.pred
                  ? {
                      index: r.pred.index,
                      conf: r.pred.conf,
                      row: r.pred.row,
                      col: r.pred.col,
                    }
                  : null,
              },
            });
            stats.traj++;
          }
        } catch (eS) {}
        return r;
      };
    }
    var origOnGate = S.onGate;
    if (typeof origOnGate === "function") {
      S.onGate = function (g) {
        var r = origOnGate.apply(this, arguments);
        /* quantum hook already publishes gate; skip double if same tick */
        return r;
      };
    }
    log("hook __mgQbitStack.stepIO");
  }

  /* ── Agent B: Staff / keyboard beats ── */
  function hookBeats() {
    var B = window.__mgKeyboardBeats;
    if (!B || hooks.beats) return;
    var origIngest = B.ingestNote;
    var origOnKey = B.onKey;
    if (typeof origIngest !== "function" && typeof origOnKey !== "function")
      return;
    hooks.beats = true;

    if (typeof origIngest === "function") {
      B.ingestNote = function (midi, meta) {
        var r = origIngest.apply(this, arguments);
        try {
          meta = meta || {};
          stats.note++;
          var vel = meta.hit === false ? 0.25 : 0.7;
          pub({
            src: "staff",
            kind: "note",
            lane: "L3",
            prefix: "+n:",
            gate: "T",
            withGlyph: true,
            dac: { ch: 2, level: vel },
            payload: {
              midi: midi,
              name: r && r.name,
              hit: meta.hit != null ? meta.hit : true,
              src: meta.src || "key",
              ch: meta.ch || "",
            },
          });
          if (dac()) dac().pulse("staff", vel, 160);
        } catch (eB) {}
        return r;
      };
    } else if (typeof origOnKey === "function") {
      B.onKey = function (ch, nx, ny) {
        var r = origOnKey.apply(this, arguments);
        try {
          if (r && r.midi != null && !r.deduped) {
            stats.note++;
            pub({
              src: "staff",
              kind: "note",
              lane: "L3",
              prefix: "+n:",
              gate: "T",
              withGlyph: true,
              payload: {
                midi: r.midi,
                name: r.name,
                hit: r.hit,
                ch: ch,
              },
            });
            if (dac()) dac().pulse("staff", r.hit ? 0.7 : 0.3, 160);
          }
        } catch (eK) {}
        return r;
      };
    }
    log("hook __mgKeyboardBeats");
  }

  function hookStaff() {
    var S = window.__mgStaffLab;
    if (!S || hooks.staff) return;
    hooks.staff = true;
    /* observe status / catalogue if APIs exist */
    if (typeof S.loadEntry === "function") {
      var orig = S.loadEntry;
      S.loadEntry = function (entry) {
        var r = orig.apply(this, arguments);
        try {
          pub({
            src: "staff",
            kind: "catalogue",
            lane: "L3",
            prefix: "+2:",
            withGlyph: true,
            payload: {
              title: entry && (entry.title || entry.id || entry.name),
              n:
                (entry && entry.midi && entry.midi.length) ||
                (entry && entry.degrees && entry.degrees.length) ||
                0,
            },
          });
        } catch (eC) {}
        return r;
      };
    }
    log("hook __mgStaffLab (if any)");
  }

  /* ── Agent C: WebGrid tensor ── */
  function hookTensor() {
    var T = window.__mgUgradWebgrid;
    if (!T || hooks.tensor) return;
    if (typeof T.observeCell !== "function") return;
    hooks.tensor = true;
    var origObs = T.observeCell;
    T.observeCell = function (index, N) {
      var pred = origObs.apply(this, arguments);
      try {
        var now = Date.now();
        if (now - lastCellPub >= CELL_MIN_MS) {
          lastCellPub = now;
          stats.cell++;
          var conf = pred && pred.conf != null ? pred.conf : 0;
          pub({
            src: "webgrid",
            kind: "cell",
            lane: "L3",
            prefix: conf > 0.6 ? "+1:" : "0:",
            gate: conf > 0.6 ? "H" : "I",
            withGlyph: true,
            dac: { ch: 3, level: Math.min(1, conf || 0.4) },
            payload: {
              index: index,
              N: N,
              pred: pred
                ? {
                    index: pred.index,
                    conf: pred.conf,
                    row: pred.row,
                    col: pred.col,
                  }
                : null,
              qasm:
                T.getLastCircuit && T.getLastCircuit()
                  ? String((T.getLastCircuit().qasm || "").slice(0, 200))
                  : null,
            },
          });
          if (dac()) dac().set("webgrid", Math.min(1, (conf || 0.3) + 0.2), {
            src: "tensor",
            publish: false,
          });
        }
      } catch (eT) {}
      return pred;
    };

    if (typeof T.predict === "function") {
      var origPred = T.predict;
      T.predict = function (N, opts) {
        var out = origPred.apply(this, arguments);
        try {
          pub({
            src: "webgrid",
            kind: "predict",
            lane: "L3",
            prefix: "+1:",
            gate: "H",
            withGlyph: true,
            payload: {
              N: N,
              pred: out && out.pred
                ? {
                    index: out.pred.index,
                    conf: out.pred.conf,
                  }
                : null,
              hasQasm: !!(out && out.circuit && out.circuit.qasm),
            },
          });
        } catch (eP) {}
        return out;
      };
    }
    log("hook __mgUgradWebgrid.observeCell/predict");
  }

  /* ── Light Maze traj (week-3 slice start) ── */
  function hookMaze() {
    var M = window.__mgMemoryMaze;
    if (!M || hooks.maze) return;
    var origKey = M.ingestKey;
    var origPath = M.ingestContrailPath;
    if (typeof origKey !== "function" && typeof origPath !== "function") return;
    hooks.maze = true;

    if (typeof origKey === "function") {
      M.ingestKey = function (ch, nx, ny) {
        var r = origKey.apply(this, arguments);
        try {
          var now = Date.now();
          if (now - lastTrajPub >= TRAJ_MIN_MS) {
            lastTrajPub = now;
            stats.traj++;
            pub({
              src: "maze",
              kind: "traj",
              lane: "L3",
              prefix: "-1:",
              gate: "X",
              withGlyph: true,
              dac: { ch: 1, level: 0.5 },
              payload: {
                ch: ch,
                nx: nx,
                ny: ny,
                coalesceMs: TRAJ_MIN_MS,
              },
            });
            if (dac()) dac().pulse("maze", 0.45, 100);
          }
        } catch (eM) {}
        return r;
      };
    }

    if (typeof origPath === "function") {
      M.ingestContrailPath = function (pathArr) {
        var r = origPath.apply(this, arguments);
        try {
          var now = Date.now();
          if (now - lastTrajPub >= TRAJ_MIN_MS) {
            lastTrajPub = now;
            var n = pathArr && pathArr.length ? pathArr.length : 0;
            pub({
              src: "maze",
              kind: "traj",
              lane: "L0",
              prefix: "-n:",
              gate: "M",
              withGlyph: true,
              payload: {
                pathLen: n,
                tip: n ? pathArr[n - 1] : null,
                coalesced: true,
              },
            });
            stats.traj++;
            if (dac()) dac().set("maze", Math.min(1, n / 32), {
              src: "contrail",
              publish: false,
            });
          }
        } catch (eP) {}
        return r;
      };
    }
    log("hook __mgMemoryMaze");
  }

  /* ── Agent D: Search / Chat / Mesh (week-2 → now) ── */
  function hookSearch() {
    var S = window.__mgSearchComms;
    if (!S || hooks.search) return;
    var any =
      typeof S.handle === "function" ||
      typeof S.sendChat === "function" ||
      typeof S.sendMesh === "function";
    if (!any) return;
    hooks.search = true;

    if (typeof S.sendChat === "function") {
      var origChat = S.sendChat;
      S.sendChat = function (text) {
        var r = origChat.apply(this, arguments);
        try {
          stats.chat++;
          pub({
            src: "search",
            kind: "chat",
            lane: "L3",
            prefix: "+1:",
            gate: "H",
            withGlyph: true,
            payload: {
              text: String(text || "").slice(0, 240),
              via: "search-bar",
            },
          });
          if (dac()) dac().pulse("hud", 0.4, 100);
        } catch (eCh) {}
        return r;
      };
    }

    if (typeof S.sendMesh === "function") {
      var origMeshCmd = S.sendMesh;
      S.sendMesh = function (text) {
        var r = origMeshCmd.apply(this, arguments);
        try {
          stats.mesh++;
          pub({
            src: "search",
            kind: "mesh-cmd",
            lane: "L3",
            prefix: "+n:",
            gate: "T",
            withGlyph: true,
            payload: {
              text: String(text || "").slice(0, 120),
              via: "search-bar",
            },
          });
          if (dac()) dac().pulse("agent", 0.35, 120);
        } catch (eMs) {}
        return r;
      };
    }

    if (typeof S.handle === "function") {
      var origHandle = S.handle;
      S.handle = function (raw) {
        var r = origHandle.apply(this, arguments);
        try {
          if (r && r.ok) {
            var kind = r.kind || "go";
            /* chat/mesh already published via send* wrappers */
            if (kind === "go") {
              stats.go++;
              pub({
                src: "search",
                kind: "go",
                lane: "L3",
                prefix: "0:",
                gate: "I",
                withGlyph: true,
                payload: {
                  url: r.url ? String(r.url).slice(0, 200) : null,
                  q: String(raw || "").slice(0, 120),
                },
              });
              if (dac()) dac().pulse("hud", 0.25, 80);
            } else if (
              kind !== "chat" &&
              kind !== "mesh" &&
              kind !== "help"
            ) {
              pub({
                src: "search",
                kind: "cmd",
                lane: "L3",
                prefix: "+0:",
                withGlyph: true,
                payload: {
                  cmd: kind,
                  q: String(raw || "").slice(0, 80),
                },
              });
            }
          }
        } catch (eH) {}
        return r;
      };
    }

    if (typeof S.setMode === "function") {
      var origMode = S.setMode;
      S.setMode = function (m) {
        var r = origMode.apply(this, arguments);
        try {
          pub({
            src: "search",
            kind: "mode",
            lane: "L3",
            prefix: "+0:",
            payload: { mode: m || "go" },
          });
        } catch (eM) {}
        return r;
      };
    }

    log("hook __mgSearchComms");
  }

  function hookMesh() {
    var M = window.__mgMesh;
    if (!M || hooks.mesh) return;
    if (typeof M.broadcast !== "function") return;
    hooks.mesh = true;

    var origBc = M.broadcast;
    M.broadcast = function (type, payload) {
      var msg = origBc.apply(this, arguments);
      try {
        var t = String(type || "presence");
        var now = Date.now();
        /* presence heartbeats every 4s — don't thrash bus */
        if (t === "presence") {
          if (now - lastMeshPresencePub < MESH_PRESENCE_MIN_MS) return msg;
          lastMeshPresencePub = now;
        }
        stats.mesh++;
        var prefix =
          t === "day-chat" || t === "chat"
            ? "+1:"
            : t === "day-score" || t === "score"
              ? "+2:"
              : t === "day-run" || t === "run"
                ? "+3:"
                : "-0:";
        pub({
          src: "mesh",
          kind: t,
          lane: "L3",
          prefix: prefix,
          withGlyph: t !== "presence",
          payload: {
            type: t,
            peers: typeof M.peerCount === "function" ? M.peerCount() : 0,
            seat: M.seatId ? String(M.seatId).slice(0, 8) : null,
            /* strip heavy iron/board blobs from presence */
            text:
              payload && payload.text
                ? String(payload.text).slice(0, 160)
                : null,
            score:
              payload && payload.score != null ? payload.score : null,
            synopsis:
              payload && payload.synopsis
                ? String(payload.synopsis).slice(0, 80)
                : null,
          },
        });
        if (t !== "presence" && dac()) dac().pulse("agent", 0.3, 90);
      } catch (eBc) {}
      return msg;
    };

    if (typeof M.shareScore === "function") {
      var origSs = M.shareScore;
      M.shareScore = function (snap) {
        var r = origSs.apply(this, arguments);
        /* broadcast wrapper already publishes day-score */
        return r;
      };
    }

    log("hook __mgMesh.broadcast");
  }

  /* ── Agent D light: GT flow (speed / export) — not full rewrite ── */
  function hookGt() {
    var G = window.__mgGtFlow;
    if (!G || hooks.gt) return;
    var any =
      typeof G.runSpeedTest === "function" ||
      typeof G.collectIpTools === "function" ||
      typeof G.exportFlow === "function";
    if (!any) return;
    hooks.gt = true;

    if (typeof G.runSpeedTest === "function") {
      var origSp = G.runSpeedTest;
      G.runSpeedTest = function () {
        var r = origSp.apply(this, arguments);
        try {
          stats.gt++;
          pub({
            src: "gt",
            kind: "speed",
            lane: "L3",
            prefix: "-1:",
            gate: "X",
            withGlyph: true,
            payload: {
              hops: G.state && G.state.hops ? G.state.hops.length : 0,
              summary: G.state && G.state.summary ? G.state.summary : null,
            },
          });
          if (dac()) dac().pulse("hud", 0.5, 140);
        } catch (eSp) {}
        return r;
      };
    }

    if (typeof G.collectIpTools === "function") {
      var origIp = G.collectIpTools;
      G.collectIpTools = function () {
        var r = origIp.apply(this, arguments);
        try {
          stats.gt++;
          pub({
            src: "gt",
            kind: "ip-tools",
            lane: "L3",
            prefix: "+0:",
            withGlyph: true,
            payload: { via: "gt-flow" },
          });
        } catch (eIp) {}
        return r;
      };
    }

    if (typeof G.exportFlow === "function") {
      var origEx = G.exportFlow;
      G.exportFlow = function () {
        var r = origEx.apply(this, arguments);
        try {
          pub({
            src: "gt",
            kind: "export",
            lane: "L3",
            prefix: "+2:",
            withGlyph: true,
            payload: { via: "gt-flow" },
          });
        } catch (eEx) {}
        return r;
      };
    }

    log("hook __mgGtFlow");
  }

  /* ── MKT thin open-only (no filmstrip rewrite) ── */
  function hookMarket() {
    var Mkt = window.__mgMarket;
    if (!Mkt || hooks.market) return;
    if (typeof Mkt.open !== "function") return;
    hooks.market = true;
    var origOpen = Mkt.open;
    Mkt.open = function () {
      var r = origOpen.apply(this, arguments);
      try {
        pub({
          src: "mkt",
          kind: "open",
          lane: "L3",
          prefix: "+3:",
          withGlyph: true,
          payload: { via: "adapter" },
        });
        if (dac()) dac().pulse("spare", 0.35, 100);
      } catch (eMk) {}
      return r;
    };
    log("hook __mgMarket.open (thin)");
  }

  /* ── Quantum gutter (dojo) first-class kind:"gutter" ── */
  function hookGutter() {
    var D = window.__mgKbatchDojo;
    if (!D || hooks.gutter) return;
    var hooked = false;
    if (typeof D.binaryStreamToGutter === "function" && !D._qbitGutterHooked) {
      D._qbitGutterHooked = true;
      hooked = true;
      var origG = D.binaryStreamToGutter;
      D.binaryStreamToGutter = function (text, binary, opts) {
        opts = opts || {};
        /* avoid double-publish if bridge already publishes */
        var o = Object.assign({}, opts, { publish: false });
        var gutter = origG.call(this, text, binary, o);
        try {
          stats.gutter++;
          pub({
            src: "dojo",
            kind: "gutter",
            lane: "L3",
            prefix: "-n:",
            gate: "M",
            withGlyph: true,
            payload: {
              bitCount: gutter && gutter.bitCount,
              ones: gutter && gutter.ones,
              gutterPreview: gutter && gutter.gutterPreview,
              gutterUrl: gutter && gutter.gutterUrl,
              text: String(text || "").slice(0, 64),
              via: "adapter",
            },
          });
          if (dac())
            dac().set(
              "hud",
              Math.min(1, ((gutter && gutter.bitCount) || 0) / 256),
              { src: "gutter", publish: false }
            );
        } catch (eG) {}
        return gutter;
      };
    }
    if (typeof D.runPhrase === "function" && !D._qbitPhraseHooked) {
      D._qbitPhraseHooked = true;
      hooked = true;
      var origP = D.runPhrase;
      D.runPhrase = function () {
        var ret = origP.apply(this, arguments);
        try {
          if (ret && typeof ret.then === "function") {
            return ret.then(function (report) {
              /* bridge already publishes gutter on runPhrase; count only */
              if (report && report.quantumGutter) stats.gutter++;
              return report;
            });
          }
        } catch (eR) {}
        return ret;
      };
    }
    if (hooked) {
      hooks.gutter = true;
      log("hook __mgKbatchDojo gutter");
    }
  }

  /* ── Inspect / debug subscriber ── */
  function bindInspectMirror() {
    var b = bus();
    if (!b || HP._qbitAdapterInspect) return;
    HP._qbitAdapterInspect = true;
    b.subscribe(function (env) {
      try {
        if (window.__mgInspectMirror && window.__mgInspectMirror.push) {
          window.__mgInspectMirror.push({
            ch: "qbit",
            kind: env.kind,
            src: env.src,
            prefix: env.prefix,
            tμ: env.tμ,
          });
        }
      } catch (e) {}
    });
  }

  /**
   * Node / offline smoke: install minimal surface stubs so hooks become live.
   * Safe no-op if real surfaces already present.
   */
  function installMocks() {
    function stub(name, obj) {
      if (!window[name]) window[name] = obj;
    }
    stub("__mgQuantum", {
      applyGate: function (g) {
        return g;
      },
      state: { theta: 0, phi: 0 },
    });
    stub("__mgQbitStack", {
      stepIO: function () {
        return { cell: 0, pred: { index: 1, conf: 0.5, row: 0, col: 1 } };
      },
      onGate: function () {},
    });
    stub("__mgKeyboardBeats", {
      ingestNote: function (midi, meta) {
        return { midi: midi, name: "C4", src: (meta && meta.src) || "key" };
      },
      onKey: function (ch) {
        return { midi: 60, hit: true, ch: ch };
      },
    });
    stub("__mgUgradWebgrid", {
      observeCell: function (index, N) {
        return { index: (index + 1) % ((N || 30) * (N || 30)), conf: 0.55, row: 0, col: 1 };
      },
      predict: function () {
        return { pred: { index: 1, conf: 0.5 }, circuit: { qasm: "// smoke" } };
      },
      getLastCircuit: function () {
        return { qasm: "// smoke" };
      },
    });
    stub("__mgMemoryMaze", {
      ingestKey: function () {},
      ingestContrailPath: function () {},
    });
    stub("__mgSearchComms", {
      sendChat: function () {},
      sendMesh: function () {},
      handle: function () {},
      setMode: function () {},
    });
    stub("__mgMesh", {
      broadcast: function () {},
    });
    stub("__mgGtFlow", {
      runSpeedTest: function () {},
      collectIpTools: function () {},
      exportFlow: function () {},
      state: { hops: [], summary: null },
    });
    stub("__mgKbatchDojo", {
      binaryStreamToGutter: function (text) {
        return {
          bitCount: 16,
          ones: 8,
          gutterPreview: "01 01 01",
          gutterUrl: "https://mueee.qbitos.ai/quantum-gutter.html",
        };
      },
      runPhrase: function () {
        return Promise.resolve({ quantumGutter: { bitCount: 8 } });
      },
    });
    stub("__mgMarket", {
      open: function () {},
    });
    stub("__mgIronline", window.__mgIronline || {
      tick: function () {},
      tickCortical: function () {},
      budgetOk: function () {
        return true;
      },
      state: {},
      corticalMs: 24,
    });
    /* reset hooks so install re-binds onto stubs */
    for (var k in hooks) hooks[k] = false;
    HP._qbitAdapterInspect = false;
    installAll();
    return report();
  }

  function installAll() {
    hookQuantum();
    hookStack();
    hookBeats();
    hookStaff();
    hookTensor();
    hookMaze();
    hookSearch();
    hookMesh();
    hookGt();
    hookMarket();
    hookGutter();
    bindInspectMirror();
  }

  function report() {
    var h = [];
    for (var k in hooks) if (hooks[k]) h.push(k);
    return (
      VER +
      " hooks=[" +
      h.join(",") +
      "] gate=" +
      stats.gate +
      " cell=" +
      stats.cell +
      " note=" +
      stats.note +
      " traj=" +
      stats.traj +
      " chat=" +
      stats.chat +
      " go=" +
      stats.go +
      " mesh=" +
      stats.mesh +
      " gt=" +
      stats.gt +
      " gutter=" +
      stats.gutter
    );
  }

  function selfTest() {
    var results = [];
    results.push({ name: "bus", ok: !!bus() });
    results.push({ name: "dac", ok: !!dac() });
    results.push({
      name: "router",
      ok: !!(window.__mgQbitRouter && window.__mgQbitRouter.bindBus),
    });
    installMocks();
    installAll();
    /* synthetic publishes — search/mesh/gutter shapes (no DOM) */
    var e1 = pub({
      src: "agent",
      kind: "test",
      prefix: "+1:",
      withGlyph: true,
      payload: { adapter: VER },
    });
    results.push({ name: "publish", ok: !!e1 && e1.prefix === "+1:" });
    var eChat = pub({
      src: "search",
      kind: "chat",
      prefix: "+1:",
      withGlyph: true,
      payload: { text: "smoke-chat", via: "selftest" },
    });
    results.push({ name: "search-chat-shape", ok: !!eChat && eChat.src === "search" });
    var eMesh = pub({
      src: "mesh",
      kind: "day-chat",
      prefix: "+1:",
      withGlyph: true,
      payload: { type: "day-chat", text: "smoke-mesh" },
    });
    results.push({ name: "mesh-shape", ok: !!eMesh && eMesh.src === "mesh" });
    var eGut = pub({
      src: "dojo",
      kind: "gutter",
      prefix: "-n:",
      withGlyph: true,
      payload: { bitCount: 16, gutterPreview: "smoke" },
    });
    results.push({ name: "gutter-shape", ok: !!eGut && eGut.kind === "gutter" });
    /* exercise hooks so stats tick */
    try {
      if (window.__mgQuantum) window.__mgQuantum.applyGate({ id: "H" });
      if (window.__mgKeyboardBeats) window.__mgKeyboardBeats.ingestNote(60, { src: "key", hit: true });
      if (window.__mgUgradWebgrid) window.__mgUgradWebgrid.observeCell(3, 30);
      if (window.__mgKbatchDojo) window.__mgKbatchDojo.binaryStreamToGutter("smoke", "1010");
    } catch (eX) {}
    var hookCount = 0;
    for (var hk in hooks) if (hooks[hk]) hookCount++;
    results.push({
      name: "hooks-live",
      ok: hookCount >= 4,
      detail: report(),
    });
    if (dac()) {
      var d = dac().set("hud", 0.42, { src: "selftest", publish: false });
      results.push({ name: "dac-set", ok: d && Math.abs(d.level - 0.42) < 0.001 });
    }
    var ok = results.every(function (r) {
      return r.ok;
    });
    return { ok: ok, results: results, report: report() };
  }

  window.__mgQbitAdapters = {
    ver: VER,
    install: installAll,
    installMocks: installMocks,
    hooks: hooks,
    stats: stats,
    report: report,
    selfTest: selfTest,
    gateToPrefix: gateToPrefix,
    pub: pub,
  };

  /* retry install as modules hot-load */
  setTimeout(installAll, 100);
  setTimeout(installAll, 500);
  setTimeout(installAll, 1500);
  setInterval(installAll, 4000);

  log(VER + " · A–C · D search/mesh · gutter · GT · MKT thin · maze");
})();
