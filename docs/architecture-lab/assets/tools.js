/**
 * Grok Build Lab tools: Terminal · Notes · Table · X desk · Broadcast · History
 * Inspired by mueee history/notes/pad-datatable + burst X Spaces/RTMP.
 */
(function () {
  "use strict";

  const LS = {
    notes: "lab.notes.v1",
    table: "lab.table.v1",
    sections: "lab.sections.v1",
    xitems: "lab.xitems.v1",
    bcast: "lab.bcast.v1",
  };

  const state = {
    mode: "docs",
    termTimer: 0,
    mtTimer: 0,
    mtOpen: false,
    mtActive: "grok",
    mtPanes: [],
    notes: [],
    table: { cols: 4, rows: 6, cells: [] },
    sections: [],
    xitems: [],
    selectedNote: -1,
    commits: [],
    commitIdx: 0,
  };

  /** Default center multi-terminal panes (Summon Grok workspace). */
  function defaultMtPanes() {
    return [
      { id: "grok", title: "Grok", kind: "grok", body: "idle — summon to launch" },
      { id: "procs", title: "Processes", kind: "procs", body: "…" },
      { id: "events", title: "Events", kind: "events", body: "…" },
    ];
  }

  function $(id) {
    return document.getElementById(id);
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  async function api(path, opts) {
    const r = await fetch(path, {
      cache: "no-store",
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts && opts.headers),
      },
    });
    if (!r.ok) throw new Error(path + " " + r.status);
    return r.json();
  }

  /* ── Tabs ─────────────────────────────────────────── */
  function setMode(mode) {
    // terminal is global footer — not a tab mode
    if (mode === "terminal") mode = "docs";
    state.mode = mode;
    document.body.classList.toggle("mode-tools", mode !== "docs");
    document.body.classList.toggle("mode-docs", mode === "docs");
    document.querySelectorAll(".app-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.mode === mode);
    });
    document.querySelectorAll(".tool-panel").forEach((p) => {
      p.classList.toggle("active", p.dataset.mode === mode);
    });
    // Left column menu stays active on ALL pages (docs + tools)
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      sidebar.style.display = "";
      sidebar.setAttribute("aria-hidden", "false");
    }
    const app = document.querySelector(".app");
    if (app) {
      // never strip sidebar column for tools
      app.classList.remove("tools-wide");
    }
    if (mode === "history") {
      // Lazy: only hit /api/git-log when History tab is selected
      refreshHistory();
    }
    location.hash =
      mode === "docs"
        ? location.hash.replace(/^#\/tool\/.*/, "") || location.hash
        : "#/tool/" + mode;
  }

  function setSidebarCollapsed(coll) {
    document.body.classList.toggle("sidebar-collapsed", !!coll);
    const sidebar = document.getElementById("sidebar");
    const btn = document.getElementById("menu-btn");
    const edge = document.getElementById("sidebar-edge-toggle");
    if (sidebar) {
      sidebar.classList.toggle("collapsed", !!coll);
      // mobile drawer closed when collapsed on small screens
      if (window.matchMedia("(max-width: 860px)").matches) {
        sidebar.classList.toggle("open", !coll);
      }
    }
    if (btn) {
      btn.setAttribute("aria-expanded", coll ? "false" : "true");
      btn.title = coll ? "Show left menu" : "Hide left menu";
      btn.classList.toggle("menu-collapsed", !!coll);
      // Keep SpaceXAI logo — never replace with text
      if (!btn.querySelector(".menu-btn-mark")) {
        btn.innerHTML =
          '<img class="menu-btn-mark" src="assets/brand/spacexai-symbol-white-transparent.svg" width="22" height="22" alt="SpaceXAI" draggable="false" />';
      }
    }
    if (edge) {
      edge.setAttribute("aria-expanded", coll ? "false" : "true");
      edge.textContent = coll ? "›" : "‹";
      edge.title = coll ? "Expand menu" : "Collapse menu";
    }
    localStorage.setItem("lab.sidebarCollapsed", coll ? "1" : "0");
  }

  function toggleSidebar() {
    const coll = !document.body.classList.contains("sidebar-collapsed");
    // On mobile: "collapsed" means drawer closed; open when expanding
    if (window.matchMedia("(max-width: 860px)").matches) {
      const sidebar = document.getElementById("sidebar");
      const isOpen = sidebar?.classList.contains("open");
      if (isOpen) {
        sidebar.classList.remove("open");
        document.getElementById("backdrop")?.classList.remove("show");
        setSidebarCollapsed(true);
      } else {
        sidebar?.classList.add("open");
        document.getElementById("backdrop")?.classList.add("show");
        setSidebarCollapsed(false);
      }
      return;
    }
    setSidebarCollapsed(coll);
  }

  window.LabNav = { setSidebarCollapsed, toggleSidebar };

  /* ── Terminal / processes ─────────────────────────── */
  function termLine(cls, text) {
    const span = document.createElement("div");
    span.className = cls || "e-info";
    span.textContent = text;
    return span;
  }

  async function refreshTerminal() {
    const out = $("term-out");
    const errBox = $("term-errors");
    const stat = $("term-footer-stat");
    if (!out) return;
    try {
      const [procs, events] = await Promise.all([
        api("/api/processes"),
        api("/api/events").catch(() => ({ events: [] })),
      ]);
      const n = procs.processes?.length || 0;
      const errs = procs.errors || [];
      out.innerHTML = "";
      const head = termLine(
        "e-ok",
        `[${new Date().toLocaleTimeString()}] n=${n} · grok=${procs.bins?.grok || "—"} · gy=${procs.bins?.gy || "—"}`
      );
      out.appendChild(head);
      (procs.processes || []).forEach((p) => {
        const cls =
          p.kind === "ffmpeg" && p.cpu > 50
            ? "e-warn"
            : p.kind === "grok"
              ? "e-ok"
              : "e-info";
        out.appendChild(
          termLine(
            cls,
            `${String(p.pid).padStart(6)} ${p.cpu.toFixed(1).padStart(5)}% ${p.state.padEnd(4)} [${p.kind}] ${p.cmd}`
          )
        );
      });
      if (events.events?.length) {
        out.appendChild(termLine("e-info", "── events ──"));
        events.events.slice(-20).forEach((e) => {
          out.appendChild(
            termLine(
              e.level === "error" ? "e-error" : e.level === "mitigate" ? "e-mit" : "e-info",
              `${e.t} ${e.level}: ${e.msg}`
            )
          );
        });
      }

      if (stat) {
        const warn = errs.some((e) => e.severity === "warn");
        const hard = errs.some((e) => e.severity === "error");
        stat.textContent =
          n +
          " proc · " +
          errs.length +
          " issue" +
          (errs.length === 1 ? "" : "s") +
          (procs.bins?.grok ? " · grok ok" : " · no grok");
        stat.classList.toggle("has-warn", warn && !hard);
        stat.classList.toggle("has-err", hard);
      }

      if (errBox) {
        errBox.innerHTML = "";
        if (!errs.length) {
          errBox.innerHTML = "<li class='sev-info'>No active issues</li>";
        } else {
          errs.forEach((e) => {
            const li = document.createElement("li");
            li.className = "sev-" + (e.severity || "info");
            li.innerHTML = `<strong>${esc(e.code || "issue")}</strong><br>${esc(e.msg || "")}<br><code>${esc(e.mitigation || "")}</code>`;
            if (e.mitigation && /kill-ffmpeg|summon-grok/.test(e.mitigation)) {
              const b = document.createElement("button");
              b.className = "btn-mini primary";
              b.style.marginTop = "0.35rem";
              b.textContent =
                e.code === "grok_not_running" ? "Summon grok" : "Mitigate";
              b.onclick = () =>
                runMitigate(
                  e.code === "grok_not_running" ? "summon-grok" : "kill-ffmpeg"
                );
              li.appendChild(document.createElement("br"));
              li.appendChild(b);
            }
            errBox.appendChild(li);
          });
        }
      }
    } catch (err) {
      out.innerHTML = "";
      out.appendChild(termLine("e-error", "poll failed: " + err.message));
      out.appendChild(
        termLine("e-mit", "mitigation: restart ./serve.sh from architecture-lab")
      );
      if (stat) {
        stat.textContent = "offline";
        stat.classList.add("has-err");
      }
    }
  }

  function setTermToggleUi(coll) {
    const btn = $("btn-term-toggle");
    const chev = $("term-toggle-chevron");
    if (btn) {
      btn.setAttribute("aria-expanded", coll ? "false" : "true");
      btn.title = coll ? "Expand terminal" : "Collapse terminal";
    }
    // Keep SpaceXAI logo; only flip chevron
    if (chev) chev.textContent = coll ? "▸" : "▾";
  }

  function toggleTermFooter() {
    const foot = $("term-footer");
    if (!foot) return;
    const coll = foot.classList.toggle("collapsed");
    document.body.classList.toggle("term-collapsed", coll);
    setTermToggleUi(coll);
    localStorage.setItem("lab.termCollapsed", coll ? "1" : "0");
  }

  async function runMitigate(action) {
    try {
      // Summon always opens the center multi-terminal workspace first
      if (action === "summon-grok" || action === "grok") {
        openMultiTerm({ summon: true, phrase: "mitigate" });
        return;
      }
      const r = await api("/api/mitigate", {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      await api("/api/events", {
        method: "POST",
        body: JSON.stringify({
          level: "mitigate",
          msg: action + " → " + JSON.stringify(r),
          source: "ui",
        }),
      }).catch(() => {});
      refreshTerminal();
      if (state.mtOpen) refreshMultiTerm();
    } catch (e) {
      alert("mitigate failed: " + e.message);
    }
  }

  /* ── Multi-terminal center (Summon Grok) ───────────── */
  function setMtStatus(text, cls) {
    const el = $("multi-term-status");
    if (!el) return;
    el.textContent = text || "idle";
    el.className = "pill" + (cls ? " " + cls : "");
  }

  function openMultiTerm(opts) {
    opts = opts || {};
    const sec = $("multi-term");
    if (!sec) return;
    if (!state.mtPanes.length) state.mtPanes = defaultMtPanes();
    state.mtOpen = true;
    sec.hidden = false;
    document.body.classList.add("multi-term-open");
    renderMultiTerm();
    refreshMultiTerm();
    if (!state.mtTimer) {
      state.mtTimer = setInterval(refreshMultiTerm, 2500);
    }
    if (opts.summon) {
      summonGrokMulti(opts.phrase || "ui");
    } else {
      setMtStatus("open", "ok");
    }
  }

  function closeMultiTerm() {
    const sec = $("multi-term");
    state.mtOpen = false;
    document.body.classList.remove("multi-term-open");
    if (sec) sec.hidden = true;
    if (state.mtTimer) {
      clearInterval(state.mtTimer);
      state.mtTimer = 0;
    }
    setMtStatus("idle");
  }

  function renderMultiTerm() {
    const tabs = $("multi-term-tabs");
    const grid = $("multi-term-grid");
    if (!tabs || !grid) return;
    tabs.innerHTML = "";
    grid.innerHTML = "";

    state.mtPanes.forEach((p) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "mt-tab" + (p.id === state.mtActive ? " active" : "");
      tab.setAttribute("role", "tab");
      tab.dataset.id = p.id;
      tab.textContent = p.title;
      tab.addEventListener("click", () => {
        state.mtActive = p.id;
        // show all panes in grid; highlight active tab + pane
        document.querySelectorAll(".mt-tab").forEach((t) => {
          t.classList.toggle("active", t.dataset.id === p.id);
        });
        document.querySelectorAll(".mt-pane").forEach((el) => {
          el.classList.toggle("active", el.dataset.id === p.id);
        });
      });
      tabs.appendChild(tab);

      const pane = document.createElement("div");
      pane.className = "mt-pane" + (p.id === state.mtActive ? " active" : "");
      pane.dataset.id = p.id;
      pane.innerHTML =
        '<div class="mt-pane-head"><strong>' +
        esc(p.title) +
        '</strong><span class="spacer"></span><span class="mt-pane-kind">' +
        esc(p.kind) +
        "</span></div>" +
        '<div class="mt-pane-body" id="mt-body-' +
        esc(p.id) +
        '"></div>';
      grid.appendChild(pane);
      const body = pane.querySelector(".mt-pane-body");
      if (body) body.textContent = p.body || "";
    });
  }

  function writeMtBody(id, text, html) {
    const pane = state.mtPanes.find((p) => p.id === id);
    if (pane) pane.body = typeof text === "string" ? text : pane.body;
    const el = $("mt-body-" + id);
    if (!el) return;
    if (html) {
      el.innerHTML = html;
    } else {
      el.textContent = text || "";
    }
  }

  async function refreshMultiTerm() {
    if (!state.mtOpen) return;
    try {
      const [procs, events, health] = await Promise.all([
        api("/api/processes").catch(() => null),
        api("/api/events").catch(() => ({ events: [] })),
        api("/api/health").catch(() => null),
      ]);

      // Processes pane
      if (procs) {
        const lines = [];
        lines.push(
          "[" +
            new Date().toLocaleTimeString() +
            "] n=" +
            (procs.processes?.length || 0) +
            " · grok=" +
            (procs.bins?.grok || "—") +
            " · gy=" +
            (procs.bins?.gy || "—")
        );
        (procs.processes || []).forEach((p) => {
          lines.push(
            String(p.pid).padStart(6) +
              " " +
              p.cpu.toFixed(1).padStart(5) +
              "% " +
              String(p.state || "").padEnd(4) +
              " [" +
              p.kind +
              "] " +
              p.cmd
          );
        });
        if (procs.errors?.length) {
          lines.push("── issues ──");
          procs.errors.forEach((e) => {
            lines.push((e.severity || "info") + ": " + (e.msg || e.code));
          });
        }
        writeMtBody("procs", lines.join("\n"));
      }

      // Events pane
      const evs = events?.events || [];
      if (evs.length) {
        writeMtBody(
          "events",
          evs
            .slice(-40)
            .map((e) => e.t + " " + e.level + ": " + e.msg)
            .join("\n")
        );
      } else {
        writeMtBody("events", "(no events yet)");
      }

      // Grok pane — keep session text but refresh health line if idle
      const grokPane = state.mtPanes.find((p) => p.id === "grok");
      if (grokPane && health && (!grokPane.body || grokPane.body.startsWith("idle"))) {
        writeMtBody(
          "grok",
          "idle — hit Open Grok / Summon\n" +
            "bin: " +
            (health.grok || "not found") +
            "\ngy: " +
            (health.gy || "—") +
            "\nrepo: " +
            (health.repo || "—")
        );
      } else if (grokPane && health && grokPane.body && grokPane.body.includes("bin:")) {
        // leave launch transcript; append live bin status on last line only if short
      }
    } catch (e) {
      writeMtBody("events", "refresh failed: " + e.message);
    }
  }

  async function summonGrokMulti(phrase) {
    setMtStatus("summoning…", "hot");
    openMultiTermUiOnly();
    try {
      const r = await api("/api/summon-grok", {
        method: "POST",
        body: JSON.stringify({ phrase: phrase || "ui", multi: true, source: "multi-term" }),
      });
      const panes = r.panes || [];
      const lines = [
        "[" + new Date().toLocaleTimeString() + "] summon",
        "launched: " + !!r.launched,
        "via: " + (r.via || "—"),
        "bin: " + (r.bin || "—"),
        "phrase: " + (r.phrase || phrase || ""),
        r.message ? "msg: " + r.message : "",
        r.mitigation ? "mitigation: " + r.mitigation : "",
        "",
        "── terminal panes ──",
      ]
        .filter(Boolean)
        .concat(
          panes.length
            ? panes.map((p) => "• " + p.title + " [" + p.kind + "] " + (p.cmd || ""))
            : ["(no OS panes — in-lab multi-term only)"]
        );
      writeMtBody("grok", lines.join("\n"));

      // Ensure we have matching tabs if server returned named panes
      if (panes.length) {
        const ids = new Set(state.mtPanes.map((p) => p.id));
        panes.forEach((p) => {
          if (!ids.has(p.id) && p.id !== "api") {
            state.mtPanes.push({
              id: p.id,
              title: p.title || p.id,
              kind: p.kind || "pane",
              body: p.cmd || "",
            });
            ids.add(p.id);
          }
        });
        // Map server "api" watch into events pane note
        const apiPane = panes.find((p) => p.id === "api");
        if (apiPane) {
          writeMtBody(
            "events",
            "(OS Lab API watch launched in Terminal.app)\n" + (apiPane.cmd || "")
          );
        }
        renderMultiTerm();
        // re-apply bodies after re-render
        state.mtPanes.forEach((p) => writeMtBody(p.id, p.body));
      }

      setMtStatus(r.launched ? "live · multi" : r.message || "check", r.launched ? "ok" : "warn");
      await api("/api/events", {
        method: "POST",
        body: JSON.stringify({
          level: "mitigate",
          msg: "summon-grok multi → " + JSON.stringify({ launched: r.launched, via: r.via }),
          source: "ui-multi-term",
        }),
      }).catch(() => {});
      refreshTerminal();
      refreshMultiTerm();
    } catch (e) {
      writeMtBody(
        "grok",
        "summon failed: " + e.message + "\n\nmitigation: restart ./serve.sh from architecture-lab"
      );
      setMtStatus("error", "err");
    }
  }

  function openMultiTermUiOnly() {
    const sec = $("multi-term");
    if (!sec) return;
    if (!state.mtPanes.length) state.mtPanes = defaultMtPanes();
    state.mtOpen = true;
    sec.hidden = false;
    document.body.classList.add("multi-term-open");
    renderMultiTerm();
    if (!state.mtTimer) state.mtTimer = setInterval(refreshMultiTerm, 2500);
  }

  function addMtPane() {
    const n = state.mtPanes.length + 1;
    const paneId = "pane" + n + "-" + Math.random().toString(36).slice(2, 6);
    state.mtPanes.push({
      id: paneId,
      title: "Pane " + n,
      kind: "scratch",
      body:
        "scratch pane · " +
        new Date().toLocaleTimeString() +
        "\n(use Refresh all for live data panes)",
    });
    state.mtActive = paneId;
    renderMultiTerm();
  }

  /* ── Notes ────────────────────────────────────────── */
  function defaultNotes() {
    return [
      { id: id(), kind: "md", body: "# Lab notes\n\nCapture mitigations, decisions, funnel steps." },
      { id: id(), kind: "code", lang: "javascript", body: "// funnel receives prev\nreturn { ok: true, t: Date.now() };" },
    ];
  }

  function id() {
    return Math.random().toString(36).slice(2, 10);
  }

  function selectNote(idx) {
    state.selectedNote = idx;
    document.querySelectorAll("#note-cells .note-cell").forEach((el, i) => {
      el.classList.toggle("selected", i === idx);
    });
    const cell = state.notes[idx];
    const empty = $("notes-inspect-empty");
    const body = $("notes-inspect-body");
    const sel = $("notes-sel-label");
    if (!cell) {
      if (empty) empty.hidden = false;
      if (body) body.hidden = true;
      if (sel) sel.textContent = "none";
      return;
    }
    if (empty) empty.hidden = true;
    if (body) body.hidden = false;
    if ($("notes-inspect-kind"))
      $("notes-inspect-kind").textContent =
        cell.kind + (cell.lang ? " · " + cell.lang : "");
    if ($("notes-inspect-meta"))
      $("notes-inspect-meta").textContent =
        "index " + idx + " · chars " + (cell.body || "").length;
    if ($("notes-inspect-preview"))
      $("notes-inspect-preview").textContent = (cell.body || "").slice(0, 600);
    if (sel)
      sel.textContent =
        "#" + idx + " " + cell.kind + " · " + (cell.body || "").slice(0, 40);
    // switch rail to inspect
    setNotesRail("inspect");
  }

  function setNotesRail(name) {
    document.querySelectorAll("#panel-notes .rail-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.rail === name);
    });
    ["inspect", "search", "ask"].forEach((n) => {
      const pane = $("notes-" + n);
      if (!pane) return;
      const on = n === name;
      pane.hidden = !on;
      pane.classList.toggle("active", on);
    });
  }

  function setHistRail(name) {
    document.querySelectorAll("#panel-history .rail-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.hrail === name);
    });
    ["inspect", "search", "ask"].forEach((n) => {
      const pane = $("hist-" + n);
      if (!pane) return;
      const on = n === name;
      pane.hidden = !on;
      pane.classList.toggle("active", on);
    });
  }

  function renderNotes() {
    const root = $("note-cells");
    if (!root) return;
    root.innerHTML = "";
    state.notes.forEach((cell, idx) => {
      const wrap = document.createElement("div");
      wrap.className = "note-cell" + (idx === state.selectedNote ? " selected" : "");
      wrap.draggable = true;
      wrap.dataset.idx = String(idx);
      wrap.innerHTML = `<div class="note-cell-bar">
        <span>${cell.kind}${cell.lang ? " · " + cell.lang : ""}</span>
        <span class="spacer"></span>
        <button type="button" class="btn-mini" data-act="run">▶</button>
        <button type="button" class="btn-mini" data-act="up">↑</button>
        <button type="button" class="btn-mini" data-act="down">↓</button>
        <button type="button" class="btn-mini" data-act="del">✕</button>
      </div>`;
      const ta = document.createElement("textarea");
      ta.value = cell.body || "";
      ta.addEventListener("input", () => {
        cell.body = ta.value;
        saveJSON(LS.notes, state.notes);
        if (state.selectedNote === idx) selectNote(idx);
      });
      ta.addEventListener("focus", () => selectNote(idx));
      wrap.appendChild(ta);
      const out = document.createElement("pre");
      out.className = "out";
      out.hidden = true;
      wrap.appendChild(out);

      wrap.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        selectNote(idx);
      });

      wrap.querySelector('[data-act="del"]').onclick = () => {
        state.notes.splice(idx, 1);
        if (state.selectedNote === idx) state.selectedNote = -1;
        saveJSON(LS.notes, state.notes);
        renderNotes();
      };
      wrap.querySelector('[data-act="up"]').onclick = () => {
        if (idx > 0) {
          const t = state.notes[idx - 1];
          state.notes[idx - 1] = state.notes[idx];
          state.notes[idx] = t;
          saveJSON(LS.notes, state.notes);
          renderNotes();
        }
      };
      wrap.querySelector('[data-act="down"]').onclick = () => {
        if (idx < state.notes.length - 1) {
          const t = state.notes[idx + 1];
          state.notes[idx + 1] = state.notes[idx];
          state.notes[idx] = t;
          saveJSON(LS.notes, state.notes);
          renderNotes();
        }
      };
      wrap.querySelector('[data-act="run"]').onclick = () => runNoteCell(cell, out);

      wrap.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", String(idx));
        wrap.classList.add("dragging");
      });
      wrap.addEventListener("dragend", () => wrap.classList.remove("dragging"));
      wrap.addEventListener("dragover", (e) => e.preventDefault());
      wrap.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData("text/plain"));
        const to = idx;
        if (from === to) return;
        const [item] = state.notes.splice(from, 1);
        state.notes.splice(to, 0, item);
        saveJSON(LS.notes, state.notes);
        renderNotes();
      });

      root.appendChild(wrap);
    });
  }

  function searchNotes(q) {
    const ul = $("notes-search-results");
    if (!ul) return;
    ul.innerHTML = "";
    const qq = (q || "").toLowerCase().trim();
    if (!qq) return;
    state.notes.forEach((cell, idx) => {
      const body = (cell.body || "").toLowerCase();
      if (!body.includes(qq) && cell.kind !== qq) return;
      const li = document.createElement("li");
      li.textContent = "#" + idx + " " + cell.kind + " · " + (cell.body || "").slice(0, 60);
      li.onclick = () => {
        selectNote(idx);
        document
          .querySelectorAll("#note-cells .note-cell")
          [idx]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      };
      ul.appendChild(li);
    });
  }

  function askNotes() {
    const q = $("notes-ask-input")?.value?.trim() || "";
    const cell = state.notes[state.selectedNote];
    const out = $("notes-ask-out");
    if (!out) return;
    const prev = window.__labFunnel;
    const blob = (cell && cell.body) || "(no selection)";
    out.textContent =
      "Q: " +
      q +
      "\n\nSelection:\n" +
      blob.slice(0, 800) +
      "\n\nFunnel prev:\n" +
      (prev === undefined ? "(none)" : JSON.stringify(prev, null, 2).slice(0, 400)) +
      "\n\n— local rail (summon Grok via Listen for full agent)";
  }

  function runNoteCell(cell, outEl) {
    outEl.hidden = false;
    if (cell.kind === "md") {
      outEl.textContent = "(markdown — use Export .md)";
      return;
    }
    if (cell.kind === "code" || cell.lang === "javascript") {
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function("prev", "funnel", cell.body);
        const prev = window.__labFunnel;
        const result = fn(prev, prev);
        window.__labFunnel = result;
        outEl.textContent = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      } catch (e) {
        outEl.textContent = "error: " + e.message + "\nmitigation: fix JS cell or split into smaller steps";
      }
      return;
    }
    outEl.textContent = "run supported for javascript cells in-browser";
  }

  function runFunnel() {
    window.__labFunnel = undefined;
    const outs = document.querySelectorAll("#note-cells .note-cell");
    state.notes.forEach((cell, i) => {
      const out = outs[i]?.querySelector("pre.out");
      if (out) runNoteCell(cell, out);
    });
  }

  /* ── Data table ───────────────────────────────────── */
  function ensureTable() {
    const need = state.table.cols * state.table.rows;
    if (!state.table.cells || state.table.cells.length !== need) {
      const next = new Array(need).fill("");
      if (state.table.cells) {
        for (let i = 0; i < Math.min(need, state.table.cells.length); i++) {
          next[i] = state.table.cells[i];
        }
      }
      // header defaults
      for (let c = 0; c < state.table.cols; c++) {
        if (!next[c]) next[c] = "col" + (c + 1);
      }
      state.table.cells = next;
    }
  }

  function renderTable() {
    ensureTable();
    const root = $("dt-table");
    if (!root) return;
    let html = "<table><thead><tr>";
    for (let c = 0; c < state.table.cols; c++) {
      html += `<th contenteditable="true" data-i="${c}">${esc(state.table.cells[c] || "")}</th>`;
    }
    html += "</tr></thead><tbody>";
    for (let r = 1; r < state.table.rows; r++) {
      html += "<tr>";
      for (let c = 0; c < state.table.cols; c++) {
        const i = r * state.table.cols + c;
        html += `<td contenteditable="true" data-i="${i}">${esc(state.table.cells[i] || "")}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table>";
    root.innerHTML = html;
    root.querySelectorAll("[contenteditable]").forEach((cell) => {
      cell.addEventListener("input", () => {
        const i = Number(cell.dataset.i);
        state.table.cells[i] = cell.textContent || "";
        saveJSON(LS.table, state.table);
      });
    });
    renderSections();
  }

  function exportCSV() {
    ensureTable();
    const lines = [];
    for (let r = 0; r < state.table.rows; r++) {
      const row = [];
      for (let c = 0; c < state.table.cols; c++) {
        const v = state.table.cells[r * state.table.cols + c] || "";
        row.push('"' + v.replace(/"/g, '""') + '"');
      }
      lines.push(row.join(","));
    }
    download("lab-table.csv", lines.join("\n"), "text/csv");
  }

  function exportJSON() {
    download("lab-table.json", JSON.stringify(state.table, null, 2), "application/json");
  }

  /* ── Section rearrange ────────────────────────────── */
  function defaultSections() {
    // from nav if available
    try {
      const nav = window.__labNav;
      if (nav?.sections) {
        return nav.sections.map((s, i) => ({
          id: "sec-" + i,
          title: s.title,
          items: (s.items || []).map((it) => it.label).join(", "),
        }));
      }
    } catch (_) {}
    return [
      { id: "s1", title: "Start here", items: "Overview, Architecture…" },
      { id: "s2", title: "Extend", items: "Plugins, skills…" },
      { id: "s3", title: "Leverage", items: "Roadmap…" },
    ];
  }

  function renderSections() {
    const ul = $("section-list");
    if (!ul) return;
    ul.innerHTML = "";
    state.sections.forEach((s, idx) => {
      const li = document.createElement("li");
      li.draggable = true;
      li.innerHTML = `<span class="pill">↕</span> <strong contenteditable="true">${esc(s.title)}</strong> <span style="color:var(--text-dim);font-size:0.75rem">${esc(s.items || "")}</span>`;
      const titleEl = li.querySelector("strong");
      titleEl.addEventListener("input", () => {
        s.title = titleEl.textContent || "";
        saveJSON(LS.sections, state.sections);
      });
      li.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", String(idx));
        li.classList.add("dragging");
      });
      li.addEventListener("dragend", () => li.classList.remove("dragging"));
      li.addEventListener("dragover", (e) => e.preventDefault());
      li.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData("text/plain"));
        const [item] = state.sections.splice(from, 1);
        state.sections.splice(idx, 0, item);
        saveJSON(LS.sections, state.sections);
        renderSections();
      });
      ul.appendChild(li);
    });
  }

  /* ── X articles / discussions ─────────────────────── */
  function renderXItems() {
    const tb = $("x-tbody");
    if (!tb) return;
    tb.innerHTML = "";
    state.xitems.forEach((it, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><span class="pill ${esc(it.kind)}">${esc(it.kind)}</span></td>
        <td>${esc(it.title)}</td>
        <td style="font-family:var(--mono);font-size:0.72rem;max-width:14rem;overflow:hidden;text-overflow:ellipsis">${esc(it.body || "").slice(0, 80)}</td>
        <td>${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener">open</a>` : "—"}</td>
        <td><button type="button" class="btn-mini" data-i="${idx}">✕</button></td>`;
      tr.querySelector("button").onclick = () => {
        state.xitems.splice(idx, 1);
        saveJSON(LS.xitems, state.xitems);
        renderXItems();
      };
      tb.appendChild(tr);
    });
  }

  function addXItem() {
    const kind = $("x-kind")?.value || "article";
    const title = $("x-title")?.value?.trim() || "untitled";
    const body = $("x-body")?.value || "";
    const url = $("x-url")?.value?.trim() || "";
    state.xitems.unshift({
      id: id(),
      kind,
      title,
      body,
      url,
      t: new Date().toISOString(),
    });
    saveJSON(LS.xitems, state.xitems);
    if ($("x-title")) $("x-title").value = "";
    if ($("x-body")) $("x-body").value = "";
    renderXItems();
  }

  /* ── Broadcast (X Spaces + RTMP from burst) ───────── */
  function loadBcast() {
    const d = loadJSON(LS.bcast, {
      spaceUrl: "https://x.com/i/spaces/1AJEmmANrPeJL?s=20",
      proto: "rtmps",
      key: "",
      token: "",
    });
    if ($("space-url")) $("space-url").value = d.spaceUrl || "";
    if ($("rtmp-proto")) $("rtmp-proto").value = d.proto || "rtmps";
    if ($("rtmp-key")) $("rtmp-key").value = d.key || "";
    if ($("space-token")) $("space-token").value = d.token || "";
    updateRtmpCmd();
  }

  function saveBcast() {
    saveJSON(LS.bcast, {
      spaceUrl: $("space-url")?.value || "",
      proto: $("rtmp-proto")?.value || "rtmps",
      key: $("rtmp-key")?.value || "",
      token: $("space-token")?.value || "",
    });
    updateRtmpCmd();
  }

  function updateRtmpCmd() {
    const proto = $("rtmp-proto")?.value || "rtmps";
    const base =
      proto === "rtmp" ? "rtmp://ca.pscp.tv:80/x" : "rtmps://ca.pscp.tv:443/x";
    if ($("rtmp-base")) $("rtmp-base").textContent = base;
    const key = $("rtmp-key")?.value || "<STREAM_KEY>";
    const cmd = `ffmpeg -re -f avfoundation -i "0:0" -c:v libx264 -preset veryfast -b:v 2500k -c:a aac -f flv "${base}/${key}"

# or GY:
gy stream-x --rtmp "${base}/${key}"
gy burst
gy space mute all`;
    if ($("rtmp-cmd")) $("rtmp-cmd").textContent = cmd;
    const st = $("rtmp-status");
    if (st) {
      st.textContent = $("rtmp-key")?.value
        ? "key set · ready to publish"
        : "stream key available when ready";
      st.className = "rtmp-status " + ($("rtmp-key")?.value ? "ready" : "wait");
    }
  }

  /* ── History · mueee-style scrub timeline ──────────── */
  /**
   * Timeline model (like mueee history.html):
   *  - center: index space (0 = HEAD, n-1 = oldest)
   *  - zoom: 1 = fit all, higher = fewer commits visible
   *  - drag pans center; wheel zooms toward pointer; click selects
   */
  const histTl = {
    center: 0,
    zoom: 1,
    dragging: false,
    dragStartX: 0,
    dragCenter: 0,
    moved: false,
    bound: false,
  };

  function histN() {
    return state.commits.length;
  }

  function histVisRange() {
    const n = Math.max(1, histN());
    // At zoom 1 show all; zoom in → fewer visible
    return Math.max(2.5, n / Math.max(0.35, histTl.zoom));
  }

  function applyCommitIndex(idx, scrollList) {
    if (!state.commits.length) return;
    idx = Math.max(0, Math.min(state.commits.length - 1, idx | 0));
    state.commitIdx = idx;
    // Keep timeline centered near selection when not mid-drag
    if (!histTl.dragging) {
      histTl.center = idx;
    }
    // Fine range still oldest→newest left→right
    const sliderVal = state.commits.length - 1 - idx;
    const s = $("hist-slider-panel");
    if (s) {
      s.max = String(Math.max(0, state.commits.length - 1));
      s.value = String(sliderVal);
    }
    const c = state.commits[idx];
    const meta =
      (c.short || "") +
      " · " +
      (c.subject || "").slice(0, 48) +
      " · " +
      histTl.zoom.toFixed(1) +
      "×";
    if ($("hist-slider-meta")) $("hist-slider-meta").textContent = meta;
    if ($("hist-slider-panel-meta")) $("hist-slider-panel-meta").textContent = meta;

    const empty = $("hist-inspect-empty");
    const body = $("hist-inspect-body");
    if (empty) empty.hidden = true;
    if (body) body.hidden = false;
    if ($("hist-inspect-hash")) $("hist-inspect-hash").textContent = c.short || "—";
    if ($("hist-inspect-meta"))
      $("hist-inspect-meta").textContent =
        (c.author || "") + "\n" + (c.date || "") + "\n" + (c.hash || "");
    if ($("hist-inspect-subject"))
      $("hist-inspect-subject").textContent = c.subject || "";

    document.querySelectorAll("#hist-list li").forEach((li, i) => {
      li.classList.toggle("active", i === idx);
      if (scrollList && i === idx) li.scrollIntoView({ block: "nearest" });
    });

    drawAllHistTimelines();
  }

  function histIdxAtX(canvas, clientX) {
    const n = histN();
    if (!n) return 0;
    const r = canvas.getBoundingClientRect();
    const mx = (clientX - r.left) / Math.max(1, r.width);
    const vis = histVisRange();
    const visMin = histTl.center - vis / 2;
    let idx = Math.round(visMin + mx * vis);
    return Math.max(0, Math.min(n - 1, idx));
  }

  function drawHistTimeline(canvasId) {
    const cv = $(canvasId);
    if (!cv) return;
    const parent = cv.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = parent.clientWidth || 200;
    const cssH = parent.clientHeight || 56;
    if (cv.width !== Math.floor(cssW * dpr) || cv.height !== Math.floor(cssH * dpr)) {
      cv.width = Math.floor(cssW * dpr);
      cv.height = Math.floor(cssH * dpr);
      cv.style.width = cssW + "px";
      cv.style.height = cssH + "px";
    }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = cssW;
    const H = cssH;
    const n = histN();

    // Background
    ctx.fillStyle = "#07080c";
    ctx.fillRect(0, 0, W, H);

    // Gradient rail
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "rgba(110,203,255,0.06)");
    g.addColorStop(0.5, "rgba(167,139,250,0.08)");
    g.addColorStop(1, "rgba(74,222,128,0.06)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (!n) {
      ctx.fillStyle = "#52525b";
      ctx.font = "11px IBM Plex Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText("no commits · run ./serve.sh", W / 2, H / 2 + 4);
      return;
    }

    const vis = histVisRange();
    const visMin = histTl.center - vis / 2;
    const visMax = histTl.center + vis / 2;

    // Baseline
    const midY = H * 0.52;
    ctx.strokeStyle = "rgba(110,203,255,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(W, midY);
    ctx.stroke();

    // Grid ticks every commit when zoomed
    const step = vis > 40 ? 5 : vis > 20 ? 2 : 1;
    for (let i = Math.floor(visMin); i <= Math.ceil(visMax); i += step) {
      if (i < 0 || i >= n) continue;
      const x = ((i - visMin) / vis) * W;
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Commit dots / stems
    for (let i = 0; i < n; i++) {
      const x = ((i - visMin) / vis) * W;
      if (x < -8 || x > W + 8) continue;
      const c = state.commits[i];
      const selected = i === state.commitIdx;
      const isHead = i === 0;
      // stem
      ctx.strokeStyle = selected
        ? "rgba(110,203,255,0.85)"
        : isHead
          ? "rgba(74,222,128,0.55)"
          : "rgba(110,203,255,0.28)";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, midY - (selected ? 18 : 10));
      ctx.lineTo(x, midY + (selected ? 18 : 10));
      ctx.stroke();
      // node
      const r = selected ? 5.5 : isHead ? 4.2 : 3;
      ctx.beginPath();
      ctx.arc(x, midY, r, 0, Math.PI * 2);
      ctx.fillStyle = selected
        ? "#6ecbff"
        : isHead
          ? "#4ade80"
          : "#3b4254";
      ctx.fill();
      if (selected) {
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // short hash when zoomed in
      if (vis < 18 || selected) {
        ctx.fillStyle = selected ? "#e8eaed" : "#71717a";
        ctx.font = (selected ? "bold " : "") + "9px IBM Plex Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText((c.short || "").slice(0, 7), x, midY + 22);
      }
    }

    // Playhead / center (selection)
    const selX = ((state.commitIdx - visMin) / vis) * W;
    ctx.strokeStyle = "rgba(110,203,255,0.45)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(selX, 0);
    ctx.lineTo(selX, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Edge fade labels
    ctx.fillStyle = "#52525b";
    ctx.font = "9px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText("HEAD", 6, 12);
    ctx.textAlign = "right";
    ctx.fillText("older →", W - 6, 12);
    ctx.textAlign = "left";
    ctx.fillText(n + " · " + histTl.zoom.toFixed(1) + "×", 6, H - 6);
  }

  function drawAllHistTimelines() {
    drawHistTimeline("hist-timeline-canvas-mini");
    drawHistTimeline("hist-timeline-canvas-panel");
  }

  function bindHistTimelineCanvas(canvasId, hoverId) {
    const cv = $(canvasId);
    if (!cv || cv._histBound) return;
    cv._histBound = true;
    const hover = hoverId ? $(hoverId) : null;

    cv.addEventListener("pointerdown", (e) => {
      if (!histN()) return;
      cv.setPointerCapture(e.pointerId);
      histTl.dragging = true;
      histTl.moved = false;
      histTl.dragStartX = e.clientX;
      histTl.dragCenter = histTl.center;
      cv.style.cursor = "grabbing";
    });

    cv.addEventListener("pointermove", (e) => {
      if (!histN()) return;
      const r = cv.getBoundingClientRect();
      if (histTl.dragging) {
        const dx = e.clientX - histTl.dragStartX;
        if (Math.abs(dx) > 3) histTl.moved = true;
        const vis = histVisRange();
        // drag right → go older (higher index) like scrubbing tape
        histTl.center = histTl.dragCenter - (dx / Math.max(1, r.width)) * vis;
        histTl.center = Math.max(0, Math.min(histN() - 1, histTl.center));
        drawAllHistTimelines();
      }
      // hover tooltip
      if (hover && e.clientX >= r.left && e.clientX <= r.right) {
        const idx = histIdxAtX(cv, e.clientX);
        const c = state.commits[idx];
        if (c) {
          hover.hidden = false;
          hover.textContent =
            (c.short || "") +
            " · " +
            (c.subject || "").slice(0, 56) +
            " · " +
            (c.date || "").slice(0, 16);
        }
      }
    });

    function endDrag(e) {
      if (!histTl.dragging) return;
      histTl.dragging = false;
      cv.style.cursor = "grab";
      if (!histTl.moved && e && e.clientX != null) {
        const idx = histIdxAtX(cv, e.clientX);
        applyCommitIndex(idx, true);
      } else {
        // snap center to nearest after pan
        applyCommitIndex(Math.round(histTl.center), true);
      }
      histTl.moved = false;
    }

    cv.addEventListener("pointerup", endDrag);
    cv.addEventListener("pointercancel", endDrag);
    cv.addEventListener("pointerleave", () => {
      if (hover) hover.hidden = true;
    });

    cv.addEventListener(
      "wheel",
      (e) => {
        if (!histN()) return;
        e.preventDefault();
        const r = cv.getBoundingClientRect();
        const mx = (e.clientX - r.left) / Math.max(1, r.width);
        const vis = histVisRange();
        const visMin = histTl.center - vis / 2;
        const mouseIdx = visMin + mx * vis;
        const factor = e.deltaY > 0 ? 0.82 : 1.22;
        histTl.zoom = Math.max(0.35, Math.min(24, histTl.zoom * factor));
        const newVis = histVisRange();
        histTl.center = mouseIdx - (mx - 0.5) * newVis;
        histTl.center = Math.max(0, Math.min(histN() - 1, histTl.center));
        drawAllHistTimelines();
        // update zoom in meta without changing selection
        const c = state.commits[state.commitIdx];
        if (c && $("hist-slider-panel-meta")) {
          $("hist-slider-panel-meta").textContent =
            (c.short || "") +
            " · " +
            (c.subject || "").slice(0, 40) +
            " · " +
            histTl.zoom.toFixed(1) +
            "×";
        }
      },
      { passive: false }
    );
  }

  function histZoom(dir) {
    if (dir === "in") histTl.zoom = Math.min(24, histTl.zoom * 1.35);
    else if (dir === "out") histTl.zoom = Math.max(0.35, histTl.zoom / 1.35);
    else {
      histTl.zoom = 1;
      histTl.center = state.commitIdx || 0;
    }
    drawAllHistTimelines();
  }

  function bindHistorySlider(id) {
    // fine range control still supported on panel
    const s = $(id);
    if (!s) return;
    s.addEventListener("input", () => {
      if (!state.commits.length) return;
      const sliderVal = Number(s.value);
      const idx = state.commits.length - 1 - sliderVal;
      applyCommitIndex(idx, true);
    });
  }

  function bindHistTimelines() {
    if (histTl.bound) {
      drawAllHistTimelines();
      return;
    }
    histTl.bound = true;
    bindHistTimelineCanvas("hist-timeline-canvas-mini", "hist-tl-hover-mini");
    bindHistTimelineCanvas("hist-timeline-canvas-panel", "hist-tl-hover-panel");
    document.querySelectorAll("[data-hist-zoom]").forEach((btn) => {
      btn.addEventListener("click", () => histZoom(btn.dataset.histZoom));
    });
    window.addEventListener("resize", () => {
      clearTimeout(bindHistTimelines._rt);
      bindHistTimelines._rt = setTimeout(drawAllHistTimelines, 80);
    });
    // keyboard when history mode: arrows scrub
    window.addEventListener("keydown", (e) => {
      if (state.mode !== "history") return;
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        applyCommitIndex(state.commitIdx + 1, true); // older
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        applyCommitIndex(state.commitIdx - 1, true); // newer
      }
    });
  }

  async function refreshHistory() {
    const ul = $("hist-list");
    if (!ul) return;
    ul.innerHTML = "<li>loading…</li>";
    try {
      const which = $("hist-repo")?.value || "grok-build";
      const data = await api(
        "/api/git-log?limit=120&repo=" + encodeURIComponent(which)
      );
      if (!data.ok) {
        ul.innerHTML = `<li>${esc(data.message || "failed")}</li>`;
        state.commits = [];
        drawAllHistTimelines();
        return;
      }
      state.commits = data.commits || [];
      histTl.center = 0;
      histTl.zoom = 1;
      ul.innerHTML = "";
      state.commits.forEach((c, i) => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="hash">${esc(c.short)}</span>
          <span>${esc(c.subject)} <span style="color:var(--text-dim)">· ${esc(c.author)}</span></span>
          <span class="date">${esc((c.date || "").slice(0, 16))}</span>`;
        li.onclick = () => applyCommitIndex(i, false);
        ul.appendChild(li);
      });
      if ($("hist-head")) $("hist-head").textContent = data.head || "—";
      if ($("hist-repo-path")) $("hist-repo-path").textContent = data.repo || "";
      bindHistTimelines();
      applyCommitIndex(0, false);
    } catch (e) {
      ul.innerHTML = `<li class="e-error">${esc(e.message)} — mitigation: run ./serve.sh from architecture-lab</li>`;
      state.commits = [];
      drawAllHistTimelines();
    }
  }

  async function loadHistorySlider() {
    try {
      const data = await api("/api/git-log?limit=80&repo=grok-build");
      if (!data.ok || !data.commits?.length) {
        if ($("hist-slider-meta")) $("hist-slider-meta").textContent = "no git";
        drawAllHistTimelines();
        return;
      }
      state.commits = data.commits;
      histTl.center = 0;
      histTl.zoom = 1;
      bindHistTimelines();
      applyCommitIndex(0, false);
    } catch {
      if ($("hist-slider-meta")) $("hist-slider-meta").textContent = "offline";
      drawAllHistTimelines();
    }
  }

  /* ── utils ────────────────────────────────────────── */
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type || "text/plain" }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function bind() {
    document.querySelectorAll(".app-tab").forEach((t) => {
      t.addEventListener("click", () => setMode(t.dataset.mode));
    });

    // Left menu: always available + collapsible on every page
    $("menu-btn")?.addEventListener("click", toggleSidebar);
    $("sidebar-edge-toggle")?.addEventListener("click", toggleSidebar);
    // Float shell: default collapsed (more content room) unless user saved preference
    const saved = localStorage.getItem("lab.sidebarCollapsed");
    const isFloat =
      document.body.classList.contains("lab-float") ||
      document.body.classList.contains("lab-native");
    if (saved === "1" || (saved === null && isFloat)) {
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(false);
    }

    $("btn-term-refresh")?.addEventListener("click", refreshTerminal);
    $("btn-term-toggle")?.addEventListener("click", toggleTermFooter);
    $("btn-term-poll")?.addEventListener("click", () => {
      if (state.termTimer) {
        clearInterval(state.termTimer);
        state.termTimer = 0;
        $("btn-term-poll").textContent = "Auto-poll";
      } else {
        state.termTimer = setInterval(refreshTerminal, 2500);
        $("btn-term-poll").textContent = "Stop poll";
        refreshTerminal();
      }
    });
    $("btn-mit-ffmpeg")?.addEventListener("click", () => runMitigate("kill-ffmpeg"));
    $("btn-mit-grok")?.addEventListener("click", () =>
      openMultiTerm({ summon: true, phrase: "summon-grok" })
    );
    $("btn-open-mt")?.addEventListener("click", () => openMultiTerm());
    $("btn-mt-close")?.addEventListener("click", closeMultiTerm);
    $("btn-mt-refresh")?.addEventListener("click", () => {
      refreshMultiTerm();
      refreshTerminal();
    });
    $("btn-mt-add")?.addEventListener("click", addMtPane);
    $("btn-mt-open-grok")?.addEventListener("click", () =>
      openMultiTerm({ summon: true, phrase: "open-grok" })
    );
    $("btn-mt-open-term")?.addEventListener("click", () =>
      openMultiTerm({ summon: true, phrase: "open-grok-terminal" })
    );

    // Voice / Listen “hey grok” and any lab summon → center multi-term
    window.addEventListener("lab:summon-grok", (ev) => {
      const phrase = (ev && ev.detail && ev.detail.phrase) || "hey-grok";
      // UI open immediately; listen module also POSTs /api/summon-grok
      openMultiTermUiOnly();
      setMtStatus("summoning…", "hot");
      writeMtBody(
        "grok",
        "[" +
          new Date().toLocaleTimeString() +
          "] lab:summon-grok\nphrase: " +
          phrase +
          "\n(OS Terminal multi-panes via listen API · this grid is the in-lab workspace)"
      );
      // refresh after listen API has a moment to respond
      setTimeout(() => {
        refreshMultiTerm();
        refreshTerminal();
        setMtStatus("live · multi", "ok");
      }, 600);
    });

    // Footer terminal always on: restore collapse + start auto-poll
    if (localStorage.getItem("lab.termCollapsed") === "1") {
      $("term-footer")?.classList.add("collapsed");
      document.body.classList.add("term-collapsed");
      setTermToggleUi(true);
    } else {
      setTermToggleUi(false);
    }
    state.termTimer = setInterval(refreshTerminal, 2500);
    if ($("btn-term-poll")) $("btn-term-poll").textContent = "Stop poll";
    refreshTerminal();

    $("btn-note-md")?.addEventListener("click", () => {
      state.notes.push({ id: id(), kind: "md", body: "## note\n\n" });
      saveJSON(LS.notes, state.notes);
      renderNotes();
      selectNote(state.notes.length - 1);
    });
    $("btn-note-code")?.addEventListener("click", () => {
      state.notes.push({
        id: id(),
        kind: "code",
        lang: "javascript",
        body: "return prev;\n",
      });
      saveJSON(LS.notes, state.notes);
      renderNotes();
      selectNote(state.notes.length - 1);
    });
    $("btn-note-funnel")?.addEventListener("click", runFunnel);
    $("btn-note-export")?.addEventListener("click", () => {
      const md = state.notes
        .map((c) =>
          c.kind === "md"
            ? c.body
            : "```" + (c.lang || "") + "\n" + c.body + "\n```"
        )
        .join("\n\n");
      download("lab-notes.md", md, "text/markdown");
    });

    // Notes right rail tabs
    document.querySelectorAll("#panel-notes .rail-tab").forEach((t) => {
      t.addEventListener("click", () => setNotesRail(t.dataset.rail));
    });
    $("notes-search-input")?.addEventListener("input", (e) =>
      searchNotes(e.target.value)
    );
    $("notes-ask-run")?.addEventListener("click", askNotes);

    // History slider under filter + panel
    bindHistorySlider("hist-slider-panel");
    bindHistTimelines();
    $("btn-hist-slider-open")?.addEventListener("click", () => setMode("history"));
    // Compact topbar: Hist toggle expands scrub without stacking the whole chrome
    $("btn-hist-toggle")?.addEventListener("click", () => {
      const exp = $("hist-timeline-expand");
      const btn = $("btn-hist-toggle");
      if (!exp || !btn) return;
      const open = exp.hasAttribute("hidden");
      if (open) {
        exp.removeAttribute("hidden");
        btn.setAttribute("aria-expanded", "true");
        // Lazy-load git history only when user opens Hist (faster cold start)
        if (!state.commits?.length) {
          loadHistorySlider().then(() => {
            requestAnimationFrame(() => drawHistTimeline("hist-timeline-canvas-mini"));
          });
        } else {
          requestAnimationFrame(() => drawHistTimeline("hist-timeline-canvas-mini"));
        }
      } else {
        exp.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", "false");
      }
    });
    // Do not loadHistorySlider() on boot — defer until Hist open or History tab

    document.querySelectorAll("#panel-history .rail-tab").forEach((t) => {
      t.addEventListener("click", () => setHistRail(t.dataset.hrail));
    });
    $("hist-search-input")?.addEventListener("input", (e) => {
      const q = (e.target.value || "").toLowerCase();
      const ul = $("hist-search-results");
      if (!ul) return;
      ul.innerHTML = "";
      state.commits.forEach((c, i) => {
        const hay = (c.subject + " " + c.author + " " + c.short).toLowerCase();
        if (!q || !hay.includes(q)) return;
        const li = document.createElement("li");
        li.textContent = c.short + " · " + c.subject;
        li.onclick = () => {
          applyCommitIndex(i, true);
          setHistRail("inspect");
        };
        ul.appendChild(li);
      });
    });
    $("hist-ask-run")?.addEventListener("click", () => {
      const c = state.commits[state.commitIdx];
      const q = $("hist-ask-input")?.value || "";
      const out = $("hist-ask-out");
      if (!out) return;
      if (!c) {
        out.textContent = "No commit selected.";
        return;
      }
      out.textContent =
        "Q: " +
        q +
        "\n\n" +
        c.short +
        " " +
        c.subject +
        "\n" +
        c.author +
        " · " +
        c.date +
        "\n" +
        c.hash +
        "\n\n— local inspect (Listen → hey grok for agent)";
    });

    $("btn-dt-csv")?.addEventListener("click", exportCSV);
    $("btn-dt-json")?.addEventListener("click", exportJSON);
    $("btn-dt-add-row")?.addEventListener("click", () => {
      state.table.rows += 1;
      ensureTable();
      // extend cells
      const add = state.table.cols;
      for (let i = 0; i < add; i++) state.table.cells.push("");
      saveJSON(LS.table, state.table);
      renderTable();
    });
    $("btn-dt-add-col")?.addEventListener("click", () => {
      const oldCols = state.table.cols;
      const old = state.table.cells.slice();
      state.table.cols += 1;
      const next = [];
      for (let r = 0; r < state.table.rows; r++) {
        for (let c = 0; c < oldCols; c++) next.push(old[r * oldCols + c] || "");
        next.push(r === 0 ? "col" + state.table.cols : "");
      }
      state.table.cells = next;
      saveJSON(LS.table, state.table);
      renderTable();
    });

    $("btn-x-add")?.addEventListener("click", addXItem);
    $("btn-x-export")?.addEventListener("click", () =>
      download("x-desk.json", JSON.stringify(state.xitems, null, 2), "application/json")
    );

    ["space-url", "rtmp-proto", "rtmp-key", "space-token"].forEach((id) => {
      $(id)?.addEventListener("input", saveBcast);
      $(id)?.addEventListener("change", saveBcast);
    });
    $("btn-space-open")?.addEventListener("click", () => {
      const u = $("space-url")?.value;
      if (u) window.open(u, "_blank", "noopener");
    });
    $("btn-space-apply")?.addEventListener("click", () => {
      saveBcast();
      const st = $("space-meta");
      if (st) st.textContent = "bound · " + ($("space-url")?.value || "");
    });
    $("btn-key-pull")?.addEventListener("click", () => {
      // Placeholder — real pull needs GY_SPACE_TOKEN + backend
      const st = $("rtmp-status");
      if (st) {
        st.textContent = $("space-token")?.value
          ? "token present · pull when producer ready (use gy stream-x)"
          : "set GY_SPACE_TOKEN / token field first";
      }
      updateRtmpCmd();
    });

    $("hist-repo")?.addEventListener("change", refreshHistory);
    $("btn-hist-refresh")?.addEventListener("click", refreshHistory);

    // hash deep-link #/tool/notes — terminal is footer, not a mode
    const m = location.hash.match(/^#\/tool\/([\w-]+)/);
    if (m && m[1] !== "terminal") setMode(m[1]);
    else setMode("docs");
  }

  function initData() {
    state.notes = loadJSON(LS.notes, defaultNotes());
    state.table = loadJSON(LS.table, { cols: 4, rows: 6, cells: [] });
    state.sections = loadJSON(LS.sections, defaultSections());
    state.xitems = loadJSON(LS.xitems, [
      {
        id: "seed1",
        kind: "discussion",
        title: "Grok Build open-source harness",
        body: "Architecture lab · plugins · ACP",
        url: "https://x.ai/cli",
        t: new Date().toISOString(),
      },
    ]);
    renderNotes();
    renderTable();
    renderXItems();
    loadBcast();
  }

  // expose nav when loaded
  window.LabTools = {
    setMode,
    refreshTerminal,
    refreshHistory,
    openMultiTerm,
    closeMultiTerm,
  };
  window.LabNav = Object.assign(window.LabNav || {}, {
    setSidebarCollapsed,
    toggleSidebar,
  });

  // hook nav.json into sections defaults after app.js loads it
  const _loadNav = window.fetch;
  // patch: app.js sets nothing; we'll fetch nav once
  fetch("nav.json")
    .then((r) => r.json())
    .then((nav) => {
      window.__labNav = nav;
      if (!localStorage.getItem(LS.sections)) {
        state.sections = defaultSections();
        saveJSON(LS.sections, state.sections);
        renderSections();
      }
    })
    .catch(() => {});

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bind();
      initData();
    });
  } else {
    bind();
    initData();
  }
})();
