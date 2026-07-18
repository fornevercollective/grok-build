/* Memory Glass · unified inspect dock (declutter)
 * Tabs: PIPE | CORP | R1 | EGO | CAL | UGRAD | IRON | MESH | MKT | VID | LARK | QBIT
 * Collapses research/ego/hurdles + training/collab into one rail.
 * Leap rails: market-filmstrip · video-feed · lark-governance · quantum-webgrid
 * Inject after live, hurdles, research, ego (ironline/ugrad/collab may follow).
 */
(function () {
  "use strict";
  var VER = "dock-v3-leap";
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

    if (tab === "ugrad") {
      hintEl.textContent =
        "Cold → full μgrad: R0 train · WebGrid BPS · games hub · U0–U6 staircase (mueee.qbitos.ai).";
      row.appendChild(
        act("R0", "ok", function () {
          if (window.__mgUgrad) window.__mgUgrad.openR0();
          else window.open("https://mueee.qbitos.ai/ugrad-r0.html", "_blank");
          setStatus("μgrad R0");
        })
      );
      row.appendChild(
        act("WEBGRID", "hot", function () {
          if (window.__mgUgrad) window.__mgUgrad.openWebGrid();
          else window.open("https://neuralink.com/webgrid/", "_blank");
          setStatus("Neuralink WebGrid");
        })
      );
      row.appendChild(
        act("μGRID", "", function () {
          if (window.__mgUgrad) window.__mgUgrad.openWebGridUgrad();
          else window.open("https://mueee.qbitos.ai/webgrid-ugrad.html", "_blank");
          setStatus("webgrid-ugrad");
        })
      );
      row.appendChild(
        act("GAMES", "", function () {
          if (window.__mgUgrad) window.__mgUgrad.openGames();
          else window.open("https://mueee.qbitos.ai/games-ugrad-hub.html", "_blank");
          setStatus("games hub");
        })
      );
      row.appendChild(
        act("TRAIN", "ok", function () {
          if (window.__mgUgrad) {
            var on = !window.__mgUgrad.state.gridActive;
            window.__mgUgrad.armGridTraining(on);
            setStatus(on ? "BPS train ON · click stage" : "BPS train off");
          } else setStatus("ugrad-ladder not loaded");
        })
      );
      row.appendChild(
        act("U+1", "", function () {
          if (window.__mgUgrad) {
            var n = Math.min(6, (window.__mgUgrad.state.level | 0) + 1);
            window.__mgUgrad.openLevel(n);
            setStatus("U" + n);
          }
        })
      );
      row.appendChild(
        act("KBATCH", "hot", function () {
          if (window.__mgUgrad && window.__mgUgrad.openKBatch) window.__mgUgrad.openKBatch("/");
          else window.open("https://kbatch.ugrad.ai/", "_blank");
          setStatus("KBatch geometry dict");
        })
      );
      row.appendChild(
        act("DOJO", "", function () {
          if (window.__mgUgrad && window.__mgUgrad.openKBatch) window.__mgUgrad.openKBatch("/dojo/");
          else window.open("https://kbatch.ugrad.ai/dojo/", "_blank");
          setStatus("KBatch MCP dojo");
        })
      );
    }

    if (tab === "iron") {
      hintEl.textContent =
        "Iron Line L0–L7 · cortical 24ms target · qbit codec concepts · speed budgets (see GOALS).";
      row.appendChild(
        act("REPORT", "ok", function () {
          var r = window.__mgIronline ? window.__mgIronline.report() : "no ironline";
          setStatus(r);
          if (window.__mgDevLog) window.__mgDevLog("info", r, "iron");
        })
      );
      row.appendChild(
        act("L5", "", function () {
          try {
            var ms = window.__mgHurdles && window.__mgHurdles.h6 ? window.__mgHurdles.h6.emaMs : 0;
            if (window.__mgIronline) window.__mgIronline.tick("L5", ms);
            setStatus("L5 sample " + (ms && ms.toFixed ? ms.toFixed(1) : ms) + "ms");
          } catch (e) {
            setStatus("L5 err");
          }
        })
      );
      row.appendChild(
        act("QBIT", "", function () {
          if (window.__mgIronline) {
            var o = window.__mgIronline.classify("0: hello +n: if +2: loop");
            setStatus("qbit prefixes " + ((o && o.prefixes) || []).join(" "));
          }
        })
      );
      row.appendChild(
        act("CORT", "hot", function () {
          var c = window.__mgIronline ? window.__mgIronline.corticalMs : 24;
          setStatus("cortical target " + c + "ms · body ecosystem");
        })
      );
      row.appendChild(
        act("H7–9", "", function () {
          var h = window.__mgHurdles || {};
          setStatus(
            "H7 " +
              (h.h7 && h.h7.ready ? "✓" : "?") +
              " H8 " +
              (h.h8 && h.h8.ready ? "✓" : "?") +
              " H9 " +
              (h.h9 && h.h9.ready ? "✓" : "?")
          );
        })
      );
    }

    if (tab === "mesh") {
      hintEl.textContent =
        "Collab mesh mg-mesh + ugrad-live · presence · BPS share · multi-agent ready (M0–M3).";
      row.appendChild(
        act("PING", "ok", function () {
          if (window.__mgMesh) {
            window.__mgMesh.broadcast("presence", { ping: 1 });
            setStatus(window.__mgMesh.report());
          } else setStatus("collab.js not loaded");
        })
      );
      row.appendChild(
        act("PEERS", "", function () {
          if (window.__mgMesh) setStatus("peers " + window.__mgMesh.peerCount() + " · " + window.__mgMesh.seatId);
          else setStatus("no mesh");
        })
      );
      row.appendChild(
        act("BPS→", "hot", function () {
          if (window.__mgMesh && window.__mgUgrad) {
            window.__mgMesh.broadcast("bps", window.__mgUgrad.state.bps);
            setStatus("bps broadcast " + window.__mgUgrad.state.bps.lastBps.toFixed(2));
          } else setStatus("need mesh+ugrad");
        })
      );
      row.appendChild(
        act("PACK→", "", function () {
          if (window.__mgMesh) {
            window.__mgMesh.broadcast("pack", { note: "inspect-pack-pointer", t: Date.now() });
            setStatus("pack pointer shared");
          }
        })
      );
    }

    if (tab === "mkt") {
      hintEl.textContent =
        "Market filmstrip · iron condor WebGrid · RH∪X board · stable window only · no auto-trade.";
      row.appendChild(
        act("OPEN", "ok", function () {
          if (window.__mgMarket) window.__mgMarket.open();
          setStatus(window.__mgMarket ? window.__mgMarket.report() : "market-filmstrip not loaded");
        })
      );
      row.appendChild(
        act("LOAD", "", function () {
          if (window.__mgMarket) {
            window.__mgMarket.open();
            var b = document.getElementById("mg-mkt-load");
            if (b) b.click();
            setStatus(window.__mgMarket.report());
          } else setStatus("no __mgMarket");
        })
      );
      row.appendChild(
        act("HIT IN", "hot", function () {
          if (window.__mgMarket && window.__mgMarket.state.focus)
            window.__mgMarket.scoreCondorTrial(window.__mgMarket.state.focus, "in");
          setStatus(window.__mgMarket ? window.__mgMarket.report() : "no mkt");
        })
      );
      row.appendChild(
        act("HIT EDGE", "", function () {
          if (window.__mgMarket && window.__mgMarket.state.focus)
            window.__mgMarket.scoreCondorTrial(window.__mgMarket.state.focus, "edge");
          setStatus(window.__mgMarket ? window.__mgMarket.report() : "no mkt");
        })
      );
      row.appendChild(
        act("REPORT", "", function () {
          setStatus(window.__mgMarket ? window.__mgMarket.report() : "no mkt");
        })
      );
    }

    if (tab === "vid") {
      hintEl.textContent =
        "Streaming video handler · ffplay/yt-dlp/ffmpeg · blank/gy pop-out · agent __mgVideo.";
      row.appendChild(
        act("OPEN", "ok", function () {
          if (window.__mgVideo) window.__mgVideo.toggle();
          setStatus(window.__mgVideo ? window.__mgVideo.report() : "video-feed not loaded");
        })
      );
      row.appendChild(
        act("SPACEX", "hot", function () {
          if (window.__mgVideo) window.__mgVideo.popBlank(window.__mgVideo.presets.spacex.url);
          setStatus("blank SpaceX live");
        })
      );
      row.appendChild(
        act("FFPLAY", "", function () {
          if (window.__mgVideo) window.__mgVideo.ffplay();
          setStatus("ffplay cmd/ipc");
        })
      );
      row.appendChild(
        act("YT-DLP", "", function () {
          if (window.__mgVideo) window.__mgVideo.ytdlp();
          setStatus("ytdlp probe");
        })
      );
      row.appendChild(
        act("GY", "", function () {
          if (window.__mgVideo) window.__mgVideo.popGy();
          setStatus("gy pop");
        })
      );
    }

    if (tab === "lark") {
      hintEl.textContent =
        "Lark governance tree · unix/epoch/hops/ip · web-wide control surface · fleet policies.";
      row.appendChild(
        act("OPEN", "ok", function () {
          if (window.__mgLark) window.__mgLark.open();
          setStatus(window.__mgLark ? window.__mgLark.report() : "lark not loaded");
        })
      );
      row.appendChild(
        act("TICK", "hot", function () {
          if (window.__mgLark) window.__mgLark.tick();
          setStatus(window.__mgLark ? window.__mgLark.report() : "no lark");
        })
      );
      row.appendChild(
        act("EXPORT", "", function () {
          if (window.__mgLark) window.__mgLark.exportSnapshot();
          setStatus("lark snapshot");
        })
      );
      row.appendChild(
        act("FLEET", "", function () {
          try {
            if (window.ipc)
              window.ipc.postMessage(
                JSON.stringify({ op: "navigate", url: "https://github.com/fornevercollective" })
              );
          } catch (e) {}
          setStatus("fornevercollective");
        })
      );
    }

    if (tab === "qbit") {
      hintEl.textContent =
        "Quantum WebGrid · Bloch gate filmstrip · periodic capsules · IBM/composer/uvqbit · school.";
      row.appendChild(
        act("OPEN", "ok", function () {
          if (window.__mgQuantum) window.__mgQuantum.open();
          setStatus(window.__mgQuantum ? window.__mgQuantum.report() : "quantum not loaded");
        })
      );
      row.appendChild(
        act("H", "", function () {
          if (window.__mgQuantum)
            window.__mgQuantum.applyGate({ id: "H", name: "Hadamard" });
          setStatus(window.__mgQuantum ? window.__mgQuantum.report() : "no q");
        })
      );
      row.appendChild(
        act("SCORE", "hot", function () {
          if (window.__mgQuantum) window.__mgQuantum.scoreHit();
          setStatus(window.__mgQuantum ? window.__mgQuantum.report() : "no q");
        })
      );
      row.appendChild(
        act("|0⟩", "", function () {
          if (window.__mgQuantum) window.__mgQuantum.reset();
          setStatus("reset |0⟩");
        })
      );
      row.appendChild(
        act("COMPOSER", "", function () {
          try {
            if (window.ipc)
              window.ipc.postMessage(
                JSON.stringify({ op: "navigate", url: "https://quantum.cloud.ibm.com/composer" })
              );
          } catch (e) {}
          setStatus("IBM composer");
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
    try {
      if (window.__mgUgrad && window.__mgUgrad.state.bps.lastBps)
        bits.push(window.__mgUgrad.state.bps.lastBps.toFixed(1) + "bps");
    } catch (e2) {}
    try {
      if (window.__mgMesh) bits.push("p" + window.__mgMesh.peerCount());
    } catch (e3) {}
    try {
      if (window.__mgMarket && window.__mgMarket.state && window.__mgMarket.state.rows)
        bits.push("mkt" + window.__mgMarket.state.rows.length);
    } catch (e4) {}
    try {
      if (window.__mgLark && window.__mgLark.state) bits.push("e" + (window.__mgLark.state.unix % 100000));
    } catch (e5) {}
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
      ["ugrad", "UGRAD"],
      ["iron", "IRON"],
      ["mesh", "MESH"],
      ["mkt", "MKT"],
      ["vid", "VID"],
      ["lark", "LARK"],
      ["qbit", "QBIT"],
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
    ok("inspect dock · PIPE…MESH + MKT/VID/LARK/QBIT · " + VER);
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
