# Incubation - Skill Review Conversation Log Record Drift

Status: incubating
Started: 2026-11-26
Updated: 2026-11-26

## Spark
- The first real `/skill-review` run ended its Executive Summary with 10 `unknown-record` notices and "5282 more notices not shown." (`workflow-home/skill-review/summaries/2026-11-26-2051-Personal.Workflow.md`). The Developer wants to act on log-format drift, not wade through per-line notices.
- Question: what signal tells the Developer the Conversation Log format changed in a way that matters, cheaply enough to run every time?

## Current Mental Model
- Current leaning: stop treating "unknown type" as the alarm. The real risk is **loss**: a known type Skill Review relies on stops being written, so skill uses go undetected. Unknown types are mostly plumbing.
- **Developer view (Executive Summary):** totals only, no type names. Unknown records as count, percentage, and percentage change since the previous run per Harness, plus one skill-detection line.
- **Agent view (Review Record):** cost-efficient detail, one row per (Harness, type) with count and first-seen run. Never one row per line.
- **Loss watch (Depth 0 script, no model tokens):**
  - Known-type presence: every type Skill Review relies on still appears this run.
  - Witness check (Copilot CLI): explicit invokes recorded by the Harness in `user.message.transformedContent` (`The user explicitly invoked the "/<skill>" skill`) vs `skill.invoked` records in the same log. Baseline is 0 misses.
- **Judgment only on loss:** a miss or a vanished known type raises an Observation on the Depth 0 script. Only then are the new types in the affected logs judged ("what replaced it?"). The fix goes through the normal Observation lifecycle and `/apply-observation`. The next run's numbers show improved or unchanged.

```text
 Depth 0 script (no model tokens)
 ├─ known-type presence: relied-on types still appear this run
 └─ witness check: explicit invokes in user.message  vs  skill.invoked
          │                                          (baseline: 0 misses)
          ▼
   miss > 0  or  known type gone ──► Observation on Depth 0 (confirmed)
          │                          + only now: judge new types in those logs
          ▼
 Executive Summary: one line
   Unknown 1.7% (+1.3) · Skill detection: 0 misses in 236 explicit invokes
          ▼
 /apply-observation edits the known-type list ──► next run: % and misses
                                                  show improved | unchanged
```

| Developer sees (Executive Summary) | Agents keep (Review Record) |
| --- | --- |
| Unknown records per Harness: count / total, %, change since previous run | Per (Harness, type): count, first-seen run, skill-name hit |
| Skill detection: misses / explicit invokes | Logs behind any miss, for the Depth 2-3 reads |
| No type names, no per-line notices | No per-line rows |

## What Fits vs. What Clashes

| Dimension | External / Initial Idea | Our Context & Take |
| --- | --- | --- |
| Notice granularity | R65: one notice per unrecognized record, listed under `## Notices` | Fits "never skipped silently", but per-line output buries the signal; aggregate to totals |
| Trigger for review | Judge every new type (model triage, about 100 tokens/type) | Heavier than needed; judge only when the loss watch fires |
| Rate-based watch | `skill.invoked` per `user.message` | Clashes with the data: fell 0.54 to 0.18 (Oct to Nov) with no loss; would falsely alarm |
| Witness-based watch | Cross-check two independent Harness writes | Fits the Fix Filter (a script does it); 0 misses across 421 logs gives a crisp baseline |
| Fix path | Separate agent and skill for type judgment | Premature; reuse Observations and `/apply-observation` |
| Published format | GitHub SDK schema as the known-type source | Partial only; the on-disk format is not declared stable, and some `model.*` types are absent from the schema |

## Tensions & Tradeoffs
- R65 says each unrecognized record is named. Aggregating to totals changes that contract, so it needs a spec change, not just a tool tweak.
- The loss watch catches harm when it happens, not before. Current leaning is to accept this, because a loss that matters shows up as missed skill uses, and the witness check sees those for user-called skills.
- The witness only covers skills the user calls with a slash command. Skills the model invokes itself have no witness (14 logs in Oct, 24 in Nov had `skill.invoked` with no explicit call).
- **Simplest 80/20 baseline:** aggregate counts and % in the summary, plus the witness check. Model judgment only on a miss. The heavier version (model triage of every new type) buys earlier warning at a recurring token cost; for now that doesn't seem worth it.
- **Assumptions to verify:**
  - `transformedContent` keeps its explicit-invoke marker. It is itself undocumented Harness text, so if it changes, a check that the witness count is nonzero would need to flag it.
  - A Claude Code witness exists. There, `<command-name>` text is itself a detection path, so the cross-check would have to be between Claude's two detection paths; not tested.
  - Two months of local logs (Copilot CLI 2026-10 and 2026-11; Claude Code 2026-11 only) is the whole history found; unknown whether older logs were pruned.
  - `/apply-observation` can edit tool code (the known-type lists in `.github/tools/skill-review/src/logs.mjs`), not only skill and agent text; not checked.

### Observed data (local scan, 2026-11-26)
- Copilot CLI: 421 logs with a timestamp month (72 Oct, 349 Nov) out of 438 session-state folders. No relied-on type vanished between months. Nov added 9 types (e.g. `instruction.update`, `model.turn_failed`).
- Witness check: explicit invokes with no `skill.invoked` in the same log: 0 of 72 logs (Oct), 0 of 349 (Nov). Explicit invokes: 52 (Oct), 236 (Nov).
- Relied-on types, from the code: Copilot CLI `session.start`, `skill.invoked`, `user.message`, `assistant.message`, `tool.execution_start`, `tool.execution_complete` (`uses.mjs:27`, `logs.mjs:42`, `records.mjs:13-23`); Claude Code `user`, `assistant` (`uses.mjs:31-35`).

## Sources
- [Copilot CLI config-dir reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference): says each session directory stores `events.jsonl`, "managed by the CLI"; no format or types. Only the first ~40% of the page was read.
- [Copilot CLI session data (Chronicle)](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/chronicle): says the complete session record lives under `~/.copilot/session-state/`; no types.
- [Copilot SDK streaming events](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/streaming-events): about 61 event types, some "saved to the session event log on disk"; lacks `hook.*`, `session.start`, `model.*`.
- [github/copilot-sdk `session-events.ts`](https://github.com/github/copilot-sdk): generated union of CLI runtime events; covers most types we use; 234 entries `@experimental`; lacks `model.turn_started`, `model.model_call_started`, `model.captured_assignment_context`, `model.messages_snapshot`. Best published reference, not a contract for the file.
- [github/copilot-cli changelog](https://github.com/github/copilot-cli): mentions `events.jsonl` in passing; no entries announce new event types, so drift must be detected, not read about.

## Open Threads
- **Separate thread: `skill.invoked_ref`.** Not on the known list (`logs.mjs`). Records carry `name`, `trigger`, `model`, `source`, `contentId`. Seen in 58 logs, always alongside `skill.invoked`, never alone (109 records). Unknown whether it describes the same invocations or extra ones (e.g. model-triggered). If extra, Skill Review may already miss skill uses. It also looks like a likely successor if Copilot CLI moves invocation content behind `contentId`.
- What a Claude Code witness looks like.
- Whether "lost" covers anything besides skill uses (e.g. tool records that Depth 2 reads rely on).

## Pick Up Here
- Run the `skill.invoked_ref` check first: in the 58 logs that have both, match each `_ref` record against `skill.invoked` by name and turn to see whether they are the same invocations. That answers whether the loss watch also needs a witness for model-invoked skills before this graduates.
