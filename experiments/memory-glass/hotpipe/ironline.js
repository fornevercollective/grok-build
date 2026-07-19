/* Memory Glass · Iron Line L0–L7 + cortical loop budgets (speed-first)
 * Inject after hurdles. No PAGE thrash. Inspect + main both OK (main is lightweight).
 * Dual-clock: L3 from __mgQbitLoop inner · L5/cortical from outer 24ms pump.
 * Concepts: plans/IRONLINE_CORTICAL.md · μgrad ironline · qbit codec
 */
(function () {
  "use strict";
  var VER = "ironline-v2";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._ironlineVer === VER) return;
  HP._ironlineVer = VER;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "info", String(m || ""), "ironline");
    } catch (e) {}
  }

  var LAYERS = [
    { id: "L0", name: "speed", budgetMs: 1.5, ch: "hexterm" },
    { id: "L1", name: "search", budgetMs: 270, ch: "iron-line" },
    { id: "L2", name: "commander", budgetMs: 100, ch: "agent" },
    { id: "L3", name: "quantum", budgetMs: 0.05, ch: "qbit" },
    { id: "L4", name: "notepad", budgetMs: 2, ch: "packs" },
    { id: "L5", name: "render", budgetMs: 16, ch: "hud" },
    { id: "L6", name: "research", budgetMs: 5, ch: "r1" },
    { id: "L7", name: "persona", budgetMs: 5, ch: "voice" },
  ];

  var state = {
    ver: VER,
    corticalMs: 24,
    corticalTicks: 0,
    lastCorticalAt: 0,
    samples: {},
    ema: {},
    ok: {},
    qbitReady: false,
    lastReport: "",
    lastQbit: null,
  };

  LAYERS.forEach(function (L) {
    state.samples[L.id] = 0;
    state.ema[L.id] = L.budgetMs * 0.5;
    state.ok[L.id] = true;
  });

  function tick(layerId, ms) {
    if (!state.ema[layerId] && state.ema[layerId] !== 0) return;
    var m = +ms || 0;
    state.samples[layerId]++;
    state.ema[layerId] = state.ema[layerId] * 0.85 + m * 0.15;
    var L = LAYERS.filter(function (x) {
      return x.id === layerId;
    })[0];
    if (L) state.ok[layerId] = state.ema[layerId] <= L.budgetMs * 1.35;
  }

  function budgetOk(layerId) {
    return !!state.ok[layerId];
  }

  /** Called by __mgQbitLoop cortical pump (~24ms). Outer clock owns L5 schedule. */
  function tickCortical(ms) {
    var m = ms != null ? +ms : state.corticalMs;
    state.corticalTicks++;
    state.lastCorticalAt = Date.now();
    /* soft L0 sample for pump overhead */
    tick("L0", Math.min(1.5, m * 0.02));
    return state.corticalTicks;
  }

  function report() {
    var parts = LAYERS.map(function (L) {
      var ema = state.ema[L.id];
      var flag = state.ok[L.id] ? "✓" : "!";
      return L.id + flag + ema.toFixed(ema < 1 ? 2 : 1);
    });
    state.lastReport =
      "iron " +
      parts.join(" · ") +
      " · cort" +
      state.corticalMs +
      "ms" +
      " n=" +
      state.corticalTicks;
    return state.lastReport;
  }

  /* Soft hooks: H6 frame budget → L5 */
  var prevH = window.__mgHurdles;
  function pollH6() {
    try {
      var h = window.__mgHurdles;
      if (h && h.h6 && h.h6.emaMs != null) tick("L5", h.h6.emaMs);
    } catch (e) {}
    setTimeout(pollH6, 500);
  }
  pollH6();

  /* Prefetch age → L1 proxy */
  setInterval(function () {
    try {
      var a = window.__mgPrefetchMeta && window.__mgPrefetchMeta.ageMs;
      if (a != null) tick("L1", Math.min(500, a * 0.05));
    } catch (e) {}
  }, 2000);

  /* Optional qbit codec if already on window (not auto-fetched — keep cold start light) */
  function bindQbit() {
    state.qbitReady = !!(window.QbitCodec || (window.QbitCodec && window.QbitCodec.encode));
    return state.qbitReady;
  }
  bindQbit();

  function classifyShort(text) {
    var t0 = performance.now();
    var out = { n: (text || "").length, prefixes: [] };
    try {
      if (window.QbitCodec && typeof window.QbitCodec.classify === "function") {
        out = window.QbitCodec.classify(String(text || "").slice(0, 400));
      } else {
        /* lightweight prefix scan without full codec */
        var re = /(n:|\+1:|-n:|\+0:|0:|-1:|\+n:|\+2:|-0:|\+3:|1:)/g;
        var m;
        while ((m = re.exec(String(text || ""))) && out.prefixes.length < 12) {
          out.prefixes.push(m[1]);
        }
      }
    } catch (e) {}
    tick("L3", performance.now() - t0);
    return out;
  }

  window.__mgIronline = {
    ver: VER,
    layers: LAYERS,
    state: state,
    tick: tick,
    tickCortical: tickCortical,
    budgetOk: budgetOk,
    report: report,
    classify: classifyShort,
    bindQbit: bindQbit,
    corticalMs: state.corticalMs,
  };

  log("ok", "ironline-v2 · L0–L7 · dual-clock cortical " + state.corticalMs + "ms");
})();
