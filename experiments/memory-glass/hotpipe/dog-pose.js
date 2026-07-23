/* Memory Glass · dog / pet IK track (quadruped)
 * Tracks dogs that walk through still-pipe / PIP — not human BlazePose.
 * Profile: Jinx · ~40 lb Dorgi (Dachshund × Chihuahua × Corgi) long body · short legs.
 *
 * Detect: COCO-SSD (dog) when TF.js available · motion+aspect fallback offline.
 * Draw: after human body skeleton · label JINX · multi-subject friendly.
 *
 * VER: dog-pose-v1-jinx
 */
(function () {
  "use strict";
  var VER = "dog-pose-v1-jinx";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._dogPoseVer === VER) return;
  HP._dogPoseVer = VER;

  var isInspect = false;
  try {
    isInspect = !!document.getElementById("pip-wrap");
  } catch (e0) {}
  if (!isInspect) {
    window.__mgGetDogPose = window.__mgGetDogPose || function () {
      return null;
    };
    return;
  }

  /* ── Subject profile: Jinx ── */
  var JINX = {
    id: "jinx",
    name: "Jinx",
    species: "dog",
    breed: "Dorgi · Dachshund × Chihuahua × Corgi",
    weightLb: 40,
    /* morphology priors (bbox-relative) */
    bodyAspect: 1.9 /* long */,
    legFrac: 0.26 /* short legs */,
    chestFrac: 0.4,
    headFrac: 0.2,
    tailFrac: 0.18,
    minBoxH: 0.06 /* fraction of frame height */,
    minBoxW: 0.05,
    maxBoxH: 0.85,
    color: { r: 255, g: 190, b: 100 },
  };

  var ui = window.__mgCalibUiLive || window.__mgCalibUi || window.__mgCalibUI || {};
  function uiGet(k, d) {
    try {
      if (ui[k] != null) return ui[k];
    } catch (e) {}
    return d;
  }

  var state = (window.__mgDogPose = window.__mgDogPose || {
    ver: VER,
    present: false,
    subjects: [],
    primary: null,
    engine: "none",
    conf: 0,
    updatedAt: 0,
    profile: JINX,
  });
  state.ver = VER;
  state.profile = JINX;

  var detModel = null;
  var detBusy = false;
  var detReady = false;
  var detTried = false;
  var tickN = 0;
  var prevGray = null;
  var prevBox = null;
  var smoothBox = null;
  var canvas = null;
  var ctx2 = null;

  function log(m, lvl) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "ok", String(m || ""), "dog");
    } catch (e) {}
  }

  function mirrorDraw() {
    if (uiGet("handLandmarkMirror", false) === true) return true;
    if (uiGet("pipCssMirror", true) !== false) return false;
    return false;
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var sc = document.createElement("script");
      sc.src = src;
      sc.async = true;
      sc.onload = function () {
        res();
      };
      sc.onerror = function () {
        rej(new Error("load " + src));
      };
      document.head.appendChild(sc);
    });
  }

  function ensureCanvas(w, h) {
    if (!canvas) {
      canvas = document.createElement("canvas");
      ctx2 = canvas.getContext("2d", { willReadFrequently: true });
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return ctx2;
  }

  /* ── COCO-SSD dog detect ── */
  function tryLoadDetector() {
    if (detTried) return;
    detTried = true;
    if (uiGet("showDog", true) === false) return;
    /* lightweight TF.js + coco-ssd */
    var tfUrl = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js";
    var cocoUrl = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js";
    loadScript(tfUrl)
      .then(function () {
        return loadScript(cocoUrl);
      })
      .then(function () {
        if (!window.cocoSsd || !window.cocoSsd.load) throw new Error("cocoSsd missing");
        return window.cocoSsd.load({ base: "lite_mobilenet_v2" });
      })
      .then(function (model) {
        detModel = model;
        detReady = true;
        state.engine = "coco-ssd";
        log("DOG IK · COCO-SSD ready · Jinx profile", "ok");
      })
      .catch(function (err) {
        detModel = null;
        detReady = false;
        state.engine = "motion-fallback";
        log(
          "DOG detect CDN offline · motion+aspect fallback · " +
            (err && err.message ? err.message : "err"),
          "warn"
        );
      });
  }

  function iou(a, b) {
    if (!a || !b) return 0;
    var x1 = Math.max(a.x, b.x);
    var y1 = Math.max(a.y, b.y);
    var x2 = Math.min(a.x + a.w, b.x + b.w);
    var y2 = Math.min(a.y + a.h, b.y + b.h);
    var iw = Math.max(0, x2 - x1);
    var ih = Math.max(0, y2 - y1);
    var inter = iw * ih;
    var u = a.w * a.h + b.w * b.h - inter;
    return u > 0 ? inter / u : 0;
  }

  function emaBox(prev, next, a) {
    if (!next) return prev;
    if (!prev) return next;
    a = a == null ? 0.35 : a;
    return {
      x: prev.x + (next.x - prev.x) * a,
      y: prev.y + (next.y - prev.y) * a,
      w: prev.w + (next.w - prev.w) * a,
      h: prev.h + (next.h - prev.h) * a,
      score: next.score,
      class: next.class || "dog",
    };
  }

  function motionFallback(img) {
    var W = img.naturalWidth || img.width || 0;
    var H = img.naturalHeight || img.height || 0;
    if (W < 16 || H < 16) return null;
    var c = ensureCanvas(Math.min(320, W), Math.min(240, H));
    var cw = canvas.width;
    var ch = canvas.height;
    c.drawImage(img, 0, 0, cw, ch);
    var data = c.getImageData(0, 0, cw, ch).data;
    var gray = new Uint8Array(cw * ch);
    for (var i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    }
    if (!prevGray || prevGray.length !== gray.length) {
      prevGray = gray;
      return prevBox;
    }
    /* motion mass — prefer lower 70% of frame (dog height) */
    var minX = cw,
      minY = ch,
      maxX = 0,
      maxY = 0,
      n = 0;
    var y0 = (ch * 0.15) | 0;
    for (var y = y0; y < ch; y++) {
      for (var x = 0; x < cw; x++) {
        var idx = y * cw + x;
        var d = Math.abs(gray[idx] - prevGray[idx]);
        if (d > 28) {
          n++;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    prevGray = gray;
    if (n < cw * ch * 0.004) return prevBox;
    var bw = (maxX - minX) / cw;
    var bh = (maxY - minY) / ch;
    if (bw < JINX.minBoxW || bh < JINX.minBoxH) return prevBox;
    if (bh > JINX.maxBoxH) return prevBox;
    /* long-body short-height bias for Dorgi */
    var aspect = bw / Math.max(0.001, bh);
    var score = 0.35 + Math.min(0.4, n / (cw * ch * 0.08));
    if (aspect > 1.15) score += 0.12; /* long horizontal blob */
    if (aspect > 1.6) score += 0.08;
    if ((minY + maxY) / 2 / ch > 0.45) score += 0.08; /* lower in frame */
    return {
      x: minX / cw,
      y: minY / ch,
      w: bw,
      h: bh,
      score: Math.min(0.92, score),
      class: "dog-motion",
    };
  }

  function pickDogDetection(preds, imgW, imgH) {
    if (!preds || !preds.length) return null;
    var best = null;
    var bestS = 0;
    for (var i = 0; i < preds.length; i++) {
      var p = preds[i];
      var cls = String(p.class || "").toLowerCase();
      if (cls !== "dog" && cls !== "cat") continue; /* cat filtered lower */
      var b = p.bbox; /* [x,y,w,h] px */
      if (!b || b.length < 4) continue;
      var box = {
        x: b[0] / imgW,
        y: b[1] / imgH,
        w: b[2] / imgW,
        h: b[3] / imgH,
        score: p.score || 0,
        class: cls,
      };
      if (box.h < JINX.minBoxH || box.w < JINX.minBoxW) continue;
      if (box.h > JINX.maxBoxH) continue;
      var aspect = box.w / Math.max(0.001, box.h);
      var s = box.score;
      if (cls === "dog") s += 0.15;
      if (cls === "cat") s -= 0.25;
      /* Dorgi: prefer longer aspect + lower in frame */
      if (aspect >= 1.2) s += 0.08;
      if (aspect >= 1.7) s += 0.1;
      if (box.y + box.h * 0.5 > 0.4) s += 0.06;
      /* size ~40lb medium — mid bbox area preferred */
      var area = box.w * box.h;
      if (area > 0.02 && area < 0.45) s += 0.05;
      if (s > bestS) {
        bestS = s;
        best = box;
      }
    }
    return best;
  }

  /**
   * Build quadruped IK joints in normalized image coords from bbox.
   * Long-body short-leg template for Jinx.
   */
  function buildQuadIk(box) {
    if (!box) return null;
    var P = JINX;
    var x0 = box.x;
    var y0 = box.y;
    var bw = box.w;
    var bh = box.h;
    var cx = x0 + bw * 0.5;
    var facing = 1; /* +1 face right, -1 face left — use motion later */
    if (prevBox) {
      var dx = box.x + box.w * 0.5 - (prevBox.x + prevBox.w * 0.5);
      if (Math.abs(dx) > 0.01) facing = dx >= 0 ? 1 : -1;
    }
    var leg = Math.max(0.08, bh * P.legFrac);
    var bodyY = y0 + bh * (1 - P.legFrac * 0.95) - bh * 0.08;
    var bodyH = bh * (1 - P.legFrac) * 0.55;
    var headW = bw * P.headFrac;
    var noseX = facing > 0 ? x0 + bw - headW * 0.15 : x0 + headW * 0.15;
    var headX = facing > 0 ? x0 + bw - headW * 0.55 : x0 + headW * 0.55;
    var neckX = facing > 0 ? x0 + bw * 0.72 : x0 + bw * 0.28;
    var withersX = facing > 0 ? x0 + bw * 0.62 : x0 + bw * 0.38;
    var midX = cx;
    var hipX = facing > 0 ? x0 + bw * 0.32 : x0 + bw * 0.68;
    var tailX = facing > 0 ? x0 + bw * 0.12 : x0 + bw * 0.88;
    var topY = y0 + bh * 0.12;
    var spineY = bodyY - bodyH * 0.35;
    var bellyY = bodyY + bodyH * 0.15;
    var groundY = y0 + bh * 0.96;

    function J(name, x, y, z) {
      return { name: name, x: x, y: y, z: z || 0, v: 1 };
    }

    var joints = {
      nose: J("nose", noseX, topY + bh * 0.18, 0.02),
      head: J("head", headX, topY + bh * 0.14, 0),
      neck: J("neck", neckX, spineY, 0),
      withers: J("withers", withersX, spineY - bh * 0.02, 0),
      midBack: J("midBack", midX, spineY, 0),
      hip: J("hip", hipX, spineY + bh * 0.02, 0),
      tail: J("tail", tailX, spineY + bh * 0.04, -0.02),
      chest: J("chest", withersX, bellyY, 0.01),
      lShoulder: J("lShoulder", withersX - bw * 0.04, bellyY, 0.04),
      rShoulder: J("rShoulder", withersX + bw * 0.04, bellyY, -0.04),
      lElbow: J("lElbow", withersX - bw * 0.05, bellyY + leg * 0.45, 0.04),
      rElbow: J("rElbow", withersX + bw * 0.05, bellyY + leg * 0.45, -0.04),
      lFrontPaw: J("lFrontPaw", withersX - bw * 0.04, groundY, 0.05),
      rFrontPaw: J("rFrontPaw", withersX + bw * 0.04, groundY, -0.05),
      lHip: J("lHip", hipX - bw * 0.04, bellyY + bh * 0.02, 0.04),
      rHip: J("rHip", hipX + bw * 0.04, bellyY + bh * 0.02, -0.04),
      lKnee: J("lKnee", hipX - bw * 0.05, bellyY + leg * 0.4, 0.04),
      rKnee: J("rKnee", hipX + bw * 0.05, bellyY + leg * 0.4, -0.04),
      lHindPaw: J("lHindPaw", hipX - bw * 0.04, groundY, 0.05),
      rHindPaw: J("rHindPaw", hipX + bw * 0.04, groundY, -0.05),
    };

    var bones = [
      ["nose", "head"],
      ["head", "neck"],
      ["neck", "withers"],
      ["withers", "midBack"],
      ["midBack", "hip"],
      ["hip", "tail"],
      ["withers", "chest"],
      ["withers", "lShoulder"],
      ["withers", "rShoulder"],
      ["lShoulder", "lElbow"],
      ["lElbow", "lFrontPaw"],
      ["rShoulder", "rElbow"],
      ["rElbow", "rFrontPaw"],
      ["hip", "lHip"],
      ["hip", "rHip"],
      ["lHip", "lKnee"],
      ["lKnee", "lHindPaw"],
      ["rHip", "rKnee"],
      ["rKnee", "rHindPaw"],
    ];

    return {
      joints: joints,
      bones: bones,
      facing: facing,
      box: box,
      conf: box.score || 0.5,
      species: "dog",
      name: JINX.name,
      breed: JINX.breed,
      weightLb: JINX.weightLb,
      morphology: "long-body-short-leg",
    };
  }

  function toPx(nx, ny, W, H) {
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
    try {
      if (typeof window.__mgMeasurePip === "function") {
        var cm = window.__mgMeasurePip(W, H);
        var ux = flip ? 1 - nx : nx;
        return { x: cm.ox + ux * cm.dw, y: cm.oy + ny * cm.dh };
      }
    } catch (e2) {}
    return { x: flip ? (1 - nx) * W : nx * W, y: ny * H };
  }

  function drawDog(ctx, W, H) {
    if (uiGet("showDog", true) === false) return;
    var sub = state.primary;
    if (!sub || !sub.ik) {
      if (uiGet("showDog", true)) {
        ctx.fillStyle = "rgba(255,190,100,0.35)";
        ctx.font = "600 8px ui-monospace, Menlo, monospace";
        ctx.fillText("DOG · waiting for Jinx (walk through frame)", 10, H - 12);
      }
      return;
    }
    var ik = sub.ik;
    var a = uiGet("dogOpacity", 0.85);
    var col = JINX.color;
    var rgba = function (alpha) {
      return "rgba(" + col.r + "," + col.g + "," + col.b + "," + (a * alpha).toFixed(2) + ")";
    };

    /* bbox */
    var b = ik.box;
    if (b) {
      var p0 = toPx(b.x, b.y, W, H);
      var p1 = toPx(b.x + b.w, b.y + b.h, W, H);
      var bx = Math.min(p0.x, p1.x);
      var by = Math.min(p0.y, p1.y);
      var bw = Math.abs(p1.x - p0.x);
      var bh = Math.abs(p1.y - p0.y);
      ctx.strokeStyle = rgba(0.55);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);
      ctx.fillStyle = rgba(0.9);
      ctx.font = "700 9px system-ui, sans-serif";
      ctx.fillText("JINX · 40lb Dorgi", bx + 4, by - 5);
    }

    /* bones */
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = rgba(0.75);
    for (var i = 0; i < ik.bones.length; i++) {
      var aN = ik.bones[i][0];
      var bN = ik.bones[i][1];
      var ja = ik.joints[aN];
      var jb = ik.joints[bN];
      if (!ja || !jb) continue;
      var pa = toPx(ja.x, ja.y, W, H);
      var pb = toPx(jb.x, jb.y, W, H);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    /* joints */
    var keys = Object.keys(ik.joints);
    for (var k = 0; k < keys.length; k++) {
      var j = ik.joints[keys[k]];
      var p = toPx(j.x, j.y, W, H);
      var isPaw = /Paw|nose/.test(keys[k]);
      var isRoot = /withers|hip|midBack/.test(keys[k]);
      ctx.fillStyle = isPaw
        ? "rgba(255,255,255," + (a * 0.95).toFixed(2) + ")"
        : isRoot
          ? rgba(0.95)
          : "rgba(255,220,160," + (a * 0.85).toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, isRoot ? 4.2 : isPaw ? 3.2 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = rgba(0.9);
    ctx.font = "600 8px ui-monospace, Menlo, monospace";
    ctx.fillText(
      "DOG · Jinx · " +
        (state.engine || "?") +
        " · conf " +
        (ik.conf || 0).toFixed(2) +
        " · " +
        (ik.facing > 0 ? "→" : "←") +
        " · short-leg IK",
      10,
      H - 12
    );
  }

  function publish() {
    try {
      if (window.LabViewRay) window.LabViewRay.dog = state;
      if (typeof window.__mgH1NoteDog === "function") window.__mgH1NoteDog(state);
    } catch (e) {}
    /* multi-subject people array for native track_people */
    try {
      if (window.ipc && window.ipc.postMessage && state.primary) {
        var people = [];
        /* keep human if present */
        try {
          var body = window.__mgGetBodyPose && window.__mgGetBodyPose();
          if (body && body.present) {
            people.push({
              id: "human-0",
              kind: "person",
              conf: body.conf || 0.5,
              engine: body.engine || "pose",
            });
          }
        } catch (eH) {}
        people.push({
          id: "jinx",
          kind: "dog",
          name: "Jinx",
          breed: JINX.breed,
          weightLb: 40,
          conf: state.conf,
          box: state.primary.box,
          engine: state.engine,
          morphology: "long-body-short-leg",
        });
        window.ipc.postMessage(
          JSON.stringify({
            op: "track_people",
            people: people,
            t: Date.now(),
          })
        );
      }
    } catch (eP) {}
  }

  function applyBox(box, engineHint) {
    if (!box || (box.score || 0) < (uiGet("dogMinConf", 0.32) || 0.32)) {
      /* hold last briefly */
      if (smoothBox && Date.now() - (state.updatedAt || 0) < 450) {
        box = smoothBox;
      } else {
        state.present = false;
        state.primary = null;
        state.subjects = [];
        return;
      }
    }
    smoothBox = emaBox(smoothBox, box, 0.4);
    prevBox = smoothBox;
    var ik = buildQuadIk(smoothBox);
    state.present = true;
    state.conf = smoothBox.score || 0.5;
    state.engine = engineHint || state.engine || "dog";
    state.updatedAt = Date.now();
    state.primary = {
      id: "jinx",
      name: "Jinx",
      box: smoothBox,
      ik: ik,
    };
    state.subjects = [state.primary];
    publish();
  }

  function onStill(img) {
    if (!img) return;
    if (uiGet("showDog", true) === false) return;
    state._srcW = img.naturalWidth || state._srcW || 720;
    state._srcH = img.naturalHeight || state._srcH || 960;
    tickN++;
    if (!detTried) tryLoadDetector();

    /* throttle */
    if (tickN % 4 !== 0) return;

    if (detReady && detModel && !detBusy) {
      detBusy = true;
      detModel
        .detect(img)
        .then(function (preds) {
          detBusy = false;
          var W = img.naturalWidth || img.width || 1;
          var H = img.naturalHeight || img.height || 1;
          var box = pickDogDetection(preds, W, H);
          if (box) applyBox(box, "coco-ssd");
          else {
            var fb = motionFallback(img);
            if (fb) applyBox(fb, "motion-fallback");
            else applyBox(null);
          }
        })
        .catch(function () {
          detBusy = false;
          var fb2 = motionFallback(img);
          applyBox(fb2, "motion-fallback");
        });
      return;
    }

    var fb = motionFallback(img);
    applyBox(fb, state.engine === "coco-ssd" ? "coco-ssd" : "motion-fallback");
  }

  /* Chain still + draw hooks (after body-pose) */
  var prevStill = window.__mgOnStillFrame;
  window.__mgOnStillFrame = function (img) {
    try {
      if (typeof prevStill === "function") prevStill(img);
    } catch (e1) {}
    try {
      onStill(img);
    } catch (e2) {}
  };

  var prevDraw = window.__mgDrawBodyAfterHands;
  window.__mgDrawBodyAfterHands = function (ctx, W, H) {
    try {
      if (typeof prevDraw === "function") prevDraw(ctx, W, H);
    } catch (e1) {}
    try {
      drawDog(ctx, W, H);
    } catch (e2) {}
  };

  window.__mgGetDogPose = function () {
    return state;
  };
  window.__mgGetDogIk = function () {
    return state.primary && state.primary.ik ? state.primary.ik : null;
  };
  window.__mgDogPoseHotPatch = function () {
    ui = window.__mgCalibUiLive || window.__mgCalibUi || window.__mgCalibUI || ui;
    if (ui) {
      if (ui.showDog == null) ui.showDog = true;
      if (ui.dogOpacity == null) ui.dogOpacity = 0.85;
      if (ui.dogMinConf == null) ui.dogMinConf = 0.32;
    }
  };
  window.__mgDogPoseHotPatch();

  tryLoadDetector();
  log("dog-pose · Jinx Dorgi profile · multi-subject with human BODY", "ok");
})();
