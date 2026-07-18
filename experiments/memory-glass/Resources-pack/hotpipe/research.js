/* Memory Glass · R1 Research · research-v4
 * Capture · queue · CORP boot seed · pack→Grok
 * UI lives in inspect-dock.js (no extra button rows).
 */
(function () {
  "use strict";
  var VER = "research-v4";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._researchVer === VER) return;
  HP._researchVer = VER;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "info", String(m || ""), "research");
    } catch (e) {}
  }
  function ok(m) {
    log("ok", m);
  }
  function warn(m) {
    log("warn", m);
  }

  var isMain = !!document.getElementById("mg-root");
  var isInspect = !!document.getElementById("pip-wrap");

  /* ── Default seed from research-packs/cv-2026 (boot queue) ── */
  /* Default boot = company vision train stack (CORP); PERCEPT via dock */
  var BOOT_SEED = {
    id: "xai-tesla-spacex-vision",
    topic: "xAI · Grok · Tesla robot · SpaceX vision training pipeline",
    open_questions: [
      "Tesla FSD/Optimus vision flywheel ↔ still-pipe + ego batches?",
      "Grok/Grok Build roles for pack → next-URL curriculum?",
      "xAI public world-model / VLA / robot-data signals?",
      "SpaceX cool-test visual ops patterns for PAGE droplet?",
      "Train loop: capture → ego label → pack → Grok → retrain prompts?",
      "Perceptron Egocentric as optional heavy path (not only stack)?",
    ],
    next_urls: [
      "https://x.ai",
      "https://x.ai/blog",
      "https://www.tesla.com/AI",
      "https://www.tesla.com/optimus",
      "https://www.spacex.com",
      "https://www.spacex.com/vehicles/starship",
      "https://www.perceptron.inc/blog/introducing-perceptron-egocentric-api",
      "https://github.com/perceptron-ai-inc/perceptron",
      "https://arxiv.org/search/?query=vision+language+action+robot&searchtype=all",
    ],
  };

  function emptyPack(topic) {
    return {
      ver: VER,
      t: Date.now(),
      topic: topic || "",
      sources: [],
      quotes: [],
      open_questions: [],
      next_urls: [],
      notes: "",
      machine: (typeof navigator !== "undefined" && navigator.platform) || "unknown",
    };
  }

  /* ── Capture: read-only, no layout thrash (no inject/remove/style) ── */
  function safeText(el, max) {
    max = max || 12000;
    if (!el) return "";
    try {
      var t = el.innerText || el.textContent || "";
      return String(t).replace(/\s+/g, " ").trim().slice(0, max);
    } catch (e) {
      return "";
    }
  }

  function metaContent(names) {
    var out = [];
    try {
      for (var i = 0; i < names.length; i++) {
        var n = names[i];
        var el =
          document.querySelector('meta[name="' + n + '"]') ||
          document.querySelector('meta[property="' + n + '"]') ||
          document.querySelector('meta[property="og:' + n + '"]');
        if (el) {
          var c = el.getAttribute("content");
          if (c) out.push(n + ": " + c.slice(0, 500));
        }
      }
    } catch (e) {}
    return out.join(" | ").slice(0, 2000);
  }

  function capturePage() {
    var title = "";
    var url = "";
    try {
      title = document.title || "";
      url = location.href || "";
    } catch (e0) {}

    var sel = "";
    try {
      var s = window.getSelection && window.getSelection();
      if (s && s.rangeCount) sel = String(s.toString() || "");
    } catch (e1) {}

    var description = "";
    try {
      var md =
        document.querySelector('meta[name="description"]') ||
        document.querySelector('meta[property="og:description"]');
      if (md) description = md.getAttribute("content") || "";
    } catch (e2) {}

    var metaBlob = metaContent([
      "description",
      "keywords",
      "author",
      "og:title",
      "og:description",
      "og:url",
      "twitter:title",
      "twitter:description",
      "citation_title",
      "citation_author",
    ]);

    /* Prefer semantic roots; never mutate DOM */
    var text = "";
    try {
      var roots = [
        document.querySelector("article"),
        document.querySelector('[role="main"]'),
        document.querySelector("main"),
        document.querySelector("#readme"),
        document.querySelector(".markdown-body"),
        document.querySelector("#content"),
        document.body,
      ];
      for (var r = 0; r < roots.length; r++) {
        if (!roots[r]) continue;
        var chunk = safeText(roots[r], 14000);
        if (chunk.length > text.length) text = chunk;
        if (text.length > 4000) break;
      }
    } catch (e3) {}

    /* Heading outline (read-only query) */
    var outline = [];
    try {
      var hs = document.querySelectorAll("h1, h2, h3");
      for (var hi = 0; hi < hs.length && outline.length < 40; hi++) {
        var ht = safeText(hs[hi], 200);
        if (ht) outline.push(hs[hi].tagName + ": " + ht);
      }
    } catch (e4) {}

    return {
      url: url,
      title: title.slice(0, 500),
      selection: sel.slice(0, 6000),
      description: description.slice(0, 1500),
      meta: metaBlob,
      outline: outline,
      text: text,
      text_len: text.length,
      captured_at: Date.now(),
      engine: VER,
    };
  }

  var state = {
    ver: VER,
    topic: "",
    pack: emptyPack(""),
    queue: [],
    seedId: null,
    lastExport: 0,
  };

  try {
    var saved = localStorage.getItem("mg.research.v2") || localStorage.getItem("mg.research.v1");
    if (saved) {
      var j = JSON.parse(saved);
      if (j && j.pack) state.pack = j.pack;
      if (j && j.topic) state.topic = j.topic;
      if (j && Array.isArray(j.queue)) state.queue = j.queue;
      if (j && j.seedId) state.seedId = j.seedId;
    }
  } catch (e) {}

  /* ── IndexedDB (H4) soft persist ── */
  var idb = null;
  function idbReady() {
    if (idb) return Promise.resolve(idb);
    if (!window.indexedDB) return Promise.resolve(null);
    return new Promise(function (res) {
      try {
        var req = indexedDB.open("mg-research-v2", 1);
        req.onupgradeneeded = function () {
          var d = req.result;
          if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
        };
        req.onsuccess = function () {
          idb = req.result;
          res(idb);
        };
        req.onerror = function () {
          res(null);
        };
      } catch (e) {
        res(null);
      }
    });
  }
  function idbSet(key, val) {
    return idbReady().then(function (db) {
      if (!db) return;
      return new Promise(function (res) {
        try {
          var tx = db.transaction("kv", "readwrite");
          tx.objectStore("kv").put(val, key);
          tx.oncomplete = function () {
            res();
          };
          tx.onerror = function () {
            res();
          };
        } catch (e) {
          res();
        }
      });
    });
  }

  function persist() {
    /* merge latest ego events if present */
    try {
      if (window.__mgEgo && window.__mgEgo.events) {
        var ev = window.__mgEgo.events();
        if (ev && ev.length) state.pack.ego_events = ev.slice(-60);
        if (window.__mgEgo.taxonomy) state.pack.ego_taxonomy = window.__mgEgo.taxonomy;
      }
    } catch (e0) {}
    var blob = {
      topic: state.topic,
      pack: state.pack,
      queue: state.queue.slice(-80),
      seedId: state.seedId,
      t: Date.now(),
    };
    try {
      localStorage.setItem("mg.research.v2", JSON.stringify(blob));
      localStorage.setItem("mg.research.v3", JSON.stringify(blob));
    } catch (e) {}
    idbSet("state", blob);
    try {
      if (window.__mgAgentPackHook)
        window.__mgAgentPackHook({ kind: "research", body: state.pack });
    } catch (e2) {}
  }

  function queueHas(url) {
    return state.queue.some(function (q) {
      return q && (q.item === url || q.url === url) && !q.done;
    });
  }

  function enqueue(urlOrTopic, meta) {
    var s = String(urlOrTopic || "").trim();
    if (!s) return false;
    if (queueHas(s)) return false;
    state.queue.push({
      t: Date.now(),
      item: s,
      url: /^https?:/i.test(s) ? s : null,
      done: false,
      meta: meta || null,
    });
    persist();
    ok("queue +" + s.slice(0, 80));
    return true;
  }

  function seedBootPack(force) {
    if (!force && state.seedId === BOOT_SEED.id && state.queue.length > 0) {
      ok("seed already loaded · q " + state.queue.length);
      return { seeded: 0, skipped: true };
    }
    if (!state.topic) setTopic(BOOT_SEED.topic);
    else state.pack.topic = state.topic || BOOT_SEED.topic;

    var oq = state.pack.open_questions || [];
    BOOT_SEED.open_questions.forEach(function (q) {
      if (oq.indexOf(q) < 0) oq.push(q);
    });
    state.pack.open_questions = oq;

    var n = 0;
    BOOT_SEED.next_urls.forEach(function (u) {
      if (enqueue(u, { seed: BOOT_SEED.id })) n++;
      if (state.pack.next_urls.indexOf(u) < 0) state.pack.next_urls.push(u);
    });
    state.seedId = BOOT_SEED.id;
    persist();
    ok("boot seed · +" + n + " urls · topic " + (state.topic || "").slice(0, 40));
    return { seeded: n, skipped: false };
  }

  function addSource(page) {
    if (!page || !page.url) return;
    var dup = state.pack.sources.some(function (s) {
      return s.url === page.url;
    });
    if (!dup) {
      /* store compact source — keep full text but cap pack growth */
      var store = {
        url: page.url,
        title: page.title,
        selection: page.selection,
        description: page.description,
        meta: page.meta,
        outline: page.outline,
        text: (page.text || "").slice(0, 10000),
        text_len: page.text_len || 0,
        captured_at: page.captured_at,
      };
      state.pack.sources.push(store);
    } else {
      /* merge selection/text if richer */
      state.pack.sources.forEach(function (s) {
        if (s.url !== page.url) return;
        if (page.selection && (!s.selection || page.selection.length > s.selection.length))
          s.selection = page.selection;
        if (page.text && (!s.text || page.text.length > (s.text || "").length)) {
          s.text = page.text.slice(0, 10000);
          s.text_len = page.text_len;
        }
      });
    }
    if (page.selection) {
      state.pack.quotes.push({
        url: page.url,
        title: page.title,
        text: page.selection.slice(0, 2000),
        t: Date.now(),
      });
    }
    state.pack.t = Date.now();
    /* mark queue item done if matching */
    state.queue.forEach(function (q) {
      if (q.url === page.url || q.item === page.url) q.done = true;
    });
    persist();
  }

  function toMarkdown() {
    var p = state.pack;
    var lines = [
      "# Research pack · " + (p.topic || "(no topic)"),
      "",
      "_ver " + VER + " · " + new Date(p.t).toISOString() + "_",
      "",
      "## Sources (" + p.sources.length + ")",
    ];
    p.sources.forEach(function (s, i) {
      lines.push((i + 1) + ". [" + (s.title || s.url) + "](" + s.url + ")");
      if (s.description) lines.push("   - " + s.description.slice(0, 240));
      if (s.outline && s.outline.length)
        lines.push("   - outline: " + s.outline.slice(0, 8).join(" · ").slice(0, 300));
      if (s.selection) lines.push("   - sel: “" + s.selection.slice(0, 280) + "”");
      if (s.text) lines.push("   - body: " + s.text.slice(0, 600) + (s.text.length > 600 ? "…" : ""));
    });
    lines.push("", "## Quotes");
    (p.quotes || []).forEach(function (q) {
      lines.push("- “" + (q.text || "").slice(0, 400) + "” — " + (q.title || q.url));
    });
    lines.push("", "## Open questions");
    (p.open_questions || []).forEach(function (q) {
      lines.push("- " + q);
    });
    lines.push("", "## Next URLs");
    (p.next_urls || []).forEach(function (u) {
      lines.push("- " + u);
    });
    lines.push("", "## Queue (pending)");
    state.queue
      .filter(function (q) {
        return !q.done;
      })
      .slice(0, 20)
      .forEach(function (q) {
        lines.push("- [ ] " + (q.url || q.item));
      });
    if (p.ego_events && p.ego_events.length) {
      lines.push("", "## Ego events (hands / atomic · last " + Math.min(12, p.ego_events.length) + ")");
      p.ego_events.slice(-12).forEach(function (ev) {
        if (ev.continuous) return;
        lines.push(
          "- " +
            (ev.action || "?") +
            " conf " +
            (ev.conf != null ? Number(ev.conf).toFixed(2) : "?") +
            (ev.index ? " @ " + Number(ev.index.x).toFixed(2) + "," + Number(ev.index.y).toFixed(2) : "")
        );
      });
    }
    if (p.ego_batch) {
      lines.push("", "## Ego batch", "```json", JSON.stringify(p.ego_batch).slice(0, 800), "```");
    }
    if (p.notes) lines.push("", "## Notes", p.notes);
    lines.push(
      "",
      "---",
      "Grok: (1) summarize sources + ego events (2) answer open_questions (3) return ONLY:",
      "```json",
      '{"next_urls":["https://..."],"open_questions":["..."],"notes":"..."}',
      "```",
      "Then operator runs __mgResearch.ingestGrokReply(reply) or Inspect GROK←"
    );
    return lines.join("\n");
  }

  function exportPack() {
    var md = toMarkdown();
    var json = JSON.stringify(
      {
        pack: state.pack,
        queue: state.queue.filter(function (q) {
          return !q.done;
        }),
        seedId: state.seedId,
      },
      null,
      2
    );
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({
            op: "submit_inspect",
            dump: "RESEARCH_PACK\n\n" + md + "\n\n```json\n" + json.slice(0, 80000) + "\n```\n",
          })
        );
      }
    } catch (e) {}
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(md);
    } catch (e2) {}
    state.lastExport = Date.now();
    persist();
    ok("pack exported · sources " + state.pack.sources.length + " · q pending " + pendingCount());
    return { md: md, pack: state.pack };
  }

  function pendingCount() {
    return state.queue.filter(function (q) {
      return !q.done;
    }).length;
  }

  function setTopic(t) {
    state.topic = String(t || "");
    state.pack.topic = state.topic;
    persist();
    ok("topic · " + state.topic);
  }

  function captureAndPack() {
    if (!isMain) {
      warn("capture on main page only");
      return null;
    }
    var page = capturePage();
    addSource(page);
    ok("captured · " + (page.title || page.url).slice(0, 56) + " · " + (page.text_len || 0) + "c");
    return page;
  }

  /** Ingest Grok JSON or markdown list → next_urls + queue */
  function ingestGrokReply(text) {
    if (!text) return { added: 0 };
    var added = 0;
    var raw = String(text);
    /* JSON block */
    try {
      var m = raw.match(/\{[\s\S]*"next_urls"[\s\S]*\}/);
      if (m) {
        var obj = JSON.parse(m[0]);
        if (Array.isArray(obj.next_urls)) {
          obj.next_urls.forEach(function (u) {
            if (enqueue(u, { from: "grok" })) added++;
            if (state.pack.next_urls.indexOf(u) < 0) state.pack.next_urls.push(u);
          });
        }
        if (Array.isArray(obj.open_questions)) {
          obj.open_questions.forEach(function (q) {
            if (state.pack.open_questions.indexOf(q) < 0) state.pack.open_questions.push(q);
          });
        }
        if (obj.notes) state.pack.notes = (state.pack.notes || "") + "\n" + obj.notes;
        persist();
        ok("grok json · +" + added + " urls");
        return { added: added, obj: obj };
      }
    } catch (e) {}
    /* bare URLs */
    var re = /https?:\/\/[^\s\)\]\>\"\']+/g;
    var um;
    while ((um = re.exec(raw))) {
      var u = um[0].replace(/[.,;]+$/, "");
      if (enqueue(u, { from: "grok-text" })) added++;
      if (state.pack.next_urls.indexOf(u) < 0) state.pack.next_urls.push(u);
    }
    persist();
    ok("grok text · +" + added + " urls");
    return { added: added };
  }

  function nextPending() {
    for (var i = 0; i < state.queue.length; i++) {
      if (!state.queue[i].done && (state.queue[i].url || /^https?:/i.test(state.queue[i].item)))
        return state.queue[i];
    }
    return null;
  }

  function openNext() {
    var q = nextPending();
    if (!q) {
      warn("queue empty");
      return null;
    }
    var url = q.url || q.item;
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
        ok("navigate · " + url.slice(0, 80));
        return q;
      }
    } catch (e) {}
    try {
      location.href = url;
    } catch (e2) {}
    return q;
  }

  /** Capture page + export + open next queue URL (unattended churn step) */
  function churnOnce() {
    if (isMain) captureAndPack();
    exportPack();
    var n = nextPending();
    if (n) openNext();
    return { pending: pendingCount(), next: n };
  }

  window.__mgResearch = {
    ver: VER,
    state: state,
    seed: BOOT_SEED,
    setTopic: setTopic,
    capture: captureAndPack,
    capturePage: capturePage,
    addSource: addSource,
    exportPack: exportPack,
    toMarkdown: toMarkdown,
    enqueue: enqueue,
    emptyPack: emptyPack,
    seedBootPack: seedBootPack,
    ingestGrokReply: ingestGrokReply,
    openNext: openNext,
    nextPending: nextPending,
    pendingCount: pendingCount,
    persist: persist,
    churnOnce: churnOnce,
  };

  /* Boot: auto-load CV pack next_urls into queue (once per seed id) */
  try {
    seedBootPack(false);
  } catch (eSeed) {
    warn("seed failed " + eSeed);
  }

  /* keyboard main */
  if (isMain) {
    document.addEventListener(
      "keydown",
      function (ev) {
        if (!(ev.altKey && ev.metaKey)) return;
        var k = ev.key;
        if (k === "r" || k === "R") {
          ev.preventDefault();
          captureAndPack();
          exportPack();
        } else if (k === "n" || k === "N") {
          ev.preventDefault();
          openNext();
        } else if (k === "e" || k === "E") {
          ev.preventDefault();
          exportPack();
        }
      },
      true
    );
    ok("R1 research-v2 · main · ⌥⌘R capture · ⌥⌘N next · ⌥⌘E export");
  }

  /* inspect UI */
  if (isInspect) {
    function paintChip() {
      var stage = document.getElementById("stage");
      if (!stage) return;
      var el = document.getElementById("mg-research-chip");
      if (!el) {
        el = document.createElement("div");
        el.id = "mg-research-chip";
        el.style.cssText =
          "order:0;font:600 8px/1.3 ui-monospace,Menlo,monospace;padding:3px 6px;" +
          "border:1px solid rgba(120,200,160,0.3);border-radius:3px;" +
          "background:rgba(6,14,12,0.8);color:rgba(160,220,190,0.9);margin:0 0 4px;" +
          "pointer-events:none;position:relative;z-index:30";
        stage.insertBefore(el, stage.firstChild);
      }
      el.textContent =
        "R1·" +
        VER +
        " · " +
        (state.topic ? state.topic.slice(0, 22) : "no topic") +
        " · src " +
        (state.pack.sources || []).length +
        " · q " +
        pendingCount() +
        (state.seedId ? " · seed" : "");
    }
    paintChip();
    setInterval(paintChip, 2000);

    if (!document.getElementById("mg-research-btns")) {
      var row = document.createElement("div");
      row.id = "mg-research-btns";
      row.style.cssText =
        "order:0;display:flex;gap:4px;flex-wrap:wrap;margin:0 0 4px;" +
        "pointer-events:auto;position:relative;z-index:40";
      function btn(label, fn) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.style.cssText =
          "font:600 8px ui-monospace,Menlo,monospace;padding:3px 6px;" +
          "border:1px solid rgba(120,180,160,0.35);border-radius:3px;" +
          "background:rgba(10,20,16,0.9);color:rgba(180,230,200,0.95);cursor:pointer;" +
          "pointer-events:auto;position:relative;z-index:41";
        b.onclick = function (ev) {
          if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
          }
          try {
            fn();
          } catch (e) {
            warn(String(e));
          }
        };
        row.appendChild(b);
      }
      btn("TOPIC", function () {
        var t = prompt("Research topic", state.topic || BOOT_SEED.topic);
        if (t != null) setTopic(t);
        paintChip();
      });
      btn("SEED", function () {
        seedBootPack(true);
        paintChip();
      });
      btn("NEXT", function () {
        openNext();
      });
      btn("EXPORT", function () {
        exportPack();
      });
      btn("GROK←", function () {
        var t = prompt("Paste Grok reply (JSON next_urls or text with URLs)");
        if (t) {
          ingestGrokReply(t);
          paintChip();
        }
      });
      btn("CHURN", function () {
        /* export + signal; main does capture via ⌥⌘R / next */
        exportPack();
        openNext();
        paintChip();
        ok("churn step · pending " + pendingCount());
      });
      btn("CLEAR", function () {
        if (!confirm("Clear pack + queue?")) return;
        state.pack = emptyPack(state.topic);
        state.queue = [];
        state.seedId = null;
        persist();
        paintChip();
        ok("cleared");
      });
      var stage = document.getElementById("stage");
      if (stage) stage.insertBefore(row, stage.firstChild);
    }
    ok("R1 research-v3 · SEED/NEXT/EXPORT/GROK←/CHURN · ego merge");
  }
})();
