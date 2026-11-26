---
name: agents-md
description: "Create or amend a Project Repo's root AGENTS.md from the Glossary, Session Chain, Behavior Specs, and repository manifests, always with one Stack line."
argument-hint: "Optional: describe the project or the instruction change"
user-invocable: true
---

# Agents Md

Question rules: follow `.github/user-interaction.md`.
Core paths: when the environment variable WORKFLOW_HOME is set (Home layout), read each Workflow Core path written here as follows: .github/skills/ is $WORKFLOW_HOME/.claude/skills/, .github/agents/ is $WORKFLOW_HOME/.claude/agents/, .github/tools/ is $WORKFLOW_HOME/.workflow-core/tools/, .github/hooks/ is $WORKFLOW_HOME/.workflow-core/hooks/, .github/user-interaction.md is $WORKFLOW_HOME/.workflow-core/user-interaction.md; run every command from the Project Repo root and never from $WORKFLOW_HOME. Without WORKFLOW_HOME (copy layout) read the paths as written.

Write the Project Repo's durable, project-wide instructions: a compact `AGENTS.md` of stable conventions and constraints, including the `Stack:` line that the Launch Script reads to load the stack's Language Add-on. It is not a product spec, plan, progress report, or decision log.

## Mode

Run `node .github/skills/agents-md/scripts/stack-check.mjs` from the Project Repo root first. It prints one JSON line with `mode`, `stacks`, `stackLine`, and `competing`.

- It exits 2 and prints `the Home Repo's AGENTS.md holds only Project Pointers`: stop, say that sentence, and write nothing. The Home Repo's `AGENTS.md` holds only Project Pointers.
- `mode` is `bootstrap` (no root `AGENTS.md`): create it. The skill does not stop for the file's absence.
- `mode` is `amendment`: preserve all content you do not change, replace stale guidance, and surface conflicts before writing.
- `competing` is `true` (both `AGENTS.md` and `copilot-instructions.md` in `.github/` exist): ask which is canonical before writing.
- Use `AGENTS.md` (plural) at the repository root only.

## Source Order

Read only the sources that exist and are relevant:

1. The existing `AGENTS.md`.
2. `.workflow/language.md` for stable terms and boundaries.
3. The Session Chain in `.workflow/sessions/` and the Behavior Specs in `.workflow/specs/`, for hard constraints only.
4. Targeted repository evidence: manifests, formatter and lint configuration, CI workflows, test projects, representative source.

Do not survey the whole repository when targeted evidence is enough.

## Stack Line

- Write exactly one `Stack:` line, in the form `Stack: <id>[, <id>...]`, with kebab-case IDs.
- Propose the IDs from the script's `stacks` (`*.csproj` or `*.sln` gives `csharp`; `package.json` with `tsconfig.json` gives `node-typescript`; `package.json` alone gives `node-javascript`).
- When `stacks` is empty, ask the Developer for the stack ID. Accept any kebab-case ID, even one without a Language Add-on.
- Change an existing `Stack:` line (`stackLine` is not `null`) only with the Developer's agreement.

## Workflow

1. Run the script and resolve its outcome (Mode).
2. Extract only guidance that is stable, actionable, and applies to most work. Format it per [references/AGENTS-FORMAT.md](references/AGENTS-FORMAT.md).
3. Reconcile contradictions in this order: Developer's direction, enforced repository configuration, current architecture evidence, Behavior Spec constraints.
4. Write or amend `AGENTS.md` with the one `Stack:` line.
5. Commit with `git add AGENTS.md` and a Conventional Commit of type `docs`, for example `docs: add AGENTS.md with stack and conventions`.

## Required Boundaries

- Unsettled product matters (problem, users, scope, vocabulary): stop and redirect to `brain-storm`.
- Unsettled behavior (what the product must do): stop and redirect to `behavior-spec`.
- Sequencing, phase status, and active Cards belong to `work-planner`; never encode them as standing instructions.
- Do not invent commands, conventions, or tool requirements; mark unknown items unresolved and ask when they change agent behavior.
- Writes no other file than `AGENTS.md`, and commits only `AGENTS.md`.

## Exit

Return a brief: the instruction areas added or changed, the `Stack:` line written, the commit made, and any unresolved conflict.
