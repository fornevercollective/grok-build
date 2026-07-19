/* Memory Glass · bottom search bar: GO · CHAT · MESH
 * Extends #mg-search-dock (shell chrome). Modes always visible when dock open.
 * Commands: URL/search · chat: · mesh: · day · hunt · geo · board · field · help
 * VER: search-comms-v5-quiet-boot
 */
(function () {
  "use strict";
  var VER = "search-comms-v5-quiet-boot";
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
  var enhanced = false;

  function ensureCss() {
    var old = document.getElementById("mg-search-comms-css");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "mg-search-comms-css";
    st.textContent = [
      /* Docked bottom-center — never mid-viewport float */
      "#mg-search-dock{",
      "  position:fixed!important;left:50%!important;right:auto!important;top:auto!important;",
      "  transform:translateX(-50%)!important;",
      "  --mg-search-bottom:max(12px, calc(10px + var(--mg-kb-h,0px)))!important;",
      "  bottom:calc(var(--mg-search-bottom) + env(safe-area-inset-bottom,0px))!important;",
      "  max-width:min(760px,96vw)!important;z-index:2147483608!important}",
      /* Open bar: room for modes + optional chat log (grow upward) */
      "#mg-search-dock.is-open #mg-search{",
      "  max-height:none!important;overflow:visible!important;",
      "  flex-wrap:wrap!important;align-items:center!important;",
      "  width:min(720px,94vw)!important;border-radius:18px!important;",
      "  padding:8px 10px!important}",
      /* GO · CHAT · MESH always in the open bar (inline, not clipped) */
      "#mg-search-modes{",
      "  display:none;flex:0 0 auto;gap:4px;align-items:center;",
      "  order:0;width:auto;padding:0;margin:0 2px 0 0}",
      "#mg-search-dock.is-open #mg-search-modes{display:flex!important}",
      "#mg-search-modes button{",
      "  appearance:none;cursor:pointer;padding:7px 10px;border-radius:999px;",
      "  font:700 9px/1 system-ui;letter-spacing:0.08em;text-transform:uppercase;",
      "  color:rgba(230,240,255,0.85);min-height:32px;",
      "  background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14)}",
      "#mg-search-modes button:hover{background:rgba(255,255,255,0.14);color:#fff}",
      "#mg-search-modes button.on{",
      "  background:rgba(110,203,255,0.28);border-color:rgba(110,203,255,0.55);",
      "  color:rgba(210,240,255,0.98);box-shadow:0 0 0 1px rgba(110,203,255,0.15)}",
      "#mg-search-modes button[data-mode=chat].on{",
      "  background:rgba(120,220,160,0.25);border-color:rgba(120,230,160,0.5);",
      "  color:rgba(180,255,210,0.98)}",
      "#mg-search-modes button[data-mode=mesh].on{",
      "  background:rgba(180,140,255,0.25);border-color:rgba(180,140,255,0.5);",
      "  color:rgba(220,200,255,0.98)}",
      /* Chat transcript above the bar */
      "#mg-search-chatlog{",
      "  display:none;width:min(720px,94vw);max-height:min(28vh,160px);overflow:auto;",
      "  margin:0 0 6px 0;padding:8px 12px;border-radius:14px;",
      "  background:rgba(10,12,16,0.78);backdrop-filter:blur(22px) saturate(1.35);",
      "  -webkit-backdrop-filter:blur(22px) saturate(1.35);",
      "  border:1px solid rgba(255,255,255,0.16);",
      "  font:500 11px/1.4 system-ui;color:rgba(220,235,250,0.94);",
      "  box-shadow:0 8px 24px rgba(0,0,0,0.22);order:-2}",
      "#mg-search-dock.is-open.chat-open #mg-search-chatlog{display:block}",
      "#mg-search-chatlog .ln{margin:3px 0;opacity:0.94}",
      "#mg-search-chatlog .ln .who{color:rgba(160,210,255,0.95);font-weight:700;margin-right:4px}",
      "#mg-search-chatlog .ln.sys{opacity:0.6;font-style:italic;font-size:10px}",
      "#mg-search-chatlog .ln.mesh .who{color:rgba(190,160,255,0.95)}",
      "#mg-search .go-chat{",
      "  background:rgba(110,203,255,0.92)!important;color:rgba(8,12,18,0.95)!important;",
      "  border-color:rgba(110,203,255,0.5)!important}",
      "#mg-search .go-mesh{",
      "  background:rgba(160,120,255,0.9)!important;color:rgba(8,12,18,0.95)!important}",
      "#mg-url{caret-color:rgba(110,203,255,0.95)}",
      /* Mesh peer badge on MESH button */
      "#mg-search-modes .mesh-n{",
      "  display:inline-block;min-width:14px;margin-left:4px;padding:1px 5px;",
      "  border-radius:999px;font:700 8px/1.2 ui-monospace,Menlo,monospace;",
      "  background:rgba(0,0,0,0.35);color:rgba(220,200,255,0.95)}",
      /* Keep tabs above search when both present */
      "html.mg-webgrid-play #mg-tabs{",
      "  bottom:calc(var(--mg-tabs-bottom, 58px) + var(--mg-kb-h, 0px))!important}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function pushLine(who, text, sys, kind) {
    lines.push({
      who: who,
      text: String(text || "").slice(0, 400),
      t: Date.now(),
      sys: !!sys,
      kind: kind || (sys ? "sys" : "chat"),
    });
    if (lines.length > MAX) lines.shift();
    paintLog();
  }

  function paintLog() {
    if (!logEl) return;
    logEl.innerHTML = "";
    lines.slice(-18).forEach(function (L) {
      var d = document.createElement("div");
      d.className = "ln" + (L.sys ? " sys" : "") + (L.kind === "mesh" ? " mesh" : "");
      if (L.sys) d.textContent = L.text;
      else {
        d.innerHTML =
          '<span class="who">' +
          escapeHtml(L.who) +
          "</span>" +
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
      if (window.__mgMesh && window.__mgMesh.seatId)
        return String(window.__mgMesh.seatId).slice(0, 8);
    } catch (e) {}
    return "you";
  }

  function peerN() {
    try {
      if (window.__mgMesh && window.__mgMesh.peerCount) return window.__mgMesh.peerCount();
    } catch (e) {}
    return 0;
  }

  function paintMeshBadge() {
    var b = document.querySelector('#mg-search-modes button[data-mode="mesh"]');
    if (!b) return;
    var n = peerN();
    b.innerHTML = "MESH" + (n ? '<span class="mesh-n">' + n + "</span>" : "");
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

  function keepDockOpen() {
    var dock = document.getElementById("mg-search-dock");
    if (dock) {
      dock.classList.add("is-open");
      if (mode === "chat" || mode === "mesh" || lines.length > 1)
        dock.classList.add("chat-open");
      try {
        window.__mgUserChromeTouch = true;
      } catch (eU) {}
    }
  }

  function sendChat(text) {
    text = String(text || "").trim();
    if (!text) return;
    pushLine(seat(), text, false, "chat");
    try {
      if (window.__mgCollabDay) {
        if (!window.__mgCollabDay.day())
          window.__mgCollabDay.start({ title: "search-bar" });
        window.__mgCollabDay.chat(text);
      }
    } catch (e) {}
    try {
      if (window.__mgMesh && window.__mgMesh.broadcast)
        window.__mgMesh.broadcast("day-chat", { text: text, via: "search-bar" });
    } catch (e2) {}
    keepDockOpen();
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
      if (window.__mgMesh) {
        if (text === "status" || text === "ping") {
          payload.report = window.__mgMesh.report();
          payload.peers = window.__mgMesh.peerCount();
        }
        window.__mgMesh.broadcast(
          text === "status" || text === "ping" ? "presence" : "day-score",
          payload
        );
      }
    } catch (e3) {}
    var note =
      text +
      " · " +
      (window.__mgMesh && window.__mgMesh.report
        ? window.__mgMesh.report()
        : "mesh off");
    pushLine("mesh", note, true, "mesh");
    paintMeshBadge();
    keepDockOpen();
  }

  function claimHunt(extra) {
    var score = 12;
    try {
      if (window.__mgGeoPattern && window.__mgGeoPattern.stats) {
        var st = window.__mgGeoPattern.stats();
        score += Math.min(40, (st.n || 0) * 0.05 + (st.maxMag || 0) * 3);
      }
    } catch (e) {}
    try {
      if (window.__mgActivityBoard) {
        window.__mgActivityBoard.submitRun("scavenger", {
          score: score,
          game: "scavenger",
          synopsis: "scavenger claim · " + (extra || "search-bar"),
        });
      }
    } catch (e2) {}
    try {
      if (window.__mgCollabDay) {
        if (!window.__mgCollabDay.day()) window.__mgCollabDay.start({});
        window.__mgCollabDay.chat("🏆 hunt claim · +" + Math.round(score));
        if (window.__mgCollabDay.shareScore) window.__mgCollabDay.shareScore();
      }
    } catch (e3) {}
    pushLine("sys", "hunt claimed · +" + Math.round(score), true);
    return score;
  }

  function handleSubmit(raw) {
    var s = String(raw || "").trim();
    if (!s) return { ok: false };

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
      keepDockOpen();
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
        pushLine("sys", "hunt clue · type claim when found", true);
      }
      keepDockOpen();
      return { ok: true, kind: "hunt" };
    }
    if (/^(geo|quake|usgs)\b/i.test(s)) {
      try {
        if (window.__mgGeoPattern) window.__mgGeoPattern.open();
      } catch (e) {}
      pushLine("sys", "geo pattern open", true);
      return { ok: true, kind: "geo" };
    }
    if (/^(board|rank|leader)\b/i.test(s)) {
      try {
        if (window.__mgActivityBoard)
          window.__mgActivityBoard.open({ collapsed: true });
      } catch (e) {}
      return { ok: true, kind: "board" };
    }
    if (/^(field|sports)\b/i.test(s)) {
      try {
        if (window.__mgSportsField) window.__mgSportsField.open();
      } catch (e) {}
      return { ok: true, kind: "field" };
    }
    if (/^(maze|bloch|rubik|beats|raider|floats)\b/i.test(s)) {
      var cmd = s.toLowerCase();
      try {
        if (cmd.indexOf("maze") === 0 && window.__mgMemoryMaze)
          window.__mgMemoryMaze.open();
        if (cmd.indexOf("bloch") === 0 && window.__mgBlochSolve) {
          window.__mgBlochSolve.setEnabled(true);
          if (window.__mgBlochSolve.open) window.__mgBlochSolve.open();
        }
        if (cmd.indexOf("rubik") === 0 && window.__mgRubikLang)
          window.__mgRubikLang.open();
        if (cmd.indexOf("beats") === 0 && window.__mgKeyboardBeats)
          window.__mgKeyboardBeats.open();
        if (cmd.indexOf("raider") === 0 && window.__mgRaider)
          window.__mgRaider.open();
        if (cmd.indexOf("floats") === 0 && window.__mgFloatLayout)
          window.__mgFloatLayout.openLabKit();
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
        "GO url · CHAT · MESH · atlas · day · hunt · board · field · maze · floats · help",
        true
      );
      setMode("chat");
      keepDockOpen();
      return { ok: true, kind: "help" };
    }
    if (/^(atlas|sitemap|files|site.?map)\b/i.test(s)) {
      try {
        if (window.__mgSiteAtlas) {
          window.__mgSiteAtlas.scan();
          window.__mgSiteAtlas.open();
          pushLine("sys", window.__mgSiteAtlas.report(), true);
        } else pushLine("sys", "site-atlas not loaded · ⌘⇧R", true);
      } catch (eA) {
        pushLine("sys", "atlas fail", true);
      }
      return { ok: true, kind: "atlas" };
    }

    /* GO mode → navigate */
    var url = s;
    if (!/^https?:\/\//i.test(url)) {
      if (/^[\w.-]+\.[a-z]{2,}/i.test(url) && !/\s/.test(url)) url = "https://" + url;
      else if (url.charAt(0) === "@") url = "https://x.com/" + url.slice(1);
      else url = "https://www.google.com/search?q=" + encodeURIComponent(url);
    }
    nav(url);
    pushLine("sys", "→ " + url.slice(0, 64), true);
    return { ok: true, kind: "go", url: url };
  }

  function setMode(m) {
    mode = m || "go";
    var dock = document.getElementById("mg-search-dock");
    if (dock) {
      dock.classList.add("is-open");
      dock.classList.toggle(
        "chat-open",
        mode === "chat" || mode === "mesh" || lines.length > 1
      );
    }
    document.querySelectorAll("#mg-search-modes button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-mode") === mode);
    });
    paintMeshBadge();
    var go = document.querySelector("#mg-search .go");
    var inp = document.getElementById("mg-url");
    if (go) {
      go.textContent = mode === "chat" ? "Send" : mode === "mesh" ? "Share" : "Go";
      go.classList.toggle("go-chat", mode === "chat");
      go.classList.toggle("go-mesh", mode === "mesh");
    }
    if (inp) {
      inp.placeholder =
        mode === "chat"
          ? "Message mesh seats…"
          : mode === "mesh"
            ? "mesh status · score note · ping"
            : "Search · URL · or type help";
      try {
        inp.focus();
      } catch (e) {}
    }
  }

  function enhance() {
    var dock = document.getElementById("mg-search-dock");
    var bar = document.getElementById("mg-search");
    var form = document.getElementById("mg-form");
    var inp = document.getElementById("mg-url");
    if (!dock || !bar || !form || !inp) return false;
    if (dock.getAttribute("data-comms") === "2") {
      enhanced = true;
      return true;
    }
    /* re-enhance if old v1 */
    dock.setAttribute("data-comms", "2");
    ensureCss();

    /* chat log */
    logEl = document.getElementById("mg-search-chatlog");
    if (!logEl) {
      logEl = document.createElement("div");
      logEl.id = "mg-search-chatlog";
      logEl.setAttribute("aria-live", "polite");
      dock.insertBefore(logEl, dock.firstChild);
    }

    /* modes GO · CHAT · MESH — inline at start of bar */
    var modes = document.getElementById("mg-search-modes");
    if (modes && modes.parentNode) modes.parentNode.removeChild(modes);
    modes = document.createElement("div");
    modes.id = "mg-search-modes";
    modes.setAttribute("role", "tablist");
    modes.setAttribute("aria-label", "Go chat mesh");
    [
      ["go", "GO"],
      ["chat", "CHAT"],
      ["mesh", "MESH"],
    ].forEach(function (pair) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-mode", pair[0]);
      b.setAttribute("role", "tab");
      b.textContent = pair[1];
      if (pair[0] === "go") b.className = "on";
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        setMode(pair[0]);
        keepDockOpen();
      };
      modes.appendChild(b);
    });
    bar.insertBefore(modes, bar.firstChild);

    /* Capture submit before shell navigate */
    if (!form.__mgCommsBound) {
      form.__mgCommsBound = true;
      form.addEventListener(
        "submit",
        function (e) {
          var s = String(inp.value || "").trim();
          if (!s) return;
          var isCmd =
            mode !== "go" ||
            /^(chat|say|msg|mesh|status|day|hunt|claim|geo|quake|board|field|maze|bloch|rubik|beats|raider|floats|grok|x\s*draft|help|\?)\b/i.test(
              s
            ) ||
            /^(chat|mesh)\s*:/i.test(s);
          if (!isCmd && mode === "go") {
            /* still record go in log, let shell navigate OR we navigate */
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          handleSubmit(s);
          if (mode === "chat" || mode === "mesh") inp.value = "";
          keepDockOpen();
        },
        true
      );
    }

    /* Mesh inbound chat */
    try {
      if (!window.__mgSearchCommsMeshHooked) {
        window.__mgSearchCommsMeshHooked = true;
        var ch = new BroadcastChannel("mg-mesh");
        ch.onmessage = function (ev) {
          var d = ev.data;
          if (!d) return;
          var my =
            window.__mgMesh && window.__mgMesh.seatId
              ? window.__mgMesh.seatId
              : null;
          if (my && d.id === my) return;
          if (d.t === "day-chat" && d.payload && d.payload.text) {
            pushLine(String(d.id || "peer").slice(0, 8), d.payload.text, false, "chat");
            keepDockOpen();
          } else if (d.t === "day-score" || d.t === "presence") {
            paintMeshBadge();
          }
        };
      }
    } catch (eCh) {}

    /* Keep dock open while interacting (pointer / focus / mode switches) */
    try {
      dock.addEventListener(
        "pointerdown",
        function () {
          keepDockOpen();
        },
        true
      );
      dock.addEventListener(
        "focusin",
        function () {
          keepDockOpen();
        },
        true
      );
      /* Re-assert open while in chat/mesh so shell timeout can't steal the bar */
      setInterval(function () {
        if (mode === "chat" || mode === "mesh") {
          var d = document.getElementById("mg-search-dock");
          if (d && !d.classList.contains("is-open")) d.classList.add("is-open");
          if (d) d.classList.add("chat-open");
        }
      }, 1200);
    } catch (eF) {}

    setMode("go");
    /* No boot footer banner — keep the bar quiet until the user types. */
    paintMeshBadge();
    setInterval(paintMeshBadge, 4000);
    enhanced = true;
    log(VER + " · GO/CHAT/MESH bar fixed");
    return true;
  }

  var tries = 0;
  function boot() {
    if (enhance()) return;
    tries++;
    if (tries < 50) setTimeout(boot, 250);
  }
  setTimeout(boot, 150);
  setTimeout(boot, 800);
  setTimeout(boot, 2000);

  window.__mgSearchComms = {
    ver: VER,
    sendChat: sendChat,
    sendMesh: sendMeshStatus,
    claimHunt: claimHunt,
    handle: handleSubmit,
    setMode: setMode,
    open: function () {
      keepDockOpen();
      setMode(mode);
    },
    report: function () {
      return (
        VER +
        " mode=" +
        mode +
        " lines=" +
        lines.length +
        " peers=" +
        peerN() +
        (enhanced ? " on" : " wait")
      );
    },
  };
})();
