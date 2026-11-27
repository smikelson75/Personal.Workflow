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
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p02s01-')));
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
    root, home, proj, out,
    // events: array of [type, data] for physical lines 2..N; line 1 is session.start
    copilotLog(id, events) {
      const all = [['session.start', { sessionId: id, context: { cwd: proj } }], ...events];
      const rows = all.map(([type, data], i) =>
        JSON.stringify({ type, data, id: `e${i + 1}`, timestamp: '2026-11-01T00:00:00Z', parentId: null }));
      put(join(copilot, 'session-state', id, 'events.jsonl'), `${rows.join('\n')}\n`);
    },
    // messages: array of [type, message|undefined] for every physical line
    claudeLog(id, messages) {
      const rows = messages.map(([type, message]) => {
        const r = { type, cwd: proj, sessionId: id };
        if (message) r.message = message;
        return JSON.stringify(r);
      });
      put(join(claude, 'projects', 'p1', `${id}.jsonl`), `${rows.join('\n')}\n`);
    },
    run() {
      const res = spawnSync(process.execPath, [CLI, 'prepare', '--out', out], {
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

function compactFile(fx, result) {
  const line = result.stdoutLines.find((l) => l.startsWith('compact-record: '));
  assert.ok(line, `expected a compact-record line in: ${result.stdout}`);
  const file = line.slice('compact-record: '.length);
  assert.ok(existsSync(file), 'compact-record file exists');
  return file;
}

function pullWork(fx, result, id) {
  const json = JSON.parse(readFileSync(compactFile(fx, result), 'utf8'));
  const conv = json.conversations.find((c) => c.id === id);
  assert.ok(conv, `conversation ${id} in compact record`);
  const use = conv.uses.find((u) => u.skill === 'pull-work');
  assert.ok(use, 'pull-work use in compact record');
  return use;
}

const skill = ['skill.invoked', { name: 'pull-work' }];
const asst = (content) => ['assistant.message', { content }];
const user = (content) => ['user.message', { content }];
const ask = ['tool.execution_start', { toolName: 'ask_user' }];
const fail = ['tool.execution_complete', { success: false }];
const LONG = 'x'.repeat(4001);

// Lines 2..8 of R62-01.
function r6201Events() {
  return [
    skill, // 2
    user('go'), // 3
    asst(LONG), // 4
    ask, // 5
    fail, // 6
    user('no, stop that'), // 7
    asst('ok'), // 8
  ];
}

test('[R62-01] a use carries signals and flags computed from its Copilot records', () => {
  const fx = makeFixture(rec({}));
  try {
    fx.copilotLog('c1', r6201Events());
    const res = fx.run();
    assert.equal(res.status, 0, res.stdout);
    const use = pullWork(fx, res, 'c1');
    assert.equal(use.start, 2);
    assert.equal(use.end, 8);
    assert.deepEqual(use.signals, {
      records: 7,
      userMessages: 2,
      assistantMessages: 2,
      toolCalls: 1,
      questions: 1,
      toolErrors: 1,
      longestAssistantChars: 4001,
    });
    assert.deepEqual(Object.keys(use.signals), [
      'records', 'userMessages', 'assistantMessages', 'toolCalls', 'questions', 'toolErrors', 'longestAssistantChars',
    ]);
    assert.deepEqual(use.flags, [
      { kind: 'long-message', line: 4 },
      { kind: 'tool-error', line: 6 },
      { kind: 'user-correction', line: 7 },
    ]);
  } finally {
    fx.cleanup();
  }
});

test('[R62-02] the compact record holds no message text', () => {
  const fx = makeFixture(rec({}));
  try {
    fx.copilotLog('c1', r6201Events());
    const res = fx.run();
    assert.equal(res.status, 0, res.stdout);
    const text = readFileSync(compactFile(fx, res), 'utf8');
    assert.ok(!text.includes(LONG), 'no 4001-character content');
    assert.ok(!text.includes('no, stop that'), 'no user message text');
    // the use must exist with signals, so absence of text is not vacuous
    const use = pullWork(fx, res, 'c1');
    assert.ok(use.signals, 'use has signals');
    assert.ok(Array.isArray(use.flags), 'use has flags');
  } finally {
    fx.cleanup();
  }
});

test('[R62-03] a use carries signals and flags computed from its Claude records', () => {
  const fx = makeFixture(rec({}));
  try {
    fx.claudeLog('k1', [
      ['user', { role: 'user', content: 'hi' }],
      ['user', { role: 'user', content: '<command-name>/pull-work</command-name>' }],
      ['assistant', { role: 'assistant', content: [{ type: 'tool_use', name: 'AskUserQuestion', input: {} }] }],
      ['user', { role: 'user', content: [{ type: 'tool_result', is_error: true, content: 'boom' }] }],
      ['assistant', { role: 'assistant', content: [{ type: 'text', text: 'done' }] }],
    ]);
    const res = fx.run();
    assert.equal(res.status, 0, res.stdout);
    const use = pullWork(fx, res, 'k1');
    assert.equal(use.start, 2);
    assert.equal(use.end, 5);
    assert.deepEqual(use.signals, {
      records: 4,
      userMessages: 1,
      assistantMessages: 2,
      toolCalls: 1,
      questions: 1,
      toolErrors: 1,
      longestAssistantChars: 4,
    });
    assert.deepEqual(use.flags, [{ kind: 'tool-error', line: 4 }]);
  } finally {
    fx.cleanup();
  }
});

test('[R62-04] six questions raise one many-questions flag at the fifth', () => {
  const fx = makeFixture(rec({}));
  try {
    fx.copilotLog('c1', [skill, ask, ask, ask, ask, ask, ask]); // lines 2, 3-8
    const res = fx.run();
    assert.equal(res.status, 0, res.stdout);
    const use = pullWork(fx, res, 'c1');
    assert.equal(use.signals.questions, 6);
    assert.deepEqual(use.flags, [{ kind: 'many-questions', line: 7 }]);
  } finally {
    fx.cleanup();
  }
});

test('[R62-05] four questions raise no flag', () => {
  const fx = makeFixture(rec({}));
  try {
    fx.copilotLog('c1', [skill, ask, ask, ask, ask, asst('ok'), asst('ok')]); // ask on 3-6
    const res = fx.run();
    assert.equal(res.status, 0, res.stdout);
    const use = pullWork(fx, res, 'c1');
    assert.equal(use.signals.questions, 4);
    assert.deepEqual(use.flags, []);
  } finally {
    fx.cleanup();
  }
});

test('[R62-06] tool-error flags are cut to the first five', () => {
  const fx = makeFixture(rec({}));
  try {
    fx.copilotLog('c1', [skill, fail, fail, fail, fail, fail, fail, fail]); // fail on 3-9
    const res = fx.run();
    assert.equal(res.status, 0, res.stdout);
    const use = pullWork(fx, res, 'c1');
    assert.equal(use.signals.toolErrors, 7);
    assert.deepEqual(use.flags, [3, 4, 5, 6, 7].map((line) => ({ kind: 'tool-error', line })));
  } finally {
    fx.cleanup();
  }
});

test('[R62-07] signals and flags cover only the records after the last reviewed Position', () => {
  const fx = makeFixture(rec({ 'Copilot CLI:c1': { 'pull-work': 5 } }));
  try {
    const events = r6201Events();
    events[5] = asst(LONG); // line 7 becomes a second long assistant.message
    fx.copilotLog('c1', events);
    const res = fx.run();
    assert.equal(res.status, 0, res.stdout);
    const use = pullWork(fx, res, 'c1');
    assert.equal(use.from, 6);
    assert.equal(use.signals.records, 3);
    assert.deepEqual(use.flags, [{ kind: 'long-message', line: 7 }]);
  } finally {
    fx.cleanup();
  }
});
