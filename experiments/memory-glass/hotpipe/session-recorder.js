/* Memory Glass · float layout (play-safe, no force-open)
 * Only positions panels that are ALREADY open. Never un-hides closed floats.
 * Does not auto-open the lab on launch.
 * VER: float-layout-v3-no-force
 */
(function () {
  "use strict";
  /* Product browse: never boot embedded float-layout (lag). Lab only. */
  try {
    if (!/[?&]mg_lab_full=1\b/i.test(location.search || "") && !window.__mgForceFloatLayout) {
      return;
    }
  } catch (eSkip) {
    return;
  }
  /* If float-layout.js already mounted v10+, skip this embedded layout */
  var VER = "float-layout-v10-no-overlap";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._floatLayoutVer === VER) return;
  /* also skip if a newer float-layout already claimed the slot */
  if (HP._floatLayoutVer && String(HP._floatLayoutVer).indexOf("float-layout-v10") === 0) return;
  HP._floatLayoutVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var seqTimer = null;
  var seqBusy = false;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "layout");
    } catch (e) {}
  }

  function isVisible(el) {
    if (!el) return false;
    if (el.classList && el.classList.contains("hidden")) return false;
    if (el.style && el.style.display === "none") return false;
    try {
      var cs = window.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
    } catch (e) {}
    return true;
  }

  function slots() {
    var w = window.innerWidth || 1400;
    var h = window.innerHeight || 900;
    var m = 12;
    var top = 48;
    var recH = 48;
    var bottom = recH + 8;
    var leftRail = Math.min(280, Math.floor(w * 0.2));
    var rightRail = Math.min(340, Math.floor(w * 0.26));
    var gap = 8;
    /* Right stack bottom→up: keyboard, beats (full staff), field train */
    var kbH = Math.min(220, Math.floor(h * 0.24));
    var beatsH = Math.min(220, Math.floor(h * 0.26));
    var fieldH = Math.min(420, Math.floor(h * 0.42));
    var stackW = Math.min(420, Math.floor(w * 0.34));
    var fieldW = Math.min(440, Math.floor(w * 0.36));
    var kbBottom = bottom;
    var beatsBottom = kbBottom + kbH + gap;
    var fieldBottom = beatsBottom + beatsH + gap;
    return {
      maze: {
        left: m,
        top: top,
        width: leftRail,
        maxHeight: Math.min(300, Math.floor(h * 0.32)),
        minHeight: 180,
      },
      geo: {
        left: m,
        top: top + Math.min(320, Math.floor(h * 0.34)),
        width: leftRail + 20,
        maxHeight: Math.min(260, Math.floor(h * 0.28)),
        minHeight: 150,
      },
      board: {
        right: m,
        top: top,
        width: rightRail,
        maxHeight: Math.min(380, Math.floor(h * 0.42)),
        minHeight: 160,
      },
      rubik: {
        left: m,
        top: top + Math.floor(h * 0.38),
        width: Math.min(360, Math.floor(w * 0.28)),
        maxHeight: Math.min(360, Math.floor(h * 0.36)),
      },
      /* field game mode (webgrid/go/chess) */
      field: {
        right: m,
        bottom: fieldBottom,
        width: fieldW,
        maxHeight: fieldH,
        minHeight: Math.min(280, fieldH),
        height: fieldH,
      },
      beats: {
        right: m,
        bottom: beatsBottom,
        width: stackW,
        maxHeight: beatsH,
        minHeight: beatsH,
        height: beatsH,
      },
      keyboard: {
        right: m,
        bottom: kbBottom,
        width: stackW,
        maxHeight: kbH,
        minHeight: kbH,
        height: kbH,
      },
      bloch: {
        left: m,
        bottom: bottom + 120,
        width: 240,
        maxHeight: 260,
        minHeight: 200,
      },
      /* Menu spheres LEFT near CTRL / REC */
      blochOrb: { left: m, bottom: bottom + 56, width: 52, height: 52 },
      rubikOrb: { left: m + 60, bottom: bottom + 56, width: 52, height: 52 },
      raider: {
        left: Math.max(m + leftRail + gap, Math.floor(w * 0.22)),
        top: top,
        width: Math.min(720, Math.floor(w * 0.52)),
        maxHeight: Math.min(520, Math.floor(h * 0.58)),
        minHeight: 280,
      },
      post: {
        right: rightRail + m + 8,
        top: top,
        width: Math.min(280, Math.floor(w * 0.22)),
      },
      rec: { left: m, bottom: m },
      capsule: {
        left: m,
        bottom: bottom + 4 + 60,
        width: Math.min(320, Math.floor(w * 0.28)),
        maxHeight: Math.min(480, Math.floor(h * 0.5)),
      },
    };
  }

  function pin(el, slot, opts) {
    if (!el || !slot || !isVisible(el)) return false;
    opts = opts || {};
    el.style.position = "fixed";
    el.style.zIndex = String(opts.z || 2147482990);
    el.style.transform = "none";
    el.style.margin = "0";
    el.style.left = "auto";
    el.style.right = "auto";
    el.style.top = "auto";
    el.style.bottom = "auto";
    if (slot.left != null) el.style.left = slot.left + "px";
    if (slot.right != null) el.style.right = slot.right + "px";
    if (slot.top != null) el.style.top = slot.top + "px";
    if (slot.bottom != null) el.style.bottom = slot.bottom + "px";
    if (slot.width != null) el.style.width = slot.width + "px";
    if (slot.minHeight != null) el.style.minHeight = slot.minHeight + "px";
    if (slot.maxHeight != null) {
      el.style.maxHeight = slot.maxHeight + "px";
      /* scroll inside panel; don't clip children under fixed headers */
      el.style.overflowX = "hidden";
      el.style.overflowY = "auto";
      el.style.boxSizing = "border-box";
    } else {
      el.style.overflow = "visible";
    }
    if (slot.height != null) el.style.height = slot.height + "px";
    return true;
  }

  function apply() {
    var s = slots();
    var n = 0;
    if (pin(document.getElementById("mg-mem-maze"), s.maze, { z: 2147482995 })) n++;
    if (pin(document.getElementById("mg-geo-float"), s.geo, { z: 2147482994 })) n++;
    if (pin(document.getElementById("mg-activity-board"), s.board, { z: 2147482993 })) n++;
    if (pin(document.getElementById("mg-rubik-float"), s.rubik, { z: 2147482996 })) n++;
    if (pin(document.getElementById("mg-bloch-float"), s.bloch, { z: 2147482991 })) n++;
    if (pin(document.getElementById("mg-bloch-orb"), s.blochOrb, { z: 2147482997 })) n++;
    if (pin(document.getElementById("mg-rubik-orb"), s.rubikOrb, { z: 2147482997 })) n++;
    if (pin(document.getElementById("mg-raider-stage"), s.raider, { z: 2147482988 })) n++;
    /* stack order: field (top) → beats → keyboard (bottom) */
    if (pin(document.getElementById("mg-sports-field"), s.field, { z: 2147482992 })) n++;
    if (pin(document.getElementById("mg-kb-beats"), s.beats, { z: 2147482993 })) n++;
    if (pin(document.getElementById("mg-float-kb"), s.keyboard, { z: 2147483003 })) n++;
    var post =
      document.getElementById("mg-board-toast") ||
      document.getElementById("mg-board-post-toast");
    if (post && isVisible(post)) pin(post, s.post, { z: 2147483010 });
    var rec = document.getElementById("mg-rec-chip");
    if (rec && isVisible(rec)) pin(rec, s.rec, { z: 2147483006 });
    /* CTRL tools — left stack ABOVE rec/snap/board (not center of page) */
    var cap = document.getElementById("mg-glass-cap");
    if (cap && isVisible(cap)) {
      pin(cap, s.capsule, { z: 2147483004 });
      cap.style.transform = "none";
    }
    var chip = document.getElementById("mg-board-chip");
    if (chip) {
      chip.style.right = "12px";
      chip.style.top = "10px";
      chip.style.left = "auto";
      chip.style.zIndex = "2147483005";
    }
    return n;
  }

  var STEPS = [
    {
      id: "contrail",
      label: "PATH",
      run: function () {
        if (window.__mgContrail) {
          if (window.__mgContrail.setOverlay) window.__mgContrail.setOverlay(true);
          if (window.__mgContrail.setFlow) window.__mgContrail.setFlow(true);
        }
      },
    },
    {
      id: "maze",
      label: "MAZE",
      run: function () {
        if (window.__mgMemoryMaze) window.__mgMemoryMaze.open();
      },
    },
    {
      id: "board",
      label: "BOARD",
      run: function () {
        if (window.__mgActivityBoard) {
          if (window.__mgActivityBoard.mergeFleetSeed)
            window.__mgActivityBoard.mergeFleetSeed();
          window.__mgActivityBoard.open();
        }
      },
    },
    {
      id: "bloch",
      label: "BLOCH",
      run: function () {
        if (window.__mgBlochSolve) {
          window.__mgBlochSolve.setEnabled(true);
          if (window.__mgBlochSolve.open) window.__mgBlochSolve.open();
        }
      },
    },
    {
      id: "beats",
      label: "BEATS",
      run: function () {
        if (window.__mgKeyboardBeats) window.__mgKeyboardBeats.open();
      },
    },
    {
      id: "field",
      label: "FIELD",
      run: function () {
        if (window.__mgSportsField) window.__mgSportsField.open();
      },
    },
    /* GEO optional — open via TOOLS → GEO so it never blocks score by default */
  ];

  /** Lean lab kit: beats · maze · board pill · contrail */
  function openLabKit() {
    try {
      if (window.__mgContrail) {
        if (window.__mgContrail.setOverlay) window.__mgContrail.setOverlay(true);
        if (window.__mgContrail.setFlow) window.__mgContrail.setFlow(true);
      }
      if (window.__mgMemoryMaze) window.__mgMemoryMaze.open();
      if (window.__mgKeyboardBeats) window.__mgKeyboardBeats.open();
      if (window.__mgActivityBoard) {
        if (window.__mgActivityBoard.mergeFleetSeed)
          window.__mgActivityBoard.mergeFleetSeed();
        window.__mgActivityBoard.open({ collapsed: true });
      }
      if (window.__mgBlochSolve && window.__mgBlochSolve.setEnabled)
        window.__mgBlochSolve.setEnabled(true);
      apply();
      log(VER + " · lab kit lean (beats·maze·board-pill·contrail)");
      return true;
    } catch (e) {
      log("lab kit err " + e);
      return false;
    }
  }

  /** Explicit only — FLOATS button / mg_lab_demo=1. Never on normal launch. */
  function openSequentially(opts) {
    opts = opts || {};
    var delay = opts.delayMs != null ? opts.delayMs : 500;
    if (seqBusy) return Promise.resolve(false);
    seqBusy = true;
    if (seqTimer) clearTimeout(seqTimer);
    var i = 0;
    return new Promise(function (resolve) {
      function step() {
        if (i >= STEPS.length) {
          apply();
          try {
            if (window.__mgWebgridFill && window.__mgWebgridFill.kick)
              window.__mgWebgridFill.kick();
          } catch (eK) {}
          seqBusy = false;
          log(VER + " · sequential open done");
          resolve(true);
          return;
        }
        var s = STEPS[i++];
        try {
          s.run();
        } catch (eR) {}
        apply();
        seqTimer = setTimeout(step, delay);
      }
      step();
    });
  }

  function closeAll() {
    try {
      if (window.__mgMemoryMaze && window.__mgMemoryMaze.close) window.__mgMemoryMaze.close();
      if (window.__mgGeoPattern && window.__mgGeoPattern.close) window.__mgGeoPattern.close();
      if (window.__mgRubikLang && window.__mgRubikLang.close) window.__mgRubikLang.close();
      if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.close)
        window.__mgKeyboardBeats.close();
      if (window.__mgSportsField && window.__mgSportsField.close) window.__mgSportsField.close();
      if (window.__mgBlochSolve && window.__mgBlochSolve.close) window.__mgBlochSolve.close();
      if (window.__mgActivityBoard && window.__mgActivityBoard.close)
        window.__mgActivityBoard.close();
    } catch (e) {}
  }

  window.addEventListener("resize", function () {
    try {
      apply();
    } catch (e) {}
  });

  /* On load: reflow open panels; on WebGrid open requested lab kit */
  setTimeout(function () {
    try {
      apply();
    } catch (eA) {}
  }, 800);

  setTimeout(function () {
    try {
      /* PRODUCT: no auto lab kit — only explicit demo/full flags */
      if (/[?&]mg_lab_full=1\b/i.test(location.search || "")) {
        openLabKit();
      } else if (/[?&]mg_lab_demo=1\b/i.test(location.search || "")) {
        openSequentially({ delayMs: 480 });
      }
    } catch (eD) {}
  }, 1100);

  window.__mgFloatLayout = {
    ver: VER,
    apply: apply,
    openLabKit: openLabKit,
    openSequentially: openSequentially,
    closeAll: closeAll,
    slots: slots,
    report: function () {
      return VER + " busy=" + seqBusy;
    },
  };

  log(VER + " · layout open panels only · no force-open");
})();

