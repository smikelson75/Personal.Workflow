import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { skillRunsCheck } from '../support/skill-command.mjs';

const SKILL = fileURLToPath(
  new URL('../../../../skills/behavior-spec/SKILL.md', import.meta.url),
);

function skillText() {
  return readFileSync(SKILL, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

test('[R12-01] behavior-spec runs workflow-check with no file argument', () => {
  assert.equal(skillRunsCheck(skillText()), true);
});
