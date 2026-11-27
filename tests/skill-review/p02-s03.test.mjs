import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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

function makeFixture(record) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p02s03-')));
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
  const env = {
    ...process.env,
    WORKFLOW_HOME: home,
    SKILL_REVIEW_COPILOT_HOME: copilot,
    SKILL_REVIEW_CLAUDE_HOME: claude,
  };
  const exec = (args) => {
    const res = spawnSync(process.execPath, [CLI, ...args], { cwd: proj, encoding: 'utf8', env });
    const stdoutLines = res.stdout.split(/\r?\n/).filter((l) => l !== '');
    return { status: res.status, stdoutLines, stdout: res.stdout };
  };
  return {
    root, home, proj, copilot, claude, out,
    // rows: array of [type, data]; line 1 is the session.start row added here
    copilotLog(id, rows) {
      const all = [['session.start', { sessionId: id, context: { cwd: proj } }], ...rows];
      const text = all
        .map(([type, data], i) => JSON.stringify({ type, data, id: `e${i + 1}`, timestamp: '2026-11-01T00:00:00Z', parentId: null }))
        .join('\n');
      put(join(copilot, 'session-state', id, 'events.jsonl'), `${text}\n`);
    },
    run(args = []) {
      return exec(['prepare', ...args, '--out', out]);
    },
    slice(file, id, line) {
      return exec(['slice', file, id, String(line)]);
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

// R62-01's fixture: Copilot c1, lines 1-8
function r6201Log(fx) {
  fx.copilotLog('c1', [
    ['skill.invoked', { name: 'pull-work' }],
    ['user.message', { content: 'go' }],
    ['assistant.message', { content: 'x'.repeat(4001) }],
    ['tool.execution_start', { toolName: 'ask_user' }],
    ['tool.execution_complete', { success: false }],
    ['user.message', { content: 'no, stop that' }],
    ['assistant.message', { content: 'ok' }],
  ]);
}

const ceil4 = (n) => Math.ceil(n / 4);

function prepared(fx) {
  const res = fx.run();
  assert.equal(res.status, 0, res.stdout);
  const line = res.stdoutLines.find((l) => l.startsWith('compact-record: '));
  assert.ok(line, `expected a compact-record line in: ${res.stdout}`);
  const file = line.slice('compact-record: '.length);
  assert.ok(existsSync(file), 'compact-record file exists');
  return { res, file, json: JSON.parse(readFileSync(file, 'utf8')) };
}

function sliceBodyChars(res) {
  assert.equal(res.status, 0, res.stdout);
  assert.match(res.stdoutLines[0], /^slice: c1 line \d+$/);
  return res.stdoutLines.slice(1, -1).join('\n').length;
}

test('[R62-13] prepare reports depth 1 model tokens and records them', () => {
  const fx = makeFixture();
  try {
    r6201Log(fx);
    const { res, json } = prepared(fx);
    const prepIdx = res.stdoutLines.findIndex((l) => l.startsWith('skill-review: prepared '));
    assert.ok(prepIdx > 0, `expected a prepared line after a tokens line in: ${res.stdout}`);
    const L = JSON.stringify({ project: json.project, conversations: json.conversations }, null, 2).length;
    const n = ceil4(L);
    assert.equal(res.stdoutLines[prepIdx - 1], `skill-review: model tokens: depth 1: ${n}`);
    assert.deepEqual(json.tokens, { depth1: n, depth2: 0 });
  } finally {
    fx.cleanup();
  }
});

test('[R62-14] slice reports depth 2 model tokens and records the slice', () => {
  const fx = makeFixture();
  try {
    r6201Log(fx);
    const { file } = prepared(fx);
    const res = fx.slice(file, 'c1', 4);
    const C = sliceBodyChars(res);
    const m = ceil4(C);
    assert.equal(res.stdoutLines.at(-1), `skill-review: model tokens: depth 2: ${m}`);
    const after = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(after.tokens.depth2, m);
    assert.equal(typeof after.tokens.depth1, 'number');
    assert.ok(after.tokens.depth1 > 0);
    assert.deepEqual(Object.keys(after.tokens).sort(), ['depth1', 'depth2']);
    assert.deepEqual(after.slices, [{ id: 'c1', line: 4, chars: C }]);
  } finally {
    fx.cleanup();
  }
});

test('[R62-15] slicing the same line again does not count it twice', () => {
  const fx = makeFixture();
  try {
    r6201Log(fx);
    const { file, json } = prepared(fx);
    const depth1 = json.tokens?.depth1;
    const first = fx.slice(file, 'c1', 4);
    const C4 = sliceBodyChars(first);
    const second = fx.slice(file, 'c1', 7);
    const C7 = sliceBodyChars(second);
    const third = fx.slice(file, 'c1', 4);
    assert.equal(sliceBodyChars(third), C4);
    const after = JSON.parse(readFileSync(file, 'utf8'));
    assert.deepEqual(after.slices, [
      { id: 'c1', line: 4, chars: C4 },
      { id: 'c1', line: 7, chars: C7 },
    ]);
    assert.equal(after.tokens.depth2, ceil4(C4 + C7));
    assert.equal(after.tokens.depth1, depth1);
    assert.equal(third.stdoutLines.at(-1), `skill-review: model tokens: depth 2: ${ceil4(C4 + C7)}`);
  } finally {
    fx.cleanup();
  }
});

test('[R62-16] nothing to review prints no model tokens line and writes no record file', () => {
  const fx = makeFixture({
    format: 1,
    conversations: { 'Copilot CLI:c1': { 'pull-work': 8 } },
    handoffs: [],
    observations: [],
    installs: [],
    nextObservation: 1,
  });
  try {
    r6201Log(fx);
    const res = fx.run();
    assert.equal(res.status, 0, res.stdout);
    assert.ok(res.stdoutLines.includes('skill-review: nothing to review'), res.stdout);
    assert.ok(!res.stdoutLines.some((l) => l.includes('model tokens')));
    assert.ok(!existsSync(fx.out), 'no compact-record file is written');
  } finally {
    fx.cleanup();
  }
});
