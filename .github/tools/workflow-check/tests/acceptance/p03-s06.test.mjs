import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../support/harness.mjs';
import { validSession, validGlossary, SESSION_NAME } from '../support/fixtures.mjs';

const SESSION_PATH = `.workflow/sessions/${SESSION_NAME}`;
const GLOSSARY_PATH = '.workflow/language.md';
const CLEAN = 'workflow-check: 0 errors, 0 warnings\n';

function lineOf(text, exact) {
  const idx = text.split('\n').indexOf(exact);
  assert.notEqual(idx, -1, `fixture line not found: ${exact}`);
  return idx + 1;
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertSingleWarning(result, path, line, words) {
  const prefix = `${path}:${line}: warning: excess/out-of-stage: `;
  const lines = result.stdout.split('\n');
  assert.match(result.stdout, new RegExp(`^${escape(prefix)}\\S.*\\n`), `stdout was: ${result.stdout}`);
  assert.equal(lines.length, 3, `expected one finding and a summary, got: ${result.stdout}`);
  assert.equal(lines[1], 'workflow-check: 0 errors, 1 warnings');
  assert.equal(lines[2], '');
  assert.ok(lines[0].length - prefix.length <= 160);
  for (const word of words) assert.ok(lines[0].includes(word), `message should name ${word}: ${lines[0]}`);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
}

function assertClean(result) {
  assert.equal(result.stdout, CLEAN);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
}

test('[R5-07] implementation words in a Requirements line are an out-of-stage warning at that line', () => {
  const bad = '- R1 - stores rows in a database table. Accept: rows persist.';
  const session = validSession({ sections: { Requirements: bad } });
  const result = runCheck({ files: { [SESSION_PATH]: session, [GLOSSARY_PATH]: validGlossary() } });
  assertSingleWarning(result, SESSION_PATH, lineOf(session, bad), ['database', 'table']);
});

test('[R5-08] implementation word in a Constraints line produces no Finding', () => {
  const session = validSession({ sections: { Constraints: '- imposed format: SQL export - owner: finance' } });
  const result = runCheck({ files: { [SESSION_PATH]: session, [GLOSSARY_PATH]: validGlossary() } });
  assertClean(result);
});

test('[R5-09] endpoint in Existing Solution and in Decisions produces no Finding', () => {
  const session = validSession({
    relationship: 'extend',
    sections: {
      'Existing Solution': '- the endpoint lists items.',
      Decisions: '- parked: endpoint choice - later.',
    },
  });
  const result = runCheck({ files: { [SESSION_PATH]: session, [GLOSSARY_PATH]: validGlossary() } });
  assertClean(result);
});

test('[R5-10] implementation word in a Glossary meaning is an out-of-stage warning at the Glossary line', () => {
  const bad = '- `Finding` - a reported break at an endpoint.';
  const glossary = `# Language\n\n## Terms\n${bad}\n\n## Retired\n`;
  assert.equal(lineOf(glossary, bad), 4);
  const result = runCheck({ files: { [SESSION_PATH]: validSession(), [GLOSSARY_PATH]: glossary } });
  assertSingleWarning(result, GLOSSARY_PATH, 4, ['endpoint']);
});

test('[R5-11] plural, backticked, and heading uses of out-of-stage words produce no Finding', () => {
  const session = validSession({
    sections: {
      Problem: '- users need a `database` tool.',
      Workflow: '- run it -> see tables.',
      Database: '- see above.',
    },
  });
  const result = runCheck({ files: { [SESSION_PATH]: session, [GLOSSARY_PATH]: validGlossary() } });
  assertClean(result);
});
