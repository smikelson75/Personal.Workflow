import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../support/harness.mjs';
import { validSession, SESSION_NAME } from '../support/fixtures.mjs';

const SESSION_PATH = `.workflow/sessions/${SESSION_NAME}`;
const GLOSSARY_PATH = '.workflow/language.md';
const CLEAN = 'workflow-check: 0 errors, 0 warnings\n';
const GLOSSARY =
  '# Language\n\n## Terms\n- `Finding` - a reported break.\n\n## Retired\n- `Old` -> `New` - renamed\n';

function folderWithWorkflowLine(workflowLine) {
  const session = validSession({ sections: { Workflow: workflowLine } });
  const idx = session.split('\n').indexOf(workflowLine);
  assert.notEqual(idx, -1, 'fixture line not found');
  return { files: { [SESSION_PATH]: session, [GLOSSARY_PATH]: GLOSSARY }, line: idx + 1 };
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('[R4-03] Session line using the retired word Old is a retired-term warning at that line', () => {
  const { files, line } = folderWithWorkflowLine('- the Old way -> see output.');
  const result = runCheck({ files });
  const prefix = `${SESSION_PATH}:${line}: warning: vocabulary/retired-term: `;
  const lines = result.stdout.split('\n');
  assert.match(result.stdout, new RegExp(`^${escape(prefix)}\\S.*\\n`), `stdout was: ${result.stdout}`);
  assert.equal(lines.length, 3, `expected one finding and a summary, got: ${result.stdout}`);
  assert.equal(lines[1], 'workflow-check: 0 errors, 1 warnings');
  assert.equal(lines[2], '');
  assert.ok(lines[0].length - prefix.length <= 160);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
});

test('[R4-04] Session line with Older (Old only as a prefix) produces no Finding', () => {
  const { files } = folderWithWorkflowLine('- the Older way -> see output.');
  const result = runCheck({ files });
  assert.equal(result.stdout, CLEAN);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
});

test('[R4-11] Session whose only use of Old is backticked produces no Finding', () => {
  const { files } = folderWithWorkflowLine('- the `Old` way -> see output.');
  const result = runCheck({ files });
  assert.equal(result.stdout, CLEAN);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
});
