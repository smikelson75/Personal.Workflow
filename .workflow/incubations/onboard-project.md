# Incubation - Onboard Project Skill

Status: incubating
Started: 2026-11-23
Updated: 2026-11-24

## Spark
- An untracked `.github/skills/onboard-project/` skill from an earlier workflow generation was added to the repo. We want to understand whether to convert it into an onboarding coordinator for the current `Workflow Core` and `Language Add-ons`, reshape its scope, or scrap it and solve the underlying problems elsewhere.

## Current Mental Model
- The job is **adopting an existing repo onto the current `Workflow Core`** (older workflow versions and mature repos that never had one). Empty repos are a separate gap (see Open Threads).
- **Current leaning (tentative), the slim model:** adoption is mostly a checklist, not a walk.
  - Replace `.github/` by hand, copy the stack's `Language Add-ons`, and repair what breaks (`AGENTS.md`, `.opencode/`, `core.hooksPath`).
  - Legacy code and tests are ordinary existing code. Old tests stay unlocked. Old documents are evidence a later `/brain-storm` can read for the area being changed.
  - Specs grow **area by area** as new work touches them. There is no whole-repo walk, freeze, or baseline phase.
  - **Intentional behavior change** is the main worry: changing a behavior breaks settled code that nobody knew depended on it. One conditional line in `brain-storm` and `behavior-spec`: when a requirement changes existing behavior, run an impact query through one generic reader agent (cited evidence, not conclusions), list the dependents in the spec, and say what breaks.
  - **Accidental change** is caught by the full suite at the Gate where tests exist. Where the touched area has thin tests, a **pin-before-change** card adds characterization tests for that area only.
  - **Repairing a coupled old test** reuses the existing risk definition: `work-planner`'s `Review: required` criteria (security, destructive work, trust boundary, shared structure, public interface or persisted format). A test guarding a risky area brings the user in. Others are repaired and reported afterward. This needs some link from a test to what it guards, which is unverified.
  - **Lint and mutation:** mutation testing already covers only files a phase changes, so legacy debt does not block. Each `Language Add-on` still owns how its lint tool holds existing debt (see assumptions).
- **Why the heavy design was set aside (evidence):**
  - Past migration pain came from tooling breakage (adding lint and mutation to code that never had them: unplanned changes, failed installs, manual chat fixes), not missing specs. The user does not recall missing a whole-repo spec.
  - The cost of a whole-repo walk, characterization tests, and baseline phase scales with total behavior (Scheduler: 156 scenarios, 419 tests) and lands on the developer for a newly converted repo.
  - The user's hidden-dependency evidence is from manual work only. There is no AI-coding example, so heavy mitigation is unproven.
  - Principle recorded by the user: choices rest on a solid review of the facts around the scenario, not gut feel.
- **Set aside:** ralph.loop as a target (its product reads the old `.workflow/` format, so separating workflow from product is its own problem). Whole-repo walk, freeze, up-front characterization, specialized readers, and adopting-and-locking existing tests are parked until real evidence supports them.

```text
replace .github/ + Language Add-ons, repair breakage (checklist)
      │
      ▼
new work enters via /brain-storm for one area
      │
      ├─ requirement changes existing behavior?
      │     └─ yes: impact query (reader agent) ─▶ dependents listed in spec
      ▼
work-planner ─▶ [thin tests here?] pin-before-change card ─▶ normal cards
      │
      ▼
Gate: full suite catches regressions where tests exist
      │
old test now fails ─▶ risky area (Review: required criteria)?
                          ├─ yes: user decides
                          └─ no: repair, test-reviewer approves, tell user after
```

## What Fits vs. What Clashes

| Dimension | Draft `onboard-project` | Current take |
| --- | --- | --- |
| **Scope** | Coordinates everything from an empty repo, running product skills inline | Existing repos only, mostly a checklist. The name may change (for example `adopt-workflow`), to be decided in `/brain-storm`. |
| **Old artifacts** | Checks that files exist and are current | Left in place as evidence. Convert directly only mechanical items (glossary terms, ADRs) if wanted. |
| **Stack tooling** | Routes to old protocols | `Language Add-ons` own how lint holds existing debt |
| **Instruction files** | Normalizes `AGENTS.md` and others | Repair references broken by the `.github/` replacement |

