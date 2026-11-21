import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validSession, validGlossary, SESSION_NAME } from '../support/fixtures.mjs';

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'workflow-check.mjs');

function makeDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'wfcheck-p04s02-'));
  for (const [rel, content] of Object.entries(files)) {
    const target = join(dir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return dir;
}

function run(cwd) {
  const result = spawnSync(process.execPath, [CLI], { cwd, input: '', encoding: 'utf8' });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('[Q-determinism] two in-place runs and a run on a copy give identical stdout and exit code', () => {
  const session = validSession({
    sections: {
      Requirements: '- R1 - stores rows in a database table. Accept: rows persist.',
      Language: '- `Finding` - a reported break.\n- `Widget` - a thing with no Glossary entry.',
    },
  });
  const dir = makeDir({
    [`.workflow/sessions/${SESSION_NAME}`]: session,
    '.workflow/language.md': validGlossary(),
  });
  const first = run(dir);
  const second = run(dir);

  const copyParent = mkdtempSync(join(tmpdir(), 'wfcheck-p04s02-copy-'));
  const copy = join(copyParent, 'deeper', 'elsewhere');
  mkdirSync(copy, { recursive: true });
  cpSync(join(dir, '.workflow'), join(copy, '.workflow'), { recursive: true });
  const third = run(copy);

  assert.match(first.stdout, /: error: /);
  assert.match(first.stdout, /: warning: /);
  assert.equal(first.code, 1);
  assert.equal(second.stdout, first.stdout);
  assert.equal(second.code, first.code);
  assert.equal(third.stdout, first.stdout);
  assert.equal(third.code, first.code);
});

test('[Q-speed] 10 valid final Sessions of about 1,000 words and a 40-Term Glossary finish within 2,000 ms', () => {
  const files = {};
  for (let i = 0; i < 10; i += 1) {
    const day = String(10 + i).padStart(2, '0');
    const filler = [];
    for (let line = 0; line < 50; line += 1) {
      filler.push('- alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon.');
    }
    const session = validSession({
      title: `# Context - 2026-11-${day} 11:24`,
      sections: {
        Problem: filler.join('\n'),
        Requirements: `- R${i + 1} - Users can run step ${i + 1}. Accept: step ${i + 1} runs.`,
      },
    });
    files[`.workflow/sessions/context-2026-11-${day}-1124.md`] = session;
  }
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const terms = ['- `Finding` - a reported break.'];
  for (let i = 0; i < 39; i += 1) {
    terms.push(`- \`Term${letters[Math.floor(i / 26)]}${letters[i % 26]}\` - a made up term.`);
  }
  files['.workflow/language.md'] = `# Language\n\n## Terms\n${terms.join('\n')}\n\n## Retired\n`;
  const dir = makeDir(files);

  const start = process.hrtime.bigint();
  const result = run(dir);
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

  assert.equal(result.stdout, 'workflow-check: 0 errors, 0 warnings\n');
  assert.equal(result.code, 0);
  assert.ok(elapsedMs <= 2000, `run took ${elapsedMs} ms`);
});
