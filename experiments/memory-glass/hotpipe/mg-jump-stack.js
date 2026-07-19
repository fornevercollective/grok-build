/* Memory Glass · JUMP STACK A–F
 * A Presentable craft · B Agent-in-glass · C Mesh presence · D Isolation roles
 * E Plane map (drawers) · F Browser wedge metrics
 * VER: mg-jump-stack-v1
 */
(function () {
  "use strict";
  var VER = "mg-jump-stack-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._jumpStackVer === VER) return;
  HP._jumpStackVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "jump");
    } catch (e) {}
  }

  /** E — plane localization map */
  var PLANES = {
    control: { home: "left", api: "__mgToolsDrawer", label: "TOOLS" },
    data: { home: "right", api: "__mgRightDrawer", label: "DATA" },
    train: { home: "shell", ids: ["board", "solve"], label: "LIVE/SOLVE" },
    market: { home: "right", mode: "mkt", label: "Mkt" },
    language: { home: "left", section: "kbatch", label: "kbatch/R4" },
    music: { home: "left", open: ["beats", "maze"], label: "Beats·Maze" },
    agent: { home: "right", mode: "grok", label: "Grok" },
    inspect: { home: "right", mode: "inspect", label: "Inspect" },
    collab: { home: "right", mode: "chat", label: "Chat·Mesh" },
    spatial: { home: "shell", note: "contrail/depth/page-axis", label: "Spatial" },
  };

  /** D — isolation roles (Ladybird-inspired; scaffold) */
  var ROLES = {
    shell: { surfaces: ["#mg-root", "#mg-tools-drawer", "#mg-right-drawer"] },
    content: { surfaces: ["body"] },
    inspect: { surfaces: ["#mg-dev", "inspect_wv"] },
    agent: { surfaces: ["#mg-grok-term", "__mgGrokTerm"] },
  };

  function openPlane(planeId) {
    var P = PLANES[planeId];
    if (!P) return { ok: false, err: "unknown plane" };
    window.__mgUserChromeTouch = true;
    if (P.home === "left" && window.__mgToolsDrawer) {
      window.__mgToolsDrawer.open();
      return { ok: true, plane: planeId, via: "left" };
    }
    if (P.home === "right" && window.__mgRightDrawer) {
      window.__mgRightDrawer.open(P.mode || "live");
      return { ok: true, plane: planeId, via: "right", mode: P.mode };
    }
    if (planeId === "train" && window.__mgActivityBoard) {
      window.__mgActivityBoard.open({ collapsed: true });
      return { ok: true, plane: planeId, via: "board-pill" };
    }
    if (planeId === "music") {
      if (window.__mgMenus) {
        window.__mgMenus.open("beats");
        window.__mgMenus.open("maze");
      }
      return { ok: true, plane: planeId, via: "menus" };
    }
    return { ok: false, plane: planeId, err: "no handler" };
  }

  /** C — Zed-lite mesh presence pulse */
  function meshPing() {
    try {
      var payload = {
        type: "mg_presence",
        ver: VER,
        t: Date.now(),
        href: String(location.href || "").slice(0, 120),
        product: !!window.__mgProductMode,
      };
      if (window.__mgMesh && window.__mgMesh.broadcast)
        window.__mgMesh.broadcast(payload);
      else if (typeof BroadcastChannel !== "undefined") {
        var ch = new BroadcastChannel("mg-mesh");
        ch.postMessage(payload);
        ch.close();
      }
      return { ok: true, payload: payload };
    } catch (e) {
      return { ok: false, err: String(e) };
    }
  }

  /** B — agent surface report for Grok */
  function agentSurface() {
    return {
      toolsDrawer: !!(window.__mgToolsDrawer && window.__mgToolsDrawer.ver),
      rightDrawer: !!(window.__mgRightDrawer && window.__mgRightDrawer.ver),
      menus: !!(window.__mgMenus && window.__mgMenus.ver),
      cal: !!(window.__mgCal && window.__mgCal.ver),
      grokTerm: !!(window.__mgGrokTerm && window.__mgGrokTerm.ver),
      market: !!(window.__mgMarket && window.__mgMarket.ver),
      planes: Object.keys(PLANES),
      monorepoHint: "crates/codegen/xai-grok-tools · SOURCE_REV at repo root",
    };
  }

  /** F — browser wedge scoreboard snapshot */
  function wedgeMetrics() {
    var m = {
      ver: VER,
      shell: "tao+wry/WKWebView",
      processClaim: "1 primary + optional inspect",
      hotpipe: true,
      dualDrawer: !!(window.__mgToolsDrawer && window.__mgRightDrawer),
      presentable: document.documentElement.classList.contains("mg-presentable"),
      product: !!window.__mgProductMode,
      ironline: !!(window.__mgIronline || window.__mgIronLine),
      webgridWatch: !!(window.__mgWebgridWatch || window.__MG_WATCH),
    };
    try {
      if (window.__mgMenus && window.__mgMenus.last) {
        var p = window.__mgMenus.last();
        if (p) {
          m.menusPass = p.pass;
          m.menusTotal = p.total;
          m.menusOk = p.ok;
        }
      }
    } catch (e) {}
    return m;
  }

  /** A — force presentable chrome classes */
  function presentable() {
    try {
      document.documentElement.classList.add("mg-presentable");
      document.documentElement.classList.add("mg-drawer-mode");
      document.documentElement.classList.add("mg-dual-drawer");
      if (window.__mgChromeTokens && window.__mgChromeTokens.apply)
        window.__mgChromeTokens.apply();
      /* hide permanent CTRL float */
      var cap = document.getElementById("mg-glass-cap");
      if (cap) {
        cap.style.setProperty("display", "none", "important");
      }
    } catch (e) {}
    return { ok: true };
  }

  /** Full jump report A–F */
  function reportAll() {
    return {
      ver: VER,
      A_presentable: presentable(),
      B_agent: agentSurface(),
      C_mesh: meshPing(),
      D_roles: ROLES,
      E_planes: PLANES,
      F_wedge: wedgeMetrics(),
    };
  }

  window.__mgJump = {
    ver: VER,
    planes: PLANES,
    roles: ROLES,
    openPlane: openPlane,
    meshPing: meshPing,
    agentSurface: agentSurface,
    wedgeMetrics: wedgeMetrics,
    presentable: presentable,
    report: reportAll,
  };

  /* D — expose isolation roles for H7 */
  window.__mgIsolate = window.__mgIsolate || {};
  window.__mgIsolate.roles = ROLES;
  window.__mgIsolate.role = function () {
    return "shell";
  };

  setTimeout(function () {
    presentable();
    meshPing();
    log(VER + " · A–F jump stack ready");
  }, 200);
})();
