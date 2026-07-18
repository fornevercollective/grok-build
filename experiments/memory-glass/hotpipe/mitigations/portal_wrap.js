/* Auto-mitigation: portal wrap ReferenceError remnants */
(function () {
  try {
    var wrap = document.getElementById("mg-rx");
    var tog = document.getElementById("mg-rx-toggle");
    if (wrap && !wrap.__mgHotBound) {
      wrap.__mgHotBound = true;
      wrap.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.stopPropagation();
      });
      wrap.addEventListener("drop", function (e) {
        e.preventDefault();
        e.stopPropagation();
      });
    }
    if (window.__mgDevLog) {
      window.__mgDevLog("ok", "Mitigation portal_wrap: Rx drop targets rebound", "mitigation");
    }
    if (typeof window.__mgWireShellMenus === "function") window.__mgWireShellMenus();
  } catch (e) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("err", "portal_wrap mitigation failed · " + e, "mitigation");
    } catch (e2) {}
  }
})();
