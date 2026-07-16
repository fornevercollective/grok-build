/**
 * Lab AI iterate — thin host hook inspired by overview's onAiIterate.
 *
 * overview: host wires `onAiIterate` so the UI never embeds API keys.
 * Lab: host is local serve/native → POST /api/agent/iterate → grok -p.
 *
 * Never put secrets in VITE_* / client bundles.
 */
(function (global) {
  "use strict";

  const DEFAULT_TIMEOUT_MS = 120000;

  async function api(path, body, signal) {
    const opts = {
      method: body ? "POST" : "GET",
      cache: "no-store",
      signal: signal || undefined,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    };
    const r = await fetch(path, opts);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(j.message || j.error || path + " " + r.status);
      err.status = r.status;
      err.payload = j;
      throw err;
    }
    return j;
  }

  /**
   * @param {object} input
   * @param {string} input.prompt - user / system combined prompt
   * @param {string} [input.role] - plan | build | verify | agent
   * @param {number} [input.maxTurns]
   * @param {AbortSignal} [input.signal]
   * @param {boolean} [input.stub] - force offline stub (no network)
   */
  async function iterate(input) {
    const prompt = String((input && input.prompt) || "").trim();
    if (!prompt) {
      return { ok: false, via: "empty", text: "", message: "empty prompt" };
    }
    if (input && input.stub) {
      return {
        ok: true,
        via: "stub",
        text:
          "[offline stub · overview-style]\n" +
          "Wire host later. Prompt was:\n" +
          prompt.slice(0, 400),
        stub: true,
      };
    }

    const body = {
      prompt: prompt,
      role: (input && input.role) || "agent",
      max_turns: (input && input.maxTurns) || 8,
      timeout_ms: (input && input.timeoutMs) || DEFAULT_TIMEOUT_MS,
    };

    try {
      const j = await api("/api/agent/iterate", body, input && input.signal);
      return {
        ok: !!j.ok || !!j.text || !!j.output,
        via: j.via || "grok-p",
        text: j.text || j.output || j.message || "",
        bin: j.bin,
        code: j.code,
        timed_out: j.timed_out,
        raw: j,
      };
    } catch (e) {
      // Offline / native without iterate yet — stub so UI still moves
      if (e && (e.status === 404 || e.name === "TypeError")) {
        return {
          ok: true,
          via: "stub-fallback",
          text:
            "No /api/agent/iterate (run ./serve.sh for headless grok -p).\n" +
            "Prompt queued for Multi/Panda:\n" +
            prompt.slice(0, 300),
          stub: true,
          error: String(e.message || e),
        };
      }
      return {
        ok: false,
        via: "error",
        text: "",
        message: String(e.message || e),
      };
    }
  }

  /** overview-shaped async callback: (prompt, meta?) => { text } */
  async function onAiIterate(prompt, meta) {
    const r = await iterate({
      prompt: prompt,
      role: (meta && meta.role) || "agent",
      maxTurns: (meta && meta.maxTurns) || 8,
      signal: meta && meta.signal,
    });
    return {
      text: r.text || r.message || "",
      ok: r.ok,
      via: r.via,
      meta: r,
    };
  }

  global.LabAiIterate = {
    iterate: iterate,
    onAiIterate: onAiIterate,
    version: 1,
    contract: "overview-onAiIterate-host-hook",
  };
})(typeof window !== "undefined" ? window : globalThis);
