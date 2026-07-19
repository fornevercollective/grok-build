/* Memory Glass · CHROME TOKENS (Jump A · presentable craft)
 * Single glass language for left/right drawers, shell words, acts, sections.
 * Inject early (before drawers). Idempotent.
 * VER: mg-chrome-tokens-v1
 */
(function () {
  "use strict";
  var VER = "mg-chrome-tokens-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._chromeTokensVer === VER) return;
  HP._chromeTokensVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var old = document.getElementById("mg-chrome-tokens-css");
  if (old) old.remove();
  var st = document.createElement("style");
  st.id = "mg-chrome-tokens-css";
  st.textContent = [
    ":root{",
    "  --mg-glass-bg:rgba(28,30,36,0.72);",
    "  --mg-glass-bg-strong:rgba(40,40,44,0.55);",
    "  --mg-glass-line:rgba(255,255,255,0.12);",
    "  --mg-glass-line-hot:rgba(140,200,255,0.45);",
    "  --mg-glass-text:rgba(244,246,250,0.94);",
    "  --mg-glass-muted:rgba(200,210,225,0.55);",
    "  --mg-glass-cyan:rgba(160,210,255,0.95);",
    "  --mg-glass-ok:rgba(120,230,160,0.95);",
    "  --mg-glass-hot:rgba(255,200,140,0.95);",
    "  --mg-glass-blur:blur(48px) saturate(1.8);",
    "  --mg-glass-radius:18px;",
    "  --mg-glass-radius-sm:12px;",
    "  --mg-glass-act-radius:16px;",
    "  --mg-glass-shadow:0 18px 48px rgba(0,0,0,0.36),inset 0 1px 0 rgba(255,255,255,0.12);",
    "  --mg-ease:cubic-bezier(.2,.9,.2,1);",
    "  --mg-dur:.22s;",
    "  --mg-hdr-fs:11px;",
    "  --mg-hdr-ls:0.22em;",
    "  --mg-shell-top:2px;",
    "  --mg-act-min-h:72px;",
    "}",
    /* shell words — Inspect / PAGE / LIVE / SOLVE language */
    ".mg-shell-word,html .mg-shell-word{",
    "  font:600 var(--mg-hdr-fs)/1 system-ui,sans-serif!important;",
    "  letter-spacing:var(--mg-hdr-ls)!important;text-transform:uppercase!important;",
    "  color:rgba(255,255,255,0.9)!important;background:transparent!important;",
    "  border:none!important;box-shadow:none!important;border-radius:0!important;",
    "  text-shadow:0 1px 2px rgba(0,0,0,0.4)}",
    /* unify drawer glass surfaces */
    /* drawers: drop-style see-through (override solid glass bg) */
    "#mg-tools-drawer,#mg-right-drawer{",
    "  background:rgba(14,16,22,var(--mg-drop-a,var(--mg-fill-a,0.38)))!important;",
    "  backdrop-filter:blur(40px) saturate(1.55)!important;",
    "  -webkit-backdrop-filter:blur(40px) saturate(1.55)!important;",
    "  border-color:var(--mg-glass-line)!important;",
    "  color:var(--mg-glass-text)!important;",
    "  transition:transform var(--mg-dur) var(--mg-ease)!important}",
    "#mg-right-drawer{--mg-drop-a:var(--mg-fill-a,0.4)}",
    "#mg-tools-drawer button.act,#mg-right-drawer button.act,",
    "#mg-glass-cap-body button.act{",
    "  border-radius:16px!important;",
    "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.14)!important}",
    /* permanent float ban when dual-drawer presentable mode */
    "html.mg-presentable #mg-glass-cap,",
    "html.mg-presentable #mg-mkt-rail:not(.mg-mkt-embedded),",
    "html.mg-presentable #mg-sx-rail,",
    "html.mg-presentable #mg-bloch-orb,",
    "html.mg-presentable #mg-rubik-orb{",
    "  display:none!important;pointer-events:none!important}",
  ].join("");
  (document.head || document.documentElement).appendChild(st);
  try {
    document.documentElement.classList.add("mg-presentable");
    document.documentElement.classList.add("mg-drawer-mode");
    document.documentElement.classList.add("mg-dual-drawer");
  } catch (e) {}
  window.__mgChromeTokens = {
    ver: VER,
    apply: function () {
      try {
        document.documentElement.classList.add("mg-presentable");
      } catch (e) {}
    },
    report: function () {
      return VER;
    },
  };
})();
