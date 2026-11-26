import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { repoRoot, tempRepo } from '../../.github/tools/workflow-core/support/harness.mjs';

const SOURCE_FILES = {
  '.github/skills/demo/SKILL.md': '# demo skill\n',
  '.github/agents/demo.agent.md': '# demo agent\n',
  '.github/agents/README.md': '# agents readme\n',
  '.github/hooks/h.mjs': 'export const h = 1;\n',
  '.github/tools/t/run.mjs': 'export const run = 1;\n',
  '.github/tools/t/tests/x.test.mjs': "import 'node:test';\n",
  '.github/user-interaction.md': '# user interaction\n',
  'language-addons/stk/ad/SKILL.md': '# addon\n',
  'home/launch.mjs': 'export const launch = 1;\n',
};

const INSTALLED = [
  '.claude/agents/demo.agent.md',
  '.claude/skills/demo/SKILL.md',
  '.workflow-core/hooks/h.mjs',
  '.workflow-core/language-addons/stk/ad/SKILL.md',
  '.workflow-core/tools/t/run.mjs',
  '.workflow-core/user-interaction.md',
  'launch.mjs',
];

function put(root, rel, text) {
  const target = join(root, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

function fixture() {
  const src = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfsrc-')));
  mkdirSync(join(src, 'scripts'), { recursive: true });
  const real = join(repoRoot, 'scripts', 'update-home.mjs');
  if (existsSync(real)) copyFileSync(real, join(src, 'scripts', 'update-home.mjs'));
  for (const [rel, text] of Object.entries(SOURCE_FILES)) put(src, rel, text);
  const repo = tempRepo();
  const home = realpathSync.native(repo.dir);
  repo.write('AGENTS.md', '# Home\n');
  repo.commit('init');
  return {
    src,
    home,
    repo,
    cleanup() {
      repo.cleanup();
      rmSync(src, { recursive: true, force: true });
    },
  };
}

function update(src, home) {
  const res = spawnSync(process.execPath, [join(src, 'scripts', 'update-home.mjs'), home], { cwd: src, encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

function git(home, ...args) {
  const res = spawnSync('git', ['-C', home, ...args], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  return res.stdout;
}

function status(home) {
  return git(home, 'status', '--porcelain');
}

function excludePath(home) {
  return join(home, '.git', 'info', 'exclude');
}

function ok(res) {
  assert.equal(res.status, 0, `${res.stdout}${res.stderr}`);
}

test('[R37-01] a clean Home Repo with no .gitignore has empty git status after an update', () => {
  const f = fixture();
  try {
    assert.equal(status(f.home), '');
    ok(update(f.src, f.home));
    for (const rel of INSTALLED) assert.ok(existsSync(join(f.home, rel)), `${rel} installed`);
    assert.equal(status(f.home), '');
    assert.equal(existsSync(join(f.home, '.gitignore')), false);
  } finally {
    f.cleanup();
  }
});

test('[R37-02] git status is identical before and after with an untracked and a modified file', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.home, 'notes.txt'), 'my notes\n');
    writeFileSync(join(f.home, 'AGENTS.md'), '# Home\n\nlocal change\n');
    const before = status(f.home);
    assert.match(before, /\?\? notes\.txt/);
    assert.match(before, / M AGENTS\.md/);
    ok(update(f.src, f.home));
    assert.ok(existsSync(join(f.home, '.claude/skills/demo/SKILL.md')));
    assert.equal(status(f.home), before);
  } finally {
    f.cleanup();
  }
});

test('[R37-03] an untracked my-own skill stays listed after two runs', () => {
  const f = fixture();
  try {
    f.repo.write('.claude/skills/keep/SKILL.md', '# keep\n');
    f.repo.commit('add unrelated tracked skill');
    put(f.home, '.claude/skills/my-own/SKILL.md', '# mine\n');
    ok(update(f.src, f.home));
    const first = status(f.home);
    assert.match(first, /my-own/);
    assert.doesNotMatch(first, /demo/);
    assert.doesNotMatch(first, /\.workflow-core/);
    ok(update(f.src, f.home));
    const second = status(f.home);
    assert.match(second, /my-own/);
    assert.doesNotMatch(second, /demo/);
    assert.equal(second, first);
  } finally {
    f.cleanup();
  }
});

test('[R37-04] a user line in .git/info/exclude stays and exactly one managed block exists after two runs', () => {
  const f = fixture();
  try {
    mkdirSync(join(f.home, '.git', 'info'), { recursive: true });
    writeFileSync(excludePath(f.home), '*.log\n');
    ok(update(f.src, f.home));
    ok(update(f.src, f.home));
    const text = readFileSync(excludePath(f.home), 'utf8');
    assert.ok(text.startsWith('*.log\n'), text);
    const lines = text.split(/\r?\n/);
    assert.equal(lines.filter((l) => l === '*.log').length, 1);
    assert.equal(lines.filter((l) => l === '# personal-workflow:begin').length, 1);
    assert.equal(lines.filter((l) => l === '# personal-workflow:end').length, 1);
    const begin = lines.indexOf('# personal-workflow:begin');
    const end = lines.indexOf('# personal-workflow:end');
    assert.ok(begin < end);
    assert.deepEqual(lines.slice(begin + 1, end), INSTALLED.map((p) => `/${p}`));
  } finally {
    f.cleanup();
  }
});

test('[R37-05] a path dropped from the source no longer appears in .git/info/exclude', () => {
  const f = fixture();
  try {
    ok(update(f.src, f.home));
    assert.ok(readFileSync(excludePath(f.home), 'utf8').includes('/.claude/agents/demo.agent.md'));
    rmSync(join(f.src, '.github/agents/demo.agent.md'));
    ok(update(f.src, f.home));
    const text = readFileSync(excludePath(f.home), 'utf8');
    assert.ok(!text.includes('demo.agent.md'), text);
    assert.ok(text.includes('/.claude/skills/demo/SKILL.md'), text);
    assert.equal(status(f.home), '');
  } finally {
    f.cleanup();
  }
});

test('[R37-06] the update changes no tracked file list and makes no commit', () => {
  const f = fixture();
  try {
    const filesBefore = git(f.home, 'ls-files');
    const headBefore = git(f.home, 'rev-parse', 'HEAD');
    const countBefore = git(f.home, 'rev-list', '--count', 'HEAD');
    assert.equal(countBefore.trim(), '1');
    ok(update(f.src, f.home));
    assert.ok(existsSync(join(f.home, 'launch.mjs')));
    assert.equal(git(f.home, 'ls-files'), filesBefore);
    assert.equal(git(f.home, 'rev-parse', 'HEAD'), headBefore);
    assert.equal(git(f.home, 'rev-list', '--count', '--all'), countBefore);
  } finally {
    f.cleanup();
  }
});
