import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');
const NOW = '2026-11-26T14:05:00';
const HID = 'behavior-spec:.workflow/specs/x-spec.md';

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

const H = {
  id: HID,
  writingSkill: 'behavior-spec',
  usingSkill: 'work-planner',
  artifact: '.workflow/specs/x-spec.md',
  state: 'pending',
  writtenAt: '2026-11-20T10:00:00.000Z',
  writing: { harness: 'Copilot CLI', conversation: 'w1', file: '/logs/w1.jsonl', line: 40 },
  using: { harness: 'Copilot CLI', conversation: 'u1', file: '/logs/u1.jsonl', line: 3 },
};

// The Handoff case from the card
const HC = {
  handoff: HID,
  ref: 'A',
  label: 'translation miss',
  outcome: 'part change',
  fixType: 'clarified rule',
  fixReason: 'A check cannot find a dropped rule.',
  description: 'The spec dropped rule R7 of the Session.',
};

// A Conversation case, for the Conversation-versus-Handoff rules
const CC = {
  ref: 'a',
  conversation: 'Copilot CLI:c1',
  line: 5,
  part: 'pull-work',
  outcome: 'part change',
  fixType: 'clarified rule',
  fixReason: 'A check cannot find this.',
  description: 'The skill asked the same question twice.',
};

