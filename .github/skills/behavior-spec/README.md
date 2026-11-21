# Behavior Spec

Turns the settled requirements from `brain-storm` into a black-box behavioral contract: rules, failure outcomes, examples, measurable quality thresholds, and external constraints. `work-planner` plans from it and derives its acceptance scenarios from it. It writes `.workflow/specs/<artifact-slug>-spec.md`. See [SKILL.md](./SKILL.md) for the full behavior and [references/SPEC-FORMAT.md](./references/SPEC-FORMAT.md) for the format and boundary tests.

It decides most details itself and records unsourced ones under `Assumptions`. It asks you only about contradictions; destructive, security, privacy, or authorization behavior; preference forks it can't ground; and thresholds with nothing to calibrate against. You review the assumptions in the finishing brief and amend any you disagree with.

## Recommended Models

This skill decides more than it asks. The model has to infer rules and failure outcomes from the session chain, notice where two implementations would diverge, apply its own reasoning consistently, and keep implementation detail out. Because few answers come back from you, judgment matters more than volume.

| Provider  | Model               | Default effort | Raise to `high` when                                         |
| --------- | ------------------- | -------------- | ------------------------------------------------------------ |
| Anthropic | `claude-opus-5.5`   | `medium`       | many requirements, or security/destructive rules             |
| OpenAI    | `gpt-6.2-sol`       | `medium`       | many requirements, or complex state lifecycles               |
| Google    | `gemini-4-neon`     | `medium`       | a long session chain with amendments and retired requirements |

### Effort Guidance

- **`low`**: not recommended. Failure passes and the self-check get skipped, and examples turn generic.
- **`medium`** (default): handles most specs.
- **`high`**: use for large session chains, security-sensitive products, or amendments that touch many requirements.
- **`xhigh` / `max`**: not worth it. The stop rule ends drafting early, so extra effort mostly adds detail that belongs to planning.

### Notes

- For a `small` change with a few requirements, `claude-sonnet-5.5` at `medium` is enough.
- If the spec starts naming tables, classes, or libraries, the model is over-reaching. Point it back to the boundary tests rather than raising effort.
- If the `Assumptions` list is long and you disagree with many entries, a weaker model is guessing. Raise effort or switch models before you tune the escalation rules.
