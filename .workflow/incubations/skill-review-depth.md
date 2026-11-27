# Incubation - Skill Review Depth

Status: incubating
Started: 2026-11-26
Updated: 2026-11-27

## Spark
- The new `skill-review` summaries show almost nothing. The old hand-run `/incubate` reviews ([incubate-session-review.md](../../docs/research/incubate-session-review.md)) surfaced problems the Developer had not thought of and led to real skill fixes. The Developer knows the skills are not perfect, so a quiet summary means the review is blind, not that the skills are clean.
- We are trying to understand what changed between the old and new review, and what a review that "looks under the covers" would need, including for Handoffs and `pull-work` tuning.

## Current Mental Model
- **The new review trades recall for cheapness.** The model may only open log lines a script flags. The script has four flags (`tool-error`, `long-message` > 4000 chars, `many-questions` ≥ 5 form calls, `user-correction` regex on the message start), at most 5 per use, shown ±1 line. Observed in `workflow-home/.workflow-core/tools/skill-review/src/signals.mjs` and `slice.mjs`.
- **What was lost was thoroughness:** a full read of both sides of the log, against the skill's own rules, with quotes and timestamps as evidence, and a tracker across sessions. That thoroughness is what found things the Developer did not think to ask.
- **Our mission's own token definition favours depth.** The new review spent about 98K tokens over 92 conversations and changed about 1 decision. One deep read of a `pull-work` session cost about 268K tokens and produced several decision-grade findings. Useful tokens are the ones that change decisions, not the cheapest ones.
- **The burden of knowing what to look for is the reviewer's, not the Developer's.** The Developer brings "I suspect X" or "look under the hood". The reviewer must confirm or refute with evidence and find what was not asked.
- **Two kinds of evidence:** metrics (tokens, cost units, compaction, subagent split) are best done by a script over all uses, using log fields that already exist. Judgement (rule slips, confusion, restatements, planning misses) needs a full model read of a few chosen sessions.
- **Current leaning for `skill-review <skill>`** (an idea, not a design):

```text
 1 TRIAGE   script, every use of <skill>     cheap: tokens, compaction,
            (log fields, no model reading)   subagents, cost, errors, turns
 2 SELECT   a few sessions, reason stated    "why this one" written down
 3 DEEP     fresh reviewer, full log, the    ~270K tokens per session
   READ     skill's rules at that commit
 4 RECORD   Observations -> existing Ledger  keep apply/undo lifecycle
```

## What Fits vs. What Clashes

| Dimension | Old review (by hand) | New `skill-review` | Our take |
| --- | --- | --- | --- |
| What the model reads | Full log, both sides | Flagged lines ±1 only | Restore full reads for selected sessions |
| Checklist | The skill's own rules as hard signals | None; 4 generic flags | Restore rules-as-signals at the session's commit |
| Evidence | Quotes, timestamps | ≤ 20-word STE, no quotes | Rethink the privacy trade; quotes were the evidence |
| Trend | Per-session tracker | Improved/Same with nothing to compare | Needs a tracker of some kind |
| Ledger, apply/undo, Handoff pairs | None | Present | Keep |
| Metrics (tokens, compaction, cost) | Hand-counted | Not read at all | Script it in triage |
| Cost | High, per session | ~1K tokens per conversation | Spend where decisions change |

## Evidence Gathered (2026-11-26/27)
- **Last `incubate` session:** 8 user turns, flags only on 2 tool errors. The reviewer never saw "I would need to understand more about what these records are describing" or "I honestly don't know what that means". Observed by re-running read-only `prepare incubate`.
- **All 12 Ledger Observations have `Side: none`.** 10 are tool/plumbing slips; the one conversation finding (O10) came from the Developer.
- **Copilot `pull-work` logs (72 sessions that invoked it):** all 4 compactions were on Sonnet at about 160K of a 200K window. Opus reports a 952K prompt limit and never compacted. The main chat used about 84% of tokens, at about 95K input per call, with about 20.7K of tool definitions per call. Opus made 19% of main-chat calls but about 78% of `cost` units (inference: `cost` is the premium multiplier). Main vs. subagent was split by `agentId`, which is not verified as complete.
- **Deep read of the P06 `pull-work` session** ([pull-work-session-review-p06.md](../../docs/research/pull-work-session-review-p06.md)):
  - Two spec → plan misses: W5 missed locked test R43-03, which the changed spec invalidates; W6 had a card decision that contradicts spec line 40. These caused the most expensive rework.
  - The compaction at 161K was followed within 47 s by a denied locked-test edit and `git add -A`. Raw log timestamps were checked; the causal link is an inference.
  - `repo-scout` was skipped, and 5 of 7 test-authors could not open the 23 KB phase file.
  - No `hook.start` events carry a subagent ID, although subagents made 100 tool calls.
  - Second coder: a Sonnet-tier coder is about break-even, Opus worse, Haiku cheaper. **None avoids compaction**; the context growth came from Plan (+78K) and Phase Review (+18K). Ending the session after `start PNN` and dispatching fresh would.
- **Choosing the session was cheap:** local node scripts over the logs, about 3–4K tokens in context. The pick was by judgement with no written rule, biased toward "interesting".

## Tensions & Tradeoffs
- **Cost vs. thoroughness:** about 270K tokens per deep read means selection decides the value. Selecting for "interesting" is good for discovery but not for rates.
- **Privacy vs. evidence:** quotes and paths are the evidence. The permission check blocked pushing the deep review to GitHub.
- **One session vs. trend:** a deep read finds problems; a tracker shows whether fixes held. The old review had both.
- **`pull-work` is unattended by design,** so its evidence is agent behaviour and tokens, not user turns. Incubate and brain-storm evidence is mostly the conversation.
- **Simplest 80/20 baseline:** keep today's Ledger and tooling. Add one triage script and a "deep read this session against its skill's rules" step, run on a few sessions the Developer or triage picks. The heavier version adds automatic selection rules and a cross-session tracker.
- **Assumptions to verify:**
  - Copilot runs no `preToolUse` hooks inside subagents, which would leave `coder` unguarded against locked-test edits. Needs a probe.
  - Every subagent usage record carries an `agentId`.
  - Compaction caused the two rule slips in the P06 session.
  - Claude Code logs carry the same metric fields. The 72 sessions were Copilot only.

## Sources
- none (all evidence local: session logs, the `skill-review` source, and the two review docs linked above)

## Open Threads
- Handoff restatements: a deep read that holds the artifact and the using conversation side by side could tell a restatement (the artifact already said it) from a capture miss (it never did). The labels already exist in `skill-review`; the reading does not.
- `brain-storm` as the next free-flowing skill to deep-read.
- How a deep read's findings feed a cross-session tracker like the old Signal Tracker.
- How to select sessions: by the Developer, by triage rules, or both.
- The no-raw-quotes rule versus evidence quality.
- `pull-work` tuning from the deep review: check locked tests before planning, a fresh session for dispatch, enforced `repo-scout`, and phase files under about 20 KB.

## Pick Up Here
- Ask the Developer where they remember fighting restatements hardest (which plan or step). If nothing comes to mind, use cheap triage to find sessions with many typed user turns after a Handoff, likely `behavior-spec -> work-planner`. Then deep-read one, holding the spec and the using conversation side by side, to see whether this approach catches restatements as well as it caught the `pull-work` findings.
