# Behavior Spec - Glossary Alignment

## Sources
- Sessions: `context-2026-11-21-1859.md` (builds on `context-2026-11-21-1750.md`)
- Language: `.workflow/language.md`
- Companion specs: [workflow-core-spec.md](workflow-core-spec.md), [workflow-check-spec.md](workflow-check-spec.md), [calc-repl-walkthroughs-spec.md](calc-repl-walkthroughs-spec.md)

## Target Outcome
- once v1 is done, the Glossary defines the 13 core workflow terms alongside its other terms, `language-addons/` replaces `language-skills/` across all active files and suites with prior Sessions untouched, all three stack walkthroughs and Workflow Core prose under `.github/` use one consistent canonical vocabulary with no stale remarks or duplicate glossary file, and downstream Workflow Core skills and subagents ground their work in `.workflow/language.md` according to their required, optional, or closed-world contracts.

## Requirements

### R29 - Glossary defines the 13 core workflow terms
- Data: `.workflow/language.md` contains `## Terms` (the 13 added terms plus every other active term) and `## Retired`, in Glossary format (`` - `Term` - meaning `` with optional `Avoid:`, `States:`, `Code:` parts).
- Rules:
  - `.workflow/language.md` defines all 13 added workflow terms: `Behavior Spec`, `Plan`, `Phase`, `Slice`, `Card`, `Scenario`, `Tier`, `Gate`, `Phase Review`, `Setup-Card Approval`, `Oracle`, `Traceability`, and `ADR`.
  - `Slice` (thin vertical unit of observable behavior) and `Card` (closed-world work brief in a Phase file) remain two separate canonical terms; no merged `Slice Card` term exists.
  - `Language Add-on` records `Code: language-addons/`.
  - Total Glossary term count is not fixed: later Sessions may add terms, and the total only has to stay at or below `workflow-check`'s 40-term cap.
  - Running `node .github/tools/workflow-check/bin/workflow-check.mjs` on the Workflow Folder exits `0` with `0 errors`, and reports zero `structure/glossary-section`, `structure/glossary-term-format`, `vocabulary/glossary-conflict`, `vocabulary/missing-term`, or `excess/glossary-size` Findings on `.workflow/language.md`.
- Failure:
  - any of the 13 terms missing, `Slice` and `Card` merged, invalid entry syntax, duplicate or conflicting Glossary term, or any `workflow-check` error Finding -> rejected as `glossary-invalid`; Workflow Folder stays unchanged and downstream stages do not proceed until corrected.
- Examples:
  - Given `.workflow/language.md` containing all 13 added terms with `Slice` and `Card` defined separately and `Language Add-on` pointing to `Code: language-addons/`, when `workflow-check` runs, then exit code is `0` and stdout ends with `workflow-check: 0 errors, ...`.
  - Given `.workflow/language.md` with 35 terms including all 13 added terms, when checked against R29, then it passes acceptance; with 41 terms it fails (failure).
  - Given `.workflow/language.md` missing `Oracle` or merging `Slice` and `Card` into `Slice Card`, when checked against R29, then it fails acceptance (failure).

### R30 - Rename `language-skills/` to `language-addons/` and update active references
- Rules:
  - `language-addons/` exists at the repository root containing all Language Add-on folders and the shared `mutation-testing` protocol with their relative subpaths preserved; `language-skills/` does not exist.
  - All active references to `language-skills/` point to `language-addons/`:
    - `.workflow/language.md` (`Code: language-addons/` on `Language Add-on`)
    - `docs/walkthrough-node.md`, `docs/walkthrough-typescript.md`, and `docs/walkthrough-csharp.md` (all Markdown links `../language-addons/...` and PowerShell `Copy-Item` paths `$workflowSrc\language-addons\...`)
    - `tests/acceptance/p01-s03.test.mjs` (the PowerShell forward-slash path guard checks `language-addons/` instead of `language-skills/`)
  - Internal relative links inside `language-addons/` remain unchanged because zero files inside `language-addons/` reference `language-skills/` and existing relative links (such as `../mutation-testing/protocol.md`, `references/BASELINE.md`, `references/ENFORCEMENT.md`, `scripts/trace.mjs`, and `scripts/mutation-gate.mjs`) are target-repo-relative once copied into `.github/skills/`.
  - Prior Session files are never modified or deleted; historical `language-skills/` references in them remain untouched. Prior Session files are `context-2026-11-20-1124.md`, `context-2026-11-21-1442.md`, `context-2026-11-21-1750.md`, and `context-2026-11-21-1859.md` in `.workflow/sessions/`. Adding new Session files to `.workflow/sessions/` does not violate this rule.
  - Existing acceptance suites (`tests/acceptance/*.test.mjs`, `.github/tools/workflow-check/tests/acceptance/*.test.mjs`, and `.github/tools/workflow-core/tests/acceptance/*.test.mjs`) pass.
