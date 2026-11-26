# Behavior Spec - Workflow Core

## Sources
- Sessions: `context-2026-11-21-1442.md` (builds on `context-2026-11-20-1124.md`)
- Language: `.workflow/language.md`
- Companion spec: [workflow-check-spec.md](workflow-check-spec.md) holds R2, R11, and R18 from the same Session.

## Target Outcome
- once v1 is done, brain-storm -> behavior-spec -> `/pull-work` reaches `done` with every stage starting from a clean working tree, stops only at Checkpoints, takes in spec changes and defect reports without hand edits, and reaches `done` only when every spec rule has a passing acceptance test in each capability it governs.

## Requirements

### R13 - planner commits and hands back
- Rules:
  - The `planner` agent runs work-planner's Plan mode only, including the setup-card Checkpoint when the phase opens with setup cards.
  - When `plan.md` and the active phase file are written, it commits them, with any ADR it wrote in the same run, as one commit `docs(<slug>): plan PNN`, staging by path only files it wrote.
  - It then ends its run by stating the `Next` line and telling the Developer to continue with `/pull-work` in the main session. It never runs Phase Review, Dispatch, or any later mode, and never writes acceptance tests.
- Failure:
  - commit rejected (for example by a hook) -> the planner fixes the cause when it lies in its own message or files and retries; otherwise it stops and shows the rejection output. Written files stay on disk. It never bypasses hooks.
- Examples:
  - Given a clean tree and a spec with no plan, when the planner finishes Plan mode with `Next: phase review P01`, then HEAD is `docs(<slug>): plan P01` containing `plan.md` and `phase-01.md`, `git status --porcelain` is empty, and no P01 acceptance test file exists.
  - Given a hook rejects the commit for a reason outside the planner's files, when the planner commits, then it stops, shows the hook output, and `plan.md` stays on disk uncommitted (failure).

### R14 - Traceability honors Known Failures
- Data: a `Known failures` entry in a phase header names one test as the harness reports it, and its owning phase `PNN`.
- Rules:
  - The Gate's traceability step passes when every scenario ID owned by the gated phase's cards has a test that ran and passed, and every failing test is a Known Failure listed in the gated phase with an owning phase later than it.
  - A Known Failure is excluded only from gates of phases before its owning phase; in its owning phase it counts like any other test.
  - A Known Failure never satisfies an owned scenario ID.
  - A listed Known Failure that passes does not fail traceability.
  - The suite step and the traceability step exclude the same tests.
- Failure:
  - an unlisted failing test -> traceability fails and names the test.
  - an owned scenario ID with no passing test -> traceability fails and names the ID.
  - either failure sets `Next: triage PNN` (existing Gate behavior).
- Examples:
  - Given P02 lists Known Failure `legacy import keeps BOM` owned by P04, and every P02 scenario passes, when the P02 gate runs traceability, then it passes.
  - Given the same P02 plus an unlisted failing test `[R3-02] duplicate ID errors`, when traceability runs, then it fails naming `[R3-02] duplicate ID errors` (failure).
  - Given P04 is gated and `legacy import keeps BOM` still fails, when traceability runs, then it fails naming that test (failure).

### R15 - Plan shows current truth after a phase completes
- Rules: in the commit that completes phase `PNN`, `plan.md`:
  - shows phase `PNN` as `completed` in the phase table
  - has no `PNN` slice table
  - has a gap to spec that lists exactly the requirement and threshold IDs not yet covered by completed phases, with a partial marker for partly covered IDs, and reads `none` when `Next: done`
  - has no `Review pending` line
  - has Current state lines (harness, suite baseline, in place) that describe the repository after the phase
- Examples:
  - Given P04 covers R11 and R12 and completes, when its completion commit is made, then `plan.md` names neither R11 nor R12 in the gap and has no `P04 slices` heading.
  - Given P02 covers `R2 (failure handling only)` and completes, then the gap still lists R2 with a partial marker.

### R16 - Every spec rule is tested in each capability it governs
- Data: a spec rule governs each capability it names or applies to: a Rule ID, command, skill, agent, product interface, or requirement. A rule that applies to a class (for example "every Rule except `structure`") governs each member the spec enumerates.
- Rules:
  - Planning derives at least one scenario per pair of spec rule and governed capability. The card that adds a capability owns the scenarios for every earlier spec rule that governs it.
  - A rule about how a skill or agent behaves is tested through stable markers in its text (commands, commit message templates, file paths, labels), never by matching sentences. A pair with no stable marker and no other black-box test is presented at Phase Review as not expressible and listed in the phase file; it is never dropped silently.
  - `Next: done` is set only when every pair has a passing scenario or an approved not-expressible entry; the plan's gap names any pair without one.
