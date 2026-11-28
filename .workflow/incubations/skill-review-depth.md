# Incubation - Skill Review Depth

Status: incubating
Started: 2026-11-26
Updated: 2026-11-28

## Spark
- The new `skill-review` summaries show almost nothing. The old hand-run `/incubate` reviews ([incubate-session-review.md](../../docs/research/incubate-session-review.md)) surfaced problems the Developer had not thought of and led to real skill fixes. The Developer knows the skills are not perfect, so a quiet summary means the review is blind, not that the skills are clean.
- We are trying to understand what changed between the old and new review, and what a review that "looks under the covers" would need, including for Handoffs and `pull-work` tuning.

## Current Mental Model
- **The new review trades recall for cheapness.** The model may only open log lines a script flags. The script has four flags (`tool-error`, `long-message` > 4000 chars, `many-questions` ≥ 5 form calls, `user-correction` regex on the message start), at most 5 per use, shown ±1 line. Observed in `workflow-home/.workflow-core/tools/skill-review/src/signals.mjs` and `slice.mjs`.
- **What was lost was thoroughness:** a full read of both sides of the log, against the skill's own rules, with quotes and timestamps as evidence, and a tracker across sessions.
- **Our mission's own token definition favours depth.** Useful tokens are the ones that change decisions, not the cheapest ones.
- **Counts catch loud failures, not quiet ones (tested 2026-11-28, see Evidence).** Triage from counts and sums reliably points at sessions that failed loudly (forms, volume, errors). It did not put S5 (hallucinated user replies, a false denial) in the top 2 on any column set. A hallucination lives in what was said; no count or fixed word list caught it.
- **Current leaning: the Developer picks, helped by two short lists and a random option** (the Developer's proposal, 2026-11-28). No perfect hallucination detector exists, so selection is shared with the Developer and with chance:

```text
 all uses of <skill>, Claude + Copilot
   minus sessions already reviewed for <skill>
        │
        ├── List 1  TRIAGE   top 3 by the best count-based triage, each with "why picked"
        ├── List 2  TOKENS   top 3 by tokens used, most first
        │
        ▼
 Developer picks:  a number from either list   OR   "random" (from either list)
        │
        ▼
 DEEP READ (fresh reviewer, full log, the skill's rules at that commit)
        │
        ▼
 RECORD  Observations -> existing Ledger (keep apply/undo lifecycle)
```

## What Fits vs. What Clashes

| Dimension | Old review (by hand) | New `skill-review` | Our take |
| --- | --- | --- | --- |
| What the model reads | Full log, both sides | Flagged lines ±1 only | Restore full reads for selected sessions |
| Who selects | The Developer, by memory | The script's flags | Two short lists + Developer pick or random |
| Checklist | The skill's own rules as hard signals | None; 4 generic flags | Restore rules-as-signals at the session's commit |
| Evidence | Quotes, timestamps | ≤ 20-word STE, no quotes | Rethink the privacy trade; quotes were the evidence |
| Trend | Per-session tracker | Improved/Same with nothing to compare | Needs a tracker of some kind |
| Ledger, apply/undo, Handoff pairs | None | Present | Keep |
| Metrics (tokens, compaction, cost) | Hand-counted | Not read at all | Script it; it is also List 2 |

## Evidence Gathered
### 2026-11-26/27
- **Last `incubate` session:** 8 user turns, flags only on 2 tool errors. The reviewer never saw "I would need to understand more about what these records are describing" or "I honestly don't know what that means". Observed by re-running read-only `prepare incubate`.
- **All 12 Ledger Observations have `Side: none`.** 10 are tool/plumbing slips; the one conversation finding (O10) came from the Developer.
- **Copilot `pull-work` logs (72 sessions):** all 4 compactions were on Sonnet at about 160K of a 200K window. Opus never compacted. Main vs. subagent was split by `agentId`, not verified as complete.
- **Deep read of P06 `pull-work`** ([pull-work-session-review-p06.md](../../docs/research/pull-work-session-review-p06.md)): two spec → plan misses (W5, W6) caused the costliest rework; compaction at 161K was followed within 47 s by a denied locked-test edit and `git add -A` (causal link inferred); `repo-scout` skipped; no `hook.start` events in subagents.

### 2026-11-28 triage probe (session run under the Assumption Rule)
- **Paper replay (inferred only):** of the hand findings in S1–S6 and P06, triage would keep about 24 spend/shape findings and almost none of the rule/judgement findings that led to fixes.
- **P1 logs (observed):** 10 Copilot sessions invoked `incubate` (script over 439 `session-state` folders, typed `/incubate` or `skill` call). S1–S6 match the review's start times: `bc4d62d8`, `8dcf5bf8`, `8a1dfca9`, `303d1328`, `1e67d797`, `aded70fc`. Decoys: `d4acac2d`, `5f979475`, `8b3edef2`, `120ba52f`. `8b3edef2` and `120ba52f` were already hand-reviewed in [skill-review-design-miss.md](skill-review-design-miss.md), so only 2 decoys were clean.
- **P2 fields (observed):** tokens, reasoning, cache, cost, model, subagents, tool errors, `ask_user`, timestamps all present in `session.usage_record` and other events. No compaction event in any of the 10.
- **P3 numbers (observed, via a fixer agent):** `ask_user`, models and most token counts within 5% of the hand counts. Two rule defects found and reported, not tuned: (a) every typed user message carries `parentAgentTaskId`, so excluding it zeroed typed turns (Developer approved deleting that clause); (b) each log has one `skill.invoked`, so `skill-review`'s use window runs to end of log and takes in resumed sessions (wall time up to 1,421 min; S3 input 2.20M vs 1.57M by hand).
- **P4 blind pick (observed):** 9 fresh Sonnet pickers, one per pre-registered column set (all, drop each of 7 groups, one biased "guess" set), each read only `columns.md` and its own shuffled A–J table. Pass rule (Developer): S5 in top 2 and S1, S2 above every decoy.
  - **0 of 9 sets passed**, under both decoy readings. S1, S2 ranked 1–2 in all 9. S5 ranked 3rd in 7 sets, 6th without conversation columns, 7th without token columns.
  - Every top-2 reason cited `ask_user` forms (S1 13, S2 9) or volume. No picker wrote a reason about S5.
  - Not pre-registered, so a lead only: the top 3 were exactly S1, S2, S5 in 7 of 9 sets (about 1 in 120 by chance).
  - Confound: the sessions ran under different skill versions (`ask_user` banned from `c6fcbb3`, S3 on) and models, so form counts measured the version as much as the failure.
- **Confusion scan (observed):** 29 pre-registered pushback phrases over typed user messages in the same 10 sessions. S5 got 0 hits; only S6 got 1. The Developer did flag S5 in chat ("Where these questions for me?", per the review), but in their own words, which a fixed list cannot predict.
- Probe scripts and tables were throwaway, kept only in the session's job temp folder.

## Accepted Risks
- none. No risk was signed off this session. The use-window tail risk (rule (b) above) was tested by the drop-time and drop-token column sets instead of being accepted: dropping time did not change the top 3.

## Tensions & Tradeoffs
- **Cost vs. thoroughness:** about 270K tokens per deep read means selection decides the value.
- **Counts vs. meaning:** triage is cheap and repeatable but sees only loud failures. Quiet failures need someone to read what was said, either the Developer's memory or a model.
- **Two lists may show the same sessions (inferred).** The pickers' reasons leaned on output volume, so the triage list and the token list probably overlap. The random option is what reaches sessions that look normal.
- **Already reviewed is not recorded in one place (inferred).** Hand reviews live in `docs/research/` and incubation notes; `skill-review`'s Ledger holds Positions for its own reviews only.
- **Privacy vs. evidence:** quotes and paths are the evidence.
- **One session vs. trend:** a deep read finds problems; a tracker shows whether fixes held.
- **Simplest 80/20 baseline:** the Developer's proposal is already close to it: two top-3 lists, a pick or random, then one deep read. The heavier version would add automatic selection rules; the probe gives no evidence that they would beat a random pick.
- **Assumptions to verify:**
  - Claude Code logs carry per-use token counts comparable to Copilot's (needed for List 2 across both harnesses). Not run.
  - "Already reviewed for this skill" can be listed from the Ledger plus a hand-review list. Not run.
  - Excluding reviewed sessions would have surfaced S5: in the all-columns ranking, S5 is first once S1 and S2 are removed (observed ranking; the exclusion is inferred). By tokens it would not be in the top 3 (S5 main input 1.62M; the top 3 were S6 4.35M, `5f979475` 3.38M, S1 2.61M; observed in the first triage run, whole-log window, Copilot only).
  - The `skill-review` use window should end before a resumed session's tail. Not decided.
  - Copilot runs no `preToolUse` hooks inside subagents. Needs a probe.

## Sources
- none (all evidence local: session logs, the `skill-review` source, the two review docs and the design-miss note linked above)

## Open Threads
- Proof of concept of the two-list picker (read-only, built on `skill-review prepare`): what the listing looks like for `incubate` across Claude and Copilot.
- Should "random" draw from the two top-3 lists only, or from every unreviewed use? The probe suggests the quiet failures sit outside the loud top 3.
- A model reading only the Developer's typed messages for confusion (cheaper than a full read). Not run.
- Handoff restatements: a deep read that holds the artifact and the using conversation side by side.
- How a deep read's findings feed a cross-session tracker like the old Signal Tracker.
- `pull-work` tuning from the P06 deep review.

## Pick Up Here
- Build a read-only proof of concept of the two-list picker for `incubate`. First probe the one unobserved input it needs: do Claude Code `incubate` logs give per-use token counts? Then show the Developer the two top-3 lists with "why picked" and the "random" option, and decide whether to graduate to `/brain-storm`.
