/* Memory Glass · Lazy boot
 * Product browse stays light: only core chrome runs. Lab / heavy tools load on demand.
 * VER: mg-lazy-boot-v2-park-safe
 */
(function () {
  "use strict";
  var VER = "mg-lazy-boot-v2-park-safe";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._lazyBootVer === VER) return;
  HP._lazyBootVer = VER;

  var loaded = {};
  var loading = {};
  var waiters = {};

  /* Map tool keys → hotpipe filenames (native hot_module inject) */
  var MAP = {
    annotate: "mg-site-annotate.js",
    draw: "mg-site-annotate.js",
    desk: "mg-agent-desk.js",
    collab: "mg-live-collab.js",
    pick: "mg-live-collab.js",
    bench: "mg-data-bench.js",
    freya: "mg-data-bench.js",
    maze: "memory-maze-gsplat.js",
    bloch: "bloch-solve-bus.js",
    rubik: "rubik-language-float.js",
    beats: "keyboard-beats.js",
    staff: "staff-lab-plane.js",
    market: "market-filmstrip.js",
    contrail: "webgrid-contrail.js",
    quantum: "quantum-webgrid.js",
    ugrad: "ugrad-ladder.js",
    tensor: "ugrad-webgrid-tensor.js",
    collab: "collab.js",
    collabDay: "collab-day.js",
    raider: "brothernumsey-raider.js",
    sports: "sportsfield-bridge.js",
    geo: "geo-pattern-float.js",
    floatKb: "float-keyboard.js",
    glassCap: "glass-capsule-shell.js",
    liveHud: "live-solve-hud.js",
    race: "qbit-race-sitrep.js",
    l1: "qbit-l1-pilot.js",
    bus: "qbit-bus.js",
    truss: "qbit-truss.js",
    term: "qbit-term-plane.js",
    codec: "qbit-codec.js",
    webgrid: "webgrid-play.js",
    board: "activity-leaderboard.js",
    atlas: "site-atlas.js",
    grokTerm: "mg-grok-terminal.js",
    jump: "mg-jump-stack.js",
    deploy: "mg-deploy.js",
    bottomChrome: "mg-bottom-chrome.js",
    kbatchSite: "mg-kbatch-site.js",
    stillFleet: "mg-still-fleet.js",
    bodyPose: "body-pose.js",
    dogPose: "dog-pose.js",
  };

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "lazy");
    } catch (e) {}
  }

  function markLoaded(key) {
    loaded[key] = true;
    delete loading[key];
    var list = waiters[key] || [];
    delete waiters[key];
    for (var i = 0; i < list.length; i++) {
      try {
        list[i](true);
      } catch (e) {}
    }
  }

  function already(key) {
    if (loaded[key]) return true;
    if (key === "annotate" || key === "draw")
      return !!(window.__mgSiteAnnotate || window.screenAnnotate);
    if (key === "desk") return !!window.__mgAgentDesk;
    if (key === "board") return !!window.__mgActivityBoard;
    if (key === "maze") return !!window.__mgMemoryMaze;
    if (key === "contrail") return !!window.__mgContrail;
    if (key === "bloch") return !!window.__mgBlochSolve;
    if (key === "rubik") return !!window.__mgRubikLang;
    if (key === "webgrid") return !!window.__mgWebgridPlay;
    if (key === "deploy") return !!window.__mgDeploy;
    if (key === "bottomChrome") return !!window.__mgBottomChrome;
    if (key === "kbatchSite") return !!window.__mgKbatchSite;
    if (key === "stillFleet") return !!window.__mgStillFleet;
    if (key === "bodyPose") return !!window.__mgGetBodyPose;
    if (key === "dogPose") return !!window.__mgGetDogPose;
    return false;
  }

  function requestNative(file) {
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({ op: "hot_module", name: file, t: Date.now() })
        );
        return true;
      }
    } catch (e) {}
    return false;
  }

  /**
   * Ensure a tool is loaded, then run cb(ok).
   * If already present, cb(true) immediately.
   */
  function need(key, cb) {
    cb = typeof cb === "function" ? cb : function () {};
    key = String(key || "").trim();
    if (!key) {
      cb(false);
      return false;
    }
    if (already(key)) {
      markLoaded(key);
      cb(true);
      return true;
    }
    var file = MAP[key];
    if (!file) {
      log("lazy unknown " + key);
      cb(false);
      return false;
    }
    if (loading[key]) {
      (waiters[key] = waiters[key] || []).push(cb);
      return true;
    }
    loading[key] = true;
    (waiters[key] = waiters[key] || []).push(cb);
    log("lazy load " + key + " → " + file);
    var ok = requestNative(file);
    if (!ok) {
      log("lazy no ipc — module must be pre-injected: " + key);
      delete loading[key];
      var w = waiters[key] || [];
      delete waiters[key];
      for (var i = 0; i < w.length; i++) {
        try {
          w[i](already(key));
        } catch (e) {}
      }
      return false;
    }
    /* Poll for API surface after native inject */
    var n = 0;
    var t = setInterval(function () {
      n++;
      if (already(key) || n > 40) {
        clearInterval(t);
        if (already(key)) markLoaded(key);
        else {
          delete loading[key];
          var list = waiters[key] || [];
          delete waiters[key];
          for (var j = 0; j < list.length; j++) {
            try {
              list[j](false);
            } catch (e2) {}
          }
          log("lazy timeout " + key);
        }
      }
    }, 50);
    return true;
  }

  /** Pause / strip lab surfaces that cost FPS when idle */
  function parkLab() {
    try {
      /* Session desk / Keys stack asked for lab — do not rip out maze·contrail·kb */
      var root = document.documentElement;
      if (
        root.classList.contains("mg-lab-floats") ||
        root.classList.contains("mg-left-keys") ||
        root.classList.contains("mg-left-open")
      ) {
        log("parkLab skipped · lab/keys active");
        return 0;
      }
    } catch (eSkip) {}
    var killIds = [
      "mg-mem-maze",
      "mg-rubik-float",
      "mg-rubik-orb",
      "mg-bloch-float",
      "mg-bloch-orb",
      "mg-kb-beats",
      "mg-sports-field",
      "mg-geo-float",
      "mg-contrail-ov",
      "mg-contrail-flow",
      "mg-live-solve-hud",
      "mg-raider-stage",
      "mg-float-kb",
      "mg-glass-cap",
      "mg-mkt-rail",
      "mg-sx-rail",
    ];
    var n = 0;
    killIds.forEach(function (id) {
      try {
        document.querySelectorAll("#" + id).forEach(function (el) {
          /* keep embedded Keys stack hosts intact */
          if (el && el.classList && el.classList.contains("mg-embedded")) return;
          if (el && el.closest && el.closest("#mg-tools-drawer")) return;
          if (el && el.parentNode) {
            el.parentNode.removeChild(el);
            n++;
          }
        });
      } catch (e) {}
    });
    try {
      if (window.__mgWebgridPlayTeardown) window.__mgWebgridPlayTeardown();
    } catch (e2) {}
    try {
      document.documentElement.classList.add("mg-product");
      document.documentElement.classList.add("mg-lazy");
      document.documentElement.classList.remove("mg-webgrid-play");
    } catch (e3) {}
    if (n) log("parkLab removed " + n + " surfaces");
    return n;
  }

  function report() {
    return (
      VER +
      " loaded=" +
      Object.keys(loaded).join(",") +
      " loading=" +
      Object.keys(loading).join(",")
    );
  }

  window.__mgLazy = {
    ver: VER,
    MAP: MAP,
    need: need,
    parkLab: parkLab,
    loaded: function () {
      return Object.assign({}, loaded);
    },
    report: report,
  };

  /* Product default: park lab chrome that may have been force-injected */
  try {
    if (!/[?&]mg_lab_full=1\b/i.test(location.search || "")) {
      setTimeout(parkLab, 0);
      setTimeout(parkLab, 400);
      setTimeout(parkLab, 1200);
    }
  } catch (eP) {}

  log(VER + " · on-demand tools · park lab unless ?mg_lab_full=1");
})();
