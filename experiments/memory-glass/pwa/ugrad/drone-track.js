/* Track plane: motion / SAM / DINO / SLAM / GSPLAT hooks · sim-first */
(function (global) {
  "use strict";
  var VER = "drone-track-v1";

  function create(opts) {
    opts = opts || {};
    var mode = opts.mode || "motion"; // off | motion | sam | dino | slam | gsplat
    var tracks = [];
    var locked = null;
    var nextId = 1;
    var slamPath = [];
    var gsplat = {
      calibrating: false,
      residual: 1.0,
      gaussians: 0,
      lafr: false, // LAFR residual policy hook
      gsCalib: false, // 3DGS-Calib multimodal hook
      pipeHz: 0,
      lastCalib: null
    };

    function reset() {
      tracks = [];
      locked = null;
      slamPath = [];
      nextId = 1;
    }

    /** Sim detector: spawn / update pseudo tracks around unit motion */
    function stepSim(unit, dt, t) {
      if (mode === "off") { tracks = []; return tracks; }
      // keep 2–4 tracks
      while (tracks.length < 3) {
        tracks.push({
          id: "t" + nextId++,
          label: mode === "sam" ? "seg" : mode === "dino" ? "dino" : "obj",
          score: 0.7 + Math.random() * 0.25,
          x: 0.3 + Math.random() * 0.4,
          y: 0.25 + Math.random() * 0.4,
          w: 0.06 + Math.random() * 0.05,
          h: 0.08 + Math.random() * 0.06,
          trail: [],
          color: mode === "sam" ? "#3dd68c" : mode === "dino" ? "#a78bfa" : "#5cc8ff"
        });
      }
      tracks.forEach(function (tr, i) {
        var phase = t * (0.4 + i * 0.15) + i;
        tr.x = 0.35 + Math.sin(phase) * 0.18 + (i - 1) * 0.08;
        tr.y = 0.4 + Math.cos(phase * 0.9) * 0.12;
        tr.x = Math.max(0.05, Math.min(0.9, tr.x));
        tr.y = Math.max(0.08, Math.min(0.85, tr.y));
        tr.score = 0.65 + 0.3 * (0.5 + 0.5 * Math.sin(phase * 2));
        // geo trail from unit
        if (unit) {
          var lat = unit.lat + (tr.y - 0.5) * 0.004;
          var lon = unit.lon + (tr.x - 0.5) * 0.004;
          tr.trail.push({ lat: lat, lon: lon });
          if (tr.trail.length > 40) tr.trail.shift();
        }
      });
      if (mode === "slam" || mode === "gsplat") {
        if (unit) {
          slamPath.push({ lat: unit.lat, lon: unit.lon, t: t });
          if (slamPath.length > 120) slamPath.shift();
        }
      }
      if (mode === "gsplat") {
        gsplat.calibrating = true;
        gsplat.residual = Math.max(0.02, gsplat.residual * (1 - 0.08 * dt) + Math.random() * 0.01);
        gsplat.gaussians = Math.min(50000, gsplat.gaussians + Math.floor(40 + Math.random() * 80));
        gsplat.pipeHz = 12 + Math.sin(t) * 2;
        gsplat.lafr = true;
        gsplat.gsCalib = gsplat.residual < 0.15;
        if (gsplat.gsCalib) gsplat.lastCalib = new Date().toISOString();
      } else {
        gsplat.calibrating = false;
      }
      return tracks;
    }

    function ingestHotpipe(msg) {
      // {type:'drone.track', boxes:[...]} or {type:'drone.slam', points:[...]}
      if (!msg || !msg.type) return;
      if (msg.type === "drone.track" && msg.boxes) {
        tracks = msg.boxes.map(function (b, i) {
          return {
            id: b.id || "t" + (i + 1),
            label: b.label || "obj",
            score: b.score != null ? b.score : 0.8,
            x: b.x, y: b.y, w: b.w, h: b.h,
            trail: b.trail || [],
            color: "#3dd68c"
          };
        });
      }
      if (msg.type === "drone.slam" && msg.points) {
        slamPath = msg.points;
      }
      if (msg.type === "drone.gsplat" && msg.calib) {
        gsplat = Object.assign({}, gsplat, msg.calib);
      }
      if (msg.locked) locked = msg.locked;
    }

    function drawOnVideo(ctx, w, h) {
      if (mode === "off") return;
      tracks.forEach(function (tr) {
        var x = tr.x * w, y = tr.y * h, bw = tr.w * w, bh = tr.h * h;
        var col = tr.id === locked ? "#f0b429" : tr.color || "#5cc8ff";
        ctx.strokeStyle = col;
        ctx.lineWidth = tr.id === locked ? 2 : 1.2;
        // corner brackets (Oblivion / DJI)
        var L = Math.min(12, bw * 0.25, bh * 0.25);
        ctx.beginPath();
        ctx.moveTo(x, y + L); ctx.lineTo(x, y); ctx.lineTo(x + L, y);
        ctx.moveTo(x + bw - L, y); ctx.lineTo(x + bw, y); ctx.lineTo(x + bw, y + L);
        ctx.moveTo(x + bw, y + bh - L); ctx.lineTo(x + bw, y + bh); ctx.lineTo(x + bw - L, y + bh);
        ctx.moveTo(x + L, y + bh); ctx.lineTo(x, y + bh); ctx.lineTo(x, y + bh - L);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.font = "600 11px IBM Plex Mono, monospace";
        ctx.fillText(tr.id + " " + tr.label + " " + Math.round(tr.score * 100) + "%", x, y - 4);
      });
      if (mode === "gsplat" && gsplat.calibrating) {
        ctx.fillStyle = "rgba(167,139,250,.85)";
        ctx.font = "700 12px IBM Plex Mono, monospace";
        ctx.fillText(
          "GSPLAT CAL · res " + gsplat.residual.toFixed(3) +
          " · N " + gsplat.gaussians +
          (gsplat.gsCalib ? " · LOCK" : " · …"),
          16, h - 48
        );
      }
      if ((mode === "slam" || mode === "gsplat") && slamPath.length > 1) {
        // small ego trail bottom-left of FPV
      }
    }

    return {
      version: VER,
      get mode() { return mode; },
      setMode: function (m) { mode = m; if (m === "off") reset(); },
      list: function () { return tracks.slice(); },
      select: function (id) { locked = id; },
      lock: function (id) { locked = id; },
      get locked() { return locked; },
      stepSim: stepSim,
      ingest: ingestHotpipe,
      drawOnVideo: drawOnVideo,
      slamPath: function () { return slamPath.slice(); },
      gsplat: function () { return Object.assign({}, gsplat); },
      reset: reset
    };
  }

  global.DroneTrack = { version: VER, create: create };
})(typeof window !== "undefined" ? window : globalThis);
