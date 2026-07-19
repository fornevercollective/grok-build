/* Memory Glass · Qbit native bridge
 * Mirrors bus envelopes main ↔ inspect via IPC op "qbit_env".
 * Native path stamps nativeTμ (wall μs). True sub-μ gates stay in Rust later.
 * VER: qbit-native-v1
 */
(function () {
  "use strict";
  var VER = "qbit-native-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._qbitNativeVer === VER) return;
  HP._qbitNativeVer = VER;

  var stats = {
    sent: 0,
    applied: 0,
    loopGuard: 0,
    lastNativeTμ: 0,
  };
  var unsub = null;
  var mirrorKinds = {
    gate: 1,
    cell: 1,
    traj: 1,
    gutter: 1,
    note: 1,
    chat: 1,
    agent: 1,
    claim: 1,
    handoff: 1,
    race: 1,
    persona: 1,
  };
  var lastSentId = "";
  var throttleMs = 8;
  var lastSentAt = 0;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "qbit-native");
    } catch (e) {}
  }

  function role() {
    try {
      if (typeof document !== "undefined") {
        if (document.getElementById("pip-wrap")) return "inspect";
        if (document.getElementById("mg-root")) return "shell";
      }
    } catch (e) {}
    return "page";
  }

  function ipcPost(msg) {
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(JSON.stringify(msg));
        return true;
      }
    } catch (e) {}
    return false;
  }

  function shouldMirror(env) {
    if (!env || env._remote || env.native) return false;
    if (env.payload && env.payload._remote) return false;
    if (env.id && env.id === lastSentId) return false;
    var k = env.kind || "";
    if (mirrorKinds[k]) return true;
    if (env.src === "agent" || env.src === "truss" || env.src === "race") return true;
    return false;
  }

  function sendEnv(env, to) {
    if (!env) return false;
    var now = Date.now();
    if (now - lastSentAt < throttleMs && env.kind !== "handoff" && env.kind !== "claim") {
      return false;
    }
    lastSentAt = now;
    lastSentId = env.id || "";
    var slim = {
      v: env.v || 1,
      id: env.id,
      seq: env.seq,
      tμ: env.tμ,
      lane: env.lane || "L3",
      prefix: env.prefix,
      gate: env.gate,
      src: env.src,
      kind: env.kind,
      payload: env.payload || {},
      fleet: env.fleet || { role: role() },
      fromRole: role(),
    };
    var ok = ipcPost({
      op: "qbit_env",
      to: to || (role() === "inspect" ? "main" : "inspect"),
      env: slim,
      json: JSON.stringify(slim),
    });
    if (ok) stats.sent++;
    return ok;
  }

  /** Called from Rust evaluate_script after native stamp */
  function applyRemote(env) {
    if (!env) return;
    stats.applied++;
    if (env.nativeTμ) stats.lastNativeTμ = env.nativeTμ;
    try {
      if (window.__mgIronline && window.__mgIronline.tick) {
        window.__mgIronline.tick("L0", 0.05);
      }
    } catch (eI) {}
    var bus = window.__mgQbitBus;
    if (!bus) return;
    /* prevent echo storms */
    if (env.id && env.id === lastSentId) {
      stats.loopGuard++;
      return;
    }
    try {
      bus.publish({
        src: env.src || "ipc",
        kind: env.kind || "event",
        lane: env.lane || "L0",
        prefix: env.prefix,
        gate: env.gate,
        payload: Object.assign({}, env.payload || {}, {
          _remote: true,
          nativeTμ: env.nativeTμ,
          fromRole: env.fromRole,
        }),
        fleet: env.fleet,
        withGlyph: !!env.withGlyph,
        _remote: true,
        native: true,
        id: env.id ? env.id + "-rx" : undefined,
      });
    } catch (e) {}
  }

  function bindBus() {
    var bus = window.__mgQbitBus;
    if (!bus || unsub) return !!unsub;
    unsub = bus.subscribe(function (env) {
      if (!shouldMirror(env)) return;
      sendEnv(env, role() === "inspect" ? "main" : "inspect");
    });
    log(VER + " · bus mirror bound role=" + role());
    return true;
  }

  function report() {
    return (
      VER +
      " sent=" +
      stats.sent +
      " applied=" +
      stats.applied +
      " guard=" +
      stats.loopGuard +
      " lastNativeTμ=" +
      stats.lastNativeTμ +
      " role=" +
      role()
    );
  }

  window.__mgQbitNative = {
    ver: VER,
    send: sendEnv,
    applyRemote: applyRemote,
    bindBus: bindBus,
    stats: stats,
    report: report,
    setMirrorKind: function (k, on) {
      if (on === false) delete mirrorKinds[k];
      else mirrorKinds[k] = 1;
    },
  };

  setTimeout(bindBus, 120);
  setTimeout(bindBus, 600);
  setInterval(function () {
    if (!unsub) bindBus();
  }, 4000);

  log(VER + " · IPC qbit_env bridge");
})();
