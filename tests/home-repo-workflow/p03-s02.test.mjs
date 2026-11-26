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
const USAGE = 'usage: launch claude|copilot [args...] | version';
const MANIFEST = '{"version":"3f9a2c1","status":"complete","files":[]}';
const INCOMPLETE = '{"version":"3f9a2c1","status":"incomplete","files":[]}';

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

function scenario(fn, { manifest = MANIFEST, stubs = ['claude', 'copilot'] } = {}) {
  const home = makeHome(manifest);
  const bin = makeBin(stubs);
  const project = makeProject();
  const outDir = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfout-')));
  let n = 0;
  const run = (args, { exit, cwd } = {}) => {
    const outFile = join(outDir, `rec-${n++}.json`);
    const env = {};
    for (const [k, v] of Object.entries(process.env)) if (!/^(path|wf_stub_.*)$/i.test(k)) env[k] = v;
    env.Path = makePath(bin);
    env.WF_STUB_OUT = outFile;
    env.WF_STUB_NAME = String(args[0] ?? '').toLowerCase();
    if (exit !== undefined) env.WF_STUB_EXIT = String(exit);
    const res = spawnSync(process.execPath, [join(home, 'launch.mjs'), ...args], {
      cwd: cwd ?? project,
      env,
      encoding: 'utf8',
    });
    const lines = (res.stdout ?? '').split(/\r?\n/);
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    const record = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : null;
    return { status: res.status, lines, stdout: res.stdout ?? '', record };
  };
  try {
    fn({ run, project, home });
  } finally {
    for (const d of [home, bin, project, outDir]) rmSync(d, { recursive: true, force: true });
  }
}

const opts = { skip: !WIN && 'needs Windows .cmd stubs' };

test('[R38-01] user arguments reach the Harness unchanged, in the Project folder, and its exit code is returned', opts, () => {
  scenario(({ run, project }) => {
    const res = run(['claude', '--continue', '--model', 'a b'], { exit: 7 });
    assert.ok(res.record, `stub did not run: ${res.stdout}`);
    assert.deepEqual(res.record.argv.slice(-3), ['--continue', '--model', 'a b']);
    assert.equal(realpathSync.native(res.record.cwd), project);
    assert.equal(res.status, 7);
  });
});

test('[R38-02] the Harness name is case-insensitive and selects the matching command', opts, () => {
  scenario(({ run }) => {
    const a = run(['CLAUDE']);
    assert.ok(a.record, `claude stub did not run: ${a.stdout}`);
    assert.equal(a.record.name, 'claude');
    assert.equal(a.status, 0);
    const b = run(['Copilot']);
    assert.ok(b.record, `copilot stub did not run: ${b.stdout}`);
    assert.equal(b.record.name, 'copilot');
    assert.equal(b.status, 0);
  });
});

test('[R38-03] no argument fails with missing-harness and usage, and starts no Harness', opts, () => {
  scenario(({ run }) => {
    const res = run([]);
    assert.ok(res.lines[0]?.startsWith('launch failed: missing-harness: '), res.stdout);
    assert.ok(res.lines.includes(USAGE), res.stdout);
    assert.equal(res.status, 1);
    assert.equal(res.record, null);
  });
});

test('[R38-04] an unknown Harness fails with unknown-harness and usage, and starts no Harness', opts, () => {
  scenario(({ run }) => {
    const res = run(['gemini']);
    assert.equal(res.lines[0], 'launch failed: unknown-harness: gemini');
    assert.ok(res.lines.includes(USAGE), res.stdout);
    assert.equal(res.status, 1);
    assert.equal(res.record, null);
  });
});

test('[R38-05] a Harness missing from PATH fails with harness-not-installed naming it', opts, () => {
  scenario(
    ({ run }) => {
      const res = run(['claude']);
      assert.equal(res.lines[0], 'launch failed: harness-not-installed: claude');
      assert.equal(res.status, 1);
      assert.equal(res.record, null);
    },
    { stubs: ['copilot'] },
  );
});

test('[R38-06] no version record fails with workflow-not-installed and starts no Harness', opts, () => {
  scenario(
    ({ run }) => {
      const res = run(['claude']);
      assert.ok(res.stdout.startsWith('launch failed: workflow-not-installed:'), res.stdout);
      assert.notEqual(res.status, 0);
      assert.equal(res.record, null);
    },
    { manifest: null },
  );
});

test('[R38-07] an incomplete update fails with update-incomplete and starts no Harness', opts, () => {
  scenario(
    ({ run }) => {
      const res = run(['copilot']);
      assert.ok(res.stdout.startsWith('launch failed: update-incomplete:'), res.stdout);
      assert.notEqual(res.status, 0);
      assert.equal(res.record, null);
    },
    { manifest: INCOMPLETE },
  );
});
