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

const BASE_FILES = {
  '.github/skills/demo/SKILL.md': 'line one\nline two\n',
  '.github/hooks/h.mjs': 'export const hook = 1;\n',
  '.github/tools/t/run.mjs': 'export const run = 1;\n',
  '.github/user-interaction.md': '# user interaction\n',
  'language-addons/stk/ad/SKILL.md': '# add-on skill\n',
  'home/launch.mjs': 'export const launch = 1;\n',
};

const AGENTS = '# Home\n\n- Pointer: see notes\n';

function put(root, rel, text) {
  const target = join(root, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

// A source agent file. `models` is an array (written as a list), a string (single
// string), or null (no model key). `effort` is a string or null (no line).
function agentSource(name, models, effort) {
  let fm = `---\nname: ${name}\ndescription: "x"\n`;
  if (Array.isArray(models)) fm += `model:\n${models.map((m) => `  - ${m}\n`).join('')}`;
  else if (models !== null) fm += `model: ${models}\n`;
  if (effort !== null) fm += `reasoning-effort: ${effort}\n`;
  return `${fm}---\nBody of ${name}\n`;
}

function makeSource(agents) {
  const src = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfsrc-')));
  const scriptsDir = join(repoRoot, 'scripts');
  mkdirSync(join(src, 'scripts'), { recursive: true });
  for (const f of readdirSync(scriptsDir)) {
    if (f.endsWith('.mjs')) copyFileSync(join(scriptsDir, f), join(src, 'scripts', f));
  }
  for (const [rel, text] of Object.entries(BASE_FILES)) put(src, rel, text);
  for (const [name, [models, effort]] of Object.entries(agents)) {
    put(src, `.github/agents/${name}.agent.md`, agentSource(name, models, effort));
  }
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

function claudeForm(home, name) {
  const file = join(home, '.claude', 'agents', `${name}.agent.md`);
  assert.ok(existsSync(file), `${name} Claude form missing`);
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const close = lines.indexOf('---', 1);
  assert.ok(lines[0] === '---' && close > 0, `no frontmatter in ${name}: ${text}`);
  return lines.slice(1, close);
}

function assertFilesLine(res) {
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.lines[0].startsWith('Home Repo: '), true, res.stdout);
  assert.match(res.lines[1], /^Workflow version: /);
  assert.match(res.lines[2], /^Files: /);
}

function assertPins(home, name, model, effort) {
  const fm = claudeForm(home, name);
  assert.equal(fm.filter((l) => l === `model: ${model}`).length, 1, `${name}: ${fm.join('|')}`);
  assert.equal(fm.filter((l) => l === `effort: ${effort}`).length, 1, `${name}: ${fm.join('|')}`);
  assert.equal(fm.filter((l) => /^model:/.test(l)).length, 1, `${name}: ${fm.join('|')}`);
  assert.equal(fm.filter((l) => /^effort:/.test(l)).length, 1, `${name}: ${fm.join('|')}`);
  assert.equal(fm.some((l) => /^reasoning-effort:/.test(l)), false, `${name}: ${fm.join('|')}`);
}

test('[R50-01] a list with no Claude entry defaults the model to sonnet and keeps the valid effort', () => {
  scenario({ coder: [['GPT-6 Luna (copilot)', 'Gemini 3.8 Flash (copilot)'], 'medium'] }, ({ src, home }) => {
    const res = update(src, home);
    assertFilesLine(res);
    assert.deepEqual(res.lines.slice(3), ['Agent default: coder: model sonnet (no Claude model in list)']);
    assertPins(home, 'coder', 'sonnet', 'medium');
  });
});

test('[R50-02] an unrecognized effort defaults to medium and keeps the Claude model', () => {
  scenario({ 'repo-scout': [['Claude Haiku 5.5 (copilot)'], 'fast'] }, ({ src, home }) => {
    const res = update(src, home);
    assertFilesLine(res);
    assert.deepEqual(res.lines.slice(3), [
      'Agent default: repo-scout: effort medium (unrecognized reasoning-effort "fast")',
    ]);
    assertPins(home, 'repo-scout', 'haiku', 'medium');
  });
});

test('[R50-03] known Claude entries and recognized efforts print no Agent default or Agent pin line', () => {
  scenario(
    {
      coder: [['GPT-6 Luna (copilot)', 'Claude Sonnet 5.5 (copilot)'], 'medium'],
      planner: [['Claude Opus 5.5 (copilot)'], 'high'],
    },
    ({ src, home }) => {
      const res = update(src, home);
      assertFilesLine(res);
      assert.equal(res.lines.length, 3, res.stdout);
      assert.equal(/Agent (default|pin):/.test(res.stdout), false, res.stdout);
      assertPins(home, 'coder', 'sonnet', 'medium');
      assertPins(home, 'planner', 'opus', 'high');
    },
  );
});

test('[R50-04] default notices are sorted by agent name, model before effort', () => {
  scenario(
    {
      b: [null, null],
      a: [['GPT-6 Luna (copilot)'], 'fast'],
    },
    ({ src, home }) => {
      const res = update(src, home);
      assertFilesLine(res);
      assert.deepEqual(res.lines.slice(3), [
        'Agent default: a: model sonnet (no Claude model in list)',
        'Agent default: a: effort medium (unrecognized reasoning-effort "fast")',
        'Agent default: b: model sonnet (no Claude model in list)',
        'Agent default: b: effort medium (no reasoning-effort)',
      ]);
      assertPins(home, 'a', 'sonnet', 'medium');
      assertPins(home, 'b', 'sonnet', 'medium');
    },
  );
});

test('[R50-05] a skipped-only list prints the skip line before the model default and keeps the effort', () => {
  scenario({ coder: [['Claude Nova 1 (copilot)'], 'low'] }, ({ src, home }) => {
    const res = update(src, home);
    assertFilesLine(res);
    assert.deepEqual(res.lines.slice(3), [
      'Agent pin: coder: skipped "Claude Nova 1 (copilot)" (not a Claude Code model family)',
      'Agent default: coder: model sonnet (no Claude model in list)',
    ]);
    assertPins(home, 'coder', 'sonnet', 'low');
  });
});

test('[R50-06] a valid Claude entry with no reasoning-effort defaults only the effort', () => {
  scenario({ scout: [['Claude Haiku 5.5 (copilot)'], null] }, ({ src, home }) => {
    const res = update(src, home);
    assertFilesLine(res);
    assert.deepEqual(res.lines.slice(3), ['Agent default: scout: effort medium (no reasoning-effort)']);
    assert.equal(res.stdout.includes('model sonnet'), false, res.stdout);
    assertPins(home, 'scout', 'haiku', 'medium');
  });
});

test('[R50-07] a rerun of the same source prints the same Agent default lines and exits 0', () => {
  scenario(
    {
      coder: [['GPT-6 Luna (copilot)'], 'medium'],
      scout: [['Claude Haiku 5.5 (copilot)'], 'fast'],
    },
    ({ src, home }) => {
      const expected = [
        'Agent default: coder: model sonnet (no Claude model in list)',
        'Agent default: scout: effort medium (unrecognized reasoning-effort "fast")',
      ];
      const first = update(src, home);
      assertFilesLine(first);
      assert.deepEqual(first.lines.slice(3), expected);
      const second = update(src, home);
      assertFilesLine(second);
      assert.deepEqual(second.lines.slice(3), expected);
    },
  );
});
