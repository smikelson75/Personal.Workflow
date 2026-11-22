# Conventional Commit

Prepares coherent, reviewable Git commits following Conventional Commits 1.0.0. See [SKILL.md](./SKILL.md) for the full workflow and [references/types.md](./references/types.md) for allowed commit types.

## How It Runs

- **Direct invocation (`/conventional-commit`):** inspects `git status` and diffs, keeps unrelated changes separate, proposes a commit message, and asks for explicit approval before running `git commit`.
- **Workflow invocation:** `pull-work`, `work-planner`, and the `planner` agent follow the skill's message rules to commit approved plans, completed Slices, and passing Gates automatically without re-asking, staging only the exact paths they modified.

## Recommended Models

Writing a commit message from a diff is a narrow, structured task. A fast, low-cost model at `low` effort is enough for most diffs.

| Provider  | Model              | Default effort | Raise to `medium` when                                         |
| --------- | ------------------ | -------------- | -------------------------------------------------------------- |
| Anthropic | `claude-haiku-5.5` | `low`          | A large, mixed working tree needs to be split into several commits |
| OpenAI    | `gpt-6-luna`       | `low`          | A large, mixed working tree needs to be split into several commits |
| Google    | `gemini-3.8-flash` | `low`          | A large, mixed working tree needs to be split into several commits |

### Effort Guidance

- **`low`** (default): fast and accurate for single-purpose diffs.
- **`medium`**: useful when `git status` contains mixed changes that need careful grouping and staging.
- **`high` / `xhigh` / `max`**: unnecessary; commit formatting does not benefit from extended reasoning.

### Notes

- When a workflow skill (`pull-work` or `work-planner`) creates commits automatically, it uses the active session's model rather than launching a separate session.
