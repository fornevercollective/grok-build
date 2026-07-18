/* Memory Glass · Rubik language solver — glass morphism lab float
 * Interactive 3×3 cube · each face takes input from a different lettering system
 * (written / spoken / movement / digital / analog / thought) via lang-codec.
 * Drag to orbit · click stickers · type into active face · scramble / solve.
 * VER: rubik-lang-v5-glass-letter
 */
(function () {
  "use strict";
  var VER = "rubik-lang-v5-glass-letter";
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

  /* face → language channel + lettering alphabet (input source) */
  var FACES = [
    {
      id: "U",
      name: "written",
      hue: 200,
      gate: "H/S",
      lettering: "latin",
      alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      hint: "A–Z · type / latin",
    },
    {
      id: "D",
      name: "spoken",
      hue: 280,
      gate: "S/T",
      lettering: "phonetic",
      alphabet: "əɪʊæɑɔɛʌθðʃʒŋɹ",
      hint: "IPA-ish · spoken",
    },
    {
      id: "F",
      name: "movement",
      hue: 140,
      gate: "X/Y",
      lettering: "motion",
      alphabet: "←↑↓→↖↗↘↙↻↺⊕⊖⊗⊙",
      hint: "arrows · move",
    },
    {
      id: "B",
      name: "digital",
      hue: 40,
      gate: "H/X",
      lettering: "hex",
      alphabet: "0123456789ABCDEF",
      hint: "hex nibble · binary twin",
    },
    {
      id: "L",
      name: "analog",
      hue: 320,
      gate: "Z/S",
      lettering: "steno",
      alphabet: "·–—|/\\_=#~^*+",
      hint: "steno strip · analog",
    },
    {
      id: "R",
      name: "thought",
      hue: 170,
      gate: "H/T",
      lettering: "glyph",
      alphabet: "◉◈◆◇○◎◐◑⬡⬢✦✧",
      hint: "GrokYtalkY glyph · thought",
    },
  ];
  var FACE_BY = {};
  FACES.forEach(function (F) {
    FACE_BY[F.id] = F;
  });

  var FACE_COLOR = {
    U: { hue: 200, hex: "#4cc2ff", soft: "rgba(60,180,255,0.55)" },
    D: { hue: 280, hex: "#c888ff", soft: "rgba(180,100,255,0.55)" },
    F: { hue: 140, hex: "#48e0a0", soft: "rgba(60,220,140,0.55)" },
    B: { hue: 40, hex: "#ffb84a", soft: "rgba(255,170,40,0.55)" },
    L: { hue: 320, hex: "#ff7ec4", soft: "rgba(255,100,180,0.55)" },
    R: { hue: 170, hex: "#50f0d0", soft: "rgba(50,220,190,0.55)" },
  };

  /* 3×3 sticker glyphs per face (row-major) — editable via lettering input */
  var stickers = {};
  FACES.forEach(function (F) {
    stickers[F.id] = [];
    for (var i = 0; i < 9; i++) {
      stickers[F.id][i] =
        i === 4 ? F.id : F.alphabet.charAt(i % F.alphabet.length) || "·";
    }
  });

  var panel = null;
  var open = false;
  var yaw = 0.55;
  var pitch = 0.35;
  var autoSpin = true;
  var lastFace = "U";
  var selSticker = 4; /* center default */
  var dragging = false;
  var lastPx = 0;
  var lastPy = 0;
  var hitFaces = []; /* {id, poly, depth} for click pick */
  var statusEl = null;
  var inputEl = null;
  var letterBar = null;
  var raf = 0;

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

  function faceFromBloch() {
    try {
      var r =
        window.__mgBlochSolve &&
        window.__mgBlochSolve.report &&
        window.__mgBlochSolve.report();
      if (r && /SO \w+→([UDFBLR])/.test(r)) return RegExp.$1;
      var g = r && /gate=([A-Z])/.exec(r);
      if (g) {
        var map = { H: "U", S: "D", X: "F", Y: "F", Z: "L", T: "R" };
        return map[g[1]] || lastFace;
      }
    } catch (e) {}
    try {
      var dj =
        window.__mgContrail &&
        window.__mgContrail.lastDojo &&
        window.__mgContrail.lastDojo();
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

  /** Pull live alphabet glyphs from lang-codec when present */
  function alphabetFor(faceId) {
    var F = FACE_BY[faceId];
    if (!F) return "·";
    try {
      var LC = window.__mgLangCodec;
      if (LC && LC.encode) {
        if (F.lettering === "hex" && LC.encode("MG", "hex")) {
          var hx = LC.encode("hello", "hex");
          if (hx && hx.display)
            return String(hx.display).replace(/\s+/g, "").toUpperCase() + F.alphabet;
        }
        if (F.lettering === "glyph" && LC.encode) {
          var gy = LC.encode("MG", "glyph");
          if (gy && gy.display) return String(gy.display) + F.alphabet;
        }
        if (F.lettering === "ascii" || F.lettering === "latin") {
          var av = LC.encode("ABCDEFGHIJKLMNOPQRSTUVWXYZ", "ascii");
          if (av && av.printable) return av.printable + F.alphabet;
        }
      }
    } catch (e) {}
    return F.alphabet;
  }

  function ensureCss() {
    var old = document.getElementById("mg-rubik-lang-css");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "mg-rubik-lang-css";
    st.textContent = [
      /* ── glass float (match Control Center) ── */
      "#mg-rubik-float{",
      "  position:fixed;left:min(28vw,360px);right:auto;top:52px;z-index:2147483006;",
      "  width:min(420px,92vw);max-height:min(82vh,720px);",
      "  display:flex;flex-direction:column;pointer-events:auto;",
      "  font:500 13px/1.3 -apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif;",
      "  color:rgba(255,255,255,0.94);",
      "  background:rgba(40,40,44,0.52);",
      "  backdrop-filter:blur(48px) saturate(1.8);-webkit-backdrop-filter:blur(48px) saturate(1.8);",
      "  border:1px solid rgba(255,255,255,0.12);border-radius:22px;",
      "  box-shadow:0 18px 48px rgba(0,0,0,0.38),0 0 0 0.5px rgba(255,255,255,0.08),",
      "    inset 0 1px 0 rgba(255,255,255,0.14);",
      "  overflow:hidden}",
      "#mg-rubik-float.hidden{display:none!important}",
      "#mg-rubik-float .hd{",
      "  display:flex;align-items:center;justify-content:space-between;gap:8px;",
      "  padding:12px 14px 10px;flex-shrink:0;",
      "  border-bottom:1px solid rgba(255,255,255,0.1);",
      "  background:rgba(20,22,28,0.35)}",
      "#mg-rubik-float .hd .ttl{",
      "  font:600 12px/1 system-ui;letter-spacing:0.06em;text-transform:uppercase;",
      "  color:rgba(255,210,150,0.98)}",
      "#mg-rubik-float .hd .ttl .dot{",
      "  display:inline-block;width:7px;height:7px;border-radius:50%;",
      "  background:rgba(255,180,80,0.95);margin-right:8px;",
      "  box-shadow:0 0 8px rgba(255,180,80,0.55)}",
      "#mg-rubik-float .hd .acts{display:flex;gap:6px;align-items:center}",
      "#mg-rubik-float .hd button{",
      "  appearance:none;cursor:pointer;border:0;",
      "  background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.92);",
      "  width:28px;height:28px;border-radius:50%;font:600 13px/1 system-ui}",
      "#mg-rubik-float .hd button:hover{background:rgba(255,255,255,0.16)}",
      "#mg-rubik-float .hd button.pill{",
      "  width:auto;padding:0 10px;border-radius:999px;font:600 10px/28px system-ui;",
      "  letter-spacing:0.04em}",
      "#mg-rubik-float .body{flex:1;overflow-y:auto;overflow-x:hidden;padding:10px 12px 12px;",
      "  -webkit-overflow-scrolling:touch}",
      "#mg-rubik-float .hint{",
      "  font:500 11px/1.35 system-ui;color:rgba(200,210,225,0.72);margin:0 0 8px}",
      "#mg-rubik-float canvas.cube{",
      "  width:100%;height:min(260px,36vh);display:block;margin:4px 0 10px;",
      "  border-radius:16px;cursor:grab;",
      "  background:radial-gradient(ellipse at 40% 30%,rgba(80,100,140,0.22),rgba(8,10,16,0.55));",
      "  border:1px solid rgba(255,255,255,0.1);",
      "  box-shadow:inset 0 1px 0 rgba(255,255,255,0.1),0 8px 24px rgba(0,0,0,0.2);",
      "  touch-action:none}",
      "#mg-rubik-float canvas.cube.drag{cursor:grabbing}",
      "#mg-rubik-float .faces{",
      "  display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}",
      "#mg-rubik-float button.face{",
      "  appearance:none;cursor:pointer;text-align:left;",
      "  padding:10px 12px;border-radius:14px;",
      "  background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);",
      "  color:rgba(244,246,250,0.95);font:600 11px/1.25 system-ui;",
      "  transition:background .15s,border-color .15s,box-shadow .15s}",
      "#mg-rubik-float button.face:hover{background:rgba(255,255,255,0.12)}",
      "#mg-rubik-float button.face.on{",
      "  border-color:rgba(255,200,120,0.65);",
      "  box-shadow:0 0 0 1px rgba(255,180,80,0.25),0 8px 20px rgba(255,140,40,0.12);",
      "  background:rgba(255,180,80,0.12)}",
      "#mg-rubik-float button.face b{",
      "  display:block;font-size:15px;letter-spacing:0.08em;margin-bottom:3px}",
      "#mg-rubik-float button.face .sub{",
      "  display:block;font:500 10px/1.2 system-ui;color:rgba(180,200,220,0.6);margin-top:3px}",
      "#mg-rubik-float .letter-bar{",
      "  display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 6px;",
      "  max-height:72px;overflow-y:auto}",
      "#mg-rubik-float .letter-bar button{",
      "  appearance:none;cursor:pointer;min-width:28px;height:28px;padding:0 7px;",
      "  border-radius:8px;font:700 12px/1 ui-monospace,Menlo,system-ui;",
      "  color:rgba(255,255,255,0.95);background:rgba(255,255,255,0.08);",
      "  border:1px solid rgba(255,255,255,0.12)}",
      "#mg-rubik-float .letter-bar button:hover{background:rgba(255,255,255,0.16)}",
      "#mg-rubik-float .letter-bar button.on{",
      "  background:rgba(10,132,255,0.55);border-color:rgba(120,190,255,0.7)}",
      "#mg-rubik-float .input-row{",
      "  display:flex;gap:8px;align-items:center;margin:6px 0 4px}",
      "#mg-rubik-float .input-row input{",
      "  flex:1;appearance:none;border-radius:12px;padding:9px 12px;",
      "  border:1px solid rgba(255,255,255,0.14);",
      "  background:rgba(0,0,0,0.28);color:rgba(255,255,255,0.95);",
      "  font:600 13px/1.2 ui-monospace,Menlo,system-ui;",
      "  outline:none}",
      "#mg-rubik-float .input-row input:focus{",
      "  border-color:rgba(140,200,255,0.55);",
      "  box-shadow:0 0 0 3px rgba(10,132,255,0.2)}",
      "#mg-rubik-float .input-row button.go{",
      "  appearance:none;cursor:pointer;border:0;border-radius:12px;",
      "  padding:9px 14px;font:700 11px/1 system-ui;letter-spacing:0.06em;",
      "  color:#fff;background:rgba(10,132,255,0.9)}",
      "#mg-rubik-float .links{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}",
      "#mg-rubik-float .links button{",
      "  appearance:none;cursor:pointer;padding:8px 12px;border-radius:999px;",
      "  font:700 10px/1 system-ui;letter-spacing:0.05em;",
      "  color:rgba(240,245,255,0.95);background:rgba(255,255,255,0.08);",
      "  border:1px solid rgba(255,255,255,0.14)}",
      "#mg-rubik-float .links button.hot{background:rgba(255,160,60,0.22);",
      "  border-color:rgba(255,180,100,0.45)}",
      "#mg-rubik-float .links button.ok{background:rgba(80,220,160,0.15);",
      "  border-color:rgba(100,220,160,0.35)}",
      "#mg-rubik-float .ft{",
      "  flex-shrink:0;padding:8px 14px;border-top:1px solid rgba(255,255,255,0.08);",
      "  font:500 10px/1.35 ui-monospace,Menlo,monospace;",
      "  color:rgba(180,200,160,0.88);background:rgba(12,14,18,0.35)}",
      /* orb (hidden in drawer mode by CSS elsewhere) */
      "#mg-rubik-orb{position:fixed;left:12px;right:auto;",
      "  bottom:calc(218px + var(--mg-kb-h,0px));z-index:2147482985;",
      "  width:52px;height:52px;border-radius:50%;",
      "  background:rgba(40,40,44,0.55);",
      "  backdrop-filter:blur(28px) saturate(1.5);-webkit-backdrop-filter:blur(28px) saturate(1.5);",
      "  border:1px solid rgba(255,255,255,0.16);",
      "  box-shadow:0 8px 22px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.14);",
      "  pointer-events:auto;cursor:pointer;overflow:hidden}",
      "#mg-rubik-orb canvas{width:100%;height:100%;display:block}",
      "#mg-rubik-orb .lbl{position:absolute;left:0;right:0;bottom:2px;text-align:center;",
      "  font:700 7px/1 system-ui;letter-spacing:0.08em;color:rgba(255,190,120,0.92)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function ensureOrb() {
    if (document.getElementById("mg-rubik-orb")) return;
    ensureCss();
    var orb = document.createElement("div");
    orb.id = "mg-rubik-orb";
    orb.title = "Rubik language · open glass float";
    orb.innerHTML =
      '<canvas id="mg-rubik-orb-cv"></canvas><div class="lbl">RUBIK</div>';
    (document.body || document.documentElement).appendChild(orb);
    orb.onclick = function () {
      toggle();
    };
  }

  /* ── 3D math ── */
  function rotY(p, a) {
    var c = Math.cos(a),
      s = Math.sin(a);
    return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c];
  }
  function rotX(p, a) {
    var c = Math.cos(a),
      s = Math.sin(a);
    return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
  }
  function project(p, cx, cy, s) {
    var z = p[2] + 4.2;
    var f = 3.2 / z;
    return [cx + p[0] * s * f, cy + p[1] * s * f, z];
  }
  function transform(p) {
    return rotX(rotY(p, yaw), pitch);
  }

  function faceDefs() {
    /* unit cube faces: origin + u + v axes, outward normal */
    return [
      { id: "U", o: [-1, -1, -1], u: [2, 0, 0], v: [0, 0, 2], n: [0, -1, 0] },
      { id: "D", o: [-1, 1, -1], u: [2, 0, 0], v: [0, 0, 2], n: [0, 1, 0] },
      { id: "F", o: [-1, -1, 1], u: [2, 0, 0], v: [0, 2, 0], n: [0, 0, 1] },
      { id: "B", o: [1, -1, -1], u: [-2, 0, 0], v: [0, 2, 0], n: [0, 0, -1] },
      { id: "L", o: [-1, -1, -1], u: [0, 0, 2], v: [0, 2, 0], n: [-1, 0, 0] },
      { id: "R", o: [1, -1, 1], u: [0, 0, -2], v: [0, 2, 0], n: [1, 0, 0] },
    ];
  }

  function pointInPoly(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0],
        yi = poly[i][1],
        xj = poly[j][0],
        yj = poly[j][1];
      var inter =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
      if (inter) inside = !inside;
    }
    return inside;
  }

  function paintGlassSticker(ctx, corners, fill, label, hot, depth) {
    ctx.beginPath();
    corners.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath();
    /* glass fill */
    var g = ctx.createLinearGradient(
      corners[0][0],
      corners[0][1],
      corners[2][0],
      corners[2][1]
    );
    g.addColorStop(0, fill);
    g.addColorStop(1, "rgba(8,10,16,0.35)");
    ctx.fillStyle = g;
    ctx.fill();
    /* edge */
    ctx.strokeStyle = hot
      ? "rgba(255,255,255,0.92)"
      : "rgba(255,255,255,0.22)";
    ctx.lineWidth = hot ? 1.8 : 0.9;
    ctx.stroke();
    /* specular */
    ctx.beginPath();
    var mx =
      (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4;
    var my =
      (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4;
    ctx.arc(mx - 3, my - 3, 3.5 / Math.max(0.6, depth * 0.2), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fill();
    if (label != null && label !== "") {
      ctx.fillStyle = hot
        ? "rgba(255,255,255,0.98)"
        : "rgba(8,10,14,0.88)";
      var size = Math.max(9, Math.min(15, 42 / Math.max(1, depth)));
      ctx.font = "700 " + size + "px ui-monospace,Menlo,system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(label), mx, my + 0.5);
    }
  }

  function paintCube(ctx, W, H, mini) {
    hitFaces = [];
    var cx = W * (mini ? 0.5 : 0.42);
    var cy = H * 0.5;
    var s = Math.min(W, H) * (mini ? 0.42 : 0.38);
    var defs = faceDefs();
    var layers = [];

    defs.forEach(function (f) {
      var n = transform(f.n);
      /* backface cull (keep slight edge for mini) */
      if (n[2] < -0.05 && !mini) return;
      var cells = [];
      var i, j;
      for (i = 0; i < 3; i++) {
        for (j = 0; j < 3; j++) {
          var o0 = [
            f.o[0] + f.u[0] * (j / 3) + f.v[0] * (i / 3),
            f.o[1] + f.u[1] * (j / 3) + f.v[1] * (i / 3),
            f.o[2] + f.u[2] * (j / 3) + f.v[2] * (i / 3),
          ];
          var o1 = [
            f.o[0] + f.u[0] * ((j + 1) / 3) + f.v[0] * (i / 3),
            f.o[1] + f.u[1] * ((j + 1) / 3) + f.v[1] * (i / 3),
            f.o[2] + f.u[2] * ((j + 1) / 3) + f.v[2] * (i / 3),
          ];
          var o2 = [
            f.o[0] + f.u[0] * ((j + 1) / 3) + f.v[0] * ((i + 1) / 3),
            f.o[1] + f.u[1] * ((j + 1) / 3) + f.v[1] * ((i + 1) / 3),
            f.o[2] + f.u[2] * ((j + 1) / 3) + f.v[2] * ((i + 1) / 3),
          ];
          var o3 = [
            f.o[0] + f.u[0] * (j / 3) + f.v[0] * ((i + 1) / 3),
            f.o[1] + f.u[1] * (j / 3) + f.v[1] * ((i + 1) / 3),
            f.o[2] + f.u[2] * (j / 3) + f.v[2] * ((i + 1) / 3),
          ];
          var pts3 = [o0, o1, o2, o3].map(function (p) {
            return project(transform(p), cx, cy, s);
          });
          var z =
            (pts3[0][2] + pts3[1][2] + pts3[2][2] + pts3[3][2]) / 4;
          var idx = i * 3 + j;
          var lab = stickers[f.id] ? stickers[f.id][idx] : "";
          cells.push({
            face: f.id,
            idx: idx,
            poly: pts3.map(function (p) {
              return [p[0], p[1]];
            }),
            z: z,
            lab: lab,
            hot: f.id === lastFace && idx === selSticker,
          });
        }
      }
      var depth = cells.reduce(function (a, c) {
        return a + c.z;
      }, 0) / cells.length;
      layers.push({ id: f.id, cells: cells, depth: depth, n: n });
    });

    layers.sort(function (a, b) {
      return b.depth - a.depth;
    });

    layers.forEach(function (L) {
      L.cells.sort(function (a, b) {
        return b.z - a.z;
      });
      L.cells.forEach(function (c) {
        var col = FACE_COLOR[c.face] ? FACE_COLOR[c.face].soft : "rgba(120,120,120,0.5)";
        if (c.face === lastFace) col = FACE_COLOR[c.face].hex;
        paintGlassSticker(ctx, c.poly, col, mini && c.idx !== 4 ? "" : c.lab, c.hot, c.z);
        hitFaces.push({
          face: c.face,
          idx: c.idx,
          poly: c.poly,
          z: c.z,
        });
      });
    });
  }

  function paintOrb() {
    ensureOrb();
    var orbCv = document.getElementById("mg-rubik-orb-cv");
    if (!orbCv) return;
    if (autoSpin && !dragging) yaw += 0.02;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = 56,
      H = 56;
    orbCv.width = Math.floor(W * dpr);
    orbCv.height = Math.floor(H * dpr);
    var ctx = orbCv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    paintCube(ctx, W, H, true);
  }

  function paintMain() {
    if (!open || !panel) return;
    var cv = panel.querySelector("#mg-rubik-cube");
    if (!cv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = Math.max(240, cv.clientWidth || 320);
    var H = Math.max(180, Math.min(280, cv.clientHeight || 240));
    cv.width = Math.floor(W * dpr);
    cv.height = Math.floor(H * dpr);
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (autoSpin && !dragging) yaw += 0.012;
    paintCube(ctx, W, H, false);
  }

  function setStatus(s) {
    if (statusEl) statusEl.textContent = s || VER;
  }

  function paintLetterBar() {
    if (!letterBar) return;
    letterBar.innerHTML = "";
    var F = FACE_BY[lastFace];
    if (!F) return;
    var alpha = alphabetFor(lastFace);
    var seen = {};
    for (var i = 0; i < alpha.length && i < 48; i++) {
      var ch = alpha.charAt(i);
      if (seen[ch]) continue;
      seen[ch] = 1;
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = ch;
      b.title = "Stamp sticker · " + F.lettering;
      if (stickers[lastFace] && stickers[lastFace][selSticker] === ch)
        b.className = "on";
      (function (c) {
        b.onclick = function (ev) {
          if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
          }
          stamp(c);
        };
      })(ch);
      letterBar.appendChild(b);
    }
  }

  function refreshFacesUI() {
    if (!panel) return;
    panel.querySelectorAll("button.face").forEach(function (el) {
      el.classList.toggle("on", el.dataset.face === lastFace);
    });
    paintLetterBar();
    var F = FACE_BY[lastFace];
    setStatus(
      "face " +
        lastFace +
        " · " +
        (F ? F.name : "?") +
        " · " +
        (F ? F.lettering : "—") +
        " · sticker " +
        selSticker +
        " · " +
        (F ? F.hint : "")
    );
    if (inputEl) {
      inputEl.placeholder =
        (F ? F.lettering : "face") + " · type glyph for sticker " + selSticker;
    }
  }

  function stamp(ch) {
    if (!stickers[lastFace]) return;
    stickers[lastFace][selSticker] = String(ch || "·").charAt(0) || "·";
    /* center keeps face id for orientation unless user overrides */
    refreshFacesUI();
    paintMain();
    try {
      if (window.__mgLangCodec && window.__mgLangCodec.encode) {
        var enc = window.__mgLangCodec.encode(String(ch), FACE_BY[lastFace].lettering === "hex" ? "hex" : FACE_BY[lastFace].lettering === "glyph" ? "glyph" : "ascii");
        if (enc && enc.display)
          setStatus(
            "face " +
              lastFace +
              " stamped " +
              ch +
              " · codec " +
              (enc.format || "") +
              " · " +
              String(enc.display).slice(0, 40)
          );
      }
    } catch (e) {}
  }

  function applyInputText(text) {
    var t = String(text || "");
    if (!t) return;
    var F = FACE_BY[lastFace];
    var alpha = alphabetFor(lastFace);
    /* map chars onto face stickers left-to-right, skip center pin if needed */
    var i = 0;
    for (var k = 0; k < t.length && i < 9; k++) {
      var ch = t.charAt(k);
      if (ch === " ") continue;
      /* if not in alphabet, still accept (user free input) */
      if (alpha.indexOf(ch) < 0 && F && F.lettering === "latin")
        ch = ch.toUpperCase();
      stickers[lastFace][i] = ch;
      i++;
    }
    selSticker = Math.min(8, Math.max(0, i - 1));
    refreshFacesUI();
    paintMain();
  }

  function scramble() {
    FACES.forEach(function (F) {
      var a = alphabetFor(F.id);
      for (var i = 0; i < 9; i++) {
        if (i === 4) stickers[F.id][i] = F.id;
        else stickers[F.id][i] = a.charAt(Math.floor(Math.random() * a.length)) || "·";
      }
    });
    setStatus("scrambled · all faces · lettering chaos");
    paintMain();
    paintLetterBar();
  }

  function solveHome() {
    FACES.forEach(function (F) {
      for (var i = 0; i < 9; i++) {
        stickers[F.id][i] =
          i === 4 ? F.id : F.alphabet.charAt(i % F.alphabet.length) || "·";
      }
    });
    lastFace = "U";
    selSticker = 4;
    setStatus("solved home · face lettering restored");
    refreshFacesUI();
    paintMain();
  }

  function pickAt(clientX, clientY, cv) {
    var rect = cv.getBoundingClientRect();
    var x = ((clientX - rect.left) / rect.width) * (cv.clientWidth || rect.width);
    var y = ((clientY - rect.top) / rect.height) * (cv.clientHeight || rect.height);
    /* scale: paint used clientWidth — hitFaces already in that space */
    var sx = (cv.clientWidth || rect.width) / rect.width;
    var sy = (cv.clientHeight || rect.height) / rect.height;
    x = (clientX - rect.left) * sx;
    y = (clientY - rect.top) * sy;
    var best = null;
    hitFaces.forEach(function (h) {
      if (pointInPoly(x, y, h.poly)) {
        if (!best || h.z < best.z) best = h;
      }
    });
    return best;
  }

  function bindCube(cv) {
    if (!cv || cv.__mgRubikBound) return;
    cv.__mgRubikBound = true;
    cv.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      dragging = false;
      lastPx = e.clientX;
      lastPy = e.clientY;
      cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      cv.classList.add("drag");
      autoSpin = false;
    });
    cv.addEventListener("pointermove", function (e) {
      if (!(e.buttons & 1) && e.pressure === 0 && !cv.hasPointerCapture)
        return;
      if (!cv.hasPointerCapture || (e.buttons & 1) === 0) {
        /* still allow move after down with capture */
      }
      var dx = e.clientX - lastPx;
      var dy = e.clientY - lastPy;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragging = true;
      if (dragging || (e.buttons & 1)) {
        yaw += dx * 0.012;
        pitch = Math.max(-1.1, Math.min(1.1, pitch + dy * 0.012));
        lastPx = e.clientX;
        lastPy = e.clientY;
        paintMain();
      }
    });
    function endDrag(e) {
      cv.classList.remove("drag");
      try {
        cv.releasePointerCapture && cv.releasePointerCapture(e.pointerId);
      } catch (err) {}
      if (!dragging) {
        var hit = pickAt(e.clientX, e.clientY, cv);
        if (hit) {
          lastFace = hit.face;
          selSticker = hit.idx;
          refreshFacesUI();
          paintMain();
        }
      }
      dragging = false;
    }
    cv.addEventListener("pointerup", endDrag);
    cv.addEventListener("pointercancel", endDrag);
    cv.addEventListener("dblclick", function () {
      autoSpin = !autoSpin;
      setStatus(autoSpin ? "auto-spin on" : "auto-spin off · drag to orbit");
    });
  }

  function ensurePanel() {
    if (panel && document.body.contains(panel)) {
      if (window.__mgRubikLang && window.__mgRubikLang.ver === VER) return;
      try {
        if (panel.parentNode) panel.parentNode.removeChild(panel);
      } catch (e) {}
      panel = null;
    }
    ensureCss();
    panel = document.createElement("div");
    panel.id = "mg-rubik-float";
    panel.className = open ? "" : "hidden";
    panel.innerHTML =
      '<div class="hd">' +
      '  <div class="ttl"><span class="dot"></span>Rubik · language</div>' +
      '  <div class="acts">' +
      '    <button type="button" class="pill" id="mg-rubik-spin" title="Toggle spin">SPIN</button>' +
      '    <button type="button" class="pill" id="mg-rubik-scram" title="Scramble">SCR</button>' +
      '    <button type="button" class="pill" id="mg-rubik-solve" title="Solve home">SOL</button>' +
      '    <button type="button" id="mg-rubik-x" title="Close">×</button>' +
      "  </div>" +
      "</div>" +
      '<div class="body">' +
      '  <p class="hint">Glass cube · drag to orbit · click a sticker · stamp lettering from that face\'s alphabet (written / spoken / motion / hex / steno / glyph).</p>' +
      '  <canvas class="cube" id="mg-rubik-cube" title="Drag orbit · click sticker"></canvas>' +
      '  <div class="faces" id="mg-rubik-faces"></div>' +
      '  <div class="letter-bar" id="mg-rubik-letters"></div>' +
      '  <div class="input-row">' +
      '    <input id="mg-rubik-in" type="text" autocomplete="off" spellcheck="false" placeholder="Type face lettering…" />' +
      '    <button type="button" class="go" id="mg-rubik-go">STAMP</button>' +
      "  </div>" +
      '  <div class="links" id="mg-rubik-links"></div>' +
      "</div>" +
      '<div class="ft" id="mg-rubik-ft">face U · written · latin</div>';
    (document.body || document.documentElement).appendChild(panel);
    statusEl = panel.querySelector("#mg-rubik-ft");
    inputEl = panel.querySelector("#mg-rubik-in");
    letterBar = panel.querySelector("#mg-rubik-letters");

    panel.querySelector("#mg-rubik-x").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      close();
    };
    panel.querySelector("#mg-rubik-spin").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      autoSpin = !autoSpin;
      setStatus(autoSpin ? "auto-spin on" : "spin off");
    };
    panel.querySelector("#mg-rubik-scram").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      scramble();
    };
    panel.querySelector("#mg-rubik-solve").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      solveHome();
    };
    panel.querySelector("#mg-rubik-go").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      applyInputText(inputEl && inputEl.value);
    };
    if (inputEl) {
      inputEl.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          applyInputText(inputEl.value);
        } else if (ev.key.length === 1 && !ev.metaKey && !ev.ctrlKey) {
          /* live stamp single glyph into selected sticker */
          setTimeout(function () {
            var v = inputEl.value;
            if (v.length === 1) stamp(v);
          }, 0);
        }
      });
    }

    var facesEl = panel.querySelector("#mg-rubik-faces");
    FACES.forEach(function (F) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "face";
      b.dataset.face = F.id;
      b.innerHTML =
        '<b style="color:hsl(' +
        F.hue +
        ',78%,70%)">' +
        F.id +
        " · " +
        F.name +
        "</b>" +
        F.lettering +
        " · gate " +
        F.gate +
        '<span class="sub">' +
        F.hint +
        "</span>";
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        lastFace = F.id;
        selSticker = 4;
        refreshFacesUI();
        paintMain();
      };
      facesEl.appendChild(b);
    });

    var links = panel.querySelector("#mg-rubik-links");
    [
      { label: "SOLVER", cls: "hot", url: LINKS.solver },
      { label: "LANG", url: LINKS.language },
      { label: "SNAKE", cls: "ok", url: LINKS.snake },
      { label: "GUTTER", url: LINKS.gutter },
      { label: "KBATCH", cls: "ok", url: LINKS.kbatch },
      {
        label: "CODEC",
        cls: "hot",
        fn: function () {
          if (window.__mgFloatKb && window.__mgFloatKb.launch)
            window.__mgFloatKb.launch({
              mode: "codec",
              codec: FACE_BY[lastFace].lettering === "hex" ? "hex" : "glyph",
              text: stickers[lastFace].join(""),
            });
        },
      },
      {
        label: "BLOCH",
        fn: function () {
          if (window.__mgBlochSolve) {
            if (window.__mgBlochSolve.setEnabled)
              window.__mgBlochSolve.setEnabled(true);
            if (window.__mgBlochSolve.open) window.__mgBlochSolve.open();
          }
        },
      },
    ].forEach(function (L) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = L.cls || "";
      b.textContent = L.label;
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        if (L.fn) L.fn();
        else nav(L.url);
      };
      links.appendChild(b);
    });

    bindCube(panel.querySelector("#mg-rubik-cube"));
    refreshFacesUI();
  }

  function loop() {
    if (!open) {
      raf = 0;
      return;
    }
    paintMain();
    raf = requestAnimationFrame(loop);
  }

  function openPanel() {
    open = true;
    ensurePanel();
    panel.classList.remove("hidden");
    panel.classList.remove("mg-product-ghost");
    panel.style.display = "";
    panel.style.visibility = "visible";
    panel.style.pointerEvents = "auto";
    try {
      if (window.__mgFloatLayout && window.__mgFloatLayout.closeHeavy)
        window.__mgFloatLayout.closeHeavy({
          keepPlay: true,
          boardPill: true,
          ctrlPill: false,
          keepRubik: true,
        });
    } catch (e) {}
    refreshFacesUI();
    paintMain();
    if (!raf) raf = requestAnimationFrame(loop);
    try {
      if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
        window.__mgFloatLayout.apply();
    } catch (eA) {}
    log(VER + " · open · face " + lastFace);
  }

  function close() {
    open = false;
    if (panel) panel.classList.add("hidden");
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function toggle() {
    if (open) close();
    else openPanel();
  }

  setInterval(function () {
    paintOrb();
    if (open && !dragging && autoSpin) {
      /* loop handles main paint */
    }
  }, 100);
  setTimeout(function () {
    ensureOrb();
    paintOrb();
  }, 120);

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
    setFace: function (id) {
      if (FACE_BY[id]) {
        lastFace = id;
        refreshFacesUI();
        paintMain();
      }
    },
    stamp: stamp,
    scramble: scramble,
    solve: solveHome,
    stickers: function () {
      return JSON.parse(JSON.stringify(stickers));
    },
    links: LINKS,
    report: function () {
      return (
        VER +
        " face=" +
        lastFace +
        " lettering=" +
        (FACE_BY[lastFace] ? FACE_BY[lastFace].lettering : "?") +
        " open=" +
        open
      );
    },
  };
  log(VER + " · glass lettering cube ready");
})();
