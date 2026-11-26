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
import { delimiter, dirname, join } from 'node:path';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const WIN = process.platform === 'win32';
const MANIFEST = '{"version":"3f9a2c1","status":"complete","files":[]}';

const ADDONS = {
  csharp: ['dotnet-editorconfig', 'stryker-dotnet'],
  'node-javascript': ['eslint-javascript', 'stryker-javascript', 'vitest-javascript'],
  'node-typescript': ['eslint-typescript', 'stryker-typescript', 'vitest-typescript'],
};

const STUB = `import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
function walk(dir, base, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, base, out);
    else out[relative(base, p).split('\\\\').join('/')] = readFileSync(p, 'utf8');
  }
  return out;
}
const argv = process.argv.slice(2);
const i = argv.indexOf('--plugin-dir');
let plugin = null;
if (i >= 0 && argv[i + 1]) {
  try { plugin = walk(argv[i + 1], argv[i + 1], {}); } catch { plugin = null; }
}
writeFileSync(process.env.WF_STUB_OUT, JSON.stringify({
  name: process.env.WF_STUB_NAME,
  argv,
  cwd: process.cwd(),
  home: process.env.WORKFLOW_HOME ?? null,
  plugin,
}));
process.exit(Number(process.env.WF_STUB_EXIT ?? 0));
`;

function put(root, rel, text) {
  const target = join(root, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

function makeHome(manifest) {
  const home = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfhome-')));
  const git = spawnSync('git', ['init', '-q'], { cwd: home, encoding: 'utf8' });
  assert.equal(git.status, 0, git.stderr);
  for (const f of ['launch.mjs', 'launch.cmd']) {
    const from = join(repoRoot, 'home', f);
    if (existsSync(from)) copyFileSync(from, join(home, f));
  }
  if (manifest !== null) put(home, '.git/personal-workflow/manifest.json', manifest);
  for (const [id, skills] of Object.entries(ADDONS)) {
    for (const skill of skills) {
      const link = skill.startsWith('stryker-') ? '\n[protocol](../mutation-testing/protocol.md)\n' : '\n';
      put(home, `.workflow-core/language-addons/${id}/${skill}/SKILL.md`, `---\nname: ${skill}\n---\n${link}`);
    }
  }
  put(home, '.workflow-core/language-addons/mutation-testing/protocol.md', '# protocol\n');
  copyFileSync(
    join(repoRoot, '.github/hooks/scripts/guard-locked-tests.mjs'),
    (mkdirSync(join(home, '.workflow-core/hooks/scripts'), { recursive: true }),
    join(home, '.workflow-core/hooks/scripts/guard-locked-tests.mjs')),
  );
  return home;
}

function makeBin(names) {
  const bin = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfbin-')));
  put(bin, 'stub.mjs', STUB);
  for (const name of names) {
    put(bin, `${name}.cmd`, `@"${process.execPath}" "%~dp0stub.mjs" %*\r\n`);
  }
  return bin;
}

// PATH = the stub folder plus only those original entries that hold git and no real Harness.
function makePath(bin) {
  const original = (process.env.PATH ?? process.env.Path ?? '').split(delimiter).filter(Boolean);
  const keep = original.filter((dir) => {
    const has = (n) => ['', '.exe', '.cmd', '.bat', '.com', '.ps1'].some((e) => existsSync(join(dir, n + e)));
    return has('git') && !has('claude') && !has('copilot');
  });
  return [bin, ...keep].join(delimiter);
}

function makeProject() {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfproj-')));
  writeFileSync(join(dir, 'AGENTS.md'), '# Project\n\n- Stack: node-typescript\n');
  return dir;
}

function scenario(fn) {
  const home = makeHome(MANIFEST);
  const bin = makeBin(['claude', 'copilot']);
  const project = makeProject();
  const outDir = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfout-')));
  let n = 0;
  const run = (args, { callerEnv = {} } = {}) => {
    const outFile = join(outDir, `rec-${n++}.json`);
    const env = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (!/^(path|wf_stub_.*|workflow_home)$/i.test(k)) env[k] = v;
    }
    Object.assign(env, callerEnv);
    env.Path = makePath(bin);
    env.WF_STUB_OUT = outFile;
    env.WF_STUB_NAME = String(args[0] ?? '').toLowerCase();
    const res = spawnSync(process.execPath, [join(home, 'launch.mjs'), ...args], {
      cwd: project,
      env,
      encoding: 'utf8',
    });
    const record = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : null;
    return { status: res.status, stdout: res.stdout ?? '', record };
  };
  try {
    fn({ run, home });
  } finally {
    for (const d of [home, bin, project, outDir]) rmSync(d, { recursive: true, force: true });
  }
}

const opts = { skip: !WIN && 'needs Windows .cmd stubs' };

test('[R42-01] the Harness started by launch claude and launch copilot has WORKFLOW_HOME set to the Home Repo real path', opts, () => {
  scenario(({ run, home }) => {
    for (const harness of ['claude', 'copilot']) {
      const res = run([harness]);
      assert.ok(res.record, `${harness} stub did not run: ${res.stdout}`);
      assert.equal(res.record.name, harness);
      assert.equal(res.record.home, home);
    }
  });
});

test('[R42-02] a WORKFLOW_HOME already in the caller environment is overridden by the Home Repo real path', opts, () => {
  scenario(({ run, home }) => {
    const res = run(['claude'], { callerEnv: { WORKFLOW_HOME: 'C:\\elsewhere' } });
    assert.ok(res.record, `stub did not run: ${res.stdout}`);
    assert.equal(res.record.home, home);
  });
});
