import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tempRepo } from '../../.github/tools/workflow-core/support/harness.mjs';

const GUARD = '.github/hooks/scripts/guard-locked-tests.mjs';

function fixture({ next = 'P01 S02', lockLine = true, oracleLine = true, tracked = {}, after = {}, phase } = {}) {
  const repo = tempRepo();
  const dir = realpathSync.native(repo.dir);
  repo.write('tests/acceptance/add.test.mjs', "test('add', () => {});\n");
  repo.write('src/add.mjs', 'export const add = (a, b) => a + b;\n');
  for (const [rel, text] of Object.entries(tracked)) repo.write(rel, text);
  const lock = repo.commit('tests');
  for (const [rel, text] of Object.entries(after)) repo.write(rel, text);
  const plan = ['# calc plan', '', '- Spec: [calc-spec.md](../../specs/calc-spec.md)', '- Lane: standard', `- Next: ${next}`];
  if (lockLine) plan.push(`- Tests locked: \`${lock}\``);
  if (oracleLine) plan.push('- Oracle: `tests/acceptance/`');
  repo.write('.workflow/plans/calc/plan.md', `${plan.join('\n')}\n`);
  if (phase) repo.write('.workflow/plans/calc/phase-01.md', phase);
  repo.commit('plan');
  return { repo, dir, lock };
}

function guard(repo, payload) {
  const input = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return repo.run(GUARD, [], { input });
}

function edit(dir, rel, cwd = dir) {
  return { tool_name: 'Edit', tool_input: { file_path: join(dir, rel) }, cwd };
}

function assertDeny(res) {
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.permissionDecision, 'deny');
  assert.equal(out.hookSpecificOutput?.hookEventName, 'PreToolUse');
  assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
  return out;
}

function assertAllow(res) {
  assert.equal(res.status, 0);
  assert.equal(res.stdout, '{}');
}

const FIXTURE_REPAIR_PHASE = [
  '# P01 - x',
  '',
  '## S03 - x',
  '',
  '- **Kind:** test-fix',
  '- **Acceptance tests:** `tests/acceptance/s03.test.mjs`',
  '',
].join('\n');

test('[R35-01] Claude Code Edit of a locked test is denied in both output formats', () => {
  const { repo, dir } = fixture();
  try {
    assertDeny(guard(repo, edit(dir, 'tests/acceptance/add.test.mjs')));
  } finally {
    repo.cleanup();
  }
});

test('[R35-02] deny reason names the path, plan, lock, and mode in both formats', () => {
  const { repo, dir, lock } = fixture();
  try {
    const out = assertDeny(guard(repo, edit(dir, 'tests/acceptance/add.test.mjs')));
    const expected =
      `tests/acceptance/add.test.mjs is a locked acceptance test (plan calc, Tests locked ${lock}). ` +
      'Only Fixture Repair or Phase Review may change it. Stop and report instead of editing it.';
    assert.equal(out.permissionDecisionReason, expected);
    assert.equal(out.hookSpecificOutput.permissionDecisionReason, expected);
  } finally {
    repo.cleanup();
  }
});

test('[R35-03] Claude Code Write of a locked test is denied', () => {
  const { repo, dir } = fixture();
  try {
    const payload = {
      tool_name: 'Write',
      tool_input: { file_path: join(dir, 'tests/acceptance/add.test.mjs'), content: 'x' },
      cwd: dir,
    };
    assertDeny(guard(repo, payload));
  } finally {
    repo.cleanup();
  }
});

test('[R35-04] Copilot CLI edit with a relative path to a locked test is denied', () => {
  const { repo, dir } = fixture();
  try {
    const payload = {
      toolName: 'edit',
      toolArgs: JSON.stringify({ path: 'tests/acceptance/add.test.mjs' }),
      cwd: dir,
    };
    assertDeny(guard(repo, payload));
  } finally {
    repo.cleanup();
  }
});

