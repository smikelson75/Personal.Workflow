import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, tempRepo } from '../../.github/tools/workflow-core/support/harness.mjs';

const AGENTS = ['coder', 'planner', 'repo-scout', 'test-author', 'test-reviewer', 'code-review'];

const COPILOT_TO_CLAUDE = {
  read: ['Read'],
  search: ['Grep', 'Glob'],
  edit: ['Edit', 'Write'],
  execute: ['Bash'],
  agent: ['Agent'],
  todo: ['TodoWrite'],
};

const COPILOT_NAMES = {
  coder: ['read', 'search', 'edit', 'execute'],
  planner: ['read', 'search', 'edit', 'execute', 'agent', 'todo'],
  'repo-scout': ['read', 'search', 'execute'],
  'test-author': ['read', 'search', 'edit', 'execute'],
  'test-reviewer': ['read', 'search', 'execute'],
  'code-review': ['read', 'search', 'execute'],
};

const agentPath = (name) => join(repoRoot, '.github', 'agents', `${name}.agent.md`);

function readText(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(m, 'no frontmatter block');
  return m[1];
}

function toolsOf(text) {
  const line = frontmatter(text).split('\n').find((l) => /^tools:/.test(l));
  assert.ok(line, 'no tools line in frontmatter');
  const inner = /\[(.*)\]/.exec(line);
  assert.ok(inner, `tools is not a list: ${line}`);
  return [...inner[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

function nameOf(text) {
  const line = frontmatter(text).split('\n').find((l) => /^name:/.test(l));
  assert.ok(line, 'no name line in frontmatter');
  return line.replace(/^name:\s*/, '').replace(/^["']|["']$/g, '').trim();
}

test('[R43-01] each agent keeps its Copilot tool names and adds the mapped Claude Code names', () => {
  for (const name of AGENTS) {
    assert.ok(existsSync(agentPath(name)), `${name}.agent.md missing`);
    const text = readText(agentPath(name));
    assert.equal(nameOf(text), name, `${name}: frontmatter name`);
    const tools = toolsOf(text);
    for (const copilot of COPILOT_NAMES[name]) {
      assert.ok(tools.includes(copilot), `${name}: tools lacks ${copilot}: ${tools}`);
      for (const claude of COPILOT_TO_CLAUDE[copilot]) {
        assert.ok(tools.includes(claude), `${name}: tools lacks ${claude} (from ${copilot}): ${tools}`);
      }
    }
  }
});

test('[R43-02] code-review is read-only and its body states the finding classes and report rules', () => {
  const path = agentPath('code-review');
  assert.ok(existsSync(path), 'code-review.agent.md missing');
  const text = readText(path);
  const tools = toolsOf(text);
  for (const banned of ['edit', 'Edit', 'Write']) {
    assert.equal(tools.includes(banned), false, `tools has ${banned}: ${tools}`);
  }
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '').toLowerCase();
  assert.match(body, /bugs/);
  assert.match(body, /security/);
  assert.match(body, /trust-boundary/);
  assert.match(body, /resource or data loss/);
  assert.match(body, /shared structures/);
  assert.match(body, /later cards/);
  assert.match(body, /high-confidence/);
  assert.match(body, /`none`/);
});

test('[R43-03] the Update Script installs six agent files per form: Copilot equals source, Claude keeps the body with a Claude model alias', () => {
  const repo = tempRepo();
  try {
    const home = realpathSync.native(repo.dir);
    const res = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'update-home.mjs'), home], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    const dir = join(home, '.claude', 'agents');
    assert.ok(existsSync(dir), '.claude/agents missing');
    const expected = AGENTS.map((n) => `${n}.agent.md`).sort();
    assert.deepEqual(readdirSync(dir).sort(), expected);
    const stripFront = (t) => t.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
    for (const name of AGENTS) {
      const source = readText(agentPath(name));
      const copilot = readText(join(home, '.github', 'agents', `${name}.agent.md`));
      assert.equal(copilot, source, `${name}: Copilot form differs from source`);
      const claude = readText(join(dir, `${name}.agent.md`));
      assert.equal(stripFront(claude), stripFront(source), `${name}: Claude body differs from source`);
      const front = claude.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1];
      assert.match(front, /^model:\s*(opus|sonnet|haiku|fable)\s*$/m, `${name}: Claude model alias`);
    }
  } finally {
    repo.cleanup();
  }
});

test('[R43-04] the agents README lists code-review and explains which Harness runs which', () => {
  const text = readText(join(repoRoot, '.github', 'agents', 'README.md'));
  const row = text.split('\n').find((l) => /^\|/.test(l) && l.includes('`code-review`') && l.includes('(./code-review.agent.md)'));
  assert.ok(row, 'no roster row for code-review linking ./code-review.agent.md');
  const flat = text.replace(/\s+/g, ' ');
  assert.match(flat, /Copilot CLI[^.]*built-in `code-review`[^.]*preference/);
  assert.match(flat, /Claude Code[^.]*runs this file/);
});