- Failure: a pair with neither a passing scenario nor an approved not-expressible entry -> the plan does not reach `done`.
- Examples:
  - Given workflow-check R3 exempts superseded Sessions from four Rules, when planned, then four scenarios exist, one per Rule, each with a superseded Session that would otherwise trigger that Rule and expecting no Finding from it.
  - Given a later phase adds `vocabulary/avoid-synonym` and workflow-check R1 limits superseded Sessions to `structure` and `chain/broken-link` Findings, when that phase is planned, then the card adding the Rule owns a scenario where a superseded Session uses an Avoid word and gets no warning.
  - Given one pair has no passing scenario, when the last planned phase completes, then `Next` is not `done` (failure).

### R17 - Mutation is unsupported without a mutation Language Add-on
- Rules:
  - A mutation Language Add-on is installed when `.github/skills/` contains a skill that supplies a mutation command for the repository's stack.
  - With none installed, Plan mode records `mutation: unsupported for <stack> - no mutation Language Add-on installed` in Current state and in each phase Gate's mutation line. The Gate skips mutation and treats it as passed. No question about mutation goes to the Developer.
  - Every `main` card carries `Review: required - no mutation gate` (existing rule).
  - An add-on installed later takes effect at the next Plan mode.
- Examples:
  - Given a repository with no mutation Language Add-on, when `/pull-work` runs to `done`, then `plan.md` records mutation unsupported, no Gate routes to triage for mutation, and no Developer question mentions mutation.

### R19 - brain-storm and behavior-spec commit their own output
- Rules:
  - When brain-storm finishes, it commits its Session file and, when changed, the Glossary, in one commit, without asking. A `draft` Session from an early exit is committed the same way.
  - When brain-storm stops on an error anchored at a prior Session (workflow-check R11), it still commits its own Session and Glossary, then reports.
  - When behavior-spec writes or updates specs, it commits every spec file it wrote in one commit, without asking. When it stops or redirects, it writes and commits nothing.
  - Each stage stages by path only files it wrote; other changes stay unstaged and unchanged. It never pushes.
  - Messages follow conventional-commit's Message Rules with type `docs`; behavior-spec uses the artifact slug as scope.
- Failure:
  - commit rejected -> same as R13: fix own cause and retry, otherwise stop and show the output; never bypass hooks; files stay on disk.
- Examples:
  - Given a clean tree, when brain-storm finishes a final Session, then HEAD holds the Session and `.workflow/language.md`, `git status --porcelain` is empty, and the next `/pull-work` passes Preflight.
  - Given the Developer ends brain-storm early, when it finishes, then the `Status: draft` Session is committed.
  - Given `src/app.js` is modified before behavior-spec starts, when it commits, then the commit holds only spec files and `src/app.js` stays modified and unstaged (failure).

### R20 - `/pull-work` routes spec changes to planning
- Rules:
  - Each plan records the spec commit it last reconciled with (its reconcile point). Plan mode and every reconcile set it.
  - The spec changed when the spec file's content at HEAD differs from its content at the reconcile point. Uncommitted spec edits are not changes. A plan with no reconcile point counts as changed.
  - Preflight candidates are: plans whose `Next` is not `done`, `done` plans whose spec changed, and specs with no plan. One candidate is selected directly; several mean one question listing them (existing).
  - When the selected plan's spec changed, `/pull-work` loads work-planner before routing on `Next`. Planning maps changed rules to new or revised work, updates the gap, phases, and cards, records the new reconcile point, commits `docs(<slug>): reconcile spec`, and routing continues from the new `Next`.
  - A `done` plan gets a new phase `PNN+1` for the change; completed phases stay `completed`.
  - Mid-phase, the reconcile runs at the next Preflight, before any Dispatch: unstarted cards are revised, and completed slices the change invalidates get fix or test-fix work.
  - A change that needs no new work moves only the reconcile point; `Next` is unchanged.
- Failure:
  - the plan's spec file is missing -> redirect to behavior-spec; plan unchanged.
  - a changed requirement has a blocking Open Decision -> redirect to behavior-spec (existing work-planner rule); plan unchanged.
- Examples:
  - Given the workflow-check plan at `Next: done` and its spec amended in a later commit, when `/pull-work` runs, then it plans the change and `Next` is no longer `done`.
  - Given a `done` plan whose reconcile point matches the spec at HEAD, when `/pull-work` runs, then it reports the plan complete and changes nothing.
  - Given a `done` plan with no reconcile point, when `/pull-work` runs, then it reconciles once and records a reconcile point.

