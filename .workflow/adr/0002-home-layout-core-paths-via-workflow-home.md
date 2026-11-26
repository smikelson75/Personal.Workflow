# 0002. Home layout resolves Workflow Core paths through `WORKFLOW_HOME`

Status: Accepted

## Context
- Skills and agents name Workflow Core files as `.github/...` relative to the working folder. In the Home layout the Harness runs in a Project Repo that holds none of them; the Update Script installs them in the Home Repo under different folders (`.claude/skills`, `.claude/agents`, `.workflow-core/...`). The Launch Script and skills must write nothing into the Project Repo.

## Decision
- The Launch Script sets the environment variable `WORKFLOW_HOME` to the Home Repo's real path for the Harness. Each skill and the `planner` agent carry one `Core paths:` line that maps each `.github/...` prefix to its Home location under `$WORKFLOW_HOME` and requires commands to run from the Project Repo root. Without `WORKFLOW_HOME` (copy layout) paths are read as written.

## Alternatives Considered
- `Rewrite skill text at install` - the installed files would differ from the source, breaking the byte-equal install and the content fingerprint behind the Workflow version.
- `Mirror .github/ into the Project Repo` - writes into the Project Repo, which the Launch Script must never do.
- `Resolver script` - needs the very path it would resolve.

## Consequences
- The Update Script install map and Workflow version are unchanged; one source serves both layouts.
- Path resolution relies on the model following a prose rule and on the Harness passing the environment to its shell; a live probe covers it, and no test can.
- Any new Workflow Core path prefix needs the rule line updated in every skill.
