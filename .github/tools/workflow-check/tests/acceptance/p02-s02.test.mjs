import test from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../support/harness.mjs';
import { validGlossary, validSession } from '../support/fixtures.mjs';

const NAME_A = 'context-2026-11-20-1000.md';
const NAME_B = 'context-2026-11-20-1100.md';
const NAME_C = 'context-2026-11-20-1200.md';
const NAME_D = 'context-2026-11-20-1300.md';

const TITLES = {
  [NAME_A]: '# Context - 2026-11-20 10:00',
  [NAME_B]: '# Context - 2026-11-20 11:00',
  [NAME_C]: '# Context - 2026-11-20 12:00',
  [NAME_D]: '# Context - 2026-11-20 13:00',
};

const REQ = {
  [NAME_A]: 'R1',
  [NAME_B]: 'R2',
  [NAME_C]: 'R3',
  [NAME_D]: 'R4',
};

const pathOf = (name) => `.workflow/sessions/${name}`;

// A clean Session with a distinct title and requirement ID so no other Rule reports on it.
function session(name, overrides = {}) {
  return validSession({
    title: TITLES[name],
    sections: { Requirements: `- ${REQ[name]} - Users can run it. Accept: it runs.` },
    ...overrides,
  });
}

function folderWith(sessions) {
  const files = { '.workflow/language.md': validGlossary() };
  for (const [name, content] of Object.entries(sessions)) files[pathOf(name)] = content;
  return files;
}

function withoutLine(text, prefix) {
  return text.split('\n').filter((l) => !l.startsWith(prefix)).join('\n');
}

function splitOutput(stdout) {
  assert.ok(stdout.endsWith('\n'), 'stdout ends with LF');
  assert.ok(!stdout.includes('\r'), 'stdout has no CR');
  const lines = stdout.slice(0, -1).split('\n');
  return { findings: lines.slice(0, -1), summary: lines[lines.length - 1] };
}

function findingMatches(line, [path, ln, severity, rule]) {
  const prefix = `${path}:${ln}: ${severity}: ${rule}: `;
  if (!line.startsWith(prefix)) return false;
  const message = line.slice(prefix.length);
  return message.length > 0 && message.length <= 160;
}

function hasFinding(findings, expected) {
  return findings.some((l) => findingMatches(l, expected));
}

// Asserts stdout holds exactly these findings (in order) then the summary.
function assertExact(stdout, expected, summary) {
  const out = splitOutput(stdout);
  assert.equal(out.findings.length, expected.length, `finding count, got:\n${stdout}`);
  expected.forEach((e, i) => {
    assert.ok(findingMatches(out.findings[i], e), `finding ${i} should match ${e.join(':')}, got "${out.findings[i]}"`);
  });
  assert.equal(out.summary, summary);
}

test('[R1-07] two draft Sessions report chain/no-final error at the newer one, line 1', () => {
  const r = runCheck({
    files: folderWith({
      [NAME_A]: session(NAME_A, { status: 'draft' }),
      [NAME_B]: session(NAME_B, { status: 'draft' }),
    }),
  });
  const { findings } = splitOutput(r.stdout);
  assert.ok(
    hasFinding(findings, [pathOf(NAME_B), 1, 'error', 'chain/no-final']),
    `expected chain/no-final at B, got:\n${r.stdout}`,
  );
  assert.ok(
    !findings.some((l) => l.includes('chain/no-final') && !l.startsWith(`${pathOf(NAME_B)}:1:`)),
    'chain/no-final only at B',
  );
  assert.equal(findings.filter((l) => l.includes('chain/no-final')).length, 1);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, '');
});

test('[R3-04] final A and newer draft B report chain/draft-newest at B and no other chain/ finding', () => {
  const r = runCheck({
    files: folderWith({
      [NAME_A]: session(NAME_A, { status: 'final' }),
      [NAME_B]: session(NAME_B, { status: 'draft' }),
    }),
  });
  assertExact(r.stdout, [[pathOf(NAME_B), 1, 'error', 'chain/draft-newest']], 'workflow-check: 1 errors, 0 warnings');
  assert.equal(r.code, 1);
  assert.equal(r.stderr, '');
});

test('[R3-05] draft A (older) and final B report chain/stale-draft warning at A and nothing else', () => {
  const r = runCheck({
    files: folderWith({
      [NAME_A]: session(NAME_A, { status: 'draft' }),
      [NAME_B]: session(NAME_B, { status: 'final' }),
    }),
  });
  assertExact(r.stdout, [[pathOf(NAME_A), 1, 'warning', 'chain/stale-draft']], 'workflow-check: 0 errors, 1 warnings');
  assert.equal(r.stderr, '');
});

test('[R6-01] warnings-only run exits 0 and ends with 0 errors, 1 warnings', () => {
  const r = runCheck({
    files: folderWith({
      [NAME_A]: session(NAME_A, { status: 'draft' }),
      [NAME_B]: session(NAME_B, { status: 'final' }),
    }),
  });
  const { findings, summary } = splitOutput(r.stdout);
  assert.equal(summary, 'workflow-check: 0 errors, 1 warnings');
  assert.equal(findings.length, 1);
  assert.ok(hasFinding(findings, [pathOf(NAME_A), 1, 'warning', 'chain/stale-draft']), `got:\n${r.stdout}`);
  assert.equal(r.code, 0);
  assert.equal(r.stderr, '');
});

test('[R6-02] three stale drafts plus a final Session missing Size exit 1 with 1 errors, 3 warnings', () => {
  const r = runCheck({
    files: folderWith({
      [NAME_A]: session(NAME_A, { status: 'draft' }),
      [NAME_B]: session(NAME_B, { status: 'draft' }),
      [NAME_C]: session(NAME_C, { status: 'draft' }),
      [NAME_D]: withoutLine(session(NAME_D, { status: 'final' }), '- Size:'),
    }),
  });
  const { findings, summary } = splitOutput(r.stdout);
  assert.equal(summary, 'workflow-check: 1 errors, 3 warnings');
  assert.equal(findings.length, 4, `got:\n${r.stdout}`);
  for (const name of [NAME_A, NAME_B, NAME_C]) {
    assert.ok(hasFinding(findings, [pathOf(name), 1, 'warning', 'chain/stale-draft']), `stale-draft at ${name}`);
  }
  assert.equal(findings.filter((l) => l.includes(': error: ')).length, 1);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, '');
});

test('[R1-08] a draft superseded by a final Session is not reported as stale; an unrelated older draft is', () => {
  const r = runCheck({
    files: folderWith({
      [NAME_A]: session(NAME_A, { status: 'draft' }),
      [NAME_B]: session(NAME_B, { status: 'draft' }),
      [NAME_C]: session(NAME_C, { status: 'final', header: [`- Supersedes: \`${NAME_A}\``] }),
    }),
  });
  // Only B is stale; A is superseded by C. (B's presence proves the chain Rules run.)
  assertExact(r.stdout, [[pathOf(NAME_B), 1, 'warning', 'chain/stale-draft']], 'workflow-check: 0 errors, 1 warnings');
  assert.ok(!r.stdout.includes(`${pathOf(NAME_A)}:1: warning: chain/stale-draft`));
  assert.equal(r.code, 0);
  assert.equal(r.stderr, '');
});
