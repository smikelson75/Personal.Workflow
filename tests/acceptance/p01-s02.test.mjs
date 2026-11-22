import test from 'node:test';
import assert from 'node:assert/strict';
import { read, lines } from '../../.github/tools/workflow-core/support/harness.mjs';

const DOC = 'docs/walkthrough-typescript.md';

// ---- structural helpers (fence-aware) ----

function doc() {
  return lines(DOC);
}

function fenceMask(all) {
  let inFence = false;
  return all.map((l) => {
    if (/^\s*```/.test(l)) {
      const was = inFence;
      inFence = !inFence;
      return was || inFence; // fence marker lines count as in-fence
    }
    return inFence;
  });
}

// Returns the text (joined) from the heading matching `re` (at `level` hashes)
// until the next heading of the same or shallower level.
function section(re, level) {
  const all = doc();
  const mask = fenceMask(all);
  const marker = '#'.repeat(level);
  const isHeading = (i) => !mask[i] && new RegExp(`^#{1,${level}} `).test(all[i]);
  let start = -1;
  for (let i = 0; i < all.length; i++) {
    if (!mask[i] && all[i].startsWith(`${marker} `) && re.test(all[i])) {
      start = i;
      break;
    }
  }
  assert.notEqual(start, -1, `heading ${re} (level ${level}) not found in ${DOC}`);
  let end = all.length;
  for (let i = start + 1; i < all.length; i++) {
    if (isHeading(i)) {
      end = i;
      break;
    }
  }
  return all.slice(start, end).join('\n');
}

// Everything from `## Part 1` to the end of the file (Parts 1-4 + Quick Reference).
function partsAndQuickRef() {
  const all = doc();
  const mask = fenceMask(all);
  const start = all.findIndex((l, i) => !mask[i] && /^## Part 1\b/.test(l));
  assert.notEqual(start, -1, '## Part 1 heading not found');
  return all.slice(start).join('\n');
}

function parts1to4() {
  return ['1', '2', '3', '4'].map((n) => section(new RegExp(`^## Part ${n}\\b`), 2)).join('\n');
}

function blocks(text) {
  const out = [];
  const ls = text.split('\n');
  let cur = null;
  for (const l of ls) {
    const m = /^\s*```(\w*)\s*$/.exec(l);
    if (m) {
      if (cur) {
        out.push(cur);
        cur = null;
      } else {
        cur = { lang: m[1], body: [] };
      }
    } else if (cur) {
      cur.body.push(l);
    }
  }
  return out.map((b) => ({ lang: b.lang, body: b.body.join('\n') }));
}

function stripBlocks(text) {
  let inFence = false;
  return text
    .split('\n')
    .filter((l) => {
      if (/^\s*```/.test(l)) {
        inFence = !inFence;
        return false;
      }
      return !inFence;
    })
    .join('\n');
}

function step(n) {
  return section(new RegExp(`^### Step ${n}\\b`), 3);
}

const BRAIN_STORM_V1 =
  '/brain-storm I want to build an interactive integer calculator REPL called calc-repl in Node.js TypeScript with zero external runtime dependencies. It reads arithmetic expressions from stdin, evaluates binary +, -, *, and / with standard operator precedence (* and / before + and -), uses truncating integer division toward zero (for example, 7 / 2 = 3), reports a clear error on divide-by-zero or invalid expressions and re-prompts without crashing the loop, and exits cleanly on exit, quit, or EOF.';

const BRAIN_STORM_DAY2 =
  '/brain-storm Add unary negative numbers (for example, -5 + 2 = -3), parentheses for grouping (for example, (2 + 3) * 4 = 20), and integer exponents using ^ (for example, 2 ^ 3 = 8), reporting negative exponents like 2 ^ -3 as an unsupported error and re-prompting without crashing.';

const BUG_LINE =
  '/pull-work calc-repl bug: chained subtraction like 10 - 3 - 2 returns 9 instead of 5';

// ---- tests ----

test('[R24-03] typescript walkthrough lists calc-repl as #1 and uses calc-repl identifiers throughout Parts 1-4', () => {
  const ideas = section(/^## Simple CLI Ideas/, 2);
  const items = [...ideas.matchAll(/^(\d+)\.\s+\*\*`([^`]+)`\*\*(.*)$/gm)].map((m) => ({
    n: Number(m[1]),
    name: m[2],
    rest: m[3],
  }));
  assert.deepEqual(
    items.map((i) => `${i.n}:${i.name}`),
    ['1:calc-repl', '2:env-check', '3:csv-stats', '4:todo-cli', '5:slug-rename'],
  );
  assert.match(items[0].rest, /used throughout this walkthrough/);

  const body = parts1to4();
  const markers = [
    'C:\\Projects\\calc-repl',
    'name="calc-repl"',
    'bin.calc-repl="dist/cli.js"',
    'node dist\\cli.js',
    '.workflow/specs/calc-repl-spec.md',
    '.workflow/plans/calc-repl/',
  ];
  for (const m of markers) {
    assert.ok(body.includes(m), `Parts 1-4 must contain ${m}`);
  }
  assert.match(body, /\b(?:feat|fix|docs|test|chore|refactor)\(calc-repl\):/, 'commit example scoped to calc-repl');
});

test('[R24-04] typescript walkthrough has no stale featured-app references in Parts 1-4 or Quick Reference', () => {
  const body = partsAndQuickRef();
  for (const stale of ['env-check', 'csv-stats', 'todo-cli', 'TodoCli', '.env.example', 'sample.csv', 'todo-demo.json']) {
    assert.ok(!body.includes(stale), `stale reference ${stale} must not appear in Parts 1-4 / Quick Reference`);
  }
  // Part 4 and Quick Reference must exist so the check above is meaningful.
  assert.ok(section(/^## Quick Reference/, 2).includes('/brain-storm'));
});

test('[R25-02] Step 1 brain-storm prompt specifies v1 calc-repl behavior and Step 2 invokes behavior-spec calc-repl', () => {
  const s1 = blocks(step(1));
  const prompts = s1.filter((b) => b.body.trim().startsWith('/brain-storm'));
  assert.equal(prompts.length, 1, 'exactly one /brain-storm prompt block in Step 1');
  assert.equal(prompts[0].body.trim(), BRAIN_STORM_V1);

  const s2 = blocks(step(2));
  assert.ok(
    s2.some((b) => b.body.trim() === '/behavior-spec calc-repl'),
    'Step 2 must contain a block with /behavior-spec calc-repl',
  );
});

test('[R26-02] Step 3 explains black-box REPL testing and Step 4 pipes the five v1 cases into node dist\\cli.js', () => {
  const s3 = step(3);
  assert.match(s3, /stdin/);
  assert.match(s3, /stdout/);
  assert.match(s3, /stderr/);
  assert.ok(s3.includes('node dist/cli.js'), 'Step 3 mentions node dist/cli.js');
  assert.match(s3, /pip(e|ing)/i, 'Step 3 mentions piping input');
  assert.match(s3, /spawn/i, 'Step 3 mentions spawning the process');
  assert.match(s3, /calc-repl/, 'Step 3 examples use calc-repl');

  const s4 = step(4);
  const ps = blocks(s4).filter((b) => b.lang === 'powershell');
  const main = ps.find((b) => b.body.includes('LASTEXITCODE'));
  assert.ok(main, 'a PowerShell block checks $LASTEXITCODE');
  const body = main.body.replace(/\r/g, '');

  const hs = /@"\s*\n([\s\S]*?)\n"@\s*\|\s*node dist\\cli\.js/.exec(body);
  assert.ok(hs, 'here-string piped into node dist\\cli.js');
  assert.deepEqual(
    hs[1].split('\n').map((l) => l.trim()),
    ['2 + 3 * 4', '7 / 2', '10 / 0', '2 + * 3', 'exit'],
  );
  assert.ok(!/Set-Content|Out-File|sample\./.test(body), 'no scratch files in Step 4');

  const idx = (s, from = 0) => body.indexOf(s, from);
  const firstBuild = idx('npm run build');
  const pipe = body.search(/"@\s*\|\s*node dist\\cli\.js/);
  const exitCode = idx('$LASTEXITCODE');
  assert.ok(firstBuild !== -1 && firstBuild < pipe, 'npm run build runs before the pipe');
  assert.ok(pipe < exitCode, '$LASTEXITCODE checked after the pipe');
  let pos = exitCode;
  for (const cmd of ['npm run typecheck', 'npm run lint', 'npm run format:check', 'npm run build', 'npx vitest run', 'npm run test:unit']) {
    const at = idx(cmd, pos);
    assert.ok(at !== -1, `${cmd} must follow in the verification suite`);
    pos = at + cmd.length;
  }

  const prose = stripBlocks(s4);
  assert.match(prose, /without piped input/i);
  assert.match(prose, /interactive/i);
  assert.ok(s4.includes('node dist\\cli.js'));
});

test('[R27-02] Part 4 has the v1 bug example, one combined Day-2 evolution pass, and the split-pass note', () => {
  const p4 = section(/^## Part 4\b/, 2);
  const flat = p4.replace(/\r/g, '');
  assert.ok(flat.includes(BUG_LINE), 'bug-report example present');

  const bs = flat.indexOf(BRAIN_STORM_DAY2);
  assert.ok(bs !== -1, 'combined /brain-storm prompt present verbatim');
  const spec = flat.indexOf('/behavior-spec calc-repl', bs);
  assert.ok(spec > bs, '/behavior-spec calc-repl follows the brain-storm');
  const pull = flat.indexOf('/pull-work', spec);
  assert.ok(pull > spec, '/pull-work follows the behavior-spec');
  assert.equal(flat.split('/brain-storm').length - 1, 1, 'exactly one combined brain-storm pass');
  assert.match(flat, /new chat/i);

  assert.ok(!/\d\s*\*\*\s*-?\d/.test(flat), 'no ** exponent notation');
  assert.match(flat, /split/i);
  assert.match(flat, /separate/i);
  assert.match(flat, /smaller/i);
});

test('[R28-02] five-part structure, TypeScript conventions, and Workflow Core accuracy are preserved', () => {
  const text = read(DOC).replace(/\r/g, '');
  const all = text.split('\n');
  const mask = fenceMask(all);
  const heads = all.filter((l, i) => !mask[i] && /^## /.test(l));
  const wanted = [/^## Simple CLI Ideas/, /^## Part 1\b/, /^## Part 2\b/, /^## Part 3\b/, /^## Part 4\b/, /^## Quick Reference/];
  assert.equal(heads.length, wanted.length, `expected 6 level-2 headings, got: ${heads.join(' | ')}`);
  wanted.forEach((re, i) => assert.match(heads[i], re));

  // TypeScript ESM conventions
  for (const m of ['type="module"', 'dist/cli.js', '~6.0.3', 'eslint-typescript', 'vitest-typescript', 'stryker-typescript', '22.12+']) {
    assert.ok(text.includes(m), `must retain ${m}`);
  }

  // Zero external runtime deps: any npm install in the doc is dev-only.
  for (const l of all.filter((x) => /\bnpm (install|i)\b/.test(x))) {
    assert.match(l, /(-D\b|--save-dev)/, `runtime install not allowed: ${l}`);
  }

  // Part 1.3
  const p13 = section(/^### 1\.3\b/, 3);
  for (const m of [
    '.github\\agents',
    '.github\\hooks',
    '.github\\skills',
    '.github\\tools\\workflow-check',
    '.github\\user-interaction.md',
    'eslint-typescript',
    'vitest-typescript',
    'stryker-typescript',
    'mutation-testing',
  ]) {
    assert.ok(p13.includes(m), `Part 1.3 must reference ${m}`);
  }
  assert.ok(!p13.includes('AGENTS.md'), 'Part 1.3 must not copy AGENTS.md');

  // Workflow Core accuracy
  for (const m of [
    '/brain-storm',
    '/behavior-spec <slug>',
    '/pull-work',
    '/pull-work <slug> bug: <description>',
    '/conventional-commit',
    'workflow-check.mjs',
    'approve all',
    '<phase-start-ref>',
  ]) {
    assert.ok(text.includes(m), `must reference ${m}`);
  }
});
