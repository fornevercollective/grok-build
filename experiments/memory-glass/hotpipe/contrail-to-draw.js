/* Memory Glass · contrail path → on-screen DRAW (Procreate-style stroke)
 * MAIN only. Loads after WebGrid play; paints last contrail path as ink.
 * VER: contrail-to-draw-v1
 */
(function () {
  "use strict";
  var VER = "contrail-to-draw-v1";
  if (window.__mgContrailDrawVer === VER) return;
  window.__mgContrailDrawVer = VER;

  function isInspect() {
    try {
      return !!(
        document.getElementById("pip-wrap") ||
        document.documentElement.classList.contains("mg-inspect-host")
      );
    } catch (e) {
      return false;
    }
  }
  if (isInspect()) return;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "ctdraw");
    } catch (e) {}
  }

  function getPathPts() {
    var C = window.__mgContrail;
    if (!C) return [];
    var raw = null;
    try {
      /* Live path array is on the API object */
      if (C.path && C.path.length) raw = C.path.slice();
      else if (typeof C.getPath === "function") raw = C.getPath();
      else if (C.exportPath) raw = C.exportPath();
    } catch (e) {}
    if (!raw || !raw.length) {
      try {
        if (C.exportStoryBeats) {
          var beats = C.exportStoryBeats();
          if (beats && beats.length) {
            raw = beats;
          }
        }
      } catch (e2) {}
    }
    if (!raw || !raw.length) return [];
    var W = window.innerWidth || 1280;
    var H = window.innerHeight || 800;
    return raw
      .map(function (p) {
        if (!p) return null;
        var x = p.x != null ? p.x : p.nx != null ? p.nx : null;
        var y = p.y != null ? p.y : p.ny != null ? p.ny : null;
        if (x == null || y == null) return null;
        /* client coords usually already in CSS px; nx/ny 0–1 */
        if (p.nx != null || p.ny != null || (x >= 0 && x <= 1 && y >= 0 && y <= 1)) {
          if (x <= 1.01 && y <= 1.01) {
            x = x * W;
            y = y * H;
          }
        }
        return { x: x, y: y };
      })
      .filter(Boolean);
  }

  function ensureCanvas() {
    var old = document.getElementById("mg-contrail-draw");
    if (old) old.remove();
    var cv = document.createElement("canvas");
    cv.id = "mg-contrail-draw";
    cv.width = window.innerWidth || 1280;
    cv.height = window.innerHeight || 800;
    cv.style.cssText =
      "position:fixed;inset:0;z-index:2147482900;pointer-events:none;width:100%;height:100%";
    document.documentElement.appendChild(cv);
    return cv;
  }

  function strokePencil(ctx, pts, color) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    for (var i = 0; i < pts.length; i++) {
      var t = i / (pts.length - 1);
      var pr = 0.3 + 0.7 * Math.pow(Math.sin(Math.PI * t), 0.55);
      var r = 2.2 * pr;
      ctx.beginPath();
      ctx.fillStyle = color || "rgba(248,113,113,0.85)";
      ctx.globalAlpha = 0.5 + 0.4 * pr;
      ctx.arc(pts[i].x, pts[i].y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    /* single tip */
    var tip = pts[pts.length - 1];
    var g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 8);
    g.addColorStop(0, "rgba(254,202,202,0.95)");
    g.addColorStop(1, "rgba(248,113,113,0)");
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.fillStyle = g;
    ctx.arc(tip.x, tip.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function paintOnce() {
    var pts = getPathPts();
    var cv = ensureCanvas();
    var ctx = cv.getContext("2d");
    if (!ctx) return { ok: false, n: 0 };
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (pts.length < 2) {
      log(VER + " · no contrail path yet n=" + pts.length);
      return { ok: false, n: pts.length };
    }
    strokePencil(ctx, pts, "rgba(248,113,113,0.9)");
    /* secondary cool ghost of last half */
    if (pts.length > 20) {
      strokePencil(ctx, pts.slice(Math.floor(pts.length / 2)), "rgba(147,197,253,0.75)");
    }
    log(VER + " · drew contrail ink pts=" + pts.length);
    return { ok: true, n: pts.length };
  }

  function animateDraw() {
    var pts = getPathPts();
    if (pts.length < 2) {
      log(VER + " · wait path");
      return false;
    }
    var cv = ensureCanvas();
    var ctx = cv.getContext("2d");
    var i = 2;
    function frame() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      strokePencil(ctx, pts.slice(0, i), "rgba(248,113,113,0.9)");
      i += Math.max(1, Math.floor(pts.length / 80));
      if (i < pts.length) requestAnimationFrame(frame);
      else {
        strokePencil(ctx, pts, "rgba(248,113,113,0.9)");
        log(VER + " · playback done n=" + pts.length);
      }
    }
    requestAnimationFrame(frame);
    return true;
  }

  function openFloats() {
    try {
      document.documentElement.classList.add("mg-lab-floats");
      if (window.__mgLazy && window.__mgLazy.need) {
        window.__mgLazy.need("contrail", function () {
          try {
            if (window.__mgContrail) {
              if (window.__mgContrail.setOverlay) window.__mgContrail.setOverlay(true);
              if (window.__mgContrail.setFlow) window.__mgContrail.setFlow(true);
              if (window.__mgContrail.open) window.__mgContrail.open();
            }
          } catch (e) {}
        });
        window.__mgLazy.need("maze", function () {
          try {
            if (window.__mgMemoryMaze && window.__mgMemoryMaze.open)
              window.__mgMemoryMaze.open();
          } catch (e) {}
        });
      } else {
        if (window.__mgContrail) {
          if (window.__mgContrail.setOverlay) window.__mgContrail.setOverlay(true);
          if (window.__mgContrail.setFlow) window.__mgContrail.setFlow(true);
          if (window.__mgContrail.open) window.__mgContrail.open();
        }
        if (window.__mgMemoryMaze && window.__mgMemoryMaze.open)
          window.__mgMemoryMaze.open();
      }
    } catch (e) {
      log("openFloats err " + e);
    }
  }

  window.__mgContrailDraw = {
    ver: VER,
    paint: paintOnce,
    animate: animateDraw,
    openFloats: openFloats,
    getPathPts: getPathPts,
  };

  /* On WebGrid: open floats soon; after play settles, try ink */
  openFloats();
  setTimeout(openFloats, 2000);
  setTimeout(openFloats, 5000);
  log(VER + " ready · call __mgContrailDraw.animate() after play");
})();
