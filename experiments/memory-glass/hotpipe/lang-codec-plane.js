/* Memory Glass · Language Codec Powerhouse
 * ASCII · HEX · Binary · PCAP-lite · QuantumGutter · QbitCodec · StenoSTRIP · Glyph · GrokYtalkY
 * Standalone + keyboard plane · builds on concepts/qbit-codec.js + kbatch glyph/steno
 * VER: lang-codec-plane-v1
 */
(function () {
  "use strict";
  var VER = "lang-codec-plane-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._langCodecVer === VER) return;
  HP._langCodecVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "lang-codec");
    } catch (e) {}
  }

  /* ── Quantum gutter / prefix symbols (beyondBINARY · qbit) ── */
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
  var GUTTER_GATES = [
    "SWAP",
    "H",
    "M",
    "Rz",
    "I",
    "X",
    "T",
    "CZ",
    "S",
    "Y",
    "CNOT",
  ];

  /* ── StenoSTRIP 13-space alphabet (kbatch / qbit-codec) ── */
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
  var STENO_TO_IDX = {};
  STENO_SPACES.forEach(function (c, i) {
    STENO_TO_IDX[c] = i;
  });

  /* ── GrokYtalkY glyph header (kbatch gy) ── */
  var GY_MAGIC = "gyg1";

  function utf8Bytes(str) {
    try {
      return Array.from(new TextEncoder().encode(String(str || "")));
    } catch (e) {
      var a = [];
      for (var i = 0; i < str.length; i++) a.push(str.charCodeAt(i) & 0xff);
      return a;
    }
  }

  function utf8FromBytes(bytes) {
    try {
      return new TextDecoder().decode(new Uint8Array(bytes));
    } catch (e) {
      return String.fromCharCode.apply(null, bytes);
    }
  }

  /* ══════════════ ASCII ══════════════ */
  function toAsciiCodes(text) {
    var s = String(text || "");
    var codes = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      codes.push(c <= 127 ? c : 63); /* non-ASCII → ? */
    }
    return codes;
  }

  function fromAsciiCodes(codes) {
    return codes
      .map(function (c) {
        return String.fromCharCode(c & 0x7f);
      })
      .join("");
  }

  function asciiView(text) {
    var codes = toAsciiCodes(text);
    return {
      format: "ascii",
      text: text,
      codes: codes,
      display: codes
        .map(function (c) {
          return ("00" + c).slice(-3);
        })
        .join(" "),
      printable: codes
        .map(function (c) {
          return c >= 32 && c < 127 ? String.fromCharCode(c) : "·";
        })
        .join(""),
    };
  }

  /* ══════════════ HEX ══════════════ */
  function toHex(text, sep) {
    sep = sep == null ? " " : sep;
    return utf8Bytes(text)
      .map(function (b) {
        return ("0" + b.toString(16)).slice(-2);
      })
      .join(sep);
  }

  function fromHex(hex) {
    var clean = String(hex || "").replace(/[^0-9a-fA-F]/g, "");
    if (clean.length % 2) clean = "0" + clean;
    var bytes = [];
    for (var i = 0; i < clean.length; i += 2)
      bytes.push(parseInt(clean.slice(i, i + 2), 16));
    return utf8FromBytes(bytes);
  }

  function hexView(text) {
    var hex = toHex(text, " ");
    return {
      format: "hex",
      text: text,
      hex: hex,
      display: hex,
      bytes: utf8Bytes(text).length,
    };
  }

  /* ══════════════ BINARY ══════════════ */
  function toBinary(text, group) {
    group = group == null ? 8 : group;
    var bits = utf8Bytes(text)
      .map(function (b) {
        return ("00000000" + b.toString(2)).slice(-8);
      })
      .join("");
    if (group > 0) {
      var out = [];
      for (var i = 0; i < bits.length; i += group)
        out.push(bits.slice(i, i + group));
      return out.join(" ");
    }
    return bits;
  }

  function fromBinary(bin) {
    var clean = String(bin || "").replace(/[^01]/g, "");
    while (clean.length % 8) clean = "0" + clean;
    var bytes = [];
    for (var i = 0; i < clean.length; i += 8)
      bytes.push(parseInt(clean.slice(i, i + 8), 2));
    return utf8FromBytes(bytes);
  }

  function binaryView(text) {
    return {
      format: "binary",
      text: text,
      binary: toBinary(text, 8),
      display: toBinary(text, 8),
      bitLen: utf8Bytes(text).length * 8,
    };
  }

  /* ══════════════ PCAP-lite (not wire capture — packet record view) ══════════════ */
  function pcapLite(text, opts) {
    opts = opts || {};
    var payload = utf8Bytes(text);
    var ts = opts.ts || Math.floor(Date.now() / 1000);
    var usec = opts.usec || (Date.now() % 1000) * 1000;
    /* Simplified: global header fields as metadata + one packet */
    var rec = {
      format: "pcap-lite",
      note: "MG conceptual packet record — not libpcap wire; for training/analysis UI",
      globalHeader: {
        magic: "0xa1b2c3d4",
        version: "2.4",
        snaplen: 65535,
        network: opts.linktype != null ? opts.linktype : 1 /* ethernet */,
      },
      packet: {
        tsSec: ts,
        tsUsec: usec,
        inclLen: payload.length,
        origLen: payload.length,
        payloadHex: toHex(text, ""),
        payloadAscii: asciiView(text).printable,
      },
      display:
        "PCAP-lite · " +
        payload.length +
        " B · " +
        ts +
        "." +
        usec +
        "\n" +
        toHex(text, " "),
    };
    return rec;
  }

  function fromPcapLiteDisplay(hexOrObj) {
    if (hexOrObj && hexOrObj.packet && hexOrObj.packet.payloadHex)
      return fromHex(hexOrObj.packet.payloadHex);
    return fromHex(String(hexOrObj || ""));
  }

  /* ══════════════ Quantum Gutter ══════════════ */
  function bitsFromText(text) {
    var bytes = utf8Bytes(text);
    var bits = [];
    for (var i = 0; i < bytes.length; i++) {
      for (var k = 7; k >= 0; k--) bits.push((bytes[i] >> k) & 1);
    }
    return bits;
  }

  function toQuantumGutter(text) {
    var bits = bitsFromText(text);
    var tokens = [];
    for (var i = 0; i < bits.length; i++) {
      /* map bit pairs → gutter symbol index */
      var n = bits[i];
      if (i + 1 < bits.length) n = (n << 1) | bits[++i];
      /* expand to 0-10 with rolling */
      var idx = (n + i) % GUTTER_SYM.length;
      tokens.push({
        sym: GUTTER_SYM[idx],
        gate: GUTTER_GATES[idx],
        bit: bits[i] || 0,
      });
    }
    var stream = tokens
      .map(function (t) {
        return t.sym;
      })
      .join(" ");
    var gates = tokens
      .map(function (t) {
        return t.gate;
      })
      .join(" ");
    return {
      format: "quantum-gutter",
      text: text,
      stream: stream,
      gates: gates,
      display: stream,
      tokens: tokens.slice(0, 64),
      link: "https://mueee.qbitos.ai/quantum-gutter.html",
      note: "beyondBINARY 11-symbol gutter · maps to SWAP/H/M/Rz/I/X/T/CZ/S/Y/CNOT",
    };
  }

  function gutterFromBinary(binary) {
    var clean = String(binary || "").replace(/[^01]/g, "");
    var tokens = [];
    for (var i = 0; i < clean.length; i++) {
      var idx = (parseInt(clean[i], 2) + i) % GUTTER_SYM.length;
      tokens.push(GUTTER_SYM[idx]);
    }
    return {
      format: "quantum-gutter",
      stream: tokens.join(" "),
      display: tokens.join(" "),
      from: "binary",
    };
  }

  /* ══════════════ StenoSTRIP ══════════════ */
  function toSteno(text) {
    var bits = bitsFromText(text);
    var out = [];
    for (var i = 0; i < bits.length; i += 4) {
      var n = 0;
      for (var k = 0; k < 4 && i + k < bits.length; k++)
        n = (n << 1) | bits[i + k];
      out.push(STENO_SPACES[n % STENO_SPACES.length]);
    }
    var steno = out.join("");
    return {
      format: "steno-strip",
      text: text,
      steno: steno,
      stenoVisible: steno.replace(/[^\x20]/g, "·").replace(/ /g, "␣"),
      display: steno.replace(/[^\x20]/g, "·").replace(/ /g, "␣"),
      len: steno.length,
      note: "13 Unicode spaces · kbatch stenoSTRIP · invisible channel",
    };
  }

  function fromSteno(steno) {
    var s = String(steno || "");
    var bits = [];
    for (var i = 0; i < s.length; i++) {
      var idx = STENO_TO_IDX[s[i]];
      if (idx == null) continue;
      for (var k = 3; k >= 0; k--) bits.push((idx >> k) & 1);
    }
    var bytes = [];
    for (var j = 0; j + 8 <= bits.length; j += 8) {
      var b = 0;
      for (var m = 0; m < 8; m++) b = (b << 1) | bits[j + m];
      bytes.push(b);
    }
    return utf8FromBytes(bytes);
  }

  function stenoCapacity(text) {
    var raw = String(text || "");
    var blank = 0;
    for (var i = 0; i < raw.length; i++) if (/\s/.test(raw[i])) blank++;
    return {
      blankChars: blank,
      bitsApprox: Math.floor(blank * Math.log(13) / Math.log(2)),
    };
  }

  /* ══════════════ Glyph / GrokYtalkY binary ══════════════ */
  function textToGlyphBits(text, n) {
    n = n || 13;
    var size = n * n;
    var bits = new Array(size);
    var bytes = utf8Bytes(text);
    for (var i = 0; i < size; i++) {
      var b = bytes[i % Math.max(1, bytes.length)] || 0;
      bits[i] = (b >> (i % 8)) & 1;
    }
    return bits;
  }

  function glyphBitsToBinary(bits) {
    var parts = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var k = 0; k < 8 && i + k < bits.length; k++)
        if (bits[i + k]) b |= 1 << (7 - k);
      parts.push(("00000000" + b.toString(2)).slice(-8));
    }
    return parts.join(" ");
  }

  function toGlyph(text, n) {
    n = n || 13;
    var bits = textToGlyphBits(text, n);
    var binary = glyphBitsToBinary(bits);
    var steno = toSteno(GY_MAGIC + String.fromCharCode(n) + bits.join(""));
    /* ASCII art grid */
    var grid = [];
    for (var r = 0; r < n; r++) {
      var row = "";
      for (var c = 0; c < n; c++) row += bits[r * n + c] ? "█" : "·";
      grid.push(row);
    }
    return {
      format: "glyph-grokytalky",
      text: text,
      n: n,
      magic: GY_MAGIC,
      binary: binary,
      display: binary,
      grid: grid.join("\n"),
      stenoVisible: steno.display,
      bitLen: bits.length,
      note: "GrokYtalkY / kbatch gyg1 glyph · 13×13 default · steno-carry ready",
    };
  }

  /* ══════════════ QbitCodec (concept on machine) ══════════════ */
  function toQbit(text, lang) {
    lang = lang || "unknown";
    var QC = window.QbitCodec;
    if (QC && typeof QC.encode === "function") {
      try {
        var enc = QC.encode(text, lang, "mg-lang-codec");
        return {
          format: "qbit-codec",
          text: text,
          encoded: typeof enc === "string" ? enc : JSON.stringify(enc).slice(0, 4000),
          display:
            typeof enc === "string"
              ? enc.slice(0, 500)
              : JSON.stringify(enc).slice(0, 500),
          engine: "QbitCodec",
          version: QC.VERSION || QC.version || "1.x",
          note: "concepts/qbit-codec.js · .qbit format",
        };
      } catch (e) {
        /* fall through */
      }
    }
    /* lightweight local qbit-like line prefixes when full codec not loaded */
    var lines = String(text || "").split(/\n/);
    var out = lines.map(function (line, i) {
      var idx = i % GUTTER_SYM.length;
      var depth = (line.match(/^\s*/) || [""])[0].length;
      var space = STENO_SPACES[Math.min(12, Math.floor(depth / 2))];
      return GUTTER_SYM[idx] + space + line.replace(/^\s+/, "");
    });
    return {
      format: "qbit-lite",
      text: text,
      encoded: out.join("\n"),
      display: out.join("\n").slice(0, 800),
      engine: "qbit-lite",
      note: "Full QbitCodec not loaded — lite prefix+steno depth. Load concepts/qbit-codec.js for full .qbit",
    };
  }

  function fromQbit(content) {
    var QC = window.QbitCodec;
    if (QC && typeof QC.decode === "function") {
      try {
        return QC.decode(content);
      } catch (e) {}
    }
    /* strip gutter prefixes */
    return String(content || "")
      .split(/\n/)
      .map(function (line) {
        return line.replace(/^(n:|\+1:|-n:|\+0:|0:|-1:|\+n:|\+2:|-0:|\+3:|1:)\s*/, "");
      })
      .join("\n");
  }

  /* ══════════════ Master transform ══════════════ */
  var FORMATS = [
    "ascii",
    "hex",
    "binary",
    "pcap",
    "gutter",
    "steno",
    "glyph",
    "qbit",
    "text",
  ];

  function transform(text, format, opts) {
    opts = opts || {};
    text = String(text == null ? "" : text);
    format = (format || "hex").toLowerCase();
    switch (format) {
      case "ascii":
        return asciiView(text);
      case "hex":
        return hexView(text);
      case "bin":
      case "binary":
        return binaryView(text);
      case "pcap":
      case "pcap-lite":
        return pcapLite(text, opts);
      case "gutter":
      case "quantum-gutter":
      case "qg":
        return toQuantumGutter(text);
      case "steno":
      case "steno-strip":
      case "whitespace":
        return toSteno(text);
      case "glyph":
      case "grokytalky":
      case "gy":
        return toGlyph(text, opts.n || 13);
      case "qbit":
      case "qbit-codec":
        return toQbit(text, opts.lang || "unknown");
      case "text":
      default:
        return { format: "text", text: text, display: text };
    }
  }

  function invert(display, format) {
    format = (format || "hex").toLowerCase();
    switch (format) {
      case "hex":
        return fromHex(display);
      case "bin":
      case "binary":
        return fromBinary(display);
      case "ascii":
        return fromAsciiCodes(
          String(display)
            .trim()
            .split(/\s+/)
            .map(function (x) {
              return parseInt(x, 10) || 0;
            })
        );
      case "steno":
      case "whitespace":
        return fromSteno(display);
      case "qbit":
        return fromQbit(display);
      case "pcap":
        return fromPcapLiteDisplay(display);
      default:
        return String(display || "");
    }
  }

  function allViews(text) {
    var o = {};
    FORMATS.forEach(function (f) {
      if (f === "text") return;
      try {
        o[f] = transform(text, f);
      } catch (e) {
        o[f] = { format: f, error: String(e) };
      }
    });
    return o;
  }

  function report() {
    var qc = !!(window.QbitCodec && window.QbitCodec.encode);
    return (
      VER +
      " formats=" +
      FORMATS.join(",") +
      " QbitCodec=" +
      (qc ? "on" : "lite")
    );
  }

  window.__mgLangCodec = {
    ver: VER,
    formats: FORMATS.slice(),
    gutterSymbols: GUTTER_SYM.slice(),
    transform: transform,
    invert: invert,
    allViews: allViews,
    ascii: asciiView,
    hex: hexView,
    binary: binaryView,
    pcap: pcapLite,
    gutter: toQuantumGutter,
    gutterFromBinary: gutterFromBinary,
    steno: toSteno,
    fromSteno: fromSteno,
    stenoCapacity: stenoCapacity,
    glyph: toGlyph,
    qbit: toQbit,
    fromQbit: fromQbit,
    toHex: toHex,
    fromHex: fromHex,
    toBinary: toBinary,
    fromBinary: fromBinary,
    report: report,
  };

  log(VER + " · " + report());
})();
