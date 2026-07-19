/* Auto-mitigation: popup / dialog flood / blank-target spam */
(function () {
  try {
    if (window.__mgGtFlow && window.__mgGtFlow.setPopupEnabled) {
      window.__mgGtFlow.setPopupEnabled(true);
      if (window.__mgDevLog) {
        window.__mgDevLog(
          "ok",
          "Mitigation popup_guard: GT flow popup guard ON",
          "mitigation"
        );
      }
      return;
    }
    /* Lightweight fallback if gt-flow-plane not injected yet */
    if (!window.__mgPopupMitigFallback) {
      window.__mgPopupMitigFallback = true;
      var orig = window.open;
      var n = 0;
      window.open = function (url) {
        n++;
        if (n > 2) {
          try {
            if (window.__mgDevLog)
              window.__mgDevLog(
                "warn",
                "popup_guard fallback block · " + String(url || "").slice(0, 64),
                "mitigation"
              );
          } catch (eL) {}
          return null;
        }
        return orig.apply(window, arguments);
      };
    }
    if (window.__mgDevLog) {
      window.__mgDevLog(
        "ok",
        "Mitigation popup_guard: fallback open-hook installed",
        "mitigation"
      );
    }
  } catch (e) {
    try {
      if (window.__mgDevLog)
        window.__mgDevLog(
          "err",
          "popup_guard mitigation failed · " + e,
          "mitigation"
        );
    } catch (e2) {}
  }
})();
