import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
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
import { basename, delimiter, dirname, join, sep } from 'node:path';
import { repoRoot, tempRepo } from '../../.github/tools/workflow-core/support/harness.mjs';

const WIN = process.platform === 'win32';
const OPTS = { skip: WIN ? false : 'needs win32 (.cmd stubs)' };

const ADDONS = {
  csharp: ['dotnet-editorconfig', 'stryker-dotnet'],
  'node-javascript': ['eslint-javascript', 'stryker-javascript', 'vitest-javascript'],
  'node-typescript': ['eslint-typescript', 'stryker-typescript', 'vitest-typescript'],
};

const STUB = `import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const argv = process.argv.slice(2);
function walk(root, rel, out) {
  for (const name of readdirSync(join(root, rel))) {
    const r = rel ? rel + '/' + name : name;
    if (statSync(join(root, r)).isDirectory()) walk(root, r, out);
    else out[r] = readFileSync(join(root, r), 'utf8');
  }
}
let plugin = null;
const i = argv.indexOf('--plugin-dir');
if (i >= 0 && argv[i + 1] && existsSync(argv[i + 1])) {
  plugin = {};
  walk(argv[i + 1], '', plugin);
}
writeFileSync(process.env.WF_STUB_OUT, JSON.stringify({ name: 'stub', argv, cwd: process.cwd(), plugin }));
process.exit(Number(process.env.WF_STUB_EXIT ?? 0));
`;

