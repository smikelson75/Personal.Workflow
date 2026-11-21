# workflow-core plan

- Spec: [workflow-core-spec.md](../../specs/workflow-core-spec.md)
- Lane: standard
- Next: gate P03
- Tests locked: `37ff2d5`
- Oracle: `.github/tools/workflow-core/tests`
- Phase base: `37ff2d5`
- Reconciled: `d6d5e19`

## Current state
- stack: Node ES modules (`.mjs`, built-in `node:test`, zero dependencies); the product is markdown skills and agents under `.github/` plus small Node scripts. `C` = `.github/tools/workflow-core`.
- harness: `node --test --test-reporter=tap ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` - drives skill text and scripts through `C/support/harness.mjs`; runs
- suite baseline: green
- mutation: unsupported for node - no mutation Language Add-on installed
- in place: six skills (adr-writer, behavior-spec, brain-storm, conventional-commit, pull-work, work-planner), five agents, locked-tests hook, `.github/user-interaction.md`, `workflow-check`, `pull-work/scripts/fixture-leak.mjs`, `pull-work/scripts/plan-check.mjs`, `work-planner/scripts/mutation-addon.mjs`; `C/scripts/trace.mjs` honors Known Failures (`--tap`, `--phase-file`, `--skip-pattern`); planner, brain-storm, and behavior-spec commit their output
- gap to spec: R16, R20, R21, R23 partial, Q-clean-handoff, Q-checkpoint-cost

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
| P02 | Gate and plan scripts | completed | R14, R15, R17 | [phase-02](phase-02.md) |
| P03 | Reconcile, defects, pair coverage | gating | R20, R21, R16, Q-clean-handoff, Q-checkpoint-cost | [phase-03](phase-03.md) |

## P03 slices

| # | Slice | Status |
|---|-------|--------|
| S01 | Spec change detection script | completed |
| S02 | Reconcile text | completed |
| S03 | Argument parser script | completed |
| S04 | Defect report text | completed |
| S05 | Pair gate in plan-check | completed |
| S06 | Pair coverage text | completed |
| S07 | Clean handoff and Checkpoint cost text | completed |

