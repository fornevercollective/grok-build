/**
 * Grok Build Lab — Ship deck
 * Interactive rehearsal of plan · skills · plugins · Q&A · subagents
 * Matches the x.ai/cli "everything you need to ship" surface in the lab.
 */
(function () {
  "use strict";

  const LS_KEY = "lab.ship.v1";

  const FEATURES = [
    {
      id: "plan",
      title: "Plan mode",
      blurb: "Propose a structured approach before writing code",
      tui: "/plan · Shift+Tab · enter_plan_mode",
      lab: "This panel · plan rehearsal",
    },
    {
      id: "subagents",
      title: "Subagents",
      blurb: "Spawn parallel agents for testing and research",
      tui: "spawn_subagent · explore/plan/gp",
      lab: "Parallel cards · lab-explorer agent",
    },
    {
      id: "skills",
      title: "Skills",
      blurb: "Turn workflows into reusable slash commands",
      tui: "SKILL.md · auto-invoke · /skillify",
      lab: "lab-ship skills · skill cards",
    },
    {
      id: "hooks",
      title: "Hooks",
      blurb: "Run scripts on file edits and tool calls",
      tui: "hooks.json · PreToolUse can deny",
      lab: "SessionStart orientation",
    },
    {
      id: "mcp",
      title: "MCP servers",
      blurb: "Connect to Linear, Sentry, Grafana, and more",
      tui: "Ctrl+L · MCP tab · .mcp.json",
      lab: "Catalog + install recipes",
    },
    {
      id: "agents-md",
      title: "AGENTS.md",
      blurb: "Set conventions and rules per directory",
      tui: "AGENTS.md discovery",
      lab: "Lab conventions doc",
    },
    {
      id: "memory",
      title: "Memory",
      blurb: "Persist decisions and context across sessions",
      tui: "cross-session memory",
      lab: "Ship answers · notes",
    },
    {
      id: "search",
      title: "Code search",
      blurb: "Grep and navigate large codebases fast",
      tui: "grep · codebase tools",
      lab: "Docs filter · history search",
    },
    {
      id: "multiedit",
      title: "Multi-file edits",
      blurb: "Refactor across files with search-and-replace",
      tui: "search_replace tool",
      lab: "Via summoned Grok TUI",
    },
    {
      id: "git",
      title: "Git integration",
      blurb: "Stage, commit, push, and manage branches",
      tui: "built-in git tools",
      lab: "History tab · /api/git-log",
    },
    {
      id: "reason",
      title: "Deep reasoning",
      blurb: "Step-by-step thinking for hard problems",
      tui: "model reasoning turns",
      lab: "Chat · notes Ask",
    },
    {
      id: "web",
      title: "Web search",
      blurb: "Look up docs and packages from the terminal",
      tui: "web_search tool",
      lab: "X desk · external links",
    },
    {
      id: "terminal",
      title: "Terminal execution",
      blurb: "Run builds and tests with live streaming",
      tui: "shell · streaming",
      lab: "Footer term · multi-term",
    },
    {
      id: "headless",
      title: "Headless mode",
      blurb: "Script Grok Build in CI/CD pipelines",
      tui: "grok headless",
      lab: "status scripts · validate",
    },
    {
      id: "review",
      title: "Code review",
      blurb: "Line-by-line feedback before opening a PR",
      tui: "/review · review skill",
      lab: "lab-review skill",
    },
    {
      id: "sandbox",
      title: "Sandboxed execution",
      blurb: "Run untrusted code in isolated environments",
      tui: "sandbox mode",
      lab: "User-guide map",
    },
    {
      id: "bg",
      title: "Background tasks",
      blurb: "Monitor long-running builds and processes",
      tui: "monitor · background tools",
      lab: "Events API · multi-term",
    },
    {
      id: "theme",
      title: "Theming",
      blurb: "Customize colors, fonts, and appearance",
      tui: "themes · pager.toml",
      lab: "CSS tokens · brand page",
    },
    {
      id: "plugins",
      title: "Plugins",
      blurb: "Bundle skills, agents, hooks, MCP behind one install",
      tui: "marketplace · git install",
      lab: "lab-ship · gy-glyph-pins",
    },
    {
      id: "qa",
      title: "Q&A",
      blurb: "Ambiguous tasks get quick multiple-choice",
      tui: "ask_user_question",
      lab: "Q&A panel · chat text",
    },
    {
      id: "models",
      title: "Models",
      blurb: "Grok 4.5 for code/chat · Imagine · Voice · grok-build-0.1",
      tui: "model picker · docs.x.ai/developers/models",
      lab: "Official xAI page · pricing snapshot",
    },
    {
      id: "usecases",
      title: "Use cases",
      blurb: "Plan code · debug · docs · voice · research · creative",
      tui: "x.ai/grok/use-cases",
      lab: "Mapped to plan · Ship · agents",
    },
    {
      id: "brand",
      title: "Brand",
      blurb: "Unaltered marks · Written/Created with Grok · no endorsement",
      tui: "x.ai/legal/brand-guidelines",
      lab: "content/12-brand · assets/brand",
    },
    {
      id: "subprocessors",
      title: "Subprocessors",
      blurb: "xAI DPA vendor list (AWS, Cloudflare, LiveKit, …)",
      tui: "x.ai/legal/subprocessor-list",
      lab: "Trust board · MCP is your vendor",
    },
  ];

  const SKILLS = [
    {
      name: "plan-loop",
      desc: "Plan mode discipline · Q&A · approve before code",
      cmd: "/plan-loop",
    },
    {
      name: "lab-review",
      desc: "Speed · robustness · extension-fit review rubric",
      cmd: "skill lab-review",
    },
    {
      name: "ship-checklist",
      desc: "status.x.ai go/no-go · Pages pre-deploy",
      cmd: "/ship-check",
    },
  ];

  const SUBS = [
    { id: "explore", label: "explore", task: "Map extension surfaces", status: "idle" },
    { id: "plan", label: "plan", task: "Draft ship matrix approach", status: "idle" },
    { id: "lab-explorer", label: "lab-explorer", task: "Research architecture-lab gaps", status: "idle" },
    { id: "lab-tester", label: "lab-tester", task: "Smoke APIs + static assets", status: "idle" },
  ];

  const QA = [
    {
      id: "ux",
      question: "Primary communication surface for operators?",
      options: [
        { id: "a", label: "Native dual chat + lab (Recommended)", desc: "Float chat always-on; lab for map/tools" },
        { id: "b", label: "TUI only", desc: "Stay inside grok pager exclusively" },
        { id: "c", label: "Web Pages only", desc: "Static docs + no local control plane" },
      ],
    },
    {
      id: "ext",
      question: "How should new workflows ship?",
      options: [
        { id: "a", label: "Plugins + skills (Recommended)", desc: "lab-ship / marketplace units" },
        { id: "b", label: "Fork the pager", desc: "Patch xai-grok-pager directly" },
        { id: "c", label: "One-off prompts", desc: "No reusable packaging" },
      ],
    },
    {
      id: "risk",
      question: "Before a big Pages push?",
      options: [
        { id: "a", label: "status.x.ai strict check (Recommended)", desc: "npm run status --prefix docs/architecture-lab" },
        { id: "b", label: "Push immediately", desc: "Skip health board" },
        { id: "c", label: "Only on weekends", desc: "Time-based policy" },
      ],
    },
  ];

  const PLAN_STEPS = [
    { id: "ctx", title: "Context", body: "Make Grok Build Lab the fastest, most robust surface for Grok↔user communication after partial open-source of the harness." },
    { id: "approach", title: "Approach", body: "Expand docs + Ship deck + lab-ship plugin (skills/agents/hooks). Harden chat text+voice. Prefer plugins over pager forks." },
    { id: "files", title: "Critical paths", body: "content/17-ship-everything.md · assets/ship-deck.js · plugin/lab-ship/** · chat.html · nav.json" },
    { id: "verify", title: "Verification", body: "serve.sh · Ship tab · Q&A persist · plugin validate · status.x.ai · Pages auto-reload" },
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveState(s) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(s));
    } catch (_) {}
  }

  function getState() {
    const s = loadState();
    if (!s.answers) s.answers = {};
    if (!s.planStatus) s.planStatus = "draft";
    if (!s.subStatus) s.subStatus = {};
    if (!s.featurePins) s.featurePins = {};
    return s;
  }

  function setSub(id, mode) {
    const root = $("ship-subs");
    if (!root) return;
    const card = root.querySelector('[data-sub="' + id + '"]');
    if (!card) return;
    card.dataset.status = mode;
    const badge = card.querySelector(".ship-badge");
    if (badge) badge.textContent = mode;
  }

  function renderFeatures() {
    const root = $("ship-features");
    if (!root) return;
    const s = getState();
    root.innerHTML = FEATURES.map((f) => {
      const pinned = s.featurePins[f.id] ? " pinned" : "";
      return (
        '<button type="button" class="ship-feature' +
        pinned +
        '" data-feature="' +
        f.id +
        '" title="' +
        escapeAttr(f.blurb) +
        '">' +
        '<span class="ship-feature-title">' +
        escapeHtml(f.title) +
        "</span>" +
        '<span class="ship-feature-blurb">' +
        escapeHtml(f.blurb) +
        "</span>" +
        '<span class="ship-feature-meta"><em>TUI</em> ' +
        escapeHtml(f.tui) +
        "</span>" +
        '<span class="ship-feature-meta"><em>Lab</em> ' +
        escapeHtml(f.lab) +
        "</span>" +
        "</button>"
      );
    }).join("");
    root.querySelectorAll(".ship-feature").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.feature;
        const st = getState();
        st.featurePins[id] = !st.featurePins[id];
        saveState(st);
        btn.classList.toggle("pinned", !!st.featurePins[id]);
        flash("Pinned " + (FEATURES.find((x) => x.id === id)?.title || id));
      });
    });
  }

  function renderSkills() {
    const root = $("ship-skills");
    if (!root) return;
    root.innerHTML = SKILLS.map(
      (sk) =>
        '<article class="ship-skill">' +
        "<header><strong>" +
        escapeHtml(sk.name) +
        '</strong><code class="ship-code">' +
        escapeHtml(sk.cmd) +
        "</code></header>" +
        "<p>" +
        escapeHtml(sk.desc) +
        "</p>" +
        '<button type="button" class="btn-mini primary" data-skill-copy="' +
        escapeAttr(sk.cmd) +
        '">Copy invoke</button>' +
        "</article>"
    ).join("");
    root.querySelectorAll("[data-skill-copy]").forEach((b) => {
      b.addEventListener("click", async () => {
        const t = b.getAttribute("data-skill-copy") || "";
        try {
          await navigator.clipboard.writeText(t);
          flash("Copied " + t);
        } catch {
          flash(t);
        }
      });
    });
  }

  function renderSubs() {
    const root = $("ship-subs");
    if (!root) return;
    const s = getState();
    root.innerHTML = SUBS.map((sub) => {
      const st = s.subStatus[sub.id] || "idle";
      return (
        '<article class="ship-sub" data-sub="' +
        sub.id +
        '" data-status="' +
        st +
        '">' +
        '<div class="ship-sub-head"><span class="ship-sub-label">' +
        escapeHtml(sub.label) +
        '</span><span class="ship-badge">' +
        escapeHtml(st) +
        "</span></div>" +
        '<p class="ship-sub-task">' +
        escapeHtml(sub.task) +
        "</p>" +
        "</article>"
      );
    }).join("");
  }

  function renderPlan() {
    const root = $("ship-plan-steps");
    if (!root) return;
    root.innerHTML = PLAN_STEPS.map(
      (step, i) =>
        '<li class="ship-plan-step" data-step="' +
        step.id +
        '">' +
        '<span class="ship-plan-n">' +
        (i + 1) +
        "</span>" +
        "<div><strong>" +
        escapeHtml(step.title) +
        "</strong><p>" +
        escapeHtml(step.body) +
        "</p></div></li>"
    ).join("");
    const status = $("ship-plan-status");
    if (status) {
      const s = getState();
      status.textContent = s.planStatus;
      status.dataset.status = s.planStatus;
    }
  }

  function renderQA() {
    const root = $("ship-qa");
    if (!root) return;
    const s = getState();
    root.innerHTML = QA.map((q, qi) => {
      const ans = s.answers[q.id] || "";
      return (
        '<fieldset class="ship-qa-block" data-q="' +
        q.id +
        '">' +
        "<legend>" +
        (qi + 1) +
        ". " +
        escapeHtml(q.question) +
        "</legend>" +
        q.options
          .map((opt) => {
            const sel = ans === opt.id ? " selected" : "";
            return (
              '<button type="button" class="ship-qa-opt' +
              sel +
              '" data-q="' +
              q.id +
              '" data-opt="' +
              opt.id +
              '">' +
              "<strong>" +
              escapeHtml(opt.label) +
              "</strong>" +
              "<span>" +
              escapeHtml(opt.desc) +
              "</span></button>"
            );
          })
          .join("") +
        "</fieldset>"
      );
    }).join("");
    root.querySelectorAll(".ship-qa-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const qid = btn.dataset.q;
        const oid = btn.dataset.opt;
        const st = getState();
        st.answers[qid] = oid;
        saveState(st);
        root.querySelectorAll('.ship-qa-opt[data-q="' + qid + '"]').forEach((b) => {
          b.classList.toggle("selected", b.dataset.opt === oid);
        });
        updateQAProgress();
        flash("Answer saved · feeds plan context");
      });
    });
    updateQAProgress();
  }

  function updateQAProgress() {
    const el = $("ship-qa-progress");
    if (!el) return;
    const s = getState();
    const n = QA.filter((q) => s.answers[q.id]).length;
    el.textContent = n + " / " + QA.length + " answered";
  }

  function renderPlugins() {
    const root = $("ship-plugins");
    if (!root) return;
    root.innerHTML =
      '<article class="ship-plugin">' +
      '<header><strong>lab-ship</strong><span class="pill">local</span></header>' +
      "<p>Plan loop · Q&A · review · ship-check · lab-explorer / lab-tester agents · SessionStart hook.</p>" +
      '<pre class="ship-pre">ln -sfn "$(pwd)/docs/architecture-lab/plugin/lab-ship" ~/.grok/plugins/lab-ship\n' +
      "grok plugin validate ~/.grok/plugins/lab-ship</pre>" +
      '<button type="button" class="btn-mini primary" id="ship-copy-install">Copy install</button>' +
      "</article>" +
      '<article class="ship-plugin">' +
      '<header><strong>gy-glyph-pins</strong><span class="pill">companion</span></header>' +
      "<p>Multi-user mesh pins · GrokYtalkY. Separate from lab-ship.</p>" +
      '<pre class="ship-pre"># source: GrokYtalkY/grok-plugin/gy-glyph-pins\n# → ~/.grok/plugins/gy-glyph-pins</pre>' +
      "</article>";
    $("ship-copy-install")?.addEventListener("click", async () => {
      const cmd =
        'ln -sfn "$(pwd)/docs/architecture-lab/plugin/lab-ship" ~/.grok/plugins/lab-ship && grok plugin validate ~/.grok/plugins/lab-ship';
      try {
        await navigator.clipboard.writeText(cmd);
        flash("Install command copied");
      } catch {
        flash(cmd);
      }
    });
  }

  function flash(msg) {
    const el = $("ship-flash");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(flash._t);
    flash._t = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  async function runSubFanout() {
    const order = SUBS.map((s) => s.id);
    const st = getState();
    for (const id of order) {
      st.subStatus[id] = "running";
      setSub(id, "running");
      saveState(st);
      await sleep(380 + Math.random() * 420);
      st.subStatus[id] = "done";
      setSub(id, "done");
      saveState(st);
    }
    flash("Subagent fan-out complete (demo) · real work runs in TUI");
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /* ── Triple shell bus (lab /api/shells) ───────────── */
  async function shellsApi(path, body) {
    const opts = body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" };
    const r = await fetch(path, opts);
    const j = await r.json().catch(() => ({}));
    if (!r.ok && j.ok === false) throw new Error(j.error || path + " " + r.status);
    return j;
  }

  function renderShellsBus(state) {
    const cards = $("ship-shells-cards");
    const queue = $("ship-shells-queue");
    const meta = $("ship-shells-meta");
    if (!cards) return;
    const shells = (state && state.shells) || {};
    const order = ["plan", "build", "verify"];
    cards.innerHTML = order
      .map((id) => {
        const s = shells[id] || { label: id, status: "idle", role: "" };
        const st = s.status || "idle";
        return (
          '<article class="ship-sub" data-sub="' +
          id +
          '" data-status="' +
          escapeAttr(st) +
          '">' +
          '<div class="ship-sub-head"><span class="ship-sub-label">' +
          escapeHtml(s.label || id) +
          '</span><span class="ship-badge">' +
          escapeHtml(st) +
          "</span></div>" +
          '<p class="ship-sub-task">' +
          escapeHtml(s.role || "") +
          "</p>" +
          '<p class="ship-sub-task" style="opacity:.75">' +
          escapeHtml(s.upstream || "") +
          "</p>" +
          "</article>"
        );
      })
      .join("");
    if (queue) {
      const q = (state && state.queue) || [];
      if (!q.length) {
        queue.innerHTML =
          '<li class="ship-plan-step"><span class="ship-plan-n">·</span><div><strong>No handoffs yet</strong><p>Use Plan → Build to start the loop.</p></div></li>';
      } else {
        queue.innerHTML = q
          .slice(-8)
          .reverse()
          .map((a, i) => {
            return (
              '<li class="ship-plan-step" data-step="' +
              escapeAttr(a.id || "") +
              '"><span class="ship-plan-n">' +
              (q.length - i) +
              "</span><div><strong>" +
              escapeHtml((a.from || "") + " → " + (a.to || "")) +
              " · loop " +
              escapeHtml(String(a.loop ?? 0)) +
              " · " +
              escapeHtml(a.status || "") +
              "</strong><p>" +
              escapeHtml(a.summary || "") +
              "</p></div></li>"
            );
          })
          .join("");
      }
    }
    if (meta) {
      const n = ((state && state.queue) || []).length;
      const max = (state && state.max_loop) || 5;
      meta.textContent =
        "α plan · β build · γ verify · " + n + " hops · max loop " + max;
    }
    // show last recipe
    const pre = $("ship-shells-recipe");
    if (pre && state) {
      const active = state.active_id
        ? (state.queue || []).find((a) => a.id === state.active_id)
        : (state.queue || [])[(state.queue || []).length - 1];
      if (active && active.recipe) {
        pre.hidden = false;
        pre.textContent =
          "# recipe for " +
          (active.to || "") +
          "\n" +
          (active.recipe.headless || active.recipe.interactive || "");
      }
    }
  }

  async function refreshShellsBus() {
    try {
      const st = await shellsApi("/api/shells");
      renderShellsBus(st);
      return st;
    } catch (e) {
      renderShellsBus({
        shells: {
          plan: { label: "α Plan", status: "offline", role: "start ./serve.sh for bus" },
          build: { label: "β Build", status: "offline", role: "" },
          verify: { label: "γ Verify", status: "offline", role: "" },
        },
        queue: [],
      });
      flash("Shells bus offline · run ./serve.sh");
      return null;
    }
  }

  async function hop(from, to, summary) {
    try {
      const j = await shellsApi("/api/shells/handoff", {
        from: from,
        to: to,
        summary: summary || from + " → " + to,
      });
      if (j.ok === false) {
        flash(j.error || "handoff failed");
      } else {
        flash("Handoff " + from + " → " + to + " · loop " + (j.activity && j.activity.loop));
      }
      renderShellsBus(j.state || (await shellsApi("/api/shells")));
    } catch (e) {
      flash(String(e.message || e));
    }
  }

  function bindActions() {
    $("ship-shells-spawn")?.addEventListener("click", async () => {
      try {
        const j = await shellsApi("/api/shells/spawn", {
          triple: true,
          task: "triple shell simultaneous handoff loop",
        });
        flash(j.launched ? "Triple shells spawned (Terminal)" : j.message || "spawn recorded");
        renderShellsBus(j.state || (await shellsApi("/api/shells")));
      } catch (e) {
        flash(String(e.message || e));
      }
    });
    $("ship-shells-hop-pb")?.addEventListener("click", () =>
      hop("plan", "build", "Plan approved — implement with tools/workspace/worktree")
    );
    $("ship-shells-hop-bv")?.addEventListener("click", () =>
      hop("build", "verify", "Build claims done — sandbox test + review")
    );
    $("ship-shells-hop-vb")?.addEventListener("click", () =>
      hop("verify", "build", "Verify failed — fix in build")
    );
    $("ship-shells-hop-vp")?.addEventListener("click", () =>
      hop("verify", "plan", "Design issue — revise plan")
    );
    $("ship-shells-refresh")?.addEventListener("click", () => refreshShellsBus());
    $("ship-shells-reset")?.addEventListener("click", async () => {
      try {
        const j = await shellsApi("/api/shells/reset", {});
        flash("Shells bus reset");
        renderShellsBus(j);
      } catch (e) {
        flash(String(e.message || e));
      }
    });
    $("ship-shells-doc")?.addEventListener("click", () => {
      location.hash = "#/21-triple-shell";
      window.LabTools?.setMode?.("docs");
    });

    $("ship-plan-approve")?.addEventListener("click", () => {
      const st = getState();
      st.planStatus = "approved";
      saveState(st);
      renderPlan();
      flash("Plan approved · implement only after this in real TUI");
      hop("plan", "build", "Ship plan approved (lab rehearsal)");
    });
    $("ship-plan-revise")?.addEventListener("click", () => {
      const st = getState();
      st.planStatus = "revise";
      saveState(st);
      renderPlan();
      flash("Requested changes · agent returns to planning");
    });
    $("ship-plan-quit")?.addEventListener("click", () => {
      const st = getState();
      st.planStatus = "quit";
      saveState(st);
      renderPlan();
      flash("Plan quit · plan mode off");
    });
    $("ship-plan-reset")?.addEventListener("click", () => {
      const st = getState();
      st.planStatus = "draft";
      saveState(st);
      renderPlan();
      flash("Plan reset to draft");
    });
    $("ship-sub-run")?.addEventListener("click", () => {
      runSubFanout();
    });
    $("ship-sub-reset")?.addEventListener("click", () => {
      const st = getState();
      st.subStatus = {};
      saveState(st);
      renderSubs();
      flash("Subagents reset");
    });
    $("ship-qa-clear")?.addEventListener("click", () => {
      const st = getState();
      st.answers = {};
      saveState(st);
      renderQA();
      flash("Q&A cleared");
    });
    $("ship-open-doc")?.addEventListener("click", () => {
      location.hash = "#/17-ship-everything";
      window.LabTools?.setMode?.("docs");
    });
    $("ship-open-official")?.addEventListener("click", () => {
      location.hash = "#/18-official-xai";
      window.LabTools?.setMode?.("docs");
    });
    $("ship-open-cli")?.addEventListener("click", () => {
      window.open("https://x.ai/cli", "_blank", "noopener");
    });
    $("ship-validate")?.addEventListener("click", async () => {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        flash(r.ok ? "Lab health OK · " + (j.status || "up") : "Health check failed");
      } catch {
        flash("No local server — static Pages mode · plugin validate needs TUI host");
      }
    });
  }

  function mount() {
    if (!$("panel-ship")) return;
    renderFeatures();
    renderPlan();
    renderSkills();
    renderPlugins();
    renderSubs();
    renderQA();
    bindActions();
    refreshShellsBus();
  }

  // Expose for tools.js setMode / voice
  window.LabShip = {
    mount,
    refresh: mount,
    flash,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
