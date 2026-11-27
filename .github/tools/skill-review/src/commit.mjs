import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { homeFor } from './record.mjs';

const USAGE = 'skill-review commit <compact-record-file>';
const FOLDER = 'skill-review';

function fail(category, detail) {
  return { lines: [`skill-review failed: ${category}: ${detail}`], code: 1 };
}

function git(home, args) {
  return spawnSync('git', ['-C', home, ...args], { encoding: 'utf8' });
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// Every file under the folder, as absolute paths, sorted.
function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(path));
    else out.push(resolve(path));
  }
  return out.sort();
}

// args: [compact-record-file]. Commits only the skill-review folder of the Home Repo.
export function commit(args, env, cwd = process.cwd()) {
  if (args.length !== 1) return fail('usage', USAGE);
  const [compactFile] = args;

  const home = homeFor(env);
  if (!home) return fail('home-layout-required', 'start the Harness with the Launch Script');

  const compact = readJson(compactFile);
  if (!Array.isArray(compact?.conversations)) return fail('record-unreadable', compactFile);

  const project = typeof compact.project === 'string' && compact.project !== '' ? compact.project : basename(cwd);

  const status = git(home, ['status', '--porcelain', '--', FOLDER]);
  if (status.status !== 0) return fail('commit-failed', firstLine(status.stderr));
  if (status.stdout.trim() === '') return { lines: ['skill-review: nothing to commit'], code: 0 };

  const added = git(home, ['add', '-A', '--', FOLDER]);
  if (added.status !== 0) return commitFailed(home, firstLine(added.stderr));

  const made = git(home, ['commit', '-m', `docs(skill-review): review ${project}`, '--', FOLDER]);
  if (made.status !== 0) return commitFailed(home, firstLine(made.stderr));

  const short = git(home, ['rev-parse', '--short=7', 'HEAD']);
  return { lines: [`skill-review: committed ${short.stdout.trim()}`], code: 0 };
}

function firstLine(text) {
  return (text ?? '').split(/\r?\n/).map((l) => l.trim()).find((l) => l !== '') ?? '';
}

function commitFailed(home, detail) {
  const lines = [`skill-review failed: commit-failed: ${detail}`];
  for (const file of filesUnder(join(home, FOLDER))) lines.push(`record: ${file}`);
  return { lines, code: 1 };
}
