/* Memory Glass · memory maze gsplat (from contrail / keyboard points)
 * Lightweight canvas "space" — point cloud + corridors.
 * Raindrop-style music from piano-buddy / qbpm / uvqbit packs.
 * VER: memory-maze-v2-rain
 */
(function () {
  "use strict";
  var VER = "memory-maze-v2-rain-playperf";
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

  /* ── music packs (piano-buddy · qbpm · uvqbit) ── */
  var PACKS = [
    {
      id: "raindrop",
      label: "Raindrop",
      from: "qbpm ambient + piano-buddy",
      root: 72,
      scale: [0, 2, 4, 7, 9],
      mode: "major-pent",
      bpm: 72,
      decay: 1.1,
      gain: 0.055,
      wave: "sine",
      spread: 14,
    },
    {
      id: "aeolian",
      label: "Aeolian soft",
      from: "qbpm Mode VI",
      root: 67,
      scale: [0, 2, 3, 5, 7, 8, 10],
      mode: "aeolian",
      bpm: 84,
      decay: 0.95,
      gain: 0.05,
      wave: "triangle",
      spread: 12,
    },
    {
      id: "c-major",
      label: "C major",
      from: "piano-buddy practice",
      root: 60,
      scale: [0, 2, 4, 5, 7, 9, 11],
      mode: "ionian",
      bpm: 80,
      decay: 0.7,
      gain: 0.048,
      wave: "sine",
      spread: 12,
    },
    {
      id: "uvqbit",
      label: "uvQbit soft",
      from: "uvqbit gate tones",
      root: 69,
      scale: [0, 3, 5, 7, 10],
      mode: "minor-pent",
      bpm: 96,
      decay: 0.85,
      gain: 0.05,
      wave: "sine",
      spread: 16,
    },
    {
      id: "qbpm-pads",
      label: "qbpm pads",
      from: "qbpm MPC pads",
      root: 60,
      scale: [0, 3, 7, 12, 15, 19],
      mode: "pad-stack",
      bpm: 100,
      decay: 1.3,
      gain: 0.042,
      wave: "triangle",
      spread: 10,
    },
  ];

  /* piano-buddy NOTE_COLORS spirit */
  var PC_HUE = [350, 20, 40, 55, 90, 150, 185, 210, 265, 290, 320, 335];

  var points = []; /* {x,y,z,r,g,b,t,kind} */
  var MAX = 900;
  var yaw = 0.35,
    pitch = 0.25;
  var autoSpin = true;
  var panel = null,
    cv = null;
  var open = true;

  var packIdx = 0;
  var musicOn = true;
  var audioCtx = null;
  var master = null;
  var delayNode = null;
  var lastDropT = 0;
  var dropCount = 0;
  var rainVis = []; /* {x,y,life,hue} canvas rain streaks */
  var lastKeyMidi = null;

  function pack() {
    return PACKS[packIdx % PACKS.length];
  }

  function ensureUi() {
    if (panel) return;
    if (!document.getElementById("mg-maze-css")) {
      var st = document.createElement("style");
      st.id = "mg-maze-css";
      st.textContent = [
        "#mg-mem-maze{position:fixed;left:12px;top:56px;z-index:2147482995;",
        "  width:min(240px,30vw);border-radius:12px;overflow:hidden;",
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
        "  cursor:pointer;font:700 11px/1 system-ui;margin-left:2px}",
        "#mg-mem-maze .hd button.on{color:rgba(120,230,180,0.95)}",
        "#mg-mem-maze .hd button.mute{color:rgba(180,180,190,0.55)}",
        "#mg-mem-maze canvas{width:100%;height:160px;display:block;cursor:grab}",
        "#mg-mem-maze .ft{padding:4px 8px 6px;font:500 8px/1.25 ui-monospace,Menlo,monospace;",
        "  color:rgba(160,200,180,0.85);letter-spacing:0.04em}",
      ].join("");
      (document.head || document.documentElement).appendChild(st);
    }
    panel = document.createElement("div");
    panel.id = "mg-mem-maze";
    panel.innerHTML =
      '<div class="hd"><span>Memory maze · rain</span>' +
      '<span>' +
      '<button type="button" id="mg-maze-music" title="music on/off" class="on">♫</button> ' +
      '<button type="button" id="mg-maze-pack" title="cycle pack">PACK</button> ' +
      '<button type="button" id="mg-maze-spin" title="spin">⟳</button> ' +
      '<button type="button" id="mg-maze-x">×</button></span></div>' +
      '<canvas id="mg-maze-cv"></canvas>' +
      '<div class="ft" id="mg-maze-ft">pts 0 · raindrop</div>';
    (document.body || document.documentElement).appendChild(panel);
    cv = panel.querySelector("#mg-maze-cv");
    panel.querySelector("#mg-maze-x").onclick = function () {
      open = false;
      panel.classList.add("hidden");
    };
    panel.querySelector("#mg-maze-spin").onclick = function () {
      autoSpin = !autoSpin;
    };
    panel.querySelector("#mg-maze-music").onclick = function () {
      musicOn = !musicOn;
      var b = panel.querySelector("#mg-maze-music");
      b.classList.toggle("on", musicOn);
      b.classList.toggle("mute", !musicOn);
      if (musicOn) ensureAudio();
      log("maze music " + (musicOn ? "on" : "off"));
    };
    panel.querySelector("#mg-maze-pack").onclick = function () {
      packIdx = (packIdx + 1) % PACKS.length;
      log("maze pack " + pack().id);
      paintFt();
      if (musicOn) {
        ensureAudio();
        playDrop(pack().root + pack().scale[0], 0.7);
      }
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
      if (musicOn) ensureAudio();
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

  function ensureAudio() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        master = audioCtx.createGain();
        master.gain.value = 0.7;
        /* light rain reverb: delay feedback */
        delayNode = audioCtx.createDelay(1.2);
        delayNode.delayTime.value = 0.18;
        var fb = audioCtx.createGain();
        fb.gain.value = 0.28;
        var wet = audioCtx.createGain();
        wet.gain.value = 0.22;
        delayNode.connect(fb);
        fb.connect(delayNode);
        delayNode.connect(wet);
        wet.connect(master);
        master.connect(audioCtx.destination);
      }
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) {}
    return audioCtx;
  }

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  /** Soft raindrop pluck — sine/tri + fast attack, long decay */
  function playDrop(midi, vel) {
    if (!musicOn) return;
    var ctx = ensureAudio();
    if (!ctx || !master) return;
    var P = pack();
    vel = vel == null ? 0.65 : vel;
    var t = ctx.currentTime;
    var freq = midiToFreq(midi);
    var g = ctx.createGain();
    var peak = (P.gain || 0.05) * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (P.decay || 1));

    var o = ctx.createOscillator();
    o.type = P.wave === "triangle" ? "triangle" : "sine";
    o.frequency.setValueAtTime(freq, t);
    /* slight drip detune */
    o.frequency.exponentialRampToValueAtTime(freq * 0.985, t + 0.08);

    /* soft high shimmer layer */
    var o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = freq * 2.01;
    var g2 = ctx.createGain();
    g2.gain.setValueAtTime(peak * 0.22, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

    o.connect(g);
    o2.connect(g2);
    g.connect(master);
    g2.connect(master);
    if (delayNode) {
      g.connect(delayNode);
      g2.connect(delayNode);
    }
    o.start(t);
    o2.start(t);
    o.stop(t + (P.decay || 1) + 0.05);
    o2.stop(t + 0.4);
    dropCount++;

    /* qbpm-live bus (same channel as keyboard-beats) */
    try {
      var bc = new BroadcastChannel("qbpm-live");
      bc.postMessage({
        type: "kbatch.qbpm.live",
        source: "mg-memory-maze-rain",
        pack: P.id,
        midi: Math.round(midi),
        bpm: liveBpm(),
        drop: dropCount,
        ts: Date.now(),
      });
      bc.close();
    } catch (eBc) {}
  }

  function liveBpm() {
    try {
      if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.bpm)
        return window.__mgKeyboardBeats.bpm();
    } catch (e) {}
    return pack().bpm || 72;
  }

  function degreeFromPoint(p) {
    var P = pack();
    var sc = P.scale || [0, 2, 4, 7, 9];
    /* map x/y/z into scale degree — rain spatial */
    var n =
      Math.abs(Math.floor((p.x + 1.2) * 3.7 + (p.y + 1) * 2.1 + (p.z + 1) * 1.7 + p.r * 0.01)) %
      sc.length;
    var oct = Math.floor(((p.y + 1.2) / 2.4) * 2); /* -1..1 → 0..2 octaves up from root */
    var midi = (P.root || 72) + sc[n] + oct * 12 - (P.spread ? Math.floor(P.spread / 4) : 0);
    /* color spice — hue-ish from rgb */
    midi += Math.floor(((p.r || 128) + (p.b || 128)) / 180) % 2;
    if (lastKeyMidi != null && Math.random() < 0.25) {
      /* occasionally echo last keyboard note into rain harmony */
      midi = lastKeyMidi + sc[n % sc.length] - sc[0];
    }
    return Math.max(36, Math.min(96, midi));
  }

  function rainTick() {
    if (!open || !musicOn) return;
    var now = Date.now();
    var bpm = liveBpm();
    var interval = 60000 / Math.max(48, bpm);
    /* denser drops with more points */
    var dens = Math.min(1.6, 0.35 + points.length / 400);
    var wait = (interval * (0.35 + Math.random() * 0.9)) / dens;
    if (now - lastDropT < wait) return;
    lastDropT = now;
    if (!points.length) {
      /* ambient sparse rain even when empty */
      if (Math.random() < 0.4) {
        var P = pack();
        var sc = P.scale;
        playDrop(P.root + sc[Math.floor(Math.random() * sc.length)], 0.35 + Math.random() * 0.3);
        rainVis.push({
          x: Math.random(),
          y: Math.random() * 0.3,
          life: 1,
          hue: PC_HUE[Math.floor(Math.random() * 12)],
        });
      }
      return;
    }
    var p = points[Math.floor(Math.random() * points.length)];
    var midi = degreeFromPoint(p);
    var vel = 0.4 + Math.random() * 0.55;
    /* stress points = louder / higher */
    if (p.r > 200 && p.g < 120) vel *= 1.15;
    playDrop(midi, vel);
    rainVis.push({
      x: 0.5 + p.x * 0.22,
      y: 0.2 + Math.random() * 0.2,
      life: 1,
      hue: PC_HUE[Math.round(midi) % 12],
    });
    if (rainVis.length > 40) rainVis.shift();
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
    /* replace denser recent cloud rather than unbounded push every tick */
    var fresh = [];
    slice.forEach(function (p, i) {
      var rgb = trajRgb(p.traj, p.strain);
      fresh.push({
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
    /* keep key points, merge path */
    var keysOnly = points.filter(function (pt) {
      return pt.kind === "key";
    });
    points = keysOnly.concat(fresh);
    while (points.length > MAX) points.shift();
  }

  function ingestKey(ch, nx, ny) {
    var code = (ch && ch.charCodeAt) ? ch.charCodeAt(0) : 60;
    var midi = 60 + (code % 12);
    /* map via pack scale like piano-buddy */
    var P = pack();
    var sc = P.scale;
    midi = P.root + sc[code % sc.length];
    lastKeyMidi = midi;
    points.push({
      x: (nx - 0.5) * 2,
      y: (0.5 - ny) * 2,
      z: (code % 12) * 0.04,
      r: 180,
      g: 220,
      b: 255,
      t: Date.now(),
      kind: "key",
      midi: midi,
    });
    while (points.length > MAX) points.shift();
    if (musicOn) playDrop(midi, 0.85);
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

  function paintFt() {
    var ft = document.getElementById("mg-maze-ft");
    if (!ft) return;
    var P = pack();
    ft.textContent =
      "pts " +
      points.length +
      " · " +
      P.id +
      " · " +
      (musicOn ? "♫ rain" : "mute") +
      " · " +
      liveBpm() +
      "bpm" +
      (autoSpin ? " · spin" : " · hold");
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
    /* rain streaks */
    for (var ri = rainVis.length - 1; ri >= 0; ri--) {
      var rv = rainVis[ri];
      rv.life -= 0.04;
      rv.y += 0.03;
      if (rv.life <= 0 || rv.y > 1.1) {
        rainVis.splice(ri, 1);
        continue;
      }
      ctx.strokeStyle = "hsla(" + rv.hue + ",80%,70%," + rv.life * 0.55 + ")";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(rv.x * W, rv.y * H);
      ctx.lineTo(rv.x * W + 1, rv.y * H + 10 * rv.life);
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
    paintFt();
  }

  var _tickN = 0;
  function tick() {
    _tickN++;
    var busy = false;
    try {
      busy = !!window.__mgWebgridPlayBusy;
    } catch (eB) {}
    /* During WebGrid chase: skip rain + most frames (Intel CPU) */
    if (busy) {
      if (musicOn) {
        musicOn = false;
      }
      if (_tickN % 4 !== 0) return;
      if (open) draw();
      return;
    }
    if (autoSpin) {
      yaw += 0.006;
      pitch = 0.22 + Math.sin(Date.now() / 4000) * 0.08;
    }
    try {
      if (window.__mgContrail && window.__mgContrail.path)
        ingestContrailPath(window.__mgContrail.path);
    } catch (e) {}
    rainTick();
    draw();
  }

  setInterval(tick, 80);
  setTimeout(function () {
    ensureUi();
    draw();
  }, 400);

  /* unlock audio on first user gesture anywhere (autoplay policy) */
  function unlockOnce() {
    if (musicOn) ensureAudio();
    document.removeEventListener("pointerdown", unlockOnce, true);
  }
  document.addEventListener("pointerdown", unlockOnce, true);

  window.__mgMemoryMaze = {
    ver: VER,
    ingestContrailPath: ingestContrailPath,
    ingestKey: ingestKey,
    packs: PACKS,
    setPack: function (id) {
      for (var i = 0; i < PACKS.length; i++) {
        if (PACKS[i].id === id) {
          packIdx = i;
          paintFt();
          return PACKS[i];
        }
      }
      return pack();
    },
    cyclePack: function () {
      packIdx = (packIdx + 1) % PACKS.length;
      paintFt();
      return pack();
    },
    setMusic: function (on) {
      musicOn = !!on;
      if (musicOn) ensureAudio();
      if (panel) {
        var b = panel.querySelector("#mg-maze-music");
        if (b) {
          b.classList.toggle("on", musicOn);
          b.classList.toggle("mute", !musicOn);
        }
      }
    },
    isMusicOn: function () {
      return musicOn;
    },
    playDrop: playDrop,
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
      return (
        VER +
        " pts=" +
        points.length +
        " pack=" +
        pack().id +
        " music=" +
        musicOn +
        " drops=" +
        dropCount
      );
    },
  };
  log(VER + " · maze rain · packs " + PACKS.map(function (p) { return p.id; }).join("/"));
})();
