// Deterministic detector of contradictions and documentary drift. Zero dependency, no LLM.
// Input: Markdown files (a DECISIONS.md journal plus progress/errors/CLAUDE.md). Output: findings with evidence.
// It does not decide which document is right: it reports the rule broken and a reproducible proof.
// Deliberately bounded: explicit rules only. A free-form semantic contradiction is NOT detected.
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { listFiles, DEC } from './lib.mjs';

const ANY_HEAD = /^#{1,6}\s+/;
const IDREF = /\bD-\d{3}\b/g;
const FENCE = /^```/;
export const STALE_DAYS = 14;
const PAUSE = /on hold|paused|frozen|suspended|shelved/i;
const ACTIVE = /top priority|\bpriority\b|\bactive\b|\bin progress\b/i;

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

function fenceMap(lines) {
  let inside = false;
  return lines.map((l) => { if (FENCE.test(l)) { inside = !inside; return true; } return inside; });
}

function dayDiff(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number); const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function parseDecisions(files) {
  const defs = [];
  for (const [rel, lines] of files) {
    const fence = fenceMap(lines);
    lines.forEach((l, i) => {
      if (fence[i]) return;
      const m = DEC.exec(l);
      if (!m) return;
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j++) if (!fence[j] && ANY_HEAD.test(lines[j])) { end = j; break; }
      const body = lines.slice(i, end);
      const date = body.map((x) => /\*\*Date\*\*\s*:\s*(\d{4}-\d{2}-\d{2})/.exec(x)).find(Boolean);
      const si = body.findIndex((x) => /^\*\*Status\*\*\s*:/.test(x));
      defs.push({ id: m[1], title: m[2].trim(), file: rel, line: i + 1, end, date: date ? date[1] : null, status: si >= 0 ? body[si] : '', statusLine: si >= 0 ? i + 1 + si : i + 1, body });
    });
  }
  return defs;
}

// opts: { today: 'YYYY-MM-DD', staleDays, projects: [{ key, aliases: [] }], journal: 'DECISIONS.md' }
export function analyze(root, files, opts = {}) {
  const { today = new Date().toISOString().slice(0, 10), staleDays = STALE_DAYS, projects = [], journal = 'DECISIONS.md' } = opts;
  const loaded = new Map();
  for (const rel of listFiles(root, files)) loaded.set(rel, readFileSync(join(root, rel), 'utf8').split(/\r?\n/));
  const defs = parseDecisions(loaded).filter((d) => basename(d.file) === journal);
  const ids = new Set(defs.map((d) => d.id));
  const findings = [];
  const add = (rule, severity, file, line, message) => findings.push({ rule, severity, file, line, message, key: `${rule}|${file}|${message}` });

  // 1. Duplicate identifier.
  const seen = new Map();
  for (const d of defs) {
    if (seen.has(d.id)) add('duplicate-id', 'high', d.file, d.line, `${d.id} defined twice: lines ${seen.get(d.id)} and ${d.line}`);
    else seen.set(d.id, d.line);
  }

  // 2. Reference to an identifier that does not exist (code blocks and the heading lines themselves are skipped).
  for (const [rel, lines] of loaded) {
    const fence = fenceMap(lines);
    lines.forEach((l, i) => {
      if (fence[i] || DEC.test(l)) return;
      for (const m of l.matchAll(IDREF)) {
        if (!ids.has(m[0])) add('missing-reference', 'medium', rel, i + 1, `reference to ${m[0]} which is not in the decision journal: "${l.trim().slice(0, 110)}"`);
      }
    });
  }

  // 3. Supersession not marked on the target.
  const relations = [];
  for (const s of defs) {
    const t = /Amendment (?:to|of)\s+(D-\d{3})/i.exec(s.title);
    if (t) relations.push([s, t[1], s.line]);
    s.body.forEach((l, k) => {
      const m = /\*\*(?:Amends|Replaces|Supersedes)\*\*\s*:\s*(.*)$/.exec(l);
      if (m) for (const target of m[1].match(IDREF) ?? []) relations.push([s, target, s.line + k]);
    });
  }
  const done = new Set();
  for (const [s, tid, ln] of relations) {
    if (tid === s.id) continue;
    const target = defs.find((d) => d.id === tid);
    if (!target || done.has(`${s.id}>${tid}`)) continue;
    done.add(`${s.id}>${tid}`);
    const st = norm(target.status);
    if (!(st.includes(norm(s.id)) && /amend|replac|supersed/.test(st))) {
      add('unmarked-supersession', 'high', target.file, target.statusLine, `${target.id} is not marked amended, replaced or superseded by ${s.id}, which declares it (${s.file}:${ln})`);
    }
  }

  // 4. Stale dated claim (older than staleDays), outside the decision journal.
  const DATE_PAT = /(verified on|last updated|updated|DATE)\W{0,6}(\d{4}-\d{2}-\d{2})/gi;
  for (const [rel, lines] of loaded) {
    if (basename(rel) === journal) continue;
    lines.forEach((l, i) => {
      for (const m of l.matchAll(DATE_PAT)) {
        const age = dayDiff(m[2], today);
        if (age > staleDays) add('stale-date', 'medium', rel, i + 1, `date ${m[2]} (${age} days before ${today}): "${l.trim().slice(0, 100)}"`);
      }
    });
  }

  // 5. Status claim against the latest decision (optional: needs "projects" in the configuration).
  if (projects.length) {
    const derived = new Map();
    const ordered = [...defs].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.line - b.line);
    for (const d of ordered) for (const l of d.body) for (const clause of l.split(/(?<=[.;])\s+/)) {
      const low = clause.toLowerCase();
      for (const p of projects) {
        if (!p.aliases.some((a) => low.includes(a.toLowerCase()))) continue;
        const pause = PAUSE.test(clause); const active = ACTIVE.test(clause);
        if (pause && !active) derived.set(p.key, { status: 'pause', id: d.id, date: d.date });
        else if (active && !pause) derived.set(p.key, { status: 'active', id: d.id, date: d.date });
      }
    }
    for (const [rel, lines] of loaded) {
      if (basename(rel) === journal) continue;
      lines.forEach((l, i) => {
        for (const clause of l.split(/(?<=[.;])\s+/)) {
          const low = clause.toLowerCase();
          for (const p of projects) {
            const dv = derived.get(p.key);
            if (!dv || dv.status !== 'pause' || !p.aliases.some((a) => low.includes(a.toLowerCase()))) continue;
            if (ACTIVE.test(clause) && !PAUSE.test(clause)) add('claim-against-decision', 'high', rel, i + 1, `${p.key} presented as active while ${dv.id} (${dv.date}) puts it on hold: "${clause.trim().slice(0, 120)}"`);
          }
        }
      });
    }
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
  return findings;
}

export function newFindings(baseline, current) {
  const known = new Set(baseline.map((f) => f.key));
  return current.filter((f) => !known.has(f.key));
}