test('[R35-05] a path outside the Oracle is allowed', () => {
  const { repo, dir } = fixture();
  try {
    assertAllow(guard(repo, edit(dir, 'src/add.mjs')));
  } finally {
    repo.cleanup();
  }
});

test('[R35-06] Fixture Repair denies another card\'s locked test', () => {
  const { repo, dir } = fixture({
    next: 'fixture repair S03',
    tracked: { 'tests/acceptance/s03.test.mjs': "test('s03', () => {});\n", 'tests/acceptance/s04.test.mjs': "test('s04', () => {});\n" },
    phase: FIXTURE_REPAIR_PHASE,
  });
  try {
    const out = assertDeny(guard(repo, edit(dir, 'tests/acceptance/s04.test.mjs')));
    assert.ok(
      out.permissionDecisionReason.includes('Fixture Repair S03 may change only its own Acceptance tests.'),
      out.permissionDecisionReason,
    );
  } finally {
    repo.cleanup();
  }
});

test('[R35-07] Fixture Repair allows its own card\'s Acceptance tests', () => {
  const { repo, dir } = fixture({
    next: 'fixture repair S03',
    tracked: { 'tests/acceptance/s03.test.mjs': "test('s03', () => {});\n", 'tests/acceptance/s04.test.mjs': "test('s04', () => {});\n" },
    phase: FIXTURE_REPAIR_PHASE,
  });
  try {
    assertAllow(guard(repo, edit(dir, 'tests/acceptance/s03.test.mjs')));
  } finally {
    repo.cleanup();
  }
});

test('[R35-08] Phase Review allows Oracle edits', () => {
  const { repo, dir } = fixture({ next: 'phase review P02' });
  try {
    assertAllow(guard(repo, edit(dir, 'tests/acceptance/add.test.mjs')));
  } finally {
    repo.cleanup();
  }
});

test('[R35-09] a plan without Tests locked locks nothing', () => {
  const { repo, dir } = fixture({ lockLine: false });
  try {
    assertAllow(guard(repo, edit(dir, 'tests/acceptance/add.test.mjs')));
  } finally {
    repo.cleanup();
  }
});

test('[R35-10] a plan without Oracle locks nothing', () => {
  const { repo, dir } = fixture({ oracleLine: false });
  try {
    assertAllow(guard(repo, edit(dir, 'tests/acceptance/add.test.mjs')));
  } finally {
    repo.cleanup();
  }
});

test('[R35-11] an Oracle path untracked at the lock is allowed', () => {
  const { repo, dir } = fixture({ after: { 'tests/acceptance/new.test.mjs': "test('new', () => {});\n" } });
  try {
    assertAllow(guard(repo, edit(dir, 'tests/acceptance/new.test.mjs')));
  } finally {
    repo.cleanup();
  }
});

test('[R35-12] the edited file\'s repository is consulted, not the reported working folder', () => {
  const { repo, dir } = fixture();
  const home = tempRepo();
  try {
    home.write('AGENTS.md', '# Home\n');
    home.commit('home');
    const homeDir = realpathSync.native(home.dir);
    const out = assertDeny(guard(home, edit(dir, 'tests/acceptance/add.test.mjs', homeDir)));
    assert.ok(out.permissionDecisionReason.includes('plan calc'), out.permissionDecisionReason);
  } finally {
    home.cleanup();
    repo.cleanup();
  }
});

test('[R35-13] a path outside any repository is allowed', () => {
  const { repo, dir } = fixture();
  const outside = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfoutside-')));
  try {
    writeFileSync(join(outside, 'notes.txt'), 'x\n');
    assertAllow(guard(repo, { tool_name: 'Edit', tool_input: { file_path: join(outside, 'notes.txt') }, cwd: dir }));
  } finally {
    rmSync(outside, { recursive: true, force: true });
    repo.cleanup();
  }
});

test('[R35-14] an unreadable payload allows the edit', () => {
  const { repo } = fixture();
  try {
    assertAllow(guard(repo, 'not json'));
  } finally {
    repo.cleanup();
  }
});
