import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../support/harness.mjs';
import { validSession, validGlossary, SESSION_NAME } from '../support/fixtures.mjs';

const SESSION_PATH = `.workflow/sessions/${SESSION_NAME}`;
const CLEAN = 'workflow-check: 0 errors, 0 warnings\n';

function folder(session) {
  return { [SESSION_PATH]: session, '.workflow/language.md': validGlossary() };
}

function assertSingleSectionError(result, sectionName) {
  const expected = `${SESSION_PATH}:1: error: structure/session-section: missing required section: ## ${sectionName}\n`;
  assert.equal(
    result.stdout,
    `${expected}workflow-check: 1 errors, 0 warnings\n`,
  );
  assert.equal(result.code, 1);
  assert.equal(result.stderr, '');
}

test('[R2-15] a small extend Session with only Existing Solution, Problem, and Requirements has no session-section Finding', () => {
  const session = validSession({
    size: 'small',
    relationship: 'extend',
    sections: {
      Users: null,
      Workflow: null,
      'Scope Guardrails': null,
      Constraints: null,
      Success: null,
      Decisions: null,
      Language: null,
    },
  });
  const result = runCheck({ files: folder(session) });
  assert.doesNotMatch(result.stdout, /structure\/session-section/);
  assert.equal(result.stdout, CLEAN);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
});

test('[R2-16] a large Session missing Constraints is a session-section error at line 1', () => {
  const session = validSession({ size: 'large', sections: { Constraints: null } });
  const result = runCheck({ files: folder(session) });
  assertSingleSectionError(result, 'Constraints');
});

test('[R2-17] a medium Session with no Language has no session-section Finding', () => {
  const session = validSession({ size: 'medium', sections: { Language: null } });
  const result = runCheck({ files: folder(session) });
  assert.doesNotMatch(result.stdout, /structure\/session-section/);
  assert.equal(result.stdout, CLEAN);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
});

test('[R2-18] a medium Session missing Users is a session-section error at line 1', () => {
  const session = validSession({ size: 'medium', sections: { Users: null } });
  const result = runCheck({ files: folder(session) });
  assertSingleSectionError(result, 'Users');
});

test('[R2-19] a small Session missing Requirements is a session-section error at line 1', () => {
  const session = validSession({ size: 'small', sections: { Requirements: null } });
  const result = runCheck({ files: folder(session) });
  assertSingleSectionError(result, 'Requirements');
});
