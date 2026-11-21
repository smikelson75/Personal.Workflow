import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SKILL = fileURLToPath(new URL('../../../../skills/brain-storm/SKILL.md', import.meta.url));

function readSkill() {
  return readFileSync(SKILL, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

const COMMAND = 'node .github/tools/workflow-check/bin/workflow-check.mjs .workflow/sessions/<new session file>';

test('[R11-01] brain-storm runs workflow-check on the new Session after the Output heading', () => {
  const lines = readSkill().split('\n');
  const heading = lines.indexOf('## 5. Output');
  assert.notEqual(heading, -1, 'heading "## 5. Output" not found');
  const after = lines.slice(heading + 1);
  assert.ok(
    after.some((line) => line.includes('`' + COMMAND + '`')),
    `no line after "## 5. Output" contains the backticked command: ${COMMAND}`,
  );
});

test('[R11-02] brain-storm fixes every error and weighs each warning', () => {
  const lines = readSkill().split('\n').map((l) => l.trim().replace(/^- /, ''));
  assert.ok(
    lines.includes('Fix every `error` Finding and rerun until the summary reads `0 errors`.'),
    'error-fix line not found',
  );
  assert.ok(
    lines.includes('Weigh each `warning`: fix it, or leave it deliberately and name it in the brief.'),
    'warning-weigh line not found',
  );
});

test('[R11-03] brain-storm never edits a prior Session and stops on prior-Session errors', () => {
  const text = readSkill();
  assert.ok(
    text.includes(
      'Never edit a prior Session to clear a Finding. When an `error` Finding is anchored at a prior Session, stop and report it to the user instead of finishing.',
    ),
    'prior-Session sentence not found',
  );
});
