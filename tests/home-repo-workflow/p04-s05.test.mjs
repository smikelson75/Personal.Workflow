import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readme() {
  return readFileSync(join(REPO, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
}

// The copy-into-repository PowerShell block: the fenced powershell block that defines $workflowSrc.
function copyBlock(text) {
  const blocks = [...text.matchAll(/```powershell\n([\s\S]*?)```/g)].map((m) => m[1]);
  const block = blocks.find((b) => b.includes('$workflowSrc'));
  assert.ok(block, 'README has a powershell copy block that defines $workflowSrc');
  return { block, end: text.indexOf(block) + block.length };
}

function newItemDirs(block) {
  const line = block.split('\n').find((l) => /^\s*New-Item\b/.test(l));
  assert.ok(line, 'copy block has a New-Item line');
  const m = line.match(/-Path\s+(.+?)\s+-Force/);
  assert.ok(m, 'New-Item line has -Path ... -Force');
  return m[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
}

// Each Copy-Item line as { recurse, src, dest } with the two quoted paths.
function copies(block) {
  return block
    .split('\n')
    .filter((l) => /^\s*Copy-Item\b/.test(l))
    .map((l) => {
      const q = [...l.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
      return { recurse: /-Recurse/.test(l), src: q[0], dest: q[1] };
    });
}

test('[R42-06] README copy block creates .claude\\skills, copies the skills into it, and says Claude Code reads only .claude\\', () => {
  const text = readme();
  const { block, end } = copyBlock(text);

  assert.ok(newItemDirs(block).includes('.claude\\skills'), 'New-Item creates .claude\\skills');

  const toClaudeSkills = copies(block).filter((c) => c.dest === '.claude\\skills');
  assert.equal(toClaudeSkills.length, 1, 'exactly one Copy-Item targets .claude\\skills');
  assert.equal(toClaudeSkills[0].src, '$workflowSrc\\.github\\skills\\*');
  assert.ok(toClaudeSkills[0].recurse, 'skills copy is recursive');

  const after = text.slice(end, end + 1500);
  assert.match(
    after,
    /Claude Code reads skills and agents only from `?\.claude\\`?/,
    'prose line after the block says Claude Code reads skills and agents only from .claude\\',
  );
});

test('[R43-05] README copy block creates .claude\\agents, copies the agents into it, and keeps the .github\\ copies', () => {
  const { block } = copyBlock(readme());

  assert.ok(newItemDirs(block).includes('.claude\\agents'), 'New-Item creates .claude\\agents');

  const toClaudeAgents = copies(block).filter((c) => c.dest === '.claude\\agents');
  assert.equal(toClaudeAgents.length, 1, 'exactly one Copy-Item targets .claude\\agents');
  assert.equal(toClaudeAgents[0].src, '$workflowSrc\\.github\\agents\\*.agent.md');

  const all = copies(block);
  assert.ok(
    all.some((c) => c.src === '$workflowSrc\\.github\\agents' && c.dest === '.github\\agents'),
    'block still copies .github\\agents into .github\\agents',
  );
  assert.ok(
    all.some((c) => c.src === '$workflowSrc\\.github\\skills\\*' && c.dest === '.github\\skills'),
    'block still copies .github\\skills\\* into .github\\skills',
  );
});
