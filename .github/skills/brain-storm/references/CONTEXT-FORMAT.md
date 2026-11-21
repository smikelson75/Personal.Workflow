# Session Context Format

Purpose: a compact, self-contained record of one brain-storm session at `.workflow/sessions/context-YYYY-MM-DD-HHmm.md`, from which `behavior-spec` can specify every requirement without reopening discovery. Canonical terms live in `.workflow/language.md`.

## Include Only
- status, relationship, size, and links to prior sessions it builds on or supersedes
- existing-solution grounding (only when the idea touches existing code)
- problem, primary user, primary workflow (with alternate/failure paths that were settled)
- numbered v1 requirements with acceptance signals
- scope guardrails, constraints (including quality needs and externally imposed formats), success signal
- decisions: parked and rejected paths with reasons; deferred-to-spec items
- terms introduced or changed this session (summary only)

## Exclude
- architecture, stack choices for new work, UI copy
- speculative future scope, implementation tasks
- fields and schema: user-visible fields and validation belong to `behavior-spec`; physical names, types, and mappings belong to `work-planner`
- implementation detail of any kind; do not record it, even as deferred

## Rules
- bullet-first; no narrative
- requirements are observable behavior, not implementation: `R1 - <behavior>. Accept: <observable signal>.`
- acceptance stays coarse: one observable outcome per requirement; detailed rules, examples, and failure outcomes belong to `behavior-spec`
- requirement IDs are stable across sessions: continue from the highest existing ID in the session chain; never reuse or renumber
- an `amend` session restates each requirement it changes under its existing ID and retires replaced ones: `R4 - retired, superseded by R9.`
- a format imposed from outside (an import file, external API, existing data) is a constraint: record that it exists and who owns it; `behavior-spec` details it
- record quality needs in the user's terms (`quality need: feels instant on search`); `behavior-spec` makes them measurable
- `deferred-to-spec` holds behavioral detail only (exact limits, rules, error outcomes, examples)
- every parked/rejected item states why
- use canonical terms from `.workflow/language.md`; do not redefine them here
- if a section does not change planning or naming, cut it

## Required Sections

| Section | small | medium | large |
|---|---|---|---|
| Problem | required | required | required |
| Requirements | required | required | required |
| Existing Solution | if extend or amend | if extend or amend | if extend or amend |
| Users | optional | required | required |
| Workflow | optional | required | required |
| Scope Guardrails | optional | required | required |
| Constraints | optional | required | required |
| Success | optional | required | required |
| Decisions | optional | required | required |
| Language | optional | optional | optional |

- Cut any optional section that does not change planning or naming.

## Skeleton

```md
# Context - YYYY-MM-DD HH:mm

- Status: final | draft
- Relationship: new | extend | amend
- Size: small | medium | large
- Builds on: `context-....md` (optional)
- Supersedes: `context-....md` (optional)

## Existing Solution
- what exists and its current state, as relevant to this idea
- areas this idea touches

## Problem
- user pain
- desired outcome

## Users
- `Primary User` - who they are; why they care

## Workflow
- trigger
- key step
- alternate/failure path -> outcome
- successful outcome

## Requirements
- R1 - behavior. Accept: signal.
- R2 - behavior. Accept: signal.

## Scope Guardrails
- in: ...
- out: ...

## Constraints
- fixed constraint
- imposed format: ... - owner
- quality need: ...
- security/permission assumption

## Success
- v1 succeeds when ...

## Decisions
- parked: ... - reason
- rejected: ... - reason
- deferred-to-spec: R# - behavioral detail to specify
- open (draft only): ...

## Language
- New/changed terms this session; full definitions in `language.md`.
- `Term` - short summary
```

## Quality Bar
- `behavior-spec` can specify every requirement from the session chain plus `language.md` without reopening discovery
- every requirement is testable from its acceptance signal
- requirement IDs are unique across the session chain
- wording makes later phase names and code names obvious
