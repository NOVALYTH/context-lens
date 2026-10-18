#!/usr/bin/env node
// check-workspace.mjs - deterministic, read-only check of what a Claude Code workspace loads automatically.
// Usage: node scripts/check-workspace.mjs [--root <dir>] [--budget 8000]
// Exit code: 0 = OK (warnings possible), 1 = at least one error.
// Token estimate: 1 token ~ 4 bytes (a convention, not an exact count; real tokenizers differ by language and content).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULTS = { budget: 8000, skillBody: 800, skillDescription: 400, progress: 1200, errors: 800, decisionsFullRead: 10000 };
const tok = (p) => Math.floor(statSync(p).size / 4);

function findSkills(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (existsSync(join(p, 'SKILL.md'))) out.push(join(p, 'SKILL.md'));
      else out.push(...findSkills(p));
    }
  }
  return out;
}

// Resolve "@path" import lines of CLAUDE.md, recursively (cycle-safe, max 5 hops like Claude Code).
export function resolveImports(root, file, seen = new Set(), depth = 0) {
  const found = []; const missing = [];
  const text = readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = /^@(\S+)\s*$/.exec(line.trim());
    if (!m) continue;
    const p = resolve(dirname(file), m[1]);
    if (seen.has(p)) continue;
    seen.add(p);
    if (!existsSync(p)) { missing.push(m[1]); continue; }
    found.push(p);
    if (depth < 4 && p.endsWith('.md')) {
      const sub = resolveImports(root, p, seen, depth + 1);
      found.push(...sub.found); missing.push(...sub.missing);
    }
  }
  return { found, missing };
}

export function checkSkill(file, o = DEFAULTS) {
  const msgs = []; // [level, text]
  const dir = file.split(/[\\/]/).slice(-2, -1)[0];
  const txt = readFileSync(file, 'utf8');
  const fmm = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(txt);
  if (!fmm) return [['error', `skill ${dir}: YAML frontmatter missing (the catalog gets no description)`]];
  const fm = fmm[1];
  const nm = /^name:[ \t]*(.*?)[ \t]*$/m.exec(fm);
  if (!nm || nm[1] !== dir) msgs.push(['error', `skill ${dir}: 'name:' missing or different from the folder name`]);
  const d = /^description:\s*(.*)$/m.exec(fm);
  if (!d || d[1].trim().length < 20) msgs.push(['error', `skill ${dir}: 'description:' missing or shorter than 20 characters`]);
  else {
    const desc = d[1].trim();
    const quoted = /^["']/.test(desc);
    if (desc.length > o.skillDescription) msgs.push(['warn', `skill ${dir}: description is ${desc.length} characters (> ${o.skillDescription}); it is paid for in every session`]);
    if (!quoted && /: /.test(desc)) msgs.push(['error', `skill ${dir}: invalid YAML, an unquoted description contains ': ' (the skill silently disappears from the catalog); quote it or rephrase`]);
    if (!quoted && / #/.test(desc)) msgs.push(['warn', `skill ${dir}: ' #' starts a YAML comment in an unquoted description and truncates it`]);
  }
  const t = tok(file);
  if (t > o.skillBody) msgs.push(['warn', `skill ${dir}: ${t} tokens (> ${o.skillBody}); the body loads when the skill is invoked`]);
  return msgs;
}

export function check(root, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const out = []; const add = (level, text) => out.push({ level, text });
  const claude = join(root, 'CLAUDE.md');
  let total = 0; let files = 0;
  if (!existsSync(claude)) add('error', 'CLAUDE.md missing');
  else {
    total = tok(claude);
    const { found, missing } = resolveImports(root, claude);
    for (const p of found) { total += tok(p); files++; }
    for (const m of missing) add('error', `CLAUDE.md import not found: ${m}`);
    for (const p of found) {
      const rel = relative(root, p).split(sep).join('/');
      if (/archive|DECISIONS/i.test(rel)) add('warn', `auto-imported file looks like an archive or a journal: ${rel} (it loads in every session)`);
    }
    add('info', `automatic imports: ${files} file(s), ~${total} tokens/session including CLAUDE.md (budget ${o.budget})`);
    if (total > o.budget) add('warn', `auto-import budget exceeded: ${total} > ${o.budget} tokens`);
  }
  const skills = findSkills(join(root, '.claude', 'skills'));
  for (const s of skills) for (const [level, text] of checkSkill(s, o)) add(level, text);
  add('info', `skills: ${skills.length} checked`);
  for (const [rel, max] of [['.claude/context/progress.md', o.progress], ['.claude/context/errors.md', o.errors]]) {
    const p = join(root, rel);
    if (!existsSync(p)) { add('warn', `${rel} missing`); continue; }
    const t = tok(p);
    if (t > max) add('warn', `${rel}: ${t} tokens (> ${max}); move old entries to the archive file`);
  }
  const dec = join(root, 'DECISIONS.md');
  if (existsSync(dec)) {
    const t = tok(dec);
    if (t > o.decisionsFullRead) add('info', `DECISIONS.md = ${t} tokens: do not read it whole, use: npm run search -- "<question>"`);
  }
  return { total, results: out, errors: out.filter((x) => x.level === 'error').length, warnings: out.filter((x) => x.level === 'warn').length };
}

export function main(argv) {
  const get = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
  const root = resolve(get('--root', '.'));
  const r = check(root, { budget: Number(get('--budget', DEFAULTS.budget)) });
  for (const x of r.results) console.log(({ error: 'ERROR  ', warn: 'WARN   ', info: 'info   ' })[x.level] + ' ' + x.text);
  console.log(`RESULT: ${r.errors} error(s), ${r.warnings} warning(s)`);
  return r.errors ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exit(main(process.argv.slice(2)));
