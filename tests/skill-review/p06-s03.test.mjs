import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, `git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout;
}

function put(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function makeFixture() {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p06s03-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
  }

  const record = {
    format: 1,
    conversations: {},
    handoffs: [],
    observations: [
      {
        id: 'O03',
        part: 'pull-work',
        state: 'confirmed',
        kind: 'rule adherence',
        label: null,
        side: null,
        area: null,
        outcome: 'part change',
        cause: null,
        model: null,
        fixType: 'clarified rule',
        fixReason: 'A check cannot find this.',
        description: 'The skill asked the same question twice.',
        cases: 2,
        chances: 0,
        changeCommit: null,
        follows: null,
      },
    ],
    installs: [],
    nextObservation: 4,
  };
  put(join(home, 'skill-review', 'review-record.json'), JSON.stringify(record, null, 2) + '\n');
  git(home, 'add', '-A');
  git(home, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');

  put(join(proj, 'scripts', 'update-home.mjs'), 'process.exit(0);\n');
  put(join(proj, 'language-addons', '.gitkeep'), '');
  put(join(proj, 'tracked.txt'), 'good\n');
  put(
    join(proj, '.github', 'tools', 'workflow-check', 'bin', 'workflow-check.mjs'),
    `import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const text = readFileSync(join(process.cwd(), 'tracked.txt'), 'utf8');
if (text.includes('bad-check')) {
  process.stdout.write('workflow-check: error\\n');
  process.exit(1);
}
process.exit(0);
`,
  );
  put(
    join(proj, 'tests', 'sample.test.mjs'),
    `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('sample suite check', () => {
  const text = readFileSync(join(process.cwd(), 'tracked.txt'), 'utf8');
  assert.ok(!text.includes('bad-suite'), 'suite failed on bad-suite');
});
`,
  );
  git(proj, 'add', '-A');
  git(proj, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');

  const env = { ...process.env, WORKFLOW_HOME: home };
  return {
    root,
    home,
    proj,
    editTracked(text) {
      put(join(proj, 'tracked.txt'), text);
    },
    readTracked() {
      return readFileSync(join(proj, 'tracked.txt'), 'utf8');
    },
    status() {
      return git(proj, 'status', '--porcelain').trim();
    },
    run(args) {
      const res = spawnSync(process.execPath, [CLI, ...args], { cwd: proj, encoding: 'utf8', env });
      return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

test('[R70-01] passing apply-check exits 0 and keeps the edit on disk', () => {
  const fx = makeFixture();
  try {
    fx.editTracked('good edit\n');
    const res = fx.run(['apply-check', 'O03']);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(fx.readTracked(), 'good edit\n');
  } finally {
    fx.cleanup();
  }
});

test('[R70-02] workflow-check failure prints check-failed, exits 1, and restores the working tree', () => {
  const fx = makeFixture();
  try {
    fx.editTracked('bad-check\n');
    const res = fx.run(['apply-check', 'O03']);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.ok(res.stdout.startsWith('check-failed: O03:'), `unexpected stdout: ${res.stdout}`);
    assert.equal(fx.status(), '');
    assert.equal(fx.readTracked(), 'good\n');
  } finally {
    fx.cleanup();
  }
});

test('[R70-03] suite test failure prints check-failed, exits 1, and restores the working tree', () => {
  const fx = makeFixture();
  try {
    fx.editTracked('bad-suite\n');
    const res = fx.run(['apply-check', 'O03']);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.ok(res.stdout.startsWith('check-failed: O03:'), `unexpected stdout: ${res.stdout}`);
    assert.equal(fx.status(), '');
    assert.equal(fx.readTracked(), 'good\n');
  } finally {
    fx.cleanup();
  }
});