### R21 - Defect reports through `/pull-work`
- Rules:
  - Form: `/pull-work [<slug>] bug: <description>`. The description is all text after `bug:`, trimmed, and must be non-empty.
  - Preflight (clean tree, plan selection, spec reconcile) runs first.
  - Planning classifies the report: built behavior that breaks the spec -> fix work whose scenario reproduces the defect, failing before the fix; spec silent or wrong -> redirect to behavior-spec; new behavior -> redirect to brain-storm. A redirect leaves the plan unchanged.
  - Fix work goes into a new phase `PNN+1` for a `done` plan, otherwise into the active phase. Either way `Next` becomes `phase review PNN`, so the reproducing tests reach the Developer at the Phase Review Checkpoint.
  - The Developer's description appears verbatim on the fix card. The planning commit follows pull-work's Commits.
- Failure:
  - empty description -> a usage line `/pull-work [<slug>] bug: <description>`; nothing changes; no question.
  - no plan exists for the slug, or none at all -> reported; nothing changes.
- Examples:
  - Given the `done` workflow-check plan, when `/pull-work bug: superseded Sessions get vocabulary warnings`, then a new phase holds a card whose scenario is a superseded Session using an Avoid word with no warning expected, and `Next: phase review P05`, with no hand edits.
  - Given `/pull-work bug:` with nothing after it, when run, then the usage line is shown and the plan is unchanged (failure).
  - Given `/pull-work bug: add CSV export`, when classified as new behavior, then it redirects to brain-storm and the plan is unchanged.

### R22 - User-interaction rules travel with the Workflow Core
- Rules:
  - One file under `.github/` holds the user-interaction rules:
    - give context with each question: where the work stands, why the answer matters, and options with tradeoffs plus a recommendation when the answer space is known
    - ask one question at a time in plain language, defining unfamiliar terms
    - keep a conversational, unrushed pace: discuss when the Developer is unsure or pushes back, and confirm brief answers before treating them as settled
    - token savings never come from shortening what the Developer reads
  - Every skill and agent under `.github/` that asks the Developer a question refers to that file: brain-storm, behavior-spec, work-planner, pull-work, adr-writer, conventional-commit, and the `planner` agent.   Only the `onboard-project` and `agents-md` skills (and their reference files) may name `AGENTS.md`, because they assess or write a Project Repo's own `AGENTS.md`; no other file under `.github/` refers to it.
   - No Workflow Core skill or agent requires `AGENTS.md` to exist in order to run. `agents-md` creates one when absent; `onboard-project` reports it missing as a finding.
  - `coder`, `test-author`, `test-reviewer`, and `repo-scout` never ask the Developer; they stop and report to their caller.
  - Skill-specific question formats (brain-storm's question format, behavior-spec's Conversation) add to the rules and never contradict them. A Checkpoint (R23) counts as one question.
- Examples:
  - Given `.github/` copied into a repository without `AGENTS.md`, when its files are searched for `AGENTS.md`, then every matching file is under `.github/skills/onboard-project/` or `.github/skills/agents-md/`, and each asking skill and agent names the rules file.
  - Given a repository without `AGENTS.md`, when `/agents-md` runs, then it creates one and does not stop for its absence; when `/brain-storm` runs there, it proceeds with no mention of `AGENTS.md` (failure boundary: no other skill is blocked).
  - Given a new reference to `AGENTS.md` in `.github/skills/pull-work/SKILL.md`, when files are searched, then the match is outside the two named skills and the rule is violated.

### R23 - A Checkpoint is one bundled question
- Rules:
  - Checkpoints are: setup-card approval in Plan mode, Phase Review, and an ADR candidate raised by Revise when no Phase Review follows. Phase completion is a planned stop with a brief and no question.
  - A Checkpoint presents every item at once, each with a label (card ID such as `S03`, ADR candidate such as `A1`, not-expressible scenario by its scenario ID), then asks one question: approve all, or name items.
  - Approve all -> every item is approved and the run continues with no further question.
  - Naming items -> unnamed items are approved; named items are discussed one at a time in the order named, following R22. Each ends approved, changed and approved, or rejected. After the last one, the Checkpoint completes without asking the bundle again.
  - A change agreed for a named item that alters another item's tests or Decisions adds that item to the discussion.
- Examples:
  - Given a Phase Review with S01-S04 and A1, when the Developer answers "approve", then exactly one question was asked and S01-S04 are `ready`.
  - Given the same Checkpoint, when the Developer answers "S03", then S01, S02, S04, and A1 are approved and the next message is one question about S03 only.
  - Given the answer "A1 and S02", then A1 is discussed first, then S02, one question at a time.

