import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { skillRunsCheck } from '../support/skill-command.mjs';

const SKILL = fileURLToPath(new URL('../../../../skills/brain-storm/SKILL.md', import.meta.url));

function readSkill() {
  return readFileSync(SKILL, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

test('[R11-01] brain-storm runs workflow-check with no file argument', () => {
  assert.equal(skillRunsCheck(readSkill()), true);
});
