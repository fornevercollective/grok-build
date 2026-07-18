/**
 * ugrad-game-registry.js — μgrad arena index for hub / uterm / iron-line hooks.
 * Load in browser: exposes window.UgradGameRegistry
 */
(function (global) {
  'use strict';

  /** @type {Array<{id:string,file:string,title:string,lane?:string,channels:string[],tensor?:boolean,cli?:boolean}>} */
  var GAMES = [
    { id: 'go', file: 'go-ugrad.html', title: 'Go 19×19 lab', lane: 'strategy', channels: ['ugrad-go-board', 'ugrad-tensor-lane', 'ugrad-tensor-train'], tensor: true, cli: true },
    { id: 'gomoku', file: 'gomoku-ugrad.html', title: 'Gomoku lab (go-parity shell)', lane: 'strategy', channels: ['quantum-prefixes', 'iron-line', 'ugrad-tensor-lane'], tensor: true, cli: true },
    { id: 'arena', file: 'arena-ugrad.html', title: 'Arena catalog', lane: 'meta', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'sportsfield', file: 'sports-field-ugrad.html', title: 'Sports field · pitch grid', lane: 'arcade', channels: ['hexcast-stream', 'kbatch-transcript', 'quantum-prefixes'], tensor: false, cli: true },
    { id: 'snake', file: 'snake-ugrad.html', title: 'Snake arcade', lane: 'arcade', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'mancala', file: 'mancala-ugrad.html', title: 'Mancala lab', lane: 'strategy', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'backgammon', file: 'backgammon-ugrad.html', title: 'Backgammon lab', lane: 'strategy', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'battleship', file: 'battleship-ugrad.html', title: 'Battleship lab', lane: 'strategy', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'hanafuda', file: 'hanafuda-ugrad.html', title: 'Hanafuda lab', lane: 'cards', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'kobenhavn', file: 'kobenhavn-ugrad.html', title: 'København lab', lane: 'strategy', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'hub', file: 'games-ugrad-hub.html', title: 'μgrad games hub', lane: 'meta', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'terminal-install', file: 'games-ugrad-terminal.html', title: 'Terminal install · ugrad-cli', lane: 'meta', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'webgrid', file: 'webgrid-ugrad.html', title: 'WebGrid · Neuralink BPS + μgrad tensor', lane: 'strategy', channels: ['quantum-prefixes', 'ugrad-tensor-lane', 'ugrad-tensor-train'], tensor: true, cli: true },
    { id: 'chess', file: 'chess-ugrad.html', title: 'Chess 8×8', lane: 'strategy', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'checkers', file: 'checkers-ugrad.html', title: 'Checkers', lane: 'strategy', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'pong', file: 'pong-ugrad.html', title: 'Pong', lane: 'arcade', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'cards', file: 'cards-ugrad.html', title: 'Cards / deck', lane: 'cards', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'blackjack', file: 'blackjack-ugrad.html', title: 'Blackjack', lane: 'cards', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'tarot', file: 'tarot-ugrad.html', title: 'Tarot', lane: 'cards', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'mahjong', file: 'mahjong-ugrad.html', title: 'Mahjong', lane: 'strategy', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'iching', file: 'iching-ugrad.html', title: 'I Ching', lane: 'cards', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'cartomancy', file: 'cartomancy-ugrad.html', title: 'Cartomancy', lane: 'cards', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'rubiks', file: 'rubiks-ugrad.html', title: "Rubik's", lane: 'arcade', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'cupstack', file: 'cupstack-ugrad.html', title: 'Cup stack', lane: 'arcade', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'memory', file: 'memory-ugrad.html', title: 'Memory', lane: 'training', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'flashcards', file: 'flashcards-ugrad.html', title: 'Flashcards', lane: 'training', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'mindmaze', file: 'mindmaze-ugrad.html', title: 'Mindmaze', lane: 'training', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'math', file: 'math-ugrad.html', title: 'Math drills', lane: 'training', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'language', file: 'language-ugrad.html', title: 'Language', lane: 'training', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'typing', file: 'typing-ugrad.html', title: 'Typing', lane: 'training', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'calligraphy', file: 'calligraphy-ugrad.html', title: 'Calligraphy', lane: 'training', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'robotics', file: 'robotics-ugrad.html', title: 'Robotics lab', lane: 'training', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'dexterity', file: 'dexterity-ugrad.html', title: 'Dexterity', lane: 'arcade', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'visualspeed', file: 'visualspeed-ugrad.html', title: 'Visual speed', lane: 'arcade', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'r0', file: 'ugrad-r0.html', title: 'μgrad R0 terminal', lane: 'core', channels: ['ugrad-training', 'quantum-prefixes', 'hexterm'], tensor: true, cli: true },
    { id: 'pad', file: 'ugrad-pad-lab.html', title: 'μPad lab', lane: 'core', channels: ['quantum-prefixes'], tensor: true, cli: true },
    { id: 'model', file: 'ugrad-model-lab.html', title: 'Model lab', lane: 'core', channels: ['quantum-prefixes'], tensor: true, cli: true },
    { id: 'go-monitor', file: 'go-ugrad-monitor.html', title: 'Go multi-monitor', lane: 'meta', channels: ['ugrad-go-board'], tensor: false, cli: true },
    { id: 'hub-monitor', file: 'hub-ugrad-monitor.html', title: 'Monitor index', lane: 'meta', channels: [], tensor: false, cli: true },
    { id: 'contrail', file: 'ugrad-contrail.html', title: 'Contrail lab', lane: 'core', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'contrail-raw', file: 'ugrad-contrail-raw.html', title: 'Contrail raw', lane: 'core', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'chat-stable', file: 'ugrad-chat-stable.html', title: 'Chat (stable)', lane: 'core', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'scout-chat', file: 'ugrad-scout-chat.html', title: 'Scout chat', lane: 'core', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'photonic', file: 'ugrad-photonic-park.html', title: 'Photonic park', lane: 'core', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'quantum', file: 'ugrad-quantum.html', title: 'Quantum shell', lane: 'core', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'prompt-tester', file: 'ugrad-prompt-tester.html', title: 'Prompt tester', lane: 'core', channels: ['quantum-prefixes'], tensor: false, cli: true },
    { id: 'sentence', file: 'ugrad-sentence.html', title: 'Sentence lab', lane: 'core', channels: ['quantum-prefixes'], tensor: false, cli: true }
  ];

  var CLI_CH = 'ugrad-cli';

  function normalizeKey(s) {
    return String(s || '')
      .trim()
      .toLowerCase()
      .replace(/\.html$/i, '');
  }

  function find(query) {
    var q = normalizeKey(query);
    if (!q) return null;
    var i, g;
    for (i = 0; i < GAMES.length; i++) {
      g = GAMES[i];
      if (g.id === q || normalizeKey(g.file) === q || normalizeKey(g.file).replace(/-ugrad$/, '') === q) return g;
    }
    for (i = 0; i < GAMES.length; i++) {
      g = GAMES[i];
      if (normalizeKey(g.file).indexOf(q) >= 0 || g.id.indexOf(q) === 0) return g;
    }
    return null;
  }

  function emitCliMessage(msg) {
    try {
      if (typeof BroadcastChannel === 'undefined') return;
      var ch = new BroadcastChannel(CLI_CH);
      ch.postMessage(msg);
      ch.close();
    } catch (e) {}
  }

  function openGame(query, opts) {
    var g = find(query);
    if (!g) return { ok: false, error: 'unknown game: ' + query };
    var o = opts || {};
    emitCliMessage({
      type: 'open-game',
      id: g.id,
      file: g.file,
      title: g.title,
      source: o.source || 'ugrad-game-registry',
      ts: Date.now()
    });
    if (o.sameTab && global.location) {
      global.location.href = g.file;
    } else {
      global.open(g.file, o.target || '_blank', 'noopener,noreferrer');
    }
    return { ok: true, game: g };
  }

  function trainTensor(env, steps) {
    try {
      if (typeof BroadcastChannel === 'undefined') return false;
      var ch = new BroadcastChannel('ugrad-tensor-train');
      ch.postMessage({ type: 'train', env: env || 'go-board', steps: steps || 80, source: 'ugrad-game-registry' });
      ch.close();
      return true;
    } catch (e2) {
      return false;
    }
  }

  function trainUgrad(dataset) {
    try {
      if (typeof BroadcastChannel === 'undefined') return false;
      var ch = new BroadcastChannel('ugrad-training');
      ch.postMessage({ type: 'train', dataset: dataset || 'xor', source: 'ugrad-game-registry' });
      ch.close();
      return true;
    } catch (e3) {
      return false;
    }
  }

  global.UgradGameRegistry = {
    GAMES: GAMES,
    CLI_CHANNEL: CLI_CH,
    find: find,
    open: openGame,
    trainTensor: trainTensor,
    trainUgrad: trainUgrad,
    emitCli: emitCliMessage
  };
})(typeof window !== 'undefined' ? window : globalThis);
