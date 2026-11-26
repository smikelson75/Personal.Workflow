import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
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

const STACK_LINE = /^\s*(?:-\s+)?stack:(.*)$/i;
const NOTE =
  'note: Copilot CLI skips the locked-tests guard in untrusted folders; trust this folder when asked. The Gate still verifies locked tests.';

// Reads the first Stack line of <cwd>/AGENTS.md. hasAgents is false when the file is missing.
function readStack(cwd) {
  const file = join(cwd, 'AGENTS.md');
  if (!existsSync(file)) return { hasAgents: false, value: '', ids: [] };
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = STACK_LINE.exec(line);
    if (match) {
      const value = match[1].trim();
      const ids = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return { hasAgents: true, value, ids };
    }
  }
  return { hasAgents: true, value: '', ids: [] };
}

// Returns a Map from each Language Add-on ID (sorted) to its skill folder names (sorted).
function listAddons(home) {
  const root = join(home, '.workflow-core', 'language-addons');
  const addons = new Map();
  if (!existsSync(root)) return addons;
  const ids = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const id of ids) {
    const skills = readdirSync(join(root, id), { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(root, id, e.name, 'SKILL.md')))
      .map((e) => e.name)
      .sort();
    if (skills.length > 0) addons.set(id, skills);
  }
  return addons;
}

function sameFolder(a, b) {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

// Prints the stack statement, loaded add-ons, the Copilot note, and warnings before the Harness starts.
function announce(harness, version) {
  const cwd = realpathSync.native(process.cwd());
  const lines = [`Home Repo: ${home}`, `Workflow version: ${version}`];
  const warnings = [];
  if (sameFolder(cwd, home)) {
    lines.push('Stack: none (Home Repo)', 'Language Add-on: none');
  } else {
    const addons = listAddons(home);
    const stack = readStack(cwd);
    const loaded = stack.ids.filter((id) => addons.has(id));
    const unknown = stack.ids.filter((id) => !addons.has(id));
    lines.push(`Stack: ${stack.ids.length > 0 ? stack.value : 'none'}`);
    if (loaded.length === 0) lines.push('Language Add-on: none');
    for (const id of loaded) lines.push(`Language Add-on: ${id} (${addons.get(id).join(', ')})`);
    if (!stack.hasAgents) {
      warnings.push(
        'warning: no AGENTS.md in this folder; starting Workflow Core only. Run /agents-md to create one with a Stack line.',
      );
    } else if (stack.ids.length === 0) {
      warnings.push(
        'warning: AGENTS.md names no stack; starting Workflow Core only. Run /agents-md to add a Stack line.',
      );
    }
    const available = [...addons.keys()].join(', ');
    const tail = loaded.length === 0 ? ' Workflow Core only.' : '';
    for (const id of unknown) {
      warnings.push(`warning: no Language Add-on for stack '${id}'; available: ${available}.${tail}`);
    }
  }
  if (harness === 'copilot') lines.push(NOTE);
  for (const line of [...lines, ...warnings]) console.log(line);
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
    else {
      announce(harness, install.version);
      startHarness(file, process.argv.slice(3));
    }
  }
} else {
  fail('unknown-harness', mode, true);
}
