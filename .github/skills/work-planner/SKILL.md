---
name: work-planner
description: "Turn the behavior spec into a phased plan of thin vertical slices, each with pre-written acceptance tests and a closed-world card a weaker model can execute."
argument-hint: "Say what to do (e.g. 'plan v1', 'phase review', 'run next', 'S03 stopped: ...')."
user-invocable: true
---

# Work Planner

After `behavior-spec`, plan the gap between the repo as it is and the spec's target. Deliver it as phases of thin vertical slices. Each slice closes when its pre-written acceptance tests pass.

Formats: [references/PLAN-FORMAT.md](references/PLAN-FORMAT.md) and [references/PHASE-FORMAT.md](references/PHASE-FORMAT.md). Artifacts live in `.workflow/plans/<artifact-slug>/`; the slug matches the spec's.

## Roles

Run this skill in the main session. The main session holds the conversation and runs every mode, so the user never switches agents. It delegates only when a subagent costs less than doing the work in place: every subagent start reloads its instructions and re-reads its inputs, so it pays off only for bulk reading or for cheap-model volume work. Anything deterministic goes to commands that spend no tokens.

| Role | Runs as | Job | Writes |
|---|---|---|---|
| main session | the user's chosen model | every mode; `cloud` cards; tests for small phases | `plan.md`, `phase-NN.md`, statuses, lock ref |
| `repo-scout` | agent, cheap | read-only survey; returns a fact sheet | nothing |
| `test-author` | agent, mid | failing acceptance tests for one card | test files, fixtures |
| `coder` | agent, cheap or local | makes one `local` card's tests pass | product code |
| `planner` | agent, strongest; optional | Plan mode for a large or architecture-heavy first plan | `plan.md`, `phase-NN.md` |

The main session never reads the repo broadly. It asks `repo-scout` specific questions and plans from the fact sheet, opening a file only to pin a decision the fact sheet leaves ambiguous or to implement a `cloud` card.

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
- Do not reopen settled product decisions. Ask the user only about sequencing, tier confirmation, ADR candidates, and planning assumptions you cannot ground.
- Never contradict an `Accepted` ADR silently: either follow it, or raise a superseding ADR candidate.
- Write current truth only; no history, no proposals.

## Modes

Pick the mode from the request and `plan.md`'s `Next` line.

### Plan (`Next: plan PNN`, or no plan yet)

1. Validate inputs.
2. Dispatch `repo-scout` with concrete questions: stack and build/test commands; full-suite baseline (pass, or the failing tests); whether a harness can drive the spec's product interfaces and whether it runs; supported mutation tool; existing code each requirement touches; candidate pattern pointers.
3. Write or update `plan.md`: lane (see Lanes), current state, gap, phase roadmap. Shape phases around end-to-end value. On a new plan, map every requirement and every quality threshold to a phase.
4. Write the active `phase-NN.md`: header, then every card (see Slicing).
5. If the harness or the suite baseline needs work, the phase opens with setup cards, which run before any test authoring. Present them, their tiers, and any `ADR candidates` to the user. On approval, record approved candidates (see ADR Gate), set the setup cards `ready`, the phase `in progress`, and `Next: PNN S01`. Otherwise set `Next: phase review PNN`.

### Phase Review (`Next: phase review PNN`)

1. Get failing acceptance tests for every `planned` card with scenarios or a test-fix kind. Give each card its own test file paths.
   - `small` lane, or at most 2 such cards: write them yourself, following the rules in `.github/agents/test-author.agent.md`.
   - Otherwise: dispatch `test-author` once per card, in parallel.

   Record the test paths in each card's `Acceptance tests`.
2. Present to the user in one checkpoint: the cards, the tests (or the test diff for test-fix cards), proposed tiers, any `ADR candidates`, and any scenario that could not be expressed as a black-box test.
3. On approval, record approved ADR candidates (see ADR Gate), set the phase to `in progress`, reviewed `test-fix` cards to `completed` (their work is the approved diff), and the other reviewed cards to `ready`. In the `standard` lane, commit the tests and move the lock ref (see PLAN-FORMAT). Set `Next`.

### Revise (`Next: blocked SNN`)

Edit only the affected cards. If the fix changes a decision a locked test asserts, add a test-fix card and set `Next: phase review PNN`. If the stop reveals a spec gap, redirect to `behavior-spec`.

### Dispatch (`Next: PNN S..` or `running ...`)

For each slice listed in `Next`:

