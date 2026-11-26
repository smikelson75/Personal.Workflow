import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT_REL = 'scripts/update-home.mjs';

function tmp(prefix) {
  return realpathSync.native(mkdtempSync(join(tmpdir(), prefix)));
}

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout;
}

// An empty git Home Repo with a committed AGENTS.md that has no Stack line.
function homeRepo() {
  const dir = tmp('p02s05-home-');
  git(dir, 'init', '-b', 'main');
  git(dir, 'config', 'core.autocrlf', 'false');
  writeFileSync(join(dir, 'AGENTS.md'), '# Home\n');
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'home');
  return dir;
}

function runUpdate(scriptAbs, home, { cwd, env } = {}) {
  const res = spawnSync(process.execPath, [scriptAbs, home], {
    cwd: cwd ?? tmpdir(),
    encoding: 'utf8',
    env: env ?? process.env,
  });
  return { status: res.status, stdout: res.stdout, lines: res.stdout.split(/\r?\n/).filter((l) => l !== '') };
}

function isBinary(buf) {
  return buf.includes(0);
}

// Copy this repository's files into dest without .git, converting every text file to CRLF.
// Uses tracked files plus untracked-but-not-ignored ones so the copy matches the working tree
// the real script reads; files deleted from the working tree are skipped.
function crlfCopy(dest) {
  const listed = git(REPO, 'ls-files', '-z', '--cached', '--others', '--exclude-standard')
    .split('\0')
    .filter(Boolean);
  for (const rel of new Set(listed)) {
    const from = join(REPO, rel);
    if (!existsSync(from)) continue;
    const to = join(dest, rel);
    mkdirSync(dirname(to), { recursive: true });
    const buf = readFileSync(from);
    if (isBinary(buf)) {
      copyFileSync(from, to);
    } else {
      const text = buf.toString('utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
      writeFileSync(to, text);
    }
  }
}

test('[Q-version-identity] a git checkout and a git-free CRLF copy print the same Workflow version and Files line', () => {
  const copy = tmp('p02s05-copy-');
  const homeA = homeRepo();
  const homeB = homeRepo();
  try {
    crlfCopy(copy);
    assert.ok(!existsSync(join(copy, '.git')), 'the copy has no .git');
    const a = runUpdate(join(REPO, SCRIPT_REL), homeA);
    const b = runUpdate(join(copy, SCRIPT_REL), homeB);
    assert.equal(a.status, 0, a.stdout);
    assert.equal(b.status, 0, b.stdout);
    assert.equal(a.lines.length, 3, a.stdout);
    assert.equal(b.lines.length, 3, b.stdout);
    assert.match(a.lines[1], /^Workflow version: none -> [0-9a-f]{7}$/);
    assert.match(b.lines[1], /^Workflow version: none -> [0-9a-f]{7}$/);
    assert.equal(b.lines[1], a.lines[1]);
    assert.match(a.lines[2], /^Files: \d+ installed, 0 replaced, 0 removed$/);
    assert.equal(b.lines[2], a.lines[2]);
  } finally {
    rmSync(copy, { recursive: true, force: true });
    rmSync(homeA, { recursive: true, force: true });
    rmSync(homeB, { recursive: true, force: true });
  }
});

test('[Q-offline] the Update Script succeeds with unreachable proxies and contains no network module or fetch', () => {
  const home = homeRepo();
  const work = tmp('p02s05-cwd-');
  try {
    const env = {
      ...process.env,
      HTTP_PROXY: 'http://127.0.0.1:9',
      HTTPS_PROXY: 'http://127.0.0.1:9',
      ALL_PROXY: 'http://127.0.0.1:9',
      http_proxy: 'http://127.0.0.1:9',
      https_proxy: 'http://127.0.0.1:9',
      all_proxy: 'http://127.0.0.1:9',
      GIT_TERMINAL_PROMPT: '0',
    };
    const res = runUpdate(join(REPO, SCRIPT_REL), home, { cwd: work, env });
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.lines.length, 3, res.stdout);
    assert.equal(res.lines[0], `Home Repo: ${home}`);
    assert.match(res.lines[1], /^Workflow version: none -> [0-9a-f]{7}$/);
    assert.match(res.lines[2], /^Files: \d+ installed, 0 replaced, 0 removed$/);

    const src = readFileSync(join(REPO, SCRIPT_REL), 'utf8');
    const networkModule = /(['"`])(?:node:)?(?:http|https|net|dns|tls|dgram)(?:\/[\w/]+)?\1/;
    assert.doesNotMatch(src, networkModule);
    assert.doesNotMatch(src, /\bfetch\s*\(/);
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  }
});
