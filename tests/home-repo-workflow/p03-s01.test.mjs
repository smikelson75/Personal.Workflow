import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { repoRoot, tempRepo } from '../../.github/tools/workflow-core/support/harness.mjs';

const WIN = process.platform === 'win32';

const ADDONS = {
  csharp: ['dotnet-editorconfig', 'stryker-dotnet'],
  'node-javascript': ['eslint-javascript', 'stryker-javascript', 'vitest-javascript'],
  'node-typescript': ['eslint-typescript', 'stryker-typescript', 'vitest-typescript'],
};

function put(root, rel, text) {
  const target = join(root, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

function copyIfPresent(from, to) {
  if (existsSync(from)) {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
}

// Home fixture from the phase header. `manifest` is the manifest text, or null for none.
function makeHome(manifest) {
  const repo = tempRepo();
  const dir = realpathSync.native(repo.dir);
  copyIfPresent(join(repoRoot, 'home', 'launch.mjs'), join(dir, 'launch.mjs'));
  copyIfPresent(join(repoRoot, 'home', 'launch.cmd'), join(dir, 'launch.cmd'));
  if (manifest !== null) put(dir, '.git/personal-workflow/manifest.json', manifest);
  for (const [id, skills] of Object.entries(ADDONS)) {
    for (const skill of skills) {
      const body = skill.startsWith('stryker-')
        ? `# ${skill}\n\nSee [protocol](../mutation-testing/protocol.md)\n`
        : `# ${skill}\n`;
      put(dir, `.workflow-core/language-addons/${id}/${skill}/SKILL.md`, body);
    }
  }
  put(dir, '.workflow-core/language-addons/mutation-testing/protocol.md', '# protocol\n');
  copyIfPresent(
    join(repoRoot, '.github', 'hooks', 'scripts', 'guard-locked-tests.mjs'),
    join(dir, '.workflow-core', 'hooks', 'scripts', 'guard-locked-tests.mjs'),
  );
  repo.write('README.md', '# home\n');
  repo.commit('init');
  return { repo, dir };
}

const COMPLETE = '{"version":"3f9a2c1","status":"complete","files":[]}';
const INCOMPLETE = '{"version":"3f9a2c1","status":"incomplete","files":[]}';

function scenario(manifest, fn) {
  const { repo, dir } = makeHome(manifest);
  const other = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfwork-')));
  try {
    fn({ home: dir, other });
  } finally {
    repo.cleanup();
    rmSync(other, { recursive: true, force: true });
  }
}

function splitLines(text) {
  const out = (text ?? '').split(/\r?\n/);
  while (out.length && out[out.length - 1] === '') out.pop();
  return out;
}

function launchVersion(home, cwd) {
  const res = spawnSync(process.execPath, [join(home, 'launch.mjs'), 'version'], {
    cwd,
    encoding: 'utf8',
  });
  return { status: res.status, stdout: res.stdout ?? '', lines: splitLines(res.stdout) };
}

function powershell(script, cwd) {
  const res = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { cwd, encoding: 'utf8' },
  );
  return { status: res.status, stdout: res.stdout ?? '', lines: splitLines(res.stdout), stderr: res.stderr ?? '' };
}

test('[R40-01] version prints the Workflow version and Home Repo from any folder', () => {
  scenario(COMPLETE, ({ home, other }) => {
    const res = launchVersion(home, other);
    assert.deepEqual(res.lines, ['Workflow version: 3f9a2c1', `Home Repo: ${home}`], res.stdout);
    assert.equal(res.status, 0);
  });
});

test('[R40-02] version without a manifest fails with workflow-not-installed', () => {
  scenario(null, ({ home, other }) => {
    const res = launchVersion(home, other);
    assert.ok(res.stdout.startsWith('launch failed: workflow-not-installed:'), res.stdout);
    assert.ok(res.stdout.includes('scripts/update-home.mjs'), res.stdout);
    assert.equal(res.status, 1);
  });
});

test('[R40-03] version with an incomplete manifest fails with update-incomplete', () => {
  scenario(INCOMPLETE, ({ home, other }) => {
    const res = launchVersion(home, other);
    assert.ok(res.stdout.startsWith('launch failed: update-incomplete:'), res.stdout);
    assert.match(res.stdout, /rerun scripts\/update-home\.mjs/);
    assert.equal(res.status, 1);
  });
});

test('[R41-01] a fresh PowerShell runs the Launch Script by path with default policy', { skip: !WIN }, () => {
  scenario(COMPLETE, ({ home, other }) => {
    const res = powershell(`& '${join(home, 'launch')}' version; exit $LASTEXITCODE`, other);
    assert.deepEqual(res.lines, ['Workflow version: 3f9a2c1', `Home Repo: ${home}`], res.stdout + res.stderr);
    assert.equal(res.status, 0);
  });
});

test('[R41-02] the wf function prints the same output as calling the Launch Script by path', { skip: !WIN }, () => {
  scenario(COMPLETE, ({ home, other }) => {
    const launch = join(home, 'launch');
    const direct = powershell(`& '${launch}' version; exit $LASTEXITCODE`, other);
    const viaWf = powershell(
      `function wf { & '${launch}' @args }; wf version; exit $LASTEXITCODE`,
      other,
    );
    assert.deepEqual(direct.lines, ['Workflow version: 3f9a2c1', `Home Repo: ${home}`], direct.stdout + direct.stderr);
    assert.equal(viaWf.stdout, direct.stdout);
    assert.equal(viaWf.status, 0);
  });
});

test('[R41-03] after the Update Script, the installed launcher prints the version the Update Script printed', () => {
  const repo = tempRepo();
  const home = realpathSync.native(repo.dir);
  try {
    repo.write('AGENTS.md', '# Home\n');
    repo.commit('init');
    const upd = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'update-home.mjs'), home], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    assert.equal(upd.status, 0, upd.stdout);
    const m = /^Workflow version: \S+ -> ([0-9a-f]{7})$/m.exec(upd.stdout ?? '');
    assert.ok(m, `no version line in: ${upd.stdout}`);
    assert.ok(existsSync(join(home, 'launch.mjs')), 'launch.mjs not installed');
    assert.ok(existsSync(join(home, 'launch.cmd')), 'launch.cmd not installed');
    const res = launchVersion(home, tmpdir());
    assert.equal(res.lines[0], `Workflow version: ${m[1]}`, res.stdout);
    assert.equal(res.lines[1], `Home Repo: ${home}`);
    assert.equal(res.status, 0);
  } finally {
    repo.cleanup();
  }
});
