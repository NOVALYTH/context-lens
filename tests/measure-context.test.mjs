import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readTurns, segmentsOf, analyseSegment, projectDir } from '../scripts/measure-context.mjs';

// Synthetic transcript: 12 assistant turns, context grows 10k -> 21k, then drops (compaction) to 5k for 6 more turns.
function transcript() {
  const lines = []; let id = 0;
  const turn = (ctx, out, text) => {
    id++;
    lines.push({ type: 'assistant', message: { id: 'm' + id, usage: { input_tokens: 10, cache_read_input_tokens: ctx - 10, cache_creation_input_tokens: 0, output_tokens: out }, content: [{ type: 'text', text }, { type: 'tool_use', id: 't' + id, name: 'Read', input: { p: 'x' } }] } });
    lines.push({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't' + id, content: 'y'.repeat(3300) }] } });
  };
  for (let i = 0; i < 12; i++) turn(10000 + i * 1000, 200, 'a'.repeat(660));
  for (let i = 0; i < 6; i++) turn(5000 + i * 1000, 100, 'b'.repeat(330));
  return lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
}

test('splits at compaction and attributes growth', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lens-'));
  try {
    const f = join(dir, 's.jsonl'); writeFileSync(f, transcript());
    const { turns } = await readTurns(f);
    assert.equal(turns.length, 18);
    const segs = segmentsOf(turns);
    assert.equal(segs.length, 2);
    const a = analyseSegment(segs[0], 200000);
    assert.equal(a.turns, 12);
    assert.equal(a.firstCtx, 10000); assert.equal(a.lastCtx, 21000);
    assert.equal(a.written, 11 * 200);
    assert.equal(a.visible, 11 * (660 + 30 + JSON.stringify({ p: 'x' }).length) / 3.3);
    assert.equal(a.simulated.compactions, 0);
    assert.equal(a.topTools[0][0], 'Read');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('simulation compacts when the window is exceeded', () => {
  const s = Array.from({ length: 30 }, (_, i) => ({ ctx: 10000 + i * 5000, out: 0, visible: 0, input: {} }));
  const a = analyseSegment(s, 100000);
  assert.ok(a.simulated.compactions >= 1);
  assert.ok(a.simulated.reading < a.cumulativeReading);
});

test('project folder name replaces every non-alphanumeric character', () => {
  assert.match(projectDir('C:\\Users\\a.b\\my project'), /C--Users-a-b-my-project$/);
});
