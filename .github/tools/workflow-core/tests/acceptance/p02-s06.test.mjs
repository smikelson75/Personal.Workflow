import assert from 'node:assert/strict';
import test from 'node:test';
import { lines } from '../../support/harness.mjs';

const PLANNER = '.github/skills/work-planner/SKILL.md';
const PULL = '.github/skills/pull-work/SKILL.md';

test('[R17-06] work-planner Plan mode runs the mutation-addon script', () => {
  const found = lines(PLANNER).filter((l) =>
    l.includes('node .github/skills/work-planner/scripts/mutation-addon.mjs <stack>'),
  );
  assert.equal(found.length, 1, `expected exactly one line with the mutation-addon command, found ${found.length}`);
});

test('[R17-07] work-planner no longer asks the repo-scout mutation tool question', () => {
  const found = lines(PLANNER).filter((l) => l.includes('supported mutation tool'));
  assert.equal(found.length, 0, 'a line still contains "supported mutation tool"');
});

test('[R17-08] work-planner names the Mutation stack and Mutation command lines on one line', () => {
  const found = lines(PLANNER).filter(
    (l) => l.includes('**Mutation stack:**') && l.includes('**Mutation command:**'),
  );
  assert.equal(found.length, 1, `expected exactly one line with both markers, found ${found.length}`);
});

test('[R17-09] pull-work step 4 treats an unsupported mutation line as skipped', () => {
  const found = lines(PULL).filter((l) => l.startsWith('4. mutation'));
  assert.equal(found.length, 1, `expected exactly one line starting "4. mutation", found ${found.length}`);
  assert.ok(found[0].includes('unsupported for'), 'step 4 line missing "unsupported for"');
});
