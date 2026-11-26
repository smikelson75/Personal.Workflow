import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIPPED_DIRS = new Set(['tests', 'node_modules', '.git']);
const USAGE = 'usage: node scripts/update-home.mjs <home-repo-path>';
const REQUIRED_SOURCE = ['.github/skills', '.github/agents', '.github/hooks', '.github/tools', 'language-addons'];
const PROJECT_STACK_LINE = /^\s*(?:[-*]\s+)?Stack:/m;
const CASE_INSENSITIVE = process.platform === 'win32';

// Claude Code form of an agent file: the source keeps a `model` list of Copilot display names and `reasoning-effort`;
// the Claude form replaces both with `model: <alias>` and `effort: <level>`.
const KNOWN_FAMILIES = new Set(['opus', 'sonnet', 'haiku', 'fable']);
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const TOP_LEVEL_KEY = /^([A-Za-z][A-Za-z0-9_-]*):(?:\s(.*))?$/;

function unquote(value) {
  const text = value.trim();
  const quote = text[0];
  if ((quote === '"' || quote === "'") && text.length >= 2 && text.endsWith(quote)) return text.slice(1, -1);
  return text;
}

// Splits a source into its frontmatter lines and the text from the closing `---` line on.
function splitFrontmatter(text) {
  const eol = text.startsWith('---\r\n') ? '\r\n' : '\n';
  const lines = text.split(/(?<=\n)/);
  if (lines.length === 0 || lines[0].replace(/\r?\n$/, '') !== '---') return null;
  const close = lines.findIndex((line, i) => i > 0 && line.replace(/\r?\n$/, '') === '---');
  if (close < 0) return null;
  return {
    eol,
    front: lines.slice(1, close).map((line) => line.replace(/\r?\n$/, '')),
    rest: lines.slice(close).join(''),
  };
}

function readModelEntries(front) {
  const start = front.findIndex((line) => /^model:/.test(line));
  if (start < 0) return { entries: [], start: -1, end: -1 };
  let end = start + 1;
  while (end < front.length && !TOP_LEVEL_KEY.test(front[end])) end += 1;
  const inline = front[start].slice('model:'.length).trim();
  let entries = [];
  if (inline.startsWith('[')) {
    entries = inline.replace(/^\[|\]\s*$/g, '').split(',').map(unquote).filter(Boolean);
  } else if (inline !== '') {
    entries = [unquote(inline)];
  } else {
    for (const line of front.slice(start + 1, end)) {
      const item = /^\s*-\s+(.+)$/.exec(line);
      if (item) entries.push(unquote(item[1]));
    }
  }
  return { entries, start, end };
}

// The word after `Claude` in a Claude entry, lower-cased; empty when there is no next word.
function claudeFamily(entry) {
  return (/^claude\s+(\S+)/i.exec(entry)?.[1] ?? '').toLowerCase();
}

function pickAlias(entries) {
  for (const entry of entries) {
    if (!/^claude\b/i.test(entry)) continue;
    const family = claudeFamily(entry);
    if (KNOWN_FAMILIES.has(family)) return family;
  }
  return null;
}

function pickEffort(front) {
  const line = front.find((l) => /^reasoning-effort:/.test(l));
  if (line === undefined) return null;
  const value = unquote(line.slice('reasoning-effort:'.length)).toLowerCase();
  if (value === 'none' || value === 'minimal') return 'low';
  return EFFORTS.has(value) ? value : null;
}

// Returns the Claude Code form of an agent file plus one notice per Claude entry with an unknown family, in list order.
function renderClaudeForm(text, agent) {
  const parts = splitFrontmatter(text);
  if (!parts) return { text, notices: [] };

  const { entries, start, end } = readModelEntries(parts.front);
  const alias = pickAlias(entries);
  const effort = pickEffort(parts.front);

  const notices = entries
    .filter((entry) => /^claude\b/i.test(entry) && !KNOWN_FAMILIES.has(claudeFamily(entry)))
    .map((entry) => `Agent pin: ${agent}: skipped "${entry.replace(/"/g, '')}" (not a Claude Code model family)`);

  const kept = parts.front.filter((line, i) => !(i >= start && i < end && start >= 0) && !/^reasoning-effort:/.test(line));
  if (alias) kept.push(`model: ${alias}`);
  if (effort) kept.push(`effort: ${effort}`);

  const body = ['---', ...kept].map((line) => line + parts.eol).join('') + parts.rest;
  return { text: body, notices };
}

