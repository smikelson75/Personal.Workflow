# Phase Format

Purpose: `.workflow/plans/<artifact-slug>/phase-NN.md` holds what no single slice owns (invariants, harness, gate) and every slice card for the phase. It is written just in time, when the phase becomes active, and kept after the phase completes.

A card is the brief. The main session sends a `local` card's section verbatim to `coder`, adding only the materialized `Done when` command, and implements a `cloud` card itself. Either way, a weaker model given only that and the repo must finish without asking about intent.

## Phase Header

- **Outcome:** what a user can do when the phase completes
- **Covers:** requirement IDs and `Q-` threshold IDs; mark partial coverage (`R2 (failure handling only)`). The scenarios owned by this phase's cards are what the gate traces.
- **Invariants:** rules every slice keeps (naming, error shape, layering). Copy what a card needs into that card.
- **Harness:**
  - run: `<command>`, with how to select tests by scenario ID and how to exclude them
  - tag: how a test carries its scenario ID
  - count: how to read the number of tests that ran from the output
  - assert: a regex matching any line that states an expectation or a test title (for example `^\s*(assert|expect)|\btest\(`)
- **Known failures** (optional): pre-existing failing tests, each with its owning later phase
- **Gate:**
  - suite: `<full test command>`, excluding `Known failures`
  - traceability: `<command or procedure>` listing scenario IDs with a test that ran and passed
  - lock: `git diff --exit-code <Tests locked> -- <oracle paths>`
  - mutation: `<command scoped to files the phase changed>`, or `unsupported for <stack> - <reason>`

## Card Schema

Write cards in plain, literal sentences. No pronouns pointing at other cards and no "as discussed". Fields are mandatory unless marked optional.

- **Kind:** `build` (adds scenarios), `setup` (no scenarios), `fix` (restores failing scenarios), or `test-fix` (rewrites, strengthens, or repairs locked tests; never dispatched to `coder`)
- **Scope** (`test-fix` only): `fixture` (only fixture setup changes, every expectation stays the same; applied by Fixture Repair without the user) or `assertion` (what a test expects changes; approved by the user at phase review)
- **Goal:** one sentence describing the observable result
- **Depends on:** card IDs, or `none`
- **Tier:** `local` (`coder` agent) | `cloud` (main session) - one-line reason
- **Scenarios** (`build` only): `R3-01: Given <concrete>, when <concrete>, then <concrete>`, one per line. This card owns them. The Given names only the fault; the rest of the fixture is implicitly valid under the whole spec.
- **Restores** (`fix` and `test-fix` only): scenario IDs owned by other cards, plus the gate finding being addressed
- **Acceptance tests** (`build`, `test-fix`): paths written during phase review, including fixtures. Each card's tests live in files no other card uses. They are locked; implementers never edit them.
- **Files:** `create <path>` / `edit <path>`, the complete list
- **Patterns:** `<path>:<line> - <what to copy from it>`, at least one per new file
- **Decisions:** pinned facts such as names, signatures, data shapes, and error categories, stated as facts and not as options
- **Do not:** out-of-bounds files, behaviors, and dependencies; for coder kinds this always includes the oracle paths
- **Done when:** `<command>` exits 0, plus the target tests and expected count. Write it with the placeholder `{regression-exclude}`; the main session fills it in.
- **Stop and report if:** conditions under which the agent must stop rather than improvise. Always includes needing a file outside `Files`, needing to change a locked test (coder kinds), and the same failure after 3 attempts.
- **Outcome** (optional): written once on completion, only if the slice deviated from the card

## Materializing Done When

Just before dispatch, the main session replaces `{regression-exclude}` with the scenario IDs owned by cards that are not `completed`, other than this card's own. This snapshot is taken at dispatch time. The command then runs this card's targets plus every test of completed slices, and never runs another slice's deliberately failing tests. The sent command contains no placeholders. If there is nothing to exclude, remove the exclusion option entirely rather than passing an empty pattern.

## Pre-Dispatch Check

The main session runs these with plain file and command checks, not reasoning:

- every `edit` path and every `Patterns` path:line exists
- every `create` path does not exist yet
- oracle paths are unchanged since `Tests locked` (`standard` lane only)
- the materialized `Done when` command runs, selects the expected number of tests, and fails only on the target scenarios: this card's own for `build`, the `Restores` IDs for `fix`. For `setup`, the command just runs.

Any miss sets the slice to `blocked`.

## Fixture Repair Check

The main session runs these with commands, not reasoning, after `test-author` returns a `Scope: fixture` repair. `small` lane: diff against `HEAD` instead of `Tests locked`.

- `git diff --name-only <Tests locked> -- <oracle>` lists only this card's `Acceptance tests` paths
- `git diff -U0 <Tests locked> -- <this card's paths>` has no added or removed line matching the Harness `assert` regex
- the `Restores` tests pass, and the gate suite passes except for scenarios owned by cards that are not `completed`

Any miss fails the repair.

## Rules

- card IDs are `S01`, `S02`, ... in dependency order; fix cards from Triage continue the numbering
- each scenario has exactly one owning `build` card; `fix` and `test-fix` cards reference scenarios through `Restores` and never own them
- slices whose `Files` overlap never run in parallel
- a card states its own context: copy the invariants it needs rather than linking to the header
- keep each card under ~60 lines
- no status anywhere in this file
- for a Driver `Slice Run` repository, `slices.json` is generated from the cards (ID, title, `Depends on`, scenario IDs, tier) and never hand-edited

## Skeleton

```md
# P02 - <name>

- **Outcome:** ...
- **Covers:** R3, R4, Q-latency
- **Invariants:** ...
- **Harness:**
  - run: `npx mocha`; select `--grep "<ids>"`; exclude `--grep "<ids>" --invert`
  - tag: test title starts with `[R3-01]`
  - count: `N passing` line
  - assert: `^\s*(assert|expect)|\btest\(`
- **Gate:**
  - suite: `npx mocha`
  - traceability: `npx mocha --reporter json | node scripts/trace.js R3 R4 Q-latency`
  - lock: `git diff --exit-code <Tests locked> -- tests/acceptance`
  - mutation: `npx stryker run --mutate <phase-changed files>`

## S01 - <name>

- **Kind:** build
- **Goal:** ...
- **Depends on:** none
- **Tier:** local - mirrors an existing command handler
- **Scenarios:**
  - R3-01: Given ..., when ..., then ...
  - R3-02: Given ..., when ..., then ... (failure)
- **Acceptance tests:** `tests/acceptance/p02-s01.test.ts`, `tests/acceptance/fixtures/p02-s01/`
- **Files:** create `src/...`; edit `src/...`
- **Patterns:** `src/cli/check.ts:12 - command registration and exit-code handling`
- **Decisions:** ...
- **Do not:** edit `tests/acceptance/**`; add dependencies
- **Done when:** `npx mocha --grep "{regression-exclude}" --invert` exits 0; targets R3-01, R3-02; 2 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts
```
