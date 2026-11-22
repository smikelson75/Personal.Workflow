# Calc REPL Walkthroughs plan

- Spec: [calc-repl-walkthroughs-spec.md](../../specs/calc-repl-walkthroughs-spec.md)
- Lane: standard
- Next: P01 S01, S02
- Tests locked: `9a3ff11`
- Oracle: `tests/acceptance`
- Phase base: `9a3ff11`
- Reconciled: `20ce4a5a45239004533bd4e58785cc9f664302a5`

## Current state
- stack: Markdown walkthrough docs under `docs/`; acceptance tests in Node ES modules (`.mjs`, built-in `node:test`, zero dependencies) under `tests/acceptance/`, reusing `.github/tools/workflow-core/support/harness.mjs` read-only.
- harness: `node --test --test-reporter=tap "tests/acceptance/*.test.mjs"` - drives markdown files under `docs/`; runs
- suite baseline: green (174 existing tests across `workflow-check` and `workflow-core`; 0 walkthrough tests yet)
- mutation: unsupported for node - no mutation Language Add-on installed
- in place: three existing five-part walkthroughs (`docs/walkthrough-node.md` on `env-check`, `docs/walkthrough-typescript.md` on `csv-stats`, `docs/walkthrough-csharp.md` on `todo-cli`), each currently copying `AGENTS.md` in Part 1.3
- gap to spec: R24, R25, R26, R27, R28, Q-cross-stack-consistency, Q-zero-stale-featured-app-leaks, Q-powershell-copy-pasteability

## Decisions pinned by the plan
- acceptance tests live in `tests/acceptance/` at the repo root so `.github/` is untouched (spec External Constraint).
- all three walkthroughs share one exact Part 3 Step 1 `/brain-storm` starter prompt (differing only by stack label: `Node.js`, `Node.js TypeScript`, `C# .NET`), one five-line Step 4 PowerShell here-string (`2 + 3 * 4`, `7 / 2`, `10 / 0`, `2 + * 3`, `exit`), one Part 4 v1 bug report (`/pull-work calc-repl bug: chained subtraction like 10 - 3 - 2 returns 9 instead of 5`), and one Part 4 combined evolution prompt (unary negatives, parentheses, `^` integer exponents with negative-exponent error).

## Phases

| # | Phase | Status | Covers | Detail |
|---|-------|--------|--------|--------|
| P01 | Migrate all three walkthroughs to calc-repl | in progress | R24, R25, R26, R27, R28, Q-cross-stack-consistency, Q-zero-stale-featured-app-leaks, Q-powershell-copy-pasteability | [phase-01](phase-01.md) |

## P01 slices

| # | Slice | Status |
|---|-------|--------|
| S01 | Migrate docs/walkthrough-node.md to calc-repl | ready |
| S02 | Migrate docs/walkthrough-typescript.md to calc-repl | ready |
| S03 | Migrate docs/walkthrough-csharp.md to calc-repl and verify cross-stack consistency | ready |
