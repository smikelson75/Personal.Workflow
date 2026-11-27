import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');
const USAGE = 'skill-review failed: usage: skill-review finish <compact-record-file> <judgement-file>';

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
const Kd = (description, extra = {}) => ({ ...K, description, ...extra });

// A sentence of n words.
const sentence = (n) => Array.from({ length: n }, (_, i) => `word${i + 1}`).join(' ') + '.';
const S27 = sentence(27);
const S25 = sentence(25);
const S22 = sentence(22);
// n sentences of 3 words each
const shorts = (n) => Array.from({ length: n }, () => 'One two three.').join(' ');

function makeFixture() {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p04s05-')));
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
  put(recordFile, JSON.stringify(emptyRecord(), null, 2) + '\n');
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
      project: 'Scheduler',
      conversations: [
        { harness: 'Copilot CLI', id: 'c1', file: logFile, uses: [{ skill: 'pull-work', start: 2, end: 20, from: 2 }] },
      ],
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
  const summaries = join(home, 'skill-review', 'summaries');
  const ledger = join(home, 'skill-review', 'ledger.md');
  return {
    root, home, summaries, ledger,
    readRecord: () => JSON.parse(readFileSync(recordFile, 'utf8')),
    recordText: () => readFileSync(recordFile, 'utf8'),
    summaryFiles: () => (existsSync(summaries) ? readdirSync(summaries) : []),
    summaryText: () => readFileSync(join(summaries, readdirSync(summaries)[0]), 'utf8'),
    ledgerText: () => readFileSync(ledger, 'utf8'),
    finish(cases, extraArgs = []) {
      const judgement = join(root, `judgement-${Math.random().toString(36).slice(2)}.json`);
      writeFileSync(judgement, JSON.stringify({ cases }));
      const res = spawnSync(process.execPath, [CLI, 'finish', compactFile, judgement, ...extraArgs], {
        cwd: proj, encoding: 'utf8', env,
      });
      const lines = res.stdout.split(/\r?\n/).filter((l) => l !== '');
      return { status: res.status, lines, stdout: res.stdout };
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function assertNothingWritten(fx, before) {
  assert.equal(existsSync(fx.summaries), false, 'no summaries folder');
  assert.equal(existsSync(fx.ledger), false, 'no ledger');
  assert.equal(fx.recordText(), before, 'Review Record is unchanged');
}

function section(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.indexOf(heading);
  assert.ok(start >= 0, `${heading} exists`);
  const out = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i++) {
    if (lines[i] !== '') out.push(lines[i]);
  }
  return out;
}

const splitSentences = (text) => text.split(/(?<=[.!?])(?:\s+)/).map((s) => s.trim()).filter((s) => s !== '');
const words = (s) => s.split(/\s+/).filter((w) => w !== '').length;

test('[R60-16] a sentence of 27 words fails the STE check and writes nothing', () => {
  const fx = makeFixture();
  try {
    const before = fx.recordText();
    const res = fx.finish([Kd(S27)]);
    assert.equal(res.status, 1, res.stdout);
    assert.deepEqual(res.lines, [
      'ste: O01 sentence 1 has 27 words (max 25)',
      'skill-review failed: ste-check: 1 sentences',
    ]);
    assertNothingWritten(fx, before);
  } finally {
    fx.cleanup();
  }
});

test('[R60-17] a sentence of 25 words passes the STE check', () => {
  const fx = makeFixture();
  try {
    const res = fx.finish([Kd(S25)]);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.lines.some((l) => l.startsWith('ste:')), false, res.stdout);
    assert.equal(fx.readRecord().observations.length, 1);
  } finally {
    fx.cleanup();
  }
});

test('[R60-18] a sentence in ## Next has at most 20 words', () => {
  const fx = makeFixture();
  const fx2 = makeFixture();
  try {
    const res = fx.finish([Kd(S22), Kd(S22, { line: 9 })]);
    assert.equal(res.status, 1, res.stdout);
    assert.ok(res.lines.includes('ste: O01 sentence 1 has 22 words (max 20)'), res.stdout);

    const res2 = fx2.finish([Kd(S22)]);
    assert.equal(res2.status, 0, res2.stdout);
    assert.equal(res2.lines.some((l) => l.startsWith('ste:')), false, res2.stdout);
  } finally {
    fx.cleanup();
    fx2.cleanup();
  }
});

test('[R60-19] an entry has at most 3 sentences and a paragraph at most 6', () => {
  const fx = makeFixture();
  const fx2 = makeFixture();
  try {
    const res = fx.finish([Kd(shorts(4))]);
    assert.equal(res.status, 1, res.stdout);
    assert.ok(res.lines.includes('ste: O01 entry has 4 sentences (max 3)'), res.stdout);
    assert.equal(res.lines.some((l) => l.includes('paragraph has')), false, res.stdout);

    const res2 = fx2.finish([Kd(shorts(7))]);
    assert.equal(res2.status, 1, res2.stdout);
    assert.ok(res2.lines.includes('ste: O01 entry has 7 sentences (max 3)'), res2.stdout);
    assert.ok(res2.lines.includes('ste: O01 paragraph has 7 sentences (max 6)'), res2.stdout);
  } finally {
    fx.cleanup();
    fx2.cleanup();
  }
});

test('[R60-20] a fix reason of 27 words fails the STE check', () => {
  const fx = makeFixture();
  try {
    const res = fx.finish([{ ...K, fixReason: S27 }]);
    assert.equal(res.status, 1, res.stdout);
    assert.ok(res.lines.includes('ste: O01 fix reason sentence 1 has 27 words (max 25)'), res.stdout);
  } finally {
    fx.cleanup();
  }
});

test('[R60-21] attempt 3 writes the records with a notice and an Observation against skill-review', () => {
  const fx = makeFixture();
  const fx2 = makeFixture();
  try {
    const res = fx.finish([Kd(S27)], ['--attempt', '3']);
    assert.equal(res.status, 0, res.stdout);
    assert.ok(res.lines.includes('observation: O02 new'), res.stdout);
    const files = fx.summaryFiles();
    assert.equal(files.length, 1);
    const summary = fx.summaryText();
    const notices = section(summary, '## Notices');
    assert.ok(notices.includes('- STE check failed: 1 sentences'), summary);
    const changed = section(summary, '## Changed');
    assert.ok(
      changed.some((l) => l.startsWith('- O02 skill-review:')),
      `O02 is listed in ## Changed: ${changed.join(' | ')}`,
    );
    const o = fx.readRecord().observations.find((x) => x.part === 'skill-review');
    assert.ok(o, 'Observation against skill-review exists');
    for (const [k, v] of Object.entries({
      part: 'skill-review', state: 'watching', kind: 'rule adherence', cases: 1,
      outcome: 'part change', fixType: 'clarified rule',
    })) {
      assert.equal(o[k], v, `field ${k}`);
    }

    const before = fx2.recordText();
    const res2 = fx2.finish([Kd(S27)], ['--attempt', '2']);
    assert.equal(res2.status, 1, res2.stdout);
    assert.deepEqual(res2.lines, [
      'ste: O01 sentence 1 has 27 words (max 25)',
      'skill-review failed: ste-check: 1 sentences',
    ]);
    assertNothingWritten(fx2, before);
  } finally {
    fx.cleanup();
    fx2.cleanup();
  }
});

test('[R60-22] a bad --attempt value fails with the usage line', () => {
  for (const value of ['4', 'x']) {
    const fx = makeFixture();
    try {
      const before = fx.recordText();
      const res = fx.finish([K], ['--attempt', value]);
      assert.equal(res.status, 1, res.stdout);
      assert.deepEqual(res.lines, [USAGE], `--attempt ${value}`);
      assertNothingWritten(fx, before);
    } finally {
      fx.cleanup();
    }
  }
});

test('[Q-ste] summary and ledger keep to the sentence and paragraph limits', () => {
  const fx = makeFixture();
  try {
    const topics = [
      'The skill asked the same question twice.',
      'The skill skipped the check step.',
      'The skill named the wrong folder.',
      'The skill wrote a long list.',
      'The skill ignored the stop rule.',
      'The skill repeated the plan text.',
      'The skill left a step open.',
      'The skill used an old name.',
      'The skill hid the error line.',
      'The skill gave no final answer.',
    ];
    const cases = [];
    let line = 2;
    topics.forEach((description, i) => {
      const ref = `r${i + 1}`;
      cases.push(Kd(description, { ref, line: line++ }));
      if (i < 5) cases.push(Kd(description, { ref, line: line++ }));
    });
    const res = fx.finish(cases);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(fx.readRecord().observations.length, 10);

    const summary = fx.summaryText();
    const next = section(summary, '## Next');
    assert.equal(next.filter((l) => l.startsWith('- O')).length, 5, `5 Next entries: ${next.join(' | ')}`);

    const check = (text, label, nextLines) => {
      for (const l of text.split(/\r?\n/)) {
        const max = nextLines.has(l) ? 20 : 25;
        const sentences = splitSentences(l);
        for (const s of sentences) {
          assert.ok(words(s) <= max, `${label}: "${s}" has ${words(s)} words (max ${max})`);
        }
        assert.ok(sentences.length <= 6, `${label}: line "${l}" has ${sentences.length} sentences`);
      }
    };
    check(summary, 'summary', new Set(next));
    check(fx.ledgerText(), 'ledger', new Set());
  } finally {
    fx.cleanup();
  }
});
