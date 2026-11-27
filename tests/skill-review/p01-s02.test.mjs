import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cli = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');

let counter = 0;

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout;
}

function initRepo(dir) {
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-b', 'main');
  git(dir, 'config', 'core.autocrlf', 'false');
}

function fixture() {
  counter += 1;
  const base = join(tmpdir(), `sr-${process.pid}-${Date.now()}-${counter}`);
  mkdirSync(base, { recursive: true });
  const root = realpathSync.native(base);
  const home = join(root, 'home');
  const proj = join(root, `proj-${process.pid}-${counter}`);
  const other = join(root, 'other');
  const copilot = join(root, 'copilot');
  const claude = join(root, 'claude');
  for (const repo of [home, proj, other]) initRepo(repo);
  mkdirSync(join(proj, 'sub'), { recursive: true });
  mkdirSync(copilot, { recursive: true });
  mkdirSync(claude, { recursive: true });
  for (const skill of ['pull-work', 'brain-storm', 'skill-review']) {
    mkdirSync(join(home, '.claude', 'skills', skill), { recursive: true });
    writeFileSync(join(home, '.claude', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  const f = { root, home, proj, other, copilot, claude, extraOut: [] };

  // total lines; skills = { lineNumber: skillName }; every other line is a known filler record
  f.log = (id, cwd, total, skills = {}, when = '2026-06-01T00:00:00.000Z') => {
    const out = [];
    for (let n = 1; n <= total; n += 1) {
      let type = 'assistant.message';
      let data = { content: 'x' };
      if (n === 1) {
        type = 'session.start';
        data = { sessionId: id, context: { cwd } };
      } else if (skills[n]) {
        type = 'skill.invoked';
        data = { name: skills[n] };
      }
      out.push(JSON.stringify({ type, data, id: `e${n}`, timestamp: when, parentId: null }));
    }
    const dir = join(copilot, 'session-state', id);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'events.jsonl');
    writeFileSync(file, out.join('\n') + '\n');
    return file;
  };

  f.status = () => ({ home: git(home, 'status', '--porcelain'), proj: git(proj, 'status', '--porcelain') });

  f.run = (args = []) => {
    const res = spawnSync(process.execPath, [cli, 'prepare', ...args], {
      cwd: proj,
      encoding: 'utf8',
      env: {
        ...process.env,
        WORKFLOW_HOME: home,
        SKILL_REVIEW_COPILOT_HOME: copilot,
        SKILL_REVIEW_CLAUDE_HOME: claude,
      },
    });
    const outLines = res.stdout.split(/\r?\n/).filter((l, i, a) => !(l === '' && i === a.length - 1));
    return { status: res.status, stdout: res.stdout, lines: outLines, stderr: res.stderr };
  };

  f.cleanup = () => {
    rmSync(root, { recursive: true, force: true });
    for (const p of f.extraOut) rmSync(p, { force: true });
  };
  return f;
}

function recordPath(res) {
  const last = res.lines[res.lines.length - 1];
  assert.match(last, /^compact-record: .+/);
  const path = last.slice('compact-record: '.length);
  assert.ok(existsSync(path), `compact record file exists: ${path}`);
  return path;
}

function readRecordFile(res) {
  return JSON.parse(readFileSync(recordPath(res), 'utf8'));
}

function simplify(rec) {
  return rec.conversations.map((c) => ({
    harness: c.harness,
    id: c.id,
    uses: c.uses.map((u) => ({ skill: u.skill, start: u.start, end: u.end, from: u.from })),
  }));
}

function standard(f) {
  f.log('c1', f.proj, 8, { 2: 'brain-storm', 5: 'pull-work' });
  f.log('c2', join(f.proj, 'sub'), 3, { 2: 'pull-work' });
}

test('[R52-04] prepare lists Copilot CLI skill uses in the Project Repo and writes the compact record', () => {
  const f = fixture();
  try {
    standard(f);
    const before = f.status();
    const res = f.run();
    f.extraOut.push(join(tmpdir(), `skill-review-${basename(f.proj)}.json`));
    assert.equal(res.status, 0);
    assert.equal(res.lines[res.lines.length - 2], 'skill-review: prepared 3 skill uses in 2 Conversations');
    const path = recordPath(res);
    const rec = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(rec.project, basename(f.proj));
    assert.deepEqual(simplify(rec), [
      {
        harness: 'Copilot CLI',
        id: 'c1',
        uses: [
          { skill: 'brain-storm', start: 2, end: 4, from: 2 },
          { skill: 'pull-work', start: 5, end: 8, from: 5 },
        ],
      },
      { harness: 'Copilot CLI', id: 'c2', uses: [{ skill: 'pull-work', start: 2, end: 3, from: 2 }] },
    ]);
    assert.deepEqual(f.status(), before);
  } finally {
    f.cleanup();
  }
});

test('[R52-05] a Conversation whose working folder is outside the Project Repo is ignored', () => {
  const f = fixture();
  try {
    standard(f);
    f.log('c3', f.other, 6, { 2: 'pull-work' });
    const res = f.run(['--out', join(f.root, 'out.json')]);
    assert.equal(res.status, 0);
    const rec = readRecordFile(res);
    assert.deepEqual(rec.conversations.map((c) => c.id), ['c1', 'c2']);
    assert.equal(res.lines.filter((l) => !l.startsWith('compact-record:')).some((l) => l.includes('c3')), false);
    assert.equal(res.lines[res.lines.length - 2], 'skill-review: prepared 3 skill uses in 2 Conversations');
  } finally {
    f.cleanup();
  }
});

test('[R52-06] the skill-review skill is not listed and ends the previous use', () => {
  const f = fixture();
  try {
    f.log('c1', f.proj, 12, { 2: 'pull-work', 6: 'skill-review', 9: 'brain-storm' });
    const res = f.run(['--out', join(f.root, 'out.json')]);
    assert.equal(res.status, 0);
    assert.equal(res.lines[res.lines.length - 2], 'skill-review: prepared 2 skill uses in 1 Conversations');
    assert.deepEqual(simplify(readRecordFile(res)), [
      {
        harness: 'Copilot CLI',
        id: 'c1',
        uses: [
          { skill: 'pull-work', start: 2, end: 5, from: 2 },
          { skill: 'brain-storm', start: 9, end: 12, from: 9 },
        ],
      },
    ]);
  } finally {
    f.cleanup();
  }
});

test('[R53-02] prepare with a skill name lists only that skill', () => {
  const f = fixture();
  try {
    standard(f);
    const res = f.run(['pull-work', '--out', join(f.root, 'out.json')]);
    assert.equal(res.status, 0);
    assert.equal(res.lines[res.lines.length - 2], 'skill-review: prepared 2 skill uses in 2 Conversations');
    const rec = readRecordFile(res);
    assert.deepEqual(simplify(rec), [
      { harness: 'Copilot CLI', id: 'c1', uses: [{ skill: 'pull-work', start: 5, end: 8, from: 5 }] },
      { harness: 'Copilot CLI', id: 'c2', uses: [{ skill: 'pull-work', start: 2, end: 3, from: 2 }] },
    ]);
    assert.equal(JSON.stringify(rec).includes('brain-storm'), false);
  } finally {
    f.cleanup();
  }
});

test('[R52-07] a Conversation without a skill start is absent from the record and every count', () => {
  const f = fixture();
  try {
    standard(f);
    f.log('c4', f.proj, 7, {});
    const res = f.run(['--out', join(f.root, 'out.json')]);
    assert.equal(res.status, 0);
    assert.equal(res.lines[res.lines.length - 2], 'skill-review: prepared 3 skill uses in 2 Conversations');
    assert.deepEqual(readRecordFile(res).conversations.map((c) => c.id), ['c1', 'c2']);
    assert.equal(res.lines.filter((l) => !l.startsWith('compact-record:')).some((l) => l.includes('c4')), false);
  } finally {
    f.cleanup();
  }
});

test('[R52-08] old and current Conversations are both listed (no time limit)', () => {
  const f = fixture();
  try {
    const oldFile = f.log('c1', f.proj, 4, { 2: 'pull-work' }, '2026-01-01T00:00:00.000Z');
    const old = new Date('2026-01-01T00:00:00.000Z');
    utimesSync(oldFile, old, old);
    f.log('c2', f.proj, 5, { 3: 'pull-work' }, new Date().toISOString());
    const res = f.run(['--out', join(f.root, 'out.json')]);
    assert.equal(res.status, 0);
    assert.equal(res.lines[res.lines.length - 2], 'skill-review: prepared 2 skill uses in 2 Conversations');
    assert.deepEqual(simplify(readRecordFile(res)), [
      { harness: 'Copilot CLI', id: 'c1', uses: [{ skill: 'pull-work', start: 2, end: 4, from: 2 }] },
      { harness: 'Copilot CLI', id: 'c2', uses: [{ skill: 'pull-work', start: 3, end: 5, from: 3 }] },
    ]);
  } finally {
    f.cleanup();
  }
});

test('[R65-02] only the Harness without an in-scope Conversation Log gets a notice', () => {
  const f = fixture();
  try {
    standard(f);
    const res = f.run(['--out', join(f.root, 'out.json')]);
    assert.equal(res.status, 0);
    assert.ok(res.lines.includes('notice: no-conversation-log: Claude Code'));
    assert.equal(res.lines.includes('notice: no-conversation-log: Copilot CLI'), false);
    assert.equal(res.lines.some((l) => l.includes('Copilot CLI') && l.startsWith('notice:')), false);
  } finally {
    f.cleanup();
  }
});
