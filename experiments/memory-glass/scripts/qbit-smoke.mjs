#!/usr/bin/env node
/**
 * Agent F · Qbit spine smoke (Node, no browser)
 * Loads full spine + mock surfaces so adapters hooks are non-empty.
 *
 * Usage: node scripts/qbit-smoke.mjs
 * Exit 0 = PASS
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import { BroadcastChannel as NodeBC } from "worker_threads";
if (typeof globalThis.BroadcastChannel === "undefined") {
  globalThis.BroadcastChannel = NodeBC;
}


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOT = path.resolve(__dirname, "../hotpipe");

function load(name) {
  const p = path.join(HOT, name);
  if (!fs.existsSync(p)) throw new Error("missing " + p);
  return fs.readFileSync(p, "utf8");
}

const logs = [];
const window = {
  BroadcastChannel: globalThis.BroadcastChannel,
  __mgHotPipe: {},
  __mgDevLog: function (lvl, m, src) {
    logs.push([lvl, src, m].join(" "));
  },
  performance: {
    now: function () {
      return Number(process.hrtime.bigint()) / 1e6;
    },
  },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  TextEncoder: globalThis.TextEncoder,
  localStorage: {
    _d: {},
    setItem(k, v) {
      this._d[k] = String(v);
    },
    getItem(k) {
      return this._d[k] || null;
    },
  },
};
window.window = window;
const sandbox = {
  window,
  BroadcastChannel: globalThis.BroadcastChannel,
  console,
  performance: window.performance,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  TextEncoder: globalThis.TextEncoder,
};
vm.createContext(sandbox);

const files = [
  "ironline.js",
  "qbit-codec.js",
  "qbit-bus.js",
  "qbit-loop.js",
  "qbit-dac.js",
  "qbit-router.js",
  "qbit-adapters.js",
  "qbit-native-bridge.js",
  "qbit-truss.js",
  "qbit-term-plane.js",
  "mg-agent-desk.js",
  "qbit-race-sitrep.js",
  "qbit-l1-pilot.js",
];

for (const f of files) {
  vm.runInContext(load(f), sandbox, { filename: f });
}

const W = sandbox.window;
const results = [];

function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || "" });
}

check("QbitCodec", !!(W.QbitCodec && W.QbitCodec.encode));
check("__mgQbitBus", !!W.__mgQbitBus);
check("__mgQbitLoop", !!W.__mgQbitLoop);
check("__mgQbitDac", !!W.__mgQbitDac);
check("__mgQbitRouter", !!W.__mgQbitRouter);
check("__mgQbitAdapters", !!W.__mgQbitAdapters);
check("__mgIronline", !!W.__mgIronline);

/* alphabet integrity */
const PREFIXES = W.__mgQbitBus && W.__mgQbitBus.PREFIXES;
check(
  "prefixes-11",
  PREFIXES && PREFIXES.length === 11,
  PREFIXES ? PREFIXES.join(" ") : "none"
);

/* bus v2 queue */
check(
  "bus-ordered-queue",
  !!(W.__mgQbitBus && W.__mgQbitBus.drain && W.__mgQbitBus.peekPending),
  W.__mgQbitBus && W.__mgQbitBus.ver
);

/* dual clock */
check(
  "dual-clock",
  !!(
    W.__mgQbitLoop &&
    W.__mgQbitLoop.scheduleL5 &&
    W.__mgQbitLoop.ver &&
    String(W.__mgQbitLoop.ver).indexOf("v2") >= 0
  ),
  W.__mgQbitLoop && W.__mgQbitLoop.ver
);

/* glyph + steno */
if (W.__mgQbitBus) {
  const g = W.__mgQbitBus.makeGlyphHolder({ prefix: "0:", depth: 1, layer: 2 });
  check("glyph-holder", !!(g && g.blank && g.blank.length >= 1), "len=" + (g && g.blank && g.blank.length));
  const env = W.__mgQbitBus.publish({
    src: "smoke",
    kind: "test",
    prefix: "+1:",
    withGlyph: true,
    payload: { n: 1 },
  });
  check("publish-prefix", env && env.prefix === "+1:", env && env.gate);
  /* sink means no orphan drop for zero-subs */
  check(
    "bus-sink",
    W.__mgQbitBus.stats && W.__mgQbitBus.stats.sinked > 0,
    "sinked=" + (W.__mgQbitBus.stats && W.__mgQbitBus.stats.sinked)
  );
}

