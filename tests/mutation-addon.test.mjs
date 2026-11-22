import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { tempRepo } from '../.github/tools/workflow-core/support/harness.mjs';

const SCRIPT = '.github/skills/work-planner/scripts/mutation-addon.mjs';
const REPO_ROOT = resolve('.');
const out = (res) => res.stdout.replace(/\r?\n$/, '');

function withRepo(fn) {
  const repo = tempRepo();
  try {
    fn(repo);
  } finally {
    repo.cleanup();
  }
}

test('comma-separated Mutation stack aliases match any listed stack', () => {
  withRepo((repo) => {
    repo.write(
      '.github/skills/stryker-dotnet/SKILL.md',
      readFileSync(resolve(REPO_ROOT, 'language-addons/csharp/stryker-dotnet/SKILL.md'), 'utf8'),
    );
    for (const alias of ['dotnet', 'csharp', 'DOTNET']) {
      const res = repo.run(SCRIPT, [alias]);
      assert.equal(res.status, 0, res.stderr);
      assert.equal(
        out(res),
        'mutation: node .github/skills/stryker-dotnet/scripts/mutation-gate.mjs --since <phase-base>',
      );
    }
  });
});

test('all three Stryker language add-ons are discovered by mutation-addon.mjs', () => {
  const cases = [
    ['stryker-dotnet', 'language-addons/csharp/stryker-dotnet/SKILL.md', 'dotnet'],
    ['stryker-typescript', 'language-addons/node-typescript/stryker-typescript/SKILL.md', 'typescript'],
    ['stryker-javascript', 'language-addons/node-javascript/stryker-javascript/SKILL.md', 'javascript'],
  ];
  for (const [name, sourcePath, stack] of cases) {
    withRepo((repo) => {
      repo.write(`.github/skills/${name}/SKILL.md`, readFileSync(resolve(REPO_ROOT, sourcePath), 'utf8'));
      const res = repo.run(SCRIPT, [stack]);
      assert.equal(res.status, 0, `${name}: ${res.stderr}`);
      assert.ok(
        out(res).includes(`.github/skills/${name}/scripts/mutation-gate.mjs`),
        `${name}: unexpected output: ${out(res)}`,
      );
    });
  }
});

test('Stryker config at repo root without matching add-on fails loudly (exit 1)', () => {
  withRepo((repo) => {
    repo.write('.github/skills/plain/SKILL.md', '# Plain skill\n');
    repo.write('stryker-config.json', '{ "stryker-config": { "project": "App.csproj" } }\n');
    const res = repo.run(SCRIPT, ['dotnet']);
    assert.equal(res.status, 1);
    assert.ok(res.stderr.includes('stryker-config.json'), `stderr was: ${res.stderr}`);
    assert.ok(res.stderr.includes('no matching mutation Language Add-on'), `stderr was: ${res.stderr}`);
  });
});
