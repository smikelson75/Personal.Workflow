import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../support/harness.mjs';
import { validGlossary, validSession } from '../support/fixtures.mjs';

const NAME_A = 'context-2026-11-18-0900.md';
const NAME_B = 'context-2026-11-19-1000.md';
const NAME_C = 'context-2026-11-20-1100.md';

function titleFor(name) {
  const m = /^context-(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})\.md$/.exec(name);
  return `# Context - ${m[1]} ${m[2]}:${m[3]}`;
}

// spec: { name, relationship, buildsOn, supersedes, reqs (array of requirement lines) }
function session(spec) {
  const header = [];
  if (spec.buildsOn) header.push(`- Builds on: \`${spec.buildsOn}\``);
  if (spec.supersedes) header.push(`- Supersedes: \`${spec.supersedes}\``);
  return validSession({
    relationship: spec.relationship ?? 'new',
    title: titleFor(spec.name),
    header,
    sections: { Requirements: spec.reqs.join('\n') },
  });
}

function folder(specs) {
  const files = { '.workflow/language.md': validGlossary() };
  const texts = {};
  for (const spec of specs) {
    const text = session(spec);
    texts[spec.name] = text;
    files[`.workflow/sessions/${spec.name}`] = text;
  }
  return { files, texts };
}

// 1-based line number of the nth line (default first) starting with prefix.
function lineOf(text, prefix, nth = 1) {
  const lines = text.split('\n');
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(prefix)) {
      seen++;
      if (seen === nth) return i + 1;
    }
  }
  throw new Error(`no line ${nth} starting with ${prefix}`);
}

const FINDING = /^(.+?):(\d+): (error|warning): ([a-z0-9-]+\/[a-z0-9-]+): (.*)$/;

// Returns parsed findings of one rule, as {path, line, severity, message}.
function ruleFindings(stdout, rule) {
  const out = [];
  for (const l of stdout.split('\n')) {
    const m = FINDING.exec(l);
    if (m && m[4] === rule) {
      out.push({ path: m[1], line: Number(m[2]), severity: m[3], message: m[5] });
    }
  }
  return out;
}

function assertOne(stdout, rule, path, line) {
  const found = ruleFindings(stdout, rule);
  assert.equal(found.length, 1, `expected exactly one ${rule}; stdout was: ${JSON.stringify(stdout)}`);
  assert.equal(found[0].path, path);
  assert.equal(found[0].line, line);
  assert.equal(found[0].severity, 'error');
  assert.ok(found[0].message.length > 0, 'message must not be empty');
  assert.ok(found[0].message.length <= 160, 'message too long');
}

const P = (name) => `.workflow/sessions/${name}`;
const DUP = 'chain/duplicate-id';
const UNK = 'chain/unknown-retirement';

test('[R3-06] later extend Session redefining R3 gets duplicate-id at its R3 line only', () => {
  const { files, texts } = folder([
    { name: NAME_A, reqs: ['- R3 - Users can list. Accept: it lists.'] },
    {
      name: NAME_B,
      relationship: 'extend',
      buildsOn: NAME_A,
      reqs: ['- R1 - Users can run. Accept: it runs.', '- R3 - Users can list again. Accept: it lists.'],
    },
  ]);
  const { code, stdout } = runCheck({ files });
  assertOne(stdout, DUP, P(NAME_B), lineOf(texts[NAME_B], '- R3 - '));
  assert.equal(ruleFindings(stdout, DUP).filter((f) => f.path === P(NAME_A)).length, 0);
  assert.equal(code, 1);
});

test('[R3-07] amend Session may restate R3; the same Session as extend is a duplicate', () => {
  const amend = folder([
    { name: NAME_A, reqs: ['- R3 - Users can list. Accept: it lists.'] },
    { name: NAME_B, relationship: 'amend', buildsOn: NAME_A, reqs: ['- R3 - Users can list more. Accept: it lists.'] },
  ]);
  const r1 = runCheck({ files: amend.files });
  assert.equal(ruleFindings(r1.stdout, DUP).length, 0, `stdout was: ${JSON.stringify(r1.stdout)}`);

  const extend = folder([
    { name: NAME_A, reqs: ['- R3 - Users can list. Accept: it lists.'] },
    { name: NAME_B, relationship: 'extend', buildsOn: NAME_A, reqs: ['- R3 - Users can list more. Accept: it lists.'] },
  ]);
  const r2 = runCheck({ files: extend.files });
  assertOne(r2.stdout, DUP, P(NAME_B), lineOf(extend.texts[NAME_B], '- R3 - '));
});

