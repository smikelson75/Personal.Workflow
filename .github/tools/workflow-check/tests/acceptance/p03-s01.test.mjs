import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../support/harness.mjs';
import { validSession, SESSION_NAME } from '../support/fixtures.mjs';

const SESSION_PATH = `.workflow/sessions/${SESSION_NAME}`;
const GLOSSARY_PATH = '.workflow/language.md';
const CLEAN = 'workflow-check: 0 errors, 0 warnings\n';

function folder(glossary) {
  return { [SESSION_PATH]: validSession(), [GLOSSARY_PATH]: glossary };
}

function lineOf(text, exact) {
  const idx = text.split('\n').indexOf(exact);
  assert.notEqual(idx, -1, `fixture line not found: ${exact}`);
  return idx + 1;
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertSingleConflict(result, line) {
  const prefix = `${GLOSSARY_PATH}:${line}: error: vocabulary/glossary-conflict: `;
  const lines = result.stdout.split('\n');
  assert.match(result.stdout, new RegExp(`^${escape(prefix)}\\S.*\\n`), `stdout was: ${result.stdout}`);
  assert.equal(lines.length, 3, `expected one finding and a summary, got: ${result.stdout}`);
  assert.equal(lines[1], 'workflow-check: 1 errors, 0 warnings');
  assert.equal(lines[2], '');
  assert.ok(lines[0].length - prefix.length <= 160);
  assert.equal(result.code, 1);
  assert.equal(result.stderr, '');
}

test('[R4-07] a Term defined twice is a glossary-conflict error at the later Term line', () => {
  const second = '- `finding` - again';
  const glossary = `# Language\n\n## Terms\n- \`Finding\` - a break\n${second}\n\n## Retired\n`;
  assert.equal(lineOf(glossary, second), 5);
  const result = runCheck({ files: folder(glossary) });
  assertSingleConflict(result, 5);
});

test('[R4-08] a Term listed in another Term Avoid is a glossary-conflict error at the Avoid line', () => {
  const holder = '- `Finding` - a break. Avoid: rule';
  const glossary = `# Language\n\n## Terms\n- \`Rule\` - a check\n${holder}\n\n## Retired\n`;
  assert.equal(lineOf(glossary, '- `Rule` - a check'), 4);
  assert.equal(lineOf(glossary, holder), 5);
  const result = runCheck({ files: folder(glossary) });
  assertSingleConflict(result, 5);
});

test('[R4-09] a Retired old term equal to a Term is a glossary-conflict error at the Retired line', () => {
  const retired = '- `finding` -> `Report` - renamed';
  const glossary = `# Language\n\n## Terms\n- \`Finding\` - a break\n\n## Retired\n${retired}\n`;
  const result = runCheck({ files: folder(glossary) });
  assertSingleConflict(result, lineOf(glossary, retired));
});

test('[R4-10] unique Terms, an unrelated Avoid, and a Retired line produce no Finding', () => {
  const glossary =
    '# Language\n\n## Terms\n- `Finding` - a break. Avoid: ticket\n- `Rule` - a check\n\n## Retired\n- `Legacy` -> `Current` - renamed\n';
  const result = runCheck({ files: folder(glossary) });
  assert.equal(result.stdout, CLEAN);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
});
