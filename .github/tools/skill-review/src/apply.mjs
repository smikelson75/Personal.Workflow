import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compareIds } from './observations.mjs';
import { renderLedger } from './ledger.mjs';
import { markChanged, recordInstall } from './installs.mjs';
import { homeFor, readRecord } from './record.mjs';
import { formatNextPartChange } from './summary.mjs';

export function fail(category, detail) {
  return { lines: [`apply-observation failed: ${category}: ${detail}`], code: 1 };
}

function git(cwd, args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

export function preflight(env, cwd, { checkDirty = true } = {}) {
  const home = homeFor(env);
  if (!home) {
    return { failure: fail('home-layout-required', 'start the Harness with the Launch Script') };
  }
  if (!existsSync(join(cwd, 'scripts', 'update-home.mjs')) || !existsSync(join(cwd, 'language-addons'))) {
    return { failure: fail('not-personal-workflow', 'run it in Personal.Workflow') };
  }
  if (checkDirty) {
    const st = git(cwd, ['status', '--porcelain']);
    const lines = (st.stdout ?? '').split(/\r?\n/).filter((l) => l.length > 0);
    if (st.status !== 0 || lines.length > 0) {
      const paths = lines.map((l) => l.slice(3).trim());
      return { failure: fail('dirty-tree', paths.join(', ')) };
    }
  }
  try {
    return { home, record: readRecord(home) };
  } catch (err) {
    if (err.category) return { failure: fail(err.category, err.detail) };
    throw err;
  }
}

const SUITE_ROOTS = [
  'tests',
  join('.github', 'tools', 'workflow-check', 'tests'),
  join('.github', 'tools', 'workflow-core', 'tests'),
];

function findTestFiles(dir, out) {
  if (!existsSync(dir)) return out;
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) findTestFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.test.mjs')) out.push(full);
  }
  return out;
}

// An outer `node --test` sets NODE_TEST_CONTEXT, which makes a nested `node --test`
// report into the parent and exit 0 on failures; children must run standalone.
function childEnv(env) {
  const out = { ...env };
  delete out.NODE_TEST_CONTEXT;
  return out;
}

function restoreTree(cwd) {
  git(cwd, ['checkout', '--', '.']);
  git(cwd, ['clean', '-fd']);
}

export function applyCheck(args, env, cwd) {
  const pre = preflight(env, cwd, { checkDirty: false });
  if (pre.failure) return pre.failure;

  const id = args[0];
  if (!id) return fail('usage', 'apply-check <O-id>');

  const failWith = (reason) => {
    restoreTree(cwd);
    return { lines: [`check-failed: ${id}: ${reason}`], code: 1 };
  };

  const check = spawnSync(process.execPath, [join(cwd, '.github', 'tools', 'workflow-check', 'bin', 'workflow-check.mjs')], {
    cwd,
    encoding: 'utf8',
    env: childEnv(process.env),
  });
  if (check.status !== 0) return failWith('workflow-check failed');

  const files = [];
  for (const root of SUITE_ROOTS) findTestFiles(join(cwd, root), files);
  if (files.length > 0) {
    const suites = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], {
      cwd,
      encoding: 'utf8',
      env: childEnv(process.env),
    });
    if (suites.status !== 0) return failWith('test suite failed');
  }

  return { lines: [], code: 0 };
}

const PICK = /^(O\d+):([0-9a-f]{7,40})$/;
const UPDATE_VERSION = /Workflow version:\s+\S+\s+->\s+([0-9a-f]{7})/m;
const FINISH_USAGE = 'apply-finish <O-id>:<commit>...';
const FOLDER = 'skill-review';

function nonEmptyLines(text) {
  return (text ?? '').split(/\r?\n/).filter((l) => l !== '');
}

function firstLine(text) {
  return nonEmptyLines(text)[0] ?? '';
}

// Replaces the whole Ledger file: temp file, then rename.
function writeLedgerFile(home, text) {
  const dir = join(home, FOLDER);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'ledger.md');
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, text);
  renameSync(temp, file);
}

// args: [O-id:commit]...  Marks picks changed, runs the Update Script once, records the install,
// rewrites the Ledger, and commits the Home Repo's skill-review/ folder.
export function applyFinish(args, env, cwd) {
  const pre = preflight(env, cwd);
  if (pre.failure) return pre.failure;
  const { home, record } = pre;

  if (args.length === 0) return { lines: ['apply-observation: nothing to apply'], code: 0 };

  const picks = [];
  for (const arg of args) {
    const m = PICK.exec(arg);
    if (!m) return fail('usage', FINISH_USAGE);
    picks.push({ id: m[1], commit: m[2] });
  }
  picks.sort((a, b) => compareIds(a.id, b.id));
  if (new Set(picks.map((p) => p.id)).size !== picks.length) return fail('usage', FINISH_USAGE);

  // Validate every pick before anything is written.
  for (const { id } of picks) {
    const obs = (record.observations ?? []).find((o) => o.id === id);
    if (!obs) return fail('unknown-observation', id);
    if (obs.state !== 'confirmed' || obs.outcome !== 'part change') return fail('not-confirmed', id);
  }

  const lines = [];
  for (const { id, commit } of picks) {
    const res = markChanged([id, commit], env);
    lines.push(...res.lines);
    if (res.code !== 0) return { lines, code: 1 };
  }

  const update = spawnSync(process.execPath, [join(cwd, 'scripts', 'update-home.mjs'), home], {
    cwd,
    encoding: 'utf8',
  });
  lines.push(...nonEmptyLines(update.stdout), ...nonEmptyLines(update.stderr));
  const updateCode = update.status ?? 1;

  if (updateCode === 0) {
    const m = UPDATE_VERSION.exec(update.stdout ?? '');
    if (m) {
      const head = git(cwd, ['rev-parse', '--short=7', 'HEAD']).stdout.trim();
      lines.push(...recordInstall([m[1], head], env, cwd).lines);
    }
  }

  const now = env.SKILL_REVIEW_NOW ? new Date(env.SKILL_REVIEW_NOW) : new Date();
  writeLedgerFile(home, renderLedger({ record: readRecord(home), now }));

  const ids = picks.map((p) => p.id);
  const status = git(home, ['status', '--porcelain', '--', FOLDER]);
  if (status.status !== 0) return { lines: [...lines, `apply-observation failed: commit-failed: ${firstLine(status.stderr)}`], code: 1 };
  if (status.stdout.trim() !== '') {
    const added = git(home, ['add', '-A', '--', FOLDER]);
    if (added.status !== 0) return { lines: [...lines, `apply-observation failed: commit-failed: ${firstLine(added.stderr)}`], code: 1 };
    const made = git(home, ['commit', '-m', `docs(skill-review): apply ${ids.join(', ')}`, '--', FOLDER]);
    if (made.status !== 0) return { lines: [...lines, `apply-observation failed: commit-failed: ${firstLine(made.stderr)}`], code: 1 };
  }

  if (updateCode !== 0) {
    lines.push(`apply-observation failed: update-home-failed: exit ${updateCode}`);
    return { lines, code: 1 };
  }
  return { lines, code: 0 };
}

export function applyList(_args, env, cwd) {
  const pre = preflight(env, cwd);
  if (pre.failure) return pre.failure;

  const matches = (pre.record.observations ?? [])
    .filter((o) => o.state === 'confirmed' && o.outcome === 'part change')
    .sort((a, b) => compareIds(a.id, b.id));

  if (matches.length === 0) {
    return { lines: ['apply-observation: nothing to apply'], code: 0 };
  }
  return { lines: matches.map(formatNextPartChange), code: 0 };
}
