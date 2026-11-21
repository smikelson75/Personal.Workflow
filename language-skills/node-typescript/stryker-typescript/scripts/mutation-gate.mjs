// Runs StrykerJS, applies the mutation-testing protocol's Run Completeness rules
// to the JSON report, and prints a short summary. The full Stryker log is saved,
// not printed. Exit codes: 0 complete and at or above `break` (or nothing to
// mutate), 1 incomplete run or tool failure, 2 complete run below `break`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, matchesGlob, relative, resolve } from 'node:path';

const USAGE = `usage: node mutation-gate.mjs [--config stryker.config.json] [--unit tests/unit]
                         [--since <git-ref> | --mutate <file>...]
  --since   mutate only files changed since <git-ref> that match the config's mutate globs
  --mutate  mutate only these files (config "!" exclusions still apply)
  neither   mutate the config's whole mutate scope (one-time baseline)`;

const args = process.argv.slice(2);
const opts = { config: 'stryker.config.json', unit: 'tests/unit', since: null, mutate: [] };
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help') {
    console.log(USAGE);
    process.exit(0);
  } else if (arg === '--config') opts.config = args[++i];
  else if (arg === '--unit') opts.unit = args[++i];
  else if (arg === '--since') opts.since = args[++i];
  else if (arg === '--mutate') {
    while (args[i + 1] && !args[i + 1].startsWith('--')) opts.mutate.push(args[++i]);
  } else {
    fail(`unknown option: ${arg}\n${USAGE}`);
  }
}

const cwd = process.cwd();
const posix = (p) => p.split('\\').join('/');
const rel = (p) => posix(relative(cwd, resolve(cwd, p)));
const configPath = resolve(cwd, opts.config);
if (!existsSync(configPath)) fail(`config not found: ${opts.config}`);
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const patterns = config.mutate ?? [];
const include = patterns.filter((p) => !p.startsWith('!'));
const exclude = patterns.filter((p) => p.startsWith('!')).map((p) => p.slice(1));
const inScope = (file) => include.some((g) => matchesGlob(file, g)) && !exclude.some((g) => matchesGlob(file, g));

let requested = opts.mutate.map(posix);
if (opts.since) {
  const git = (...a) => {
    const r = spawnSync('git', a, { cwd, encoding: 'utf8' });
    if (r.status !== 0) fail(`git ${a.join(' ')} failed: ${(r.stderr ?? '').trim()}`);
    return r.stdout.split(/\r?\n/).filter(Boolean);
  };
  const changed = [
    ...git('diff', '--name-only', '--relative', '--diff-filter=AMR', opts.since, '--'),
    ...git('ls-files', '--others', '--exclude-standard'),
  ];
  requested = [...new Set(changed.map(posix))].filter((f) => existsSync(join(cwd, f)) && inScope(f));
  if (requested.length === 0) {
    console.log(`mutation: skipped - no file changed since ${opts.since} matches mutate ${JSON.stringify(patterns)}`);
    process.exit(0);
  }
}

const reportPath = resolve(cwd, config.jsonReporter?.fileName ?? 'reports/mutation/mutation.json');
const htmlPath = resolve(cwd, config.htmlReporter?.fileName ?? 'reports/mutation/mutation.html');
const logPath = join(dirname(reportPath), 'stryker.log');
rmSync(reportPath, { force: true });
mkdirSync(dirname(reportPath), { recursive: true });

let strykerBin;
try {
  const pkgPath = createRequire(join(cwd, 'package.json')).resolve('@stryker-mutator/core/package.json');
  strykerBin = join(dirname(pkgPath), JSON.parse(readFileSync(pkgPath, 'utf8')).bin.stryker);
} catch {
  fail('@stryker-mutator/core is not installed in this project');
}
const reporters = [...new Set([...(config.reporters ?? []), 'json', 'html'])].filter(
  (r) => r !== 'progress' && r !== 'clear-text',
);
const strykerArgs = [strykerBin, 'run', opts.config, '--reporters', reporters.join(',')];
if (requested.length) strykerArgs.push('--mutate', [...requested, ...exclude.map((g) => `!${g}`)].join(','));

const run = spawnSync(process.execPath, strykerArgs, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const log = `${run.stdout ?? ''}${run.stderr ?? ''}`;
writeFileSync(logPath, log);

const blocking = [];
const notes = [];
for (const m of log.matchAll(/Glob pattern "([^"]+)" did not result in any files/g)) {
  blocking.push(`requested file matched nothing: ${m[1]} - check the path and the config's mutate globs`);
}
if (!existsSync(reportPath)) {
  const error = log.split(/\r?\n/).find((l) => /\bERROR\b/.test(l)) ?? `stryker exited ${run.status}`;
  blocking.push(`no report was written: ${error.trim()}`);
  report(null);
}

const data = JSON.parse(readFileSync(reportPath, 'utf8'));
const unitDir = `${posix(opts.unit).replace(/\/+$/, '')}/`;
const testFiles = Object.keys(data.testFiles ?? {}).map(rel);
if (testFiles.length === 0) blocking.push('no test files ran against the mutants');
const nonUnit = testFiles.filter((f) => !f.startsWith(unitDir));
if (nonUnit.length) {
  blocking.push(`non-unit tests ran against the mutants: ${nonUnit.join(', ')} - point vitest.configFile at the unit-only config`);
}