- Failure:
  - `language-skills/` still exists, `language-addons/` is missing any migrated file, any active documentation, Glossary entry, add-on file, or acceptance suite file still references `language-skills/`, any prior Session file is modified, or an acceptance suite fails -> rejected as `rename-incomplete`.
- Examples:
  - Given the renamed repository, when checked, then `language-addons/mutation-testing/protocol.md` and every stack add-on exist, `language-skills/` does not exist, zero occurrences of `language-skills` appear outside `.workflow/sessions/`, and all acceptance suites pass.
  - Given `docs/walkthrough-typescript.md` or `tests/acceptance/p01-s03.test.mjs` still containing `language-skills`, when checked against R30, then it fails acceptance (failure).
  - Given `.workflow/sessions/context-2026-11-21-1442.md` edited to replace `language-skills/` with `language-addons/`, when checked against R30, then it fails acceptance because prior Sessions are immutable (failure).
  - Given a new Session file `.workflow/sessions/context-2026-11-25-1955.md` added and the four prior Session files unchanged, when checked against R30, then it passes acceptance.

### R31 - Align the three stack walkthroughs to canonical vocabulary
- Rules:
  - Applies to `docs/walkthrough-node.md`, `docs/walkthrough-typescript.md`, and `docs/walkthrough-csharp.md`.
  - Each walkthrough uses canonical Glossary terms (matched case-insensitively): `Workflow Core`, `Language Add-on` / `Language Add-ons`, `Setup-Card Approval`, `Phase Review`, `Gate`, `Card`, `Slice`, `Scenario`, `Tier`, and `Behavior Spec`.
  - None of the three walkthroughs contain avoided workflow synonyms (`language skill` / `language skills`, `core workflow`, `toolkit`, `approval step`, `validation step`, `PRD`, `design doc`, `language file`, `dictionary`, `flaky test`, `legacy failure`, `slice card` / `slice cards`, or `adapter` referring to a `Language Add-on`) or variant Checkpoint labels (`Setup-Card Checkpoint`, `Phase Review Checkpoint`, `phase review approval`).
  - Non-workflow domain and tool terms (`test` for unit/acceptance suites, `task` describing `todo-cli`, `validator` describing `env-check`, and `Enforcement level` for ESLint/editorconfig baseline setup) are not treated as avoided workflow synonyms.
  - `docs/walkthrough-csharp.md` removes the stale file-write `Review: required` remark (`cards touching file writes/deletes will be flagged \`Review: required\``) in Part 3 Step 3.
  - All `calc-repl-walkthroughs-spec.md` rules (R24–R28 and its Quality Thresholds) remain satisfied.
- Failure:
  - any of the three walkthroughs contains an avoided workflow synonym, a variant Checkpoint label, or the stale file-write remark in `docs/walkthrough-csharp.md` -> rejected as `vocabulary-drift`.
- Examples:
  - Given all three walkthroughs, when searched for `language skill`, `core workflow`, `Setup-Card Checkpoint`, `Phase Review Checkpoint`, `slice card`, and `file writes/deletes`, then zero matches exist, while each file contains `Workflow Core`, `Language Add-on`, `Setup-Card Approval`, and `Phase Review`.
  - Given `docs/walkthrough-csharp.md` Part 3 Step 3 still mentioning `file writes/deletes` or `Setup-Card Checkpoint`, when checked against R31, then it fails acceptance (failure).

