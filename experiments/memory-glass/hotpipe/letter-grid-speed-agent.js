/* Memory Glass · Letter-Grid laptop speed agent
 * Forces one timed agent round when on declaration letter-grid.
 * VER: lg-speed-v1
 */
(function () {
  "use strict";
  var VER = "lg-speed-v1";
  if (window.__mgLgSpeedAgentVer === VER) return;
  window.__mgLgSpeedAgentVer = VER;
  try {
    if (!/letter-grid/i.test(location.href || location.pathname || "")) return;
  } catch (e0) {
    return;
  }
  if (window.__mgLgSpeedRunning) return;
  window.__mgLgSpeedRunning = true;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "lg-speed");
    } catch (e) {}
    try {
      console.info("[lg-speed]", m);
    } catch (e2) {}
  }

  function postReport(rep, source) {
    var body = {
      kind: "letter_grid_score_report",
      ver: VER,
      source: source || "mg-inject",
      href: (location.href || "").slice(0, 200),
      machine: {
        model: "MacBookPro16,1",
        arch: "x86_64",
        class: "older-intel-laptop",
        host: "qbits-MacBook-Pro.local",
      },
      report: rep,
    };
    try {
      fetch("http://127.0.0.1:9880/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        mode: "cors",
      }).catch(function () {});
    } catch (e) {}
    try {
      if (window.ipc)
        window.ipc.postMessage(
          JSON.stringify({
            op: "smoke_probe",
            json: JSON.stringify({
              letterGridSpeed: true,
              peakBps: rep && (rep.peakBps || (rep.metrics && rep.metrics.peakBps)),
              peakNtpm: rep && (rep.peakNtpm || (rep.metrics && rep.metrics.peakNtpm)),
              metrics: rep && rep.metrics,
              hopMs: rep && rep.hopMs,
              grid: rep && rep.grid,
              title: rep && rep.title,
              live: rep && rep.live,
            }),
          })
        );
    } catch (e2) {}
  }

  function hopFromUrl() {
    try {
      var m = /[?&]hop=(\d+)/i.exec(location.search || "");
      if (m) return Math.max(1, parseInt(m[1], 10));
      var p = /[?&]pace=(\d+)/i.exec(location.search || "");
      if (p) return Math.max(1, parseInt(p[1], 10));
    } catch (e) {}
    return 16; /* laptop turbo-ish */
  }

  function run() {
    var api =
      window.__letterGridApi ||
      window.__mgLetterGridApi ||
      window.letterGrid ||
      null;
    if (!api) {
      setTimeout(run, 400);
      return;
    }
    var hop = hopFromUrl();
    log("api ready · hop=" + hop + "ms · agent timed round");
    var p;
    try {
      if (typeof api.playRound === "function") {
        p = api.playRound({ size: 12, hopMs: hop, agent: true });
      } else if (typeof api.agentPlay === "function") {
        p = api.agentPlay({ paceMs: hop });
      } else {
        log("no playRound/agentPlay on api");
        return;
      }
    } catch (e) {
      log("start fail " + e);
      return;
    }
    Promise.resolve(p)
      .then(function (res) {
        var rep = (res && res.report) || res || {};
        if (!rep.peakBps && res && res.metrics) rep = res;
        log(
          "done peak " +
            (rep.peakBps != null ? rep.peakBps : "?") +
            " BPS / " +
            (rep.peakNtpm != null ? rep.peakNtpm : "?") +
            " NTPM"
        );
        postReport(rep, "playRound");
        window.__mgLgSpeedLast = rep;
      })
      .catch(function (e) {
        log("agent err " + e);
      });
  }

  /* wait for mount (data fetch) */
  setTimeout(run, 800);
})();