function walk(rel) {
  const found = [];
  const dir = join(sourceRoot, rel);
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryRel = `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) found.push(...walk(entryRel));
    } else if (entry.isFile()) {
      found.push(entryRel);
    }
  }
  return found;
}

// Install map: source path -> Home Repo path, sorted by Home path.
function planInstall() {
  const plan = new Map();
  const mapTree = (sourceDir, homeDir) => {
    for (const rel of walk(sourceDir)) plan.set(`${homeDir}${rel.slice(sourceDir.length)}`, rel);
  };

  mapTree('.github/skills', '.claude/skills');
  for (const rel of walk('.github/agents')) {
    const name = rel.slice('.github/agents/'.length);
    if (!name.includes('/') && name.endsWith('.agent.md')) {
      plan.set(`.claude/agents/${name}`, rel);
      plan.set(`.github/agents/${name}`, rel);
    }
  }
  mapTree('.github/hooks', '.workflow-core/hooks');
  mapTree('.github/tools', '.workflow-core/tools');
  if (existsSync(join(sourceRoot, '.github/user-interaction.md'))) {
    plan.set('.workflow-core/user-interaction.md', '.github/user-interaction.md');
  }
  mapTree('language-addons', '.workflow-core/language-addons');
  mapTree('home', '');

  return new Map([...plan].map(([homePath, rel]) => [homePath.replace(/^\//, ''), rel]).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

// Agent name: the source file name without `.agent.md`.
function agentName(sourcePath) {
  return sourcePath.slice('.github/agents/'.length).replace(/\.agent\.md$/, '');
}

// Bytes installed at homePath plus the notices for that file. Claude Code reads `.claude/agents/`, so those files
// get the Claude form; every other path is the source file as it is.
function contentFor(homePath, sourcePath) {
  const raw = readFileSync(join(sourceRoot, sourcePath));
  if (homePath.startsWith('.claude/agents/') && sourcePath.startsWith('.github/agents/')) {
    const rendered = renderClaudeForm(raw.toString('utf8'), agentName(sourcePath));
    return { content: Buffer.from(rendered.text, 'utf8'), notices: rendered.notices };
  }
  return { content: raw, notices: [] };
}

function fingerprint(plan) {
  const hash = createHash('sha256');
  for (const [homePath, sourcePath] of plan) {
    const content = contentFor(homePath, sourcePath).content.toString('utf8').replace(/\r\n/g, '\n');
    hash.update(Buffer.concat([Buffer.from(homePath, 'utf8'), Buffer.from([0]), Buffer.from(content, 'utf8'), Buffer.from([0])]));
  }
  return hash.digest('hex').slice(0, 7);
}

// Manifest paths are Home-relative with `/` separators. Anything else (absolute, drive letter,
// backslash, `..` segment, inside .git) is dropped, so a corrupt manifest can never name a file to delete outside the managed set.
function isSafeManifestPath(path) {
  if (typeof path !== 'string' || path === '' || /^[a-zA-Z]:|[\\\0]|^\//.test(path)) return false;
  const parts = path.split('/');
  return !parts.some((part) => part === '' || part === '.' || part === '..' || /[:. ]$|:/.test(part)) && !/^(\.git|git~\d+)$/i.test(parts[0]);
}

function readManifest(path) {
  try {
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    if (manifest === null || typeof manifest !== 'object') return null;
    const files = Array.isArray(manifest.files) ? manifest.files.filter(isSafeManifestPath) : [];
    return { ...manifest, version: typeof manifest.version === 'string' ? manifest.version : 'none', files };
  } catch {
    return null;
  }
}

function removeEmptyParents(home, file) {
  let dir = dirname(file);
  while (dir.length > home.length && dir.startsWith(home) && readdirSync(dir).length === 0) {
    rmSync(dir, { recursive: true });
    dir = dirname(dir);
  }
}

function manifestPathFor(home) {
  const gitPath = execFileSync('git', ['-C', home, 'rev-parse', '--git-path', 'personal-workflow'], { encoding: 'utf8' }).trim();
  return join(resolve(home, gitPath), 'manifest.json');
}

const EXCLUDE_BEGIN = '# personal-workflow:begin';
const EXCLUDE_END = '# personal-workflow:end';
const EXCLUDE_BLOCK = new RegExp(
  `^${EXCLUDE_BEGIN}\\r?\\n(?:(?!^${EXCLUDE_BEGIN})[\\s\\S])*?^${EXCLUDE_END}(?:\\r?\\n|$)`,
  'm',
);

function excludePathFor(home) {
  const gitPath = execFileSync('git', ['-C', home, 'rev-parse', '--git-path', 'info/exclude'], { encoding: 'utf8' }).trim();
  return resolve(home, gitPath);
}

// Replaces the managed block in .git/info/exclude so it lists exactly the installed paths.
// Lines outside the block are kept as they are.
function writeExcludeBlock(home, homePaths) {
  const path = excludePathFor(home);
  mkdirSync(dirname(path), { recursive: true });
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const block = [EXCLUDE_BEGIN, ...homePaths.map((p) => `/${p}`), EXCLUDE_END].join('\n') + '\n';
  if (EXCLUDE_BLOCK.test(existing)) {
    writeFileSync(path, existing.replace(EXCLUDE_BLOCK, () => block));
    return;
  }
  const separator = existing === '' || existing.endsWith('\n') ? '' : '\n';
  writeFileSync(path, existing + separator + block);
}

function normalizeCase(path) {
  return CASE_INSENSITIVE ? path.toLowerCase() : path;
}

// True when child is the same folder as parent or lies inside it. Both must be real paths.
function isSameOrInside(child, parent) {
  const rel = relative(normalizeCase(parent), normalizeCase(child));
  if (rel === '') return true;
  return rel.split(/[\\/]/)[0] !== '..' && !isAbsolute(rel);
}

// Validation step: returns null when the Home Repo target is safe, else { category, detail }.
// Runs before any write. Order matters: the first failing check wins.
function checkHome(arg) {
  if (!arg) return { category: 'missing-home-path', detail: 'no home repo path given' };

  const home = resolve(arg);
  if (!existsSync(home) || !statSync(home).isDirectory()) return { category: 'home-not-found', detail: arg };
  const homeReal = realpathSync.native(home);

  if (isSameOrInside(homeReal, realpathSync.native(sourceRoot))) return { category: 'home-is-source', detail: homeReal };

  let top = null;
  try {
    top = execFileSync('git', ['-C', homeReal, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    top = null;
  }
  if (!top || normalizeCase(realpathSync.native(top)) !== normalizeCase(homeReal)) {
    return { category: 'home-not-git', detail: homeReal };
  }

  const agentsPath = join(homeReal, 'AGENTS.md');
  if (existsSync(agentsPath) && PROJECT_STACK_LINE.test(readFileSync(agentsPath, 'utf8'))) {
    return { category: 'home-is-project', detail: agentsPath };
  }

  for (const rel of REQUIRED_SOURCE) {
    if (!existsSync(join(sourceRoot, rel))) return { category: 'incomplete-source', detail: rel };
  }

  const planned = new Set(planInstall().keys());
  for (const rel of readManifest(manifestPathFor(homeReal))?.files ?? []) planned.add(rel);
  const tracked = execFileSync('git', ['-C', homeReal, 'ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter((rel) => planned.has(rel))
    .sort();
  if (tracked.length > 0) return { category: 'tracked-workflow-files', detail: tracked.join(', ') };

  return null;
}

function main() {
  const failure = checkHome(process.argv[2]);
  if (failure) {
    console.log(`update failed: ${failure.category}: ${failure.detail}`);
    if (failure.category === 'missing-home-path') console.log(USAGE);
    process.exitCode = 1;
    return;
  }

  const home = resolve(process.argv[2]);
  const manifestPath = manifestPathFor(home);
  const previous = readManifest(manifestPath);
  const previousFiles = new Set(previous?.files ?? []);

  const plan = planInstall();
  const version = fingerprint(plan);
  let installed = 0;
  let replaced = 0;
  let removed = 0;

  // Mark the install incomplete before the first write. It keeps the previous version
  // and lists every path that may be touched, so a failed run can be rerun cleanly.
  const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const touched = [...new Set([...previousFiles, ...plan.keys()])].sort(compare);
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(
    manifestPath,
    JSON.stringify({ version: previous?.version ?? 'none', status: 'incomplete', files: touched }, null, 2) + '\n',
  );

  let current = null;
  const noticesByAgent = new Map();
  try {
    for (const [homePath, sourcePath] of plan) {
      current = homePath;
      const target = join(home, homePath);
      const { content, notices } = contentFor(homePath, sourcePath);
      if (notices.length > 0) {
        const name = agentName(sourcePath);
        noticesByAgent.set(name, [...(noticesByAgent.get(name) ?? []), ...notices]);
      }
      if (!previousFiles.has(homePath)) {
        installed += 1;
      } else if (!existsSync(target) || !readFileSync(target).equals(content)) {
        replaced += 1;
      }
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }

    for (const homePath of previousFiles) {
      if (plan.has(homePath)) continue;
      current = homePath;
      const target = join(home, homePath);
      if (existsSync(target)) {
        rmSync(target);
        removeEmptyParents(home, target);
      }
      removed += 1;
    }
  } catch {
    console.log(`update failed: copy-failed: ${current}`);
    process.exitCode = 1;
    return;
  }

  writeFileSync(manifestPath, JSON.stringify({ version, status: 'complete', files: [...plan.keys()] }, null, 2) + '\n');
  writeExcludeBlock(home, [...plan.keys()]);

  console.log(`Home Repo: ${home}`);
  console.log(`Workflow version: ${previous?.version ?? 'none'} -> ${version}`);
  console.log(`Files: ${installed} installed, ${replaced} replaced, ${removed} removed`);
  for (const name of [...noticesByAgent.keys()].sort()) {
    for (const notice of noticesByAgent.get(name)) console.log(notice);
  }
}

main();
