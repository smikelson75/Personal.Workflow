---
name: stryker-dotnet
description: "Configure, run, and read Stryker.NET mutation testing for C#/.NET (unit tests only). Use when: setting up stryker-config.json, choosing thresholds, reading a mutation score or survivors, or diagnosing compile-error mutants, Safe Mode, or an incomplete Stryker run."
argument-hint: "Say 'baseline' for typical thresholds, or 'walkthrough' to set them with guidance"
user-invocable: true
disable-model-invocation: false
---

# Stryker.NET Adapter

This is the C#/.NET adapter for [`mutation-testing/protocol.md`](../mutation-testing/protocol.md).

**Read the protocol first.** It owns the rules: when to run, which tests, blocking policy, what counts as a complete run, how to read the score, and how to handle survivors. This file only adds what is specific to Stryker.NET.

This adapter owns two things in the target repository:

1. `stryker-config.json` at the repository root.
2. The mutation step inside each phase's final integration slice verification command.

## 1. Before You Start

- The `dotnet-stryker` tool is installed. Prefer a local tool manifest (`.config/dotnet-tools.json`) so the version is pinned. Restore it with `dotnet tool restore`.
- At least one unit-test project references the code to mutate. If none exists, stop. Follow the protocol's "Mature code, no tests" path.

## 2. Where to Run Stryker (Most Important Rule)

**Run `dotnet stryker` from the unit-test project folder** (the folder that holds `MyApp.UnitTests.csproj`). Pass the root config with `--config-file <repo-root>/stryker-config.json` and pick a fixed report folder with `--output <folder>`.

**Never run it from the folder that holds the solution (`.sln` or `.slnx`).** There, Stryker runs in "solution mode": it uses **every** test project in the solution, including integration and E2E tests, and silently ignores `test-projects`. The score then looks better than the unit tests deserve.

How to tell which mode ran (console log):

| Log line | Mode | OK? |
| --- | --- | --- |
| `Analyzing 1 test project(s).` and `Building test project ...UnitTests.csproj` | Project mode | Yes |
| `Identifying projects to mutate in MyApp.slnx` and `Building solution` | Solution mode | **No. Blocking.** |

Also compare `Number of tests found: N` with the unit-test count from `dotnet test <unit-test project> --list-tests`. They should match.

Stryker mutates **one project under test per run**. If several production projects need mutation, run once per unit-test project.

## 3. Configure `stryker-config.json`

| Setting | Value | Why |
| --- | --- | --- |
| `project` | File **name** of the project under test, for example `MyApp.csproj` (not a path) | Required when the unit-test project references more than one project. Explicit is clearer anyway. |
| `test-projects` | **Leave it out** | Stryker only honors it when run from the project under test. Section 2 runs from the unit-test folder instead. |
| `mutate` | `**/*.cs`, plus `!` patterns for exclusions | Patterns are relative to the project under test, not the repository root. |
| `reporters` | `progress`, `html`, `json` (`markdown` optional) | The JSON report is what the completeness check reads. The HTML report shows each survivor. |
| `thresholds` | See section 5 | First run: `break: 0` (measure-only). |
| `ignore-mutations` | **Leave it out** | See section 7. It does not remove compile errors and it hides real signal. |

Choose which production projects to mutate: projects with real logic (for example `Domain`, `Application`). Thin wiring projects (`Api`, `Console`, `Storage.*`) add cost and little signal; skip them by default. Record skipped projects and the reason next to the mutation command in the repository's development docs.

Example (measure-only first run):

```json
{
  "stryker-config": {
    "project": "MyApp.csproj",
    "mutate": ["**/*.cs"],
    "reporters": ["progress", "html", "json"],
    "thresholds": { "break": 0 }
  }
}
```

## 4. Scope Each Run to the Phase

- **Per phase:** mutate only production files changed since the phase-start Git reference. Use `--since:<phase-start-ref>`, or pass one `--mutate <path-relative-to-project>` per changed file.
- **One-time baseline** (protocol opt-in path only): run without `--since` over the whole `mutate` scope. Warn the user first that it can take much longer.

## 5. Thresholds

Ask the user **one question at a time**. Offer a default they can accept with one word.

