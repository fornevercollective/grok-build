/**
 * Mesh collaboration gate for glyph pins (overview-style).
 * Pins stay idle until another device/tab joins the same lab mesh room.
 *
 * Channels:
 *  - BroadcastChannel('lab-mesh')     same-origin tabs / PWA instances
 *  - BroadcastChannel('ugrad-live')   overview / ugrad companions (presence only)
 *  - Optional GY hub ws://host/?role=lab&nick=…
 */
(function () {
  "use strict";

  const ROOM = "lab-arch";
  const HEARTBEAT_MS = 4000;
  const STALE_MS = 12000;

  const selfId =
    sessionStorage.getItem("lab.peerId") ||
    (() => {
      const id = "p_" + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem("lab.peerId", id);
      return id;
    })();

  const selfNick =
    localStorage.getItem("lab.nick") ||
    "lab-" + selfId.slice(-4);

  const peers = new Map(); // id -> { nick, last }
  let joined = false;
  let bc = null;
  let ugrad = null;
  let hbTimer = 0;
  let pruneTimer = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function peerCountOthers() {
    let n = 0;
    const now = Date.now();
    peers.forEach((p, id) => {
      if (id === selfId) return;
      if (now - p.last < STALE_MS) n++;
    });
    return n;
  }

  function setCollabActive(active) {
    const rail = $("glyph-pin-rail");
    const idle = $("glyph-pin-idle-msg");
    const live = $("glyph-pin-live");
    document.body.classList.toggle("pins-idle", !active);
    document.body.classList.toggle("pins-live", active);
    if (rail) rail.dataset.collab = active ? "1" : "0";
    if (idle) idle.hidden = !!active;
    if (live) live.hidden = !active;

    // Notify walkie-dock to start/stop peer synth animation
    window.dispatchEvent(
      new CustomEvent("lab:collab", {
        detail: {
          active,
          peers: peerCountOthers(),
          selfId,
          selfNick,
          roster: roster(),
        },
      })
    );
  }

  function roster() {
    const now = Date.now();
    const out = [];
    peers.forEach((p, id) => {
      if (now - p.last < STALE_MS) out.push({ id, nick: p.nick, self: id === selfId });
    });
    return out;
  }

  function refreshUi() {
    const others = peerCountOthers();
    const active = others > 0;
    setCollabActive(active);
    const label = $("mesh-label");
    const dot = $("mesh-dot");
    if (label) {
      if (!joined) label.textContent = "solo · pins idle";
      else if (!active) label.textContent = "mesh on · waiting for peers";
      else label.textContent = "collaborating · " + others + " peer" + (others === 1 ? "" : "s");
    }
    if (dot) {
      dot.classList.toggle("on", joined);
      dot.classList.toggle("live", active);
    }
    const btn = $("btn-mesh-join");
    if (btn) btn.textContent = joined ? "Leave mesh" : "Join mesh";
  }

  function notePeer(id, nick) {
    if (!id) return;
    peers.set(id, { nick: nick || id, last: Date.now() });
    refreshUi();
  }

  function broadcast(type, extra) {
    const msg = {
      type,
      room: ROOM,
      id: selfId,
      nick: selfNick,
      t: Date.now(),
      source: "architecture-lab",
      ...extra,
    };
    try {
      bc && bc.postMessage(msg);
    } catch (_) {}
    try {
      ugrad &&
        ugrad.postMessage({
          type: "presence",
          room: ROOM,
          user: selfNick,
          peerId: selfId,
          source: "architecture-lab",
          t: msg.t,
        });
    } catch (_) {}
  }

  function onMessage(data) {
    if (!data || typeof data !== "object") return;
    if (data.room && data.room !== ROOM && data.type !== "presence") return;
    const id = data.id || data.peerId;
    if (!id || id === selfId) return;
    if (data.type === "leave") {
      peers.delete(id);
      refreshUi();
      return;
    }
    // hello | heartbeat | presence | lab-mesh
    if (
      data.type === "hello" ||
      data.type === "heartbeat" ||
      data.type === "presence" ||
      data.type === "lab-mesh" ||
      data.nick ||
      data.user
    ) {
      notePeer(id, data.nick || data.user || id);
      // reply so they see us
      if (joined && data.type === "hello") broadcast("heartbeat");
    }
  }

  function join() {
    if (joined) return;
    joined = true;
    if (typeof BroadcastChannel !== "undefined") {
      if (!bc) {
        bc = new BroadcastChannel("lab-mesh");
        bc.onmessage = (e) => onMessage(e.data);
      }
      if (!ugrad) {
        try {
          ugrad = new BroadcastChannel("ugrad-live");
          ugrad.onmessage = (e) => onMessage(e.data);
        } catch (_) {}
      }
    }
    peers.set(selfId, { nick: selfNick, last: Date.now() });
    broadcast("hello");
    hbTimer = setInterval(() => {
      if (!joined) return;
      peers.set(selfId, { nick: selfNick, last: Date.now() });
      broadcast("heartbeat");
    }, HEARTBEAT_MS);
    pruneTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      peers.forEach((p, id) => {
        if (id !== selfId && now - p.last > STALE_MS) {
          peers.delete(id);
          changed = true;
        }
      });
      if (changed) refreshUi();
    }, 2000);
    refreshUi();
    localStorage.setItem("lab.meshJoined", "1");
  }

  function leave() {
    if (!joined) return;
    broadcast("leave");
    joined = false;
    clearInterval(hbTimer);
    clearInterval(pruneTimer);
    peers.clear();
    refreshUi();
    localStorage.removeItem("lab.meshJoined");
  }

  function toggle() {
    if (joined) leave();
    else join();
  }

  function bind() {
    $("btn-mesh-join")?.addEventListener("click", toggle);
    // Auto-listen for others even when solo (so we wake when they join)
    if (typeof BroadcastChannel !== "undefined") {
      try {
        bc = new BroadcastChannel("lab-mesh");
        bc.onmessage = (e) => {
          onMessage(e.data);
          // passive: if someone hellos and we're solo, still count them for pin gate
          // but we need to have joined to reply — auto soft-join on first foreign hello
          if (!joined && e.data && e.data.id && e.data.id !== selfId) {
            join();
          }
        };
      } catch (_) {}
      try {
        ugrad = new BroadcastChannel("ugrad-live");
        ugrad.onmessage = (e) => {
          onMessage(e.data);
          if (!joined && e.data && (e.data.peerId || e.data.id) && (e.data.peerId || e.data.id) !== selfId) {
            join();
          }
        };
      } catch (_) {}
    }
    // restore join preference
    if (localStorage.getItem("lab.meshJoined") === "1") join();
    else refreshUi();

    window.LabMesh = {
      join,
      leave,
      toggle,
      roster,
      selfId,
      selfNick,
      isCollaborating: () => peerCountOthers() > 0,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
