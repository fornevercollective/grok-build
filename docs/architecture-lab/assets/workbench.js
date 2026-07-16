/**
 * Workbench — center agent + 3 live PTY columns (serve.sh /api/pty/*)
 */
(function () {
  "use strict";

  const ROLES = ["plan", "build", "verify"];
  const LS = "lab.workbench.chat.v1";
  const $ = (id) => document.getElementById(id);

  const terms = {}; // role -> { term, fit, offset, alive, poll }
  let busy = false;
  let abortTurn = false;
  let stickBottom = true;

  function now() {
    return new Date().toLocaleTimeString();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function loadChat() {
    try {
      return JSON.parse(localStorage.getItem(LS) || "[]");
    } catch {
      return [];
    }
  }
  function saveChat(list) {
    try {
      localStorage.setItem(LS, JSON.stringify(list.slice(-100)));
    } catch (_) {}
  }

  function setStatus(t, cls) {
    const el = $("wb-status");
    if (!el) return;
    el.textContent = t;
    el.className = "wb-pill" + (cls ? " " + cls : "");
  }

  function setBusy(v) {
    busy = v;
    if ($("wb-send")) $("wb-send").disabled = v;
    if ($("btn-cancel")) $("btn-cancel").disabled = !v;
    if ($("btn-stop")) $("btn-stop").disabled = !v;
  }

  function scrollEnd(force) {
    const root = $("wb-scroll");
    if (!root) return;
    if (force || stickBottom) {
      requestAnimationFrame(() => {
        root.scrollTop = root.scrollHeight;
      });
    }
  }

  function renderChat() {
    const root = $("wb-scroll");
    if (!root) return;
    const list = loadChat();
    if (!list.length) {
      root.innerHTML =
        '<div class="wb-msg system"><p class="wb-msg-body">Workbench ready · Boot αβγ for live PTYs (needs <code>./serve.sh</code>) · Send routes plan/build/verify into feeds + handoff bus · tool cards appear on agent turns.</p></div>';
      return;
    }
    root.innerHTML = list
      .map((m) => {
        return (
          '<div class="wb-msg ' +
          escapeHtml(m.role || "agent") +
          '"><div class="wb-msg-role">' +
          escapeHtml(m.role || "agent") +
          '</div><p class="wb-msg-body">' +
          escapeHtml(m.text || "") +
          "</p></div>"
        );
      })
      .join("");
    scrollEnd(false);
  }

  function push(role, text) {
    const list = loadChat();
    list.push({ role: role, text: text, t: now() });
    saveChat(list);
    renderChat();
  }

  function addToolCard(name, detail) {
    const root = $("wb-tools");
    if (!root) return;
    const el = document.createElement("div");
    el.className = "wb-tool";
    el.innerHTML =
      "<strong>" + escapeHtml(name) + "</strong><span>" + escapeHtml(detail) + "</span>";
    root.prepend(el);
    while (root.children.length > 8) root.removeChild(root.lastChild);
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
    return r.json().catch(() => ({}));
  }

  function b64ToStr(b64) {
    if (!b64) return "";
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    } catch {
      return "";
    }
  }

  function makeTerm(role) {
    const host = $("term-" + role);
    if (!host || typeof Terminal === "undefined") return null;
    host.innerHTML = "";
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 11,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      theme: {
        background: "#0a0a0e",
        foreground: "#d4d4d8",
        cursor: "#38bdf8",
        selectionBackground: "rgba(56,189,248,0.25)",
      },
      convertEol: true,
      scrollback: 4000,
    });
    let fit = null;
    try {
      if (typeof FitAddon !== "undefined" && FitAddon.FitAddon) {
        fit = new FitAddon.FitAddon();
      } else if (typeof FitAddon !== "undefined") {
        fit = new FitAddon();
      }
    } catch (_) {
      fit = null;
    }
    if (fit) term.loadAddon(fit);
    term.open(host);
    if (fit) {
      try {
        fit.fit();
      } catch (_) {}
    }
    term.onData((data) => {
      api("/api/pty/write", { id: role, data: data }).catch(() => {});
    });
    terms[role] = { term: term, fit: fit, offset: 0, alive: false, poll: 0 };
    return terms[role];
  }

  async function openRole(role) {
    const t = terms[role] || makeTerm(role);
    if (!t) return false;
    const cols = Math.max(40, t.term.cols || 90);
    const rows = Math.max(12, t.term.rows || 24);
    const j = await api("/api/pty/open", {
      id: role,
      profile: role,
      cols: cols,
      rows: rows,
    });
    const st = $("st-" + role);
    if (!j.ok) {
      t.term.writeln("\r\n\x1b[31m[workbench]\x1b[0m PTY open failed: " + (j.error || "unknown"));
      t.term.writeln("Run \x1b[33m./serve.sh\x1b[0m from docs/architecture-lab for live PTYs.");
      if (st) {
        st.textContent = "offline";
        st.className = "wb-feed-st err";
      }
      return false;
    }
    t.offset = 0;
    t.alive = true;
    if (st) {
      st.textContent = "live";
      st.className = "wb-feed-st live";
    }
    if (t.poll) clearInterval(t.poll);
    t.poll = setInterval(() => pollRole(role), 120);
    return true;
  }

  async function pollRole(role) {
    const t = terms[role];
    if (!t) return;
    try {
      const res = await fetch(
        "/api/pty/poll?id=" + encodeURIComponent(role) + "&offset=" + t.offset,
        { cache: "no-store" }
      ).then((r) => r.json());
      if (res && res.ok && res.data) {
        const text = b64ToStr(res.data);
        if (text) t.term.write(text);
        t.offset = res.offset || t.offset;
      }
      if (res && res.alive === false) {
        t.alive = false;
        const st = $("st-" + role);
        if (st) {
          st.textContent = "exit";
          st.className = "wb-feed-st err";
        }
      }
    } catch (_) {}
  }

  async function bootTriple() {
    setStatus("booting…", "busy");
    ROLES.forEach((r) => makeTerm(r));
    // Prefer open-triple
    let okCount = 0;
    try {
      const trip = await api("/api/pty/open-triple", { cols: 90, rows: 22 });
      if (trip && trip.ok && trip.sessions) {
        for (const role of ROLES) {
          const s = trip.sessions[role];
          const t = terms[role] || makeTerm(role);
          if (s && s.ok) {
            t.offset = 0;
            t.alive = true;
            okCount++;
            const st = $("st-" + role);
            if (st) {
              st.textContent = "live";
              st.className = "wb-feed-st live";
            }
            if (t.poll) clearInterval(t.poll);
            t.poll = setInterval(() => pollRole(role), 120);
            t.term.writeln("\x1b[32m[workbench]\x1b[0m " + role + " PTY ready");
          } else {
            await openRole(role);
            if (terms[role] && terms[role].alive) okCount++;
          }
        }
      } else {
        for (const role of ROLES) {
          if (await openRole(role)) okCount++;
        }
      }
    } catch (e) {
      for (const role of ROLES) {
        if (await openRole(role)) okCount++;
      }
    }
    // Resize after layout
    ROLES.forEach((role) => {
      const t = terms[role];
      if (t && t.fit) {
        try {
          t.fit.fit();
          api("/api/pty/resize", {
            id: role,
            cols: t.term.cols,
            rows: t.term.rows,
          }).catch(() => {});
        } catch (_) {}
      }
    });
    setStatus(okCount ? "live · " + okCount + "/3" : "no PTY", okCount ? "ok" : "err");
    push(
      "system",
      okCount
        ? "Booted " + okCount + "/3 live PTY feeds (α plan · β build · γ verify)."
        : "PTY hub offline — run ./serve.sh then Boot αβγ. Panda still available for OS multi-term."
    );
    addToolCard("pty.open-triple", okCount + "/3 sessions");
  }

  async function writeLine(role, line) {
    if (!line) return;
    await api("/api/pty/write", { id: role, data: line + "\n" });
  }

  async function runTurn(text) {
    const t = String(text || "").trim();
    if (!t || busy) return;
    abortTurn = false;
    setBusy(true);
    setStatus("thinking", "busy");
    push("user", t);
    stickBottom = true;

    const low = t.toLowerCase();
    let reply = "";
    try {
      await new Promise((r) => setTimeout(r, 30));
      if (abortTurn) throw Object.assign(new Error("aborted"), { name: "AbortError" });

      if (/\bstatus\b/.test(low)) {
        const sh = await api("/api/shells");
        const state = sh.state || sh;
        const shells = (state && state.shells) || {};
        reply =
          "Fleet\n" +
          ROLES.map((r) => "  " + r + ": " + ((shells[r] && shells[r].status) || "idle")).join(
            "\n"
          );
        addToolCard("shells.status", "polled bus");
      } else if (/\bplan\b/.test(low) && !/\bbuild\b/.test(low)) {
        reply = "Routing → α plan · writing task into plan PTY + handoff bus.";
        addToolCard("handoff", "→ plan");
        addToolCard("pty.write", "plan");
        await api("/api/shells/handoff", {
          from: "build",
          to: "plan",
          summary: "workbench → plan: " + t.slice(0, 120),
        });
        await writeLine(
          "plan",
          "echo '── agent task ──'; cat <<'EOF'\n" + t.slice(0, 500) + "\nEOF"
        );
      } else if (/\bbuild\b|\bimplement\b/.test(low)) {
        reply = "Routing → β build · task in build PTY + plan→build handoff.";
        addToolCard("handoff", "plan → build");
        await api("/api/shells/handoff", {
          from: "plan",
          to: "build",
          summary: "workbench → build: " + t.slice(0, 120),
        });
        await writeLine(
          "build",
          "echo '── agent task ──'; cat <<'EOF'\n" + t.slice(0, 500) + "\nEOF"
        );
      } else if (/\bverify\b|\btest\b|\breview\b/.test(low)) {
        reply = "Routing → γ verify · task in verify PTY + build→verify handoff.";
        addToolCard("handoff", "build → verify");
        await api("/api/shells/handoff", {
          from: "build",
          to: "verify",
          summary: "workbench → verify: " + t.slice(0, 120),
        });
        await writeLine(
          "verify",
          "echo '── agent task ──'; cat <<'EOF'\n" + t.slice(0, 500) + "\nEOF"
        );
      } else if (/^open\s+ship/i.test(t)) {
        reply = "Open Lab → Ship tab: ./ or native Lab.";
        location.href = "./#/tool/ship";
      } else {
        // Overview-style host hook: /api/agent/iterate → grok -p (no client keys)
        addToolCard("agent.iterate", "onAiIterate");
        setStatus("grok -p…", "busy");
        let iter = null;
        if (window.LabAiIterate && LabAiIterate.iterate) {
          iter = await LabAiIterate.iterate({ prompt: t, role: "agent", maxTurns: 8 });
        } else {
          iter = await api("/api/agent/iterate", {
            prompt: t,
            role: "agent",
            max_turns: 8,
          }).catch((e) => ({
            ok: false,
            via: "error",
            text: String(e.message || e),
          }));
        }
        if (iter && (iter.text || iter.ok)) {
          reply =
            (iter.via ? "via " + iter.via + (iter.stub ? " · stub" : "") + "\n\n" : "") +
            (iter.text || iter.message || "(empty)");
          addToolCard("grok-p", iter.via || "done");
          await writeLine(
            "plan",
            "echo '[iterate " +
              (iter.via || "") +
              "] " +
              t.replace(/'/g, "").slice(0, 120) +
              "'"
          );
        } else {
          reply =
            "Agent received message (iterate unavailable).\n" +
            "• Keywords: plan / build / verify / status\n" +
            "• Live columns: type in each feed footer\n" +
            "• Full tools: grok in a PTY or Multi/Panda\n" +
            (iter && iter.message ? "\n" + iter.message : "");
          addToolCard("agent.route", "general");
          await writeLine("plan", "echo '[agent note] " + t.replace(/'/g, "").slice(0, 200) + "'");
        }
      }

      if (abortTurn) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      push("agent", reply);
      setStatus("live", "ok");
    } catch (e) {
      if (e && e.name === "AbortError") {
        push("system", "Turn cancelled.");
        setStatus("cancelled", "err");
      } else {
        push("agent", "Error: " + (e.message || e));
        setStatus("err", "err");
      }
    } finally {
      setBusy(false);
      $("wb-input")?.focus();
    }
  }

  function bind() {
    const scroll = $("wb-scroll");
    scroll?.addEventListener(
      "scroll",
      () => {
        stickBottom =
          scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 48;
      },
      { passive: true }
    );
    scroll?.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });

    $("wb-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = $("wb-input").value;
      $("wb-input").value = "";
      runTurn(v);
    });
    $("wb-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        $("wb-form")?.requestSubmit();
      }
      if (e.key === "Escape") {
        abortTurn = true;
        setBusy(false);
      }
    });
    document.querySelectorAll(".wb-chips [data-chip]").forEach((b) => {
      b.addEventListener("click", () => {
        $("wb-input").value = b.getAttribute("data-chip") || "";
        $("wb-form")?.requestSubmit();
      });
    });
    $("btn-cancel")?.addEventListener("click", () => {
      abortTurn = true;
      setBusy(false);
      setStatus("cancelled", "err");
    });
    $("btn-stop")?.addEventListener("click", () => {
      abortTurn = true;
      setBusy(false);
    });
    $("btn-boot")?.addEventListener("click", () => bootTriple());
    $("btn-panda")?.addEventListener("click", async () => {
      const j = await api("/api/panda/open", { splits: 3 }).catch((e) => ({
        message: String(e),
      }));
      push(
        "system",
        j.launched || j.ok
          ? "Panda multi-term launching (OS)."
          : "Panda: " + (j.message || j.mitigation || "use Boot αβγ for in-browser PTYs")
      );
    });
    $("btn-clear")?.addEventListener("click", () => {
      saveChat([]);
      renderChat();
      if ($("wb-tools")) $("wb-tools").innerHTML = "";
    });
    $("btn-export")?.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([JSON.stringify(loadChat(), null, 2)], { type: "application/json" })
      );
      a.download = "workbench-" + Date.now() + ".json";
      a.click();
    });
    $("btn-scroll-end")?.addEventListener("click", () => {
      stickBottom = true;
      scrollEnd(true);
    });
    $("btn-handoff-pb")?.addEventListener("click", async () => {
      await api("/api/shells/handoff", {
        from: "plan",
        to: "build",
        summary: "workbench P→B",
      });
      push("system", "Handoff plan → build");
      addToolCard("handoff", "plan → build");
    });
    $("btn-handoff-bv")?.addEventListener("click", async () => {
      await api("/api/shells/handoff", {
        from: "build",
        to: "verify",
        summary: "workbench B→V",
      });
      push("system", "Handoff build → verify");
      addToolCard("handoff", "build → verify");
    });
    document.querySelectorAll("[data-restart]").forEach((b) => {
      b.addEventListener("click", () => openRole(b.getAttribute("data-restart")));
    });
    document.querySelectorAll("[data-write]").forEach((inp) => {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const role = inp.getAttribute("data-write");
          const v = inp.value;
          inp.value = "";
          writeLine(role, v);
        }
      });
    });

    window.addEventListener("resize", () => {
      ROLES.forEach((role) => {
        const t = terms[role];
        if (t && t.fit) {
          try {
            t.fit.fit();
            api("/api/pty/resize", {
              id: role,
              cols: t.term.cols,
              rows: t.term.rows,
            }).catch(() => {});
          } catch (_) {}
        }
      });
    });

    renderChat();
    // Auto-boot if serve PTY available
    api("/api/health")
      .then((h) => {
        if (h && h.ok !== false) {
          setStatus("ready", "ok");
          bootTriple();
        } else setStatus("static", "err");
      })
      .catch(() => {
        setStatus("static", "err");
        push("system", "No /api/health — open via ./serve.sh for live PTYs.");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
