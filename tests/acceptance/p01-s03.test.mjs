import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { lines } from '../../.github/tools/workflow-core/support/harness.mjs';

const NODE = 'docs/walkthrough-node.md';
const TS = 'docs/walkthrough-typescript.md';
const CS = 'docs/walkthrough-csharp.md';
const ALL = [
  { file: NODE, label: 'Node.js' },
  { file: TS, label: 'Node.js TypeScript' },
  { file: CS, label: 'C# .NET' },
];

const STALE = ['env-check', 'csv-stats', 'todo-cli', 'TodoCli', '.env.example', 'sample.csv', 'todo-demo.json'];
const EXPRESSIONS = ['2 + 3 * 4', '7 / 2', '10 / 0', '2 + * 3', 'exit'];

const v1Prompt = (label) =>
  `/brain-storm I want to build an interactive integer calculator REPL called calc-repl in ${label} with zero external runtime dependencies. It reads arithmetic expressions from stdin, evaluates binary +, -, *, and / with standard operator precedence (* and / before + and -), uses truncating integer division toward zero (for example, 7 / 2 = 3), reports a clear error on divide-by-zero or invalid expressions and re-prompts without crashing the loop, and exits cleanly on exit, quit, or EOF.`;
const BUG = 'chained subtraction like 10 - 3 - 2 returns 9 instead of 5';
const EVOLUTION =
  'Add unary negative numbers (for example, -5 + 2 = -3), parentheses for grouping (for example, (2 + 3) * 4 = 20), and integer exponents using ^ (for example, 2 ^ 3 = 8), reporting negative exponents like 2 ^ -3 as an unsupported error and re-prompting without crashing.';

// ---------- markdown helpers ----------

