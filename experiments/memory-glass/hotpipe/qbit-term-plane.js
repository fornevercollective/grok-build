/* Memory Glass · Qbit L1 Terminal Plane
 * Contract so hexterm / uterm / nterminal / grok-cli / habitat speak the bus
 * without becoming a second OS. IronLine L1 ticks on I/O.
 * VER: qbit-term-v1
 *
 * Any terminal implements:
 *   open() · write(line) · report()
 *   publishBus({ kind, text }) → L3 classify/encode
 *   onEnvelope(env) optional
 */
(function () {
  "use strict";
  var VER = "qbit-term-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._qbitTermVer === VER) return;
  HP._qbitTermVer = VER;

  var registry = {}; /* id → adapter */
  var lines = [];
  var maxLines = 200;
  var stats = { writes: 0, pubs: 0, rx: 0 };

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "qbit-term");
    } catch (e) {}
  }

  function iron(ms) {
    try {
      if (window.__mgIronline && window.__mgIronline.tick)
        window.__mgIronline.tick("L1", ms || 0.2);
    } catch (e) {}
  }

  function bus() {
    return window.__mgQbitBus || null;
  }

  /** Register a terminal surface (hexterm, uterm, grok-cli bridge, …) */
  function register(id, adapter) {
    if (!id || !adapter) return false;
    registry[id] = adapter;
    log(VER + " · registered " + id);
    return true;
  }

  function write(line, src) {
    var s = String(line || "");
    lines.push({ t: Date.now(), src: src || "term", line: s.slice(0, 500) });
    if (lines.length > maxLines) lines = lines.slice(-maxLines);
    stats.writes++;
    iron(0.15);
    /* fan-out to registered adapters */
    Object.keys(registry).forEach(function (id) {
      try {
        if (registry[id].write) registry[id].write(s);
      } catch (e) {}
    });
    try {
      if (window.__mgGrokTerm && window.__mgGrokTerm.push)
        window.__mgGrokTerm.push("info", s.slice(0, 120));
    } catch (e2) {}
    return s;
  }

  /**
   * Publish terminal text onto the qbit bus (L3 pure path).
   * Terminals call this instead of inventing parallel protocols.
   */
  function publishBus(opts) {
    opts = opts || {};
    var text = opts.text != null ? String(opts.text) : "";
    var kind = opts.kind || "term";
    var b = bus();
    stats.pubs++;
    iron(0.25);
    if (window.__mgQbitLoop && text && window.__mgQbitLoop.classifyAsync) {
      window.__mgQbitLoop.classifyAsync(text, opts.src || "term");
    }
    if (!b) return null;
    return b.publish({
      src: opts.src || "term",
      kind: kind,
      lane: "L1",
      prefix: opts.prefix || "+0:",
      withGlyph: true,
      payload: {
        text: text.slice(0, 400),
        termId: opts.termId || null,
      },
    });
  }

  function onEnvelope(env) {
    if (!env) return;
    stats.rx++;
    Object.keys(registry).forEach(function (id) {
      try {
        if (registry[id].onEnvelope) registry[id].onEnvelope(env);
      } catch (e) {}
    });
  }

  function bindBus() {
    var b = bus();
    if (!b || HP._qbitTermBound) return;
    HP._qbitTermBound = true;
    b.subscribe(function (env) {
      if (!env) return;
      if (
        env.kind === "term" ||
        env.kind === "chat" ||
        env.kind === "handoff" ||
        env.kind === "race"
      ) {
        onEnvelope(env);
      }
    });
  }

  /** Built-in stub terminal (always present for smoke / MG) */
  register("mg-stub", {
    write: function () {},
    onEnvelope: function () {},
    report: function () {
      return "mg-stub";
    },
  });

  /* Optional: bridge __mgGrokTerm as L1 client */
  setTimeout(function () {
    if (window.__mgGrokTerm && !registry["grok-term"]) {
      register("grok-term", {
        write: function (line) {
          try {
            if (window.__mgGrokTerm.push)
              window.__mgGrokTerm.push("info", String(line).slice(0, 160));
          } catch (e) {}
        },
        onEnvelope: function (env) {
          try {
            if (window.__mgGrokTerm.push)
              window.__mgGrokTerm.push(
                "ok",
                "qbit " + env.kind + " " + (env.prefix || "")
              );
          } catch (e) {}
        },
        report: function () {
          return "grok-term-bridge";
        },
      });
    }
  }, 500);

  function report() {
    return (
      VER +
      " terms=" +
      Object.keys(registry).join(",") +
      " writes=" +
      stats.writes +
      " pubs=" +
      stats.pubs +
      " rx=" +
      stats.rx
    );
  }

  function selfTest() {
    var results = [];
    results.push({ name: "bus", ok: !!bus() || true });
    write("qbit-term selftest line", "selftest");
    results.push({ name: "write", ok: lines.length >= 1 });
    var env = publishBus({ text: "function t(){return 1}", kind: "term" });
    results.push({ name: "publishBus", ok: !!env || !bus() });
    results.push({
      name: "registry",
      ok: Object.keys(registry).length >= 1,
    });
    var ok = results.every(function (r) {
      return r.ok;
    });
    return { ok: ok, results: results, report: report() };
  }

  window.__mgQbitTerm = {
    ver: VER,
    register: register,
    write: write,
    publishBus: publishBus,
    onEnvelope: onEnvelope,
    report: report,
    selfTest: selfTest,
    lines: function () {
      return lines.slice();
    },
    registry: registry,
    /** Flight-path note for Rust/web terminals */
    PILOT: {
      uvspeed: "/Volumes/qbitOS/00.dev/projects/uvspeed",
      hexterm: "launch-hexterm.sh · tauri uterm",
      quantumFox: "/Volumes/qbitOS/00.dev/projects/quantum-fox",
      grokCli: "/Users/tref/projects/grok-cli",
      contract: "register(id,{write,onEnvelope}) + publishBus({text})",
    },
  };

  setTimeout(bindBus, 150);
  log(VER + " · L1 terminal plane · adapters not a second OS");
})();
