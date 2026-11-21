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

function assertSingleGlossaryError(result, ruleId, line) {
  const prefix = `${GLOSSARY_PATH}:${line}: error: ${ruleId}: `;
  const lines = result.stdout.split('\n');
  assert.match(result.stdout, new RegExp(`^${escape(prefix)}\\S.*\\n`), `stdout was: ${result.stdout}`);
  assert.equal(lines.length, 3, `expected one finding and a summary, got: ${result.stdout}`);
  assert.equal(lines[1], 'workflow-check: 1 errors, 0 warnings');
  assert.equal(lines[2], '');
  assert.ok(lines[0].length - prefix.length <= 160);
  assert.equal(result.code, 1);
  assert.equal(result.stderr, '');
}

test('[R2-11] Glossary without ## Retired is a glossary-section error at line 1', () => {
  const glossary = '# Language\n\n## Terms\n- `Finding` - a reported break.\n';
  const result = runCheck({ files: folder(glossary) });
  assertSingleGlossaryError(result, 'structure/glossary-section', 1);
  assert.match(result.stdout, /Retired/);
});

test('[R2-12] Term line without backticks is a glossary-term-format error at that line', () => {
  const bad = '- Finding - a reported break';
  const glossary = `# Language\n\n## Terms\n${bad}\n- \`Finding\` - a reported break.\n\n## Retired\n`;
  assert.equal(lineOf(glossary, bad), 4);
  const result = runCheck({ files: folder(glossary) });
  assertSingleGlossaryError(result, 'structure/glossary-term-format', 4);
});

test('[R2-13] Retired line without a reason is a glossary-term-format error at that line', () => {
  const bad = '- `Old` -> `New`';
  const glossary = `# Language\n\n## Terms\n- \`Finding\` - a reported break.\n\n## Retired\n${bad}\n`;
  const result = runCheck({ files: folder(glossary) });
  assertSingleGlossaryError(result, 'structure/glossary-term-format', lineOf(glossary, bad));
});

test('[R2-14] fully-formed Term and Retired lines produce no Finding', () => {
  const term = '- `Finding` - a reported break. Avoid: issue. States: open -> closed. Code: `.workflow/`';
  const retired = '- `Old` -> `New` - renamed';
  const glossary = `# Language\n\n## Terms\n${term}\n\n## Retired\n${retired}\n`;
  const result = runCheck({ files: folder(glossary) });
  assert.equal(result.stdout, CLEAN);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
});
