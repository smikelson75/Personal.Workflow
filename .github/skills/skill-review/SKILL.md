---
name: skill-review
description: "Review unreviewed skill uses and Handoffs in the Home layout, record Observations, and write an Executive Summary and Ledger."
argument-hint: "[<skill>]"
user-invocable: true
---

# Skill Review

Review unreviewed skill uses and Handoffs in the current Project Repo. Run the four CLI steps in order and judge only between them.

## Inputs

- The optional `<skill>` argument goes to `prepare` and nothing else.
- The model never opens a Conversation Log and reads only `prepare` output and `slice` output.
- You may read a Handoff artifact with your own tools, because it is not a Conversation Log.
- The Handoff pairs are `incubate -> brain-storm`, `brain-storm -> behavior-spec`, `behavior-spec -> work-planner`, and `work-planner -> pull-work`.

## Steps

1. Run `prepare` to build the compact record:
   ```sh
   node "$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs" prepare [<skill>] --out <compact-record>
   ```
   Omit `[<skill>]` when no skill was given.
2. For each flagged line and each Handoff end you need to inspect, run `slice`:
   ```sh
   node "$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs" slice <compact-record> <Conversation ID> <line>
   ```
3. Write the judgement JSON file with `{cases: [...], handoffs: [{id}]}`:
   See `Judgement file` below for the allowed keys and values.
4. Run `finish` to validate, apply Observations, and write the summary and Ledger:
   ```sh
   node "$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs" finish <compact-record> <judgement> --attempt <n>
   ```
   Start with `--attempt 1`. On `ste-check` or `privacy-check` failure, fix the judgement text and retry `--attempt 2`, then `--attempt 3`.
5. Run `commit` to commit `skill-review/` in the Home Repo:
   ```sh
   node "$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs" commit <compact-record>
   ```

Only `finish` and `commit` write records. A stopped run writes nothing.

## Judgement file

- `handoffs`: list `{id}` for each compact Handoff with a non-null `using` end that you reviewed.
- `cases`: list each finding with `ref`, `outcome`, `description`, and either `match` or a new Observation.
- Conversation case: set `conversation`, `part`, and `kind` (`token cost`, `rule adherence`, `error`, `other`) or `label` (`requirements miss`).
- Handoff case: set `handoff`, optional `side` (`writing`, `using`, `both`), and `label` (`capture miss`, `decomposition miss`, `translation miss`) or `kind` (`restated or re-verified`, `section never used`).
- `outcome` is `part change` (requires `fixType` and `fixReason`), `note`, or `Developer note`.
- Optional `cause` names an earlier Observation ID or `model` with a `model` ID.
- Write every `description` and `fixReason` in STE: at most 20 words per sentence, and no Conversation IDs or raw quotes.

## Failures

- If `prepare` prints `skill-review failed: home-layout-required`, show that line and stop.
- If `prepare` prints `skill-review: nothing to review`, show that line and stop.
- On `ste-check` or `privacy-check` failure, retry `finish --attempt 1`, then `--attempt 2`, then `--attempt 3`. Stop after attempt 3.
- If `commit` fails, show its output and stop.
