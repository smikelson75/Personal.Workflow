import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');
const NOW = '2026-11-26T14:05:00';

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

const PENDING = {
  id: 'h1',
  writingSkill: 'brain-storm',
  usingSkill: 'behavior-spec',
  artifact: '.workflow/sessions/context-2026-11-20-1124.md',
  state: 'pending',
  writtenAt: '2026-11-20T10:00:00',
};
const REVIEWED = {
  id: 'h2',
  writingSkill: 'brain-storm',
  usingSkill: 'behavior-spec',
  artifact: '.workflow/sessions/other-2026-11-19-0900.md',
  state: 'reviewed',
  writtenAt: '2026-11-19T09:00:00',
};

// build() returns fields of the Review Record. The compact record holds one
// brain-storm use, so the run has a use and no Observation part is used.
function makeFixture(build = () => ({})) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p04s04-')));
  const home = join(root, 'home');
  const proj = join(root, 'Scheduler');
  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
  }
  for (const skill of ['pull-work', 'brain-storm', 'skill-review']) {
    put(join(home, '.claude', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  const record = {
    format: 1,
    conversations: {},
    handoffs: [],
    observations: [],
    installs: [],
    nextObservation: 10,
    ...build(),
  };
  put(join(home, 'skill-review', 'review-record.json'), JSON.stringify(record, null, 2) + '\n');
  git(home, 'add', '-A');
  git(home, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');

  const ledgerFile = join(home, 'skill-review', 'ledger.md');
  return {
    root, home, proj, ledgerFile,
    finish() {
      const log = join(root, 'logs', 'c1', 'events.jsonl');
      const rows = [];
      for (let i = 1; i <= 12; i += 1) {
        const row = { type: i === 1 ? 'session.start' : 'user.message', data: { sessionId: 'c1' }, id: `e${i}`, parentId: null };
        if (i === 1) row.timestamp = '2026-11-26T09:00:00.000Z';
        rows.push(JSON.stringify(row));
      }
      put(log, `${rows.join('\n')}\n`);
      const compact = join(root, 'compact.json');
      const judgement = join(root, 'judgement.json');
      put(compact, JSON.stringify({
        project: 'Scheduler',
        conversations: [{ harness: 'Copilot CLI', id: 'c1', file: log, uses: [{ skill: 'brain-storm', start: 2, end: 10, from: 2 }] }],
        tokens: { depth1: 120, depth2: 30 },
        notices: [],
      }, null, 2));
      put(judgement, JSON.stringify({ cases: [] }));
      const env = { ...process.env, WORKFLOW_HOME: home, SKILL_REVIEW_NOW: NOW };
      const res = spawnSync(process.execPath, [CLI, 'finish', compact, judgement], { cwd: proj, encoding: 'utf8', env });
      return { status: res.status, stdout: res.stdout };
    },
    ledger() {
      assert.ok(existsSync(ledgerFile), 'ledger.md was not written');
      return readFileSync(ledgerFile, 'utf8');
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

const linesOf = (text) => text.split(/\r?\n/);

// lines of an entry after its `### <id> <part>` heading, up to the next heading
function entry(text, id, part) {
  const lines = linesOf(text);
  const at = lines.indexOf(`### ${id} ${part}`);
  assert.notEqual(at, -1, `no entry heading "### ${id} ${part}" in:\n${text}`);
  const out = [];
  for (let i = at + 1; i < lines.length && !lines[i].startsWith('#'); i += 1) out.push(lines[i]);
  while (out.length && out[out.length - 1] === '') out.pop();
  return out;
}

// non-blank lines of a `## <name>` section up to the next `## ` heading
function section(text, name) {
  const lines = linesOf(text);
  const at = lines.indexOf(`## ${name}`);
  assert.notEqual(at, -1, `no section "## ${name}" in:\n${text}`);
  const out = [];
  for (let i = at + 1; i < lines.length && !lines[i].startsWith('## '); i += 1) {
    if (lines[i].startsWith('### ')) break;
    if (lines[i] !== '') out.push(lines[i]);
  }
  return out;
}

const ok = (res) => assert.equal(res.status, 0, res.stdout);

test('[R60-12] the Ledger lists one Observation with every field line and its description', () => {
  const fx = makeFixture(() => ({
    observations: [observation('O03', {
      state: 'confirmed', side: 'using', kind: null, label: 'translation miss', cases: 3, chances: 0,
      outcome: 'part change', fixType: 'clarified rule', fixReason: 'A check cannot find this.',
      description: 'The skill asked twice.',
    })],
  }));
  try {
    ok(fx.finish());
    assert.deepEqual(entry(fx.ledger(), 'O03', 'pull-work'), [
      'State: confirmed',
      'Side: using',
      'Miss label: translation miss',
      'Cases: 3',
      'Chances to recur: 0',
      'Outcome: part change',
      'Fix type: clarified rule',
      'Fix reason: A check cannot find this.',
      '',
      'The skill asked twice.',
    ]);
  } finally {
    fx.cleanup();
  }
});

test('[R60-13] the Ledger groups Observations by state in order and ends with Pending Handoffs', () => {
  const states = ['confirmed', 'changed', 'watching', 'improved', 'dismissed'];
  const fx = makeFixture(() => ({
    observations: states.map((state, i) => observation(`O0${i + 1}`, {
      state,
      changeCommit: state === 'changed' ? 'a1b2c3d' : null,
      chances: state === 'improved' ? 2 : 0,
    })),
  }));
  const only = makeFixture(() => ({ observations: [observation('O01', { state: 'confirmed' })] }));
  try {
    ok(fx.finish());
    const lines = linesOf(fx.ledger());
    assert.equal(lines[0], '# Skill Ledger');
    const heads = lines.filter((l) => l.startsWith('## '));
    assert.deepEqual(heads, [...states.map((s) => `## ${s}`), '## Pending Handoffs']);
    states.forEach((s, i) => {
      assert.ok(lines.includes(`### O0${i + 1} pull-work`), `entry O0${i + 1} missing`);
      assert.deepEqual(section(fx.ledger(), s).filter((l) => !l.startsWith('###') && l === 'None.'), []);
    });

    ok(only.finish());
    const text = only.ledger();
    for (const s of ['changed', 'watching', 'improved', 'dismissed']) {
      assert.deepEqual(section(text, s), ['None.'], s);
    }
    assert.deepEqual(section(text, 'Pending Handoffs'), ['None.']);
    const heads2 = linesOf(text).filter((l) => l.startsWith('## '));
    assert.equal(heads2[heads2.length - 1], '## Pending Handoffs');
  } finally {
    fx.cleanup();
    only.cleanup();
  }
});

test('[R59-10] a changed Observation shows whether an install holds its change commit', () => {
  const changed = () => observation('O05', { state: 'changed', changeCommit: 'a1b2c3d', cases: 2 });
  const without = makeFixture(() => ({ observations: [changed()] }));
  const withInstall = makeFixture(() => ({
    observations: [changed()],
    installs: [{ version: '1a2b3c4', source: 'b2c3d4e', at: '2026-11-26T13:00:00.000Z', contains: ['a1b2c3d'] }],
  }));
  try {
    ok(without.finish());
    const a = entry(without.ledger(), 'O05', 'pull-work');
    assert.ok(a.includes('State: changed, not yet installed'), a.join('\n'));
    assert.ok(a.includes('Change commit: a1b2c3d'), a.join('\n'));

    ok(withInstall.finish());
    const b = entry(withInstall.ledger(), 'O05', 'pull-work');
    assert.ok(b.includes('State: changed, installed 1a2b3c4'), b.join('\n'));
    assert.ok(b.includes('Change commit: a1b2c3d'), b.join('\n'));
  } finally {
    without.cleanup();
    withInstall.cleanup();
  }
});

test('[R61-03] the Ledger is built from the Review Record alone and holds every Observation in full', () => {
  const fx = makeFixture(() => ({
    observations: [
      observation('O01', { state: 'confirmed', side: 'writing', kind: null, label: 'capture miss', cases: 2, description: 'The skill skipped a question.' }),
      observation('O02', { state: 'watching', side: 'using', cases: 1, outcome: 'Developer note', fixType: null, fixReason: null, description: 'The Developer corrected a name.' }),
    ],
  }));
  try {
    assert.equal(existsSync(fx.ledgerFile), false);
    assert.equal(existsSync(join(fx.home, 'skill-review', 'summaries')), false);
    ok(fx.finish());
    const text = fx.ledger();
    const a = entry(text, 'O01', 'pull-work');
    assert.deepEqual(a, [
      'State: confirmed', 'Side: writing', 'Miss label: capture miss', 'Cases: 2', 'Chances to recur: 0',
      'Outcome: part change', 'Fix type: clarified rule', 'Fix reason: A check cannot find this.',
      '', 'The skill skipped a question.',
    ]);
    const b = entry(text, 'O02', 'pull-work');
    assert.deepEqual(b, [
      'State: watching', 'Side: using', 'Kind: rule adherence', 'Cases: 1', 'Chances to recur: 0',
      'Outcome: Developer note',
      '', 'The Developer corrected a name.',
    ]);
  } finally {
    fx.cleanup();
  }
});

test('[R60-14] a run rewrites the whole Ledger and drops hand edits', () => {
  const fx = makeFixture(() => ({ observations: [observation('O01', { state: 'watching' })] }));
  try {
    put(fx.ledgerFile, '# Skill Ledger\n\nhand edit\n');
    ok(fx.finish());
    const text = fx.ledger();
    assert.ok(!text.includes('hand edit'), text);
    assert.ok(text.includes('### O01 pull-work'), text);
  } finally {
    fx.cleanup();
  }
});

test('[R55-05] the Ledger lists pending Handoffs with their age in days', () => {
  const fx = makeFixture(() => ({ handoffs: [PENDING, REVIEWED] }));
  const none = makeFixture(() => ({ handoffs: [REVIEWED] }));
  try {
    ok(fx.finish());
    const text = fx.ledger();
    assert.deepEqual(section(text, 'Pending Handoffs'), [
      '- .workflow/sessions/context-2026-11-20-1124.md (brain-storm -> behavior-spec), 6 days',
    ]);
    assert.ok(!text.includes('other-2026-11-19-0900'), text);

    ok(none.finish());
    assert.deepEqual(section(none.ledger(), 'Pending Handoffs'), ['None.']);
  } finally {
    fx.cleanup();
    none.cleanup();
  }
});

test('[R58-27] a dismissed Observation shows its cause and model', () => {
  const fx = makeFixture(() => ({
    observations: [
      observation('O06', { state: 'dismissed', cause: 'model habit', model: 'gpt-5.5' }),
      observation('O08', { state: 'dismissed', cause: 'model habit', model: null }),
    ],
  }));
  try {
    ok(fx.finish());
    const text = fx.ledger();
    assert.ok(entry(text, 'O06', 'pull-work').includes('Cause: model habit (gpt-5.5)'), text);
    assert.ok(entry(text, 'O08', 'pull-work').includes('Cause: model habit'), text);
    assert.ok(!entry(text, 'O08', 'pull-work').some((l) => l.startsWith('Cause: model habit (')), text);
  } finally {
    fx.cleanup();
  }
});

test('[R60-15] an Observation with a kind, no side, and no description lists Kind and Side none only', () => {
  const fx = makeFixture(() => ({
    observations: [observation('O07', {
      state: 'watching', kind: 'token cost', side: null, outcome: 'no action',
      fixType: null, fixReason: null, description: null,
    })],
  }));
  try {
    ok(fx.finish());
    const lines = entry(fx.ledger(), 'O07', 'pull-work');
    assert.ok(lines.includes('Kind: token cost'), lines.join('\n'));
    assert.ok(lines.includes('Side: none'), lines.join('\n'));
    assert.ok(!lines.some((l) => l.startsWith('Miss label:')), lines.join('\n'));
    const fieldLine = /^(State|Side|Kind|Miss label|Cases|Chances to recur|Outcome|Fix type|Fix reason|Change commit|Cause): /;
    const extra = lines.filter((l) => l !== '' && !fieldLine.test(l));
    assert.deepEqual(extra, [], 'description line present');
    assert.ok(!lines.includes('null') && !lines.some((l) => l.includes('null')), lines.join('\n'));
  } finally {
    fx.cleanup();
  }
});
