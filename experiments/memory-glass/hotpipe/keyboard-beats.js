/* Memory Glass · live keyboard solve / control / beats (qbpm · piano-buddy spirit)
 * Key path → beat attempts · metric strip · feeds Bloch + maze + learn bus.
 * VER: keyboard-beats-v1
 */
(function () {
  "use strict";
  var VER = "keyboard-beats-v2-float";
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

  var keys = []; /* {ch,t,nx,ny} */
  var beats = [];
  var bpm = 96;
  var lastBeatT = 0;
  var attempts = 0;
  var hits = 0;
  var strip = null;
  var open = false; /* maze-style: off until BEATS */
  var audioCtx = null;

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

  function ensureUi() {
    if (strip) return;
    if (!document.getElementById("mg-kb-beats-css")) {
      var st = document.createElement("style");
      st.id = "mg-kb-beats-css";
      st.textContent = [
        "#mg-kb-beats{position:fixed;left:50%;bottom:calc(12px + var(--mg-kb-h,0px));",
        "  transform:translateX(-50%);z-index:2147482998;",
        "  min-width:min(420px,70vw);max-width:90vw;border-radius:12px;overflow:hidden;",
        "  background:rgba(10,12,16,0.5);backdrop-filter:blur(22px) saturate(1.35);",
        "  -webkit-backdrop-filter:blur(22px) saturate(1.35);",
        "  border:1px solid rgba(255,255,255,0.16);",
        "  box-shadow:0 8px 24px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.1);",
        "  font:600 9px/1.3 ui-monospace,Menlo,monospace;color:rgba(220,235,250,0.92);",
        "  pointer-events:auto;letter-spacing:0.04em}",
        "#mg-kb-beats.hidden{display:none}",
        "#mg-kb-beats .hd{display:flex;justify-content:space-between;align-items:center;",
        "  padding:6px 10px;letter-spacing:0.12em;text-transform:uppercase;",
        "  border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(160,210,255,0.9);",
        "  font:650 9px/1.2 system-ui}",
        "#mg-kb-beats .hd button{appearance:none;background:transparent;border:0;color:inherit;",
        "  cursor:pointer;font:700 11px/1 system-ui}",
        "#mg-kb-beats .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:8px 10px}",
        "#mg-kb-beats b{color:rgba(160,210,255,0.95)}",
        "#mg-kb-beats .bar{flex:1;min-width:80px;height:6px;border-radius:3px;",
        "  background:rgba(255,255,255,0.08);overflow:hidden}",
        "#mg-kb-beats .bar i{display:block;height:100%;background:linear-gradient(90deg,",
        "  #50e6a0,#a0c8ff,#ffb060,#f070d0,#70e0ff);width:0%;transition:width .12s}",
        "#mg-kb-beats .spark{display:flex;gap:2px;padding:0 10px 8px;height:28px;align-items:flex-end}",
        "#mg-kb-beats .spark span{flex:1;min-width:3px;border-radius:2px 2px 0 0;",
        "  background:hsla(var(--h,180),80%,60%,0.85);height:30%}",
      ].join("");
      (document.head || document.documentElement).appendChild(st);
    }
    strip = document.createElement("div");
    strip.id = "mg-kb-beats";
    strip.className = open ? "" : "hidden";
    strip.innerHTML =
      '<div class="hd"><span>Keyboard beats · qbpm</span>' +
      '<button type="button" id="mg-kb-beats-x">×</button></div>' +
      '<div class="row">' +
      "<span>BPM <b id=\"mg-kb-bpm\">96</b></span>" +
      "<span>ATT <b id=\"mg-kb-att\">0</b></span>" +
      "<span>HIT <b id=\"mg-kb-hit\">0</b></span>" +
      '<span class="bar"><i id="mg-kb-fill"></i></span>' +
      "<span id=\"mg-kb-note\">—</span>" +
      "</div>" +
      '<div class="spark" id="mg-kb-spark"></div>';
    (document.body || document.documentElement).appendChild(strip);
    strip.querySelector("#mg-kb-beats-x").onclick = function () {
      open = false;
      strip.classList.add("hidden");
    };
  }

  function blip(midi) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      g.gain.value = 0.04;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      o.stop(audioCtx.currentTime + 0.13);
    } catch (e) {}
  }

  function onKey(ch, nx, ny) {
    ensureUi();
    var now = Date.now();
    ch = String(ch || "").toLowerCase();
    keys.push({ ch: ch, t: now, nx: nx || 0.5, ny: ny || 0.5 });
    if (keys.length > 64) keys.shift();
    attempts++;

    var midi = NOTE_MAP[ch] || 60 + (ch.charCodeAt(0) % 12);
    blip(midi);

    /* beat clock attempt — hit if near quarter */
    var interval = 60000 / bpm;
    var phase = (now - lastBeatT) % interval;
    var err = Math.min(phase, interval - phase);
    var hit = err < interval * 0.22;
    if (hit) hits++;
    if (now - lastBeatT > interval * 0.5) lastBeatT = now;

    /* adapt bpm from key density */
    if (keys.length >= 4) {
      var dt = keys[keys.length - 1].t - keys[keys.length - 4].t;
      if (dt > 80) {
        var est = Math.round((3 * 60000) / dt);
        bpm = Math.max(60, Math.min(180, Math.round(bpm * 0.85 + est * 0.15)));
      }
    }

    beats.push({ t: now, ch: ch, midi: midi, hit: hit, err: err, bpm: bpm });
    if (beats.length > 80) beats.shift();

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
    if (elBpm) elBpm.textContent = String(bpm);
    if (elAtt) elAtt.textContent = String(attempts);
    if (elHit) elHit.textContent = String(hits);
    if (elFill) {
      var acc = attempts ? hits / attempts : 0;
      elFill.style.width = Math.round(acc * 100) + "%";
    }
    if (elNote && beats.length) {
      var b = beats[beats.length - 1];
      elNote.textContent =
        (b.hit ? "HIT" : "MISS") + " · m" + b.midi + " · " + (b.ch || "?");
    }
    var spark = document.getElementById("mg-kb-spark");
    if (spark) {
      spark.innerHTML = "";
      beats.slice(-24).forEach(function (bb) {
        var s = document.createElement("span");
        var h = ((bb.midi || 60) * 7) % 360;
        s.style.setProperty("--h", String(h));
        s.style.height = (bb.hit ? 70 : 35) + Math.min(30, (bb.midi || 60) % 20) + "%";
        spark.appendChild(s);
      });
    }
  }

  /* Hook float keyboard */
  function hookKb() {
    var K = window.__mgFloatKb;
    if (!K || K._beatsHooked) return;
    K._beatsHooked = true;
    /* wrap via polling buffer changes is weak; patch press via event on keys */
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
    log(VER + " · keyboard beats hooked");
  }

  setTimeout(hookKb, 500);
  setTimeout(hookKb, 1500);

  function setOpen(on) {
    open = !!on;
    if (open) {
      ensureUi();
      strip.classList.remove("hidden");
      paint();
    } else if (strip) strip.classList.add("hidden");
  }

  window.__mgKeyboardBeats = {
    ver: VER,
    onKey: onKey,
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
    attempts: function () {
      return attempts;
    },
    hits: function () {
      return hits;
    },
    beats: beats,
    report: function () {
      return (
        VER +
        " bpm=" +
        bpm +
        " att=" +
        attempts +
        " hit=" +
        hits +
        " acc=" +
        (attempts ? (hits / attempts).toFixed(2) : "0")
      );
    },
  };
  log(VER + " · qbpm/piano-buddy style attempts");
})();
