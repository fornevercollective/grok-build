/* Memory Glass · KBatch full site hub
 * Makes kbatch.ugrad.ai (and local mirror) first-class inside MG:
 *   · TOOLS → kbatch section (already) + full surface map
 *   · window.__mgKbatchSite.open(path) → main navigate
 *   · local mirror http://127.0.0.1:8899 when up
 *   · collab bus handoff for Grok ↔ kbatch DOJO
 * VER: mg-kbatch-site-v1
 */
(function () {
  "use strict";
  var VER = "mg-kbatch-site-v2-lake";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._kbatchSiteVer === VER) return;
  HP._kbatchSiteVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var LIVE = "https://kbatch.ugrad.ai";
  var LOCAL = "http://127.0.0.1:8899";
  var DATA = "https://data.ugrad.ai/kbatch/";
  var localOk = false;

  /* Full surface map — keep in sync with KBatch-dictionary + live SPA */
  var SURFACES = [
    { id: "home", label: "Home · Shadow Live", path: "/", group: "core" },
    { id: "shadow", label: "Shadow", path: "/shadow.html", group: "core" },
    { id: "learn", label: "Learn · CEFR", path: "/learn", group: "core", alt: "/learn.html" },
    { id: "dojo", label: "Dojo · MCP", path: "/dojo/", group: "core" },
    { id: "living-books", label: "Living books", path: "/labs/living-books.html", group: "labs" },
    { id: "ancestory", label: "AnCEstory · lineage", path: "/labs/ancestory.html", group: "labs" },
    { id: "lang-tree", label: "Language tree · World", path: "/labs/lang-tree.html", group: "labs" },
    { id: "names-scroll", label: "Names scroll", path: "/labs/myth-names.html?track=names", group: "labs" },
    { id: "typing", label: "Typing lab", path: "/labs/typing.html", group: "labs" },
    { id: "music-staff", label: "Music staff", path: "/labs/music-staff.html", group: "labs" },
    { id: "waveform-letters", label: "Waveform letters", path: "/labs/waveform-letters.html", group: "labs" },
    { id: "myth-names", label: "Myth · Names", path: "/labs/myth-names.html", group: "labs" },
    { id: "lyrics", label: "Lyrics · charts", path: "/lyrics.html", group: "labs" },
    { id: "museum", label: "Museum", path: "/museum.html", group: "world" },
    { id: "catalog", label: "Full catalog · ~134k", path: "/catalog.html", group: "world" },
    { id: "research", label: "Research", path: "/research.html", group: "world" },
    { id: "for-ai", label: "For AI / agents", path: "/for-ai.html", group: "agents" },
    { id: "mcp-manifest", label: "MCP manifest", path: "/mcp/manifest.json", group: "agents" },
    { id: "train-pack", label: "LLM train pack", path: "/data/llm/train-pack.json", group: "agents" },
    { id: "lake", label: "Data lake manifest", path: "/data/lake/manifest.json", group: "agents" },
    { id: "catalog-json", label: "Catalog index JSON", path: "/data/catalog/index.json", group: "agents" },
    { id: "ai-explore", label: "AI explore report", path: "/data/lake/derived/ai-explore-report.json", group: "agents" },
    { id: "qbit-codec", label: "QBIT codec lake", path: "/data/lake/qbit-codec/index.json", group: "agents" },
    { id: "inclusive", label: "Inclusive 2S·LGBTQI+", path: "/data/lake/inclusive-language.json", group: "agents" },
    { id: "lang-cross", label: "Lang cross-analysis", path: "/data/lake/derived/lang-cross-analysis.json", group: "agents" },
    { id: "lang-tree-json", label: "Lang tree JSON", path: "/data/lake/lang-tree.json", group: "agents" },
    { id: "docs", label: "Docs", path: "/docs/", group: "docs", alt: "/docs.html" },
    { id: "handoff", label: "MG×KBatch handoff", path: "/handoff/MEMORY-GLASS-KBATCH.md", group: "docs" },
    { id: "data-growth", label: "Data growth handoff", path: "/handoff/DATA-GROWTH.md", group: "docs" },
    { id: "install", label: "Install", path: "/install.html", group: "docs" },
    { id: "world-ranking", label: "World ranking", path: "/world-ranking.html", group: "world" },
    { id: "mythology", label: "Mythology", path: "/labs/mythology.html", group: "labs" },
    { id: "open-names", label: "Open names", path: "/labs/open-names.html", group: "labs" },
    { id: "collab", label: "Collab lab", path: "/labs/collab.html", group: "labs" },
  ];

  /** Hard dual-pane / graph layouts for AI understanding tests */
  var HARD = [
    "ancestory",
    "lang-tree",
    "catalog",
    "living-books",
    "myth-names",
    "names-scroll",
    "music-staff",
    "waveform-letters",
    "shadow",
    "typing",
    "lyrics",
    "learn",
  ];

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "kbatch-site");
    } catch (e) {}
  }

  function probeLocal() {
    return fetch(LOCAL + "/?mg_probe=1", { method: "GET", cache: "no-store", mode: "cors" })
      .then(function (r) {
        localOk = !!r && r.ok;
        return localOk;
      })
      .catch(function () {
        localOk = false;
        return false;
      });
  }

  function base() {
    return localOk ? LOCAL : LIVE;
  }

  function urlFor(path) {
    path = path || "/";
    if (/^https?:\/\//i.test(path)) return path;
    if (path.charAt(0) !== "/") path = "/" + path;
    return base() + path;
  }

  function nav(url) {
    if (!url) return false;
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
        log("nav " + url);
        return true;
      }
    } catch (e) {}
    try {
      location.href = url;
      return true;
    } catch (e2) {
      return false;
    }
  }

  function openSurface(idOrPath, preferLocal) {
    var path = idOrPath || "/";
    var hit = null;
    for (var i = 0; i < SURFACES.length; i++) {
      if (SURFACES[i].id === path || SURFACES[i].path === path) {
        hit = SURFACES[i];
        break;
      }
    }
    var p = hit ? hit.path : path;
    if (preferLocal === false) {
      var livePath = p;
      return nav(LIVE + (livePath.charAt(0) === "/" ? livePath : "/" + livePath));
    }
    if (localOk || preferLocal) {
      return nav(urlFor(p));
    }
    return nav(LIVE + (p.charAt(0) === "/" ? p : "/" + p));
  }

  function openAllMap() {
    /* paint into tools drawer body if open, else navigate hub */
    var host = document.getElementById("mg-tools-body") || document.getElementById("mg-right-body");
    if (!host) {
      openSurface("home");
      return;
    }
    var box = document.createElement("div");
    box.id = "mg-kbatch-site-map";
    box.style.cssText = "padding:4px 0 12px";
    var head = document.createElement("p");
    head.className = "drw-hint";
    head.textContent =
      "KBatch site · " +
      (localOk ? "LOCAL :8899" : "LIVE kbatch.ugrad.ai") +
      " · tap to open in shell";
    box.appendChild(head);
    var groups = { core: [], labs: [], world: [], agents: [], docs: [] };
    SURFACES.forEach(function (s) {
      (groups[s.group] || groups.core).push(s);
    });
    Object.keys(groups).forEach(function (g) {
      if (!groups[g].length) return;
      var lbl = document.createElement("div");
      lbl.className = "sec-lbl";
      lbl.style.cssText =
        "font:650 10px/1 system-ui;letter-spacing:0.12em;text-transform:uppercase;" +
        "color:rgba(160,200,255,0.7);margin:10px 0 6px";
      lbl.textContent = g;
      box.appendChild(lbl);
      var row = document.createElement("div");
      row.className = "mg-cap-row";
      row.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 8px";
      groups[g].forEach(function (s) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "act";
        b.style.cssText =
          "appearance:none;cursor:pointer;border:1px solid rgba(255,255,255,0.12);" +
          "background:rgba(255,255,255,0.06);color:inherit;border-radius:12px;" +
          "padding:10px;text-align:left;font:650 11px/1.2 system-ui";
        b.innerHTML = "<strong style='display:block;margin-bottom:4px'>" + s.label + "</strong>" +
          "<span style='font:500 10px/1.2 system-ui;color:rgba(180,200,220,0.5)'>" + s.path + "</span>";
        b.onclick = function () {
          openSurface(s.id);
        };
        row.appendChild(b);
      });
      box.appendChild(row);
    });
    var acts = document.createElement("div");
    acts.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:8px";
    [["LIVE site", function () { nav(LIVE + "/"); }],
     ["LOCAL :8899", function () { nav(LOCAL + "/"); }],
     ["For AI", function () { openSurface("for-ai"); }],
     ["Handoff md", function () { openSurface("handoff"); }]].forEach(function (it) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = it[0];
      b.style.cssText =
        "appearance:none;cursor:pointer;border:1px solid rgba(140,200,255,0.35);" +
        "background:rgba(40,80,140,0.25);color:#9fd0ff;border-radius:10px;" +
        "padding:8px 10px;font:650 10px/1 system-ui";
      b.onclick = it[1];
      acts.appendChild(b);
    });
    box.appendChild(acts);
    /* prepend to drawer body */
    if (host.firstChild) host.insertBefore(box, host.firstChild);
    else host.appendChild(box);
  }

  /* Collab bus: write status for other agents / kbatch DOJO */
  function collabPing(msg) {
    var row = {
      t: Date.now(),
      iso: new Date().toISOString(),
      from: "memory-glass",
      ver: VER,
      local: localOk,
      base: base(),
      msg: String(msg || "ping"),
      url: location.href,
    };
    try {
      window.__mgKbatchCollabLast = row;
    } catch (e) {}
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({ op: "dev_log", lvl: "ok", msg: "kbatch-collab " + row.msg, src: "kbatch-site" })
        );
      }
    } catch (e2) {}
    log("collab " + row.msg);
    return row;
  }

  function report() {
    return (
      VER +
      " · base=" +
      base() +
      " · local=" +
      localOk +
      " · surfaces=" +
      SURFACES.length +
      " · fleet=" +
      !!(window.__mgKbatchFleet && window.__mgKbatchFleet.ver) +
      " · dojo=" +
      !!(window.__mgKbatchDojo && window.__mgKbatchDojo.ver)
    );
  }

  function openHard(i) {
    var id = HARD[i % HARD.length];
    return openSurface(id);
  }

  function trainPackUrl() {
    return base() + "/data/llm/train-pack.json";
  }

  function lakeUrl() {
    return base() + "/data/lake/manifest.json";
  }

  function exploreReportUrl() {
    return base() + "/data/lake/derived/ai-explore-report.json";
  }

  /** Agent helper: fetch catalog + lake + ancestory counts (JSON) */
  function fetchJson(path) {
    return fetch(urlFor(path), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function exploreLake() {
    return Promise.all([
      fetchJson("/data/catalog/index.json").catch(function () {
        return null;
      }),
      fetchJson("/data/lake/manifest.json").catch(function () {
        return null;
      }),
      fetchJson("/data/ancestory/index.json").catch(function () {
        return null;
      }),
      fetchJson("/data/llm/train-pack.json").catch(function () {
        return null;
      }),
      fetchJson("/data/lake/derived/ai-explore-report.json").catch(function () {
        return null;
      }),
    ]).then(function (arr) {
      var out = {
        t: Date.now(),
        base: base(),
        catalog: arr[0],
        lake: arr[1],
        ancestory: arr[2],
        trainPack: arr[3] ? { keys: Object.keys(arr[3]).slice(0, 12) } : null,
        explore: arr[4]
          ? {
              ok: arr[4].ok,
              catalogs: (arr[4].catalogs || []).length,
              hardOk: (arr[4].hardLayouts || []).filter(function (h) {
                return h.ok;
              }).length,
            }
          : null,
      };
      try {
        window.__mgKbatchLakeSnap = out;
      } catch (e) {}
      collabPing(
        "lake-explore catalogs=" +
          ((arr[0] && arr[0].totalCatalogs) || "?") +
          " rows~" +
          ((arr[0] && arr[0].totalRowsApprox) || "?") +
          " ancestory=" +
          ((arr[2] && arr[2].counts && arr[2].counts.publicNodes) || "?")
      );
      return out;
    });
  }

  window.__mgKbatchSite = {
    ver: VER,
    surfaces: SURFACES,
    hard: HARD,
    live: LIVE,
    local: LOCAL,
    data: DATA,
    base: base,
    open: openSurface,
    openMap: openAllMap,
    openHard: openHard,
    nav: nav,
    probeLocal: probeLocal,
    collabPing: collabPing,
    trainPackUrl: trainPackUrl,
    lakeUrl: lakeUrl,
    exploreReportUrl: exploreReportUrl,
    exploreLake: exploreLake,
    report: report,
    isLocal: function () {
      return localOk;
    },
  };

  probeLocal().then(function (ok) {
    log(VER + " · " + (ok ? "LOCAL :8899 ready" : "LIVE kbatch.ugrad.ai") + " · " + SURFACES.length + " surfaces");
    collabPing(ok ? "local-mirror-up" : "live-only");
  });

  /* re-probe every 30s so MG picks up local server without restart */
  setInterval(function () {
    probeLocal();
  }, 30000);
})();
