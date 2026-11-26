import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const SKILL = '.github/skills/agents-md/SKILL.md';
const PULL_WORK = '.github/skills/pull-work/SKILL.md';

function read(rel) {
  return readFileSync(join(repoRoot, rel), 'utf8');
}

function matches(text, re, what) {
  assert.match(text, re, `${SKILL}: missing marker for ${what} (${re})`);
}

test('[R44-07] agents-md skill names both modes, its sources, the redirects, and amendment preservation', () => {
  const text = read(SKILL);
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(fm, `${SKILL}: no frontmatter block`);
  assert.match(fm[1], /^name:\s*["']?agents-md["']?\s*$/m, 'frontmatter name must be agents-md');
  matches(text, /bootstrap/i, 'bootstrap mode');
  matches(text, /amendment/i, 'amendment mode');
  matches(text, /\.workflow\/language\.md/, '.workflow/language.md');
  matches(text, /\.workflow\/sessions\//, '.workflow/sessions/');
  matches(text, /\.workflow\/specs\//, '.workflow/specs/');
  matches(text, /unsettled[^\n]*(product|brain-storm)[^\n]*`brain-storm`|`brain-storm`[^\n]*unsettled/i, 'unsettled product matters -> brain-storm');
  matches(text, /unsettled[^\n]*behavior[^\n]*`behavior-spec`|`behavior-spec`[^\n]*unsettled[^\n]*behavior/i, 'unsettled behavior -> behavior-spec');
  matches(text, /preserv\w*[^\n]*(unchanged|not change|does not change|doesn't change)|(unchanged|not change)[^\n]*preserv/i, 'amendment preserves unchanged content');
  matches(text, /replac\w*[^\n]*stale|stale[^\n]*replac/i, 'amendment replaces stale guidance');
});

test('[R44-08] agents-md skill runs stack-check and writes exactly one Stack line from its stacks', () => {
  const text = read(SKILL);
  matches(text, /node \.github\/skills\/agents-md\/scripts\/stack-check\.mjs/, 'stack-check command');
  matches(text, /exactly one `?Stack:`? line/i, 'exactly one Stack: line');
  matches(text, /Stack: <id>\[, <id>\.\.\.\]/, 'Stack: <id>[, <id>...] format');
  matches(text, /kebab-case/i, 'kebab-case IDs');
  matches(text, /`stacks`/, 'the script output field stacks');
  matches(text, /(stacks`?[^\n]*empty|empty[^\n]*stacks)/i, 'stacks empty case');
  matches(text, /ask[^\n]*Developer|Developer[^\n]*ask/i, 'asks the Developer');
  matches(text, /any kebab-case/i, 'accepts any kebab-case ID');
  matches(text, /existing `?Stack:`?[^\n]*Developer|Developer[^\n]*existing `?Stack:`?|Developer's agreement/i, 'existing Stack line changes only with Developer agreement');
});

test('[R44-09] agents-md skill stops in the Home Repo, resolves competing files, and commits only AGENTS.md as docs', () => {
  const text = read(SKILL);
  matches(text, /the Home Repo's AGENTS\.md holds only Project Pointers/, 'Home Repo stop message');
  matches(text, /exits? (with )?`?2`?|exit(s|ed)? code `?2`?|exit `?2`?/i, 'script exit 2');
  matches(text, /competing/, 'competing field');
  matches(text, /canonical/i, 'asks which file is canonical');
  matches(text, /writes? no (other )?file|no file (other than|but|except)|only `?AGENTS\.md`?|no other file/i, 'writes no file but AGENTS.md');
  matches(text, /git add AGENTS\.md/, 'git add AGENTS.md');
  matches(text, /Conventional Commit/i, 'Conventional Commit');
  matches(text, /`docs`|type docs|docs\(|docs:/, 'commit type docs');
});

test('[R42-07] agents-md skill has Question rules then exactly the pull-work Core paths line, and its .github paths exist', () => {
  const text = read(SKILL);
  const lines = text.split(/\r?\n/);
  const core = lines.map((l, i) => [l, i]).filter(([l]) => l.startsWith('Core paths:'));
  assert.equal(core.length, 1, `${SKILL}: expected exactly one "Core paths:" line, found ${core.length}`);
  const [line, index] = core[0];
  assert.ok(index > 0 && lines[index - 1].startsWith('Question rules:'), `${SKILL}: Core paths line does not directly follow the Question rules line`);
  const ref = read(PULL_WORK).split(/\r?\n/).filter((l) => l.startsWith('Core paths:'));
  assert.equal(ref.length, 1, `${PULL_WORK}: expected one Core paths line`);
  assert.equal(line, ref[0], `${SKILL}: Core paths line differs from the one in ${PULL_WORK}`);
  const paths = new Set(text.match(/\.github\/[A-Za-z0-9_.\/-]*[A-Za-z0-9_\/-]/g) ?? []);
  for (const p of paths) {
    assert.ok(existsSync(join(repoRoot, p)), `${SKILL}: names ${p}, which does not exist`);
  }
});
