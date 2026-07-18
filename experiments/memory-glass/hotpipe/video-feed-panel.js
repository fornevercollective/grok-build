/* Memory Glass · collapsible streaming video handler (side rail)
 * Patterns stolen from architecture-lab/video-feed.js + GrokYtalkY blank/gy/ffplay.
 * Agent can call window.__mgVideo.open(url) / .ffplay(url) / .popBlank(url).
 * Under the hood: yt-dlp · ffmpeg · ffplay via scripts/mg-video-feed.sh (native helper).
 * VER: video-feed-panel-v1
 */
(function () {
  "use strict";
  var VER = "video-feed-panel-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._videoFeedVer === VER) return;
  HP._videoFeedVer = VER;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "info", String(m || ""), "vid");
    } catch (e) {}
  }

  var LS = "mg.video.feed.v1";
  var PRESETS = {
    spacex: { label: "SpaceX live", url: "https://www.youtube.com/@SpaceX/live", preferBlank: true },
    nasa: { label: "NASA live", url: "https://www.youtube.com/@NASA/live", preferBlank: true },
    xai: { label: "xAI X", url: "https://x.com/xai", preferBlank: true },
    spacexai: { label: "SpaceXAI", url: "https://x.com/spacexai", preferBlank: true },
    starship: { label: "Starship X", url: "https://x.com/SpaceX", preferBlank: true },
    demo: { label: "Demo", url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", preferBlank: false },
  };

  var state = {
    ver: VER,
    open: false,
    url: "",
    history: [],
    lastStatus: "",
    tools: { ytdlp: null, ffmpeg: null, ffplay: null },
  };

  try {
    var saved = JSON.parse(localStorage.getItem(LS) || "{}");
    if (saved.url) state.url = saved.url;
    if (Array.isArray(saved.history)) state.history = saved.history.slice(0, 40);
    if (saved.open) state.open = !!saved.open;
  } catch (e) {}

  function persist() {
    try {
      localStorage.setItem(
        LS,
        JSON.stringify({ url: state.url, history: state.history.slice(0, 40), open: state.open })
      );
    } catch (e) {}
  }

  function pushHist(url) {
    if (!url) return;
    state.history = [url].concat(state.history.filter(function (u) {
      return u !== url;
    })).slice(0, 40);
    persist();
  }

  /** Native bridge: ipc op media_feed → mg-video-feed.sh (Rust spawns). Clipboard fallback. */
  function nativeMedia(op, payload) {
    var url = (payload && payload.url) || state.url || "";
    var body = { op: "media_feed", media_op: op, url: url };
    try {
      if (window.ipc && typeof window.ipc.postMessage === "function") {
        window.ipc.postMessage(JSON.stringify(body));
        state.lastStatus = op + " · ipc → mg-video-feed.sh";
        log("ok", state.lastStatus + " · " + String(url).slice(0, 60));
        paintStatus();
        return { ok: true, via: "ipc" };
      }
    } catch (e) {}
    var cmd =
      'bash "/Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass/scripts/mg-video-feed.sh" ' +
      op +
      (url ? " " + JSON.stringify(url) : "");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cmd);
      }
    } catch (e2) {}
    state.lastStatus = op + " · cmd copied (no ipc)";
    log("info", state.lastStatus + " · " + String(url).slice(0, 60));
    paintStatus();
    return { ok: true, via: "clipboard", cmd: cmd };
  }

  function openInBrowser(url) {
    url = url || state.url;
    if (!url) return;
    pushHist(url);
    try {
      if (window.ipc) {
        window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
        state.lastStatus = "navigate " + url.slice(0, 48);
        paintStatus();
        return;
      }
    } catch (e) {}
    window.open(url, "_blank", "noopener,noreferrer");
    state.lastStatus = "pop browser " + url.slice(0, 48);
    paintStatus();
  }

  function popBlank(url) {
    // GrokYtalkY blank / external player surface
    return nativeMedia("blank", { url: url || state.url });
  }

  function popGy(url) {
    return nativeMedia("gy", { url: url || state.url });
  }

  function ffplay(url) {
    return nativeMedia("ffplay", { url: url || state.url });
  }

  function ffmpegProbe(url) {
    return nativeMedia("probe", { url: url || state.url });
  }

  function ytdlp(url) {
    return nativeMedia("ytdlp", { url: url || state.url });
  }

  function ensureStyles() {
    if (document.getElementById("mg-vid-css")) return;
    var st = document.createElement("style");
    st.id = "mg-vid-css";
    st.textContent = [
      "#mg-vid-rail{position:fixed;top:auto;bottom:48px;left:0;z-index:119;max-height:46%;display:flex;flex-direction:row;",
      "  font:600 9px/1.25 ui-monospace,Menlo,monospace;pointer-events:none}",
      "#mg-vid-tab{pointer-events:auto;writing-mode:vertical-rl;",
      "  appearance:none;cursor:pointer;border:1px solid rgba(160,180,200,0.28);",
      "  background:rgba(10,12,16,0.94);color:rgba(160,210,255,0.95);padding:10px 6px;",
      "  border-radius:0 4px 4px 0;letter-spacing:0.12em;text-transform:uppercase}",
      "#mg-vid-panel{pointer-events:auto;width:0;overflow:hidden;transition:width .18s ease;",
      "  background:rgba(8,10,14,0.97);border-right:1px solid rgba(160,180,200,0.28);",
      "  color:rgba(210,225,240,0.92);display:flex;flex-direction:column;max-height:calc(100vh - 56px)}",
      "#mg-vid-rail.open #mg-vid-panel{width:min(380px,90vw)}",
      "#mg-vid-head{display:flex;justify-content:space-between;padding:8px 10px;",
      "  border-bottom:1px solid rgba(120,150,220,0.22);letter-spacing:0.1em;text-transform:uppercase}",
      "#mg-vid-url{width:100%;box-sizing:border-box;margin:6px 8px;padding:6px;",
      "  background:rgba(0,0,0,0.35);border:1px solid rgba(120,150,220,0.3);color:inherit;font:inherit}",
      "#mg-vid-acts{display:flex;flex-wrap:wrap;gap:4px;padding:0 8px 6px}",
      "#mg-vid-acts button{appearance:none;cursor:pointer;border:1px solid rgba(140,170,230,0.35);",
      "  background:rgba(12,14,24,0.95);color:inherit;padding:5px 7px;border-radius:3px;",
      "  text-transform:uppercase;letter-spacing:0.06em}",
      "#mg-vid-acts button.hot{border-color:rgba(255,180,100,0.5);color:rgba(255,220,180,0.95)}",
      "#mg-vid-presets{display:flex;flex-wrap:wrap;gap:4px;padding:0 8px 6px}",
      "#mg-vid-presets button{appearance:none;cursor:pointer;border:1px solid rgba(100,130,180,0.3);",
      "  background:rgba(10,12,20,0.9);color:inherit;padding:4px 6px;border-radius:3px;font:inherit}",
      "#mg-vid-hist{flex:1;overflow:auto;padding:0 8px 8px;min-height:60px;opacity:0.85}",
      "#mg-vid-hist div{padding:3px 0;border-bottom:1px solid rgba(80,100,140,0.15);cursor:pointer;",
      "  word-break:break-all}",
      "#mg-vid-status{padding:6px 8px 10px;opacity:0.85;font-weight:500}",
      "#mg-vid-stage{margin:0 8px 6px;height:140px;border:1px solid rgba(120,150,220,0.22);",
      "  border-radius:3px;background:rgba(0,0,0,0.4);display:flex;align-items:center;",
      "  justify-content:center;color:rgba(160,180,220,0.55);overflow:hidden}",
      "#mg-vid-stage video{max-width:100%;max-height:100%}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  var rail, statusEl, urlEl, stageEl;

  function paintStatus() {
    if (statusEl)
      statusEl.textContent =
        VER +
        " · " +
        (state.lastStatus || "yt-dlp · ffmpeg · ffplay · blank · gy · agent-ready");
  }

  function paintHist() {
    var h = rail && rail.querySelector("#mg-vid-hist");
    if (!h) return;
    h.innerHTML = "";
    state.history.forEach(function (u) {
      var d = document.createElement("div");
      d.textContent = u;
      d.onclick = function () {
        state.url = u;
        if (urlEl) urlEl.value = u;
        persist();
      };
      h.appendChild(d);
    });
  }

  function setOpen(on) {
    state.open = !!on;
    if (rail) rail.classList.toggle("open", state.open);
    persist();
  }

  function setUrl(u) {
    state.url = u || "";
    if (urlEl) urlEl.value = state.url;
    persist();
  }

  function mount() {
    ensureStyles();
    if (document.getElementById("mg-vid-rail")) return;
    rail = document.createElement("div");
    rail.id = "mg-vid-rail";
    rail.innerHTML =
      '<button type="button" id="mg-vid-tab" title="Video feed">VID</button>' +
      '<div id="mg-vid-panel">' +
      '  <div id="mg-vid-head"><span>Stream · Feed</span>' +
      '  <button type="button" id="mg-vid-close" style="appearance:none;background:transparent;border:0;color:inherit;cursor:pointer">×</button></div>' +
      '  <input id="mg-vid-url" placeholder="https://… stream / yt / x broadcast" />' +
      '  <div id="mg-vid-acts">' +
      '    <button type="button" id="mg-vid-go" class="hot">OPEN</button>' +
      '    <button type="button" id="mg-vid-blank">BLANK</button>' +
      '    <button type="button" id="mg-vid-gy">GY</button>' +
      '    <button type="button" id="mg-vid-ffplay">FFPLAY</button>' +
      '    <button type="button" id="mg-vid-ytdlp">YT-DLP</button>' +
      '    <button type="button" id="mg-vid-probe">PROBE</button>' +
      "  </div>" +
      '  <div id="mg-vid-presets"></div>' +
      '  <div id="mg-vid-stage">pop-out · no in-page autoplay thrash</div>' +
      '  <div id="mg-vid-hist"></div>' +
      '  <div id="mg-vid-status"></div>' +
      "</div>";
    (document.body || document.documentElement).appendChild(rail);
    statusEl = rail.querySelector("#mg-vid-status");
    urlEl = rail.querySelector("#mg-vid-url");
    stageEl = rail.querySelector("#mg-vid-stage");
    urlEl.value = state.url || "";

    rail.querySelector("#mg-vid-tab").onclick = function () {
      setOpen(!state.open);
    };
    rail.querySelector("#mg-vid-close").onclick = function () {
      setOpen(false);
    };
    urlEl.onchange = function () {
      setUrl(urlEl.value.trim());
    };
    rail.querySelector("#mg-vid-go").onclick = function () {
      setUrl(urlEl.value.trim());
      openInBrowser(state.url);
    };
    rail.querySelector("#mg-vid-blank").onclick = function () {
      setUrl(urlEl.value.trim());
      popBlank(state.url);
    };
    rail.querySelector("#mg-vid-gy").onclick = function () {
      setUrl(urlEl.value.trim());
      popGy(state.url);
    };
    rail.querySelector("#mg-vid-ffplay").onclick = function () {
      setUrl(urlEl.value.trim());
      ffplay(state.url);
    };
    rail.querySelector("#mg-vid-ytdlp").onclick = function () {
      setUrl(urlEl.value.trim());
      ytdlp(state.url);
    };
    rail.querySelector("#mg-vid-probe").onclick = function () {
      setUrl(urlEl.value.trim());
      ffmpegProbe(state.url);
    };

    var pre = rail.querySelector("#mg-vid-presets");
    Object.keys(PRESETS).forEach(function (k) {
      var p = PRESETS[k];
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = p.label;
      b.onclick = function () {
        setUrl(p.url);
        if (p.preferBlank) popBlank(p.url);
        else openInBrowser(p.url);
      };
      pre.appendChild(b);
    });

    if (state.open) rail.classList.add("open");
    paintHist();
    paintStatus();
    log("ok", VER + " · left VID rail · agent __mgVideo");
  }

  window.__mgVideo = {
    ver: VER,
    state: state,
    presets: PRESETS,
    open: function (url) {
      if (url) setUrl(url);
      setOpen(true);
      if (url) openInBrowser(url);
    },
    toggle: function () {
      setOpen(!state.open);
    },
    setUrl: setUrl,
    ffplay: ffplay,
    ytdlp: ytdlp,
    probe: ffmpegProbe,
    popBlank: popBlank,
    popGy: popGy,
    openInBrowser: openInBrowser,
    report: function () {
      return VER + " url=" + (state.url || "").slice(0, 48) + " · " + (state.lastStatus || "");
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
