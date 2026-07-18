/* Memory Glass · collab mesh (M0–M3+) — large-scale collaboration ready
 * BroadcastChannel mg-mesh + ugrad-live bridge.
 * Presence + score/run/chat mirrors for collab-day.
 * VER: collab-v2-day
 */
(function () {
  "use strict";
  var VER = "collab-v2-day";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._collabVer === VER) return;
  HP._collabVer = VER;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "info", String(m || ""), "collab");
    } catch (e) {}
  }

  var seatId = "mg-" + Math.random().toString(36).slice(2, 9);
  try {
    var s = localStorage.getItem("mg.mesh.seat");
    if (s) seatId = s;
    else localStorage.setItem("mg.mesh.seat", seatId);
  } catch (e) {}

  var state = {
    ver: VER,
    seatId: seatId,
    role: document.getElementById("pip-wrap")
      ? "inspect"
      : document.getElementById("mg-root")
        ? "shell"
        : "page",
    peers: {},
    lastRx: 0,
    lastScore: null,
    lastRun: null,
  };

  var ch = null;
  var ugrad = null;
  try {
    ch = new BroadcastChannel("mg-mesh");
  } catch (e) {
    ch = null;
  }
  try {
    ugrad = new BroadcastChannel("ugrad-live");
  } catch (e2) {
    ugrad = null;
  }

  function broadcast(type, payload) {
    var msg = {
      v: 2,
      t: type || "presence",
      id: seatId,
      role: state.role,
      payload: payload || {},
      ts: Date.now(),
    };
    try {
      if (ch) ch.postMessage(msg);
    } catch (e) {}
    if ((type === "presence" || type === "day-score") && ugrad) {
      try {
        ugrad.postMessage({
          type: type === "presence" ? "presence" : "mg-score",
          source: "memory-glass",
          id: seatId,
          role: state.role,
          payload: payload || {},
          ts: msg.ts,
        });
      } catch (e2) {}
    }
    return msg;
  }

  function onMsg(data) {
    if (!data || data.id === seatId) return;
    state.lastRx = Date.now();
    state.peers[data.id] = {
      id: data.id,
      role: data.role,
      t: data.t,
      ts: data.ts,
      payload: data.payload,
    };
    if (data.t === "day-score" || data.t === "score") state.lastScore = data.payload;
    if (data.t === "day-run" || data.t === "run") state.lastRun = data.payload;
    var now = Date.now();
    Object.keys(state.peers).forEach(function (k) {
      if (now - (state.peers[k].ts || 0) > 90000) delete state.peers[k];
    });
  }

  if (ch)
    ch.onmessage = function (ev) {
      try {
        onMsg(ev.data);
      } catch (e) {}
    };
  if (ugrad) {
    ugrad.onmessage = function (ev) {
      try {
        var d = ev.data;
        if (!d || d.source === "memory-glass") return;
        state.peers["ugrad-" + (d.id || "x")] = {
          id: d.id,
          role: "ugrad",
          t: "presence",
          ts: Date.now(),
          payload: d,
        };
      } catch (e) {}
    };
  }

  function heartbeat() {
    var payload = {
      iron: window.__mgIronline ? window.__mgIronline.report() : null,
      ugrad: window.__mgUgrad ? window.__mgUgrad.report() : null,
      isolate: window.__mgIsolate || null,
      busy: !!window.__mgWebgridPlayBusy,
    };
    try {
      if (window.__mgActivityBoard && window.__mgActivityBoard.report)
        payload.board = window.__mgActivityBoard.report();
    } catch (e) {}
    try {
      if (window.__mgCollabDay && window.__mgCollabDay.report)
        payload.day = window.__mgCollabDay.report();
    } catch (e2) {}
    broadcast("presence", payload);
    setTimeout(heartbeat, 4000);
  }
  heartbeat();

  function peerCount() {
    return Object.keys(state.peers).length;
  }

  function shareScore(snap) {
    state.lastScore = snap || {};
    return broadcast("day-score", snap || {});
  }

  function shareRun(run) {
    state.lastRun = run || {};
    return broadcast("day-run", run || {});
  }

  function report() {
    return (
      "mesh " +
      seatId.slice(0, 6) +
      " · peers " +
      peerCount() +
      " · " +
      state.role +
      " · " +
      VER
    );
  }

  window.__mgMesh = {
    ver: VER,
    state: state,
    broadcast: broadcast,
    peerCount: peerCount,
    report: report,
    seatId: seatId,
    shareScore: shareScore,
    shareRun: shareRun,
    peers: function () {
      return state.peers;
    },
  };

  window.__mgIsolate = window.__mgIsolate || {
    track: "inspect",
    agent: "optional",
    shell: "main",
    mesh: "mg-mesh",
    ugrad: "ugrad-live",
  };
  window.__mgIsolate.mesh = "mg-mesh";
  window.__mgIsolate.seat = seatId;
  window.__mgIsolate.day = "collab-day";

  log("ok", VER + " · mg-mesh · " + state.role + " · " + seatId);
})();
