/**
 * Page highlighting + walkthrough — hover/mouseover sections so Grok can show the work.
 * Tags article blocks after markdown render; supports tour next/prev and voice queries.
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
  };

  function $(sel) {
    return document.querySelector(sel);
  }

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
        '<div class="walk-tip-head"><span class="walk-tip-kicker">Grok</span>' +
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
    const t = (node.textContent || "").trim().replace(/\s+/g, " ");
    if (t.length <= 140) return t;
    return t.slice(0, 137) + "…";
  }

  function sectionKind(node) {
    const tag = node.tagName.toLowerCase();
    if (tag === "table") return "table";
    if (tag === "pre") return "code";
    if (tag === "blockquote") return "note";
    if (/^h[1-6]$/.test(tag)) return "heading";
    return "section";
  }

  /**
   * Tag highlightable blocks in the article (call after each page load).
   */
  function annotate(root) {
    const art = root || article();
    if (!art) return [];
    clearHighlight();
    // remove prior tags
    art.querySelectorAll("[data-walk]").forEach((n) => {
      n.removeAttribute("data-walk");
      n.removeAttribute("data-walk-i");
      n.removeAttribute("data-walk-title");
      n.classList.remove("walk-section", "walk-hot", "walk-tour-current");
    });

    const nodes = [];
    // Headings + following content group: mark each h2/h3 and major blocks
    const candidates = art.querySelectorAll(
      "h1, h2, h3, h4, table, pre, blockquote, .article > p, .article > ul, .article > ol"
    );
    // Also direct children that are sections
    art.querySelectorAll(":scope > *").forEach((n) => {
      if (!candidates.length || true) {
        /* use query list */
      }
    });

    const list = Array.from(
      art.querySelectorAll("h1, h2, h3, h4, table, pre, blockquote")
    );
    // Include standalone paragraphs that are long enough (leverage / decision blocks)
    art.querySelectorAll(":scope > p").forEach((p) => {
      if ((p.textContent || "").trim().length > 80) list.push(p);
    });

    const seen = new Set();
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

  function wireHover(art) {
    if (art._walkBound) return;
    art._walkBound = true;

    art.addEventListener(
      "pointerover",
      (e) => {
        if (!state.hoverOn) return;
        if (state.tour) return; // tour owns highlight
        const t = e.target.closest("[data-walk]");
        if (!t || !art.contains(t)) return;
        const i = parseInt(t.dataset.walkI, 10);
        if (Number.isNaN(i)) return;
        highlightIndex(i, { soft: true, scroll: false });
      },
      true
    );

    art.addEventListener(
      "pointerout",
      (e) => {
        if (!state.hoverOn || state.tour) return;
        const t = e.target.closest("[data-walk]");
        if (!t) return;
        const rel = e.relatedTarget;
        if (rel && t.contains(rel)) return;
        // leave soft highlight after a beat unless another section entered
        clearTimeout(wireHover._t);
        wireHover._t = setTimeout(() => {
          if (!state.tour) clearHighlight({ keepDim: false });
        }, 180);
      },
      true
    );

    art.addEventListener("click", (e) => {
      const t = e.target.closest("[data-walk]");
      if (!t || !art.contains(t)) return;
      // pin highlight on click
      const i = parseInt(t.dataset.walkI, 10);
      if (Number.isNaN(i)) return;
      highlightIndex(i, { soft: false, scroll: true, pin: true });
    });
  }

  function clearHighlight(opts) {
    opts = opts || {};
    document.querySelectorAll(".walk-hot, .walk-tour-current").forEach((n) => {
      n.classList.remove("walk-hot", "walk-tour-current");
    });
    document.body.classList.remove("walk-active", "walk-touring");
    if (state.tipEl && !state.tour) {
      state.tipEl.hidden = true;
    }
    if (state.dimEl && !opts.keepDim && !state.tour) {
      state.dimEl.hidden = true;
    }
  }

  function placeTip(node, sec) {
    ensureChrome();
    const tip = state.tipEl;
    const title = $("#walk-tip-title");
    const body = $("#walk-tip-body");
    const count = $("#walk-tip-count");
    if (title) title.textContent = sec.title;
    if (body) body.textContent = blurbFor(node);
    if (count) {
      count.textContent =
        state.sections.length > 0
          ? sec.i + 1 + " / " + state.sections.length
          : "";
    }
    tip.hidden = false;

    const rect = node.getBoundingClientRect();
    const tipW = Math.min(320, window.innerWidth - 24);
    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - tipW - 12));
    let top = rect.bottom + 10;
    if (top + 160 > window.innerHeight) {
      top = Math.max(12, rect.top - 140);
    }
    tip.style.width = tipW + "px";
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }

  function highlightIndex(i, opts) {
    opts = opts || {};
    ensureChrome();
    if (!state.sections.length) annotate();
    if (!state.sections.length) return false;
    i = ((i % state.sections.length) + state.sections.length) % state.sections.length;
    const sec = state.sections[i];
    if (!sec || !sec.el) return false;

    document.querySelectorAll(".walk-hot, .walk-tour-current").forEach((n) => {
      n.classList.remove("walk-hot", "walk-tour-current");
    });

    state.index = i;
    sec.el.classList.add("walk-hot");
    if (state.tour || opts.pin) sec.el.classList.add("walk-tour-current");

    document.body.classList.add("walk-active");
    if (state.tour) {
      document.body.classList.add("walk-touring");
      if (state.dimEl) state.dimEl.hidden = false;
    } else {
      // hover / pin — no heavy scrim, outline only
      if (state.dimEl) state.dimEl.hidden = true;
    }

    if (opts.scroll !== false) {
      sec.el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (!opts.soft || state.tour || opts.pin) {
      placeTip(sec.el, sec);
    } else {
      // soft hover: mini tip
      placeTip(sec.el, sec);
      if (state.tipEl) state.tipEl.classList.add("soft");
    }
    if (!opts.soft) state.tipEl?.classList.remove("soft");

    // broadcast for voice / multi-term
    window.dispatchEvent(
      new CustomEvent("lab:walk-highlight", {
        detail: { index: i, title: sec.title, kind: sec.kind },
      })
    );
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
      // try nav-ish words
      best = state.sections.findIndex((s) =>
        s.title.toLowerCase().split(/\s+/).some((w) => needle.includes(w) && w.length > 3)
      );
    }
    if (best < 0) return false;
    state.tour = true;
    return highlightIndex(best, { scroll: true, pin: true });
  }

  function start() {
    ensureChrome();
    // docs mode
    if (document.body.classList.contains("mode-tools")) {
      location.hash = location.hash.replace(/^#\/tool\/.*/, "") || "#/00-overview";
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
    if (state.tipEl) state.tipEl.hidden = true;
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

  function bindToolbar() {
    document.getElementById("btn-walkthrough")?.addEventListener("click", () => {
      if (state.tour) stop();
      else start();
    });
    document.getElementById("btn-walk-hover")?.addEventListener("click", () => {
      setHover(!state.hoverOn);
    });
    document.getElementById("btn-walk-next")?.addEventListener("click", () => next());
  }

  function onPageReady() {
    // re-annotate after docs page loads
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
    prev,
    highlightIndex,
    highlightQuery,
    setHover,
    onPageReady,
    sections: () => state.sections.slice(),
    isTouring: () => state.tour,
  };

  // Hook page loads from app.js
  window.addEventListener("lab:page-loaded", onPageReady);

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
