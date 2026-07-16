/**
 * Agent Console — chat-parity controls + cancelable turns + reliable scroll
 */
(function () {
  "use strict";

  const LS_CHAT = "lab.agent.console.v1";
  const ROLES = ["plan", "build", "verify"];

  const $ = (id) => document.getElementById(id);

  /** @type {{ aborted: boolean, id: number } | null} */
  let activeTurn = null;
  let turnSeq = 0;
  let pinned = false;
  let stickToBottom = true;

  function loadChat() {
    try {
      return JSON.parse(localStorage.getItem(LS_CHAT) || "[]");
    } catch {
      return [];
    }
  }

  function saveChat(list) {
    try {
      localStorage.setItem(LS_CHAT, JSON.stringify(list.slice(-120)));
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

  function toast(msg, isErr) {
    const el = $("ac-toast");
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    el.className = "ac-toast" + (isErr ? " err" : "");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.hidden = true;
    }, 3200);
  }

  function setBusy(busy) {
    const send = $("ac-send");
    const cancel = $("btn-cancel");
    const cancelBar = $("btn-cancel-bar");
    if (send) send.disabled = busy;
    if (cancel) cancel.disabled = !busy;
    if (cancelBar) cancelBar.disabled = !busy;
  }

  function scrollToEnd(force) {
    const root = $("ac-scroll");
    if (!root) return;
    if (force || stickToBottom) {
      requestAnimationFrame(() => {
        root.scrollTop = root.scrollHeight;
      });
    }
  }

  function scrollToTop() {
    const root = $("ac-scroll");
    if (!root) return;
    stickToBottom = false;
    root.scrollTop = 0;
  }

  function renderChat() {
    const root = $("ac-scroll");
    if (!root) return;
    const list = loadChat();
    if (!list.length) {
      root.innerHTML =
        '<div class="ac-msg system"><p class="ac-msg-body">Agent console ready · Cancel / Refresh / New · chat chips (Ship · Plan · Summon · History · Notes) · wheel scrolls this pane and αβγ feeds.</p></div>';
      return;
    }
    root.innerHTML = list
      .map((m) => {
        const role = m.role || "agent";
        const extra = m.cancelled ? " cancelled" : "";
        return (
          '<div class="ac-msg ' +
          escapeHtml(role) +
          extra +
          '"><div class="ac-msg-role">' +
          escapeHtml(role) +
          (m.cancelled ? " · cancelled" : "") +
          '</div><p class="ac-msg-body">' +
          escapeHtml(m.text || "") +
          '</p><div class="ac-msg-meta">' +
          escapeHtml(m.t || "") +
          (m.meta ? " · " + escapeHtml(m.meta) : "") +
          "</div></div>"
        );
      })
      .join("");
    scrollToEnd(false);
  }

  function pushMsg(role, text, meta, opts) {
    const list = loadChat();
    list.push({
      role: role,
      text: text,
      t: now(),
      meta: meta || "",
      cancelled: !!(opts && opts.cancelled),
    });
    saveChat(list);
    renderChat();
  }

  async function api(path, body, signal) {
    const opts = body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: signal || undefined,
        }
      : { cache: "no-store", signal: signal || undefined };
    const r = await fetch(path, opts);
    const j = await r.json().catch(() => ({}));
    return j;
  }

  function control(action, extra) {
    return api(
      "/api/control",
      Object.assign({ action: action, target: "agent" }, extra || {})
    ).catch((e) => ({ ok: false, error: String(e) }));
  }

  function appendFeed(role, line) {
    const el = $("feed-" + role + "-body");
    if (!el) return;
    const stamp = now();
    const prev = el.textContent || "";
    const base =
      prev.indexOf("Waiting for") === 0 || prev.indexOf("idle") === 0 ? "" : prev + "\n";
    el.textContent = (base + "[" + stamp + "] " + line).slice(-8000);
    el.scrollTop = el.scrollHeight;
  }

  function setFeedStatus(role, status) {
    document.querySelectorAll('[data-st="' + role + '"]').forEach((el) => {
      el.textContent = status;
      el.className =
        "ac-feed-status " +
        (status === "running" ? "running" : status === "done" ? "done" : "");
    });
  }

  async function refreshFeeds(signal) {
    try {
      const shells = await api("/api/shells", null, signal);
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
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }

    try {
      const ev = await api("/api/events", null, signal);
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

  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) {
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        return;
      }
      const t = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(t);
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          },
          { once: true }
        );
      }
    });
  }

  function cancelTurn() {
    if (!activeTurn) {
      toast("No active turn");
      return;
    }
    activeTurn.aborted = true;
    if (activeTurn.controller) {
      try {
        activeTurn.controller.abort();
      } catch (_) {}
    }
    setStatus("cancelled", "err");
    setBusy(false);
    pushMsg("system", "Turn cancelled.", "stop", { cancelled: true });
    ROLES.forEach((r) => {
      if (
        document.querySelector('[data-st="' + r + '"]') &&
        /running/i.test(document.querySelector('[data-st="' + r + '"]').textContent || "")
      ) {
        setFeedStatus(r, "idle");
      }
    });
    activeTurn = null;
    toast("Cancelled");
  }

  /**
   * Main agent turn — abortable. Real tools via Panda / grok TUI.
   */
  async function runAgentTurn(text, targetRole) {
    const t = String(text || "").trim();
    if (!t) return;
    if (activeTurn) {
      toast("Turn in progress — Cancel first", true);
      return;
    }

    const id = ++turnSeq;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const signal = controller ? controller.signal : null;
    activeTurn = { id: id, aborted: false, controller: controller };

    pushMsg("user", t, targetRole ? "→ " + targetRole : "");
    setStatus("thinking", "busy");
    setBusy(true);
    stickToBottom = true;

    const low = t.toLowerCase();
    let reply = "";
    let hop = null;

    const check = () => {
      if (!activeTurn || activeTurn.id !== id || activeTurn.aborted || (signal && signal.aborted)) {
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      }
    };

    try {
      // Brief yield so Cancel can land
      await sleep(40, signal);
      check();

      // Lab tool intents (grok chat parity chips)
      if (/^open\s+ship\b/i.test(t) || low === "ship") {
        await control("focus_lab");
        await api("/api/control", { action: "eval", target: "lab", script: "location.hash='#/tool/ship'" }).catch(
          () => {}
        );
        reply = "Opening **Ship** deck on Lab.";
      } else if (/^open\s+plan\b/i.test(t) || low === "plan loop") {
        await control("focus_lab");
        reply = "Focus Lab · use Ship / plan-loop skill in TUI for full plan loop.";
      } else if (/^hey\s+grok\b/i.test(t) || low === "summon") {
        reply =
          "Summon: open **Multi** (Panda) and run `grok`, or Lab chat for voice/listen surface.";
      } else if (/^open\s+history\b/i.test(t) || low === "history") {
        reply = "History lives in this scrollback (export JSON) and grok session history in TUI.";
      } else if (/^open\s+notes\b/i.test(t) || low === "notes") {
        await control("focus_lab");
        reply = "Focus Lab · open Notes tab in the workspace.";
      } else if (/\bstatus\b/.test(low) || /\bsummarize\b/.test(low)) {
        check();
        const sh = await api("/api/shells", null, signal).catch(() => ({}));
        const state = sh.state || sh;
        const shells = (state && state.shells) || {};
        reply =
          "Fleet status\n" +
          ROLES.map((r) => {
            const s = shells[r] || {};
            return "  " + r + ": " + (s.status || "idle");
          }).join("\n") +
          "\nHandoff: ~/.panda/lab-handoff.json · Multi for live PTYs.";
        ROLES.forEach((r) => appendFeed(r, "status poll"));
      } else if (/\bplan\b/.test(low) && !/\bbuild\b/.test(low)) {
        hop = { from: "verify", to: "plan", summary: t.slice(0, 200) };
        reply =
          "Routing to **α plan**.\n1) Explore read-only\n2) Write plan\n3) Approve → β build.\nTip: Multi → source ~/.panda/profiles/plan.env";
        setFeedStatus("plan", "running");
        appendFeed("plan", "task: " + t.slice(0, 240));
        await api(
          "/api/shells/handoff",
          { from: "build", to: "plan", summary: "console → plan: " + t.slice(0, 120) },
          signal
        ).catch(() => {});
      } else if (/\bbuild\b|\bimplement\b/.test(low)) {
        reply =
          "Routing to **β build**.\nWorktree isolation · tools/workspace.\nWhen done: Build → Verify.";
        setFeedStatus("build", "running");
        appendFeed("build", "task: " + t.slice(0, 240));
        await api(
          "/api/shells/handoff",
          { from: "plan", to: "build", summary: "console → build: " + t.slice(0, 120) },
          signal
        ).catch(() => {});
      } else if (/\bverify\b|\btest\b|\breview\b/.test(low)) {
        reply =
          "Routing to **γ verify**.\nSandbox tests · review only.\nFail → hand back to build.";
        setFeedStatus("verify", "running");
        appendFeed("verify", "task: " + t.slice(0, 240));
        await api(
          "/api/shells/handoff",
          { from: "build", to: "verify", summary: "console → verify: " + t.slice(0, 120) },
          signal
        ).catch(() => {});
      } else if (targetRole) {
        reply =
          "Queued for **" +
          targetRole +
          "**.\nPanda: source ~/.panda/profiles/" +
          targetRole +
          ".env then `grok`.";
        setFeedStatus(targetRole, "running");
        appendFeed(targetRole, "direct: " + t.slice(0, 240));
      } else {
        reply =
          "Main agent received your message.\n\n" +
          "• **Plan / Build / Verify** chips or Send here on a feed\n" +
          "• **Ship · History · Notes** · Multi for PTYs\n" +
          "• **Cancel** stops an in-flight turn · **Refresh** reloads\n" +
          "Full tools: Multi (Panda) or `grok` TUI.";
        appendFeed("plan", "note: " + t.slice(0, 160));
      }

      await sleep(80, signal);
      check();
      pushMsg("agent", reply, hop ? hop.from + "→" + hop.to : "");
      setStatus("live", "live");
    } catch (e) {
      if (e && e.name === "AbortError") {
        // cancelTurn already messaged
      } else {
        pushMsg("agent", "Agent error: " + (e.message || e));
        setStatus("err", "err");
        toast(String(e.message || e), true);
      }
    } finally {
      if (activeTurn && activeTurn.id === id) {
        activeTurn = null;
      }
      setBusy(false);
      $("ac-input")?.focus();
    }
  }

  function lastUserText() {
    const list = loadChat();
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].role === "user") return list[i].text;
    }
    return "";
  }

  function copyLast() {
    const list = loadChat();
    const last = list[list.length - 1];
    if (!last) {
      toast("Nothing to copy", true);
      return;
    }
    const text = last.text || "";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast("Copied"),
        () => toast("Copy failed", true)
      );
    } else {
      toast(text.slice(0, 80) + (text.length > 80 ? "…" : ""));
    }
  }

  function bindScroll() {
    const root = $("ac-scroll");
    if (!root) return;
    root.addEventListener(
      "scroll",
      () => {
        const nearBottom =
          root.scrollHeight - root.scrollTop - root.clientHeight < 48;
        stickToBottom = nearBottom;
      },
      { passive: true }
    );
    // Ensure wheel targets this port (not swallowed by chrome)
    root.addEventListener(
      "wheel",
      (e) => {
        // allow natural scroll; only stop propagation to drag chrome
        e.stopPropagation();
      },
      { passive: true }
    );
    ROLES.forEach((role) => {
      const el = $("feed-" + role + "-body");
      if (!el) return;
      el.addEventListener(
        "wheel",
        (e) => {
          e.stopPropagation();
        },
        { passive: true }
      );
    });
  }

  function bind() {
    bindScroll();

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
      if (e.key === "Escape") {
        e.preventDefault();
        cancelTurn();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && activeTurn) {
        e.preventDefault();
        cancelTurn();
      }
    });

    document.querySelectorAll("#ac-chips [data-chip]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $("ac-input").value = btn.getAttribute("data-chip") || "";
        $("ac-form")?.requestSubmit();
      });
    });

    $("btn-cancel")?.addEventListener("click", cancelTurn);
    $("btn-cancel-bar")?.addEventListener("click", cancelTurn);

    $("btn-refresh")?.addEventListener("click", async () => {
      setStatus("refresh…", "busy");
      toast("Refreshing…");
      await refreshFeeds();
      renderChat();
      await control("refresh_agent").catch(() =>
        control("refresh", { target: "agent" })
      );
      // soft reload if still stuck
      try {
        location.reload();
      } catch (_) {
        setStatus("live", "live");
      }
    });

    $("btn-new")?.addEventListener("click", () => {
      if (activeTurn) cancelTurn();
      saveChat([]);
      renderChat();
      ROLES.forEach((r) => {
        const el = $("feed-" + r + "-body");
        if (el) el.textContent = "Waiting for " + r + " activity…";
        setFeedStatus(r, "idle");
      });
      setStatus("idle", "");
      toast("New conversation");
    });

    $("btn-clear-chat")?.addEventListener("click", () => {
      saveChat([]);
      renderChat();
      toast("Cleared");
    });

    $("btn-export-chat")?.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(loadChat(), null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "agent-console-" + Date.now() + ".json";
      a.click();
      toast("Exported");
    });

    $("btn-copy-last")?.addEventListener("click", copyLast);
    $("btn-regen")?.addEventListener("click", () => {
      const u = lastUserText();
      if (!u) {
        toast("No user message to regen", true);
        return;
      }
      runAgentTurn(u);
    });
    $("btn-scroll-top")?.addEventListener("click", scrollToTop);
    $("btn-scroll-bottom")?.addEventListener("click", () => {
      stickToBottom = true;
      scrollToEnd(true);
    });

    $("btn-pin")?.addEventListener("click", () => {
      pinned = !pinned;
      control(pinned ? "pin" : "unpin", { target: "agent", on: pinned });
      $("btn-pin").textContent = pinned ? "Unpin" : "Pin";
    });
    $("btn-chat")?.addEventListener("click", () =>
      api("/api/control", { action: "show_chat" })
    );
    $("btn-stream")?.addEventListener("click", () =>
      api("/api/control", { action: "show_stream" })
    );
    $("btn-lab")?.addEventListener("click", () => {
      control("focus_lab").catch(() => {
        location.href = "./";
      });
    });
    $("btn-panda")?.addEventListener("click", async () => {
      setStatus("panda…", "busy");
      const j = await api("/api/panda/open", { splits: 3 }).catch((e) => ({
        message: String(e),
      }));
      pushMsg(
        "system",
        j.launched
          ? "Multi-term (Panda) launching — αβγ PTYs."
          : "Multi-term: " + (j.message || j.mitigation || "failed")
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

    $("btn-close")?.addEventListener("click", () => {
      control("hide_agent").catch(() => window.close());
    });
    $("btn-min")?.addEventListener("click", () => {
      control("minimize", { target: "agent" });
    });
    $("btn-max")?.addEventListener("click", () => {
      control("maximize", { target: "agent" });
    });

    document.querySelectorAll("[data-send-role]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const role = btn.getAttribute("data-send-role");
        const v = $("ac-input").value.trim() || "Continue as " + role;
        $("ac-input").value = "";
        runAgentTurn(v, role);
      });
    });
    document.querySelectorAll("[data-source]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const role = btn.getAttribute("data-source");
        appendFeed(role, "source ~/.panda/profiles/" + role + ".env");
        pushMsg(
          "system",
          "In Multi pane: source ~/.panda/profiles/" + role + ".env then run grok"
        );
      });
    });
    document.querySelectorAll("[data-focus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const role = btn.getAttribute("data-focus");
        document.querySelectorAll(".ac-feed").forEach((f) => {
          f.classList.toggle("active", f.getAttribute("data-role") === role);
        });
        $("feed-" + role + "-body")?.focus();
      });
    });
    document.querySelectorAll("[data-clear-feed]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const role = btn.getAttribute("data-clear-feed");
        const el = $("feed-" + role + "-body");
        if (el) el.textContent = "Waiting for " + role + " activity…";
        setFeedStatus(role, "idle");
      });
    });

    renderChat();
    refreshFeeds();
    setInterval(() => refreshFeeds(), 3000);
    setStatus("live", "live");
    setBusy(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
