/**
 * Top-left walkie dock for Architecture Lab:
 *  - Glyph pins rail (25² listener tiles)
 *  - Walkie burst orb (hold / space to TX)
 * Demo mode when mesh hub is offline; optional cam when permitted.
 */
(function () {
  "use strict";

  const N = 25;

  const state = {
    focus: "__you__",
    locked: "",
    tx: false,
    peers: new Map(),
    stream: null,
    video: null,
    sampleCanvas: null,
    sampleCtx: null,
    raf: 0,
    /** Pins only animate when multi-device collaboration is active (overview-style). */
    collab: false,
    roster: [],
    camOn: false,
    /** Mic waveform (walkie TX / listen) */
    audioStream: null,
    audioCtx: null,
    audioAnalyser: null,
    freqData: null,
    audioLevel: 0,
    audioWanted: false,
    /** Siri-style floating burst */
    siri: {
      visible: true,
      hover: false,
      pinned: false,
      dragging: false,
      expanded: false,
      ox: 0,
      oy: 0,
      startX: 0,
      startY: 0,
      moved: false,
    },
  };

  function el(id) {
    return document.getElementById(id);
  }

  function emptyLum() {
    return new Float32Array(N * N);
  }

  function paintGlyph(canvas, lum, opts) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const cell = Math.max(1, Math.floor(Math.min(w, h) / N));
    const hot = opts && opts.hot;
    const focus = opts && opts.focus;
    const locked = opts && opts.locked;
    ctx.fillStyle = "#050508";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        let L = lum[y * N + x] || 0;
        if (L > 1) L /= 255;
        L = Math.max(0, Math.min(1, L));
        let r = L * 0.72;
        let g = L * 0.82;
        let b = L * 0.95 + 0.08;
        if (focus) {
          r = r * 0.75 + 0.12;
          g = g * 0.85 + 0.18;
          b = b * 0.7 + 0.35;
        } else if (locked) {
          r = r * 0.7 + 0.28;
          g = g * 0.65 + 0.12;
          b = b * 0.75 + 0.32;
        } else if (hot) {
          r = r * 0.7 + 0.35;
          g = g * 0.55 + 0.08;
          b = b * 0.55 + 0.08;
        }
        const rr = Math.round(Math.min(1, r) * 255);
        const gg = Math.round(Math.min(1, g) * 255);
        const bb = Math.round(Math.min(1, b) * 255);
        ctx.fillStyle = "rgb(" + rr + "," + gg + "," + bb + ")";
        ctx.fillRect(x * cell, y * cell, cell - 0.5, cell - 0.5);
      }
    }
  }

  function synthFace(lum, t, talking) {
    // soft radial face + mouth when talking
    const cx = (N - 1) / 2;
    const cy = (N - 1) / 2 - 1;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const dx = (x - cx) / (N * 0.42);
        const dy = (y - cy) / (N * 0.48);
        let L = Math.exp(-(dx * dx + dy * dy) * 1.4) * 0.55;
        // eyes
        const e1 = Math.exp(-((x - 9) ** 2 + (y - 10) ** 2) / 2.2) * 0.35;
        const e2 = Math.exp(-((x - 15) ** 2 + (y - 10) ** 2) / 2.2) * 0.35;
        L += e1 + e2;
        if (talking) {
          const mouth =
            Math.exp(-((x - cx) ** 2) / 8 - ((y - 16) ** 2) / (2 + Math.sin(t * 0.02) * 3)) *
            (0.25 + 0.2 * Math.abs(Math.sin(t * 0.015)));
          L += mouth;
        }
        // noise shimmer
        L += (Math.sin(x * 1.7 + t * 0.01) * Math.cos(y * 1.3 - t * 0.008) + 1) * 0.04;
        lum[y * N + x] = Math.max(0, Math.min(1, L));
      }
    }
  }

  function ensureSampleCanvas() {
    if (state.sampleCanvas && state.sampleCtx) return state.sampleCtx;
    const c = document.createElement("canvas");
    c.width = N;
    c.height = N;
    state.sampleCanvas = c;
    state.sampleCtx = c.getContext("2d", { willReadFrequently: true });
    return state.sampleCtx;
  }

  function sampleVideoToLum(lum) {
    const v = state.video;
    if (!v || !state.camOn) return false;
    if (v.readyState < 2 || v.videoWidth < 2) return false;
    const ctx = ensureSampleCanvas();
    if (!ctx) return false;
    // Center-crop + mirror so glyph matches selfie orb
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    ctx.save();
    ctx.clearRect(0, 0, N, N);
    ctx.translate(N, 0);
    ctx.scale(-1, 1);
    try {
      ctx.drawImage(v, sx, sy, side, side, 0, 0, N, N);
    } catch (_) {
      ctx.restore();
      return false;
    }
    ctx.restore();
    let data;
    try {
      data = ctx.getImageData(0, 0, N, N).data;
    } catch (_) {
      return false; // tainted / not ready
    }
    for (let i = 0; i < N * N; i++) {
      const o = i * 4;
      lum[i] = (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) / 255;
    }
    return true;
  }

  function setOrbCamUi(on) {
    state.camOn = !!on;
    ["burst-orb", "siri-burst-orb"].forEach((id) => {
      el(id)?.classList.toggle("cam-on", !!on);
    });
    // Mirror stream to Siri video if present
    const siriVid = el("siri-cam-video");
    if (siriVid) {
      if (on && state.stream) {
        if (siriVid.srcObject !== state.stream) {
          siriVid.srcObject = state.stream;
          siriVid.play().catch(() => {});
        }
      } else if (!on) {
        try {
          siriVid.srcObject = null;
        } catch (_) {}
      }
    }
    const slab = el("siri-orb-label");
    if (slab && !state.tx) slab.textContent = on ? "live" : "hey";
  }

  function ensureYou() {
    if (!state.peers.has("__you__")) {
      state.peers.set("__you__", {
        key: "__you__",
        nick: "you",
        isYou: true,
        lum: emptyLum(),
        talking: false,
        unread: 0,
      });
    }
  }

  /** Sync pin map from mesh roster — no fake peers when solo. */
  function syncRosterFromCollab(detail) {
    state.collab = !!(detail && detail.active);
    state.roster = (detail && detail.roster) || [];
    ensureYou();
    // drop peers not in roster (except you)
    const keep = new Set(["__you__"]);
    state.roster.forEach((r) => {
      if (r.self) return;
      const key = r.id || r.nick;
      if (!key) return;
      keep.add(key);
      if (!state.peers.has(key)) {
        state.peers.set(key, {
          key,
          nick: r.nick || key,
          isYou: false,
          lum: emptyLum(),
          talking: false,
          unread: 0,
        });
      } else {
        const p = state.peers.get(key);
        if (r.nick) p.nick = r.nick;
      }
    });
    Array.from(state.peers.keys()).forEach((k) => {
      if (!keep.has(k)) state.peers.delete(k);
    });
    if (!state.collab) {
      // solo: only you in map; pins UI stays gated/hidden by mesh-collab
      Array.from(state.peers.keys()).forEach((k) => {
        if (k !== "__you__") state.peers.delete(k);
      });
      state.focus = "__you__";
      state.locked = "";
    }
    if (state.collab) renderPins();
  }

  function renderPins() {
    const strip = el("glyph-pin-strip");
    if (!strip) return;
    if (!state.collab) {
      strip.innerHTML = "";
      return;
    }
    ensureYou();
    strip.innerHTML = "";
    for (const p of state.peers.values()) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gpin";
      if (p.key === state.focus) btn.classList.add("focus");
      if (p.key === state.locked) btn.classList.add("locked");
      if (p.talking) btn.classList.add("tx");
      btn.title = p.isYou ? "you" : p.nick;
      btn.dataset.key = p.key;

      const canvas = document.createElement("canvas");
      canvas.width = 44;
      canvas.height = 44;
      canvas.className = "gpin-canvas";
      paintGlyph(canvas, p.lum, {
        hot: p.talking,
        focus: p.key === state.focus,
        locked: p.key === state.locked,
      });

      const lab = document.createElement("span");
      lab.className = "gpin-nick";
      lab.textContent = p.isYou ? "you" : p.nick.slice(0, 8);

      btn.appendChild(canvas);
      btn.appendChild(lab);
      if (p.unread > 0) {
        const b = document.createElement("span");
        b.className = "gpin-badge";
        b.textContent = String(p.unread);
        btn.appendChild(b);
      }

      btn.addEventListener("click", () => {
        state.focus = p.key;
        p.unread = 0;
        updateFocusLabel();
        renderPins();
      });
      btn.addEventListener("dblclick", () => {
        if (p.isYou) {
          state.locked = "";
        } else {
          state.locked = state.locked === p.key ? "" : p.key;
        }
        updateFocusLabel();
        renderPins();
      });

      strip.appendChild(btn);
      p._canvas = canvas;
    }
    updateFocusLabel();
  }

  function updateFocusLabel() {
    const f = el("glyph-pin-focus");
    const h = el("glyph-pin-chat-hint");
    const st = el("glyph-pin-status");
    const p = state.peers.get(state.focus);
    const name = p ? (p.isYou ? "you" : p.nick) : "you";
    if (f) f.textContent = name;
    if (h) {
      if (state.locked) {
        const lp = state.peers.get(state.locked);
        h.hidden = false;
        h.textContent = "lock @" + (lp ? lp.nick : state.locked);
      } else {
        h.hidden = true;
        h.textContent = "";
      }
    }
    if (st) {
      st.textContent =
        state.peers.size +
        " pin" +
        (state.peers.size === 1 ? "" : "s") +
        " · tap focus · dbl lock";
    }
  }

  function setTx(on) {
    state.tx = !!on;
    ["burst-orb", "siri-burst-orb"].forEach((id) => {
      el(id)?.classList.toggle("tx", state.tx);
    });
    const lab = el("orb-label");
    const slab = el("siri-orb-label");
    if (lab) lab.textContent = state.tx ? "TX" : "hold";
    if (slab) slab.textContent = state.tx ? "TX" : state.camOn ? "live" : "hey";
    const meta = el("burst-meta");
    if (meta) {
      meta.innerHTML = state.tx
        ? "<em>burst TX</em> · walkie"
        : state.camOn
          ? "<em>cam on</em> · walkie burst"
          : "idle · walkie burst";
    }
    const sstat = el("siri-burst-status");
    if (sstat) {
      sstat.innerHTML = state.tx
        ? "<em>transmitting</em> · release to end"
        : state.camOn
          ? "<em>cam live</em> · hold to talk"
          : "Grok walkie · hold to talk";
    }
    const you = state.peers.get("__you__");
    if (you) you.talking = state.tx;
    const dock = el("siri-burst");
    if (dock) dock.dataset.mode = state.tx ? "tx" : state.camOn ? "cam" : "idle";
    // Mic waveform while walkie TX (and keep if Listen already owns mic)
    if (state.tx) {
      state.audioWanted = true;
      ensureWalkieAudio();
    } else {
      state.audioWanted = document.body.classList.contains("listen-active");
      if (!state.audioWanted) stopWalkieAudio();
    }
  }

  /** Real mic → frequency bins for ring waveform (walkie mode). */
  async function ensureWalkieAudio() {
    if (state.audioAnalyser) {
      if (state.audioCtx && state.audioCtx.state === "suspended") {
        try {
          await state.audioCtx.resume();
        } catch (_) {}
      }
      return;
    }
    // Prefer shared analyser from Listen mode if present
    if (window.__labVoiceAnalyser && window.__labVoiceBins) {
      state.audioAnalyser = window.__labVoiceAnalyser;
      state.freqData = window.__labVoiceBins;
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      state.audioStream = stream;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      state.audioCtx = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.62;
      src.connect(analyser);
      state.audioAnalyser = analyser;
      state.freqData = new Uint8Array(analyser.frequencyBinCount);
      if (ctx.state === "suspended") await ctx.resume();
    } catch (e) {
      console.warn("[walkie] mic waveform", e);
    }
  }

  function stopWalkieAudio() {
    // Don't kill Listen's analyser
    if (state.audioAnalyser && state.audioAnalyser === window.__labVoiceAnalyser) {
      state.audioAnalyser = null;
      state.freqData = null;
      state.audioLevel = 0;
      return;
    }
    if (state.audioStream) {
      try {
        state.audioStream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      state.audioStream = null;
    }
    if (state.audioCtx) {
      try {
        state.audioCtx.close();
      } catch (_) {}
      state.audioCtx = null;
    }
    state.audioAnalyser = null;
    state.freqData = null;
    state.audioLevel = 0;
  }

  function sampleWalkieAudio() {
    // Sync from Listen when it is driving mic
    if (window.__labVoiceAnalyser && window.__labVoiceBins) {
      if (state.audioAnalyser !== window.__labVoiceAnalyser) {
        state.audioAnalyser = window.__labVoiceAnalyser;
        state.freqData = window.__labVoiceBins;
      }
    }
    if (!state.audioAnalyser || !state.freqData) {
      // soft idle pulse when no mic
      return state.audioLevel * 0.9;
    }
    try {
      state.audioAnalyser.getByteFrequencyData(state.freqData);
    } catch (_) {
      return state.audioLevel;
    }
    let sum = 0;
    const n = state.freqData.length;
    for (let i = 0; i < n; i++) sum += state.freqData[i];
    const avg = sum / n / 255;
    // speech band
    let mid = 0;
    const a = Math.floor(n * 0.08);
    const b = Math.floor(n * 0.5);
    for (let i = a; i < b; i++) mid += state.freqData[i];
    mid = mid / Math.max(1, b - a) / 255;
    const level = Math.min(1, Math.pow(Math.max(avg, mid * 1.3), 0.8) * 1.55);
    state.audioLevel = state.audioLevel * 0.35 + level * 0.65;
    window.__labWalkieLevel = state.audioLevel;
    applyWalkieLevelBars(state.audioLevel);
    return state.audioLevel;
  }

  function applyWalkieLevelBars(level) {
    const bars = el("voice-level");
    if (!bars) return;
    // Only drive bars when walkie TX and Listen is not already animating
    if (!state.tx && !document.body.classList.contains("listen-active")) return;
    if (document.body.classList.contains("listen-active") && !state.tx) return;
    const kids = bars.querySelectorAll("i");
    kids.forEach((node, i) => {
      const thr = (i + 1) / (kids.length + 0.5);
      node.classList.toggle("on", level > thr * 0.2);
      node.style.setProperty("--h", String(0.22 + level * (0.45 + i * 0.07)));
    });
  }

  function paintRing(canvas, t) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H / 2;
    const r0 = Math.min(W, H) * 0.42;
    const listen = document.body.classList.contains("listen-active");
    const talking = document.body.classList.contains("voice-talking");
    const level = sampleWalkieAudio();
    const hot = state.tx || talking || (listen && level > 0.06);

    // Base pulse rings
    for (let i = 0; i < 3; i++) {
      const pulse =
        1 +
        level * 0.14 +
        (state.tx ? 0.06 * Math.sin(t * 0.03 + i) : 0) +
        (talking ? 0.04 * Math.sin(t * 0.04 + i * 0.7) : 0);
      ctx.beginPath();
      ctx.arc(cx, cy, r0 * pulse - i * 6, 0, Math.PI * 2);
      if (state.tx) {
        ctx.strokeStyle = "rgba(248,113,113," + (0.38 - i * 0.09) + ")";
      } else if (talking || level > 0.12) {
        ctx.strokeStyle = "rgba(110,203,255," + (0.38 - i * 0.08) + ")";
      } else if (listen) {
        ctx.strokeStyle = "rgba(74,222,128," + (0.26 - i * 0.05) + ")";
      } else {
        ctx.strokeStyle = "rgba(110,203,255," + (0.2 - i * 0.04) + ")";
      }
      ctx.lineWidth = 1.5 + (hot ? 0.6 : 0) + level * 1.2;
      ctx.stroke();
    }

    // Sound waveform spokes (reacts to mic like walkie TX)
    const bins = state.freqData;
    const nSpokes = bins && bins.length ? Math.min(56, bins.length) : 32;
    for (let i = 0; i < nSpokes; i++) {
      const ang = (i / nSpokes) * Math.PI * 2 - Math.PI / 2;
      let v;
      if (bins && bins.length) {
        v = bins[Math.floor((i / nSpokes) * bins.length)] / 255;
      } else {
        // gentle idle shimmer
        v = 0.08 + 0.04 * Math.sin(t * 0.008 + i * 0.45);
      }
      if (state.tx) v = Math.min(1, v * 1.35 + level * 0.25);
      else if (listen || talking) v = Math.min(1, v * 1.1 + level * 0.2);
      else v *= 0.35;

      const inner = r0 * 0.88;
      const outer = inner + (6 + v * (22 + level * 18));
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      ctx.beginPath();
      ctx.moveTo(cx + cos * inner, cy + sin * inner);
      ctx.lineTo(cx + cos * outer, cy + sin * outer);
      if (state.tx) {
        ctx.strokeStyle = "rgba(248,113,113," + (0.25 + v * 0.55) + ")";
      } else if (talking || level > 0.1) {
        ctx.strokeStyle = "rgba(110,203,255," + (0.2 + v * 0.55) + ")";
      } else if (listen) {
        ctx.strokeStyle = "rgba(74,222,128," + (0.15 + v * 0.45) + ")";
      } else {
        ctx.strokeStyle = "rgba(110,203,255," + (0.08 + v * 0.2) + ")";
      }
      ctx.lineWidth = 1.5 + v * 1.8;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }

  function tick(t) {
    ensureYou();
    // Keep waveform live while Listen or TX wants audio
    if (
      state.tx ||
      document.body.classList.contains("listen-active") ||
      document.body.classList.contains("voice-talking")
    ) {
      if (!state.audioAnalyser && !window.__labVoiceAnalyser) {
        // lazy attach — non-blocking
        if (!state._audioKick) {
          state._audioKick = true;
          ensureWalkieAudio().finally(() => {
            state._audioKick = false;
          });
        }
      }
    }
    const you = state.peers.get("__you__");
    if (you) {
      const gotCam = sampleVideoToLum(you.lum);
      if (!gotCam) {
        // only spend synth cycles when TX/cam — keep logo clean when idle
        if (state.tx || state.camOn) synthFace(you.lum, t, state.tx);
      }
      // Peer glyphs only when collaborating with other devices
      if (state.collab) {
        for (const p of state.peers.values()) {
          if (p.isYou) continue;
          const phase = t * 0.008 + (p.nick || "").length;
          p.talking = Math.sin(phase) > 0.92;
          synthFace(p.lum, t + (p.nick || "x").charCodeAt(0) * 40, p.talking);
        }
      }
    }

    // paint pins only while collab UI is live
    if (state.collab) {
      for (const p of state.peers.values()) {
        if (p._canvas) {
          paintGlyph(p._canvas, p.lum, {
            hot: p.talking,
            focus: p.key === state.focus,
            locked: p.key === state.locked,
          });
        }
      }
    }

    // face canvases — sidebar + Siri float
    const showFace = !!(state.camOn || state.tx);
    ["face-canvas", "siri-face-canvas"].forEach((id) => {
      const face = el(id);
      if (!face || !you) return;
      if (showFace) paintGlyph(face, you.lum, { hot: state.tx });
      if (!showFace) face.style.opacity = "0";
      else face.style.opacity = "";
    });

    paintRing(el("ring-canvas"), t);
    paintRing(el("siri-ring-canvas"), t);

    updateFocusLabel();
    state.raf = requestAnimationFrame(tick);
  }

  function setCamMeta(html) {
    const meta = el("burst-meta");
    if (meta) meta.innerHTML = html;
  }

  function setCamBtn(label, title) {
    const btn = el("btn-cam");
    if (!btn) return;
    btn.textContent = label;
    if (title) btn.title = title;
  }

  function getCamVideoEl() {
    // Prefer in-orb video so the user actually *sees* the camera
    let v = el("burst-cam-video");
    if (!v) {
      v = document.createElement("video");
      v.id = "burst-cam-video";
      v.className = "orb-cam";
      v.setAttribute("playsinline", "true");
      v.playsInline = true;
      v.muted = true;
      v.autoplay = true;
      const orb = el("burst-orb");
      if (orb) orb.insertBefore(v, orb.querySelector(".ring") || null);
    }
    v.playsInline = true;
    v.setAttribute("playsinline", "true");
    v.setAttribute("webkit-playsinline", "true");
    v.muted = true;
    v.defaultMuted = true;
    v.autoplay = true;
    return v;
  }

  function stopCam() {
    if (state.stream) {
      try {
        state.stream.getTracks().forEach((t) => {
          try {
            t.onended = null;
            t.stop();
          } catch (_) {}
        });
      } catch (_) {}
      state.stream = null;
    }
    const v = state.video || el("burst-cam-video");
    if (v) {
      try {
        v.pause();
      } catch (_) {}
      try {
        v.srcObject = null;
      } catch (_) {}
    }
    state.video = v || null;
    setOrbCamUi(false);
    const btn = el("btn-cam");
    if (btn) btn.classList.remove("primary", "active");
  }

  async function requestCamStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error("getUserMedia unavailable");
      err.name = "NotSupportedError";
      throw err;
    }
    // Progressive constraints — avoid over-constraining FaceTime/Continuity/macOS.
    const tries = [
      {
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: false,
      },
      { video: { facingMode: "user" }, audio: false },
      { video: { width: { ideal: 320 }, height: { ideal: 240 } }, audio: false },
      { video: true, audio: false },
    ];
    let last = null;
    for (const c of tries) {
      try {
        return await navigator.mediaDevices.getUserMedia(c);
      } catch (e) {
        last = e;
      }
    }
    throw last || new Error("camera failed");
  }

  function camErrorMessage(err) {
    const name = (err && err.name) || "";
    const msg = (err && err.message) || String(err || "");
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return {
        short: "cam blocked",
        tip: "Allow Camera for this site (lock icon) → Cam again",
      };
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return { short: "no camera", tip: "No video device found" };
    }
    if (
      name === "NotReadableError" ||
      name === "TrackStartError" ||
      /busy|in use|Could not start/i.test(msg)
    ) {
      return {
        short: "cam busy",
        tip: "Quit apps using the camera (Photo Booth / gy ffmpeg / Zoom) then Cam again",
      };
    }
    if (name === "NotSupportedError" || (!window.isSecureContext && !isLocalHost())) {
      return {
        short: "cam unavailable",
        tip: "Use http://127.0.0.1:8765 (not file://)",
      };
    }
    if (name === "OverconstrainedError") {
      return { short: "cam constraints", tip: "Retry Cam — softer constraints" };
    }
    if (name === "AbortError") {
      return { short: "cam aborted", tip: "Try Cam again" };
    }
    return { short: "cam error", tip: name || msg || "unknown" };
  }

  function isLocalHost() {
    const h = location.hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  }

  function openWalkieSection() {
    const sec = el("sb-sec-walkie");
    if (sec) sec.open = true;
  }

  function waitVideoReady(video, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        resolve();
        return;
      }
      const t = setTimeout(() => {
        cleanup();
        // still resolve if we have a stream — some browsers lag dimensions
        if (video.srcObject) resolve();
        else reject(new Error("camera timeout"));
      }, timeoutMs || 6000);
      function ok() {
        cleanup();
        resolve();
      }
      function cleanup() {
        clearTimeout(t);
        video.removeEventListener("loadeddata", ok);
        video.removeEventListener("loadedmetadata", ok);
        video.removeEventListener("playing", ok);
        video.removeEventListener("error", onErr);
      }
      function onErr() {
        cleanup();
        reject(new Error("video element error"));
      }
      video.addEventListener("loadeddata", ok);
      video.addEventListener("loadedmetadata", ok);
      video.addEventListener("playing", ok);
      video.addEventListener("error", onErr);
    });
  }

  async function enableCam() {
    const btn = el("btn-cam");
    openWalkieSection();

    // Toggle off if already on
    if (state.stream || state.camOn) {
      stopCam();
      setCamMeta("idle · walkie burst");
      setCamBtn("Cam", "Enable camera in burst orb");
      const lab = el("orb-label");
      if (lab && !state.tx) lab.textContent = "hold";
      return;
    }

    if (!window.isSecureContext && !isLocalHost()) {
      const m = camErrorMessage({ name: "NotSupportedError" });
      setCamMeta(m.short);
      setCamBtn("Cam", m.tip);
      return;
    }

    setCamBtn("…", "Requesting camera…");
    setCamMeta("<em>requesting cam…</em>");
    const lab = el("orb-label");
    if (lab) lab.textContent = "cam…";

    try {
      const stream = await requestCamStream();
      const video = getCamVideoEl();
      state.video = video;
      state.stream = stream;

      // When OS revokes / device unplugged
      stream.getVideoTracks().forEach((tr) => {
        tr.onended = () => {
          if (state.stream === stream) {
            stopCam();
            setCamMeta("cam ended · idle");
            setCamBtn("Cam", "Enable camera in burst orb");
          }
        };
      });

      video.srcObject = stream;
      // Ensure playback (autoplay policies)
      try {
        await video.play();
      } catch (playErr) {
        // retry once after metadata
        await waitVideoReady(video, 4000);
        await video.play();
      }
      await waitVideoReady(video, 5000);

      setOrbCamUi(true);
      setCamMeta("<em>cam on</em> · live in orb · hold to burst");
      setCamBtn("Cam on", "Click to stop camera");
      if (btn) btn.classList.add("primary", "active");
      if (lab) lab.textContent = "live";

      // Kick first glyph sample
      ensureYou();
      const you = state.peers.get("__you__");
      if (you) sampleVideoToLum(you.lum);
    } catch (err) {
      stopCam();
      const m = camErrorMessage(err);
      setCamMeta(m.short + (m.tip ? " · " + m.tip.split("→")[0].trim() : ""));
      setCamBtn("Cam", m.tip);
      if (btn) btn.classList.remove("primary", "active");
      if (lab) lab.textContent = "hold";
      console.warn("[walkie-dock] camera:", err && err.name, err && err.message, err);
    }
  }

  function cycle(delta) {
    const keys = Array.from(state.peers.keys());
    if (!keys.length) return;
    let i = keys.indexOf(state.focus);
    if (i < 0) i = 0;
    i = (i + delta + keys.length) % keys.length;
    state.focus = keys[i];
    const p = state.peers.get(state.focus);
    if (p) p.unread = 0;
    renderPins();
  }

  /* ── Siri-style floating burst (default: page center) ─ */
  const SIRI_POS_KEY = "lab.siriBurst.pos.v2";
  const SIRI_HIDE_KEY = "lab.siriBurst.hidden.v1";

  function siriDock() {
    return el("siri-burst");
  }

  function loadSiriPos() {
    try {
      return JSON.parse(localStorage.getItem(SIRI_POS_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveSiriPos(payload) {
    try {
      localStorage.setItem(SIRI_POS_KEY, JSON.stringify(payload));
    } catch (_) {}
  }

  /** Center of viewport (default). */
  function centerSiriBurst() {
    const dock = siriDock();
    if (!dock) return;
    dock.classList.remove("siri-positioned");
    dock.style.left = "50%";
    dock.style.top = "50%";
    dock.style.right = "auto";
    dock.style.bottom = "auto";
    dock.style.transform = "translate(-50%, -50%)";
    saveSiriPos({ mode: "center" });
    state.siri.mode = "center";
  }

  /** Position by top-left pixel coords of the dock box. */
  function applySiriPos(left, top) {
    const dock = siriDock();
    if (!dock) return;
    const w = dock.offsetWidth || 72;
    const h = dock.offsetHeight || 72;
    const maxL = Math.max(8, window.innerWidth - w - 8);
    const maxT = Math.max(8, window.innerHeight - h - 8);
    left = Math.max(8, Math.min(maxL, left));
    top = Math.max(8, Math.min(maxT, top));
    dock.classList.add("siri-positioned");
    dock.style.left = left + "px";
    dock.style.top = top + "px";
    dock.style.right = "auto";
    dock.style.bottom = "auto";
    dock.style.transform = "none";
    saveSiriPos({ mode: "xy", left: left, top: top });
    state.siri.mode = "xy";
    state.siri.left = left;
    state.siri.top = top;
  }

  function setSiriVisible(show) {
    const dock = siriDock();
    if (!dock) return;
    state.siri.visible = !!show;
    dock.classList.toggle("siri-hidden", !show);
    const peek = el("siri-burst-peek");
    if (peek) peek.hidden = !!show;
    try {
      localStorage.setItem(SIRI_HIDE_KEY, show ? "0" : "1");
    } catch (_) {}
  }

  function setSiriHover(on) {
    const dock = siriDock();
    if (!dock) return;
    state.siri.hover = !!on;
    dock.classList.toggle("siri-hover", !!on);
  }

  function setSiriExpanded(on) {
    const dock = siriDock();
    if (!dock) return;
    state.siri.expanded = !!on;
    dock.classList.toggle("siri-expanded", !!on);
    dock.classList.toggle("siri-pinned", !!on);
  }

  function wireSiriBurst() {
    const dock = siriDock();
    const orb = el("siri-burst-orb");
    if (!dock || !orb) return;

    // Default: center of page. Restore saved xy if user moved it.
    const pos = loadSiriPos();
    if (pos && pos.mode === "xy" && typeof pos.left === "number") {
      applySiriPos(pos.left, pos.top);
    } else {
      centerSiriBurst();
    }
    if (localStorage.getItem(SIRI_HIDE_KEY) === "1") {
      setSiriVisible(false);
    } else {
      setSiriVisible(true);
    }

    // Rename dock control to Center
    const dockBtn = el("siri-btn-dock");
    if (dockBtn) {
      dockBtn.textContent = "Center";
      dockBtn.title = "Snap to center of page";
    }

    const hold = () => setTx(true);
    const release = () => setTx(false);

    // Hover expand (Siri-like)
    dock.addEventListener("pointerenter", () => {
      if (!state.siri.dragging) setSiriHover(true);
    });
    dock.addEventListener("pointerleave", () => {
      if (!state.siri.pinned && !state.tx) setSiriHover(false);
    });

    // Drag to move · short press+hold = TX (if little movement)
    orb.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      orb.setPointerCapture(e.pointerId);
      state.siri.dragging = false;
      state.siri.moved = false;
      state.siri.startX = e.clientX;
      state.siri.startY = e.clientY;
      const rect = dock.getBoundingClientRect();
      state.siri.ox = rect.left;
      state.siri.oy = rect.top;
      state.siri._txTimer = setTimeout(() => {
        if (!state.siri.moved) hold();
      }, 160);
    });

    orb.addEventListener("pointermove", (e) => {
      if (e.buttons === 0 && !state.siri.dragging) return;
      const dx = e.clientX - state.siri.startX;
      const dy = e.clientY - state.siri.startY;
      if (!state.siri.moved && dx * dx + dy * dy > 36) {
        state.siri.moved = true;
        state.siri.dragging = true;
        dock.classList.add("siri-dragging");
        clearTimeout(state.siri._txTimer);
        if (state.tx) release();
      }
      if (state.siri.dragging) {
        applySiriPos(state.siri.ox + dx, state.siri.oy + dy);
      }
    });

    function endPointer() {
      clearTimeout(state.siri._txTimer);
      dock.classList.remove("siri-dragging");
      if (state.siri.dragging) {
        state.siri.dragging = false;
        state.siri.moved = false;
        return;
      }
      if (state.tx) release();
      state.siri.moved = false;
    }

    orb.addEventListener("pointerup", endPointer);
    orb.addEventListener("pointercancel", endPointer);

    orb.addEventListener("dblclick", (e) => {
      e.preventDefault();
      setSiriExpanded(!state.siri.expanded);
    });

    el("siri-btn-hold")?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      hold();
    });
    el("siri-btn-hold")?.addEventListener("pointerup", release);
    el("siri-btn-hold")?.addEventListener("pointerleave", release);

    el("siri-btn-cam")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      enableCam();
    });

    el("siri-btn-listen")?.addEventListener("click", (e) => {
      e.preventDefault();
      window.LabGrokListen?.toggle?.();
    });

    el("siri-btn-dock")?.addEventListener("click", (e) => {
      e.preventDefault();
      centerSiriBurst();
      setSiriExpanded(false);
    });

    el("siri-btn-hide")?.addEventListener("click", (e) => {
      e.preventDefault();
      setSiriVisible(false);
    });

    el("siri-burst-peek")?.addEventListener("click", () => {
      setSiriVisible(true);
      centerSiriBurst();
    });
    el("btn-siri-burst")?.addEventListener("click", () => {
      setSiriVisible(true);
      centerSiriBurst();
      setSiriExpanded(true);
      setSiriHover(true);
    });

    window.addEventListener("lab:siri-burst", () => {
      setSiriVisible(true);
      centerSiriBurst();
      setSiriExpanded(true);
    });

    window.addEventListener("resize", () => {
      if (state.siri.mode === "center") centerSiriBurst();
    });
  }

  function bindOrbPtt(orbEl, hold, release) {
    if (!orbEl) return;
    orbEl.addEventListener("pointerdown", (e) => {
      // sidebar orb: simple hold (not drag)
      if (orbEl.id === "siri-burst-orb") return;
      e.preventDefault();
      orbEl.setPointerCapture(e.pointerId);
      hold();
    });
    orbEl.addEventListener("pointerup", release);
    orbEl.addEventListener("pointercancel", release);
    orbEl.addEventListener("pointerleave", () => {
      if (state.tx && orbEl.id !== "siri-burst-orb") release();
    });
  }

  function bind() {
    // Burst lives in #walkie-dock; pins may live in topbar #glyph-pin-rail only.
    if (!el("burst-orb") && !el("glyph-pin-strip") && !el("siri-burst")) return;

    ensureYou();
    window.addEventListener("lab:collab", (e) => {
      syncRosterFromCollab(e.detail || {});
    });

    const hold = () => setTx(true);
    const release = () => setTx(false);

    bindOrbPtt(el("burst-orb"), hold, release);
    wireSiriBurst();

    el("btn-hold")?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      hold();
    });
    el("btn-hold")?.addEventListener("pointerup", release);
    el("btn-hold")?.addEventListener("pointerleave", release);
    el("btn-cam")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      enableCam();
    });
    el("glyph-pin-prev")?.addEventListener("click", () => cycle(-1));
    el("glyph-pin-next")?.addEventListener("click", () => cycle(1));
    el("glyph-pin-btn")?.addEventListener("click", () => {
      const p = state.peers.get(state.focus);
      if (!p || p.isYou) {
        state.locked = "";
      } else {
        state.locked = state.locked === p.key ? "" : p.key;
      }
      updateFocusLabel();
      renderPins();
    });

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !e.repeat && e.target === document.body) {
        e.preventDefault();
        hold();
      }
      if (e.key === ",") cycle(-1);
      if (e.key === ".") cycle(1);
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") release();
    });

    window.addEventListener("lab:walkie-cam", () => {
      if (!state.camOn) enableCam();
    });
    window.addEventListener("lab:walkie-cam-off", () => {
      if (state.camOn) stopCam();
    });

    window.LabWalkie = {
      enableCam,
      stopCam,
      isCamOn: () => !!state.camOn,
      setTx,
      showSiri: () => setSiriVisible(true),
      hideSiri: () => setSiriVisible(false),
      expandSiri: () => setSiriExpanded(true),
      centerSiri: () => centerSiriBurst(),
    };

    state.raf = requestAnimationFrame(tick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
