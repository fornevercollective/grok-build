/**
 * Chat vision playpen — camera · nested movable pins · persona · AIto ·
 * movement-study GIFs · searchable MOCAP face-study feed (X compose).
 *
 * Pins nest close behind/near the main orb; drag to reflow.
 * Studies: short cam motion → flipbook “gif” pins that drift small off the stage.
 */
(function (global) {
  "use strict";

  const LS_PERSONA = "lab.chat.persona.v1";
  const LS_PEERS = "lab.chat.peers.v1";
  const LS_PIN_POS = "lab.chat.pinPos.v2";
  const LS_STUDIES = "lab.chat.mocapStudies.v1";
  const AITO_DEFAULT = "http://127.0.0.1:8766";
  const MAX_STUDIES = 48;
  const STUDY_FRAMES = 12;
  const STUDY_INTERVAL_MS = 90;
  const STUDY_SIZE = 72;

  /** Default nest: close behind/around main orb (percent of rail) */
  const NEST = {
    self: { x: 78, y: 72, z: 3, hue: 195 },
    aito: { x: 22, y: 70, z: 2, hue: 175 },
    stream: { x: 86, y: 28, z: 2, hue: 280 },
    "peer-a": { x: 14, y: 30, z: 2, hue: 32 },
    "peer-b": { x: 50, y: 12, z: 1, hue: 200 },
  };

  /** @type {MediaStream|null} */
  let mainStream = null;
  /** @type {Map<string, {id:string,el:HTMLElement,video:HTMLVideoElement,kind:string,label:string}>} */
  const pins = new Map();
  let aitoOk = false;
  let sampleTimer = 0;
  let recoverBusy = false;
  let studyBusy = false;
  let selectedStudyId = null;
  /** @type {Map<string, number>} */
  const studyAnimTimers = new Map();
  /** Stream pin low-res pipe */
  let streamPinHls = null;
  let streamPinPlay = "";
  let streamPinPoll = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function aitoBase() {
    return (global.LAB_AITO_URL || AITO_DEFAULT).replace(/\/$/, "");
  }

  function loadJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "") || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  function loadPersona() {
    return loadJson(LS_PERSONA, {
      id: "you",
      name: "You",
      traits: [],
      notes: [],
      samples: 0,
      lum: { r: 110, g: 203, b: 255 },
      updatedAt: 0,
    });
  }

  function savePersona(p) {
    p.updatedAt = Date.now();
    saveJson(LS_PERSONA, p);
    renderPersonaChip(p);
    // Mirror to host for Grok/playpen
    fetch("/api/persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    }).catch(() => {});
  }

  function renderPersonaChip(p) {
    const el = $("persona-chip");
    if (!el) return;
    const traits = (p.traits || []).slice(0, 4).join(" · ") || "learning…";
    el.innerHTML =
      '<span class="pc-dot" style="background:rgb(' +
      (p.lum?.r || 110) +
      "," +
      (p.lum?.g || 203) +
      "," +
      (p.lum?.b || 255) +
      ')"></span>' +
      '<span class="pc-name">' +
      escapeHtml(p.name || "You") +
      "</span>" +
      '<span class="pc-traits">' +
      escapeHtml(traits) +
      "</span>" +
      '<span class="pc-n">' +
      (p.samples || 0) +
      " samples</span>";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function setReadout(kind, text, cls) {
    if (kind === "heard") {
      const el = $("voice-heard");
      if (el) {
        el.textContent = text;
        el.className = "voice-heard" + (cls ? " " + cls : "");
      }
    } else if (kind === "intent") {
      const el = $("voice-intent");
      if (el) {
        el.textContent = text;
        el.className = "voice-intent" + (cls ? " " + cls : "");
      }
    } else if (kind === "status") {
      const el = $("siri-burst-status");
      if (el) el.innerHTML = text;
    }
    // Dialogue strip under controls
    const dlg = $("chat-dialogue");
    if (dlg && kind === "dialogue") {
      const line = document.createElement("div");
      line.className = "dlg-line " + (cls || "");
      line.innerHTML =
        '<span class="dlg-who">' +
        escapeHtml(cls === "you" ? "you" : cls === "lab" ? "lab" : "sys") +
        "</span> " +
        escapeHtml(text);
      dlg.appendChild(line);
      while (dlg.children.length > 24) dlg.removeChild(dlg.firstChild);
      dlg.scrollTop = dlg.scrollHeight;
    }
  }

  function setCamBtn(on) {
    const btn = $("siri-btn-cam") || $("btn-cam");
    if (!btn) return;
    btn.textContent = on ? "Cam on" : "Cam";
    btn.classList.toggle("active", !!on);
    btn.classList.toggle("primary", !!on);
    btn.title = on ? "Close camera" : "Open camera";
  }

  async function requestCam() {
    // Secure context: https or http://localhost / 127.0.0.1 only
    if (!window.isSecureContext) {
      throw Object.assign(
        new Error(
          "Camera needs a secure context — open via http://127.0.0.1 (Lab host), not file://"
        ),
        { name: "SecurityError" }
      );
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error("getUserMedia unavailable in this webview"), {
        name: "NotSupportedError",
      });
    }
    // Soft probe permission state (Chrome); ignore if unsupported
    try {
      if (navigator.permissions?.query) {
        const st = await navigator.permissions.query({ name: "camera" });
        if (st && st.state === "denied") {
          throw Object.assign(
            new Error("Camera permission denied for this app"),
            { name: "NotAllowedError" }
          );
        }
      }
    } catch (e) {
      if (e && e.name === "NotAllowedError") throw e;
    }
    const tries = [
      { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
      { video: { facingMode: "user" }, audio: false },
      { video: { facingMode: "environment" }, audio: false },
      { video: true, audio: false },
    ];
    let last;
    for (const c of tries) {
      try {
        return await navigator.mediaDevices.getUserMedia(c);
      } catch (e) {
        last = e;
      }
    }
    throw last || new Error("camera failed");
  }

  function stopMainCam() {
    if (mainStream) {
      mainStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });
      mainStream = null;
    }
    const v = $("siri-cam-video");
    if (v) {
      try {
        v.pause();
      } catch (_) {}
      try {
        v.srcObject = null;
      } catch (_) {}
    }
    const orb = $("siri-burst-orb");
    if (orb) orb.classList.remove("cam-on");
    setCamBtn(false);
    // Update self pin
    const pin = pins.get("self");
    if (pin?.video) {
      try {
        pin.video.srcObject = null;
      } catch (_) {}
    }
    setReadout("status", "camera off · hold orb to talk");
  }

  async function openMainCam() {
    setReadout("status", "<em>requesting camera…</em>");
    setCamBtn(false);
    const stream = await requestCam();
    mainStream = stream;
    const v = $("siri-cam-video");
    if (v) {
      v.srcObject = stream;
      v.muted = true;
      v.playsInline = true;
      try {
        await v.play();
      } catch (_) {}
    }
    const orb = $("siri-burst-orb");
    if (orb) orb.classList.add("cam-on");
    stream.getVideoTracks().forEach((tr) => {
      tr.onended = () => {
        if (mainStream === stream) stopMainCam();
      };
    });
    // Mirror into self pin bubble
    ensurePin("self", { kind: "self", label: "You", stream: stream });
    setCamBtn(true);
    setReadout("status", "<em>cam on</em> · hold orb to talk · pins live");
    setReadout("dialogue", "Camera open — learning your look", "lab");
    startSampling();
    probeAito();
  }

  async function toggleCam() {
    if (mainStream) {
      stopMainCam();
      setReadout("dialogue", "Camera closed", "lab");
      return { ok: true, on: false };
    }
    try {
      await openMainCam();
      return { ok: true, on: true };
    } catch (err) {
      stopMainCam();
      const tip = camTip(err);
      setReadout("status", tip.short);
      setReadout("dialogue", tip.tip, "lab");
      setReadout("intent", tip.short, "err");
      if (global.LabChat?.showError) global.LabChat.showError(tip.tip);
      return { ok: false, on: false, error: tip };
    }
  }

  function camTip(err) {
    const name = err?.name || "";
    const msg = String(err?.message || "");
    if (name === "NotAllowedError" || /not allowed by the user/i.test(msg)) {
      return {
        short: "cam not allowed",
        tip:
          "Camera blocked · System Settings → Privacy → Camera → enable Grok Build Lab · " +
          "then Cam again. Continuity: use Phone/GY cam feed chips if iPhone is the cam.",
      };
    }
    if (name === "SecurityError" || /secure context/i.test(msg)) {
      return {
        short: "cam insecure",
        tip: "Open Lab via http://127.0.0.1:… (native app / serve.sh), not file://",
      };
    }
    if (name === "NotFoundError")
      return {
        short: "no camera",
        tip: "No video device · plug UVC or enable Continuity Camera · try Phone feed chip",
      };
    if (name === "NotReadableError" || /busy|in use/i.test(msg))
      return {
        short: "cam busy",
        tip: "Quit Photo Booth / Zoom / FaceTime / ffmpeg holding the camera",
      };
    if (name === "NotSupportedError")
      return {
        short: "cam unsupported",
        tip: "This webview has no getUserMedia · use Stream → Phone / GY cam instead",
      };
    return {
      short: "cam error",
      tip: (name || "error") + (msg ? " · " + msg.slice(0, 80) : ""),
    };
  }

  function pinRail() {
    return $("chat-pin-rail");
  }

  function loadPinPos() {
    return loadJson(LS_PIN_POS, {});
  }

  function savePinPos(map) {
    saveJson(LS_PIN_POS, map);
  }

  function applyPinLayout(el, id, pos) {
    const nest = NEST[id] || { x: 50, y: 50, z: 2, hue: 200 };
    const p = pos || nest;
    el.style.setProperty("--pin-x", (p.x != null ? p.x : nest.x) + "%");
    el.style.setProperty("--pin-y", (p.y != null ? p.y : nest.y) + "%");
    el.style.setProperty("--pin-z", String(p.z != null ? p.z : nest.z));
    if (nest.hue != null) el.style.setProperty("--pin-hue", String(nest.hue));
  }

  function nestAllPins() {
    const map = {};
    Object.keys(NEST).forEach((id) => {
      map[id] = { ...NEST[id] };
      const pin = pins.get(id);
      if (pin) applyPinLayout(pin.el, id, map[id]);
    });
    // tuck study pins into a tight arc behind the main orb
    let i = 0;
    pins.forEach((pin, id) => {
      if (pin.kind !== "study") return;
      const ang = -40 + i * 18;
      const rad = 34;
      const x = 50 + Math.cos((ang * Math.PI) / 180) * rad;
      const y = 50 + Math.sin((ang * Math.PI) / 180) * rad * 0.85;
      map[id] = { x, y, z: 1 };
      applyPinLayout(pin.el, id, map[id]);
      i++;
    });
    savePinPos(map);
    setReadout("dialogue", "Pins nested near main orb · drag to move", "sys");
  }

  function bindPinDrag(el, id) {
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    const onDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      el.classList.add("dragging");
      el.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      const rail = pinRail();
      if (!rail) return;
      const r = rail.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      let x = ((e.clientX - r.left) / r.width) * 100;
      let y = ((e.clientY - r.top) / r.height) * 100;
      x = Math.max(4, Math.min(96, x));
      y = Math.max(4, Math.min(96, y));
      el.style.setProperty("--pin-x", x + "%");
      el.style.setProperty("--pin-y", y + "%");
      const map = loadPinPos();
      map[id] = { x, y, z: 5 };
      savePinPos(map);
    };
    const onUp = (e) => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("dragging");
      try {
        el.releasePointerCapture?.(e.pointerId);
      } catch (_) {}
      // if barely moved, treat as click
      if (!moved) el._pinClick?.();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("dblclick", (e) => {
      e.preventDefault();
      const map = loadPinPos();
      delete map[id];
      savePinPos(map);
      applyPinLayout(el, id, NEST[id]);
    });
  }

  function ensurePin(id, opts) {
    let pin = pins.get(id);
    const rail = pinRail();
    if (!rail) return null;
    if (!pin) {
      const el = document.createElement("button");
      el.type = "button";
      el.className =
        "chat-pin kind-" +
        (opts.kind || "peer") +
        (opts.kind === "study" ? " study" : "");
      el.dataset.pinId = id;
      el.title = (opts.label || id) + " · drag to move · double-click nest";
      if (opts.kind === "study") {
        el.innerHTML =
          '<img alt="" /><span class="pin-lab"></span><span class="pin-dot"></span>';
      } else {
        el.innerHTML =
          '<video playsinline muted autoplay></video><span class="pin-lab"></span><span class="pin-dot"></span>';
      }
      rail.appendChild(el);
      const video = el.querySelector("video");
      pin = {
        id: id,
        el: el,
        video: video,
        kind: opts.kind || "peer",
        label: opts.label || id,
      };
      pins.set(id, pin);
      const posMap = loadPinPos();
      applyPinLayout(el, id, posMap[id] || NEST[id] || opts.pos);
      if (opts.hue != null) el.style.setProperty("--pin-hue", String(opts.hue));
      else if (NEST[id]?.hue != null)
        el.style.setProperty("--pin-hue", String(NEST[id].hue));

      el._pinClick = () => {
        setReadout("dialogue", "Focus pin: " + pin.label, "sys");
        setReadout("intent", "pin:" + pin.id, "hot");
        if (pin.kind === "self") toggleCam();
        else if (pin.kind === "aito") probeAito(true);
        else if (pin.kind === "stream") {
          // Focus stream window; keep low-res pin pipe running
          fetch("/api/control", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "show_stream" }),
          }).catch(() => {});
          syncStreamPinFromBus();
        } else if (pin.kind === "study") {
          selectStudy(id.replace(/^study-/, ""));
        }
      };
      bindPinDrag(el, id);
    }
    pin.label = opts.label || pin.label;
    const lab = pin.el.querySelector(".pin-lab");
    if (lab) lab.textContent = pin.label;
    if (opts.stream && pin.video) {
      pin.video.srcObject = opts.stream;
      pin.video.play().catch(() => {});
    }
    if (opts.img && pin.el.querySelector("img")) {
      pin.el.querySelector("img").src = opts.img;
    }
    if (opts.hue != null) {
      pin.el.style.setProperty("--pin-hue", String(opts.hue));
    }
    pin.el.classList.toggle("live", !!(opts.stream || opts.live));
    return pin;
  }

  function seedPins() {
    ensurePin("self", { kind: "self", label: "You" });
    ensurePin("aito", { kind: "aito", label: "AIto", hue: 175 });
    ensurePin("stream", { kind: "stream", label: "Stream", hue: 280 });
    ensurePin("peer-a", { kind: "peer", label: "α", hue: 32 });
    ensurePin("peer-b", { kind: "peer", label: "β", hue: 200 });
    // restore study float pins (small, off to side of main)
    loadStudies()
      .slice(0, 8)
      .forEach((s, i) => mountStudyPin(s, i));
    // Start low-res pipe of whatever Stream window is playing
    startStreamPinPipe();
  }

  /* ── Stream pin: live low-res pipe of Stream window feed ─────────── */

  function destroyStreamPinHls() {
    if (streamPinHls) {
      try {
        streamPinHls.destroy();
      } catch (_) {}
      streamPinHls = null;
    }
  }

  function loadHlsLib() {
    return new Promise((resolve) => {
      if (global.Hls) {
        resolve(global.Hls);
        return;
      }
      const existing = document.querySelector('script[data-lab-hls="1"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(global.Hls));
        existing.addEventListener("error", () => resolve(null));
        return;
      }
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
      s.async = true;
      s.dataset.labHls = "1";
      s.onload = () => resolve(global.Hls || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }

  async function attachStreamPinPlay(playUrl, meta) {
    const pin = ensurePin("stream", {
      kind: "stream",
      label: meta?.live ? "LIVE" : "Stream",
      hue: 280,
      live: true,
    });
    if (!pin || !pin.video) return;
    const video = pin.video;
    const play = String(playUrl || "").trim();
    if (!play) {
      stopStreamPinPipe(false);
      return;
    }
    if (play === streamPinPlay && !video.paused && video.readyState >= 2) {
      pin.el.classList.add("live");
      return;
    }
    streamPinPlay = play;
    destroyStreamPinHls();
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    // Keep decode light for pin size
    try {
      video.disablePictureInPicture = true;
    } catch (_) {}

    const isHls = /\.m3u8(\?|$)/i.test(play) || meta?.streamKind === "hls";
    const onReady = () => {
      pin.el.classList.add("live");
      pin.el.classList.remove("offline");
      const lab = pin.el.querySelector(".pin-lab");
      if (lab) {
        lab.textContent = meta?.live
          ? "LIVE"
          : (meta?.title || "Stream").slice(0, 8);
      }
      video.play().catch(() => {});
    };

    if (isHls) {
      // Prefer native HLS (WKWebView) for tiny pin; fall back to hls.js
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = play;
        video.addEventListener("loadedmetadata", onReady, { once: true });
        video.addEventListener(
          "error",
          () => {
            // retry with hls.js
            pipeWithHlsJs(video, play, onReady);
          },
          { once: true }
        );
      } else {
        await pipeWithHlsJs(video, play, onReady);
      }
    } else {
      video.src = play;
      video.addEventListener("loadedmetadata", onReady, { once: true });
    }
    setReadout("status", "<em>stream pin live</em> · low-res pipe");
  }

  async function pipeWithHlsJs(video, play, onReady) {
    const Hls = await loadHlsLib();
    if (Hls && Hls.isSupported()) {
      destroyStreamPinHls();
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 8,
        maxMaxBufferLength: 12,
        // Prefer lower ABR ladder rungs for pin
        startLevel: 0,
        capLevelToPlayerSize: true,
      });
      streamPinHls = hls;
      hls.loadSource(play);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        try {
          hls.currentLevel = 0;
        } catch (_) {}
        onReady();
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data?.fatal) {
          const pin = pins.get("stream");
          if (pin) {
            pin.el.classList.add("offline");
            pin.el.classList.remove("live");
          }
        }
      });
    } else {
      video.src = play;
      video.addEventListener("loadedmetadata", onReady, { once: true });
    }
  }

  function stopStreamPinPipe(clearLabel) {
    destroyStreamPinHls();
    streamPinPlay = "";
    const pin = pins.get("stream");
    if (pin?.video) {
      try {
        pin.video.pause();
        pin.video.removeAttribute("src");
        pin.video.load();
      } catch (_) {}
    }
    if (pin) {
      pin.el.classList.remove("live");
      pin.el.classList.add("offline");
      if (clearLabel !== false) {
        const lab = pin.el.querySelector(".pin-lab");
        if (lab) lab.textContent = "Stream";
      }
    }
  }

  async function syncStreamPinFromBus() {
    let active = null;
    try {
      const r = await fetch("/api/media/active", { cache: "no-store" });
      active = await r.json();
    } catch (_) {
      try {
        active = JSON.parse(localStorage.getItem("lab.media.active.v1") || "null");
      } catch (_) {
        active = null;
      }
    }
    if (!active || !active.playing || !active.play) {
      if (streamPinPlay) stopStreamPinPipe(true);
      return;
    }
    await attachStreamPinPlay(active.play, active);
  }

  function startStreamPinPipe() {
    if (streamPinPoll) clearInterval(streamPinPoll);
    syncStreamPinFromBus();
    streamPinPoll = setInterval(syncStreamPinFromBus, 2500);
    // Same-tab / storage broadcast from Stream window
    global.addEventListener("storage", (e) => {
      if (e.key === "lab.media.active.v1") syncStreamPinFromBus();
    });
    global.addEventListener("lab:media-active", (ev) => {
      const d = (ev && ev.detail) || {};
      if (d.playing && d.play) attachStreamPinPlay(d.play, d);
      else stopStreamPinPipe(true);
    });
  }

  /* ── Movement studies (face MOCAP flipbook “gifs”) ─────────────── */

  function loadStudies() {
    const list = loadJson(LS_STUDIES, []);
    return Array.isArray(list) ? list : [];
  }

  function saveStudies(list) {
    saveJson(LS_STUDIES, list.slice(0, MAX_STUDIES));
  }

  function mountStudyPin(study, index) {
    const id = "study-" + study.id;
    // park small studies in a tight arc slightly behind/out of the main face
    const ang = 120 + (index % 8) * 22;
    const rad = 38 + (index % 3) * 4;
    const pos = {
      x: 50 + Math.cos((ang * Math.PI) / 180) * rad,
      y: 50 + Math.sin((ang * Math.PI) / 180) * rad * 0.75,
      z: 1,
    };
    const pin = ensurePin(id, {
      kind: "study",
      label: study.tag || "study",
      img: study.poster || (study.frames && study.frames[0]),
      hue: 210 + (index * 17) % 80,
      pos: pos,
      live: true,
    });
    if (pin) {
      const map = loadPinPos();
      if (!map[id]) {
        map[id] = pos;
        savePinPos(map);
      }
      applyPinLayout(pin.el, id, map[id] || pos);
      startStudyAnim(pin.el.querySelector("img"), study.frames || []);
    }
    return pin;
  }

  function startStudyAnim(img, frames) {
    if (!img || !frames.length) return;
    const key = img.src || Math.random().toString(36);
    if (studyAnimTimers.has(key)) clearInterval(studyAnimTimers.get(key));
    let i = 0;
    img.src = frames[0];
    const t = setInterval(() => {
      i = (i + 1) % frames.length;
      img.src = frames[i];
    }, 110);
    studyAnimTimers.set(key, t);
  }

  /**
   * Capture short motion from main cam → small frames + poster.
   * Stored as flipbook (gif-like) for MOCAP face study feed.
   */
  async function captureMovementStudy(opts) {
    opts = opts || {};
    if (studyBusy) return null;
    const v = $("siri-cam-video");
    if (!mainStream || !v || v.videoWidth < 8) {
      setReadout("dialogue", "Open Cam first for movement study", "lab");
      setReadout("intent", "study · need cam", "err");
      return null;
    }
    studyBusy = true;
    setReadout("status", "<em>recording movement study…</em>");
    setReadout("intent", "study · capture", "hot");
    const frames = [];
    const c = document.createElement("canvas");
    c.width = STUDY_SIZE;
    c.height = STUDY_SIZE;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    try {
      for (let i = 0; i < STUDY_FRAMES; i++) {
        if (!ctx) break;
        // center-crop face-ish square
        const vw = v.videoWidth;
        const vh = v.videoHeight;
        const side = Math.min(vw, vh);
        const sx = (vw - side) / 2;
        const sy = (vh - side) / 2 * 0.35; // bias slightly up toward face
        ctx.drawImage(v, sx, sy, side, side * 0.9, 0, 0, STUDY_SIZE, STUDY_SIZE);
        frames.push(c.toDataURL("image/jpeg", 0.62));
        await new Promise((r) => setTimeout(r, STUDY_INTERVAL_MS));
      }
      if (!frames.length) throw new Error("no frames");
      const lum = sampleLuminance(v);
      const id =
        Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
      const tag =
        opts.tag ||
        "face-move-" + new Date().toISOString().slice(11, 19).replace(/:/g, "");
      const study = {
        id: id,
        tag: tag,
        frames: frames,
        poster: frames[0],
        n: frames.length,
        ms: STUDY_FRAMES * STUDY_INTERVAL_MS,
        lum: lum,
        traits: (loadPersona().traits || []).slice(0, 6),
        ts: Date.now(),
        kind: "mocap-face",
      };
      const list = loadStudies();
      list.unshift(study);
      saveStudies(list);
      mountStudyPin(study, 0);
      renderMocapFeed($("mocap-search")?.value || "");
      selectStudy(id);
      setReadout(
        "dialogue",
        "Movement study “" + tag + "” · " + frames.length + "f · nest / Post X",
        "lab"
      );
      setReadout("intent", "study · saved", "hit");
      setReadout("status", "<em>study saved</em> · cam live");
      growPersonaFromSample(lum);
      return study;
    } catch (e) {
      setReadout("dialogue", "Study failed: " + (e.message || e), "lab");
      return null;
    } finally {
      studyBusy = false;
    }
  }

  function selectStudy(id) {
    selectedStudyId = id;
    const lab = $("mocap-selected-label");
    const s = loadStudies().find((x) => x.id === id);
    if (lab) lab.textContent = s ? s.tag : "—";
    document.querySelectorAll(".mocap-card").forEach((c) => {
      c.classList.toggle("selected", c.dataset.studyId === id);
    });
  }

  function renderMocapFeed(query) {
    const grid = $("mocap-grid");
    const count = $("mocap-count");
    if (!grid) return;
    const q = String(query || "")
      .trim()
      .toLowerCase();
    let list = loadStudies();
    if (q) {
      list = list.filter((s) => {
        const hay = [s.tag, s.kind, ...(s.traits || [])].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    if (count) count.textContent = String(list.length);
    grid.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "mocap-empty";
      empty.textContent = q
        ? "No studies match “" + q + "”"
        : "Cam on · Study → short face motion GIFs land here";
      grid.appendChild(empty);
      return;
    }
    list.forEach((s) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "mocap-card" + (s.id === selectedStudyId ? " selected" : "");
      card.dataset.studyId = s.id;
      card.title = (s.tag || s.id) + " · " + (s.n || 0) + " frames";
      const img = document.createElement("img");
      img.alt = s.tag || "study";
      img.src = s.poster || (s.frames && s.frames[0]) || "";
      startStudyAnim(img, s.frames || []);
      const lab = document.createElement("span");
      lab.className = "mc-lab";
      lab.textContent = (s.tag || "study").slice(0, 14);
      card.appendChild(img);
      card.appendChild(lab);
      card.addEventListener("click", () => selectStudy(s.id));
      grid.appendChild(card);
    });
  }

  function getSelectedStudy() {
    if (!selectedStudyId) return loadStudies()[0] || null;
    return loadStudies().find((s) => s.id === selectedStudyId) || null;
  }

  /** Download flipbook as multi-frame HTML wrapper + first frame; best-effort webm via canvas. */
  async function downloadStudy(study) {
    if (!study) study = getSelectedStudy();
    if (!study) {
      setReadout("dialogue", "Select a study first", "sys");
      return;
    }
    // Export poster PNG
    const a = document.createElement("a");
    a.href = study.poster || study.frames[0];
    a.download = "mocap-" + (study.tag || study.id) + ".jpg";
    a.click();
    // Also stash a small JSON meta for the study (frames omitted if huge)
    const meta = {
      id: study.id,
      tag: study.tag,
      n: study.n,
      ms: study.ms,
      traits: study.traits,
      ts: study.ts,
      kind: "mocap-face-study",
      note: "Open MOCAP feed in lab-ship chat to replay frames",
    };
    const blob = new Blob([JSON.stringify(meta, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement("a");
    a2.href = url;
    a2.download = "mocap-" + (study.tag || study.id) + ".json";
    a2.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setReadout("dialogue", "Downloaded study poster + meta JSON", "lab");
  }

  /**
   * Open X compose intent with MOCAP face-study caption.
   * Media attach is manual (browser intent can't attach local files).
   */
  function postStudyToX(study) {
    if (!study) study = getSelectedStudy();
    if (!study) {
      setReadout("dialogue", "Select a study to post", "sys");
      return;
    }
    const traits = (study.traits || []).slice(0, 4).join(" · ");
    const text = [
      "MOCAP face study · " + (study.tag || study.id),
      study.n + " frames · " + (study.ms || 0) + "ms motion",
      traits ? "traits: " + traits : null,
      "#MOCAP #FaceStudy #labship",
      "via Grok Build Lab · lab-ship",
    ]
      .filter(Boolean)
      .join("\n");
    const intent =
      "https://x.com/intent/tweet?text=" + encodeURIComponent(text);
    window.open(intent, "_blank", "noopener");
    downloadStudy(study);
    setReadout(
      "dialogue",
      "X compose opened · attach downloaded study image in the post",
      "lab"
    );
    setReadout("intent", "mocap · post X", "hit");
  }

  function sampleLuminance(video) {
    if (!video || video.videoWidth < 2) return null;
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    try {
      ctx.drawImage(video, 0, 0, 32, 32);
      const d = ctx.getImageData(0, 0, 32, 32).data;
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n++;
      }
      return {
        r: Math.round(r / n),
        g: Math.round(g / n),
        b: Math.round(b / n),
      };
    } catch (_) {
      return null;
    }
  }

  function growPersonaFromSample(lum) {
    if (!lum) return;
    const p = loadPersona();
    p.samples = (p.samples || 0) + 1;
    // EMA color signature as soft biometrics stand-in
    const a = 0.15;
    p.lum = {
      r: Math.round((p.lum?.r || lum.r) * (1 - a) + lum.r * a),
      g: Math.round((p.lum?.g || lum.g) * (1 - a) + lum.g * a),
      b: Math.round((p.lum?.b || lum.b) * (1 - a) + lum.b * a),
    };
    // Light trait inference from palette
    const traits = new Set(p.traits || []);
    if (p.lum.r > p.lum.b + 20) traits.add("warm-tones");
    if (p.lum.b > p.lum.r + 15) traits.add("cool-tones");
    if ((p.lum.r + p.lum.g + p.lum.b) / 3 > 140) traits.add("bright-scene");
    if ((p.lum.r + p.lum.g + p.lum.b) / 3 < 80) traits.add("dim-scene");
    if (p.samples > 20) traits.add("familiar");
    if (p.samples > 50) traits.add("known-user");
    p.traits = Array.from(traits).slice(0, 12);
    savePersona(p);
    // Face badge tint
    const face = $("siri-face-canvas");
    if (face) {
      const ctx = face.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, face.width, face.height);
        ctx.fillStyle =
          "rgb(" + p.lum.r + "," + p.lum.g + "," + p.lum.b + ")";
        ctx.beginPath();
        ctx.arc(face.width / 2, face.height / 2, face.width / 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function startSampling() {
    if (sampleTimer) clearInterval(sampleTimer);
    sampleTimer = setInterval(() => {
      if (!mainStream) return;
      const v = $("siri-cam-video");
      const lum = sampleLuminance(v);
      growPersonaFromSample(lum);
    }, 1200);
  }

  async function probeAito(force) {
    const pin = ensurePin("aito", { kind: "aito", label: "AIto", hue: 175 });
    try {
      const r = await fetch(aitoBase() + "/health", {
        cache: "no-store",
        signal: AbortSignal.timeout ? AbortSignal.timeout(600) : undefined,
      });
      aitoOk = r.ok;
    } catch (_) {
      // native proxy
      try {
        const r2 = await fetch("/api/vision/health", { cache: "no-store" });
        const j = await r2.json();
        aitoOk = !!(j && j.ok);
      } catch (_) {
        aitoOk = false;
      }
    }
    if (pin) {
      pin.el.classList.toggle("live", aitoOk);
      pin.el.classList.toggle("offline", !aitoOk);
      pin.el.querySelector(".pin-lab").textContent = aitoOk ? "AIto" : "AIto·off";
    }
    if (force) {
      setReadout(
        "dialogue",
        aitoOk
          ? "AIto vision sidecar online · pose/segment ready"
          : "AIto offline — start aito-mac / set GY_VISION_AITO_URL",
        "lab"
      );
    }
    // Optional: send frame for recognition when cam + aito up
    if (aitoOk && mainStream && force) {
      await sendFrameToAito();
    }
    return aitoOk;
  }

  async function sendFrameToAito() {
    const v = $("siri-cam-video");
    if (!v || v.videoWidth < 8) return null;
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 120;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, 160, 120);
    const dataUrl = c.toDataURL("image/jpeg", 0.7);
    try {
      const r = await fetch("/api/vision/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: dataUrl,
          persona: loadPersona(),
          mode: "recognize",
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (j && j.ok) {
        const p = loadPersona();
        if (j.name) p.name = j.name;
        if (Array.isArray(j.traits)) {
          p.traits = Array.from(new Set([...(p.traits || []), ...j.traits])).slice(
            0,
            12
          );
        }
        if (j.note) {
          p.notes = (p.notes || []).concat([j.note]).slice(-20);
        }
        savePersona(p);
        setReadout(
          "dialogue",
          j.summary || "Vision: " + (j.name || p.name) + " recognized",
          "lab"
        );
        setReadout("intent", "vision · " + (j.summary || "ok"), "hit");
      }
      return j;
    } catch (_) {
      return null;
    }
  }

  /** Crash / misinterpretation recovery for chat surface */
  async function recover(reason) {
    if (recoverBusy) return { ok: false, busy: true };
    recoverBusy = true;
    setReadout("dialogue", "Recovering… " + (reason || ""), "sys");
    setReadout("intent", "recover", "hot");
    try {
      // Soft ops
      await fetch("/api/playpen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: "mitigate",
          action: "soft-recover",
        }),
      }).catch(() => ({}));
      // Re-show chat standalone undocked
      await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_chat_independent" }),
      }).catch(() =>
        fetch("/api/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "show_chat" }),
        })
      );
      // Reset listen UI state
      setReadout("heard", "Recovered · say again or type", "interim");
      setReadout("intent", "ready", "hit");
      setReadout(
        "dialogue",
        "Session recovered — camera " +
          (mainStream ? "still on" : "off") +
          ". Clarify if I misheard.",
        "lab"
      );
      // Persona note
      const p = loadPersona();
      p.notes = (p.notes || [])
        .concat(["recover:" + (reason || "unknown") + "@" + Date.now()])
        .slice(-20);
      savePersona(p);
      return { ok: true };
    } finally {
      recoverBusy = false;
    }
  }

  function noteDialogue(role, text) {
    setReadout("dialogue", text, role === "you" ? "you" : "lab");
    // Grow persona from conversation topics
    const p = loadPersona();
    const low = String(text || "").toLowerCase();
    const traits = new Set(p.traits || []);
    if (/\b(code|rust|build|ship)\b/.test(low)) traits.add("builder");
    if (/\b(voice|talk|listen)\b/.test(low)) traits.add("voice-first");
    if (/\b(camera|video|see)\b/.test(low)) traits.add("vision-curious");
    if (/\b(plan|design)\b/.test(low)) traits.add("planner");
    p.traits = Array.from(traits).slice(0, 12);
    if (role === "you" && text) {
      p.notes = (p.notes || []).concat([String(text).slice(0, 120)]).slice(-30);
    }
    savePersona(p);
  }

  /* ── SpaceX / play thumbnail rail on full chat ─────────────────── */
  const PLAY_FEEDS = [
    { id: "starship", label: "Starship", url: "https://x.com/i/broadcasts/1MKgNNXAZdmxL", live: true, hue: 200, thumb: "🚀" },
    { id: "sxlive", label: "SpaceX live", url: "https://www.youtube.com/@SpaceX/live", live: true, hue: 210, thumb: "▣" },
    { id: "sxyt", label: "SpaceX YT", url: "https://www.youtube.com/@SpaceX", live: false, hue: 205, thumb: "▶" },
    { id: "spacex", label: "SpaceX X", url: "https://x.com/SpaceX", live: false, hue: 215, thumb: "𝕏" },
    { id: "spacexai", label: "SpaceXAI", url: "https://x.com/spacexai", live: false, hue: 195, thumb: "◈" },
    { id: "xai", label: "xAI", url: "https://x.com/xai", live: false, hue: 280, thumb: "✦" },
    { id: "nasa", label: "NASA live", url: "https://www.youtube.com/@NASA/live", live: true, hue: 32, thumb: "🛰" },
    { id: "nasatv", label: "NASA TV", url: "https://www.youtube.com/@NASAtelevision/live", live: true, hue: 28, thumb: "TV" },
    { id: "sfn", label: "SFN", url: "https://www.youtube.com/@SpaceflightNow/live", live: true, hue: 160, thumb: "📡" },
    { id: "nsf", label: "NSF", url: "https://www.youtube.com/@NASASpaceflight/live", live: true, hue: 170, thumb: "🔭" },
    { id: "everyday", label: "Everyday", url: "https://www.youtube.com/@EverydayAstronaut/live", live: true, hue: 140, thumb: "🧑‍🚀" },
    { id: "tesla", label: "Tesla", url: "https://www.youtube.com/@Tesla/live", live: true, hue: 190, thumb: "⚡" },
    { id: "phone", label: "Phone cam", url: "device:0", live: true, hue: 320, thumb: "📱" },
    { id: "gydev", label: "GY cam", url: "gy:device:0", live: true, hue: 300, thumb: "GY" },
  ];

  let playBusy = false;

  function renderPlayRail() {
    const rail = $("chat-play-thumbs");
    if (!rail || rail.dataset.ready === "1") return;
    rail.innerHTML = "";
    PLAY_FEEDS.forEach((f) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chat-play-thumb" + (f.live ? " live" : "");
      b.dataset.feedId = f.id;
      b.style.setProperty("--thumb-hue", String(f.hue || 200));
      b.title = f.url;
      b.innerHTML =
        '<span class="cpt-ico" aria-hidden="true">' +
        (f.thumb || "▶") +
        "</span>" +
        '<span class="cpt-lab">' +
        escapeHtml(f.label) +
        "</span>" +
        (f.live ? '<span class="cpt-live">LIVE</span>' : "");
      b.addEventListener("click", () => playFeedThumb(f));
      rail.appendChild(b);
    });
    rail.dataset.ready = "1";
  }

  function markPlayThumb(id) {
    document.querySelectorAll(".chat-play-thumb").forEach((el) => {
      el.classList.toggle("on", el.dataset.feedId === id);
    });
    const now = $("chat-play-now");
    if (now) {
      const f = PLAY_FEEDS.find((x) => x.id === id);
      now.textContent = f ? f.label : "idle";
    }
  }

  async function playFeedThumb(feed) {
    if (!feed || playBusy) return;
    playBusy = true;
    markPlayThumb(feed.id);
    setReadout("status", "<em>loading feed…</em> " + feed.label);
    setReadout("dialogue", "Play · " + feed.label, "sys");
    try {
      // Open stream window + kick LabVideo
      fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "show_stream" }),
      }).catch(() => {});
      fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "eval",
          target: "stream",
          script:
            "try{var u=" +
            JSON.stringify(feed.url) +
            ";var i=document.getElementById('sv-url');if(i)i.value=u;" +
            "if(window.LabVideo&&LabVideo.play)LabVideo.play(u,{preferBlank:false});}catch(e){}",
        }),
      }).catch(() => {});

      const r = await fetch("/api/media/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: feed.url,
          quality: "720",
          restream: true,
          prefer_blank: false,
          prefer_gy: String(feed.url).indexOf("gy:") === 0,
        }),
      });
      const j = await r.json().catch(() => ({}));
      const play =
        j.play ||
        j.video ||
        (j.jobId ? "/api/media/hls/" + j.jobId + "/index.m3u8" : "");
      if (!play || j.ok === false) {
        const err = j.error || j.message || "resolve failed";
        setReadout("status", "feed fail");
        setReadout("dialogue", String(err).slice(0, 120), "lab");
        setReadout("intent", "feed err", "err");
        return;
      }
      // Pipe into Stream pin immediately
      if (typeof attachStreamPinPlay === "function") {
        await attachStreamPinPlay(play, {
          live: !!(j.live || feed.live),
          title: j.title || feed.label,
          streamKind: j.streamKind,
        });
      }
      try {
        localStorage.setItem(
          "lab.media.active.v1",
          JSON.stringify({
            playing: true,
            play: play,
            input: feed.url,
            title: j.title || feed.label,
            jobId: j.jobId || "",
            via: j.via || "chat-play",
            live: !!(j.live || feed.live),
            quality: "720",
          })
        );
      } catch (_) {}
      fetch("/api/media/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playing: true,
          play: play,
          input: feed.url,
          title: j.title || feed.label,
          jobId: j.jobId || "",
          via: j.via || "chat-play",
          live: !!(j.live || feed.live),
          quality: "720",
        }),
      }).catch(() => {});
      setReadout(
        "status",
        (j.live || feed.live ? "<em>LIVE</em> · " : "<em>play</em> · ") + feed.label
      );
      setReadout("intent", "feed · " + feed.label, "hit");
      setReadout("dialogue", "Streaming " + feed.label + " · pin + Stream window", "lab");
    } catch (e) {
      setReadout("dialogue", "Feed error: " + (e.message || e), "lab");
    } finally {
      playBusy = false;
    }
  }

  function bind() {
    seedPins();
    renderPersonaChip(loadPersona());
    renderMocapFeed("");
    renderPlayRail();
    $("siri-btn-cam")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleCam();
    });
    $("btn-recognize")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!mainStream) {
        setReadout("dialogue", "Open Cam first to recognize", "lab");
        return;
      }
      sendFrameToAito();
    });
    const onStudy = (e) => {
      e.preventDefault();
      captureMovementStudy();
    };
    $("btn-study")?.addEventListener("click", onStudy);
    $("btn-study-cap")?.addEventListener("click", onStudy);
    $("btn-study-nest")?.addEventListener("click", (e) => {
      e.preventDefault();
      nestAllPins();
    });
    $("btn-study-x")?.addEventListener("click", (e) => {
      e.preventDefault();
      postStudyToX();
    });
    $("btn-study-dl")?.addEventListener("click", (e) => {
      e.preventDefault();
      downloadStudy();
    });
    $("mocap-search")?.addEventListener("input", (e) => {
      renderMocapFeed(e.target.value);
    });
    function onRecover(e) {
      e.preventDefault();
      recover("manual");
    }
    $("btn-recover")?.addEventListener("click", onRecover);
    $("btn-recover-chrome")?.addEventListener("click", onRecover);
    $("btn-standalone")?.addEventListener("click", (e) => {
      e.preventDefault();
      fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_chat_independent" }),
      }).catch(() => {});
      setReadout("dialogue", "Chat standalone (undocked float)", "lab");
    });
    // Hook LabChat send for persona
    const prev = global.LabChat;
    if (prev && prev.send) {
      const orig = prev.send.bind(prev);
      prev.send = function (t) {
        noteDialogue("you", t);
        return orig(t);
      };
    }
    probeAito(false);
    setInterval(() => probeAito(false), 15000);
  }

  global.LabChatVision = {
    toggleCam: toggleCam,
    openCam: openMainCam,
    closeCam: stopMainCam,
    isCamOn: () => !!mainStream,
    persona: loadPersona,
    savePersona: savePersona,
    recover: recover,
    probeAito: probeAito,
    recognize: sendFrameToAito,
    noteDialogue: noteDialogue,
    ensurePin: ensurePin,
    nestPins: nestAllPins,
    captureStudy: captureMovementStudy,
    studies: loadStudies,
    postStudyToX: postStudyToX,
    downloadStudy: downloadStudy,
    renderMocapFeed: renderMocapFeed,
    syncStreamPin: syncStreamPinFromBus,
    playFeed: playFeedThumb,
    feeds: () => PLAY_FEEDS.slice(),
    version: 4,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})(typeof window !== "undefined" ? window : globalThis);