function put(root, rel, text) {
  const target = join(root, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

function makeHome() {
  const repo = tempRepo();
  const dir = realpathSync.native(repo.dir);
  for (const f of ['launch.mjs', 'launch.cmd']) {
    const src = join(repoRoot, 'home', f);
    if (existsSync(src)) copyFileSync(src, join(dir, f));
  }
  put(dir, '.git/personal-workflow/manifest.json', '{"version":"3f9a2c1","status":"complete","files":[]}');
  for (const [id, skills] of Object.entries(ADDONS)) {
    for (const skill of skills) {
      const link = skill.startsWith('stryker-') ? '\nSee [protocol](../mutation-testing/protocol.md)\n' : '\n';
      put(dir, `.workflow-core/language-addons/${id}/${skill}/SKILL.md`, `# ${skill}${link}`);
    }
  }
  put(dir, '.workflow-core/language-addons/csharp/dotnet-editorconfig/references/BASELINE.md', '# baseline for csharp\n');
  put(dir, '.workflow-core/language-addons/mutation-testing/protocol.md', '# mutation protocol\n');
  mkdirSync(join(dir, '.workflow-core/hooks/scripts'), { recursive: true });
  copyFileSync(join(repoRoot, '.github/hooks/scripts/guard-locked-tests.mjs'), join(dir, '.workflow-core/hooks/scripts/guard-locked-tests.mjs'));
  return { repo, dir };
}

function makeProject(stack) {
  const repo = tempRepo();
  const dir = realpathSync.native(repo.dir);
  repo.write('tests/acceptance/add.test.mjs', "test('add', () => {});\n");
  repo.write('src/add.mjs', 'export const add = (a, b) => a + b;\n');
  const lock = repo.commit('tests');
  repo.write('AGENTS.md', `# Project\n\n- Stack: ${stack}\n`);
  repo.write(
    '.workflow/plans/calc/plan.md',
    ['# calc plan', '', '- Spec: [calc-spec.md](../../specs/calc-spec.md)', '- Lane: standard', '- Next: P01 S02', `- Tests locked: \`${lock}\``, '- Oracle: `tests/acceptance/`', ''].join('\n'),
  );
  repo.commit('plan');
  return { repo, dir, lock };
}

function makeBin() {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfbin-')));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  put(bin, 'claude.cmd', '@node "%~dp0stub.mjs" %*\r\n');
  put(bin, 'copilot.cmd', '@node "%~dp0stub.mjs" %*\r\n');
  put(bin, 'stub.mjs', STUB);
  return { root, bin };
}

function setup(stack) {
  const home = makeHome();
  home.repo.commit('home');
  const project = makeProject(stack);
  const b = makeBin();
  return {
    home,
    project,
    b,
    cleanup() {
      home.repo.cleanup();
      project.repo.cleanup();
      rmSync(b.root, { recursive: true, force: true });
    },
  };
}

function launch(env, harness, args = [], tag = harness) {
  const out = join(env.b.root, `${tag}.json`);
  const vars = {};
  for (const [k, v] of Object.entries(process.env)) if (k.toLowerCase() !== 'path') vars[k] = v;
  vars.PATH = `${env.b.bin}${delimiter}${process.env.PATH ?? process.env.Path ?? ''}`;
  vars.WF_STUB_OUT = out;
  const res = spawnSync(process.execPath, [join(env.home.dir, 'launch.mjs'), harness, ...args], {
    cwd: env.project.dir,
    env: vars,
    encoding: 'utf8',
  });
  const record = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;
  return { res, record };
}

function isInside(child, parent) {
  const c = child.toLowerCase();
  const p = parent.toLowerCase();
  return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep);
}

function assertSession(env, record, extra) {
  assert.ok(record, 'the harness stub did not run');
  const { argv } = record;
  assert.equal(argv[0], '--add-dir');
  assert.equal(argv[1], env.home.dir);
  assert.equal(argv[2], '--plugin-dir');
  const P = argv[3];
  assert.deepEqual(argv.slice(4), extra);
  assert.ok(!isInside(P, env.home.dir), `plugin folder ${P} is inside the Home Repo`);
  assert.ok(!isInside(P, env.project.dir), `plugin folder ${P} is inside the Project Repo`);
  assert.ok(basename(P).startsWith('workflow-stack-'), P);
  assert.equal(realpathSync.native(dirname(P)).toLowerCase(), realpathSync.native(tmpdir()).toLowerCase());
  assert.ok(record.plugin, 'plugin folder was missing during the run');
  const plugin = record.plugin;
  const manifest = JSON.parse(plugin['.claude-plugin/plugin.json']);
  assert.equal(manifest.name, 'workflow-stack');
  assert.equal(plugin['skills/dotnet-editorconfig/SKILL.md'], '# dotnet-editorconfig\n\n');
  assert.equal(plugin['skills/dotnet-editorconfig/references/BASELINE.md'], '# baseline for csharp\n');
  assert.ok('skills/stryker-dotnet/SKILL.md' in plugin);
  assert.ok(!Object.keys(plugin).some((k) => k.startsWith('skills/eslint-javascript')), 'unexpected eslint-javascript skill');
  return P;
}

function snapshot(root) {
  const out = {};
  (function walk(rel) {
    for (const name of readdirSync(join(root, rel))) {
      const r = rel ? `${rel}/${name}` : name;
      if (r === '.git/index' || r.endsWith('.lock')) continue;
      const full = join(root, r);
      const st = statSync(full);
      if (st.isDirectory()) {
        out[`${r}/`] = 'dir';
        walk(r);
      } else {
        out[r] = `${st.size}:${st.mtimeMs}:${createHash('sha1').update(readFileSync(full)).digest('hex')}`;
      }
    }
  })('');
  return out;
}

function porcelain(dir) {
  return spawnSync('git', ['-C', dir, 'status', '--porcelain'], { encoding: 'utf8' }).stdout;
}

test('[R38-14] launch claude hands the Harness --add-dir, a temp --plugin-dir, and the csharp add-on skills', OPTS, () => {
  const env = setup('csharp');
  try {
    const { record } = launch(env, 'claude', ['--continue']);
    assertSession(env, record, ['--continue']);
  } finally {
    env.cleanup();
  }
});

test('[R38-15] launch copilot gets the same flags and the same plugin files', OPTS, () => {
  const env = setup('csharp');
  try {
    const a = launch(env, 'claude', ['--continue']);
    const b = launch(env, 'copilot', ['--continue']);
    assertSession(env, b.record, ['--continue']);
    assert.deepEqual(Object.keys(b.record.plugin).sort(), Object.keys(a.record.plugin).sort());
  } finally {
    env.cleanup();
  }
});

test('[R38-16] csharp carries the mutation-testing protocol; an unknown stack carries no skill folder', OPTS, () => {
  const env = setup('csharp');
  const env2 = setup('powershell');
  try {
    const { record } = launch(env, 'claude');
    assert.ok(record, 'the harness stub did not run');
    assert.ok(record.plugin, 'plugin folder was missing during the run');
    assert.equal(record.plugin['skills/mutation-testing/protocol.md'], '# mutation protocol\n');

    const none = launch(env2, 'claude');
    assert.ok(none.record, 'the harness stub did not run');
    assert.ok(none.record.plugin, 'plugin folder was missing during the run');
    assert.deepEqual(Object.keys(none.record.plugin).filter((k) => k.startsWith('skills/')), []);
  } finally {
    env.cleanup();
    env2.cleanup();
  }
});

function runHook(env, command, payload) {
  return spawnSync(command, { shell: true, input: JSON.stringify(payload), cwd: env.home.dir, encoding: 'utf8' });
}

test('[R38-17] the plugin hook command runs the locked-tests guard from the Home layout', OPTS, () => {
  const env = setup('csharp');
  try {
    const { record } = launch(env, 'claude');
    assert.ok(record?.plugin, 'plugin folder was missing during the run');
    const hooks = JSON.parse(record.plugin['hooks/hooks.json']);
    assert.equal(hooks.hooks.PreToolUse.length, 1);
    assert.equal(hooks.hooks.PreToolUse[0].hooks.length, 1);
    const command = hooks.hooks.PreToolUse[0].hooks[0].command;
    const locked = join(env.project.dir, 'tests/acceptance/add.test.mjs');

    const reasonOk = (out) => {
      assert.equal(out.permissionDecision, 'deny');
      assert.ok(out.permissionDecisionReason.includes('calc'), out.permissionDecisionReason);
      assert.ok(out.permissionDecisionReason.includes(env.project.lock), out.permissionDecisionReason);
      assert.ok(out.permissionDecisionReason.includes('tests/acceptance/add.test.mjs'), out.permissionDecisionReason);
    };

    const claude = runHook(env, command, { tool_name: 'Edit', tool_input: { file_path: locked } });
    assert.equal(claude.status, 0);
    reasonOk(JSON.parse(claude.stdout));

    const copilot = runHook(env, command, {
      toolName: 'edit',
      toolArgs: JSON.stringify({ path: locked }),
      cwd: env.home.dir,
    });
    assert.equal(copilot.status, 0);
    reasonOk(JSON.parse(copilot.stdout));

    const allowed = runHook(env, command, {
      tool_name: 'Edit',
      tool_input: { file_path: join(env.project.dir, 'src/add.mjs') },
    });
    assert.equal(allowed.status, 0);
    assert.equal(allowed.stdout, '{}');
  } finally {
    env.cleanup();
  }
});

test('[R38-18] the plugin is removed and neither repository is touched', OPTS, () => {
  const env = setup('csharp');
  try {
    const projectStatus = porcelain(env.project.dir);
    const homeStatus = porcelain(env.home.dir);
    const projectTree = snapshot(env.project.dir);
    const homeTree = snapshot(env.home.dir);

    const a = launch(env, 'claude', [], 'run-claude');
    const b = launch(env, 'copilot', [], 'run-copilot');
    for (const { record } of [a, b]) {
      assert.ok(record, 'the harness stub did not run');
      const P = record.argv[record.argv.indexOf('--plugin-dir') + 1];
      assert.ok(P, 'no --plugin-dir in argv');
      assert.equal(existsSync(P), false, `plugin folder ${P} still exists`);
    }
    assert.equal(porcelain(env.project.dir), projectStatus);
    assert.equal(porcelain(env.home.dir), homeStatus);
    assert.deepEqual(snapshot(env.project.dir), projectTree);
    assert.deepEqual(snapshot(env.home.dir), homeTree);
  } finally {
    env.cleanup();
  }
});
