import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lines } from '../../support/harness.mjs';

const PULL_WORK = '.github/skills/pull-work/SKILL.md';
const PLANNER = '.github/skills/work-planner/SKILL.md';
const PLAN_FORMAT = '.github/skills/work-planner/references/PLAN-FORMAT.md';
const COMMIT = 'docs(<slug>): reconcile spec';

function lineStarting(all, prefix, label) {
  const found = all.find((l) => l.startsWith(prefix));
  assert.ok(found !== undefined, `${label} must have a line starting "${prefix}"`);
  return found;
}

test('[R20-07] pull-work has one line naming reconcile-check.mjs candidates, reconcile-check.mjs status, and Reconcile', () => {
  const found = lines(PULL_WORK).some(
    (l) =>
      l.includes('reconcile-check.mjs candidates') &&
      l.includes('reconcile-check.mjs status') &&
      l.includes('Reconcile'),
  );
  assert.ok(found, 'one line must contain all three markers');
});

test('[R20-08] pull-work Commits table Reconcile row names the reconcile commit message', () => {
  const line = lineStarting(lines(PULL_WORK), '| Reconcile', PULL_WORK);
  assert.ok(line.includes(COMMIT), `Reconcile row must contain "${COMMIT}"`);
});

test('[R20-09] work-planner has a Reconcile section with labelled lines', () => {
  const all = lines(PLANNER);
  const start = all.findIndex((l) => l.startsWith('### Reconcile'));
  assert.ok(start >= 0, 'work-planner must have a line starting "### Reconcile"');
  let end = all.findIndex((l, i) => i > start && /^#{1,3} /.test(l));
  if (end < 0) end = all.length;
  const section = all.slice(start + 1, end);
  const labelled = {};
  for (const label of [
    '- Trigger:',
    '- Plan:',
    '- Done plan:',
    '- Mid-phase:',
    '- No new work:',
    '- Redirect:',
    '- Record:',
  ]) {
    labelled[label] = lineStarting(section, label, 'Reconcile section');
  }
  assert.ok(labelled['- Done plan:'].includes('PNN+1'), 'Done plan line must contain "PNN+1"');
  assert.ok(labelled['- Record:'].includes(COMMIT), `Record line must contain "${COMMIT}"`);
  assert.ok(labelled['- Plan:'].includes('Reconciled'), 'Plan line must contain "Reconciled"');
});

test('[R20-10] PLAN-FORMAT describes the Reconciled line and skeleton entry', () => {
  const all = lines(PLAN_FORMAT);
  lineStarting(all, '- `Reconciled` line', PLAN_FORMAT);
  lineStarting(all, '- Reconciled: `', PLAN_FORMAT);
});
