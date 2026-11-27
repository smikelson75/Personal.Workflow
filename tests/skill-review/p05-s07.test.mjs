import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..', '..');
const read = (rel) => {
  const p = join(REPO, rel);
  assert.ok(existsSync(p), `file does not exist: ${rel}`);
  return readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
};

const SKILL = '.github/skills/skill-review/SKILL.md';
const LINK = './.github/skills/skill-review/README.md';
const BIN = 'node "$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs"';

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

function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(m, 'missing frontmatter');
  return m[1];
}

const body = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, '');
// Prose with line breaks and markdown emphasis flattened, for phrase checks.
const flat = (text) => text.replace(/[`*_]/g, '').replace(/\s+/g, ' ');

test('[R52-21] skill-review SKILL.md frontmatter has name, description, user-invocable', () => {
  const fm = frontmatter(read(SKILL));
  assert.match(fm, /^name:\s*skill-review\s*$/m);
  assert.match(fm, /^description:\s*\S+/m);
  assert.match(fm, /^user-invocable:\s*true\s*$/m);
});

test('[R52-22] body holds the prepare, slice, finish, commit command lines in order', () => {
  const lines = body(read(SKILL))
    .split('\n')
    .filter((l) => l.includes(BIN));
  const subs = lines.map((l) => {
    const rest = l.slice(l.indexOf(BIN) + BIN.length).trim();
    return /^(\w+)/.exec(rest)?.[1];
  });
  assert.deepEqual(subs, ['prepare', 'slice', 'finish', 'commit']);
});

test('[R53-05] the optional <skill> argument goes to prepare and nothing else', () => {
  const text = flat(body(read(SKILL)));
  assert.ok(text.includes('<skill>'), 'body must name the <skill> argument');
  assert.match(text, /<skill>[^.]*\bprepare\b[^.]*\band nothing else\b|\bonly (to )?prepare\b[^.]*<skill>|<skill>[^.]*\bonly\b[^.]*\bprepare\b/i);
});

test('[R54-11] finish and commit are the only steps that write records; a stopped run writes nothing', () => {
  const text = flat(body(read(SKILL)));
  assert.match(text, /\bfinish\b[^.]*\bcommit\b[^.]*\bonly\b[^.]*\bwrite\b|\bonly\b[^.]*\bfinish\b[^.]*\bcommit\b[^.]*\bwrite/i);
  assert.match(text, /stopped run writes nothing/i);
});

test('[R62-26] the model never opens a Conversation Log and reads only prepare and slice output', () => {
  const text = flat(body(read(SKILL)));
  assert.match(text, /never opens? a Conversation Log/i);
  assert.match(text, /reads only\b[^.]*\bprepare\b[^.]*\bslice\b/i);
});

test('[R60-08] finish runs --attempt 1, 2, 3 on ste-check or privacy-check failures and stops after attempt 3', () => {
  const text = flat(body(read(SKILL)));
  const a1 = text.indexOf('--attempt 1');
  const a2 = text.indexOf('--attempt 2');
  const a3 = text.indexOf('--attempt 3');
  assert.ok(a1 !== -1, 'missing --attempt 1');
  assert.ok(a2 > a1, '--attempt 2 must follow --attempt 1');
  assert.ok(a3 > a2, '--attempt 3 must follow --attempt 2');
  assert.ok(text.includes('ste-check'), 'must name ste-check');
  assert.ok(text.includes('privacy-check'), 'must name privacy-check');
  assert.match(text.slice(a3), /\bstop/i, 'must say to stop after attempt 3');
});

test('[R67-06] on home-layout-required the skill shows that line and stops', () => {
  const text = flat(body(read(SKILL)));
  const i = text.indexOf('skill-review failed: home-layout-required');
  assert.notEqual(i, -1, 'must name the line skill-review failed: home-layout-required');
  const near = text.slice(Math.max(0, i - 200), i + 300);
  assert.match(near, /\bshow/i);
  assert.match(near, /\bstop/i);
});

test('[R67-07] README links the skill-review README in the model table and the deep-dive list; the skill folder holds README.md', () => {
  const readme = read('README.md');
  const models = section(readme, '## Recommended Models and Effort Settings');
  const row = models.split('\n').find((l) => l.startsWith('|') && l.includes(LINK));
  assert.ok(row, 'model table must link ' + LINK);
  const deep = section(readme, '## Deep-Dive Documentation');
  assert.ok(
    deep.split('\n').some((l) => /^\s*[-*]\s/.test(l) && l.includes(LINK)),
    'deep-dive list must link ' + LINK,
  );
  assert.ok(existsSync(join(REPO, '.github/skills/skill-review/README.md')), 'skill folder must hold README.md');
});
