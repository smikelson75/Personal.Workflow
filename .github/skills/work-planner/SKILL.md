---
name: work-planner
description: "Turn the behavior spec into a phased plan of thin vertical slices, each with pre-written acceptance tests and a closed-world card a weaker model can execute."
argument-hint: "Say what to plan (e.g. 'plan v1', 'S03 stopped: ...'). Use /pull-work to move a plan forward."
user-invocable: true
---

# Work Planner

Question rules: follow `.github/user-interaction.md`.

After `behavior-spec`, plan the gap between the repo as it is and the spec's target. Deliver it as phases of thin vertical slices. Each slice closes when its pre-written acceptance tests pass.

Formats: [references/PLAN-FORMAT.md](references/PLAN-FORMAT.md) and [references/PHASE-FORMAT.md](references/PHASE-FORMAT.md). Artifacts live in `.workflow/plans/<artifact-slug>/`; the slug matches the spec's.

This skill owns the planning modes: Plan, Phase Review, and Revise. Execution (Dispatch, Fixture Repair, Gate, Review, Triage), commits, and the list of times the user is asked live in [pull-work](../pull-work/SKILL.md), which loads this skill when `Next` routes to planning and continues after it. Invoked directly, run the requested mode, then tell the user `/pull-work` continues from `Next`.

## Roles

Run this skill in the main session. The main session holds the conversation and runs every mode, so the user never switches agents. It delegates only when a subagent costs less than doing the work in place: every subagent start reloads its instructions and re-reads its inputs, so it pays off only for bulk reading or for cheap-model volume work. Anything deterministic goes to commands that spend no tokens.

| Role | Runs as | Job | Writes |
|---|---|---|---|
| main session | the user's chosen model | every mode; `main` cards; tests for small phases | `plan.md`, `phase-NN.md`, statuses, lock ref |
| `repo-scout` | agent, cheap | read-only survey; returns a fact sheet | nothing |
| `test-author` | agent, mid | failing acceptance tests for one card; fixture repairs | test files, fixtures |
| `test-reviewer` | agent, mid | approves or rejects one fixture repair | nothing |
| `coder` | agent, cheap (a local model once configured) | makes one `delegate` card's tests pass | product code |
| `code-review` | built-in agent | reviews `Review: required` cards once per phase | nothing |
| `planner` | agent, strongest; optional | Plan mode for a large or architecture-heavy first plan | `plan.md`, `phase-NN.md` |

The main session never reads the repo broadly. It asks `repo-scout` specific questions and plans from the fact sheet, opening a file only to pin a decision the fact sheet leaves ambiguous or to implement a `main` card.

The `planner` agent is opt-in: the user picks it when a first plan needs the strongest model. It runs Plan mode with the user directly; every later mode returns to the main session.

## Lanes

Pick the lane in Plan mode and record it on `plan.md`'s `Lane` line.

- `small`: the whole change fits in at most 2 slices, adds no new product interface, and raises no ADR candidate. One phase. The main session writes the acceptance tests itself, there is no lock ref, and the gate is the full suite only.
- `standard`: everything else.

Move a `small` plan to `standard` as soon as any condition stops holding, and tell the user.

## Inputs

1. `.workflow/language.md`
2. `.workflow/specs/<artifact-slug>-spec.md`
3. `.workflow/plans/<artifact-slug>/plan.md` and the active `phase-NN.md`, if present
4. `.workflow/adr/` (Plan and Revise only): the title and `Status` line of each file; open a body only when its title touches what you are planning

Read session files only when the spec links one for a specific answer.

Stop and redirect to `behavior-spec` when the spec is missing, has a blocking `Open Decision` for a requirement you would plan, or contradicts the glossary. Stop and redirect to `brain-storm` when the user's direction adds a requirement.

## Contract

- The spec is the target; this skill owns all current-state truth, sequencing, and the implementation decisions in the spec's `Left To Planning`.
- Never edit the spec, sessions, or glossary. A discovery that changes observable behavior redirects to `behavior-spec`; anything else lands in the plan.
- Do not reopen settled product decisions. Ask the user only for what pull-work's Escalate Only lists.
- End every mode by committing what it wrote, per pull-work's Commits table. Approval is the permission; never ask again before committing.
- Never contradict an `Accepted` ADR silently: either follow it, or raise a superseding ADR candidate.
- Write current truth only; no history, no proposals.
- Checkpoints (setup-card approval, Phase Review, an ADR candidate from Revise with no Phase Review after it) are each one bundled question, run by the `## Checkpoint` rules in `.github/user-interaction.md`.

