# workflow-check plan

- Spec: [workflow-check-spec.md](../../specs/workflow-check-spec.md)
- Lane: standard
- Next: P05 S01, S04, S06
- Tests locked: `c83391b`
- Oracle: `.github/tools/workflow-check/tests`
- Phase base: `c83391b`
- Reconciled: `d6d5e19ee9088934b981bf29e8c924cb380fb0fc`

## Current state
- stack: Node ES modules under `.github/tools/workflow-check/` (`R`); runtimes on the machine: node 25.9, python 3.13, dotnet 10, pwsh 7.6.
- harness: `node --test --test-reporter=tap ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` (quoted glob; a directory argument fails on Node 25) - drives the CLI via `R/tests/support/harness.mjs`; runs
- suite baseline: green (49 tests); trace: `node R/scripts/trace.mjs <IDs>`
- mutation: unsupported for node - Stryker is not installed and the spec forbids an install step
- git repository on `main`; accepted ADR: [0001](../../adr/0001-node-runtime-for-workflow-check.md)
- in place: CLI with folder discovery, Finding formatting/sorting/summary, exit codes, Rule registry `R/src/rules/index.mjs` (folder rules, Session header and body Rules)
- in place (P02): Glossary structure, Chain model `R/src/chain.mjs`, Chain Rules, file argument, warnings-only exit
- gap to spec: R2 partial, R11 partial, R12 partial, R18

## Decisions pinned by the plan
- runtime: Node (zero dependencies, ES modules `.mjs`, built-in `node:test`); invoked `node .github/tools/workflow-check/bin/workflow-check.mjs [file]`; tool root `.github/tools/workflow-check/` (called `R` in cards)
- a missing section is anchored at line 1 (the spec's "heading line" has no heading to point at)

## Phases

| # | Phase | Status | Covers | Detail |
|---|-------|--------|--------|--------|
| P01 | Run, report, Session structure | completed | R1 (folder-level), R2 (Session rules), R6, R7, R9, R10 (CRLF/BOM), Q-message-length | [phase-01](phase-01.md) |
| P02 | Glossary structure, Chain, file argument | completed | R1 (no-final, superseded Sessions), R2 (Glossary rules), R3, R6 (warnings, mixed), R8 | [phase-02](phase-02.md) |
| P03 | Vocabulary and Excess | completed | R4, R5 | [phase-03](phase-03.md) |
| P04 | Skill integration and qualities | completed | R10 (no stdin/network), R11, R12, Q-speed, Q-determinism | [phase-04](phase-04.md) |
| P05 | Size-based sections and reword-proof skill checks | in progress | R2 (sections by Size), R11 (command), R12 (command), R18 | [phase-05](phase-05.md) |

## P05 slices

| # | Slice | Status |
|---|-------|--------|
| S01 | Required sections follow Size | ready |
| S02 | Repair the R2-05 expectation | completed |
| S03 | CONTEXT-FORMAT states required sections by Size | ready |
| S04 | The suite checks skills only by command | ready |
| S05 | Skill tests drop wording checks | completed |
| S06 | brain-storm checks the whole folder | ready |
