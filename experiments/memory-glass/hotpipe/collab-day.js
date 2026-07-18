/* Memory Glass · collab communication day
 * Multi-seat mesh: share scores/runs/chat · Grok brief · X draft (human post).
 * Channels: mg-mesh · ugrad-live · day-localStorage.
 * VER: collab-day-v1
 */
(function () {
  "use strict";
  var VER = "collab-day-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._collabDayVer === VER) return;
  HP._collabDayVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "collab-day");
    } catch (e) {}
  }

  var KEY = "mg.collab.day.v1";
  var day = null;
  var panel = null;
  var open = false;
  var peers = {};
  var chat = [];
  var ch = null;

  try {
    ch = new BroadcastChannel("mg-mesh");
  } catch (e) {
    ch = null;
  }

  function seatId() {
    try {
      if (window.__mgMesh && window.__mgMesh.seatId) return window.__mgMesh.seatId;
    } catch (e) {}
    try {
      return localStorage.getItem("mg.mesh.seat") || "mg-anon";
    } catch (e2) {
      return "mg-anon";
    }
  }

  function loadDay() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || "null");
      if (d && d.id) day = d;
    } catch (e) {}
    return day;
  }

  function saveDay() {
    if (!day) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(day));
    } catch (e) {}
  }

  function ensureDay(opts) {
    opts = opts || {};
    if (day && !opts.force) return day;
    day = {
      id: "day-" + Date.now().toString(36),
      title: opts.title || "collab-comms-day",
      startedAt: new Date().toISOString(),
      host: seatId(),
      events: [],
      scores: [],
      runs: [],
      notes: [],
    };
    saveDay();
    log("day start " + day.id);
    return day;
  }

  function pushEvent(kind, payload) {
    ensureDay();
    var ev = {
      t: Date.now(),
      iso: new Date().toISOString(),
      kind: kind,
      seat: seatId(),
      payload: payload || {},
    };
    day.events.push(ev);
    if (day.events.length > 200) day.events = day.events.slice(-200);
    saveDay();
    return ev;
  }

  function meshSend(type, payload) {
    var msg = {
      v: 1,
      t: type,
      id: seatId(),
      role: "collab-day",
      payload: payload || {},
      ts: Date.now(),
      dayId: day && day.id,
    };
    try {
      if (window.__mgMesh && window.__mgMesh.broadcast)
        window.__mgMesh.broadcast(type, Object.assign({ dayId: day && day.id }, payload || {}));
      else if (ch) ch.postMessage(msg);
    } catch (e) {}
    return msg;
  }

  function onMesh(data) {
    if (!data || data.id === seatId()) return;
    peers[data.id] = {
      id: data.id,
      role: data.role,
      ts: data.ts || Date.now(),
      last: data.t,
      payload: data.payload,
    };
    if (data.t === "day-score" && data.payload) {
      ensureDay();
      day.scores.push({
        from: data.id,
        t: Date.now(),
        score: data.payload,
      });
      if (day.scores.length > 80) day.scores = day.scores.slice(-80);
      saveDay();
      paint();
    }
    if (data.t === "day-run" && data.payload) {
      ensureDay();
      day.runs.push({ from: data.id, t: Date.now(), run: data.payload });
      if (day.runs.length > 40) day.runs = day.runs.slice(-40);
      /* merge peer run into local board if present */
      try {
        if (window.__mgActivityBoard && data.payload.metrics) {
          window.__mgActivityBoard.submitRun("peer-" + (data.id || "").slice(0, 6), data.payload.metrics);
        }
      } catch (e) {}
      saveDay();
      paint();
    }
    if (data.t === "day-chat" && data.payload && data.payload.text) {
      chat.push({
        from: data.id,
        text: String(data.payload.text).slice(0, 280),
        t: Date.now(),
      });
      if (chat.length > 50) chat.shift();
      paint();
    }
  }

  if (ch) {
    var prev = ch.onmessage;
    ch.onmessage = function (ev) {
      try {
        if (typeof prev === "function") prev(ev);
      } catch (e) {}
      try {
        onMesh(ev.data);
      } catch (e2) {}
    };
  }

  function collectScoreSnapshot() {
    var snap = {
      seat: seatId(),
      t: Date.now(),
      href: (location.href || "").slice(0, 120),
    };
    try {
      if (window.__mgWebgridCalib && window.__mgWebgridCalib.scrapeScore) {
        var sc = window.__mgWebgridCalib.scrapeScore();
        snap.webgrid = {
          bps: sc.bps,
          ntpm: sc.ntpm,
          peak: sc.peak,
          grid: sc.grid,
          timer: sc.timer,
        };
      }
    } catch (e) {}
    try {
      if (window.__mgAgentPlayLast) {
        snap.agent = {
          kind: window.__mgAgentPlayLast.kind,
          peakBps: window.__mgAgentPlayLast.peak && window.__mgAgentPlayLast.peak.bps,
          bestBps: window.__mgAgentPlayLast.bestBps,
          clicks: window.__mgAgentPlayLast.clicks,
        };
      }
    } catch (e2) {}
    try {
      if (window.__mgActivityBoard) {
        snap.board = window.__mgActivityBoard.report();
        var lr = window.__mgActivityBoard.lastRun && window.__mgActivityBoard.lastRun();
        if (lr) snap.lastScore = lr.score;
      }
    } catch (e3) {}
    try {
      if (window.__mgContrail && window.__mgContrail.report)
        snap.contrail = window.__mgContrail.report();
    } catch (e4) {}
    try {
      if (window.__mgBlochSolve) snap.bloch = window.__mgBlochSolve.report();
    } catch (e5) {}
    try {
      if (window.__mgMesh) snap.mesh = window.__mgMesh.report();
    } catch (e6) {}
    return snap;
  }

  function shareScore() {
    ensureDay();
    var snap = collectScoreSnapshot();
    day.scores.push({ from: seatId(), t: Date.now(), score: snap });
    pushEvent("score", snap);
    meshSend("day-score", snap);
    log("shared score");
    paint();
    return snap;
  }

  function shareRun() {
    ensureDay();
    var run = null;
    try {
      if (window.__mgActivityBoard) {
        run = window.__mgActivityBoard.submitRun("collab-day");
      }
    } catch (e) {}
    if (!run) {
      run = {
        id: "r" + Date.now().toString(36),
        score: 0,
        synopsis: "empty run",
        metrics: collectScoreSnapshot(),
      };
    }
    var slim = {
      id: run.id,
      score: run.score,
      synopsis: run.synopsis,
      game: run.game,
      kind: run.kind,
      metrics: run.metrics,
    };
    day.runs.push({ from: seatId(), t: Date.now(), run: slim });
    pushEvent("run", slim);
    meshSend("day-run", slim);
    log("shared run " + (run.score || 0));
    paint();
    return slim;
  }

  function chatSend(text) {
    text = String(text || "").trim().slice(0, 280);
    if (!text) return;
    ensureDay();
    chat.push({ from: seatId(), text: text, t: Date.now() });
    pushEvent("chat", { text: text });
    meshSend("day-chat", { text: text });
    paint();
  }

  function buildGrokBrief() {
    ensureDay();
    var lines = [];
    lines.push("# Memory Glass · collab day brief (for Grok Build)");
    lines.push("");
    lines.push("**Day:** " + day.title + " · `" + day.id + "`");
    lines.push("**Started:** " + day.startedAt);
    lines.push("**Host seat:** " + day.host);
    lines.push("**This seat:** " + seatId());
    lines.push("");
    lines.push("## Growth north star");
    lines.push(
      "Read `experiments/memory-glass/docs/MEMORY-GLASS-GROWTH.md` — training + dual-space lab, not Dia clone."
    );
    lines.push("");
    lines.push("## Live snapshot");
    var snap = collectScoreSnapshot();
    lines.push("```json");
    lines.push(JSON.stringify(snap, null, 2).slice(0, 2500));
    lines.push("```");
    lines.push("");
    lines.push("## Day scores (local + mesh)");
    (day.scores || []).slice(-12).forEach(function (s, i) {
      var sc = s.score || {};
      var bps =
        (sc.webgrid && sc.webgrid.peak && sc.webgrid.peak.bps) ||
        (sc.agent && sc.agent.peakBps) ||
        (sc.webgrid && sc.webgrid.bps) ||
        sc.lastScore ||
        "—";
      lines.push(
        (i + 1) +
          ". seat `" +
          String(s.from || "").slice(0, 10) +
          "` · bps/score " +
          bps +
          " · " +
          new Date(s.t).toISOString()
      );
    });
    lines.push("");
    lines.push("## Runs shared");
    (day.runs || []).slice(-8).forEach(function (r) {
      var run = r.run || {};
      lines.push(
        "- `" +
          String(r.from || "").slice(0, 8) +
          "` score " +
          (run.score != null ? run.score : "—") +
          " · " +
          String(run.synopsis || "").slice(0, 80)
      );
    });
    lines.push("");
    lines.push("## Mesh peers");
    Object.keys(peers).forEach(function (k) {
      lines.push("- " + k.slice(0, 12) + " · " + (peers[k].last || peers[k].role || ""));
    });
    if (!Object.keys(peers).length) lines.push("- (no peers yet — open second MG seat)");
    lines.push("");
    lines.push("## Chat (day)");
    chat.slice(-15).forEach(function (c) {
      lines.push("- **" + String(c.from).slice(0, 8) + ":** " + c.text);
    });
    lines.push("");
    lines.push("## Agent next moves");
    lines.push("1. Continue dual-space / WebGrid / board per MEMORY-GLASS-GROWTH.md");
    lines.push("2. Hotpipe JS first; no auto-X");
    lines.push("3. Intel laptop: `__mgWebgridCalib.setPaceProfile('intel')`");
    lines.push("4. Share run after each playthrough; human X draft only");
    lines.push("");
    lines.push("## APIs");
    lines.push("```js");
    lines.push("__mgCollabDay.shareScore(); __mgCollabDay.shareRun();");
    lines.push("__mgCollabDay.exportGrokBrief(); __mgCollabDay.exportXDraft();");
    lines.push("__mgActivityBoard.openLeaderboardWindow({ post: true });");
    lines.push("```");
    lines.push("");
    lines.push("_Generated " + new Date().toISOString() + " · " + VER + "_");
    return lines.join("\n");
  }

  function exportGrokBrief() {
    var text = buildGrokBrief();
    copyText(text);
    try {
      var blob = new Blob([text], { type: "text/markdown" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "mg-collab-day-" + (day && day.id) + ".md";
      a.click();
    } catch (e) {}
    pushEvent("grok-brief", { bytes: text.length });
    log("Grok brief exported");
    return text;
  }

  function exportXDraft() {
    ensureDay();
    var snap = collectScoreSnapshot();
    var lines = [];
    lines.push("Memory Glass · collab day · " + (day.title || "comms"));
    lines.push("");
    try {
      if (window.__mgActivityBoard && window.__mgActivityBoard.formatXDraft) {
        lines.push(window.__mgActivityBoard.formatXDraft({ fresh: true, kind: "collab-day" }));
        var text = lines.join("\n");
        copyText(text);
        pushEvent("x-draft", {});
        log("X draft collab · you post");
        try {
          alert("Collab X draft copied — you post when ready (no auto-post).");
        } catch (e) {}
        return text;
      }
    } catch (e2) {}
    var bps =
      (snap.webgrid && snap.webgrid.peak && snap.webgrid.peak.bps) ||
      (snap.agent && snap.agent.peakBps) ||
      (snap.webgrid && snap.webgrid.bps);
    lines.push("📊 WebGrid " + (bps != null ? bps + " BPS" : "session") + " · mesh seats " + (Object.keys(peers).length + 1));
    lines.push("🕸 dual-space lab · contrail · Bloch · board");
    lines.push("");
    lines.push("#MemoryGlass #WebGrid #KBatch #collab");
    lines.push("(You post — no auto-post)");
    var t2 = lines.join("\n");
    copyText(t2);
    return t2;
  }

  function copyText(text) {
    try {
      if (window.ipc)
        window.ipc.postMessage(JSON.stringify({ op: "clipboard_copy", text: text }));
      else if (navigator.clipboard) navigator.clipboard.writeText(text);
    } catch (e) {}
  }

  function ensureCss() {
    if (document.getElementById("mg-collab-day-css")) return;
    var st = document.createElement("style");
    st.id = "mg-collab-day-css";
    st.textContent = [
      "#mg-collab-day{position:fixed;right:12px;top:56px;z-index:2147482992;",
      "  width:min(300px,36vw);border-radius:12px;overflow:hidden;",
      "  background:rgba(10,12,16,0.55);backdrop-filter:blur(22px) saturate(1.35);",
      "  -webkit-backdrop-filter:blur(22px) saturate(1.35);",
      "  border:1px solid rgba(255,255,255,0.16);",
      "  box-shadow:0 8px 24px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.1);",
      "  font:650 9px/1.25 system-ui;color:rgba(244,246,250,0.92);pointer-events:auto}",
      "#mg-collab-day.hidden{display:none}",
      "#mg-collab-day .hd{display:flex;justify-content:space-between;padding:6px 8px;",
      "  letter-spacing:0.1em;text-transform:uppercase;color:rgba(180,220,255,0.95);",
      "  border-bottom:1px solid rgba(255,255,255,0.1)}",
      "#mg-collab-day .hd button{appearance:none;background:0;border:0;color:inherit;cursor:pointer;font:700 11px/1 system-ui}",
      "#mg-collab-day .bd{padding:8px;max-height:320px;overflow:auto}",
      "#mg-collab-day .row{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}",
      "#mg-collab-day .row button{appearance:none;cursor:pointer;padding:5px 8px;border-radius:999px;",
      "  font:700 8px/1 system-ui;letter-spacing:0.05em;color:rgba(240,245,255,0.95);",
      "  background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14)}",
      "#mg-collab-day .row button.hot{background:rgba(80,160,255,0.22);border-color:rgba(140,200,255,0.45)}",
      "#mg-collab-day .row button.ok{background:rgba(80,220,160,0.15);border-color:rgba(100,220,160,0.4)}",
      "#mg-collab-day .meta{font:500 8px/1.3 ui-monospace,Menlo,monospace;color:rgba(160,200,180,0.9);margin-bottom:6px}",
      "#mg-collab-day .chat{font:500 9px/1.35 system-ui;max-height:100px;overflow:auto;",
      "  border-top:1px solid rgba(255,255,255,0.08);padding-top:6px;margin-top:6px}",
      "#mg-collab-day .chat div{margin:2px 0;opacity:0.9}",
      "#mg-collab-day input{width:100%;box-sizing:border-box;margin-top:6px;padding:6px 8px;",
      "  border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:rgba(0,0,0,0.35);",
      "  color:rgba(240,245,255,0.95);font:500 11px/1.2 system-ui}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function ensurePanel() {
    if (panel) return;
    ensureCss();
    panel = document.createElement("div");
    panel.id = "mg-collab-day";
    panel.className = open ? "" : "hidden";
    panel.innerHTML =
      '<div class="hd"><span>Collab day · mesh</span>' +
      '<button type="button" id="mg-cd-x">×</button></div>' +
      '<div class="bd">' +
      '<div class="meta" id="mg-cd-meta">day off</div>' +
      '<div class="row">' +
      '<button type="button" class="hot" id="mg-cd-start">START DAY</button>' +
      '<button type="button" class="ok" id="mg-cd-score">SHARE SCORE</button>' +
      '<button type="button" class="ok" id="mg-cd-run">SHARE RUN</button>' +
      '<button type="button" class="hot" id="mg-cd-grok">GROK BRIEF</button>' +
      '<button type="button" id="mg-cd-xdraft">X DRAFT</button>' +
      '<button type="button" id="mg-cd-board">POST ↗</button>' +
      "</div>" +
      '<div class="chat" id="mg-cd-chat"></div>' +
      '<input id="mg-cd-in" placeholder="mesh chat · enter to send" />' +
      "</div>";
    (document.body || document.documentElement).appendChild(panel);
    panel.querySelector("#mg-cd-x").onclick = function () {
      close();
    };
    panel.querySelector("#mg-cd-start").onclick = function () {
      start({ force: true });
      paint();
    };
    panel.querySelector("#mg-cd-score").onclick = function () {
      shareScore();
    };
    panel.querySelector("#mg-cd-run").onclick = function () {
      shareRun();
    };
    panel.querySelector("#mg-cd-grok").onclick = function () {
      exportGrokBrief();
      try {
        alert("Grok brief copied + downloaded — paste into Grok Build.");
      } catch (e) {}
    };
    panel.querySelector("#mg-cd-xdraft").onclick = function () {
      exportXDraft();
    };
    panel.querySelector("#mg-cd-board").onclick = function () {
      if (window.__mgActivityBoard && window.__mgActivityBoard.openLeaderboardWindow)
        window.__mgActivityBoard.openLeaderboardWindow({ post: true, kind: "collab-day" });
    };
    var inp = panel.querySelector("#mg-cd-in");
    inp.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        chatSend(inp.value);
        inp.value = "";
      }
    });
  }

  function paint() {
    if (!open || !panel) return;
    var meta = panel.querySelector("#mg-cd-meta");
    var chatEl = panel.querySelector("#mg-cd-chat");
    if (meta) {
      meta.textContent = day
        ? day.title +
          " · " +
          day.id +
          " · peers " +
          Object.keys(peers).length +
          " · scores " +
          (day.scores || []).length +
          " · runs " +
          (day.runs || []).length
        : "day off · START DAY";
    }
    if (chatEl) {
      chatEl.innerHTML = "";
      chat.slice(-12).forEach(function (c) {
        var d = document.createElement("div");
        d.textContent = String(c.from).slice(0, 6) + ": " + c.text;
        chatEl.appendChild(d);
      });
      if (!chat.length) {
        var e = document.createElement("div");
        e.style.opacity = "0.5";
        e.textContent = "mesh chat empty · second seat joins mg-mesh";
        chatEl.appendChild(e);
      }
    }
  }

  function start(opts) {
    ensureDay(opts || {});
    meshSend("day-start", { title: day.title, dayId: day.id });
    pushEvent("start", { title: day.title });
    openPanel();
    return day;
  }

  function openPanel() {
    open = true;
    ensurePanel();
    panel.classList.remove("hidden");
    paint();
  }

  function close() {
    open = false;
    if (panel) panel.classList.add("hidden");
  }

  function toggle() {
    if (open) close();
    else openPanel();
  }

  /* Auto-share after agent session end */
  var lastAgent = null;
  setInterval(function () {
    try {
      var cur = window.__mgAgentPlayLast;
      if (!cur || cur === lastAgent) return;
      if (cur.kind === "agent_end" || cur.kind === "agent_session") {
        lastAgent = cur;
        if (day) {
          shareScore();
          if (cur.kind === "agent_session") shareRun();
        }
      }
    } catch (e) {}
  }, 1200);

  loadDay();

  window.__mgCollabDay = {
    ver: VER,
    start: start,
    day: function () {
      return day;
    },
    shareScore: shareScore,
    shareRun: shareRun,
    chat: chatSend,
    exportGrokBrief: exportGrokBrief,
    exportXDraft: exportXDraft,
    open: openPanel,
    close: close,
    toggle: toggle,
    peers: function () {
      return peers;
    },
    report: function () {
      return (
        VER +
        " day=" +
        (day ? day.id : "off") +
        " peers=" +
        Object.keys(peers).length +
        " chat=" +
        chat.length
      );
    },
  };

  log(VER + " · collab communication day");
})();
