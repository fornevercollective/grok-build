/* Memory Glass · LEFT TOOLS DRAWER
 * Primary chrome: side drawer from the left — not permanent floating panels.
 * Opens via TOOLS tab; modules open as temporary floats, close with × / Clear.
 * Keeps .mg-edge above everything so window resize still works.
 * VER: mg-tools-drawer-v2
 */
(function () {
  "use strict";
  var VER = "mg-tools-drawer-v2-chrome-clean";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._toolsDrawerVer === VER) return;
  HP._toolsDrawerVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var open = false;
  var el = null;
  var tab = null;
  var body = null;
  var statusEl = null;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "drawer");
    } catch (e) {}
  }

  /** Raise resize grips above drawer / floats (body + #mg-root). */
  function raiseEdges() {
    try {
      var nodes = document.querySelectorAll(".mg-edge");
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.style.setProperty("z-index", "2147483647", "important");
        n.style.setProperty("pointer-events", "auto", "important");
      }
    } catch (e) {}
  }

  function ensureCss() {
    var old = document.getElementById("mg-tools-drawer-css");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "mg-tools-drawer-css";
    st.textContent = [
      /* CRITICAL: resize edges always above floats/drawer */
      ".mg-edge{z-index:2147483647!important;pointer-events:auto!important}",
      "html.mg-webgrid-play .mg-edge{z-index:2147483647!important;pointer-events:auto!important}",
      /* tab sits inside west grip (14px free at window edge) */
      "#mg-tools-tab{",
      "  position:fixed;left:14px;top:50%;",
      "  z-index:2147483640;pointer-events:auto;cursor:pointer;",
      "  writing-mode:vertical-rl;transform:translateY(-50%) rotate(180deg);",
      "  padding:14px 8px;margin:0;border:0;",
      "  border-radius:0 10px 10px 0;",
      "  background:rgba(18,22,30,0.78);",
      "  backdrop-filter:blur(20px) saturate(1.3);-webkit-backdrop-filter:blur(20px) saturate(1.3);",
      "  border:1px solid rgba(255,255,255,0.14);border-left:0;",
      "  color:rgba(240,246,255,0.92);",
      "  font:700 10px/1 system-ui;letter-spacing:0.14em;text-transform:uppercase;",
      "  box-shadow:4px 0 20px rgba(0,0,0,0.25)}",
      "#mg-tools-tab:hover{background:rgba(28,34,48,0.92);color:#fff}",
      "#mg-tools-tab.on{background:rgba(40,50,70,0.94);color:rgba(160,220,255,0.98);left:0}",
      /* drawer panel */
      "#mg-tools-drawer{",
      "  position:fixed;left:0;top:0;bottom:0;width:min(320px,86vw);",
      "  z-index:2147483635;pointer-events:auto;",
      "  display:flex;flex-direction:column;",
      "  transform:translateX(-105%);transition:transform .22s cubic-bezier(.2,.9,.2,1);",
      "  background:rgba(12,14,20,0.9);",
      "  backdrop-filter:blur(32px) saturate(1.5);-webkit-backdrop-filter:blur(32px) saturate(1.5);",
      "  border-right:1px solid rgba(255,255,255,0.12);",
      "  box-shadow:12px 0 40px rgba(0,0,0,0.35);",
      "  font:500 12px/1.3 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;",
      "  color:rgba(244,246,250,0.94)}",
      "#mg-tools-drawer.open{transform:translateX(0)}",
      "#mg-tools-drawer .drw-hd{",
      "  display:flex;align-items:center;justify-content:space-between;gap:8px;",
      "  padding:14px 14px 10px;flex-shrink:0;",
      "  border-bottom:1px solid rgba(255,255,255,0.08)}",
      "#mg-tools-drawer .drw-hd .ttl{",
      "  font:700 12px/1 system-ui;letter-spacing:0.12em;text-transform:uppercase;",
      "  color:rgba(200,220,255,0.95)}",
      "#mg-tools-drawer .drw-hd .ttl .dot{",
      "  display:inline-block;width:7px;height:7px;border-radius:50%;",
      "  background:rgba(100,220,160,0.95);margin-right:8px;",
      "  box-shadow:0 0 6px rgba(100,220,160,0.5)}",
      "#mg-tools-drawer .drw-hd button{",
      "  appearance:none;cursor:pointer;border:0;background:rgba(255,255,255,0.08);",
      "  color:rgba(255,255,255,0.9);width:28px;height:28px;border-radius:50%;",
      "  font:600 14px/1 system-ui}",
      "#mg-tools-drawer .drw-hd button:hover{background:rgba(255,255,255,0.16)}",
      "#mg-tools-drawer .drw-body{flex:1;overflow-y:auto;overflow-x:hidden;",
      "  padding:8px 12px 16px;-webkit-overflow-scrolling:touch}",
      "#mg-tools-drawer .sec{",
      "  font:700 10px/1 system-ui;letter-spacing:0.1em;text-transform:uppercase;",
      "  color:rgba(160,180,200,0.55);margin:12px 4px 8px}",
      "#mg-tools-drawer .row{",
      "  display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}",
      "#mg-tools-drawer .row.wide{grid-template-columns:1fr}",
      "#mg-tools-drawer button.tile{",
      "  appearance:none;cursor:pointer;text-align:left;",
      "  display:flex;align-items:center;gap:10px;",
      "  padding:10px 12px;border-radius:12px;",
      "  background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);",
      "  color:rgba(244,246,250,0.95);",
      "  font:600 12px/1.2 system-ui;min-height:44px}",
      "#mg-tools-drawer button.tile:hover{background:rgba(255,255,255,0.12)}",
      "#mg-tools-drawer button.tile:active{transform:scale(0.98)}",
      "#mg-tools-drawer button.tile .ico{",
      "  width:28px;height:28px;border-radius:8px;flex-shrink:0;",
      "  display:flex;align-items:center;justify-content:center;",
      "  background:rgba(255,255,255,0.1);font-size:14px}",
      "#mg-tools-drawer button.tile.primary .ico{background:rgba(10,132,255,0.9)}",
      "#mg-tools-drawer button.tile.ok .ico{background:rgba(48,209,88,0.9)}",
      "#mg-tools-drawer button.tile.hot .ico{background:rgba(255,159,10,0.9);color:#1a1200}",
      "#mg-tools-drawer button.tile.muted .ico{background:rgba(142,142,147,0.85)}",
      "#mg-tools-drawer button.tile .lbl{flex:1;min-width:0}",
      "#mg-tools-drawer button.tile .sub{",
      "  display:block;font:500 10px/1.2 system-ui;color:rgba(180,200,220,0.55);margin-top:2px}",
      "#mg-tools-drawer .drw-status{",
      "  flex-shrink:0;padding:8px 14px;border-top:1px solid rgba(255,255,255,0.08);",
      "  font:500 10px/1.3 ui-monospace,Menlo,monospace;color:rgba(160,190,210,0.75)}",
      /* dim scrim — below edges (max z), above page */
      "#mg-tools-scrim{",
      "  position:fixed;inset:0;z-index:2147483630;pointer-events:none;",
      "  background:rgba(0,0,0,0.28);opacity:0;transition:opacity .2s}",
      "#mg-tools-scrim.on{opacity:1;pointer-events:auto}",
      /* drawer mode: hide permanent floating chrome (use drawer instead) */
      "html.mg-drawer-mode #mg-glass-cap{",
      "  display:none!important;visibility:hidden!important;pointer-events:none!important;",
      "  opacity:0!important;width:0!important;height:0!important;overflow:hidden!important}",
      "html.mg-drawer-mode #mg-bloch-orb,html.mg-drawer-mode #mg-rubik-orb,",
      "html.mg-drawer-mode #mg-sx-rail{",
      "  display:none!important;pointer-events:none!important}",
      /* kill legacy mega solve strip if any residual class */
      "html.mg-drawer-mode #mg-solve-hud{",
      "  background:transparent!important;border:none!important;box-shadow:none!important;",
      "  max-width:none!important;transform:none!important;border-radius:0!important}",
      /* temporary floats inset from edges so grips stay free */
      "html.mg-drawer-mode #mg-float-kb,",
      "html.mg-drawer-mode #mg-sports-field,",
      "html.mg-drawer-mode #mg-kb-beats,",
      "html.mg-drawer-mode #mg-bloch-float,",
      "html.mg-drawer-mode #mg-rubik-float,",
      "html.mg-drawer-mode #mg-mem-maze,",
      "html.mg-drawer-mode #mg-geo-float,",
      "html.mg-drawer-mode #mg-raider-stage{",
      "  max-width:calc(100vw - 32px)!important;",
      "  max-height:calc(100vh - 32px)!important}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
    try {
      document.documentElement.classList.add("mg-drawer-mode");
    } catch (e) {}
    raiseEdges();
  }

  function setStatus(s) {
    if (statusEl) statusEl.textContent = s || "Tools drawer · " + VER;
  }

  function tile(label, cls, ico, sub, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "tile" + (cls ? " " + cls : "");
    b.innerHTML =
      '<span class="ico" aria-hidden="true">' +
      (ico || "●") +
      "</span>" +
      '<span class="lbl">' +
      label +
      (sub ? '<span class="sub">' + sub + "</span>" : "") +
      "</span>";
    b.onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      try {
        window.__mgUserChromeTouch = true;
        fn();
        setStatus(label + " · ready");
      } catch (e) {
        setStatus("err " + e);
      }
    };
    return b;
  }

  function section(title) {
    var s = document.createElement("div");
    s.className = "sec";
    s.textContent = title;
    return s;
  }

  function openModule(openFn, closeDrawer) {
    try {
      if (typeof openFn === "function") openFn();
    } catch (e) {}
    if (closeDrawer !== false) setOpen(false);
    try {
      if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
        window.__mgFloatLayout.apply();
    } catch (eA) {}
    raiseEdges();
  }

  function paint() {
    if (!body) return;
    body.innerHTML = "";

    body.appendChild(section("Play"));
    var r1 = document.createElement("div");
    r1.className = "row";
    r1.appendChild(
      tile("Keyboard", "primary", "⌨", "Lang · codec · jam", function () {
        openModule(function () {
          if (window.__mgFloatKb) {
            if (window.__mgFloatKb.launch)
              window.__mgFloatKb.launch({ mode: "type" });
            else window.__mgFloatKb.open();
          }
        });
      })
    );
    r1.appendChild(
      tile("Codec feed", "hot", "⌬", "HEX · BIN · glyph", function () {
        openModule(function () {
          if (window.__mgFloatKb && window.__mgFloatKb.launch)
            window.__mgFloatKb.launch({
              mode: "codec",
              codec: "hex",
              text: window.__mgFloatKb.buffer() || "hello MG",
            });
        });
      })
    );
    r1.appendChild(
      tile("Field", "ok", "▣", "WebGrid · Go · Chess", function () {
        openModule(function () {
          if (window.__mgSportsField) {
            window.__mgSportsField.open();
            if (window.__mgSportsField.setMode)
              window.__mgSportsField.setMode("webgrid");
          }
          if (window.__mgKeyboardBeats) window.__mgKeyboardBeats.open();
        }, false);
      })
    );
    r1.appendChild(
      tile("Beats", "primary", "♪", "Staff · pad", function () {
        openModule(function () {
          if (window.__mgKeyboardBeats) window.__mgKeyboardBeats.open();
        });
      })
    );
    body.appendChild(r1);

    body.appendChild(section("Solve · lab"));
    var r2 = document.createElement("div");
    r2.className = "row";
    r2.appendChild(
      tile("Bloch", "primary", "◉", "Dual solve", function () {
        openModule(function () {
          if (window.__mgBlochSolve) {
            if (window.__mgBlochSolve.setEnabled)
              window.__mgBlochSolve.setEnabled(true);
            if (window.__mgBlochSolve.open) window.__mgBlochSolve.open();
          }
        });
      })
    );
    r2.appendChild(
      tile("Rubik", "hot", "▦", "3D lang · solve", function () {
        openModule(function () {
          if (window.__mgRubikLang) {
            if (window.__mgRubikLang.open) window.__mgRubikLang.open();
            else if (window.__mgRubikLang.toggle) window.__mgRubikLang.toggle();
          }
        });
      })
    );
    r2.appendChild(
      tile("Maze", "primary", "◈", "Memory rain", function () {
        openModule(function () {
          if (window.__mgMemoryMaze) window.__mgMemoryMaze.open();
        });
      })
    );
    r2.appendChild(
      tile("GEO", "hot", "◎", "Hunt · quake", function () {
        openModule(function () {
          if (window.__mgGeoPattern) window.__mgGeoPattern.open();
        });
      })
    );
    body.appendChild(r2);

    body.appendChild(section("Board · session"));
    var r3 = document.createElement("div");
    r3.className = "row";
    r3.appendChild(
      tile("LIVE RANK", "ok", "☰", "Metrics · board", function () {
        openModule(function () {
          if (window.__mgActivityBoard)
            window.__mgActivityBoard.open({ collapsed: false });
        });
      })
    );
    r3.appendChild(
      tile("Raider", "primary", "▶", "BrotherNumsey", function () {
        openModule(function () {
          if (window.__mgRaider) window.__mgRaider.open();
        });
      })
    );
    r3.appendChild(
      tile("Record", "muted", "●", "Session", function () {
        openModule(function () {
          if (window.__mgSessionRec) {
            if (
              window.__mgSessionRec.isRecording &&
              window.__mgSessionRec.isRecording()
            )
              window.__mgSessionRec.stop();
            else if (window.__mgSessionRec.start) window.__mgSessionRec.start();
          }
        }, false);
      })
    );
    r3.appendChild(
      tile("Contrail", "ok", "〰", "Path flow", function () {
        openModule(function () {
          if (window.__mgContrail) {
            if (window.__mgContrail.setOverlay)
              window.__mgContrail.setOverlay(true);
            if (window.__mgContrail.setFlow) window.__mgContrail.setFlow(true);
            if (window.__mgContrail.toggle) window.__mgContrail.toggle();
          }
        }, false);
      })
    );
    body.appendChild(r3);

    body.appendChild(section("System"));
    var r4 = document.createElement("div");
    r4.className = "row";
    r4.appendChild(
      tile("Calibrate", "primary", "◎", "CAL → SHOW", function () {
        openModule(function () {
          if (window.__mgCal && window.__mgCal.boot)
            window.__mgCal.boot({ mode: "full" });
          else if (window.__mgMenus && window.__mgMenus.exercise)
            window.__mgMenus.exercise({ delayMs: 120 });
        }, false);
      })
    );
    r4.appendChild(
      tile("Clear all", "muted", "⊘", "Close floats", function () {
        openModule(function () {
          if (window.__mgFloatLayout && window.__mgFloatLayout.closeAll)
            window.__mgFloatLayout.closeAll();
          else if (window.__mgMenus && window.__mgMenus.closeAll)
            window.__mgMenus.closeAll();
        }, false);
      })
    );
    r4.appendChild(
      tile("Play stack", "hot", "✦", "Field+Beats+KB", function () {
        openModule(function () {
          if (window.__mgFloatLayout && window.__mgFloatLayout.openPlayStack)
            window.__mgFloatLayout.openPlayStack({
              keyboard: true,
              kbMode: "codec",
              codec: "hex",
              mode: "webgrid",
            });
        }, false);
      })
    );
    r4.appendChild(
      tile("Hot reload", "muted", "↻", "⌘⇧R", function () {
        try {
          if (window.ipc)
            window.ipc.postMessage(JSON.stringify({ op: "hot_reload" }));
        } catch (e) {}
        setStatus("Hot reload…");
      })
    );
    body.appendChild(r4);

    body.appendChild(section("Grok · shell"));
    var r5 = document.createElement("div");
    r5.className = "row";
    r5.appendChild(
      tile("Grok term", "hot", "❯", "TUI bridge · tools", function () {
        openModule(function () {
          if (window.__mgGrokTerm) window.__mgGrokTerm.open();
        }, false);
      })
    );
    r5.appendChild(
      tile("Portal panel", "primary", "◆", "NAV · EYE · MODES", function () {
        openModule(function () {
          var d = document.getElementById("mg-dragon");
          if (d) {
            d.classList.add("is-open");
            d.__mgUserClosed = false;
          }
        });
      })
    );
    body.appendChild(r5);
  }

  function setOpen(on) {
    open = !!on;
    if (el) el.classList.toggle("open", open);
    if (tab) tab.classList.toggle("on", open);
    var scrim = document.getElementById("mg-tools-scrim");
    if (scrim) scrim.classList.toggle("on", open);
    if (open) {
      paint();
      setStatus("Tools open · pick a module");
      window.__mgUserChromeTouch = true;
    }
    raiseEdges();
    log(VER + " · " + (open ? "open" : "closed"));
  }

  function toggle() {
    setOpen(!open);
  }

  function mount() {
    ensureCss();
    if (document.getElementById("mg-tools-drawer")) {
      try {
        if (window.__mgToolsDrawer && window.__mgToolsDrawer.ver !== VER) {
          ["mg-tools-drawer", "mg-tools-tab", "mg-tools-scrim"].forEach(function (
            id
          ) {
            var n = document.getElementById(id);
            if (n && n.parentNode) n.parentNode.removeChild(n);
          });
        } else {
          raiseEdges();
          return;
        }
      } catch (e) {
        return;
      }
    }

    var scrim = document.createElement("div");
    scrim.id = "mg-tools-scrim";
    scrim.onclick = function () {
      setOpen(false);
    };
    (document.body || document.documentElement).appendChild(scrim);

    tab = document.createElement("button");
    tab.type = "button";
    tab.id = "mg-tools-tab";
    tab.textContent = "TOOLS";
    tab.title = "Open tools drawer (modules on demand)";
    tab.onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      toggle();
    };
    (document.body || document.documentElement).appendChild(tab);

    el = document.createElement("div");
    el.id = "mg-tools-drawer";
    el.innerHTML =
      '<div class="drw-hd">' +
      '  <div class="ttl"><span class="dot"></span>Tools</div>' +
      '  <button type="button" id="mg-tools-x" title="Close">×</button>' +
      "</div>" +
      '<div class="drw-body" id="mg-tools-body"></div>' +
      '<div class="drw-status" id="mg-tools-status">Drawer · modules on demand</div>';
    (document.body || document.documentElement).appendChild(el);
    body = el.querySelector("#mg-tools-body");
    statusEl = el.querySelector("#mg-tools-status");
    el.querySelector("#mg-tools-x").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      setOpen(false);
    };

    /* ESC closes drawer */
    if (!window.__mgToolsDrawerEsc) {
      window.__mgToolsDrawerEsc = true;
      document.addEventListener(
        "keydown",
        function (ev) {
          if (ev.key === "Escape" && open) {
            setOpen(false);
            ev.preventDefault();
          }
        },
        true
      );
    }

    paint();
    setOpen(false);
    raiseEdges();
    /* re-raise after late float mounts */
    setTimeout(raiseEdges, 400);
    setTimeout(raiseEdges, 1200);
    setTimeout(raiseEdges, 2800);
    log(VER + " · left drawer ready");
  }

  window.__mgToolsDrawer = {
    ver: VER,
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: toggle,
    isOpen: function () {
      return open;
    },
    paint: paint,
    raiseEdges: raiseEdges,
    report: function () {
      return VER + " open=" + open;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    setTimeout(mount, 80);
  }
})();
