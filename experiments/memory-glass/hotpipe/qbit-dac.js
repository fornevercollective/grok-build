/* Memory Glass · Qbit DAC (digital abstraction channel)
 * Soft multi-channel intensity bus for drop α · maze rain · staff velocity · HUD —
 * not a hardware DAC. Levels 0–1, N channels. Subscribes optional; surfaces set().
 * VER: qbit-dac-v1
 */
(function () {
  "use strict";
  var VER = "qbit-dac-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._qbitDacVer === VER) return;
  HP._qbitDacVer = VER;

  var N = 8;
  var levels = [];
  var names = [
    "drop",
    "maze",
    "staff",
    "webgrid",
    "hud",
    "audio",
    "agent",
    "spare",
  ];
  var ema = [];
  var listeners = [];
  var lastTμ = 0;

  for (var i = 0; i < N; i++) {
    levels[i] = 0;
    ema[i] = 0;
  }

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "qbit-dac");
    } catch (e) {}
  }

  function nowμ() {
    try {
      return Math.round(performance.now() * 1000);
    } catch (e) {
      return Date.now() * 1000;
    }
  }

  function clamp01(x) {
    x = +x;
    if (!isFinite(x)) return 0;
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }

  function chIndex(ch) {
    if (typeof ch === "string") {
      var ix = names.indexOf(ch);
      if (ix >= 0) return ix;
      var n = parseInt(ch, 10);
      return isFinite(n) ? Math.max(0, Math.min(N - 1, n)) : 0;
    }
    return Math.max(0, Math.min(N - 1, ch | 0));
  }

  function set(ch, level, opts) {
    opts = opts || {};
    var i = chIndex(ch);
    var v = clamp01(level);
    levels[i] = v;
    var a = opts.ema != null ? +opts.ema : 0.25;
    ema[i] = ema[i] * (1 - a) + v * a;
    lastTμ = nowμ();
    if (opts.publish !== false && window.__mgQbitBus) {
      try {
        window.__mgQbitBus.publish({
          src: opts.src || "dac",
          kind: "dac",
          lane: "L0",
          dac: { ch: i, name: names[i], level: v, ema: ema[i] },
          payload: { ch: i, level: v },
        });
      } catch (eP) {}
    }
    for (var L = 0; L < listeners.length; L++) {
      try {
        listeners[L](i, v, ema[i]);
      } catch (eL) {}
    }
    return { ch: i, level: v, ema: ema[i] };
  }

  function get(ch) {
    var i = chIndex(ch);
    return { ch: i, name: names[i], level: levels[i], ema: ema[i] };
  }

  function pulse(ch, peak, decayMs) {
    peak = peak == null ? 1 : clamp01(peak);
    decayMs = decayMs == null ? 180 : Math.max(20, decayMs | 0);
    set(ch, peak, { src: "dac-pulse" });
    var i = chIndex(ch);
    setTimeout(function () {
      set(i, levels[i] * 0.15, { src: "dac-decay", publish: false });
    }, decayMs);
  }

  /** Map UI intensity hints → named channels */
  function fromHints(h) {
    h = h || {};
    if (h.drop != null) set("drop", h.drop, { src: "hint", publish: false });
    if (h.maze != null) set("maze", h.maze, { src: "hint", publish: false });
    if (h.staff != null) set("staff", h.staff, { src: "hint", publish: false });
    if (h.webgrid != null)
      set("webgrid", h.webgrid, { src: "hint", publish: false });
    if (h.hud != null) set("hud", h.hud, { src: "hint", publish: false });
    if (h.audio != null) set("audio", h.audio, { src: "hint", publish: false });
    return snapshot();
  }

  function snapshot() {
    return {
      ver: VER,
      n: N,
      names: names.slice(),
      levels: levels.slice(),
      ema: ema.slice(),
      lastTμ: lastTμ,
    };
  }

  function onChange(fn) {
    if (typeof fn !== "function") return function () {};
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) {
        return f !== fn;
      });
    };
  }

  function report() {
    var parts = [];
    for (var i = 0; i < N; i++) {
      if (levels[i] > 0.02 || ema[i] > 0.02)
        parts.push(names[i] + "=" + ema[i].toFixed(2));
    }
    return VER + (parts.length ? " " + parts.join(" ") : " idle");
  }

  window.__mgQbitDac = {
    ver: VER,
    N: N,
    names: names,
    set: set,
    get: get,
    pulse: pulse,
    fromHints: fromHints,
    snapshot: snapshot,
    onChange: onChange,
    report: report,
    levels: levels,
    ema: ema,
  };

  log(VER + " · " + N + "ch " + names.join(","));
})();
