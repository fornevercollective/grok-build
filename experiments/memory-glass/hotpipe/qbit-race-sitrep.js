/* Memory Glass · Core-Race SITREP (H5)
 * Maps IronLine + bus + truss + DAC → race-style fields (pkt / Q / DAC / gates).
 * Toward https://mueee.qbitos.ai/qbit-core-race.html — not a full port of the game.
 * VER: qbit-race-sitrep-v2
 */
(function () {
  "use strict";
  var VER = "qbit-race-sitrep-v2";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._qbitRaceSitrepVer === VER) return;
  HP._qbitRaceSitrepVer = VER;

  var last = null;
  var history = [];
  var maxH = 32;
  var timer = 0;
  var chipEl = null;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "race-sitrep");
    } catch (e) {}
  }

  function ensureChip() {
    try {
      if (document.getElementById("pip-wrap")) return; /* inspect clean */
      if (chipEl && document.body && document.body.contains(chipEl)) return;
      if (!document.getElementById("mg-sitrep-chip-css")) {
        var st = document.createElement("style");
        st.id = "mg-sitrep-chip-css";
        st.textContent = [
          "#mg-sitrep-chip{",
          "  position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483005;",
          "  max-width:min(92vw,720px);padding:6px 12px;border-radius:999px;",
          "  font:600 10px/1.3 ui-monospace,Menlo,monospace;letter-spacing:0.02em;",
          "  color:rgba(200,230,255,0.92);",
          "  background:rgba(12,18,32,0.72);backdrop-filter:blur(16px);",
          "  border:1px solid rgba(120,180,255,0.28);",
          "  box-shadow:0 8px 24px rgba(0,0,0,0.35);cursor:pointer;",
          "  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
          "#mg-sitrep-chip.bad{border-color:rgba(255,120,100,0.5);color:rgba(255,200,190,0.95)}",
        ].join("");
        document.documentElement.appendChild(st);
      }
      chipEl = document.createElement("div");
      chipEl.id = "mg-sitrep-chip";
      chipEl.title = "click · SITREP · dblclick · open core-race with live query";
      chipEl.onclick = function () {
        publish({ openRace: false });
        if (window.__mgAgentDesk && window.__mgAgentDesk.open)
          window.__mgAgentDesk.open();
      };
      chipEl.ondblclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        publish({ openRace: true });
      };
      document.documentElement.appendChild(chipEl);
    } catch (e) {}
  }

  function raceUrl(sit) {
    var base = "https://mueee.qbitos.ai/qbit-core-race.html";
    if (!sit) return base;
    try {
      var q =
        "pkt=" +
        encodeURIComponent(sit.pkt) +
        "&Q=" +
        encodeURIComponent(sit.Q) +
        "&DAC=" +
        encodeURIComponent(sit.DAC) +
        "&gates=" +
        encodeURIComponent(sit.gates) +
        "&L3=" +
        encodeURIComponent(sit.L3 != null ? sit.L3 : "") +
        "&L5=" +
        encodeURIComponent(sit.L5 != null ? sit.L5 : "") +
        "&rung=" +
        encodeURIComponent(sit.rung || "") +
        "&src=mg-sitrep";
      return base + "?" + q;
    } catch (e) {
      return base;
    }
  }

  function openRaceWithSitrep(sit) {
    sit = sit || snapshot();
    var u = raceUrl(sit);
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({ op: "open_tab", url: u, title: "core-race SITREP" })
        );
        return u;
      }
    } catch (e) {}
    try {
      window.open(u, "_blank", "noopener");
    } catch (e2) {}
    return u;
  }

  /** Mesh fleet presence (H5 step 3) — soft, throttled */
  var lastMeshPub = 0;
  function meshPresence(sit) {
    try {
      var now = Date.now();
      if (now - lastMeshPub < 8000) return;
      lastMeshPub = now;
      if (window.__mgMesh && window.__mgMesh.broadcast) {
        window.__mgMesh.broadcast("qbit-sitrep", {
          line: sit.line,
          Q: sit.Q,
          pkt: sit.pkt,
          DAC: sit.DAC,
          rung: sit.rung,
          seat: "memory-glass",
        });
      }
    } catch (e) {}
  }

  function paintChip(sit) {
    if (!sit) return;
    try {
      ensureChip();
      if (!chipEl) return;
      chipEl.textContent = sit.line || "SITREP";
      chipEl.classList.toggle("bad", !sit.L3ok || !sit.L5ok || sit.Q < 0.5);
    } catch (e) {}
  }

  function ema(layer) {
    try {
      var ir = window.__mgIronline;
      if (ir && ir.state && ir.state.ema && ir.state.ema[layer] != null)
        return +ir.state.ema[layer];
    } catch (e) {}
    return null;
  }

  function budgetOk(layer) {
    try {
      if (window.__mgIronline && window.__mgIronline.budgetOk)
        return !!window.__mgIronline.budgetOk(layer);
    } catch (e) {}
    return true;
  }

  /**
   * Race-shaped snapshot (inspired by core-race HUD: pkt, Q, DAC, gates, fac)
   */
  function snapshot() {
    var bus = window.__mgQbitBus;
    var dac = window.__mgQbitDac;
    var truss = window.__mgQbitTruss;
    var loop = window.__mgQbitLoop;
    var bs = bus && bus.stats ? bus.stats : {};
    var pkt = bs.published || 0;
    var drop = bs.dropped || 0;
    var bp = bs.backpressure || 0;
    var l3 = ema("L3");
    var l5 = ema("L5");
    var l0 = ema("L0");
    /* Q: quality 0–1 from L3/L5 budget health */
    var q = 1;
    if (!budgetOk("L3")) q -= 0.35;
    if (!budgetOk("L5")) q -= 0.35;
    if (l3 != null && l3 > 0.5) q -= Math.min(0.3, l3 / 5);
    if (bp > 10) q -= 0.15;
    q = Math.max(0, Math.min(1, q));

    var dacSnap =
      dac && dac.snapshot
        ? dac.snapshot()
        : { levels: [], ema: [] };
    var dacScore = 0;
    if (dacSnap.ema && dacSnap.ema.length) {
      for (var i = 0; i < dacSnap.ema.length; i++) dacScore += dacSnap.ema[i] || 0;
      dacScore = dacScore / dacSnap.ema.length;
    }

    var rung =
      truss && truss.state && truss.RUNGS
        ? truss.RUNGS[truss.state.rung] || null
        : null;

    var sit = {
      ver: VER,
      t: Date.now(),
      tμ: bus && bus.nowμ ? bus.nowμ() : Date.now() * 1000,
      /* core-race flavored */
      pkt: pkt,
      drop: drop,
      bp: bp,
      Q: Math.round(q * 1000) / 1000,
      DAC: Math.round(dacScore * 1000) / 1000,
      gates: (bs.byKind && bs.byKind.gate) || 0,
      fac: history.length,
      fpsHint: l5 != null ? Math.round(1000 / Math.max(1, l5)) : null,
      /* iron */
      L0: l0,
      L3: l3,
      L5: l5,
      L3ok: budgetOk("L3"),
      L5ok: budgetOk("L5"),
      corticalMs:
        window.__mgIronline && window.__mgIronline.corticalMs != null
          ? window.__mgIronline.corticalMs
          : 24,
      loopEmaUs: loop && loop.emaUs ? loop.emaUs() : null,
      rung: rung ? rung.id : null,
      persona: truss && truss.state && truss.state.persona
        ? truss.state.persona.name
        : null,
      url: "https://mueee.qbitos.ai/qbit-core-race.html",
      line: null,
    };
    sit.line =
      "SITREP pkt:" +
      sit.pkt +
      " Q:" +
      sit.Q +
      " DAC:" +
      sit.DAC +
      " gates:" +
      sit.gates +
      " L3:" +
      (sit.L3 != null ? sit.L3.toFixed(2) + "ms" : "?") +
      (sit.L3ok ? "✓" : "!") +
      " L5:" +
      (sit.L5 != null ? sit.L5.toFixed(1) + "ms" : "?") +
      (sit.L5ok ? "✓" : "!") +
      (sit.rung ? " rung:" + sit.rung : "");
    sit.raceUrl = raceUrl(sit);
    last = sit;
    history.push({ t: sit.t, Q: sit.Q, pkt: sit.pkt, L3: sit.L3 });
    if (history.length > maxH) history = history.slice(-maxH);
    paintChip(sit);
    return sit;
  }

  function publish(opts) {
    opts = opts || {};
    var sit = snapshot();
    try {
      if (window.__mgQbitBus) {
        window.__mgQbitBus.publish({
          src: "race",
          kind: "sitrep",
          lane: "L0",
          prefix: "-n:",
          gate: "M",
          withGlyph: true,
          payload: sit,
        });
      }
    } catch (e) {}
    try {
      if (window.__mgQbitTerm)
        window.__mgQbitTerm.write(sit.line, "sitrep");
    } catch (e2) {}
    try {
      if (window.__mgGrokTerm && window.__mgGrokTerm.push)
        window.__mgGrokTerm.push("ok", sit.line);
    } catch (e3) {}
    meshPresence(sit);
    paintChip(sit);
    if (opts.openRace) {
      openRaceWithSitrep(sit);
    }
    if (opts.climb && window.__mgQbitTruss) {
      window.__mgQbitTruss.climb(opts.climb === true ? "sitrep" : String(opts.climb));
    }
    return sit;
  }

  function start(intervalMs) {
    stop();
    intervalMs = Math.max(2000, intervalMs || 8000);
    timer = setInterval(function () {
      publish({ openRace: false });
    }, intervalMs);
    log(VER + " · auto sitrep every " + intervalMs + "ms");
    return intervalMs;
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = 0;
    }
  }

  function report() {
    var s = last || snapshot();
    return VER + " · " + (s.line || "");
  }

  function selfTest() {
    var s = snapshot();
    var results = [
      { name: "snapshot", ok: !!(s && s.line && s.pkt != null) },
      { name: "Q-range", ok: s.Q >= 0 && s.Q <= 1 },
    ];
    var pubbed = publish({});
    results.push({ name: "publish", ok: !!(pubbed && pubbed.line) });
    var ok = results.every(function (r) {
      return r.ok;
    });
    return { ok: ok, results: results, sitrep: s, report: report() };
  }

  window.__mgQbitRace = {
    ver: VER,
    snapshot: snapshot,
    publish: publish,
    start: start,
    stop: stop,
    raceUrl: raceUrl,
    openRace: openRaceWithSitrep,
    last: function () {
      return last;
    },
    history: function () {
      return history.slice();
    },
    report: report,
    selfTest: selfTest,
  };

  /* soft auto-start low duty after bus present */
  setTimeout(function () {
    if (window.__mgQbitBus) {
      publish({});
      start(12000);
    }
  }, 2500);

  log(VER + " · core-race SITREP H5");
})();
