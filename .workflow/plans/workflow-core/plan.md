# workflow-core plan

- Spec: [workflow-core-spec.md](../../specs/workflow-core-spec.md)
- Lane: standard
- Next: phase review P04
- Tests locked: `37ff2d5`
- Oracle: `.github/tools/workflow-core/tests`
- Phase base: `37ff2d5`
- Reconciled: `f820ac1`

## Current state
- stack: Node ES modules (`.mjs`, built-in `node:test`, zero dependencies); the product is markdown skills and agents under `.github/` plus small Node scripts. `C` = `.github/tools/workflow-core`.
- harness: `node --test --test-reporter=tap ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` - drives skill text and scripts through `C/support/harness.mjs`; runs
- suite baseline: green
- mutation: unsupported for node - no mutation Language Add-on installed
- in place: six skills (adr-writer, behavior-spec, brain-storm, conventional-commit, pull-work, work-planner), five agents, locked-tests hook, `.github/user-interaction.md`, `workflow-check`, `pull-work/scripts/fixture-leak.mjs`, `pull-work/scripts/plan-check.mjs`, `work-planner/scripts/mutation-addon.mjs`; `C/scripts/trace.mjs` honors Known Failures (`--tap`, `--phase-file`, `--skip-pattern`); planner, brain-storm, and behavior-spec commit their output; pull-work/scripts/reconcile-check.mjs (spec change detection), parse-args.mjs (ug: arguments), and plan-check.mjs pair gate; pull-work, work-planner, and the plan and phase formats carry Reconcile, Defect, and pair-coverage rules; clean-handoff and Checkpoint-cost lines
- gap to spec: R22 allow-list - `[R22-03]` still bans `AGENTS.md` everywhere, but the spec now allows `onboard-project` and `agents-md`; the suite has 1 failure (R22-03)

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
| P03 | Reconcile, defects, pair coverage | completed | R20, R21, R16, R23, Q-clean-handoff, Q-checkpoint-cost | [phase-03](phase-03.md) |
| P04 | AGENTS.md allow-list (spec reconcile) | planned | R22 (allow-list only) | [phase-04](phase-04.md) |

## P04 slices

| # | Slice | Status |
|---|-------|--------|
| S01 | Allow-list test for AGENTS.md | planned |
