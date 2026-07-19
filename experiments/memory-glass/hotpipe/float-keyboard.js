/* Memory Glass · Language + Jam Keyboard Plane
 * Multi-layout · cross-language · Braille · DDR · pattern flow · contrail/beats bridge
 * Standalone API for patients / makers · Neuralink hit-target geometry · kbatch R4
 * VER: float-kb-v10-harvest-matrix
 */
(function () {
  "use strict";
  var VER = "float-kb-v10-harvest-matrix";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._floatKbVer === VER) return;
  HP._floatKbVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (eInsp) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "float-kb");
    } catch (e) {}
  }

  /* ── layouts (labels = what is typed; layout id for kbatch analyze) ── */
  var LAYOUTS = {
    qwerty: {
      id: "qwerty",
      lang: "en",
      label: "EN QWERTY",
      rows: [
        ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
        ["z", "x", "c", "v", "b", "n", "m"],
      ],
    },
    azerty: {
      id: "azerty",
      lang: "fr",
      label: "FR AZERTY",
      rows: [
        ["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
        ["w", "x", "c", "v", "b", "n"],
      ],
    },
    qwertz: {
      id: "qwertz",
      lang: "de",
      label: "DE QWERTZ",
      rows: [
        ["q", "w", "e", "r", "t", "z", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
        ["y", "x", "c", "v", "b", "n", "m"],
      ],
    },
    dvorak: {
      id: "dvorak",
      lang: "en",
      label: "DVORAK",
      rows: [
        ["'", ",", ".", "p", "y", "f", "g", "c", "r", "l"],
        ["a", "o", "e", "u", "i", "d", "h", "t", "n", "s"],
        [";", "q", "j", "k", "x", "b", "m", "w", "v", "z"],
      ],
    },
    colemak: {
      id: "colemak",
      lang: "en",
      label: "COLEMAK",
      rows: [
        ["q", "w", "f", "p", "g", "j", "l", "u", "y", ";"],
        ["a", "r", "s", "t", "d", "h", "n", "e", "i", "o"],
        ["z", "x", "c", "v", "b", "k", "m"],
      ],
    },
    ru: {
      id: "ru",
      lang: "ru",
      label: "RU",
      rows: [
        ["й", "ц", "у", "к", "е", "н", "г", "ш", "щ", "з", "х"],
        ["ф", "ы", "в", "а", "п", "р", "о", "л", "д", "ж", "э"],
        ["я", "ч", "с", "м", "и", "т", "ь", "б", "ю"],
      ],
    },
    el: {
      id: "el",
      lang: "el",
      label: "EL",
      rows: [
        [";", "ς", "ε", "ρ", "τ", "υ", "θ", "ι", "ο", "π"],
        ["α", "σ", "δ", "φ", "γ", "η", "ξ", "κ", "λ"],
        ["ζ", "χ", "ψ", "ω", "β", "ν", "μ"],
      ],
    },
    he: {
      id: "he",
      lang: "he",
      label: "HE",
      rtl: true,
      rows: [
        ["/", "'", "ק", "ר", "א", "ט", "ו", "ן", "ם", "פ"],
        ["ש", "ד", "ג", "כ", "ע", "י", "ח", "ל", "ך", "ף"],
        ["ז", "ס", "ב", "ה", "נ", "מ", "צ", "ת", "ץ"],
      ],
    },
    ar: {
      id: "ar",
      lang: "ar",
      label: "AR",
      rtl: true,
      rows: [
        ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح"],
        ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك"],
        ["ئ", "ء", "ؤ", "ر", "لا", "ى", "ة", "و", "ز"],
      ],
    },
    /* Braille input cell: 6-dot (Unicode Braille Patterns) */
    braille: {
      id: "braille",
      lang: "braille",
      label: "BRAILLE",
      braille: true,
      rows: [
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["OK", "SPC", "⌫"],
      ],
    },
  };

  /* R4 analyzed plane tags (for cross-lang target label) */
  var R4_LANGS = [
    "ar", "bg", "cs", "da", "de", "el", "es", "fi", "fr", "he", "hi", "hr",
    "hu", "id", "it", "ja", "ko", "ms", "nl", "no", "pl", "pt", "ro", "ru",
    "sl", "sr", "sv", "th", "tr", "uk", "vi", "zh", "en",
  ];

  var MODES = [
    { id: "type", label: "TYPE", title: "Type · inject · send" },
    { id: "flow", label: "FLOW", title: "Pattern flow · path analysis" },
    { id: "ddr", label: "DDR", title: "Rhythm hit targets (BCI training)" },
    { id: "braille", label: "BR8", title: "Braille 6-dot cell" },
    { id: "jam", label: "JAM", title: "qbpm jam · beats + staff + voices" },
    { id: "codec", label: "CODEC", title: "ASCII·HEX·BIN·PCAP·Gutter·Steno·Glyph·Qbit" },
  ];

  var CODECS = [
    { id: "ascii", label: "ASCII" },
    { id: "hex", label: "HEX" },
    { id: "binary", label: "BIN" },
    { id: "pcap", label: "PCAP" },
    { id: "gutter", label: "QGUT" },
    { id: "steno", label: "STENO" },
    { id: "glyph", label: "GLYPH" },
    { id: "qbit", label: "QBIT" },
  ];
  var codecId = "hex";
  var codecOutEl = null;

  var layoutId = "qwerty";
  var mode = "type";
  var targetLang = "en";
  var buf = "";
  var pathPts = [];
  var open = false;
  var el, bufEl, pathCv, statusEl, rowsEl;
  var brailleDots = [0, 0, 0, 0, 0, 0]; /* dots 1..6 */
  var ddrSeq = [];
  var ddrIdx = 0;
  var ddrHits = 0;
  var ddrMiss = 0;
  var ddrTimer = null;
  var jamArmed = false;

  var TOOLS = [
    { id: "kbatch", label: "KBATCH", url: "https://kbatch.ugrad.ai/" },
    { id: "dojo", label: "DOJO", url: "https://kbatch.ugrad.ai/dojo/" },
    { id: "books", label: "BOOKS", fn: function () {
      if (window.__mgKbatchFleet) window.__mgKbatchFleet.openLivingBooks();
      else nav("https://kbatch.ugrad.ai/labs/living-books.html");
    }},
    { id: "analyze", label: "ANALYZE", fn: function () { analyzeBuf(); } },
    { id: "send", label: "SEND", fn: function () { sendBuf(); } },
    { id: "beats", label: "BEATS", fn: function () {
      if (window.__mgKeyboardBeats) window.__mgKeyboardBeats.open();
    }},
  ];

  function layout() {
    return LAYOUTS[layoutId] || LAYOUTS.qwerty;
  }

  function ensureCss() {
    try {
      if (window.__mgSxRail) window.__mgSxRail.ensure();
    } catch (e) {}
    var old = document.getElementById("mg-float-kb-lang-css");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "mg-float-kb-lang-css";
    st.textContent = [
      "#mg-float-kb{position:fixed;right:12px;bottom:12px;z-index:2147483003;",
      "  width:min(420px,46vw);max-height:min(58vh,520px);min-height:280px;",
      "  display:flex;flex-direction:column;border-radius:16px;overflow:hidden;",
      "  background:rgba(12,14,18,0.78);backdrop-filter:blur(28px) saturate(1.45);",
      "  -webkit-backdrop-filter:blur(28px) saturate(1.45);",
      "  border:1px solid rgba(255,255,255,0.16);",
      "  box-shadow:0 12px 36px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.1);",
      "  font:600 11px/1.25 system-ui;color:rgba(244,246,250,0.94);pointer-events:auto}",
      "#mg-float-kb.hidden,html.mg-product #mg-float-kb.hidden{",
      "  display:none!important;visibility:hidden!important;pointer-events:none!important;",
      "  opacity:0!important;max-height:0!important;overflow:hidden!important;min-height:0!important}",
      /* embedded in left TOOLS drawer — CTRL Control Center glass tile quality */
      "#mg-float-kb.mg-embedded,",
      "#mg-drawer-kb-host #mg-float-kb{",
      "  position:relative!important;left:auto!important;right:auto!important;",
      "  top:auto!important;bottom:auto!important;",
      "  width:100%!important;max-width:none!important;",
      "  max-height:none!important;min-height:340px!important;height:auto!important;",
      "  z-index:1!important;margin:0!important;",
      "  border-radius:16px!important;",
      "  border:1px solid rgba(255,255,255,0.12)!important;",
      "  background:rgba(255,255,255,0.08)!important;",
      "  backdrop-filter:blur(28px) saturate(1.5)!important;",
      "  -webkit-backdrop-filter:blur(28px) saturate(1.5)!important;",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.14)!important;",
      "  display:flex!important;visibility:visible!important;opacity:1!important;",
      "  pointer-events:auto!important;overflow:hidden!important}",
      /* roomy keys when stacked in drawer (CTRL-level integration) */
      "#mg-float-kb.mg-embedded .kb-top{",
      "  padding:10px 12px!important;border-bottom:1px solid rgba(255,255,255,0.08)}",
      "#mg-float-kb.mg-embedded .ttl{",
      "  font:600 11px/1.2 system-ui!important;letter-spacing:0.08em!important;",
      "  color:rgba(255,255,255,0.92)!important}",
      "#mg-float-kb.mg-embedded .kb-buf{",
      "  padding:8px 12px!important;font:600 16px/1.3 ui-monospace,Menlo,monospace!important;",
      "  min-height:1.5em!important;max-height:2.8em!important}",
      "#mg-float-kb.mg-embedded .kb-status{padding:4px 12px 6px!important;font-size:9px!important}",
      "#mg-float-kb.mg-embedded .kb-keys-wrap{",
      "  flex:1 1 auto!important;min-height:220px!important;overflow:visible!important}",
      "#mg-float-kb.mg-embedded .kb-rows{",
      "  padding:10px 10px 12px!important;min-height:200px!important;",
      "  overflow:visible!important;justify-content:center!important}",
      "#mg-float-kb.mg-embedded .kb-row{gap:6px!important;margin-bottom:6px!important}",
      "#mg-float-kb.mg-embedded .kb-key,",
      "#mg-float-kb.mg-embedded.opts-collapsed .kb-key{",
      "  min-width:40px!important;min-height:48px!important;padding:0 9px!important;",
      "  border-radius:12px!important;font:650 15px/1 system-ui!important;",
      "  background:rgba(255,255,255,0.11)!important;",
      "  border:1px solid rgba(255,255,255,0.14)!important;",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.12)}",
      "#mg-float-kb.mg-embedded .kb-key:hover{",
      "  background:rgba(255,255,255,0.18)!important}",
      "#mg-float-kb.mg-embedded .kb-key.wide{min-width:62px!important}",
      "#mg-float-kb.mg-embedded .kb-key.space{min-width:140px!important;flex:1!important}",
      "#mg-float-kb.mg-embedded .kb-flow{",
      "  flex-shrink:0!important;min-height:108px!important;padding:0 8px 10px!important}",
      "#mg-float-kb.mg-embedded .kb-flow .kb-flow-row{min-height:72px!important}",
      "#mg-float-kb.mg-embedded .kb-flow canvas{min-height:68px!important;height:72px!important}",
      /* collapse options chrome in drawer so keys dominate */
      "#mg-float-kb.mg-embedded.opts-collapsed .kb-sec:not(.open) .kb-sec-body{display:none!important}",
      "#mg-float-kb.mg-embedded .kb-sec-hd{padding:6px 10px!important}",
      /* compact chrome */
      "#mg-float-kb .kb-top{display:flex;justify-content:space-between;align-items:center;",
      "  gap:6px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0}",
      "#mg-float-kb .ttl{font:700 9px/1.2 system-ui;letter-spacing:0.08em;text-transform:uppercase;",
      "  color:rgba(160,210,255,0.9);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#mg-float-kb .kb-tools{display:flex;flex-wrap:nowrap;gap:3px;flex-shrink:0}",
      "#mg-float-kb .kb-tools button,#mg-float-kb .kb-modes button,#mg-float-kb .kb-langs button,",
      "#mg-float-kb .kb-sec-hd button.kb-chev{",
      "  appearance:none;cursor:pointer;border:1px solid rgba(255,255,255,0.12);",
      "  background:rgba(255,255,255,0.07);color:rgba(240,245,255,0.9);",
      "  font:700 8px/1 system-ui;letter-spacing:0.04em;padding:5px 7px;border-radius:999px}",
      "#mg-float-kb .kb-tools button.kb-x{",
      "  background:rgba(255,80,80,0.22)!important;border-color:rgba(255,120,120,0.45)!important}",
      "#mg-float-kb .kb-tools button.on,#mg-float-kb .kb-sec-hd button.kb-chev.on{",
      "  background:rgba(110,203,255,0.22);border-color:rgba(110,203,255,0.45)}",
      /* buffer always visible, compact */
      "#mg-float-kb .kb-buf{padding:5px 10px;font:600 14px/1.25 ui-monospace,Menlo,monospace;",
      "  min-height:1.35em;max-height:2.6em;overflow:auto;color:rgba(200,230,255,0.95);word-break:break-all;",
      "  border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0}",
      "#mg-float-kb.rtl .kb-buf{direction:rtl;text-align:right}",
      "#mg-float-kb .kb-status{padding:2px 10px 4px;font:500 8px/1.2 ui-monospace,Menlo,monospace;",
      "  color:rgba(160,200,180,0.8);flex-shrink:0}",
      /* collapsible sections */
      "#mg-float-kb .kb-sec{border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0}",
      "#mg-float-kb .kb-sec-hd{display:flex;align-items:center;justify-content:space-between;",
      "  gap:6px;padding:4px 8px;cursor:pointer;user-select:none;",
      "  background:rgba(255,255,255,0.03)}",
      "#mg-float-kb .kb-sec-hd:hover{background:rgba(255,255,255,0.06)}",
      "#mg-float-kb .kb-sec-hd .kb-sec-ttl{font:700 8px/1 system-ui;letter-spacing:0.1em;",
      "  text-transform:uppercase;color:rgba(180,200,220,0.75)}",
      "#mg-float-kb .kb-sec-hd .kb-sec-sum{font:500 8px/1 ui-monospace,Menlo,monospace;",
      "  color:rgba(140,180,220,0.7);flex:1;text-align:right;overflow:hidden;",
      "  white-space:nowrap;text-overflow:ellipsis;max-width:55%}",
      "#mg-float-kb .kb-sec-hd .kb-chev{min-width:22px;padding:3px 6px;font-size:9px}",
      "#mg-float-kb .kb-sec-body{display:none;padding:4px 8px 8px}",
      "#mg-float-kb .kb-sec.open .kb-sec-body{display:block}",
      "#mg-float-kb .kb-sec.open .kb-chev{transform:rotate(90deg)}",
      "#mg-float-kb .kb-modes,#mg-float-kb .kb-langs,#mg-float-kb .kb-codecs{",
      "  display:flex;flex-wrap:wrap;gap:4px}",
      "#mg-float-kb .kb-modes button.on,#mg-float-kb .kb-langs button.on{",
      "  background:rgba(110,203,255,0.25);border-color:rgba(110,203,255,0.5)}",
      "#mg-float-kb .kb-modes button[data-mode=ddr].on{background:rgba(255,80,120,0.28);",
      "  border-color:rgba(255,100,140,0.55)}",
      "#mg-float-kb .kb-modes button[data-mode=braille].on{background:rgba(180,140,255,0.28);",
      "  border-color:rgba(180,140,255,0.55)}",
      "#mg-float-kb .kb-modes button[data-mode=jam].on{background:rgba(80,220,160,0.25);",
      "  border-color:rgba(100,230,170,0.5)}",
      "#mg-float-kb .kb-codecs button{",
      "  appearance:none;cursor:pointer;border:1px solid rgba(255,255,255,0.12);",
      "  background:rgba(255,255,255,0.07);color:rgba(240,245,255,0.9);",
      "  font:700 8px/1 system-ui;padding:5px 7px;border-radius:999px}",
      "#mg-float-kb .kb-codecs button.on{background:rgba(255,200,80,0.25);",
      "  border-color:rgba(255,200,80,0.55)}",
      "#mg-float-kb .kb-codec-out{max-height:64px;overflow:auto;margin-top:6px;padding:6px 8px;",
      "  border-radius:8px;background:rgba(0,0,0,0.35);",
      "  font:500 9px/1.35 ui-monospace,Menlo,monospace;",
      "  color:rgba(180,230,200,0.92);white-space:pre-wrap;word-break:break-all}",
      "#mg-float-kb .kb-live-feeds{",
      "  display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px;",
      "  max-height:100px;overflow:hidden}",
      "#mg-float-kb .kb-live-feeds .feed{",
      "  border-radius:8px;padding:4px 6px;min-height:28px;max-height:48px;overflow:auto;",
      "  background:rgba(0,0,0,0.38);border:1px solid rgba(255,255,255,0.1)}",
      "#mg-float-kb .kb-live-feeds .feed .fk{",
      "  font:700 7px/1 system-ui;letter-spacing:0.1em;text-transform:uppercase;",
      "  color:rgba(140,200,255,0.85);margin-bottom:2px}",
      "#mg-float-kb .kb-live-feeds .feed .fv{",
      "  font:500 8px/1.25 ui-monospace,Menlo,monospace;color:rgba(200,255,210,0.94);",
      "  white-space:pre-wrap;word-break:break-all}",
      "#mg-float-kb .kb-live-feeds .feed[data-f=glyph] .fv{color:rgba(255,210,140,0.95)}",
      "#mg-float-kb .kb-live-feeds .feed[data-f=hex] .fv{color:rgba(160,220,255,0.95)}",
      "#mg-float-kb .kb-live-feeds .feed[data-f=bin] .fv{color:rgba(200,180,255,0.95);font-size:7px}",
      /* KEYS — take remaining height, never squished by chrome */
      "#mg-float-kb .kb-keys-wrap{flex:1 1 auto;min-height:160px;display:flex;flex-direction:column;",
      "  overflow:hidden;border-top:1px solid rgba(255,255,255,0.06)}",
      "#mg-float-kb .kb-rows{padding:8px 8px 6px;overflow:auto;flex:1;min-height:140px;",
      "  display:flex;flex-direction:column;justify-content:flex-end}",
      "#mg-float-kb .kb-row{display:flex;gap:5px;justify-content:center;margin-bottom:5px}",
      "#mg-float-kb .kb-key{",
      "  appearance:none;cursor:pointer;min-width:34px;min-height:42px;padding:0 8px;",
      "  border-radius:10px;border:1px solid rgba(255,255,255,0.12);",
      "  background:rgba(255,255,255,0.09);color:rgba(250,250,255,0.95);",
      "  font:650 14px/1 system-ui;user-select:none}",
      "#mg-float-kb.opts-collapsed .kb-key{min-height:46px;min-width:36px;font-size:15px}",
      "#mg-float-kb .kb-key:hover{background:rgba(255,255,255,0.14)}",
      "#mg-float-kb .kb-key.lit{background:hsla(var(--h,190),90%,55%,0.55);",
      "  border-color:hsla(var(--h,190),90%,70%,0.7);transform:scale(1.04)}",
      "#mg-float-kb .kb-key.ddr-target{background:rgba(255,60,100,0.45);",
      "  border-color:rgba(255,120,160,0.9);box-shadow:0 0 12px rgba(255,80,120,0.5)}",
      "#mg-float-kb .kb-key.dot-on{background:rgba(180,140,255,0.45);",
      "  border-color:rgba(200,160,255,0.8)}",
      "#mg-float-kb .kb-key.wide{min-width:56px}",
      "#mg-float-kb .kb-key.space{flex:1;min-width:120px}",
      "#mg-float-kb .kb-key.tool{font-size:11px;opacity:0.9}",
      "#mg-float-kb .kb-key.has-menu{box-shadow:inset 0 -2px 0 rgba(10,132,255,0.55)}",
      "#mg-kb-popout{position:fixed;z-index:2147483000;min-width:148px;max-width:220px;",
      "background:rgba(22,24,28,0.96);border:1px solid rgba(255,255,255,0.14);",
      "border-radius:10px;padding:6px;box-shadow:0 12px 40px rgba(0,0,0,0.45);",
      "font:12px/1.3 -apple-system,system-ui,sans-serif;color:#eee}",
      "#mg-kb-popout button{display:block;width:100%;text-align:left;border:0;",
      "background:transparent;color:#eee;padding:8px 10px;border-radius:6px;cursor:pointer}",
      "#mg-kb-popout button:hover{background:rgba(255,255,255,0.1)}",
      "#mg-kb-popout .pop-h{font-size:10px;opacity:0.5;padding:4px 8px 6px;text-transform:uppercase}",
      /* Pattern flow under keys — multi-panel (not a compressed contrail stroke) */
      "#mg-float-kb .kb-flow{flex-shrink:0;padding:0 8px 8px;display:flex;flex-direction:column;gap:4px;",
      "  border-top:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.12)}",
      "#mg-float-kb .kb-flow-hd{display:flex;justify-content:space-between;align-items:center;",
      "  padding:6px 2px 2px;font:700 9px/1 system-ui;letter-spacing:0.1em;text-transform:uppercase;",
      "  color:rgba(160,210,255,0.88)}",
      "#mg-float-kb .kb-flow-hd .kb-flow-meta{font:500 8px/1 ui-monospace,Menlo,monospace;",
      "  letter-spacing:0.04em;text-transform:none;color:rgba(160,190,210,0.7);font-weight:500}",
      "#mg-float-kb .kb-flow-row{display:grid;grid-template-columns:1.15fr 0.95fr 0.9fr;gap:5px}",
      "#mg-float-kb .kb-flow canvas{width:100%;height:68px;display:block;border-radius:8px;",
      "  background:rgba(4,8,14,0.75);border:1px solid rgba(255,255,255,0.1)}",
      "#mg-float-kb .kb-flow-leg{display:flex;flex-wrap:wrap;gap:6px;padding:0 1px;",
      "  font:500 8px/1 ui-monospace,Menlo,monospace;color:rgba(160,180,200,0.75)}",
      "#mg-float-kb .kb-flow-leg i{display:inline-block;width:7px;height:7px;border-radius:2px;",
      "  margin-right:3px;vertical-align:middle}",
      "#mg-float-kb .kb-flow-beat{font:500 9px/1.25 ui-monospace,Menlo,monospace;",
      "  color:rgba(180,220,255,0.88);min-height:1.2em;max-height:2.4em;overflow:hidden;",
      "  padding:0 1px 2px}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  var secOpen = { mode: false, lang: false, codec: false, tools: false };

  function secSummary() {
    if (!el) return;
    var m = el.querySelector('#mg-sec-mode .kb-sec-sum');
    var l = el.querySelector('#mg-sec-lang .kb-sec-sum');
    var c = el.querySelector('#mg-sec-codec .kb-sec-sum');
    if (m) m.textContent = (mode || "type").toUpperCase();
    if (l) l.textContent = (layout().label || layoutId || "EN").slice(0, 18);
    if (c)
      c.textContent =
        mode === "codec" ? (codecId || "hex").toUpperCase() + " · feed" : "feeds · codecs";
  }

  function applySecState() {
    if (!el) return;
    ["mode", "lang", "codec", "tools"].forEach(function (id) {
      var sec = el.querySelector("#mg-sec-" + id);
      if (!sec) return;
      sec.classList.toggle("open", !!secOpen[id]);
    });
    var any = secOpen.mode || secOpen.lang || secOpen.codec || secOpen.tools;
    el.classList.toggle("opts-collapsed", !any);
    secSummary();
    measure();
  }

  function bindSec(id) {
    var sec = el.querySelector("#mg-sec-" + id);
    if (!sec) return;
    var hd = sec.querySelector(".kb-sec-hd");
    if (!hd || hd.__mgSecBound) return;
    hd.__mgSecBound = true;
    hd.addEventListener("click", function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      secOpen[id] = !secOpen[id];
      applySecState();
    });
  }

  function measure() {
    try {
      var embedded = el && el.classList.contains("mg-embedded");
      /* drawer embed owns layout — don't push --mg-kb-h or reflow float pins */
      if (embedded) {
        document.documentElement.style.setProperty("--mg-kb-h", "0px");
        return;
      }
      var h = open && el && !el.classList.contains("hidden") ? el.offsetHeight : 0;
      document.documentElement.style.setProperty("--mg-kb-h", h + (h ? 10 : 0) + "px");
      if (window.__mgGlassCap && window.__mgGlassCap.measure) window.__mgGlassCap.measure();
      if (window.__mgFloatLayout && window.__mgFloatLayout.apply)
        window.__mgFloatLayout.apply();
    } catch (e) {}
  }

  function setOpen(on) {
    open = !!on;
    if (el) {
      el.classList.toggle("hidden", !open);
      el.classList.remove("mg-menu-open");
      el.classList.remove("mg-product-ghost");
      if (!open) {
        el.style.display = "none";
        el.style.visibility = "hidden";
        el.style.pointerEvents = "none";
        el.style.opacity = "0";
      } else {
        el.style.display = "flex";
        el.style.visibility = "visible";
        el.style.pointerEvents = "auto";
        el.style.opacity = "1";
      }
    }
    if (open) {
      paintStatus();
      paintLiveFeeds();
      if (mode === "ddr") armDdr();
    } else {
      stopDdr();
      try {
        document.documentElement.style.setProperty("--mg-kb-h", "0px");
      } catch (e0) {}
    }
    measure();
  }

  function paintLiveFeeds() {
    if (!el) return;
    var box = el.querySelector("#mg-kb-live-feeds");
    if (!box) return;
    var text = String(buf || "");
    var C = window.__mgLangCodec;
    var views = null;
    try {
      if (C && C.allViews) views = C.allViews(text || " ");
    } catch (e) {}
    function set(id, label, val) {
      var f = box.querySelector('.feed[data-f="' + id + '"] .fv');
      var k = box.querySelector('.feed[data-f="' + id + '"] .fk');
      if (k) k.textContent = label;
      if (f) f.textContent = String(val || "—").slice(0, 280);
    }
    if (views) {
      set(
        "ascii",
        "ASCII",
        (views.ascii && (views.ascii.printable || views.ascii.display)) || text
      );
      set("hex", "HEX", (views.hex && (views.hex.hex || views.hex.display)) || "—");
      set(
        "bin",
        "BIN",
        (views.binary && (views.binary.binary || views.binary.display)) || "—"
      );
      set(
        "glyph",
        "GLYPH",
        (views.glyph && (views.glyph.display || views.glyph.binary)) ||
          (views.steno && views.steno.display) ||
          "—"
      );
    } else {
      /* fallback without lang-codec */
      set("ascii", "ASCII", text || "—");
      var hex = "";
      for (var i = 0; i < text.length; i++) {
        hex += text.charCodeAt(i).toString(16).padStart(2, "0") + " ";
      }
      set("hex", "HEX", hex.trim() || "—");
      var bin = "";
      for (var j = 0; j < Math.min(text.length, 24); j++) {
        bin += text.charCodeAt(j).toString(2).padStart(8, "0") + " ";
      }
      set("bin", "BIN", bin.trim() || "—");
      set("glyph", "GLYPH", text ? "◈" + text.length + "ch" : "—");
    }
  }

  function nav(url) {
    try {
      if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
      else window.open(url, "_blank");
    } catch (e) {
      window.open(url, "_blank");
    }
  }

  function paintStatus() {
    if (!statusEl) return;
    var L = layout();
    var line =
      mode.toUpperCase() +
      " · " +
      L.label +
      " · →" +
      targetLang;
    if (mode === "ddr")
      line += " · DDR " + ddrHits + "/" + (ddrHits + ddrMiss);
    if (mode === "braille")
      line += " · dots " + brailleDots.map(function (d) { return d ? "●" : "○"; }).join("");
    if (mode === "jam") line += jamArmed ? " · JAM" : " · arm JAM";
    if (mode === "codec") line += " · " + codecId.toUpperCase();
    statusEl.textContent = line;
    secSummary();
  }

  var lastCodecDisplay = "";

  function runCodec() {
    var text = (buf || "").trim();
    if (!text) {
      if (codecOutEl) codecOutEl.textContent = "— empty buffer · type first —";
      return null;
    }
    var C = window.__mgLangCodec;
    if (!C || !C.transform) {
      if (codecOutEl)
        codecOutEl.textContent =
          "lang-codec-plane missing · inject hotpipe/lang-codec-plane.js";
      return null;
    }
    var view = C.transform(text, codecId, { lang: targetLang, n: 13 });
    var display = view.display || view.stream || view.hex || view.binary || "";
    if (view.grid) display = view.grid + "\n" + display;
    if (view.note) display += "\n· " + view.note;
    if (view.engine) display += "\n· engine " + view.engine;
    lastCodecDisplay = display;
    if (codecOutEl) codecOutEl.textContent = display.slice(0, 1600);
    paintStatus();
    try {
      if (window.ipc)
        window.ipc.postMessage(
          JSON.stringify({ op: "clipboard_copy", text: display })
        );
      else if (navigator.clipboard) navigator.clipboard.writeText(display);
    } catch (e) {}
    log("codec " + codecId + " · " + text.slice(0, 24));
    return view;
  }

  function runDecode() {
    var C = window.__mgLangCodec;
    if (!C || !C.invert) {
      if (codecOutEl) codecOutEl.textContent = "decode needs lang-codec-plane";
      return null;
    }
    var src = lastCodecDisplay || (codecOutEl && codecOutEl.textContent) || buf;
    /* strip note lines */
    src = String(src || "")
      .split("\n")
      .filter(function (ln) {
        return ln && ln.charAt(0) !== "·" && ln.indexOf("engine ") !== 0;
      })
      .join("\n")
      .trim();
    if (!src) {
      if (codecOutEl) codecOutEl.textContent = "— nothing to decode · RUN→ first —";
      return null;
    }
    var back = C.invert(src, codecId);
    buf = String(back || "");
    if (bufEl) bufEl.textContent = buf || "…";
    if (codecOutEl)
      codecOutEl.textContent =
        "DECODE ← " +
        codecId.toUpperCase() +
        "\n" +
        buf.slice(0, 800) +
        (buf.length > 800 ? "…" : "");
    paintStatus();
    log("decode " + codecId + " · " + buf.slice(0, 24));
    return buf;
  }

  function setCodec(id) {
    codecId = id || "hex";
    if (el)
      el.querySelectorAll(".kb-codecs button").forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-codec") === codecId);
      });
    if (mode === "codec") runCodec();
    paintStatus();
    secSummary();
  }

  function mergeAtlas(atlas) {
    if (!atlas || !atlas.layouts) return;
    Object.keys(atlas.layouts).forEach(function (id) {
      var L = atlas.layouts[id];
      if (L && L.rows && L.rows.length) {
        LAYOUTS[id] = {
          id: id,
          lang: L.lang || id,
          label: L.label || id.toUpperCase(),
          rtl: !!L.rtl,
          rows: L.rows,
          braille: !!L.braille,
          source: atlas.ver || "atlas",
        };
      }
    });
    if (el) {
      var langsEl = el.querySelector("#mg-kb-langs");
      if (langsEl) {
        langsEl.innerHTML = "";
        Object.keys(LAYOUTS).forEach(function (id) {
          var b = document.createElement("button");
          b.type = "button";
          b.setAttribute("data-layout", id);
          b.textContent = LAYOUTS[id].label;
          if (id === layoutId) b.className = "on";
          b.onclick = function () {
            setLayout(id);
          };
          langsEl.appendChild(b);
        });
      }
    }
    log(VER + " · atlas merged · layouts " + Object.keys(LAYOUTS).length);
  }

  function loadAtlas() {
    /* 1) pre-injected seed */
    if (window.__mgKeyboardAtlas) {
      mergeAtlas(window.__mgKeyboardAtlas);
      return;
    }
    /* 2) fetch from hotpipe data if same origin / file allow */
    var urls = [
      "hotpipe/data/keyboard-language-atlas.json",
      "./data/keyboard-language-atlas.json",
      "/hotpipe/data/keyboard-language-atlas.json",
    ];
    var i = 0;
    function tryNext() {
      if (i >= urls.length) return;
      var u = urls[i++];
      try {
        fetch(u)
          .then(function (r) {
            if (!r.ok) throw new Error("no");
            return r.json();
          })
          .then(function (j) {
            window.__mgKeyboardAtlas = j;
            mergeAtlas(j);
          })
          .catch(tryNext);
      } catch (e) {
        tryNext();
      }
    }
    tryNext();
  }

  function setMode(m) {
    mode = m || "type";
    if (mode === "braille") {
      layoutId = "braille";
    } else if (layoutId === "braille") {
      layoutId = "qwerty";
    }
    if (mode === "jam") {
      jamArmed = true;
      try {
        if (window.__mgKeyboardBeats) window.__mgKeyboardBeats.open();
      } catch (e) {}
    }
    if (mode === "ddr") armDdr();
    else stopDdr();
    if (el) el.classList.toggle("mode-codec", mode === "codec");
    if (mode === "codec") {
      secOpen.codec = true;
      runCodec();
    }
    rebuildKeys();
    paintModeBtns();
    paintLangBtns();
    paintStatus();
    applySecState();
    log(VER + " · mode " + mode);
  }

  function setLayout(id) {
    if (!LAYOUTS[id]) return;
    layoutId = id;
    if (LAYOUTS[id].lang) targetLang = LAYOUTS[id].lang;
    if (LAYOUTS[id].braille) mode = "braille";
    else if (mode === "braille") mode = "type";
    rebuildKeys();
    paintLangBtns();
    paintModeBtns();
    paintStatus();
    applySecState();
  }

  function setTargetLang(lang) {
    targetLang = lang || "en";
    paintLangBtns();
    paintStatus();
  }

  function paintModeBtns() {
    if (!el) return;
    el.querySelectorAll(".kb-modes button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-mode") === mode);
    });
  }

  function paintLangBtns() {
    if (!el) return;
    el.querySelectorAll(".kb-langs button").forEach(function (b) {
      var id = b.getAttribute("data-layout");
      b.classList.toggle("on", id === layoutId);
    });
    if (el) el.classList.toggle("rtl", !!(layout().rtl));
  }

  function hideKeyPopout() {
    var p = document.getElementById("mg-kb-popout");
    if (p && p.parentNode) p.parentNode.removeChild(p);
  }

  function popoutMenus() {
    try {
      return (
        (window.__mgKeyPopoutMenus && window.__mgKeyPopoutMenus.seedMenus) ||
        null
      );
    } catch (e) {
      return null;
    }
  }

  function showKeyPopout(anchor, keyId, items) {
    hideKeyPopout();
    if (!items || !items.length) return;
    var pop = document.createElement("div");
    pop.id = "mg-kb-popout";
    var h = document.createElement("div");
    h.className = "pop-h";
    h.textContent = String(keyId || "key");
    pop.appendChild(h);
    items.forEach(function (label) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.onclick = function (ev) {
        if (ev) ev.stopPropagation();
        hideKeyPopout();
        try {
          if (window.__mgQbitBus)
            window.__mgQbitBus.publish({
              src: "keys",
              kind: "key-menu",
              lane: "L3",
              prefix: "+0:",
              withGlyph: true,
              payload: { key: keyId, action: label },
            });
        } catch (eP) {}
        /* navigation peeks */
        try {
          if (/jump/i.test(label) && window.__mgJumpStack)
            window.__mgJumpStack.open && window.__mgJumpStack.open();
          if (/page|scroll/i.test(label) && window.__mgToolsDrawer)
            window.__mgToolsDrawer.open && window.__mgToolsDrawer.open();
        } catch (eA) {}
        log("key-menu " + keyId + " · " + label);
      };
      pop.appendChild(b);
    });
    document.body.appendChild(pop);
    var r = anchor.getBoundingClientRect();
    var left = Math.max(8, Math.min(window.innerWidth - 180, r.left));
    var top = Math.min(window.innerHeight - 120, r.bottom + 6);
    pop.style.left = left + "px";
    pop.style.top = top + "px";
    setTimeout(function () {
      document.addEventListener(
        "pointerdown",
        function once(ev) {
          if (pop.contains(ev.target)) return;
          hideKeyPopout();
          document.removeEventListener("pointerdown", once, true);
        },
        true
      );
    }, 0);
  }

  function bindKeyMenu(k, ch) {
    var menus = popoutMenus();
    if (!menus) return;
    var id =
      ch === "CLR"
        ? "clear"
        : ch === "fn"
          ? "fn"
          : ch === "home"
            ? "home"
            : ch === "end"
              ? "end"
              : null;
    /* matrix layout switcher on long-press of first letter key in row0 */
    if (!id && ch && String(ch).toLowerCase() === "q") id = "fn";
    if (!id || !menus[id]) return;
    k.className += " has-menu";
    k.title = (k.title ? k.title + " · " : "") + "long-press menu";
    var hold = 0;
    var armed = false;
    k.addEventListener("pointerdown", function (ev) {
      armed = false;
      hold = setTimeout(function () {
        armed = true;
        showKeyPopout(k, id, menus[id]);
      }, 420);
    });
    k.addEventListener("pointerup", function () {
      clearTimeout(hold);
    });
    k.addEventListener("pointerleave", function () {
      clearTimeout(hold);
    });
    k.addEventListener("click", function (ev) {
      if (armed) {
        ev.preventDefault();
        ev.stopPropagation();
        armed = false;
      }
    });
  }

  function rebuildKeys() {
    if (!rowsEl) return;
    hideKeyPopout();
    rowsEl.innerHTML = "";
    var L = layout();
    var rows = L.rows || LAYOUTS.qwerty.rows;
    rows.forEach(function (row, ri) {
      var rowEl = document.createElement("div");
      rowEl.className = "kb-row";
      if (!L.braille) {
        if (ri === 1) rowEl.style.paddingLeft = "12px";
        if (ri === 2) rowEl.style.paddingLeft = "24px";
      }
      row.forEach(function (ch) {
        var k = document.createElement("button");
        k.type = "button";
        k.className = "kb-key";
        if (ch === "SPC") k.className += " space";
        if (ch === "OK" || ch === "⌫" || ch === "CLR") k.className += " tool wide";
        if (L.braille && ch >= "1" && ch <= "6") {
          k.className += brailleDots[+ch - 1] ? " dot-on" : "";
          k.textContent = ch + (brailleDots[+ch - 1] ? "●" : "○");
        } else {
          k.textContent = ch === "SPC" ? "space" : ch;
        }
        k.setAttribute("data-ch", ch);
        k.onclick = function () {
          pressKey(ch, k);
        };
        bindKeyMenu(k, ch);
        rowEl.appendChild(k);
      });
      if (!L.braille && ri === 2) {
        var bk = document.createElement("button");
        bk.type = "button";
        bk.className = "kb-key wide tool";
        bk.textContent = "⌫";
        bk.onclick = function () {
          pressKey("⌫", bk);
        };
        rowEl.appendChild(bk);
      }
      rowsEl.appendChild(rowEl);
    });
    if (!L.braille) {
      var bot = document.createElement("div");
      bot.className = "kb-row";
      [
        ["CLR", "tool"],
        ["SPC", "space"],
        ["↵", "wide tool"],
      ].forEach(function (pair) {
        var k = document.createElement("button");
        k.type = "button";
        k.className = "kb-key " + pair[1];
        k.textContent = pair[0] === "SPC" ? "space" : pair[0];
        k.onclick = function () {
          pressKey(pair[0], k);
        };
        bindKeyMenu(k, pair[0]);
        bot.appendChild(k);
      });
      rowsEl.appendChild(bot);
    }
  }

  function brailleChar() {
    /* Unicode Braille: U+2800 + bitfield dots 1..6 */
    var bits = 0;
    for (var i = 0; i < 6; i++) if (brailleDots[i]) bits |= 1 << i;
    return String.fromCharCode(0x2800 + bits);
  }

  function commitBraille() {
    var ch = brailleChar();
    if (ch === "\u2800") ch = " "; /* empty → space */
    buf += ch;
    brailleDots = [0, 0, 0, 0, 0, 0];
    if (bufEl) bufEl.textContent = buf || "…";
    rebuildKeys();
    emitHop(ch, null);
  }

  function pressKey(ch, keyEl) {
    if (keyEl) {
      var hue = keyHue(ch, pathPts.length);
      keyEl.style.setProperty("--h", String(hue));
      keyEl.classList.add("lit");
      setTimeout(function () {
        keyEl.classList.remove("lit");
      }, 140);
    }

    /* Braille cell mode */
    if (mode === "braille" || layout().braille) {
      if (ch >= "1" && ch <= "6") {
        var di = +ch - 1;
        brailleDots[di] = brailleDots[di] ? 0 : 1;
        rebuildKeys();
        paintStatus();
        return;
      }
      if (ch === "OK") {
        commitBraille();
        paintStatus();
        return;
      }
      if (ch === "SPC") {
        buf += " ";
        brailleDots = [0, 0, 0, 0, 0, 0];
        if (bufEl) bufEl.textContent = buf || "…";
        rebuildKeys();
        return;
      }
      if (ch === "⌫") {
        buf = buf.slice(0, -1);
        if (bufEl) bufEl.textContent = buf || "…";
        return;
      }
    }

    /* DDR hit test */
    if (mode === "ddr") {
      var need = ddrSeq[ddrIdx];
      if (need && String(ch).toLowerCase() === String(need).toLowerCase()) {
        ddrHits++;
        ddrIdx++;
        if (ddrIdx >= ddrSeq.length) {
          ddrIdx = 0;
          nextDdrPhrase();
        }
        highlightDdr();
        emitHop(ch, keyEl);
        if (bufEl) bufEl.textContent = "HIT · " + ddrHits + "  miss " + ddrMiss;
        paintStatus();
        return;
      } else if (ch.length === 1) {
        ddrMiss++;
        if (bufEl) bufEl.textContent = "MISS · need " + (need || "?");
        paintStatus();
        return;
      }
    }

    if (ch === "⌫") {
      buf = buf.slice(0, -1);
    } else if (ch === "SPC") {
      buf += " ";
    } else if (ch === "CLR") {
      buf = "";
      pathPts = [];
      drawPath();
    } else if (ch === "↵") {
      sendBuf();
      return;
    } else {
      buf += ch;
    }
    if (bufEl) bufEl.textContent = buf || "…";
    emitHop(ch, keyEl);
    paintStatus();
    paintLiveFeeds();
    if (mode === "codec") {
      try {
        runCodec();
      } catch (eC) {}
    }
  }

  function emitHop(ch, keyEl) {
    ch = String(ch || "");
    if (ch === "SPC" || ch === "space") ch = " ";
    var beatCh = ch.length === 1 ? ch.toLowerCase() : "";
    if (beatCh === " ") beatCh = "g";
    try {
      if (window.__mgBlochSolve && window.__mgBlochSolve.onKeyHop && ch && ch.length <= 2)
        window.__mgBlochSolve.onKeyHop(ch);
    } catch (eB) {}
    try {
      /* single path → piano/staff (no document-click double-fire) */
      if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.onKey && beatCh) {
        var nx = 0.5,
          ny = 0.5;
        if (keyEl && el) {
          var r = keyEl.getBoundingClientRect();
          var pr = el.getBoundingClientRect();
          nx = (r.left + r.width / 2 - pr.left) / Math.max(1, pr.width);
          ny = (r.top + r.height / 2 - pr.top) / Math.max(1, pr.height);
        }
        window.__mgKeyboardBeats.onKey(beatCh, nx, ny);
      }
    } catch (eK) {}
    try {
      if (window.__mgMemoryMaze && window.__mgMemoryMaze.ingestKey && beatCh)
        window.__mgMemoryMaze.ingestKey(beatCh, 0.5, 0.5);
    } catch (eM) {}
    /* path for kbatch geometry / pattern flow */
    if (keyEl) {
      var r2 = keyEl.getBoundingClientRect();
      var pr2 = el.getBoundingClientRect();
      pathPts.push({
        x: (r2.left + r2.width / 2 - pr2.left) / pr2.width,
        y: (r2.top + r2.height / 2 - pr2.top) / pr2.height,
        ch: ch,
        t: Date.now(),
        layout: layoutId,
        lang: targetLang,
        mode: mode,
      });
      if (pathPts.length > 96) pathPts.shift();
      drawPath();
      /* contrail observe if available */
      try {
        if (window.__mgContrail && window.__mgContrail.observeAgent) {
          window.__mgContrail.observeAgent(
            r2.left + r2.width / 2,
            r2.top + r2.height / 2,
            pathPts.length,
            0.9
          );
        }
      } catch (eC) {}
    }
    /* jam: broadcast qbpm-live */
    if (mode === "jam" || jamArmed) {
      try {
        var bc = new BroadcastChannel("qbpm-live");
        bc.postMessage({
          type: "kbatch.qbpm.live",
          source: "mg-float-kb-jam",
          ch: ch,
          layout: layoutId,
          lang: targetLang,
          pathN: pathPts.length,
          ts: Date.now(),
        });
        bc.close();
      } catch (eJ) {}
    }
  }

  function keyHue(ch, i) {
    if (!ch || ch.length !== 1) return (i * 28) % 360;
    var c = ch.toLowerCase().charCodeAt(0);
    return ((c - 97) * 14 + i * 7 + 200) % 360;
  }

  function setupFlowCv(cv, fallbackH) {
    if (!cv) return null;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(80, cv.clientWidth || 200);
    var h = Math.max(48, cv.clientHeight || fallbackH || 68);
    cv.width = Math.floor(w * dpr);
    cv.height = Math.floor(h * dpr);
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(4,8,14,0.9)";
    ctx.fillRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  /** Key geometry path — full board space, not a 1-line contrail compress */
  function paintFlowGeom(ctx, W, H) {
    ctx.fillStyle = "rgba(150,180,210,0.55)";
    ctx.font = "600 8px ui-monospace,Menlo,monospace";
    ctx.fillText("GEOM · key path", 5, 11);
    /* soft key grid */
    ctx.strokeStyle = "rgba(80,110,140,0.18)";
    ctx.lineWidth = 1;
    for (var gx = 0; gx <= 10; gx++) {
      ctx.beginPath();
      ctx.moveTo(8 + (gx / 10) * (W - 16), 16);
      ctx.lineTo(8 + (gx / 10) * (W - 16), H - 8);
      ctx.stroke();
    }
    for (var gy = 0; gy <= 3; gy++) {
      ctx.beginPath();
      ctx.moveTo(8, 16 + (gy / 3) * (H - 28));
      ctx.lineTo(W - 8, 16 + (gy / 3) * (H - 28));
      ctx.stroke();
    }
    if (pathPts.length < 1) {
      ctx.fillStyle = "rgba(140,170,190,0.45)";
      ctx.fillText("type keys → pattern", 8, H * 0.55);
      return;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    function xy(p) {
      return {
        x: 8 + Math.max(0, Math.min(1, p.x || 0.5)) * (W - 16),
        y: 18 + Math.max(0, Math.min(1, p.y || 0.5)) * (H - 30),
      };
    }
    var i;
    for (i = 0; i < pathPts.length - 1; i++) {
      var a = xy(pathPts[i]);
      var b = xy(pathPts[i + 1]);
      var hue = keyHue(pathPts[i + 1].ch || pathPts[i].ch, i);
      ctx.strokeStyle = "hsla(" + hue + ",90%,55%,0.18)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (i = 0; i < pathPts.length - 1; i++) {
      a = xy(pathPts[i]);
      b = xy(pathPts[i + 1]);
      hue = keyHue(pathPts[i + 1].ch || pathPts[i].ch, i);
      var fade = 0.4 + 0.6 * ((i + 1) / pathPts.length);
      ctx.strokeStyle = "hsla(" + hue + ",92%,68%," + fade + ")";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    pathPts.forEach(function (p, idx) {
      var pt = xy(p);
      hue = keyHue(p.ch, idx);
      ctx.fillStyle = "hsla(" + hue + ",95%,70%,0.95)";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, idx === pathPts.length - 1 ? 4 : 2.4, 0, Math.PI * 2);
      ctx.fill();
      if (p.ch && pathPts.length < 40) {
        ctx.fillStyle = "rgba(230,240,255,0.75)";
        ctx.font = "600 8px system-ui";
        ctx.fillText(String(p.ch).slice(0, 1), pt.x + 4, pt.y - 4);
      }
    });
  }

  /** Unwind: angle of hop vs time (Neuralink / contrail twin for keyboard) */
  function paintFlowUnwind(ctx, W, H) {
    ctx.fillStyle = "rgba(150,180,210,0.55)";
    ctx.font = "600 8px ui-monospace,Menlo,monospace";
    ctx.fillText("UNWIND · hop∠×t", 5, 11);
    ctx.strokeStyle = "rgba(100,130,160,0.25)";
    ctx.beginPath();
    ctx.moveTo(6, H * 0.55);
    ctx.lineTo(W - 6, H * 0.55);
    ctx.stroke();
    if (pathPts.length < 2) return;
    var n = pathPts.length;
    for (var i = 1; i < n; i++) {
      var p0 = pathPts[i - 1];
      var p1 = pathPts[i];
      var ang = Math.atan2((p1.y || 0.5) - (p0.y || 0.5), (p1.x || 0.5) - (p0.x || 0.5));
      var x = 8 + ((i - 1) / Math.max(1, n - 2)) * (W - 16);
      var y = H * 0.55 - (ang / Math.PI) * (H * 0.32);
      var hue = keyHue(p1.ch, i);
      ctx.fillStyle = "hsla(" + hue + ",90%,62%,0.9)";
      ctx.fillRect(x, y, 2.5, 2.5);
    }
  }

  /** Sequence composer: last keys as vertical/time strip with dwell */
  function paintFlowSeq(ctx, W, H) {
    ctx.fillStyle = "rgba(150,180,210,0.55)";
    ctx.font = "600 8px ui-monospace,Menlo,monospace";
    ctx.fillText("SEQ · phrase", 5, 11);
    if (!pathPts.length) return;
    var recent = pathPts.slice(-16);
    var cellW = (W - 12) / Math.max(1, recent.length);
    recent.forEach(function (p, i) {
      var hue = keyHue(p.ch, i);
      var x = 6 + i * cellW;
      var dwell = 0.35 + 0.65 * ((i + 1) / recent.length);
      ctx.fillStyle = "hsla(" + hue + ",85%,50%," + (0.25 + dwell * 0.5) + ")";
      var barH = 14 + dwell * (H - 36);
      ctx.fillRect(x + 1, H - 8 - barH, Math.max(2, cellW - 3), barH);
      ctx.fillStyle = "rgba(240,246,255,0.9)";
      ctx.font = "700 9px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(String(p.ch || "·").slice(0, 1), x + cellW / 2, H - 12 - barH);
    });
    ctx.textAlign = "left";
  }

  function drawPath() {
    var geom = el && el.querySelector("#mg-kb-flow-geom");
    var unwind = el && el.querySelector("#mg-kb-flow-unwind");
    var seq = el && el.querySelector("#mg-kb-flow-seq");
    var beat = el && el.querySelector("#mg-kb-flow-beat");
    var meta = el && el.querySelector("#mg-kb-flow-meta");
    pathCv = geom || pathCv;

    var g = setupFlowCv(geom, 72);
    if (g) paintFlowGeom(g.ctx, g.w, g.h);
    var u = setupFlowCv(unwind, 72);
    if (u) paintFlowUnwind(u.ctx, u.w, u.h);
    var s = setupFlowCv(seq, 72);
    if (s) paintFlowSeq(s.ctx, s.w, s.h);

    if (meta) {
      meta.textContent =
        pathPts.length +
        " hops" +
        (pathPts.length
          ? " · «" +
            pathPts
              .slice(-12)
              .map(function (p) {
                return p.ch || "";
              })
              .join("") +
            "»"
          : "");
    }
    if (beat) {
      if (!pathPts.length) beat.textContent = "pattern idle · type to paint flow";
      else {
        var last = pathPts[pathPts.length - 1];
        var phrase = pathPts
          .slice(-8)
          .map(function (p) {
            return p.ch || "";
          })
          .join("");
        beat.textContent =
          "last " +
          (last.ch || "?") +
          " @ " +
          Math.round((last.x || 0) * 100) +
          "%," +
          Math.round((last.y || 0) * 100) +
          "% · «" +
          phrase +
          "»";
      }
    }
  }

  /* ── DDR ── */
  function nextDdrPhrase() {
    var pool = "asdfjkl;qweruiop".split("");
    ddrSeq = [];
    var n = 4 + Math.floor(Math.random() * 4);
    for (var i = 0; i < n; i++)
      ddrSeq.push(pool[Math.floor(Math.random() * pool.length)]);
    ddrIdx = 0;
    highlightDdr();
  }

  function highlightDdr() {
    if (!rowsEl) return;
    rowsEl.querySelectorAll(".kb-key").forEach(function (k) {
      k.classList.remove("ddr-target");
      var ch = k.getAttribute("data-ch") || k.textContent;
      if (ddrSeq[ddrIdx] && String(ch).toLowerCase() === String(ddrSeq[ddrIdx]).toLowerCase())
        k.classList.add("ddr-target");
    });
  }

  function armDdr() {
    stopDdr();
    nextDdrPhrase();
    var bpm = 96;
    try {
      if (window.__mgKeyboardBeats && window.__mgKeyboardBeats.bpm)
        bpm = window.__mgKeyboardBeats.bpm() || 96;
    } catch (e) {}
    ddrTimer = setInterval(function () {
      if (mode !== "ddr" || !open) return;
      /* timeout miss */
      ddrMiss++;
      ddrIdx++;
      if (ddrIdx >= ddrSeq.length) nextDdrPhrase();
      else highlightDdr();
      paintStatus();
    }, Math.max(400, 60000 / Math.max(40, bpm)));
  }

  function stopDdr() {
    if (ddrTimer) {
      clearInterval(ddrTimer);
      ddrTimer = null;
    }
  }

  function analyzeBuf() {
    var text = (buf || "").trim();
    if (!text && pathPts.length) {
      text = pathPts
        .map(function (p) {
          return p.ch;
        })
        .join("");
    }
    if (!text) {
      log("empty buffer");
      return;
    }
    var L = layout();
    var u =
      "https://kbatch.ugrad.ai/?q=" +
      encodeURIComponent(text) +
      "&layout=" +
      encodeURIComponent(L.id) +
      "&lang=" +
      encodeURIComponent(targetLang) +
      "&mode=" +
      encodeURIComponent(mode) +
      "&from=mg-float-kb";
    nav(u);
    try {
      var payload = {
        type: "kbatch-blank-bridge",
        schema: "kbatch-blank-v2",
        source: "mg-float-kb",
        text: text,
        layout: L.id,
        lang: targetLang,
        mode: mode,
        path: pathPts.slice(),
        braille: mode === "braille",
        ts: Date.now(),
      };
      var bc = new BroadcastChannel("kbatch-blank");
      bc.postMessage(payload);
      bc.close();
    } catch (e) {}
    /* dojo phrase if available */
    try {
      if (window.__mgKbatchDojo && window.__mgKbatchDojo.runPhrase) {
        window.__mgKbatchDojo.runPhrase(text, { seed: text }).then(function (rep) {
          if (rep && statusEl)
            statusEl.textContent =
              "dojo strain " + (rep.strain != null ? rep.strain : "—") + " · " + text.slice(0, 24);
        });
      }
    } catch (eD) {}
    log("analyze «" + text.slice(0, 32) + "» " + L.id + "→" + targetLang);
  }

  function sendBuf() {
    var text = buf;
    if (!text) return;
    try {
      if (window.ipc)
        window.ipc.postMessage(JSON.stringify({ op: "clipboard_copy", text: text }));
      else if (navigator.clipboard) navigator.clipboard.writeText(text);
    } catch (e) {}
    try {
      var ae = document.activeElement;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) {
        if (ae.isContentEditable) ae.textContent = (ae.textContent || "") + text;
        else ae.value = (ae.value || "") + text;
      }
    } catch (e2) {}
    /* mesh chat if jam/collab */
    try {
      if (window.__mgSearchComms && window.__mgSearchComms.sendChat)
        window.__mgSearchComms.sendChat(text);
    } catch (e3) {}
    log("send «" + text.slice(0, 40) + "»");
  }

  function exportState() {
    return {
      ver: VER,
      layout: layoutId,
      mode: mode,
      lang: targetLang,
      buf: buf,
      path: pathPts.slice(),
      ddr: { hits: ddrHits, miss: ddrMiss },
      brailleDots: brailleDots.slice(),
    };
  }

  function mount() {
    ensureCss();
    if (document.getElementById("mg-float-kb")) {
      try {
        if (window.__mgFloatKb && window.__mgFloatKb.ver !== VER) {
          var oldKb = document.getElementById("mg-float-kb");
          if (oldKb && oldKb.parentNode) oldKb.parentNode.removeChild(oldKb);
        } else return;
      } catch (eR) {
        return;
      }
    }
    el = document.createElement("div");
    el.id = "mg-float-kb";
    el.className = "hidden opts-collapsed";
    el.innerHTML =
      '<div class="kb-top">' +
      '  <div class="ttl">Keyboard</div>' +
      '  <div class="kb-tools" id="mg-kb-tools-mini"></div>' +
      "</div>" +
      '<div class="kb-buf" id="mg-kb-buf">…</div>' +
      '<div class="kb-status" id="mg-kb-status">TYPE · EN</div>' +
      /* collapsible options — collapsed by default so keys get height */
      '<div class="kb-sec" id="mg-sec-mode">' +
      '  <div class="kb-sec-hd"><span class="kb-sec-ttl">Mode</span>' +
      '  <span class="kb-sec-sum">TYPE</span><button type="button" class="kb-chev">▸</button></div>' +
      '  <div class="kb-sec-body"><div class="kb-modes" id="mg-kb-modes"></div></div>' +
      "</div>" +
      '<div class="kb-sec" id="mg-sec-lang">' +
      '  <div class="kb-sec-hd"><span class="kb-sec-ttl">Layout · lang</span>' +
      '  <span class="kb-sec-sum">EN QWERTY</span><button type="button" class="kb-chev">▸</button></div>' +
      '  <div class="kb-sec-body"><div class="kb-langs" id="mg-kb-langs"></div></div>' +
      "</div>" +
      '<div class="kb-sec" id="mg-sec-codec">' +
      '  <div class="kb-sec-hd"><span class="kb-sec-ttl">Codec · live feed</span>' +
      '  <span class="kb-sec-sum">feeds · codecs</span><button type="button" class="kb-chev">▸</button></div>' +
      '  <div class="kb-sec-body">' +
      '    <div class="kb-codecs" id="mg-kb-codecs"></div>' +
      '    <div class="kb-live-feeds" id="mg-kb-live-feeds">' +
      '      <div class="feed" data-f="ascii"><div class="fk">ASCII</div><div class="fv">—</div></div>' +
      '      <div class="feed" data-f="hex"><div class="fk">HEX</div><div class="fv">—</div></div>' +
      '      <div class="feed" data-f="bin"><div class="fk">BIN</div><div class="fv">—</div></div>' +
      '      <div class="feed" data-f="glyph"><div class="fk">GLYPH</div><div class="fv">—</div></div>' +
      "    </div>" +
      '    <div class="kb-codec-out" id="mg-kb-codec-out">codec output…</div>' +
      "  </div>" +
      "</div>" +
      '<div class="kb-sec" id="mg-sec-tools">' +
      '  <div class="kb-sec-hd"><span class="kb-sec-ttl">Tools</span>' +
      '  <span class="kb-sec-sum">kbatch · dojo</span><button type="button" class="kb-chev">▸</button></div>' +
      '  <div class="kb-sec-body"><div class="kb-tools" id="mg-kb-tools" style="flex-wrap:wrap"></div></div>' +
      "</div>" +
      '<div class="kb-keys-wrap">' +
      '  <div class="kb-rows" id="mg-kb-rows"></div>' +
      '  <div class="kb-flow" id="mg-kb-flow">' +
      '    <div class="kb-flow-hd"><span>Pattern flow</span>' +
      '    <span class="kb-flow-meta" id="mg-kb-flow-meta">0 hops</span></div>' +
      '    <div class="kb-flow-row">' +
      '      <canvas id="mg-kb-flow-geom" title="key geometry path" aria-label="pattern geometry"></canvas>' +
      '      <canvas id="mg-kb-flow-unwind" title="hop angle over time" aria-label="pattern unwind"></canvas>' +
      '      <canvas id="mg-kb-flow-seq" title="phrase sequence" aria-label="pattern sequence"></canvas>' +
      "    </div>" +
      '    <div class="kb-flow-leg">' +
      '      <span><i style="background:hsla(190,90%,60%,0.9)"></i>path</span>' +
      '      <span><i style="background:hsla(280,85%,65%,0.9)"></i>angle</span>' +
      '      <span><i style="background:hsla(40,90%,60%,0.9)"></i>phrase</span>' +
      '      <span>under keys · not contrail compress</span>' +
      "    </div>" +
      '    <div class="kb-flow-beat" id="mg-kb-flow-beat">pattern idle · type to paint flow</div>' +
      "  </div>" +
      "</div>";
    (document.body || document.documentElement).appendChild(el);
    bufEl = el.querySelector("#mg-kb-buf");
    pathCv = el.querySelector("#mg-kb-flow-geom");
    statusEl = el.querySelector("#mg-kb-status");
    rowsEl = el.querySelector("#mg-kb-rows");
    codecOutEl = el.querySelector("#mg-kb-codec-out");
    try {
      drawPath();
    } catch (eFlow) {}

    /* mini bar: expand-all options + close */
    var mini = el.querySelector("#mg-kb-tools-mini");
    var optBtn = document.createElement("button");
    optBtn.type = "button";
    optBtn.textContent = "OPTS";
    optBtn.title = "Toggle all option sections";
    optBtn.onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      var any = secOpen.mode || secOpen.lang || secOpen.codec || secOpen.tools;
      secOpen.mode = secOpen.lang = secOpen.codec = secOpen.tools = !any;
      applySecState();
      optBtn.classList.toggle("on", !any);
    };
    mini.appendChild(optBtn);
    var hide = document.createElement("button");
    hide.type = "button";
    hide.className = "kb-x";
    hide.textContent = "×";
    hide.title = "Close keyboard";
    hide.onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      setOpen(false);
      log(VER + " · closed via ×");
    };
    mini.appendChild(hide);

    var tools = el.querySelector("#mg-kb-tools");
    TOOLS.forEach(function (T) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = T.label;
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        if (T.url) nav(T.url);
        else if (T.fn) T.fn();
      };
      tools.appendChild(b);
    });

    bindSec("mode");
    bindSec("lang");
    bindSec("codec");
    bindSec("tools");

    var modesEl = el.querySelector("#mg-kb-modes");
    MODES.forEach(function (M) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-mode", M.id);
      b.title = M.title;
      b.textContent = M.label;
      if (M.id === "type") b.className = "on";
      b.onclick = function (ev) {
        if (ev) ev.stopPropagation();
        setMode(M.id);
      };
      modesEl.appendChild(b);
    });

    var langsEl = el.querySelector("#mg-kb-langs");
    Object.keys(LAYOUTS).forEach(function (id) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-layout", id);
      b.textContent = LAYOUTS[id].label;
      if (id === "qwerty") b.className = "on";
      b.onclick = function (ev) {
        if (ev) ev.stopPropagation();
        setLayout(id);
      };
      langsEl.appendChild(b);
    });

    var codecsEl = el.querySelector("#mg-kb-codecs");
    CODECS.forEach(function (C) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-codec", C.id);
      b.textContent = C.label;
      if (C.id === "hex") b.className = "on";
      b.onclick = function () {
        setCodec(C.id);
      };
      codecsEl.appendChild(b);
    });
    var runB = document.createElement("button");
    runB.type = "button";
    runB.textContent = "RUN→";
    runB.title = "Encode buffer through codec";
    runB.onclick = function () {
      runCodec();
    };
    codecsEl.appendChild(runB);
    var decB = document.createElement("button");
    decB.type = "button";
    decB.textContent = "←DEC";
    decB.title = "Decode last codec output back to buffer";
    decB.onclick = function () {
      runDecode();
    };
    codecsEl.appendChild(decB);
    var allB = document.createElement("button");
    allB.type = "button";
    allB.textContent = "ALL";
    allB.title = "Run all codec views";
    allB.onclick = function () {
      var C = window.__mgLangCodec;
      if (!C || !C.allViews) return runCodec();
      var text = (buf || "").trim();
      if (!text) return;
      var views = C.allViews(text);
      var lines = [];
      Object.keys(views).forEach(function (k) {
        var v = views[k];
        lines.push(
          "── " +
            k.toUpperCase() +
            " ──\n" +
            String((v && (v.display || v.stream || v.hex)) || "").slice(0, 200)
        );
      });
      lastCodecDisplay = lines.join("\n");
      if (codecOutEl) codecOutEl.textContent = lastCodecDisplay.slice(0, 2000);
    };
    codecsEl.appendChild(allB);

    rebuildKeys();
    loadAtlas();
    applySecState(); /* sections collapsed → keys get height */
    /* URL launch: ?mg_kb=1 | ?mg_kb=codec | ?mg_kb=jam */
    var autoKb = false;
    try {
      var m = /[?&]mg_kb=([^&]*)/i.exec(location.search || "");
      if (m) {
        autoKb = true;
        var v = decodeURIComponent(m[1] || "1").toLowerCase();
        if (v === "codec" || v === "hex")
          setTimeout(function () {
            window.__mgFloatKb.launch({
              mode: "codec",
              codec: "hex",
              text: "hello MG codec",
            });
          }, 400);
        else if (v === "jam")
          setTimeout(function () {
            window.__mgFloatKb.launch({ mode: "jam" });
          }, 400);
        else if (v === "braille" || v === "br8")
          setTimeout(function () {
            window.__mgFloatKb.launch({ mode: "braille" });
          }, 400);
        else if (v === "ddr")
          setTimeout(function () {
            window.__mgFloatKb.launch({ mode: "ddr" });
          }, 400);
        else
          setTimeout(function () {
            window.__mgFloatKb.launch({ mode: "type" });
          }, 400);
      }
    } catch (eA) {}
    if (!autoKb) setOpen(false);
    measure();
    window.addEventListener("resize", measure);
    log(
      VER +
        " · lang/jam/codec plane · layouts " +
        Object.keys(LAYOUTS).length +
        " · " +
        (window.__mgLangCodec ? window.__mgLangCodec.report() : "codec-pending") +
        " · QbitCodec=" +
        !!(window.QbitCodec && window.QbitCodec.encode) +
        (autoKb ? " · auto-launch" : "")
    );
  }

  function unembed() {
    if (!el || !el.classList.contains("mg-embedded")) return;
    el.classList.remove("mg-embedded");
    el.style.position = "";
    el.style.width = "";
    el.style.maxHeight = "";
    el.style.minHeight = "";
    el.style.zIndex = "";
    el.style.margin = "";
    (document.body || document.documentElement).appendChild(el);
    if (!open) el.classList.add("hidden");
  }

  function embedInto(host) {
    if (!host) return false;
    if (!el || !document.getElementById("mg-float-kb")) mount();
    el = document.getElementById("mg-float-kb");
    if (!el) return false;
    host.appendChild(el);
    el.classList.add("mg-embedded");
    el.classList.remove("hidden");
    el.classList.remove("mg-product-ghost");
    open = true;
    /* collapse option sections so key deck has full height (CTRL-grade stack) */
    secOpen.mode = false;
    secOpen.lang = false;
    secOpen.codec = false;
    secOpen.tools = false;
    try {
      applySecState();
      paintRows();
      paintLiveFeeds();
      measure();
    } catch (e) {}
    return true;
  }

  window.__mgFloatKb = {
    ver: VER,
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: function () {
      setOpen(!open);
    },
    isOpen: function () {
      return open;
    },
    embedInto: embedInto,
    unembed: unembed,
    buffer: function () {
      return buf;
    },
    setBuffer: function (t) {
      buf = String(t || "");
      if (bufEl) bufEl.textContent = buf || "…";
      paintLiveFeeds();
      if (mode === "codec") {
        try {
          runCodec();
        } catch (e) {}
      }
    },
    paintLiveFeeds: paintLiveFeeds,
    setMode: setMode,
    setLayout: setLayout,
    setTargetLang: setTargetLang,
    layouts: function () {
      return Object.keys(LAYOUTS);
    },
    report: function () {
      var n = Object.keys(LAYOUTS).length;
      var mx = 0;
      Object.keys(LAYOUTS).forEach(function (id) {
        if (id.indexOf("mx_") === 0) mx++;
      });
      return (
        VER +
        " open=" +
        (open ? "1" : "0") +
        " layouts=" +
        n +
        " matrix=" +
        mx +
        " layout=" +
        layoutId +
        " popout=" +
        (popoutMenus() ? "1" : "0")
      );
    },
    modes: function () {
      return MODES.map(function (m) {
        return m.id;
      });
    },
    r4Langs: function () {
      return R4_LANGS.slice();
    },
    path: function () {
      return pathPts.slice();
    },
    exportState: exportState,
    analyze: analyzeBuf,
    setCodec: setCodec,
    runCodec: runCodec,
    runDecode: runDecode,
    loadAtlas: loadAtlas,
    mergeAtlas: mergeAtlas,
    codec: function () {
      return codecId;
    },
    /** Launch keyboard open in codec or type mode */
    launch: function (opts) {
      opts = opts || {};
      setOpen(true);
      if (opts.mode) setMode(opts.mode);
      if (opts.layout) setLayout(opts.layout);
      if (opts.codec) {
        setMode("codec");
        setCodec(opts.codec);
        secOpen.codec = true;
      }
      if (opts.expand) {
        secOpen.mode = secOpen.lang = secOpen.codec = secOpen.tools = true;
      }
      if (opts.text) {
        buf = String(opts.text);
        if (bufEl) bufEl.textContent = buf;
        if (opts.codec || mode === "codec") runCodec();
      }
      paintLiveFeeds();
      applySecState();
      return exportState();
    },
    setSections: function (map) {
      if (!map) return;
      Object.keys(map).forEach(function (k) {
        if (secOpen.hasOwnProperty(k)) secOpen[k] = !!map[k];
      });
      applySecState();
    },
    /** Standalone plane for patients / makers — no MG shell required */
    standalone: {
      ver: VER,
      press: function (ch) {
        pressKey(ch, null);
      },
      getBuffer: function () {
        return buf;
      },
      clear: function () {
        buf = "";
        pathPts = [];
        if (bufEl) bufEl.textContent = "…";
      },
      transform: function (format) {
        if (window.__mgLangCodec)
          return window.__mgLangCodec.transform(buf, format || codecId, {
            lang: targetLang,
          });
        return null;
      },
    },
    report: function () {
      return (
        VER +
        " open=" +
        open +
        " mode=" +
        mode +
        " layout=" +
        layoutId +
        " lang=" +
        targetLang +
        " codec=" +
        codecId +
        " buf=" +
        buf.length +
        " path=" +
        pathPts.length +
        (mode === "ddr" ? " ddr=" + ddrHits + "/" + ddrMiss : "")
      );
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    setTimeout(mount, 80);
  }
})();
