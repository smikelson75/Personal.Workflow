import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WIN = process.platform === 'win32';
const SKIP = WIN ? false : 'needs Windows .cmd Harness stubs';

function tmp(prefix) {
  return realpathSync.native(mkdtempSync(join(tmpdir(), prefix)));
}

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout;
}

function commitAll(dir, msg) {
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', msg);
}

function put(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

const ADDONS = {
  csharp: ['dotnet-editorconfig', 'stryker-dotnet'],
  'node-javascript': ['eslint-javascript', 'stryker-javascript', 'vitest-javascript'],
  'node-typescript': ['eslint-typescript', 'stryker-typescript', 'vitest-typescript'],
};

// A Home Repo fixture holding the launcher, a complete manifest, add-ons, and the guard.
function homeFixture() {
  const home = tmp('p03s05-home-');
  git(home, 'init', '-b', 'main');
  git(home, 'config', 'core.autocrlf', 'false');
  copyFileSync(join(REPO, 'home', 'launch.mjs'), join(home, 'launch.mjs'));
  put(join(home, 'launch.cmd'), '@node "%~dp0launch.mjs" %*');
  put(join(home, 'AGENTS.md'), '# Home\n');
  for (const [id, skills] of Object.entries(ADDONS)) {
    for (const skill of skills) {
      const link = skill.startsWith('stryker-') ? '\n[protocol](../mutation-testing/protocol.md)\n' : '\n';
      put(join(home, '.workflow-core', 'language-addons', id, skill, 'SKILL.md'), `# ${skill}\n${link}`);
    }
  }
  put(join(home, '.workflow-core', 'language-addons', 'csharp', 'dotnet-editorconfig', 'references', 'BASELINE.md'), '# baseline\n');
  put(join(home, '.workflow-core', 'language-addons', 'mutation-testing', 'protocol.md'), '# protocol\n');
  copyFileSync(
    join(REPO, '.github', 'hooks', 'scripts', 'guard-locked-tests.mjs'),
    (mkdirSync(join(home, '.workflow-core', 'hooks', 'scripts'), { recursive: true }),
    join(home, '.workflow-core', 'hooks', 'scripts', 'guard-locked-tests.mjs')),
  );
  commitAll(home, 'home');
  put(
    join(home, '.git', 'personal-workflow', 'manifest.json'),
    '{"version":"3f9a2c1","status":"complete","files":[]}',
  );
  return home;
}

function projectFixture() {
  const dir = tmp('p03s05-proj-');
  git(dir, 'init', '-b', 'main');
  git(dir, 'config', 'core.autocrlf', 'false');
  put(join(dir, 'AGENTS.md'), '# Project\n\n- Stack: csharp\n');
  put(join(dir, 'src', 'add.mjs'), 'export const add = (a, b) => a + b;\n');
  commitAll(dir, 'project');
  assert.equal(git(dir, 'status', '--porcelain'), '');
  return dir;
}

function stubBin() {
  const bin = tmp('p03s05-bin-');
  for (const name of ['claude', 'copilot']) put(join(bin, `${name}.cmd`), '@node "%~dp0stub.mjs" %*\r\n');
  put(
    join(bin, 'stub.mjs'),
    [
      "import { writeFileSync } from 'node:fs';",
      "import { basename } from 'node:path';",
      'const name = basename(process.argv[1] ?? "x");',
      'const out = process.env.WF_STUB_OUT;',
      "if (out) writeFileSync(out, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), env: process.env.WF_STUB_NAME ?? null }));",
      'process.exit(Number(process.env.WF_STUB_EXIT ?? 0));',
      '',
    ].join('\n'),
  );
  return bin;
}

function envWith(bin, extra = {}) {
  const env = { ...process.env, ...extra };
  const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
  env[key] = `${bin}${delimiter}${env[key] ?? ''}`;
  return env;
}

function launch(home, cwd, env, ...args) {
  const res = spawnSync(process.execPath, [join(home, 'launch.mjs'), ...args], {
    cwd,
    encoding: 'utf8',
    env,
  });
  return { status: res.status, stdout: res.stdout ?? '', lines: (res.stdout ?? '').split(/\r?\n/).filter((l) => l !== '') };
}

function snapshot(root) {
  const out = {};
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out[p.slice(root.length)] = createHash('sha256').update(readFileSync(p)).digest('hex');
    }
  };
  walk(root);
  return out;
}

function cleanup(...dirs) {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

test('[Q-offline] claude launch and version succeed with unreachable proxies; the launcher has no network module or fetch', { skip: SKIP }, () => {
  const home = homeFixture();
  const proj = projectFixture();
  const bin = stubBin();
  const rec = join(bin, 'rec.json');
  try {
    const proxy = 'http://127.0.0.1:9';
    const env = envWith(bin, {
      HTTP_PROXY: proxy,
      HTTPS_PROXY: proxy,
      ALL_PROXY: proxy,
      http_proxy: proxy,
      https_proxy: proxy,
      all_proxy: proxy,
      GIT_TERMINAL_PROMPT: '0',
      WF_STUB_OUT: rec,
    });
    const run = launch(home, proj, env, 'claude');
    assert.equal(run.status, 0, run.stdout);
    assert.ok(run.lines.includes(`Home Repo: ${home}`), run.stdout);
    assert.ok(run.lines.includes('Workflow version: 3f9a2c1'), run.stdout);
    assert.ok(run.lines.includes('Stack: csharp'), run.stdout);
    assert.equal(JSON.parse(readFileSync(rec, 'utf8')).cwd, proj);

    const ver = launch(home, tmpdir(), env, 'version');
    assert.equal(ver.status, 0, ver.stdout);
    assert.deepEqual(ver.lines, ['Workflow version: 3f9a2c1', `Home Repo: ${home}`]);

    const src = readFileSync(join(REPO, 'home', 'launch.mjs'), 'utf8');
    const networkModule = /(['"`])(?:node:)?(?:http|https|net|dns|tls|dgram)(?:\/[\w/]+)?\1/;
    assert.doesNotMatch(src, networkModule);
    assert.doesNotMatch(src, /\bfetch\s*\(/);
  } finally {
    cleanup(home, proj, bin);
  }
});

test('[Q-seamless-relay] switching from claude to copilot is one launcher call each, starts in the Project, and changes nothing', { skip: SKIP }, () => {
  const home = homeFixture();
  const proj = projectFixture();
  const bin = stubBin();
  try {
    const projBefore = snapshot(proj);
    const homeBefore = snapshot(home);
    assert.equal(git(proj, 'status', '--porcelain'), '');

    for (const harness of ['claude', 'copilot']) {
      const rec = join(bin, `${harness}.json`);
      const env = envWith(bin, { WF_STUB_OUT: rec });
      const run = launch(home, proj, env, harness);
      assert.equal(run.status, 0, run.stdout);
      const seen = JSON.parse(readFileSync(rec, 'utf8'));
      assert.equal(seen.cwd, proj, `${harness} stub cwd`);

      assert.deepEqual(snapshot(proj), projBefore, `Project tree after ${harness}`);
      assert.deepEqual(snapshot(home), homeBefore, `Home tree after ${harness}`);
      assert.equal(git(proj, 'status', '--porcelain'), '', `Project status after ${harness}`);
    }
  } finally {
    cleanup(home, proj, bin);
  }
});
