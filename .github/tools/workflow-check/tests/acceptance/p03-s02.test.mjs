import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../support/harness.mjs';
import { validSession, SESSION_NAME } from '../support/fixtures.mjs';

const SESSION_PATH = `.workflow/sessions/${SESSION_NAME}`;
const GLOSSARY_PATH = '.workflow/language.md';
const CLEAN = 'workflow-check: 0 errors, 0 warnings\n';

function glossaryWith(avoid) {
  return `# Language\n\n## Terms\n- \`Finding\` - a reported break. Avoid: ${avoid}.\n\n## Retired\n`;
}

function folder(sessionText, glossary) {
  return { [SESSION_PATH]: sessionText, [GLOSSARY_PATH]: glossary };
}

function lineOf(text, exact) {
  const idx = text.split('\n').indexOf(exact);
  assert.notEqual(idx, -1, `fixture line not found: ${exact}`);
  return idx + 1;
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertSingleAvoidWarning(result, line) {
  const prefix = `${SESSION_PATH}:${line}: warning: vocabulary/avoid-synonym: `;
  const lines = result.stdout.split('\n');
  assert.match(result.stdout, new RegExp(`^${escape(prefix)}\\S.*\\n`), `stdout was: ${result.stdout}`);
  assert.equal(lines.length, 3, `expected one finding and a summary, got: ${result.stdout}`);
  assert.equal(lines[1], 'workflow-check: 0 errors, 1 warnings');
  assert.equal(lines[2], '');
  assert.ok(lines[0].length - prefix.length <= 160);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
}

test('[R4-01] Session line using an Avoid word is an avoid-synonym warning at that line', () => {
  const bad = '- each issue is reported.';
  const session = validSession({ sections: { Workflow: bad } });
  const result = runCheck({ files: folder(session, glossaryWith('issue')) });
  assertSingleAvoidWarning(result, lineOf(session, bad));
  assert.match(result.stdout, /issue/);
});

test('[R4-02] Avoid entry with a parenthetical qualifier is not matched', () => {
  const session = validSession({ sections: { Workflow: '- run the check.' } });
  const result = runCheck({ files: folder(session, glossaryWith('check (as a noun), test')) });
  assert.equal(result.stdout, CLEAN);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
});

test('[R1-11] Avoid word in a heading, backticks, and the Language section is not matched', () => {
  const session = validSession({
    sections: {
      Workflow: '- run it -> see `problem` output.',
      Language: '- `Finding` - a reported problem.',
    },
  });
  assert.match(session, /^## Problem$/m);
  const result = runCheck({ files: folder(session, glossaryWith('problem')) });
  assert.equal(result.stdout, CLEAN);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
});

test('[R1-12] Avoid word matches whole words and ignores case: only "an ISSUE here" warns', () => {
  const plural = '- the issues.';
  const upper = '- an ISSUE here.';
  const session = validSession({ sections: { Workflow: `${plural}\n${upper}` } });
  const result = runCheck({ files: folder(session, glossaryWith('issue')) });
  assertSingleAvoidWarning(result, lineOf(session, upper));
  assert.equal(lineOf(session, plural) + 1, lineOf(session, upper));
});
