import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');
const NOW = '2026-11-26T14:05:00';
const WRITTEN_AT = '2026-11-20T10:00:00.000Z';
const BEFORE_WRITE = '2026-11-19T00:00:00Z';
const AFTER_WRITE = '2026-11-22T00:00:00Z';
const ID = 'work-planner:.workflow/plans/x/';
const SECRET = 'SECRET-MESSAGE-TEXT-9141';

function git(cwd, args, extraEnv = {}) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...extraEnv } });
  assert.equal(res.status, 0, `git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout;
}

function put(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

// A markdown file of exactly `size` bytes: `head` (lines starting `## `) then filler.
function sized(head, size, fill = 'x') {
  return head + fill.repeat(size - head.length - 1) + '\n';
}

function commit(dir, message, date) {
  git(dir, ['add', '-A']);
  git(dir, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', message], {
    GIT_COMMITTER_DATE: date,
    GIT_AUTHOR_DATE: date,
  });
}

// opts.reads: [toolName, file under .workflow/plans/x/] in the using use; null for a pull-work use with no read
// opts.commitDate: committer date of the commit that adds the folder
function makeFixture(opts = {}) {
  const reads = opts.reads === undefined ? [['Read', 'plan.md']] : opts.reads;
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p05s03-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  const copilot = join(root, 'copilot');
  const claude = join(root, 'claude');
  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, ['init', '-b', 'main']);
    git(dir, ['config', 'core.autocrlf', 'false']);
  }
  for (const skill of ['pull-work', 'work-planner', 'skill-review']) {
    put(join(home, '.claude', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  mkdirSync(copilot, { recursive: true });
  mkdirSync(claude, { recursive: true });
  git(home, ['add', '-A']);
  git(home, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init']);

  const folder = join(proj, '.workflow', 'plans', 'x');
  put(join(folder, 'plan.md'), sized('## a\n## b\n## c\n', 120));
  put(join(folder, 'phase-01.md'), sized('## p\n', 30));
  commit(proj, 'plans', opts.commitDate ?? BEFORE_WRITE);

  const rows = [
    ['session.start', { sessionId: 'c1', context: { cwd: proj } }, '2026-11-20T09:00:00.000Z'],
    ['skill.invoked', { name: 'work-planner' }, '2026-11-20T09:30:00.000Z'],
    ['assistant.message', { content: SECRET }, '2026-11-20T09:40:00.000Z'],
    ['tool.execution_start', { toolName: 'create', arguments: { path: join(folder, 'phase-01.md') } }, WRITTEN_AT],
    ['skill.invoked', { name: 'pull-work' }, '2026-11-21T08:00:00.000Z'],
  ];
  (reads ?? []).forEach(([toolName, file], i) => {
    rows.push([
      'tool.execution_start',
      { toolName, arguments: { path: join(folder, file) } },
      `2026-11-21T09:0${i}:00.000Z`,
    ]);
  });
  const text = rows
    .map(([type, data, timestamp], i) => JSON.stringify({ type, data, id: `e${i + 1}`, timestamp, parentId: null }))
    .join('\n');
  put(join(copilot, 'session-state', 'c1', 'events.jsonl'), `${text}\n`);

  const env = {
    ...process.env,
    WORKFLOW_HOME: home,
    SKILL_REVIEW_NOW: NOW,
    SKILL_REVIEW_COPILOT_HOME: copilot,
    SKILL_REVIEW_CLAUDE_HOME: claude,
  };
  const compactFile = join(root, 'compact.json');
  return {
    root, home, proj, compactFile, env,
    commitAgain(date) {
      put(join(folder, 'phase-01.md'), sized('## p\n', 30, 'y'));
      commit(proj, 'revise', date);
    },
    prepare() {
      const res = spawnSync(process.execPath, [CLI, 'prepare', '--out', compactFile], { cwd: proj, encoding: 'utf8', env });
      assert.equal(res.status, 0, res.stdout + res.stderr);
      const compact = JSON.parse(readFileSync(compactFile, 'utf8'));
      assert.ok(Array.isArray(compact.handoffs), 'compact record has no handoffs array');
      const entry = compact.handoffs.find((h) => h.id === ID);
      assert.ok(entry, `no entry ${ID} in ${JSON.stringify(compact.handoffs)}`);
      return { compact, entry, stdout: res.stdout };
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

test('[R62-18] entry carries signals {bytes:150, sections:4, revisionsAfterWrite:0, readsInUse:1} and no flags', () => {
  const fx = makeFixture();
  try {
    const { entry } = fx.prepare();
    assert.deepEqual(entry.signals, { bytes: 150, sections: 4, revisionsAfterWrite: 0, readsInUse: 1 });
    assert.deepEqual(entry.flags, []);
    assert.deepEqual(Object.keys(entry), [
      'id', 'writingSkill', 'usingSkill', 'artifact', 'state', 'writtenAt', 'writing', 'using', 'signals', 'flags',
    ]);
  } finally {
    fx.cleanup();
  }
});

test('[R62-19] a commit after writtenAt gives revisionsAfterWrite 1 and artifact-revised; one before gives 0 and no flag', () => {
  const after = makeFixture();
  try {
    after.commitAgain(AFTER_WRITE);
    const { entry } = after.prepare();
    assert.equal(entry.writtenAt, WRITTEN_AT);
    assert.equal(entry.signals.revisionsAfterWrite, 1);
    assert.deepEqual(entry.flags, [{ kind: 'artifact-revised' }]);
  } finally {
    after.cleanup();
  }
  const before = makeFixture();
  try {
    before.commitAgain(BEFORE_WRITE);
    const { entry } = before.prepare();
    assert.equal(entry.signals.revisionsAfterWrite, 0);
    assert.deepEqual(entry.flags, []);
  } finally {
    before.cleanup();
  }
});

test('[R62-20] three reads in the using use give readsInUse 3 and artifact-reread; two give no flag', () => {
  const three = makeFixture({ reads: [['Read', 'plan.md'], ['Read', 'plan.md'], ['view', 'phase-01.md']] });
  try {
    const { entry } = three.prepare();
    assert.equal(entry.signals.readsInUse, 3);
    assert.deepEqual(entry.flags, [{ kind: 'artifact-reread' }]);
  } finally {
    three.cleanup();
  }
  const two = makeFixture({ reads: [['Read', 'plan.md'], ['Read', 'plan.md']] });
  try {
    const { entry } = two.prepare();
    assert.equal(entry.signals.readsInUse, 2);
    assert.deepEqual(entry.flags, []);
  } finally {
    two.cleanup();
  }
});

test('[R62-21] a Handoff with no using end has readsInUse 0 and the other signals set', () => {
  const fx = makeFixture({ reads: null });
  try {
    const { entry } = fx.prepare();
    assert.equal(entry.using, null);
    assert.deepEqual(entry.signals, { bytes: 150, sections: 4, revisionsAfterWrite: 0, readsInUse: 0 });
    assert.deepEqual(entry.flags, []);
  } finally {
    fx.cleanup();
  }
});

test('[R62-22] prepare leaves git status unchanged and entries hold only paths, ids, numbers, and timestamps', () => {
  const fx = makeFixture();
  try {
    const before = git(fx.proj, ['status', '--porcelain']);
    const { compact, entry } = fx.prepare();
    assert.equal(git(fx.proj, ['status', '--porcelain']), before);
    assert.equal(entry.signals.bytes, 150);
    const leaves = [];
    const walk = (v) => {
      if (v !== null && typeof v === 'object') Object.values(v).forEach(walk);
      else leaves.push(v);
    };
    walk(compact.handoffs);
    for (const leaf of leaves) {
      assert.ok(leaf === null || ['string', 'number'].includes(typeof leaf), `unexpected leaf ${leaf}`);
    }
    assert.equal(JSON.stringify(compact.handoffs).includes(SECRET), false);
    assert.deepEqual(Object.keys(entry.signals), ['bytes', 'sections', 'revisionsAfterWrite', 'readsInUse']);
    assert.ok(Array.isArray(entry.flags));
  } finally {
    fx.cleanup();
  }
});
