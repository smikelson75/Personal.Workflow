import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillRunsCheck } from '../support/skill-command.mjs';

const CMD = 'node .github/tools/workflow-check/bin/workflow-check.mjs';

test('[R18-01] accepts brain-storm text reworded with renamed headings that keeps the command', () => {
  const text = [
    '# Brainstorm helper',
    '',
    '## Step Nine: Wrap-up',
    '',
    'Once the Session and Glossary are saved, validate the folder by executing',
    `\`${CMD}\` from the repo root, then deal with whatever it prints.`,
    '',
    '### Triage',
    '- Resolve errors; weigh warnings.',
  ].join('\n');
  assert.equal(skillRunsCheck(text), true);
});

test('[R18-02] rejects behavior-spec text with the command removed', () => {
  const text = [
    '# Behavior spec',
    '',
    '## Inputs',
    '',
    'Before reading the inputs, make sure the Workflow Folder is healthy.',
    'When any error appears, stop and redirect to brain-storm.',
    'Mentioning workflow-check.mjs without the backticked command is not enough.',
  ].join('\n');
  assert.equal(skillRunsCheck(text), false);
});

test('[R18-03] rejects brain-storm command followed by a new Session file argument', () => {
  const text = [
    '## 5. Output',
    '',
    `After writing the Session, run \`${CMD} .workflow/sessions/<new session file>\` from the repo root.`,
  ].join('\n');
  assert.equal(skillRunsCheck(text), false);

  const bare = [
    `Run \`${CMD}\` from the repo root.`,
    '',
    `Later: ${CMD} .workflow/sessions/<new session file>`,
  ].join('\n');
  assert.equal(skillRunsCheck(bare), false);
});
