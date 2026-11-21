import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = join(TOOL_ROOT, 'bin', 'workflow-check.mjs');

export function runCheck({ files = {}, cwd = '.', args = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wfcheck-'));
  for (const [rel, content] of Object.entries(files)) {
    const target = join(dir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  const workDir = resolve(dir, cwd);
  mkdirSync(workDir, { recursive: true });
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: workDir,
    input: '',
    encoding: 'utf8',
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr, dir };
}

export function snapshotTree(dir) {
  const map = new Map();
  const walk = (current) => {
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry);
      const rel = relative(dir, full).split('\\').join('/');
      if (statSync(full).isDirectory()) {
        map.set(rel, 'dir');
        walk(full);
      } else {
        map.set(rel, createHash('sha256').update(readFileSync(full)).digest('hex'));
      }
    }
  };
  walk(dir);
  return map;
}
