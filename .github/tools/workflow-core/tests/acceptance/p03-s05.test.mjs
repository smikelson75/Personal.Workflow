import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tempRepo } from '../../support/harness.mjs';

const SCRIPT = '.github/skills/pull-work/scripts/plan-check.mjs';

const SPEC = `# Behavior Spec - Demo

## Requirements

### R1 - a
- Rules:
  - a

### R2 - b
- Rules:
  - b

### R3 - c
- Rules:
  - c

## Quality Thresholds
- Latency -> x
`;

function plan({
  p1Status = 'completed',
  p1Covers = 'R1, R2',
  p2Status = 'planned',
  p2Covers = 'R3, Q-latency',
  gap = 'R3, Q-latency',
  next = 'plan P02',
  extra = '',
  state = ['harness', 'suite baseline', 'in place'],
} = {}) {
  return `# Plan - demo

## Phases

| Phase | Name | Status | Covers |
| --- | --- | --- | --- |
| P01 | first | ${p1Status} | ${p1Covers} |
| P02 | second | ${p2Status} | ${p2Covers} |

## Current state

${state.map((name) => `- ${name}: something`).join('\n')}

- gap to spec: ${gap}
- Next: ${next}
${extra}`;
}

function check(planText, args = ['demo', 'P01']) {
  const repo = tempRepo();
  try {
    repo.write('.workflow/specs/demo-spec.md', SPEC);
    repo.write('.workflow/plans/demo/plan.md', planText);
    repo.commit('docs(demo): fixture');
    const res = repo.run(SCRIPT, args);
    const errLines = res.stderr.split(/\r?\n/).filter((l) => l.trim() !== '');
    return { ...res, errLines };
  } finally {
    repo.cleanup();
  }
}

const DONE = { p2Status: 'completed', next: 'done' };

test('[R16-01] a pair in the gap line is allowed while the plan is not done', () => {
  const res = check(plan({ gap: 'R3, Q-latency, R2 @ check' }));
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(res.errLines, []);
});

test('[R16-02] a done plan with an uncovered pair fails', () => {
  const res = check(plan({ ...DONE, gap: 'R2 @ check' }), ['demo', 'P02']);
  assert.equal(res.status, 1);
  assert.deepEqual(res.errLines, ['uncovered pair: R2 @ check']);
});

test('[R16-03] every uncovered pair is reported on a done plan', () => {
  const res = check(plan({ ...DONE, gap: 'R2 @ check, R2 @ lint' }), ['demo', 'P02']);
  assert.equal(res.status, 1);
  assert.ok(res.errLines.includes('uncovered pair: R2 @ check'), res.stderr);
  assert.ok(res.errLines.includes('uncovered pair: R2 @ lint'), res.stderr);
  assert.equal(res.errLines.length, 2, res.stderr);
});
