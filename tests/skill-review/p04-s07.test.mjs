import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p04s07-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  const copilot = join(root, 'copilot');
  const claude = join(root, 'claude');
  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
  }
  for (const skill of ['pull-work', 'brain-storm', 'skill-review']) {
    put(join(home, '.claude', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  put(join(proj, 'app.txt'), 'app\n');
  mkdirSync(copilot, { recursive: true });
  mkdirSync(claude, { recursive: true });
  git(home, 'add', '-A');
  git(home, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');
  const baseEnv = {
    ...process.env,
    SKILL_REVIEW_COPILOT_HOME: copilot,
    SKILL_REVIEW_CLAUDE_HOME: claude,
    SKILL_REVIEW_NOW: '2026-11-26T14:05:00',
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
    WORKFLOW_HOME: home,
  };
  const exec = (args, { homeSet = true } = {}) => {
    const env = { ...baseEnv };
    if (!homeSet) delete env.WORKFLOW_HOME;
    const res = spawnSync(process.execPath, [CLI, ...args], { cwd: proj, encoding: 'utf8', env });
    const stdoutLines = res.stdout.split(/\r?\n/).filter((l) => l !== '');
    return { status: res.status, stdoutLines, stdout: res.stdout };
  };
  const compactFile = join(root, 'compact.json');
  const judgementFile = join(root, 'judgement.json');
  put(
    compactFile,
    JSON.stringify({
      project: 'Scheduler',
      conversations: [
        {
          harness: 'Copilot CLI',
          id: 'c1',
          file: '/logs/c1.jsonl',
          uses: [{ skill: 'pull-work', start: 2, end: 20, from: 2 }],
        },
      ],
      tokens: { depth1: 120, depth2: 30 },
      notices: [],
    }),
  );
  put(judgementFile, JSON.stringify({ cases: [] }));
  const skillDir = join(home, 'skill-review');
  return {
    root, home, proj, compactFile, judgementFile, skillDir, exec,
    finish() {
      const res = exec(['finish', compactFile, judgementFile]);
      assert.equal(res.status, 0, res.stdout);
      return res;
    },
    homeStatus: () => git(home, 'status', '--porcelain', '-uall'),
    projStatus: () => git(proj, 'status', '--porcelain', '-uall'),
    head: () => git(home, 'rev-parse', 'HEAD').trim(),
    files() {
      return [
        join(skillDir, 'ledger.md'),
        join(skillDir, 'review-record.json'),
        join(skillDir, 'summaries', '2026-11-26-1405-Scheduler.md'),
      ];
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

test('[R63-01] commit commits only the skill-review records', () => {
  const fx = makeFixture();
  try {
    fx.finish();
    put(join(fx.home, 'notes.md'), 'notes\n');
    const before = fx.head();
    const res = fx.exec(['commit', fx.compactFile]);
    assert.equal(res.status, 0, res.stdout);
    assert.match(res.stdoutLines.at(-1), /^skill-review: committed [0-9a-f]{7}$/);
    assert.notEqual(fx.head(), before);
    assert.equal(git(fx.home, 'log', '-1', '--format=%s').trim(), 'docs(skill-review): review Scheduler');
    const files = git(fx.home, 'show', '--name-only', '--format=', 'HEAD').split(/\r?\n/).filter(Boolean).sort();
    assert.deepEqual(files, [
      'skill-review/ledger.md',
      'skill-review/review-record.json',
      'skill-review/summaries/2026-11-26-1405-Scheduler.md',
    ]);
    assert.equal(git(fx.home, 'status', '--porcelain', '-uall'), '?? notes.md\n');
  } finally {
    fx.cleanup();
  }
});

test('[R63-02] finish and commit leave the Project Repo status identical', () => {
  const fx = makeFixture();
  try {
    const before = fx.projStatus();
    assert.equal(before, '?? app.txt\n');
    fx.finish();
    const res = fx.exec(['commit', fx.compactFile]);
    assert.equal(res.status, 0, res.stdout);
    assert.match(res.stdoutLines.at(-1), /^skill-review: committed [0-9a-f]{7}$/);
    assert.equal(fx.projStatus(), before);
  } finally {
    fx.cleanup();
  }
});

test('[R52-18] commit with a failing pre-commit hook fails, keeps the records, and succeeds once the hook is removed', () => {
  const fx = makeFixture();
  try {
    fx.finish();
    const hook = join(fx.home, '.git', 'hooks', 'pre-commit');
    put(hook, '#!/bin/sh\nexit 1\n');
    chmodSync(hook, 0o755);
    const before = fx.head();
    const res = fx.exec(['commit', fx.compactFile]);
    assert.equal(res.status, 1, res.stdout);
    assert.ok(res.stdout.startsWith('skill-review failed: commit-failed: '), res.stdout);
    const expected = fx.files().sort();
    assert.deepEqual(res.stdoutLines.slice(1), expected.map((f) => `record: ${f}`));
    for (const f of expected) assert.ok(existsSync(f), `${f} still exists`);
    assert.equal(fx.head(), before);

    rmSync(hook);
    const again = fx.exec(['commit', fx.compactFile]);
    assert.equal(again.status, 0, again.stdout);
    assert.match(again.stdoutLines.at(-1), /^skill-review: committed [0-9a-f]{7}$/);
    const files = git(fx.home, 'show', '--name-only', '--format=', 'HEAD').split(/\r?\n/).filter(Boolean).sort();
    assert.deepEqual(files, [
      'skill-review/ledger.md',
      'skill-review/review-record.json',
      'skill-review/summaries/2026-11-26-1405-Scheduler.md',
    ]);
  } finally {
    fx.cleanup();
  }
});

test('[R52-19] commit with nothing changed says so and keeps HEAD', () => {
  const fx = makeFixture();
  try {
    fx.finish();
    const first = fx.exec(['commit', fx.compactFile]);
    assert.equal(first.status, 0, first.stdout);
    assert.match(first.stdoutLines.at(-1), /^skill-review: committed [0-9a-f]{7}$/);
    const head = fx.head();
    const res = fx.exec(['commit', fx.compactFile]);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.stdout.trimEnd(), 'skill-review: nothing to commit');
    assert.equal(fx.head(), head);
  } finally {
    fx.cleanup();
  }
});

test('[R52-20] commit with no argument, no WORKFLOW_HOME, or a missing compact file fails and changes nothing', () => {
  const fx = makeFixture();
  try {
    fx.finish();
    const head = fx.head();
    const status = fx.homeStatus();
    const cases = [
      [['commit'], {}, 'skill-review failed: usage: skill-review commit <compact-record-file>'],
      [['commit', fx.compactFile], { homeSet: false }, 'skill-review failed: home-layout-required: start the Harness with the Launch Script'],
      [['commit', 'missing-compact.json'], {}, 'skill-review failed: record-unreadable: missing-compact.json'],
    ];
    for (const [args, opts, message] of cases) {
      const res = fx.exec(args, opts);
      assert.equal(res.status, 1, message);
      assert.equal(res.stdout.trimEnd(), message);
      assert.equal(fx.head(), head, message);
      assert.equal(fx.homeStatus(), status, message);
      assert.deepEqual(readdirSync(fx.skillDir).sort(), ['ledger.md', 'review-record.json', 'summaries'], message);
    }
  } finally {
    fx.cleanup();
  }
});
