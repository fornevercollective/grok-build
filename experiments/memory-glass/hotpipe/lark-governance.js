/* Memory Glass · Lark Governance tree — web-wide control surface (side rail)
 * Layers from qbit-FLEET code governance + uvspeed Lark plans + glyph hops.
 * Auto feature: every page / epoch tick surfaces unix time, hops, ip, stack layer.
 * Not a generic settings dump — user control surface parallel to MKT filmstrip.
 * VER: lark-governance-v1
 */
(function () {
  "use strict";
  var VER = "lark-governance-v1";
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
    if (document.getElementById("mg-lark-css")) return;
    var st = document.createElement("style");
    st.id = "mg-lark-css";
    st.textContent = [
      "#mg-lark-rail{position:fixed;bottom:12px;right:48px;z-index:118;display:flex;flex-direction:column;",
      "  align-items:flex-end;font:600 9px/1.25 ui-monospace,Menlo,monospace;pointer-events:none}",
      "#mg-lark-tab{pointer-events:auto;appearance:none;cursor:pointer;",
      "  border:1px solid rgba(200,160,255,0.4);background:rgba(14,10,20,0.94);",
      "  color:rgba(220,190,255,0.92);padding:6px 10px;border-radius:4px;",
      "  letter-spacing:0.12em;text-transform:uppercase}",
      "#mg-lark-panel{pointer-events:auto;width:0;max-height:0;overflow:hidden;transition:all .18s ease;",
      "  background:rgba(10,8,16,0.97);border:1px solid rgba(180,140,255,0.28);",
      "  color:rgba(230,220,250,0.92);margin-bottom:6px;border-radius:4px}",
      "#mg-lark-rail.open #mg-lark-panel{width:min(400px,92vw);max-height:min(70vh,520px);",
      "  display:flex;flex-direction:column}",
      "#mg-lark-head{padding:8px 10px;border-bottom:1px solid rgba(160,120,220,0.22);",
      "  display:flex;justify-content:space-between;letter-spacing:0.1em;text-transform:uppercase}",
      "#mg-lark-meta{padding:6px 10px;opacity:0.9;font-weight:500;",
      "  border-bottom:1px solid rgba(160,120,220,0.12)}",
      "#mg-lark-tree{flex:1;overflow:auto;padding:6px 8px}",
      "#mg-lark-tree .layer{padding:5px 6px;margin-bottom:3px;border:1px solid rgba(140,100,200,0.2);",
      "  border-radius:3px;cursor:pointer}",
      "#mg-lark-tree .layer.on{border-color:rgba(200,160,255,0.55);background:rgba(40,24,60,0.45)}",
      "#mg-lark-tree .tools{opacity:0.75;font-weight:500;margin-top:2px}",
      "#mg-lark-pol{padding:6px 10px;border-top:1px solid rgba(160,120,220,0.2);display:flex;flex-wrap:wrap;gap:6px}",
      "#mg-lark-pol label{display:flex;align-items:center;gap:3px;opacity:0.9}",
      "#mg-lark-acts{display:flex;flex-wrap:wrap;gap:4px;padding:6px 8px 8px}",
      "#mg-lark-acts button{appearance:none;cursor:pointer;border:1px solid rgba(180,140,255,0.35);",
      "  background:rgba(16,12,24,0.95);color:inherit;padding:5px 7px;border-radius:3px;",
      "  text-transform:uppercase;letter-spacing:0.06em}",
      "#mg-lark-status{padding:0 8px 8px;opacity:0.8;font-weight:500}",
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
      d.className = "layer" + (state.focusLayer === L.id ? " on" : "");
      d.innerHTML =
        "<div>" +
        L.label +
        ' <span style="opacity:0.55">h' +
        L.hops +
        "</span></div>" +
        '<div class="tools">' +
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
    rail.innerHTML =
      '<div id="mg-lark-panel">' +
      '  <div id="mg-lark-head"><span>Lark · Governance</span>' +
      '  <button type="button" id="mg-lark-x" style="appearance:none;background:transparent;border:0;color:inherit;cursor:pointer">×</button></div>' +
      '  <div id="mg-lark-meta"></div>' +
      '  <div id="mg-lark-tree"></div>' +
      '  <div id="mg-lark-pol">' +
      '    <label><input type="checkbox" id="mg-lark-notrade" checked /> no auto-trade</label>' +
      '    <label><input type="checkbox" id="mg-lark-secret" checked /> no secrets in git</label>' +
      '    <label><input type="checkbox" id="mg-lark-resign" checked /> resign after edit</label>' +
      '    <label><input type="checkbox" id="mg-lark-stable" checked /> stable mkt window</label>' +
      "  </div>" +
      '  <div id="mg-lark-acts">' +
      '    <button type="button" id="mg-lark-tick">TICK</button>' +
      '    <button type="button" id="mg-lark-exp">EXPORT</button>' +
      '    <button type="button" id="mg-lark-fleet">FLEET</button>' +
      "  </div>" +
      '  <div id="mg-lark-status"></div>' +
      "</div>" +
      '<button type="button" id="mg-lark-tab" title="Lark governance">LARK</button>';
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
    log("ok", VER + " · LARK control surface");
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
