/* Memory Glass · acoustic-scope
 * FFT spectrum · band isolation · speech VAD · RGB parade · 3d acoustic maze
 * Replaces / upgrades #mg-wave (live.js rock waveform rail).
 * VER: acoustic-scope-v1
 *
 * Honesty: simple energy/centroid VAD ≠ full ASR · lab BPS ≠ ARC %.
 */
(function () {
  "use strict";
  var VER = "acoustic-scope-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._acousticScopeVer === VER && window.__mgAcousticScope) {
    try {
      if (window.__mgAcousticScope.kick) window.__mgAcousticScope.kick();
    } catch (e0) {}
    return;
  }
  HP._acousticScopeVer = VER;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "acoustic");
    } catch (e) {}
  }

  /* ── ISO bands (Hz) ── */
  var BANDS = [
    { id: "sub", label: "SUB", lo: 20, hi: 80, hue: 210 },
    { id: "bass", label: "BASS", lo: 80, hi: 250, hue: 185 },
    { id: "mid", label: "MID", lo: 250, hi: 2000, hue: 130 },
    { id: "voice", label: "VOICE", lo: 300, hi: 3400, hue: 320 },
    { id: "air", label: "AIR", lo: 4000, hi: 16000, hue: 45 },
  ];

  var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  function hzToNote(hz) {
    if (!hz || hz < 20) return "—";
    var n = 12 * (Math.log(hz / 440) / Math.LN2) + 69;
    if (!isFinite(n)) return "—";
    var midi = Math.round(n);
    var name = NOTE_NAMES[((midi % 12) + 12) % 12];
    var oct = Math.floor(midi / 12) - 1;
    return name + oct;
  }

  function binToHz(bin, sr, fft) {
    return (bin * sr) / fft;
  }

  function hzToBin(hz, sr, fft) {
    return Math.max(0, Math.min(fft / 2 - 1, Math.round((hz * fft) / sr)));
  }

  function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }

  /* ── state ── */
  var box = null;
  var cvs = { parade: null, spec: null, maze: null, L: null, R: null, M: null };
  var els = { src: null, speech: null, peaks: null, iso: null };
  var ACTX = window.AudioContext || window.webkitAudioContext;
  var ctx = null;
  var analysers = { L: null, R: null, M: null };
  var freqData = { L: null, R: null, M: null };
  var timeData = { L: null, R: null, M: null };
  var micStream = null;
  var phoneAudio = null;
  var phoneSrc = null;
  var lastPhoneStamp = "";
  var raf = 0;
  var srcLabel = "idle";
  var bandOn = { sub: true, bass: true, mid: true, voice: true, air: true };
  var soloBand = null; /* id or null */
  var speechState = { mode: "silence", conf: 0, pitch: 0, centroid: 0, voiceRatio: 0 };
  var peaks = [];
  var mazePts = [];
  var mazeYaw = 0.35;
  var mazePitch = 0.18;
  var mazeSpin = true;
  var remoteLevels = null;
  var remoteAge = 999;
  var paradeScratch = null;
  var paradeCtx2d = null;
  var lastParadeT = 0;
  var fftSize = 2048;
  var showParade = true;
  var showMaze = true;
  var showWave = true;

  function setSrc(lab, okOn) {
    srcLabel = lab || "idle";
    if (els.src) {
      els.src.textContent = srcLabel;
      els.src.classList.toggle("off", !okOn);
    }
  }

  function ensureCss() {
    if (document.getElementById("mg-acoustic-css")) return;
    var st = document.createElement("style");
    st.id = "mg-acoustic-css";
    st.textContent = [
      "#mg-feed-row{order:1!important;display:flex!important;flex-direction:row!important;gap:8px!important;",
      "  width:100%!important;align-items:stretch!important;flex-shrink:0!important}",
      "#mg-feed-row #pip-wrap{flex:1 1 auto!important;order:0!important;width:auto!important;min-width:0!important;",
      "  max-height:48vh!important;aspect-ratio:16/10!important}",
      "#mg-wave.mg-acoustic{order:0!important;display:flex!important;flex-direction:column!important;gap:4px!important;",
      "  width:min(280px,42%)!important;min-width:200px!important;flex:0 0 min(280px,42%)!important;",
      "  padding:8px 7px!important;margin:0!important;box-sizing:border-box!important;",
      "  border:1px solid rgba(120,200,255,0.32)!important;border-radius:12px!important;",
      "  background:linear-gradient(165deg,rgba(6,10,18,0.97),rgba(4,6,12,0.98) 55%,rgba(8,4,14,0.96))!important;",
      "  box-shadow:0 0 0 1px rgba(80,200,255,0.1),0 10px 32px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.06)!important;",
      "  position:relative!important;overflow:hidden!important}",
      "#mg-wave .wave-hd{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:4px 8px!important;",
      "  padding:0 2px 3px!important;font:750 8px/1.15 ui-monospace,Menlo,monospace!important;",
      "  letter-spacing:0.12em!important;text-transform:uppercase!important;color:rgba(180,220,255,0.92)!important}",
      "#mg-wave .wave-hd .brand{color:rgba(120,220,255,0.98)!important;font-weight:800;letter-spacing:0.14em}",
      "#mg-wave .wave-hd .src{color:rgba(120,230,180,0.9)!important;font-weight:600;letter-spacing:0.06em;font-size:7px}",
      "#mg-wave .wave-hd .src.off{color:rgba(255,150,120,0.85)!important}",
      "#mg-wave .wave-hd .speech{margin-left:auto;padding:2px 6px;border-radius:999px;font-size:7px;letter-spacing:0.1em;",
      "  border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.35)}",
      "#mg-wave .wave-hd .speech.speech{color:#ff9ee0;border-color:rgba(255,120,200,0.45);box-shadow:0 0 12px rgba(255,100,200,0.25)}",
      "#mg-wave .wave-hd .speech.silence{color:rgba(160,180,200,0.7)}",
      "#mg-wave .wave-hd .speech.music{color:#7aebb0;border-color:rgba(100,220,160,0.4)}",
      "#mg-wave .wave-hd .speech.noise{color:#ffc070;border-color:rgba(255,180,80,0.4)}",
      "#mg-wave .stack{position:relative!important;flex:1 1 auto!important;min-height:110px!important;",
      "  border-radius:8px!important;overflow:hidden!important;border:1px solid rgba(255,255,255,0.07)!important;",
      "  background:#04060a!important}",
      "#mg-wave .stack canvas{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:block!important}",
      "#mg-wave .stack #mg-wave-parade{opacity:0.55;z-index:1}",
      "#mg-wave .stack #mg-wave-spec{z-index:2}",
      "#mg-wave .stack #mg-wave-maze{z-index:3;opacity:0.92;pointer-events:none}",
      "#mg-wave .iso{display:flex!important;flex-wrap:wrap!important;gap:3px!important;padding:2px 0 0!important}",
      "#mg-wave .iso button{appearance:none;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);",
      "  color:rgba(200,220,240,0.75);font:700 7px/1 ui-monospace,Menlo,monospace;letter-spacing:0.08em;",
      "  padding:3px 5px;border-radius:5px;cursor:pointer}",
      "#mg-wave .iso button.on{color:#041018;background:linear-gradient(180deg,hsla(var(--h,200),85%,70%,0.95),hsla(var(--h,200),70%,50%,0.9));",
      "  border-color:hsla(var(--h,200),80%,60%,0.8);box-shadow:0 0 10px hsla(var(--h,200),90%,55%,0.35)}",
      "#mg-wave .iso button.solo{outline:1px solid rgba(255,255,255,0.55)}",
      "#mg-wave .iso button.dim{opacity:0.35}",
      "#mg-wave .iso button.tool{color:rgba(160,210,255,0.9);border-style:dashed}",
      "#mg-wave .peaks{font:600 7px/1.3 ui-monospace,Menlo,monospace;color:rgba(200,230,255,0.85);",
      "  letter-spacing:0.04em;min-height:1.3em;padding:1px 2px}",
      "#mg-wave .meta{font:600 7px/1.25 ui-monospace,Menlo,monospace;color:rgba(150,190,220,0.8);",
      "  letter-spacing:0.05em;padding:0 2px}",
      "#mg-wave .lanes{display:grid!important;grid-template-columns:1fr!important;gap:3px!important}",
      "#mg-wave .lane{display:grid!important;grid-template-columns:14px 1fr 28px!important;gap:3px!important;",
      "  align-items:center!important;min-height:0!important}",
      "#mg-wave .lane .ch{font:800 9px/1 ui-monospace,Menlo,monospace!important;text-align:center!important}",
      "#mg-wave .lane.L .ch{color:#6ec8ff;text-shadow:0 0 8px rgba(110,200,255,0.5)}",
      "#mg-wave .lane.R .ch{color:#ff7ad9;text-shadow:0 0 8px rgba(255,122,217,0.45)}",
      "#mg-wave .lane.M .ch{color:#7aebb0;text-shadow:0 0 8px rgba(122,235,176,0.4)}",
      "#mg-wave .lane canvas{width:100%!important;height:28px!important;display:block!important;",
      "  border-radius:4px!important;background:rgba(0,0,0,0.4)!important;border:1px solid rgba(255,255,255,0.05)!important;",
      "  position:static!important}",
      "#mg-wave .lane .db{font:700 7px/1 ui-monospace,Menlo,monospace;color:rgba(180,200,220,0.75);text-align:right}",
      "#mg-tri{order:3!important}",
      "#cf{order:4!important}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function ensureShell() {
    ensureCss();
    var stage = document.getElementById("stage");
    var wrap = document.getElementById("pip-wrap");
    if (!stage || !wrap) return null;

    var row = document.getElementById("mg-feed-row");
    if (!row) {
      row = document.createElement("div");
      row.id = "mg-feed-row";
      if (wrap.parentNode) {
        wrap.parentNode.insertBefore(row, wrap);
        row.appendChild(wrap);
      } else {
        stage.appendChild(row);
        row.appendChild(wrap);
      }
    }

    var old = document.getElementById("mg-wave");
    if (old && old.parentNode) {
      try {
        old.parentNode.removeChild(old);
      } catch (eO) {}
    }

    box = document.createElement("div");
    box.id = "mg-wave";
    box.className = "mg-acoustic";
    box.innerHTML =
      '<div class="wave-hd">' +
      '<span class="brand">ACOUSTIC · SCOPE</span>' +
      '<span class="src off" id="mg-wave-src">idle</span>' +
      '<span class="speech silence" id="mg-wave-speech">SILENCE</span>' +
      "</div>" +
      '<div class="stack" id="mg-wave-stack">' +
      '<canvas id="mg-wave-parade" width="320" height="160"></canvas>' +
      '<canvas id="mg-wave-spec" width="320" height="160"></canvas>' +
      '<canvas id="mg-wave-maze" width="320" height="160"></canvas>' +
      "</div>" +
      '<div class="iso" id="mg-wave-iso"></div>' +
      '<div class="peaks" id="mg-wave-peaks">peaks —</div>' +
      '<div class="meta" id="mg-wave-meta">centroid — · pitch —</div>' +
      '<div class="lanes">' +
      '<div class="lane L"><span class="ch">L</span><canvas id="mg-wave-L" width="240" height="36"></canvas><span class="db" id="mg-wave-db-L">—</span></div>' +
      '<div class="lane R"><span class="ch">R</span><canvas id="mg-wave-R" width="240" height="36"></canvas><span class="db" id="mg-wave-db-R">—</span></div>' +
      '<div class="lane M"><span class="ch">M</span><canvas id="mg-wave-M" width="240" height="36"></canvas><span class="db" id="mg-wave-db-M">—</span></div>' +
      "</div>";
    row.appendChild(box);

    cvs.parade = document.getElementById("mg-wave-parade");
    cvs.spec = document.getElementById("mg-wave-spec");
    cvs.maze = document.getElementById("mg-wave-maze");
    cvs.L = document.getElementById("mg-wave-L");
    cvs.R = document.getElementById("mg-wave-R");
    cvs.M = document.getElementById("mg-wave-M");
    els.src = document.getElementById("mg-wave-src");
    els.speech = document.getElementById("mg-wave-speech");
    els.peaks = document.getElementById("mg-wave-peaks");
    els.meta = document.getElementById("mg-wave-meta");
    els.iso = document.getElementById("mg-wave-iso");
    els.db = {
      L: document.getElementById("mg-wave-db-L"),
      R: document.getElementById("mg-wave-db-R"),
      M: document.getElementById("mg-wave-db-M"),
    };

    buildIsoControls();
    return box;
  }

  function buildIsoControls() {
    if (!els.iso) return;
    els.iso.innerHTML = "";
    BANDS.forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = b.label;
      btn.dataset.band = b.id;
      btn.style.setProperty("--h", String(b.hue));
      btn.className = bandOn[b.id] ? "on" : "dim";
      btn.title = b.lo + "–" + b.hi + " Hz · click isolate · dblclick solo";
      btn.onclick = function (ev) {
        if (ev.shiftKey || soloBand === b.id) {
          soloBand = soloBand === b.id ? null : b.id;
        } else {
          bandOn[b.id] = !bandOn[b.id];
          if (soloBand === b.id && !bandOn[b.id]) soloBand = null;
        }
        refreshIsoUi();
      };
      btn.ondblclick = function (ev) {
        ev.preventDefault();
        soloBand = soloBand === b.id ? null : b.id;
        if (soloBand) {
          Object.keys(bandOn).forEach(function (k) {
            bandOn[k] = k === soloBand;
          });
        } else {
          Object.keys(bandOn).forEach(function (k) {
            bandOn[k] = true;
          });
        }
        refreshIsoUi();
      };
      els.iso.appendChild(btn);
    });
    function tool(label, title, fn) {
      var t = document.createElement("button");
      t.type = "button";
      t.className = "tool";
      t.textContent = label;
      t.title = title;
      t.onclick = fn;
      els.iso.appendChild(t);
      return t;
    }
    tool("ALL", "Enable all bands", function () {
      soloBand = null;
      Object.keys(bandOn).forEach(function (k) {
        bandOn[k] = true;
      });
      refreshIsoUi();
    });
    tool("VOICE+", "Speech isolation · VOICE only", function () {
      soloBand = "voice";
      Object.keys(bandOn).forEach(function (k) {
        bandOn[k] = k === "voice";
      });
      refreshIsoUi();
    });
    tool("RGB", "Toggle RGB parade behind", function () {
      showParade = !showParade;
      if (cvs.parade) cvs.parade.style.opacity = showParade ? "0.55" : "0";
    });
    tool("3D", "Toggle acoustic maze", function () {
      showMaze = !showMaze;
      if (cvs.maze) cvs.maze.style.opacity = showMaze ? "0.92" : "0";
    });
    tool("SPIN", "Toggle maze spin", function () {
      mazeSpin = !mazeSpin;
    });
  }

  function refreshIsoUi() {
    if (!els.iso) return;
    Array.prototype.forEach.call(els.iso.querySelectorAll("[data-band]"), function (btn) {
      var id = btn.dataset.band;
      var on = !!bandOn[id];
      var active = soloBand ? id === soloBand : on;
      btn.classList.toggle("on", active);
      btn.classList.toggle("dim", !active);
      btn.classList.toggle("solo", soloBand === id);
    });
  }

  function bandEnabled(id) {
    if (soloBand) return id === soloBand;
    return !!bandOn[id];
  }

  function hzAllowed(hz) {
    for (var i = 0; i < BANDS.length; i++) {
      var b = BANDS[i];
      if (hz >= b.lo && hz <= b.hi && bandEnabled(b.id)) return true;
    }
    /* outside named bands still ok if mid-ish and mid on */
    if (hz > 80 && hz < 4000 && bandEnabled("mid")) return true;
    return false;
  }

  function ensureCtx() {
    if (!ACTX) return null;
    if (!ctx) {
      try {
        ctx = new ACTX();
      } catch (e) {
        return null;
      }
    }
    if (ctx.state === "suspended") {
      try {
        ctx.resume();
      } catch (e2) {}
    }
    return ctx;
  }

  function makeAnalyser() {
    var a = ctx.createAnalyser();
    a.fftSize = fftSize;
    a.smoothingTimeConstant = 0.68;
    a.minDecibels = -92;
    a.maxDecibels = -12;
    return a;
  }

  function wireGraph(sourceNode, label) {
    if (!ctx || !sourceNode) return false;
    try {
      analysers.L = makeAnalyser();
      analysers.R = makeAnalyser();
      analysers.M = makeAnalyser();
      freqData.L = new Uint8Array(analysers.L.frequencyBinCount);
      freqData.R = new Uint8Array(analysers.R.frequencyBinCount);
      freqData.M = new Uint8Array(analysers.M.frequencyBinCount);
      timeData.L = new Uint8Array(analysers.L.fftSize);
      timeData.R = new Uint8Array(analysers.R.fftSize);
      timeData.M = new Uint8Array(analysers.M.fftSize);

      var splitter = null;
      try {
        splitter = ctx.createChannelSplitter(2);
        sourceNode.connect(splitter);
        splitter.connect(analysers.L, 0);
        splitter.connect(analysers.R, 1);
      } catch (eSp) {
        sourceNode.connect(analysers.L);
        sourceNode.connect(analysers.R);
      }
      try {
        var gL = ctx.createGain();
        var gR = ctx.createGain();
        gL.gain.value = 0.5;
        gR.gain.value = 0.5;
        if (splitter) {
          splitter.connect(gL, 0);
          splitter.connect(gR, 1);
        } else {
          sourceNode.connect(gL);
          sourceNode.connect(gR);
        }
        gL.connect(analysers.M);
        gR.connect(analysers.M);
      } catch (eM) {
        sourceNode.connect(analysers.M);
      }
      var mute = ctx.createGain();
      mute.gain.value = 0;
      analysers.M.connect(mute);
      mute.connect(ctx.destination);
      setSrc(label || "live", true);
      return true;
    } catch (eW) {
      setSrc("wire fail", false);
      return false;
    }
  }

  function rmsDb(arr) {
    if (!arr || !arr.length) return -90;
    var s = 0;
    for (var i = 0; i < arr.length; i++) {
      var v = (arr[i] - 128) / 128;
      s += v * v;
    }
    var rms = Math.sqrt(s / arr.length);
    if (rms < 1e-6) return -90;
    return 20 * Math.log10(rms);
  }

  function zeroCrossRate(td) {
    if (!td || td.length < 4) return 0;
    var z = 0;
    var prev = td[0] - 128;
    for (var i = 1; i < td.length; i += 2) {
      var cur = td[i] - 128;
      if ((prev >= 0 && cur < 0) || (prev < 0 && cur >= 0)) z++;
      prev = cur;
    }
    return z / (td.length / 2);
  }

  function analyzeSpectrum(freq, td) {
    var sr = (ctx && ctx.sampleRate) || 48000;
    var n = freq.length;
    var total = 0;
    var voiceE = 0;
    var weighted = 0;
    var flatNum = 0;
    var flatDen = 0;
    var localPeaks = [];
    var prev = 0;
    var prev2 = 0;

    for (var i = 1; i < n; i++) {
      var hz = binToHz(i, sr, fftSize);
      if (hz < 20 || hz > 18000) continue;
      var mag = freq[i] / 255;
      if (!hzAllowed(hz)) mag *= 0.04; /* isolation: dim blocked bands */
      total += mag;
      if (hz >= 300 && hz <= 3400) voiceE += mag;
      weighted += mag * hz;
      var m = Math.max(1e-4, mag);
      flatNum += Math.log(m);
      flatDen += m;

      /* peak pick */
      if (i > 2 && mag > 0.12 && mag >= prev && prev >= prev2 && mag > (freq[i + 1] || 0) / 255) {
        if (hzAllowed(hz)) {
          localPeaks.push({ hz: hz, mag: mag, note: hzToNote(hz) });
        }
      }
      prev2 = prev;
      prev = mag;
    }

    localPeaks.sort(function (a, b) {
      return b.mag - a.mag;
    });
    /* de-dupe nearby peaks */
    var cleaned = [];
    for (var p = 0; p < localPeaks.length && cleaned.length < 5; p++) {
      var ok = true;
      for (var c = 0; c < cleaned.length; c++) {
        if (Math.abs(Math.log(cleaned[c].hz / localPeaks[p].hz)) < 0.08) {
          ok = false;
          break;
        }
      }
      if (ok) cleaned.push(localPeaks[p]);
    }
    peaks = cleaned;

    var centroid = total > 1e-4 ? weighted / total : 0;
    var voiceRatio = total > 1e-4 ? voiceE / total : 0;
    var geom = Math.exp(flatNum / Math.max(1, n));
    var arith = flatDen / Math.max(1, n);
    var flatness = arith > 1e-6 ? geom / arith : 1;
    var zcr = zeroCrossRate(td);
    var energy = total / Math.max(1, n);
    var rms = td ? Math.pow(10, rmsDb(td) / 20) : energy;

    /* VAD heuristic */
    var mode = "silence";
    var conf = 0;
    if (energy < 0.018 || rms < 0.01) {
      mode = "silence";
      conf = 0.9;
    } else if (voiceRatio > 0.38 && flatness < 0.55 && zcr > 0.02 && zcr < 0.28 && centroid > 200 && centroid < 4200) {
      mode = "speech";
      conf = clamp01(0.45 + voiceRatio * 0.4 + (1 - flatness) * 0.25);
    } else if (flatness > 0.62 || (zcr > 0.3 && voiceRatio < 0.3)) {
      mode = "noise";
      conf = clamp01(flatness);
    } else {
      mode = "music";
      conf = clamp01(0.4 + (1 - flatness) * 0.3);
    }

    /* rough pitch = strongest peak in voice band or overall */
    var pitch = 0;
    for (var k = 0; k < peaks.length; k++) {
      if (peaks[k].hz >= 80 && peaks[k].hz <= 1000) {
        pitch = peaks[k].hz;
        break;
      }
    }
    if (!pitch && peaks[0]) pitch = peaks[0].hz;

    speechState = {
      mode: mode,
      conf: conf,
      pitch: pitch,
      centroid: centroid,
      voiceRatio: voiceRatio,
      energy: energy,
      flatness: flatness,
      zcr: zcr,
    };
    return speechState;
  }

  function colorForHz(hz, mag, speechBoost) {
    /* frequency → hue rainbow; speech tints magenta */
    var t = clamp01(Math.log(Math.max(20, hz) / 20) / Math.log(16000 / 20));
    var hue = 210 - t * 240; /* blue → red through green/yellow */
    if (speechState.mode === "speech") hue = 300 + (hue - 300) * 0.35;
    var sat = 70 + mag * 30 + (speechBoost || 0) * 15;
    var lit = 42 + mag * 38;
    return "hsla(" + hue + "," + sat + "%," + lit + "%," + (0.35 + mag * 0.65) + ")";
  }

  function resizeCanvas(c, cssW, cssH) {
    if (!c) return { w: 0, h: 0, g: null };
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(80, Math.floor(cssW || c.clientWidth || 280));
    var h = Math.max(60, Math.floor(cssH || c.clientHeight || 140));
    if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(h * dpr)) {
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
    }
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h, g: g };
  }

  /* ── RGB parade from pip video (classic scope columns) ── */
  function paintRgbParade() {
    if (!showParade || !cvs.parade) return;
    var stack = document.getElementById("mg-wave-stack");
    var sz = resizeCanvas(cvs.parade, stack && stack.clientWidth, stack && stack.clientHeight);
    var g = sz.g;
    var w = sz.w;
    var h = sz.h;
    if (!g || w < 8) return;

    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(2,4,8,0.55)";
    g.fillRect(0, 0, w, h);

    var vid =
      document.getElementById("pip-video") ||
      document.getElementById("mg-cam-video") ||
      document.querySelector("video");
    var now = performance.now();
    var colW = Math.floor(w / 3);

    if (vid && vid.videoWidth > 8 && vid.readyState >= 2 && now - lastParadeT > 40) {
      lastParadeT = now;
      try {
        if (!paradeScratch) {
          paradeScratch = document.createElement("canvas");
          paradeScratch.width = 96;
          paradeScratch.height = 54;
          paradeCtx2d = paradeScratch.getContext("2d", { willReadFrequently: true });
        }
        paradeCtx2d.drawImage(vid, 0, 0, paradeScratch.width, paradeScratch.height);
        var img = paradeCtx2d.getImageData(0, 0, paradeScratch.width, paradeScratch.height);
        var data = img.data;
        var pw = paradeScratch.width;
        var ph = paradeScratch.height;
        /* for each of R/G/B channels: x = sample column, y = inverted intensity */
        var chans = [
          { o: 0, color: "rgba(255,70,70,0.55)", x0: 0 },
          { o: 1, color: "rgba(70,255,110,0.5)", x0: colW },
          { o: 2, color: "rgba(70,140,255,0.55)", x0: colW * 2 },
        ];
        for (var ci = 0; ci < 3; ci++) {
          var ch = chans[ci];
          g.fillStyle = ch.color;
          var samples = Math.min(colW, pw);
          for (var x = 0; x < samples; x++) {
            var sx = Math.floor((x / samples) * pw);
            /* average vertical */
            var sum = 0;
            for (var y = 0; y < ph; y += 2) {
              sum += data[(y * pw + sx) * 4 + ch.o];
            }
            var avg = sum / (ph / 2) / 255;
            var yy = h * (1 - avg);
            g.fillRect(ch.x0 + x, yy, 1.2, Math.max(1, h - yy));
          }
          g.strokeStyle = "rgba(255,255,255,0.08)";
          g.beginPath();
          g.moveTo(ch.x0, 0);
          g.lineTo(ch.x0, h);
          g.stroke();
        }
        g.fillStyle = "rgba(255,255,255,0.25)";
        g.font = "9px ui-monospace,Menlo,monospace";
        g.fillText("R", 4, 12);
        g.fillText("G", colW + 4, 12);
        g.fillText("B", colW * 2 + 4, 12);
        return;
      } catch (eP) {}
    }

    /* fallback: audio-mapped RGB parade (L→R M→G R→B energy over freq) */
    var fL = freqData.L;
    var fR = freqData.R;
    var fM = freqData.M;
    if (!fM) return;
    var n = fM.length;
    var chans2 = [
      { data: fL || fM, color: "rgba(255,70,70,0.5)", x0: 0, label: "L→R" },
      { data: fM, color: "rgba(70,255,110,0.48)", x0: colW, label: "M→G" },
      { data: fR || fM, color: "rgba(70,140,255,0.5)", x0: colW * 2, label: "R→B" },
    ];
    for (var j = 0; j < 3; j++) {
      var c2 = chans2[j];
      g.fillStyle = c2.color;
      var samples2 = Math.min(colW, 64);
      for (var xi = 0; xi < samples2; xi++) {
        var bi = Math.floor(Math.pow(xi / samples2, 1.6) * (n - 1));
        var hz = binToHz(bi, (ctx && ctx.sampleRate) || 48000, fftSize);
        var mag = (c2.data[bi] || 0) / 255;
        if (!hzAllowed(hz)) mag *= 0.08;
        var yy2 = h * (1 - mag);
        g.fillRect(c2.x0 + xi * (colW / samples2), yy2, Math.max(1, colW / samples2), Math.max(1, h - yy2));
      }
    }
  }

  /* ── log-freq spectrum with color variation ── */
  function paintSpectrum() {
    if (!cvs.spec) return;
    var stack = document.getElementById("mg-wave-stack");
    var sz = resizeCanvas(cvs.spec, stack && stack.clientWidth, stack && stack.clientHeight);
    var g = sz.g;
    var w = sz.w;
    var h = sz.h;
    if (!g) return;
    g.clearRect(0, 0, w, h);

    /* grid */
    g.strokeStyle = "rgba(255,255,255,0.05)";
    g.lineWidth = 1;
    for (var gy = 0; gy < 4; gy++) {
      var yy = (h * gy) / 4;
      g.beginPath();
      g.moveTo(0, yy);
      g.lineTo(w, yy);
      g.stroke();
    }

    var freq = freqData.M;
    if (!freq) {
      g.fillStyle = "rgba(120,160,200,0.35)";
      g.font = "10px ui-monospace,Menlo,monospace";
      g.fillText("awaiting audio…", 10, h / 2);
      return;
    }
    var sr = (ctx && ctx.sampleRate) || 48000;
    var n = freq.length;
    var bars = Math.min(96, Math.floor(w / 2.5));
    var speechBoost = speechState.mode === "speech" ? speechState.conf : 0;

    for (var i = 0; i < bars; i++) {
      /* log map */
      var t0 = i / bars;
      var t1 = (i + 1) / bars;
      var hz0 = 20 * Math.pow(16000 / 20, t0);
      var hz1 = 20 * Math.pow(16000 / 20, t1);
      var b0 = hzToBin(hz0, sr, fftSize);
      var b1 = Math.max(b0 + 1, hzToBin(hz1, sr, fftSize));
      var sum = 0;
      var cnt = 0;
      for (var b = b0; b < b1 && b < n; b++) {
        sum += freq[b];
        cnt++;
      }
      var mag = cnt ? sum / cnt / 255 : 0;
      var midHz = Math.sqrt(hz0 * hz1);
      if (!hzAllowed(midHz)) mag *= 0.06;
      var bh = mag * h * 0.92;
      var x = (i / bars) * w;
      var bw = w / bars + 0.5;
      g.fillStyle = colorForHz(midHz, mag, speechBoost);
      g.shadowColor = colorForHz(midHz, mag * 1.2, speechBoost);
      g.shadowBlur = 4 + mag * 10;
      g.fillRect(x, h - bh, Math.max(1.2, bw - 0.8), bh);
    }
    g.shadowBlur = 0;

    /* peak markers */
    g.font = "8px ui-monospace,Menlo,monospace";
    for (var p = 0; p < Math.min(3, peaks.length); p++) {
      var pk = peaks[p];
      var tx = clamp01(Math.log(pk.hz / 20) / Math.log(16000 / 20));
      var px = tx * w;
      g.strokeStyle = "rgba(255,255,255,0.55)";
      g.beginPath();
      g.moveTo(px, 0);
      g.lineTo(px, h);
      g.stroke();
      g.fillStyle = "rgba(255,240,255,0.92)";
      g.fillText(Math.round(pk.hz) + " " + pk.note, px + 3, 12 + p * 11);
    }

    /* speech band highlight */
    if (bandEnabled("voice")) {
      var vx0 = clamp01(Math.log(300 / 20) / Math.log(16000 / 20)) * w;
      var vx1 = clamp01(Math.log(3400 / 20) / Math.log(16000 / 20)) * w;
      g.fillStyle =
        speechState.mode === "speech"
          ? "rgba(255,100,200,0.08)"
          : "rgba(120,160,220,0.04)";
      g.fillRect(vx0, 0, vx1 - vx0, h);
    }
  }

  /* ── 3D acoustic maze (memory-maze style, driven by spectrum) ── */
  function project(p) {
    var cosY = Math.cos(mazeYaw);
    var sinY = Math.sin(mazeYaw);
    var cosP = Math.cos(mazePitch);
    var sinP = Math.sin(mazePitch);
    var x1 = p.x * cosY - p.z * sinY;
    var z1 = p.x * sinY + p.z * cosY;
    var y1 = p.y * cosP - z1 * sinP;
    var z2 = p.y * sinP + z1 * cosP;
    var f = 2.4 / (2.8 + z2);
    return { x: x1 * f, y: y1 * f, z: z2, f: f };
  }

  function ingestMazeFromSpectrum() {
    var freq = freqData.M;
    if (!freq) return;
    var sr = (ctx && ctx.sampleRate) || 48000;
    var n = freq.length;
    var t = performance.now() / 1000;
    var fresh = [];
    var take = 48;
    for (var i = 0; i < take; i++) {
      var u = i / (take - 1);
      var hz = 40 * Math.pow(14000 / 40, u);
      var bi = hzToBin(hz, sr, fftSize);
      var mag = (freq[bi] || 0) / 255;
      if (!hzAllowed(hz)) mag *= 0.05;
      if (mag < 0.05) continue;
      var pan = 0;
      if (freqData.L && freqData.R) {
        var l = (freqData.L[bi] || 0) / 255;
        var r = (freqData.R[bi] || 0) / 255;
        pan = clamp01((r - l + 1) / 2) * 2 - 1;
      }
      var hue = 210 - u * 240;
      if (speechState.mode === "speech" && hz >= 300 && hz <= 3400) hue = 310;
      var rgb = hslToRgb(hue, 0.75, 0.45 + mag * 0.35);
      fresh.push({
        x: pan * 1.1 + (Math.sin(t * 0.7 + u * 6) * 0.05),
        y: mag * 1.6 - 0.5,
        z: (u - 0.5) * 2.2 + Math.sin(t * 0.4 + i) * 0.08,
        r: rgb[0],
        g: rgb[1],
        b: rgb[2],
        mag: mag,
        hz: hz,
      });
    }
    /* trail blend */
    mazePts = mazePts
      .map(function (p) {
        return {
          x: p.x * 0.92,
          y: p.y * 0.9,
          z: p.z * 0.94,
          r: p.r,
          g: p.g,
          b: p.b,
          mag: p.mag * 0.88,
          hz: p.hz,
        };
      })
      .filter(function (p) {
        return p.mag > 0.04;
      });
    mazePts = mazePts.concat(fresh);
    while (mazePts.length > 220) mazePts.shift();
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var r = 0,
      g = 0,
      b = 0;
    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  function paintMaze() {
    if (!showMaze || !cvs.maze) return;
    var stack = document.getElementById("mg-wave-stack");
    var sz = resizeCanvas(cvs.maze, stack && stack.clientWidth, stack && stack.clientHeight);
    var g = sz.g;
    var w = sz.w;
    var h = sz.h;
    if (!g) return;
    g.clearRect(0, 0, w, h);

    if (mazeSpin) {
      mazeYaw += 0.008 + speechState.energy * 0.02;
      mazePitch = 0.16 + Math.sin(performance.now() / 3500) * 0.1;
    }

    /* floor grid */
    g.strokeStyle = "rgba(100,160,220,0.1)";
    g.lineWidth = 1;
    for (var gi = -3; gi <= 3; gi++) {
      var a = project({ x: gi * 0.35, y: -0.85, z: -1.1 });
      var b = project({ x: gi * 0.35, y: -0.85, z: 1.1 });
      g.beginPath();
      g.moveTo(w / 2 + a.x * w * 0.42, h / 2 - a.y * h * 0.42);
      g.lineTo(w / 2 + b.x * w * 0.42, h / 2 - b.y * h * 0.42);
      g.stroke();
    }

    ingestMazeFromSpectrum();
    var sorted = mazePts
      .map(function (p) {
        return { p: p, pr: project(p) };
      })
      .sort(function (a, b) {
        return a.pr.z - b.pr.z;
      });

    g.strokeStyle =
      speechState.mode === "speech"
        ? "rgba(255,140,220,0.28)"
        : "rgba(160,220,255,0.2)";
    g.lineWidth = 1.1;
    g.beginPath();
    var linked = 0;
    for (var j = Math.max(0, sorted.length - 60); j < sorted.length; j++) {
      var px = w / 2 + sorted[j].pr.x * w * 0.42;
      var py = h / 2 - sorted[j].pr.y * h * 0.42;
      if (!linked) g.moveTo(px, py);
      else g.lineTo(px, py);
      linked++;
    }
    g.stroke();

    for (var i = 0; i < sorted.length; i++) {
      var s = sorted[i];
      var szp = Math.max(1.1, 2.2 * s.pr.f * (0.6 + s.p.mag));
      var alpha = 0.4 + 0.55 * s.pr.f * s.p.mag;
      g.fillStyle = "rgba(" + s.p.r + "," + s.p.g + "," + s.p.b + "," + alpha + ")";
      g.beginPath();
      g.arc(w / 2 + s.pr.x * w * 0.42, h / 2 - s.pr.y * h * 0.42, szp, 0, Math.PI * 2);
      g.fill();
    }

    g.fillStyle = "rgba(180,220,255,0.55)";
    g.font = "8px ui-monospace,Menlo,monospace";
    g.fillText("acoustic maze · " + mazePts.length + " pts", 6, h - 6);
  }

  /* ── compact L/R/M freq mini bars ── */
  function paintLane(ch) {
    var c = cvs[ch];
    var a = analysers[ch];
    var fd = freqData[ch];
    if (!c) return;
    var g = c.getContext("2d");
    var w = c.width;
    var h = c.height;
    g.clearRect(0, 0, w, h);
    var colors = {
      L: ["#6ec8ff", "rgba(60,160,255,0.35)"],
      R: ["#ff7ad9", "rgba(255,90,200,0.32)"],
      M: ["#7aebb0", "rgba(70,210,150,0.32)"],
    };
    var col = colors[ch] || colors.M;

    if (remoteLevels && remoteAge < 2.5 && remoteLevels[ch] != null && !fd) {
      var amp = Number(remoteLevels[ch] || 0);
      paintMiniBars(g, w, h, null, col[0], col[1], amp);
      if (els.db && els.db[ch]) {
        var dbR = amp < 1e-4 ? -90 : 20 * Math.log10(Math.max(1e-4, amp));
        els.db[ch].textContent = dbR <= -89 ? "—∞" : dbR.toFixed(0);
      }
      return;
    }

    if (a && fd) {
      a.getByteFrequencyData(fd);
      if (timeData[ch]) a.getByteTimeDomainData(timeData[ch]);
      paintMiniBars(g, w, h, fd, col[0], col[1], 0);
      if (els.db && els.db[ch] && timeData[ch]) {
        var db = rmsDb(timeData[ch]);
        els.db[ch].textContent = db <= -89 ? "—∞" : db.toFixed(0);
      }
    } else {
      paintMiniBars(g, w, h, null, col[0], col[1], 0.15);
      if (els.db && els.db[ch]) els.db[ch].textContent = "—";
    }
  }

  function paintMiniBars(g, w, h, freq, color, fill, amp) {
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.fillRect(0, 0, w, h);
    var n = 36;
    var sr = (ctx && ctx.sampleRate) || 48000;
    for (var i = 0; i < n; i++) {
      var mag;
      if (freq && freq.length) {
        var hz = 40 * Math.pow(12000 / 40, i / (n - 1));
        var bi = hzToBin(hz, sr, fftSize);
        mag = (freq[Math.min(bi, freq.length - 1)] || 0) / 255;
        if (!hzAllowed(hz)) mag *= 0.08;
      } else {
        var t = performance.now() / 200;
        mag = (0.1 + 0.08 * Math.sin(t + i * 0.4)) * (0.3 + amp);
      }
      var bh = Math.max(1, mag * (h - 2));
      var bw = w / n;
      g.fillStyle = color;
      g.globalAlpha = 0.35 + mag * 0.65;
      g.fillRect(i * bw, h - bh, Math.max(1, bw - 0.8), bh);
    }
    g.globalAlpha = 1;
  }

  function updateHud() {
    if (els.speech) {
      els.speech.textContent = speechState.mode.toUpperCase();
      els.speech.className = "speech " + speechState.mode;
    }
    if (els.peaks) {
      if (!peaks.length) els.peaks.textContent = "peaks —";
      else
        els.peaks.textContent =
          "peaks " +
          peaks
            .slice(0, 4)
            .map(function (p) {
              return Math.round(p.hz) + "Hz " + p.note;
            })
            .join(" · ");
    }
    if (els.meta) {
      els.meta.textContent =
        "centroid " +
        (speechState.centroid ? Math.round(speechState.centroid) + "Hz" : "—") +
        " · pitch " +
        (speechState.pitch ? Math.round(speechState.pitch) + "Hz " + hzToNote(speechState.pitch) : "—") +
        " · voice " +
        Math.round((speechState.voiceRatio || 0) * 100) +
        "%" +
        " · conf " +
        Math.round((speechState.conf || 0) * 100) +
        "%";
    }
  }

  function tick() {
    /* pull analyser data for M first (analysis) */
    if (analysers.M && freqData.M) {
      analysers.M.getByteFrequencyData(freqData.M);
      if (timeData.M) analysers.M.getByteTimeDomainData(timeData.M);
      analyzeSpectrum(freqData.M, timeData.M);
    } else if (remoteLevels && remoteAge < 2.5) {
      /* synth freq from remote levels for HUD */
      speechState.mode = remoteLevels.src && remoteLevels.src !== "none" ? "music" : "silence";
    }

    paintRgbParade();
    paintSpectrum();
    paintMaze();
    paintLane("L");
    paintLane("R");
    paintLane("M");
    updateHud();
    raf = requestAnimationFrame(tick);
  }

  function pollRemoteLevels() {
    try {
      fetch("http://127.0.0.1:9877/audio-levels?t=" + Date.now(), { cache: "no-store" })
        .then(function (r) {
          return r.json();
        })
        .then(function (j) {
          if (!j || !j.ok) return;
          remoteLevels = j;
          remoteAge = typeof j.age_s === "number" ? j.age_s : 0;
          if (remoteAge < 1.5 && j.src && j.src !== "none") setSrc("phone · " + j.src, true);
        })
        .catch(function () {});
    } catch (e) {}
  }

  function startMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setSrc("no media", false);
      return Promise.resolve(false);
    }
    if (!ensureCtx()) {
      setSrc("no AudioContext", false);
      return Promise.resolve(false);
    }
    return navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 2,
        },
        video: false,
      })
      .then(function (stream) {
        micStream = stream;
        var src = ctx.createMediaStreamSource(stream);
        wireGraph(src, "mic · stereo");
        return true;
      })
      .catch(function (err) {
        setSrc("mic " + (err && err.name ? err.name : "deny"), false);
        return false;
      });
  }

  function startPhoneAudio() {
    if (!ensureCtx()) return Promise.resolve(false);
    var base = "http://127.0.0.1:9877/";
    return fetch(base + "phone-live.stamp?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.text() : "";
      })
      .then(function (stamp) {
        stamp = String(stamp || "").trim();
        if (!stamp) {
          setSrc("phone · no audio", false);
          return false;
        }
        if (stamp === lastPhoneStamp && phoneSrc) return true;
        lastPhoneStamp = stamp;
        try {
          if (phoneAudio) {
            phoneAudio.pause();
            phoneAudio.removeAttribute("src");
          }
        } catch (eP) {}
        phoneAudio = new Audio();
        phoneAudio.crossOrigin = "anonymous";
        phoneAudio.loop = true;
        phoneAudio.volume = 0.001;
        phoneAudio.src = base + "phone-live.m4a?t=" + encodeURIComponent(stamp);
        return phoneAudio
          .play()
          .then(function () {
            try {
              if (phoneSrc) {
                try {
                  phoneSrc.disconnect();
                } catch (eD) {}
              }
              phoneSrc = ctx.createMediaElementSource(phoneAudio);
              wireGraph(phoneSrc, "phone · still");
              return true;
            } catch (eS) {
              setSrc("phone graph", false);
              return false;
            }
          })
          .catch(function () {
            setSrc("phone silent", false);
            return false;
          });
      })
      .catch(function () {
        setSrc("phone offline", false);
        return false;
      });
  }

  function kick() {
    ensureCtx();
    if (!raf) raf = requestAnimationFrame(tick);
    pollRemoteLevels();
    if (
      micStream &&
      micStream.getAudioTracks().some(function (t) {
        return t.readyState === "live";
      })
    ) {
      setSrc("mic · live", true);
      return;
    }
    startMic().then(function (okMic) {
      if (!okMic) startPhoneAudio();
    });
  }

  function mount() {
    ensureShell();
    if (!box) return false;
    /* stop prior live.js wave raf if it left a ticker — we own the panel now */
    try {
      if (window.__mgAudioWave && window.__mgAudioWave._stop) window.__mgAudioWave._stop();
    } catch (eS) {}
    kick();
    box.addEventListener("pointerdown", function () {
      kick();
    });
    document.addEventListener(
      "pointerdown",
      function onceUnlock() {
        kick();
        document.removeEventListener("pointerdown", onceUnlock, true);
      },
      true
    );
    setInterval(pollRemoteLevels, 120);
    setInterval(function () {
      if (
        srcLabel.indexOf("phone") >= 0 ||
        srcLabel.indexOf("idle") >= 0 ||
        srcLabel.indexOf("silent") >= 0 ||
        srcLabel.indexOf("offline") >= 0
      ) {
        startPhoneAudio();
      }
    }, 2500);
    log(VER + " · spectrum + isolation + speech + RGB parade + acoustic maze");
    return true;
  }

  function report() {
    return (
      VER +
      " src=" +
      srcLabel +
      " speech=" +
      speechState.mode +
      " peaks=" +
      peaks.length +
      " maze=" +
      mazePts.length +
      " solo=" +
      (soloBand || "—")
    );
  }

  window.__mgAcousticScope = {
    ver: VER,
    mount: mount,
    kick: kick,
    startMic: startMic,
    startPhone: startPhoneAudio,
    report: report,
    state: function () {
      return {
        speech: speechState,
        peaks: peaks.slice(),
        bands: Object.assign({}, bandOn),
        solo: soloBand,
        src: srcLabel,
      };
    },
    setBand: function (id, on) {
      if (bandOn.hasOwnProperty(id)) bandOn[id] = !!on;
      refreshIsoUi();
    },
    solo: function (id) {
      soloBand = id || null;
      refreshIsoUi();
    },
  };

  /* Also expose as audio wave for live.js compatibility */
  window.__mgAudioWave = {
    ver: VER,
    kick: kick,
    startMic: startMic,
    startPhone: startPhoneAudio,
    report: report,
    _stop: function () {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
  };

  /* Auto-mount when stage ready */
  function tryMount() {
    if (document.getElementById("pip-wrap") || document.getElementById("stage")) {
      mount();
      return true;
    }
    return false;
  }
  if (!tryMount()) {
    var n = 0;
    var iv = setInterval(function () {
      n++;
      if (tryMount() || n > 40) clearInterval(iv);
    }, 250);
  }
})();
