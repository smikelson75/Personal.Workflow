import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = 'usage: launch claude|copilot [args...] | version';
const home = realpathSync.native(dirname(fileURLToPath(import.meta.url)));

function fail(category, detail, usage = false) {
  console.log(`launch failed: ${category}: ${detail}`);
  if (usage) console.log(USAGE);
  process.exitCode = 1;
}

function manifestPath() {
  const gitPath = execFileSync('git', ['-C', home, 'rev-parse', '--git-path', 'personal-workflow'], {
    encoding: 'utf8',
  }).trim();
  return join(resolve(home, gitPath), 'manifest.json');
}

// Returns { version } when the last Update Script run completed, otherwise prints the failure and returns null.
function checkInstall() {
  let manifest = null;
  try {
    const path = manifestPath();
    if (existsSync(path)) manifest = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    manifest = null;
  }
  if (manifest === null || typeof manifest !== 'object' || typeof manifest.version !== 'string') {
    fail('workflow-not-installed', 'run scripts/update-home.mjs from a Personal.Workflow clone');
    return null;
  }
  if (manifest.status !== 'complete') {
    fail('update-incomplete', 'rerun scripts/update-home.mjs');
    return null;
  }
  return { version: manifest.version };
}

function resolveCommand(name) {
  const win = process.platform === 'win32';
  const exts = win ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : [''];
  for (const dir of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const file = join(dir, name + ext);
      if (existsSync(file) && statSync(file).isFile()) return file;
    }
  }
  return null;
}

const quote = (s) => `"${s.replaceAll('"', '""')}"`;

function startHarness(file, args) {
  const batch = /\.(cmd|bat)$/i.test(file);
  const child = batch
    ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `"${[file, ...args].map(quote).join(' ')}"`], {
        stdio: 'inherit',
        windowsVerbatimArguments: true,
      })
    : spawn(file, args, { stdio: 'inherit' });
  child.on('error', () => {
    process.exitCode = 1;
  });
  child.on('close', (code) => {
    process.exitCode = code ?? 1;
  });
}

const mode = process.argv[2];
if (mode === undefined) {
  fail('missing-harness', 'no Harness given', true);
} else if (mode === 'version') {
  const install = checkInstall();
  if (install) {
    console.log(`Workflow version: ${install.version}`);
    console.log(`Home Repo: ${home}`);
  }
} else if (['claude', 'copilot'].includes(mode.toLowerCase())) {
  const harness = mode.toLowerCase();
  const install = checkInstall();
  if (install) {
    const file = resolveCommand(harness);
    if (file === null) fail('harness-not-installed', harness);
    else startHarness(file, process.argv.slice(3));
  }
} else {
  fail('unknown-harness', mode, true);
}