## Quality Thresholds
- Clean handoff -> given a clean tree at its start, `git status --porcelain` is empty when brain-storm, behavior-spec, the `planner` agent, or any `/pull-work` stop finishes (except Phase Review's tests awaiting approval, per pull-work Preflight).
- Checkpoint cost -> a Checkpoint where the Developer names no items costs exactly 1 Developer question.

## External Constraints
- Session and Glossary formats - owner: brain-storm.
- Plan and phase formats - owner: work-planner.
- Commit Message Rules - owner: conventional-commit skill.
- The workflow runs in a git repository; commits are the handoff between stages - pull-work Preflight and Commits.
- The Workflow Core is copied into target repositories without `AGENTS.md` and must not depend on it - session constraint; `onboard-project` and `agents-md` may name it per R22 but still run without it.
- No user steps beyond existing Checkpoints - session constraint.
- Language Add-ons (their mutation protocol and trace scripts) are out of scope - session scope.

## Product Interfaces
- `/brain-storm <idea>`, `/behavior-spec [<slug>]`, `/pull-work [<slug>] [bug: <description>]`, and the `planner` agent: the commands the Developer runs; behavior as specified above.

## Left To Planning
- Location and name of the user-interaction rules file, and how skills refer to it.
- How the plan records its reconcile point, and how the spec comparison runs.
- How Known Failures reach the traceability command.
- How the `planner` agent gains the ability to commit.
- How mutation Language Add-on detection works.
- How acceptance tests observe skill and agent text (R16's stable markers; the companion spec's R18 shows the reword-tolerance standard).
- Card kinds used for reconcile and defect-fix work.
- Commit subject wording within the Message Rules.

## Assumptions
- R16: rules about skill or agent behavior are tested only through stable markers, and a pair without one is approved at Phase Review as not expressible - sentence matching breaks on rewording (R18), and running agents in tests spends tokens.
- R16: a class rule governs each enumerated member, and the card adding a capability owns scenarios for earlier rules governing it - the Session's aim is that every rule is tested wherever it applies, not only in its first card.
- R20: a plan with no reconcile point counts as changed - lets the existing `done` workflow-check plan take in this Session's amendments (R20's Accept).
- R20: mid-phase changes reconcile at the next Preflight, not at phase end - building to a stale spec is the trust gap the Session targets.
- R20: only committed spec content counts; a change needing no work moves only the reconcile point - R19 commits every spec change, and dirty trees already stop Preflight.
- R19: an early-exit draft Session is committed - it is the resume point and an uncommitted draft Stalls `/pull-work`; the rejected "abandoned drafts" concern was about `/pull-work` committing files it cannot judge.
- R19: brain-storm commits its own output even when stopping on a prior-Session error - its own files are error-free, and leaving them uncommitted adds a Stall.
- R13, R19: stage only own files, never push, never bypass hooks, fix and retry own rejections - conventional-commit's rules for workflow commits.
- R21: argument form `[<slug>] bug: <description>` - the Accept shows `bug:`; the slug prefix matches the existing argument.
- R21: a `done` plan gets a new phase; fix tests go through Phase Review - keeps completed phases as history-free current truth (R15) and uses an existing Checkpoint.
- R21: an empty description shows a usage line rather than asking - nothing changes and the fix is one retyped command.
- R23: naming items approves the unnamed ones - "approve it all or name items" implies it, and avoids a second bundled question.
- R23: the Checkpoint list and phase completion as a question-free stop - taken from work-planner's existing checkpoints.
- R22: rules content is AGENTS.md's User Interaction section; subagents never ask - the rules being moved; subagents already stop and report.
- R22: the `AGENTS.md` ban is narrowed to an allow-list of `onboard-project` and `agents-md`, not a move of those skills outside `.github/` - their purpose is the Project Repo's `AGENTS.md` (R44, onboarding), and skill discovery locations are imposed by the Harnesses so a move would stop them loading; the session's real constraint, no dependence on it, is kept by the "requires to exist" rule.
- R17: an installed add-on whose tool cannot run is left to Plan mode - Language Add-ons are out of scope.
- R14: a Known Failure is excluded only before its owning phase; a passing one does not fail - "owning later phase" in the Glossary; debt fixed incidentally is not a defect.
- R14: applies to the Workflow Core's Gate and trace script; Language Add-on trace scripts are out of scope - Session scope.
- R15: partial coverage stays in the gap with a marker, and the gap reads `none` at `done` - matches PLAN-FORMAT's `R2 partial` example.
- R13: the planner handles the setup-card Checkpoint - it is part of Plan mode.
