# Incubation - Onboard Project Skill

Status: incubating
Started: 2026-11-23
Updated: 2026-11-23

## Spark
- An untracked `.github/skills/onboard-project/` skill from an earlier workflow generation was added to the repo. We want to understand whether to convert it into an onboarding coordinator for the current `Workflow Core` and `Language Add-ons`, reshape its scope, or scrap it and solve the underlying problems elsewhere.

## Current Mental Model
- The job has narrowed to **adopting an existing repo onto the current `Workflow Core`**. This covers repos running an older version of the workflow and mature repos that never had one. Empty repos are a separate gap (see Open Threads).
- Migrations will recur with every future workflow version. Past attempts, both a formal skill and "swap the skills, then ask the orchestrator to upgrade", fell short. The main cause was adding lint and mutation testing to code that never had them: unplanned changes, failed installs, and manual fixing in chat. Old and new artifacts also differ in real ways: the `R#` → scenario → locked test → Gate chain does not exist in old artifacts.
- **Decided with the user:**
  - Adopt by **walking the full chain** (`/brain-storm` → `/behavior-spec` → `work-planner`), informed by the old documents, code, and tests. Do not mechanically convert. The real reason is clean requirements and a clean boundary between behavior and implementation, not avoiding breakage. A converter would make up `R#` IDs and carry implementation detail from old slices into the spec.
  - **The spec overrides the code.** When they diverge, the workflow says plainly what changing the code means and what it risks, and treats this as a conversation, not a yes/no confirmation.
  - **In-flight work is frozen** until the walk is done. Unfinished slices may move or stay when re-planned.
  - `.github/` is **replaced wholesale by hand**, then the stack's `Language Add-ons` are copied in. No automation yet. README Quick Start is only for trying the workflow on a made-up app.
  - **80/20 seed design:** the adopt skill writes a cheap **inventory**: what exists, without summarizing content. Each core step reads the inventory, then asks **one generic reader agent** its own question and gets back short, **cited evidence, not conclusions**. Core skills each gain about one conditional line. Add specialized document readers only if Scheduler shows a format the generic reader keeps misreading.
  - **Lint and mutation adoption scales with repo size:** small repos fix everything up front. Medium and large repos **measure a baseline and tighten gradually**. Each `Language Add-on` owns how its tool holds existing debt and tightens over time, including working around what the tool cannot do natively.
  - **Scheduler** is the first target, walked as **one adoption** across several sessions in one Session Chain. **ralph.loop is set aside**: its product reads the old `.workflow/` format, so separating the workflow from the product is a product problem of its own.
- **Current leaning (tentative):** characterization tests are scaffolding to get a repo running under the workflow. They are needed only where existing tests are thin, and Scheduler probably does not need them.

```text
replace .github/ (manual) + copy Language Add-ons
      │
      ▼
adopt skill ── repair breakage · freeze old files · write inventory (incl. repo size)
      │
      ▼
[thin tests?] characterization tests (scaffolding)
      │
      ▼
/brain-storm ─▶ /behavior-spec ─▶ work-planner baseline phase
      ▲               ▲                 │  verify cards (spec overrides code, via conversation)
      └── generic reader agent ─────────┤  lint & mutation: small = fix now,
          (question → cited facts)      │  medium/large = baseline + tighten gradually (per add-on)
                                        ▼
                                  normal /pull-work, then delete the frozen copy
```

## What Fits vs. What Clashes

| Dimension | Draft `onboard-project` | Current take |
| --- | --- | --- |
| **Scope** | Coordinates everything from an empty repo, running product skills inline | Thin adopt skill for existing repos: repair, freeze, inventory, then hand off to `/brain-storm`. The name should change, for example `adopt-workflow`, to be decided in `/brain-storm`. |
| **Old artifacts** | Checks that files exist and are current | Freeze a copy. Convert directly only mechanical items (glossary terms, ADRs). Everything else is evidence for a seeded walk. |
| **Stack tooling** | Routes to old protocols | `Language Add-ons` own baseline-and-tighten for their tool |
| **Instruction files** | Normalizes `AGENTS.md` and others | The adopt skill repairs references that the `.github/` replacement breaks (`AGENTS.md`, `.opencode/`, `core.hooksPath`) |

| Old artifact (Scheduler) | Current equivalent | Missing from the old artifact |
| --- | --- | --- |
| `.workflow/CONTEXT.md` | Session Chain | `R#` IDs, coarse acceptance signals, decision reasons |
| `.workflow/UBIQUITOUS-LANGUAGE.md` | `.workflow/language.md` | Mostly a straight conversion |
| `plans/` + `phase-NN/` slices | `plan.md` + `phase-NN.md` cards | Next, Oracle and lock lines; scenario IDs; exact Files; delegation readiness |
| `acceptance.feature` (156 scenarios) | Scenarios on cards | IDs and tags. This is the strongest seed available. |
| `docs/adr/` (4) | `.workflow/adr/` | Location and numbering |

