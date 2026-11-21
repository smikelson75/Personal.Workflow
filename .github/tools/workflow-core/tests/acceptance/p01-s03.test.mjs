import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { files, lines, read, repoRoot } from '../../support/harness.mjs';

const RULES_LINE = 'Question rules: follow `.github/user-interaction.md`.';
const NEVER_ASKS_LINE = 'Asks the Developer: never - stop and report to the caller.';

const askingFiles = [
  ...['brain-storm', 'behavior-spec', 'work-planner', 'pull-work', 'adr-writer', 'conventional-commit'].map(
    (name) => `.github/skills/${name}/SKILL.md`,
  ),
  '.github/agents/planner.agent.md',
];

const neverAskingFiles = ['coder', 'test-author', 'test-reviewer', 'repo-scout'].map(
  (name) => `.github/agents/${name}.agent.md`,
);

test('[R22-02] each asking skill and the planner agent contain the rules-file line', () => {
  for (const rel of askingFiles) {
    assert.ok(existsSync(join(repoRoot, rel)), `${rel} exists`);
    assert.ok(lines(rel).includes(RULES_LINE), `${rel} contains the line: ${RULES_LINE}`);
  }
});

test('[R22-03] no file under skills, agents, or hooks names AGENTS.md', () => {
  const scanned = [];
  for (const dir of ['.github/skills', '.github/agents', '.github/hooks']) {
    if (existsSync(join(repoRoot, dir))) scanned.push(...files(dir));
  }
  assert.ok(scanned.length > 0, 'at least one file is scanned');
  const offenders = scanned.filter((rel) => read(rel).includes('AGENTS.md'));
  assert.deepEqual(offenders, []);
});

test('[R22-04] coder, test-author, test-reviewer, and repo-scout state they never ask the Developer', () => {
  for (const rel of neverAskingFiles) {
    assert.ok(existsSync(join(repoRoot, rel)), `${rel} exists`);
    assert.ok(lines(rel).includes(NEVER_ASKS_LINE), `${rel} contains the line: ${NEVER_ASKS_LINE}`);
  }
});
