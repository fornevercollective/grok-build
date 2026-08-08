/**
 * Memory Glass · Language translation hotpipe
 *
 * Fans one keyboard source into **all** language-plane options:
 *   · __mgLangCodec formats: ascii · hex · binary · pcap · gutter · steno · glyph · qbit
 *   · float-keyboard layouts / atlas langs
 *   · translate targets (mirrors TUI /language offline map)
 *   · rubik-language hooks when present
 *
 * Bus:
 *   BroadcastChannel("fc-language-streams")
 *   postMessage { source: "fc-language-hotpipe", payload }
 *   pack: ~/.panda/packs/language-hotpipe.jsonl  (or /language-hotpipe.jsonl)
 *
 * Ingress:
 *   { type: "language.source", text, mode?, lang?, layout? }
 *   { type: "language.key", ch }
 *   { type: "language.clear" }
 *   { type: "language.mode", mode: "all"|"layout"|"translate"|"codec" }
 *
 * Egress (every fanout):
 *   { type: "language.fanout", ver, text, mode, codecs: {ascii,hex,...}, layouts:{},
 *     translate:{}, atlasLangs:[], t }
 *
 * VER: language-hotpipe-v1
 */
(function () {
  "use strict";
  var VER = "language-hotpipe-v1";
  var CH = "fc-language-streams";
  var PACK_PATHS = [
    "/language-hotpipe.jsonl",
    "http://127.0.0.1:9876/language-hotpipe.jsonl",
  ];
  try {
    if (typeof location !== "undefined" && location.origin) {
      PACK_PATHS.unshift(location.origin + "/language-hotpipe.jsonl");
    }
  } catch (e0) {}

  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._languageHotpipeVer === VER) return;
  HP._languageHotpipeVer = VER;

  var lastText = "";
  var mode = "all";
  var lastPackSize = 0;
  var bc = null;
  try {
    bc = new BroadcastChannel(CH);
  } catch (eBc) {
    bc = null;
  }

  var TRANSLATE_LANGS = ["es", "fr", "de", "ja", "zh", "ko", "pt", "it", "ru", "ar", "hi"];
  var OFFLINE = {
    hello: {
      es: "hola",
      fr: "bonjour",
      de: "hallo",
      ja: "こんにちは",
      zh: "你好",
      ko: "안녕하세요",
      pt: "olá",
      it: "ciao",
      ru: "привет",
      ar: "مرحبا",
      hi: "नमस्ते",
    },
    "thank you": {
      es: "gracias",
      fr: "merci",
      de: "danke",
      ja: "ありがとう",
      zh: "谢谢",
    },
    yes: { es: "sí", fr: "oui", de: "ja" },
    no: { es: "no", fr: "non", de: "nein" },
    help: { es: "ayuda", fr: "aide", de: "hilfe" },
  };

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "language-hotpipe");
    } catch (e) {}
  }

  function offlineWord(word, lang) {
    var k = String(word || "")
      .trim()
      .toLowerCase();
    var row = OFFLINE[k];
    return row && row[lang] ? row[lang] : word;
  }

  function offlineTranslate(text, lang) {
    if (!text) return "";
    var whole = OFFLINE[String(text).trim().toLowerCase()];
    if (whole && whole[lang]) return whole[lang];
    return String(text)
      .split(/\s+/)
      .map(function (w) {
        return offlineWord(w, lang);
      })
      .join(" ");
  }

  function codecFanout(text) {
    var out = {};
    var LC = window.__mgLangCodec;
    if (LC && typeof LC.allViews === "function") {
      try {
        var views = LC.allViews(text) || {};
        Object.keys(views).forEach(function (f) {
          var v = views[f];
          if (v && typeof v === "object") {
            out[f] =
              v.display != null
                ? String(v.display)
                : v.hex != null
                  ? String(v.hex)
                  : v.text != null
                    ? String(v.text)
                    : JSON.stringify(v).slice(0, 200);
          } else {
            out[f] = String(v);
          }
        });
        return out;
      } catch (e) {}
    }
    // lite fallback
    out.ascii = String(text || "")
      .split("")
      .map(function (c) {
        return ("00" + c.charCodeAt(0)).slice(-3);
      })
      .join(" ");
    out.hex = Array.from(new TextEncoder().encode(String(text || "")))
      .map(function (b) {
        return ("0" + b.toString(16)).slice(-2);
      })
      .join(" ");
    out.binary = out.hex
      .split(" ")
      .map(function (h) {
        return parseInt(h || "0", 16).toString(2).padStart(8, "0");
      })
      .join(" ");
    out.steno = String(text || "").replace(/[a-zA-Z]/g, "·");
    out.glyph = out.hex;
    out.gutter = out.hex;
    out.pcap = "PCAP-lite " + (text || "").length + "B";
    out.qbit = "qbit-lite:" + out.hex.slice(0, 32);
    return out;
  }

  function layoutFanout(text) {
    var out = {};
    var FK = window.__mgFloatKb;
    // Prefer float-keyboard if it exposes layout maps
    if (FK && typeof FK.mapText === "function") {
      try {
        var ids = FK.layouts || FK.layoutIds || [];
        if (Array.isArray(ids)) {
          ids.forEach(function (id) {
            try {
              out[id] = FK.mapText(text, id);
            } catch (e1) {
              out[id] = text;
            }
          });
        }
      } catch (e2) {}
    }
    // Atlas seed
    try {
      var atlas = window.__mgKeyboardAtlas || window.__mgKbAtlas;
      if (atlas && atlas.layouts) {
        Object.keys(atlas.layouts).forEach(function (id) {
          if (out[id]) return;
          var L = atlas.layouts[id];
          if (L && L.map && typeof L.map === "object") {
            out[id] = String(text || "")
              .split("")
              .map(function (ch) {
                return L.map[ch] || L.map[ch.toLowerCase()] || ch;
              })
              .join("");
          } else if (L && typeof L === "string") {
            out[id] = text;
          } else {
            out[id] = text;
          }
        });
      }
    } catch (e3) {}
    // Built-in demos if still empty
    if (!Object.keys(out).length) {
      out.qwerty = text;
      out.ru = text; // full remap lives in TUI; hotpipe prefers atlas/FK
    }
    return out;
  }

  function translateFanout(text) {
    var out = {};
    TRANSLATE_LANGS.forEach(function (lang) {
      out[lang] = offlineTranslate(text, lang);
    });
    return out;
  }

  function updateFloatKeyboardFeeds(text, codecs) {
    try {
      var root = document.getElementById("mg-kb-live-feeds");
      if (!root) return;
      // Ensure a feed chip exists for every codec option
      Object.keys(codecs || {}).forEach(function (f) {
        var el = root.querySelector('.feed[data-f="' + f + '"]');
        if (!el) {
          el = document.createElement("div");
          el.className = "feed";
          el.setAttribute("data-f", f);
          el.innerHTML =
            '<div class="fk">' +
            f.toUpperCase() +
            '</div><div class="fv">—</div>';
          root.appendChild(el);
        }
        var fv = el.querySelector(".fv");
        if (fv) {
          var s = String(codecs[f] || "—");
          fv.textContent = s.length > 80 ? s.slice(0, 77) + "…" : s;
          fv.title = s;
        }
      });
      // codec out pane
      var out = document.getElementById("mg-kb-codec-out");
      if (out && codecs) {
        var lines = Object.keys(codecs).map(function (k) {
          return k + ": " + codecs[k];
        });
        out.textContent = lines.join("\n");
      }
      // buffer mirror
      var buf = document.getElementById("mg-kb-buf");
      if (buf && text != null) buf.textContent = text || "…";
    } catch (e) {}
  }

  function pushFloatKeyboard(text) {
    try {
      var FK = window.__mgFloatKb;
      if (!FK) return;
      if (typeof FK.setBuf === "function") FK.setBuf(text);
      else if (typeof FK.setText === "function") FK.setText(text);
      else if (FK.standalone && typeof FK.standalone.setBuf === "function") {
        FK.standalone.setBuf(text);
      }
    } catch (e) {}
  }

  function rubikHook(text, fanout) {
    try {
      if (window.__mgRubikLang && typeof window.__mgRubikLang.onLanguageFanout === "function") {
        window.__mgRubikLang.onLanguageFanout({ text: text, fanout: fanout });
      }
    } catch (e) {}
  }

  function fanout(text, opts) {
    opts = opts || {};
    text = String(text == null ? "" : text);
    if (opts.mode) mode = opts.mode;
    lastText = text;

    var codecs = mode === "layout" ? {} : codecFanout(text);
    var layouts = mode === "translate" || mode === "codec" ? {} : layoutFanout(text);
    var translate = mode === "layout" || mode === "codec" ? {} : translateFanout(text);

    // mode filters for "all" keep everything
    if (mode === "all") {
      codecs = codecFanout(text);
      layouts = layoutFanout(text);
      translate = translateFanout(text);
    }

    var payload = {
      type: "language.fanout",
      ver: VER,
      text: text,
      mode: mode,
      codecs: codecs,
      layouts: layouts,
      translate: translate,
      formats: window.__mgLangCodec
        ? (window.__mgLangCodec.formats || []).slice()
        : Object.keys(codecs),
      atlasLangs: Object.keys(layouts),
      t: Date.now(),
    };

    updateFloatKeyboardFeeds(text, codecs);
    pushFloatKeyboard(text);
    rubikHook(text, payload);

    // bus out
    try {
      if (bc) bc.postMessage(payload);
    } catch (e1) {}
    try {
      window.postMessage({ source: "fc-language-hotpipe", payload: payload }, "*");
    } catch (e2) {}
    try {
      window.dispatchEvent(
        new CustomEvent("fc-language-fanout", { detail: payload })
      );
    } catch (e3) {}

    // store last for UI / TUI poll
    try {
      window.__mgLanguageLast = payload;
      localStorage.setItem("fc.language.last", JSON.stringify({
        text: text,
        mode: mode,
        t: payload.t,
        codecs: codecs,
        translate: translate,
      }));
    } catch (e4) {}

    return payload;
  }

  function ingest(msg) {
    if (!msg || typeof msg !== "object") return;
    var type = msg.type || (msg.payload && msg.payload.type);
    var body = msg.payload && msg.payload.type ? msg.payload : msg;
    if (!type && body) type = body.type;
    if (!type) return;

    if (type === "language.source" || type === "language.set") {
      fanout(body.text != null ? body.text : body.source || "", {
        mode: body.mode || mode,
      });
      if (body.layout && window.__mgFloatKb && window.__mgFloatKb.setLayout) {
        try {
          window.__mgFloatKb.setLayout(body.layout);
        } catch (e) {}
      }
      return;
    }
    if (type === "language.key") {
      var ch = body.ch != null ? body.ch : body.key;
      fanout(lastText + (ch != null ? String(ch) : ""), { mode: mode });
      return;
    }
    if (type === "language.clear") {
      fanout("", { mode: mode });
      return;
    }
    if (type === "language.mode") {
      mode = body.mode || mode;
      fanout(lastText, { mode: mode });
      return;
    }
    if (type === "language.fanout") {
      // remote fanout — update local UI only
      if (body.codecs) updateFloatKeyboardFeeds(body.text || "", body.codecs);
      if (body.text != null) pushFloatKeyboard(body.text);
      lastText = body.text || lastText;
      return;
    }
  }

  function pollPack() {
    PACK_PATHS.forEach(function (url) {
      fetch(url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now(), {
        cache: "no-store",
      })
        .then(function (r) {
          return r.ok ? r.text() : "";
        })
        .then(function (txt) {
          if (!txt) return;
          // full file rewrite style: process last non-empty line
          var lines = txt.trim().split("\n");
          var last = lines[lines.length - 1];
          if (!last) return;
          try {
            ingest(JSON.parse(last));
          } catch (e) {}
        })
        .catch(function () {});
    });
  }

  // Listeners
  if (bc) {
    bc.onmessage = function (ev) {
      if (ev && ev.data) ingest(ev.data);
    };
  }
  window.addEventListener("message", function (ev) {
    var d = ev.data;
    if (!d) return;
    if (d.source === "fc-language-hotpipe" && d.payload) {
      ingest(d.payload);
      return;
    }
    if (d.type && String(d.type).indexOf("language.") === 0) ingest(d);
  });

  // Hook float-keyboard typing → fanout all options
  function hookFloatKb() {
    try {
      var FK = window.__mgFloatKb;
      if (!FK || FK._langHotpipeHooked) return;
      FK._langHotpipeHooked = true;
      var prev = FK.onType || FK.onKey || null;
      var wrap = function (ch, meta) {
        try {
          var buf =
            (FK.exportState && FK.exportState().buf) ||
            (document.getElementById("mg-kb-buf") &&
              document.getElementById("mg-kb-buf").textContent) ||
            lastText;
          if (ch && buf === lastText) buf = lastText + ch;
          fanout(buf === "…" ? "" : buf, { mode: mode });
        } catch (e) {}
        if (typeof prev === "function") prev(ch, meta);
      };
      if (typeof FK.on === "function") {
        FK.on("type", function (ev) {
          var buf = (ev && ev.buf) || lastText;
          fanout(buf, { mode: mode });
        });
      }
      FK.onType = wrap;
      // poll buffer while open
      setInterval(function () {
        try {
          if (!document.getElementById("mg-float-kb")) return;
          var st = FK.exportState && FK.exportState();
          if (st && st.buf != null && st.buf !== lastText) {
            fanout(st.buf, { mode: mode });
          }
        } catch (e2) {}
      }, 400);
    } catch (e) {}
  }

  setInterval(hookFloatKb, 1500);
  setInterval(pollPack, 700);
  hookFloatKb();

  window.__mgLanguageHotpipe = {
    ver: VER,
    channel: CH,
    fanout: fanout,
    ingest: ingest,
    setMode: function (m) {
      mode = m || mode;
      fanout(lastText, { mode: mode });
    },
    getLast: function () {
      return window.__mgLanguageLast || null;
    },
    formats: function () {
      return window.__mgLangCodec
        ? (window.__mgLangCodec.formats || []).slice()
        : ["ascii", "hex", "binary", "pcap", "gutter", "steno", "glyph", "qbit"];
    },
    allOptions: function (text) {
      return fanout(text != null ? text : lastText, { mode: "all" });
    },
  };

  // URL auto-launch language plane: ?mg_lang=1 | ?lang=all
  try {
    var qs = location.search || "";
    if (/[?&](mg_lang|lang)=(1|all|layout|translate|codec)/i.test(qs)) {
      var mm = /[?&](?:mg_lang|lang)=([^&]*)/i.exec(qs);
      var m0 = (mm && mm[1]) || "all";
      mode = m0 === "1" ? "all" : m0;
      if (window.__mgFloatKb && window.__mgFloatKb.launch) {
        window.__mgFloatKb.launch({
          mode: mode === "codec" ? "codec" : "type",
        });
      }
      setTimeout(function () {
        fanout(lastText || "", { mode: mode });
      }, 600);
    }
  } catch (eUrl) {}

  log(VER + " · fans all lang-codec + layouts + translate · BC " + CH);
  console.info("[language-hotpipe]", VER, "listening", CH);
})();
