import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..', '..');
const SCRIPT = join(REPO, '.github', 'skills', 'pull-work', 'scripts', 'glossary-check.mjs');
const MESSAGE =
  'Missing required Glossary at .workflow/language.md. Run /brain-storm to establish it before continuing with /pull-work.\n';

function run(cwd) {
  return spawnSync(process.execPath, [SCRIPT], { cwd, encoding: 'utf8' });
}

test('[R33-01] glossary-check exits 0 silently when .workflow/language.md exists', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'glossary-r33-01-'));
  try {
    mkdirSync(join(tmp, '.workflow'), { recursive: true });
    writeFileSync(
      join(tmp, '.workflow', 'language.md'),
      ['# Language', '', '## Terms', '- `Oracle` - frozen acceptance test paths.', '', '## Retired', ''].join('\n'),
      'utf8',
    );

    const res = run(tmp);
    assert.equal(res.status, 0, `expected exit 0, got ${res.status}:\n${res.stdout}\n${res.stderr}`);
    assert.equal(res.stdout, '', 'stdout must be empty');
    assert.equal(res.stderr, '', 'stderr must be empty');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('[R33-02] glossary-check exits 2 with the redirect message when .workflow/language.md is missing', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'glossary-r33-02-'));
  try {
    const res = run(tmp);
    assert.equal(res.status, 2, `expected exit 2, got ${res.status}:\n${res.stdout}\n${res.stderr}`);
    assert.equal(res.stderr, MESSAGE);
    assert.equal(res.stdout, '', 'stdout must be empty');
    assert.deepEqual(readdirSync(tmp), [], 'directory must still have no files');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
