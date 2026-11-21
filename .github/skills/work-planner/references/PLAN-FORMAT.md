# Plan Format

Purpose: `.workflow/plans/<artifact-slug>/plan.md` is the routing table and the only status record. A new session resumes from its `Next` line without reading anything else.

Phase files sit beside it as `phase-NN.md` ([format](PHASE-FORMAT.md)).

## Include Always

- link to the spec
- `Lane` line: `small` or `standard` (SKILL.md Lanes)
- `Next` line
- `Tests locked` ref
- current state and gap
- phase table
- slice table for the active phase
- `ADR candidates`, only while any await approval

## ADR Candidates

Decisions that passed the ADR Gate and await the user's approval at the next checkpoint. One bullet each: the decision, the alternatives with why they lost, and `supersedes NNNN` when it reverses an ADR. Remove an entry once its ADR is written or the user rejects it; omit the section when empty.

## Next Line

One line stating what happens next. During execution it can join the parts below with `;`, for example `Next: P02 S05; running S03; blocked S04 - pointer missing`.

- `PNN S03, S04` lists `ready` slices whose dependencies are `completed` and whose `Files` don't overlap each other or any `in progress` slice. They can run in parallel.
- `running S03` lists slices that are `in progress`.
- `blocked S04 - <reason>` lists slices awaiting Revise.
- `phase review PNN` means `planned` cards need tests and user approval.
- `fixture repair S06` means a `Scope: fixture` card runs Fixture Repair without the user.
- `gate PNN` means every slice is `completed`.
- `triage PNN` means the gate failed.
- `plan PNN` means the previous phase completed.
- `done` means every requirement and quality threshold has a passing scenario.

Whoever changes a status recomputes `Next` in the same write.

## Statuses

- phase: `planned`, `in progress`, `gating`, `completed`
- slice: `planned` (card written, not approved), `ready` (approved; tests locked and failing, or a setup card), `in progress`, `completed`, `blocked`

The main session sets every status. Phase and card files carry no status.

## Test Lock

`standard` lane only; a `small` plan writes `Tests locked: none (small lane)`.

`Tests locked` is one plan-wide git ref. The oracle is the union of every card's `Acceptance tests` paths across all phases, including fixtures and test configuration.

At each phase review approval, and after each passed Fixture Repair, the main session:

1. confirms `git diff <current lock> -- <oracle>` touches only the paths of the cards just reviewed or repaired
2. commits those paths
3. moves `Tests locked` to that commit

The gate fails if `git diff --exit-code <lock> -- <oracle>` shows any change.

## Rules

- current truth only; no history
- one line of intent per phase; detail lives in the phase file
- never restate card content; the slice table holds only ID, name, and status
- the slice table covers the active phase only; when a phase completes, drop its slice table and keep its phase row
- future phases need enough intent to plan from later, nothing more

## Skeleton

```md
# <Product> plan

- Spec: [<slug>-spec.md](../../specs/<slug>-spec.md)
- Lane: standard
- Next: P02 S03, S04
- Tests locked: `e4f5a6b`

## Current state
- stack: ...
- harness: <command> - drives <interface>; runs | broken | absent
- suite baseline: green | failing: <tests>
- mutation: <tool> | unsupported for <stack>
- in place: ...
- gap to spec: R4, R6 absent; R2 partial (no failure handling)

## Phases

| # | Phase | Status | Covers | Detail |
|---|-------|--------|--------|--------|
| P01 | <name> | completed | R1, R2 | [phase-01](phase-01.md) |
| P02 | <name> | in progress | R3, R4, Q-latency | [phase-02](phase-02.md) |
| P03 | <name> | planned | R5 | |

## P02 slices

| # | Slice | Status |
|---|-------|--------|
| S01 | <name> | completed |
| S02 | <name> | completed |
| S03 | <name> | ready |
| S04 | <name> | ready |

## ADR candidates
- <decision> - over <alternative> (<why rejected>), <alternative> (<why rejected>)
```
