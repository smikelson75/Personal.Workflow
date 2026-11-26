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
import { dirname, join } from 'node:path';
import { repoRoot, tempRepo } from '../../.github/tools/workflow-core/support/harness.mjs';

const AGENTS = '# Home\n\n- Pointer: see notes\n';

function put(root, rel, text) {
  const target = join(root, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

function agent(name, entries, effort = 'medium') {
  const list = entries.map((e) => `  - ${e}\n`).join('');
  return `---\nname: ${name}\ndescription: "x"\nmodel:\n${list}reasoning-effort: ${effort}\n---\nBody of ${name}\n`;
}

function makeSource(agents) {
  const src = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfsrc-')));
  const realScript = join(repoRoot, 'scripts', 'update-home.mjs');
  if (existsSync(realScript)) {
    mkdirSync(join(src, 'scripts'), { recursive: true });
    copyFileSync(realScript, join(src, 'scripts', 'update-home.mjs'));
  }
  const agentsModule = join(repoRoot, 'scripts', 'agent-pins.mjs');
  if (existsSync(agentsModule)) {
    copyFileSync(agentsModule, join(src, 'scripts', 'agent-pins.mjs'));
  }
  put(src, '.github/skills/demo/SKILL.md', 'line one\nline two\n');
  put(src, '.github/hooks/h.mjs', 'export const hook = 1;\n');
  put(src, '.github/tools/t/run.mjs', 'export const run = 1;\n');
  put(src, '.github/user-interaction.md', '# user interaction\n');
  put(src, 'language-addons/stk/ad/SKILL.md', '# add-on skill\n');
  put(src, 'home/launch.mjs', 'export const launch = 1;\n');
  for (const [name, text] of Object.entries(agents)) put(src, `.github/agents/${name}.agent.md`, text);
  return src;
}

function makeHome() {
  const repo = tempRepo();
  repo.write('AGENTS.md', AGENTS);
  repo.commit('init');
  return { repo, dir: realpathSync.native(repo.dir) };
}

function update(src, home) {
  const res = spawnSync(process.execPath, [join(src, 'scripts', 'update-home.mjs'), home], {
    cwd: src,
    encoding: 'utf8',
  });
  const out = (res.stdout ?? '').split(/\r?\n/);
  while (out.length && out[out.length - 1] === '') out.pop();
  return { status: res.status, lines: out, stdout: res.stdout ?? '' };
}

function scenario(agents, fn) {
  const src = makeSource(agents);
  const { repo, dir } = makeHome();
  try {
    fn({ src, home: dir });
  } finally {
    repo.cleanup();
    rmSync(src, { recursive: true, force: true });
  }
}

const skip = (entry) => `Agent pin: ${entry.agent}: skipped "${entry.text}" (not a Claude Code model family)`;
const note = (agentName, text) => skip({ agent: agentName, text });

test('[R48-07] an unknown Claude family is skipped with a notice and the next Claude entry decides', () => {
  scenario(
    {
      coder: agent('coder', ['GPT-6 Luna (copilot)', 'Claude Nova 1 (copilot)', 'Claude Sonnet 5 (copilot)']),
    },
    ({ src, home }) => {
      const res = update(src, home);
      assert.equal(res.status, 0, res.stdout);
      assert.equal(res.lines[3], 'Agent pin: coder: skipped "Claude Nova 1 (copilot)" (not a Claude Code model family)', res.stdout);
      const claude = readFileSync(join(home, '.claude/agents/coder.agent.md'), 'utf8');
      assert.match(claude, /^model: sonnet$/m);
    },
  );
});

test('[R48-08] notice lines follow Files sorted by agent name, each agent in list order', () => {
  scenario(
    {
      'repo-scout': agent('repo-scout', [
        'Claude Nova 1 (copilot)',
        'Claude Zeta 2 (copilot)',
        'Claude Haiku 5.5 (copilot)',
      ], 'low'),
      coder: agent('coder', ['Claude Nova 1 (copilot)', 'Claude Sonnet 5 (copilot)']),
    },
    ({ src, home }) => {
      const res = update(src, home);
      assert.equal(res.status, 0, res.stdout);
      assert.match(res.lines[2], /^Files: /);
      assert.deepEqual(res.lines.slice(3), [
        note('coder', 'Claude Nova 1 (copilot)'),
        note('repo-scout', 'Claude Nova 1 (copilot)'),
        note('repo-scout', 'Claude Zeta 2 (copilot)'),
      ]);
    },
  );
});

test('[R48-09] a second run with the same source prints the same notice lines and exits 0', () => {
  scenario(
    {
      coder: agent('coder', ['Claude Nova 1 (copilot)', 'Claude Sonnet 5 (copilot)']),
    },
    ({ src, home }) => {
      const first = update(src, home);
      assert.equal(first.status, 0, first.stdout);
      assert.deepEqual(first.lines.slice(3), [note('coder', 'Claude Nova 1 (copilot)')], first.stdout);
      const second = update(src, home);
      assert.equal(second.status, 0, second.stdout);
      assert.equal(second.lines[2], 'Files: 0 installed, 0 replaced, 0 removed');
      assert.deepEqual(second.lines.slice(3), [note('coder', 'Claude Nova 1 (copilot)')], second.stdout);
    },
  );
});

test('[R48-10] a word that only starts with Claude is not a Claude entry and prints no notice', () => {
  scenario(
    {
      coder: agent('coder', ['GPT-6 Luna (copilot)', 'Claudette 1', 'Claude Haiku 5.5 (copilot)']),
    },
    ({ src, home }) => {
      const res = update(src, home);
      assert.equal(res.status, 0, res.stdout);
      assert.equal(res.stdout.includes('Agent pin:'), false, res.stdout);
      assert.equal(res.lines.length, 3, res.stdout);
      const claude = readFileSync(join(home, '.claude/agents/coder.agent.md'), 'utf8');
      assert.match(claude, /^model: haiku$/m);
    },
  );
});
