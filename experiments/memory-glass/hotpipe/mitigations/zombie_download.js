/* Auto-mitigation: zombie download / Preparing forever / star filename (Safari-class) */
(function () {
  try {
    function arm() {
      try {
        if (window.__mgJobHygiene && window.__mgJobHygiene.arm) {
          window.__mgJobHygiene.arm();
          window.__mgJobHygiene.sweep();
          if (window.__mgDevLog) {
            window.__mgDevLog(
              "ok",
              "Mitigation zombie_download: job hygiene armed + sweep",
              "mitigation"
            );
          }
          return true;
        }
      } catch (e) {}
      return false;
    }
    if (arm()) return;
    /* request hot module then arm */
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({ op: "hot_module", name: "job-hygiene.js", t: Date.now() })
        );
      }
    } catch (e2) {}
    var n = 0;
    var iv = setInterval(function () {
      n++;
      if (arm() || n > 20) clearInterval(iv);
    }, 100);
    if (window.__mgDevLog) {
      window.__mgDevLog(
        "ok",
        "Mitigation zombie_download: requested job-hygiene.js",
        "mitigation"
      );
    }
  } catch (e) {
    try {
      if (window.__mgDevLog)
        window.__mgDevLog(
          "err",
          "zombie_download mitigation failed · " + e,
          "mitigation"
        );
    } catch (e2) {}
  }
})();
