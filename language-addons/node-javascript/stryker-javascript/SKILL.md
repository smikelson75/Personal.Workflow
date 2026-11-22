---
name: stryker-javascript
description: "Configure, run, and read StrykerJS mutation testing for Node.js JavaScript with the Vitest runner (unit tests only). Use when: setting up stryker.config.json, choosing thresholds, running the phase mutation gate, reading a mutation score or survivors, or diagnosing an incomplete Stryker run."
argument-hint: "Say 'baseline' for typical thresholds, or 'walkthrough' to set them with guidance"
user-invocable: true
disable-model-invocation: false
---

# StrykerJS Adapter for JavaScript

This is the JavaScript adapter for [`mutation-testing/protocol.md`](../mutation-testing/protocol.md).

**Read the protocol first.** It owns the rules: when to run, which tests, blocking policy, what counts as a complete run, how to read the score, and how to handle survivors. This file only adds what is specific to StrykerJS with Vitest.

This adapter owns three things in the target repository:

1. `stryker.config.json` at the repository root.
2. The phase Gate's `mutation` line, which runs [`scripts/mutation-gate.mjs`](scripts/mutation-gate.mjs).
3. The `reports/` and `.stryker-tmp/` entries in `.gitignore`.

- **Mutation stack:** javascript, node-javascript, node
- **Mutation command:** node .github/skills/stryker-javascript/scripts/mutation-gate.mjs --since <phase-base>

## 1. Before You Start

- `vitest-javascript` is set up. `vitest.unit.config.js` exists and `npm run test:unit` passes. If there are no unit tests, stop. Follow the protocol's "Mature code, no tests" path.
- Node.js 22 or later (StrykerJS engines).
- Install: `npm install --save-dev @stryker-mutator/core @stryker-mutator/vitest-runner`.
- Add `reports/` and `.stryker-tmp/` to `.gitignore`.

## 2. Unit Tests Only (Most Important Rule)

**Point `vitest.configFile` at `vitest.unit.config.js`.** If Stryker loads the default `vitest.config.js`, acceptance tests run against the mutants too, and the score looks better than the unit tests deserve. Acceptance tests that spawn the CLI usually do not import the mutated file, so Vitest's `related` filter often hides this. It surfaces as soon as one acceptance test imports a module or `related` is turned off.

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
| `vitest.configFile` | `vitest.unit.config.js` | Section 2. |
| `mutate` | `["src/**/*.js"]`, plus `!` patterns for exclusions | Patterns are relative to the repository root. |
| `reporters` | `["progress", "clear-text", "html", "json"]` | The JSON report is what the gate script reads. The HTML report shows each survivor. The script drops the console reporters and keeps its own output short. |
| `thresholds` | See section 5 | First run: `"break": null` (measure-only). |
| `ignoreStatic` | **Leave it out** | Section 7. |
| `mutator.excludedMutations` | **Leave it out** | Section 7. Only with an explicit, recorded user decision (protocol non-negotiable 4). |

Choose what to mutate: modules with real logic. Thin entry points (`bin/*.js`, a `src/cli.js` or `src/server.js` that only wires modules together) are covered by acceptance tests, not unit tests. Their mutants always show `NoCoverage`. Exclude them with `!` patterns, keep logic out of them, and record each exclusion and its reason in the repository's development docs.

Example (measure-only first run):

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "vitest",
  "vitest": { "configFile": "vitest.unit.config.js" },
  "mutate": ["src/**/*.js", "!src/cli.js"],
  "reporters": ["progress", "clear-text", "html", "json"],
  "thresholds": { "high": 80, "low": 60, "break": null }
}
```

## 4. Scope Each Run to the Phase

- **Per phase:** `node .github/skills/stryker-javascript/scripts/mutation-gate.mjs --since <phase-start-ref>`. The script lists the files changed since that Git reference (plus untracked files) and keeps only those that match `mutate` and are not excluded by a `!` pattern. If none remain, it prints `mutation: skipped` and exits 0.
- **Explicit files:** `--mutate src/a.js src/b.js`. The config's `!` exclusions still apply.
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
node .github/skills/stryker-javascript/scripts/mutation-gate.mjs --since <phase-start-ref> [--unit tests/unit] [--config stryker.config.json]
```

