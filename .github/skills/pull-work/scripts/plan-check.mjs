// Checks that a completed phase left plan.md showing current truth: the phase is
// completed, no slice table or Review pending line remains, the current state
// lines exist, and the gap line lists exactly the spec IDs not yet covered.
// Problems go to stderr, one per line. Exit 0 (ok), 1 (problem found), 2 (usage).
// Usage: node plan-check.mjs <slug> <PNN>   (run from the repository root)
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const USAGE = 'usage: node plan-check.mjs <slug> <PNN>';
const STATE_NAMES = ['harness', 'suite baseline', 'in place'];

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}
if (args.length < 2) {
  console.error(USAGE);
  process.exit(2);
}

const [slug, pnn] = args;
const root = process.cwd();
const specPath = resolve(root, join('.workflow', 'specs', `${slug}-spec.md`));
const planPath = resolve(root, join('.workflow', 'plans', slug, 'plan.md'));

for (const path of [specPath, planPath]) {
  if (!existsSync(path)) {
    console.error(`missing file: ${path.split('\\').join('/')}`);
    process.exit(1);
  }
}

const specLines = readFileSync(specPath, 'utf8').split(/\r?\n/);
const planLines = readFileSync(planPath, 'utf8').split(/\r?\n/);

// Spec IDs in spec order: requirement headings, then quality threshold bullets.
function specIds(lines) {
  const ids = [];
  let inQuality = false;
  for (const line of lines) {
    if (/^## /.test(line)) inQuality = /^## Quality Thresholds\s*$/.test(line);
    const heading = /^### (R\d+) - /.exec(line);
    if (heading) ids.push(heading[1]);
    if (inQuality) {
      const bullet = /^- (.+?) -> /.exec(line);
      if (bullet) {
        const name = bullet[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        ids.push(`Q-${name}`);
      }
    }
  }
  return ids;
}

// Phase rows: | P<nn> | name | status | covers |
function phaseRows(lines) {
  return lines
    .filter((line) => /^\|\s*P\d+\s*\|/.test(line))
    .map((line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()))
    .map(([phase, name, status, covers = '']) => ({ phase, name, status, covers }));
}

// Covers split on commas outside parentheses; each item gives an ID and a partial flag.
function parseCovers(text) {
  const items = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      items.push(current);
      current = '';
    } else current += ch;
  }
  items.push(current);
  const out = [];
  for (const raw of items) {
    const item = raw.trim();
    const match = /^(R\d+|Q-[A-Za-z0-9-]+)/.exec(item);
    if (!match) continue;
    out.push({ id: match[1], partial: item.slice(match[1].length).trim() !== '' });
  }
  return out;
}

const fmt = (items) => (items.length ? items.join(', ') : 'none');
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

const rows = phaseRows(planLines);
const row = rows.find((r) => r.phase === pnn);
if (!row) {
  console.error(`phase ${pnn} not found`);
  process.exit(1);
}

const problems = [];

if (row.status !== 'completed') problems.push(`phase ${pnn} not completed`);

if (planLines.some((line) => line.trim() === `## ${pnn} slices`)) {
  problems.push(`slice table ${pnn} present`);
}

if (planLines.some((line) => /^- Review pending|^Review pending:/.test(line))) {
  problems.push('Review pending present');
}

for (const name of STATE_NAMES) {
  if (!planLines.some((line) => line.startsWith(`- ${name}:`))) {
    problems.push(`missing current state line: ${name}`);
  }
}

// Expected gap: spec IDs not fully covered by any completed phase.
const fullyCovered = new Set();
const partlyCovered = new Set();
for (const r of rows) {
  if (r.status !== 'completed') continue;
  for (const item of parseCovers(r.covers)) {
    if (item.partial) partlyCovered.add(item.id);
    else fullyCovered.add(item.id);
  }
}
const expected = specIds(specLines)
  .filter((id) => !fullyCovered.has(id))
  .map((id) => (partlyCovered.has(id) ? `${id} partial` : id));

// Found gap: items after "- gap to spec:" in the plan.
const gapLine = planLines.find((line) => /^- gap to spec:/.test(line));
const gapValue = gapLine ? gapLine.replace(/^- gap to spec:/, '').trim() : 'none';
const found = gapValue === 'none' || gapValue === ''
  ? []
  : gapValue.split(',').map((s) => s.trim()).filter((s) => s !== '');

if (!sameSet(expected, found)) {
  problems.push(`gap mismatch: expected ${fmt(expected)} but found ${fmt(found)}`);
}

const nextLine = planLines.find((line) => /^- Next:/.test(line));
const nextValue = nextLine ? nextLine.replace(/^- Next:/, '').trim() : '';
if (nextValue === 'done' && expected.length > 0) {
  problems.push(`Next is done with uncovered IDs: ${expected.join(', ')}`);
}

for (const problem of problems) console.error(problem);
process.exit(problems.length ? 1 : 0);
