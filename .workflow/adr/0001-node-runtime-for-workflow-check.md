# 0001. Node as the workflow-check runtime

Status: Accepted

## Context
- `workflow-check` must run on Windows and Linux, travel inside the copied workflow folder, need no install step, and use one runtime common to dev machines and CI.

## Decision
- Implement it in Node with ES modules (`.mjs`), no dependencies, and Node's built-in `node:test` for acceptance tests. Location: `.github/tools/workflow-check/`.

## Alternatives Considered
- `Python stdlib` - comparable fit, but weaker built-in test filtering and tagging for the scenario-ID harness.
- `PowerShell/.NET` - weaker Linux CI story and a build step.

## Consequences
- Every machine and CI runner running the workflow needs Node, with a version that supports `--test-skip-pattern`.
- No mutation testing tool is available without an install, so mutation gates are unsupported.
- Switching runtime later means rewriting the tool and its harness.
