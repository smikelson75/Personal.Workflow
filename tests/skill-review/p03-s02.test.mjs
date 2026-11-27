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

const emptyRecord = (extra = {}) => ({
  format: 1,
  conversations: {},
  handoffs: [],
  observations: [],
  installs: [],
  nextObservation: 1,
  ...extra,
});

// Case K from the card
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

function makeFixture({ record, from = 2 } = {}) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p03s02-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  const copilot = join(root, 'copilot');
  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
  }
  for (const skill of ['pull-work', 'brain-storm', 'skill-review']) {
    put(join(home, '.claude', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  const recordFile = join(home, 'skill-review', 'review-record.json');
  if (record !== undefined) put(recordFile, JSON.stringify(record, null, 2) + '\n');
  git(home, 'add', '-A');
  git(home, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');

  const logFile = join(copilot, 'session-state', 'c1', 'events.jsonl');
  const rows = [['session.start', { sessionId: 'c1', context: { cwd: proj } }]];
  for (let i = 2; i <= 20; i++) rows.push(['user.message', { content: `m${i}` }]);
  put(
    logFile,
    rows
      .map(([type, data], i) => JSON.stringify({ type, data, id: `e${i + 1}`, timestamp: '2026-11-01T00:00:00Z', parentId: null }))
      .join('\n') + '\n',
  );
  const compactFile = join(root, 'compact.json');
  writeFileSync(
    compactFile,
    JSON.stringify({
      project: proj,
      conversations: [
        { harness: 'Copilot CLI', id: 'c1', file: logFile, uses: [{ skill: 'pull-work', start: 2, end: 20, from }] },
      ],
    }),
  );
  const env = { ...process.env, WORKFLOW_HOME: home, SKILL_REVIEW_COPILOT_HOME: copilot };
  return {
    root, home, proj, recordFile,
    readRecord: () => JSON.parse(readFileSync(recordFile, 'utf8')),
    recordText: () => (existsSync(recordFile) ? readFileSync(recordFile, 'utf8') : null),
    finish(cases) {
      const judgement = join(root, `judgement-${Math.random().toString(36).slice(2)}.json`);
      writeFileSync(judgement, JSON.stringify({ cases }));
      const res = spawnSync(process.execPath, [CLI, 'finish', compactFile, judgement], { cwd: proj, encoding: 'utf8', env });
      const lines = res.stdout.split(/\r?\n/).filter((l) => l !== '');
      return { status: res.status, lines, stdout: res.stdout };
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function assertFailed(fx, res, detail, before) {
  assert.equal(res.status, 1, res.stdout);
  assert.deepEqual(res.lines, [`skill-review failed: judgement-invalid: ${detail}`]);
  assert.equal(fx.recordText(), before, 'Review Record is unchanged');
}

test('[R58-01] a case makes a new watching Observation', () => {
  const fx = makeFixture();
  try {
    const res = fx.finish([K]);
    assert.equal(res.status, 0, res.stdout);
    assert.ok(res.lines.includes('observation: O01 new'), res.stdout);
    const rec = fx.readRecord();
    assert.equal(rec.observations.length, 1);
    const o = rec.observations[0];
    for (const [k, v] of Object.entries({
      id: 'O01', part: 'pull-work', state: 'watching', kind: 'rule adherence',
      cases: 1, chances: 0, outcome: 'part change', fixType: 'clarified rule',
    })) {
      assert.equal(o[k], v, `field ${k}`);
    }
    assert.equal(rec.nextObservation, 2);
  } finally {
    fx.cleanup();
  }
});

test('[R58-02] two cases with the same ref confirm one Observation', () => {
  const fx = makeFixture();
  try {
    const res = fx.finish([K, { ...K, line: 9 }]);
    assert.equal(res.status, 0, res.stdout);
    const iNew = res.lines.indexOf('observation: O01 new');
    const iConf = res.lines.indexOf('observation: O01 confirmed');
    assert.ok(iNew >= 0, res.stdout);
    assert.ok(iConf > iNew, res.stdout);
    const rec = fx.readRecord();
    assert.equal(rec.observations.length, 1);
    assert.equal(rec.observations[0].id, 'O01');
    assert.equal(rec.observations[0].state, 'confirmed');
    assert.equal(rec.observations[0].cases, 2);
  } finally {
    fx.cleanup();
  }
});

test('[R58-03] matching cases confirm an Observation, in any order', () => {
  const fx = makeFixture();
  const fx2 = makeFixture();
  try {
    assert.equal(fx.finish([K]).status, 0);
    const M = (line) => ({ match: 'O01', conversation: 'Copilot CLI:c1', line });
    const res = fx.finish([M(6), M(7)]);
    assert.equal(res.status, 0, res.stdout);
    const rec = fx.readRecord();
    assert.equal(rec.observations.length, 1);
    assert.equal(rec.observations[0].state, 'confirmed');
    assert.equal(rec.observations[0].cases, 3);

    const res2 = fx2.finish([K, { ...K, line: 6 }, { ...K, line: 7 }]);
    assert.equal(res2.status, 0, res2.stdout);
    const o2 = fx2.readRecord().observations;
    assert.equal(o2.length, 1);
    const a = rec.observations[0];
    const b = o2[0];
    for (const k of ['state', 'cases', 'kind', 'part']) assert.equal(b[k], a[k], `field ${k}`);
  } finally {
    fx.cleanup();
    fx2.cleanup();
  }
});

test('[R58-04] an unknown Observation ID fails and writes nothing', () => {
  const fx = makeFixture({ record: emptyRecord() });
  try {
    const before = fx.recordText();
    const res = fx.finish([{ match: 'O09', conversation: 'Copilot CLI:c1', line: 5 }]);
    assertFailed(fx, res, 'case 1: unknown observation O09', before);
  } finally {
    fx.cleanup();
  }
});

test('[R58-05] the new Observation takes its ID from nextObservation', () => {
  const fx = makeFixture({ record: emptyRecord({ nextObservation: 5 }) });
  try {
    const res = fx.finish([K]);
    assert.equal(res.status, 0, res.stdout);
    assert.ok(res.lines.includes('observation: O05 new'), res.stdout);
    const rec = fx.readRecord();
    assert.equal(rec.observations.length, 1);
    assert.equal(rec.observations[0].id, 'O05');
    assert.equal(rec.nextObservation, 6);
  } finally {
    fx.cleanup();
  }
});

test('[R57-01] an unknown kind fails', () => {
  const fx = makeFixture({ record: emptyRecord() });
  try {
    const before = fx.recordText();
    const res = fx.finish([{ ...K, kind: 'boring' }]);
    assertFailed(fx, res, 'case 1: unknown kind "boring"', before);
  } finally {
    fx.cleanup();
  }
});

test('[R57-02] a missing Fix Filter fails', () => {
  for (const patch of [{ fixType: null }, { fixType: 'new prose', fixReason: '' }]) {
    const fx = makeFixture({ record: emptyRecord() });
    try {
      const before = fx.recordText();
      const res = fx.finish([{ ...K, ...patch }]);
      assertFailed(fx, res, 'case 1: fix filter missing', before);
    } finally {
      fx.cleanup();
    }
  }
});

test('[R57-03] a Developer contribution may end as a Developer note without a fix type', () => {
  const fx = makeFixture();
  try {
    const res = fx.finish([{ ...K, kind: 'Developer contribution', outcome: 'Developer note', fixType: null }]);
    assert.equal(res.status, 0, res.stdout);
    const rec = fx.readRecord();
    assert.equal(rec.observations.length, 1);
    assert.equal(rec.observations[0].outcome, 'Developer note');
    assert.equal(rec.observations[0].kind, 'Developer contribution');
  } finally {
    fx.cleanup();
  }
});

test('[R57-04] no action without a cause fails', () => {
  const fx = makeFixture({ record: emptyRecord() });
  try {
    const before = fx.recordText();
    const res = fx.finish([{ ...K, outcome: 'no action', cause: null }]);
    assertFailed(fx, res, 'case 1: cause missing', before);
  } finally {
    fx.cleanup();
  }
});

test('[R57-05] an unknown outcome fails', () => {
  const fx = makeFixture({ record: emptyRecord() });
  try {
    const before = fx.recordText();
    const res = fx.finish([{ ...K, outcome: 'maybe' }]);
    assertFailed(fx, res, 'case 1: unknown outcome "maybe"', before);
  } finally {
    fx.cleanup();
  }
});

test('[R54-10] a case line before the new Position fails', () => {
  const fx = makeFixture({ record: emptyRecord(), from: 11 });
  try {
    const before = fx.recordText();
    const res = fx.finish([K]);
    assertFailed(fx, res, 'case 1: line 5 is not in a new Position', before);
  } finally {
    fx.cleanup();
  }
});
