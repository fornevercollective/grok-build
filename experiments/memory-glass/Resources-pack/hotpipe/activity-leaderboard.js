/* Memory Glass · built-in activity leaderboard + run synopsis
 * Aggregates WebGrid / contrail / Bloch / beats / Rubik / kbatch into ranked runs.
 * X draft consumes this (human post only — no auto-X).
 * Clean window → leaderboard.html after playthrough to post.
 * Live ranking: chess/sportsfield style (mueee games spirit) + predictions.
 * Stays open during WebGrid play.
 * Mini WebGrid: always findable (chip + auto-open on 12×12).
 * Fleet: Mac mini M4 + laptop benches seeded with real gameplay metrics.
 * VER: activity-board-v7-shell-hdr
 */
(function () {
  "use strict";
  var VER = "activity-board-v8-narrow-safe";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._activityBoardVer === VER) return;
  HP._activityBoardVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var KEY = "mg.activity.leaderboard.v1";
  var MAX = 48;
  var panel = null;
  var chip = null;
  var open = false;
  var collapsed = false; /* CTRL-style pill: metrics visible, table hidden */
  var lastRun = null;
  var postToast = null;
  var lastPromptRunId = null;
  var filterMini = false; /* show mini-webgrid lane only */
  var filterFull = false;
  var filterMachine = "all"; /* all | mini | laptop */

  /* Fleet seed: real soak metrics (Mac mini) + laptop Intel bench — not composites-only */
  var FLEET_SEED = [
    {
      id: "fleet-mini-agent-30-peak",
      kind: "agent_end",
      t: 1784358082459,
      iso: "2026-07-18T05:41:22Z",
      game: "webgrid",
      score: 6314.3,
      synopsis:
        "WebGrid 30 · Mac mini M4 agent · 483.58 BPS / 2957 NTPM · 30×30 · 3377 clicks · score 6314.3",
      metrics: {
        t: 1784358082459,
        iso: "2026-07-18T05:41:22Z",
        game: "webgrid",
        player: "agent",
        machine: {
          model: "Mac16,10",
          arch: "arm64",
          host: "tadericsonsMini",
          class: "mac-mini-m4",
          label: "Mac mini M4",
          display: "2560x1440",
        },
        webgrid: {
          peakBps: 483.58,
          peakNtpm: 2957,
          bestBps: 483.58,
          bestNtpm: 2957,
          bps: 483.58,
          ntpm: 2957,
          grid: "30x30",
          N: 30,
          clicks: 3377,
          hitsGuess: 3377,
        },
        score: 6314.3,
      },
    },
    {
      id: "fleet-mini-agent-12-peak",
      kind: "agent_end",
      t: 1784360879163,
      iso: "2026-07-18T06:27:59Z",
      game: "webgrid-mini",
      score: 5705.8,
      synopsis:
        "WebGrid MINI 12 · Mac mini M4 agent · 402.03 BPS / 3369 NTPM · 12×12 · 3900 clicks · score 5705.8",
      metrics: {
        t: 1784360879163,
        iso: "2026-07-18T06:27:59Z",
        game: "webgrid-mini",
        player: "agent",
        machine: {
          model: "Mac16,10",
          arch: "arm64",
          host: "tadericsonsMini",
          class: "mac-mini-m4",
          label: "Mac mini M4",
          display: "2560x1440",
        },
        webgrid: {
          peakBps: 402.03,
          peakNtpm: 3369,
          bestBps: 402.03,
          bestNtpm: 3369,
          bps: 402.03,
          ntpm: 3369,
          grid: "12x12",
          N: 12,
          clicks: 3900,
          hitsGuess: 3900,
        },
        score: 5705.8,
      },
    },
    {
      id: "fleet-mini-agent-30-live98",
      kind: "agent_end",
      t: 1784359000000,
      iso: "2026-07-18T05:56:47Z",
      game: "webgrid",
      score: 1281.2,
      synopsis:
        "WebGrid 30 · Mac mini M4 agent · 98.12 BPS / 600 NTPM · 30×30 · 619 clicks · live capture · score 1281.2",
      metrics: {
        t: 1784359000000,
        iso: "2026-07-18T05:56:47Z",
        game: "webgrid",
        player: "agent",
        machine: {
          model: "Mac16,10",
          arch: "arm64",
          host: "tadericsonsMini",
          class: "mac-mini-m4",
          label: "Mac mini M4",
        },
        webgrid: {
          peakBps: 98.12,
          peakNtpm: 600,
          bestBps: 98.12,
          bestNtpm: 600,
          bps: 98.12,
          ntpm: 600,
          grid: "30x30",
          N: 30,
          clicks: 619,
          hitsGuess: 619,
        },
        score: 1281.2,
      },
    },
    {
      id: "fleet-mini-agent-3rounds",
      kind: "agent_session",
      t: 1784360201087,
      iso: "2026-07-18T06:16:41Z",
      game: "webgrid",
      score: 1185.1,
      synopsis:
        "WebGrid 30 · Mac mini M4 agent · 90.76 BPS / 555 NTPM · 30×30 · 3 rounds · score 1185.1",
      metrics: {
        t: 1784360201087,
        iso: "2026-07-18T06:16:41Z",
        game: "webgrid",
        player: "agent",
        machine: {
          model: "Mac16,10",
          arch: "arm64",
          host: "tadericsonsMini",
          class: "mac-mini-m4",
          label: "Mac mini M4",
        },
        webgrid: {
          peakBps: 90.76,
          peakNtpm: 555,
          bestBps: 90.76,
          bestNtpm: 555,
          bps: 90.76,
          ntpm: 555,
          grid: "30x30",
          N: 30,
          clicks: 625,
          hitsGuess: 625,
          rounds: 3,
        },
        score: 1185.1,
      },
    },
    {
      id: "fleet-mini-human-30",
      kind: "human",
      t: 1784356500000,
      iso: "2026-07-18T05:15:00Z",
      game: "webgrid",
      score: 83.3,
      synopsis:
        "WebGrid 30 · Mac mini M4 human · 6.38 BPS / 39 NTPM · 30×30 · peak · score 83.3",
      metrics: {
        t: 1784356500000,
        iso: "2026-07-18T05:15:00Z",
        game: "webgrid",
        player: "human",
        machine: {
          model: "Mac16,10",
          arch: "arm64",
          host: "tadericsonsMini",
          class: "mac-mini-m4",
          label: "Mac mini M4",
        },
        webgrid: {
          peakBps: 6.38,
          peakNtpm: 39,
          bestBps: 6.38,
          bestNtpm: 39,
          bps: 6.05,
          ntpm: 37,
          grid: "30x30",
          N: 30,
        },
        score: 83.3,
      },
    },
    {
      id: "fleet-laptop-agent-30",
      kind: "agent_session",
      t: 1784397295451,
      iso: "2026-07-18T17:54:55Z",
      game: "webgrid",
      score: 49.1,
      synopsis:
        "WebGrid 30 · MacBookPro16,1 Intel laptop · 3.76 BPS / 23 NTPM · 30×30 · hit≈78.8% · score 49.1",
      metrics: {
        t: 1784397295451,
        iso: "2026-07-18T17:54:55Z",
        game: "webgrid",
        player: "agent",
        machine: {
          model: "MacBookPro16,1",
          arch: "x86_64",
          host: "qbits-MacBook-Pro.local",
          class: "older-intel-laptop",
          label: "MacBook Pro 16 Intel",
          display: "3072x1920 Retina",
        },
        webgrid: {
          peakBps: 3.76,
          peakNtpm: 23,
          bestBps: 3.76,
          bestNtpm: 23,
          bps: 3.76,
          ntpm: 23,
          grid: "30x30",
          N: 30,
          clicks: 25,
          hitsGuess: 25,
          missGuess: 7,
          hitRatePct: 78.125,
        },
        score: 49.1,
      },
    },
  ];

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

  /** Detect seat: Mac mini (external QHD) vs laptop retina — or native stamp */
  function detectMachine() {
    try {
      if (window.__mgMachine && typeof window.__mgMachine === "object")
        return window.__mgMachine;
    } catch (e0) {}
    var m = {
      class: "unknown",
      label: "this-host",
      model: "?",
      arch: (typeof navigator !== "undefined" && navigator.platform) || "?",
      host: "",
    };
    try {
      var dpr = window.devicePixelRatio || 1;
      var sw = (window.screen && screen.width) || 0;
      var sh = (window.screen && screen.height) || 0;
      m.screen = sw + "x" + sh;
      m.dpr = dpr;
      m.cores = navigator.hardwareConcurrency || 0;
      /* Mini + external 2560×1440 typically dpr=1; Intel 16" retina dpr≥2 logical ~1536–1792 */
      if (dpr === 1 && sw >= 2400 && sh >= 1300) {
        m.class = "mac-mini-m4";
        m.label = "Mac mini";
        m.model = m.model === "?" ? "Mac mini (external QHD)" : m.model;
      } else if (dpr >= 2 && sw > 0 && sw <= 2000) {
        m.class = "older-intel-laptop";
        m.label = "MacBook";
        m.model = m.model === "?" ? "MacBook (retina)" : m.model;
      }
    } catch (e1) {}
    return m;
  }

  function machineLabel(m) {
    if (!m) return "";
    if (typeof m === "string") return m;
    return m.label || m.host || m.model || m.class || "";
  }

  function machineLane(m) {
    var c = (m && m.class) || "";
    var l = ((m && m.label) || "").toLowerCase();
    var model = ((m && m.model) || "").toLowerCase();
    if (/mac-mini|macmini|mac16/i.test(c + model) || /mac mini/i.test(l)) return "mini";
    if (/laptop|macbook|intel/i.test(c + model + l)) return "laptop";
    return "other";
  }

  /** Upsert fleet seed + optional window.__mgFleetBoard (from native inject) */
  function mergeFleetSeed() {
    try {
      var extra = [];
      if (window.__mgFleetBoard) {
        var fb = window.__mgFleetBoard;
        if (typeof fb === "string") fb = JSON.parse(fb);
        if (fb && Array.isArray(fb.runs)) extra = fb.runs;
        else if (Array.isArray(fb)) extra = fb;
      }
      var seed = FLEET_SEED.concat(extra);
      if (!seed.length) return;
      var board = loadBoard();
      var byId = {};
      board.forEach(function (r) {
        if (r && r.id) byId[r.id] = r;
      });
      var nNew = 0;
      seed.forEach(function (r) {
        if (!r || !r.id) return;
        /* Always refresh fleet-* ids so Mini metrics stay current */
        if (/^fleet-/.test(r.id) || !byId[r.id]) {
          if (!byId[r.id]) nNew++;
          byId[r.id] = r;
        }
      });
      var merged = Object.keys(byId).map(function (k) {
        return byId[k];
      });
      merged.sort(function (a, b) {
        return (b.score || 0) - (a.score || 0);
      });
      saveBoard(merged);
      if (nNew) log("fleet seed +" + nNew + " · board n=" + merged.length);
    } catch (eF) {}
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
      player: "live",
      machine: detectMachine(),
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
        if (sb.missGuess != null) m.webgrid.missGuess = sb.missGuess;
        if (sb.N != null) m.webgrid.N = sb.N;
      }
      if (window.__mgAgentPlayLast) {
        var ap = window.__mgAgentPlayLast;
        m.webgrid = m.webgrid || {};
        m.webgrid.lastKind = ap.kind;
        m.player = "agent";
        if (ap.peak) {
          m.webgrid.peakBps = m.webgrid.peakBps || ap.peak.bps;
          m.webgrid.peakNtpm = m.webgrid.peakNtpm || ap.peak.ntpm;
        }
        if (ap.bestBps != null) m.webgrid.bestBps = ap.bestBps;
        if (ap.bestNtpm != null) m.webgrid.bestNtpm = ap.bestNtpm;
        if (ap.clicks != null) m.webgrid.clicks = ap.clicks;
        if (ap.hitsGuess != null) m.webgrid.hitsGuess = ap.hitsGuess;
        if (ap.missGuess != null) m.webgrid.missGuess = ap.missGuess;
        /* agent_end often has N but null grid */
        if (ap.N != null) {
          m.webgrid.N = ap.N;
          if (!m.webgrid.grid) m.webgrid.grid = ap.N + "x" + ap.N;
          if (ap.N === 12) m.game = "webgrid-mini";
          else if (ap.N === 30) m.game = "webgrid";
        }
        if (ap.grid) m.webgrid.grid = ap.grid;
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
    bits.push(gameLabel(game));

    var ml = machineLabel(m.machine);
    if (ml) bits.push(ml);
    if (m.player && m.player !== "live") bits.push(m.player);

    var w = m.webgrid || {};
    var peak =
      w.sessionPeakBps || w.peakBps || w.bestBps || (typeof w.bps === "number" ? w.bps : null);
    var ntpm =
      w.sessionPeakNtpm || w.peakNtpm || w.bestNtpm || (typeof w.ntpm === "number" ? w.ntpm : null);
    if (peak != null && isFinite(peak))
      bits.push(fmtNum(peak) + " BPS" + (ntpm != null ? " / " + fmtNum(ntpm) + " NTPM" : ""));
    if (w.grid) bits.push(w.grid);
    else if (w.N) bits.push(w.N + "x" + w.N);
    if (w.clicks != null) bits.push(w.clicks + " clicks");
    if (w.hitsGuess != null && w.missGuess != null) {
      var tot = (w.hitsGuess || 0) + (w.missGuess || 0);
      if (tot > 0)
        bits.push("hit≈" + Math.round((1000 * w.hitsGuess) / tot) / 10 + "%");
    } else if (w.hitRatePct != null) bits.push("hit≈" + fmtNum(w.hitRatePct) + "%");

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
      b = b.filter(function (r) {
        return (
          r.game === "webgrid-mini" ||
          (r.metrics &&
            r.metrics.webgrid &&
            (/12/.test(String(r.metrics.webgrid.grid || "")) || r.metrics.webgrid.N === 12))
        );
      });
    }
    if (filterFull) {
      b = b.filter(function (r) {
        return (
          r.game === "webgrid" ||
          (r.metrics &&
            r.metrics.webgrid &&
            (/30/.test(String(r.metrics.webgrid.grid || "")) || r.metrics.webgrid.N === 30))
        );
      });
    }
    if (filterMachine === "mini") {
      b = b.filter(function (r) {
        return machineLane(r.metrics && r.metrics.machine) === "mini";
      });
    } else if (filterMachine === "laptop") {
      b = b.filter(function (r) {
        return machineLane(r.metrics && r.metrics.machine) === "laptop";
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
    if (!m.machine) m.machine = detectMachine();
    /* Prefer game from webgrid N when agent ends without host path context */
    if (m.webgrid && m.webgrid.N === 12) m.game = "webgrid-mini";
    else if (m.webgrid && m.webgrid.N === 30 && (!m.game || m.game === "session"))
      m.game = "webgrid";
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
    var seat = machineLabel(m.machine);
    if (seat) lines.push("💻 " + seat + (m.player ? " · " + m.player : ""));
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
          (w.grid ? " · " + w.grid : "") +
          (w.clicks != null ? " · " + w.clicks + " clicks" : "")
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

    /* top board — full gameplay metrics by machine */
    if (board.length) {
      lines.push("");
      lines.push("— leaderboard (fleet local) —");
      board.slice(0, 8).forEach(function (r, i) {
        var mark = r.id === run.id ? " ◀" : "";
        var rw = (r.metrics && r.metrics.webgrid) || {};
        var rb =
          rw.sessionPeakBps || rw.peakBps || rw.bestBps || rw.bps;
        var rn =
          rw.sessionPeakNtpm || rw.peakNtpm || rw.bestNtpm || rw.ntpm;
        lines.push(
          i +
            1 +
            ". " +
            (rb != null ? fmtNum(rb) + " BPS" : fmtNum(r.score)) +
            (rn != null ? " / " + fmtNum(rn) + " NTPM" : "") +
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
    try {
      if (window.__mgKbatchFleet && window.__mgKbatchFleet.synopsis)
        lines.push("Fleet  · " + window.__mgKbatchFleet.synopsis());
    } catch (eK) {}
    lines.push("");
    lines.push("#MemoryGlass #WebGrid #KBatch #μgrad #R4data");
    lines.push("");
    lines.push("(You post — no auto-post · board local)");

    return lines.join("\n");
  }

  function shortSyn(r) {
    if (!r) return "—";
    var bits = [];
    var ml = r.metrics && machineLabel(r.metrics.machine);
    if (ml) bits.push(ml.replace(/MacBook Pro 16 Intel/i, "MBP16").replace(/Mac mini M4/i, "Mini"));
    if (r.metrics && r.metrics.player && r.metrics.player !== "live")
      bits.push(r.metrics.player);
    if (r.metrics && r.metrics.webgrid) {
      var w = r.metrics.webgrid;
      var p = w.sessionPeakBps || w.peakBps || w.bestBps || w.bps;
      var n = w.sessionPeakNtpm || w.peakNtpm || w.bestNtpm || w.ntpm;
      if (p != null) bits.push(fmtNum(p) + " BPS");
      if (n != null) bits.push(fmtNum(n) + " NTPM");
      if (w.grid) bits.push(String(w.grid));
      else if (w.N) bits.push(w.N + "x" + w.N);
      if (w.clicks != null) bits.push(w.clicks + "clk");
    }
    if (bits.length) return bits.join(" · ");
    if (r.synopsis) return String(r.synopsis).slice(0, 56);
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
    var old = document.getElementById("mg-board-css");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "mg-board-css";
    st.textContent = [
      /* Expanded panel — glass card (open state only) */
      "#mg-activity-board{position:fixed;right:12px;top:44px;z-index:2147482993;",
      "  width:min(300px,42vw);border-radius:12px;overflow:hidden;",
      "  background:rgba(10,12,16,0.55);backdrop-filter:blur(22px) saturate(1.35);",
      "  -webkit-backdrop-filter:blur(22px) saturate(1.35);",
      "  border:1px solid rgba(255,255,255,0.16);",
      "  box-shadow:0 8px 24px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.1);",
      "  font:650 9px/1.25 system-ui;color:rgba(244,246,250,0.92);pointer-events:auto;",
      "  transition:max-height .2s ease,width .18s ease,border-radius .18s ease,",
      "    background .15s,border-color .15s,box-shadow .15s,top .15s,right .15s}",
      "#mg-activity-board.mini-layout{right:8px;top:40px;width:min(260px,48vw)}",
      "#mg-activity-board.hidden{display:none!important}",
      /*
       * Collapsed = same language as shell top chrome (#mg-dev-toggle / #mg-mode-trigger):
       * flat word · uppercase · wide tracking · no pill chrome · sits in top-right band.
       */
      "#mg-activity-board.collapsed{",
      "  top:var(--mg-shell-top,2px)!important;right:auto!important;",
      "  left:auto!important;",
      /* sit left of INSPECT · PAGE; clamp so it never slides off small windows */
      "  right:max(8px, min(42vw, calc(8px + var(--mg-top-right-w, 168px))))!important;",
      "  max-height:none!important;min-height:28px!important;height:auto!important;",
      "  width:auto!important;max-width:min(46vw,360px)!important;",
      "  border-radius:0!important;overflow:visible!important;",
      "  background:transparent!important;border:none!important;box-shadow:none!important;",
      "  backdrop-filter:none!important;-webkit-backdrop-filter:none!important;",
      "  font:600 var(--mg-hdr-fs,11px)/1 system-ui,sans-serif;",
      "  z-index:2147483641!important;pointer-events:auto!important}",
      /* narrow: LIVE RANK becomes compact chip-word, still in top band */
      "@media (max-width:820px){",
      "  #mg-activity-board.collapsed{",
      "    right:max(6px, calc(6px + var(--mg-top-right-w, 120px)))!important;",
      "    max-width:min(38vw,200px)!important}",
      "  #mg-activity-board.collapsed .pill-sum{max-width:72px!important;font-size:9px!important}",
      "  #mg-activity-board.collapsed .hd .acts button:not(#mg-board-fold){display:none!important}",
      "  #mg-board-chip{right:max(6px, calc(6px + var(--mg-top-right-w,120px)))!important;",
      "    max-width:min(36vw,160px)!important;overflow:hidden;text-overflow:ellipsis}",
      "}",
      "@media (max-width:560px){",
      "  #mg-activity-board.collapsed{",
      "    top:calc(var(--mg-shell-top,2px) + 26px)!important;",
      "    right:8px!important;max-width:min(90vw,280px)!important}",
      "  #mg-board-chip{",
      "    top:calc(var(--mg-shell-top,2px) + 26px)!important;right:8px!important}",
      "}",
      "#mg-activity-board.collapsed .lane,",
      "#mg-activity-board.collapsed .live,",
      "#mg-activity-board.collapsed .pred,",
      "#mg-activity-board.collapsed .syn,",
      "#mg-activity-board.collapsed .rank-table,",
      "#mg-activity-board.collapsed .ft{display:none!important}",
      "#mg-activity-board.collapsed .hd{",
      "  border-bottom:0!important;padding:var(--mg-hdr-pad-y,6px) 2px!important;",
      "  gap:8px;min-height:28px;cursor:pointer;",
      "  color:rgba(255,255,255,0.9);letter-spacing:var(--mg-hdr-ls,0.22em);",
      "  text-transform:uppercase;background:transparent!important;",
      "  text-shadow:0 1px 2px rgba(0,0,0,0.4)}",
      "#mg-activity-board.collapsed .hd .ttl{",
      "  font:600 var(--mg-hdr-fs,11px)/1 system-ui,sans-serif!important;",
      "  letter-spacing:var(--mg-hdr-ls,0.22em)!important;flex-shrink:0;",
      "  color:rgba(255,255,255,0.9)!important}",
      "#mg-activity-board.collapsed .hd .ttl .dot{",
      "  opacity:0.55;margin-right:6px;letter-spacing:0;font-weight:700}",
      "#mg-activity-board.collapsed .pill-sum{display:inline!important;",
      "  font:600 10px/1 ui-monospace,Menlo,monospace!important;",
      "  letter-spacing:0.06em!important;text-transform:none!important;",
      "  color:rgba(255,255,255,0.72)!important;flex:0 1 auto;min-width:0;",
      "  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
      "  text-shadow:0 1px 2px rgba(0,0,0,0.4)}",
      "#mg-activity-board.collapsed .hd .acts{gap:4px}",
      "#mg-activity-board.collapsed .hd button{",
      "  font:600 10px/1 system-ui!important;padding:2px 4px!important;",
      "  border-radius:0!important;opacity:0.55;letter-spacing:0.08em;",
      "  color:rgba(255,255,255,0.75)!important}",
      "#mg-activity-board.collapsed .hd button:hover{opacity:1;background:transparent!important;",
      "  color:#fff!important;text-shadow:0 0 12px rgba(255,255,255,0.4)}",
      "#mg-activity-board.collapsed:hover .hd{opacity:1;color:#fff}",
      "#mg-activity-board .pill-sum{display:none}",
      /* chip when board fully closed — same flat shell word as INSPECT / PAGE */
      "#mg-board-chip{position:fixed;right:max(12px, calc(12px + var(--mg-top-right-w,168px)));",
      "  top:var(--mg-shell-top,2px);z-index:2147483005;",
      "  padding:var(--mg-hdr-pad-y,6px) 2px;border-radius:0;cursor:pointer;pointer-events:auto;",
      "  background:transparent!important;border:none!important;box-shadow:none!important;",
      "  backdrop-filter:none!important;-webkit-backdrop-filter:none!important;",
      "  font:600 var(--mg-hdr-fs,11px)/1 system-ui,sans-serif;",
      "  letter-spacing:var(--mg-hdr-ls,0.22em);text-transform:uppercase;",
      "  color:rgba(255,255,255,0.9);text-shadow:0 1px 2px rgba(0,0,0,0.4);",
      "  min-height:28px;opacity:0.92}",
      "#mg-board-chip:hover{opacity:1;color:#fff;background:transparent!important;",
      "  text-shadow:0 0 14px rgba(255,255,255,0.45)}",
      "#mg-board-chip.hidden{display:none}",
      "#mg-board-chip .dot{opacity:0.55;margin-right:6px;letter-spacing:0}",
      "#mg-board-chip .n{opacity:0.65;font:600 10px/1 ui-monospace,Menlo,monospace;",
      "  margin-left:8px;letter-spacing:0.06em;text-transform:none}",
      "#mg-activity-board .hd{display:flex;justify-content:space-between;align-items:center;gap:6px;",
      "  padding:6px 8px;letter-spacing:0.1em;text-transform:uppercase;",
      "  border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,210,120,0.95);",
      "  cursor:default;flex-shrink:0}",
      "#mg-activity-board .hd .ttl{font:700 10px/1 system-ui;flex-shrink:0}",
      "#mg-activity-board .hd .acts{display:flex;align-items:center;gap:2px;flex-shrink:0}",
      "#mg-activity-board .hd button{appearance:none;background:transparent;border:0;color:inherit;",
      "  cursor:pointer;font:700 11px/1 system-ui;padding:4px 6px;border-radius:6px}",
      "#mg-activity-board .hd button:hover{background:rgba(255,255,255,0.1)}",
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
      "#mg-activity-board .rank-table{margin:0;padding:4px 8px 8px;max-height:240px;overflow:auto}",
      "#mg-activity-board .rank-row{display:grid;grid-template-columns:22px 1fr 52px 44px;gap:4px;",
      "  align-items:center;padding:5px 2px;border-bottom:1px solid rgba(255,255,255,0.05);",
      "  font:500 8px/1.25 ui-monospace,Menlo,monospace;color:rgba(210,220,230,0.9)}",
      "#mg-activity-board .rank-row.me{background:rgba(255,180,60,0.1);border-radius:4px;",
      "  color:rgba(255,220,140,0.98)}",
      "#mg-activity-board .rank-row .rk{font-weight:700;color:rgba(120,230,160,0.95)}",
      "#mg-activity-board .rank-row .sc{font-weight:700;text-align:right}",
      "#mg-activity-board .rank-row .elo{text-align:right;opacity:0.85;color:rgba(140,255,190,0.95)}",
      "#mg-activity-board .rank-row .meta{opacity:0.72;font-size:7px}",
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
    chip.innerHTML =
      '<span class="dot">·</span>BOARD<span class="n" id="mg-board-chip-n"></span>';
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

  function measureTopRightW() {
    try {
      var tr = document.getElementById("mg-top-right");
      var vw = window.innerWidth || 1200;
      var w = 120;
      if (tr) {
        var r = tr.getBoundingClientRect();
        w = Math.max(80, Math.ceil(r.width || tr.offsetWidth || 120));
        /* if top-right is off-screen / zero, don't shove LIVE RANK left forever */
        if (r.width < 8 || r.right < 20) w = Math.min(140, Math.floor(vw * 0.22));
      }
      /* never reserve more than ~40% of narrow viewports */
      if (vw < 820) w = Math.min(w, Math.floor(vw * 0.28));
      document.documentElement.style.setProperty(
        "--mg-top-right-w",
        w + 12 + "px"
      );
    } catch (e) {}
  }

  function paintChip() {
    ensureChip();
    if (!chip) return;
    measureTopRightW();
    var b = boardFiltered();
    var top = b[0] ? fmtNum(b[0].score) : "—";
    var mini = isMiniWebgrid();
    chip.innerHTML =
      '<span class="dot">·</span>' +
      (mini ? "MINI" : "BOARD") +
      '<span class="n">#' +
      top +
      " · n" +
      boardRanked().length +
      "</span>";
    /* chip only when panel fully closed — collapsed panel IS the top chrome word */
    if (open) chip.classList.add("hidden");
    else chip.classList.remove("hidden");
  }

  function applyCollapsedClass() {
    if (!panel) return;
    panel.classList.toggle("collapsed", !!collapsed && !!open);
    var fold = panel.querySelector("#mg-board-fold");
    if (fold) fold.textContent = collapsed ? "▾" : "—";
    fold &&
      (fold.title = collapsed
        ? "expand LIVE RANK"
        : "collapse to shell word (INSPECT/PAGE style)");
  }

  function ensurePanel() {
    if (panel && document.body.contains(panel)) return;
    if (panel && !document.body.contains(panel)) panel = null;
    ensureCss();
    ensureChip();
    panel = document.createElement("div");
    panel.id = "mg-activity-board";
    panel.className =
      (open ? "" : "hidden") +
      (isMiniWebgrid() ? " mini-layout" : "") +
      (collapsed && open ? " collapsed" : "");
    panel.innerHTML =
      '<div class="hd">' +
      '<span class="ttl" id="mg-board-hd-title"><span class="dot">·</span>LIVE</span>' +
      '<span class="pill-sum" id="mg-board-pill-sum">—</span>' +
      '<span class="acts">' +
      '<button type="button" id="mg-board-fold" title="collapse">—</button>' +
      '<button type="button" id="mg-board-snap" title="snapshot">＋</button>' +
      '<button type="button" id="mg-board-x">×</button></span></div>' +
      '<div class="lane">' +
      '<button type="button" id="mg-board-lane-all" class="on">ALL</button>' +
      '<button type="button" id="mg-board-lane-mini">12×12</button>' +
      '<button type="button" id="mg-board-lane-full">30×30</button>' +
      '<button type="button" id="mg-board-lane-macmini">MINI</button>' +
      '<button type="button" id="mg-board-lane-laptop">LAPTOP</button>' +
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
    panel.querySelector("#mg-board-x").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      close();
    };
    panel.querySelector("#mg-board-fold").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      if (collapsed) expand();
      else collapse();
    };
    /* header click toggles collapse (CTRL feel) */
    var hdr = panel.querySelector(".hd");
    if (hdr) {
      hdr.addEventListener("click", function (ev) {
        if (ev.target && ev.target.closest && ev.target.closest("button")) return;
        if (collapsed) expand();
        else collapse();
      });
    }
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
      filterMachine = "all";
      paintPanel();
    };
    panel.querySelector("#mg-board-lane-macmini").onclick = function () {
      filterMachine = "mini";
      filterMini = false;
      filterFull = false;
      paintPanel();
    };
    panel.querySelector("#mg-board-lane-laptop").onclick = function () {
      filterMachine = "laptop";
      filterMini = false;
      filterFull = false;
      paintPanel();
    };
    panel.querySelector("#mg-board-lane-mini").onclick = function () {
      filterMini = true;
      filterFull = false;
      filterMachine = "all";
      paintPanel();
    };
    panel.querySelector("#mg-board-lane-full").onclick = function () {
      filterMini = false;
      filterFull = true;
      filterMachine = "all";
      paintPanel();
    };
  }

  function ensureToastCss() {
    if (document.getElementById("mg-board-toast-css")) return;
    var st = document.createElement("style");
    st.id = "mg-board-toast-css";
    st.textContent = [
      "#mg-board-toast{position:fixed;right:320px;top:48px;z-index:2147483010;",
      "  width:min(280px,36vw);border-radius:12px;overflow:hidden;",
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
    /* keep toast out of the stacked center — float-layout slot */
    try {
      if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
        window.__mgFloatLayout.apply();
      else {
        postToast.style.position = "fixed";
        postToast.style.right = "320px";
        postToast.style.top = "48px";
        postToast.style.left = "auto";
        postToast.style.bottom = "auto";
        postToast.style.transform = "none";
      }
    } catch (eT) {}
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
    if (panel) {
      panel.classList.toggle("mini-layout", isMiniWebgrid());
      applyCollapsedClass();
    }
    var board = boardFiltered();
    var syn = document.getElementById("mg-board-syn");
    var ol = document.getElementById("mg-board-ol");
    var hd = document.getElementById("mg-board-hd-title");
    var pill = document.getElementById("mg-board-pill-sum");
    var live = collectMetrics();
    var pred = predictNext();
    var elSc = document.getElementById("mg-board-live-sc");
    var elPred = document.getElementById("mg-board-pred");
    var elElo = document.getElementById("mg-board-elo");
    var elPredLine = document.getElementById("mg-board-predline");
    measureTopRightW();
    if (hd)
      hd.innerHTML = collapsed
        ? '<span class="dot">·</span>LIVE'
        : isMiniWebgrid()
          ? "MINI board · 12×12"
          : "Live rank · WebGrid";
    /* collapsed summary — same density as shell FLOW / INSPECT metrics strip */
    if (pill) {
      var bpsPill =
        live && live.webgrid
          ? live.webgrid.sessionPeakBps ||
            live.webgrid.peakBps ||
            live.webgrid.bestBps ||
            live.webgrid.bps
          : null;
      if (bpsPill == null && board[0] && board[0].metrics && board[0].metrics.webgrid) {
        var tw = board[0].metrics.webgrid;
        bpsPill = tw.sessionPeakBps || tw.peakBps || tw.bestBps || tw.bps;
      }
      var rk = pred.rankNow != null ? pred.rankNow : board.length ? 1 : "—";
      pill.textContent =
        (bpsPill != null ? fmtNum(bpsPill) + " BPS" : "—") +
        "  ·  #" +
        rk +
        "  ·  ELO " +
        (pred.eloHint != null ? pred.eloHint : "—");
    }
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
      var bMac = document.getElementById("mg-board-lane-macmini");
      var bLap = document.getElementById("mg-board-lane-laptop");
      if (bAll)
        bAll.classList.toggle(
          "on",
          !filterMini && !filterFull && filterMachine === "all"
        );
      if (bMini) bMini.classList.toggle("on", !!filterMini);
      if (bFull) bFull.classList.toggle("on", !!filterFull);
      if (bMac) bMac.classList.toggle("on", filterMachine === "mini");
      if (bLap) bLap.classList.toggle("on", filterMachine === "laptop");
    } catch (eL) {}
    if (syn)
      syn.textContent =
        (lastRun ? lastRun.synopsis : synopsis(live)).slice(0, 140) ||
        "chip top-right · BOARD · fleet Mini+laptop seeded";
    if (ol) {
      ol.innerHTML = "";
      if (!board.length) {
        var empty = document.createElement("div");
        empty.className = "rank-row";
        empty.style.opacity = "0.55";
        empty.textContent = filterMini
          ? "no 12×12 runs yet · play mini then SNAP"
          : filterMachine === "mini"
            ? "no Mac mini runs · fleet seed or play on Mini"
            : filterMachine === "laptop"
              ? "no laptop runs · Intel bench seeds at 3.76 BPS"
              : "empty — SNAP or finish a playthrough";
        ol.appendChild(empty);
      } else {
        board.slice(0, 14).forEach(function (r, i) {
          var row = document.createElement("div");
          row.className = "rank-row" + (lastRun && r.id === lastRun.id ? " me" : "");
          var w = r.metrics && r.metrics.webgrid;
          var bps = w
            ? w.sessionPeakBps || w.peakBps || w.bestBps || w.bps
            : null;
          var ntpm = w
            ? w.sessionPeakNtpm || w.peakNtpm || w.bestNtpm || w.ntpm
            : null;
          var title = (r.synopsis || "").replace(/"/g, "");
          row.innerHTML =
            '<span class="rk">#' +
            (i + 1) +
            "</span>" +
            '<span title="' +
            title +
            '">' +
            shortSyn(r) +
            (ntpm != null && bps != null
              ? '<div class="meta">' +
                gameLabel(r.game) +
                (w && w.clicks != null ? " · " + w.clicks + " clicks" : "") +
                "</div>"
              : "") +
            "</span>" +
            '<span class="sc" title="composite score">' +
            fmtNum(r.score) +
            "</span>" +
            '<span class="elo" title="peak BPS">' +
            (bps != null ? fmtNum(bps) : "—") +
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

  function openPanel(opts) {
    opts = opts || {};
    open = true;
    /* default collapsed on WebGrid so Field/Beats stay usable */
    if (opts.collapsed != null) collapsed = !!opts.collapsed;
    else if (opts.expand) collapsed = false;
    else if (isWebgridHost()) collapsed = true;
    ensurePanel();
    ensureChip();
    panel.classList.remove("hidden");
    applyCollapsedClass();
    if (chip) chip.classList.add("hidden");
    paintPanel();
    try {
      if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
        window.__mgFloatLayout.apply();
    } catch (eA) {}
  }

  function close() {
    open = false;
    collapsed = false;
    if (panel) {
      panel.classList.add("hidden");
      panel.classList.remove("collapsed");
    }
    ensureChip();
    if (chip) chip.classList.remove("hidden");
    paintChip();
    try {
      if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
        window.__mgFloatLayout.apply();
    } catch (eA) {}
  }

  function collapse() {
    if (!open) openPanel({ collapsed: true });
    else {
      collapsed = true;
      applyCollapsedClass();
      paintPanel();
      try {
        if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
          window.__mgFloatLayout.apply();
      } catch (eA) {}
      log(VER + " · collapsed pill");
    }
  }

  function expand() {
    if (!open) openPanel({ expand: true });
    else {
      collapsed = false;
      applyCollapsedClass();
      paintPanel();
      try {
        if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
          window.__mgFloatLayout.apply();
      } catch (eA) {}
      log(VER + " · expanded");
    }
  }

  function toggle() {
    if (open) close();
    else openPanel({ collapsed: isWebgridHost() });
  }

  /* Chip always findable; panel opens collapsed on WebGrid play.
   * URL ?mg_board=1 or ?mg_lab_demo=1 auto-opens live rank (pill). */
  function bootFindable() {
    ensureChip();
    paintChip();
    if (IS_LB_PAGE) return;
    if (isWebgridHost()) {
      filterMini = isMiniWebgrid();
      var forceExpand = /[?&]mg_board=full\b/i.test(location.search || "");
      var auto =
        forceExpand ||
        /[?&]mg_board=1\b/i.test(location.search || "") ||
        /[?&]mg_lab_demo=1\b/i.test(location.search || "") ||
        true; /* always show pill on WebGrid so metrics visible without covering field */
      if (auto) {
        setTimeout(function () {
          openPanel({ collapsed: !forceExpand });
          log(VER + " · board " + (forceExpand ? "expanded" : "pill"));
        }, 700);
      } else {
        log(VER + " · chip ready · click BOARD to open rank");
      }
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
            var N = cur.N || null;
            var grid =
              cur.grid ||
              (N ? N + "x" + N : null) ||
              (cur.results && cur.results[0] && cur.results[0].N
                ? cur.results[0].N + "x" + cur.results[0].N
                : null);
            var peakBps =
              (cur.peak && cur.peak.bps) ||
              cur.bestBps ||
              cur.bps ||
              (cur.sessionBest && (cur.sessionBest.peakBps || cur.sessionBest.bestBps));
            var peakNtpm =
              (cur.peak && cur.peak.ntpm) ||
              cur.bestNtpm ||
              cur.ntpm ||
              (cur.sessionBest && (cur.sessionBest.peakNtpm || cur.sessionBest.bestNtpm));
            var game =
              N === 12 || (grid && /12/.test(String(grid)))
                ? "webgrid-mini"
                : "webgrid";
            submitRun(cur.kind, {
              game: game,
              player: "agent",
              machine: detectMachine(),
              webgrid: {
                peakBps: peakBps,
                peakNtpm: peakNtpm,
                bestBps: cur.bestBps != null ? cur.bestBps : peakBps,
                bestNtpm: cur.bestNtpm != null ? cur.bestNtpm : peakNtpm,
                clicks: cur.clicks,
                hitsGuess: cur.hitsGuess,
                missGuess: cur.missGuess,
                bps: cur.bps != null ? cur.bps : peakBps,
                ntpm: cur.ntpm != null ? cur.ntpm : peakNtpm,
                grid: grid,
                N: N || (grid && parseInt(String(grid), 10)) || null,
              },
              score:
                peakBps != null && isFinite(peakBps)
                  ? Math.round((peakBps * 10 + Math.max(0, peakNtpm || 0) * 0.5) * 10) / 10
                  : undefined,
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

  setTimeout(mergeFleetSeed, 50);
  setTimeout(mergeFleetSeed, 500);
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
    boardFiltered: boardFiltered,
    predict: predictNext,
    detectMachine: detectMachine,
    mergeFleetSeed: mergeFleetSeed,
    fleetSeed: function () {
      return FLEET_SEED.slice();
    },
    lastRun: function () {
      return lastRun;
    },
    formatXDraft: formatXDraft,
    open: openPanel,
    close: close,
    toggle: toggle,
    collapse: collapse,
    expand: expand,
    isOpen: function () {
      return open;
    },
    isCollapsed: function () {
      return open && collapsed;
    },
    openLeaderboardWindow: openLeaderboardWindow,
    openPage: openLeaderboardWindow,
    buildHandoff: buildHandoff,
    showPostPrompt: showPostPrompt,
    report: function () {
      var b = loadBoard();
      var p = predictNext();
      var miniN = b.filter(function (r) {
        return machineLane(r.metrics && r.metrics.machine) === "mini";
      }).length;
      var lapN = b.filter(function (r) {
        return machineLane(r.metrics && r.metrics.machine) === "laptop";
      }).length;
      var topBps = null;
      if (b[0] && b[0].metrics && b[0].metrics.webgrid) {
        var tw = b[0].metrics.webgrid;
        topBps = tw.sessionPeakBps || tw.peakBps || tw.bestBps || tw.bps;
      }
      return (
        VER +
        (open ? (collapsed ? " pill" : " open") : " closed") +
        " n=" +
        b.length +
        " mini=" +
        miniN +
        " laptop=" +
        lapN +
        " top=" +
        (b[0] ? b[0].score : "—") +
        (topBps != null ? " topBps=" + topBps : "") +
        (lastRun ? " last=" + lastRun.score : "") +
        " pred=" +
        (p.predBps != null ? p.predBps : "—")
      );
    },
  };

  log(VER + " · fleet Mini+laptop · sportsfield live rank");
})();
