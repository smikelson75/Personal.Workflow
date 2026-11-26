import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, dirname, join, resolve } from 'node:path';
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
  let loaded = [];
  if (sameFolder(cwd, home)) {
    lines.push('Stack: none (Home Repo)', 'Language Add-on: none');
  } else {
    const addons = listAddons(home);
    const stack = readStack(cwd);
    loaded = stack.ids.filter((id) => addons.has(id));
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
  return loaded;
}

const PLUGIN_PREFIX = 'workflow-stack-';
let pluginDir = null;

// Session plugin outside both repositories: loaded add-on skills plus the locked-tests guard hook.
function buildPlugin(version, loaded) {
  const plugin = mkdtempSync(join(tmpdir(), PLUGIN_PREFIX));
  pluginDir = plugin;
  mkdirSync(join(plugin, '.claude-plugin'));
  mkdirSync(join(plugin, 'hooks'));
  mkdirSync(join(plugin, 'skills'));
  writeFileSync(
    join(plugin, '.claude-plugin', 'plugin.json'),
    JSON.stringify({
      name: 'workflow-stack',
      version,
      description: 'Language Add-ons and locked-tests guard for this session',
    }),
  );
  const addonRoot = join(home, '.workflow-core', 'language-addons');
  const addons = listAddons(home);
  let needsProtocol = false;
  for (const id of loaded) {
    for (const skill of addons.get(id)) {
      const target = join(plugin, 'skills', skill);
      cpSync(join(addonRoot, id, skill), target, { recursive: true });
      if (readFileSync(join(target, 'SKILL.md'), 'utf8').includes('mutation-testing/protocol.md')) needsProtocol = true;
    }
  }
  const shared = join(addonRoot, 'mutation-testing');
  if (needsProtocol && existsSync(shared)) cpSync(shared, join(plugin, 'skills', 'mutation-testing'), { recursive: true });
  const guard = join(home, '.workflow-core', 'hooks', 'scripts', 'guard-locked-tests.mjs').replaceAll('\\', '/');
  writeFileSync(
    join(plugin, 'hooks', 'hooks.json'),
    JSON.stringify({
      hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: `node "${guard}"`, timeout: 10 }] }] },
    }),
  );
  return plugin;
}

// Deletes only the folder buildPlugin created: directly inside tmpdir() with the plugin prefix.
function removePlugin(plugin) {
  if (!basename(plugin).startsWith(PLUGIN_PREFIX)) return;
  if (!sameFolder(dirname(realpathSync.native(plugin)), realpathSync.native(tmpdir()))) return;
  rmSync(plugin, { recursive: true, force: true });
}

const quote = (s) => `"${s.replaceAll('"', '""')}"`;

function startHarness(file, args, plugin) {
  const batch = /\.(cmd|bat)$/i.test(file);
  const child = batch
    ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `"${[file, ...args].map(quote).join(' ')}"`], {
        stdio: 'inherit',
        windowsVerbatimArguments: true,
      })
    : spawn(file, args, { stdio: 'inherit' });
  const cleanup = () => removePlugin(plugin);
  // The child shares the console and receives Ctrl+C itself; cleanup waits for it to close.
  process.on('SIGINT', () => {});
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  child.on('error', () => {
    cleanup();
    process.exitCode = 1;
  });
  child.on('close', (code) => {
    cleanup();
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
      const loaded = announce(harness, install.version);
      let plugin = null;
      try {
        plugin = buildPlugin(install.version, loaded);
      } catch (error) {
        if (pluginDir) removePlugin(pluginDir);
        fail('launch-failed', error.message);
      }
      if (plugin) startHarness(file, ['--add-dir', home, '--plugin-dir', plugin, ...process.argv.slice(3)], plugin);
    }
  }
} else {
  fail('unknown-harness', mode, true);
}
