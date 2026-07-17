/**
 * Memory Glass — parallax · lidar dots · soft aperture · fullscreen
 * Tonality: fleeting focus · SpaceX blueprint float · droplet rim
 * Design: docs/architecture-lab/content/32-memory-glass-browser.md
 */
(function () {
  "use strict";

  const KEY = "lab.browser.memoryGlass";
  const FULL_KEY = "lab.browser.memoryGlass.full";

  function $(id) {
    return document.getElementById(id);
  }

  function loadOn() {
    try {
      const v = localStorage.getItem(KEY);
      if (v === null) return true; // default ON — this is the memory surface
      return v === "1";
    } catch (_) {
      return true;
    }
  }

  function saveOn(on) {
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch (_) {}
  }

  function setGlass(on) {
    document.body.classList.toggle("memory-glass", !!on);
    const btn = $("btn-memory-glass");
    if (btn) {
      btn.classList.toggle("on", !!on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.title = on
        ? "Memory glass ON — soft droplet edges · parallax · lidar"
        : "Memory glass OFF — hard chrome";
    }
    saveOn(on);
    if (on) {
      paintLidar(true);
      bindParallax(true);
    } else {
      bindParallax(false);
    }
  }

  function setFull(on) {
    document.body.classList.toggle("mg-full", !!on);
    try {
      localStorage.setItem(FULL_KEY, on ? "1" : "0");
    } catch (_) {}
    const btn = $("btn-memory-full");
    if (btn) {
      btn.classList.toggle("on", !!on);
      btn.textContent = on ? "Window" : "Full glass";
    }
    // Prefer native maximize when available
    if (on && window.LabDesktop && window.LabDesktop.control) {
      try {
        fetch("/api/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "maximize", target: "browser" }),
        }).catch(function () {});
      } catch (_) {}
    }
    if (on && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () {});
    } else if (!on && document.fullscreenElement) {
      document.exitFullscreen().catch(function () {});
    }
  }

  /* ── Lidar / point-cloud / supersplat distance field ── */
  let lidarRaf = 0;
  let lidarDots = [];

  function initLidar() {
    const c = $("mg-lidar");
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      c.width = Math.floor(c.clientWidth * dpr);
      c.height = Math.floor(c.clientHeight * dpr);
      seedDots(c.width, c.height);
    }
    resize();
    window.addEventListener("resize", resize);
    paintLidar(true);
  }

  function seedDots(w, h) {
    lidarDots = [];
    const n = Math.floor((w * h) / 9000);
    for (let i = 0; i < n; i++) {
      lidarDots.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random(), // 0 near · 1 far
        s: 0.6 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function paintLidar(run) {
    const c = $("mg-lidar");
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    cancelAnimationFrame(lidarRaf);
    if (!run || !document.body.classList.contains("memory-glass")) {
      ctx.clearRect(0, 0, c.width, c.height);
      return;
    }

    const t0 = performance.now();
    function frame(t) {
      if (!document.body.classList.contains("memory-glass")) return;
      const w = c.width;
      const h = c.height;
      ctx.clearRect(0, 0, w, h);
      const tt = (t - t0) * 0.001;
      // soft semicircle focus band (~120° toward viewer)
      for (let i = 0; i < lidarDots.length; i++) {
        const d = lidarDots[i];
        const flutter = 0.5 + 0.5 * Math.sin(tt * 1.2 + d.phase);
        const depth = d.z;
        const alpha = (0.15 + (1 - depth) * 0.55) * (0.65 + flutter * 0.35);
        const r = d.s * (0.7 + (1 - depth) * 1.4);
        // slight drift — memory not fixed
        const x = d.x + Math.sin(tt * 0.3 + d.phase) * (4 + depth * 8);
        const y = d.y + Math.cos(tt * 0.25 + d.phase) * (3 + depth * 6);
        ctx.beginPath();
        ctx.fillStyle =
          depth < 0.35
            ? "rgba(180,230,255," + alpha + ")"
            : depth < 0.7
              ? "rgba(110,203,255," + alpha * 0.85 + ")"
              : "rgba(100,120,160," + alpha * 0.5 + ")";
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // sparse scan arcs (LiDAR sweep suggestion)
      ctx.strokeStyle = "rgba(110,203,255," + (0.04 + 0.03 * Math.sin(tt)) + ")";
      ctx.lineWidth = 1;
      const cx = w * 0.5;
      const cy = h * 0.55;
      for (let a = 0; a < 5; a++) {
        const rad = h * (0.18 + a * 0.09) + Math.sin(tt + a) * 6;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      lidarRaf = requestAnimationFrame(frame);
    }
    lidarRaf = requestAnimationFrame(frame);
  }

  /* ── Parallax (pointer = head tilt) ── */
  let paraBound = false;
  function onMove(e) {
    if (!document.body.classList.contains("memory-glass")) return;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const nx = (e.clientX / w - 0.5) * 2;
    const ny = (e.clientY / h - 0.5) * 2;
    document.body.style.setProperty("--mg-px", nx * 6 + "px");
    document.body.style.setProperty("--mg-py", ny * 4 + "px");
    document.querySelectorAll(".mg-parallax-layer").forEach(function (el, i) {
      const d = (i + 1) * 4;
      el.style.transform =
        "translate3d(" + nx * d * 2 + "px," + ny * d * 1.5 + "px,0)";
    });
  }

  function bindParallax(on) {
    if (on && !paraBound) {
      window.addEventListener("pointermove", onMove, { passive: true });
      paraBound = true;
    }
    if (!on && paraBound) {
      window.removeEventListener("pointermove", onMove);
      paraBound = false;
      document.body.style.setProperty("--mg-px", "0px");
      document.body.style.setProperty("--mg-py", "0px");
    }
  }

  /* ── Ensure DOM structure ── */
  function ensureDom() {
    if ($("mg-void")) return;

    const voidEl = document.createElement("div");
    voidEl.className = "mg-void";
    voidEl.id = "mg-void";
    voidEl.setAttribute("aria-hidden", "true");
    voidEl.innerHTML =
      '<div class="mg-parallax-layer l1"></div>' +
      '<div class="mg-parallax-layer l2"></div>' +
      '<div class="mg-parallax-layer l3"></div>' +
      '<canvas id="mg-lidar"></canvas>';
    document.body.insertBefore(voidEl, document.body.firstChild);

    // Wrap existing chrome + shell into mg-stage
    const chrome = document.querySelector(".xb-chrome");
    const shell = document.getElementById("xb-shell");
    if (!chrome || !shell) return;

    const stage = document.createElement("div");
    stage.className = "mg-stage";
    stage.id = "mg-stage";

    const caustic = document.createElement("div");
    caustic.className = "mg-caustic";
    caustic.setAttribute("aria-hidden", "true");

    const sheet = document.createElement("div");
    sheet.className = "mg-glass-sheet";
    sheet.setAttribute("aria-hidden", "true");

    const inner = document.createElement("div");
    inner.className = "mg-inner";
    inner.id = "mg-inner";

    chrome.parentNode.insertBefore(stage, chrome);
    stage.appendChild(caustic);
    stage.appendChild(sheet);
    stage.appendChild(inner);
    inner.appendChild(chrome);
    inner.appendChild(shell);

    // footer if present
    const footer = document.querySelector(".xb-footer-search, .xb-footer");
    if (footer && footer.parentNode !== inner) {
      inner.appendChild(footer);
    }

    // focus veil on feed body
    const feed =
      document.querySelector(".xb-feed-body") ||
      document.querySelector(".xb-center");
    if (feed && !feed.querySelector(".mg-focus-veil")) {
      const veil = document.createElement("div");
      veil.className = "mg-focus-veil";
      veil.setAttribute("aria-hidden", "true");
      feed.style.position = feed.style.position || "relative";
      feed.appendChild(veil);
    }

    // controls in chrome
    const nav = document.querySelector(".xb-chrome .xb-nav") || chrome;
    if (!$("btn-memory-glass")) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "xb-btn mg-toggle";
      b.id = "btn-memory-glass";
      b.setAttribute("data-no-drag", "1");
      b.textContent = "Glass";
      b.title = "Memory glass · soft droplet · parallax · lidar";
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        setGlass(!document.body.classList.contains("memory-glass"));
      });
      nav.appendChild(b);
    }
    if (!$("btn-memory-full")) {
      const f = document.createElement("button");
      f.type = "button";
      f.className = "xb-btn";
      f.id = "btn-memory-full";
      f.setAttribute("data-no-drag", "1");
      f.textContent = "Full glass";
      f.title = "Fullscreen soft aperture";
      f.addEventListener("click", function (e) {
        e.stopPropagation();
        setFull(!document.body.classList.contains("mg-full"));
      });
      nav.appendChild(f);
    }
  }

  function init() {
    ensureDom();
    initLidar();
    const on = loadOn();
    setGlass(on);
    try {
      if (localStorage.getItem(FULL_KEY) === "1") setFull(true);
    } catch (_) {}

    window.LabMemoryGlass = {
      on: function () {
        return document.body.classList.contains("memory-glass");
      },
      set: setGlass,
      full: setFull,
      toggle: function () {
        setGlass(!document.body.classList.contains("memory-glass"));
      },
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
