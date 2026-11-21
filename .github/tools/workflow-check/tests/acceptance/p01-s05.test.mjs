import test from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../support/harness.mjs';
import { SESSION_NAME, validGlossary, validSession } from '../support/fixtures.mjs';

const SESS = `.workflow/sessions/${SESSION_NAME}`;

function folderWith(sessions) {
  const files = { '.workflow/language.md': validGlossary() };
  for (const [name, content] of Object.entries(sessions)) files[`.workflow/sessions/${name}`] = content;
  return files;
}

function withoutLine(text, prefix) {
  return text.split('\n').filter((l) => !l.startsWith(prefix)).join('\n');
}

// Asserts stdout is exactly the given findings (path:line: error: rule: <non-empty message>) then the summary.
function assertFindings(stdout, expected) {
  assert.ok(stdout.endsWith('\n'), 'stdout ends with LF');
  assert.ok(!stdout.includes('\r'), 'stdout has no CR');
  const lines = stdout.slice(0, -1).split('\n');
  assert.equal(lines.length, expected.length + 1, `line count, got:\n${stdout}`);
  expected.forEach(([path, line, rule], i) => {
    const prefix = `${path}:${line}: error: ${rule}: `;
    assert.ok(lines[i].startsWith(prefix), `line ${i} should start with "${prefix}", got "${lines[i]}"`);
    const message = lines[i].slice(prefix.length);
    assert.ok(message.length > 0 && message.length <= 160, `message length for line ${i}`);
  });
  assert.equal(lines[expected.length], `workflow-check: ${expected.length} errors, 0 warnings`);
}

test('[R2-01] Session file named notes.md reports structure/session-name at line 1', () => {
  const r = runCheck({ files: folderWith({ 'notes.md': validSession() }) });
  assertFindings(r.stdout, [['.workflow/sessions/notes.md', 1, 'structure/session-name']]);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, '');
});

test('[R2-02] title time not matching file name reports structure/session-title at line 1', () => {
  const r = runCheck({
    files: folderWith({ [SESSION_NAME]: validSession({ title: '# Context - 2026-11-20 11:25' }) }),
  });
  assertFindings(r.stdout, [[SESS, 1, 'structure/session-title']]);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, '');
});

test('[R2-03] Session with no Status line reports structure/session-status at line 1', () => {
  const r = runCheck({
    files: folderWith({ [SESSION_NAME]: withoutLine(validSession(), '- Status:') }),
  });
  assertFindings(r.stdout, [[SESS, 1, 'structure/session-status']]);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, '');
});

test('[R2-04] Relationship value replace reports structure/session-status at line 4', () => {
  const content = validSession().replace('- Relationship: new', '- Relationship: replace');
  assert.equal(content.split('\n')[3], '- Relationship: replace');
  const r = runCheck({ files: folderWith({ [SESSION_NAME]: content }) });
  assertFindings(r.stdout, [[SESS, 4, 'structure/session-status']]);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, '');
});

test('[R7-02] findings sort by path, line, rule-id then summary', () => {
  const bad = withoutLine(validSession({ title: '# Notes' }), '- Status:');
  const noSize = withoutLine(validSession(), '- Size:');
  const r = runCheck({ files: folderWith({ 'notes.md': bad, [SESSION_NAME]: noSize }) });
  assertFindings(r.stdout, [
    [SESS, 1, 'structure/session-status'],
    ['.workflow/sessions/notes.md', 1, 'structure/session-name'],
    ['.workflow/sessions/notes.md', 1, 'structure/session-status'],
    ['.workflow/sessions/notes.md', 1, 'structure/session-title'],
  ]);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, '');
});

test('[R10-01] CRLF endings and leading BOM produce the same output as LF without BOM', () => {
  const lf = withoutLine(validSession(), '- Status:');
  const crlf = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from(lf.replace(/\n/g, '\r\n'), 'utf8'),
  ]);
  const plain = runCheck({ files: folderWith({ [SESSION_NAME]: lf }) });
  const files = folderWith({});
  files[SESS] = crlf;
  const r = runCheck({ files });
  assertFindings(r.stdout, [[SESS, 1, 'structure/session-status']]);
  assert.equal(r.stdout, plain.stdout);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, '');
});
