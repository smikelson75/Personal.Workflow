import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');
const NOW = '2026-11-26T14:05:00';
const SUMMARY_NAME = '2026-11-26-1405-Scheduler.md';

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

// opts.record: Review Record object; opts.manifest: manifest version string
function makeFixture(opts = {}) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p04s02-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  const copilot = join(root, 'copilot');
  const claude = join(root, 'claude');
  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
  }
  for (const skill of ['pull-work', 'brain-storm', 'behavior-spec', 'skill-review']) {
    put(join(home, '.claude', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  mkdirSync(copilot, { recursive: true });
  mkdirSync(claude, { recursive: true });
  if (opts.record) put(join(home, 'skill-review', 'review-record.json'), JSON.stringify(opts.record, null, 2) + '\n');
  if (opts.manifest) {
    put(join(home, '.git', 'personal-workflow', 'manifest.json'), JSON.stringify({ version: opts.manifest }));
  }
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
  const exec = (args) => {
    const res = spawnSync(process.execPath, [CLI, ...args], { cwd: proj, encoding: 'utf8', env });
    return { status: res.status, lines: res.stdout.split(/\r?\n/).filter((l) => l !== ''), stdout: res.stdout };
  };
  const summariesDir = join(home, 'skill-review', 'summaries');
  return {
    root, home, proj, compactFile, summariesDir,
    summaryFile: join(summariesDir, SUMMARY_NAME),
    recordFile: join(home, 'skill-review', 'review-record.json'),
    exec,
    // extra: keys merged into the compact record (tokens, notices); pass tokens: undefined to omit
    finish(conversations, extra = {}) {
      const compact = { project: 'Scheduler', conversations, tokens: { depth1: 120, depth2: 30 }, notices: [], ...extra };
      put(compactFile, JSON.stringify(compact, null, 2));
      put(judgementFile, JSON.stringify({ cases: [] }));
      return exec(['finish', compactFile, judgementFile]);
    },
    summary(name = SUMMARY_NAME) {
      return readFileSync(join(summariesDir, name), 'utf8');
    },
    copilotLog(id, rows) {
      const all = [['session.start', { sessionId: id, context: { cwd: proj } }], ...rows];
      const text = all
        .map(([type, data], i) => JSON.stringify({ type, data, id: `e${i + 1}`, timestamp: '2026-11-01T00:00:00Z', parentId: null }))
        .join('\n');
      put(join(copilot, 'session-state', id, 'events.jsonl'), `${text}\n`);
    },
    claudeLog(id) {
      const rows = [
        { type: 'user', cwd: proj, sessionId: id, message: { content: 'hi' } },
        { type: 'assistant', cwd: proj, sessionId: id, message: { content: [{ type: 'text', text: 'hello' }] } },
      ];
      put(join(claude, 'projects', 'p', `${id}.jsonl`), `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

const conv = (harness, id, skills) => ({
  harness,
  id,
  file: `/logs/${id}.jsonl`,
  uses: skills.map((skill, i) => ({ skill, start: 2 + i * 10, end: 10 + i * 10, from: 2 + i * 10 })),
});

const PULL = [conv('Copilot CLI', 'c1', ['pull-work'])];

function ok(res) {
  assert.equal(res.status, 0, res.stdout);
}

// Non-empty lines of the summary file from the first `## ` heading.
const bodyLines = (text) => text.split(/\r?\n/).slice(4).filter((l) => l.trim() !== '');

test('[R52-16] the Reviewed line counts Conversations, skill uses, and sorted skill names', () => {
  const fx = makeFixture();
  try {
    const res = fx.finish([
      conv('Copilot CLI', 'c1', ['brain-storm', 'behavior-spec']),
      conv('Claude Code', 'k1', ['pull-work']),
    ]);
    ok(res);
    assert.ok(existsSync(fx.summaryFile), `summary file exists in ${fx.summariesDir}`);
    const lines = fx.summary().split(/\r?\n/);
    assert.equal(
      lines[2],
      'Reviewed: 2 Conversations, 3 skill uses (behavior-spec, brain-storm, pull-work), 0 Handoffs; pending Handoffs: 0',
    );
  } finally {
    fx.cleanup();
  }
});

test('[R60-01] the summary has the header lines and four empty sections in order', () => {
  const fx = makeFixture();
  try {
    const res = fx.finish(PULL);
    ok(res);
    const text = fx.summary();
    const lines = text.split(/\r?\n/);
    assert.equal(lines[0], '# Skill Review - Scheduler - 2026-11-26 14:05');
    assert.ok(lines[1].startsWith('Workflow version:'), lines[1]);
    assert.ok(lines[2].startsWith('Reviewed:'), lines[2]);
    assert.ok(lines[3].startsWith('Model tokens:'), lines[3]);
    assert.deepEqual(bodyLines(text), [
      '## Changed', 'None.',
      '## Improved', 'None.',
      '## Same', 'None.',
      '## Next', 'None.',
    ]);
    assert.ok(!text.includes('## Notices'));
    assert.ok(text.endsWith('\n'));
  } finally {
    fx.cleanup();
  }
});

test('[R60-02] the Workflow version line names the manifest version and its install source', () => {
  const install = (version) => ({ version, source: 'a1b2c3d', at: '2026-11-26T13:00:00.000Z', contains: [] });
  const cases = [
    { name: 'matching install', manifest: '9f8e7d6', installs: [install('9f8e7d6')], expected: 'Workflow version: 9f8e7d6 (source a1b2c3d)' },
    { name: 'other install', manifest: '9f8e7d6', installs: [install('1111111')], expected: 'Workflow version: 9f8e7d6 (source unknown)' },
    { name: 'no manifest', manifest: undefined, installs: [], expected: 'Workflow version: unknown (source unknown)' },
  ];
  for (const c of cases) {
    const fx = makeFixture({ record: baseRecord({ installs: c.installs }), manifest: c.manifest });
    try {
      const res = fx.finish(PULL);
      ok(res);
      assert.ok(existsSync(fx.summaryFile), `${c.name}: summary file exists`);
      assert.equal(fx.summary().split(/\r?\n/)[1], c.expected, c.name);
    } finally {
      fx.cleanup();
    }
  }
});

test('[R62-17] the Model tokens line sums the Depth tokens, or is zero without tokens', () => {
  const cases = [
    { name: 'tokens', extra: {}, expected: 'Model tokens: 150 read (Depth 1: 120, Depth 2: 30)' },
    { name: 'no tokens', extra: { tokens: undefined }, expected: 'Model tokens: 0 read (Depth 1: 0, Depth 2: 0)' },
  ];
  for (const c of cases) {
    const fx = makeFixture();
    try {
      const res = fx.finish(PULL, c.extra);
      ok(res);
      assert.ok(existsSync(fx.summaryFile), `${c.name}: summary file exists`);
      assert.equal(fx.summary().split(/\r?\n/)[3], c.expected, c.name);
    } finally {
      fx.cleanup();
    }
  }
});

test('[R65-03] the Notices section lists the compact notices, at most 10', () => {
  const two = ['notice: no-conversation-log: Claude Code', 'notice: unknown-record: Claude Code k1 line 12: type "thinking_v9"'];
  const twelve = Array.from({ length: 12 }, (_, i) => `notice: unknown-record: Claude Code k1 line ${i + 2}: type "t${i}"`);

  let fx = makeFixture();
  try {
    ok(fx.finish(PULL, { notices: two }));
    assert.ok(existsSync(fx.summaryFile), 'summary file exists');
    assert.deepEqual(bodyLines(fx.summary()).slice(-3), ['## Notices', `- ${two[0]}`, `- ${two[1]}`]);
  } finally {
    fx.cleanup();
  }

  fx = makeFixture();
  try {
    ok(fx.finish(PULL, { notices: twelve }));
    assert.ok(existsSync(fx.summaryFile), 'summary file exists');
    const lines = bodyLines(fx.summary());
    const at = lines.indexOf('## Notices');
    assert.ok(at >= 0, 'has ## Notices');
    assert.deepEqual(lines.slice(at), [
      '## Notices',
      ...twelve.slice(0, 10).map((n) => `- ${n}`),
      '2 more notices not shown.',
    ]);
  } finally {
    fx.cleanup();
  }
});

test('[R65-04] prepare stores its notices as the last key of the compact record', () => {
  const rows = [['skill.invoked', { name: 'pull-work' }], ['user.message', { content: 'go' }], ['assistant.message', { content: 'ok' }]];
  const out = (fx) => join(fx.root, 'out', 'compact.json');

  let fx = makeFixture();
  try {
    fx.copilotLog('c1', rows);
    const res = fx.exec(['prepare', '--out', out(fx)]);
    ok(res);
    const compact = JSON.parse(readFileSync(out(fx), 'utf8'));
    assert.deepEqual(compact.notices, ['notice: no-conversation-log: Claude Code']);
    assert.equal(Object.keys(compact).at(-1), 'notices');
  } finally {
    fx.cleanup();
  }

  fx = makeFixture();
  try {
    fx.copilotLog('c1', rows);
    fx.claudeLog('k1');
    const res = fx.exec(['prepare', '--out', out(fx)]);
    ok(res);
    const compact = JSON.parse(readFileSync(out(fx), 'utf8'));
    assert.deepEqual(compact.notices, []);
    assert.equal(Object.keys(compact).at(-1), 'notices');
  } finally {
    fx.cleanup();
  }
});

test('[R59-09] an unrecorded install adds a notice to the summary after the compact notices', () => {
  const fx = makeFixture({ record: baseRecord(), manifest: '9f8e7d6' });
  try {
    const res = fx.finish(PULL, { notices: ['notice: no-conversation-log: Claude Code'] });
    ok(res);
    assert.ok(res.lines.includes('notice: unrecorded-install: 9f8e7d6'), res.stdout);
    assert.ok(existsSync(fx.summaryFile), 'summary file exists');
    assert.deepEqual(bodyLines(fx.summary()).slice(-3), [
      '## Notices',
      '- notice: no-conversation-log: Claude Code',
      '- notice: unrecorded-install: 9f8e7d6',
    ]);
  } finally {
    fx.cleanup();
  }
});

test('[R55-04] the Reviewed line counts only pending Handoffs', () => {
  const handoff = (id, state) => ({
    id,
    writingSkill: 'brain-storm',
    usingSkill: 'behavior-spec',
    artifact: '.workflow/sessions/context-2026-11-20-1124.md',
    state,
    writtenAt: '2026-11-20T10:00:00',
  });
  const fx = makeFixture({ record: baseRecord({ handoffs: [handoff('h1', 'pending'), handoff('h2', 'reviewed')] }) });
  try {
    const res = fx.finish(PULL);
    ok(res);
    assert.ok(existsSync(fx.summaryFile), 'summary file exists');
    const line = fx.summary().split(/\r?\n/)[2];
    assert.ok(line.startsWith('Reviewed:'), line);
    assert.ok(line.endsWith('pending Handoffs: 1'), line);
  } finally {
    fx.cleanup();
  }
});

test('[R60-03] finish prints the summary path before the reviewed line and never overwrites a summary', () => {
  const fx = makeFixture();
  try {
    const first = fx.finish(PULL);
    ok(first);
    assert.equal(first.lines.at(-2), `skill-review: summary: ${fx.summaryFile}`);
    assert.match(first.lines.at(-1), /^skill-review: reviewed /);
    const before = fx.summary();

    const second = fx.finish(PULL);
    ok(second);
    const second2 = join(fx.summariesDir, '2026-11-26-1405-Scheduler-2.md');
    assert.equal(second.lines.at(-2), `skill-review: summary: ${second2}`);
    assert.match(second.lines.at(-1), /^skill-review: reviewed /);
    assert.equal(fx.summary(), before, 'first summary unchanged');
    assert.ok(existsSync(second2), 'second summary exists');
    assert.deepEqual(readdirSync(fx.summariesDir).sort(), ['2026-11-26-1405-Scheduler-2.md', SUMMARY_NAME]);
  } finally {
    fx.cleanup();
  }
});

test('[R60-04] a compact record with no uses writes no summary and no ledger', () => {
  const fx = makeFixture();
  try {
    const res = fx.finish([]);
    ok(res);
    assert.ok(!existsSync(fx.summariesDir), 'no summaries folder');
    assert.ok(!existsSync(join(fx.home, 'skill-review', 'ledger.md')), 'no ledger.md');
    assert.ok(!res.lines.some((l) => l.startsWith('skill-review: summary:')), res.stdout);
    assert.equal(res.lines.at(-1), 'skill-review: reviewed 0 skill uses in 0 Conversations');
    assert.equal(readFileSync(fx.recordFile, 'utf8'), JSON.stringify(baseRecord(), null, 2) + '\n');
  } finally {
    fx.cleanup();
  }
});
