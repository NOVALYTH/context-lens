#!/usr/bin/env node
// decisions.mjs - find a fact in DECISIONS.md (and progress/errors files) without reading them whole, and check them for drift.
//   node scripts/decisions.mjs search "<question>" [--root .] [--file DECISIONS.md] [--limit 5] [--all] [--full] [--json]
//   node scripts/decisions.mjs get --file <relative path> --from <n> --to <m> [--root .]
//   node scripts/decisions.mjs verify [--root .] [--file DECISIONS.md] [--date YYYY-MM-DD] [--json]
//   node scripts/decisions.mjs stats [--root .]
// Default corpus under --root: DECISIONS.md, CLAUDE.md and .claude/context/{progress,errors}{,-archive}.md.
// --file replaces the default corpus by that single file. Optional drift config: <root>/.context-lens.json
//   { "journal": "DECISIONS.md", "staleDays": 14, "projects": [ { "key": "billing", "aliases": ["billing service"] } ] }
// The index lives in the OS temp folder and is rebuilt at every call (about 0.1 s): it cannot be stale.
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { buildDb, openDb, search, getLines, DEFAULT_FILES } from './search/lib.mjs';
import { analyze } from './search/detector.mjs';

const argv = process.argv.slice(2);
const cmd = argv.shift();
const flags = new Set(['all', 'full', 'json']);
const args = { _: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); if (flags.has(k)) args[k] = true; else args[k] = argv[++i]; } else args._.push(a);
}
const usage = () => { console.error('Usage: search "<question>" | get --file f --from n --to m | verify | stats   (options: --root dir --file f --limit n --all --full --json --date YYYY-MM-DD)'); process.exit(2); };
if (!['search', 'get', 'verify', 'stats'].includes(cmd)) usage();

const root = resolve(args.root ?? '.');
const files = args.file ? [args.file] : DEFAULT_FILES;
const cfgPath = join(root, '.context-lens.json');
const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {};
const dbPath = join(tmpdir(), 'context-lens', createHash('sha1').update(root + '|' + files.join(',')).digest('hex').slice(0, 12) + '.db');

if (cmd === 'get') {
  if (!args.file || !args.from || !args.to) usage();
  console.log(getLines(root, args.file, Number(args.from), Number(args.to)).join('\n'));
} else if (cmd === 'verify') {
  const findings = analyze(root, files, { today: args.date, staleDays: cfg.staleDays, projects: cfg.projects, journal: cfg.journal });
  if (args.json) console.log(JSON.stringify(findings.map(({ key, ...f }) => f), null, 1));
  else { console.log(`${findings.length} finding(s)`); for (const f of findings) console.log(`[${f.severity}] ${f.rule} ${f.file}:${f.line} - ${f.message}`); }
} else {
  const built = buildDb(root, dbPath, files);
  if (!built.chunks) { console.error('nothing to index: no matching file under ' + root); process.exit(1); }
  const db = openDb(dbPath);
  if (cmd === 'stats') {
    const n = db.prepare('SELECT COUNT(*) AS n, COUNT(DISTINCT file) AS f, SUM(chars) AS c FROM chunks').get();
    console.log(`${n.n} segments, ${n.f} files, ${n.c} characters indexed`);
  } else {
    const q = args._.join(' ');
    if (!q) usage();
    const t0 = performance.now();
    const rows = search(db, q, { limit: Number(args.limit ?? 5), all: Boolean(args.all) });
    const ms = performance.now() - t0;
    if (args.json) console.log(JSON.stringify({ query: q, ms: Number(ms.toFixed(1)), results: rows.map(({ text, ...r }) => (args.full ? { ...r, text } : r)) }));
    else {
      console.log(`query "${q}": ${rows.length} result(s), ${ms.toFixed(1)} ms`);
      rows.forEach((r, i) => {
        console.log(`#${i + 1} ${r.file}:${r.start}-${r.end}${r.did ? ` [${r.did}]` : ''} ${r.heading} (score ${r.score.toFixed(2)})`);
        console.log(args.full ? r.text : `   ${r.snippet.replace(/\s+/g, ' ')}`);
      });
    }
  }
}
