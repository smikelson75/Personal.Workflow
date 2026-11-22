# Behavior Spec - Calc REPL Walkthroughs

## Sources
- Sessions: `context-2026-11-21-1750.md` (builds on `context-2026-11-21-1442.md`)
- Language: `.workflow/language.md`

## Target Outcome
- once v1 is done, all three stack walkthroughs (`docs/walkthrough-node.md`, `docs/walkthrough-typescript.md`, and `docs/walkthrough-csharp.md`) guide a Developer from repository setup through v1 build, interactive REPL verification, and Day-2 bug and feature evolution on one shared zero-dependency integer calculator REPL (`calc-repl`), with copy-pasteable PowerShell commands, preserved stack conventions, and no stale references to prior featured apps.

## Requirements

### R24 - All three walkthroughs feature `calc-repl` end-to-end
- Rules:
  - Applies to `docs/walkthrough-node.md`, `docs/walkthrough-typescript.md`, and `docs/walkthrough-csharp.md`.
  - Each walkthrough's practice-ideas section lists five ideas in order: `#1` is `calc-repl` (marked as used throughout the walkthrough), followed by `env-check`, `csv-stats`, `todo-cli`, and `slug-rename` as alternates `#2`–`#5`.
  - Parts 1–4 in every walkthrough reference `calc-repl` consistently across directory paths (`C:\Projects\calc-repl`), package/solution/project identifiers, runnable commands, workflow artifact paths (`.workflow/specs/calc-repl-spec.md`, `.workflow/plans/calc-repl/`), and commit message examples:
    - `docs/walkthrough-node.md`: `package.json` `name="calc-repl"`, `bin.calc-repl="bin/calc-repl.js"`, and `node bin\calc-repl.js`.
    - `docs/walkthrough-typescript.md`: `package.json` `name="calc-repl"`, `bin.calc-repl="dist/cli.js"`, and `node dist\cli.js`.
    - `docs/walkthrough-csharp.md`: solution `CalcRepl`, projects `CalcRepl.Core`, `CalcRepl.Cli`, `CalcRepl.UnitTests`, and `CalcRepl.AcceptanceTests`, paths `src\CalcRepl.Core`, `src\CalcRepl.Cli`, `tests\CalcRepl.UnitTests`, and `tests\CalcRepl.AcceptanceTests`, and `dotnet run --project src\CalcRepl.Cli -c Release`.
  - Parts 1–4 and the Quick Reference contain no stale references to prior featured apps (`env-check`, `csv-stats`, `todo-cli`, `TodoCli`, `.env.example`, `sample.csv`, `todo-demo.json`); the four alternate app names appear only in the practice-ideas section.
- Failure:
  - any walkthrough missing `calc-repl` as `#1`, omitting any of the four alternate ideas, or retaining a prior featured app name, path, or sample filename in Parts 1–4 or Quick Reference -> rejected as spec mismatch.
- Examples:
  - Given `docs/walkthrough-csharp.md`, when Parts 1–4 are inspected, then `CalcRepl.Core`, `CalcRepl.Cli`, `CalcRepl.UnitTests`, and `CalcRepl.AcceptanceTests` appear and `todo-cli` / `TodoCli` appear nowhere outside the practice-ideas list.
  - Given `docs/walkthrough-node.md`, when Parts 1–4 and Quick Reference are searched for `env-check` or `.env.example`, then zero matches exist (failure if any match appears).

### R25 - Step 1 brain-storm prompt specifies v1 `calc-repl` behavior
- Rules:
  - In all three walkthroughs, Part 3 Step 1 provides a `/brain-storm` starter prompt for `calc-repl` using one shared behavioral specification that differs only by stack label (`Node.js`, `Node.js TypeScript`, `C# .NET`) and includes every v1 behavior:
    - an interactive integer calculator REPL called `calc-repl` with zero external runtime dependencies
    - binary `+`, `-`, `*`, and `/` with standard operator precedence (`*` and `/` before `+` and `-`)
    - truncating integer division toward zero (e.g., `7 / 2 = 3`)
    - divide-by-zero and invalid expressions report a clear error and re-prompt without crashing the loop
    - clean exit on `exit`, `quit`, or EOF
  - Part 3 Step 2 in every walkthrough invokes `/behavior-spec calc-repl`.
- Failure:
  - any walkthrough's Step 1 prompt omits any required v1 behavior (interactive REPL loop, `+`/`-`/`*`/`/` precedence, truncating integer division, divide-by-zero recovery, invalid-expression recovery, or clean exit on `exit`/`quit`/EOF) -> rejected as incomplete prompt.
- Examples:
  - Given all three walkthroughs, when their Part 3 Step 1 `/brain-storm` prompts are inspected, then each names `calc-repl`, includes all required v1 behaviors, and differs only in the stack phrase (`Node.js` / `Node.js TypeScript` / `C# .NET`).
  - Given a Step 1 prompt that omits EOF or truncating integer division, when checked against R25, then it fails acceptance (failure).

