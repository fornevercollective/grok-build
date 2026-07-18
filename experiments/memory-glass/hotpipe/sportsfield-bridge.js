/* Memory Glass · sportsfield + train predictions bridge
 * Thin float: mueee sports-field lab + fornevercollective/train predictions.
 * Educational / lab telemetry — not a broker, not auto-trading.
 * VER: sportsfield-bridge-v1
 */
(function () {
  "use strict";
  var VER = "sportsfield-bridge-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._sportsFieldVer === VER) return;
  HP._sportsFieldVer = VER;
  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "field");
    } catch (e) {}
  }

  var LINKS = {
    field: "https://mueee.qbitos.ai/sports-field-ugrad.html",
    hub: "https://mueee.qbitos.ai/games-ugrad-hub.html",
    trainRepo: "https://github.com/fornevercollective/train",
    trainPages: "https://fornevercollective.github.io/train/",
    predictions: "https://fornevercollective.github.io/train/predictions/",
    webgrid: "https://neuralink.com/webgrid/",
  };

  var panel = null;
  var open = false;
  var ticker = null;

  function nav(url) {
    try {
      if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
      else window.open(url, "_blank");
    } catch (e) {
      try {
        window.open(url, "_blank");
      } catch (e2) {}
    }
  }

  function liveLine() {
    var parts = [];
    try {
      if (window.__mgActivityBoard && window.__mgActivityBoard.predict) {
        var p = window.__mgActivityBoard.predict();
        parts.push(
          "rank live " +
            fmt(p.liveScore) +
            " · pred BPS " +
            (p.predBps != null ? fmt(p.predBps) : "—") +
            " · ELO≈" +
            p.eloHint +
            " · P(top) " +
            p.winTopPct +
            "%"
        );
        parts.push(p.form || "");
      }
    } catch (e) {}
    try {
      if (window.__mgWebgridCalib && window.__mgWebgridCalib.scrapeScore) {
        var sc = window.__mgWebgridCalib.scrapeScore();
        if (sc.bps != null || (sc.peak && sc.peak.bps != null))
          parts.push(
            "WebGrid " +
              (sc.peak && sc.peak.bps != null ? sc.peak.bps : sc.bps) +
              " BPS · " +
              (sc.peak && sc.peak.ntpm != null ? sc.peak.ntpm : sc.ntpm) +
              " NTPM"
          );
      }
    } catch (e2) {}
    try {
      if (window.__mgMesh) parts.push(window.__mgMesh.report());
    } catch (e3) {}
    return parts.filter(Boolean).join(" · ") || "idle · open FIELD lab or play WebGrid";
  }

  function fmt(n) {
    if (n == null || !isFinite(n)) return "—";
    if (Math.abs(n) >= 100) return String(Math.round(n));
    return (Math.round(n * 100) / 100).toString();
  }

  function ensureCss() {
    if (document.getElementById("mg-field-css")) return;
    var st = document.createElement("style");
    st.id = "mg-field-css";
    st.textContent = [
      "#mg-sports-field{position:fixed;right:12px;bottom:calc(140px + var(--mg-kb-h,0px));",
      "  z-index:2147482991;width:min(280px,34vw);border-radius:12px;overflow:hidden;",
      "  background:rgba(8,14,10,0.55);backdrop-filter:blur(22px) saturate(1.35);",
      "  -webkit-backdrop-filter:blur(22px) saturate(1.35);",
      "  border:1px solid rgba(120,220,160,0.28);",
      "  box-shadow:0 8px 24px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.08);",
      "  font:650 9px/1.25 system-ui;color:rgba(230,245,235,0.94);pointer-events:auto}",
      "#mg-sports-field.hidden{display:none}",
      "#mg-sports-field .hd{display:flex;justify-content:space-between;padding:6px 8px;",
      "  letter-spacing:0.1em;text-transform:uppercase;color:rgba(120,230,170,0.95);",
      "  border-bottom:1px solid rgba(255,255,255,0.1)}",
      "#mg-sports-field .hd button{appearance:none;background:0;border:0;color:inherit;cursor:pointer;font:700 11px/1 system-ui}",
      "#mg-sports-field .bd{padding:8px}",
      "#mg-sports-field .pitch{height:56px;border-radius:8px;margin-bottom:8px;",
      "  background:linear-gradient(180deg,rgba(40,120,60,0.35),rgba(20,50,30,0.5));",
      "  border:1px solid rgba(100,200,140,0.25);position:relative;overflow:hidden}",
      "#mg-sports-field .pitch::before{content:'';position:absolute;inset:8px;border:1px solid rgba(255,255,255,0.15);border-radius:4px}",
      "#mg-sports-field .pitch::after{content:'';position:absolute;left:50%;top:8px;bottom:8px;width:1px;background:rgba(255,255,255,0.12)}",
      "#mg-sports-field .tick{font:500 8px/1.35 ui-monospace,Menlo,monospace;color:rgba(180,230,200,0.9);",
      "  min-height:2.6em;margin-bottom:8px}",
      "#mg-sports-field .row{display:flex;flex-wrap:wrap;gap:4px}",
      "#mg-sports-field .row button{appearance:none;cursor:pointer;padding:5px 8px;border-radius:999px;",
      "  font:700 8px/1 system-ui;letter-spacing:0.05em;color:rgba(240,255,245,0.95);",
      "  background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14)}",
      "#mg-sports-field .row button.hot{background:rgba(60,180,100,0.25);border-color:rgba(100,220,140,0.45)}",
      "#mg-sports-field .note{margin-top:8px;font:500 7px/1.3 system-ui;color:rgba(160,190,170,0.75)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function ensurePanel() {
    if (panel) return;
    ensureCss();
    panel = document.createElement("div");
    panel.id = "mg-sports-field";
    panel.className = open ? "" : "hidden";
    panel.innerHTML =
      '<div class="hd"><span>Field · train · preds</span>' +
      '<button type="button" id="mg-field-x">×</button></div>' +
      '<div class="bd">' +
      '<div class="pitch" title="sports-field lab"></div>' +
      '<div class="tick" id="mg-field-tick">…</div>' +
      '<div class="row">' +
      '<button type="button" class="hot" id="mg-field-open">SPORTS FIELD</button>' +
      '<button type="button" id="mg-field-pred">TRAIN PREDS</button>' +
      '<button type="button" id="mg-field-hub">GAMES HUB</button>' +
      '<button type="button" id="mg-field-board">LIVE RANK</button>' +
      '<button type="button" id="mg-field-repo">TRAIN ↗</button>' +
      "</div>" +
      '<div class="note">Educational lab · brackets/hexbin/wind topology via train + mueee · no auto-trade · no auto-X</div>' +
      "</div>";
    (document.body || document.documentElement).appendChild(panel);
    panel.querySelector("#mg-field-x").onclick = close;
    panel.querySelector("#mg-field-open").onclick = function () {
      nav(LINKS.field);
    };
    panel.querySelector("#mg-field-pred").onclick = function () {
      nav(LINKS.predictions);
    };
    panel.querySelector("#mg-field-hub").onclick = function () {
      nav(LINKS.hub);
    };
    panel.querySelector("#mg-field-board").onclick = function () {
      if (window.__mgActivityBoard) window.__mgActivityBoard.open();
    };
    panel.querySelector("#mg-field-repo").onclick = function () {
      nav(LINKS.trainRepo);
    };
  }

  function paint() {
    if (!open || !panel) return;
    var el = panel.querySelector("#mg-field-tick");
    if (el) el.textContent = liveLine();
  }

  function openPanel() {
    open = true;
    ensurePanel();
    panel.classList.remove("hidden");
    paint();
    if (!ticker)
      ticker = setInterval(function () {
        if (open) paint();
      }, 1000);
  }

  function close() {
    open = false;
    if (panel) panel.classList.add("hidden");
  }

  function toggle() {
    if (open) close();
    else openPanel();
  }

  window.__mgSportsField = {
    ver: VER,
    links: LINKS,
    open: openPanel,
    close: close,
    toggle: toggle,
    isOpen: function () {
      return open;
    },
    report: function () {
      return VER + " open=" + open + " · " + liveLine().slice(0, 60);
    },
  };
  log(VER + " · sportsfield + train predictions bridge");
})();
