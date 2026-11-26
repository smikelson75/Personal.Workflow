---
name: behavior-spec
description: "Turn settled brain-storm requirements into a black-box behavior spec that work-planner and QA build from; decides the details, escalates only what needs the user."
argument-hint: "Name the product or the requirements to specify."
user-invocable: true
---

# Behavior Spec

Question rules: follow `.github/user-interaction.md`.
Core paths: when the environment variable WORKFLOW_HOME is set (Home layout), read each Workflow Core path written here as follows: .github/skills/ is $WORKFLOW_HOME/.claude/skills/, .github/agents/ is $WORKFLOW_HOME/.claude/agents/, .github/tools/ is $WORKFLOW_HOME/.workflow-core/tools/, .github/hooks/ is $WORKFLOW_HOME/.workflow-core/hooks/, .github/user-interaction.md is $WORKFLOW_HOME/.workflow-core/user-interaction.md; run every command from the Project Repo root and never from $WORKFLOW_HOME. Without WORKFLOW_HOME (copy layout) read the paths as written.

After `brain-storm`, expand every settled requirement into a black-box behavioral contract: observable rules, failure outcomes, examples, measurable quality thresholds, and constraints imposed from outside. `work-planner` sequences from it and derives black-box acceptance scenarios from it. Never design or plan here.

The user's intent was settled in `brain-storm`. What remains is mostly experience-based detail, so you decide it, record what you decided, and ask only what the user alone can answer.

Format, boundary tests, and stage ownership: [references/SPEC-FORMAT.md](references/SPEC-FORMAT.md).

## Inputs

1. `.workflow/language.md`
2. The active session chain in `.workflow/sessions/`: every `Status: final` session for this product not superseded by another. Apply retirements (`R4 - retired, superseded by R9`); only active requirement IDs are specified. Older sessions may say `deferred-to-PRD`; treat it as `deferred-to-spec`.
3. The existing `.workflow/specs/<artifact-slug>-spec.md`, if present.

Stop and redirect to `brain-storm` when: the newest session is a draft, no final session exists, requirement IDs collide, or the user's direction conflicts with the session chain or glossary.

Before reading the inputs, run `node .github/tools/workflow-check/bin/workflow-check.mjs` from the repo root. When any `error` Finding appears or the exit code is 2, stop, show the `error` Findings, and redirect to `brain-storm`. `warning` Findings do not stop it.

Do not read `.workflow/plans/` or survey the repo for progress. Read code or existing artifacts only to confirm an external constraint, an existing behavior the target must preserve, or a value to calibrate a threshold against.

## Artifact Naming

- `<artifact-slug>`: lowercase kebab-case from the product name in `language.md`, else from the session chain; ask if neither settles it.
- Keep the same slug across spec and plan artifacts.

## Contract

- The spec owns observable behavior only. Apply the three boundary tests (observability, divergence, reversibility) to every detail before it enters the spec.
- Specify by requirement ID; never invent requirements. A missing behavior is a new requirement: redirect to `brain-storm`.
- Do not restate problem, users, workflow, scope, or glossary; link the sources.
- When implementation questions come up (architecture, schema, libraries, internal APIs), do not answer them. Add them to `Left To Planning`, unless the user states they are imposed from outside, which makes them `External Constraints`.
- Write current truth only; no status, progress, or amendment log.

## Decide, Disclose, or Escalate

Classify every detail you pin:

| Class | When | Action |
|---|---|---|
| Sourced | follows directly from the session chain, glossary, or an imposed format | write it; no note |
| Assumed | not in the sources, but experience or existing artifacts give a defensible answer | decide it; add to `Assumptions` with a one-line reason |
| Escalate | one of the four cases below | ask the user, one question at a time |
| Redirect | every reasonable option reopens problem, users, workflow, scope, vocabulary, or a `brain-storm` format | redirect to `brain-storm`; do not ask |

Escalate only:

