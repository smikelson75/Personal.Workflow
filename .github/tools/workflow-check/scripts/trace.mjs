import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = 'usage: node trace.mjs <scenario-ID>...  (exit 0 only when every ID has a passing test and none fail)';
const ids = process.argv.slice(2);

if (ids.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}
if (ids.length === 0) {
  console.error(USAGE);
  process.exit(2);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `${root.split('\\').join('/')}/tests/acceptance/*.test.mjs`], {
  encoding: 'utf8',
});
const passed = new Set();
let failed = false;
for (const line of run.stdout.split(/\r?\n/)) {
  const match = /^\s*(not ok|ok) \d+ - (.*)$/.exec(line);
  if (!match) continue;
  if (match[1] === 'not ok') failed = true;
  else {
    const tag = /^\[([^\]]+)\]/.exec(match[2]);
    if (tag) passed.add(tag[1]);
  }
}
const missing = ids.filter((id) => !passed.has(id));
if (missing.length) console.error(`no passing test for: ${missing.join(', ')}`);
if (failed) console.error('some tests failed');
process.exit(missing.length || failed ? 1 : 0);
