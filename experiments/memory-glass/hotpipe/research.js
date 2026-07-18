/* Memory Glass · R1 Research Mini (hot-pipe)
 * topic → capture page → pack → queue / Grok
 * Inject after live.js + hurdles.js. PAGE-calm; no cam thrash.
 */
(function () {
  "use strict";
  var VER = "research-v1";
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

  var isMain = !!document.getElementById("mg-root");
  var isInspect = !!document.getElementById("pip-wrap");

  /* ── pack schema ── */
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

  function capturePage() {
    var title = document.title || "";
    var url = location.href || "";
    var sel = "";
    try {
      sel = String(window.getSelection && window.getSelection()) || "";
    } catch (e) {}
    var meta = "";
    try {
      var md = document.querySelector('meta[name="description"]');
      if (md) meta = md.getAttribute("content") || "";
    } catch (e2) {}
    var text = "";
    try {
      var main =
        document.querySelector("article") ||
        document.querySelector("main") ||
        document.body;
      text = (main && main.innerText) || "";
      text = text.replace(/\s+/g, " ").trim().slice(0, 12000);
    } catch (e3) {}
    return {
      url: url,
      title: title,
      selection: sel.slice(0, 4000),
      description: meta.slice(0, 1000),
      text: text,
      captured_at: Date.now(),
    };
  }

  var state = {
    ver: VER,
    topic: "",
    pack: emptyPack(""),
    queue: [],
  };

  try {
    var saved = localStorage.getItem("mg.research.v1");
    if (saved) {
      var j = JSON.parse(saved);
      if (j && j.pack) state.pack = j.pack;
      if (j && j.topic) state.topic = j.topic;
      if (j && Array.isArray(j.queue)) state.queue = j.queue;
    }
  } catch (e) {}

  function persist() {
    try {
      localStorage.setItem(
        "mg.research.v1",
        JSON.stringify({ topic: state.topic, pack: state.pack, queue: state.queue.slice(-50) })
      );
    } catch (e) {}
    try {
      if (window.__mgAgentPackHook)
        window.__mgAgentPackHook({ kind: "research", body: state.pack });
    } catch (e2) {}
  }

  function addSource(page) {
    if (!page || !page.url) return;
    var dup = state.pack.sources.some(function (s) {
      return s.url === page.url;
    });
    if (!dup) state.pack.sources.push(page);
    if (page.selection) {
      state.pack.quotes.push({
        url: page.url,
        title: page.title,
        text: page.selection,
        t: Date.now(),
      });
    }
    state.pack.t = Date.now();
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
      if (s.description) lines.push("   - " + s.description.slice(0, 200));
    });
    lines.push("", "## Quotes");
    p.quotes.forEach(function (q) {
      lines.push("- “" + q.text.slice(0, 400) + "” — " + (q.title || q.url));
    });
    lines.push("", "## Open questions");
    (p.open_questions || []).forEach(function (q) {
      lines.push("- " + q);
    });
    lines.push("", "## Next URLs");
    (p.next_urls || []).forEach(function (u) {
      lines.push("- " + u);
    });
    if (p.notes) lines.push("", "## Notes", p.notes);
    lines.push(
      "",
      "---",
      "Grok: summarize sources, answer open questions, propose 3 next URLs as a JSON list."
    );
    return lines.join("\n");
  }

  function exportPack() {
    var md = toMarkdown();
    var json = JSON.stringify(state.pack, null, 2);
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({
            op: "submit_inspect",
            dump:
              "RESEARCH_PACK\n\n" +
              md +
              "\n\n```json\n" +
              json.slice(0, 50000) +
              "\n```\n",
          })
        );
      }
    } catch (e) {}
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(md);
      }
    } catch (e2) {}
    ok("research pack exported · sources " + state.pack.sources.length);
    return { md: md, pack: state.pack };
  }

  function setTopic(t) {
    state.topic = String(t || "");
    state.pack.topic = state.topic;
    persist();
    ok("research topic · " + state.topic);
  }

  function enqueue(urlOrTopic) {
    var s = String(urlOrTopic || "").trim();
    if (!s) return;
    state.queue.push({ t: Date.now(), item: s, done: false });
    persist();
    ok("queue +" + s.slice(0, 80));
  }

  function captureAndPack() {
    if (!isMain) {
      ok("capture runs on main page surface");
      return null;
    }
    var page = capturePage();
    addSource(page);
    ok("captured · " + (page.title || page.url).slice(0, 60));
    return page;
  }

  window.__mgResearch = {
    ver: VER,
    state: state,
    setTopic: setTopic,
    capture: captureAndPack,
    capturePage: capturePage,
    addSource: addSource,
    exportPack: exportPack,
    toMarkdown: toMarkdown,
    enqueue: enqueue,
    emptyPack: emptyPack,
  };

  /* keyboard: ⌥⌘R capture on main */
  if (isMain) {
    document.addEventListener(
      "keydown",
      function (ev) {
        if (ev.altKey && ev.metaKey && (ev.key === "r" || ev.key === "R")) {
          ev.preventDefault();
          captureAndPack();
          exportPack();
        }
      },
      true
    );
    ok("R1 research · main · ⌥⌘R capture+export · " + VER);
  }

  /* inspect strip chip */
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
          "background:rgba(6,14,12,0.8);color:rgba(160,220,190,0.9);margin:0 0 4px";
        stage.insertBefore(el, stage.firstChild);
        el.title = "R1 research pack status";
      }
      var p = state.pack;
      el.textContent =
        "R1 · " +
        (state.topic ? state.topic.slice(0, 28) : "no topic") +
        " · src " +
        (p.sources || []).length +
        " · q " +
        state.queue.length;
    }
    paintChip();
    setInterval(paintChip, 2000);

    /* simple controls */
    if (!document.getElementById("mg-research-btns")) {
      var row = document.createElement("div");
      row.id = "mg-research-btns";
      row.style.cssText = "order:0;display:flex;gap:4px;flex-wrap:wrap;margin:0 0 4px";
      function btn(label, fn) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.style.cssText =
          "font:600 8px ui-monospace,Menlo,monospace;padding:3px 6px;" +
          "border:1px solid rgba(120,180,160,0.35);border-radius:3px;" +
          "background:rgba(10,20,16,0.9);color:rgba(180,230,200,0.95);cursor:pointer";
        b.onclick = fn;
        row.appendChild(b);
      }
      btn("TOPIC", function () {
        var t = prompt("Research topic", state.topic || "");
        if (t != null) setTopic(t);
        paintChip();
      });
      btn("EXPORT", function () {
        exportPack();
      });
      btn("CLEAR PACK", function () {
        state.pack = emptyPack(state.topic);
        persist();
        paintChip();
        ok("pack cleared");
      });
      var stage = document.getElementById("stage");
      if (stage) stage.insertBefore(row, stage.firstChild);
    }
    ok("R1 research · inspect controls · " + VER);
  }
})();
