import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildChunks, buildDb, openDb, search, buildMatchQuery, chunkHash, getLines, MAX_CHARS } from '../scripts/search/lib.mjs';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'lens-search-'));
  writeFileSync(join(dir, 'DECISIONS.md'), ['# Decisions', '', '### D-001 - Alpha frozen', '**Date**: 2026-01-01', 'unique alpha text', '', '### D-002 - Beta', '**Date**: 2026-01-02', 'beta text about caching', ''].join('\n'));
  mkdirSync(join(dir, 'notes'));
  writeFileSync(join(dir, 'notes', 'a.md'), ['# Notes', '', 'intro', '', '## Section', 'line a', 'line b', ''].join('\n'));
  return dir;
}
const cleanup = (...d) => d.forEach((x) => rmSync(x, { recursive: true, force: true }));

test('one segment per decision, with exact line provenance', () => {
  const dir = fixture();
  try {
    const chunks = buildChunks(dir).filter((c) => c.file === 'DECISIONS.md');
    const d1 = chunks.find((c) => c.did === 'D-001'); const d2 = chunks.find((c) => c.did === 'D-002');
    assert.ok(d1 && d2);
    assert.equal(d1.start, 3); assert.equal(d2.start, 7);
    assert.ok(d1.text.includes('unique alpha') && !d1.text.includes('caching'));
  } finally { cleanup(dir); }
});

test('every segment reproduces exactly the lines it cites, and long sections are split', () => {
  const dir = fixture();
  try {
    const long = ['# Long', ...Array.from({ length: 300 }, (_, i) => `line number ${i} with some filler words to make it long`)];
    writeFileSync(join(dir, 'long.md'), long.join('\n'));
    const chunks = buildChunks(dir);
    assert.ok(chunks.filter((c) => c.file === 'long.md').length > 1);
    for (const c of chunks) {
      const lines = readFileSync(join(dir, c.file), 'utf8').split(/\r?\n/);
      assert.equal(lines.slice(c.start - 1, c.end).join('\n'), c.text, `${c.file}:${c.start}-${c.end}`);
      assert.ok(c.chars <= MAX_CHARS + 200);
    }
  } finally { cleanup(dir); }
});

test('build is deterministic and regenerable after deleting the index', () => {
  const dir = fixture(); const tmp = mkdtempSync(join(tmpdir(), 'lens-db-'));
  try {
    const a = buildDb(dir, join(tmp, 'a.db')); const b = buildDb(dir, join(tmp, 'b.db'));
    assert.equal(a.hash, b.hash);
    rmSync(join(tmp, 'a.db'));
    assert.equal(buildDb(dir, join(tmp, 'a.db')).hash, a.hash);
    assert.equal(chunkHash(buildChunks(dir)), a.hash);
  } finally { cleanup(dir, tmp); }
});

test('search ranks by BM25 and returns provenance; an explicit file list limits the corpus', () => {
  const dir = fixture(); const tmp = mkdtempSync(join(tmpdir(), 'lens-db-'));
  try {
    buildDb(dir, join(tmp, 'x.db'));
    const db = openDb(join(tmp, 'x.db'));
    const r = search(db, 'caching beta', { limit: 3 });
    assert.equal(r[0].did, 'D-002'); assert.equal(r[0].file, 'DECISIONS.md');
    assert.deepEqual(getLines(dir, 'DECISIONS.md', 3, 3), ['3: ### D-001 - Alpha frozen']);
    assert.equal(search(db, 'D-001').at(0).did, 'D-001');
    db.close();
    const s = buildDb(dir, join(tmp, 'y.db'), ['DECISIONS.md']);
    assert.equal(s.files, 1);
  } finally { cleanup(dir, tmp); }
});

test('queries cannot inject FTS5 operators and stopwords are dropped', () => {
  // every token is quoted; "the", "or", "and" are stopwords; one-letter tokens are dropped; "NOT" is quoted so it is a plain word
  assert.equal(buildMatchQuery('the "cache" OR NOT x* AND (y)'), '"cache" OR "NOT"');
  assert.equal(buildMatchQuery('???'), '');
  const dir = fixture(); const tmp = mkdtempSync(join(tmpdir(), 'lens-db-'));
  try {
    buildDb(dir, join(tmp, 'x.db')); const db = openDb(join(tmp, 'x.db'));
    for (const q of ['"', 'a OR', 'NEAR(', '*', "x'; DROP TABLE chunks;--"]) assert.doesNotThrow(() => search(db, q));
    db.close();
  } finally { cleanup(dir, tmp); }
});

test('no external dependency: only node: built-ins and relative imports', () => {
  for (const f of ['lib.mjs', 'detector.mjs']) {
    const src = readFileSync(new URL(`../scripts/search/${f}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)) assert.ok(m[1].startsWith('node:') || m[1].startsWith('./'), `${f} imports ${m[1]}`);
  }
  assert.ok(!existsSync(new URL('../node_modules', import.meta.url)));
});
