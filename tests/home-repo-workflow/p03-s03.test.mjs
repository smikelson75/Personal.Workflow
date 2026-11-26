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

const WIN = process.platform === 'win32';
const SKIP = WIN ? false : 'needs Windows .cmd stubs';

const VERSION = '3f9a2c1';
const NOTE =
  'note: Copilot CLI skips the locked-tests guard in untrusted folders; trust this folder when asked. The Gate still verifies locked tests.';
const W_NO_AGENTS =
  'warning: no AGENTS.md in this folder; starting Workflow Core only. Run /agents-md to create one with a Stack line.';
const W_NO_STACK =
  'warning: AGENTS.md names no stack; starting Workflow Core only. Run /agents-md to add a Stack line.';
const AVAILABLE = 'csharp, node-javascript, node-typescript';
const wNoAddon = (id, tail = '') => `warning: no Language Add-on for stack '${id}'; available: ${AVAILABLE}.${tail}`;

const ADDONS = {
  csharp: ['dotnet-editorconfig', 'stryker-dotnet'],
  'node-javascript': ['eslint-javascript', 'stryker-javascript', 'vitest-javascript'],
  'node-typescript': ['eslint-typescript', 'stryker-typescript', 'vitest-typescript'],
};

const LINE_CSHARP = 'Language Add-on: csharp (dotnet-editorconfig, stryker-dotnet)';
const LINE_NODE_JS = 'Language Add-on: node-javascript (eslint-javascript, stryker-javascript, vitest-javascript)';
const LINE_NODE_TS = 'Language Add-on: node-typescript (eslint-typescript, stryker-typescript, vitest-typescript)';

