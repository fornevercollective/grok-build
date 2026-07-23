/* Memory Glass · Deploy / Status surface
 * Built-in status panel + full deploy.html page.
 * Fallback chain when local assets missing:
 *   1) in-page panel (always)
 *   2) hotpipe/deploy.html via native open_deploy
 *   3) still-server http://127.0.0.1:9877/deploy.html
 *   4) architecture-lab file:// from git
 *   5) https://fornevercollective.github.io/grok-build/
 * VER: mg-deploy-v1
 */
(function () {
  "use strict";
  var VER = "mg-deploy-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._mgDeployVer === VER) return;
  HP._mgDeployVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var STILL = "http://127.0.0.1:9877";
  var KB_LOCAL = "http://127.0.0.1:8899";
  var KB_LIVE = "https://kbatch.ugrad.ai";
  var OLLAMA = "http://127.0.0.1:11434";
  var LAB_PAGES = "https://fornevercollective.github.io/grok-build/";
  var LAB_FILE =
    "file:///Volumes/qbitOS/00.dev/projects/grok-build/docs/architecture-lab/index.html";
  var DEPLOY_FILE =
    "file:///Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass/hotpipe/deploy.html";
  var RELAUNCH_FILE =
    "file:///Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass/hotpipe/relaunch.html";

  var panel = null;
  var openState = false;
  var lastSnap = null;
  var probeTimer = 0;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "deploy");
    } catch (e) {}
  }

  function nav(url) {
    if (!url) return false;
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
        log("nav " + url);
        return true;
      }
    } catch (e) {}
    try {
      location.href = url;
      return true;
    } catch (e2) {
      try {
        window.open(url, "_blank");
        return true;
      } catch (e3) {
        return false;
      }
    }
  }

  function probe(url, ms) {
    var t0 = Date.now();
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () {
      try {
        if (ctrl) ctrl.abort();
      } catch (e) {}
    }, ms || 2800);
    return fetch(url, {
      method: "GET",
      cache: "no-store",
      mode: "cors",
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (r) {
        clearTimeout(timer);
        return { ok: !!(r && r.ok), status: r ? r.status : 0, ms: Date.now() - t0, res: r };
      })
      .catch(function () {
        clearTimeout(timer);
        return { ok: false, status: 0, ms: Date.now() - t0, res: null };
      });
  }

  function probeJson(url) {
    return probe(url).then(function (p) {
      if (!p.res) return p;
      return p.res
        .json()
        .then(function (j) {
          p.json = j;
          return p;
        })
        .catch(function () {
          return p;
        });
    });
  }

  function ensureCss() {
    if (document.getElementById("mg-deploy-css")) return;
    var st = document.createElement("style");
    st.id = "mg-deploy-css";
    st.textContent = [
      "#mg-deploy-panel{position:fixed;right:12px;bottom:calc(var(--mg-bot-chrome-h,66px) + 12px);",
      "  z-index:2147483605;width:min(420px,calc(100vw - 24px));max-height:min(72vh,640px);",
      "  display:flex;flex-direction:column;overflow:hidden;",
      "  border-radius:14px;border:1px solid rgba(255,255,255,0.14);",
      "  background:rgba(10,12,18,0.88);color:rgba(240,245,255,0.94);",
      "  backdrop-filter:blur(22px) saturate(1.35);-webkit-backdrop-filter:blur(22px) saturate(1.35);",
      "  box-shadow:0 16px 40px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.08);",
      "  font:500 12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif}",
      "#mg-deploy-panel.hidden{display:none!important}",
      "html.mg-low-power #mg-deploy-panel{backdrop-filter:none;-webkit-backdrop-filter:none;background:rgba(10,12,18,0.96)}",
      "#mg-deploy-panel .hd{display:flex;align-items:center;justify-content:space-between;gap:8px;",
      "  padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.1)}",
      "#mg-deploy-panel .hd b{font:700 10px/1 system-ui;letter-spacing:0.14em;text-transform:uppercase;",
      "  color:rgba(255,190,100,0.95)}",
      "#mg-deploy-panel .hd .sub{font:500 10px/1 ui-monospace,Menlo,monospace;color:rgba(180,195,210,0.7)}",
      "#mg-deploy-panel .hd button{appearance:none;border:0;background:rgba(255,255,255,0.08);",
      "  color:rgba(230,240,255,0.9);border-radius:8px;padding:6px 8px;cursor:pointer;",
      "  font:650 10px/1 system-ui}",
      "#mg-deploy-panel .bd{padding:10px 12px;overflow:auto;flex:1;min-height:0}",
      "#mg-deploy-panel .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}",
      "#mg-deploy-panel .m{padding:8px;border-radius:10px;background:rgba(255,255,255,0.05);",
      "  border:1px solid rgba(255,255,255,0.08)}",
      "#mg-deploy-panel .m .k{font:650 9px/1 system-ui;letter-spacing:0.08em;text-transform:uppercase;",
      "  color:rgba(180,195,210,0.7)}",
      "#mg-deploy-panel .m .v{font:700 13px/1.2 ui-monospace,Menlo,monospace;margin-top:5px}",
      "#mg-deploy-panel .ok{color:rgba(100,230,170,0.95)}",
      "#mg-deploy-panel .bad{color:rgba(255,120,120,0.95)}",
      "#mg-deploy-panel .warn{color:rgba(255,200,90,0.95)}",
      "#mg-deploy-panel .note{margin:8px 0 0;font:500 11px/1.35 system-ui;color:rgba(180,195,210,0.78)}",
      "#mg-deploy-panel .ft{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;",
      "  border-top:1px solid rgba(255,255,255,0.1)}",
      "#mg-deploy-panel .ft button{flex:1;min-width:72px;appearance:none;border:0;cursor:pointer;",
      "  padding:8px;border-radius:9px;background:rgba(255,255,255,0.08);",
      "  color:rgba(240,245,255,0.92);font:650 10px/1 system-ui;letter-spacing:0.04em}",
      "#mg-deploy-panel .ft button.primary{background:rgba(10,132,255,0.3)}",
      "#mg-deploy-panel .ft button.hot{background:rgba(255,160,60,0.2);color:rgba(255,200,120,0.95)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function ensurePanel() {
    ensureCss();
    if (panel && panel.parentNode) return panel;
    panel = document.createElement("div");
    panel.id = "mg-deploy-panel";
    panel.className = "hidden";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Memory Glass deploy status");
    panel.innerHTML =
      '<div class="hd">' +
      "  <div><b>Deploy · Status</b><div class=\"sub\" id=\"mg-deploy-sub\">quiet-hold</div></div>" +
      '  <div style="display:flex;gap:6px">' +
      '    <button type="button" id="mg-deploy-ref" title="Refresh">↻</button>' +
      '    <button type="button" id="mg-deploy-x" title="Close">✕</button>' +
      "  </div>" +
      "</div>" +
      '<div class="bd">' +
      '  <div class="grid" id="mg-deploy-grid"></div>' +
      '  <p class="note" id="mg-deploy-note">Probing protected services…</p>' +
      "</div>" +
      '<div class="ft">' +
      '  <button type="button" class="primary" id="mg-deploy-full">Full page</button>' +
      '  <button type="button" id="mg-deploy-relaunch">Relaunch</button>' +
      '  <button type="button" id="mg-deploy-copy">Copy</button>' +
      '  <button type="button" class="hot" id="mg-deploy-lab">Grok Lab</button>' +
      '  <button type="button" id="mg-deploy-pages">Pages</button>' +
      "</div>";
    (document.documentElement || document.body).appendChild(panel);

    document.getElementById("mg-deploy-x").onclick = function () {
      close();
    };
    document.getElementById("mg-deploy-ref").onclick = function () {
      refresh();
    };
    document.getElementById("mg-deploy-full").onclick = function () {
      openPage();
    };
    document.getElementById("mg-deploy-relaunch").onclick = function () {
      openRelaunch();
    };
    document.getElementById("mg-deploy-copy").onclick = function () {
      copySnap();
    };
    document.getElementById("mg-deploy-lab").onclick = function () {
      openLabFallback("git");
    };
    document.getElementById("mg-deploy-pages").onclick = function () {
      openLabFallback("pages");
    };
    return panel;
  }

  function openRelaunch() {
    window.__mgUserChromeTouch = true;
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({ op: "navigate", url: RELAUNCH_FILE, t: Date.now() })
        );
        return { ok: true, mode: "file", url: RELAUNCH_FILE };
      }
    } catch (e) {}
    nav(STILL + "/relaunch.html");
    return { ok: true, mode: "still" };
  }

  function setGrid(rows) {
    var g = document.getElementById("mg-deploy-grid");
    if (!g) return;
    g.innerHTML = rows
      .map(function (r) {
        return (
          '<div class="m"><div class="k">' +
          r.k +
          '</div><div class="v ' +
          (r.c || "") +
          '">' +
          r.v +
          "</div></div>"
        );
      })
      .join("");
  }

  function refresh() {
    ensurePanel();
    var sub = document.getElementById("mg-deploy-sub");
    var note = document.getElementById("mg-deploy-note");
    if (sub) sub.textContent = "probing…";
    if (note) note.textContent = "Probing protected services…";

    Promise.all([
      probeJson(STILL + "/health"),
      probe(KB_LOCAL + "/"),
      probe(KB_LIVE + "/health"),
      probeJson(OLLAMA + "/api/tags"),
      probeJson(KB_LOCAL + "/data/catalog/index.json").then(function (p) {
        if (p.ok) return p;
        return probeJson(KB_LIVE + "/data/catalog/index.json");
      }),
    ]).then(function (arr) {
      var still = arr[0];
      var loc = arr[1];
      var live = arr[2];
      var ol = arr[3];
      var cat = arr[4];
      var models =
        ol.json && ol.json.models
          ? ol.json.models.map(function (m) {
              return m.name;
            })
          : [];
      var rowsApprox =
        cat.json && cat.json.totalRowsApprox != null ? cat.json.totalRowsApprox : "—";
      var cats =
        cat.json && cat.json.totalCatalogs != null ? cat.json.totalCatalogs : "—";

      lastSnap = {
        t: new Date().toISOString(),
        ver: VER,
        still: !!still.ok,
        kbatchLocal: !!loc.ok,
        kbatchLive: !!live.ok,
        ollama: !!ol.ok,
        models: models,
        catalog: { totalCatalogs: cats, totalRowsApprox: rowsApprox },
        stillHealth: still.json || null,
        mode: "quiet-hold",
      };

      setGrid([
        { k: "still :9877", v: still.ok ? "200" : "down", c: still.ok ? "ok" : "bad" },
        { k: "kbatch :8899", v: loc.ok ? "200" : "down", c: loc.ok ? "ok" : "bad" },
        { k: "kbatch live", v: live.ok ? "200" : "down", c: live.ok ? "ok" : "bad" },
        { k: "ollama", v: ol.ok ? models.length + "m" : "down", c: ol.ok ? "ok" : "bad" },
        { k: "catalogs", v: String(cats), c: "ok" },
        { k: "rows ≈", v: String(rowsApprox), c: "ok" },
      ]);

      if (sub) sub.textContent = "quiet-hold · " + lastSnap.t.slice(11, 19) + "Z";
      if (note) {
        note.textContent =
          "Expand deferred · protect 9877/9878/8899 · Full page or Grok Lab fallback if needed.";
      }
      log(
        "snap still=" +
          lastSnap.still +
          " local=" +
          lastSnap.kbatchLocal +
          " live=" +
          lastSnap.kbatchLive
      );
    });
  }

  function open() {
    window.__mgUserChromeTouch = true;
    ensurePanel();
    panel.classList.remove("hidden");
    openState = true;
    refresh();
    if (probeTimer) clearInterval(probeTimer);
    probeTimer = setInterval(function () {
      if (openState) refresh();
    }, 20000);
    log("panel open");
    return { ok: true, mode: "panel" };
  }

  function close() {
    openState = false;
    if (probeTimer) {
      clearInterval(probeTimer);
      probeTimer = 0;
    }
    if (panel) panel.classList.add("hidden");
    return { ok: true };
  }

  function toggle() {
    return openState ? close() : open();
  }

  /** Prefer native open_deploy (file:// hotpipe), then still-server, then panel. */
  function openPage(prefer) {
    prefer = prefer || "auto";
    window.__mgUserChromeTouch = true;

    if (prefer === "panel") return open();

    /* Native: load hotpipe/deploy.html in main webview */
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(JSON.stringify({ op: "open_deploy", t: Date.now() }));
        log("open_deploy ipc");
        return { ok: true, mode: "native" };
      }
    } catch (e) {}

    /* still-server static copy */
    return probe(STILL + "/deploy.html", 1200).then(function (p) {
      if (p.ok) {
        nav(STILL + "/deploy.html");
        return { ok: true, mode: "still" };
      }
      /* file:// source tree */
      nav(DEPLOY_FILE);
      /* if file blocked, user still has panel + pages */
      open();
      return { ok: true, mode: "file+panel", file: DEPLOY_FILE };
    });
  }

  function openLabFallback(which) {
    window.__mgUserChromeTouch = true;
    if (which === "pages") {
      nav(LAB_PAGES);
      return { ok: true, url: LAB_PAGES };
    }
    if (which === "git" || which === "file") {
      nav(LAB_FILE);
      return { ok: true, url: LAB_FILE, pages: LAB_PAGES };
    }
    /* auto: try pages health then git file */
    return probe(LAB_PAGES, 2000).then(function (p) {
      if (p.ok) {
        nav(LAB_PAGES);
        return { ok: true, url: LAB_PAGES };
      }
      nav(LAB_FILE);
      return { ok: true, url: LAB_FILE, fallback: true };
    });
  }

  function copySnap() {
    var t = JSON.stringify(lastSnap || { t: Date.now(), ver: VER, empty: true }, null, 2);
    try {
      if (window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(JSON.stringify({ op: "clipboard_copy", text: t }));
        log("snap copied");
        return true;
      }
    } catch (e) {}
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t);
        return true;
      }
    } catch (e2) {}
    return false;
  }

  function report() {
    return {
      ver: VER,
      open: openState,
      snap: lastSnap,
      urls: {
        stillDeploy: STILL + "/deploy.html",
        deployFile: DEPLOY_FILE,
        labPages: LAB_PAGES,
        labFile: LAB_FILE,
        kbatchLocal: KB_LOCAL,
        kbatchLive: KB_LIVE,
      },
    };
  }

  window.__mgDeploy = {
    ver: VER,
    open: open,
    close: close,
    toggle: toggle,
    refresh: refresh,
    openPage: openPage,
    openRelaunch: openRelaunch,
    openLab: openLabFallback,
    openLabFallback: openLabFallback,
    copy: copySnap,
    report: report,
    nav: nav,
  };

  /* Optional keyboard: ⌥⇧D when focused in lab */
  try {
    document.addEventListener(
      "keydown",
      function (ev) {
        if (!ev) return;
        if (ev.altKey && ev.shiftKey && (ev.key === "D" || ev.key === "d")) {
          ev.preventDefault();
          toggle();
        }
      },
      true
    );
  } catch (eK) {}

  log(VER + " ready · panel + deploy.html + lab fallback");
})();
