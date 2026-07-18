/* Memory Glass · SOLVE shell word (Inspect / PAGE language)
 * Collapsed: single flat top-chrome word — never a mega center pill of modules.
 * Expanded (click): compact glass tray with live metrics. Tools live in TOOLS drawer.
 * VER: live-solve-hud-v3-shell-word
 */
(function () {
  "use strict";
  var VER = "live-solve-hud-v3-shell-word";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._liveSolveHudVer === VER) return;
  HP._liveSolveHudVer = VER;
  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var el = null;
  var tray = null;
  var open = false;

  function ensureCss() {
    var old = document.getElementById("mg-solve-hud-css");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "mg-solve-hud-css";
    st.textContent = [
      /* ── collapsed = shell top word (match INSPECT / PAGE / LIVE) ── */
      "#mg-solve-hud{",
      "  position:fixed!important;",
      "  top:var(--mg-shell-top,2px)!important;",
      "  left:max(96px, calc(12px + var(--mg-tools-tab-w, 36px)))!important;",
      "  right:auto!important;transform:none!important;",
      "  z-index:2147483002;",
      "  max-width:none!important;width:auto!important;",
      "  min-height:28px;padding:var(--mg-hdr-pad-y,6px) 2px!important;margin:0;",
      "  border-radius:0!important;",
      "  background:transparent!important;border:none!important;box-shadow:none!important;",
      "  backdrop-filter:none!important;-webkit-backdrop-filter:none!important;",
      "  font:600 var(--mg-hdr-fs,11px)/1 system-ui,sans-serif!important;",
      "  letter-spacing:var(--mg-hdr-ls,0.22em)!important;text-transform:uppercase!important;",
      "  color:rgba(255,255,255,0.9)!important;",
      "  text-shadow:0 1px 2px rgba(0,0,0,0.4);",
      "  pointer-events:auto;cursor:pointer;white-space:nowrap;",
      "  overflow:visible!important;text-overflow:clip!important;",
      "  opacity:0.92;display:inline-flex!important;align-items:center;gap:8px}",
      "#mg-solve-hud:hover{opacity:1;color:#fff!important;",
      "  text-shadow:0 0 14px rgba(255,255,255,0.45)}",
      "#mg-solve-hud .dot{opacity:0.55;letter-spacing:0;margin-right:2px}",
      "#mg-solve-hud .sum{",
      "  font:600 10px/1 ui-monospace,Menlo,monospace!important;",
      "  letter-spacing:0.06em!important;text-transform:none!important;",
      "  color:rgba(255,255,255,0.65)!important;max-width:min(28vw,180px);",
      "  overflow:hidden;text-overflow:ellipsis}",
      "#mg-solve-hud.open{opacity:1}",
      /* ── expanded detail tray under the word ── */
      "#mg-solve-tray{",
      "  position:fixed;z-index:2147483003;",
      "  top:calc(var(--mg-shell-top,2px) + 30px);",
      "  left:max(96px, calc(12px + var(--mg-tools-tab-w, 36px)));",
      "  width:min(320px,86vw);",
      "  padding:10px 12px 12px;border-radius:16px;",
      "  background:rgba(40,40,44,0.55);",
      "  backdrop-filter:blur(40px) saturate(1.7);-webkit-backdrop-filter:blur(40px) saturate(1.7);",
      "  border:1px solid rgba(255,255,255,0.12);",
      "  box-shadow:0 14px 36px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.12);",
      "  font:500 11px/1.35 system-ui,sans-serif;color:rgba(244,246,250,0.94);",
      "  pointer-events:auto}",
      "#mg-solve-tray.hidden{display:none!important}",
      "#mg-solve-tray .row{",
      "  display:flex;justify-content:space-between;gap:10px;",
      "  padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.06)}",
      "#mg-solve-tray .row:last-child{border-bottom:0}",
      "#mg-solve-tray .k{",
      "  font:700 10px/1 system-ui;letter-spacing:0.1em;text-transform:uppercase;",
      "  color:rgba(160,210,255,0.9);flex-shrink:0}",
      "#mg-solve-tray .v{",
      "  font:500 11px/1.25 ui-monospace,Menlo,monospace;",
      "  color:rgba(230,240,250,0.88);text-align:right;",
      "  overflow:hidden;text-overflow:ellipsis;max-width:70%}",
      "#mg-solve-tray .ft{",
      "  margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);",
      "  display:flex;gap:6px;flex-wrap:wrap}",
      "#mg-solve-tray .ft button{",
      "  appearance:none;cursor:pointer;border:0;border-radius:999px;",
      "  padding:6px 10px;font:700 9px/1 system-ui;letter-spacing:0.05em;",
      "  background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.92);",
      "  border:1px solid rgba(255,255,255,0.12)}",
      "#mg-solve-tray .ft button:hover{background:rgba(255,255,255,0.14)}",
      /* product / drawer: never reintroduce mega strip */
      "html.mg-product #mg-solve-hud,html.mg-drawer-mode #mg-solve-hud{",
      "  background:transparent!important;border:none!important;",
      "  box-shadow:none!important;max-width:none!important;",
      "  transform:none!important;border-radius:0!important}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function shortBits() {
    var bits = [];
    try {
      if (window.__mgRubikLang && window.__mgRubikLang.face)
        bits.push("R" + (window.__mgRubikLang.face() || "—"));
    } catch (e) {}
    try {
      if (window.__mgBlochSolve && window.__mgBlochSolve.report) {
        var r = window.__mgBlochSolve.report() || "";
        var g = /gate=([A-Z/]+)/.exec(r);
        if (g) bits.push(g[1]);
      }
    } catch (e2) {}
    try {
      if (window.__mgKeyboardBeats)
        bits.push(String(window.__mgKeyboardBeats.bpm() || 0) + "bpm");
    } catch (e3) {}
    return bits.slice(0, 2).join(" · ");
  }

  function detailRows() {
    var rows = [];
    function add(k, v) {
      if (v == null || v === "") return;
      rows.push({ k: k, v: String(v).slice(0, 72) });
    }
    try {
      if (window.__mgBlochSolve && window.__mgBlochSolve.report)
        add("Bloch", (window.__mgBlochSolve.report() || "").replace(/^[^ ]+ /, ""));
    } catch (e) {}
    try {
      if (window.__mgContrail && window.__mgContrail.report)
        add("Path", (window.__mgContrail.report() || "").replace(/^[^ ]+ /, "").slice(0, 56));
    } catch (e2) {}
    try {
      if (window.__mgKeyboardBeats)
        add(
          "Beats",
          window.__mgKeyboardBeats.bpm() +
            " bpm · " +
            window.__mgKeyboardBeats.hits() +
            "/" +
            window.__mgKeyboardBeats.attempts()
        );
    } catch (e3) {}
    try {
      if (window.__mgMemoryMaze && window.__mgMemoryMaze.points)
        add("Maze", window.__mgMemoryMaze.points().length + " pts");
    } catch (e4) {}
    try {
      if (window.__mgRubikLang)
        add("Rubik", "face " + (window.__mgRubikLang.face() || "—"));
    } catch (e5) {}
    try {
      if (window.__mgActivityBoard && window.__mgActivityBoard.report)
        add("Board", window.__mgActivityBoard.report());
    } catch (e6) {}
    try {
      if (window.__mgCollabDay && window.__mgCollabDay.day && window.__mgCollabDay.day())
        add("Day", "collab on");
    } catch (e7) {}
    if (!rows.length) add("Solve", "idle · open TOOLS for modules");
    return rows;
  }

  function paintWord() {
    if (!el) return;
    var sum = shortBits();
    el.innerHTML =
      '<span class="dot">·</span>SOLVE' +
      (sum ? '<span class="sum">' + sum + "</span>" : "");
    el.classList.toggle("open", open);
    el.title = open ? "Close solve metrics" : "Open solve metrics";
  }

  function paintTray() {
    if (!tray) return;
    if (!open) {
      tray.classList.add("hidden");
      return;
    }
    tray.classList.remove("hidden");
    var rows = detailRows();
    tray.innerHTML =
      rows
        .map(function (r) {
          return (
            '<div class="row"><span class="k">' +
            r.k +
            '</span><span class="v">' +
            r.v.replace(/</g, "&lt;") +
            "</span></div>"
          );
        })
        .join("") +
      '<div class="ft">' +
      '<button type="button" data-act="tools">TOOLS</button>' +
      '<button type="button" data-act="board">LIVE</button>' +
      '<button type="button" data-act="rubik">RUBIK</button>' +
      '<button type="button" data-act="close">CLOSE</button>' +
      "</div>";
    tray.querySelectorAll("button[data-act]").forEach(function (b) {
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        var a = b.getAttribute("data-act");
        if (a === "close") {
          setOpen(false);
          return;
        }
        if (a === "tools" && window.__mgToolsDrawer) window.__mgToolsDrawer.open();
        if (a === "board" && window.__mgActivityBoard)
          window.__mgActivityBoard.open({ collapsed: false });
        if (a === "rubik" && window.__mgRubikLang) window.__mgRubikLang.open();
        setOpen(false);
      };
    });
  }

  function setOpen(on) {
    open = !!on;
    paintWord();
    paintTray();
  }

  function ensure() {
    ensureCss();
    if (!el) {
      el = document.createElement("button");
      el.type = "button";
      el.id = "mg-solve-hud";
      el.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        setOpen(!open);
      };
      (document.body || document.documentElement).appendChild(el);
    }
    if (!tray) {
      tray = document.createElement("div");
      tray.id = "mg-solve-tray";
      tray.className = "hidden";
      (document.body || document.documentElement).appendChild(tray);
    }
    /* click outside closes tray */
    if (!window.__mgSolveHudOutside) {
      window.__mgSolveHudOutside = true;
      document.addEventListener(
        "pointerdown",
        function (ev) {
          if (!open) return;
          var t = ev.target;
          if (t && (t === el || el.contains(t) || t === tray || (tray && tray.contains(t))))
            return;
          setOpen(false);
        },
        true
      );
    }
  }

  function tick() {
    ensure();
    paintWord();
    if (open) paintTray();
  }

  setInterval(tick, 800);
  setTimeout(tick, 180);
  window.__mgLiveSolveHud = {
    ver: VER,
    tick: tick,
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: function () {
      setOpen(!open);
    },
    report: function () {
      return VER + " open=" + open;
    },
  };
})();
