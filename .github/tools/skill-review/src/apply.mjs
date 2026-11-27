import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { compareIds } from './observations.mjs';
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
