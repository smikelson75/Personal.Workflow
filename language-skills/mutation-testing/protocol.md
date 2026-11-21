# Mutation Testing Protocol

These rules apply to every mutation-testing adapter, for any language. An adapter (for example `stryker-dotnet`) adds the tool, the config file, and the tool's log messages. This file holds the rules that stay the same for every stack.

## What Mutation Testing Measures

The tool makes many small changes to production code. Each change is a **mutant**. Example: change `a > b` to `a >= b`. The tool then runs the unit tests against each mutant.

| Status | Meaning | Counts in the score? |
| --- | --- | --- |
| Killed | A test failed. Good: the tests noticed the change. | Yes, as detected |
| Timeout | The tests ran too long. Usually an endless loop, so treated as detected. | Yes, as detected |
| Survived | All tests passed. The tests missed the change. | Yes, as not detected |
| No coverage | No test ran this code at all. | Yes, as not detected |
| Compile error | The changed code did not build. Nothing was tested. | No |
| Runtime error | The test run crashed. Nothing was tested. | No |
| Ignored | Removed by configuration or a tool filter. | No |

**Mutation score** = detected / (detected + survived + no coverage) × 100, where detected = killed + timeout.

Coverage proves a line ran. Mutation testing proves a test fails when that line's behavior changes. They are different signals.

## When It Runs (Cadence)

- Run it once per phase, in the phase's **final end-to-end validation slice**.
- Scope it to the phase's changes since phase start, not the whole repository.
- It does not get its own slice. Add it to that final slice's verification command, next to the integration and E2E tests.
- Do not run it in every slice. It reruns the tests for every mutant, which is too slow for the Red-Green-Refactor loop.
- Do not wait until release. Weak tests from several phases would pile up into one big cleanup.

## Which Tests Run (Test Scope)

- Use **unit tests only**, both as the code to measure and as the tests that kill mutants.
- Never use integration or E2E tests to kill mutants. They are slow, can have side effects (network, containers, quotas), and assert too coarsely to catch small changes.
- Check it in the run log, not only in the config file. Some tools quietly use every test project when started from the wrong folder (for Stryker.NET, the solution folder). The adapter says which log line proves the scope.
- If some logic can only be tested by an integration or E2E test, that is a design signal: move the logic into a unit-testable layer. Do not widen mutation scope.
- This rule is only about mutation testing. Slices that change boundaries (network, database, filesystem, queues, external services) still need normal integration tests.

## Blocking Policy

