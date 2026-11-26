import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, tempRepo } from '../../.github/tools/workflow-core/support/harness.mjs';

const AGENTS_DIR = join(repoRoot, '.github', 'agents');
const SKILLS_DIR = join(repoRoot, '.github', 'skills');

function agentFiles() {
  return readdirSync(AGENTS_DIR)
    .filter((n) => n.endsWith('.agent.md'))
    .sort();
}

function agentNames() {
  return agentFiles().map((n) => n.replace(/\.agent\.md$/, ''));
}

function walkMd(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkMd(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

function frontmatter(text) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, 'file has frontmatter');
  return m[1].split('\n');
}

function runReal() {
  const repo = tempRepo();
  repo.write('AGENTS.md', '# Home\n\n- Pointer: see notes\n');
  repo.commit('init');
  const home = realpathSync.native(repo.dir);
  const res = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'update-home.mjs'), home], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return { repo, home, status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

test('[R48-17] no line that dispatches a Workflow Core agent mentions model or effort', () => {
  const names = agentNames();
  assert.ok(names.length > 0, 'source has Workflow Core agents');
  const files = [...walkMd(SKILLS_DIR), ...agentFiles().map((n) => join(AGENTS_DIR, n))];
  assert.ok(files.length > 0, 'source has skill and agent files');
  const offenders = [];
  for (const file of files) {
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (!/dispatch/i.test(line)) return;
        if (!names.some((n) => line.includes(n))) return;
        if (/\b(model|effort)\b/i.test(line)) offenders.push(`${file}:${i + 1}: ${line}`);
      });
  }
  assert.deepEqual(offenders, []);
});

test('[R49-02] every agent file has a model list and a reasoning-effort line and no effort, claude-model, or tier key', () => {
  const files = agentFiles();
  assert.ok(files.length > 0, 'source has Workflow Core agents');
  for (const name of files) {
    const fm = frontmatter(readFileSync(join(AGENTS_DIR, name), 'utf8'));
    const keys = fm.filter((l) => /^[A-Za-z][\w-]*:/.test(l)).map((l) => l.split(':')[0]);
    assert.ok(keys.includes('model'), `${name} has model`);
    const at = fm.findIndex((l) => /^model:\s*$/.test(l));
    assert.ok(at >= 0, `${name} model is a list`);
    assert.ok(
      fm.slice(at + 1).some((l) => /^\s+-\s+\S/.test(l)),
      `${name} model list has an entry`,
    );
    assert.ok(
      fm.some((l) => /^reasoning-effort:\s*\S/.test(l)),
      `${name} has reasoning-effort`,
    );
    for (const bad of ['effort', 'claude-model', 'tier']) {
      assert.ok(!keys.includes(bad), `${name} has no ${bad} key`);
    }
  }
});

test('[R49-03] real Update Script run leaves every Home .github/agents/*.agent.md equal to its source byte for byte', () => {
  const run = runReal();
  try {
    assert.equal(run.status, 0, run.stderr);
    for (const name of agentFiles()) {
      const dest = join(run.home, '.github', 'agents', name);
      assert.ok(existsSync(dest), `Home has .github/agents/${name}`);
      assert.ok(
        readFileSync(dest).equals(readFileSync(join(AGENTS_DIR, name))),
        `${name} equals source byte for byte`,
      );
    }
  } finally {
    run.repo.cleanup();
  }
});

test('[R50-08] real Update Script run into a Home with every agent in range prints no Agent default or Agent pin line', () => {
  const run = runReal();
  try {
    assert.equal(run.status, 0, run.stderr);
    const lines = run.stdout.split(/\r?\n/);
    assert.deepEqual(lines.filter((l) => /^Agent default:/.test(l)), []);
    assert.deepEqual(lines.filter((l) => /^Agent pin:/.test(l)), []);
    const claudeDir = join(run.home, '.claude', 'agents');
    assert.ok(existsSync(claudeDir), 'Home has .claude/agents');
    const installed = readdirSync(claudeDir).filter((n) => n.endsWith('.agent.md'));
    assert.deepEqual(installed.sort(), agentFiles());
    for (const name of installed) {
      const text = readFileSync(join(claudeDir, name), 'utf8');
      assert.match(text, /^model: (opus|sonnet|haiku|fable)\s*$/m, `${name} has a model alias line`);
    }
  } finally {
    run.repo.cleanup();
  }
});
