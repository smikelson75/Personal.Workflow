import assert from 'node:assert/strict';
import test from 'node:test';
import { lines } from '../../support/harness.mjs';

const FILE = '.github/skills/behavior-spec/SKILL.md';

function commitSection() {
  const all = lines(FILE).map((l) => l.trimEnd());
  const commit = all.indexOf('## Commit');
  const exit = all.indexOf('## Exit');
  assert.notEqual(commit, -1, '`## Commit` heading is missing');
  assert.notEqual(exit, -1, '`## Exit` heading is missing');
  assert.ok(commit < exit, '`## Commit` must precede `## Exit`');
  return all.slice(commit + 1, exit);
}

function lineStarting(section, prefix) {
  const found = section.find((l) => l.startsWith(prefix));
  assert.ok(found, `no line starts with "${prefix}" in the Commit section`);
  return found;
}

test('[R19-06] behavior-spec commits every spec file it wrote, without asking', () => {
  const section = commitSection();
  const line = lineStarting(section, '- Commit:');
  assert.ok(line.includes('docs(<slug>): specify behavior'), 'missing commit template');
  assert.ok(line.includes('without asking'), 'missing "without asking"');
});

test('[R19-07] behavior-spec commits nothing when it stops or redirects', () => {
  const section = commitSection();
  const line = lineStarting(section, '- Stop or redirect:');
  assert.ok(line.includes('commit nothing'), 'missing "commit nothing"');
});

test('[R19-08] behavior-spec stages by path, never bypasses, handles rejection, follows conventional-commit', () => {
  const section = commitSection();
  const stage = lineStarting(section, '- Stage:');
  assert.ok(stage.includes('by path'), 'Stage line missing "by path"');
  const never = lineStarting(section, '- Never:');
  assert.ok(never.includes('git add -A'), 'Never line missing `git add -A`');
  assert.ok(never.includes('push'), 'Never line missing "push"');
  assert.ok(never.includes('--no-verify'), 'Never line missing `--no-verify`');
  lineStarting(section, '- On rejection:');
  const messages = lineStarting(section, '- Messages:');
  assert.ok(messages.includes('conventional-commit'), 'Messages line missing "conventional-commit"');
});
