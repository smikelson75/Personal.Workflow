# workflow-core plan

- Spec: [workflow-core-spec.md](../../specs/workflow-core-spec.md)
- Lane: standard
- Next: plan P02
- Tests locked: `4653bee`
- Oracle: `.github/tools/workflow-core/tests`
- Phase base: `8294271`
- Reconciled: `d6d5e19`

## Current state
- stack: Node ES modules (`.mjs`, built-in `node:test`, zero dependencies); the product is markdown skills and agents under `.github/` plus small Node scripts. `C` = `.github/tools/workflow-core`.
- harness: absent for the core; `C/support/harness.mjs` is built by P01 S01. The workflow-check suite `node --test --test-reporter=tap ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` runs (quoted glob).
- suite baseline: green (84 workflow-check tests, 0 failing)
- mutation: unsupported for node - no mutation Language Add-on installed
- in place: six skills (adr-writer, behavior-spec, brain-storm, conventional-commit, pull-work, work-planner), five agents, locked-tests hook, `workflow-check`, `pull-work/scripts/fixture-leak.mjs`; `workflow-check/scripts/trace.mjs` (no Known Failure support)
- gap to spec: R13, R14, R15, R16, R17, R19, R20, R21, R22, R23, Q-clean-handoff, Q-checkpoint-cost

## Decisions pinned by the plan
- tests read skill and agent text only through stable markers: paths, commands, commit templates, `- **Label:**` or `Label:` line starts, headings. Never whole sentences.
- scripts live beside the skill that runs them (`.github/skills/<skill>/scripts/`); the test support lives outside the oracle at `C/support/` so it is not locked.
- plan header gains a `Reconciled` line holding a commit sha (R20); phase-header `Known failures` entries are written `` `<test title>` - owner PNN `` (R14).
- the companion workflow-check spec's amended rules (R2, R11, R18, and R16 pairs for it) are planned in the workflow-check plan when `/pull-work` reconciles it after P03; this plan does not edit that plan.
- P01 and P03 edit the same skill files; cards that share a file depend on each other and never run in parallel.

## Phases

| # | Phase | Status | Covers | Detail |
|---|-------|--------|--------|--------|
| P01 | Interaction rules and stage commits | completed | R22, R23 (rules file and references), R13, R19 | [phase-01](phase-01.md) |
| P02 | Gate and plan scripts | planned | R14, R15, R17 | |
| P03 | Reconcile, defects, pair coverage | planned | R20, R21, R16, Q-clean-handoff, Q-checkpoint-cost | |

## P01 slices

| # | Slice | Status |
|---|-------|--------|
| S01 | Core test harness and trace script | completed |
| S02 | User-interaction rules file | completed |
| S03 | Skills and agents refer to the rules file | completed |
| S04 | Checkpoint references in work-planner and pull-work | completed |
| S05 | planner commits and hands back | completed |
| S06 | brain-storm commits its output | completed |
| S07 | behavior-spec commits its output | completed |
