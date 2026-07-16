/**
 * lab-ship phone shell — GrokYtalkY-style handset
 * Tabs: Chat · Agent · Stream · Prompt · Docs
 * Shared composer + Hold/Cam/Study · host control bus
 */
(function () {
  "use strict";

  const TABS = ["chat", "agent", "stream", "prompt", "docs"];

  /** SpaceX / xAI / NASA multi-feeds for main play page (#/chat) */
  const SPACEX_FEEDS = [
    {
      id: "starship",
      label: "Starship",
      url: "https://x.com/i/broadcasts/1MKgNNXAZdmxL",
      live: true,
    },
    {
      id: "sx-live",
      label: "SpaceX live",
      url: "https://www.youtube.com/@SpaceX/live",
      live: true,
    },
    {
      id: "sx-yt",
      label: "SpaceX YT",
      url: "https://www.youtube.com/@SpaceX",
      live: false,
    },
    {
      id: "spacex-x",
      label: "SpaceX X",
      url: "https://x.com/SpaceX",
      live: false,
    },
    {
      id: "spacexai",
      label: "SpaceXAI",
      url: "https://x.com/spacexai",
      live: false,
    },
    {
      id: "xai",
      label: "xAI",
      url: "https://x.com/xai",
      live: false,
    },
    {
      id: "nasa-live",
      label: "NASA live",
      url: "https://www.youtube.com/@NASA/live",
      live: true,
    },
    {
      id: "nasa-tv",
      label: "NASA TV",
      url: "https://www.youtube.com/@NASAtelevision/live",
      live: true,
    },
    {
      id: "sfn",
      label: "Spaceflight Now",
      url: "https://www.youtube.com/@SpaceflightNow/live",
      live: true,
    },
    {
      id: "everyday",
      label: "Everyday Astronaut",
      url: "https://www.youtube.com/@EverydayAstronaut/live",
      live: true,
    },
    {
      id: "nsf",
      label: "NASASpaceflight",
      url: "https://www.youtube.com/@NASASpaceflight/live",
      live: true,
    },
    {
      id: "tesla",
      label: "Tesla",
      url: "https://www.youtube.com/@Tesla/live",
      live: true,
    },
    {
      id: "phone",
      label: "Phone cam",
      url: "device:0",
      live: true,
    },
    {
      id: "gydev",
      label: "GY cam",
      url: "gy:device:0",
      live: true,
    },
  ];

  const state = {
    tab: "chat",
    promptMode: "plan", // plan | chain | talk | ship
    hostOk: false,
    camOn: false,
    camStream: null,
    listenOn: false,
    streamHls: null,
    activeFeedId: null,
    playBusy: false,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg, ms) {
    const t = $("phone-toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), ms || 2800);
  }

  function setFaceStatus(html) {
    const el = $("ph-status");
    if (el) el.innerHTML = html;
  }

  function setHost(ok, detail) {
    state.hostOk = !!ok;
    const el = $("ph-host");
    if (!el) return;
    el.classList.toggle("on", !!ok);
    el.textContent = ok ? detail || "host live" : detail || "host offline";
  }

  async function probeHost() {
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      const j = await r.json();
      if (j && j.ok) {
        setHost(true, j.native ? "native" : "serve");
        return true;
      }
    } catch (_) {}
    setHost(false, "offline · docs only");
    return false;
  }

  async function control(action, extra) {
    try {
      const r = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ action: action }, extra || {})),
      });
      return await r.json().catch(() => ({}));
    } catch (_) {
      return { ok: false };
    }
  }

  function setTab(name) {
    if (!TABS.includes(name)) name = "chat";
    state.tab = name;
    try {
      history.replaceState(null, "", "#/" + name);
    } catch (_) {}
    document.querySelectorAll(".phone-pane").forEach((p) => {
      p.classList.toggle("on", p.dataset.pane === name);
    });
    document.querySelectorAll(".phone-nav button").forEach((b) => {
      b.classList.toggle("on", b.dataset.tab === name);
    });
    const mode = $("ph-mode");
    if (mode) mode.textContent = name;
    // Lazy-load iframe src once
    const pane = document.querySelector('.phone-pane[data-pane="' + name + '"]');
    const iframe = pane && pane.querySelector("iframe[data-src]");
    if (iframe && !iframe.src) {
      iframe.src = iframe.getAttribute("data-src");
    }
    if (name === "stream") syncStreamPeek();
    if (name === "chat") refreshChatLite();
  }

  function tabFromHash() {
    const h = (location.hash || "").replace(/^#\/?/, "").split(/[/?&]/)[0];
    return TABS.includes(h) ? h : "chat";
  }

  /* ── Composer ── */
  function composerMode() {
    return ($("ph-compose-mode") && $("ph-compose-mode").value) || "talk";
  }

  function logPrompt(role, text) {
    const log = $("ph-prompt-log");
    if (!log) return;
    const line = document.createElement("div");
    line.className = "pl-line " + (role || "sys");
    line.innerHTML =
      '<span class="pl-who">' +
      (role || "sys") +
      "</span>" +
      escapeHtml(String(text || "").slice(0, 2000));
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function logChat(role, text) {
    const log = $("ph-chat-log");
    if (!log) return;
    const line = document.createElement("div");
    line.className = "line " + (role || "sys");
    line.textContent = (role === "you" ? "you · " : role === "lab" ? "lab · " : "") + text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async function sendComposer() {
    const ta = $("ph-input");
    const text = (ta && ta.value.trim()) || "";
    if (!text) return;
    if (ta) ta.value = "";
    const mode = composerMode();
    logChat("you", text);
    logPrompt("you", "[" + mode + "] " + text);

    if (!state.hostOk) {
      toast("Host offline — open native Lab or ./serve.sh");
      logPrompt("sys", "no host · message kept locally");
      return;
    }

    setFaceStatus("<em>sending…</em> " + mode);

    try {
      if (mode === "talk") {
        // Route as chat-style intent via control eval if chat open, else chain light
        await control("show_chat");
        const script =
          "try{if(window.LabChat&&LabChat.send)LabChat.send(" +
          JSON.stringify(text) +
          ");else if(window.LabGrokListen&&LabGrokListen.interpret){var i=LabGrokListen.interpret(" +
          JSON.stringify(text) +
          ");if(i&&i.run)i.run();} }catch(e){}";
        await control("eval", { target: "chat", script: script });
        logPrompt("lab", "routed to chat intent");
        setFaceStatus("<em>chat</em> · intent routed");
        toast("Sent to chat");
        return;
      }

      if (mode === "ship") {
        await control("show_lab");
        logPrompt("lab", "open ship → use Ship deck / /ship-check in TUI");
        setFaceStatus("ship · lab focused");
        toast("Lab focused · Ship deck");
        return;
      }

      if (mode === "chain") {
        const r = await fetch("/api/agent/chain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            role: "plan",
            from: "plan",
            to: "build",
            open_fleet: true,
          }),
        });
        const j = await r.json().catch(() => ({}));
        logPrompt(
          "lab",
          j.ok
            ? "🚀 chain ok · " + (j.message || j.via || "handoff")
            : "chain: " + (j.error || j.message || r.status)
        );
        setFaceStatus(j.ok ? "<em>chain</em> fired" : "chain failed");
        toast(j.ok ? "Rocket chain" : "Chain failed");
        return;
      }

      // plan (default agent iterate)
      const r = await fetch("/api/agent/iterate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, role: "plan" }),
      });
      const j = await r.json().catch(() => ({}));
      const out =
        j.text ||
        j.iterate_text ||
        j.message ||
        j.error ||
        (r.ok ? "ok" : "HTTP " + r.status);
      logPrompt("lab", String(out).slice(0, 1800));
      setFaceStatus("<em>plan</em> reply");
      toast("Agent iterate");
    } catch (e) {
      logPrompt("sys", "error: " + (e.message || e));
      setFaceStatus("send failed");
      toast("Send failed");
    }
  }

  /* ── Cam / Hold / Study ── */
  async function toggleCam() {
    const orb = $("phone-orb");
    const video = $("phone-cam");
    if (state.camOn) {
      if (state.camStream) {
        state.camStream.getTracks().forEach((t) => t.stop());
        state.camStream = null;
      }
      if (video) video.srcObject = null;
      state.camOn = false;
      orb && orb.classList.remove("cam-on");
      $("ph-btn-cam")?.classList.remove("active");
      setFaceStatus("cam off");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      state.camStream = stream;
      state.camOn = true;
      if (video) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }
      orb && orb.classList.add("cam-on");
      $("ph-btn-cam")?.classList.add("active");
      setFaceStatus("<em>cam on</em> · hold / study");
      // Mirror to native chat if present
      control("eval", {
        target: "chat",
        script: "try{LabChatVision&&LabChatVision.openCam&&LabChatVision.openCam()}catch(e){}",
      });
    } catch (e) {
      const name = e && e.name;
      const msg = String((e && e.message) || "");
      let tip = msg || "denied";
      if (name === "NotAllowedError" || /not allowed by the user/i.test(msg)) {
        tip =
          "Camera not allowed · System Settings → Privacy → Camera → Grok Build Lab · or use Phone/GY feed chips";
      } else if (!window.isSecureContext) {
        tip = "Need http://127.0.0.1 host (not file://)";
      }
      toast("Cam: " + tip.slice(0, 64));
      setFaceStatus("cam not allowed");
      logChat("lab", tip);
    }
  }

  async function holdTalk() {
    if (!state.hostOk) {
      toast("Need Lab host for STT");
      return;
    }
    await control("lab-ship");
    await control("eval", {
      target: "chat",
      script:
        "try{if(window.LabGrokListen){if(!LabGrokListen.isOn||!LabGrokListen.isOn())LabGrokListen.toggle();LabGrokListen.pttDown&&LabGrokListen.pttDown();}}catch(e){}",
    });
    state.listenOn = true;
    $("ph-btn-hold")?.classList.add("active");
    setFaceStatus("<em>hold</em> · talking…");
    toast("Hold · release to send");
  }

  async function holdRelease() {
    if (!state.listenOn) return;
    await control("eval", {
      target: "chat",
      script: "try{LabGrokListen&&LabGrokListen.pttUp&&LabGrokListen.pttUp()}catch(e){}",
    });
    state.listenOn = false;
    $("ph-btn-hold")?.classList.remove("active");
    setFaceStatus("hold released · STT…");
  }

  async function captureStudy() {
    if (!state.hostOk) {
      toast("Need host · open full chat for studies");
      setTab("chat");
      return;
    }
    if (!state.camOn) await toggleCam();
    await control("chat_full");
    await control("eval", {
      target: "chat",
      script:
        "try{LabChatVision&&LabChatVision.captureStudy&&LabChatVision.captureStudy()}catch(e){}",
    });
    toast("Study capture on full chat");
    setFaceStatus("<em>study</em> · full chat");
  }

  /* ── SpaceX feed rail + stream peek ── */
  function renderFeedChips() {
    const row = $("ph-feed-chips");
    if (!row || row.dataset.ready === "1") return;
    row.innerHTML = "";
    SPACEX_FEEDS.forEach((f) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.feedId = f.id;
      b.textContent = f.label;
      b.title = f.url;
      if (f.live) b.classList.add("live-chip");
      b.addEventListener("click", () => playSpaceFeed(f));
      row.appendChild(b);
    });
    row.dataset.ready = "1";
  }

  function markFeedChip(id) {
    state.activeFeedId = id || null;
    document.querySelectorAll("#ph-feed-chips button").forEach((b) => {
      b.classList.toggle("on", b.dataset.feedId === id);
    });
    const now = $("ph-feed-now");
    if (now) {
      const f = SPACEX_FEEDS.find((x) => x.id === id);
      now.textContent = f ? f.label : "idle";
    }
  }

  function attachPeekPlay(play, meta) {
    const video = $("ph-stream-peek-video");
    const lab = $("ph-stream-peek-lab");
    if (!video || !play) return;
    if (lab) {
      lab.textContent =
        (meta && meta.live ? "LIVE · " : "") +
        ((meta && (meta.title || meta.label)) || "stream").toString().slice(0, 36);
    }
    if (video.dataset.play === play && !video.paused && video.readyState >= 2) return;
    video.dataset.play = play;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    if (state.streamHls) {
      try {
        state.streamHls.destroy();
      } catch (_) {}
      state.streamHls = null;
    }
    const isHls = /\.m3u8(\?|$)/i.test(play);
    if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = play;
    } else if (isHls && window.Hls && window.Hls.isSupported()) {
      state.streamHls = new window.Hls({
        startLevel: 0,
        capLevelToPlayerSize: true,
        maxBufferLength: 10,
      });
      state.streamHls.loadSource(play);
      state.streamHls.attachMedia(video);
      state.streamHls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        try {
          state.streamHls.currentLevel = 0;
        } catch (_) {}
        video.play().catch(() => {});
      });
      return;
    } else {
      video.src = play;
    }
    video.play().catch(() => {});
  }

  async function publishActive(body) {
    try {
      localStorage.setItem("lab.media.active.v1", JSON.stringify(body));
    } catch (_) {}
    try {
      await fetch("/api/media/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
    } catch (_) {}
  }

  async function playSpaceFeed(feed) {
    if (!feed || !feed.url) return;
    if (state.playBusy) {
      toast("already loading a feed…");
      return;
    }
    if (!state.hostOk) {
      toast("Host offline — start Lab / serve.sh for live pipes");
      setFaceStatus("host needed for feeds");
      return;
    }
    state.playBusy = true;
    markFeedChip(feed.id);
    setFaceStatus("<em>resolving…</em> " + feed.label);
    toast("Loading " + feed.label);
    logChat("lab", "feed · " + feed.label + " · " + feed.url);
    try {
      // Prefer opening Stream window with same source (full player)
      control("show_stream");
      control("eval", {
        target: "stream",
        script:
          "try{var u=" +
          JSON.stringify(feed.url) +
          ";var i=document.getElementById('sv-url');if(i)i.value=u;" +
          "if(window.LabVideo&&LabVideo.play)LabVideo.play(u,{preferBlank:false});" +
          "else window.dispatchEvent(new CustomEvent('lab:media-play',{detail:{url:u,preferBlank:false}}));}catch(e){}",
      });

      const r = await fetch("/api/media/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: feed.url,
          quality: "720",
          restream: true,
          prefer_blank: false,
          prefer_gy: feed.url.indexOf("gy:") === 0,
        }),
      });
      const j = await r.json().catch(() => ({}));
      const play =
        j.play ||
        j.video ||
        (j.jobId ? "/api/media/hls/" + j.jobId + "/index.m3u8" : "");
      if (!r.ok || j.ok === false || !play) {
        const err = j.error || j.message || "resolve failed";
        setFaceStatus("feed err · " + String(err).slice(0, 40));
        toast(String(err).slice(0, 48));
        logChat("lab", "feed fail · " + err);
        return;
      }
      const meta = {
        live: !!(j.live || feed.live),
        title: j.title || feed.label,
        label: feed.label,
        streamKind: j.streamKind,
      };
      attachPeekPlay(play, meta);
      await publishActive({
        playing: true,
        play: play,
        input: feed.url,
        title: meta.title,
        jobId: j.jobId || "",
        via: j.via || "phone-feed",
        live: meta.live,
        quality: j.quality || "720",
        streamKind: j.streamKind || (/\.m3u8/i.test(play) ? "hls" : "progressive"),
      });
      setFaceStatus(
        (meta.live ? "<em>LIVE</em> · " : "<em>play</em> · ") + feed.label
      );
      toast((meta.live ? "LIVE · " : "") + feed.label);
    } catch (e) {
      setFaceStatus("feed error");
      toast(e.message || "feed error");
    } finally {
      state.playBusy = false;
    }
  }

  /* ── Stream peek (low-res active feed) ── */
  async function syncStreamPeek() {
    const video = $("ph-stream-peek-video");
    const lab = $("ph-stream-peek-lab");
    if (!video) return;
    let active = null;
    try {
      const r = await fetch("/api/media/active", { cache: "no-store" });
      active = await r.json();
    } catch (_) {
      try {
        active = JSON.parse(localStorage.getItem("lab.media.active.v1") || "null");
      } catch (_) {}
    }
    if (!active || !active.playing || !active.play) {
      if (lab && !video.dataset.play) lab.textContent = "pick a SpaceX feed";
      return;
    }
    attachPeekPlay(active.play, {
      live: active.live,
      title: active.title,
      streamKind: active.streamKind,
    });
  }

  function refreshChatLite() {
    // Soft status line from host
    fetch("/api/media/active", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j && j.playing) {
          setFaceStatus("<em>stream live</em> · " + (j.title || "").slice(0, 24));
        }
      })
      .catch(() => {});
  }

  function wire() {
    document.querySelectorAll(".phone-nav button").forEach((b) => {
      b.addEventListener("click", () => setTab(b.dataset.tab));
    });

    $("ph-send")?.addEventListener("click", sendComposer);
    $("ph-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendComposer();
      }
    });

    document.querySelectorAll("[data-prompt-mode]").forEach((b) => {
      b.addEventListener("click", () => {
        document.querySelectorAll("[data-prompt-mode]").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        state.promptMode = b.dataset.promptMode;
        const sel = $("ph-compose-mode");
        if (sel) sel.value = state.promptMode === "talk" ? "talk" : state.promptMode;
      });
    });

    const hold = $("ph-btn-hold");
    if (hold) {
      hold.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        holdTalk();
      });
      hold.addEventListener("pointerup", holdRelease);
      hold.addEventListener("pointercancel", holdRelease);
      hold.addEventListener("pointerleave", holdRelease);
    }
    $("ph-btn-cam")?.addEventListener("click", () => toggleCam());
    $("ph-btn-study")?.addEventListener("click", () => captureStudy());
    $("ph-btn-lab")?.addEventListener("click", () => {
      control("restore_workspace");
      toast("Lab + prior windows");
    });
    $("ph-btn-desktop")?.addEventListener("click", async () => {
      await control("lab-ship");
      toast("lab-ship orb");
    });

    window.addEventListener("hashchange", () => setTab(tabFromHash()));
    renderFeedChips();
    setTab(tabFromHash());

    probeHost().then((ok) => {
      if (ok) {
        setFaceStatus("ready · tap a SpaceX feed");
        syncStreamPeek();
      } else setFaceStatus("docs mode · host offline");
    });
    setInterval(probeHost, 12000);
    setInterval(() => {
      if (state.tab === "stream" || state.tab === "chat") syncStreamPeek();
    }, 3000);

    logPrompt("sys", "lab-ship phone · Chat · Agent · Stream · Prompt · Docs");
    logChat("lab", "SpaceX feed rail · Hold · Cam · Study · composer by mode");
  }

  // Register SW for PWA install when opened as phone
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
