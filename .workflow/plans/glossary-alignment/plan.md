# glossary-alignment plan

- Spec: [glossary-alignment-spec.md](../../specs/glossary-alignment-spec.md)
- Lane: standard
- Next: P01 S02
- Tests locked: `0fcc4f8`
- Oracle: `tests/glossary-alignment`
- Phase base: `bfd0b22`
- Reconciled: `0344da116135006b9a6e0d8221bded6e1dbbea96`

## Current state
- stack: Node ES modules (`.mjs`, built-in `node:test`, zero dependencies); the product is `.workflow/language.md`, `language-addons/`, `docs/walkthrough-*.md`, and Workflow Core files under `.github/`.
- harness: `node --test --test-reporter=tap "tests/glossary-alignment/*.test.mjs"` - drives `.workflow/language.md`, `language-addons/`, `docs/walkthrough-*.md`, `.github/**`, and `workflow-check`; runs
- suite baseline: green (195 tests: 21 in `tests/acceptance`, 89 in `workflow-check`, 85 in `workflow-core`; `workflow-check` exits 0 with 0 errors, 7 warnings in `.workflow/sessions/`)
- mutation: unsupported for node - no mutation Language Add-on installed
- in place: `.workflow/language.md` has all 28 canonical terms (13 added, `Slice` and `Card` separate, `Language Add-on` `Code: language-addons/`); `language-skills/` still at repo root (17 files); walkthroughs and `.github/` still carry `language-skills/` paths, avoided synonyms, and variant Checkpoint labels; `pull-work`, `test-author`, `test-reviewer`, `adr-writer`, and `repo-scout` lack `.workflow/language.md` input contracts
- gap to spec: R29, R30, R31, R32, R33, R34, Q-zero-workflow-check-errors, Q-zero-stale-language-skills-references, Q-zero-vocabulary-drift, Q-suite-preservation

## Decisions pinned by the plan
- acceptance tests for this plan live in `tests/glossary-alignment/` so the `Oracle` is disjoint from `calc-repl-walkthroughs` (`tests/acceptance`) and `.github/` stays portable.
- `tests/acceptance/p01-s03.test.mjs:433` is locked by the completed `calc-repl-walkthroughs` plan; S01 runs as `Tier: main` and updates that single regex token (`language-skills` -> `language-addons`) alongside `git mv language-skills language-addons`.
- P02 will add a zero-dependency preflight helper script `.github/skills/pull-work/scripts/glossary-check.mjs` following `parse-args.mjs` so R33's missing-Glossary redirect is black-box testable.

## Phases

| # | Phase | Status | Covers | Detail |
|---|-------|--------|--------|--------|
| P01 | Glossary, language-addons rename, and walkthrough alignment | in progress | R29, R30, R31, Q-zero-workflow-check-errors, Q-zero-stale-language-skills-references | [phase-01](phase-01.md) |
| P02 | Workflow Core prose and Glossary contracts | planned | R32, R33, R34, Q-zero-vocabulary-drift, Q-suite-preservation | |

## P01 slices

| # | Slice | Status |
|---|-------|--------|
| S01 | Rename language-skills to language-addons and verify Glossary | completed |
| S02 | Align walkthroughs to canonical vocabulary | ready |
| S03 | Repair S01 fixture for executable paths with spaces | completed |
