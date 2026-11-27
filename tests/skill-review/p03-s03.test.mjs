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

const emptyRecord = () => ({
  format: 1,
  conversations: {},
  handoffs: [],
  observations: [],
  installs: [],
  nextObservation: 1,
});

function obs(overrides) {
  return {
    id: 'O01',
    part: 'pull-work',
    state: 'watching',
    kind: 'rule adherence',
    label: null,
    side: null,
    area: null,
    outcome: 'part change',
    cause: null,
    model: null,
    fixType: 'clarified rule',
    fixReason: 'A check cannot find this.',
    description: 'The skill asked the same question twice.',
    cases: 1,
    chances: 0,
    changeCommit: null,
    follows: null,
    ...overrides,
  };
}

// Case K from the phase file
const K = {
  ref: 'a',
  match: null,
  conversation: 'Copilot CLI:c1',
  line: 5,
  part: 'pull-work',
  kind: 'rule adherence',
  label: null,
  side: null,
  area: null,
  outcome: 'part change',
  cause: null,
  model: null,
  fixType: 'clarified rule',
  fixReason: 'A check cannot find this.',
  description: 'The skill asked the same question twice.',
};

// Case R from the phase file
const R = {
  match: null,
  ref: 'r',
  conversation: 'Copilot CLI:c1',
  line: 5,
  part: 'behavior-spec',
  label: 'requirements miss',
  area: 'auth',
  asker: 'brain-storm',
  outcome: 'no action',
  cause: 'area open',
  description: 'The Session left login open.',
};

const FIX = { fixType: 'clarified rule', fixReason: 'Asking is cheaper.' };