### R26 - Interactive REPL acceptance guidance and Step 4 PowerShell verification
- Rules:
  - Part 3 Step 3 in each walkthrough explains how automated black-box acceptance runs drive an interactive REPL without importing internal modules: piping multi-line input over `stdin` or spawning the process with redirected `stdin`/`stdout`/`stderr` to exchange lines and assert on output and exit code.
  - Part 3 Step 3's setup-card and Phase Review descriptions reflect the stack's REPL process-runner helper (spawning `node bin/calc-repl.js` in Node.js, `node dist/cli.js` in TypeScript, and the built `CalcRepl.Cli` executable in C#).
  - Part 3 Step 4 in each walkthrough provides copy-pasteable PowerShell verification that runs `calc-repl` with piped multi-line input (requiring no scratch files) and exercises all five v1 cases in one session:
    1. Operator precedence: `2 + 3 * 4` (expected `14`)
    2. Truncating integer division: `7 / 2` (expected `3`)
    3. Divide-by-zero recovery: `10 / 0` (reports an error and continues the REPL loop)
    4. Invalid expression recovery: `2 + * 3` (reports an error and continues the REPL loop)
    5. Clean exit: `exit` (exits cleanly with code `0`, verified via `$LASTEXITCODE`)
  - Step 4 notes that running the command without piped input starts an interactive session, and includes the stack's full local verification suite (`npm run lint`, `npm run format:check`, `npx vitest run`, `npm run test:unit` for Node.js; plus `npm run typecheck` and `npm run build` for TypeScript; `dotnet build -c Release`, `dotnet format --verify-no-changes`, `dotnet test -c Release` for C#).
- Failure:
  - any walkthrough omits Part 3 interactive-REPL black-box guidance (piped `stdin` or spawned process I/O) or omits any of the five Step 4 verification cases -> rejected as incomplete verification.
- Examples:
  - Given `docs/walkthrough-typescript.md` Part 3 Step 4, when the PowerShell block is inspected, then it runs `npm run build`, pipes a multi-line here-string containing `2 + 3 * 4`, `7 / 2`, `10 / 0`, `2 + * 3`, and `exit` into `node dist\cli.js`, checks `$LASTEXITCODE`, and runs the TypeScript verification suite.
  - Given a Step 4 PowerShell block that covers `2 + 3 * 4`, `7 / 2`, and `exit` but omits `10 / 0` or `2 + * 3`, when checked against R26, then it fails acceptance (failure).

### R27 - Part 4 Day-2 bug report and combined evolution pass
- Rules:
  - Part 4 in all three walkthroughs includes:
    1. A `calc-repl` Day-2 bug-report example using `/pull-work calc-repl bug: <description>` for a concrete v1 defect that uses only v1 operators (for example: `/pull-work calc-repl bug: chained subtraction like 10 - 3 - 2 returns 9 instead of 5`).
    2. One combined Day-2 evolution pass showing the three-step sequence (new chat `/brain-storm ...` -> new chat `/behavior-spec calc-repl` -> new chat `/pull-work`) whose `/brain-storm` prompt adds all three features together:
       - unary negative numbers (e.g., `-5 + 2 = -3`)
       - parentheses for grouping (e.g., `(2 + 3) * 4 = 20`)
       - integer exponents using `^` (e.g., `2 ^ 3 = 8`), reporting negative exponents (e.g., `2 ^ -3`) as an unsupported error and re-prompting without crashing
    3. A note stating that these three features can alternatively be split into separate smaller brain-storm -> behavior-spec -> `/pull-work` passes.
- Failure:
  - any walkthrough's Part 4 omits the `calc-repl` bug-report example, uses Day-2 syntax in the v1 bug example, omits any of the three evolution features (unary negatives, parentheses, `^` exponents with negative-exponent error), uses an exponent operator other than `^`, or omits the split-pass note -> rejected as incomplete Day-2 guidance.
- Examples:
  - Given `docs/walkthrough-node.md` Part 4, when inspected, then it contains `/pull-work calc-repl bug: ...` for a v1 defect, one combined `/brain-storm` -> `/behavior-spec calc-repl` -> `/pull-work` pass adding unary negative numbers, parentheses, and `^` exponents (with negative exponents reporting an unsupported error without crashing), and a note on splitting passes.
  - Given a Part 4 evolution prompt that uses `**` instead of `^` or omits the negative-exponent error behavior, when checked against R27, then it fails acceptance (failure).

### R28 - Preserve stack conventions and current Workflow Core accuracy
- Rules:
  - Each walkthrough preserves the existing five-part structure: practice-ideas list, Part 1 (PowerShell setup), Part 2 (Language Add-on configuration), Part 3 (end-to-end build Steps 1–4), Part 4 (Day-2 usage), and Quick Reference table.
  - Each walkthrough preserves its stack's conventions:
    - zero external runtime dependencies for `calc-repl` across all three guides
    - PowerShell setup and verification commands throughout
    - Node.js JavaScript: ESM (`type="module"`), Node LTS `22.12+` or `24`, `eslint-javascript`, `vitest-javascript`, `stryker-javascript`
    - Node.js TypeScript: ESM, `dist/cli.js` build target, `typescript` `~6.0.3`, `eslint-typescript`, `vitest-typescript`, `stryker-typescript`
    - C# / .NET: `CalcRepl.Core` / `CalcRepl.Cli` / `CalcRepl.UnitTests` / `CalcRepl.AcceptanceTests` separation, local `dotnet-stryker` tool manifest run from `tests\CalcRepl.UnitTests`, `dotnet-editorconfig`, `stryker-dotnet`
  - Part 1.3 copies the Workflow Core (`.github/agents`, `.github/hooks`, `.github/skills`, `.github/tools/workflow-check`, `.github/user-interaction.md`) plus the stack's Language Add-ons and shared `mutation-testing` protocol, and does not copy `AGENTS.md` (which belongs only to `Personal.Workflow` per `.workflow/language.md`).
  - All Workflow Core commands, commit handoffs, and Checkpoints match the current Workflow Core (`/brain-storm`, `/behavior-spec <slug>`, `/pull-work`, `/pull-work <slug> bug: <description>`, `/conventional-commit`, `workflow-check.mjs`, bundled `approve all` Checkpoints, and Phase Gate checks).
- Failure:
  - any walkthrough drops a section of the five-part structure, adds an external runtime dependency for `calc-repl`, copies `AGENTS.md` into the target repo, breaks C# Core/CLI separation, or cites an outdated or non-existent Workflow Core command -> rejected as convention violation.
- Examples:
  - Given Part 1.3 in all three walkthroughs, when inspected, then `.github/user-interaction.md` is copied and `AGENTS.md` is not copied.
  - Given `docs/walkthrough-csharp.md`, when Part 1.2 and Part 2.2 are inspected, then `CalcRepl.Core` is a class library mutated via `dotnet stryker` from `tests\CalcRepl.UnitTests`, and `CalcRepl.Cli` is a thin console host referencing `CalcRepl.Core`.

## Quality Thresholds
- Cross-stack consistency -> all three walkthroughs specify the same `calc-repl` v1 behavior set (R25), all five Step 4 verification expressions (R26), and the same Day-2 bug + combined evolution feature set with `^` exponent notation (R27), differing only in stack-specific tooling, paths, and commands.
- Zero stale featured-app leaks -> 0 occurrences of prior featured app names (`env-check`, `csv-stats`, `todo-cli`, `TodoCli`) or their sample filenames (`.env.example`, `sample.csv`, `todo-demo.json`) in Parts 1–4 and Quick Reference across all three files.
- PowerShell copy-pasteability -> every PowerShell code block in Parts 1–4 uses valid Windows PowerShell syntax with backslash paths (`\`) and requires no manual edits except template placeholders explicitly shown in angle brackets (such as `<phase-start-ref>`).

## External Constraints
- Existing five-part walkthrough structure (ideas list, Parts 1–4, Quick Reference) - owner: `docs/`.
- `calc-repl` stays zero external runtime dependencies in all three walkthroughs - session constraint.
- Target repositories copy the Workflow Core without `AGENTS.md` - `.workflow/language.md` and `workflow-core-spec.md`.
- Scope is limited to `docs/walkthrough-node.md`, `docs/walkthrough-typescript.md`, and `docs/walkthrough-csharp.md`; building a `calc-repl` app in this repository, changing `.github/`, or adding other language walkthroughs is out of scope - session scope.

## Left To Planning
- Exact prose wording of explanatory paragraphs outside the pinned prompts, commands, and structural sections.
- How automated acceptance tests inspect the markdown walkthrough files (section parsing, marker checks, PowerShell snippet checks).
- How the three walkthrough updates are sliced and sequenced into phases and cards.

## Assumptions
- R25: Step 1 `/brain-storm` prompts use one shared behavioral wording across all three walkthroughs, differing only in stack label (`Node.js`, `Node.js TypeScript`, `C# .NET`) - matches the parallel phrasing of the existing guides and maximizes cross-stack comparability.
- R26: Step 4 PowerShell verification pipes a concrete five-line here-string (`2 + 3 * 4`, `7 / 2`, `10 / 0`, `2 + * 3`, `exit`) into `calc-repl` and checks `$LASTEXITCODE` - exercises all five required v1 cases non-interactively with no scratch files left behind.
- R27: Part 4's Day-2 bug-report example uses a v1-only defect (`chained subtraction like 10 - 3 - 2 returns 9 instead of 5`) - keeps the bug example valid against v1 before Day-2 features (unary negatives, parentheses, exponents) exist.
