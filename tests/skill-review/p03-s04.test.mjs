import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');
const NOW = '2026-11-26T14:00:00.000Z';
const LATER = '2026-11-27T09:30:00.000Z';

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, `git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout.trim();
}

function put(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function observation(id, fields) {
  return {
    id,
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
    ...fields,
  };
}

// build: record(c1, c2) returns the Review Record object
function makeFixture(build = () => ({})) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p03s04-')));
  const home = join(root, 'home');
  const src = join(root, 'src');
  for (const dir of [home, src]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
  }
  for (const skill of ['pull-work', 'brain-storm', 'skill-review']) {
    put(join(home, '.claude', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  const commit = (file, text) => {
    put(join(src, file), text);
    git(src, 'add', '-A');
    git(src, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', file);
    return git(src, 'rev-parse', '--short=7', 'HEAD');
  };
  const c1 = commit('one.txt', 'one\n');
  const c2 = commit('two.txt', 'two\n');
  assert.notEqual(c1, c2);

  const recordFile = join(home, 'skill-review', 'review-record.json');
  const record = {
    format: 1,
    conversations: {},
    handoffs: [],
    observations: [],
    installs: [],
    nextObservation: 5,
    ...build(c1, c2),
  };
  put(recordFile, JSON.stringify(record, null, 2) + '\n');
  git(home, 'add', '-A');
  git(home, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');

  const exec = (args, now = NOW) => {
    const env = { ...process.env, WORKFLOW_HOME: home, SKILL_REVIEW_NOW: now };
    const res = spawnSync(process.execPath, [CLI, ...args], { cwd: src, encoding: 'utf8', env });
    return { status: res.status, stdout: res.stdout, lines: res.stdout.split(/\r?\n/).filter((l) => l !== '') };
  };
  return {
    root, home, src, c1, c2, recordFile,
    rawRecord: () => readFileSync(recordFile, 'utf8'),
    record: () => JSON.parse(readFileSync(recordFile, 'utf8')),
    exec,
    finish(now = NOW) {
      const compact = join(root, 'compact.json');
      const judgement = join(root, 'judgement.json');
      put(compact, JSON.stringify({ project: 'p', conversations: [] }));
      put(judgement, JSON.stringify({ cases: [] }));
      return exec(['finish', compact, judgement], now);
    },
    manifest(obj) {
      put(join(home, '.git', 'personal-workflow', 'manifest.json'), JSON.stringify(obj));
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

const twoObservations = (c1, c2) => ({
  observations: [
    observation('O03', { state: 'confirmed', cases: 2 }),
    observation('O04', { state: 'watching', cases: 1 }),
  ],
});

test('[R59-01] mark-changed sets state changed and the change commit', () => {
  const fx = makeFixture(twoObservations);
  try {
    const res = fx.exec(['mark-changed', 'O03', fx.c1]);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.stdout.trimEnd(), `skill-review: O03 changed (${fx.c1})`);
    const rec = fx.record();
    const o3 = rec.observations.find((o) => o.id === 'O03');
    assert.equal(o3.state, 'changed');
    assert.equal(o3.changeCommit, fx.c1);
    const o4 = rec.observations.find((o) => o.id === 'O04');
    assert.deepEqual(o4, observation('O04', { state: 'watching', cases: 1 }));
  } finally {
    fx.cleanup();
  }
});

test('[R59-02] mark-changed rejects unknown, unconfirmed, and bad-commit input and changes nothing', () => {
  const fx = makeFixture(twoObservations);
  try {
    const before = fx.rawRecord();
    const cases = [
      [['mark-changed', 'O99', fx.c1], 'skill-review failed: unknown-observation: O99'],
      [['mark-changed', 'O04', fx.c1], 'skill-review failed: not-confirmed: O04'],
      [['mark-changed', 'O03', 'xyz'], 'skill-review failed: bad-commit: xyz'],
    ];
    for (const [args, expected] of cases) {
      const res = fx.exec(args);
      assert.equal(res.status, 1, res.stdout);
      assert.equal(res.stdout.trimEnd(), expected);
      assert.equal(fx.rawRecord(), before);
    }
  } finally {
    fx.cleanup();
  }
});

test('[R59-03] record-install records the version, source, time, and contained change commits', () => {
  const fx = makeFixture((c1) => ({
    observations: [
      observation('O03', { state: 'changed', cases: 2, changeCommit: c1 }),
      observation('O04', { state: 'watching', cases: 1 }),
    ],
  }));
  try {
    const res = fx.exec(['record-install', '1a2b3c4', fx.c2]);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.stdout.trimEnd(), 'skill-review: install recorded 1a2b3c4 (1 changes contained)');
    assert.deepEqual(fx.record().installs, [
      { version: '1a2b3c4', source: fx.c2, at: NOW, contains: [fx.c1] },
    ]);
  } finally {
    fx.cleanup();
  }
});

test('[R59-04] a change commit newer than the install source is not contained', () => {
  const fx = makeFixture((c1, c2) => ({
    observations: [observation('O03', { state: 'changed', cases: 2, changeCommit: c2 })],
  }));
  try {
    const res = fx.exec(['record-install', '1a2b3c4', fx.c1]);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.stdout.trimEnd(), 'skill-review: install recorded 1a2b3c4 (0 changes contained)');
    assert.deepEqual(fx.record().installs, [
      { version: '1a2b3c4', source: fx.c1, at: NOW, contains: [] },
    ]);
  } finally {
    fx.cleanup();
  }
});

test('[R59-05] recording the same install again keeps one entry with the first time', () => {
  const fx = makeFixture((c1) => ({
    observations: [observation('O03', { state: 'changed', cases: 2, changeCommit: c1 })],
  }));
  try {
    const first = fx.exec(['record-install', '1a2b3c4', fx.c2], NOW);
    assert.equal(first.status, 0, first.stdout);
    const second = fx.exec(['record-install', '1a2b3c4', fx.c2], LATER);
    assert.equal(second.status, 0, second.stdout);
    assert.equal(second.stdout.trimEnd(), 'skill-review: install already recorded 1a2b3c4');
    assert.deepEqual(fx.record().installs, [
      { version: '1a2b3c4', source: fx.c2, at: NOW, contains: [fx.c1] },
    ]);
  } finally {
    fx.cleanup();
  }
});

test('[R59-06] record-install rejects a bad version and an unknown commit and changes nothing', () => {
  const fx = makeFixture((c1) => ({
    observations: [observation('O03', { state: 'changed', cases: 2, changeCommit: c1 })],
  }));
  try {
    const before = fx.rawRecord();
    const cases = [
      [['record-install', 'abc', fx.c2], 'skill-review failed: bad-version: abc'],
      [['record-install', '1a2b3c4', 'ffffff0'], 'skill-review failed: unknown-commit: ffffff0'],
    ];
    for (const [args, expected] of cases) {
      const res = fx.exec(args);
      assert.equal(res.status, 1, res.stdout);
      assert.equal(res.stdout.trimEnd(), expected);
      assert.equal(fx.rawRecord(), before);
    }
  } finally {
    fx.cleanup();
  }
});

test('[R59-07] finish names an install version that no record matches', () => {
  const install = (version, c1) => ({ version, source: c1, at: NOW, contains: [] });
  const scenarios = [
    { name: 'unrecorded', versions: ['1a2b3c4'], manifest: { version: '9f8e7d6', status: 'complete' }, notice: true },
    { name: 'recorded', versions: ['9f8e7d6'], manifest: { version: '9f8e7d6', status: 'complete' }, notice: false },
    { name: 'no manifest', versions: ['1a2b3c4'], manifest: null, notice: false },
    { name: 'none', versions: ['1a2b3c4'], manifest: { version: 'none', status: 'complete' }, notice: false },
  ];
  for (const s of scenarios) {
    const fx = makeFixture((c1) => ({ installs: s.versions.map((v) => install(v, c1)) }));
    try {
      if (s.manifest) fx.manifest(s.manifest);
      const installsBefore = fx.record().installs;
      const res = fx.finish();
      assert.equal(res.status, 0, `${s.name}: ${res.stdout}`);
      const has = res.lines.includes('notice: unrecorded-install: 9f8e7d6');
      assert.equal(has, s.notice, `${s.name}: ${res.stdout}`);
      if (!s.notice) assert.ok(!res.stdout.includes('unrecorded-install'), s.name);
      assert.deepEqual(fx.record().installs, installsBefore, s.name);
    } finally {
      fx.cleanup();
    }
  }
});
