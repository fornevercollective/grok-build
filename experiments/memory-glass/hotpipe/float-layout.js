/* Memory Glass · float layout (play-safe, no force-open)
 * Only positions panels that are ALREADY open. Never un-hides closed floats.
 * Does not auto-open the lab on launch.
 * Respects html.mg-drawer-mode (TOOLS drawer owns chrome — no forced CTRL pill).
 * VER: float-layout-v14-drawer-chrome
 */
(function () {
  "use strict";
  var VER = "float-layout-v17-playperf";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._floatLayoutVer === VER) return;
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

  function isBoardCollapsed() {
    try {
      if (window.__mgActivityBoard && window.__mgActivityBoard.isCollapsed)
        return !!window.__mgActivityBoard.isCollapsed();
    } catch (e) {}
    var el = document.getElementById("mg-activity-board");
    return !!(el && el.classList && el.classList.contains("collapsed") && isVisible(el));
  }

  function slots() {
    var w = window.innerWidth || 1400;
    var h = window.innerHeight || 900;
    var m = 12;
    var top = 48;
    var recH = 48;
    var bottom = recH + 8;
    var narrow = w < 900;
    var hideOrbs = w < 700;
    var leftRail = Math.min(narrow ? 240 : 280, Math.floor(w * (narrow ? 0.28 : 0.2)));
    var rightRail = Math.min(narrow ? 280 : 320, Math.floor(w * 0.24));
    var gap = 8;
    var boardCollapsed = isBoardCollapsed();
    var boardH = boardCollapsed ? 48 : Math.min(280, Math.floor(h * 0.32));

    /* right column budget: everything below LIVE RANK pill/panel */
    var rightTop = top + boardH + gap;
    var rightBudget = Math.max(180, h - rightTop - bottom - gap * 3);
    var fieldOpen = isVisible(document.getElementById("mg-sports-field"));
    var beatsOpen = isVisible(document.getElementById("mg-kb-beats"));
    var kbOpen = isVisible(document.getElementById("mg-float-kb"));
    var openN = (fieldOpen ? 1 : 0) + (beatsOpen ? 1 : 0) + (kbOpen ? 1 : 0);

    var kbH, beatsH, fieldH;
    if (boardCollapsed) {
      /* more room for field/beats when board is pill */
      kbH = Math.min(200, Math.floor(rightBudget * (kbOpen && openN === 1 ? 0.55 : 0.28)));
      beatsH = Math.min(200, Math.floor(rightBudget * (beatsOpen && openN === 1 ? 0.55 : 0.3)));
      fieldH = Math.min(320, Math.floor(rightBudget * (fieldOpen && openN === 1 ? 0.7 : 0.38)));
    } else {
      kbH = Math.min(160, Math.floor(rightBudget * 0.26));
      beatsH = Math.min(160, Math.floor(rightBudget * 0.28));
      fieldH = Math.min(220, Math.floor(rightBudget * 0.36));
    }
    /* never overflow budget */
    var sum = (fieldOpen ? fieldH : 0) + (beatsOpen ? beatsH : 0) + (kbOpen ? kbH : 0);
    if (sum > rightBudget && sum > 0) {
      var scale = rightBudget / sum;
      fieldH = Math.floor(fieldH * scale);
      beatsH = Math.floor(beatsH * scale);
      kbH = Math.floor(kbH * scale);
    }

    /* Play stack: Field · Beats · Keyboard share one width + matched tile heights */
    var stackW = Math.min(narrow ? 340 : 380, Math.floor(w * (narrow ? 0.4 : 0.3)));
    var fieldW = stackW;
    var playN = (fieldOpen ? 1 : 0) + (beatsOpen ? 1 : 0) + (kbOpen ? 1 : 0);
    if (playN >= 2) {
      /* equal-ish tiles so go/chess/webgrid pad matches beats pad */
      var tile = Math.floor(Math.min(220, rightBudget / playN - gap));
      tile = Math.max(140, tile);
      if (fieldOpen) fieldH = tile + 24; /* field gets a bit more for canvas */
      if (beatsOpen) beatsH = tile;
      if (kbOpen) kbH = Math.min(tile + 80, 320); /* keyboard needs key rows */
      var sum2 = (fieldOpen ? fieldH : 0) + (beatsOpen ? beatsH : 0) + (kbOpen ? kbH : 0);
      if (sum2 > rightBudget && sum2 > 0) {
        var sc2 = rightBudget / sum2;
        fieldH = Math.floor(fieldH * sc2);
        beatsH = Math.floor(beatsH * sc2);
        kbH = Math.floor(kbH * sc2);
      }
    }
    var kbBottom = bottom;
    var beatsBottom = kbBottom + (kbOpen ? kbH + gap : 0);
    var fieldBottom = beatsBottom + (beatsOpen ? beatsH + gap : 0);

    /* CTRL is top-left — measure so floats sit BELOW it, never under the panel */
    var belowCtrl = top;
    var ctrlW = 0;
    try {
      var capEl0 = document.getElementById("mg-glass-cap");
      if (capEl0) {
        var cr = capEl0.getBoundingClientRect();
        if (cr.height > 0) {
          belowCtrl = Math.max(top, Math.round(cr.bottom) + gap + 4);
          ctrlW = Math.round(cr.width) || 0;
        }
      }
    } catch (eC) {}
    var blochOpen = isVisible(document.getElementById("mg-bloch-float"));
    var rubikOpen = isVisible(document.getElementById("mg-rubik-float"));
    var blochW = Math.min(280, Math.max(leftRail + 8, Math.floor(w * 0.2)));
    var blochH = Math.min(
      blochOpen ? 300 : 240,
      Math.max(180, Math.floor(h - belowCtrl - bottom - 80))
    );
    var rubikTop = belowCtrl + (blochOpen ? blochH + gap : 0);
    /* orbs: bottom-left stack (above REC), clear of expanded CTRL */
    var orbBase = bottom + 52;
    var orbBlochBottom = orbBase + 8;
    var orbRubikBottom = orbBlochBottom + 58;

    return {
      maze: {
        left: m,
        top: Math.max(top, belowCtrl + (blochOpen || rubikOpen ? 0 : 0)),
        width: leftRail,
        maxHeight: Math.min(280, Math.floor(h * 0.28)),
        minHeight: 140,
      },
      geo: {
        left: m,
        top: Math.max(
          belowCtrl + (blochOpen ? blochH + gap : 0) + (rubikOpen ? 200 : 0),
          top + Math.min(300, Math.floor(h * 0.32))
        ),
        width: leftRail + 10,
        maxHeight: Math.min(220, Math.floor(h * 0.24)),
        minHeight: 120,
      },
      board: boardCollapsed
        ? {
            /* shell top word — left of INSPECT/PAGE, no glass pill pin */
            right: null,
            top: null,
            skipPin: true,
          }
        : {
            right: m,
            top: top,
            width: rightRail,
            maxHeight: boardH,
            minHeight: 140,
          },
      rubik: {
        left: m,
        top: rubikTop,
        width: Math.min(320, Math.max(blochW, Math.floor(w * 0.22))),
        maxHeight: Math.min(340, Math.floor(h - rubikTop - bottom - 24)),
        minHeight: 200,
      },
      field: {
        right: m,
        bottom: fieldBottom,
        width: fieldW,
        maxHeight: fieldH,
        minHeight: Math.min(160, fieldH),
        height: fieldH,
      },
      beats: {
        right: m,
        bottom: beatsBottom,
        width: stackW,
        maxHeight: beatsH,
        minHeight: Math.min(120, beatsH),
        height: beatsH,
      },
      keyboard: {
        right: m,
        bottom: kbBottom,
        width: stackW,
        maxHeight: kbH,
        minHeight: Math.min(120, kbH),
        height: kbH,
      },
      /* Bloch: directly under measured CTRL (top-left), not buried mid-rail */
      bloch: {
        left: m,
        top: belowCtrl,
        width: blochW,
        maxHeight: blochH,
        minHeight: 200,
        height: blochOpen ? blochH : undefined,
      },
      /* Orbs bottom-left — clear of top CTRL */
      blochOrb: hideOrbs
        ? { left: -999, bottom: -999, width: 52, height: 52, hide: true }
        : { left: m, bottom: orbBlochBottom, width: 52, height: 52 },
      rubikOrb: hideOrbs
        ? { left: -999, bottom: -999, width: 52, height: 52, hide: true }
        : { left: m, bottom: orbRubikBottom, width: 52, height: 52 },
      belowCtrl: belowCtrl,
      ctrlW: ctrlW,
      raider: {
        left: Math.max(m + leftRail + gap, Math.floor(w * 0.22)),
        top: top,
        width: Math.min(720, Math.floor(w * 0.52)),
        maxHeight: Math.min(520, Math.floor(h * 0.58)),
        minHeight: 280,
      },
      post: {
        right: rightRail + m + 8,
        top: top + (boardCollapsed ? 56 : boardH + 8),
        width: Math.min(280, Math.floor(w * 0.22)),
      },
      rec: { left: m, bottom: m },
      /* Control Center — top-left pill / panel (not bottom; search owns bottom) */
      capsule: {
        left: m,
        top: Math.max(10, 8),
        width: Math.min(340, Math.floor(w * 0.32)),
        maxHeight: Math.min(620, Math.floor(h * 0.72)),
        pill: true,
      },
      narrow: narrow,
      hideOrbs: hideOrbs,
    };
  }

  function pin(el, slot, opts) {
    if (!el || !slot || !isVisible(el)) return false;
    opts = opts || {};
    /* drawer-embedded panels own their layout */
    if (el.classList && el.classList.contains("mg-embedded")) return false;
    if (el.closest && el.closest("#mg-tools-drawer,#mg-right-drawer,#mg-drawer-kb-host,#mg-drawer-beats-host,#mg-drawer-mkt-host"))
      return false;
    /* beats stay off center canvas unless user pop-out */
    if (el.id === "mg-kb-beats" && !el.classList.contains("mg-popout")) return false;
    if (slot.skipPin) return false;
    if (slot.hide) {
      el.style.visibility = "hidden";
      el.style.pointerEvents = "none";
      return false;
    }
    el.style.visibility = "visible";
    el.style.pointerEvents = "auto";
    el.style.position = "fixed";
    /* stay under shell chrome but above page; do NOT all share max z */
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
    if (slot.width != null) {
      el.style.width = slot.width + "px";
      el.style.maxWidth = slot.width + "px";
    }
    if (slot.pill) {
      el.style.minHeight = "0";
      el.style.height = "auto";
      el.style.maxHeight = (slot.maxHeight || 48) + "px";
      el.style.overflow = "hidden";
      el.style.boxSizing = "border-box";
      return true;
    }
    if (slot.minHeight != null) el.style.minHeight = slot.minHeight + "px";
    if (slot.maxHeight != null) {
      el.style.maxHeight = slot.maxHeight + "px";
      el.style.overflowX = "hidden";
      el.style.overflowY = "auto";
      el.style.boxSizing = "border-box";
    } else {
      el.style.overflow = "visible";
    }
    if (slot.height != null) el.style.height = slot.height + "px";
    return true;
  }

  /** Close heavy lab panels that pile on the playfield (keep play stack optional) */
  function closeHeavy(opts) {
    opts = opts || {};
    try {
      if (window.__mgMemoryMaze && window.__mgMemoryMaze.close) window.__mgMemoryMaze.close();
      if (window.__mgGeoPattern && window.__mgGeoPattern.close) window.__mgGeoPattern.close();
      /* keep Rubik closed only when clearing lab — caller may re-open */
      if (window.__mgRubikLang && window.__mgRubikLang.close && !opts.keepRubik)
        window.__mgRubikLang.close();
      if (window.__mgBlochSolve && window.__mgBlochSolve.close) window.__mgBlochSolve.close();
      if (window.__mgRaider && window.__mgRaider.close) window.__mgRaider.close();
      if (window.__mgCollabDay && window.__mgCollabDay.close) window.__mgCollabDay.close();
      if (!opts.keepPlay) {
        if (window.__mgSportsField && window.__mgSportsField.close) window.__mgSportsField.close();
        if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.close)
          window.__mgKeyboardBeats.close();
        if (window.__mgFloatKb && window.__mgFloatKb.close) window.__mgFloatKb.close();
      }
      if (opts.boardPill && window.__mgActivityBoard) {
        if (window.__mgActivityBoard.open)
          window.__mgActivityBoard.open({ collapsed: true });
        else if (window.__mgActivityBoard.collapse) window.__mgActivityBoard.collapse();
      }
      if (opts.ctrlPill && window.__mgGlassCap && window.__mgGlassCap.close)
        window.__mgGlassCap.close();
      /* ensure CTRL pill remains findable after collapse — unless drawer owns chrome */
      var capEl = document.getElementById("mg-glass-cap");
      if (capEl && !drawerMode()) {
        capEl.style.display = "flex";
        capEl.style.visibility = "visible";
        capEl.style.opacity = "1";
        capEl.style.pointerEvents = "auto";
        capEl.classList.add("collapsed");
      } else if (capEl && drawerMode()) {
        capEl.style.setProperty("display", "none", "important");
        capEl.classList.add("collapsed");
      }
    } catch (e) {}
    try {
      apply();
    } catch (eA) {}
  }

  function drawerMode() {
    try {
      return document.documentElement.classList.contains("mg-drawer-mode");
    } catch (e) {
      return false;
    }
  }

  function isPlayHot() {
    try {
      if (window.__mgWebgridPlayBusy) return true;
      if (document.documentElement.classList.contains("mg-webgrid-playing"))
        return true;
    } catch (e) {}
    return false;
  }

  function apply(force) {
    /* Freeze geometry mid-WebGrid run — re-pinning was the shake */
    if (isPlayHot() && !force) return 0;
    var s = slots();
    var n = 0;
    /* 1) CTRL first so Bloch/Rubik can sit under its real bottom edge.
     * Drawer mode: TOOLS drawer owns chrome — never force-show the CTRL pill. */
    var cap = document.getElementById("mg-glass-cap");
    if (cap && drawerMode()) {
      cap.style.setProperty("display", "none", "important");
      cap.style.setProperty("pointer-events", "none", "important");
      cap.style.visibility = "hidden";
    } else if (cap) {
      var capSlot = {
        left: s.capsule.left,
        top: s.capsule.top,
        width: cap.classList.contains("collapsed") ? null : s.capsule.width,
        maxHeight: cap.classList.contains("collapsed")
          ? 44
          : s.capsule.maxHeight,
        pill: cap.classList.contains("collapsed"),
      };
      cap.style.display = "flex";
      cap.style.visibility = "visible";
      cap.style.opacity = "1";
      cap.style.pointerEvents = "auto";
      cap.style.bottom = "auto";
      pin(cap, capSlot, { z: 2147483004 });
      cap.style.transform = "none";
      if (cap.classList.contains("collapsed")) {
        cap.style.minHeight = "40px";
        cap.style.height = "auto";
        cap.style.width = "auto";
        cap.style.minWidth = "88px";
      }
      n++;
    }
    /* 2) recompute slots after CTRL is placed (belowCtrl uses getBoundingClientRect) */
    s = slots();
    if (pin(document.getElementById("mg-mem-maze"), s.maze, { z: 2147482995 })) n++;
    if (pin(document.getElementById("mg-geo-float"), s.geo, { z: 2147482994 })) n++;
    if (pin(document.getElementById("mg-activity-board"), s.board, { z: 2147482993 })) n++;
    /* Bloch / Rubik stack under CTRL top-left */
    if (pin(document.getElementById("mg-bloch-float"), s.bloch, { z: 2147482998 })) n++;
    if (pin(document.getElementById("mg-rubik-float"), s.rubik, { z: 2147482997 })) n++;
    if (pin(document.getElementById("mg-bloch-orb"), s.blochOrb, { z: 2147482985 })) n++;
    if (pin(document.getElementById("mg-rubik-orb"), s.rubikOrb, { z: 2147482985 })) n++;
    if (pin(document.getElementById("mg-raider-stage"), s.raider, { z: 2147482988 })) n++;
    if (pin(document.getElementById("mg-sports-field"), s.field, { z: 2147482992 })) n++;
    if (pin(document.getElementById("mg-kb-beats"), s.beats, { z: 2147482993 })) n++;
    if (pin(document.getElementById("mg-float-kb"), s.keyboard, { z: 2147483003 })) n++;
    var post =
      document.getElementById("mg-board-toast") ||
      document.getElementById("mg-board-post-toast");
    /* Toast manages its own top-right placement + max z — never re-pin (blocked DISMISS) */
    if (post && isVisible(post) && post.id !== "mg-board-toast")
      pin(post, s.post, { z: 2147483010 });
    if (post && post.id === "mg-board-toast" && isVisible(post)) {
      post.style.zIndex = "2147483647";
      post.style.pointerEvents = "auto";
    }
    var rec = document.getElementById("mg-rec-chip");
    if (rec && isVisible(rec)) pin(rec, s.rec, { z: 2147483006 });
    /* Search dock: bottom-center only — peek dots, bar closed until user */
    var dock = document.getElementById("mg-search-dock");
    if (dock) {
      dock.style.position = "fixed";
      dock.style.left = "50%";
      dock.style.right = "auto";
      dock.style.top = "auto";
      dock.style.bottom =
        "calc(max(12px, env(safe-area-inset-bottom,0px)) + var(--mg-kb-h, 0px))";
      dock.style.transform = "translateX(-50%)";
      dock.style.zIndex = "2147483608";
      /* closed unless user explicitly opened search this session */
      if (!window.__mgUserSearchOpen) {
        dock.classList.remove("is-open");
        dock.classList.remove("chat-open");
      }
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
          /* pill by default — does not cover Field/Beats */
          if (window.__mgActivityBoard.open)
            window.__mgActivityBoard.open({ collapsed: true });
        }
      },
    },
    {
      id: "beats",
      label: "BEATS",
      run: function () {
        /* open Keys drawer stack — not canvas float (use popOut for float) */
        try {
          if (window.__mgToolsDrawer) {
            if (window.__mgToolsDrawer.setMode) window.__mgToolsDrawer.setMode("keys");
            if (window.__mgToolsDrawer.open) window.__mgToolsDrawer.open();
          }
        } catch (eB) {}
      },
    },
    /* Field / Bloch panel / GEO / Rubik: manual only via CTRL */
  ];

  /** Lean lab kit: Beats · Maze · Board pill · Contrail — no Field/Bloch/GEO stack */
  function openLabKit() {
    try {
      if (window.__mgContrail) {
        if (window.__mgContrail.setOverlay) window.__mgContrail.setOverlay(true);
        if (window.__mgContrail.setFlow) window.__mgContrail.setFlow(true);
      }
      if (window.__mgMemoryMaze) window.__mgMemoryMaze.open();
      /* beats: drawer only unless user popOut — do not open canvas float */
      if (window.__mgActivityBoard) {
        if (window.__mgActivityBoard.mergeFleetSeed)
          window.__mgActivityBoard.mergeFleetSeed();
        window.__mgActivityBoard.open({ collapsed: true });
      }
      /* keep Bloch float / Field / GEO / Rubik closed — orbs only */
      if (window.__mgBlochSolve && window.__mgBlochSolve.setEnabled)
        window.__mgBlochSolve.setEnabled(true);
      apply();
      log(VER + " · lab kit lean (maze·board-pill·contrail · beats in Keys drawer)");
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
    closeHeavy({ keepPlay: false, boardPill: true, ctrlPill: true });
    try {
      if (window.__mgFloatKb && window.__mgFloatKb.close) window.__mgFloatKb.close();
      if (window.__mgRaider && window.__mgRaider.close) window.__mgRaider.close();
      if (window.__mgActivityBoard && window.__mgActivityBoard.close)
        window.__mgActivityBoard.close();
      /* reopen board as pill so LIVE RANK stays findable */
      if (window.__mgActivityBoard && window.__mgActivityBoard.open)
        window.__mgActivityBoard.open({ collapsed: true });
      /* collapse search dock */
      var dock = document.getElementById("mg-search-dock");
      if (dock) {
        dock.classList.remove("is-open");
        dock.classList.remove("chat-open");
      }
      /* force keyboard fully gone */
      var kb = document.getElementById("mg-float-kb");
      if (kb) {
        kb.classList.add("hidden");
        kb.classList.remove("mg-menu-open");
        kb.style.display = "none";
      }
      try {
        document.documentElement.style.setProperty("--mg-kb-h", "0px");
      } catch (eK) {}
    } catch (e) {}
    try {
      apply();
    } catch (eA) {}
    log(VER + " · closeAll · clear stack");
  }

  /** Matched play stack: Field + Beats + optional Keyboard, same width */
  function openPlayStack(opts) {
    opts = opts || {};
    closeHeavy({ keepPlay: true, boardPill: true, ctrlPill: true });
    try {
      if (window.__mgSportsField) {
        window.__mgSportsField.open();
        if (opts.mode && window.__mgSportsField.setMode)
          window.__mgSportsField.setMode(opts.mode);
      }
      /* beats float only on explicit popOut — Keys drawer is home */
      if (opts.beatsPopOut && window.__mgKeyboardBeats && window.__mgKeyboardBeats.popOut)
        window.__mgKeyboardBeats.popOut();
      if (opts.keyboard && window.__mgFloatKb) {
        if (window.__mgFloatKb.launch)
          window.__mgFloatKb.launch({
            mode: opts.kbMode || "codec",
            codec: opts.codec || "hex",
          });
        else window.__mgFloatKb.open();
      }
      if (window.__mgActivityBoard)
        window.__mgActivityBoard.open({ collapsed: true });
      apply();
      log(VER + " · play stack field" + (opts.beatsPopOut ? "+beats-pop" : "") + (opts.keyboard ? "+kb" : ""));
      return true;
    } catch (e) {
      log("play stack err " + e);
      return false;
    }
  }

  window.addEventListener("resize", function () {
    try {
      if (isPlayHot()) return; /* freeze during play */
      apply();
    } catch (e) {}
  });

  /* On load: reflow open panels; lab kit only on explicit mg_lab_full */
  setTimeout(function () {
    try {
      apply();
    } catch (eA) {}
  }, 800);

  setTimeout(function () {
    try {
      /* PRODUCT: no auto lab parade on WebGrid — causes shake/lag.
         Only ?mg_lab_full=1 opens the kit. mg_lab_demo no longer auto-stacks. */
      if (/[?&]mg_lab_full=1\b/i.test(location.search || "")) {
        openLabKit();
      }
      /* else: product-mode + playperf own lean chrome */
    } catch (eD) {}
  }, 1100);

  window.__mgFloatLayout = {
    ver: VER,
    apply: apply,
    openLabKit: openLabKit,
    openSequentially: openSequentially,
    openPlayStack: openPlayStack,
    closeAll: closeAll,
    closeHeavy: closeHeavy,
    slots: slots,
    report: function () {
      return VER + " busy=" + seqBusy;
    },
  };

  /* Boot: clear any leftover stack from prior hot-reload / exercise */
  setTimeout(function () {
    try {
      closeHeavy({ keepPlay: false, boardPill: true, ctrlPill: true });
    } catch (eB) {}
  }, 600);

  log(VER + " · play-stack layout · closeAll clears pile-up");
})();

