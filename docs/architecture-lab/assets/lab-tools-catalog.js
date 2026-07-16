/**
 * Lab tool catalog — mirrors xai-grok-tools taxonomy (presentation labels).
 * Synced conceptually with monorepo ToolKind after path-checkout of upstream.
 * Used by Workbench/Agent to show tool cards when iterate/stream mentions tools.
 */
(function (global) {
  "use strict";

  /** @type {{id:string,label:string,readOnly:boolean,namespace:string}[]} */
  const CATALOG = [
    { id: "read_file", label: "Read", readOnly: true, namespace: "grok_build" },
    { id: "search_replace", label: "Edit", readOnly: false, namespace: "grok_build" },
    { id: "list_dir", label: "List Files", readOnly: true, namespace: "grok_build" },
    { id: "grep", label: "Search", readOnly: true, namespace: "grok_build" },
    { id: "bash", label: "Run Command", readOnly: false, namespace: "grok_build" },
    { id: "run_terminal_cmd", label: "Run Command", readOnly: false, namespace: "grok_build" },
    { id: "web_search", label: "Web Search", readOnly: true, namespace: "grok_build" },
    { id: "web_fetch", label: "Web Fetch", readOnly: true, namespace: "grok_build" },
    { id: "image_gen", label: "Generate Image", readOnly: false, namespace: "grok_build" },
    { id: "image_edit", label: "Edit Image", readOnly: false, namespace: "grok_build" },
    { id: "video_gen", label: "Generate Video", readOnly: false, namespace: "grok_build" },
    { id: "monitor", label: "Monitor", readOnly: false, namespace: "grok_build" },
    { id: "task", label: "Subagent", readOnly: false, namespace: "grok_build" },
    { id: "task_output", label: "Background Task", readOnly: true, namespace: "grok_build" },
    { id: "kill_task", label: "Kill Task", readOnly: false, namespace: "grok_build" },
    { id: "scheduler_create", label: "Scheduler", readOnly: false, namespace: "grok_build" },
    { id: "enter_plan_mode", label: "Enter Plan Mode", readOnly: true, namespace: "grok_build" },
    { id: "exit_plan_mode", label: "Exit Plan Mode", readOnly: true, namespace: "grok_build" },
    { id: "ask_user_question", label: "Ask User", readOnly: true, namespace: "grok_build" },
    { id: "update_goal", label: "Update Goal", readOnly: false, namespace: "grok_build" },
    { id: "todo", label: "Todo", readOnly: false, namespace: "grok_build" },
    { id: "lsp", label: "Code Intelligence", readOnly: true, namespace: "grok_build" },
    { id: "search_tool", label: "Search Tools", readOnly: true, namespace: "grok_build" },
    { id: "use_tool", label: "Use Tool", readOnly: false, namespace: "grok_build" },
    { id: "memory_search", label: "Memory Search", readOnly: true, namespace: "grok_build" },
    { id: "memory_get", label: "Memory Read", readOnly: true, namespace: "grok_build" },
    { id: "skill", label: "Skill", readOnly: false, namespace: "grok_build" },
    { id: "deploy_app", label: "Deploy App", readOnly: false, namespace: "grok_build" },
    // codex / opencode namespaces (same semantics)
    { id: "Read", label: "Read", readOnly: true, namespace: "codex" },
    { id: "Shell", label: "Run Command", readOnly: false, namespace: "opencode" },
    { id: "apply_patch", label: "Edit", readOnly: false, namespace: "codex" },
  ];

  const BY_ID = Object.create(null);
  CATALOG.forEach((t) => {
    BY_ID[t.id.toLowerCase()] = t;
  });

  function list() {
    return CATALOG.slice();
  }

  function lookup(name) {
    if (!name) return null;
    return BY_ID[String(name).toLowerCase()] || null;
  }

  /** Extract tool-like tokens from grok -p / agent text for tool cards */
  function extractFromText(text) {
    const found = [];
    const seen = new Set();
    const s = String(text || "");
    // patterns: tool call lines, backticks, XML-ish tool tags
    const re =
      /\b(read_file|search_replace|list_dir|grep|bash|web_search|web_fetch|image_gen|image_edit|video_gen|monitor|task_output|kill_task|enter_plan_mode|exit_plan_mode|ask_user_question|update_goal|run_terminal_cmd|apply_patch|scheduler_\w+|use_tool|search_tool|memory_search|memory_get)\b/gi;
    let m;
    while ((m = re.exec(s))) {
      const id = m[1].toLowerCase();
      if (seen.has(id)) continue;
      seen.add(id);
      const meta = lookup(id) || { id: id, label: id, readOnly: false, namespace: "detected" };
      found.push(meta);
    }
    return found;
  }

  global.LabToolsCatalog = {
    list: list,
    lookup: lookup,
    extractFromText: extractFromText,
    version: 1,
    source: "xai-grok-tools ToolKind / grok_build pack (path-checkout)",
  };
})(typeof window !== "undefined" ? window : globalThis);
