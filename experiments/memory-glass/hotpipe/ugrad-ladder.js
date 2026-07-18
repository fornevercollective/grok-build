/* Memory Glass · μgrad U0–U6 ladder + WebGrid BPS training curve
 * Links: https://mueee.qbitos.ai/ugrad-r0.html · neuralink.com/webgrid · games hub
 * Speed: no heavy training in PAGE; opens tabs / tracks pointer BPS only.
 */
(function () {
  "use strict";
  var VER = "ugrad-ladder-v2-webgrid-tensor";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._ugradVer === VER) return;
  HP._ugradVer = VER;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "info", String(m || ""), "ugrad");
    } catch (e) {}
  }

  var BASES = {
    mueee: "https://mueee.qbitos.ai",
    webgridOfficial: "https://neuralink.com/webgrid/",
  };

  var LEVELS = [
    { u: 0, name: "micrograd", url: "/ugrad-r0.html", done: true },
    { u: 1, name: "microtorch", url: "/ugrad-r0.html#tensor", done: true },
    { u: 2, name: "minitorch", url: "/ugrad-r0.html", done: true },
    { u: 3, name: "μtorch", url: "/ugrad-model-lab.html", done: true },
    { u: 4, name: "μformer", url: "/ugrad-r0.html#gpt", done: true },
    { u: 5, name: "μcortical", url: "/ugrad-r0.html#ironline", done: false },
    { u: 6, name: "μorganoid", url: "/ugrad-r0.html#level", done: false },
  ];

  var state = {
    ver: VER,
    level: 0,
    bps: { hits: 0, misses: 0, grid: 8, sessionMs: 0, lastBps: 0, ntpm: 0 },
    gridTargets: [],
    gridActive: false,
  };

  function abs(path) {
    if (/^https?:/i.test(path)) return path;
    return BASES.mueee + path;
  }

  function openUrl(url, label) {
    var u = abs(url);
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(JSON.stringify({ op: "open_tab", url: u, title: label || "ugrad" }));
        return;
      }
    } catch (e) {}
    try {
      window.open(u, "_blank", "noopener");
    } catch (e2) {
      location.href = u;
    }
  }

  function openR0() {
    openUrl("/ugrad-r0.html", "μgrad R0");
  }
  function openWebGrid() {
    openUrl(BASES.webgridOfficial, "WebGrid");
  }
  function openWebGridUgrad() {
    openUrl("/webgrid-ugrad.html", "WebGrid μgrad");
  }
  function openGames() {
    openUrl("/games-ugrad-hub.html", "μgrad games");
  }
  function openKBatch(path) {
    var p = path || "/";
    if (p.charAt(0) !== "/" && !/^https?:/i.test(p)) p = "/" + p;
    var u = /^https?:/i.test(p) ? p : "https://kbatch.ugrad.ai" + p;
    openUrl(u, "KBatch");
  }
  function openLevel(u) {
    var L = LEVELS[Math.max(0, Math.min(6, u | 0))];
    state.level = L.u;
    openUrl(L.url, "U" + L.u + " " + L.name);
  }

  /* ── Lightweight WebGrid-style BPS meter (inspect canvas training) ── */
  function bpsFrom(hits, misses, grid, minutes) {
    var n = Math.max(1, hits - misses);
    var ntpm = minutes > 0 ? n / minutes : 0;
    /* rough info bits ≈ log2(grid²) per correct target (simplified Fitts-ish) */
    var bitsPer = Math.log(Math.max(4, grid * grid)) / Math.LN2;
    return { ntpm: ntpm, bps: (ntpm * bitsPer) / 60, bitsPer: bitsPer };
  }

  var bpsT0 = Date.now();
  function noteHit(ok) {
    if (ok) state.bps.hits++;
    else state.bps.misses++;
    state.bps.sessionMs = Date.now() - bpsT0;
    var mins = Math.max(1 / 60, state.bps.sessionMs / 60000);
    var r = bpsFrom(state.bps.hits, state.bps.misses, state.bps.grid, mins);
    state.bps.ntpm = r.ntpm;
    state.bps.lastBps = r.bps;
    try {
      if (window.__mgIronline) window.__mgIronline.tick("L7", 2);
    } catch (e) {}
    try {
      if (window.__mgMesh && window.__mgMesh.broadcast) {
        window.__mgMesh.broadcast("bps", {
          bps: +state.bps.lastBps.toFixed(3),
          hits: state.bps.hits,
          misses: state.bps.misses,
        });
      }
    } catch (e2) {}
  }

  /* Click training: any inspect click on #stage counts toward curve when armed */
  function armGridTraining(on) {
    state.gridActive = !!on;
    if (!on) return;
    bpsT0 = Date.now();
    state.bps.hits = 0;
    state.bps.misses = 0;
  }

  document.addEventListener(
    "click",
    function (ev) {
      if (!state.gridActive) return;
      var t = ev.target;
      if (!t || !t.closest) return;
      /* hit if inside pip / gsplat / stage; miss if chrome only */
      var hit = !!(t.closest("#pip-wrap") || t.closest("#stage") || t.closest("canvas"));
      noteHit(hit);
    },
    true
  );

  function report() {
    return (
      "U" +
      state.level +
      " · bps " +
      state.bps.lastBps.toFixed(2) +
      " · h/m " +
      state.bps.hits +
      "/" +
      state.bps.misses +
      (state.gridActive ? " · TRAIN" : "")
    );
  }

  window.__mgUgrad = {
    ver: VER,
    levels: LEVELS,
    state: state,
    openR0: openR0,
    openWebGrid: openWebGrid,
    openWebGridUgrad: openWebGridUgrad,
    openGames: openGames,
    openKBatch: openKBatch,
    openLevel: openLevel,
    armGridTraining: armGridTraining,
    noteHit: noteHit,
    report: report,
    bases: BASES,
    /** IBM Quantum Composer (paste QASM from __mgUgradWebgrid) */
    openQuantumComposer: function () {
      openUrl("https://quantum.ibm.com/composer", "IBM Composer");
    },
    /** Export last WebGrid circuit if tensor module loaded */
    exportWebgridQasm: function () {
      try {
        if (window.__mgUgradWebgrid) return window.__mgUgradWebgrid.downloadQasm();
      } catch (e) {}
      return false;
    },
    webgridTensor: null, /* filled by ugrad-webgrid-tensor.js */
  };

  log("ok", "ugrad-ladder-v2 · U0–U6 · WebGrid tensor · IBM composer");
})();
