/* Memory Glass · dual-space solve: contrail / keyboard path → Bloch
 * Educational geometry only — not Neuralink implant claims.
 * P0: map path→gates every N samples + on stroke; mini orb always on.
 * P1: SO order + Rubik face → gate family; mueee cube links.
 * VER: bloch-solve-v1
 */
(function () {
  "use strict";
  var VER = "bloch-solve-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._blochSolveVer === VER) return;
  HP._blochSolveVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return; // inspect: no orb clutter
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "bloch-bus");
    } catch (e) {}
  }

  var EVERY_N = 10; /* always-learning cadence */ /* gate on sample count — not every pixel */
  var sampleCount = 0;
  var lastGate = "";
  var lastDist = null;
  var enabled = true;
  var trials = [];
  var orb = null;
  var orbCv = null;

  /* Rubik face → preferred gate family (educational) */
  var FACE_GATES = {
    U: ["H", "S"], // written / superpose-read
    D: ["S", "T"], // spoken / phase
    F: ["X", "Y"], // movement
    B: ["H", "X"], // digital
    L: ["Z", "S"], // analog / strain
    R: ["H", "T"], // thought
  };

  var SO_FACE = {
    SSO: "F",
    OSO: "U",
    SOS: "R",
    OSS: "D",
    SOO: "B",
    OOS: "L",
    SSS: "L",
    OOO: "D",
  };

  function Q() {
    return window.__mgQuantum;
  }

  function mapGate(tip, strain, soHits) {
    if (!tip) return { id: "T", name: "T", why: "default" };
    /* strain / kinematics first */
    if (tip.traj === "stress" || (strain != null && strain >= 70))
      return { id: "Z", name: "Z", why: "stress/phase" };
    if (tip.traj === "slow") return { id: "S", name: "S", why: "slow" };
    if (tip.traj === "dwell") return { id: "S", name: "S", why: "dwell" };
    if (tip.traj === "accel") return { id: "X", name: "X", why: "accel" };
    if (tip.traj === "success" || (strain != null && strain < 25))
      return { id: "H", name: "H", why: "success/low-strain" };

    /* SO order → Rubik face → gate */
    if (soHits && typeof soHits === "object") {
      var best = null,
        bestN = 0;
      Object.keys(soHits).forEach(function (k) {
        if (soHits[k] > bestN) {
          bestN = soHits[k];
          best = k;
        }
      });
      if (best && SO_FACE[best] && FACE_GATES[SO_FACE[best]]) {
        var fam = FACE_GATES[SO_FACE[best]];
        return { id: fam[0], name: fam[0], why: "SO " + best + "→" + SO_FACE[best] };
      }
    }

    /* direction bins */
    var d = tip.dir || "";
    if (d === "N" || d === "S") return { id: "H", name: "H", why: "dir NS" };
    if (d === "E" || d === "W") return { id: "X", name: "X", why: "dir EW" };
    if (d === "NE" || d === "SW") return { id: "T", name: "T", why: "dir diag" };
    if (d === "NW" || d === "SE") return { id: "S", name: "S", why: "dir diag" };
    return { id: "T", name: "T", why: "cruise" };
  }

  function stepFromPath(tip, opts) {
    if (!enabled || !Q() || !Q().applyGate) return null;
    opts = opts || {};
    sampleCount++;
    var force = !!opts.forceStroke;
    if (!force && sampleCount % EVERY_N !== 0) {
      paintOrb();
      return null;
    }
    var strain =
      tip && tip.strain != null
        ? tip.strain
        : window.__mgContrail && window.__mgContrail.lastStrain
          ? window.__mgContrail.lastStrain()
          : null;
    var soHits = null;
    try {
      var dj = window.__mgContrail && window.__mgContrail.lastDojo && window.__mgContrail.lastDojo();
      if (dj && dj.phrasingOrders) soHits = dj.phrasingOrders;
      else if (dj && dj.so && dj.so.orderHits) soHits = dj.so.orderHits;
    } catch (e) {}

    var g = mapGate(tip, strain, soHits);
    Q().applyGate(g);
    lastGate = g.id + " (" + g.why + ")";

    var scored = null;
    if (force || sampleCount % (EVERY_N * 2) === 0) {
      try {
        scored = Q().scoreHit();
        if (scored && scored.d != null) lastDist = scored.d;
      } catch (e2) {}
    }

    var st = Q().state || {};
    var trial = {
      domain: "bloch_contrail",
      t: Date.now() / 1000,
      features: [
        st.theta || 0,
        st.phi || 0,
        lastDist != null ? lastDist : -1,
        strain != null ? strain : -1,
        (tip && tip.v) || 0,
      ],
      label: scored && scored.hit ? 1 : 0,
      meta: {
        gate: g.id,
        why: g.why,
        dir: tip && tip.dir,
        traj: tip && tip.traj,
        phrase: opts.phrase || null,
        ver: VER,
      },
    };
    trials.push(trial);
    if (trials.length > 200) trials.shift();
    try {
      var arr = JSON.parse(localStorage.getItem("mg.bloch_contrail.trials") || "[]");
      arr.push(trial);
      if (arr.length > 300) arr = arr.slice(-300);
      localStorage.setItem("mg.bloch_contrail.trials", JSON.stringify(arr));
    } catch (e3) {}

    paintOrb();
    return { gate: g, scored: scored, trial: trial };
  }

  function onStroke(stroke) {
    if (!stroke) return;
    var tip = {
      traj: stroke.dominant || "cruise",
      dir: (stroke.phrase || "").charAt(0) || "·",
      strain: stroke.strain,
      v: stroke.meanV,
    };
    return stepFromPath(tip, { forceStroke: true, phrase: stroke.phrase });
  }

  /* ── mini orb (always visible, non-blocking) ── */
  function ensureOrb() {
    if (orb || document.getElementById("mg-bloch-orb")) return;
    if (!document.getElementById("mg-bloch-orb-css")) {
      var st = document.createElement("style");
      st.id = "mg-bloch-orb-css";
      st.textContent = [
        "#mg-bloch-orb{position:fixed;right:12px;bottom:calc(56px + var(--mg-kb-h,0px));",
        "  z-index:2147483003;width:56px;height:56px;border-radius:50%;",
        "  background:rgba(10,12,16,0.45);backdrop-filter:blur(20px) saturate(1.3);",
        "  -webkit-backdrop-filter:blur(20px) saturate(1.3);",
        "  border:1px solid rgba(255,255,255,0.18);",
        "  box-shadow:0 6px 20px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.12);",
        "  pointer-events:auto;cursor:pointer;overflow:hidden}",
        "#mg-bloch-orb canvas{width:100%;height:100%;display:block}",
        "#mg-bloch-orb .lbl{position:absolute;left:0;right:0;bottom:2px;text-align:center;",
        "  font:700 7px/1 system-ui;letter-spacing:0.08em;color:rgba(160,210,255,0.85)}",
      ].join("");
      (document.head || document.documentElement).appendChild(st);
    }
    orb = document.createElement("div");
    orb.id = "mg-bloch-orb";
    orb.title = "Bloch dual-solve · click → QBIT";
    orb.innerHTML = '<canvas id="mg-bloch-orb-cv"></canvas><div class="lbl">BLOCH</div>';
    (document.body || document.documentElement).appendChild(orb);
    orbCv = orb.querySelector("canvas");
    orb.onclick = function () {
      try {
        if (window.__mgGlassCap) window.__mgGlassCap.setMode("qbit");
        else if (Q() && Q().open) Q().open();
      } catch (e) {}
    };
  }

  function paintOrb() {
    ensureOrb();
    if (!orbCv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = 56,
      H = 56;
    orbCv.width = Math.floor(W * dpr);
    orbCv.height = Math.floor(H * dpr);
    var ctx = orbCv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var cx = 28,
      cy = 24,
      R = 16;
    ctx.strokeStyle = "rgba(160,210,255,0.35)";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    var q = Q() && Q().state;
    if (q) {
      var th = q.theta || 0,
        ph = q.phi || 0;
      var x = Math.sin(th) * Math.cos(ph);
      var y = Math.sin(th) * Math.sin(ph);
      var z = Math.cos(th);
      var px = cx + x * R;
      var py = cy - z * R * 0.85 + y * R * 0.12;
      ctx.strokeStyle = "rgba(120,255,200,0.95)";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.fillStyle = "rgba(120,255,200,0.95)";
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
      /* target faint */
      var tth = (q.target && q.target.theta) || Math.PI / 2;
      var tph = (q.target && q.target.phi) || 0;
      var tx = Math.sin(tth) * Math.cos(tph);
      var ty = Math.sin(tth) * Math.sin(tph);
      var tz = Math.cos(tth);
      ctx.fillStyle = "rgba(255,200,120,0.7)";
      ctx.beginPath();
      ctx.arc(cx + tx * R, cy - tz * R * 0.85 + ty * R * 0.12, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* hook float keyboard path as discrete hops */
  function onKeyHop(ch) {
    stepFromPath(
      {
        traj: "cruise",
        dir: "E",
        v: 0.5,
      },
      { forceStroke: false, phrase: ch }
    );
  }

  setInterval(paintOrb, 400);
  setTimeout(paintOrb, 200);

  window.__mgBlochSolve = {
    ver: VER,
    stepFromPath: stepFromPath,
    onStroke: onStroke,
    onKeyHop: onKeyHop,
    mapGate: mapGate,
    setEnabled: function (on) {
      enabled = !!on;
    },
    isEnabled: function () {
      return enabled;
    },
    trials: trials,
    report: function () {
      return (
        VER +
        " gate=" +
        (lastGate || "—") +
        " d=" +
        (lastDist != null ? lastDist.toFixed(3) : "—") +
        " n=" +
        sampleCount
      );
    },
  };

  /* Patch contrail if already present */
  function attachContrail() {
    var C = window.__mgContrail;
    if (!C || C._blochHooked) return;
    C._blochHooked = true;
    var origPush = C.pushPoint;
    if (typeof origPush === "function") {
      C.pushPoint = function (nx, ny, meta) {
        var r = origPush.call(C, nx, ny, meta);
        try {
          var path = C.path || [];
          var tip = path[path.length - 1];
          if (tip) stepFromPath(tip, {});
        } catch (e) {}
        return r;
      };
    }
    log(VER + " · hooked contrail pushPoint");
  }

  /* Retry attach — contrail may load before/after */
  attachContrail();
  setTimeout(attachContrail, 300);
  setTimeout(attachContrail, 1200);

  log(VER + " · dual Bloch←path · mini orb");
})();
