---
name: apply-observation
description: "Apply confirmed part change Observations to Personal.Workflow or undo an applied Observation."
argument-hint: "[undo O<n>]"
user-invocable: true
---

# Apply Observation

Question rules: follow `.github/user-interaction.md`.
Core paths: when the environment variable WORKFLOW_HOME is set (Home layout), read each Workflow Core path written here as follows: .github/skills/ is $WORKFLOW_HOME/.claude/skills/, .github/agents/ is $WORKFLOW_HOME/.claude/agents/, .github/tools/ is $WORKFLOW_HOME/.workflow-core/tools/, .github/hooks/ is $WORKFLOW_HOME/.workflow-core/hooks/, .github/user-interaction.md is $WORKFLOW_HOME/.workflow-core/user-interaction.md; run every command from the Project Repo root and never from $WORKFLOW_HOME. Without WORKFLOW_HOME (copy layout) read the paths as written.

Apply confirmed `part change` Observations in `Personal.Workflow` under the Home layout, or undo one applied Observation with `undo O<n>`.

## STE Limits

Write every statement shown to the Developer in R69 (`## Checkpoint`) and R72 (`undo O<n>`) in STE: at most 25 words per sentence, and at most 6 sentences per paragraph.

## Apply Mode (`/apply-observation`)

1. Run `apply-list` to validate pre-flight (`home-layout-required`, `not-personal-workflow`, `dirty-tree`, `records-unreadable`) and list confirmed `part change` Observations:
   ```sh
   node "$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs" apply-list
   ```
   If it prints `apply-observation: nothing to apply` or `apply-observation failed:`, show that output and stop.
2. Ask the Developer to pick any subset of the listed Observations.
3. Before any file changes, run one Checkpoint (following `.github/user-interaction.md`):

## Checkpoint

Show, per pick and in STE:
- the part
- a summary of the change
- the Observation (`O<n>`) it should fix

Any pick the Developer rejects is not applied and stays `confirmed`.

4. For each approved pick, in ID order (`O<n>` ascending):
   a. Edit only the files needed for that pick.
   b. Run `apply-check <O-id>` to run `workflow-check` and every acceptance and unit suite in `Personal.Workflow`:
      ```sh
      node "$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs" apply-check <O-id>
      ```
      If `apply-check` exits non-zero, it restores the working tree and prints `check-failed: <O-id>: <reason>`. Leave that pick `confirmed` and continue to the next pick.
   c. When `apply-check` exits 0, commit only the edited paths following [conventional-commit](../conventional-commit/SKILL.md)'s Message Rules, using `<part>` as scope and a subject ending in `(O<n>)` (for example `docs(pull-work): clarify preflight order (O03)`). Record the resulting commit SHA.
5. After the last pick, if at least one pick was committed, run `apply-finish` once with every `<O-id>:<commit>` pair:
   ```sh
   node "$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs" apply-finish <O-id>:<commit> ...
   ```
   `apply-finish` marks each pick `changed`, runs `scripts/update-home.mjs` once against the Home Repo, shows its full output, records the install on success, rewrites `ledger.md`, and commits `skill-review/` in the Home Repo. If no pick was committed, do not run `scripts/update-home.mjs` or `apply-finish`.

## Undo Mode (`/apply-observation undo O<n>`)

1. Run `undo-check <O-id>` to validate pre-flight and verify the Observation has an unreverted change commit:
   ```sh
   node "$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs" undo-check <O-id>
   ```
   If it fails (`unknown-observation`, `not-applied`, `dirty-tree`, `home-layout-required`, `not-personal-workflow`, `records-unreadable`), show the output and stop.
2. State in STE: the part, the commit it will revert, and the Observation (`O<n>`). Wait for the Developer's approval. If the Developer declines, change nothing and stop.
3. On approval, run `undo <O-id>`:
   ```sh
   node "$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs" undo <O-id>
   ```
   `undo` reverts the commit (`revert(<part>): undo <O-id>`), sets the Observation `confirmed`, runs `scripts/update-home.mjs` once, records the install, rewrites `ledger.md`, and commits `skill-review/` in the Home Repo (`docs(skill-review): undo <O-id>`). If `undo` prints `apply-observation failed: revert-conflict:`, show it and stop.
