import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lines } from '../../support/harness.mjs';

const PLANNER = '.github/skills/work-planner/SKILL.md';
const PHASE_FORMAT = '.github/skills/work-planner/references/PHASE-FORMAT.md';
const PLAN_FORMAT = '.github/skills/work-planner/references/PLAN-FORMAT.md';

function lineStarting(rel, prefix) {
  const found = lines(rel).find((l) => l.startsWith(prefix));
  assert.ok(found !== undefined, `${rel} must have a line starting "${prefix}"`);
  return found;
}

test('[R16-04] work-planner has a Pair coverage line naming capability, stable markers, Not expressible', () => {
  const line = lineStarting(PLANNER, '- Pair coverage:');
  for (const marker of ['capability', 'stable markers', 'Not expressible']) {
    assert.ok(line.includes(marker), `Pair coverage line must contain "${marker}"`);
  }
});

test('[R16-05] Phase Format has a Not expressible line naming Phase Review', () => {
  const line = lineStarting(PHASE_FORMAT, '- **Not expressible**');
  assert.ok(line.includes('Phase Review'), 'Not expressible line must contain "Phase Review"');
});

test('[R16-06] Plan Format done-means line names pair', () => {
  const line = lineStarting(PLAN_FORMAT, '- `done` means');
  assert.ok(line.includes('pair'), 'done means line must contain "pair"');
});

test('[R16-07] Plan Format gap line names <ID> @ <capability>', () => {
  const line = lineStarting(PLAN_FORMAT, '- the gap line');
  assert.ok(line.includes('<ID> @ <capability>'), 'gap line must contain "<ID> @ <capability>"');
});
