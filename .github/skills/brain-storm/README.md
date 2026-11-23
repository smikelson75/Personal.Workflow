# Brain Storm

Turns an idea into buildable requirements through a guided, one-question-at-a-time conversation. It writes a session file and updates the glossary in `.workflow/`. See [SKILL.md](./SKILL.md) for the full behavior.

## Recommended Models

This skill needs reasoning more than raw output. Each turn is short, but the model has to keep a growing decision tree consistent, notice conflicts with settled answers, and push back on weak ones. Pick a strong general model and keep the effort moderate. High per-turn effort over a long conversation costs a lot of tokens and slows every reply.

| Provider  | Model               | Default effort | Raise to `high` when                                  |
| --------- | ------------------- | -------------- | ----------------------------------------------------- |
| Anthropic | `claude-opus-5.5`   | `medium`       | `large` ideas, or the user wants deeper pushback |
| OpenAI    | `gpt-6.2-sol`       | `medium`       | `large` ideas, or the conversation turns into conflict resolution |
| Google    | `gemini-4-neon`     | not recommended | — see note below                                     |

> **Don't use `gemini-4-neon` for brain-storm.** In three of three sessions it broke turn discipline. It asked several questions in one reply and wrote the user's answers itself, and one of those sessions was committed with decisions the user never made. In another it re-printed the same long review before nearly every question. It does fine on single-turn work such as reviews and analysis; the problem is long, one-question-at-a-time conversations. Retest it before you list it again.

### Effort Guidance

- **`low`**: not recommended. Feedback gets shallow, and the model tends to mark short answers as settled without confirming them.
- **`medium`** (default): handles `small` and `medium` ideas and keeps the conversation responsive.
- **`high`**: use for `large` ideas (a new product or several workflows), many cross-branch conflicts, or the final Requirements Gate on a complex idea.
- **`xhigh` / `max`**: not worth it here. One question per turn doesn't benefit from it, and the token cost grows with every turn.

### Notes

- The grounding `explore` subagent runs on its own lightweight model. Don't override it.
- For a small idea, `claude-sonnet-5.5` at `medium` is a reasonable step down from Opus before you raise the effort.
- You can switch to a lower effort partway through a session. Settled nodes live in the conversation and the session file, not in the model.
