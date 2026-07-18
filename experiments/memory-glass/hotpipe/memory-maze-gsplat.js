/* Memory Glass · memory maze gsplat (from contrail / keyboard points)
 * Lightweight canvas "space" — point cloud + corridors, not full WebGPU yet.
 * VER: memory-maze-v1
 */
(function () {
  "use strict";
  var VER = "memory-maze-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._memMazeVer === VER) return;
  HP._memMazeVer = VER;
  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "maze");
    } catch (e) {}
  }

  var points = []; /* {x,y,z,r,g,b,t,kind} */
  var MAX = 900;
  var yaw = 0.35,
    pitch = 0.25;
  var autoSpin = true;
  var panel = null,
    cv = null;
  var open = true;

  function ensureUi() {
    if (panel) return;
    if (!document.getElementById("mg-maze-css")) {
      var st = document.createElement("style");
      st.id = "mg-maze-css";
      st.textContent = [
        "#mg-mem-maze{position:fixed;left:12px;top:56px;z-index:2147482995;",
        "  width:min(220px,28vw);border-radius:12px;overflow:hidden;",
        "  background:rgba(10,12,16,0.5);backdrop-filter:blur(22px) saturate(1.35);",
        "  -webkit-backdrop-filter:blur(22px) saturate(1.35);",
        "  border:1px solid rgba(255,255,255,0.16);",
        "  box-shadow:0 8px 24px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.1);",
        "  font:650 9px/1.2 system-ui;color:rgba(244,246,250,0.92);pointer-events:auto}",
        "#mg-mem-maze.hidden{display:none}",
        "#mg-mem-maze .hd{display:flex;justify-content:space-between;align-items:center;",
        "  padding:6px 8px;letter-spacing:0.12em;text-transform:uppercase;",
        "  border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(160,210,255,0.9)}",
        "#mg-mem-maze .hd button{appearance:none;background:transparent;border:0;color:inherit;",
        "  cursor:pointer;font:700 11px/1 system-ui}",
        "#mg-mem-maze canvas{width:100%;height:160px;display:block;cursor:grab}",
        "#mg-mem-maze .ft{padding:4px 8px 6px;font:500 8px/1.25 ui-monospace,Menlo,monospace;",
        "  color:rgba(160,200,180,0.85);letter-spacing:0.04em}",
      ].join("");
      (document.head || document.documentElement).appendChild(st);
    }
    panel = document.createElement("div");
    panel.id = "mg-mem-maze";
    panel.innerHTML =
      '<div class="hd"><span>Memory maze · gsplat</span>' +
      '<span><button type="button" id="mg-maze-spin" title="spin">⟳</button> ' +
      '<button type="button" id="mg-maze-x">×</button></span></div>' +
      '<canvas id="mg-maze-cv"></canvas>' +
      '<div class="ft" id="mg-maze-ft">pts 0</div>';
    (document.body || document.documentElement).appendChild(panel);
    cv = panel.querySelector("#mg-maze-cv");
    panel.querySelector("#mg-maze-x").onclick = function () {
      open = false;
      panel.classList.add("hidden");
    };
    panel.querySelector("#mg-maze-spin").onclick = function () {
      autoSpin = !autoSpin;
    };
    var drag = false,
      lx = 0,
      ly = 0;
    cv.addEventListener("pointerdown", function (e) {
      drag = true;
      lx = e.clientX;
      ly = e.clientY;
      autoSpin = false;
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", function (e) {
      if (!drag) return;
      yaw += (e.clientX - lx) * 0.008;
      pitch += (e.clientY - ly) * 0.008;
      pitch = Math.max(-1.2, Math.min(1.2, pitch));
      lx = e.clientX;
      ly = e.clientY;
      draw();
    });
    cv.addEventListener("pointerup", function () {
      drag = false;
    });
  }

  function trajRgb(traj, strain) {
    if (window.__mgKbatchDojo && strain != null && isFinite(strain)) {
      var c = window.__mgKbatchDojo.strainColor(strain, 1);
      var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
      if (m) return [+m[1], +m[2], +m[3]];
    }
    if (traj === "stress") return [248, 81, 73];
    if (traj === "success") return [80, 230, 160];
    if (traj === "slow") return [160, 120, 255];
    if (traj === "dwell") return [100, 180, 255];
    if (traj === "accel") return [255, 200, 80];
    return [140, 220, 255];
  }

  function ingestContrailPath(pathArr) {
    if (!pathArr || !pathArr.length) return;
    var slice = pathArr.slice(-120);
    slice.forEach(function (p, i) {
      var rgb = trajRgb(p.traj, p.strain);
      points.push({
        x: (p.nx - 0.5) * 2.2,
        y: (0.5 - p.ny) * 2.2,
        z: (i / slice.length - 0.5) * 1.8 + (p.v || 0) * 0.15,
        r: rgb[0],
        g: rgb[1],
        b: rgb[2],
        t: p.t,
        kind: p.src || "path",
      });
    });
    while (points.length > MAX) points.shift();
  }

  function ingestKey(ch, nx, ny) {
    points.push({
      x: (nx - 0.5) * 2,
      y: (0.5 - ny) * 2,
      z: (ch.charCodeAt(0) % 12) * 0.04,
      r: 180,
      g: 220,
      b: 255,
      t: Date.now(),
      kind: "key",
    });
    while (points.length > MAX) points.shift();
  }

  function project(p) {
    var cosY = Math.cos(yaw),
      sinY = Math.sin(yaw);
    var cosP = Math.cos(pitch),
      sinP = Math.sin(pitch);
    var x1 = p.x * cosY - p.z * sinY;
    var z1 = p.x * sinY + p.z * cosY;
    var y1 = p.y * cosP - z1 * sinP;
    var z2 = p.y * sinP + z1 * cosP;
    var f = 2.4 / (2.8 + z2);
    return { x: x1 * f, y: y1 * f, z: z2, f: f };
  }

  function draw() {
    if (!open) return;
    ensureUi();
    if (!cv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = cv.clientWidth || 220;
    var H = 160;
    cv.width = Math.floor(W * dpr);
    cv.height = Math.floor(H * dpr);
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "rgba(4,8,14,0.92)";
    ctx.fillRect(0, 0, W, H);
    /* maze grid floor */
    ctx.strokeStyle = "rgba(100,160,220,0.12)";
    ctx.lineWidth = 1;
    for (var g = -3; g <= 3; g++) {
      var a = project({ x: g * 0.35, y: -1, z: -1.2 });
      var b = project({ x: g * 0.35, y: -1, z: 1.2 });
      ctx.beginPath();
      ctx.moveTo(W / 2 + a.x * W * 0.42, H / 2 - a.y * H * 0.42);
      ctx.lineTo(W / 2 + b.x * W * 0.42, H / 2 - b.y * H * 0.42);
      ctx.stroke();
    }
    var sorted = points
      .map(function (p) {
        return { p: p, pr: project(p) };
      })
      .sort(function (a, b) {
        return a.pr.z - b.pr.z;
      });
    for (var i = 0; i < sorted.length; i++) {
      var s = sorted[i];
      var sz = Math.max(1.2, 2.8 * s.pr.f);
      var alpha = 0.55 + 0.45 * s.pr.f;
      ctx.fillStyle =
        "rgba(" + s.p.r + "," + s.p.g + "," + s.p.b + "," + alpha + ")";
      ctx.beginPath();
      ctx.arc(W / 2 + s.pr.x * W * 0.42, H / 2 - s.pr.y * H * 0.42, sz, 0, Math.PI * 2);
      ctx.fill();
    }
    /* corridor links last 40 */
    ctx.strokeStyle = "rgba(180,230,255,0.22)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    var linked = 0;
    for (var j = Math.max(0, sorted.length - 50); j < sorted.length; j++) {
      var px = W / 2 + sorted[j].pr.x * W * 0.42;
      var py = H / 2 - sorted[j].pr.y * H * 0.42;
      if (!linked) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      linked++;
    }
    ctx.stroke();
    var ft = document.getElementById("mg-maze-ft");
    if (ft)
      ft.textContent =
        "pts " + points.length + " · maze · " + (autoSpin ? "spin" : "hold");
  }

  function tick() {
    if (autoSpin) {
      yaw += 0.006;
      pitch = 0.22 + Math.sin(Date.now() / 4000) * 0.08;
    }
    try {
      if (window.__mgContrail && window.__mgContrail.path)
        ingestContrailPath(window.__mgContrail.path);
    } catch (e) {}
    draw();
  }

  setInterval(tick, 80);
  setTimeout(function () {
    ensureUi();
    draw();
  }, 400);

  window.__mgMemoryMaze = {
    ver: VER,
    ingestContrailPath: ingestContrailPath,
    ingestKey: ingestKey,
    open: function () {
      open = true;
      ensureUi();
      panel.classList.remove("hidden");
    },
    close: function () {
      open = false;
      if (panel) panel.classList.add("hidden");
    },
    toggle: function () {
      if (open) this.close();
      else this.open();
    },
    points: function () {
      return points;
    },
    report: function () {
      return VER + " pts=" + points.length;
    },
  };
  log(VER + " · memory maze gsplat");
})();
