// Full-text index and search over Markdown files (SQLite FTS5 + BM25 through node:sqlite, Node 22.5+).
// Zero dependency, no network. The index is DERIVED: it is rebuilt from the files at each call and is never a source of truth.
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

// node:sqlite is experimental: silence its warning so tool output stays clean.
process.removeAllListeners('warning');
const { DatabaseSync } = await import('node:sqlite');

export const MAX_CHARS = 2500;
const HEAD = /^(#{1,6})\s+(.*)$/;
export const DEC = /^#{2,4}\s+(D-\d{3})\b\s*(?:[—–-]\s*)?(.*)$/;
const FENCE = /^```/;
const STOPWORDS = new Set('the a an of to in on for and or is are was were what which who when why how does do did this that with from by at as it its be'.split(' '));
export const DEFAULT_FILES = ['DECISIONS.md', 'CLAUDE.md', '.claude/context/progress.md', '.claude/context/progress-archive.md', '.claude/context/errors.md', '.claude/context/errors-archive.md'];

const slash = (p) => p.split(sep).join('/');

// Files of a corpus: an explicit list (relative to root) or every .md under root.
export function listFiles(root, files) {
  if (files) return files.filter((f) => existsSync(join(root, f))).map(slash).sort();
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      if (name === 'node_modules' || name === '.git') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.md')) out.push(slash(relative(root, p)));
    }
  };
  walk(root);
  return out.sort();
}

function splitLong(file, heading, did, startLine, lines) {
  const parts = []; let buf = []; let size = 0; let from = startLine;
  const push = (to) => { if (buf.length) { parts.push({ from, to, text: buf.join('\n') }); buf = []; size = 0; } };
  lines.forEach((l, i) => {
    const ln = startLine + i;
    if (size + l.length + 1 > MAX_CHARS && buf.length > 0) { push(ln - 1); from = ln; }
    buf.push(l); size += l.length + 1;
  });
  push(startLine + lines.length - 1);
  return parts.map((p, k) => ({ file, heading: parts.length > 1 && k > 0 ? `${heading} (part ${k + 1})` : heading, did, start: p.from, end: p.to, text: p.text }));
}

export function chunkMarkdown(file, text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let cur = { heading: '(top)', did: null, start: 1, lines: [] };
  let inFence = false;
  lines.forEach((line, i) => {
    if (FENCE.test(line)) inFence = !inFence;
    const m = !inFence ? HEAD.exec(line) : null;
    if (m) {
      if (cur.lines.length > 0) blocks.push(cur);
      const d = DEC.exec(line);
      cur = { heading: line.replace(/^#+\s+/, ''), did: d ? d[1] : null, start: i + 1, lines: [line] };
    } else cur.lines.push(line);
  });
  if (cur.lines.length > 0) blocks.push(cur);
  const chunks = [];
  for (const b of blocks) {
    if (b.lines.join('').trim() === '') continue;
    chunks.push(...splitLong(file, b.heading, b.did, b.start, b.lines));
  }
  return chunks;
}

export function buildChunks(root, files) {
  const chunks = [];
  for (const rel of listFiles(root, files)) chunks.push(...chunkMarkdown(rel, readFileSync(join(root, rel), 'utf8')));
  return chunks.map((c, i) => ({ id: i + 1, ...c, chars: c.text.length }));
}

export function chunkHash(chunks) {
  const h = createHash('sha256');
  for (const c of chunks) h.update(`${c.file}|${c.heading}|${c.did ?? ''}|${c.start}|${c.end}|${c.text}\n`);
  return h.digest('hex');
}

export function buildDb(root, dbPath, files) {
  if (existsSync(dbPath)) rmSync(dbPath);
  mkdirSync(dirname(dbPath), { recursive: true });
  const chunks = buildChunks(root, files);
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE chunks (id INTEGER PRIMARY KEY, file TEXT NOT NULL, heading TEXT NOT NULL, did TEXT,
      start_line INTEGER NOT NULL, end_line INTEGER NOT NULL, chars INTEGER NOT NULL, text TEXT NOT NULL);
    CREATE VIRTUAL TABLE chunks_fts USING fts5(heading, did, text, tokenize='unicode61 remove_diacritics 2');
  `);
  const ins = db.prepare('INSERT INTO chunks VALUES (?,?,?,?,?,?,?,?)');
  const insFts = db.prepare('INSERT INTO chunks_fts(rowid, heading, did, text) VALUES (?,?,?,?)');
  db.exec('BEGIN');
  for (const c of chunks) {
    ins.run(c.id, c.file, c.heading, c.did, c.start, c.end, c.chars, c.text);
    insFts.run(c.id, c.heading, c.did ?? '', c.text);
  }
  db.exec('COMMIT');
  db.close();
  return { chunks: chunks.length, files: new Set(chunks.map((c) => c.file)).size, hash: chunkHash(chunks) };
}

export function openDb(dbPath) {
  if (!existsSync(dbPath)) throw new Error(`index not found: ${dbPath}`);
  return new DatabaseSync(dbPath, { readOnly: true });
}

// User text is never passed raw to FTS5: tokens are extracted and quoted, so operators cannot be injected.
export function buildMatchQuery(q, all = false) {
  const toks = (q.normalize('NFC').match(/[\p{L}\p{N}]+(?:[-.][\p{L}\p{N}]+)*/gu) ?? [])
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t.toLowerCase()))
    .slice(0, 12)
    .map((t) => `"${t.replace(/"/g, '""')}"`);
  return toks.join(all ? ' AND ' : ' OR ');
}

export function search(db, q, { limit = 5, all = false } = {}) {
  const match = buildMatchQuery(q, all);
  if (!match) return [];
  return db.prepare(
    `SELECT c.id, c.file, c.heading, c.did, c.start_line AS start, c.end_line AS end, c.chars, c.text,
            bm25(chunks_fts, 4.0, 8.0, 1.0) AS score,
            snippet(chunks_fts, 2, '[', ']', '...', 28) AS snippet
       FROM chunks_fts JOIN chunks c ON c.id = chunks_fts.rowid
      WHERE chunks_fts MATCH ? ORDER BY score LIMIT ?`,
  ).all(match, limit).map((r) => ({ ...r }));
}

export function getLines(root, rel, from, to) {
  const lines = readFileSync(join(root, rel), 'utf8').split(/\r?\n/);
  const a = Math.max(1, from); const b = Math.min(lines.length, to);
  return lines.slice(a - 1, b).map((l, i) => `${a + i}: ${l}`);
}