### R32 - Align Workflow Core `.github/` prose without a duplicate glossary
- Rules:
  - Applies to Workflow Core skills, agents, and interaction rules under `.github/` (`.github/skills/**`, `.github/agents/**`, and `.github/user-interaction.md`).
  - Prose uses canonical Glossary terms consistently (`Workflow Core`, `Language Add-on`, `Setup-Card Approval`, `Phase Review`, `Card`, `Slice`, `Gate`, `Oracle`), matched case-insensitively so existing lowercase markers required by locked `workflow-core` tests (`setup-card approval` in `.github/user-interaction.md` and `setup-card` in `.github/agents/planner.agent.md`) remain intact.
  - Prose contains zero occurrences of avoided workflow synonyms (`language skill` / `language skills`, `core workflow`, `toolkit`, `approval step`, `validation step`, `design doc`, `language file`, `dictionary`, `flaky test`, `legacy failure`, `slice card` / `slice cards`) or variant Checkpoint labels (`Setup-Card Checkpoint`, `setup-card Checkpoint`, `Phase Review Checkpoint`, `phase review approval`).
  - Backticked compatibility literals (such as `` `deferred-to-PRD` `` in `.github/skills/behavior-spec/SKILL.md`), format exclusion lists (such as `SPEC-FORMAT.md`'s `## Exclude`), and test fixtures under `.github/tools/` are exempt from the prose word ban.
  - No duplicate workflow-terms glossary file (such as `language.md`, `glossary.md`, or `workflow-terms.md`) exists anywhere under `.github/`; format templates (such as `.github/skills/brain-storm/references/LANGUAGE-FORMAT.md`) remain.
  - Existing `workflow-core` and `workflow-check` acceptance suites pass.
- Failure:
  - any `.github/` skill, agent, or interaction-rules file retains a forbidden variant label or avoided synonym in prose, or any duplicate workflow-terms glossary file exists under `.github/` -> rejected as `core-vocabulary-drift`.
- Examples:
  - Given `.github/agents/planner.agent.md`, `.github/skills/work-planner/SKILL.md`, `.github/skills/pull-work/SKILL.md`, `.github/agents/coder.agent.md`, and `.github/agents/test-author.agent.md`, when inspected, then zero occurrences of `setup-card Checkpoint`, `Phase Review Checkpoint`, `phase review approval`, or `slice card` exist, and no workflow-terms glossary file exists under `.github/`.
  - Given `.github/workflow-terms.md` added or `slice card` left in `.github/agents/coder.agent.md`, when checked against R32, then it fails acceptance (failure).

### R33 - `pull-work`, `test-author`, and `test-reviewer` require `.workflow/language.md`
- Rules:
  - `.github/skills/pull-work/SKILL.md`, `.github/agents/test-author.agent.md`, and `.github/agents/test-reviewer.agent.md` each declare `.workflow/language.md` as a required input for product vocabulary.
  - Both `work-planner` (Phase Review) and `pull-work` (Fixture Repair) pass `.workflow/language.md` by path alongside the spec path when dispatching `test-author` or `test-reviewer`.
  - In `pull-work` Preflight (after argument syntax parsing per `workflow-core` R21, and before routing on `Next` or dispatching any subagent): if `.workflow/language.md` is missing, `pull-work` stops immediately, names `.workflow/language.md` as missing, and redirects the Developer to `/brain-storm` (for example: `Missing required Glossary at .workflow/language.md. Run /brain-storm to establish it before continuing with /pull-work.`).
  - If `test-author` or `test-reviewer` runs when `.workflow/language.md` is missing, it stops without writing tests or approving a repair and reports the missing `.workflow/language.md` to its caller (never asking the Developer, per `workflow-core` R22).
- Failure:
  - `.workflow/language.md` missing when `/pull-work` runs -> rejected as `glossary-missing`; stops and redirects to `/brain-storm`; working tree, Plan, and Phase files stay unchanged; no subagent is dispatched; `/pull-work` works normally once `/brain-storm` creates `.workflow/language.md`.
  - `.workflow/language.md` missing when `test-author` or `test-reviewer` runs -> stops and reports to caller; no test files or approvals are written.
  - any of the three files omits `.workflow/language.md` as a required input, or `pull-work` omits the missing-Glossary `/brain-storm` redirect -> rejected as `contract-missing`.
- Examples:
  - Given a repository with `.workflow/language.md`, when `work-planner` (Phase Review) or `pull-work` (Fixture Repair) dispatches `test-author` or `test-reviewer`, then `.workflow/language.md` is passed by path alongside the spec path and execution proceeds.
  - Given a repository with no `.workflow/language.md`, when `/pull-work` runs, then it stops before routing or dispatching, names `.workflow/language.md` as missing, redirects to `/brain-storm`, and leaves all Plan, Phase, and repository files unchanged (failure).
  - Given `/pull-work bug:` (empty description) in a repository without `.workflow/language.md`, when run, then argument validation still shows `/pull-work [<slug>] bug: <description>` and leaves all files unchanged (failure).

### R34 - `adr-writer` and `repo-scout` read `.workflow/language.md` optionally; `coder` stays closed-world
- Rules:
  - `.github/skills/adr-writer/SKILL.md` (under `## Inputs`) and `.github/agents/repo-scout.agent.md` each declare `.workflow/language.md` as an optional input: when present, they read it and use its canonical terms; when absent, they proceed without stopping, redirecting, or reporting an error and skip Glossary grounding.
  - `.github/agents/coder.agent.md` stays closed-world: it contains no reference to `.workflow/language.md` and no Glossary read step; canonical names reach `coder` only through each Card's `Decisions`.
- Failure:
  - `adr-writer` or `repo-scout` omits `.workflow/language.md` as an optional input or stops when `.workflow/language.md` is absent -> rejected as `contract-mismatch`.
  - `coder.agent.md` references `.workflow/language.md` or instructs reading the Glossary -> rejected as `closed-world-breach`.
- Examples:
  - Given a repository with no `.workflow/language.md`, when `adr-writer` (ad hoc) or `repo-scout` runs, then it proceeds without stopping and skips Glossary grounding.
  - Given `.github/agents/coder.agent.md` inspected for `.workflow/language.md` or a Glossary read step, then zero matches exist; adding `.workflow/language.md` as an input to `coder.agent.md` fails acceptance (failure).

## Quality Thresholds
- Zero `workflow-check` errors -> `node .github/tools/workflow-check/bin/workflow-check.mjs` exits `0` with `0 errors` on the repository's Workflow Folder (Glossary terms <= 40 cap).
- Zero stale `language-skills/` references -> 0 occurrences of `language-skills` across `.workflow/language.md`, `docs/walkthrough-*.md`, `language-addons/**`, `.github/**`, and `tests/acceptance/*.test.mjs` (prior Sessions in `.workflow/sessions/` excluded).
- Zero vocabulary drift -> 0 occurrences of forbidden avoided workflow synonyms or variant Checkpoint labels across `docs/walkthrough-*.md`, `.github/skills/**`, `.github/agents/**`, and `.github/user-interaction.md` (exemptions per R31 and R32).
- Suite preservation -> 100% of existing acceptance tests (`tests/acceptance/*.test.mjs`, `.github/tools/workflow-check/tests/acceptance/*.test.mjs`, and `.github/tools/workflow-core/tests/acceptance/*.test.mjs`) pass with zero regressions.

## External Constraints
- `.workflow/language.md` stays at or below `workflow-check`'s 40-term size cap and conforms to the Glossary format (`brain-storm/references/LANGUAGE-FORMAT.md`) - `brain-storm` and `workflow-check` R2/R5.
- Prior Session files in `.workflow/sessions/` are immutable and never modified - `brain-storm` contract and `workflow-check` R11.
- Workflow Core (`.github/`) remains portable and never ships a copy of this repository's `.workflow/language.md` or a duplicate workflow-terms file; each target repository owns its own `.workflow/language.md` - session constraint.
- `coder` remains closed-world to preserve cheap-model token efficiency - session constraint.
- Existing locked `workflow-core` tests check lowercase `setup-card approval` in `.github/user-interaction.md` (`[R23-02]`) and `setup-card` in `.github/agents/planner.agent.md` (`[R13-06]`), and `calc-repl-walkthroughs` tests enforce R24–R28 on `docs/walkthrough-*.md` - existing repository acceptance suites.
- Out of scope: extending `workflow-check` to scan `docs/` or `.github/`, wiring `.workflow/language.md` into `conventional-commit`, and shipping a second workflow-terms file inside `.github/` - session scope.

## Product Interfaces
- `.workflow/language.md`: canonical Glossary (at most 40 terms) checked by `node .github/tools/workflow-check/bin/workflow-check.mjs`.
- `language-addons/`: top-level directory containing stack Language Add-ons and the shared `mutation-testing` protocol.
- `docs/walkthrough-node.md`, `docs/walkthrough-typescript.md`, `docs/walkthrough-csharp.md`: Developer-facing stack walkthroughs.
- `/pull-work`, `/adr-writer`, and subagents `test-author`, `test-reviewer`, `repo-scout`, `coder`: Glossary input and missing-Glossary contracts as specified in R32–R34.

## Left To Planning
- How automated acceptance tests inspect `.github/` and `docs/` files for canonical terms, avoided synonyms, and Glossary input markers (following `workflow-core` R16's stable-marker rule and `workflow-check` R18's reword-tolerance standard).
- Exact wording of the `.workflow/language.md` input lines in skills/agents and the `pull-work` redirect message (beyond naming `.workflow/language.md` and `/brain-storm`).
- Whether `pull-work` Preflight checks for `.workflow/language.md` via a shell command or a helper script.
- How R29–R34 are sliced and sequenced across phases and Cards.

## Assumptions
- R29: the Glossary has no exact term count; R29 requires only the 13 added terms, `Slice`/`Card` separation, and the 40-term cap - the Session's "total 28" described the Glossary when that Session was settled, and the later final Session `context-2026-11-25-1955.md` grew it to 35 terms. Pinning any exact count would make R29 fail every time a later Session adds a term.
- R30: "prior Session" means the four Session files in this spec's Session Chain; Session files added later are allowed - `brain-storm` adds a new Session file for each Session, and `context-2026-11-25-1955.md` was added rather than edited.
- R30: zero internal relative links inside `language-addons/` need updating during the rename - verified across all 17 files in `language-skills/`: none reference `language-skills/`, and links such as `../mutation-testing/protocol.md` are already target-repo-relative once copied into `.github/skills/`.
- R33: `.workflow/language.md` is passed by path (not inline) to `test-author` and `test-reviewer` by both `work-planner` (Phase Review) and `pull-work` (Fixture Repair) - matches how both callers already pass the spec path, avoids duplicating Glossary content in prompts, and both agents have `read` access.
- R33: `pull-work`'s missing-Glossary check runs in Preflight after argument syntax parsing (`parse-args.mjs`) and before routing or subagent dispatch, with a plain-language redirect naming `.workflow/language.md` and `/brain-storm` - preserves `workflow-core` R21's empty-`bug:` usage line while ensuring no mode or subagent runs without a Glossary.
- R33: `test-author` and `test-reviewer` stop and report to their caller (without writing or approving) if `.workflow/language.md` is missing - follows `workflow-core` R22 (subagents never ask the Developer) and guards direct dispatches.
- R31, R32: canonical term matching is case-insensitive, and non-workflow domain/tool terms (`test`, `task` for `todo-cli`, `validator` for `env-check`, `Enforcement level` for linter setup), backticked compatibility literals (`` `deferred-to-PRD` ``), format exclusion lists (`SPEC-FORMAT.md` `## Exclude`), and `.github/tools/` test fixtures are exempt from the avoided-synonym ban - matches `workflow-check` R1 and preserves locked acceptance tests (`[R13-06]`, `[R23-02]`).
- R31, R32: `slice card` / `slice cards` is forbidden alongside avoided synonyms and variant Checkpoint labels - follows `context-2026-11-21-1859.md`'s rejected decision keeping `Slice` distinct from `Card`.
- R32, R33, R34: live runtime agent conduct (such as whether `adr-writer` or `repo-scout` rephrases output using Glossary terms) is verified through stable markers per `workflow-core` R16 and approved as not expressible where no non-LLM black-box check applies - avoids brittle sentence-matching (`workflow-check` R18) and token-spending agent runs in tests.
