import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck } from '../support/harness.mjs';
import { validSession, validGlossary, SESSION_NAME } from '../support/fixtures.mjs';

const SESSION_PATH = `.workflow/sessions/${SESSION_NAME}`;
const FORMAT_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', '..', '..',
  '.github', 'skills', 'brain-storm', 'references', 'CONTEXT-FORMAT.md',
);
const SIZES = ['small', 'medium', 'large'];
const ALL_SECTIONS = [
  'Existing Solution', 'Problem', 'Users', 'Workflow', 'Requirements',
  'Scope Guardrails', 'Constraints', 'Success', 'Decisions', 'Language',
];

// Returns { small: [...], medium: [...], large: [...] } of section names the table marks `required`
// (the Existing Solution row, 'if extend or amend', counts as required for an extend Session).
function readTable() {
  const lines = readFileSync(FORMAT_FILE, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === '## Required Sections');
  assert.notEqual(start, -1, 'CONTEXT-FORMAT.md has no "## Required Sections" heading');
  const rows = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) break;
    if (/^\s*\|/.test(lines[i])) rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
  }
  assert.ok(rows.length >= 3, 'Required Sections table not found');
  const header = rows[0];
  assert.deepEqual(header, ['Section', 'small', 'medium', 'large']);
  const out = { small: [], medium: [], large: [] };
  const seen = [];
  for (const row of rows.slice(2)) {
    const [name, ...cells] = row;
    seen.push(name);
    SIZES.forEach((size, idx) => {
      const cell = cells[idx];
      if (cell === 'required' || (name === 'Existing Solution' && cell === 'if extend or amend')) {
        out[size].push(name);
      }
    });
  }
  assert.deepEqual(seen.slice().sort(), ALL_SECTIONS.slice().sort());
  return out;
}

function sessionWith(size, included) {
  const sections = {};
  for (const name of ALL_SECTIONS) if (!included.includes(name)) sections[name] = null;
  return validSession({ size, relationship: 'extend', sections });
}

function run(session) {
  return runCheck({ files: { [SESSION_PATH]: session, '.workflow/language.md': validGlossary() } });
}

test('[R2-20] CONTEXT-FORMAT required-sections table matches the session-section Rule for each Size', () => {
  const table = readTable();
  for (const size of SIZES) {
    const required = table[size];
    assert.ok(required.includes('Problem') && required.includes('Requirements'), `${size}: core sections`);

    const full = run(sessionWith(size, required));
    assert.doesNotMatch(full.stdout, /structure\/session-section/, `${size}: complete Session flagged:\n${full.stdout}`);

    for (const dropped of required) {
      const result = run(sessionWith(size, required.filter((n) => n !== dropped)));
      const re = new RegExp(`^${SESSION_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:1: error: structure/session-section: .*## ${dropped}\\b`, 'm');
      assert.match(result.stdout, re, `${size}: dropping ${dropped} must be flagged:\n${result.stdout}`);
    }
  }
});
