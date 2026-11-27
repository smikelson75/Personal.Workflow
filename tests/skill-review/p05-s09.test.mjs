import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
// Built in pieces so this file never contains the whole string.
const needle = ['review', 'incubate'].join('-');

function walk(dir, out) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

test('[R67-03] the review-incubate prompt file does not exist', () => {
  const file = join(root, '.github', 'prompts', `${needle}.prompt.md`);
  assert.equal(existsSync(file), false);
});

test('[R67-04] no Workflow Core file names the removed prompt', () => {
  const files = [];
  for (const d of ['.github', 'home', 'scripts', 'language-addons']) walk(join(root, d), files);
  files.push(join(root, 'README.md'));
  const hits = files
    .filter((f) => existsSync(f) && readFileSync(f, 'utf8').includes(needle))
    .map((f) => f.slice(root.length + 1));
  assert.deepEqual(hits, []);
});
