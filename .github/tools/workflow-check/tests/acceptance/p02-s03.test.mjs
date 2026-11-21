import test from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../support/harness.mjs';
import { validGlossary, validSession } from '../support/fixtures.mjs';

const NAME_A = 'context-2026-11-20-0900.md';
const NAME_B = 'context-2026-11-20-1000.md';
const NAME_C = 'context-2026-11-20-1100.md';
const MISSING = 'context-2026-11-19-0900.md';

const pathOf = (name) => `.workflow/sessions/${name}`;

function session(name, header) {
  const m = /^context-(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})\.md$/.exec(name);
  return validSession({ title: `# Context - ${m[1]} ${m[2]}:${m[3]}`, header });
}

function folderWith(sessions) {
  const files = { '.workflow/language.md': validGlossary() };
  for (const [name, content] of Object.entries(sessions)) files[pathOf(name)] = content;
  return files;
}

// Line (1-based) of the first line starting with prefix.
function lineOf(text, prefix) {
  const idx = text.split('\n').findIndex((l) => l.startsWith(prefix));
  assert.ok(idx >= 0, `fixture has a line starting with ${prefix}`);
  return idx + 1;
}

// Asserts the chain/broken-link lines are exactly the expected [path, line] pairs (errors, non-empty short message).
function assertBrokenLinks(stdout, expected) {
  const lines = stdout.split('\n').filter((l) => l.includes(': chain/broken-link: '));
  assert.equal(lines.length, expected.length, `chain/broken-link count, got:\n${stdout}`);
  expected.forEach(([path, line], i) => {
    const prefix = `${path}:${line}: error: chain/broken-link: `;
    assert.ok(lines[i].startsWith(prefix), `line ${i} should start with "${prefix}", got "${lines[i]}"`);
    const message = lines[i].slice(prefix.length);
    assert.ok(message.length > 0 && message.length <= 160, `message length for line ${i}`);
  });
  const summary = stdout.trimEnd().split('\n').pop();
  assert.match(summary, /^workflow-check: \d+ errors, \d+ warnings$/);
  const errors = Number(/: (\d+) errors/.exec(summary)[1]);
  assert.ok(errors >= expected.length, 'summary counts the broken-link errors');
}

test('[R3-01] Builds on naming a missing file reports chain/broken-link at the Builds on line', () => {
  const b = session(NAME_B, [`- Builds on: \`${MISSING}\``]);
  const r = runCheck({ files: folderWith({ [NAME_B]: b }) });
  assertBrokenLinks(r.stdout, [[pathOf(NAME_B), lineOf(b, '- Builds on:')]]);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, '');
});

test('[R3-02] Supersedes naming its own file reports chain/broken-link at that line', () => {
  const b = session(NAME_B, [`- Supersedes: \`${NAME_B}\``]);
  const r = runCheck({ files: folderWith({ [NAME_B]: b }) });
  assertBrokenLinks(r.stdout, [[pathOf(NAME_B), lineOf(b, '- Supersedes:')]]);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, '');
});

test('[R3-03] Builds on cycle between A and B reports one chain/broken-link at each link line', () => {
  const a = session(NAME_A, [`- Builds on: \`${NAME_B}\``]);
  const b = session(NAME_B, [`- Builds on: \`${NAME_A}\``]);
  const r = runCheck({ files: folderWith({ [NAME_A]: a, [NAME_B]: b }) });
  assertBrokenLinks(r.stdout, [
    [pathOf(NAME_A), lineOf(a, '- Builds on:')],
    [pathOf(NAME_B), lineOf(b, '- Builds on:')],
  ]);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, '');
});

test('[R1-09] superseded Session still reports its broken Builds on link', () => {
  const a = session(NAME_A, [`- Builds on: \`${MISSING}\``]);
  const c = session(NAME_C, [`- Supersedes: \`${NAME_A}\``]);
  const r = runCheck({ files: folderWith({ [NAME_A]: a, [NAME_C]: c }) });
  assertBrokenLinks(r.stdout, [[pathOf(NAME_A), lineOf(a, '- Builds on:')]]);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, '');
});
