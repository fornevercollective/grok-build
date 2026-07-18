/* Memory Glass · Rubik language solver float (Bloch-style orb + maze panel)
 * Overview: Rubik solver · Snake · live video lab — face→language dual-space.
 * Educational geometry only (kbatch SO / gutter faces).
 * VER: rubik-lang-v1
 */
(function () {
  "use strict";
  var VER = "rubik-lang-v3-no-overlap";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._rubikLangVer === VER) return;
  HP._rubikLangVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "rubik-lang");
    } catch (e) {}
  }

  var BASE = "https://mueee.qbitos.ai/";
  var LINKS = {
    solver: BASE + "rubiks-ugrad.html",
    snake: BASE + "snake-ugrad.html",
    language: BASE + "language-ugrad.html",
    liveLab: BASE + "games-ugrad-hub.html",
    gutter: BASE + "quantum-gutter.html",
    contrail: BASE + "ugrad-contrail.html",
    kbatch: "https://kbatch.ugrad.ai/",
  };

  /* face → language channel (dojo / gutter educational map) */
  var FACES = [
    { id: "U", name: "written", hue: 200, gate: "H/S" },
    { id: "D", name: "spoken", hue: 280, gate: "S/T" },
    { id: "F", name: "movement", hue: 140, gate: "X/Y" },
    { id: "B", name: "digital", hue: 40, gate: "H/X" },
    { id: "L", name: "analog", hue: 320, gate: "Z/S" },
    { id: "R", name: "thought", hue: 170, gate: "H/T" },
  ];

  var orb = null;
  var orbCv = null;
  var panel = null;
  var open = false;
  var spin = 0;
  var lastFace = "U";

  function nav(url) {
    try {
      if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
      else window.open(url, "_blank");
    } catch (e) {
      try {
        window.open(url, "_blank");
      } catch (e2) {}
    }
  }

  function faceFromBloch() {
    try {
      var r = window.__mgBlochSolve && window.__mgBlochSolve.report && window.__mgBlochSolve.report();
      if (r && /SO \w+→([UDFBLR])/.test(r)) return RegExp.$1;
      var g = r && /gate=([A-Z])/.exec(r);
      if (g) {
        var map = { H: "U", S: "D", X: "F", Y: "F", Z: "L", T: "R" };
        return map[g[1]] || lastFace;
      }
    } catch (e) {}
    try {
      var dj = window.__mgContrail && window.__mgContrail.lastDojo && window.__mgContrail.lastDojo();
      var so = dj && dj.phrasingOrders;
      if (so) {
        var best = null,
          n = 0;
        Object.keys(so).forEach(function (k) {
          if (so[k] > n) {
            n = so[k];
            best = k;
          }
        });
        var SO_FACE = {
          SSO: "F",
          OSO: "U",
          SOS: "R",
          OSS: "D",
          SOO: "B",
          OOS: "L",
          SSS: "L",
          OOO: "D",
        };
        if (best && SO_FACE[best]) return SO_FACE[best];
      }
    } catch (e2) {}
    return lastFace;
  }

  function ensureCss() {
    var old = document.getElementById("mg-rubik-lang-css");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "mg-rubik-lang-css";
    st.textContent = [
      /* Orb stacked above BLOCH orb (layout pins); low z so panels cover */
      "#mg-rubik-orb{position:fixed;left:12px;right:auto;bottom:calc(218px + var(--mg-kb-h,0px));",
      "  z-index:2147482985;width:52px;height:52px;border-radius:50%;",
      "  background:rgba(10,12,16,0.45);backdrop-filter:blur(20px) saturate(1.3);",
      "  -webkit-backdrop-filter:blur(20px) saturate(1.3);",
      "  border:1px solid rgba(255,255,255,0.18);",
      "  box-shadow:0 6px 20px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.12);",
      "  pointer-events:auto;cursor:pointer;overflow:hidden}",
      "#mg-rubik-orb canvas{width:100%;height:100%;display:block}",
      "#mg-rubik-orb .lbl{position:absolute;left:0;right:0;bottom:2px;text-align:center;",
      "  font:700 7px/1 system-ui;letter-spacing:0.08em;color:rgba(255,190,120,0.9)}",
      /* Float: right of left rail — WIP stays closed unless user opens */
      "#mg-rubik-float{position:fixed;left:min(300px,22vw);right:auto;top:48px;z-index:2147482996;",
      "  width:min(360px,36vw);max-height:min(70vh,640px);border-radius:14px;overflow:auto;",
      "  background:rgba(10,12,16,0.58);backdrop-filter:blur(24px) saturate(1.4);",
      "  -webkit-backdrop-filter:blur(24px) saturate(1.4);",
      "  border:1px solid rgba(255,255,255,0.18);",
      "  box-shadow:0 10px 32px rgba(0,0,0,0.22),inset 0 1px 0 rgba(255,255,255,0.12);",
      "  font:650 10px/1.35 system-ui;color:rgba(244,246,250,0.94);pointer-events:auto}",
      "#mg-rubik-float.hidden{display:none}",
      "#mg-rubik-float .hd{display:flex;justify-content:space-between;align-items:center;",
      "  padding:8px 12px;letter-spacing:0.1em;text-transform:uppercase;",
      "  border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,190,120,0.95);",
      "  position:sticky;top:0;background:rgba(10,12,16,0.85);z-index:1}",
      "#mg-rubik-float .hd button{appearance:none;background:transparent;border:0;color:inherit;",
      "  cursor:pointer;font:700 12px/1 system-ui}",
      "#mg-rubik-float .body{padding:10px 12px 12px}",
      "#mg-rubik-float .faces{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}",
      "#mg-rubik-float .face{padding:8px 10px;border-radius:8px;",
      "  background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);",
      "  font:600 9px/1.3 ui-monospace,Menlo,monospace}",
      "#mg-rubik-float .face.on{border-color:rgba(255,200,120,0.65);",
      "  box-shadow:0 0 12px rgba(255,180,80,0.28)}",
      "#mg-rubik-float .face b{display:block;font-size:13px;letter-spacing:0.06em;margin-bottom:2px}",
      "#mg-rubik-float .links{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}",
      "#mg-rubik-float .links button{appearance:none;cursor:pointer;",
      "  padding:7px 11px;border-radius:999px;font:700 9px/1 system-ui;letter-spacing:0.06em;",
      "  color:rgba(240,245,255,0.95);background:rgba(255,255,255,0.08);",
      "  border:1px solid rgba(255,255,255,0.14)}",
      "#mg-rubik-float .links button.hot{background:rgba(255,160,60,0.22);",
      "  border-color:rgba(255,180,100,0.45)}",
      "#mg-rubik-float .links button.ok{background:rgba(80,220,160,0.15);",
      "  border-color:rgba(100,220,160,0.35)}",
      "#mg-rubik-float .ft{padding:6px 12px 8px;font:500 9px/1.3 ui-monospace,Menlo,monospace;",
      "  color:rgba(180,200,160,0.85);border-top:1px solid rgba(255,255,255,0.08)}",
      "#mg-rubik-float canvas.cube{width:100%;height:min(200px,28vh);display:block;margin:6px 0;",
      "  border-radius:10px;background:rgba(4,8,14,0.55)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function ensureOrb() {
    if (orb || document.getElementById("mg-rubik-orb")) return;
    ensureCss();
    orb = document.createElement("div");
    orb.id = "mg-rubik-orb";
    orb.title = "Rubik language · click → float";
    orb.innerHTML = '<canvas id="mg-rubik-orb-cv"></canvas><div class="lbl">RUBIK</div>';
    (document.body || document.documentElement).appendChild(orb);
    orbCv = orb.querySelector("canvas");
    orb.onclick = function () {
      toggle();
    };
  }

  function paintOrb() {
    ensureOrb();
    if (!orbCv) return;
    lastFace = faceFromBloch();
    spin += 0.04;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = 56,
      H = 56;
    orbCv.width = Math.floor(W * dpr);
    orbCv.height = Math.floor(H * dpr);
    var ctx = orbCv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var cx = 28,
      cy = 24;
    /* isometric mini cube */
    var s = 9;
    var ox = Math.cos(spin) * 2;
    var faces = [
      { pts: [[cx - s + ox, cy], [cx + ox, cy - s * 0.55], [cx + s + ox, cy], [cx + ox, cy + s * 0.55]], c: "hsla(200,80%,60%,0.85)" },
      { pts: [[cx - s + ox, cy], [cx + ox, cy + s * 0.55], [cx + ox, cy + s * 1.15], [cx - s + ox, cy + s * 0.6]], c: "hsla(140,70%,50%,0.8)" },
      { pts: [[cx + s + ox, cy], [cx + ox, cy + s * 0.55], [cx + ox, cy + s * 1.15], [cx + s + ox, cy + s * 0.6]], c: "hsla(40,90%,55%,0.8)" },
    ];
    faces.forEach(function (f) {
      ctx.beginPath();
      f.pts.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      });
      ctx.closePath();
      ctx.fillStyle = f.c;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.stroke();
    });
  }

  function ensurePanel() {
    if (panel) return;
    ensureCss();
    panel = document.createElement("div");
    panel.id = "mg-rubik-float";
    panel.className = open ? "" : "hidden";
    panel.innerHTML =
      '<div class="hd"><span>Rubik · language</span>' +
      '<button type="button" id="mg-rubik-x">×</button></div>' +
      '<div class="body">' +
      '<div style="opacity:0.8;margin-bottom:4px">Solver · snake · live lab · face→channel</div>' +
      '<canvas class="cube" id="mg-rubik-cube"></canvas>' +
      '<div class="faces" id="mg-rubik-faces"></div>' +
      '<div class="links" id="mg-rubik-links"></div>' +
      "</div>" +
      '<div class="ft" id="mg-rubik-ft">face U · written</div>';
    (document.body || document.documentElement).appendChild(panel);
    panel.querySelector("#mg-rubik-x").onclick = function () {
      close();
    };
    var facesEl = panel.querySelector("#mg-rubik-faces");
    FACES.forEach(function (F) {
      var d = document.createElement("div");
      d.className = "face";
      d.dataset.face = F.id;
      d.innerHTML =
        "<b style=\"color:hsl(" +
        F.hue +
        ",75%,68%)\">" +
        F.id +
        "</b>" +
        F.name +
        " · " +
        F.gate;
      facesEl.appendChild(d);
    });
    var links = panel.querySelector("#mg-rubik-links");
    [
      { label: "SOLVER", url: LINKS.solver, cls: "hot" },
      { label: "SNAKE", url: LINKS.snake, cls: "ok" },
      { label: "LANG", url: LINKS.language, cls: "" },
      { label: "LIVE LAB", url: LINKS.liveLab, cls: "hot" },
      { label: "GUTTER", url: LINKS.gutter, cls: "" },
      { label: "KBATCH", url: LINKS.kbatch, cls: "ok" },
      {
        label: "VID",
        cls: "",
        fn: function () {
          try {
            if (window.__mgGlassCap && window.__mgGlassCap.setMode)
              window.__mgGlassCap.setMode("vid");
            else if (window.__mgVideoFeed && window.__mgVideoFeed.open)
              window.__mgVideoFeed.open();
            else nav(LINKS.liveLab);
          } catch (e) {
            nav(LINKS.liveLab);
          }
        },
      },
    ].forEach(function (L) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = L.cls || "";
      b.textContent = L.label;
      b.onclick = function () {
        if (L.fn) L.fn();
        else nav(L.url);
      };
      links.appendChild(b);
    });
  }

  function paintCube() {
    if (!open || !panel) return;
    var cv = panel.querySelector("#mg-rubik-cube");
    if (!cv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = cv.clientWidth || 240;
    var H = 88;
    cv.width = Math.floor(W * dpr);
    cv.height = Math.floor(H * dpr);
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(4,8,14,0.4)";
    ctx.fillRect(0, 0, W, H);
    var cx = W * 0.28,
      cy = H * 0.48,
      s = 22;
    var t = Date.now() / 1800;
    var ox = Math.cos(t) * 3;
    function poly(pts, col) {
      ctx.beginPath();
      pts.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      });
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.stroke();
    }
    poly(
      [
        [cx - s + ox, cy],
        [cx + ox, cy - s * 0.58],
        [cx + s + ox, cy],
        [cx + ox, cy + s * 0.58],
      ],
      "hsla(200,80%,55%,0.9)"
    );
    poly(
      [
        [cx - s + ox, cy],
        [cx + ox, cy + s * 0.58],
        [cx + ox, cy + s * 1.2],
        [cx - s + ox, cy + s * 0.62],
      ],
      "hsla(140,70%,45%,0.88)"
    );
    poly(
      [
        [cx + s + ox, cy],
        [cx + ox, cy + s * 0.58],
        [cx + ox, cy + s * 1.2],
        [cx + s + ox, cy + s * 0.62],
      ],
      "hsla(40,90%,52%,0.88)"
    );
    /* face legend strip */
    var x0 = W * 0.52;
    FACES.forEach(function (F, i) {
      var y = 10 + i * 12;
      ctx.fillStyle = "hsla(" + F.hue + ",75%,58%,0.95)";
      ctx.fillRect(x0, y, 10, 8);
      ctx.fillStyle = F.id === lastFace ? "rgba(255,230,180,0.98)" : "rgba(210,220,230,0.75)";
      ctx.font = "600 9px ui-monospace,Menlo,monospace";
      ctx.fillText(F.id + " " + F.name, x0 + 14, y + 7);
    });
  }

  function refresh() {
    lastFace = faceFromBloch();
    if (!open || !panel) return;
    panel.querySelectorAll(".face").forEach(function (el) {
      el.classList.toggle("on", el.dataset.face === lastFace);
    });
    var ft = panel.querySelector("#mg-rubik-ft");
    var F = FACES.filter(function (x) {
      return x.id === lastFace;
    })[0];
    if (ft)
      ft.textContent =
        "face " +
        lastFace +
        " · " +
        (F ? F.name : "?") +
        " · gate " +
        (F ? F.gate : "—") +
        " · " +
        VER;
    paintCube();
  }

  function openPanel() {
    open = true;
    ensurePanel();
    panel.classList.remove("hidden");
    refresh();
  }

  function close() {
    open = false;
    if (panel) panel.classList.add("hidden");
  }

  function toggle() {
    if (open) close();
    else openPanel();
  }

  setInterval(function () {
    paintOrb();
    if (open) refresh();
  }, 120);
  setTimeout(paintOrb, 180);

  /* Manual open/close only — Rubik WIP; use TOOLS when ready, not auto */

  window.__mgRubikLang = {
    ver: VER,
    open: openPanel,
    close: close,
    toggle: toggle,
    isOpen: function () {
      return open;
    },
    face: function () {
      return lastFace;
    },
    links: LINKS,
    report: function () {
      return VER + " face=" + lastFace + " open=" + open;
    },
  };
  log(VER + " · rubik language orb + float");
})();
