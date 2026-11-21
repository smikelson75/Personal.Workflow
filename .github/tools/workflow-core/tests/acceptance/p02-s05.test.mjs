import assert from 'node:assert/strict';
import test from 'node:test';
import { tempRepo } from '../../support/harness.mjs';

const SCRIPT = '.github/skills/work-planner/scripts/mutation-addon.mjs';

const PLAIN_SKILL = ['# Plain skill', '', '- **Label:** value', 'Nothing about mutation here.', ''].join('\n');
const STRYKER_SKILL = [
  '# Stryker',
  '',
  '- **Mutation stack:** node',
  '- **Mutation command:** npx stryker run',
  '',
].join('\n');

const unsupported = (stack) => `mutation: unsupported for ${stack} - no mutation Language Add-on installed`;
const out = (res) => res.stdout.replace(/\r?\n$/, '');

function withRepo(fn) {
  const repo = tempRepo();
  try {
    fn(repo);
  } finally {
    repo.cleanup();
  }
}

test('[R17-01] a skill with no mutation lines leaves node unsupported', () => {
  withRepo((repo) => {
    repo.write('.github/skills/plain/SKILL.md', PLAIN_SKILL);
    const res = repo.run(SCRIPT, ['node']);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(out(res), unsupported('node'));
  });
});

test('[R17-02] an installed skill supplies the mutation command for node', () => {
  withRepo((repo) => {
    repo.write('.github/skills/stryker-x/SKILL.md', STRYKER_SKILL);
    const res = repo.run(SCRIPT, ['node']);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(out(res), 'mutation: npx stryker run');
  });
});

test('[R17-03] a stack the skill does not cover is unsupported', () => {
  withRepo((repo) => {
    repo.write('.github/skills/stryker-x/SKILL.md', STRYKER_SKILL);
    const res = repo.run(SCRIPT, ['csharp']);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(out(res), unsupported('csharp'));
  });
});

test('[R17-04] adding the skill changes the answer on the next run', () => {
  withRepo((repo) => {
    repo.write('.github/skills/plain/SKILL.md', PLAIN_SKILL);
    const before = repo.run(SCRIPT, ['node']);
    assert.equal(before.status, 0, before.stderr);
    assert.equal(out(before), unsupported('node'));
    repo.write('.github/skills/stryker-x/SKILL.md', STRYKER_SKILL);
    const after = repo.run(SCRIPT, ['node']);
    assert.equal(after.status, 0, after.stderr);
    assert.equal(out(after), 'mutation: npx stryker run');
  });
});

test('[R17-05] no arguments is a usage error', () => {
  withRepo((repo) => {
    repo.write('.github/skills/plain/SKILL.md', PLAIN_SKILL);
    const res = repo.run(SCRIPT, []);
    assert.equal(res.status, 2);
    assert.ok(res.stderr.includes('usage: node mutation-addon.mjs <stack>'), `stderr was: ${res.stderr}`);
  });
});
