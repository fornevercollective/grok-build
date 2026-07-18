/* Memory Glass · unified Dragon glass capsule
 * One floating glass-morphism panel (inspect-style) — modes never stack as full rails.
 * VER: glass-capsule-v15-cal-boot
 */
(function () {
  "use strict";
  var VER = "glass-capsule-v15-cal-boot";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._glassCapVer === VER) return;
  HP._glassCapVer = VER;

  function markUserCtrl() {
    try {
      window.__mgUserOpenedCtrl = true;
      window.__mgUserChromeTouch = true;
    } catch (e) {}
  }

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
    { id: "tools", label: "Tools" },
    { id: "qbit", label: "Qbit" },
    { id: "gt", label: "GT" },
    { id: "mkt", label: "Mkt" },
    { id: "vid", label: "Vid" },
    { id: "books", label: "Books" },
  ];

  function ensureCss() {
    try {
      if (window.__mgSxRail) window.__mgSxRail.ensure();
    } catch (e) {}
  }

  function setStatus(s) {
    if (statusEl) statusEl.textContent = s || "Control Center";
  }

  function measure() {
    try {
      var cap = document.getElementById("mg-glass-cap");
      var h = cap && !collapsed ? cap.offsetHeight : 40;
      document.documentElement.style.setProperty("--mg-cap-h", h + 12 + "px");
    } catch (e) {}
  }

  /** Control Center module tile */
  function act(label, cls, fn, opts) {
    opts = opts || {};
    var b = document.createElement("button");
    b.type = "button";
    b.className = "act" + (cls ? " " + cls : "") + (opts.wide ? " wide" : "");
    var ico = opts.ico || "●";
    var sub = opts.sub || "";
    b.innerHTML =
      '<span class="ico" aria-hidden="true">' +
      ico +
      "</span>" +
      '<span class="lbl">' +
      label +
      (sub ? '<div class="sub">' + sub + "</div>" : "") +
      "</span>";
    b.onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      markUserCtrl();
      try {
        fn();
      } catch (e) {
        setStatus("err " + e);
      }
    };
    return b;
  }

  function section(title) {
    var s = document.createElement("div");
    s.className = "mg-cap-section";
    s.textContent = title;
    return s;
  }

  function paint() {
    if (!body) return;
    body.innerHTML = "";
    var hint = document.createElement("p");
    hint.className = "mg-cap-hint";
    var row = document.createElement("div");
    row.className = "mg-cap-row";

    if (mode === "tools") {
      hint.textContent = "";
      body.appendChild(section("Lab"));
      row.appendChild(
        act("Keyboard", "primary", function () {
          if (window.__mgFloatKb) {
            if (window.__mgFloatKb.launch)
              window.__mgFloatKb.launch({ mode: "type" });
            else window.__mgFloatKb.toggle();
            setStatus(window.__mgFloatKb.report());
          } else setStatus("Keyboard missing");
          measure();
        }, { ico: "⌨", sub: "Lang · Codec · Braille · Jam" })
      );
      row.appendChild(
        act("Codec", "hot", function () {
          if (window.__mgFloatKb && window.__mgFloatKb.launch) {
            window.__mgFloatKb.launch({
              mode: "codec",
              codec: "hex",
              text: window.__mgFloatKb.buffer() || "hello MG",
            });
            setStatus(
              (window.__mgLangCodec && window.__mgLangCodec.report()) ||
                window.__mgFloatKb.report()
            );
          } else setStatus("Codec plane missing");
          measure();
        }, { ico: "⌬", sub: "HEX·BIN·Steno·Glyph·Qbit" })
      );
      row.appendChild(
        act("Maze", "primary", function () {
          if (window.__mgMemoryMaze) {
            window.__mgMemoryMaze.toggle();
            setStatus(window.__mgMemoryMaze.report());
          } else setStatus("Maze missing");
        }, { ico: "◈", sub: "Memory rain" })
      );
      row.appendChild(
        act("Beats", "primary", function () {
          if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.toggle) {
            window.__mgKeyboardBeats.toggle();
            setStatus(window.__mgKeyboardBeats.report());
          } else setStatus("Beats missing");
        }, { ico: "♪", sub: "Staff · piano" })
      );
      row.appendChild(
        act("Contrail", "ok", function () {
          if (window.__mgContrail) {
            if (window.__mgContrail.toggle) window.__mgContrail.toggle();
            else window.__mgContrail.setFlow(true);
            if (window.__mgContrail.setOverlay) window.__mgContrail.setOverlay(true);
            setStatus(window.__mgContrail.report());
          } else setStatus("Contrail on WebGrid only");
        }, { ico: "〰", sub: "Path flow" })
      );
      body.appendChild(row);

      var row2 = document.createElement("div");
      row2.className = "mg-cap-row";
      body.appendChild(section("Play"));
      row2.appendChild(
        act("Field", "ok", function () {
          try {
            if (window.__mgFloatLayout && window.__mgFloatLayout.closeHeavy)
              window.__mgFloatLayout.closeHeavy({
                keepPlay: true,
                boardPill: true,
                ctrlPill: false,
              });
          } catch (e) {}
          if (window.__mgSportsField) {
            if (!window.__mgSportsField.isOpen()) {
              window.__mgSportsField.open();
              if (window.__mgSportsField.setMode) window.__mgSportsField.setMode("webgrid");
              if (window.__mgKeyboardBeats) window.__mgKeyboardBeats.open();
            } else {
              var m = window.__mgSportsField.mode && window.__mgSportsField.mode();
              if (m === "webgrid") window.__mgSportsField.setMode("go");
              else if (m === "go") window.__mgSportsField.setMode("chess");
              else window.__mgSportsField.close();
            }
            try {
              if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
                window.__mgFloatLayout.apply();
            } catch (eA) {}
            setStatus(window.__mgSportsField.report());
          } else {
            var u = "https://mueee.qbitos.ai/sports-field-ugrad.html";
            if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
            else window.open(u, "_blank");
            setStatus("Sports field");
          }
        }, { ico: "▣", sub: "WebGrid · Go · Chess" })
      );
      row2.appendChild(
        act("Raider", "primary", function () {
          if (window.__mgRaider) {
            window.__mgRaider.toggle();
            setStatus(window.__mgRaider.report());
          } else setStatus("Raider missing");
        }, { ico: "▶", sub: "BrotherNumsey" })
      );
      row2.appendChild(
        act("Board", "ok", function () {
          if (window.__mgActivityBoard) {
            if (window.__mgActivityBoard.isOpen && window.__mgActivityBoard.isOpen()) {
              if (window.__mgActivityBoard.isCollapsed && window.__mgActivityBoard.isCollapsed())
                window.__mgActivityBoard.expand();
              else window.__mgActivityBoard.close();
            } else window.__mgActivityBoard.open({ collapsed: true });
            setStatus(window.__mgActivityBoard.report());
          } else setStatus("Board missing");
        }, { ico: "☰", sub: "Live rank" })
      );
      row2.appendChild(
        act("Play stack", "hot", function () {
          try {
            if (window.__mgFloatLayout && window.__mgFloatLayout.openPlayStack) {
              window.__mgFloatLayout.openPlayStack({
                keyboard: true,
                kbMode: "codec",
                codec: "hex",
                mode: "webgrid",
              });
              setStatus("Field+Beats+Codec · matched");
            } else if (window.__mgFloatLayout && window.__mgFloatLayout.openLabKit) {
              window.__mgFloatLayout.openLabKit();
              setStatus("Lab kit");
            }
          } catch (eF) {
            setStatus("Play stack err");
          }
        }, { ico: "✦", sub: "Field · Beats · KB" })
      );
      row2.appendChild(
        act("Clear", "muted", function () {
          try {
            if (window.__mgMenus && window.__mgMenus.closeAll) window.__mgMenus.closeAll();
            else if (window.__mgFloatLayout && window.__mgFloatLayout.closeAll)
              window.__mgFloatLayout.closeAll();
            setStatus("Stack cleared");
          } catch (eC) {
            setStatus("Clear err");
          }
        }, { ico: "⊘", sub: "Close all floats" })
      );
      row2.appendChild(
        act("Calibrate", "primary", function () {
          try {
            if (window.__mgCal && window.__mgCal.boot) {
              setStatus("CAL → SHOW…");
              window.__mgCal.boot({ mode: "full" }).then(function (r) {
                setStatus(
                  r && r.ok
                    ? "CAL+SHOW green · " + (r.ms || "?") + "ms"
                    : "CAL " +
                        ((r && r.cal && r.cal.pass) || "?") +
                        "/" +
                        ((r && r.cal && r.cal.total) || "?") +
                        (r && r.skippedShow ? " · no show" : "")
                );
              });
            } else if (window.__mgMenus && window.__mgMenus.exercise) {
              window.__mgMenus.exercise({ delayMs: 120 });
              setStatus("Menu exercise…");
            } else setStatus("Cal missing");
          } catch (eCal) {
            setStatus("Cal err");
          }
        }, { ico: "◎", sub: "Fast verify + flourish" })
      );
      body.appendChild(row2);

      var row3 = document.createElement("div");
      row3.className = "mg-cap-row";
      body.appendChild(section("Solve"));
      row3.appendChild(
        act("Bloch", "primary", function () {
          if (window.__mgBlochSolve) {
            window.__mgBlochSolve.setEnabled(true);
            if (window.__mgBlochSolve.toggle) window.__mgBlochSolve.toggle();
            else if (window.__mgBlochSolve.open) window.__mgBlochSolve.open();
            setStatus(window.__mgBlochSolve.report ? window.__mgBlochSolve.report() : "Bloch");
          } else setStatus("Bloch missing");
        }, { ico: "◉", sub: "Dual solve" })
      );
      row3.appendChild(
        act("GEO", "hot", function () {
          if (window.__mgGeoPattern) {
            window.__mgGeoPattern.toggle();
            setStatus(window.__mgGeoPattern.report());
          } else setStatus("GEO missing");
        }, { ico: "◎", sub: "Hunt · quake" })
      );
      row3.appendChild(
        act("WebGrid", "primary", function () {
          var u = "https://neuralink.com/webgrid/?mg_autoplay=1";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          else location.href = u;
        }, { ico: "⊞", sub: "Play" })
      );
      row3.appendChild(
        act("Hot", "muted", function () {
          try {
            if (window.ipc)
              window.ipc.postMessage(JSON.stringify({ op: "hot_reload" }));
            setStatus("Hot reload");
          } catch (e) {
            setStatus("⌘⇧R hot reload");
          }
        }, { ico: "↻", sub: "Reload menus" })
      );
      body.appendChild(row3);
      body.appendChild(section("kbatch · R4-data"));
      var row = document.createElement("div");
      row.className = "mg-cap-row";
      row.appendChild(
        act("kbatch", "primary", function () {
          if (window.__mgKbatchFleet) window.__mgKbatchFleet.openHome();
          else {
            var u = "https://kbatch.ugrad.ai/";
            if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
            else window.open(u, "_blank");
          }
          setStatus(
            window.__mgKbatchFleet ? window.__mgKbatchFleet.report() : "kbatch.ugrad.ai"
          );
        }, {
          ico: "∇",
          sub: window.__mgKbatchFleet
            ? "R4 · " +
              ((window.__mgKbatchFleet.snap().metrics || {}).d5Glosses || "6k") +
              " glosses"
            : "ugrad.ai",
        })
      );
      row.appendChild(
        act("Books", "ok", function () {
          if (window.__mgKbatchFleet) window.__mgKbatchFleet.openLivingBooks();
          else {
            var u = "https://kbatch.ugrad.ai/labs/living-books.html";
            if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
            else window.open(u, "_blank");
          }
          setStatus("Living books SPA");
        }, { ico: "📘", sub: "MG P0 playfield" })
      );
      row.appendChild(
        act("Learn", "ok", function () {
          if (window.__mgKbatchFleet) window.__mgKbatchFleet.openLearn();
          else {
            var u = "https://kbatch.ugrad.ai/learn";
            if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
            else window.open(u, "_blank");
          }
        }, { ico: "▤", sub: "Schools 0.80" })
      );
      row.appendChild(
        act("Dojo", "muted", function () {
          if (window.__mgKbatchFleet) window.__mgKbatchFleet.openDojo();
          else {
            var u = "https://kbatch.ugrad.ai/dojo/";
            if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
            else window.open(u, "_blank");
          }
        }, { ico: "⚔", sub: "Typing 0.77" })
      );
      body.appendChild(row);
      body.appendChild(section("Field"));
      var rowHunt = document.createElement("div");
      rowHunt.className = "mg-cap-row";
      rowHunt.appendChild(
        act("Hunt", "hot", function () {
          if (window.__mgGeoPattern) {
            window.__mgGeoPattern.open();
            window.__mgGeoPattern.hunt();
            setStatus("Hunt clue ready");
          } else setStatus("GEO missing");
        }, { ico: "⌖", sub: "Scavenger" })
      );
      body.appendChild(rowHunt);
      var rowWide = document.createElement("div");
      rowWide.className = "mg-cap-row";
      rowWide.appendChild(
        act("Phrase → Dojo", "hot", function () {
          var phrase =
            (window.__mgContrail && window.__mgContrail.stats && window.__mgContrail.stats.lastPhrase) ||
            (window.__mgFloatKb && window.__mgFloatKb.buffer()) ||
            "path";
          if (!window.__mgKbatchDojo) {
            setStatus("kbatch bridge missing");
            return;
          }
          setStatus("Dojo «" + String(phrase).slice(0, 16) + "»…");
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
                ww
            );
          });
        }, { ico: "⚡", sub: "Contrail → kbatch", wide: true })
      );
      body.appendChild(rowWide);

      body.appendChild(section("Session"));
      var rowSess = document.createElement("div");
      rowSess.className = "mg-cap-row";
      rowSess.appendChild(
        act("Record", "primary", function () {
          if (window.__mgSessionRec) {
            if (window.__mgSessionRec.isRecording()) window.__mgSessionRec.stop();
            else window.__mgSessionRec.start();
            setStatus(window.__mgSessionRec.report());
          } else setStatus("REC missing");
        }, { ico: "●", sub: "Session" })
      );
      rowSess.appendChild(
        act("Day", "ok", function () {
          if (window.__mgCollabDay) {
            if (!window.__mgCollabDay.day()) window.__mgCollabDay.start({});
            window.__mgCollabDay.toggle();
            setStatus(window.__mgCollabDay.report());
          } else setStatus("Collab day missing");
        }, { ico: "▦", sub: "Mesh collab" })
      );
      rowSess.appendChild(
        act("Mesh", "ok", function () {
          if (window.__mgCollabDay) {
            window.__mgCollabDay.shareScore();
            setStatus("Score on mg-mesh");
          } else if (window.__mgMesh) setStatus(window.__mgMesh.report());
          else setStatus("Mesh missing");
        }, { ico: "⬡", sub: "Share" })
      );
      rowSess.appendChild(
        act("X Draft", "hot", function () {
          if (window.__mgCollabDay && window.__mgCollabDay.day && window.__mgCollabDay.day()) {
            window.__mgCollabDay.exportXDraft();
            setStatus("X draft · you post");
          } else if (window.__mgSessionRec && window.__mgSessionRec.exportXDraft) {
            window.__mgSessionRec.exportXDraft();
            setStatus("X draft · clipboard");
          } else setStatus("X draft missing");
        }, { ico: "↗", sub: "Copy only" })
      );
      body.appendChild(rowSess);
      setStatus("Control Center · Tools");
      measure();
      return;
    } else if (mode === "qbit") {
      body.appendChild(section("Quantum"));
      row.appendChild(
        act("Open", "ok", function () {
          if (window.__mgQuantum) {
            var r = document.getElementById("mg-qwg-rail");
            if (r) {
              r.style.display = "flex";
              window.__mgQuantum.open();
            }
            setStatus(window.__mgQuantum.report());
          } else setStatus("Quantum not loaded");
        }, { ico: "⚛", sub: "Full rail" })
      );
      ["H", "X", "Y", "Z", "S", "T"].forEach(function (g) {
        row.appendChild(
          act(g, "primary", function () {
            if (window.__mgQuantum)
              window.__mgQuantum.applyGate({ id: g, name: g });
            setStatus(window.__mgQuantum ? window.__mgQuantum.report() : "?");
          }, { ico: g, sub: "Gate" })
        );
      });
      row.appendChild(
        act("Score", "hot", function () {
          if (window.__mgQuantum) window.__mgQuantum.scoreHit();
          setStatus(window.__mgQuantum ? window.__mgQuantum.report() : "?");
        }, { ico: "★", sub: "Hit" })
      );
      row.appendChild(
        act("|0⟩", "muted", function () {
          if (window.__mgQuantum) window.__mgQuantum.reset();
        }, { ico: "↺", sub: "Reset" })
      );
      row.appendChild(
        act("Composer", "primary", function () {
          var u = "https://quantum.cloud.ibm.com/composer";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
        }, { ico: "IBM", sub: "Cloud" })
      );
      var cv = document.createElement("canvas");
      cv.className = "mg-cap-cv";
      cv.id = "mg-cap-bloch";
      body.appendChild(row);
      body.appendChild(cv);
      drawMiniBloch(cv);
      setStatus(window.__mgQuantum ? window.__mgQuantum.report() : "Qbit ready");
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
    if (document.getElementById("mg-glass-cap")) {
      /* remount if stale version shell */
      try {
        if (window.__mgGlassCap && window.__mgGlassCap.ver !== VER) {
          var old = document.getElementById("mg-glass-cap");
          if (old && old.parentNode) old.parentNode.removeChild(old);
        } else return;
      } catch (eR) {
        return;
      }
    }
    el = document.createElement("div");
    el.id = "mg-glass-cap";
    el.innerHTML =
      '<div id="mg-glass-cap-hdr">' +
      '  <div class="ttl"><span class="dot"></span>Control Center</div>' +
      '  <div id="mg-glass-cap-tabs" role="tablist"></div>' +
      '  <button type="button" id="mg-glass-cap-fold" title="Close">×</button>' +
      "</div>" +
      '<div id="mg-glass-cap-body"></div>' +
      '<div id="mg-glass-cap-status">Control Center</div>';
    (document.body || document.documentElement).appendChild(el);
    body = el.querySelector("#mg-glass-cap-body");
    statusEl = el.querySelector("#mg-glass-cap-status");
    var tabs = el.querySelector("#mg-glass-cap-tabs");
    MODES.forEach(function (M) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = M.label;
      b.setAttribute("data-mode", M.id);
      b.setAttribute("role", "tab");
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        markUserCtrl();
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
    var fold = el.querySelector("#mg-glass-cap-fold");
    fold.onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      markUserCtrl();
      collapsed = !collapsed;
      el.classList.toggle("collapsed", collapsed);
      fold.textContent = collapsed ? "" : "×";
      fold.title = collapsed ? "Open Control Center" : "Close";
      /* collapsed pill title shortens */
      var ttl = el.querySelector("#mg-glass-cap-hdr .ttl");
      if (ttl)
        ttl.innerHTML = collapsed
          ? '<span class="dot"></span>CTRL'
          : '<span class="dot"></span>Control Center';
      measure();
      try {
        if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
          window.__mgFloatLayout.apply();
      } catch (eA) {}
      log(VER + " · CTRL " + (collapsed ? "collapsed" : "expanded"));
    };
    /* Header click toggles (Control Center feel) */
    var hdr = el.querySelector("#mg-glass-cap-hdr");
    if (hdr) {
      hdr.style.cursor = "pointer";
      hdr.addEventListener("click", function (ev) {
        if (ev.target && ev.target.closest && ev.target.closest("button")) return;
        markUserCtrl();
        if (collapsed) {
          collapsed = false;
          el.classList.remove("collapsed");
          fold.textContent = "×";
          var ttl2 = el.querySelector("#mg-glass-cap-hdr .ttl");
          if (ttl2) ttl2.innerHTML = '<span class="dot"></span>Control Center';
          paint();
          measure();
        } else {
          fold.click();
        }
      });
    }
    setMode("tools");
    /* Start collapsed pill */
    collapsed = true;
    el.classList.add("collapsed");
    fold.textContent = "";
    var ttl0 = el.querySelector("#mg-glass-cap-hdr .ttl");
    if (ttl0) ttl0.innerHTML = '<span class="dot"></span>CTRL';
    try {
      if (/[?&]mg_tools=1\b/i.test(location.search || "")) {
        collapsed = false;
        el.classList.remove("collapsed");
        fold.textContent = "×";
        if (ttl0) ttl0.innerHTML = '<span class="dot"></span>Control Center';
        setMode("tools");
      }
    } catch (eW) {}
    measure();
    setInterval(measure, 2000);
    log(VER + " · Control Center · start " + (collapsed ? "pill" : "open"));
  }

  window.__mgGlassCap = {
    ver: VER,
    setMode: setMode,
    measure: measure,
    openTools: function () {
      markUserCtrl();
      setMode("tools");
      collapsed = false;
      if (el) el.classList.remove("collapsed");
      measure();
      try {
        var d = document.getElementById("mg-dragon");
        if (d) {
          d.classList.add("is-open");
          d.__mgUserClosed = false;
        }
      } catch (e) {}
    },
    collapse: function (force) {
      /* product-mode may call this at boot — skip if user already owns CTRL */
      if (window.__mgUserOpenedCtrl && !force) return;
      collapsed = true;
      if (el) el.classList.add("collapsed");
      measure();
    },
    close: function () {
      /* intentional close (user / Grok / menu-health) always allowed */
      collapsed = true;
      if (el) {
        el.classList.add("collapsed");
        var foldBtn = el.querySelector("#mg-glass-cap-fold");
        if (foldBtn) {
          foldBtn.textContent = "";
          foldBtn.title = "Open Control Center";
        }
        var ttl = el.querySelector("#mg-glass-cap-hdr .ttl");
        if (ttl) ttl.innerHTML = '<span class="dot"></span>CTRL';
      }
      measure();
    },
    isOpen: function () {
      return !!(el && !collapsed && !el.classList.contains("collapsed"));
    },
    isCollapsed: function () {
      return !!collapsed;
    },
    report: function () {
      return VER + " mode=" + mode + " collapsed=" + collapsed;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    setTimeout(mount, 50);
  }
})();
