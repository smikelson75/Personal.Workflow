import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
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
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p02s02-')));
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
  git(home, 'add', '-A');
  git(home, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');
  const env = {
    ...process.env,
    WORKFLOW_HOME: home,
    SKILL_REVIEW_COPILOT_HOME: copilot,
    SKILL_REVIEW_CLAUDE_HOME: claude,
  };
  return {
    root, home, proj, out,
    // rows: array of record objects, one per physical line
    copilotLog(id, rows) {
      const file = join(copilot, 'session-state', id, 'events.jsonl');
      put(file, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
      return file;
    },
    claudeLog(id, rows) {
      const file = join(claude, 'projects', 'p', `${id}.jsonl`);
      put(file, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
      return file;
    },
    // hand-written compact record; uses carry flags
    writeRecord(harness, id, file, uses) {
      const json = { project: 'proj', conversations: [{ harness, id, file, uses }] };
      put(out, JSON.stringify(json, null, 2));
      return out;
    },
    slice(args) {
      const res = spawnSync(process.execPath, [CLI, 'slice', ...args], { cwd: proj, encoding: 'utf8', env });
      const lines = res.stdout.split(/\r?\n/).filter((l) => l !== '');
      return { status: res.status, lines, stdout: res.stdout };
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

const cop = (n, type, data) => ({ type, data, id: `e${n}`, timestamp: '2026-11-01T00:00:00Z', parentId: null });

// R62-01's fixture: Copilot c1, 8 lines
function r6201Rows(longChars = 4001) {
  return [
    cop(1, 'session.start', { sessionId: 'c1', context: { cwd: 'x' } }),
    cop(2, 'skill.invoked', { name: 'pull-work' }),
    cop(3, 'user.message', { content: 'go' }),
    cop(4, 'assistant.message', { content: 'a'.repeat(longChars) }),
    cop(5, 'tool.execution_start', { toolName: 'ask_user' }),
    cop(6, 'tool.execution_complete', { success: false, result: { content: 'bad' } }),
    cop(7, 'user.message', { content: 'no, stop that' }),
    cop(8, 'assistant.message', { content: 'ok' }),
  ];
}

const r6201Uses = () => [{
  skill: 'pull-work', start: 2, end: 8, from: 2,
  signals: { records: 7, userMessages: 2, assistantMessages: 2, toolCalls: 1, questions: 1, toolErrors: 1, longestAssistantChars: 4001 },
  flags: [{ kind: 'long-message', line: 4 }, { kind: 'tool-error', line: 6 }, { kind: 'user-correction', line: 7 }],
}];

function body(res) {
  assert.ok(res.lines.length >= 2, `expected header and tokens line in: ${res.stdout}`);
  return res.lines.slice(1, -1);
}

const TOKENS = /^skill-review: model tokens: depth 2: \d+$/;

test('[R62-08] slice prints the flagged record with its neighbours and the model tokens line', () => {
  const fx = makeFixture();
  try {
    const file = fx.copilotLog('c1', r6201Rows());
    const record = fx.writeRecord('Copilot CLI', 'c1', file, r6201Uses());
    const res = fx.slice([record, 'c1', '4']);
    assert.equal(res.lines[0], 'slice: c1 line 4');
    assert.deepEqual(body(res), ['[3] user: go', `[4] assistant: ${'a'.repeat(4001)}`, '[5] tool: ask_user']);
    assert.match(res.lines.at(-1), TOKENS);
    assert.equal(res.lines.length, 5);
    assert.equal(res.status, 0);
  } finally {
    fx.cleanup();
  }
});

test('[R62-09] slice at the last line has no following record', () => {
  const fx = makeFixture();
  try {
    const file = fx.copilotLog('c1', [
      cop(1, 'session.start', { sessionId: 'c1', context: { cwd: 'x' } }),
      cop(2, 'skill.invoked', { name: 'pull-work' }),
      cop(3, 'tool.execution_complete', { success: false, result: { content: 'boom' } }),
    ]);
    const record = fx.writeRecord('Copilot CLI', 'c1', file, [{
      skill: 'pull-work', start: 2, end: 3, from: 2,
      signals: { records: 2, userMessages: 0, assistantMessages: 0, toolCalls: 0, questions: 0, toolErrors: 1, longestAssistantChars: 0 },
      flags: [{ kind: 'tool-error', line: 3 }],
    }]);
    const res = fx.slice([record, 'c1', '3']);
    assert.equal(res.lines[0], 'slice: c1 line 3');
    const b = body(res);
    assert.equal(b.length, 2);
    assert.ok(b[0].startsWith('[2] '), b[0]);
    assert.equal(b[1], '[3] tool-result: ERROR boom');
    assert.match(res.lines.at(-1), TOKENS);
    assert.equal(res.status, 0);
  } finally {
    fx.cleanup();
  }
});

test('[R62-10] slice refuses a line that is not flagged', () => {
  const fx = makeFixture();
  try {
    const file = fx.copilotLog('c1', r6201Rows());
    const record = fx.writeRecord('Copilot CLI', 'c1', file, r6201Uses());
    const res = fx.slice([record, 'c1', '3']);
    assert.deepEqual(res.lines, ['skill-review failed: not-flagged: c1 line 3']);
    assert.equal(res.status, 1);
  } finally {
    fx.cleanup();
  }
});

test('[R62-11] slice refuses an unknown Conversation', () => {
  const fx = makeFixture();
  try {
    const file = fx.copilotLog('c1', r6201Rows());
    const record = fx.writeRecord('Copilot CLI', 'c1', file, r6201Uses());
    const res = fx.slice([record, 'zz', '4']);
    assert.deepEqual(res.lines, ['skill-review failed: unknown-conversation: zz']);
    assert.equal(res.status, 1);
  } finally {
    fx.cleanup();
  }
});

test('[R62-12] slice renders a Claude tool error as tool-result: ERROR <text>', () => {
  const fx = makeFixture();
  try {
    const file = fx.claudeLog('k1', [
      { type: 'user', cwd: 'x', sessionId: 'k1', message: { content: 'hi' } },
      { type: 'user', cwd: 'x', sessionId: 'k1', message: { content: '<command-name>/pull-work</command-name>' } },
      { type: 'assistant', cwd: 'x', sessionId: 'k1', message: { content: [{ type: 'tool_use', name: 'AskUserQuestion', input: {} }] } },
      { type: 'user', cwd: 'x', sessionId: 'k1', message: { content: [{ type: 'tool_result', is_error: true, content: 'boom' }] } },
      { type: 'assistant', cwd: 'x', sessionId: 'k1', message: { content: [{ type: 'text', text: 'done' }] } },
    ]);
    const record = fx.writeRecord('Claude Code', 'k1', file, [{
      skill: 'pull-work', start: 2, end: 5, from: 2,
      signals: { records: 4, userMessages: 1, assistantMessages: 2, toolCalls: 1, questions: 1, toolErrors: 1, longestAssistantChars: 4 },
      flags: [{ kind: 'tool-error', line: 4 }],
    }]);
    const res = fx.slice([record, 'k1', '4']);
    assert.equal(res.lines[0], 'slice: k1 line 4');
    const b = body(res);
    assert.ok(b.includes('[4] tool-result: ERROR boom'), `body: ${JSON.stringify(b)}`);
    assert.equal(b[0], '[3] tool: AskUserQuestion');
    assert.equal(b[2], '[5] assistant: done');
    assert.equal(res.status, 0);
  } finally {
    fx.cleanup();
  }
});

test('[Q-model-reading] a slice stays within 8,000 characters and truncates long text', () => {
  const fx = makeFixture();
  try {
    const file = fx.copilotLog('c1', [
      cop(1, 'session.start', { sessionId: 'c1', context: { cwd: 'x' } }),
      cop(2, 'skill.invoked', { name: 'pull-work' }),
      cop(3, 'user.message', { content: 'u'.repeat(3000) }),
      cop(4, 'assistant.message', { content: 'y'.repeat(50000) }),
      cop(5, 'tool.execution_start', { toolName: 'view' }),
    ]);
    const record = fx.writeRecord('Copilot CLI', 'c1', file, [{
      skill: 'pull-work', start: 2, end: 5, from: 2,
      signals: { records: 4, userMessages: 1, assistantMessages: 1, toolCalls: 1, questions: 0, toolErrors: 0, longestAssistantChars: 50000 },
      flags: [{ kind: 'long-message', line: 4 }],
    }]);
    const res = fx.slice([record, 'c1', '4']);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.lines[0], 'slice: c1 line 4');
    const b = body(res);
    assert.equal(b.length, 3);
    assert.ok(b.join('\n').length <= 8000, `body is ${b.join('\n').length} characters`);
    assert.ok(b[0].startsWith('[3] user: '), b[0]);
    assert.ok(b[0].slice('[3] user: '.length).length <= 1000);
    assert.ok(b[1].startsWith('[4] assistant: '), b[1].slice(0, 40));
    assert.ok(b[1].endsWith('...[truncated]'));
    assert.equal(b[2], '[5] tool: view');
    assert.ok(!/(.)\1{99}/s.test(readFileSync(record, 'utf8')), 'compact record holds no run of 100 identical characters');
  } finally {
    fx.cleanup();
  }
});
