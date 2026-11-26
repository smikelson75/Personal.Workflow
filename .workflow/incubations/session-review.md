# Incubation - Session Review

Status: graduated
Started: 2026-11-26
Updated: 2026-11-26

## Spark
- Reviewing workflow skills by hand (one skill at a time, in documents that grow without bound) is unreadable and costly. Starting point: `docs/research/session-review.md` (draft brain-storm capture with R46-R48) and `docs/research/incubate-session-review.md` (the Developer's hand-kept review of `/incubate`). Goal: a review that uses real past sessions to improve the workflow, and that the Developer never writes by hand.

## Current Mental Model
- **Purpose:** improve workflow parts (skills, agents, hooks, tools, instructions). Every finding ends at one of three outcomes: a part plus a proposed change; a Developer note with the reason, when no part could nudge a better interaction; or no action, with the outside cause recorded (model habit, harness limit, normal requirements miss).
- **Scope:** a skill's own session plus, when they exist, the downstream sessions that consumed its artifact. Run any time; a missing downstream shows as "pending" and a later run backfills it. A natural cadence is after a phase, when every skill except optional incubate has run.
- **Inputs:** handoff review (effective: no restating, re-verifying, or lost items; efficient: artifact sections never used downstream are artifact no-ops) and health review (skill followed its own rules, Developer contributed rather than being prompt-driven, skill not growing without payoff). Incidents (a reopen, a restatement) are traced on request.
- **Four Tiers are the mission and escalation rule:** never spend model tokens where a script answers; never read log beyond what a flag points to. v1 may merge Tier 1 and Tier 2 as long as nothing reads unflagged log.
- **Output:** a short plain-language Executive Summary (what happened, why, changes proposed with status, Developer note, confidence with evidence pointers) plus one ledger. Grounding comes from repeats over time (watching -> confirmed), not from more signals per summary.
- **Fix Filter (from `retro`):** before proposing a change ask: can a check or script do it; can an existing rule be clarified or removed instead; where does it cost the least context.

```text
 Tier 0  extract   script: logs + artifacts + commits -> signals, flags   (no model tokens)
 Tier 1  triage    model reads compact record only
 Tier 2  excerpt   model reads only flagged slices
 Tier 3  judge     summary + ledger deltas, each through the Fix Filter
 rule: escalate a tier only when the tier below flags it

 inputs: handoff | health | incident (on request)
 finding ──> part + change | Developer note + reason | no action (outside cause recorded)
```

```text
 Miss labels (from the worked example)
 requirements miss   never said, never implied            (normal)
 capture miss        said in conversation, not written    (writing skill)
 translation miss    written, then dropped downstream     (consuming skill)
 decomposition miss  implied by an outcome word, no R covers that part
```

## What Fits vs. What Clashes

| Dimension | External / Initial Idea | Our Context & Take |
| --- | --- | --- |
| Per-session narratives | Hand-kept doc sections 7-9 grow every session | Drop; replace with Executive Summary + ledger deltas |
| Recommendation ledger | Hand-kept doc: target, signal moved, status | Keep; add "watching" before "confirmed" |
| Sides | Draft R46: workflow vs. Developer | Part change, Developer note with reason, or no action for model or harness causes |
| Downstream outcome | Absent from the hand-kept doc | Standing handoff review, effective and efficient |
| `retro` categories and severity order | Single session, coding environment | Keep the target idea; no handoffs, trend, or Developer side in `retro` |
| `retro` check-over-rule, no-ops | Mechanical violations get deterministic checks; delete instructions that do nothing | Core of the Fix Filter; also applied to artifact sections |
| Warn-before checks | Flag gaps at every handoff | Not part of the review; they come out of reviews as proposed skill or check changes |
| Harness logs | Copilot only in the hand-kept doc | Artifacts and commits as the harness-neutral link; logs are enrichment per harness |

## Tensions & Tradeoffs
- **Worked example (agent model pins, `home-repo-workflow`):** incubation line 9 named "model preferences"; its probes (lines 89-92) checked agents "load and run" only. Session file `context-2026-11-25-1955.md` line 19 "switch Harnesses seamlessly" narrowed to R43 "each runs". P04 commit `ccea1f0` added Claude tool names and kept Copilot-format pins, faithful to R43. Session `7170fcfb` reopened it ("we forgot") as R48-R51. Read: decomposition miss that started in incubate's probe and was inherited by brain-storm. The Developer recalled stating it directly; the log search (user messages, first 500 characters per turn) did not find it.
- **Side fix (watching, one case):** brain-storm maps each quality word in the Desired Outcome to R#s or a written exclusion; incubate notes what a "works in both" probe did not check. The Fix Filter may push the brain-storm half toward a check instead of skill prose.
- **Explain vs. warn:** the review explains misses after the fact; it never prevents a first miss, but each confirmed finding makes that kind less likely.
- **Grounding vs. confusion:** the Developer wants more grounding but more signals per summary would confuse; the ledger's repeat evidence is the likely answer.
- **Harness gap:** the Developer switches harness when tokens run out or a task fails, so a Copilot-only review misses exactly the cases worth reviewing. Handoff and incident checks use artifacts and commits and work in both; health checks need logs.
- **Work machine out of scope:** it is isolated; only workflow updates flow to it. Nothing comes back.
- **Simplest 80/20 baseline (chosen):** handoff + health run by hand after a phase; script over Copilot logs plus artifacts and commits; flagged slices only; summary + one ledger; Fix Filter; Four Tiers kept as mission. The steelman adds automatic incident triggers, trend views, and both harnesses from day one.
- **Assumptions to verify:**
  - Claude Code logs on the personal machine carry messages, tool calls, and usage. Observed only one 2.5 KB setup-only log in `~\.claude\projects\C--Projects-Personal-Workflow\`.
  - Commit trailers identify which harness made a commit (inference).

## Sources
- [mattpocock/skills `retro`](https://github.com/mattpocock/skills/tree/main/skills/engineering/retro) — retrospective that suggests environment improvements by category; mechanical violations get deterministic checks, judgement calls get rules; removes no-op instructions. Source of the Fix Filter.
- Local: `docs/research/session-review.md`, `docs/research/incubate-session-review.md`, git log, Copilot session store, `~\.copilot\session-state\7170fcfb-b320-4700-9e83-3a2928f0a44c\events.jsonl` (verified 879 KB, all lines parsed: typed `user.message`, `assistant.message`, `tool.execution_start`, `skill.invoked`, `subagent.*`, `session.usage_record`, `session.model_change`).

## Open Threads
- none

## Graduation Framing
- **Distilled idea:** a session review that improves workflow parts by reviewing a skill's own session plus the downstream sessions that consumed its artifacts, producing a short Executive Summary and a ledger (watching -> confirmed), driven by the Four Tiers cost rule.
- **Keep:** Four Tiers as mission and escalation rule; handoff review (effective and efficient) and health review (including Developer contribution); Fix Filter from `retro`; outcomes as part change, Developer note with reason, or no action for outside causes; the miss labels with the agent-model-pin worked example; artifacts and commits as the harness-neutral link.
- **Reject or defer:** hand-kept per-session narratives; warn-before rules inside the review; automatic incident triggers and trend views in v1; work machine (out of scope); Claude Code logs until a home probe proves their format.
- **Questions for brain-storm:** how draft R46-R48 change; what triggers a run beyond by hand after a phase; the Vocabulary clash between Glossary `Session` and an agent conversation log; where the ledger lives; the success measure; whether the quality-word side fix goes forward on its own.
- Handoff: `/brain-storm from .workflow/incubations/session-review.md`
