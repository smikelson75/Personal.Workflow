---
description: "Review recent /incubate sessions against the signal tracker and topic rollup in docs/research/incubate-session-review.md"
argument-hint: "Optional session IDs, date, or count (defaults to unreviewed /incubate sessions since the last logged entry)"
---

Review recent `/incubate` sessions against [docs/research/incubate-session-review.md](../../docs/research/incubate-session-review.md).

## Target Sessions

- If the user specified session IDs, a date, or a count, review those `/incubate` sessions.
- Otherwise, find all `/incubate` sessions created after the latest session logged in `docs/research/incubate-session-review.md` (via session history / `list_sessions` and local `events.jsonl`).

## Evidence to Collect

For each session, read its `events.jsonl` and any updated `.workflow/incubations/<slug>.md` note—do not guess metrics from summaries:

1. **Exact metrics (main agent vs. subagents separated):**
   - Model and reasoning effort, billing/usage records (`session.usage_record`), main input tokens + cache-read %, main output tokens + reasoning %, output tokens per user turn, visible main prose chars, and per-call tool-schema count/tokens.
   - Total duration **and active duration** (note any long idle gaps).
   - Tool counts: `ask_user`, `web_fetch` (main vs. subagent), `task` subagents, and how the note was written/committed.
2. **Transcript & note checks:**
   - All Section 6A **Hard signals** (`ask_user`, steering reminder count, repeated unchanged recaps/diagrams, direct user questions answered visibly first, Pick Up Here checked on resume, note saved & committed cleanly, unverified claims or truncated outputs labelled verified/settled).
   - Check pre-tool `assistant.message` blocks for leaked/hallucinated turns or duplicate recaps.
   - Check turn endings for double-barreled questions (`"…, and …?"`), prose routing menus (`"A, or B/pause?"`), either/or closing questions, Mermaid/ASCII rendering issues, and user steering commands (`"challenge this"`, `"pause"`, etc.).
   - Check the saved incubation note for epistemic discipline (`Assumptions to verify`, tentative leanings, 80/20 baseline).

## Output Structure

1. **Did it improve?** Direct verdict comparing against prior sessions and the active skill commits in Section 6.
2. **Signal Tracker snapshot** matching Section 6A (Hard) and 6B (Variable).
3. **Topic Rollup check (Section 6C):** Propose `small` / `medium` / `large` size, cumulative active time, decisions settled, and whether any paralysis signal showed up—framed as a conversation to align on together.
4. **What worked & what didn't** (agent side and user side, grounded in timestamps/turns).
5. **Recommendations:** Update status of Section 10 Open Recommendations (close, apply, watch, or propose), separating high-confidence fixes from things to watch.

## Guardrail

- **Report findings only—do not edit files yet.** Wait for confirmation (or a second-opinion comparison) before updating `docs/research/incubate-session-review.md` or `.github/skills/incubate/`.