| Repo | Production code | Test code / methods | Old scenarios | Size by behavior |
| --- | --- | --- | --- | --- |
| Scheduler | 101 files, ~9.2k lines | ~12.3k lines / 419 | 156 | Medium, with strong evidence |
| ralph.loop (set aside) | 76 files, ~9.7k lines | ~25.2k lines / 890 | 226 | Medium to large |

## Tensions & Tradeoffs
- **Baseline phase: adopt existing tests or write fresh ones.** Writing fresh `verify` tests duplicates Scheduler's 419 tests, and by Mission 3 most of those tokens are wasted. Adopting existing tests, by reviewing each against the spec and then tagging and locking it, is much cheaper. But it bends the rule that acceptance tests come strictly from behavior requirements, because old tests may be tied to implementation. This is the main unresolved decision.
- **Repo size does not scale for a whole-repo walk:** characterization tests, the spec, `verify` cards, and the freeze all grow with total behavior. Adopting one area at a time, in the order work needs it, scales better, but it weakens "fully into the chain" and "freeze until done". Scheduler is walked whole; area-by-area could be proven later on a larger repo.
- **Line count is the wrong size measure.** Walk cost scales with behavior: scenarios, tests, and rules.
- **"Baseline" means two things:** in the add-ons it means the default rule set or thresholds; here it means measured existing debt. Resolve this before `/brain-storm` writes requirements.
- **Mutation testing never reaches legacy code** unless the add-on runs a whole-scope baseline, because the Gate's mutation step only covers files the phase changed, and `verify` cards change no files.
- **Simplest 80/20 baseline (chosen):** one generic reader agent plus inventory, about one conditional line per core skill, and baseline-and-tighten inside the add-ons. The full version adds specialized readers per document type, worth it only if Scheduler shows repeated misreads.
- **Assumptions to verify:**
  - The generic reader returns cited evidence without sliding into conclusions or anchoring discovery.
  - Scheduler's E2E tests, which shipped "with traceability", map cleanly enough to spec scenarios to be adopted.
  - The tightening rule for Stryker (set `thresholds.break` to the measured score after a complete passing run, never lower it) works in practice with the `stryker-dotnet` gate script.
  - Per-folder `.editorconfig` severity can hold existing .NET lint debt. This is not verified, and Scheduler won't test it because its build already treats warnings as errors and is clean.
  - Replacing `.github/` on Scheduler most likely makes Git skip hooks silently, because `core.hooksPath` points into `.github/skills/deterministic-verification/hooks`.

## Sources
- [Stryker.NET configuration](https://stryker-mutator.io/docs/stryker-net/configuration/) — `--since` scopes to changed code. `--with-baseline` is experimental. `thresholds.break` is a fixed, hand-set number with no automatic tightening.
- [StrykerJS incremental mode](https://stryker-mutator.io/docs/stryker-js/incremental/) — `--incremental` reuses earlier results; there is no git-ref option, and its detection has limits that depend on the test runner.
- [ESLint bulk suppressions](https://eslint.org/docs/latest/use/suppressions) / [v9.24.0 release](https://eslint.org/blog/2025/04/eslint-v9.24.0-released/) — a committed `eslint-suppressions.json` holds existing debt for `"error"` rules. Unused suppressions fail until pruned, so the baseline can only shrink. This is the only native mechanism to hold debt and tighten.
- [.NET suppress code analysis warnings](https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/suppress-warnings) — only severity, `#pragma`, and `SuppressMessageAttribute`/`GlobalSuppressions.cs`. No native baseline or changed-files mode.
- Local grounding: `.github/skills/onboard-project/`, `README.md`, `AGENTS.md` (Mission 3 now defines useful, wasted, and expensive tokens), `work-planner` and `PHASE-FORMAT.md`, `language-addons/csharp/stryker-dotnet`, and the `.github/`, `.workflow/`, `docs/`, Git config, and size surveys of `C:\Projects\Scheduler` and `C:\Projects\ralph.loop`.

## Open Threads
- Should the baseline phase adopt and lock existing tests that prove a spec scenario, or always write fresh locked tests?
- Characterization tests as disposable scaffolding: confirm (current leaning).
- Is adopting one area at a time an acceptable form of "fully into the chain" for repos larger than Scheduler?
- Pick a term for measured existing debt that does not clash with the add-ons' "baseline".
- Should `work-planner` add lint, test-harness, and mutation `Setup Card`s automatically after scaffolding an empty repo?
- Parked, process hardening: Fixture Repair changes locked fixtures without the user, the `small` lane has no lock, the guard hook does not block shell writes, and coder-written, unlocked unit tests feed the mutation gate.
- Parked, separate future incubation: separating the workflow from ralph.loop's product.

## Pick Up Here
- Decide whether the baseline phase **adopts existing Scheduler tests** that prove a spec scenario (review against the spec, tag, lock) or **writes fresh locked tests**. Start rested, from the rule that acceptance tests come strictly from behavior requirements, and weigh it against Mission 3's definition of wasted tokens.
