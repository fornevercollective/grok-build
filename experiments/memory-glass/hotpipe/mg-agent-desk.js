/* Memory Glass · Agent Desk
 * Brand-new feel: multi-tier project command (Cursor-shaped) living INSIDE the browser OS.
 * Tiers: α plan · β build · γ verify · δ explore (curious / break-it / QA)
 * Every action rides __mgQbitBus + truss. Not a sidecar chat app.
 * VER: mg-agent-desk-v6-live-collab
 */
(function () {
  "use strict";
  var VER = "mg-agent-desk-v6-live-collab";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._agentDeskVer === VER) return;
  HP._agentDeskVer = VER;

  var TIERS = [
    { id: "plan", glyph: "α", label: "PLAN", lane: "L2", prefix: "+1:" },
    { id: "build", glyph: "β", label: "BUILD", lane: "L2", prefix: "0:" },
    { id: "verify", glyph: "γ", label: "VERIFY", lane: "L3", prefix: "+2:" },
    { id: "explore", glyph: "δ", label: "EXPLORE", lane: "L7", prefix: "+3:" },
  ];

  var state = {
    ver: VER,
    tier: "plan",
    project: "memory-glass",
    open: false,
    log: [],
    curiosity: 0,
    lastAction: null,
  };

  var root = null;
  var logEl = null;
  var inEl = null;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "agent-desk");
    } catch (e) {}
  }

  function bus() {
    return window.__mgQbitBus || null;
  }
  function truss() {
    return window.__mgQbitTruss || null;
  }
  function term() {
    return window.__mgQbitTerm || null;
  }

  function tierObj() {
    for (var i = 0; i < TIERS.length; i++)
      if (TIERS[i].id === state.tier) return TIERS[i];
    return TIERS[0];
  }

  function pushLog(role, text, meta) {
    var row = {
      t: Date.now(),
      role: role,
      tier: state.tier,
      text: String(text || "").slice(0, 800),
      meta: meta || null,
    };
    state.log.push(row);
    if (state.log.length > 120) state.log = state.log.slice(-120);
    paintLog();
    return row;
  }

  function pub(kind, payload) {
    var T = tierObj();
    if (!bus()) return null;
    return bus().publish({
      src: "agent-desk",
      kind: kind || "chat",
      lane: T.lane,
      prefix: T.prefix,
      withGlyph: true,
      payload: Object.assign(
        { tier: state.tier, project: state.project },
        payload || {}
      ),
      fleet: { role: "agent-desk", host: "mg" },
    });
  }

  function ensureCss() {
    if (document.getElementById("mg-agent-desk-css")) return;
    var st = document.createElement("style");
    st.id = "mg-agent-desk-css";
    st.textContent = [
      "#mg-agent-desk{",
      "  position:fixed;left:16px;bottom:calc(58px + var(--mg-kb-h,0px));z-index:2147483646;",
      "  width:min(420px,94vw);max-height:min(70vh,620px);",
      "  display:flex;flex-direction:column;pointer-events:auto;",
      "  font:500 12px/1.4 -apple-system,system-ui,sans-serif;",
      "  color:rgba(236,242,250,0.94);",
      "  background:rgba(12,16,28,0.72);",
      "  backdrop-filter:blur(40px) saturate(1.6);-webkit-backdrop-filter:blur(40px) saturate(1.6);",
      "  border:1px solid rgba(140,190,255,0.22);border-radius:18px;",
      "  box-shadow:0 20px 56px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.1);",
      "  overflow:hidden}",
      "#mg-agent-desk.hidden{display:none!important}",
      "#mg-agent-desk .hd{display:flex;align-items:center;justify-content:space-between;",
      "  padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.08);",
      "  font:650 10px/1 system-ui;letter-spacing:0.14em;text-transform:uppercase;",
      "  color:rgba(160,210,255,0.9)}",
      "#mg-agent-desk .tiers{display:flex;gap:4px;padding:8px 10px;flex-wrap:wrap}",
      "#mg-agent-desk .tier{appearance:none;border:1px solid rgba(255,255,255,0.12);",
      "  background:rgba(255,255,255,0.05);color:rgba(220,230,245,0.75);",
      "  font:650 9px/1 system-ui;letter-spacing:0.1em;padding:6px 8px;border-radius:999px;cursor:pointer}",
      "#mg-agent-desk .tier.on{border-color:rgba(140,200,255,0.55);color:#9fd0ff;",
      "  background:rgba(80,140,220,0.18)}",
      "#mg-agent-desk .log{flex:1;min-height:160px;max-height:38vh;overflow:auto;",
      "  padding:8px 12px;font:500 11px/1.45 ui-monospace,Menlo,monospace}",
      "#mg-agent-desk .row{margin:0 0 8px}",
      "#mg-agent-desk .role{font-weight:700;color:rgba(160,210,255,0.85);margin-right:6px}",
      "#mg-agent-desk .role.you{color:rgba(180,255,200,0.9)}",
      "#mg-agent-desk .role.sys{color:rgba(255,200,140,0.9)}",
      "#mg-agent-desk .role.ai{color:rgba(180,200,255,0.95)}",
      "#mg-agent-desk .composer{display:flex;gap:6px;padding:8px 10px;",
      "  border-top:1px solid rgba(255,255,255,0.08)}",
      "#mg-agent-desk input{flex:1;appearance:none;border:1px solid rgba(255,255,255,0.12);",
      "  background:rgba(0,0,0,0.28);color:inherit;border-radius:10px;padding:8px 10px;",
      "  font:500 12px/1.3 system-ui}",
      "#mg-agent-desk button.go{appearance:none;border:1px solid rgba(140,200,255,0.4);",
      "  background:rgba(60,120,200,0.25);color:#b8d8ff;border-radius:10px;",
      "  font:650 10px/1 system-ui;letter-spacing:0.08em;padding:8px 12px;cursor:pointer}",
      "#mg-agent-desk .quick{display:flex;flex-wrap:wrap;gap:4px;padding:0 10px 8px}",
      "#mg-agent-desk .quick button{appearance:none;border:1px solid rgba(255,255,255,0.1);",
      "  background:rgba(255,255,255,0.04);color:rgba(200,215,235,0.8);",
      "  font:600 9px/1 system-ui;padding:5px 7px;border-radius:8px;cursor:pointer}",
      /* FAB lives in #mg-rec-chip — hide orphan float */
      "#mg-agent-desk-fab{display:none!important}",
      "#mg-rec-chip #mg-rec-desk.on{border-color:rgba(140,200,255,0.6);color:#9fd0ff;",
      "  background:rgba(40,80,140,0.35)}",
    ].join("");
    document.documentElement.appendChild(st);
  }

  function syncRecDeskChip() {
    try {
      var btn = document.getElementById("mg-rec-desk");
      if (btn) btn.classList.toggle("on", !!state.open);
    } catch (e) {}
  }

  function paintLog() {
    if (!logEl) return;
    logEl.innerHTML = state.log
      .slice(-40)
      .map(function (r) {
        var cls =
          r.role === "you" ? "you" : r.role === "sys" ? "sys" : "ai";
        return (
          '<div class="row"><span class="role ' +
          cls +
          '">' +
          r.role +
          "·" +
          (r.tier || "") +
          "</span>" +
          escapeHtml(r.text) +
          "</div>"
        );
      })
      .join("");
    logEl.scrollTop = logEl.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function setTier(id) {
    state.tier = id;
    ensureUi();
    var buttons = root.querySelectorAll(".tier");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle("on", buttons[i].getAttribute("data-tier") === id);
    }
    pushLog("sys", "tier → " + id.toUpperCase());
    pub("mode", { mode: id });
  }

  /* ── action runners (AI can “move things” inside MG) ── */
  var ACTIONS = {
    help: function () {
      return (
        "Commands: /plan /build /verify /explore · /claim <product> · /climb · " +
        "/nav <url> · /tools · /qbit · /staff · /smoke · /curious · /break · /qa · " +
        "/draw · /annotate · /fix · /pick · /assess · /live · /bench · " +
        "/kbatch · /race · /sitrep · /uterm · /hexterm · /nterm · /presence · /peer"
      );
    },
    bench: function (arg) {
      try {
        if (window.__mgRightDrawer) {
          if (window.__mgRightDrawer.open) window.__mgRightDrawer.open();
          if (window.__mgRightDrawer.setMode)
            window.__mgRightDrawer.setMode("bench");
        }
        var sub = String(arg || "").trim().toLowerCase();
        if (sub && window.__mgDataBench) {
          if (sub === "electric" || sub === "signal" || sub === "construct" || sub === "data")
            window.__mgDataBench.setTrade(sub);
          else window.__mgDataBench.openTool(sub);
          if (window.__mgRightDrawer && window.__mgRightDrawer.setMode)
            window.__mgRightDrawer.setMode("bench");
        }
        return window.__mgDataBench
          ? window.__mgDataBench.report()
          : "bench open · inject mg-data-bench if empty";
      } catch (e) {
        return "bench err " + e;
      }
    },
    pick: function (arg) {
      var C = window.__mgLiveCollab;
      if (!C) return "live collab missing — ⌘⇧R";
      var sub = String(arg || "on").trim().toLowerCase();
      if (sub === "off") {
        C.pick(false);
        return "PICK off";
      }
      if (sub === "toggle") {
        C.togglePick();
        return C.report();
      }
      C.pick(true);
      return "PICK on · hover structure · click to pin · " + C.report();
    },
    probe: function (arg) {
      return ACTIONS.pick(arg);
    },
    assess: function () {
      var C = window.__mgLiveCollab;
      if (!C || !C.lastAssess || !C.lastAssess())
        return "no pick yet — /pick then click an element";
      var a = C.lastAssess();
      pushLog("sys", C.formatAssess(a));
      pushLog("ai", C.diagnose(a));
      return "assessed last pick";
    },
    live: function () {
      pushLog(
        "sys",
        "Live link · DRAW strokes stream here · /pick for Cursor-style structure · FIX ships packet"
      );
      if (window.__mgLiveCollab) return window.__mgLiveCollab.report();
      return "collab hub pending";
    },
    draw: function (arg) {
      var A = window.__mgSiteAnnotate || window.screenAnnotate;
      if (!A) return "draw missing — inject mg-site-annotate (⌘⇧R)";
      var sub = String(arg || "on").trim().toLowerCase();
      if (sub === "off") {
        if (A.deactivate) A.deactivate();
        return "DRAW off";
      }
      if (sub === "clear") {
        if (A.clear) A.clear();
        return "DRAW cleared";
      }
      if (sub === "fix" || sub.indexOf("fix") === 0) {
        if (A.shipFix) {
          A.shipFix(sub.replace(/^fix\s*/, "") || "");
          return "FIX packet shipped from DRAW";
        }
        return "shipFix missing";
      }
      if (sub === "toggle") {
        if (A.toggle) A.toggle();
        else if (A.isActive && A.isActive()) A.deactivate();
        else if (A.activate) A.activate();
        return A.report ? A.report() : "DRAW toggled";
      }
      if (A.activate) A.activate();
      return A.report ? A.report() : "DRAW on · ⌘⇧A";
    },
    annotate: function (arg) {
      return ACTIONS.draw(arg);
    },
    fix: function (arg) {
      var A = window.__mgSiteAnnotate || window.screenAnnotate;
      if (!A || !A.shipFix) return "draw/FIX missing — open ✎ DRAW first (⌘⇧R if needed)";
      var note = String(arg || "").trim();
      A.shipFix(note);
      return "FIX packet · clipboard + bus · " + (A.report ? A.report() : "ok");
    },
    claim: function (arg) {
      var product = (arg || state.project || "memory-glass").trim();
      state.project = product;
      var T = truss();
      if (!T) return "truss missing — inject qbit-truss";
      var c = T.claim({
        product: product,
        title: "desk-" + state.tier + "-" + product,
        monetize: false,
      });
      return "claimed " + product + " @ " + (c.path || "?");
    },
    climb: function () {
      var T = truss();
      if (!T) return "truss missing";
      T.climb("agent-desk " + state.tier);
      return T.report();
    },
    nav: function (arg) {
      var url = (arg || "https://kbatch.ugrad.ai/").trim();
      try {
        if (window.ipc && window.ipc.postMessage) {
          window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
          return "navigate " + url;
        }
      } catch (e) {}
      try {
        location.href = url;
        return "location " + url;
      } catch (e2) {
        return "nav failed";
      }
    },
    tools: function () {
      try {
        if (window.__mgGlassCap && window.__mgGlassCap.openTools) {
          window.__mgGlassCap.openTools();
          return "TOOLS open";
        }
        if (window.__mgMenus && window.__mgMenus.open) {
          window.__mgMenus.open("tools");
          return "menus tools";
        }
      } catch (e) {}
      return "tools API missing";
    },
    qbit: function () {
      var parts = [];
      try {
        if (window.__mgQbitLoop) parts.push(window.__mgQbitLoop.report());
        if (window.__mgQbitBus) parts.push(window.__mgQbitBus.report());
        if (window.__mgQbitNative) parts.push(window.__mgQbitNative.report());
        if (window.__mgQbitAdapters) parts.push(window.__mgQbitAdapters.report());
        if (window.__mgQbitTerm) parts.push(window.__mgQbitTerm.report());
        if (truss()) parts.push(truss().report());
      } catch (e) {}
      return parts.join(" · ") || "qbit spine pending (⌘⇧R?)";
    },
    smoke: function () {
      var ok = [];
      try {
        if (window.__mgQbitLoop && window.__mgQbitLoop.selfTest) {
          var s = window.__mgQbitLoop.selfTest();
          ok.push("loop=" + (s.ok ? "PASS" : "FAIL"));
        }
        if (truss() && truss().selfTest) {
          var t = truss().selfTest();
          ok.push("truss=" + (t.ok ? "PASS" : "FAIL"));
        }
        if (term() && term().selfTest) {
          var u = term().selfTest();
          ok.push("term=" + (u.ok ? "PASS" : "FAIL"));
        }
      } catch (e) {
        return "smoke err " + e;
      }
      pub("verify", { ok: ok });
      return ok.join(" ") || "no selfTests";
    },
    staff: function () {
      try {
        if (window.__mgStaffLab && window.__mgStaffLab.embedInto) return "staff lab present";
        if (window.__mgKeyboardBeats) return "beats " + (window.__mgKeyboardBeats.report
          ? window.__mgKeyboardBeats.report()
          : "ok");
      } catch (e) {}
      return "staff/beats pending";
    },
    kbatch: function () {
      return ACTIONS.nav("https://kbatch.ugrad.ai/");
    },
    race: function () {
      if (window.__mgQbitRace) {
        var s = window.__mgQbitRace.publish({ openRace: true, climb: "desk-race" });
        return s.line || window.__mgQbitRace.report();
      }
      if (truss() && truss().openCoreRace) {
        truss().openCoreRace();
        truss().climb("open core-race");
        return "core-race opened + climb";
      }
      return ACTIONS.nav("https://mueee.qbitos.ai/qbit-core-race.html");
    },
    sitrep: function () {
      if (!window.__mgQbitRace) return "sitrep missing — inject qbit-race-sitrep";
      var s = window.__mgQbitRace.publish({});
      return s.line || window.__mgQbitRace.report();
    },
    uterm: function () {
      if (window.__mgQbitL1Pilot && window.__mgQbitL1Pilot.openUterm) {
        window.__mgQbitL1Pilot.openUterm();
        return "uterm L1 open · " + window.__mgQbitL1Pilot.report();
      }
      return "l1 pilot missing";
    },
    hexterm: function () {
      if (window.__mgQbitL1Pilot && window.__mgQbitL1Pilot.openHexterm) {
        window.__mgQbitL1Pilot.openHexterm();
        return "hexterm L1 pilot (nterminal) · " + window.__mgQbitL1Pilot.report();
      }
      return "l1 pilot missing";
    },
    nterm: function () {
      if (window.__mgQbitL1Pilot && window.__mgQbitL1Pilot.openNterm) {
        window.__mgQbitL1Pilot.openNterm();
        return "nterminal L1 · " + window.__mgQbitL1Pilot.report();
      }
      return "l1 pilot missing";
    },
    presence: function () {
      if (!window.__mgQbitL1Pilot) return "l1 pilot missing";
      var p =
        window.__mgQbitL1Pilot.publishPresence &&
        window.__mgQbitL1Pilot.publishPresence({ force: true, term: "desk" });
      var list =
        (window.__mgQbitL1Pilot.seats && window.__mgQbitL1Pilot.seats()) || [];
      var ids = list
        .map(function (s) {
          return (s.id || "?").slice(0, 10) + ":" + (s.term || "?");
        })
        .join(" ");
      return (
        "presence · seats=" +
        list.length +
        (ids ? " · " + ids : "") +
        (p ? " · published" : "") +
        " · " +
        window.__mgQbitL1Pilot.report()
      );
    },
    desk: function () {
      return report();
    },
    curious: function () {
      state.curiosity++;
      state.tier = "explore";
      var ideas = [
        "What if Staff notes published velocity to DAC ch2 on every hit?",
        "What if living-books pages auto-classify via QbitCodec on open?",
        "What if dormant worker trained WebGrid rows while you stream?",
        "What if peer Grok claimed kbatch and this desk claimed MG at the same time?",
        "What if IronLine L3 EMA drove core-race Q meter live?",
        "What if term-snap FIX packets auto-opened /verify tier?",
      ];
      var idea = ideas[state.curiosity % ideas.length];
      pub("explore", { idea: idea, n: state.curiosity });
      if (term()) term().publishBus({ text: idea, kind: "term", termId: "agent-desk" });
      return "δ curious · " + idea;
    },
    break: function () {
      state.tier = "explore";
      /* intentional soft stress — high-rate bus pubs (backpressure test) */
      var n = 0;
      if (bus()) {
        for (var i = 0; i < 40; i++) {
          bus().publish({
            src: "agent-desk",
            kind: "traj",
            lane: "L0",
            payload: { stress: i, breakTest: true },
          });
          n++;
        }
      }
      var rep = bus() ? bus().report() : "no bus";
      return "break-it · fired " + n + " traj · " + rep;
    },
    qa: function () {
      state.tier = "verify";
      var checks = [];
      checks.push(window.__mgQbitBus ? "bus✓" : "bus✗");
      checks.push(window.__mgQbitLoop ? "loop✓" : "loop✗");
      checks.push(window.__mgQbitTruss ? "truss✓" : "truss✗");
      checks.push(window.__mgQbitNative ? "native✓" : "native✗");
      checks.push(window.__mgQbitTerm ? "term✓" : "term✗");
      checks.push(window.__mgQbitAdapters ? "adapters✓" : "adapters✗");
      checks.push(window.__mgIronline ? "iron✓" : "iron✗");
      var msg = "QA " + checks.join(" ");
      pub("verify", { checks: checks });
      return msg;
    },
    peer: function () {
      var h = null;
      if (truss()) {
        h = truss().handoff({
          product: state.project,
          to: "peer-grok",
          summary:
            "Collab: agent-desk " +
            state.tier +
            " · join leap/kbatch · no SYMBOLS fork",
          prompt:
            "Read OS_FLIGHT_PATH.md + FLEET.md. Peer owns catalogue/term-snap/chrome/kbatch content. This desk owns native/truss/term/dormant.",
        });
      }
      return h
        ? "peer handoff " + h.id + " · " + h.summary
        : "truss handoff failed";
    },
    persona: function (arg) {
      if (!truss()) return "truss missing";
      truss().adoptPersona({
        name: (arg || "mg-desk-agent").trim(),
        goal: "month-collab-stream",
        kbatch: true,
        monetize: false,
      });
      return truss().report();
    },
  };

  function runLine(raw) {
    var line = String(raw || "").trim();
    if (!line) return;
    pushLog("you", line);
    pub("chat", { text: line });

    var out = "";
    if (line.charAt(0) === "/") {
      var sp = line.slice(1).split(/\s+/);
      var cmd = (sp[0] || "").toLowerCase();
      var arg = sp.slice(1).join(" ");
      if (cmd === "plan" || cmd === "build" || cmd === "verify" || cmd === "explore") {
        setTier(cmd);
        out = "switched to " + cmd;
      } else if (ACTIONS[cmd]) {
        try {
          out = ACTIONS[cmd](arg);
        } catch (e) {
          out = "err " + e;
        }
      } else {
        out = ACTIONS.help();
      }
    } else {
      /* free text → classify on L3 + tier reaction */
      if (window.__mgQbitLoop)
        window.__mgQbitLoop.classifyAsync(line, "agent-desk");
      if (term()) term().publishBus({ text: line, kind: "chat", termId: "agent-desk" });
      if (state.tier === "explore") {
        out = ACTIONS.curious();
      } else if (state.tier === "verify") {
        out = ACTIONS.qa() + " · heard: " + line.slice(0, 80);
      } else if (state.tier === "build") {
        out =
          "build note logged · claim " +
          state.project +
          " if needed · /claim " +
          state.project;
        if (truss())
          truss().handoff({
            product: state.project,
            to: "build",
            summary: line.slice(0, 160),
          });
      } else {
        out =
          "plan · " +
          line.slice(0, 100) +
          " · try /curious /qa /claim kbatch /race";
      }
    }
    pushLog("ai", out);
    state.lastAction = { line: line, out: out, t: Date.now() };
    return out;
  }

  function ensureUi() {
    ensureCss();
    if (root) return;
    /* Entry lives on #mg-rec-desk (session-recorder chip). No second float FAB. */
    var fab = document.getElementById("mg-agent-desk-fab");
    if (fab) fab.style.display = "none";
    root = document.createElement("div");
    root.id = "mg-agent-desk";
    root.className = "hidden";
    root.innerHTML =
      '<div class="hd"><span>MG · Agent Desk · ' +
      VER +
      '</span><span style="cursor:pointer;opacity:0.7" id="mg-ad-x">✕</span></div>' +
      '<div class="tiers" id="mg-ad-tiers"></div>' +
      '<div class="log" id="mg-ad-log"></div>' +
      '<div class="quick" id="mg-ad-quick"></div>' +
      '<div class="composer"><input id="mg-ad-in" placeholder="/claim kbatch · /curious · /qa · free text…" />' +
      '<button class="go" type="button" id="mg-ad-go">SEND</button></div>';
    document.documentElement.appendChild(root);
    logEl = root.querySelector("#mg-ad-log");
    inEl = root.querySelector("#mg-ad-in");
    var tiersEl = root.querySelector("#mg-ad-tiers");
    TIERS.forEach(function (T) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tier" + (T.id === state.tier ? " on" : "");
      b.setAttribute("data-tier", T.id);
      b.textContent = T.glyph + " " + T.label;
      b.onclick = function () {
        setTier(T.id);
      };
      tiersEl.appendChild(b);
    });
    var quick = root.querySelector("#mg-ad-quick");
    [
      ["/claim memory-glass", "claim MG"],
      ["/claim kbatch", "claim kbatch"],
      ["/curious", "curious"],
      ["/qa", "QA"],
      ["/break", "break"],
      ["/smoke", "smoke"],
      ["/race", "race"],
      ["/sitrep", "sitrep"],
      ["/uterm", "uterm"],
      ["/hexterm", "hexterm"],
      ["/nterm", "nterm"],
      ["/presence", "presence"],
      ["/peer", "peer"],
      ["/kbatch", "kbatch"],
      ["/draw", "draw"],
      ["/fix", "fix"],
      ["/pick", "pick"],
      ["/assess", "assess"],
      ["/live", "live"],
      ["/bench", "bench"],
    ].forEach(function (pair) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = pair[1];
      b.onclick = function () {
        runLine(pair[0]);
      };
      quick.appendChild(b);
    });
    root.querySelector("#mg-ad-x").onclick = function () {
      toggle(false);
    };
    root.querySelector("#mg-ad-go").onclick = function () {
      var v = inEl.value;
      inEl.value = "";
      runLine(v);
    };
    inEl.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        var v = inEl.value;
        inEl.value = "";
        runLine(v);
      }
    });
  }

  function toggle(on) {
    ensureUi();
    if (on == null) on = root.classList.contains("hidden");
    state.open = !!on;
    root.classList.toggle("hidden", !on);
    var fab = document.getElementById("mg-agent-desk-fab");
    if (fab) fab.style.display = "none";
    syncRecDeskChip();
    if (on && !state.log.length) {
      pushLog(
        "sys",
        "Live desk · DRAW strokes stream here · /pick = Cursor-style hover structure · " +
          "α plan · β build · γ verify · δ explore."
      );
      pushLog("ai", ACTIONS.help());
      if (window.__mgLiveCollab) {
        pushLog("sys", "collab · " + window.__mgLiveCollab.report());
      }
      if (truss()) {
        truss().adoptPersona({
          name: "mg-desk",
          goal: "month-collab-stream",
          kbatch: true,
        });
      }
    }
    if (on && inEl) inEl.focus();
  }

  function report() {
    return (
      VER +
      " open=" +
      state.open +
      " tier=" +
      state.tier +
      " project=" +
      state.project +
      " log=" +
      state.log.length +
      " curiosity=" +
      state.curiosity
    );
  }

  window.__mgAgentDesk = {
    ver: VER,
    open: function () {
      toggle(true);
    },
    close: function () {
      toggle(false);
    },
    toggle: toggle,
    run: runLine,
    runLine: runLine,
    pushLog: pushLog,
    setTier: setTier,
    state: state,
    report: report,
    TIERS: TIERS,
  };

  /* boot fab after paint */
  setTimeout(function () {
    try {
      if (document.getElementById("pip-wrap")) return; /* inspect stays clean */
      ensureUi();
    } catch (e) {}
  }, 800);

  log(VER + " · multi-tier agent desk inside MG");
})();
