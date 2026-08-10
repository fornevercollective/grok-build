/* Memory Glass · /web inspect
 * Multi-browser inspect & learn surface for grok-build / xai-grok-build.
 * MG native inspect + matrix of Safari/Chrome/Firefox/Arc/Orion/Edge DevTools.
 * Field triggers (zombie downloads, paste garbage) → product patches (job-hygiene).
 * VER: web-inspect-v1
 *
 * API: window.__mgWebInspect
 * Commands (Grok term): /web  /web inspect  /web browsers  /web learn  /web hygiene  /inspect
 */
(function () {
  "use strict";
  var VER = "web-inspect-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._webInspectVer === VER) return;
  HP._webInspectVer = VER;

  try {
    if (document.getElementById("pip-wrap")) {
      /* still register API on inspect surface for dual-desk */
    }
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "web-inspect");
    } catch (e) {}
  }

  function need(key, cb) {
    try {
      if (window.__mgLazy && window.__mgLazy.need) {
        window.__mgLazy.need(key, cb || function () {});
        return true;
      }
    } catch (e) {}
    try {
      if (window.ipc && window.ipc.postMessage) {
        var file =
          key === "hygiene" || key === "jobHygiene"
            ? "job-hygiene.js"
            : key === "webInspect"
              ? "web-inspect.js"
              : null;
        if (file) {
          window.ipc.postMessage(
            JSON.stringify({ op: "hot_module", name: file, t: Date.now() })
          );
        }
      }
    } catch (e2) {}
    if (cb) setTimeout(function () { cb(!!window.__mgJobHygiene); }, 120);
    return false;
  }

  /** Market browsers — how to open inspect / what MG learns from each */
  var BROWSERS = [
    {
      id: "memory-glass",
      name: "Memory Glass",
      engine: "WebKit (WKWebView)",
      inspect: "Dual inspect float · dock PIPE/IRON · meters RAM/GPU/Spool/FPS · packs hotpipe/out",
      keys: "Inspect window + dock tabs · __mgWebInspect.open()",
      strength: "Job hygiene · hot-pipe · spatial HUD · field-trigger loop",
      ours: true,
    },
    {
      id: "safari",
      name: "Safari",
      engine: "WebKit",
      inspect: "Develop menu → Show Web Inspector (enable Develop in Settings → Advanced)",
      keys: "⌥⌘I · Develop → Enter Responsive Design · Timelines",
      strength: "OS integrate · efficiency — weak: zombie download UI (we patch)",
      fieldNote: "Preparing forever + filename * + cancel dead → MG job-hygiene",
      ours: false,
    },
    {
      id: "chrome",
      name: "Chrome",
      engine: "Blink",
      inspect: "View → Developer → Developer Tools",
      keys: "⌥⌘I · ⌥⌘J console · ⌘⇧P command palette",
      strength: "DevTools depth · Performance · Coverage",
      ours: false,
    },
    {
      id: "edge",
      name: "Edge",
      engine: "Blink",
      inspect: "Same as Chromium DevTools",
      keys: "⌥⌘I",
      strength: "Chromium tools + enterprise",
      ours: false,
    },
    {
      id: "firefox",
      name: "Firefox",
      engine: "Gecko",
      inspect: "Tools → Browser Tools → Web Developer Tools",
      keys: "⌥⌘I · about:debugging for multi-process",
      strength: "Privacy · multiproc visibility",
      ours: false,
    },
    {
      id: "arc",
      name: "Arc",
      engine: "Chromium",
      inspect: "Chromium DevTools (right-click Inspect)",
      keys: "⌥⌘I",
      strength: "UX chrome — still inherits download manager class bugs",
      ours: false,
    },
    {
      id: "orion",
      name: "Orion",
      engine: "WebKit",
      inspect: "WebKit inspector (Develop)",
      keys: "⌥⌘I when Develop enabled",
      strength: "WebKit + extensions — compare hygiene vs Safari",
      ours: false,
    },
    {
      id: "ladybird",
      name: "Ladybird",
      engine: "LibWeb (from scratch)",
      inspect: "Engine-native / early tooling",
      keys: "project-dependent",
      strength: "Architecture purity — inspiration only",
      ours: false,
    },
  ];

  var fieldLog = [];
  var panel = null;
  var openState = false;

  function onFieldTrigger(finding) {
    fieldLog.push(
      Object.assign({ at: Date.now() }, finding || {})
    );
    if (fieldLog.length > 100) fieldLog = fieldLog.slice(-80);
    try {
      paintField();
    } catch (e) {}
  }

  function ensureHygiene(cb) {
    if (window.__mgJobHygiene) {
      try {
        window.__mgJobHygiene.arm();
      } catch (e) {}
      if (cb) cb(true);
      return;
    }
    need("hygiene", function () {
      if (window.__mgJobHygiene) {
        try {
          window.__mgJobHygiene.arm();
        } catch (e2) {}
      }
      if (cb) cb(!!window.__mgJobHygiene);
    });
  }

  function snapshot() {
    var hy = null;
    try {
      hy = window.__mgJobHygiene ? window.__mgJobHygiene.status() : null;
    } catch (e) {}
    var meters = null;
    try {
      meters = {
        product: !!window.__mgProductMode,
        sourceRev: window.__MG_SOURCE_REV || null,
        lazy: !!(window.__mgLazy && window.__mgLazy.ver),
        dock: !!(window.__mgDock || document.getElementById("mg-dock")),
        iron: !!(window.__mgIronline || window.__mgIron),
      };
    } catch (e2) {}
    return {
      ver: VER,
      href: (typeof location !== "undefined" && location.href) || "",
      ua: (typeof navigator !== "undefined" && navigator.userAgent) || "",
      hygiene: hy,
      meters: meters,
      fieldTriggers: fieldLog.slice(-20),
      browsers: BROWSERS.map(function (b) {
        return { id: b.id, name: b.name, engine: b.engine, ours: !!b.ours };
      }),
      ts: Date.now(),
    };
  }

  function exportPack() {
    var snap = snapshot();
    var md =
      "# Memory Glass · /web inspect pack\n\n" +
      "- time: " +
      new Date().toISOString() +
      "\n" +
      "- href: " +
      snap.href +
      "\n" +
      "- ver: " +
      VER +
      "\n\n" +
      "## Advantage\n" +
      "Job hygiene: no zombie Preparing · cancel always · reject `*` filenames.\n" +
      "Field triggers become product patches (iterate random browser bugs → MG strengths).\n\n" +
      "## Snapshot\n```json\n" +
      JSON.stringify(snap, null, 2) +
      "\n```\n\n" +
      "## Browser matrix (open inspect)\n" +
      BROWSERS.map(function (b) {
        return (
          "### " +
          b.name +
          " (" +
          b.engine +
          ")\n" +
          "- Inspect: " +
          b.inspect +
          "\n" +
          "- Keys: " +
          b.keys +
          "\n" +
          "- Note: " +
          (b.fieldNote || b.strength) +
          "\n"
        );
      }).join("\n") +
      "\n## Ask Grok Build\n" +
      "Use this pack to speed MG soak, compare peer browsers, and turn next field glitch into a trigger → patch.\n";
    try {
      var blob = new Blob([md], { type: "text/markdown" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "mg-web-inspect-" + Date.now() + ".md";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        try {
          URL.revokeObjectURL(a.href);
          a.remove();
        } catch (e) {}
      }, 500);
      // register as hygiene job
      if (window.__mgJobHygiene) {
        var j = window.__mgJobHygiene.createJob({
          filename: a.download,
          url: "blob:inspect-pack",
          note: "web-inspect export",
        });
        if (j) {
          window.__mgJobHygiene.setState(j.id, "done");
        }
      }
    } catch (e3) {
      log("export failed · " + e3);
    }
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({
            op: "inspect_spit",
            dump: md.slice(0, 12000),
            t: Date.now(),
          })
        );
      }
    } catch (e4) {}
    return md;
  }

  function ensureCss() {
    if (document.getElementById("mg-web-inspect-css")) return;
    var st = document.createElement("style");
    st.id = "mg-web-inspect-css";
    st.textContent = [
      "#mg-web-inspect{",
      "  position:fixed;left:50%;top:10%;transform:translateX(-50%);z-index:2147483020;",
      "  width:min(560px,94vw);max-height:min(78vh,640px);",
      "  display:flex;flex-direction:column;pointer-events:auto;",
      "  font:500 12px/1.35 ui-monospace,Menlo,SF Mono,monospace;",
      "  color:rgba(230,240,255,0.94);",
      "  background:rgba(18,22,30,0.92);",
      "  backdrop-filter:blur(40px) saturate(1.6);-webkit-backdrop-filter:blur(40px) saturate(1.6);",
      "  border:1px solid rgba(120,180,255,0.28);border-radius:16px;",
      "  box-shadow:0 20px 56px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.1);",
      "  overflow:hidden}",
      "#mg-web-inspect.hidden{display:none!important}",
      "#mg-web-inspect .hd{",
      "  display:flex;align-items:center;justify-content:space-between;gap:8px;",
      "  padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.1)}",
      "#mg-web-inspect .hd .ttl{",
      "  font:700 11px/1 system-ui;letter-spacing:0.12em;text-transform:uppercase;",
      "  color:rgba(140,210,255,0.98)}",
      "#mg-web-inspect .hd button{",
      "  appearance:none;cursor:pointer;border:0;border-radius:999px;",
      "  padding:0 10px;height:26px;font:600 10px/26px system-ui;",
      "  background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.92)}",
      "#mg-web-inspect .hd button.x{width:26px;padding:0;border-radius:50%}",
      "#mg-web-inspect .tabs{display:flex;gap:4px;padding:8px 10px;flex-wrap:wrap;",
      "  border-bottom:1px solid rgba(255,255,255,0.06)}",
      "#mg-web-inspect .tabs button{",
      "  appearance:none;cursor:pointer;border:1px solid rgba(160,190,220,0.25);",
      "  background:rgba(10,14,20,0.85);color:rgba(200,220,240,0.9);",
      "  padding:5px 8px;border-radius:6px;font:700 9px/1 system-ui;letter-spacing:0.08em}",
      "#mg-web-inspect .tabs button.on{border-color:rgba(100,180,255,0.55);color:#fff}",
      "#mg-web-inspect .body{flex:1;overflow:auto;padding:10px 12px;min-height:180px}",
      "#mg-web-inspect .body .row{margin:0 0 8px;padding:8px;border-radius:8px;",
      "  background:rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.06)}",
      "#mg-web-inspect .body .row b{color:rgba(160,220,255,0.95)}",
      "#mg-web-inspect .body .muted{color:rgba(160,180,200,0.75);font-size:11px}",
      "#mg-web-inspect .body .ours{border-color:rgba(80,220,140,0.35)}",
      "#mg-web-inspect .acts{display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;",
      "  border-top:1px solid rgba(255,255,255,0.08)}",
      "#mg-web-inspect .acts button{",
      "  appearance:none;cursor:pointer;border:0;border-radius:8px;",
      "  padding:8px 10px;font:700 10px/1 system-ui;letter-spacing:0.04em;",
      "  background:rgba(10,132,255,0.9);color:#fff}",
      "#mg-web-inspect .acts button.sec{background:rgba(255,255,255,0.1)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  var tab = "mg";

  function paintBody() {
    if (!panel) return;
    var body = panel.querySelector(".body");
    if (!body) return;
    if (tab === "browsers") {
      body.innerHTML = BROWSERS.map(function (b) {
        return (
          '<div class="row' +
          (b.ours ? " ours" : "") +
          '"><b>' +
          b.name +
          "</b> · " +
          b.engine +
          '<div class="muted">' +
          b.inspect +
          "</div><div class=\"muted\">Keys: " +
          b.keys +
          "</div><div class=\"muted\">" +
          (b.fieldNote || b.strength) +
          "</div></div>"
        );
      }).join("");
      return;
    }
    if (tab === "field") {
      if (!fieldLog.length) {
        body.innerHTML =
          '<div class="row muted">No field triggers yet. Safari zombie `*` / prepare-TTL / paste blocks land here → product patches.</div>';
        return;
      }
      body.innerHTML = fieldLog
        .slice()
        .reverse()
        .slice(0, 24)
        .map(function (f) {
          return (
            '<div class="row"><b>' +
            (f.kind || "event") +
            "</b><div class=\"muted\">" +
            JSON.stringify(f).slice(0, 220) +
            "</div></div>"
          );
        })
        .join("");
      return;
    }
    if (tab === "hygiene") {
      var st = window.__mgJobHygiene ? window.__mgJobHygiene.status() : null;
      if (!st) {
        body.innerHTML =
          '<div class="row muted">Job hygiene not loaded. Click ARM HYGIENE.</div>';
        return;
      }
      body.innerHTML =
        '<div class="row ours"><b>Job hygiene ' +
        st.ver +
        "</b><div class=\"muted\">" +
        st.advantage +
        "</div><div class=\"muted\">armed=" +
        st.armed +
        " · prepare_ttl=" +
        st.prepare_ttl_ms +
        "ms · jobs=" +
        (st.jobs && st.jobs.length) +
        "</div></div>" +
        (st.jobs || [])
          .map(function (j) {
            return (
              '<div class="row"><b>' +
              j.state +
              "</b> " +
              j.filename +
              '<div class="muted">' +
              j.id +
              "</div></div>"
            );
          })
          .join("") ||
        '<div class="row muted">No live jobs (good).</div>';
      return;
    }
    // mg default
    var snap = snapshot();
    body.innerHTML =
      '<div class="row ours"><b>Memory Glass · native inspect</b>' +
      '<div class="muted">Dual float · dock · ironline · hotpipe packs · job hygiene</div>' +
      '<div class="muted">href ' +
      (snap.href || "").slice(0, 80) +
      "</div></div>" +
      '<div class="row"><b>Why we win this class</b>' +
      '<div class="muted">Safari can stuck on * / Preparing with dead cancel. MG: id + cancel_token + prepare TTL + paste sanitize. Field glitches → triggers → features.</div></div>' +
      '<div class="row"><b>Grok Build speed</b>' +
      '<div class="muted">/web inspect · export pack · external DevTools matrix · soakProbe hygiene</div></div>' +
      '<div class="row muted">meters ' +
      JSON.stringify(snap.meters) +
      "</div>";
  }

  function paintField() {
    if (openState && tab === "field") paintBody();
  }

  function setTab(t) {
    tab = t;
    if (!panel) return;
    panel.querySelectorAll(".tabs button").forEach(function (btn) {
      btn.classList.toggle("on", btn.getAttribute("data-tab") === t);
    });
    paintBody();
  }

  function ensurePanel() {
    if (panel && document.body.contains(panel)) return;
    ensureCss();
    panel = document.createElement("div");
    panel.id = "mg-web-inspect";
    panel.className = "hidden";
    panel.innerHTML =
      '<div class="hd">' +
      '  <div class="ttl">/web inspect</div>' +
      '  <div><button type="button" class="x" id="mg-wi-x">×</button></div>' +
      "</div>" +
      '<div class="tabs">' +
      '  <button type="button" data-tab="mg" class="on">MG</button>' +
      '  <button type="button" data-tab="browsers">BROWSERS</button>' +
      '  <button type="button" data-tab="hygiene">HYGIENE</button>' +
      '  <button type="button" data-tab="field">FIELD</button>' +
      "</div>" +
      '<div class="body"></div>' +
      '<div class="acts">' +
      '  <button type="button" id="mg-wi-arm">ARM HYGIENE</button>' +
      '  <button type="button" class="sec" id="mg-wi-soak">SOAK PROBE</button>' +
      '  <button type="button" class="sec" id="mg-wi-pack">EXPORT PACK</button>' +
      '  <button type="button" class="sec" id="mg-wi-sweep">SWEEP JOBS</button>' +
      "</div>";
    (document.body || document.documentElement).appendChild(panel);
    panel.querySelector("#mg-wi-x").onclick = function () {
      close();
    };
    panel.querySelectorAll(".tabs button").forEach(function (btn) {
      btn.onclick = function () {
        setTab(btn.getAttribute("data-tab"));
      };
    });
    panel.querySelector("#mg-wi-arm").onclick = function () {
      ensureHygiene(function () {
        setTab("hygiene");
        log("hygiene armed");
      });
    };
    panel.querySelector("#mg-wi-soak").onclick = function () {
      ensureHygiene(function () {
        var r = window.__mgJobHygiene && window.__mgJobHygiene.soakProbe();
        log("soakProbe " + JSON.stringify(r && r.starRejected));
        setTab("hygiene");
      });
    };
    panel.querySelector("#mg-wi-pack").onclick = function () {
      exportPack();
      log("exported inspect pack");
    };
    panel.querySelector("#mg-wi-sweep").onclick = function () {
      if (window.__mgJobHygiene) {
        window.__mgJobHygiene.sweep();
        window.__mgJobHygiene.clearAll();
      }
      setTab("hygiene");
    };
  }

  function open(which) {
    ensurePanel();
    openState = true;
    panel.classList.remove("hidden");
    if (which === "browsers" || which === "hygiene" || which === "field" || which === "mg") {
      setTab(which);
    } else {
      setTab("mg");
    }
    ensureHygiene();
    log(VER + " open · " + tab);
  }

  function close() {
    openState = false;
    if (panel) panel.classList.add("hidden");
  }

  function toggle() {
    if (openState) close();
    else open();
  }

  /** Slash command router for grok terminal / agents */
  function handleCommand(raw) {
    var line = String(raw || "").trim();
    var low = line.toLowerCase();
    if (low === "/web" || low === "/inspect" || low === "/web inspect" || low === "web inspect") {
      open("mg");
      return { ok: true, action: "open", tab: "mg" };
    }
    if (low === "/web browsers" || low === "/web matrix" || low.indexOf("/web browsers") === 0) {
      open("browsers");
      return { ok: true, action: "open", tab: "browsers" };
    }
    if (low === "/web hygiene" || low === "/hygiene") {
      ensureHygiene();
      open("hygiene");
      return { ok: true, action: "open", tab: "hygiene" };
    }
    if (low === "/web learn" || low === "/web field" || low === "/learn") {
      open("field");
      return { ok: true, action: "open", tab: "field" };
    }
    if (low === "/web pack" || low === "/web export") {
      exportPack();
      return { ok: true, action: "export" };
    }
    if (low === "/web soak" || low === "/hygiene soak") {
      ensureHygiene(function () {
        if (window.__mgJobHygiene) window.__mgJobHygiene.soakProbe();
      });
      open("hygiene");
      return { ok: true, action: "soak" };
    }
    if (low.indexOf("/web ") === 0) {
      open("mg");
      return { ok: true, action: "open", note: "unknown subcommand → mg tab" };
    }
    return { ok: false };
  }

  window.__mgWebInspect = {
    ver: VER,
    open: open,
    close: close,
    toggle: toggle,
    snapshot: snapshot,
    exportPack: exportPack,
    browsers: function () {
      return BROWSERS.slice();
    },
    handleCommand: handleCommand,
    onFieldTrigger: onFieldTrigger,
    fieldLog: function () {
      return fieldLog.slice();
    },
    ensureHygiene: ensureHygiene,
  };

  // listen for hygiene learn events
  try {
    window.addEventListener("mg-field-trigger", function (ev) {
      onFieldTrigger(ev && ev.detail);
    });
  } catch (e) {}

  log(VER + " ready · /web inspect");
})();
