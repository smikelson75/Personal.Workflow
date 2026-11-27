import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, `git ${args.join(' ')} failed: ${res.stderr}`);
}

function put(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

const improved = {
  id: 'O03', part: 'pull-work', state: 'improved', kind: 'rule adherence', label: null, side: null, area: null,
  outcome: 'part change', cause: null, model: null, fixType: 'clarified rule', fixReason: 'A check cannot find this.',
  description: 'The skill asked the same question twice.', cases: 1, chances: 2, changeCommit: 'abc1234', follows: null,
};

function makeFixture() {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p03s06-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
  }
  put(join(home, '.claude', 'skills', 'pull-work', 'SKILL.md'), '# pull-work\n');
  const recordFile = join(home, 'skill-review', 'review-record.json');
  put(recordFile, JSON.stringify({
    format: 1, conversations: {}, handoffs: [], observations: [improved], installs: [], nextObservation: 4,
  }, null, 2) + '\n');
  const log = join(root, 'logs', 'c2', 'events.jsonl');
  put(log, `${JSON.stringify({ type: 'session.start', data: {}, id: 'e1', parentId: null, timestamp: '2026-11-26T15:00:00.000Z' })}\n`);
  const compact = join(root, 'compact.json');
  put(compact, JSON.stringify({
    project: proj,
    conversations: [{ harness: 'Copilot CLI', id: 'c2', file: log, uses: [{ skill: 'pull-work', start: 2, end: 10, from: 2 }] }],
  }));
  const env = { ...process.env, WORKFLOW_HOME: home };
  return {
    root,
    record: () => JSON.parse(readFileSync(recordFile, 'utf8')),
    finish(cases) {
      const judgement = join(root, 'judgement.json');
      put(judgement, JSON.stringify({ cases }));
      const res = spawnSync(process.execPath, [CLI, 'finish', compact, judgement], { cwd: proj, encoding: 'utf8', env });
      return { status: res.status, lines: res.stdout.split(/\r?\n/).filter((l) => l !== ''), stdout: res.stdout };
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

const H = (line) => ({ match: 'O03', conversation: 'Copilot CLI:c2', line });

test('[R58-25] two cases on one improved Observation in a run make one follower with 2 cases', () => {
  const fx = makeFixture();
  try {
    const res = fx.finish([H(5), H(6)]);
    assert.equal(res.status, 0, res.stdout);
    const rec = fx.record();
    assert.deepEqual(rec.observations.map((o) => o.id), ['O03', 'O04']);
    const o4 = rec.observations[1];
    assert.equal(o4.follows, 'O03');
    assert.equal(o4.cases, 2);
    assert.equal(o4.state, 'confirmed');
    assert.equal(rec.observations[0].state, 'improved');
    assert.equal(rec.nextObservation, 5);
    assert.ok(res.lines.indexOf('observation: O04 new') >= 0, res.stdout);
    assert.ok(res.lines.indexOf('observation: O04 confirmed') > res.lines.indexOf('observation: O04 new'), res.stdout);
  } finally {
    fx.cleanup();
  }
});

test('[R58-26] a case in a later run on the same improved Observation opens another follower', () => {
  const fx = makeFixture();
  try {
    assert.equal(fx.finish([H(5)]).status, 0);
    const res = fx.finish([H(6)]);
    assert.equal(res.status, 0, res.stdout);
    const rec = fx.record();
    assert.deepEqual(rec.observations.map((o) => o.id), ['O03', 'O04', 'O05']);
    assert.equal(rec.observations[2].follows, 'O03');
    assert.equal(rec.observations[2].cases, 1);
  } finally {
    fx.cleanup();
  }
});
