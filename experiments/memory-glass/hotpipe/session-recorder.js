/* Memory Glass · session recorder (P2) + X draft from run metrics / board (P4)
 * Cam still-pipe samples + optional screen/page snapshot → local pack.
 * X draft = activity leaderboard synopsis (you post — no auto-post).
 * VER: session-rec-v2-board
 */
(function () {
  "use strict";
  var VER = "session-rec-v2-board";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._sessionRecVer === VER) return;
  HP._sessionRecVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "rec");
    } catch (e) {}
  }

  var recording = false;
  var frames = [];
  var meta = {};
  var timer = null;
  var recBtn = null;

  function ensureUi() {
    if (recBtn || document.getElementById("mg-rec-chip")) return;
    if (!document.getElementById("mg-rec-css")) {
      var st = document.createElement("style");
      st.id = "mg-rec-css";
      st.textContent = [
        "#mg-rec-chip{position:fixed;left:12px;bottom:calc(12px + var(--mg-kb-h,0px));",
        "  z-index:2147483002;display:flex;gap:6px;align-items:center;",
        "  padding:6px 10px;border-radius:10px;",
        "  background:rgba(10,12,16,0.48);backdrop-filter:blur(20px) saturate(1.3);",
        "  -webkit-backdrop-filter:blur(20px) saturate(1.3);",
        "  border:1px solid rgba(255,255,255,0.16);",
        "  box-shadow:0 6px 18px rgba(0,0,0,0.16);",
        "  font:650 9px/1 system-ui;letter-spacing:0.1em;text-transform:uppercase;",
        "  color:rgba(244,246,250,0.92);pointer-events:auto}",
        "#mg-rec-chip button{appearance:none;cursor:pointer;border:1px solid rgba(255,255,255,0.16);",
        "  background:rgba(255,255,255,0.08);color:inherit;padding:5px 8px;border-radius:6px;",
        "  font:inherit;letter-spacing:0.08em}",
        "#mg-rec-chip button.on{border-color:rgba(255,100,100,0.55);color:rgba(255,160,160,0.98);",
        "  background:rgba(120,30,30,0.35)}",
        "#mg-rec-chip .dot{width:8px;height:8px;border-radius:50%;background:rgba(120,120,120,0.5)}",
        "#mg-rec-chip.on .dot{background:rgba(255,80,80,0.95);box-shadow:0 0 8px rgba(255,80,80,0.6)}",
      ].join("");
      (document.head || document.documentElement).appendChild(st);
    }
    recBtn = document.createElement("div");
    recBtn.id = "mg-rec-chip";
    recBtn.innerHTML =
      '<span class="dot"></span>' +
      '<button type="button" id="mg-rec-toggle">REC</button>' +
      '<button type="button" id="mg-rec-snap">SNAP</button>' +
      '<button type="button" id="mg-rec-board">BOARD</button>' +
      '<button type="button" id="mg-rec-x">X DRAFT</button>';
    (document.body || document.documentElement).appendChild(recBtn);
    recBtn.querySelector("#mg-rec-toggle").onclick = function () {
      if (recording) stop();
      else start();
    };
    recBtn.querySelector("#mg-rec-snap").onclick = function () {
      snap("manual");
      try {
        if (window.__mgActivityBoard) window.__mgActivityBoard.submitRun("snap");
      } catch (eB) {}
    };
    recBtn.querySelector("#mg-rec-board").onclick = function () {
      if (window.__mgActivityBoard) window.__mgActivityBoard.toggle();
      else log("board missing");
    };
    recBtn.querySelector("#mg-rec-x").onclick = function () {
      exportXDraft();
    };
  }

  function grabStillPipe() {
    return new Promise(function (resolve) {
      var urls = [
        "http://127.0.0.1:9877/glass.jpg",
        "http://127.0.0.1:9877/live.jpg",
      ];
      var img = new Image();
      img.crossOrigin = "anonymous";
      var i = 0;
      function tryNext() {
        if (i >= urls.length) {
          resolve(null);
          return;
        }
        var u = urls[i++] + "?t=" + Date.now();
        img.onload = function () {
          try {
            var c = document.createElement("canvas");
            c.width = Math.min(640, img.naturalWidth || 640);
            c.height = Math.min(480, img.naturalHeight || 480);
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
            resolve({
              kind: "still-pipe",
              dataUrl: c.toDataURL("image/jpeg", 0.72),
              w: c.width,
              h: c.height,
            });
          } catch (e) {
            tryNext();
          }
        };
        img.onerror = tryNext;
        img.src = u;
      }
      tryNext();
    });
  }

  function grabPageSnapshot() {
    return new Promise(function (resolve) {
      try {
        /* Prefer contrail overlay + composite is hard; capture via html2canvas-free path:
           draw a lightweight viewport note + optional video frame if present */
        var vid = document.querySelector("video");
        if (vid && vid.videoWidth) {
          var c = document.createElement("canvas");
          c.width = Math.min(960, vid.videoWidth);
          c.height = Math.min(540, vid.videoHeight);
          c.getContext("2d").drawImage(vid, 0, 0, c.width, c.height);
          resolve({
            kind: "page-video",
            dataUrl: c.toDataURL("image/jpeg", 0.7),
            w: c.width,
            h: c.height,
          });
          return;
        }
      } catch (e) {}
      /* Fallback: metadata-only frame (no heavy html2canvas dep) */
      resolve({
        kind: "page-meta",
        href: location.href,
        title: document.title,
        t: Date.now(),
      });
    });
  }

  function snap(reason) {
    return Promise.all([grabStillPipe(), grabPageSnapshot()]).then(function (pair) {
      var frame = {
        t: Date.now(),
        reason: reason || "tick",
        still: pair[0],
        page: pair[1],
        contrail: null,
        bloch: null,
        kbatch: null,
      };
      try {
        if (window.__mgContrail) {
          frame.contrail = {
            phrase: window.__mgContrail.stats && window.__mgContrail.stats.lastPhrase,
            report: window.__mgContrail.report && window.__mgContrail.report(),
            dojo: window.__mgContrail.lastDojo && window.__mgContrail.lastDojo(),
          };
        }
      } catch (e) {}
      try {
        if (window.__mgBlochSolve) {
          frame.bloch = {
            report: window.__mgBlochSolve.report(),
            last: (window.__mgBlochSolve.trials || []).slice(-1)[0] || null,
          };
        }
        if (window.__mgQuantum && window.__mgQuantum.state) {
          frame.bloch = frame.bloch || {};
          frame.bloch.theta = window.__mgQuantum.state.theta;
          frame.bloch.phi = window.__mgQuantum.state.phi;
          frame.bloch.seq = (window.__mgQuantum.state.sequence || []).slice(-12);
        }
      } catch (e2) {}
      try {
        if (window.__mgKbatchDojo && window.__mgKbatchDojo.last) {
          frame.kbatch = window.__mgKbatchDojo.last();
        }
      } catch (e3) {}
      frames.push(frame);
      if (frames.length > 120) frames.shift();
      log("snap " + reason + " n=" + frames.length);
      return frame;
    });
  }

  function start() {
    if (recording) return;
    recording = true;
    frames = [];
    meta = {
      startedAt: new Date().toISOString(),
      href: location.href,
      ver: VER,
      note: "local pack only — you post to X",
    };
    ensureUi();
    recBtn.classList.add("on");
    recBtn.querySelector("#mg-rec-toggle").classList.add("on");
    recBtn.querySelector("#mg-rec-toggle").textContent = "STOP";
    snap("start");
    timer = setInterval(function () {
      snap("tick");
    }, 2500);
    log("REC start");
  }

  function stop() {
    if (!recording) return;
    recording = false;
    if (timer) clearInterval(timer);
    timer = null;
    meta.endedAt = new Date().toISOString();
    meta.frameCount = frames.length;
    if (recBtn) {
      recBtn.classList.remove("on");
      recBtn.querySelector("#mg-rec-toggle").classList.remove("on");
      recBtn.querySelector("#mg-rec-toggle").textContent = "REC";
    }
    var pack = buildPack();
    /* submit run metrics to built-in leaderboard */
    try {
      if (window.__mgActivityBoard) {
        pack.run = window.__mgActivityBoard.submitRun("rec-stop", {
          rec: { frames: frames.length, meta: meta },
        });
      }
    } catch (eB) {}
    persistPack(pack);
    log("REC stop n=" + frames.length + (pack.run ? " score=" + pack.run.score : ""));
    return pack;
  }

  function buildPack() {
    var beats = null;
    try {
      if (window.__mgContrail && window.__mgContrail.exportStoryBeats)
        beats = window.__mgContrail.exportStoryBeats();
    } catch (e) {}
    var metrics = null;
    try {
      if (window.__mgActivityBoard) metrics = window.__mgActivityBoard.collectMetrics();
    } catch (eM) {}
    return {
      schema: "mg-session-pack-v2",
      meta: meta,
      frames: frames.map(function (f) {
        /* strip huge dataUrls for JSONL index; keep last 3 full */
        return f;
      }),
      beats: beats,
      metrics: metrics,
      synopsis: metrics && window.__mgActivityBoard
        ? window.__mgActivityBoard.synopsis(metrics)
        : null,
      blochTrials: (window.__mgBlochSolve && window.__mgBlochSolve.trials
        ? window.__mgBlochSolve.trials.slice(-40)
        : []),
      links: {
        gutter: "https://mueee.qbitos.ai/quantum-gutter.html",
        notepad: "https://mueee.qbitos.ai/quantum-notepad.html",
        r0: "https://mueee.qbitos.ai/ugrad-r0.html",
        blackwell: "https://mueee.qbitos.ai/blackwell.html",
        kbatch: "https://kbatch.ugrad.ai/",
        handoff: "https://kbatch.ugrad.ai/handoff/MEMORY-GLASS-KBATCH.md",
        webgrid: "https://neuralink.com/webgrid/",
      },
    };
  }

  function persistPack(pack) {
    try {
      localStorage.setItem("mg.session.lastPackMeta", JSON.stringify(pack.meta));
      /* full pack may be large — store slim index */
      var slim = {
        meta: pack.meta,
        frameCount: (pack.frames || []).length,
        beats: pack.beats,
        blochTrials: pack.blochTrials,
        links: pack.links,
        lastStill: null,
      };
      var frames = pack.frames || [];
      for (var i = frames.length - 1; i >= 0; i--) {
        if (frames[i].still && frames[i].still.dataUrl) {
          slim.lastStill = frames[i].still.dataUrl.slice(0, 200) + "…";
          break;
        }
      }
      localStorage.setItem("mg.session.lastPackSlim", JSON.stringify(slim));
    } catch (e) {}
    /* Download pack JSON for ~/.panda path via user save */
    try {
      var blob = new Blob([JSON.stringify(pack)], { type: "application/json" });
      var a = document.createElement("a");
      var name =
        "mg-session-" +
        (meta.startedAt || Date.now()).toString().replace(/[:.]/g, "-") +
        ".json";
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      log("pack download " + name + " → move to ~/.panda/mg-soak/record/");
    } catch (e2) {
      log("pack persist fail " + e2);
    }
    /* IPC hint for native save if available */
    try {
      if (window.ipc) {
        window.ipc.postMessage(
          JSON.stringify({
            op: "dev_log",
            lvl: "ok",
            msg: "session pack ready · save to ~/.panda/mg-soak/record/",
            src: "rec",
          })
        );
      }
    } catch (e3) {}
  }

  function exportXDraft() {
    /* Prefer built-in leaderboard: run metrics + synopsis + top board */
    var text = null;
    try {
      if (window.__mgActivityBoard && window.__mgActivityBoard.formatXDraft) {
        if (recording) {
          /* mid-run: snapshot current activity onto board */
          window.__mgActivityBoard.submitRun("rec-live");
        }
        text = window.__mgActivityBoard.formatXDraft({
          fresh: !recording,
          kind: recording ? "rec-live" : "x-draft",
        });
      }
    } catch (eBoard) {}

    if (!text) {
      /* fallback if board not injected yet */
      var pack = recording ? buildPack() : null;
      if (!pack) {
        try {
          pack = {
            meta: JSON.parse(localStorage.getItem("mg.session.lastPackMeta") || "{}"),
            beats:
              window.__mgContrail && window.__mgContrail.exportStoryBeats
                ? window.__mgContrail.exportStoryBeats()
                : null,
          };
        } catch (e) {
          pack = {};
        }
      }
      var lines = [];
      lines.push("Memory Glass · run synopsis (manual post)");
      lines.push("");
      if (pack.meta && pack.meta.startedAt) lines.push("⏱ " + pack.meta.startedAt);
      if (location.href) lines.push("🔗 " + location.href.slice(0, 120));
      try {
        if (window.__mgContrail && window.__mgContrail.report)
          lines.push("🕸 " + window.__mgContrail.report());
      } catch (e) {}
      try {
        if (window.__mgBlochSolve && window.__mgBlochSolve.report)
          lines.push("⚛ " + window.__mgBlochSolve.report());
      } catch (e2) {}
      try {
        if (window.__mgWebgridCalib && window.__mgWebgridCalib.scrapeScore) {
          var sc = window.__mgWebgridCalib.scrapeScore();
          if (sc.bps != null || (sc.peak && sc.peak.bps != null))
            lines.push(
              "🎮 " +
                (sc.peak && sc.peak.bps != null ? sc.peak.bps : sc.bps) +
                " BPS · " +
                (sc.peak && sc.peak.ntpm != null ? sc.peak.ntpm : sc.ntpm) +
                " NTPM"
            );
        }
      } catch (eWg) {}
      lines.push("");
      lines.push("#MemoryGlass #WebGrid #KBatch");
      lines.push("(You post — no auto-post)");
      text = lines.join("\n");
    }

    try {
      if (window.ipc)
        window.ipc.postMessage(JSON.stringify({ op: "clipboard_copy", text: text }));
      else if (navigator.clipboard) navigator.clipboard.writeText(text);
    } catch (e) {}
    log("X draft · metrics+board · you post");
    try {
      alert("X draft (run metrics + leaderboard) copied — you post when ready.");
    } catch (e5) {}
    return text;
  }

  ensureUi();

  window.__mgSessionRec = {
    ver: VER,
    start: start,
    stop: stop,
    snap: snap,
    exportXDraft: exportXDraft,
    isRecording: function () {
      return recording;
    },
    report: function () {
      return VER + " rec=" + recording + " frames=" + frames.length;
    },
  };

  log(VER + " · local pack · X draft only");
})();
