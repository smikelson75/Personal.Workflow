import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');
const NOW = '2026-11-26T14:05:00';
const WRITTEN_AT = '2026-11-20T10:00:00.000Z';
const PLAN_ID = 'work-planner:.workflow/plans/x/';

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, `git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout;
}

function put(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function baseRecord(over = {}) {
  return {
    format: 1,
    conversations: {},
    handoffs: [],
    observations: [],
    installs: [],
    nextObservation: 1,
    ...over,
  };
}

function makeFixture(opts = {}) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p05s02-')));
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
  if (opts.record) put(join(home, 'skill-review', 'review-record.json'), JSON.stringify(opts.record, null, 2) + '\n');
  git(home, 'add', '-A');
  git(home, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');
  const env = {
    ...process.env,
    WORKFLOW_HOME: home,
    SKILL_REVIEW_NOW: NOW,
    SKILL_REVIEW_COPILOT_HOME: copilot,
    SKILL_REVIEW_CLAUDE_HOME: claude,
  };
  const out = join(root, 'out', 'compact.json');
  return {
    root, home, proj, out,
    path: (...parts) => join(proj, ...parts),
    put: (rel, text) => put(join(proj, rel), text),
    exec(args) {
      const res = spawnSync(process.execPath, [CLI, ...args], { cwd: proj, encoding: 'utf8', env });
      return { status: res.status, lines: res.stdout.split(/\r?\n/).filter((l) => l !== ''), stdout: res.stdout };
    },
    prepare(...extra) {
      return this.exec(['prepare', ...extra, '--out', out]);
    },
    compact: () => JSON.parse(readFileSync(out, 'utf8')),
    // rows: [type, data, timestamp]; session.start is line 1
    copilotLog(id, rows) {
      const all = [['session.start', { sessionId: id, context: { cwd: proj } }, '2026-11-01T00:00:00Z'], ...rows];
      const text = all
        .map(([type, data, timestamp], i) => JSON.stringify({ type, data, id: `e${i + 1}`, timestamp, parentId: null }))
        .join('\n');
      const file = join(copilot, 'session-state', id, 'events.jsonl');
      put(file, `${text}\n`);
      return file;
    },
    // rows: full record objects; cwd and sessionId are added
    claudeLog(id, rows) {
      const file = join(claude, 'projects', 'p', `${id}.jsonl`);
      put(file, `${rows.map((r) => JSON.stringify({ cwd: proj, sessionId: id, ...r })).join('\n')}\n`);
      return file;
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

const startCopilot = (skill, ts) => ['skill.invoked', { name: skill }, ts];
const copilotTouch = (toolName, path, ts) => ['tool.execution_start', { toolName, arguments: { path } }, ts];

const claudeSkill = (skill, ts) => ({
  type: 'assistant',
  timestamp: ts,
  message: { content: [{ type: 'tool_use', id: `t-${skill}`, name: 'Skill', input: { skill } }] },
});
const claudeRead = (path, ts) => ({
  type: 'assistant',
  timestamp: ts,
  message: { content: [{ type: 'tool_use', id: 'r1', name: 'Read', input: { file_path: path } }] },
});
const claudeFiller = (ts) => ({ type: 'user', timestamp: ts, message: { content: 'go' } });

// The plan folder artifact, written by work-planner in Copilot c1 at line 3.
function planFolder(fx) {
  fx.put('.workflow/plans/x/plan.md', '## Plan\n');
  fx.put('.workflow/plans/x/phase-01.md', '## Phase\n');
}
function writerLog(fx) {
  return fx.copilotLog('c1', [
    startCopilot('work-planner', '2026-11-20T09:59:00.000Z'),
    copilotTouch('create', fx.path('.workflow', 'plans', 'x', 'phase-01.md'), WRITTEN_AT),
  ]);
}
// A Claude Conversation k1: pull-work starts at line 2, the Read is line 7.
function readerLog(fx, { skill = 'pull-work', at = '2026-11-21T09:00:00.000Z' } = {}) {
  return fx.claudeLog('k1', [
    claudeFiller('2026-11-21T08:00:00.000Z'),
    claudeSkill(skill, '2026-11-21T08:01:00.000Z'),
    claudeFiller('2026-11-21T08:02:00.000Z'),
    claudeFiller('2026-11-21T08:03:00.000Z'),
    claudeFiller('2026-11-21T08:04:00.000Z'),
    claudeFiller('2026-11-21T08:05:00.000Z'),
    claudeRead(fx.path('.workflow', 'plans', 'x', 'plan.md'), at),
  ]);
}

const entryOf = (compact, id = PLAN_ID) => (compact.handoffs ?? []).find((h) => h.id === id);

test('[R55-19] the using end is the first read of the artifact inside a use of the using skill', () => {
  const fx = makeFixture();
  try {
    planFolder(fx);
    writerLog(fx);
    const kFile = readerLog(fx);
    const res = fx.prepare();
    assert.equal(res.status, 0, res.stdout);
    const entry = entryOf(fx.compact());
    assert.ok(entry, 'entry work-planner:.workflow/plans/x/ exists');
    assert.deepEqual(entry.using, { harness: 'Claude Code', conversation: 'k1', file: kFile, line: 7 });
    assert.equal(entry.state, 'pending');
  } finally {
    fx.cleanup();
  }
});

test('[R55-20] a read by another skill, or before the write, gives no using end', () => {
  const cases = [
    { name: 'read by behavior-spec', opts: { skill: 'behavior-spec' } },
    { name: 'read before the write', opts: { at: '2026-11-19T09:00:00.000Z' } },
  ];
  for (const c of cases) {
    const fx = makeFixture();
    try {
      planFolder(fx);
      writerLog(fx);
      readerLog(fx, c.opts);
      const res = fx.prepare();
      assert.equal(res.status, 0, `${c.name}: ${res.stdout}`);
      const entry = entryOf(fx.compact());
      assert.ok(entry, `${c.name}: entry exists`);
      assert.equal(entry.using, null, c.name);
    } finally {
      fx.cleanup();
    }
  }
});

test('[R55-21] the earliest read by timestamp wins across Conversations', () => {
  const fx = makeFixture();
  try {
    planFolder(fx);
    writerLog(fx);
    readerLog(fx, { at: '2026-11-23T09:00:00.000Z' });
    const c2File = fx.copilotLog('c2', [
      startCopilot('pull-work', '2026-11-21T08:59:00.000Z'),
      copilotTouch('view', fx.path('.workflow', 'plans', 'x', 'plan.md'), '2026-11-21T09:00:00.000Z'),
    ]);
    const res = fx.prepare();
    assert.equal(res.status, 0, res.stdout);
    const entry = entryOf(fx.compact());
    assert.ok(entry, 'entry exists');
    assert.deepEqual(entry.using, { harness: 'Copilot CLI', conversation: 'c2', file: c2File, line: 3 });
  } finally {
    fx.cleanup();
  }
});

test('[R55-22] a Handoff with both ends is prepared even when no use is unreviewed', () => {
  const fx = makeFixture({
    record: baseRecord({ conversations: { 'Copilot CLI:c1': { 'work-planner': 3 }, 'Claude Code:k1': { 'pull-work': 7 } } }),
  });
  try {
    planFolder(fx);
    writerLog(fx);
    readerLog(fx);
    const res = fx.prepare();
    assert.equal(res.status, 0, res.stdout);
    assert.ok(res.lines.includes('skill-review: prepared 0 skill uses in 0 Conversations'), res.stdout);
    assert.ok(existsSync(fx.out), 'compact record is written');
    const compact = fx.compact();
    assert.deepEqual(compact.conversations, []);
    const entry = entryOf(compact);
    assert.ok(entry, 'entry exists');
    assert.equal(entry.using?.conversation, 'k1');
  } finally {
    fx.cleanup();
  }
});

test('[R55-23] a pending Handoff and no unreviewed use means nothing to review', () => {
  const fx = makeFixture({ record: baseRecord({ conversations: { 'Copilot CLI:c1': { 'work-planner': 3 } } }) });
  try {
    planFolder(fx);
    writerLog(fx);
    const res = fx.prepare();
    assert.equal(res.status, 0, res.stdout);
    assert.ok(res.lines.includes('skill-review: nothing to review'), res.stdout);
    assert.ok(!existsSync(fx.out), 'no compact record is written');
  } finally {
    fx.cleanup();
  }
});

test('[R55-24] a Handoff reviewed in the Review Record is omitted', () => {
  const reviewed = {
    id: PLAN_ID,
    writingSkill: 'work-planner',
    usingSkill: 'pull-work',
    artifact: '.workflow/plans/x/',
    state: 'reviewed',
    writtenAt: WRITTEN_AT,
  };
  const fx = makeFixture({ record: baseRecord({ handoffs: [reviewed] }) });
  try {
    planFolder(fx);
    writerLog(fx);
    const res = fx.prepare();
    assert.equal(res.status, 0, res.stdout);
    assert.ok(existsSync(fx.out), 'compact record is written (c1 has an unreviewed use)');
    const compact = fx.compact();
    assert.ok(Array.isArray(compact.handoffs), 'handoffs is an array');
    assert.equal(entryOf(compact), undefined);
    assert.deepEqual(compact.handoffs, []);
  } finally {
    fx.cleanup();
  }
});

test('[R53-03] a named skill keeps the Handoffs it writes or uses', () => {
  const fx = makeFixture();
  try {
    fx.put('.workflow/incubations/idea.md', 'Status: graduated\n');
    fx.put('.workflow/sessions/context-a.md', '- Status: final\n');
    fx.put('.workflow/specs/x-spec.md', '# Spec\n');
    fx.copilotLog('c1', [
      startCopilot('incubate', '2026-11-20T09:00:00.000Z'),
      copilotTouch('create', fx.path('.workflow', 'incubations', 'idea.md'), '2026-11-20T09:01:00.000Z'),
      startCopilot('brain-storm', '2026-11-20T10:00:00.000Z'),
      copilotTouch('edit', fx.path('.workflow', 'sessions', 'context-a.md'), '2026-11-20T10:01:00.000Z'),
      startCopilot('behavior-spec', '2026-11-20T11:00:00.000Z'),
      copilotTouch('create', fx.path('.workflow', 'specs', 'x-spec.md'), '2026-11-20T11:01:00.000Z'),
            startCopilot('work-planner', '2026-11-20T12:00:00.000Z'),
            copilotTouch('view', fx.path('.workflow', 'specs', 'x-spec.md'), '2026-11-20T12:01:00.000Z'),
    ]);
    const first = 'incubate:.workflow/incubations/idea.md';
    const second = 'brain-storm:.workflow/sessions/context-a.md';
    const third = 'behavior-spec:.workflow/specs/x-spec.md';

    let res = fx.prepare('brain-storm');
    assert.equal(res.status, 0, res.stdout);
    let ids = (fx.compact().handoffs ?? []).map((h) => h.id);
    assert.deepEqual(ids, [second, first].sort(), 'brain-storm holds the first two');
    assert.ok(!ids.includes(third), 'no third Handoff for brain-storm');

    res = fx.prepare('work-planner');
    assert.equal(res.status, 0, res.stdout);
    ids = (fx.compact().handoffs ?? []).map((h) => h.id);
    assert.deepEqual(ids, [third], 'work-planner holds only the behavior-spec Handoff');
  } finally {
    fx.cleanup();
  }
});
