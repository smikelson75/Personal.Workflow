import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tempRepo } from '../../.github/tools/workflow-core/support/harness.mjs';

const GUARD = '.github/hooks/scripts/guard-locked-tests.mjs';

test('[R35-19] a case-variant path to a locked test is denied on a case-insensitive file system', (t) => {
  const repo = tempRepo();
  try {
    const dir = realpathSync.native(repo.dir);
    repo.write('tests/acceptance/add.test.mjs', "test('add', () => {});\n");
    repo.write('src/add.mjs', 'export const add = (a, b) => a + b;\n');
    const lock = repo.commit('tests');
    repo.write(
      '.workflow/plans/calc/plan.md',
      [
        '# calc plan',
        '',
        '- Spec: [calc-spec.md](../../specs/calc-spec.md)',
        '- Lane: standard',
        '- Next: P01 S02',
        `- Tests locked: \`${lock}\``,
        '- Oracle: `tests/acceptance/`',
        '',
      ].join('\n'),
    );
    repo.commit('plan');

    const variant = join(dir, 'Tests', 'Acceptance', 'add.test.mjs');
    if (!existsSync(variant)) {
      t.skip('case-sensitive file system: the variant names a different file');
      return;
    }

    const res = repo.run(GUARD, [], {
      input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: variant }, cwd: dir }),
    });
    assert.equal(res.status, 0);
    const out = JSON.parse(res.stdout);
    assert.equal(out.permissionDecision, 'deny');
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.ok(
      out.permissionDecisionReason.startsWith(
        `tests/acceptance/add.test.mjs is a locked acceptance test (plan calc, Tests locked ${lock}).`,
      ),
      out.permissionDecisionReason,
    );
  } finally {
    repo.cleanup();
  }
});
