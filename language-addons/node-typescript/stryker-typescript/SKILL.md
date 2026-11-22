---
name: stryker-typescript
description: "Configure, run, and read StrykerJS mutation testing for Node.js TypeScript with the Vitest runner and the TypeScript checker (unit tests only). Use when: setting up stryker.config.json, choosing thresholds, running the phase mutation gate, reading a mutation score, survivors, or type-rejected mutants, or diagnosing an incomplete Stryker run."
argument-hint: "Say 'baseline' for typical thresholds, or 'walkthrough' to set them with guidance"
user-invocable: true
disable-model-invocation: false
---

# StrykerJS Adapter for TypeScript

This is the TypeScript adapter for [`mutation-testing/protocol.md`](../mutation-testing/protocol.md).

**Read the protocol first.** It owns the rules: when to run, which tests, blocking policy, what counts as a complete run, how to read the score, and how to handle survivors. This file only adds what is specific to StrykerJS with Vitest and the TypeScript checker.

This adapter owns three things in the target repository:

1. `stryker.config.json` at the repository root.
2. The phase Gate's `mutation` line, which runs [`scripts/mutation-gate.mjs`](scripts/mutation-gate.mjs).
3. The `reports/` and `.stryker-tmp/` entries in `.gitignore`.

- **Mutation stack:** typescript, node-typescript
- **Mutation command:** node .github/skills/stryker-typescript/scripts/mutation-gate.mjs --since <phase-base>

## 1. Before You Start

- `vitest-typescript` is set up. `vitest.unit.config.ts` exists and `npm run test:unit` passes. If there are no unit tests, stop. Follow the protocol's "Mature code, no tests" path.
- `npm run typecheck` passes. The checker cannot judge mutants in a project that already has type errors.
- TypeScript is on the 6.0 line (`"typescript": "~6.0.3"`). TypeScript 7 no longer ships the compiler API that the checker loads. Do not upgrade until `@stryker-mutator/typescript-checker` states TypeScript 7 support.
- Node.js 22 or later (StrykerJS engines).
- Install: `npm install --save-dev @stryker-mutator/core @stryker-mutator/vitest-runner @stryker-mutator/typescript-checker`.
- Add `reports/` and `.stryker-tmp/` to `.gitignore`.

## 2. Unit Tests Only (Most Important Rule)

**Point `vitest.configFile` at `vitest.unit.config.ts`.** If Stryker loads the default `vitest.config.ts`, acceptance tests run against the mutants too, and the score looks better than the unit tests deserve. Acceptance tests that spawn `dist/` never see Stryker's mutants anyway (Stryker mutates `src/`), but a library acceptance test that imports through the package name can.

Do not scope with `vitest.dir`. Combined with the default `related: true`, it finds no tests and Stryker stops with `No tests were executed`.

How to tell which tests ran:

| Evidence | Where | OK? |
| --- | --- | --- |
| Every key of `testFiles` is under `tests/unit/` | JSON report (the gate script checks this) | Yes |
| `Initial test run succeeded. Ran N tests` with N equal to the test count of `npm run test:unit` | Saved log | Yes |
| Any `testFiles` key under `tests/acceptance/` | JSON report | **No. Blocking.** |

## 3. Configure `stryker.config.json`

| Setting | Value | Why |
| --- | --- | --- |
| `testRunner` | `vitest` | Uses `@stryker-mutator/vitest-runner`. Coverage analysis is always `perTest`, the fastest mode. |
| `vitest.configFile` | `vitest.unit.config.ts` | Section 2. |
| `checkers` | `["typescript"]` | Type-checks every mutant first. A mutant the compiler rejects is never run, which saves time and keeps impossible changes out of the score (section 7). |
| `tsconfigFile` | `tsconfig.json` | The no-emit config that covers `src` and `tests`, so a mutant that breaks a test's types is rejected too. |
| `typescriptChecker.prioritizePerformanceOverAccuracy` | **Leave it out** (default `true`) | Faster. A few type-invalid mutants may then run instead of being rejected; they are killed or survive like any other. |
| `mutate` | `["src/**/*.ts", "!src/**/*.d.ts"]`, plus `!` patterns for exclusions | Patterns are relative to the repository root. |
| `reporters` | `["progress", "clear-text", "html", "json"]` | The JSON report is what the gate script reads. The HTML report shows each survivor. |
| `thresholds` | See section 5 | First run: `"break": null` (measure-only). |
| `disableTypeChecks` | **Leave it out** | Stryker adds `// @ts-nocheck` to instrumented copies so the runner does not trip over its own instrumentation. Your source files are not changed. |
| `ignoreStatic`, `mutator.excludedMutations` | **Leave them out** | Only with an explicit, recorded user decision (protocol non-negotiable 4). |

