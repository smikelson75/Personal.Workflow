import test from 'node:test';
import assert from 'node:assert/strict';
import { lines } from '../../support/harness.mjs';

const MARKERS = ['.github/user-interaction.md', '## Checkpoint', 'Phase Review'];

function hasLineWithAll(rel) {
  return lines(rel).some((line) => MARKERS.every((m) => line.includes(m)));
}

test('[R23-05] work-planner SKILL.md has a line tying Checkpoints to the rules file', () => {
  assert.ok(
    hasLineWithAll('.github/skills/work-planner/SKILL.md'),
    'no line contains `.github/user-interaction.md`, `## Checkpoint` and `Phase Review`',
  );
});

test('[R23-06] pull-work SKILL.md has a line tying Checkpoints to the rules file', () => {
  assert.ok(
    hasLineWithAll('.github/skills/pull-work/SKILL.md'),
    'no line contains `.github/user-interaction.md`, `## Checkpoint` and `Phase Review`',
  );
});
