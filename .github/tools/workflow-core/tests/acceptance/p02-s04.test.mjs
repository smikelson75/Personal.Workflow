import test from 'node:test';
import assert from 'node:assert/strict';
import { lines } from '../../support/harness.mjs';

test('[R15-10] pull-work SKILL.md has a line with the plan-check command', () => {
  const command = 'node .github/skills/pull-work/scripts/plan-check.mjs <slug> PNN';
  assert.ok(
    lines('.github/skills/pull-work/SKILL.md').some((line) => line.includes(command)),
    `no line contains \`${command}\``,
  );
});

test('[R15-11] PLAN-FORMAT.md gap line shows partial coverage without `absent`', () => {
  const gap = lines('.github/skills/work-planner/references/PLAN-FORMAT.md').find((line) =>
    line.startsWith('- gap to spec:'),
  );
  assert.ok(gap !== undefined, 'no line starts with `- gap to spec:`');
  assert.ok(gap.includes('R2 partial'), 'gap line does not contain `R2 partial`');
  assert.ok(!gap.includes('absent'), 'gap line still contains `absent`');
});