/* product-mode lives ONLY in product-mode.js (injected after float-layout).
 * Do NOT inline product-mode here — an older copy was winning the version guard
 * and re-collapsing CTRL / closing keyboard every 0.9–3.2s. */

/* === kbatch fleet R4 (also main.rs inject when rebuilt) === */
/* Memory Glass · kbatch fleet bridge (R4-data)
 * Surfaces kbatch.ugrad.ai axes + living-books links into LIVE RANK / CTRL.
 * Offline seed: hotpipe/data/kbatch-r4-axes.json (injected as window.__mgKbatchR4Seed if present).
 * VER: kbatch-fleet-v1-r4
 */
(function () {
  "use strict";
  var VER = "kbatch-fleet-v1-r4";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._kbatchFleetVer === VER) return;
  HP._kbatchFleetVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "kbatch-fleet");
    } catch (e) {}
  }

  /* Embedded snapshot (keep in sync with data/kbatch-r4-axes.json) */
  var SEED = {
    ver: "kbatch-r4-data-2026-07-18",
    rung: "R4-data",
    smoke: { pass: 50, fail: 0 },
    metrics: {
      d5Glosses: 6199,
      senseEntries: 6202,
      worldAnalyzedLangs: 32,
      worldAnalyzedWordsApprox: 775000,
    },
    axes: {
      dictionaries: { score: 0.9, dial: "D5-10k+" },
      schools: { score: 0.81, dial: "S2-live" },
      museums: { score: 0.8, dial: "M3.5-kits-17" },
      typing: { score: 0.84, dial: "T3-local-board" },
      music: { score: 0.82, dial: "R4-staff-catalogue" },
    },
    links: {
      home: "https://kbatch.ugrad.ai/",
      livingBooks: "https://kbatch.ugrad.ai/labs/living-books.html",
      learn: "https://kbatch.ugrad.ai/learn",
      dojo: "https://kbatch.ugrad.ai/dojo/",
      milestone: "https://kbatch.ugrad.ai/docs/MILESTONE-R4-DATA.md",
    },
  };

  var state = {
    seed: SEED,
    live: null,
    lastFetch: 0,
  };

  if (window.__mgKbatchR4Seed && typeof window.__mgKbatchR4Seed === "object") {
    try {
      state.seed = Object.assign({}, SEED, window.__mgKbatchR4Seed);
    } catch (eS) {}
  }

  function snap() {
    return state.live || state.seed;
  }

  function minAxis(s) {
    s = s || snap();
    var axes = s.axes || {};
    var min = 1;
    Object.keys(axes).forEach(function (k) {
      var v = axes[k] && axes[k].score;
      if (typeof v === "number" && v < min) min = v;
    });
    return min;
  }

  function report() {
    var s = snap();
    var a = s.axes || {};
    return (
      VER +
      " · " +
      (s.rung || "?") +
      " · D5 " +
      ((s.metrics && s.metrics.d5Glosses) || "?") +
      " · langs " +
      ((s.metrics && s.metrics.worldAnalyzedLangs) || "?") +
      " · dict " +
      (a.dictionaries ? a.dictionaries.score : "?") +
      " · minAxis " +
      minAxis(s).toFixed(2) +
      " · smoke " +
      (s.smoke ? s.smoke.pass + "/" + (s.smoke.pass + s.smoke.fail) : "?")
    );
  }

  function synopsisLine() {
    var s = snap();
    var m = s.metrics || {};
    return (
      "kbatch " +
      (s.rung || "R4") +
      " · glosses " +
      (m.d5Glosses || "—") +
      " · senses " +
      (m.senseEntries || "—") +
      " · " +
      (m.worldAnalyzedLangs || "—") +
      " langs · axes≥" +
      minAxis(s).toFixed(2)
    );
  }

  function nav(url) {
    try {
      if (window.ipc)
        window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
      else window.open(url, "_blank");
    } catch (e) {
      try {
        window.open(url, "_blank");
      } catch (e2) {}
    }
  }

  function openLivingBooks() {
    nav((snap().links && snap().links.livingBooks) || SEED.links.livingBooks);
  }
  function openLearn() {
    nav((snap().links && snap().links.learn) || SEED.links.learn);
  }
  function openDojo() {
    nav((snap().links && snap().links.dojo) || SEED.links.dojo);
  }
  function openHome() {
    nav((snap().links && snap().links.home) || SEED.links.home);
  }

  /** Optional live scrape when already on kbatch.ugrad.ai */
  function scrapeLive() {
    try {
      if (!/kbatch\.ugrad\.ai$/i.test(location.hostname || "")) return null;
      var meta = {};
      document.querySelectorAll("meta[name^='kbatch-']").forEach(function (m) {
        meta[m.getAttribute("name")] = m.getAttribute("content");
      });
      if (!meta["kbatch-version"] && !meta["kbatch-product"]) return null;
      state.live = Object.assign({}, state.seed, {
        kbatchVersion: meta["kbatch-version"] || state.seed.kbatchVersion,
        product: meta["kbatch-product"] || state.seed.product,
        scrapedAt: Date.now(),
        host: location.hostname,
      });
      state.lastFetch = Date.now();
      return state.live;
    } catch (e) {
      return null;
    }
  }

  setTimeout(scrapeLive, 600);
  setInterval(scrapeLive, 15000);

  window.__mgKbatchFleet = {
    ver: VER,
    snap: snap,
    report: report,
    synopsis: synopsisLine,
    minAxis: minAxis,
    openLivingBooks: openLivingBooks,
    openLearn: openLearn,
    openDojo: openDojo,
    openHome: openHome,
    scrapeLive: scrapeLive,
  };

  log(VER + " · " + report());
})();

