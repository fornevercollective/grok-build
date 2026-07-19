/* Memory Glass · L1 terminal pilot (end-to-end)
 * Bridges uvspeed uterm / nterminal (hexterm pilot) / iron-line / kbatch gutter → bus.
 * Channels: BroadcastChannel("mg-qbit-term") · postMessage · iron-line · quantum-prefixes
 * H6: multi-seat presence on bus (kind:presence) + multi-surface open.
 * VER: qbit-l1-pilot-v3
 */
(function () {
  "use strict";
  var VER = "qbit-l1-pilot-v3";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._qbitL1PilotVer === VER) return;
  HP._qbitL1PilotVer = VER;

  var UV_WEB = "file:///Volumes/qbitOS/00.dev/projects/uvspeed/web/";
  var TERMS = {
    uterm: { url: UV_WEB + "uterm.html", title: "uterm L1", id: "uterm" },
    nterminal: {
      url: UV_WEB + "nterminal.html",
      title: "nterminal · hexterm pilot",
      id: "nterminal",
    },
    /* hexterm product launches nterminal-class surface until dedicated page ships */
    hexterm: {
      url: UV_WEB + "nterminal.html",
      title: "hexterm L1 pilot",
      id: "hexterm",
    },
  };

  var stats = {
    in: 0,
    out: 0,
    gutter: 0,
    iron: 0,
    presence: 0,
    byTerm: {},
  };
  var lastLine = "";
  var seats = {}; /* id → { id, role, product, term, t, host } */
  var lastPresenceT = 0;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "l1-pilot");
    } catch (e) {}
  }

  function ironTick(ms) {
    try {
      if (window.__mgIronline && window.__mgIronline.tick)
        window.__mgIronline.tick("L1", ms || 0.2);
    } catch (e) {}
  }

  function localSeatId() {
    try {
      if (window.__mgQbitTruss && window.__mgQbitTruss.seatId)
        return window.__mgQbitTruss.seatId();
    } catch (e) {}
    try {
      if (window.__mgMesh && window.__mgMesh.seatId) return window.__mgMesh.seatId;
    } catch (e2) {}
    try {
      var s = localStorage.getItem("mg.mesh.seat");
      if (s) return s;
    } catch (e3) {}
    return "mg-l1";
  }

  function ingestLine(text, src) {
    text = String(text || "");
    if (!text) return null;
    if (text === lastLine && (src === "uterm" || src === "nterminal" || src === "hexterm"))
      return null;
    lastLine = text;
    stats.in++;
    var tid = src || "l1-pilot";
    stats.byTerm[tid] = (stats.byTerm[tid] || 0) + 1;
    ironTick(0.25);
    try {
      if (window.__mgQbitTerm) {
        window.__mgQbitTerm.write(text, tid);
        return window.__mgQbitTerm.publishBus({
          text: text,
          kind: "term",
          termId: tid,
          src: "term",
        });
      }
    } catch (e) {}
    try {
      if (window.__mgQbitBus) {
        return window.__mgQbitBus.publish({
          src: "term",
          kind: "term",
          lane: "L1",
          prefix: "+0:",
          withGlyph: true,
          payload: { text: text.slice(0, 400), termId: tid },
        });
      }
    } catch (e2) {}
    try {
      if (window.__mgQbitLoop)
        window.__mgQbitLoop.classifyAsync(text, tid);
    } catch (e3) {}
    return null;
  }

  function ingestGutter(state, app) {
    stats.gutter++;
    ironTick(0.15);
    try {
      if (window.__mgQbitBus) {
        return window.__mgQbitBus.publish({
          src: "kbatch",
          kind: "gutter",
          lane: "L3",
          prefix: "-n:",
          gate: "M",
          withGlyph: true,
          payload: {
            app: app || "kbatch",
            state: state || {},
            via: "l1-pilot-bc",
          },
        });
      }
    } catch (e) {}
    return null;
  }

  /** Multi-seat presence — soft, throttled (H6) */
  function publishPresence(extra) {
    var now = Date.now();
    if (now - lastPresenceT < 2000 && !(extra && extra.force)) return null;
    lastPresenceT = now;
    stats.presence++;
    var seat = {
      id: localSeatId(),
      role: (extra && extra.role) || "human",
      product: (extra && extra.product) || "memory-glass",
      term: (extra && extra.term) || "l1-pilot",
      host: (typeof location !== "undefined" && location.host) || "mg",
      t: now,
    };
    try {
      if (window.__mgQbitTruss && window.__mgQbitTruss.report) {
        var tr = window.__mgQbitTruss.report();
        seat.truss = String(tr).slice(0, 80);
      }
    } catch (e) {}
    seats[seat.id] = seat;
    try {
      if (window.__mgQbitBus) {
        return window.__mgQbitBus.publish({
          src: "term",
          kind: "presence",
          lane: "L1",
          prefix: "+1:",
          withGlyph: true,
          payload: seat,
        });
      }
    } catch (e2) {}
    try {
      if (window.__mgMesh && window.__mgMesh.broadcast)
        window.__mgMesh.broadcast("presence", seat);
    } catch (e3) {}
    return seat;
  }

  function noteRemotePresence(payload) {
    if (!payload || !payload.id) return;
    seats[payload.id] = Object.assign({}, payload, { t: Date.now() });
  }

  function pruneSeats(maxAgeMs) {
    var cut = Date.now() - (maxAgeMs || 120000);
    Object.keys(seats).forEach(function (id) {
      if ((seats[id].t || 0) < cut) delete seats[id];
    });
  }

  function seatList() {
    pruneSeats(180000);
    return Object.keys(seats).map(function (k) {
      return seats[k];
    });
  }

  function openTerm(name) {
    var T = TERMS[name] || TERMS.uterm;
    var u = T.url;
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({
            op: "open_tab",
            url: u,
            title: T.title,
          })
        );
        stats.out++;
        publishPresence({ term: T.id, force: true });
        return true;
      }
    } catch (e) {}
    try {
      window.open(u, "_blank", "noopener");
      stats.out++;
      publishPresence({ term: T.id, force: true });
      return true;
    } catch (e2) {
      return false;
    }
  }

  function openUterm() {
    return openTerm("uterm");
  }
  function openNterm() {
    return openTerm("nterminal");
  }
  function openHexterm() {
    return openTerm("hexterm");
  }

  function onMessage(ev) {
    try {
      var d = ev.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "mg-qbit-term" || d.type === "qbit-term") {
        ingestLine(d.text || d.line || "", d.termId || d.src || "external");
      }
      if (d.type === "mg-qbit-presence" && d.payload) {
        noteRemotePresence(d.payload);
      }
      if (d.type === "mg-qbit-sitrep" && window.__mgQbitRace) {
        window.__mgQbitRace.publish({});
      }
    } catch (e) {}
  }

  function bindChannels() {
    try {
      window.addEventListener("message", onMessage);
    } catch (e) {}

    try {
      var bc = new BroadcastChannel("mg-qbit-term");
      bc.onmessage = function (ev) {
        var d = ev.data || {};
        if (d.type === "mg-qbit-term" || d.text || d.line) {
          ingestLine(d.text || d.line || "", d.termId || d.src || "uterm");
        }
        if (d.type === "mg-qbit-presence" && d.payload) {
          noteRemotePresence(d.payload);
        }
      };
      HP._mgQbitTermBC = bc;
    } catch (e2) {}

    try {
      var iron = new BroadcastChannel("iron-line");
      iron.onmessage = function (ev) {
        var d = ev.data || {};
        stats.iron++;
        if (d.line || d.cmd || d.text) {
          ingestLine(d.line || d.cmd || d.text, "iron-line");
        } else if (d.type === "command" && d.cmd) {
          ingestLine(d.cmd, "iron-line");
        }
      };
    } catch (e3) {}

    try {
      var qp = new BroadcastChannel("quantum-prefixes");
      qp.onmessage = function (ev) {
        var d = ev.data || {};
        if (d.type === "kbatch-gutter") {
          ingestGutter(d.state, d.app);
        }
      };
    } catch (e4) {}

    /* mesh presence fan-in */
    try {
      if (window.__mgMesh && window.__mgMesh.on) {
        /* soft — mesh may only expose broadcast */
      }
    } catch (e5) {}

    /* bus presence subscribe */
    try {
      if (window.__mgQbitBus && window.__mgQbitBus.subscribe) {
        window.__mgQbitBus.subscribe("presence", function (env) {
          if (env && env.payload) noteRemotePresence(env.payload);
        });
      }
    } catch (e6) {}
  }

  setTimeout(function () {
    try {
      if (window.__mgQbitTerm && window.__mgQbitTerm.register) {
        window.__mgQbitTerm.register("l1-pilot", {
          write: function () {},
          onEnvelope: function (env) {
            if (env && (env.kind === "sitrep" || env.kind === "term" || env.kind === "presence"))
              stats.out++;
          },
          report: function () {
            return report();
          },
        });
      }
    } catch (e) {}
    publishPresence({ role: "agent", term: "l1-pilot", force: true });
  }, 400);

  /* soft re-announce for multi-seat board (not Grok-monitor — local bus only) */
  setInterval(function () {
    publishPresence({ term: "l1-pilot" });
  }, 45000);

  function report() {
    pruneSeats(180000);
    var terms = Object.keys(stats.byTerm)
      .map(function (k) {
        return k + "×" + stats.byTerm[k];
      })
      .join(",") || "—";
    return (
      VER +
      " in=" +
      stats.in +
      " gutter=" +
      stats.gutter +
      " iron=" +
      stats.iron +
      " out=" +
      stats.out +
      " presence=" +
      stats.presence +
      " seats=" +
      Object.keys(seats).length +
      " terms=" +
      terms
    );
  }

  function selfTest() {
    var results = [];
    results.push({
      name: "bc",
      ok: typeof BroadcastChannel !== "undefined",
    });
    var env = ingestLine("function l1pilot(){ return 1 }", "selftest");
    results.push({ name: "ingest", ok: stats.in >= 1 });
    results.push({
      name: "bus-or-term",
      ok: !!(window.__mgQbitBus || window.__mgQbitTerm),
    });
    var p = publishPresence({ force: true, term: "selftest" });
    results.push({ name: "presence", ok: !!p && stats.presence >= 1 });
    results.push({
      name: "openers",
      ok:
        typeof openUterm === "function" &&
        typeof openHexterm === "function" &&
        typeof openNterm === "function",
    });
    var ok = results.every(function (r) {
      return r.ok;
    });
    return { ok: ok, results: results, report: report(), env: env };
  }

  window.__mgQbitL1Pilot = {
    ver: VER,
    ingestLine: ingestLine,
    ingestGutter: ingestGutter,
    openUterm: openUterm,
    openNterm: openNterm,
    openHexterm: openHexterm,
    openTerm: openTerm,
    publishPresence: publishPresence,
    seats: seatList,
    stats: stats,
    terms: TERMS,
    report: report,
    selfTest: selfTest,
    EXTERNAL_SNIPPET:
      "new BroadcastChannel('mg-qbit-term').postMessage({type:'mg-qbit-term',text:line,termId:'uterm'})",
  };

  bindChannels();
  log(VER + " · multi-seat presence · uterm+nterminal/hexterm L1");
})();
