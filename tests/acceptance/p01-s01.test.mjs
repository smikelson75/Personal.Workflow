import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lines, read } from '../../.github/tools/workflow-core/support/harness.mjs';

const DOC = 'docs/walkthrough-node.md';

// Lines from the `## <prefix>` heading up to the next `## ` heading.
function section(prefix) {
  const all = lines(DOC);
  const start = all.findIndex((l) => l.startsWith(`## ${prefix}`));
  assert.notEqual(start, -1, `heading "## ${prefix}" must exist in ${DOC}`);
  const rest = all.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

// Text of the `### <prefix>` subsection inside the given section text.
function subsection(text, prefix) {
  const all = text.split('\n');
  const start = all.findIndex((l) => l.startsWith(`### ${prefix}`));
  assert.notEqual(start, -1, `heading "### ${prefix}" must exist`);
  const rest = all.slice(start + 1);
  const end = rest.findIndex((l) => /^###? /.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

function fences(text) {
  const out = [];
  const re = /^```[^\n]*\n([\s\S]*?)^```/gm;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();

function parts1to4() {
  return ['Part 1', 'Part 2', 'Part 3', 'Part 4'].map(section).join('\n');
}

const STALE = ['env-check', 'csv-stats', 'todo-cli', 'TodoCli', '.env.example', 'sample.csv', 'todo-demo.json'];

test('[R24-01] ideas list puts calc-repl first and Parts 1-4 use calc-repl identifiers', () => {
  const ideas = section('Simple CLI Ideas').split('\n');
  const items = ideas
    .map((l) => /^(\d+)\.\s+\*\*`([^`]+)`\*\*(.*)$/.exec(l))
    .filter(Boolean);
  assert.deepEqual(
    items.map((m) => `${m[1]}:${m[2]}`),
    ['1:calc-repl', '2:env-check', '3:csv-stats', '4:todo-cli', '5:slug-rename'],
  );
  assert.match(items[0][3], /used throughout this walkthrough/);

  const body = parts1to4();
  for (const marker of [
    'C:\\Projects\\calc-repl',
    'node bin\\calc-repl.js',
    '.workflow/specs/calc-repl-spec.md',
    '.workflow/plans/calc-repl/',
  ]) {
    assert.ok(body.includes(marker), `Parts 1-4 must contain ${marker}`);
  }
  assert.match(body, /name="calc-repl"|"name":\s*"calc-repl"/);
  assert.match(body, /bin\.calc-repl="bin\/calc-repl\.js"|"bin":\s*\{\s*"calc-repl":\s*"bin\/calc-repl\.js"/);
  assert.match(body, /git commit -m "[^"\n]*calc-repl[^"\n]*"/);
  assert.match(body, /`(feat|fix|docs|test|chore)\(calc-repl\):/);
});

test('[R24-02] Parts 1-4 and Quick Reference contain no stale featured-app references', () => {
  const body = `${parts1to4()}\n${section('Quick Reference')}`;
  for (const stale of STALE) {
    assert.ok(!body.includes(stale), `"${stale}" must not appear outside the ideas list`);
  }
});

const BRAINSTORM_V1 =
  '/brain-storm I want to build an interactive integer calculator REPL called calc-repl in Node.js with zero external runtime dependencies. It reads arithmetic expressions from stdin, evaluates binary +, -, *, and / with standard operator precedence (* and / before + and -), uses truncating integer division toward zero (for example, 7 / 2 = 3), reports a clear error on divide-by-zero or invalid expressions and re-prompts without crashing the loop, and exits cleanly on exit, quit, or EOF.';

test('[R25-01] Step 1 brain-storm prompt pins all v1 calc-repl behavior and Step 2 invokes behavior-spec', () => {
  const part3 = section('Part 3');
  const step1 = subsection(part3, 'Step 1');
  const blocks = fences(step1).map(norm);
  assert.ok(
    blocks.some((b) => b === BRAINSTORM_V1),
    'Step 1 must contain the pinned /brain-storm prompt as the sole content of a fenced block',
  );
  const step2 = subsection(part3, 'Step 2');
  assert.ok(step2.includes('/behavior-spec calc-repl'), 'Step 2 must invoke /behavior-spec calc-repl');
});

test('[R26-01] Step 3 explains black-box REPL testing and Step 4 verifies all five cases in PowerShell', () => {
  const part3 = section('Part 3');
  const step3 = subsection(part3, 'Step 3');
  assert.match(step3, /stdin/);
  assert.match(step3, /pip(e|ing)|spawn/i);
  assert.ok(step3.includes('node bin/calc-repl.js'), 'Step 3 must name `node bin/calc-repl.js`');
  assert.match(step3, /stdout/);
  assert.match(step3, /stderr/);

  const step4 = subsection(part3, 'Step 4');
  const block = fences(step4).find((b) => b.includes('node bin\\calc-repl.js'));
  assert.ok(block, 'Step 4 must have a PowerShell block running node bin\\calc-repl.js');
  assert.match(block, /@['"]\s*\n/, 'block must use a multi-line here-string');
  assert.match(block, /\|\s*node bin\\calc-repl\.js/, 'here-string must be piped into node bin\\calc-repl.js');
  for (const expr of ['2 + 3 * 4', '7 / 2', '10 / 0', '2 + * 3', 'exit']) {
    assert.ok(
      block.split(/\r?\n/).some((l) => l.trim() === expr),
      `here-string must contain a line "${expr}"`,
    );
  }
  assert.ok(block.includes('$LASTEXITCODE'), 'block must check $LASTEXITCODE');
  assert.match(step4, /interactive/i);
  assert.match(step4, /without[^\n]*pip/i);
  const all = fences(step4).join('\n');
  for (const cmd of ['npm run lint', 'npm run format:check', 'npx vitest run', 'npm run test:unit']) {
    assert.ok(all.includes(cmd), `Step 4 must run ${cmd}`);
  }
});

test('[R27-01] Part 4 has the v1 bug report, one combined evolution pass, and a split note', () => {
  const part4 = section('Part 4');
  assert.ok(
    part4.includes('/pull-work calc-repl bug: chained subtraction like 10 - 3 - 2 returns 9 instead of 5'),
    'Part 4 must contain the pinned bug-report command',
  );
  const prompt =
    '/brain-storm Add unary negative numbers (for example, -5 + 2 = -3), parentheses for grouping (for example, (2 + 3) * 4 = 20), and integer exponents using ^ (for example, 2 ^ 3 = 8), reporting negative exponents like 2 ^ -3 as an unsupported error and re-prompting without crashing.';
  const flat = norm(part4);
  const iBrain = flat.indexOf(prompt);
  assert.notEqual(iBrain, -1, 'Part 4 must contain the pinned combined /brain-storm prompt');
  const iSpec = flat.indexOf('/behavior-spec calc-repl', iBrain);
  assert.notEqual(iSpec, -1, '/behavior-spec calc-repl must follow the brain-storm prompt');
  const tail = flat.slice(iSpec + '/behavior-spec calc-repl'.length);
  assert.match(tail, /\/pull-work(?!\s+calc-repl)/, 'a plain /pull-work must follow /behavior-spec calc-repl');
  assert.ok(!/\*\*\s*\d|\d\s*\*\*\s*\d/.test(prompt), 'exponent must not use **');
  assert.match(part4, /(split|separate)[^\n]*(separate|smaller|passes)|(separate|smaller)[^\n]*(split|passes)/i);
  assert.match(part4, /alternativ|instead|or split|can be split/i);
});

test('[R28-01] five-part structure, Node ESM conventions, Workflow Core accuracy, no AGENTS.md copy', () => {
  const headings = lines(DOC).filter((l) => /^## /.test(l));
  const wanted = [
    '## Simple CLI Ideas',
    '## Part 1',
    '## Part 2',
    '## Part 3',
    '## Part 4',
    '## Quick Reference',
  ];
  let from = 0;
  for (const w of wanted) {
    const idx = headings.findIndex((h, i) => i >= from && h.startsWith(w));
    assert.notEqual(idx, -1, `heading "${w}" must exist in order`);
    from = idx + 1;
  }

  const body = parts1to4();
  assert.match(body, /type="module"|"type":\s*"module"/, 'ESM type=module must be kept');
  assert.match(body, /22\.12\+/);
  assert.match(body, /\b24\b/);
  for (const skill of ['eslint-javascript', 'vitest-javascript', 'stryker-javascript']) {
    assert.ok(body.includes(skill), `${skill} must be kept`);
  }
  assert.ok(!/"dependencies"\s*:/.test(read(DOC)), 'calc-repl must have no runtime dependencies');

  const part1 = section('Part 1');
  const s13 = subsection(part1, '1.3');
  assert.ok(s13.includes('.github\\user-interaction.md'), '1.3 must copy .github\\user-interaction.md');
  for (const l of s13.split('\n')) {
    assert.ok(!/Copy-Item.*AGENTS/.test(l), `1.3 must not copy AGENTS.md: ${l}`);
    if (/AGENTS\.md/.test(l)) {
      assert.match(l, /\b(not|never|without|n't|no)\b/i, `1.3 must not list AGENTS.md as copied: ${l}`);
    }
  }
  assert.ok(s13.includes('mutation-testing'), '1.3 must copy mutation-testing');

  const part3 = section('Part 3');
  for (const cmd of [
    '/brain-storm',
    '/behavior-spec calc-repl',
    '/pull-work',
    '/conventional-commit',
    'workflow-check.mjs',
    'approve all',
  ]) {
    assert.ok(`${body}`.includes(cmd), `walkthrough must cite ${cmd}`);
  }
  assert.match(part3, /Phase Gate|phase Gate|Gate/);
});