function put(root, rel, text) {
  const target = join(root, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

function makeHome() {
  const repo = tempRepo();
  const dir = realpathSync.native(repo.dir);
  for (const f of ['launch.mjs', 'launch.cmd']) {
    const from = join(repoRoot, 'home', f);
    if (existsSync(from)) copyFileSync(from, join(dir, f));
  }
  put(dir, '.git/personal-workflow/manifest.json', JSON.stringify({ version: VERSION, status: 'complete', files: [] }));
  for (const [id, skills] of Object.entries(ADDONS)) {
    for (const skill of skills) {
      const link = skill.startsWith('stryker-') ? '\nSee [protocol](../mutation-testing/protocol.md)\n' : '\n';
      put(dir, `.workflow-core/language-addons/${id}/${skill}/SKILL.md`, `# ${skill}${link}`);
    }
  }
  put(dir, '.workflow-core/language-addons/mutation-testing/protocol.md', '# protocol\n');
  const guard = join(repoRoot, '.github/hooks/scripts/guard-locked-tests.mjs');
  if (existsSync(guard)) {
    mkdirSync(join(dir, '.workflow-core/hooks/scripts'), { recursive: true });
    copyFileSync(guard, join(dir, '.workflow-core/hooks/scripts/guard-locked-tests.mjs'));
  }
  return { repo, dir };
}

function makeBin() {
  const bin = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfbin-')));
  put(
    bin,
    'stub.mjs',
    [
      "import { writeFileSync } from 'node:fs';",
      'writeFileSync(process.env.WF_STUB_OUT, JSON.stringify({ name: process.env.WF_STUB_NAME, argv: process.argv.slice(2), cwd: process.cwd(), plugin: null }));',
      'process.exit(Number(process.env.WF_STUB_EXIT ?? 0));',
      '',
    ].join('\n'),
  );
  put(bin, 'claude.cmd', '@set "WF_STUB_NAME=claude"\r\n@node "%~dp0stub.mjs" %*\r\n');
  put(bin, 'copilot.cmd', '@set "WF_STUB_NAME=copilot"\r\n@node "%~dp0stub.mjs" %*\r\n');
  return bin;
}

function launch(home, project, bin, outFile, args) {
  const env = { ...process.env, WF_STUB_OUT: outFile };
  const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
  env[key] = `${bin};${env[key] ?? ''}`;
  const res = spawnSync(process.execPath, [join(home, 'launch.mjs'), ...args], {
    cwd: project,
    env,
    encoding: 'utf8',
  });
  const lines = (res.stdout ?? '').split(/\r?\n/);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return { status: res.status, lines, stdout: res.stdout ?? '', ran: existsSync(outFile) };
}

// agentsText: undefined = no AGENTS.md in the Project folder.
function scenario(agentsText, harness, fn) {
  const { repo, dir } = makeHome();
  const bin = makeBin();
  const project = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfproj-')));
  const outFile = join(bin, 'out.json');
  if (agentsText !== undefined) put(project, 'AGENTS.md', agentsText);
  try {
    const res = launch(dir, project, bin, outFile, [harness]);
    fn(res, dir);
  } finally {
    repo.cleanup();
    rmSync(bin, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
  }
}

const head = (home, stack, ...addons) => [`Home Repo: ${home}`, `Workflow version: ${VERSION}`, `Stack: ${stack}`, ...addons];

test('[R38-08] claude with "- Stack: csharp" prints home, version, stack, add-on and starts the stub', { skip: SKIP }, () => {
  scenario('# Project\n\n- Stack: csharp\n', 'claude', (res, home) => {
    assert.equal(res.status, 0, res.stdout);
    assert.deepEqual(res.lines, head(home, 'csharp', LINE_CSHARP));
    assert.equal(res.ran, true, 'claude stub did not run');
  });
});

test('[R38-09] copilot with the same stack prints the same lines then the trust note', { skip: SKIP }, () => {
  scenario('# Project\n\n- Stack: csharp\n', 'copilot', (res, home) => {
    assert.equal(res.status, 0, res.stdout);
    assert.deepEqual(res.lines, [...head(home, 'csharp', LINE_CSHARP), NOTE]);
    assert.equal(res.ran, true, 'copilot stub did not run');
  });
});

test('[R38-10] a known and an unknown stack load the known add-on and warn for the unknown one', { skip: SKIP }, () => {
  scenario('Stack: node-typescript, powershell\n', 'claude', (res, home) => {
    assert.equal(res.status, 0, res.stdout);
    assert.deepEqual(res.lines, [
      ...head(home, 'node-typescript, powershell', LINE_NODE_TS),
      wNoAddon('powershell'),
    ]);
    assert.equal(res.ran, true, 'claude stub did not run');
  });
});

test('[R38-11] several known stacks print one add-on line each in written order and no warning', { skip: SKIP }, () => {
  scenario('Stack: node-javascript,csharp\n', 'claude', (res, home) => {
    assert.equal(res.status, 0, res.stdout);
    assert.deepEqual(res.lines, head(home, 'node-javascript,csharp', LINE_NODE_JS, LINE_CSHARP));
    assert.equal(res.lines.some((l) => l.startsWith('warning:')), false);
    assert.equal(res.ran, true, 'claude stub did not run');
  });
});

test('[R38-12] the first Stack line wins, the key is case-insensitive and the value is trimmed', { skip: SKIP }, () => {
  scenario('# x\nSTACK:  csharp  \nStack: node-javascript\n', 'claude', (res, home) => {
    assert.equal(res.status, 0, res.stdout);
    assert.deepEqual(res.lines, head(home, 'csharp', LINE_CSHARP));
    assert.equal(res.ran, true, 'claude stub did not run');
  });
});

test('[R38-13] launching inside the Home Repo prints Stack: none (Home Repo) with no warning', { skip: SKIP }, () => {
  const { repo, dir } = makeHome();
  const bin = makeBin();
  const outFile = join(bin, 'out.json');
  try {
    put(dir, 'AGENTS.md', '# Home\n\n- Pointer: see notes\n');
    const res = launch(dir, dir, bin, outFile, ['claude']);
    assert.equal(res.status, 0, res.stdout);
    assert.deepEqual(res.lines, head(dir, 'none (Home Repo)', 'Language Add-on: none'));
    assert.equal(res.lines.some((l) => l.startsWith('warning:')), false);
    assert.equal(res.ran, true, 'claude stub did not run');
  } finally {
    repo.cleanup();
    rmSync(bin, { recursive: true, force: true });
  }
});

test('[R39-01] no AGENTS.md prints Stack: none, no add-on, the note, then the no-AGENTS.md warning', { skip: SKIP }, () => {
  scenario(undefined, 'copilot', (res, home) => {
    assert.equal(res.status, 0, res.stdout);
    assert.deepEqual(res.lines, [...head(home, 'none', 'Language Add-on: none'), NOTE, W_NO_AGENTS]);
    assert.equal(res.ran, true, 'copilot stub did not run');
  });
});

test('[R39-02] AGENTS.md without a Stack line prints the no-stack warning', { skip: SKIP }, () => {
  scenario('# Project\n\n- Pointer: see notes\n', 'claude', (res, home) => {
    assert.equal(res.status, 0, res.stdout);
    assert.deepEqual(res.lines, [...head(home, 'none', 'Language Add-on: none'), W_NO_STACK]);
    assert.equal(res.ran, true, 'claude stub did not run');
  });
});

test('[R39-02] AGENTS.md with an empty Stack line prints the no-stack warning', { skip: SKIP }, () => {
  scenario('# Project\n\nStack:\n', 'claude', (res, home) => {
    assert.equal(res.status, 0, res.stdout);
    assert.deepEqual(res.lines, [...head(home, 'none', 'Language Add-on: none'), W_NO_STACK]);
    assert.equal(res.ran, true, 'claude stub did not run');
  });
});

test('[R39-03] a stack with no add-on prints the warning ending Workflow Core only.', { skip: SKIP }, () => {
  scenario('Stack: powershell\n', 'claude', (res, home) => {
    assert.equal(res.status, 0, res.stdout);
    assert.deepEqual(res.lines, [
      ...head(home, 'powershell', 'Language Add-on: none'),
      wNoAddon('powershell', ' Workflow Core only.'),
    ]);
    assert.equal(res.ran, true, 'claude stub did not run');
  });
});

test('[R39-04] two stacks with no add-on print one warning each in written order', { skip: SKIP }, () => {
  scenario('Stack: powershell, go\n', 'claude', (res, home) => {
    assert.equal(res.status, 0, res.stdout);
    assert.deepEqual(res.lines, [
      ...head(home, 'powershell, go', 'Language Add-on: none'),
      wNoAddon('powershell', ' Workflow Core only.'),
      wNoAddon('go', ' Workflow Core only.'),
    ]);
    assert.equal(res.ran, true, 'claude stub did not run');
  });
});
