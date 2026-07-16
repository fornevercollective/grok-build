/* Grok Build Lab — static markdown SPA */

const state = {
  nav: null,
  pageId: null,
  cache: new Map(),
};

const $ = (sel) => document.querySelector(sel);

function pageFromHash() {
  const h = (location.hash || "").replace(/^#\/?/, "").trim();
  if (!h) return state.nav?.home || "00-overview";
  return h.split("?")[0].replace(/\.md$/, "");
}

async function loadNav() {
  const res = await fetch("nav.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`nav.json ${res.status}`);
  state.nav = await res.json();
  document.title = state.nav.title || "Grok Build Lab";
  // Keep burst-page ◈ GrokYtalkY brand in top-left; only refresh lab subtitle.
  const lab = $(".brand-lab");
  if (lab) {
    lab.innerHTML = `<h1>Grok Build Lab</h1>
      <p>${escapeHtml(state.nav.subtitle || "Grok Build · map · plugins · leverage")}</p>`;
  }
  renderNav();
}

function navGroupKey(title) {
  return "nav:" + String(title || "section")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

function loadNavGroupState() {
  try {
    return JSON.parse(localStorage.getItem("lab.nav.groups.v2") || "{}");
  } catch {
    return {};
  }
}

function saveNavGroupState(map) {
  try {
    localStorage.setItem("lab.nav.groups.v2", JSON.stringify(map));
  } catch (_) {}
}

function renderNav(filter = "") {
  const root = $("#nav");
  if (!root || !state.nav) return;
  const q = filter.trim().toLowerCase();
  root.innerHTML = "";
  const groupState = loadNavGroupState();
  let total = 0;

  for (const section of state.nav.sections || []) {
    const items = (section.items || []).filter((it) => {
      if (!q) return true;
      return (
        it.label.toLowerCase().includes(q) ||
        it.id.toLowerCase().includes(q)
      );
    });
    if (!items.length) continue;
    total += items.length;

    const key = navGroupKey(section.title);
    const details = document.createElement("details");
    details.className = "nav-group";
    details.dataset.navKey = key;
    // Expand when filtering; otherwise restore saved state (default collapsed)
    if (q) {
      details.open = true;
    } else if (Object.prototype.hasOwnProperty.call(groupState, key)) {
      details.open = !!groupState[key];
    } else {
      details.open = false;
    }

    const summary = document.createElement("summary");
    summary.className = "nav-group-summary";
    summary.innerHTML =
      '<span class="sb-chev" aria-hidden="true"></span><span>' +
      escapeHtml(section.title) +
      "</span>";
    details.appendChild(summary);

    const wrap = document.createElement("div");
    wrap.className = "nav-group-items";

    for (const it of items) {
      const a = document.createElement("a");
      a.className = "nav-item" + (it.id === state.pageId ? " active" : "");
      a.href = `#/${it.id}`;
      a.textContent = it.label;
      a.dataset.id = it.id;
      wrap.appendChild(a);
    }
    details.appendChild(wrap);

    details.addEventListener("toggle", () => {
      if (q) return; // don't persist filter-forced open
      const m = loadNavGroupState();
      m[key] = details.open;
      saveNavGroupState(m);
    });

    root.appendChild(details);
  }

  const meta = document.getElementById("sb-docs-meta");
  if (meta) {
    meta.textContent = total ? total + " pages" : "";
  }
}

async function loadPage(id) {
  state.pageId = id;
  renderNav($("#search")?.value || "");
  const article = $("#article");
  article.innerHTML = `<p class="status">Loading <code>${escapeHtml(id)}</code>…</p>`;

  try {
    let md = state.cache.get(id);
    if (!md) {
      // stale-while-revalidate: prefer network, fall back to cache for offline PWA
      try {
        const res = await fetch(`content/${id}.md`, { cache: "default" });
        if (!res.ok) throw new Error(`content/${id}.md → ${res.status}`);
        md = await res.text();
        state.cache.set(id, md);
      } catch (netErr) {
        const cached = state.cache.get(id);
        if (cached) md = cached;
        else throw netErr;
      }
    }
    // yield to main thread before heavy markdown parse (mobile)
    await new Promise((r) => requestAnimationFrame(r));
    article.innerHTML = renderMarkdown(md);
    // lazy-load any images in content
    article.querySelectorAll("img").forEach((img) => {
      if (!img.loading) img.loading = "lazy";
      img.decoding = "async";
    });
    article.querySelectorAll("a[href^='#/']").forEach((a) => {
      a.addEventListener("click", () => closeMobileNav());
    });
    // open external links in new tab
    article.querySelectorAll("a[href^='http']").forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });
    window.scrollTo(0, 0);
    $("#crumb").textContent = id;
    // Single walkthrough hook (avoid double annotate)
    window.dispatchEvent(
      new CustomEvent("lab:page-loaded", { detail: { id: id } })
    );
  } catch (err) {
    article.innerHTML = `<div class="error"><strong>Failed to load page</strong><br>${escapeHtml(
      String(err.message || err)
    )}<p>Create <code>content/${escapeHtml(id)}.md</code> and add it to <code>nav.json</code>.</p></div>`;
  }
}

function renderMarkdown(md) {
  // lightweight markdown → HTML (enough for our lab docs)
  // Prefer marked if present
  if (window.marked) {
    window.marked.setOptions({
      gfm: true,
      breaks: false,
      headerIds: true,
      mangle: false,
    });
    return window.marked.parse(md);
  }
  return fallbackMarkdown(md);
}

function fallbackMarkdown(md) {
  // minimal fallback if CDN blocked
  let html = escapeHtml(md);
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/^\|(.+)\|$/gm, (row) => {
    const cells = row
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
    if (cells.every((c) => /^[-:]+$/.test(c))) return "";
    return "<tr>" + cells.map((c) => `<td>${c}</td>`).join("") + "</tr>";
  });
  html = html.replace(/(<tr>[\s\S]*?<\/tr>\n?)+/g, (t) => `<table>${t}</table>`);
  html = html.replace(/^(?!<[hptuo]|<tr|<table)(.+)$/gm, "<p>$1</p>");
  return html;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function closeMobileNav() {
  $("#sidebar")?.classList.remove("open");
  $("#backdrop")?.classList.remove("show");
  // keep collapsed state in sync for mobile drawer
  if (window.matchMedia("(max-width: 860px)").matches) {
    document.body.classList.add("sidebar-collapsed");
    const btn = $("#menu-btn");
    if (btn) {
      btn.textContent = "Menu";
      btn.setAttribute("aria-expanded", "false");
    }
  }
}

function openMobileNav() {
  $("#sidebar")?.classList.add("open");
  $("#backdrop")?.classList.add("show");
  document.body.classList.remove("sidebar-collapsed");
  const btn = $("#menu-btn");
  if (btn) {
    btn.textContent = "Hide";
    btn.setAttribute("aria-expanded", "true");
  }
}

/** Prefer local GY burst (:8766); fall back to published GitHub pages. */
async function wireGyBrandLinks() {
  const links = document.querySelectorAll("a.gy-brand[data-fallback]");
  if (!links.length) return;
  const local = "http://127.0.0.1:8766/burst.html";
  const ok = await fetch(local, { method: "HEAD", mode: "no-cors" })
    .then(() => true)
    .catch(() => false);
  // no-cors HEAD can't distinguish 404; try GET via image/beacon alternative:
  // use a quick fetch with timeout against the local origin root.
  let localUp = false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 250);
    const r = await fetch("http://127.0.0.1:8766/burst.html", {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    localUp = r.ok;
  } catch {
    localUp = false;
  }
  links.forEach((a) => {
    if (localUp) {
      a.href = local;
      a.title = "GrokYtalkY · Burst (local :8766)";
    } else {
      a.href = a.dataset.fallback || a.href;
      a.title = "GrokYtalkY · Burst";
    }
  });
  void ok;
}

async function boot() {
  // Menu toggle is owned by tools.js (LabNav) when present; fallback for docs-only
  $("#menu-btn")?.addEventListener("click", () => {
    if (window.LabNav?.toggleSidebar) return; // tools.js already bound
    const open = $("#sidebar")?.classList.contains("open");
    if (open) closeMobileNav();
    else openMobileNav();
  });
  $("#backdrop")?.addEventListener("click", () => {
    if (window.LabNav?.toggleSidebar) {
      // close drawer
      $("#sidebar")?.classList.remove("open");
      $("#backdrop")?.classList.remove("show");
      document.body.classList.add("sidebar-collapsed");
      const btn = $("#menu-btn");
      if (btn) {
        btn.setAttribute("aria-expanded", "false");
        btn.title = "Show left menu";
        btn.classList.add("menu-collapsed");
        // Keep SpaceXAI logo mark
        if (!btn.querySelector(".menu-btn-mark")) {
          btn.innerHTML =
            '<img class="menu-btn-mark" src="assets/brand/spacexai-symbol-white-transparent.svg" width="22" height="22" alt="SpaceXAI" draggable="false" />';
        }
      }
      return;
    }
    closeMobileNav();
  });
  $("#search")?.addEventListener("input", (e) => {
    renderNav(e.target.value);
  });

  window.addEventListener("hashchange", () => {
    loadPage(pageFromHash());
    // Don't force-close desktop sidebar on doc nav; only mobile drawer
    if (window.matchMedia("(max-width: 860px)").matches) closeMobileNav();
  });

  try {
    await loadNav();
    await loadPage(pageFromHash());
    await wireGyBrandLinks();
  } catch (err) {
    $("#article").innerHTML = `<div class="error">${escapeHtml(
      String(err.message || err)
    )}</div>`;
  }
}

boot();
