/* Memory Glass · kbatch fleet bridge (R4-data)
 * Surfaces kbatch.ugrad.ai axes + living-books links into LIVE RANK / CTRL.
 * Offline seed: hotpipe/data/kbatch-r4-axes.json (injected as window.__mgKbatchR4Seed if present).
 * VER: kbatch-fleet-v1-r4
 */
(function () {
  "use strict";
  var VER = "kbatch-fleet-v1-r4";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._kbatchFleetVer === VER) return;
  HP._kbatchFleetVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "kbatch-fleet");
    } catch (e) {}
  }

  /* Embedded snapshot (keep in sync with data/kbatch-r4-axes.json) */
  var SEED = {
    ver: "kbatch-r4-data-2026-07-18",
    rung: "R4-data",
    smoke: { pass: 50, fail: 0 },
    metrics: {
      d5Glosses: 6199,
      senseEntries: 6202,
      worldAnalyzedLangs: 32,
      worldAnalyzedWordsApprox: 775000,
    },
    axes: {
      dictionaries: { score: 0.88, dial: "D5-bulk-R4" },
      schools: { score: 0.8, dial: "S2-live" },
      museums: { score: 0.76, dial: "M3-live" },
      typing: { score: 0.77, dial: "T2-live" },
      music: { score: 0.75, dial: "R3-live" },
    },
    links: {
      home: "https://kbatch.ugrad.ai/",
      livingBooks: "https://kbatch.ugrad.ai/labs/living-books.html",
      learn: "https://kbatch.ugrad.ai/learn",
      dojo: "https://kbatch.ugrad.ai/dojo/",
      milestone: "https://kbatch.ugrad.ai/docs/MILESTONE-R4-DATA.md",
    },
  };

  var state = {
    seed: SEED,
    live: null,
    lastFetch: 0,
  };

  if (window.__mgKbatchR4Seed && typeof window.__mgKbatchR4Seed === "object") {
    try {
      state.seed = Object.assign({}, SEED, window.__mgKbatchR4Seed);
    } catch (eS) {}
  }

  function snap() {
    return state.live || state.seed;
  }

  function minAxis(s) {
    s = s || snap();
    var axes = s.axes || {};
    var min = 1;
    Object.keys(axes).forEach(function (k) {
      var v = axes[k] && axes[k].score;
      if (typeof v === "number" && v < min) min = v;
    });
    return min;
  }

  function report() {
    var s = snap();
    var a = s.axes || {};
    return (
      VER +
      " · " +
      (s.rung || "?") +
      " · D5 " +
      ((s.metrics && s.metrics.d5Glosses) || "?") +
      " · langs " +
      ((s.metrics && s.metrics.worldAnalyzedLangs) || "?") +
      " · dict " +
      (a.dictionaries ? a.dictionaries.score : "?") +
      " · minAxis " +
      minAxis(s).toFixed(2) +
      " · smoke " +
      (s.smoke ? s.smoke.pass + "/" + (s.smoke.pass + s.smoke.fail) : "?")
    );
  }

  function synopsisLine() {
    var s = snap();
    var m = s.metrics || {};
    return (
      "kbatch " +
      (s.rung || "R4") +
      " · glosses " +
      (m.d5Glosses || "—") +
      " · senses " +
      (m.senseEntries || "—") +
      " · " +
      (m.worldAnalyzedLangs || "—") +
      " langs · axes≥" +
      minAxis(s).toFixed(2)
    );
  }

  function nav(url) {
    try {
      if (window.ipc)
        window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
      else window.open(url, "_blank");
    } catch (e) {
      try {
        window.open(url, "_blank");
      } catch (e2) {}
    }
  }

  function openLivingBooks() {
    nav((snap().links && snap().links.livingBooks) || SEED.links.livingBooks);
  }
  function openLearn() {
    nav((snap().links && snap().links.learn) || SEED.links.learn);
  }
  function openDojo() {
    nav((snap().links && snap().links.dojo) || SEED.links.dojo);
  }
  function openHome() {
    nav((snap().links && snap().links.home) || SEED.links.home);
  }

  /** Optional live scrape when already on kbatch.ugrad.ai */
  function scrapeLive() {
    try {
      if (!/kbatch\.ugrad\.ai$/i.test(location.hostname || "")) return null;
      var meta = {};
      document.querySelectorAll("meta[name^='kbatch-']").forEach(function (m) {
        meta[m.getAttribute("name")] = m.getAttribute("content");
      });
      if (!meta["kbatch-version"] && !meta["kbatch-product"]) return null;
      state.live = Object.assign({}, state.seed, {
        kbatchVersion: meta["kbatch-version"] || state.seed.kbatchVersion,
        product: meta["kbatch-product"] || state.seed.product,
        scrapedAt: Date.now(),
        host: location.hostname,
      });
      state.lastFetch = Date.now();
      return state.live;
    } catch (e) {
      return null;
    }
  }

  setTimeout(scrapeLive, 600);
  setInterval(scrapeLive, 15000);

  window.__mgKbatchFleet = {
    ver: VER,
    snap: snap,
    report: report,
    synopsis: synopsisLine,
    minAxis: minAxis,
    openLivingBooks: openLivingBooks,
    openLearn: openLearn,
    openDojo: openDojo,
    openHome: openHome,
    scrapeLive: scrapeLive,
  };

  log(VER + " · " + report());
})();
