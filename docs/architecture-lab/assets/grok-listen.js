/**
 * Grok voice listen dock — live readout + intent under the logo.
 * Logo lights up behind the mark when you talk (mic level + speech).
 *
 * Local path: Web Speech API + tool intents (lab actions).
 * North star: Grok Voice Agent Builder / docs.x.ai voice realtime.
 * https://x.ai/news/grok-voice-agent-builder
 * https://docs.x.ai/overview
 * https://docs.x.ai/developers/model-capabilities/audio/voice-agent
 */
(function () {
  "use strict";

  const WAKE = /\b(?:hey\s+)?grok\b/i;
  const MAX_TURNS = 8;

  const state = {
    on: false,
    rec: null,
    lastSummon: 0,
    lastAction: 0,
    restartTimer: 0,
    talkingTimer: 0,
    turns: [],
    // mic level
    audioCtx: null,
    analyser: null,
    micStream: null,
    raf: 0,
    level: 0,
    // STT fallback (WKWebView: Web Speech → service-not-allowed)
    sttMode: false, // true = Grok /api/stt via MediaRecorder
    webspeechBlocked: false,
    preferStt: false,
    mediaRec: null,
    mediaChunks: [],
    sttBusy: false,
    speechOpen: false, // VAD: currently capturing an utterance
    silenceMs: 0,
    speechStartedAt: 0,
    lastVadTs: 0,
    sttPoll: 0,
    // Anti-false-intent: Spaces / TV / chart scripts in the room
    pttActive: false, // Hold pressed → always act
    wakeArmedUntil: 0, // after "hey grok", accept tools briefly
    pausedBg: false, // tab hidden / window blurred
    fromPttClip: false, // next STT blob came from hold
  };

  function el(id) {
    return document.getElementById(id);
  }

  function setStatus(text, cls) {
    const s = el("listen-status");
    if (!s) return;
    s.textContent = text;
    s.className = "listen-status" + (cls ? " " + cls : "");
  }

  /** Heard/intent panel only appears after Listen is summoned/active */
  function setReadoutVisible(show) {
    const box = el("voice-readout");
    if (!box) return;
    if (show) {
      box.hidden = false;
      box.setAttribute("aria-hidden", "false");
      document.body.classList.add("voice-readout-open");
    } else {
      box.hidden = true;
      box.setAttribute("aria-hidden", "true");
      document.body.classList.remove("voice-readout-open");
    }
  }

  function toast(msg, ms) {
    const t = el("summon-toast");
    if (!t) return;
    t.hidden = false;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      t.classList.remove("show");
      t.hidden = true;
    }, ms || 3200);
  }

  /** Logo react state: idle | listen | talk | wake | act | err */
  function setLogoVoice(mode, intensity) {
    const logo = el("xai-logo-react");
    const head = el("sidebar-voice-head");
    if (logo) {
      logo.dataset.voice = mode || "idle";
      if (typeof intensity === "number") {
        logo.style.setProperty("--voice-level", String(Math.min(1, Math.max(0, intensity))));
      }
    }
    if (head) head.dataset.voice = mode || "idle";
    document.body.classList.toggle("voice-talking", mode === "talk" || mode === "wake");
    document.body.classList.toggle("voice-listening", mode === "listen" || mode === "talk");
  }

  function setHeard(text, interim) {
    const h = el("voice-heard");
    if (!h) return;
    h.textContent = text || (state.on ? "…" : "Tap Listen · talk to Grok");
    h.classList.toggle("interim", !!interim);
    h.classList.toggle("empty", !text);
  }

  function setIntent(text, cls) {
    const i = el("voice-intent");
    if (!i) return;
    i.textContent = text || "idle";
    i.className = "voice-intent" + (cls ? " " + cls : "");
  }

  function setActionChips(chips) {
    const row = el("voice-action-row");
    if (!row) return;
    row.innerHTML = "";
    if (!chips || !chips.length) {
      row.hidden = true;
      return;
    }
    row.hidden = false;
    chips.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "voice-chip" + (c.primary ? " primary" : "");
      b.textContent = c.label;
      b.title = c.hint || c.label;
      b.addEventListener("click", () => {
        if (typeof c.run === "function") c.run();
        else if (c.intent) runIntent(c.intent, c.phrase || c.label);
      });
      row.appendChild(b);
    });
  }

  function pushTurn(heard, intent, ok) {
    state.turns.unshift({
      t: Date.now(),
      heard: heard,
      intent: intent,
      ok: !!ok,
    });
    state.turns = state.turns.slice(0, MAX_TURNS);
    renderTurns();
  }

  function renderTurns() {
    const ul = el("voice-turns");
    if (!ul) return;
    ul.innerHTML = "";
    state.turns.forEach((tr) => {
      const li = document.createElement("li");
      li.className = tr.ok ? "ok" : "miss";
      const time = new Date(tr.t).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      li.innerHTML =
        '<span class="vt-time">' +
        esc(time) +
        '</span><span class="vt-heard">' +
        esc(tr.heard) +
        '</span><span class="vt-intent">' +
        esc(tr.intent) +
        "</span>";
      ul.appendChild(li);
    });
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function SpeechRec() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function isWake(transcript) {
    const t = String(transcript || "").trim();
    if (!t) return false;
    if (/^hey\s+grok\b/i.test(t)) return true;
    if (/^grok\b/i.test(t) && t.length < 48) return true;
    return WAKE.test(t) && (/\bhey\s+grok\b/i.test(t) || /^grok[\s,.!?]*$/i.test(t));
  }

  /**
   * Interpret utterance → lab tool intent (Voice Agent Builder style: hear → reason → act).
   * Returns { id, label, conf, run } or null.
   */
  function interpret(raw) {
    const t = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/[^\w\s:@./#-]/g, " ")
      .replace(/\s+/g, " ");
    if (!t) return null;

    // Wake / summon Grok
    if (
      /\b(hey\s+)?grok\b/.test(t) &&
      (/\b(summon|open|launch|start|wake|come)\b/.test(t) ||
        /^(hey\s+)?grok[\s!.?]*$/.test(t) ||
        t.length < 40)
    ) {
      if (
        /\b(summon|open|launch|terminal|multi)\b/.test(t) ||
        /^(hey\s+)?grok[\s!.?]*$/.test(t) ||
        /\bhey\s+grok\b/.test(t)
      ) {
        return {
          id: "summon",
          label: "summon Grok · multi-term",
          conf: 0.95,
          run: () => summonGrok(raw),
        };
      }
    }

    if (/\b(stop listening|listen off|quiet|mute mic)\b/.test(t)) {
      return {
        id: "listen-off",
        label: "stop listening",
        conf: 0.9,
        run: () => {
          if (state.on) toggle();
        },
      };
    }

    if (/\b(open\s+)?notes?\b/.test(t) && !/\b(github|footnote)\b/.test(t)) {
      return {
        id: "notes",
        label: "open Notes",
        conf: 0.88,
        run: () => {
          location.hash = "#/tool/notes";
          window.LabTools?.setMode?.("notes");
        },
      };
    }

    if (
      /\b(open|show)\s+ship\b/.test(t) ||
      /\bship\s+deck\b/.test(t) ||
      /\b(open|show)\s+plan(\s+mode)?\b/.test(t) ||
      /\b(open|show)\s+(skills?|plugins?|subagents?|q\s*&\s*a|q and a)\b/.test(t)
    ) {
      return {
        id: "ship",
        label: "open Ship",
        conf: 0.9,
        run: () => {
          location.hash = "#/tool/ship";
          window.LabTools?.setMode?.("ship");
        },
      };
    }

    if (/\b(open\s+)?history\b/.test(t)) {
      return {
        id: "history",
        label: "open History",
        conf: 0.88,
        run: () => {
          location.hash = "#/tool/history";
          window.LabTools?.setMode?.("history");
        },
      };
    }

    if (/\b(open\s+)?(table|spreadsheet)\b/.test(t)) {
      return {
        id: "table",
        label: "open Table",
        conf: 0.85,
        run: () => {
          location.hash = "#/tool/table";
        },
      };
    }

    if (/\b(multi[-\s]?term|multi terminal|terminals?)\b/.test(t)) {
      return {
        id: "multi-term",
        label: "open multi-term",
        conf: 0.9,
        run: () => window.LabTools?.openMultiTerm?.() || window.dispatchEvent(new CustomEvent("lab:summon-grok", { detail: { phrase: raw } })),
      };
    }

    if (/\b(triple\s+shells?|three\s+shells?|handoff\s+loop)\b/.test(t)) {
      return {
        id: "triple-shells",
        label: "spawn triple shells",
        conf: 0.92,
        run: () => {
          location.hash = "#/tool/ship";
          window.LabTools?.setMode?.("ship");
          fetch("/api/shells/spawn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ triple: true, task: raw }),
          }).catch(() => {});
        },
      };
    }

    if (/\b(kill|stop|reap)\s+ffmpeg\b/.test(t) || /\bffmpeg\s+off\b/.test(t)) {
      return {
        id: "kill-ffmpeg",
        label: "kill ffmpeg",
        conf: 0.92,
        run: () =>
          fetch("/api/mitigate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "kill-ffmpeg" }),
          }).catch(() => {}),
      };
    }

    // Dev playpen — manage / explore / mitigate / research / voice
    if (
      /\b(soft[-\s]?recover|recover\s+(session|lab)|playpen\s+recover)\b/.test(t)
    ) {
      return {
        id: "soft-recover",
        label: "playpen soft-recover",
        conf: 0.93,
        run: () =>
          fetch("/api/playpen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain: "mitigate", action: "soft-recover" }),
          }).catch(() => {}),
      };
    }
    if (/\b(diagnose|playpen\s+status|lab\s+health)\b/.test(t)) {
      return {
        id: "playpen-diagnose",
        label: "playpen diagnose",
        conf: 0.9,
        run: () =>
          fetch("/api/playpen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain: "mitigate", action: "diagnose" }),
          })
            .then((r) => r.json())
            .then((j) => {
              const rec = (j.recommend || []).join("; ");
              setIntent(rec || "diagnose ok", j.ok ? "ok" : "err");
            })
            .catch(() => {}),
      };
    }
    if (
      /\b(say\s+status|announce\s+status|voice\s+status)\b/.test(t) ||
      /^\/voice\b/.test(t)
    ) {
      const speakMatch = t.match(/speak\s+(.+)$/i) || t.match(/say\s+(.+)$/i);
      const payload = speakMatch
        ? { action: "speak", text: speakMatch[1] }
        : { action: "say-status" };
      return {
        id: "voice-playpen",
        label: payload.action === "speak" ? "voice speak" : "voice say-status",
        conf: 0.94,
        run: () =>
          fetch("/api/voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).catch(() => {}),
      };
    }
    if (/\b(open\s+)?playpen\b/.test(t) || /\bdev\s+playpen\b/.test(t)) {
      return {
        id: "playpen-docs",
        label: "open playpen docs",
        conf: 0.88,
        run: () => {
          location.hash = "#/30-playpen";
        },
      };
    }
    if (/\bresearch\s+crash/.test(t) || /\bcrash\s+(log|report)\b/.test(t)) {
      return {
        id: "research-crash",
        label: "research crash log",
        conf: 0.9,
        run: () =>
          fetch("/api/playpen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain: "research", action: "crash" }),
          }).catch(() => {}),
      };
    }

    // Floating Siri-style walkie
    if (
      /\b(siri|float(ing)?\s+(walkie|burst|orb)|hover\s+walkie)\b/.test(t) ||
      /\bshow\s+(float|siri|orb)\b/.test(t)
    ) {
      if (/\b(hide|close|dismiss)\b/.test(t)) {
        return {
          id: "siri-hide",
          label: "hide floating walkie",
          conf: 0.9,
          run: () => window.LabWalkie?.hideSiri?.(),
        };
      }
      return {
        id: "siri-show",
        label: "show floating walkie",
        conf: 0.9,
        run: () => {
          window.LabWalkie?.showSiri?.();
          window.LabWalkie?.expandSiri?.();
          window.dispatchEvent(new CustomEvent("lab:siri-burst"));
        },
      };
    }

    // Walkie burst camera (not stream-feed cam)
    if (
      /\b(walkie\s+)?(cam|camera)\b/.test(t) ||
      /\b(open|start|enable|show)\s+(the\s+)?(cam|camera)\b/.test(t) ||
      /\bturn\s+on\s+(the\s+)?(cam|camera)\b/.test(t)
    ) {
      if (/\b(stop|off|close|disable)\b/.test(t)) {
        return {
          id: "walkie-cam-off",
          label: "walkie cam off",
          conf: 0.88,
          run: () => window.LabWalkie?.stopCam?.(),
        };
      }
      return {
        id: "walkie-cam",
        label: "walkie cam on",
        conf: 0.9,
        run: () => {
          const sec = el("sb-sec-walkie");
          if (sec) sec.open = true;
          if (window.LabWalkie?.isCamOn?.()) return;
          // enableCam toggles — only call when off
          window.LabWalkie?.enableCam?.();
        },
      };
    }

    if (/\b(play|stream)\s+(demo|overview|blank|live|cam)\b/.test(t) || /\bplay\s+video\b/.test(t)) {
      let preset = "demo";
      if (/\boverview\b/.test(t)) preset = "overview";
      else if (/\bblank\b/.test(t)) preset = "blank";
      else if (/\blive\b/.test(t)) preset = "live";
      else if (/\bcam\b/.test(t)) preset = "cam";
      return {
        id: "media-play",
        label: "play stream · " + preset,
        conf: 0.86,
        run: () => {
          const sec = el("sb-sec-video");
          if (sec) sec.open = true;
          const chip = document.querySelector('.sv-chip[data-preset="' + preset + '"]');
          if (chip) chip.click();
          else
            window.dispatchEvent(
              new CustomEvent("lab:media-play", {
                detail: { url: preset === "cam" ? "device:0" : "https://www.youtube.com/watch?v=aqz-KE-bpKQ" },
              })
            );
        },
      };
    }

    if (/\b(stop|close)\s+(video|stream|feed)\b/.test(t)) {
      return {
        id: "media-stop",
        label: "stop stream",
        conf: 0.85,
        run: () => {
          window.LabVideo?.stop?.();
          window.dispatchEvent(new CustomEvent("lab:media-stop"));
        },
      };
    }

    if (/\b(join\s+)?mesh\b/.test(t) || /\bcollab(orate)?\b/.test(t)) {
      return {
        id: "mesh",
        label: "mesh collab",
        conf: 0.8,
        run: () => {
          const sec = el("sb-sec-mesh");
          if (sec) sec.open = true;
          el("btn-mesh-join")?.click();
        },
      };
    }

    if (/\b(open\s+)?(overview|architecture|roadmap|brand|local stack)\b/.test(t)) {
      const map = {
        overview: "00-overview",
        architecture: "01-architecture",
        roadmap: "09-roadmap",
        brand: "12-brand",
        "local stack": "11-local-stack",
      };
      let id = "00-overview";
      for (const [k, v] of Object.entries(map)) {
        if (t.includes(k)) {
          id = v;
          break;
        }
      }
      return {
        id: "docs",
        label: "open docs · " + id,
        conf: 0.84,
        run: () => {
          location.hash = "#/" + id;
        },
      };
    }

    if (/\b(voice agent|agent builder|x\.?ai docs)\b/.test(t)) {
      return {
        id: "xai-voice",
        label: "open Voice Agent Builder",
        conf: 0.9,
        run: () =>
          window.open(
            "https://console.x.ai/team/default/voice/agents?campaign=lab-voice&builder=1",
            "_blank",
            "noopener"
          ),
      };
    }

    // Page walkthrough / section highlight (Grok shows the work)
    if (
      /\b(walk\s*through|walkthrough|tour|guide me|show\s+me|highlight)\b/.test(t)
    ) {
      if (/\b(stop|end|exit|close|done)\b/.test(t)) {
        return {
          id: "walk-stop",
          label: "end walkthrough",
          conf: 0.9,
          run: () => window.LabWalkthrough?.stop?.(),
        };
      }
      if (/\b(next|continue|forward)\b/.test(t)) {
        return {
          id: "walk-next",
          label: "walkthrough next",
          conf: 0.92,
          run: () => window.LabWalkthrough?.next?.(),
        };
      }
      if (/\b(prev|previous|back)\b/.test(t)) {
        return {
          id: "walk-prev",
          label: "walkthrough prev",
          conf: 0.9,
          run: () => window.LabWalkthrough?.prev?.(),
        };
      }
      // “highlight architecture” / “show crate layers”
      const m = t.match(
        /\b(?:highlight|show(?:\s+me)?|section)\s+(.+)$/
      );
      if (m && m[1] && !/\b(walk|tour)\b/.test(m[1])) {
        const q = m[1].replace(/\b(please|section|the)\b/g, "").trim();
        return {
          id: "walk-find",
          label: "highlight · " + q.slice(0, 32),
          conf: 0.86,
          run: () => window.LabWalkthrough?.highlightQuery?.(q),
        };
      }
      return {
        id: "walk-start",
        label: "start walkthrough",
        conf: 0.9,
        run: () => window.LabWalkthrough?.start?.(),
      };
    }

    // Bare wake already handled; leftover "hey grok …" unknown → still summon
    if (isWake(t)) {
      return {
        id: "summon",
        label: "wake · summon Grok",
        conf: 0.75,
        run: () => summonGrok(raw),
      };
    }

    return {
      id: "unknown",
      label: "heard · no tool match",
      conf: 0.2,
      run: null,
    };
  }

  function runIntent(intent, phrase) {
    if (!intent) return;
    const now = Date.now();
    if (intent.id !== "unknown" && now - state.lastAction < 900) return;
    if (intent.id !== "unknown") state.lastAction = now;

    setIntent(intent.label + (intent.conf ? " · " + Math.round(intent.conf * 100) + "%" : ""), intent.id === "unknown" ? "miss" : "hit");
    setLogoVoice(intent.id === "unknown" ? "listen" : "act", 0.85);

    if (typeof intent.run === "function") {
      try {
        intent.run();
        pushTurn(phrase, intent.label, true);
        setActionChips([
          { label: "again", primary: true, run: () => intent.run() },
          {
            label: "summon",
            run: () => summonGrok(phrase),
          },
        ]);
      } catch (e) {
        pushTurn(phrase, intent.label + " · err", false);
        setIntent("error: " + (e.message || e), "err");
        setLogoVoice("err", 0.5);
      }
    } else {
      pushTurn(phrase, intent.label, false);
      setActionChips([
        {
          label: "summon Grok",
          primary: true,
          run: () => summonGrok(phrase),
        },
        {
          label: "open notes",
          intent: { id: "notes", label: "open Notes", run: () => (location.hash = "#/tool/notes") },
        },
        {
          label: "Voice Builder ↗",
          run: () =>
            window.open("https://x.ai/news/grok-voice-agent-builder", "_blank", "noopener"),
        },
      ]);
    }

    setTimeout(() => {
      if (state.on) setLogoVoice(state.level > 0.12 ? "talk" : "listen", state.level);
    }, 1200);
  }

  async function summonGrok(phrase) {
    const now = Date.now();
    if (now - state.lastSummon < 2500) return;
    state.lastSummon = now;

    toast("Summoning Grok… (“" + String(phrase).slice(0, 48) + "”)");
    setStatus("summoned", "hot");
    setIntent("summon Grok · multi-term", "hit");
    setLogoVoice("wake", 1);
    document.body.classList.add("grok-summoned");
    setTimeout(() => document.body.classList.remove("grok-summoned"), 1800);

    window.dispatchEvent(
      new CustomEvent("lab:summon-grok", { detail: { phrase: phrase } })
    );

    try {
      const r = await fetch("/api/summon-grok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase: phrase, source: "lab-listen", multi: true }),
      });
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        toast(
          j.launched
            ? "Grok launched · " + (j.via || "local")
            : "Summon ok · " + (j.message || "check terminal"),
          4000
        );
        setIntent(
          j.launched ? "launched · " + (j.via || "local") : j.message || "summoned",
          "hit"
        );
        pushTurn(phrase, "summon · " + (j.via || "ok"), !!j.launched || j.ok);
        setStatus("listening", "on");
        setLogoVoice("listen", 0.35);
        return;
      }
    } catch (_) {
      /* fall through */
    }

    toast("Say again or run: grok  ·  see Local stack", 4500);
    if (location.hash !== "#/11-local-stack") {
      location.hash = "#/11-local-stack";
    }
    pushTurn(phrase, "summon · fallback docs", false);
    setStatus("listening", "on");
    setLogoVoice("listen", 0.3);
  }

  /* ── Mic level → logo glow intensity ── */
  async function startMicLevel() {
    stopMicLevel();
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      state.micStream = stream;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      state.audioCtx = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      src.connect(analyser);
      state.analyser = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      // Share with walkie ring waveform (walkie-dock.js)
      window.__labVoiceAnalyser = analyser;
      window.__labVoiceBins = data;

      const tick = () => {
        if (!state.on || !state.analyser) return;
        state.analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length / 255;
        // speech band emphasis (rough)
        let mid = 0;
        const a = Math.floor(data.length * 0.08);
        const b = Math.floor(data.length * 0.45);
        for (let i = a; i < b; i++) mid += data[i];
        mid = mid / (b - a) / 255;
        const level = Math.min(1, Math.pow(Math.max(avg, mid * 1.25), 0.85) * 1.6);
        state.level = level;
        window.__labVoiceLevel = level;
        applyLevelUI(level);
        state.raf = requestAnimationFrame(tick);
      };
      if (ctx.state === "suspended") await ctx.resume();
      state.raf = requestAnimationFrame(tick);
    } catch (e) {
      console.warn("[voice] mic level", e);
    }
  }

  function applyLevelUI(level) {
    const bars = el("voice-level");
    if (bars) {
      const kids = bars.querySelectorAll("i");
      kids.forEach((n, i) => {
        const thr = (i + 1) / (kids.length + 0.5);
        n.classList.toggle("on", level > thr * 0.22);
        n.style.setProperty("--h", String(0.25 + level * (0.4 + i * 0.08)));
      });
    }
    if (!state.on) return;
    if (level > 0.14) {
      setLogoVoice("talk", level);
      clearTimeout(state.talkingTimer);
      state.talkingTimer = setTimeout(() => {
        if (state.on) setLogoVoice("listen", state.level);
      }, 420);
    } else if (level > 0.04) {
      setLogoVoice("listen", Math.max(0.2, level));
    } else {
      setLogoVoice("listen", 0.12);
    }
  }

  function stopMicLevel() {
    if (state.raf) {
      cancelAnimationFrame(state.raf);
      state.raf = 0;
    }
    if (window.__labVoiceAnalyser === state.analyser) {
      window.__labVoiceAnalyser = null;
      window.__labVoiceBins = null;
      window.__labVoiceLevel = 0;
    }
    if (state.micStream) {
      state.micStream.getTracks().forEach((t) => t.stop());
      state.micStream = null;
    }
    if (state.audioCtx) {
      try {
        state.audioCtx.close();
      } catch (_) {}
      state.audioCtx = null;
    }
    state.analyser = null;
    state.level = 0;
    applyLevelUI(0);
  }

  function stopRec() {
    if (state.restartTimer) {
      clearTimeout(state.restartTimer);
      state.restartTimer = 0;
    }
    if (state.rec) {
      try {
        state.rec.onend = null;
        state.rec.onerror = null;
        state.rec.stop();
      } catch (_) {}
      state.rec = null;
    }
  }

  function stopStt() {
    state.sttMode = false;
    state.speechOpen = false;
    state.silenceMs = 0;
    if (state.sttPoll) {
      clearInterval(state.sttPoll);
      state.sttPoll = 0;
    }
    if (state.mediaRec) {
      try {
        state.mediaRec.ondataavailable = null;
        state.mediaRec.onstop = null;
        if (state.mediaRec.state === "recording") state.mediaRec.stop();
      } catch (_) {}
      state.mediaRec = null;
    }
    state.mediaChunks = [];
  }

  function pickRecorderMime() {
    if (!window.MediaRecorder) return "";
    const cands = [
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/wav",
    ];
    for (let i = 0; i < cands.length; i++) {
      try {
        if (MediaRecorder.isTypeSupported(cands[i])) return cands[i];
      } catch (_) {}
    }
    return "";
  }

  /**
   * Continuous Listen hears the room (X Spaces, music, terminals).
   * Only auto-act on: Hold/PTT, wake phrase, or short window after wake.
   * Everything else is shown as "heard" but does not run tools.
   */
  function shouldActOnTranscript(text) {
    if (state.pttActive || state.fromPttClip) return true;
    const t = String(text || "").trim();
    if (!t) return false;
    if (isWake(t) || /\bhey\s+grok\b/i.test(t)) {
      state.wakeArmedUntil = Date.now() + 14000;
      return true;
    }
    // "grok … tool" mid-utterance while already armed or with explicit vocative
    if (Date.now() < state.wakeArmedUntil) return true;
    if (/\bhey\s+grok\b/i.test(t) || /^grok[,:\s]/i.test(t)) {
      state.wakeArmedUntil = Date.now() + 14000;
      return true;
    }
    return false;
  }

  /** Feed final transcript into the same intent router as Web Speech. */
  function handleFinalTranscript(raw) {
    const final = String(raw || "").trim();
    if (!final) return;
    setHeard(final, false);
    setStatus("heard", "on");
    setLogoVoice("talk", Math.max(state.level, 0.55));

    const act = shouldActOnTranscript(final);
    state.fromPttClip = false;
    if (!act) {
      // Background speech (broadcast, charts log noise in the room, etc.)
      setIntent("heard · Hold or “hey grok” to act", "miss");
      pushTurn(final.slice(0, 80), "background · no act", false);
      return;
    }

    const intent = interpret(final);
    if (!intent) return;
    setIntent(
      intent.label + " · " + Math.round((intent.conf || 0) * 100) + "%",
      intent.id === "unknown" ? "miss" : "hit"
    );
    if (intent.conf >= 0.72 && intent.run) {
      runIntent(intent, final);
    } else if (intent.id === "unknown") {
      setActionChips([
        {
          label: "summon Grok",
          primary: true,
          run: () => summonGrok(final),
        },
        {
          label: "open notes",
          run: () => {
            location.hash = "#/tool/notes";
          },
        },
        {
          label: "play demo",
          run: () => {
            const chip = document.querySelector('.sv-chip[data-preset="demo"]');
            if (chip) chip.click();
          },
        },
      ]);
      pushTurn(final, intent.label, false);
    } else {
      runIntent(intent, final);
    }
  }

  function handleInterimTranscript(raw) {
    const interim = String(raw || "").trim();
    if (!interim) return;
    setHeard(interim, true);
    const guess = interpret(interim);
    if (guess && guess.id !== "unknown") {
      setIntent("… " + guess.label, "hot");
    } else {
      setIntent("listening…", "hot");
    }
  }

  async function sendSttBlob(blob) {
    if (!blob || blob.size < 600 || state.sttBusy) return;
    state.sttBusy = true;
    setStatus("transcribing…", "on");
    setIntent("Grok STT…", "hot");
    const mime = (blob.type || "audio/webm").split(";")[0] || "audio/webm";
    try {
      const r = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": mime,
          "X-Language": "en",
        },
        body: blob,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = String(j.error || j.message || "STT HTTP " + r.status);
        setStatus("stt err", "err");
        let short = err;
        if (/credit|spending limit|monthly/i.test(err)) {
          short = "STT credits exhausted · top up xAI or type intents";
        } else if (/XAI_API_KEY|not set/i.test(err)) {
          short = "set XAI_API_KEY for Grok STT";
        }
        setIntent(short.slice(0, 72), "err");
        if (r.status === 503 || /XAI_API_KEY|not set/i.test(err)) {
          toast("Set XAI_API_KEY for Grok STT (Web Speech blocked in native)");
        } else if (/credit|spending limit/i.test(err)) {
          toast("xAI STT credits / spend limit hit — type or top up console.x.ai");
        } else {
          toast("STT: " + short.slice(0, 48));
        }
        return;
      }
      const text = String(j.text || j.transcript || "").trim();
      if (text) {
        handleFinalTranscript(text);
        setStatus(state.sttMode ? "listening · grok stt" : "listening", "on");
      } else {
        setStatus(state.sttMode ? "listening · grok stt" : "listening", "on");
        setIntent("no speech in clip · try again", "miss");
      }
    } catch (e) {
      setStatus("stt err", "err");
      setIntent("STT network error", "err");
      console.warn("[voice] stt", e);
    } finally {
      state.sttBusy = false;
    }
  }

  function beginUtteranceRecord() {
    if (!state.on || !state.sttMode || state.sttBusy) return;
    if (state.mediaRec && state.mediaRec.state === "recording") return;
    const stream = state.micStream;
    if (!stream || !stream.active) return;
    if (!window.MediaRecorder) {
      setIntent("MediaRecorder missing · type instead", "err");
      return;
    }
    const mime = pickRecorderMime();
    let rec;
    try {
      rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
    } catch (e) {
      console.warn("[voice] MediaRecorder", e);
      setIntent("could not record audio", "err");
      return;
    }
    state.mediaChunks = [];
    state.mediaRec = rec;
    state.speechOpen = true;
    state.speechStartedAt = Date.now();
    state.silenceMs = 0;
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) state.mediaChunks.push(ev.data);
    };
    rec.onstop = () => {
      const type = rec.mimeType || mime || "audio/webm";
      const blob = new Blob(state.mediaChunks, { type: type });
      state.mediaChunks = [];
      state.mediaRec = null;
      state.speechOpen = false;
      if (state.on && state.sttMode) sendSttBlob(blob);
    };
    try {
      rec.start(250);
      setHeard("…", true);
      setIntent("capturing…", "hot");
      setLogoVoice("talk", Math.max(state.level, 0.5));
    } catch (e) {
      state.mediaRec = null;
      state.speechOpen = false;
      console.warn("[voice] rec.start", e);
    }
  }

  function endUtteranceRecord() {
    if (!state.mediaRec || state.mediaRec.state !== "recording") {
      state.speechOpen = false;
      return;
    }
    try {
      state.mediaRec.requestData?.();
      state.mediaRec.stop();
    } catch (_) {
      state.mediaRec = null;
      state.speechOpen = false;
    }
  }

  /** Voice-activity: open clip when talking, close after short silence. */
  function tickSttVad() {
    if (!state.on || !state.sttMode || state.sttBusy) return;
    // Don't burn STT / mis-hear broadcast while tab is backgrounded
    if (state.pausedBg && !state.pttActive) {
      if (state.speechOpen) endUtteranceRecord();
      return;
    }
    // Hold path records only while pttActive — skip free VAD during hold
    if (state.pttActive) return;
    const now = Date.now();
    const dt = state.lastVadTs ? Math.min(200, now - state.lastVadTs) : 80;
    state.lastVadTs = now;
    const level = state.level || 0;
    // Higher thresholds so room/TV/Spaces hum does not open clips constantly
    const speaking = level > 0.22;
    const quiet = level < 0.08;

    if (!state.speechOpen) {
      if (speaking) beginUtteranceRecord();
      return;
    }
    // hard cap utterance length
    if (now - state.speechStartedAt > 7000) {
      endUtteranceRecord();
      return;
    }
    if (quiet) {
      state.silenceMs += dt;
      if (state.silenceMs > 850) endUtteranceRecord();
    } else {
      state.silenceMs = 0;
    }
  }

  async function startSttFallback(reason) {
    stopRec();
    state.webspeechBlocked = true;
    state.sttMode = true;
    state.lastVadTs = 0;
    state.silenceMs = 0;
    const why = reason || "service-not-allowed";
    setStatus("listening · grok stt", "on");
    setIntent("Hold or “hey grok” · room audio ignored", "hot");
    setLogoVoice("listen", 0.28);
    if (why !== "hold" && why !== "native-wkwebview") {
      toast("Grok STT · Hold to talk or say hey grok");
    } else if (why === "native-wkwebview") {
      toast("Listen armed · Hold or “hey grok” (broadcast ignored)");
    }
    if (!state.micStream) {
      try {
        await startMicLevel();
      } catch (_) {}
    }
    if (!state.micStream) {
      setStatus("mic needed", "err");
      setIntent("mic required for Grok STT", "err");
      toast("Allow microphone for Listen");
      state.on = false;
      syncBtn();
      stopStt();
      return;
    }
    if (state.sttPoll) clearInterval(state.sttPoll);
    state.sttPoll = setInterval(tickSttVad, 80);
  }

  function isNativeShell() {
    return !!(
      window.LabDesktop?.isNative ||
      window.LabDesktop?.isDesktop ||
      document.body?.classList?.contains("lab-native") ||
      document.documentElement?.classList?.contains("lab-native") ||
      /GrokBuildLab|architecture-lab|grok-build-lab/i.test(navigator.userAgent || "")
    );
  }

  function startRec() {
    // Prefer Grok STT when Web Speech already failed in this session
    if (state.webspeechBlocked || state.preferStt) {
      startSttFallback(state.webspeechBlocked ? "service-not-allowed" : "prefer-stt");
      return;
    }
    // WKWebView almost always returns service-not-allowed for Web Speech —
    // skip the flash and use Grok STT immediately in the native shell.
    if (isNativeShell()) {
      state.preferStt = true;
      startSttFallback("native-wkwebview");
      return;
    }
    const SR = SpeechRec();
    if (!SR) {
      // No SpeechRecognition — go straight to Grok STT
      startSttFallback("no-speech-api");
      return;
    }
    stopRec();
    const rec = new SR();
    state.rec = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      if (!state.on || state.sttMode) return;
      let final = "";
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      const live = (final || interim).trim();
      if (live) {
        setHeard(live, !final);
        setLogoVoice("talk", Math.max(state.level, 0.55));
      }
      if (final) {
        handleFinalTranscript(final);
      } else if (interim) {
        handleInterimTranscript(interim);
      }
    };

    rec.onerror = (ev) => {
      const err = String(ev.error || "");
      // Mic permission denied
      if (err === "not-allowed") {
        setStatus("mic denied", "err");
        setIntent("mic permission denied", "err");
        setLogoVoice("err", 0.3);
        state.on = false;
        syncBtn();
        stopRec();
        stopMicLevel();
        toast("Mic permission denied for listening");
        return;
      }
      // WKWebView / Safari: recognition service blocked (mic can still work)
      if (
        err === "service-not-allowed" ||
        err === "service_not_allowed" ||
        err === "network" ||
        err === "language-not-supported"
      ) {
        stopRec();
        startSttFallback(err || "service-not-allowed");
        return;
      }
      if (err === "no-speech" || err === "aborted") return;
      // Unknown errors: surface once, then fall back so Listen keeps working
      console.warn("[voice] speech error", err);
      stopRec();
      startSttFallback(err || "speech-error");
    };

    rec.onend = () => {
      if (!state.on || state.sttMode) return;
      state.restartTimer = setTimeout(() => {
        if (state.on && !state.sttMode) {
          try {
            startRec();
          } catch (_) {
            startSttFallback("restart-failed");
          }
        }
      }, 280);
    };

    try {
      rec.start();
      setStatus("listening", "on");
      setIntent("listening · say “hey grok” or a tool", "hot");
      setLogoVoice("listen", 0.25);
    } catch (err) {
      // start() can throw when service is blocked
      console.warn("[voice] rec.start failed", err);
      startSttFallback("start-failed");
    }
  }

  function syncBtn() {
    const btn = el("btn-listen");
    if (!btn) return;
    btn.setAttribute("aria-pressed", state.on ? "true" : "false");
    btn.classList.toggle("active", state.on);
    btn.textContent = state.on ? "Listening" : "Listen";
    document.body.classList.toggle("listen-active", state.on);
    setReadoutVisible(state.on);
    if (!state.on) {
      setLogoVoice("idle", 0);
      setHeard("");
      setIntent("idle");
    }
  }

  function toggle() {
    state.on = !state.on;
    syncBtn();
    if (state.on) {
      setReadoutVisible(true);
      setStatus("starting…", "on");
      setHeard("armed…", true);
      setIntent("Hold or “hey grok” · room audio ignored", "hot");
      setLogoVoice("listen", 0.2);
      startMicLevel();
      startRec();
      toast("Listen armed · Hold to talk or say hey grok");
      setActionChips([
        {
          label: "summon",
          primary: true,
          run: () => summonGrok("chip"),
        },
        {
          label: "walkthrough",
          run: () => window.LabWalkthrough?.start?.(),
        },
        {
          label: "notes",
          run: () => {
            location.hash = "#/tool/notes";
          },
        },
        {
          label: "demo stream",
          run: () => document.querySelector('.sv-chip[data-preset="demo"]')?.click(),
        },
      ]);
    } else {
      state.pttActive = false;
      state.fromPttClip = false;
      state.wakeArmedUntil = 0;
      stopRec();
      stopStt();
      stopMicLevel();
      setStatus("off");
      setHeard("");
      setIntent("idle");
      setActionChips([]);
      setLogoVoice("idle", 0);
      setReadoutVisible(false);
      toast("Listening off");
    }
  }

  /** Hold-to-talk: record while pressed, STT on release (orb Hold / walkie). */
  function pttDown() {
    state.pttActive = true;
    state.fromPttClip = true;
    state.pausedBg = false;
    if (!state.on) {
      state.on = true;
      syncBtn();
      setReadoutVisible(true);
      startMicLevel().then(() => {
        if (!state.sttMode) startSttFallback("hold");
        beginUtteranceRecord();
      });
      return;
    }
    if (!state.sttMode) {
      // Force STT path for hold (more reliable than Web Speech in native)
      stopRec();
      startSttFallback("hold");
    }
    beginUtteranceRecord();
  }

  function pttUp() {
    state.pttActive = false;
    state.fromPttClip = true; // next blob is intentional PTT
    if (state.speechOpen) endUtteranceRecord();
  }

  function bind() {
    // Never leave listen-active sticky from HTML — only when Listen is on
    if (!state.on) document.body.classList.remove("listen-active");

    // Pause free VAD when user is watching Spaces / other apps
    const onVis = () => {
      state.pausedBg = !!document.hidden;
      if (state.pausedBg && state.speechOpen && !state.pttActive) {
        try {
          endUtteranceRecord();
        } catch (_) {}
      }
      if (state.on && state.pausedBg) {
        setIntent("paused (tab hidden) · Hold still works", "miss");
      } else if (state.on && !state.pausedBg) {
        setIntent("Hold or “hey grok” · room audio ignored", "hot");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", () => {
      if (!state.pttActive) state.pausedBg = true;
    });
    window.addEventListener("focus", () => {
      state.pausedBg = !!document.hidden;
    });

    el("btn-listen")?.addEventListener("click", toggle);
    // Click logo while listening → manual summon pulse
    el("xai-logo-react")?.addEventListener("click", (e) => {
      // don't steal brand link entirely — only when meta/ctrl or listening double-path
      if (!state.on) return;
      // allow normal brand nav via the <a>; glow feedback on container
      setLogoVoice("talk", 0.6);
    });

    // Hold button on orb/chat — push-to-talk via Grok STT
    const holdBtn = el("siri-btn-hold") || el("btn-hold");
    if (holdBtn) {
      holdBtn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        try {
          holdBtn.setPointerCapture?.(e.pointerId);
        } catch (_) {}
        pttDown();
      });
      const up = (e) => {
        pttUp();
        try {
          holdBtn.releasePointerCapture?.(e.pointerId);
        } catch (_) {}
      };
      holdBtn.addEventListener("pointerup", up);
      holdBtn.addEventListener("pointercancel", up);
    }

    window.LabGrokListen = {
      toggle: toggle,
      summon: () => summonGrok("manual"),
      isOn: () => state.on,
      interpret: interpret,
      setHeard: setHeard,
      setIntent: setIntent,
      pttDown: pttDown,
      pttUp: pttUp,
      useStt: () => {
        state.preferStt = true;
        state.webspeechBlocked = true;
        if (state.on) startSttFallback("manual");
      },
      mode: () => (state.sttMode ? "grok-stt" : "webspeech"),
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
