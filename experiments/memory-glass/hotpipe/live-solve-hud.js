/* Memory Glass · SOLVE metrics on shell stamp row
 * Same row as version (#mg-build-stamp) + stoplights — ABOVE any CTRL / center strip.
 * Compact mono readout (not a floating center mega-pill).
 * Click → glass tray with full detail. Tools still in TOOLS drawer.
 * VER: live-solve-hud-v4-stamp-row
 */
(function () {
  "use strict";
  var VER = "live-solve-hud-v5-stable-left";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._liveSolveHudVer === VER) return;
  HP._liveSolveHudVer = VER;
  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var el = null;
  var tray = null;
  var open = false;
  var lastSolveLeft = -1;
  var placeRaf = 0;

  function ensureCss() {
    var old = document.getElementById("mg-solve-hud-css");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "mg-solve-hud-css";
    st.textContent = [
      /* ── same row as #mg-build-stamp / stoplights (shell top band) ── */
      "#mg-solve-hud{",
      "  position:fixed!important;",
      "  top:var(--mg-shell-top,2px)!important;",
      "  left:var(--mg-solve-left,220px)!important;",
      "  right:auto!important;",
      "  transform:none!important;",
      "  z-index:2147483642!important;",
      "  max-width:min(48vw,560px)!important;",
      "  width:auto!important;",
      "  min-height:28px;",
      "  padding:var(--mg-hdr-pad-y,6px) 0!important;margin:0;",
      "  border-radius:0!important;",
      "  background:transparent!important;",
      "  border:none!important;box-shadow:none!important;",
      "  backdrop-filter:none!important;-webkit-backdrop-filter:none!important;",
      "  font:500 8px/1.3 ui-monospace,Menlo,system-ui,sans-serif!important;",
      "  letter-spacing:0.06em!important;",
      "  text-transform:none!important;",
      "  color:rgba(255,255,255,0.42)!important;",
      "  text-shadow:0 1px 2px rgba(0,0,0,0.4);",
      "  pointer-events:auto;cursor:pointer;",
      "  white-space:nowrap;",
      "  overflow:hidden!important;text-overflow:ellipsis!important;",
      "  opacity:0.95;",
      "  display:inline-flex!important;align-items:center;gap:6px}",
      "#mg-solve-hud:hover{color:rgba(255,255,255,0.72)!important;opacity:1}",
      "#mg-solve-hud .lbl{",
      "  font:600 8px/1 system-ui,sans-serif;",
      "  letter-spacing:0.14em;text-transform:uppercase;",
      "  color:rgba(255,255,255,0.38);flex-shrink:0}",
      "#mg-solve-hud:hover .lbl{color:rgba(255,255,255,0.7)}",
      "#mg-solve-hud .sum{",
      "  font:500 8px/1.3 ui-monospace,Menlo,monospace;",
      "  letter-spacing:0.04em;text-transform:none;",
      "  color:rgba(200,220,240,0.55);",
      "  overflow:hidden;text-overflow:ellipsis;min-width:0}",
      "#mg-solve-hud b{",
      "  color:rgba(160,210,255,0.75);font-weight:700}",
      "#mg-solve-hud .sep{opacity:0.35;margin:0 4px}",
      "#mg-solve-hud.open .lbl{color:rgba(160,220,255,0.9)}",
      /* kill any legacy center-pill rules that reappear from old injects */
      "html.mg-product #mg-solve-hud,html.mg-drawer-mode #mg-solve-hud,",
      "html.mg-webgrid-play #mg-solve-hud{",
      "  position:fixed!important;top:var(--mg-shell-top,2px)!important;",
      "  left:var(--mg-solve-left,220px)!important;",
      "  transform:none!important;border-radius:0!important;",
      "  background:transparent!important;border:none!important;",
      "  box-shadow:none!important;max-width:min(48vw,560px)!important;",
      "  backdrop-filter:none!important;-webkit-backdrop-filter:none!important}",
      /* tray drops just under stamp row */
      "#mg-solve-tray{",
      "  position:fixed;z-index:2147483643;",
      "  top:calc(var(--mg-shell-top,2px) + 30px);",
      "  left:var(--mg-solve-left,220px);",
      "  width:min(340px,90vw);",
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
      "html.mg-cinema-on #mg-solve-hud,html.mg-dim-on #mg-solve-hud{opacity:0.12}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  /** Sit after version stamp (and optional id), same shell top row.
   *  Only write --mg-solve-left when it moves ≥8px — stops version/SOLVE jitter. */
  function placeOnStampRow(force) {
    if (placeRaf && !force) return;
    function go() {
      placeRaf = 0;
      try {
        var stamp = document.getElementById("mg-build-stamp");
        var lights = document.getElementById("mg-stoplights");
        var left = 220;
        if (stamp) {
          var r = stamp.getBoundingClientRect();
          if (r.width > 8) left = Math.ceil(r.right + 14);
          else if (r.left > 0) left = Math.ceil(r.left + 180);
        } else if (lights) {
          var lr = lights.getBoundingClientRect();
          left = Math.ceil(lr.right + 12);
        }
        /* never sit under stoplights; keep room for LIVE / INSPECT on the right */
        left = Math.max(left, 96);
        var maxL = Math.max(120, window.innerWidth * 0.52);
        if (left > maxL) left = maxL;
        if (!force && lastSolveLeft >= 0 && Math.abs(left - lastSolveLeft) < 8) return;
        lastSolveLeft = left;
        document.documentElement.style.setProperty("--mg-solve-left", left + "px");
      } catch (e) {}
    }
    if (force) {
      go();
      return;
    }
    placeRaf = requestAnimationFrame(go);
  }

  function compactLine() {
    var parts = [];
    function add(label, val) {
      if (val == null || val === "" || val === "—") return;
      parts.push("<b>" + label + "</b> " + String(val).slice(0, 28));
    }
    try {
      if (window.__mgBlochSolve && window.__mgBlochSolve.report) {
        var br = (window.__mgBlochSolve.report() || "").replace(/^[^ ]+ /, "");
        var g = /gate=([^\s]+)/.exec(br);
        var d = /\bd=([^\s]+)/.exec(br);
        var n = /\bn=([^\s]+)/.exec(br);
        var bits = [];
        if (g) bits.push("gate=" + g[1]);
        if (d) bits.push("d=" + d[1]);
        if (n) bits.push("n=" + n[1]);
        add("BLOCH", bits.length ? bits.join(" ") : br.slice(0, 24) || "—");
      }
    } catch (e) {}
    try {
      if (window.__mgKeyboardBeats)
        add(
          "BEAT",
          window.__mgKeyboardBeats.bpm() +
            " · " +
            window.__mgKeyboardBeats.hits() +
            "/" +
            window.__mgKeyboardBeats.attempts()
        );
    } catch (e2) {}
    try {
      if (window.__mgMemoryMaze && window.__mgMemoryMaze.points)
        add("MAZE", window.__mgMemoryMaze.points().length);
    } catch (e3) {}
    try {
      if (window.__mgRubikLang && window.__mgRubikLang.face)
        add("RUBIK", window.__mgRubikLang.face() || "—");
    } catch (e4) {}
    try {
      if (window.__mgActivityBoard && window.__mgActivityBoard.report) {
        var ar = window.__mgActivityBoard.report() || "";
        var top = /top=([^\s]+)/.exec(ar);
        add("BOARD", top ? top[1] : "—");
      }
    } catch (e5) {}
    try {
      if (window.__mgMesh && window.__mgMesh.peerCount)
        add("MESH", window.__mgMesh.peerCount());
      else if (window.__mgCollabDay && window.__mgCollabDay.day && window.__mgCollabDay.day())
        add("DAY", "on");
    } catch (e6) {}
    try {
      if (window.__mgContrail && window.__mgContrail.report) {
        var cr = (window.__mgContrail.report() || "").replace(/^[^ ]+ /, "");
        if (cr) add("PATH", cr.slice(0, 20));
      }
    } catch (e7) {}
    if (!parts.length) return "idle";
    return parts.join('<span class="sep">·</span>');
  }

  function detailRows() {
    var rows = [];
    function add(k, v) {
      if (v == null || v === "") return;
      rows.push({ k: k, v: String(v).slice(0, 80) });
    }
    try {
      if (window.__mgBlochSolve && window.__mgBlochSolve.report)
        add("Bloch", (window.__mgBlochSolve.report() || "").replace(/^[^ ]+ /, ""));
    } catch (e) {}
    try {
      if (window.__mgContrail && window.__mgContrail.report)
        add("Path", (window.__mgContrail.report() || "").replace(/^[^ ]+ /, ""));
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
      if (window.__mgRubikLang) add("Rubik", "face " + (window.__mgRubikLang.face() || "—"));
    } catch (e5) {}
    try {
      if (window.__mgActivityBoard && window.__mgActivityBoard.report)
        add("Board", window.__mgActivityBoard.report());
    } catch (e6) {}
    try {
      var stamp = document.getElementById("mg-build-stamp");
      if (stamp && stamp.textContent) add("Build", stamp.textContent.trim());
      if (window.__MG_BUILD_EPOCH) add("Epoch", String(window.__MG_BUILD_EPOCH));
      if (window.__MG_RUN_EPOCH || window.__MG_PROCESS_EPOCH)
        add("Run", String(window.__MG_RUN_EPOCH || window.__MG_PROCESS_EPOCH));
    } catch (e7) {}
    if (!rows.length) add("Solve", "idle · open TOOLS for modules");
    return rows;
  }

  function paintWord() {
    if (!el) return;
    /* do not re-place every tick — only update text (placement on resize/mount) */
    var sum = compactLine();
    var sumEl = el.querySelector(".sum");
    if (sumEl) {
      sumEl.innerHTML = sum;
    } else {
      el.innerHTML =
        '<span class="lbl">SOLVE</span><span class="sum">' + sum + "</span>";
    }
    el.classList.toggle("open", open);
    el.title = open
      ? "Close solve metrics"
      : "Solve metrics · same row as version stamp · click for detail";
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
            String(r.v).replace(/</g, "&lt;") +
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
    /* Prefer mounting next to stamp in #mg-root if present (same stacking context) */
    var host = document.getElementById("mg-root") || document.body || document.documentElement;
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
      host.appendChild(el);
    }
    if (!tray) {
      tray = document.createElement("div");
      tray.id = "mg-solve-tray";
      tray.className = "hidden";
      (document.body || document.documentElement).appendChild(tray);
    }
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
      window.addEventListener("resize", function () {
        placeOnStampRow(true);
      });
    }
  }

  function tick() {
    ensure();
    paintWord();
    if (open) paintTray();
  }

  setInterval(tick, 1600);
  setTimeout(function () {
    tick();
    placeOnStampRow(true);
  }, 120);
  setTimeout(function () {
    placeOnStampRow(true);
  }, 600);
  setTimeout(function () {
    placeOnStampRow(true);
  }, 1800);

  window.__mgLiveSolveHud = {
    ver: VER,
    tick: tick,
    place: placeOnStampRow,
    open: function () {
      ensure();
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: function () {
      ensure();
      setOpen(!open);
    },
    isOpen: function () {
      return !!open;
    },
    report: function () {
      return VER + " open=" + open;
    },
  };
})();
