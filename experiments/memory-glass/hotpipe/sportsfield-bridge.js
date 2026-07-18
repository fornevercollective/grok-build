/* Memory Glass · sportsfield GAME MODE
 * In-float arena: WebGrid · Go · Chess (playable boards + live metrics).
 * Links out to full ugrad sports-field / train when you want the big lab.
 * VER: sportsfield-bridge-v2-game
 */
(function () {
  "use strict";
  var VER = "sportsfield-bridge-v3-match-stack";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._sportsFieldVer === VER) return;
  HP._sportsFieldVer = VER;
  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "field");
    } catch (e) {}
  }

  var LINKS = {
    field: "https://mueee.qbitos.ai/sports-field-ugrad.html",
    hub: "https://mueee.qbitos.ai/games-ugrad-hub.html",
    trainRepo: "https://github.com/fornevercollective/train",
    trainPages: "https://fornevercollective.github.io/train/",
    predictions: "https://fornevercollective.github.io/train/predictions/",
    webgrid: "https://neuralink.com/webgrid/",
  };

  var panel = null;
  var open = false;
  var ticker = null;
  var mode = "webgrid"; /* webgrid | go | chess */
  var canvas = null;
  var ctx = null;
  var raf = 0;

  /* ── shared scores ── */
  var scores = {
    webgrid: { hits: 0, misses: 0, bps: 0, peak: 0, t0: 0, running: false },
    go: { black: 0, white: 0, capturesB: 0, capturesW: 0, turn: 1 },
    chess: { turn: "w", moves: 0, selected: null, check: false },
  };

  /* ── WebGrid lite state ── */
  var wg = {
    n: 5,
    cells: [],
    target: -1,
    lastHit: 0,
    flash: 0,
  };

  /* ── Go 9×9 ── */
  var GO_N = 9;
  var goBoard = null; /* Int8Array: 0 empty, 1 black, -1 white */
  var goLast = null;

  /* ── Chess ── */
  /* board[r][c] = piece char '' or 'P','N','B','R','Q','K' / lowercase black */
  var chessBoard = null;
  var chessSel = null; /* {r,c} */
  var chessLegal = [];

  function nav(url) {
    try {
      if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
      else window.open(url, "_blank");
    } catch (e) {
      try {
        window.open(url, "_blank");
      } catch (e2) {}
    }
  }

  function liveLine() {
    var parts = [];
    if (mode === "webgrid") {
      var s = scores.webgrid;
      parts.push(
        "WEBGRID hits " +
          s.hits +
          " · miss " +
          s.misses +
          " · " +
          (s.bps ? s.bps.toFixed(1) : "0") +
          " BPS · peak " +
          (s.peak ? s.peak.toFixed(1) : "0")
      );
    } else if (mode === "go") {
      var g = scores.go;
      parts.push(
        "GO " +
          (g.turn === 1 ? "● Black" : "○ White") +
          " · B cap " +
          g.capturesB +
          " · W cap " +
          g.capturesW
      );
    } else {
      var c = scores.chess;
      parts.push(
        "CHESS " +
          (c.turn === "w" ? "White" : "Black") +
          " · moves " +
          c.moves +
          (c.check ? " · CHECK" : "")
      );
    }
    try {
      if (window.__mgActivityBoard && window.__mgActivityBoard.predict) {
        var p = window.__mgActivityBoard.predict();
        parts.push("rank " + fmt(p.liveScore) + " · ELO≈" + p.eloHint);
      }
    } catch (e) {}
    try {
      if (window.__mgWebgridCalib && window.__mgWebgridCalib.scrapeScore) {
        var sc = window.__mgWebgridCalib.scrapeScore();
        if (sc.bps != null)
          parts.push("live WebGrid " + (sc.peak && sc.peak.bps != null ? sc.peak.bps : sc.bps) + " BPS");
      }
    } catch (e2) {}
    return parts.filter(Boolean).join(" · ");
  }

  function fmt(n) {
    if (n == null || !isFinite(n)) return "—";
    if (Math.abs(n) >= 100) return String(Math.round(n));
    return (Math.round(n * 100) / 100).toString();
  }

  /* ══════════ WEBGRID ══════════ */
  function wgReset() {
    wg.cells = [];
    var n = wg.n * wg.n;
    for (var i = 0; i < n; i++) wg.cells.push(0);
    scores.webgrid.hits = 0;
    scores.webgrid.misses = 0;
    scores.webgrid.bps = 0;
    scores.webgrid.t0 = performance.now();
    scores.webgrid.running = true;
    wgPick();
  }
  function wgPick() {
    var n = wg.n * wg.n;
    var next = Math.floor(Math.random() * n);
    if (n > 1 && next === wg.target) next = (next + 1 + Math.floor(Math.random() * (n - 1))) % n;
    wg.target = next;
    wg.lastHit = performance.now();
  }
  function wgClick(ix) {
    if (!scores.webgrid.running) return;
    if (ix === wg.target) {
      scores.webgrid.hits++;
      wg.flash = 8;
      var elapsed = (performance.now() - scores.webgrid.t0) / 1000;
      if (elapsed > 0.2) {
        scores.webgrid.bps = scores.webgrid.hits / elapsed;
        if (scores.webgrid.bps > scores.webgrid.peak) scores.webgrid.peak = scores.webgrid.bps;
      }
      wgPick();
      try {
        if (window.__mgActivityBoard && window.__mgActivityBoard.noteEvent)
          window.__mgActivityBoard.noteEvent({ kind: "field_webgrid_hit", bps: scores.webgrid.bps });
      } catch (eN) {}
    } else {
      scores.webgrid.misses++;
    }
    paintHud();
  }
  function drawWebgrid(g, W, H) {
    var n = wg.n;
    var pad = 10;
    var gap = 4;
    var cell = Math.min((W - pad * 2 - gap * (n - 1)) / n, (H - pad * 2 - gap * (n - 1)) / n);
    var ox = (W - (cell * n + gap * (n - 1))) / 2;
    var oy = (H - (cell * n + gap * (n - 1))) / 2;
    g.fillStyle = "rgba(8,12,18,0.95)";
    g.fillRect(0, 0, W, H);
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var i = r * n + c;
        var x = ox + c * (cell + gap);
        var y = oy + r * (cell + gap);
        var isT = i === wg.target;
        if (isT) {
          g.fillStyle = wg.flash > 0 ? "rgba(120,255,180,0.95)" : "rgba(80,160,255,0.92)";
          if (wg.flash > 0) wg.flash--;
        } else {
          g.fillStyle = "rgba(40,48,60,0.9)";
        }
        roundRect(g, x, y, cell, cell, 6);
        g.fill();
        g.strokeStyle = isT ? "rgba(180,220,255,0.7)" : "rgba(255,255,255,0.08)";
        g.lineWidth = 1;
        g.stroke();
      }
    }
    g.fillStyle = "rgba(200,220,240,0.7)";
    g.font = "700 10px ui-monospace,Menlo,monospace";
    g.fillText("tap blue · WebGrid lite " + n + "×" + n, pad, H - 6);
  }
  function hitWebgrid(mx, my, W, H) {
    var n = wg.n;
    var pad = 10;
    var gap = 4;
    var cell = Math.min((W - pad * 2 - gap * (n - 1)) / n, (H - pad * 2 - gap * (n - 1)) / n);
    var ox = (W - (cell * n + gap * (n - 1))) / 2;
    var oy = (H - (cell * n + gap * (n - 1))) / 2;
    var c = Math.floor((mx - ox) / (cell + gap));
    var r = Math.floor((my - oy) / (cell + gap));
    if (c < 0 || r < 0 || c >= n || r >= n) return -1;
    var lx = mx - (ox + c * (cell + gap));
    var ly = my - (oy + r * (cell + gap));
    if (lx > cell || ly > cell) return -1;
    return r * n + c;
  }

  /* ══════════ GO ══════════ */
  function goReset() {
    goBoard = new Int8Array(GO_N * GO_N);
    goLast = null;
    scores.go = { black: 0, white: 0, capturesB: 0, capturesW: 0, turn: 1 };
  }
  function goAt(r, c) {
    if (r < 0 || c < 0 || r >= GO_N || c >= GO_N) return 99;
    return goBoard[r * GO_N + c];
  }
  function goSet(r, c, v) {
    goBoard[r * GO_N + c] = v;
  }
  function goGroup(r, c, color, seen) {
    var key = r + "," + c;
    if (seen[key]) return { stones: [], libs: 0 };
    seen[key] = true;
    var stones = [{ r: r, c: c }];
    var libs = {};
    var stack = [{ r: r, c: c }];
    var dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    while (stack.length) {
      var cur = stack.pop();
      for (var d = 0; d < 4; d++) {
        var nr = cur.r + dirs[d][0];
        var nc = cur.c + dirs[d][1];
        var v = goAt(nr, nc);
        if (v === 99) continue;
        if (v === 0) libs[nr + "," + nc] = true;
        else if (v === color) {
          var k2 = nr + "," + nc;
          if (!seen[k2]) {
            seen[k2] = true;
            stones.push({ r: nr, c: nc });
            stack.push({ r: nr, c: nc });
          }
        }
      }
    }
    return { stones: stones, libs: Object.keys(libs).length };
  }
  function goCaptureAround(r, c, color) {
    var opp = -color;
    var dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    var taken = 0;
    var seen = {};
    for (var d = 0; d < 4; d++) {
      var nr = r + dirs[d][0];
      var nc = c + dirs[d][1];
      if (goAt(nr, nc) !== opp) continue;
      var g = goGroup(nr, nc, opp, seen);
      if (g.libs === 0) {
        for (var i = 0; i < g.stones.length; i++) {
          goSet(g.stones[i].r, g.stones[i].c, 0);
          taken++;
        }
      }
    }
    return taken;
  }
  function goPlay(r, c) {
    if (goAt(r, c) !== 0) return false;
    var color = scores.go.turn;
    goSet(r, c, color);
    var cap = goCaptureAround(r, c, color);
    var self = goGroup(r, c, color, {});
    if (self.libs === 0 && cap === 0) {
      goSet(r, c, 0);
      return false; /* suicide */
    }
    if (color === 1) scores.go.capturesB += cap;
    else scores.go.capturesW += cap;
    goLast = { r: r, c: c };
    scores.go.turn = -color;
    paintHud();
    return true;
  }
  function drawGo(g, W, H) {
    var pad = 16;
    var size = Math.min(W, H) - pad * 2;
    var ox = (W - size) / 2;
    var oy = (H - size) / 2;
    var step = size / (GO_N - 1);
    g.fillStyle = "#c4a35a";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(180,140,60,0.95)";
    roundRect(g, ox - 10, oy - 10, size + 20, size + 20, 6);
    g.fill();
    g.strokeStyle = "rgba(40,30,15,0.55)";
    g.lineWidth = 1;
    var i, j;
    for (i = 0; i < GO_N; i++) {
      g.beginPath();
      g.moveTo(ox, oy + i * step);
      g.lineTo(ox + size, oy + i * step);
      g.stroke();
      g.beginPath();
      g.moveTo(ox + i * step, oy);
      g.lineTo(ox + i * step, oy + size);
      g.stroke();
    }
    /* hoshi */
    var stars = GO_N === 9 ? [2, 4, 6] : [3, 9, 15];
    g.fillStyle = "rgba(40,30,15,0.7)";
    for (i = 0; i < stars.length; i++) {
      for (j = 0; j < stars.length; j++) {
        g.beginPath();
        g.arc(ox + stars[i] * step, oy + stars[j] * step, 2.2, 0, Math.PI * 2);
        g.fill();
      }
    }
    for (i = 0; i < GO_N; i++) {
      for (j = 0; j < GO_N; j++) {
        var v = goAt(i, j);
        if (!v) continue;
        var x = ox + j * step;
        var y = oy + i * step;
        var grd = g.createRadialGradient(x - 2, y - 2, 1, x, y, step * 0.42);
        if (v === 1) {
          grd.addColorStop(0, "#555");
          grd.addColorStop(1, "#0a0a0a");
        } else {
          grd.addColorStop(0, "#fff");
          grd.addColorStop(1, "#d0d0d0");
        }
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, step * 0.42, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "rgba(0,0,0,0.35)";
        g.stroke();
      }
    }
    if (goLast) {
      g.strokeStyle = "rgba(220,60,40,0.85)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(ox + goLast.c * step, oy + goLast.r * step, step * 0.18, 0, Math.PI * 2);
      g.stroke();
    }
  }
  function hitGo(mx, my, W, H) {
    var pad = 16;
    var size = Math.min(W, H) - pad * 2;
    var ox = (W - size) / 2;
    var oy = (H - size) / 2;
    var step = size / (GO_N - 1);
    var c = Math.round((mx - ox) / step);
    var r = Math.round((my - oy) / step);
    if (r < 0 || c < 0 || r >= GO_N || c >= GO_N) return null;
    return { r: r, c: c };
  }

  /* ══════════ CHESS ══════════ */
  var START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
  function chessReset() {
    chessBoard = [];
    var rows = START_FEN.split("/");
    for (var r = 0; r < 8; r++) {
      chessBoard[r] = [];
      var c = 0;
      for (var k = 0; k < rows[r].length; k++) {
        var ch = rows[r][k];
        if (ch >= "1" && ch <= "8") {
          var n = parseInt(ch, 10);
          for (var t = 0; t < n; t++) chessBoard[r][c++] = "";
        } else chessBoard[r][c++] = ch;
      }
    }
    chessSel = null;
    chessLegal = [];
    scores.chess = { turn: "w", moves: 0, selected: null, check: false };
  }
  function pieceColor(p) {
    if (!p) return null;
    return p === p.toUpperCase() ? "w" : "b";
  }
  function inBoard(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }
  function chessMovesFrom(r, c) {
    var p = chessBoard[r][c];
    if (!p) return [];
    var col = pieceColor(p);
    var kind = p.toUpperCase();
    var out = [];
    function add(nr, nc) {
      if (!inBoard(nr, nc)) return false;
      var t = chessBoard[nr][nc];
      if (!t) {
        out.push({ r: nr, c: nc });
        return true;
      }
      if (pieceColor(t) !== col) out.push({ r: nr, c: nc });
      return false;
    }
    function ray(dr, dc) {
      var nr = r + dr;
      var nc = c + dc;
      while (inBoard(nr, nc)) {
        if (!add(nr, nc)) break;
        if (chessBoard[nr][nc]) break;
        nr += dr;
        nc += dc;
      }
    }
    if (kind === "P") {
      var dir = col === "w" ? -1 : 1;
      var start = col === "w" ? 6 : 1;
      if (inBoard(r + dir, c) && !chessBoard[r + dir][c]) {
        out.push({ r: r + dir, c: c });
        if (r === start && !chessBoard[r + 2 * dir][c]) out.push({ r: r + 2 * dir, c: c });
      }
      [[dir, -1], [dir, 1]].forEach(function (d) {
        var nr = r + d[0];
        var nc = c + d[1];
        if (inBoard(nr, nc) && chessBoard[nr][nc] && pieceColor(chessBoard[nr][nc]) !== col)
          out.push({ r: nr, c: nc });
      });
    } else if (kind === "N") {
      [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ].forEach(function (d) {
        add(r + d[0], c + d[1]);
      });
    } else if (kind === "B") {
      ray(1, 1);
      ray(1, -1);
      ray(-1, 1);
      ray(-1, -1);
    } else if (kind === "R") {
      ray(1, 0);
      ray(-1, 0);
      ray(0, 1);
      ray(0, -1);
    } else if (kind === "Q") {
      ray(1, 0);
      ray(-1, 0);
      ray(0, 1);
      ray(0, -1);
      ray(1, 1);
      ray(1, -1);
      ray(-1, 1);
      ray(-1, -1);
    } else if (kind === "K") {
      for (var dr = -1; dr <= 1; dr++)
        for (var dc = -1; dc <= 1; dc++) if (dr || dc) add(r + dr, c + dc);
    }
    return out;
  }
  function chessClick(r, c) {
    var turn = scores.chess.turn;
    var p = chessBoard[r][c];
    if (chessSel) {
      var legal = chessLegal.some(function (m) {
        return m.r === r && m.c === c;
      });
      if (legal) {
        chessBoard[r][c] = chessBoard[chessSel.r][chessSel.c];
        chessBoard[chessSel.r][chessSel.c] = "";
        /* promote pawn */
        if (chessBoard[r][c] === "P" && r === 0) chessBoard[r][c] = "Q";
        if (chessBoard[r][c] === "p" && r === 7) chessBoard[r][c] = "q";
        scores.chess.moves++;
        scores.chess.turn = turn === "w" ? "b" : "w";
        chessSel = null;
        chessLegal = [];
        paintHud();
        return;
      }
      if (p && pieceColor(p) === turn) {
        chessSel = { r: r, c: c };
        chessLegal = chessMovesFrom(r, c);
        return;
      }
      chessSel = null;
      chessLegal = [];
      return;
    }
    if (p && pieceColor(p) === turn) {
      chessSel = { r: r, c: c };
      chessLegal = chessMovesFrom(r, c);
    }
  }
  var GLYPH = {
    K: "♔",
    Q: "♕",
    R: "♖",
    B: "♗",
    N: "♘",
    P: "♙",
    k: "♚",
    q: "♛",
    r: "♜",
    b: "♝",
    n: "♞",
    p: "♟",
  };
  function drawChess(g, W, H) {
    var pad = 8;
    var size = Math.min(W, H) - pad * 2;
    var cell = size / 8;
    var ox = (W - size) / 2;
    var oy = (H - size) / 2;
    g.fillStyle = "rgba(12,14,18,0.95)";
    g.fillRect(0, 0, W, H);
    var r, c;
    for (r = 0; r < 8; r++) {
      for (c = 0; c < 8; c++) {
        var light = (r + c) % 2 === 0;
        g.fillStyle = light ? "#e8d5a3" : "#769656";
        g.fillRect(ox + c * cell, oy + r * cell, cell, cell);
      }
    }
    chessLegal.forEach(function (m) {
      g.fillStyle = "rgba(255,220,80,0.45)";
      g.beginPath();
      g.arc(ox + m.c * cell + cell / 2, oy + m.r * cell + cell / 2, cell * 0.18, 0, Math.PI * 2);
      g.fill();
    });
    if (chessSel) {
      g.strokeStyle = "rgba(255,200,60,0.9)";
      g.lineWidth = 2.5;
      g.strokeRect(ox + chessSel.c * cell + 1, oy + chessSel.r * cell + 1, cell - 2, cell - 2);
    }
    g.font = "700 " + Math.floor(cell * 0.72) + "px serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (r = 0; r < 8; r++) {
      for (c = 0; c < 8; c++) {
        var p = chessBoard[r][c];
        if (!p) continue;
        g.fillStyle = pieceColor(p) === "w" ? "#f8f4ea" : "#1a1a1a";
        if (pieceColor(p) === "w") {
          g.strokeStyle = "rgba(0,0,0,0.35)";
          g.lineWidth = 1;
        }
        var gx = ox + c * cell + cell / 2;
        var gy = oy + r * cell + cell / 2 + 1;
        g.fillText(GLYPH[p] || p, gx, gy);
      }
    }
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
  }
  function hitChess(mx, my, W, H) {
    var pad = 8;
    var size = Math.min(W, H) - pad * 2;
    var cell = size / 8;
    var ox = (W - size) / 2;
    var oy = (H - size) / 2;
    var c = Math.floor((mx - ox) / cell);
    var r = Math.floor((my - oy) / cell);
    if (!inBoard(r, c)) return null;
    return { r: r, c: c };
  }

  function roundRect(g, x, y, w, h, rad) {
    g.beginPath();
    g.moveTo(x + rad, y);
    g.arcTo(x + w, y, x + w, y + h, rad);
    g.arcTo(x + w, y + h, x, y + h, rad);
    g.arcTo(x, y + h, x, y, rad);
    g.arcTo(x, y, x + w, y, rad);
    g.closePath();
  }

  /* ══════════ RENDER LOOP ══════════ */
  function resizeCanvas() {
    if (!canvas || !panel) return;
    var host = panel.querySelector(".field-view");
    if (!host) return;
    var w = Math.max(200, host.clientWidth || 360);
    var h = Math.max(180, host.clientHeight || 220);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas._cssW = w;
    canvas._cssH = h;
  }

  function draw() {
    if (!open || !ctx || !canvas) return;
    var W = canvas._cssW || 360;
    var H = canvas._cssH || 220;
    if (mode === "webgrid") drawWebgrid(ctx, W, H);
    else if (mode === "go") drawGo(ctx, W, H);
    else drawChess(ctx, W, H);
    raf = requestAnimationFrame(draw);
  }

  function paintHud() {
    if (!panel) return;
    var el = panel.querySelector("#mg-field-tick");
    if (el) el.textContent = liveLine();
    var modes = panel.querySelectorAll("[data-field-mode]");
    Array.prototype.forEach.call(modes, function (b) {
      b.classList.toggle("hot", b.getAttribute("data-field-mode") === mode);
    });
    var title = panel.querySelector(".hd .ttl");
    if (title)
      title.textContent =
        "FIELD · " + (mode === "webgrid" ? "WEBGRID" : mode === "go" ? "GO 9×9" : "CHESS");
  }

  function setMode(m) {
    mode = m || "webgrid";
    if (mode === "webgrid" && !scores.webgrid.running) wgReset();
    paintHud();
    resizeCanvas();
    log(VER + " · mode " + mode);
  }

  function onCanvasPointer(ev) {
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var mx = (ev.clientX != null ? ev.clientX : ev.touches && ev.touches[0].clientX) - rect.left;
    var my = (ev.clientY != null ? ev.clientY : ev.touches && ev.touches[0].clientY) - rect.top;
    var W = canvas._cssW || rect.width;
    var H = canvas._cssH || rect.height;
    if (mode === "webgrid") {
      var ix = hitWebgrid(mx, my, W, H);
      if (ix >= 0) wgClick(ix);
    } else if (mode === "go") {
      var gp = hitGo(mx, my, W, H);
      if (gp) goPlay(gp.r, gp.c);
    } else {
      var cp = hitChess(mx, my, W, H);
      if (cp) chessClick(cp.r, cp.c);
    }
  }

  function ensureCss() {
    var old = document.getElementById("mg-field-css");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "mg-field-css";
    st.textContent = [
      "#mg-sports-field{position:fixed;right:12px;bottom:calc(120px + var(--mg-kb-h,0px));",
      "  z-index:2147482991;width:min(420px,40vw);max-height:min(52vh,480px);",
      "  border-radius:14px;overflow:hidden;display:flex;flex-direction:column;",
      "  background:rgba(8,12,14,0.72);backdrop-filter:blur(24px) saturate(1.4);",
      "  -webkit-backdrop-filter:blur(24px) saturate(1.4);",
      "  border:1px solid rgba(120,220,160,0.32);",
      "  box-shadow:0 10px 32px rgba(0,0,0,0.24),inset 0 1px 0 rgba(255,255,255,0.08);",
      "  font:650 10px/1.3 system-ui;color:rgba(230,245,235,0.94);pointer-events:auto}",
      "#mg-sports-field.hidden{display:none!important}",
      "#mg-sports-field .hd{display:flex;justify-content:space-between;align-items:center;",
      "  padding:8px 10px;letter-spacing:0.1em;text-transform:uppercase;",
      "  color:rgba(120,230,170,0.95);border-bottom:1px solid rgba(255,255,255,0.1);",
      "  background:rgba(10,16,14,0.9);flex-shrink:0}",
      "#mg-sports-field .hd .ttl{font:700 10px/1 system-ui}",
      "#mg-sports-field .hd .hd-acts{display:flex;gap:4px;align-items:center}",
      "#mg-sports-field .hd button{appearance:none;background:rgba(255,255,255,0.08);",
      "  border:1px solid rgba(255,255,255,0.12);color:inherit;cursor:pointer;",
      "  font:700 9px/1 system-ui;padding:5px 8px;border-radius:999px}",
      "#mg-sports-field .hd button#mg-field-x{background:0;border:0;font-size:12px;padding:4px 6px}",
      "#mg-sports-field .modes{display:flex;gap:4px;padding:8px 10px 0;flex-shrink:0}",
      "#mg-sports-field .modes button{appearance:none;cursor:pointer;flex:1;",
      "  padding:7px 6px;border-radius:999px;font:700 9px/1 system-ui;letter-spacing:0.06em;",
      "  text-transform:uppercase;color:rgba(230,245,235,0.85);",
      "  background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12)}",
      "#mg-sports-field .modes button.hot{background:rgba(60,180,100,0.28);",
      "  border-color:rgba(100,220,140,0.5);color:#b8ffd0}",
      "#mg-sports-field .field-view{flex:1 1 auto;min-height:140px;max-height:min(28vh,240px);",
      "  margin:6px 10px 0;border-radius:10px;overflow:hidden;",
      "  border:1px solid rgba(100,200,140,0.22);background:#0a1014}",
      "#mg-sports-field .field-view canvas{display:block;width:100%;height:100%;cursor:pointer;",
      "  min-height:140px}",
      "#mg-sports-field .bd{padding:8px 10px 10px;flex-shrink:0}",
      "#mg-sports-field .tick{font:500 9px/1.4 ui-monospace,Menlo,monospace;",
      "  color:rgba(180,230,200,0.9);min-height:2.4em;margin-bottom:8px}",
      "#mg-sports-field .row{display:flex;flex-wrap:wrap;gap:5px}",
      "#mg-sports-field .row button{appearance:none;cursor:pointer;padding:6px 9px;border-radius:999px;",
      "  font:700 8px/1 system-ui;letter-spacing:0.04em;color:rgba(240,255,245,0.95);",
      "  background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14)}",
      "#mg-sports-field .row button.hot{background:rgba(60,180,100,0.25);border-color:rgba(100,220,140,0.45)}",
      "#mg-sports-field .note{margin-top:8px;font:500 8px/1.35 system-ui;color:rgba(160,190,170,0.75)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function ensurePanel() {
    if (panel && document.body.contains(panel)) return;
    ensureCss();
    panel = document.createElement("div");
    panel.id = "mg-sports-field";
    panel.className = open ? "" : "hidden";
    panel.innerHTML =
      '<div class="hd">' +
      '  <span class="ttl">FIELD · WEBGRID</span>' +
      '  <div class="hd-acts">' +
      '    <button type="button" id="mg-field-reset" title="reset board">RESET</button>' +
      '    <button type="button" id="mg-field-x">×</button>' +
      "  </div>" +
      "</div>" +
      '<div class="modes">' +
      '  <button type="button" data-field-mode="webgrid" class="hot">WebGrid</button>' +
      '  <button type="button" data-field-mode="go">Go 9×9</button>' +
      '  <button type="button" data-field-mode="chess">Chess</button>' +
      "</div>" +
      '<div class="field-view"><canvas id="mg-field-cv"></canvas></div>' +
      '<div class="bd">' +
      '  <div class="tick" id="mg-field-tick">…</div>' +
      '  <div class="row">' +
      '    <button type="button" class="hot" id="mg-field-play">PLAY</button>' +
      '    <button type="button" id="mg-field-wg5">5×5</button>' +
      '    <button type="button" id="mg-field-wg7">7×7</button>' +
      '    <button type="button" id="mg-field-full">FULL FIELD ↗</button>' +
      '    <button type="button" id="mg-field-nl">NL WEBGRID ↗</button>' +
      '    <button type="button" id="mg-field-hub">GAMES HUB</button>' +
      '    <button type="button" id="mg-field-board">LIVE RANK</button>' +
      '    <button type="button" id="mg-field-pred">TRAIN PREDS</button>' +
      "  </div>" +
      '  <div class="note">Game mode · WebGrid targets · Go (place + capture) · Chess (legal moves) · full lab ↗</div>' +
      "</div>";
    (document.body || document.documentElement).appendChild(panel);
    canvas = panel.querySelector("#mg-field-cv");
    ctx = canvas.getContext("2d");

    panel.querySelector("#mg-field-x").onclick = close;
    panel.querySelector("#mg-field-reset").onclick = function () {
      if (mode === "webgrid") wgReset();
      else if (mode === "go") goReset();
      else chessReset();
      paintHud();
    };
    Array.prototype.forEach.call(panel.querySelectorAll("[data-field-mode]"), function (b) {
      b.onclick = function () {
        setMode(b.getAttribute("data-field-mode"));
      };
    });
    panel.querySelector("#mg-field-play").onclick = function () {
      if (mode === "webgrid") wgReset();
      else if (mode === "go") goReset();
      else chessReset();
      paintHud();
    };
    panel.querySelector("#mg-field-wg5").onclick = function () {
      wg.n = 5;
      setMode("webgrid");
      wgReset();
    };
    panel.querySelector("#mg-field-wg7").onclick = function () {
      wg.n = 7;
      setMode("webgrid");
      wgReset();
    };
    panel.querySelector("#mg-field-full").onclick = function () {
      nav(LINKS.field);
    };
    panel.querySelector("#mg-field-nl").onclick = function () {
      nav(LINKS.webgrid);
    };
    panel.querySelector("#mg-field-hub").onclick = function () {
      nav(LINKS.hub);
    };
    panel.querySelector("#mg-field-board").onclick = function () {
      if (window.__mgActivityBoard) window.__mgActivityBoard.open();
    };
    panel.querySelector("#mg-field-pred").onclick = function () {
      nav(LINKS.predictions);
    };

    canvas.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      onCanvasPointer(ev);
    });
    canvas.addEventListener(
      "touchstart",
      function (ev) {
        ev.preventDefault();
        if (ev.touches && ev.touches[0]) onCanvasPointer(ev.touches[0]);
      },
      { passive: false }
    );

    goReset();
    chessReset();
    wgReset();
  }

  function openPanel() {
    open = true;
    ensurePanel();
    panel.classList.remove("hidden");
    resizeCanvas();
    paintHud();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
    if (!ticker)
      ticker = setInterval(function () {
        if (open) paintHud();
      }, 800);
    try {
      if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
        window.__mgFloatLayout.apply();
    } catch (eA) {}
    log(VER + " · open game mode " + mode);
  }

  function close() {
    open = false;
    if (panel) panel.classList.add("hidden");
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function toggle() {
    if (open) close();
    else openPanel();
  }

  window.addEventListener("resize", function () {
    if (open) resizeCanvas();
  });

  window.__mgSportsField = {
    ver: VER,
    links: LINKS,
    open: openPanel,
    close: close,
    toggle: toggle,
    setMode: setMode,
    isOpen: function () {
      return open;
    },
    mode: function () {
      return mode;
    },
    scores: function () {
      return {
        mode: mode,
        webgrid: Object.assign({}, scores.webgrid),
        go: Object.assign({}, scores.go),
        chess: Object.assign({}, scores.chess),
      };
    },
    report: function () {
      return VER + " open=" + open + " mode=" + mode + " · " + liveLine().slice(0, 72);
    },
  };
  log(VER + " · game mode WebGrid · Go · Chess");
})();
