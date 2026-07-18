/* Memory Glass · BrotherNumsey Raider
 * In-browser game-engine dev platform (live stream / Cinder / Blender / Three.js / Quest spirit).
 * Foundation scene: brotherNumsy endless runner (from uvspeed/web/brothernumsy.html).
 * VER: brothernumsey-raider-v1
 */
(function () {
  "use strict";
  var VER = "brothernumsey-raider-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._raiderVer === VER && window.__mgRaider) return;
  HP._raiderVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var stage = null;
  var canvas = null;
  var ctx = null;
  var engine = null;
  var raf = 0;
  var openState = false;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "raider");
    } catch (e) {}
  }

  /* ─── Engine kernel (Cinder-like loop + Blender-like outliner) ─── */
  function createEngine(cv) {
    var eng = {
      ver: VER,
      mode: "cinder2d", /* cinder2d | three | quest */
      playing: false,
      paused: false,
      t: 0,
      dt: 0,
      frame: 0,
      fps: 0,
      _fpsAcc: 0,
      _fpsN: 0,
      _last: 0,
      scene: null,
      outliner: [],
      systems: { physics: true, render: true, input: true, stream: true },
      keys: {},
      hi: 0,
      live: { viewers: 1, bitrate: "local", latencyMs: 0 },
      hooks: { three: null, quest: null },
    };
    try {
      eng.hi = parseInt(localStorage.getItem("mg_raider_numsy_hi") || "0", 10) || 0;
    } catch (eH) {}

    eng.scene = createNumsyScene(eng, cv);
    rebuildOutliner(eng);

    eng.start = function () {
      eng.playing = true;
      eng.paused = false;
      eng.scene.reset();
      eng._last = performance.now();
      tick();
      setStatusBar("live · brotherNumsy runner");
      log(VER + " · play");
    };
    eng.pause = function () {
      eng.paused = !eng.paused;
      if (!eng.paused) {
        eng._last = performance.now();
        tick();
      }
      setStatusBar(eng.paused ? "paused" : "live");
    };
    eng.stop = function () {
      eng.playing = false;
      eng.paused = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      eng.scene.drawIdle();
      setStatusBar("stopped");
    };
    eng.setMode = function (m) {
      eng.mode = m || "cinder2d";
      setStatusBar("mode " + eng.mode);
      paintDock();
      if (eng.mode === "three") {
        setStatusBar("three.js hook · drop renderer into __mgRaider.hooks.three");
      } else if (eng.mode === "quest") {
        setStatusBar("quest preview · Horizon/WebXR scaffold ready");
      }
    };

    function tick() {
      if (!eng.playing || eng.paused) return;
      var now = performance.now();
      eng.dt = Math.min(0.05, (now - eng._last) / 1000);
      eng._last = now;
      eng.t += eng.dt;
      eng.frame++;
      eng._fpsAcc += eng.dt;
      eng._fpsN++;
      if (eng._fpsAcc >= 0.5) {
        eng.fps = Math.round(eng._fpsN / eng._fpsAcc);
        eng._fpsAcc = 0;
        eng._fpsN = 0;
        eng.live.latencyMs = Math.round(eng.dt * 1000);
      }
      if (eng.systems.input) eng.scene.pollInput(eng.keys);
      if (eng.systems.physics) eng.scene.update(eng.dt, eng);
      if (eng.systems.render) {
        if (eng.mode === "cinder2d") eng.scene.render(ctx, eng);
        else if (eng.mode === "three" && eng.hooks.three && eng.hooks.three.render)
          eng.hooks.three.render(eng);
        else if (eng.mode === "quest" && eng.hooks.quest && eng.hooks.quest.render)
          eng.hooks.quest.render(eng);
        else eng.scene.render(ctx, eng);
      }
      if (eng.systems.stream) paintLiveHud(eng);
      raf = requestAnimationFrame(tick);
    }

    eng._tick = tick;
    return eng;
  }

  function rebuildOutliner(eng) {
    eng.outliner = [
      { id: "world", label: "World / Level", kind: "collection", open: true },
      { id: "player", label: "brotherNumsy", kind: "actor" },
      { id: "freya", label: "Freya companion", kind: "actor" },
      { id: "spawn", label: "Spawners", kind: "system" },
      { id: "physics", label: "Physics (gravity/jump)", kind: "system" },
      { id: "camera", label: "Camera / scroll", kind: "camera" },
      { id: "fx", label: "Particles / trail", kind: "fx" },
      { id: "hud", label: "Live HUD stream", kind: "ui" },
    ];
  }

  /* ─── Foundation scene: brotherNumsy runner (compact port) ─── */
  function createNumsyScene(eng, cv) {
    var GRAVITY = 0.55;
    var JUMP = -9.2;
    var BASE = 3.2;
    var sc = {
      W: 640,
      H: 360,
      groundY: 300,
      score: 0,
      dist: 0,
      speed: BASE,
      mult: 1,
      alive: false,
      player: { x: 80, y: 0, vy: 0, w: 22, h: 28, grounded: true, duck: false, inv: 0, anim: 0 },
      freya: { x: 50, y: 0, power: 0, beam: 0 },
      obs: [],
      coins: [],
      parts: [],
      stars: [],
      grid: 0,
      spawnT: 70,
      coinT: 40,
      fact: "",
      factT: 0,
    };

    for (var i = 0; i < 60; i++) {
      sc.stars.push({
        x: Math.random() * 900,
        y: Math.random() * 280,
        s: Math.random() * 1.6 + 0.4,
        b: 80 + Math.random() * 120,
        sp: 0.2 + Math.random() * 0.5,
      });
    }

    sc.reset = function () {
      sc.score = 0;
      sc.dist = 0;
      sc.speed = BASE;
      sc.mult = 1;
      sc.alive = true;
      sc.obs = [];
      sc.coins = [];
      sc.parts = [];
      sc.grid = 0;
      sc.spawnT = 70;
      sc.coinT = 40;
      sc.fact = "";
      sc.factT = 0;
      sc.player.x = sc.W * 0.14;
      sc.player.y = sc.groundY - sc.player.h;
      sc.player.vy = 0;
      sc.player.grounded = true;
      sc.player.duck = false;
      sc.player.inv = 0;
      sc.freya.x = sc.player.x - 28;
      sc.freya.y = sc.player.y - 24;
      sc.freya.power = 0;
      sc.freya.beam = 0;
      resize();
    };

    function resize() {
      var wrap = cv.parentElement;
      if (!wrap) return;
      var maxW = wrap.clientWidth || 640;
      var maxH = Math.max(200, (wrap.clientHeight || 360) - 4);
      var aspect = 16 / 9;
      var w = maxW;
      var h = w / aspect;
      if (h > maxH) {
        h = maxH;
        w = h * aspect;
      }
      sc.W = Math.floor(w);
      sc.H = Math.floor(h);
      cv.width = sc.W;
      cv.height = sc.H;
      sc.groundY = Math.floor(sc.H * 0.82);
      if (!sc.alive) {
        sc.player.y = sc.groundY - sc.player.h;
      }
    }

    sc.pollInput = function (keys) {
      var p = sc.player;
      var jump = keys.Space || keys.ArrowUp || keys.KeyW;
      var duck = keys.ArrowDown || keys.KeyS;
      if (jump && p.grounded && sc.alive) {
        p.vy = JUMP;
        p.grounded = false;
      }
      p.duck = !!(duck && p.grounded);
    };

    sc.update = function (dt, engRef) {
      if (!sc.alive) return;
      var p = sc.player;
      var f = sc.freya;
      sc.mult = 1 + Math.floor(sc.score / 500) * 0.15;
      var spd = sc.speed * sc.mult * (p.inv > 0 ? 1.25 : 1) * (60 * dt);

      if (!p.grounded) {
        p.vy += GRAVITY * (60 * dt);
        p.y += p.vy * (60 * dt) * 0.35;
        if (p.y >= sc.groundY - p.h) {
          p.y = sc.groundY - p.h;
          p.vy = 0;
          p.grounded = true;
        }
      }
      p.anim = p.grounded ? (Math.floor(engRef.frame / 8) % 2) : 2;
      if (p.inv > 0) p.inv--;

      f.x += (p.x - 30 - f.x) * 0.12;
      f.y += (p.y - 22 + Math.sin(engRef.frame * 0.05) * 5 - f.y) * 0.1;
      if (f.beam > 0) f.beam--;

      sc.dist += spd;
      sc.score = Math.floor(sc.dist / 8);
      sc.grid = (sc.grid + spd) % 40;

      sc.spawnT -= 1 * (60 * dt);
      if (sc.spawnT <= 0) {
        sc.spawnT = 45 + Math.random() * 50 - sc.mult * 6;
        var fly = Math.random() < 0.28;
        sc.obs.push({
          type: fly ? "fly" : "gnd",
          x: sc.W + 20,
          y: fly ? sc.groundY - 70 - Math.random() * 40 : sc.groundY - 26,
          w: fly ? 28 : 18,
          h: fly ? 16 : 26,
        });
      }
      sc.coinT -= 1 * (60 * dt);
      if (sc.coinT <= 0) {
        sc.coinT = 35 + Math.random() * 50;
        var kind = Math.random() < 0.12 ? "gold" : Math.random() < 0.25 ? "freya" : "q";
        sc.coins.push({
          type: kind,
          x: sc.W + 16,
          y: sc.groundY - 50 - Math.random() * 40,
          w: 14,
          h: 14,
          bob: Math.random() * Math.PI * 2,
        });
      }

      var oi;
      for (oi = 0; oi < sc.obs.length; oi++) sc.obs[oi].x -= spd;
      sc.obs = sc.obs.filter(function (o) {
        return o.x + o.w > -40;
      });
      for (oi = 0; oi < sc.coins.length; oi++) {
        sc.coins[oi].x -= spd;
        sc.coins[oi].bob += 0.08;
      }
      sc.coins = sc.coins.filter(function (c) {
        return c.x + c.w > -40;
      });

      if (f.beam > 0) {
        sc.obs.forEach(function (o) {
          if (o.x > p.x && o.x < p.x + 180) {
            burst(o.x, o.y, "#c084fc", 8);
            o.x = -999;
            sc.score += 7;
          }
        });
      }

      var ph = p.duck ? p.h * 0.55 : p.h;
      var py = p.duck ? p.y + p.h * 0.45 : p.y;
      for (oi = 0; oi < sc.obs.length; oi++) {
        var o = sc.obs[oi];
        if (aabb(p.x, py, p.w * 0.8, ph, o.x, o.y, o.w, o.h)) {
          if (p.inv > 0) {
            o.x = -999;
            sc.score += 5;
            burst(o.x, o.y, "#ff5555", 6);
          } else {
            sc.alive = false;
            if (sc.score > engRef.hi) {
              engRef.hi = sc.score;
              try {
                localStorage.setItem("mg_raider_numsy_hi", String(engRef.hi));
              } catch (eS) {}
            }
            sc.fact = "GAME OVER · +n " + sc.score + " · hi " + engRef.hi;
            sc.factT = 240;
            setStatusBar(sc.fact);
            return;
          }
        }
      }
      for (var ci = sc.coins.length - 1; ci >= 0; ci--) {
        var c = sc.coins[ci];
        var cy = c.y + Math.sin(c.bob) * 4;
        if (aabb(p.x, py, p.w, ph, c.x, cy, c.w, c.h)) {
          if (c.type === "gold") {
            p.inv = 150;
            sc.score += 99;
            burst(c.x, cy, "#ffd700", 14);
          } else if (c.type === "freya") {
            f.power = Math.min(100, f.power + 35);
            sc.score += 15;
            burst(c.x, cy, "#a78bfa", 12);
            if (f.power >= 100) {
              f.beam = 100;
              f.power = 0;
              sc.fact = "FREYA BEAM";
              sc.factT = 90;
            }
          } else {
            sc.score += 9;
            burst(c.x, cy, "#58a6ff", 6);
          }
          sc.coins.splice(ci, 1);
        }
      }

      for (var pi = 0; pi < sc.parts.length; pi++) {
        var pt = sc.parts[pi];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.15;
        pt.life--;
      }
      sc.parts = sc.parts.filter(function (pt) {
        return pt.life > 0;
      });
      if (sc.factT > 0) sc.factT--;
    };

    function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }
    function burst(x, y, color, n) {
      for (var i = 0; i < n; i++) {
        sc.parts.push({
          x: x,
          y: y,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 1) * 4,
          color: color,
          life: 18 + (Math.random() * 12) | 0,
          s: 1 + Math.random() * 2,
        });
      }
    }

    sc.render = function (g, engRef) {
      if (!g) return;
      var W = sc.W;
      var H = sc.H;
      g.clearRect(0, 0, W, H);
      /* night sky */
      var grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, "#0a0e18");
      grd.addColorStop(1, "#151a28");
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      var si;
      for (si = 0; si < sc.stars.length; si++) {
        var st = sc.stars[si];
        st.x -= st.sp * (sc.alive ? sc.mult : 0.3);
        if (st.x < 0) st.x = W + 10;
        g.fillStyle = "rgba(220,230,255," + st.b / 255 + ")";
        g.fillRect(st.x, st.y, st.s, st.s);
      }
      /* ground grid (Cinder-ish) */
      g.strokeStyle = "rgba(80,120,180,0.25)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, sc.groundY);
      g.lineTo(W, sc.groundY);
      g.stroke();
      g.strokeStyle = "rgba(60,90,140,0.18)";
      for (var gx = -sc.grid; gx < W; gx += 40) {
        g.beginPath();
        g.moveTo(gx, sc.groundY);
        g.lineTo(gx - 20, H);
        g.stroke();
      }
      g.fillStyle = "rgba(20,28,40,0.9)";
      g.fillRect(0, sc.groundY, W, H - sc.groundY);

      /* freya */
      var f = sc.freya;
      g.fillStyle = f.beam > 0 ? "#c084fc" : "#7c3aed";
      g.beginPath();
      g.arc(f.x + 8, f.y + 8, 8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(6,182,212,0.85)";
      g.fillRect(f.x + 4, f.y + 4, 4, 4);
      if (f.beam > 0) {
        g.strokeStyle = "rgba(192,132,252,0.55)";
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(f.x + 12, f.y + 10);
        g.lineTo(f.x + 160, f.y + 14);
        g.stroke();
      }

      /* player brotherNumsy robe */
      var p = sc.player;
      var ph = p.duck ? p.h * 0.55 : p.h;
      var py = p.duck ? p.y + p.h * 0.45 : p.y;
      if (p.inv > 0 && engRef.frame % 4 < 2) g.globalAlpha = 0.45;
      g.fillStyle = "#2d2040";
      g.fillRect(p.x, py + 8, p.w, ph - 8);
      g.fillStyle = "#e6b422";
      g.fillRect(p.x + 3, py, p.w - 6, 12);
      g.fillStyle = "#ff4444";
      g.fillRect(p.x + 6, py + 4, 3, 3);
      g.fillRect(p.x + p.w - 10, py + 4, 3, 3);
      g.fillStyle = "#ffd700";
      g.fillRect(p.x + 4, py + 12, p.w - 8, 5);
      g.globalAlpha = 1;

      /* obstacles */
      for (si = 0; si < sc.obs.length; si++) {
        var o = sc.obs[si];
        g.fillStyle = o.type === "fly" ? "#ff5555" : "#4a3560";
        g.fillRect(o.x, o.y, o.w, o.h);
        g.fillStyle = "#e6b422";
        g.font = "10px ui-monospace,Menlo,monospace";
        g.fillText(o.type === "fly" ? "{0,1}" : "0/1", o.x, o.y - 2);
      }
      for (si = 0; si < sc.coins.length; si++) {
        var c = sc.coins[si];
        var cy = c.y + Math.sin(c.bob) * 4;
        g.fillStyle = c.type === "gold" ? "#ffd700" : c.type === "freya" ? "#a78bfa" : "#58a6ff";
        g.beginPath();
        g.arc(c.x + 7, cy + 7, 7, 0, Math.PI * 2);
        g.fill();
      }
      for (si = 0; si < sc.parts.length; si++) {
        var pt = sc.parts[si];
        g.fillStyle = pt.color;
        g.globalAlpha = Math.max(0.1, pt.life / 30);
        g.fillRect(pt.x, pt.y, pt.s, pt.s);
        g.globalAlpha = 1;
      }

      /* HUD */
      g.fillStyle = "rgba(13,17,23,0.65)";
      g.fillRect(8, 8, 210, 52);
      g.strokeStyle = "rgba(48,54,61,0.9)";
      g.strokeRect(8, 8, 210, 52);
      g.fillStyle = "#e6b422";
      g.font = "700 13px ui-monospace,Menlo,monospace";
      g.fillText("+n  " + sc.score, 16, 28);
      g.fillStyle = "#8b949e";
      g.font = "11px ui-monospace,Menlo,monospace";
      g.fillText("hi " + engRef.hi + " · " + sc.mult.toFixed(1) + "x", 16, 46);
      g.fillStyle = "#a78bfa";
      g.fillText("FREYA " + (f.power | 0) + "%", W - 110, 28);
      if (sc.factT > 0) {
        g.fillStyle = "rgba(126,231,135,0.95)";
        g.font = "12px ui-monospace,Menlo,monospace";
        g.fillText(sc.fact, 16, H - 16);
      }
      if (!sc.alive && engRef.playing) {
        g.fillStyle = "rgba(13,17,23,0.55)";
        g.fillRect(0, 0, W, H);
        g.fillStyle = "#e6b422";
        g.font = "700 22px system-ui";
        g.fillText("RETRY · press ▶", W * 0.28, H * 0.48);
      }
    };

    sc.drawIdle = function () {
      resize();
      if (!ctx) return;
      sc.alive = false;
      sc.render(ctx, eng);
      ctx.fillStyle = "rgba(13,17,23,0.5)";
      ctx.fillRect(0, 0, sc.W, sc.H);
      ctx.fillStyle = "#e6b422";
      ctx.font = "700 18px system-ui";
      ctx.fillText("BrotherNumsey Raider", sc.W * 0.22, sc.H * 0.42);
      ctx.fillStyle = "#a78bfa";
      ctx.font = "12px ui-monospace,Menlo,monospace";
      ctx.fillText("live · cinder2d · three · quest  ·  ▶ to play", sc.W * 0.18, sc.H * 0.52);
    };

    sc.getState = function () {
      return {
        score: sc.score,
        dist: sc.dist,
        alive: sc.alive,
        mult: sc.mult,
        freyaPower: sc.freya.power,
        obs: sc.obs.length,
        coins: sc.coins.length,
      };
    };

    return sc;
  }

  /* ─── Chrome: stage float (Blender/Steam-like workspace) ─── */
  function ensureCss() {
    if (document.getElementById("mg-raider-css")) return;
    var st = document.createElement("style");
    st.id = "mg-raider-css";
    st.textContent = [
      "#mg-raider-stage{position:fixed;left:22vw;top:48px;z-index:2147482988;",
      "  width:min(720px,52vw);max-height:min(58vh,520px);",
      "  display:flex;flex-direction:column;border-radius:14px;overflow:hidden;",
      "  background:rgba(10,12,16,0.72);backdrop-filter:blur(28px) saturate(1.45);",
      "  -webkit-backdrop-filter:blur(28px) saturate(1.45);",
      "  border:1px solid rgba(255,255,255,0.16);",
      "  box-shadow:0 14px 40px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.1);",
      "  font:650 11px/1.3 system-ui;color:rgba(244,246,250,0.94);pointer-events:auto}",
      "#mg-raider-stage.hidden{display:none}",
      "#mg-raider-stage .rd-hd{display:flex;align-items:center;justify-content:space-between;",
      "  gap:8px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.1);",
      "  background:rgba(16,18,24,0.88);flex-shrink:0}",
      "#mg-raider-stage .rd-hd .ttl{font:700 10px/1 system-ui;letter-spacing:0.12em;",
      "  text-transform:uppercase;color:rgba(230,180,34,0.95)}",
      "#mg-raider-stage .rd-hd .ttl span{color:rgba(167,139,250,0.9);margin-left:6px;",
      "  letter-spacing:0.06em;font-weight:650}",
      "#mg-raider-stage .rd-hd .acts{display:flex;flex-wrap:wrap;gap:4px}",
      "#mg-raider-stage .rd-hd button,#mg-raider-stage .rd-dock button{",
      "  appearance:none;cursor:pointer;border:1px solid rgba(255,255,255,0.14);",
      "  background:rgba(255,255,255,0.08);color:rgba(244,246,250,0.92);",
      "  font:700 9px/1 system-ui;letter-spacing:0.04em;text-transform:uppercase;",
      "  padding:6px 8px;border-radius:999px;min-height:26px}",
      "#mg-raider-stage .rd-hd button:hover,#mg-raider-stage .rd-dock button:hover{",
      "  background:rgba(255,255,255,0.16)}",
      "#mg-raider-stage .rd-hd button.on{background:rgba(230,180,34,0.22);",
      "  border-color:rgba(230,180,34,0.45);color:#ffd700}",
      "#mg-raider-stage .rd-hd button.live{background:rgba(255,80,80,0.2);",
      "  border-color:rgba(255,100,100,0.45);color:#ffb0b0}",
      "#mg-raider-stage .rd-body{display:grid;grid-template-columns:148px 1fr;min-height:0;",
      "  flex:1 1 auto;max-height:min(48vh,440px)}",
      "#mg-raider-stage .rd-out{overflow:auto;padding:8px;border-right:1px solid rgba(255,255,255,0.08);",
      "  background:rgba(0,0,0,0.2);font:500 10px/1.35 ui-monospace,Menlo,monospace}",
      "#mg-raider-stage .rd-out .row{padding:4px 6px;border-radius:6px;margin-bottom:2px;",
      "  color:rgba(200,210,225,0.88);cursor:default}",
      "#mg-raider-stage .rd-out .row:hover{background:rgba(255,255,255,0.06)}",
      "#mg-raider-stage .rd-out .k{opacity:0.55;margin-right:4px;font-size:9px}",
      "#mg-raider-stage .rd-view{position:relative;min-width:0;background:#0a0e18;",
      "  display:flex;align-items:center;justify-content:center;overflow:hidden}",
      "#mg-raider-stage .rd-view canvas{display:block;width:100%;height:auto;",
      "  image-rendering:pixelated;image-rendering:crisp-edges;max-height:100%}",
      "#mg-raider-stage .rd-live{position:absolute;top:8px;right:8px;",
      "  padding:4px 8px;border-radius:6px;background:rgba(13,17,23,0.75);",
      "  border:1px solid rgba(255,80,80,0.35);font:700 9px/1 ui-monospace,Menlo,monospace;",
      "  color:rgba(255,160,160,0.95);letter-spacing:0.08em}",
      "#mg-raider-stage .rd-live i{display:inline-block;width:6px;height:6px;border-radius:50%;",
      "  background:#ff4444;margin-right:5px;box-shadow:0 0 6px #ff4444;vertical-align:middle}",
      "#mg-raider-stage .rd-dock{display:flex;flex-wrap:wrap;gap:4px;align-items:center;",
      "  padding:6px 10px;border-top:1px solid rgba(255,255,255,0.08);",
      "  background:rgba(16,18,24,0.9);flex-shrink:0}",
      "#mg-raider-stage .rd-dock .stat{margin-left:auto;font:500 9px/1.2 ui-monospace,Menlo,monospace;",
      "  color:rgba(160,200,180,0.88)}",
      "#mg-raider-stage .rd-ft{padding:4px 10px 6px;font:500 9px/1.25 ui-monospace,Menlo,monospace;",
      "  color:rgba(160,180,200,0.75);border-top:1px solid rgba(255,255,255,0.06);",
      "  background:rgba(12,14,18,0.85)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function setStatusBar(msg) {
    if (!stage) return;
    var ft = stage.querySelector(".rd-ft");
    if (ft) ft.textContent = VER + " · " + (msg || "ready");
  }

  function paintLiveHud(eng) {
    if (!stage) return;
    var live = stage.querySelector(".rd-live");
    if (live) {
      live.innerHTML =
        "<i></i>LIVE · " +
        (eng.fps || "—") +
        "fps · " +
        (eng.live.latencyMs || 0) +
        "ms";
    }
    var stat = stage.querySelector(".rd-dock .stat");
    if (stat && eng.scene) {
      var st = eng.scene.getState();
      stat.textContent =
        "+n " +
        st.score +
        " · " +
        eng.mode +
        " · " +
        (eng.playing ? (eng.paused ? "PAUSED" : "RUN") : "IDLE");
    }
  }

  function paintOutliner() {
    if (!stage || !engine) return;
    var box = stage.querySelector(".rd-out");
    if (!box) return;
    box.innerHTML = "";
    var title = document.createElement("div");
    title.style.cssText = "opacity:0.6;font:700 9px/1 system-ui;letter-spacing:0.1em;margin:0 0 6px";
    title.textContent = "OUTLINER";
    box.appendChild(title);
    engine.outliner.forEach(function (n) {
      var row = document.createElement("div");
      row.className = "row";
      row.innerHTML = '<span class="k">' + n.kind + "</span>" + n.label;
      box.appendChild(row);
    });
    var sys = document.createElement("div");
    sys.style.cssText = "margin-top:8px;opacity:0.6;font:700 9px/1 system-ui;letter-spacing:0.1em";
    sys.textContent = "SYSTEMS";
    box.appendChild(sys);
    Object.keys(engine.systems).forEach(function (k) {
      var row = document.createElement("div");
      row.className = "row";
      row.textContent = (engine.systems[k] ? "● " : "○ ") + k;
      row.onclick = function () {
        engine.systems[k] = !engine.systems[k];
        paintOutliner();
        setStatusBar("system " + k + " " + (engine.systems[k] ? "on" : "off"));
      };
      box.appendChild(row);
    });
  }

  function paintDock() {
    if (!stage || !engine) return;
    var modes = stage.querySelectorAll("[data-rmode]");
    Array.prototype.forEach.call(modes, function (b) {
      b.classList.toggle("on", b.getAttribute("data-rmode") === engine.mode);
    });
  }

  function bindKeys() {
    if (window.__mgRaiderKeys) return;
    window.__mgRaiderKeys = true;
    window.addEventListener(
      "keydown",
      function (e) {
        if (!engine || !openState) return;
        var tag = (e.target && e.target.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        engine.keys[e.code] = true;
        if (["Space", "ArrowUp", "ArrowDown"].indexOf(e.code) >= 0 && engine.playing) {
          e.preventDefault();
        }
      },
      true
    );
    window.addEventListener(
      "keyup",
      function (e) {
        if (!engine) return;
        engine.keys[e.code] = false;
      },
      true
    );
  }

  function mount() {
    ensureCss();
    if (document.getElementById("mg-raider-stage")) {
      stage = document.getElementById("mg-raider-stage");
      canvas = stage.querySelector("#mg-raider-cv");
      if (canvas) ctx = canvas.getContext("2d");
      return;
    }
    stage = document.createElement("div");
    stage.id = "mg-raider-stage";
    stage.className = "hidden";
    stage.innerHTML =
      '<div class="rd-hd">' +
      '  <div class="ttl">RAIDER<span>BrotherNumsey · engine</span></div>' +
      '  <div class="acts">' +
      '    <button type="button" data-act="play">▶</button>' +
      '    <button type="button" data-act="pause">❚❚</button>' +
      '    <button type="button" data-act="stop">■</button>' +
      '    <button type="button" data-act="live" class="live">LIVE</button>' +
      '    <button type="button" data-act="x">×</button>' +
      "  </div>" +
      "</div>" +
      '<div class="rd-body">' +
      '  <div class="rd-out"></div>' +
      '  <div class="rd-view">' +
      '    <canvas id="mg-raider-cv"></canvas>' +
      '    <div class="rd-live"><i></i>STANDBY</div>' +
      "  </div>" +
      "</div>" +
      '<div class="rd-dock">' +
      '  <button type="button" data-rmode="cinder2d">Cinder2D</button>' +
      '  <button type="button" data-rmode="three">Three</button>' +
      '  <button type="button" data-rmode="quest">Quest</button>' +
      '  <button type="button" data-act="scene">Scene: Numsy</button>' +
      '  <button type="button" data-act="export">Export</button>' +
      '  <span class="stat">idle</span>' +
      "</div>" +
      '<div class="rd-ft">' +
      VER +
      " · game engine foundation · Space/↑ jump · ↓ duck</div>";
    (document.body || document.documentElement).appendChild(stage);
    canvas = stage.querySelector("#mg-raider-cv");
    ctx = canvas.getContext("2d");
    engine = createEngine(canvas);
    paintOutliner();
    paintDock();
    engine.scene.drawIdle();
    bindKeys();

    stage.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t || !t.getAttribute) return;
      var act = t.getAttribute("data-act");
      var mode = t.getAttribute("data-rmode");
      if (mode) {
        engine.setMode(mode);
        paintDock();
        return;
      }
      if (act === "play") {
        if (!engine.playing || !engine.scene.alive) engine.start();
        else if (engine.paused) engine.pause();
      } else if (act === "pause") {
        if (engine.playing) engine.pause();
      } else if (act === "stop") {
        engine.stop();
      } else if (act === "live") {
        engine.systems.stream = !engine.systems.stream;
        t.classList.toggle("on", engine.systems.stream);
        setStatusBar(engine.systems.stream ? "stream HUD on" : "stream HUD off");
      } else if (act === "x") {
        close();
      } else if (act === "scene") {
        engine.scene.reset();
        engine.start();
        setStatusBar("scene brotherNumsy · reset");
      } else if (act === "export") {
        var snap = {
          ver: VER,
          mode: engine.mode,
          state: engine.scene.getState(),
          systems: engine.systems,
          outliner: engine.outliner.map(function (n) {
            return n.id;
          }),
        };
        var text = JSON.stringify(snap, null, 2);
        try {
          if (window.ipc)
            window.ipc.postMessage(JSON.stringify({ op: "clipboard_copy", text: text }));
          else if (navigator.clipboard) navigator.clipboard.writeText(text);
        } catch (eE) {}
        setStatusBar("exported scene state");
      }
    });

    /* touch jump/duck on canvas */
    canvas.addEventListener(
      "touchstart",
      function (e) {
        if (!engine) return;
        e.preventDefault();
        var rect = canvas.getBoundingClientRect();
        var relY = (e.touches[0].clientY - rect.top) / rect.height;
        if (relY < 0.5) engine.keys.Space = true;
        else engine.keys.ArrowDown = true;
      },
      { passive: false }
    );
    canvas.addEventListener("touchend", function () {
      if (!engine) return;
      engine.keys.Space = false;
      engine.keys.ArrowDown = false;
    });

    log(VER + " · mounted (hidden until open)");
  }

  function open() {
    mount();
    openState = true;
    stage.classList.remove("hidden");
    try {
      if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
        window.__mgFloatLayout.apply();
    } catch (eA) {}
    if (engine && !engine.playing) engine.scene.drawIdle();
    setStatusBar("open · foundation brotherNumsy");
    log(VER + " · open");
  }

  function close() {
    openState = false;
    if (engine) engine.stop();
    if (stage) stage.classList.add("hidden");
    log(VER + " · close");
  }

  function toggle() {
    if (openState) close();
    else open();
  }

  function isOpen() {
    return openState;
  }

  window.__mgRaider = {
    ver: VER,
    open: open,
    close: close,
    toggle: toggle,
    isOpen: isOpen,
    start: function () {
      open();
      if (engine) engine.start();
    },
    report: function () {
      var st = engine && engine.scene ? engine.scene.getState() : {};
      return (
        VER +
        " open=" +
        openState +
        " mode=" +
        (engine && engine.mode) +
        " score=" +
        (st.score || 0)
      );
    },
    getEngine: function () {
      return engine;
    },
    hooks: {
      setThree: function (api) {
        if (engine) engine.hooks.three = api;
      },
      setQuest: function (api) {
        if (engine) engine.hooks.quest = api;
      },
    },
  };

  /* soft-mount: chrome ready, stage closed (open via CTRL → RAIDER) */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      mount();
    });
  } else {
    mount();
  }
  log(VER + " · ready");
})();
