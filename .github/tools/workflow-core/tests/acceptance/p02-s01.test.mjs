import assert from 'node:assert/strict';
import test from 'node:test';
import { tempRepo } from '../../support/harness.mjs';

const TRACE = '.github/tools/workflow-core/scripts/trace.mjs';

// The current trace.mjs runs the whole acceptance suite (including this file) when it does not
// understand --tap. Nested copies of this file register no tests, so that cannot recurse.
const nested = process.env.WFCORE_P02_S01_NESTED === '1';
process.env.WFCORE_P02_S01_NESTED = '1';
const t = nested ? () => {} : test;

function phaseFile(number, known) {
  const list = known.map((k) => `    - \`${k.title}\` - owner ${k.owner}`).join('\n');
  return [
    `# P${number} - x`,
    '',
    '- **Outcome:** x',
    known.length ? '- **Known failures:**' : '- **Known failures:** none',
    list,
    '- **Gate:**',
    '  - suite: x',
    '',
  ].join('\n');
}

function setup({ phase, tap }) {
  const repo = tempRepo();
  if (phase !== undefined) repo.write('phase-02.md', phase);
  if (tap !== undefined) repo.write('t.tap', tap);
  return repo;
}

const BOM = { title: 'legacy import keeps BOM', owner: 'P04' };

t('[R14-01] a Known Failure owned by a later phase is excluded and owned IDs pass', () => {
  const repo = setup({
    phase: phaseFile('02', [BOM]),
    tap: 'TAP version 13\nok 1 - [R3-01] a\nnot ok 2 - legacy import keeps BOM\n',
  });
  try {
    const res = repo.run(TRACE, ['--tap', 't.tap', '--phase-file', 'phase-02.md', 'R3-01']);
    assert.equal(res.status, 0, res.stderr);
  } finally {
    repo.cleanup();
  }
});

t('[R14-02] an unlisted failing test fails traceability and is named', () => {
  const repo = setup({
    phase: phaseFile('02', [BOM]),
    tap: 'TAP version 13\nok 1 - [R3-01] a\nnot ok 2 - legacy import keeps BOM\nnot ok 3 - [R3-02] duplicate ID errors\n',
  });
  try {
    const res = repo.run(TRACE, ['--tap', 't.tap', '--phase-file', 'phase-02.md', 'R3-01']);
    assert.equal(res.status, 1);
    assert.ok(res.stderr.includes('[R3-02] duplicate ID errors'), res.stderr);
  } finally {
    repo.cleanup();
  }
});

t('[R14-03] a Known Failure still failing in its owning phase counts like any test', () => {
  const repo = setup({
    phase: phaseFile('04', [BOM]),
    tap: 'TAP version 13\nok 1 - [R3-01] a\nnot ok 2 - legacy import keeps BOM\n',
  });
  try {
    const res = repo.run(TRACE, ['--tap', 't.tap', '--phase-file', 'phase-02.md', 'R3-01']);
    assert.equal(res.status, 1);
    assert.ok(res.stderr.includes('legacy import keeps BOM'), res.stderr);
  } finally {
    repo.cleanup();
  }
});

t('[R14-04] a failing Known Failure never satisfies an owned scenario ID', () => {
  const repo = setup({
    phase: phaseFile('02', [{ title: '[R3-01] a', owner: 'P04' }]),
    tap: 'TAP version 13\nnot ok 1 - [R3-01] a\n',
  });
  try {
    const res = repo.run(TRACE, ['--tap', 't.tap', '--phase-file', 'phase-02.md', 'R3-01']);
    assert.equal(res.status, 1);
    assert.ok(res.stderr.split(/\r?\n/).includes('no passing test for: R3-01'), res.stderr);
  } finally {
    repo.cleanup();
  }
});

t('[R14-05] a listed Known Failure that passes does not fail traceability', () => {
  const repo = setup({
    phase: phaseFile('02', [BOM]),
    tap: 'TAP version 13\nok 1 - legacy import keeps BOM\nok 2 - [R3-01] a\n',
  });
  try {
    const res = repo.run(TRACE, ['--tap', 't.tap', '--phase-file', 'phase-02.md', 'R3-01']);
    assert.equal(res.status, 0, res.stderr);
  } finally {
    repo.cleanup();
  }
});

t('[R14-06] an owned ID with no passing test fails and is named', () => {
  const repo = setup({ tap: 'TAP version 13\nok 1 - [R3-01] a\n' });
  try {
    const res = repo.run(TRACE, ['--tap', 't.tap', 'R3-01', 'R3-02']);
    assert.equal(res.status, 1);
    assert.ok(res.stderr.split(/\r?\n/).includes('no passing test for: R3-02'), res.stderr);
  } finally {
    repo.cleanup();
  }
});

t('[R14-07] --skip-pattern prints only later-owned Known Failures, regex-escaped', () => {
  const repo = setup({
    phase: phaseFile('02', [
      { title: 'a.b [x]', owner: 'P04' },
      { title: 'old', owner: 'P02' },
    ]),
  });
  try {
    const res = repo.run(TRACE, ['--phase-file', 'phase-02.md', '--skip-pattern']);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout, 'a\\.b \\[x\\]\n');
  } finally {
    repo.cleanup();
  }
});

t('[R14-08] without a phase file any failing test fails traceability', () => {
  const repo = setup({ tap: 'TAP version 13\nnot ok 1 - anything\n' });
  try {
    const res = repo.run(TRACE, ['--tap', 't.tap', 'R3-01']);
    assert.equal(res.status, 1);
    assert.ok(res.stderr.includes('anything'), res.stderr);
  } finally {
    repo.cleanup();
  }
});
