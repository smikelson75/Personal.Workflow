# Incubate

Explores an early idea, external pattern, or hunch through back-and-forth conversation, targeted web research, and visual models (plain-text ASCII diagrams and comparison tables) without forcing it into requirements. Writes and updates a living note in `.workflow/incubations/<slug>.md`. See [SKILL.md](./SKILL.md) for the full behavior.

## When to Use `incubate` vs. `brain-storm`

| | `incubate` | `brain-storm` |
| --- | --- | --- |
| **Goal** | Understand what an idea means, how it fits, and whether it is worth pursuing | Turn a decided idea into numbered `R#` Requirements and Glossary terms |
| **Outcome** | May stay `incubating`, be `dropped`, or become `graduated` | Finalized Session in `.workflow/sessions/` ready for `/behavior-spec` |
| **Artifact** | One living note in `.workflow/incubations/<slug>.md` (ignored by `workflow-check`) | Append-only Session + `.workflow/language.md` (checked by `workflow-check`) |
| **Style** | Open-ended sense-making, ASCII visuals & tables, web research | Structured decision tree toward a Requirements Gate |

## Recommended Models

This skill blends synthesis, critical pushback, visual modeling, and web research. A strong reasoning model at `medium` effort keeps the conversation responsive while still spotting hidden tensions and maintaining turn discipline.

| Provider  | Model               | Default effort  | Raise to `high` when                                                 |
| --------- | ------------------- | --------------- | -------------------------------------------------------------------- |
| Anthropic | `claude-opus-5.5`   | `medium`        | Cross-cutting architectural shifts or multi-stack workflow redesigns |
| OpenAI    | `gpt-6.2-sol`       | `medium`        | Cross-cutting architectural shifts or heavy tradeoff synthesis       |
| Google    | `gemini-4-neon`     | not recommended | — see note below                                                     |

> **Don't use `gemini-4-neon` for incubate.** Across five sessions (S1–S5), it broke turn discipline in multiple ways: repeating full recaps and dropping direct user questions (S1–S2), slipping back into prose routing menus (S3–S4), and hallucinating multi-turn user replies inside pre-tool messages—then falsely denying it wrote them when asked (S5). By contrast, `claude-opus-5.5` at `medium` followed every interaction rule over a 28-turn session (S6). Retest `gemini-4-neon` before listing it again.

### Effort Guidance

- **`low`**: not recommended. Tends to accept external patterns at face value instead of separating the core insight from the author's implementation.
- **`medium`** (default): strong conversational back-and-forth, clear ASCII visuals, and good pushback without sluggish turns.
- **`high`**: useful when an idea cuts across multiple workflows, repositories, or stacks and you want deeper stress-testing.
- **`xhigh` / `max`**: rarely needed; save it for unusually dense multi-source synthesis.

### Notes

- Grounding `explore` and `research` subagents run on their own models—don't override them.
- `brain-storm` never auto-scans `.workflow/incubations/`. Only explicitly referenced notes (`/brain-storm from .workflow/incubations/<slug>.md`) are loaded, so paused or abandoned incubations never clutter unrelated work.
