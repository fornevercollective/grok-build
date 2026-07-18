/* Memory Glass · memory maze gsplat (from contrail / keyboard points)
 * Lightweight canvas "space" — point cloud + corridors.
 * Rain music: Daito / Rhizomatiks installation spirit —
 * sparse spatial events, metallic partials, long room, soft continuum
 * (phase-forms / body-signal → sound lineage · not cute piano arps).
 * VER: memory-maze-v3b-daito-fill
 */
(function () {
  "use strict";
  var VER = "memory-maze-v3c-beats-feed";
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

  /* ── music packs · default = installation rain (daito.ws lineage) ── */
  var PACKS = [
    {
      id: "raindrop",
      label: "Install rain",
      from: "daito.ws / Rhizomatiks installation · Phase Forms sparse",
      root: 55,
      scale: [0, 1, 3, 5, 7, 8, 10], /* phrygian-ish / dark install */
      mode: "install-phryg",
      bpm: 58,
      decay: 2.4,
      gain: 0.038,
      wave: "sine",
      spread: 18,
      style: "install",
      noise: 0.55,
      metal: 0.7,
      continuum: 0.22,
      delayMs: 420,
      fb: 0.42,
      sparse: 1.35,
    },
    {
      id: "phase-forms",
      label: "Phase forms",
      from: "polyrhythm ambient · AV install continuum",
      root: 50,
      scale: [0, 2, 3, 7, 10, 12, 14],
      mode: "poly-ambient",
      bpm: 48,
      decay: 3.2,
      gain: 0.034,
      wave: "triangle",
      spread: 20,
      style: "install",
      noise: 0.35,
      metal: 0.85,
      continuum: 0.32,
      delayMs: 510,
      fb: 0.48,
      sparse: 1.6,
      poly: [1, 1.5, 2.0],
    },
    {
      id: "body-signal",
      label: "Body signal",
      from: "physiological → tone · early Rhizomatiks feedback",
      root: 48,
      scale: [0, 3, 5, 7, 10, 15],
      mode: "body-pent",
      bpm: 64,
      decay: 1.8,
      gain: 0.04,
      wave: "sine",
      spread: 14,
      style: "install",
      noise: 0.7,
      metal: 0.45,
      continuum: 0.18,
      delayMs: 280,
      fb: 0.36,
      sparse: 1.15,
    },
    {
      id: "glass-mesh",
      label: "Glass mesh",
      from: "crystalline partials · museum hall",
      root: 67,
      scale: [0, 2, 5, 7, 9, 12],
      mode: "glass-hex",
      bpm: 72,
      decay: 2.0,
      gain: 0.036,
      wave: "sine",
      spread: 16,
      style: "install",
      noise: 0.25,
      metal: 0.95,
      continuum: 0.14,
      delayMs: 360,
      fb: 0.4,
      sparse: 1.25,
    },
    {
      id: "aeolian",
      label: "Aeolian soft",
      from: "qbpm Mode VI (legacy soft)",
      root: 67,
      scale: [0, 2, 3, 5, 7, 8, 10],
      mode: "aeolian",
      bpm: 84,
      decay: 0.95,
      gain: 0.05,
      wave: "triangle",
      spread: 12,
      style: "soft",
      noise: 0.1,
      metal: 0.2,
      continuum: 0.08,
      delayMs: 180,
      fb: 0.28,
      sparse: 1.0,
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
      style: "soft",
      noise: 0.12,
      metal: 0.25,
      continuum: 0.06,
      delayMs: 160,
      fb: 0.25,
      sparse: 0.95,
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
  var open = false; /* start closed — open via MAZE / FLOATS, not frozen on launch */

  var packIdx = 0;
  var musicOn = true;
  var audioCtx = null;
  var master = null;
  var delayNode = null;
  var delayNode2 = null;
  var delayFb = null;
  var delayFb2 = null;
  var wetBus = null;
  var dryBus = null;
  var continuumOsc = null;
  var continuumGain = null;
  var continuumLfo = null;
  var lastDropT = 0;
  var dropCount = 0;
  var rainVis = []; /* {x,y,life,hue} canvas rain streaks */
  var lastKeyMidi = null;
  var phaseAccum = 0;
  var fillMode = true; /* fill = large viewable canvas, not cramped postage stamp */

  function pack() {
    return PACKS[packIdx % PACKS.length];
  }

  function applyFillLayout() {
    if (!panel) return;
    if (fillMode) {
      panel.classList.add("fill");
      panel.style.width = "";
      panel.style.maxHeight = "";
      panel.style.height = "";
      panel.style.left = "12px";
      panel.style.top = "48px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    } else {
      panel.classList.remove("fill");
    }
    draw();
  }

  function ensureUi() {
    if (panel) return;
    if (!document.getElementById("mg-maze-css")) {
      var st = document.createElement("style");
      st.id = "mg-maze-css";
      st.textContent = [
        "#mg-mem-maze{position:fixed;left:12px;top:56px;z-index:2147482995;",
        "  width:min(320px,36vw);border-radius:12px;overflow:hidden;",
        "  background:rgba(10,12,16,0.5);backdrop-filter:blur(22px) saturate(1.35);",
        "  -webkit-backdrop-filter:blur(22px) saturate(1.35);",
        "  border:1px solid rgba(255,255,255,0.16);",
        "  box-shadow:0 8px 24px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.1);",
        "  font:650 9px/1.2 system-ui;color:rgba(244,246,250,0.92);pointer-events:auto}",
        /* FILL: large square view — entire gsplat space readable */ 
        "#mg-mem-maze.fill{width:min(52vw,720px);max-width:calc(100vw - 24px);",
        "  left:12px;top:48px;}",
        "#mg-mem-maze.hidden{display:none}",
        "#mg-mem-maze .hd{display:flex;justify-content:space-between;align-items:center;",
        "  padding:6px 8px;letter-spacing:0.12em;text-transform:uppercase;",
        "  border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(160,210,255,0.9)}",
        "#mg-mem-maze .hd button{appearance:none;background:transparent;border:0;color:inherit;",
        "  cursor:pointer;font:700 11px/1 system-ui;margin-left:2px}",
        "#mg-mem-maze .hd button.on{color:rgba(120,230,180,0.95)}",
        "#mg-mem-maze .hd button.mute{color:rgba(180,180,190,0.55)}",
        "#mg-mem-maze canvas{width:100%;height:min(36vh,280px);display:block;cursor:grab;",
        "  aspect-ratio:1/1;max-height:min(48vh,520px);}",
        "#mg-mem-maze.fill canvas{height:auto;min-height:min(42vw,520px);",
        "  max-height:min(70vh,720px);aspect-ratio:1/1;}",
        "#mg-mem-maze .ft{padding:4px 8px 6px;font:500 8px/1.25 ui-monospace,Menlo,monospace;",
        "  color:rgba(160,200,180,0.85);letter-spacing:0.04em}",
      ].join("");
      (document.head || document.documentElement).appendChild(st);
    }
    panel = document.createElement("div");
    panel.id = "mg-mem-maze";
    if (fillMode) panel.classList.add("fill");
    if (!open) panel.classList.add("hidden");
    panel.innerHTML =
      '<div class="hd"><span>Memory maze · install</span>' +
      '<span>' +
      '<button type="button" id="mg-maze-music" title="music on/off" class="on">♫</button> ' +
      '<button type="button" id="mg-maze-pack" title="cycle pack">PACK</button> ' +
      '<button type="button" id="mg-maze-fill" title="fill / compact view" class="on">FILL</button> ' +
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
    panel.querySelector("#mg-maze-fill").onclick = function () {
      fillMode = !fillMode;
      var bf = panel.querySelector("#mg-maze-fill");
      bf.classList.toggle("on", fillMode);
      applyFillLayout();
      log("maze view " + (fillMode ? "FILL" : "compact"));
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
      updateContinuum();
      log("maze music " + (musicOn ? "on · install rain" : "off"));
    };
    panel.querySelector("#mg-maze-pack").onclick = function () {
      packIdx = (packIdx + 1) % PACKS.length;
      log("maze pack " + pack().id + " · " + (pack().from || "").slice(0, 40));
      paintFt();
      if (musicOn) {
        ensureAudio();
        applyPackRoom();
        playDrop(pack().root + pack().scale[0], 0.72, { pan: -0.3 });
        setTimeout(function () {
          playDrop(pack().root + pack().scale[2 % pack().scale.length] + 12, 0.45, {
            pan: 0.35,
          });
        }, 220);
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
        master.gain.value = 0.78;
        dryBus = audioCtx.createGain();
        dryBus.gain.value = 0.72;
        wetBus = audioCtx.createGain();
        wetBus.gain.value = 0.48;

        /* dual-tap feedback delay = museum / installation hall */
        delayNode = audioCtx.createDelay(1.5);
        delayNode.delayTime.value = 0.42;
        delayNode2 = audioCtx.createDelay(1.5);
        delayNode2.delayTime.value = 0.67;
        delayFb = audioCtx.createGain();
        delayFb.gain.value = 0.42;
        delayFb2 = audioCtx.createGain();
        delayFb2.gain.value = 0.28;
        var lp = audioCtx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 4200;
        lp.Q.value = 0.4;

        delayNode.connect(delayFb);
        delayFb.connect(delayNode2);
        delayNode2.connect(delayFb2);
        delayFb2.connect(delayNode);
        delayNode.connect(lp);
        delayNode2.connect(lp);
        lp.connect(wetBus);

        dryBus.connect(master);
        wetBus.connect(master);
        master.connect(audioCtx.destination);

        startContinuum();
      }
      applyPackRoom();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) {}
    return audioCtx;
  }

  function applyPackRoom() {
    if (!audioCtx || !delayNode) return;
    var P = pack();
    var t = audioCtx.currentTime;
    try {
      delayNode.delayTime.setTargetAtTime((P.delayMs || 400) / 1000, t, 0.05);
      if (delayNode2)
        delayNode2.delayTime.setTargetAtTime(((P.delayMs || 400) * 1.55) / 1000, t, 0.05);
      if (delayFb) delayFb.gain.setTargetAtTime(P.fb != null ? P.fb : 0.4, t, 0.08);
      if (delayFb2)
        delayFb2.gain.setTargetAtTime((P.fb != null ? P.fb : 0.4) * 0.65, t, 0.08);
      if (wetBus)
        wetBus.gain.setTargetAtTime(P.style === "install" ? 0.52 : 0.28, t, 0.08);
    } catch (eR) {}
    updateContinuum();
  }

  /** Soft installation continuum under sparse events (Phase Forms air) */
  function startContinuum() {
    if (!audioCtx || continuumOsc) return;
    try {
      continuumOsc = audioCtx.createOscillator();
      continuumOsc.type = "sine";
      continuumGain = audioCtx.createGain();
      continuumGain.gain.value = 0.0001;
      continuumLfo = audioCtx.createOscillator();
      continuumLfo.type = "sine";
      continuumLfo.frequency.value = 0.07;
      var lfoG = audioCtx.createGain();
      lfoG.gain.value = 3.5;
      continuumLfo.connect(lfoG);
      lfoG.connect(continuumOsc.frequency);
      continuumOsc.connect(continuumGain);
      continuumGain.connect(dryBus);
      continuumGain.connect(delayNode);
      continuumOsc.start();
      continuumLfo.start();
      updateContinuum();
    } catch (eC) {}
  }

  function updateContinuum() {
    if (!audioCtx || !continuumOsc || !continuumGain) return;
    var P = pack();
    var t = audioCtx.currentTime;
    var base = midiToFreq((P.root || 55) - 12);
    try {
      continuumOsc.frequency.setTargetAtTime(base, t, 0.2);
      var level = musicOn ? (P.continuum || 0.12) * 0.045 : 0.0001;
      continuumGain.gain.setTargetAtTime(Math.max(0.0001, level), t, 0.4);
    } catch (eU) {}
  }

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  function makeNoiseBuffer(ctx, seconds) {
    var n = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /**
   * Installation rain event — metallic partials + bandpass grain + long hall.
   * Daito / Rhizomatiks spirit: body-mapped pitch, sparse, spatial, not cute.
   */
  function playDrop(midi, vel, opts) {
    if (!musicOn) return;
    var ctx = ensureAudio();
    if (!ctx || !master) return;
    opts = opts || {};
    var P = pack();
    vel = vel == null ? 0.65 : vel;
    /* feed live notation → beats staff + piano (skip if caller already notated) */
    if (!opts.noNotate) {
      try {
        if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.onMazeNote) {
          window.__mgKeyboardBeats.onMazeNote(midi, {
            src: "maze",
            pack: P.id,
            vel: vel,
            hit: true,
          });
        } else if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.ingestNote) {
          window.__mgKeyboardBeats.ingestNote(midi, { src: "maze", pack: P.id, hit: true });
        }
      } catch (eNote) {}
    }
    var t = ctx.currentTime + (opts.when || 0);
    var freq = midiToFreq(midi);
    var peak = (P.gain || 0.04) * vel;
    var decay = P.decay || 2.0;
    var install = P.style === "install" || P.style == null;
    var metal = P.metal != null ? P.metal : install ? 0.7 : 0.2;
    var noiseAmt = P.noise != null ? P.noise : install ? 0.5 : 0.1;
    var pan = opts.pan;
    if (pan == null || !isFinite(pan)) pan = (Math.random() * 2 - 1) * 0.85;

    var out = ctx.createGain();
    out.gain.value = 1;
    try {
      if (ctx.createStereoPanner) {
        var panN = ctx.createStereoPanner();
        panN.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
        out.connect(panN);
        panN.connect(dryBus);
        panN.connect(delayNode);
      } else {
        out.connect(dryBus);
        out.connect(delayNode);
      }
    } catch (eP) {
      out.connect(dryBus);
      if (delayNode) out.connect(delayNode);
    }

    /* 1) body tone — slow attack, long release (installation, not pluck) */
    var g = ctx.createGain();
    var atk = install ? 0.04 + Math.random() * 0.06 : 0.012;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    var o = ctx.createOscillator();
    o.type = P.wave === "triangle" ? "triangle" : "sine";
    o.frequency.setValueAtTime(freq, t);
    /* slight downward glide = drop / gravity */
    try {
      o.frequency.exponentialRampToValueAtTime(freq * 0.972, t + Math.min(0.45, decay * 0.25));
    } catch (eF) {}
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + decay + 0.08);

    /* 2) metallic partial stack (inharmonic · glass / mesh) */
    if (metal > 0.05) {
      var ratios = [2.01, 2.76, 3.52, 5.04];
      for (var ri = 0; ri < ratios.length; ri++) {
        if (Math.random() > metal) continue;
        var om = ctx.createOscillator();
        om.type = "sine";
        om.frequency.value = freq * ratios[ri] * (0.998 + Math.random() * 0.006);
        var gm = ctx.createGain();
        var mp = peak * metal * (0.12 / (ri + 1));
        gm.gain.setValueAtTime(0.0001, t);
        gm.gain.exponentialRampToValueAtTime(mp, t + 0.008 + ri * 0.004);
        gm.gain.exponentialRampToValueAtTime(0.0001, t + 0.25 + metal * 0.9);
        om.connect(gm);
        gm.connect(out);
        om.start(t);
        om.stop(t + 1.4);
      }
    }

    /* 3) bandpass noise grain (impact / droplet in a hall) */
    if (noiseAmt > 0.05) {
      try {
        var src = ctx.createBufferSource();
        src.buffer = makeNoiseBuffer(ctx, 0.12);
        var bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = freq * (1.4 + Math.random() * 1.2);
        bp.Q.value = 4 + metal * 8;
        var gn = ctx.createGain();
        var np = peak * noiseAmt * 0.55;
        gn.gain.setValueAtTime(0.0001, t);
        gn.gain.exponentialRampToValueAtTime(np, t + 0.004);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.09 + noiseAmt * 0.08);
        src.connect(bp);
        bp.connect(gn);
        gn.connect(out);
        src.start(t);
        src.stop(t + 0.15);
      } catch (eN) {}
    }

    /* 4) occasional sub pulse for sparse installation weight */
    if (install && Math.random() < 0.18) {
      var os = ctx.createOscillator();
      os.type = "sine";
      os.frequency.value = midiToFreq(Math.max(28, midi - 24));
      var gs = ctx.createGain();
      gs.gain.setValueAtTime(0.0001, t);
      gs.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.03);
      gs.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.7);
      os.connect(gs);
      gs.connect(out);
      os.start(t);
      os.stop(t + decay);
    }

    dropCount++;

    /* collab bus — qbpm-live + install tag for multi-agent sessions */
    try {
      var bc = new BroadcastChannel("qbpm-live");
      bc.postMessage({
        type: "kbatch.qbpm.live",
        source: "mg-memory-maze-rain",
        style: P.style || "install",
        pack: P.id,
        midi: Math.round(midi),
        bpm: liveBpm(),
        drop: dropCount,
        pan: pan,
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
    var P = pack();
    var bpm = liveBpm();
    var interval = 60000 / Math.max(36, bpm);
    /* installation: sparser, more irregular (not arpeggio rain) */
    var sparse = P.sparse != null ? P.sparse : 1.2;
    var dens = Math.min(1.25, 0.28 + points.length / 520) / sparse;
    var wait = (interval * (0.55 + Math.random() * 1.35)) / Math.max(0.2, dens);
    /* polyrhythm phase (Phase Forms spirit) */
    if (P.poly && P.poly.length) {
      phaseAccum += 1;
      var poly = P.poly[phaseAccum % P.poly.length];
      wait *= poly;
    }
    if (now - lastDropT < wait) return;
    lastDropT = now;

    if (!points.length) {
      /* rare hall events when empty — continuum carries the room */
      if (Math.random() < 0.22) {
        var sc0 = P.scale;
        var midi0 = P.root + sc0[Math.floor(Math.random() * sc0.length)];
        playDrop(midi0, 0.28 + Math.random() * 0.25, {
          pan: Math.random() * 2 - 1,
        });
        rainVis.push({
          x: Math.random(),
          y: Math.random() * 0.25,
          life: 1,
          hue: 200 + Math.floor(Math.random() * 40),
        });
      }
      return;
    }

    var p = points[Math.floor(Math.random() * points.length)];
    var midi = degreeFromPoint(p);
    var vel = 0.32 + Math.random() * 0.5;
    /* stress / warm path color maps to energy (body-signal) */
    if (p.r > 200 && p.g < 120) vel *= 1.2;
    if (p.g > 200 && p.r < 140) vel *= 0.85;
    var pan = Math.max(-1, Math.min(1, p.x * 0.75 + (Math.random() - 0.5) * 0.2));
    playDrop(midi, vel, { pan: pan });

    /* occasional double-hit at polyrhythm offset (collab / multi-agent feel) */
    if (P.style === "install" && Math.random() < 0.2) {
      var sc = P.scale;
      var m2 = midi + sc[Math.floor(Math.random() * sc.length)] - sc[0];
      playDrop(m2, vel * 0.55, {
        pan: -pan * 0.7,
        when: (interval / 1000) * (0.33 + Math.random() * 0.25),
      });
    }

    rainVis.push({
      x: 0.5 + p.x * 0.22,
      y: 0.15 + Math.random() * 0.2,
      life: 1.15,
      hue: 185 + (Math.round(midi) % 12) * 8,
    });
    if (rainVis.length > 36) rainVis.shift();
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
    /* noNotate: keyboard-beats.onKey already writes staff/piano for keys;
       maze rain (playDrop from rainTick) still notates freely */
    if (musicOn) playDrop(midi, 0.85, { noNotate: true });
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
      (musicOn ? (P.style === "install" ? "♫ install" : "♫ rain") : "mute") +
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
    var W = cv.clientWidth || (fillMode ? 480 : 280);
    /* square canvas so full 3d view is not letterboxed/cramped */
    var H = cv.clientHeight || W;
    if (H < 80) H = W;
    if (Math.abs(W - H) > 8) {
      /* force square draw space */
      H = W;
    }
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
    /* During WebGrid chase: keep maze OPEN + rain optional; only throttle FPS */
    if (busy) {
      if (_tickN % 2 !== 0) return;
      if (autoSpin) {
        yaw += 0.004;
        pitch = 0.22 + Math.sin(Date.now() / 4000) * 0.08;
      }
      try {
        if (window.__mgContrail && window.__mgContrail.path)
          ingestContrailPath(window.__mgContrail.path);
      } catch (eBusyIn) {}
      if (musicOn && _tickN % 3 === 0) rainTick();
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
          applyPackRoom();
          return PACKS[i];
        }
      }
      return pack();
    },
    cyclePack: function () {
      packIdx = (packIdx + 1) % PACKS.length;
      paintFt();
      applyPackRoom();
      return pack();
    },
    setMusic: function (on) {
      musicOn = !!on;
      if (musicOn) ensureAudio();
      updateContinuum();
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
    isOpen: function () {
      return open;
    },
    playDrop: playDrop,
    scaleMidis: function () {
      var P = pack();
      return (P.scale || []).map(function (d) {
        return (P.root || 60) + d;
      });
    },
    pack: pack,
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
