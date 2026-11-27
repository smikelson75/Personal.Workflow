import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');
const NOW = '2026-11-26T14:05:00.000Z';

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, `git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout.trim();
}

function put(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function confirmedObs(id, part) {
  return {
    id,
    part,
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
  };
}

function makeFixture({ updateScript } = {}) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p06s04-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  const markerFile = join(root, 'update-home-ran.txt');

  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
    git(dir, 'config', 'user.name', 't');
    git(dir, 'config', 'user.email', 't@t');
  }

  for (const skill of ['pull-work', 'brain-storm', 'skill-review']) {
    put(join(home, '.claude', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  const recordFile = join(home, 'skill-review', 'review-record.json');
  put(
    recordFile,
    JSON.stringify(
      {
        format: 1,
        conversations: {},
        handoffs: [],
        observations: [confirmedObs('O03', 'pull-work'), confirmedObs('O05', 'brain-storm')],
        installs: [],
        nextObservation: 6,
      },
      null,
      2,
    ) + '\n',
  );
  git(home, 'add', '-A');
  git(home, 'commit', '-m', 'init');

  put(join(proj, 'language-addons', '.gitkeep'), '');
  put(
    join(proj, 'scripts', 'update-home.mjs'),
    updateScript ??
      [
        "import { writeFileSync } from 'node:fs';",
        `writeFileSync(${JSON.stringify(markerFile)}, 'ran');`,
        "console.log('Updated 2 files');",
        "console.log('Workflow version: 3f9a2c1 -> 7e8d9f0');",
      ].join('\n') + '\n',
  );
  git(proj, 'add', '-A');
  git(proj, 'commit', '-m', 'init');

  put(join(proj, '.github', 'skills', 'pull-work', 'SKILL.md'), '# pull-work v2\n');
  git(proj, 'add', '-A');
  git(proj, 'commit', '-m', 'fix(pull-work): clarify rule (O03)');
  const c1 = git(proj, 'rev-parse', '--short=7', 'HEAD');

  put(join(proj, '.github', 'skills', 'brain-storm', 'SKILL.md'), '# brain-storm v2\n');
  git(proj, 'add', '-A');
  git(proj, 'commit', '-m', 'fix(brain-storm): clarify rule (O05)');
  const c2 = git(proj, 'rev-parse', '--short=7', 'HEAD');

  const env = {
    ...process.env,
    WORKFLOW_HOME: home,
    SKILL_REVIEW_NOW: NOW,
  };

  return {
    root,
    home,
    proj,
    c1,
    c2,
    markerFile,
    recordFile,
    ledgerFile: join(home, 'skill-review', 'ledger.md'),
    run(args) {
      const res = spawnSync(process.execPath, [CLI, ...args], { cwd: proj, encoding: 'utf8', env });
      return {
        status: res.status,
        stdout: res.stdout,
        stderr: res.stderr,
        lines: res.stdout.split(/\r?\n/).filter((l) => l !== ''),
      };
    },
    readRecord() {
      return JSON.parse(readFileSync(recordFile, 'utf8'));
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

test('[R70-04] apply-finish marks picks changed, rewrites ledger.md, and commits Home Repo', () => {
  const fx = makeFixture();
  try {
    const res = fx.run(['apply-finish', `O03:${fx.c1}`, `O05:${fx.c2}`]);
    assert.equal(res.status, 0, res.stdout + res.stderr);

    const rec = fx.readRecord();
    const o3 = rec.observations.find((o) => o.id === 'O03');
    const o5 = rec.observations.find((o) => o.id === 'O05');
    assert.equal(o3.state, 'changed');
    assert.equal(o3.changeCommit, fx.c1);
    assert.equal(o5.state, 'changed');
    assert.equal(o5.changeCommit, fx.c2);

    assert.ok(existsSync(fx.ledgerFile), 'ledger.md should exist');
    const ledger = readFileSync(fx.ledgerFile, 'utf8');
    assert.match(ledger, /### O03 pull-work/);
    assert.match(ledger, /### O05 brain-storm/);
    assert.match(ledger, new RegExp(`Change commit: ${fx.c1}`));
    assert.match(ledger, new RegExp(`Change commit: ${fx.c2}`));

    const commitCount = Number(git(fx.home, 'rev-list', '--count', 'HEAD'));
    assert.equal(commitCount, 2);
    const subject = git(fx.home, 'log', '-1', '--format=%s');
    assert.equal(subject, 'docs(skill-review): apply O03, O05');
  } finally {
    fx.cleanup();
  }
});

test('[R71-01] apply-finish records the printed workflow version and HEAD source and prints full Update Script output', () => {
  const fx = makeFixture();
  try {
    const head = git(fx.proj, 'rev-parse', '--short=7', 'HEAD');
    const res = fx.run(['apply-finish', `O03:${fx.c1}`]);
    assert.equal(res.status, 0, res.stdout + res.stderr);

    assert.ok(res.stdout.includes('Updated 2 files'), res.stdout);
    assert.ok(res.stdout.includes('Workflow version: 3f9a2c1 -> 7e8d9f0'), res.stdout);

    const rec = fx.readRecord();
    assert.equal(rec.installs.length, 1);
    const newest = rec.installs[rec.installs.length - 1];
    assert.equal(newest.version, '7e8d9f0');
    assert.equal(newest.source, head);
  } finally {
    fx.cleanup();
  }
});

test('[R71-02] apply-finish with 0 picks does not run Update Script and commits nothing in Home Repo', () => {
  const fx = makeFixture();
  try {
    const beforeCount = Number(git(fx.home, 'rev-list', '--count', 'HEAD'));
    const res = fx.run(['apply-finish']);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(existsSync(fx.markerFile), false, 'update-home.mjs should not run');

    const afterCount = Number(git(fx.home, 'rev-list', '--count', 'HEAD'));
    assert.equal(afterCount, beforeCount);
  } finally {
    fx.cleanup();
  }
});

test('[R71-03] apply-finish when Update Script exits 1 prints output, keeps changed not yet installed, adds no install record, and commits Home Repo', () => {
  const fx = makeFixture({
    updateScript: [
      "console.log('update-home failed: target locked');",
      'process.exit(1);',
    ].join('\n') + '\n',
  });
  try {
    const res = fx.run(['apply-finish', `O03:${fx.c1}`]);
    assert.ok(res.stdout.includes('update-home failed: target locked'), res.stdout);

    const rec = fx.readRecord();
    const o3 = rec.observations.find((o) => o.id === 'O03');
    assert.equal(o3.state, 'changed');
    assert.equal(o3.changeCommit, fx.c1);
    assert.equal(rec.installs.length, 0);

    assert.ok(existsSync(fx.ledgerFile), 'ledger.md should exist');
    const ledger = readFileSync(fx.ledgerFile, 'utf8');
    assert.match(ledger, /State: changed, not yet installed/);

    const commitCount = Number(git(fx.home, 'rev-list', '--count', 'HEAD'));
    assert.equal(commitCount, 2);
    const subject = git(fx.home, 'log', '-1', '--format=%s');
    assert.equal(subject, 'docs(skill-review): apply O03');
  } finally {
    fx.cleanup();
  }
});
