/* Memory Glass · bottom search bar: navigate + chat + mesh comms
 * Extends #mg-search-dock (shell chrome in live inject).
 * Commands: bare URL/search · chat: · mesh: · day: · hunt · geo · board · field
 * VER: search-comms-v1
 */
(function () {
  "use strict";
  var VER = "search-comms-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._searchCommsVer === VER) return;
  HP._searchCommsVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "search-comms");
    } catch (e) {}
  }

  var mode = "go"; /* go | chat | mesh */
  var logEl = null;
  var lines = [];
  var MAX = 40;

  function ensureCss() {
    if (document.getElementById("mg-search-comms-css")) return;
    var st = document.createElement("style");
    st.id = "mg-search-comms-css";
    st.textContent = [
      "#mg-search-dock{max-width:min(720px,96vw)!important}",
      "#mg-search-dock.is-open #mg-search{max-height:none!important;flex-wrap:wrap}",
      "#mg-search-modes{display:none;width:100%;gap:4px;padding:0 4px 4px;order:-1}",
      "#mg-search-dock.is-open #mg-search-modes{display:flex}",
      "#mg-search-modes button{appearance:none;cursor:pointer;padding:3px 8px;border-radius:999px;",
      "  font:700 8px/1 system-ui;letter-spacing:0.06em;color:rgba(230,240,255,0.85);",
      "  background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12)}",
      "#mg-search-modes button.on{background:rgba(110,203,255,0.22);border-color:rgba(110,203,255,0.5);",
      "  color:rgba(200,235,255,0.98)}",
      "#mg-search-chatlog{display:none;width:min(640px,92vw);max-height:120px;overflow:auto;",
      "  margin:0 0 4px 0;padding:6px 10px;border-radius:12px;",
      "  background:rgba(10,12,16,0.72);backdrop-filter:blur(20px);",
      "  -webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.14);",
      "  font:500 10px/1.35 system-ui;color:rgba(220,235,250,0.92);",
      "  order:-2}",
      "#mg-search-dock.is-open.chat-open #mg-search-chatlog{display:block}",
      "#mg-search-chatlog .ln{margin:2px 0;opacity:0.92}",
      "#mg-search-chatlog .ln .who{color:rgba(160,210,255,0.95);font-weight:700}",
      "#mg-search-chatlog .ln.sys{opacity:0.55;font-style:italic}",
      "#mg-search .go-chat{background:rgba(110,203,255,0.9)!important;color:rgba(8,12,18,0.95)!important}",
      "#mg-url{caret-color:rgba(110,203,255,0.95)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function pushLine(who, text, sys) {
    lines.push({ who: who, text: String(text || "").slice(0, 400), t: Date.now(), sys: !!sys });
    if (lines.length > MAX) lines.shift();
    paintLog();
  }

  function paintLog() {
    if (!logEl) return;
    logEl.innerHTML = "";
    lines.slice(-16).forEach(function (L) {
      var d = document.createElement("div");
      d.className = "ln" + (L.sys ? " sys" : "");
      if (L.sys) d.textContent = L.text;
      else {
        d.innerHTML =
          '<span class="who">' +
          escapeHtml(L.who) +
          "</span> " +
          escapeHtml(L.text);
      }
      logEl.appendChild(d);
    });
    logEl.scrollTop = logEl.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function seat() {
    try {
      if (window.__mgMesh && window.__mgMesh.seatId) return window.__mgMesh.seatId.slice(0, 8);
    } catch (e) {}
    return "you";
  }

  function nav(url) {
    try {
      if (window.ipc)
        window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
      else location.href = url;
    } catch (e) {
      try {
        location.href = url;
      } catch (e2) {}
    }
  }

  function sendChat(text) {
    text = String(text || "").trim();
    if (!text) return;
    pushLine(seat(), text, false);
    try {
      if (window.__mgCollabDay) {
        if (!window.__mgCollabDay.day()) window.__mgCollabDay.start({ title: "search-bar" });
        window.__mgCollabDay.chat(text);
      }
    } catch (e) {}
    try {
      if (window.__mgMesh && window.__mgMesh.broadcast)
        window.__mgMesh.broadcast("day-chat", { text: text, via: "search-bar" });
    } catch (e2) {}
    log("chat «" + text.slice(0, 40) + "»");
  }

  function sendMeshStatus(text) {
    text = String(text || "").trim() || "status";
    var payload = { text: text, via: "search-bar" };
    try {
      if (window.__mgActivityBoard && window.__mgActivityBoard.report)
        payload.board = window.__mgActivityBoard.report();
    } catch (e) {}
    try {
      if (window.__mgWebgridCalib && window.__mgWebgridCalib.scrapeScore) {
        var sc = window.__mgWebgridCalib.scrapeScore();
        payload.bps = sc.peak ? sc.peak.bps : sc.bps;
      }
    } catch (e2) {}
    try {
      if (window.__mgMesh) window.__mgMesh.broadcast("day-score", payload);
    } catch (e3) {}
    pushLine("mesh", text + " · shared", true);
  }

  function claimHunt(extra) {
    var score = 12;
    var meta = { game: "scavenger", kind: "hunt-claim" };
    try {
      if (window.__mgGeoPattern && window.__mgGeoPattern.stats) {
        var st = window.__mgGeoPattern.stats();
        score += Math.min(40, (st.n || 0) * 0.05 + (st.maxMag || 0) * 3);
        meta.geo = st;
      }
    } catch (e) {}
    try {
      if (window.__mgActivityBoard) {
        var run = window.__mgActivityBoard.submitRun("scavenger", {
          score: score,
          game: "scavenger",
          synopsis:
            "scavenger claim · " +
            (extra || "search-bar") +
            " · score " +
            Math.round(score),
        });
        /* force score if board recomputed from metrics only */
        if (run) score = run.score || score;
      }
    } catch (e2) {}
    try {
      if (window.__mgCollabDay) {
        if (!window.__mgCollabDay.day()) window.__mgCollabDay.start({});
        window.__mgCollabDay.chat("🏆 hunt claim · +" + Math.round(score));
        window.__mgCollabDay.shareScore();
      }
    } catch (e3) {}
    pushLine("sys", "hunt claimed · board+mesh · +" + Math.round(score), true);
    return score;
  }

  /** Parse command from search input */
  function handleSubmit(raw) {
    var s = String(raw || "").trim();
    if (!s) return { ok: false };

    /* explicit prefixes */
    var mChat = /^(chat|say|msg)\s*[:\s]\s*(.+)$/i.exec(s);
    if (mChat || mode === "chat") {
      sendChat(mChat ? mChat[2] : s);
      return { ok: true, kind: "chat" };
    }
    var mMesh = /^(mesh|status)\s*[:\s]\s*(.*)$/i.exec(s);
    if (mMesh || mode === "mesh") {
      sendMeshStatus(mMesh ? mMesh[2] || "ping" : s);
      return { ok: true, kind: "mesh" };
    }
    if (/^(day|collab)\s*$/i.test(s) || /^day\s*:/i.test(s)) {
      try {
        if (window.__mgCollabDay) {
          window.__mgCollabDay.start({});
          window.__mgCollabDay.open();
        }
      } catch (e) {}
      pushLine("sys", "collab day open", true);
      return { ok: true, kind: "day" };
    }
    if (/^(hunt|scavenge|claim)\b/i.test(s)) {
      if (/claim/i.test(s)) claimHunt(s);
      else {
        try {
          if (window.__mgGeoPattern) {
            window.__mgGeoPattern.open();
            window.__mgGeoPattern.hunt();
          }
        } catch (e) {}
        pushLine("sys", "hunt clue ready · type claim when found", true);
      }
      return { ok: true, kind: "hunt" };
    }
    if (/^(geo|quake|usgs)\b/i.test(s)) {
      try {
        if (window.__mgGeoPattern) window.__mgGeoPattern.open();
      } catch (e) {}
      if (/refresh|load/i.test(s)) {
        try {
          window.__mgGeoPattern.load(true);
        } catch (e2) {}
      }
      pushLine("sys", "geo pattern flow", true);
      return { ok: true, kind: "geo" };
    }
    if (/^(board|rank|leader|mini\s*lb|miniboard)\b/i.test(s)) {
      try {
        if (window.__mgActivityBoard) {
          window.__mgActivityBoard.open();
          if (/mini/i.test(s)) {
            var b = document.getElementById("mg-board-lane-mini");
            if (b) b.click();
          }
        }
      } catch (e) {}
      return { ok: true, kind: "board" };
    }
    if (/^(field|sports)\b/i.test(s)) {
      try {
        if (window.__mgSportsField) window.__mgSportsField.open();
      } catch (e) {}
      return { ok: true, kind: "field" };
    }
    if (/^(maze|bloch|rubik|beats|floats)\b/i.test(s)) {
      var cmd = s.toLowerCase();
      try {
        if (cmd.indexOf("maze") === 0 && window.__mgMemoryMaze) window.__mgMemoryMaze.open();
        if (cmd.indexOf("bloch") === 0 && window.__mgBlochSolve) {
          window.__mgBlochSolve.setEnabled(true);
          if (window.__mgBlochSolve.open) window.__mgBlochSolve.open();
        }
        if (cmd.indexOf("rubik") === 0 && window.__mgRubikLang) window.__mgRubikLang.open();
        if (cmd.indexOf("beats") === 0 && window.__mgKeyboardBeats)
          window.__mgKeyboardBeats.open();
        if (cmd.indexOf("floats") === 0) {
          ["__mgMemoryMaze", "__mgBlochSolve", "__mgRubikLang", "__mgKeyboardBeats", "__mgActivityBoard", "__mgGeoPattern", "__mgSportsField"].forEach(
            function (k) {
              try {
                var A = window[k];
                if (A && A.open) A.open();
                if (A && A.setEnabled) A.setEnabled(true);
              } catch (e) {}
            }
          );
        }
      } catch (eF) {}
      pushLine("sys", "opened " + s, true);
      return { ok: true, kind: "tool" };
    }
    if (/^(grok|brief)\b/i.test(s)) {
      try {
        if (window.__mgCollabDay) {
          if (!window.__mgCollabDay.day()) window.__mgCollabDay.start({});
          window.__mgCollabDay.exportGrokBrief();
        }
      } catch (e) {}
      pushLine("sys", "Grok brief → clipboard", true);
      return { ok: true, kind: "grok" };
    }
    if (/^x\s*draft\b/i.test(s) || /^xdraft\b/i.test(s)) {
      try {
        if (window.__mgCollabDay && window.__mgCollabDay.day && window.__mgCollabDay.day())
          window.__mgCollabDay.exportXDraft();
        else if (window.__mgSessionRec) window.__mgSessionRec.exportXDraft();
      } catch (e) {}
      pushLine("sys", "X draft ready · you post", true);
      return { ok: true, kind: "x" };
    }
    if (/^help\b/i.test(s) || s === "?") {
      pushLine(
        "sys",
        "go URL · chat: hi · mesh: status · day · hunt · claim · geo · board · field · maze · floats · grok · x draft",
        true
      );
      setMode("chat");
      return { ok: true, kind: "help" };
    }

    /* default navigate */
    var url = s;
    if (!/^https?:\/\//i.test(url)) {
      if (/^[\w.-]+\.[a-z]{2,}/i.test(url) && !/\s/.test(url)) url = "https://" + url;
      else if (url.charAt(0) === "@")
        url = "https://x.com/" + url.slice(1);
      else url = "https://www.google.com/search?q=" + encodeURIComponent(url);
    }
    nav(url);
    pushLine("sys", "→ " + url.slice(0, 60), true);
    return { ok: true, kind: "go", url: url };
  }

  function setMode(m) {
    mode = m || "go";
    var dock = document.getElementById("mg-search-dock");
    if (dock) {
      dock.classList.toggle("chat-open", mode === "chat" || mode === "mesh" || lines.length > 0);
    }
    document.querySelectorAll("#mg-search-modes button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-mode") === mode);
    });
    var go = document.querySelector("#mg-search .go");
    var inp = document.getElementById("mg-url");
    if (go) {
      go.textContent = mode === "chat" ? "Send" : mode === "mesh" ? "Share" : "Go";
      go.classList.toggle("go-chat", mode !== "go");
    }
    if (inp) {
      inp.placeholder =
        mode === "chat"
          ? "chat: message seats…"
          : mode === "mesh"
            ? "mesh: status / score note…"
            : "Search · URL · chat: · hunt · geo · help";
    }
  }

  function enhance() {
    var dock = document.getElementById("mg-search-dock");
    var bar = document.getElementById("mg-search");
    var form = document.getElementById("mg-form");
    var inp = document.getElementById("mg-url");
    if (!dock || !bar || !form || !inp) return false;
    if (dock.getAttribute("data-comms") === "1") return true;
    dock.setAttribute("data-comms", "1");
    ensureCss();

    logEl = document.createElement("div");
    logEl.id = "mg-search-chatlog";
    logEl.setAttribute("aria-live", "polite");
    dock.insertBefore(logEl, dock.firstChild);

    var modes = document.createElement("div");
    modes.id = "mg-search-modes";
    [
      ["go", "GO"],
      ["chat", "CHAT"],
      ["mesh", "MESH"],
    ].forEach(function (pair) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-mode", pair[0]);
      b.textContent = pair[1];
      if (pair[0] === "go") b.className = "on";
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        setMode(pair[0]);
        dock.classList.add("is-open");
        try {
          inp.focus();
        } catch (e) {}
      };
      modes.appendChild(b);
    });
    bar.insertBefore(modes, bar.firstChild);

    /* Wrap submit: capture before shell navigate when command */
    form.addEventListener(
      "submit",
      function (e) {
        var s = String(inp.value || "").trim();
        if (!s) return;
        var isCmd =
          mode !== "go" ||
          /^(chat|say|msg|mesh|status|day|hunt|claim|geo|quake|board|field|maze|bloch|rubik|beats|floats|grok|x\s*draft|help|\?)\b/i.test(
            s
          ) ||
          /^(chat|mesh)\s*:/i.test(s);
        if (!isCmd && mode === "go") return; /* let native handler navigate */
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleSubmit(s);
        if (mode === "chat" || mode === "mesh") inp.value = "";
        dock.classList.add("chat-open");
        dock.classList.add("is-open");
      },
      true
    );

    /* Listen mesh chat into log */
    try {
      var ch = new BroadcastChannel("mg-mesh");
      ch.onmessage = function (ev) {
        var d = ev.data;
        if (!d || d.id === (window.__mgMesh && window.__mgMesh.seatId)) return;
        if (d.t === "day-chat" && d.payload && d.payload.text) {
          pushLine(String(d.id || "peer").slice(0, 8), d.payload.text, false);
          dock.classList.add("chat-open");
        }
      };
    } catch (eCh) {}

    setMode("go");
    pushLine("sys", "comms ready · chat: · mesh: · hunt · geo · help", true);
    log(VER + " · search bar chat/mesh");
    return true;
  }

  var tries = 0;
  function boot() {
    if (enhance()) return;
    tries++;
    if (tries < 40) setTimeout(boot, 250);
  }
  setTimeout(boot, 200);
  setTimeout(boot, 1200);

  window.__mgSearchComms = {
    ver: VER,
    sendChat: sendChat,
    sendMesh: sendMeshStatus,
    claimHunt: claimHunt,
    handle: handleSubmit,
    setMode: setMode,
    report: function () {
      return VER + " mode=" + mode + " lines=" + lines.length;
    },
  };
})();
