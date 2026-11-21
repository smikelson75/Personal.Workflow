import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SKILL = fileURLToPath(
  new URL('../../../../skills/behavior-spec/SKILL.md', import.meta.url),
);

function skillText() {
  return readFileSync(SKILL, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

function afterInputs(text) {
  const lines = text.split('\n');
  const idx = lines.indexOf('## Inputs');
  assert.notEqual(idx, -1, 'the ## Inputs heading is missing');
  return lines.slice(idx + 1).join('\n');
}

test('[R12-01] behavior-spec runs workflow-check with no file argument after ## Inputs', () => {
  const rest = afterInputs(skillText());
  const command = '`node .github/tools/workflow-check/bin/workflow-check.mjs`';
  assert.ok(rest.includes(command), `expected ${command} after the ## Inputs heading`);
  assert.doesNotMatch(
    rest,
    /workflow-check\.mjs[ \t]+[^\s`]/,
    'the command must not be followed by a file argument',
  );
});

test('[R12-02] behavior-spec stops and redirects to brain-storm on an error or exit code 2', () => {
  const text = skillText();
  const sentence =
    'When any `error` Finding appears or the exit code is 2, stop, show the `error` Findings, and redirect to `brain-storm`.';
  assert.ok(text.includes(sentence), `expected sentence: ${sentence}`);
});

test('[R12-03] behavior-spec is not stopped by warning Findings', () => {
  const text = skillText();
  const sentence = '`warning` Findings do not stop it.';
  assert.ok(text.includes(sentence), `expected sentence: ${sentence}`);
});
