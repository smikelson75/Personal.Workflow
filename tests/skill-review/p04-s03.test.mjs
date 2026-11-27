import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');
const INSTALL_AT = '2026-11-26T14:00:00.000Z';
const SUMMARY_NAME = '2026-11-26-1405-Scheduler.md';
const DESC = 'The skill asked the same question twice.';

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, `git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout.trim();
}

function put(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

// Case K from P03 S02
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
  description: DESC,
};

function observation(over = {}) {
  return {
    id: 'O03',
    part: 'pull-work',
    state: 'changed',
    kind: 'rule adherence',
    label: null,
    side: null,
    area: null,
    outcome: 'part change',
    cause: null,
    model: null,
    fixType: 'clarified rule',
    fixReason: 'A check cannot find this.',
    description: DESC,
    cases: 1,
    chances: 0,
    changeCommit: null,
    follows: null,
    ...over,
  };
}

const baseRecord = (extra = {}) => ({
  format: 1,
  conversations: {},
  handoffs: [],
  observations: [],
  installs: [],
  nextObservation: 1,
  ...extra,
});

// opts.record: object, or function ({C1, C2}) returning the Review Record (creates a source repo with two commits)
// opts.started: timestamp of the first Log line; opts.notices: compact notices
function makeFixture(opts = {}) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p04s03-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  const src = join(root, 'src');
  const copilot = join(root, 'copilot');
  for (const dir of [home, proj, src]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
  }
  for (const skill of ['pull-work', 'brain-storm', 'skill-review']) {
    put(join(home, '.claude', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  const commit = (msg) => {
    git(src, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-m', msg);
    return git(src, 'rev-parse', '--short=7', 'HEAD');
  };
  const C1 = commit('c1');
  const C2 = commit('c2');
  const record = typeof opts.record === 'function' ? opts.record({ C1, C2 }) : opts.record;
  if (record !== undefined) put(join(home, 'skill-review', 'review-record.json'), JSON.stringify(record, null, 2) + '\n');
  git(home, 'add', '-A');
  git(home, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');

  const logFile = join(copilot, 'session-state', 'c1', 'events.jsonl');
  const rows = [['session.start', { sessionId: 'c1', context: { cwd: proj } }]];
  for (let i = 2; i <= 20; i++) rows.push(['user.message', { content: `m${i}` }]);
  put(
    logFile,
    rows
      .map(([type, data], i) => JSON.stringify({ type, data, id: `e${i + 1}`, timestamp: i === 0 ? opts.started || '2026-11-01T00:00:00Z' : '2026-11-01T00:00:00Z', parentId: null }))
      .join('\n') + '\n',
  );
  const compactFile = join(root, 'compact.json');
  writeFileSync(
    compactFile,
    JSON.stringify({
      project: 'Scheduler',
      conversations: [
        { harness: 'Copilot CLI', id: 'c1', file: logFile, uses: [{ skill: 'pull-work', start: 2, end: 20, from: 2 }] },
      ],
      tokens: { depth1: 120, depth2: 30 },
      notices: opts.notices || [],
    }),
  );
  const env = {
    ...process.env,
    WORKFLOW_HOME: home,
    SKILL_REVIEW_COPILOT_HOME: copilot,
    SKILL_REVIEW_NOW: '2026-11-26T14:05:00',
  };
  return {
    root, home, proj, C1, C2,
    finish(cases) {
      const judgement = join(root, 'judgement.json');
      writeFileSync(judgement, JSON.stringify({ cases }));
      const res = spawnSync(process.execPath, [CLI, 'finish', compactFile, judgement], { cwd: proj, encoding: 'utf8', env });
      const lines = res.stdout.split(/\r?\n/).filter((l) => l !== '');
      assert.equal(res.status, 0, res.stdout);
      return { status: res.status, lines, stdout: res.stdout };
    },
    summary() {
      const dir = join(home, 'skill-review', 'summaries');
      assert.ok(existsSync(dir), 'finish writes the summaries folder');
      assert.deepEqual(readdirSync(dir), [SUMMARY_NAME]);
      return readFileSync(join(dir, SUMMARY_NAME), 'utf8');
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

// Non-blank lines of one `## <name>` section
function section(text, name) {
  const lines = text.split(/\r?\n/);
  const start = lines.indexOf(`## ${name}`);
  assert.ok(start >= 0, `section ${name} exists`);
  const body = [];
  for (let i = start + 1; i < lines.length && !/^## /.test(lines[i]); i += 1) {
    if (lines[i].trim() !== '') body.push(lines[i].trimEnd());
  }
  return body;
}

const NONE = ['None.'];

function assertSections(text, { changed = NONE, improved = NONE, same = NONE, next = NONE }) {
  assert.deepEqual(section(text, 'Changed'), changed, 'Changed');
  assert.deepEqual(section(text, 'Improved'), improved, 'Improved');
  assert.deepEqual(section(text, 'Same'), same, 'Same');
  assert.deepEqual(section(text, 'Next'), next, 'Next');
}

const O01 = `- O01 pull-work: ${DESC}`;

test('[R60-05] a new Observation lands in Changed only', () => {
  const fx = makeFixture();
  try {
    fx.finish([K]);
    assertSections(fx.summary(), { changed: [O01] });
  } finally {
    fx.cleanup();
  }
});

