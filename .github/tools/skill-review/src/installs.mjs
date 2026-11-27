import { spawnSync } from 'node:child_process';
import { homeFor, readRecord, writeRecord } from './record.mjs';

const COMMIT = /^[0-9a-f]{7,40}$/;
const VERSION = /^[0-9a-f]{7}$/;
const MARK_USAGE = 'skill-review mark-changed <O-id> <commit>';
const INSTALL_USAGE = 'skill-review record-install <version> <source-commit>';

function fail(category, detail) {
  return { lines: [`skill-review failed: ${category}: ${detail}`], code: 1 };
}

function git(cwd, args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

// Shared gate: Home layout, then a readable Review Record. Returns {home, record} or {failure}.
function loadRecord(env) {
  const home = homeFor(env);
  if (!home) return { failure: fail('home-layout-required', 'start the Harness with the Launch Script') };
  try {
    return { home, record: readRecord(home) };
  } catch (err) {
    if (err.category) return { failure: fail(err.category, err.detail) };
    throw err;
  }
}

// args: [O-id, commit]. Marks a confirmed part-change Observation as changed.
export function markChanged(args, env) {
  if (args.length !== 2) return fail('usage', MARK_USAGE);
  const [id, commit] = args;

  const loaded = loadRecord(env);
  if (loaded.failure) return loaded.failure;
  const { home, record } = loaded;

  const obs = (record.observations ?? []).find((o) => o.id === id);
  if (!obs) return fail('unknown-observation', id);
  if (obs.state !== 'confirmed' || obs.outcome !== 'part change') return fail('not-confirmed', id);
  if (!COMMIT.test(commit)) return fail('bad-commit', commit);

  obs.state = 'changed';
  obs.changeCommit = commit;
  writeRecord(home, record);
  return { lines: [`skill-review: ${id} changed (${commit})`], code: 0 };
}

// args: [version, source-commit]. Records an install and the change commits it contains.
export function recordInstall(args, env, cwd) {
  if (args.length !== 2) return fail('usage', INSTALL_USAGE);
  const [version, source] = args;

  const loaded = loadRecord(env);
  if (loaded.failure) return loaded.failure;
  const { home, record } = loaded;

  if (!VERSION.test(version)) return fail('bad-version', version);
  if (!COMMIT.test(source)) return fail('bad-commit', source);
  if (git(cwd, ['cat-file', '-e', `${source}^{commit}`]).status !== 0) return fail('unknown-commit', source);

  record.installs ??= [];
  if (record.installs.some((i) => i.version === version && i.source === source)) {
    return { lines: [`skill-review: install already recorded ${version}`], code: 0 };
  }

  const contains = (record.observations ?? [])
    .filter((o) => o.state === 'changed' && o.changeCommit)
    .map((o) => o.changeCommit)
    .filter((change) => git(cwd, ['merge-base', '--is-ancestor', change, source]).status === 0)
    .sort();

  const at = env.SKILL_REVIEW_NOW || new Date().toISOString();
  record.installs.push({ version, source, at, contains });
  writeRecord(home, record);
  return { lines: [`skill-review: install recorded ${version} (${contains.length} changes contained)`], code: 0 };
}

// The earliest install whose contains holds the Observation's changeCommit, or null.
export function installOf(record, observation) {
  if (!observation?.changeCommit) return null;
  const hits = (record.installs ?? []).filter((i) => i.contains?.includes(observation.changeCommit));
  if (!hits.length) return null;
  const earliest = hits.reduce((a, b) => (b.at < a.at ? b : a));
  return { version: earliest.version, at: earliest.at };
}
