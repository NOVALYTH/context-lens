#!/usr/bin/env node
// measure-context.mjs - read-only. Where do the tokens of a Claude Code session come from?
// Usage: node scripts/measure-context.mjs [transcript.jsonl] [--window 200000] [--json]
// Without a file argument: the most recent session of the project in the current directory.
// Token counts for context size come from the API "usage" fields. The split of content
// (visible text vs. hidden reasoning vs. tool results) is an ESTIMATE at ~3.3 characters per token.
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CPT = 3.3; // characters per token (estimate)
const k = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + ' M' : Math.round(n / 1000) + ' k');
const size = (c) =>
  typeof c === 'string' ? c.length
  : Array.isArray(c) ? c.reduce((s, b) => s + (b?.type === 'image' ? 0 : JSON.stringify(b ?? '').length), 0)
  : JSON.stringify(c ?? '').length;

export function projectDir(cwd = resolve('.')) {
  const base = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  return join(base, 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'));
}

export function latestTranscript(cwd) {
  const dir = projectDir(cwd);
  if (!existsSync(dir)) throw new Error('no transcript folder for this directory: ' + dir);
  const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => ({ f: join(dir, f), t: statSync(join(dir, f)).mtimeMs }));
  if (!files.length) throw new Error('no .jsonl transcript in ' + dir);
  return files.sort((a, b) => b.t - a.t)[0].f;
}

// Parse a transcript into one entry per assistant API call ("turn").
export async function readTurns(file) {
  const turns = []; const index = new Map(); const tools = new Map();
  let current = null; let images = 0;
  const rl = createInterface({ input: createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.isSidechain || !o.message) continue;
    const m = o.message; const c = Array.isArray(m.content) ? m.content : [];
    if (o.type === 'assistant' && m.id) {
      if (!index.has(m.id) && m.usage) {
        const u = m.usage;
        current = { ctx: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), out: 0, visible: 0, input: {} };
        index.set(m.id, turns.length); turns.push(current);
      }
      const t = turns[index.get(m.id)]; if (!t) continue;
      t.out = Math.max(t.out, m.usage?.output_tokens || 0);
      for (const b of c) {
        if (b.type === 'thinking') t.visible += (b.thinking || '').length;
        else if (b.type === 'text') t.visible += (b.text || '').length;
        else if (b.type === 'tool_use') { t.visible += JSON.stringify(b.input || {}).length + 30; tools.set(b.id, b.name); }
      }
    } else if (o.type === 'user' && current) {
      const add = (name, n) => { current.input[name] = (current.input[name] || 0) + n; };
      if (typeof m.content === 'string') add('user text', m.content.length);
      for (const b of c) {
        if (b.type === 'text') add('user text', (b.text || '').length);
        else if (b.type === 'tool_result') {
          add(tools.get(b.tool_use_id) || '?', size(b.content));
          if (Array.isArray(b.content)) images += b.content.filter((z) => z.type === 'image').length;
        }
      }
    }
  }
  return { turns, images };
}

// A compaction or /clear makes the context drop by more than half: split there.
export function segmentsOf(turns) {
  const segs = []; let start = 0;
  for (let i = 1; i <= turns.length; i++) {
    if (i === turns.length || turns[i].ctx < turns[i - 1].ctx * 0.5) { if (i - start >= 5) segs.push(turns.slice(start, i)); start = i; }
  }
  return segs;
}

export function analyseSegment(s, windowSize = 200000) {
  const reading = s.reduce((a, t) => a + t.ctx, 0);
  const written = s.slice(0, -1).reduce((a, t) => a + t.out, 0);
  const visible = s.slice(0, -1).reduce((a, t) => a + t.visible / CPT, 0);
  const growth = s[s.length - 1].ctx - s[0].ctx;
  const inputs = Math.max(0, growth - written);
  const byTool = {};
  for (const t of s) for (const [name, ch] of Object.entries(t.input)) byTool[name] = (byTool[name] || 0) + ch;
  // Simulation: same growth, but compact when the window is exceeded (context falls back to min(112k, window/2)).
  let c = s[0].ctx; let sum = 0; let compactions = 0;
  for (let i = 1; i < s.length; i++) {
    c += s[i].ctx - s[i - 1].ctx;
    if (c > windowSize) { sum += c; compactions++; c = Math.min(112000, windowSize / 2); }
    sum += c;
  }
  return {
    turns: s.length, firstCtx: s[0].ctx, lastCtx: s[s.length - 1].ctx, meanCtx: reading / s.length,
    cumulativeReading: reading, growth, written, visible, hidden: Math.max(0, written - visible), inputs,
    topTools: Object.entries(byTool).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, ch]) => [name, ch / CPT]),
    simulated: { window: windowSize, reading: sum, compactions },
  };
}

export async function main(argv) {
  const iW = argv.indexOf('--window');
  const windowSize = iW >= 0 ? Number(argv[iW + 1]) : 200000;
  const json = argv.includes('--json');
  const fileArg = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--window');
  const file = fileArg || latestTranscript(resolve('.'));
  const { turns, images } = await readTurns(file);
  const segments = segmentsOf(turns).map((s) => analyseSegment(s, windowSize));
  if (json) { console.log(JSON.stringify({ file: file.split(/[\\/]/).pop(), turns: turns.length, images, segments }, null, 1)); return; }
  console.log(`${file.split(/[\\/]/).pop()}: ${turns.length} turns, ${images} images, ${segments.length} context segment(s)`);
  if (!segments.length) console.log('Fewer than 5 turns in any segment: nothing to report.');
  segments.forEach((a, n) => {
    const pct = (x) => (a.growth > 0 ? Math.round((100 * x) / a.growth) : 0);
    console.log(`\nSegment ${n + 1}: ${a.turns} turns, context ${k(a.firstCtx)} -> ${k(a.lastCtx)} (mean ${k(a.meanCtx)}), cumulative reading ${k(a.cumulativeReading)}`);
    console.log(`  written by the model: ${k(a.written)} (${pct(a.written)} % of growth), of which ~${k(a.visible)} visible, ~${k(a.hidden)} hidden reasoning`);
    console.log(`  inputs (tool results, messages): ~${k(a.inputs)} (${pct(a.inputs)} %): ` + a.topTools.map(([name, t]) => `${name} ${k(t)}`).join(', '));
    console.log(`  with compaction at ${k(a.simulated.window)}: reading ~${k(a.simulated.reading)} (${a.simulated.compactions} compactions), i.e. ${Math.round((100 * a.simulated.reading) / a.cumulativeReading)} % of actual`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((e) => { console.error('error: ' + e.message); process.exit(1); });
}
