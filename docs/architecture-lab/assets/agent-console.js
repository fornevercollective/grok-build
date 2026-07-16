/**
 * Agent Console — agentcn-inspired scaffold
 * Center main agent chat + α/β/γ working feeds
 * Integrates Lab handoff bus + Panda fleet open
 */
(function () {
  "use strict";

  const LS_CHAT = "lab.agent.console.v1";
  const ROLES = ["plan", "build", "verify"];

  const $ = (id) => document.getElementById(id);

  function loadChat() {
    try {
      return JSON.parse(localStorage.getItem(LS_CHAT) || "[]");
    } catch {
      return [];
    }
  }

  function saveChat(list) {
    try {
      localStorage.setItem(LS_CHAT, JSON.stringify(list.slice(-80)));
    } catch (_) {}
  }

  function now() {
    return new Date().toLocaleTimeString();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(text, cls) {
    const el = $("ac-status");
    if (!el) return;
    el.textContent = text;
    el.className = "ac-pill" + (cls ? " " + cls : "");
  }

  function renderChat() {
    const root = $("ac-scroll");
    if (!root) return;
    const list = loadChat();
    if (!list.length) {
      root.innerHTML =
        '<div class="ac-msg system"><p class="ac-msg-body">Agent console ready · agentcn-style layout · center chat orchestrates α plan · β build · γ verify feeds. Open <strong>Panda</strong> for live PTYs.</p></div>';
      return;
    }
    root.innerHTML = list
      .map((m) => {
        const role = m.role || "agent";
        return (
          '<div class="ac-msg ' +
          escapeHtml(role) +
          '"><div class="ac-msg-role">' +
          escapeHtml(role) +
          '</div><p class="ac-msg-body">' +
          escapeHtml(m.text || "") +
          '</p><div class="ac-msg-meta">' +
          escapeHtml(m.t || "") +
          (m.meta ? " · " + escapeHtml(m.meta) : "") +
          "</div></div>"
        );
      })
      .join("");
    root.scrollTop = root.scrollHeight;
  }

  function pushMsg(role, text, meta) {
    const list = loadChat();
    list.push({ role: role, text: text, t: now(), meta: meta || "" });
    saveChat(list);
    renderChat();
  }

  async function api(path, body) {
    const opts = body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" };
    const r = await fetch(path, opts);
    const j = await r.json().catch(() => ({}));
    return j;
  }

  function appendFeed(role, line) {
    const el = $("feed-" + role + "-body");
    if (!el) return;
    const stamp = now();
    const prev = el.textContent || "";
    const base =
      prev.indexOf("Waiting for") === 0 || prev.indexOf("idle") === 0 ? "" : prev + "\n";
    el.textContent = (base + "[" + stamp + "] " + line).slice(-6000);
    el.scrollTop = el.scrollHeight;
  }

  function setFeedStatus(role, status) {
    document.querySelectorAll('[data-st="' + role + '"]').forEach((el) => {
      el.textContent = status;
      el.className = "ac-feed-status " + (status === "running" ? "running" : status === "done" ? "done" : "");
    });
  }

  async function refreshFeeds() {
    try {
      const shells = await api("/api/shells");
      const state = shells.state || shells;
      const sh = (state && state.shells) || shells.shells || {};
      ROLES.forEach((role) => {
        const s = sh[role] || {};
        setFeedStatus(role, s.status || "idle");
      });
      const q = (state && state.queue) || shells.queue || [];
      if (q.length) {
        const last = q[q.length - 1];
        const line =
          (last.from || "?") +
          " → " +
          (last.to || "?") +
          " · " +
          (last.summary || last.status || "");
        if (last.to && ROLES.includes(last.to)) {
          appendFeed(last.to, "handoff: " + line);
        }
      }
      // handoff file path from native
      if (shells.path || (state && state.path)) {
        /* ok */
      }
    } catch (_) {
      /* offline static */
    }

    try {
      const ev = await api("/api/events");
      const events = (ev && ev.events) || [];
      events.slice(-8).forEach((e) => {
        const msg = (e.msg || "") + "";
        if (/handoff|plan|build|verify|panda|fleet/i.test(msg)) {
          const role = /verify/i.test(msg)
            ? "verify"
            : /build/i.test(msg)
              ? "build"
              : "plan";
          appendFeed(role, (e.level || "info") + ": " + msg.slice(0, 160));
        }
      });
    } catch (_) {}
  }

  /**
   * Main agent turn — local orchestration (agentcn recipe style).
   * Real coding agent remains `grok` / Panda panes; this is the control surface.
   */
  async function runAgentTurn(text, targetRole) {
    const t = String(text || "").trim();
    if (!t) return;
    pushMsg("user", t, targetRole ? "→ " + targetRole : "");
    setStatus("thinking", "busy");
    $("ac-send").disabled = true;

    const low = t.toLowerCase();
    let reply = "";
    let hop = null;

    try {
      if (/\bstatus\b/.test(low) || /\bsummarize\b/.test(low)) {
        const sh = await api("/api/shells").catch(() => ({}));
        const state = sh.state || sh;
        const shells = (state && state.shells) || {};
        reply =
          "Fleet status\n" +
          ROLES.map((r) => {
            const s = shells[r] || {};
            return "  " + r + ": " + (s.status || "idle");
          }).join("\n") +
          "\nHandoff file: ~/.panda/lab-handoff.json (native) or lab bus.\nOpen Panda for live PTYs.";
        ROLES.forEach((r) => appendFeed(r, "status poll"));
      } else if (/\bplan\b/.test(low) && !/\bbuild\b/.test(low)) {
        hop = { from: "verify", to: "plan", summary: t.slice(0, 200) };
        // if verify idle, still set plan running via soft hop plan self
        reply =
          "Routing to **α plan**.\n" +
          "1) Explore read-only\n2) Write plan\n3) Approve → hand off to β build.\n" +
          "Tip: Open Panda and `source ~/.panda/profiles/plan.env` in a pane.";
        setFeedStatus("plan", "running");
        appendFeed("plan", "task: " + t.slice(0, 240));
        await api("/api/shells/handoff", {
          from: "build",
          to: "plan",
          summary: "console → plan: " + t.slice(0, 120),
        }).catch(() => {});
      } else if (/\bbuild\b|\bimplement\b/.test(low)) {
        reply =
          "Routing to **β build**.\n" +
          "Use worktree isolation · tools/workspace.\n" +
          "When done: Build → Verify.";
        setFeedStatus("build", "running");
        appendFeed("build", "task: " + t.slice(0, 240));
        await api("/api/shells/handoff", {
          from: "plan",
          to: "build",
          summary: "console → build: " + t.slice(0, 120),
        }).catch(() => {});
      } else if (/\bverify\b|\btest\b|\breview\b/.test(low)) {
        reply =
          "Routing to **γ verify**.\n" +
          "Sandbox tests · review only · no scope creep.\n" +
          "Fail → hand back to build.";
        setFeedStatus("verify", "running");
        appendFeed("verify", "task: " + t.slice(0, 240));
        await api("/api/shells/handoff", {
          from: "build",
          to: "verify",
          summary: "console → verify: " + t.slice(0, 120),
        }).catch(() => {});
      } else if (targetRole) {
        reply =
          "Queued for **" +
          targetRole +
          "** feed.\n" +
          "Live shell: Panda pane with `source ~/.panda/profiles/" +
          targetRole +
          ".env` then run `grok`.";
        setFeedStatus(targetRole, "running");
        appendFeed(targetRole, "direct: " + t.slice(0, 240));
      } else {
        reply =
          "Main agent received your message.\n\n" +
          "I coordinate the fleet (agentcn-style roles):\n" +
          "• **Plan** — explore / design\n" +
          "• **Build** — implement\n" +
          "• **Verify** — test / review\n\n" +
          "Say plan/build/verify, use chips, or **Send here** on a feed.\n" +
          "For full agent tools, open **Panda** (live PTYs) or the `grok` TUI.";
        appendFeed("plan", "note: " + t.slice(0, 160));
      }

      // Optional headless grok if available (short)
      if (/\b(grok -p|headless|deep)\b/.test(low)) {
        appendFeed("build", "headless grok not auto-run from console (safety) — use Panda pane");
      }
    } catch (e) {
      reply = "Agent error: " + (e.message || e);
    }

    pushMsg("agent", reply, hop ? hop.from + "→" + hop.to : "");
    setStatus("live", "live");
    $("ac-send").disabled = false;
    $("ac-input").focus();
  }

  function bind() {
    $("ac-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = $("ac-input").value;
      $("ac-input").value = "";
      runAgentTurn(v);
    });
    $("ac-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        $("ac-form")?.requestSubmit();
      }
    });
    document.querySelectorAll("#ac-chips [data-chip]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $("ac-input").value = btn.getAttribute("data-chip") || "";
        $("ac-form")?.requestSubmit();
      });
    });
    $("btn-clear-chat")?.addEventListener("click", () => {
      saveChat([]);
      renderChat();
    });
    $("btn-export-chat")?.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(loadChat(), null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "agent-console-" + Date.now() + ".json";
      a.click();
    });
    $("btn-panda")?.addEventListener("click", async () => {
      setStatus("panda…", "busy");
      const j = await api("/api/panda/open", { splits: 3 }).catch((e) => ({
        message: String(e),
      }));
      pushMsg(
        "system",
        j.launched
          ? "Panda fleet launching (αβγ PTYs)."
          : "Panda: " + (j.message || j.mitigation || "failed")
      );
      setStatus(j.launched ? "live" : "idle", j.launched ? "live" : "");
    });
    $("btn-handoff-pb")?.addEventListener("click", async () => {
      const j = await api("/api/shells/handoff", {
        from: "plan",
        to: "build",
        summary: "Agent console: plan → build",
      });
      pushMsg("system", j.ok ? "Handoff plan → build" : j.error || "handoff failed");
      refreshFeeds();
    });
    $("btn-handoff-bv")?.addEventListener("click", async () => {
      const j = await api("/api/shells/handoff", {
        from: "build",
        to: "verify",
        summary: "Agent console: build → verify",
      });
      pushMsg("system", j.ok ? "Handoff build → verify" : j.error || "handoff failed");
      refreshFeeds();
    });
    $("btn-lab")?.addEventListener("click", () => {
      fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "focus_lab" }),
      }).catch(() => {
        location.href = "./";
      });
    });
    $("btn-close")?.addEventListener("click", () => {
      fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hide_agent", target: "agent" }),
      }).catch(() => window.close());
    });
    $("btn-min")?.addEventListener("click", () => {
      fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "minimize", target: "agent" }),
      }).catch(() => {});
    });

    document.querySelectorAll("[data-send-role]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const role = btn.getAttribute("data-send-role");
        const v = $("ac-input").value.trim() || "Continue as " + role;
        runAgentTurn(v, role);
      });
    });
    document.querySelectorAll("[data-source]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const role = btn.getAttribute("data-source");
        appendFeed(role, "source ~/.panda/profiles/" + role + ".env");
        pushMsg(
          "system",
          "In Panda pane: source ~/.panda/profiles/" + role + ".env then run grok"
        );
      });
    });
    document.querySelectorAll("[data-focus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const role = btn.getAttribute("data-focus");
        document.querySelectorAll(".ac-feed").forEach((f) => {
          f.classList.toggle("active", f.getAttribute("data-role") === role);
        });
      });
    });

    renderChat();
    refreshFeeds();
    setInterval(refreshFeeds, 3000);
    setStatus("live", "live");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
