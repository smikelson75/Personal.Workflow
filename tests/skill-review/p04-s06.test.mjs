import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');

const SECRET_MESSAGE = 'Please never print the deploy token sk-test-9f8e7d6c5b4a when you run the release step';
const UUID = '8d1c2f3e-1111-2222-3333-444455556666';

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

// messages: { lineNumber: text } placed as user.message content; other lines are short.
function logText(id, messages) {
  const rows = [['session.start', { sessionId: id, context: { cwd: 'x' } }]];
  for (let i = 2; i <= 20; i++) rows.push(['user.message', { content: messages[i] ?? `m${i}` }]);
  return (
    rows
      .map(([type, data], i) => JSON.stringify({ type, data, id: `e${i + 1}`, timestamp: '2026-11-01T00:00:00Z', parentId: null }))
      .join('\n') + '\n'
  );
}

function makeFixture({ convs = [{ id: 'c1', messages: { 3: SECRET_MESSAGE } }], record = emptyRecord() } = {}) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p04s06-')));
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
  const srDir = join(home, 'skill-review');
  const recordFile = join(srDir, 'review-record.json');
  put(recordFile, JSON.stringify(record, null, 2) + '\n');
  git(home, 'add', '-A');
  git(home, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');

  const conversations = convs.map((c) => {
    const file = join(copilot, 'session-state', c.id, 'events.jsonl');
    put(file, logText(c.id, c.messages));
    return { harness: 'Copilot CLI', id: c.id, file, uses: [{ skill: 'pull-work', start: 2, end: 20, from: 2 }] };
  });
  const compactFile = join(root, 'compact.json');
  writeFileSync(
    compactFile,
    JSON.stringify({
      project: 'Scheduler',
      conversations,
      tokens: { depth1: 120, depth2: 30 },
      notices: [],
    }),
  );
  const env = {
    ...process.env,
    WORKFLOW_HOME: home,
    SKILL_REVIEW_COPILOT_HOME: copilot,
    SKILL_REVIEW_NOW: '2026-11-26T14:05:00',
  };
  return {
    root, home, proj, srDir, recordFile,
    recordText: () => readFileSync(recordFile, 'utf8'),
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

function assertRefused(fx, res, field, before) {
  assert.equal(res.status, 1, res.stdout);
  assert.deepEqual(res.lines, [`skill-review failed: privacy-check: case 1 ${field}`]);
  assert.equal(fx.recordText(), before, 'Review Record is unchanged');
  assert.equal(existsSync(join(fx.srDir, 'ledger.md')), false, 'no ledger');
  assert.equal(existsSync(join(fx.srDir, 'summaries')), false, 'no summaries');
  assert.deepEqual(readdirSync(fx.srDir), ['review-record.json']);
}

function words(text) {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function allFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...allFiles(p));
    else out.push(p);
  }
  return out;
}

test('[R64-01] a secret-like string from a Conversation Log in a case is refused', () => {
  const fx = makeFixture();
  try {
    const before = fx.recordText();
    const res = fx.finish([{ ...K, description: 'The skill printed sk-test-9f8e7d6c5b4a once.' }]);
    assertRefused(fx, res, 'description', before);
    assert.ok(!res.stdout.includes('sk-test-9f8e7d6c5b4a'), 'the text is not echoed');
  } finally {
    fx.cleanup();
  }
});

test('[R64-02] 7 words in a row from the log pass; 8 words in a row are refused', () => {
  const fx = makeFixture();
  const fx2 = makeFixture();
  try {
    const ok = fx.finish([{ ...K, description: 'The skill wrote please never print the deploy token sk in a note.' }]);
    assert.equal(ok.status, 0, ok.stdout);

    const before = fx2.recordText();
    const res = fx2.finish([{ ...K, description: 'The skill wrote please never print the deploy token sk test in a note.' }]);
    assertRefused(fx2, res, 'description', before);
  } finally {
    fx.cleanup();
    fx2.cleanup();
  }
});

test('[R64-03] copied log words in the cause field are refused', () => {
  const fx = makeFixture();
  try {
    const before = fx.recordText();
    const res = fx.finish([
      { ...K, outcome: 'no action', cause: 'please never print the deploy token sk test', fixType: null, fixReason: null },
    ]);
    assertRefused(fx, res, 'cause', before);
  } finally {
    fx.cleanup();
  }
});

test('[R64-04] Conversation IDs, commit IDs, and paths are allowed', () => {
  const fx = makeFixture({ convs: [{ id: UUID, messages: { 3: SECRET_MESSAGE, 4: '3f9a2c1d5e', 5: '.workflow/plans/a.md' } }] });
  try {
    const res = fx.finish([
      {
        ...K,
        conversation: `Copilot CLI:${UUID}`,
        description: `The skill kept ${UUID} and 3f9a2c1d5e at .workflow/plans/a.md.`,
      },
    ]);
    assert.equal(res.status, 0, res.stdout);
    assert.ok(res.lines.includes('observation: O01 new'), res.stdout);
  } finally {
    fx.cleanup();
  }
});

test('[Q-privacy] no 8 consecutive log words appear in any record file', () => {
  const long = (tag) =>
    Array.from({ length: 30 }, (_, i) => `${tag}word${i}`).join(' ') + ' and then the long message ends here for the review';
  const convs = ['c1', 'c2', 'c3'].map((id) => ({
    id,
    messages: { 3: long(id + 'a'), 4: long(id + 'b'), 5: SECRET_MESSAGE },
  }));
  const fx = makeFixture({ convs });
  try {
    const res = fx.finish([K]);
    assert.equal(res.status, 0, res.stdout);
    assert.ok(res.lines.includes('observation: O01 new'), res.stdout);
    const windows = new Set();
    for (const c of convs) {
      for (const msg of Object.values(c.messages)) {
        const w = words(msg);
        for (let i = 0; i + 8 <= w.length; i++) windows.add(w.slice(i, i + 8).join(' '));
      }
    }
    const files = allFiles(fx.srDir);
    assert.ok(files.length >= 2, 'record files exist');
    for (const f of files) {
      const w = words(readFileSync(f, 'utf8'));
      for (let i = 0; i + 8 <= w.length; i++) {
        assert.ok(!windows.has(w.slice(i, i + 8).join(' ')), `${f} copies log words: ${w.slice(i, i + 8).join(' ')}`);
      }
    }
  } finally {
    fx.cleanup();
  }
});
