/* Memory Glass · lens / FOV / anamorphic geometry
 * Inject after live.js. Fixes still-pipe + PIP object-fit:cover mapping
 * so IK / MoCap land on the *viewable* crop in the inspect PIP (not full JPEG stretch).
 * VER: lens-v3-cover-measure
 */
(function () {
  "use strict";
  var L = (window.__mgLens = window.__mgLens || {});
  L.VER = "lens-v3-cover-measure";

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
      depthGain: 1.28,
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
    phone_still_landscape: {
      label: "phone still (landscape / wide)",
      hfov: 72,
      anamorphicX: 1,
      depthGain: 1.15,
    },
  };

  L.state = {
    profile: "auto",
    srcW: 720,
    srcH: 960,
    /* Drawing mirror: false when PIP CSS already scaleX(-1) — avoids double flip */
    mirror: false,
    objectPositionX: 0.5,
    objectPositionY: 0.42, /* match pip-stream object-position center 42% — more torso when seated */
    objectFit: "cover",
    lastMeasure: null,
    lastDiag: null,
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function parsePosToken(tok, axisSize) {
    tok = String(tok || "").trim().toLowerCase();
    if (!tok || tok === "center") return 0.5;
    if (tok === "left" || tok === "top") return 0;
    if (tok === "right" || tok === "bottom") return 1;
    if (tok.endsWith("%")) return clamp(parseFloat(tok) / 100, 0, 1);
    if (tok.endsWith("px") && axisSize > 0) return clamp(parseFloat(tok) / axisSize, 0, 1);
    var n = parseFloat(tok);
    if (!isNaN(n)) return clamp(n > 1 ? n / 100 : n, 0, 1);
    return 0.5;
  }

  function parseObjectPosition(str) {
    var parts = String(str || "50% 50%")
      .trim()
      .split(/\s+/);
    if (parts.length === 1) {
      return { x: parsePosToken(parts[0], 1), y: 0.5 };
    }
    return {
      x: parsePosToken(parts[0], 1),
      y: parsePosToken(parts[1], 1),
    };
  }

  L.detectProfile = function (w, h) {
    if (!w || !h) return "auto";
    var ar = w / h;
    if (ar < 0.85) return "phone_still_portrait";
    if (ar > 1.15 && ar < 1.45) return "phone_still_landscape";
    if (ar > 1.5 && ar < 1.9) return "mbp2019_facetime";
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
   * Measure how #pip-stream is actually painted inside the inspect PIP.
   * Source of truth for MoCap / IK alignment (cover crop + object-position).
   */
  L.measurePip = function (dstW, dstH) {
    var img = null;
    var wrap = null;
    try {
      img = document.getElementById("pip-stream");
      wrap = document.getElementById("pip-wrap");
    } catch (e0) {}

    var sw = L.state.srcW || 720;
    var sh = L.state.srcH || 960;
    if (img) {
      var nw = img.naturalWidth || img.videoWidth || 0;
      var nh = img.naturalHeight || img.videoHeight || 0;
      if (nw > 2 && nh > 2) {
        sw = nw;
        sh = nh;
        L.setSourceSize(sw, sh);
      }
    }

    var fit = L.state.objectFit || "cover";
    var posX = L.state.objectPositionX != null ? L.state.objectPositionX : 0.5;
    var posY = L.state.objectPositionY != null ? L.state.objectPositionY : 0.42;

    try {
      if (img) {
        var cs = window.getComputedStyle(img);
        if (cs.objectFit) fit = cs.objectFit;
        if (cs.objectPosition) {
          var pp = parseObjectPosition(cs.objectPosition);
          posX = pp.x;
          posY = pp.y;
        }
      }
    } catch (eCs) {}

    /* Prefer live layout box over canvas attrs (canvas can lag one frame) */
    if (wrap) {
      var rw = wrap.clientWidth;
      var rh = wrap.clientHeight;
      if (rw > 2) dstW = rw;
      if (rh > 2) dstH = rh;
    }
    dstW = Math.max(2, dstW || 360);
    dstH = Math.max(2, dstH || 220);

    var scale =
      fit === "contain"
        ? Math.min(dstW / sw, dstH / sh)
        : Math.max(dstW / sw, dstH / sh); /* cover + default */
    if (!isFinite(scale) || scale <= 0) scale = 1;
    var dw = sw * scale;
    var dh = sh * scale;
    /* CSS object-position: offset = (container - object) * percentage */
    var ox = (dstW - dw) * posX;
    var oy = (dstH - dh) * posY;

    var m = {
      sw: sw,
      sh: sh,
      dstW: dstW,
      dstH: dstH,
      fit: fit,
      posX: posX,
      posY: posY,
      scale: scale,
      dw: dw,
      dh: dh,
      ox: ox,
      oy: oy,
      ar: sw / Math.max(1, sh),
      cropX: Math.max(0, (dw - dstW) / dw), /* fraction of source width cropped */
      cropY: Math.max(0, (dh - dstH) / dh),
    };
    L.state.lastMeasure = m;
    L.state.objectFit = fit;
    L.state.objectPositionX = posX;
    L.state.objectPositionY = posY;
    return m;
  };

  /**
   * Map normalized landmark (0–1 source JPEG) → overlay pixel under the
   * *actual* PIP paint (object-fit cover/contain + object-position).
   */
  L.mapCover = function (nx, ny, dstW, dstH, opt) {
    opt = opt || {};
    var m =
      opt.measure ||
      L.measurePip(dstW, dstH);
    /* allow opt to override measure fields */
    var sw = opt.srcW || m.sw;
    var sh = opt.srcH || m.sh;
    var fit = opt.objectFit || m.fit || "cover";
    var posX = opt.objectPositionX != null ? opt.objectPositionX : m.posX;
    var posY = opt.objectPositionY != null ? opt.objectPositionY : m.posY;
    var mirror = opt.mirror != null ? opt.mirror : L.state.mirror;
    var prof = L.getProfile();
    var ax = (opt.anamorphicX != null ? opt.anamorphicX : prof.anamorphicX) || 1;

    /* de-squeeze anamorphic in source norm space around center */
    var ux = 0.5 + (nx - 0.5) * ax;
    var uy = ny;
    if (mirror) ux = 1 - ux;

    /* recompute if src override differs */
    if (opt.srcW || opt.srcH || opt.objectFit || opt.objectPositionY != null) {
      var scale =
        fit === "contain"
          ? Math.min(dstW / sw, dstH / sh)
          : Math.max(dstW / sw, dstH / sh);
      var dw = sw * scale;
      var dh = sh * scale;
      var ox = (dstW - dw) * posX;
      var oy = (dstH - dh) * posY;
      return {
        x: ox + ux * dw,
        y: oy + uy * dh,
        scale: scale,
        ax: ax,
        profile: L.state.profile,
        fit: fit,
        ox: ox,
        oy: oy,
        dw: dw,
        dh: dh,
      };
    }

    return {
      x: m.ox + ux * m.dw,
      y: m.oy + uy * m.dh,
      scale: m.scale,
      ax: ax,
      profile: L.state.profile,
      fit: m.fit,
      ox: m.ox,
      oy: m.oy,
      dw: m.dw,
      dh: m.dh,
      cropX: m.cropX,
      cropY: m.cropY,
    };
  };

  /** Depth gain from face IOD / box size relative to profile FOV */
  L.depthScale = function (faceFrac) {
    var prof = L.getProfile();
    var g = prof.depthGain || 1;
    if (faceFrac > 0 && faceFrac < 0.06) g *= 1.25;
    if (faceFrac > 0.2) g *= 0.9;
    return g;
  };

  /** Mild far-hand target only (v22). live.js caps so close palms never go giant. */
  L.handTargetSpan = function () {
    var prof = L.getProfile();
    var base = 0.16;
    if (prof.hfov && prof.hfov > 90) return 0.18;
    if (L.state.profile === "phone_still_portrait") return 0.17;
    if (L.state.profile === "phone_still_landscape") return 0.16;
    if (L.state.profile === "iphone12_uw") return 0.18;
    if (L.state.profile === "iphone12_main") return 0.16;
    if (L.state.profile === "mbp2019_facetime") return 0.15;
    return base;
  };

  L.diagnose = function (extra) {
    var p = L.getProfile();
    var m = L.measurePip(360, 220);
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
      fit: m.fit,
      objectPosition: Math.round(m.posX * 100) + "% " + Math.round(m.posY * 100) + "%",
      cropX: +(m.cropX * 100).toFixed(1) + "%",
      cropY: +(m.cropY * 100).toFixed(1) + "%",
      cover:
        "object-fit:" +
        m.fit +
        " + object-position " +
        Math.round(m.posX * 100) +
        "% " +
        Math.round(m.posY * 100) +
        "%",
      notes: [],
    };
    if (ar < 0.9) {
      d.notes.push(
        "Portrait still-pipe → landscape PIP cover crops top/bottom — mapCover uses live measure"
      );
    }
    if (ar > 1.15) {
      d.notes.push(
        "Landscape / wide still → PIP cover crops sides — IK must use cover map not stretch"
      );
    }
    if (m.cropX > 0.05 || m.cropY > 0.05) {
      d.notes.push(
        "Visible crop X=" +
          d.cropX +
          " Y=" +
          d.cropY +
          " — landmarks outside crop are off-screen (not mis-scaled)"
      );
    }
    d.notes.push("Body IK: no FOV norm-space boost (kept 1× so joints stick to cover crop)");
    if (extra) {
      for (var k in extra) d[k] = extra[k];
    }
    L.state.lastDiag = d;
    try {
      window.__mgDevLog &&
        window.__mgDevLog(
          "ok",
          "lens-v3 " +
            d.profile +
            " ar=" +
            d.aspect +
            " fit=" +
            d.fit +
            " crop=" +
            d.cropX +
            "/" +
            d.cropY,
          "lens"
        );
    } catch (e) {}
    return d;
  };

  /* Export for live.js hand + mesh + body/dog IK paths */
  window.__mgMapCover = L.mapCover.bind(L);
  window.__mgMeasurePip = L.measurePip.bind(L);
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
    if (window.__mgDevLog)
      window.__mgDevLog("ok", "lens-v3 cover-measure · PIP IK alignment", "lens");
  } catch (e2) {}
})();
