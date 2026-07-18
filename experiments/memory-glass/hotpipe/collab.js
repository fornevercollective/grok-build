/* Memory Glass · collab mesh (M0–M3 scaffolds) — large-scale collaboration ready
 * BroadcastChannel mg-mesh + optional ugrad-live bridge. Speed: presence only, no DOM thrash.
 */
(function () {
  "use strict";
  var VER = "collab-v1";
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
    role: document.getElementById("pip-wrap") ? "inspect" : document.getElementById("mg-root") ? "shell" : "page",
    peers: {},
    lastRx: 0,
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
      v: 1,
      t: type || "presence",
      id: seatId,
      role: state.role,
      payload: payload || {},
      ts: Date.now(),
    };
    try {
      if (ch) ch.postMessage(msg);
    } catch (e) {}
    /* mirror light presence to ugrad-live for lab companions */
    if (type === "presence" && ugrad) {
      try {
        ugrad.postMessage({ type: "presence", source: "memory-glass", id: seatId, role: state.role, ts: msg.ts });
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
    /* prune stale > 60s */
    var now = Date.now();
    Object.keys(state.peers).forEach(function (k) {
      if (now - (state.peers[k].ts || 0) > 60000) delete state.peers[k];
    });
  }

  if (ch) ch.onmessage = function (ev) {
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
    broadcast("presence", {
      iron: window.__mgIronline ? window.__mgIronline.report() : null,
      ugrad: window.__mgUgrad ? window.__mgUgrad.report() : null,
      isolate: window.__mgIsolate || null,
    });
    setTimeout(heartbeat, 4000);
  }
  heartbeat();

  function peerCount() {
    return Object.keys(state.peers).length;
  }

  function report() {
    return "mesh " + seatId.slice(0, 6) + " · peers " + peerCount() + " · " + state.role;
  }

  window.__mgMesh = {
    ver: VER,
    state: state,
    broadcast: broadcast,
    peerCount: peerCount,
    report: report,
    seatId: seatId,
  };

  /* Finish H7: expose isolate map for collab */
  window.__mgIsolate = window.__mgIsolate || {
    track: "inspect",
    agent: "optional",
    shell: "main",
    mesh: "mg-mesh",
    ugrad: "ugrad-live",
  };
  window.__mgIsolate.mesh = "mg-mesh";
  window.__mgIsolate.seat = seatId;

  log("ok", "collab-v1 · mg-mesh · " + state.role + " · " + seatId);
})();
