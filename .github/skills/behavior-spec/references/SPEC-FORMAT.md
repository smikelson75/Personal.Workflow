# Behavior Spec Format

Purpose: the black-box behavioral contract for v1 at `.workflow/specs/<artifact-slug>-spec.md`. It expands every requirement from the brain-storm session chain into observable rules, failure outcomes, and examples, plus measurable quality thresholds and constraints imposed from outside. It never describes how the inside is built.

## Boundary Tests

Apply to every candidate detail:

1. **Observability**: if it changed, would a black-box test change? Yes -> spec. No -> not spec.
2. **Divergence**: could two reasonable implementers produce different observable behavior if it stays unspecified? Yes -> the spec must pin it, usually with an example.
3. **Reversibility** (internal details only): cheap to change after code exists -> coding decides. Expensive -> `work-planner` decides.

## Ownership

| Stage | Owns |
|---|---|
| brain-storm | problem, users, workflow, v1 scope, vocabulary, success, numbered requirements with coarse acceptance |
| behavior-spec | business rules with real values, user-visible data and validation, lifecycle states, user-facing failure categories, measurable quality thresholds, external constraints, product interfaces, examples |
| work-planner | architecture, components, physical schema, internal APIs, libraries, sequencing, slices, test strategy, ADRs |
| coding | names, internal error handling, algorithms, small library picks, refactors |

## Rules
- one section per active requirement, keyed by its brain-storm ID; never renumber; omit retired IDs
- use canonical terms from `.workflow/language.md`; do not restate problem, users, workflow, or glossary
- state behavior in the present tense of the finished system
- bullet-first; omit any sub-bullet that adds nothing for that requirement
- data: logical, user-visible fields and validation only; never table, column, or storage type names
- failure: the externally observable outcome (rejected, category, what stays unchanged, service still usable); never exception types or code branches
- examples: Given/When/Then one-liners with concrete values, only where a rule fails the divergence test; every destructive, security, or validation rule gets at least one failure example
- quality thresholds are measurable (number, unit, condition)
- external constraints are imposed, not chosen: platform, hosting, language, required integrations, imposed formats, code that must be reused
- product interfaces only when the interface is the product (public API, user-facing CLI, file format others consume); internal routes and contracts belong to `work-planner`
- `Left To Planning` lists decisions deliberately not made here, so downstream skills know they are free
- `Assumptions` lists behavior decided here without a source or a user answer: `R#: <decision> - <reason>`; a reason calibrated from an artifact names it; omit when empty
- an Assumption the user later confirms or changes moves into the requirement and leaves `Assumptions`
- omit `Open Decisions` when empty; it holds only questions that change observable behavior

## Exclude
- current repo state, progress, readiness, or status
- architecture, layers, components, schema, libraries, internal APIs
- phases, slices, tasks, user stories, test cases
- amendment history or superseded discussion

## Skeleton

```md
# Behavior Spec - <Product Name>

## Sources
- Sessions: `context-....md`, `context-....md`
- Language: `.workflow/language.md`

## Target Outcome
- once v1 is done, ...

## Requirements

### R1 - <title>
- Rules: ...
- Data: `<Term>` has <field> (<validation>) ...
- States: a -> b -> c; <transition rule>
- Failure: <condition> -> rejected as `<category>`; <what stays unchanged>
- Examples:
  - Given ..., when ..., then ...
  - Given ..., when ..., then ... (failure)

## Quality Thresholds
- <quality need> -> <measurable threshold under condition>

## External Constraints
- <constraint> - <who imposes it>

## Product Interfaces
- <interface that is the product>: <observable contract>

## Left To Planning
- <decision deliberately not made here>

## Assumptions
- R#: <decision> - <reason>

## Open Decisions
- <question> - <which requirement it blocks and how behavior differs>
```

## Change Discipline
Update only when observable behavior changes: a rule, failure outcome, threshold, external constraint, or product interface is added, changed, or removed. Discoveries during planning or coding that do not change observable behavior go to plan artifacts. Changes to problem, users, workflow, scope, or vocabulary go back to `brain-storm`.

## Quality Bar
- `work-planner` can write a black-box acceptance scenario for every requirement without asking a question
- every capability states its failure outcomes
- nothing names a class, table, library, or internal endpoint unless an external constraint imposes it
- every unknown is either in `Left To Planning` or a blocking `Open Decision`
- every unsourced behavior decision is in `Assumptions`, and the same reasoning is applied consistently across rules
- nothing needs editing because code was written or a phase completed
