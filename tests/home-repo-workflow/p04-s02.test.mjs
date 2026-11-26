import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const FILES = [
  '.github/skills/adr-writer/SKILL.md',
  '.github/skills/behavior-spec/SKILL.md',
  '.github/skills/brain-storm/SKILL.md',
  '.github/skills/conventional-commit/SKILL.md',
  '.github/skills/incubate/SKILL.md',
  '.github/skills/pull-work/SKILL.md',
  '.github/skills/work-planner/SKILL.md',
  '.github/agents/planner.agent.md',
];

const MAPPINGS = [
  ['.github/skills/', '.claude/skills/'],
  ['.github/agents/', '.claude/agents/'],
  ['.github/tools/', '.workflow-core/tools/'],
  ['.github/hooks/', '.workflow-core/hooks/'],
  ['.github/user-interaction.md', '.workflow-core/user-interaction.md'],
];

test('[R42-03] each skill that names a Workflow Core path and the planner agent carry one Core paths line right after Question rules', () => {
  for (const rel of FILES) {
    const lines = readFileSync(join(repoRoot, rel), 'utf8').split(/\r?\n/);
    const core = lines.map((l, i) => [l, i]).filter(([l]) => l.startsWith('Core paths:'));
    assert.equal(core.length, 1, `${rel}: expected exactly one line starting "Core paths:", found ${core.length}`);
    const [line, index] = core[0];
    assert.ok(line.includes('WORKFLOW_HOME'), `${rel}: Core paths line lacks WORKFLOW_HOME`);
    for (const [from, to] of MAPPINGS) {
      assert.ok(line.includes(from), `${rel}: Core paths line lacks ${from}`);
      assert.ok(line.includes(`$WORKFLOW_HOME/${to}`), `${rel}: Core paths line lacks $WORKFLOW_HOME/${to}`);
    }
    assert.ok(line.includes('Project Repo root'), `${rel}: Core paths line lacks "Project Repo root"`);
    assert.ok(index > 0 && lines[index - 1].startsWith('Question rules:'), `${rel}: Core paths line does not directly follow the Question rules line`);
  }
});
