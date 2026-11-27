import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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

function baseRecord(conversations = {}) {
  return {
    format: 1,
    conversations,
    handoffs: [],
    observations: [],
    installs: [],
    nextObservation: 1,
  };
}

function makeFixture({ record, rawRecord, homeSet = true } = {}) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p03s01-')));
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
  if (record !== undefined) put(recordFile, JSON.stringify(record, null, 2) + '\n');
  if (rawRecord !== undefined) put(recordFile, rawRecord);
  git(home, 'add', '-A');
  git(home, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');
  const env = { ...process.env, SKILL_REVIEW_COPILOT_HOME: copilot, SKILL_REVIEW_CLAUDE_HOME: claude };
  if (homeSet) env.WORKFLOW_HOME = home;
  else delete env.WORKFLOW_HOME;
  const exec = (args) => {
    const res = spawnSync(process.execPath, [CLI, ...args], { cwd: proj, encoding: 'utf8', env });
    const stdoutLines = res.stdout.split(/\r?\n/).filter((l) => l !== '');
    return { status: res.status, stdoutLines, stdout: res.stdout };
  };
  const compactFile = join(root, 'compact.json');
  const judgementFile = join(root, 'judgement.json');
  return {
    root, home, proj, copilot, recordFile, compactFile, judgementFile,
    compact(conversations) {
      put(compactFile, JSON.stringify({ project: proj, conversations }, null, 2));
    },
    judgement(text = JSON.stringify({ cases: [] })) {
      put(judgementFile, text);
    },
    copilotLog(id, rows) {
      const all = [['session.start', { sessionId: id, context: { cwd: proj } }], ...rows];
      const text = all
        .map(([type, data], i) => JSON.stringify({ type, data, id: `e${i + 1}`, timestamp: '2026-11-01T00:00:00Z', parentId: null }))
        .join('\n');
      put(join(copilot, 'session-state', id, 'events.jsonl'), `${text}\n`);
    },
    exec,
    finish(args) {
      return exec(['finish', ...args]);
    },
    status() {
      return git(home, 'status', '--porcelain');
    },
    read() {
      return JSON.parse(readFileSync(recordFile, 'utf8'));
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

const conv = (harness, id, uses) => ({ harness, id, file: `/logs/${id}.jsonl`, uses });

test('[R54-05] finish raises the Position to the end of the use and keeps other keys', () => {
  const fx = makeFixture({
    record: baseRecord({
      'Copilot CLI:c1': { 'pull-work': 400, 'brain-storm': 30 },
      'Claude Code:k9': { 'brain-storm': 12 },
    }),
  });
  try {
    fx.compact([conv('Copilot CLI', 'c1', [{ skill: 'pull-work', start: 2, end: 520, from: 401 }])]);
    fx.judgement();
    const res = fx.finish([fx.compactFile, fx.judgementFile]);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.stdoutLines.at(-1), 'skill-review: reviewed 1 skill uses in 1 Conversations');
    assert.deepEqual(fx.read().conversations, {
      'Copilot CLI:c1': { 'pull-work': 520, 'brain-storm': 30 },
      'Claude Code:k9': { 'brain-storm': 12 },
    });
  } finally {
    fx.cleanup();
  }
});

test('[R54-06] finish creates the Review Record with every reviewed Position', () => {
  const fx = makeFixture();
  try {
    fx.compact([
      conv('Copilot CLI', 'c1', [
        { skill: 'brain-storm', start: 2, end: 9, from: 2 },
        { skill: 'pull-work', start: 10, end: 20, from: 10 },
      ]),
      conv('Claude Code', 'k1', [{ skill: 'pull-work', start: 2, end: 6, from: 2 }]),
    ]);
    fx.judgement();
    const res = fx.finish([fx.compactFile, fx.judgementFile]);
    assert.equal(res.status, 0, res.stdout);
    const expected = {
      format: 1,
      conversations: {
        'Copilot CLI:c1': { 'brain-storm': 9, 'pull-work': 20 },
        'Claude Code:k1': { 'pull-work': 6 },
      },
      handoffs: [],
      observations: [],
      installs: [],
      nextObservation: 1,
    };
    assert.equal(readFileSync(fx.recordFile, 'utf8'), JSON.stringify(expected, null, 2) + '\n');
  } finally {
    fx.cleanup();
  }
});

test('[R54-07] prepare and slice without finish leave the Home Repo untouched', () => {
  const fx = makeFixture();
  try {
    fx.copilotLog('c1', [
      ['skill.invoked', { name: 'pull-work' }],
      ['user.message', { content: 'go' }],
      ['assistant.message', { content: 'x'.repeat(4001) }],
      ['tool.execution_start', { toolName: 'ask_user' }],
      ['tool.execution_complete', { success: false }],
      ['user.message', { content: 'no, stop that' }],
      ['assistant.message', { content: 'ok' }],
    ]);
    const out = join(fx.root, 'out', 'compact.json');
    const prep = fx.exec(['prepare', '--out', out]);
    assert.equal(prep.status, 0, prep.stdout);
    const sliced = fx.exec(['slice', out, 'c1', '4']);
    assert.equal(sliced.status, 0, sliced.stdout);
    assert.equal(fx.status(), '');
    assert.ok(!existsSync(fx.recordFile), 'review-record.json does not exist');
  } finally {
    fx.cleanup();
  }
});

test('[R54-08] finish never lowers a Position', () => {
  const fx = makeFixture({ record: baseRecord({ 'Copilot CLI:c1': { 'pull-work': 600 } }) });
  try {
    fx.compact([conv('Copilot CLI', 'c1', [{ skill: 'pull-work', start: 2, end: 520, from: 401 }])]);
    fx.judgement();
    const res = fx.finish([fx.compactFile, fx.judgementFile]);
    assert.equal(res.status, 0, res.stdout);
    assert.deepEqual(fx.read().conversations, { 'Copilot CLI:c1': { 'pull-work': 600 } });
  } finally {
    fx.cleanup();
  }
});

test('[R61-02] finish writes only record files in the skill-review folder', () => {
  const fx = makeFixture({ record: baseRecord({ 'Copilot CLI:c1': { 'pull-work': 400 } }) });
  try {
    fx.compact([conv('Copilot CLI', 'c1', [{ skill: 'pull-work', start: 2, end: 520, from: 401 }])]);
    fx.judgement();
    const res = fx.finish([fx.compactFile, fx.judgementFile]);
    assert.equal(res.status, 0, res.stdout);
    assert.deepEqual(readdirSync(join(fx.home, 'skill-review')),     ['ledger.md', 'review-record.json', 'summaries']);
  } finally {
    fx.cleanup();
  }
});

test('[R67-02] finish without WORKFLOW_HOME fails and changes nothing', () => {
  const fx = makeFixture({ homeSet: false });
  try {
    fx.compact([conv('Copilot CLI', 'c1', [{ skill: 'pull-work', start: 2, end: 20, from: 2 }])]);
    fx.judgement();
    const res = fx.finish([fx.compactFile, fx.judgementFile]);
    assert.equal(res.status, 1);
    assert.equal(res.stdout.trimEnd(), 'skill-review failed: home-layout-required: start the Harness with the Launch Script');
    assert.equal(fx.status(), '');
    assert.ok(!existsSync(fx.recordFile));
  } finally {
    fx.cleanup();
  }
});

test('[R52-12] finish with an unreadable Review Record fails and leaves it unchanged', () => {
  const fx = makeFixture({ rawRecord: 'not json' });
  try {
    fx.compact([conv('Copilot CLI', 'c1', [{ skill: 'pull-work', start: 2, end: 20, from: 2 }])]);
    fx.judgement();
    const res = fx.finish([fx.compactFile, fx.judgementFile]);
    assert.equal(res.status, 1);
    assert.equal(res.stdout.trimEnd(), `skill-review failed: records-unreadable: ${fx.recordFile}`);
    assert.equal(readFileSync(fx.recordFile, 'utf8'), 'not json');
  } finally {
    fx.cleanup();
  }
});

test('[R52-13] finish with a missing compact record fails with the path as given', () => {
  const fx = makeFixture({ record: baseRecord() });
  try {
    fx.judgement();
    const before = readFileSync(fx.recordFile, 'utf8');
    const res = fx.finish(['missing-compact.json', fx.judgementFile]);
    assert.equal(res.status, 1);
    assert.equal(res.stdout.trimEnd(), 'skill-review failed: record-unreadable: missing-compact.json');
    assert.equal(readFileSync(fx.recordFile, 'utf8'), before);
  } finally {
    fx.cleanup();
  }
});

test('[R52-14] finish with an unreadable judgement file fails and writes nothing', () => {
  for (const [name, text] of [['not json', 'not json'], ['no cases array', JSON.stringify({ cases: 'x' })], ['missing cases', '{}']]) {
    const fx = makeFixture();
    try {
      fx.compact([conv('Copilot CLI', 'c1', [{ skill: 'pull-work', start: 2, end: 20, from: 2 }])]);
      put(join(fx.proj, 'judged.json'), text);
      const res = fx.finish([fx.compactFile, 'judged.json']);
      assert.equal(res.status, 1, name);
      assert.equal(res.stdout.trimEnd(), 'skill-review failed: judgement-unreadable: judged.json', name);
      assert.ok(!existsSync(fx.recordFile), `${name}: no Review Record written`);
      assert.equal(fx.status(), '', name);
    } finally {
      fx.cleanup();
    }
  }
});

test('[R52-15] finish with one argument fails with usage', () => {
  const fx = makeFixture();
  try {
    fx.compact([conv('Copilot CLI', 'c1', [{ skill: 'pull-work', start: 2, end: 20, from: 2 }])]);
    const res = fx.finish([fx.compactFile]);
    assert.equal(res.status, 1);
    assert.equal(res.stdout.trimEnd(), 'skill-review failed: usage: skill-review finish <compact-record-file> <judgement-file>');
    assert.ok(!existsSync(fx.recordFile));
  } finally {
    fx.cleanup();
  }
});