1. Did a full baseline already run? What score? (Use it as the anchor for `low` and `break`.)
2. How critical is the code? (Business rules → higher bar. Generic utility → lower bar.)
3. Is this the first measured phase (measure-only), or has the survivor backlog been cleared (blocking allowed)?

Then propose values and **confirm before writing the file**. Do not pick silently.

| Situation | `high` | `low` | `break` |
| --- | --- | --- | --- |
| First measured phase | 80 | 60 | `0` (measure-only) |
| Backlog cleared (protocol Blocking Policy: score at or above `low`, every unkilled mutant recorded as equivalent or deferred) | 80 | 60 | The score reached after the backlog, rounded down to a multiple of 5, never above `low` |
| Later phases | 80 | 60 | Raise `break` step by step (for example +5 per phase) until it equals `low` |

Stryker scores: `high` and above is green, `low` to below `high` is yellow, below `low` is red. If the score falls below `break`, the command fails.

## 6. Run and Check Completeness

Do these steps every time. Do not report a score until step 4 passes.

1. Build the solution in the configuration Stryker will use. A build failure means no measurement. Report the build error.
2. Go to the unit-test project folder (section 2). Run Stryker there and **save its console output to a log file**. Example (PowerShell, from the repository root):

   ```powershell
   Push-Location tests/MyApp.UnitTests
   dotnet stryker --config-file ../../stryker-config.json --configuration Release --output ../../StrykerOutput/run1 2>&1 | Tee-Object ../../StrykerOutput/run1-console.log
   Pop-Location
   ```

3. Open the JSON report: `<output folder>/reports/mutation-report.json`. In `files`, each key is a full source path and each entry has `mutants`. Each mutant has `status` and `mutatorName`.
4. Check every row of this table. Any "Blocking" row means the run is **incomplete** (protocol: Run Completeness).

| Check | Where to look | Result |
| --- | --- | --- |
| `Identifying projects to mutate in <name>.sln` or `.slnx` | Console log | **Blocking.** Solution mode: integration and E2E tests killed mutants. Rerun from the unit-test folder (section 2). |
| `Safe Mode! Stryker will remove all mutations in <Method>` | Console log | **Blocking.** See section 8. |
| `Number of tests found: 0` for a project in scope | Console log | **Blocking.** Test discovery failed. |
| No files or far fewer files than the phase diff | Console log and report `files` | **Blocking.** Fix `mutate` and the project/solution settings. |
| `CompileError` count > 10% of (all mutants − `Ignored`) | JSON report | **Blocking.** Look for a code shape Stryker cannot handle. |
| `Timeout` count > 10% of (all mutants − `Ignored`) | JSON report | **Blocking.** Look for slow or hanging tests. |
| Any `RuntimeError` or `Pending` | JSON report | **Blocking.** The run did not finish. |
| Zero mutants with status Killed, Survived, NoCoverage, or Timeout | JSON report | **Blocking.** Nothing was measured. |
| A few `CompileError` (≤ 10%) | JSON report | **Report only.** Usually known-invalid mutators (section 7). |
| A few `Timeout` (≤ 10%) | JSON report | **Report only.** Counted as detected. |
| `Ignored` with reason "Removed by block already covered filter" | JSON report | **Report only.** Stryker's own filter, not your config. Not counted. |

5. Report the result using section 10.

Reference implementation in this repository: [`eng/Measure-Phase.ps1`](../../../eng/Measure-Phase.ps1) runs Stryker and saves the log; [`eng/Test-MutationReport.ps1`](../../../eng/Test-MutationReport.ps1) applies this table to the JSON report and prints the score. The script passes `--break-at 0` to Stryker so a non-zero Stryker exit always means the tool failed. The evaluator then enforces the configured `break` only on a complete run (exit code 2 = below threshold, exit code 1 = incomplete).

## 7. Known-Invalid Mutations (Report Only, Do Not Fix)

Stryker.NET creates some mutants that can never compile. Stryker marks them `CompileError` and leaves them out of the score. **This is normal. Do not change production code to avoid them.**

