import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..', '..');

const read = (...parts) => readFileSync(join(REPO, ...parts), 'utf8');

function sectionOf(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n');
}

test('[R34-01] adr-writer Inputs lists .workflow/language.md as optional and non-blocking', () => {
  const inputs = sectionOf(read('.github', 'skills', 'adr-writer', 'SKILL.md'), '## Inputs');
  assert.ok(inputs.length > 0, 'adr-writer has an ## Inputs section');
  const items = inputs.split(/\r?\n/).filter((l) => l.includes('.workflow/language.md'));
  assert.ok(items.length >= 1, 'Inputs lists .workflow/language.md');
  const item = items.find(
    (l) => l.includes('Optional') && l.includes('proceed without') && l.includes('skip Glossary grounding'),
  );
  assert.ok(item, 'one Inputs entry has Optional, proceed without, and skip Glossary grounding');
});

test('[R34-02] repo-scout declares an optional Glossary input that never blocks', () => {
  const text = read('.github', 'agents', 'repo-scout.agent.md');
  const lines = text.split(/\r?\n/);
  assert.ok(
    lines.some((l) => l.trim().startsWith('Optional input: `.workflow/language.md`')),
    'has line Optional input: `.workflow/language.md`',
  );
  assert.ok(
    lines.some((l) => l.includes('proceed without') && l.includes('skip Glossary grounding')),
    'has a sentence with proceed without and skip Glossary grounding',
  );
});

test('[R34-03] coder stays closed-world: no language.md or glossary mention', () => {
  const text = read('.github', 'agents', 'coder.agent.md');
  assert.doesNotMatch(text, /language\.md/i);
  assert.doesNotMatch(text, /glossary/i);
});

test('[Q-suite-preservation] the three existing acceptance suites pass together', () => {
  const dirs = [
    join(REPO, 'tests', 'acceptance'),
    join(REPO, '.github', 'tools', 'workflow-check', 'tests', 'acceptance'),
    join(REPO, '.github', 'tools', 'workflow-core', 'tests', 'acceptance'),
  ];
  const files = [];
  for (const dir of dirs) {
    assert.ok(existsSync(dir), `${dir} exists`);
    const found = readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
    assert.ok(found.length > 0, `${dir} has test files`);
    for (const f of found) files.push(join(dir, f));
  }
  const result = spawnSync(process.execPath, ['--test', ...files], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `node --test exit code (stderr: ${result.stderr}; stdout tail: ${(result.stdout || '').slice(-2000)})`);
});
