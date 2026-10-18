// Detector tests. Method: start from a clean synthetic corpus, apply ONE injection on a throwaway copy,
// and require at least one NEW finding of the targeted rule; each negative control must add NO finding.
// Limit: the author of the detector also wrote these cases. They prove the rules are implemented, not that they generalise.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { analyze, newFindings } from '../scripts/search/detector.mjs';

const TODAY = '2026-10-16';
const FILES = ['DECISIONS.md', '.claude/context/progress.md', '.claude/context/errors.md'];
const PROJECTS = [{ key: 'billing', aliases: ['billing service'] }];

const BASE = {
  'DECISIONS.md': [
    '# Decisions', '',
    '### D-001 - Use a monorepo', '', '**Date**: 2026-09-01', '**Status**: Decision made. Amended by D-003.', '',
    '### D-002 - Billing service on hold', '', '**Date**: 2026-09-10', '**Status**: Decision made', 'The billing service is on hold until Q1.', '',
    '### D-003 - Monorepo with two roots', '', '**Date**: 2026-09-20', '**Amends**: D-001', '**Status**: Decision made', '',
  ].join('\n'),
  '.claude/context/progress.md': ['# Progress', '', 'Updated: 2026-10-15', '- Working on search. See D-003.', ''].join('\n'),
  '.claude/context/errors.md': ['# Errors', '', 'Status verified on 2026-10-10.', ''].join('\n'),
};

const write = (dir, rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
const read = (dir, rel) => readFileSync(join(dir, rel), 'utf8');
const append = (dir, rel, txt) => write(dir, rel, read(dir, rel).replace(/\s*$/, '\n') + txt);
const replaceOnce = (dir, rel, a, b) => { const t = read(dir, rel); assert.ok(t.includes(a), `not found: ${a}`); write(dir, rel, t.replace(a, b)); };
const run = (dir) => analyze(dir, FILES, { today: TODAY, projects: PROJECTS });
function withCopy(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'lens-det-'));
  try { for (const [rel, text] of Object.entries(BASE)) write(dir, rel, text); return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const baseline = withCopy(run);

test('the clean corpus has no finding', () => assert.deepEqual(baseline, []));

const INJECTIONS = [
  ['I01', 'duplicate-id', (d) => append(d, 'DECISIONS.md', '\n### D-002 - Another title\n\n**Date**: 2026-10-01\n')],
  ['I02', 'duplicate-id', (d) => append(d, 'DECISIONS.md', '\n### D-001 - Doubled\n\n**Date**: 2026-10-02\n')],
  ['I03', 'missing-reference', (d) => append(d, '.claude/context/progress.md', '- see D-088\n')],
  ['I04', 'missing-reference', (d) => replaceOnce(d, 'DECISIONS.md', 'on hold until Q1.', 'on hold until Q1 (see D-077).')],
  ['I05', 'unmarked-supersession', (d) => append(d, 'DECISIONS.md', '\n### D-004 - New rule\n\n**Date**: 2026-10-05\n**Replaces**: D-002\n**Status**: Decision made\n')],
  ['I06', 'unmarked-supersession', (d) => append(d, 'DECISIONS.md', '\n### D-004 - Amendment to D-002\n\n**Date**: 2026-10-05\n**Status**: Decision made\n')],
  ['I07', 'stale-date', (d) => replaceOnce(d, '.claude/context/progress.md', 'Updated: 2026-10-15', 'Updated: 2026-09-20')],
  ['I08', 'stale-date', (d) => append(d, '.claude/context/errors.md', 'Last updated 2026-08-30.\n')],
  ['I09', 'claim-against-decision', (d) => append(d, '.claude/context/progress.md', '- The billing service is the top priority.\n')],
  ['I10', 'claim-against-decision', (d) => append(d, '.claude/context/progress.md', '- billing service: active.\n')],
];

const NEGATIVES = [
  ['N01', (d) => append(d, 'DECISIONS.md', '\n### D-004 - Fine\n\n**Date**: 2026-10-05\n**Amends**: D-002\n**Status**: Decision made\n') || replaceOnce(d, 'DECISIONS.md', '**Status**: Decision made\nThe billing', '**Status**: Decision made. Amended by D-004.\nThe billing')],
  ['N02', (d) => append(d, '.claude/context/progress.md', '- see D-001 and D-002.\n')],
  ['N03', (d) => append(d, '.claude/context/errors.md', 'Status verified on 2026-10-02.\n')],
  ['N04', (d) => append(d, '.claude/context/errors.md', 'Status verified on 2026-12-01.\n')],
  ['N05', (d) => append(d, '.claude/context/progress.md', '```\nexample: see D-999\n```\n')],
  ['N06', (d) => append(d, '.claude/context/progress.md', '- template: D-0xx - title\n')],
  ['N07', (d) => append(d, '.claude/context/progress.md', '- The billing service stays on hold.\n')],
  ['N08', (d) => append(d, '.claude/context/progress.md', '- The search service is active.\n')],
  ['N09', (d) => append(d, 'DECISIONS.md', '\n**Reversible?**: Yes.\n')],
  ['N10', (d) => append(d, '.claude/context/progress.md', '- D-003 is cited here and defined once.\n')],
];

test('injections: each produces at least one new finding of the targeted rule', () => {
  const missed = [];
  for (const [id, rule, apply] of INJECTIONS) {
    withCopy((dir) => {
      apply(dir);
      const fresh = newFindings(baseline, run(dir));
      if (!fresh.some((f) => f.rule === rule)) missed.push(`${id} (${rule}): got ${fresh.map((f) => f.rule).join(',') || 'nothing'}`);
    });
  }
  assert.deepEqual(missed, [], missed.join('\n'));
});

test('negative controls: none produces a new finding', () => {
  const noisy = [];
  for (const [id, apply] of NEGATIVES) {
    withCopy((dir) => {
      apply(dir);
      const fresh = newFindings(baseline, run(dir));
      if (fresh.length) noisy.push(`${id}: ${fresh.map((f) => `${f.rule} ${f.message.slice(0, 80)}`).join(' | ')}`);
    });
  }
  assert.deepEqual(noisy, [], noisy.join('\n'));
});

test('known limit: a free-form semantic contradiction is not detected', () => withCopy((dir) => {
  append(dir, '.claude/context/progress.md', '- We decided to split the monorepo into many repositories.\n');
  assert.deepEqual(newFindings(baseline, run(dir)), []);
}));

test('claim-against-decision is inactive without configured projects', () => withCopy((dir) => {
  append(dir, '.claude/context/progress.md', '- The billing service is the top priority.\n');
  assert.deepEqual(analyze(dir, FILES, { today: TODAY }), []);
}));
