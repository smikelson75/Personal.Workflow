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

function observation(id, fields = {}) {
  return {
    id,
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
    ...fields,
  };
}

function baseRecord(observations = []) {
  return {
    format: 1,
    conversations: {},
    handoffs: [],
    observations,
    installs: [],
    nextObservation: 10,
  };
}

function makeFixture({
  observations = [],
  rawRecord = undefined,
  withUpdateHome = true,
  withLanguageAddons = true,
} = {}) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p06s02-')));
  const home = join(root, 'home');
  const proj = join(root, 'Personal.Workflow');
  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
  }
  for (const skill of ['pull-work', 'brain-storm', 'skill-review']) {
    put(join(home, '.claude', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  const recordFile = join(home, 'skill-review', 'review-record.json');
  if (rawRecord !== undefined) put(recordFile, rawRecord);
  else put(recordFile, JSON.stringify(baseRecord(observations), null, 2) + '\n');

  put(join(proj, 'README.md'), 'Personal.Workflow\n');
  if (withUpdateHome) put(join(proj, 'scripts', 'update-home.mjs'), '// update-home\n');
  if (withLanguageAddons) put(join(proj, 'language-addons', 'node', 'harness', 'SKILL.md'), '# harness\n');

  for (const dir of [home, proj]) {
    git(dir, 'add', '-A');
    git(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');
  }

  const run = ({ workflowHome = home } = {}) => {
    const env = { ...process.env };
    delete env.WORKFLOW_HOME;
    if (workflowHome !== null) env.WORKFLOW_HOME = workflowHome;
    const res = spawnSync(process.execPath, [CLI, 'apply-list'], { cwd: proj, env, encoding: 'utf8' });
    const lines = (res.stdout ?? '').split(/\r?\n/);
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    return { status: res.status, lines, stdout: res.stdout ?? '' };
  };

  const statusOf = () => ({
    home: git(home, 'status', '--porcelain'),
    proj: git(proj, 'status', '--porcelain'),
  });

  return {
    root,
    home,
    proj,
    recordFile,
    run,
    statusOf,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

test('[R68-01] apply-list lists confirmed part change Observations in Next wording and skips watching', () => {
  const desc = 'The skill hid its last step.';
  const fx = makeFixture({
    observations: [
      observation('O03', {
        state: 'confirmed',
        outcome: 'part change',
        part: 'pull-work',
        fixType: 'clarified rule',
        description: desc,
      }),
      observation('O04', {
        state: 'watching',
        outcome: 'part change',
        part: 'pull-work',
        fixType: 'clarified rule',
        description: 'Another issue still watching.',
        cases: 1,
      }),
    ],
  });
  try {
    const res = fx.run();
    assert.equal(res.status, 0, res.stdout);
    assert.deepEqual(res.lines, [`- O03 pull-work: ${desc} Fix type: clarified rule.`]);
    assert.ok(!res.stdout.includes('O04'));
  } finally {
    fx.cleanup();
  }
});

test('[R68-02] apply-list excludes changed, improved, dismissed, and confirmed Developer note Observations', () => {
  const fx = makeFixture({
    observations: [
      observation('O01', { state: 'changed', changeCommit: 'a1b2c3d', description: 'Changed obs.' }),
      observation('O02', { state: 'improved', changeCommit: 'b2c3d4e', chances: 2, description: 'Improved obs.' }),
      observation('O03', {
        state: 'dismissed',
        outcome: 'no action',
        cause: 'model habit',
        model: 'gpt-5',
        fixType: null,
        fixReason: null,
        description: 'Dismissed obs.',
      }),
      observation('O04', {
        state: 'confirmed',
        kind: 'Developer contribution',
        outcome: 'Developer note',
        fixType: null,
        fixReason: null,
        description: 'Developer note obs.',
      }),
      observation('O05', {
        state: 'confirmed',
        outcome: 'part change',
        part: 'brain-storm',
        fixType: 'removed rule',
        description: 'Confirmed part change obs.',
      }),
    ],
  });
  try {
    const res = fx.run();
    assert.equal(res.status, 0, res.stdout);
    assert.deepEqual(res.lines, ['- O05 brain-storm: Confirmed part change obs. Fix type: removed rule.']);
    for (const excluded of ['O01', 'O02', 'O03', 'O04']) {
      assert.ok(!res.stdout.includes(excluded), `stdout must not include ${excluded}`);
    }
  } finally {
    fx.cleanup();
  }
});

test('[R68-03] apply-list prints nothing to apply when no confirmed part change exists', () => {
  const fx = makeFixture({
    observations: [
      observation('O01', { state: 'watching', cases: 1 }),
    ],
  });
  try {
    const before = fx.statusOf();
    const res = fx.run();
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.stdout.trim(), 'apply-observation: nothing to apply');
    assert.deepEqual(fx.statusOf(), before);
  } finally {
    fx.cleanup();
  }
});

test('[R68-04] apply-list fails with home-layout-required when WORKFLOW_HOME is unset or missing', () => {
  const fx = makeFixture();
  try {
    const before = fx.statusOf();
    for (const workflowHome of [null, join(fx.root, 'missing-home')]) {
      const res = fx.run({ workflowHome });
      assert.equal(res.status, 1, `expected exit 1 for WORKFLOW_HOME=${workflowHome}`);
      assert.equal(
        res.stdout.trim(),
        'apply-observation failed: home-layout-required: start the Harness with the Launch Script',
      );
      assert.deepEqual(fx.statusOf(), before);
    }
  } finally {
    fx.cleanup();
  }
});

test('[R68-05] apply-list fails with dirty-tree when Personal.Workflow has uncommitted changes', () => {
  const fx = makeFixture({
    observations: [observation('O03')],
  });
  try {
    put(join(fx.proj, 'untracked-file.txt'), 'dirty\n');
    const before = fx.statusOf();
    const res = fx.run();
    assert.equal(res.status, 1);
    assert.equal(res.lines.length, 1);
    assert.ok(res.lines[0].startsWith('apply-observation failed: dirty-tree:'), res.stdout);
    assert.ok(res.lines[0].includes('untracked-file.txt'), res.stdout);
    assert.deepEqual(fx.statusOf(), before);
  } finally {
    fx.cleanup();
  }
});

test('[R68-06] apply-list fails with records-unreadable when review-record.json is unreadable', () => {
  const fx = makeFixture({ rawRecord: 'not json' });
  try {
    const before = fx.statusOf();
    const res = fx.run();
    assert.equal(res.status, 1);
    assert.equal(res.lines.length, 1);
    assert.ok(res.lines[0].startsWith('apply-observation failed: records-unreadable:'), res.stdout);
    assert.ok(res.lines[0].includes(fx.recordFile), res.stdout);
    assert.equal(readFileSync(fx.recordFile, 'utf8'), 'not json');
    assert.deepEqual(fx.statusOf(), before);
  } finally {
    fx.cleanup();
  }
});

test('[R73-01] apply-list fails with not-personal-workflow when cwd lacks scripts/update-home.mjs or language-addons/', () => {
  for (const opts of [
    { withUpdateHome: false, withLanguageAddons: true },
    { withUpdateHome: true, withLanguageAddons: false },
  ]) {
    const fx = makeFixture({ observations: [observation('O03')], ...opts });
    try {
      const before = fx.statusOf();
      const res = fx.run();
      assert.equal(res.status, 1);
      assert.equal(
        res.stdout.trim(),
        'apply-observation failed: not-personal-workflow: run it in Personal.Workflow',
      );
      assert.deepEqual(fx.statusOf(), before);
    } finally {
      fx.cleanup();
    }
  }
});
