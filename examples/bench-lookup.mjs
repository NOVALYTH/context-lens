#!/usr/bin/env node
// Lookup benchmark on the SYNTHETIC journal: how much text must be read to find a decision?
//   node examples/bench-lookup.mjs
// Compares (a) reading DECISIONS.md whole with (b) reading the top-3 search results (full segments), in estimated tokens (chars / 4).
// It measures retrieval size and whether the right decision id is among the top results. It does NOT measure how well a language
// model answers, and the questions were written by the author of the sample, so hit rates are optimistic. See docs/MEASUREMENTS.md.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDb, openDb, search } from '../scripts/search/lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, 'decisions-sample');
// [question, expected id]. Mix of near-verbatim and paraphrased wording.
const QUESTIONS = [
  ['Why did we pick Redis for the session cache?', 'D-001'], ['What do we use for the job queue and why?', 'D-002'],
  ['How are images resized?', 'D-003'], ['Where do feature flags live?', 'D-004'],
  ['Which hash do we use for password storage?', 'D-009'], ['How do we version the API?', 'D-010'],
  ['What is the rate limiting algorithm?', 'D-013'], ['How long are outbound call timeouts?', 'D-029'],
  ['What is the retry strategy?', 'D-030'], ['How are database migrations handled?', 'D-034'],
  ['What is the backup retention?', 'D-039'], ['Which ranking function powers search ranking?', 'D-049'],
  ['How often do we release?', 'D-019'], ['What is the policy for secret handling?', 'D-022'],
  ['How are webhooks authenticated?', 'D-035'],
];
const full = readFileSync(join(root, 'DECISIONS.md'), 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'lens-bench-'));
try {
  buildDb(root, join(tmp, 'b.db'), ['DECISIONS.md']);
  const db = openDb(join(tmp, 'b.db'));
  let hit1 = 0; let hit3 = 0; let returned = 0;
  for (const [q, id] of QUESTIONS) {
    const r = search(db, q, { limit: 3 });
    if (r[0]?.did === id) hit1++;
    if (r.some((x) => x.did === id)) hit3++;
    returned += r.reduce((s, x) => s + x.chars, 0) / 4;
  }
  const fullTok = full.length / 4; const n = QUESTIONS.length;
  console.log(`journal: ${(full.match(/^### D-/gm) || []).length} decisions, ~${Math.round(fullTok)} tokens if read whole`);
  console.log(`questions: ${n}; right decision first: ${hit1}/${n}; among top 3: ${hit3}/${n}`);
  console.log(`mean tokens returned by top-3 search: ~${Math.round(returned / n)} per question (${Math.round((100 * returned) / n / fullTok)} % of a full read)`);
  db.close();
} finally { rmSync(tmp, { recursive: true, force: true }); }
