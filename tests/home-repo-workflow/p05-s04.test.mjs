import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const SKILL = '.github/skills/addon-author/SKILL.md';
const PULL_WORK = '.github/skills/pull-work/SKILL.md';

const read = (rel) => readFileSync(join(repoRoot, rel), 'utf8').replace(/\r\n/g, '\n');

test('[R45-10] addon-author skill names itself, runs scaffold.mjs, asks only for ID, roles, tool and command, and states its failure outcomes and write scope', () => {
  const text = read(SKILL);

  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(fm, 'frontmatter block missing');
  assert.match(fm[1], /^name:\s*addon-author\s*$/m, 'frontmatter name must be addon-author');

  assert.ok(
    text.includes('node .github/skills/addon-author/scripts/scaffold.mjs'),
    'skill must run `node .github/skills/addon-author/scripts/scaffold.mjs`',
  );

  assert.match(text, /stack ID/i, 'must ask for the stack ID');
  assert.match(text, /code style/i, 'must name the code style role');
  assert.match(text, /test harness/i, 'must name the test harness role');
  assert.match(text, /mutation testing/i, 'must name the mutation testing role');
  assert.match(text, /\btool\b[\s\S]{0,40}\bcommand|\bcommand\b[\s\S]{0,40}\btool\b/i, 'must ask for each role\'s tool and command');
  assert.match(text, /\bonly\b[^\n]*(stack ID|roles?|tool)/i, 'must say it asks only for the stack ID, roles, tool and command');

  assert.match(text, /non-code/i, 'must mention non-code stacks');
  assert.match(text, /skip/i, 'must say roles may be skipped');
  assert.match(text, /at least one/i, 'must say at least one role is required');

  assert.match(text, /kebab-case/, 'must mention kebab-case');
  assert.match(text, /ask(s|ing)? again|again/i, 'must ask again when the ID is not kebab-case');

  assert.match(text, /not-a-workflow-source/, 'must name the not-a-workflow-source outcome');
  assert.match(text, /not-a-workflow-source[^\n]*(where|run (it )?in|must run)|(where|must run)[^\n]*not-a-workflow-source/i, 'not-a-workflow-source must say where to run it');
  assert.match(text, /Personal\.Workflow/, 'must say it runs in a Personal.Workflow source');

  assert.match(text, /addon-exists/, 'must name the addon-exists outcome');
  assert.match(text, /addon-exists[^\n]*(folder|name|stop)|(folder|name|stop)[^\n]*addon-exists/i, 'addon-exists must stop and name the folder');

  assert.ok(text.includes('language-addons/<id>/'), 'must name language-addons/<id>/ as a write location');
  assert.ok(text.includes('Available Stacks'), 'must name the Available Stacks section');
  assert.ok(text.includes('language-addons/README.md'), 'must name language-addons/README.md');
  assert.match(text, /writes? only/i, 'must say it writes only under those locations');
});

test('[R42-08] addon-author has Question rules directly followed by exactly one Core paths line identical to pull-work, and never names AGENTS.md', () => {
  const lines = read(SKILL).split('\n');
  const pullLines = read(PULL_WORK).split('\n');
  const pullCore = pullLines.filter((l) => l.startsWith('Core paths:'));
  assert.equal(pullCore.length, 1, 'pull-work must carry exactly one Core paths line');

  const core = lines.map((l, i) => [l, i]).filter(([l]) => l.startsWith('Core paths:'));
  assert.equal(core.length, 1, `expected exactly one "Core paths:" line, found ${core.length}`);
  const [line, index] = core[0];
  assert.equal(line, pullCore[0], 'Core paths line must be identical to the one in pull-work');
  assert.ok(index > 0 && lines[index - 1].startsWith('Question rules:'), 'Core paths line must directly follow the Question rules line');
  assert.equal(lines.filter((l) => l.startsWith('Question rules:')).length, 1, 'expected exactly one Question rules line');

  assert.ok(!read(SKILL).includes('AGENTS.md'), 'addon-author must not name AGENTS.md');
});
