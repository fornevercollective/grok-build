/* Memory Glass · full-body IK + pose estimation kit
 * MediaPipe Pose (BlazePose) on still-pipe · inspect only
 * Same iPhone cam-flip rule as hands: CSS scaleX(-1) already mirrors PIP —
 * landmarks stay in raw JPEG space (no double-mirror / inverted controller).
 * VER: body-pose-v1-full-ik
 */
(function () {
  "use strict";
  var VER = "body-pose-v1-full-ik";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  /* inspect only — main PAGE stays calm (no Pose CDN / no draw) */
  var isInspect = false;
  try {
    isInspect = !!document.getElementById("pip-wrap");
  } catch (eI) {}
  if (!isInspect) {
    window.__mgGetBodyPose = window.__mgGetBodyPose || function () {
      return null;
    };
    window.__mgGetBodyIk = window.__mgGetBodyIk || function () {
      return null;
    };
    return;
  }

  /* BlazePose 33 — major chains (torso + limbs; face points optional) */
  var POSE_CHAINS = [
    [11, 12], /* shoulders */
    [11, 13, 15], /* L arm */
    [12, 14, 16], /* R arm */
    [11, 23], /* L torso */
    [12, 24], /* R torso */
    [23, 24], /* hips */
    [23, 25, 27], /* L leg */
    [24, 26, 28], /* R leg */
    [15, 17, 19, 15, 21], /* L hand fan */
    [16, 18, 20, 16, 22], /* R hand fan */
    [27, 29, 31, 27], /* L foot */
    [28, 30, 32, 28], /* R foot */
    [11, 12, 24, 23, 11], /* torso loop */
  ];
  /* Named IK pivots */
  var PIVOTS = {
    nose: 0,
    lShoulder: 11,
    rShoulder: 12,
    lElbow: 13,
    rElbow: 14,
    lWrist: 15,
    rWrist: 16,
    lHip: 23,
    rHip: 24,
    lKnee: 25,
    rKnee: 26,
    lAnkle: 27,
    rAnkle: 28,
  };
  var CORE_IDX = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

  var state = (window.__mgBodyPose = window.__mgBodyPose || {
    ver: VER,
    present: false,
    landmarks: null,
    joints: null,
    bones: null,
    angles: null,
    conf: 0,
    engine: "none",
    coverage: "none", /* upper | full | none */
    midHip: null,
    midShoulder: null,
    rigS: 1,
    updatedAt: 0,
  });
  state.ver = VER;

  var ui = window.__mgCalibUiLive || window.__mgCalibUi || window.__mgCalibUI || {};
  function uiGet(k, d) {
    try {
      if (ui[k] != null) return ui[k];
    } catch (e) {}
    return d;
  }

  /* ── mirror: never double-flip when PIP CSS is selfie-mirrored ── */
  function mirrorDraw() {
    /* handLandmarkMirror true = explicit override to flip in JS */
    if (uiGet("handLandmarkMirror", false) === true) return true;
    if (uiGet("pipCssMirror", true) !== false) return false;
    return false;
  }

  function lmToPx(nx, ny, W, H) {
    var flip = mirrorDraw();
    try {
      if (typeof window.__mgMapCover === "function") {
        var m = window.__mgMapCover(nx, ny, W, H, {
          srcW: state._srcW || 720,
          srcH: state._srcH || 960,
          mirror: flip,
        });
        return { x: m.x, y: m.y };
      }
    } catch (eM) {}
    return { x: flip ? (1 - nx) * W : nx * W, y: ny * H };
  }

  function vis(p) {
    if (!p) return 0;
    if (p.visibility != null) return p.visibility;
    if (p.presence != null) return p.presence;
    return 1;
  }

  function jointOf(lm, i) {
    if (!lm || !lm[i]) return null;
    var p = lm[i];
    if (vis(p) < 0.25) return null;
    return { i: i, x: p.x, y: p.y, z: p.z || 0, v: vis(p) };
  }

  function dist(a, b) {
    if (!a || !b) return 0;
    var dx = a.x - b.x,
      dy = a.y - b.y,
      dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz * 0.35);
  }

  function angleAt(a, b, c) {
    /* degrees at b for points a-b-c */
    if (!a || !b || !c) return null;
    var bax = a.x - b.x,
      bay = a.y - b.y;
    var bcx = c.x - b.x,
      bcy = c.y - b.y;
    var dot = bax * bcx + bay * bcy;
    var na = Math.hypot(bax, bay),
      nc = Math.hypot(bcx, bcy);
    if (na < 1e-6 || nc < 1e-6) return null;
    var cos = Math.max(-1, Math.min(1, dot / (na * nc)));
    return (Math.acos(cos) * 180) / Math.PI;
  }

  /** Build named joints, bones, limb angles from 33 landmarks */
  function buildIk(lm) {
    if (!lm || lm.length < 25) return null;
    var joints = {};
    var names = Object.keys(PIVOTS);
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      joints[n] = jointOf(lm, PIVOTS[n]);
    }
    var bones = {
      lUpperArm: dist(joints.lShoulder, joints.lElbow),
      lForearm: dist(joints.lElbow, joints.lWrist),
      rUpperArm: dist(joints.rShoulder, joints.rElbow),
      rForearm: dist(joints.rElbow, joints.rWrist),
      lThigh: dist(joints.lHip, joints.lKnee),
      lShin: dist(joints.lKnee, joints.lAnkle),
      rThigh: dist(joints.rHip, joints.rKnee),
      rShin: dist(joints.rKnee, joints.rAnkle),
      shoulderWidth: dist(joints.lShoulder, joints.rShoulder),
      hipWidth: dist(joints.lHip, joints.rHip),
      torso: 0,
    };
    var midS = mid(joints.lShoulder, joints.rShoulder);
    var midH = mid(joints.lHip, joints.rHip);
    if (midS && midH) bones.torso = dist(midS, midH);

    var angles = {
      lElbow: angleAt(joints.lShoulder, joints.lElbow, joints.lWrist),
      rElbow: angleAt(joints.rShoulder, joints.rElbow, joints.rWrist),
      lKnee: angleAt(joints.lHip, joints.lKnee, joints.lAnkle),
      rKnee: angleAt(joints.rHip, joints.rKnee, joints.rAnkle),
      lShoulder: angleAt(joints.lHip || midH, joints.lShoulder, joints.lElbow),
      rShoulder: angleAt(joints.rHip || midH, joints.rShoulder, joints.rElbow),
      lHip: angleAt(joints.lShoulder || midS, joints.lHip, joints.lKnee),
      rHip: angleAt(joints.rShoulder || midS, joints.rHip, joints.rKnee),
    };

    var coreSeen = 0;
    for (var c = 0; c < CORE_IDX.length; c++) {
      if (jointOf(lm, CORE_IDX[c])) coreSeen++;
    }
    var lower =
      (joints.lHip || joints.rHip) && (joints.lKnee || joints.rKnee || joints.lAnkle || joints.rAnkle);
    var upper = joints.lShoulder || joints.rShoulder || joints.nose;
    var coverage = !upper ? "none" : lower ? "full" : "upper";

    return {
      joints: joints,
      bones: bones,
      angles: angles,
      midHip: midH,
      midShoulder: midS,
      coverage: coverage,
      conf: coreSeen / CORE_IDX.length,
    };
  }

  function mid(a, b) {
    if (a && b)
      return {
        x: (a.x + b.x) * 0.5,
        y: (a.y + b.y) * 0.5,
        z: ((a.z || 0) + (b.z || 0)) * 0.5,
        v: Math.min(a.v || 1, b.v || 1),
      };
    return a || b || null;
  }

  /** Mild FOV scale so far bodies aren't pin-dots (same spirit as hand FOV rig) */
  function bodyRig(lm) {
    var ik = buildIk(lm);
    if (!ik) return { s: 1, pcx: 0.5, pcy: 0.5 };
    var root = ik.midHip || ik.midShoulder || { x: 0.5, y: 0.5 };
    var span = ik.bones.shoulderWidth || 0.12;
    var target = 0.22;
    var s = 1;
    if (uiGet("bodyRigAuto", true) && span > 0.02 && span < target) {
      s = Math.min(1.55, target / span);
    }
    var manual = uiGet("bodyRigScale", 1);
    if (manual && manual !== 1) s *= manual;
    s = Math.max(0.85, Math.min(1.7, s));
    return { s: s, pcx: root.x, pcy: root.y, ik: ik };
  }

  function HP_pt(lm, i, rig, W, H) {
    var p = lm[i];
    if (!p || vis(p) < 0.22) return null;
    var nx = rig.pcx + (p.x - rig.pcx) * rig.s;
    var ny = rig.pcy + (p.y - rig.pcy) * rig.s;
    if (nx < -0.1) nx = -0.1;
    if (nx > 1.1) nx = 1.1;
    if (ny < -0.1) ny = -0.1;
    if (ny > 1.1) ny = 1.1;
    var px = lmToPx(nx, ny, W, H);
    return { x: px.x, y: px.y, nx: nx, ny: ny, z: p.z || 0, v: vis(p) };
  }

  function drawBody(ctx, W, H) {
    if (uiGet("showBody", true) === false) return;
    var lm = state.landmarks;
    if (!lm || !lm.length) {
      if (uiGet("showBody", true)) {
        ctx.fillStyle = "rgba(120,180,160," + (uiGet("bodyOpacity", 0.7) * 0.2).toFixed(2) + ")";
        ctx.font = "600 8px ui-monospace, Menlo, monospace";
        ctx.fillText("BODY · waiting (step back for full / raise torso)", 10, H - 24);
      }
      return;
    }
    var a = uiGet("bodyOpacity", 0.7);
    var rig = bodyRig(lm);
    var ik = rig.ik || buildIk(lm);
    state.rigS = rig.s;
    if (ik) {
      state.joints = ik.joints;
      state.bones = ik.bones;
      state.angles = ik.angles;
      state.midHip = ik.midHip;
      state.midShoulder = ik.midShoulder;
      state.coverage = ik.coverage;
      state.conf = ik.conf;
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    var lw = Math.min(3.2, 1.6 * Math.sqrt(rig.s));

    /* bones */
    for (var ci = 0; ci < POSE_CHAINS.length; ci++) {
      var ch = POSE_CHAINS[ci];
      ctx.beginPath();
      var started = false;
      for (var j = 0; j < ch.length; j++) {
        var q = HP_pt(lm, ch[j], rig, W, H);
        if (!q) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(q.x, q.y);
          started = true;
        } else ctx.lineTo(q.x, q.y);
      }
      var isTorso = ci === 0 || ci === 3 || ci === 4 || ci === 5 || ci === 12;
      ctx.strokeStyle =
        "rgba(" +
        (isTorso ? "100,220,180" : "120,200,255") +
        "," +
        (a * (isTorso ? 0.75 : 0.62)).toFixed(2) +
        ")";
      ctx.lineWidth = isTorso ? lw * 1.35 : lw;
      ctx.stroke();
    }

    /* joint pivots */
    var pivotList = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    var jR = Math.max(2.2, 2.0 * Math.sqrt(rig.s));
    for (var pi = 0; pi < pivotList.length; pi++) {
      var jn = HP_pt(lm, pivotList[pi], rig, W, H);
      if (!jn) continue;
      var isRoot = pivotList[pi] === 23 || pivotList[pi] === 24 || pivotList[pi] === 11 || pivotList[pi] === 12;
      var isTip = pivotList[pi] === 15 || pivotList[pi] === 16 || pivotList[pi] === 27 || pivotList[pi] === 28;
      ctx.fillStyle = isTip
        ? "rgba(255,255,255," + (a * 0.95).toFixed(2) + ")"
        : isRoot
          ? "rgba(120,255,200," + (a * 0.9).toFixed(2) + ")"
          : "rgba(160,230,255," + (a * 0.8).toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(jn.x, jn.y, isRoot ? jR * 1.45 : isTip ? jR * 1.15 : jR, 0, Math.PI * 2);
      ctx.fill();
      if (isRoot) {
        ctx.strokeStyle = "rgba(255,255,255," + (a * 0.35).toFixed(2) + ")";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    /* angle readouts near elbows/knees */
    if (ik && ik.angles && uiGet("showBodyAngles", true) !== false) {
      ctx.font = "600 7px ui-monospace, Menlo, monospace";
      ctx.fillStyle = "rgba(180,240,210," + (a * 0.85).toFixed(2) + ")";
      function angLabel(jointName, key) {
        var j = ik.joints[jointName];
        var ang = ik.angles[key];
        if (!j || ang == null) return;
        var p = lmToPx(j.x, j.y, W, H);
        ctx.fillText(Math.round(ang) + "°", p.x + 6, p.y - 4);
      }
      angLabel("lElbow", "lElbow");
      angLabel("rElbow", "rElbow");
      angLabel("lKnee", "lKnee");
      angLabel("rKnee", "rKnee");
    }

    /* status line */
    ctx.fillStyle = "rgba(140,230,190," + (a * 0.8).toFixed(2) + ")";
    ctx.font = "600 8px ui-monospace, Menlo, monospace";
    var el = ik && ik.angles ? ik.angles.lElbow : null;
    var er = ik && ik.angles ? ik.angles.rElbow : null;
    ctx.fillText(
      "BODY · " +
        (state.coverage || "?") +
        " · conf " +
        (state.conf || 0).toFixed(2) +
        " · IK×" +
        rig.s.toFixed(2) +
        (el != null ? " · L∠" + Math.round(el) : "") +
        (er != null ? " · R∠" + Math.round(er) : ""),
      10,
      H - 24
    );
  }

  /* ── MediaPipe Pose load ── */
  var mpPose = null;
  var mpBusy = false;
  var tickN = 0;

  function tryLoadPose() {
    if (HP._mpPoseV1) return;
    HP._mpPoseV1 = true;
    if (uiGet("showBody", true) === false) return;
    var base = "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/";
    function load(src) {
      return new Promise(function (res, rej) {
        var sc = document.createElement("script");
        sc.src = src;
        sc.onload = res;
        sc.onerror = rej;
        document.head.appendChild(sc);
      });
    }
    load(base + "pose.js")
      .then(function () {
        if (typeof Pose !== "function") throw new Error("Pose missing");
        var pose = new Pose({
          locateFile: function (f) {
            return base + f;
          },
        });
        pose.setOptions({
          modelComplexity: 0 /* lite — thrash guard */,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.45,
        });
        pose.onResults(function (results) {
          mpBusy = false;
          var lm = (results && results.poseLandmarks) || null;
          if (lm && lm.length) {
            state.landmarks = lm;
            state.present = true;
            state.engine = "mediapipe-pose";
            state.updatedAt = Date.now();
            var ik = buildIk(lm);
            if (ik) {
              state.joints = ik.joints;
              state.bones = ik.bones;
              state.angles = ik.angles;
              state.coverage = ik.coverage;
              state.conf = ik.conf;
              state.midHip = ik.midHip;
              state.midShoulder = ik.midShoulder;
            }
            /* bridge to LabViewRay / hurdles */
            try {
              if (window.LabViewRay) window.LabViewRay.body = state;
              if (typeof window.__mgH1NoteBody === "function") window.__mgH1NoteBody(state);
            } catch (eB) {}
          } else {
            state.present = false;
            state.landmarks = null;
            state.coverage = "none";
          }
        });
        mpPose = pose;
        try {
          if (window.__mgDevLog) window.__mgDevLog("ok", "BODY IK · MediaPipe Pose · " + VER, "body");
        } catch (eL) {}
      })
      .catch(function (err) {
        mpPose = null;
        try {
          if (window.__mgDevLog)
            window.__mgDevLog(
              "warn",
              "Pose CDN offline · " + (err && err.message ? err.message : "err"),
              "body"
            );
        } catch (eW) {}
      });
  }

  /** Called from live.js still-pipe tick with the same Image */
  window.__mgOnStillFrame = function (img) {
    if (!img) return;
    state._srcW = img.naturalWidth || state._srcW || 720;
    state._srcH = img.naturalHeight || state._srcH || 960;
    if (uiGet("showBody", true) === false) return;
    if (!mpPose) {
      tryLoadPose();
      return;
    }
    tickN++;
    /* throttle: every 3rd still frame so face+hands stay primary */
    if (mpBusy || tickN % 3 !== 0) return;
    try {
      mpBusy = true;
      mpPose.send({ image: img });
    } catch (eS) {
      mpBusy = false;
    }
  };

  /** Called from live.js drawAll after hands */
  window.__mgDrawBodyAfterHands = function (ctx, W, H) {
    try {
      drawBody(ctx, W, H);
    } catch (eD) {}
  };

  window.__mgGetBodyPose = function () {
    return state;
  };
  window.__mgGetBodyIk = function () {
    return {
      joints: state.joints,
      bones: state.bones,
      angles: state.angles,
      coverage: state.coverage,
      conf: state.conf,
      midHip: state.midHip,
      midShoulder: state.midShoulder,
      rigS: state.rigS,
      present: state.present,
      engine: state.engine,
      ver: VER,
    };
  };

  /* hot-reload patch: re-bind ui ref + mirror flags */
  window.__mgBodyPoseHotPatch = function () {
    ui = window.__mgCalibUiLive || window.__mgCalibUi || window.__mgCalibUI || ui;
    if (ui) {
      if (ui.showBody == null) ui.showBody = true;
      if (ui.bodyOpacity == null) ui.bodyOpacity = 0.7;
      if (ui.bodyRigAuto == null) ui.bodyRigAuto = true;
      if (ui.bodyRigScale == null) ui.bodyRigScale = 1.0;
      if (ui.showBodyAngles == null) ui.showBodyAngles = true;
    }
  };
  window.__mgBodyPoseHotPatch();

  tryLoadPose();
  try {
    if (window.__mgDevLog) window.__mgDevLog("ok", "full-body IK kit · " + VER, "body");
  } catch (e0) {}
})();
