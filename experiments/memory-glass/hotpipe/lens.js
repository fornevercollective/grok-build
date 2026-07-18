/* Memory Glass · lens / FOV / anamorphic geometry
 * Inject after live.js. Fixes still-pipe + PIP object-fit:cover mapping
 * and phone vs 2019 MBP depth scaling.
 * VER: lens-v1
 */
(function () {
  "use strict";
  var L = (window.__mgLens = window.__mgLens || {});
  L.VER = "lens-v2";

  /**
   * Profiles — approximate horizontal FOV (deg) + anamorphic squeeze (1 = square pixels).
   * anamorphicX: multiply X extents ( >1 = de-squeeze wide cinema plate )
   */
  L.PROFILES = {
    auto: { label: "auto", hfov: null, anamorphicX: 1, depthGain: 1 },
    phone_still_portrait: {
      label: "phone still (portrait)",
      hfov: 70,
      anamorphicX: 1,
      depthGain: 1.28, /* head pan / z more readable off phone still-pipe */
    },
    iphone12_main: {
      label: "iPhone 12 main ~26mm",
      hfov: 65,
      anamorphicX: 1,
      depthGain: 1.2,
    },
    iphone12_uw: {
      label: "iPhone 12 ultra-wide",
      hfov: 120,
      anamorphicX: 1,
      depthGain: 1.55,
    },
    phone_anamorphic_1_33: {
      label: "phone + 1.33x anamorphic",
      hfov: 80,
      anamorphicX: 1.33,
      depthGain: 1.25,
    },
    phone_anamorphic_2: {
      label: "phone + 2x anamorphic",
      hfov: 90,
      anamorphicX: 2.0,
      depthGain: 1.35,
    },
    mbp2019_facetime: {
      label: "2019 MBP Touch Bar FaceTime",
      hfov: 78,
      anamorphicX: 1,
      depthGain: 0.95,
    },
  };

  L.state = {
    profile: "auto",
    srcW: 720,
    srcH: 960,
    /* Drawing mirror: false when PIP CSS already scaleX(-1) — avoids double flip */
    mirror: false,
    objectPositionY: 0.28, /* match pip-stream object-position center 28% */
    lastDiag: null,
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  L.detectProfile = function (w, h) {
    if (!w || !h) return "auto";
    var ar = w / h;
    if (ar < 0.85) return "phone_still_portrait"; /* 3:4 / 9:16 */
    if (ar > 1.5 && ar < 1.9) return "mbp2019_facetime"; /* ~16:9–16:10 laptop */
    if (ar >= 0.95 && ar <= 1.1) return "iphone12_main";
    return "auto";
  };

  L.setSourceSize = function (w, h) {
    L.state.srcW = w || L.state.srcW;
    L.state.srcH = h || L.state.srcH;
    if (L.state.profile === "auto" || !L.state.profileLocked) {
      L.state.profile = L.detectProfile(L.state.srcW, L.state.srcH);
    }
  };

  L.getProfile = function () {
    return L.PROFILES[L.state.profile] || L.PROFILES.auto;
  };

  /**
   * Map normalized landmark (0–1 source image) → overlay pixel under object-fit:cover.
   * object-position: center X, Y fraction from top (0–1) like CSS object-position.
   */
  L.mapCover = function (nx, ny, dstW, dstH, opt) {
    opt = opt || {};
    var sw = opt.srcW || L.state.srcW || 1;
    var sh = opt.srcH || L.state.srcH || 1;
    var mirror = opt.mirror != null ? opt.mirror : L.state.mirror;
    var posY = opt.objectPositionY != null ? opt.objectPositionY : L.state.objectPositionY;
    var posX = opt.objectPositionX != null ? opt.objectPositionX : 0.5;
    var prof = L.getProfile();
    var ax = (opt.anamorphicX != null ? opt.anamorphicX : prof.anamorphicX) || 1;

    /* de-squeeze anamorphic in source norm space around center */
    var cx = 0.5,
      cy = 0.5;
    var ux = cx + (nx - cx) * ax;
    var uy = ny;
    if (mirror) ux = 1 - ux;

    var scale = Math.max(dstW / sw, dstH / sh);
    var dw = sw * scale;
    var dh = sh * scale;
    /* object-position: fraction of overflow */
    var ox = (dstW - dw) * posX;
    var oy = (dstH - dh) * posY;
    return {
      x: ox + ux * dw,
      y: oy + uy * dh,
      scale: scale,
      ax: ax,
      profile: L.state.profile,
    };
  };

  /** Depth gain from face IOD / box size relative to profile FOV */
  L.depthScale = function (faceFrac) {
    var prof = L.getProfile();
    var g = prof.depthGain || 1;
    /* small face in ultra-wide → more depth exaggeration for HUD */
    if (faceFrac > 0 && faceFrac < 0.06) g *= 1.25;
    if (faceFrac > 0.2) g *= 0.9;
    return g;
  };

  /** Mild far-hand target only (v22). live.js caps so close palms never go giant. */
  L.handTargetSpan = function () {
    var prof = L.getProfile();
    var base = 0.16;
    if (prof.hfov && prof.hfov > 90) return 0.18; /* UW: slightly more boost when tiny */
    if (L.state.profile === "phone_still_portrait") return 0.17;
    if (L.state.profile === "iphone12_uw") return 0.18;
    if (L.state.profile === "iphone12_main") return 0.16;
    if (L.state.profile === "mbp2019_facetime") return 0.15;
    return base;
  };

  L.diagnose = function (extra) {
    var p = L.getProfile();
    var ar = L.state.srcW / Math.max(1, L.state.srcH);
    var d = {
      ver: L.VER,
      ts: new Date().toISOString(),
      srcW: L.state.srcW,
      srcH: L.state.srcH,
      aspect: +ar.toFixed(4),
      profile: L.state.profile,
      profileLabel: p.label,
      hfov: p.hfov,
      anamorphicX: p.anamorphicX,
      depthGain: p.depthGain,
      handTargetSpan: L.handTargetSpan(),
      mirror: L.state.mirror,
      cover: "object-fit:cover + object-position center " + Math.round(L.state.objectPositionY * 100) + "%",
      notes: [],
    };
    if (ar < 0.9) {
      d.notes.push("Portrait still-pipe (typical phone) — PIP 16:10 cover crops top/bottom heavily");
    }
    if (ar > 1.4) {
      d.notes.push("Landscape source (laptop FaceTime / Continuity) — different crop than phone portrait");
    }
    if (p.anamorphicX > 1.01) {
      d.notes.push("Anamorphic de-squeeze ×" + p.anamorphicX + " applied on X around center");
    }
    d.notes.push("2019 MBP Touch Bar FaceTime ~78° HFOV landscape; iPhone 12 main ~65°, UW ~120°");
    d.notes.push("Hand IK uses FOV span boost + cover-correct map when __mgLens active");
    if (extra) {
      for (var k in extra) d[k] = extra[k];
    }
    L.state.lastDiag = d;
    try {
      window.__mgDevLog &&
        window.__mgDevLog(
          "ok",
          "lens-v2 " + d.profile + " ar=" + d.aspect + " span=" + d.handTargetSpan + " depthG=" + d.depthGain,
          "lens"
        );
    } catch (e) {}
    return d;
  };

  /* Export for live.js hand + mesh paths */
  window.__mgMapCover = L.mapCover.bind(L);
  window.__mgLensDiag = L.diagnose.bind(L);
  window.__mgSetLensProfile = function (name) {
    if (L.PROFILES[name]) {
      L.state.profile = name;
      L.state.profileLocked = name !== "auto";
      return L.diagnose();
    }
    return null;
  };

  try {
    if (window.__mgDevLog) window.__mgDevLog("ok", "lens-v2 geometry · phone hand span + head pan gain", "lens");
  } catch (e2) {}
})();
