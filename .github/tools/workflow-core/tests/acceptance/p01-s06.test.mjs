import test from 'node:test';
import assert from 'node:assert/strict';
import { lines } from '../../support/harness.mjs';

const SKILL = '.github/skills/brain-storm/SKILL.md';

const lineStarting = (prefix) => lines(SKILL).find((l) => l.trimStart().startsWith(prefix));

function requireLine(prefix) {
  const line = lineStarting(prefix);
  assert.ok(line !== undefined, `no line starts ${prefix}`);
  return line;
}

function requireContains(line, markers) {
  for (const m of markers) assert.ok(line.includes(m), `line lacks ${m}: ${line}`);
}

test('[R19-01] ### Commit follows ### Check; - Commit: line has template, language file, without asking', () => {
  const all = lines(SKILL);
  const check = all.findIndex((l) => l.trim() === '### Check');
  const commit = all.findIndex((l) => l.trim() === '### Commit');
  assert.ok(check >= 0, '### Check heading missing');
  assert.ok(commit >= 0, '### Commit heading missing');
  assert.ok(commit > check, '### Commit must come after ### Check');
  const between = all.slice(check + 1, commit).filter((l) => /^#{1,6}\s/.test(l));
  assert.deepEqual(between, [], 'no heading may sit between ### Check and ### Commit');
  const line = requireLine('- Commit:');
  requireContains(line, ['docs(workflow): session <topic>', '.workflow/language.md', 'without asking']);
});

test('[R19-02] - Commit: line mentions draft', () => {
  requireContains(requireLine('- Commit:'), ['draft']);
});

test('[R19-03] - On a prior-Session error: line contains still commit', () => {
  requireContains(requireLine('- On a prior-Session error:'), ['still commit']);
});

test('[R19-04] - Stage: by path; - Never: git add -A, push, --no-verify', () => {
  requireContains(requireLine('- Stage:'), ['by path']);
  requireContains(requireLine('- Never:'), ['git add -A', 'push', '--no-verify']);
});

test('[R19-05] - On rejection: line exists; - Messages: contains conventional-commit', () => {
  requireLine('- On rejection:');
  requireContains(requireLine('- Messages:'), ['conventional-commit']);
});
