/* Memory Glass · Qbit Router
 * src + kind → handler registry; IronLine budgetOk gate before heavy work.
 * Default subscribers: IronLine sample · inspect ring · tensor/gutter hooks.
 * L3 = pure / no DOM. L5 handlers only schedule via __mgQbitLoop.scheduleL5.
 * VER: qbit-router-v2
 */
(function () {
  "use strict";
  var VER = "qbit-router-v2";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._qbitRouterVer === VER) return;
  HP._qbitRouterVer = VER;

  var routes = {};
  var stats = {
    routed: 0,
    skippedBudget: 0,
    errors: 0,
    defaults: 0,
    byKey: {},
  };
  var unsub = null;
  var bound = false;
  var defaultsInstalled = false;
  var ring = []; /* last N envs for inspect */
  var RING_N = 48;
  var lastGutter = null;
  var lastCell = null;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "qbit-router");
    } catch (e) {}
  }

  function keyOf(src, kind) {
    return String(src || "*") + ":" + String(kind || "*");
  }

  function on(src, kind, fn) {
    if (typeof src === "function") {
      fn = src;
      src = "*";
      kind = "*";
    } else if (typeof kind === "function") {
      fn = kind;
      kind = "*";
    }
    if (typeof fn !== "function") return function () {};
    var k = keyOf(src, kind);
    if (!routes[k]) routes[k] = [];
    routes[k].push(fn);
    return function () {
      routes[k] = (routes[k] || []).filter(function (f) {
        return f !== fn;
      });
    };
  }

  function matchHandlers(env) {
    var src = env.src || "anon";
    var kind = env.kind || "event";
    var keys = [
      keyOf(src, kind),
      keyOf("*", kind),
      keyOf(src, "*"),
      keyOf("*", "*"),
    ];
    var out = [];
    var seen = {};
    for (var i = 0; i < keys.length; i++) {
      var list = routes[keys[i]] || [];
      for (var j = 0; j < list.length; j++) {
        if (seen[list[j]]) continue;
        seen[list[j]] = true;
        out.push(list[j]);
      }
    }
    return out;
  }

  function budgetAllows(env) {
    var lane = env.lane || "L3";
    try {
      if (
        window.__mgIronline &&
        typeof window.__mgIronline.budgetOk === "function"
      ) {
        if (lane === "L5" && !window.__mgIronline.budgetOk("L5")) return false;
        if (lane === "L3" && !window.__mgIronline.budgetOk("L3")) {
          if (env.payload && env.payload.heavy) return false;
        }
      }
    } catch (e) {}
    return true;
  }

  function pushRing(env) {
    ring.push({
      seq: env.seq,
      src: env.src,
      kind: env.kind,
      prefix: env.prefix,
      lane: env.lane,
      tμ: env.tμ,
    });
    if (ring.length > RING_N) ring = ring.slice(-RING_N);
  }

  function installDefaults() {
    if (defaultsInstalled) return;
    defaultsInstalled = true;
    stats.defaults = 1;

    /* 1) IronLine last-hop sample + state */
    on("*", "*", function (env) {
      try {
        if (window.__mgIronline) {
          window.__mgIronline.state = window.__mgIronline.state || {};
          window.__mgIronline.state.lastQbit = {
            src: env.src,
            kind: env.kind,
            prefix: env.prefix,
            tμ: env.tμ,
            seq: env.seq,
          };
        }
      } catch (e) {}
    });

    /* 2) Inspect ring — schedule L5 only if mirror does DOM */
    on("*", "*", function (env) {
      pushRing(env);
      try {
        if (window.__mgInspectMirror && window.__mgInspectMirror.push) {
          var payload = {
            ch: "qbit",
            kind: env.kind,
            src: env.src,
            prefix: env.prefix,
            tμ: env.tμ,
          };
          if (window.__mgQbitLoop && window.__mgQbitLoop.scheduleL5) {
            window.__mgQbitLoop.scheduleL5(function () {
              try {
                window.__mgInspectMirror.push(payload);
              } catch (e2) {}
            });
          } else {
            window.__mgInspectMirror.push(payload);
          }
        }
      } catch (e) {}
    });

    /* 3) Tensor-adjacent: remember last cell; optional L5 paint schedule */
    on("webgrid", "cell", function (env) {
      lastCell = env;
      try {
        if (window.__mgQbitLoop && window.__mgQbitLoop.scheduleL5) {
          window.__mgQbitLoop.scheduleL5(function () {
            /* surfaces already paint; this is a hook point for HUD */
          }, { kind: "cell-hud" });
        }
      } catch (e) {}
    });

    /* 4) Gutter first-class viewer state */
    on("*", "gutter", function (env) {
      lastGutter = env;
      try {
        HP.lastGutter = env;
        if (window.__mgQbitDac && env.payload && env.payload.bitCount != null) {
          var lvl = Math.min(1, (env.payload.bitCount || 0) / 256);
          window.__mgQbitDac.set("hud", lvl, { src: "gutter", publish: false });
        }
      } catch (e) {}
    });

    log(VER + " · default subscribers installed");
  }

  function dispatch(env) {
    if (!env) return 0;
    if (!budgetAllows(env)) {
      stats.skippedBudget++;
      return 0;
    }
    var handlers = matchHandlers(env);
    var n = 0;
    var t0 = performance.now();
    for (var i = 0; i < handlers.length; i++) {
      try {
        handlers[i](env);
        n++;
      } catch (e) {
        stats.errors++;
      }
    }
    var dt = performance.now() - t0;
    stats.routed++;
    var k = keyOf(env.src, env.kind);
    stats.byKey[k] = (stats.byKey[k] || 0) + 1;
    try {
      if (window.__mgIronline && window.__mgIronline.tick)
        window.__mgIronline.tick(env.lane || "L3", dt);
    } catch (eI) {}
    return n;
  }

  function bindBus() {
    if (!window.__mgQbitBus) return false;
    installDefaults();
    if (bound) return true;
    if (unsub)
      try {
        unsub();
      } catch (e) {}
    unsub = window.__mgQbitBus.subscribe(function (env) {
      dispatch(env);
    });
    bound = true;
    log(VER + " · bound to __mgQbitBus");
    return true;
  }

  function report() {
    return (
      VER +
      " routed=" +
      stats.routed +
      " skipBudget=" +
      stats.skippedBudget +
      " err=" +
      stats.errors +
      " bound=" +
      bound +
      " defaults=" +
      (defaultsInstalled ? 1 : 0) +
      " ring=" +
      ring.length
    );
  }

  window.__mgQbitRouter = {
    ver: VER,
    on: on,
    dispatch: dispatch,
    bindBus: bindBus,
    installDefaults: installDefaults,
    budgetAllows: budgetAllows,
    stats: stats,
    report: report,
    routes: routes,
    ring: function () {
      return ring.slice();
    },
    lastGutter: function () {
      return lastGutter;
    },
    lastCell: function () {
      return lastCell;
    },
  };

  setTimeout(bindBus, 50);
  setTimeout(bindBus, 400);
  setInterval(function () {
    if (!bound) bindBus();
  }, 3000);

  log(VER + " · defaults + IronLine/inspect/gutter/tensor");
})();