test('[R3-08] one Session defining R3 twice gets duplicate-id at the second definition', () => {
  const { files, texts } = folder([
    {
      name: NAME_A,
      reqs: ['- R3 - Users can list. Accept: it lists.', '- R4 - Users can sort. Accept: it sorts.', '- R3 - Users can page. Accept: it pages.'],
    },
  ]);
  const { code, stdout } = runCheck({ files });
  const line = lineOf(texts[NAME_A], '- R3 - ', 2);
  assert.ok(line > lineOf(texts[NAME_A], '- R3 - ', 1));
  assertOne(stdout, DUP, P(NAME_A), line);
  assert.equal(code, 1);
});

test('[R3-09] retiring R9 that no ancestor defines gets unknown-retirement', () => {
  const { files, texts } = folder([
    { name: NAME_A, reqs: ['- R1 - Users can run. Accept: it runs.', '- R9 - retired.'] },
  ]);
  const { code, stdout } = runCheck({ files });
  assertOne(stdout, UNK, P(NAME_A), lineOf(texts[NAME_A], '- R9 - retired.'));
  assert.equal(ruleFindings(stdout, DUP).length, 0);
  assert.equal(code, 1);
});

test('[R3-10] retirement superseded by R7 that no chain Session defines gets unknown-retirement', () => {
  const bad = folder([
    { name: NAME_A, reqs: ['- R1 - Users can run. Accept: it runs.'] },
    { name: NAME_B, relationship: 'amend', buildsOn: NAME_A, reqs: ['- R1 - retired, superseded by R7.'] },
  ]);
  const { code, stdout } = runCheck({ files: bad.files });
  assertOne(stdout, UNK, P(NAME_B), lineOf(bad.texts[NAME_B], '- R1 - retired'));
  assert.equal(code, 1);

  // control: when a chain Session defines R7, the same retirement is fine
  const good = folder([
    { name: NAME_A, reqs: ['- R1 - Users can run. Accept: it runs.', '- R7 - Users can stop. Accept: it stops.'] },
    { name: NAME_B, relationship: 'amend', buildsOn: NAME_A, reqs: ['- R1 - retired, superseded by R7.'] },
  ]);
  const r2 = runCheck({ files: good.files });
  assert.equal(ruleFindings(r2.stdout, UNK).length, 0, `stdout was: ${JSON.stringify(r2.stdout)}`);
});

test('[R3-11] amend ancestry is transitive; the same Session as extend is a duplicate', () => {
  const specs = (relC) => [
    { name: NAME_A, reqs: ['- R3 - Users can list. Accept: it lists.'] },
    { name: NAME_B, relationship: 'extend', buildsOn: NAME_A, reqs: ['- R4 - Users can sort. Accept: it sorts.'] },
    { name: NAME_C, relationship: relC, buildsOn: NAME_B, reqs: ['- R3 - Users can list more. Accept: it lists.'] },
  ];
  const amend = folder(specs('amend'));
  const r1 = runCheck({ files: amend.files });
  assert.equal(ruleFindings(r1.stdout, DUP).length, 0, `stdout was: ${JSON.stringify(r1.stdout)}`);

  const extend = folder(specs('extend'));
  const r2 = runCheck({ files: extend.files });
  assertOne(r2.stdout, DUP, P(NAME_C), lineOf(extend.texts[NAME_C], '- R3 - '));
});

test('[R1-10] superseded Session defining R1 twice gets no duplicate-id; unsuperseded does', () => {
  const specs = (supersedes) => [
    {
      name: NAME_A,
      reqs: ['- R1 - Users can run. Accept: it runs.', '- R1 - Users can stop. Accept: it stops.'],
    },
    { name: NAME_C, supersedes, reqs: ['- R2 - Users can list. Accept: it lists.'] },
  ];
  const sup = folder(specs(NAME_A));
  const r1 = runCheck({ files: sup.files });
  assert.equal(ruleFindings(r1.stdout, DUP).length, 0, `stdout was: ${JSON.stringify(r1.stdout)}`);

  const plain = folder(specs(undefined));
  const r2 = runCheck({ files: plain.files });
  assertOne(r2.stdout, DUP, P(NAME_A), lineOf(plain.texts[NAME_A], '- R1 - ', 2));
});
