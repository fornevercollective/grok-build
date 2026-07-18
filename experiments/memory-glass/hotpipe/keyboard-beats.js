/* Memory Glass · beats + staff + piano for memory-maze notation
 * Maze rain / path / keys → live treble staff + piano strip (piano-buddy / qbpm).
 * VER: keyboard-beats-v4-maze-notation
 */
(function () {
  "use strict";
  var VER = "keyboard-beats-v5-match-stack";
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
      "#mg-kb-beats .hd{display:flex;justify-content:space-between;align-items:center;",
      "  padding:6px 10px;letter-spacing:0.1em;text-transform:uppercase;",
      "  border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(160,210,255,0.9);",
      "  font:650 10px/1.2 system-ui;flex-shrink:0}",
      "#mg-kb-beats .hd button{appearance:none;background:transparent;border:0;color:inherit;",
      "  cursor:pointer;font:700 12px/1 system-ui;padding:2px 6px}",
      "#mg-kb-beats .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;",
      "  padding:6px 10px;flex-shrink:0}",
      "#mg-kb-beats b{color:rgba(160,210,255,0.95)}",
      "#mg-kb-beats .bar{flex:1;min-width:80px;height:7px;border-radius:4px;",
      "  background:rgba(255,255,255,0.08);overflow:hidden}",
      "#mg-kb-beats .bar i{display:block;height:100%;background:linear-gradient(90deg,",
      "  #50e6a0,#a0c8ff,#ffb060,#f070d0,#70e0ff);width:0%;transition:width .12s}",
      "#mg-kb-beats .staff-wrap{padding:0 8px;flex:1 1 auto;min-height:88px;",
      "  display:flex;flex-direction:column;gap:4px}",
      "#mg-kb-beats canvas.staff{width:100%;height:96px;display:block;border-radius:8px;",
      "  background:rgba(4,8,14,0.9);border:1px solid rgba(255,255,255,0.12);",
      "  flex:1 1 auto;min-height:80px}",
      "#mg-kb-beats canvas.piano{width:100%;height:52px;display:block;border-radius:8px;",
      "  background:rgba(8,10,14,0.95);border:1px solid rgba(255,255,255,0.12);",
      "  flex-shrink:0;cursor:pointer}",
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
    strip.className = open ? "" : "hidden";
    strip.innerHTML =
      '<div class="hd"><span>Beats · maze staff · piano</span>' +
      '<span style="display:flex;gap:4px;align-items:center">' +
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

    /* time / maze pack tag */
    var packId = "—";
    try {
      if (window.__mgMemoryMaze && window.__mgMemoryMaze.packs) {
        var rep = window.__mgMemoryMaze.report && window.__mgMemoryMaze.report();
        if (rep && /pack=([\w-]+)/.test(rep)) packId = RegExp.$1;
      }
    } catch (eP) {}
    ctx.fillStyle = "rgba(140,180,200,0.7)";
    ctx.font = "600 8px ui-monospace,Menlo,monospace";
    ctx.fillText(bpm + "♩ · maze " + packId, left, H - 4);

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

    if (open) paint();
    return { midi: midi, name: midiName(midi), src: src };
  }

  function onKey(ch, nx, ny) {
    ensureUi();
    var now = Date.now();
    ch = String(ch || "").toLowerCase();
    keys.push({ ch: ch, t: now, nx: nx || 0.5, ny: ny || 0.5 });
    if (keys.length > 64) keys.shift();
    attempts++;

    var midi = NOTE_MAP[ch];
    /* prefer maze pack mapping when maze open */
    try {
      if (window.__mgMemoryMaze && window.__mgMemoryMaze.isOpen && window.__mgMemoryMaze.isOpen()) {
        /* maze ingestKey will map — use scale-aligned if possible */
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
    if (hit) hits++;
    if (now - lastBeatT > interval * 0.5) lastBeatT = now;

    if (keys.length >= 4) {
      var dt = keys[keys.length - 1].t - keys[keys.length - 4].t;
      if (dt > 80) {
        var est = Math.round((3 * 60000) / dt);
        bpm = Math.max(48, Math.min(180, Math.round(bpm * 0.85 + est * 0.15)));
      }
    }

    ingestNote(midi, { src: "key", hit: hit, ch: ch });

    try {
      if (window.__mgMemoryMaze && window.__mgMemoryMaze.ingestKey)
        window.__mgMemoryMaze.ingestKey(ch, nx || 0.5, ny || 0.5);
    } catch (e) {}
    try {
      if (window.__mgBlochSolve && window.__mgBlochSolve.onKeyHop)
        window.__mgBlochSolve.onKeyHop(ch);
    } catch (e2) {}
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

    paint();
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

  function loop() {
    if (!open) {
      raf = 0;
      return;
    }
    paint();
    raf = requestAnimationFrame(loop);
  }

  function hookKb() {
    var K = window.__mgFloatKb;
    if (!K || K._beatsHooked) return;
    K._beatsHooked = true;
    document.addEventListener(
      "click",
      function (ev) {
        var t = ev.target;
        if (!t || !t.classList || !t.classList.contains("kb-key")) return;
        var ch = (t.textContent || "").trim().toLowerCase();
        if (ch === "space" || ch === "spc") ch = " ";
        if (ch.length > 2) return;
        var r = t.getBoundingClientRect();
        var pr = document.getElementById("mg-float-kb");
        var nx = 0.5,
          ny = 0.5;
        if (pr) {
          var b = pr.getBoundingClientRect();
          nx = (r.left + r.width / 2 - b.left) / Math.max(1, b.width);
          ny = (r.top + r.height / 2 - b.top) / Math.max(1, b.height);
        }
        onKey(ch === " " ? "g" : ch, nx, ny);
      },
      true
    );
    log(VER + " · keyboard + piano hooked");
  }

  setTimeout(hookKb, 500);
  setTimeout(hookKb, 1500);

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

  function setOpen(on) {
    open = !!on;
    if (open) {
      ensureUi();
      strip.classList.remove("hidden");
      paint();
      if (!raf) raf = requestAnimationFrame(loop);
      try {
        if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
          window.__mgFloatLayout.apply();
      } catch (eA) {}
    } else {
      if (strip) strip.classList.add("hidden");
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }
  }

  window.addEventListener("resize", function () {
    if (open) paint();
  });

  window.__mgKeyboardBeats = {
    ver: VER,
    onKey: onKey,
    ingestNote: ingestNote,
    /** maze rain / path drops call this */
    onMazeNote: function (midi, meta) {
      meta = meta || {};
      meta.src = meta.src || "maze";
      return ingestNote(midi, meta);
    },
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: function () {
      setOpen(!open);
    },
    isOpen: function () {
      return open;
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
        (open ? " staff+piano" : "")
      );
    },
  };
  log(VER + " · maze staff + piano notation");
})();
