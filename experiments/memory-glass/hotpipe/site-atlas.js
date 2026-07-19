/* Memory Glass · Site Atlas
 * Figma-files-panel energy for the open page (not Wayback full rebuild).
 * Inventory → score/rank → project-usefulness → "Grok could build better" → path.
 * VER: site-atlas-v1
 */
(function () {
  "use strict";
  var VER = "site-atlas-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._siteAtlasVer === VER) return;
  HP._siteAtlasVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return; /* inspect: no atlas chrome */
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "site-atlas");
    } catch (e) {}
  }

  var lastAtlas = null;
  var panel = null;
  var open = false;

  /* ── inventory (read-only DOM; no navigation thrash) ── */
  function absUrl(u) {
    try {
      return new URL(u, location.href).href;
    } catch (e) {
      return String(u || "");
    }
  }

  function hostOf(u) {
    try {
      return new URL(u).hostname;
    } catch (e) {
      return "";
    }
  }

  function sameOrigin(u) {
    try {
      return new URL(u, location.href).origin === location.origin;
    } catch (e) {
      return false;
    }
  }

  function scanPage() {
    var parts = [];
    var id = 0;
    function add(p) {
      p.id = "p" + ++id;
      parts.push(p);
    }

    add({
      kind: "document",
      name: document.title || "document",
      path: location.pathname || "/",
      url: location.href,
      meta: {
        ready: document.readyState,
        lang: document.documentElement.lang || "",
      },
    });

    Array.prototype.forEach.call(document.querySelectorAll("script[src]"), function (el, i) {
      var src = absUrl(el.getAttribute("src"));
      add({
        kind: "script",
        name: src.split("/").pop() || "script-" + i,
        path: src,
        url: src,
        meta: {
          async: !!el.async,
          defer: !!el.defer,
          type: el.type || "text/javascript",
          module: (el.type || "").indexOf("module") >= 0,
          sameOrigin: sameOrigin(src),
        },
      });
    });

    Array.prototype.forEach.call(
      document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"][as="style"]'),
      function (el, i) {
        var href = absUrl(el.getAttribute("href"));
        add({
          kind: "style",
          name: href.split("/").pop() || "style-" + i,
          path: href,
          url: href,
          meta: { sameOrigin: sameOrigin(href) },
        });
      }
    );

    Array.prototype.forEach.call(document.querySelectorAll("img[src]"), function (el, i) {
      if (i > 40) return;
      var src = absUrl(el.getAttribute("src"));
      add({
        kind: "image",
        name: (el.alt || src.split("/").pop() || "img").slice(0, 48),
        path: src,
        url: src,
        meta: {
          w: el.naturalWidth || 0,
          h: el.naturalHeight || 0,
          sameOrigin: sameOrigin(src),
        },
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("a[href]"), function (el, i) {
      if (i > 80) return;
      var href = absUrl(el.getAttribute("href"));
      if (!href || href.indexOf("javascript:") === 0) return;
      add({
        kind: "link",
        name: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60) || href,
        path: href,
        url: href,
        meta: {
          sameOrigin: sameOrigin(href),
          external: !sameOrigin(href),
        },
      });
    });

    ["main", "nav", "header", "footer", "aside", "form", "canvas", "video", "iframe"].forEach(
      function (tag) {
        var n = document.getElementsByTagName(tag).length;
        if (n)
          add({
            kind: "structure",
            name: tag + " ×" + n,
            path: tag,
            url: location.href + "#" + tag,
            meta: { count: n },
          });
      }
    );

    Array.prototype.forEach.call(document.querySelectorAll("h1,h2,h3"), function (el, i) {
      if (i > 24) return;
      add({
        kind: "heading",
        name: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
        path: el.tagName.toLowerCase(),
        url: location.href,
        meta: { level: el.tagName },
      });
    });

    /* framework hints */
    var hints = [];
    if (window.React || document.querySelector("[data-reactroot],#root,#__next"))
      hints.push("react");
    if (window.Vue || document.querySelector("[data-v-]")) hints.push("vue");
    if (window.angular || document.querySelector("[ng-version]")) hints.push("angular");
    if (document.querySelector('script[src*="wp-"], link[href*="wp-content"]'))
      hints.push("wordpress");
    if (document.getElementById("__NEXT_DATA__")) hints.push("nextjs");
    if (hints.length)
      add({
        kind: "stack",
        name: "stack · " + hints.join(" · "),
        path: "framework",
        url: location.href,
        meta: { frameworks: hints },
      });

    return parts;
  }

  /* ── score / rank (project usefulness · not vanity SEO) ── */
  function scorePart(p, ctx) {
    var s = 40;
    var why = [];
    var kind = p.kind;
    if (kind === "script") {
      s += p.meta && p.meta.module ? 18 : 10;
      s += p.meta && p.meta.sameOrigin ? 12 : -5;
      if (/bundle|chunk|app\.|main\.|index\./i.test(p.name)) {
        s += 15;
        why.push("app entry-ish");
      }
      if (/analytics|gtag|hotjar|pixel|ads/i.test(p.path)) {
        s -= 25;
        why.push("tracking noise");
      }
      if (/react|vue|angular|webpack|vite/i.test(p.path)) {
        s += 8;
        why.push("framework");
      }
    } else if (kind === "style") {
      s += 8;
      if (p.meta && p.meta.sameOrigin) s += 6;
    } else if (kind === "link") {
      s += p.meta && p.meta.sameOrigin ? 10 : 2;
      if (/docs|api|github|readme|guide|blog/i.test(p.path + p.name)) {
        s += 14;
        why.push("docs/api path");
      }
      if (/login|cart|cookie|privacy/i.test(p.name + p.path)) s -= 4;
    } else if (kind === "structure") {
      s += 12;
      if (p.name.indexOf("main") === 0 || p.name.indexOf("nav") === 0) {
        s += 10;
        why.push("IA landmark");
      }
      if (p.name.indexOf("canvas") === 0 || p.name.indexOf("video") === 0) {
        s += 8;
        why.push("rich media");
      }
    } else if (kind === "heading") {
      s += 6;
    } else if (kind === "stack") {
      s += 20;
      why.push("build surface");
    } else if (kind === "document") {
      s += 5;
    } else if (kind === "image") {
      s += 2;
    }

    /* project-topic boost if research pack topic tokens match */
    var topic = (ctx && ctx.topic) || "";
    if (topic) {
      var toks = topic.toLowerCase().split(/\W+/).filter(Boolean);
      var hay = (p.name + " " + p.path).toLowerCase();
      var hit = 0;
      toks.forEach(function (t) {
        if (t.length > 3 && hay.indexOf(t) >= 0) hit++;
      });
      if (hit) {
        s += Math.min(20, hit * 5);
        why.push("topic match×" + hit);
      }
    }

    s = Math.max(0, Math.min(100, Math.round(s)));
    var helpful = s >= 55;
    var grokBetter =
      (kind === "script" && p.meta && !p.meta.sameOrigin && s < 50) ||
      (kind === "link" && /legacy|old|v1\//i.test(p.path)) ||
      (kind === "structure" && /iframe/i.test(p.name));
    return {
      score: s,
      helpful: helpful,
      grokBetter: !!grokBetter,
      why: why,
    };
  }

  function rankParts(parts, ctx) {
    return parts
      .map(function (p) {
        var sc = scorePart(p, ctx);
        return Object.assign({}, p, sc);
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });
  }

  function buildPath(ranked) {
    /* Instant path: document → stack → top scripts → nav/main → docs links */
    var path = [];
    function take(pred, n) {
      var c = 0;
      ranked.forEach(function (p) {
        if (c >= n) return;
        if (pred(p)) {
          path.push(p);
          c++;
        }
      });
    }
    take(function (p) {
      return p.kind === "document";
    }, 1);
    take(function (p) {
      return p.kind === "stack";
    }, 1);
    take(function (p) {
      return p.kind === "script" && p.helpful;
    }, 5);
    take(function (p) {
      return p.kind === "structure" && /main|nav|header/.test(p.name);
    }, 3);
    take(function (p) {
      return p.kind === "link" && p.helpful && p.meta && p.meta.sameOrigin;
    }, 6);
    take(function (p) {
      return p.kind === "heading";
    }, 4);
    return path;
  }

  function grokOpportunities(ranked) {
    var out = [];
    ranked.forEach(function (p) {
      if (p.grokBetter || (p.kind === "script" && p.score >= 60 && p.meta && p.meta.sameOrigin)) {
        out.push({
          name: p.name,
          kind: p.kind,
          score: p.score,
          suggestion:
            p.kind === "script"
              ? "Rebuild/clarify this module with typed API + tests; extract bus events"
              : p.kind === "link"
                ? "Scrape/summarize target into research pack + next_urls"
                : p.kind === "structure"
                  ? "Replace iframe/embed with native MG plane if possible"
                  : "Improve IA / copy path for agent curriculum",
        });
      }
    });
    return out.slice(0, 12);
  }

  function projectFit(ranked, topic) {
    var helpful = ranked.filter(function (p) {
      return p.helpful;
    }).length;
    var noise = ranked.filter(function (p) {
      return p.score < 35;
    }).length;
    var top = ranked.slice(0, 8);
    return {
      topic: topic || "(no topic — set research pack)",
      helpfulN: helpful,
      noiseN: noise,
      total: ranked.length,
      fitScore: Math.round(
        (helpful / Math.max(1, ranked.length)) * 70 +
          Math.min(30, top.reduce(function (a, p) {
            return a + p.score;
          }, 0) / top.length * 0.3)
      ),
      keep: ranked.filter(function (p) {
        return p.helpful;
      }).slice(0, 15),
      drop: ranked
        .filter(function (p) {
          return p.score < 35;
        })
        .slice(0, 10),
    };
  }

  function scan(opts) {
    opts = opts || {};
    var topic =
      opts.topic ||
      (window.__mgResearch && window.__mgResearch.pack && window.__mgResearch.pack.topic) ||
      document.title ||
      "";
    var raw = scanPage();
    var ranked = rankParts(raw, { topic: topic });
    var path = buildPath(ranked);
    var grok = grokOpportunities(ranked);
    var fit = projectFit(ranked, topic);
    lastAtlas = {
      ver: VER,
      t: Date.now(),
      url: location.href,
      host: location.hostname,
      title: document.title || "",
      topic: topic,
      parts: ranked,
      path: path,
      grok: grok,
      fit: fit,
      counts: ranked.reduce(function (acc, p) {
        acc[p.kind] = (acc[p.kind] || 0) + 1;
        return acc;
      }, {}),
    };
    try {
      if (window.__mgQbitBus)
        window.__mgQbitBus.publish({
          src: "site-atlas",
          kind: "atlas",
          lane: "L6",
          prefix: "+0:",
          withGlyph: true,
          payload: {
            fit: fit.fitScore,
            parts: ranked.length,
            host: lastAtlas.host,
          },
          fleet: { surface: "atlas" },
        });
    } catch (eB) {}
    log(
      VER +
        " · " +
        ranked.length +
        " parts · fit " +
        fit.fitScore +
        " · path " +
        path.length
    );
    return lastAtlas;
  }

  function toMarkdown(atlas) {
    atlas = atlas || lastAtlas;
    if (!atlas) return "";
    var lines = [];
    lines.push("# Site Atlas · " + (atlas.title || atlas.host));
    lines.push("");
    lines.push("- **url:** " + atlas.url);
    lines.push("- **topic:** " + atlas.topic);
    lines.push("- **fit:** " + atlas.fit.fitScore + " / 100");
    lines.push("- **parts:** " + atlas.parts.length + " · " + JSON.stringify(atlas.counts));
    lines.push("");
    lines.push("## Instant path (learn this first)");
    atlas.path.forEach(function (p, i) {
      lines.push(
        (i + 1) +
          ". **" +
          p.kind +
          "** `" +
          p.name +
          "` · score " +
          p.score +
          (p.why && p.why.length ? " · " + p.why.join(", ") : "")
      );
      if (p.url) lines.push("   - " + p.url);
    });
    lines.push("");
    lines.push("## Keep (helpful for project)");
    atlas.fit.keep.forEach(function (p) {
      lines.push("- [" + p.score + "] " + p.kind + " · " + p.name);
    });
    lines.push("");
    lines.push("## Drop / low value");
    atlas.fit.drop.forEach(function (p) {
      lines.push("- [" + p.score + "] " + p.kind + " · " + p.name);
    });
    lines.push("");
    lines.push("## Grok could build better");
    (atlas.grok || []).forEach(function (g) {
      lines.push("- **" + g.name + "** (" + g.kind + ", " + g.score + "): " + g.suggestion);
    });
    lines.push("");
    lines.push("_Not Wayback rebuild — inventory + rank + path for agent learning._");
    return lines.join("\n");
  }

  function exportAtlas() {
    var a = lastAtlas || scan();
    var md = toMarkdown(a);
    try {
      var blob = new Blob([md], { type: "text/markdown" });
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "site-atlas-" + (a.host || "page") + "-" + Date.now() + ".md";
      link.click();
    } catch (e) {}
    try {
      if (window.ipc)
        window.ipc.postMessage(
          JSON.stringify({ op: "clipboard_copy", text: md })
        );
      else if (navigator.clipboard) navigator.clipboard.writeText(md);
    } catch (e2) {}
    return md;
  }

  /* ── UI (Figma-files-ish list) ── */
  function ensureCss() {
    if (document.getElementById("mg-site-atlas-css")) return;
    var st = document.createElement("style");
    st.id = "mg-site-atlas-css";
    st.textContent = [
      "#mg-site-atlas{position:fixed;left:12px;top:56px;z-index:2147483002;",
      "  width:min(360px,92vw);max-height:min(78vh,720px);display:flex;flex-direction:column;",
      "  border-radius:14px;overflow:hidden;",
      "  background:rgba(16,18,22,0.92);backdrop-filter:blur(28px) saturate(1.4);",
      "  -webkit-backdrop-filter:blur(28px) saturate(1.4);",
      "  border:1px solid rgba(255,255,255,0.14);",
      "  box-shadow:0 16px 40px rgba(0,0,0,0.35);",
      "  font:500 12px/1.35 -apple-system,system-ui;color:rgba(244,246,250,0.94)}",
      "#mg-site-atlas.hidden{display:none!important}",
      "#mg-site-atlas .hd{display:flex;align-items:center;justify-content:space-between;",
      "  padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.1);",
      "  font:600 11px/1 system-ui;letter-spacing:0.06em;text-transform:uppercase}",
      "#mg-site-atlas .hd button{appearance:none;border:0;background:rgba(255,255,255,0.08);",
      "  color:inherit;border-radius:8px;padding:6px 8px;cursor:pointer;font:600 10px system-ui}",
      "#mg-site-atlas .meta{padding:8px 12px;font:500 10px/1.4 ui-monospace,Menlo,monospace;",
      "  color:rgba(180,200,220,0.75);border-bottom:1px solid rgba(255,255,255,0.06)}",
      "#mg-site-atlas .tabs{display:flex;gap:4px;padding:8px 10px}",
      "#mg-site-atlas .tabs button{flex:1;appearance:none;border:0;cursor:pointer;",
      "  padding:7px;border-radius:8px;font:600 9px/1 system-ui;letter-spacing:0.06em;",
      "  text-transform:uppercase;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.7)}",
      "#mg-site-atlas .tabs button.on{background:rgba(10,132,255,0.28);color:#fff}",
      "#mg-site-atlas .list{flex:1;overflow:auto;padding:4px 0 10px}",
      "#mg-site-atlas .row{display:grid;grid-template-columns:42px 1fr auto;gap:8px;",
      "  padding:8px 12px;align-items:start;border-bottom:1px solid rgba(255,255,255,0.04);",
      "  cursor:default}",
      "#mg-site-atlas .row:hover{background:rgba(255,255,255,0.05)}",
      "#mg-site-atlas .kind{font:700 8px/1 system-ui;letter-spacing:0.06em;text-transform:uppercase;",
      "  color:rgba(160,210,255,0.85);padding-top:3px}",
      "#mg-site-atlas .name{font:600 12px/1.25 system-ui;word-break:break-word}",
      "#mg-site-atlas .sub{font:500 10px/1.3 ui-monospace,Menlo,monospace;",
      "  color:rgba(160,175,190,0.7);margin-top:2px;word-break:break-all}",
      "#mg-site-atlas .sc{font:700 12px/1 ui-monospace,Menlo,monospace;color:rgba(120,255,180,0.95)}",
      "#mg-site-atlas .sc.low{color:rgba(255,160,120,0.9)}",
      "#mg-site-atlas .ft{display:flex;gap:6px;padding:8px 10px;border-top:1px solid rgba(255,255,255,0.08)}",
      "#mg-site-atlas .ft button{flex:1;appearance:none;border:0;cursor:pointer;padding:8px;",
      "  border-radius:10px;font:600 10px system-ui;background:rgba(10,132,255,0.25);color:#e8f4ff}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  var view = "path"; /* path | keep | all | grok */

  function paintList() {
    if (!panel || !lastAtlas) return;
    var list = panel.querySelector(".list");
    if (!list) return;
    var rows = [];
    if (view === "path") rows = lastAtlas.path;
    else if (view === "keep") rows = lastAtlas.fit.keep;
    else if (view === "grok") {
      list.innerHTML = (lastAtlas.grok || [])
        .map(function (g) {
          return (
            '<div class="row"><div class="kind">grok</div><div><div class="name">' +
            String(g.name).replace(/</g, "&lt;") +
            '</div><div class="sub">' +
            String(g.suggestion).replace(/</g, "&lt;") +
            "</div></div><div class=\"sc\">" +
            g.score +
            "</div></div>"
          );
        })
        .join("") || '<div class="row"><div class="name">No rebuild targets ranked high</div></div>';
      return;
    } else rows = lastAtlas.parts.slice(0, 80);

    list.innerHTML = rows
      .map(function (p) {
        return (
          '<div class="row" data-url="' +
          String(p.url || "").replace(/"/g, "") +
          '"><div class="kind">' +
          p.kind +
          '</div><div><div class="name">' +
          String(p.name).replace(/</g, "&lt;") +
          '</div><div class="sub">' +
          String(p.path || "").replace(/</g, "&lt;").slice(0, 90) +
          (p.why && p.why.length ? " · " + p.why.join(", ") : "") +
          '</div></div><div class="sc' +
          (p.score < 45 ? " low" : "") +
          '">' +
          p.score +
          "</div></div>"
        );
      })
      .join("");
  }

  function ensurePanel() {
    ensureCss();
    if (panel) return;
    panel = document.createElement("div");
    panel.id = "mg-site-atlas";
    panel.className = "hidden";
    panel.innerHTML =
      '<div class="hd"><span>Site Atlas · files</span>' +
      '<span><button type="button" id="mg-atlas-scan">Scan</button> ' +
      '<button type="button" id="mg-atlas-x">×</button></span></div>' +
      '<div class="meta" id="mg-atlas-meta">—</div>' +
      '<div class="tabs">' +
      '<button type="button" data-v="path" class="on">Path</button>' +
      '<button type="button" data-v="keep">Keep</button>' +
      '<button type="button" data-v="all">All</button>' +
      '<button type="button" data-v="grok">Grok↑</button>' +
      "</div>" +
      '<div class="list"></div>' +
      '<div class="ft">' +
      '<button type="button" id="mg-atlas-md">Export MD</button>' +
      '<button type="button" id="mg-atlas-research">→ Research</button>' +
      "</div>";
    (document.documentElement || document.body).appendChild(panel);
    panel.querySelector("#mg-atlas-x").onclick = function () {
      setOpen(false);
    };
    panel.querySelector("#mg-atlas-scan").onclick = function () {
      scan();
      paint();
    };
    panel.querySelector("#mg-atlas-md").onclick = function () {
      exportAtlas();
    };
    panel.querySelector("#mg-atlas-research").onclick = function () {
      try {
        if (window.__mgResearch && lastAtlas) {
          var p = window.__mgResearch.pack || {};
          p.notes = (p.notes || "") + "\n\n" + toMarkdown(lastAtlas).slice(0, 6000);
          (lastAtlas.path || []).forEach(function (part) {
            if (part.url && p.next_urls && p.next_urls.indexOf(part.url) < 0)
              p.next_urls.push(part.url);
          });
          if (window.__mgResearch.save) window.__mgResearch.save();
        }
      } catch (e) {}
      log(VER + " · pushed path into research pack");
    };
    Array.prototype.forEach.call(panel.querySelectorAll(".tabs button"), function (b) {
      b.onclick = function () {
        view = b.getAttribute("data-v") || "path";
        Array.prototype.forEach.call(panel.querySelectorAll(".tabs button"), function (x) {
          x.classList.toggle("on", x === b);
        });
        paintList();
      };
    });
  }

  function paint() {
    if (!panel || !lastAtlas) return;
    var m = panel.querySelector("#mg-atlas-meta");
    if (m)
      m.textContent =
        lastAtlas.host +
        " · fit " +
        lastAtlas.fit.fitScore +
        " · " +
        lastAtlas.parts.length +
        " parts · keep " +
        lastAtlas.fit.helpfulN +
        " · noise " +
        lastAtlas.fit.noiseN;
    paintList();
  }

  function setOpen(on) {
    open = !!on;
    ensurePanel();
    if (open) {
      if (!lastAtlas) scan();
      paint();
      panel.classList.remove("hidden");
    } else if (panel) panel.classList.add("hidden");
  }

  window.__mgSiteAtlas = {
    ver: VER,
    scan: scan,
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: function () {
      setOpen(!open);
    },
    exportMarkdown: exportAtlas,
    toMarkdown: toMarkdown,
    last: function () {
      return lastAtlas;
    },
    report: function () {
      return (
        VER +
        (lastAtlas
          ? " fit=" + lastAtlas.fit.fitScore + " n=" + lastAtlas.parts.length
          : " idle")
      );
    },
  };

  /* search bar: atlas · map · files */
  try {
    if (window.__mgSearchComms) {
      /* optional hook later */
    }
  } catch (e) {}

  log(VER + " · Figma-style site inventory · score · path (not Wayback rebuild)");
})();