// A CompileError whose reason is a TypeScript diagnostic was rejected by the type
// checker: the type system already rules that change out, so it is report-only.
const TYPE_ERROR = /error TS\d+:/;
const KEYS = ['Killed', 'Timeout', 'Survived', 'NoCoverage', 'CompileError', 'TypeRejected', 'RuntimeError', 'Ignored', 'Pending'];
const zero = () => Object.fromEntries([...KEYS, 'Static'].map((k) => [k, 0]));
const total = zero();
const perFile = {};
const compileByMutator = {};
const typeByMutator = {};
for (const [file, entry] of Object.entries(data.files ?? {})) {
  const counts = (perFile[rel(file)] = zero());
  for (const m of entry.mutants ?? []) {
    let status = m.status;
    if (status === 'CompileError') {
      const typed = TYPE_ERROR.test(m.statusReason ?? '');
      if (typed) status = 'TypeRejected';
      const bucket = typed ? typeByMutator : compileByMutator;
      bucket[m.mutatorName] = (bucket[m.mutatorName] ?? 0) + 1;
    }
    counts[status] = (counts[status] ?? 0) + 1;
    total[status] = (total[status] ?? 0) + 1;
    if (m.static) {
      counts.Static++;
      total.Static++;
    }
  }
}

const sum = (c, keys) => keys.reduce((n, k) => n + (c[k] ?? 0), 0);
const MEASURED = ['Killed', 'Timeout', 'Survived', 'NoCoverage'];
const attempted = sum(total, KEYS) - total.Ignored - total.TypeRejected;
const measured = sum(total, MEASURED);
const pct = (n, d) => (d ? (100 * n) / d : 0);

if (Object.keys(perFile).length === 0) blocking.push('no file in the report has mutants');
if (measured === 0) blocking.push('zero mutants were Killed, Survived, NoCoverage, or Timeout - nothing was measured');
if (total.RuntimeError) blocking.push(`${total.RuntimeError} RuntimeError mutant(s) - the run did not finish properly`);
if (total.Pending) blocking.push(`${total.Pending} Pending mutant(s) - the run did not finish`);
const compilePct = pct(total.CompileError, attempted);
if (compilePct > 10) {
  blocking.push(`CompileError ${total.CompileError}/${attempted} (${compilePct.toFixed(1)}%) exceeds 10%: ${fmt(compileByMutator)} - read statusReason in the report`);
}
const timeoutPct = pct(total.Timeout, attempted);
if (timeoutPct > 10) blocking.push(`Timeout ${total.Timeout}/${attempted} (${timeoutPct.toFixed(1)}%) exceeds 10% - look for slow or hanging unit tests`);

const unmatched = new Set([...log.matchAll(/Glob pattern "([^"]+)"/g)].map((m) => posix(m[1])));
const empty = requested.filter((f) => !/[*?{[]/.test(f) && !perFile[f] && !unmatched.has(f));
if (empty.length) notes.push(`no mutants generated (type-only or trivial file): ${empty.join(', ')}`);
if (total.CompileError && compilePct <= 10) notes.push(`CompileError ${total.CompileError} (${compilePct.toFixed(1)}%), excluded from score: ${fmt(compileByMutator)}`);
if (total.TypeRejected) notes.push(`TypeRejected ${total.TypeRejected}, rejected by the TypeScript checker, excluded from score and from the 10% check: ${fmt(typeByMutator)}`);
if (total.Timeout && timeoutPct <= 10) notes.push(`Timeout ${total.Timeout} (${timeoutPct.toFixed(1)}%), counted as detected`);
if (total.Ignored) notes.push(`Ignored ${total.Ignored}, excluded from score`);
if (total.Static) notes.push(`Static ${total.Static}: module-level code that runs once at import`);

report(data);

function report(result) {
  if (!result || blocking.length) {
    console.log('mutation: INCOMPLETE');
    for (const b of blocking) console.log(`  blocking: ${b}`);
    console.log(`log: ${rel(logPath)}`);
    process.exit(1);
  }
  const detected = total.Killed + total.Timeout;
  const score = pct(detected, measured);
  const covered = pct(detected, detected + total.Survived);
  const { high = 80, low = 60, break: brk = null } = result.thresholds ?? {};
  const band = score >= high ? 'high' : score >= low ? 'medium' : 'low';
  console.log('mutation: complete');
  console.log(`score: ${score.toFixed(2)}% (${band}); covered code ${covered.toFixed(2)}%; thresholds high ${high}, low ${low}, break ${brk ?? 'none'}`);
  console.log('file | score | killed | survived | no-cov | timeout | compile | type-rejected');
  for (const [file, c] of Object.entries(perFile)) {
    const s = pct(c.Killed + c.Timeout, sum(c, MEASURED));
    console.log(`${file} | ${s.toFixed(2)} | ${c.Killed} | ${c.Survived} | ${c.NoCoverage} | ${c.Timeout} | ${c.CompileError} | ${c.TypeRejected}`);
  }
  for (const n of notes) console.log(`  report-only: ${n}`);
  console.log(`unkilled: ${total.Survived + total.NoCoverage} (survived ${total.Survived}, no coverage ${total.NoCoverage}); details: ${rel(htmlPath)}`);
  console.log(`log: ${rel(logPath)}`);
  if (brk !== null && score < brk) {
    console.log(`result: FAIL - score ${score.toFixed(2)}% is below break ${brk}`);
    process.exit(2);
  }
  if (run.status !== 0) {
    console.log(`result: FAIL - stryker exited ${run.status} without a threshold breach; read the log`);
    process.exit(1);
  }
  console.log('result: pass');
  process.exit(0);
}

function fmt(byMutator) {
  return Object.entries(byMutator).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
}

function fail(message) {
  console.error(`mutation: ${message}`);
  process.exit(1);
}
