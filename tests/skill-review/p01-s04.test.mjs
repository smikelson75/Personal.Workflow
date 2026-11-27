import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
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

function makeFixture(record) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p01s04-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  const copilot = join(root, 'copilot');
  const claude = join(root, 'claude');
  const out = join(root, 'out', 'compact.json');
  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
  }
  for (const skill of ['pull-work', 'brain-storm', 'skill-review']) {
    put(join(home, '.claude', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  mkdirSync(copilot, { recursive: true });
  mkdirSync(claude, { recursive: true });
  if (record !== undefined) {
    put(join(home, 'skill-review', 'review-record.json'), JSON.stringify(record));
  }
  git(home, 'add', '-A');
  git(home, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');
  return {
    root, home, proj, copilot, claude, out,
    // starts: { lineNumber: skillName }; total physical lines
    copilotLog(id, total, starts, cwd = proj) {
      const rows = [];
      for (let n = 1; n <= total; n += 1) {
        let type = 'assistant.message';
        let data = {};
        if (n === 1) {
          type = 'session.start';
          data = { sessionId: id, context: { cwd } };
        } else if (starts[n]) {
          type = 'skill.invoked';
          data = { name: starts[n] };
        }
        rows.push(JSON.stringify({ type, data, id: `e${n}`, timestamp: '2026-11-01T00:00:00Z', parentId: null }));
      }
      put(join(copilot, 'session-state', id, 'events.jsonl'), `${rows.join('\n')}\n`);
    },
    run(args = []) {
      const res = spawnSync(process.execPath, [CLI, 'prepare', ...args, '--out', out], {
        cwd: proj,
        encoding: 'utf8',
        env: {
          ...process.env,
          WORKFLOW_HOME: home,
          SKILL_REVIEW_COPILOT_HOME: copilot,
          SKILL_REVIEW_CLAUDE_HOME: claude,
        },
      });
      const stdoutLines = res.stdout.split(/\r?\n/).filter((l) => l !== '');
      return { status: res.status, stdoutLines, stdout: res.stdout };
    },
    status(dir) {
      return git(dir, 'status', '--porcelain');
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

const rec = (conversations) => ({
  format: 1,
  conversations,
  handoffs: [],
  observations: [],
  installs: [],
  nextObservation: 1,
});

function compact(fx, result) {
  const line = result.stdoutLines.find((l) => l.startsWith('compact-record: '));
  assert.ok(line, `expected a compact-record line in: ${result.stdout}`);
  assert.equal(result.stdoutLines.at(-1), line, 'compact-record is the last line');
  const file = line.slice('compact-record: '.length);
  assert.ok(existsSync(file), 'compact-record file exists');
  return JSON.parse(readFileSync(file, 'utf8'));
}

test('[R54-01] a resumed Conversation lists only records after the last reviewed Position', () => {
  const fx = makeFixture(rec({ 'Copilot CLI:c1': { 'pull-work': 400 } }));
  try {
    fx.copilotLog('c1', 520, { 2: 'pull-work' });
    const res = fx.run();
    assert.equal(res.status, 0);
    assert.ok(res.stdoutLines.includes('skill-review: prepared 1 skill uses in 1 Conversations'));
    const json = compact(fx, res);
    assert.equal(json.project, basename(fx.proj));
    assert.equal(json.conversations.length, 1);
    const c1 = json.conversations[0];
    assert.equal(c1.harness, 'Copilot CLI');
    assert.equal(c1.id, 'c1');
    assert.deepEqual(c1.uses.map(({ skill, start, end, from }) => ({ skill, start, end, from })), [{ skill: 'pull-work', start: 2, end: 520, from: 401 }]);
  } finally {
    fx.cleanup();
  }
});

test('[R54-02] a fully reviewed Conversation leaves nothing to review', () => {
  const fx = makeFixture(rec({ 'Copilot CLI:c1': { 'pull-work': 520 } }));
  try {
    fx.copilotLog('c1', 520, { 2: 'pull-work' });
    const res = fx.run();
    assert.equal(res.status, 0);
    assert.equal(res.stdoutLines.at(-1), 'skill-review: nothing to review');
    assert.ok(!res.stdoutLines.some((l) => l.startsWith('compact-record:')));
    assert.ok(!existsSync(fx.out), 'no compact-record file is written');
  } finally {
    fx.cleanup();
  }
});

test('[R54-03] only the skill with unreviewed records is listed', () => {
  const fx = makeFixture(rec({ 'Copilot CLI:c1': { 'brain-storm': 9 } }));
  try {
    fx.copilotLog('c1', 20, { 2: 'brain-storm', 10: 'pull-work' });
    const res = fx.run();
    assert.equal(res.status, 0);
    assert.ok(res.stdoutLines.includes('skill-review: prepared 1 skill uses in 1 Conversations'));
    const json = compact(fx, res);
    assert.equal(json.conversations.length, 1);
    assert.deepEqual(json.conversations[0].uses.map(({ skill, start, end, from }) => ({ skill, start, end, from })), [{ skill: 'pull-work', start: 10, end: 20, from: 10 }]);
  } finally {
    fx.cleanup();
  }
});

test('[R54-04] a record entry for another Conversation does not affect c1', () => {
  const fx = makeFixture(rec({ 'Copilot CLI:c9': { 'pull-work': 10 } }));
  try {
    fx.copilotLog('c1', 12, { 2: 'pull-work' });
    fx.copilotLog('c9', 10, { 2: 'pull-work' });
    const res = fx.run();
    assert.equal(res.status, 0);
    assert.ok(res.stdoutLines.includes('skill-review: prepared 1 skill uses in 1 Conversations'));
    const json = compact(fx, res);
    assert.equal(json.conversations.length, 1);
    assert.equal(json.conversations[0].id, 'c1');
    assert.deepEqual(json.conversations[0].uses.map(({ skill, start, end, from }) => ({ skill, start, end, from })), [{ skill: 'pull-work', start: 2, end: 12, from: 2 }]);
  } finally {
    fx.cleanup();
  }
});

test('[R61-01] prepare leaves the Review Record and the Home Repo unchanged', () => {
  const fx = makeFixture(rec({ 'Copilot CLI:c9': { 'pull-work': 5 } }));
  try {
    fx.copilotLog('c1', 12, { 2: 'pull-work' });
    const recordFile = join(fx.home, 'skill-review', 'review-record.json');
    const before = readFileSync(recordFile, 'utf8');
    const statusHome = fx.status(fx.home);
    const statusProj = fx.status(fx.proj);
    const res = fx.run();
    assert.equal(res.status, 0);
    assert.ok(res.stdoutLines.includes('skill-review: prepared 1 skill uses in 1 Conversations'));
    assert.equal(fx.status(fx.home), statusHome);
    assert.equal(fx.status(fx.proj), statusProj);
    assert.equal(readFileSync(recordFile, 'utf8'), before);
  } finally {
    fx.cleanup();
  }
});
