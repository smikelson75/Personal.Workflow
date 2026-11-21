import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lines } from '../../support/harness.mjs';

const PHASE_FORMAT = '.github/skills/work-planner/references/PHASE-FORMAT.md';
const PULL_WORK = '.github/skills/pull-work/SKILL.md';

function lineStarting(rel, prefix) {
  const found = lines(rel).find((l) => l.startsWith(prefix));
  assert.ok(found !== undefined, `${rel} must have a line starting "${prefix}"`);
  return found;
}

test('[R14-09] Phase Format Known failures line names owner PNN and the test title placeholder', () => {
  const line = lineStarting(PHASE_FORMAT, '- **Known failures');
  for (const marker of ['owner PNN', '<test title>']) {
    assert.ok(line.includes(marker), `Known failures line must contain "${marker}"`);
  }
});

test('[R14-10] pull-work traceability step names Known failures', () => {
  const line = lineStarting(PULL_WORK, '2. traceability');
  assert.ok(line.includes('Known failures'), 'traceability step must contain "Known failures"');
});

test('[R14-11] pull-work has a line naming trace.mjs --phase-file and --skip-pattern', () => {
  const found = lines(PULL_WORK).some(
    (l) => l.includes('trace.mjs --phase-file') && l.includes('--skip-pattern'),
  );
  assert.ok(found, 'one line must contain both "trace.mjs --phase-file" and "--skip-pattern"');
});
