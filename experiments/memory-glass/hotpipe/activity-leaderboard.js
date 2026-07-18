/* Memory Glass · built-in activity leaderboard + run synopsis
 * Aggregates WebGrid / contrail / Bloch / beats / Rubik / kbatch into ranked runs.
 * X draft consumes this (human post only — no auto-X).
 * Clean window → leaderboard.html after playthrough to post.
 * VER: activity-board-v2-page
 */
(function () {
  "use strict";
  var VER = "activity-board-v2-page";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._activityBoardVer === VER) return;
  HP._activityBoardVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var KEY = "mg.activity.leaderboard.v1";
  var MAX = 40;
  var panel = null;
  var open = false;
  var lastRun = null;
  var postToast = null;
  var lastPromptRunId = null;

  /* If this is the clean leaderboard page, hydrate handoff into board APIs */
  var IS_LB_PAGE = false;
  try {
    IS_LB_PAGE =
      /leaderboard\.html/i.test(location.pathname || "") ||
      /leaderboard\.html/i.test(location.href || "");
  } catch (ePage) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "board");
    } catch (e) {}
  }

  function loadBoard() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }

  function saveBoard(arr) {
    try {
      localStorage.setItem(KEY, JSON.stringify(arr.slice(0, MAX)));
    } catch (e) {}
  }

  function hostGame() {
    try {
      var h = location.hostname || "";
      var p = location.pathname || "";
      if (/neuralink\.com$/i.test(h) && /webgrid/i.test(p)) return "webgrid";
      if (/kbatch\.ugrad\.ai$/i.test(h)) return "kbatch";
      if (/mueee\.qbitos\.ai$/i.test(h)) {
        if (/rubik/i.test(p)) return "rubik";
        if (/snake/i.test(p)) return "snake";
        if (/language/i.test(p)) return "language";
        if (/webgrid/i.test(p)) return "webgrid-ugrad";
        return "mueee";
      }
    } catch (e) {}
    return "session";
  }

  /** Live metrics snapshot from all hotpipe surfaces */
  function collectMetrics() {
    var m = {
      t: Date.now(),
      iso: new Date().toISOString(),
      href: (location.href || "").slice(0, 160),
      title: (document.title || "").slice(0, 80),
      game: hostGame(),
      webgrid: null,
      contrail: null,
      bloch: null,
      beats: null,
      rubik: null,
      maze: null,
      kbatch: null,
      rec: null,
      score: 0,
    };

    try {
      if (window.__mgWebgridCalib && window.__mgWebgridCalib.scrapeScore) {
        var sc = window.__mgWebgridCalib.scrapeScore();
        m.webgrid = {
          bps: sc.bps,
          ntpm: sc.ntpm,
          timer: sc.timer,
          grid: sc.grid,
          peakBps: sc.peak && sc.peak.bps,
          peakNtpm: sc.peak && sc.peak.ntpm,
        };
      }
      if (window.__mgWebgridSessionBest) {
        var sb = window.__mgWebgridSessionBest;
        m.webgrid = m.webgrid || {};
        m.webgrid.sessionPeakBps = sb.peakBps || (sb.peak && sb.peak.bps);
        m.webgrid.sessionPeakNtpm = sb.peakNtpm || (sb.peak && sb.peak.ntpm);
        m.webgrid.clicks = sb.clicks;
        m.webgrid.hitsGuess = sb.hitsGuess;
      }
      if (window.__mgAgentPlayLast) {
        m.webgrid = m.webgrid || {};
        m.webgrid.lastKind = window.__mgAgentPlayLast.kind;
        if (window.__mgAgentPlayLast.peak) {
          m.webgrid.peakBps = m.webgrid.peakBps || window.__mgAgentPlayLast.peak.bps;
          m.webgrid.peakNtpm = m.webgrid.peakNtpm || window.__mgAgentPlayLast.peak.ntpm;
        }
        if (window.__mgAgentPlayLast.bestBps != null)
          m.webgrid.bestBps = window.__mgAgentPlayLast.bestBps;
        if (window.__mgAgentPlayLast.bestNtpm != null)
          m.webgrid.bestNtpm = window.__mgAgentPlayLast.bestNtpm;
      }
    } catch (e) {}

    try {
      if (window.__mgContrail) {
        var st = window.__mgContrail.stats || {};
        var dj = window.__mgContrail.lastDojo && window.__mgContrail.lastDojo();
        m.contrail = {
          samples: st.samples || 0,
          strokes: st.strokes || 0,
          phrase: st.lastPhrase || "",
          successN: st.successN || 0,
          stressN: st.stressN || 0,
          slowN: st.slowN || 0,
          meanV: st.meanV || 0,
          strain: dj && dj.strain != null ? dj.strain : window.__mgContrail.lastStrain && window.__mgContrail.lastStrain(),
          worldWords: (dj && dj.worldWords) || [],
          so: (dj && dj.phrasingOrders) || null,
          report: window.__mgContrail.report && window.__mgContrail.report(),
        };
      }
    } catch (e2) {}

    try {
      if (window.__mgBlochSolve) {
        var trials = window.__mgBlochSolve.trials || [];
        var hits = 0;
        trials.forEach(function (tr) {
          if (tr && tr.label === 1) hits++;
        });
        m.bloch = {
          report: window.__mgBlochSolve.report(),
          trials: trials.length,
          hits: hits,
          lastGate: null,
        };
        if (trials.length && trials[trials.length - 1].meta)
          m.bloch.lastGate = trials[trials.length - 1].meta.gate;
      }
      if (window.__mgQuantum && window.__mgQuantum.state) {
        m.bloch = m.bloch || {};
        m.bloch.theta = window.__mgQuantum.state.theta;
        m.bloch.phi = window.__mgQuantum.state.phi;
      }
    } catch (e3) {}

    try {
      if (window.__mgKeyboardBeats) {
        m.beats = {
          bpm: window.__mgKeyboardBeats.bpm(),
          attempts: window.__mgKeyboardBeats.attempts(),
          hits: window.__mgKeyboardBeats.hits(),
          acc:
            window.__mgKeyboardBeats.attempts() > 0
              ? window.__mgKeyboardBeats.hits() / window.__mgKeyboardBeats.attempts()
              : 0,
        };
      }
    } catch (e4) {}

    try {
      if (window.__mgRubikLang) {
        m.rubik = {
          face: window.__mgRubikLang.face(),
          report: window.__mgRubikLang.report(),
        };
      }
    } catch (e5) {}

    try {
      if (window.__mgMemoryMaze && window.__mgMemoryMaze.points) {
        m.maze = { pts: window.__mgMemoryMaze.points().length || 0 };
      }
    } catch (e6) {}

    try {
      if (window.__mgKbatchDojo && window.__mgKbatchDojo.last) {
        var k = window.__mgKbatchDojo.last();
        if (k)
          m.kbatch = {
            strain: k.strain,
            words: (k.worldWords || []).slice(0, 6),
            so: k.phrasingOrders || null,
          };
      }
    } catch (e7) {}

    try {
      if (window.__mgSessionRec) {
        m.rec = {
          recording: window.__mgSessionRec.isRecording && window.__mgSessionRec.isRecording(),
          report: window.__mgSessionRec.report && window.__mgSessionRec.report(),
        };
      }
    } catch (e8) {}

    m.score = rankScore(m);
    return m;
  }

  /** Composite rank score for leaderboard ordering */
  function rankScore(m) {
    var s = 0;
    var w = m.webgrid || {};
    var peak =
      w.sessionPeakBps ||
      w.peakBps ||
      w.bestBps ||
      (typeof w.bps === "number" ? w.bps : 0) ||
      0;
    var ntpm =
      w.sessionPeakNtpm ||
      w.peakNtpm ||
      w.bestNtpm ||
      (typeof w.ntpm === "number" ? w.ntpm : 0) ||
      0;
    s += peak * 10;
    s += Math.max(0, ntpm) * 0.5;
    if (m.contrail) {
      s += Math.min(80, (m.contrail.samples || 0) * 0.08);
      s += (m.contrail.successN || 0) * 2;
      s -= (m.contrail.stressN || 0) * 0.5;
      if (m.contrail.strain != null && isFinite(m.contrail.strain))
        s += Math.max(0, 40 - m.contrail.strain) * 0.4;
    }
    if (m.bloch) {
      s += (m.bloch.hits || 0) * 3;
      s += Math.min(30, (m.bloch.trials || 0) * 0.15);
    }
    if (m.beats) {
      s += (m.beats.hits || 0) * 1.5;
      s += (m.beats.acc || 0) * 25;
    }
    if (m.maze) s += Math.min(20, (m.maze.pts || 0) * 0.02);
    if (m.rubik && m.rubik.face) s += 5;
    return Math.round(s * 10) / 10;
  }

  function synopsis(m) {
    m = m || collectMetrics();
    var bits = [];
    var game = m.game || "session";
    bits.push(gameLabel(game) + " run");

    var w = m.webgrid || {};
    var peak =
      w.sessionPeakBps || w.peakBps || w.bestBps || (typeof w.bps === "number" ? w.bps : null);
    var ntpm =
      w.sessionPeakNtpm || w.peakNtpm || w.bestNtpm || (typeof w.ntpm === "number" ? w.ntpm : null);
    if (peak != null && isFinite(peak))
      bits.push(fmtNum(peak) + " BPS" + (ntpm != null ? " / " + fmtNum(ntpm) + " NTPM" : ""));
    if (w.grid) bits.push(w.grid + " grid");
    if (w.clicks != null) bits.push(w.clicks + " clicks");

    if (m.contrail) {
      if (m.contrail.phrase) bits.push('path «' + String(m.contrail.phrase).slice(0, 24) + '»');
      if (m.contrail.samples) bits.push(m.contrail.samples + " path samples");
      if (m.contrail.strain != null) bits.push("strain " + Math.round(m.contrail.strain));
      if (m.contrail.worldWords && m.contrail.worldWords.length)
        bits.push("words " + m.contrail.worldWords.slice(0, 3).join(", "));
    }
    if (m.bloch) {
      if (m.bloch.lastGate) bits.push("gate " + m.bloch.lastGate);
      else if (m.bloch.report) {
        var g = /gate=([A-Z])/.exec(m.bloch.report);
        if (g) bits.push("gate " + g[1]);
      }
      if (m.bloch.trials) bits.push(m.bloch.hits + "/" + m.bloch.trials + " Bloch hits");
    }
    if (m.beats && m.beats.attempts)
      bits.push(
        "beats " +
          m.beats.hits +
          "/" +
          m.beats.attempts +
          " @" +
          m.beats.bpm +
          "bpm"
      );
    if (m.rubik && m.rubik.face) bits.push("Rubik face " + m.rubik.face);
    if (m.maze && m.maze.pts) bits.push("maze " + m.maze.pts + " pts");

    bits.push("score " + (m.score != null ? m.score : rankScore(m)));
    return bits.join(" · ");
  }

  function gameLabel(g) {
    var map = {
      webgrid: "WebGrid",
      "webgrid-ugrad": "WebGrid μgrad",
      kbatch: "KBatch",
      rubik: "Rubik language",
      snake: "Snake",
      language: "Language lab",
      mueee: "μeee lab",
      session: "Memory Glass",
    };
    return map[g] || g;
  }

  function fmtNum(n) {
    if (n == null || !isFinite(n)) return "—";
    if (Math.abs(n) >= 100) return String(Math.round(n));
    return (Math.round(n * 100) / 100).toString();
  }

  function submitRun(kind, extra) {
    var m = collectMetrics();
    if (extra && typeof extra === "object") {
      Object.keys(extra).forEach(function (k) {
        if (k === "webgrid" && extra.webgrid && m.webgrid)
          m.webgrid = Object.assign({}, m.webgrid, extra.webgrid);
        else if (extra[k] != null) m[k] = extra[k];
      });
      m.score = rankScore(m);
    }
    var run = {
      id: "r" + Date.now().toString(36),
      kind: kind || "snapshot",
      t: m.t,
      iso: m.iso,
      game: m.game,
      score: m.score,
      synopsis: synopsis(m),
      metrics: m,
    };
    lastRun = run;
    var board = loadBoard();
    board.unshift(run);
    board.sort(function (a, b) {
      return (b.score || 0) - (a.score || 0);
    });
    /* keep newest id if tie-ish — already sorted by score */
    if (board.length > MAX) board = board.slice(0, MAX);
    saveBoard(board);
    try {
      localStorage.setItem("mg.activity.lastRun", JSON.stringify(run));
    } catch (e) {}
    log("run " + run.id + " score=" + run.score + " · " + run.synopsis.slice(0, 60));
    if (open) paintPanel();
    /* After real playthrough kinds, offer clean post window */
    if (
      kind === "agent_end" ||
      kind === "agent_session" ||
      kind === "rec-stop" ||
      kind === "post-play"
    ) {
      showPostPrompt(run);
    }
    return run;
  }

  function boardRanked() {
    return loadBoard().slice().sort(function (a, b) {
      return (b.score || 0) - (a.score || 0);
    });
  }

  function rankOf(runId) {
    var b = boardRanked();
    for (var i = 0; i < b.length; i++) if (b[i].id === runId) return i + 1;
    return null;
  }

  /** X-ready caption: run metrics + leaderboard slice (you post) */
  function formatXDraft(opts) {
    opts = opts || {};
    var run = opts.run || lastRun;
    if (!run) {
      try {
        run = JSON.parse(localStorage.getItem("mg.activity.lastRun") || "null");
      } catch (e) {
        run = null;
      }
    }
    if (!run || opts.fresh) {
      run = submitRun(opts.kind || "x-draft");
    }
    var m = run.metrics || collectMetrics();
    var board = boardRanked();
    var rank = rankOf(run.id) || 1;
    var lines = [];

    lines.push("Memory Glass · " + gameLabel(m.game || run.game) + " · run synopsis");
    lines.push("");
    lines.push("📊 " + (run.synopsis || synopsis(m)));
    lines.push("🏆 board #" + rank + " · score " + fmtNum(run.score) + " · n=" + board.length);
    lines.push("");

    /* metrics block — leaderboard style */
    lines.push("— metrics —");
    var w = m.webgrid || {};
    var peak =
      w.sessionPeakBps || w.peakBps || w.bestBps || (typeof w.bps === "number" ? w.bps : null);
    var ntpm =
      w.sessionPeakNtpm || w.peakNtpm || w.bestNtpm || (typeof w.ntpm === "number" ? w.ntpm : null);
    if (peak != null)
      lines.push(
        "WebGrid  " +
          fmtNum(peak) +
          " BPS" +
          (ntpm != null ? " · " + fmtNum(ntpm) + " NTPM" : "") +
          (w.grid ? " · " + w.grid : "")
      );
    if (m.contrail) {
      var c = m.contrail;
      lines.push(
        "Path     " +
          (c.samples || 0) +
          " samp · s/x/z " +
          (c.successN || 0) +
          "/" +
          (c.stressN || 0) +
          "/" +
          (c.slowN || 0) +
          (c.strain != null ? " · strain " + Math.round(c.strain) : "")
      );
      if (c.phrase) lines.push("Phrase   «" + String(c.phrase).slice(0, 40) + "»");
      if (c.worldWords && c.worldWords.length)
        lines.push("Words    " + c.worldWords.slice(0, 5).join(", "));
      if (c.so) {
        var soKeys = Object.keys(c.so);
        if (soKeys.length)
          lines.push(
            "SO       " +
              soKeys
                .map(function (k) {
                  return k + "×" + c.so[k];
                })
                .join(" ")
          );
      }
    }
    if (m.bloch) {
      lines.push(
        "Bloch    " +
          (m.bloch.hits || 0) +
          "/" +
          (m.bloch.trials || 0) +
          " hits" +
          (m.bloch.lastGate ? " · last " + m.bloch.lastGate : "")
      );
    }
    if (m.beats && m.beats.attempts) {
      lines.push(
        "Beats    " +
          m.beats.hits +
          "/" +
          m.beats.attempts +
          " · " +
          m.beats.bpm +
          " bpm · " +
          Math.round((m.beats.acc || 0) * 100) +
          "% hit"
      );
    }
    if (m.rubik && m.rubik.face) lines.push("Rubik    face " + m.rubik.face);
    if (m.maze && m.maze.pts) lines.push("Maze     " + m.maze.pts + " pts");
    if (m.kbatch && m.kbatch.words && m.kbatch.words.length)
      lines.push("KBatch   " + m.kbatch.words.slice(0, 4).join(", "));

    /* top board */
    if (board.length) {
      lines.push("");
      lines.push("— leaderboard (local) —");
      board.slice(0, 5).forEach(function (r, i) {
        var mark = r.id === run.id ? " ◀" : "";
        lines.push(
          i +
            1 +
            ". " +
            fmtNum(r.score) +
            " · " +
            gameLabel(r.game) +
            " · " +
            shortSyn(r) +
            mark
        );
      });
    }

    lines.push("");
    if (m.href) lines.push("🔗 " + m.href.slice(0, 100));
    lines.push("Cubes · https://mueee.qbitos.ai/quantum-gutter.html");
    lines.push("Train · https://mueee.qbitos.ai/ugrad-r0.html");
    lines.push("KBatch · https://kbatch.ugrad.ai/");
    lines.push("WebGrid · https://neuralink.com/webgrid/");
    lines.push("");
    lines.push("#MemoryGlass #WebGrid #KBatch #μgrad");
    lines.push("");
    lines.push("(You post — no auto-post · board local)");

    return lines.join("\n");
  }

  function shortSyn(r) {
    if (!r) return "—";
    if (r.metrics && r.metrics.webgrid) {
      var w = r.metrics.webgrid;
      var p = w.sessionPeakBps || w.peakBps || w.bestBps || w.bps;
      if (p != null) return fmtNum(p) + " BPS";
    }
    if (r.synopsis) return String(r.synopsis).slice(0, 42);
    return r.kind || "run";
  }

  function ensureCss() {
    if (document.getElementById("mg-board-css")) return;
    var st = document.createElement("style");
    st.id = "mg-board-css";
    st.textContent = [
      "#mg-activity-board{position:fixed;left:12px;top:calc(56px + 180px);z-index:2147482993;",
      "  width:min(280px,34vw);border-radius:12px;overflow:hidden;",
      "  background:rgba(10,12,16,0.52);backdrop-filter:blur(22px) saturate(1.35);",
      "  -webkit-backdrop-filter:blur(22px) saturate(1.35);",
      "  border:1px solid rgba(255,255,255,0.16);",
      "  box-shadow:0 8px 24px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.1);",
      "  font:650 9px/1.25 system-ui;color:rgba(244,246,250,0.92);pointer-events:auto}",
      "#mg-activity-board.hidden{display:none}",
      "#mg-activity-board .hd{display:flex;justify-content:space-between;align-items:center;",
      "  padding:6px 8px;letter-spacing:0.1em;text-transform:uppercase;",
      "  border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,210,120,0.95)}",
      "#mg-activity-board .hd button{appearance:none;background:transparent;border:0;color:inherit;",
      "  cursor:pointer;font:700 11px/1 system-ui;margin-left:4px}",
      "#mg-activity-board .syn{padding:6px 8px;font:500 8px/1.3 ui-monospace,Menlo,monospace;",
      "  color:rgba(180,220,255,0.9);border-bottom:1px solid rgba(255,255,255,0.08)}",
      "#mg-activity-board ol{margin:0;padding:6px 8px 8px 22px;max-height:200px;overflow:auto;",
      "  font:500 8px/1.35 ui-monospace,Menlo,monospace;color:rgba(210,220,230,0.9)}",
      "#mg-activity-board ol li{margin:3px 0}",
      "#mg-activity-board ol li.me{color:rgba(255,220,140,0.98)}",
      "#mg-activity-board .ft{padding:4px 8px 6px;display:flex;gap:4px;flex-wrap:wrap;",
      "  border-top:1px solid rgba(255,255,255,0.08)}",
      "#mg-activity-board .ft button{appearance:none;cursor:pointer;padding:4px 8px;border-radius:999px;",
      "  font:700 8px/1 system-ui;color:rgba(240,245,255,0.95);",
      "  background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14)}",
      "#mg-activity-board .ft button.hot{background:rgba(255,180,60,0.2);",
      "  border-color:rgba(255,190,100,0.45)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function ensurePanel() {
    if (panel) return;
    ensureCss();
    panel = document.createElement("div");
    panel.id = "mg-activity-board";
    panel.className = open ? "" : "hidden";
    panel.innerHTML =
      '<div class="hd"><span>Leaderboard · runs</span>' +
      '<span><button type="button" id="mg-board-snap" title="snapshot">＋</button>' +
      '<button type="button" id="mg-board-x">×</button></span></div>' +
      '<div class="syn" id="mg-board-syn">no run yet</div>' +
      '<ol id="mg-board-ol"></ol>' +
      '<div class="ft">' +
      '<button type="button" id="mg-board-post" class="hot">POST ↗</button>' +
      '<button type="button" id="mg-board-xdraft">X DRAFT</button>' +
      '<button type="button" id="mg-board-clear">CLEAR</button>' +
      "</div>";
    (document.body || document.documentElement).appendChild(panel);
    panel.querySelector("#mg-board-x").onclick = function () {
      close();
    };
    panel.querySelector("#mg-board-snap").onclick = function () {
      submitRun("manual");
      paintPanel();
    };
    panel.querySelector("#mg-board-post").onclick = function () {
      openLeaderboardWindow({ post: true, kind: "manual-post" });
    };
    panel.querySelector("#mg-board-xdraft").onclick = function () {
      var text = formatXDraft({ fresh: true, kind: "x-draft" });
      copyText(text);
      log("X draft from board · you post");
      try {
        alert("X draft (metrics + leaderboard) copied — you post when ready.");
      } catch (e) {}
    };
    panel.querySelector("#mg-board-clear").onclick = function () {
      saveBoard([]);
      lastRun = null;
      paintPanel();
    };
  }

  function ensureToastCss() {
    if (document.getElementById("mg-board-toast-css")) return;
    var st = document.createElement("style");
    st.id = "mg-board-toast-css";
    st.textContent = [
      "#mg-board-toast{position:fixed;right:12px;top:56px;z-index:2147483010;",
      "  width:min(300px,42vw);border-radius:12px;overflow:hidden;",
      "  background:rgba(10,12,16,0.58);backdrop-filter:blur(22px) saturate(1.35);",
      "  -webkit-backdrop-filter:blur(22px) saturate(1.35);",
      "  border:1px solid rgba(255,190,100,0.35);",
      "  box-shadow:0 10px 28px rgba(0,0,0,0.22),inset 0 1px 0 rgba(255,255,255,0.1);",
      "  font:650 10px/1.3 system-ui;color:rgba(244,246,250,0.95);pointer-events:auto}",
      "#mg-board-toast.hidden{display:none}",
      "#mg-board-toast .hd{padding:8px 10px;letter-spacing:0.1em;text-transform:uppercase;",
      "  color:rgba(255,200,120,0.95);border-bottom:1px solid rgba(255,255,255,0.1)}",
      "#mg-board-toast .bd{padding:8px 10px;font:500 11px/1.35 system-ui;color:rgba(220,230,240,0.92)}",
      "#mg-board-toast .ft{display:flex;gap:6px;padding:0 10px 10px;flex-wrap:wrap}",
      "#mg-board-toast button{appearance:none;cursor:pointer;padding:6px 10px;border-radius:999px;",
      "  font:700 9px/1 system-ui;letter-spacing:0.06em;color:rgba(240,245,255,0.95);",
      "  background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14)}",
      "#mg-board-toast button.hot{background:rgba(255,170,60,0.25);",
      "  border-color:rgba(255,190,100,0.5);color:rgba(255,210,140,0.98)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function showPostPrompt(run) {
    if (IS_LB_PAGE || !run) return;
    if (lastPromptRunId === run.id) return;
    lastPromptRunId = run.id;
    ensureToastCss();
    if (!postToast) {
      postToast = document.createElement("div");
      postToast.id = "mg-board-toast";
      postToast.innerHTML =
        '<div class="hd">Playthrough done</div>' +
        '<div class="bd" id="mg-board-toast-bd">Open clean leaderboard window to post.</div>' +
        '<div class="ft">' +
        '<button type="button" class="hot" id="mg-board-toast-go">POST BOARD ↗</button>' +
        '<button type="button" id="mg-board-toast-x">X DRAFT</button>' +
        '<button type="button" id="mg-board-toast-d">DISMISS</button>' +
        "</div>";
      (document.body || document.documentElement).appendChild(postToast);
      postToast.querySelector("#mg-board-toast-go").onclick = function () {
        openLeaderboardWindow({ post: true, run: lastRun, kind: "post-play" });
        hidePostPrompt();
      };
      postToast.querySelector("#mg-board-toast-x").onclick = function () {
        var text = formatXDraft({ run: lastRun, fresh: false });
        copyText(text);
        log("X draft · post-play · you post");
      };
      postToast.querySelector("#mg-board-toast-d").onclick = hidePostPrompt;
    }
    var bd = document.getElementById("mg-board-toast-bd");
    if (bd)
      bd.textContent =
        (run.synopsis || "run scored " + run.score).slice(0, 140) +
        " · open clean window to post";
    postToast.classList.remove("hidden");
  }

  function hidePostPrompt() {
    if (postToast) postToast.classList.add("hidden");
  }

  function slimRun(r) {
    if (!r) return null;
    return {
      id: r.id,
      kind: r.kind,
      t: r.t,
      iso: r.iso,
      game: r.game,
      score: r.score,
      synopsis: r.synopsis,
      metrics: r.metrics
        ? {
            game: r.metrics.game,
            score: r.metrics.score,
            webgrid: r.metrics.webgrid,
            contrail: r.metrics.contrail
              ? {
                  samples: r.metrics.contrail.samples,
                  strokes: r.metrics.contrail.strokes,
                  phrase: r.metrics.contrail.phrase,
                  successN: r.metrics.contrail.successN,
                  stressN: r.metrics.contrail.stressN,
                  slowN: r.metrics.contrail.slowN,
                  strain: r.metrics.contrail.strain,
                  worldWords: r.metrics.contrail.worldWords,
                  so: r.metrics.contrail.so,
                }
              : null,
            bloch: r.metrics.bloch,
            beats: r.metrics.beats,
            rubik: r.metrics.rubik,
            maze: r.metrics.maze,
            href: r.metrics.href,
          }
        : null,
    };
  }

  function buildHandoff(run) {
    var r = run || lastRun;
    if (!r) r = submitRun("handoff");
    return {
      v: 1,
      at: Date.now(),
      run: slimRun(r),
      board: boardRanked().slice(0, 20).map(slimRun),
      draft: formatXDraft({ run: r, fresh: false }),
    };
  }

  /** Open clean MG window on leaderboard.html to post this run */
  function openLeaderboardWindow(opts) {
    opts = opts || {};
    var run = opts.run || lastRun;
    if (!run || opts.fresh) run = submitRun(opts.kind || "post-play");
    lastRun = run;
    var handoff = buildHandoff(run);
    try {
      localStorage.setItem("mg.activity.lastRun", JSON.stringify(run));
      localStorage.setItem("mg.activity.handoff", JSON.stringify(handoff));
    } catch (e) {}

    if (window.ipc) {
      try {
        window.ipc.postMessage(
          JSON.stringify({
            op: "open_leaderboard",
            handoff: JSON.stringify(handoff),
            post: !!opts.post,
          })
        );
        log("open leaderboard window · score=" + run.score);
        return true;
      } catch (e2) {}
    }

    /* Fallback: same-tab navigate won't be "clean"; try window.open file path unknown */
    try {
      var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(handoff))))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
      var u =
        (opts.pageUrl || "about:blank") +
        (opts.post ? "?post=1" : "") +
        "#h=" +
        b64.slice(0, 6000);
      if (opts.pageUrl) {
        window.open(u, "_blank");
        return true;
      }
    } catch (e3) {}
    log("open leaderboard failed · ipc missing");
    openPanel();
    return false;
  }

  function copyText(text) {
    try {
      if (window.ipc)
        window.ipc.postMessage(JSON.stringify({ op: "clipboard_copy", text: text }));
      else if (navigator.clipboard) navigator.clipboard.writeText(text);
    } catch (e) {}
  }

  function paintPanel() {
    if (!open) return;
    ensurePanel();
    var board = boardRanked();
    var syn = document.getElementById("mg-board-syn");
    var ol = document.getElementById("mg-board-ol");
    var live = collectMetrics();
    if (syn)
      syn.textContent =
        (lastRun ? lastRun.synopsis : synopsis(live)).slice(0, 120) || "—";
    if (ol) {
      ol.innerHTML = "";
      if (!board.length) {
        var li0 = document.createElement("li");
        li0.textContent = "empty — SNAP or finish a run";
        ol.appendChild(li0);
      } else {
        board.slice(0, 12).forEach(function (r, i) {
          var li = document.createElement("li");
          if (lastRun && r.id === lastRun.id) li.className = "me";
          li.textContent =
            fmtNum(r.score) +
            " · " +
            gameLabel(r.game) +
            " · " +
            shortSyn(r) +
            (r.kind ? " [" + r.kind + "]" : "");
          li.title = r.synopsis || "";
          ol.appendChild(li);
        });
      }
    }
  }

  function openPanel() {
    open = true;
    ensurePanel();
    panel.classList.remove("hidden");
    paintPanel();
  }

  function close() {
    open = false;
    if (panel) panel.classList.add("hidden");
  }

  function toggle() {
    if (open) close();
    else openPanel();
  }

  /* Hook WebGrid agent end reports into board */
  function hookWebgrid() {
    try {
      if (window.__mgBoardWebgridHooked) return;
      window.__mgBoardWebgridHooked = true;
      var last = null;
      setInterval(function () {
        try {
          var cur = window.__mgAgentPlayLast;
          if (!cur || cur === last) return;
          if (cur.kind === "agent_end" || cur.kind === "agent_session") {
            last = cur;
            submitRun(cur.kind, {
              webgrid: {
                peakBps: cur.peak && cur.peak.bps,
                peakNtpm: cur.peak && cur.peak.ntpm,
                bestBps: cur.bestBps,
                bestNtpm: cur.bestNtpm,
                clicks: cur.clicks,
                hitsGuess: cur.hitsGuess,
                bps: cur.bps,
                ntpm: cur.ntpm,
                grid: cur.grid,
              },
            });
          }
        } catch (e) {}
      }, 800);
    } catch (e2) {}
  }

  function hydrateFromHandoffInject() {
    try {
      if (window.__mgLbHandoff) {
        var h = window.__mgLbHandoff;
        if (typeof h === "string") h = JSON.parse(h);
        if (h && h.run) lastRun = h.run;
        if (h && Array.isArray(h.board)) {
          var cur = loadBoard();
          var byId = {};
          cur.forEach(function (r) {
            byId[r.id] = r;
          });
          h.board.forEach(function (r) {
            if (r && r.id) byId[r.id] = r;
          });
          var merged = Object.keys(byId).map(function (k) {
            return byId[k];
          });
          merged.sort(function (a, b) {
            return (b.score || 0) - (a.score || 0);
          });
          saveBoard(merged);
        }
        if (window.__mgLeaderboardPage && window.__mgLeaderboardPage.ingest)
          window.__mgLeaderboardPage.ingest(h);
      }
    } catch (e) {}
  }

  setTimeout(hookWebgrid, 600);
  setTimeout(hookWebgrid, 2000);
  setTimeout(hydrateFromHandoffInject, 200);
  setTimeout(hydrateFromHandoffInject, 900);

  /* On leaderboard page: auto-open is the page itself */
  if (IS_LB_PAGE) {
    try {
      var cached = localStorage.getItem("mg.activity.lastRun");
      if (cached) lastRun = JSON.parse(cached);
    } catch (eC) {}
  }

  window.__mgActivityBoard = {
    ver: VER,
    collectMetrics: collectMetrics,
    submitRun: submitRun,
    synopsis: synopsis,
    board: boardRanked,
    lastRun: function () {
      return lastRun;
    },
    formatXDraft: formatXDraft,
    open: openPanel,
    close: close,
    toggle: toggle,
    isOpen: function () {
      return open;
    },
    openLeaderboardWindow: openLeaderboardWindow,
    openPage: openLeaderboardWindow,
    buildHandoff: buildHandoff,
    showPostPrompt: showPostPrompt,
    report: function () {
      var b = loadBoard();
      return (
        VER +
        " n=" +
        b.length +
        " top=" +
        (b[0] ? b[0].score : "—") +
        (lastRun ? " last=" + lastRun.score : "")
      );
    },
  };

  log(VER + " · board + clean post window");
})();
