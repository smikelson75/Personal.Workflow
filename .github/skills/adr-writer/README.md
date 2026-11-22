# ADR Writer

Records why a hard-to-reverse build decision was made, as an ADR (Architecture Decision Record) at `.workflow/adr/NNNN-<slug>.md`. The plan holds current truth only, so without ADRs the reasoning behind a choice is lost once a phase moves on, and a later planning run could undo it unknowingly. See [SKILL.md](./SKILL.md) for the behavior and [references/ADR-FORMAT.md](./references/ADR-FORMAT.md) for the format.

## Where It Fits

It is not a separate stage. It is a side-output of `work-planner`:

1. During Plan or Revise, `work-planner` tests each architecture or sequencing decision: hard to reverse, surprising without context, and a real trade-off. Decisions that pass go to `plan.md` as `ADR candidates`.
2. You approve or reject candidates at the checkpoint you already review (setup-card approval or phase review). Rejecting a candidate rejects the decision, and `work-planner` revises the cards that relied on it.
3. `work-planner` loads this skill and writes the approved ADRs.
4. On later Plan and Revise runs, `work-planner` scans ADR titles and statuses, follows accepted ones, and raises a superseding candidate instead of contradicting one silently.

No other stage reads or writes ADRs. You can also invoke it directly to record a decision made outside planning.

## Recommended Models

When loaded by `work-planner` or the `planner` agent, `adr-writer` runs in that session and inherits its model—no separate pin is needed. When invoked directly to record a standalone decision, use a mid-tier model at `medium` effort, or raise to `high` for major architectural trade-offs.

| Provider  | Model               | Default effort | Raise to `high` when                                          |
| --------- | ------------------- | -------------- | ------------------------------------------------------------- |
| Anthropic | `claude-sonnet-5.5` | `medium`       | Standalone, high-impact architectural decisions with many trade-offs |
| OpenAI    | `gpt-6.1-terra`     | `medium`       | Standalone, high-impact architectural decisions with many trade-offs |
| Google    | `gemini-4-neon`     | `medium`       | Standalone, high-impact architectural decisions with many trade-offs |

### Effort Guidance

- **`low`**: not recommended; trade-offs and consequences tend to become generic.
- **`medium`** (default): produces concise, accurate ADRs from already-settled context.
- **`high`**: useful when invoking `adr-writer` directly to weigh competing architectures before committing to one.

