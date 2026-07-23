/* Memory Glass · session desk bootstrap
 * One window · tabs SpaceX / Deploy / WebGrid · contrail + maze
 * Product-core: lazy-load maze/contrail via __mgLazy; unlock page scroll.
 * VER: mg-session-desk-v3d-f13-draw
 */
(function () {
  "use strict";
  var VER = "mg-session-desk-v3k-draw-top";
  if (window.__mgSessionDeskVer === VER) return;
  window.__mgSessionDeskVer = VER;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "desk");
    } catch (e) {}
  }

  /* ── Inspect spam filter: collapse zzzz / pure noise ── */
  function installLogFilter() {
    try {
      var prev = window.__mgDevLog;
      if (!prev || prev.__mgSpamFilter) return;
      var last = "";
      var lastN = 0;
      var lastT = 0;
      function isNoise(msg) {
        var s = String(msg || "").trim();
        if (!s) return true;
        if (/^z{3,}$/i.test(s)) return true;
        if (/^[zZ.\s·…-]{4,}$/.test(s)) return true;
        if (/^(uh+|um+|hmm+|mm+|ah+)$/i.test(s)) return true;
        if (s.length <= 2 && !/[a-z0-9]/i.test(s)) return true;
        return false;
      }
      function filtered(lvl, msg, src) {
        var s = String(msg || "");
        if (isNoise(s)) return;
        var now = Date.now();
        if (s === last && now - lastT < 4000) {
          lastN += 1;
          if (lastN === 2) prev.call(window, lvl, s + " · (repeat suppressed)", src);
          lastT = now;
          return;
        }
        last = s;
        lastN = 1;
        lastT = now;
        return prev.call(window, lvl, msg, src);
      }
      filtered.__mgSpamFilter = true;
      window.__mgDevLog = filtered;
      log(VER + " · inspect spam filter on");
    } catch (e) {}
  }

  /* ── Unlock SpaceX scroll: close tools scrim + clear blockers ── */
  function unlockPage() {
    var n = 0;
    try {
      if (window.__mgToolsDrawer && window.__mgToolsDrawer.close) {
        window.__mgToolsDrawer.close();
        n++;
      }
    } catch (e0) {}
    try {
      if (window.__mgRightDrawer && window.__mgRightDrawer.close) {
        window.__mgRightDrawer.close();
        n++;
      }
    } catch (e1) {}
    try {
      var scrim = document.getElementById("mg-tools-scrim");
      if (scrim) {
        scrim.classList.remove("on");
        scrim.style.pointerEvents = "none";
        scrim.style.opacity = "0";
        n++;
      }
      var rscrim = document.getElementById("mg-right-scrim");
      if (rscrim) {
        rscrim.classList.remove("on");
        rscrim.style.pointerEvents = "none";
        n++;
      }
    } catch (e2) {}
    try {
      document.documentElement.classList.remove("mg-left-open");
      document.documentElement.classList.remove("mg-right-open");
      document.documentElement.classList.remove("mg-drawer-open");
      document.documentElement.classList.remove("mg-drawing");
      document.documentElement.classList.remove("mg-drawing-capture");
      /* force document scroll (shell droplet html overflow:hidden broke SpaceX) */
      document.documentElement.style.setProperty("overflow-x", "hidden", "important");
      document.documentElement.style.setProperty("overflow-y", "auto", "important");
      document.documentElement.style.setProperty("height", "auto", "important");
      document.documentElement.style.setProperty("min-height", "100%", "important");
      if (document.body) {
        document.body.style.setProperty("overflow-x", "hidden", "important");
        document.body.style.setProperty("overflow-y", "visible", "important");
        document.body.style.setProperty("height", "auto", "important");
        document.body.style.setProperty("min-height", "100%", "important");
        document.body.style.pointerEvents = "";
      }
      document.documentElement.style.pointerEvents = "";
      n++;
    } catch (e3) {}
    try {
      if (window.__mgScrollUnlock && window.__mgScrollUnlock.clear)
        window.__mgScrollUnlock.clear();
    } catch (eU) {}
    try {
      var md = document.getElementById("mg-mini-draw-cv");
      if (md) {
        md.classList.remove("on");
        md.style.pointerEvents = "none";
        md.style.display = "none";
      }
      var mt = document.getElementById("mg-mini-draw-tb");
      if (mt) mt.classList.remove("on");
    } catch (eMd) {}
    /* full-window overlays that may steal wheel */
    [
      "mg-vangogh-grok",
      "mg-vangogh-plate",
      "mg-annotate-cv",
      "mg-annotate-layer",
      "mg-site-annotate-cv",
    ].forEach(function (id) {
      try {
        var el = document.getElementById(id);
        if (!el) return;
        /* keep annotate if user is drawing; only force pe:none on art layers */
        if (id.indexOf("vangogh") >= 0 || id.indexOf("annotate") >= 0) {
          el.style.pointerEvents = "none";
          if (id.indexOf("vangogh") >= 0) {
            el.remove();
            n++;
          }
        }
      } catch (e4) {}
    });
    try {
      if (window.__mgSiteAnnotate && window.__mgSiteAnnotate.deactivate)
        window.__mgSiteAnnotate.deactivate();
      else if (window.screenAnnotate && window.screenAnnotate.deactivate)
        window.screenAnnotate.deactivate();
    } catch (e5) {}
    /* any fixed full-bleed node with pe:auto (except chrome) */
    try {
      var nodes = document.querySelectorAll("body > *, html > *");
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (!el || !el.id) continue;
        var id = el.id || "";
        if (
          id.indexOf("mg-tools") === 0 ||
          id.indexOf("mg-right") === 0 ||
          id.indexOf("mg-search") === 0 ||
          id.indexOf("mg-rec") === 0 ||
          id.indexOf("mg-chrome") === 0 ||
          id.indexOf("mg-row") === 0 ||
          id === "mg-bot-dots" ||
          id === "mg-sx-rail"
        )
          continue;
        var st = window.getComputedStyle(el);
        if (
          st.position === "fixed" &&
          st.pointerEvents !== "none" &&
          (st.inset === "0px" ||
            (el.offsetWidth >= window.innerWidth * 0.9 &&
              el.offsetHeight >= window.innerHeight * 0.9))
        ) {
          /* only neutralize non-chrome full screens */
          if (/annotate|vangogh|scrim|overlay|ov$|blocker/i.test(id)) {
            el.style.pointerEvents = "none";
            n++;
          }
        }
      }
    } catch (e6) {}
    log("unlockPage · n=" + n);
    return n;
  }

  function lazyNeed(key, cb) {
    cb = typeof cb === "function" ? cb : function () {};
    try {
      if (window.__mgLazy && typeof window.__mgLazy.need === "function") {
        window.__mgLazy.need(key, cb);
        return;
      }
    } catch (e) {}
    /* fallback: already present? */
    cb(false);
  }

  /* ── Tabs: SpaceX · Deploy · WebGrid ── */
  function setupTabs() {
    try {
      var tabs = [
        { id: 1, url: "https://www.spacex.com/", title: "spacex" },
        {
          id: 2,
          url: "http://127.0.0.1:9877/deploy.html",
          title: "deploy",
        },
        {
          id: 3,
          url:
            "https://neuralink.com/webgrid/?mg_scale=small&mg_autoplay=0&mg_pace=intel&mg_display=2560x1440",
          title: "webgrid",
        },
      ];
      var tries = 0;
      function apply() {
        tries += 1;
        try {
          if (typeof window.__mgSetBrowserTabs === "function") {
            window.__mgSetBrowserTabs(tabs, 0);
            log("tabs set via __mgSetBrowserTabs");
            return;
          }
        } catch (e0) {}
        try {
          if (window.__mgBrowserTabs) {
            window.__mgBrowserTabs.length = 0;
            tabs.forEach(function (t) {
              window.__mgBrowserTabs.push(t);
            });
          }
        } catch (e1) {}
        try {
          if (window.ipc && window.ipc.postMessage) {
            window.ipc.postMessage(
              JSON.stringify({
                op: "sync_tabs",
                json: JSON.stringify({
                  active: 0,
                  tabs: tabs.map(function (t) {
                    return { title: t.title, url: t.url };
                  }),
                }),
              })
            );
          }
        } catch (e2) {}
        if (tries < 8) setTimeout(apply, 600);
      }
      setTimeout(apply, 800);
    } catch (e) {}
  }

  function openContrail() {
    try {
      if (!window.__mgContrail) return false;
      if (window.__mgContrail.setOverlay) window.__mgContrail.setOverlay(true);
      if (window.__mgContrail.setFlow) window.__mgContrail.setFlow(true);
      if (window.__mgContrail.open) window.__mgContrail.open();
      log("contrail open");
      return true;
    } catch (e) {
      log("contrail err " + e);
      return false;
    }
  }

  function openMaze() {
    try {
      if (!window.__mgMemoryMaze) return false;
      window.__mgMemoryMaze.open();
      if (window.__mgMemoryMaze.setMusic) window.__mgMemoryMaze.setMusic(true);
      log("maze open");
      return true;
    } catch (e) {
      log("maze err " + e);
      return false;
    }
  }

  /* ── Live floats: lazy-load then open (product-core) ── */
  function openFloats() {
    try {
      document.documentElement.classList.remove("mg-product-ghost");
      document.documentElement.classList.add("mg-lab-floats");
    } catch (e0) {}

    unlockPage();

    lazyNeed("contrail", function (ok) {
      if (!openContrail()) {
        /* retry a few times after hot_module inject */
        var n = 0;
        var t = setInterval(function () {
          n++;
          if (openContrail() || n > 25) clearInterval(t);
        }, 120);
      }
      log("lazy contrail ok=" + !!ok + " api=" + !!window.__mgContrail);
    });

    lazyNeed("maze", function (ok) {
      if (!openMaze()) {
        var n = 0;
        var t = setInterval(function () {
          n++;
          if (openMaze() || n > 25) clearInterval(t);
        }, 120);
      }
      log("lazy maze ok=" + !!ok + " api=" + !!window.__mgMemoryMaze);
    });

    try {
      if (window.__mgActivityBoard && window.__mgActivityBoard.open)
        window.__mgActivityBoard.open();
    } catch (e3) {}

    log("floats · request contrail · maze");
  }

  /* ── DRAW: Van Gogh starry night / water-lilies gsplat (opt-in only) ── */
  function paintVanGoghGrok() {
    var W = window.innerWidth || 1280;
    var H = window.innerHeight || 800;
    var cx = W * 0.72;
    var cy = H * 0.42;
    var R = Math.min(W, H) * 0.16;

    try {
      if (window.__mgSiteAnnotate && window.__mgSiteAnnotate.activate)
        window.__mgSiteAnnotate.activate();
      else if (window.screenAnnotate && window.screenAnnotate.activate)
        window.screenAnnotate.activate();
    } catch (eA) {}

    var old = document.getElementById("mg-vangogh-grok");
    if (old) old.remove();
    var cv = document.createElement("canvas");
    cv.id = "mg-vangogh-grok";
    cv.width = W;
    cv.height = H;
    cv.style.cssText =
      "position:fixed;inset:0;z-index:2147483000;pointer-events:none;" +
      "width:100%;height:100%";
    document.documentElement.appendChild(cv);
    var ctx = cv.getContext("2d");
    if (!ctx) return;

    var bg = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy * 0.6, Math.max(W, H));
    bg.addColorStop(0, "rgba(20, 28, 70, 0.35)");
    bg.addColorStop(0.45, "rgba(8, 12, 40, 0.22)");
    bg.addColorStop(1, "rgba(2, 4, 16, 0.08)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    function dot(x, y, r, col, a) {
      ctx.beginPath();
      ctx.fillStyle = col.replace("ALPHA", String(a));
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    var i, j, a, x, y, rr, ang;
    for (i = 0; i < 9; i++) {
      var ox = W * (0.12 + (i % 3) * 0.28);
      var oy = H * (0.12 + Math.floor(i / 3) * 0.18);
      for (j = 0; j < 120; j++) {
        a = j * 0.38 + i;
        rr = 8 + (j % 40) * 1.1;
        x = ox + Math.cos(a) * rr * (0.6 + (i % 2) * 0.4);
        y = oy + Math.sin(a) * rr * 0.55;
        var blues = [
          "rgba(90,140,255,ALPHA)",
          "rgba(160,200,255,ALPHA)",
          "rgba(255,220,120,ALPHA)",
          "rgba(70,90,180,ALPHA)",
        ];
        dot(x, y, 1.2 + (j % 4) * 0.5, blues[j % 4], 0.35 + (j % 5) * 0.08);
      }
    }

    for (i = 0; i < 28; i++) {
      x = W * (0.05 + (i % 7) * 0.13) + Math.sin(i * 1.7) * 12;
      y = H * (0.72 + (i % 4) * 0.06) + Math.cos(i) * 8;
      for (j = 0; j < 36; j++) {
        ang = (j / 36) * Math.PI * 2;
        rr = 6 + (j % 5);
        var greens = [
          "rgba(40,120,90,ALPHA)",
          "rgba(80,160,110,ALPHA)",
          "rgba(30,80,70,ALPHA)",
          "rgba(200,120,160,ALPHA)",
        ];
        dot(
          x + Math.cos(ang) * rr,
          y + Math.sin(ang) * rr * 0.55,
          1.4,
          greens[j % 4],
          0.4
        );
      }
      dot(x + 2, y - 1, 2.2, "rgba(255,180,210,ALPHA)", 0.55);
    }

    for (i = 0; i < 7; i++) {
      rr = R * (0.25 + i * 0.12);
      for (j = 0; j < 64 + i * 12; j++) {
        ang = (j / (64 + i * 12)) * Math.PI * 2 + i * 0.2;
        var wob = 1 + 0.08 * Math.sin(ang * 5 + i);
        x = cx + Math.cos(ang) * rr * wob;
        y = cy + Math.sin(ang) * rr * wob * 0.92;
        var cols = [
          "rgba(110,200,255,ALPHA)",
          "rgba(180,150,255,ALPHA)",
          "rgba(255,255,255,ALPHA)",
          "rgba(90,160,255,ALPHA)",
        ];
        dot(x, y, 1.3 + (i % 3) * 0.4, cols[(i + j) % 4], 0.5 + (i % 2) * 0.15);
      }
    }
    for (j = 0; j < 80; j++) {
      ang = Math.random() * Math.PI * 2;
      rr = Math.random() * R * 0.18;
      dot(
        cx + Math.cos(ang) * rr,
        cy + Math.sin(ang) * rr,
        1.5 + Math.random() * 2,
        "rgba(255,255,255,ALPHA)",
        0.7
      );
    }

    ctx.font = "700 14px ui-monospace, Menlo, monospace";
    ctx.fillStyle = "rgba(220,230,255,0.85)";
    ctx.fillText("YAY FROM GROK · starry lilies · gsplat", cx - R * 0.9, cy + R * 1.35);
    ctx.font = "600 11px ui-monospace, Menlo, monospace";
    ctx.fillStyle = "rgba(160,200,255,0.7)";
    ctx.fillText("DRAW · Van Gogh night · water pads · logo core", cx - R * 0.9, cy + R * 1.5);

    log(VER + " · Van Gogh gsplat Grok painted");
    return true;
  }

  function isInspectHost() {
    try {
      if (document.getElementById("pip-wrap")) return true;
      if (document.documentElement.classList.contains("mg-inspect-host"))
        return true;
      if (document.getElementById("panel") && document.getElementById("stage"))
        return true;
    } catch (e) {}
    return false;
  }

  function loadF13Sketch() {
    /* DRAW sketch is MAIN window only — inspect must stay clean for still/IK */
    if (isInspectHost()) {
      try {
        var junk = document.getElementById("mg-f13-sketch");
        if (junk) junk.remove();
        var jtb = document.getElementById("mg-f13-draw-tb");
        if (jtb) jtb.remove();
      } catch (eJ) {}
      log("f13 sketch skipped · inspect host");
      return;
    }
    try {
      if (window.__mgF13Sketch && window.__mgF13Sketch.start) {
        window.__mgF13Sketch.start();
        return;
      }
    } catch (e0) {}
    var urls = [
      "http://127.0.0.1:9877/f13-live-sketch.js?v=9",
      "http://127.0.0.1:9877/vision/f13-live-sketch.js?v=9",
    ];
    function tryLoad(i) {
      if (i >= urls.length) {
        log("f13 sketch load failed");
        return;
      }
      fetch(urls[i], { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw 0;
          return r.text();
        })
        .then(function (code) {
          var el = document.createElement("script");
          el.textContent = code;
          (document.head || document.documentElement).appendChild(el);
          log("f13 live sketch loaded");
        })
        .catch(function () {
          tryLoad(i + 1);
        });
    }
    tryLoad(0);
  }

  function boot() {
    installLogFilter();
    unlockPage();
    setupTabs();
    /* Mark lab active before parkLab timers (0/400/1200ms) can strip maze·contrail */
    try {
      document.documentElement.classList.add("mg-lab-floats");
    } catch (eLab) {}
    var n = 0;
    var floatsReady = false;
    function tryFloats() {
      n += 1;
      unlockPage();
      openFloats();
      if (window.__mgContrail && window.__mgMemoryMaze) floatsReady = true;
      /* few retries only — thrashing open/close broke keys embed */
      if (!floatsReady && n < 6) setTimeout(tryFloats, 700);
    }
    setTimeout(tryFloats, 400);
    /* reassert once after menu-health exercise (~3s), then stop */
    setTimeout(function () {
      unlockPage();
      openContrail();
      openMaze();
    }, 3200);
    /* DRAW sketch after floats so z-order / parkLab settle first */
    setTimeout(function () {
      unlockPage();
      loadF13Sketch();
    }, 2800);
    log(VER + " boot · unlock + lazy floats + f13 draw");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.__mgSessionDesk = {
    ver: VER,
    paintArt: paintVanGoghGrok,
    openFloats: openFloats,
    unlockPage: unlockPage,
    setupTabs: setupTabs,
  };
})();
