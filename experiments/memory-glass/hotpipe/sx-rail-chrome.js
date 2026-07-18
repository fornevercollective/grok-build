/* Memory Glass · SpaceX-era side rail chrome (shared)
 * Matches inspect dock + SpaceX glass HUD from last night:
 * dark droplet, ice cyan accents, uppercase mono, 2px corners.
 * VER: sx-rail-v1
 */
(function () {
  "use strict";
  var VER = "sx-rail-v1";
  if (window.__mgSxRail && window.__mgSxRail.ver === VER) return;

  var CSS_ID = "mg-sx-rail-css";

  function ensureSharedCss() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement("style");
    st.id = CSS_ID;
    st.textContent = [
      /* SpaceX / MG glass tokens */
      ":root{",
      "  --sx-bg:rgba(6,8,12,0.94);",
      "  --sx-bg2:rgba(10,12,16,0.96);",
      "  --sx-panel:rgba(8,10,14,0.97);",
      "  --sx-line:rgba(160,180,200,0.28);",
      "  --sx-line-hot:rgba(120,200,255,0.55);",
      "  --sx-text:rgba(210,225,240,0.92);",
      "  --sx-muted:rgba(150,170,190,0.75);",
      "  --sx-cyan:rgba(160,210,255,0.95);",
      "  --sx-ice:rgba(120,200,255,0.9);",
      "  --sx-ok:rgba(100,220,160,0.95);",
      "  --sx-hot:rgba(255,180,100,0.95);",
      "  --sx-font:600 9px/1.25 ui-monospace,Menlo,monospace;",
      "}",
      /* Generic rail shell */
      ".mg-sx-rail{position:fixed;z-index:118;display:flex;pointer-events:none;",
      "  font:var(--sx-font);color:var(--sx-text);top:48px;bottom:48px}",
      ".mg-sx-rail.left{left:0;flex-direction:row}",
      ".mg-sx-rail.right{right:0;flex-direction:row-reverse}",
      ".mg-sx-tab{pointer-events:auto;appearance:none;cursor:pointer;",
      "  writing-mode:vertical-rl;transform:none;",
      "  border:1px solid var(--sx-line);background:var(--sx-bg2);",
      "  color:var(--sx-cyan);padding:12px 7px;letter-spacing:0.14em;",
      "  text-transform:uppercase;border-radius:0 3px 3px 0}",
      ".mg-sx-rail.right .mg-sx-tab{transform:rotate(180deg);border-radius:3px 0 0 3px}",
      ".mg-sx-tab:hover,.mg-sx-rail.open .mg-sx-tab{",
      "  border-color:var(--sx-line-hot);color:#fff;",
      "  background:rgba(28,48,68,0.92);box-shadow:0 0 12px rgba(100,190,255,0.12)}",
      ".mg-sx-panel{pointer-events:auto;width:0;overflow:hidden;",
      "  transition:width .18s ease;display:flex;flex-direction:column;",
      "  background:var(--sx-panel);color:var(--sx-text);",
      "  border:1px solid transparent;backdrop-filter:blur(14px);",
      "  -webkit-backdrop-filter:blur(14px)}",
      ".mg-sx-rail.left .mg-sx-panel{border-right:1px solid var(--sx-line)}",
      ".mg-sx-rail.right .mg-sx-panel{border-left:1px solid var(--sx-line)}",
      ".mg-sx-rail.open .mg-sx-panel{width:min(400px,90vw)}",
      ".mg-sx-head{display:flex;align-items:center;justify-content:space-between;",
      "  padding:10px 12px;border-bottom:1px solid var(--sx-line);",
      "  letter-spacing:0.14em;text-transform:uppercase;font:700 10px/1 system-ui;",
      "  color:var(--sx-cyan)}",
      ".mg-sx-head button{appearance:none;background:transparent;border:0;",
      "  color:var(--sx-muted);cursor:pointer;font:700 14px/1 system-ui;padding:0 4px}",
      ".mg-sx-head button:hover{color:#fff}",
      ".mg-sx-meta{padding:8px 12px;border-bottom:1px solid rgba(140,160,180,0.14);",
      "  color:var(--sx-muted);font-weight:500}",
      ".mg-sx-meta b{color:var(--sx-ice);font-weight:700}",
      ".mg-sx-body{flex:1;overflow:auto;padding:8px 10px;min-height:80px}",
      ".mg-sx-row{display:flex;flex-wrap:wrap;gap:4px;padding:0 10px 8px}",
      ".mg-sx-btn{appearance:none;cursor:pointer;border:1px solid var(--sx-line);",
      "  background:rgba(14,18,24,0.95);color:var(--sx-text);",
      "  padding:6px 8px;border-radius:2px;text-transform:uppercase;",
      "  letter-spacing:0.08em;font:inherit}",
      ".mg-sx-btn:hover{border-color:var(--sx-line-hot);color:#fff}",
      ".mg-sx-btn.hot{border-color:rgba(255,180,100,0.45);color:var(--sx-hot)}",
      ".mg-sx-btn.ok{border-color:rgba(100,220,160,0.4);color:var(--sx-ok)}",
      ".mg-sx-btn.on{border-color:var(--sx-line-hot);background:rgba(28,48,68,0.9);color:#fff}",
      ".mg-sx-card{padding:6px 8px;margin-bottom:4px;border:1px solid rgba(140,160,180,0.18);",
      "  border-radius:2px;cursor:pointer;background:rgba(10,12,16,0.55)}",
      ".mg-sx-card:hover,.mg-sx-card.on{border-color:var(--sx-line-hot);",
      "  background:rgba(28,48,68,0.45);box-shadow:0 0 10px rgba(100,190,255,0.1)}",
      ".mg-sx-card .sub{opacity:0.72;font-weight:500;margin-top:2px}",
      ".mg-sx-status{padding:6px 12px 10px;color:var(--sx-ok);font-weight:500;",
      "  border-top:1px solid rgba(140,160,180,0.14)}",
      ".mg-sx-canvas-wrap{height:160px;margin:0 10px 8px;border:1px solid var(--sx-line);",
      "  border-radius:2px;background:rgba(0,0,0,0.35);overflow:hidden}",
      ".mg-sx-canvas-wrap canvas{width:100%;height:100%;display:block}",
      /* stack multiple left/right tabs without overlap */
      ".mg-sx-rail.left.stack-a{top:48px}",
      ".mg-sx-rail.left.stack-b{top:calc(48px + 42%)}",
      ".mg-sx-rail.right.stack-a{top:48px}",
      ".mg-sx-rail.right.stack-b{top:calc(48px + 42%)}",
      ".mg-sx-rail.left.stack-full,.mg-sx-rail.right.stack-full{top:48px;bottom:48px}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  window.__mgSxRail = {
    ver: VER,
    ensure: ensureSharedCss,
    tokens: {
      bg: "rgba(6,8,12,0.94)",
      cyan: "rgba(160,210,255,0.95)",
      ice: "rgba(120,200,255,0.9)",
      ok: "rgba(100,220,160,0.95)",
      hot: "rgba(255,180,100,0.95)",
      line: "rgba(160,180,200,0.28)",
    },
  };
  ensureSharedCss();
})();
