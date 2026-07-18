// beyondBINARY quantum-prefixed | qbit-codec | {n:, +1:, -n:, +0:, 0:, -1:, +n:, +2:, -0:, +3:, 1:}
// qbit-codec.js — Standalone .qbit Format Codec
// Self-contained, no external dependencies.
// UMD-compatible: browser (window.QbitCodec), Node CJS (require), ESM (import)

(function (root) {
  "use strict";

  // ─────────────────────────────────────────────────────────────────────────────
  // § 1  CONSTANTS
  // ─────────────────────────────────────────────────────────────────────────────

  /** @type {string} Codec version */
  var VERSION = "1.0.0";

  /**
   * The 11 prefix symbols, indexed 0–10.
   * Order matches the canonical .qbit spec table.
   * @type {string[]}
   */
  var SYMBOLS = [
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

  /**
   * Quantum gate names corresponding to each symbol index.
   * @type {string[]}
   */
  var GATES = ["SWAP", "H", "M", "Rz", "I", "X", "T", "CZ", "S", "Y", "CNOT"];

  /**
   * Human-readable category names corresponding to each symbol index.
   * @type {string[]}
   */
  var CATEGORIES = [
    "shebang", // 0  n:
    "comment", // 1  +1:
    "import", // 2  -n:
    "class", // 3  +0:
    "function", // 4  0:
    "error", // 5  -1:
    "condition", // 6  +n:
    "loop", // 7  +2:
    "return", // 8  -0:
    "output", // 9  +3:
    "variable", // 10 1:
  ];

  /**
   * qbitOS palette colours per symbol (and neutral space).
   * @type {Object.<string,string>}
   */
  var SYM_COLOR = {
    "n:": "#c9a84c",
    "+1:": "#6e7681",
    "-n:": "#58a6ff",
    "+0:": "#a78bfa",
    "0:": "#56d4dd",
    "-1:": "#f85149",
    "+n:": "#34d399",
    "+2:": "#f0883e",
    "-0:": "#3fb950",
    "+3:": "#ff6b6b",
    "1:": "#e6edf3",
    " ": "#30363d",
  };

  /**
   * Maps each symbol to its corresponding quantum gate name.
   * @type {Object.<string,string>}
   */
  var GATE_MAP = (function () {
    var m = {};
    for (var i = 0; i < SYMBOLS.length; i++) m[SYMBOLS[i]] = GATES[i];
    return m;
  })();

  // ─────────────────────────────────────────────────────────────────────────────
  // § 2  STEGANOGRAPHIC SPACE ALPHABET  (Layer 2)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * 13 Unicode space characters mapped to nibble values 0x0–0xC.
   * Each character acts as a "steganographic digit" embedded into whitespace.
   * @type {string[]}
   */
  var SPACE_CHARS = [
    "\u0020", // 0x0  standard space
    "\u00A0", // 0x1  no-break space
    "\u2000", // 0x2  en quad
    "\u2001", // 0x3  em quad
    "\u2002", // 0x4  en space
    "\u2003", // 0x5  em space
    "\u2004", // 0x6  three-per-em
    "\u2005", // 0x7  four-per-em
    "\u2006", // 0x8  six-per-em
    "\u2007", // 0x9  figure space
    "\u2008", // 0xA  punctuation space
    "\u2009", // 0xB  thin space
    "\u200A", // 0xC  hair space
  ];

  /** Reverse lookup: space char → index */
  var SPACE_TO_IDX = (function () {
    var m = {};
    for (var i = 0; i < SPACE_CHARS.length; i++) m[SPACE_CHARS[i]] = i;
    return m;
  })();

  /** Regex that matches any steno space character (non-standard spaces) */
  var STENO_RE = /[\u00A0\u2000-\u200A]/g;

  // ─────────────────────────────────────────────────────────────────────────────
  // § 3  LANGUAGE DETECTION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Extension → language map used by detectLang().
   * @type {Object.<string,string>}
   */
  var EXT_LANG = {
    py: "python",
    js: "javascript",
    ts: "typescript",
    rs: "rust",
    go: "go",
    sh: "shell",
    bash: "shell",
    html: "html",
    htm: "html",
    css: "css",
    java: "java",
    c: "c",
    cpp: "c",
    h: "c",
    hpp: "c",
    rb: "ruby",
    swift: "swift",
    nu: "nushell",
    md: "markdown",
    json: "json",
    toml: "toml",
    yaml: "yaml",
    yml: "yaml",
    qasm: "qasm",
  };

  /**
   * Heuristic content patterns for language auto-detection.
   * Each entry: [language, regexToTest]
   */
  var LANG_HEURISTICS = [
    ["python", /^(def |class |import |from |#!.*python)/m],
    ["rust", /^(fn |use |impl |pub fn |mod |struct |enum )/m],
    ["typescript", /^(import .* from|interface |type |const .+: [A-Z])/m],
    ["javascript", /^(const |let |var |function |require\(|module\.exports)/m],
    ["go", /^(package |func |import \(|var |type .*struct)/m],
    ["shell", /^(#!\/bin\/|echo |export |source |alias )/m],
    ["html", /^\s*<!DOCTYPE|<html|<head|<body/m],
    ["css", /^\s*[.#]?[\w-]+\s*\{|@media|@keyframes/m],
    ["java", /^(public class|private |protected |import java)/m],
    ["c", /^(#include|int main\(|void |struct )/m],
    ["ruby", /^(def |class |require |module |end$)/m],
    ["swift", /^(func |var |let |class |struct |import )/m],
    ["nushell", /^(def |let |use |alias |module )/m],
    ["markdown", /^(#{1,6} |> |\*\*|---$)/m],
    ["toml", /^\[[\w.]+\]|^\w+ = /m],
    ["yaml", /^\w+:\s|^- \w/m],
    ["json", /^\s*[\[{]/],
    ["qasm", /^(OPENQASM|qreg|creg|gate|measure)/m],
  ];

  /**
   * Detect source language from file content and/or filename.
   * @param {string} content   - Raw source text
   * @param {string} [filename] - Optional filename (used for extension lookup)
   * @returns {string} Language key, e.g. 'python', or 'unknown'
   */
  function detectLang(content, filename) {
    // 1. Try file extension
    if (filename) {
      var ext = filename.split(".").pop().toLowerCase();
      if (EXT_LANG[ext]) return EXT_LANG[ext];
    }
    // 2. Try shebang
    var shebangMatch = content.match(/^#!.*\/([\w]+)/);
    if (shebangMatch) {
      var interp = shebangMatch[1].toLowerCase();
      if (interp === "python3" || interp === "python") return "python";
      if (interp === "node") return "javascript";
      if (interp === "bash" || interp === "sh" || interp === "zsh")
        return "shell";
      if (interp === "ruby") return "ruby";
    }
    // 3. Content heuristics
    for (var i = 0; i < LANG_HEURISTICS.length; i++) {
      if (LANG_HEURISTICS[i][1].test(content)) return LANG_HEURISTICS[i][0];
    }
    return "unknown";
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // § 4  LINE CLASSIFICATION  (Layer 1)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Compute nesting depth of a line from its leading indentation.
   * One indent level = 2 spaces (or 1 tab). Result is capped at 12 (max steno value).
   * @param {string} line - Raw source line
   * @returns {number} Depth 0–12
   */
  function lineDepth(line) {
    var match = line.match(/^(\s*)/);
    if (!match) return 0;
    var ws = match[1];
    // Count tabs as one level each, spaces as pairs
    var tabs = (ws.match(/\t/g) || []).length;
    var spaces = ws.replace(/\t/g, "").length;
    var depth = tabs + Math.floor(spaces / 2);
    return Math.min(depth, 12);
  }

  /**
   * Classification rules as [symbolIndex, testFn] pairs.
   * Rules are tested in order; first match wins.
   */
  var RULES = (function () {
    function t(re) {
      return function (s) {
        return re.test(s);
      };
    }
    var trim = function (line) {
      return line.replace(/^\s+/, "");
    };

    return [
      // 0  shebang   n:
      [
        0,
        function (line) {
          return /^#!/.test(line);
        },
      ],
      // 1  comment   +1:
      [
        1,
        function (line) {
          var s = trim(line);
          return /^(\/\/|#(?!!)|--|<!--|\/\*|\*)/.test(s);
        },
      ],
      // 2  import    -n:
      [
        2,
        function (line) {
          var s = trim(line);
          return /^(import\b|from\b|use\b|require\s*\(|include\b|#include\b|using\b)/.test(
            s,
          );
        },
      ],
      // 3  class     +0:
      [
        3,
        function (line) {
          var s = trim(line);
          return /^(class\b|struct\b|interface\b|trait\b|enum\b|impl\b|type\s+\w)/.test(
            s,
          );
        },
      ],
      // 4  function  0:
      [
        4,
        function (line) {
          var s = trim(line);
          return /^(async\s+def\b|async\s+fn\b|pub\s+fn\b|const\s+fn\b|def\b|fn\b|func\b|function\b|fun\b|method\b)/.test(
            s,
          );
        },
      ],
      // 5  error     -1:
      [
        5,
        function (line) {
          var s = trim(line);
          return /^(throw\b|raise\b|panic!\s*|Error\s*\(|except\b|catch\b|err\b)/.test(
            s,
          );
        },
      ],
      // 6  condition +n:
      [
        6,
        function (line) {
          var s = trim(line);
          return /^(if\b|else\b|elif\b|unless\b|when\b|match\b|switch\b|case\b)/.test(
            s,
          );
        },
      ],
      // 7  loop      +2:
      [
        7,
        function (line) {
          var s = trim(line);
          return /^(for\b|while\b|loop\b|forEach\b|each\b|map\s*\(|\.map\b)/.test(
            s,
          );
        },
      ],
      // 8  return    -0:
      [
        8,
        function (line) {
          var s = trim(line);
          return /^(return\b|yield\b|break\b|continue\b)/.test(s);
        },
      ],
      // 9  output    +3:
      [
        9,
        function (line) {
          var s = trim(line);
          return /^(print\b|console\.|log\s*\(|fmt\.|puts\b|echo\b|println!\s*)/.test(
            s,
          );
        },
      ],
      // 10 variable  1:
      [
        10,
        function (line) {
          var s = trim(line);
          return /^(let\b|var\b|const\b|val\b|mut\b|\w+\s*=(?!=))/.test(s);
        },
      ],
    ];
  })();

  /**
   * Classify a single source line into a .qbit record.
   * @param {string} line  - Raw source line
   * @param {string} [lang] - Language hint (currently unused but available for future rules)
   * @returns {{sym: string, gate: string, category: string, depth: number, index: number}}
   */
  function classifyLine(line, lang) {
    var depth = lineDepth(line);

    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][1](line)) {
        var idx = RULES[i][0];
        return {
          sym: SYMBOLS[idx],
          gate: GATES[idx],
          category: CATEGORIES[idx],
          depth: depth,
          index: idx,
        };
      }
    }

    // Unclassified → neutral
    return { sym: " ", gate: "", category: "neutral", depth: depth, index: -1 };
  }

  /**
   * Classify all lines of a source string.
   * @param {string} content - Full source text
   * @param {string} [lang]  - Language hint
   * @returns {Array.<{line: number, sym: string, gate: string, depth: number, category: string, code: string}>}
   */
  function classify(content, lang) {
    var lines = content.split("\n");
    return lines.map(function (code, i) {
      var cl = classifyLine(code, lang);
      return {
        line: i + 1,
        sym: cl.sym,
        gate: cl.gate,
        depth: cl.depth,
        category: cl.category,
        code: code,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // § 5  STEGANOGRAPHIC ENCODE / DECODE  (Layers 2 & 3)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Encode a single 5-field record into 5 steno space characters.
   * Record layout:
   *   [0] symbol   0–10
   *   [1] gate     0–10
   *   [2] depth    0–12
   *   [3] layer    0–7
   *   [4] category 0–10
   * @param {number} symIdx   - Symbol index (0–10)
   * @param {number} gateIdx  - Gate index   (0–10)
   * @param {number} depth    - Depth        (0–12)
   * @param {number} layer    - Iron Line layer (0–7)
   * @param {number} catIdx   - Category index (0–10)
   * @returns {string} 5-character steno prefix
   */
  function encodeRecord(symIdx, gateIdx, depth, layer, catIdx) {
    // Clamp to valid ranges
    symIdx = Math.max(0, Math.min(10, symIdx < 0 ? 0 : symIdx));
    gateIdx = Math.max(0, Math.min(10, gateIdx < 0 ? 0 : gateIdx));
    depth = Math.max(0, Math.min(12, depth));
    layer = Math.max(0, Math.min(7, layer));
    catIdx = Math.max(0, Math.min(10, catIdx < 0 ? 0 : catIdx));

    // Offset by +1: U+0020 (index 0) is reserved as "no steno" sentinel.
    // Symbol/gate/cat indices 0–10 map to SPACE_CHARS[1]–SPACE_CHARS[11].
    // Depth 0–12 maps to SPACE_CHARS[1]–SPACE_CHARS[12] (depth 12 → index 12 = U+200A is fine).
    // Layer 0–7 maps to SPACE_CHARS[1]–SPACE_CHARS[8].
    return (
      SPACE_CHARS[symIdx + 1] +
      SPACE_CHARS[gateIdx + 1] +
      SPACE_CHARS[depth + 1] +
      SPACE_CHARS[layer + 1] +
      SPACE_CHARS[catIdx + 1]
    );
  }

  /**
   * Decode a 5-character steno prefix back into its fields.
   * @param {string} prefix - 5 steno space chars
   * @returns {{symIdx: number, gateIdx: number, depth: number, layer: number, catIdx: number}}
   */
  function decodeRecord(prefix) {
    var chars = prefix.split("");
    // Subtract the +1 encoding offset so values map back to 0-based indices.
    function deIdx(ch) {
      var v = SPACE_TO_IDX[ch];
      return v !== undefined ? Math.max(0, v - 1) : 0;
    }
    return {
      symIdx: deIdx(chars[0]),
      gateIdx: deIdx(chars[1]),
      depth: deIdx(chars[2]),
      layer: deIdx(chars[3]),
      catIdx: deIdx(chars[4]),
    };
  }

  /**
   * Derive an Iron Line layer value (0–7) from the source line.
   * Currently maps symbol index → layer via modulo 8.
   * @param {number} symIdx - Symbol index
   * @returns {number} 0–7
   */
  function deriveLayer(symIdx) {
    return symIdx < 0 ? 0 : symIdx % 8;
  }

  /**
   * Encode source content into .qbit format (steganographic leading spaces on each line).
   * @param {string} content       - Raw source text
   * @param {string} [lang]        - Language hint; auto-detected if omitted
   * @param {string} [source]      - Human-readable source label for the header
   * @returns {{code: string, stats: {totalLines: number, classified: number, coverage: number, counts: Object}}}
   */
  function encode(content, lang, source) {
    var detectedLang = lang || detectLang(content);
    var lines = content.split("\n");
    var counts = {};
    var classified = 0;
    var encoded = [];

    SYMBOLS.forEach(function (s) {
      counts[s] = 0;
    });

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var cl = classifyLine(line, detectedLang);
      var idx = cl.index;
      var layer = deriveLayer(idx);

      if (idx >= 0) {
        classified++;
        counts[cl.sym] = (counts[cl.sym] || 0) + 1;
      }

      // Unclassified lines get no steno prefix (strip() can't distinguish
      // all-standard-space prefixes from actual source indentation).
      if (idx < 0) {
        encoded.push(line);
        continue;
      }

      var prefix = encodeRecord(idx, idx, cl.depth, layer, idx);
      encoded.push(prefix + line);
    }

    var total = lines.length;
    var coverage = total > 0 ? Math.round((classified / total) * 100) : 0;

    return {
      code: encoded.join("\n"),
      stats: {
        totalLines: total,
        classified: classified,
        coverage: coverage,
        counts: counts,
        lang: detectedLang,
        source: source || "",
      },
    };
  }

  /**
   * Decode a .qbit-encoded string, extracting per-line metadata.
   * @param {string} content - .qbit encoded text
   * @returns {Array.<{line: number, sym: string, gate: string, depth: number, layer: number, cat: string, code: string}>}
   */
  function decode(content) {
    var lines = content.split("\n");
    var result = [];

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];

      // Skip header line
      if (raw.trimLeft().startsWith("# beyondBINARY")) {
        result.push({
          line: i + 1,
          sym: "+1:",
          gate: "H",
          depth: 0,
          layer: 0,
          cat: "comment",
          code: raw,
        });
        continue;
      }

      // Check if this line starts with 5 steno chars
      if (raw.length >= 5) {
        var prefix = raw.slice(0, 5);
        var hasSteno = false;
        for (var c = 0; c < 5; c++) {
          if (SPACE_TO_IDX[prefix[c]] !== undefined && prefix[c] !== "\u0020") {
            hasSteno = true;
            break;
          }
        }

        if (hasSteno) {
          var rec = decodeRecord(prefix);
          var code = raw.slice(5);
          var symIdx = rec.symIdx;
          var sym = SYMBOLS[symIdx] || " ";
          result.push({
            line: i + 1,
            sym: sym,
            gate: GATES[symIdx] || "",
            depth: rec.depth,
            layer: rec.layer,
            cat: CATEGORIES[symIdx] || "neutral",
            code: code,
          });
          continue;
        }
      }

      // Not encoded — return as-is
      result.push({
        line: i + 1,
        sym: " ",
        gate: "",
        depth: 0,
        layer: 0,
        cat: "neutral",
        code: raw,
      });
    }

    return result;
  }

  /**
   * Strip steganographic prefixes, returning the original source text.
   * Also strips the .qbit header comment if present.
   * @param {string} content - .qbit encoded text
   * @returns {string} Original source
   */
  function strip(content) {
    var lines = content.split("\n");
    var result = [];

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];

      // Drop header line
      if (raw.trimLeft().startsWith("# beyondBINARY")) continue;

      if (raw.length >= 5) {
        var prefix = raw.slice(0, 5);
        var hasSteno = false;
        for (var c = 0; c < 5; c++) {
          if (SPACE_TO_IDX[prefix[c]] !== undefined && prefix[c] !== "\u0020") {
            hasSteno = true;
            break;
          }
        }
        if (hasSteno) {
          result.push(raw.slice(5));
          continue;
        }
      }
      result.push(raw);
    }

    return result.join("\n");
  }

  /**
   * Determine whether a string contains .qbit steganographic data.
   * @param {string} content - Any text
   * @returns {boolean}
   */
  function isEncoded(content) {
    var lines = content.split("\n");
    var checked = 0;
    for (var i = 0; i < lines.length && checked < 10; i++) {
      var raw = lines[i];
      if (raw.trimLeft().startsWith("# beyondBINARY")) continue;
      if (raw.length >= 5) {
        var prefix = raw.slice(0, 5);
        for (var c = 0; c < 5; c++) {
          if (SPACE_TO_IDX[prefix[c]] !== undefined && prefix[c] !== "\u0020")
            return true;
        }
        checked++;
      }
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // § 6  HEADER  (Layer 4)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Build the .qbit file header comment string.
   * Format: `# beyondBINARY quantum-prefixed | <source> | coverage: <N>% | <M> lines | {syms}`
   * @param {string} source - Source label (filename, URL, etc.)
   * @param {{coverage: number, totalLines: number, counts: Object}} stats
   * @returns {string}
   */
  function makeHeader(source, stats) {
    var usedSyms = SYMBOLS.filter(function (s) {
      return stats.counts && stats.counts[s] > 0;
    });
    var symList =
      usedSyms.length > 0 ? usedSyms.join(", ") : SYMBOLS.join(", ");
    return (
      "# beyondBINARY quantum-prefixed | " +
      (source || "unknown") +
      " | " +
      "coverage: " +
      (stats.coverage || 0) +
      "% | " +
      (stats.totalLines || 0) +
      " lines | " +
      "{" +
      symList +
      "}"
    );
  }

  /**
   * Parse a .qbit header comment line into structured fields.
   * @param {string} content - Full file text (checks first line)
   * @returns {{source: string, coverage: number, lines: number, prefixes: string[]}|null}
   */
  function parseHeader(content) {
    var firstLine = content.split("\n")[0];
    var m = firstLine.match(
      /^# beyondBINARY quantum-prefixed \| (.+?) \| coverage: (\d+)% \| (\d+) lines \| \{([^}]*)\}/,
    );
    if (!m) return null;
    var prefixes = m[4]
      .split(",")
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    return {
      source: m[1].trim(),
      coverage: parseInt(m[2], 10),
      lines: parseInt(m[3], 10),
      prefixes: prefixes,
    };
  }

  /**
   * Encode content, prepend the .qbit header, and return the full wrapped string.
   * @param {string} content       - Raw source text
   * @param {string} [lang]        - Language hint
   * @param {string} [source]      - Source label
   * @returns {string}
   */
  function wrap(content, lang, source) {
    var result = encode(content, lang, source);
    var header = makeHeader(source || "unknown", result.stats);
    return header + "\n" + result.code;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // § 7  FORMATTER SUPPORT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Extract steno metadata from encoded content so an external formatter can
   * work on the clean source without destroying the metadata.
   * @param {string} content - .qbit encoded text
   * @returns {{metadata: Array.<{line: number, prefix: string}>, clean: string}}
   */
  function extract(content) {
    var lines = content.split("\n");
    var metadata = [];
    var cleanLines = [];

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];

      if (raw.length >= 5) {
        var prefix = raw.slice(0, 5);
        var hasSteno = false;
        for (var c = 0; c < 5; c++) {
          if (SPACE_TO_IDX[prefix[c]] !== undefined && prefix[c] !== "\u0020") {
            hasSteno = true;
            break;
          }
        }
        if (hasSteno) {
          metadata.push({ line: i, prefix: prefix });
          cleanLines.push(raw.slice(5));
          continue;
        }
      }
      cleanLines.push(raw);
    }

    return { metadata: metadata, clean: cleanLines.join("\n") };
  }

  /**
   * Re-inject previously extracted steno metadata back into reformatted content.
   * Lines are matched by index position. If the formatted output has a different
   * line count, steno is re-encoded from scratch.
   * @param {string} formatted   - Reformatted clean source
   * @param {{metadata: Array, clean: string}} extracted - Object from extract()
   * @returns {string} Re-encoded .qbit content
   */
  function reinject(formatted, extracted) {
    var formattedLines = formatted.split("\n");
    var originalLines = extracted.clean.split("\n");

    // If line counts match, reapply metadata positionally
    if (formattedLines.length === originalLines.length) {
      var metaByLine = {};
      extracted.metadata.forEach(function (m) {
        metaByLine[m.line] = m.prefix;
      });

      return formattedLines
        .map(function (line, i) {
          return metaByLine[i] ? metaByLine[i] + line : line;
        })
        .join("\n");
    }

    // Fallback: re-encode from scratch
    return encode(formatted).code;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // § 8  RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Escape HTML special characters.
   * @param {string} s
   * @returns {string}
   */
  function escapeHTML(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Render a coloured HTML <pre> block with a symbol gutter alongside source lines.
   * @param {string} content - Raw (or encoded) source text
   * @param {string} [lang]  - Language hint
   * @param {{fontSize?: string, fontFamily?: string, showGates?: boolean}} [opts]
   * @returns {string} HTML string
   */
  function renderGutterHTML(content, lang, opts) {
    opts = opts || {};
    var clean = isEncoded(content) ? strip(content) : content;
    var classified = classify(clean, lang || detectLang(clean));
    var fontSize = opts.fontSize || "13px";
    var fontFamily = opts.fontFamily || "monospace";
    var showGates = opts.showGates || false;

    var rows = classified.map(function (row) {
      var sym = row.sym;
      var color = SYM_COLOR[sym] || SYM_COLOR[" "];
      var label = sym.trim() || "\u00B7"; // middle dot for neutral
      var gate =
        showGates && row.gate
          ? ' <span style="opacity:.5;font-size:.8em">[' + row.gate + "]</span>"
          : "";
      return (
        '<div style="display:flex;align-items:baseline">' +
        '<span style="color:' +
        color +
        ';min-width:3.2em;user-select:none;padding-right:.5em;text-align:right">' +
        escapeHTML(label) +
        gate +
        "</span>" +
        '<span style="color:#e6edf3">' +
        escapeHTML(row.code) +
        "</span>" +
        "</div>"
      );
    });

    return (
      '<pre style="' +
      "font-family:" +
      fontFamily +
      ";" +
      "font-size:" +
      fontSize +
      ";" +
      "background:#0d1117;" +
      "padding:1em;" +
      "border-radius:6px;" +
      "overflow:auto;" +
      "line-height:1.5" +
      '">' +
      rows.join("\n") +
      "</pre>"
    );
  }

  /**
   * Render a plain-text gutter annotation suitable for terminal output.
   * @param {string} content - Raw (or encoded) source text
   * @param {string} [lang]  - Language hint
   * @returns {string}
   */
  function renderGutterText(content, lang) {
    var clean = isEncoded(content) ? strip(content) : content;
    var classified = classify(clean, lang || detectLang(clean));
    return classified
      .map(function (row) {
        var label = (row.sym.trim() || ".").padEnd(4);
        return label + "  " + row.code;
      })
      .join("\n");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // § 9  STATS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Compute statistics for a source string.
   * Entropy is the Shannon entropy (bits) of the symbol distribution.
   * @param {string} content - Raw source text
   * @param {string} [lang]  - Language hint
   * @returns {{totalLines: number, classified: number, coverage: number, counts: Object, entropy: number}}
   */
  function stats(content, lang) {
    var detectedLang = lang || detectLang(content);
    var classified = classify(content, detectedLang);
    var counts = {};
    var classifiedN = 0;

    SYMBOLS.forEach(function (s) {
      counts[s] = 0;
    });

    classified.forEach(function (row) {
      if (row.sym !== " ") {
        counts[row.sym] = (counts[row.sym] || 0) + 1;
        classifiedN++;
      }
    });

    var total = classified.length;
    var coverage = total > 0 ? Math.round((classifiedN / total) * 100) : 0;

    // Shannon entropy over classified symbols
    var entropy = 0;
    if (classifiedN > 0) {
      SYMBOLS.forEach(function (s) {
        var p = counts[s] / classifiedN;
        if (p > 0) entropy -= p * Math.log2(p);
      });
    }

    return {
      totalLines: total,
      classified: classifiedN,
      coverage: coverage,
      counts: counts,
      entropy: Math.round(entropy * 1000) / 1000,
      lang: detectedLang,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // § 10  SELF-TEST
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Run 5 encode → decode → strip round-trip tests on embedded samples.
   * Each test verifies that strip(encode(src).code) === src.
   * @returns {{pass: boolean, tests: Array.<{name: string, pass: boolean, detail: string}>}}
   */
  function selfTest() {
    var samples = [
      {
        name: "Python 3-liner",
        lang: "python",
        src: 'def greet(name):\n    return "Hello, " + name\nprint(greet("world"))',
      },
      {
        name: "JavaScript 3-liner",
        lang: "javascript",
        src: "const add = (a, b) => a + b;\nlet result = add(1, 2);\nconsole.log(result);",
      },
      {
        name: "Rust 3-liner",
        lang: "rust",
        src: 'fn main() {\n    let x = 42;\n    println!("{}", x);\n}',
      },
      {
        name: "Bash shebang line",
        lang: "shell",
        src: '#!/usr/bin/env bash\necho "hello qbit"',
      },
      {
        name: "HTML comment line",
        lang: "html",
        src: "<!-- qbitOS header -->\n<html>\n<body>hello</body>\n</html>",
      },
    ];

    var tests = samples.map(function (s) {
      try {
        var encoded = encode(s.src, s.lang, s.name);
        var stripped = strip(encoded.code);
        var pass = stripped === s.src;
        // Also verify decode works
        var decoded = decode(encoded.code);
        var decodedPass = decoded.length === s.src.split("\n").length;
        var allPass = pass && decodedPass;
        return {
          name: s.name,
          pass: allPass,
          detail: allPass
            ? "OK — encode/decode/strip round-trip passed"
            : "FAIL — " +
              (pass ? "" : "strip mismatch ") +
              (decodedPass ? "" : "decode length mismatch"),
        };
      } catch (e) {
        return { name: s.name, pass: false, detail: "ERROR — " + e.message };
      }
    });

    var allPass = tests.every(function (t) {
      return t.pass;
    });
    return { pass: allPass, tests: tests };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // § 11  PUBLIC API OBJECT
  // ─────────────────────────────────────────────────────────────────────────────

  var QbitCodec = {
    // Meta
    version: VERSION,

    // Constant tables
    SYMBOLS: SYMBOLS,
    GATES: GATES,
    CATEGORIES: CATEGORIES,
    SYM_COLOR: SYM_COLOR,
    GATE_MAP: GATE_MAP,

    // Core classification
    classifyLine: classifyLine,
    classify: classify,

    // Steno encode / decode
    encode: encode,
    decode: decode,
    strip: strip,
    isEncoded: isEncoded,

    // Header
    makeHeader: makeHeader,
    parseHeader: parseHeader,
    wrap: wrap,

    // Formatter support
    extract: extract,
    reinject: reinject,

    // Render helpers
    renderGutterHTML: renderGutterHTML,
    renderGutterText: renderGutterText,

    // Stats
    stats: stats,

    // Language detection
    detectLang: detectLang,

    // Nesting depth helper
    lineDepth: lineDepth,

    // Self-test
    selfTest: selfTest,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // § 12  UNIVERSAL MODULE EXPORT
  // ─────────────────────────────────────────────────────────────────────────────

  // Browser global
  if (typeof root !== "undefined") {
    root.QbitCodec = QbitCodec;
  }

  // Node.js CommonJS
  if (typeof module !== "undefined" && module.exports) {
    module.exports = QbitCodec;
  }

  // CommonJS exports object (Browserify, etc.)
  if (typeof exports !== "undefined") {
    exports.QbitCodec = QbitCodec;
  }

  // ESM export hint (bundlers that understand this pattern)
  // Real ESM callers: `import QbitCodec from './qbit-codec.js'`
  // will receive module.exports via interop in most bundlers.
})(
  typeof window !== "undefined"
    ? window
    : typeof globalThis !== "undefined"
      ? globalThis
      : this,
);

// ESM named export guard (for bundlers / native ESM environments that support top-level export)
// Uncomment if targeting pure ESM build:
// export default (typeof window !== 'undefined' ? window.QbitCodec : module.exports);
