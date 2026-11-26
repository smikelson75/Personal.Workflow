import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..', '..');
const WORKFLOW_CHECK = join(REPO, '.github', 'tools', 'workflow-check', 'bin', 'workflow-check.mjs');

const EXPECTED_ADDED_TERMS = [
  'Behavior Spec',
  'Plan',
  'Phase',
  'Slice',
  'Card',
  'Scenario',
  'Tier',
  'Gate',
  'Phase Review',
  'Setup-Card Approval',
  'Oracle',
  'Traceability',
  'ADR',
];

const EXPECTED_ADDON_FILES = [
  'mutation-testing/protocol.md',
  'node-typescript/eslint-typescript/SKILL.md',
  'node-typescript/eslint-typescript/references/BASELINE.md',
  'node-typescript/vitest-typescript/SKILL.md',
  'node-typescript/vitest-typescript/scripts/trace.mjs',
  'node-typescript/stryker-typescript/SKILL.md',
  'node-typescript/stryker-typescript/scripts/mutation-gate.mjs',
  'node-javascript/eslint-javascript/SKILL.md',
  'node-javascript/eslint-javascript/references/BASELINE.md',
  'node-javascript/vitest-javascript/SKILL.md',
  'node-javascript/vitest-javascript/scripts/trace.mjs',
  'node-javascript/stryker-javascript/SKILL.md',
  'node-javascript/stryker-javascript/scripts/mutation-gate.mjs',
  'csharp/dotnet-editorconfig/SKILL.md',
  'csharp/dotnet-editorconfig/references/BASELINE.md',
  'csharp/dotnet-editorconfig/references/ENFORCEMENT.md',
  'csharp/stryker-dotnet/SKILL.md',
];

function walkFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