function makeFixture(opts = {}) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p05s06-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  const copilot = join(root, 'copilot');
  const claude = join(root, 'claude');
  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
  }
  for (const skill of ['pull-work', 'brain-storm', 'behavior-spec', 'work-planner', 'skill-review']) {
    put(join(home, '.claude', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  mkdirSync(copilot, { recursive: true });
  mkdirSync(claude, { recursive: true });
  const recordFile = join(home, 'skill-review', 'review-record.json');
  put(recordFile, JSON.stringify(opts.record ?? baseRecord(), null, 2) + '\n');
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
  const conversations = [
    {
      harness: 'Copilot CLI',
      id: 'c1',
      file: '/logs/c1.jsonl',
      uses: [{ skill: 'pull-work', start: 2, end: 20, from: 2 }],
    },
  ];
  return {
    root, home, proj, recordFile,
    summariesDir: join(home, 'skill-review', 'summaries'),
    recordText: () => readFileSync(recordFile, 'utf8'),
    readRecord: () => JSON.parse(readFileSync(recordFile, 'utf8')),
    // cases: judgement cases; handoffs: judgement handoffs (default: judge H)
    finish(cases, handoffs = [{ id: HID }]) {
      put(
        compactFile,
        JSON.stringify({
          project: 'Scheduler',
          conversations,
          handoffs: [H],
          tokens: { depth1: 120, depth2: 30 },
          notices: [],
        }, null, 2),
      );
      put(judgementFile, JSON.stringify({ cases, handoffs }));
      const res = spawnSync(process.execPath, [CLI, 'finish', compactFile, judgementFile], { cwd: proj, encoding: 'utf8', env });
      return { status: res.status, lines: res.stdout.split(/\r?\n/).filter((l) => l !== ''), stdout: res.stdout };
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function assertObservation(fx, res, expected) {
  assert.equal(res.status, 0, res.stdout);
  assert.ok(res.lines.includes('observation: O01 new'), res.stdout);
  const rec = fx.readRecord();
  assert.equal(rec.observations.length, 1);
  const o = rec.observations[0];
  for (const [k, v] of Object.entries(expected)) assert.equal(o[k], v, `field ${k}`);
}

function assertFailedUnchanged(fx, res, before, detail) {
  assert.equal(res.status, 1, res.stdout);
  assert.equal(res.lines.length, 1, res.stdout);
  if (typeof detail === 'string') {
    assert.equal(res.lines[0], `skill-review failed: judgement-invalid: ${detail}`);
  } else {
    assert.match(res.lines[0], detail);
  }
  assert.equal(fx.recordText(), before, 'Review Record is unchanged');
  assert.ok(!existsSync(fx.summariesDir), 'no summaries folder');
  assert.ok(!existsSync(join(fx.home, 'skill-review', 'ledger.md')), 'no ledger.md');
}

test('[R55-31] a Handoff case with a translation miss is against the using skill', () => {
  const fx = makeFixture();
  try {
    const res = fx.finish([HC]);
    assertObservation(fx, res, {
      part: 'work-planner', side: 'using', label: 'translation miss', cases: 1, state: 'watching',
    });
  } finally {
    fx.cleanup();
  }
});

test('[R55-32] capture miss and decomposition miss are against the writing skill', () => {
  for (const label of ['capture miss', 'decomposition miss']) {
    const fx = makeFixture();
    try {
      const res = fx.finish([{ ...HC, label }]);
      assertObservation(fx, res, { part: 'behavior-spec', side: 'writing', label, cases: 1 });
    } finally {
      fx.cleanup();
    }
  }
});

test('[R55-33] a kind without a label sets the side', () => {
  const { label, ...noLabel } = HC;
  assert.equal(label, 'translation miss');
  const expectations = [
    { kind: 'restated or re-verified', part: 'work-planner', side: 'using' },
    { kind: 'section never used', part: 'behavior-spec', side: 'writing' },
  ];
  for (const e of expectations) {
    const fx = makeFixture();
    try {
      const res = fx.finish([{ ...noLabel, kind: e.kind }]);
      assertObservation(fx, res, { part: e.part, side: e.side, kind: e.kind, cases: 1 });
    } finally {
      fx.cleanup();
    }
  }
});

test('[R55-34] side both names both skills and the Observation stays watching', () => {
  const fx = makeFixture();
  try {
    const res = fx.finish([{ ...HC, side: 'both' }, { ...HC, side: 'both', description: 'The spec dropped rule R8.' }]);
    assert.equal(res.status, 0, res.stdout);
    assert.ok(res.lines.includes('observation: O01 new'), res.stdout);
    const rec = fx.readRecord();
    assert.equal(rec.observations.length, 1);
    const o = rec.observations[0];
    assert.equal(o.part, 'behavior-spec + work-planner');
    assert.equal(o.side, 'both');
    assert.equal(o.cases, 2);
    assert.equal(o.state, 'watching');
    assert.ok(!res.lines.includes('observation: O01 confirmed'), res.stdout);
  } finally {
    fx.cleanup();
  }
});

test('[R55-35] an unlisted Handoff, a case with both handoff and conversation, or a requirements miss fails', () => {
  const variants = [
    { name: 'handoff not judged', cases: [HC], handoffs: [] },
    { name: 'handoff and conversation', cases: [{ ...HC, conversation: 'Copilot CLI:c1', line: 5 }], handoffs: [{ id: HID }] },
    { name: 'requirements miss', cases: [{ ...HC, label: 'requirements miss' }], handoffs: [{ id: HID }] },
  ];
  const control = makeFixture();
  try {
    assertObservation(control, control.finish([HC]), { part: 'work-planner', side: 'using' });
  } finally {
    control.cleanup();
  }
  for (const v of variants) {
    const fx = makeFixture();
    try {
      const before = fx.recordText();
      const res = fx.finish(v.cases, v.handoffs);
      assertFailedUnchanged(fx, res, before, /^skill-review failed: judgement-invalid: case 1: \S.*$/);
    } finally {
      fx.cleanup();
    }
  }
});

test('[R55-36] a matching Handoff case confirms an existing Observation', () => {
  const existing = {
    id: 'O01',
    part: 'work-planner',
    state: 'watching',
    kind: null,
    label: 'translation miss',
    side: 'using',
    area: null,
    outcome: 'part change',
    cause: null,
    model: null,
    fixType: 'clarified rule',
    fixReason: 'A check cannot find a dropped rule.',
    description: 'The spec dropped rule R6 of the Session.',
    cases: 1,
    chances: 0,
    changeCommit: null,
    follows: null,
  };
  const fx = makeFixture({ record: baseRecord({ observations: [existing], nextObservation: 2 }) });
  try {
    const res = fx.finish([{ handoff: HID, match: 'O01', description: 'The spec dropped rule R7.' }]);
    assert.equal(res.status, 0, res.stdout);
    assert.ok(res.lines.includes('observation: O01 confirmed'), res.stdout);
    const rec = fx.readRecord();
    assert.equal(rec.observations.length, 1);
    assert.equal(rec.observations[0].cases, 2);
    assert.equal(rec.observations[0].state, 'confirmed');
  } finally {
    fx.cleanup();
  }
});

test('[R55-37] a Conversation case cannot use restated or re-verified', () => {
  const { label, ...noLabel } = HC;
  assert.ok(label);
  const control = makeFixture();
  try {
    assertObservation(control, control.finish([{ ...noLabel, kind: 'restated or re-verified' }]), {
      part: 'work-planner', side: 'using',
    });
  } finally {
    control.cleanup();
  }
  const fx = makeFixture();
  try {
    const before = fx.recordText();
    const res = fx.finish([{ ...CC, kind: 'restated or re-verified' }]);
    assertFailedUnchanged(fx, res, before, /^skill-review failed: judgement-invalid: case 1: \S.*$/);
  } finally {
    fx.cleanup();
  }
});

test('[R55-38] a Handoff case with a part change and no fix type fails', () => {
  const fx = makeFixture();
  try {
    const before = fx.recordText();
    const res = fx.finish([{ ...HC, fixType: null }]);
    assertFailedUnchanged(fx, res, before, 'case 1: fix filter missing');
  } finally {
    fx.cleanup();
  }
});
