import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIPPED_DIRS = new Set(['tests', 'node_modules', '.git']);

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
    if (!name.includes('/') && name.endsWith('.agent.md')) plan.set(`.claude/agents/${name}`, rel);
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

function fingerprint(plan) {
  const hash = createHash('sha256');
  for (const [homePath, sourcePath] of plan) {
    const content = readFileSync(join(sourceRoot, sourcePath)).toString('utf8').replace(/\r\n/g, '\n');
    hash.update(Buffer.concat([Buffer.from(homePath, 'utf8'), Buffer.from([0]), Buffer.from(content, 'utf8'), Buffer.from([0])]));
  }
  return hash.digest('hex').slice(0, 7);
}

function readManifest(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
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

function main() {
  const home = resolve(process.argv[2]);
  const gitPath = execFileSync('git', ['-C', home, 'rev-parse', '--git-path', 'personal-workflow'], { encoding: 'utf8' }).trim();
  const manifestPath = join(resolve(home, gitPath), 'manifest.json');
  const previous = readManifest(manifestPath);
  const previousFiles = new Set(previous?.files ?? []);

  const plan = planInstall();
  const version = fingerprint(plan);
  let installed = 0;
  let replaced = 0;
  let removed = 0;

  for (const [homePath, sourcePath] of plan) {
    const target = join(home, homePath);
    const content = readFileSync(join(sourceRoot, sourcePath));
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
    const target = join(home, homePath);
    if (existsSync(target)) {
      rmSync(target);
      removeEmptyParents(home, target);
    }
    removed += 1;
  }

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify({ version, status: 'complete', files: [...plan.keys()] }, null, 2) + '\n');

  console.log(`Home Repo: ${home}`);
  console.log(`Workflow version: ${previous?.version ?? 'none'} -> ${version}`);
  console.log(`Files: ${installed} installed, ${replaced} replaced, ${removed} removed`);
}

main();