if (W.QbitCodec && W.QbitCodec.encode && W.QbitCodec.decode) {
  const sample = "function hello() {\n  const x = 1;\n  return x;\n}\n";
  const enc = W.QbitCodec.encode(sample, "javascript", "smoke");
  const dec = W.QbitCodec.decode(enc.code);
  check(
    "steno-roundtrip",
    !!(enc && enc.code && dec),
    "classified=" + (enc.stats && enc.stats.classified)
  );
  if (W.QbitCodec.encodeRecord && W.QbitCodec.decodeRecord) {
    const blank = W.QbitCodec.encodeRecord(4, 4, 1, 2, 4);
    const rec = W.QbitCodec.decodeRecord(blank);
    check("encodeRecord", !!(blank && rec && rec.symIdx === 4), JSON.stringify(rec));
  }
}

if (W.__mgQbitLoop && W.__mgQbitLoop.selfTest) {
  const st = W.__mgQbitLoop.selfTest();
  check("loop-selfTest", st && st.ok, st && st.report);
}

if (W.__mgQbitDac) {
  const d = W.__mgQbitDac.set("hud", 0.5, { publish: false });
  check("dac-set", d && d.level === 0.5, W.__mgQbitDac.report());
}

if (W.__mgQbitRouter) {
  W.__mgQbitRouter.bindBus();
  check(
    "router-defaults",
    !!(W.__mgQbitRouter.installDefaults && W.__mgQbitRouter.report().indexOf("defaults=1") >= 0),
    W.__mgQbitRouter.report()
  );
  let hit = 0;
  W.__mgQbitRouter.on("smoke", "route-test", function () {
    hit++;
  });
  W.__mgQbitBus.publish({ src: "smoke", kind: "route-test", payload: {} });
  check("router-dispatch", hit >= 1, "hit=" + hit);
}

/* gutter envelope */
if (W.__mgQbitBus) {
  const gEnv = W.__mgQbitBus.publish({
    src: "dojo",
    kind: "gutter",
    prefix: "-n:",
    withGlyph: true,
    payload: { bitCount: 32, gutterPreview: "smoke-gutter" },
  });
  check("gutter-envelope", gEnv && gEnv.kind === "gutter", gEnv && gEnv.src);
  if (W.__mgQbitRouter && W.__mgQbitRouter.lastGutter) {
    const lg = W.__mgQbitRouter.lastGutter();
    check("router-gutter", !!(lg && lg.kind === "gutter"), lg && lg.payload && lg.payload.gutterPreview);
  }
}

/* adapters with mocks → hooks non-empty */
if (W.__mgQbitAdapters && W.__mgQbitAdapters.selfTest) {
  const at = W.__mgQbitAdapters.selfTest();
  check("adapters-selfTest", at && at.ok, at && at.report);
  const rep = W.__mgQbitAdapters.report();
  const hooksMatch = /hooks=\[([^\]]*)\]/.exec(rep);
  const hooksList = hooksMatch ? hooksMatch[1].split(",").filter(Boolean) : [];
  check(
    "hooks-nonempty",
    hooksList.length >= 4,
    rep
  );
}

/* backpressure smoke */
if (W.__mgQbitBus && W.__mgQbitBus.setMaxQ) {
  W.__mgQbitBus.setMaxQ(40);
  for (let i = 0; i < 80; i++) {
    W.__mgQbitBus.publish({
      src: "maze",
      kind: "traj",
      payload: { i },
    });
  }
  check(
    "backpressure",
    W.__mgQbitBus.stats.backpressure > 0 || W.__mgQbitBus.peekPending() <= 40,
    "bp=" + W.__mgQbitBus.stats.backpressure + " q=" + W.__mgQbitBus.peekPending()
  );
  W.__mgQbitBus.setMaxQ(512);
}

/* leap: native bridge + truss */
check("__mgQbitNative", !!W.__mgQbitNative, W.__mgQbitNative && W.__mgQbitNative.ver);
check("__mgQbitTruss", !!W.__mgQbitTruss, W.__mgQbitTruss && W.__mgQbitTruss.ver);
if (W.__mgQbitTruss && W.__mgQbitTruss.selfTest) {
  const tt = W.__mgQbitTruss.selfTest();
  check("truss-selfTest", tt && tt.ok, tt && tt.report);
}
if (W.__mgQbitNative) {
  check("native-bridge", typeof W.__mgQbitNative.applyRemote === "function", W.__mgQbitNative.report());
  W.__mgQbitNative.applyRemote({
    src: "ipc",
    kind: "gate",
    prefix: "+1:",
    nativeTμ: 123456789,
    payload: { smoke: true },
    id: "smoke-native-1",
  });
  check(
    "native-apply",
    W.__mgQbitNative.stats.applied >= 1,
    "applied=" + W.__mgQbitNative.stats.applied
  );
}

