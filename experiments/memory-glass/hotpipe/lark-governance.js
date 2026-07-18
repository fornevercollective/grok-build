/* Memory Glass · Lark Governance tree — web-wide control surface (side rail)
 * Layers from qbit-FLEET code governance + uvspeed Lark plans + glyph hops.
 * Auto feature: every page / epoch tick surfaces unix time, hops, ip, stack layer.
 * Not a generic settings dump — user control surface parallel to MKT filmstrip.
 * VER: lark-governance-v1
 */
(function () {
  "use strict";
  var VER = "lark-governance-v2-sx";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._larkGovVer === VER) return;
  HP._larkGovVer = VER;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "info", String(m || ""), "lark");
    } catch (e) {}
  }

  var LS = "mg.lark.gov.v1";

  /** Canonical layers (qbit-FLEET 10_governance-tree + web hops) */
  var LAYERS = [
    {
      id: "user_glass",
      label: "User · Memory Glass",
      tools: ["WKWebView", "hotpipe", "still-pipe", "inspect dock"],
      hops: 0,
    },
    {
      id: "agent_surface",
      label: "Agent · Grok Build",
      tools: ["grok TUI", "skills", "MCP", "subagents"],
      hops: 1,
    },
    {
      id: "glyph_mesh",
      label: "Glyph · GrokYtalkY / kbatch",
      tools: ["gy pins", "kbatch.ugrad.ai", "mesh walkie"],
      hops: 1,
    },
    {
      id: "llm_surface",
      label: "LLM deployment",
      tools: ["Ollama", "xAI API", "vLLM", "llama.cpp"],
      hops: 2,
    },
    {
      id: "runtimes",
      label: "Runtimes",
      tools: ["CPython", "Node", "WASM", "JVM"],
      hops: 3,
    },
    {
      id: "systems",
      label: "Systems",
      tools: ["Rust", "C/C++", "ARM64", "CUDA"],
      hops: 4,
    },
    {
      id: "binary_net",
      label: "Binary · Net",
      tools: ["Mach-O", "ELF", "TLS", "HTTP/3", "NIC"],
      hops: 5,
    },
    {
      id: "edge_cdn",
      label: "Edge · CDN · DNS",
      tools: ["Cloudflare", "PoP", "glyph subdomain"],
      hops: 6,
    },
  ];

  var state = {
    ver: VER,
    open: false,
    epoch: 0,
    unix: 0,
    hops: 0,
    pageUrl: "",
    ipHint: "local",
    focusLayer: "user_glass",
    policies: {
      noAutoTrade: true,
      noSecretInGit: true,
      resignAfterEdit: true,
      stableMarketWindow: true,
    },
    lastReport: "",
  };

  try {
    var s = JSON.parse(localStorage.getItem(LS) || "{}");
    if (s.open != null) state.open = !!s.open;
    if (s.focusLayer) state.focusLayer = s.focusLayer;
    if (s.policies) state.policies = Object.assign(state.policies, s.policies);
  } catch (e) {}

  function persist() {
    try {
      localStorage.setItem(
        LS,
        JSON.stringify({
          open: state.open,
          focusLayer: state.focusLayer,
          policies: state.policies,
        })
      );
    } catch (e) {}
  }

  function tickEpoch() {
    state.unix = Math.floor(Date.now() / 1000);
    state.epoch = state.unix;
    try {
      state.pageUrl = location.href || "";
    } catch (e) {
      state.pageUrl = "";
    }
    // hops heuristic: depth of path + agent dock presence
    var hops = 0;
    try {
      hops = (location.pathname || "").split("/").filter(Boolean).length;
    } catch (e2) {}
    if (window.__mgDock) hops += 1;
    if (window.__mgMarket) hops += 1;
    if (window.__mgVideo) hops += 1;
    state.hops = hops;
    // IP: best-effort from WebRTC or cached; stay privacy-safe
    if (!state._ipTried) {
      state._ipTried = true;
      tryEstimateIp();
    }
    paintMeta();
  }

  function tryEstimateIp() {
    // No forced STUN spam — use performance/nav offline hints only unless user asks
    state.ipHint = navigator.onLine ? "online·private" : "offline";
    try {
      if (window.__mgLarkIp) state.ipHint = String(window.__mgLarkIp);
    } catch (e) {}
  }

  function ensureStyles() {
    try {
      if (window.__mgSxRail) window.__mgSxRail.ensure();
    } catch (e) {}
    if (document.getElementById("mg-lark-css")) return;
    var st = document.createElement("style");
    st.id = "mg-lark-css";
    /* LARK uses shared .mg-sx-* ; only id anchors + pol layout */
    st.textContent = [
      "#mg-lark-rail.mg-sx-rail{z-index:121}",
      "#mg-lark-pol{padding:8px 12px;border-top:1px solid rgba(160,180,200,0.18);",
      "  display:flex;flex-wrap:wrap;gap:8px;color:rgba(150,170,190,0.85)}",
      "#mg-lark-pol label{display:flex;align-items:center;gap:4px;letter-spacing:0.04em}",
      "#mg-lark-tree{flex:1;overflow:auto;padding:8px 10px}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  var rail, metaEl, treeEl, statusEl;

  function paintMeta() {
    if (!metaEl) return;
    metaEl.innerHTML =
      "unix <b>" +
      state.unix +
      "</b> · epoch <b>" +
      state.epoch +
      "</b><br/>hops <b>" +
      state.hops +
      "</b> · ip <b>" +
      state.ipHint +
      "</b><br/>" +
      '<span style="opacity:0.75;word-break:break-all">' +
      (state.pageUrl || "—").slice(0, 96) +
      "</span>";
  }

  function paintTree() {
    if (!treeEl) return;
    treeEl.innerHTML = "";
    LAYERS.forEach(function (L) {
      var d = document.createElement("div");
      d.className = "mg-sx-card" + (state.focusLayer === L.id ? " on" : "");
      d.innerHTML =
        "<div>" +
        L.label +
        ' <span style="opacity:0.55">h' +
        L.hops +
        "</span></div>" +
        '<div class="sub">' +
        (L.tools || []).join(" · ") +
        "</div>";
      d.onclick = function () {
        state.focusLayer = L.id;
        persist();
        paintTree();
        state.lastReport = "layer " + L.id;
        paintStatus();
      };
      treeEl.appendChild(d);
    });
  }

  function paintStatus() {
    if (statusEl)
      statusEl.textContent =
        VER +
        " · " +
        (state.lastReport || "governance tree · web control surface");
  }

  function setOpen(on) {
    state.open = !!on;
    if (rail) rail.classList.toggle("open", state.open);
    persist();
    if (state.open) {
      tickEpoch();
      paintTree();
    }
  }

  function exportSnapshot() {
    var snap = {
      ver: VER,
      unix: state.unix,
      epoch: state.epoch,
      hops: state.hops,
      ipHint: state.ipHint,
      pageUrl: state.pageUrl,
      focusLayer: state.focusLayer,
      policies: state.policies,
      layers: LAYERS,
      agents: {
        market: !!(window.__mgMarket && window.__mgMarket.report),
        video: !!(window.__mgVideo && window.__mgVideo.report),
        quantum: !!(window.__mgQuantum && window.__mgQuantum.report),
        dock: !!window.__mgDock,
      },
    };
    try {
      var blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "mg-lark-governance-" + state.unix + ".json";
      a.click();
      state.lastReport = "exported snapshot";
      paintStatus();
    } catch (e) {
      log("err", "export fail");
    }
    return snap;
  }

  function mount() {
    ensureStyles();
    if (document.getElementById("mg-lark-rail")) return;
    rail = document.createElement("div");
    rail.id = "mg-lark-rail";
    rail.className = "mg-sx-rail right stack-full";
    rail.innerHTML =
      '<button type="button" id="mg-lark-tab" class="mg-sx-tab" title="Lark governance">LARK</button>' +
      '<div id="mg-lark-panel" class="mg-sx-panel">' +
      '  <div class="mg-sx-head"><span>Lark · Governance</span>' +
      '  <button type="button" id="mg-lark-x" aria-label="close">×</button></div>' +
      '  <div id="mg-lark-meta" class="mg-sx-meta"></div>' +
      '  <div id="mg-lark-tree"></div>' +
      '  <div id="mg-lark-pol">' +
      '    <label><input type="checkbox" id="mg-lark-notrade" checked /> no auto-trade</label>' +
      '    <label><input type="checkbox" id="mg-lark-secret" checked /> no secrets in git</label>' +
      '    <label><input type="checkbox" id="mg-lark-resign" checked /> resign after edit</label>' +
      '    <label><input type="checkbox" id="mg-lark-stable" checked /> stable mkt window</label>' +
      "  </div>" +
      '  <div class="mg-sx-row" id="mg-lark-acts">' +
      '    <button type="button" class="mg-sx-btn ok" id="mg-lark-tick">TICK</button>' +
      '    <button type="button" class="mg-sx-btn" id="mg-lark-exp">EXPORT</button>' +
      '    <button type="button" class="mg-sx-btn hot" id="mg-lark-fleet">FLEET</button>' +
      "  </div>" +
      '  <div id="mg-lark-status" class="mg-sx-status"></div>' +
      "</div>";
    (document.body || document.documentElement).appendChild(rail);
    metaEl = rail.querySelector("#mg-lark-meta");
    treeEl = rail.querySelector("#mg-lark-tree");
    statusEl = rail.querySelector("#mg-lark-status");

    rail.querySelector("#mg-lark-tab").onclick = function () {
      setOpen(!state.open);
    };
    rail.querySelector("#mg-lark-x").onclick = function () {
      setOpen(false);
    };
    rail.querySelector("#mg-lark-tick").onclick = function () {
      tickEpoch();
      state.lastReport = "tick " + state.unix;
      paintStatus();
    };
    rail.querySelector("#mg-lark-exp").onclick = function () {
      exportSnapshot();
    };
    rail.querySelector("#mg-lark-fleet").onclick = function () {
      try {
        if (window.ipc)
          window.ipc.postMessage(
            JSON.stringify({
              op: "navigate",
              url: "https://github.com/fornevercollective",
            })
          );
        else window.open("https://github.com/fornevercollective", "_blank");
      } catch (e) {}
      state.lastReport = "fleet org";
      paintStatus();
    };

    function bindPol(id, key) {
      var el = rail.querySelector(id);
      if (!el) return;
      el.checked = !!state.policies[key];
      el.onchange = function () {
        state.policies[key] = !!el.checked;
        persist();
      };
    }
    bindPol("#mg-lark-notrade", "noAutoTrade");
    bindPol("#mg-lark-secret", "noSecretInGit");
    bindPol("#mg-lark-resign", "resignAfterEdit");
    bindPol("#mg-lark-stable", "stableMarketWindow");

    if (state.open) rail.classList.add("open");
    tickEpoch();
    paintTree();
    paintStatus();
    setInterval(tickEpoch, 5000);
    log("ok", VER + " · SpaceX right rail");
  }

  window.__mgLark = {
    ver: VER,
    state: state,
    layers: LAYERS,
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: function () {
      setOpen(!state.open);
    },
    tick: tickEpoch,
    exportSnapshot: exportSnapshot,
    setIp: function (ip) {
      state.ipHint = String(ip || "local");
      window.__mgLarkIp = state.ipHint;
      paintMeta();
    },
    report: function () {
      return (
        VER +
        " unix=" +
        state.unix +
        " hops=" +
        state.hops +
        " layer=" +
        state.focusLayer
      );
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
