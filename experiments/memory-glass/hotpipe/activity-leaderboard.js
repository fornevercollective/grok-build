/* Memory Glass · built-in activity leaderboard + run synopsis
 * Aggregates WebGrid / contrail / Bloch / beats / Rubik / kbatch into ranked runs.
 * X draft consumes this (human post only — no auto-X).
 * Clean window → leaderboard.html after playthrough to post.
 * Live ranking: chess/sportsfield style (mueee games spirit) + predictions.
 * Stays open during WebGrid play.
 * Mini WebGrid: always findable (chip + auto-open on 12×12).
 * VER: activity-board-v4-mini-find
 */
(function () {
  "use strict";
  var VER = "activity-board-v4-mini-find";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._activityBoardVer === VER) return;
  HP._activityBoardVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var KEY = "mg.activity.leaderboard.v1";
  var MAX = 40;
  var panel = null;
  var chip = null;
  var open = false;
  var lastRun = null;
  var postToast = null;
  var lastPromptRunId = null;
  var filterMini = false; /* show mini-webgrid lane only */

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

  function isMiniWebgrid() {
    try {
      if (/[?&]mg_scale=small\b/i.test(location.search)) return true;
      if (/[?&]grid=12\b/i.test(location.search)) return true;
      if (/[?&]mg_window=small\b/i.test(location.search)) return true;
      if (window.innerWidth <= 751 || window.innerHeight <= 600) return true;
      if (window.__mgWebgridCalib && window.__mgWebgridCalib.detectGridSize) {
        if (window.__mgWebgridCalib.detectGridSize() === 12) return true;
      }
    } catch (e) {}
    return false;
  }

  function isWebgridHost() {
    try {
      return /neuralink\.com$/i.test(location.hostname || "") && /webgrid/i.test(location.pathname || "");
    } catch (e) {
      return false;
    }
  }

  function hostGame() {
    try {
      var h = location.hostname || "";
      var p = location.pathname || "";
      if (/neuralink\.com$/i.test(h) && /webgrid/i.test(p))
        return isMiniWebgrid() ? "webgrid-mini" : "webgrid";
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
      webgrid: "WebGrid 30",
      "webgrid-mini": "WebGrid MINI 12",
      "webgrid-ugrad": "WebGrid μgrad",
      kbatch: "KBatch",
      rubik: "Rubik language",
      snake: "Snake",
      language: "Language lab",
      scavenger: "Scavenger",
      mueee: "μeee lab",
      session: "Memory Glass",
    };
    return map[g] || g;
  }

  function boardFiltered() {
    var b = boardRanked();
    if (filterMini) {
      return b.filter(function (r) {
        return (
          r.game === "webgrid-mini" ||
          (r.metrics && r.metrics.webgrid && /12/.test(String(r.metrics.webgrid.grid || "")))
        );
      });
    }
    if (filterFull) {
      return b.filter(function (r) {
        return (
          r.game === "webgrid" ||
          (r.metrics && r.metrics.webgrid && /30/.test(String(r.metrics.webgrid.grid || "")))
        );
      });
    }
    return b;
  }

  function fmtNum(n) {
    if (n == null || !isFinite(n)) return "—";
    if (Math.abs(n) >= 100) return String(Math.round(n));
    return (Math.round(n * 100) / 100).toString();
  }

  function submitRun(kind, extra) {
    var m = collectMetrics();
    var forcedScore = null;
    var forcedSyn = null;
    if (extra && typeof extra === "object") {
      if (extra.score != null && isFinite(extra.score)) forcedScore = Number(extra.score);
      if (extra.synopsis) forcedSyn = String(extra.synopsis);
      Object.keys(extra).forEach(function (k) {
        if (k === "score" || k === "synopsis") return;
        if (k === "webgrid" && extra.webgrid && m.webgrid)
          m.webgrid = Object.assign({}, m.webgrid, extra.webgrid);
        else if (extra[k] != null) m[k] = extra[k];
      });
      m.score = forcedScore != null ? forcedScore : rankScore(m);
    }
    if (forcedScore != null) m.score = forcedScore;
    var run = {
      id: "r" + Date.now().toString(36),
      kind: kind || "snapshot",
      t: m.t,
      iso: m.iso,
      game: m.game || (extra && extra.game) || "session",
      score: m.score,
      synopsis: forcedSyn || synopsis(m),
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
    /* Mesh share for collab day (other seats merge board) */
    try {
      if (window.__mgMesh && window.__mgMesh.shareRun) {
        window.__mgMesh.shareRun({
          id: run.id,
          score: run.score,
          synopsis: run.synopsis,
          game: run.game,
          kind: run.kind,
          metrics: run.metrics,
        });
      }
    } catch (eMesh) {}
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

  /** Sportsfield / live-chess style predictions (mueee games spirit) */
  function predictNext() {
    var board = boardRanked();
    var live = collectMetrics();
    var cur = live.score || 0;
    var w = live.webgrid || {};
    var liveBps =
      w.sessionPeakBps || w.peakBps || w.bestBps || (typeof w.bps === "number" ? w.bps : null);
    var top = board[0] ? board[0].score : cur;
    var avg = 0;
    board.slice(0, 5).forEach(function (r) {
      avg += r.score || 0;
    });
    avg = board.length ? avg / Math.min(5, board.length) : cur;
    /* ELO-ish expected: how likely to beat own top / field avg */
    var field = Math.max(top, avg, 1);
    var expTop = 1 / (1 + Math.pow(10, (top - cur) / 40));
    var expField = 1 / (1 + Math.pow(10, (avg - cur) / 35));
    var trend = 0;
    if (board.length >= 2) {
      trend = (board[0].score || 0) - (board[Math.min(2, board.length - 1)].score || 0);
    }
    var predBps = liveBps != null ? liveBps * (0.92 + expField * 0.2) : null;
    if (trend > 0 && predBps != null) predBps *= 1.05;
    return {
      liveScore: cur,
      liveBps: liveBps,
      predBps: predBps != null ? Math.round(predBps * 100) / 100 : null,
      winTopPct: Math.round(expTop * 100),
      winFieldPct: Math.round(expField * 100),
      rankNow: lastRun ? rankOf(lastRun.id) : board.length ? "—" : 1,
      fieldN: board.length,
      form: trend > 5 ? "▲ hot" : trend < -5 ? "▼ cool" : "● steady",
      eloHint: Math.round(1000 + cur * 2 + (liveBps || 0) * 15),
    };
  }

  function ensureCss() {
    if (document.getElementById("mg-board-css")) return;
    var st = document.createElement("style");
    st.id = "mg-board-css";
    st.textContent = [
      "#mg-activity-board{position:fixed;right:12px;top:48px;z-index:2147482993;",
      "  width:min(300px,42vw);border-radius:12px;overflow:hidden;",
      "  background:rgba(10,12,16,0.55);backdrop-filter:blur(22px) saturate(1.35);",
      "  -webkit-backdrop-filter:blur(22px) saturate(1.35);",
      "  border:1px solid rgba(255,255,255,0.16);",
      "  box-shadow:0 8px 24px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.1);",
      "  font:650 9px/1.25 system-ui;color:rgba(244,246,250,0.92);pointer-events:auto}",
      "#mg-activity-board.mini-layout{right:8px;top:40px;width:min(260px,48vw)}",
      "#mg-activity-board.hidden{display:none}",
      "#mg-board-chip{position:fixed;right:10px;top:10px;z-index:2147483005;",
      "  padding:7px 12px;border-radius:999px;cursor:pointer;pointer-events:auto;",
      "  background:rgba(10,14,12,0.72);backdrop-filter:blur(18px);",
      "  -webkit-backdrop-filter:blur(18px);border:1px solid rgba(120,230,160,0.45);",
      "  box-shadow:0 4px 16px rgba(0,0,0,0.2),0 0 12px rgba(80,200,140,0.15);",
      "  font:700 10px/1 system-ui;letter-spacing:0.08em;text-transform:uppercase;",
      "  color:rgba(140,255,190,0.98)}",
      "#mg-board-chip:hover{background:rgba(20,40,28,0.85);border-color:rgba(160,255,200,0.7)}",
      "#mg-board-chip.hidden{display:none}",
      "#mg-board-chip .n{opacity:0.75;font-weight:600;margin-left:6px;letter-spacing:0.02em;",
      "  text-transform:none}",
      "#mg-activity-board .hd{display:flex;justify-content:space-between;align-items:center;",
      "  padding:6px 8px;letter-spacing:0.1em;text-transform:uppercase;",
      "  border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,210,120,0.95)}",
      "#mg-activity-board .hd button{appearance:none;background:transparent;border:0;color:inherit;",
      "  cursor:pointer;font:700 11px/1 system-ui;margin-left:4px}",
      "#mg-activity-board .lane{display:flex;gap:4px;padding:4px 8px;",
      "  border-bottom:1px solid rgba(255,255,255,0.08)}",
      "#mg-activity-board .lane button{appearance:none;cursor:pointer;padding:3px 8px;border-radius:999px;",
      "  font:700 8px/1 system-ui;color:rgba(220,230,240,0.85);",
      "  background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1)}",
      "#mg-activity-board .lane button.on{background:rgba(80,220,140,0.2);border-color:rgba(120,230,160,0.45);",
      "  color:rgba(160,255,200,0.98)}",
      "#mg-activity-board .live{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;padding:6px 8px;",
      "  border-bottom:1px solid rgba(255,255,255,0.08);background:rgba(0,40,20,0.25)}",
      "#mg-activity-board .live .c{text-align:center}",
      "#mg-activity-board .live .k{font:650 7px/1 system-ui;letter-spacing:0.08em;text-transform:uppercase;",
      "  color:rgba(160,200,180,0.75)}",
      "#mg-activity-board .live .v{font:700 13px/1.2 ui-monospace,Menlo,monospace;color:rgba(120,255,180,0.95);",
      "  margin-top:3px}",
      "#mg-activity-board .live .v.warn{color:rgba(255,200,120,0.95)}",
      "#mg-activity-board .pred{padding:5px 8px;font:500 8px/1.3 ui-monospace,Menlo,monospace;",
      "  color:rgba(180,220,255,0.9);border-bottom:1px solid rgba(255,255,255,0.08);",
      "  background:linear-gradient(90deg,rgba(40,80,40,0.2),transparent)}",
      "#mg-activity-board .syn{padding:6px 8px;font:500 8px/1.3 ui-monospace,Menlo,monospace;",
      "  color:rgba(180,220,255,0.9);border-bottom:1px solid rgba(255,255,255,0.08)}",
      "#mg-activity-board .rank-table{margin:0;padding:4px 8px 8px;max-height:210px;overflow:auto}",
      "#mg-activity-board .rank-row{display:grid;grid-template-columns:22px 1fr 48px 36px;gap:4px;",
      "  align-items:center;padding:4px 2px;border-bottom:1px solid rgba(255,255,255,0.05);",
      "  font:500 8px/1.25 ui-monospace,Menlo,monospace;color:rgba(210,220,230,0.9)}",
      "#mg-activity-board .rank-row.me{background:rgba(255,180,60,0.1);border-radius:4px;",
      "  color:rgba(255,220,140,0.98)}",
      "#mg-activity-board .rank-row .rk{font-weight:700;color:rgba(120,230,160,0.95)}",
      "#mg-activity-board .rank-row .sc{font-weight:700;text-align:right}",
      "#mg-activity-board .rank-row .elo{text-align:right;opacity:0.7}",
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

  function ensureChip() {
    if (chip || document.getElementById("mg-board-chip")) return;
    ensureCss();
    chip = document.createElement("button");
    chip.type = "button";
    chip.id = "mg-board-chip";
    chip.title = "Open WebGrid leaderboard (mini + full)";
    chip.innerHTML = 'BOARD<span class="n" id="mg-board-chip-n">·</span>';
    chip.onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      toggle();
    };
    (document.body || document.documentElement).appendChild(chip);
    paintChip();
  }

  function paintChip() {
    ensureChip();
    if (!chip) return;
    var b = boardFiltered();
    var top = b[0] ? fmtNum(b[0].score) : "—";
    var mini = isMiniWebgrid();
    chip.innerHTML =
      (mini ? "MINI BOARD" : "BOARD") +
      '<span class="n">#' +
      top +
      " · n" +
      boardRanked().length +
      "</span>";
    /* chip visible when panel closed — always findable on WebGrid */
    if (open) chip.classList.add("hidden");
    else chip.classList.remove("hidden");
  }

  function ensurePanel() {
    if (panel) return;
    ensureCss();
    ensureChip();
    panel = document.createElement("div");
    panel.id = "mg-activity-board";
    panel.className = (open ? "" : "hidden") + (isMiniWebgrid() ? " mini-layout" : "");
    panel.innerHTML =
      '<div class="hd"><span id="mg-board-hd-title">Live rank · WebGrid</span>' +
      '<span><button type="button" id="mg-board-snap" title="snapshot">＋</button>' +
      '<button type="button" id="mg-board-x">×</button></span></div>' +
      '<div class="lane">' +
      '<button type="button" id="mg-board-lane-all" class="on">ALL</button>' +
      '<button type="button" id="mg-board-lane-mini">MINI 12×12</button>' +
      '<button type="button" id="mg-board-lane-full">FULL 30×30</button>' +
      "</div>" +
      '<div class="live" id="mg-board-live">' +
      '<div class="c"><div class="k">Live</div><div class="v" id="mg-board-live-sc">—</div></div>' +
      '<div class="c"><div class="k">Pred BPS</div><div class="v warn" id="mg-board-pred">—</div></div>' +
      '<div class="c"><div class="k">ELO≈</div><div class="v" id="mg-board-elo">—</div></div>' +
      "</div>" +
      '<div class="pred" id="mg-board-predline">chess/sportsfield predictions…</div>' +
      '<div class="syn" id="mg-board-syn">no run yet · chip top-right always opens board</div>' +
      '<div class="rank-table" id="mg-board-ol"></div>' +
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
    panel.querySelector("#mg-board-lane-all").onclick = function () {
      filterMini = false;
      filterFull = false;
      paintPanel();
    };
    panel.querySelector("#mg-board-lane-mini").onclick = function () {
      filterMini = true;
      filterFull = false;
      paintPanel();
    };
    panel.querySelector("#mg-board-lane-full").onclick = function () {
      filterMini = false;
      filterFull = true;
      paintPanel();
    };
  }

  var filterFull = false;

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
    ensureChip();
    paintChip();
    if (!open) return;
    ensurePanel();
    if (panel) panel.classList.toggle("mini-layout", isMiniWebgrid());
    var board = boardFiltered();
    var syn = document.getElementById("mg-board-syn");
    var ol = document.getElementById("mg-board-ol");
    var hd = document.getElementById("mg-board-hd-title");
    var live = collectMetrics();
    var pred = predictNext();
    var elSc = document.getElementById("mg-board-live-sc");
    var elPred = document.getElementById("mg-board-pred");
    var elElo = document.getElementById("mg-board-elo");
    var elPredLine = document.getElementById("mg-board-predline");
    if (hd)
      hd.textContent = isMiniWebgrid()
        ? "MINI board · 12×12"
        : "Live rank · WebGrid";
    if (elSc) elSc.textContent = fmtNum(pred.liveScore);
    if (elPred)
      elPred.textContent = pred.predBps != null ? fmtNum(pred.predBps) : "—";
    if (elElo) elElo.textContent = String(pred.eloHint);
    if (elPredLine) {
      elPredLine.textContent =
        (isMiniWebgrid() ? "MINI 12×12 · " : "") +
        "P(top) " +
        pred.winTopPct +
        "% · P(field) " +
        pred.winFieldPct +
        "% · " +
        pred.form +
        " · n=" +
        board.length +
        (pred.liveBps != null ? " · live " + fmtNum(pred.liveBps) + " BPS" : "");
    }
    try {
      var bAll = document.getElementById("mg-board-lane-all");
      var bMini = document.getElementById("mg-board-lane-mini");
      var bFull = document.getElementById("mg-board-lane-full");
      if (bAll) bAll.classList.toggle("on", !filterMini && !filterFull);
      if (bMini) bMini.classList.toggle("on", !!filterMini);
      if (bFull) bFull.classList.toggle("on", !!filterFull);
    } catch (eL) {}
    if (syn)
      syn.textContent =
        (lastRun ? lastRun.synopsis : synopsis(live)).slice(0, 120) ||
        "chip top-right · BOARD · always findable";
    if (ol) {
      ol.innerHTML = "";
      if (!board.length) {
        var empty = document.createElement("div");
        empty.className = "rank-row";
        empty.style.opacity = "0.55";
        empty.textContent = filterMini
          ? "no MINI runs yet · play 12×12 then SNAP"
          : "empty — SNAP or finish a playthrough";
        ol.appendChild(empty);
      } else {
        board.slice(0, 12).forEach(function (r, i) {
          var row = document.createElement("div");
          row.className = "rank-row" + (lastRun && r.id === lastRun.id ? " me" : "");
          var elo = Math.round(1000 + (r.score || 0) * 2);
          var w = r.metrics && r.metrics.webgrid;
          var bps = w
            ? w.sessionPeakBps || w.peakBps || w.bestBps || w.bps
            : null;
          row.innerHTML =
            '<span class="rk">#' +
            (i + 1) +
            "</span>" +
            "<span title=\"" +
            (r.synopsis || "").replace(/"/g, "") +
            "\">" +
            gameLabel(r.game) +
            " · " +
            shortSyn(r) +
            "</span>" +
            '<span class="sc">' +
            fmtNum(r.score) +
            "</span>" +
            '<span class="elo">' +
            (bps != null ? fmtNum(bps) : elo) +
            "</span>";
          ol.appendChild(row);
        });
      }
    }
  }

  /* Live refresh while open (sportsfield ticker) */
  setInterval(function () {
    if (open) paintPanel();
  }, 900);

  function openPanel() {
    open = true;
    ensurePanel();
    ensureChip();
    panel.classList.remove("hidden");
    if (chip) chip.classList.add("hidden");
    paintPanel();
  }

  function close() {
    open = false;
    if (panel) panel.classList.add("hidden");
    ensureChip();
    if (chip) chip.classList.remove("hidden");
    paintChip();
  }

  function toggle() {
    if (open) close();
    else openPanel();
  }

  /* Mini WebGrid: auto-open board + chip always present */
  function bootFindable() {
    ensureChip();
    paintChip();
    if (IS_LB_PAGE) return;
    if (isWebgridHost()) {
      filterMini = isMiniWebgrid();
      /* open after short delay so playfield paints first */
      setTimeout(function () {
        openPanel();
        log(VER + " · board findable" + (isMiniWebgrid() ? " MINI" : ""));
      }, 700);
    }
  }
  setTimeout(bootFindable, 400);
  setTimeout(bootFindable, 2000);

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
    predict: predictNext,
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
      var p = predictNext();
      return (
        VER +
        " n=" +
        b.length +
        " top=" +
        (b[0] ? b[0].score : "—") +
        (lastRun ? " last=" + lastRun.score : "") +
        " pred=" +
        (p.predBps != null ? p.predBps : "—")
      );
    },
  };

  log(VER + " · sportsfield live rank + predictions");
})();
