/* Memory Glass · shared L/R/M wave strip (top slot, no HTTPS banner)
 * Polls GET /wave · paints #wave-box canvases · idle shimmer when quiet
 * VER: phone-wave-v1
 */
(function () {
  "use strict";
  var VER = "phone-wave-v1";
  if (window.__mgPhoneWaveVer === VER) return;
  window.__mgPhoneWaveVer = VER;

  function $(id) {
    return document.getElementById(id);
  }

  function ensureMarkup() {
    var box = $("wave-box");
    if (box) return box;
    var slot = document.getElementById("mg-wave-slot") || document.querySelector(".mg-top");
    box = document.createElement("div");
    box.id = "wave-box";
    box.className = "mg-wave";
    box.setAttribute("aria-label", "Audio waveform L R M");
    box.innerHTML =
      '<div class="whd"><span>AUDIO · L / R / M</span><span class="ws off" id="wave-src">idle</span></div>' +
      '<div class="lane L"><span class="ch">L</span><canvas id="wL" width="720" height="48"></canvas><span class="db" id="dbL">—</span></div>' +
      '<div class="lane R"><span class="ch">R</span><canvas id="wR" width="720" height="48"></canvas><span class="db" id="dbR">—</span></div>' +
      '<div class="lane M"><span class="ch">M</span><canvas id="wM" width="720" height="48"></canvas><span class="db" id="dbM">—</span></div>';
    if (slot && slot.parentNode) {
      if (slot.id === "mg-wave-slot") {
        slot.appendChild(box);
      } else {
        slot.insertAdjacentElement("afterend", box);
      }
    } else {
      document.body.insertBefore(box, document.body.firstChild);
    }
    return box;
  }

  var base =
    location.port === "9877" || location.port === "9878"
      ? location.origin
      : location.protocol + "//" + location.hostname + ":9877";
  var phase = 0;
  var last = { L: [], R: [], M: [], rms: { L: 0, R: 0, M: 0 }, lab: "idle", ok: false };
  var raf = 0;

  function setSrc(lab, ok) {
    var el = $("wave-src");
    if (!el) return;
    el.textContent = lab || "idle";
    el.classList.toggle("off", !ok);
  }

  function db(rms) {
    if (!rms || rms < 1e-5) return "—";
    var v = 20 * Math.log10(Math.max(rms, 1e-5));
    return (v < -60 ? "−∞" : v.toFixed(0)) + " dB";
  }

  function paintLane(id, samples, color, rms) {
    var cv = $(id);
    if (!cv) return;
    var ctx = cv.getContext("2d");
    var w = cv.width;
    var h = cv.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, w, h);
    var arr = samples && samples.length ? samples : null;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (arr) {
      for (var i = 0; i < arr.length; i++) {
        var x = (i / Math.max(1, arr.length - 1)) * w;
        var y = h * 0.5 - (arr[i] || 0) * h * 0.42;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else {
      /* idle shimmer */
      for (var j = 0; j < 64; j++) {
        var x2 = (j / 63) * w;
        var y2 =
          h * 0.5 +
          Math.sin(phase * 0.08 + j * 0.35) * h * 0.08 +
          Math.sin(phase * 0.03 + j * 0.12) * h * 0.04;
        if (j === 0) ctx.moveTo(x2, y2);
        else ctx.lineTo(x2, y2);
      }
      ctx.globalAlpha = 0.55;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    var dbEl = $("db" + id.charAt(1));
    if (dbEl) dbEl.textContent = db(rms);
  }

  function draw() {
    phase += 1;
    paintLane("wL", last.L, "#6ec8ff", last.rms.L);
    paintLane("wR", last.R, "#ffb078", last.rms.R);
    paintLane("wM", last.M, "#7aebb0", last.rms.M);
    raf = requestAnimationFrame(draw);
  }

  function pull() {
    fetch(base + "/wave?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (j) {
        if (!j) {
          setSrc("idle", false);
          return;
        }
        var w = j.wave || {};
        last.L = w.L || j.L || [];
        last.R = w.R || j.R || [];
        last.M = w.M || j.M || [];
        var rms = j.rms || j.levels || {};
        last.rms = {
          L: +rms.L || +j.Lrms || 0,
          R: +rms.R || +j.Rrms || 0,
          M: +rms.M || +j.Mrms || 0,
        };
        var age = j.age_s != null ? +j.age_s : j.t ? Date.now() / 1000 - j.t : 99;
        var live = age < 4 && (last.L.length || last.rms.M > 0.01 || last.rms.L > 0.01);
        setSrc(live ? "live · hub" : "idle", !!live);
        last.ok = !!live;
      })
      .catch(function () {
        setSrc("idle", false);
      });
  }

  function boot() {
    ensureMarkup();
    setSrc("idle", false);
    if (!raf) raf = requestAnimationFrame(draw);
    pull();
    setInterval(pull, 400);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.__mgPhoneWave = {
    setBase: function (b) {
      if (b) base = b;
    },
    refresh: pull,
  };
})();