function headingLevel(l) {
  const m = /^(#{1,6}) /.exec(l);
  return m ? m[1].length : 0;
}

// Lines from the heading matching `re` up to (excluding) the next heading of the same or higher level.
function section(ls, re, level) {
  let start = -1;
  let inFence = false;
  for (let i = 0; i < ls.length; i++) {
    if (/^[\s>]*```/.test(ls[i])) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && headingLevel(ls[i]) === level && re.test(ls[i])) {
      start = i;
      break;
    }
  }
  assert.notEqual(start, -1, `heading matching ${re} must exist`);
  let end = ls.length;
  inFence = false;
  for (let i = start + 1; i < ls.length; i++) {
    if (/^[\s>]*```/.test(ls[i])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const lv = headingLevel(ls[i]);
    if (lv > 0 && lv <= level) {
      end = i;
      break;
    }
  }
  return ls.slice(start, end);
}

function indexOfHeading(ls, re) {
  const i = ls.findIndex((l) => headingLevel(l) === 2 && re.test(l));
  assert.notEqual(i, -1, `heading matching ${re} must exist`);
  return i;
}

function fencedBlocks(ls) {
  const out = [];
  let cur = null;
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    if (!cur) {
      const m = /^([\s>]*)```(\w*)\s*$/.exec(l);
      if (m) cur = { prefix: m[1], lang: m[2], body: [], line: i };
    } else if (/^[\s>]*```\s*$/.test(l)) {
      out.push({ lang: cur.lang, text: cur.body.join('\n'), line: cur.line });
      cur = null;
    } else {
      cur.body.push(l.startsWith(cur.prefix) ? l.slice(cur.prefix.length) : l.replace(/^[\s>]+/, ''));
    }
  }
  return out;
}

// Lines of `ls` that are outside fenced code blocks.
function prose(ls) {
  const out = [];
  let inFence = false;
  for (const l of ls) {
    if (/^[\s>]*```/.test(l)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) out.push(l);
  }
  return out;
}

function doc(file) {
  const ls = lines(file);
  const part1 = indexOfHeading(ls, /^## Part 1\b/);
  const quick = indexOfHeading(ls, /^## Quick Reference/);
  const quickEnd = section(ls, /^## Quick Reference/, 2).length + quick;
  return {
    file,
    ls,
    ideas: section(ls, /^## Simple CLI Ideas/, 2),
    parts14: ls.slice(part1, quick),
    partsAndQuick: ls.slice(part1, quickEnd),
    part3: section(ls, /^## Part 3\b/, 2),
    part4: section(ls, /^## Part 4\b/, 2),
    step: (n) => section(ls, new RegExp(`^### Step ${n}\\b`), 3),
  };
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();

function step1Prompt(d) {
  const block = fencedBlocks(d.step(1)).find((b) => b.text.trimStart().startsWith('/brain-storm'));
  assert.ok(block, `${d.file}: Part 3 Step 1 must contain a fenced /brain-storm prompt`);
  return norm(block.text);
}

function step4Code(d) {
  const blocks = fencedBlocks(d.step(4)).filter((b) => b.lang === 'powershell');
  assert.ok(blocks.length > 0, `${d.file}: Part 3 Step 4 must contain a powershell block`);
  return blocks.map((b) => b.text).join('\n');
}

function expressionLineIndexes(code) {
  const codeLines = code.split('\n').map((l) => l.trim());
  let from = 0;
  return EXPRESSIONS.map((e) => {
    const idx = codeLines.indexOf(e, from);
    assert.notEqual(idx, -1, `Step 4 PowerShell must contain the line "${e}" (in order)`);
    from = idx + 1;
    return idx;
  });
}

function assertStep4(d, { runCommand, extras }) {
  const code = step4Code(d);
  assert.match(code, /@['"]\s*\n/, `${d.file}: Step 4 must use a multi-line here-string`);
  expressionLineIndexes(code);
  const escaped = runCommand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pipe = new RegExp(`\\|\\s*${escaped}(?![\\w-])`);
  const pipeMatch = pipe.exec(code);
  assert.ok(pipeMatch, `${d.file}: Step 4 must pipe the here-string into \`${runCommand}\``);
  const exitIdx = code.indexOf('$LASTEXITCODE', pipeMatch.index);
  assert.notEqual(exitIdx, -1, `${d.file}: Step 4 must check $LASTEXITCODE after the piped run`);
  assert.doesNotMatch(
    code,
    /Set-Content|Out-File|Add-Content|New-TemporaryFile|Remove-Item|\$env:TEMP/,
    `${d.file}: Step 4 must not need scratch files`,
  );
  for (const cmd of extras) {
    assert.ok(code.includes(cmd), `${d.file}: Step 4 must run \`${cmd}\``);
  }
  const text = prose(d.step(4)).join('\n');
  assert.match(text, /interactive/i, `${d.file}: Step 4 must note interactive mode`);
  assert.match(text, /without piped input/i, `${d.file}: Step 4 must note running without piped input`);
}

// ---------- scenario tests ----------

test('[R24-05] csharp walkthrough features calc-repl as #1 with CalcRepl solution, projects, and paths', () => {
  const d = doc(CS);
  const items = d.ideas.filter((l) => /^\d+\. /.test(l));
  assert.equal(items.length, 5, 'practice ideas must list exactly five numbered ideas');
  assert.match(items[0], /^1\. \*\*`calc-repl`\*\*/, '#1 must be calc-repl');
  assert.match(items[0], /\(used throughout this walkthrough\)/, '#1 must be marked as used throughout');
  ['env-check', 'csv-stats', 'todo-cli', 'slug-rename'].forEach((name, i) => {
    assert.match(items[i + 1], new RegExp(`^${i + 2}\\. \\*\\*\`${name}\`\\*\\*`), `#${i + 2} must be ${name}`);
  });

  const body = d.parts14.join('\n');
  assert.match(d.part3[0], /calc-repl/, 'Part 3 heading must name calc-repl');
  for (const needle of [
    'C:\\Projects\\calc-repl',
    'dotnet new sln -n CalcRepl',
    'CalcRepl.Core',
    'CalcRepl.Cli',
    'CalcRepl.UnitTests',
    'CalcRepl.AcceptanceTests',
    'src\\CalcRepl.Core',
    'src\\CalcRepl.Cli',
    'tests\\CalcRepl.UnitTests',
    'tests\\CalcRepl.AcceptanceTests',
    'dotnet run --project src\\CalcRepl.Cli -c Release',
    '.workflow/specs/calc-repl-spec.md',
    '.workflow/plans/calc-repl/',
  ]) {
    assert.ok(body.includes(needle), `Parts 1-4 must contain \`${needle}\``);
  }
  assert.match(body, /\b(?:docs|feat|test|fix|chore)\(calc-repl\):/, 'Parts 1-4 must show a calc-repl commit message');
  assert.doesNotMatch(body, /todo-cli|TodoCli/, 'Parts 1-4 must not reference todo-cli / TodoCli');
});

test('[R24-06] csharp walkthrough has no stale featured-app references in Parts 1-4 and Quick Reference', () => {
  const body = doc(CS).partsAndQuick.join('\n');
  for (const term of STALE) {
    assert.ok(!body.includes(term), `Parts 1-4 and Quick Reference must not contain \`${term}\``);
  }
});

test('[R25-03] csharp Step 1 brain-storm prompt specifies v1 calc-repl and Step 2 invokes behavior-spec', () => {
  const d = doc(CS);
  assert.equal(step1Prompt(d), v1Prompt('C# .NET'));
  const step2 = fencedBlocks(d.step(2));
  assert.ok(
    step2.some((b) => b.text.trim() === '/behavior-spec calc-repl'),
    'Step 2 must contain a block with `/behavior-spec calc-repl`',
  );
});

test('[R26-03] csharp Step 3 explains black-box REPL testing and Step 4 verifies all five v1 cases', () => {
  const d = doc(CS);
  const step3 = d.step(3).join('\n');
  assert.match(step3, /stdin/, 'Step 3 must mention stdin');
  assert.match(step3, /stdout/, 'Step 3 must mention stdout');
  assert.match(step3, /stderr/, 'Step 3 must mention stderr');
  assert.match(step3, /pip(?:e|es|ed|ing)\b/i, 'Step 3 must describe piping input');
  assert.match(step3, /spawn/i, 'Step 3 must describe spawning the process');
  assert.match(step3, /built `CalcRepl\.Cli` executable/, 'Step 3 must name the built `CalcRepl.Cli` executable');
  assert.match(step3, /REPL process[- ]runner/i, 'Step 3 must describe the REPL process-runner helper');
  assert.ok(
    step3.includes('tests/CalcRepl.AcceptanceTests/Support/'),
    'Step 3 setup card must name tests/CalcRepl.AcceptanceTests/Support/',
  );
  assert.doesNotMatch(step3, /TodoCli|todo-cli/, 'Step 3 must not reference the old app');

  assertStep4(d, {
    runCommand: 'dotnet run --project src\\CalcRepl.Cli -c Release',
    extras: ['dotnet build -c Release', 'dotnet format --verify-no-changes', 'dotnet test -c Release'],
  });
});

test('[R27-03] csharp Part 4 has the v1 bug report and one combined evolution pass with a split note', () => {
  const d = doc(CS);
  const text = d.part4.join('\n');
  const bug = /\/pull-work calc-repl bug: ([^`\r\n]+)/.exec(text);
  assert.ok(bug, 'Part 4 must contain `/pull-work calc-repl bug: ...`');
  assert.equal(bug[1].trim(), BUG);

  const brain = /\/brain-storm ([^`\r\n]+)/.exec(text);
  assert.ok(brain, 'Part 4 must contain a `/brain-storm ...` evolution prompt');
  assert.equal(brain[1].trim(), EVOLUTION);

  const brainIdx = text.indexOf('/brain-storm');
  const specIdx = text.indexOf('/behavior-spec calc-repl', brainIdx);
  assert.notEqual(specIdx, -1, 'Part 4 must invoke `/behavior-spec calc-repl` after the /brain-storm');
  const pullIdx = text.indexOf('/pull-work', specIdx);
  assert.notEqual(pullIdx, -1, 'Part 4 must invoke `/pull-work` after /behavior-spec');

  assert.ok(
    prose(d.part4).some((l) => /alternatively/i.test(l) && /split/i.test(l) && /pass/i.test(l)),
    'Part 4 must note the three features can alternatively be split into separate passes',
  );
});

test('[R28-03] csharp walkthrough preserves structure, C# conventions, and Workflow Core accuracy', () => {
  const d = doc(CS);
  const headings = d.ls.filter((l) => headingLevel(l) === 2);
  const order = [
    /^## Simple CLI Ideas/,
    /^## Part 1\b/,
    /^## Part 2\b/,
    /^## Part 3\b/,
    /^## Part 4\b/,
    /^## Quick Reference/,
  ];
  let from = 0;
  for (const re of order) {
    const idx = headings.findIndex((h, i) => i >= from && re.test(h));
    assert.notEqual(idx, -1, `five-part structure: heading ${re} must exist in order`);
    from = idx + 1;
  }

  const body = d.parts14.join('\n');
  const blocks = fencedBlocks(d.parts14);
  const codeAll = blocks.map((b) => b.text).join('\n');

  // Core / CLI separation and project layout (Part 1.2)
  const part12 = fencedBlocks(section(d.ls, /^### 1\.2\b/, 3)).map((b) => b.text).join('\n');
  assert.match(part12, /dotnet new classlib -n CalcRepl\.Core\b[^\n]*src\\CalcRepl\.Core/);
  assert.match(part12, /dotnet new console\s+-n CalcRepl\.Cli\b[^\n]*src\\CalcRepl\.Cli/);
  assert.ok(
    part12.includes('dotnet add src\\CalcRepl.Cli\\CalcRepl.Cli.csproj reference src\\CalcRepl.Core\\CalcRepl.Core.csproj'),
    'CalcRepl.Cli must reference CalcRepl.Core',
  );
  assert.ok(
    part12.includes(
      'dotnet add tests\\CalcRepl.UnitTests\\CalcRepl.UnitTests.csproj reference src\\CalcRepl.Core\\CalcRepl.Core.csproj',
    ),
    'CalcRepl.UnitTests must reference CalcRepl.Core',
  );
  assert.match(part12, /dotnet new xunit -n CalcRepl\.UnitTests\s+-o tests\\CalcRepl\.UnitTests/);
  assert.match(part12, /dotnet new xunit -n CalcRepl\.AcceptanceTests\s+-o tests\\CalcRepl\.AcceptanceTests/);
  assert.ok(part12.includes('dotnet new tool-manifest'), 'local tool manifest must be created');
  assert.ok(part12.includes('dotnet tool install dotnet-stryker'), 'dotnet-stryker must be a local tool');

  // Stryker runs from the unit-test project against CalcRepl.Core
  assert.ok(codeAll.includes('Push-Location tests\\CalcRepl.UnitTests'), 'dotnet stryker must run from tests\\CalcRepl.UnitTests');
  assert.ok(codeAll.includes('dotnet stryker'), 'dotnet stryker command must be shown');
  assert.ok(body.includes('CalcRepl.Core.csproj'), 'Stryker must target CalcRepl.Core.csproj');

  // Language Add-ons + shared protocol
  for (const skill of ['dotnet-editorconfig', 'stryker-dotnet', 'mutation-testing']) {
    assert.ok(body.includes(skill), `Parts 1-4 must mention ${skill}`);
  }

  // Zero runtime dependencies
  assert.doesNotMatch(codeAll, /dotnet add [^\n]*\bpackage\b/, 'no package may be added to calc-repl');
  assert.doesNotMatch(body, /PackageReference/, 'no PackageReference may be added');

  // Part 1.3 copies the Workflow Core without AGENTS.md
  const part13 = fencedBlocks(section(d.ls, /^### 1\.3\b/, 3)).map((b) => b.text).join('\n');
  for (const piece of [
    '.github\\agents',
    '.github\\hooks',
    '.github\\skills',
    '.github\\tools\\workflow-check',
    '.github\\user-interaction.md',
  ]) {
    assert.ok(part13.includes(piece), `Part 1.3 must copy ${piece}`);
  }
  assert.ok(!part13.includes('AGENTS.md'), 'Part 1.3 must not copy AGENTS.md');

  // Workflow Core accuracy
  for (const needle of [
    '/brain-storm',
    '/behavior-spec calc-repl',
    '/behavior-spec <slug>',
    '/pull-work',
    '/pull-work <slug> bug: <description>',
    '/conventional-commit',
    'workflow-check.mjs',
    'approve all',
    'Phase Gate',
    'CalcRepl.Core.csproj',
  ]) {
    assert.ok(d.ls.join('\n').includes(needle), `walkthrough must cite \`${needle}\``);
  }
  assert.ok(
    d.part3.join('\n').includes('tests\\CalcRepl.UnitTests'),
    'Part 3 Phase Gate must run dotnet stryker from tests\\CalcRepl.UnitTests',
  );
});

// ---------- quality thresholds ----------

test('[Q-cross-stack-consistency] all three walkthroughs share v1 prompt, Step 4 expressions, and Part 4 feature set', () => {
  const docs = ALL.map(({ file, label }) => ({ ...doc(file), label }));

  // Part 3 Step 1: identical once the stack label is normalised
  const normalized = docs.map((d) => {
    const prompt = step1Prompt(d);
    const m = /called calc-repl in (Node\.js TypeScript|Node\.js|C# \.NET) with /.exec(prompt);
    assert.ok(m, `${d.file}: Step 1 prompt must name a stack label after "called calc-repl in"`);
    assert.equal(m[1], d.label, `${d.file}: Step 1 stack label`);
    return prompt.replace(m[1], '<STACK>');
  });
  assert.equal(normalized[1], normalized[0], 'TypeScript Step 1 prompt must equal Node.js prompt apart from the label');
  assert.equal(normalized[2], normalized[0], 'C# Step 1 prompt must equal Node.js prompt apart from the label');
  assert.equal(normalized[0], v1Prompt('<STACK>'));

  // Part 3 Step 4: all five expressions, in order
  for (const d of docs) expressionLineIndexes(step4Code(d));

  // Part 4: same v1 bug + same evolution feature set
  const part4 = docs.map((d) => {
    const text = d.part4.join('\n');
    const bug = /\/pull-work calc-repl bug: ([^`\r\n]+)/.exec(text);
    const brain = /\/brain-storm ([^`\r\n]+)/.exec(text);
    assert.ok(bug, `${d.file}: Part 4 must contain the calc-repl bug report`);
    assert.ok(brain, `${d.file}: Part 4 must contain the evolution /brain-storm prompt`);
    return { bug: bug[1].trim(), brain: brain[1].trim() };
  });
  for (const p of part4) {
    assert.equal(p.bug, BUG);
    assert.equal(p.brain, EVOLUTION);
  }
  assert.deepEqual(part4[1], part4[0]);
  assert.deepEqual(part4[2], part4[0]);
});

test('[Q-zero-stale-featured-app-leaks] no prior featured-app names or sample files in Parts 1-4 or Quick Reference', () => {
  for (const { file } of ALL) {
    const body = doc(file).partsAndQuick.join('\n');
    for (const term of STALE) {
      const count = body.split(term).length - 1;
      assert.equal(count, 0, `${file}: \`${term}\` appears ${count} time(s) in Parts 1-4 / Quick Reference`);
    }
  }
});

function runParser(items) {
  const script = [
    '$ErrorActionPreference = "Stop"',
    '$items = [Console]::In.ReadToEnd() | ConvertFrom-Json',
    '$result = @()',
    'foreach ($item in @($items)) {',
    '  $tokens = $null; $errs = $null',
    '  [void][System.Management.Automation.Language.Parser]::ParseInput([string]$item.code, [ref]$tokens, [ref]$errs)',
    '  $msgs = @(); foreach ($e in @($errs)) { if ($e) { $msgs += ("line " + $e.Extent.StartLineNumber + ": " + $e.Message) } }',
    '  $result += [pscustomobject]@{ id = $item.id; errors = $msgs }',
    '}',
    '[Console]::Out.Write((ConvertTo-Json -InputObject @($result) -Compress -Depth 4))',
  ].join('\n');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const input = JSON.stringify(items).replace(
    /[\u0080-\uffff]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
  for (const exe of ['powershell.exe', 'pwsh']) {
    const res = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
      input,
      encoding: 'utf8',
    });
    if (res.error) continue;
    assert.equal(res.status, 0, `${exe} failed to run the syntax check: ${res.stderr}`);
    return JSON.parse(res.stdout);
  }
  assert.fail('neither powershell.exe nor pwsh is available to validate PowerShell syntax');
}

test('[Q-powershell-copy-pasteability] every Parts 1-4 PowerShell block parses and uses backslash paths', () => {
  const items = [];
  const slashProblems = [];
  const forwardSlashPath =
    /(?:^|[\s"'(=])(?:[A-Za-z]:\/|(?:\.github|src|bin|dist|tests|language-skills)\/)|\$\w+\/[\w.]/;

  for (const { file } of ALL) {
    const d = doc(file);
    const blocks = fencedBlocks(d.parts14).filter((b) => b.lang === 'powershell');
    assert.ok(blocks.length > 0, `${file}: Parts 1-4 must contain powershell blocks`);
    blocks.forEach((b, i) => {
      const id = `${file}#${i + 1}`;
      items.push({ id, code: b.text.replace(/<[^<>\r\n]+>/g, 'placeholder') });
      // Here-string bodies are file content (e.g. .gitignore patterns), and `npm pkg set` writes
      // package.json values such as bin.calc-repl="bin/calc-repl.js"; neither is a filesystem path
      // handed to PowerShell, so only the remaining command lines are checked for forward slashes.
      let hereEnd = null;
      for (const l of b.text.split('\n')) {
        if (hereEnd) {
          if (l.startsWith(hereEnd)) hereEnd = null;
          continue;
        }
        const open = /@(['"])\s*$/.exec(l);
        if (open) hereEnd = `${open[1]}@`;
        if (/^\s*#/.test(l) || /^\s*npm pkg set\b/.test(l)) continue;
        if (forwardSlashPath.test(l)) slashProblems.push(`${id}: ${l.trim()}`);
      }
    });
  }

  const results = runParser(items);
  assert.equal(results.length, items.length, 'every block must be checked');
  const parseProblems = results.filter((r) => r.errors.length > 0).map((r) => `${r.id}: ${r.errors.join(' | ')}`);
  assert.deepEqual(parseProblems, [], 'PowerShell blocks must parse as valid PowerShell');
  assert.deepEqual(slashProblems, [], 'PowerShell commands must use backslash Windows paths');
});
