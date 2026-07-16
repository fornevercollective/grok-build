/**
 * Sidebar high-res stream feed — yt-dlp · ffmpeg · ffplay · blank · gy hub
 * Sits above Architecture Lab; collapsible sections persist in localStorage.
 */
(function () {
  "use strict";

  const LS_SECTIONS = "lab.sb.sections.v2";
  const LS_HISTORY = "lab.media.history.v1";

  const PRESETS = {
    overview: {
      label: "Overview",
      // High-res public demo used as architecture-lab “overview” bed
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
  };

  const state = {
    hls: null,
    jobId: null,
    playing: false,
    tools: null,
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
      pill.textContent = cls === "ok" ? "live" : cls === "err" ? "err" : cls === "warn" ? "…" : "idle";
      pill.className = "sb-summary-meta" + (cls === "ok" ? " live" : cls === "err" ? " err" : cls === "warn" ? " hot" : "");
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

  /** Persist open/closed for all details.sb-section[data-sb-key] (default collapsed) */
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
      video.play().catch(() => {
        /* autoplay may require mute — already muted */
      });
    };

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
          if (data?.fatal) {
            setStatus("HLS error: " + (data.type || "fatal"), "err");
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = playUrl;
        video.addEventListener("loadedmetadata", onReady, { once: true });
      } else {
        setStatus("HLS needs hls.js or Safari", "err");
        return;
      }
    } else {
      video.src = playUrl;
      video.addEventListener("loadedmetadata", onReady, { once: true });
    }
  }

  async function playUrl(raw, opts) {
    opts = opts || {};
    const url = (raw || "").trim();
    if (!url) {
      setStatus("enter a URL, @handle, or device:0", "warn");
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
        prefer_blank: !!opts.preferBlank,
        prefer_gy: true,
      };
      const r = await api("/api/media/resolve", {
        method: "POST",
        body: JSON.stringify(body),
      });

      state.jobId = r.jobId || null;
      const play =
        r.play ||
        r.video ||
        (r.jobId ? "/api/media/hls/" + r.jobId + "/index.m3u8" : null);

      if (!play) {
        setStatus(r.error || r.message || "no playable URL", "err");
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
    } catch (e) {
      setStatus(e.message || String(e), "err");
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
    setStatus("stopped", "");
  }

  async function openFfplay() {
    const url = ($("sv-url")?.value || "").trim();
    if (!url) {
      setStatus("URL required for ffplay", "warn");
      return;
    }
    setStatus("launching ffplay…", "warn");
    try {
      const r = await api("/api/media/ffplay", {
        method: "POST",
        body: JSON.stringify({
          url: url,
          quality: $("sv-quality")?.value || "1080",
        }),
      });
      setStatus(r.message || (r.ok ? "ffplay launched" : "ffplay failed"), r.ok ? "ok" : "err");
    } catch (e) {
      setStatus(e.message || String(e), "err");
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
            ? bits.join(" · ") + " ready"
            : "no media tools — install yt-dlp ffmpeg",
          bits.length ? "" : "warn"
        );
      }
    } catch {
      if (!state.playing) setStatus("start ./serve.sh for media APIs", "warn");
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
  }

  /** Conversation / mesh / notes can request a stream: lab:media-play */
  function wireLabEvents() {
    window.addEventListener("lab:media-play", (ev) => {
      const d = (ev && ev.detail) || {};
      const url = d.url || d.q || "";
      if (url && $("sv-url")) $("sv-url").value = url;
      // ensure video section open
      const sec = $("sb-sec-video");
      if (sec) sec.open = true;
      playUrl(url, { preferBlank: !!d.preferBlank });
    });
    window.addEventListener("lab:media-stop", () => stopStream());
  }

  function init() {
    wireCollapsibleSections();
    wirePresets();
    wireForm();
    wireLabEvents();
    renderHistory();
    refreshTools();
    // expose for other lab modules
    window.LabVideo = {
      play: playUrl,
      stop: stopStream,
      tools: () => state.tools,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
