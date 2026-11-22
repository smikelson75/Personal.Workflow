// Traceability check for a Vitest suite: runs the suite once with the JSON
// reporter and exits 0 only when every given scenario ID has a passing test
// (title starting with `[ID]`) and no test failed.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const USAGE = 'usage: node trace.mjs [--config <vitest config>] <scenario-ID>...  (exit 0 only when every ID has a passing test and none fail)';
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}
const configAt = args.indexOf('--config');
const config = configAt === -1 ? null : args[configAt + 1];
const ids = args.filter((_, i) => configAt === -1 || (i !== configAt && i !== configAt + 1));
if (ids.length === 0 || (configAt !== -1 && !config)) {
  console.error(USAGE);
  process.exit(2);
}

let vitestBin;
try {
  const pkgPath = createRequire(join(process.cwd(), 'package.json')).resolve('vitest/package.json');
  vitestBin = join(dirname(pkgPath), JSON.parse(readFileSync(pkgPath, 'utf8')).bin.vitest);
} catch {
  console.error('vitest is not installed in this project');
  process.exit(2);
}

const dir = mkdtempSync(join(tmpdir(), 'trace-'));
const outputFile = join(dir, 'results.json');
const vitestArgs = [vitestBin, 'run', '--reporter=json', `--outputFile=${outputFile}`];
if (config) vitestArgs.push('--config', config);
spawnSync(process.execPath, vitestArgs, { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
if (!existsSync(outputFile)) {
  console.error('vitest wrote no JSON results; run the suite directly to see the error');
  process.exit(2);
}
const results = JSON.parse(readFileSync(outputFile, 'utf8'));
rmSync(dir, { recursive: true, force: true });

const passed = new Set();
let failed = results.numFailedTestSuites > 0;
for (const file of results.testResults ?? []) {
  for (const test of file.assertionResults ?? []) {
    if (test.status === 'failed') failed = true;
    if (test.status !== 'passed') continue;
    const tag = /^\[([^\]]+)\]/.exec(test.title);
    if (tag) passed.add(tag[1]);
  }
}
const missing = ids.filter((id) => !passed.has(id));
if (missing.length) console.error(`no passing test for: ${missing.join(', ')}`);
if (failed) console.error('some tests failed');
process.exit(missing.length || failed ? 1 : 0);
