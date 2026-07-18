/* Memory Glass · unified inspect dock (declutter)
 * Tabs: PIPE | CORP | R1 | EGO | CAL
 * Collapses research/ego/hurdles button sprawl into one rail.
 * Inject last (after live, hurdles, research, ego).
 */
(function () {
  "use strict";
  var VER = "dock-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._dockVer === VER) return;
  HP._dockVer = VER;

  if (!document.getElementById("pip-wrap")) return;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "info", String(m || ""), "dock");
    } catch (e) {}
  }
  function ok(m) {
    log("ok", m);
  }

  /* ── Company vision-training pipeline (not perception-only) ── */
  var PIPELINES = {
    corp: {
      id: "xai-tesla-spacex-vision",
      label: "CORP",
      topic: "xAI · Grok · Tesla robot · SpaceX vision training pipeline",
      open_questions: [
        "How does Tesla FSD / Optimus vision data flywheel map to still-pipe + ego batches?",
        "Grok multimodal / Grok Build agent roles for offline pack → next-URL research?",
        "xAI public technical posts / hiring signals for world-model / VLA / robot data?",
        "SpaceX cool-test / Starship visual ops → PAGE default + telemetry HUD patterns?",
        "End-to-end train loop: capture → label (ego taxonomy) → pack → Grok → retrain prompts?",
      ],
      next_urls: [
        "https://x.ai",
        "https://x.ai/blog",
        "https://grok.x.ai",
        "https://www.tesla.com/AI",
        "https://www.tesla.com/optimus",
        "https://www.tesla.com/autopilot",
        "https://www.spacex.com",
        "https://www.spacex.com/vehicles/starship",
        "https://www.spacex.com/launches",
        "https://github.com/xai-org",
        "https://arxiv.org/search/?query=vision+language+action+robot&searchtype=all&source=header",
        "https://arxiv.org/search/?query=egocentric+manipulation+dataset&searchtype=all",
      ],
    },
    perception: {
      id: "cv-2026-perception",
      label: "PERCEPT",
      topic: "Perceptron ego · hands · GenCaption · SuperMap · TrackNet",
      open_questions: [
        "Perceptron Egocentric EA endpoint + Mini arm64 batch path?",
        "GenCaption + GNM exact paper?",
        "SuperMap RSS 2026 PDF?",
      ],
      next_urls: [
        "https://www.perceptron.inc/blog/introducing-perceptron-egocentric-api",
        "https://github.com/perceptron-ai-inc/perceptron",
        "https://docs.perceptron.inc",
        "https://eccv.ecva.net/",
        "https://x.com/tokufxag",
        "https://roboticsconference.org/",
      ],
    },
    robot: {
      id: "humanoid-vla",
      label: "ROBOT",
      topic: "Humanoid / VLA / ego manipulation training data",
      open_questions: [
        "Best open ego manipulation datasets for Optimus-class training?",
        "How to map MG ego taxonomy → VLA action tokens?",
      ],
      next_urls: [
        "https://arxiv.org/search/?query=vision+language+action+humanoid&searchtype=all",
        "https://arxiv.org/search/?query=RT-2+robotics&searchtype=all",
        "https://www.tesla.com/optimus",
        "https://www.perceptron.inc/blog/introducing-perceptron-egocentric-api",
      ],
    },
    spacex: {
      id: "spacex-ops-vision",
      label: "SPACEX",
      topic: "SpaceX visual ops · Starship · cool-test surface",
      open_questions: [
        "Public Starship camera/telemetry visualization patterns?",
        "How PAGE-default droplet browser serves ops reading without thrash?",
      ],
      next_urls: [
        "https://www.spacex.com",
        "https://www.spacex.com/vehicles/starship",
        "https://www.spacex.com/launches",
        "https://www.spacex.com/humanspaceflight",
      ],
    },
  };

  function hideLegacyClutter() {
    ["mg-research-btns", "mg-research-chip", "mg-ego-btns", "mg-hurdles-strip"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.style.display = "none";
        el.setAttribute("aria-hidden", "true");
      }
    });
    /* collapse heavy spatial pro by default */
    var pro = document.getElementById("mg-pro");
    if (pro) {
      pro.classList.add("mg-pro-collapsed");
      var act = document.getElementById("mg-pro-actions");
      var sl = document.getElementById("mg-pro-sliders");
      if (act) act.style.display = "none";
      if (sl) sl.style.display = "none";
    }
    var tri = document.getElementById("mg-tri");
    if (tri) tri.style.maxHeight = "72px";
  }

  function ensureStyles() {
    if (document.getElementById("mg-dock-css")) return;
    var st = document.createElement("style");
    st.id = "mg-dock-css";
    st.textContent = [
      "#mg-dock{order:0;position:relative;z-index:60;pointer-events:auto;",
      "  display:flex;flex-direction:column;gap:4px;margin:0 0 6px;",
      "  font:600 8px/1.25 ui-monospace,Menlo,monospace;letter-spacing:0.04em}",
      "#mg-dock-tabs{display:flex;gap:3px;flex-wrap:wrap}",
      "#mg-dock-tabs button{appearance:none;cursor:pointer;pointer-events:auto;",
      "  border:1px solid rgba(160,180,200,0.28);background:rgba(10,12,16,0.92);",
      "  color:rgba(200,215,230,0.85);padding:5px 8px;border-radius:2px;",
      "  text-transform:uppercase;letter-spacing:0.08em}",
      "#mg-dock-tabs button.on{border-color:rgba(120,200,255,0.55);color:#fff;",
      "  background:rgba(28,48,68,0.9)}",
      "#mg-dock-body{border:1px solid rgba(140,160,180,0.22);border-radius:3px;",
      "  background:rgba(6,8,12,0.92);padding:6px;min-height:52px}",
      "#mg-dock-body .row{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px}",
      "#mg-dock-body button.act{appearance:none;cursor:pointer;pointer-events:auto;",
      "  border:1px solid rgba(160,190,220,0.3);background:rgba(14,18,24,0.95);",
      "  color:rgba(210,225,240,0.92);padding:5px 7px;border-radius:2px;",
      "  text-transform:uppercase;letter-spacing:0.06em}",
      "#mg-dock-body button.act:hover{border-color:rgba(140,200,255,0.5);color:#fff}",
      "#mg-dock-body button.act.hot{border-color:rgba(255,180,100,0.45);color:rgba(255,220,180,0.95)}",
      "#mg-dock-body button.act.ok{border-color:rgba(100,220,160,0.4);color:rgba(160,240,200,0.95)}",
      "#mg-dock-hint{color:rgba(150,170,190,0.75);font-weight:500;margin-top:2px;",
      "  max-height:2.6em;overflow:hidden}",
      "#mg-dock-status{color:rgba(140,200,180,0.85);margin-top:3px}",
      "#mg-pro.mg-pro-collapsed .status{opacity:0.7}",
      "#mg-pro.mg-pro-collapsed{order:6!important;opacity:0.85}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  var tab = "pipe";
  var dock, body, statusEl, hintEl;

  function R() {
    return window.__mgResearch;
  }
  function E() {
    return window.__mgEgo;
  }

  function setStatus(s) {
    if (statusEl) statusEl.textContent = s;
  }

  function seedPipeline(key) {
    var p = PIPELINES[key];
    if (!p || !R()) return;
    R().setTopic(p.topic);
    var n = 0;
    (p.next_urls || []).forEach(function (u) {
      if (R().enqueue(u, { seed: p.id, pipeline: key })) n++;
      if (R().state.pack.next_urls.indexOf(u) < 0) R().state.pack.next_urls.push(u);
    });
    (p.open_questions || []).forEach(function (q) {
      if (R().state.pack.open_questions.indexOf(q) < 0) R().state.pack.open_questions.push(q);
    });
    R().state.seedId = p.id;
    if (R().persist) R().persist();
    setStatus("seeded " + p.label + " · +" + n + " urls · q " + R().pendingCount());
    ok("pipeline " + key + " · +" + n);
  }

  function act(label, cls, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "act" + (cls ? " " + cls : "");
    b.textContent = label;
    b.onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      try {
        fn();
      } catch (e) {
        setStatus("err " + e);
      }
    };
    return b;
  }

  function paintBody() {
    if (!body) return;
    body.innerHTML = "";
    var row = document.createElement("div");
    row.className = "row";
    hintEl = document.createElement("div");
    hintEl.id = "mg-dock-hint";

    if (tab === "pipe") {
      hintEl.textContent =
        "Company vision train loop: CORP seed → browse → CAP/EXP → Grok → GROK← → NEXT. Cam optional.";
      row.appendChild(
        act("CORP", "ok", function () {
          seedPipeline("corp");
        })
      );
      row.appendChild(
        act("PERCEPT", "", function () {
          seedPipeline("perception");
        })
      );
      row.appendChild(
        act("ROBOT", "", function () {
          seedPipeline("robot");
        })
      );
      row.appendChild(
        act("SPACEX", "", function () {
          seedPipeline("spacex");
        })
      );
      row.appendChild(
        act("NEXT", "hot", function () {
          if (R() && R().openNext) R().openNext();
          setStatus("next · q " + (R() ? R().pendingCount() : "?"));
        })
      );
      row.appendChild(
        act("CAP", "ok", function () {
          if (R() && R().capture) R().capture();
          setStatus("captured (main focus if empty)");
        })
      );
      row.appendChild(
        act("EXP", "", function () {
          if (R() && R().exportPack) R().exportPack();
          setStatus("exported → Grok / clipboard");
        })
      );
      row.appendChild(
        act("GROK←", "hot", function () {
          var t = prompt("Paste Grok JSON next_urls or text with URLs");
          if (t && R() && R().ingestGrokReply) {
            var r = R().ingestGrokReply(t);
            setStatus("grok +" + (r && r.added) + " · q " + R().pendingCount());
          }
        })
      );
      row.appendChild(
        act("CHURN", "", function () {
          if (R() && R().churnOnce) R().churnOnce();
          else {
            if (R() && R().exportPack) R().exportPack();
            if (R() && R().openNext) R().openNext();
          }
          setStatus("churn · q " + (R() ? R().pendingCount() : "?"));
        })
      );
    } else if (tab === "corp") {
      hintEl.textContent =
        "xAI / Grok / Tesla AI·Optimus / SpaceX — full stack, not hands-only. Seeds train-loop research.";
      ["corp", "robot", "spacex"].forEach(function (k) {
        row.appendChild(
          act(PIPELINES[k].label, k === "corp" ? "ok" : "", function () {
            seedPipeline(k);
          })
        );
      });
      row.appendChild(
        act("TOPIC", "", function () {
          if (!R()) return;
          var t = prompt("Topic", R().state.topic || PIPELINES.corp.topic);
          if (t != null) R().setTopic(t);
          setStatus("topic set");
        })
      );
      row.appendChild(
        act("OPEN X.AI", "", function () {
          if (R()) R().enqueue("https://x.ai");
          if (window.ipc)
            window.ipc.postMessage(JSON.stringify({ op: "navigate", url: "https://x.ai" }));
        })
      );
      row.appendChild(
        act("OPEN TESLA AI", "", function () {
          if (window.ipc)
            window.ipc.postMessage(JSON.stringify({ op: "navigate", url: "https://www.tesla.com/AI" }));
        })
      );
      row.appendChild(
        act("OPEN SPACEX", "", function () {
          if (window.ipc)
            window.ipc.postMessage(JSON.stringify({ op: "navigate", url: "https://www.spacex.com" }));
        })
      );
      row.appendChild(
        act("EXP PACK", "ok", function () {
          if (R() && R().exportPack) R().exportPack();
        })
      );
    } else if (tab === "r1") {
      hintEl.textContent = "Research queue · ⌥⌘R capture on main · ⌥⌘N next. SEED = perception pack.";
      row.appendChild(
        act("TOPIC", "", function () {
          if (!R()) return;
          var t = prompt("Topic", R().state.topic || "");
          if (t != null) R().setTopic(t);
        })
      );
      row.appendChild(
        act("SEED", "", function () {
          if (R() && R().seedBootPack) R().seedBootPack(true);
          setStatus("cv seed · q " + (R() ? R().pendingCount() : "?"));
        })
      );
      row.appendChild(
        act("NEXT", "hot", function () {
          if (R() && R().openNext) R().openNext();
        })
      );
      row.appendChild(
        act("EXPORT", "ok", function () {
          if (R() && R().exportPack) R().exportPack();
        })
      );
      row.appendChild(
        act("GROK←", "hot", function () {
          var t = prompt("Paste Grok reply");
          if (t && R()) R().ingestGrokReply(t);
        })
      );
      row.appendChild(
        act("CLEAR", "", function () {
          if (!R() || !confirm("Clear pack + queue?")) return;
          R().state.pack = R().emptyPack(R().state.topic);
          R().state.queue = [];
          R().state.seedId = null;
          if (R().persist) R().persist();
          setStatus("cleared");
        })
      );
    } else if (tab === "ego") {
      hintEl.textContent =
        "Still-pipe ego batch + 21-kpt taxonomy (Perceptron-shaped). Strengthens H1/H2. Optional API key in localStorage.";
      row.appendChild(
        act("REC", "hot", function () {
          if (E() && E().startRecording) E().startRecording(2);
          setStatus("ego rec…");
        })
      );
      row.appendChild(
        act("STOP", "", function () {
          if (E() && E().stopRecording)
            E().stopRecording().then(function () {
              setStatus("ego stopped");
            });
        })
      );
      row.appendChild(
        act("→PACK", "ok", function () {
          if (E() && R() && R().state.pack) {
            R().state.pack.ego_events = E().events().slice(-60);
            R().state.pack.ego_taxonomy = E().taxonomy;
            if (R().exportPack) R().exportPack();
            setStatus("ego → pack");
          }
        })
      );
      row.appendChild(
        act("API?", "", function () {
          var k = prompt("Perceptron API key (stored local only)", localStorage.getItem("mg.perceptron.key") || "");
          if (k != null) {
            localStorage.setItem("mg.perceptron.key", k);
            if (E() && E().state) E().state.apiKey = k || null;
            setStatus(k ? "key set" : "key cleared");
          }
        })
      );
    } else if (tab === "cal") {
      hintEl.textContent = "Spatial / mesh calibration (collapsed by default). Toggle MORE for full strip.";
      row.appendChild(
        act("MORE CAL", "hot", function () {
          var pro = document.getElementById("mg-pro");
          var actEl = document.getElementById("mg-pro-actions");
          var sl = document.getElementById("mg-pro-sliders");
          var show = actEl && actEl.style.display === "none";
          if (actEl) actEl.style.display = show ? "flex" : "none";
          if (sl) sl.style.display = show ? "flex" : "none";
          if (pro) pro.classList.toggle("mg-pro-collapsed", !show);
          setStatus(show ? "cal open" : "cal collapsed");
        })
      );
      row.appendChild(
        act("LOCK", "ok", function () {
          var b = document.querySelector("#mg-pro-actions button.lock, #mg-pro-actions button");
          if (b) b.click();
          else setStatus("use MORE CAL for head lock");
        })
      );
      row.appendChild(
        act("TRI", "", function () {
          var tri = document.getElementById("mg-tri");
          if (!tri) return;
          var h = tri.style.maxHeight === "72px" || !tri.style.maxHeight;
          tri.style.maxHeight = h ? "128px" : "72px";
          setStatus(h ? "tri full" : "tri compact");
        })
      );
    }

    body.appendChild(row);
    body.appendChild(hintEl);
  }

  function setTab(t) {
    tab = t;
    Array.prototype.forEach.call(dock.querySelectorAll("#mg-dock-tabs button"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-tab") === t);
    });
    paintBody();
    tickStatus();
  }

  function tickStatus() {
    var bits = [VER];
    if (R()) {
      bits.push((R().state.topic || "no-topic").slice(0, 22));
      bits.push("src " + ((R().state.pack && R().state.pack.sources) || []).length);
      bits.push("q " + R().pendingCount());
    }
    if (E() && E().state) {
      bits.push(E().state.recording ? "EGO●" : "ego");
      bits.push("ev " + (E().events() || []).length);
    }
    try {
      if (window.__mgHurdles && window.__mgHurdles.h6)
        bits.push(window.__mgHurdles.h6.emaMs.toFixed(0) + "ms");
    } catch (e) {}
    setStatus(bits.join(" · "));
  }

  function mount() {
    ensureStyles();
    hideLegacyClutter();
    var stage = document.getElementById("stage");
    if (!stage) return;
    dock = document.getElementById("mg-dock");
    if (!dock) {
      dock = document.createElement("div");
      dock.id = "mg-dock";
      dock.innerHTML =
        '<div id="mg-dock-tabs"></div><div id="mg-dock-body"></div><div id="mg-dock-status"></div>';
      stage.insertBefore(dock, stage.firstChild);
    }
    var tabs = dock.querySelector("#mg-dock-tabs");
    tabs.innerHTML = "";
    [
      ["pipe", "PIPE"],
      ["corp", "CORP"],
      ["r1", "R1"],
      ["ego", "EGO"],
      ["cal", "CAL"],
    ].forEach(function (pair) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = pair[1];
      b.setAttribute("data-tab", pair[0]);
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        setTab(pair[0]);
      };
      tabs.appendChild(b);
    });
    body = dock.querySelector("#mg-dock-body");
    statusEl = dock.querySelector("#mg-dock-status");
    setTab("pipe");
    /* hide legacy again after research/ego mount */
    setTimeout(hideLegacyClutter, 400);
    setTimeout(hideLegacyClutter, 1200);
    setInterval(function () {
      hideLegacyClutter();
      tickStatus();
    }, 2500);
    ok("inspect dock · PIPE/CORP/R1/EGO/CAL · " + VER);
  }

  window.__mgDock = {
    ver: VER,
    pipelines: PIPELINES,
    seedPipeline: seedPipeline,
    setTab: setTab,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
