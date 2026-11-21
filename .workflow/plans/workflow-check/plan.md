# workflow-check plan

- Spec: [workflow-check-spec.md](../../specs/workflow-check-spec.md)
- Lane: standard
- Next: phase review P02; blocked S03 - waits on S07
- Tests locked: `aa57551`
- Oracle: `.github/tools/workflow-check/tests`
- Phase base: `16d841e`

## Current state
- stack: Node ES modules under `.github/tools/workflow-check/` (`R`); runtimes on the machine: node 25.9, python 3.13, dotnet 10, pwsh 7.6.
- harness: `node --test --test-reporter=tap ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` (quoted glob; a directory argument fails on Node 25) - drives the CLI via `R/tests/support/harness.mjs`; runs
- suite baseline: green (21 tests); trace: `node R/scripts/trace.mjs <IDs>`
- mutation: unsupported for node - Stryker is not installed and the spec forbids an install step
- git repository on `main`; accepted ADR: [0001](../../adr/0001-node-runtime-for-workflow-check.md)
- in place: CLI with folder discovery, Finding formatting/sorting/summary, exit codes, Rule registry `R/src/rules/index.mjs` (folder rules, Session header and body Rules)
- gap to spec: R1 chain failures and superseded Sessions, Glossary structure Rules, R3, R4, R5, R8, warnings-only exit, R10 (no stdin/network), R11, R12, Q-speed, Q-determinism

## Decisions pinned by the plan
- runtime: Node (zero dependencies, ES modules `.mjs`, built-in `node:test`); invoked `node .github/tools/workflow-check/bin/workflow-check.mjs [file]`; tool root `.github/tools/workflow-check/` (called `R` in cards)
- a missing section is anchored at line 1 (the spec's "heading line" has no heading to point at)

## Phases

| # | Phase | Status | Covers | Detail |
|---|-------|--------|--------|--------|
| P01 | Run, report, Session structure | completed | R1 (folder-level), R2 (Session rules), R6, R7, R9, R10 (CRLF/BOM), Q-message-length | [phase-01](phase-01.md) |
| P02 | Glossary structure, Chain, file argument | in progress | R1 (no-final, superseded Sessions), R2 (Glossary rules), R3, R6 (warnings, mixed), R8 | [phase-02](phase-02.md) |
| P03 | Vocabulary and Excess | planned | R4, R5 | |
| P04 | Skill integration and qualities | planned | R10 (no stdin/network), R11, R12, Q-speed, Q-determinism | |

## P02 slices

| # | Slice | Status |
|---|-------|--------|
| S01 | Glossary structure Rules | completed |
| S02 | Chain model and Session status Rules | completed |
| S03 | Link Rules | blocked |
| S04 | Requirement ID Rules | ready |
| S05 | File argument | ready |
| S06 | Repair P01 fixtures for Chain Rules (test-fix, fixture) | completed |
| S07 | Repair R2-09 fixture for Link Rules (test-fix, assertion) | planned |
