// Reports whether a plan's spec changed since its reconcile point, and lists the
// plans /pull-work can pull. Output goes to stdout; problems go to stderr, one per
// line. Exit 0 (ok), 1 (problem found), 2 (usage error).
// Usage: node reconcile-check.mjs status <slug> | candidates   (run from the repository root)
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const USAGE = 'usage: node reconcile-check.mjs status <slug> | candidates';

const args = process.argv.slice(2);
const isStatus = args.length === 2 && args[0] === 'status';
const isCandidates = args.length === 1 && args[0] === 'candidates';
if (!isStatus && !isCandidates) {
  console.error(USAGE);
  process.exit(2);
}

const specPathOf = (slug) => `.workflow/specs/${slug}-spec.md`;
const planPathOf = (slug) => `.workflow/plans/${slug}/plan.md`;

// Spec text at a git ref, or null when the spec is absent at that ref.
function gitShow(ref, path) {
  const res = spawnSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' });
  return res.status === 0 ? res.stdout : null;
}

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

// The first Reconciled line of the plan, or null when there is none.
function reconcilePoint(planText) {
  if (planText === null) return null;
  for (const line of planText.split(/\r?\n/)) {
    const match = /^- Reconciled:\s*`([0-9a-f]{7,40})/.exec(line);
    if (match) return match[1];
  }
  return null;
}

// 'missing' when the spec is absent at HEAD; otherwise 'changed' or 'unchanged'.
// The working tree is never read.
function specStatus(slug) {
  const path = specPathOf(slug);
  const head = gitShow('HEAD', path);
  if (head === null) return 'missing';
  const ref = reconcilePoint(readIfExists(planPathOf(slug)));
  if (ref === null) return 'changed';
  const atRef = gitShow(ref, path);
  if (atRef === null) return 'changed';
  return atRef === head ? 'unchanged' : 'changed';
}

if (isStatus) {
  const result = specStatus(args[1]);
  if (result === 'missing') {
    console.error(`missing spec: ${specPathOf(args[1])}`);
    process.exitCode = 1;
  } else {
    console.log(result);
    process.exitCode = 0;
  }
} else {
  const slugs = new Set();
  if (existsSync('.workflow/specs')) {
    for (const name of readdirSync('.workflow/specs')) {
      const match = /^(.+)-spec\.md$/.exec(name);
      if (match) slugs.add(match[1]);
    }
  }
  if (existsSync('.workflow/plans')) {
    for (const entry of readdirSync('.workflow/plans', { withFileTypes: true })) {
      if (entry.isDirectory()) slugs.add(entry.name);
    }
  }

  const out = [];
  for (const slug of [...slugs].sort()) {
    const planText = readIfExists(planPathOf(slug));
    if (planText === null) {
      out.push(`${slug}\tno plan`);
      continue;
    }
    const nextLine = planText.split(/\r?\n/).find((line) => /^- Next:/.test(line));
    if (nextLine === undefined) continue;
    const next = nextLine.replace(/^- Next:/, '').trim();
    if (next !== 'done') {
      out.push(`${slug}\topen`);
    } else if (specStatus(slug) === 'changed') {
      out.push(`${slug}\tspec changed`);
    }
  }
  if (out.length > 0) process.stdout.write(`${out.join('\n')}\n`);
  process.exitCode = 0;
}