| Old artifact (Scheduler) | Current equivalent | Note |
| --- | --- | --- |
| `.workflow/CONTEXT.md` | Session Chain | Lacks `R#` IDs and decision reasons |
| `.workflow/UBIQUITOUS-LANGUAGE.md` | `.workflow/language.md` | Mostly a straight conversion |
| `plans/` + `phase-NN/` slices | `plan.md` + `phase-NN.md` cards | Lacks Next, Oracle, lock lines, scenario IDs |
| `acceptance.feature` (156 scenarios) | Scenarios on cards | Strong evidence for area-level seeding |
| `docs/adr/` (4) | `.workflow/adr/` | Location and numbering differ |

## Tensions & Tradeoffs
- **Simplest 80/20 baseline (chosen after a challenge):** checklist plus one impact-query line plus pin-before-change. The heavier version (whole-repo walk, freeze, baseline phase, adopt-and-lock tests) buys a whole-repo spec, traceability for untouched code, and a single "everything specified" state. The user could not name anything they would miss without those.
- **Test coupling vs. cost:** repairing implementation-coupled old tests lazily (when a change breaks one) avoids an up-front audit. It depends on the risk rule above, and the existing Fixture Repair currently runs without the user, so that rule needs aligning with it.
- **Impact query limits:** it can only find dependents visible in code or documents. Dynamic, config-driven, or cross-process effects can slip through, so its output is evidence, not a guarantee.
- **"Baseline" means two things:** in the add-ons it means default rule sets or thresholds; for measured existing debt it needs another term. Resolve before `/brain-storm` writes requirements.
- **Mutation testing never reaches legacy code** unless an add-on runs a whole-scope baseline. Under the slim model this is accepted.
- **Assumptions to verify:**
  - The generic reader returns cited impact evidence without sliding into conclusions.
  - A test can be linked to the code or scenario it guards well enough to apply the risk rule. Scheduler's E2E tests "shipped with traceability", which is unchecked.
  - AI-coding changes actually hit hidden-dependency breakage often enough to matter.
  - The tightening rule for Stryker (set `thresholds.break` to the measured score after a complete passing run, never lower it) works with the `stryker-dotnet` gate script.
  - Per-folder `.editorconfig` severity can hold existing .NET lint debt. Scheduler will not test this because its build already treats warnings as errors and is clean.
  - Replacing `.github/` on Scheduler most likely makes Git skip hooks silently, because `core.hooksPath` points into `.github/skills/deterministic-verification/hooks`.

## Sources
- [Stryker.NET configuration](https://stryker-mutator.io/docs/stryker-net/configuration/) — `--since` scopes to changed code. `--with-baseline` is experimental. `thresholds.break` is a fixed, hand-set number with no automatic tightening.
- [StrykerJS incremental mode](https://stryker-mutator.io/docs/stryker-js/incremental/) — `--incremental` reuses earlier results; there is no git-ref option, and its detection has limits that depend on the test runner.
- [ESLint bulk suppressions](https://eslint.org/docs/latest/use/suppressions) / [v9.24.0 release](https://eslint.org/blog/2025/04/eslint-v9.24.0-released/) — a committed `eslint-suppressions.json` holds existing debt for `"error"` rules. Unused suppressions fail until pruned, so the baseline can only shrink.
- [.NET suppress code analysis warnings](https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/suppress-warnings) — only severity, `#pragma`, and `SuppressMessageAttribute`/`GlobalSuppressions.cs`. No native baseline or changed-files mode.
- Local grounding: `.github/skills/onboard-project/`, `README.md`, `AGENTS.md` (Mission 3 token definitions), `work-planner` (`SKILL.md` lines 130-136 define critical cards and `Review: required`), `pull-work`, `language-addons/csharp/stryker-dotnet`, and surveys of `C:\Projects\Scheduler` (101 production files, ~9.2k lines, ~12.3k test lines, 419 tests, 156 scenarios) and `C:\Projects\ralph.loop` (set aside).

## Open Threads
- Does the slim model graduate as a small `/brain-storm`, or wait for evidence from a real Scheduler change?
- Align the risk-based "bring the user in" rule with Fixture Repair, which currently runs without the user.
- Pick a term for measured existing debt that does not clash with the add-ons' "baseline".
- Should `work-planner` add lint, test-harness, and mutation `Setup Card`s automatically after scaffolding an empty repo?
- Parked, process hardening: Fixture Repair changes locked fixtures without the user, the `small` lane has no lock, the guard hook does not block shell writes, and coder-written, unlocked unit tests feed the mutation gate.
- Parked, separate future incubation: separating the workflow from ralph.loop's product.

## Pick Up Here
- Decide whether to graduate the slim model to `/brain-storm`, or first run one real change in Scheduler and see whether hidden-dependency breakage shows up under AI coding. Before relying on the risk rule, check how a test could be linked to what it guards.
