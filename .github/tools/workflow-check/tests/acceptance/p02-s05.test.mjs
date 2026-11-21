import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck } from '../support/harness.mjs';
import { validGlossary, validSession } from '../support/fixtures.mjs';

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'workflow-check.mjs');

const NAME_A = 'context-2026-11-20-1124.md';
const NAME_B = 'context-2026-11-20-1200.md';
const TITLE_B = '# Context - 2026-11-20 12:00';
const PATH_A = `.workflow/sessions/${NAME_A}`;
const PATH_B = `.workflow/sessions/${NAME_B}`;

// Substitution for the duplicate-id Finding (needs S04): B has no `- Size:` line,
// which the CLI already reports as structure/session-status at B line 1.
function sessionWithoutSize(overrides) {
  const text = validSession({ ...overrides, size: 'small' });
  const stripped = text.replace('- Size: small\n', '');
  assert.notEqual(stripped, text);
  return stripped;
}

function twoSessionFolder() {
  return {
    [PATH_A]: validSession({ relationship: 'new' }),
    [PATH_B]: sessionWithoutSize({
      relationship: 'extend',
      title: TITLE_B,
      sections: { Requirements: '- R2 - Users can stop it. Accept: it stops.' },
    }),
    '.workflow/language.md': validGlossary(),
  };
}

function assertExit2OneLine(r, expectedStderr) {
  assert.equal(r.code, 2);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, expectedStderr);
  assert.ok(r.stderr.endsWith('\n'));
  assert.equal(r.stderr.split('\n').length, 2, `stderr was: ${JSON.stringify(r.stderr)}`);
}

const NAME_C = 'context-2026-11-20-1300.md';
const PATH_C = `.workflow/sessions/${NAME_C}`;

// A: bad Relationship (own error). B: missing Size (own error). C: clean.
function threeSessionFolder() {
  return {
    [PATH_A]: validSession({ relationship: 'bogus' }),
    [PATH_B]: sessionWithoutSize({
      relationship: 'extend',
      title: TITLE_B,
      sections: { Requirements: '- R2 - Users can stop it. Accept: it stops.' },
    }),
    [PATH_C]: validSession({
      relationship: 'extend',
      title: '# Context - 2026-11-20 13:00',
      sections: { Requirements: '- R3 - Users can pause it. Accept: it pauses.' },
    }),
    '.workflow/language.md': validGlossary(),
  };
}

function onlyFinding(r, path, ruleId, line = 1) {
  const lines = r.stdout.split('\n');
  assert.equal(lines.length, 3, `stdout was: ${JSON.stringify(r.stdout)}`);
  assert.match(lines[0], new RegExp(`^${path.replace(/\./g, '\\.')}:${line}: error: ${ruleId}: \\S.*$`));
  assert.equal(lines[1], 'workflow-check: 1 errors, 0 warnings');
  assert.equal(lines[2], '');
  assert.equal(r.stderr, '');
  assert.equal(r.code, 1);
}

test('[R8-01] file argument prints only that Session\'s Findings and counts them', () => {
  const rb = runCheck({ files: threeSessionFolder(), args: [PATH_B] });
  onlyFinding(rb, PATH_B, 'structure/session-status');
  const ra = runCheck({ files: threeSessionFolder(), args: [PATH_A] });
  onlyFinding(ra, PATH_A, 'structure/session-status', 4);
});

test('[R8-02] file argument of a clean Session hides other Sessions\' Findings', () => {
  const r = runCheck({ files: threeSessionFolder(), args: [PATH_C] });
  assert.equal(r.stdout, 'workflow-check: 0 errors, 0 warnings\n');
  assert.equal(r.stderr, '');
  assert.equal(r.code, 0);
});

test('[R8-03] file that does not exist exits 2', () => {
  const arg = '.workflow/sessions/context-2099-01-01-0000.md';
  const r = runCheck({ files: twoSessionFolder(), args: [arg] });
  assertExit2OneLine(r, `workflow-check: ${arg} does not exist\n`);
});

test('[R8-04] path outside the Workflow Folder exits 2', () => {
  const files = {};
  for (const [k, v] of Object.entries(twoSessionFolder())) files[`proj/${k}`] = v;
  files['elsewhere.md'] = '# elsewhere\n';
  const r = runCheck({ files, cwd: 'proj', args: ['../elsewhere.md'] });
  assertExit2OneLine(
    r,
    'workflow-check: ../elsewhere.md is not a Session or the Glossary of the Workflow Folder\n',
  );
});

test('[R8-05] existing file that is neither Session nor Glossary exits 2', () => {
  const files = { ...twoSessionFolder(), '.workflow/notes.md': '# notes\n' };
  const r = runCheck({ files, args: ['.workflow/notes.md'] });
  assertExit2OneLine(
    r,
    'workflow-check: .workflow/notes.md is not a Session or the Glossary of the Workflow Folder\n',
  );
});

test('[R8-06] absolute Glossary path from a subdirectory prints its Finding', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfcheck-s05-'));
  const files = {
    [PATH_A]: validSession(),
    [PATH_B]: sessionWithoutSize({ relationship: 'extend', title: TITLE_B }),
    '.workflow/language.md': '# Language\n\n## Terms\n- `Finding` - a reported break.\n',
  };
  for (const [rel, content] of Object.entries(files)) {
    const target = join(dir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  const sub = join(dir, 'sub', 'deeper');
  mkdirSync(sub, { recursive: true });
  const r = spawnSync(process.execPath, [CLI, join(dir, '.workflow', 'language.md')], {
    cwd: sub,
    input: '',
    encoding: 'utf8',
  });
  const lines = r.stdout.split('\n');
  assert.equal(lines.length, 3, `stdout was: ${JSON.stringify(r.stdout)}`);
  assert.match(lines[0], /^\.workflow\/language\.md:1: error: structure\/glossary-section: \S.*$/);
  assert.equal(lines[1], 'workflow-check: 1 errors, 0 warnings');
  assert.equal(lines[2], '');
  assert.equal(r.stderr, '');
  assert.equal(r.status, 1);
});

test('[R8-07] two file arguments exit 2', () => {
  const r = runCheck({ files: twoSessionFolder(), args: [PATH_A, PATH_B] });
  assertExit2OneLine(r, 'workflow-check: expected at most one file argument\n');
});
