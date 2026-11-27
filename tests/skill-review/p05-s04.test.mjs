import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');

function put(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function makeFixture() {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p05s04-')));
  const proj = join(root, 'proj');
  const copilot = join(root, 'copilot');
  const claude = join(root, 'claude');
  const out = join(root, 'out', 'compact.json');
  mkdirSync(proj, { recursive: true });
  mkdirSync(copilot, { recursive: true });
  mkdirSync(claude, { recursive: true });
  const env = {
    ...process.env,
    SKILL_REVIEW_COPILOT_HOME: copilot,
    SKILL_REVIEW_CLAUDE_HOME: claude,
  };
  return {
    root, proj, out,
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
    // hand-written compact record: no unreviewed use, one Handoff with both ends
    writeRecord(cFile, writingLine, kFile, usingLine) {
      const json = {
        project: 'proj',
        conversations: [],
        handoffs: [{
          id: 'work-planner:.workflow/plans/x/',
          writingSkill: 'work-planner',
          usingSkill: 'pull-work',
          artifact: '.workflow/plans/x/',
          state: 'pending',
          writtenAt: '2026-11-20T10:00:00.000Z',
          writing: { harness: 'Copilot CLI', conversation: 'c1', file: cFile, line: writingLine },
          using: { harness: 'Claude Code', conversation: 'k1', file: kFile, line: usingLine },
        }],
        tokens: { depth1: 100 },
        notices: [],
      };
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

const cop = (n, type, data) => ({ type, data, id: `e${n}`, timestamp: '2026-11-20T10:00:00.000Z', parentId: null });

function copilotRows() {
  return [
    cop(1, 'session.start', { sessionId: 'c1', context: { cwd: 'x' } }),
    cop(2, 'skill.invoked', { name: 'work-planner' }),
    cop(3, 'user.message', { content: 'plan it' }),
    cop(4, 'assistant.message', { content: 'a'.repeat(9000) }),
    cop(5, 'tool.execution_start', { toolName: 'create' }),
    cop(6, 'assistant.message', { content: 'written' }),
  ];
}

function claudeRows() {
  return [
    { type: 'user', cwd: 'x', sessionId: 'k1', message: { content: 'hi' } },
    { type: 'user', cwd: 'x', sessionId: 'k1', message: { content: '<command-name>/pull-work</command-name>' } },
    { type: 'assistant', cwd: 'x', sessionId: 'k1', message: { content: [{ type: 'text', text: 'reading' }] } },
    { type: 'assistant', cwd: 'x', sessionId: 'k1', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'x' } }] } },
    { type: 'assistant', cwd: 'x', sessionId: 'k1', message: { content: [{ type: 'text', text: 'done' }] } },
  ];
}

const TOKENS = /^skill-review: model tokens: depth 2: (\d+)$/;

test('[R62-23] slice serves the writing end of a Handoff in a Conversation with no unreviewed use', () => {
  const fx = makeFixture();
  try {
    const cFile = fx.copilotLog('c1', copilotRows());
    const kFile = fx.claudeLog('k1', claudeRows());
    const record = fx.writeRecord(cFile, 4, kFile, 4);
    const res = fx.slice([record, 'c1', '4']);
    assert.equal(res.lines[0], 'slice: c1 line 4');
    const mark = '...[truncated]';
    const flagged = `[4] assistant: ${'a'.repeat(5800 - mark.length)}${mark}`;
    assert.deepEqual(res.lines.slice(1, -1), ['[3] user: plan it', flagged, '[5] tool: create']);
    const m = TOKENS.exec(res.lines.at(-1));
    assert.ok(m, `last line: ${res.lines.at(-1)}`);
    assert.equal(res.lines.length, 5);
    assert.equal(res.status, 0);
    const after = JSON.parse(readFileSync(record, 'utf8'));
    assert.equal(after.slices.length, 1);
    assert.equal(after.slices[0].id, 'c1');
    assert.equal(after.slices[0].line, 4);
    assert.equal(after.slices[0].chars, res.lines.slice(1, -1).join('\n').length);
    assert.equal(after.tokens.depth2, Number(m[1]));
    assert.equal(after.tokens.depth1, 100);
  } finally {
    fx.cleanup();
  }
});

test('[R62-24] slice serves the using end of a Handoff from a Claude Conversation', () => {
  const fx = makeFixture();
  try {
    const cFile = fx.copilotLog('c1', copilotRows());
    const kFile = fx.claudeLog('k1', claudeRows());
    const record = fx.writeRecord(cFile, 4, kFile, 4);
    const res = fx.slice([record, 'k1', '4']);
    assert.equal(res.lines[0], 'slice: k1 line 4');
    assert.deepEqual(res.lines.slice(1, -1), ['[3] assistant: reading', '[4] tool: Read', '[5] assistant: done']);
    const m = TOKENS.exec(res.lines.at(-1));
    assert.ok(m, `last line: ${res.lines.at(-1)}`);
    assert.equal(res.status, 0);
    const after = JSON.parse(readFileSync(record, 'utf8'));
    assert.equal(after.slices.length, 1);
    assert.equal(after.slices[0].id, 'k1');
    assert.equal(after.slices[0].line, 4);
    assert.equal(after.tokens.depth2, Number(m[1]));
  } finally {
    fx.cleanup();
  }
});

test('[R62-25] slice refuses a line that is neither a use flag nor a Handoff end, leaving the record unchanged', () => {
  const fx = makeFixture();
  try {
    const cFile = fx.copilotLog('c1', copilotRows());
    const kFile = fx.claudeLog('k1', claudeRows());
    const record = fx.writeRecord(cFile, 4, kFile, 4);
    const before = readFileSync(record, 'utf8');
    const res = fx.slice([record, 'c1', '3']);
    assert.deepEqual(res.lines, ['skill-review failed: not-flagged: c1 line 3']);
    assert.equal(res.status, 1);
    assert.equal(readFileSync(record, 'utf8'), before);
  } finally {
    fx.cleanup();
  }
});