The script deletes the old JSON report, runs Stryker, saves the full log to `reports/mutation/stryker.log`, and applies the protocol's Run Completeness rules to `reports/mutation/mutation.json`:

| Check | Result |
| --- | --- |
| No report written (crash, failed initial test run, `No tests were executed`) | **Blocking.** It prints the first `ERROR` line of the log. |
| A requested file matched nothing (`Glob pattern "<file>" did not result in any files`) | **Blocking.** Wrong path, or the file is outside `mutate`. |
| A test file outside `--unit` ran against the mutants | **Blocking.** Section 2. |
| No test files, no file with mutants, or zero Killed, Survived, NoCoverage, or Timeout mutants | **Blocking.** Nothing was measured. |
| Any `RuntimeError` or `Pending` | **Blocking.** The run did not finish. |
| `CompileError` above 10% of attempted mutants (all minus `Ignored`) | **Blocking.** |
| `Timeout` above 10% of attempted mutants | **Blocking.** Look for slow or hanging unit tests. |
| A requested file produced no mutants | **Report only.** Usually a file with only constants or re-exports. |
| A few `CompileError` or `Timeout` (10% or less), `Ignored`, static mutants | **Report only.** |

Exit codes: `0` complete and at or above `break` (or `skipped`), `1` incomplete or Stryker failed, `2` complete but below `break`. Stryker's own exit code cannot tell those apart, which is why the gate uses the script.

## 7. JavaScript-Specific Mutant Behavior

- **No compile step.** StrykerJS builds mutants from the syntax tree, so they parse. Without a type checker, `CompileError` should not appear at all. A `RuntimeError` cluster in one file means a code shape Stryker cannot instrument; report the file and the mutator.
- **Static mutants.** A mutant in code that runs once at import (module-level constants, top-level `await`, registries) is `static`. Stryker must reload every test for it, so it is slow. The script reports the count. Do not set `ignoreStatic: true` without a recorded user decision; it hides real signal. Moving setup into a function called at startup is the usual fix.
- **Equivalent mutants** are common around `console` output, default parameter values, and logging strings. Record them in the backlog with the reason; do not contort code to kill them.

## 8. Other Problems That Stop a Run

| Signal in the log | Meaning | Action |
| --- | --- | --- |
| `There were failed tests in the initial test run` | A unit test fails without any mutant | Fix the failing unit test first. Report the test name, not a score. |
| `Vitest failed to find test files related to mutated files` | Tests reach the code through a path alias, barrel file, or child process, so `related` finds nothing | Import the module directly in unit tests. Only if that is impossible, set `vitest.related: false` and record why. |
| `No tests were executed` | Config scoping found no tests | Check `vitest.configFile` and section 2. Do not use `vitest.dir`. |
| Machine runs out of memory, or many timeouts | One test runner process per CPU core by default | Set `concurrency` (for example half the cores) and record it in the config. |

## 9. What to Report After Every Run

The gate script prints these in order. Pass them on unchanged:

1. **Completeness:** `complete` or `INCOMPLETE`, with each blocking cause. For an incomplete run, add the affected file and the proposed fix (protocol: When the run is incomplete).
2. **Score:** total score, band, and score on covered code.
3. **Per-file table:** score, killed, survived, no coverage, timeout, compile errors.
4. **Report-only notes:** compile errors grouped by mutator, timeouts, ignored, static mutants, files with no mutants.
5. **Unkilled mutants:** survived + no coverage, and the HTML report path.
6. **Next step:** on a measure-only run, hand the survivors to `work-planner` as backlog. On a blocking run below `break` (exit 2), the verification failed; follow the protocol's survivor rules.

## 10. Exit Conditions

Done when all of these are true:

- `stryker.config.json` exists at the root, with scope, exclusions, and threshold decisions recorded.
- `vitest.configFile` points at the unit-only config.
- The phase Gate's `mutation` line runs the gate script with `--since <phase-start-ref>`.
- The gate script ran and printed `complete`, and the result was reported (section 9).
- Any incomplete run was shown to the user with named causes and proposed fixes, then resolved and rerun.
- Survivors were routed per the protocol (fixed in the slice, or handed to `work-planner`).
- On the first run in a repository, the exit brief states which repository maturity path was taken.
