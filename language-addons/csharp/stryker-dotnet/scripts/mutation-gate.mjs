// Runs Stryker.NET from the unit-test project folder, applies the mutation-testing
// protocol's Run Completeness rules to mutation-report.json and the console log,
// and prints a short summary. Exit codes: 0 complete and at or above `break` (or
// nothing to mutate), 1 incomplete run or tool failure, 2 complete run below `break`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, matchesGlob, relative, resolve } from 'node:path';

const USAGE = `usage: node mutation-gate.mjs [--config stryker-config.json] [--unit <unit-test-dir>]
                         [--configuration Release] [--output StrykerOutput/gate]
                         [--since <git-ref> | --mutate <file>...]
  --unit          unit-test project folder (auto-discovered under tests/*UnitTests* if omitted)
  --since         mutate only files changed since <git-ref> that match the config's mutate globs
  --mutate        mutate only these files (relative to the project under test)
  neither         mutate the config's whole mutate scope (one-time baseline)`;

const args = process.argv.slice(2);
const opts = {
  config: 'stryker-config.json',
  unit: null,
  configuration: 'Release',
  output: 'StrykerOutput/gate',
  since: null,
  mutate: [],
};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help') {
    console.log(USAGE);
    process.exit(0);
  } else if (arg === '--config') opts.config = args[++i];
  else if (arg === '--unit') opts.unit = args[++i];
  else if (arg === '--configuration') opts.configuration = args[++i];
  else if (arg === '--output') opts.output = args[++i];
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

const rawConfig = JSON.parse(readFileSync(configPath, 'utf8'));
const config = rawConfig['stryker-config'] ?? rawConfig;
const patterns = config.mutate ?? ['**/*.cs'];
const include = patterns.filter((p) => !p.startsWith('!'));
const exclude = patterns.filter((p) => p.startsWith('!')).map((p) => p.slice(1));
const inScope = (file) => include.some((g) => matchesGlob(file, g)) && !exclude.some((g) => matchesGlob(file, g));

const unitDir = resolveUnitTestDir(opts.unit);
const projectDir = findProjectDir(config.project);

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
  const uniqueChanged = [...new Set(changed.map(posix))].filter((f) => existsSync(join(cwd, f)));
  if (projectDir) {
    const projPrefix = `${posix(relative(cwd, projectDir)).replace(/\/+$/, '')}/`;
    requested = uniqueChanged
      .filter((f) => f.startsWith(projPrefix))
      .map((f) => f.slice(projPrefix.length))
      .filter((f) => inScope(f));
  } else {
    requested = uniqueChanged.filter((f) => f.endsWith('.cs') && inScope(f));
  }
  if (requested.length === 0) {
    console.log(`mutation: skipped - no file changed since ${opts.since} matches mutate ${JSON.stringify(patterns)}`);
    process.exit(0);
  }
}

