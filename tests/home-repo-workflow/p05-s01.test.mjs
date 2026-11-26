import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const SCRIPT = join(repoRoot, '.github/skills/agents-md/scripts/stack-check.mjs');

function put(root, rel, text) {
  const target = join(root, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

function makeRepo() {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfstack-')));
  const git = spawnSync('git', ['init', '-q'], { cwd: dir, encoding: 'utf8' });
  assert.equal(git.status, 0, git.stderr);
  return dir;
}

function snapshot(dir, base = dir, out = {}) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) snapshot(p, base, out);
    else out[relative(base, p)] = readFileSync(p, 'utf8');
  }
  return out;
}

function run(cwd) {
  const res = spawnSync(process.execPath, [SCRIPT], { cwd, encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function withRepo(setup, fn) {
  const dir = makeRepo();
  try {
    setup(dir);
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('[R44-01] a Project Repo whose only manifest is src/App.csproj and with no AGENTS.md gets the bootstrap line for csharp', () => {
  withRepo(
    (d) => put(d, 'src/App.csproj', '<Project Sdk="Microsoft.NET.Sdk"></Project>\n'),
    (d) => {
      const res = run(d);
      assert.equal(res.status, 0, res.stderr);
      assert.equal(res.stdout, '{"mode":"bootstrap","stacks":["csharp"],"stackLine":null,"competing":false}\n');
    },
  );
});

test('[R44-02] package.json and tsconfig.json at the root propose node-typescript', () => {
  withRepo(
    (d) => {
      put(d, 'package.json', '{}\n');
      put(d, 'tsconfig.json', '{}\n');
    },
    (d) => {
      const res = run(d);
      assert.equal(res.status, 0, res.stderr);
      assert.deepEqual(JSON.parse(res.stdout).stacks, ['node-typescript']);
    },
  );
});

test('[R44-03] package.json at the root and no tsconfig.json propose node-javascript', () => {
  withRepo(
    (d) => put(d, 'package.json', '{}\n'),
    (d) => {
      const res = run(d);
      assert.equal(res.status, 0, res.stderr);
      assert.deepEqual(JSON.parse(res.stdout).stacks, ['node-javascript']);
    },
  );
});

test('[R44-04] a Project Repo with no manifest anywhere proposes no stacks and exits 0', () => {
  withRepo(
    (d) => put(d, 'notes.txt', 'nothing here\n'),
    (d) => {
      const res = run(d);
      assert.equal(res.status, 0, res.stderr);
      assert.deepEqual(JSON.parse(res.stdout).stacks, []);
    },
  );
});

test('[R44-05] in a Home Repo the script exits 2 with the refusal message, prints nothing to stdout, and changes no file', () => {
  withRepo(
    (d) => {
      put(d, '.git/personal-workflow/manifest.json', '{"version":"3f9a2c1","status":"complete","files":[]}');
      put(d, 'AGENTS.md', '# Home\n\n- Project: ../app (co-changed)\n');
    },
    (d) => {
      const before = snapshot(d);
      const res = run(d);
      assert.equal(res.status, 2);
      assert.equal(res.stderr.trim(), "the Home Repo's AGENTS.md holds only Project Pointers");
      assert.equal(res.stdout, '');
      assert.deepEqual(snapshot(d), before);
    },
  );
});

test('[R44-06] AGENTS.md with a Stack line plus .github/copilot-instructions.md gives amendment, the stack line, and competing true', () => {
  withRepo(
    (d) => {
      put(d, 'AGENTS.md', '# Project\n\n- Stack: csharp\n');
      put(d, '.github/copilot-instructions.md', '# Instructions\n');
    },
    (d) => {
      const res = run(d);
      assert.equal(res.status, 0, res.stderr);
      const out = JSON.parse(res.stdout);
      assert.equal(out.mode, 'amendment');
      assert.equal(out.stackLine, 'csharp');
      assert.equal(out.competing, true);
    },
  );
});
