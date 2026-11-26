import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { repoRoot, tempRepo } from '../../.github/tools/workflow-core/support/harness.mjs';

const BLOCKED = '.workflow-core/user-interaction.md';

function put(root, rel, text) {
  const target = join(root, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

// A source tree holding the real script plus a small Workflow Core.
function makeSource() {
  const src = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfsrc-')));
  const script = join(repoRoot, 'scripts', 'update-home.mjs');
  if (existsSync(script)) {
    mkdirSync(join(src, 'scripts'), { recursive: true });
    copyFileSync(script, join(src, 'scripts', 'update-home.mjs'));
  }
  put(src, '.github/skills/demo/SKILL.md', '# demo skill\n');
  put(src, '.github/agents/demo.agent.md', '---\nname: demo\n---\nDemo agent\n');
  put(src, '.github/agents/README.md', '# agents readme\n');
  put(src, '.github/hooks/h.mjs', 'export const h = 1;\n');
  put(src, '.github/tools/t/run.mjs', 'export const run = 1;\n');
  put(src, '.github/tools/t/tests/x.test.mjs', "// not installed\n");
  put(src, '.github/user-interaction.md', '# user interaction\n');
  put(src, 'language-addons/stk/ad/SKILL.md', '# addon\n');
  put(src, 'home/launch.mjs', 'export const launch = 1;\n');
  return src;
}

function makeHome() {
  const repo = tempRepo();
  repo.write('AGENTS.md', '# Home\n');
  repo.commit('home');
  return { repo, dir: realpathSync.native(repo.dir) };
}

function update(src, home, cwd) {
  const res = spawnSync(process.execPath, [join(src, 'scripts', 'update-home.mjs'), home], {
    cwd,
    encoding: 'utf8',
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

function outLines(res) {
  return res.stdout.split(/\r?\n/).filter((l) => l.length > 0);
}

function manifest(home) {
  const res = spawnSync('git', ['-C', home, 'rev-parse', '--git-path', 'personal-workflow'], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  const file = join(resolve(home, res.stdout.trim()), 'manifest.json');
  assert.ok(existsSync(file), `manifest missing at ${file}`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

function block(home) {
  put(home, `${BLOCKED}/keep.txt`, 'blocker\n');
}

function unblock(home) {
  rmSync(join(home, BLOCKED), { recursive: true, force: true });
}

function versionOf(res) {
  const m = /^Workflow version: \S+ -> ([0-9a-f]{7})$/m.exec(res.stdout);
  assert.ok(m, `no version line in: ${res.stdout}`);
  return m[1];
}

function cleanInstallVersion(src) {
  const { repo, dir } = makeHome();
  try {
    const res = update(src, dir, dir);
    assert.equal(res.status, 0, res.stdout);
    return versionOf(res);
  } finally {
    repo.cleanup();
  }
}

function withFixture(fn) {
  const src = makeSource();
  const { repo, dir: home } = makeHome();
  try {
    fn({ src, home });
  } finally {
    repo.cleanup();
    rmSync(src, { recursive: true, force: true });
  }
}

test('[R36-17] a blocked write ends with copy-failed naming the path and exit 1', () => {
  withFixture(({ src, home }) => {
    block(home);
    const res = update(src, home, home);
    assert.equal(res.status, 1);
    const lines = outLines(res);
    assert.equal(lines[lines.length - 1], `update failed: copy-failed: ${BLOCKED}`);
    assert.equal(readFileSync(join(home, 'AGENTS.md'), 'utf8'), '# Home\n');
  });
});

test('[R36-18] after a copy-failed run the manifest status is incomplete', () => {
  withFixture(({ src, home }) => {
    block(home);
    const res = update(src, home, home);
    assert.equal(res.status, 1);
    assert.equal(manifest(home).status, 'incomplete');
  });
});

test('[R36-19] a rerun after removing the blocker completes with the clean-install version', () => {
  withFixture(({ src, home }) => {
    const clean = cleanInstallVersion(src);
    block(home);
    assert.equal(update(src, home, home).status, 1);
    unblock(home);
    const res = update(src, home, home);
    assert.equal(res.status, 0, res.stdout);
    const m = manifest(home);
    assert.equal(m.status, 'complete');
    assert.equal(m.version, clean);
    assert.match(clean, /^[0-9a-f]{7}$/);
    assert.equal(readFileSync(join(home, BLOCKED), 'utf8'), '# user interaction\n');
  });
});

test('[R36-20] a failed run keeps the previous version and the next success reports it as old', () => {
  withFixture(({ src, home }) => {
    const first = update(src, home, home);
    assert.equal(first.status, 0, first.stdout);
    const v = versionOf(first);
    assert.equal(manifest(home).status, 'complete');

    put(src, '.github/skills/demo/SKILL.md', '# demo skill changed\n');
    rmSync(join(home, BLOCKED), { force: true });
    block(home);
    const failed = update(src, home, home);
    assert.equal(failed.status, 1);
    const lines = outLines(failed);
    assert.equal(lines[lines.length - 1], `update failed: copy-failed: ${BLOCKED}`);
    const m = manifest(home);
    assert.equal(m.version, v);
    assert.equal(m.status, 'incomplete');

    unblock(home);
    const next = update(src, home, home);
    assert.equal(next.status, 0, next.stdout);
    const w = versionOf(next);
    assert.notEqual(w, v);
    assert.ok(next.stdout.split(/\r?\n/).includes(`Workflow version: ${v} -> ${w}`), next.stdout);
    assert.equal(manifest(home).status, 'complete');
    assert.equal(manifest(home).version, w);
  });
});
