/* Memory Glass · Staff Lab Plane
 * Full KBatch music-staff toolkit under TOOLS → Staff:
 *   chromatic chart · transposition · scholarly research · assistive playalong
 *   + keyboard staff/piano tools (beats embed) · catalogue browse bridge
 * Rights: theory-pd + short PD motif seeds only (honor music axis).
 * Lab twin: https://kbatch.ugrad.ai/labs/music-staff
 * VER: staff-lab-plane-v3-note-wheel
 * Beats (staff + piano) live here under Staff — Keys hosts maze/gsplat instead.
 * Note wheel L1–L5: pitch pipe → chromatic → Co5 transpose → degrees → phrase build.
 */
(function () {
  "use strict";
  var VER = "staff-lab-plane-v3-note-wheel";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._staffLabVer === VER) return;
  HP._staffLabVer = VER;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "staff-lab");
    } catch (e) {}
  }

  var NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  var NOTE_FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
  var SOLFEGE = ["Do", "Di/Ra", "Re", "Ri/Me", "Mi", "Fa", "Fi/Se", "Sol", "Si/Le", "La", "Li/Te", "Ti"];
  var KEYS = ["C", "G", "D", "A", "E", "B", "F♯", "D♭", "A♭", "E♭", "B♭", "F"];
  /* Circle of fifths order (sharps → flats) */
  var COF = ["C", "G", "D", "A", "E", "B", "F♯", "D♭", "A♭", "E♭", "B♭", "F"];
  var COF_PC = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

  /**
   * Wheel levels (build ladder):
   * L1 pitch pipe — single tones (like a physical pitch pipe)
   * L2 chromatic — 12-TET dial + solfège
   * L3 circle of fifths — key / transpose via Co5
   * L4 degrees — stack intervals from root (build scale/chord)
   * L5 phrase — accumulate MIDI phrase → staff/beats
   */
  var WHEEL_LEVELS = [
    {
      id: 1,
      label: "L1 · Pipe",
      title: "Pitch pipe",
      blurb: "Tap a note — pure tone · set root",
    },
    {
      id: 2,
      label: "L2 · Chrom",
      title: "Chromatic dial",
      blurb: "12-TET · solfège · chromatic order",
    },
    {
      id: 3,
      label: "L3 · Co5",
      title: "Circle of fifths",
      blurb: "Keys · transpose active entry",
    },
    {
      id: 4,
      label: "L4 · Deg",
      title: "Degree builder",
      blurb: "Stack intervals from root",
    },
    {
      id: 5,
      label: "L5 · Phrase",
      title: "Phrase build",
      blurb: "Accumulate notes → staff · play",
    },
  ];

  var state = {
    ver: VER,
    transpose: 0 /* semitones */,
    keyRoot: "C",
    rootPc: 0,
    preferFlats: false,
    playalong: false,
    playIdx: -1,
    activeEntry: null,
    activeMidis: [],
    highlightPc: {} /* pitch-class → lit */,
    researchQ: "",
    status: "",
    wheelLevel: 1,
    pipeOctave: 4 /* C4 = 60 */,
    builtPcs: [] /* L4 stacked pitch classes */,
    phraseMidis: [] /* L5 accumulated phrase */,
    lastPipeMidi: null,
  };

  var rootEl = null;
  var chromCv = null;
  var staffHost = null;
  var metaEl = null;
  var researchEl = null;
  var playEl = null;
  var statusEl = null;
  var entryTitleEl = null;
  var wheelLevelEl = null;
  var wheelHintEl = null;
  var anim = 0;
  var audioCtx = null;
  var wheelGeom = null; /* {cx,cy,R,orderPcs[]} for hit testing */

  function B() {
    return window.__mgKeyboardBeats;
  }

  function setStatus(s) {
    state.status = s || "";
    if (statusEl) statusEl.textContent = VER + " · " + state.status;
  }

  function midiName(m, flats) {
    m = Math.round(m);
    var pc = ((m % 12) + 12) % 12;
    var names = flats || state.preferFlats ? NOTE_FLAT : NOTE_NAMES;
    return names[pc] + (Math.floor(m / 12) - 1);
  }

  function entryMidis(entry) {
    if (!entry) return [];
    if (entry.midi && entry.midi.length) return entry.midi.map(Number);
    var tonic = entry.tonicMidi != null ? entry.tonicMidi : 60;
    var deg = entry.degrees || [];
    return deg.map(function (d) {
      return tonic + d;
    });
  }

  function transposeMidis(midis, st) {
    st = st || 0;
    return (midis || []).map(function (m) {
      return Math.max(0, Math.min(127, Math.round(m) + st));
    });
  }

  function transposeEntry(entry, st) {
    if (!entry) return null;
    st = st != null ? st : state.transpose;
    var midis = transposeMidis(entryMidis(entry), st);
    var out = {};
    for (var k in entry) {
      if (Object.prototype.hasOwnProperty.call(entry, k)) out[k] = entry[k];
    }
    out.midi = midis;
    if (entry.tonicMidi != null) out.tonicMidi = entry.tonicMidi + st;
    out._transpose = st;
    out._origId = entry.id;
    out.title =
      (entry.title || entry.id || "entry") +
      (st ? " · T" + (st > 0 ? "+" : "") + st : "");
    return out;
  }

  function wheelOrderPcs() {
    /* L3 Co5 order; else chromatic from root */
    if (state.wheelLevel === 3) return COF_PC.slice();
    var out = [];
    for (var i = 0; i < 12; i++) out.push((state.rootPc + i) % 12);
    return out;
  }

  function pcLabel(pc) {
    pc = ((pc % 12) + 12) % 12;
    var lab = state.preferFlats ? NOTE_FLAT[pc] : NOTE_NAMES[pc];
    return lab.replace("♯", "#").replace("♭", "b");
  }

  function blipMidi(midi, dur) {
    midi = Math.max(0, Math.min(127, Math.round(midi)));
    dur = dur || 0.35;
    try {
      if (B() && B().ingestNote) {
        B().ingestNote(midi, {
          src: "pitch-pipe",
          hit: true,
          ch: midiName(midi),
          pack: "pitch-pipe-L" + state.wheelLevel,
        });
        return;
      }
    } catch (e0) {}
    try {
      if (!audioCtx)
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var t0 = audioCtx.currentTime;
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (e1) {}
  }

  function rootMidi() {
    return 12 * (state.pipeOctave + 1) + state.rootPc;
  }

  function pushPhraseMidi(midi) {
    state.phraseMidis.push(Math.round(midi));
    if (state.phraseMidis.length > 32) state.phraseMidis.shift();
    state.activeMidis = state.phraseMidis.slice();
    setHighlightFromMidis(state.phraseMidis);
  }

  function commitPhraseToStaff() {
    if (!state.phraseMidis.length) {
      setStatus("phrase empty · tap wheel L5");
      return;
    }
    var entry = {
      id: "pipe-phrase-" + Date.now(),
      title:
        "Pipe phrase · root " +
        state.keyRoot +
        " · " +
        state.phraseMidis.length +
        "n",
      kind: "motif",
      family: "pitch-pipe",
      midi: state.phraseMidis.slice(),
      tonicMidi: rootMidi(),
      bpm: 96,
      rights: "theory-pd · user phrase",
      solfege: state.phraseMidis
        .map(function (m) {
          return SOLFEGE[((m % 12) + 12) % 12].split("/")[0];
        })
        .join(" "),
    };
    loadEntry(entry, { play: true, sequential: true });
    setStatus("phrase → staff · " + state.phraseMidis.length + " notes");
  }

  function selectWheelPc(pc, opts) {
    opts = opts || {};
    pc = ((pc % 12) + 12) % 12;
    var midi = 12 * (state.pipeOctave + 1) + pc;
    state.lastPipeMidi = midi;
    state.highlightPc = {};
    state.highlightPc[pc] = 1;

    var L = state.wheelLevel;

    if (L === 1) {
      /* pitch pipe */
      state.rootPc = pc;
      state.keyRoot = state.preferFlats ? NOTE_FLAT[pc] : NOTE_NAMES[pc];
      blipMidi(midi, 0.55);
      setStatus("pipe · " + midiName(midi) + " · root " + state.keyRoot);
    } else if (L === 2) {
      state.rootPc = pc;
      state.keyRoot = NOTE_NAMES[pc];
      blipMidi(midi, 0.4);
      setStatus(
        "chrom · " +
          midiName(midi) +
          " · " +
          SOLFEGE[pc] +
          " · set root"
      );
    } else if (L === 3) {
      /* Co5: set transpose from C */
      state.rootPc = pc;
      state.keyRoot = NOTE_NAMES[pc];
      setTranspose(pc);
      blipMidi(60 + pc, 0.35);
      setStatus("Co5 · key " + state.keyRoot + " · T+" + pc);
      return; /* setTranspose paints */
    } else if (L === 4) {
      /* degree builder relative to root */
      var deg = (pc - state.rootPc + 12) % 12;
      if (state.builtPcs.indexOf(pc) < 0) state.builtPcs.push(pc);
      else state.builtPcs = state.builtPcs.filter(function (x) {
        return x !== pc;
      });
      state.builtPcs.forEach(function (p) {
        state.highlightPc[p] = 1;
      });
      state.highlightPc[state.rootPc] = 1;
      var midis = state.builtPcs
        .slice()
        .sort(function (a, b) {
          return a - b;
        })
        .map(function (p) {
          return 12 * (state.pipeOctave + 1) + p;
        });
      if (!midis.length) midis = [rootMidi()];
      state.activeMidis = midis;
      blipMidi(midi, 0.3);
      setStatus(
        "deg · root " +
          NOTE_NAMES[state.rootPc] +
          " · +" +
          deg +
          " · stack " +
          state.builtPcs
            .map(function (p) {
              return NOTE_NAMES[p];
            })
            .join(" ")
      );
      /* optional: push stack as chord-like entry */
      if (opts.commit && midis.length >= 2) {
        loadEntry(
          {
            id: "pipe-deg-" + state.rootPc + "-" + midis.length,
            title:
              "Degrees · " +
              NOTE_NAMES[state.rootPc] +
              " · " +
              midis.length +
              " pcs",
            kind: "chord",
            family: "pitch-pipe",
            midi: midis,
            tonicMidi: rootMidi(),
            bpm: 80,
            rights: "theory-pd",
          },
          { play: true, sequential: false }
        );
      }
    } else if (L === 5) {
      pushPhraseMidi(midi);
      blipMidi(midi, 0.28);
      setStatus(
        "phrase · " +
          state.phraseMidis.length +
          "n · last " +
          midiName(midi) +
          (opts.commit ? " · commit" : " · tap Commit")
      );
      if (opts.commit) commitPhraseToStaff();
    }
    paint();
  }

  /* ── Note wheel + chromatic chart draw ── */
  function drawChromatic() {
    if (!chromCv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = chromCv.clientWidth || 320;
    var h = 200;
    if (
      chromCv.width !== Math.floor(w * dpr) ||
      chromCv.height !== Math.floor(h * dpr)
    ) {
      chromCv.width = Math.floor(w * dpr);
      chromCv.height = Math.floor(h * dpr);
    }
    var ctx = chromCv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var level = state.wheelLevel;
    var order = wheelOrderPcs();
    var cx = Math.min(96, w * 0.28);
    var cy = h * 0.46;
    var R = Math.min(72, h * 0.36);
    var rIn = R * 0.42;
    wheelGeom = { cx: cx, cy: cy, R: R, rIn: rIn, order: order };

    /* background disc */
    ctx.beginPath();
    ctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fill();

    /* wedges */
    for (var i = 0; i < 12; i++) {
      var a0 = -Math.PI / 2 + (i / 12) * Math.PI * 2;
      var a1 = -Math.PI / 2 + ((i + 1) / 12) * Math.PI * 2;
      var pc = order[i];
      var lit = !!state.highlightPc[pc];
      var isRoot = pc === state.rootPc;
      ctx.beginPath();
      ctx.moveTo(
        cx + Math.cos(a0) * rIn,
        cy + Math.sin(a0) * rIn
      );
      ctx.arc(cx, cy, R, a0, a1);
      ctx.arc(cx, cy, rIn, a1, a0, true);
      ctx.closePath();
      var hue = 200 + ((pc * 25) % 140);
      if (level === 3) hue = 40 + i * 24;
      ctx.fillStyle = lit
        ? "hsla(" + hue + ",70%,58%,0.85)"
        : isRoot
          ? "rgba(10,132,255,0.35)"
          : "rgba(255,255,255," + (0.06 + (i % 2) * 0.04) + ")";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      var amid = (a0 + a1) / 2;
      var rx = cx + Math.cos(amid) * ((R + rIn) / 2);
      var ry = cy + Math.sin(amid) * ((R + rIn) / 2);
      ctx.fillStyle = lit
        ? "rgba(8,12,18,0.95)"
        : "rgba(230,235,245,0.9)";
      ctx.font = "700 9px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pcLabel(pc), rx, ry);
    }

    /* hub */
    ctx.beginPath();
    ctx.arc(cx, cy, rIn - 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(12,14,20,0.92)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.stroke();
    ctx.fillStyle = "rgba(180,220,255,0.95)";
    ctx.font = "700 11px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pcLabel(state.rootPc), cx, cy - 6);
    ctx.fillStyle = "rgba(160,190,210,0.7)";
    ctx.font = "600 8px system-ui";
    ctx.fillText(
      level === 3 ? "Co5" : level === 1 ? "PIPE" : "12-TET",
      cx,
      cy + 8
    );

    ctx.fillStyle = "rgba(180,210,230,0.65)";
    ctx.font = "600 9px system-ui";
    ctx.textAlign = "center";
    var Lmeta = WHEEL_LEVELS[level - 1] || WHEEL_LEVELS[0];
    ctx.fillText(Lmeta.title, cx, h - 12);

    /* right panel: strip + level readout */
    var left = cx + R + 16;
    var stripW = Math.max(80, w - left - 8);
    var cellW = stripW / 12;
    ctx.textAlign = "center";
    for (var p = 0; p < 12; p++) {
      var x0 = left + p * cellW;
      var lit2 = !!state.highlightPc[p];
      ctx.fillStyle = lit2
        ? "rgba(120,255,200,0.35)"
        : p % 2
          ? "rgba(255,255,255,0.05)"
          : "rgba(255,255,255,0.09)";
      ctx.fillRect(x0 + 1, 10, cellW - 2, 34);
      ctx.fillStyle = lit2
        ? "rgba(180,255,220,0.95)"
        : "rgba(230,235,245,0.8)";
      ctx.font = "600 9px system-ui";
      ctx.fillText(pcLabel(p), x0 + cellW / 2, 24);
      ctx.fillStyle = "rgba(180,200,220,0.45)";
      ctx.font = "500 7px system-ui";
      ctx.fillText(SOLFEGE[p].split("/")[0], x0 + cellW / 2, 38);
    }

    ctx.fillStyle = "rgba(200,220,240,0.8)";
    ctx.font = "600 10px ui-monospace,Menlo,monospace";
    ctx.textAlign = "left";
    ctx.fillText(
      "L" +
        level +
        " · T" +
        (state.transpose >= 0 ? "+" : "") +
        state.transpose +
        " · root " +
        state.keyRoot +
        " · oct " +
        state.pipeOctave,
      left,
      58
    );
    ctx.fillStyle = "rgba(160,190,210,0.55)";
    ctx.font = "500 9px system-ui";
    ctx.fillText(Lmeta.blurb + " · tap wheel", left, 74);

    var midis =
      level === 5 && state.phraseMidis.length
        ? state.phraseMidis
        : level === 4 && state.builtPcs.length
          ? state.builtPcs.map(function (pc) {
              return 12 * (state.pipeOctave + 1) + pc;
            })
          : state.activeMidis || [];
    if (midis.length) {
      var minM = Math.min.apply(null, midis);
      var maxM = Math.max.apply(null, midis);
      var span = Math.max(12, maxM - minM + 1);
      var barY = 88;
      var barH = 48;
      midis.forEach(function (m, idx) {
        var nx = left + ((m - minM) / span) * (stripW - 8);
        var isPlay = state.playalong && state.playIdx === idx;
        ctx.fillStyle = isPlay
          ? "rgba(255,200,80,0.95)"
          : "rgba(100,180,255,0.75)";
        ctx.fillRect(nx, barY + 8, 5, barH - 16);
      });
      ctx.fillStyle = "rgba(160,200,220,0.55)";
      ctx.font = "500 9px ui-monospace,Menlo,monospace";
      ctx.fillText(
        midis.length +
          " tones · " +
          midiName(minM) +
          "–" +
          midiName(maxM) +
          (state.playalong ? " · PLAYALONG" : ""),
        left,
        h - 10
      );
    } else {
      ctx.fillStyle = "rgba(160,180,200,0.4)";
      ctx.font = "500 10px system-ui";
      ctx.fillText(
        level <= 2
          ? "Tap a wedge for pitch-pipe tone"
          : level === 3
            ? "Tap Co5 key to transpose"
            : level === 4
              ? "Tap degrees · stack intervals"
              : "Tap notes · Commit phrase",
        left,
        110
      );
    }
  }

  function hitTestWheel(clientX, clientY) {
    if (!chromCv || !wheelGeom) return null;
    var rect = chromCv.getBoundingClientRect();
    var x = clientX - rect.left;
    var y = clientY - rect.top;
    var dx = x - wheelGeom.cx;
    var dy = y - wheelGeom.cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > wheelGeom.R + 4 || dist < wheelGeom.rIn * 0.35) {
      /* strip hit? */
      var left = wheelGeom.cx + wheelGeom.R + 16;
      var stripW = Math.max(80, (chromCv.clientWidth || 320) - left - 8);
      if (x >= left && x <= left + stripW && y >= 10 && y <= 48) {
        var cell = Math.floor(((x - left) / stripW) * 12);
        if (cell >= 0 && cell < 12) return cell; /* chromatic pc */
      }
      return null;
    }
    var ang = Math.atan2(dy, dx);
    var a = ang + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    var idx = Math.floor((a / (Math.PI * 2)) * 12) % 12;
    return wheelGeom.order[idx];
  }

  function bindWheelInput() {
    if (!chromCv || chromCv._wheelBound) return;
    chromCv._wheelBound = true;
    chromCv.style.cursor = "pointer";
    chromCv.addEventListener("pointerdown", function (ev) {
      try {
        ev.preventDefault();
        ev.stopPropagation();
      } catch (e) {}
      var pc = hitTestWheel(ev.clientX, ev.clientY);
      if (pc == null) return;
      selectWheelPc(pc, { commit: ev.shiftKey || ev.metaKey });
    });
  }

  function setWheelLevel(n) {
    state.wheelLevel = Math.max(1, Math.min(5, n | 0));
    if (wheelLevelEl) {
      var btns = wheelLevelEl.querySelectorAll("button[data-wl]");
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        b.classList.toggle("on", Number(b.getAttribute("data-wl")) === state.wheelLevel);
      }
    }
    if (wheelHintEl) {
      var meta = WHEEL_LEVELS[state.wheelLevel - 1];
      wheelHintEl.textContent = meta
        ? meta.label + " — " + meta.blurb
        : "";
    }
    setStatus("wheel " + (WHEEL_LEVELS[state.wheelLevel - 1] || {}).label);
    paint();
  }

  function setHighlightFromMidis(midis) {
    state.highlightPc = {};
    (midis || []).forEach(function (m) {
      state.highlightPc[((m % 12) + 12) % 12] = 1;
    });
  }

  function loadEntry(entryOrId, opts) {
    opts = opts || {};
    var beats = B();
    function apply(entry) {
      if (!entry) {
        setStatus("entry miss");
        return { ok: false };
      }
      var tEntry = transposeEntry(entry, state.transpose);
      state.activeEntry = tEntry;
      state.activeMidis = entryMidis(tEntry);
      setHighlightFromMidis(state.activeMidis);
      if (entryTitleEl) {
        entryTitleEl.innerHTML =
          "<b>" +
          String(tEntry.title || tEntry.id).replace(/</g, "&lt;") +
          "</b> · " +
          String(tEntry.kind || "") +
          (tEntry.solfege ? " · " + String(tEntry.solfege) : "") +
          (tEntry.rights ? " · " + String(tEntry.rights) : "");
      }
      paintResearch(tEntry);
      if (beats && beats.loadCatalogue) {
        var r = beats.loadCatalogue(tEntry, {
          play: opts.play !== false,
          sequential: opts.sequential !== false,
          clear: true,
        });
        if (opts.playalong || state.playalong) startPlayalong(tEntry);
        setStatus(
          "loaded " +
            (tEntry.id || tEntry.title) +
            (state.transpose ? " T" + state.transpose : "")
        );
        paint();
        return r;
      }
      setStatus("beats missing — staff play limited");
      paint();
      return { ok: true, offline: true };
    }

    if (typeof entryOrId === "object" && entryOrId) return apply(entryOrId);
    var id = String(entryOrId || "");
    if (beats && beats.getCatalogueEntry) {
      var hit = beats.getCatalogueEntry(id);
      if (hit) return apply(hit);
    }
    if (beats && beats.loadCatalogueId) {
      return beats.loadCatalogueId(id, function (r) {
        if (r && r.ok) {
          var e =
            (beats.getCatalogueEntry && beats.getCatalogueEntry(id)) ||
            (window.__mgStaffCatalogueSeed &&
              (window.__mgStaffCatalogueSeed.entries || []).filter(function (x) {
                return x.id === id;
              })[0]);
          apply(e);
        } else setStatus((r && r.reason) || "load fail");
      }, opts);
    }
    setStatus("catalogue not ready");
    return { ok: false };
  }

  /* ── Assistive playalong ── */
  var playTimers = [];
  function stopPlayalong() {
    state.playalong = false;
    state.playIdx = -1;
    for (var i = 0; i < playTimers.length; i++) {
      try {
        clearTimeout(playTimers[i]);
      } catch (e) {}
    }
    playTimers = [];
    if (B() && B().stopCataloguePlay) B().stopCataloguePlay();
    if (playEl) playEl.textContent = "PLAYALONG";
    paint();
  }

  function startPlayalong(entry) {
    stopPlayalong();
    entry = entry || state.activeEntry;
    if (!entry) {
      setStatus("load an entry first");
      return;
    }
    state.playalong = true;
    state.playIdx = -1;
    if (playEl) {
      playEl.textContent = "STOP";
      playEl.classList.add("on");
    }
    var midis = entryMidis(entry);
    var durs = entry.durations || [];
    var bpm = entry.bpm > 30 ? entry.bpm : 100;
    var beatMs = 60000 / bpm;
    var t = 80;
    setStatus("playalong · scholarly assist · " + bpm + " bpm");
    midis.forEach(function (midi, idx) {
      (function (m, i, delay) {
        playTimers.push(
          setTimeout(function () {
            if (!state.playalong) return;
            state.playIdx = i;
            state.highlightPc = {};
            state.highlightPc[((m % 12) + 12) % 12] = 1;
            try {
              if (B() && B().ingestNote)
                B().ingestNote(m, {
                  src: "playalong",
                  hit: true,
                  ch: midiName(m),
                  pack: entry.id || "playalong",
                });
            } catch (eI) {}
            /* blip via loadCatalogue path or silent light */
            try {
              if (B() && B().onKey) B().onKey({ key: "", code: "" }, m);
            } catch (eK) {}
            paint();
            if (i === midis.length - 1) {
              setTimeout(function () {
                if (state.playalong) {
                  state.playIdx = -1;
                  setHighlightFromMidis(midis);
                  state.playalong = false;
                  if (playEl) {
                    playEl.textContent = "PLAYALONG";
                    playEl.classList.remove("on");
                  }
                  setStatus("playalong complete · " + (entry.title || entry.id));
                  paint();
                }
              }, 400);
            }
          }, delay)
        );
      })(Math.round(midi), idx, t);
      var d = durs[idx] != null && isFinite(durs[idx]) ? Number(durs[idx]) : 1;
      t += Math.max(0.35, d) * beatMs;
    });
    /* also feed full entry to beats for staff notation */
    if (B() && B().loadCatalogue) {
      B().loadCatalogue(entry, { play: true, sequential: true, clear: true });
    }
  }

  /* ── Scholarly research panel ── */
  function paintResearch(entry) {
    if (!researchEl) return;
    entry = entry || state.activeEntry;
    var lines = [];
    lines.push(
      "<b>Scholarly assist</b> · theory facts · PD motif seeds only · no lyric pirate"
    );
    if (!entry) {
      lines.push(
        "Select a catalogue entry (scale · interval · chord · motif) for analysis."
      );
      lines.push(
        'Lab: <a href="https://kbatch.ugrad.ai/labs/music-staff" target="_blank" rel="noopener">kbatch music-staff</a> · ' +
          '<a href="https://kbatch.ugrad.ai/for-ai.html#music-geometry" target="_blank" rel="noopener">chart geometry</a> · ' +
          '<a href="https://kbatch.ugrad.ai/handoff/MUSIC-STAFF-CATALOGUE.md" target="_blank" rel="noopener">catalogue docs</a>'
      );
      researchEl.innerHTML = lines.join("<br/>");
      return;
    }
    var midis = entryMidis(entry);
    var pcs = midis.map(function (m) {
      return ((m % 12) + 12) % 12;
    });
    var unique = [];
    pcs.forEach(function (p) {
      if (unique.indexOf(p) < 0) unique.push(p);
    });
    unique.sort(function (a, b) {
      return a - b;
    });
    lines.push(
      "<b>" +
        String(entry.title || entry.id).replace(/</g, "&lt;") +
        "</b> · kind <b>" +
        String(entry.kind || "—") +
        "</b>"
    );
    if (entry.family)
      lines.push("family · " + String(entry.family).replace(/</g, "&lt;"));
    if (entry.key || entry.mode)
      lines.push(
        "key/mode · <b>" +
          String(entry.key || "—") +
          "</b> " +
          String(entry.mode || "")
      );
    if (entry.solfege)
      lines.push("solfège · " + String(entry.solfege).replace(/</g, "&lt;"));
    if (entry.modern)
      lines.push("modern · " + String(entry.modern).replace(/</g, "&lt;"));
    if (entry.abc)
      lines.push(
        "ABC · <code>" + String(entry.abc).slice(0, 80).replace(/</g, "&lt;") + "</code>"
      );
    lines.push(
      "pitch classes · <b>" +
        unique
          .map(function (p) {
            return (state.preferFlats ? NOTE_FLAT : NOTE_NAMES)[p];
          })
          .join(" ") +
        "</b> (" +
        unique.length +
        "-set)"
    );
    lines.push(
      "MIDI · " +
        midis
          .slice(0, 16)
          .map(function (m) {
            return midiName(m);
          })
          .join(" ") +
        (midis.length > 16 ? "…" : "")
    );
    if (entry.timeSig) lines.push("meter · " + entry.timeSig);
    if (entry.bpm) lines.push("tempo seed · " + entry.bpm + " bpm");
    if (entry.rights)
      lines.push("rights · <b>" + String(entry.rights).replace(/</g, "&lt;") + "</b>");
    if (entry.source)
      lines.push("source · " + String(entry.source).replace(/</g, "&lt;").slice(0, 80));
    if (entry.geometryHint)
      lines.push(
        "geometry · " + String(entry.geometryHint).replace(/</g, "&lt;").slice(0, 100)
      );
    if (entry.tags && entry.tags.length)
      lines.push("tags · " + entry.tags.slice(0, 8).join(" · "));
    /* interval content for scales/chords */
    if (unique.length >= 2) {
      var ivs = [];
      for (var i = 1; i < unique.length; i++)
        ivs.push(((unique[i] - unique[0] + 12) % 12) + "st");
      lines.push("intervals from root · " + ivs.join(" · "));
    }
    lines.push(
      'Research: <a href="https://kbatch.ugrad.ai/labs/music-staff" target="_blank" rel="noopener">lab</a> · ' +
        '<a href="https://kbatch.ugrad.ai/learn.html" target="_blank" rel="noopener">learn stair</a> · ' +
        '<a href="https://kbatch.ugrad.ai/for-ai.html#music-geometry" target="_blank" rel="noopener">AI geometry</a> · ' +
        '<a href="https://kbatch.ugrad.ai/data/music-rights/index.json" target="_blank" rel="noopener">rights index</a>'
    );
    researchEl.innerHTML = lines.join("<br/>");
  }

  /* ── Text → staff bridge (pitch-class bag → nearest scale) ── */
  function textToStaffBridge(text) {
    text = String(text || "").toLowerCase();
    var map = {
      c: 0,
      d: 2,
      e: 4,
      f: 5,
      g: 7,
      a: 9,
      b: 11,
      do: 0,
      re: 2,
      mi: 4,
      fa: 5,
      sol: 7,
      la: 9,
      ti: 11,
      si: 11,
    };
    var pcs = {};
    var tokens = text.split(/[^a-z#♯b♭]+/);
    tokens.forEach(function (tok) {
      if (map[tok] != null) pcs[map[tok]] = 1;
      var m = tok.match(/^([a-g])([#♯b♭]?)$/i);
      if (m) {
        var base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()];
        if (m[2] === "#" || m[2] === "♯") base = (base + 1) % 12;
        if (m[2] === "b" || m[2] === "♭") base = (base + 11) % 12;
        pcs[base] = 1;
      }
    });
    var bag = Object.keys(pcs).map(Number);
    if (!bag.length) {
      setStatus("bridge · no pitch tokens (try: C E G or do mi sol)");
      return null;
    }
    var beats = B();
    var scales =
      (beats && beats.listCatalogue && beats.listCatalogue({ kind: "scale", limit: 80 })) ||
      [];
    var best = null;
    var bestScore = -1;
    scales.forEach(function (sc) {
      var sm = entryMidis(sc).map(function (m) {
        return ((m % 12) + 12) % 12;
      });
      var set = {};
      sm.forEach(function (p) {
        set[p] = 1;
      });
      var hit = 0;
      bag.forEach(function (p) {
        if (set[p]) hit++;
      });
      var score = hit - Math.abs(sm.length - bag.length) * 0.15;
      if (score > bestScore) {
        bestScore = score;
        best = sc;
      }
    });
    if (best) {
      setStatus(
        "bridge → " +
          best.title +
          " · match " +
          bestScore.toFixed(1) +
          " · pcs " +
          bag
            .map(function (p) {
              return NOTE_NAMES[p];
            })
            .join(" ")
      );
      loadEntry(best, { play: true });
      return best;
    }
    setStatus("bridge · no scale match");
    return null;
  }

  var transposeLabelEl = null;

  function setTranspose(st) {
    state.transpose = Math.max(-24, Math.min(24, st | 0));
    if (transposeLabelEl) {
      transposeLabelEl.textContent =
        "T" + (state.transpose >= 0 ? "+" : "") + state.transpose;
    }
    if (state.activeEntry && state.activeEntry._origId) {
      var beats = B();
      var orig =
        beats &&
        beats.getCatalogueEntry &&
        beats.getCatalogueEntry(state.activeEntry._origId);
      if (orig) loadEntry(orig, { play: false, sequential: false });
      else {
        var base = state.activeEntry.midi
          ? state.activeEntry.midi.map(function (m) {
              return m - (state.activeEntry._transpose || 0);
            })
          : state.activeMidis;
        var e = Object.assign({}, state.activeEntry);
        e.midi = transposeMidis(base, state.transpose);
        e._transpose = state.transpose;
        e.title =
          (state.activeEntry.title || "").replace(/\s·\sT[+-]?\d+$/, "") +
          (state.transpose
            ? " · T" + (state.transpose > 0 ? "+" : "") + state.transpose
            : "");
        state.activeEntry = e;
        state.activeMidis = e.midi;
        setHighlightFromMidis(e.midi);
        if (beats && beats.loadCatalogue)
          beats.loadCatalogue(e, { play: false, sequential: false });
      }
    }
    setStatus("transpose T" + (state.transpose >= 0 ? "+" : "") + state.transpose);
    paint();
  }

  function paint() {
    drawChromatic();
    paintResearch(state.activeEntry);
    if (metaEl && state.activeEntry) {
      metaEl.textContent =
        (state.activeEntry.id || "") +
        " · T" +
        state.transpose +
        " · " +
        state.activeMidis.length +
        "n";
    }
  }

  function ensureCss() {
    if (document.getElementById("mg-staff-lab-css")) return;
    var st = document.createElement("style");
    st.id = "mg-staff-lab-css";
    st.textContent = [
      "#mg-staff-lab{display:flex;flex-direction:column;gap:8px;min-height:0}",
      "#mg-staff-lab .sl-lab{",
      "  font:600 10px/1 -apple-system,system-ui;letter-spacing:0.06em;",
      "  text-transform:uppercase;color:rgba(255,255,255,0.4);padding:2px 2px 0}",
      "#mg-staff-lab canvas#mg-staff-chrom-cv{",
      "  width:100%;height:200px;display:block;border-radius:14px;",
      "  background:rgba(8,10,14,0.75);border:1px solid rgba(255,255,255,0.1);",
      "  touch-action:none;cursor:pointer}",
      "#mg-staff-lab .sl-levels{display:flex;flex-wrap:wrap;gap:4px}",
      "#mg-staff-lab .sl-levels button{",
      "  appearance:none;cursor:pointer;border:0;border-radius:999px;",
      "  padding:6px 10px;font:700 9px/1 system-ui;letter-spacing:0.04em;",
      "  text-transform:uppercase;background:rgba(255,255,255,0.08);",
      "  color:rgba(255,255,255,0.75)}",
      "#mg-staff-lab .sl-levels button.on{",
      "  background:rgba(10,132,255,0.35);color:#fff;",
      "  box-shadow:inset 0 0 0 1px rgba(255,255,255,0.35)}",
      "#mg-staff-lab .sl-wheel-hint{",
      "  font:500 11px/1.35 system-ui;color:rgba(200,220,240,0.7);padding:0 2px 4px}",
      "#mg-staff-lab .sl-hd,#mg-staff-lab .sl-row{",
      "  display:flex;flex-wrap:wrap;gap:6px;align-items:center}",
      "#mg-staff-lab .sl-hd button,#mg-staff-lab .sl-row button{",
      "  appearance:none;cursor:pointer;border:0;border-radius:10px;",
      "  padding:7px 10px;font:600 10px/1 -apple-system,system-ui;",
      "  letter-spacing:0.03em;text-transform:uppercase;",
      "  background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.9)}",
      "#mg-staff-lab .sl-hd button.hot,#mg-staff-lab .sl-row button.hot{",
      "  background:rgba(10,132,255,0.28)}",
      "#mg-staff-lab .sl-hd button.ok{background:rgba(48,209,88,0.22)}",
      "#mg-staff-lab .sl-hd button.warn{background:rgba(255,160,80,0.22)}",
      "#mg-staff-lab .sl-hd button.on{box-shadow:inset 0 0 0 1px rgba(255,255,255,0.4)}",
      "#mg-staff-lab .sl-entry{",
      "  font:500 12px/1.35 -apple-system,system-ui;color:rgba(255,255,255,0.88);",
      "  padding:6px 2px}",
      "#mg-staff-lab .sl-research{",
      "  padding:10px;border-radius:12px;background:rgba(255,255,255,0.06);",
      "  font:500 11px/1.45 -apple-system,system-ui;color:rgba(255,255,255,0.7);",
      "  max-height:min(28vh,220px);overflow:auto}",
      "#mg-staff-lab .sl-research a{color:rgba(140,200,255,0.95);text-decoration:none}",
      "#mg-staff-lab .sl-research a:hover{text-decoration:underline}",
      "#mg-staff-lab .sl-research b{color:rgba(255,255,255,0.92)}",
      "#mg-staff-lab .sl-research code{",
      "  font:500 10px/1.3 ui-monospace,Menlo,monospace;color:rgba(160,220,180,0.9)}",
      "#mg-staff-lab .sl-bridge{",
      "  display:flex;gap:6px;align-items:center}",
      "#mg-staff-lab .sl-bridge input{",
      "  flex:1;min-width:0;padding:8px 10px;border:0;border-radius:10px;",
      "  background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.92);",
      "  font:500 12px/1.2 system-ui;outline:none}",
      "#mg-staff-lab #mg-staff-beats-host{",
      "  min-height:220px;border-radius:14px;overflow:visible}",
      "#mg-staff-lab .sl-status{",
      "  font:500 10px/1.3 ui-monospace,Menlo,monospace;color:rgba(255,255,255,0.4)}",
      "#mg-staff-lab .sl-trow{display:flex;flex-wrap:wrap;gap:4px;align-items:center}",
      "#mg-staff-lab .sl-trow button{min-width:36px;padding:6px 8px}",
      "#mg-staff-lab .sl-quick{",
      "  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}",
      "#mg-staff-lab .sl-quick button{",
      "  text-align:left;padding:10px;border-radius:12px;",
      "  background:rgba(255,255,255,0.07);font:600 11px/1.2 system-ui;",
      "  text-transform:none;letter-spacing:0}",
      "#mg-staff-lab .sl-quick button small{",
      "  display:block;font:500 10px/1.2 system-ui;color:rgba(255,255,255,0.4);",
      "  margin-top:4px;text-transform:none}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function embedInto(host) {
    if (!host) return false;
    ensureCss();
    rootEl = host;
    host.innerHTML = "";
    host.id = host.id || "mg-staff-lab-host";

    var root = document.createElement("div");
    root.id = "mg-staff-lab";

    function lab(t) {
      var d = document.createElement("div");
      d.className = "sl-lab";
      d.textContent = t;
      root.appendChild(d);
      return d;
    }

    lab("Note wheel · pitch pipe · levels 1–5");
    wheelLevelEl = document.createElement("div");
    wheelLevelEl.className = "sl-levels";
    WHEEL_LEVELS.forEach(function (L) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-wl", String(L.id));
      b.textContent = L.label;
      if (L.id === state.wheelLevel) b.className = "on";
      b.title = L.title + " — " + L.blurb;
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        setWheelLevel(L.id);
      };
      wheelLevelEl.appendChild(b);
    });
    root.appendChild(wheelLevelEl);
    wheelHintEl = document.createElement("div");
    wheelHintEl.className = "sl-wheel-hint";
    wheelHintEl.textContent =
      WHEEL_LEVELS[0].label + " — " + WHEEL_LEVELS[0].blurb;
    root.appendChild(wheelHintEl);

    chromCv = document.createElement("canvas");
    chromCv.id = "mg-staff-chrom-cv";
    chromCv.setAttribute(
      "aria-label",
      "Music note wheel · pitch pipe · transpose"
    );
    root.appendChild(chromCv);
    bindWheelInput();

    /* wheel actions */
    lab("Pipe actions · octave · clear · commit");
    var wrow = document.createElement("div");
    wrow.className = "sl-trow";
    function wbtn(label, fn, cls) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (cls) b.className = cls;
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        fn();
      };
      wrow.appendChild(b);
      return b;
    }
    wbtn("Oct −", function () {
      state.pipeOctave = Math.max(1, state.pipeOctave - 1);
      setStatus("octave " + state.pipeOctave);
      paint();
    });
    wbtn("Oct +", function () {
      state.pipeOctave = Math.min(7, state.pipeOctave + 1);
      setStatus("octave " + state.pipeOctave);
      paint();
    });
    wbtn("Blip root", function () {
      blipMidi(rootMidi(), 0.6);
      setStatus("pipe root · " + midiName(rootMidi()));
    }, "hot");
    wbtn("Clear build", function () {
      state.builtPcs = [];
      state.phraseMidis = [];
      state.highlightPc = {};
      state.highlightPc[state.rootPc] = 1;
      state.activeMidis = [];
      setStatus("build cleared");
      paint();
    });
    wbtn("Commit L4/L5", function () {
      if (state.wheelLevel === 5) commitPhraseToStaff();
      else if (state.wheelLevel === 4) {
        selectWheelPc(state.rootPc, { commit: true });
      } else {
        setWheelLevel(5);
        setStatus("switch L5 · build phrase then Commit");
      }
    }, "ok");
    wbtn("→ Staff", function () {
      if (state.phraseMidis.length) commitPhraseToStaff();
      else if (state.builtPcs.length) {
        var midis = state.builtPcs.map(function (p) {
          return 12 * (state.pipeOctave + 1) + p;
        });
        loadEntry(
          {
            id: "pipe-build",
            title: "Wheel build · " + state.keyRoot,
            kind: "chord",
            midi: midis,
            tonicMidi: rootMidi(),
            bpm: 90,
            rights: "theory-pd",
          },
          { play: true }
        );
      } else blipMidi(rootMidi(), 0.5);
    }, "hot");
    root.appendChild(wrow);

    /* transpose row */
    lab("Transposition · semitones / key");
    var trow = document.createElement("div");
    trow.className = "sl-trow";
    function tbtn(label, fn, cls) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (cls) b.className = cls;
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        fn();
      };
      trow.appendChild(b);
      return b;
    }
    tbtn("−12", function () {
      setTranspose(state.transpose - 12);
    });
    tbtn("−1", function () {
      setTranspose(state.transpose - 1);
    });
    transposeLabelEl = tbtn(
      "T+0",
      function () {
        setTranspose(0);
      },
      "hot"
    );
    tbtn("+1", function () {
      setTranspose(state.transpose + 1);
    });
    tbtn("+12", function () {
      setTranspose(state.transpose + 12);
    });
    tbtn("♯/♭", function () {
      state.preferFlats = !state.preferFlats;
      paint();
    });
    /* key chips — transpose C-rooted content into chosen key */
    KEYS.forEach(function (k) {
      tbtn(k, function () {
        var keyPc = {
          C: 0,
          G: 7,
          D: 2,
          A: 9,
          E: 4,
          B: 11,
          "F♯": 6,
          "D♭": 1,
          "A♭": 8,
          "E♭": 3,
          "B♭": 10,
          F: 5,
        }[k];
        state.keyRoot = k;
        setTranspose(keyPc != null ? keyPc : 0);
      });
    });
    root.appendChild(trow);

    /* transport + lab links */
    lab("Assistive playalong · lab tools");
    var hd = document.createElement("div");
    hd.className = "sl-hd";
    function hbtn(label, cls, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (cls) b.className = cls;
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        fn(b);
      };
      hd.appendChild(b);
      return b;
    }
    playEl = hbtn("PLAYALONG", "hot", function () {
      if (state.playalong) stopPlayalong();
      else startPlayalong(state.activeEntry);
    });
    hbtn("REPLAY", "ok", function () {
      if (state.activeEntry) loadEntry(state.activeEntry, { play: true });
    });
    hbtn("STOP", "warn", function () {
      stopPlayalong();
      if (B() && B().stopCataloguePlay) B().stopCataloguePlay();
    });
    hbtn("LAB ↗", "", function () {
      window.open("https://kbatch.ugrad.ai/labs/music-staff", "_blank", "noopener");
    });
    hbtn("LYRICS", "", function () {
      window.open("https://kbatch.ugrad.ai/labs/lyrics.html", "_blank", "noopener");
    });
    hbtn("LEARN", "", function () {
      window.open("https://kbatch.ugrad.ai/learn.html", "_blank", "noopener");
    });
    hbtn("DOCS", "", function () {
      window.open(
        "https://kbatch.ugrad.ai/handoff/MUSIC-STAFF-CATALOGUE.md",
        "_blank",
        "noopener"
      );
    });
    hbtn("KEYS", "", function () {
      try {
        if (window.__mgToolsDrawer && window.__mgToolsDrawer.setMode)
          window.__mgToolsDrawer.setMode("keys");
      } catch (e) {}
    });
    root.appendChild(hd);

    /* quick scholarly seeds */
    lab("Quick scholarly seeds · PD theory / motifs");
    var quick = document.createElement("div");
    quick.className = "sl-quick";
    [
      ["scale-c-ionian", "C Ionian", "Major · degrees"],
      ["scale-c-blues", "C Blues", "Hexatonic"],
      ["scale-c-chromatic", "Chromatic", "12-TET run"],
      ["motif-ode-joy", "Ode to Joy", "PD motif seed"],
      ["motif-twinkle", "Twinkle", "PD motif seed"],
      ["motif-bach-c-prelude", "Bach C", "Arpeggio seed"],
      ["motif-sakura", "Sakura", "World approx"],
      ["int-p5", "Perfect 5th", "Interval fact"],
      ["chord-c-maj7", "Cmaj7", "Chord voicing"],
      ["solfege-pc-0", "Do", "Solfège PC"],
      ["geo-bridge-c-major-white", "White-key bridge", "Geometry"],
      ["key-C", "C major key", "Key signature"],
    ].forEach(function (pair) {
      var b = document.createElement("button");
      b.type = "button";
      b.innerHTML =
        pair[1] + "<small>" + pair[2] + " · " + pair[0] + "</small>";
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        loadEntry(pair[0], { play: true });
      };
      quick.appendChild(b);
    });
    root.appendChild(quick);

    entryTitleEl = document.createElement("div");
    entryTitleEl.className = "sl-entry";
    entryTitleEl.textContent = "No entry loaded · pick a seed or browse below";
    root.appendChild(entryTitleEl);

    lab("Scholarly research · theory readout");
    researchEl = document.createElement("div");
    researchEl.className = "sl-research";
    root.appendChild(researchEl);
    paintResearch(null);

    lab("Text → staff bridge · pitch tokens → nearest scale");
    var bridge = document.createElement("div");
    bridge.className = "sl-bridge";
    var bin = document.createElement("input");
    bin.type = "text";
    bin.placeholder = "e.g. shadow live · C E G · do mi sol · A minor path";
    var bgo = document.createElement("button");
    bgo.type = "button";
    bgo.textContent = "BRIDGE";
    bgo.className = "hot";
    bgo.onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      textToStaffBridge(bin.value);
    };
    bin.onkeydown = function (ev) {
      if (ev && ev.key === "Enter") {
        ev.preventDefault();
        textToStaffBridge(bin.value);
      }
    };
    bridge.appendChild(bin);
    bridge.appendChild(bgo);
    root.appendChild(bridge);

    lab("Beats · staff + piano (home here — not Keys)");
    staffHost = document.createElement("div");
    staffHost.id = "mg-staff-beats-host";
    root.appendChild(staffHost);
    try {
      if (B() && B().embedInto) B().embedInto(staffHost);
      else
        staffHost.innerHTML =
          '<p style="font:500 11px system-ui;color:rgba(255,255,255,0.4);padding:8px">Beats missing — hot reload keyboard-beats</p>';
    } catch (eE) {}

    statusEl = document.createElement("div");
    statusEl.className = "sl-status";
    statusEl.textContent = VER + " · KBatch music-staff twin";
    root.appendChild(statusEl);

    host.appendChild(root);

    /* warm catalogue */
    if (B() && B().loadCatalogueSeed) {
      B().loadCatalogueSeed(function (st) {
        setStatus(
          st && st.ok
            ? "catalogue " + (st.count || 0) + " entries · ready"
            : "catalogue seed pending"
        );
      });
    }

    paint();
    return true;
  }

  function unembedBeats() {
    try {
      if (B() && B().unembed) B().unembed();
    } catch (e) {}
  }

  window.__mgStaffLab = {
    ver: VER,
    state: state,
    embedInto: embedInto,
    unembedBeats: unembedBeats,
    loadEntry: loadEntry,
    setTranspose: setTranspose,
    setWheelLevel: setWheelLevel,
    selectWheelPc: selectWheelPc,
    blipMidi: blipMidi,
    commitPhraseToStaff: commitPhraseToStaff,
    startPlayalong: startPlayalong,
    stopPlayalong: stopPlayalong,
    textToStaffBridge: textToStaffBridge,
    transposeEntry: transposeEntry,
    paint: paint,
    report: function () {
      return (
        VER +
        " L" +
        state.wheelLevel +
        " T" +
        state.transpose +
        " root=" +
        state.keyRoot +
        " entry=" +
        (state.activeEntry && state.activeEntry.id
          ? state.activeEntry.id
          : "—") +
        (state.phraseMidis.length
          ? " phrase=" + state.phraseMidis.length
          : "") +
        (state.playalong ? " playalong" : "")
      );
    },
  };

  log(VER + " · note wheel L1–L5 · pitch pipe · Co5 · transpose · playalong");
})();
