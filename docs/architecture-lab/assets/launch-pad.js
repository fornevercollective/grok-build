/**
 * Launch Pad — mirrors native View + Window menu actions
 * Multi-term = Panda fleet (prompt / multi-PTY αβγ)
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function setStatus(text, cls) {
    const el = $("lp-status");
    if (!el) return;
    el.textContent = text;
    el.className = "lp-pill" + (cls ? " " + cls : "");
  }

  function log(msg) {
    const el = $("lp-log");
    if (el) el.textContent = msg;
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
    return { ok: r.ok, status: r.status, ...j };
  }

  async function control(action, extra) {
    setStatus("…", "busy");
    try {
      if (action === "open_panda" || action === "spawn_fleet") {
        const j = await api("/api/panda/open", {
          splits: (extra && extra.splits) || 3,
        });
        const ok = j.launched || j.ok;
        setStatus(ok ? "multi-term" : "err", ok ? "ok" : "err");
        log(
          ok
            ? "Multi-term (Panda) launching — α plan · β build · γ verify PTYs"
            : "Panda: " + (j.message || j.mitigation || "failed")
        );
        return j;
      }
      if (action === "about") {
        // Best-effort: control bus may ignore; log version
        const h = await api("/api/health").catch(() => ({}));
        log(
          "Grok Build Lab native " +
            ((h && h.version) || "") +
            " · windows: " +
            ((h && h.windows && h.windows.join(", ")) || "—")
        );
        setStatus("ready", "ok");
        return h;
      }
      if (action === "show_all") {
        await api("/api/control", { action: "focus_lab" });
        await api("/api/control", { action: "show_chat" });
        await api("/api/control", { action: "show_stream" });
        await api("/api/control", { action: "show_agent" }).catch(() => {});
        setStatus("all", "ok");
        log("Show all: lab · chat · stream · agent");
        return { ok: true };
      }
      const body = Object.assign({ action: action }, extra || {});
      const j = await api("/api/control", body);
      setStatus("ok", "ok");
      log("→ " + action + (extra && extra.target ? " · " + extra.target : ""));
      return j;
    } catch (e) {
      setStatus("err", "err");
      log(String(e.message || e));
      return { ok: false, error: String(e) };
    }
  }

  function bind() {
    document.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action");
        const target = btn.getAttribute("data-target");
        const on = btn.getAttribute("data-on");
        const extra = {};
        if (target) extra.target = target;
        if (on != null) extra.on = on === "true" || on === "1";
        control(action, extra);
      });
    });

    $("btn-lab")?.addEventListener("click", () => control("focus_lab"));
    $("btn-show-all")?.addEventListener("click", () => control("show_all"));

    $("btn-close")?.addEventListener("click", () => {
      control("hide_launch").catch(() => window.close());
    });
    $("btn-min")?.addEventListener("click", () => {
      control("minimize", { target: "launch" });
    });
    $("btn-max")?.addEventListener("click", () => {
      control("maximize", { target: "launch" });
    });

    // Poll health for status pill
    async function tick() {
      try {
        const h = await api("/api/health");
        if (h && h.ok !== false) {
          setStatus("live", "ok");
        }
      } catch (_) {
        /* static offline */
      }
    }
    tick();
    setInterval(tick, 8000);
    setStatus("ready", "ok");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
