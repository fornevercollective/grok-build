#!/usr/bin/env node
/**
 * Dormant Colossus worker — drains jobs while UI would sleep.
 * Queue file: ~/.panda/mg-soak/truss-jobs.jsonl
 * Uses same codec/loop as smoke (no browser).
 *
 * Usage:
 *   node scripts/qbit-dormant-worker.mjs           # one drain
 *   node scripts/qbit-dormant-worker.mjs --loop 30 # every 30s
 *   echo '{"kind":"classify","text":"hi"}' >> ~/.panda/mg-soak/truss-jobs.jsonl
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOT = path.resolve(__dirname, "../hotpipe");
const QUEUE = path.join(os.homedir(), ".panda/mg-soak/truss-jobs.jsonl");
const DONE = path.join(os.homedir(), ".panda/mg-soak/truss-jobs-done.jsonl");

function load(name) {
  return fs.readFileSync(path.join(HOT, name), "utf8");
}

function ensureQueue() {
  fs.mkdirSync(path.dirname(QUEUE), { recursive: true });
  if (!fs.existsSync(QUEUE)) fs.writeFileSync(QUEUE, "");
}

function makeWindow() {
  const window = {
    __mgHotPipe: {},
    __mgDevLog: () => {},
    performance: { now: () => Number(process.hrtime.bigint()) / 1e6 },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    localStorage: {
      _d: {},
      getItem(k) {
        return this._d[k] || null;
      },
      setItem(k, v) {
        this._d[k] = String(v);
      },
    },
  };
  window.window = window;
  const sandbox = {
    window,
    console,
    performance: window.performance,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  vm.createContext(sandbox);
  for (const f of [
    "ironline.js",
    "qbit-codec.js",
    "qbit-bus.js",
    "qbit-loop.js",
    "qbit-dac.js",
    "qbit-router.js",
    "qbit-truss.js",
  ]) {
    try {
      vm.runInContext(load(f), sandbox, { filename: f });
    } catch (e) {
      console.error("load fail", f, e.message);
    }
  }
  return sandbox.window;
}

function readJobs(max) {
  ensureQueue();
  const raw = fs.readFileSync(QUEUE, "utf8").trim();
  if (!raw) return [];
  const lines = raw.split("\n").filter(Boolean);
  const take = lines.slice(0, max);
  const rest = lines.slice(max);
  fs.writeFileSync(QUEUE, rest.length ? rest.join("\n") + "\n" : "");
  return take.map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return { kind: "classify", text: l };
    }
  });
}

function appendDone(job, result) {
  fs.appendFileSync(
    DONE,
    JSON.stringify({ t: Date.now(), job, result }) + "\n"
  );
}

function drainOnce(max = 8) {
  const W = makeWindow();
  const jobs = readJobs(max);
  if (!jobs.length) {
    console.log("qbit-dormant · empty queue " + QUEUE);
    return 0;
  }
  let n = 0;
  for (const job of jobs) {
    n++;
    const kind = job.kind || "classify";
    let result = { ok: true, kind };
    try {
      if (kind === "encode" && W.__mgQbitLoop) {
        W.__mgQbitLoop.encodeAsync(
          job.source || job.text || "function d(){return 1}\n",
          job.lang || "javascript",
          null
        );
        W.__mgQbitLoop.processL3Slice && W.__mgQbitLoop.processL3Slice();
      } else if (W.__mgQbitLoop) {
        W.__mgQbitLoop.classifyAsync(job.text || job.title || "dormant", "worker");
        W.__mgQbitLoop.processL3Slice && W.__mgQbitLoop.processL3Slice();
      }
      if (W.__mgQbitTruss) {
        W.__mgQbitTruss.enqueueDormant({
          kind,
          title: job.title || kind,
          monetize: !!job.monetize,
          payload: job,
        });
        W.__mgQbitTruss.pumpDormant(1);
      }
      if (job.climb && W.__mgQbitTruss) W.__mgQbitTruss.climb(job.climb);
    } catch (e) {
      result = { ok: false, err: String(e.message || e) };
    }
    appendDone(job, result);
    console.log(
      (result.ok ? "  ✓ " : "  ✗ ") + kind + " · " + (job.title || job.text || "").toString().slice(0, 60)
    );
  }
  console.log("qbit-dormant · drained " + n + " → " + DONE);
  return n;
}

const args = process.argv.slice(2);
const loopIdx = args.indexOf("--loop");
const loopSec = loopIdx >= 0 ? Math.max(5, parseInt(args[loopIdx + 1] || "30", 10)) : 0;

ensureQueue();
// seed example if empty
if (!fs.readFileSync(QUEUE, "utf8").trim()) {
  fs.appendFileSync(
    QUEUE,
    JSON.stringify({
      kind: "classify",
      title: "seed-dormant",
      text: "function seed(){ return 1 }",
    }) + "\n"
  );
}

drainOnce(8);
if (loopSec > 0) {
  console.log("loop every " + loopSec + "s");
  setInterval(() => drainOnce(8), loopSec * 1000);
} else {
  /* timers from qbit-loop/truss keep event loop alive */
  process.exit(0);
}
