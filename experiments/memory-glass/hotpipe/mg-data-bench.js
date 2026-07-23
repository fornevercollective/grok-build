/* Memory Glass · DATA Bench v3
 * Working tools from THIS machine — not remote freya.world / pages.dev embeds.
 *   · native panels (load-bal, cable, spectrum, freya calc, BOM)
 *   · local uvspeed apps iframe'd from http://127.0.0.1:8765 (uvspeed/web)
 *   · OPEN FULL → same local URL (or file:// fallback)
 * Serve: python3 -m http.server 8765 --bind 127.0.0.1  (cwd = uvspeed/web)
 * VER: mg-data-bench-v3.1-dual-safe
 */
(function () {
  "use strict";
  var VER = "mg-data-bench-v3.1-dual-safe";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._dataBenchVer === VER) return;
  HP._dataBenchVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var LOCAL =
    window.__mgUvspeedRoot ||
    "/Volumes/qbitOS/00.dev/projects/uvspeed/web";
  /* Loopback so WKWebView can iframe real tools (file:// blocked under https parent). */
  var LOCAL_HTTP =
    window.__mgUvspeedHttp ||
    "http://127.0.0.1:8765";

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "bench");
    } catch (e) {}
  }

  var state = {
    trade: "electric",
    tool: "load-bal",
    notes: [],
    lastGutter: null,
    lastBom: null,
    lastLoad: null,
  };

  var PREFIXES = [
    { id: "import", sym: "-n:", re: /^\s*(import|from|require|#include)/i },
    { id: "class", sym: "+0:", re: /^\s*(class|interface|struct)\b/i },
    { id: "function", sym: "0:", re: /^\s*(function|def|fn)\b/i },
    { id: "comment", sym: "+1:", re: /^\s*(\/\/|#|\/\*)/ },
    { id: "condition", sym: "+n:", re: /^\s*(if|else|switch)\b/i },
    { id: "loop", sym: "+2:", re: /^\s*(for|while)\b/i },
    { id: "return", sym: "-0:", re: /^\s*(return|yield)\b/i },
    { id: "output", sym: "+3:", re: /^\s*(print|console\.)/i },
  ];

  var TRADES = [
    {
      id: "electric",
      label: "Electrician",
      glyph: "⚡",
      hint: "Load balance · phase · VA",
      tools: ["load-bal", "freya-calc", "hexbench", "grid"],
    },
    {
      id: "signal",
      label: "Signal / RF",
      glyph: "📡",
      hint: "Cable · spectrum · freq",
      tools: ["cable-cal", "spectrum", "hexcast", "questcast", "jawta"],
    },
    {
      id: "construct",
      label: "Construction",
      glyph: "🏗️",
      hint: "BOM · sizes → pynote",
      tools: ["pynote", "archflow", "freya-calc", "freya"],
    },
    {
      id: "data",
      label: "Data / Lab",
      glyph: "◈",
      hint: "Full local bench apps",
      tools: ["hexbench", "freya", "grid", "feed", "qa", "notepad"],
    },
  ];

  var TOOLS = {
    "load-bal": {
      id: "load-bal",
      label: "Load Balance",
      kind: "native",
      panel: "electric",
      desc: "3φ / 1φ load chart · live bars",
    },
    "cable-cal": {
      id: "cable-cal",
      label: "Cable / Harness",
      kind: "native",
      panel: "signal",
      desc: "Length · dB loss · Z quick cal",
    },
    spectrum: {
      id: "spectrum",
      label: "Frequency / Spectrum",
      kind: "native",
      panel: "spectrum",
      desc: "Band · λ · MHz math",
    },
    "freya-calc": {
      id: "freya-calc",
      label: "Freya Math",
      kind: "native",
      panel: "freya",
      local: "freya.html",
      desc: "Field calc · OPEN FULL → FreyaUnits",
    },
    pynote: {
      id: "pynote",
      label: "Materials BOM",
      kind: "native",
      panel: "pynote",
      desc: "Construction list → desk",
    },
    hexbench: {
      id: "hexbench",
      label: "Hex Bench",
      kind: "local",
      local: "hexbench.html",
      desc: "Voltage lab · PSU (local uvspeed)",
    },
    archflow: {
      id: "archflow",
      label: "Arch Flow",
      kind: "local",
      local: "archflow.html",
      desc: "Mermaid / architecture (local)",
    },
    hexcast: {
      id: "hexcast",
      label: "Hex Cast",
      kind: "local",
      local: "hexcast.html",
      desc: "Signal cast (local)",
    },
    questcast: {
      id: "questcast",
      label: "Quest Cast",
      kind: "local",
      local: "questcast.html",
      desc: "Quest cast (local)",
    },
    jawta: {
      id: "jawta",
      label: "Jawta Audio",
      kind: "local",
      local: "jawta-audio.html",
      desc: "Audio path (local)",
    },
    feed: {
      id: "feed",
      label: "Feed",
      kind: "local",
      local: "feed.html",
      desc: "Feed board (local)",
    },
    grid: {
      id: "grid",
      label: "Grid",
      kind: "local",
      local: "grid.html",
      desc: "Grid (local)",
    },
    qa: {
      id: "qa",
      label: "QA",
      kind: "local",
      local: "qa.html",
      desc: "QA checklist (local)",
    },
    freya: {
      id: "freya",
      label: "Freya Units",
      kind: "local",
      local: "freya.html",
      desc: "Full FreyaUnits app (local)",
    },
    notepad: {
      id: "notepad",
      label: "Quantum Notepad",
      kind: "local",
      local: "quantum-notepad.html",
      desc: "Notepad (local)",
    },
  };

  function toolById(id) {
    return TOOLS[id] || null;
  }
  function tradeById(id) {
    for (var i = 0; i < TRADES.length; i++)
      if (TRADES[i].id === id) return TRADES[i];
    return TRADES[0];
  }

  function localFileUrl(file) {
    if (!file) return null;
    var root = String(LOCAL).replace(/\/$/, "");
    return "file://" + root + "/" + file.replace(/^\//, "");
  }

  function localHttpUrl(file) {
    if (!file) return null;
    var base = String(LOCAL_HTTP).replace(/\/$/, "");
    return base + "/" + file.replace(/^\//, "");
  }

  /** Prefer loopback HTTP (iframe works). file:// only for full-window nav fallback. */
  function toolUrl(t, preferFile) {
    if (!t || !t.local) return null;
    if (preferFile) return localFileUrl(t.local);
    return localHttpUrl(t.local) || localFileUrl(t.local);
  }

  function navigateUrl(url) {
    if (!url) return false;
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
        return true;
      }
    } catch (e) {}
    try {
      location.href = url;
      return true;
    } catch (e2) {
      return false;
    }
  }

  function openFull(toolId) {
    var t = toolById(toolId || state.tool);
    if (!t) return false;
    if (t.local) {
      var u = toolUrl(t, false) || localFileUrl(t.local);
      log("OPEN FULL local " + u);
      return navigateUrl(u);
    }
    return false;
  }

  /* ── Quantum gutter ── */
  function classifyLine(line) {
    var s = String(line || "");
    for (var i = 0; i < PREFIXES.length; i++) {
      if (PREFIXES[i].re.test(s)) return PREFIXES[i];
    }
    return { id: "default", sym: "0:" };
  }

  function gutterPage() {
    var spine = [];
    ["header", "nav", "main", "aside", "footer", "form", "table", "canvas", "video"].forEach(
      function (tag) {
        var n = document.getElementsByTagName(tag).length;
        if (n) spine.push({ tag: tag, n: n, pfx: classifyLine(tag) });
      }
    );
    var boiler = "html5";
    try {
      var h = (document.documentElement.outerHTML || "").slice(0, 6000).toLowerCase();
      if (h.indexOf("_next") >= 0 || h.indexOf("react") >= 0) boiler = "react";
      else if (document.querySelector("script[type='module']")) boiler = "esm-module";
    } catch (e) {}
    var meta = {
      t: Date.now(),
      url: location.href,
      host: location.hostname || "",
      ready: document.readyState,
      scripts: document.scripts.length,
      links: document.links.length,
      spine: spine,
      boiler: boiler,
    };
    state.lastGutter = meta;
    window.__mgPageGutter = meta;
    return meta;
  }

  function freyaQuickCalc(expr) {
    try {
      var s = String(expr || "")
        .replace(/[^0-9+\-*/().,\s^eE]/g, "")
        .replace(/\^/g, "**");
      if (!s.trim()) return null;
      var v = Function('"use strict";return (' + s + ")")();
      if (typeof v !== "number" || !isFinite(v)) return null;
      return v;
    } catch (e) {
      return null;
    }
  }

  /* ── Native: electrician load balance ── */
  function renderElectric() {
    var box = document.createElement("div");
    box.className = "mg-bench-panel";
    box.innerHTML =
      '<div class="sec-lbl">⚡ Load balance · field chart</div>' +
      '<div class="mg-bench-grid3">' +
      '<label>V <input id="mg-lb-v" type="number" value="120" step="1"/></label>' +
      '<label>φ <select id="mg-lb-ph"><option value="1">1φ</option><option value="3" selected>3φ</option></select></label>' +
      '<label>PF <input id="mg-lb-pf" type="number" value="0.9" min="0.1" max="1" step="0.05"/></label>' +
      "</div>" +
      '<div class="mg-bench-grid3">' +
      '<label>A L1 <input id="mg-lb-a1" type="number" value="18" step="0.1"/></label>' +
      '<label>A L2 <input id="mg-lb-a2" type="number" value="22" step="0.1"/></label>' +
      '<label>A L3 <input id="mg-lb-a3" type="number" value="15" step="0.1"/></label>' +
      "</div>" +
      '<button type="button" class="hot" id="mg-lb-go">Balance chart</button>' +
      '<div id="mg-lb-bars" class="mg-lb-bars"></div>' +
      '<pre id="mg-lb-out" class="mg-bench-out">—</pre>' +
      '<button type="button" id="mg-lb-desk">→ DESK</button>';
    setTimeout(function () {
      function run() {
        var V = parseFloat(box.querySelector("#mg-lb-v").value) || 120;
        var ph = parseInt(box.querySelector("#mg-lb-ph").value, 10) || 1;
        var pf = parseFloat(box.querySelector("#mg-lb-pf").value) || 0.9;
        var a1 = parseFloat(box.querySelector("#mg-lb-a1").value) || 0;
        var a2 = parseFloat(box.querySelector("#mg-lb-a2").value) || 0;
        var a3 = parseFloat(box.querySelector("#mg-lb-a3").value) || 0;
        var amps = ph === 3 ? [a1, a2, a3] : [a1, a2];
        var maxA = Math.max.apply(null, amps.concat([1]));
        var sumA = amps.reduce(function (s, a) {
          return s + a;
        }, 0);
        var avg = sumA / amps.length;
        var imbalance =
          avg > 0
            ? (Math.max.apply(null, amps) - Math.min.apply(null, amps)) / avg
            : 0;
        var kVA =
          ph === 3
            ? (Math.sqrt(3) * V * sumA) / 1000
            : (V * sumA) / 1000;
        var kW = kVA * pf;
        var bars = box.querySelector("#mg-lb-bars");
        bars.innerHTML = amps
          .map(function (a, i) {
            var pct = Math.min(100, (a / maxA) * 100);
            var hot = avg > 0 && Math.abs(a - avg) / avg > 0.15;
            return (
              '<div class="mg-lb-row"><span>L' +
              (i + 1) +
              "</span><div class=\"mg-lb-track\"><div class=\"mg-lb-fill" +
              (hot ? " hot" : "") +
              '" style="width:' +
              pct +
              '%"></div></div><span>' +
              a.toFixed(1) +
              "A</span></div>"
            );
          })
          .join("");
        var out =
          "V=" +
          V +
          " · " +
          ph +
          "φ · PF=" +
          pf +
          "\nΣA=" +
          sumA.toFixed(1) +
          " · kVA≈" +
          kVA.toFixed(2) +
          " · kW≈" +
          kW.toFixed(2) +
          "\nimbalance=" +
          (imbalance * 100).toFixed(1) +
          "%" +
          (imbalance > 0.2 ? "  ⚠ rebalance phases" : "  ✓ ok");
        box.querySelector("#mg-lb-out").textContent = out;
        state.lastLoad = { V: V, ph: ph, pf: pf, amps: amps, kVA: kVA, kW: kW, imbalance: imbalance, out: out };
      }
      box.querySelector("#mg-lb-go").onclick = run;
      ["#mg-lb-v", "#mg-lb-a1", "#mg-lb-a2", "#mg-lb-a3", "#mg-lb-pf", "#mg-lb-ph"].forEach(
        function (sel) {
          var el = box.querySelector(sel);
          if (el) el.addEventListener("change", run);
        }
      );
      box.querySelector("#mg-lb-desk").onclick = function () {
        run();
        var L = state.lastLoad;
        if (!L) return;
        if (window.__mgAgentDesk) {
          if (window.__mgAgentDesk.open) window.__mgAgentDesk.open();
          if (window.__mgAgentDesk.pushLog) {
            window.__mgAgentDesk.pushLog("sys", "Load balance chart");
            window.__mgAgentDesk.pushLog("you", L.out);
            window.__mgAgentDesk.pushLog(
              "ai",
              L.imbalance > 0.2
                ? "Move loads from heaviest leg toward lightest until ΔA < 15%."
                : "Phases within band · still verify breaker ratings vs continuous load ×1.25."
            );
          }
        }
      };
      run();
    }, 0);
    return box;
  }

  /* ── Native: cable / harness ── */
  function renderSignal() {
    var box = document.createElement("div");
    box.className = "mg-bench-panel";
    box.innerHTML =
      '<div class="sec-lbl">📡 Cable / harness cal</div>' +
      '<div class="mg-bench-grid2">' +
      '<label>Length (m) <input id="mg-cb-len" type="number" value="30" step="0.5"/></label>' +
      '<label>Loss dB/100m <input id="mg-cb-loss" type="number" value="6.5" step="0.1"/></label>' +
      '<label>Freq MHz <input id="mg-cb-f" type="number" value="100" step="1"/></label>' +
      '<label>Z Ω <input id="mg-cb-z" type="number" value="50" step="1"/></label>' +
      "</div>" +
      '<button type="button" class="hot" id="mg-cb-go">Calibrate</button>' +
      '<pre id="mg-cb-out" class="mg-bench-out">—</pre>' +
      '<button type="button" id="mg-cb-full">OPEN hexcast FULL →</button>';
    setTimeout(function () {
      function run() {
        var len = parseFloat(box.querySelector("#mg-cb-len").value) || 0;
        var loss = parseFloat(box.querySelector("#mg-cb-loss").value) || 0;
        var f = parseFloat(box.querySelector("#mg-cb-f").value) || 1;
        var z = parseFloat(box.querySelector("#mg-cb-z").value) || 50;
        var totalDb = (loss * len) / 100;
        var ratio = Math.pow(10, -totalDb / 10);
        var lambda = 300 / f; /* free-space m approx for MHz */
        box.querySelector("#mg-cb-out").textContent =
          "len=" +
          len +
          "m · " +
          f +
          " MHz · Z=" +
          z +
          "Ω\n" +
          "path loss≈" +
          totalDb.toFixed(2) +
          " dB · power ratio≈" +
          (ratio * 100).toFixed(1) +
          "%\n" +
          "λ≈" +
          lambda.toFixed(3) +
          " m · λ/4≈" +
          (lambda / 4).toFixed(3) +
          " m\n" +
          (totalDb > 6 ? "⚠ high loss — shorter run or lower-loss cable" : "✓ loss in band for many harnesses");
      }
      box.querySelector("#mg-cb-go").onclick = run;
      box.querySelector("#mg-cb-full").onclick = function () {
        openFull("hexcast");
      };
      run();
    }, 0);
    return box;
  }

  /* ── Native: spectrum / frequency ── */
  function renderSpectrum() {
    var box = document.createElement("div");
    box.className = "mg-bench-panel";
    box.innerHTML =
      '<div class="sec-lbl">Frequency / spectrum</div>' +
      '<div class="mg-bench-grid2">' +
      '<label>f (MHz) <input id="mg-sp-f" type="number" value="2400" step="1"/></label>' +
      '<label>c factor <input id="mg-sp-vf" type="number" value="0.66" step="0.01" title="velocity factor"/></label>' +
      "</div>" +
      '<button type="button" class="hot" id="mg-sp-go">Compute</button>' +
      '<div id="mg-sp-bands" class="mg-sp-bands"></div>' +
      '<pre id="mg-sp-out" class="mg-bench-out">—</pre>';
    setTimeout(function () {
      var bands = [
        { name: "HF", lo: 3, hi: 30 },
        { name: "VHF", lo: 30, hi: 300 },
        { name: "UHF", lo: 300, hi: 3000 },
        { name: "S", lo: 2000, hi: 4000 },
        { name: "WiFi2.4", lo: 2400, hi: 2500 },
        { name: "WiFi5", lo: 5150, hi: 5850 },
      ];
      function run() {
        var f = parseFloat(box.querySelector("#mg-sp-f").value) || 1;
        var vf = parseFloat(box.querySelector("#mg-sp-vf").value) || 0.66;
        var lam = (300 * vf) / f;
        var hit = bands.filter(function (b) {
          return f >= b.lo && f <= b.hi;
        });
        box.querySelector("#mg-sp-bands").innerHTML = bands
          .map(function (b) {
            var on = f >= b.lo && f <= b.hi;
            return (
              '<span class="mg-sp-chip' +
              (on ? " on" : "") +
              '">' +
              b.name +
              "</span>"
            );
          })
          .join("");
        box.querySelector("#mg-sp-out").textContent =
          f +
          " MHz · VF=" +
          vf +
          "\nλ_cable≈" +
          lam.toFixed(4) +
          " m · λ/2≈" +
          (lam / 2).toFixed(4) +
          " m · λ/4≈" +
          (lam / 4).toFixed(4) +
          " m\nband: " +
          (hit.map(function (h) {
            return h.name;
          }).join(", ") || "—");
      }
      box.querySelector("#mg-sp-go").onclick = run;
      run();
    }, 0);
    return box;
  }

  /* ── Native: freya field math ── */
  function renderFreya() {
    var box = document.createElement("div");
    box.className = "mg-bench-panel";
    box.innerHTML =
      '<div class="sec-lbl">Freya / field math</div>' +
      '<div class="mg-bench-acts">' +
      '<input id="mg-fy-in" placeholder="120*20  ·  (3.5*12)/2  ·  15^2"/>' +
      '<button type="button" class="hot" id="mg-fy-go">=</button></div>' +
      '<div class="mg-bench-presets">' +
      '<button type="button" data-e="120*15">120V·15A</button>' +
      '<button type="button" data-e="240*30">240V·30A</button>' +
      '<button type="button" data-e="(3.5*12)">board-ft rough</button>' +
      '<button type="button" data-e="Math.sqrt(3)*208*20/1000">3φ kVA</button></div>' +
      '<pre id="mg-fy-out" class="mg-bench-out">—</pre>' +
      '<button type="button" id="mg-fy-full">OPEN FreyaUnits FULL →</button>';
    setTimeout(function () {
      var inp = box.querySelector("#mg-fy-in");
      var out = box.querySelector("#mg-fy-out");
      function run() {
        var expr = inp.value;
        if (/Math\.sqrt/.test(expr)) {
          try {
            var v = Function('"use strict";return (' + expr + ")")();
            out.textContent = String(v);
            return;
          } catch (e) {}
        }
        var r = freyaQuickCalc(expr);
        out.textContent = r == null ? "—" : String(r);
      }
      box.querySelector("#mg-fy-go").onclick = run;
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Enter") run();
      });
      Array.prototype.forEach.call(box.querySelectorAll("[data-e]"), function (b) {
        b.onclick = function () {
          inp.value = b.getAttribute("data-e");
          run();
        };
      });
      box.querySelector("#mg-fy-full").onclick = function () {
        openFull("freya-calc");
      };
    }, 0);
    return box;
  }

  /* ── Native: pynote BOM ── */
  function buildBom(lines) {
    var items = [];
    String(lines || "")
      .split(/\n/)
      .forEach(function (raw) {
        var line = raw.trim();
        if (!line) return;
        var m = line.match(
          /^(\d+(?:\.\d+)?)\s*([a-zA-Z%]+)?\s+(.+?)(?:\s+(\d+(?:\.\d+)?)\s*(ft|in|m|cm|mm)?)?$/
        );
        if (m) {
          items.push({
            qty: parseFloat(m[1]),
            unit: (m[2] || "ea").toLowerCase(),
            name: m[3].trim(),
            size: m[4] ? m[4] + (m[5] || "") : "",
          });
        } else items.push({ qty: 1, unit: "ea", name: line, size: "" });
      });
    var md = [
      "# Materials BOM · PyNote",
      "",
      "| Qty | Unit | Material | Size |",
      "|-----|------|----------|------|",
    ];
    items.forEach(function (it) {
      md.push(
        "| " + it.qty + " | " + it.unit + " | " + it.name + " | " + (it.size || "—") + " |"
      );
    });
    md.push("");
    md.push("Add 10% waste · suggest substitutions · rough cost band.");
    var note = { t: Date.now(), items: items, md: md.join("\n"), n: items.length };
    state.lastBom = note;
    return note;
  }

  function renderPynote() {
    var box = document.createElement("div");
    box.className = "mg-bench-panel";
    box.innerHTML =
      '<div class="sec-lbl">🏗️ Materials BOM</div>' +
      '<p class="drw-hint">One line: <code>12 ea 2x4 stud 8ft</code></p>' +
      '<textarea id="mg-bom-in" rows="5" placeholder="24 ea 2x4 stud 8ft\n8 ea 4x8 plywood 1/2in"></textarea>' +
      '<div class="mg-bench-acts">' +
      '<button type="button" class="hot" id="mg-bom-go">Build list</button>' +
      '<button type="button" id="mg-bom-desk">→ DESK</button>' +
      '<button type="button" id="mg-bom-copy">Copy</button></div>' +
      '<pre id="mg-bom-out" class="mg-bench-out"></pre>';
    setTimeout(function () {
      var inp = box.querySelector("#mg-bom-in");
      var out = box.querySelector("#mg-bom-out");
      box.querySelector("#mg-bom-go").onclick = function () {
        out.textContent = buildBom(inp.value).md;
      };
      box.querySelector("#mg-bom-desk").onclick = function () {
        var note = state.lastBom || buildBom(inp.value);
        if (window.__mgAgentDesk) {
          if (window.__mgAgentDesk.open) window.__mgAgentDesk.open();
          if (window.__mgAgentDesk.pushLog) {
            window.__mgAgentDesk.pushLog("sys", "BOM · " + note.n + " lines");
            window.__mgAgentDesk.pushLog("you", note.md.slice(0, 700));
          }
        }
      };
      box.querySelector("#mg-bom-copy").onclick = function () {
        var note = state.lastBom || buildBom(inp.value);
        try {
          if (window.ipc)
            window.ipc.postMessage(
              JSON.stringify({ op: "clipboard_copy", text: note.md })
            );
          else if (navigator.clipboard) navigator.clipboard.writeText(note.md);
        } catch (e) {}
      };
    }, 0);
    return box;
  }

  /* ── Local uvspeed app: real tool iframe (loopback), not remote site ── */
  function renderLocalCard(t) {
    var box = document.createElement("div");
    box.className = "mg-bench-panel mg-bench-local";
    var http = toolUrl(t, false);
    var file = localFileUrl(t.local);
    var path = t.local ? LOCAL + "/" + t.local : "";
    box.innerHTML =
      '<div class="sec-lbl">' +
      (t.label || t.id) +
      " · local</div>" +
      '<p class="drw-hint">' +
      (t.desc || "") +
      " · not freya.world / pages.dev</p>" +
      '<div class="mg-bench-acts">' +
      '<button type="button" class="hot" id="mg-loc-open">OPEN FULL →</button>' +
      '<button type="button" id="mg-loc-reload">Reload</button>' +
      '<button type="button" id="mg-loc-file">file://</button></div>' +
      '<p class="drw-hint mono" id="mg-loc-url">' +
      (http || path) +
      "</p>" +
      '<iframe class="mg-bench-iframe" id="mg-loc-frame" title="' +
      (t.label || t.id) +
      '" src="' +
      (http || "") +
      '" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe>' +
      '<p class="drw-hint" id="mg-loc-hint">If blank: serve uvspeed/web → <code>python3 -m http.server 8765 --bind 127.0.0.1</code></p>';
    setTimeout(function () {
      var fr = box.querySelector("#mg-loc-frame");
      box.querySelector("#mg-loc-open").onclick = function () {
        openFull(t.id);
      };
      box.querySelector("#mg-loc-reload").onclick = function () {
        if (fr && http) {
          fr.src = http + (http.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now();
        }
      };
      box.querySelector("#mg-loc-file").onclick = function () {
        if (file) navigateUrl(file);
      };
      /* probe loopback; if down, show file path + open full */
      if (http) {
        try {
          var img = new Image();
          img.onload = img.onerror = function () {
            /* load event alone isn't enough; leave iframe — user sees tool or blank */
          };
        } catch (e) {}
      }
    }, 0);
    return box;
  }

  function embedTool(host, toolId) {
    if (!host) return false;
    var t = toolById(toolId || state.tool);
    host.innerHTML = "";
    if (!t) {
      host.innerHTML = '<p class="drw-hint">Tool missing</p>';
      return false;
    }
    state.tool = t.id;
    var panel = null;
    if (t.kind === "native") {
      if (t.panel === "electric") panel = renderElectric();
      else if (t.panel === "signal") panel = renderSignal();
      else if (t.panel === "spectrum") panel = renderSpectrum();
      else if (t.panel === "freya") panel = renderFreya();
      else if (t.panel === "pynote") panel = renderPynote();
    } else if (t.kind === "local") {
      panel = renderLocalCard(t);
    }
    if (panel) host.appendChild(panel);
    else host.innerHTML = '<p class="drw-hint">No panel for ' + t.id + "</p>";
    return true;
  }

  function ensureCss() {
    if (document.getElementById("mg-data-bench-css")) return;
    var st = document.createElement("style");
    st.id = "mg-data-bench-css";
    st.textContent = [
      "#mg-right-drawer.bench-mode{--mg-right-w:min(400px,40vw)}",
      "html.mg-left-open #mg-right-drawer.bench-mode{--mg-right-w:min(380px,36vw)!important}",
      "#mg-right-drawer.bench-mode .drw-body,#mg-drawer-bench-host,",
      "#mg-right-drawer.bench-mode .mg-bench-panel{",
      "  max-width:100%!important;box-sizing:border-box!important;overflow-x:hidden!important}",
      ".mg-bench-iframe{max-width:100%!important;box-sizing:border-box!important}",
      ".mg-bench-trades{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}",
      ".mg-bench-trade{appearance:none;cursor:pointer;border:1px solid rgba(255,255,255,0.12);",
      "  background:rgba(255,255,255,0.05);color:rgba(230,240,255,0.8);",
      "  border-radius:999px;padding:7px 10px;font:650 10px/1 system-ui}",
      ".mg-bench-trade.on{border-color:rgba(140,200,255,0.5);color:#9fd0ff;",
      "  background:rgba(40,80,140,0.3)}",
      ".mg-bench-tools{display:flex;flex-direction:column;gap:6px;margin:0 0 12px}",
      ".mg-bench-tool{appearance:none;cursor:pointer;text-align:left;",
      "  border:1px solid rgba(255,255,255,0.1);border-radius:12px;",
      "  background:rgba(0,0,0,0.22);color:inherit;padding:10px 12px}",
      ".mg-bench-tool strong{display:block;font:650 12px/1.2 system-ui;margin-bottom:4px}",
      ".mg-bench-tool span{font:500 11px/1.3 system-ui;color:rgba(200,215,235,0.55)}",
      ".mg-bench-tool.on{border-color:rgba(140,200,255,0.45);background:rgba(40,70,120,0.25)}",
      ".mg-bench-panel{margin:0 0 12px}",
      ".mg-bench-panel .sec-lbl,.mg-bench-gutter .sec-lbl{",
      "  font:650 10px/1 system-ui;letter-spacing:0.12em;text-transform:uppercase;",
      "  color:rgba(160,200,255,0.7);margin:0 0 8px}",
      ".mg-bench-grid2,.mg-bench-grid3{display:grid;gap:8px;margin:0 0 8px}",
      ".mg-bench-grid2{grid-template-columns:1fr 1fr}",
      ".mg-bench-grid3{grid-template-columns:1fr 1fr 1fr}",
      ".mg-bench-panel label{display:flex;flex-direction:column;gap:4px;",
      "  font:600 10px/1 system-ui;color:rgba(180,200,220,0.7)}",
      ".mg-bench-panel input,.mg-bench-panel select,.mg-bench-panel textarea{",
      "  appearance:none;border-radius:8px;border:1px solid rgba(255,255,255,0.12);",
      "  background:rgba(0,0,0,0.35);color:inherit;padding:8px;font:500 12px/1 system-ui}",
      ".mg-bench-panel textarea{width:100%;box-sizing:border-box;min-height:90px}",
      ".mg-bench-acts{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}",
      ".mg-bench-acts input{flex:1;min-width:100px}",
      ".mg-bench-panel button,.mg-bench-acts button{",
      "  appearance:none;cursor:pointer;border:1px solid rgba(255,255,255,0.14);",
      "  background:rgba(255,255,255,0.06);color:inherit;border-radius:10px;",
      "  padding:8px 10px;font:650 10px/1 system-ui;margin:0 6px 6px 0}",
      ".mg-bench-panel button.hot,.mg-bench-acts button.hot{",
      "  border-color:rgba(140,200,255,0.45);color:#9fd0ff}",
      ".mg-bench-presets{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 8px}",
      ".mg-bench-out{margin:0 0 8px;padding:8px 10px;border-radius:10px;",
      "  background:rgba(0,0,0,0.28);font:500 11px/1.4 ui-monospace,Menlo,monospace;",
      "  color:rgba(200,220,240,0.85);white-space:pre-wrap;max-height:180px;overflow:auto}",
      ".mg-lb-bars{display:flex;flex-direction:column;gap:6px;margin:8px 0}",
      ".mg-lb-row{display:grid;grid-template-columns:28px 1fr 40px;gap:8px;align-items:center;",
      "  font:600 10px/1 system-ui}",
      ".mg-lb-track{height:10px;border-radius:999px;background:rgba(255,255,255,0.08);overflow:hidden}",
      ".mg-lb-fill{height:100%;border-radius:999px;background:rgba(80,180,255,0.75)}",
      ".mg-lb-fill.hot{background:rgba(248,113,113,0.85)}",
      ".mg-sp-bands{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}",
      ".mg-sp-chip{padding:4px 8px;border-radius:6px;font:650 9px/1 system-ui;",
      "  background:rgba(255,255,255,0.06);color:rgba(200,210,230,0.6)}",
      ".mg-sp-chip.on{background:rgba(40,100,180,0.35);color:#9fd0ff}",
      ".drw-hint.mono{font:500 10px/1.3 ui-monospace,Menlo,monospace;word-break:break-all}",
      ".mg-bench-gutter{margin:0 0 10px}",
      ".mg-bench-iframe{width:100%;height:min(52vh,480px);border:1px solid rgba(255,255,255,0.12);",
      "  border-radius:12px;background:rgba(0,0,0,0.35);display:block;margin:6px 0}",
    ].join("");
    document.documentElement.appendChild(st);
  }

  function paintBenchInto(body, setStatus) {
    if (!body) return;
    ensureCss();
    var g = gutterPage();

    var head = document.createElement("p");
    head.className = "hint";
    head.textContent =
      "Local uvspeed tools · " + LOCAL_HTTP + " · no remote site embeds";
    body.appendChild(head);

    var trades = document.createElement("div");
    trades.className = "mg-bench-trades";
    TRADES.forEach(function (tr) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mg-bench-trade" + (tr.id === state.trade ? " on" : "");
      b.textContent = (tr.glyph || "") + " " + tr.label;
      b.title = tr.hint || "";
      b.onclick = function () {
        state.trade = tr.id;
        if (tr.tools && tr.tools[0]) state.tool = tr.tools[0];
        /* repaint inside body only — avoid full drawer remount that breaks dual layout */
        if (body && body.parentNode) {
          try {
            body.innerHTML = "";
            paintBenchInto(body, setStatus);
          } catch (eRep) {
            if (window.__mgRightDrawer && window.__mgRightDrawer.setMode)
              window.__mgRightDrawer.setMode("bench");
          }
        }
      };
      trades.appendChild(b);
    });
    body.appendChild(trades);

    var tr = tradeById(state.trade);
    var sub = document.createElement("p");
    sub.className = "hint";
    sub.textContent = (tr && tr.hint) || "";
    body.appendChild(sub);

    var tools = document.createElement("div");
    tools.className = "mg-bench-tools";
    (tr.tools || []).forEach(function (id) {
      var t = toolById(id);
      if (!t) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mg-bench-tool" + (id === state.tool ? " on" : "");
      b.innerHTML =
        "<strong>" +
        t.label +
        (t.kind === "local" ? " · local" : "") +
        "</strong><span>" +
        (t.desc || "") +
        "</span>";
      b.onclick = function () {
        state.tool = id;
        var host = document.getElementById("mg-drawer-bench-host");
        embedTool(host, id);
        Array.prototype.forEach.call(tools.querySelectorAll("button"), function (x) {
          x.classList.toggle("on", x === b);
        });
        if (setStatus) setStatus("bench · " + t.label);
      };
      tools.appendChild(b);
    });
    body.appendChild(tools);

    var gut = document.createElement("div");
    gut.className = "mg-bench-gutter";
    gut.innerHTML =
      '<div class="sec-lbl">Quantum gutter · page spine</div>' +
      '<pre class="mg-bench-out">' +
      "host: " +
      (g.host || "?") +
      "\nboiler: " +
      (g.boiler || "?") +
      "\nready: " +
      g.ready +
      " · scripts=" +
      g.scripts +
      " links=" +
      g.links +
      "\n" +
      (g.spine || [])
        .map(function (s) {
          return s.pfx.sym + " <" + s.tag + "> ×" + s.n;
        })
        .join("\n") +
      "</pre>";
    body.appendChild(gut);

    var host = document.createElement("div");
    host.id = "mg-drawer-bench-host";
    body.appendChild(host);
    embedTool(host, state.tool);

    if (setStatus)
      setStatus(
        "bench · " +
          (tr && tr.label) +
          " · " +
          (toolById(state.tool) && toolById(state.tool).label) +
          " · " +
          (g.boiler || "")
      );
  }

  setTimeout(function () {
    try {
      gutterPage();
    } catch (e) {}
  }, 200);
  window.addEventListener("load", function () {
    setTimeout(function () {
      try {
        gutterPage();
      } catch (e) {}
    }, 400);
  });

  ensureCss();

  window.__mgDataBench = {
    ver: VER,
    paint: paintBenchInto,
    openFull: openFull,
    openTool: openFull,
    embedTool: embedTool,
    toolUrl: function (id) {
      return toolUrl(toolById(id || state.tool), false);
    },
    gutter: gutterPage,
    lastGutter: function () {
      return state.lastGutter;
    },
    buildBom: buildBom,
    freyaCalc: freyaQuickCalc,
    setTrade: function (id) {
      state.trade = id;
    },
    setTool: function (id) {
      state.tool = id;
    },
    localRoot: LOCAL,
    localHttp: LOCAL_HTTP,
    report: function () {
      return (
        VER +
        " trade=" +
        state.trade +
        " tool=" +
        state.tool +
        " http=" +
        LOCAL_HTTP +
        " disk=" +
        LOCAL +
        " gutter=" +
        !!(state.lastGutter && state.lastGutter.boiler)
      );
    },
  };

  log(VER + " · local uvspeed " + LOCAL_HTTP + " · " + LOCAL);
})();
