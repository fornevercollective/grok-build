/* Memory Glass · WebGrid helper (WKWebView only — NO mouse hijack)
 *
 * Default: chrome out of the way + layout CSS only. YOU keep the mouse.
 * Auto-play is OFF unless ?mg_autoplay=1 or localStorage mg.webgrid.autoplay=1
 *
 * Grid sizes: 12×12 / 30×30 / whatever Neuralink serves — we only style chrome.
 * VER: webgrid-play-v5-nohijack
 */
(function () {
  "use strict";
  try {
    if (!/neuralink\.com$/i.test(location.hostname) || !/webgrid/i.test(location.pathname)) return;
  } catch (e0) {
    return;
  }
  if (window.__mgWebgridChromeV5) return;
  window.__mgWebgridChromeV5 = true;
  var VER = "webgrid-play-v5-nohijack";

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "webgrid");
    } catch (e) {}
    try {
      console.log("[mg-webgrid]", m);
    } catch (e2) {}
  }

  /** Hide MG tabs/search so THEY don't cover Decline / Start / Play again / grid.
   *  Does NOT steal the mouse or post OS clicks. */
  function hideMgChrome() {
    try {
      document.documentElement.classList.add("mg-webgrid-play");
      document.documentElement.style.setProperty("--mg-page-pad-bot", "0px");
      document.documentElement.style.setProperty("--mg-page-pad-top", "0px");
      if (document.body) {
        document.body.style.setProperty("padding-top", "0", "important");
        document.body.style.setProperty("padding-bottom", "0", "important");
      }
    } catch (e) {}
    if (document.getElementById("mg-webgrid-chrome-hide")) return;
    var st = document.createElement("style");
    st.id = "mg-webgrid-chrome-hide";
    st.textContent =
      "/* Keep page + canvas fully interactive for the human mouse */" +
      "html.mg-webgrid-play #mg-tabs," +
      "html.mg-webgrid-play #mg-tab-row," +
      "html.mg-webgrid-play #mg-search-dock," +
      "html.mg-webgrid-play #mg-search-peek," +
      "html.mg-webgrid-play #mg-stoplights," +
      "html.mg-webgrid-play #mg-top-right," +
      "html.mg-webgrid-play #mg-mode-menu," +
      "html.mg-webgrid-play #mg-tab," +
      "html.mg-webgrid-play .mg-edge," +
      "html.mg-webgrid-play .mg-grip," +
      "html.mg-webgrid-play #mg-dragon," +
      "html.mg-webgrid-play #mg-panel," +
      "html.mg-webgrid-play #mg-dev," +
      "html.mg-webgrid-play #mg-scrim{" +
      "  display:none!important;visibility:hidden!important;pointer-events:none!important;" +
      "  opacity:0!important;}" +
      "html.mg-webgrid-play body{padding:0!important;margin:0!important}" +
      "html.mg-webgrid-play #mg-root{" +
      "  pointer-events:none!important;}" +
      "/* Never block the game surface */" +
      "html.mg-webgrid-play canvas," +
      "html.mg-webgrid-play button," +
      "html.mg-webgrid-play a," +
      "html.mg-webgrid-play input{" +
      "  pointer-events:auto!important;}";
    (document.head || document.documentElement).appendChild(st);
    log(VER + " · chrome tucked · mouse is yours");
  }

  function wantAutoplay() {
    try {
      if (/[?&]mg_autoplay=1\b/.test(location.search)) return true;
      if (localStorage.getItem("mg.webgrid.autoplay") === "1") return true;
    } catch (e) {}
    return false;
  }

  /* ── optional autoplay only (explicit opt-in) ── */
  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }
  function findButton(re) {
    var nodes = document.querySelectorAll("button, a, [role=button]");
    for (var i = 0; i < nodes.length; i++) {
      var t = (nodes[i].innerText || "").replace(/\s+/g, " ").trim();
      if (re.test(t)) return nodes[i];
    }
    return null;
  }
  function clickEl(el) {
    if (!el) return;
    try {
      el.click();
    } catch (e) {}
  }
  function clickAtTrusted(x, y) {
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(JSON.stringify({ op: "click_at", x: x, y: y }));
      }
    } catch (e) {}
  }
  function findBlue() {
    var c = document.querySelector("canvas");
    if (!c) return null;
    var w = c.width,
      h = c.height,
      data = null;
    try {
      var tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      var tctx = tmp.getContext("2d");
      tctx.drawImage(c, 0, 0);
      data = tctx.getImageData(0, 0, w, h).data;
    } catch (e) {
      return null;
    }
    var sx = 0,
      sy = 0,
      n = 0;
    for (var y = 1; y < h - 1; y += 2) {
      for (var x = 1; x < w - 1; x += 2) {
        var i = (y * w + x) * 4;
        var R = data[i],
          G = data[i + 1],
          B = data[i + 2];
        if (B > 160 && R < 110 && B > R + 35) {
          sx += x;
          sy += y;
          n++;
        }
      }
    }
    if (!n) return null;
    var r = c.getBoundingClientRect();
    return {
      x: r.left + (sx / n / w) * r.width,
      y: r.top + (sy / n / h) * r.height,
      n: n,
    };
  }

  async function autoplayIfEnabled() {
    if (!wantAutoplay()) {
      log("autoplay off · play with your mouse (12×12 / 30×30 / any grid)");
      return;
    }
    log("autoplay ON (opt-in) · limited to this WebView");
    await sleep(1500);
    var d = findButton(/^decline$/i) || findButton(/decline/i);
    if (d) {
      clickEl(d);
      await sleep(500);
    }
    var s =
      findButton(/^start game$/i) ||
      findButton(/start game/i) ||
      findButton(/^play again$/i) ||
      findButton(/play again/i);
    if (s) {
      clickEl(s);
      await sleep(800);
    }
    var tEnd = Date.now() + 55000;
    var hits = 0;
    while (Date.now() < tEnd) {
      if (findButton(/^play again$/i) && hits > 2) break;
      var pt = findBlue();
      if (pt) {
        clickAtTrusted(pt.x, pt.y);
        hits++;
        await sleep(30);
      } else {
        await sleep(40);
      }
    }
    log("autoplay done hits=" + hits);
  }

  hideMgChrome();
  /* Re-apply chrome hide if hot-pipe re-injects HUD later */
  setInterval(hideMgChrome, 2000);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      autoplayIfEnabled();
    });
  } else {
    autoplayIfEnabled();
  }
})();
