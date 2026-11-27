import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');
const INSTALL_AT = '2026-11-26T14:00:00.000Z';

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, `git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout.trim();
}

function put(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

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
    description: 'The skill asked the same question twice.',
    cases: 1,
    chances: 0,
    changeCommit: null,
    follows: null,
    ...over,
  };
}

// opts.obs: overrides for O03; opts.noInstall: installs empty; opts.emptyContains: install holds no change
function makeFixture(opts = {}) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p03s05-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  const src = join(root, 'src');
  const logs = join(root, 'logs');
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
  const installs = opts.noInstall
    ? []
    : [{ version: '1a2b3c4', source: C2, at: INSTALL_AT, contains: opts.emptyContains ? [] : [C1] }];
  const record = {
    format: 1,
    conversations: {},
    handoffs: [],
    observations: [observation({ changeCommit: C1, ...(opts.obs || {}) })],
    installs,
    nextObservation: 4,
  };
  put(join(home, 'skill-review', 'review-record.json'), JSON.stringify(record, null, 2) + '\n');
  git(home, 'add', '-A');
  git(home, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');
  const env = { ...process.env, WORKFLOW_HOME: home, SKILL_REVIEW_NOW: '2026-11-27T09:00:00.000Z' };
  const convs = [];
  return {
    root, home, proj, C1, C2,
    // started: ISO string, or null for a log whose lines carry no timestamp
    conv(id, started) {
      const file = join(logs, id, 'events.jsonl');
      const rows = [];
      for (let i = 1; i <= 12; i += 1) {
        const row = { type: i === 1 ? 'session.start' : 'user.message', data: { sessionId: id }, id: `e${i}`, parentId: null };
        if (i === 1 && started) row.timestamp = started;
        rows.push(JSON.stringify(row));
      }
      put(file, `${rows.join('\n')}\n`);
      convs.push({ harness: 'Copilot CLI', id, file, uses: [{ skill: 'pull-work', start: 2, end: 10, from: 2 }] });
    },
    finish(cases) {
      const compact = join(root, 'compact.json');
      const judgement = join(root, 'judgement.json');
      put(compact, JSON.stringify({ project: proj, conversations: convs }, null, 2));
      put(judgement, JSON.stringify({ cases }));
      const res = spawnSync(process.execPath, [CLI, 'finish', compact, judgement], { cwd: proj, encoding: 'utf8', env });
      return { status: res.status, lines: res.stdout.split(/\r?\n/).filter((l) => l !== ''), stdout: res.stdout };
    },
    record() {
      return JSON.parse(readFileSync(join(home, 'skill-review', 'review-record.json'), 'utf8'));
    },
    o(id) {
      return this.record().observations.find((x) => x.id === id);
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

const H = (key) => ({ match: 'O03', conversation: `Copilot CLI:${key}`, line: 5 });

function ok(res) {
  assert.equal(res.status, 0, res.stdout);
}

const noO03Lines = (res) => res.lines.filter((l) => l.startsWith('observation: O03'));

test('[R58-16] a clean use after the install counts one chance', () => {
  const fx = makeFixture();
  try {
    fx.conv('c2', '2026-11-26T15:00:00.000Z');
    const res = fx.finish([]);
    ok(res);
    const o = fx.o('O03');
    assert.equal(o.state, 'changed');
    assert.equal(o.chances, 1);
    assert.deepEqual(noO03Lines(res), []);
  } finally {
    fx.cleanup();
  }
});

test('[R58-17] a second clean chance makes the Observation improved', () => {
  const fx = makeFixture({ obs: { chances: 1 } });
  try {
    fx.conv('c2', '2026-11-26T15:00:00.000Z');
    const res = fx.finish([]);
    ok(res);
    const o = fx.o('O03');
    assert.equal(o.state, 'improved');
    assert.equal(o.chances, 2);
    assert.ok(res.lines.includes('observation: O03 improved'), res.stdout);
  } finally {
    fx.cleanup();
  }
});

test('[R58-18] a case in a chance returns the Observation to confirmed', () => {
  const fx = makeFixture();
  try {
    fx.conv('c2', '2026-11-26T15:00:00.000Z');
    const res = fx.finish([H('c2')]);
    ok(res);
    const o = fx.o('O03');
    assert.equal(o.state, 'confirmed');
    assert.equal(o.cases, 2);
    assert.equal(o.chances, 0);
    assert.equal(o.changeCommit, null);
    assert.deepEqual(noO03Lines(res), ['observation: O03 case', 'observation: O03 unchanged']);
  } finally {
    fx.cleanup();
  }
});

test('[R58-19] a case before the install leaves the Observation changed', () => {
  const fx = makeFixture();
  try {
    fx.conv('c1', '2026-11-26T13:30:00.000Z');
    const res = fx.finish([H('c1')]);
    ok(res);
    const o = fx.o('O03');
    assert.equal(o.state, 'changed');
    assert.equal(o.cases, 2);
    assert.equal(o.chances, 0);
    assert.ok(!res.lines.includes('observation: O03 unchanged'), res.stdout);
  } finally {
    fx.cleanup();
  }
});

test('[R58-20] a clean chance followed by a case returns the Observation to confirmed', () => {
  const fx = makeFixture();
  try {
    fx.conv('c2', '2026-11-26T15:00:00.000Z');
    fx.conv('c3', '2026-11-26T16:00:00.000Z');
    const res = fx.finish([H('c3')]);
    ok(res);
    const o = fx.o('O03');
    assert.equal(o.state, 'confirmed');
    assert.equal(o.chances, 0);
    assert.equal(o.changeCommit, null);
    assert.ok(res.lines.includes('observation: O03 unchanged'), res.stdout);
  } finally {
    fx.cleanup();
  }
});

test('[R58-24] the walk stops at the case, so a later clean use is not counted', () => {
  const fx = makeFixture();
  try {
    fx.conv('c2', '2026-11-26T15:00:00.000Z');
    fx.conv('c3', '2026-11-26T16:00:00.000Z');
    const res = fx.finish([H('c2')]);
    ok(res);
    const o = fx.o('O03');
    assert.equal(o.state, 'confirmed');
    assert.equal(o.chances, 0);
    assert.equal(o.changeCommit, null);
  } finally {
    fx.cleanup();
  }
});

test('[R58-21] with no install recorded a later use is not a chance', () => {
  const fx = makeFixture({ noInstall: true });
  try {
    fx.conv('c2', '2026-11-26T15:00:00.000Z');
    const res = fx.finish([]);
    ok(res);
    const o = fx.o('O03');
    assert.equal(o.state, 'changed');
    assert.equal(o.chances, 0);
    assert.deepEqual(noO03Lines(res), []);
  } finally {
    fx.cleanup();
  }
});

test('[R58-22] a case on an improved Observation opens a new watching Observation', () => {
  const fx = makeFixture({ obs: { state: 'improved', chances: 2 } });
  try {
    fx.conv('c2', '2026-11-26T15:00:00.000Z');
    const res = fx.finish([H('c2')]);
    ok(res);
    const o4 = fx.o('O04');
    assert.ok(o4, 'O04 exists');
    assert.equal(o4.state, 'watching');
    assert.equal(o4.cases, 1);
    assert.equal(o4.follows, 'O03');
    assert.equal(o4.part, 'pull-work');
    assert.equal(fx.o('O03').state, 'improved');
    assert.ok(res.lines.includes('observation: O04 new'), res.stdout);
  } finally {
    fx.cleanup();
  }
});

test('[R58-23] a Conversation with no start, or starting exactly at the install, is no chance', () => {
  for (const started of [null, INSTALL_AT]) {
    const fx = makeFixture();
    try {
      fx.conv('c2', started);
      const res = fx.finish([]);
      ok(res);
      const o = fx.o('O03');
      assert.equal(o.chances, 0, `started ${started}`);
      assert.equal(o.state, 'changed', `started ${started}`);
    } finally {
      fx.cleanup();
    }
  }
});

test('[R59-08] a change no install contains is not installed and counts no chance', () => {
  const fx = makeFixture({ emptyContains: true });
  try {
    fx.conv('c2', '2026-11-26T15:00:00.000Z');
    const res = fx.finish([]);
    ok(res);
    const o = fx.o('O03');
    assert.equal(o.state, 'changed');
    assert.equal(o.chances, 0);
    assert.deepEqual(noO03Lines(res), []);
  } finally {
    fx.cleanup();
  }
});
