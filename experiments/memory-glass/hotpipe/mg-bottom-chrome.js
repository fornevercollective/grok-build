/* Memory Glass · BOTTOM CHROME (mirror of top 3-row shell)
 *
 * Bottom-most → up:
 *   ROW FOOTER (glass morphium):
 *     left  · horizontal LAB: rec · snap · draw · share · dev · agent
 *     mid   · ..... grabber dots
 *     right · MENUS 4/4 ✓ · h26 (health + chrome height)
 *
 *   ROW READOUT (build-stamp stance):
 *     left  · left TOOLS drawer status
 *     mid   · user browser tabs (#mg-tabs)
 *     right · right DATA drawer status
 *
 * Header row 3 stays: .... · CTRL · INSPECT · PAGE  (PAGE menu visible top-right)
 *
 * VER: mg-bottom-chrome-v2-deploy
 */
(function () {
  "use strict";
  var VER = "mg-bottom-chrome-v2-deploy";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._bottomChromeVer === VER) return;
  HP._bottomChromeVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "bot-chrome");
    } catch (e) {}
  }

  function root() {
    return document.documentElement || document.body;
  }

  function ensureCss() {
    var old = document.getElementById("mg-bottom-chrome-css");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "mg-bottom-chrome-css";
    st.textContent = [
      ":root,html{",
      "  --mg-bot-footer-h:36px;",
      "  --mg-bot-readout-h:30px;",
      "  --mg-bot-chrome-h:calc(var(--mg-bot-footer-h) + var(--mg-bot-readout-h));",
      "  --mg-page-pad-bot:calc(var(--mg-bot-chrome-h) + 28px + env(safe-area-inset-bottom,0px))!important;",
      "  --mg-tabs-bottom:calc(var(--mg-bot-footer-h) + 2px + env(safe-area-inset-bottom,0px))!important;",
      "  --mg-search-bottom:calc(var(--mg-bot-chrome-h) + 8px + env(safe-area-inset-bottom,0px))!important;",
      "  --mg-kb-h:0px}",
      "body{",
      "  padding-bottom:var(--mg-page-pad-bot)!important;",
      "  scroll-padding-bottom:var(--mg-page-pad-bot)!important}",

      /* ═══ Bottom chrome stack ═══ */
      "#mg-bot-chrome{",
      "  position:fixed!important;left:0!important;right:0!important;bottom:0!important;",
      "  z-index:2147483638!important;pointer-events:none!important;",
      "  display:flex!important;flex-direction:column!important;justify-content:flex-end!important;",
      "  padding-bottom:env(safe-area-inset-bottom,0px)!important;",
      "  isolation:isolate!important}",
      "#mg-bot-chrome *{box-sizing:border-box}",

      /* glass band under both rows */
      "#mg-bot-glass{",
      "  position:absolute!important;left:0!important;right:0!important;bottom:0!important;",
      "  height:var(--mg-bot-chrome-h)!important;",
      "  pointer-events:none!important;z-index:0!important;",
      "  background:linear-gradient(to top,rgba(10,12,18,0.62),rgba(10,12,18,0.38))!important;",
      "  backdrop-filter:blur(22px) saturate(1.45)!important;",
      "  -webkit-backdrop-filter:blur(22px) saturate(1.45)!important;",
      "  border-top:1px solid rgba(255,255,255,0.1)!important;",
      "  box-shadow:0 -8px 24px rgba(0,0,0,0.18)!important}",
      "html.mg-low-power #mg-bot-glass{",
      "  backdrop-filter:none!important;-webkit-backdrop-filter:none!important;",
      "  background:rgba(10,12,18,0.92)!important}",
      "html.mg-cinema-on #mg-bot-glass,html.mg-dim-on #mg-bot-glass{opacity:0.35}",

      "#mg-bot-row-readout,#mg-bot-row-footer{",
      "  position:relative!important;z-index:1!important;",
      "  display:grid!important;",
      "  grid-template-columns:minmax(0,1.1fr) minmax(0,1.6fr) minmax(0,1.1fr)!important;",
      "  align-items:center!important;gap:8px!important;",
      "  width:100%!important;padding:0 10px!important;",
      "  pointer-events:none!important}",
      "#mg-bot-row-readout{height:var(--mg-bot-readout-h)!important}",
      "#mg-bot-row-footer{height:var(--mg-bot-footer-h)!important}",
      "#mg-bot-row-readout > *,#mg-bot-row-footer > *{",
      "  min-width:0!important;pointer-events:auto!important}",

      /* readout cells — stamp language */
      ".mg-bot-cell{",
      "  display:flex!important;align-items:center!important;gap:6px!important;",
      "  min-height:22px!important;overflow:hidden!important}",
      ".mg-bot-cell.left{justify-content:flex-start!important}",
      ".mg-bot-cell.mid{justify-content:center!important}",
      ".mg-bot-cell.right{justify-content:flex-end!important}",
      ".mg-bot-readout{",
      "  font:600 9px/1.2 ui-monospace,Menlo,monospace!important;",
      "  letter-spacing:0.04em!important;",
      "  color:rgba(200,215,235,0.72)!important;",
      "  text-shadow:0 1px 2px rgba(0,0,0,0.55)!important;",
      "  white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;",
      "  max-width:100%!important}",
      ".mg-bot-readout b{color:rgba(230,240,255,0.92)!important;font-weight:650}",

      /* footer mid dots */
      "#mg-bot-dots{",
      "  appearance:none;border:0;background:transparent;cursor:default;",
      "  color:rgba(255,255,255,0.55);",
      "  font:700 11px/1 ui-monospace,Menlo,monospace;",
      "  letter-spacing:0.28em;",
      "  text-shadow:0 1px 2px rgba(0,0,0,0.45);",
      "  padding:6px 8px;opacity:0.85}",

      /* horizontal LAB glass strip */
      "#mg-bot-lab{",
      "  display:flex!important;flex-wrap:nowrap!important;align-items:center!important;",
      "  gap:2px!important;max-width:100%!important;overflow-x:auto!important;",
      "  scrollbar-width:none!important;",
      "  padding:3px 4px!important;border-radius:14px!important;",
      "  background:rgba(28,30,36,0.55)!important;",
      "  border:1px solid rgba(255,255,255,0.12)!important;",
      "  box-shadow:inset 0 1px 0 rgba(255,255,255,0.1),0 6px 18px rgba(0,0,0,0.22)!important;",
      "  backdrop-filter:blur(18px) saturate(1.4)!important;",
      "  -webkit-backdrop-filter:blur(18px) saturate(1.4)!important}",
      "#mg-bot-lab::-webkit-scrollbar{display:none}",
      "html.mg-low-power #mg-bot-lab{",
      "  backdrop-filter:none!important;-webkit-backdrop-filter:none!important;",
      "  background:rgba(16,18,24,0.92)!important}",
      "#mg-bot-lab button{",
      "  appearance:none!important;cursor:pointer!important;user-select:none!important;",
      "  border:0!important;background:transparent!important;",
      "  color:rgba(255,255,255,0.62)!important;",
      "  font:650 10px/1 system-ui,sans-serif!important;",
      "  letter-spacing:0.14em!important;text-transform:uppercase!important;",
      "  padding:7px 8px!important;border-radius:10px!important;",
      "  white-space:nowrap!important;",
      "  text-shadow:0 1px 2px rgba(0,0,0,0.4)!important;",
      "  transition:color .12s,background .12s,opacity .12s!important}",
      "#mg-bot-lab button:hover{color:#fff!important;background:rgba(255,255,255,0.08)!important}",
      "#mg-bot-lab button.on{color:#fff!important;",
      "  background:rgba(255,255,255,0.1)!important;",
      "  text-shadow:0 0 10px rgba(255,255,255,0.35)!important}",
      "#mg-bot-lab button#mg-lab-rec.on{color:#fca5a5!important}",
      "#mg-bot-lab button#mg-lab-draw.on{color:#fecaca!important}",
      "#mg-bot-lab button#mg-lab-dev.on{color:#93c5fd!important}",
      "#mg-bot-lab button#mg-lab-agent.on{color:#9fd0ff!important}",
      "#mg-bot-lab button .dot{opacity:0.45;margin-right:3px}",

      /* adopt tabs into mid readout */
      "#mg-bot-tabs-host #mg-tabs,",
      "#mg-bot-chrome #mg-tabs{",
      "  position:relative!important;left:auto!important;right:auto!important;",
      "  bottom:auto!important;top:auto!important;",
      "  transform:none!important;max-width:100%!important;",
      "  min-height:0!important;opacity:1!important;",
      "  z-index:1!important;pointer-events:auto!important}",

      /* health host (right footer) */
      "#mg-bot-health-host{",
      "  display:flex!important;align-items:center!important;justify-content:flex-end!important;",
      "  gap:8px!important;max-width:100%!important}",
      "#mg-bot-health-host #mg-menu-health-pill{",
      "  position:relative!important;right:auto!important;bottom:auto!important;",
      "  left:auto!important;top:auto!important;",
      "  border-radius:10px!important;padding:5px 9px!important;",
      "  font:650 9px/1.2 ui-monospace,Menlo,system-ui!important;",
      "  letter-spacing:0.04em!important;white-space:nowrap!important}",
      "#mg-bot-h26{",
      "  font:600 9px/1 ui-monospace,Menlo,monospace!important;",
      "  color:rgba(180,200,220,0.55)!important;letter-spacing:0.06em!important}",

      /* hide old free-floating lab chip when bottom chrome owns lab */
      "html.mg-bot-chrome #mg-rec-chip{display:none!important}",
      "html.mg-bot-chrome #mg-menu-health-pill{",
      "  /* only free pill hidden if still floating outside host */}",
      "html.mg-bot-chrome body > #mg-menu-health-pill,",
      "html.mg-bot-chrome html > #mg-menu-health-pill{",
      "  display:none!important}",
      "html.mg-bot-chrome #mg-bot-health-host #mg-menu-health-pill{",
      "  display:block!important}",

      /* keep PAGE / INSPECT top menu hit-testable above page */
      "html.mg-bot-chrome #mg-top-right,",
      "html.mg-bot-chrome #mg-mode-menu,",
      "html.mg-bot-chrome #mg-mode-drop{",
      "  visibility:visible!important;pointer-events:auto!important}",
      "html.mg-bot-chrome #mg-mode-drop{",
      "  z-index:2147483647!important}",

      "@media (max-width:820px){",
      "  :root,html{--mg-bot-footer-h:34px;--mg-bot-readout-h:28px}",
      "  #mg-bot-lab button{padding:6px 6px!important;letter-spacing:0.08em!important;font-size:9px!important}",
      "  .mg-bot-readout{font-size:8px!important}",
      "}",
    ].join("");
    (document.head || root()).appendChild(st);
  }

  function el(id, tag, cls) {
    var n = document.getElementById(id);
    if (n) return n;
    n = document.createElement(tag || "div");
    n.id = id;
    if (cls) n.className = cls;
    return n;
  }

  function mountShell() {
    ensureCss();
    try {
      document.documentElement.classList.add("mg-bot-chrome");
    } catch (e) {}

    var shell = document.getElementById("mg-bot-chrome");
    if (shell) {
      try {
        if (shell.parentNode) shell.parentNode.removeChild(shell);
      } catch (eR) {}
    }
    shell = document.createElement("div");
    shell.id = "mg-bot-chrome";
    shell.innerHTML =
      '<div id="mg-bot-glass" aria-hidden="true"></div>' +
      '<div id="mg-bot-row-readout">' +
      '  <div class="mg-bot-cell left" id="mg-bot-left-cell">' +
      '    <span class="mg-bot-readout" id="mg-bot-left-status">TOOLS · —</span>' +
      "  </div>" +
      '  <div class="mg-bot-cell mid" id="mg-bot-tabs-host"></div>' +
      '  <div class="mg-bot-cell right" id="mg-bot-right-cell">' +
      '    <span class="mg-bot-readout" id="mg-bot-right-status">DATA · —</span>' +
      "  </div>" +
      "</div>" +
      '<div id="mg-bot-row-footer">' +
      '  <div class="mg-bot-cell left" id="mg-bot-lab-host"></div>' +
      '  <div class="mg-bot-cell mid">' +
      '    <button type="button" id="mg-bot-dots" title="chrome · bottom grabber" aria-hidden="true">.....</button>' +
      "  </div>" +
      '  <div class="mg-bot-cell right" id="mg-bot-health-host">' +
      '    <span id="mg-bot-h26" title="bottom chrome height">h' +
      String(36 + 30) +
      "</span>" +
      "  </div>" +
      "</div>";
    root().appendChild(shell);
    return shell;
  }

  function mountLab() {
    var host = document.getElementById("mg-bot-lab-host");
    if (!host) return null;
    var lab = document.getElementById("mg-bot-lab");
    if (lab && lab.parentNode === host) return lab;
    if (lab && lab.parentNode) {
      try {
        lab.parentNode.removeChild(lab);
      } catch (e) {}
    }
    lab = document.createElement("div");
    lab.id = "mg-bot-lab";
    lab.setAttribute("role", "toolbar");
    lab.setAttribute("aria-label", "Lab tools");
    lab.innerHTML =
      '<button type="button" id="mg-lab-rec" title="Record"><span class="dot">.</span>rec</button>' +
      '<button type="button" id="mg-lab-snap" title="Snapshot"><span class="dot">.</span>snap</button>' +
      '<button type="button" id="mg-lab-draw" title="Draw"><span class="dot">.</span>draw</button>' +
      '<button type="button" id="mg-lab-share" title="Share / X draft"><span class="dot">.</span>share</button>' +
      '<button type="button" id="mg-lab-dev" title="Dev pick"><span class="dot">.</span>dev</button>' +
      '<button type="button" id="mg-lab-agent" title="Agent desk"><span class="dot">.</span>agent</button>' +
      '<button type="button" id="mg-lab-deploy" title="Deploy / Status · ⌥⇧D"><span class="dot">.</span>deploy</button>';
    host.appendChild(lab);

    /* Wire through session-recorder if present, else basic hooks */
    function fire(id) {
      try {
        if (window.__mgSessionRec && window.__mgSessionRec.labAction) {
          window.__mgSessionRec.labAction(id);
          return;
        }
      } catch (e) {}
      try {
        var fake = { target: { id: id }, preventDefault: function () {}, stopPropagation: function () {} };
        if (window.__mgRecChip && window.__mgRecChip.act) window.__mgRecChip.act(id);
      } catch (e2) {}
      /* synthetic click for listeners on old chip buttons */
      try {
        var b = document.getElementById(id);
        if (b && window.__mgSessionRec && window.__mgSessionRec.handleLabClick) {
          window.__mgSessionRec.handleLabClick(id);
        }
      } catch (e3) {}
    }

    Array.prototype.forEach.call(lab.querySelectorAll("button"), function (btn) {
      btn.addEventListener(
        "click",
        function (ev) {
          if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
          }
          window.__mgUserChromeTouch = true;
          var id = btn.id;
          /* Deploy is first-class — not session-recorder */
          if (id === "mg-lab-deploy") {
            try {
              if (window.__mgDeploy && window.__mgDeploy.toggle) {
                window.__mgDeploy.toggle();
                return;
              }
              if (window.__mgLazy && window.__mgLazy.need) {
                window.__mgLazy.need("deploy", function (ok) {
                  if (ok && window.__mgDeploy) window.__mgDeploy.toggle();
                  else if (window.ipc)
                    window.ipc.postMessage(
                      JSON.stringify({ op: "open_deploy", t: Date.now() })
                    );
                });
                return;
              }
              if (window.ipc)
                window.ipc.postMessage(
                  JSON.stringify({ op: "open_deploy", t: Date.now() })
                );
            } catch (eD) {}
            return;
          }
          try {
            if (window.__mgSessionRec && typeof window.__mgSessionRec.labClick === "function") {
              window.__mgSessionRec.labClick(id);
              return;
            }
          } catch (e) {}
          /* fallback: dispatch on document for session-recorder wireRecActions */
          try {
            var detail = { id: id };
            document.dispatchEvent(
              new CustomEvent("mg-lab-action", { detail: detail, bubbles: true })
            );
          } catch (e2) {}
          fire(id);
        },
        true
      );
    });
    return lab;
  }

  function adoptTabs() {
    var host = document.getElementById("mg-bot-tabs-host");
    if (!host) return;
    var tabs = document.getElementById("mg-tabs");
    if (!tabs) return;
    if (tabs.parentNode !== host) {
      try {
        host.appendChild(tabs);
      } catch (e) {}
    }
    try {
      tabs.style.setProperty("position", "relative", "important");
      tabs.style.setProperty("left", "auto", "important");
      tabs.style.setProperty("bottom", "auto", "important");
      tabs.style.setProperty("transform", "none", "important");
      tabs.style.setProperty("max-width", "100%", "important");
    } catch (e2) {}
  }

  function adoptHealth() {
    var host = document.getElementById("mg-bot-health-host");
    if (!host) return;
    var pill = document.getElementById("mg-menu-health-pill");
    var h26 = document.getElementById("mg-bot-h26");
    if (pill && pill.parentNode !== host) {
      try {
        host.insertBefore(pill, h26 || null);
      } catch (e) {
        try {
          host.appendChild(pill);
        } catch (e2) {}
      }
    }
    if (!pill) {
      /* placeholder until menu-health mounts */
      var ph = document.getElementById("mg-bot-health-ph");
      if (!ph) {
        ph = document.createElement("span");
        ph.id = "mg-bot-health-ph";
        ph.className = "mg-bot-readout";
        ph.textContent = "MENUS —";
        host.insertBefore(ph, h26 || null);
      }
    } else {
      var ph2 = document.getElementById("mg-bot-health-ph");
      if (ph2 && ph2.parentNode) ph2.parentNode.removeChild(ph2);
    }
    updateH26();
  }

  function updateH26() {
    try {
      var h26 = document.getElementById("mg-bot-h26");
      var shell = document.getElementById("mg-bot-chrome");
      if (!h26 || !shell) return;
      var r = shell.getBoundingClientRect();
      var h = Math.round(r.height || 66);
      h26.textContent = "h" + h;
      h26.title = "bottom chrome · " + h + "px";
    } catch (e) {}
  }

  function syncDrawerStatus() {
    try {
      var ls = document.getElementById("mg-bot-left-status");
      var rs = document.getElementById("mg-bot-right-status");
      var tStat = document.getElementById("mg-tools-status");
      var rStat = document.getElementById("mg-right-status");
      var leftOpen = document.documentElement.classList.contains("mg-left-open");
      var rightOpen = document.documentElement.classList.contains("mg-right-open");
      if (ls) {
        var lt =
          (tStat && tStat.textContent && tStat.textContent.trim()) ||
          (window.__mgToolsDrawer && window.__mgToolsDrawer.report
            ? window.__mgToolsDrawer.report()
            : "TOOLS");
        ls.innerHTML =
          "<b>L</b> " +
          (leftOpen ? "open" : "peek") +
          " · " +
          String(lt).slice(0, 42);
      }
      if (rs) {
        var rt =
          (rStat && rStat.textContent && rStat.textContent.trim()) ||
          (window.__mgRightDrawer && window.__mgRightDrawer.report
            ? window.__mgRightDrawer.report()
            : "DATA");
        rs.innerHTML =
          "<b>R</b> " +
          (rightOpen ? "open" : "peek") +
          " · " +
          String(rt).slice(0, 42);
      }
    } catch (e) {}
  }

  function ensureTopPageVisible() {
    try {
      var tr = document.getElementById("mg-top-right");
      var mm = document.getElementById("mg-mode-menu");
      if (tr) {
        tr.style.setProperty("visibility", "visible", "important");
        tr.style.setProperty("pointer-events", "auto", "important");
        tr.style.setProperty("opacity", "1", "important");
      }
      if (mm) {
        mm.style.setProperty("visibility", "visible", "important");
        mm.style.setProperty("pointer-events", "auto", "important");
      }
      /* keep row3 glass + grabber/CTRL/INSPECT/PAGE geometry */
      if (window.__mgChromeTokens && window.__mgChromeTokens.pin) {
        window.__mgChromeTokens.pin();
      }
    } catch (e) {}
  }

  function pinPad() {
    try {
      var de = document.documentElement;
      var bot = getComputedStyle(de).getPropertyValue("--mg-bot-chrome-h").trim() || "66px";
      de.style.setProperty(
        "--mg-page-pad-bot",
        "calc(" + bot + " + 28px + env(safe-area-inset-bottom,0px))"
      );
      de.style.setProperty(
        "--mg-search-bottom",
        "calc(" + bot + " + 8px + env(safe-area-inset-bottom,0px))"
      );
      de.style.setProperty(
        "--mg-tabs-bottom",
        "calc(var(--mg-bot-footer-h,36px) + 2px + env(safe-area-inset-bottom,0px))"
      );
      if (document.body) {
        document.body.style.setProperty(
          "padding-bottom",
          "var(--mg-page-pad-bot)",
          "important"
        );
      }
    } catch (e) {}
  }

  function layout() {
    ensureCss();
    mountShell();
    mountLab();
    adoptTabs();
    adoptHealth();
    syncDrawerStatus();
    ensureTopPageVisible();
    pinPad();
    updateH26();
    /* re-wire session lab after we remount ids */
    try {
      if (window.__mgSessionRec && window.__mgSessionRec.bindLabButtons) {
        window.__mgSessionRec.bindLabButtons();
      } else if (window.__mgRecChip && window.__mgRecChip.ensure) {
        /* session may re-create floating chip — hide via css class */
      }
    } catch (e) {}
  }

  var tick = 0;
  function softSync() {
    tick++;
    adoptTabs();
    adoptHealth();
    syncDrawerStatus();
    updateH26();
    if (tick % 4 === 0) ensureTopPageVisible();
  }

  window.__mgBottomChrome = {
    ver: VER,
    layout: layout,
    sync: softSync,
    report: function () {
      return (
        VER +
        " lab=" +
        !!document.getElementById("mg-bot-lab") +
        " tabsIn=" +
        !!(
          document.getElementById("mg-tabs") &&
          document.getElementById("mg-bot-tabs-host") &&
          document.getElementById("mg-bot-tabs-host").contains(document.getElementById("mg-tabs"))
        ) +
        " health=" +
        !!document.getElementById("mg-menu-health-pill")
      );
    },
  };

  function boot() {
    layout();
    setTimeout(layout, 200);
    setTimeout(layout, 800);
    setTimeout(softSync, 1200);
    setInterval(softSync, 2500);
    window.addEventListener(
      "resize",
      function () {
        pinPad();
        updateH26();
      },
      { passive: true }
    );
    log(VER + " · bottom footer glass + readout + tabs");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    setTimeout(boot, 80);
  }
})();
