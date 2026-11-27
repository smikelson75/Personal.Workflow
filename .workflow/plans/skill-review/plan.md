# skill-review plan

- Spec: [skill-review-spec.md](../../specs/skill-review-spec.md)
- Lane: standard
- Next: P03 S01
- Tests locked: `01fe3cd`
- Oracle: `tests/skill-review`
- Phase base: `01fe3cd`
- Reconciled: `0c7a2b317a2d2c0d38cf3dfcfc4fc4e86549b2e8`

## Current state
- stack: Node ES modules (`.mjs`, built-in `node:test`, zero dependencies, ADR 0001); node v25.9.0; no root `package.json`.
- harness: `node --test --test-reporter=tap "tests/skill-review/*.test.mjs"` - drives the CLI `.github/tools/skill-review/bin/skill-review.mjs` as a child process against temp Home Repos, Project Repos, and fixture Conversation Logs; `.github/tools/workflow-core/support/harness.mjs` (`tempRepo`, `read`, `lines`) is the only shared test helper; runs (the CLI is not built yet, so the new tests fail until built)
- suite baseline: failing: `[R29-01] Glossary defines the 13 added terms` and `[Q-zero-workflow-check-errors]` in `tests/glossary-alignment/p01-s01.test.mjs` (47 Terms, cap 40); 374 of 376 pass
- mutation: unsupported for node - no mutation Language Add-on installed
- in place: `scripts/update-home.mjs` (installs `.github/tools/**` to `.workflow-core/tools/**` and skills to `.claude/skills/**`, prints `Workflow version: <old> -> <new>`), `home/launch.mjs` (sets `WORKFLOW_HOME`), `.github/tools/workflow-check`, `.github/prompts/review-incubate.prompt.md` (removed in P05); no skill-review or apply-observation code
- gap to spec: R52 partial, R53 partial, R54 partial, R55, R56, R57, R58, R59, R60, R61 partial, R62 partial, R63, R64, R66, R67 partial, R68, R69, R70, R71, R72, R73, Q-readability, Q-ste, Q-privacy, Q-offline

## Decisions pinned by the plan
- One CLI, `.github/tools/skill-review/bin/skill-review.mjs`, does all deterministic work in steps the `skill-review` skill runs around the model: `prepare` (Depth 0; writes only the compact-record file), `slice` (P02; serves one flagged slice and keeps the token totals in the compact record) and `finish` (P03-P04, writes records). The model only judges between them and never opens a Conversation Log. `.github/tools/**` installs to the Home Repo, so the Home layout runs it from `$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs`.
- The Review Record is one JSON file, `<Home Repo>\skill-review\review-record.json` (agent layout, not STE).
- Acceptance tests live in `tests/skill-review/` (not installed into a Home Repo); each test file is self-contained and builds its own fixtures.
- The model writes one judgement file `{cases:[...]}` (one entry per case: Observation match or new `ref`, part, kind or Miss Label, outcome, Fix Filter, cause) and `finish` applies it; `finish`, `mark-changed`, and `record-install` are the only writers of the Review Record. `record-install` evaluates which change commits an install contains with `git merge-base --is-ancestor` in the source checkout it runs in, and stores them, so later runs need no source repo. Chances to recur are counted for skill parts only; Conversation start is the first Log `timestamp`.
- Harness locations are overridable for tests with `SKILL_REVIEW_COPILOT_HOME` (default `~/.copilot`) and `SKILL_REVIEW_CLAUDE_HOME` (default `~/.claude`).

## Carry-forward
- P02-P04: real Claude logs hold record types outside CLAUDE_TYPES (e.g. api-request-shape), so they print unknown-record notices; revisit the known-type list if noisy. A skill invoked inside another skill ends the outer use at that start (P01 behavior).
- P05: Depth 0 also extracts Workflow Folder artifact and git-history signals for Handoff review (R62); P02 covers Conversation Log signals only.
- P06: the baseline glossary-size failures (47 Terms over cap 40) are `Known failures` owned by P06 so P01-P05 gates stay meaningful; raise them to the Developer when P06 is planned (setup card or accept).

## Phases

| # | Phase | Status | Covers | Detail |
|---|-------|--------|--------|--------|
| P01 | Prepare finds unreviewed skill uses | completed | R52 (read side), R53 (failure, filter), R54 (read side), R61 (read side), R65, R67 (failure) | [phase-01](phase-01.md) |
| P02 | Depth 0 signals, flags, slices, tokens | completed | R62 (Conversation Log side), Q-model-reading | [phase-02](phase-02.md) |
| P03 | Finish: Observations, lifecycle, installs, Review Record | in progress | R54 (write side), R57, R58, R59, R61 | [phase-03](phase-03.md) |
| P04 | Executive Summary, Ledger, STE check, commit | planned | R52 (commit-failed, Reviewed line), R60, R63, R64, Q-readability, Q-ste, Q-privacy, Q-offline | |
| P05 | Handoffs, skill-review skill, cleanup | planned | R55, R56, R62 (Workflow Folder and git signals), R66, R67 (removal) | |
| P06 | /apply-observation | planned | R68, R69, R70, R71, R72, R73 | |

## P03 slices

| # | Slice | Status |
|---|-------|--------|
| S01 | finish writes the reviewed Positions | ready |
| S02 | Cases become Observations | ready |
| S03 | Dismissal, requirements miss, question gap | ready |
| S04 | Change commits, install records, version notice | ready |
| S05 | Changed Observations: improved or unchanged | ready |
