---
name: pull-work
description: "Pull the next work item from the plan and run the workflow until it is done or the user is needed: clean-tree check, dispatch, commits, gate, critical-code review."
argument-hint: "Optional: the artifact slug when more than one plan is open."
user-invocable: true
---

# Pull Work

Question rules: follow `.github/user-interaction.md`.
Core paths: when the environment variable WORKFLOW_HOME is set (Home layout), read each Workflow Core path written here as follows: .github/skills/ is $WORKFLOW_HOME/.claude/skills/, .github/agents/ is $WORKFLOW_HOME/.claude/agents/, .github/tools/ is $WORKFLOW_HOME/.workflow-core/tools/, .github/hooks/ is $WORKFLOW_HOME/.workflow-core/hooks/, .github/user-interaction.md is $WORKFLOW_HOME/.workflow-core/user-interaction.md; run every command from the Project Repo root and never from $WORKFLOW_HOME. Without WORKFLOW_HOME (copy layout) read the paths as written.

The single entry point for moving a plan forward. Each run checks the working tree, reads `plan.md`'s `Next` line, and runs steps back to back until it reaches a point in Escalate Only, or the active phase completes. Never wait for "go ahead" between steps; the `Next` line is the instruction.

Formats live with `work-planner`: [PLAN-FORMAT](../work-planner/references/PLAN-FORMAT.md) and [PHASE-FORMAT](../work-planner/references/PHASE-FORMAT.md). Planning modes (Plan, Phase Review, Revise) live in [work-planner](../work-planner/SKILL.md); load that skill when `Next` routes there, then continue here.

Required input: `.workflow/language.md` (product vocabulary).

## Preflight

Arguments are parsed first by `node .github/skills/pull-work/scripts/parse-args.mjs <arguments>`, which prints JSON with `slug` and `bug`; exit 2 shows the usage line `/pull-work [<slug>] bug: <description>` and stops with no question and no change. With `bug` set, Preflight and the spec reconcile run first, then load `work-planner` and run Defect mode. With `bug` set and no plan for the slug, or no plan at all, report that and change nothing.

Run these as commands, not reasoning.

1. Run `node .github/skills/pull-work/scripts/glossary-check.mjs`. Exit 2 stops with its message, `Missing required Glossary at .workflow/language.md. Run /brain-storm to establish it before continuing with /pull-work.`, and changes nothing.
2. Find `.workflow/plans/*/plan.md` files whose `Next` is not `done`. Use the argument's slug, the only open plan, or ask which one (one question, listing each plan's `Next`). With no plan: no spec in `.workflow/specs/` means redirect to `brain-storm`; a spec without a plan means load `work-planner` for Plan mode.
3. `git status --porcelain` lists only work the selected plan expects in flight:
   - `Next: phase review PNN`: the `Acceptance tests` paths of the active phase's `planned` cards, which are tests awaiting approval. Resume Phase Review by presenting their existing diff; don't author them again.
   - `Next` includes `running SNN`: `plan.md` and the `Files` of those slices, which are partial work from an interrupted run. Resume Dispatch.
   - Anything else was made outside the workflow, because the workflow commits everything it writes. Stop and show the files grouped by folder, then recommend `/conventional-commit` for finished work or `git stash` for experiments. Never commit, stash, or discard them yourself.

Plan candidates come from `node .github/skills/pull-work/scripts/reconcile-check.mjs candidates`: open plans, `done` plans whose spec changed, and specs with no plan. After selecting a plan, run `node .github/skills/pull-work/scripts/reconcile-check.mjs status <slug>`; on `changed`, load `work-planner` and run Reconcile mode before routing on `Next`.

## Route

| `Next` | Step |
|---|---|
| `plan PNN`, `phase review PNN`, `blocked SNN` | load `work-planner`; run Plan, Phase Review, or Revise |
| `PNN S..`, `running ...` | Dispatch |
| `fixture repair SNN` | Fixture Repair |
| `gate PNN` | Gate |
| `review PNN` | Review |
| `triage PNN` | Triage |
| `done` | report that the plan is complete |

After each step, re-read `Next` and route again. Stop when:

- the next step needs the user (Escalate Only); ask the one question and wait
- a phase just completed; give the phase brief and tell the user that `/pull-work` in a fresh session plans the next phase, because a new session costs less than carrying this one's context
- `Next` is `done`

## Commits

Commit at every transition, without asking: an approval, a passing gate, or a completed slice is the permission. Stage only the transition's paths, never `git add -A`. Every commit also carries the `.workflow/` files the transition changed (`plan.md`, the phase file, new ADRs), except that lock commits hold `plan.md` back for the follow-up commit. Messages follow [conventional-commit](../conventional-commit/SKILL.md)'s Message Rules, with the plan's slug as scope.

