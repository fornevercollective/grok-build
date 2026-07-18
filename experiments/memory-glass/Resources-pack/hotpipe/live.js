/* Memory Glass hotpipe/live.js v18-hurdles
 * H1 hands/air + bridge for hurdles.js (H2–H9)
 * Inspect-first · still-pipe only · no main PAGE thrash
 * v24: iPhone still-pipe camera flip — no double-mirror skeleton (inverted controller)
 */
(function () {
  "use strict";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  var VER = "live-v24-iphone-camflip";
  var MAX_FACES = 4;
  var PATH_MAX = 96; /* fencing trail length (samples) */
  var PATH_MIN_DIST = 0.0018; /* ignore micro-jitter in norm space */
  /* Hand IK scale: match real palm in the still-pipe frame.
   * Far/tiny hands get a mild boost; close/large palms stay ~1× (no giant skeleton). */
  var HAND_TARGET_SPAN = 0.16; /* mild far-hand boost only */
  var HAND_MAX_SPAN = 0.22; /* never draw open hand larger than this of frame */
  var lastSrcW = 720,
    lastSrcH = 960;
  var HAND_CHAINS = [
    [0, 1, 2, 3, 4],
    [0, 5, 6, 7, 8],
    [0, 9, 10, 11, 12],
    [0, 13, 14, 15, 16],
    [0, 17, 18, 19, 20],
    [5, 9, 13, 17],
  ];
  var HAND_TIPS = [4, 8, 12, 16, 20];

  function log(lvl, m, src) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "info", String(m || ""), src || "calib");
    } catch (e) {}
  }
  function ok(m) {
    log("ok", m, "calib");
  }
  function warn(m) {
    log("warn", m, "calib");
  }

  (function spam() {
    if (HP._ff15) return;
    HP._ff15 = true;
    var last = "",
      t0 = 0;
    if (typeof window.__mgDevLog === "function" && !window.__mgDevLog.__ff15) {
      var o = window.__mgDevLog;
      window.__mgDevLog = function (lvl, msg, src) {
        var m = String(msg || ""),
          s = String(src || "");
        if (s === "hotpipe" || s === "version" || /wasm|cdn\.jsdelivr|authorized|RequestCamera|deprecated/i.test(m))
          return;
        var k = m.slice(0, 72),
          n = Date.now();
        if (k === last && n - t0 < 3500) return;
        last = k;
        t0 = n;
        try {
          return o.apply(this, arguments);
        } catch (e) {}
      };
      window.__mgDevLog.__ff15 = true;
    }
  })();

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
  function iou(a, b) {
    var x1 = Math.max(a.x, b.x),
      y1 = Math.max(a.y, b.y);
    var x2 = Math.min(a.x + a.width, b.x + b.width),
      y2 = Math.min(a.y + a.height, b.y + b.height);
    var inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    var u = a.width * a.height + b.width * b.height - inter;
    return u > 0 ? inter / u : 0;
  }
  function loadJSON(key, fallback) {
    try {
      var r = localStorage.getItem(key);
      if (r) return JSON.parse(r);
    } catch (e) {}
    return fallback;
  }
  function saveJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  /* MediaPipe topology */
  var TOPO = {
    oval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
    leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
    rightEye: [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],
    leftBrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
    rightBrow: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
    nose: [168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 98, 327],
    lipsOuter: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95],
    L: 33,
    R: 263,
    N: 1,
    F: 10,
    C: 152,
  };

  /* Privacy zones — calibration / export policy */
  var ZONES = {
    home: { id: "home", label: "HOME", desc: "Trusted · full mesh · export ok", alpha: 0.92, mesh: 1 },
    near: { id: "near", label: "NEAR", desc: "Local · mesh on · limited export", alpha: 0.78, mesh: 0.85 },
    public: { id: "public", label: "PUBLIC", desc: "Shared space · reduced identity", alpha: 0.55, mesh: 0.55 },
    private: { id: "private", label: "PRIVATE", desc: "No identity spill · matte only option", alpha: 0.4, mesh: 0.35 },
  };

  /* Identity roster (adult multi-user) */
  var roster = loadJSON("mg.roster.v1", [
    { id: "p1", name: "Primary", zone: "home", role: "self", color: "#8ec8ff", calib: null },
    { id: "p2", name: "Partner", zone: "home", role: "partner", color: "#b8dcff", calib: null },
    { id: "p3", name: "Child", zone: "home", role: "child", color: "#9ae6b8", calib: null },
    { id: "p4", name: "Guest", zone: "near", role: "guest", color: "#c5d5e8", calib: null },
  ]);
  var trackAssign = loadJSON("mg.trackAssign.v2", {}); /* trackId -> rosterId */
  var ui = loadJSON("mg.calibUi.v1", {
    /* defaults kept low so live face stays visible under HUD */
    meshOpacity: 0.28,
    matteOpacity: 0.14,
    showLattice: true,
    showFeatures: true,
    showGsplat: true,
    alwaysMesh: true,
    showPaths: true,
    pathOpacity: 0.55,
    pathWidth: 0.85,
    pathTips: "all" /* nose | gaze | all */,
    /* H1 hands — inspect default ON; main PAGE never draws hands from this */
    showHands: true,
    handOpacity: 0.72,
    handPaths: true,
    handRigAuto: true,
    handRigScale: 1.0, /* identity — auto only boosts when palm is tiny */
    handTargetSpan: HAND_TARGET_SPAN,
    handMaxSpan: HAND_MAX_SPAN,
    handMatchFace: true, /* soft cap to face size; never inflate past real palm */
    /* iPhone / still-pipe selfie:
     * #pip-stream + #pip-overlay already CSS scaleX(-1).
     * MediaPipe landmarks are in raw JPEG space (sensor, not preview-mirrored).
     * Drawing with an extra X flip = double-mirror = inverted gamepad
     * (thumb/pinky swapped, palm facing you wrong). Keep draw unflipped;
     * flip only IPC air-pointer so page coords match the mirrored view. */
    pipCssMirror: true,
    handLandmarkMirror: false,
    handIpcFlipX: true,
    poseFast: true,
    poseGainYaw: 1.75,
    poseGainPitch: 1.55,
  });
  /* migrate old overpowering saves downward once */
  if (ui.meshOpacity > 0.45) ui.meshOpacity = 0.28;
  if (ui.matteOpacity > 0.28) ui.matteOpacity = 0.14;
  if (ui.pathOpacity > 0.7) ui.pathOpacity = 0.55;
  if (ui.showHands == null) ui.showHands = true;
  if (ui.handOpacity == null) ui.handOpacity = 0.72;
  if (ui.handPaths == null) ui.handPaths = true;
  if (ui.handRigAuto == null) ui.handRigAuto = true;
  /* v22: kill giant-hand defaults from v21 localStorage */
  if (ui.handRigScale == null || ui.handRigScale > 1.15) ui.handRigScale = 1.0;
  if (ui.handTargetSpan == null || ui.handTargetSpan > 0.2) ui.handTargetSpan = HAND_TARGET_SPAN;
  if (ui.handMaxSpan == null || ui.handMaxSpan > 0.28) ui.handMaxSpan = HAND_MAX_SPAN;
  if (ui.handMatchFace == null) ui.handMatchFace = true;
  if (ui.pipCssMirror == null) ui.pipCssMirror = true;
  if (ui.handLandmarkMirror == null) ui.handLandmarkMirror = false;
  if (ui.handIpcFlipX == null) ui.handIpcFlipX = true;
  if (ui.poseFast == null) ui.poseFast = true;
  if (ui.poseGainYaw == null) ui.poseGainYaw = 1.75;
  if (ui.poseGainPitch == null) ui.poseGainPitch = 1.55;
  try {
    /* one-shot force-save sane hand keys so sticky v21 1.55 dies */
    if (!ui._handFitV22) {
      ui.handRigScale = 1.0;
      ui.handTargetSpan = HAND_TARGET_SPAN;
      ui.handMaxSpan = HAND_MAX_SPAN;
      ui._handFitV22 = true;
      saveJSON("mg.calibUi.v1", ui);
    }
    /* v24: ALWAYS kill sticky handLandmarkMirror:true from older sessions.
     * Hot-reload alone used to leave the closed-over ui inverted. */
    if (!ui._handMirrorV24 || ui.handLandmarkMirror === true) {
      ui.handLandmarkMirror = false;
      ui.pipCssMirror = true;
      ui.handIpcFlipX = true;
      ui._handMirrorV24 = true;
      saveJSON("mg.calibUi.v1", ui);
    }
  } catch (eMig) {}
  /* live object for hot-reload patches (same reference drawHands closes over) */
  window.__mgCalibUi = ui;
  function applyIphoneCamFlipFix(target) {
    if (!target) return;
    target.handLandmarkMirror = false;
    target.pipCssMirror = true;
    target.handIpcFlipX = true;
    target._handMirrorV24 = true;
    try {
      if (window.__mgLens && window.__mgLens.state) window.__mgLens.state.mirror = false;
    } catch (eL) {}
  }
  applyIphoneCamFlipFix(ui);
  /* If inspect already running from prior inject, patch THAT ui and bail early later */
  if (window.__mgCalibUiLive && window.__mgCalibUiLive !== ui) {
    applyIphoneCamFlipFix(window.__mgCalibUiLive);
  }

  /* Spatial head-lock calibration state */
  var spatial = loadJSON("mg.spatialCalib.v1", {
    locked: false,
    rest: null /* {yaw,pitch,roll,z,faceScale,nx,ny} */,
    extent: { yaw: 0.45, pitch: 0.35, z: 0.4 },
    samples: [],
    mode: "idle" /* idle | capture-rest | capture-look | mocap-ref | hdri-ref */,
    refType: null /* null | mocap | hdri | gsplat */,
    meanMesh: null /* FaceSubstitution / mean face for gsplat lock */,
  });

  function saveAll() {
    saveJSON("mg.roster.v1", roster);
    saveJSON("mg.trackAssign.v2", trackAssign);
    saveJSON("mg.calibUi.v1", ui);
    saveJSON("mg.spatialCalib.v1", spatial);
  }

  function rosterById(id) {
    for (var i = 0; i < roster.length; i++) if (roster[i].id === id) return roster[i];
    return roster[0];
  }

  var isMain = !!document.getElementById("mg-root");
  var isInspect = !!document.getElementById("pip-wrap");

  /* ── MAIN calm ── */
  if (isMain) {
    if (!HP._mainPro15) {
      HP._mainPro15 = true;
      if (!document.getElementById("mg-hp-stable")) {
        var s = document.createElement("style");
        s.id = "mg-hp-stable";
        s.textContent =
          "#mg-cam-pip,#mg-cam-video,#mg-cam-overlay,#mg-pip-lbl,#mg-occ,#mg-lidar,#mg-hand-cursor,#mg-fov-layers{display:none!important;opacity:0!important;visibility:hidden!important;}" +
          "html.mg-occ-on #mg-occ,html.mg-lidar-on #mg-lidar{display:none!important;}";
        (document.head || document.documentElement).appendChild(s);
      }
      function calm() {
        try {
          if (document.body) {
            document.body.style.filter = "";
            document.body.style.transform = "";
          }
          document.documentElement.classList.remove(
            "mg-occ-on",
            "mg-lidar-on",
            "mg-hands-on",
            "mg-track-lock",
            "mg-xr-on",
            "mg-axis-on"
          );
          if (typeof window.__mgApplyViewMode === "function") window.__mgApplyViewMode("page");
          if (window.LabViewRay) {
            window.LabViewRay.source = "pointer";
            window.LabViewRay.hands = null;
            window.LabViewRay.person = null;
          }
        } catch (e) {}
      }
      calm();
      setTimeout(calm, 600);
      window.__mgApplyRemoteTrack = function (o) {
        window.__mgRemoteTrack = o;
        try {
          if (!o || !document.documentElement) return;
          /* only if spatial locked — subtle CSS vars for optional depth mode later */
          if (spatial.locked) {
            document.documentElement.style.setProperty("--mg-face-yaw", String(o.x || 0));
            document.documentElement.style.setProperty("--mg-face-pitch", String(o.y || 0));
            document.documentElement.style.setProperty("--mg-face-z", String(o.z || 0));
            document.documentElement.classList.toggle("mg-head-lock", !!o.locked);
          }
        } catch (e) {}
      };
      window.__mgApplyRemotePeople = function (people) {
        window.__mgPeople = Array.isArray(people) ? people : [];
        if (window.__mgPeople[0]) {
          var p = window.__mgPeople[0];
          window.__mgApplyRemoteTrack({
            x: p.yaw,
            y: p.pitch,
            z: p.z,
            roll: p.roll,
            locked: spatial.locked && p.conf > 0.45,
            conf: p.conf,
          });
        }
      };
      /* H1: inspect hands → main CSS vars only. Never body filter / occ canvas / PAGE thrash. */
      window.__mgApplyRemoteHand = function (h) {
        window.__mgHand = h || null;
        try {
          var de = document.documentElement;
          if (!de) return;
          if (!h || !h.present) {
            de.style.removeProperty("--mg-hand-px");
            de.style.removeProperty("--mg-hand-py");
            de.style.removeProperty("--mg-hand-pinch");
            de.classList.remove("mg-hands-on", "mg-occ-on");
            return;
          }
          /* PAGE mode: store only — no cursor / occ / body thrash */
          if (de.classList.contains("mg-mode-page") || !de.classList.contains("mg-mode-depth")) {
            return;
          }
          /* DEPTH opt-in only: CSS air-pointer, never body.transform from hands */
          de.style.setProperty("--mg-hand-px", ((h.nx || 0.5) * 100).toFixed(2) + "%");
          de.style.setProperty("--mg-hand-py", ((h.ny || 0.5) * 100).toFixed(2) + "%");
          de.style.setProperty("--mg-hand-pinch", String(h.pinch != null ? h.pinch : 1));
          if (window.LabViewRay) window.LabViewRay.hands = h.hands || null;
        } catch (e) {}
      };
      ok("main calm · H1 hands inspect-only · " + VER);
    }
    if (!isInspect) return;
  }

  if (!isInspect) return;

  /* ── INSPECT pro calibration UI ── */
  var FACE = "http://127.0.0.1:9877/live.jpg";
  var GLASS = "http://127.0.0.1:9877/glass.jpg";

  if (!HP._lay15) {
    HP._lay15 = true;
    var st = document.createElement("style");
    st.id = "mg-hp-v15";
    st.textContent = [
      "#stage{display:flex!important;flex-direction:column!important;gap:6px!important;padding:8px!important;flex-shrink:0!important;}",
      "#pip-wrap{display:block!important;order:1!important;width:100%!important;aspect-ratio:16/10!important;max-height:36vh!important;min-height:200px!important;position:relative!important;border-radius:4px!important;overflow:hidden!important;border:1px solid rgba(180,200,220,0.28)!important;background:#050608!important;cursor:crosshair!important;}",
      "#pip-video{display:none!important;}",
      "#pip-stream{display:block!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;object-position:center 28%!important;transform:scaleX(-1)!important;z-index:1!important;}",
      "#pip-overlay{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;z-index:4!important;pointer-events:none!important;transform:scaleX(-1)!important;}",
      "#pip-lbl{z-index:6!important;font:600 8px/1.2 ui-monospace,Menlo,monospace!important;letter-spacing:0.06em!important;text-transform:uppercase!important;color:rgba(180,210,230,0.85)!important;}",
      /* control strip — adult, dense; high z so clicks hit buttons not overlays */
      "#mg-pro{order:0!important;display:flex!important;flex-direction:column!important;gap:6px!important;padding:2px 0!important;",
      "  position:relative!important;z-index:50!important;pointer-events:auto!important;}",
      "#mg-pro .row{display:flex;flex-wrap:wrap;gap:4px;align-items:center;pointer-events:auto!important}",
      "#mg-pro button,#mg-pro label.chip{appearance:none;cursor:pointer;pointer-events:auto!important;border:1px solid rgba(200,210,220,0.2);",
      "  background:rgba(12,14,18,0.85);color:rgba(220,230,240,0.88);font:600 8px/1 ui-monospace,Menlo,monospace;",
      "  letter-spacing:0.08em;text-transform:uppercase;padding:6px 8px;border-radius:2px;position:relative;z-index:51}",
      "#mg-pro button:hover{border-color:rgba(160,200,255,0.45);color:#fff}",
      "#mg-pro button.on{border-color:rgba(120,200,255,0.55);background:rgba(30,50,70,0.75);color:#fff}",
      "#mg-pro button.warn{border-color:rgba(255,180,80,0.5)}",
      "#mg-pro button.lock{border-color:rgba(100,220,160,0.55);color:rgba(140,240,180,0.95)}",
      "#mg-pro .sl{display:flex;align-items:center;gap:6px;font:600 8px/1 ui-monospace,Menlo,monospace;",
      "  letter-spacing:0.06em;text-transform:uppercase;color:rgba(160,180,200,0.75)}",
      "#mg-pro input[type=range]{width:72px;accent-color:#9ec8ff;height:18px}",
      "#mg-pro .status{font:500 8px/1.35 ui-monospace,Menlo,monospace;color:rgba(150,170,190,0.7);letter-spacing:0.04em}",
      /* face pick sheet */
      "#mg-pick{display:none;position:absolute;z-index:20;min-width:200px;max-width:92%;",
      "  background:rgba(8,10,14,0.94);border:1px solid rgba(180,200,220,0.28);border-radius:3px;",
      "  backdrop-filter:blur(16px);padding:8px;box-shadow:0 12px 40px rgba(0,0,0,0.5);",
      "  pointer-events:auto}",
      "#mg-pick.open{display:block}",
      "#mg-pick h4{margin:0 0 6px;font:650 9px/1.2 system-ui;letter-spacing:0.14em;text-transform:uppercase;color:rgba(200,220,240,0.75)}",
      "#mg-pick .g{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:6px}",
      "#mg-pick button{width:100%;text-align:left}",
      "#mg-pick .zones button{font-size:7px}",
      "#mg-tri{order:2!important;display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:5px!important;height:128px!important;}",
      "#mg-tri .tri-cell{position:relative!important;border-radius:3px!important;overflow:hidden!important;border:1px solid rgba(180,200,220,0.15)!important;background:#06080c!important;}",
      "#mg-tri .tri-cell img,#mg-tri .tri-cell canvas{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;}",
      "#mg-tri .tri-lbl{position:absolute!important;left:5px!important;bottom:4px!important;z-index:3!important;font:600 7px/1 ui-monospace,Menlo,monospace!important;letter-spacing:0.1em!important;text-transform:uppercase!important;color:rgba(150,180,210,0.8)!important;}",
      "#mg-tri .tri-meta{position:absolute!important;left:5px!important;top:4px!important;z-index:3!important;font:600 7px/1.2 ui-monospace,Menlo,monospace!important;color:rgba(140,180,210,0.75)!important;}",
      "#cf{order:3!important;height:48px!important;overflow:hidden!important;perspective:none!important;}",
      "#cf-stage{position:absolute!important;inset:0!important;transform:none!important;display:flex!important;flex-direction:column!important;gap:2px!important;padding:5px!important;overflow-y:auto!important;}",
      "#cf-stage .cf-card{position:relative!important;left:auto!important;top:auto!important;margin:0!important;width:100%!important;height:18px!important;flex:0 0 18px!important;transform:none!important;}",
      "#log{order:4!important;max-height:10vh!important;}",
      "#log .row{animation:none!important;}",
      "#log .row.mg-log-hide{display:none!important;}",
      "#mg-sys{order:5!important;}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);

    var stage = document.getElementById("stage");
    var cf = document.getElementById("cf");
    if (stage) {
      if (!document.getElementById("mg-pro")) {
        var pro = document.createElement("div");
        pro.id = "mg-pro";
        pro.innerHTML =
          '<div class="row" id="mg-pro-actions"></div>' +
          '<div class="row" id="mg-pro-sliders"></div>' +
          '<div class="status" id="mg-pro-status">SPATIAL · mesh always-on · click face for identity / zone</div>';
        stage.insertBefore(pro, stage.firstChild);
      }
      if (!document.getElementById("mg-tri")) {
        var tri = document.createElement("div");
        tri.id = "mg-tri";
        tri.innerHTML =
          '<div class="tri-cell"><img id="tri-page-img" alt="page"/><div class="tri-meta">SCENE</div><div class="tri-lbl">page</div></div>' +
          '<div class="tri-cell"><canvas id="tri-gsplat-cv" width="360" height="260"></canvas><div class="tri-meta" id="tri-gsplat-meta">GSPLAT</div><div class="tri-lbl">3d head</div></div>' +
          '<div class="tri-cell"><canvas id="tri-depth-cv" width="360" height="260"></canvas><div class="tri-meta" id="tri-depth-meta">LOCK</div><div class="tri-lbl">spatial</div></div>';
        if (cf) stage.insertBefore(tri, cf);
        else stage.appendChild(tri);
      }
    }
    /* pick sheet on pip-wrap */
    var wrap0 = document.getElementById("pip-wrap");
    if (wrap0 && !document.getElementById("mg-pick")) {
      var pick = document.createElement("div");
      pick.id = "mg-pick";
      wrap0.appendChild(pick);
    }
    window.__mgInspectSetAxis = function () {};
  }

  if (HP._run15) {
    /* Hot Reload: cannot rebind closed-over loops, but CAN fix cam-flip on live ui */
    try {
      applyIphoneCamFlipFix(window.__mgCalibUiLive || window.__mgCalibUi);
      var lblR = document.getElementById("pip-lbl");
      if (lblR) lblR.textContent = "SPATIAL · " + VER + " · camflip";
      ok("hot patch camflip · " + VER + " · handLandmarkMirror=false");
    } catch (eHR) {}
    return;
  }
  HP._run15 = true;
  /* stable ref so later hot-reloads can patch without re-init */
  window.__mgCalibUiLive = ui;

  var tracks = [];
  var nextId = 1;
  var lastPost = 0;
  var lastHandPost = 0;
  var lastRender = 0;
  var engine = "mesh-468";
  var mpFace = null;
  var mpBusy = false;
  var mpHands = null;
  var mpHandsBusy = false;
  var mpHandsLoading = false;
  var lastHands = []; /* MediaPipe multiHandLandmarks */
  var handPath = []; /* index-tip fencing path on inspect */
  var handGesture = {
    present: false,
    nx: 0.5,
    ny: 0.5,
    pinch: 1,
    expand: 0,
    conf: 0,
    engine: "none",
  };
  var pickTrack = null;

  var wrap = document.getElementById("pip-wrap");
  if (!wrap) return;
  var trackImg = document.getElementById("pip-stream");
  if (!trackImg) {
    trackImg = document.createElement("img");
    trackImg.id = "pip-stream";
    wrap.insertBefore(trackImg, wrap.firstChild);
  }
  var lbl = document.getElementById("pip-lbl");
  if (lbl) lbl.textContent = "SPATIAL · " + VER;

  /* ── control strip ──
   * IMPORTANT: do NOT call paintControls every rAF/render — wiping innerHTML
   * kills in-flight clicks (buttons "don't work"). Rebuild only on user action.
   */
  var controlsBuilt = false;
  function paintStatusOnly() {
    var stEl = document.getElementById("mg-pro-status");
    if (!stEl) return;
    var t = tracks[0];
    var bits = [
      spatial.locked ? "LOCK" : "OPEN",
      engine || "mesh",
      handGesture && handGesture.present ? "AIR" : ui.showHands ? "HANDS…" : "—",
      "src " + tracks.length,
    ];
    if (t && t.lm) {
      bits.push("Y" + (t.yaw || 0).toFixed(2));
      bits.push("Z" + (t.z || 0).toFixed(2));
    }
    stEl.textContent = bits.join(" · ");
  }
  function paintControls(force) {
    var act = document.getElementById("mg-pro-actions");
    var sl = document.getElementById("mg-pro-sliders");
    var stEl = document.getElementById("mg-pro-status");
    if (!act || !sl) return;
    if (controlsBuilt && !force) {
      paintStatusOnly();
      return;
    }
    controlsBuilt = true;
    act.innerHTML = "";
    sl.innerHTML = "";
    function btn(label, cls, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (cls) b.className = cls;
      b.style.pointerEvents = "auto";
      b.style.cursor = "pointer";
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        try {
          fn();
        } catch (eBtn) {
          warn(String(eBtn));
        }
      };
      act.appendChild(b);
      return b;
    }
    btn(spatial.locked ? "HEAD LOCK · ON" : "HEAD LOCK · OFF", spatial.locked ? "lock on" : "warn", function () {
      if (!tracks[0] || !tracks[0].lm) {
        warn("No face mesh — center in frame, then lock");
        return;
      }
      if (!spatial.rest) captureRest();
      spatial.locked = !spatial.locked;
      saveAll();
      paintControls(true);
      ok(spatial.locked ? "Spatial head lock ENGAGED" : "Spatial head lock released");
    });
    btn("CAPTURE REST", "", function () {
      captureRest();
    });
    btn("LOOK L/R/U/D", spatial.mode.indexOf("capture") === 0 ? "on" : "", function () {
      if (spatial.mode === "capture-look") {
        spatial.mode = "idle";
        ok("Extent capture done · samples " + spatial.samples.length);
      } else {
        spatial.mode = "capture-look";
        spatial.samples = spatial.samples || [];
        ok("Look left · right · up · down — samples auto-record");
      }
      paintControls(true);
    });
    btn("MOCAP REF", spatial.refType === "mocap" ? "on" : "", function () {
      captureMeanMesh("mocap");
    });
    btn("HDRI / GSPLAT", spatial.refType === "hdri" || spatial.refType === "gsplat" ? "on" : "", function () {
      captureMeanMesh(spatial.refType === "hdri" ? "gsplat" : "hdri");    });
    btn("CLEAR CALIB", "", function () {
      spatial.locked = false;
      spatial.rest = null;
      spatial.samples = [];
      spatial.meanMesh = null;
      spatial.refType = null;
      spatial.mode = "idle";
      saveAll();
      paintControls(true);
      ok("Calibration cleared");
    });
    btn("CLEAR PATHS", "", function () {
      tracks.forEach(function (t) {
        t.path = [];
        t.path3 = [];
        t.vel = 0;
      });
      ok("Movement paths cleared");
    });

    function slider(key, label, min, max, step) {
      var wrap = document.createElement("label");
      wrap.className = "sl";
      wrap.innerHTML = label + ' <input type="range" min="' + min + '" max="' + max + '" step="' + step + '"/> <span class="v"></span>';
      var inp = wrap.querySelector("input");
      var v = wrap.querySelector(".v");
      inp.value = String(ui[key] != null ? ui[key] : min);
      v.textContent = Number(inp.value).toFixed(2);
      inp.oninput = function () {
        ui[key] = parseFloat(inp.value);
        v.textContent = ui[key].toFixed(2);
        saveAll();
      };
      sl.appendChild(wrap);
    }
    slider("meshOpacity", "MESH α", 0.1, 1, 0.02);
    slider("matteOpacity", "MATTE α", 0.05, 1, 0.02);
    slider("pathOpacity", "PATH α", 0.15, 1, 0.02);
    slider("pathWidth", "PATH W", 0.4, 2.5, 0.05);
    function tog(key, label) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.className = ui[key] ? "on" : "";
      b.style.pointerEvents = "auto";
      b.style.cursor = "pointer";
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        ui[key] = !ui[key];
        saveAll();
        paintControls(true);
      };
      sl.appendChild(b);
    }
    tog("showLattice", "LATTICE");
    tog("showFeatures", "FEATURES");
    tog("showGsplat", "GSPLAT");
    tog("alwaysMesh", "ALWAYS ON");
    tog("showPaths", "PATHS");
    tog("showHands", "HANDS");
    tog("handPaths", "HAND PATH");
    tog("handRigAuto", "HAND FOV AUTO");
    slider("handOpacity", "HAND α", 0.2, 1, 0.02);
    slider("handRigScale", "HAND RIG ×", 0.8, 3.5, 0.05);
    slider("handTargetSpan", "HAND SPAN", 0.12, 0.4, 0.01);
    btn(
      "TIP · " + (ui.pathTips || "all").toUpperCase(),
      "on",
      function () {
        var order = ["all", "nose", "gaze"];
        var i = order.indexOf(ui.pathTips || "all");
        ui.pathTips = order[(i + 1) % order.length];
        saveAll();
        paintControls(true);
        ok("Path tip · " + ui.pathTips + " (fencing tip trail)");
      }
    );

    if (stEl) {
      var r = spatial.rest;
      stEl.textContent =
        (spatial.locked ? "LOCK ENGAGED" : "LOCK OPEN") +
        " · rest " +
        (r ? "Y" + r.yaw.toFixed(2) + " P" + r.pitch.toFixed(2) + " Z" + r.z.toFixed(2) : "—") +
        " · ref " +
        (spatial.refType || "none") +
        " · samples " +
        (spatial.samples ? spatial.samples.length : 0) +
        " · click subject for zone";
    }
  }
  paintControls();

  function captureRest() {
    var t = tracks[0];
    if (!t || !t.lm) {
      warn("Need face mesh for rest pose");
      return;
    }
    spatial.rest = {
      yaw: t.yaw || 0,
      pitch: t.pitch || 0,
      roll: t.roll || 0,
      z: t.z || 0,
      faceScale: t.scale || 0.2,
      nx: t.nx || 0.5,
      ny: t.ny || 0.46,
      ts: Date.now(),
    };
    spatial.mode = "idle";
    saveAll();
    paintControls();
    ok("Rest pose captured · spatial origin set");
  }

  function captureMeanMesh(refType) {
    var t = tracks[0];
    if (!t || !t.lm) {
      warn("Need face mesh for " + refType + " reference");
      return;
    }
    spatial.meanMesh = t.lm.map(function (p) {
      return { x: p.x, y: p.y, z: p.z || 0 };
    });
    spatial.refType = refType;
    if (!spatial.rest) captureRest();
    saveAll();
    paintControls();
    ok((refType === "mocap" ? "MOCAP" : refType.toUpperCase()) + " reference mesh stored · gsplat lock base");
  }

  function sampleExtentIfNeeded() {
    if (spatial.mode !== "capture-look" || !tracks[0]) return;
    var t = tracks[0];
    var s = { yaw: t.yaw || 0, pitch: t.pitch || 0, z: t.z || 0, ts: Date.now() };
    spatial.samples.push(s);
    if (spatial.samples.length > 60) spatial.samples.shift();
    /* update extent from samples */
    var yaws = spatial.samples.map(function (x) {
      return Math.abs(x.yaw - (spatial.rest ? spatial.rest.yaw : 0));
    });
    var pitches = spatial.samples.map(function (x) {
      return Math.abs(x.pitch - (spatial.rest ? spatial.rest.pitch : 0));
    });
    var zs = spatial.samples.map(function (x) {
      return Math.abs(x.z - (spatial.rest ? spatial.rest.z : 0));
    });
    spatial.extent = {
      yaw: Math.max(0.25, Math.max.apply(null, yaws) || 0.45),
      pitch: Math.max(0.2, Math.max.apply(null, pitches) || 0.35),
      z: Math.max(0.2, Math.max.apply(null, zs) || 0.4),
    };
    saveAll();
  }

  /* spatial-normalized pose */
  function spatialPose(raw) {
    if (!spatial.rest) return raw;
    var r = spatial.rest;
    var e = spatial.extent || { yaw: 0.45, pitch: 0.35, z: 0.4 };
    return {
      yaw: clamp((raw.yaw - r.yaw) / (e.yaw || 0.45), -1.2, 1.2),
      pitch: clamp((raw.pitch - r.pitch) / (e.pitch || 0.35), -1.2, 1.2),
      roll: clamp((raw.roll || 0) - (r.roll || 0), -1.2, 1.2),
      z: clamp((raw.z - r.z) / (e.z || 0.4), -1.2, 1.2),
      nx: raw.nx,
      ny: raw.ny,
    };
  }

  /* ── pick sheet: who + zone ── */
  function openPick(tr, clientX, clientY) {
    pickTrack = tr;
    var pick = document.getElementById("mg-pick");
    if (!pick) return;
    var rect = wrap.getBoundingClientRect();
    var x = clientX - rect.left;
    var y = clientY - rect.top;
    pick.style.left = Math.min(rect.width - 210, Math.max(4, x - 20)) + "px";
    pick.style.top = Math.min(rect.height - 180, Math.max(4, y + 8)) + "px";
    pick.innerHTML = "";
    var h = document.createElement("h4");
    h.textContent = "Subject · track #" + tr.id;
    pick.appendChild(h);

    var g1 = document.createElement("div");
    g1.className = "g";
    roster.forEach(function (r) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = r.name + " · " + (ZONES[r.zone] ? ZONES[r.zone].label : r.zone);
      b.className = trackAssign[tr.id] === r.id ? "on" : "";
      b.style.borderColor = r.color;
      b.onclick = function (e) {
        e.stopPropagation();
        trackAssign[tr.id] = r.id;
        tr.rosterId = r.id;
        saveAll();
        openPick(tr, clientX, clientY);
        ok("Subject → " + r.name + " [" + r.zone + "]");
      };
      g1.appendChild(b);
    });
    pick.appendChild(g1);

    var h2 = document.createElement("h4");
    h2.textContent = "Zone · calibration policy";
    h2.style.marginTop = "4px";
    pick.appendChild(h2);
    var g2 = document.createElement("div");
    g2.className = "g zones";
    Object.keys(ZONES).forEach(function (zid) {
      var z = ZONES[zid];
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = z.label;
      b.title = z.desc;
      var rid = trackAssign[tr.id] || tr.rosterId;
      var ro = rid ? rosterById(rid) : null;
      b.className = ro && ro.zone === zid ? "on" : "";
      b.onclick = function (e) {
        e.stopPropagation();
        if (!ro) {
          /* create temp assign to primary guest */
          ro = roster[roster.length - 1];
          trackAssign[tr.id] = ro.id;
          tr.rosterId = ro.id;
        }
        ro.zone = zid;
        saveAll();
        openPick(tr, clientX, clientY);
        ok(ro.name + " zone → " + z.label);
      };
      g2.appendChild(b);
    });
    pick.appendChild(g2);

    var ren = document.createElement("button");
    ren.type = "button";
    ren.textContent = "RENAME SUBJECT";
    ren.style.marginTop = "4px";
    ren.onclick = function (e) {
      e.stopPropagation();
      var rid = trackAssign[tr.id];
      if (!rid) return;
      var ro = rosterById(rid);
      var nm = prompt("Subject name", ro.name);
      if (nm && nm.trim()) {
        ro.name = nm.trim();
        saveAll();
        openPick(tr, clientX, clientY);
      }
    };
    pick.appendChild(ren);

    var cl = document.createElement("button");
    cl.type = "button";
    cl.textContent = "CLOSE";
    cl.onclick = function (e) {
      e.stopPropagation();
      closePick();
    };
    pick.appendChild(cl);

    pick.classList.add("open");
  }
  function closePick() {
    pickTrack = null;
    var pick = document.getElementById("mg-pick");
    if (pick) pick.classList.remove("open");
  }

  wrap.addEventListener("click", function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest("#mg-pick")) return;
    if (!tracks.length) return;
    var rect = wrap.getBoundingClientRect();
    var mx = 1 - (ev.clientX - rect.left) / rect.width;
    var my = (ev.clientY - rect.top) / rect.height;
    var best = null,
      bestD = 1e9;
    tracks.forEach(function (tr) {
      var d = Math.hypot((tr.nx || 0.5) - mx, (tr.ny || 0.45) - my);
      if (d < bestD) {
        bestD = d;
        best = tr;
      }
    });
    if (best && bestD < 0.32) openPick(best, ev.clientX, ev.clientY);
    else closePick();
  });

  /* ── mesh build / pose ── */
  function sizeOv() {
    var ov = document.getElementById("pip-overlay");
    var w = Math.max(200, wrap.clientWidth || 360);
    var h = Math.max(140, wrap.clientHeight || 220);
    if (ov && (ov.width !== w || ov.height !== h)) {
      ov.width = w;
      ov.height = h;
    }
    return { W: ov ? ov.width : w, H: ov ? ov.height : h, ov: ov };
  }

  function padBox(box, vw, vh) {
    var pt = box.height * 0.2,
      pb = box.height * 0.35,
      px = box.width * 0.18; /* shoulders for person alpha */
    var x = Math.max(0, box.x - px),
      y = Math.max(0, box.y - pt);
    return {
      x: x,
      y: y,
      width: Math.min(vw - x, box.width + px * 2),
      height: Math.min(vh - y, box.height + pt + pb),
    };
  }

  function buildMesh468(box, vw, vh, scaleRef) {
    var lm = new Array(468);
    var x0 = box.x / vw,
      y0 = box.y / vh,
      bw = Math.max(0.08, box.width / vw),
      bh = Math.max(0.1, box.height / vh);
    /* face is upper ~62% of padded person box */
    bh = bh * 0.62;
    var faceW = bw;
    var sref = scaleRef || faceW;
    sref = lerp(sref, faceW, 0.1);
    var scaleFix = clamp(sref / faceW, 0.9, 1.12);
    var cx = x0 + bw * 0.5,
      cy = y0 + bh * 0.48;
    bw *= scaleFix;
    bh *= scaleFix * 1.04;
    x0 = cx - bw * 0.5;
    y0 = cy - bh * 0.48;
    var i = 0;
    for (var gy = 0; gy < 18 && i < 468; gy++) {
      for (var gx = 0; gx < 26 && i < 468; gx++) {
        var u = (gx + 0.5) / 26,
          v = (gy + 0.5) / 18;
        var nx = (u - 0.5) * 2,
          ny = (v - 0.5) * 2;
        var r2 = nx * nx * 0.88 + ny * ny * 1.12;
        var depth = Math.max(-0.16, 0.1 * Math.sqrt(Math.max(0, 1 - r2)) - 0.02);
        if (Math.abs(nx) < 0.35 && ny > -0.2 && ny < 0.35) depth += 0.025;
        if (Math.abs(nx) < 0.12 && ny > 0.05 && ny < 0.35) depth += 0.04;
        lm[i++] = { x: x0 + bw * u, y: y0 + bh * v, z: depth };
      }
    }
    while (i < 468) lm[i++] = { x: cx, y: cy, z: 0 };
    function K(idx, u, v, z) {
      if (idx < 468) lm[idx] = { x: x0 + bw * u, y: y0 + bh * v, z: z || 0 };
    }
    K(33, 0.28, 0.38, 0.03);
    K(263, 0.72, 0.38, 0.03);
    K(1, 0.5, 0.52, 0.09);
    K(10, 0.5, 0.13, -0.01);
    K(152, 0.5, 0.93, 0);
    K(61, 0.36, 0.7, 0.025);
    K(291, 0.64, 0.7, 0.025);
    K(13, 0.5, 0.64, 0.04);
    K(14, 0.5, 0.74, 0.03);
    for (var k = 0; k < TOPO.oval.length; k++) {
      var ang = (k / TOPO.oval.length) * Math.PI * 2 - Math.PI / 2;
      K(TOPO.oval[k], 0.5 + 0.46 * Math.cos(ang), 0.5 + 0.48 * Math.sin(ang), 0.01 * Math.cos(ang));
    }
    function fillEye(idxs, ecx, ecy) {
      for (var k = 0; k < idxs.length; k++) {
        var a = (k / idxs.length) * Math.PI * 2;
        K(idxs[k], ecx + 0.085 * Math.cos(a), ecy + 0.04 * Math.sin(a), 0.028);
      }
    }
    fillEye(TOPO.leftEye, 0.32, 0.39);
    fillEye(TOPO.rightEye, 0.68, 0.39);
    function fillArc(idxs, xa, xb, y, lift) {
      for (var k = 0; k < idxs.length; k++) {
        var t = k / Math.max(1, idxs.length - 1);
        K(idxs[k], xa + (xb - xa) * t, y - lift * Math.sin(t * Math.PI), 0.012);
      }
    }
    fillArc(TOPO.leftBrow, 0.2, 0.44, 0.28, 0.04);
    fillArc(TOPO.rightBrow, 0.56, 0.8, 0.28, 0.04);
    fillArc(TOPO.lipsOuter, 0.34, 0.66, 0.7, -0.05);
    return { lm: lm, scaleRef: sref, scale: bw };
  }

  function poseFromMesh(lm) {
    var L = lm[TOPO.L],
      R = lm[TOPO.R],
      N = lm[TOPO.N],
      F = lm[TOPO.F],
      C = lm[TOPO.C];
    if (!L || !R || !N) return { yaw: 0, pitch: 0, roll: 0, z: 0, nx: 0.5, ny: 0.46 };
    var dx = R.x - L.x,
      dy = R.y - L.y;
    var eyeD = Math.hypot(dx, dy) || 0.12;
    var roll = Math.atan2(dy, dx);
    /* Phone still-pipe: small faces + soft light → weak pivot signal.
     * Higher gains + light FOV depthScale so pans read faster off screen. */
    var gY = ui.poseGainYaw != null ? +ui.poseGainYaw : 1.75;
    var gP = ui.poseGainPitch != null ? +ui.poseGainPitch : 1.55;
    try {
      if (window.__mgLens && window.__mgLens.depthScale) {
        var dg = window.__mgLens.depthScale(eyeD);
        gY *= 0.85 + dg * 0.2;
        gP *= 0.85 + dg * 0.2;
      }
    } catch (eG) {}
    var yaw = clamp(((N.x - (L.x + R.x) * 0.5) / eyeD) * gY, -1.35, 1.35);
    var pitch = F && C ? clamp(((N.y - (F.y + C.y) * 0.5) / eyeD) * gP, -1.35, 1.35) : 0;
    /* cheek asymmetry as yaw assist when nose offset is weak (soft light) */
    try {
      var chL = lm[234] || lm[93],
        chR = lm[454] || lm[323];
      if (chL && chR && eyeD > 0.02) {
        var cheek = ((chR.x - N.x) - (N.x - chL.x)) / eyeD;
        yaw = clamp(yaw * 0.72 + cheek * 0.55 * (gY / 1.75), -1.35, 1.35);
      }
    } catch (eC) {}
    var zScale = clamp((0.14 - eyeD) * 5.5, -1.2, 1.2);
    var zMesh = N.z != null ? clamp(N.z * 9, -1, 1) : 0;
    return {
      yaw: yaw,
      pitch: pitch,
      roll: roll,
      z: zScale * 0.6 + zMesh * 0.4,
      nx: (L.x + R.x) * 0.5,
      ny: N.y,
      eyeD: eyeD,
    };
  }

  /** Adaptive EMA: big head pans snap faster; micro jitter stays soft (still-pipe lag). */
  function smoothPose(prev, next, baseA) {
    if (prev == null || !ui.poseFast) return next;
    var dy = Math.abs((next.yaw || 0) - (prev.yaw || 0));
    var dp = Math.abs((next.pitch || 0) - (prev.pitch || 0));
    var dr = Math.abs((next.roll || 0) - (prev.roll || 0));
    var mag = Math.max(dy, dp, dr * 0.5);
    /* baseA default ~0.35; pan → up to 0.72; idle → ~0.22 */
    var a = baseA != null ? baseA : 0.35;
    if (mag > 0.08) a = Math.min(0.78, a + mag * 2.2);
    else if (mag < 0.015) a = Math.max(0.18, a * 0.7);
    return {
      yaw: lerp(prev.yaw || 0, next.yaw || 0, a),
      pitch: lerp(prev.pitch || 0, next.pitch || 0, a),
      roll: lerp(prev.roll || 0, next.roll || 0, a),
      z: lerp(prev.z || 0, next.z || 0, Math.min(0.65, a + 0.05)),
      nx: next.nx,
      ny: next.ny,
      eyeD: next.eyeD,
    };
  }

  function applyPoseToTrack(tr, pose, baseA) {
    var sm = smoothPose(
      { yaw: tr.yaw, pitch: tr.pitch, roll: tr.roll, z: tr.z, nx: tr.nx, ny: tr.ny },
      pose,
      baseA
    );
    tr.yaw = sm.yaw;
    tr.pitch = sm.pitch;
    tr.roll = sm.roll;
    tr.z = sm.z;
    tr.nx = sm.nx;
    tr.ny = sm.ny;
    /* box center velocity → pan assist when mesh weak / phone lag */
    if (tr.box && tr._lastBoxCx != null && ui.poseFast) {
      var cx = tr.box.x + tr.box.width * 0.5;
      var cy = tr.box.y + tr.box.height * 0.5;
      var vw = tr._vw || lastSrcW || 640;
      var vh = tr._vh || lastSrcH || 480;
      var vx = (cx - tr._lastBoxCx) / Math.max(1, vw);
      var vy = (cy - tr._lastBoxCy) / Math.max(1, vh);
      /* only blend when box is moving more than pose (soft light nose fails) */
      if (Math.abs(vx) > 0.004) tr.yaw = clamp(tr.yaw + vx * 3.2, -1.35, 1.35);
      if (Math.abs(vy) > 0.004) tr.pitch = clamp(tr.pitch + vy * 2.8, -1.35, 1.35);
      tr._lastBoxCx = cx;
      tr._lastBoxCy = cy;
    } else if (tr.box) {
      tr._lastBoxCx = tr.box.x + tr.box.width * 0.5;
      tr._lastBoxCy = tr.box.y + tr.box.height * 0.5;
    }
  }

  function matchTracks(dets) {
    var usedT = {},
      usedD = {};
    var pairs = [];
    for (var t = 0; t < tracks.length; t++)
      for (var d = 0; d < dets.length; d++) pairs.push({ t: t, d: d, s: iou(tracks[t].box, dets[d]) });
    pairs.sort(function (a, b) {
      return b.s - a.s;
    });
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i].s < 0.15) break;
      if (usedT[pairs[i].t] || usedD[pairs[i].d]) continue;
      usedT[pairs[i].t] = 1;
      usedD[pairs[i].d] = 1;
      var tr = tracks[pairs[i].t],
        det = dets[pairs[i].d];
      var a = 0.2;
      tr.box.x = lerp(tr.box.x, det.x, a);
      tr.box.y = lerp(tr.box.y, det.y, a);
      tr.box.width = lerp(tr.box.width, det.width, a);
      tr.box.height = lerp(tr.box.height, det.height, a);
      tr.conf = lerp(tr.conf, 0.9, 0.28);
      tr.hold = 0;
      tr._hit = true;
    }
    for (var d2 = 0; d2 < dets.length; d2++) {
      if (usedD[d2] || tracks.length >= MAX_FACES) continue;
      var id = nextId++;
      tracks.push({
        id: id,
        box: Object.assign({}, dets[d2]),
        conf: 0.75,
        hold: 0,
        scaleRef: 0,
        yaw: 0,
        pitch: 0,
        roll: 0,
        z: 0,
        rosterId: trackAssign[id] || null,
        lm: null,
        path: [], /* 2d image-space fencing trails [{x,y,z,v,t,tip}] */
        path3: [], /* spatial pose path for 3d gsplat */
        vel: 0,
      });
    }
    tracks = tracks.filter(function (tr) {
      if (tr._hit) {
        tr._hit = false;
        return true;
      }
      tr.hold++;
      tr.conf *= 0.9;
      return tr.hold < 16;
    });
  }

  function autoRoster() {
    var hs = tracks
      .map(function (t) {
        return t.box.height;
      })
      .sort(function (a, b) {
        return a - b;
      });
    var med = hs[Math.floor(hs.length / 2)] || 1;
    var used = {};
    tracks.forEach(function (tr) {
      if (trackAssign[tr.id]) {
        tr.rosterId = trackAssign[tr.id];
        used[tr.rosterId] = 1;
        return;
      }
      /* size heuristic only until user clicks */
      var prefer = tr.box.height / med < 0.72 ? "p3" : tr.box.height / med > 1.08 ? "p1" : "p2";
      if (used[prefer]) prefer = "p4";
      tr.rosterId = prefer;
      trackAssign[tr.id] = prefer;
      used[prefer] = 1;
    });
    saveAll();
  }

  function poly(ctx, lm, idxs, W, H, close, alpha) {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    var started = false;
    for (var i = 0; i < idxs.length; i++) {
      var p = lm[idxs[i] % lm.length];
      if (!p) continue;
      if (!started) {
        ctx.moveTo(p.x * W, p.y * H);
        started = true;
      } else ctx.lineTo(p.x * W, p.y * H);
    }
    if (close && started) ctx.closePath();
    if (started) ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function hexA(hex, a) {
    if (!hex || hex[0] !== "#") return "rgba(140,200,255," + a + ")";
    var r = parseInt(hex.slice(1, 3), 16),
      g = parseInt(hex.slice(3, 5), 16),
      b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  /*
   * Daito / fencing-style movement path contrails
   * Tip tracks (nose = foil tip, gaze = line of intent) with velocity color.
   * Inspired by Rhizomatiks motion viz + fencing tip trajectory estimation.
   */
  function ensurePath(tr) {
    if (!tr.path) tr.path = [];
    if (!tr.path3) tr.path3 = [];
    if (tr.vel == null) tr.vel = 0;
  }

  function pushPathSample(tr) {
    if (!tr.lm) return;
    ensurePath(tr);
    var N = tr.lm[TOPO.N];
    var L = tr.lm[TOPO.L];
    var R = tr.lm[TOPO.R];
    var F = tr.lm[TOPO.F];
    if (!N) return;
    var tips = ui.pathTips || "all";
    var now = Date.now();
    var samples = [];
    if (tips === "all" || tips === "nose") {
      samples.push({ tip: "nose", x: N.x, y: N.y, z: N.z || 0 });
    }
    if (tips === "all" || tips === "gaze") {
      if (L && R) {
        samples.push({
          tip: "gaze",
          x: (L.x + R.x) * 0.5,
          y: (L.y + R.y) * 0.5,
          z: ((L.z || 0) + (R.z || 0)) * 0.5,
        });
      }
    }
    if (tips === "all" && F) {
      samples.push({ tip: "brow", x: F.x, y: F.y, z: F.z || 0 });
    }
    samples.forEach(function (s) {
      var last = null;
      for (var i = tr.path.length - 1; i >= 0; i--) {
        if (tr.path[i].tip === s.tip) {
          last = tr.path[i];
          break;
        }
      }
      var dx = last ? s.x - last.x : 0;
      var dy = last ? s.y - last.y : 0;
      var dist = Math.hypot(dx, dy);
      if (last && dist < PATH_MIN_DIST) return; /* deadband */
      var dt = last ? Math.max(8, now - last.t) : 16;
      var v = dist / (dt / 1000); /* norm-units / sec */
      tr.vel = lerp(tr.vel || 0, v, 0.35);
      tr.path.push({
        tip: s.tip,
        x: s.x,
        y: s.y,
        z: s.z,
        v: v,
        t: now,
        yaw: tr.yaw || 0,
        pitch: tr.pitch || 0,
      });
    });
    while (tr.path.length > PATH_MAX * 3) tr.path.shift();

    /* spatial 3d path (for gsplat column) */
    var sp = spatialPose({
      yaw: tr.yaw,
      pitch: tr.pitch,
      roll: tr.roll,
      z: tr.z,
      nx: tr.nx,
      ny: tr.ny,
    });
    var p3last = tr.path3.length ? tr.path3[tr.path3.length - 1] : null;
    if (!p3last || Math.hypot(sp.yaw - p3last.yaw, sp.pitch - p3last.pitch) > 0.012) {
      tr.path3.push({
        yaw: sp.yaw,
        pitch: sp.pitch,
        z: sp.z,
        v: tr.vel || 0,
        t: now,
      });
      while (tr.path3.length > PATH_MAX) tr.path3.shift();
    }
  }

  function speedColor(v, a) {
    /* slow cyan → mid white → fast warm (fencing flash) — not hot pink thrash */
    var t = clamp(v / 1.8, 0, 1);
    var r = Math.floor(100 + t * 140);
    var g = Math.floor(190 + t * 40);
    var b = Math.floor(255 - t * 80);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function drawPathContrails(ctx, tr, W, H, pathAlpha) {
    if (!ui.showPaths || !tr.path || tr.path.length < 2) return;
    var tips = {};
    tr.path.forEach(function (p) {
      if (!tips[p.tip]) tips[p.tip] = [];
      tips[p.tip].push(p);
    });
    var baseW = 1.4 * (ui.pathWidth || 1);
    Object.keys(tips).forEach(function (tip) {
      var arr = tips[tip];
      if (arr.length < 2) return;
      /* multi-segment ribbon with per-segment speed color + age fade */
      for (var i = 1; i < arr.length; i++) {
        var a0 = arr[i - 1],
          a1 = arr[i];
        var age = i / arr.length;
        var alpha = pathAlpha * (0.15 + age * 0.85);
        var v = (a0.v + a1.v) * 0.5;
        ctx.strokeStyle = speedColor(v, alpha);
        ctx.lineWidth = baseW * (0.45 + age * 0.9) * (tip === "nose" ? 1.15 : tip === "gaze" ? 0.9 : 0.7);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(a0.x * W, a0.y * H);
        ctx.lineTo(a1.x * W, a1.y * H);
        ctx.stroke();
      }
      /* tip head (fencing tip) */
      var tipP = arr[arr.length - 1];
      ctx.fillStyle = speedColor(tipP.v, pathAlpha);
      ctx.beginPath();
      ctx.arc(tipP.x * W, tipP.y * H, 2.2 + Math.min(3, tipP.v * 1.2), 0, Math.PI * 2);
      ctx.fill();
      /* velocity vector tick */
      if (arr.length >= 3) {
        var prev = arr[arr.length - 3];
        var vx = tipP.x - prev.x,
          vy = tipP.y - prev.y;
        var len = Math.hypot(vx, vy) || 1e-6;
        var scale = 0.04 * (1 + Math.min(2, tipP.v));
        ctx.strokeStyle = speedColor(tipP.v, pathAlpha * 0.9);
        ctx.lineWidth = baseW * 1.1;
        ctx.beginPath();
        ctx.moveTo(tipP.x * W, tipP.y * H);
        ctx.lineTo(tipP.x * W + (vx / len) * W * scale, tipP.y * H + (vy / len) * H * scale);
        ctx.stroke();
      }
    });
  }

  function drawPath3InGsplat(ctx, tr, W, H) {
    if (!ui.showPaths || !tr.path3 || tr.path3.length < 2) return;
    var arr = tr.path3;
    for (var i = 1; i < arr.length; i++) {
      var a0 = arr[i - 1],
        a1 = arr[i];
      var age = i / arr.length;
      var x0 = W * 0.5 + a0.yaw * W * 0.38;
      var y0 = H * 0.5 + a0.pitch * H * 0.38 - a0.z * H * 0.12;
      var x1 = W * 0.5 + a1.yaw * W * 0.38;
      var y1 = H * 0.5 + a1.pitch * H * 0.38 - a1.z * H * 0.12;
      ctx.strokeStyle = speedColor(a1.v || 0, (ui.pathOpacity || 0.88) * (0.2 + age * 0.8));
      ctx.lineWidth = 1.2 * (ui.pathWidth || 1) * (0.5 + age);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    var tip = arr[arr.length - 1];
    ctx.fillStyle = speedColor(tip.v || 0, ui.pathOpacity || 0.88);
    ctx.beginPath();
    ctx.arc(W * 0.5 + tip.yaw * W * 0.38, H * 0.5 + tip.pitch * H * 0.38 - tip.z * H * 0.12, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function dist2(a, b) {
    var dx = a.x - b.x,
      dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pushHandPathSample(nx, ny, v) {
    if (!ui.handPaths) return;
    var last = handPath.length ? handPath[handPath.length - 1] : null;
    if (last) {
      var d = Math.hypot(nx - last.x, ny - last.y);
      if (d < PATH_MIN_DIST) return;
    }
    handPath.push({ x: nx, y: ny, v: v || 0, t: Date.now() });
    while (handPath.length > PATH_MAX) handPath.shift();
  }

  function drawHandPath(ctx, W, H, alpha) {
    if (!ui.handPaths || handPath.length < 2) return;
    var baseW = 1.6 * (ui.pathWidth || 1);
    for (var i = 1; i < handPath.length; i++) {
      var a0 = handPath[i - 1],
        a1 = handPath[i];
      var age = i / handPath.length;
      ctx.strokeStyle = speedColor(a1.v || 0, alpha * (0.2 + age * 0.8));
      ctx.lineWidth = baseW * (0.4 + age);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a0.x * W, a0.y * H);
      ctx.lineTo(a1.x * W, a1.y * H);
      ctx.stroke();
    }
    var tip = handPath[handPath.length - 1];
    ctx.fillStyle = speedColor(tip.v || 0, alpha);
    ctx.beginPath();
    ctx.arc(tip.x * W, tip.y * H, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Hand IK size-fit (v22):
   *  - Close palm (large span in frame) → scale ≈ 1 (match real hand; NO giant)
   *  - Far/tiny palm → mild boost toward handTargetSpan
   *  - Hard cap: span * s ≤ handMaxSpan (and ≤ ~face height if face present)
   *  - May shrink slightly if previous boost left hand oversized
   */
  function handFovRig(lm) {
    var palmIds = [0, 5, 9, 13, 17];
    var pcx = 0,
      pcy = 0,
      nPalm = 0;
    for (var i = 0; i < palmIds.length; i++) {
      var p = lm[palmIds[i]];
      if (!p) continue;
      pcx += p.x;
      pcy += p.y;
      nPalm++;
    }
    if (!nPalm) return { pcx: 0.5, pcy: 0.5, span: 0.1, s: 1, auto: 1, zBoost: 1, target: 0.16 };
    pcx /= nPalm;
    pcy /= nPalm;
    var span = 0,
      nTip = 0;
    for (var t = 0; t < HAND_TIPS.length; t++) {
      var tip = lm[HAND_TIPS[t]];
      if (!tip) continue;
      span += Math.hypot(tip.x - pcx, tip.y - pcy);
      nTip++;
    }
    span = nTip ? span / nTip : 0.08;
    span = Math.max(0.02, span);

    var target = ui.handTargetSpan != null ? +ui.handTargetSpan : HAND_TARGET_SPAN;
    var maxSpan = ui.handMaxSpan != null ? +ui.handMaxSpan : HAND_MAX_SPAN;
    try {
      if (window.__mgLens && window.__mgLens.handTargetSpan) {
        /* lens may suggest a mild far-hand target — never force huge */
        target = Math.min(0.2, Math.max(target, window.__mgLens.handTargetSpan() * 0.55));
      }
    } catch (eT) {}

    var faceH = 0;
    if (ui.handMatchFace !== false && tracks[0] && tracks[0].box) {
      var vh = tracks[0]._vh || lastSrcH || 960;
      faceH = (tracks[0].box.height || 0) / Math.max(1, vh);
      if (faceH > 0.05 && faceH < 0.6) {
        /* open hand at same depth ≈ 0.75–0.95 face height — use as CAP not inflate floor */
        maxSpan = Math.min(maxSpan, Math.max(0.14, faceH * 0.9));
      }
    }

    var auto = 1;
    if (ui.handRigAuto !== false) {
      if (span >= maxSpan * 0.92) {
        /* already large / close — stay true to landmarks (maybe tiny shrink) */
        auto = Math.min(1, maxSpan / span);
      } else if (span >= target) {
        /* mid size — no boost */
        auto = 1;
      } else {
        /* far / tiny — mild boost only */
        auto = Math.min(1.85, target / span);
      }
    }
    var manual = ui.handRigScale != null ? +ui.handRigScale : 1.0;
    if (!(manual > 0.5)) manual = 1;
    var s = auto * manual;
    /* hard cap: never let drawn span exceed maxSpan */
    if (span * s > maxSpan) s = maxSpan / span;
    /* clamp overall */
    s = Math.max(0.75, Math.min(2.0, s));

    var zBoost = 1 + Math.max(0, s - 1) * 0.35;
    return {
      pcx: pcx,
      pcy: pcy,
      span: span,
      s: s,
      auto: auto,
      zBoost: zBoost,
      target: target,
      maxSpan: maxSpan,
      faceH: faceH,
    };
  }

  /**
   * Landmark → overlay px.
   * When #pip-overlay is CSS scaleX(-1) (selfie), landmarks stay in JPEG space
   * and the CSS flip aligns them with the mirrored video. Flipping here too
   * double-mirrors → inverted hand (thumb/pinky swapped like bad controller).
   */
  function lmToPx(nx, ny, W, H) {
    var mirrorDraw = ui.handLandmarkMirror === true;
    /* if CSS already mirrors the overlay, never double-flip */
    if (ui.pipCssMirror !== false && ui.handLandmarkMirror !== true) {
      mirrorDraw = false;
    }
    try {
      if (typeof window.__mgMapCover === "function") {
        var m = window.__mgMapCover(nx, ny, W, H, {
          srcW: lastSrcW,
          srcH: lastSrcH,
          mirror: mirrorDraw,
        });
        return { x: m.x, y: m.y };
      }
    } catch (eM) {}
    /* fallback: same rule as cover map */
    var x = mirrorDraw ? (1 - nx) * W : nx * W;
    return { x: x, y: ny * H };
  }

  /** Inspect-only expansion hands (Ender / Ash-Thorp rings) — never touches main body */
  function drawHandsInspect(ctx, W, H) {
    if (!ui.showHands) {
      handGesture.present = false;
      return;
    }
    var hands = lastHands;
    var a = ui.handOpacity != null ? ui.handOpacity : 0.72;
    if (!hands || !hands.length) {
      handGesture.present = false;
      /* faint idle air-pointer hint */
      if (tracks[0] && tracks[0].lm) {
        ctx.fillStyle = "rgba(120,180,220," + (a * 0.12).toFixed(2) + ")";
        ctx.font = "600 9px ui-monospace, Menlo, monospace";
        ctx.fillText("HANDS · waiting (raise palm into frame)", 10, H - 12);
      }
      return;
    }
    var maxExpand = 0;
    var primary = null;
    var lastRigS = 1;
    for (var hi = 0; hi < hands.length; hi++) {
      var lm = hands[hi];
      if (!lm || lm.length < 21) continue;
      var rig = handFovRig(lm);
      lastRigS = rig.s;
      function HP(i) {
        var p = lm[i];
        var nx = rig.pcx + (p.x - rig.pcx) * rig.s;
        var ny = rig.pcy + (p.y - rig.pcy) * rig.s;
        /* soft clamp so expanded tips stay drawable */
        if (nx < -0.08) nx = -0.08;
        if (nx > 1.08) nx = 1.08;
        if (ny < -0.08) ny = -0.08;
        if (ny > 1.08) ny = 1.08;
        var px = lmToPx(nx, ny, W, H);
        return {
          x: px.x,
          y: px.y,
          nx: nx,
          ny: ny,
          z: (p.z || 0) * rig.zBoost,
        };
      }
      var wrist = HP(0);
      var idxTip = HP(8);
      var thumbTip = HP(4);
      var palmPts = [0, 5, 9, 13, 17].map(HP);
      var palmCx = 0,
        palmCy = 0;
      for (var pi = 0; pi < palmPts.length; pi++) {
        palmCx += palmPts[pi].x;
        palmCy += palmPts[pi].y;
      }
      palmCx /= palmPts.length;
      palmCy /= palmPts.length;
      var openSpan = 0;
      for (var ti = 0; ti < HAND_TIPS.length; ti++) openSpan += dist2(wrist, HP(HAND_TIPS[ti]));
      openSpan /= HAND_TIPS.length;
      /* expand relative to scaled span (phone FOV already compensated) */
      var expandN = Math.max(0, Math.min(1.8, openSpan / Math.max(H * 0.14, 1) - 0.2));
      var pinchD = dist2(thumbTip, idxTip);
      var pinchN = Math.max(0.35, Math.min(1.8, pinchD / Math.max(H * 0.05, 1)));
      if (expandN > maxExpand) maxExpand = expandN;
      if (!primary) {
        primary = {
          nx: idxTip.nx,
          ny: idxTip.ny,
          pinch: pinchN,
          expand: expandN,
          palmX: palmCx / W,
          palmY: palmCy / H,
          rigS: rig.s,
        };
      }
      /* palm rings — grow with FOV rig so they don't look like pin-dots */
      var ringMax = (26 + expandN * 85) * Math.sqrt(rig.s);
      for (var r = 0; r < 4; r++) {
        var rr = ringMax * (0.35 + r * 0.22);
        ctx.beginPath();
        ctx.arc(palmCx, palmCy, rr, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(120,200,255," + (a * (0.35 - r * 0.05)).toFixed(2) + ")";
        ctx.lineWidth = (1.1 + (3 - r) * 0.4) * Math.min(1.8, Math.sqrt(rig.s));
        ctx.stroke();
      }
      /* skeleton */
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      var lw = Math.min(2.8, 1.4 * Math.sqrt(rig.s));
      for (var ci = 0; ci < HAND_CHAINS.length; ci++) {
        var ch = HAND_CHAINS[ci];
        ctx.beginPath();
        for (var j = 0; j < ch.length; j++) {
          var q = HP(ch[j]);
          if (j === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        }
        ctx.strokeStyle = "rgba(140,210,255," + (a * (ci === 5 ? 0.45 : 0.7)).toFixed(2) + ")";
        ctx.lineWidth = ci === 5 ? lw * 1.35 : lw;
        ctx.stroke();
      }
      /* Joint pivots: wrist + MCP + PIP + tips — general IK pivots readable under soft light */
      var pivotSet = { 0: 1, 5: 1, 9: 1, 13: 1, 17: 1, 6: 1, 10: 1, 14: 1, 18: 1, 8: 1, 4: 1, 12: 1, 16: 1, 20: 1 };
      var jR = Math.max(2.4, 2.15 * Math.sqrt(rig.s));
      for (var ji = 0; ji < 21; ji++) {
        var jn = HP(ji);
        var isPivot = !!pivotSet[ji];
        var isTip = ji === 8 || ji === 4 || ji === 12 || ji === 16 || ji === 20;
        ctx.fillStyle = isTip
          ? "rgba(255,255,255," + (a * 0.96).toFixed(2) + ")"
          : isPivot
            ? "rgba(160,230,255," + (a * 0.88).toFixed(2) + ")"
            : "rgba(100,180,230," + (a * 0.55).toFixed(2) + ")";
        ctx.beginPath();
        ctx.arc(jn.x, jn.y, ji === 0 ? jR * 1.55 : isPivot ? jR * 1.15 : jR * 0.75, 0, Math.PI * 2);
        ctx.fill();
        if (isPivot) {
          ctx.strokeStyle = "rgba(255,255,255," + (a * 0.35).toFixed(2) + ")";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      /* pinch bond */
      ctx.beginPath();
      ctx.moveTo(thumbTip.x, thumbTip.y);
      ctx.lineTo(idxTip.x, idxTip.y);
      ctx.strokeStyle =
        pinchN < 0.75 ? "rgba(255,220,140," + (a * 0.9).toFixed(2) + ")" : "rgba(140,200,255," + (a * 0.25).toFixed(2) + ")";
      ctx.lineWidth = pinchN < 0.75 ? 2.2 * Math.sqrt(rig.s) : 1;
      ctx.stroke();
      /* air pointer = index tip */
      var cross = 10 * Math.sqrt(rig.s);
      ctx.strokeStyle = "rgba(255,255,255," + (a * 0.85).toFixed(2) + ")";
      ctx.lineWidth = 1.3 * Math.sqrt(rig.s);
      ctx.beginPath();
      ctx.moveTo(idxTip.x - cross, idxTip.y);
      ctx.lineTo(idxTip.x + cross, idxTip.y);
      ctx.moveTo(idxTip.x, idxTip.y - cross);
      ctx.lineTo(idxTip.x, idxTip.y + cross);
      ctx.stroke();
    }
    if (primary) {
      var prev = handGesture;
      /* Display / IPC X: flip when PIP is selfie-mirrored so air pointer matches what you see */
      var ipcNx = primary.nx;
      if (ui.handIpcFlipX !== false && ui.pipCssMirror !== false) {
        ipcNx = 1 - primary.nx;
      }
      var spd = prev.present ? Math.hypot(ipcNx - prev.nx, primary.ny - prev.ny) * 40 : 0;
      handGesture = {
        present: true,
        nx: ipcNx,
        ny: primary.ny,
        pinch: primary.pinch,
        expand: maxExpand,
        conf: 0.9,
        engine: "mediapipe-hands",
        hands: hands,
        rigS: lastRigS,
        rawNx: primary.nx,
      };
      /* path samples in draw space (JPEG/norm, CSS overlay mirrors) */
      pushHandPathSample(primary.nx, primary.ny, spd);
      drawHandPath(ctx, W, H, a * 0.9);
      ctx.fillStyle = "rgba(160,210,255," + (a * 0.75).toFixed(2) + ")";
      ctx.font = "600 8px ui-monospace, Menlo, monospace";
      ctx.fillText(
        "AIR · pinch " +
          primary.pinch.toFixed(2) +
          " · expand " +
          maxExpand.toFixed(2) +
          " · IK×" +
          lastRigS.toFixed(2) +
          " · n" +
          hands.length,
        10,
        H - 12
      );
    }
  }

  function postHand() {
    if (!ui.showHands) return;
    var now = Date.now();
    if (now - lastHandPost < 70) return; /* snappier air pointer from phone */
    lastHandPost = now;
    var h = handGesture;
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({
            op: "track_hand",
            present: !!h.present,
            nx: +(h.nx || 0.5).toFixed(4),
            ny: +(h.ny || 0.5).toFixed(4),
            pinch: +(h.pinch != null ? h.pinch : 1).toFixed(3),
            expand: +(h.expand || 0).toFixed(3),
            conf: +(h.conf || 0).toFixed(3),
            engine: h.engine || "none",
          })
        );
      }
    } catch (e) {}
  }

  /* seamless person alpha matte — not a cartoon circle */
  function drawPersonMatte(ctx, tr, W, H, vw, vh, zoneAlpha) {
    var bx = (tr.box.x / vw) * W;
    var by = (tr.box.y / vh) * H;
    var bw = (tr.box.width / vw) * W;
    var bh = (tr.box.height / vh) * H;
    var cx = bx + bw * 0.5;
    /* head center upper third, body below */
    var headCy = by + bh * 0.28;
    var bodyCy = by + bh * 0.62;
    var headRx = bw * 0.38;
    var headRy = bh * 0.28;
    var bodyRx = bw * 0.48;
    var bodyRy = bh * 0.42;
    var a = (ui.matteOpacity || 0.55) * zoneAlpha;

    /* body soft matte — sparse, face stays clear */
    var g1 = ctx.createRadialGradient(cx, bodyCy, bodyRx * 0.2, cx, bodyCy, Math.max(bodyRx, bodyRy));
    g1.addColorStop(0, "rgba(40,80,120," + (a * 0.28) + ")");
    g1.addColorStop(0.5, "rgba(30,60,90," + (a * 0.1) + ")");
    g1.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.ellipse(cx, bodyCy, bodyRx, bodyRy, 0, 0, Math.PI * 2);
    ctx.fill();

    /* head soft matte — light veil only (never opaque) */
    var g2 = ctx.createRadialGradient(cx, headCy, headRx * 0.2, cx, headCy, Math.max(headRx, headRy) * 1.05);
    g2.addColorStop(0, "rgba(50,100,150," + (a * 0.22) + ")");
    g2.addColorStop(0.55, "rgba(40,80,120," + (a * 0.08) + ")");
    g2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.ellipse(cx, headCy, headRx, headRy, 0, 0, Math.PI * 2);
    ctx.fill();

    /* edge feather only — no filled disc over face */
    ctx.strokeStyle = "rgba(160,200,230," + Math.min(0.45, a * 0.9) + ")";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, headCy, headRx * 0.98, headRy * 0.98, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawAll() {
    var d = sizeOv();
    if (!d.ov) return;
    var W = d.W,
      H = d.H,
      ctx = d.ov.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    var vw = (tracks[0] && tracks[0]._vw) || 1;
    var vh = (tracks[0] && tracks[0]._vh) || 1;
    var meshA = ui.alwaysMesh ? ui.meshOpacity : 0;

    var ordered = tracks.slice().sort(function (a, b) {
      return (a.scale || 0) - (b.scale || 0);
    });

    ordered.forEach(function (tr) {
      if (!tr.lm) return;
      var ro = rosterById(tr.rosterId || trackAssign[tr.id] || "p4");
      var zone = ZONES[ro.zone] || ZONES.near;
      var col = ro.color || "#8ec8ff";
      var lm = tr.lm;
      var mA = meshA * (zone.mesh || 1);

      /* person alpha first — very light so face stays readable */
      drawPersonMatte(ctx, tr, W, H, vw, vh, Math.min(0.55, zone.alpha || 0.45));

      /* path contrails under mesh (movement estimation) */
      if (ui.showPaths !== false) {
        drawPathContrails(ctx, tr, W, H, (ui.pathOpacity || 0.55) * 0.85 * (zone.mesh || 1));
      }

      /* always-on mesh at opacity */
      if (mA > 0.05) {
        if (ui.showLattice !== false) {
          /* sparse point cloud (every 2nd) so face pixels show through */
          for (var j = 0; j < lm.length; j += 2) {
            var p = lm[j];
            var zz = p.z || 0;
            ctx.fillStyle =
              "rgba(" +
              Math.floor(90 + zz * 100) +
              "," +
              Math.floor(165 + zz * 50) +
              ",255," +
              (mA * (0.12 + Math.min(0.28, Math.abs(zz) * 1.6))) +
              ")";
            ctx.fillRect(p.x * W - 0.4, p.y * H - 0.4, 0.9 + Math.max(0, zz) * 1.4, 0.9 + Math.max(0, zz) * 1.4);
          }
          ctx.lineWidth = 0.4;
          ctx.strokeStyle = hexA(col, mA * 0.14);
          var cols = 26,
            rows = 18;
          for (var gy = 0; gy < rows; gy++) {
            for (var gx = 0; gx < cols; gx++) {
              var idx = gy * cols + gx;
              if (idx >= lm.length) continue;
              var a0 = lm[idx];
              if (gx + 1 < cols && lm[idx + 1]) {
                ctx.beginPath();
                ctx.moveTo(a0.x * W, a0.y * H);
                ctx.lineTo(lm[idx + 1].x * W, lm[idx + 1].y * H);
                ctx.stroke();
              }
              if (gy + 1 < rows && lm[idx + cols]) {
                ctx.beginPath();
                ctx.moveTo(a0.x * W, a0.y * H);
                ctx.lineTo(lm[idx + cols].x * W, lm[idx + cols].y * H);
                ctx.stroke();
              }
            }
          }
        }
        if (ui.showFeatures !== false) {
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = hexA(col, mA * 0.85);
          poly(ctx, lm, TOPO.oval, W, H, true, mA);
          ctx.strokeStyle = "rgba(130,210,255," + mA * 0.9 + ")";
          poly(ctx, lm, TOPO.leftEye, W, H, true, mA);
          poly(ctx, lm, TOPO.rightEye, W, H, true, mA);
          poly(ctx, lm, TOPO.leftBrow, W, H, false, mA * 0.85);
          poly(ctx, lm, TOPO.rightBrow, W, H, false, mA * 0.85);
          ctx.strokeStyle = "rgba(160,240,210," + mA * 0.8 + ")";
          poly(ctx, lm, TOPO.nose, W, H, false, mA);
          ctx.strokeStyle = "rgba(150,200,255," + mA * 0.85 + ")";
          poly(ctx, lm, TOPO.lipsOuter, W, H, true, mA);
        }

        /* 6DOF axis (short) */
        var N = lm[TOPO.N],
          L = lm[TOPO.L],
          R = lm[TOPO.R];
        if (N && L && R) {
          var ox = N.x * W,
            oy = N.y * H;
          var axisLen = Math.hypot(R.x - L.x, R.y - L.y) * W * 0.5;
          var sp = spatialPose({
            yaw: tr.yaw,
            pitch: tr.pitch,
            roll: tr.roll,
            z: tr.z,
            nx: tr.nx,
            ny: tr.ny,
          });
          ctx.globalAlpha = mA;
          ctx.strokeStyle = "rgba(100,255,210,0.95)";
          ctx.lineWidth = 1.7;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox - sp.yaw * axisLen * 0.85, oy + sp.pitch * axisLen * 0.32);
          ctx.stroke();
          ctx.strokeStyle = "rgba(140,200,255,0.85)";
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(L.x * W, L.y * H);
          ctx.lineTo(R.x * W, R.y * H);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        /* mean mesh ghost if MOCAP/HDRI ref */
        if (spatial.meanMesh && spatial.refType) {
          ctx.strokeStyle = "rgba(255,255,255," + mA * 0.18 + ")";
          ctx.lineWidth = 0.8;
          poly(ctx, spatial.meanMesh, TOPO.oval, W, H, true, mA * 0.25);
        }
      }

      /* identity plate — adult typography */
      ctx.save();
      ctx.scale(-1, 1);
      var sp2 = spatialPose({
        yaw: tr.yaw,
        pitch: tr.pitch,
        roll: tr.roll,
        z: tr.z,
        nx: tr.nx,
        ny: tr.ny,
      });
      var plate =
        ro.name +
        " · " +
        zone.label +
        (spatial.locked ? " · LOCK" : "") +
        " · Y" +
        sp2.yaw.toFixed(2) +
        " Z" +
        sp2.z.toFixed(2) +
        " · v" +
        (tr.vel || 0).toFixed(2);
      ctx.font = "600 9px ui-monospace,Menlo,monospace";
      var tw = ctx.measureText(plate).width;
      var lx = -((tr.nx || 0.5) * W);
      var ly = Math.max(18, ((tr.ny || 0.3) * H) - (tr.box.height / vh) * H * 0.42);
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(lx - tw * 0.5 - 5, ly - 11, tw + 10, 16);
      ctx.fillStyle = col;
      ctx.fillText(plate, lx - tw * 0.5, ly);
      ctx.restore();
    });

    ctx.save();
    ctx.scale(-1, 1);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(-W + 8, 8, 230, 38);
    ctx.fillStyle = "rgba(180,210,230,0.92)";
    ctx.font = "600 8px ui-monospace,Menlo,monospace";
    ctx.fillText(
      "MESH α " +
        ui.meshOpacity.toFixed(2) +
        " · PATH α " +
        (ui.pathOpacity || 0.88).toFixed(2) +
        (ui.showPaths !== false ? " · CONTRAIL" : ""),
      -W + 14,
      22
    );
    ctx.fillStyle = spatial.locked ? "rgba(120,230,170,0.95)" : "rgba(200,180,120,0.9)";
    var vAvg = tracks.length
      ? tracks.reduce(function (s, t) {
          return s + (t.vel || 0);
        }, 0) / tracks.length
      : 0;
    ctx.fillText(
      (spatial.locked ? "LOCK" : "OPEN") +
        " · " +
        engine +
        " · tip " +
        (ui.pathTips || "all") +
        " · |v| " +
        vAvg.toFixed(2) +
        (ui.showHands ? " · HANDS" : ""),
      -W + 14,
      36
    );
    ctx.restore();

    /* H1: hands + air pointer on inspect only (after face HUD) */
    drawHandsInspect(ctx, W, H);
  }

  function paintGsplat() {
    var cv = document.getElementById("tri-gsplat-cv");
    if (!cv || !ui.showGsplat) return;
    /* H3: denser path from hurdles when available */
    if (typeof window.__mgDenseGsplat === "function" && tracks.length) {
      try {
        window.__mgDenseGsplat(cv, tracks, (window.__mgHurdles && window.__mgHurdles.h6 && window.__mgHurdles.h6.quality) || 1);
        return;
      } catch (eDg) {}
    }
    var ctx = cv.getContext("2d");
    if (!ctx) return;
    var W = cv.width,
      H = cv.height;
    ctx.fillStyle = "#04060a";
    ctx.fillRect(0, 0, W, H);
    var primary = tracks[0];
    if (!primary || !primary.lm) {
      ctx.fillStyle = "rgba(150,180,210,0.45)";
      ctx.font = "10px ui-monospace,Menlo,monospace";
      ctx.fillText("awaiting mesh", 14, H / 2);
      return;
    }
    var lm = primary.lm;
    var sp = spatialPose({
      yaw: primary.yaw,
      pitch: primary.pitch,
      roll: primary.roll,
      z: primary.z,
      nx: primary.nx,
      ny: primary.ny,
    });
    var n = lm.length,
      cx = 0,
      cy = 0,
      cz = 0;
    for (var i = 0; i < n; i++) {
      cx += lm[i].x;
      cy += lm[i].y;
      cz += lm[i].z || 0;
    }
    cx /= n;
    cy /= n;
    cz /= n;
    var cosY = Math.cos(sp.yaw * 0.95),
      sinY = Math.sin(sp.yaw * 0.95);
    var cosP = Math.cos(sp.pitch * 0.75),
      sinP = Math.sin(sp.pitch * 0.75);
    var cosR = Math.cos(sp.roll || 0),
      sinR = Math.sin(sp.roll || 0);
    var pts = 0;
    for (var j = 0; j < n; j++) {
      var x = lm[j].x - cx,
        y = lm[j].y - cy,
        z = (lm[j].z || 0) - cz;
      var x0 = x * cosR - y * sinR;
      var y0 = x * sinR + y * cosR;
      var x1 = x0 * cosY - z * sinY;
      var z1 = x0 * sinY + z * cosY;
      var y1 = y0 * cosP - z1 * sinP;
      var z2 = y0 * sinP + z1 * cosP;
      var sc = 248 * (1.12 + z2 * 0.95 + sp.z * 0.12);
      var sx = W * 0.5 + x1 * sc;
      var sy = H * 0.48 + y1 * sc;
      var rr = 1.3 + Math.max(0, z2) * 4.2;
      ctx.fillStyle =
        "rgba(" +
        Math.floor(100 + z2 * 100) +
        "," +
        Math.floor(170 + z2 * 40) +
        ",255," +
        (0.28 + Math.min(0.5, z2 + 0.2)) * ui.meshOpacity +
        ")";
      ctx.beginPath();
      ctx.arc(sx, sy, rr, 0, Math.PI * 2);
      ctx.fill();
      pts++;
    }
    /* mean mesh overlay if calib ref */
    if (spatial.meanMesh) {
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (var k = 0; k < TOPO.oval.length; k++) {
        var mp = spatial.meanMesh[TOPO.oval[k]];
        if (!mp) continue;
        var mx = (mp.x - cx) * cosY * 248 + W * 0.5;
        var my = (mp.y - cy) * cosP * 248 + H * 0.48;
        if (k === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
      }
      ctx.closePath();
      ctx.stroke();
    }
    /* 3d spatial path contrail in gsplat panel */
    if (primary) drawPath3InGsplat(ctx, primary, W, H);

    var meta = document.getElementById("tri-gsplat-meta");
    if (meta)
      meta.textContent =
        "GSPLAT · " +
        pts +
        (spatial.refType ? " · " + spatial.refType : "") +
        (ui.showPaths !== false ? " · PATH" : "");
  }

  function paintLock() {
    var cv = document.getElementById("tri-depth-cv");
    if (!cv) return;
    var ctx = cv.getContext("2d");
    if (!ctx) return;
    var W = cv.width,
      H = cv.height;
    ctx.fillStyle = "#03050a";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(170,200,220,0.9)";
    ctx.font = "600 10px ui-monospace,Menlo,monospace";
    ctx.fillText(spatial.locked ? "HEAD LOCK ENGAGED" : "HEAD LOCK OPEN", 10, 18);
    if (spatial.rest) {
      ctx.fillStyle = "rgba(140,180,210,0.8)";
      ctx.fillText(
        "rest Y" +
          spatial.rest.yaw.toFixed(2) +
          " P" +
          spatial.rest.pitch.toFixed(2) +
          " Z" +
          spatial.rest.z.toFixed(2),
        10,
        34
      );
    }
    ctx.fillText(
      "extent ±Y" +
        (spatial.extent.yaw || 0).toFixed(2) +
        " ±P" +
        (spatial.extent.pitch || 0).toFixed(2) +
        " ±Z" +
        (spatial.extent.z || 0).toFixed(2),
      10,
      50
    );
    ctx.fillText("ref " + (spatial.refType || "none") + " · mesh α " + ui.meshOpacity.toFixed(2), 10, 66);
    tracks.forEach(function (tr, i) {
      var ro = rosterById(tr.rosterId || "p4");
      var zone = ZONES[ro.zone] || ZONES.near;
      var sp = spatialPose({
        yaw: tr.yaw,
        pitch: tr.pitch,
        roll: tr.roll,
        z: tr.z,
        nx: tr.nx,
        ny: tr.ny,
      });
      ctx.fillStyle = ro.color;
      ctx.fillText(
        ro.name + " [" + zone.label + "]  Y" + sp.yaw.toFixed(2) + " P" + sp.pitch.toFixed(2) + " Z" + sp.z.toFixed(2),
        10,
        88 + i * 16
      );
    });
    var meta = document.getElementById("tri-depth-meta");
    if (meta) meta.textContent = spatial.locked ? "LOCK · ON" : "LOCK · OFF";
  }

  function postPeople() {
    var now = Date.now();
    if (now - lastPost < 55) return; /* faster head pans → main (was 100ms) */
    lastPost = now;
    var people = tracks
      .filter(function (t) {
        return t.lm && t.conf > 0.3;
      })
      .map(function (tr) {
        var ro = rosterById(tr.rosterId || "p4");
        var zone = ZONES[ro.zone] || ZONES.near;
        var sp = spatialPose({
          yaw: tr.yaw,
          pitch: tr.pitch,
          roll: tr.roll,
          z: tr.z,
          nx: tr.nx,
          ny: tr.ny,
        });
        /* privacy: strip name for private zone over IPC if desired */
        var name = zone.id === "private" ? "Private" : ro.name;
        return {
          id: tr.id,
          yaw: +sp.yaw.toFixed(4),
          pitch: +sp.pitch.toFixed(4),
          roll: +sp.roll.toFixed(4),
          z: +sp.z.toFixed(4),
          nx: +(tr.nx || 0.5).toFixed(4),
          ny: +(tr.ny || 0.46).toFixed(4),
          conf: +(tr.conf || 0).toFixed(3),
          scale: +(tr.scale || 0.2).toFixed(4),
          mesh: 468,
          name: name,
          role: ro.role,
          zone: zone.id,
          color: ro.color,
          locked: !!spatial.locked,
          engine: engine,
        };
      });
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(JSON.stringify({ op: "track_people", people: people }));
        if (people[0]) {
          var p = people[0];
          window.ipc.postMessage(
            JSON.stringify({
              op: "track_pose",
              yaw: p.yaw,
              pitch: p.pitch,
              roll: p.roll,
              z: p.z,
              nx: p.nx,
              ny: p.ny,
              conf: p.conf,
              smile: 0,
              brow: 0,
              jaw: 0,
              engine: engine,
            })
          );
        }
      }
    } catch (e) {}
  }

  function rebuild(vw, vh) {
    tracks.forEach(function (tr) {
      var built = buildMesh468(tr.box, vw, vh, tr.scaleRef);
      tr.lm = built.lm;
      tr.scaleRef = built.scaleRef;
      tr.scale = built.scale;
      var pose = poseFromMesh(tr.lm);
      applyPoseToTrack(tr, pose, 0.38);
      /* movement estimation sample (fencing tip path) */
      if (ui.showPaths !== false) pushPathSample(tr);
    });
  }

  function render(vw, vh) {
    rebuild(vw || 640, vh || 480);
    autoRoster();
    sampleExtentIfNeeded();
    drawAll();
    paintGsplat();
    paintLock();
    postPeople();
    postHand();
    if (lbl) {
      var t = tracks[0];
      if (t && t.lm) {
        var ro = rosterById(t.rosterId || "p1");
        var sp = spatialPose({
          yaw: t.yaw,
          pitch: t.pitch,
          roll: t.roll,
          z: t.z,
          nx: t.nx,
          ny: t.ny,
        });
        lbl.textContent =
          ro.name +
          " · MESH · " +
          (spatial.locked ? "LOCK" : "OPEN") +
          (handGesture.present ? " · AIR" : ui.showHands ? " · HANDS…" : "") +
          " · Y" +
          sp.yaw.toFixed(2) +
          " Z" +
          sp.z.toFixed(2);
      } else lbl.textContent = "MESH · acquiring…";
    }
    try {
      if (window.__mgSysStillOk) window.__mgSysStillOk();
    } catch (e) {}
    /* status only — never rebuild buttons mid-frame (kills clicks) */
    paintStatusOnly();
  }

  /* MediaPipe optional */
  function tryMediaPipe() {
    if (HP._mp15) return;
    HP._mp15 = true;
    var base = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/";
    function load(src) {
      return new Promise(function (res, rej) {
        var sc = document.createElement("script");
        sc.src = src;
        sc.onload = res;
        sc.onerror = rej;
        document.head.appendChild(sc);
      });
    }
    load(base + "face_mesh.js")
      .then(function () {
        if (typeof FaceMesh === "undefined") throw new Error("no FaceMesh");
        var mesh = new FaceMesh({
          locateFile: function (f) {
            return base + f;
          },
        });
        mesh.setOptions({
          maxNumFaces: MAX_FACES,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        mesh.onResults(function (results) {
          mpBusy = false;
          if (!results.multiFaceLandmarks || !results.multiFaceLandmarks.length) return;
          var vw = (trackImg && trackImg.naturalWidth) || 640;
          var vh = (trackImg && trackImg.naturalHeight) || 480;
          var dets = [];
          var lms = [];
          results.multiFaceLandmarks.forEach(function (raw) {
            var pts = [];
            var minX = 1,
              minY = 1,
              maxX = 0,
              maxY = 0;
            for (var i = 0; i < raw.length; i++) {
              pts.push({ x: raw[i].x, y: raw[i].y, z: raw[i].z || 0 });
              minX = Math.min(minX, raw[i].x);
              minY = Math.min(minY, raw[i].y);
              maxX = Math.max(maxX, raw[i].x);
              maxY = Math.max(maxY, raw[i].y);
            }
            dets.push({
              x: minX * vw,
              y: minY * vh,
              width: (maxX - minX) * vw,
              height: (maxY - minY) * vh * 1.35,
            });
            lms.push(pts);
          });
          matchTracks(dets);
          tracks.forEach(function (t, i) {
            t._vw = vw;
            t._vh = vh;
            if (lms[i]) {
              t.lm = lms[i];
              var pose = poseFromMesh(t.lm);
              applyPoseToTrack(t, pose, 0.42);
              t.scale = t.box.width / vw;
              t.conf = 0.93;
              if (ui.showPaths !== false) pushPathSample(t);
            }
          });
          engine = "mediapipe-468";
          autoRoster();
          sampleExtentIfNeeded();
          drawAll();
          paintGsplat();
          paintLock();
          postPeople();
          postHand();
        });
        mpFace = mesh;
        ok("MediaPipe Face Mesh · true 468 · path tips");
        tryMediaPipeHands();
      })
      .catch(function () {
        engine = "lattice-468";
        tryMediaPipeHands();
      });
  }

  /** H1: MediaPipe Hands on inspect still-pipe only (no extra cam) */
  function tryMediaPipeHands() {
    if (HP._mpHands17) return;
    HP._mpHands17 = true;
    if (!ui.showHands) return;
    mpHandsLoading = true;
    var handBase = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/";
    function load(src) {
      return new Promise(function (res, rej) {
        var sc = document.createElement("script");
        sc.src = src;
        sc.onload = res;
        sc.onerror = rej;
        document.head.appendChild(sc);
      });
    }
    load(handBase + "hands.js")
      .then(function () {
        if (typeof Hands !== "function") throw new Error("Hands missing");
        var hands = new Hands({
          locateFile: function (f) {
            return handBase + f;
          },
        });
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 0 /* lighter — thrash guard */,
          minDetectionConfidence: 0.55,
          minTrackingConfidence: 0.5,
        });
        hands.onResults(function (results) {
          mpHandsBusy = false;
          lastHands = (results && results.multiHandLandmarks) || [];
          if (Date.now() - lastRender > 50) {
            lastRender = Date.now();
            var vw = (trackImg && trackImg.naturalWidth) || 640;
            var vh = (trackImg && trackImg.naturalHeight) || 480;
            drawAll();
            postHand();
            if (lbl && handGesture.present) {
              lbl.textContent = (lbl.textContent || "").replace(/ · HANDS…| · AIR/g, "") + " · AIR";
            }
          }
        });
        mpHands = hands;
        mpHandsLoading = false;
        ok("H1 MediaPipe Hands · inspect air pointer · thrash-safe");
      })
      .catch(function (err) {
        mpHandsLoading = false;
        mpHands = null;
        warn("Hands CDN offline · toggle HANDS when network allows · " + (err && err.message ? err.message : "err"));
      });
  }
  tryMediaPipe();

  var fd = null;
  try {
    if (typeof FaceDetector !== "undefined") fd = new FaceDetector({ fastMode: true, maxDetectedFaces: MAX_FACES });
  } catch (e) {}

  var busy = false;
  var handTick = 0;
  function tick() {
    setTimeout(function () {
      requestAnimationFrame(tick);
    }, 120);
    if (busy) return;
    busy = true;
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      if (trackImg) trackImg.src = img.src;
      var vw = img.naturalWidth || 1,
        vh = img.naturalHeight || 1;
      lastSrcW = vw;
      lastSrcH = vh;
      try {
        if (window.__mgLens && window.__mgLens.setSourceSize) {
          window.__mgLens.setSourceSize(vw, vh);
        }
      } catch (eLens) {}
      /* H1: alternate / throttle hands send so face path stays primary */
      handTick++;
      if (ui.showHands && mpHands && !mpHandsBusy && handTick % 2 === 0) {
        try {
          mpHandsBusy = true;
          mpHands.send({ image: img });
        } catch (eH) {
          mpHandsBusy = false;
        }
      } else if (ui.showHands && !mpHands && typeof window.__mgHeuristicHands === "function" && handTick % 3 === 0) {
        try {
          var hh = window.__mgHeuristicHands(img);
          if (hh && hh.length) {
            lastHands = hh;
            handGesture.present = true;
            handGesture.engine = "heuristic-hands";
            handGesture.hands = hh;
            handGesture.nx = hh[0][8] ? hh[0][8].x : 0.5;
            handGesture.ny = hh[0][8] ? hh[0][8].y : 0.5;
            handGesture.conf = 0.55;
            if (typeof window.__mgH1NoteHands === "function")
              window.__mgH1NoteHands({ present: true, engine: "heuristic-hands" });
          }
        } catch (eHe) {}
      } else if (!ui.showHands) {
        lastHands = [];
        handGesture.present = false;
      }
      if (mpFace && !mpBusy) {
        try {
          mpBusy = true;
          mpFace.send({ image: img });
          busy = false;
          return;
        } catch (e) {
          mpBusy = false;
        }
      }
      function done(dets) {
        matchTracks(dets);
        tracks.forEach(function (t) {
          t._vw = vw;
          t._vh = vh;
        });
        if (Date.now() - lastRender > 70) {
          lastRender = Date.now();
          render(vw, vh);
        }
        busy = false;
      }
      if (fd) {
        fd.detect(img)
          .then(function (faces) {
            var dets = [];
            if (faces)
              for (var i = 0; i < faces.length && i < MAX_FACES; i++) {
                var b = faces[i].boundingBox;
                if (b && b.width > 10) dets.push(padBox({ x: b.x, y: b.y, width: b.width, height: b.height }, vw, vh));
              }
            done(dets);
          })
          .catch(function () {
            busy = false;
          });
      } else {
        done([padBox({ x: vw * 0.26, y: vh * 0.1, width: vw * 0.48, height: vh * 0.75 }, vw, vh)]);
      }
      if (Math.random() < 0.1) {
        var page = document.getElementById("tri-page-img");
        if (page) page.src = GLASS + "?t=" + Date.now();
      }
    };
    img.onerror = function () {
      busy = false;
      if (tracks.length) render(tracks[0]._vw, tracks[0]._vh);
    };
    img.src = FACE + "?t=" + Date.now();
  }

  ok("H1 hands/air · path contrails · spatial lock · " + VER);
  tick();

  window.__mgRoster = roster;
  window.__mgSpatial = spatial;
  window.__mgCalibUI = ui;
  window.__mgHandGesture = handGesture;
  window.__mgTracks = tracks;
  window.__mgGetTracks = function () {
    return tracks;
  };
  window.__mgGetLastHands = function () {
    return lastHands;
  };
  window.__mgEditSubject = function (id, patch) {
    Object.assign(rosterById(id), patch || {});
    saveAll();
    paintControls();
  };
})();
