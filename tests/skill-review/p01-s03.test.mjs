import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cli = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
}

function put(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function makeFixture() {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p01s03-')));
  const f = {
    root,
    home: join(root, 'home'),
    proj: join(root, 'proj'),
    other: join(root, 'other'),
    copilot: join(root, 'copilot'),
    claude: join(root, 'claude'),
    out: join(root, 'out', 'compact.json'),
  };
  for (const d of [f.home, f.proj, f.other, f.copilot, f.claude]) {
    mkdirSync(d, { recursive: true });
    git(d, 'init', '-b', 'main');
  }
  for (const s of ['pull-work', 'brain-storm', 'skill-review']) {
    put(join(f.home, '.claude', 'skills', s, 'SKILL.md'), `# ${s}\n`);
  }
  // the log folders must not be git repos' business; recreate them plain
  rmSync(join(f.copilot, '.git'), { recursive: true, force: true });
  rmSync(join(f.claude, '.git'), { recursive: true, force: true });
  f.cleanup = () => rmSync(root, { recursive: true, force: true });
  return f;
}

// ---- Copilot log builder ----
function cop(type, data = {}, n = 0) {
  return JSON.stringify({ type, data, id: `e${n}`, timestamp: '2026-11-20T10:00:00.000Z', parentId: null });
}

function writeCopilot(f, id, cwd, skillAt, total, extra = {}) {
  const out = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1) out.push(cop('session.start', { sessionId: id, context: { cwd } }, i));
    else if (skillAt[i]) out.push(cop('skill.invoked', { name: skillAt[i] }, i));
    else if (extra[i]) out.push(cop(extra[i], {}, i));
    else out.push(cop(i % 2 ? 'user.message' : 'assistant.message', { content: 'x' }, i));
  }
  put(join(f.copilot, 'session-state', id, 'events.jsonl'), out.join('\n') + '\n');
}

// ---- Claude log builder ----
function cl(type, cwd, id, message, n = 0) {
  const rec = { type, cwd, sessionId: id };
  if (message) rec.message = message;
  return JSON.stringify(rec);
}

// starts: {line: {command:'pull-work'} | {tool:'brain-storm'}}
function writeClaude(f, folder, id, cwd, starts, total, extra = {}) {
  const out = [];
  for (let i = 1; i <= total; i++) {
    const s = starts[i];
    if (s && s.command) {
      out.push(cl('user', cwd, id, { role: 'user', content: `<command-name>/${s.command}</command-name>` }));
    } else if (s && s.tool) {
      out.push(
        cl('assistant', cwd, id, {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'Skill', input: { skill: s.tool } }],
        }),
      );
    } else if (extra[i]) {
      out.push(cl(extra[i], cwd, id));
    } else if (i === 1) {
      out.push(cl('system', cwd, id));
    } else if (i % 2) {
      out.push(cl('user', cwd, id, { role: 'user', content: 'ok' }));
    } else {
      out.push(cl('assistant', cwd, id, { role: 'assistant', content: [{ type: 'text', text: 'done' }] }));
    }
  }
  put(join(f.claude, 'projects', folder, `${id}.jsonl`), out.join('\n') + '\n');
}

function run(f, args = []) {
  const env = { ...process.env };
  env.WORKFLOW_HOME = f.home;
  env.SKILL_REVIEW_COPILOT_HOME = f.copilot;
  env.SKILL_REVIEW_CLAUDE_HOME = f.claude;
  const res = spawnSync(process.execPath, [cli, 'prepare', ...args, '--out', f.out], {
    cwd: f.proj,
    env,
    encoding: 'utf8',
  });
  const stdout = res.stdout ?? '';
  const lines = stdout.split(/\r?\n/).filter((l) => l !== '');
  return { status: res.status, stdout, lines, stderr: res.stderr };
}