| Transition | Paths besides `.workflow/` | Message |
|---|---|---|
| Plan, Revise, or tests ready for review | the tests awaiting review stay uncommitted | `docs(<slug>): plan PNN`, `docs(<slug>): revise SNN` |
| Phase Review approved | the reviewed cards' `Acceptance tests` (without `plan.md`) | `test(<slug>): lock PNN acceptance tests` |
| then | none; `plan.md` records that commit as `Tests locked` | `docs(<slug>): start PNN` |
| slice completed | the card's `Files` | `feat(<slug>): <slice name>`; `fix` for `fix` cards; `build` for setup cards |
| Fixture Repair passed | the card's `Acceptance tests` (without `plan.md`) | `test(<slug>): repair fixtures for SNN` |
| then | none; `plan.md` records that commit as `Tests locked` | `docs(<slug>): relock tests after SNN` |
| Fixture Repair failed, gate or review routed to triage, phase completed | none | `docs(<slug>): <what changed>` |
| Reconcile spec | none | `docs(<slug>): reconcile spec` |
| Defect planned | none | `docs(<slug>): plan fix PNN` |

Moving the lock takes two commits because a commit cannot record its own hash. Once a transition's commits are done, `git status --porcelain` may list only the `Files` of other slices still `in progress`. Anything else means a slice wrote outside its `Files`: revert those paths and set that slice `blocked`.

Clean handoff: every stop leaves `git status --porcelain` empty, except the tests awaiting approval at Phase Review (Preflight).

## Dispatch (`Next: PNN S..` or `running ...`)

One card at a time per implementer; never fold several cards into one pass. For each slice listed in `Next`:

1. If the slice is `running` from an interrupted run, or returns to `ready` after being `blocked`, run its materialized `Done when` command first. Exit 0 goes straight to step 5. Otherwise, skip the `create`-path check below, since partial work may exist, and re-dispatch noting that.
2. Run the card's Pre-Dispatch Check (PHASE-FORMAT). On a miss, set the slice `blocked`.
3. Materialize the `Done when` command (PHASE-FORMAT) and set the slice `in progress`.
4. Route by `Tier`:
   - `delegate`: send the card verbatim to `coder`, adding only the materialized command. `delegate` cards whose `Files` don't overlap run in parallel.
   - `main`: implement it yourself in this session, under the rules in `.github/agents/coder.agent.md`.
5. Verify with commands: rerun the materialized command (exit 0 with the expected test count), and run `git diff --exit-code <Tests locked> -- <Oracle>` to catch locked-test edits made through a shell. Any failure is a stop (below).
6. For a passing `delegate` card, run `node .github/skills/pull-work/scripts/fixture-leak.mjs --spec <spec> --tests <card's Acceptance tests> --src <card's Files>`. Exit 1 sets the card's `Review` to `required - test literal in product code`; the slice still completes.
7. Set the slice `completed`, recompute `Next`, and commit.

A `coder` stop climbs one rung at a time: first you take the card over once as `main`, then Revise in `work-planner`, and the user only through Escalate Only. An oracle change found in step 5 is restored to `Tests locked` and counts as a stop.

When a `Scope: fixture` card is `planned`, set `Next: fixture repair SNN` for the lowest such card before dispatching slices that wait on it. When nothing is `ready` or `in progress` and other `planned` cards remain, set `Next: phase review PNN`. When every slice is `completed`, set the phase `gating` and `Next: gate PNN`.

## Fixture Repair (`Next: fixture repair SNN`)

This step repairs a fixture and never changes what a test expects. It does not involve the user.

1. Restore the card's `Acceptance tests` paths to `Tests locked`, then dispatch `test-author` with the card, the `Harness` lines, the spec path, and `.workflow/language.md`.
2. Run the Fixture Repair Check (PHASE-FORMAT).
3. Dispatch `test-reviewer` with the card, the spec path, `.workflow/language.md`, and the `Tests locked` ref.
4. If both pass, commit the card's paths, then set `Tests locked` to that commit, the card `completed`, the slices it unblocks `ready`, recompute `Next` (the next pending `Scope: fixture` card first), and commit. If either fails, restore the paths to `Tests locked`, set the card's `Scope` to `assertion`, put the reviewer's report on the card, set `Next: phase review PNN`, and commit.

`small` lane: you write the repair, there is no lock to diff or move, and `test-reviewer` reviews the change against `HEAD`.

## Gate (`Next: gate PNN`)

Run every step of the phase header's `Gate` commands on every Gate pass (including after a review-driven `fix` card; never skip traceability or lock checks). The `small` lane runs only the first:

1. full suite passes, excluding only the `Known failures` listed with an owning phase
2. traceability: every scenario ID owned by this phase's cards has a tagged test that ran and passed; every failing test is a `Known failures` entry of this phase whose owner is a later phase
3. locked oracle files are unchanged since the lock ref
4. mutation testing, scoped to files the phase changed; a mutation line `unsupported for <stack>` is skipped and counts as passed

For this repository's Gate, `node .github/tools/workflow-core/scripts/trace.mjs --phase-file <phase file> --skip-pattern` prints the pattern for the suite step's `--test-skip-pattern`, so steps 1 and 2 exclude the same tests.

Pass sets `Next: review PNN`. Any failure or survivor sets `Next: triage PNN`.

## Review (`Next: review PNN`)

Reviews only critical code, once per phase, after the gate passes. Critical cards carry `Review: required` (PHASE-FORMAT defines the criteria).

1. Without a `Review pending` line in `plan.md`, this is the phase's first pass: write `Review pending:` with every `Review: required` card ID. If the list is empty, complete the phase (last paragraph). Collect the pending cards' `Files`.
2. Dispatch the `code-review` agent with `git diff <Phase base>..HEAD -- <those files>`, the spec path, and each card's `Decisions`. On a re-review pass (when `Review pending` holds only review-driven `fix` cards), also pass the current file contents at `HEAD` so the reviewer verifies the fixed state rather than re-flagging resolved findings. Ask only for high-confidence defects: bugs, security and trust-boundary flaws, resource or data loss, and shared structures that later cards will misuse.
3. Classify each finding:

| Finding | Action |
|---|---|
| behavior that violates the spec and a scenario should catch | Revise: a `build` card owning a new scenario for it; `Next: phase review PNN` |
| defect no black-box test can express (injection, leak, unsafe I/O, misleading shared structure) | `fix` card, `Restores: review - <finding>`, `Done when` is the full suite; Dispatch it |
| code is right but the spec is wrong or silent | redirect to `behavior-spec` |
| style, naming, or preference | drop it |

After classifying, replace `Review pending` with only the review-driven `fix` cards, so the next pass after the gate reviews just those. With no actionable finding, remove the `Review pending` line, record any cross-phase reminders under `Carry-forward` in `plan.md` (not only in the brief), set the phase `completed`, set `Next: plan PNN+1` (or `Next: done` once every requirement and quality threshold in the spec has a passing scenario), and commit. Before the completion commit, run `node .github/skills/pull-work/scripts/plan-check.mjs <slug> PNN` and fix every line it prints; it checks that `plan.md` shows PNN completed, has no PNN slice table or `Review pending` line, and lists exactly the uncovered IDs in its gap (`none` when `Next: done`).

## Triage (`Next: triage PNN`)

Classify each gate finding, then act:

| Finding | Action |
|---|---|
| failing test of a completed slice, only extra output from this phase's Rules, fixture breaks a further spec rule | `test-fix` card with `Scope: fixture`; Fixture Repair |
| any other failing test of a completed slice | `fix` card; `Restores` that scenario ID |
| owned scenario ID with no test that ran and passed | `fix` card if the test exists but fails; Revise if the test is missing |
| oracle file changed since the lock | report to the user; never write a card that accepts the change |
| surviving mutant a scenario should have caught | `test-fix` card; `Restores` that scenario ID and names the mutant |
| surviving mutant in code no scenario covers | Revise: add the missing scenario, or remove dead code |
| wrong slice boundary, missing behavior, or spec gap | Revise, or redirect to `behavior-spec` for a spec gap |

Group findings that share a root cause into one card, and continue the `S` numbering. Add each card to the slice table as `planned` and set the phase back to `in progress`. Set `Next: fixture repair SNN` when only `Scope: fixture` cards were added, otherwise `Next: phase review PNN`.

## Escalate Only

Bring the user in only for:

- a dirty working tree at Preflight
- which plan to pull, when more than one is open and no slug was given
- Setup-Card Approval and Phase Review: cards, tests, tiers, and `Review` flags
- ADR candidates
- `test-fix` cards with `Scope: assertion`, meaning any change to what a locked test expects
- an oracle file changed since the lock outside an approved path
- a scenario or quality threshold no black-box test can express
- a planning assumption that cannot be grounded

Everything else proceeds without the user and appears in the brief. Spec gaps and new requirements redirect to `behavior-spec` or `brain-storm`. When you ask, follow the rules in `.github/user-interaction.md`: say where the plan stands, why the answer matters, and the options with a recommendation.

Setup-card approval, Phase Review, and an ADR candidate from Revise are Checkpoints: one bundled question, run by the `## Checkpoint` rules in `.github/user-interaction.md`.

## Brief

At every stop, report: slices completed with their commits, fixture repairs, review findings and what became of them, blocked slices with reasons, and the `Next` line. Define any workflow term the user hasn't seen in this session.
