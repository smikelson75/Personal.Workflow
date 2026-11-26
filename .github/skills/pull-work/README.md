# Pull Work

`/pull-work` is the one command for moving a plan forward. It replaces typing "go ahead", "run next", or a plan's `Next` line. See [SKILL.md](./SKILL.md) for the behavior.

## What a Run Does

1. **Clean-tree check:** if `git status` shows anything, it stops and lists the files, because the workflow commits everything it writes. Commit them with `/conventional-commit` or stash them, then run `/pull-work` again. It never commits work it didn't make.
2. **Route:** it reads `Next` in `.workflow/plans/<slug>/plan.md`, then plans (through [work-planner](../work-planner/README.md)), builds slices, repairs fixtures, runs the gate, reviews critical code, or triages, one step after another.
3. **Commit:** each approval, completed slice, and passed gate becomes its own Conventional Commit, made without asking.
4. **Stop:** only for the items in `Escalate Only`, or when a phase completes. After a phase, start a fresh session and run `/pull-work` again; that costs fewer tokens than carrying the finished phase's context.

## Safety Nets

- [fixture-leak.mjs](./scripts/fixture-leak.mjs) flags test literals copied into product code by a `delegate` card. A hit sends that card to code review.
- [locked-tests.json](../../hooks/locked-tests.json) is a pre-tool hook that denies edits to locked acceptance tests except during fixture repair and phase review. It needs `node` on the PATH; without it the hook allows edits, and the gate's lock check is the backstop.

## Recommended Models

`/pull-work` runs in your main session as the orchestrator: it reads `plan.md`, dispatches `delegate` Cards to `coder` and test authoring to `test-author`, implements `main`-tier Cards directly, and triages Gate failures.

A strong mid-tier model at `medium` effort balances coordination speed with implementation judgment on `main` Cards.

| Provider  | Model               | Default effort | Raise to `high` when                                         |
| --------- | ------------------- | -------------- | ------------------------------------------------------------ |
| Anthropic | `claude-sonnet-5.5` | `medium`       | Complex `main`-tier Cards or multi-failure Gate triage       |
| OpenAI    | `gpt-6.1-terra`     | `medium`       | Complex `main`-tier Cards or multi-failure Gate triage       |
| Google    | `gemini-4-neon`     | `medium`       | Complex `main`-tier Cards or multi-failure Gate triage       |

### Effort Guidance

- **`low`**: not recommended. Orchestration and `main`-tier implementation require reliable state tracking across steps.
- **`medium`** (default): handles normal phase execution, dispatch, and single-cause triage cleanly.
- **`high`**: use when a Phase has difficult `main`-tier Cards or a Gate failure spans several interacting slices.
- **`xhigh` / `max`**: not worth it; long multi-step runs multiply per-turn token cost.

### Notes

- Delegated subagents (`repo-scout`, `coder`, `test-author`, `test-reviewer`) use their own pinned models in [.github/agents/](../../agents/README.md) regardless of the main session's model.