function record(f, r) {
  const line = r.lines.find((l) => l.startsWith('compact-record: '));
  assert.ok(line, `compact-record line missing in:\n${r.stdout}\n${r.stderr}`);
  const path = line.slice('compact-record: '.length);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function summary(rec) {
  return rec.conversations.map((c) => ({
    harness: c.harness,
    id: c.id,
    uses: c.uses.map((u) => ({ skill: u.skill, start: u.start, end: u.end, from: u.from })),
  }));
}

function withFixture(fn) {
  return () => {
    const f = makeFixture();
    try {
      fn(f);
    } finally {
      f.cleanup();
    }
  };
}

test(
  '[R52-09] Claude Code slash command starts a pull-work use',
  withFixture((f) => {
    writeClaude(f, 'p1', 'k1', f.proj, { 2: { command: 'pull-work' } }, 6);
    const r = run(f);
    assert.equal(r.status, 0);
    assert.ok(r.lines.includes('skill-review: prepared 1 skill uses in 1 Conversations'), r.stdout);
    assert.deepEqual(summary(record(f, r)), [
      { harness: 'Claude Code', id: 'k1', uses: [{ skill: 'pull-work', start: 2, end: 6, from: 2 }] },
    ]);
  }),
);

test(
  '[R52-10] Claude Code Skill tool_use starts a brain-storm use',
  withFixture((f) => {
    writeClaude(f, 'p1', 'k2', f.proj, { 3: { tool: 'brain-storm' } }, 5);
    const r = run(f);
    assert.equal(r.status, 0);
    assert.ok(r.lines.includes('skill-review: prepared 1 skill uses in 1 Conversations'), r.stdout);
    assert.deepEqual(summary(record(f, r)), [
      { harness: 'Claude Code', id: 'k2', uses: [{ skill: 'brain-storm', start: 3, end: 5, from: 3 }] },
    ]);
  }),
);

test(
  '[R52-11] Claude Code Conversation outside the Project Repo is absent',
  withFixture((f) => {
    writeClaude(f, 'p1', 'k1', f.proj, { 2: { command: 'pull-work' } }, 6);
    writeClaude(f, 'other', 'k3', f.other, { 2: { command: 'pull-work' } }, 6);
    const r = run(f);
    assert.equal(r.status, 0);
    assert.deepEqual(
      summary(record(f, r)).map((c) => c.id),
      ['k1'],
    );
    assert.ok(!r.lines.some((l) => l.includes('k3')), r.stdout);
  }),
);

test(
  '[R65-03] unknown Claude Code record type is noticed with its line',
  withFixture((f) => {
    writeClaude(f, 'p1', 'k1', f.proj, { 2: { command: 'pull-work' } }, 12, { 12: 'thinking_v9' });
    const r = run(f);
    assert.equal(r.status, 0);
    const notices = r.lines.filter((l) => l.startsWith('notice: unknown-record:'));
    assert.deepEqual(notices, ['notice: unknown-record: Claude Code k1 line 12: type "thinking_v9"']);
    assert.ok(r.lines.indexOf(notices[0]) < r.lines.findIndex((l) => l.startsWith('skill-review: prepared')));
  }),
);

test(
  '[R65-04] unknown Copilot CLI record type is noticed with its line',
  withFixture((f) => {
    writeCopilot(f, 'c1', f.proj, { 2: 'brain-storm', 5: 'pull-work' }, 8, { 4: 'weird.type' });
    const r = run(f);
    assert.equal(r.status, 0);
    const notices = r.lines.filter((l) => l.startsWith('notice: unknown-record:'));
    assert.deepEqual(notices, ['notice: unknown-record: Copilot CLI c1 line 4: type "weird.type"']);
  }),
);

test(
  '[R65-05] no Claude Code Conversation in scope still lists the Copilot CLI Conversation',
  withFixture((f) => {
    writeCopilot(f, 'c1', f.proj, { 2: 'pull-work' }, 5);
    writeClaude(f, 'other', 'k3', f.other, { 2: { command: 'pull-work' } }, 6);
    const r = run(f);
    assert.equal(r.status, 0);
    assert.ok(r.lines.includes('notice: no-conversation-log: Claude Code'), r.stdout);
    assert.ok(!r.lines.includes('notice: no-conversation-log: Copilot CLI'), r.stdout);
    assert.deepEqual(summary(record(f, r)), [
      { harness: 'Copilot CLI', id: 'c1', uses: [{ skill: 'pull-work', start: 2, end: 5, from: 2 }] },
    ]);
  }),
);

test(
  '[R65-06] unknown record in a Conversation with no skill use prints no notice',
  withFixture((f) => {
    writeCopilot(f, 'c1', f.proj, {}, 5, { 3: 'weird.type' });
    writeClaude(f, 'p1', 'k0', f.proj, {}, 5, { 3: 'thinking_v9' });
    writeCopilot(f, 'c2', f.proj, { 2: 'pull-work' }, 4);
    const r = run(f);
    assert.equal(r.status, 0);
    assert.deepEqual(
      r.lines.filter((l) => l.startsWith('notice: unknown-record:')),
      [],
      r.stdout,
    );
    assert.deepEqual(
      summary(record(f, r)).map((c) => c.id),
      ['c2'],
    );
  }),
);