/* === lang-codec-plane (hot reload; main.rs injects when rebuilt) === */
/* Memory Glass · Language Codec Powerhouse
 * ASCII · HEX · Binary · PCAP-lite · QuantumGutter · QbitCodec · StenoSTRIP · Glyph · GrokYtalkY
 * Standalone + keyboard plane · builds on concepts/qbit-codec.js + kbatch glyph/steno
 * VER: lang-codec-plane-v1
 */
(function () {
  "use strict";
  var VER = "lang-codec-plane-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._langCodecVer === VER) return;
  HP._langCodecVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "lang-codec");
    } catch (e) {}
  }

  /* ── Quantum gutter / prefix symbols (beyondBINARY · qbit) ── */
  var GUTTER_SYM = [
    "n:",
    "+1:",
    "-n:",
    "+0:",
    "0:",
    "-1:",
    "+n:",
    "+2:",
    "-0:",
    "+3:",
    "1:",
  ];
  var GUTTER_GATES = [
    "SWAP",
    "H",
    "M",
    "Rz",
    "I",
    "X",
    "T",
    "CZ",
    "S",
    "Y",
    "CNOT",
  ];

  /* ── StenoSTRIP 13-space alphabet (kbatch / qbit-codec) ── */
  var STENO_SPACES = [
    "\u0020",
    "\u00A0",
    "\u2000",
    "\u2001",
    "\u2002",
    "\u2003",
    "\u2004",
    "\u2005",
    "\u2006",
    "\u2007",
    "\u2008",
    "\u2009",
    "\u200A",
  ];
  var STENO_TO_IDX = {};
  STENO_SPACES.forEach(function (c, i) {
    STENO_TO_IDX[c] = i;
  });

  /* ── GrokYtalkY glyph header (kbatch gy) ── */
  var GY_MAGIC = "gyg1";

  function utf8Bytes(str) {
    try {
      return Array.from(new TextEncoder().encode(String(str || "")));
    } catch (e) {
      var a = [];
      for (var i = 0; i < str.length; i++) a.push(str.charCodeAt(i) & 0xff);
      return a;
    }
  }

  function utf8FromBytes(bytes) {
    try {
      return new TextDecoder().decode(new Uint8Array(bytes));
    } catch (e) {
      return String.fromCharCode.apply(null, bytes);
    }
  }

  /* ══════════════ ASCII ══════════════ */
  function toAsciiCodes(text) {
    var s = String(text || "");
    var codes = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      codes.push(c <= 127 ? c : 63); /* non-ASCII → ? */
    }
    return codes;
  }

  function fromAsciiCodes(codes) {
    return codes
      .map(function (c) {
        return String.fromCharCode(c & 0x7f);
      })
      .join("");
  }

  function asciiView(text) {
    var codes = toAsciiCodes(text);
    return {
      format: "ascii",
      text: text,
      codes: codes,
      display: codes
        .map(function (c) {
          return ("00" + c).slice(-3);
        })
        .join(" "),
      printable: codes
        .map(function (c) {
          return c >= 32 && c < 127 ? String.fromCharCode(c) : "·";
        })
        .join(""),
    };
  }

  /* ══════════════ HEX ══════════════ */
  function toHex(text, sep) {
    sep = sep == null ? " " : sep;
    return utf8Bytes(text)
      .map(function (b) {
        return ("0" + b.toString(16)).slice(-2);
      })
      .join(sep);
  }

  function fromHex(hex) {
    var clean = String(hex || "").replace(/[^0-9a-fA-F]/g, "");
    if (clean.length % 2) clean = "0" + clean;
    var bytes = [];
    for (var i = 0; i < clean.length; i += 2)
      bytes.push(parseInt(clean.slice(i, i + 2), 16));
    return utf8FromBytes(bytes);
  }

  function hexView(text) {
    var hex = toHex(text, " ");
    return {
      format: "hex",
      text: text,
      hex: hex,
      display: hex,
      bytes: utf8Bytes(text).length,
    };
  }

  /* ══════════════ BINARY ══════════════ */
  function toBinary(text, group) {
    group = group == null ? 8 : group;
    var bits = utf8Bytes(text)
      .map(function (b) {
        return ("00000000" + b.toString(2)).slice(-8);
      })
      .join("");
    if (group > 0) {
      var out = [];
      for (var i = 0; i < bits.length; i += group)
        out.push(bits.slice(i, i + group));
      return out.join(" ");
    }
    return bits;
  }

  function fromBinary(bin) {
    var clean = String(bin || "").replace(/[^01]/g, "");
    while (clean.length % 8) clean = "0" + clean;
    var bytes = [];
    for (var i = 0; i < clean.length; i += 8)
      bytes.push(parseInt(clean.slice(i, i + 8), 2));
    return utf8FromBytes(bytes);
  }

  function binaryView(text) {
    return {
      format: "binary",
      text: text,
      binary: toBinary(text, 8),
      display: toBinary(text, 8),
      bitLen: utf8Bytes(text).length * 8,
    };
  }

  /* ══════════════ PCAP-lite (not wire capture — packet record view) ══════════════ */
  function pcapLite(text, opts) {
    opts = opts || {};
    var payload = utf8Bytes(text);
    var ts = opts.ts || Math.floor(Date.now() / 1000);
    var usec = opts.usec || (Date.now() % 1000) * 1000;
    /* Simplified: global header fields as metadata + one packet */
    var rec = {
      format: "pcap-lite",
      note: "MG conceptual packet record — not libpcap wire; for training/analysis UI",
      globalHeader: {
        magic: "0xa1b2c3d4",
        version: "2.4",
        snaplen: 65535,
        network: opts.linktype != null ? opts.linktype : 1 /* ethernet */,
      },
      packet: {
        tsSec: ts,
        tsUsec: usec,
        inclLen: payload.length,
        origLen: payload.length,
        payloadHex: toHex(text, ""),
        payloadAscii: asciiView(text).printable,
      },
      display:
        "PCAP-lite · " +
        payload.length +
        " B · " +
        ts +
        "." +
        usec +
        "\n" +
        toHex(text, " "),
    };
    return rec;
  }

  function fromPcapLiteDisplay(hexOrObj) {
    if (hexOrObj && hexOrObj.packet && hexOrObj.packet.payloadHex)
      return fromHex(hexOrObj.packet.payloadHex);
    return fromHex(String(hexOrObj || ""));
  }

  /* ══════════════ Quantum Gutter ══════════════ */
  function bitsFromText(text) {
    var bytes = utf8Bytes(text);
    var bits = [];
    for (var i = 0; i < bytes.length; i++) {
      for (var k = 7; k >= 0; k--) bits.push((bytes[i] >> k) & 1);
    }
    return bits;
  }

  function toQuantumGutter(text) {
    var bits = bitsFromText(text);
    var tokens = [];
    for (var i = 0; i < bits.length; i++) {
      /* map bit pairs → gutter symbol index */
      var n = bits[i];
      if (i + 1 < bits.length) n = (n << 1) | bits[++i];
      /* expand to 0-10 with rolling */
      var idx = (n + i) % GUTTER_SYM.length;
      tokens.push({
        sym: GUTTER_SYM[idx],
        gate: GUTTER_GATES[idx],
        bit: bits[i] || 0,
      });
    }
    var stream = tokens
      .map(function (t) {
        return t.sym;
      })
      .join(" ");
    var gates = tokens
      .map(function (t) {
        return t.gate;
      })
      .join(" ");
    return {
      format: "quantum-gutter",
      text: text,
      stream: stream,
      gates: gates,
      display: stream,
      tokens: tokens.slice(0, 64),
      link: "https://mueee.qbitos.ai/quantum-gutter.html",
      note: "beyondBINARY 11-symbol gutter · maps to SWAP/H/M/Rz/I/X/T/CZ/S/Y/CNOT",
    };
  }

  function gutterFromBinary(binary) {
    var clean = String(binary || "").replace(/[^01]/g, "");
    var tokens = [];
    for (var i = 0; i < clean.length; i++) {
      var idx = (parseInt(clean[i], 2) + i) % GUTTER_SYM.length;
      tokens.push(GUTTER_SYM[idx]);
    }
    return {
      format: "quantum-gutter",
      stream: tokens.join(" "),
      display: tokens.join(" "),
      from: "binary",
    };
  }

  /* ══════════════ StenoSTRIP ══════════════ */
  function toSteno(text) {
    var bits = bitsFromText(text);
    var out = [];
    for (var i = 0; i < bits.length; i += 4) {
      var n = 0;
      for (var k = 0; k < 4 && i + k < bits.length; k++)
        n = (n << 1) | bits[i + k];
      out.push(STENO_SPACES[n % STENO_SPACES.length]);
    }
    var steno = out.join("");
    return {
      format: "steno-strip",
      text: text,
      steno: steno,
      stenoVisible: steno.replace(/[^\x20]/g, "·").replace(/ /g, "␣"),
      display: steno.replace(/[^\x20]/g, "·").replace(/ /g, "␣"),
      len: steno.length,
      note: "13 Unicode spaces · kbatch stenoSTRIP · invisible channel",
    };
  }

  function fromSteno(steno) {
    var s = String(steno || "");
    var bits = [];
    for (var i = 0; i < s.length; i++) {
      var idx = STENO_TO_IDX[s[i]];
      if (idx == null) continue;
      for (var k = 3; k >= 0; k--) bits.push((idx >> k) & 1);
    }
    var bytes = [];
    for (var j = 0; j + 8 <= bits.length; j += 8) {
      var b = 0;
      for (var m = 0; m < 8; m++) b = (b << 1) | bits[j + m];
      bytes.push(b);
    }
    return utf8FromBytes(bytes);
  }

  function stenoCapacity(text) {
    var raw = String(text || "");
    var blank = 0;
    for (var i = 0; i < raw.length; i++) if (/\s/.test(raw[i])) blank++;
    return {
      blankChars: blank,
      bitsApprox: Math.floor(blank * Math.log(13) / Math.log(2)),
    };
  }

  /* ══════════════ Glyph / GrokYtalkY binary ══════════════ */
  function textToGlyphBits(text, n) {
    n = n || 13;
    var size = n * n;
    var bits = new Array(size);
    var bytes = utf8Bytes(text);
    for (var i = 0; i < size; i++) {
      var b = bytes[i % Math.max(1, bytes.length)] || 0;
      bits[i] = (b >> (i % 8)) & 1;
    }
    return bits;
  }

  function glyphBitsToBinary(bits) {
    var parts = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var k = 0; k < 8 && i + k < bits.length; k++)
        if (bits[i + k]) b |= 1 << (7 - k);
      parts.push(("00000000" + b.toString(2)).slice(-8));
    }
    return parts.join(" ");
  }

  function toGlyph(text, n) {
    n = n || 13;
    var bits = textToGlyphBits(text, n);
    var binary = glyphBitsToBinary(bits);
    var steno = toSteno(GY_MAGIC + String.fromCharCode(n) + bits.join(""));
    /* ASCII art grid */
    var grid = [];
    for (var r = 0; r < n; r++) {
      var row = "";
      for (var c = 0; c < n; c++) row += bits[r * n + c] ? "█" : "·";
      grid.push(row);
    }
    return {
      format: "glyph-grokytalky",
      text: text,
      n: n,
      magic: GY_MAGIC,
      binary: binary,
      display: binary,
      grid: grid.join("\n"),
      stenoVisible: steno.display,
      bitLen: bits.length,
      note: "GrokYtalkY / kbatch gyg1 glyph · 13×13 default · steno-carry ready",
    };
  }

  /* ══════════════ QbitCodec (concept on machine) ══════════════ */
  function toQbit(text, lang) {
    lang = lang || "unknown";
    var QC = window.QbitCodec;
    if (QC && typeof QC.encode === "function") {
      try {
        var enc = QC.encode(text, lang, "mg-lang-codec");
        return {
          format: "qbit-codec",
          text: text,
          encoded: typeof enc === "string" ? enc : JSON.stringify(enc).slice(0, 4000),
          display:
            typeof enc === "string"
              ? enc.slice(0, 500)
              : JSON.stringify(enc).slice(0, 500),
          engine: "QbitCodec",
          version: QC.VERSION || QC.version || "1.x",
          note: "concepts/qbit-codec.js · .qbit format",
        };
      } catch (e) {
        /* fall through */
      }
    }
    /* lightweight local qbit-like line prefixes when full codec not loaded */
    var lines = String(text || "").split(/\n/);
    var out = lines.map(function (line, i) {
      var idx = i % GUTTER_SYM.length;
      var depth = (line.match(/^\s*/) || [""])[0].length;
      var space = STENO_SPACES[Math.min(12, Math.floor(depth / 2))];
      return GUTTER_SYM[idx] + space + line.replace(/^\s+/, "");
    });
    return {
      format: "qbit-lite",
      text: text,
      encoded: out.join("\n"),
      display: out.join("\n").slice(0, 800),
      engine: "qbit-lite",
      note: "Full QbitCodec not loaded — lite prefix+steno depth. Load concepts/qbit-codec.js for full .qbit",
    };
  }

  function fromQbit(content) {
    var QC = window.QbitCodec;
    if (QC && typeof QC.decode === "function") {
      try {
        return QC.decode(content);
      } catch (e) {}
    }
    /* strip gutter prefixes */
    return String(content || "")
      .split(/\n/)
      .map(function (line) {
        return line.replace(/^(n:|\+1:|-n:|\+0:|0:|-1:|\+n:|\+2:|-0:|\+3:|1:)\s*/, "");
      })
      .join("\n");
  }

  /* ══════════════ Master transform ══════════════ */
  var FORMATS = [
    "ascii",
    "hex",
    "binary",
    "pcap",
    "gutter",
    "steno",
    "glyph",
    "qbit",
    "text",
  ];

  function transform(text, format, opts) {
    opts = opts || {};
    text = String(text == null ? "" : text);
    format = (format || "hex").toLowerCase();
    switch (format) {
      case "ascii":
        return asciiView(text);
      case "hex":
        return hexView(text);
      case "bin":
      case "binary":
        return binaryView(text);
      case "pcap":
      case "pcap-lite":
        return pcapLite(text, opts);
      case "gutter":
      case "quantum-gutter":
      case "qg":
        return toQuantumGutter(text);
      case "steno":
      case "steno-strip":
      case "whitespace":
        return toSteno(text);
      case "glyph":
      case "grokytalky":
      case "gy":
        return toGlyph(text, opts.n || 13);
      case "qbit":
      case "qbit-codec":
        return toQbit(text, opts.lang || "unknown");
      case "text":
      default:
        return { format: "text", text: text, display: text };
    }
  }

  function invert(display, format) {
    format = (format || "hex").toLowerCase();
    switch (format) {
      case "hex":
        return fromHex(display);
      case "bin":
      case "binary":
        return fromBinary(display);
      case "ascii":
        return fromAsciiCodes(
          String(display)
            .trim()
            .split(/\s+/)
            .map(function (x) {
              return parseInt(x, 10) || 0;
            })
        );
      case "steno":
      case "whitespace":
        return fromSteno(display);
      case "qbit":
        return fromQbit(display);
      case "pcap":
        return fromPcapLiteDisplay(display);
      default:
        return String(display || "");
    }
  }

  function allViews(text) {
    var o = {};
    FORMATS.forEach(function (f) {
      if (f === "text") return;
      try {
        o[f] = transform(text, f);
      } catch (e) {
        o[f] = { format: f, error: String(e) };
      }
    });
    return o;
  }

  function report() {
    var qc = !!(window.QbitCodec && window.QbitCodec.encode);
    return (
      VER +
      " formats=" +
      FORMATS.join(",") +
      " QbitCodec=" +
      (qc ? "on" : "lite")
    );
  }

  window.__mgLangCodec = {
    ver: VER,
    formats: FORMATS.slice(),
    gutterSymbols: GUTTER_SYM.slice(),
    transform: transform,
    invert: invert,
    allViews: allViews,
    ascii: asciiView,
    hex: hexView,
    binary: binaryView,
    pcap: pcapLite,
    gutter: toQuantumGutter,
    gutterFromBinary: gutterFromBinary,
    steno: toSteno,
    fromSteno: fromSteno,
    stenoCapacity: stenoCapacity,
    glyph: toGlyph,
    qbit: toQbit,
    fromQbit: fromQbit,
    toHex: toHex,
    fromHex: fromHex,
    toBinary: toBinary,
    fromBinary: fromBinary,
    report: report,
  };

  log(VER + " · " + report());
})();