Choose what to mutate: modules with real logic. Thin entry points (`src/cli.ts`, `src/server.ts`, `src/main.ts` that only wire modules together) are covered by acceptance tests, not unit tests. Their mutants always show `NoCoverage`. Exclude them with `!` patterns, keep logic out of them, and record each exclusion and its reason in the repository's development docs. Type-only files (interfaces, type aliases) produce no mutants and need no exclusion.

Example (measure-only first run):

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "vitest",
  "vitest": { "configFile": "vitest.unit.config.ts" },
  "checkers": ["typescript"],
  "tsconfigFile": "tsconfig.json",
  "mutate": ["src/**/*.ts", "!src/**/*.d.ts", "!src/cli.ts"],
  "reporters": ["progress", "clear-text", "html", "json"],
  "thresholds": { "high": 80, "low": 60, "break": null }
}
```

## 4. Scope Each Run to the Phase

- **Per phase:** `node .github/skills/stryker-typescript/scripts/mutation-gate.mjs --since <phase-start-ref>`. The script lists the files changed since that Git reference (plus untracked files) and keeps only those that match `mutate` and are not excluded by a `!` pattern. If none remain, it prints `mutation: skipped` and exits 0.
- **Explicit files:** `--mutate src/a.ts src/b.ts`. The config's `!` exclusions still apply.
- **One-time baseline** (protocol opt-in path only): run the script with no scope option. It mutates the whole `mutate` scope. Warn the user first that it can take much longer.

Do not call `npx stryker run --mutate` directly for the gate. Without the script, a `--mutate` list on the command line replaces the config's `mutate`, including its `!` exclusions.

## 5. Thresholds

Ask the user **one question at a time**. Offer a default they can accept with one word.

1. Did a full baseline already run? What score? (Use it as the anchor for `low` and `break`.)
2. How critical is the code? (Business rules → higher bar. Generic utility → lower bar.)
3. Is this the first measured phase (measure-only), or has the survivor backlog been cleared (blocking allowed)?

Then propose values and **confirm before writing the file**. Do not pick silently.

| Situation | `high` | `low` | `break` |
| --- | --- | --- | --- |
| First measured phase | 80 | 60 | `null` (measure-only) |
| Backlog cleared (protocol Blocking Policy: score at or above `low`, every unkilled mutant recorded as equivalent or deferred) | 80 | 60 | The score reached after the backlog, rounded down to a multiple of 5, never above `low` |
| Later phases | 80 | 60 | Raise `break` step by step (for example +5 per phase) until it equals `low` |

Stryker bands: `high` and above is high, `low` to below `high` is medium, below `low` is low. The thresholds cannot be overridden from the command line; `stryker.config.json` is the only source.

## 6. Run and Check Completeness

Run the gate script from the repository root. Do not report a score the script did not print as `complete`.

```text
node .github/skills/stryker-typescript/scripts/mutation-gate.mjs --since <phase-start-ref> [--unit tests/unit] [--config stryker.config.json]
```

The script deletes the old JSON report, runs Stryker, saves the full log to `reports/mutation/stryker.log`, and applies the protocol's Run Completeness rules to `reports/mutation/mutation.json`:

| Check | Result |
| --- | --- |
| No report written (crash, failed initial test run, `No tests were executed`) | **Blocking.** It prints the first `ERROR` line of the log. |
| A requested file matched nothing (`Glob pattern "<file>" did not result in any files`) | **Blocking.** Wrong path, or the file is outside `mutate`. |
| A test file outside `--unit` ran against the mutants | **Blocking.** Section 2. |
| No test files, no file with mutants, or zero Killed, Survived, NoCoverage, or Timeout mutants | **Blocking.** Nothing was measured. |
| Any `RuntimeError` or `Pending` | **Blocking.** The run did not finish. |
| `CompileError` that is **not** a TypeScript diagnostic, above 10% of attempted mutants | **Blocking.** |
| `Timeout` above 10% of attempted mutants | **Blocking.** Look for slow or hanging unit tests. |
| `TypeRejected`: a `CompileError` whose reason is a TypeScript diagnostic (`error TSxxxx:`) | **Report only, at any rate.** Section 7. Left out of the score and of the 10% check. |
| A requested file produced no mutants | **Report only.** A type-only file, or only constants and re-exports. |
| A few other `CompileError` or `Timeout` (10% or less), `Ignored`, static mutants | **Report only.** |

"Attempted" is all mutants minus `Ignored` and minus `TypeRejected`.

Exit codes: `0` complete and at or above `break` (or `skipped`), `1` incomplete or Stryker failed, `2` complete but below `break`. Stryker's own exit code cannot tell those apart, which is why the gate uses the script.

## 7. Type-Rejected Mutants (Report Only, Do Not Fix)

The TypeScript checker compiles each mutant before any test runs. If the compiler rejects it, Stryker marks it `CompileError` with the diagnostic as `statusReason`. The gate script reports these as `TypeRejected`. The type system already makes that change impossible, so it is not untested code (protocol: Run Completeness, adapter-named compile-error kinds).

Typical causes, all normal for well-typed code (each seen in a real run):

| `mutatorName` | Example | Diagnostic |
| --- | --- | --- |
| `StringLiteral` | `return "A"` → `return ""` where the return type is `"A" \| "B"` | TS2322: Type `""` is not assignable |
| `StringLiteral` | `case "A":` → `case "":` in a `switch` on a union | TS2678: Type `""` is not comparable |
| `BlockStatement` | Empties the body of a function that returns a value | TS2355: must return a value |
| `ConditionalExpression` | A `switch` case becomes `default:`, so the function can end without returning | TS2366: lacks ending return statement |

Rules:

- A high `TypeRejected` count is a sign of precise types, not a problem. Never loosen a type (`string` instead of a union, optional instead of required) to turn rejected mutants into runnable ones.
- A `CompileError` **without** a `TSxxxx` diagnostic is a Stryker instrumentation failure. It counts toward the 10% check. Report the file, the mutator, and the reason text.
- If every mutant of a function is `TypeRejected`, the function's behavior is fully pinned by its types, so the remaining risk is in callers. That is fine.

## 8. Other Problems That Stop a Run

| Signal in the log | Meaning | Action |
| --- | --- | --- |
| `There were failed tests in the initial test run` | A unit test fails without any mutant | Fix the failing unit test first. Report the test name, not a score. |
| Checker error at startup, or every mutant `CompileError` | `tsconfig.json` does not type-check, or TypeScript is on 7.x | Run `npm run typecheck`; check the TypeScript version (section 1). |
| `Vitest failed to find test files related to mutated files` | Tests reach the code through a path alias, barrel file, or child process, so `related` finds nothing | Import the module directly in unit tests. Only if that is impossible, set `vitest.related: false` and record why. |
| `No tests were executed` | Config scoping found no tests | Check `vitest.configFile` and section 2. Do not use `vitest.dir`. |
| Long pause after `Creating N checker process(es)`, or out of memory | Each checker process holds a full TypeScript program in memory | Set `concurrency` (for example half the cores) and record it in the config. |

## 9. What to Report After Every Run

The gate script prints these in order. Pass them on unchanged:

1. **Completeness:** `complete` or `INCOMPLETE`, with each blocking cause. For an incomplete run, add the affected file and the proposed fix (protocol: When the run is incomplete).
2. **Score:** total score, band, and score on covered code.
3. **Per-file table:** score, killed, survived, no coverage, timeout, compile errors, type-rejected.
4. **Report-only notes:** type-rejected and other compile errors grouped by mutator, timeouts, ignored, static mutants, files with no mutants.
5. **Unkilled mutants:** survived + no coverage, and the HTML report path.
6. **Next step:** on a measure-only run, hand the survivors to `work-planner` as backlog. On a blocking run below `break` (exit 2), the verification failed; follow the protocol's survivor rules.

## 10. Exit Conditions

Done when all of these are true:

- `stryker.config.json` exists at the root, with the checker, scope, exclusions, and threshold decisions recorded.
- `vitest.configFile` points at the unit-only config, and TypeScript is pinned to a version the checker supports.
- The phase Gate's `mutation` line runs the gate script with `--since <phase-start-ref>`.
- The gate script ran and printed `complete`, and the result was reported (section 9).
- Any incomplete run was shown to the user with named causes and proposed fixes, then resolved and rerun.
- Survivors were routed per the protocol (fixed in the slice, or handed to `work-planner`).
- On the first run in a repository, the exit brief states which repository maturity path was taken.
