import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { repoRoot, tempRepo } from '../../.github/tools/workflow-core/support/harness.mjs';

const USAGE = 'usage: node scripts/update-home.mjs <home-repo-path>';

const INSTALLED = [
  '.claude/skills/demo/SKILL.md',
  '.claude/agents/demo.agent.md',
  '.github/agents/demo.agent.md',
  '.workflow-core/hooks/h.mjs',
  '.workflow-core/tools/t/run.mjs',
  '.workflow-core/user-interaction.md',
  '.workflow-core/language-addons/stk/ad/SKILL.md',
  'launch.mjs',
];

function put(root, rel, text) {
  const target = join(root, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

// A source tree: the real script copied in (when it exists), plus the S01 fixture content.
function makeSource({ omit = [] } = {}) {
  const src = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfsrc-')));
  const real = join(repoRoot, 'scripts', 'update-home.mjs');
  if (existsSync(real)) {
    mkdirSync(join(src, 'scripts'), { recursive: true });
    copyFileSync(real, join(src, 'scripts', 'update-home.mjs'));
  }
  const content = {
    '.github/skills/demo/SKILL.md': '# demo skill\n',
    '.github/agents/demo.agent.md': '---\nname: demo\n---\nDemo agent\n',
    '.github/agents/README.md': '# agents readme\n',
    '.github/hooks/h.mjs': 'export const h = 1;\n',
    '.github/tools/t/run.mjs': 'export const run = 1;\n',
    '.github/tools/t/tests/x.test.mjs': "import 'node:test';\n",
    '.github/user-interaction.md': '# user interaction\n',
    'language-addons/stk/ad/SKILL.md': '# addon\n',
    'home/launch.mjs': 'export const launch = 1;\n',
  };
  for (const [rel, text] of Object.entries(content)) {
    if (omit.some((o) => rel === o || rel.startsWith(`${o}/`))) continue;
    put(src, rel, text);
  }
  return src;
}

function makeHome() {
  const repo = tempRepo();
  repo.write('AGENTS.md', '# Home\n');
  repo.commit('home');
  return { repo, dir: realpathSync.native(repo.dir) };
}

function makeOutside() {
  return realpathSync.native(mkdtempSync(join(tmpdir(), 'wfplain-')));
}

function update(src, args, cwd) {
  const res = spawnSync(process.execPath, [join(src, 'scripts', 'update-home.mjs'), ...args], {
    cwd,
    encoding: 'utf8',
  });
  return { status: res.status, stdout: res.stdout ?? '' };
}

function outLines(res) {
  return res.stdout.split(/\r?\n/).filter((l) => l.length > 0);
}

function porcelain(dir) {
  const res = spawnSync('git', ['-C', dir, 'status', '--porcelain'], { encoding: 'utf8' });
  return res.stdout;
}

// All files outside .git, with content, plus the git metadata the Update Script may write.
function snapshot(dir) {
  const out = {};
  const walk = (abs, rel) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (rel === '' && entry.name === '.git') continue;
      const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        out[`${childRel}/`] = 'dir';
        walk(join(abs, entry.name), childRel);
      } else {
        out[childRel] = readFileSync(join(abs, entry.name)).toString('base64');
      }
    }
  };
  walk(dir, '');
  const git = join(dir, '.git');
  if (existsSync(git)) {
    out['.git/personal-workflow'] = existsSync(join(git, 'personal-workflow'));
    const exclude = join(git, 'info', 'exclude');
    out['.git/info/exclude'] = existsSync(exclude) ? readFileSync(exclude).toString('base64') : null;
  }
  return out;
}

function assertFailure(res, expectedLine) {
  assert.equal(res.status, 1, res.stdout);
  assert.deepEqual(outLines(res), [expectedLine]);
}

function assertNothingChanged(home, before, statusBefore) {
  assert.equal(porcelain(home), statusBefore);
  assert.equal(existsSync(join(home, '.git', 'personal-workflow')), false);
  assert.equal(existsSync(join(home, '.git', 'personal-workflow', 'manifest.json')), false);
  assert.deepEqual(snapshot(home), before);
}

function assertNoInstalledPaths(home, except = []) {
  for (const rel of INSTALLED) {
    if (except.includes(rel)) continue;
    assert.equal(existsSync(join(home, rel)), false, `${rel} must not exist`);
  }
}

test('[R36-10] no argument prints missing-home-path then the usage line and exits 1', () => {
  const src = makeSource();
  const { repo, dir } = makeHome();
  try {
    const before = snapshot(dir);
    const status = porcelain(dir);
    const res = update(src, [], dir);
    assert.equal(res.status, 1, res.stdout);
    const lines = outLines(res);
    assert.ok(lines[0]?.startsWith('update failed: missing-home-path:'), res.stdout);
    assert.ok(lines.slice(1).some((l) => l.startsWith(USAGE)), res.stdout);
    assertNothingChanged(dir, before, status);
    assertNoInstalledPaths(dir);
  } finally {
    repo.cleanup();
    rmSync(src, { recursive: true, force: true });
  }
});

