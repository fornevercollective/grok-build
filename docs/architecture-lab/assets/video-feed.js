/**
 * Stream / sidebar video feed — yt-dlp · ffmpeg · ffplay · blank · gy hub
 * SpaceXAI X feed + pop-out (GrokYtalkY / blank) · copy/paste URLs
 */
(function () {
  "use strict";

  const LS_SECTIONS = "lab.sb.sections.v2";
  const LS_HISTORY = "lab.media.history.v1";

  const PRESETS = {
    starship: {
      label: "Starship",
      url: "https://x.com/i/broadcasts/1MKgNNXAZdmxL",
      note: "X broadcast · Starship flight test (restream)",
    },
    sxlive: {
      label: "SpaceX live",
      url: "https://www.youtube.com/@SpaceX/live",
      note: "YouTube · @SpaceX/live",
      preferBlank: true,
    },
    sxyt: {
      label: "SpaceX YT",
      url: "https://www.youtube.com/@SpaceX",
      note: "YouTube · @SpaceX",
      preferBlank: true,
    },
    spacex: {
      label: "SpaceX X",
      url: "https://x.com/SpaceX",
      note: "X · @SpaceX",
      preferBlank: true,
    },
    spacexai: {
      label: "SpaceXAI",
      url: "https://x.com/spacexai",
      note: "X · @spacexai · blank/gy/yt-dlp",
      preferBlank: true,
    },
    xai: {
      label: "xAI",
      url: "https://x.com/xai",
      note: "X · @xai",
      preferBlank: true,
    },
    nasa: {
      label: "NASA live",
      url: "https://www.youtube.com/@NASA/live",
      note: "YouTube · @NASA/live",
      preferBlank: true,
    },
    nasatv: {
      label: "NASA TV",
      url: "https://www.youtube.com/@NASAtelevision/live",
      note: "YouTube · NASA television live",
      preferBlank: true,
    },
    sfn: {
      label: "SFN",
      url: "https://www.youtube.com/@SpaceflightNow/live",
      note: "Spaceflight Now live",
      preferBlank: true,
    },
    nsf: {
      label: "NSF",
      url: "https://www.youtube.com/@NASASpaceflight/live",
      note: "NASASpaceflight live",
      preferBlank: true,
    },
    everyday: {
      label: "Everyday Astro",
      url: "https://www.youtube.com/@EverydayAstronaut/live",
      note: "Everyday Astronaut live",
      preferBlank: true,
    },
    tesla: {
      label: "Tesla",
      url: "https://www.youtube.com/@Tesla/live",
      note: "Tesla YouTube live",
      preferBlank: true,
    },
    overview: {
      label: "Overview",
      url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      note: "overview · high-res demo bed",
    },
    blank: {
      label: "Blank",
      url: "https://www.youtube.com/@SpaceX/live",
      note: "blank / gy resolve path (live-first)",
      preferBlank: true,
    },
    demo: {
      label: "Demo",
      url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      note: "Big Buck Bunny · 1080p path",
    },
    live: {
      label: "Live",
      url: "https://www.youtube.com/@NASA/live",
      note: "live sample · yt-dlp / blank",
    },
    cam: {
      label: "Cam",
      url: "device:0",
      note: "local camera via ffmpeg avfoundation/v4l2",
    },
    /** Continuity / tethered iPhone (macOS Continuity Camera → device index) */
    phone: {
      label: "Phone",
      url: "device:0",
      note: "Continuity Camera / UVC · or GY ingest device:0",
      preferBlank: false,
    },
    /** GrokYtalkY hub HLS pipe (multi-stream / HDRI ladder) */
    gydev: {
      label: "GY cam",
      url: "gy:device:0",
      note: "gy serve ingest → HLS · multi HDRI streams",
      preferBlank: false,
    },
  };

  const state = {
    hls: null,
    jobId: null,
    playing: false,
    tools: null,
    lastPlay: null,
    lastMeta: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(msg, cls) {
    const el = $("sv-status");
    if (el) {
      el.textContent = msg || "";
      el.className = "sv-status" + (cls ? " " + cls : "");
    }
    const pill = $("video-feed-pill");
    if (pill) {
      pill.textContent =
        cls === "ok" ? "live" : cls === "err" ? "err" : cls === "warn" ? "…" : "idle";
      pill.className =
        "sb-summary-meta" +
        (cls === "ok" ? " live" : cls === "err" ? " err" : cls === "warn" ? " hot" : "");
    }
  }

  function loadSectionState() {
    try {
      return JSON.parse(localStorage.getItem(LS_SECTIONS) || "{}");
    } catch {
      return {};
    }
  }

  function saveSectionState(map) {
    try {
      localStorage.setItem(LS_SECTIONS, JSON.stringify(map));
    } catch (_) {}
  }

  function wireCollapsibleSections() {
    const saved = loadSectionState();
    document.querySelectorAll("details.sb-section[data-sb-key]").forEach((d) => {
      const key = d.dataset.sbKey;
      if (key && Object.prototype.hasOwnProperty.call(saved, key)) {
        d.open = !!saved[key];
      } else {
        d.open = false;
      }
      d.addEventListener("toggle", () => {
        const m = loadSectionState();
        m[key] = d.open;
        saveSectionState(m);
      });
    });
  }

  function histLoad() {
    try {
      return JSON.parse(localStorage.getItem(LS_HISTORY) || "[]");
    } catch {
      return [];
    }
  }

  function histPush(entry) {
    const list = histLoad().filter((h) => h.url !== entry.url);
    list.unshift(entry);
    const next = list.slice(0, 12);
    try {
      localStorage.setItem(LS_HISTORY, JSON.stringify(next));
    } catch (_) {}
    renderHistory();
  }

  function renderHistory() {
    const box = $("sv-history");
    if (!box) return;
    box.innerHTML = "";
    histLoad().forEach((h) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sv-hist-item";
      b.title = h.url;
      b.textContent = (h.title || h.url).slice(0, 64);
      b.addEventListener("click", () => {
        if ($("sv-url")) $("sv-url").value = h.url;
        playUrl(h.url);
      });
      box.appendChild(b);
    });
  }

  async function api(path, opts) {
    const r = await fetch(path, {
      cache: "no-store",
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts && opts.headers),
      },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(j.error || j.message || path + " " + r.status);
      err.payload = j;
      throw err;
    }
    return j;
  }

  function destroyHls() {
    if (state.hls) {
      try {
        state.hls.destroy();
      } catch (_) {}
      state.hls = null;
    }
  }

  function attachStream(playUrl, meta) {
    const video = $("sidebar-video-el");
    const stage = video?.closest(".sv-stage");
    if (!video || !playUrl) return;

    destroyHls();
    video.pause();
    video.removeAttribute("src");
    video.load();

    const isHls =
      /\.m3u8(\?|$)/i.test(playUrl) ||
      (meta && (meta.streamKind === "hls" || meta.kind === "hls"));

    const onReady = () => {
      if (stage) stage.classList.add("has-src", "playing");
      state.playing = true;
      // WKWebView / browser autoplay policy: start muted, then play
      try {
        video.muted = true;
        video.setAttribute("muted", "");
        video.playsInline = true;
      } catch (_) {}
      const p = video.play();
      if (p && typeof p.then === "function") {
        p.catch(() => {
          // retry once after a tick (common after HLS attach)
          setTimeout(() => {
            try {
              video.muted = true;
              video.play().catch(() => {});
            } catch (_) {}
          }, 200);
        });
      }
    };

    const onError = () => {
      setStatus(
        "In-window play failed (CORS?) — use Pop blank / ffplay / Pop out",
        "warn"
      );
    };
    video.addEventListener("error", onError, { once: true });

    if (isHls) {
      if (window.Hls && window.Hls.isSupported()) {
        const hls = new window.Hls({
          enableWorker: true,
          lowLatencyMode: true,
          maxBufferLength: 20,
        });
        state.hls = hls;
        hls.loadSource(playUrl);
        hls.attachMedia(video);
        hls.on(window.Hls.Events.MANIFEST_PARSED, onReady);
        hls.on(window.Hls.Events.ERROR, (_, data) => {
          if (!data) return;
          if (!data.fatal) return;
          // Recover common X/broadcast glitches instead of dying
          try {
            if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
              setStatus("HLS network glitch · recovering…", "warn");
              hls.startLoad();
              return;
            }
            if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
              setStatus("HLS media glitch · recovering…", "warn");
              hls.recoverMediaError();
              return;
            }
          } catch (_) {}
          setStatus("HLS error — try Pop blank / ffplay", "err");
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = playUrl;
        video.addEventListener("loadedmetadata", onReady, { once: true });
      } else {
        setStatus("HLS needs hls.js — use Pop blank / ffplay", "err");
        return;
      }
    } else {
      video.src = playUrl;
      video.addEventListener("loadedmetadata", onReady, { once: true });
    }
    state.lastPlay = playUrl;
    state.lastMeta = meta || null;
  }

  async function playUrl(raw, opts) {
    opts = opts || {};
    const url = (raw || "").trim();
    if (!url) {
      setStatus("enter a URL, @handle, x:spacexai, or device:0", "warn");
      return;
    }
    const quality = $("sv-quality")?.value || "1080";
    setStatus("resolving… " + url.slice(0, 48), "warn");
    document.querySelectorAll(".sv-chip").forEach((c) => c.classList.remove("active"));

    try {
      const body = {
        url: url,
        quality: quality,
        restream: true,
        prefer_blank: opts.preferBlank !== false,
        prefer_gy: true,
      };
      const r = await api("/api/media/resolve", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (r.ok === false) {
        setStatus(r.error || r.message || "resolve failed", "err");
        // Still offer popout
        state.lastMeta = r;
        return;
      }

      state.jobId = r.jobId || null;
      const play =
        r.play ||
        r.video ||
        (r.jobId ? "/api/media/hls/" + r.jobId + "/index.m3u8" : null);

      if (!play) {
        setStatus(r.error || r.message || "no playable URL — try Pop blank", "err");
        state.lastMeta = r;
        return;
      }

      attachStream(play, r);
      const via = r.via || "lab";
      const title = r.title || url;
      setStatus(
        (r.live ? "LIVE · " : "") +
          title.slice(0, 40) +
          " · " +
          via +
          (r.quality ? " · " + r.quality : ""),
        "ok"
      );
      histPush({ url: url, title: title, t: Date.now(), via: via });
      state.lastMeta = r;
      // Publish active feed so chat Stream pin can pipe a low-res preview
      publishActiveFeed({
        playing: true,
        play: play,
        input: url,
        title: title,
        jobId: r.jobId || state.jobId || "",
        via: via,
        live: !!r.live,
        quality: r.quality || quality,
        streamKind: r.streamKind || (/\.m3u8/i.test(play) ? "hls" : "progressive"),
      });
    } catch (e) {
      setStatus(
        (e.message || String(e)) + " — is native Lab up? Media API required.",
        "err"
      );
    }
  }

  async function stopStream() {
    destroyHls();
    const video = $("sidebar-video-el");
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    const stage = document.querySelector(".sv-stage");
    if (stage) stage.classList.remove("playing", "has-src");
    state.playing = false;
    try {
      await api("/api/media/stop", {
        method: "POST",
        body: JSON.stringify({ jobId: state.jobId }),
      });
    } catch (_) {}
    state.jobId = null;
    publishActiveFeed({ playing: false, play: "" });
    setStatus("stopped", "");
  }

  /** Bus for chat Stream pin low-res pipe (same-origin HLS when restreamed). */
  function publishActiveFeed(payload) {
    const body = Object.assign(
      {
        playing: !!payload.playing,
        play: payload.play || "",
        input: payload.input || "",
        title: payload.title || "",
        jobId: payload.jobId || "",
        via: payload.via || "stream",
        live: !!payload.live,
        quality: payload.quality || "",
      },
      payload
    );
    try {
      localStorage.setItem("lab.media.active.v1", JSON.stringify(body));
    } catch (_) {}
    // Broadcast to other lab windows (chat pin)
    try {
      window.dispatchEvent(
        new CustomEvent("lab:media-active", { detail: body })
      );
    } catch (_) {}
    fetch("/api/media/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    }).catch(() => {});
  }

  async function openFfplay() {
    const url = ($("sv-url")?.value || "").trim();
    if (!url) {
      setStatus("URL required for ffplay", "warn");
      return;
    }
    setStatus("launching ffplay pop-out…", "warn");
    try {
      const r = await api("/api/media/ffplay", {
        method: "POST",
        body: JSON.stringify({
          url: url,
          quality: $("sv-quality")?.value || "1080",
        }),
      });
      setStatus(
        r.message || (r.ok ? "ffplay pop-out launched" : r.error || "ffplay failed"),
        r.ok ? "ok" : "err"
      );
    } catch (e) {
      setStatus(e.message || String(e), "err");
    }
  }

  /** GrokYtalkY blank / GY burst pop-out */
  async function popout(mode) {
    const url = ($("sv-url")?.value || "").trim();
    if (!url) {
      setStatus("URL required for pop-out", "warn");
      return;
    }
    mode = mode || "auto";
    setStatus("pop-out… " + mode, "warn");
    try {
      // Prefer dedicated popout endpoint on native
      let r = null;
      try {
        r = await api("/api/media/popout", {
          method: "POST",
          body: JSON.stringify({
            url: url,
            mode: mode,
            quality: $("sv-quality")?.value || "1080",
          }),
        });
      } catch (_) {
        r = null;
      }

      if (mode === "ffplay") {
        await openFfplay();
        return;
      }

      const blank =
        (r && r.popout_blank) ||
        (state.lastMeta && state.lastMeta.popout_blank) ||
        "http://127.0.0.1:5173/?url=" + encodeURIComponent(url);
      const gy =
        (r && r.popout_gy) ||
        (state.lastMeta && state.lastMeta.popout_gy) ||
        "http://127.0.0.1:9876/burst.html?url=" + encodeURIComponent(url);

      let target = blank;
      if (mode === "gy") target = gy;
      else if (mode === "blank") target = blank;
      else if (r && r.via === "gy-hub") target = gy;
      else if (r && r.gy_up && !r.blank_up) target = gy;

      // Lab Browser window if control bus available
      try {
        await fetch("/api/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "show_browser",
          }),
        });
        await fetch("/api/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "navigate",
            target: "browser",
            url: target,
          }),
        });
        setStatus("Pop-out → Lab Browser · " + target.slice(0, 48), "ok");
        return;
      } catch (_) {}

      // OS browser fallback
      window.open(target, "_blank", "noopener,noreferrer");
      setStatus("Pop-out → " + target.slice(0, 56), "ok");
    } catch (e) {
      setStatus(e.message || String(e), "err");
    }
  }

  /** Pop video into a lightweight OS window with the resolved play URL */
  function popoutVideoWindow() {
    const play = state.lastPlay;
    if (!play) {
      setStatus("Play a stream first, then Pop video", "warn");
      return;
    }
    const html =
      "<!DOCTYPE html><html><head><meta charset=utf-8><title>Lab Stream Pop-out</title>" +
      "<style>html,body{margin:0;background:#000;height:100%}video{width:100%;height:100%;object-fit:contain}</style></head>" +
      "<body><video src=\"" +
      play.replace(/"/g, "&quot;") +
      "\" controls autoplay playsinline></video></body></html>";
    const w = window.open("", "lab-stream-pop", "width=960,height=540");
    if (w) {
      w.document.write(html);
      w.document.close();
      setStatus("Pop video window opened", "ok");
    } else {
      setStatus("Pop-up blocked — allow pop-ups for Lab", "err");
    }
  }

  async function copyUrl() {
    const url = ($("sv-url")?.value || state.lastPlay || "").trim();
    if (!url) {
      setStatus("nothing to copy", "warn");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Copied: " + url.slice(0, 48), "ok");
    } catch (e) {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setStatus("Copied (fallback)", "ok");
      } catch (_) {
        setStatus("Copy failed: " + e, "err");
      }
      ta.remove();
    }
  }

  async function pasteUrl() {
    try {
      const t = await navigator.clipboard.readText();
      if (t && $("sv-url")) {
        $("sv-url").value = t.trim();
        setStatus("Pasted — hit Play", "ok");
      }
    } catch (e) {
      setStatus("Paste needs clipboard permission — ⌘V into URL field", "warn");
      $("sv-url")?.focus();
    }
  }

  async function refreshTools() {
    try {
      state.tools = await api("/api/media/tools");
      const t = state.tools;
      const bits = [];
      if (t.ytdlp) bits.push("yt-dlp");
      if (t.ffmpeg) bits.push("ffmpeg");
      if (t.ffplay) bits.push("ffplay");
      if (t.blank) bits.push("blank");
      if (t.gy_hub) bits.push("gy hub");
      if (!state.playing) {
        setStatus(
          bits.length
            ? bits.join(" · ") + " ready · SpaceXAI / X feeds"
            : "no media tools — install yt-dlp ffmpeg · start blank/gy",
          bits.length ? "" : "warn"
        );
      }
    } catch {
      if (!state.playing)
        setStatus("media API offline — rebuild/relaunch native Lab", "warn");
    }
  }

  function wirePresets() {
    document.querySelectorAll(".sv-chip[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.preset;
        const p = PRESETS[key];
        if (!p) return;
        document.querySelectorAll(".sv-chip").forEach((c) => c.classList.remove("active"));
        btn.classList.add("active");
        if ($("sv-url")) $("sv-url").value = p.url;
        playUrl(p.url, { preferBlank: !!p.preferBlank });
      });
    });
  }

  function wireForm() {
    $("sv-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      playUrl($("sv-url")?.value);
    });
    $("sv-stop")?.addEventListener("click", () => stopStream());
    $("sv-ffplay")?.addEventListener("click", () => openFfplay());
    $("sv-pop-blank")?.addEventListener("click", () => popout("blank"));
    $("sv-pop-gy")?.addEventListener("click", () => popout("gy"));
    $("sv-pop-ffplay")?.addEventListener("click", () => popout("ffplay"));
    $("sv-pop-video")?.addEventListener("click", () => popoutVideoWindow());
    $("sv-copy")?.addEventListener("click", () => copyUrl());
    $("sv-paste")?.addEventListener("click", () => pasteUrl());

    // Paste into URL field works; also catch paste on stage
    $("sv-url")?.addEventListener("paste", () => {
      setTimeout(() => setStatus("URL pasted — Play when ready", ""), 50);
    });
  }

  function wireLabEvents() {
    window.addEventListener("lab:media-play", (ev) => {
      const d = (ev && ev.detail) || {};
      const url = d.url || d.q || "";
      if (url && $("sv-url")) $("sv-url").value = url;
      const sec = $("sb-sec-video");
      if (sec) sec.open = true;
      playUrl(url, { preferBlank: !!d.preferBlank });
    });
    window.addEventListener("lab:media-stop", () => stopStream());
  }

  function autoplayFromQuery() {
    try {
      const q = new URLSearchParams(location.search || "");
      const u = (q.get("url") || q.get("play") || q.get("src") || "").trim();
      if (!u) return;
      if ($("sv-url")) $("sv-url").value = u;
      // Slight delay so hls.js / form are wired
      setTimeout(() => playUrl(u, { preferBlank: false }), 120);
    } catch (_) {}
  }

  function init() {
    wireCollapsibleSections();
    wirePresets();
    wireForm();
    wireLabEvents();
    renderHistory();
    refreshTools();
    // Default SpaceXAI feed into the field for discoverability
    if ($("sv-url") && !$("sv-url").value) {
      $("sv-url").placeholder =
        "https://x.com/i/broadcasts/… · @spacexai · x:spacexai · paste";
    }
    window.LabVideo = {
      play: playUrl,
      stop: stopStream,
      tools: () => state.tools,
      popout: popout,
      copy: copyUrl,
      paste: pasteUrl,
      presets: PRESETS,
      active: () => ({
        playing: state.playing,
        play: state.lastPlay,
        meta: state.lastMeta,
        jobId: state.jobId,
      }),
      publishActive: publishActiveFeed,
    };
    autoplayFromQuery();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
