import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from '../scripts/check-workspace.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const put = (root, rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
const ws = (fn) => { const d = mkdtempSync(join(tmpdir(), 'ws-')); try { return fn(d); } finally { rmSync(d, { recursive: true, force: true }); } };
const skill = (name, desc) => `---\nname: ${name}\ndescription: ${desc}\n---\n\n# body\n`;
const levels = (r, level) => r.results.filter((x) => x.level === level).map((x) => x.text);

test('the shipped template passes with no error and no warning', () => {
  const r = check(join(here, '..', 'template'));
  assert.equal(r.errors, 0); assert.equal(r.warnings, 0);
  assert.ok(r.total > 0 && r.total < 2000);
});

test('an unquoted description with ": " is an error (skill would vanish)', () => ws((d) => {
  put(d, 'CLAUDE.md', '# x\n');
  put(d, '.claude/skills/bad/SKILL.md', skill('bad', 'Use when asked to rename: updates every import of it'));
  const r = check(d);
  assert.ok(levels(r, 'error').some((t) => /bad/.test(t) && /YAML/.test(t)));
}));

test('a quoted description with ": " is accepted', () => ws((d) => {
  put(d, 'CLAUDE.md', '# x\n');
  put(d, '.claude/skills/ok/SKILL.md', skill('ok', '"Use when asked to rename: updates every import of it"'));
  assert.equal(check(d).errors, 0);
}));

test('name different from folder, missing frontmatter, short description', () => ws((d) => {
  put(d, 'CLAUDE.md', '# x\n');
  put(d, '.claude/skills/a/SKILL.md', skill('b', 'a long enough description here'));
  put(d, '.claude/skills/c/SKILL.md', '# no frontmatter\n');
  put(d, '.claude/skills/e/SKILL.md', skill('e', 'short'));
  assert.equal(check(d).errors, 3);
}));

test('imports are summed recursively; missing import is an error; budget warning', () => ws((d) => {
  put(d, 'CLAUDE.md', '@a.md\n@missing.md\n');
  put(d, 'a.md', '@b.md\n' + 'x'.repeat(4000));
  put(d, 'b.md', 'y'.repeat(4000));
  const r = check(d, { budget: 1500 });
  assert.equal(r.errors, 1);
  assert.ok(r.total >= 2000);
  assert.ok(levels(r, 'warn').some((t) => /budget/.test(t)));
}));

test('import cycles do not loop and archives imported are flagged', () => ws((d) => {
  put(d, 'CLAUDE.md', '@a.md\n@progress-archive.md\n');
  put(d, 'a.md', '@CLAUDE.md\n@a.md\n');
  put(d, 'progress-archive.md', 'old');
  const r = check(d);
  assert.ok(levels(r, 'warn').some((t) => /archive/.test(t)));
}));

test('the installable skills of this repository have valid frontmatter', async () => {
  const { readdirSync } = await import('node:fs');
  const { checkSkill } = await import('../scripts/check-workspace.mjs');
  const base = join(here, '..', 'skills');
  const names = readdirSync(base);
  assert.ok(names.length >= 2);
  for (const n of names) assert.deepEqual(checkSkill(join(base, n, 'SKILL.md')), [], n);
});
