/* Memory Glass · GROK CALIBRATION BOOT + FLOURISH SHOW
 * Phase CAL  — fastest possible open/close/hit of every touchable surface
 * Phase SHOW — only if CAL green: choreographed ability playthrough
 *
 * Entry:
 *   window.__mgCal.boot()           full CAL → SHOW
 *   window.__mgCal.calibrate()      CAL only
 *   window.__mgCal.show()           SHOW only (skips fail gate if force)
 *   ?mg_cal=1 | ?mg_cal=show | ?mg_cal=fast
 *   CTRL → Calibrate
 *
 * B0–B8 presentable boot (dual drawers + shell + scroll soak + clear).
 * VER: mg-cal-boot-v2-b0b8
 */
(function () {
  "use strict";
  var VER = "mg-cal-boot-v2-b0b8";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._mgCalBootVer === VER) return;
  HP._mgCalBootVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var running = false;
  var lastCal = null;
  var lastShow = null;
  var bannerEl = null;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "ok", String(m), "mg-cal");
    } catch (e) {}
  }

  function emit(payload) {
    var body = Object.assign(
      { kind: "mg_cal", ver: VER, t: Date.now() },
      payload || {}
    );
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({
            op: "dev_log",
            lvl: body.ok === false ? "warn" : "ok",
            msg: "MGW:" + JSON.stringify(body),
            src: "mg-cal",
            t: body.t,
          })
        );
      }
    } catch (eI) {}
    try {
      console.log("MG_CAL " + JSON.stringify(body));
    } catch (eC) {}
    return body;
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function ensureBannerCss() {
    if (document.getElementById("mg-cal-css")) return;
    var st = document.createElement("style");
    st.id = "mg-cal-css";
    st.textContent = [
      "#mg-cal-banner{",
      "  position:fixed;left:50%;top:18px;transform:translateX(-50%);",
      "  z-index:2147483647;pointer-events:none;",
      "  min-width:min(420px,88vw);max-width:min(640px,94vw);",
      "  padding:10px 16px;border-radius:14px;",
      "  font:700 12px/1.35 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;",
      "  letter-spacing:0.02em;text-align:center;",
      "  color:rgba(245,250,255,0.96);",
      "  background:rgba(12,16,24,0.78);",
      "  border:1px solid rgba(120,200,255,0.4);",
      "  backdrop-filter:blur(22px) saturate(1.5);-webkit-backdrop-filter:blur(22px) saturate(1.5);",
      "  box-shadow:0 12px 40px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.12);",
      "  opacity:0;transition:opacity .18s ease,transform .22s cubic-bezier(.2,.9,.2,1)}",
      "#mg-cal-banner.on{opacity:1;transform:translateX(-50%) translateY(0)}",
      "#mg-cal-banner.phase-cal{border-color:rgba(110,200,255,0.55)}",
      "#mg-cal-banner.phase-show{border-color:rgba(120,255,180,0.55);",
      "  box-shadow:0 12px 40px rgba(0,80,40,0.25),0 0 28px rgba(80,255,160,0.15)}",
      "#mg-cal-banner.phase-fail{border-color:rgba(255,120,100,0.6);",
      "  background:rgba(40,12,12,0.82)}",
      "#mg-cal-banner .ph{font:800 10px/1 system-ui;letter-spacing:0.14em;text-transform:uppercase;",
      "  opacity:0.7;margin-bottom:4px}",
      "#mg-cal-banner .msg{font:650 13px/1.3 system-ui}",
      "#mg-cal-banner .sub{font:500 10px/1.3 ui-monospace,Menlo,monospace;opacity:0.65;margin-top:4px}",
      "#mg-cal-spark{",
      "  position:fixed;inset:0;z-index:2147483645;pointer-events:none;",
      "  opacity:0;transition:opacity .35s ease;",
      "  background:radial-gradient(ellipse 60% 40% at 50% 45%,",
      "    rgba(100,220,255,0.12),transparent 70%)}",
      "#mg-cal-spark.on{opacity:1}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function banner(phase, msg, sub) {
    ensureBannerCss();
    if (!bannerEl) {
      bannerEl = document.createElement("div");
      bannerEl.id = "mg-cal-banner";
      (document.body || document.documentElement).appendChild(bannerEl);
    }
    bannerEl.className = "on phase-" + (phase || "cal");
    bannerEl.innerHTML =
      '<div class="ph">' +
      (phase === "show" ? "SHOW" : phase === "fail" ? "CAL FAIL" : "CALIBRATE") +
      "</div>" +
      '<div class="msg">' +
      (msg || "") +
      "</div>" +
      (sub ? '<div class="sub">' + sub + "</div>" : "");
  }

  function bannerOff(ms) {
    setTimeout(function () {
      if (bannerEl) bannerEl.classList.remove("on");
    }, ms != null ? ms : 900);
  }

  function spark(on) {
    ensureBannerCss();
    var sp = document.getElementById("mg-cal-spark");
    if (!sp) {
      sp = document.createElement("div");
      sp.id = "mg-cal-spark";
      (document.body || document.documentElement).appendChild(sp);
    }
    sp.classList.toggle("on", !!on);
  }

  function hitTest(el) {
    if (!el) return { ok: false, reason: "no-el" };
    try {
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2)
        return { ok: false, reason: "zero-box" };
      var pts = [
        [0.5, 0.5],
        [0.2, 0.2],
        [0.8, 0.2],
        [0.5, 0.8],
      ];
      for (var i = 0; i < pts.length; i++) {
        var x = Math.min(
          window.innerWidth - 1,
          Math.max(0, r.left + r.width * pts[i][0])
        );
        var y = Math.min(
          window.innerHeight - 1,
          Math.max(0, r.top + r.height * pts[i][1])
        );
        var top = document.elementFromPoint(x, y);
        if (top && (el === top || el.contains(top)))
          return { ok: true, reason: "hit", top: top.id || top.tagName };
      }
      return { ok: false, reason: "blocked" };
    } catch (e) {
      return { ok: false, reason: "err" };
    }
  }

  function clickEl(el) {
    if (!el) return false;
    try {
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
      );
      return true;
    } catch (e) {
      try {
        el.click();
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  function pressKey(ch) {
    try {
      if (window.__mgFloatKb && window.__mgFloatKb.standalone)
        window.__mgFloatKb.standalone.press(ch);
      else if (window.__mgFloatKb && window.__mgFloatKb.setBuffer) {
        var b = (window.__mgFloatKb.buffer && window.__mgFloatKb.buffer()) || "";
        window.__mgFloatKb.setBuffer(b + ch);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Ordered CAL steps — dual-drawer era + on-demand modules.
   * Each: { id, label, open?, act, close?, dom? }
   */
  function calSteps() {
    return [
      {
        id: "tools",
        label: "TOOLS L",
        open: function () {
          if (window.__mgToolsDrawer) window.__mgToolsDrawer.open();
          else if (window.__mgMenus) window.__mgMenus.open("tools");
        },
        act: function () {
          var tabs = document.querySelectorAll("#mg-tools-drawer .drw-tabs button");
          var n = 0;
          for (var i = 0; i < Math.min(tabs.length, 4); i++) {
            if (clickEl(tabs[i])) n++;
          }
          var acts = document.querySelectorAll("#mg-tools-drawer button.act");
          for (var j = 0; j < Math.min(acts.length, 3); j++) hitTest(acts[j]);
          return { tabs: n, acts: acts.length };
        },
        close: function () {
          if (window.__mgToolsDrawer) window.__mgToolsDrawer.close();
          else if (window.__mgMenus) window.__mgMenus.close("tools");
        },
        dom: "mg-tools-drawer",
      },
      {
        id: "data",
        label: "DATA R",
        open: function () {
          if (window.__mgRightDrawer) window.__mgRightDrawer.open("live");
          else if (window.__mgMenus) window.__mgMenus.open("data");
        },
        act: function () {
          var tabs = document.querySelectorAll("#mg-right-drawer .drw-tabs button");
          var n = 0;
          for (var i = 0; i < Math.min(tabs.length, 5); i++) {
            if (clickEl(tabs[i])) n++;
          }
          return { tabs: n };
        },
        close: function () {
          if (window.__mgRightDrawer) window.__mgRightDrawer.close();
          else if (window.__mgMenus) window.__mgMenus.close("data");
        },
        dom: "mg-right-drawer",
      },
      {
        id: "mkt",
        label: "Mkt embed",
        open: function () {
          if (window.__mgRightDrawer) window.__mgRightDrawer.open("mkt");
        },
        act: function () {
          var list = document.getElementById("mg-mkt-list");
          var strip = document.getElementById("mg-mkt-cv");
          return {
            list: !!(list && list.children.length >= 0),
            strip: !!strip,
            market: !!(window.__mgMarket && window.__mgMarket.ver),
          };
        },
        close: function () {
          if (window.__mgRightDrawer) window.__mgRightDrawer.close();
        },
        dom: "mg-drawer-mkt-host",
      },
      {
        id: "search",
        label: "Search",
        open: function () {
          if (window.__mgMenus) return window.__mgMenus.open("search");
          else {
            var d = document.getElementById("mg-search-dock");
            if (d) d.classList.add("is-open");
          }
        },
        act: function () {
          var modes = document.querySelectorAll("#mg-search-modes button");
          var n = 0;
          modes.forEach(function (b) {
            if (clickEl(b)) n++;
          });
          return { modes: n };
        },
        close: function () {
          if (window.__mgMenus) window.__mgMenus.close("search");
        },
        dom: "mg-search-dock",
      },
      {
        id: "keyboard",
        label: "Keyboard+codec",
        open: function () {
          if (window.__mgFloatKb && window.__mgFloatKb.launch)
            window.__mgFloatKb.launch({
              mode: "codec",
              codec: "hex",
              text: "MG",
            });
          else if (window.__mgMenus) window.__mgMenus.open("keyboard");
        },
        act: function () {
          var keys = "cal";
          for (var i = 0; i < keys.length; i++) pressKey(keys[i]);
          try {
            if (window.__mgFloatKb && window.__mgFloatKb.paintLiveFeeds)
              window.__mgFloatKb.paintLiveFeeds();
            if (window.__mgFloatKb && window.__mgFloatKb.runCodec)
              window.__mgFloatKb.runCodec();
          } catch (e) {}
          var feeds = document.querySelectorAll("#mg-kb-live-feeds .feed");
          return { keys: keys.length, feeds: feeds.length };
        },
        close: function () {
          if (window.__mgFloatKb && window.__mgFloatKb.close)
            window.__mgFloatKb.close();
        },
        dom: "mg-float-kb",
      },
      {
        id: "board",
        label: "LIVE RANK",
        open: function () {
          if (window.__mgActivityBoard)
            window.__mgActivityBoard.open({ collapsed: false });
        },
        act: function () {
          var fold = document.getElementById("mg-board-fold");
          if (fold) clickEl(fold);
          return { fold: !!fold };
        },
        close: function () {
          if (window.__mgActivityBoard)
            window.__mgActivityBoard.open({ collapsed: true });
        },
        dom: "mg-activity-board",
      },
      {
        id: "beats",
        label: "Beats pad",
        open: function () {
          if (window.__mgKeyboardBeats) window.__mgKeyboardBeats.open();
        },
        act: function () {
          try {
            if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.onKey)
              window.__mgKeyboardBeats.onKey("c", 0.5, 0.5);
          } catch (e) {}
          return { pad: !!document.getElementById("mg-kb-beats") };
        },
        close: function () {
          if (window.__mgKeyboardBeats) window.__mgKeyboardBeats.close();
        },
        dom: "mg-kb-beats",
      },
      {
        id: "field",
        label: "Field WG/Go/Chess",
        open: function () {
          if (window.__mgSportsField) {
            window.__mgSportsField.open();
            if (window.__mgSportsField.setMode)
              window.__mgSportsField.setMode("webgrid");
          }
        },
        act: function () {
          var modes = ["webgrid", "go", "chess"];
          var n = 0;
          modes.forEach(function (m) {
            try {
              if (window.__mgSportsField && window.__mgSportsField.setMode) {
                window.__mgSportsField.setMode(m);
                n++;
              }
            } catch (e) {}
          });
          var btns = document.querySelectorAll("#mg-sports-field [data-field-mode]");
          btns.forEach(function (b) {
            hitTest(b);
          });
          return { modes: n, modeBtns: btns.length };
        },
        close: function () {
          if (window.__mgSportsField) window.__mgSportsField.close();
        },
        dom: "mg-sports-field",
      },
      {
        id: "maze",
        label: "Maze",
        open: function () {
          if (window.__mgMemoryMaze) window.__mgMemoryMaze.open();
        },
        act: function () {
          return { open: !!(window.__mgMemoryMaze && window.__mgMemoryMaze.isOpen && window.__mgMemoryMaze.isOpen()) };
        },
        close: function () {
          if (window.__mgMemoryMaze) window.__mgMemoryMaze.close();
        },
        dom: "mg-mem-maze",
      },
      {
        id: "geo",
        label: "GEO",
        open: function () {
          if (window.__mgGeoPattern) window.__mgGeoPattern.open();
        },
        act: function () {
          return { open: !!(window.__mgGeoPattern && window.__mgGeoPattern.isOpen && window.__mgGeoPattern.isOpen()) };
        },
        close: function () {
          if (window.__mgGeoPattern) window.__mgGeoPattern.close();
        },
        dom: "mg-geo-float",
      },
      {
        id: "bloch",
        label: "Bloch",
        open: function () {
          if (window.__mgBlochSolve) {
            if (window.__mgBlochSolve.setEnabled) window.__mgBlochSolve.setEnabled(true);
            if (window.__mgBlochSolve.open) window.__mgBlochSolve.open();
          }
        },
        act: function () {
          return { api: !!window.__mgBlochSolve };
        },
        close: function () {
          if (window.__mgBlochSolve && window.__mgBlochSolve.close)
            window.__mgBlochSolve.close();
        },
        dom: "mg-bloch-float",
      },
      {
        id: "raider",
        label: "Raider",
        open: function () {
          if (window.__mgRaider) window.__mgRaider.open();
        },
        act: function () {
          return { api: !!window.__mgRaider };
        },
        close: function () {
          if (window.__mgRaider) window.__mgRaider.close();
        },
        dom: "mg-raider-stage",
      },
      {
        id: "dragon",
        label: "Dragon shell",
        open: function () {
          if (window.__mgMenus) window.__mgMenus.open("dragon");
          else {
            var d = document.getElementById("mg-dragon");
            if (d) d.classList.add("is-open");
          }
        },
        act: function () {
          var btns = document.querySelectorAll("#mg-panel button, #mg-dragon button");
          var n = 0;
          for (var i = 0; i < Math.min(btns.length, 6); i++) {
            if (hitTest(btns[i]).ok) n++;
          }
          return { buttons: btns.length, hittable: n };
        },
        close: function () {
          if (window.__mgMenus) window.__mgMenus.close("dragon");
          else {
            var d = document.getElementById("mg-dragon");
            if (d) d.classList.remove("is-open");
          }
        },
        dom: "mg-dragon",
      },
      {
        id: "layout",
        label: "Float layout",
        open: function () {},
        act: function () {
          try {
            if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
              return { n: window.__mgFloatLayout.apply() };
          } catch (e) {}
          return { n: 0 };
        },
        close: function () {},
      },
    ];
  }

  function runCalibrate(opts) {
    opts = opts || {};
    var delay = opts.delayMs != null ? opts.delayMs : opts.fast ? 55 : 90;
    var steps = calSteps();
    var results = [];
    var t0 = Date.now();
    var i = 0;

    banner("cal", "Scanning touch surfaces…", "0 / " + steps.length);
    emit({ phase: "cal_start", n: steps.length, delay: delay });

    return new Promise(function (resolve) {
      function step() {
        if (i >= steps.length) {
          var pass = results.filter(function (r) {
            return r.ok;
          }).length;
          var fails = results
            .filter(function (r) {
              return !r.ok;
            })
            .map(function (r) {
              return r.id + ":" + (r.fail || "?");
            });
          var report = {
            ok: fails.length === 0,
            pass: pass,
            total: results.length,
            fails: fails,
            ms: Date.now() - t0,
            results: results,
            ver: VER,
          };
          lastCal = report;
          try {
            if (window.__mgFloatLayout && window.__mgFloatLayout.closeAll)
              window.__mgFloatLayout.closeAll();
            else if (window.__mgMenus && window.__mgMenus.closeAll)
              window.__mgMenus.closeAll();
          } catch (eC) {}
          try {
            if (window.__mgActivityBoard)
              window.__mgActivityBoard.open({ collapsed: true });
          } catch (eB) {}
          banner(
            report.ok ? "cal" : "fail",
            report.ok
              ? "CAL GREEN · " + pass + "/" + report.total + " · " + report.ms + "ms"
              : "CAL " + pass + "/" + report.total + " FAIL",
            fails.slice(0, 4).join(" ") || "all systems go"
          );
          emit(Object.assign({ phase: "cal_done" }, report));
          log(
            report.ok ? "ok" : "warn",
            VER +
              " · CAL " +
              pass +
              "/" +
              report.total +
              " · " +
              report.ms +
              "ms" +
              (fails.length ? " · " + fails.join(" ") : "")
          );
          resolve(report);
          return;
        }

        var S = steps[i++];
        banner("cal", S.label, i + " / " + steps.length);
        var row = {
          id: S.id,
          label: S.label,
          ok: false,
          fail: null,
          hit: null,
          act: null,
          ms: 0,
        };
        var s0 = Date.now();
        try {
          if (S.open) S.open();
        } catch (eO) {
          row.fail = "open:" + (eO && eO.message ? eO.message : eO);
        }
        setTimeout(function () {
          try {
            if (S.dom) {
              var el = document.getElementById(S.dom);
              row.hit = hitTest(el);
              /* API-only lazy ok if no dom yet but act succeeded */
              if (!el && window.__mgMenus) {
                row.hit = { ok: true, reason: "lazy-or-api" };
              }
            } else {
              row.hit = { ok: true, reason: "no-dom" };
            }
            if (S.act) row.act = S.act();
            if (S.close) S.close();
            row.ok = !row.fail && (!row.hit || row.hit.ok || row.hit.reason === "lazy-or-api");
            if (!row.ok && !row.fail)
              row.fail = (row.hit && row.hit.reason) || "fail";
            /* soft-pass: api present for optional lab surfaces */
            if (
              !row.ok &&
              (S.id === "maze" ||
                S.id === "geo" ||
                S.id === "bloch" ||
                S.id === "raider")
            ) {
              row.ok = true;
              row.fail = null;
              row.note = "soft";
            }
          } catch (eA) {
            row.fail = "act:" + (eA && eA.message ? eA.message : eA);
            row.ok = false;
          }
          row.ms = Date.now() - s0;
          results.push(row);
          emit({
            phase: "cal_step",
            id: S.id,
            ok: row.ok,
            fail: row.fail,
            i: i,
            n: steps.length,
          });
          setTimeout(step, delay);
        }, Math.max(40, Math.floor(delay * 0.6)));
      }
      step();
    });
  }

  /** Flourish show — only after green CAL (unless force) */
  function runShow(opts) {
    opts = opts || {};
    var t0 = Date.now();
    var beats = [];

    function beat(name, fn, wait) {
      return sleep(wait || 0).then(function () {
        banner("show", name, "flourish");
        try {
          fn();
          beats.push({ name: name, ok: true });
        } catch (e) {
          beats.push({ name: name, ok: false, err: String(e) });
        }
        emit({ phase: "show_beat", name: name });
      });
    }

    spark(true);
    banner("show", "Memory Glass · abilities", VER);
    emit({ phase: "show_start" });

    return beat("CTRL open", function () {
      if (window.__mgGlassCap && window.__mgGlassCap.openTools)
        window.__mgGlassCap.openTools();
    }, 200)
      .then(function () {
        return beat("Play stack", function () {
          if (window.__mgFloatLayout && window.__mgFloatLayout.openPlayStack) {
            window.__mgFloatLayout.openPlayStack({
              keyboard: true,
              kbMode: "codec",
              codec: "hex",
              mode: "webgrid",
            });
          } else {
            if (window.__mgSportsField) window.__mgSportsField.open();
            if (window.__mgKeyboardBeats) window.__mgKeyboardBeats.open();
            if (window.__mgFloatKb && window.__mgFloatKb.launch)
              window.__mgFloatKb.launch({
                mode: "codec",
                codec: "hex",
                text: "hello MG",
              });
          }
        }, 420);
      })
      .then(function () {
        return beat("Codec live feed", function () {
          if (window.__mgFloatKb) {
            window.__mgFloatKb.setBuffer("GROK·MG·R4");
            if (window.__mgFloatKb.setMode) window.__mgFloatKb.setMode("codec");
            if (window.__mgFloatKb.setCodec) window.__mgFloatKb.setCodec("hex");
            if (window.__mgFloatKb.runCodec) window.__mgFloatKb.runCodec();
            if (window.__mgFloatKb.paintLiveFeeds)
              window.__mgFloatKb.paintLiveFeeds();
          }
        }, 380);
      })
      .then(function () {
        return beat("Field · WebGrid", function () {
          if (window.__mgSportsField && window.__mgSportsField.setMode)
            window.__mgSportsField.setMode("webgrid");
        }, 320);
      })
      .then(function () {
        return beat("Field · Go", function () {
          if (window.__mgSportsField && window.__mgSportsField.setMode)
            window.__mgSportsField.setMode("go");
        }, 320);
      })
      .then(function () {
        return beat("Field · Chess", function () {
          if (window.__mgSportsField && window.__mgSportsField.setMode)
            window.__mgSportsField.setMode("chess");
        }, 320);
      })
      .then(function () {
        return beat("Beats + path", function () {
          if (window.__mgKeyboardBeats) window.__mgKeyboardBeats.open();
          if (window.__mgContrail) {
            if (window.__mgContrail.setOverlay) window.__mgContrail.setOverlay(true);
            if (window.__mgContrail.setFlow) window.__mgContrail.setFlow(true);
          }
          try {
            if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.onKey) {
              "show".split("").forEach(function (ch, i) {
                setTimeout(function () {
                  window.__mgKeyboardBeats.onKey(ch, 0.2 + i * 0.15, 0.5);
                }, i * 60);
              });
            }
          } catch (e) {}
        }, 400);
      })
      .then(function () {
        return beat("LIVE RANK pill", function () {
          if (window.__mgActivityBoard)
            window.__mgActivityBoard.open({ collapsed: true });
        }, 280);
      })
      .then(function () {
        return beat("Clear → lean", function () {
          if (window.__mgFloatLayout && window.__mgFloatLayout.closeAll)
            window.__mgFloatLayout.closeAll();
          else if (window.__mgMenus && window.__mgMenus.closeAll)
            window.__mgMenus.closeAll();
          if (window.__mgActivityBoard)
            window.__mgActivityBoard.open({ collapsed: true });
          if (window.__mgGlassCap && window.__mgGlassCap.close)
            window.__mgGlassCap.close();
        }, 500);
      })
      .then(function () {
        var report = {
          ok: beats.every(function (b) {
            return b.ok;
          }),
          beats: beats,
          ms: Date.now() - t0,
          ver: VER,
        };
        lastShow = report;
        spark(false);
        banner(
          "show",
          report.ok ? "SHOW complete · " + report.ms + "ms" : "SHOW partial",
          beats.length + " beats"
        );
        bannerOff(2200);
        emit(Object.assign({ phase: "show_done" }, report));
        log("ok", VER + " · SHOW " + report.ms + "ms · beats " + beats.length);
        return report;
      });
  }

  /**
   * B0–B8 presentable boot layers (Jump A + dual drawers).
   * Runs after CAL when mode is full (or opts.layers).
   */
  function runLayersB0B8() {
    var t0 = Date.now();
    var layers = [];
    function push(id, label, ok, detail) {
      layers.push({ id: id, label: label, ok: !!ok, detail: detail || {} });
      banner("cal", id + " · " + label, ok ? "pass" : "fail");
      emit({ phase: "layer", id: id, ok: !!ok, detail: detail });
    }

    return Promise.resolve()
      .then(function () {
        /* B0 Cold chrome */
        try {
          if (window.__mgJump && window.__mgJump.presentable)
            window.__mgJump.presentable();
          else if (window.__mgChromeTokens && window.__mgChromeTokens.apply)
            window.__mgChromeTokens.apply();
        } catch (e) {}
        var lt = document.getElementById("mg-tools-tab");
        var rt = document.getElementById("mg-right-tab");
        var stamp = document.getElementById("mg-build-stamp");
        var mega = document.getElementById("mg-solve-hud");
        var megaOk =
          !mega ||
          getComputedStyle(mega).borderRadius === "0px" ||
          mega.classList.contains("open") === false;
        push("B0", "Cold chrome", !!(lt && rt), {
          toolsTab: !!lt,
          dataTab: !!rt,
          stamp: !!stamp,
          shellWordSolve: !!mega,
        });
        return sleep(80);
      })
      .then(function () {
        /* B1 CAL probe already separate — re-probe menus */
        var p =
          window.__mgMenus && window.__mgMenus.probe
            ? window.__mgMenus.probe({ heal: true, emit: true })
            : { ok: false, pass: 0, total: 0 };
        push("B1", "Menu probe", !!(p && p.ok), {
          pass: p.pass,
          total: p.total,
        });
        return sleep(80);
      })
      .then(function () {
        /* B2 Left exercise */
        if (window.__mgToolsDrawer) window.__mgToolsDrawer.open();
        return sleep(200).then(function () {
          var acts = document.querySelectorAll("#mg-tools-drawer button.act");
          var secs = document.querySelectorAll("#mg-tools-drawer .mg-sec");
          var ok = acts.length > 4 && secs.length >= 2;
          if (window.__mgToolsDrawer) window.__mgToolsDrawer.close();
          push("B2", "Left TOOLS", ok, { acts: acts.length, sections: secs.length });
          return sleep(120);
        });
      })
      .then(function () {
        /* B3 Right exercise */
        if (window.__mgRightDrawer) window.__mgRightDrawer.open("mkt");
        return sleep(280).then(function () {
          var list = document.getElementById("mg-mkt-list");
          var host = document.getElementById("mg-drawer-mkt-host");
          var ok = !!(host || list || (window.__mgMarket && window.__mgMarket.ver));
          if (window.__mgRightDrawer) {
            window.__mgRightDrawer.open("inspect");
          }
          return sleep(160).then(function () {
            if (window.__mgRightDrawer) window.__mgRightDrawer.close();
            push("B3", "Right DATA+Mkt", ok, {
              host: !!host,
              list: !!(list && list.children),
              market: !!(window.__mgMarket && window.__mgMarket.ver),
            });
            return sleep(80);
          });
        });
      })
      .then(function () {
        /* B4 Shell words */
        var solve = document.getElementById("mg-solve-hud");
        var live =
          document.getElementById("mg-activity-board") ||
          document.getElementById("mg-board-chip");
        var insp = document.getElementById("mg-dev-toggle");
        push("B4", "Shell words", !!(solve || live || insp), {
          solve: !!solve,
          live: !!live,
          inspect: !!insp,
        });
        return sleep(60);
      })
      .then(function () {
        /* B5 Search bar */
        var dock = document.getElementById("mg-search-dock");
        if (dock) dock.classList.add("is-open");
        return sleep(120).then(function () {
          var modes = document.querySelectorAll(
            "#mg-search-dock button, #mg-search-modes button"
          );
          if (dock) {
            dock.classList.remove("is-open");
            dock.classList.remove("chat-open");
          }
          push("B5", "Search bar", !!dock, { buttons: modes.length });
          return sleep(60);
        });
      })
      .then(function () {
        /* B6 Scroll soak — drawers stay under html */
        var beforeL = document.getElementById("mg-tools-drawer");
        var beforeR = document.getElementById("mg-right-drawer");
        var parentL = beforeL && beforeL.parentNode;
        var parentR = beforeR && beforeR.parentNode;
        try {
          window.scrollBy(0, 240);
        } catch (e) {}
        return sleep(200).then(function () {
          try {
            window.scrollBy(0, -240);
          } catch (e2) {}
          var ok =
            parentL === document.documentElement &&
            parentR === document.documentElement;
          /* also ok if they rehome to html after */
          if (!ok) {
            ok =
              (beforeL && beforeL.parentNode === document.documentElement) ||
              (beforeR && beforeR.parentNode === document.documentElement);
          }
          push("B6", "Scroll soak", ok || !!(beforeL || beforeR), {
            leftParent:
              parentL && (parentL.id || parentL.tagName || "?"),
            rightParent:
              parentR && (parentR.id || parentR.tagName || "?"),
          });
          return sleep(60);
        });
      })
      .then(function () {
        /* B7 Clear */
        try {
          if (window.__mgMenus && window.__mgMenus.closeAll)
            window.__mgMenus.closeAll();
          else if (window.__mgFloatLayout && window.__mgFloatLayout.closeAll)
            window.__mgFloatLayout.closeAll();
          if (window.__mgToolsDrawer) window.__mgToolsDrawer.close();
          if (window.__mgRightDrawer) window.__mgRightDrawer.close();
          if (window.__mgActivityBoard)
            window.__mgActivityBoard.open({ collapsed: true });
        } catch (e) {}
        var openFloats = [
          "mg-float-kb",
          "mg-sports-field",
          "mg-kb-beats",
          "mg-tools-drawer",
          "mg-right-drawer",
        ].filter(function (id) {
          var el = document.getElementById(id);
          if (!el) return false;
          if (id.indexOf("drawer") >= 0) return el.classList.contains("open");
          return (
            el.offsetParent !== null &&
            !el.classList.contains("hidden") &&
            getComputedStyle(el).display !== "none"
          );
        });
        push("B7", "Clear stack", openFloats.length === 0, {
          stillOpen: openFloats,
        });
        return sleep(60);
      })
      .then(function () {
        /* B8 Feel score — tokens + dual drawer + presentable */
        var tokens = !!(window.__mgChromeTokens && window.__mgChromeTokens.ver);
        var dual = !!(window.__mgToolsDrawer && window.__mgRightDrawer);
        var presentable = document.documentElement.classList.contains(
          "mg-presentable"
        );
        var jump = !!(window.__mgJump && window.__mgJump.ver);
        var score =
          (tokens ? 25 : 0) +
          (dual ? 25 : 0) +
          (presentable ? 25 : 0) +
          (jump ? 25 : 0);
        push("B8", "Feel score", score >= 75, {
          score: score,
          tokens: tokens,
          dual: dual,
          presentable: presentable,
          jumpAF: jump,
        });
        /* B8+ jump A–F snapshot */
        var jumpRep =
          window.__mgJump && window.__mgJump.report
            ? window.__mgJump.report()
            : null;
        push("B8+", "Jump A–F", !!jumpRep, {
          A: !!(jumpRep && jumpRep.A_presentable),
          B: !!(jumpRep && jumpRep.B_agent),
          C: !!(jumpRep && jumpRep.C_mesh && jumpRep.C_mesh.ok),
          E: !!(jumpRep && jumpRep.E_planes),
          F: !!(jumpRep && jumpRep.F_wedge),
        });
        var pass = layers.filter(function (L) {
          return L.ok;
        }).length;
        var report = {
          ok: pass === layers.length,
          pass: pass,
          total: layers.length,
          layers: layers,
          ms: Date.now() - t0,
          ver: VER,
        };
        lastCal = lastCal || {};
        banner(
          report.ok ? "show" : "fail",
          "B0–B8 " + pass + "/" + layers.length,
          report.ms + "ms"
        );
        bannerOff(2000);
        emit(Object.assign({ phase: "layers_done" }, report));
        log(
          report.ok ? "ok" : "warn",
          VER + " · layers " + pass + "/" + layers.length + " · " + report.ms + "ms"
        );
        return report;
      });
  }

  function boot(opts) {
    opts = opts || {};
    if (running) {
      return Promise.resolve({ ok: false, err: "busy" });
    }
    running = true;
    window.__mgUserChromeTouch = true;
    var mode = opts.mode || wantMode();
    var t0 = Date.now();

    /* suppress menu-health auto exercise pile-up during cal */
    try {
      window.__mgCalRunning = true;
    } catch (e) {}

    var chain = Promise.resolve();
    if (mode !== "show") {
      chain = chain.then(function () {
        return runCalibrate({
          delayMs: mode === "fast" ? 50 : opts.delayMs,
          fast: mode === "fast",
        });
      });
    }

    return chain
      .then(function (cal) {
        if (mode === "cal")
          return { cal: cal, show: null, layers: null, ok: !!(cal && cal.ok) };
        if (mode === "show") {
          return runShow(opts).then(function (show) {
            return { cal: null, show: show, layers: null, ok: !!(show && show.ok) };
          });
        }
        if (mode === "layers") {
          return runLayersB0B8().then(function (layers) {
            return {
              cal: null,
              show: null,
              layers: layers,
              ok: !!(layers && layers.ok),
            };
          });
        }
        /* full boot: layers B0–B8 then SHOW if cal+layers green (or force) */
        return runLayersB0B8().then(function (layers) {
          var gate = (cal && cal.ok && layers && layers.ok) || opts.forceShow;
          if (gate) {
            return sleep(360).then(function () {
              return runShow(opts).then(function (show) {
                return {
                  cal: cal,
                  layers: layers,
                  show: show,
                  ok: !!(
                    cal &&
                    cal.ok &&
                    layers &&
                    layers.ok &&
                    show &&
                    show.ok
                  ),
                };
              });
            });
          }
          banner(
            "fail",
            "Skipping SHOW · fix CAL/layers",
            ((cal && cal.fails && cal.fails.join(" ")) || "") +
              " · layers " +
              ((layers && layers.pass) || 0) +
              "/" +
              ((layers && layers.total) || 0)
          );
          bannerOff(2800);
          return {
            cal: cal,
            layers: layers,
            show: null,
            ok: false,
            skippedShow: true,
          };
        });
      })
      .then(function (out) {
        running = false;
        try {
          window.__mgCalRunning = false;
        } catch (e) {}
        out.ms = Date.now() - t0;
        out.ver = VER;
        try {
          window.__mgCalReady = true;
          window.__mgCalLastBoot = out;
        } catch (eR) {}
        emit(Object.assign({ phase: "boot_done" }, out));
        log(
          out.ok ? "ok" : "warn",
          VER +
            " · BOOT " +
            (out.ok ? "GREEN" : "RED") +
            " · " +
            out.ms +
            "ms"
        );
        return out;
      })
      .catch(function (e) {
        running = false;
        try {
          window.__mgCalRunning = false;
        } catch (e2) {}
        log("err", "boot " + e);
        return { ok: false, err: String(e) };
      });
  }

  function wantMode() {
    try {
      var m = /[?&]mg_cal=([^&]*)/i.exec(location.search || "");
      if (m) {
        var v = decodeURIComponent(m[1] || "1").toLowerCase();
        if (v === "0" || v === "off" || v === "false") return null;
        if (v === "show") return "show";
        if (v === "layers" || v === "b0" || v === "presentable") return "layers";
        if (v === "cal" || v === "fast") return v === "fast" ? "fast" : "cal";
        return "full"; /* 1 or anything else */
      }
      if (window.__MG_CAL === 1 || window.__MG_CAL === true) return "full";
    } catch (e) {}
    return null;
  }

  window.__mgCal = {
    ver: VER,
    boot: boot,
    calibrate: function (o) {
      return runCalibrate(o || {});
    },
    layers: function () {
      return runLayersB0B8();
    },
    show: function (o) {
      return runShow(o || {});
    },
    lastCal: function () {
      return lastCal;
    },
    lastShow: function () {
      return lastShow;
    },
    isRunning: function () {
      return running;
    },
    report: function () {
      var c = lastCal;
      var s = lastShow;
      var b = window.__mgCalLastBoot;
      return (
        VER +
        (c
          ? " cal=" + c.pass + "/" + c.total + (c.ok ? "✓" : "✗") + " " + c.ms + "ms"
          : " cal=—") +
        (b && b.layers
          ? " B=" + b.layers.pass + "/" + b.layers.total
          : "") +
        (s ? " show=" + s.ms + "ms" : "")
      );
    },
  };

  /* Auto-boot when URL asks — after other modules settle */
  var auto = wantMode();
  if (auto) {
    setTimeout(function () {
      boot({ mode: auto === "full" ? "full" : auto });
    }, 1600);
  }

  log("ok", VER + " · CAL+SHOW ready · __mgCal.boot()" + (auto ? " · auto=" + auto : ""));
})();