1. **Contradiction**: two sources disagree, or a requirement collides with a workflow rule (e.g. "never edit a prior session" vs "block on any error in any session").
2. **Destructive, security, privacy, or authorization behavior**: what is deleted, exposed, or permitted, and what confirms it.
3. **Ungrounded preference fork**: reasonable options give clearly different user experiences, and neither the sources nor existing artifacts favor one.
4. **Uncalibrated threshold**: a number with nothing to calibrate against (no existing artifact, measurement, or imposed limit). When a real artifact exists, calibrate against it and record it as Assumed (e.g. "the current session is ~1,000 words, so warn above 1,500").

When one option fits the settled sources and the others would reopen `brain-storm`, choose the fitting one and record it as Assumed. That is not a fork.

## Workflow

1. Validate inputs. Determine new spec or amendment; for an amendment, touch only requirements, thresholds, or constraints whose observable behavior changed.
2. Draft every requirement (start with `deferred-to-spec` items): rules, data, states, and failure outcomes. Classify each detail as above.
3. Failure pass. For each capability, check the externally observable adverse outcomes:
   - which invalid requests are rejected, and with what category
   - which safety or authorization boundaries apply
   - which unmet preconditions matter to the caller
   - which dependency failures need a stable diagnostic category
   - what stays unchanged after failure
   - whether the product stays usable after a failed request
4. Divergence pass. Wherever two reasonable implementers could build different observable behavior, pin it with a Given/When/Then example using concrete values. Every destructive, security, or validation rule gets at least one failure example.
5. Make quality needs measurable (number, unit, condition). Detail imposed formats and product interfaces only to the level a black-box test needs.
6. Self-check (see below). Fix what it finds; anything it turns into an escalation joins the queue.
7. Escalate the queued questions (see Conversation). Skip this step when the queue is empty.
8. Write or update the spec, including `Assumptions`, then return the brief.

## Self-Check

Before escalating or writing, review your own draft adversarially:

- **Consistency**: the same reasoning is applied the same way everywhere. If a noise, scope, or severity argument shaped one rule, every similar rule follows it or the difference is justified in `Assumptions`.
- **Acceptance**: what scenario could `work-planner` not write as a black-box test without asking a question?
- **Planning**: what would `work-planner` get wrong, over-build, or read as a free choice when it is not?
- **Self-impact**: does the spec contradict or trip over its own source sessions?

Resolve findings yourself. Never turn them into confirmation questions.

## Conversation

- Ask only escalations. Never ask the user to confirm a drafted requirement, a sourced detail, or an assumption.
- One question at a time, numbered (`Q1`, `Q2`, ...). Plain, full sentences; define unfamiliar terms. Each question gives which requirement it serves, which escalation case it is, why it matters (how behavior differs by answer), and 2-3 options with tradeoffs and a recommendation.
- If the user is unsure or pushes back, discuss before moving on; confirm brief open-ended or hedged answers before treating them as settled (a pick from the listed options is settled once restated).
- Push back on vague answers ("handles errors gracefully") by asking for a concrete example.

## Stop Rule

Stop drafting when every remaining detail fails both the observability and divergence tests. Those belong to planning or coding: list them under `Left To Planning`, do not pursue them. Never keep refining once the Quality Bar in the format is met.

## Commit

- Commit: every spec file you wrote or updated, in one commit `docs(<slug>): specify behavior`, without asking.
- Stop or redirect: write and commit nothing.
- Stage: only the files you wrote, by path; other changes stay unstaged and unchanged.
- Never: `git add -A`, push, or `--no-verify`.
- Clean handoff: when you finish, `git status --porcelain` lists only changes you did not make.
- On rejection: fix the cause if it lies in your own message or files and retry; otherwise stop and show the rejection output, leaving the files on disk.
- Messages: follow the `conventional-commit` skill's Message Rules with type `docs` and the artifact slug as scope.

## Exit
Write only when every active requirement meets the Quality Bar, or its gap is a blocking `Open Decision` the user has acknowledged.

Return a brief:

- requirements specified, and escalations asked with their answers
- `Assumptions`, grouped by requirement, highest impact first; say the user can amend any of them and that an amendment only rewrites the affected requirements
- blocking open decisions and `Left To Planning` items
- whether `work-planner` can proceed

The spec is the durable artifact; the brief is disposable.
