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
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p06s05-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
    git(dir, 'config', 'user.name', 't');
    git(dir, 'config', 'user.email', 't@t');
  }

  // Personal.Workflow-like structure in proj
  put(join(proj, 'language-addons', 'node', 'SKILL.md'), '# node\n');
  put(
    join(proj, 'scripts', 'update-home.mjs'),
    "console.log('Workflow version: 3f9a2c1 -> 7e8d9f0');\n",
  );
  const pullWorkFile = join(proj, '.github', 'skills', 'pull-work', 'SKILL.md');
  const brainStormFile = join(proj, '.github', 'skills', 'brain-storm', 'SKILL.md');
  put(pullWorkFile, '# pull-work\nline 1\n');
  put(brainStormFile, '# brain-storm\nline 1\n');
  git(proj, 'add', '-A');
  git(proj, 'commit', '-m', 'init proj');

  // Apply O03 on pull-work
  put(pullWorkFile, '# pull-work\nline 1\nrule for O03\n');
  git(proj, 'add', '-A');
  git(proj, 'commit', '-m', 'fix(pull-work): clarify rule (O03)');
  const c1 = git(proj, 'rev-parse', '--short=7', 'HEAD').trim();

  // Apply O05 on brain-storm (disjoint file)
  put(brainStormFile, '# brain-storm\nline 1\nrule for O05\n');
  git(proj, 'add', '-A');
  git(proj, 'commit', '-m', 'fix(brain-storm): clarify rule (O05)');
  const c2 = git(proj, 'rev-parse', '--short=7', 'HEAD').trim();

  // Home Repo with review-record.json
  const recordFile = join(home, 'skill-review', 'review-record.json');
  const ledgerFile = join(home, 'skill-review', 'ledger.md');
  put(
    recordFile,
    JSON.stringify(
      {
        format: 1,
        conversations: {},
        handoffs: [],
        observations: [
          {
            id: 'O03',
            part: 'pull-work',
            state: 'changed',
            side: 'using',
            kind: 'rule adherence',
            cases: 2,
            chances: 0,
            outcome: 'part change',
            fixType: 'clarified rule',
            fixReason: 'A rule exists and was misread.',
            changeCommit: c1,
            description: 'Pull-work missed step.',
          },
          {
            id: 'O04',
            part: 'behavior-spec',
            state: 'confirmed',
            side: 'using',
            kind: 'rule adherence',
            cases: 2,
            chances: 0,
            outcome: 'part change',
            fixType: 'clarified rule',
            fixReason: 'A rule exists and was misread.',
            changeCommit: null,
            description: 'Behavior-spec missed step.',
          },
          {
            id: 'O05',
            part: 'brain-storm',
            state: 'changed',
            side: 'writing',
            kind: 'rule adherence',
            cases: 2,
            chances: 0,
            outcome: 'part change',
            fixType: 'clarified rule',
            fixReason: 'A rule exists and was misread.',
            changeCommit: c2,
            description: 'Brain-storm missed step.',
          },
        ],
        installs: [],
        nextObservation: 6,
      },
      null,
      2,
    ) + '\n',
  );
  git(home, 'add', '-A');
  git(home, 'commit', '-m', 'init home');

  const env = {
    ...process.env,
    WORKFLOW_HOME: home,
    SKILL_REVIEW_NOW: '2026-11-26T14:05:00',
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
  };

  const exec = (args) => {
    const res = spawnSync(process.execPath, [CLI, ...args], { cwd: proj, encoding: 'utf8', env });
    return {
      status: res.status,
      lines: res.stdout.split(/\r?\n/).filter((l) => l !== ''),
      stdout: res.stdout,
    };
  };

  return {
    root,
    home,
    proj,
    c1,
    c2,
    pullWorkFile,
    brainStormFile,
    recordFile,
    ledgerFile,
    exec,
    readRecord: () => JSON.parse(readFileSync(recordFile, 'utf8')),
    projHead: () => git(proj, 'rev-parse', '--short=7', 'HEAD').trim(),
    homeHead: () => git(home, 'rev-parse', '--short=7', 'HEAD').trim(),
    projSubject: () => git(proj, 'log', '-1', '--pretty=%s').trim(),
    homeSubject: () => git(home, 'log', '-1', '--pretty=%s').trim(),
    projStatus: () => git(proj, 'status', '--porcelain', '-uall').trim(),
    homeStatus: () => git(home, 'status', '--porcelain', '-uall').trim(),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test('[R72-01] undo O03 reverts its commit, sets O03 confirmed, runs Update Script, and commits Home Repo', () => {
  const fx = makeFixture();
  try {
    const res = fx.exec(['undo', 'O03']);
    assert.equal(res.status, 0, res.stdout);

    assert.equal(fx.projSubject(), 'revert(pull-work): undo O03');
    assert.equal(readFileSync(fx.pullWorkFile, 'utf8'), '# pull-work\nline 1\n');
    assert.equal(readFileSync(fx.brainStormFile, 'utf8'), '# brain-storm\nline 1\nrule for O05\n');
    assert.equal(fx.projStatus(), '');

    const rec = fx.readRecord();
    const o03 = rec.observations.find((o) => o.id === 'O03');
    const o05 = rec.observations.find((o) => o.id === 'O05');
    assert.equal(o03.state, 'confirmed');
    assert.equal(o03.changeCommit, null);
    assert.equal(o05.state, 'changed');
    assert.equal(o05.changeCommit, fx.c2);

    assert.equal(rec.installs.length, 1);
    assert.equal(rec.installs[0].version, '7e8d9f0');
    assert.equal(rec.installs[0].source, fx.projHead());

    assert.equal(fx.homeSubject(), 'docs(skill-review): undo O03');
    assert.equal(fx.homeStatus(), '');
    const ledger = readFileSync(fx.ledgerFile, 'utf8');
    assert.match(ledger, /### O03 pull-work\r?\nState: confirmed/);
  } finally {
    fx.cleanup();
  }
});

test('[R72-02] undo-check and undo fail with unknown-observation when Observation ID does not exist', () => {
  const fx = makeFixture();
  try {
    for (const cmd of ['undo-check', 'undo']) {
      const res = fx.exec([cmd, 'O99']);
      assert.equal(res.status, 1);
      assert.deepEqual(res.lines, ['apply-observation failed: unknown-observation: O99']);
    }
  } finally {
    fx.cleanup();
  }
});

test('[R72-03] undo-check and undo fail with not-applied when changeCommit is null', () => {
  const fx = makeFixture();
  try {
    for (const cmd of ['undo-check', 'undo']) {
      const res = fx.exec([cmd, 'O04']);
      assert.equal(res.status, 1);
      assert.deepEqual(res.lines, ['apply-observation failed: not-applied: O04']);
    }
  } finally {
    fx.cleanup();
  }
});

test('[R72-04] undo fails with revert-conflict naming conflicting files and leaves both repos unchanged', () => {
  const fx = makeFixture();
  try {
    put(fx.pullWorkFile, '# pull-work\nline 1\nconflicting later edit\n');
    git(fx.proj, 'add', '-A');
    git(fx.proj, 'commit', '-m', 'chore(pull-work): overwrite line');

    const projHeadBefore = fx.projHead();
    const homeHeadBefore = fx.homeHead();
    const recordBefore = readFileSync(fx.recordFile, 'utf8');

    const res = fx.exec(['undo', 'O03']);
    assert.equal(res.status, 1);
    assert.equal(res.lines.length, 1);
    assert.ok(
      res.lines[0].startsWith('apply-observation failed: revert-conflict:'),
      `unexpected line: ${res.lines[0]}`,
    );
    assert.ok(
      res.lines[0].includes('.github/skills/pull-work/SKILL.md'),
      `missing conflicting file in: ${res.lines[0]}`,
    );

    assert.equal(fx.projHead(), projHeadBefore);
    assert.equal(fx.projStatus(), '');
    assert.equal(fx.homeHead(), homeHeadBefore);
    assert.equal(fx.homeStatus(), '');
    assert.equal(readFileSync(fx.recordFile, 'utf8'), recordBefore);
  } finally {
    fx.cleanup();
  }
});

test('[R72-05] undo-check and undo fail with dirty-tree when proj has uncommitted changes and leave both repos unchanged', () => {
  const fx = makeFixture();
  try {
    put(fx.pullWorkFile, '# pull-work\nline 1\nrule for O03\ndirty\n');
    const projHeadBefore = fx.projHead();
    const homeHeadBefore = fx.homeHead();
    const projStatusBefore = fx.projStatus();
    const recordBefore = readFileSync(fx.recordFile, 'utf8');

    for (const cmd of ['undo-check', 'undo']) {
      const res = fx.exec([cmd, 'O03']);
      assert.equal(res.status, 1);
      assert.equal(res.lines.length, 1);
      assert.ok(
        res.lines[0].startsWith('apply-observation failed: dirty-tree:'),
        `unexpected line: ${res.lines[0]}`,
      );
      assert.equal(fx.projHead(), projHeadBefore);
      assert.equal(fx.projStatus(), projStatusBefore);
      assert.equal(fx.homeHead(), homeHeadBefore);
      assert.equal(fx.homeStatus(), '');
      assert.equal(readFileSync(fx.recordFile, 'utf8'), recordBefore);
    }
  } finally {
    fx.cleanup();
  }
});
