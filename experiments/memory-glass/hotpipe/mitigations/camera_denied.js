/* Auto-mitigation: camera NotAllowedError — once per page, no spam prefs */
(function () {
  try {
    if (window.__mgMitigCamDone) return;
    window.__mgMitigCamDone = true;
    var tb = document.getElementById("mg-track-toggle");
    if (tb) {
      tb.classList.remove("on");
      tb.title = "Camera denied — System Settings › Privacy › Camera › Memory Glass, then Cam track";
    }
    /* Soft fallback: pointer viewRay */
    try {
      if (window.LabViewRay) window.LabViewRay.source = "pointer";
    } catch (e0) {}
    if (window.__mgDevLog) {
      window.__mgDevLog(
        "ok",
        "Mitigation camera_denied: pointer fallback · enable Camera in System Settings then Cam track",
        "mitigation"
      );
    }
  } catch (e) {}
})();
