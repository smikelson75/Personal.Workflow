# Incubation - Session Review

Status: incubating
Started: 2026-11-26
Updated: 2026-11-26

## Spark
- Reviewing workflow skills by hand (one skill at a time, in documents that grow without bound) is unreadable and costly. Starting point: `docs/research/session-review.md` (draft brain-storm capture with R46-R48) and `docs/research/incubate-session-review.md` (the Developer's current hand-kept review of `/incubate`). Goal: a review that uses real past sessions to drive improvement, and that the Developer never writes by hand.

## Current Mental Model
- Current leanings (not verified): the review's real product is an **Executive Summary** the Developer can act on. Signals and quotes are backing evidence only; any number that cannot be translated into a plain statement should not appear.
- The Executive Summary should answer four things: did the skill do its job; what should change and on which side; how it affected the direct downstream skill; how sure we are (one session vs. trend, watching vs. confirmed).
- Findings have more than two sides. The existing hand-kept doc produced model findings (Gemini hallucinated user replies) and harness findings (143 tool schemas per call, Mermaid not rendering) that changed decisions. R46's workflow-vs-Developer split omits them.
- Downstream effect matters as much as in-session behavior. Backfill exists because a skill's handoff value is only visible after the next skill consumes its output.

```text
 Tier 0  extract   script reads log -> signal counts + anomaly timestamps   (no model tokens)
 Tier 1  triage    model reads only: compact record, last column, ledger
 Tier 2  excerpt   model reads log slices only around flagged anomalies
 Tier 3  judge     model writes deltas: findings, status changes, side + reason

 incubate --note--> brain-storm --session--> behavior-spec --spec--> work-planner --cards--> pull-work
     ^                   |
     +-- backfill: what the next skill re-asked, re-verified or discarded
```

## What Fits vs. What Clashes

| Dimension | Existing hand-kept doc (`incubate-session-review.md`) | Our take |
| --- | --- | --- |
| Hard signals (rule compliance counts) | Compact, mechanical, extractable from logs | Keep, but each must map to a plain-language meaning |
| Variable signals (tokens, duration) | Useful only as trend | Keep as trend evidence, never as a verdict |
| Per-session narratives (sections 7-9) | Grows every session; unreadable | Drop; replace with Executive Summary + delta findings |
| Recommendation ledger (target, signal moved, status) | Small and actionable | Keep; add a "watching" state before "confirmed" |
| Change-to-session link ("first session under it") | Present | Keep; it is the only proof a change worked |
| Downstream outcome | Absent; tracker says `incubating` for a note that is `graduated` | Make it the first thing the summary reports |
| Sides | Agent / User, with ad hoc model and harness items | Workflow, model, harness, Developer |
| Definition of "intended" | Implicit in SKILL.md rules | Make explicit: rules in the skill are the rubric |

## Tensions & Tradeoffs
- **Simplest 80/20 baseline:** one extractor, one signal table, one change ledger, short timestamped evidence quotes, and a model that reviews only what the extractor flags. The draft's four lenses, Fix Filter and backfill may be the heavy version; what they buy over this is unproven.
- The tracker went stale: `home-repo-workflow.md` shows `Status: graduated` while the hand-kept doc still lists it as `incubating`. A review that depends on hand upkeep will drift.
- A single session can mislead: the prose-routing-menu finding looked like a skill gap in S4 and was a Gemini habit by S6. Findings need a watching state.
- Observed (git log, session store listing, 2026-11-26): chain incubate (`5f979475`) -> brain-storm (`59364369`) -> behavior spec -> many pull-work sessions, and P04-P06 commits for `home-repo-workflow`. Inferred from titles only; later sessions not read.
- Handoff signal example (my read, ambiguous): brain-storm `59364369` used the note's code findings in its grounding brief, but its Q1 asked for the purpose "fresh", so the Developer restated much of what the incubation held. This may be brain-storm's design rather than an incubate fault.
- Review cost: a full read of a long session (S6: ~4.35M input tokens) is itself expensive; extraction before any model read is how the review stays cheap.
- **Assumptions to verify:**
  - Which sessions the first run covers, and whether it starts from the incubation or from the downstream sessions that consumed it.
  - That session logs on this machine carry enough structure to extract the signals mechanically (the hand-kept doc cites `events.jsonl`).
  - What a trustworthy Executive Summary looks like to the Developer; they did not yet know.
  - Open items from the draft still stand: harness scope (Q4), trigger, success measure, Vocabulary clash between Glossary `Session` and an agent conversation log, writes outside the workspace.

## Sources
- none (local files only: `docs/research/session-review.md`, `docs/research/incubate-session-review.md`, git log, Copilot session store)

## Open Threads
- First-run scope: start from a skill's session or from the downstream sessions that consumed its output.
- What the Developer needs to see to trust a summary without opening the log.
- How the draft's R46-R48 change given model and harness sides and the "watching" state.

## Pick Up Here
- Resume on `claude-opus-5.5`. Decide the first-run scope, using the `/incubate` -> `/brain-storm` -> behavior spec chain for `home-repo-workflow` as the worked example, and sketch what its Executive Summary would say in plain language before any mechanics.
