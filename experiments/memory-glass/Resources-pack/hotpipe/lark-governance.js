/* Memory Glass · Lark Governance tree
 * Full hierarchical tree from Downloads/lark-tree (IANA + CDN) + MG fleet stack.
 * Surfaces in LARK rail · TOOLS → GT embed · CTRL GT tab.
 * VER: lark-governance-v3-tree
 */
(function () {
  "use strict";
  var VER = "lark-governance-v3-tree";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._larkGovVer === VER) return;
  HP._larkGovVer = VER;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "info", String(m || ""), "lark");
    } catch (e) {}
  }

  var LS = "mg.lark.gov.v2";
  var expanded = {};
  var selectedId = null;
  var searchQ = "";
  var treeRoots = null; /* full hierarchy */
  var treeLoading = false;

  /** Flat MG fleet layers (legacy API for glass-cap / tick) */
  var LAYERS = [
    { id: "user_glass", label: "User · Memory Glass", tools: ["WKWebView", "hotpipe", "still-pipe", "inspect dock"], hops: 0 },
    { id: "agent_surface", label: "Agent · Grok Build", tools: ["grok TUI", "skills", "MCP", "subagents"], hops: 1 },
    { id: "glyph_mesh", label: "Glyph · GrokYtalkY / kbatch", tools: ["gy pins", "kbatch.ugrad.ai", "mesh walkie"], hops: 1 },
    { id: "llm_surface", label: "LLM deployment", tools: ["Ollama", "xAI API", "vLLM", "llama.cpp"], hops: 2 },
    { id: "runtimes", label: "Runtimes", tools: ["CPython", "Node", "WASM", "JVM"], hops: 3 },
    { id: "systems", label: "Systems", tools: ["Rust", "C/C++", "ARM64", "CUDA"], hops: 4 },
    { id: "binary_net", label: "Binary · Net", tools: ["Mach-O", "ELF", "TLS", "HTTP/3", "NIC"], hops: 5 },
    { id: "edge_cdn", label: "Edge · CDN · DNS", tools: ["Cloudflare", "PoP", "glyph subdomain"], hops: 6 },
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
    selected: null,
  };

  try {
    var s = JSON.parse(localStorage.getItem(LS) || "{}");
    if (s.open != null) state.open = !!s.open;
    if (s.focusLayer) state.focusLayer = s.focusLayer;
    if (s.policies) state.policies = Object.assign(state.policies, s.policies);
    if (s.expanded) expanded = s.expanded;
    if (s.selectedId) selectedId = s.selectedId;
  } catch (e) {}

  function persist() {
    try {
      localStorage.setItem(
        LS,
        JSON.stringify({
          open: state.open,
          focusLayer: state.focusLayer,
          policies: state.policies,
          expanded: expanded,
          selectedId: selectedId,
        })
      );
    } catch (e) {}
  }

  function defaultTree() {
    return [
      {
        id: "mg-root",
        name: "Memory Glass · fleet stack",
        description: "Local MG control surface — user glass through binary/net",
        children: LAYERS.map(function (L) {
          return {
            id: L.id,
            name: L.label,
            description: (L.tools || []).join(" · "),
          };
        }),
      },
      {
        id: "1",
        name: "ICANN",
        description: "Internet Corporation for Assigned Names and Numbers",
        children: [
          {
            id: "1.1",
            name: "IANA Functions Operator",
            description: "Protocol parameters · domain names · IP addresses",
            children: [
              { id: "1.1.1", name: "Protocol Parameters Registry", description: "Protocol registries with SDOs" },
              {
                id: "1.1.2",
                name: "Root Zone Management",
                description: "DNS root zone",
                children: [
                  {
                    id: "cdn-infra",
                    name: "CDN Infrastructure",
                    description: "Edge caching layers",
                    children: [
                      { id: "cdn-1", name: "Cloudflare", type: "cdn", description: "275+ cities · 100+ countries" },
                      { id: "cdn-2", name: "Akamai", type: "cdn", description: "300k+ servers · 130+ countries" },
                      { id: "cdn-3", name: "Fastly", type: "cdn", description: "Edge cloud · CDN · security" },
                      { id: "cdn-4", name: "AWS CloudFront", type: "cdn", description: "AWS global CDN" },
                      { id: "cdn-5", name: "Google Cloud CDN", type: "cdn", description: "Google edge network" },
                      { id: "cdn-6", name: "Microsoft Azure CDN", type: "cdn", description: "Azure CDN" },
                    ],
                  },
                ],
              },
              { id: "1.1.3", name: "Internet Number Resources", description: "Global IP + AS pool" },
            ],
          },
          {
            id: "1.2",
            name: "ICANN Board",
            description: "Overall policy direction",
            children: [
              { id: "1.2.1", name: "Governance Committee", description: "Governance framework" },
              { id: "1.2.2", name: "Audit Committee", description: "Financial accounting" },
            ],
          },
        ],
      },
      {
        id: "2",
        name: "IAB",
        description: "Internet Architecture Board",
        children: [
          {
            id: "2.1",
            name: "IETF",
            description: "Internet Engineering Task Force",
            children: [
              { id: "2.1.1", name: "IESG", description: "Technical specification process" },
              {
                id: "2.1.2",
                name: "Working Groups",
                description: "Protocol development groups",
                children: [
                  {
                    id: "2.1.2.1",
                    name: "HTTPBis Working Group",
                    description: "HTTP protocol specifications",
                    children: [
                      { id: "2.1.2.1.1", name: "HTTP/2 Standard", description: "CDN efficiency influence" },
                      {
                        id: "2.1.2.1.2",
                        name: "HTTP/3 Standard",
                        description: "QUIC transport · major CDN adoption",
                        children: [
                          { id: "cdn-http3-1", name: "Cloudflare HTTP/3", type: "cdn", description: "Early H3 adopter" },
                          { id: "cdn-http3-2", name: "Fastly HTTP/3", type: "cdn", description: "H3 on edge network" },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: "2.2",
            name: "IRTF",
            description: "Long-term internet protocol research",
            children: [
              {
                id: "2.2.1",
                name: "Research Groups",
                children: [
                  {
                    id: "2.2.1.1",
                    name: "DINRG",
                    description: "Decentralized Internet Infrastructure RG",
                    children: [
                      {
                        id: "cdn-research-1",
                        name: "Cloudflare Distributed Web Gateway",
                        type: "cdn",
                        description: "IPFS / distributed web",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "3",
        name: "RIRs",
        description: "Regional Internet Registries",
        children: [
          { id: "3.1", name: "AFRINIC", description: "Africa" },
          {
            id: "3.2",
            name: "APNIC",
            description: "Asia-Pacific",
            children: [
              {
                id: "3.2.1",
                name: "APNIC IP Allocations",
                children: [
                  { id: "cdn-ap-1", name: "Cloudflare APAC", type: "cdn" },
                  { id: "cdn-ap-2", name: "Akamai APAC", type: "cdn" },
                ],
              },
            ],
          },
          {
            id: "3.3",
            name: "ARIN",
            description: "North America",
            children: [
              {
                id: "3.3.1",
                name: "ARIN IP Allocations",
                children: [
                  { id: "cdn-na-1", name: "Cloudflare NA", type: "cdn" },
                  { id: "cdn-na-2", name: "Akamai NA", type: "cdn" },
                  { id: "cdn-na-3", name: "Fastly NA", type: "cdn" },
                  { id: "cdn-na-4", name: "CloudFront NA", type: "cdn" },
                ],
              },
            ],
          },
          { id: "3.4", name: "LACNIC", description: "Latin America & Caribbean" },
          {
            id: "3.5",
            name: "RIPE NCC",
            description: "Europe · Middle East · Central Asia",
            children: [
              {
                id: "3.5.1",
                name: "RIPE IP Allocations",
                children: [
                  { id: "cdn-eu-1", name: "Cloudflare EU", type: "cdn" },
                  { id: "cdn-eu-2", name: "Akamai EU", type: "cdn" },
                ],
              },
            ],
          },
        ],
      },
      { id: "4", name: "PTI", description: "Public Technical Identifiers — IANA functions affiliate" },
      {
        id: "5",
        name: "Major CDN Organizations",
        description: "Parent companies of global CDNs",
        children: [
          { id: "5.1", name: "Cloudflare, Inc.", type: "cdn", description: "Founded 2009" },
          { id: "5.2", name: "Akamai Technologies", type: "cdn", description: "Founded 1998" },
          { id: "5.3", name: "Fastly, Inc.", type: "cdn", description: "Founded 2011" },
          { id: "5.4", name: "Amazon Web Services", description: "CloudFront parent" },
          { id: "5.5", name: "Google LLC", description: "Cloud CDN parent" },
          { id: "5.6", name: "Microsoft Corporation", description: "Azure CDN parent" },
        ],
      },
    ];
  }

  function loadTreeSeed(cb) {
    if (treeRoots && treeRoots.length) {
      if (cb) cb({ ok: true, n: treeRoots.length, source: "cache" });
      return;
    }
    if (window.__mgLarkTreeSeed && window.__mgLarkTreeSeed.roots) {
      treeRoots = window.__mgLarkTreeSeed.roots;
      if (cb) cb({ ok: true, n: treeRoots.length, source: "inject" });
      return;
    }
    if (treeLoading) {
      setTimeout(function () {
        loadTreeSeed(cb);
      }, 120);
      return;
    }
    treeLoading = true;
    var urls = [
      "hotpipe/data/lark-governance-tree.json",
      "../hotpipe/data/lark-governance-tree.json",
      "./data/lark-governance-tree.json",
    ];
    var i = 0;
    function next() {
      if (i >= urls.length) {
        treeRoots = defaultTree();
        treeLoading = false;
        log("ok", VER + " · tree seed fallback n=" + treeRoots.length);
        if (cb) cb({ ok: true, n: treeRoots.length, source: "builtin" });
        return;
      }
      var url = urls[i++];
      fetch(url, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        })
        .then(function (j) {
          treeRoots = j.roots || j.tree || (Array.isArray(j) ? j : null);
          if (!treeRoots || !treeRoots.length) throw new Error("empty");
          window.__mgLarkTreeSeed = j.roots ? j : { roots: treeRoots };
          treeLoading = false;
          log("ok", VER + " · tree seed " + treeRoots.length + " · " + url);
          if (cb) cb({ ok: true, n: treeRoots.length, source: url });
        })
        .catch(function () {
          next();
        });
    }
    next();
  }

  function tickEpoch() {
    state.unix = Math.floor(Date.now() / 1000);
    state.epoch = state.unix;
    try {
      state.pageUrl = location.href || "";
    } catch (e) {
      state.pageUrl = "";
    }
    var hops = 0;
    try {
      hops = (location.pathname || "").split("/").filter(Boolean).length;
    } catch (e2) {}
    if (window.__mgDock) hops += 1;
    if (window.__mgMarket) hops += 1;
    if (window.__mgVideo) hops += 1;
    if (window.__mgKeyboardBeats) hops += 1;
    state.hops = hops;
    if (!state._ipTried) {
      state._ipTried = true;
      state.ipHint = navigator.onLine ? "online·private" : "offline";
      try {
        if (window.__mgLarkIp) state.ipHint = String(window.__mgLarkIp);
      } catch (e3) {}
    }
    paintMeta();
    paintEmbedMeta();
  }

  function ensureStyles() {
    try {
      if (window.__mgSxRail) window.__mgSxRail.ensure();
    } catch (e) {}
    var old = document.getElementById("mg-lark-css");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "mg-lark-css";
    st.textContent = [
      "#mg-lark-rail.mg-sx-rail{z-index:121}",
      "#mg-lark-pol{padding:8px 12px;border-top:1px solid rgba(255,255,255,0.08);",
      "  display:flex;flex-wrap:wrap;gap:8px;color:rgba(255,255,255,0.45);",
      "  font:500 10px/1.2 -apple-system,system-ui}",
      "#mg-lark-pol label{display:flex;align-items:center;gap:4px}",
      "#mg-lark-search{width:100%;box-sizing:border-box;margin:0 0 8px;padding:9px 12px;",
      "  border:0;border-radius:12px;background:rgba(255,255,255,0.08);",
      "  color:rgba(255,255,255,0.92);font:500 12px/1.2 -apple-system,system-ui;outline:none;",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.1)}",
      "#mg-lark-search:focus{background:rgba(255,255,255,0.12)}",
      "#mg-lark-tree,#mg-drawer-lark-tree{",
      "  flex:1;overflow:auto;padding:4px 2px 8px;min-height:120px}",
      "#mg-lark-tree .lt-node,#mg-drawer-lark-tree .lt-node{",
      "  margin:0;padding:0}",
      "#mg-lark-tree .lt-row,#mg-drawer-lark-tree .lt-row{",
      "  display:flex;align-items:flex-start;gap:6px;padding:7px 8px;margin:2px 0;",
      "  border-radius:12px;cursor:pointer;user-select:none;",
      "  background:rgba(255,255,255,0.06);",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.08);",
      "  transition:background .12s}",
      "#mg-lark-tree .lt-row:hover,#mg-drawer-lark-tree .lt-row:hover{",
      "  background:rgba(255,255,255,0.12)}",
      "#mg-lark-tree .lt-row.on,#mg-drawer-lark-tree .lt-row.on{",
      "  background:rgba(10,132,255,0.18);",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.14)}",
      "#mg-lark-tree .lt-chev,#mg-drawer-lark-tree .lt-chev{",
      "  flex-shrink:0;width:16px;height:16px;margin-top:1px;border:0;",
      "  background:transparent;color:rgba(255,255,255,0.4);cursor:pointer;",
      "  font:600 10px/1 system-ui;padding:0}",
      "#mg-lark-tree .lt-chev.empty,#mg-drawer-lark-tree .lt-chev.empty{opacity:0.15;cursor:default}",
      "#mg-lark-tree .lt-body,#mg-drawer-lark-tree .lt-body{min-width:0;flex:1}",
      "#mg-lark-tree .lt-name,#mg-drawer-lark-tree .lt-name{",
      "  font:600 12px/1.25 -apple-system,system-ui;color:rgba(255,255,255,0.92)}",
      "#mg-lark-tree .lt-desc,#mg-drawer-lark-tree .lt-desc{",
      "  font:500 10px/1.3 -apple-system,system-ui;color:rgba(255,255,255,0.4);margin-top:2px}",
      "#mg-lark-tree .lt-tag,#mg-drawer-lark-tree .lt-tag{",
      "  display:inline-block;margin-left:6px;padding:2px 6px;border-radius:6px;",
      "  font:600 9px/1 system-ui;background:rgba(255,255,255,0.1);",
      "  color:rgba(255,255,255,0.55);vertical-align:middle}",
      "#mg-lark-tree .lt-tag.cdn,#mg-drawer-lark-tree .lt-tag.cdn{",
      "  background:rgba(10,132,255,0.2);color:rgba(160,210,255,0.95)}",
      "#mg-lark-tree .lt-kids,#mg-drawer-lark-tree .lt-kids{",
      "  margin-left:12px;padding-left:8px;border-left:1px solid rgba(255,255,255,0.08)}",
      "#mg-lark-detail,#mg-drawer-lark-detail{",
      "  margin-top:8px;padding:12px;border-radius:16px;",
      "  background:rgba(255,255,255,0.08);",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.12)}",
      "#mg-lark-detail .k,#mg-drawer-lark-detail .k{",
      "  font:600 10px/1 system-ui;color:rgba(255,255,255,0.4);margin-bottom:4px}",
      "#mg-lark-detail .v,#mg-drawer-lark-detail .v{",
      "  font:600 13px/1.3 -apple-system,system-ui;color:rgba(255,255,255,0.95)}",
      "#mg-lark-detail .d,#mg-drawer-lark-detail .d{",
      "  font:500 11px/1.35 system-ui;color:rgba(255,255,255,0.5);margin-top:6px}",
      "#mg-lark-meta.mg-sx-meta,#mg-drawer-lark-meta{",
      "  font:500 10px/1.4 ui-monospace,Menlo,monospace;color:rgba(255,255,255,0.45);",
      "  padding:6px 2px 8px}",
      "#mg-lark-meta b,#mg-drawer-lark-meta b{color:rgba(255,255,255,0.8);font-weight:600}",
      "#mg-drawer-lark-host{display:flex;flex-direction:column;min-height:0;gap:6px}",
      "#mg-drawer-lark-acts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:8px}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  var rail, metaEl, treeEl, statusEl, detailEl, searchEl;
  var embedHost = null;

  function paintMeta() {
    if (!metaEl) return;
    metaEl.innerHTML =
      "unix <b>" +
      state.unix +
      "</b> · epoch <b>" +
      state.epoch +
      "</b> · hops <b>" +
      state.hops +
      "</b> · ip <b>" +
      state.ipHint +
      "</b><br/>" +
      '<span style="opacity:0.7;word-break:break-all">' +
      (state.pageUrl || "—").slice(0, 96) +
      "</span>";
  }

  function paintEmbedMeta() {
    var el = document.getElementById("mg-drawer-lark-meta");
    if (!el) return;
    el.innerHTML =
      "unix <b>" +
      state.unix +
      "</b> · hops <b>" +
      state.hops +
      "</b> · focus <b>" +
      (selectedId || state.focusLayer || "—") +
      "</b>";
  }

  function nodeMatches(n, q) {
    if (!q) return true;
    var hay = ((n.name || "") + " " + (n.description || "") + " " + (n.id || "")).toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function filterTree(nodes, q) {
    if (!q) return nodes || [];
    var out = [];
    (nodes || []).forEach(function (n) {
      var kids = filterTree(n.children || [], q);
      if (nodeMatches(n, q) || kids.length) {
        var copy = Object.assign({}, n);
        if (kids.length) copy.children = kids;
        out.push(copy);
      }
    });
    return out;
  }

  function findNode(nodes, id) {
    for (var i = 0; i < (nodes || []).length; i++) {
      if (nodes[i].id === id) return nodes[i];
      var f = findNode(nodes[i].children || [], id);
      if (f) return f;
    }
    return null;
  }

  function selectNode(n) {
    if (!n) return;
    selectedId = n.id;
    state.selected = n;
    /* map MG fleet ids to focusLayer */
    var layerIds = LAYERS.map(function (L) {
      return L.id;
    });
    if (layerIds.indexOf(n.id) >= 0) state.focusLayer = n.id;
    state.lastReport = "select " + (n.name || n.id);
    persist();
    paintTree();
    paintEmbedTree();
    paintDetail();
    paintEmbedDetail();
    paintStatus();
  }

  function renderTreeInto(host, roots) {
    if (!host) return;
    host.innerHTML = "";
    var q = (searchQ || "").toLowerCase().trim();
    var data = filterTree(roots || treeRoots || [], q);
    if (q) {
      /* auto-expand matches */
      (function mark(nodes) {
        (nodes || []).forEach(function (n) {
          if (n.children && n.children.length) expanded[n.id] = true;
          mark(n.children);
        });
      })(data);
    }

    function walk(nodes, depth) {
      (nodes || []).forEach(function (n) {
        var wrap = document.createElement("div");
        wrap.className = "lt-node";
        wrap.style.marginLeft = depth ? "0" : "0";
        var row = document.createElement("div");
        row.className = "lt-row" + (selectedId === n.id ? " on" : "");
        row.style.marginLeft = depth * 4 + "px";
        var hasKids = n.children && n.children.length;
        var chev = document.createElement("button");
        chev.type = "button";
        chev.className = "lt-chev" + (hasKids ? "" : " empty");
        chev.textContent = hasKids ? (expanded[n.id] ? "▾" : "▸") : "·";
        chev.onclick = function (ev) {
          if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
          }
          if (!hasKids) return;
          expanded[n.id] = !expanded[n.id];
          persist();
          paintTree();
          paintEmbedTree();
        };
        var body = document.createElement("div");
        body.className = "lt-body";
        var name = document.createElement("div");
        name.className = "lt-name";
        name.textContent = n.name || n.id;
        if (n.type === "cdn") {
          var tag = document.createElement("span");
          tag.className = "lt-tag cdn";
          tag.textContent = "cdn";
          name.appendChild(tag);
        }
        body.appendChild(name);
        if (n.description) {
          var desc = document.createElement("div");
          desc.className = "lt-desc";
          desc.textContent = n.description;
          body.appendChild(desc);
        }
        row.appendChild(chev);
        row.appendChild(body);
        row.onclick = function (ev) {
          if (ev && ev.target && ev.target.classList && ev.target.classList.contains("lt-chev"))
            return;
          selectNode(n);
        };
        wrap.appendChild(row);
        host.appendChild(wrap);
        if (hasKids && expanded[n.id]) {
          var kids = document.createElement("div");
          kids.className = "lt-kids";
          host.appendChild(kids);
          /* recursive into kids container */
          var saved = host;
          /* walk appends to host - use kids as host temporarily via recursive function */
          (function walkKids(nodes2, d2, parentEl) {
            nodes2.forEach(function (n2) {
              var wrap2 = document.createElement("div");
              wrap2.className = "lt-node";
              var row2 = document.createElement("div");
              row2.className = "lt-row" + (selectedId === n2.id ? " on" : "");
              var has2 = n2.children && n2.children.length;
              var chev2 = document.createElement("button");
              chev2.type = "button";
              chev2.className = "lt-chev" + (has2 ? "" : " empty");
              chev2.textContent = has2 ? (expanded[n2.id] ? "▾" : "▸") : "·";
              chev2.onclick = function (ev) {
                if (ev) {
                  ev.preventDefault();
                  ev.stopPropagation();
                }
                if (!has2) return;
                expanded[n2.id] = !expanded[n2.id];
                persist();
                paintTree();
                paintEmbedTree();
              };
              var body2 = document.createElement("div");
              body2.className = "lt-body";
              var name2 = document.createElement("div");
              name2.className = "lt-name";
              name2.textContent = n2.name || n2.id;
              if (n2.type === "cdn") {
                var tag2 = document.createElement("span");
                tag2.className = "lt-tag cdn";
                tag2.textContent = "cdn";
                name2.appendChild(tag2);
              }
              body2.appendChild(name2);
              if (n2.description) {
                var desc2 = document.createElement("div");
                desc2.className = "lt-desc";
                desc2.textContent = n2.description;
                body2.appendChild(desc2);
              }
              row2.appendChild(chev2);
              row2.appendChild(body2);
              row2.onclick = function (ev) {
                if (ev && ev.target && ev.target.classList && ev.target.classList.contains("lt-chev"))
                  return;
                selectNode(n2);
              };
              wrap2.appendChild(row2);
              parentEl.appendChild(wrap2);
              if (has2 && expanded[n2.id]) {
                var kids2 = document.createElement("div");
                kids2.className = "lt-kids";
                parentEl.appendChild(kids2);
                walkKids(n2.children, d2 + 1, kids2);
              }
            });
          })(n.children, depth + 1, kids);
        }
      });
    }
    if (!data.length) {
      host.innerHTML =
        '<p style="font:500 11px/1.35 system-ui;color:rgba(255,255,255,0.4);padding:8px">No matches · clear search</p>';
      return;
    }
    walk(data, 0);
  }

  function paintTree() {
    if (!treeEl) return;
    renderTreeInto(treeEl, treeRoots || defaultTree());
  }

  function paintEmbedTree() {
    var host = document.getElementById("mg-drawer-lark-tree");
    if (!host) return;
    renderTreeInto(host, treeRoots || defaultTree());
  }

  function paintDetailInto(el) {
    if (!el) return;
    var n = state.selected || (selectedId ? findNode(treeRoots || defaultTree(), selectedId) : null);
    if (!n) {
      el.innerHTML =
        '<div class="k">Selected</div><div class="v">—</div><div class="d">Tap a node in the governance tree</div>';
      return;
    }
    el.innerHTML =
      '<div class="k">' +
      (n.type === "cdn" ? "CDN · entity" : "Governance · entity") +
      "</div>" +
      '<div class="v">' +
      String(n.name || n.id).replace(/</g, "&lt;") +
      "</div>" +
      '<div class="d">' +
      String(n.description || n.id).replace(/</g, "&lt;") +
      "</div>";
  }

  function paintDetail() {
    paintDetailInto(detailEl);
  }
  function paintEmbedDetail() {
    paintDetailInto(document.getElementById("mg-drawer-lark-detail"));
  }

  function paintStatus() {
    if (statusEl)
      statusEl.textContent =
        VER +
        " · " +
        (state.lastReport || "governance tree · IANA + CDN + MG fleet");
  }

  function expandAll(on) {
    on = on !== false;
    function walk(nodes) {
      (nodes || []).forEach(function (n) {
        if (n.children && n.children.length) {
          expanded[n.id] = on;
          walk(n.children);
        }
      });
    }
    walk(treeRoots || defaultTree());
    persist();
    paintTree();
    paintEmbedTree();
  }

  function setOpen(on) {
    state.open = !!on;
    if (rail) {
      rail.classList.toggle("open", state.open);
      rail.classList.remove("mg-product-ghost");
      if (!state.open) rail.classList.add("hidden");
      else rail.classList.remove("hidden");
    }
    persist();
    if (state.open) {
      tickEpoch();
      loadTreeSeed(function () {
        /* expand top roots by default */
        (treeRoots || []).forEach(function (r) {
          if (expanded[r.id] == null) expanded[r.id] = true;
        });
        paintTree();
        paintDetail();
      });
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
      selected: state.selected,
      policies: state.policies,
      layers: LAYERS,
      tree: treeRoots || defaultTree(),
      agents: {
        market: !!(window.__mgMarket && window.__mgMarket.report),
        video: !!(window.__mgVideo && window.__mgVideo.report),
        quantum: !!(window.__mgQuantum && window.__mgQuantum.report),
        dock: !!window.__mgDock,
        beats: !!(window.__mgKeyboardBeats && window.__mgKeyboardBeats.report),
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
    rail.className = "mg-sx-rail right stack-full hidden mg-product-ghost";
    rail.innerHTML =
      '<button type="button" id="mg-lark-tab" class="mg-sx-tab" title="Lark governance tree">LARK</button>' +
      '<div id="mg-lark-panel" class="mg-sx-panel">' +
      '  <div class="mg-sx-head"><span>Lark · Governance</span>' +
      '  <button type="button" id="mg-lark-x" aria-label="close">×</button></div>' +
      '  <div id="mg-lark-meta" class="mg-sx-meta"></div>' +
      '  <div style="padding:0 10px 6px">' +
      '    <input id="mg-lark-search" type="search" placeholder="search ICANN · IETF · CDN…" />' +
      "  </div>" +
      '  <div id="mg-lark-tree"></div>' +
      '  <div id="mg-lark-detail" style="margin:0 10px 8px"></div>' +
      '  <div id="mg-lark-pol">' +
      '    <label><input type="checkbox" id="mg-lark-notrade" checked /> no auto-trade</label>' +
      '    <label><input type="checkbox" id="mg-lark-secret" checked /> no secrets in git</label>' +
      '    <label><input type="checkbox" id="mg-lark-resign" checked /> resign after edit</label>' +
      '    <label><input type="checkbox" id="mg-lark-stable" checked /> stable mkt window</label>' +
      "  </div>" +
      '  <div class="mg-sx-row" id="mg-lark-acts">' +
      '    <button type="button" class="mg-sx-btn ok" id="mg-lark-tick">TICK</button>' +
      '    <button type="button" class="mg-sx-btn" id="mg-lark-expall">EXPAND</button>' +
      '    <button type="button" class="mg-sx-btn" id="mg-lark-colall">COLLAPSE</button>' +
      '    <button type="button" class="mg-sx-btn" id="mg-lark-exp">EXPORT</button>' +
      "  </div>" +
      '  <div id="mg-lark-status" class="mg-sx-status"></div>' +
      "</div>";
    (document.documentElement || document.body).appendChild(rail);
    metaEl = rail.querySelector("#mg-lark-meta");
    treeEl = rail.querySelector("#mg-lark-tree");
    statusEl = rail.querySelector("#mg-lark-status");
    detailEl = rail.querySelector("#mg-lark-detail");
    searchEl = rail.querySelector("#mg-lark-search");

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
    rail.querySelector("#mg-lark-expall").onclick = function () {
      expandAll(true);
    };
    rail.querySelector("#mg-lark-colall").onclick = function () {
      expandAll(false);
    };
    if (searchEl) {
      searchEl.oninput = function () {
        searchQ = searchEl.value || "";
        paintTree();
        paintEmbedTree();
      };
    }

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

    tickEpoch();
    loadTreeSeed(function () {
      (treeRoots || []).forEach(function (r) {
        if (expanded[r.id] == null) expanded[r.id] = true;
      });
      paintTree();
      paintDetail();
      paintStatus();
    });
    setInterval(tickEpoch, 5000);
    log("ok", VER + " · lark tree (IANA + CDN + MG fleet)");
  }

  /** Embed full tree UI into left TOOLS → GT host */
  function embedInto(host) {
    if (!host) return false;
    ensureStyles();
    embedHost = host;
    host.innerHTML = "";
    host.id = host.id || "mg-drawer-lark-host";
    var meta = document.createElement("div");
    meta.id = "mg-drawer-lark-meta";
    host.appendChild(meta);
    var search = document.createElement("input");
    search.id = "mg-drawer-lark-search";
    search.type = "search";
    search.placeholder = "search ICANN · IETF · CDN · fleet…";
    search.value = searchQ || "";
    search.style.cssText =
      "width:100%;box-sizing:border-box;margin:0 0 8px;padding:9px 12px;border:0;border-radius:12px;" +
      "background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.92);" +
      "font:500 12px/1.2 -apple-system,system-ui;outline:none";
    search.oninput = function () {
      searchQ = search.value || "";
      if (searchEl) searchEl.value = searchQ;
      paintTree();
      paintEmbedTree();
    };
    host.appendChild(search);
    var tree = document.createElement("div");
    tree.id = "mg-drawer-lark-tree";
    tree.style.maxHeight = "min(48vh,420px)";
    host.appendChild(tree);
    var det = document.createElement("div");
    det.id = "mg-drawer-lark-detail";
    host.appendChild(det);
    loadTreeSeed(function () {
      (treeRoots || []).forEach(function (r) {
        if (expanded[r.id] == null) expanded[r.id] = true;
      });
      tickEpoch();
      paintEmbedMeta();
      paintEmbedTree();
      paintEmbedDetail();
    });
    return true;
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
    embedInto: embedInto,
    expandAll: expandAll,
    loadTree: loadTreeSeed,
    tree: function () {
      return treeRoots || defaultTree();
    },
    select: function (id) {
      var n = findNode(treeRoots || defaultTree(), id);
      if (n) selectNode(n);
      return n;
    },
    setIp: function (ip) {
      state.ipHint = String(ip || "local");
      window.__mgLarkIp = state.ipHint;
      paintMeta();
      paintEmbedMeta();
    },
    report: function () {
      return (
        VER +
        " unix=" +
        state.unix +
        " hops=" +
        state.hops +
        " layer=" +
        state.focusLayer +
        " sel=" +
        (selectedId || "—") +
        " roots=" +
        ((treeRoots && treeRoots.length) || 0)
      );
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
