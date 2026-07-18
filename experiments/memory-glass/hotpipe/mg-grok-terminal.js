/* Memory Glass · GROK TERMINAL float
 * Glass-morphism terminal handler bridge for Grok Build (xai-org/grok-build).
 * Foundation for MG ↔ Grok communication: status, tool roster, open external TUI,
 * allowlisted local probes. Full PTY agent host can land on ptyctl later.
 * VER: mg-grok-term-v1
 */
(function () {
  "use strict";
  var VER = "mg-grok-term-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._grokTermVer === VER) return;
  HP._grokTermVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "grok-term");
    } catch (e) {}
  }

  /* Tool surface aligned with monorepo xai-grok-tools (path-checked SOURCE_REV) */
  var TOOL_ROSTER = [
    { id: "bash", name: "run_terminal_command", note: "shell / PTY · login env" },
    { id: "read_file", name: "read_file", note: "files · images · PDF" },
    { id: "search_replace", name: "search_replace", note: "precise edits" },
    { id: "grep", name: "grep", note: "ripgrep codebase" },
    { id: "list_dir", name: "list_dir", note: "tree summary" },
    { id: "web_search", name: "web_search", note: "web + citations" },
    { id: "web_fetch", name: "web_fetch", note: "page → markdown" },
    { id: "task", name: "spawn_subagent", note: "explore · plan · build" },
    { id: "monitor", name: "monitor", note: "stream background events" },
    { id: "todo", name: "todo_write", note: "structured task list" },
    { id: "image_gen", name: "image_gen", note: "Imagine images" },
    { id: "image_edit", name: "image_edit", note: "image-to-image" },
    { id: "video_gen", name: "image_to_video / reference", note: "video gen" },
    { id: "mcp", name: "search_tool / use_tool", note: "MCP integrations" },
    { id: "scheduler", name: "scheduler_*", note: "recurring prompts" },
    { id: "plan", name: "enter/exit_plan_mode", note: "design plans" },
    { id: "goal", name: "update_goal", note: "goal mode progress" },
  ];

  var open = false;
  var el = null;
  var outEl = null;
  var inEl = null;
  var lines = [];

  function post(op, extra) {
    try {
      var o = Object.assign({ op: op }, extra || {});
      if (window.ipc) window.ipc.postMessage(JSON.stringify(o));
      return true;
    } catch (e) {
      return false;
    }
  }

  function ensureCss() {
    var old = document.getElementById("mg-grok-term-css");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "mg-grok-term-css";
    st.textContent = [
      "#mg-grok-term{",
      "  position:fixed;right:16px;bottom:16px;z-index:2147483010;",
      "  width:min(480px,94vw);max-height:min(62vh,560px);",
      "  display:flex;flex-direction:column;pointer-events:auto;",
      "  font:500 12px/1.35 ui-monospace,Menlo,SF Mono,monospace;",
      "  color:rgba(230,240,255,0.94);",
      "  background:rgba(28,30,36,0.58);",
      "  backdrop-filter:blur(48px) saturate(1.8);-webkit-backdrop-filter:blur(48px) saturate(1.8);",
      "  border:1px solid rgba(255,255,255,0.12);border-radius:18px;",
      "  box-shadow:0 18px 48px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.12);",
      "  overflow:hidden}",
      "#mg-grok-term.hidden{display:none!important}",
      "#mg-grok-term .hd{",
      "  display:flex;align-items:center;justify-content:space-between;gap:8px;",
      "  padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.1);",
      "  background:rgba(12,14,20,0.4)}",
      "#mg-grok-term .hd .ttl{",
      "  font:700 11px/1 system-ui;letter-spacing:0.1em;text-transform:uppercase;",
      "  color:rgba(160,220,255,0.98)}",
      "#mg-grok-term .hd .ttl .dot{",
      "  display:inline-block;width:7px;height:7px;border-radius:50%;",
      "  background:rgba(80,220,140,0.95);margin-right:8px;",
      "  box-shadow:0 0 8px rgba(80,220,140,0.5)}",
      "#mg-grok-term .hd .acts{display:flex;gap:6px}",
      "#mg-grok-term .hd button{",
      "  appearance:none;cursor:pointer;border:0;border-radius:999px;",
      "  padding:0 10px;height:26px;font:600 10px/26px system-ui;",
      "  background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.92)}",
      "#mg-grok-term .hd button:hover{background:rgba(255,255,255,0.16)}",
      "#mg-grok-term .hd button.x{width:26px;padding:0;border-radius:50%}",
      "#mg-grok-term .out{",
      "  flex:1;overflow-y:auto;padding:10px 12px;min-height:160px;",
      "  background:rgba(0,0,0,0.28);",
      "  white-space:pre-wrap;word-break:break-word;",
      "  font:500 11px/1.45 ui-monospace,Menlo,monospace;",
      "  color:rgba(200,230,210,0.92)}",
      "#mg-grok-term .out .sys{color:rgba(160,190,220,0.75)}",
      "#mg-grok-term .out .ok{color:rgba(120,230,160,0.95)}",
      "#mg-grok-term .out .err{color:rgba(255,140,140,0.95)}",
      "#mg-grok-term .out .cmd{color:rgba(160,210,255,0.95)}",
      "#mg-grok-term .tools{",
      "  max-height:110px;overflow-y:auto;padding:6px 10px;",
      "  border-top:1px solid rgba(255,255,255,0.06);",
      "  display:flex;flex-wrap:wrap;gap:4px}",
      "#mg-grok-term .tools span{",
      "  font:600 9px/1 system-ui;letter-spacing:0.03em;",
      "  padding:4px 7px;border-radius:6px;",
      "  background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);",
      "  color:rgba(200,215,230,0.85)}",
      "#mg-grok-term .row{",
      "  display:flex;gap:8px;padding:8px 10px;border-top:1px solid rgba(255,255,255,0.1)}",
      "#mg-grok-term .row input{",
      "  flex:1;appearance:none;border-radius:10px;padding:8px 10px;",
      "  border:1px solid rgba(255,255,255,0.14);background:rgba(0,0,0,0.32);",
      "  color:rgba(255,255,255,0.95);font:600 12px/1.2 ui-monospace,Menlo,monospace;",
      "  outline:none}",
      "#mg-grok-term .row input:focus{border-color:rgba(100,180,255,0.55)}",
      "#mg-grok-term .row button.go{",
      "  appearance:none;cursor:pointer;border:0;border-radius:10px;",
      "  padding:0 14px;font:700 11px/1 system-ui;color:#fff;",
      "  background:rgba(10,132,255,0.92)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function push(kind, text) {
    lines.push({ kind: kind || "sys", text: String(text || "") });
    if (lines.length > 200) lines = lines.slice(-160);
    if (!outEl) return;
    var html = lines
      .map(function (L) {
        return (
          '<div class="' +
          (L.kind || "sys") +
          '">' +
          escapeHtml(L.text) +
          "</div>"
        );
      })
      .join("");
    outEl.innerHTML = html;
    outEl.scrollTop = outEl.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function banner() {
    push("sys", "Memory Glass · Grok terminal bridge · " + VER);
    push(
      "sys",
      "Comm foundation for xai-org/grok-build · monorepo tools live in crates/codegen/xai-grok-tools"
    );
    push("ok", "Commands: /status  /tools  /version  /open  /clear  or free text → external grok");
    try {
      if (window.__MG_SOURCE_REV)
        push("sys", "SOURCE_REV " + window.__MG_SOURCE_REV);
    } catch (e) {}
  }

  function showTools() {
    push("cmd", "/tools · monorepo agent tool surface");
    TOOL_ROSTER.forEach(function (T) {
      push("sys", "  · " + T.name + "  (" + T.id + ") — " + T.note);
    });
    push(
      "ok",
      "Shell 0.2.105+: login-env bash, /summarize, /jump, /timeline, Grok 4.5 default, snap-prompt, static shell sessions"
    );
  }

  function handleLine(raw) {
    var line = String(raw || "").trim();
    if (!line) return;
    push("cmd", "› " + line);
    var low = line.toLowerCase();
    if (low === "/clear" || low === "clear") {
      lines = [];
      banner();
      return;
    }
    if (low === "/tools" || low === "tools") {
      showTools();
      return;
    }
    if (low === "/status" || low === "status") {
      post("grok_term", { action: "status" });
      push("sys", "probing grok · SOURCE_REV · host…");
      try {
        push(
          "ok",
          "MG product=" +
            !!window.__mgProductMode +
            " drawer=" +
            !!(window.__mgToolsDrawer && window.__mgToolsDrawer.ver) +
            " rubik=" +
            (window.__mgRubikLang && window.__mgRubikLang.ver)
        );
      } catch (e) {}
      return;
    }
    if (low === "/version" || low === "version" || low === "grok --version") {
      post("grok_term", { action: "version" });
      push("sys", "requesting grok --version via shell…");
      return;
    }
    if (low === "/open" || low === "open" || low === "grok") {
      post("grok_term", { action: "open", line: "" });
      push("ok", "opening external Grok TUI (Terminal / grok)…");
      return;
    }
    /* free text: hand to external grok with prompt seed */
    post("grok_term", { action: "open", line: line });
    push("ok", "seeded external grok session with prompt (when host supports)");
  }

  function paintToolsChips() {
    var box = el && el.querySelector("#mg-grok-tools");
    if (!box) return;
    box.innerHTML = "";
    TOOL_ROSTER.slice(0, 12).forEach(function (T) {
      var s = document.createElement("span");
      s.textContent = T.id;
      s.title = T.name + " — " + T.note;
      box.appendChild(s);
    });
  }

  function ensure() {
    if (el && document.body.contains(el)) return;
    ensureCss();
    el = document.createElement("div");
    el.id = "mg-grok-term";
    el.className = "hidden";
    el.innerHTML =
      '<div class="hd">' +
      '  <div class="ttl"><span class="dot"></span>Grok · terminal</div>' +
      '  <div class="acts">' +
      '    <button type="button" id="mg-gt-tools">TOOLS</button>' +
      '    <button type="button" id="mg-gt-open">OPEN TUI</button>' +
      '    <button type="button" class="x" id="mg-gt-x">×</button>' +
      "  </div>" +
      "</div>" +
      '<div class="out" id="mg-gt-out"></div>' +
      '<div class="tools" id="mg-grok-tools"></div>' +
      '<div class="row">' +
      '  <input id="mg-gt-in" type="text" autocomplete="off" spellcheck="false" placeholder="/status · /tools · /open · or prompt…" />' +
      '  <button type="button" class="go" id="mg-gt-go">RUN</button>' +
      "</div>";
    (document.body || document.documentElement).appendChild(el);
    outEl = el.querySelector("#mg-gt-out");
    inEl = el.querySelector("#mg-gt-in");
    el.querySelector("#mg-gt-x").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      close();
    };
    el.querySelector("#mg-gt-tools").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      showTools();
    };
    el.querySelector("#mg-gt-open").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      handleLine("/open");
    };
    el.querySelector("#mg-gt-go").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      if (inEl) {
        handleLine(inEl.value);
        inEl.value = "";
      }
    };
    if (inEl) {
      inEl.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          handleLine(inEl.value);
          inEl.value = "";
        }
      });
    }
    paintToolsChips();
  }

  function openPanel() {
    ensure();
    open = true;
    el.classList.remove("hidden");
    if (lines.length === 0) banner();
    try {
      if (inEl) inEl.focus();
    } catch (e) {}
    log(VER + " · open");
  }

  function close() {
    open = false;
    if (el) el.classList.add("hidden");
  }

  function toggle() {
    if (open) close();
    else openPanel();
  }

  /* host pushes results: window.__mgGrokTerm.push("ok", "…") */
  window.__mgGrokTerm = {
    ver: VER,
    open: openPanel,
    close: close,
    toggle: toggle,
    isOpen: function () {
      return open;
    },
    push: push,
    tools: TOOL_ROSTER,
    handle: handleLine,
    report: function () {
      return VER + " open=" + open + " lines=" + lines.length;
    },
  };
  log(VER + " · grok terminal bridge ready");
})();
