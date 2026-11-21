import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../support/harness.mjs';
import { validSession, validGlossary, SESSION_NAME } from '../support/fixtures.mjs';

const SESSION_PATH = `.workflow/sessions/${SESSION_NAME}`;
const CLEAN = 'workflow-check: 0 errors, 0 warnings\n';

function folder(session) {
  return { [SESSION_PATH]: session, '.workflow/language.md': validGlossary() };
}

function lineOf(text, exact) {
  const idx = text.split('\n').indexOf(exact);
  assert.notEqual(idx, -1, `fixture line not found: ${exact}`);
  return idx + 1;
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertSingleFinding(result, ruleId, line) {
  const re = new RegExp(`^${escape(SESSION_PATH)}:${line}: error: ${escape(ruleId)}: \\S.*\\n`);
  assert.match(result.stdout, re);
  const lines = result.stdout.split('\n');
  assert.equal(lines.length, 3, `expected one finding and a summary, got: ${result.stdout}`);
  assert.equal(lines[1], 'workflow-check: 1 errors, 0 warnings');
  assert.equal(lines[2], '');
  assert.ok(lines[0].length - `${SESSION_PATH}:${line}: error: ${ruleId}: `.length <= 160);
  assert.equal(result.code, 1);
}

test('[R2-05] missing Scope Guardrails section is a session-section error at line 1', () => {
  const session = validSession({ sections: { 'Scope Guardrails': null } });
  const files = folder(session);
  const result = runCheck({ files });
  assertSingleFinding(result, 'structure/session-section', 1);
  assert.match(result.stdout, /Scope Guardrails/);
  assert.equal(result.stderr, '');
});

test('[R2-06] extend without Existing Solution errors; new without it does not', () => {
  const extend = runCheck({
    files: folder(validSession({ relationship: 'extend', sections: { 'Existing Solution': null } })),
  });
  assertSingleFinding(extend, 'structure/session-section', 1);
  assert.match(extend.stdout, /Existing Solution/);

  const fresh = runCheck({
    files: folder(validSession({ relationship: 'new', sections: { 'Existing Solution': null } })),
  });
  assert.equal(fresh.stdout, CLEAN);
  assert.equal(fresh.code, 0);
});

test('[R2-07] requirement without Accept is a requirement-format error at that line', () => {
  const bad = '- R4 - Users can export.';
  const session = validSession({
    sections: { Requirements: `- R1 - Users can run it. Accept: it runs.\n${bad}` },
  });
  const result = runCheck({ files: folder(session) });
  assertSingleFinding(result, 'structure/requirement-format', lineOf(session, bad));
});

test('[R2-08] only the malformed requirement is flagged; retired forms are accepted', () => {
  const bad = '- R3 - Users can export.';
  const session = validSession({
    sections: {
      Requirements: [
        '- R1 - Users can run it. Accept: it runs.',
        bad,
        '- R4 - retired.',
        '- R5 - retired, superseded by R4.',
      ].join('\n'),
    },
  });
  const result = runCheck({ files: folder(session) });
  assertSingleFinding(result, 'structure/requirement-format', lineOf(session, bad));
});

test('[R2-09] Builds on link without backticks is a link-format error at that line', () => {
  const bad = '- Builds on: context-2026-11-19-0900.md';
  const session = validSession({ header: [bad] });
  const result = runCheck({ files: folder(session) });
  assertSingleFinding(result, 'structure/link-format', lineOf(session, bad));

  const good = validSession({ header: ['- Builds on: `context-2026-11-19-0900.md`, `context-2026-11-18-1000.md`'] });
  const ok = runCheck({ files: folder(good) });
  assert.equal(ok.stdout, CLEAN);
  assert.equal(ok.code, 0);
});

test('[R2-10] open decision is an error in a final Session and ignored in a draft', () => {
  const open = '- open: confirm limit';
  const sections = { Decisions: `- parked: extras - later.\n${open}` };
  const finalSession = validSession({ status: 'final', sections });
  const result = runCheck({ files: folder(finalSession) });
  assertSingleFinding(result, 'structure/final-open', lineOf(finalSession, open));

  const draftFiles = folder(validSession({ status: 'draft', sections }));
  draftFiles['.workflow/sessions/context-2026-11-21-0900.md'] = validSession({
    title: '# Context - 2026-11-21 09:00',
    header: [`- Supersedes: \`${SESSION_NAME}\``],
    sections: { Requirements: '- R50 - Users can run it. Accept: it runs.' },
  });
  const draft = runCheck({ files: draftFiles });
  assert.equal(draft.stdout, CLEAN);
  assert.equal(draft.code, 0);
});
