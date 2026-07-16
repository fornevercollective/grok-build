/**
 * SpaceXAI Grok Voice spheres — hover / float constellation.
 * Catalog: assets/spacexai-voices.json · live merge: GET /api/voices
 * Selection → localStorage lab.voiceId · optional TTS preview via POST /api/tts
 */
(function () {
  "use strict";

  const KEY = "lab.voiceId";
  const POS_KEY = "lab.voiceSphere.pos.v1";
  const FILTER_KEY = "lab.voiceSphere.filter";

  const state = {
    voices: [],
    models: null,
    selected: "eve",
    filter: "all",
    live: false,
    dragging: null,
    audio: null,
  };

  function el(id) {
    return document.getElementById(id);
  }

  function loadSelected() {
    try {
      return (localStorage.getItem(KEY) || "eve").toLowerCase();
    } catch {
      return "eve";
    }
  }

  function saveSelected(id) {
    state.selected = (id || "eve").toLowerCase();
    try {
      localStorage.setItem(KEY, state.selected);
    } catch (_) {}
    window.LabVoice = Object.assign(window.LabVoice || {}, {
      voiceId: state.selected,
      voice: getVoice(state.selected),
      models: state.models,
    });
    document.dispatchEvent(
      new CustomEvent("lab-voice-selected", { detail: { voiceId: state.selected } })
    );
    renderActive();
  }

  function getVoice(id) {
    id = (id || "").toLowerCase();
    return state.voices.find((v) => v.id === id) || null;
  }

  function hashHue(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  function normalizeVoice(v, i) {
    const id = String(v.voice_id || v.id || v.name || "voice" + i)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    return {
      id,
      name: v.name || id,
      gen: v.gen || (v.generation === "original" ? "original" : "flagship"),
      tone: v.tone || v.description || v.personality || "",
      hue: typeof v.hue === "number" ? v.hue : hashHue(id),
      role: v.role || v.category || "general",
      custom: !!v.custom || !!v.is_custom,
    };
  }

  async function loadCatalog() {
    let catalog = null;
    try {
      const r = await fetch("assets/spacexai-voices.json?_=" + Date.now(), {
        cache: "no-store",
      });
      if (r.ok) catalog = await r.json();
    } catch (_) {}

    let live = null;
    try {
      const r = await fetch("/api/voices", { cache: "no-store" });
      if (r.ok) live = await r.json();
    } catch (_) {}

    const byId = new Map();
    if (catalog && Array.isArray(catalog.voices)) {
      catalog.voices.forEach((v, i) => {
        const n = normalizeVoice(v, i);
        byId.set(n.id, n);
      });
      state.models = catalog.models || null;
    }
    if (live && live.ok && Array.isArray(live.voices)) {
      state.live = !!live.live;
      live.voices.forEach((v, i) => {
        const n = normalizeVoice(v, i);
        // live wins on name/tone when present
        const prev = byId.get(n.id);
        byId.set(n.id, prev ? { ...prev, ...n, hue: prev.hue } : n);
      });
      if (live.models) state.models = Object.assign({}, state.models || {}, live.models);
    }

    state.voices = Array.from(byId.values()).sort((a, b) => {
      if (a.gen !== b.gen) return a.gen === "original" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    if (!state.voices.length) {
      // absolute fallback
      state.voices = ["ara", "eve", "leo", "rex", "sal"].map((id, i) =>
        normalizeVoice({ id, name: id[0].toUpperCase() + id.slice(1) }, i)
      );
    }
    state.selected = loadSelected();
    if (!getVoice(state.selected)) state.selected = state.voices[0].id;
    saveSelected(state.selected);
  }

  function layoutPositions(n) {
    // Pack spheres in a soft grid with slight polar jitter for float feel
    const cols = Math.ceil(Math.sqrt(n * 1.35));
    const rows = Math.ceil(n / cols);
    const pts = [];
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols && i < n; c++, i++) {
        const u = (c + 0.5) / cols;
        const v = (r + 0.5) / rows;
        const jx = (Math.sin(i * 2.7) * 0.04);
        const jy = (Math.cos(i * 1.9) * 0.05);
        pts.push({
          x: 8 + (u + jx) * 84,
          y: 12 + (v + jy) * 76,
        });
      }
    }
    return pts;
  }

  function loadPosMap() {
    try {
      return JSON.parse(localStorage.getItem(POS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function savePosMap(map) {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(map));
    } catch (_) {}
  }

  function filteredVoices() {
    if (state.filter === "all") return state.voices;
    if (state.filter === "original") return state.voices.filter((v) => v.gen === "original");
    if (state.filter === "flagship") return state.voices.filter((v) => v.gen === "flagship");
    return state.voices.filter((v) => v.role === state.filter);
  }

  function sizeFor(v, i, n) {
    // Slightly larger so official marks stay legible
    if (v.id === state.selected) return 40;
    if (v.gen === "original") return 34;
    return 28 + (i % 3) * 2;
  }

  /** Official Grok logomark only — unaltered (see content/12-brand.md).
   *  Do NOT put the corporate SpaceXAI symbol on voice orbs (looks like an "exec" logo).
   *  SpaceXAI name is text attribution; the product face for Grok Voice is the Grok mark.
   */
  const BRAND = {
    grok: "assets/brand/grok-logomark-light.svg",
  };

  function brandSrcFor(_v) {
    return BRAND.grok;
  }

  function brandAltFor(_v) {
    return "Grok";
  }

  function render() {
    const field = el("voice-sphere-field");
    const head = el("voice-constellation-active");
    const liveEl = el("voice-constellation-live");
    if (!field) return;

    const list = filteredVoices();
    const saved = loadPosMap();
    const layout = layoutPositions(list.length);

    field.innerHTML = "";
    list.forEach((v, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "voice-sphere" + (v.id === state.selected ? " vc-active" : "");
      btn.dataset.voiceId = v.id;
      btn.setAttribute("aria-label", v.name + " voice");
      btn.title = v.name + (v.tone ? " — " + v.tone : "");

      const pos = saved[v.id] || layout[i] || { x: 50, y: 50 };
      btn.style.left = pos.x + "%";
      btn.style.top = pos.y + "%";
      const sz = sizeFor(v, i, list.length);
      btn.style.setProperty("--sz", sz + "px");
      btn.style.setProperty("--hue", String(v.hue));
      btn.style.setProperty("--dur", 5.5 + (i % 5) * 0.7 + "s");
      btn.style.setProperty("--delay", -(i * 0.35) + "s");

      // Official SpaceXAI / Grok mark (unaltered) + hue halo via CSS ::before
      btn.innerHTML =
        '<img class="vc-brand" src="' +
        brandSrcFor(v) +
        '" alt="' +
        escapeHtml(brandAltFor(v)) +
        '" width="48" height="48" draggable="false" />' +
        '<span class="vc-tip"><strong>' +
        escapeHtml(v.name) +
        "</strong>" +
        (v.tone ? "<em>" + escapeHtml(v.tone) + "</em>" : "") +
        (v.gen === "flagship" ? "<em>Grok Voice · flagship</em>" : "<em>Grok Voice · original</em>") +
        "</span>";

      wireSphere(btn, v);
      field.appendChild(btn);
    });

    if (head) {
      const cur = getVoice(state.selected);
      head.textContent = cur ? cur.name : state.selected;
    }
    if (liveEl) {
      liveEl.textContent = state.live ? "live catalog" : "static catalog";
      liveEl.classList.toggle("off", !state.live);
    }
  }

  function renderActive() {
    document.querySelectorAll(".voice-sphere").forEach((b) => {
      b.classList.toggle("vc-active", b.dataset.voiceId === state.selected);
    });
    const head = el("voice-constellation-active");
    if (head) {
      const cur = getVoice(state.selected);
      head.textContent = cur ? cur.name : state.selected;
    }
    const label = el("siri-orb-label");
    if (label && !document.body.classList.contains("voice-talking")) {
      // only override idle label
      if (label.textContent === "hey" || label.dataset.voiceLabel === "1") {
        label.textContent = (getVoice(state.selected) || {}).name || "hey";
        label.dataset.voiceLabel = "1";
      }
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function wireSphere(btn, voice) {
    btn.addEventListener("pointerenter", () => btn.classList.add("vc-hover"));
    btn.addEventListener("pointerleave", () => {
      if (!state.dragging) btn.classList.remove("vc-hover");
    });

    btn.addEventListener("click", (e) => {
      if (btn._moved) {
        btn._moved = false;
        return;
      }
      e.stopPropagation();
      saveSelected(voice.id);
      previewVoice(voice.id);
    });

    btn.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      state.dragging = {
        id: voice.id,
        el: btn,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
      btn._moved = false;
      btn.classList.add("vc-dragging");
      btn.classList.add("vc-hover");
    });

    btn.addEventListener("pointermove", (e) => {
      if (!state.dragging || state.dragging.el !== btn) return;
      const field = el("voice-sphere-field");
      if (!field) return;
      const dx = e.clientX - state.dragging.startX;
      const dy = e.clientY - state.dragging.startY;
      if (!state.dragging.moved && dx * dx + dy * dy > 16) {
        state.dragging.moved = true;
        btn._moved = true;
      }
      if (!state.dragging.moved) return;
      const rect = field.getBoundingClientRect();
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;
      x = Math.max(6, Math.min(94, x));
      y = Math.max(10, Math.min(90, y));
      btn.style.left = x + "%";
      btn.style.top = y + "%";
      state.dragging.x = x;
      state.dragging.y = y;
    });

    const endDrag = (e) => {
      if (!state.dragging || state.dragging.el !== btn) return;
      btn.classList.remove("vc-dragging");
      if (state.dragging.moved && state.dragging.x != null) {
        const map = loadPosMap();
        map[voice.id] = { x: state.dragging.x, y: state.dragging.y };
        savePosMap(map);
      }
      state.dragging = null;
      try {
        btn.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };
    btn.addEventListener("pointerup", endDrag);
    btn.addEventListener("pointercancel", endDrag);
  }

  async function previewVoice(voiceId) {
    const btn = document.querySelector('.voice-sphere[data-voice-id="' + voiceId + '"]');
    if (btn) btn.classList.add("vc-speaking");
    const name = (getVoice(voiceId) || {}).name || voiceId;
    const text =
      "Hi, I'm " + name + " — a SpaceXAI Grok Voice. Ready when you are.";
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice_id: voiceId,
          language: "en",
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        showPreviewStatus(j.error || j.message || "TTS unavailable (set XAI_API_KEY)");
        return;
      }
      const ct = r.headers.get("content-type") || "";
      let blob;
      if (ct.includes("application/json")) {
        const j = await r.json();
        if (j.audio_base64) {
          const bin = atob(j.audio_base64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          blob = new Blob([arr], { type: j.content_type || "audio/mpeg" });
        } else {
          showPreviewStatus(j.error || "no audio");
          return;
        }
      } else {
        blob = await r.blob();
      }
      if (state.audio) {
        try {
          state.audio.pause();
        } catch (_) {}
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      state.audio = audio;
      audio.addEventListener("ended", () => {
        URL.revokeObjectURL(url);
        if (btn) btn.classList.remove("vc-speaking");
      });
      await audio.play();
      showPreviewStatus("playing " + name);
    } catch (e) {
      showPreviewStatus(String(e.message || e));
    } finally {
      setTimeout(() => {
        if (btn) btn.classList.remove("vc-speaking");
      }, 8000);
    }
  }

  function showPreviewStatus(msg) {
    const s = el("siri-burst-status") || el("voice-constellation-status");
    if (s) {
      s.innerHTML = "<em>voice</em> · " + escapeHtml(msg);
    }
    if (window.LabChat && LabChat.showError && /unavailable|error|fail/i.test(msg)) {
      // soft — don't spam errors for missing key
    }
  }

  function setFilter(f) {
    state.filter = f || "all";
    try {
      localStorage.setItem(FILTER_KEY, state.filter);
    } catch (_) {}
    document.querySelectorAll("[data-voice-filter]").forEach((b) => {
      b.classList.toggle("on", b.getAttribute("data-voice-filter") === state.filter);
    });
    render();
  }

  function ensureMount() {
    if (el("voice-constellation")) return true;
    // Prefer chat body after stage; else skip (lab uses chat window for voices)
    const host =
      document.querySelector(".chat-body") ||
      document.getElementById("chat-stage")?.parentElement;
    if (!host) return false;

    const wrap = document.createElement("div");
    wrap.className = "voice-constellation";
    wrap.id = "voice-constellation";
    wrap.innerHTML =
      '<div class="voice-constellation-head">' +
      '<img class="vc-mark" src="' +
      BRAND.grok +
      '" alt="Grok" width="12" height="12" draggable="false" />' +
      "<span>Grok Voice · <strong id=\"voice-constellation-active\">eve</strong></span>" +
      '<span class="vc-live off" id="voice-constellation-live">catalog</span>' +
      "</div>" +
      '<div class="voice-filter-row" id="voice-filter-row">' +
      '<button type="button" data-voice-filter="all" class="on">All</button>' +
      '<button type="button" data-voice-filter="original">Original</button>' +
      '<button type="button" data-voice-filter="flagship">Flagship</button>' +
      '<button type="button" data-voice-filter="support">Support</button>' +
      '<button type="button" data-voice-filter="wellness">Wellness</button>' +
      "</div>" +
      '<div class="voice-sphere-field" id="voice-sphere-field" aria-label="Grok Voice models"></div>' +
      '<div class="voice-constellation-actions">' +
      '<button type="button" class="btn-mini primary" id="btn-voice-preview">Preview</button>' +
      '<button type="button" class="btn-mini" id="btn-voice-scatter">Scatter</button>' +
      '<button type="button" class="btn-mini" id="btn-voice-refresh">Refresh</button>' +
      "</div>" +
      '<p class="chat-meta" id="voice-constellation-status" style="margin-top:0.35rem">Grok logomark · hue halo only · click to select</p>';

    const stage = document.getElementById("chat-stage");
    if (stage && stage.nextSibling) {
      host.insertBefore(wrap, stage.nextSibling);
    } else {
      host.appendChild(wrap);
    }
    return true;
  }

  function wireChrome() {
    document.querySelectorAll("[data-voice-filter]").forEach((b) => {
      b.addEventListener("click", () => setFilter(b.getAttribute("data-voice-filter")));
    });
    el("btn-voice-preview")?.addEventListener("click", () => previewVoice(state.selected));
    el("btn-voice-scatter")?.addEventListener("click", () => {
      try {
        localStorage.removeItem(POS_KEY);
      } catch (_) {}
      render();
    });
    el("btn-voice-refresh")?.addEventListener("click", async () => {
      await loadCatalog();
      render();
      showPreviewStatus(state.live ? "live catalog merged" : "static catalog");
    });
  }

  async function init() {
    if (!ensureMount()) return;
    try {
      state.filter = localStorage.getItem(FILTER_KEY) || "all";
    } catch (_) {}
    await loadCatalog();
    wireChrome();
    setFilter(state.filter);
    window.LabVoice = Object.assign(window.LabVoice || {}, {
      voiceId: state.selected,
      voice: getVoice(state.selected),
      models: state.models,
      select: saveSelected,
      preview: previewVoice,
      list: () => state.voices.slice(),
      refresh: async () => {
        await loadCatalog();
        render();
      },
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
