import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..', '..');
const read = (rel) => readFileSync(join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');

// Text of the section that starts at a heading line, up to the next heading of the same or higher level.
function section(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  assert.notEqual(start, -1, `heading not found: ${heading}`);
  const level = /^#+/.exec(heading)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^(#+)\s/.exec(lines[i]);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n');
}

const SKILL = '.github/skills/pull-work/SKILL.md';
const SUGGESTION = "Next: run /skill-review to review this Phase's Conversations.";

test('[R66-01] the Brief section has the review suggestion as its own line', () => {
  const brief = section(read(SKILL), '## Brief');
  assert.ok(brief.split('\n').includes(SUGGESTION), `Brief must have a line exactly: ${SUGGESTION}`);
});

test('[R66-02] the sentence before the suggestion names WORKFLOW_HOME, and the Brief names the copy layout', () => {
  const brief = section(read(SKILL), '## Brief');
  const lines = brief.split('\n');
  const at = lines.indexOf(SUGGESTION);
  assert.notEqual(at, -1, `Brief must have a line exactly: ${SUGGESTION}`);
  let i = at - 1;
  while (i >= 0 && lines[i].trim() === '') i--;
  assert.ok(i >= 0, 'a sentence must come before the suggestion line');
  assert.ok(lines[i].includes('WORKFLOW_HOME'), 'the sentence before the suggestion must contain WORKFLOW_HOME: ' + lines[i]);
  assert.ok(brief.includes('copy layout'), 'the Brief must say what happens in the copy layout');
});

test('[R66-03] no line other than the suggestion holds /skill-review or skill-review.mjs', () => {
  const lines = read(SKILL).split('\n');
  assert.equal(lines.filter((l) => l === SUGGESTION).length, 1, 'the suggestion line must appear exactly once');
  const others = lines.filter((l) => l !== SUGGESTION && (l.includes('/skill-review') || l.includes('skill-review.mjs')));
  assert.deepEqual(others, []);
});
