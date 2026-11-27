# Incubation - Skill Review Conversation Log Record Drift

Status: incubating
Started: 2026-11-26
Updated: 2026-11-26

## Spark
- The first real `/skill-review` run ended its Executive Summary with 10 `unknown-record` notices and "5282 more notices not shown." (`workflow-home/skill-review/summaries/2026-11-26-2051-Personal.Workflow.md`). The Developer wants to act on log-format drift, not wade through per-line notices.
- Question: what signal tells the Developer the Conversation Log format changed in a way that matters, cheaply enough to run every time?

## Current Mental Model
- Current leaning: the alarm is a **per-invoke witness check**, not "a type is unknown" and not "a known type vanished". The drift actually found (`skill.invoked_ref`) was neither: a new type quietly took over part of a known type's job. A known-type presence check would never have fired. A per-invoke witness would have fired on the first run.
- **Two independent witnesses (Copilot CLI), each compared invoke by invoke against the starts the detector found:**
  - user-invoked: the explicit-invoke marker in `user.message.transformedContent` (`The user explicitly invoked the "/<skill>" skill`).
  - agent-invoked: the model's `skill` tool call (`tool.execution_start`, `toolName: "skill"`).
- **Developer view (Executive Summary):** totals only, no type names. One skill-detection line (misses / invokes), plus unknown records as count, % and change since the previous run per Harness.
- **Agent view (Review Record):** one row per (Harness, type) with count and first-seen run. Never one row per line.
- **Judgment only on a miss:** misses > 0 raise an Observation on the Depth 0 script. Only then are the new types near the missed invokes judged ("what replaced it?"). The fix goes through the normal Observation lifecycle and `/apply-observation`. The next run's numbers show improved or unchanged.
- **Separate from the alarm: a correctness fix the alarm would have raised.** `skill.invoked_ref` reloads aren't seen as starts, so their turns are mislabelled under whichever skill last wrote a full `skill.invoked`. The Developer confirmed fixing the mislabelling matters more than the finer boundary question (see Open Threads).

```text
 Depth 0 script (no model tokens), per invoke
   user-invoked  : slash marker in user.message  ─┐
   agent-invoked : `skill` tool call             ─┼─► vs. starts the detector found
                                                  │
              misses > 0 ──► Observation on Depth 0 ──► judge only new types near the misses
                                                  │           (first run: skill.invoked_ref)
              witness count drops to 0 ──► flag the witness itself as drifted
                                                  ▼
 Executive Summary: "Skill detection: 110 misses in 528 invokes · Unknown 1.7% (+1.3)"
                                                  ▼
 /apply-observation fixes the detector ──► next run: misses improved | unchanged
```

### What the skill records describe (Copilot CLI, inferred from local logs; not in the published schema)

| Record | What it records | When it's written |
| --- | --- | --- |
| `skill.invoked` (419) | First time a skill's text enters this conversation: full `content`, `trigger`, `invokedAtTurn`, `model` | `user-invoked`: when the user types `/skill`, written before the `user.message`. `agent-invoked`: when the model calls the `skill` tool |
| `skill.invoked_ref` (109) | Any later load of the same skill in the same conversation: same fields, `content` replaced by `contentId` (sha256) + `contentLength` | Follows a model `skill` tool call (78 of 109 directly) |
| `skill.context_delivered_ref` (240) | Skill text as placed in the model's context: `<skill-context name=…>` prefix and suffix, `contentId`, `interactionId` | After each model `skill` tool call (150 after an agent-invoked `skill.invoked`, 87 after a `_ref`). Never after a user-invoked one |

```text
 Echo (48 of 109)                       Reload (61 of 109)
 user: /brain-storm …                   … stretch of work …
  ├ skill.invoked (user, full text)     user: "move forward with Increment 8"  ← 49 after a new user message
  └ model calls skill tool              model calls skill tool again           ← 12 with no new user message
     └ skill.invoked_ref                   └ skill.invoked_ref
 = same use, merged correctly today     = new stretch of work, mislabelled today if another skill started in between
```

## What Fits vs. What Clashes