test('[R60-06] a confirmed Observation with a part change also lands in Next with its fix type', () => {
  const fx = makeFixture();
  try {
    fx.finish([K, { ...K, line: 9 }]);
    assertSections(fx.summary(), { changed: [O01], next: [`${O01} Fix type: clarified rule.`] });
  } finally {
    fx.cleanup();
  }
});

const installRecord =
  (over = {}) =>
  ({ C1, C2 }) =>
    baseRecord({
      observations: [observation({ changeCommit: C1, ...over })],
      installs: [{ version: '1a2b3c4', source: C2, at: INSTALL_AT, contains: [C1] }],
      nextObservation: 4,
    });

test('[R60-07] an improved Observation lands in Improved; a case in a chance lands in Same and Next', () => {
  const fx = makeFixture({ record: installRecord({ chances: 1 }), started: '2026-11-26T15:00:00.000Z' });
  const fx2 = makeFixture({ record: installRecord(), started: '2026-11-26T15:00:00.000Z' });
  try {
    const res = fx.finish([]);
    assert.ok(res.lines.includes('observation: O03 improved'), res.stdout);
    assertSections(fx.summary(), { improved: [`- O03 pull-work: ${DESC}`] });

    const res2 = fx2.finish([{ match: 'O03', conversation: 'Copilot CLI:c1', line: 5 }]);
    assert.ok(res2.lines.includes('observation: O03 unchanged'), res2.stdout);
    assertSections(fx2.summary(), {
      same: [`- O03 pull-work: ${DESC}`],
      next: [`- O03 pull-work: ${DESC} Fix type: clarified rule.`],
    });
  } finally {
    fx.cleanup();
    fx2.cleanup();
  }
});

test('[R60-08] a no action case lands in Changed and leaves Next empty', () => {
  const fx = makeFixture();
  try {
    fx.finish([{ ...K, outcome: 'no action', cause: 'model habit', model: 'gpt-5.5', fixType: null, fixReason: null }]);
    assertSections(fx.summary(), { changed: [O01] });
  } finally {
    fx.cleanup();
  }
});

test('[R60-09] Next lists a confirmed part change first, then the Developer note', () => {
  const fx = makeFixture();
  try {
    const dev = { ...K, ref: 'a', kind: 'Developer contribution', outcome: 'Developer note', fixType: null, fixReason: null };
    const second = { ...K, ref: 'b', description: 'The skill hid its last step.' };
    fx.finish([dev, second, { ...second, line: 9 }]);
    assertSections(fx.summary(), {
      changed: [O01, '- O02 pull-work: The skill hid its last step.'],
      next: [
        '- O02 pull-work: The skill hid its last step. Fix type: clarified rule.',
        `- O01 pull-work: Developer note. ${DESC}`,
      ],
    });
  } finally {
    fx.cleanup();
  }
});

test('[R60-10] a case that leaves an Observation watching is not a change', () => {
  const record = baseRecord({
    observations: [observation({ id: 'O04', state: 'watching', cases: 0 })],
    nextObservation: 5,
  });
  const fx = makeFixture({ record });
  try {
    const res = fx.finish([{ match: 'O04', conversation: 'Copilot CLI:c1', line: 5 }]);
    assert.ok(res.lines.includes('observation: O04 case'), res.stdout);
    assert.ok(!res.lines.includes('observation: O04 confirmed'), res.stdout);
    assertSections(fx.summary(), {});
  } finally {
    fx.cleanup();
  }
});

test('[R60-11] a confirmed part change from an earlier run lands in Next only', () => {
  const record = baseRecord({
    observations: [observation({ id: 'O05', state: 'confirmed', cases: 2 })],
    nextObservation: 6,
  });
  const fx = makeFixture({ record });
  try {
    fx.finish([]);
    assertSections(fx.summary(), { next: [`- O05 pull-work: ${DESC} Fix type: clarified rule.`] });
  } finally {
    fx.cleanup();
  }
});

test('[Q-readability] 12 new Observations and 40 notices keep the summary short', () => {
  const notices = Array.from({ length: 40 }, (_, i) => `notice: unknown-record: Claude Code k1 line ${i + 1}: type "thinking_v9"`);
  const fx = makeFixture({ notices });
  try {
    const cases = Array.from({ length: 12 }, (_, i) => ({ ...K, ref: `r${i + 1}`, description: `The skill asked question ${i + 1} twice.` }));
    fx.finish(cases);
    const text = fx.summary();
    const entries = section(text, 'Changed');
    assert.equal(entries.length, 12, 'Changed lists 12 entries');
    entries.forEach((l, i) => assert.ok(l.startsWith(`- O${String(i + 1).padStart(2, '0')} pull-work: `), l));
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith('- O')) {
        const sentences = line.match(/[.!?](\s|$)/g) || [];
        assert.ok(sentences.length <= 3, `at most 3 sentences: ${line}`);
      } else {
        const words = line.split(/\s+/).filter(Boolean).length;
        assert.ok(words <= 300, `at most 300 words: ${line}`);
      }
    }
  } finally {
    fx.cleanup();
  }
});
