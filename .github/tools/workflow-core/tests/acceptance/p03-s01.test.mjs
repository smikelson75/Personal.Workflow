import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tempRepo } from '../../support/harness.mjs';

const SCRIPT = '.github/skills/pull-work/scripts/reconcile-check.mjs';

const specText = (version) => `# Behavior Spec - Demo

## Requirements

### R1 - a
- Rules:
  - ${version}
`;

const planText = (next, reconciled) => `# Plan - demo

## Current state

- harness: something
- suite baseline: something
- in place: something
${reconciled ? `- Reconciled: \`${reconciled}\`\n` : ''}- gap to spec: none
- Next: ${next}
`;

// Commits spec v1, then a plan reconciled at that commit. Returns the repo and the spec commit.
function setup({ withReconciled = true } = {}) {
  const repo = tempRepo();
  repo.write('.workflow/specs/demo-spec.md', specText('v1'));
  const specCommit = repo.commit('docs(demo): spec');
  repo.write('.workflow/plans/demo/plan.md', planText('done', withReconciled ? specCommit : null));
  repo.commit('docs(demo): plan');
  return { repo, specCommit };
}

test('[R20-01] a spec changed after the reconcile point is changed', () => {
  const { repo } = setup();
  try {
    repo.write('.workflow/specs/demo-spec.md', specText('v2'));
    repo.commit('docs(demo): amend spec');
    const res = repo.run(SCRIPT, ['status', 'demo']);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.trim(), 'changed');
  } finally {
    repo.cleanup();
  }
});

test('[R20-02] a later commit that changes only another file leaves the spec unchanged', () => {
  const { repo } = setup();
  try {
    repo.write('src/app.js', 'export const x = 1;\n');
    repo.commit('feat(demo): app');
    const res = repo.run(SCRIPT, ['status', 'demo']);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.trim(), 'unchanged');
  } finally {
    repo.cleanup();
  }
});

test('[R20-03] an uncommitted spec edit is not a change', () => {
  const { repo } = setup();
  try {
    repo.write('.workflow/specs/demo-spec.md', specText('v2'));
    const res = repo.run(SCRIPT, ['status', 'demo']);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.trim(), 'unchanged');
  } finally {
    repo.cleanup();
  }
});

test('[R20-04] a plan with no Reconciled line counts as changed', () => {
  const { repo } = setup({ withReconciled: false });
  try {
    const res = repo.run(SCRIPT, ['status', 'demo']);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.trim(), 'changed');
  } finally {
    repo.cleanup();
  }
});

test('[R20-05] candidates lists open plans, changed done plans, and specs with no plan', () => {
  const repo = tempRepo();
  try {
    for (const slug of ['a', 'b', 'c', 'd']) {
      repo.write(`.workflow/specs/${slug}-spec.md`, specText(`${slug}1`));
    }
    const specCommit = repo.commit('docs: specs');
    repo.write('.workflow/plans/a/plan.md', planText('P01 S01', specCommit));
    repo.write('.workflow/plans/b/plan.md', planText('done', specCommit));
    repo.write('.workflow/plans/c/plan.md', planText('done', specCommit));
    repo.commit('docs: plans');
    repo.write('.workflow/specs/b-spec.md', specText('b2'));
    repo.commit('docs(b): amend spec');
    const res = repo.run(SCRIPT, ['candidates']);
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(res.stdout.split(/\r?\n/).filter((l) => l !== ''), [
      'a\topen',
      'b\tspec changed',
      'd\tno plan',
    ]);
  } finally {
    repo.cleanup();
  }
});

test('[R20-06] a missing spec file is reported', () => {
  const repo = tempRepo();
  try {
    repo.write('.workflow/specs/demo-spec.md', specText('v1'));
    repo.commit('docs(demo): spec');
    const res = repo.run(SCRIPT, ['status', 'ghost']);
    assert.equal(res.status, 1);
    assert.deepEqual(res.stderr.split(/\r?\n/).filter((l) => l.trim() !== ''), [
      'missing spec: .workflow/specs/ghost-spec.md',
    ]);
  } finally {
    repo.cleanup();
  }
});
