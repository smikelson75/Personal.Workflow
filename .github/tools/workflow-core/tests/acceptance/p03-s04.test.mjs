import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lines } from '../../support/harness.mjs';

const PULL_WORK = '.github/skills/pull-work/SKILL.md';
const WORK_PLANNER = '.github/skills/work-planner/SKILL.md';

function lineContainingAll(rel, markers) {
  const found = lines(rel).find((l) => markers.every((m) => l.includes(m)));
  assert.ok(found !== undefined, `${rel} must have one line containing all of: ${markers.join(' | ')}`);
  return found;
}

test('[R21-08] pull-work has a line naming parse-args.mjs, the bug usage line, and Defect', () => {
  lineContainingAll(PULL_WORK, ['parse-args.mjs', '/pull-work [<slug>] bug: <description>', 'Defect']);
});

test('[R21-09] pull-work has a line naming bug and no plan', () => {
  lineContainingAll(PULL_WORK, ['bug', 'no plan']);
});

test('[R21-10] pull-work Defect commit row names the plan fix commit message', () => {
  const row = lines(PULL_WORK).find((l) => l.startsWith('| Defect'));
  assert.ok(row !== undefined, `${PULL_WORK} must have a line starting "| Defect"`);
  assert.ok(row.includes('docs(<slug>): plan fix PNN'), 'Defect row must contain "docs(<slug>): plan fix PNN"');
});

test('[R21-11] work-planner has a Defect section of labelled lines', () => {
  const all = lines(WORK_PLANNER);
  const start = all.findIndex((l) => l.startsWith('### Defect'));
  assert.ok(start !== -1, `${WORK_PLANNER} must have a line starting "### Defect"`);
  let end = all.length;
  for (let i = start + 1; i < all.length; i += 1) {
    if (/^#{1,3} /.test(all[i])) {
      end = i;
      break;
    }
  }
  const section = all.slice(start + 1, end);
  const labelled = (label) => {
    const found = section.find((l) => l.startsWith(label));
    assert.ok(found !== undefined, `Defect section must have a line starting "${label}"`);
    return found;
  };
  const classify = labelled('- Classify:');
  labelled('- Scenario:');
  const place = labelled('- Place:');
  const next = labelled('- Next:');
  const card = labelled('- Card:');
  labelled('- Commit:');
  for (const m of ['behavior-spec', 'brain-storm']) {
    assert.ok(classify.includes(m), `Classify line must contain "${m}"`);
  }
  assert.ok(place.includes('PNN+1'), 'Place line must contain "PNN+1"');
  assert.ok(next.includes('phase review PNN'), 'Next line must contain "phase review PNN"');
  for (const m of ['Defect:', 'verbatim']) {
    assert.ok(card.includes(m), `Card line must contain "${m}"`);
  }
});