## Modes

Pick the mode from the request and `plan.md`'s `Next` line.

### Plan (`Next: plan PNN`, or no plan yet)

1. Validate inputs.
2. Dispatch `repo-scout` with concrete questions: stack and build/test commands; full-suite baseline (pass, or the failing tests); whether a harness can drive the spec's product interfaces and whether it runs; existing code each requirement touches; candidate pattern pointers.
2a. Run `node .github/skills/work-planner/scripts/mutation-addon.mjs <stack>` and copy its output line into Current state and each phase Gate's mutation line; ask the Developer nothing about mutation. A mutation Language Add-on is a skill under `.github/skills/` whose `SKILL.md` has the lines `- **Mutation stack:** <stack>` and `- **Mutation command:** <command>`; one installed later takes effect at the next Plan mode.
3. Write or update `plan.md`: lane (see Lanes), current state, gap, phase roadmap. Shape phases around end-to-end value. On a new plan, map every requirement and every quality threshold to a phase.
4. Write the active `phase-NN.md`: header, then every card (see Slicing).
5. If the harness or the suite baseline needs work, the phase opens with setup cards, which run before any test authoring. Present them, their tiers, and any `ADR candidates` to the user. On approval, record approved candidates (see ADR Gate), set the setup cards `ready`, the phase `in progress`, `Phase base` to `HEAD`, and `Next: PNN S01`. Otherwise set `Next: phase review PNN`.
6. Commit `plan.md` and the phase file, then continue straight into Phase Review when `Next` says so; don't ask whether to start it.

### Phase Review (`Next: phase review PNN`)

1. Get failing acceptance tests for every `planned` card with scenarios, and the test diff for every `planned` `test-fix` card with `Scope: assertion`. Give each card its own test file paths, and pass the spec path and `.workflow/language.md` with each card.
   - `small` lane, or at most 2 such cards: write them yourself, following the rules in `.github/agents/test-author.agent.md`.
   - Otherwise: dispatch `test-author` once per card, in parallel.

   Record the test paths in each card's `Acceptance tests`.
