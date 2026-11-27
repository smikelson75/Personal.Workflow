import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');
const NOW = '2026-11-26T14:05:00';
const WRITTEN = '2026-11-20T10:00:00.000Z';

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
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p05s01-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  const copilot = join(root, 'copilot');
  const claude = join(root, 'claude');
  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
  }
  for (const skill of ['incubate', 'brain-storm', 'behavior-spec', 'work-planner', 'pull-work', 'skill-review']) {
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
  const outFile = join(root, 'out', 'compact.json');
  const exec = (args) => {
    const res = spawnSync(process.execPath, [CLI, ...args], { cwd: proj, encoding: 'utf8', env });
    return { status: res.status, lines: res.stdout.split(/\r?\n/).filter((l) => l !== ''), stdout: res.stdout };
  };
  return {
    root, home, proj, outFile,
    // rows: [type, data, timestamp?]; session.start is line 1, rows start at line 2
    copilotLog(id, rows) {
      const all = [['session.start', { sessionId: id, context: { cwd: proj } }], ...rows];
      const text = all
        .map(([type, data, ts], i) => JSON.stringify({ type, data, id: `e${i + 1}`, timestamp: ts ?? '2026-11-01T00:00:00Z', parentId: null }))
        .join('\n');
      const file = join(copilot, 'session-state', id, 'events.jsonl');
      put(file, `${text}\n`);
      return file;
    },
    // rows: raw record objects; cwd and sessionId are added
    claudeLog(id, rows) {
      const file = join(claude, 'projects', 'p', `${id}.jsonl`);
      put(file, `${rows.map((r) => JSON.stringify({ cwd: proj, sessionId: id, ...r })).join('\n')}\n`);
      return file;
    },
    prepare() {
      const res = exec(['prepare', '--out', outFile]);
      assert.equal(res.status, 0, res.stdout);
      assert.ok(existsSync(outFile), `compact record written: ${res.stdout}`);
      return JSON.parse(readFileSync(outFile, 'utf8'));
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

const skillRow = (name) => ['skill.invoked', { name }];
const touchRow = (toolName, path) => ['tool.execution_start', { toolName, arguments: { path } }, WRITTEN];

test('[R55-10] a graduated incubation written by incubate is a pending Handoff to brain-storm', () => {
  const fx = makeFixture();
  try {
    put(join(fx.proj, '.workflow', 'incubations', 'idea.md'), '# Idea\n\nStatus: graduated\n');
    const file = fx.copilotLog('c1', [skillRow('incubate'), touchRow('create', join(fx.proj, '.workflow', 'incubations', 'idea.md'))]);
    const compact = fx.prepare();
    assert.deepEqual(compact.handoffs, [
      {
        id: 'incubate:.workflow/incubations/idea.md',
        writingSkill: 'incubate',
        usingSkill: 'brain-storm',
        artifact: '.workflow/incubations/idea.md',
        state: 'pending',
        writtenAt: WRITTEN,
        writing: { harness: 'Copilot CLI', conversation: 'c1', file, line: 3 },
        using: null,
      },
    ]);
  } finally {
    fx.cleanup();
  }
});

test('[R55-11] a final session edited by brain-storm is a Handoff to behavior-spec', () => {
  const fx = makeFixture();
  try {
    put(join(fx.proj, '.workflow', 'sessions', 'context-a.md'), '# Session\n\n- Status: final\n');
    fx.copilotLog('c1', [skillRow('brain-storm'), touchRow('edit', join(fx.proj, '.workflow', 'sessions', 'context-a.md'))]);
    const compact = fx.prepare();
    assert.equal(compact.handoffs.length, 1);
    const entry = compact.handoffs.find((h) => h.id === 'brain-storm:.workflow/sessions/context-a.md');
    assert.ok(entry, JSON.stringify(compact.handoffs));
    assert.equal(entry.usingSkill, 'behavior-spec');
    assert.equal(entry.writingSkill, 'brain-storm');
    assert.equal(entry.state, 'pending');
    assert.equal(entry.using, null);
  } finally {
    fx.cleanup();
  }
});

test('[R55-12] a spec created by behavior-spec is a Handoff to work-planner', () => {
  const fx = makeFixture();
  try {
    put(join(fx.proj, '.workflow', 'specs', 'x-spec.md'), '# X spec\n');
    fx.copilotLog('c1', [skillRow('behavior-spec'), touchRow('create', join(fx.proj, '.workflow', 'specs', 'x-spec.md'))]);
    const compact = fx.prepare();
    assert.equal(compact.handoffs.length, 1);
    const entry = compact.handoffs.find((h) => h.id === 'behavior-spec:.workflow/specs/x-spec.md');
    assert.ok(entry, JSON.stringify(compact.handoffs));
    assert.equal(entry.usingSkill, 'work-planner');
    assert.equal(entry.artifact, '.workflow/specs/x-spec.md');
  } finally {
    fx.cleanup();
  }
});

test('[R55-13] a file written inside a plan folder makes the folder a Handoff to pull-work', () => {
  const fx = makeFixture();
  try {
    put(join(fx.proj, '.workflow', 'plans', 'x', 'phase-01.md'), '# Phase 1\n');
    fx.copilotLog('c1', [skillRow('work-planner'), touchRow('create', join(fx.proj, '.workflow', 'plans', 'x', 'phase-01.md'))]);
    const compact = fx.prepare();
    assert.equal(compact.handoffs.length, 1);
    const entry = compact.handoffs.find((h) => h.id === 'work-planner:.workflow/plans/x/');
    assert.ok(entry, JSON.stringify(compact.handoffs));
    assert.equal(entry.artifact, '.workflow/plans/x/');
    assert.equal(entry.usingSkill, 'pull-work');
  } finally {
    fx.cleanup();
  }
});

test('[R55-14] a Claude Code Write by brain-storm of a final session is a Handoff', () => {
  const fx = makeFixture();
  try {
    const session = join(fx.proj, '.workflow', 'sessions', 'context-k.md');
    put(session, '# Session\n\n- Status: final\n');
    fx.claudeLog('k1', [
      { type: 'user', timestamp: '2026-11-20T09:59:00.000Z', message: { content: '<command-name>/brain-storm</command-name>' } },
      {
        type: 'assistant',
        timestamp: WRITTEN,
        message: { content: [{ type: 'tool_use', id: 't1', name: 'Write', input: { file_path: session, content: 'x' } }] },
      },
    ]);
    const compact = fx.prepare();
    assert.equal(compact.handoffs.length, 1);
    const entry = compact.handoffs.find((h) => h.id === 'brain-storm:.workflow/sessions/context-k.md');
    assert.ok(entry, JSON.stringify(compact.handoffs));
    assert.equal(entry.writing.harness, 'Claude Code');
    assert.equal(entry.writing.conversation, 'k1');
    assert.equal(entry.writing.line, 2);
    assert.equal(entry.writtenAt, WRITTEN);
  } finally {
    fx.cleanup();
  }
});

test('[R55-15] a draft session or an open incubation is not a Handoff', () => {
  let fx = makeFixture();
  try {
    put(join(fx.proj, '.workflow', 'sessions', 'context-a.md'), '# Session\n\n- Status: draft\n');
    fx.copilotLog('c1', [skillRow('brain-storm'), touchRow('edit', join(fx.proj, '.workflow', 'sessions', 'context-a.md'))]);
    assert.deepEqual(fx.prepare().handoffs, []);
  } finally {
    fx.cleanup();
  }
  fx = makeFixture();
  try {
    put(join(fx.proj, '.workflow', 'incubations', 'idea.md'), '# Idea\n\nStatus: open\n');
    fx.copilotLog('c1', [skillRow('incubate'), touchRow('create', join(fx.proj, '.workflow', 'incubations', 'idea.md'))]);
    assert.deepEqual(fx.prepare().handoffs, []);
  } finally {
    fx.cleanup();
  }
});

test('[R55-16] a write before any skill start is not a Handoff', () => {
  const fx = makeFixture();
  try {
    put(join(fx.proj, '.workflow', 'sessions', 'context-a.md'), '# Session\n\n- Status: final\n');
    fx.copilotLog('c1', [touchRow('edit', join(fx.proj, '.workflow', 'sessions', 'context-a.md')), skillRow('brain-storm')]);
    assert.deepEqual(fx.prepare().handoffs, []);
  } finally {
    fx.cleanup();
  }
});

test('[R55-17] a write by the wrong skill for the artifact kind is not a Handoff', () => {
  let fx = makeFixture();
  try {
    put(join(fx.proj, '.workflow', 'sessions', 'context-a.md'), '# Session\n\n- Status: final\n');
    fx.copilotLog('c1', [skillRow('incubate'), touchRow('create', join(fx.proj, '.workflow', 'sessions', 'context-a.md'))]);
    assert.deepEqual(fx.prepare().handoffs, []);
  } finally {
    fx.cleanup();
  }
  fx = makeFixture();
  try {
    put(join(fx.proj, '.workflow', 'incubations', 'idea.md'), '# Idea\n\nStatus: graduated\n');
    fx.copilotLog('c1', [skillRow('brain-storm'), touchRow('edit', join(fx.proj, '.workflow', 'incubations', 'idea.md'))]);
    assert.deepEqual(fx.prepare().handoffs, []);
  } finally {
    fx.cleanup();
  }
});

test('[R55-18] a use with no artifact written gives empty handoffs and notices stays last', () => {
  const fx = makeFixture();
  try {
    fx.copilotLog('c1', [skillRow('pull-work'), ['user.message', { content: 'go' }], ['assistant.message', { content: 'ok' }]]);
    const compact = fx.prepare();
    assert.deepEqual(compact.handoffs, []);
    assert.deepEqual(Object.keys(compact), ['project', 'conversations', 'handoffs', 'tokens', 'notices']);
  } finally {
    fx.cleanup();
  }
});
