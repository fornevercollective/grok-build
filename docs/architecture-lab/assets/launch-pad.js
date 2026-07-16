/**
 * Launch Pad — mirrors native View + Window menu actions
 * Multi-term = Panda fleet (prompt / multi-PTY αβγ)
 * LTS = Colossus/Dojo (GOJO/DOLOSUS) via StageForge + public-folder
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

  function ltsLog(msg) {
    const el = $("lp-lts");
    if (el) el.textContent = msg;
    log(msg.split("\n")[0] || msg);
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

  function formatLts(j) {
    if (!j || j.ok === false) return "LTS probe failed";
    const p = j.paths || {};
    const r = j.ready || {};
    const flag = (k, v) => (v ? "OK  " : "—   ") + k;
    return [
      "Colossus/Dojo LTS · " + (j.pipe || "colossus_dojo_lts"),
      flag("public-folder", r.public_folder || p.public_folder) +
        (p.public_folder ? "  " + p.public_folder : ""),
      flag("repo-template", r.repo_template || p.repo_template) +
        (p.repo_template ? "  " + p.repo_template : ""),
      flag("stageforge", r.stageforge || p.stageforge) +
        (p.stageforge_bin || p.stageforge
          ? "  " + (p.stageforge_bin || p.stageforge)
          : ""),
      flag("manifest", r.lab_manifest || p.manifest) +
        (p.manifest ? "  stageforge.yaml" : ""),
      "",
      "Pipe: imagine → public-folder → Resolve 4K → repo-template (train/dojo)",
      "Cmd:  ./scripts/colossus-dojo-lts.sh status | up | upstream",
    ].join("\n");
  }

  async function control(action, extra) {
    setStatus("…", "busy");
    try {
      if (action === "lts_status") {
        const j = await api("/api/lts");
        const ok = j && j.ok !== false;
        setStatus(ok ? "lts" : "err", ok ? "ok" : "err");
        ltsLog(formatLts(j));
        return j;
      }
      if (action === "lts_copy_up") {
        const cmd =
          "cd docs/architecture-lab && ./scripts/colossus-dojo-lts.sh up\n# or: stageforge up";
        try {
          await navigator.clipboard.writeText(cmd);
          setStatus("copied", "ok");
          ltsLog("Copied:\n" + cmd);
        } catch (e) {
          setStatus("err", "err");
          ltsLog(cmd + "\n(clipboard: " + e + ")");
        }
        return { ok: true };
      }
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
      if (action === "playpen_status") {
        const j = await api("/api/playpen");
        setStatus(j.ok ? "playpen" : "err", j.ok ? "ok" : "err");
        const alerts = j.alerts || {};
        log(
          "Playpen · git " +
            ((j.git && j.git.branch) || "?") +
            "@" +
            ((j.git && j.git.sha_short) || "?") +
            " · procs " +
            ((j.processes && j.processes.length) || 0) +
            " · mitigate? " +
            (alerts.needs_mitigate ? "YES" : "no") +
            "\n" +
            (j.hint || "POST /api/playpen")
        );
        return j;
      }
      if (action === "playpen_diagnose") {
        const j = await api("/api/playpen", {
          domain: "mitigate",
          action: "diagnose",
        });
        setStatus(j.ok ? "diag" : "err", j.ok ? "ok" : "err");
        log(
          "Diagnose · " +
            ((j.recommend && j.recommend.join(" · ")) || JSON.stringify(j).slice(0, 200))
        );
        return j;
      }
      if (action === "playpen_recover") {
        const j = await api("/api/playpen", {
          domain: "mitigate",
          action: "soft-recover",
        });
        setStatus(j.ok ? "recover" : "err", j.ok ? "ok" : "err");
        log(j.message || "soft-recover");
        await api("/api/control", { action: "arrange" }).catch(() => {});
        return j;
      }
      if (action === "voice_say_status") {
        const j = await api("/api/voice", { action: "say-status" });
        setStatus(j.ok ? "voice" : "err", j.ok ? "ok" : "err");
        log((j.via || "voice") + ": " + (j.message || "speaking"));
        return j;
      }
      if (action === "research_crash") {
        const j = await api("/api/playpen", {
          domain: "research",
          action: "crash",
        });
        setStatus(j.ok ? "crash" : "err", j.ok ? "ok" : "err");
        log(
          "Crash research · " +
            (j.launch_log || "") +
            "\n" +
            String(j.tail || "").split("\n").slice(-6).join("\n")
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

    let docked = true;
    let pinned = true; // launch defaults always-on-top in native

    $("btn-lab")?.addEventListener("click", () => control("focus_lab"));
    $("btn-show-all")?.addEventListener("click", () => control("show_all"));

    $("btn-dock")?.addEventListener("click", () => {
      docked = !docked;
      if (docked) {
        control("arrange");
        $("btn-dock").textContent = "Undock";
        log("Docked · arrange");
      } else {
        $("btn-dock").textContent = "Dock";
        log("Undocked · free float");
      }
    });
    if ($("btn-dock")) $("btn-dock").textContent = "Undock";

    $("btn-pin")?.addEventListener("click", () => {
      pinned = !pinned;
      control(pinned ? "pin" : "unpin", { target: "launch", on: pinned });
      if ($("btn-pin")) $("btn-pin").textContent = pinned ? "Unpin" : "Pin";
    });
    if ($("btn-pin")) $("btn-pin").textContent = "Unpin";

    $("btn-close")?.addEventListener("click", () => {
      control("hide_launch").catch(() => window.close());
    });
    $("btn-min")?.addEventListener("click", () => {
      control("minimize", { target: "launch" });
    });
    $("btn-max")?.addEventListener("click", () => {
      control("maximize", { target: "launch" });
    });

    // Poll health for status pill; soft-probe LTS once
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
    async function probeLts() {
      try {
        const j = await api("/api/lts");
        if (j && j.ok !== false) ltsLog(formatLts(j));
      } catch (_) {
        /* serve may be down; native still works for control */
      }
    }
    tick();
    probeLts();
    setInterval(tick, 8000);
    setStatus("ready", "ok");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
