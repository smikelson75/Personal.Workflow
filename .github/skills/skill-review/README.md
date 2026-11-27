# Skill Review

`/skill-review` reviews unreviewed skill uses and Handoffs in the Home layout, records Observations, and writes an Executive Summary and Ledger in the Home Repo. See [SKILL.md](./SKILL.md) for the workflow steps.

## What a Run Does

1. **Prepare (Depth 0):** `prepare` scans Conversation Logs, Workflow Folder artifacts, and git history with zero model tokens, writing a compact record.
2. **Slice (Depth 2):** `slice` serves only flagged lines and Handoff ends, capped per record, so the model never opens a Conversation Log.
3. **Finish & Commit:** `finish` validates privacy and STE, updates `review-record.json`, and writes the Executive Summary and `ledger.md`. `commit` commits `skill-review/` in the Home Repo.

## Recommended Models

| Provider  | Model               | Default effort | Raise to `high` when                                      |
| --------- | ------------------- | -------------- | --------------------------------------------------------- |
| Anthropic | `claude-sonnet-5.5` | `medium`       | Phases with many flagged slices or Handoffs               |
| OpenAI    | `gpt-6.1-terra`     | `medium`       | Phases with many flagged slices or Handoffs               |
| Google    | `gemini-4-neon`     | `medium`       | Phases with many flagged slices or Handoffs               |
