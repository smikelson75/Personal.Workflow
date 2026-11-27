# skill-review plan

- Spec: [skill-review-spec.md](../../specs/skill-review-spec.md)
- Lane: standard
- Next: P06 S05
- Tests locked: `f15f47e`
- Oracle: `tests/skill-review`
- Phase base: `4b7543f`
- Reconciled: `0c7a2b317a2d2c0d38cf3dfcfc4fc4e86549b2e8`

## Current state
- stack: Node ES modules (`.mjs`, built-in `node:test`, zero dependencies, ADR 0001); node v25.9.0; no root `package.json`.
- `harness: node --test --test-reporter=tap "tests/skill-review/*.test.mjs"` - drives the CLI `.github/tools/skill-review/bin/skill-review.mjs` as a child process against temp Home Repos, Project Repos, and fixture Conversation Logs; `.github/tools/workflow-core/support/harness.mjs` (`tempRepo`, `read`, `lines`) is the only shared test helper; runs
- `suite baseline:` passing (all suites in `tests/` pass)
- `mutation: unsupported for node - no mutation Language Add-on installed`
- `in place:` `scripts/update-home.mjs` (installs `.github/tools/**` to `.workflow-core/tools/**` and skills to `.claude/skills/**`, prints `Workflow version: <old> -> <new>`), `home/launch.mjs` (sets `WORKFLOW_HOME`), `.github/tools/workflow-check`, `skill-review` CLI (`prepare`, `slice`, `finish`, `commit`, `mark-changed`, `record-install`) with Handoffs, summary, ledger, STE and privacy checks, and `.github/skills/skill-review/SKILL.md`; no `/apply-observation` CLI subcommands or skill yet
- `gap to spec:` R56 (live run), R68, R69, R70, R71, R72, R73

## Decisions pinned by the plan
- One CLI, `.github/tools/skill-review/bin/skill-review.mjs`, does all deterministic work in steps the `skill-review` skill runs around the model: `prepare` (Depth 0; writes only the compact-record file), `slice` (P02; serves one flagged slice and keeps the token totals in the compact record), `finish` (P03-P04, writes records, Executive Summary, and Ledger) and `commit` (P04, commits only `skill-review/` in the Home Repo). The model only judges between them and never opens a Conversation Log. `.github/tools/**` installs to the Home Repo, so the Home layout runs it from `$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs`.
- The Review Record is one JSON file, `<Home Repo>\skill-review\review-record.json` (agent layout, not STE).
- Acceptance tests live in `tests/skill-review/` (not installed into a Home Repo); each test file is self-contained and builds its own fixtures.
- The model writes one judgement file `{cases:[...]}` (one entry per case: Observation match or new `ref`, part, kind or Miss Label, outcome, Fix Filter, cause) and `finish` applies it; `finish`, `mark-changed`, and `record-install` are the only writers of the Review Record. `record-install` evaluates which change commits an install contains with `git merge-base --is-ancestor` in the source checkout it runs in, and stores them, so later runs need no source repo. Chances to recur are counted for skill parts only; Conversation start is the first Log `timestamp`.
- Harness locations are overridable for tests with `SKILL_REVIEW_COPILOT_HOME` (default `~/.copilot`) and `SKILL_REVIEW_CLAUDE_HOME` (default `~/.claude`).

## Carry-forward
- P02-P04: real Claude logs hold record types outside CLAUDE_TYPES (e.g. api-request-shape), so they print unknown-record notices; revisit the known-type list if noisy. A skill invoked inside another skill ends the outer use at that start (P01 behavior).

## Phases

| # | Phase | Status | Covers | Detail |
|---|-------|--------|--------|--------|
| P01 | Prepare finds unreviewed skill uses | completed | R52 (read side), R53 (failure, filter), R54 (read side), R61 (read side), R65, R67 (failure) | [phase-01](phase-01.md) |
| P02 | Depth 0 signals, flags, slices, tokens | completed | R62 (Conversation Log side), Q-model-reading | [phase-02](phase-02.md) |
| P03 | Finish: Observations, lifecycle, installs, Review Record | completed | R54 (write side), R57, R58, R59, R61 | [phase-03](phase-03.md) |
| P04 | Executive Summary, Ledger, STE check, commit | completed | R52 (commit-failed, Reviewed line), R55 (pending count and Ledger listing), R59 (Ledger wording), R60, R61 (Ledger), R62 (Model tokens line), R63, R64, R65 (Notices), Q-readability, Q-ste, Q-privacy, Q-offline | [phase-04](phase-04.md) |
| P05 | Handoffs, skill-review skill, cleanup | completed | R55, R56 (not expressible), R62 (Workflow Folder and git signals), R66, R67 (removal, incubate) | [phase-05](phase-05.md) |
| P06 | /apply-observation | in progress | R68, R69, R70, R71, R72, R73, Q-ste | [phase-06](phase-06.md) |

## P06 slices

| # | Slice | Status |
|---|-------|--------|
| S01 | Fix glossary-size baseline | completed |
| S02 | Offer confirmed part changes (apply-list) | completed |
| S03 | Check and restore failed pick (apply-check) | completed |
| S04 | Mark changed, install, and commit Home Repo (apply-finish) | completed |
| S05 | Undo applied Observation (undo-check and undo) | ready |
| S06 | /apply-observation skill | ready |