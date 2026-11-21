import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { lines, repoRoot } from '../../support/harness.mjs';

const RULES = '.github/user-interaction.md';

function fileLines() {
  assert.ok(existsSync(join(repoRoot, RULES)), `${RULES} must exist`);
  return lines(RULES);
}

// Lines after the `## <name>` heading up to the next `## ` heading.
function section(name) {
  const all = fileLines();
  const start = all.findIndex((l) => l.trimEnd() === `## ${name}`);
  assert.notEqual(start, -1, `heading "## ${name}" must exist in ${RULES}`);
  const rest = all.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  return end === -1 ? rest : rest.slice(0, end);
}

function lineStarting(sec, prefix) {
  const found = sec.find((l) => l.startsWith(prefix));
  assert.ok(found !== undefined, `a line starting "${prefix}" must exist`);
  return found;
}

test('[R22-01] question rules heading is followed by the four labelled rules', () => {
  const sec = section('Question rules');
  for (const prefix of ['- **Context:**', '- **One at a time:**', '- **Pace:**', '- **Token savings:**']) {
    lineStarting(sec, prefix);
  }
});

test('[R23-01] Checkpoint heading is followed by the five labelled rules', () => {
  const sec = section('Checkpoint');
  for (const prefix of ['- **Present:**', '- **Ask:**', '- **Approve all:**', '- **Name items:**', '- **Cascade:**']) {
    lineStarting(sec, prefix);
  }
});

test('[R23-02] Checkpoint paragraph names the three Checkpoints', () => {
  const sec = section('Checkpoint');
  const paragraph = sec.filter((l) => l.trim() !== '' && !l.startsWith('- ')).join('\n');
  for (const marker of ['setup-card approval', 'Phase Review', 'ADR candidate']) {
    assert.ok(paragraph.includes(marker), `Checkpoint paragraph must contain "${marker}"`);
  }
});

test('[R23-03] Present line carries label examples and Name items approves unnamed items', () => {
  const sec = section('Checkpoint');
  const present = lineStarting(sec, '- **Present:**');
  for (const marker of ['S03', 'A1', 'scenario ID']) {
    assert.ok(present.includes(marker), `Present line must contain "${marker}"`);
  }
  const named = lineStarting(sec, '- **Name items:**');
  assert.ok(named.includes('unnamed items are approved'), 'Name items line must contain "unnamed items are approved"');
});

test('[R23-04] file has a Skill-specific formats heading', () => {
  section('Skill-specific formats');
});