/* Memory Glass · session recorder (P2) + X draft from run metrics / board (P4)
 * Cam still-pipe samples + lab composite SNAP (game canvas + floats + metrics HUD).
 * X draft = activity leaderboard synopsis (you post — no auto-post).
 * VER: session-rec-v12-bot-lab-strip
 * LAB: bottom chrome horizontal glass strip (rec · snap · draw · share · dev · agent)
 * Fallback: . lab ▾ PAGE-style drop if bottom chrome missing.
 * Always remount so upgrades land.
 */
(function () {
  "use strict";
  var VER = "session-rec-v12-bot-lab-strip";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._sessionRecVer === VER) return;
  HP._sessionRecVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "rec");
    } catch (e) {}
  }

  var recording = false;
  var frames = [];
  var meta = {};
  var timer = null;
  var recBtn = null;

  function hideStandaloneFabs() {
    try {
      var df = document.getElementById("mg-draw-fab");
      if (df) df.style.display = "none";
      var af = document.getElementById("mg-agent-desk-fab");
      if (af) af.style.display = "none";
    } catch (e) {}
  }

  function chipToast(msg) {
    try {
      log(msg);
      if (window.__mgDevLog) window.__mgDevLog("ok", String(msg), "rec");
    } catch (e) {}
    try {
      var t = document.getElementById("mg-rec-toast");
      if (!t) {
        t = document.createElement("div");
        t.id = "mg-rec-toast";
        t.style.cssText =
          "position:fixed;left:50%;bottom:72px;transform:translateX(-50%);" +
          "z-index:2147483647;padding:8px 12px;border-radius:10px;" +
          "background:rgba(12,16,28,0.9);color:#e8f0ff;font:650 11px/1.3 system-ui;" +
          "border:1px solid rgba(140,200,255,0.35);pointer-events:none;" +
          "box-shadow:0 10px 30px rgba(0,0,0,0.4)";
        document.documentElement.appendChild(t);
      }
      t.textContent = String(msg || "");
      t.style.opacity = "1";
      clearTimeout(t._hide);
      t._hide = setTimeout(function () {
        t.style.opacity = "0";
      }, 2200);
    } catch (e2) {}
  }

  /* ── Mini DRAW (always available — no separate module required) ── */
  var miniDraw = null;
  function ensureMiniDraw() {
    if (miniDraw) return miniDraw;
    var canvas = null;
    var ctx = null;
    var toolbar = null;
    var active = false;
    var drawing = false;
    var strokes = [];
    var cur = null;
    var color = "#f87171";

    function css() {
      if (document.getElementById("mg-mini-draw-css")) return;
      var st = document.createElement("style");
      st.id = "mg-mini-draw-css";
      st.textContent = [
        "#mg-mini-draw-cv{position:fixed;inset:0;z-index:2147483646;display:none;",
        "  cursor:crosshair;touch-action:none;pointer-events:none}",
        "#mg-mini-draw-cv.on{display:block;pointer-events:auto!important}",
        "#mg-mini-draw-tb{position:fixed;top:calc(12px + var(--mg-chrome-below,100px));",
        "  left:50%;transform:translateX(-50%);z-index:2147483647;display:none;",
        "  gap:6px;padding:6px 10px;border-radius:12px;align-items:center;",
        "  background:rgba(12,16,28,0.9);border:1px solid rgba(248,113,113,0.35);",
        "  font:650 11px system-ui;color:#fecaca;pointer-events:auto!important}",
        "#mg-mini-draw-tb.on{display:flex}",
        "#mg-mini-draw-tb button{appearance:none;border:1px solid rgba(255,255,255,0.15);",
        "  background:rgba(255,255,255,0.08);color:inherit;padding:6px 10px;",
        "  border-radius:8px;cursor:pointer;font:inherit}",
        "#mg-mini-draw-tb button.pick{border-color:rgba(96,165,250,0.55);color:#93c5fd}",
      ].join("");
      document.documentElement.appendChild(st);
    }

    function live(fn, a, b) {
      try {
        var C = window.__mgLiveCollab;
        if (C && C[fn]) return C[fn](a, b);
      } catch (e) {}
    }

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      redraw();
    }

    function redraw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      strokes.forEach(function (s) {
        if (!s.pts || s.pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(s.pts[0].x, s.pts[0].y);
        for (var i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x, s.pts[i].y);
        ctx.strokeStyle = s.color || color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      });
      if (cur && cur.pts && cur.pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(cur.pts[0].x, cur.pts[0].y);
        for (var j = 1; j < cur.pts.length; j++) ctx.lineTo(cur.pts[j].x, cur.pts[j].y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }

    function pt(e) {
      if (e.touches && e.touches[0])
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return { x: e.clientX, y: e.clientY };
    }

    function activate() {
      css();
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.id = "mg-mini-draw-cv";
        document.documentElement.appendChild(canvas);
        ctx = canvas.getContext("2d");
        canvas.addEventListener("mousedown", function (e) {
          if (!active) return;
          e.preventDefault();
          e.stopPropagation();
          drawing = true;
          cur = { color: color, pts: [pt(e)] };
        });
        canvas.addEventListener("mousemove", function (e) {
          if (!drawing || !cur) return;
          e.preventDefault();
          cur.pts.push(pt(e));
          redraw();
        });
        function up(e) {
          if (!drawing) return;
          drawing = false;
          if (e) e.preventDefault();
          if (cur && cur.pts && cur.pts.length > 1) {
            strokes.push(cur);
            live("onStroke", cur, { n: strokes.length });
          }
          cur = null;
          redraw();
        }
        canvas.addEventListener("mouseup", up);
        canvas.addEventListener("mouseleave", up);
        canvas.addEventListener(
          "touchstart",
          function (e) {
            if (!active) return;
            e.preventDefault();
            drawing = true;
            cur = { color: color, pts: [pt(e)] };
          },
          { passive: false }
        );
        canvas.addEventListener(
          "touchmove",
          function (e) {
            if (!drawing || !cur) return;
            e.preventDefault();
            cur.pts.push(pt(e));
            redraw();
          },
          { passive: false }
        );
        canvas.addEventListener(
          "touchend",
          function (e) {
            up(e);
          },
          { passive: false }
        );
        window.addEventListener("resize", function () {
          if (active) resize();
        });
      }
      if (!toolbar) {
        toolbar = document.createElement("div");
        toolbar.id = "mg-mini-draw-tb";
        toolbar.innerHTML =
          "<span>DRAW</span>" +
          '<button type="button" data-a="undo">↩</button>' +
          '<button type="button" data-a="clear">∅</button>' +
          '<button type="button" class="pick" data-a="pick" title="Pick element · structure assess">◎</button>' +
          '<button type="button" data-a="fix">FIX</button>' +
          '<button type="button" data-a="close">✕</button>';
        document.documentElement.appendChild(toolbar);
        toolbar.addEventListener("click", function (e) {
          var b = e.target && e.target.closest ? e.target.closest("button") : e.target;
          if (!b || !b.getAttribute) return;
          var a = b.getAttribute("data-a");
          if (a === "undo") {
            strokes.pop();
            redraw();
          } else if (a === "clear") {
            strokes = [];
            redraw();
          } else if (a === "close") {
            deactivate();
          } else if (a === "pick") {
            deactivate();
            live("togglePick");
            chipToast("PICK · hover site · click to assess in DESK");
          } else if (a === "fix") {
            var md =
              "# FIX · Memory Glass DRAW\n\n" +
              "- URL: " +
              location.href +
              "\n- strokes: " +
              strokes.length +
              "\n- title: " +
              (document.title || "") +
              "\n\nPlease fix the marked UI issues on the fly.\n";
            try {
              if (window.ipc)
                window.ipc.postMessage(
                  JSON.stringify({ op: "clipboard_copy", text: md })
                );
              else if (navigator.clipboard) navigator.clipboard.writeText(md);
            } catch (eC) {}
            chipToast("FIX packet → clipboard + live desk");
            var packet = {
              md: md,
              strokes: strokes.length,
              note: "see DRAW marks",
              url: location.href,
            };
            live("onFix", packet);
            try {
              if (window.__mgAgentDesk) {
                if (window.__mgAgentDesk.open) window.__mgAgentDesk.open();
                if (window.__mgAgentDesk.pushLog)
                  window.__mgAgentDesk.pushLog(
                    "sys",
                    "DRAW FIX · " + strokes.length + " strokes · live linked"
                  );
              }
            } catch (eD) {}
          }
        });
      }
      active = true;
      try {
        document.documentElement.classList.add("mg-drawing");
      } catch (eD) {}
      canvas.classList.add("on");
      toolbar.classList.add("on");
      resize();
      document.addEventListener("keydown", onEsc, true);
      live("onDrawToggle", true);
    }

    function onEsc(e) {
      if (e.key === "Escape" && active) {
        e.preventDefault();
        deactivate();
      }
    }

    function deactivate() {
      active = false;
      drawing = false;
      cur = null;
      try {
        document.documentElement.classList.remove("mg-drawing");
      } catch (eD) {}
      if (canvas) canvas.classList.remove("on");
      if (toolbar) toolbar.classList.remove("on");
      document.removeEventListener("keydown", onEsc, true);
      var draw = document.getElementById("mg-rec-draw");
      if (draw) draw.classList.remove("on");
      live("onDrawToggle", false);
    }

    function toggle() {
      if (active) deactivate();
      else activate();
      return active;
    }

    miniDraw = {
      toggle: toggle,
      activate: activate,
      deactivate: deactivate,
      isActive: function () {
        return active;
      },
      getStrokes: function () {
        return strokes.slice();
      },
      report: function () {
        return "mini-draw active=" + active + " strokes=" + strokes.length;
      },
    };
    /* Expose so external annotate can detect / collab */
    if (!window.__mgSiteAnnotate) {
      window.__mgMiniDraw = miniDraw;
    }
    return miniDraw;
  }

  var actLock = 0;
  function actOnce(fn) {
    var now = Date.now();
    if (now - actLock < 280) return false;
    actLock = now;
    return fn();
  }

  function actDraw() {
    return actOnce(function () {
    /* Prefer full annotate if already loaded; else mini-draw always works */
    var A = window.__mgSiteAnnotate || window.screenAnnotate;
    if (A && (A.toggle || A.activate)) {
      try {
        if (A.toggle) A.toggle();
        else if (A.isActive && A.isActive()) A.deactivate();
        else A.activate();
        var on = !!(A.isActive && A.isActive());
        var draw = document.getElementById("mg-rec-draw");
        if (draw) draw.classList.toggle("on", on);
        chipToast(on ? "DRAW on · full annotate" : "DRAW off");
        return true;
      } catch (e) {
        chipToast("annotate err · falling back mini");
      }
    }
    /* Lazy-load full annotate in background; mini works immediately */
    try {
      if (window.__mgLazy && window.__mgLazy.need) window.__mgLazy.need("annotate");
    } catch (eL) {}
    try {
      var M = ensureMiniDraw();
      var on2 = M.toggle();
      var d2 = document.getElementById("mg-rec-draw");
      if (d2) d2.classList.toggle("on", on2);
      chipToast(on2 ? "DRAW on · mark issues · FIX when done" : "DRAW off");
      return true;
    } catch (e2) {
      chipToast("DRAW err " + e2);
      return false;
    }
    });
  }

  function actDesk() {
    return actOnce(function () {
    function openDesk() {
      var D = window.__mgAgentDesk;
      if (!D) return false;
      try {
        if (D.toggle) D.toggle();
        else if (D.open) D.open();
        var open = !!(D.state && D.state.open);
        var desk = document.getElementById("mg-rec-desk");
        if (desk) desk.classList.toggle("on", open);
        chipToast(open ? "DESK αβγδ open" : "DESK closed");
        return true;
      } catch (e) {
        chipToast("DESK err " + e);
        return false;
      }
    }
    if (window.__mgAgentDesk) return openDesk();
    chipToast("DESK loading…");
    try {
      if (window.__mgLazy && window.__mgLazy.need) {
        window.__mgLazy.need("desk", function (ok) {
          if (ok) openDesk();
          else chipToast("DESK offline — rebuild/hot module");
        });
        return true;
      }
    } catch (eL) {}
    chipToast("DESK offline — ⌘⇧R");
    return false;
    });
  }

  function setLabMenuOpen(on) {
    if (!recBtn) return;
    var menu = recBtn.querySelector("#mg-rec-menu");
    var trig = recBtn.querySelector("#mg-rec-trigger");
    if (!menu) return;
    menu.classList.toggle("is-open", !!on);
    if (trig) trig.setAttribute("aria-expanded", on ? "true" : "false");
  }

  function labRoots() {
    var roots = [];
    var bot = document.getElementById("mg-bot-lab");
    if (bot) roots.push(bot);
    if (recBtn) roots.push(recBtn);
    return roots;
  }

  function syncDropOnState() {
    var map = {
      "mg-lab-rec": recording,
      "mg-lab-draw": !!(
        (window.__mgMiniDraw &&
          window.__mgMiniDraw.isActive &&
          window.__mgMiniDraw.isActive()) ||
        (window.__mgSiteAnnotate &&
          window.__mgSiteAnnotate.isActive &&
          window.__mgSiteAnnotate.isActive())
      ),
      "mg-lab-dev": !!(
        window.__mgLiveCollab &&
        window.__mgLiveCollab.isPicking &&
        window.__mgLiveCollab.isPicking()
      ),
      "mg-lab-agent": !!(
        window.__mgAgentDesk &&
        window.__mgAgentDesk.state &&
        window.__mgAgentDesk.state.open
      ),
    };
    labRoots().forEach(function (rootEl) {
      Object.keys(map).forEach(function (id) {
        var b = rootEl.querySelector("#" + id);
        if (b) b.classList.toggle("on", !!map[id]);
      });
      var tgl = rootEl.querySelector("#mg-lab-rec");
      if (tgl) {
        tgl.innerHTML =
          '<span class="dot">.</span>' + (recording ? "stop" : "rec");
      }
    });
    if (recBtn) recBtn.classList.toggle("on", !!recording);
  }

  function bindLabButtons() {
    var bot = document.getElementById("mg-bot-lab");
    if (!bot || bot._mgWired) return;
    bot._mgWired = true;
    bot.addEventListener(
      "click",
      function (ev) {
        var t = ev.target;
        if (!t) return;
        var btn = t.closest ? t.closest("button") : t;
        if (!btn || !btn.id) return;
        if (btn.id.indexOf("mg-lab-") !== 0) return;
        try {
          ev.preventDefault();
          ev.stopPropagation();
        } catch (e0) {}
        window.__mgUserChromeTouch = true;
        runRecAction(btn.id);
      },
      true
    );
    syncDropOnState();
  }

  function runRecAction(id) {
    /* Map PAGE-style menu ids → actions */
    if (id === "mg-lab-rec" || id === "mg-rec-toggle") {
      if (recording) stop();
      else start();
    } else if (id === "mg-lab-snap" || id === "mg-rec-snap") {
      try {
        if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
          window.__mgFloatLayout.apply();
        if (window.__mgActivityBoard) {
          window.__mgActivityBoard.mergeFleetSeed &&
            window.__mgActivityBoard.mergeFleetSeed();
          window.__mgActivityBoard.open();
          window.__mgActivityBoard.submitRun("snap");
        }
      } catch (eB) {}
      snap("manual").then(function (fr) {
        chipToast(
          "snap " +
            (fr && fr.lab && fr.lab.peakBps != null
              ? fr.lab.peakBps + " bps"
              : "ok")
        );
      });
    } else if (id === "mg-lab-draw" || id === "mg-rec-draw") {
      actDraw();
    } else if (id === "mg-lab-share" || id === "mg-rec-x" || id === "mg-rec-post") {
      /* share = X draft + optional board post packet */
      exportXDraft();
      chipToast("share · draft copied");
    } else if (id === "mg-lab-dev" || id === "mg-rec-pick") {
      /* dev = structure pick + inspect float */
      try {
        if (window.__mgLiveCollab && window.__mgLiveCollab.togglePick) {
          window.__mgLiveCollab.togglePick();
          chipToast(
            window.__mgLiveCollab.isPicking && window.__mgLiveCollab.isPicking()
              ? "dev · pick on"
              : "dev · pick off"
          );
        }
      } catch (ePk) {}
      try {
        if (window.ipc)
          window.ipc.postMessage(JSON.stringify({ op: "dev_show" }));
      } catch (eD) {}
    } else if (id === "mg-lab-agent" || id === "mg-rec-desk") {
      actDesk();
    } else if (id === "mg-rec-board") {
      if (window.__mgActivityBoard) window.__mgActivityBoard.toggle();
    }
    setTimeout(syncDropOnState, 50);
  }

  function wireRecActions() {
    if (!recBtn) return;
    if (!recBtn._mgWired) {
      recBtn._mgWired = true;
      recBtn.addEventListener(
        "click",
        function (ev) {
          var t = ev.target;
          if (!t) return;
          var btn = t.closest ? t.closest("button") : t;
          if (!btn || !btn.id) return;
          var id = btn.id;
          try {
            ev.preventDefault();
            ev.stopPropagation();
          } catch (e0) {}

          if (id === "mg-rec-trigger") {
            var menu = recBtn.querySelector("#mg-rec-menu");
            setLabMenuOpen(!(menu && menu.classList.contains("is-open")));
            syncDropOnState();
            return;
          }
          if (id.indexOf("mg-lab-") === 0 || id.indexOf("mg-rec-") === 0) {
            runRecAction(id);
            /* close after primary work items (match PAGE: pick and go) */
            if (
              id === "mg-lab-draw" ||
              id === "mg-lab-dev" ||
              id === "mg-lab-agent" ||
              id === "mg-rec-draw" ||
              id === "mg-rec-desk" ||
              id === "mg-rec-pick"
            ) {
              setLabMenuOpen(false);
            }
          }
        },
        true
      );
      /* close LAB menu on outside click */
      if (!window.__mgRecMenuDocClose) {
        window.__mgRecMenuDocClose = true;
        document.addEventListener(
          "pointerdown",
          function (ev) {
            if (!recBtn) return;
            var menu = recBtn.querySelector("#mg-rec-menu");
            if (!menu || !menu.classList.contains("is-open")) return;
            if (recBtn.contains(ev.target)) return;
            setLabMenuOpen(false);
          },
          true
        );
      }
    }
    hideStandaloneFabs();
    syncDropOnState();
  }

  function ensureUi() {
    var css = document.getElementById("mg-rec-css");
    if (css) {
      try {
        css.parentNode.removeChild(css);
      } catch (eR) {}
    }
    var st = document.createElement("style");
    st.id = "mg-rec-css";
    st.textContent = [
      /* Bottom chrome owns LAB when present */
      "html.mg-bot-chrome #mg-rec-chip{display:none!important;pointer-events:none!important}",
      /* Flat shell word — fallback when bottom chrome absent */
      "#mg-rec-chip{",
      "  position:fixed!important;left:14px!important;",
      "  bottom:calc(14px + var(--mg-kb-h,0px))!important;",
      "  z-index:2147483647!important;display:flex!important;",
      "  flex-direction:column;align-items:flex-start;",
      "  padding:0;margin:0;border:none!important;background:transparent!important;",
      "  box-shadow:none!important;backdrop-filter:none!important;",
      "  -webkit-backdrop-filter:none!important;",
      "  font:600 11px/1 system-ui,sans-serif;",
      "  letter-spacing:0.22em;text-transform:uppercase;",
      "  color:rgba(255,255,255,0.9)!important;pointer-events:auto!important;",
      "  isolation:isolate!important}",
      "#mg-rec-menu{",
      "  position:relative!important;display:flex!important;",
      "  flex-direction:column;align-items:flex-start;text-align:left;",
      "  user-select:none}",
      "#mg-rec-trigger{",
      "  appearance:none;cursor:pointer;user-select:none;",
      "  display:inline-flex;align-items:center;gap:8px;",
      "  min-height:28px;padding:6px 2px;margin:0;",
      "  background:transparent!important;border:none!important;box-shadow:none!important;",
      "  color:rgba(255,255,255,0.9);",
      "  font:600 11px/1 system-ui,sans-serif;",
      "  letter-spacing:0.22em;text-transform:uppercase;",
      "  text-shadow:0 1px 2px rgba(0,0,0,0.4);",
      "  transition:color .15s,opacity .15s,text-shadow .15s;opacity:0.92}",
      "#mg-rec-trigger:hover{opacity:1;color:#fff;",
      "  text-shadow:0 0 14px rgba(255,255,255,0.45)}",
      "#mg-rec-trigger .dot{opacity:0.55;letter-spacing:0;margin-right:4px}",
      "#mg-rec-chip.on #mg-rec-trigger .dot{opacity:1;color:#f87171;",
      "  text-shadow:0 0 8px rgba(248,113,113,0.6)}",
      "#mg-rec-trigger .chev{font-size:9px;opacity:0.65;letter-spacing:0;",
      "  transition:transform .25s cubic-bezier(.2,.9,.2,1)}",
      "#mg-rec-menu.is-open #mg-rec-trigger .chev{transform:rotate(180deg)}",
      /* Drop UP — same glass as PAGE drop */
      "#mg-rec-drop{",
      "  display:none!important;flex-direction:column;align-items:flex-start;gap:0;",
      "  position:absolute;left:0;bottom:calc(100% + 4px);z-index:2147483647;",
      "  margin:0;padding:8px 0 6px;min-width:168px;",
      "  background:rgba(8,10,14,0.42)!important;",
      "  backdrop-filter:blur(22px) saturate(1.25);",
      "  -webkit-backdrop-filter:blur(22px) saturate(1.25);",
      "  border:1px solid rgba(255,255,255,0.12);border-radius:2px;",
      "  box-shadow:0 -16px 48px rgba(0,0,0,0.28);",
      "  visibility:hidden;opacity:0;pointer-events:none}",
      "html.mg-low-power #mg-rec-drop{",
      "  backdrop-filter:none!important;-webkit-backdrop-filter:none!important;",
      "  background:rgba(8,10,14,0.92)!important}",
      "#mg-rec-menu.is-open #mg-rec-drop{",
      "  display:flex!important;visibility:visible!important;opacity:1!important;",
      "  pointer-events:auto!important}",
      "#mg-rec-drop button{",
      "  appearance:none;cursor:pointer;user-select:none;width:100%;",
      "  display:block;text-align:left;",
      "  padding:9px 14px;margin:0;",
      "  background:transparent!important;border:none!important;box-shadow:none!important;",
      "  color:rgba(255,255,255,0.5);",
      "  font:600 11px/1 system-ui,sans-serif;",
      "  letter-spacing:0.22em;text-transform:uppercase;",
      "  transition:color .12s,background .12s,opacity .12s}",
      "#mg-rec-drop button:hover{color:#fff;background:rgba(255,255,255,0.06)!important}",
      "#mg-rec-drop button.on{color:#fff;",
      "  text-shadow:0 0 10px rgba(255,255,255,0.35)}",
      "#mg-rec-drop button .dot{opacity:0.45;margin-right:8px;letter-spacing:0}",
      "#mg-rec-drop button.on .dot{opacity:0.9}",
      "#mg-rec-drop button#mg-lab-rec.on{color:#fca5a5}",
      "#mg-rec-drop button#mg-lab-draw.on{color:#fecaca}",
      "#mg-rec-drop button#mg-lab-dev.on{color:#93c5fd}",
      "#mg-rec-drop button#mg-lab-agent.on{color:#9fd0ff}",
      "#mg-draw-fab,#mg-agent-desk-fab,#mg-pick-fab{display:none!important}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);

    /* Always remount LAB chip (stale multi-button strips refuse to upgrade otherwise) */
    recBtn = document.getElementById("mg-rec-chip");
    if (recBtn) {
      try {
        recBtn._mgWired = false;
        if (recBtn.parentNode) recBtn.parentNode.removeChild(recBtn);
      } catch (eX) {}
      recBtn = null;
    }
    recBtn = document.createElement("div");
    recBtn.id = "mg-rec-chip";
    /* Exact PAGE menu pattern: . lab ▾  /  . rec · . snap · . draw · . share · . dev · . agent */
    recBtn.innerHTML =
      '<div id="mg-rec-menu" role="navigation" aria-label="Lab tools">' +
      '<button type="button" id="mg-rec-trigger" aria-expanded="false" aria-haspopup="true" aria-controls="mg-rec-drop" title="Lab: rec · snap · draw · share · dev · agent">' +
      '<span class="dot">.</span><span class="lbl">lab</span><span class="chev">▾</span></button>' +
      '<div id="mg-rec-drop" role="menu">' +
      '<button type="button" role="menuitem" id="mg-lab-rec"><span class="dot">.</span>rec</button>' +
      '<button type="button" role="menuitem" id="mg-lab-snap"><span class="dot">.</span>snap</button>' +
      '<button type="button" role="menuitem" id="mg-lab-draw"><span class="dot">.</span>draw</button>' +
      '<button type="button" role="menuitem" id="mg-lab-share"><span class="dot">.</span>share</button>' +
      '<button type="button" role="menuitem" id="mg-lab-dev"><span class="dot">.</span>dev</button>' +
      '<button type="button" role="menuitem" id="mg-lab-agent"><span class="dot">.</span>agent</button>' +
      "</div></div>";
    document.documentElement.appendChild(recBtn);
    wireRecActions();
    bindLabButtons();
    try {
      if (window.__mgBottomChrome && window.__mgBottomChrome.layout) {
        window.__mgBottomChrome.layout();
        bindLabButtons();
      }
    } catch (eBot) {}

    window.__mgRecChip = {
      ver: VER,
      el: recBtn,
      draw: actDraw,
      desk: actDesk,
      openMenu: function () {
        setLabMenuOpen(true);
      },
      closeMenu: function () {
        setLabMenuOpen(false);
      },
      ensure: ensureUi,
      report: function () {
        return (
          VER +
          " chip=" +
          !!document.getElementById("mg-rec-chip") +
          " botLab=" +
          !!document.getElementById("mg-bot-lab") +
          " menu=" +
          !!document.getElementById("mg-rec-menu") +
          " items=rec,snap,draw,share,dev,agent" +
          " deskApi=" +
          !!window.__mgAgentDesk +
          " glass=" +
          !!document.getElementById("mg-row3-glass")
        );
      },
    };
  }

  /* Public API for bottom chrome strip + desk */
  window.__mgSessionRec = window.__mgSessionRec || {};
  window.__mgSessionRec.ver = VER;
  window.__mgSessionRec.labClick = function (id) {
    runRecAction(id || "mg-lab-rec");
  };
  window.__mgSessionRec.bindLabButtons = bindLabButtons;
  window.__mgSessionRec.syncLab = syncDropOnState;
  window.__mgSessionRec.isRecording = function () {
    return !!recording;
  };

  function grabStillPipe() {
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) {
        if (done) return;
        done = true;
        resolve(v);
      }
      setTimeout(function () {
        finish(null);
      }, 900);
      var urls = [
        "http://127.0.0.1:9877/glass.jpg",
        "http://127.0.0.1:9877/live.jpg",
      ];
      var img = new Image();
      img.crossOrigin = "anonymous";
      var i = 0;
      function tryNext() {
        if (done) return;
        if (i >= urls.length) {
          finish(null);
          return;
        }
        var u = urls[i++] + "?t=" + Date.now();
        img.onload = function () {
          if (done) return;
          try {
            var c = document.createElement("canvas");
            c.width = Math.min(640, img.naturalWidth || 640);
            c.height = Math.min(480, img.naturalHeight || 480);
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
            finish({
              kind: "still-pipe",
              dataUrl: c.toDataURL("image/jpeg", 0.72),
              w: c.width,
              h: c.height,
            });
          } catch (e) {
            tryNext();
          }
        };
        img.onerror = tryNext;
        img.src = u;
      }
      tryNext();
    });
  }

  function grabPageSnapshot() {
    return new Promise(function (resolve) {
      try {
        var vid = document.querySelector("video");
        if (vid && vid.videoWidth) {
          var c = document.createElement("canvas");
          c.width = Math.min(960, vid.videoWidth);
          c.height = Math.min(540, vid.videoHeight);
          c.getContext("2d").drawImage(vid, 0, 0, c.width, c.height);
          resolve({
            kind: "page-video",
            dataUrl: c.toDataURL("image/jpeg", 0.7),
            w: c.width,
            h: c.height,
          });
          return;
        }
      } catch (e) {}
      resolve({
        kind: "page-meta",
        href: location.href,
        title: document.title,
        t: Date.now(),
      });
    });
  }

  /** Composite lab frame: WebGrid canvas + float canvases + metrics HUD (like Image #1) */
  function grabLabComposite() {
    return new Promise(function (resolve) {
      try {
        if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
          window.__mgFloatLayout.apply();
      } catch (eL) {}
      try {
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        var vw = window.innerWidth || 1400;
        var vh = window.innerHeight || 900;
        var c = document.createElement("canvas");
        c.width = Math.floor(vw * dpr);
        c.height = Math.floor(vh * dpr);
        var ctx = c.getContext("2d");
        ctx.scale(dpr, dpr);
        ctx.fillStyle = "#f4f5f7";
        ctx.fillRect(0, 0, vw, vh);

        /* 1) page canvases — skip cross-origin tainted (WebGrid site canvas often taints) */
        var canvases = document.querySelectorAll("canvas");
        var drewGame = false;
        for (var i = 0; i < canvases.length; i++) {
          var cv = canvases[i];
          try {
            if (!cv.width || !cv.height) continue;
            var r = cv.getBoundingClientRect();
            if (r.width < 8 || r.height < 8) continue;
            if (r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw) continue;
            /* probe taint without killing whole composite */
            try {
              cv.getContext("2d").getImageData(0, 0, 1, 1);
            } catch (eTaint) {
              /* draw placeholder grid rect for game area */
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(r.left, r.top, r.width, r.height);
              ctx.strokeStyle = "rgba(0,0,0,0.25)";
              ctx.strokeRect(r.left, r.top, r.width, r.height);
              ctx.fillStyle = "rgba(10,132,255,0.95)";
              ctx.fillRect(r.left + r.width * 0.45, r.top + r.height * 0.45, r.width / 30, r.height / 30);
              drewGame = true;
              continue;
            }
            ctx.drawImage(cv, r.left, r.top, r.width, r.height);
            drewGame = true;
          } catch (eC) {}
        }
        if (!drewGame) {
          /* center note when no canvas available */
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.fillRect(vw * 0.3, vh * 0.25, vw * 0.4, vh * 0.45);
          ctx.strokeStyle = "#111";
          ctx.strokeRect(vw * 0.3, vh * 0.25, vw * 0.4, vh * 0.45);
        }

        /* 2) glass float panels as frosted cards + text (metrics readable) */
        var panelIds = [
          "mg-activity-board",
          "mg-mem-maze",
          "mg-geo-float",
          "mg-rubik-float",
          "mg-sports-field",
          "mg-bloch-float",
          "mg-kb-beats",
          "mg-board-toast",
          "mg-rec-chip",
          "mg-board-chip",
        ];
        panelIds.forEach(function (id) {
          var el = document.getElementById(id);
          if (!el || el.classList.contains("hidden")) return;
          try {
            var st = window.getComputedStyle(el);
            if (st.display === "none" || st.visibility === "hidden") return;
            var pr = el.getBoundingClientRect();
            if (pr.width < 20 || pr.height < 16) return;
            ctx.save();
            ctx.fillStyle = "rgba(10,12,16,0.62)";
            ctx.strokeStyle = "rgba(255,255,255,0.2)";
            ctx.lineWidth = 1;
            var rad = 10;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(pr.left, pr.top, pr.width, pr.height, rad);
            else ctx.rect(pr.left, pr.top, pr.width, pr.height);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "rgba(230,240,250,0.95)";
            ctx.font = "600 10px system-ui,sans-serif";
            var text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
            var lines = [];
            var maxChars = Math.max(18, Math.floor(pr.width / 6.2));
            var words = text.split(" ");
            var line = "";
            for (var wi = 0; wi < words.length && lines.length < 14; wi++) {
              var trial = line ? line + " " + words[wi] : words[wi];
              if (trial.length > maxChars) {
                if (line) lines.push(line);
                line = words[wi].slice(0, maxChars);
              } else line = trial;
            }
            if (line) lines.push(line);
            var y = pr.top + 14;
            lines.forEach(function (ln) {
              if (y > pr.top + pr.height - 6) return;
              ctx.fillText(ln.slice(0, maxChars), pr.left + 8, y);
              y += 12;
            });
            ctx.restore();
          } catch (eP) {}
        });

        /* 3) always stamp live metrics HUD (top-left of center) so SNAP ≠ plain WebGrid */
        var metrics = null;
        try {
          if (window.__mgActivityBoard) metrics = window.__mgActivityBoard.collectMetrics();
        } catch (eM) {}
        var w = (metrics && metrics.webgrid) || {};
        var peak =
          w.sessionPeakBps || w.peakBps || w.bestBps || (typeof w.bps === "number" ? w.bps : null);
        var ntpm =
          w.sessionPeakNtpm || w.peakNtpm || w.bestNtpm || (typeof w.ntpm === "number" ? w.ntpm : null);
        var mac =
          metrics && metrics.machine
            ? metrics.machine.label || metrics.machine.model || ""
            : "";
        var syn = "";
        try {
          if (window.__mgActivityBoard && metrics)
            syn = window.__mgActivityBoard.synopsis(metrics);
        } catch (eS) {}
        ctx.save();
        ctx.fillStyle = "rgba(8,10,14,0.72)";
        ctx.fillRect(vw * 0.28, 40, vw * 0.44, 72);
        ctx.strokeStyle = "rgba(120,230,160,0.45)";
        ctx.strokeRect(vw * 0.28, 40, vw * 0.44, 72);
        ctx.fillStyle = "rgba(140,255,190,0.98)";
        ctx.font = "700 13px system-ui,sans-serif";
        ctx.fillText("Memory Glass · SNAP lab metrics", vw * 0.28 + 12, 58);
        ctx.fillStyle = "rgba(244,246,250,0.95)";
        ctx.font = "600 12px ui-monospace,Menlo,monospace";
        ctx.fillText(
          (peak != null ? peak + " BPS" : "— BPS") +
            (ntpm != null ? " · " + ntpm + " NTPM" : "") +
            (w.grid ? " · " + w.grid : "") +
            (mac ? " · " + mac : ""),
          vw * 0.28 + 12,
          78
        );
        ctx.font = "500 10px system-ui,sans-serif";
        ctx.fillStyle = "rgba(200,210,220,0.9)";
        ctx.fillText((syn || location.href || "").slice(0, 90), vw * 0.28 + 12, 96);
        ctx.restore();

        var dataUrl = null;
        try {
          dataUrl = c.toDataURL("image/jpeg", 0.86);
        } catch (eUrl) {
          /* last resort: metrics-only canvas */
          try {
            var c2 = document.createElement("canvas");
            c2.width = 960;
            c2.height = 540;
            var x2 = c2.getContext("2d");
            x2.fillStyle = "#0a0c10";
            x2.fillRect(0, 0, 960, 540);
            x2.fillStyle = "#8fffc0";
            x2.font = "700 22px system-ui";
            x2.fillText("Memory Glass · lab SNAP (metrics)", 40, 60);
            x2.fillStyle = "#f4f6fa";
            x2.font = "600 28px ui-monospace,Menlo,monospace";
            x2.fillText(
              (peak != null ? peak + " BPS" : "—") +
                (ntpm != null ? " · " + ntpm + " NTPM" : ""),
              40,
              120
            );
            x2.font = "500 16px system-ui";
            x2.fillText((mac || "") + " · " + (w.grid || ""), 40, 160);
            x2.fillText((syn || "").slice(0, 80), 40, 200);
            dataUrl = c2.toDataURL("image/jpeg", 0.9);
          } catch (e2) {
            dataUrl = null;
          }
        }
        if (!dataUrl) {
          resolve(null);
          return;
        }
        resolve({
          kind: "lab-composite",
          dataUrl: dataUrl,
          w: c.width,
          h: c.height,
          peakBps: peak,
          peakNtpm: ntpm,
          machine: mac,
          synopsis: syn,
        });
      } catch (eAll) {
        resolve(null);
      }
    });
  }

  function downloadDataUrl(dataUrl, name) {
    try {
      var a = document.createElement("a");
      a.href = dataUrl;
      a.download = name || "mg-lab-snap.jpg";
      (document.body || document.documentElement).appendChild(a);
      a.click();
      setTimeout(function () {
        try {
          a.remove();
        } catch (e) {}
      }, 500);
      return true;
    } catch (e) {
      return false;
    }
  }

  function postSnapToCollector(lab, reason) {
    try {
      var body = JSON.stringify({
        kind: "lab-snap",
        t: Date.now(),
        reason: reason || "manual",
        href: location.href,
        peakBps: lab && lab.peakBps,
        peakNtpm: lab && lab.peakNtpm,
        machine: lab && lab.machine,
        synopsis: lab && lab.synopsis,
        dataUrl: lab && lab.dataUrl,
        w: lab && lab.w,
        h: lab && lab.h,
      });
      /* Prefer native IPC write (auto SNAP has no user-gesture download) */
      try {
        if (window.ipc && window.ipc.postMessage && lab && lab.dataUrl) {
          window.ipc.postMessage(
            JSON.stringify({
              op: "save_lab_snap",
              dataUrl: lab.dataUrl,
              peakBps: lab.peakBps,
              peakNtpm: lab.peakNtpm,
              synopsis: lab.synopsis || "",
              name: "",
            })
          );
        }
      } catch (eI) {}
      try {
        fetch("http://127.0.0.1:9880/snap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          mode: "cors",
        }).catch(function () {});
      } catch (eF) {}
      try {
        if (window.ipc && window.ipc.postMessage) {
          window.ipc.postMessage(
            JSON.stringify({
              op: "dev_log",
              lvl: "ok",
              msg:
                "lab-snap " +
                (lab && lab.peakBps != null ? lab.peakBps + " BPS" : "n/a"),
              src: "rec",
            })
          );
        }
      } catch (eL) {}
    } catch (e) {}
  }

  function snap(reason) {
    /* tile first so SNAP matches non-stack lab layout */
    try {
      if (window.__mgFloatLayout && window.__mgFloatLayout.apply) window.__mgFloatLayout.apply();
      if (window.__mgActivityBoard && !window.__mgActivityBoard.isOpen())
        window.__mgActivityBoard.open();
    } catch (ePre) {}
    return Promise.all([grabStillPipe(), grabPageSnapshot(), grabLabComposite()]).then(
      function (pair) {
        var frame = {
          t: Date.now(),
          reason: reason || "tick",
          still: pair[0],
          page: pair[1],
          lab: pair[2],
          contrail: null,
          bloch: null,
          kbatch: null,
        };
        try {
          if (window.__mgContrail) {
            frame.contrail = {
              phrase: window.__mgContrail.stats && window.__mgContrail.stats.lastPhrase,
              report: window.__mgContrail.report && window.__mgContrail.report(),
              dojo: window.__mgContrail.lastDojo && window.__mgContrail.lastDojo(),
            };
          }
        } catch (e) {}
        try {
          if (window.__mgBlochSolve) {
            frame.bloch = {
              report: window.__mgBlochSolve.report(),
              last: (window.__mgBlochSolve.trials || []).slice(-1)[0] || null,
            };
          }
          if (window.__mgQuantum && window.__mgQuantum.state) {
            frame.bloch = frame.bloch || {};
            frame.bloch.theta = window.__mgQuantum.state.theta;
            frame.bloch.phi = window.__mgQuantum.state.phi;
            frame.bloch.seq = (window.__mgQuantum.state.sequence || []).slice(-12);
          }
        } catch (e2) {}
        try {
          if (window.__mgKbatchDojo && window.__mgKbatchDojo.last) {
            frame.kbatch = window.__mgKbatchDojo.last();
          }
        } catch (e3) {}
        frames.push(frame);
        if (frames.length > 120) frames.shift();
        /* manual SNAP → download lab composite + POST to collector for promo/live */
        if (reason === "manual" || reason === "lab" || reason === "post-play") {
          if (frame.lab && frame.lab.dataUrl) {
            var stamp = new Date().toISOString().replace(/[:.]/g, "-");
            var bps =
              frame.lab.peakBps != null ? String(frame.lab.peakBps).replace(/\./g, "p") : "na";
            downloadDataUrl(
              frame.lab.dataUrl,
              "mg-lab-snap-" + bps + "bps-" + stamp + ".jpg"
            );
            postSnapToCollector(frame.lab, reason);
          }
        }
        log(
          "snap " +
            reason +
            " n=" +
            frames.length +
            (frame.lab && frame.lab.peakBps != null ? " bps=" + frame.lab.peakBps : "")
        );
        return frame;
      }
    );
  }

  function start() {
    if (recording) return;
    recording = true;
    frames = [];
    meta = {
      startedAt: new Date().toISOString(),
      href: location.href,
      ver: VER,
      note: "local pack only — you post to X",
    };
    ensureUi();
    recBtn.classList.add("on");
    try {
      syncDropOnState();
    } catch (eS) {}
    snap("start");
    timer = setInterval(function () {
      snap("tick");
    }, 2500);
    log("REC start");
  }

  function stop() {
    if (!recording) return;
    recording = false;
    if (timer) clearInterval(timer);
    timer = null;
    meta.endedAt = new Date().toISOString();
    meta.frameCount = frames.length;
    if (recBtn) {
      recBtn.classList.remove("on");
      try {
        syncDropOnState();
      } catch (eSt) {}
    }
    var pack = buildPack();
    /* submit run metrics to built-in leaderboard + offer clean post window */
    try {
      if (window.__mgActivityBoard) {
        pack.run = window.__mgActivityBoard.submitRun("rec-stop", {
          rec: { frames: frames.length, meta: meta },
        });
        if (window.__mgActivityBoard.showPostPrompt && pack.run)
          window.__mgActivityBoard.showPostPrompt(pack.run);
      }
    } catch (eB) {}
    persistPack(pack);
    log("REC stop n=" + frames.length + (pack.run ? " score=" + pack.run.score : ""));
    return pack;
  }

  function buildPack() {
    var beats = null;
    try {
      if (window.__mgContrail && window.__mgContrail.exportStoryBeats)
        beats = window.__mgContrail.exportStoryBeats();
    } catch (e) {}
    var metrics = null;
    try {
      if (window.__mgActivityBoard) metrics = window.__mgActivityBoard.collectMetrics();
    } catch (eM) {}
    return {
      schema: "mg-session-pack-v2",
      meta: meta,
      frames: frames.map(function (f) {
        /* strip huge dataUrls for JSONL index; keep last 3 full */
        return f;
      }),
      beats: beats,
      metrics: metrics,
      synopsis: metrics && window.__mgActivityBoard
        ? window.__mgActivityBoard.synopsis(metrics)
        : null,
      blochTrials: (window.__mgBlochSolve && window.__mgBlochSolve.trials
        ? window.__mgBlochSolve.trials.slice(-40)
        : []),
      links: {
        gutter: "https://mueee.qbitos.ai/quantum-gutter.html",
        notepad: "https://mueee.qbitos.ai/quantum-notepad.html",
        r0: "https://mueee.qbitos.ai/ugrad-r0.html",
        blackwell: "https://mueee.qbitos.ai/blackwell.html",
        kbatch: "https://kbatch.ugrad.ai/",
        handoff: "https://kbatch.ugrad.ai/handoff/MEMORY-GLASS-KBATCH.md",
        webgrid: "https://neuralink.com/webgrid/",
      },
    };
  }

  function persistPack(pack) {
    try {
      localStorage.setItem("mg.session.lastPackMeta", JSON.stringify(pack.meta));
      /* full pack may be large — store slim index */
      var slim = {
        meta: pack.meta,
        frameCount: (pack.frames || []).length,
        beats: pack.beats,
        blochTrials: pack.blochTrials,
        links: pack.links,
        lastStill: null,
      };
      var frames = pack.frames || [];
      for (var i = frames.length - 1; i >= 0; i--) {
        if (frames[i].still && frames[i].still.dataUrl) {
          slim.lastStill = frames[i].still.dataUrl.slice(0, 200) + "…";
          break;
        }
      }
      localStorage.setItem("mg.session.lastPackSlim", JSON.stringify(slim));
    } catch (e) {}
    /* Download pack JSON for ~/.panda path via user save */
    try {
      var blob = new Blob([JSON.stringify(pack)], { type: "application/json" });
      var a = document.createElement("a");
      var name =
        "mg-session-" +
        (meta.startedAt || Date.now()).toString().replace(/[:.]/g, "-") +
        ".json";
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      log("pack download " + name + " → move to ~/.panda/mg-soak/record/");
    } catch (e2) {
      log("pack persist fail " + e2);
    }
    /* IPC hint for native save if available */
    try {
      if (window.ipc) {
        window.ipc.postMessage(
          JSON.stringify({
            op: "dev_log",
            lvl: "ok",
            msg: "session pack ready · save to ~/.panda/mg-soak/record/",
            src: "rec",
          })
        );
      }
    } catch (e3) {}
  }

  function exportXDraft() {
    /* Prefer built-in leaderboard: run metrics + synopsis + top board */
    var text = null;
    try {
      if (window.__mgActivityBoard && window.__mgActivityBoard.formatXDraft) {
        if (recording) {
          /* mid-run: snapshot current activity onto board */
          window.__mgActivityBoard.submitRun("rec-live");
        }
        text = window.__mgActivityBoard.formatXDraft({
          fresh: !recording,
          kind: recording ? "rec-live" : "x-draft",
        });
      }
    } catch (eBoard) {}

    if (!text) {
      /* fallback if board not injected yet */
      var pack = recording ? buildPack() : null;
      if (!pack) {
        try {
          pack = {
            meta: JSON.parse(localStorage.getItem("mg.session.lastPackMeta") || "{}"),
            beats:
              window.__mgContrail && window.__mgContrail.exportStoryBeats
                ? window.__mgContrail.exportStoryBeats()
                : null,
          };
        } catch (e) {
          pack = {};
        }
      }
      var lines = [];
      lines.push("Memory Glass · run synopsis (manual post)");
      lines.push("");
      if (pack.meta && pack.meta.startedAt) lines.push("⏱ " + pack.meta.startedAt);
      if (location.href) lines.push("🔗 " + location.href.slice(0, 120));
      try {
        if (window.__mgContrail && window.__mgContrail.report)
          lines.push("🕸 " + window.__mgContrail.report());
      } catch (e) {}
      try {
        if (window.__mgBlochSolve && window.__mgBlochSolve.report)
          lines.push("⚛ " + window.__mgBlochSolve.report());
      } catch (e2) {}
      try {
        if (window.__mgWebgridCalib && window.__mgWebgridCalib.scrapeScore) {
          var sc = window.__mgWebgridCalib.scrapeScore();
          if (sc.bps != null || (sc.peak && sc.peak.bps != null))
            lines.push(
              "🎮 " +
                (sc.peak && sc.peak.bps != null ? sc.peak.bps : sc.bps) +
                " BPS · " +
                (sc.peak && sc.peak.ntpm != null ? sc.peak.ntpm : sc.ntpm) +
                " NTPM"
            );
        }
      } catch (eWg) {}
      lines.push("");
      lines.push("#MemoryGlass #WebGrid #KBatch");
      lines.push("(You post — no auto-post)");
      text = lines.join("\n");
    }

    try {
      if (window.ipc)
        window.ipc.postMessage(JSON.stringify({ op: "clipboard_copy", text: text }));
      else if (navigator.clipboard) navigator.clipboard.writeText(text);
    } catch (e) {}
    log("X draft · metrics+board · you post");
    try {
      alert("X draft (run metrics + leaderboard) copied — you post when ready.");
    } catch (e5) {}
    return text;
  }

  ensureUi();

  /* Self-test DRAW once when ?mg_draw_smoke=1 (agent/live monitor) */
  try {
    if (/[?&]mg_draw_smoke=1\b/i.test(location.search || "")) {
      setTimeout(function () {
        try {
          actDraw();
          var r = {
            t: Date.now(),
            smoke: "draw",
            mini: !!(miniDraw && miniDraw.isActive && miniDraw.isActive()),
            canvasOn: !!(
              document.getElementById("mg-mini-draw-cv") &&
              document.getElementById("mg-mini-draw-cv").classList.contains("on")
            ),
            report: window.__mgRecChip && window.__mgRecChip.report
              ? window.__mgRecChip.report()
              : null,
          };
          window.__mgDrawSmoke = r;
          if (window.ipc)
            window.ipc.postMessage(
              JSON.stringify({ op: "smoke_probe", json: JSON.stringify(r) })
            );
          chipToast("draw smoke " + (r.mini || r.canvasOn ? "PASS" : "FAIL"));
        } catch (eS) {
          chipToast("draw smoke err");
        }
      }, 900);
    }
  } catch (eSm) {}

  /* Auto lab demo ONLY with ?mg_lab_demo=1 — never poll otherwise (lag) */
  var autoSnapDone = {};
  var labDemoOn = false;
  try {
    labDemoOn = /[?&]mg_lab_demo=1\b/i.test(location.search || "");
  } catch (eLab) {}
  function labDemoTick() {
    if (!labDemoOn) return;
    try {
      if (!/[?&]mg_lab_demo=1\b/i.test(location.search || "")) return;
      if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
        window.__mgFloatLayout.apply();
      if (window.__mgActivityBoard && window.__mgActivityBoard.open)
        window.__mgActivityBoard.open();
      var cur = window.__mgAgentPlayLast;
      var bpsLive = null;
      try {
        if (window.__mgWebgridCalib && window.__mgWebgridCalib.scrapeScore) {
          var sc0 = window.__mgWebgridCalib.scrapeScore();
          bpsLive = sc0 && sc0.bps;
        }
      } catch (eS0) {}
      if (cur && cur.bps != null) bpsLive = cur.bps;
      if (cur && cur.kind === "agent_end" && !autoSnapDone.end) {
        autoSnapDone.end = true;
        snap("post-play");
      } else if (!autoSnapDone.mid && bpsLive != null && bpsLive > 15) {
        autoSnapDone.mid = true;
        snap("lab");
      }
    } catch (eD) {}
  }
  if (labDemoOn) setInterval(labDemoTick, 1200);
  setTimeout(function () {
    try {
      if (labDemoOn && /[?&]mg_lab_demo=1\b/i.test(location.search || "")) {
        function afterOpen() {
          try {
            if (window.__mgActivityBoard) {
              window.__mgActivityBoard.mergeFleetSeed &&
                window.__mgActivityBoard.mergeFleetSeed();
              window.__mgActivityBoard.open();
            }
            if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
              window.__mgFloatLayout.apply();
            /* first SNAP after layout — always (metrics board open) */
            setTimeout(function () {
              snap("lab");
            }, 400);
          } catch (eA) {}
        }
        if (window.__mgFloatLayout && window.__mgFloatLayout.openSequentially) {
          window.__mgFloatLayout
            .openSequentially({ delayMs: 420 })
            .then(afterOpen)
            .catch(afterOpen);
        } else {
          if (window.__mgActivityBoard) window.__mgActivityBoard.open();
          afterOpen();
        }
      }
    } catch (eO) {}
  }, 900);

  window.__mgSessionRec = {
    ver: VER,
    start: start,
    stop: stop,
    snap: snap,
    exportXDraft: exportXDraft,
    labClick: function (id) {
      runRecAction(id || "mg-lab-rec");
    },
    bindLabButtons: bindLabButtons,
    syncLab: syncDropOnState,
    isRecording: function () {
      return recording;
    },
    report: function () {
      return (
        VER +
        " rec=" +
        recording +
        " frames=" +
        frames.length +
        " botLab=" +
        !!document.getElementById("mg-bot-lab")
      );
    },
  };

  log(VER + " · bot lab strip · SNAP · X draft");
})();
