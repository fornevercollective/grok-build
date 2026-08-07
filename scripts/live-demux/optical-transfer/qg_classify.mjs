#!/usr/bin/env node
/**
 * qg_classify.mjs — bridge to uvspeed web/quantum-prefixes.js
 * stdin: source text  OR  argv --file path
 * stdout: fc-quantum-gutter-v2 JSON (structural index + rows)
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  process.env.UVSPEED_QP || '',
  path.resolve(__dirname, '../../../../uvspeed/web/quantum-prefixes.js'),
  '/Volumes/qbitOS/00.dev/projects/uvspeed/web/quantum-prefixes.js',
  path.resolve(process.env.HOME || '', 'dev/projects/uvspeed/web/quantum-prefixes.js'),
].filter(Boolean);

function loadEngine() {
  let src = null, used = null;
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) { src = fs.readFileSync(p, 'utf8'); used = p; break; }
    } catch {}
  }
  if (!src) throw new Error('quantum-prefixes.js not found; set UVSPEED_QP');
  const ctx = {
    window: {},
    console,
    BroadcastChannel: class { constructor(){} postMessage(){} close(){} addEventListener(){} },
    localStorage: { getItem(){return null}, setItem(){}, removeItem(){} },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const qp = ctx.window.QuantumPrefixes;
  if (!qp) throw new Error('QuantumPrefixes not exported');
  return { qp, engine_path: used };
}

/** Structural sections so you can flow class/function/div without spooling the lake. */
function buildSections(lines, classified) {
  const sections = [];
  const stack = []; // {idx, start, depth, kind, name, sym}
  const openers = new Set(['class', 'function', 'shebang']);
  // HTML/markdown "card-like" openers also act as sections
  const blockCats = new Set(['class', 'function']);

  function depthOf(code) {
    let n = 0;
    for (let i = 0; i < code.length; i++) {
      const ch = code[i];
      if (ch === ' ') n++;
      else if (ch === '\t') n += 2;
      else break;
    }
    return Math.floor(n / 2);
  }
  function nameFrom(code, cat) {
    const s = code.trim();
    let m;
    if (cat === 'class') {
      m = s.match(/^(?:export\s+)?(?:public\s+)?(?:class|struct|enum|trait|interface|type|impl)\s+([A-Za-z_][\w.]*)/);
      if (m) return m[1];
      m = s.match(/^<\s*(div|section|article|main|header|footer|nav|card)[^>]*?(?:id|class)=["']([^"']+)/i);
      if (m) return `${m[1]}#${m[2]}`;
      m = s.match(/^<\s*(div|section|article|main|header|footer|nav)\b/i);
      if (m) return m[1];
    }
    if (cat === 'function') {
      m = s.match(/^(?:export\s+)?(?:async\s+)?(?:def|fn|func|function|fun|proc)\s+([A-Za-z_][\w]*)/);
      if (m) return m[1];
      m = s.match(/^(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_][\w]*)/);
      if (m) return m[1];
    }
    if (cat === 'shebang') return 'entry';
    return (s.slice(0, 40) || cat);
  }

  for (let i = 0; i < classified.length; i++) {
    const row = classified[i];
    const code = lines[i] || '';
    const d = depthOf(code);
    const cat = row.category || 'default';
    // close sections deeper than current
    while (stack.length && d < stack[stack.length - 1].depth) {
      const top = stack.pop();
      sections[top.idx].end_line = i; // exclusive end = this line
      sections[top.idx].line_count = sections[top.idx].end_line - sections[top.idx].start_line;
    }
    if (blockCats.has(cat) || (cat === 'class')) {
      // close same-depth peers
      while (stack.length && stack[stack.length - 1].depth === d && blockCats.has(stack[stack.length - 1].kind)) {
        const top = stack.pop();
        sections[top.idx].end_line = i;
        sections[top.idx].line_count = sections[top.idx].end_line - sections[top.idx].start_line;
      }
      const name = nameFrom(code, cat);
      const path = [...stack.map(s => s.name), name].join('/');
      const idx = sections.length;
      sections.push({
        id: `sec-${idx}`,
        kind: cat,
        sym: row.sym,
        gate: row.gate || null,
        name,
        path,
        start_line: i + 1,
        end_line: null,
        depth: d,
        parent: stack.length ? sections[stack[stack.length - 1].idx].id : null,
        children: [],
      });
      if (stack.length) {
        sections[stack[stack.length - 1].idx].children.push(`sec-${idx}`);
      }
      stack.push({ idx, start: i, depth: d, kind: cat, name, sym: row.sym });
    }
  }
  while (stack.length) {
    const top = stack.pop();
    sections[top.idx].end_line = classified.length;
    sections[top.idx].line_count = sections[top.idx].end_line - sections[top.idx].start_line + 0;
  }
  // fix end_line nulls
  for (const s of sections) {
    if (s.end_line == null) s.end_line = classified.length;
    if (!s.line_count) s.line_count = Math.max(0, s.end_line - s.start_line + 1);
  }
  return sections;
}

function byCategory(rows) {
  const map = {};
  for (const r of rows) {
    const c = r.category || 'default';
    if (!map[c]) map[c] = [];
    map[c].push({ line: r.line, sym: r.sym, name: (r.code || '').trim().slice(0, 80) });
  }
  return map;
}

function main() {
  const args = process.argv.slice(2);
  let file = null, langHint = null, section = null, category = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file') file = args[++i];
    else if (args[i] === '--lang') langHint = args[++i];
    else if (args[i] === '--section') section = args[++i];
    else if (args[i] === '--category') category = args[++i];
  }
  let text = '';
  if (file) text = fs.readFileSync(file, 'utf8');
  else {
    text = fs.readFileSync(0, 'utf8'); // stdin
  }
  const { qp, engine_path } = loadEngine();
  const lang = qp.detectLanguage(text, langHint || undefined);
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const GATES = { 'n:':'SWAP','+1:':'H','-n:':'M','+0:':'Rz','0:':'I','-1:':'X','+n:':'T','+2:':'CZ','-0:':'S','+3:':'Y','1:':'CNOT','   ':'',' ':'' };
  const rows = lines.map((code, i) => {
    const r = qp.classifyLine(code, lang);
    const sym = (r.sym || '   ').trim() || ' ';
    return {
      line: i + 1,
      sym: r.sym,
      category: r.category,
      gate: GATES[r.sym] || GATES[sym] || '',
      color: r.color,
      cls: r.cls,
      depth: (() => { let n=0; for (const ch of code) { if (ch===' ') n++; else if (ch==='\t') n+=2; else break;} return Math.floor(n/2); })(),
      code: code.slice(0, 200),
    };
  });
  const classified = rows.filter(r => r.category && r.category !== 'default').length;
  const hist = {};
  for (const r of rows) hist[r.sym] = (hist[r.sym] || 0) + 1;
  const sections = buildSections(lines, rows);
  const index_by_category = byCategory(rows);

  // optional slice
  let view_rows = rows;
  let view_source = text;
  let focus = null;
  if (section) {
    const sec = sections.find(s => s.name === section || s.path === section || s.id === section || (s.path && s.path.endsWith('/'+section)));
    if (sec) {
      focus = sec;
      const a = sec.start_line - 1;
      const b = sec.end_line; // exclusive in our builder when closed on next opener; inclusive-ish
      view_rows = rows.slice(a, Math.max(a+1, b));
      view_source = lines.slice(a, Math.max(a+1, b)).join('\n');
    }
  }
  if (category) {
    focus = { kind: 'category_filter', category };
    view_rows = rows.filter(r => r.category === category);
  }

  const meta = qp.prefixMetadata(text, lang);
  const out = {
    schema: 'fc-quantum-gutter-v2',
    ok: true,
    engine: {
      name: 'uvspeed/quantum-prefixes.js',
      path: engine_path,
      live_demo: 'https://mueee.qbitos.ai/quantum-gutter.html',
      local_html: engine_path.replace(/quantum-prefixes\.js$/, 'quantum-gutter.html'),
      languages_note: '59+ LANG_PATTERNS · dedicated path O(L×R) not full-stream scan',
    },
    iron_line: {
      layer: 'L3',
      name: 'Quantum Terminal',
      budget: '50µs classify / line class',
      bus: ['quantum-prefixes', 'iron-line'],
      pipeline: ['raw text', 'detectLanguage', 'classifyLine×L', 'structural sections', 'by_category index', 'navigate without spool'],
    },
    language: lang,
    origin: file || 'stdin',
    name: file ? path.basename(file) : 'stdin',
    coverage_pct: meta.totalLines ? Math.round(1000 * classified / meta.totalLines) / 10 : 0,
    lines_total: lines.length,
    lines_classified: classified,
    histogram: hist,
    prefix_counts: meta.prefixCounts,
    gutter_stream: rows.map(r => (r.sym || '·').trim() || '·').join(' '),
    // structural organization — the point of the system
    sections,
    index_by_category,
    navigate: {
      list_sections: sections.map(s => ({ id: s.id, kind: s.kind, name: s.name, path: s.path, lines: [s.start_line, s.end_line] })),
      by_category_keys: Object.keys(index_by_category),
      howto: 'GET ?section=QuantumState or ?category=function — flow through cards/divs/classes without loading the whole lake',
    },
    focus,
    rows: view_rows,
    left: {
      role: 'source_code',
      lang,
      lines: view_rows.map(r => r.code),
      raw: view_source.slice(0, 32000),
    },
    right: {
      role: 'quantum_gutter',
      title: `${classified}/${lines.length} classified · ${meta.totalLines ? Math.round(1000*classified/meta.totalLines)/10 : 0}% coverage`,
      symbols: view_rows.map(r => ({
        line: r.line, sym: r.sym, gate: r.gate, category: r.category, depth: r.depth, code: r.code,
      })),
    },
    symbols_table: [
      { i:0, symbol:'n:',  gate:'SWAP', category:'shebang' },
      { i:1, symbol:'+1:', gate:'H',    category:'comment' },
      { i:2, symbol:'-n:', gate:'M',    category:'import' },
      { i:3, symbol:'+0:', gate:'Rz',   category:'class' },
      { i:4, symbol:'0:',  gate:'I',    category:'function' },
      { i:5, symbol:'-1:', gate:'X',    category:'error' },
      { i:6, symbol:'+n:', gate:'T',    category:'condition' },
      { i:7, symbol:'+2:', gate:'CZ',   category:'loop' },
      { i:8, symbol:'-0:', gate:'S',    category:'return' },
      { i:9, symbol:'+3:', gate:'Y',    category:'output' },
      { i:10,symbol:'1:',  gate:'CNOT', category:'variable' },
    ],
  };
  process.stdout.write(JSON.stringify(out));
}
main();
