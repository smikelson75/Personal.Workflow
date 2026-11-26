import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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

const mode = process.argv[2];
if (mode === 'version') {
  const install = checkInstall();
  if (install) {
    console.log(`Workflow version: ${install.version}`);
    console.log(`Home Repo: ${home}`);
  }
} else {
  fail('unknown-harness', mode ?? '', true);
}