1. The first run on a newly enabled phase or repository is **measure-only**. Report the score and the surviving mutants. Do not fail the verification command because the score is low.
2. Give the survivor list to `work-planner` as backlog.
3. Turn on a blocking threshold (`break`) only after that backlog is cleared. The backlog is **cleared** when both are true:
   - The score is at or above the low band (60% by default).
   - Every remaining unkilled mutant is triaged and recorded: equivalent or unreachable (with the reason), or deferred (with the reason, kept as backlog for `work-planner`). Zero survivors is not required; see "Do not aim for 100%".

   Record the triage next to the threshold decision (for example in the remediation slice's outcome).
4. Once blocking is on, a complete run below `break` fails the verification. The run is still complete; it is not reported as incomplete. Fix it with better tests, never by lowering `break`.
5. Never raise the score by weakening or deleting a test, lowering a threshold, or quietly removing code from scope. Any scope change needs an explicit, recorded decision.
6. This protocol does not set threshold numbers. The adapter proposes them to the user and the user confirms.

## Reading the Score

A low score on a first measurement is normal. It is a to-do list, not a failure.

**Typical bands** (Stryker defaults; the adapter may propose others):

| Score | Band | What to do |
| --- | --- | --- |
| 80% or more | High | Healthy. Review the remaining survivors. |
| 60% to below 80% | Medium | Acceptable for a first measurement. Plan backlog work. |
| Below 60% | Low | Plan a remediation slice before turning on blocking. |

**Read per file, not only the total.**

| Pattern in a file | Likely cause | Fix |
| --- | --- | --- |
| Score 0% and every mutant is "no coverage" | No unit test runs this file. | Add unit tests, or move the logic to a testable class. |
| Many "survived" mutants | Tests run the code but assert too little. | Add assertions on exact values, messages, and edge cases. |
| Survivors only on boundaries (`<` vs `<=`) | Missing boundary test. | Test the exact boundary value. |
| A survivor that cannot change behavior | Equivalent mutant. | Leave it. Record why in the backlog. Do not contort code for it. |

Also compare the **score on covered code** (no-coverage mutants left out) with the total score. A big gap means missing tests, not weak tests.

Do not aim for 100%. Some mutants are equivalent: they change code without changing behavior.

## Run Completeness

The score only means something if the run covered the intended scope. Some problems make a run incomplete. Others are normal and are only reported.

**Blocking: the run is incomplete. Do not report the score as a result.**

| Signal | Why it blocks |
| --- | --- |
| The tool did not start, crashed, or the build failed. | Nothing was measured. |
| Tests other than unit tests ran against the mutants (for example, the tool used every test project in the solution). | The score includes kills by integration or E2E tests, so it overstates unit-test quality. |
| The tool dropped **all** mutants of a method, class, or file (for example Stryker Safe Mode). | A whole unit of code is silently missing from the score. |
| Compile-error mutants are more than **10%** of attempted mutants (total minus ignored, minus any adapter-named type-checker rejections). | Too much scope was not tested. |
| Timeout mutants are more than **10%** of attempted mutants. | Tests hang or are too slow; results are unreliable. |
| Any runtime-error mutant, or any mutant left untested (pending). | The run did not finish properly. |
| Zero tests discovered, zero files in scope, or zero testable mutants. | Nothing real was measured. |
| The scope is much smaller than the phase's changed files. | The run measured the wrong thing. |

**Report-only: the run is complete. List these, but do not block.**

| Signal | Why it does not block |
| --- | --- |
| A few compile-error mutants (10% or less), spread across files. | Some mutation kinds never compile for some code shapes. The tool leaves them out of the score. The adapter lists the known kinds. |
| A few timeouts (10% or less). | Counted as detected. |
| Ignored mutants from a recorded configuration decision. | Already excluded on purpose. |
| Compile-error mutants of a kind the adapter names as rejected by a type checker before any test runs (for example TypeScript diagnostics), at any rate. | The type system already makes that change impossible, so it is not untested code. They are left out of the score and of the 10% check. |

**Do not "fix" known-invalid mutants.** Do not change production code or ignore a whole mutation kind only to remove isolated compile errors. Ignoring a kind also hides the mutants of that kind that do compile, so you lose real signal.

**When the run is incomplete:**

1. Do not report its score as a result. State that it is incomplete, what was dropped, where, and why.
2. A passing test suite is not a replacement. The slice's verification has not passed.
3. Tell the user. Name the affected file and method, and give a concrete fix for each cause. Do not just say "mutation testing failed".
4. Propose the fix; do not apply it without the user. You may fix code inside the current slice's own files. Route anything wider to `work-planner` as a remediation slice after the user chooses.
5. Excluding the affected code is not a fix unless the user records that decision (non-negotiable 4).
6. Run the measurement again after the fix. The phase does not close on an incomplete run.

The adapter supplies the tool-specific signals (log messages, exit codes) and the matching fixes.

## Fixing Survivors After a Run

- **Survivors in the current slice's own files:** fix them in this slice, like any failed check. The slice stays `in progress` until fixed and rerun. No plan change is needed.
- **Survivors in earlier, completed slices, or too many to fix in this slice:** send them to `work-planner` as remediation slice(s). Do not quietly add an open-ended amount of work to a slice that is meant to close the phase.
- On a measure-only run, completing the phase with a low score is allowed **only** if the survivors are recorded as backlog.

## Repository Maturity Paths

The first run depends on two facts: how mature the code is, and whether tests already exist.

| Situation | What to do |
| --- | --- |
| No code yet | Wait for Phase 0 scaffolding. When Phase 0 adds the test harness, add root config as measure-only (`break: 0`). |
| New project with a test harness | Add root config as measure-only (`break: 0`) during onboarding. No baseline run is needed. |
| Mature code, no tests | Blocked. Ask `work-planner` for a prerequisite phase that writes a baseline test suite. |
| Mature code with tests | Offer a one-time, **opt-in** full-repository baseline run. Warn that it can be slow and expensive. It is non-blocking; send the score and survivor hotspots to `work-planner`. After that, use the per-phase cadence. |

## Non-Negotiables

1. Root-level configuration is the source of truth for scope, thresholds, and exclusions.
2. Default scope is unit tests only.
3. The first cycle on newly enabled work is measure-only. Blocking is a later, deliberate step.
4. Fix a low score by writing a better test or by an explicit, recorded scope decision. Never by silently weakening a test or lowering a threshold.
5. Config changes are their own commit. Never mix them with behavior changes.
6. Mutation testing does not get its own phase or slice. It runs inside the phase-final integration/E2E slice's verification command. Exceptions: prerequisite test-writing and survivor remediation backlogs.
7. The run must cover its intended scope. An incomplete run (see Run Completeness) goes to the user with named causes and proposed fixes. It is never reported as a pass and never replaced by a passing test suite.

## Boundaries for Every Adapter

- Does not replace the stack's TDD skill. Mutation testing measures tests; it does not say how to write them.
- Does not run in every slice by default.
- Does not pick threshold numbers alone. It proposes them through a guided walkthrough and the user confirms.
- Uses `adr-writer` only when an enforcement choice is hard to reverse and contested. Examples: blocking enforcement across a large legacy codebase, or permanently excluding a layer from mutation scope.
