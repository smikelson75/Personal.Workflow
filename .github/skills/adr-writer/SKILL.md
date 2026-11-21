---
name: adr-writer
description: "Record an approved, hard-to-reverse architecture decision and its trade-offs as an ADR in .workflow/adr/."
argument-hint: "Describe the decision and the alternatives considered, or name the ADR candidate in plan.md."
user-invocable: true
---

# ADR Writer

Question rules: follow `.github/user-interaction.md`.

Record why a hard-to-reverse build decision was made, so a later planning run or a future reader does not undo it unknowingly. An ADR (Architecture Decision Record) is a point-in-time record, not a living document.

## Where It Fits

`work-planner` owns architecture, libraries, and sequencing, but its plan holds current truth only, so the reasoning behind a choice disappears once the phase moves on. ADRs keep that reasoning.

- **Producer**: the `work-planner` skill, in the main session (or the optional `planner` agent). Its ADR Gate lists candidates in `plan.md`, you approve them at the next checkpoint, and the same session loads this skill to write the approved ones. It holds the decision context, so no other agent is involved.
- **Reader**: `work-planner` only, in Plan and Revise (see its Inputs). No other stage reads ADRs.
- **Ad hoc**: you may invoke this skill directly to record a decision made outside planning. Invoking it counts as approval.

## When To Write One

Write an ADR only when all three hold:

1. **Hard to reverse**: changing course later costs meaningful rework.
2. **Surprising without context**: a future reader would wonder why it was done this way.
3. **Real trade-off**: genuine alternatives existed and one was chosen for specific reasons.

If any is missing, skip it. Routine or easily reversed choices do not get an ADR.

## Contract

- Write only approved decisions: an approved `ADR candidates` entry in `plan.md`, or a direct user invocation.
- An ADR holds a build decision only. Vocabulary belongs in `.workflow/language.md`, observable behavior in the spec, sequencing and status in the plan.
- Never edit an accepted ADR's body. A changed decision gets a new ADR that supersedes the old one; the old file's `Status` line is the only part ever changed.
- Lazy creation: do not create `.workflow/adr/` until the first ADR is written.

## Naming

- Path: `.workflow/adr/NNNN-<slug>.md`, zero-padded sequential numbering starting at `0001`.
- `<slug>` is a short kebab-case description of the decision.

## Inputs

1. The `Status` line and title of every file in `.workflow/adr/`, to continue numbering and catch a duplicate or contradicting decision. Open a body only when its title overlaps this decision.
2. The approved candidate in `plan.md` (decision, alternatives, reason), or the user's description when invoked ad hoc.

## Workflow

1. Confirm the three-part test holds. If not, say so and stop without writing.
2. If an accepted ADR covers the same decision, stop: this is either a duplicate (skip) or a reversal (supersede, step 4). Ask the user which, if the candidate does not say.
3. Write `.workflow/adr/NNNN-<slug>.md` using [references/ADR-FORMAT.md](references/ADR-FORMAT.md).
4. When superseding, set the old file's status line to `Status: Superseded by NNNN` and add `Supersedes: MMMM` to the new one. Do not touch the old file's body.

## Exit

Return one line per ADR written: path and the decision in one sentence. The ADR file is the durable artifact; the chat summary is disposable.
