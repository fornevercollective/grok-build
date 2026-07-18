/* Memory Glass · dual-space solve: contrail / keyboard path → Bloch
 * Educational geometry only — not Neuralink implant claims.
 * P0: map path→gates every N samples + on stroke; mini orb always on.
 * P1: SO order + Rubik face → gate family; mueee cube links.
 * VER: bloch-solve-v1
 */
(function () {
  "use strict";
  var VER = "bloch-solve-v2-float";
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
  var panel = null;
  var panelCv = null;
  var floatOpen = false;

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

  /* ── mini orb + maze-style float (openable) ── */
  function ensureCss() {
    if (document.getElementById("mg-bloch-orb-css")) return;
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
      "#mg-bloch-float{position:fixed;right:78px;bottom:calc(56px + var(--mg-kb-h,0px));",
      "  z-index:2147482997;width:min(240px,32vw);border-radius:12px;overflow:hidden;",
      "  background:rgba(10,12,16,0.5);backdrop-filter:blur(22px) saturate(1.35);",
      "  -webkit-backdrop-filter:blur(22px) saturate(1.35);",
      "  border:1px solid rgba(255,255,255,0.16);",
      "  box-shadow:0 8px 24px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.1);",
      "  font:650 9px/1.2 system-ui;color:rgba(244,246,250,0.92);pointer-events:auto}",
      "#mg-bloch-float.hidden{display:none}",
      "#mg-bloch-float .hd{display:flex;justify-content:space-between;align-items:center;",
      "  padding:6px 8px;letter-spacing:0.12em;text-transform:uppercase;",
      "  border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(160,210,255,0.9)}",
      "#mg-bloch-float .hd button{appearance:none;background:transparent;border:0;color:inherit;",
      "  cursor:pointer;font:700 11px/1 system-ui}",
      "#mg-bloch-float canvas{width:100%;height:160px;display:block}",
      "#mg-bloch-float .ft{padding:4px 8px 6px;font:500 8px/1.25 ui-monospace,Menlo,monospace;",
      "  color:rgba(160,200,180,0.85);letter-spacing:0.04em}",
      "#mg-bloch-float .acts{display:flex;flex-wrap:wrap;gap:4px;padding:0 8px 6px}",
      "#mg-bloch-float .acts button{appearance:none;cursor:pointer;padding:4px 7px;border-radius:999px;",
      "  font:700 8px/1 system-ui;color:rgba(230,240,255,0.95);",
      "  background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function ensureOrb() {
    if (orb || document.getElementById("mg-bloch-orb")) return;
    ensureCss();
    orb = document.createElement("div");
    orb.id = "mg-bloch-orb";
    orb.title = "Bloch dual-solve · click → open float";
    orb.innerHTML = '<canvas id="mg-bloch-orb-cv"></canvas><div class="lbl">BLOCH</div>';
    (document.body || document.documentElement).appendChild(orb);
    orbCv = orb.querySelector("canvas");
    orb.onclick = function () {
      toggleFloat();
    };
  }

  function ensureFloat() {
    if (panel) return;
    ensureCss();
    panel = document.createElement("div");
    panel.id = "mg-bloch-float";
    panel.className = floatOpen ? "" : "hidden";
    panel.innerHTML =
      '<div class="hd"><span>Bloch · dual-solve</span>' +
      '<button type="button" id="mg-bloch-x">×</button></div>' +
      '<canvas id="mg-bloch-panel-cv"></canvas>' +
      '<div class="ft" id="mg-bloch-ft">gate —</div>' +
      '<div class="acts" id="mg-bloch-acts"></div>';
    (document.body || document.documentElement).appendChild(panel);
    panelCv = panel.querySelector("#mg-bloch-panel-cv");
    panel.querySelector("#mg-bloch-x").onclick = function () {
      closeFloat();
    };
    var acts = panel.querySelector("#mg-bloch-acts");
    ["H", "X", "Y", "Z", "S", "T"].forEach(function (g) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = g;
      b.onclick = function () {
        if (Q() && Q().applyGate) Q().applyGate({ id: g, name: g });
        lastGate = g + " (manual)";
        paintOrb();
      };
      acts.appendChild(b);
    });
    var qbit = document.createElement("button");
    qbit.type = "button";
    qbit.textContent = "QBIT";
    qbit.onclick = function () {
      try {
        if (window.__mgGlassCap) window.__mgGlassCap.setMode("qbit");
        else if (Q() && Q().open) Q().open();
      } catch (e) {}
    };
    acts.appendChild(qbit);
  }

  function drawBlochSphere(ctx, W, H, R, cx, cy) {
    ctx.strokeStyle = "rgba(160,210,255,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(160,210,255,0.18)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, R, R * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, cy + R);
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
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
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.fillStyle = "rgba(120,255,200,0.95)";
      ctx.beginPath();
      ctx.arc(px, py, Math.max(2.5, R * 0.08), 0, Math.PI * 2);
      ctx.fill();
      var tth = (q.target && q.target.theta) || Math.PI / 2;
      var tph = (q.target && q.target.phi) || 0;
      var tx = Math.sin(tth) * Math.cos(tph);
      var ty = Math.sin(tth) * Math.sin(tph);
      var tz = Math.cos(tth);
      ctx.fillStyle = "rgba(255,200,120,0.75)";
      ctx.beginPath();
      ctx.arc(cx + tx * R, cy - tz * R * 0.85 + ty * R * 0.12, Math.max(2, R * 0.07), 0, Math.PI * 2);
      ctx.fill();
    }
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
    drawBlochSphere(ctx, W, H, 16, 28, 24);
    if (floatOpen) paintFloat();
  }

  function paintFloat() {
    if (!floatOpen) return;
    ensureFloat();
    if (!panelCv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = panelCv.clientWidth || 240;
    var H = 160;
    panelCv.width = Math.floor(W * dpr);
    panelCv.height = Math.floor(H * dpr);
    var ctx = panelCv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "rgba(4,8,14,0.88)";
    ctx.fillRect(0, 0, W, H);
    drawBlochSphere(ctx, W, H, Math.min(W, H) * 0.32, W * 0.5, H * 0.48);
    var ft = document.getElementById("mg-bloch-ft");
    if (ft) {
      ft.textContent =
        "gate " +
        (lastGate || "—") +
        " · d=" +
        (lastDist != null ? lastDist.toFixed(3) : "—") +
        " · n=" +
        sampleCount;
    }
  }

  function openFloat() {
    floatOpen = true;
    enabled = true;
    ensureFloat();
    panel.classList.remove("hidden");
    paintFloat();
  }

  function closeFloat() {
    floatOpen = false;
    if (panel) panel.classList.add("hidden");
  }

  function toggleFloat() {
    if (floatOpen) closeFloat();
    else openFloat();
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
    open: openFloat,
    close: closeFloat,
    toggle: toggleFloat,
    isOpen: function () {
      return floatOpen;
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
        sampleCount +
        (floatOpen ? " float" : "")
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
