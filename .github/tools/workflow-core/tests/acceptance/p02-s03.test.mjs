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

test('[R15-01] a completed phase with matching gap and state lines passes', () => {
  const res = check(plan());
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(res.errLines, []);
});

test('[R15-02] a slice table for the completed phase is reported', () => {
  const res = check(plan({ extra: '\n## P01 slices\n\n| Slice | Name |\n| --- | --- |\n| S01 | x |\n' }));
  assert.equal(res.status, 1);
  assert.deepEqual(res.errLines, ['slice table P01 present']);
});

test('[R15-03] a gap that lists a covered ID is a gap mismatch', () => {
  const res = check(plan({ gap: 'R1, R3, Q-latency' }));
  assert.equal(res.status, 1);
  assert.deepEqual(res.errLines, ['gap mismatch: expected R3, Q-latency but found R1, R3, Q-latency']);
});

test('[R15-04] a partly covered ID stays in the gap with a partial marker', () => {
  const partial = check(plan({ p1Covers: 'R1, R2 (failure handling only)', gap: 'R2 partial, R3, Q-latency' }));
  assert.equal(partial.status, 0, partial.stderr);
  assert.deepEqual(partial.errLines, []);

  const unmarked = check(plan({ p1Covers: 'R1, R2 (failure handling only)', gap: 'R2, R3, Q-latency' }));
  assert.equal(unmarked.status, 1);
  assert.deepEqual(unmarked.errLines, [
    'gap mismatch: expected R2 partial, R3, Q-latency but found R2, R3, Q-latency',
  ]);
});

test('[R15-05] a Review pending line is reported', () => {
  const res = check(plan({ extra: '- Review pending: S02\n' }));
  assert.equal(res.status, 1);
  assert.deepEqual(res.errLines, ['Review pending present']);
});

test('[R15-06] a phase that is not completed is reported', () => {
  const res = check(plan({ p1Status: 'in progress', gap: 'R1, R2, R3, Q-latency', next: 'phase review P01' }));
  assert.equal(res.status, 1);
  assert.deepEqual(res.errLines, ['phase P01 not completed']);
});

test('[R15-07] a done plan needs gap none', () => {
  const done = { p2Status: 'completed', next: 'done' };
  const ok = check(plan({ ...done, gap: 'none' }), ['demo', 'P02']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(ok.errLines, []);

  const bad = check(plan({ ...done, gap: 'R3' }), ['demo', 'P02']);
  assert.equal(bad.status, 1);
  assert.deepEqual(bad.errLines, ['gap mismatch: expected none but found R3']);
});

test('[R15-08] a missing current state line is reported', () => {
  const res = check(plan({ state: ['suite baseline', 'in place'] }));
  assert.equal(res.status, 1);
  assert.deepEqual(res.errLines, ['missing current state line: harness']);
});

test('[R15-09] no arguments gives the usage line and exit 2', () => {
  const res = check(plan(), []);
  assert.equal(res.status, 2);
  assert.ok(res.stderr.includes('usage: node plan-check.mjs <slug> <PNN>'), res.stderr);
});
