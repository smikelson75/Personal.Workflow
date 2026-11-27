import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cli = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout;
}

function put(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function makeFixture() {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'skrev-s01-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  const copilot = join(root, 'copilot');
  const claude = join(root, 'claude');
  for (const d of [home, proj, copilot, claude]) mkdirSync(d, { recursive: true });
  for (const name of ['pull-work', 'brain-storm', 'skill-review']) {
    put(join(home, '.claude', 'skills', name, 'SKILL.md'), `# ${name}\n`);
  }
  put(join(proj, 'README.md'), 'project\n');
  for (const d of [home, proj]) {
    git(d, 'init', '-b', 'main');
    git(d, 'config', 'core.autocrlf', 'false');
    git(d, 'add', '-A');
    git(d, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');
  }
  return { root, home, proj, copilot, claude };
}

function run(fx, args = [], { workflowHome = fx.home } = {}) {
  const env = { ...process.env, SKILL_REVIEW_COPILOT_HOME: fx.copilot, SKILL_REVIEW_CLAUDE_HOME: fx.claude };
  delete env.WORKFLOW_HOME;
  if (workflowHome !== null) env.WORKFLOW_HOME = workflowHome;
  const res = spawnSync(process.execPath, [cli, 'prepare', ...args], { cwd: fx.proj, env, encoding: 'utf8' });
  const out = (res.stdout ?? '').split(/\r?\n/);
  while (out.length && out[out.length - 1] === '') out.pop();
  return { status: res.status, lines: out, stdout: res.stdout ?? '' };
}

function statusOf(fx) {
  return { home: git(fx.home, 'status', '--porcelain'), proj: git(fx.proj, 'status', '--porcelain') };
}

function findFile(dir, name) {
  const found = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      if (e.isDirectory()) walk(join(d, e.name));
      else if (e.name === name) found.push(join(d, e.name));
    }
  };
  walk(dir);
  return found;
}

function withFixture(fn) {
  const fx = makeFixture();
  try {
    fn(fx);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
}

test('[R67-01] unset WORKFLOW_HOME fails with home-layout-required and writes nothing', () => {
  withFixture((fx) => {
    const before = statusOf(fx);
    const res = run(fx, [], { workflowHome: null });
    assert.equal(res.stdout.trim(), 'skill-review failed: home-layout-required: start the Harness with the Launch Script');
    assert.equal(res.status, 1);
    assert.deepEqual(statusOf(fx), before);
  });
});

test('[R53-01] unknown skill name fails and lists known skills', () => {
  withFixture((fx) => {
    const res = run(fx, ['pul-work']);
    assert.equal(res.lines[0], 'skill-review failed: unknown-skill: pul-work');
    assert.ok(res.lines.slice(1).includes('known skills: brain-storm, pull-work, skill-review'));
    assert.equal(res.status, 1);
  });
});

test('[R52-01] Review Record that is not JSON fails with records-unreadable', () => {
  withFixture((fx) => {
    const file = join(fx.home, 'skill-review', 'review-record.json');
    put(file, 'not json');
    const res = run(fx);
    assert.equal(res.stdout.trim(), `skill-review failed: records-unreadable: ${file}`);
    assert.equal(res.status, 1);
  });
});

test('[R52-02] Review Record with format 2 fails with records-unreadable', () => {
  withFixture((fx) => {
    const file = join(fx.home, 'skill-review', 'review-record.json');
    put(file, '{"format":2}');
    const res = run(fx);
    assert.equal(res.stdout.trim(), `skill-review failed: records-unreadable: ${file}`);
    assert.equal(res.status, 1);
  });
});

test('[R65-01] empty log folders print both notices and nothing to review', () => {
  withFixture((fx) => {
    const res = run(fx);
    assert.equal(res.status, 0);
    assert.ok(res.lines.includes('notice: no-conversation-log: Copilot CLI'));
    assert.ok(res.lines.includes('notice: no-conversation-log: Claude Code'));
    assert.equal(res.lines[res.lines.length - 1], 'skill-review: nothing to review');
    assert.ok(!res.lines.some((l) => l.startsWith('compact-record:')));
  });
});

test('[R52-03] empty run leaves both repos unchanged and writes no review-record.json', () => {
  withFixture((fx) => {
    const before = statusOf(fx);
    const res = run(fx);
    assert.equal(res.status, 0);
    assert.deepEqual(statusOf(fx), before);
    assert.deepEqual(findFile(fx.home, 'review-record.json'), []);
    assert.deepEqual(findFile(fx.proj, 'review-record.json'), []);
  });
});
