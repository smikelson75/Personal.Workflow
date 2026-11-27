# skill-review plan

- Spec: [skill-review-spec.md](../../specs/skill-review-spec.md)
- Lane: standard
- Next: phase review P05
- Tests locked: `490cb97`
- Oracle: `tests/skill-review`
- Phase base: `490cb97`
- Reconciled: `0c7a2b317a2d2c0d38cf3dfcfc4fc4e86549b2e8`

## Current state
- stack: Node ES modules (`.mjs`, built-in `node:test`, zero dependencies, ADR 0001); node v25.9.0; no root `package.json`.
- harness: `node --test --test-reporter=tap "tests/skill-review/*.test.mjs"` - drives the CLI `.github/tools/skill-review/bin/skill-review.mjs` as a child process against temp Home Repos, Project Repos, and fixture Conversation Logs; `.github/tools/workflow-core/support/harness.mjs` (`tempRepo`, `read`, `lines`) is the only shared test helper; runs (prepare, slice, finish, commit are built; P05 tests fail until built)
- suite baseline: failing: `[R29-01] Glossary defines the 13 added terms` and `[Q-zero-workflow-check-errors]` in `tests/glossary-alignment/p01-s01.test.mjs` (47 Terms, cap 40); 512 of 514 pass
- mutation: unsupported for node - no mutation Language Add-on installed
- in place: `scripts/update-home.mjs` (installs `.github/tools/**` to `.workflow-core/tools/**` and skills to `.claude/skills/**`, prints `Workflow version: <old> -> <new>`), `home/launch.mjs` (sets `WORKFLOW_HOME`), `.github/tools/workflow-check`, `.github/prompts/review-incubate.prompt.md` (removed in P05); `skill-review` CLI (prepare, slice, finish, commit, mark-changed, record-install) with summary, ledger, STE and privacy checks; no Handoff detection, no `skill-review` skill, no apply-observation code
- gap to spec: R55 partial, R56, R62 partial, R66, R67 partial, R68, R69, R70, R71, R72, R73 (R52-R54 gaps are the skill text, P05 S07)

## Decisions pinned by the plan
- One CLI, `.github/tools/skill-review/bin/skill-review.mjs`, does all deterministic work in steps the `skill-review` skill runs around the model: `prepare` (Depth 0; writes only the compact-record file), `slice` (P02; serves one flagged slice and keeps the token totals in the compact record), `finish` (P03-P04, writes records, Executive Summary, and Ledger) and `commit` (P04, commits only `skill-review/` in the Home Repo). The model only judges between them and never opens a Conversation Log. `.github/tools/**` installs to the Home Repo, so the Home layout runs it from `$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs`.
- The Review Record is one JSON file, `<Home Repo>\skill-review\review-record.json` (agent layout, not STE).
- Acceptance tests live in `tests/skill-review/` (not installed into a Home Repo); each test file is self-contained and builds its own fixtures.
- The model writes one judgement file `{cases:[...]}` (one entry per case: Observation match or new `ref`, part, kind or Miss Label, outcome, Fix Filter, cause) and `finish` applies it; `finish`, `mark-changed`, and `record-install` are the only writers of the Review Record. `record-install` evaluates which change commits an install contains with `git merge-base --is-ancestor` in the source checkout it runs in, and stores them, so later runs need no source repo. Chances to recur are counted for skill parts only; Conversation start is the first Log `timestamp`.
- Harness locations are overridable for tests with `SKILL_REVIEW_COPILOT_HOME` (default `~/.copilot`) and `SKILL_REVIEW_CLAUDE_HOME` (default `~/.claude`).

## Carry-forward
- P06: `mark-changed` stores the commit as given without checking it exists in a repo; `/apply-observation` must pass a real commit (a typo leaves the Observation `changed` and never installed).
- P02-P04: real Claude logs hold record types outside CLAUDE_TYPES (e.g. api-request-shape), so they print unknown-record notices; revisit the known-type list if noisy. A skill invoked inside another skill ends the outer use at that start (P01 behavior).
- P06: later code must use compareIds/idText from observations.mjs for Observation IDs; inish writes the Review Record first, then the summary and ledger.
- P06: the baseline glossary-size failures (47 Terms over cap 40) are `Known failures` owned by P06 so P01-P05 gates stay meaningful; raise them to the Developer when P06 is planned (setup card or accept).
- P06: settleChances counts uses of the Observation's part only; a separate Handoff chance count (R58) is not built, and Handoff Observations settle through their part's uses.
- P05: The compact record's handoffs array holds the pair-based Handoff entries (phase-05 Invariants); P06 does not read it.

## Phases

| # | Phase | Status | Covers | Detail |
|---|-------|--------|--------|--------|
| P01 | Prepare finds unreviewed skill uses | completed | R52 (read side), R53 (failure, filter), R54 (read side), R61 (read side), R65, R67 (failure) | [phase-01](phase-01.md) |
| P02 | Depth 0 signals, flags, slices, tokens | completed | R62 (Conversation Log side), Q-model-reading | [phase-02](phase-02.md) |
| P03 | Finish: Observations, lifecycle, installs, Review Record | completed | R54 (write side), R57, R58, R59, R61 | [phase-03](phase-03.md) |
| P04 | Executive Summary, Ledger, STE check, commit | completed | R52 (commit-failed, Reviewed line), R55 (pending count and Ledger listing), R59 (Ledger wording), R60, R61 (Ledger), R62 (Model tokens line), R63, R64, R65 (Notices), Q-readability, Q-ste, Q-privacy, Q-offline | [phase-04](phase-04.md) |
| P05 | Handoffs, skill-review skill, cleanup | planned | R55, R56 (not expressible), R62 (Workflow Folder and git signals), R66, R67 (removal, incubate) | [phase-05](phase-05.md) |
| P06 | /apply-observation | planned | R68, R69, R70, R71, R72, R73 | |


