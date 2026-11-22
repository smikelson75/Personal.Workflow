# Language

## Terms
- `workflow-check` - command-line tool that checks the Workflow Folder against Rules and reports Findings; never modifies files. Avoid: linter, validator.
- `Rule` - one named check with a stable rule ID, a Category, and a Severity. Avoid: check (as a noun), test.
- `Finding` - one reported Rule break at a file and line. Avoid: issue, problem, violation, diagnostic.
- `Severity` - how serious a Finding is: `error` fails the run; `warning` is reported but passes. Avoid: level, priority.
- `Category` - a group of Rules: `structure`, `chain`, `vocabulary`, `excess`.
- `Session` - one brain-storm session file in `.workflow/sessions/`. States: draft -> final.
- `Session Chain` - the final, non-superseded Sessions that together hold current truth for a product.
- `Requirement` - a numbered `R#` observable behavior with an Accept signal; ID unique across the Session Chain. States: active -> retired.
- `Glossary` - the single shared list of canonical terms. Avoid: dictionary, language file. Code: `.workflow/language.md`
- `Workflow Folder` - the `.workflow/` directory a run reads. Code: `.workflow/`
- `Workflow Core` - the `.github/` skills, agents, hooks, and tools copied into a target repository; workflow-check is one tool inside it. Excludes this repository's AGENTS.md and Language Add-ons. Avoid: toolkit. Code: `.github/`
- `Language Add-on` - an optional stack-specific skill (harness, lint, mutation) the Developer copies into `.github/skills/` per project. Avoid: language skill, adapter. Code: `language-addons/`
- `Stall` - an unplanned stop that needs a hand fix to workflow files before the run can continue. Avoid: blocker, hang.
- `Checkpoint` - a planned stop where the Developer reviews or approves, answered as one bundled question; distinct from the Gate, which runs without the Developer. Avoid: approval step.
- `Known Failure` - a pre-existing failing test listed with an owning later phase; excluded from the Gate. Avoid: flaky test, legacy failure.
- `Behavior Spec` - black-box behavioral contract derived from the Session Chain. Avoid: PRD, design doc. Code: `.workflow/specs/<slug>-spec.md`
- `Plan` - routing record and current-state status for a product, holding `Lane`, `Next`, `Oracle`, and `Tests locked`. Code: `.workflow/plans/<slug>/plan.md`
- `Phase` - one delivery stage delivering end-to-end value, defined in `phase-NN.md`. States: planned -> in progress -> gating -> completed.
- `Slice` - one thin vertical unit of observable behavior delivered end-to-end through every layer it touches.
- `Card` - one closed-world work brief in a Phase file specifying a Slice, setup work (`Setup Card`), fix, or verification repair (`Kind`: build, setup, fix, test-fix). States: planned -> ready -> in progress -> completed. Avoid: task, ticket, story.
- `Scenario` - one concrete Given / When / Then acceptance case (`R<n>-<nn>` or `Q-<name>`) owned by one `build` Card and verified at the Gate.
- `Tier` - who implements a Card: `delegate` (`coder` agent) or `main` (main session).
- `Gate` - the automated phase-end verification run without the Developer (suite, Traceability, lock verification, and mutation run). Avoid: validation step.
- `Phase Review` - the Checkpoint where the Developer approves a Phase's Cards, failing acceptance cases, Tiers, `Review` flags, and ADR candidates before the Oracle is locked.
- `Setup-Card Approval` - the Checkpoint in Plan mode where the Developer approves setup Cards and any ADR candidates before acceptance authoring begins.
- `Oracle` - the union of paths holding acceptance suites, fixtures, and harness configuration, frozen at the `Tests locked` reference between reviews.
- `Traceability` - the Gate verification that every Scenario owned by the Phase has a tagged acceptance case that ran and passed.
- `ADR` - a point-in-time record of an approved, hard-to-reverse build decision and its trade-offs (`ADR candidate` before approval). Code: `.workflow/adr/`

## Retired
