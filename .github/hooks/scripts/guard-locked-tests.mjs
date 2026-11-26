// preToolUse hook: denies file edits to locked acceptance tests outside the
// workflow modes allowed to change them (Fixture Repair and Phase Review).
// Any internal error allows the call: command preToolUse hooks fail closed,
// and a broken guard must not block every edit.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const PHASE_REVIEW = /^phase review\b/;
const FIXTURE_REPAIR = /^fixture repair (S\d+)/;
const EDIT_TOOL = /edit|create|write|patch|replace|insert/i;

function allow() {
  process.stdout.write('{}');
  process.exit(0);
}

function targetPaths(toolArgs) {
  const paths = [];
  const visit = (value, key) => {
    if (typeof value === 'string') {
      if (/^(path|filePath|file_path|notebook_path)$/.test(key ?? '')) paths.push(value);
      if (key === 'input') {
        for (const m of value.matchAll(/^\*\*\* (?:Update|Delete|Add) File: (.+)$/gm)) paths.push(m[1].trim());
      }
    } else if (Array.isArray(value)) {
      value.forEach((v) => visit(v));
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) visit(v, k);
    }
  };
  visit(toolArgs);
  return paths;
}

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function isTrackedAt(root, ref, rel) {
  try {
    execFileSync('git', ['-C', root, 'cat-file', '-e', `${ref}:${rel}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function backticked(text) {
  return [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].replace(/\/+$/, ''));
}

// Paths the card being repaired may change, read from the newest phase file.
function repairPaths(planDir, cardId) {
  const phases = readdirSync(planDir).filter((n) => /^phase-\d+\.md$/.test(n)).sort();
  if (phases.length === 0) return [];
  const text = readFileSync(join(planDir, phases[phases.length - 1]), 'utf8');
  const card = text.split(/^(?=## S\d+ )/m).find((c) => c.startsWith(`## ${cardId} `));
  const line = card?.match(/^- \*\*Acceptance tests:\*\* (.*)$/m)?.[1];
  return line ? backticked(line) : [];
}

const under = (rel, roots) => roots.some((o) => rel === o || rel.startsWith(`${o}/`));

function isDirectory(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// Repository containing abs, found from its nearest existing ancestor folder.
// Null means the path is outside any repository.
function repoRootOf(abs) {
  let dir = abs;
  while (!isDirectory(dir)) {
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  try {
    return git(dir, ['rev-parse', '--show-toplevel']);
  } catch {
    return null;
  }
}

// abs with its existing part spelled as on disk; segments below the nearest
// existing ancestor keep the spelling they were given.
function onDiskSpelling(abs) {
  let existing = abs;
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) return abs;
    existing = parent;
  }
  try {
    return join(realpathSync.native(existing), relative(existing, abs));
  } catch {
    return abs;
  }
}

function readLocks(root) {
  const plansDir = join(root, '.workflow', 'plans');
  if (!existsSync(plansDir)) return [];
  const locks = [];
  for (const slug of readdirSync(plansDir)) {
    const planPath = join(plansDir, slug, 'plan.md');
    if (!existsSync(planPath)) continue;
    const plan = readFileSync(planPath, 'utf8');
    const ref = plan.match(/^- Tests locked: `([0-9a-f]{7,40})`/m)?.[1];
    const next = plan.match(/^- Next: (.*)$/m)?.[1] ?? '';
    const oracle = backticked(plan.match(/^- Oracle: (.*)$/m)?.[1] ?? '');
    if (!ref || oracle.length === 0 || PHASE_REVIEW.test(next)) continue;
    const repair = next.match(FIXTURE_REPAIR)?.[1];
    const allowed = repair ? repairPaths(join(plansDir, slug), repair) : [];
    locks.push({ slug, ref, oracle, allowed, repair });
  }
  return locks;
}

const locksByRoot = new Map();
function locksFor(root) {
  if (!locksByRoot.has(root)) locksByRoot.set(root, readLocks(root));
  return locksByRoot.get(root);
}

function deny(rel, slug, ref, repair) {
  const scope = repair
    ? `Fixture Repair ${repair} may change only its own Acceptance tests.`
    : 'Only Fixture Repair or Phase Review may change it.';
  const reason =
    `${rel} is a locked acceptance test (plan ${slug}, Tests locked ${ref}). ` +
    `${scope} Stop and report instead of editing it.`;
  process.stdout.write(JSON.stringify({
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

try {
  const event = JSON.parse(readFileSync(0, 'utf8'));
  const toolName = event.toolName ?? event.tool_name ?? '';
  if (!EDIT_TOOL.test(toolName)) allow();
  let toolArgs = event.toolArgs ?? event.tool_input ?? {};
  if (typeof toolArgs === 'string') toolArgs = JSON.parse(toolArgs);

  const cwd = event.cwd ?? process.cwd();
  for (const p of targetPaths(toolArgs)) {
    const abs = onDiskSpelling(isAbsolute(p) ? p : resolve(cwd, p));
    const root = repoRootOf(abs);
    if (!root) continue;
    const rel = relative(root, abs).split(sep).join('/');
    if (rel === '' || rel === '..' || rel.startsWith('../')) continue;
    for (const { slug, ref, oracle, allowed, repair } of locksFor(root)) {
      if (under(rel, oracle) && !under(rel, allowed) && isTrackedAt(root, ref, rel)) {
        deny(rel, slug, ref, repair);
      }
    }
  }
  allow();
} catch {
  allow();
}
