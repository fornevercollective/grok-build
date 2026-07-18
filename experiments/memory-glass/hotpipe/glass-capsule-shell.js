/* Memory Glass · unified Dragon glass capsule
 * One floating glass-morphism panel (inspect-style) — modes never stack as full rails.
 * VER: glass-capsule-v1
 */
(function () {
  "use strict";
  var VER = "glass-capsule-v7-floats-live";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._glassCapVer === VER) return;
  HP._glassCapVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (eInsp) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "glass-cap");
    } catch (e) {}
  }

  var mode = "tools";
  var collapsed = true; /* B: start collapsed on play */
  var el, body, statusEl;

  var MODES = [
    { id: "tools", label: "TOOLS" },
    { id: "qbit", label: "QBIT" },
    { id: "gt", label: "GT" },
    { id: "mkt", label: "MKT" },
    { id: "vid", label: "VID" },
    { id: "books", label: "BOOKS" },
  ];

  function ensureCss() {
    try {
      if (window.__mgSxRail) window.__mgSxRail.ensure();
    } catch (e) {}
  }

  function setStatus(s) {
    if (statusEl) statusEl.textContent = s || VER;
  }

  function measure() {
    try {
      var cap = document.getElementById("mg-glass-cap");
      var h = cap && !collapsed ? cap.offsetHeight : 44;
      document.documentElement.style.setProperty("--mg-cap-h", h + 12 + "px");
    } catch (e) {}
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

  function paint() {
    if (!body) return;
    body.innerHTML = "";
    var hint = document.createElement("p");
    hint.className = "mg-cap-hint";
    var row = document.createElement("div");
    row.className = "mg-cap-row";

    if (mode === "tools") {
      hint.textContent =
        "Dragon glass capsule · one panel at a time · glass morphism · kbatch + WebGrid tools.";
      row.appendChild(
        act("KEYBOARD", "primary", function () {
          if (window.__mgFloatKb) window.__mgFloatKb.toggle();
          setStatus("keyboard " + (window.__mgFloatKb && window.__mgFloatKb.isOpen() ? "on" : "off"));
          measure();
        })
      );
      row.appendChild(
        act("MAZE", "primary", function () {
          if (window.__mgMemoryMaze) {
            window.__mgMemoryMaze.toggle();
            setStatus(window.__mgMemoryMaze.report());
          } else setStatus("maze missing");
        })
      );
      row.appendChild(
        act("CONTRAIL", "ok", function () {
          if (window.__mgContrail) {
            if (window.__mgContrail.toggle) window.__mgContrail.toggle();
            else window.__mgContrail.setFlow(true);
            if (window.__mgContrail.setOverlay) window.__mgContrail.setOverlay(true);
            setStatus(window.__mgContrail.report());
          } else setStatus("contrail on WebGrid only");
        })
      );
      row.appendChild(
        act("BEATS", "primary", function () {
          if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.toggle) {
            window.__mgKeyboardBeats.toggle();
            setStatus(window.__mgKeyboardBeats.report());
          } else if (window.__mgContrail && window.__mgContrail.exportStoryBeats) {
            var b = window.__mgContrail.exportStoryBeats();
            var t = JSON.stringify(b, null, 2);
            if (window.ipc)
              window.ipc.postMessage(JSON.stringify({ op: "clipboard_copy", text: t }));
            else if (navigator.clipboard) navigator.clipboard.writeText(t);
            setStatus("story beats " + ((b.beats && b.beats.length) || 0));
          } else setStatus("beats missing");
        })
      );
      row.appendChild(
        act("FLOATS", "hot", function () {
          /* Open all dual-space floats for WebGrid lab play */
          try {
            if (window.__mgContrail && window.__mgContrail.setOverlay)
              window.__mgContrail.setOverlay(true);
            if (window.__mgContrail && window.__mgContrail.setFlow)
              window.__mgContrail.setFlow(true);
            if (window.__mgMemoryMaze) window.__mgMemoryMaze.open();
            if (window.__mgBlochSolve) {
              window.__mgBlochSolve.setEnabled(true);
              if (window.__mgBlochSolve.open) window.__mgBlochSolve.open();
            }
            if (window.__mgRubikLang) window.__mgRubikLang.open();
            if (window.__mgKeyboardBeats) window.__mgKeyboardBeats.open();
            if (window.__mgActivityBoard) window.__mgActivityBoard.open();
            if (window.__mgSportsField) window.__mgSportsField.open();
            if (window.__mgFloatKb) window.__mgFloatKb.open();
            setStatus("all floats live · play lab");
          } catch (eF) {
            setStatus("floats err " + eF);
          }
        })
      );
      row.appendChild(
        act("FIELD", "ok", function () {
          if (window.__mgSportsField) {
            window.__mgSportsField.toggle();
            setStatus(window.__mgSportsField.report());
          } else {
            var u = "https://mueee.qbitos.ai/sports-field-ugrad.html";
            if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
            else window.open(u, "_blank");
            setStatus("sports-field site");
          }
        })
      );
      row.appendChild(
        act("WEBGRID", "hot", function () {
          var u = "https://neuralink.com/webgrid/?mg_autoplay=1";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          else location.href = u;
        })
      );
      row.appendChild(
        act("KBATCH", "primary", function () {
          var u = "https://kbatch.ugrad.ai/";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          else window.open(u, "_blank");
        })
      );
      row.appendChild(
        act("LEARN", "ok", function () {
          /* CEFR + FN seed + accreditation stair */
          var u = "https://kbatch.ugrad.ai/learn";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          else window.open(u, "_blank");
        })
      );
      row.appendChild(
        act("DOJO", "", function () {
          var u = "https://kbatch.ugrad.ai/dojo/";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          else window.open(u, "_blank");
        })
      );
      row.appendChild(
        act("HANDOFF", "", function () {
          var u = "https://kbatch.ugrad.ai/handoff/MEMORY-GLASS-KBATCH.md";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          else window.open(u, "_blank");
        })
      );
      row.appendChild(
        act("TERM", "ok", function () {
          /* distilled terminal tool — local metrics, not full site */
          var lines = [
            "term · local independence",
            window.__mgLiveSolveHud ? "solve hud on" : "solve hud —",
            window.__mgBlochSolve ? window.__mgBlochSolve.report() : "bloch —",
            window.__mgKeyboardBeats ? window.__mgKeyboardBeats.report() : "beats —",
            window.__mgSessionRec ? window.__mgSessionRec.report() : "rec —",
            "full lab: mueee terminal (opt)",
          ];
          setStatus(lines.slice(0, 4).join(" · "));
          try {
            if (navigator.clipboard)
              navigator.clipboard.writeText(lines.join("\n"));
          } catch (e) {}
        })
      );
      row.appendChild(
        act("BLANK KB", "", function () {
          var u = "https://fornevercollective.github.io/blank/";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          else window.open(u, "_blank");
        })
      );
      row.appendChild(
        act("PHRASE→DOJO", "hot", function () {
          var phrase =
            (window.__mgContrail && window.__mgContrail.stats && window.__mgContrail.stats.lastPhrase) ||
            (window.__mgFloatKb && window.__mgFloatKb.buffer()) ||
            "path";
          if (!window.__mgKbatchDojo) {
            setStatus("kbatch bridge missing");
            return;
          }
          setStatus("dojo run «" + String(phrase).slice(0, 16) + "»…");
          window.__mgKbatchDojo.runPhrase(phrase, {
            canvas: document.getElementById("mg-contrail-ov"),
            seed: window.__mgFloatKb && window.__mgFloatKb.buffer()
              ? window.__mgFloatKb.buffer().trim()
              : null,
          }).then(function (rep) {
            if (!rep) {
              setStatus("dojo empty");
              return;
            }
            var so = Object.keys(rep.phrasingOrders || {}).join("/") || "—";
            var ww = (rep.worldWords || []).slice(0, 3).join(",");
            setStatus(
              "strain " +
                rep.strain +
                " · SO " +
                so +
                " · " +
                ww +
                " · steno " +
                (rep.steno && rep.steno.canCarryImage ? "imgOK" : "img?")
            );
          });
        })
      );
      row.appendChild(
        act("GUTTER", "", function () {
          var u = "https://mueee.qbitos.ai/quantum-gutter.html";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          else window.open(u, "_blank");
        })
      );
      row.appendChild(
        act("RUBIK", "hot", function () {
          if (window.__mgRubikLang && window.__mgRubikLang.toggle) {
            window.__mgRubikLang.toggle();
            setStatus(window.__mgRubikLang.report());
          } else {
            var u = "https://mueee.qbitos.ai/rubiks-ugrad.html";
            if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
            else window.open(u, "_blank");
            setStatus("rubik float missing · opened site");
          }
        })
      );
      row.appendChild(
        act("NOTEPAD", "ok", function () {
          /* distilled quantum notepad tool — gate pad in glass, not whole site */
          var pad = document.createElement("div");
          pad.className = "mg-cap-row";
          ["H", "X", "Y", "Z", "S", "T"].forEach(function (g) {
            pad.appendChild(
              act(g, "", function () {
                if (window.__mgQuantum)
                  window.__mgQuantum.applyGate({ id: g, name: g });
                if (window.__mgBlochSolve) setStatus(window.__mgBlochSolve.report());
                else if (window.__mgQuantum) setStatus(window.__mgQuantum.report());
              })
            );
          });
          pad.appendChild(
            act("SCORE", "hot", function () {
              if (window.__mgQuantum) window.__mgQuantum.scoreHit();
              setStatus(window.__mgQuantum ? window.__mgQuantum.report() : "?");
            })
          );
          pad.appendChild(
            act("OPEN↗", "", function () {
              var u = "https://mueee.qbitos.ai/quantum-notepad.html";
              if (window.ipc)
                window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
            })
          );
          body.appendChild(pad);
          setStatus("notepad tool · gates in-glass");
          measure();
        })
      );
      row.appendChild(
        act("R0", "ok", function () {
          var u = "https://mueee.qbitos.ai/ugrad-r0.html";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          else window.open(u, "_blank");
        })
      );
      row.appendChild(
        act("BLACKWELL", "", function () {
          var u = "https://mueee.qbitos.ai/blackwell.html";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          else window.open(u, "_blank");
        })
      );
      row.appendChild(
        act("BLOCH", "hot", function () {
          if (window.__mgBlochSolve) {
            if (window.__mgBlochSolve.toggle) window.__mgBlochSolve.toggle();
            else window.__mgBlochSolve.setEnabled(true);
            setStatus(window.__mgBlochSolve.report());
          } else setStatus("bloch-solve-bus missing");
        })
      );
      row.appendChild(
        act("REC", "primary", function () {
          if (window.__mgSessionRec) {
            if (window.__mgSessionRec.isRecording()) window.__mgSessionRec.stop();
            else window.__mgSessionRec.start();
            setStatus(window.__mgSessionRec.report());
          } else setStatus("session-rec missing");
        })
      );
      row.appendChild(
        act("BOARD", "ok", function () {
          if (window.__mgActivityBoard) {
            window.__mgActivityBoard.toggle();
            setStatus(window.__mgActivityBoard.report());
          } else setStatus("leaderboard missing");
        })
      );
      row.appendChild(
        act("POST ↗", "hot", function () {
          if (window.__mgActivityBoard && window.__mgActivityBoard.openLeaderboardWindow) {
            window.__mgActivityBoard.openLeaderboardWindow({
              post: true,
              kind: "post-play",
            });
            setStatus("clean leaderboard window…");
          } else setStatus("leaderboard page missing");
        })
      );
      row.appendChild(
        act("DAY", "primary", function () {
          if (window.__mgCollabDay) {
            if (!window.__mgCollabDay.day()) window.__mgCollabDay.start({});
            window.__mgCollabDay.toggle();
            setStatus(window.__mgCollabDay.report());
          } else setStatus("collab-day missing");
        })
      );
      row.appendChild(
        act("GROK↦", "ok", function () {
          if (window.__mgCollabDay && window.__mgCollabDay.exportGrokBrief) {
            window.__mgCollabDay.exportGrokBrief();
            setStatus("Grok brief · clipboard + download");
          } else setStatus("start DAY first");
        })
      );
      row.appendChild(
        act("MESH+", "ok", function () {
          if (window.__mgCollabDay) {
            window.__mgCollabDay.shareScore();
            setStatus("score shared on mg-mesh");
          } else if (window.__mgMesh) setStatus(window.__mgMesh.report());
          else setStatus("mesh missing");
        })
      );
      row.appendChild(
        act("X DRAFT", "hot", function () {
          if (window.__mgCollabDay && window.__mgCollabDay.day && window.__mgCollabDay.day()) {
            window.__mgCollabDay.exportXDraft();
            setStatus("collab X draft · you post");
          } else if (window.__mgSessionRec && window.__mgSessionRec.exportXDraft) {
            window.__mgSessionRec.exportXDraft();
            setStatus("X draft · metrics+board · clipboard");
          } else if (window.__mgActivityBoard && window.__mgActivityBoard.formatXDraft) {
            var t = window.__mgActivityBoard.formatXDraft({ fresh: true });
            try {
              if (window.ipc)
                window.ipc.postMessage(JSON.stringify({ op: "clipboard_copy", text: t }));
              else if (navigator.clipboard) navigator.clipboard.writeText(t);
            } catch (e) {}
            setStatus("X draft from board");
          } else setStatus("X draft missing");
        })
      );
    } else if (mode === "qbit") {
      hint.textContent = "Quantum WebGrid · Bloch gates · school capsules (glass host).";
      row.appendChild(
        act("OPEN FULL", "ok", function () {
          if (window.__mgQuantum) {
            /* re-enable temporary rail only for full canvas if needed */
            var r = document.getElementById("mg-qwg-rail");
            if (r) {
              r.style.display = "flex";
              window.__mgQuantum.open();
            }
            setStatus(window.__mgQuantum.report());
          } else setStatus("quantum not loaded");
        })
      );
      ["H", "X", "Y", "Z", "S", "T"].forEach(function (g) {
        row.appendChild(
          act(g, "", function () {
            if (window.__mgQuantum)
              window.__mgQuantum.applyGate({ id: g, name: g });
            setStatus(window.__mgQuantum ? window.__mgQuantum.report() : "?");
          })
        );
      });
      row.appendChild(
        act("SCORE", "hot", function () {
          if (window.__mgQuantum) window.__mgQuantum.scoreHit();
          setStatus(window.__mgQuantum ? window.__mgQuantum.report() : "?");
        })
      );
      row.appendChild(
        act("|0⟩", "", function () {
          if (window.__mgQuantum) window.__mgQuantum.reset();
        })
      );
      row.appendChild(
        act("COMPOSER", "primary", function () {
          var u = "https://quantum.cloud.ibm.com/composer";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
        })
      );
      var cv = document.createElement("canvas");
      cv.className = "mg-cap-cv";
      cv.id = "mg-cap-bloch";
      body.appendChild(hint);
      body.appendChild(row);
      body.appendChild(cv);
      drawMiniBloch(cv);
      setStatus(window.__mgQuantum ? window.__mgQuantum.report() : "qbit ready");
      measure();
      return;
    } else if (mode === "gt") {
      hint.textContent =
        "GT · governance tree trace (live hops/epoch/layer) — not full Lark site.";
      row.appendChild(
        act("TICK", "ok", function () {
          if (window.__mgLark) window.__mgLark.tick();
          setStatus(window.__mgLark ? window.__mgLark.report() : "gt");
        })
      );
      row.appendChild(
        act("TRACE", "primary", function () {
          if (!window.__mgLark) {
            setStatus("no tree");
            return;
          }
          window.__mgLark.tick();
          var s = window.__mgLark.state || {};
          var layers = window.__mgLark.layers || [];
          var focus = layers.filter(function (L) {
            return L.id === s.focusLayer;
          })[0];
          setStatus(
            "unix " +
              s.unix +
              " · hops " +
              s.hops +
              " · " +
              (focus ? focus.label : s.focusLayer) +
              " · ip " +
              (s.ipHint || "?")
          );
        })
      );
      row.appendChild(
        act("EXPORT", "", function () {
          if (window.__mgLark) window.__mgLark.exportSnapshot();
          setStatus("gt snapshot");
        })
      );
      row.appendChild(
        act("UP+", "", function () {
          if (!window.__mgLark || !window.__mgLark.layers) return;
          var layers = window.__mgLark.layers;
          var ids = layers.map(function (L) {
            return L.id;
          });
          var i = ids.indexOf(window.__mgLark.state.focusLayer);
          i = Math.max(0, i - 1);
          window.__mgLark.state.focusLayer = ids[i];
          paint();
        })
      );
      row.appendChild(
        act("DOWN+", "", function () {
          if (!window.__mgLark || !window.__mgLark.layers) return;
          var layers = window.__mgLark.layers;
          var ids = layers.map(function (L) {
            return L.id;
          });
          var i = ids.indexOf(window.__mgLark.state.focusLayer);
          i = Math.min(ids.length - 1, i + 1);
          window.__mgLark.state.focusLayer = ids[i];
          paint();
        })
      );
      if (window.__mgLark && window.__mgLark.layers) {
        body.appendChild(hint);
        body.appendChild(row);
        window.__mgLark.layers.forEach(function (L) {
          var card = document.createElement("div");
          card.className =
            "mg-cap-card" + (window.__mgLark.state.focusLayer === L.id ? " on" : "");
          card.innerHTML =
            "<div>" +
            L.label +
            ' <span style="opacity:0.5">h' +
            L.hops +
            '</span></div><div class="sub">' +
            (L.tools || []).slice(0, 4).join(" · ") +
            "</div>";
          card.onclick = function () {
            window.__mgLark.state.focusLayer = L.id;
            paint();
          };
          body.appendChild(card);
        });
        setStatus(window.__mgLark.report());
        measure();
        return;
      }
    } else if (mode === "mkt") {
      hint.textContent =
        "MKT live · filterable board · condor train · no auto-trade (tools in glass).";
      row.appendChild(
        act("LOAD", "ok", function () {
          if (window.__mgMarket) {
            window.__mgMarket.loadBoard(
              window.__mgFilmstripBoard || window.__mgMarket.state.rows
            );
            setStatus(window.__mgMarket.report());
          } else if (window.ipc) {
            window.ipc.postMessage(JSON.stringify({ op: "load_filmstrip" }));
            setStatus("filmstrip ipc");
          } else setStatus("no market");
        })
      );
      row.appendChild(
        act("STABLE", "primary", function () {
          if (!window.__mgMarket) return;
          window.__mgMarket.state.filter.stableOnly = !window.__mgMarket.state.filter.stableOnly;
          setStatus("stable " + window.__mgMarket.state.filter.stableOnly);
        })
      );
      row.appendChild(
        act("BULL", "", function () {
          if (!window.__mgMarket) return;
          window.__mgMarket.state.filter.bias =
            window.__mgMarket.state.filter.bias === "bullish" ? "" : "bullish";
          setStatus("bias " + (window.__mgMarket.state.filter.bias || "any"));
        })
      );
      row.appendChild(
        act("BEAR", "", function () {
          if (!window.__mgMarket) return;
          window.__mgMarket.state.filter.bias =
            window.__mgMarket.state.filter.bias === "bearish" ? "" : "bearish";
          setStatus("bias " + (window.__mgMarket.state.filter.bias || "any"));
        })
      );
      row.appendChild(
        act("GRAPH", "", function () {
          if (window.__mgMarket) {
            window.__mgMarket.state.viewMode =
              window.__mgMarket.state.viewMode === "graph" ? "list" : "graph";
            setStatus("view " + window.__mgMarket.state.viewMode);
          }
        })
      );
      row.appendChild(
        act("HIT IN", "hot", function () {
          if (window.__mgMarket && window.__mgMarket.state.focus)
            window.__mgMarket.scoreCondorTrial(window.__mgMarket.state.focus, "in");
          else if (window.__mgMarket) {
            var rows = window.__mgMarket.filtered();
            if (rows[0]) {
              window.__mgMarket.state.focus = rows[0];
              window.__mgMarket.scoreCondorTrial(rows[0], "in");
            }
          }
          setStatus(window.__mgMarket ? window.__mgMarket.report() : "?");
        })
      );
      row.appendChild(
        act("HIT EDGE", "hot", function () {
          if (window.__mgMarket && window.__mgMarket.state.focus)
            window.__mgMarket.scoreCondorTrial(window.__mgMarket.state.focus, "edge");
          setStatus(window.__mgMarket ? window.__mgMarket.report() : "?");
        })
      );
      row.appendChild(
        act("REPORT", "ok", function () {
          setStatus(window.__mgMarket ? window.__mgMarket.report() : "no mkt");
        })
      );
    } else if (mode === "vid") {
      hint.textContent = "Stream feed · ffplay / blank / gy under-hood.";
      row.appendChild(
        act("SPACEX", "hot", function () {
          if (window.__mgVideo)
            window.__mgVideo.popBlank(window.__mgVideo.presets.spacex.url);
        })
      );
      row.appendChild(
        act("FFPLAY", "primary", function () {
          if (window.__mgVideo) window.__mgVideo.ffplay();
        })
      );
      row.appendChild(
        act("YT-DLP", "", function () {
          if (window.__mgVideo) window.__mgVideo.ytdlp();
        })
      );
      row.appendChild(
        act("OPEN RAIL", "", function () {
          var r = document.getElementById("mg-vid-rail");
          if (r) {
            r.style.display = "flex";
            if (window.__mgVideo) window.__mgVideo.open();
          }
        })
      );
    } else if (mode === "books") {
      hint.textContent =
        "Living books · LOC/PD · FN honor-seed (opt-in) · accreditation Learn stair · contrail beats.";
      row.appendChild(
        act("LAB", "ok", function () {
          var u = "https://kbatch.ugrad.ai/labs/living-books.html";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          else window.open(u, "_blank");
        })
      );
      row.appendChild(
        act("CREATOR", "primary", function () {
          var u = "file:///Users/tref/dev/projects/ugrad-ant/kids-book-creator.html";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          else window.open(u, "_blank");
        })
      );
      row.appendChild(
        act("LEARN", "", function () {
          var u = "https://kbatch.ugrad.ai/learn";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
        })
      );
      row.appendChild(
        act("FN ETHIC", "hot", function () {
          /* First Nations path: ethics → opt-in seed → practice → community gate */
          var u = "https://kbatch.ugrad.ai/learn";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          setStatus("FN honor-seed · opt-in · community-first · not bulk open");
        })
      );
      row.appendChild(
        act("ACCREDIT", "", function () {
          var u = "https://data.ugrad.ai/kbatch/education/grasp-map.json";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          else window.open(u, "_blank");
        })
      );
      row.appendChild(
        act("BEATS→", "hot", function () {
          if (window.__mgContrail && window.__mgContrail.exportStoryBeats) {
            var b = window.__mgContrail.exportStoryBeats();
            var t = JSON.stringify(b, null, 2);
            if (window.ipc)
              window.ipc.postMessage(JSON.stringify({ op: "clipboard_copy", text: t }));
            setStatus("beats " + ((b.beats && b.beats.length) || 0));
          }
        })
      );
      row.appendChild(
        act("HANDOFF", "", function () {
          var u = "https://kbatch.ugrad.ai/handoff/MEMORY-GLASS-KBATCH.md";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
        })
      );
    }

    body.appendChild(hint);
    body.appendChild(row);
    setStatus(mode + " · glass capsule");
    measure();
  }

  function drawMiniBloch(cv) {
    if (!cv || !window.__mgQuantum) return;
    var st = window.__mgQuantum.state;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = cv.clientWidth || 400;
    var h = 120;
    cv.width = Math.floor(w * dpr);
    cv.height = Math.floor(h * dpr);
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var cx = w * 0.28,
      cy = h * 0.5,
      R = Math.min(w, h) * 0.36;
    ctx.strokeStyle = "rgba(160,210,255,0.35)";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    function vec(th, ph, col) {
      var x = Math.sin(th) * Math.cos(ph);
      var y = Math.sin(th) * Math.sin(ph);
      var z = Math.cos(th);
      var px = cx + x * R;
      var py = cy - z * R * 0.85 + y * R * 0.12;
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    vec(st.theta, st.phi, "rgba(120,255,200,0.95)");
    vec(st.target.theta, st.target.phi, "rgba(255,200,120,0.85)");
    ctx.fillStyle = "rgba(200,220,240,0.75)";
    ctx.font = "600 10px ui-monospace,Menlo,monospace";
    ctx.fillText("θ " + st.theta.toFixed(2) + "  φ " + st.phi.toFixed(2), w * 0.52, 28);
    ctx.fillText((st.sequence || []).join(" ") || "seq —", w * 0.52, 46);
  }

  function setMode(m) {
    mode = m;
    Array.prototype.forEach.call(el.querySelectorAll("#mg-glass-cap-tabs button"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-mode") === m);
    });
    collapsed = false;
    el.classList.remove("collapsed");
    paint();
  }

  function mount() {
    ensureCss();
    if (document.getElementById("mg-glass-cap")) return;
    el = document.createElement("div");
    el.id = "mg-glass-cap";
    el.innerHTML =
      '<div id="mg-glass-cap-hdr">' +
      '  <div class="ttl"><span class="dot">.</span>Dragon · glass</div>' +
      '  <div id="mg-glass-cap-tabs"></div>' +
      "</div>" +
      '<div id="mg-glass-cap-body"></div>' +
      '<div id="mg-glass-cap-status"></div>';
    (document.body || document.documentElement).appendChild(el);
    body = el.querySelector("#mg-glass-cap-body");
    statusEl = el.querySelector("#mg-glass-cap-status");
    var tabs = el.querySelector("#mg-glass-cap-tabs");
    MODES.forEach(function (M) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = M.label;
      b.setAttribute("data-mode", M.id);
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        if (mode === M.id && !collapsed) {
          collapsed = true;
          el.classList.add("collapsed");
          measure();
        } else {
          setMode(M.id);
        }
      };
      tabs.appendChild(b);
    });
    var fold = document.createElement("button");
    fold.type = "button";
    fold.textContent = "—";
    fold.title = "collapse";
    fold.onclick = function () {
      collapsed = !collapsed;
      el.classList.toggle("collapsed", collapsed);
      measure();
    };
    tabs.appendChild(fold);
    setMode("tools");
    collapsed = true;
    el.classList.add("collapsed");
    /* WebGrid: stay collapsed; expand only on tab click */
    try {
      if (/neuralink\.com/i.test(location.hostname) && /webgrid/i.test(location.pathname)) {
        collapsed = true;
        el.classList.add("collapsed");
      }
    } catch (eW) {}
    measure();
    setInterval(measure, 2000);
    log(VER + " · glass chip bottom-right · collapsed by default");
  }

  window.__mgGlassCap = {
    ver: VER,
    setMode: setMode,
    measure: measure,
    report: function () {
      return VER + " mode=" + mode;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    setTimeout(mount, 50);
  }
})();
