import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lines } from '../../support/harness.mjs';

const USER_INTERACTION = '.github/user-interaction.md';

function lineStarting(rel, prefix) {
  const found = lines(rel).find((l) => l.startsWith(prefix));
  assert.ok(found !== undefined, `${rel} must have a line starting "${prefix}"`);
  return found;
}

test('[Q-clean-handoff] each stage file has a Clean handoff line naming git status --porcelain', () => {
  const bulleted = [
    '.github/skills/brain-storm/SKILL.md',
    '.github/skills/behavior-spec/SKILL.md',
    '.github/agents/planner.agent.md',
  ];
  for (const rel of bulleted) {
    const line = lineStarting(rel, '- Clean handoff:');
    assert.ok(line.includes('git status --porcelain'), `${rel} Clean handoff line must contain "git status --porcelain"`);
  }
  const pull = lineStarting('.github/skills/pull-work/SKILL.md', 'Clean handoff:');
  for (const marker of ['git status --porcelain', 'Phase Review']) {
    assert.ok(pull.includes(marker), `pull-work Clean handoff line must contain "${marker}"`);
  }
});

test('[Q-checkpoint-cost] user-interaction Cost line states an unnamed Checkpoint costs one question', () => {
  const line = lineStarting(USER_INTERACTION, '- **Cost:**');
  for (const marker of ['names no items', 'exactly one question']) {
    assert.ok(line.includes(marker), `Cost line must contain "${marker}"`);
  }
});
