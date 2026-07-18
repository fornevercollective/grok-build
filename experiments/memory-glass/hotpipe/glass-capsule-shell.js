/* Memory Glass · unified Dragon glass capsule
 * One floating glass-morphism panel (inspect-style) — modes never stack as full rails.
 * VER: glass-capsule-v1
 */
(function () {
  "use strict";
  var VER = "glass-capsule-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._glassCapVer === VER) return;
  HP._glassCapVer = VER;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "glass-cap");
    } catch (e) {}
  }

  var mode = "tools";
  var collapsed = false;
  var el, body, statusEl;

  var MODES = [
    { id: "tools", label: "TOOLS" },
    { id: "qbit", label: "QBIT" },
    { id: "lark", label: "LARK" },
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
        act("CONTRAIL", "ok", function () {
          if (window.__mgContrail) {
            window.__mgContrail.setFlow(true);
            setStatus(window.__mgContrail.report());
          } else setStatus("contrail on WebGrid only");
        })
      );
      row.appendChild(
        act("BEATS→", "", function () {
          if (window.__mgContrail && window.__mgContrail.exportStoryBeats) {
            var b = window.__mgContrail.exportStoryBeats();
            var t = JSON.stringify(b, null, 2);
            if (window.ipc)
              window.ipc.postMessage(JSON.stringify({ op: "clipboard_copy", text: t }));
            else if (navigator.clipboard) navigator.clipboard.writeText(t);
            setStatus("beats " + ((b.beats && b.beats.length) || 0));
          } else setStatus("no beats");
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
        act("DOJO", "", function () {
          var u = "https://kbatch.ugrad.ai/dojo/";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          else window.open(u, "_blank");
        })
      );
      row.appendChild(
        act("BLANK KB", "", function () {
          var u = "https://fornevercollective.github.io/blank/";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
          else window.open(u, "_blank");
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
    } else if (mode === "lark") {
      hint.textContent = "Lark governance · unix/epoch/hops · fleet policy (glass).";
      row.appendChild(
        act("TICK", "ok", function () {
          if (window.__mgLark) window.__mgLark.tick();
          setStatus(window.__mgLark ? window.__mgLark.report() : "?");
        })
      );
      row.appendChild(
        act("EXPORT", "", function () {
          if (window.__mgLark) window.__mgLark.exportSnapshot();
          setStatus("exported");
        })
      );
      row.appendChild(
        act("FLEET", "hot", function () {
          var u = "https://github.com/fornevercollective";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
        })
      );
      if (window.__mgLark && window.__mgLark.layers) {
        window.__mgLark.layers.forEach(function (L) {
          var card = document.createElement("div");
          card.className =
            "mg-cap-card" +
            (window.__mgLark.state.focusLayer === L.id ? " on" : "");
          card.innerHTML =
            "<div>" +
            L.label +
            ' <span style="opacity:0.5">h' +
            L.hops +
            "</span></div><div class=\"sub\">" +
            (L.tools || []).slice(0, 4).join(" · ") +
            "</div>";
          card.onclick = function () {
            window.__mgLark.state.focusLayer = L.id;
            paint();
          };
          body.appendChild(hint);
          body.appendChild(row);
          body.appendChild(card);
        });
        setStatus(window.__mgLark.report());
        measure();
        return;
      }
    } else if (mode === "mkt") {
      hint.textContent = "Market filmstrip · iron condor · no auto-trade.";
      row.appendChild(
        act("LOAD", "ok", function () {
          if (window.__mgMarket) {
            window.__mgMarket.loadBoard(window.__mgFilmstripBoard || window.__mgMarket.state.rows);
            setStatus(window.__mgMarket.report());
          } else setStatus("no market");
        })
      );
      row.appendChild(
        act("FILE", "", function () {
          if (window.ipc)
            window.ipc.postMessage(JSON.stringify({ op: "load_filmstrip" }));
          setStatus("filmstrip reload");
        })
      );
      row.appendChild(
        act("GRAPH", "primary", function () {
          if (window.__mgMarket) {
            window.__mgMarket.state.viewMode =
              window.__mgMarket.state.viewMode === "graph" ? "list" : "graph";
            setStatus("graph " + window.__mgMarket.state.viewMode);
          }
        })
      );
      row.appendChild(
        act("HIT IN", "hot", function () {
          if (window.__mgMarket && window.__mgMarket.state.focus)
            window.__mgMarket.scoreCondorTrial(window.__mgMarket.state.focus, "in");
          setStatus(window.__mgMarket ? window.__mgMarket.report() : "?");
        })
      );
      row.appendChild(
        act("OPEN RAIL", "", function () {
          var r = document.getElementById("mg-mkt-rail");
          if (r) {
            r.style.display = "flex";
            if (window.__mgMarket) window.__mgMarket.open();
          }
          setStatus("mkt rail");
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
        "Living books · LOC/PD · contrail beats → kids creator (Ants/kbatch).";
      row.appendChild(
        act("LAB", "ok", function () {
          var u =
            "file:///Volumes/qbitOS/00.dev/projects/KBatch-dictionary/labs/living-books.html";
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
        act("KBATCH", "", function () {
          var u = "https://kbatch.ugrad.ai/learn";
          if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: u }));
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
    setInterval(measure, 2000);
    log(VER + " · glass morphism capsule (no stacked rails)");
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