| Dimension | External / Initial Idea | Our Context & Take |
| --- | --- | --- |
| Notice granularity | R65: one notice per unrecognized record, listed under `## Notices` | Fits "never skipped silently", but per-line output buries the signal; aggregate to totals |
| Trigger for review | Judge every new type (model triage, about 100 tokens/type) | Heavier than needed; judge only the types near witness misses |
| Rate-based watch | `skill.invoked` per `user.message` | Clashes with the data: fell 0.54 to 0.18 (Oct to Nov) with no loss; would falsely alarm |
| Known-type presence watch | Alarm when a relied-on type vanishes | Would not have caught the drift actually found (a new type absorbing part of a known type's job); demoted to a secondary check at most |
| Witness, checked per log | "Any `skill.invoked` in a log with explicit invokes" | Masked the real gap: reported 0 misses where per-invoke found 110 |
| Witness, checked per invoke | Each slash marker and each `skill` tool call should map to a detected start | Fits the Fix Filter (a script does it); fired on the real drift; covers model-invoked skills too |
| Fix path | Separate agent and skill for type judgment | Premature; reuse Observations and `/apply-observation` |
| Published format | GitHub SDK schema as the known-type source | Lags the file: `skill.invoked_ref`, `skill.context_delivered_ref` and `contentId` are absent from it; drift must be detected, not read about |

## Tensions & Tradeoffs
- R65 says each unrecognized record is named. Aggregating to totals changes that contract, so it needs a spec change, not just a tool tweak.
- **Both witnesses are themselves undocumented Harness text** (the `skill` tool name and the "explicitly invoked" marker). If either changes, its count drops toward zero, so a sudden zero must be flagged as witness drift and not read as "no skill uses".
- The alarm catches harm when it happens, not before. Current leaning is to accept this.
- The detector fix (count `_ref` as a start) and the alarm are separate pieces of work. The alarm would raise the Observation that leads to the fix, which suggests the alarm is shaped correctly.
- **Simplest 80/20 baseline:** the per-invoke witness check plus aggregate counts and % in the summary, with model judgment only on a miss. The heavier version (model triage of every new type) buys earlier warning at a recurring token cost; for now that doesn't seem worth it.
- **Assumptions to verify:**
  - The residual misses after counting `_ref` (4 of 240 tool calls in 3 logs; 1 of 288 slash invokes) are not explained. They may be an artefact of the matching window (40 records after a tool call, 15 before a user message).
  - `trigger: context-load` (documented, not seen locally) would come from the Harness preloading a skill. Whether it is a witness-checked invoke at all is open.
  - A Claude Code witness exists. There, `<command-name>` text is itself a detection path, so the cross-check would have to be between Claude's two detection paths; not tested.
  - Two months of local logs (Copilot CLI 2026-10 and 2026-11; Claude Code 2026-11 only) is the whole history found; unknown whether older logs were pruned.
  - `/apply-observation` can edit tool code (the known-type lists in `.github/tools/skill-review/src/logs.mjs`, the start detector in `uses.mjs`), not only skill and agent text; not checked.

### Observed data (local scan of `~/.copilot/session-state/`, 2026-11-26)
- Copilot CLI: 421 logs with a timestamp month (72 Oct, 349 Nov) out of 438 session-state folders. No relied-on type vanished between months. Nov added 9 types (e.g. `instruction.update`, `model.turn_failed`).
- `skill.invoked_ref`: 109 records in 58 logs, in both Oct (30 logs) and Nov (28 logs), so it has been missed since Skill Review's first run, not newly drifted. None appears without an earlier `skill.invoked` of the same skill in the same log, and repeat refs share its `contentId`. The content hash is found nowhere under `~/.copilot` except that log's first `skill.invoked`.
- Effect under the current detector (`uses.mjs:26` starts a use only at `skill.invoked`): 83 of 109 refs fall inside an open use of the same skill (merged); 26 fall inside a different skill's use, in 11 logs, about 7,000 lines mislabelled. Example: ralph.loop session `10665edc`, where the Increment 8 `tdd-csharp` work (lines ~954 onwards) is filed under `run-tests` (last `skill.invoked` at line 337).
- Per-invoke witness: 240 model `skill` tool calls, of which 90 (in 46 logs) have no matching `skill.invoked` and 4 (in 3 logs) have neither `skill.invoked` nor `_ref`. 288 explicit slash invokes, of which 20 have no matching `skill.invoked` and 1 has neither. The earlier per-log check reported 0 misses.
- The 240 model `skill` tool calls equal the 240 `skill.context_delivered_ref` records (inference: one delivered-context record per model skill call).
- Relied-on types, from the code: Copilot CLI `session.start`, `skill.invoked`, `user.message`, `assistant.message`, `tool.execution_start`, `tool.execution_complete` (`uses.mjs:27`, `logs.mjs:42`, `records.mjs:13-23`); Claude Code `user`, `assistant` (`uses.mjs:31-35`).

## Sources
- [Copilot CLI config-dir reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference): says each session directory stores `events.jsonl`, "managed by the CLI"; no format or types. Only the first ~40% of the page was read.
- [Copilot CLI session data (Chronicle)](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/chronicle): says the complete session record lives under `~/.copilot/session-state/`; no types.
- [Copilot SDK streaming events](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/streaming-events): about 61 event types, some "saved to the session event log on disk"; lacks `hook.*`, `session.start`, `model.*`.
- [github/copilot-sdk `session-events.ts` @ b2eddd5](https://github.com/github/copilot-sdk/blob/b2eddd51447daf6a9887b1d5b96787d415069aa2/nodejs/src/generated/session-events.ts): generated union of CLI runtime events. `skill.invoked` (line 11813) is documented; its `content` is the "Full content of the skill file, injected into the conversation for the model", with a new optional `arguments` field. `trigger` values (lines 1300-1310): `user-invoked`, `agent-invoked`, `context-load` ("preloading skills configured on a custom agent or subagent"). No `skill.invoked_ref`, `skill.context_delivered_ref` or `contentId`. The closest pattern is the experimental `session.binary_asset` ("content-addressed binary asset shared by reference across events", `sha256:` ids), which covers binary attachments only. Best published reference, not a contract for the file.
- [github/copilot-cli changelog](https://raw.githubusercontent.com/github/copilot-cli/main/changelog.md): mentions `events.jsonl` in passing; nothing on `_ref` types or new event types.

## Open Threads
- **Deferred to brain-storm: where a reload's chunk starts.** Option A: every reload starts a new use. Option B: a new use starts only when the skill changes, and a reload of the running skill continues it. Both fix the mislabelling. The Developer ranked the mislabelling fix above this detail.
- Whether the Executive Summary line ("Skill detection: 110 misses in 528 invokes") is enough for the Developer to act on, or whether something else needs to sit in front of it.
- What a Claude Code witness looks like.
- Whether "lost" covers anything besides skill uses (e.g. tool records that Depth 2 reads rely on).

## Pick Up Here
- Ask the Developer whether the first-run Executive Summary line "Skill detection: 110 misses in 528 invokes" would tell them enough to act, or what they would want in front of it first. Optionally explain the 5 residual witness misses first, so the baseline the alarm reports after the `_ref` fix is understood.
