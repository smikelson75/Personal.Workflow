import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lines } from '../../support/harness.mjs';

const PLANNER = '.github/agents/planner.agent.md';

function lineStarting(prefix) {
  return lines(PLANNER).find((l) => l.startsWith(prefix));
}

function assertLine(prefix, fragments) {
  const line = lineStarting(prefix);
  assert.ok(line !== undefined, `no line starts with "${prefix}"`);
  for (const fragment of fragments) {
    assert.ok(line.includes(fragment), `line "${line}" lacks "${fragment}"`);
  }
}

test('[R13-01] planner tools line lists execute besides read, search, edit, agent, todo', () => {
  const line = lineStarting('tools:');
  assert.ok(line !== undefined, 'no tools: line');
  const items = [...line.matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2]);
  for (const tool of ['read', 'search', 'edit', 'execute', 'agent', 'todo']) {
    assert.ok(items.includes(tool), `tools line lacks ${tool}: ${line}`);
  }
});

test('[R13-02] planner has Commit and Stage lines', () => {
  assertLine('- Commit:', ['docs(<slug>): plan PNN', 'plan.md', 'active phase file']);
  assertLine('- Stage:', ['by path']);
});

test('[R13-03] planner Run ends line names Next, /pull-work, main session', () => {
  assertLine('- Run ends:', ['Next', '/pull-work', 'main session']);
});

test('[R13-04] planner Never line names Phase Review, Dispatch, acceptance tests, --no-verify', () => {
  assertLine('- Never:', ['Phase Review', 'Dispatch', 'acceptance tests', '--no-verify']);
});

test('[R13-05] planner has an On rejection line', () => {
  assertLine('- On rejection:', []);
});

test('[R13-06] planner has a Checkpoint line naming setup-card', () => {
  assertLine('- Checkpoint:', ['setup-card']);
});
