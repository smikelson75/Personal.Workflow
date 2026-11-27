import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');
const NOW = '2026-11-26T14:05:00';
const SUMMARY_NAME = '2026-11-26-1405-Scheduler.md';

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
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p05s10-')));
  const home = join(root, 'home');
  const proj = join(root, 'Scheduler');
  const copilot = join(root, 'copilot');
  const claude = join(root, 'claude');
  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
  }
  for (const skill of ['pull-work', 'brain-storm', 'behavior-spec', 'skill-review', 'incubate']) {
    put(join(home, '.claude', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  mkdirSync(copilot, { recursive: true });
  mkdirSync(claude, { recursive: true });
  git(home, 'add', '-A');
  git(home, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');
  const env = {
    ...process.env,
    WORKFLOW_HOME: home,
    SKILL_REVIEW_NOW: NOW,
    SKILL_REVIEW_COPILOT_HOME: copilot,
    SKILL_REVIEW_CLAUDE_HOME: claude,
  };
  const exec = (args) => {
    const res = spawnSync(process.execPath, [CLI, ...args], { cwd: proj, encoding: 'utf8', env });
    return { status: res.status, lines: res.stdout.split(/\r?\n/).filter((l) => l !== ''), stdout: res.stdout };
  };
  return {
    root, home, proj, exec,
    summaryFile: join(home, 'skill-review', 'summaries', SUMMARY_NAME),
    copilotLog(id, rows) {
      const all = [['session.start', { sessionId: id, context: { cwd: proj } }], ...rows];
      const text = all
        .map(([type, data], i) => JSON.stringify({ type, data, id: `e${i + 1}`, timestamp: '2026-11-01T00:00:00Z', parentId: null }))
        .join('\n');
      put(join(copilot, 'session-state', id, 'events.jsonl'), `${text}\n`);
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

test('[R67-05] an unreviewed incubate Conversation is reviewed like any other skill use', () => {
  const fx = makeFixture();
  try {
    fx.copilotLog('c1', [
      ['skill.invoked', { name: 'incubate' }],
      ['user.message', { content: 'go' }],
      ['assistant.message', { content: 'ok' }],
    ]);
    const compactFile = join(fx.root, 'out', 'compact.json');
    const judgementFile = join(fx.root, 'out', 'judgement.json');

    const prep = fx.exec(['prepare', '--out', compactFile]);
    assert.equal(prep.status, 0, prep.stdout);
    const compact = JSON.parse(readFileSync(compactFile, 'utf8'));
    const uses = compact.conversations.flatMap((c) => c.uses.map((u) => u.skill));
    assert.deepEqual(uses, ['incubate']);

    put(judgementFile, JSON.stringify({ cases: [] }));
    const fin = fx.exec(['finish', compactFile, judgementFile]);
    assert.equal(fin.status, 0, fin.stdout);
    assert.ok(existsSync(fx.summaryFile), `summary file exists: ${fx.summaryFile}`);
    const line = readFileSync(fx.summaryFile, 'utf8').split(/\r?\n/)[2];
    assert.equal(
      line,
      'Reviewed: 1 Conversations, 1 skill uses (incubate), 0 Handoffs; pending Handoffs: 0',
    );
  } finally {
    fx.cleanup();
  }
});
