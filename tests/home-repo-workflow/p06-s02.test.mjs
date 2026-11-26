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

// model: array of entries -> list form; string -> single inline value
function agentSource(name, model, effort, body = `Body of ${name}\n\nSecond paragraph.\n`) {
  const modelLines = Array.isArray(model)
    ? `model:\n${model.map((m) => `  - ${m}`).join('\n')}\n`
    : `model: ${model}\n`;
  return `---\nname: ${name}\ndescription: "x"\n${modelLines}reasoning-effort: ${effort}\n---\n${body}`;
}

function claudeForm(name, alias, effort, body = `Body of ${name}\n\nSecond paragraph.\n`) {
  return `---\nname: ${name}\ndescription: "x"\nmodel: ${alias}\neffort: ${effort}\n---\n${body}`;
}

function makeSource(agents) {
  const src = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfsrc-')));
  const realScript = join(repoRoot, 'scripts', 'update-home.mjs');
  if (existsSync(realScript)) {
    mkdirSync(join(src, 'scripts'), { recursive: true });
    copyFileSync(realScript, join(src, 'scripts', 'update-home.mjs'));
  }
  const agentsAgent = realScript && existsSync(join(repoRoot, 'scripts', 'agent-pins.mjs'));
  if (agentsAgent) copyFileSync(join(repoRoot, 'scripts', 'agent-pins.mjs'), join(src, 'scripts', 'agent-pins.mjs'));
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
  return { status: res.status, lines: out, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
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

const readCopilot = (home, n) => readFileSync(join(home, '.github/agents', `${n}.agent.md`), 'utf8');
const readClaude = (home, n) => readFileSync(join(home, '.claude/agents', `${n}.agent.md`), 'utf8');

test('[R49-01] the Copilot form equals the source byte for byte', () => {
  const source = agentSource(
    'coder',
    ['GPT-6 Luna (copilot)', 'Claude Haiku 5.5 (copilot)', 'Gemini 3.8 Flash (copilot)'],
    'medium',
  );
  scenario({ coder: source }, ({ src, home }) => {
    const res = update(src, home);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(readCopilot(home, 'coder'), source);
  });
});

test('[R48-01] the Claude form has the alias and effort and keeps everything else', () => {
  const source = agentSource('repo-scout', ['Claude Haiku 5.5 (copilot)', 'GPT-6 Luna (copilot)'], 'low');
  scenario({ 'repo-scout': source }, ({ src, home }) => {
    const res = update(src, home);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const form = readClaude(home, 'repo-scout');
    const lines = form.split('\n');
    assert.ok(lines.includes('model: haiku'), form);
    assert.ok(lines.includes('effort: low'), form);
    assert.ok(!/reasoning-effort/.test(form), form);
    assert.ok(!/Claude Haiku/.test(form), form);
    assert.ok(!/GPT-6 Luna/.test(form), form);
    assert.ok(lines.includes('name: repo-scout'), form);
    assert.ok(lines.includes('description: "x"'), form);
    assert.equal(form, claudeForm('repo-scout', 'haiku', 'low'));
  });
});

test('[R48-02] a Claude Opus entry at high gives opus and high', () => {
  const source = agentSource('planner', ['Claude Opus 5.5 (copilot)'], 'high');
  scenario({ planner: source }, ({ src, home }) => {
    const res = update(src, home);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(readClaude(home, 'planner'), claudeForm('planner', 'opus', 'high'));
  });
});

test('[R48-03] suffixes, lower case, and a single-string model resolve to opus, sonnet, fable', () => {
  const agents = {
    a: agentSource('a', ['Claude Opus 4.8 Fast (copilot)'], 'medium'),
    b: agentSource('b', ['claude sonnet 5'], 'medium'),
    c: agentSource('c', 'Claude Fable 5', 'medium'),
  };
  scenario(agents, ({ src, home }) => {
    const res = update(src, home);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(readClaude(home, 'a'), claudeForm('a', 'opus', 'medium'));
    assert.equal(readClaude(home, 'b'), claudeForm('b', 'sonnet', 'medium'));
    assert.equal(readClaude(home, 'c'), claudeForm('c', 'fable', 'medium'));
  });
});

test('[R48-04] the first Claude entry in list order wins', () => {
  const source = agentSource(
    'coder',
    ['GPT-6 Luna (copilot)', 'Claude Haiku 5.5 (copilot)', 'Claude Opus 5.5 (copilot)'],
    'medium',
  );
  scenario({ coder: source }, ({ src, home }) => {
    const res = update(src, home);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const form = readClaude(home, 'coder');
    assert.ok(form.split('\n').includes('model: haiku'), form);
    assert.equal(form, claudeForm('coder', 'haiku', 'medium'));
  });
});

test('[R48-05] none and minimal both become effort low', () => {
  const agents = {
    a: agentSource('a', ['Claude Sonnet 5.5 (copilot)'], 'none'),
    b: agentSource('b', ['Claude Sonnet 5.5 (copilot)'], 'minimal'),
  };
  scenario(agents, ({ src, home }) => {
    const res = update(src, home);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(readClaude(home, 'a'), claudeForm('a', 'sonnet', 'low'));
    assert.equal(readClaude(home, 'b'), claudeForm('b', 'sonnet', 'low'));
  });
});

test('[R48-06] xhigh and max pass through as written', () => {
  const agents = {
    a: agentSource('a', ['Claude Opus 5.5 (copilot)'], 'xhigh'),
    b: agentSource('b', ['Claude Opus 5.5 (copilot)'], 'max'),
  };
  scenario(agents, ({ src, home }) => {
    const res = update(src, home);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(readClaude(home, 'a'), claudeForm('a', 'opus', 'xhigh'));
    assert.equal(readClaude(home, 'b'), claudeForm('b', 'opus', 'max'));
  });
});

test('[R51-01] a source edit to the Claude entry changes both forms', () => {
  const first = agentSource('coder', ['Claude Haiku 5.5 (copilot)'], 'medium');
  const edited = agentSource('coder', ['Claude Sonnet 5.5 (copilot)'], 'medium');
  scenario({ coder: first }, ({ src, home }) => {
    const r1 = update(src, home);
    assert.equal(r1.status, 0, r1.stdout + r1.stderr);
    assert.equal(readClaude(home, 'coder'), claudeForm('coder', 'haiku', 'medium'));
    put(src, '.github/agents/coder.agent.md', edited);
    const r2 = update(src, home);
    assert.equal(r2.status, 0, r2.stdout + r2.stderr);
    assert.ok(readClaude(home, 'coder').split('\n').includes('model: sonnet'));
    assert.equal(readClaude(home, 'coder'), claudeForm('coder', 'sonnet', 'medium'));
    assert.equal(readCopilot(home, 'coder'), edited);
    assert.equal(r2.lines[2], 'Files: 0 installed, 2 replaced, 0 removed');
  });
});

test('[R51-02] reordering a non-Claude entry replaces only the Copilot form', () => {
  const first = agentSource('coder', ['Claude Haiku 5.5 (copilot)', 'Gemini 4 Neon (copilot)'], 'medium');
  const edited = agentSource('coder', ['Gemini 4 Neon (copilot)', 'Claude Haiku 5.5 (copilot)'], 'medium');
  scenario({ coder: first }, ({ src, home }) => {
    const r1 = update(src, home);
    assert.equal(r1.status, 0, r1.stdout + r1.stderr);
    const before = readFileSync(join(home, '.claude/agents/coder.agent.md'));
    put(src, '.github/agents/coder.agent.md', edited);
    const r2 = update(src, home);
    assert.equal(r2.status, 0, r2.stdout + r2.stderr);
    assert.ok(readFileSync(join(home, '.claude/agents/coder.agent.md')).equals(before));
    assert.equal(readClaude(home, 'coder'), claudeForm('coder', 'haiku', 'medium'));
    assert.equal(readCopilot(home, 'coder'), edited);
    assert.equal(r2.lines[2], 'Files: 0 installed, 1 replaced, 0 removed');
  });
});

test('[R51-03] a Haiku version bump leaves the Claude form unchanged', () => {
  const first = agentSource('coder', ['Claude Haiku 5.5 (copilot)'], 'medium');
  const edited = agentSource('coder', ['Claude Haiku 6 (copilot)'], 'medium');
  scenario({ coder: first }, ({ src, home }) => {
    const r1 = update(src, home);
    assert.equal(r1.status, 0, r1.stdout + r1.stderr);
    const before = readFileSync(join(home, '.claude/agents/coder.agent.md'));
    put(src, '.github/agents/coder.agent.md', edited);
    const r2 = update(src, home);
    assert.equal(r2.status, 0, r2.stdout + r2.stderr);
    const after = readFileSync(join(home, '.claude/agents/coder.agent.md'));
    assert.ok(after.equals(before));
    assert.ok(after.toString('utf8').split('\n').includes('model: haiku'));
  });
});
