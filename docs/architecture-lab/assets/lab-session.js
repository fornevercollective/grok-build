/**
 * Lab session interchange — overview workspace-snapshot pattern (thin).
 * No secrets. Optional export for Agent handoffs + shareable JSON.
 *
 * Schema: lab.session.v1
 */
(function (global) {
  "use strict";

  const VERSION = "lab.session.v1";
  const LS_KEY = "lab.session.draft.v1";

  function nowIso() {
    return new Date().toISOString();
  }

  function getHandoffHint() {
    return "~/.panda/lab-handoff.json";
  }

  /**
   * Build a snapshot from live Lab state (best-effort).
   * @param {object} [extra]
   */
  function buildSnapshot(extra) {
    const msgs = [];
    try {
      const root =
        document.getElementById("wb-scroll") ||
        document.getElementById("ac-scroll");
      if (root) {
        root.querySelectorAll(".wb-msg, .ac-msg").forEach((el) => {
          const role =
            (el.className || "").match(/\b(user|agent|system)\b/)?.[1] ||
            "agent";
          const body =
            el.querySelector(".wb-msg-body, .ac-msg-body")?.textContent ||
            el.textContent ||
            "";
          if (body.trim())
            msgs.push({ role: role, body: body.trim().slice(0, 4000) });
        });
      }
    } catch (_) {}

    const tools = [];
    try {
      document.querySelectorAll(".wb-tool, .ac-tool-card, [data-tool]").forEach((el) => {
        tools.push({
          name: el.getAttribute("data-tool") || el.textContent?.trim()?.slice(0, 80) || "tool",
        });
      });
    } catch (_) {}

    const snap = {
      version: VERSION,
      exportedAt: nowIso(),
      shellContext: "grok-build-lab",
      abcPath: "B", // default surface; caller may override
      prompt: (extra && extra.prompt) || "",
      roles: ["plan", "build", "verify"],
      messages: msgs.slice(-80),
      tools: tools.slice(-40),
      handoffPath: getHandoffHint(),
      aiConfig: {
        // never secrets — overview rule
        modelName: (extra && extra.modelName) || "grok",
        iterateEndpoint: "/api/agent/iterate",
      },
      meta: {
        labSemver: (extra && extra.labSemver) || null,
        source: (extra && extra.source) || "lab-session.js",
        note: "bytes-free · no API keys · path-copy of overview snapshot idea",
      },
    };
    if (extra && extra.abcPath) snap.abcPath = extra.abcPath;
    if (extra && extra.payload) snap.payload = extra.payload;
    return snap;
  }

  function parseSnapshot(raw) {
    let obj = raw;
    if (typeof raw === "string") {
      try {
        obj = JSON.parse(raw);
      } catch (e) {
        throw new Error("invalid JSON: " + e.message);
      }
    }
    if (!obj || typeof obj !== "object") throw new Error("snapshot must be object");
    if (!obj.version || String(obj.version).indexOf("lab.session") !== 0) {
      throw new Error("unsupported version: " + (obj.version || "missing"));
    }
    return obj;
  }

  function download(snap, filename) {
    const name = filename || "lab-session.json";
    const blob = new Blob([JSON.stringify(snap, null, 2) + "\n"], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function saveDraft(snap) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(snap));
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadDraft() {
    try {
      const t = localStorage.getItem(LS_KEY);
      return t ? parseSnapshot(t) : null;
    } catch (_) {
      return null;
    }
  }

  async function exportViaApi(snap) {
    try {
      const r = await fetch("/api/session/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snap || buildSnapshot()),
      });
      return await r.json();
    } catch (e) {
      return { ok: false, error: String(e.message || e), local: buildSnapshot() };
    }
  }

  global.LabSession = {
    VERSION: VERSION,
    buildSnapshot: buildSnapshot,
    parseSnapshot: parseSnapshot,
    download: download,
    saveDraft: saveDraft,
    loadDraft: loadDraft,
    exportViaApi: exportViaApi,
  };
})(typeof window !== "undefined" ? window : globalThis);
