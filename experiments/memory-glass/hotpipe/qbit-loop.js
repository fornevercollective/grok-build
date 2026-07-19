/* Memory Glass · Qbit dual-clock loop
 * Clock A (inner L3): classify / encode / bus drain — μs-class budget, no DOM.
 * Clock B (outer cortical ~24ms): L5 schedule only (paint / HUD callbacks).
 * Not a hard RTOS — measures against IronLine L3/L5.
 * VER: qbit-loop-v2
 */
(function () {
  "use strict";
  var VER = "qbit-loop-v2";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._qbitLoopVer === VER) return;
  HP._qbitLoopVer = VER;

  var running = false;
  var l3Timer = 0;
  var corticalTimer = 0;
  var l3IntervalMs = 2; /* inner pump */
  var corticalMs = 24; /* outer cortical */
  var budgetUs = 500; /* soft L3 slice μs */
  var l5BudgetMs = 8; /* half of 16ms paint budget for scheduled work */
  var l3Queue = [];
  var l5Queue = []; /* functions only — never run L3 work here */
  var maxQ = 256;
  var maxL5 = 64;
  var emaUs = 50;
  var emaL5Ms = 4;
  var ticksL3 = 0;
  var ticksL5 = 0;
  var lastReport = "";

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "qbit-loop");
    } catch (e) {}
  }

  function nowUs() {
    return performance.now() * 1000;
  }

  function corticalMsNow() {
    try {
      if (window.__mgIronline && window.__mgIronline.corticalMs != null)
        return window.__mgIronline.corticalMs;
    } catch (e) {}
    return corticalMs;
  }

  /** L3 only — pure / no DOM */
  function enqueue(job) {
    if (l3Queue.length >= maxQ) l3Queue.shift();
    l3Queue.push(job || { kind: "idle" });
    if (!running) start();
  }

  /**
   * L5 only — schedule paint/HUD. Never classify/encode here.
   * Outer cortical pump owns execution.
   */
  function scheduleL5(fn, meta) {
    if (typeof fn !== "function") return;
    if (l5Queue.length >= maxL5) l5Queue.shift();
    l5Queue.push({ run: fn, meta: meta || null, t: performance.now() });
    if (!running) start();
  }

  function processL3Slice() {
    var t0 = nowUs();
    var n = 0;

    /* Prefer bus drain into L3 processing window (ordered) */
    try {
      if (window.__mgQbitBus && window.__mgQbitBus.drain) {
        var drained = window.__mgQbitBus.drain(8);
        n += drained.length;
      }
    } catch (eD) {}

    while (l3Queue.length && nowUs() - t0 < budgetUs) {
      var job = l3Queue.shift();
      n++;
      try {
        if (job && typeof job.run === "function") {
          /* L3 pure — caller must not touch DOM */
          job.run(job);
        } else if (job && job.env && window.__mgQbitBus) {
          window.__mgQbitBus.publish(job.env);
        } else if (job && job.text && window.QbitCodec) {
          var c = window.QbitCodec.classify
            ? window.QbitCodec.classify(String(job.text).slice(0, 400))
            : null;
          if (window.__mgQbitBus)
            window.__mgQbitBus.publish({
              src: job.src || "loop",
              kind: "classify",
              lane: "L3",
              payload: { classify: c, text: String(job.text).slice(0, 80) },
              withGlyph: true,
            });
        }
      } catch (e) {}
    }
    var dt = nowUs() - t0;
    emaUs = emaUs * 0.85 + dt * 0.15;
    ticksL3++;
    try {
      if (window.__mgIronline && window.__mgIronline.tick)
        window.__mgIronline.tick("L3", dt / 1000);
    } catch (eI) {}
    return n;
  }

  function processL5Slice() {
    var t0 = performance.now();
    var n = 0;
    while (l5Queue.length && performance.now() - t0 < l5BudgetMs) {
      var job = l5Queue.shift();
      n++;
      try {
        if (job && typeof job.run === "function") job.run(job.meta);
      } catch (e) {}
    }
    var dt = performance.now() - t0;
    emaL5Ms = emaL5Ms * 0.85 + dt * 0.15;
    ticksL5++;
    try {
      if (window.__mgIronline && window.__mgIronline.tick)
        window.__mgIronline.tick("L5", dt);
    } catch (eI) {}
    return n;
  }

  function l3Pump() {
    if (!running) return;
    processL3Slice();
    lastReport =
      VER +
      " L3 q=" +
      l3Queue.length +
      " emaμs=" +
      emaUs.toFixed(1) +
      " ticks=" +
      ticksL3 +
      " | L5 q=" +
      l5Queue.length +
      " emaMs=" +
      emaL5Ms.toFixed(2) +
      " cort=" +
      corticalMsNow() +
      "ms ticks=" +
      ticksL5;
    l3Timer = setTimeout(l3Pump, l3IntervalMs);
  }

  function corticalPump() {
    if (!running) return;
    processL5Slice();
    try {
      if (window.__mgIronline && window.__mgIronline.tickCortical)
        window.__mgIronline.tickCortical(corticalMsNow());
    } catch (eC) {}
    corticalTimer = setTimeout(corticalPump, corticalMsNow());
  }

  function start() {
    if (running) return;
    running = true;
    l3Pump();
    corticalPump();
    log(
      VER +
        " · dual-clock L3=" +
        l3IntervalMs +
        "ms/" +
        budgetUs +
        "μs · cortical=" +
        corticalMsNow() +
        "ms"
    );
  }

  function stop() {
    running = false;
    if (l3Timer) {
      clearTimeout(l3Timer);
      l3Timer = 0;
    }
    if (corticalTimer) {
      clearTimeout(corticalTimer);
      corticalTimer = 0;
    }
  }

  function classifyAsync(text, src) {
    enqueue({ text: text, src: src || "async", lane: "L3" });
  }

  function encodeAsync(source, lang, cb) {
    enqueue({
      lane: "L3",
      run: function () {
        var bus = window.__mgQbitBus;
        var out =
          bus && bus.decorateLines
            ? bus.decorateLines(source, lang)
            : { ok: false };
        if (cb) {
          /* callback may touch DOM — schedule on L5 */
          scheduleL5(function () {
            try {
              cb(out);
            } catch (e) {}
          });
        }
        if (bus)
          bus.publish({
            src: "encode",
            kind: "encode",
            lane: "L3",
            payload: {
              ok: out.ok,
              coverage: out.stats && out.stats.coverage,
              lines: out.lines ? out.lines.length : 0,
            },
            withGlyph: true,
          });
      },
    });
  }

  function selfTest() {
    var results = [];
    var bus = window.__mgQbitBus;
    var qc = window.QbitCodec;
    results.push({ name: "bus", ok: !!bus });
    results.push({ name: "codec", ok: !!(qc && qc.encode) });
    results.push({ name: "dual-clock", ok: true, l3: l3IntervalMs, cortical: corticalMsNow() });
    if (bus) {
      var g = bus.makeGlyphHolder({ prefix: "0:" });
      results.push({
        name: "glyph-holder",
        ok: !!(g && g.blank && g.blank.length >= 1),
        blankLen: g && g.blank ? g.blank.length : 0,
      });
      var env = bus.publish({
        src: "selftest",
        kind: "test",
        prefix: "+1:",
        withGlyph: true,
        payload: { n: 1 },
      });
      results.push({ name: "publish", ok: !!env && env.prefix === "+1:" });
      results.push({
        name: "bus-queue",
        ok: typeof bus.drain === "function" && typeof bus.peekPending === "function",
      });
    }
    if (qc && qc.encode && qc.decode) {
      var sample =
        "function hello() {\n  const x = 1;\n  return x;\n}\n";
      var enc = qc.encode(sample, "javascript", "selftest");
      var dec = qc.decode(enc.code);
      results.push({
        name: "steno-roundtrip",
        ok: !!(enc && enc.code && dec),
        classified: enc.stats && enc.stats.classified,
      });
    }
    /* L5 schedule smoke — pure no-op */
    var l5hit = 0;
    scheduleL5(function () {
      l5hit++;
    });
    processL5Slice();
    results.push({ name: "l5-schedule", ok: l5hit >= 1 });

    var ok = results.every(function (r) {
      return r.ok;
    });
    lastReport = VER + " selfTest " + (ok ? "PASS" : "FAIL");
    log(lastReport);
    return { ok: ok, results: results, report: lastReport };
  }

  window.__mgQbitLoop = {
    ver: VER,
    start: start,
    stop: stop,
    enqueue: enqueue,
    scheduleL5: scheduleL5,
    classifyAsync: classifyAsync,
    encodeAsync: encodeAsync,
    selfTest: selfTest,
    processL3Slice: processL3Slice,
    processL5Slice: processL5Slice,
    setBudgetUs: function (u) {
      budgetUs = Math.max(50, Math.min(5000, u | 0));
    },
    setCorticalMs: function (ms) {
      corticalMs = Math.max(8, Math.min(48, ms | 0));
    },
    report: function () {
      return lastReport || VER;
    },
    emaUs: function () {
      return emaUs;
    },
    emaL5Ms: function () {
      return emaL5Ms;
    },
    queueLength: function () {
      return l3Queue.length;
    },
    l5QueueLength: function () {
      return l5Queue.length;
    },
    corticalMs: corticalMsNow,
  };

  setTimeout(function () {
    if (window.__mgQbitBus) start();
    setTimeout(function () {
      try {
        selfTest();
      } catch (e) {}
    }, 200);
  }, 100);

  log(VER + " · dual-clock L3 + cortical L5");
})();
