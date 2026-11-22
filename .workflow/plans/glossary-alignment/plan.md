# glossary-alignment plan

- Spec: [glossary-alignment-spec.md](../../specs/glossary-alignment-spec.md)
- Lane: standard
- Next: done
- Tests locked: `d80c964`
- Oracle: `tests/glossary-alignment`
- Phase base: `d80c964`
- Reconciled: `0344da116135006b9a6e0d8221bded6e1dbbea96`

## Current state
- stack: Node ES modules (`.mjs`, built-in `node:test`, zero dependencies); the product is `.workflow/language.md`, `language-addons/`, `docs/walkthrough-*.md`, and Workflow Core files under `.github/`.
- harness: `node --test --test-reporter=tap "tests/glossary-alignment/*.test.mjs"` - drives `.workflow/language.md`, `language-addons/`, `docs/walkthrough-*.md`, `.github/**`, and `workflow-check`; runs
- suite baseline: green (221 tests across `tests/glossary-alignment`, `tests/acceptance`, `workflow-check`, and `workflow-core`; `workflow-check` exits 0 with 0 errors, 7 warnings in `.workflow/sessions/`)
- mutation: unsupported for node - no mutation Language Add-on installed
- in place: `.workflow/language.md` has all 28 canonical terms; `language-addons/` replaces `language-skills/`; walkthroughs and `.github/` prose use canonical vocabulary; `pull-work`, `test-author`, and `test-reviewer` require `.workflow/language.md` (`glossary-check.mjs` Preflight redirect); `adr-writer` and `repo-scout` read it optionally; `coder` stays closed-world
- gap to spec: none

## Decisions pinned by the plan
- acceptance tests for this plan live in `tests/glossary-alignment/` so the `Oracle` is disjoint from `calc-repl-walkthroughs` (`tests/acceptance`) and `.github/` stays portable.
- `tests/acceptance/p01-s03.test.mjs:433` is locked by the completed `calc-repl-walkthroughs` plan; S01 runs as `Tier: main` and updates that single regex token (`language-skills` -> `language-addons`) alongside `git mv language-skills language-addons`.
- P02 will add a zero-dependency preflight helper script `.github/skills/pull-work/scripts/glossary-check.mjs` following `parse-args.mjs` so R33's missing-Glossary redirect is black-box testable.

## Phases

| # | Phase | Status | Covers | Detail |
|---|-------|--------|--------|--------|
| P01 | Glossary, language-addons rename, and walkthrough alignment | completed | R29, R30, R31, Q-zero-workflow-check-errors, Q-zero-stale-language-skills-references | [phase-01](phase-01.md) |
| P02 | Workflow Core prose and Glossary contracts | completed | R32, R33, R34, Q-zero-vocabulary-drift, Q-suite-preservation | [phase-02](phase-02.md) |