| `mutatorName` in the report | Example | Why it cannot compile |
| --- | --- | --- |
| `Block removal mutation` | Removes the body of a method that returns a value | CS0161: not all code paths return a value. |
| `Linq method mutation (Count() to Sum())` | `list.Count` (a property) becomes `list.Sum` | A collection has no `Sum` property. |
| `Linq method mutation (Any() to All())` | `items.Any()` with no predicate | `All` needs a predicate. |
| `Equality`, `Arithmetic`, `Negate expression`, or others, in the same expression as one of the above | `list.Count == 0`, where `Count` → `Sum` is invalid | Stryker rolls back every mutant inside the expression that failed to compile, so valid neighbours are marked `CompileError` too. |

About `ignore-mutations`:

- It does **not** turn compile errors into anything better. Invalid mutants still fail to compile.
- Ignoring a kind (for example `block`) hides **every** mutant of that kind, including the ones that compile and give real signal. They show up as `Ignored` ("Removed by mutation type filter").
- Stryker already skips most block mutants on its own. They show up as `Ignored` with "Removed by block already covered filter". Ignoring `block` yourself changes little and hides the rest.
- Only ignore a mutation kind with an explicit, recorded user decision (protocol non-negotiable 4).

## 8. Safe Mode Dropped a Whole Method

Log signal:

```text
[WRN] An unidentified mutation in <file> resulted in a compile error (at L:C) with id: CS0165 ...
[INF] Safe Mode! Stryker will remove all mutations in <Method> and mark them as 'compile error'.
```

**Meaning:** one mutant broke the build in a way Stryker could not isolate. Stryker then dropped **every** mutant in that method. The method adds nothing to the score but looks clean. This is always blocking.

**Usual cause:** CS0165, "use of unassigned local variable". A mutant removed a branch, `continue`, `return`, or condition that the compiler needed to prove a local variable was assigned. It is a code-shape problem, not a bug.

**Fix:** rewrite the method so every local variable is assigned before any branch that could skip the assignment. Before/after examples: [`tdd-csharp/docs/stack.md` → Mutation-Safe Code Shapes](../tdd-csharp/docs/stack.md#mutation-safe-code-shapes).

Report each dropped method as `<file>::<Method>` with the proposed rewrite. The method name in the log is the enclosing member, not always the exact line.

If `TreatWarningsAsErrors` is on, reject any rewrite that adds a nullable warning. The mutant build uses the same setting and will fail the same way.

## 9. Other Problems That Stop a Run

| Signal | Meaning | Action |
| --- | --- | --- |
| Build failure before mutation starts | The solution does not build in the chosen configuration. | Fix the build. Report the error, not a score. |
| `0x800711C7` or "An Application Control policy has blocked this file" | Windows Smart App Control or WDAC blocked `Stryker.CLI.dll`. | Check the `Microsoft-Windows-CodeIntegrity/Operational` event log (events 3033/3077). Retry once (often a temporary reputation delay for a new tool). If it still fails, ask the user about an allowlist. |
| "No projects found to mutate" or "Project reference issue" | Wrong `project` or `mutate` setting, or Stryker was not run from the unit-test folder. | Fix `stryker-config.json` and the run folder (section 2). |
| Non-zero exit code with `break: 0` | Stryker itself failed. | Read the log. Rerun with `--verbosity trace --log-to-file`. Quote the exact error, not the whole log. |

## 10. What to Report After Every Run

Report all of these, in this order:

1. **Completeness:** complete or incomplete. If incomplete, name each cause, the affected `<file>::<Method>`, and the proposed fix.
2. **Score:** total mutation score, score band (high / medium / low), and score on covered code.
3. **Per-file table:** score, killed, survived, no coverage, timeout, compile errors.
4. **Compile errors:** count and percent of attempted, grouped by `mutatorName`. Say they are excluded from the score.
5. **Unkilled mutants:** survived + no coverage, and the HTML report path for details.
6. **Next step:** on a measure-only run, hand the survivors to `work-planner` as backlog. On a blocking run below `break`, the verification failed; follow the protocol's survivor rules.

## 11. Exit Conditions

Done when all of these are true:

- `stryker-config.json` exists at the root, with scope and threshold decisions recorded.
- The verification command runs Stryker from the unit-test project folder (section 2).
- The verification command ran **to completion** (section 6 passed) and the result was reported (section 10).
- Any incomplete run was shown to the user with named causes and proposed fixes, and then resolved and rerun.
- Survivors were routed per the protocol (fixed in the slice, or handed to `work-planner`).
- On the first run in a repository, the exit brief states which repository maturity path was taken.
