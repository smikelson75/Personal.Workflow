import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

export function read(rel) {
  return readFileSync(join(repoRoot, rel), 'utf8');
}

export function lines(rel) {
  return read(rel).split(/\r?\n/);
}

export function files(relDir) {
  const out = [];
  const walk = (abs, rel) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childRel = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(join(abs, entry.name), childRel);
      else out.push(childRel);
    }
  };
  walk(join(repoRoot, relDir), relDir.replace(/\\/g, '/').replace(/\/+$/, ''));
  return out.sort();
}

export function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'wfcore-'));
  const git = (...args) => {
    const res = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (res.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
    return res.stdout.trim();
  };
  git('init', '-b', 'main');
  git('config', 'core.autocrlf', 'false');
  return {
    dir,
    write(rel, text) {
      const target = join(dir, rel);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text);
    },
    commit(message) {
      git('add', '-A');
      git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-m', message);
      return git('rev-parse', 'HEAD');
    },
    run(scriptRel, args = [], opts = {}) {
      const res = spawnSync(process.execPath, [join(repoRoot, scriptRel), ...args], {
        cwd: dir,
        input: opts.input ?? '',
        encoding: 'utf8',
      });
      return { status: res.status, stdout: res.stdout, stderr: res.stderr };
    },
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
