/* Memory Glass · WebGrid playthrough watcher
 * Samples score/timer/grid/blues + pointer events → http://127.0.0.1:9880/
 * Learn-from-play harness · no mouse hijack · inspect-safe
 * VER: webgrid-watch-v1
 */
(function () {
  "use strict";
  try {
    if (!/neuralink\.com$/i.test(location.hostname) || !/webgrid/i.test(location.pathname)) return;
  } catch (e0) {
    return;
  }
  if (window.__mgWebgridWatchV1) return;
  window.__mgWebgridWatchV1 = true;
  var VER = "webgrid-watch-v1";
  var ENDPOINT = "http://127.0.0.1:9880/";
  var clicks = 0,
    hits = 0,
    misses = 0,
    lastBlue = null,
    lastPost = 0,
    t0 = Date.now(),
    phases = [],
    lastPhase = "";

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "webgrid-watch");
    } catch (e) {}
  }

  function textOf(el) {
    return ((el && (el.innerText || el.textContent)) || "").replace(/\s+/g, " ").trim();
  }

  function scrape() {
    var body = textOf(document.body);
    var bps = null,
      ntpm = null,
      timer = null,
      grid = null;
    var mBps = body.match(/([\d.]+)\s*BPS/i);
    if (mBps) bps = parseFloat(mBps[1]);
    var mNtpm = body.match(/([\d.]+)\s*NTPM/i);
    if (mNtpm) ntpm = parseFloat(mNtpm[1]);
    var mT = body.match(/\b(\d{1,2}:\d{2})\b/);
    if (mT) timer = mT[1];
    var mG = body.match(/(\d+)\s*[×x]\s*(\d+)/i);
    if (mG) grid = mG[1] + "x" + mG[2];

    var phase = "unknown";
    if (/play again/i.test(body)) phase = "end";
    else if (/start game/i.test(body)) phase = "lobby";
    else if (/decline/i.test(body) && /accept|cookie|privacy/i.test(body)) phase = "consent";
    else if (timer && bps != null) phase = "playing";
    else if (/select|difficulty|grid/i.test(body)) phase = "setup";

    var blues = countBlues();
    return {
      kind: "sample",
      ver: VER,
      t: Date.now(),
      elapsed: Date.now() - t0,
      phase: phase,
      bps: bps,
      ntpm: ntpm,
      timer: timer,
      grid: grid,
      blues: blues,
      clicks: clicks,
      hits: hits,
      misses: misses,
      lastBlue: lastBlue,
      href: location.href,
      title: document.title || "",
      snippet: body.slice(0, 220),
    };
  }

  function countBlues() {
    var c = document.querySelector("canvas");
    if (!c) return null;
    var w = c.width,
      h = c.height;
    if (!w || !h) return null;
    try {
      var tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      var tctx = tmp.getContext("2d");
      tctx.drawImage(c, 0, 0);
      var data = tctx.getImageData(0, 0, w, h).data;
      var n = 0,
        sx = 0,
        sy = 0;
      var step = Math.max(2, Math.floor(Math.min(w, h) / 120));
      for (var y = 1; y < h - 1; y += step) {
        for (var x = 1; x < w - 1; x += step) {
          var i = (y * w + x) * 4;
          var R = data[i],
            G = data[i + 1],
            B = data[i + 2];
          if (B > 160 && R < 110 && B > R + 35) {
            n++;
            sx += x;
            sy += y;
          }
        }
      }
      if (n) {
        lastBlue = {
          nx: sx / n / w,
          ny: sy / n / h,
          n: n,
        };
      }
      return n;
    } catch (e) {
      return null;
    }
  }

  function post(obj) {
    /* https://neuralink cannot fetch http://localhost (mixed content).
     * IPC dev_log → Rust appends ~/.panda/mg-soak/watch/play.jsonl */
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({
            op: "dev_log",
            lvl: "info",
            src: "webgrid-watch",
            msg: "MGW:" + JSON.stringify(obj),
          })
        );
      }
    } catch (eIpc) {}
    /* optional local collector if ever same-origin / allowed */
    try {
      fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj),
      }).catch(function () {});
    } catch (e) {}
    try {
      window.__mgWatchLast = obj;
    } catch (e2) {}
  }

  function sample(force) {
    var now = Date.now();
    if (!force && now - lastPost < 280) return;
    lastPost = now;
    var s = scrape();
    if (s.phase !== lastPhase) {
      phases.push({ t: now, phase: s.phase });
      lastPhase = s.phase;
      post({
        kind: "phase",
        phase: s.phase,
        t: now,
        elapsed: s.elapsed,
        bps: s.bps,
        ntpm: s.ntpm,
        timer: s.timer,
        grid: s.grid,
      });
    }
    post(s);
  }

  /* pointer learning — human play, we only observe */
  function onPtr(ev) {
    if (ev.type === "pointerdown" || ev.type === "mousedown") {
      clicks++;
      var s = scrape();
      var hit = false;
      if (lastBlue && s.blues != null) {
        /* crude: click near last blue centroid in viewport canvas space */
        var c = document.querySelector("canvas");
        if (c) {
          var r = c.getBoundingClientRect();
          var cx = r.left + lastBlue.nx * r.width;
          var cy = r.top + lastBlue.ny * r.height;
          var d = Math.hypot(ev.clientX - cx, ev.clientY - cy);
          hit = d < Math.max(28, Math.min(r.width, r.height) * 0.08);
        }
      }
      if (hit) hits++;
      else misses++;
      post({
        kind: "click",
        t: Date.now(),
        elapsed: Date.now() - t0,
        x: ev.clientX,
        y: ev.clientY,
        hitGuess: hit,
        lastBlue: lastBlue,
        bps: s.bps,
        ntpm: s.ntpm,
        timer: s.timer,
        phase: s.phase,
        clicks: clicks,
        hits: hits,
        misses: misses,
      });
    }
  }
  document.addEventListener("pointerdown", onPtr, true);
  document.addEventListener("mousedown", onPtr, true);

  setInterval(function () {
    sample(false);
  }, 350);
  sample(true);
  log(VER + " · watching playthrough → :9880");
})();