function makeFixture(record) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p03s03-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  const copilot = join(root, 'copilot');
  const claude = join(root, 'claude');
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
  const recordFile = join(home, 'skill-review', 'review-record.json');
  if (record !== undefined) {
    put(recordFile, `${JSON.stringify(record, null, 2)}\n`);
  }
  git(home, 'add', '-A');
  git(home, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');

  const logFile = join(copilot, 'session-state', 'c1', 'events.jsonl');
  const rows = [
    ['session.start', { sessionId: 'c1', context: { cwd: proj } }],
    ['skill.invoked', { name: 'pull-work' }],
    ...Array.from({ length: 18 }, (_, i) => ['user.message', { content: `m${i}` }]),
  ];
  put(
    logFile,
    `${rows
      .map(([type, data], i) => JSON.stringify({ type, data, id: `e${i + 1}`, timestamp: '2026-11-01T00:00:00Z', parentId: null }))
      .join('\n')}\n`,
  );

  const compact = join(root, 'compact.json');
  put(
    compact,
    JSON.stringify({
      project: proj,
      conversations: [
        {
          harness: 'Copilot CLI',
          id: 'c1',
          file: logFile,
          uses: [{ skill: 'pull-work', start: 2, end: 20, from: 2 }],
        },
      ],
    }),
  );

  const env = {
    ...process.env,
    WORKFLOW_HOME: home,
    SKILL_REVIEW_COPILOT_HOME: copilot,
    SKILL_REVIEW_CLAUDE_HOME: claude,
    SKILL_REVIEW_NOW: '2026-11-26T12:00:00Z',
  };
  return {
    root, home, proj, recordFile,
    finish(cases) {
      const judgement = join(root, 'judgement.json');
      put(judgement, JSON.stringify({ cases }));
      const res = spawnSync(process.execPath, [CLI, 'finish', compact, judgement], { cwd: proj, encoding: 'utf8', env });
      const stdoutLines = (res.stdout ?? '').split(/\r?\n/).filter((l) => l !== '');
      return { status: res.status, stdoutLines, stdout: res.stdout ?? '' };
    },
    record() {
      assert.ok(existsSync(recordFile), 'review-record.json exists');
      return JSON.parse(readFileSync(recordFile, 'utf8'));
    },
    raw() {
      return existsSync(recordFile) ? readFileSync(recordFile, 'utf8') : null;
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function ok(res) {
  assert.equal(res.status, 0, res.stdout);
}

function failed(res, detail) {
  assert.equal(res.status, 1, res.stdout);
  assert.equal(res.stdout.trim(), `skill-review failed: judgement-invalid: ${detail}`);
}

function before(lines, a, b) {
  const i = lines.indexOf(a);
  const j = lines.indexOf(b);
  assert.ok(i >= 0, `missing line "${a}" in ${lines.join(' | ')}`);
  assert.ok(j >= 0, `missing line "${b}" in ${lines.join(' | ')}`);
  assert.ok(i < j, `"${a}" must come before "${b}"`);
}

test('[R58-06] a model habit case is dismissed with its cause and model', () => {
  const fx = makeFixture(emptyRecord());
  try {
    const res = fx.finish([{ ...K, outcome: 'no action', cause: 'model habit', model: 'gpt-5.5' }]);
    ok(res);
    const rec = fx.record();
    assert.equal(rec.observations.length, 1);
    const o = rec.observations[0];
    assert.equal(o.id, 'O01');
    assert.equal(o.state, 'dismissed');
    assert.equal(o.cause, 'model habit');
    assert.equal(o.model, 'gpt-5.5');
    before(res.stdoutLines, 'observation: O01 new', 'observation: O01 dismissed');
  } finally {
    fx.cleanup();
  }
});

test('[R58-07] a case on a dismissed Observation adds a case and stays dismissed', () => {
  const fx = makeFixture({
    ...emptyRecord(),
    observations: [obs({ state: 'dismissed', outcome: 'no action', cause: 'model habit', model: 'gpt-5.5', cases: 1 })],
    nextObservation: 2,
  });
  try {
    const res = fx.finish([{ match: 'O01', conversation: 'Copilot CLI:c1', line: 6 }]);
    ok(res);
    const rec = fx.record();
    assert.equal(rec.observations.length, 1);
    assert.equal(rec.observations[0].cases, 2);
    assert.equal(rec.observations[0].state, 'dismissed');
    assert.ok(res.stdoutLines.includes('observation: O01 case'), res.stdout);
    assert.ok(!res.stdoutLines.some((l) => l.includes('confirmed')), res.stdout);
  } finally {
    fx.cleanup();
  }
});

test('[R58-08] a no action case with another cause stays watching', () => {
  const fx = makeFixture(emptyRecord());
  try {
    const res = fx.finish([{ ...K, outcome: 'no action', cause: 'Developer was in a hurry' }]);
    ok(res);
    const rec = fx.record();
    assert.equal(rec.observations.length, 1);
    assert.equal(rec.observations[0].state, 'watching');
    assert.equal(rec.observations[0].cause, 'Developer was in a hurry');
    assert.ok(!res.stdoutLines.includes('observation: O01 dismissed'), res.stdout);
  } finally {
    fx.cleanup();
  }
});

test('[R58-09] a harness limit dismissal without a model fails', () => {
  const fx = makeFixture(emptyRecord());
  try {
    const original = fx.raw();
    const res = fx.finish([{ ...K, outcome: 'no action', cause: 'harness limit', model: '' }]);
    failed(res, 'case 1: model missing');
    assert.equal(fx.raw(), original);
  } finally {
    fx.cleanup();
  }
});

test('[R58-10] a requirements miss stays watching under its area', () => {
  const fx = makeFixture(emptyRecord());
  try {
    const res = fx.finish([R]);
    ok(res);
    const rec = fx.record();
    assert.equal(rec.observations.length, 1);
    const o = rec.observations[0];
    assert.equal(o.state, 'watching');
    assert.equal(o.cases, 1);
    assert.equal(o.label, 'requirements miss');
    assert.equal(o.area, 'auth');
  } finally {
    fx.cleanup();
  }
});

test('[R58-11] two requirements-miss cases in one area make a confirmed question gap', () => {
  const fx = makeFixture(emptyRecord());
  try {
    const res = fx.finish([R, { ...R, line: 9, ...FIX }]);
    ok(res);
    const rec = fx.record();
    assert.equal(rec.observations.length, 2);
    const [o1, o2] = rec.observations;
    assert.equal(o1.id, 'O01');
    assert.equal(o1.state, 'watching');
    assert.equal(o1.cases, 2);
    assert.equal(o2.id, 'O02');
    assert.equal(o2.part, 'brain-storm');
    assert.equal(o2.kind, 'question gap');
    assert.equal(o2.state, 'confirmed');
    assert.equal(o2.cases, 2);
    assert.equal(o2.outcome, 'part change');
    assert.equal(o2.fixType, 'clarified rule');
    assert.equal(rec.nextObservation, 3);
    before(res.stdoutLines, 'observation: O02 new', 'observation: O02 confirmed');
  } finally {
    fx.cleanup();
  }
});

test('[R58-12] a third requirements-miss case only grows the requirements miss', () => {
  const rm = obs({
    part: 'behavior-spec',
    kind: null,
    label: 'requirements miss',
    area: 'auth',
    outcome: 'no action',
    cause: 'area open',
    fixType: null,
    fixReason: null,
    description: 'The Session left login open.',
    cases: 2,
  });
  const qg = obs({
    id: 'O02',
    part: 'brain-storm',
    state: 'confirmed',
    kind: 'question gap',
    area: 'auth',
    fixReason: 'Asking is cheaper.',
    cases: 2,
  });
  const fx = makeFixture({ ...emptyRecord(), observations: [rm, qg], nextObservation: 3 });
  try {
    const res = fx.finish([{ ...R, line: 11 }]);
    ok(res);
    const rec = fx.record();
    assert.equal(rec.observations.length, 2);
    assert.equal(rec.observations[0].id, 'O01');
    assert.equal(rec.observations[0].cases, 3);
    assert.equal(rec.observations[0].state, 'watching');
    assert.deepEqual(rec.observations[1], qg);
    assert.ok(!rec.observations.some((o) => o.id === 'O03'));
    assert.equal(rec.nextObservation, 3);
  } finally {
    fx.cleanup();
  }
});

test('[R58-13] a requirements miss cannot be dismissed', () => {
  const fx = makeFixture(emptyRecord());
  try {
    const original = fx.raw();
    const res = fx.finish([{ ...R, cause: 'model habit', model: 'gpt-5.5' }]);
    failed(res, 'case 1: requirements miss cannot be dismissed');
    assert.equal(fx.raw(), original);
  } finally {
    fx.cleanup();
  }
});

test('[R58-14] the case reaching two needs a fix filter and nothing is written', () => {
  const fx = makeFixture(emptyRecord());
  try {
    const original = fx.raw();
    const res = fx.finish([R, { ...R, line: 9 }]);
    failed(res, 'case 2: fix filter missing');
    assert.equal(fx.raw(), original);
    assert.ok(!existsSync(join(fx.home, 'skill-review', 'review-record.json.tmp')));
  } finally {
    fx.cleanup();
  }
});

test('[R58-15] requirements misses in different areas make no question gap', () => {
  const fx = makeFixture(emptyRecord());
  try {
    const res = fx.finish([R, { ...R, line: 9, area: 'billing' }]);
    ok(res);
    const rec = fx.record();
    assert.equal(rec.observations.length, 2);
    for (const o of rec.observations) {
      assert.equal(o.label, 'requirements miss');
      assert.equal(o.state, 'watching');
      assert.equal(o.cases, 1);
    }
    assert.deepEqual(rec.observations.map((o) => o.area).sort(), ['auth', 'billing']);
    assert.ok(!rec.observations.some((o) => o.kind === 'question gap'));
  } finally {
    fx.cleanup();
  }
});
