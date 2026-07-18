/* Memory Glass · kbatch.ugrad.ai dojo bridge
 * Composer phrases → world layout shadows / word hits
 * stenoSTRIP whitespace + glyph binary (snapshot feed test)
 * quantum gutter 0–1 stream + Rubik SO sentence order (SSO/OSO/SOS…)
 * Strain metrics drive contrail colors (kbatch assess).
 * VER: kbatch-dojo-bridge-v1
 */
(function () {
  "use strict";
  var VER = "kbatch-dojo-bridge-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._kbatchDojoVer === VER) return;
  HP._kbatchDojoVer = VER;

  var MCP = "https://kbatch.ugrad.ai/api/mcp";
  var DATA = "https://data.ugrad.ai/kbatch/";
  var cache = { words: {}, analyze: {}, last: null };
  var LAYOUT_LABELS = [
    "qwerty",
    "dvorak",
    "colemak",
    "azerty",
    "qwertz",
    "ru",
    "ko",
    "he",
    "ar",
    "hi",
    "he2",
    "el",
    "th",
    "tr",
    "en2",
  ];

  /* 13-space stenoSTRIP alphabet (kbatch steno-strip.js) */
  var STENO_SPACES = [
    "\u0020",
    "\u00A0",
    "\u2000",
    "\u2001",
    "\u2002",
    "\u2003",
    "\u2004",
    "\u2005",
    "\u2006",
    "\u2007",
    "\u2008",
    "\u2009",
    "\u200A",
  ];
  var GUTTER_SYM = [
    "n:",
    "+1:",
    "-n:",
    "+0:",
    "0:",
    "-1:",
    "+n:",
    "+2:",
    "-0:",
    "+3:",
    "1:",
  ];
  var VOWELS = "aeiouyàáâäæãåāèéêëēėęîïíīįìôöòóœøōõûüùúūůűñ";

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "kbatch");
    } catch (e) {}
  }

  function mcp(tool, args) {
    return fetch(MCP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: tool, args: args || {} }),
      mode: "cors",
    })
      .then(function (r) {
        return r.json();
      })
      .catch(function (e) {
        return { error: String(e), tool: tool };
      });
  }

  /* ── SO order (SSO / OSO / SOS …) ── */
  function letterSO(ch) {
    var c = String(ch || "").toLowerCase();
    if (!c || !/[a-zà-öø-ÿ]/i.test(c)) return "·";
    return VOWELS.indexOf(c[0]) >= 0 ? "O" : "S";
  }

  function soSequence(text) {
    return Array.prototype.map
      .call(String(text || ""), letterSO)
      .filter(function (x) {
        return x !== "·";
      })
      .join("");
  }

  function soNgrams(so, n) {
    n = n || 3;
    var counts = {};
    if (so.length < n) {
      if (so) counts[so] = 1;
      return counts;
    }
    for (var i = 0; i <= so.length - n; i++) {
      var g = so.slice(i, i + n);
      counts[g] = (counts[g] || 0) + 1;
    }
    return counts;
  }

  function soReport(text) {
    var so = soSequence(text);
    var tri = soNgrams(so, 3);
    var patterns = ["SSO", "OSO", "SOS", "OSS", "SOO", "OOS", "SSS", "OOO"];
    var hits = {};
    patterns.forEach(function (p) {
      if (tri[p]) hits[p] = tri[p];
    });
    return { so: so, compressed: compressSO(so), trigrams: tri, orderHits: hits };
  }

  function compressSO(so) {
    if (!so) return "";
    var out = [],
      prev = so[0],
      n = 1;
    for (var i = 1; i < so.length; i++) {
      if (so[i] === prev) n++;
      else {
        out.push(n > 1 ? prev + "×" + n : prev);
        prev = so[i];
        n = 1;
      }
    }
    out.push(n > 1 ? prev + "×" + n : prev);
    return out.join(" ");
  }

  /* ── stenoSTRIP encode bits → whitespace ── */
  function bitsToSteno(bits) {
    var out = [];
    var base = STENO_SPACES.length; // 13
    for (var i = 0; i < bits.length; i += 2) {
      // pack ~3.7 bits/symbol: take 4 bits mod 13
      var n = 0;
      for (var k = 0; k < 4 && i + k < bits.length; k++) {
        n = (n << 1) | (bits[i + k] ? 1 : 0);
      }
      out.push(STENO_SPACES[n % base]);
    }
    return out.join("");
  }

  function stenoCapacity(text) {
    var raw = String(text || "");
    var blank = 0,
      write = 0;
    for (var i = 0; i < raw.length; i++) {
      if (/\s/.test(raw[i])) blank++;
      else write++;
    }
    var bits = blank * Math.log2(13);
    return {
      writeChars: write,
      blankChars: blank,
      bitsApprox: Math.floor(bits),
      coins: Math.floor(bits),
      bitsPerLine: 18,
    };
  }

  /* ── glyph 13×13 from image / canvas snapshot ── */
  function canvasToGlyphBits(canvas, n) {
    n = n || 13;
    var size = n * n;
    var bits = new Array(size).fill(0);
    if (!canvas) return bits;
    try {
      var c = document.createElement("canvas");
      c.width = n;
      c.height = n;
      var ctx = c.getContext("2d");
      ctx.drawImage(canvas, 0, 0, n, n);
      var data = ctx.getImageData(0, 0, n, n).data;
      for (var i = 0; i < size; i++) {
        var o = i * 4;
        var lum = (data[o] * 0.3 + data[o + 1] * 0.59 + data[o + 2] * 0.11) / 255;
        bits[i] = lum < 0.55 ? 1 : 0;
      }
    } catch (e) {}
    return bits;
  }

  function glyphBitsToBinary(bits) {
    var bytes = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var k = 0; k < 8; k++) {
        if (bits[i + k]) b |= 1 << (7 - k);
      }
      bytes.push(b);
    }
    return bytes
      .map(function (b) {
        return ("00000000" + b.toString(2)).slice(-8);
      })
      .join(" ");
  }

  function encodeGlyphInSteno(carrier, bits, n) {
    n = n || 13;
    var header =
      "gyg1" +
      String.fromCharCode(n) +
      bits
        .map(function (b) {
          return b ? "1" : "0";
        })
        .join("");
    // encode header as utf8 bits then steno
    var enc = new TextEncoder().encode(header.slice(0, 200));
    var hb = [];
    for (var i = 0; i < enc.length; i++) {
      for (var k = 7; k >= 0; k--) hb.push((enc[i] >> k) & 1);
    }
    var steno = bitsToSteno(bits.length ? bits : hb);
    var cap = stenoCapacity(carrier + steno);
    return {
      n: n,
      bitLen: bits.length,
      binary: glyphBitsToBinary(bits),
      stenoLen: steno.length,
      stenoSample: steno.slice(0, 20).replace(/\s/g, "·"),
      carrierPlusSteno: (carrier || "·") + steno,
      capacity: cap,
      canCarryImage: cap.bitsApprox >= bits.length || bits.length <= steno.length * 4,
      note: "stenoSTRIP whitespace can carry glyph frames when blank coins ≥ bit budget",
    };
  }

  /* ── quantum gutter from binary ── */
  function binaryStreamToGutter(text, binary) {
    var bits = [];
    if (binary) {
      bits = String(binary)
        .replace(/[^01]/g, "")
        .split("")
        .map(function (c) {
          return c === "1" ? 1 : 0;
        });
    } else {
      var bytes = new TextEncoder().encode(String(text || "").slice(0, 128));
      for (var i = 0; i < bytes.length; i++) {
        for (var k = 7; k >= 0; k--) bits.push((bytes[i] >> k) & 1);
      }
    }
    var stream = bits.map(function (b, i) {
      return b ? GUTTER_SYM[i % 2 === 0 ? 10 : 1] : GUTTER_SYM[i % 2 === 0 ? 8 : 3];
    });
    // Rubik-style face order from SO of text
    var so = soReport(text || "");
    return {
      bitCount: bits.length,
      ones: bits.filter(Boolean).length,
      gutterPreview: stream.slice(0, 24).join(" "),
      gutterUrl: "https://mueee.qbitos.ai/quantum-gutter.html",
      so: so,
      rubikFaces: ["U:written", "D:spoken", "F:movement", "B:digital", "L:analog", "R:thought"],
      phrasingOrders: so.orderHits,
    };
  }

  /* ── dir phrase → latin seed for analyze ── */
  var DIR_TO_KEYS = {
    E: "lkj",
    SE: "m,.",
    S: "nm,",
    SW: "zxcv",
    W: "asdf",
    NW: "qwer",
    N: "uiop",
    NE: "yui",
    "·": " ",
  };

  function phraseToSeed(phrase) {
    // E2SEN3 → pick keys along path
    var s = String(phrase || "");
    var out = "";
    var re = /([A-Z·]+)(\d*)/g;
    var m;
    while ((m = re.exec(s))) {
      var dir = m[1];
      var n = parseInt(m[2] || "1", 10);
      var keys = DIR_TO_KEYS[dir] || "e";
      for (var i = 0; i < n; i++) out += keys[i % keys.length];
    }
    return out || s.replace(/[^a-z]/gi, "").toLowerCase() || "path";
  }

  /* ── analyze_lite + world shadows → word hits ── */
  function analyzeLite(text) {
    var key = String(text || "").toLowerCase().slice(0, 64);
    if (cache.analyze[key]) return Promise.resolve(cache.analyze[key]);
    return mcp("kbatch_analyze_lite", { text: text }).then(function (r) {
      cache.analyze[key] = r;
      return r;
    });
  }

  function fetchPrefixWords(prefix) {
    prefix = String(prefix || "").toLowerCase();
    if (!prefix) return Promise.resolve([]);
    var letter = prefix[0];
    if (!/[a-z]/.test(letter)) return Promise.resolve([]);
    if (cache.words[letter]) {
      return Promise.resolve(
        cache.words[letter].filter(function (w) {
          return w.indexOf(prefix) === 0;
        }).slice(0, 16)
      );
    }
    return fetch(DATA + "words/en/" + letter + ".json", { mode: "cors" })
      .then(function (r) {
        return r.ok ? r.json() : [];
      })
      .then(function (arr) {
        if (!Array.isArray(arr)) arr = [];
        // keep modest prefix index
        cache.words[letter] = arr.slice(0, 8000);
        return cache.words[letter]
          .filter(function (w) {
            return typeof w === "string" && w.indexOf(prefix) === 0;
          })
          .slice(0, 16);
      })
      .catch(function () {
        return [];
      });
  }

  /**
   * Run composer phrase against dojo/world:
   * seed → analyze_lite (strain + 15 shadows L[]) → latin-looking shadows as word hits
   * + SO order + steno/glyph + quantum gutter
   */
  function runPhrase(phrase, opts) {
    opts = opts || {};
    var seed = opts.seed || phraseToSeed(phrase);
    var snapshotCanvas = opts.canvas || document.getElementById("mg-contrail-ov");

    return analyzeLite(seed).then(function (lite) {
      var pre = (lite && lite.precomputed) || {};
      var strain = pre.s != null ? Number(pre.s) : null;
      var eff = pre.e != null ? Number(pre.e) : null;
      var shadows = Array.isArray(pre.L) ? pre.L : [];
      var bi = pre.bi || "";

      // World-layout shadows that look like words (latin)
      var latinShadows = shadows
        .map(function (sh, i) {
          return {
            layout: LAYOUT_LABELS[i] || "L" + i,
            shadow: sh,
            isLatin: /^[a-zA-Z][a-zA-Z' -]{1,24}$/.test(String(sh || "")),
          };
        })
        .filter(function (x) {
          return x.isLatin;
        });

      var glyphBits = canvasToGlyphBits(snapshotCanvas, 13);
      var stenoGlyph = encodeGlyphInSteno(seed, glyphBits, 13);
      var gutter = binaryStreamToGutter(seed, bi.replace(/\s/g, ""));
      var so = soReport(seed);

      // Prefix search for seed + each latin shadow
      var prefixes = [seed.slice(0, 4)]
        .concat(
          latinShadows.map(function (x) {
            return String(x.shadow).toLowerCase().slice(0, 4);
          })
        )
        .filter(Boolean);

      return Promise.all(prefixes.slice(0, 6).map(fetchPrefixWords)).then(function (lists) {
        var words = [];
        var seen = {};
        lists.forEach(function (list) {
          (list || []).forEach(function (w) {
            if (!seen[w]) {
              seen[w] = 1;
              words.push(w);
            }
          });
        });

        var report = {
          ver: VER,
          t: Date.now(),
          phrase: phrase,
          seed: seed,
          strain: strain,
          efficiency: eff,
          rsi: pre.rsi,
          shadows: shadows.map(function (sh, i) {
            return { layout: LAYOUT_LABELS[i] || i, shadow: sh };
          }),
          latinWordHits: latinShadows,
          worldWords: words.slice(0, 24),
          so: so,
          phrasingOrders: so.orderHits,
          steno: stenoGlyph,
          quantumGutter: gutter,
          binary: bi,
          dojo: "https://kbatch.ugrad.ai/dojo/",
          analyzeUrl: "https://kbatch.ugrad.ai/?q=" + encodeURIComponent(seed),
          rubik: {
            faces: gutter.rubikFaces,
            soOrders: so.orderHits,
            note: "Cube faces U/D/F/B/L/R · SO order SSO/OSO/SOS for sentence phrasing",
          },
        };
        cache.last = report;
        try {
          localStorage.setItem("mg.kbatch.lastPhrase", JSON.stringify(report));
        } catch (e) {}
        log(
          "phrase «" +
            String(phrase).slice(0, 16) +
            "» seed=" +
            seed +
            " strain=" +
            strain +
            " words=" +
            words.length +
            " steno=" +
            (stenoGlyph.canCarryImage ? "imgOK" : "img?")
        );
        return report;
      });
    });
  }

  /** Strain → color (kbatch contrails-viz: >60 red, >30 gold, else green) + finer bands */
  function strainColor(strain, alpha) {
    var a = alpha == null ? 0.9 : alpha;
    var s = Number(strain);
    if (!isFinite(s)) return "rgba(160,210,255," + a + ")";
    // finer stress variation
    if (s >= 85) return "rgba(248,81,73," + a + ")"; // critical
    if (s >= 70) return "rgba(255,110,90," + a + ")"; // high stress
    if (s >= 55) return "rgba(255,150,80," + a + ")"; // elevated
    if (s >= 40) return "rgba(210,160,23," + a + ")"; // mid strain (kbatch gold)
    if (s >= 25) return "rgba(180,200,80," + a + ")"; // mild
    if (s >= 12) return "rgba(63,185,80," + a + ")"; // low / success band
    return "rgba(80,230,160," + a + ")"; // very low
  }

  function strainBand(strain) {
    var s = Number(strain);
    if (!isFinite(s)) return "unknown";
    if (s >= 70) return "stress-high";
    if (s >= 40) return "stress-mid";
    if (s >= 25) return "strain-mild";
    return "success";
  }

  window.__mgKbatchDojo = {
    ver: VER,
    mcp: mcp,
    runPhrase: runPhrase,
    analyzeLite: analyzeLite,
    soReport: soReport,
    encodeGlyphInSteno: encodeGlyphInSteno,
    binaryStreamToGutter: binaryStreamToGutter,
    canvasToGlyphBits: canvasToGlyphBits,
    strainColor: strainColor,
    strainBand: strainBand,
    phraseToSeed: phraseToSeed,
    last: function () {
      return cache.last;
    },
    report: function () {
      var L = cache.last;
      if (!L) return VER + " idle";
      return (
        VER +
        " seed=" +
        L.seed +
        " strain=" +
        L.strain +
        " words=" +
        ((L.worldWords && L.worldWords.length) || 0) +
        " so=" +
        JSON.stringify(L.phrasingOrders || {})
      );
    },
  };
  log(VER + " · MCP " + MCP);
})();
