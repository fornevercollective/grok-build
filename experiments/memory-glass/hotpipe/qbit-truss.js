/* Memory Glass · Qbit Agent Truss (Grokpool / Dojo / Colossus scale)
 * Multi-agent collab on the qbit bus while machines would otherwise be dormant.
 * Claims · handoffs · personas · race rungs · mesh share.
 * Does not fork QbitCodec.SYMBOLS.
 * VER: qbit-truss-v1
 */
(function () {
  "use strict";
  var VER = "qbit-truss-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._qbitTrussVer === VER) return;
  HP._qbitTrussVer = VER;

  var seatId = "truss-" + Math.random().toString(36).slice(2, 8);
  try {
    if (typeof localStorage !== "undefined") {
      var s = localStorage.getItem("mg.truss.seat");
      if (s) seatId = s;
      else localStorage.setItem("mg.truss.seat", seatId);
    }
  } catch (e) {}

  /* Climb ladder: quantum → cortical → core race (mueee qbit-core-race) */
  var RUNGS = [
    { id: "L3-quantum", lane: "L3", prefix: "0:", label: "quantum classify" },
    { id: "L0-speed", lane: "L0", prefix: "n:", label: "super speed ingest" },
    { id: "L5-render", lane: "L5", prefix: "+2:", label: "render budget" },
    { id: "L2-commander", lane: "L2", prefix: "+1:", label: "agent dispatch" },
    { id: "L7-persona", lane: "L7", prefix: "+3:", label: "persona / voice" },
    { id: "core-race", lane: "L0", prefix: "-n:", label: "qbit-core-race" },
  ];

  var state = {
    ver: VER,
    seatId: seatId,
    persona: null,
    rung: 0,
    claims: {},
    handoffs: [],
    peers: {},
    dormantJobs: [],
    monetizeHooks: [],
    lastRace: null,
  };

  var stats = { claims: 0, handoffs: 0, personas: 0, race: 0, jobs: 0 };
  var fleetSeats = null; /* from catalogue.json — read-only map */

  /* Canonical product seats (fleet catalogue sibling — no bulk moves) */
  var DEFAULT_SEATS = [
    {
      id: "memory-glass",
      path: "/Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass",
      role: "operator-console",
    },
    {
      id: "kbatch",
      path: "/Volumes/qbitOS/00.dev/projects/KBatch-dictionary",
      role: "language-geometry",
    },
    {
      id: "uvspeed",
      path: "/Volumes/qbitOS/00.dev/projects/uvspeed",
      role: "hexterm-l1",
    },
    {
      id: "overview",
      path: "/Volumes/qbitOS/00.dev/ai/overview",
      role: "research-spa",
    },
    {
      id: "quantum-fox",
      path: "/Volumes/qbitOS/00.dev/projects/quantum-fox",
      role: "terminal-experiments",
    },
    {
      id: "grok-cli",
      path: "/Users/tref/projects/grok-cli",
      role: "agent-chat",
    },
    {
      id: "core-race",
      path: "https://mueee.qbitos.ai/qbit-core-race.html",
      role: "race",
    },
  ];

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "qbit-truss");
    } catch (e) {}
  }

  function bus() {
    return window.__mgQbitBus || null;
  }

  function seats() {
    return fleetSeats || DEFAULT_SEATS;
  }

  function resolveSeat(product) {
    if (!product) return null;
    var p = String(product).toLowerCase();
    var list = seats();
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (
        s.id === p ||
        (s.path && String(s.path).toLowerCase().indexOf(p) >= 0) ||
        (s.name && String(s.name).toLowerCase().indexOf(p) >= 0)
      )
        return s;
    }
    return null;
  }

  /** Load fleet catalogue.json if host serves it (optional). Falls back to DEFAULT_SEATS. */
  function loadFleetCatalogue(url, cb) {
    url =
      url ||
      "file:///Volumes/qbitOS/11_docs/catalogue/catalogue.json";
    /* Browser often blocks file:// — IPC/native or injected can set seats */
    if (typeof fetch !== "function") {
      if (cb) cb(seats());
      return Promise.resolve(seats());
    }
    return fetch(url)
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (!data) {
          if (cb) cb(seats());
          return seats();
        }
        var entries = Array.isArray(data)
          ? data
          : data.entries || data.items || data.catalogue || [];
        var out = DEFAULT_SEATS.slice();
        entries.forEach(function (e) {
          if (!e || typeof e !== "object") return;
          var id = e.id || e.name || e.title;
          var path = e.path || e.dir || e.root;
          if (!id || !path) return;
          var sid = String(id)
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, "-")
            .slice(0, 48);
          if (resolveSeat(sid)) return;
          out.push({
            id: sid,
            path: path,
            role: e.role || e.kind || "catalogue",
            name: e.name || e.title || sid,
          });
        });
        fleetSeats = out;
        pub({
          kind: "fleet",
          lane: "L2",
          prefix: "+2:",
          payload: { n: out.length, source: "catalogue" },
        });
        if (cb) cb(out);
        return out;
      })
      .catch(function () {
        if (cb) cb(seats());
        return seats();
      });
  }

  function setSeats(list) {
    if (Array.isArray(list) && list.length) fleetSeats = list;
    return seats();
  }

  /** Persist handoff for panda / other Grok (IPC when available) */
  function writePandaHandoff(h) {
    var body = {
      session: "qbit-truss",
      ok: true,
      updated_at: String(Math.floor(Date.now() / 1000)),
      active: {
        id: h.id,
        from: h.from,
        to: h.to,
        summary: h.summary,
        status: "pending",
        loop: 0,
        created_at: String(Math.floor(Date.now() / 1000)),
        files: h.files || [],
        tests: h.tests || [],
        prompt: h.prompt || "",
        truss: true,
        persona: h.persona,
        rung: h.rung,
      },
    };
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({
            op: "truss_handoff",
            json: JSON.stringify(body),
          })
        );
      }
    } catch (e) {}
    try {
      localStorage.setItem("mg.truss.lastHandoff", JSON.stringify(body));
    } catch (e2) {}
    return body;
  }

  function pub(partial) {
    var b = bus();
    if (!b) return null;
    try {
      return b.publish(
        Object.assign(
          {
            src: "truss",
            fleet: { seat: seatId, role: "agent", host: "mg" },
            withGlyph: true,
          },
          partial || {}
        )
      );
    } catch (e) {
      return null;
    }
  }

  function iron(lane, ms) {
    try {
      if (window.__mgIronline && window.__mgIronline.tick)
        window.__mgIronline.tick(lane || "L2", ms || 0.1);
    } catch (e) {}
  }

  /** Adopt a working persona for overnight / dormant churn */
  function adoptPersona(spec) {
    spec = spec || {};
    state.persona = {
      id: spec.id || "persona-" + seatId,
      name: spec.name || "fleet-agent",
      goal: spec.goal || "climb-core-race",
      monetize: !!spec.monetize,
      kbatch: !!spec.kbatch,
      mg: spec.mg !== false,
      created: Date.now(),
    };
    stats.personas++;
    iron("L7", 0.2);
    return pub({
      kind: "persona",
      lane: "L7",
      prefix: "+3:",
      gate: "Y",
      payload: state.persona,
    });
  }

  /** Claim a work slice (other agents respect claim TTL) */
  function claim(job, ttlMs) {
    job = job || {};
    var id = job.id || "job-" + Date.now().toString(36);
    var seat = resolveSeat(job.product || job.seat || job.tree);
    var claim = {
      id: id,
      by: seatId,
      persona: state.persona && state.persona.id,
      title: job.title || job.summary || id,
      files: job.files || [],
      tests: job.tests || [],
      product: seat ? seat.id : job.product || null,
      path: seat ? seat.path : job.path || null,
      rung: RUNGS[state.rung] && RUNGS[state.rung].id,
      until: Date.now() + (ttlMs || 15 * 60 * 1000),
      monetize: !!job.monetize,
    };
    state.claims[id] = claim;
    stats.claims++;
    iron("L2", 0.15);
    pub({
      kind: "claim",
      lane: "L2",
      prefix: "+1:",
      gate: "H",
      payload: claim,
    });
    /* mesh if present */
    try {
      if (window.__mgMesh && window.__mgMesh.broadcast)
        window.__mgMesh.broadcast("truss-claim", claim);
    } catch (e) {}
    return claim;
  }

  /** Handoff pack → panda / other Grok / collab day */
  function handoff(pack) {
    pack = pack || {};
    var seat = resolveSeat(pack.product || pack.seat);
    var h = {
      id: "ho-" + Date.now().toString(36),
      from: seatId,
      to: pack.to || "any",
      summary: pack.summary || "",
      files: pack.files || (seat ? [seat.path] : []),
      tests: pack.tests || [],
      prompt: pack.prompt || "",
      product: seat ? seat.id : pack.product || null,
      path: seat ? seat.path : pack.path || null,
      persona: state.persona,
      rung: RUNGS[state.rung],
      ts: Date.now(),
    };
    state.handoffs.push(h);
    if (state.handoffs.length > 32) state.handoffs.shift();
    stats.handoffs++;
    iron("L2", 0.2);
    pub({
      kind: "handoff",
      lane: "L2",
      prefix: "+1:",
      gate: "H",
      payload: h,
    });
    writePandaHandoff(h);
    /* panda lab-handoff style soft write if available */
    try {
      if (window.__mgCollabDay && window.__mgCollabDay.shareRun) {
        window.__mgCollabDay.shareRun({
          title: h.summary,
          seat: seatId,
          truss: true,
          product: h.product,
        });
      }
    } catch (e) {}
    try {
      if (window.__mgGrokTerm && window.__mgGrokTerm.push)
        window.__mgGrokTerm.push("info", "TRUSS handoff: " + h.summary.slice(0, 80));
    } catch (e2) {}
    return h;
  }

  /** Climb one rung toward core-race */
  function climb(reason) {
    if (state.rung < RUNGS.length - 1) state.rung++;
    var r = RUNGS[state.rung];
    stats.race++;
    iron(r.lane, 0.1);
    state.lastRace = {
      rung: r,
      reason: reason || "climb",
      t: Date.now(),
    };
    return pub({
      kind: "race",
      lane: r.lane,
      prefix: r.prefix,
      payload: {
        rung: r.id,
        label: r.label,
        index: state.rung,
        of: RUNGS.length,
        reason: reason || "climb",
        url: "https://mueee.qbitos.ai/qbit-core-race.html",
        kbatch: "https://kbatch.ugrad.ai/",
      },
    });
  }

  /** Queue dormant-machine work (monetize / train / encode) when idle */
  function enqueueDormant(job) {
    job = job || {};
    var j = {
      id: job.id || "dorm-" + Date.now().toString(36),
      kind: job.kind || "encode",
      title: job.title || "dormant-job",
      monetize: !!job.monetize,
      payload: job.payload || {},
      ts: Date.now(),
    };
    state.dormantJobs.push(j);
    if (state.dormantJobs.length > 64) state.dormantJobs.shift();
    stats.jobs++;
    return pub({
      kind: "dormant",
      lane: "L0",
      prefix: "n:",
      payload: j,
    });
  }

  function pumpDormant(maxN) {
    maxN = maxN || 1;
    var n = 0;
    while (n < maxN && state.dormantJobs.length) {
      var j = state.dormantJobs.shift();
      n++;
      if (j.kind === "encode" && window.__mgQbitLoop && window.__mgQbitLoop.encodeAsync) {
        window.__mgQbitLoop.encodeAsync(
          (j.payload && j.payload.source) || "// dormant encode\nfunction x(){return 1}\n",
          "javascript",
          null
        );
      } else if (j.kind === "classify" && window.__mgQbitLoop) {
        window.__mgQbitLoop.classifyAsync(
          (j.payload && j.payload.text) || "dormant classify",
          "truss"
        );
      } else if (j.kind === "gutter" && window.__mgKbatchDojo) {
        try {
          window.__mgKbatchDojo.binaryStreamToGutter(
            (j.payload && j.payload.text) || "dormant",
            j.payload && j.payload.binary
          );
        } catch (e) {}
      }
      pub({
        kind: "job-done",
        lane: "L3",
        prefix: "0:",
        payload: { id: j.id, kind: j.kind, monetize: j.monetize },
      });
    }
    return n;
  }

  function openCoreRace() {
    var u = "https://mueee.qbitos.ai/qbit-core-race.html";
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({ op: "open_tab", url: u, title: "qbit-core-race" })
        );
        return true;
      }
    } catch (e) {}
    try {
      window.open(u, "_blank", "noopener");
      return true;
    } catch (e2) {
      return false;
    }
  }

  function bindBus() {
    var b = bus();
    if (!b || HP._qbitTrussBound) return;
    HP._qbitTrussBound = true;
    b.subscribe(function (env) {
      if (!env || env.src === "truss") return;
      if (env.kind === "claim" && env.payload && env.payload.by !== seatId) {
        state.peers[env.payload.by] = {
          claim: env.payload,
          ts: Date.now(),
        };
      }
      if (env.kind === "handoff" && env.payload && env.payload.to === seatId) {
        state.handoffs.push(env.payload);
      }
    });
  }

  function report() {
    return (
      VER +
      " seat=" +
      seatId +
      " rung=" +
      (RUNGS[state.rung] && RUNGS[state.rung].id) +
      " persona=" +
      (state.persona ? state.persona.name : "none") +
      " fleet=" +
      seats().length +
      " claims=" +
      stats.claims +
      " handoffs=" +
      stats.handoffs +
      " jobs=" +
      stats.jobs
    );
  }

  function selfTest() {
    var results = [];
    results.push({ name: "bus", ok: !!bus() });
    adoptPersona({ name: "smoke-persona", goal: "selftest" });
    results.push({ name: "persona", ok: !!state.persona });
    var c = claim(
      { title: "smoke-claim", product: "memory-glass", monetize: false },
      60000
    );
    results.push({
      name: "claim",
      ok: !!(c && c.id && c.path),
      path: c && c.path,
    });
    results.push({
      name: "resolve-uvspeed",
      ok: !!(resolveSeat("uvspeed") && resolveSeat("uvspeed").path),
    });
    climb("selftest");
    results.push({ name: "climb", ok: state.rung >= 1 });
    enqueueDormant({ kind: "classify", title: "smoke-dormant" });
    var n = pumpDormant(1);
    results.push({ name: "dormant", ok: n >= 1 });
    var ok = results.every(function (r) {
      return r.ok;
    });
    return { ok: ok, results: results, report: report() };
  }

  window.__mgQbitTruss = {
    ver: VER,
    RUNGS: RUNGS,
    state: state,
    stats: stats,
    adoptPersona: adoptPersona,
    claim: claim,
    handoff: handoff,
    climb: climb,
    enqueueDormant: enqueueDormant,
    pumpDormant: pumpDormant,
    openCoreRace: openCoreRace,
    seats: seats,
    resolveSeat: resolveSeat,
    loadFleetCatalogue: loadFleetCatalogue,
    setSeats: setSeats,
    writePandaHandoff: writePandaHandoff,
    report: report,
    selfTest: selfTest,
    seatId: seatId,
  };

  setTimeout(bindBus, 200);
  /* soft dormant pump when loop is up — low duty */
  setInterval(function () {
    try {
      if (state.dormantJobs.length) pumpDormant(1);
    } catch (e) {}
  }, 12000);

  log(VER + " · agent truss · core-race ladder · dormant jobs");
})();
