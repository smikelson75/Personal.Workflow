# skill-review plan

- Spec: [skill-review-spec.md](../../specs/skill-review-spec.md)
- Lane: standard
- Next: P01 S01
- Tests locked: `28fbd6e`
- Oracle: `tests/skill-review`
- Phase base: `28fbd6e`
- Reconciled: `0c7a2b317a2d2c0d38cf3dfcfc4fc4e86549b2e8`

## Current state
- stack: Node ES modules (`.mjs`, built-in `node:test`, zero dependencies, ADR 0001); node v25.9.0; no root `package.json`.
- harness: `node --test --test-reporter=tap "tests/skill-review/*.test.mjs"` - drives the CLI `.github/tools/skill-review/bin/skill-review.mjs` as a child process against temp Home Repos, Project Repos, and fixture Conversation Logs; `.github/tools/workflow-core/support/harness.mjs` (`tempRepo`, `read`, `lines`) is the only shared test helper; runs (the CLI is not built yet, so the new tests fail until built)
- suite baseline: failing: `[R29-01] Glossary defines the 13 added terms` and `[Q-zero-workflow-check-errors]` in `tests/glossary-alignment/p01-s01.test.mjs` (47 Terms, cap 40); 374 of 376 pass
- mutation: unsupported for node - no mutation Language Add-on installed
- in place: `scripts/update-home.mjs` (installs `.github/tools/**` to `.workflow-core/tools/**` and skills to `.claude/skills/**`, prints `Workflow version: <old> -> <new>`), `home/launch.mjs` (sets `WORKFLOW_HOME`), `.github/tools/workflow-check`, `.github/prompts/review-incubate.prompt.md` (removed in P05); no skill-review or apply-observation code
- gap to spec: R52, R53, R54, R55, R56, R57, R58, R59, R60, R61, R62, R63, R64, R65, R66, R67, R68, R69, R70, R71, R72, R73, Q-model-reading, Q-readability, Q-ste, Q-privacy, Q-offline

## Decisions pinned by the plan
- One CLI, `.github/tools/skill-review/bin/skill-review.mjs`, does all deterministic work in two steps the `skill-review` skill runs around the model: `prepare` (Depth 0, writes nothing but a compact-record file) and `finish` (P03-P04, writes records). The model only judges between them. `.github/tools/**` installs to the Home Repo, so the Home layout runs it from `$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs`.
- The Review Record is one JSON file, `<Home Repo>\skill-review\review-record.json` (agent layout, not STE).
- Acceptance tests live in `tests/skill-review/` (not installed into a Home Repo); each test file is self-contained and builds its own fixtures.
- Harness locations are overridable for tests with `SKILL_REVIEW_COPILOT_HOME` (default `~/.copilot`) and `SKILL_REVIEW_CLAUDE_HOME` (default `~/.claude`).

## Carry-forward
- P06: the baseline glossary-size failures (47 Terms over cap 40) are `Known failures` owned by P06 so P01-P05 gates stay meaningful; raise them to the Developer when P06 is planned (setup card or accept).

## Phases

| # | Phase | Status | Covers | Detail |
|---|-------|--------|--------|--------|
| P01 | Prepare finds unreviewed skill uses | in progress | R52 (read side), R53 (failure, filter), R54 (read side), R61 (read side), R65, R67 (failure) | [phase-01](phase-01.md) |
| P02 | Depth 0 signals, flags, slices, tokens | planned | R62, Q-model-reading | |
| P03 | Finish: Observations, lifecycle, installs, Review Record | planned | R54 (write side), R57, R58, R59, R61 | |
| P04 | Executive Summary, Ledger, STE check, commit | planned | R52 (commit-failed, Reviewed line), R60, R63, R64, Q-readability, Q-ste, Q-privacy, Q-offline | |
| P05 | Handoffs, skill-review skill, cleanup | planned | R55, R56, R66, R67 (removal) | |
| P06 | /apply-observation | planned | R68, R69, R70, R71, R72, R73 | |

## P01 slices

| # | Slice | Status |
|---|-------|--------|
| S01 | CLI skeleton, layout gate, failures, empty run | ready |
| S02 | Copilot CLI skill uses in the Project Repo | ready |
| S03 | Claude Code skill uses and unknown-record notices | ready |
| S04 | Reviewed Positions from the Review Record | ready |
