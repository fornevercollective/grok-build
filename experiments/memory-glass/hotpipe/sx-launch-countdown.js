/* Memory Glass · game clock chrome (SpaceX launches timer *look*)
 *
 * Purpose: SCORE round timers + chess/go player clock calibration visuals.
 * NOT a SpaceX mission / NET launcher clock.
 *
 * Opt-in float only: ?mg_game_cd=1 or localStorage mg.game.countdown=1
 * Primary home: ugrad-arena.html score + dual player clocks via SxCountdown
 * VER: sx-game-cd-v2
 */
(function () {
  "use strict";
  var VER = "sx-game-cd-v2";
  if (window.__mgSxLaunchCdVer === VER) return;
  window.__mgSxLaunchCdVer = VER;

  function wantFloat() {
    try {
      if (/[?&]mg_game_cd=1\b/i.test(location.search || "")) return true;
      if (/[?&]mg_sx_cd=1\b/i.test(location.search || "")) return true; /* legacy */
      if (localStorage.getItem("mg.game.countdown") === "1") return true;
    } catch (e) {}
    return false; /* never auto on spacex.com/launches */
  }

  function loadScript(src, cb) {
    var s = document.createElement("script");
    s.src = src;
    s.onload = function () {
      cb && cb(null);
    };
    s.onerror = function () {
      cb && cb(new Error("load " + src));
    };
    (document.head || document.documentElement).appendChild(s);
  }

  function ensureLib(cb) {
    if (window.SxCountdown) {
      cb(null);
      return;
    }
    /* try local site then absolute */
    var bases = [
      
      "http://127.0.0.1:8787/ugrad/sx-countdown.js",
    ];
    var i = 0;
    function next() {
      if (i >= bases.length) {
        /* inline minimal fallback */
        inlineFallback();
        cb(null);
        return;
      }
      loadScript(bases[i++], function (err) {
        if (!err && window.SxCountdown) cb(null);
        else next();
      });
    }
    next();
  }

  function inlineFallback() {
    if (window.SxCountdown) return;
    /* minimal subset if local server down */
    window.SxCountdown = {
      mountFloat: function (opts) {
        var el = document.createElement("div");
        el.id = "sx-cd-float";
        el.style.cssText =
          "position:fixed;right:14px;bottom:14px;z-index:2147483000;background:#000;color:#fff;padding:12px;font:600 14px monospace;border:1px solid #333";
        document.body.appendChild(el);
        function tick() {
          var now = Date.now();
          var t = opts.targetMs || now;
          var d = Math.abs(t - now);
          var s = Math.floor(d / 1000);
          var h = Math.floor(s / 3600);
          s %= 3600;
          var m = Math.floor(s / 60);
          s %= 60;
          el.textContent =
            (now < t ? "T- " : "T+ ") +
            h +
            ":" +
            (m < 10 ? "0" : "") +
            m +
            ":" +
            (s < 10 ? "0" : "") +
            s +
            " · " +
            (opts.mission || "NET");
        }
        tick();
        setInterval(tick, 250);
        return { el: el, destroy: function () {} };
      },
      fetchNextSpaceX: function (cb) {
        fetch(
          "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=3&lsp__name=SpaceX"
        )
          .then(function (r) {
            return r.json();
          })
          .then(function (j) {
            var p = j.results && j.results[0];
            if (!p) return cb(new Error("empty"));
            cb(null, {
              name: p.name,
              netMs: Date.parse(p.net),
              status: p.status && p.status.name,
              abbrev: p.status && p.status.abbrev,
              pad: p.pad && p.pad.name,
            });
          })
          .catch(cb);
      },
    };
  }

  var ctl = null;

  function open(opts) {
    opts = opts || {};
    ensureLib(function () {
      if (!window.SxCountdown) return;
      if (ctl && ctl.destroy) ctl.destroy();
      /* demo score clock float — game calibration, not launches */
      var host = document.createElement("div");
      host.id = "sx-cd-float";
      host.style.cssText =
        "position:fixed;right:14px;bottom:14px;z-index:2147483000;width:min(320px,92vw)";
      document.body.appendChild(host);
      var card = document.createElement("div");
      host.appendChild(card);
      ctl = window.SxCountdown.mountScore
        ? window.SxCountdown.mountScore(card, {
            remainingMs: (opts.sec || 70) * 1000,
            label: opts.label || "SCORE",
            sub: opts.sub || "round timer · calibration",
            compact: true,
          })
        : window.SxCountdown.mount(card, {
            kind: "score",
            label: "SCORE",
            remainingMs: 70 * 1000,
          });
      /* burn score clock */
      var last = performance.now();
      var id = setInterval(function () {
        if (!ctl || !ctl.burn) return;
        var now = performance.now();
        ctl.burn(now - last);
        last = now;
      }, 200);
      ctl._iv = id;
      window.__mgSxCountdownCtl = ctl;
      try {
        if (window.__mgDevLog)
          window.__mgDevLog("ok", VER + " · score/player clock look", "sx-cd");
      } catch (e) {}
    });
  }

  window.__mgSxCountdown = {
    ver: VER,
    open: open,
    close: function () {
      if (ctl && ctl._iv) clearInterval(ctl._iv);
      var el = document.getElementById("sx-cd-float");
      if (el) el.remove();
      if (ctl && ctl.destroy) ctl.destroy();
      ctl = null;
    },
  };

  if (wantFloat()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        setTimeout(open, 600);
      });
    } else {
      setTimeout(open, 600);
    }
  }
})();