check("__mgQbitTerm", !!W.__mgQbitTerm, W.__mgQbitTerm && W.__mgQbitTerm.ver);
if (W.__mgQbitTerm && W.__mgQbitTerm.selfTest) {
  const tt = W.__mgQbitTerm.selfTest();
  check("term-plane-selfTest", tt && tt.ok, tt && tt.report);
}
if (W.__mgQbitTruss && W.__mgQbitTruss.resolveSeat) {
  const seat = W.__mgQbitTruss.resolveSeat("uvspeed");
  check("fleet-seat-uvspeed", !!(seat && seat.path), seat && seat.path);
}

check("__mgQbitRace", !!W.__mgQbitRace, W.__mgQbitRace && W.__mgQbitRace.ver);
if (W.__mgQbitRace && W.__mgQbitRace.selfTest) {
  const rs = W.__mgQbitRace.selfTest();
  check("race-sitrep", rs && rs.ok, rs && rs.report);
}
check("__mgQbitL1Pilot", !!W.__mgQbitL1Pilot, W.__mgQbitL1Pilot && W.__mgQbitL1Pilot.ver);
if (W.__mgQbitL1Pilot && W.__mgQbitL1Pilot.selfTest) {
  const l1 = W.__mgQbitL1Pilot.selfTest();
  check("l1-pilot-selfTest", l1 && l1.ok, l1 && l1.report);
}
/* simulate uterm BroadcastChannel if available */
if (typeof BroadcastChannel !== "undefined" && W.__mgQbitL1Pilot) {
  try {
    const bc = new BroadcastChannel("mg-qbit-term");
    const before = W.__mgQbitL1Pilot.stats.in;
    bc.postMessage({
      type: "mg-qbit-term",
      text: "uterm-sim-line function x(){}",
      termId: "uterm-smoke",
    });
    bc.close();
    /* onmessage is async-ish — call ingest directly as well for determinism */
    W.__mgQbitL1Pilot.ingestLine("uterm-direct function y(){}", "uterm-smoke");
    check(
      "l1-uterm-ingest",
      W.__mgQbitL1Pilot.stats.in > before,
      "in=" + W.__mgQbitL1Pilot.stats.in
    );
    /* H6: nterminal/hexterm termId path */
    const beforeN = W.__mgQbitL1Pilot.stats.in;
    W.__mgQbitL1Pilot.ingestLine("nterm-sim function n(){}", "nterminal");
    check(
      "l1-nterm-ingest",
      W.__mgQbitL1Pilot.stats.in > beforeN,
      "in=" + W.__mgQbitL1Pilot.stats.in
    );
    if (W.__mgQbitL1Pilot.publishPresence) {
      const pr = W.__mgQbitL1Pilot.publishPresence({ force: true, term: "smoke" });
      check("l1-presence", !!pr, pr && pr.id);
    }
  } catch (e) {
    check("l1-uterm-ingest", false, String(e));
  }
}
check("__mgAgentDesk", !!W.__mgAgentDesk, W.__mgAgentDesk && W.__mgAgentDesk.ver);
if (W.__mgAgentDesk && W.__mgAgentDesk.run) {
  const out = W.__mgAgentDesk.run("/sitrep");
  check("desk-sitrep", typeof out === "string" && out.length > 4, String(out).slice(0, 80));
  if (W.__mgAgentDesk.run) {
    const pr = W.__mgAgentDesk.run("/presence");
    check("desk-presence", typeof pr === "string" && pr.indexOf("presence") >= 0, String(pr).slice(0, 80));
  }
}

const failed = results.filter((r) => !r.ok);
console.log("qbit-smoke · " + (failed.length ? "FAIL" : "PASS"));
for (const r of results) {
  console.log((r.ok ? "  ✓ " : "  ✗ ") + r.name + (r.detail ? " · " + r.detail : ""));
}
if (W.__mgQbitBus) console.log("  bus: " + W.__mgQbitBus.report());
if (W.__mgQbitLoop) console.log("  loop: " + W.__mgQbitLoop.report());
if (W.__mgQbitRouter) console.log("  router: " + W.__mgQbitRouter.report());
if (W.__mgQbitAdapters) console.log("  adapters: " + W.__mgQbitAdapters.report());
if (W.__mgQbitNative) console.log("  native: " + W.__mgQbitNative.report());
if (W.__mgQbitTruss) console.log("  truss: " + W.__mgQbitTruss.report());
if (W.__mgIronline) console.log("  iron: " + W.__mgIronline.report());

process.exit(failed.length ? 1 : 0);
