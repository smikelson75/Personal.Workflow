import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runCheck, snapshotTree } from '../support/harness.mjs';
import { cleanFolder, SESSION_NAME, validGlossary, validSession } from '../support/fixtures.mjs';

const CLEAN_SUMMARY = 'workflow-check: 0 errors, 0 warnings\n';
const sha = (text) => createHash('sha256').update(text).digest('hex');

test('[R1-01] no .workflow above the working directory exits 2 with one stderr line and empty stdout', () => {
  const r = runCheck({ files: { 'a/b/readme.txt': 'x' }, cwd: 'a/b' });
  assert.equal(r.code, 2);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /^[^\r\n]*\.workflow[^\r\n]*\n$/);
  assert.match(r.stderr, /^workflow-check: no \.workflow folder found in .+ or any parent directory\n$/);
});

test('[R1-02] clean folder at the root, run from a/b, prints exactly the summary and exits 0', () => {
  const files = { ...cleanFolder(), 'a/b/keep.txt': 'x' };
  const r = runCheck({ files, cwd: 'a/b' });
  assert.equal(r.stdout, CLEAN_SUMMARY);
  assert.equal(r.code, 0);
  assert.equal(r.stderr, '');
});

test('[R1-03] the nearest .workflow is used when an outer one lacks language.md', () => {
  const files = { '.workflow/sessions/placeholder.txt': 'outer', 'proj/src/keep.txt': 'x' };
  for (const [rel, content] of Object.entries(cleanFolder())) files[`proj/${rel}`] = content;
  const r = runCheck({ files, cwd: 'proj/src' });
  assert.equal(r.stdout, CLEAN_SUMMARY);
  assert.equal(r.code, 0);
});

test('[R9-01] a run on a clean folder leaves the tree unchanged', () => {
  const r = runCheck({ files: cleanFolder() });
  assert.equal(r.stdout, CLEAN_SUMMARY);
  assert.equal(r.code, 0);
  const expected = new Map([
    ['.workflow', 'dir'],
    ['.workflow/language.md', sha(validGlossary())],
    ['.workflow/sessions', 'dir'],
    [`.workflow/sessions/${SESSION_NAME}`, sha(validSession())],
  ]);
  assert.deepEqual([...snapshotTree(r.dir)].sort(), [...expected].sort());
});
