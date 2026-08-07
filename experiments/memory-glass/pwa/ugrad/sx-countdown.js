/* SpaceX launches-page timer look — for SCORE + CHESS player clocks
 * (visual language only: black card · big tabular digits · segment labels)
 * NOT a mission/NET launcher clock.
 *
 * Modes:
 *   score  — round / score countdown (MM:SS or H:MM:SS)
 *   player — single side clock (chess calibration)
 *   dual   — mount helper for white/black
 *
 * API: window.SxCountdown
 */
(function (global) {
  "use strict";
  var VER = "sx-countdown-v2-gameclock";

  function pad2(n) {
    n = Math.floor(Math.abs(n));
    return (n < 10 ? "0" : "") + n;
  }

  function partsFromMs(ms) {
    ms = Math.max(0, ms | 0);
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600);
    s %= 3600;
    var m = Math.floor(s / 60);
    s %= 60;
    return { h: h, m: m, s: s, totalSec: Math.floor(ms / 1000) };
  }

  function ensureCss() {
    if (document.getElementById("sx-countdown-css")) return;
    var st = document.createElement("style");
    st.id = "sx-countdown-css";
    st.textContent = [
      ".sx-cd{font-family:D-DIN,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;",
      "  color:rgba(240,240,250,.95);background:#000;border:1px solid rgba(240,240,250,.12);",
      "  border-radius:4px;padding:12px 14px 10px;letter-spacing:.04em;",
      "  box-shadow:0 8px 28px rgba(0,0,0,.4);user-select:none}",
      ".sx-cd.compact{padding:8px 10px 8px}",
      ".sx-cd-label{font-size:10px;letter-spacing:.18em;text-transform:uppercase;",
      "  color:rgba(240,240,250,.45);margin:0 0 8px;font-weight:600}",
      ".sx-cd-mission{font-size:11px;color:rgba(240,240,250,.65);margin:0 0 8px;",
      "  font-weight:500;letter-spacing:.02em;line-height:1.3}",
      ".sx-cd-row{display:flex;align-items:flex-start;justify-content:center;gap:0}",
      ".sx-cd-seg{display:flex;flex-direction:column;align-items:center;min-width:2.6rem}",
      ".sx-cd-seg .n{font-size:clamp(1.4rem,3.2vw,1.9rem);font-weight:400;line-height:1;",
      "  font-variant-numeric:tabular-nums;color:rgba(240,240,250,.98)}",
      ".sx-cd-seg .u{font-size:8px;letter-spacing:.16em;text-transform:uppercase;",
      "  color:rgba(240,240,250,.4);margin-top:6px;font-weight:600}",
      ".sx-cd-colon{font-size:clamp(1.25rem,3vw,1.75rem);line-height:1;padding:0 .3rem;",
      "  color:rgba(240,240,250,.35);align-self:flex-start}",
      /* active side (chess calibration) */
      ".sx-cd.active{border-color:rgba(125,211,252,.55);box-shadow:0 0 0 1px rgba(125,211,252,.2),0 8px 28px rgba(0,0,0,.45)}",
      ".sx-cd.active .sx-cd-label{color:rgba(125,211,252,.85)}",
      ".sx-cd.flag .n{color:rgba(248,113,113,.95)}",
      ".sx-cd.paused .n{opacity:.55}",
      /* dual player row */
      ".sx-cd-dual{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
      "@media(max-width:520px){.sx-cd-dual{grid-template-columns:1fr}}",
      /* score strip (webgrid round) */
      ".sx-cd.score .sx-cd-label{color:rgba(74,222,128,.75)}",
      ".sx-cd-meta{margin-top:6px;font-size:10px;color:rgba(240,240,250,.4);",
      "  display:flex;flex-wrap:wrap;gap:6px 12px;justify-content:center}",
      ".sx-cd-meta b{color:rgba(240,240,250,.7);font-weight:600}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  /**
   * Mount a single clock face.
   * opts:
   *   kind: 'score' | 'player'
   *   label: 'SCORE' | 'WHITE' | 'BLACK'
   *   remainingMs: number (counts down)
   *   showHours: bool (default if remaining >= 1h)
   *   compact: bool
   *   onZero: fn
   */
  function mount(root, opts) {
    ensureCss();
    opts = opts || {};
    if (!root) return null;
    root.className =
      "sx-cd " +
      (opts.compact ? "compact " : "") +
      (opts.kind === "score" ? "score " : "") +
      (opts.active ? "active " : "");
    root.innerHTML =
      '<div class="sx-cd-label" data-sx="title">CLOCK</div>' +
      '<div class="sx-cd-mission" data-sx="sub" style="display:none"></div>' +
      '<div class="sx-cd-row" data-sx="row"></div>' +
      '<div class="sx-cd-meta" data-sx="meta"></div>';

    var state = {
      kind: opts.kind || "player",
      label: opts.label || "CLOCK",
      sub: opts.sub || "",
      remainingMs: opts.remainingMs != null ? opts.remainingMs : 5 * 60 * 1000,
      showHours: opts.showHours,
      meta: opts.meta || "",
      active: !!opts.active,
      paused: !!opts.paused,
      onZero: opts.onZero || null,
      _zeroFired: false,
      lastTick: performance.now(),
    };

    function paint() {
      var p = partsFromMs(state.remainingMs);
      var showH =
        state.showHours === true ||
        (state.showHours !== false && p.h > 0);
      root.classList.toggle("active", state.active);
      root.classList.toggle("paused", state.paused);
      root.classList.toggle("flag", state.remainingMs <= 0);
      root.querySelector('[data-sx="title"]').textContent = state.label;
      var sub = root.querySelector('[data-sx="sub"]');
      if (state.sub) {
        sub.style.display = "";
        sub.textContent = state.sub;
      } else sub.style.display = "none";

      var segs = [];
      if (showH) segs.push({ n: pad2(p.h), u: "Hrs" });
      segs.push({ n: pad2(p.m), u: "Min" });
      segs.push({ n: pad2(p.s), u: "Sec" });

      var row = root.querySelector('[data-sx="row"]');
      var html = "";
      for (var i = 0; i < segs.length; i++) {
        if (i) html += '<div class="sx-cd-colon">:</div>';
        html +=
          '<div class="sx-cd-seg"><div class="n">' +
          segs[i].n +
          '</div><div class="u">' +
          segs[i].u +
          "</div></div>";
      }
      row.innerHTML = html;

      var meta = root.querySelector('[data-sx="meta"]');
      meta.innerHTML =
        state.meta ||
        (state.kind === "score"
          ? "<b>SCORE</b> · round time remaining"
          : state.active
            ? "<b>ACTIVE</b> · burns main time"
            : "waiting · other side");
    }

    paint();

    return {
      el: root,
      ver: VER,
      state: state,
      paint: paint,
      setRemaining: function (ms) {
        state.remainingMs = Math.max(0, ms | 0);
        if (state.remainingMs > 0) state._zeroFired = false;
        paint();
      },
      getRemaining: function () {
        return state.remainingMs;
      },
      setActive: function (on) {
        state.active = !!on;
        paint();
      },
      setPaused: function (on) {
        state.paused = !!on;
        paint();
      },
      setLabel: function (s) {
        state.label = s || "CLOCK";
        paint();
      },
      setSub: function (s) {
        state.sub = s || "";
        paint();
      },
      setMeta: function (s) {
        state.meta = s || "";
        paint();
      },
      /** burn dt ms if active and not paused */
      burn: function (dt) {
        if (!state.active || state.paused || state.remainingMs <= 0) return state.remainingMs;
        state.remainingMs = Math.max(0, state.remainingMs - dt);
        if (state.remainingMs <= 0 && !state._zeroFired) {
          state._zeroFired = true;
          if (state.onZero)
            try {
              state.onZero();
            } catch (e) {}
        }
        paint();
        return state.remainingMs;
      },
      destroy: function () {},
    };
  }

  /** Dual chess player clocks (calibration) */
  function mountDual(host, opts) {
    ensureCss();
    opts = opts || {};
    host.className = "sx-cd-dual";
    host.innerHTML = "";
    var a = document.createElement("div");
    var b = document.createElement("div");
    host.appendChild(a);
    host.appendChild(b);
    var mainMs = (opts.min != null ? opts.min : 5) * 60 * 1000;
    var white = mount(a, {
      kind: "player",
      label: opts.labelA || "WHITE",
      remainingMs: mainMs,
      compact: true,
      active: true,
      meta: "player clock · calibration",
      onZero: opts.onZeroA,
    });
    var black = mount(b, {
      kind: "player",
      label: opts.labelB || "BLACK",
      remainingMs: mainMs,
      compact: true,
      active: false,
      meta: "player clock · calibration",
      onZero: opts.onZeroB,
    });
    return {
      white: white,
      black: black,
      a: white,
      b: black,
      setMainMs: function (ms) {
        white.setRemaining(ms);
        black.setRemaining(ms);
      },
      setActiveSide: function (side) {
        /* 'a'|'white' or 'b'|'black' */
        var w = side === "a" || side === "white";
        white.setActive(w);
        black.setActive(!w);
      },
      setPaused: function (on) {
        white.setPaused(on);
        black.setPaused(on);
      },
      burnActive: function (dt) {
        if (white.state.active) return white.burn(dt);
        if (black.state.active) return black.burn(dt);
        return 0;
      },
      destroy: function () {
        white.destroy();
        black.destroy();
      },
    };
  }

  /** Score / round countdown (webgrid etc.) */
  function mountScore(root, opts) {
    opts = opts || {};
    return mount(root, {
      kind: "score",
      label: opts.label || "SCORE",
      sub: opts.sub || "round timer",
      remainingMs: opts.remainingMs != null ? opts.remainingMs : 70 * 1000,
      compact: opts.compact,
      active: true,
      meta: opts.meta || "<b>SCORE</b> · time left in round",
      onZero: opts.onZero,
    });
  }

  global.SxCountdown = {
    ver: VER,
    mount: mount,
    mountDual: mountDual,
    mountScore: mountScore,
    partsFromMs: partsFromMs,
    pad2: pad2,
  };
})(typeof window !== "undefined" ? window : this);