test('[R36-11] a missing path or a file path prints home-not-found with the argument as given', () => {
  const src = makeSource();
  const { repo, dir } = makeHome();
  const outside = makeOutside();
  try {
    const before = snapshot(dir);
    const status = porcelain(dir);
    const nope = join(outside, 'nope');
    assertFailure(update(src, [nope], dir), `update failed: home-not-found: ${nope}`);
    const file = join(dir, 'AGENTS.md');
    assertFailure(update(src, [file], dir), `update failed: home-not-found: ${file}`);
    assert.equal(existsSync(nope), false);
    assertNothingChanged(dir, before, status);
    assertNoInstalledPaths(dir);
  } finally {
    repo.cleanup();
    rmSync(src, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('[R36-12] a folder that is not a git repository, or a sub-folder of one, prints home-not-git', () => {
  const src = makeSource();
  const { repo, dir } = makeHome();
  const outside = makeOutside();
  try {
    const plain = join(outside, 'plain');
    mkdirSync(plain);
    const sub = join(dir, 'sub');
    mkdirSync(sub);
    const before = snapshot(dir);
    const status = porcelain(dir);
    assertFailure(update(src, [plain], dir), `update failed: home-not-git: ${plain}`);
    assertFailure(update(src, [sub], dir), `update failed: home-not-git: ${sub}`);
    assert.deepEqual(readdirSync(plain), []);
    assertNothingChanged(dir, before, status);
    assertNoInstalledPaths(dir);
  } finally {
    repo.cleanup();
    rmSync(src, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('[R36-13] the source root, or a folder inside it, prints home-is-source and writes nothing', () => {
  const src = makeSource();
  const init = spawnSync('git', ['init', '-b', 'main', src], { encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr);
  const { repo, dir } = makeHome();
  try {
    const srcBefore = snapshot(src);
    const srcStatus = porcelain(src);
    const homeBefore = snapshot(dir);
    const homeStatus = porcelain(dir);
    const inside = join(src, '.github', 'skills');
    assertFailure(update(src, [src], dir), `update failed: home-is-source: ${src}`);
    assertFailure(update(src, [inside], dir), `update failed: home-is-source: ${inside}`);
    assert.equal(porcelain(src), srcStatus);
    assert.deepEqual(snapshot(src), srcBefore);
    assert.equal(existsSync(join(src, '.claude')), false);
    assert.equal(existsSync(join(src, '.workflow-core')), false);
    assertNothingChanged(dir, homeBefore, homeStatus);
  } finally {
    repo.cleanup();
    rmSync(src, { recursive: true, force: true });
  }
});

test('[R36-14] a Home AGENTS.md with a Stack line prints home-is-project; without one it installs', () => {
  const src = makeSource();
  const { repo, dir } = makeHome();
  const clean = makeHome();
  try {
    repo.write('AGENTS.md', '# Project\n\n- Stack: csharp\n');
    repo.commit('project');
    const before = snapshot(dir);
    const status = porcelain(dir);
    assertFailure(update(src, [dir], dir), `update failed: home-is-project: ${join(dir, 'AGENTS.md')}`);
    assertNothingChanged(dir, before, status);
    assertNoInstalledPaths(dir);

    clean.repo.write('AGENTS.md', '# Home\n\nNotes about the home folder.\n');
    clean.repo.commit('notes');
    const ok = update(src, [clean.dir], clean.dir);
    assert.equal(ok.status, 0, ok.stdout);
    assert.ok(outLines(ok).includes('Files: 8 installed, 0 replaced, 0 removed'), ok.stdout);
    for (const rel of INSTALLED) assert.equal(existsSync(join(clean.dir, rel)), true, `${rel} must exist`);
  } finally {
    repo.cleanup();
    clean.repo.cleanup();
    rmSync(src, { recursive: true, force: true });
  }
});

test('[R36-15] a source without language-addons or .github/skills prints incomplete-source and writes nothing', () => {
  const { repo, dir } = makeHome();
  const noAddons = makeSource({ omit: ['language-addons'] });
  const noSkills = makeSource({ omit: ['.github/skills'] });
  try {
    const before = snapshot(dir);
    const status = porcelain(dir);
    assertFailure(update(noAddons, [dir], dir), 'update failed: incomplete-source: language-addons');
    assertNothingChanged(dir, before, status);
    assertNoInstalledPaths(dir);
    assertFailure(update(noSkills, [dir], dir), 'update failed: incomplete-source: .github/skills');
    assertNothingChanged(dir, before, status);
    assertNoInstalledPaths(dir);
  } finally {
    repo.cleanup();
    rmSync(noAddons, { recursive: true, force: true });
    rmSync(noSkills, { recursive: true, force: true });
  }
});

test('[R36-16] tracked workflow files print tracked-workflow-files, sorted and joined by ", ", and nothing is written', () => {
  const src = makeSource();
  const one = makeHome();
  const two = makeHome();
  try {
    one.repo.write('.claude/skills/demo/SKILL.md', '# mine\n');
    one.repo.commit('tracked');
    const beforeOne = snapshot(one.dir);
    const statusOne = porcelain(one.dir);
    assertFailure(
      update(src, [one.dir], one.dir),
      'update failed: tracked-workflow-files: .claude/skills/demo/SKILL.md',
    );
    assertNothingChanged(one.dir, beforeOne, statusOne);
    assertNoInstalledPaths(one.dir, ['.claude/skills/demo/SKILL.md']);

    two.repo.write('.workflow-core/user-interaction.md', '# mine\n');
    two.repo.write('.claude/skills/demo/SKILL.md', '# mine\n');
    two.repo.commit('tracked');
    const beforeTwo = snapshot(two.dir);
    const statusTwo = porcelain(two.dir);
    assertFailure(
      update(src, [two.dir], two.dir),
      'update failed: tracked-workflow-files: .claude/skills/demo/SKILL.md, .workflow-core/user-interaction.md',
    );
    assertNothingChanged(two.dir, beforeTwo, statusTwo);
    assertNoInstalledPaths(two.dir, ['.claude/skills/demo/SKILL.md', '.workflow-core/user-interaction.md']);
  } finally {
    one.repo.cleanup();
    two.repo.cleanup();
    rmSync(src, { recursive: true, force: true });
  }
});
