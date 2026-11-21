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
