# Calc REPL Walkthroughs plan

- Spec: [calc-repl-walkthroughs-spec.md](../../specs/calc-repl-walkthroughs-spec.md)
- Lane: standard
- Next: done
- Tests locked: `0567320`
- Oracle: `tests/acceptance`
- Phase base: `9a3ff11`
- Reconciled: `20ce4a5a45239004533bd4e58785cc9f664302a5`

## Current state
- stack: Markdown walkthrough docs under `docs/`; acceptance tests in Node ES modules (`.mjs`, built-in `node:test`, zero dependencies) under `tests/acceptance/`, reusing `.github/tools/workflow-core/support/harness.mjs` read-only.
- harness: `node --test --test-reporter=tap "tests/acceptance/*.test.mjs"` - drives markdown files under `docs/`; runs
- suite baseline: green (195 tests: 21 walkthrough acceptance tests + 174 existing tests across `workflow-check` and `workflow-core`)
- mutation: unsupported for node - no mutation Language Add-on installed
- in place: all three five-part walkthroughs (`docs/walkthrough-node.md`, `docs/walkthrough-typescript.md`, `docs/walkthrough-csharp.md`) migrated to `calc-repl` with consistent v1 + Day-2 prompts, PowerShell verification, preserved stack conventions, and current Workflow Core setup (no `AGENTS.md` copy), covered by `tests/acceptance/p01-s01.test.mjs`, `p01-s02.test.mjs`, and `p01-s03.test.mjs`
- gap to spec: none

## Decisions pinned by the plan
- acceptance tests live in `tests/acceptance/` at the repo root so `.github/` is untouched (spec External Constraint).
- all three walkthroughs share one exact Part 3 Step 1 `/brain-storm` starter prompt (differing only by stack label: `Node.js`, `Node.js TypeScript`, `C# .NET`), one five-line Step 4 PowerShell here-string (`2 + 3 * 4`, `7 / 2`, `10 / 0`, `2 + * 3`, `exit`), one Part 4 v1 bug report (`/pull-work calc-repl bug: chained subtraction like 10 - 3 - 2 returns 9 instead of 5`), and one Part 4 combined evolution prompt (unary negatives, parentheses, `^` integer exponents with negative-exponent error).

## Phases

| # | Phase | Status | Covers | Detail |
|---|-------|--------|--------|--------|
| P01 | Migrate all three walkthroughs to calc-repl | completed | R24, R25, R26, R27, R28, Q-cross-stack-consistency, Q-zero-stale-featured-app-leaks, Q-powershell-copy-pasteability | [phase-01](phase-01.md) |