2. Commit `plan.md` and the phase file (the tests stay uncommitted), then present to the user in one checkpoint: the cards, the tests (or the test diff for test-fix cards), proposed tiers and `Review` flags with their one-line reasons, any `ADR candidates`, and any scenario that could not be expressed as a black-box test. Define `delegate`, `main`, and `Review: required` in plain words the first time they appear in a session.
3. On approval, record approved ADR candidates (see ADR Gate), set the phase to `in progress`, reviewed `test-fix` cards with `Scope: assertion` to `completed` (their work is the approved diff), and the other reviewed cards to `ready`. `Scope: fixture` cards stay `planned` for Fixture Repair. In the `standard` lane, commit the tests, then move the lock ref and set `Phase base` to that commit when the phase is just starting (see PLAN-FORMAT and pull-work's Commits). Set `Next` (a pending `Scope: fixture` card comes first) and hand back to `pull-work`, which continues in the same turn.

### Revise (`Next: blocked SNN`)

Edit only the affected cards. If the stop reveals a spec gap, redirect to `behavior-spec`. When the stop is a locked test of a completed slice:

- The test fails only with extra output from Rules this phase adds, and its fixture breaks a spec rule beyond its scenario's fault: add a `test-fix` card with `Scope: fixture` and set `Next: fixture repair SNN`. The blocked slice waits on it.
- Otherwise, if the fix changes what a locked test asserts: add a `test-fix` card with `Scope: assertion` and set `Next: phase review PNN`.
- Otherwise, the new code is wrong: revise the blocked card so it keeps the locked behavior, set it `ready`, and recompute `Next`. The approved tests are unchanged, so no new approval is needed.

Commit the revision (pull-work's Commits), then hand back to `pull-work`.

### Reconcile (spec changed since the plan's reconcile point)

- Trigger: pull-work's `reconcile-check.mjs status <slug>` prints `changed`.
- Plan: Plan mode also writes the `Reconciled` header line.
- Done plan: add a new phase `PNN+1` for the change, completed phases stay `completed`.
- Mid-phase: revise unstarted cards, and completed slices the change invalidates get `fix` or `test-fix` cards.
- No new work: move only the `Reconciled` line and leave `Next` unchanged.
- Redirect: a missing spec file, or a changed requirement with a blocking `Open Decision`, redirects to `behavior-spec` and leaves the plan unchanged.
- Record: set `Reconciled` to `git log -1 --format=%H -- <spec>`, update gap, phases, and cards, and commit `docs(<slug>): reconcile spec`.

### Defect (`/pull-work [<slug>] bug: <description>`)

- Classify: built behavior that breaks the spec becomes fix work; spec silent or wrong redirects to `behavior-spec`; new behavior redirects to `brain-storm`; a redirect leaves the plan unchanged.
- Scenario: the fix card's scenario reproduces the defect and fails before the fix.
- Place: a `done` plan gets a new phase `PNN+1`, otherwise the fix goes into the active phase.
- Next: set `Next: phase review PNN` so the reproducing tests reach the Developer at Phase Review.
- Card: a `build` card owns the scenario and its Goal is `Defect: <description>` with the description verbatim.
- Commit: `docs(<slug>): plan fix PNN`.

## Slicing

- One slice is one observable behavior, thin through every layer it touches. If a slice needs two behaviors to be useful, resplit.
- Every scenario has exactly one owning card. IDs: `R<n>-<nn>` for requirements; `Q-<short-name>` for quality thresholds. They are stable across phases.
- Pair coverage: derive at least one scenario for every pair of a spec rule and a capability it governs (a Rule ID, command, skill, agent, or product interface; a class rule governs each enumerated member). The card that adds a capability owns the scenarios for every earlier rule that governs it. A rule about skill or agent behavior is tested through stable markers (commands, commit templates, file paths, labels); a pair with no stable marker and no other black-box test is presented at Phase Review and listed in the phase file's `Not expressible` line, never dropped.
- Derive scenarios from the spec's rules, failure outcomes, examples, and quality thresholds: at least one per failure outcome and per destructive, security, or validation rule. Use the spec's concrete values. A threshold no black-box test can measure goes to the user at phase review, never silently dropped.
- Acceptance tests drive the product boundary (the spec's `Product Interfaces`: CLI, API, file format). Add browser or multi-service E2E only when that boundary is a UI or a deployment. Unit tests are the coder's choice, never a gate.
- Setup cards (harness, suite repair) have no scenarios and run before test authoring. Scope legacy test debt to what this phase needs; list the rest as `Known failures` with an owning later phase.
- Pin every decision a weaker model would otherwise make: names, signatures, data shapes, error categories, file locations. A card with an open design choice is not ready.
- Keep a card under ~60 lines. If it needs more, the planning isn't finished; split or pin more.
- Propose a tier per card with a one-line reason. `delegate` (the default) goes to the cheap `coder` agent: the card follows an existing pattern and its Decisions pin everything. `main` means the main session implements it, and is only for cards that create structure later cards build on (module layout, a registry or framework, a core data model) or that need judgment the card can't pin. Setup cards are `main`. The user confirms tiers at phase review.
- Mark each card `Review: required - <criterion>` or `Review: none`. A card is critical, and gets code review once the phase's gate passes, when it:
  - touches security, secrets, authentication, or permissions
  - performs destructive work: overwrites or deletes files, runs git operations, migrates data
  - crosses a trust boundary: parses untrusted input, spawns processes, makes network calls
  - creates a shared structure later cards build on
  - changes a public interface or a persisted format
  When the plan's mutation testing is unsupported, every `main` card is also `Review: required - no mutation gate`, because review is then the only check on the code beyond the tests. The user confirms the flags with the tiers.

## ADR Gate

Before finishing Plan or Revise, test each newly settled sequencing or architecture decision: hard to reverse, surprising without context, and a real trade-off among genuine alternatives. If all three hold, add it to `plan.md`'s `ADR candidates` (PLAN-FORMAT). Otherwise skip silently. A plan choice that reverses an `Accepted` ADR is always a candidate and names the ADR it supersedes.

Candidates go to the user at the next checkpoint (setup-card approval or phase review). If a Revise raises one and no phase review follows, ask the user before setting the affected card `ready`.

- Approved: load the `adr-writer` skill, write the ADR, and drop the candidate from `plan.md`.
- Rejected: the decision itself is rejected. Drop the candidate and revise the cards that relied on it before they are approved.

## Exit

Write only when every card you touched is dispatch-ready or its gap is a question you are asking. Otherwise ask the next blocking question and do not write.

Return a brief: status changes, cards added or revised, tests written, tiers and `Review` flags awaiting confirmation, ADR candidates awaiting approval, ADRs written, commits made, and the `Next` line. The artifacts are durable; the brief is disposable.
