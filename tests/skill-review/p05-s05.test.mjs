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
const H_ID = 'behavior-spec:.workflow/specs/x-spec.md';
const SPEC = '.workflow/specs/x-spec.md';

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

const handoff = (over = {}) => ({
  id: H_ID,
  writingSkill: 'behavior-spec',
  usingSkill: 'work-planner',
  artifact: SPEC,
  state: 'pending',
  writtenAt: '2026-11-20T10:00:00.000Z',
  writing: { harness: 'Copilot CLI', conversation: 'c0', file: '/logs/c0.jsonl', line: 3 },
  using: { harness: 'Copilot CLI', conversation: 'c9', file: '/logs/c9.jsonl', line: 5 },
  ...over,
});

const stored = (over = {}) => ({
  id: H_ID,
  writingSkill: 'behavior-spec',
  usingSkill: 'work-planner',
  artifact: SPEC,
  state: 'reviewed',
  writtenAt: '2026-11-20T10:00:00.000Z',
  ...over,
});

function makeFixture(opts = {}) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p05s05-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  const copilot = join(root, 'copilot');
  const claude = join(root, 'claude');
  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
  }
  for (const skill of ['pull-work', 'brain-storm', 'behavior-spec', 'work-planner', 'incubate', 'skill-review']) {
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
  const compactFile = join(root, 'compact.json');
  const judgementFile = join(root, 'judgement.json');
  const exec = (args) => {
    const res = spawnSync(process.execPath, [CLI, ...args], { cwd: proj, encoding: 'utf8', env });
    return { status: res.status, lines: res.stdout.split(/\r?\n/).filter((l) => l !== ''), stdout: res.stdout };
  };
  const summariesDir = join(home, 'skill-review', 'summaries');
  return {
    root, home, proj, copilot, claude, compactFile, summariesDir,
    summaryFile: join(summariesDir, SUMMARY_NAME),
    recordFile: join(home, 'skill-review', 'review-record.json'),
    ledgerFile: join(home, 'skill-review', 'ledger.md'),
    exec,
    finish(conversations, handoffs, judgement, extra = {}) {
      const compact = {
        project: 'Scheduler',
        conversations,
        handoffs,
        tokens: { depth1: 120, depth2: 30 },
        notices: [],
        ...extra,
      };
      put(compactFile, JSON.stringify(compact, null, 2));
      put(judgementFile, JSON.stringify(judgement));
      return exec(['finish', compactFile, judgementFile]);
    },
    record() {
      return JSON.parse(readFileSync(join(home, 'skill-review', 'review-record.json'), 'utf8'));
    },
    summary() {
      return readFileSync(join(summariesDir, SUMMARY_NAME), 'utf8');
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

const conv = (harness, id, skills) => ({
  harness,
  id,
  file: `/logs/${id}.jsonl`,
  uses: skills.map((skill, i) => ({ skill, start: 2 + i * 10, end: 10 + i * 10, from: 2 + i * 10 })),
});

const PULL = [conv('Copilot CLI', 'c1', ['pull-work'])];

function ok(res) {
  assert.equal(res.status, 0, res.stdout);
}

function section(text, name) {
  const lines = text.split(/\r?\n/);
  const at = lines.indexOf(`## ${name}`);
  assert.ok(at >= 0, `has ## ${name}`);
  const out = [];
  for (let i = at + 1; i < lines.length && !lines[i].startsWith('## '); i++) {
    if (lines[i].trim() !== '') out.push(lines[i]);
  }
  return out;
}

test('[R55-25] a judged Handoff is stored reviewed and counted in the Reviewed line', () => {
  const fx = makeFixture();
  try {
    const res = fx.finish(PULL, [handoff()], { cases: [], handoffs: [{ id: H_ID }] });
    ok(res);
    assert.deepEqual(fx.record().handoffs, [stored()]);
    assert.ok(existsSync(fx.summaryFile), 'summary file exists');
    const line = fx.summary().split(/\r?\n/)[2];
    assert.ok(line.startsWith('Reviewed:'), line);
    assert.ok(line.endsWith('1 Handoffs; pending Handoffs: 0'), line);
  } finally {
    fx.cleanup();
  }
});

test('[R55-26] an unjudged Handoff is stored pending, counted, and listed in the Ledger with its age', () => {
  const fx = makeFixture();
  try {
    const res = fx.finish(PULL, [handoff({ using: null })], { cases: [] });
    ok(res);
    assert.deepEqual(fx.record().handoffs, [stored({ state: 'pending' })]);
    assert.ok(existsSync(fx.summaryFile), 'summary file exists');
    const line = fx.summary().split(/\r?\n/)[2];
    assert.ok(line.endsWith('0 Handoffs; pending Handoffs: 1'), line);
    assert.ok(existsSync(fx.ledgerFile), 'ledger.md exists');
    assert.deepEqual(section(readFileSync(fx.ledgerFile, 'utf8'), 'Pending Handoffs'), [
      `- ${SPEC} (behavior-spec -> work-planner), 6 days`,
    ]);
  } finally {
    fx.cleanup();
  }
});

test('[R55-27] after finish judged a Handoff, prepare with no new uses finds nothing to review', () => {
  const fx = makeFixture();
  try {
    const stamp = (n) => `2026-11-${n}T10:00:00.000Z`;
    const logRows = (id, rows) => {
      const all = [{ type: 'session.start', data: { sessionId: id, context: { cwd: fx.proj } }, timestamp: stamp(19) }, ...rows];
      const text = all.map((r, i) => JSON.stringify({ id: `e${i + 1}`, parentId: null, ...r })).join('\n');
      put(join(fx.copilot, 'session-state', id, 'events.jsonl'), `${text}\n`);
    };
    const tool = (toolName, ts) => ({
      type: 'tool.execution_start',
      data: { toolName, arguments: { path: join(fx.proj, '.workflow', 'specs', 'x-spec.md') } },
      timestamp: ts,
    });
    const tail = (ts) => [
      { type: 'user.message', data: { content: 'go' }, timestamp: ts },
      { type: 'assistant.message', data: { content: 'ok' }, timestamp: ts },
    ];
    put(join(fx.proj, '.workflow', 'specs', 'x-spec.md'), '# Spec\n');
    logRows('c0', [
      { type: 'skill.invoked', data: { name: 'behavior-spec' }, timestamp: stamp(20) },
      tool('create', stamp(20)),
      ...tail(stamp(20)),
    ]);
    logRows('c9', [
      { type: 'skill.invoked', data: { name: 'work-planner' }, timestamp: stamp(21) },
      tool('view', stamp(21)),
      ...tail(stamp(21)),
    ]);

    const out = join(fx.root, 'out', 'compact.json');
    ok(fx.exec(['prepare', '--out', out]));
    const prepared = JSON.parse(readFileSync(out, 'utf8'));
    assert.ok(prepared.conversations.length >= 2, 'prepare found the uses');

    const res = fx.finish(
      prepared.conversations,
      [handoff()],
      { cases: [], handoffs: [{ id: H_ID }] },
      { tokens: prepared.tokens, notices: prepared.notices },
    );
    ok(res);
    assert.deepEqual(fx.record().handoffs, [stored()]);

    const again = fx.exec(['prepare', '--out', join(fx.root, 'out', 'again.json')]);
    ok(again);
    assert.equal(again.lines.at(-1), 'skill-review: nothing to review');
    assert.ok(!existsSync(join(fx.root, 'out', 'again.json')), 'no compact record written');
  } finally {
    fx.cleanup();
  }
});

test('[R55-28] a judged Handoff id that is unknown or has no using end fails and changes no file', () => {
  const cases = [
    { name: 'unknown id', handoffs: [handoff()], id: 'behavior-spec:.workflow/specs/other-spec.md' },
    { name: 'using null', handoffs: [handoff({ using: null })], id: H_ID },
  ];
  for (const c of cases) {
    const record = baseRecord();
    const fx = makeFixture({ record });
    try {
      const before = readFileSync(fx.recordFile, 'utf8');
      const res = fx.finish(PULL, c.handoffs, { cases: [], handoffs: [{ id: c.id }] });
      assert.equal(res.status, 1, `${c.name}: ${res.stdout}`);
      assert.deepEqual(res.lines, [`skill-review failed: judgement-invalid: handoff ${c.id}`], c.name);
      assert.equal(readFileSync(fx.recordFile, 'utf8'), before, `${c.name}: record unchanged`);
      assert.ok(!existsSync(fx.summariesDir), `${c.name}: no summaries folder`);
      assert.ok(!existsSync(fx.ledgerFile), `${c.name}: no ledger`);
      assert.equal(git(fx.home, 'status', '--porcelain').trim(), '', `${c.name}: Home Repo clean`);
    } finally {
      fx.cleanup();
    }
  }
});

test('[R55-29] a stored pending Handoff keeps its earlier writtenAt', () => {
  const fx = makeFixture({
    record: baseRecord({ handoffs: [stored({ state: 'pending', writtenAt: '2026-11-19T00:00:00.000Z' })] }),
  });
  try {
    const other = {
      id: 'behavior-spec:.workflow/specs/y-spec.md',
      artifact: '.workflow/specs/y-spec.md',
      using: null,
    };
    const res = fx.finish(
      PULL,
      [handoff({ using: null, writtenAt: '2026-11-20T10:00:00.000Z' }), handoff(other)],
      { cases: [] },
    );
    ok(res);
    const byId = (id) => fx.record().handoffs.filter((h) => h.id === id);
    assert.deepEqual(byId(H_ID), [stored({ state: 'pending', writtenAt: '2026-11-19T00:00:00.000Z' })]);
    assert.deepEqual(byId(other.id), [
      stored({ id: other.id, artifact: other.artifact, state: 'pending', writtenAt: '2026-11-20T10:00:00.000Z' }),
    ]);
    assert.equal(fx.record().handoffs.length, 2);
  } finally {
    fx.cleanup();
  }
});

test('[R55-30] a judged Handoff with no unreviewed use still writes a summary and Ledger', () => {
  const fx = makeFixture();
  try {
    const res = fx.finish([], [handoff()], { cases: [], handoffs: [{ id: H_ID }] });
    ok(res);
    assert.ok(existsSync(fx.summaryFile), 'summary file exists');
    assert.ok(existsSync(fx.ledgerFile), 'ledger.md exists');
    assert.equal(
      fx.summary().split(/\r?\n/)[2],
      'Reviewed: 0 Conversations, 0 skill uses (none), 1 Handoffs; pending Handoffs: 0',
    );
    assert.equal(res.lines.at(-2), `skill-review: summary: ${fx.summaryFile}`);
    assert.equal(res.lines.at(-1), 'skill-review: reviewed 0 skill uses in 0 Conversations');
    assert.deepEqual(fx.record().handoffs, [stored()]);
  } finally {
    fx.cleanup();
  }
});
