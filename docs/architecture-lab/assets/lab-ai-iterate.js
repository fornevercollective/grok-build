/**
 * Lab AI iterate + rocket chain — host hooks (no client secrets).
 *
 * iterate: POST /api/agent/iterate → grok -p (+ fat pack side-effect)
 * chain:   POST /api/agent/chain   → iterate → fat handoff → Panda αβγ
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
   * @param {string} input.prompt
   * @param {string} [input.role]
   * @param {number} [input.maxTurns]
   * @param {AbortSignal} [input.signal]
   * @param {boolean} [input.stub]
   * @param {boolean} [input.recordPack]
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
      record_pack: input && input.recordPack === false ? false : true,
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
        pack: j.pack,
        raw: j,
      };
    } catch (e) {
      if (e && (e.status === 404 || e.name === "TypeError")) {
        return {
          ok: true,
          via: "stub-fallback",
          text:
            "No /api/agent/iterate (run native Lab or ./serve.sh).\n" +
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

  /**
   * Full rocket chain: iterate → fat handoff → open fleet.
   * @param {object} input
   * @param {string} input.prompt
   * @param {string} [input.role]
   * @param {string} [input.from] default plan
   * @param {string} [input.to] default build
   * @param {boolean} [input.iterate] default true
   * @param {boolean} [input.openFleet] default true
   * @param {string} [input.iterateText] skip re-iterate
   * @param {string[]} [input.files]
   * @param {string[]} [input.tests]
   * @param {AbortSignal} [input.signal]
   */
  async function chain(input) {
    const prompt = String((input && input.prompt) || "").trim();
    const body = {
      prompt: prompt,
      role: (input && input.role) || "plan",
      from: (input && input.from) || "plan",
      to: (input && input.to) || "build",
      iterate: input && input.iterate === false ? false : true,
      open_fleet: input && input.openFleet === false ? false : true,
      max_turns: (input && input.maxTurns) || 6,
    };
    if (input && input.iterateText) body.iterate_text = input.iterateText;
    if (input && input.files) body.files = input.files;
    if (input && input.tests) body.tests = input.tests;

    try {
      const j = await api("/api/agent/chain", body, input && input.signal);
      const chain = j.chain || j;
      const iter = j.iterate || null;
      return {
        ok: !!j.ok || !!(chain && chain.ok),
        via: j.via || "agent_chain",
        text:
          (iter && (iter.text || iter.output)) ||
          (chain && chain.message) ||
          j.message ||
          "",
        message: (chain && chain.message) || j.message || "",
        chain: chain,
        iterate: iter,
        handoff: chain && chain.handoff,
        fleet: chain && chain.fleet,
        raw: j,
      };
    } catch (e) {
      // Fallback: handoff + panda open if chain route missing
      if (e && (e.status === 404 || e.name === "TypeError")) {
        let iter = null;
        if (prompt) {
          iter = await iterate({
            prompt: prompt,
            role: body.role,
            maxTurns: body.max_turns,
            signal: input && input.signal,
          });
        }
        const hop = await api(
          "/api/shells/handoff",
          {
            from: body.from,
            to: body.to,
            summary: prompt.slice(0, 400) || body.from + "→" + body.to,
            prompt: prompt,
            iterate_text: iter && iter.text,
            role: body.to,
          },
          input && input.signal
        ).catch((err) => ({ ok: false, error: String(err.message || err) }));
        const fleet = await api(
          "/api/panda/open",
          { splits: 3 },
          input && input.signal
        ).catch((err) => ({ ok: false, error: String(err.message || err) }));
        return {
          ok: !!(hop && hop.ok),
          via: "chain-fallback",
          text: (iter && iter.text) || "",
          message: "fallback chain: handoff + panda",
          iterate: iter,
          handoff: hop,
          fleet: fleet,
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

  /** Fat handoff helper (uses last pack when fields omitted). */
  async function handoff(input) {
    const body = {
      from: (input && input.from) || "plan",
      to: (input && input.to) || "build",
      summary: (input && input.summary) || "",
      prompt: input && input.prompt,
      iterate_text: input && (input.iterateText || input.iterate_text || input.text),
      role: input && input.role,
      files: input && input.files,
      tests: input && input.tests,
      messages: input && input.messages,
      pack: input && input.pack,
    };
    return api("/api/shells/handoff", body, input && input.signal);
  }

  async function lastPack(signal) {
    try {
      return await api("/api/shells/pack", null, signal);
    } catch (_) {
      return { ok: false, pack: null };
    }
  }

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
    chain: chain,
    handoff: handoff,
    lastPack: lastPack,
    onAiIterate: onAiIterate,
    version: 2,
    contract: "overview-onAiIterate + lab-rocket-chain",
  };
})(typeof window !== "undefined" ? window : globalThis);
