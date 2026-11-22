# Workflow Agents

The `.github/agents/` folder defines the custom subagents used by `work-planner` and `pull-work`. Subagents are introduced only where isolation or a cheaper model saves more tokens than doing the work inline in the main session.

## Agent Roster

| Agent | File | Role | Model Tier | Effort | User-Invocable |
| --- | --- | --- | --- | --- | --- |
| `repo-scout` | [repo-scout.agent.md](./repo-scout.agent.md) | Read-only repository survey returning a cited fact sheet (< 60 lines) so raw file reading stays out of the main context. | Cheap | `low` | No |
| `coder` | [coder.agent.md](./coder.agent.md) | Implements one `delegate`-tier Card until its locked acceptance tests pass. Makes no design decisions and never asks the user. | Cheap (or local) | `medium` | Yes (typically dispatched by `pull-work`) |
| `test-author` | [test-author.agent.md](./test-author.agent.md) | Writes failing black-box acceptance tests for a Card, or performs fixture-only repairs on `test-fix` Cards. | Mid | `medium` | No |
| `test-reviewer` | [test-reviewer.agent.md](./test-reviewer.agent.md) | Read-only reviewer that approves or rejects fixture repairs to locked tests so the author never approves its own edit. | Mid | `medium` | No |
| `planner` | [planner.agent.md](./planner.agent.md) | Optional stand-in for `work-planner`'s Plan mode on the strongest model for large or architecture-heavy first plans. | Strongest | `high` | Yes |

Built-in `code-review` is also invoked once per Phase after the Gate passes, only for Cards marked `Review: required`.

## Pinned Model Lists

Each agent file lists models in priority order in its YAML frontmatter; the host selects the first available model.

| Agent | Anthropic | OpenAI | Google | Reasoning Effort |
| --- | --- | --- | --- | --- |
| `repo-scout` | `Claude Haiku 5.5` | `GPT-6 Luna` | `Gemini 3.8 Flash` | `low` |
| `coder` | `Claude Haiku 5.5` | `GPT-6 Luna` | `Gemini 3.8 Flash` | `medium` |
| `test-author` | `Claude Sonnet 5.5` | `GPT-6.1 Terra` | `Gemini 4 Neon` | `medium` |
| `test-reviewer` | `Claude Sonnet 5.5` | `GPT-6.1 Terra` | `Gemini 4 Neon` | `medium` |
| `planner` | `Claude Opus 5.5` | `GPT-6.1 Sol` | `Gemini 4 Neon` | `high` |

## Customizing Models

- To change an agent's model preference, edit the `model:` list in its `.agent.md` frontmatter.
- Model names are host-specific. Use your editor's hover or completions in the agent file to verify availability.
- To run `delegate` Cards on a local model, place your local model ID first in [coder.agent.md](./coder.agent.md).
- If `coder` repeatedly stops on the same type of Card, tighten the Card's `Decisions` and `Patterns` rather than upgrading `coder`'s model.
