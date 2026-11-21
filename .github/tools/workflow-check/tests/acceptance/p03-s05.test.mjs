import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../support/harness.mjs';
import { validSession, validGlossary, SESSION_NAME } from '../support/fixtures.mjs';

const SESSION_PATH = `.workflow/sessions/${SESSION_NAME}`;
const GLOSSARY_PATH = '.workflow/language.md';
const CLEAN = 'workflow-check: 0 errors, 0 warnings\n';

function wordCount(text) {
  return text.split('\n').join(' ').split(/\s+/).filter(Boolean).length;
}

function lineOf(text, exact) {
  const idx = text.split('\n').indexOf(exact);
  assert.notEqual(idx, -1, `fixture line not found: ${exact}`);
  return idx + 1;
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Session with exactly `total` words, padded with neutral filler lines under Problem.
function sessionWithWords(total) {
  const base = validSession();
  const baseWords = wordCount(base);
  // Problem body: keep the original bullet, then add filler lines.
  const need = total - baseWords;
  assert.ok(need > 0, 'base session already larger than target');
  const filler = [];
  let left = need;
  while (left > 0) {
    const n = Math.min(10, left);
    filler.push(Array(n).fill('alpha').join(' '));
    left -= n;
  }
  const session = validSession({
    sections: { Problem: `- users need a tool.\n${filler.join('\n')}` },
  });
  assert.equal(wordCount(session), total, 'fixture word count');
  return session;
}

// Requirement line with exactly `n` words once the leading "- " is removed.
function requirementLine(n) {
  const fill = Array(n - 4).fill('alpha');
  fill[fill.length - 1] = 'alpha.';
  const line = `- ${['R1', '-', ...fill, 'Accept:', 'done.'].join(' ')}`;
  assert.equal(wordCount(line.slice(2)), n, 'requirement word count');
  return line;
}

// Glossary with `count` Terms (Finding plus filler Terms), blank line before ## Retired.
function glossaryWithTerms(count) {
  const terms = ['- `Finding` - a reported break.'];
  for (let i = 2; i <= count; i++) {
    terms.push(`- \`Term${String(i).padStart(2, '0')}\` - a named thing.`);
  }
  return `# Language\n\n## Terms\n${terms.join('\n')}\n\n## Retired\n`;
}

function assertOneWarning(result, path, line, ruleId) {
  const prefix = `${path}:${line}: warning: ${ruleId}: `;
  const lines = result.stdout.split('\n');
  assert.match(result.stdout, new RegExp(`^${escape(prefix)}\\S.*\\n`), `stdout was: ${result.stdout}`);
  assert.equal(lines.length, 3, `expected one finding and a summary, got: ${result.stdout}`);
  assert.equal(lines[1], 'workflow-check: 0 errors, 1 warnings');
  assert.equal(lines[2], '');
  assert.ok(lines[0].length - prefix.length <= 160);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
}

function assertClean(result) {
  assert.equal(result.stdout, CLEAN);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
}

test('[R5-01] Session of 1,501 words is a session-size warning at line 1', () => {
  const result = runCheck({
    files: { [SESSION_PATH]: sessionWithWords(1501), [GLOSSARY_PATH]: validGlossary() },
  });
  assertOneWarning(result, SESSION_PATH, 1, 'excess/session-size');
  assert.match(result.stdout, /1501/);
});

test('[R5-02] Session of exactly 1,500 words produces no Finding', () => {
  const result = runCheck({
    files: { [SESSION_PATH]: sessionWithWords(1500), [GLOSSARY_PATH]: validGlossary() },
  });
  assertClean(result);
});

test('[R5-03] requirement line of 61 words is a requirement-size warning at that line', () => {
  const req = requirementLine(61);
  const session = validSession({ sections: { Requirements: req } });
  const result = runCheck({ files: { [SESSION_PATH]: session, [GLOSSARY_PATH]: validGlossary() } });
  assertOneWarning(result, SESSION_PATH, lineOf(session, req), 'excess/requirement-size');
  assert.match(result.stdout, /61/);
});

test('[R5-04] requirement line of exactly 60 words produces no Finding', () => {
  const session = validSession({ sections: { Requirements: requirementLine(60) } });
  const result = runCheck({ files: { [SESSION_PATH]: session, [GLOSSARY_PATH]: validGlossary() } });
  assertClean(result);
});

test('[R5-05] Glossary with 41 Terms is a glossary-size warning on the ## Terms line', () => {
  const glossary = glossaryWithTerms(41);
  const result = runCheck({ files: { [SESSION_PATH]: validSession(), [GLOSSARY_PATH]: glossary } });
  assertOneWarning(result, GLOSSARY_PATH, lineOf(glossary, '## Terms'), 'excess/glossary-size');
  assert.match(result.stdout, /41/);
});

test('[R5-06] Glossary with exactly 40 Terms produces no Finding', () => {
  const result = runCheck({
    files: { [SESSION_PATH]: validSession(), [GLOSSARY_PATH]: glossaryWithTerms(40) },
  });
  assertClean(result);
});