1. Run the card's pre-dispatch check (PHASE-FORMAT). On a miss, set the slice `blocked`.
2. Materialize the `Done when` command (PHASE-FORMAT) and set the slice `in progress`.
3. Route by `Tier`:
   - `local`: send the card verbatim to `coder`, adding only the materialized command.
   - `cloud`: implement it yourself in this session, under the same rules as `.github/agents/coder.agent.md`.

On the coder's report, or when you finish a `cloud` card, rerun the materialized command yourself. Exit 0 with the expected test count means `completed`; anything else means `blocked` with the report attached. On resume with a slice `in progress` and no report, rerun the command: exit 0 means `completed`, otherwise re-dispatch the card, noting partial work exists.

When nothing is `ready` or `in progress` and `planned` cards remain, set `Next: phase review PNN`. When every slice is `completed`, set the phase to `gating` and `Next: gate PNN`.

### Gate (`Next: gate PNN`)

Run the phase header's `Gate` commands. The `small` lane runs only the first:

1. full suite passes, excluding only the `Known failures` listed with an owning phase
2. traceability: every scenario ID owned by this phase's cards has a tagged test that ran and passed
3. locked oracle files are unchanged since the lock ref
4. mutation testing, scoped to files the phase changed

Pass means the phase is `completed` and `Next: plan PNN+1`, or `Next: done` once every requirement and quality threshold in the spec has a passing scenario. Any failure or survivor means `Next: triage PNN`.

### Triage (`Next: triage PNN`)

Classify each gate finding, then act:

| Finding | Action |
|---|---|
| failing test of a completed slice | `fix` card; `Restores` that scenario ID |
| owned scenario ID with no test that ran and passed | `fix` card if the test exists but fails; Revise if the test is missing |
| oracle file changed since the lock | report to the user; never write a card that accepts the change |
| surviving mutant a scenario should have caught | `test-fix` card; `Restores` that scenario ID and names the mutant |
| surviving mutant in code no scenario covers | Revise: add the missing scenario, or remove dead code |
| wrong slice boundary, missing behavior, or spec gap | Revise, or redirect to `behavior-spec` for a spec gap |

Group findings that share a root cause into one card, and continue the `S` numbering. Add each card to the slice table as `planned`, set the phase back to `in progress`, and set `Next: phase review PNN`.

## Slicing

- One slice is one observable behavior, thin through every layer it touches. If a slice needs two behaviors to be useful, resplit.
- Every scenario has exactly one owning card. IDs: `R<n>-<nn>` for requirements; `Q-<short-name>` for quality thresholds. They are stable across phases.
- Derive scenarios from the spec's rules, failure outcomes, examples, and quality thresholds: at least one per failure outcome and per destructive, security, or validation rule. Use the spec's concrete values. A threshold no black-box test can measure goes to the user at phase review, never silently dropped.
- Acceptance tests drive the product boundary (the spec's `Product Interfaces`: CLI, API, file format). Add browser or multi-service E2E only when that boundary is a UI or a deployment. Unit tests are the coder's choice, never a gate.
- Setup cards (harness, suite repair) have no scenarios and run before test authoring. Scope legacy test debt to what this phase needs; list the rest as `Known failures` with an owning later phase.
- Pin every decision a weaker model would otherwise make: names, signatures, data shapes, error categories, file locations. A card with an open design choice is not ready.
- Keep a card under ~60 lines. If it needs more, the planning isn't finished; split or pin more.
- Propose a tier per card with a one-line reason: `local` for mechanical work against clear patterns (goes to `coder`), `cloud` for work needing judgment (the main session implements it). The user confirms at phase review. Setup cards are `cloud`.

## ADR Gate

Before finishing Plan or Revise, test each newly settled sequencing or architecture decision: hard to reverse, surprising without context, and a real trade-off among genuine alternatives. If all three hold, add it to `plan.md`'s `ADR candidates` (PLAN-FORMAT). Otherwise skip silently. A plan choice that reverses an `Accepted` ADR is always a candidate and names the ADR it supersedes.

Candidates go to the user at the next checkpoint (setup-card approval or phase review). If a Revise raises one and no phase review follows, ask the user before setting the affected card `ready`.

- Approved: load the `adr-writer` skill, write the ADR, and drop the candidate from `plan.md`.
- Rejected: the decision itself is rejected. Drop the candidate and revise the cards that relied on it before they are approved.

## Exit

Write only when every card you touched is dispatch-ready or its gap is a question you are asking. Otherwise ask the next blocking question and do not write.

Return a brief: status changes, cards added or revised, tests written, tiers awaiting confirmation, ADR candidates awaiting approval, ADRs written, and the `Next` line. The artifacts are durable; the brief is disposable.
