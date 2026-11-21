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

function assertSingleError(result, path, ruleId, line) {
  const prefix = `${path}:${line}: error: ${ruleId}: `;
  const lines = result.stdout.split('\n');
  assert.match(result.stdout, new RegExp(`^${escape(prefix)}\\S.*\\n`), `stdout was: ${result.stdout}`);
  assert.equal(lines.length, 3, `expected one finding and a summary, got: ${result.stdout}`);
  assert.equal(lines[1], 'workflow-check: 1 errors, 0 warnings');
  assert.equal(lines[2], '');
  assert.ok(lines[0].length - prefix.length <= 160);
  assert.equal(result.code, 1);
  assert.equal(result.stderr, '');
}

test('[R4-05] Language bullet with no Glossary Term is a missing-term error at that bullet', () => {
  const bullet = '- `Widget` - a thing';
  const session = validSession({ sections: { Language: bullet } });
  const result = runCheck({
    files: { [SESSION_PATH]: session, [GLOSSARY_PATH]: validGlossary() },
  });
  assertSingleError(result, SESSION_PATH, 'vocabulary/missing-term', lineOf(session, bullet));
});

test('[R4-06] Language bullet matching a Glossary Term case-insensitively produces no Finding', () => {
  const session = validSession({ sections: { Language: '- `finding` - a break' } });
  const result = runCheck({
    files: { [SESSION_PATH]: session, [GLOSSARY_PATH]: validGlossary() },
  });
  assert.equal(result.stdout, CLEAN);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
});

test('[R4-12] missing Glossary reports only structure/glossary-missing', () => {
  const session = validSession({ sections: { Language: '- `Widget` - a thing' } });
  const result = runCheck({ files: { [SESSION_PATH]: session } });
  assertSingleError(result, GLOSSARY_PATH, 'structure/glossary-missing', 1);
  assert.doesNotMatch(result.stdout, /vocabulary\//);
});
