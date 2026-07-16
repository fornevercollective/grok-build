/**
 * Page highlighting + walkthrough.
 * Soft hover is CSS-cheap (class toggle only). Tips only for tour/pin.
 */
(function () {
  "use strict";

  const state = {
    sections: [],
    index: -1,
    tour: false,
    hoverOn: true,
    tipEl: null,
    dimEl: null,
    /** last soft-hover el for O(1) class clear */
    softEl: null,
    softI: -1,
    /** rAF throttle for tip reanchor */
    reanchorRaf: 0,
  };

  function article() {
    return document.getElementById("article");
  }

  function ensureChrome() {
    if (!state.tipEl) {
      const tip = document.createElement("div");
      tip.id = "walk-tip";
      tip.className = "walk-tip";
      tip.hidden = true;
      tip.innerHTML =
        '<div class="walk-tip-head"><span class="walk-tip-kicker">tour</span>' +
        '<span class="walk-tip-count" id="walk-tip-count"></span></div>' +
        '<p class="walk-tip-title" id="walk-tip-title"></p>' +
        '<p class="walk-tip-body" id="walk-tip-body"></p>' +
        '<div class="walk-tip-actions">' +
        '<button type="button" class="btn-mini" id="walk-tip-prev">Prev</button>' +
        '<button type="button" class="btn-mini primary" id="walk-tip-next">Next</button>' +
        '<button type="button" class="btn-mini" id="walk-tip-close">Done</button>' +
        "</div>";
      document.body.appendChild(tip);
      state.tipEl = tip;
      tip.querySelector("#walk-tip-prev")?.addEventListener("click", () => prev());
      tip.querySelector("#walk-tip-next")?.addEventListener("click", () => next());
      tip.querySelector("#walk-tip-close")?.addEventListener("click", () => stop());
    }
    if (!state.dimEl) {
      const dim = document.createElement("div");
      dim.id = "walk-dim";
      dim.className = "walk-dim";
      dim.hidden = true;
      dim.addEventListener("click", () => {
        if (state.tour) stop();
        else clearHighlight();
      });
      document.body.appendChild(dim);
      state.dimEl = dim;
    }
  }

  function titleFor(node, i) {
    if (!node) return "Section " + (i + 1);
    if (/^H[1-6]$/.test(node.tagName)) return node.textContent.trim();
    const h = node.querySelector?.("h1,h2,h3,h4");
    if (h) return h.textContent.trim();
    const t = (node.textContent || "").trim().replace(/\s+/g, " ");
    return t.slice(0, 64) || "Section " + (i + 1);
  }

  function blurbFor(node) {
    // Prefer cached dataset to avoid re-walking large textContent on every tip
    if (node.dataset && node.dataset.walkBlurb) return node.dataset.walkBlurb;
    const t = (node.textContent || "").trim().replace(/\s+/g, " ");
    const b = t.length <= 140 ? t : t.slice(0, 137) + "…";
    if (node.dataset) node.dataset.walkBlurb = b;
    return b;
  }

  function sectionKind(node) {
    const tag = node.tagName.toLowerCase();
    if (tag === "table") return "table";
    if (tag === "pre") return "code";
    if (tag === "blockquote") return "note";
    if (/^h[1-6]$/.test(tag)) return "heading";
    return "section";
  }

  function annotate(root) {
    const art = root || article();
    if (!art) return [];
    clearHighlight();
    state.softEl = null;
    state.softI = -1;

    art.querySelectorAll("[data-walk]").forEach((n) => {
      n.removeAttribute("data-walk");
      n.removeAttribute("data-walk-i");
      n.removeAttribute("data-walk-title");
      n.removeAttribute("data-walk-blurb");
      n.classList.remove("walk-section", "walk-hot", "walk-tour-current", "walk-soft");
    });

    const list = Array.from(
      art.querySelectorAll("h1, h2, h3, h4, table, pre, blockquote")
    );
    art.querySelectorAll(":scope > p").forEach((p) => {
      if ((p.textContent || "").trim().length > 80) list.push(p);
    });

    const seen = new Set();
    const nodes = [];
    list.forEach((node) => {
      if (seen.has(node)) return;
      seen.add(node);
      nodes.push(node);
    });

    state.sections = nodes.map((node, i) => {
      const title = titleFor(node, i);
      const kind = sectionKind(node);
      node.classList.add("walk-section");
      node.dataset.walk = "1";
      node.dataset.walkI = String(i);
      node.dataset.walkTitle = title;
      node.dataset.walkKind = kind;
      return { el: node, title, kind, i };
    });

    wireHover(art);
    updateToolbar();
    return state.sections;
  }

  /** Fast soft highlight — class only, no tip / no full DOM scan. */
  function softHover(el, i) {
    if (state.softI === i && state.softEl === el) return;
    if (state.softEl && state.softEl !== el) {
      state.softEl.classList.remove("walk-soft", "walk-hot");
    }
    state.softEl = el;
    state.softI = i;
    el.classList.add("walk-soft");
  }

  function clearSoft() {
    if (state.softEl) {
      state.softEl.classList.remove("walk-soft", "walk-hot");
      state.softEl = null;
      state.softI = -1;
    }
  }

  function wireHover(art) {
    if (art._walkBound) return;
    art._walkBound = true;

    // pointermove is noisier; stick to over/out with early exits
    art.addEventListener(
      "pointerover",
      (e) => {
        if (!state.hoverOn || state.tour) return;
        // relatedTarget still inside same section → ignore
        const t = e.target.closest?.("[data-walk]");
        if (!t || !art.contains(t)) return;
        if (state.softEl === t) return;
        const from = e.relatedTarget && e.relatedTarget.closest?.("[data-walk]");
        if (from === t) return;
        const i = +t.dataset.walkI;
        if (Number.isNaN(i)) return;
        clearTimeout(wireHover._clearT);
        softHover(t, i);
      },
      { capture: true, passive: true }
    );

    art.addEventListener(
      "pointerout",
      (e) => {
        if (!state.hoverOn || state.tour) return;
        const t = e.target.closest?.("[data-walk]");
        if (!t || t !== state.softEl) return;
        const rel = e.relatedTarget;
        if (rel && (t === rel || t.contains(rel))) return;
        clearTimeout(wireHover._clearT);
        wireHover._clearT = setTimeout(() => {
          if (!state.tour) clearSoft();
        }, 120);
      },
      { capture: true, passive: true }
    );

    art.addEventListener("click", (e) => {
      const t = e.target.closest?.("[data-walk]");
      if (!t || !art.contains(t)) return;
      const i = +t.dataset.walkI;
      if (Number.isNaN(i)) return;
      clearSoft();
      highlightIndex(i, { soft: false, scroll: true, pin: true });
    });
  }

  function clearHighlight(opts) {
    opts = opts || {};
    clearSoft();
    // Only clear known hot nodes, not whole document if we track them
    if (state._hotEl) {
      state._hotEl.classList.remove("walk-hot", "walk-tour-current");
      state._hotEl = null;
    } else {
      document.querySelectorAll(".walk-hot, .walk-tour-current").forEach((n) => {
        n.classList.remove("walk-hot", "walk-tour-current");
      });
    }
    document.body.classList.remove("walk-active");
    if (!state.tour) document.body.classList.remove("walk-touring");
    if (state.tipEl && !state.tour) {
      state.tipEl.hidden = true;
      state._tipNode = null;
    }
    if (state.dimEl && !opts.keepDim && !state.tour) {
      state.dimEl.hidden = true;
    }
  }

  function chromeTopInset() {
    let top = 8;
    if (
      document.body.classList.contains("lab-native") ||
      document.body.classList.contains("lab-float")
    ) {
      top = 48;
    }
    // Cache for a frame — avoid double getBoundingClientRect storms
    if (chromeTopInset._t === performance.now()) return chromeTopInset._v;
    const tabs = document.querySelector(".app-tabs");
    const bar = document.querySelector(".topbar");
    if (tabs) top = Math.max(top, tabs.getBoundingClientRect().bottom + 6);
    else if (bar) top = Math.max(top, bar.getBoundingClientRect().bottom + 6);
    chromeTopInset._t = performance.now();
    chromeTopInset._v = top;
    return top;
  }

  function placeTip(node, sec, opts) {
    opts = opts || {};
    // Soft hover never opens a tip (perf + less visual noise)
    if (opts.soft && !state.tour && !opts.pin) return;

    ensureChrome();
    const tip = state.tipEl;
    if (!tip || !node) return;

    const title = document.getElementById("walk-tip-title");
    const body = document.getElementById("walk-tip-body");
    const count = document.getElementById("walk-tip-count");
    const actions = tip.querySelector(".walk-tip-actions");
    if (title) title.textContent = sec.title || node.dataset.walkTitle || "";
    if (body) body.textContent = blurbFor(node);
    if (count) {
      count.textContent =
        state.sections.length > 0 ? sec.i + 1 + " / " + state.sections.length : "";
    }
    tip.classList.remove("soft");
    if (actions) actions.hidden = false;
    const kicker = tip.querySelector(".walk-tip-kicker");
    if (kicker) kicker.textContent = state.tour ? "tour" : "pin";

    tip.hidden = false;
    const tipW = Math.min(300, window.innerWidth - 24);
    tip.style.width = tipW + "px";
    // Use fixed estimate first; one layout read only
    const tipH = tip.offsetHeight || 120;

    const rect = node.getBoundingClientRect();
    const main = document.querySelector(".main");
    const mainRect = main ? main.getBoundingClientRect() : null;
    const pad = 10;
    const minTop = chromeTopInset();
    const maxLeft = window.innerWidth - tipW - pad;
    const maxTop = window.innerHeight - tipH - pad;

    const invalid =
      !rect ||
      rect.width < 2 ||
      rect.height < 2 ||
      rect.bottom < minTop - 40 ||
      rect.top > window.innerHeight + 40;

    let left;
    let top;

    if (invalid) {
      left = mainRect ? mainRect.left + 12 : pad;
      top = minTop + 8;
    } else if (rect.height > window.innerHeight * 0.45) {
      left = Math.min(maxLeft, Math.max(pad, rect.left));
      top = Math.min(maxTop, Math.max(minTop, rect.top + 8));
      if (mainRect && mainRect.right - tipW - 12 > rect.left + 40) {
        left = Math.min(maxLeft, mainRect.right - tipW - 12);
      }
    } else if (rect.right + tipW + 16 < window.innerWidth) {
      left = rect.right + 12;
      top = Math.min(maxTop, Math.max(minTop, rect.top));
    } else {
      left = Math.min(
        maxLeft,
        Math.max(pad, rect.left + rect.width / 2 - tipW / 2)
      );
      top = rect.bottom + 10;
      if (top + tipH > window.innerHeight - pad) {
        top = Math.max(minTop, rect.top - tipH - 10);
      }
    }

    tip.style.left = Math.round(Math.min(maxLeft, Math.max(pad, left))) + "px";
    tip.style.top = Math.round(Math.min(maxTop, Math.max(minTop, top))) + "px";

    state._tipNode = node;
    state._tipSec = sec;
    state._tipOpts = opts;
  }

  function reanchorTip() {
    if (!state.tipEl || state.tipEl.hidden || !state._tipNode) return;
    if (!state.tour && !state._tipOpts?.pin) return;
    if (state.reanchorRaf) return;
    state.reanchorRaf = requestAnimationFrame(() => {
      state.reanchorRaf = 0;
      if (!state.tipEl || state.tipEl.hidden || !state._tipNode) return;
      placeTip(
        state._tipNode,
        state._tipSec || { title: "", i: state.index },
        state._tipOpts || { pin: true }
      );
    });
  }

  function highlightIndex(i, opts) {
    opts = opts || {};
    // Soft path never goes through here anymore
    if (opts.soft && !state.tour && !opts.pin) return false;

    ensureChrome();
    if (!state.sections.length) annotate();
    if (!state.sections.length) return false;
    i = ((i % state.sections.length) + state.sections.length) % state.sections.length;
    const sec = state.sections[i];
    if (!sec || !sec.el) return false;

    // Skip redundant full work if same pin/tour index
    if (
      state.index === i &&
      state._hotEl === sec.el &&
      (state.tour || opts.pin) &&
      opts.scroll === false
    ) {
      placeTip(sec.el, sec, opts);
      return true;
    }

    if (state._hotEl && state._hotEl !== sec.el) {
      state._hotEl.classList.remove("walk-hot", "walk-tour-current");
    } else if (!state._hotEl) {
      document.querySelectorAll(".walk-hot, .walk-tour-current").forEach((n) => {
        if (n !== sec.el) n.classList.remove("walk-hot", "walk-tour-current");
      });
    }

    clearSoft();
    state.index = i;
    state._hotEl = sec.el;
    sec.el.classList.add("walk-hot");
    if (state.tour || opts.pin) sec.el.classList.add("walk-tour-current");

    document.body.classList.add("walk-active");
    if (state.tour) {
      document.body.classList.add("walk-touring");
      if (state.dimEl) state.dimEl.hidden = false;
    } else if (state.dimEl) {
      state.dimEl.hidden = true;
    }

    if (opts.scroll !== false) {
      sec.el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      clearTimeout(highlightIndex._scrollT);
      highlightIndex._scrollT = setTimeout(() => placeTip(sec.el, sec, opts), 200);
    }

    placeTip(sec.el, sec, opts);

    // Defer event so UI paints first
    queueMicrotask(() => {
      window.dispatchEvent(
        new CustomEvent("lab:walk-highlight", {
          detail: { index: i, title: sec.title, kind: sec.kind },
        })
      );
    });
    return true;
  }

  function highlightQuery(q) {
    if (!state.sections.length) annotate();
    const needle = String(q || "")
      .toLowerCase()
      .trim();
    if (!needle) return start();
    let best = -1;
    let score = 0;
    state.sections.forEach((s, i) => {
      const hay = (s.title + " " + (s.el.textContent || "")).toLowerCase();
      if (hay.includes(needle)) {
        const sc = hay.indexOf(needle) === 0 ? 2 : 1;
        if (sc > score) {
          score = sc;
          best = i;
        }
      }
    });
    if (best < 0) {
      best = state.sections.findIndex((s) =>
        s.title
          .toLowerCase()
          .split(/\s+/)
          .some((w) => needle.includes(w) && w.length > 3)
      );
    }
    if (best < 0) return false;
    state.tour = true;
    return highlightIndex(best, { scroll: true, pin: true });
  }

  function start() {
    ensureChrome();
    if (document.body.classList.contains("mode-tools")) {
      location.hash =
        location.hash.replace(/^#\/tool\/.*/, "") || "#/00-overview";
    }
    annotate();
    if (!state.sections.length) return false;
    state.tour = true;
    state.index = -1;
    document.body.classList.add("walk-touring");
    return next();
  }

  function stop() {
    state.tour = false;
    state.index = -1;
    clearHighlight();
    if (state.tipEl) {
      state.tipEl.hidden = true;
      state._tipNode = null;
    }
    if (state.dimEl) state.dimEl.hidden = true;
    document.body.classList.remove("walk-touring", "walk-active");
    updateToolbar();
  }

  function next() {
    if (!state.sections.length) annotate();
    if (!state.sections.length) return false;
    state.tour = true;
    const i = state.index < 0 ? 0 : state.index + 1;
    if (i >= state.sections.length) {
      stop();
      return false;
    }
    return highlightIndex(i, { scroll: true, pin: true });
  }

  function prev() {
    if (!state.sections.length) annotate();
    if (!state.sections.length) return false;
    state.tour = true;
    const i = state.index <= 0 ? 0 : state.index - 1;
    return highlightIndex(i, { scroll: true, pin: true });
  }

  function setHover(on) {
    state.hoverOn = !!on;
    document.body.classList.toggle("walk-hover-off", !state.hoverOn);
    if (!state.hoverOn) clearSoft();
    updateToolbar();
  }

  function updateToolbar() {
    const btn = document.getElementById("btn-walkthrough");
    if (btn) {
      btn.classList.toggle("active", state.tour);
      btn.setAttribute("aria-pressed", state.tour ? "true" : "false");
      btn.textContent = state.tour ? "Tour…" : "Tour";
    }
    const hov = document.getElementById("btn-walk-hover");
    if (hov) {
      hov.classList.toggle("active", state.hoverOn);
      hov.setAttribute("aria-pressed", state.hoverOn ? "true" : "false");
    }
  }

  function setChromeHidden(on) {
    document.body.classList.toggle("walk-chrome-hidden", !!on);
    const hide = document.getElementById("btn-walk-hide");
    if (hide) {
      hide.setAttribute("aria-pressed", on ? "true" : "false");
      hide.classList.toggle("active", !!on);
      hide.textContent = on ? "Show" : "Hide";
    }
    if (on) {
      stop();
      setHover(false);
      const tip = document.getElementById("walk-tip");
      if (tip) tip.hidden = true;
    }
  }

  function bindToolbar() {
    document.getElementById("btn-walkthrough")?.addEventListener("click", () => {
      if (state.tour) stop();
      else start();
    });
    document.getElementById("btn-walk-hover")?.addEventListener("click", () => {
      setHover(!state.hoverOn);
    });
    document.getElementById("btn-walk-next")?.addEventListener("click", () => next());
    document.getElementById("btn-walk-hide")?.addEventListener("click", () => {
      const on = !document.body.classList.contains("walk-chrome-hidden");
      setChromeHidden(on);
    });
  }

  function onPageReady() {
    requestAnimationFrame(() => {
      annotate();
      if (state.tour && state.sections.length) {
        highlightIndex(Math.min(state.index, state.sections.length - 1), {
          scroll: true,
          pin: true,
        });
      }
    });
  }

  window.LabWalkthrough = {
    annotate,
    start,
    stop,
    next,
    setChromeHidden,
    prev,
    highlightIndex,
    highlightQuery,
    setHover,
    onPageReady,
    sections: () => state.sections.slice(),
    isTouring: () => state.tour,
  };

  window.addEventListener("lab:page-loaded", onPageReady);
  // Only reanchor during tour/pin — throttled via rAF
  window.addEventListener("scroll", reanchorTip, { passive: true, capture: true });
  window.addEventListener("resize", reanchorTip, { passive: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ensureChrome();
      bindToolbar();
      annotate();
    });
  } else {
    ensureChrome();
    bindToolbar();
    annotate();
  }
})();
