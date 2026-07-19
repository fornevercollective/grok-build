/* Memory Glass · beats + staff + piano for memory-maze notation
 * Maze rain / path / keys → live treble staff + piano strip (piano-buddy / qbpm).
 * VER: keyboard-beats-v4-maze-notation
 */
(function () {
  "use strict";
  var VER = "keyboard-beats-v9-popout-only";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._kbBeatsVer === VER) return;
  HP._kbBeatsVer = VER;
  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "kb-beats");
    } catch (e) {}
  }

  var keys = [];
  var beats = []; /* {t, midi, name, hit, src, ch, pack} */
  var bpm = 96;
  var lastBeatT = 0;
  var attempts = 0;
  var hits = 0;
  var strip = null;
  var open = false;
  var audioCtx = null;
  var staffCv = null;
  var pianoCv = null;
  var raf = 0;
  var litUntil = {}; /* midi → timestamp until lit on piano */
  var lastCatEntry = null; /* last loaded staff-catalogue entry */
  var playTimers = []; /* sequential motif/scale playback */
  /* Float on center canvas ONLY when user pop-outs — drawer embed is the default surface */
  var floatAllowed = false;

  /* keyboard map (float-kb) */
  var NOTE_MAP = {
    a: 60,
    s: 62,
    d: 64,
    f: 65,
    g: 67,
    h: 69,
    j: 71,
    k: 72,
    l: 74,
    q: 72,
    w: 74,
    e: 76,
    r: 77,
    t: 79,
    y: 81,
    u: 83,
    i: 84,
    o: 86,
    p: 88,
    z: 48,
    x: 50,
    c: 52,
    v: 53,
    b: 55,
    n: 57,
    m: 59,
  };
  var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  /* piano-buddy hues per pitch class */
  var PC_HUE = [350, 20, 40, 55, 90, 150, 185, 210, 265, 290, 320, 335];

  function midiName(m) {
    m = Math.round(m);
    return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  }
  function isBlack(m) {
    var pc = ((m % 12) + 12) % 12;
    return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
  }

  function ensureCss() {
    var old = document.getElementById("mg-kb-beats-css");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "mg-kb-beats-css";
    st.textContent = [
      "#mg-kb-beats{position:fixed;right:12px;bottom:calc(12px + var(--mg-kb-h,0px));",
      "  z-index:2147482998;width:min(380px,42vw);max-height:min(32vh,240px);",
      "  border-radius:12px;overflow:hidden;display:flex;flex-direction:column;",
      "  background:rgba(10,12,16,0.62);backdrop-filter:blur(22px) saturate(1.35);",
      "  -webkit-backdrop-filter:blur(22px) saturate(1.35);",
      "  border:1px solid rgba(255,255,255,0.18);",
      "  box-shadow:0 8px 24px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.1);",
      "  font:600 10px/1.35 ui-monospace,Menlo,monospace;color:rgba(220,235,250,0.94);",
      "  pointer-events:auto;letter-spacing:0.04em}",
      "#mg-kb-beats.hidden{display:none!important}",
      "#mg-kb-beats.mg-embedded,#mg-drawer-beats-host #mg-kb-beats{",
      "  position:relative!important;left:auto!important;right:auto!important;",
      "  top:auto!important;bottom:auto!important;",
      "  width:100%!important;max-width:none!important;",
      "  max-height:none!important;min-height:220px!important;height:auto!important;",
      "  z-index:1!important;margin:0!important;",
      "  border-radius:16px!important;",
      "  border:1px solid rgba(255,255,255,0.12)!important;",
      "  background:rgba(255,255,255,0.06)!important;",
      "  backdrop-filter:blur(24px) saturate(1.4)!important;",
      "  -webkit-backdrop-filter:blur(24px) saturate(1.4)!important;",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.12)!important;",
      "  display:flex!important;visibility:visible!important;opacity:1!important;",
      "  pointer-events:auto!important}",
      "#mg-kb-beats .hd{display:flex;justify-content:space-between;align-items:center;",
      "  padding:10px 12px;letter-spacing:0.1em;text-transform:uppercase;",
      "  border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(160,210,255,0.9);",
      "  font:650 10px/1.2 system-ui;flex-shrink:0}",
      "#mg-kb-beats .hd button{appearance:none;background:transparent;border:0;color:inherit;",
      "  cursor:pointer;font:700 12px/1 system-ui;padding:2px 6px}",
      "#mg-kb-beats .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;",
      "  padding:8px 12px;flex-shrink:0}",
      "#mg-kb-beats b{color:rgba(160,210,255,0.95)}",
      "#mg-kb-beats .bar{flex:1;min-width:80px;height:7px;border-radius:4px;",
      "  background:rgba(255,255,255,0.08);overflow:hidden}",
      "#mg-kb-beats .bar i{display:block;height:100%;background:linear-gradient(90deg,",
      "  #50e6a0,#a0c8ff,#ffb060,#f070d0,#70e0ff);width:0%;transition:width .12s}",
      "#mg-kb-beats .staff-wrap{padding:0 10px 10px;flex:1 1 auto;min-height:100px;",
      "  display:flex;flex-direction:column;gap:6px}",
      "#mg-kb-beats canvas.staff{width:100%;height:96px;display:block;border-radius:10px;",
      "  background:rgba(4,8,14,0.9);border:1px solid rgba(255,255,255,0.12);",
      "  flex:1 1 auto;min-height:88px}",
      "#mg-kb-beats canvas.piano{width:100%;height:56px;display:block;border-radius:10px;",
      "  background:rgba(8,10,14,0.95);border:1px solid rgba(255,255,255,0.12);",
      "  flex-shrink:0;cursor:pointer}",
      "#mg-kb-beats.mg-embedded canvas.staff{min-height:100px;height:108px}",
      "#mg-kb-beats.mg-embedded canvas.piano{height:64px}",
      "#mg-kb-beats .src{opacity:0.75;font-size:9px}",
      "#mg-kb-beats .note-live{color:rgba(180,230,255,0.95);font-weight:700}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function ensureUi() {
    if (strip && document.body.contains(strip)) return;
    ensureCss();
    strip = document.createElement("div");
    strip.id = "mg-kb-beats";
    strip.className = open && (floatAllowed || false) ? "" : "hidden mg-product-ghost";
    strip.innerHTML =
      '<div class="hd"><span>Beats · maze staff · piano</span>' +
      '<span style="display:flex;gap:4px;align-items:center">' +
      '<button type="button" id="mg-kb-beats-dock" title="Dock to Keys drawer">DOCK</button>' +
      '<button type="button" id="mg-kb-beats-clr" title="clear staff">CLR</button>' +
      '<button type="button" id="mg-kb-beats-x">×</button></span></div>' +
      '<div class="row">' +
      '<span>BPM <b id="mg-kb-bpm">96</b></span>' +
      '<span>ATT <b id="mg-kb-att">0</b></span>' +
      '<span>HIT <b id="mg-kb-hit">0</b></span>' +
      '<span class="bar"><i id="mg-kb-fill"></i></span>' +
      '<span class="note-live" id="mg-kb-note">—</span>' +
      '<span class="src" id="mg-kb-src">maze</span>' +
      "</div>" +
      '<div class="staff-wrap">' +
      '<canvas class="staff" id="mg-kb-staff" aria-label="music staff"></canvas>' +
      '<canvas class="piano" id="mg-kb-piano" aria-label="piano keyboard"></canvas>' +
      "</div>";
    (document.body || document.documentElement).appendChild(strip);
    staffCv = strip.querySelector("#mg-kb-staff");
    pianoCv = strip.querySelector("#mg-kb-piano");
    strip.querySelector("#mg-kb-beats-x").onclick = function () {
      setOpen(false);
    };
    var dockB = strip.querySelector("#mg-kb-beats-dock");
    if (dockB)
      dockB.onclick = function () {
        dockIn();
      };
    strip.querySelector("#mg-kb-beats-clr").onclick = function () {
      beats = [];
      keys = [];
      paint();
    };
    /* click piano → play + record */
    pianoCv.addEventListener("pointerdown", function (ev) {
      var midi = hitPiano(ev);
      if (midi != null) {
        ingestNote(midi, { src: "piano", hit: true, ch: midiName(midi) });
        blip(midi);
      }
    });
  }

  function blip(midi) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      g.gain.value = 0.045;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
      o.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  }

  /* ── staff: treble, maze notes as notation ── */
  function drawStaff() {
    if (!staffCv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = Math.max(160, staffCv.clientWidth || 400);
    var H = Math.max(72, staffCv.clientHeight || 96);
    staffCv.width = Math.floor(W * dpr);
    staffCv.height = Math.floor(H * dpr);
    var ctx = staffCv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(4,8,14,0.95)";
    ctx.fillRect(0, 0, W, H);

    var top = Math.max(18, Math.floor(H * 0.18));
    var gap = Math.max(7, Math.min(11, Math.floor((H - top - 16) / 5)));
    var staffBottom = top + 4 * gap;
    var left = 34;
    var right = W - 10;

    /* staff lines */
    ctx.strokeStyle = "rgba(190,210,230,0.42)";
    ctx.lineWidth = 1;
    for (var L = 0; L < 5; L++) {
      var yL = top + L * gap;
      ctx.beginPath();
      ctx.moveTo(left, yL);
      ctx.lineTo(right, yL);
      ctx.stroke();
    }

    /* G clef */
    ctx.fillStyle = "rgba(170,215,255,0.92)";
    ctx.font = "700 " + Math.floor(gap * 4.2) + "px Georgia,'Times New Roman',serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("𝄞", 4, top + 3.6 * gap);

    /* time / catalogue or maze pack tag */
    var packId = "—";
    if (lastCatEntry && (lastCatEntry.title || lastCatEntry.id)) {
      packId = String(lastCatEntry.title || lastCatEntry.id).slice(0, 28);
    } else {
      try {
        if (window.__mgMemoryMaze && window.__mgMemoryMaze.packs) {
          var rep = window.__mgMemoryMaze.report && window.__mgMemoryMaze.report();
          if (rep && /pack=([\w-]+)/.test(rep)) packId = RegExp.$1;
        }
      } catch (eP) {}
    }
    ctx.fillStyle = "rgba(140,180,200,0.7)";
    ctx.font = "600 8px ui-monospace,Menlo,monospace";
    ctx.fillText(bpm + "♩ · " + packId, left, H - 4);

    /* MIDI → Y: C4(60) sits on ledger below staff (treble) */
    /* E4=64 = bottom line, G5=79 = top line approximately:
       diatonic steps from E4: each step = gap/2 */
    function midiY(midi) {
      /* map chromatic relative to E4 (bottom line = 64) */
      var steps = midi - 64; /* half-steps from E4 */
      return staffBottom - steps * (gap / 2);
    }

    function ledgerAt(y, x) {
      if (y >= top - 1 && y <= staffBottom + 1) return;
      ctx.strokeStyle = "rgba(190,210,230,0.45)";
      ctx.lineWidth = 1;
      /* draw ledgers at staff-line spacing */
      var yy;
      if (y > staffBottom) {
        for (yy = staffBottom + gap; yy <= y + 1; yy += gap) {
          ctx.beginPath();
          ctx.moveTo(x - 8, yy);
          ctx.lineTo(x + 8, yy);
          ctx.stroke();
        }
      } else if (y < top) {
        for (yy = top - gap; yy >= y - 1; yy -= gap) {
          ctx.beginPath();
          ctx.moveTo(x - 8, yy);
          ctx.lineTo(x + 8, yy);
          ctx.stroke();
        }
      }
    }

    var recent = beats.slice(-28);
    var n = recent.length;
    var span = right - left - 16;
    if (!n) {
      /* show scale ghost from maze pack so staff is never empty */
      var ghost = mazeScaleMidis();
      ghost.forEach(function (m, i) {
        var x = left + 18 + (i / Math.max(1, ghost.length - 1)) * (span - 24);
        var y = midiY(m);
        ledgerAt(y, x);
        ctx.fillStyle = "rgba(100,160,200,0.28)";
        ctx.beginPath();
        ctx.ellipse(x, y, 5, 3.6, -0.35, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "rgba(140,180,200,0.55)";
      ctx.font = "600 9px ui-monospace,Menlo,monospace";
      ctx.fillText("maze scale · play path / keys → notation", left + 8, top - 4);
      return;
    }

    recent.forEach(function (bb, i) {
      var x = left + 12 + (i / Math.max(1, n - 1)) * span;
      if (n === 1) x = left + 28;
      var midi = bb.midi || 60;
      var y = midiY(midi);
      var hue =
        bb.src === "maze"
          ? 195
          : bb.src === "piano"
            ? 45
            : PC_HUE[((midi % 12) + 12) % 12];
      var alpha = bb.hit === false ? 0.45 : 0.95;
      ledgerAt(y, x);

      /* stem up for low, down for high */
      var stemUp = y >= top + 2 * gap;
      ctx.strokeStyle = "hsla(" + hue + ",80%,70%," + alpha + ")";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      if (stemUp) {
        ctx.moveTo(x + 5, y);
        ctx.lineTo(x + 5, y - gap * 2.6);
      } else {
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x - 5, y + gap * 2.6);
      }
      ctx.stroke();

      /* notehead */
      ctx.fillStyle = "hsla(" + hue + ",85%,65%," + alpha + ")";
      ctx.beginPath();
      ctx.ellipse(x, y, 5.8, 4.1, -0.4, 0, Math.PI * 2);
      ctx.fill();
      if (bb.src === "maze") {
        ctx.strokeStyle = "rgba(120,220,255,0.7)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      /* sharp for black keys */
      if (isBlack(midi)) {
        ctx.fillStyle = "hsla(" + hue + ",70%,80%,0.9)";
        ctx.font = "700 10px Georgia,serif";
        ctx.fillText("♯", x - 14, y + 3);
      }
    });

    /* bar lines every 4 notes */
    ctx.strokeStyle = "rgba(100,140,180,0.18)";
    for (var b = 4; b < n; b += 4) {
      var bx = left + 12 + (b / Math.max(1, n - 1)) * span;
      ctx.beginPath();
      ctx.moveTo(bx - 6, top - 2);
      ctx.lineTo(bx - 6, staffBottom + 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(140,190,210,0.7)";
    ctx.font = "600 8px ui-monospace,Menlo,monospace";
    ctx.fillText(n + " notes · staff", W - 92, H - 4);
  }

  function mazeScaleMidis() {
    try {
      var M = window.__mgMemoryMaze;
      if (!M || !M.packs) return [60, 62, 64, 65, 67, 69, 71, 72];
      var pack = M.packs[0];
      /* find active via report */
      var id = null;
      if (M.report) {
        var r = M.report();
        var m = /pack=([\w-]+)/.exec(r);
        if (m) id = m[1];
      }
      for (var i = 0; i < M.packs.length; i++) {
        if (M.packs[i].id === id) pack = M.packs[i];
      }
      var root = pack.root || 60;
      var sc = pack.scale || [0, 2, 4, 5, 7, 9, 11];
      return sc.map(function (d) {
        return root + d;
      });
    } catch (e) {
      return [60, 62, 64, 65, 67, 69, 71, 72];
    }
  }

  /* ── piano strip (2 octaves C3–B5 visible, center on maze notes) ── */
  var PIANO_LO = 48; /* C3 */
  var PIANO_HI = 84; /* C6 */

  function whiteKeysInRange() {
    var whites = [];
    for (var m = PIANO_LO; m <= PIANO_HI; m++) {
      if (!isBlack(m)) whites.push(m);
    }
    return whites;
  }

  function drawPiano() {
    if (!pianoCv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = Math.max(160, pianoCv.clientWidth || 400);
    var H = Math.max(40, pianoCv.clientHeight || 52);
    pianoCv.width = Math.floor(W * dpr);
    pianoCv.height = Math.floor(H * dpr);
    var ctx = pianoCv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(6,8,12,0.98)";
    ctx.fillRect(0, 0, W, H);

    var whites = whiteKeysInRange();
    var ww = W / whites.length;
    var now = Date.now();
    var i;

    /* white keys */
    for (i = 0; i < whites.length; i++) {
      var m = whites[i];
      var lit = litUntil[m] && litUntil[m] > now;
      var recentHit = lastBeatMidi() === m;
      ctx.fillStyle = lit || recentHit ? "hsla(" + PC_HUE[m % 12] + ",70%,78%,0.95)" : "#f2f0ea";
      ctx.fillRect(i * ww + 0.5, 0, ww - 1, H);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.strokeRect(i * ww + 0.5, 0, ww - 1, H);
      if (m % 12 === 0) {
        ctx.fillStyle = "rgba(40,50,60,0.55)";
        ctx.font = "600 8px ui-monospace,Menlo,monospace";
        ctx.fillText("C" + (Math.floor(m / 12) - 1), i * ww + 2, H - 4);
      }
    }

    /* black keys */
    var blackH = H * 0.58;
    for (i = 0; i < whites.length - 1; i++) {
      var wm = whites[i];
      var next = whites[i + 1];
      if (next - wm !== 2) continue; /* no black between E-F / B-C */
      var bm = wm + 1;
      var bx = (i + 1) * ww - ww * 0.32;
      var bw = ww * 0.55;
      var blit = litUntil[bm] && litUntil[bm] > now;
      ctx.fillStyle = blit
        ? "hsla(" + PC_HUE[bm % 12] + ",80%,45%,0.98)"
        : "rgba(18,18,22,0.96)";
      ctx.fillRect(bx, 0, bw, blackH);
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.strokeRect(bx, 0, bw, blackH);
    }

    /* maze scale dots under keys */
    var scale = mazeScaleMidis();
    scale.forEach(function (sm) {
      if (sm < PIANO_LO || sm > PIANO_HI) return;
      var wi = whites.indexOf(isBlack(sm) ? sm - 1 : sm);
      if (wi < 0) return;
      ctx.fillStyle = "rgba(80,200,255,0.55)";
      ctx.beginPath();
      ctx.arc(wi * ww + ww / 2, H - 6, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function lastBeatMidi() {
    if (!beats.length) return null;
    return beats[beats.length - 1].midi;
  }

  function hitPiano(ev) {
    if (!pianoCv) return null;
    var rect = pianoCv.getBoundingClientRect();
    var x = (ev.clientX != null ? ev.clientX : 0) - rect.left;
    var y = (ev.clientY != null ? ev.clientY : 0) - rect.top;
    var W = rect.width;
    var H = rect.height;
    var whites = whiteKeysInRange();
    var ww = W / whites.length;
    /* black keys first (on top) */
    if (y < H * 0.58) {
      for (var i = 0; i < whites.length - 1; i++) {
        var wm = whites[i];
        if (whites[i + 1] - wm !== 2) continue;
        var bx = (i + 1) * ww - ww * 0.32;
        var bw = ww * 0.55;
        if (x >= bx && x <= bx + bw) return wm + 1;
      }
    }
    var wi = Math.floor(x / ww);
    if (wi < 0 || wi >= whites.length) return null;
    return whites[wi];
  }

  function lightPiano(midi, ms) {
    litUntil[Math.round(midi)] = Date.now() + (ms || 280);
  }

  /* ── ingest ── */
  function ingestNote(midi, meta) {
    meta = meta || {};
    midi = Math.round(midi);
    if (!isFinite(midi)) return;
    var now = Date.now();
    var src = meta.src || "key";
    var hit = meta.hit != null ? !!meta.hit : true;
    if (src === "key" || src === "piano") {
      attempts++;
      if (hit) hits++;
    }
    beats.push({
      t: now,
      midi: midi,
      name: midiName(midi),
      hit: hit,
      src: src,
      ch: meta.ch || "",
      pack: meta.pack || "",
      bpm: bpm,
    });
    if (beats.length > 96) beats.shift();
    lightPiano(midi, src === "maze" ? 420 : 260);

    /* soft bpm from maze pack / live */
    try {
      if (window.__mgMemoryMaze && window.__mgMemoryMaze.bpm) {
        /* optional */
      }
      if (src === "maze" && window.__mgKeyboardBeats) {
        /* keep maze tempo if pack bpm available via report */
      }
    } catch (e) {}

    if (open) requestPaint(true);
    return { midi: midi, name: midiName(midi), src: src };
  }

  var lastKeyT = 0;
  var lastKeyCh = "";

  function onKey(ch, nx, ny) {
    ensureUi();
    var now = Date.now();
    ch = String(ch || "").toLowerCase();
    if (ch === " " || ch === "spc" || ch === "space") ch = "g";
    /* de-dupe: emitHop + legacy click hook (or double paint) same key within 40ms */
    if (ch === lastKeyCh && now - lastKeyT < 40) return { hit: false, bpm: bpm, midi: null, deduped: true };
    lastKeyCh = ch;
    lastKeyT = now;

    keys.push({ ch: ch, t: now, nx: nx || 0.5, ny: ny || 0.5 });
    if (keys.length > 64) keys.shift();

    var midi = NOTE_MAP[ch];
    /* prefer maze pack mapping when maze open */
    try {
      if (window.__mgMemoryMaze && window.__mgMemoryMaze.isOpen && window.__mgMemoryMaze.isOpen()) {
        var sc = mazeScaleMidis();
        if (sc.length) midi = sc[(ch.charCodeAt(0) || 0) % sc.length];
      }
    } catch (eM) {}
    if (midi == null) midi = 60 + ((ch.charCodeAt(0) || 0) % 12);

    blip(midi);

    var interval = 60000 / bpm;
    var phase = (now - lastBeatT) % interval;
    var err = Math.min(phase, interval - phase);
    var hit = err < interval * 0.22;
    if (now - lastBeatT > interval * 0.5) lastBeatT = now;

    if (keys.length >= 4) {
      var dt = keys[keys.length - 1].t - keys[keys.length - 4].t;
      if (dt > 80) {
        var est = Math.round((3 * 60000) / dt);
        bpm = Math.max(48, Math.min(180, Math.round(bpm * 0.85 + est * 0.15)));
      }
    }

    /* attempts/hits only in ingestNote — do not double-count here */
    ingestNote(midi, { src: "key", hit: hit, ch: ch });

    try {
      if (window.__mgMemoryMaze && window.__mgMemoryMaze.ingestKey)
        window.__mgMemoryMaze.ingestKey(ch, nx || 0.5, ny || 0.5);
    } catch (e) {}
    try {
      var bc = new BroadcastChannel("qbpm-live");
      bc.postMessage({
        type: "kbatch.qbpm.live",
        source: "mg-keyboard-beats",
        bpm: bpm,
        note: midi,
        name: midiName(midi),
        ch: ch,
        hit: hit,
        attempts: attempts,
        ts: now,
      });
      bc.close();
    } catch (e3) {}

    return { hit: hit, bpm: bpm, midi: midi };
  }

  function paint() {
    if (!open) return;
    ensureUi();
    var elBpm = document.getElementById("mg-kb-bpm");
    var elAtt = document.getElementById("mg-kb-att");
    var elHit = document.getElementById("mg-kb-hit");
    var elFill = document.getElementById("mg-kb-fill");
    var elNote = document.getElementById("mg-kb-note");
    var elSrc = document.getElementById("mg-kb-src");
    if (elBpm) elBpm.textContent = String(bpm);
    if (elAtt) elAtt.textContent = String(attempts);
    if (elHit) elHit.textContent = String(hits);
    if (elFill) {
      var acc = attempts ? hits / attempts : beats.length ? 1 : 0;
      elFill.style.width = Math.round(Math.min(1, acc) * 100) + "%";
    }
    if (elNote && beats.length) {
      var b = beats[beats.length - 1];
      elNote.textContent = (b.name || "m" + b.midi) + (b.hit === false ? " · miss" : "");
    } else if (elNote) {
      elNote.textContent = "scale";
    }
    if (elSrc && beats.length) {
      elSrc.textContent = beats[beats.length - 1].src || "—";
    } else if (elSrc) elSrc.textContent = "maze";
    drawStaff();
    drawPiano();
  }

  var paintDirty = false;
  var paintTimer = 0;

  function requestPaint(force) {
    if (!open && !force) return;
    paintDirty = true;
    if (paintTimer) return;
    paintTimer = requestAnimationFrame(function () {
      paintTimer = 0;
      if (!paintDirty) return;
      paintDirty = false;
      paint();
      /* keep painting only while keys are lit (not every frame forever) */
      var now = Date.now();
      var anyLit = false;
      for (var k in litUntil) {
        if (litUntil[k] > now) {
          anyLit = true;
          break;
        }
      }
      if (anyLit) requestPaint(true);
    });
  }

  function loop() {
    /* legacy entry — prefer requestPaint; only used if something still sets raf */
    if (!open) {
      raf = 0;
      return;
    }
    requestPaint(true);
    raf = 0;
  }

  /**
   * Single-path sync: float-keyboard.emitHop → onKey.
   * No document click capture (that double-fired with emitHop and desynced piano).
   */
  function hookKb() {
    if (window.__mgKbBeatsHooked) return;
    window.__mgKbBeatsHooked = true;
    log(VER + " · single-path emitHop → onKey (no click double-fire)");
  }

  setTimeout(hookKb, 200);
  setTimeout(hookKb, 800);

  /* pull maze BPM into staff when pack active */
  setInterval(function () {
    if (!open) return;
    try {
      if (window.__mgMemoryMaze && window.__mgMemoryMaze.report) {
        var r = window.__mgMemoryMaze.report();
        var m = /(\d+)bpm/.exec(r);
        if (m) {
          var pb = parseInt(m[1], 10);
          if (pb >= 36 && pb <= 200) bpm = Math.round(bpm * 0.7 + pb * 0.3);
        }
      }
    } catch (e) {}
  }, 2000);

  function isEmbedded() {
    return !!(strip && strip.classList && strip.classList.contains("mg-embedded"));
  }

  function setOpen(on, opts) {
    opts = opts || {};
    /* Canvas float requires explicit pop-out (or force). Drawer embed always allowed. */
    if (on && !isEmbedded() && !floatAllowed && !opts.forceFloat && !opts.popOut) {
      open = false;
      if (strip && !isEmbedded()) {
        strip.classList.add("hidden");
        strip.classList.add("mg-product-ghost");
        strip.classList.remove("mg-popout");
      }
      return;
    }
    if (on && (opts.popOut || opts.forceFloat)) {
      floatAllowed = true;
    }
    open = !!on;
    if (open) {
      ensureUi();
      strip.classList.remove("hidden");
      strip.classList.remove("mg-product-ghost");
      if (floatAllowed && !isEmbedded()) strip.classList.add("mg-popout");
      requestPaint(true);
      try {
        if (
          window.__mgFloatLayout &&
          window.__mgFloatLayout.apply &&
          !isEmbedded() &&
          floatAllowed
        )
          window.__mgFloatLayout.apply();
      } catch (eA) {}
    } else {
      if (strip) {
        strip.classList.add("hidden");
        if (!isEmbedded()) {
          strip.classList.add("mg-product-ghost");
          strip.classList.remove("mg-popout");
        }
      }
      if (!opts.keepFloat) floatAllowed = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (paintTimer) {
        cancelAnimationFrame(paintTimer);
        paintTimer = 0;
      }
    }
  }

  function popOut() {
    floatAllowed = true;
    if (strip && isEmbedded()) {
      try {
        unembed();
      } catch (eU) {}
    }
    setOpen(true, { popOut: true, forceFloat: true });
    log(VER + " · pop-out float on canvas");
    return true;
  }

  function dockIn() {
    floatAllowed = false;
    setOpen(false);
    if (strip) {
      strip.classList.add("hidden");
      strip.classList.add("mg-product-ghost");
      strip.classList.remove("mg-popout");
    }
    /* Beats home is Staff (maze/gsplat took the old Keys slot) */
    try {
      if (window.__mgToolsDrawer) {
        if (window.__mgToolsDrawer.setMode) window.__mgToolsDrawer.setMode("staff");
        if (window.__mgToolsDrawer.open) window.__mgToolsDrawer.open();
      }
    } catch (eD) {}
    return true;
  }

  window.addEventListener("resize", function () {
    if (open) requestPaint(true);
  });

  function clearCataloguePlay() {
    for (var i = 0; i < playTimers.length; i++) {
      try {
        clearTimeout(playTimers[i]);
      } catch (e) {}
    }
    playTimers = [];
  }

  function entryMidis(entry) {
    if (!entry) return [];
    if (entry.midi && entry.midi.length) return entry.midi.slice();
    var tonic = entry.tonicMidi != null ? entry.tonicMidi : 60;
    var deg = entry.degrees || [];
    var midis = [];
    for (var i = 0; i < deg.length; i++) midis.push(tonic + deg[i]);
    return midis;
  }

  /** Transpose a catalogue entry by semitones (scholarly / rehearsal tool). */
  function transposeEntry(entry, semitones) {
    if (!entry) return null;
    var st = parseInt(semitones, 10) || 0;
    var midis = entryMidis(entry).map(function (m) {
      return Math.max(0, Math.min(127, Math.round(m) + st));
    });
    var out = {};
    for (var k in entry) {
      if (Object.prototype.hasOwnProperty.call(entry, k)) out[k] = entry[k];
    }
    out.midi = midis;
    if (entry.tonicMidi != null) out.tonicMidi = entry.tonicMidi + st;
    out._transpose = st;
    out._origId = entry.id || null;
    out.title =
      (entry.title || entry.id || "entry") +
      (st ? " · T" + (st > 0 ? "+" : "") + st : "");
    return out;
  }

  /**
   * Load a KBatch staff-catalogue entry onto live staff + piano.
   * entry: full kbatch-music-staff entry or { midi, degrees, tonicMidi, bpm, title, id }
   * opts: { clear, bpm, play (audio), sequential (timed), silent (no blip on dump) }
   */
  function loadCatalogue(entry, opts) {
    opts = opts || {};
    if (!entry) return { ok: false, reason: "no entry" };
    clearCataloguePlay();
    var midis = entryMidis(entry);
    if (!midis.length) return { ok: false, reason: "no midi", id: entry.id || null };

    if (opts.clear !== false) beats = [];
    if (entry.bpm > 30 && entry.bpm < 240) bpm = entry.bpm;
    else if (opts.bpm > 30 && opts.bpm < 240) bpm = opts.bpm;

    lastCatEntry = {
      id: entry.id || null,
      title: entry.title || entry.id || "catalogue",
      kind: entry.kind || "",
      family: entry.family || "",
      solfege: entry.solfege || "",
      modern: entry.modern || "",
      rights: entry.rights || "",
      bpm: bpm,
      notes: midis.length,
    };
    window.__mgStaffLastEntry = lastCatEntry;

    /* stay in drawer if embedded; never auto-float catalogue onto canvas */
    if (isEmbedded()) {
      open = true;
      if (strip) strip.classList.remove("hidden");
    } else if (floatAllowed) {
      setOpen(true, { forceFloat: true });
    } else {
      open = true; /* logical open for paint if UI exists */
      ensureUi();
      if (strip && !isEmbedded()) {
        strip.classList.add("hidden");
        strip.classList.add("mg-product-ghost");
      }
    }
    var pack = entry.id || entry.title || "catalogue";
    var durs = entry.durations || [];
    var sequential = opts.sequential !== false && midis.length > 1;
    var playAudio = opts.play !== false;
    var n = 0;

    /* dump all notes onto staff immediately for notation readout */
    for (var j = 0; j < midis.length; j++) {
      beats.push({
        t: Date.now() + j,
        midi: Math.round(midis[j]),
        name: midiName(midis[j]),
        hit: true,
        src: "staff-catalogue",
        ch: entry.solfege ? String(entry.solfege).split(/\s+/)[j] || "" : "",
        pack: pack,
        bpm: bpm,
      });
      n++;
    }
    if (beats.length > 96) beats = beats.slice(-96);

    /* light full chord/scale on piano once */
    for (var k = 0; k < midis.length; k++) lightPiano(midis[k], sequential ? 180 : 420);

    /* sequential audio playback (motifs / scales) — durations are beat units */
    if (playAudio) {
      var beatMs = 60000 / Math.max(40, bpm);
      if (sequential) {
        var t = 0;
        for (var p = 0; p < midis.length; p++) {
          (function (midi, delay) {
            playTimers.push(
              setTimeout(function () {
                blip(midi);
                lightPiano(midi, 280);
                requestPaint(true);
              }, delay)
            );
          })(Math.round(midis[p]), t);
          var d = durs[p] != null && isFinite(durs[p]) ? Number(durs[p]) : 1;
          t += Math.max(0.25, d) * beatMs;
        }
      } else {
        /* chord-like: arpeggiate lightly or stack */
        for (var q = 0; q < midis.length; q++) {
          (function (midi, delay) {
            playTimers.push(
              setTimeout(function () {
                blip(midi);
                lightPiano(midi, 360);
              }, delay)
            );
          })(Math.round(midis[q]), q * 55);
        }
      }
    }

    requestPaint(true);
    log(
      VER +
        " · staff cat " +
        (entry.id || entry.title || "") +
        " notes=" +
        n +
        " kind=" +
        (entry.kind || "—")
    );
    return {
      ok: true,
      notes: n,
      id: entry.id || null,
      title: entry.title || null,
      kind: entry.kind || null,
      bpm: bpm,
    };
  }

  var catalogueLoading = false;

  /** Fetch full KBatch staff pack (live first, then bundled seed). */
  function loadCatalogueSeed(cb) {
    if (window.__mgStaffCatalogueSeed && (window.__mgStaffCatalogueSeed.entries || []).length) {
      if (cb)
        cb({
          ok: true,
          count: window.__mgStaffCatalogueSeed.entries.length,
          source: "cache",
        });
      return;
    }
    if (catalogueLoading) {
      var wait = setInterval(function () {
        if (!catalogueLoading) {
          clearInterval(wait);
          if (cb)
            cb({
              ok: !!(window.__mgStaffCatalogueSeed && window.__mgStaffCatalogueSeed.entries),
              count: (window.__mgStaffCatalogueSeed && window.__mgStaffCatalogueSeed.entries
                ? window.__mgStaffCatalogueSeed.entries.length
                : 0),
              source: "wait",
            });
        }
      }, 80);
      return;
    }
    catalogueLoading = true;
    var paths = [
      "https://kbatch.ugrad.ai/data/music-staff/entries.json",
      "hotpipe/data/staff-catalogue-seed.json",
      "../hotpipe/data/staff-catalogue-seed.json",
      "./data/staff-catalogue-seed.json",
    ];
    var i = 0;
    function next() {
      if (i >= paths.length) {
        catalogueLoading = false;
        if (cb) cb({ ok: false, reason: "seed not found" });
        return;
      }
      var url = paths[i++];
      fetch(url)
        .then(function (r) {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        })
        .then(function (j) {
          if (!j.entries && j.schema) {
            /* some packs nest differently */
          }
          window.__mgStaffCatalogueSeed = j;
          catalogueLoading = false;
          log(VER + " · staff cat seed " + (j.entries || []).length + " · " + url);
          if (cb) cb({ ok: true, count: (j.entries || []).length, source: url });
        })
        .catch(function () {
          next();
        });
    }
    next();
  }

  function cataloguePack() {
    return window.__mgStaffCatalogueSeed || null;
  }

  function listCatalogue(filter) {
    filter = filter || {};
    var pack = cataloguePack();
    var entries = (pack && pack.entries) || [];
    var kind = filter.kind || filter.family || "";
    var q = String(filter.q || filter.query || "")
      .toLowerCase()
      .trim();
    var out = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (kind) {
        var k = String(kind).toLowerCase();
        if (
          String(e.kind || "").toLowerCase() !== k &&
          String(e.family || "").toLowerCase() !== k &&
          String(e.family || "").toLowerCase().indexOf(k) < 0
        )
          continue;
      }
      if (q) {
        var hay = (
          (e.id || "") +
          " " +
          (e.title || "") +
          " " +
          (e.kind || "") +
          " " +
          (e.solfege || "") +
          " " +
          (e.tags || []).join(" ")
        ).toLowerCase();
        if (hay.indexOf(q) < 0) continue;
      }
      out.push(e);
    }
    if (filter.limit > 0 && out.length > filter.limit) out = out.slice(0, filter.limit);
    return out;
  }

  function getCatalogueEntry(id) {
    if (!id) return null;
    var entries = (cataloguePack() && cataloguePack().entries) || [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === id) return entries[i];
    }
    return null;
  }

  function catalogueKinds() {
    var pack = cataloguePack();
    if (pack && pack.kinds) return pack.kinds;
    var counts = {};
    var entries = (pack && pack.entries) || [];
    for (var i = 0; i < entries.length; i++) {
      var k = entries[i].kind || "other";
      counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
  }

  function loadCatalogueId(id, cb, opts) {
    function tryLoad(pack) {
      var entries = (pack && pack.entries) || [];
      var hit = null;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].id === id) {
          hit = entries[i];
          break;
        }
      }
      if (!hit) {
        var r0 = { ok: false, reason: "id not in catalogue: " + id };
        if (cb) cb(r0);
        return r0;
      }
      var r = loadCatalogue(hit, opts || {});
      if (cb) cb(r);
      return r;
    }
    if (window.__mgStaffCatalogueSeed) return tryLoad(window.__mgStaffCatalogueSeed);
    loadCatalogueSeed(function (st) {
      if (!st.ok) {
        if (cb) cb(st);
        return;
      }
      tryLoad(window.__mgStaffCatalogueSeed);
    });
    return { ok: true, pending: true, id: id };
  }

  /* warm cache on load */
  setTimeout(function () {
    try {
      loadCatalogueSeed(function () {});
    } catch (eW) {}
  }, 900);

  function unembed() {
    if (!strip || !strip.classList.contains("mg-embedded")) return;
    strip.classList.remove("mg-embedded");
    strip.style.position = "";
    strip.style.width = "";
    strip.style.maxHeight = "";
    strip.style.minHeight = "";
    strip.style.margin = "";
    (document.body || document.documentElement).appendChild(strip);
    /* leave canvas unless user had pop-out */
    if (!floatAllowed) {
      open = false;
      strip.classList.add("hidden");
      strip.classList.add("mg-product-ghost");
      strip.classList.remove("mg-popout");
    } else {
      strip.classList.remove("hidden");
      strip.classList.add("mg-popout");
    }
  }

  function embedInto(host) {
    if (!host) return false;
    ensureUi();
    if (!strip) return false;
    host.appendChild(strip);
    strip.classList.add("mg-embedded");
    strip.classList.remove("hidden");
    strip.classList.remove("mg-product-ghost");
    strip.classList.remove("mg-popout");
    open = true;
    /* embed is not a canvas float */
    floatAllowed = false;
    hookKb();
    requestPaint(true);
    return true;
  }

  window.__mgKeyboardBeats = {
    ver: VER,
    onKey: onKey,
    ingestNote: ingestNote,
    embedInto: embedInto,
    unembed: unembed,
    popOut: popOut,
    dockIn: dockIn,
    isPopOut: function () {
      return !!floatAllowed && !isEmbedded();
    },
    requestPaint: requestPaint,
    /** maze rain / path drops call this */
    onMazeNote: function (midi, meta) {
      meta = meta || {};
      meta.src = meta.src || "maze";
      return ingestNote(midi, meta);
    },
    /** KBatch staff catalogue → live staff + piano (music twin of word dictionary) */
    loadCatalogue: loadCatalogue,
    loadCatalogueSeed: loadCatalogueSeed,
    loadCatalogueId: loadCatalogueId,
    listCatalogue: listCatalogue,
    getCatalogueEntry: getCatalogueEntry,
    catalogueKinds: catalogueKinds,
    cataloguePack: cataloguePack,
    lastCatalogueEntry: function () {
      return lastCatEntry;
    },
    stopCataloguePlay: clearCataloguePlay,
    transposeEntry: transposeEntry,
    entryMidis: entryMidis,
    /** Quick PD motif / scale helpers */
    playOdeJoy: function (cb) {
      return loadCatalogueId("motif-ode-joy", cb);
    },
    playIonian: function (cb) {
      return loadCatalogueId("scale-c-ionian", cb);
    },
    playBlues: function (cb) {
      return loadCatalogueId("scale-c-blues", cb);
    },
    open: function (opts) {
      /* open() without popOut does not put beats on center canvas */
      setOpen(true, opts || {});
    },
    close: function () {
      setOpen(false);
    },
    toggle: function () {
      if (open && (isEmbedded() || floatAllowed)) setOpen(false);
      else popOut();
    },
    isOpen: function () {
      return open && (isEmbedded() || floatAllowed);
    },
    bpm: function () {
      return bpm;
    },
    setBpm: function (b) {
      if (b > 30 && b < 240) bpm = b;
    },
    attempts: function () {
      return attempts;
    },
    hits: function () {
      return hits;
    },
    beats: beats,
    clear: function () {
      beats = [];
      paint();
    },
    report: function () {
      return (
        VER +
        " bpm=" +
        bpm +
        " notes=" +
        beats.length +
        " att=" +
        attempts +
        " hit=" +
        hits +
        (open ? " staff+piano" : "") +
        (lastCatEntry ? " cat=" + (lastCatEntry.id || lastCatEntry.title) : "") +
        " pack=" +
        ((cataloguePack() && cataloguePack().entries && cataloguePack().entries.length) || 0)
      );
    },
  };
  log(VER + " · maze staff + piano + staff catalogue");
})();
