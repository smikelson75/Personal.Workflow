import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck, snapshotTree } from '../support/harness.mjs';
import { SESSION_NAME, validGlossary, validSession } from '../support/fixtures.mjs';

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'workflow-check.mjs');

// Builds a temp tree (files plus empty directories), returns its path.
function buildTree({ files = {}, dirs = [] }) {
  const dir = mkdtempSync(join(tmpdir(), 'wfcheck-s04-'));
  for (const d of dirs) mkdirSync(join(dir, d), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const target = join(dir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return dir;
}

function runIn(dir) {
  const r = spawnSync(process.execPath, [CLI], { cwd: dir, input: '', encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

const FINDING_LINE = /^(.+?):(\d+): (error|warning): ([a-z0-9-]+\/[a-z0-9-]+): (.*)$/;

test('[R1-04] empty sessions folder reports structure/no-session', () => {
  const dir = buildTree({
    files: { '.workflow/language.md': validGlossary() },
    dirs: ['.workflow/sessions'],
  });
  const { code, stdout } = runIn(dir);
  const lines = stdout.split('\n');
  assert.equal(lines.length, 3, `stdout was: ${JSON.stringify(stdout)}`);
  assert.equal(lines[2], '');
  assert.match(lines[0], /^\.workflow\/sessions:1: error: structure\/no-session: \S.*$/);
  assert.equal(lines[1], 'workflow-check: 1 errors, 0 warnings');
  assert.equal(code, 1);
});

test('[R1-05] missing language.md reports structure/glossary-missing', () => {
  const { code, stdout } = runCheck({
    files: { [`.workflow/sessions/${SESSION_NAME}`]: validSession() },
  });
  const lines = stdout.split('\n');
  assert.equal(lines.length, 3, `stdout was: ${JSON.stringify(stdout)}`);
  assert.match(lines[0], /^\.workflow\/language\.md:1: error: structure\/glossary-missing: \S.*$/);
  assert.equal(lines[1], 'workflow-check: 1 errors, 0 warnings');
  assert.equal(lines[2], '');
  assert.equal(code, 1);
});

test('[R1-06] unreadable Session and missing glossary both reported', () => {
  const { code, stdout } = runCheck({
    files: {
      '.workflow/sessions/context-2026-11-19-0900.md': validSession({
        title: '# Context - 2026-11-19 09:00',
        sections: { Requirements: '- R50 - Users can run it. Accept: it runs.' },
      }),
      [`.workflow/sessions/${SESSION_NAME}`]: Buffer.from([0xc3, 0x28]),
    },
  });
  const lines = stdout.split('\n');
  assert.equal(lines.length, 4, `stdout was: ${JSON.stringify(stdout)}`);
  assert.match(lines[0], /^\.workflow\/language\.md:1: error: structure\/glossary-missing: \S.*$/);
  assert.match(
    lines[1],
    new RegExp(`^\\.workflow/sessions/${SESSION_NAME.replace(/\./g, '\\.')}:1: error: structure/unreadable: \\S.*$`),
  );
  assert.equal(lines[2], 'workflow-check: 2 errors, 0 warnings');
  assert.equal(lines[3], '');
  assert.equal(code, 1);
});

test('[Q-message-length] every Finding message is at most 160 characters', () => {
  const name = 'x'.repeat(197) + '.md';
  assert.equal(name.length, 200);
  const { code, stdout } = runCheck({
    files: {
      '.workflow/sessions/context-2026-11-19-0900.md': validSession({
        title: '# Context - 2026-11-19 09:00',
        sections: { Requirements: '- R50 - Users can run it. Accept: it runs.' },
      }),
      [`.workflow/sessions/${name}`]: Buffer.from([0xc3, 0x28]),
      '.workflow/language.md': validGlossary(),
    },
  });
  const lines = stdout.split('\n').filter((l) => l !== '');
  const summary = lines.pop();
  assert.equal(summary, 'workflow-check: 1 errors, 0 warnings');
  assert.equal(lines.length, 1, `stdout was: ${JSON.stringify(stdout)}`);
  const m = FINDING_LINE.exec(lines[0]);
  assert.ok(m, `not a Finding line: ${lines[0]}`);
  assert.equal(m[1], `.workflow/sessions/${name}`);
  assert.equal(m[2], '1');
  assert.equal(m[4], 'structure/unreadable');
  assert.ok(m[5].length > 0, 'message must not be empty');
  assert.ok(m[5].length <= 160, `message length ${m[5].length} exceeds 160`);
  assert.equal(code, 1);
});

test('[R9-02] runs leave the tree unchanged (no-session folder and no-folder cases)', () => {
  // R1-04 folder
  const dirA = buildTree({
    files: { '.workflow/language.md': validGlossary() },
    dirs: ['.workflow/sessions'],
  });
  const beforeA = snapshotTree(dirA);
  const a = runIn(dirA);
  assert.equal(a.code, 1);
  assert.match(a.stdout, /structure\/no-session/);
  assert.deepEqual(snapshotTree(dirA), beforeA);

  // R1-01 no-folder case
  const dirB = buildTree({ files: { 'a/readme.txt': 'hello' }, dirs: ['a/b'] });
  const beforeB = snapshotTree(dirB);
  const b = runIn(join(dirB, 'a', 'b'));
  assert.equal(b.code, 2);
  assert.equal(b.stdout, '');
  assert.notEqual(b.stderr, '');
  assert.deepEqual(snapshotTree(dirB), beforeB);
});
