/* Memory Glass · Qbit Bus
 * Single envelope route for prefixes · steno glyph holders · IronLine · tensor/gutter.
 * Ordered queue + backpressure (not fire-and-forget unbounded).
 * Prefix alphabet: n: +1: -n: +0: 0: -1: +n: +2: -0: +3: 1:
 * VER: qbit-bus-v2
 */
(function () {
  "use strict";
  var VER = "qbit-bus-v2";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._qbitBusVer === VER) return;
  HP._qbitBusVer = VER;

  var PREFIXES = [
    "n:",
    "+1:",
    "-n:",
    "+0:",
    "0:",
    "-1:",
    "+n:",
    "+2:",
    "-0:",
    "+3:",
    "1:",
  ];
  var PREFIX_ALIAS = {
    "+1": "+1:",
    "-1": "-1:",
    "+0": "+0:",
    "0": "0:",
    "-0": "-0:",
    "+n": "+n:",
    "-n": "-n:",
    "+2": "+2:",
    "+3": "+3:",
    n: "n:",
    "1": "1:",
    "+11": "+1:",
    "00": "0:",
    nn: "+n:",
  };

  /* High-rate kinds dropped first under backpressure */
  var DROP_FIRST = {
    traj: 1,
    cell: 1,
    dac: 1,
    note: 1,
    presence: 1,
  };

  var subs = {}; /* kind → [fn] */
  var allSubs = [];
  var seq = 0;
  var maxQ = 512;
  var pending = []; /* ordered by seq — audit / drain / backpressure window */
  var lastEnv = null;
  var draining = false;
  var stats = {
    published: 0,
    delivered: 0,
    dropped: 0,
    backpressure: 0,
    sinked: 0,
    lastTμ: 0,
    byKind: {},
    queueHigh: 0,
  };

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "qbit-bus");
    } catch (e) {}
  }

  function nowμ() {
    try {
      return Math.round(performance.now() * 1000);
    } catch (e) {
      return Date.now() * 1000;
    }
  }

  function QC() {
    return window.QbitCodec || null;
  }

  function normalizePrefix(p) {
    if (p == null || p === "") return null;
    var s = String(p);
    if (PREFIXES.indexOf(s) >= 0) return s;
    if (PREFIX_ALIAS[s] != null) return PREFIX_ALIAS[s];
    if (PREFIX_ALIAS[s.replace(":", "")] != null)
      return PREFIX_ALIAS[s.replace(":", "")];
    return s.indexOf(":") >= 0 ? s : s + ":";
  }

  function makeGlyphHolder(opts) {
    opts = opts || {};
    var qc = QC();
    var symIdx = opts.symIdx != null ? opts.symIdx : 4;
    var gateIdx = opts.gateIdx != null ? opts.gateIdx : symIdx;
    var depth = opts.depth != null ? opts.depth : 0;
    var layer = opts.layer != null ? opts.layer : symIdx % 8;
    var catIdx = opts.catIdx != null ? opts.catIdx : symIdx;
    if (opts.prefix) {
      var p = normalizePrefix(opts.prefix);
      var ix = PREFIXES.indexOf(p);
      if (ix >= 0) {
        symIdx = ix;
        if (opts.gateIdx == null) gateIdx = ix;
        if (opts.catIdx == null) catIdx = ix;
      }
    }
    var steno = null;
    if (qc && typeof qc.encodeRecord === "function") {
      try {
        steno = qc.encodeRecord(symIdx, gateIdx, depth, layer, catIdx);
      } catch (e) {}
    }
    if (!steno) steno = "\u200A\u2009\u2008\u2007\u2006";
    return {
      kind: "glyph-holder",
      blank: steno,
      visible: " ",
      capacity: "5-field steno record > plain space",
      fields: {
        symIdx: symIdx,
        prefix: PREFIXES[symIdx] || null,
        gateIdx: gateIdx,
        depth: depth,
        layer: layer,
        catIdx: catIdx,
      },
      decode: function () {
        return decodeGlyphHolder(steno);
      },
    };
  }

  function decodeGlyphHolder(blank) {
    var qc = QC();
    if (!blank) return null;
    if (qc && typeof qc.decodeRecord === "function") {
      try {
        var r = qc.decodeRecord(String(blank).slice(0, 5));
        r.prefix = PREFIXES[r.symIdx] || null;
        return r;
      } catch (e) {}
    }
    return { raw: blank, note: "QbitCodec.decodeRecord unavailable" };
  }

  function decorateLines(source, lang) {
    var qc = QC();
    if (!qc || !qc.encode) {
      return {
        ok: false,
        reason: "QbitCodec missing",
        lines: String(source || "").split("\n"),
      };
    }
    var enc = qc.encode(String(source || ""), lang || null, "mg-qbit-bus");
    return {
      ok: true,
      code: enc.code,
      stats: enc.stats,
      lines: (enc.code || "").split("\n"),
      note: "each classified line carries steno glyph holder (blank > empty)",
    };
  }

  function qcGate(prefix) {
    var qc = QC();
    if (qc && qc.GATE_MAP && qc.GATE_MAP[prefix]) return qc.GATE_MAP[prefix];
    var i = PREFIXES.indexOf(prefix);
    var gates = [
      "SWAP",
      "H",
      "M",
      "Rz",
      "I",
      "X",
      "T",
      "CZ",
      "S",
      "Y",
      "CNOT",
    ];
    return i >= 0 ? gates[i] : null;
  }

  function envelope(partial) {
    partial = partial || {};
    var tμ = partial.tμ != null ? partial.tμ : nowμ();
    var prefix = normalizePrefix(partial.prefix);
    var env = {
      v: 1,
      id: partial.id || "qb-" + ++seq + "-" + tμ,
      seq: seq,
      tμ: tμ,
      lane: partial.lane || "L3",
      prefix: prefix,
      gate: partial.gate || null,
      src: partial.src || "anon",
      kind: partial.kind || "event",
      payload: partial.payload != null ? partial.payload : {},
      steno: partial.steno || null,
      glyph: partial.glyph || null,
      dac: partial.dac || null,
      fleet: partial.fleet || null,
    };
    if (!env.gate && prefix && qcGate(prefix)) env.gate = qcGate(prefix);
    if (!env.glyph && (partial.holdBlank || partial.withGlyph)) {
      env.glyph = makeGlyphHolder({ prefix: prefix || "0:" });
      if (!env.steno && env.glyph.blank) env.steno = env.glyph.blank;
    }
    return env;
  }

  /** Drop oldest high-rate kind first; else oldest overall. Preserves order of survivors. */
  function backpressureDropOne() {
    var i;
    for (i = 0; i < pending.length; i++) {
      if (DROP_FIRST[pending[i].kind]) {
        pending.splice(i, 1);
        stats.backpressure++;
        stats.dropped++;
        return true;
      }
    }
    if (pending.length) {
      pending.shift();
      stats.backpressure++;
      stats.dropped++;
      return true;
    }
    return false;
  }

  function deliver(env) {
    var list = (subs[env.kind] || []).concat(allSubs);
    if (!list.length) {
      /* should be rare — default sink always registered */
      stats.dropped++;
      return 0;
    }
    var n = 0;
    var t0 = performance.now();
    for (var i = 0; i < list.length; i++) {
      try {
        list[i](env);
        stats.delivered++;
        n++;
      } catch (e) {
        stats.dropped++;
      }
    }
    try {
      if (window.__mgIronline && window.__mgIronline.tick) {
        window.__mgIronline.tick(
          env.lane || "L3",
          Math.max(0.01, performance.now() - t0)
        );
      }
    } catch (eI) {}
    return n;
  }

  /**
   * Publish envelope: ordered pending window + ordered delivery.
   * Backpressure trims high-rate kinds when maxQ exceeded.
   */
  function publish(partial) {
    var env = envelope(partial);
    stats.published++;
    stats.lastTμ = env.tμ;
    stats.byKind[env.kind] = (stats.byKind[env.kind] || 0) + 1;
    lastEnv = env;

    while (pending.length >= maxQ) {
      if (!backpressureDropOne()) break;
    }
    pending.push(env);
    if (pending.length > stats.queueHigh) stats.queueHigh = pending.length;

    /* Keep a sliding audit window — do not grow forever */
    if (pending.length > maxQ) {
      pending = pending.slice(-maxQ);
    }

    deliver(env);
    return env;
  }

  /**
   * Drain pending in seq order for L3 consumers (loop / batch).
   * Does not re-deliver to subscribers — returns envelopes for processing.
   */
  function drain(maxN) {
    maxN = maxN == null ? 32 : Math.max(1, maxN | 0);
    var out = [];
    while (out.length < maxN && pending.length) {
      out.push(pending.shift());
    }
    return out;
  }

  function peekPending() {
    return pending.length;
  }

  function subscribe(kind, fn) {
    if (typeof kind === "function") {
      allSubs.push(kind);
      return function () {
        allSubs = allSubs.filter(function (f) {
          return f !== kind;
        });
      };
    }
    if (!subs[kind]) subs[kind] = [];
    subs[kind].push(fn);
    return function () {
      subs[kind] = (subs[kind] || []).filter(function (f) {
        return f !== fn;
      });
    };
  }

  /* Always-on sink — bus never "nobody listening" for accounting */
  subscribe(function (env) {
    stats.sinked++;
    lastEnv = env;
  });

  function report() {
    return (
      VER +
      " pub=" +
      stats.published +
      " del=" +
      stats.delivered +
      " drop=" +
      stats.dropped +
      " bp=" +
      stats.backpressure +
      " q=" +
      pending.length +
      " sink=" +
      stats.sinked +
      " codec=" +
      !!(QC() && QC().encode)
    );
  }

  window.__mgQbitBus = {
    ver: VER,
    PREFIXES: PREFIXES,
    PREFIX_ALIAS: PREFIX_ALIAS,
    envelope: envelope,
    publish: publish,
    subscribe: subscribe,
    drain: drain,
    peekPending: peekPending,
    makeGlyphHolder: makeGlyphHolder,
    decodeGlyphHolder: decodeGlyphHolder,
    decorateLines: decorateLines,
    normalizePrefix: normalizePrefix,
    stats: stats,
    report: report,
    nowμ: nowμ,
    last: function () {
      return lastEnv;
    },
    setMaxQ: function (n) {
      maxQ = Math.max(32, Math.min(4096, n | 0));
    },
  };

  log(VER + " · ordered queue + backpressure · prefixes " + PREFIXES.join(" "));
})();
