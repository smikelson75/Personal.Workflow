import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE =
  'usage: node trace.mjs [--tap <file>] [--phase-file <path>] [--skip-pattern] <scenario-ID>...  (exit 0 only when every ID has a passing test and no unlisted test fails)';
const argv = process.argv.slice(2);

if (argv.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}

let tapPath;
let phasePath;
let skipPattern = false;
const ids = [];
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--tap' || arg === '--phase-file') {
    const value = argv[++i];
    if (value === undefined) {
      console.error(USAGE);
      process.exit(2);
    }
    if (arg === '--tap') tapPath = value;
    else phasePath = value;
  } else if (arg === '--skip-pattern') skipPattern = true;
  else if (arg.startsWith('--')) continue;
  else ids.push(arg);
}

if (ids.length === 0 && !skipPattern) {
  console.error(USAGE);
  process.exit(2);
}

// Known Failures excluded from this gate: owner number greater than the gated phase's number.
let excluded = [];
if (phasePath !== undefined) {
  const phaseLines = readFileSync(phasePath, 'utf8').split(/\r?\n/);
  const gated = /^# P(\d+)\b/.exec(phaseLines[0] ?? '');
  const gatedNumber = gated ? Number(gated[1]) : Number.NEGATIVE_INFINITY;
  const known = [];
  let inSection = false;
  for (const line of phaseLines) {
    if (line.startsWith('- **Known failures')) inSection = true;
    else if (line.startsWith('- **')) inSection = false;
    else if (inSection) {
      const entry = /^\s+- `(.+)` - owner (P\d+)\s*$/.exec(line);
      if (entry) known.push({ title: entry[1], owner: Number(entry[2].slice(1)) });
    }
  }
  excluded = gated ? known.filter((k) => k.owner > gatedNumber).map((k) => k.title) : [];
}

if (skipPattern) {
  if (excluded.length) {
    const escaped = excluded.map((title) => `^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    console.log(escaped.join('|'));
  }
  process.exit(0);
}

let tap;
if (tapPath !== undefined) {
  tap = readFileSync(tapPath, 'utf8');
} else {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `${root.split('\\').join('/')}/tests/acceptance/*.test.mjs`], {
    encoding: 'utf8',
  });
  tap = run.stdout;
}

const excludedSet = new Set(excluded);
const passed = new Set();
let failed = false;
for (const line of tap.split(/\r?\n/)) {
  const match = /^\s*(not ok|ok) \d+ - (.*)$/.exec(line);
  if (!match) continue;
  const title = match[2];
  if (match[1] === 'not ok') {
    if (excludedSet.has(title)) continue;
    console.error(`unlisted failing test: ${title}`);
    failed = true;
  } else {
    const tag = /^\[([^\]]+)\]/.exec(title);
    if (tag) passed.add(tag[1]);
  }
}
const missing = ids.filter((id) => !passed.has(id));
if (missing.length) console.error(`no passing test for: ${missing.join(', ')}`);
process.exit(missing.length || failed ? 1 : 0);