test('[R29-01] Glossary defines the 13 added terms with Slice and Card separate', () => {
  const text = readFileSync(join(REPO, '.workflow', 'language.md'), 'utf8');
  assert.match(text, /^## Terms\r?$/m, 'missing ## Terms heading');
  assert.match(text, /^## Retired\r?$/m, 'missing ## Retired heading');

  const termsSection = text.split(/^## Terms\r?$/m)[1].split(/^## Retired\r?$/m)[0];
  const entries = [...termsSection.matchAll(/^- `([^`]+)` - (.+)$/gm)];
  const names = entries.map((m) => m[1]);

  assert.ok(names.length <= 40, `term count ${names.length} exceeds 40 cap`);

  for (const term of EXPECTED_ADDED_TERMS) {
    assert.ok(names.includes(term), `missing canonical term: ${term}`);
  }
  assert.ok(!names.some((n) => /^slice card$/i.test(n)), 'Slice and Card must not be merged into Slice Card');

  const addonEntry = entries.find((m) => m[1] === 'Language Add-on');
  assert.ok(addonEntry, 'missing Language Add-on entry');
  assert.match(addonEntry[2], /Code: `language-addons\/`/, 'Language Add-on must record Code: `language-addons/`');
});

test('[R29-02] workflow-check rejects a Glossary with duplicate or invalid term syntax', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'glossary-r29-'));
  try {
    mkdirSync(join(tmp, '.workflow', 'sessions'), { recursive: true });
    writeFileSync(
      join(tmp, '.workflow', 'language.md'),
      [
        '# Language',
        '',
        '## Terms',
        '- `Oracle` - frozen acceptance test paths.',
        '- `Oracle` - duplicate definition.',
        '- invalid entry without backticks',
        '',
        '## Retired',
        '',
      ].join('\n'),
      'utf8',
    );
    writeFileSync(
      join(tmp, '.workflow', 'sessions', 'context-2026-01-01-0000.md'),
      [
        '# Context - Demo',
        '',
        'Status: final',
        'Supersedes: none',
        'Size: small',
        '',
        '## Goal',
        '- Demo `Oracle` goal.',
        '',
        '## Requirements',
        '- R1: Demo requirement. Accept: passes.',
        '',
        '## Decisions',
        '- Keep it small.',
        '',
        '## Open Questions',
        '- none',
        '',
      ].join('\n'),
      'utf8',
    );

    const res = spawnSync(process.execPath, [WORKFLOW_CHECK], { cwd: tmp, encoding: 'utf8' });
    assert.notEqual(res.status, 0, `expected non-zero exit for invalid Glossary, got 0:\n${res.stdout}`);
    assert.match(
      res.stdout,
      /structure\/glossary-term-format|vocabulary\/glossary-conflict/,
      `expected glossary error Finding in stdout:\n${res.stdout}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('[Q-zero-workflow-check-errors] workflow-check passes on repo .workflow/ with zero errors and no Glossary findings', () => {
  const res = spawnSync(process.execPath, [WORKFLOW_CHECK], { cwd: REPO, encoding: 'utf8' });
  assert.equal(res.status, 0, `workflow-check exited ${res.status}:\n${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /workflow-check: 0 errors,/, `expected 0 errors summary:\n${res.stdout}`);

  const glossaryErrorIds = [
    'structure/glossary-section',
    'structure/glossary-term-format',
    'vocabulary/glossary-conflict',
    'vocabulary/missing-term',
    'excess/glossary-size',
  ];
  for (const id of glossaryErrorIds) {
    assert.ok(!res.stdout.includes(id), `unexpected Glossary Finding ${id} in output:\n${res.stdout}`);
  }
});

test('[R30-01] language-addons/ contains all migrated add-on files and language-skills/ does not exist', () => {
  assert.equal(existsSync(join(REPO, 'language-skills')), false, 'language-skills/ must not exist');
  assert.equal(existsSync(join(REPO, 'language-addons')), true, 'language-addons/ must exist');

  for (const rel of EXPECTED_ADDON_FILES) {
    assert.equal(
      existsSync(join(REPO, 'language-addons', ...rel.split('/'))),
      true,
      `missing migrated file: language-addons/${rel}`,
    );
  }
});

test('[R30-02] active docs, Glossary, and acceptance test reference language-addons/ and existing walkthrough suite passes', () => {
  const filesToCheck = [
    '.workflow/language.md',
    'docs/walkthrough-node.md',
    'docs/walkthrough-typescript.md',
    'docs/walkthrough-csharp.md',
    'tests/acceptance/p01-s03.test.mjs',
  ];
  for (const rel of filesToCheck) {
    const content = readFileSync(join(REPO, ...rel.split('/')), 'utf8');
    assert.match(content, /language-addons/, `${rel} must reference language-addons`);
    assert.doesNotMatch(content, /language-skills/, `${rel} must not reference language-skills`);
  }

  const res = spawnSync(`"${process.execPath}"`, ['--test', 'tests/acceptance/*.test.mjs'], {
    cwd: REPO,
    encoding: 'utf8',
    shell: true,
  });
  assert.equal(res.status, 0, `tests/acceptance/*.test.mjs failed:\n${res.stdout}\n${res.stderr}`);
});

test('[R30-03] prior Session files in .workflow/sessions/ remain untouched', () => {
  const priorSessions = [
    'context-2026-11-20-1124.md',
    'context-2026-11-21-1442.md',
    'context-2026-11-21-1750.md',
    'context-2026-11-21-1859.md',
  ];
  const diff = execFileSync('git', ['diff', '--name-only', '0344da1', '--', '.workflow/sessions'], {
    cwd: REPO,
    encoding: 'utf8',
  })
    .split(/\r?\n/)
    .filter((f) => priorSessions.some((p) => f.endsWith(`/${p}`)))
    .join('\n');
  assert.equal(diff, '', `prior Session files were modified:\n${diff}`);

  const historical = readFileSync(join(REPO, '.workflow', 'sessions', 'context-2026-11-21-1442.md'), 'utf8');
  assert.match(historical, /language-skills\//, 'historical language-skills/ reference in prior Session should remain intact');
});

test('[Q-zero-stale-language-skills-references] zero occurrences of language-skills across active files', () => {
  const targets = [
    join(REPO, '.workflow', 'language.md'),
    join(REPO, 'docs', 'walkthrough-node.md'),
    join(REPO, 'docs', 'walkthrough-typescript.md'),
    join(REPO, 'docs', 'walkthrough-csharp.md'),
    ...walkFiles(join(REPO, 'language-addons')),
    ...walkFiles(join(REPO, '.github')),
    ...walkFiles(join(REPO, 'tests', 'acceptance')),
  ];

  const hits = [];
  for (const file of targets) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    if (text.includes('language-skills')) {
      hits.push(file.slice(REPO.length + 1).split('\\').join('/'));
    }
  }
  assert.deepEqual(hits, [], `stale language-skills references found in: ${hits.join(', ')}`);
});
