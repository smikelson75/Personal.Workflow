import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const SKILL = '.github/skills/apply-observation/SKILL.md';
const PULL_WORK = '.github/skills/pull-work/SKILL.md';

function readSkill() {
  const abs = join(repoRoot, SKILL);
  assert.ok(existsSync(abs), `${SKILL} must exist`);
  return readFileSync(abs, 'utf8');
}

function matches(text, re, what) {
  assert.match(text, re, `${SKILL}: missing marker for ${what} (${re})`);
}

test('[R69-01] apply-observation skill has Question rules, Core paths, apply-list, and one STE Checkpoint before any edit', () => {
  const text = readSkill();
  matches(text, /^Question rules: follow `?\.github\/user-interaction\.md`?\.$/m, 'Question rules line');

  const coreLines = text.split(/\r?\n/).filter((l) => l.startsWith('Core paths:'));
  assert.equal(coreLines.length, 1, `${SKILL}: expected exactly one "Core paths:" line`);
  const refCoreLines = readFileSync(join(repoRoot, PULL_WORK), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.startsWith('Core paths:'));
  assert.equal(refCoreLines.length, 1, `${PULL_WORK}: expected one "Core paths:" line`);
  assert.equal(coreLines[0], refCoreLines[0], `${SKILL}: Core paths line differs from ${PULL_WORK}`);

  matches(text, /\bapply-list\b/, 'apply-list call');
  matches(text, /^## Checkpoint\b/m, '## Checkpoint heading');
  matches(text, /before any (edit|file change|change)/i, 'Checkpoint before any edit');
  matches(text, /\bSTE\b/, 'STE in Checkpoint');
  matches(text, /\bpart\b/i, 'part per pick');
  matches(text, /summary/i, 'change summary per pick');
  matches(text, /\bObservation\b/i, 'Observation per pick');
});

test('[R70-05] apply-observation skill applies approved picks in ID order with apply-check, conventional-commit, and apply-finish', () => {
  const text = readSkill();
  matches(text, /\bID order\b/i, 'apply in ID order');
  matches(text, /\bapply-check\b/, 'apply-check call');
  matches(text, /conventional-commit/, 'conventional-commit skill');
  matches(text, /scope[^\n]*<part>|<part>[^\n]*scope/i, 'conventional-commit scope <part>');
  matches(text, /\(O<n>\)/, 'commit subject ending (O<n>)');
  matches(text, /\bapply-finish\b/, 'apply-finish call');
});

test('[R72-06] apply-observation skill documents undo O<n> with undo-check, STE approval, and undo', () => {
  const text = readSkill();
  matches(text, /undo O<n>/, 'undo O<n>');
  matches(text, /\bundo-check\b/, 'undo-check call');
  matches(text, /\bSTE\b/, 'STE in undo');
  matches(text, /\bpart\b/i, 'part in undo statement');
  matches(text, /\bcommit\b/i, 'commit in undo statement');
  matches(text, /\bObservation\b/i, 'Observation in undo statement');
  matches(text, /wait[^\n]*approv|approv[^\n]*before/i, 'wait for approval');
  matches(text, /\bundo\b/, 'undo call');
});

test('[Q-ste-apply] apply-observation skill states STE limits for R69 and R72 statements', () => {
  const text = readSkill();
  matches(text, /\bSTE\b/, 'STE');
  matches(text, /at most 25 words\s*(per|a)\s*sentence|25\s*words?\s*(per|a)\s*sentence/i, 'at most 25 words per sentence');
  matches(text, /at most 6 sentences\s*(per|a)\s*paragraph|6\s*sentences?\s*(per|a)\s*paragraph/i, 'at most 6 sentences per paragraph');
});