const build = spawnSync('dotnet', ['build', '--configuration', opts.configuration], {
  cwd,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
if (build.status !== 0) {
  const errLine = `${build.stdout ?? ''}\n${build.stderr ?? ''}`
    .split(/\r?\n/)
    .find((l) => /\berror\b/i.test(l));
  fail(`build failed before mutation started: ${(errLine ?? `dotnet build exited ${build.status}`).trim()}`);
}

const outputDir = resolve(cwd, opts.output);
const reportPath = join(outputDir, 'reports', 'mutation-report.json');
const htmlPath = join(outputDir, 'reports', 'mutation-report.html');
const logPath = join(outputDir, 'stryker.log');
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

const strykerArgs = [
  'stryker',
  '--config-file',
  configPath,
  '--configuration',
  opts.configuration,
  '--output',
  outputDir,
  '--break-at',
  '0',
];
if (requested.length) {
  for (const file of requested) strykerArgs.push('--mutate', file);
  for (const excl of exclude) strykerArgs.push('--mutate', `!${excl}`);
}

const run = spawnSync('dotnet', strykerArgs, {
  cwd: unitDir,
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
});
const log = `${run.stdout ?? ''}${run.stderr ?? ''}`;
writeFileSync(logPath, log);

const blocking = [];
const notes = [];
if (/Identifying projects to mutate in .+\.slnx?/i.test(log)) {
  blocking.push('solution mode ran (integration/acceptance tests killed mutants) - run from the unit-test project folder');
}
for (const m of log.matchAll(/Safe Mode! Stryker will remove all mutations in ([^\r\n]+)/g)) {
  blocking.push(`Safe Mode dropped mutations in ${m[1].trim()}`);
}
if (/Number of tests found:\s*0\b/i.test(log)) {
  blocking.push('Number of tests found: 0 - test discovery failed or unit-test project has no tests');
}
if (!existsSync(reportPath)) {
  const error = log.split(/\r?\n/).find((l) => /\b(ERR|ERROR)\b/.test(l)) ?? `dotnet stryker exited ${run.status}`;
  blocking.push(`no report was written: ${error.trim()}`);
  report(null);
}

const data = JSON.parse(readFileSync(reportPath, 'utf8'));
const KEYS = ['Killed', 'Timeout', 'Survived', 'NoCoverage', 'CompileError', 'RuntimeError', 'Ignored', 'Pending'];
const zero = () => Object.fromEntries(KEYS.map((k) => [k, 0]));
const total = zero();
const perFile = {};
const compileByMutator = {};

for (const [file, entry] of Object.entries(data.files ?? {})) {
  const counts = (perFile[rel(file)] = zero());
  for (const m of entry.mutants ?? []) {
    const status = m.status;
    if (status === 'CompileError') {
      compileByMutator[m.mutatorName] = (compileByMutator[m.mutatorName] ?? 0) + 1;
    }
    if (status in counts) {
      counts[status]++;
      total[status]++;
    }
  }
}

const sum = (c, keys) => keys.reduce((n, k) => n + (c[k] ?? 0), 0);
const MEASURED = ['Killed', 'Timeout', 'Survived', 'NoCoverage'];
const attempted = sum(total, KEYS) - total.Ignored;
const measured = sum(total, MEASURED);
const pct = (n, d) => (d ? (100 * n) / d : 0);

if (Object.keys(perFile).length === 0) blocking.push('no file in the report has mutants');
if (measured === 0) blocking.push('zero mutants were Killed, Survived, NoCoverage, or Timeout - nothing was measured');
if (total.RuntimeError) blocking.push(`${total.RuntimeError} RuntimeError mutant(s) - the run did not finish properly`);
if (total.Pending) blocking.push(`${total.Pending} Pending mutant(s) - the run did not finish`);
const compilePct = pct(total.CompileError, attempted);
if (compilePct > 10) {
  blocking.push(`CompileError ${total.CompileError}/${attempted} (${compilePct.toFixed(1)}%) exceeds 10%: ${fmt(compileByMutator)}`);
}
const timeoutPct = pct(total.Timeout, attempted);
if (timeoutPct > 10) {
  blocking.push(`Timeout ${total.Timeout}/${attempted} (${timeoutPct.toFixed(1)}%) exceeds 10% - look for slow or hanging unit tests`);
}

if (total.CompileError && compilePct <= 10) {
  notes.push(`CompileError ${total.CompileError} (${compilePct.toFixed(1)}%), excluded from score: ${fmt(compileByMutator)}`);
}
if (total.Timeout && timeoutPct <= 10) {
  notes.push(`Timeout ${total.Timeout} (${timeoutPct.toFixed(1)}%), counted as detected`);
}
if (total.Ignored) {
  notes.push(`Ignored ${total.Ignored}, excluded from score`);
}

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
  const thresholds = config.thresholds ?? result.thresholds ?? {};
  const high = thresholds.high ?? 80;
  const low = thresholds.low ?? 60;
  const brk = thresholds.break ?? 0;
  const band = score >= high ? 'high' : score >= low ? 'medium' : 'low';
  console.log('mutation: complete');
  console.log(`score: ${score.toFixed(2)}% (${band}); covered code ${covered.toFixed(2)}%; thresholds high ${high}, low ${low}, break ${brk}`);
  console.log('file | score | killed | survived | no-cov | timeout | compile');
  for (const [file, c] of Object.entries(perFile)) {
    const s = pct(c.Killed + c.Timeout, sum(c, MEASURED));
    console.log(`${file} | ${s.toFixed(2)} | ${c.Killed} | ${c.Survived} | ${c.NoCoverage} | ${c.Timeout} | ${c.CompileError}`);
  }
  for (const n of notes) console.log(`  report-only: ${n}`);
  console.log(`unkilled: ${total.Survived + total.NoCoverage} (survived ${total.Survived}, no coverage ${total.NoCoverage}); details: ${rel(htmlPath)}`);
  console.log(`log: ${rel(logPath)}`);
  if (brk > 0 && score < brk) {
    console.log(`result: FAIL - score ${score.toFixed(2)}% is below break ${brk}`);
    process.exit(2);
  }
  if (run.status !== 0) {
    console.log(`result: FAIL - dotnet stryker exited ${run.status} without a threshold breach; read the log`);
    process.exit(1);
  }
  console.log('result: pass');
  process.exit(0);
}

function resolveUnitTestDir(explicitDir) {
  if (explicitDir) {
    const full = resolve(cwd, explicitDir);
    if (!existsSync(full)) fail(`unit-test directory not found: ${explicitDir}`);
    return full;
  }
  const testsRoot = join(cwd, 'tests');
  if (existsSync(testsRoot)) {
    const matches = readdirSync(testsRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /UnitTests$/i.test(e.name))
      .map((e) => join(testsRoot, e.name));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      fail(`multiple unit-test projects found (${matches.map(rel).join(', ')}); pass --unit <dir>`);
    }
  }
  fail('unit-test project folder not found under tests/*UnitTests; pass --unit <dir>');
}

function findProjectDir(projectFileName) {
  if (!projectFileName) return null;
  const roots = [join(cwd, 'src'), cwd];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const found = walkForFile(root, projectFileName);
    if (found) return dirname(found);
  }
  return null;
}

function walkForFile(dir, targetName) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'bin' || entry.name === 'obj' || entry.name === '.git' || entry.name === 'node_modules') {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === targetName.toLowerCase()) return full;
    if (entry.isDirectory()) {
      const nested = walkForFile(full, targetName);
      if (nested) return nested;
    }
  }
  return null;
}

function fmt(byMutator) {
  return Object.entries(byMutator).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
}

function fail(message) {
  console.error(`mutation: ${message}`);
  process.exit(1);
}
