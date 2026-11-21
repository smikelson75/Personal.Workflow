# workflow-check plan

- Spec: [workflow-check-spec.md](../../specs/workflow-check-spec.md)
- Lane: standard
- Next: setup cards S01, S02 await approval; then phase review P01
- Tests locked: none (set at first phase review approval)

## Current state
- stack: none; repo holds only Markdown (skills, agents, `AGENTS.md`). Runtimes on the machine: node 25.9, python 3.13, dotnet 10, pwsh 7.6.
- harness: absent
- suite baseline: none exists (no tests, no CI)
- mutation: unsupported for node - Stryker is not installed and the spec forbids an install step
- repo is not a git repository; the test lock needs one
- in place: brain-storm and behavior-spec `SKILL.md` (integration points: brain-storm `## 4. Requirements Gate`/`## 5. Output`; behavior-spec `## Inputs`)
- gap to spec: R1-R12 and all quality thresholds absent

## Decisions pinned by the plan
- runtime: Node (zero dependencies, ES modules `.mjs`, built-in `node:test`); invoked `node .github/tools/workflow-check/bin/workflow-check.mjs [file]`; tool root `.github/tools/workflow-check/` (called `R` in cards)
- a missing section is anchored at line 1 (the spec's "heading line" has no heading to point at)

## Phases

| # | Phase | Status | Covers | Detail |
|---|-------|--------|--------|--------|
| P01 | Run, report, Session structure | planned | R1 (folder-level), R2 (Session rules), R6, R7, R9, R10 (CRLF/BOM), Q-message-length | [phase-01](phase-01.md) |
| P02 | Glossary structure, Chain, file argument | planned | R1 (chain failures, superseded Sessions), R2 (Glossary rules), R3, R8, R6 (warnings only) | |
| P03 | Vocabulary and Excess | planned | R4, R5 | |
| P04 | Skill integration and qualities | planned | R10 (no stdin/network), R11, R12, Q-speed, Q-determinism | |

## P01 slices

| # | Slice | Status |
|---|-------|--------|
| S01 | Initialize git repository | planned |
| S02 | Test harness and trace script | planned |
| S03 | Locate folder and print summary | planned |
| S04 | Folder-level Findings and output rules | planned |
| S05 | Session header Rules | planned |
| S06 | Session body Rules | planned |

## ADR candidates
- Node (zero-dependency ESM + `node:test`) as the `workflow-check` runtime - over Python stdlib (comparable fit, but weaker built-in test filtering for the harness), PowerShell/.NET (weaker Linux CI story, build step)
