# Incubation Format

Living note written and updated in place at `.workflow/incubations/<slug>.md`.

```md
# Incubation - <Topic>

Status: incubating | graduated | dropped
Started: YYYY-MM-DD
Updated: YYYY-MM-DD

## Spark
- What kicked this off (1-3 sentences) and what we are trying to understand.

## Current Mental Model
- Short synthesis of our current leanings—what the idea means to us, separated from any external implementation. Keep unverified assumptions explicitly tentative.

```mermaid
flowchart LR
  %% Keep focused (5-12 nodes); replace or add diagrams as thinking evolves
```

## What Fits vs. What Clashes

| Dimension | External / Initial Idea | Our Context & Take |
| --- | --- | --- |
| ... | ... | ... |

## Tensions & Tradeoffs
- Unresolved frictions, ripple effects on existing workflows/stacks, or competing framings.
- **Simplest 80/20 baseline:** *(Include when the emerging model has multiple moving parts)* What is the lightest version that captures most of the value, and what does the heavier version actually buy over it?
- **Assumptions to verify:** Anything not yet tested in practice (avoid labeling unverified points "settled" or "solved").

## Sources
- [<Title>](<url>) — 1-line summary of what it claims and what mattered to us. (Write `- none` if no external sources were used.)

## Open Threads
- Questions or angles still worth exploring. (Write `- none` when dropped or graduated.)

## Pick Up Here
- One concrete starting point for the next session. (For `incubating` status; omit when `dropped` or `graduated`.)

## Why Dropped
- Why this was set aside and what would need to change to reconsider it. (Include only when `Status: dropped`.)

## Graduation Framing
- Distilled idea, what we are keeping vs. rejecting, and the main questions for `brain-storm`.
- Handoff: `/brain-storm from .workflow/incubations/<slug>.md`
(Include only when `Status: graduated`.)
```

Rules:
- Keep it scannable: update sections in place rather than appending a transcript.
- Use tentative language ("current leanings", "assumptions to verify") for anything not yet validated in practice—never label unverified assumptions "settled" or "solved."
- Include at least one visual (Mermaid diagram and/or comparison table) whenever the idea has moving parts or tradeoffs.
- Never add numbered `R#` Requirements here—those belong in `brain-storm`.
- Never mutate `.workflow/language.md` or `.workflow/sessions/`.
