/**
 * ugrad-chess-lab.js — minimal legal chess (no castling / en passant v0.3; promotion → queen).
 * UgradChess { board, side, reset(), getLegalMoves(), applyMove(sanOrFromTo), toFEN() }
 */
(function (global) {
  'use strict';
  var FEN0 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1';

  function parseFEN(fen) {
    var parts = fen.trim().split(/\s+/);
    var rows = parts[0].split('/');
    var board = [];
    var r, c, row, ch, i;
    for (r = 0; r < 8; r++) {
      row = rows[r];
      c = 0;
      for (i = 0; i < row.length; i++) {
        ch = row[i];
        if (ch >= '1' && ch <= '8') {
          for (var k = 0; k < +ch; k++) board.push('.');
        } else {
          board.push(ch);
        }
      }
    }
    return { board: board, side: parts[1] === 'b' ? -1 : 1 };
  }

  function toFEN(state) {
    var rows = [];
    var r, c, row, empty;
    for (r = 0; r < 8; r++) {
      row = '';
      empty = 0;
      for (c = 0; c < 8; c++) {
        var p = state.board[r * 8 + c];
        if (p === '.') {
          empty++;
        } else {
          if (empty) { row += empty; empty = 0; }
          row += p;
        }
      }
      if (empty) row += empty;
      rows.push(row);
    }
    return rows.join('/') + ' ' + (state.side === 1 ? 'w' : 'b') + ' - - 0 1';
  }

  function cloneBoard(b) { return b.slice(); }

  function colorOf(p) {
    if (p === '.') return 0;
    return p === p.toUpperCase() ? 1 : -1;
  }

  function pieceType(p) {
    if (p === '.') return '';
    return p.toLowerCase();
  }

  function idx(r, c) { return r * 8 + c; }

  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  function addRay(moves, board, r, c, dr, dc, color) {
    var nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      var t = board[idx(nr, nc)];
      if (t === '.') moves.push(idx(r, c) << 8 | idx(nr, nc));
      else {
        if (colorOf(t) !== color) moves.push(idx(r, c) << 8 | idx(nr, nc));
        break;
      }
      nr += dr; nc += dc;
    }
  }

  function pseudoMoves(state) {
    var board = state.board;
    var color = state.side;
    var moves = [];
    var r, c, p, pr, i, fr, fc, to, dr, dc, tr, tc, dirs;
    for (r = 0; r < 8; r++) {
      for (c = 0; c < 8; c++) {
        p = board[idx(r, c)];
        if (p === '.' || colorOf(p) !== color) continue;
        pr = pieceType(p);
        if (pr === 'p') {
          var dir = color === 1 ? -1 : 1;
          var startRow = color === 1 ? 6 : 1;
          tr = r + dir; tc = c;
          if (inBounds(tr, tc) && board[idx(tr, tc)] === '.') {
            moves.push(idx(r, c) << 8 | idx(tr, tc));
            if (r === startRow) {
              tr = r + 2 * dir;
              if (inBounds(tr, tc) && board[idx(tr, tc)] === '.') moves.push(idx(r, c) << 8 | idx(tr, tc));
            }
          }
          for (dc = -1; dc <= 1; dc += 2) {
            tr = r + dir; tc = c + dc;
            if (inBounds(tr, tc)) {
              var cap = board[idx(tr, tc)];
              if (cap !== '.' && colorOf(cap) !== color) moves.push(idx(r, c) << 8 | idx(tr, tc));
            }
          }
          continue;
        }
        if (pr === 'n') {
          dirs = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
          for (i = 0; i < dirs.length; i++) {
            tr = r + dirs[i][0]; tc = c + dirs[i][1];
            if (!inBounds(tr, tc)) continue;
            var t = board[idx(tr, tc)];
            if (t === '.' || colorOf(t) !== color) moves.push(idx(r, c) << 8 | idx(tr, tc));
          }
          continue;
        }
        if (pr === 'b' || pr === 'q') {
          addRay(moves, board, r, c, 1, 1, color);
          addRay(moves, board, r, c, 1, -1, color);
          addRay(moves, board, r, c, -1, 1, color);
          addRay(moves, board, r, c, -1, -1, color);
        }
        if (pr === 'r' || pr === 'q') {
          addRay(moves, board, r, c, 1, 0, color);
          addRay(moves, board, r, c, -1, 0, color);
          addRay(moves, board, r, c, 0, 1, color);
          addRay(moves, board, r, c, 0, -1, color);
        }
        if (pr === 'k') {
          dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
          for (i = 0; i < dirs.length; i++) {
            tr = r + dirs[i][0]; tc = c + dirs[i][1];
            if (!inBounds(tr, tc)) continue;
            t = board[idx(tr, tc)];
            if (t === '.' || colorOf(t) !== color) moves.push(idx(r, c) << 8 | idx(tr, tc));
          }
        }
      }
    }
    return moves;
  }

  function rayHit(board, tr, tc, dr, dc, byColor) {
    var r = tr - dr, c = tc - dc;
    while (inBounds(r, c)) {
      var p = board[idx(r, c)];
      if (p === '.') { r -= dr; c -= dc; continue; }
      if (colorOf(p) !== byColor) return false;
      var pt = pieceType(p);
      if (dr === 0 || dc === 0) return pt === 'r' || pt === 'q';
      return pt === 'b' || pt === 'q';
    }
    return false;
  }

  function squareAttacked(board, tr, tc, byColor) {
    var r, c, p, i, dirs, dc;
    if (byColor === 1) {
      for (dc = -1; dc <= 1; dc += 2) {
        r = tr + 1; c = tc + dc;
        if (inBounds(r, c)) {
          p = board[idx(r, c)];
          if (p === 'P') return true;
        }
      }
    } else {
      for (dc = -1; dc <= 1; dc += 2) {
        r = tr - 1; c = tc + dc;
        if (inBounds(r, c)) {
          p = board[idx(r, c)];
          if (p === 'p') return true;
        }
      }
    }
    dirs = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (i = 0; i < 8; i++) {
      r = tr + dirs[i][0]; c = tc + dirs[i][1];
      if (inBounds(r, c)) {
        p = board[idx(r, c)];
        if (p !== '.' && pieceType(p) === 'n' && colorOf(p) === byColor) return true;
      }
    }
    dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (i = 0; i < 8; i++) {
      r = tr + dirs[i][0]; c = tc + dirs[i][1];
      if (inBounds(r, c)) {
        p = board[idx(r, c)];
        if (p !== '.' && pieceType(p) === 'k' && colorOf(p) === byColor) return true;
      }
    }
    dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for (i = 0; i < 8; i++) {
      if (rayHit(board, tr, tc, dirs[i][0], dirs[i][1], byColor)) return true;
    }
    return false;
  }

  function findKing(board, color) {
    var r, c, p;
    for (r = 0; r < 8; r++) {
      for (c = 0; c < 8; c++) {
        p = board[idx(r, c)];
        if (p !== '.' && pieceType(p) === 'k' && colorOf(p) === color) return idx(r, c);
      }
    }
    return -1;
  }

  function inCheck(board, color) {
    var k = findKing(board, color);
    if (k < 0) return false;
    return squareAttacked(board, (k / 8) | 0, k % 8, -color);
  }

  function applyRaw(board, from, to) {
    var b = cloneBoard(board);
    var piece = b[from];
    var cap = b[to];
    b[to] = piece;
    b[from] = '.';
    var pr = pieceType(piece);
    if (pr === 'p') {
      var tr = (to / 8) | 0;
      if (piece === 'P' && tr === 0) b[to] = 'Q';
      if (piece === 'p' && tr === 7) b[to] = 'q';
    }
    return b;
  }

  function legalMoves(state) {
    var pm = pseudoMoves(state);
    var out = [];
    var color = state.side;
    var i, m, from, to, nb;
    for (i = 0; i < pm.length; i++) {
      m = pm[i];
      from = m >> 8;
      to = m & 255;
      nb = applyRaw(state.board, from, to);
      if (!inCheck(nb, color)) out.push(m);
    }
    return out;
  }

  function UgradChess() {
    this.state = parseFEN(FEN0);
  }

  UgradChess.prototype.reset = function () { this.state = parseFEN(FEN0); };

  UgradChess.prototype.setFEN = function (fen) {
    this.state = parseFEN(fen);
  };

  UgradChess.prototype.getLegalMoves = function () { return legalMoves(this.state); };

  UgradChess.prototype.applyMove = function (from, to) {
    var lm = legalMoves(this.state);
    var enc = (from << 8) | to;
    var i;
    for (i = 0; i < lm.length; i++) {
      if (lm[i] === enc) {
        this.state.board = applyRaw(this.state.board, from, to);
        this.state.side = -this.state.side;
        return { ok: true };
      }
    }
    return { ok: false, reason: 'illegal' };
  };

  UgradChess.prototype.inCheckmate = function () {
    if (!inCheck(this.state.board, this.state.side)) return false;
    return legalMoves(this.state).length === 0;
  };

  UgradChess.prototype.inStalemate = function () {
    if (inCheck(this.state.board, this.state.side)) return false;
    return legalMoves(this.state).length === 0;
  };

  UgradChess.prototype.toFEN = function () { return toFEN(this.state); };

  UgradChess.prototype.inCheck = function () { return inCheck(this.state.board, this.state.side); };

  global.UgradChess = UgradChess;
  global.UgradChessFEN0 = FEN0;
})(typeof window !== 'undefined' ? window : this);
