# P03 - Reconcile Glossary count and Session immutability tests

- **Outcome:** the locked tests for R29-01 and R30-03 match the reconciled spec: the Glossary has no exact term count (only the 13 added terms and the 40-term cap), and only the four named prior Session files are immutable.
- **Covers:** R29 (term count only), R30 (Session immutability only)
- **Invariants:**
  - Only the expectations of `[R29-01]` and `[R30-03]` in `tests/glossary-alignment/p01-s01.test.mjs` change; every other test stays byte-identical.
  - Prior Session files are `context-2026-11-20-1124.md`, `context-2026-11-21-1442.md`, `context-2026-11-21-1750.md`, `context-2026-11-21-1859.md` in `.workflow/sessions/`; new Session files are allowed.
  - Term count is only bounded above by 40.
- **Harness:**
  - run: `node --test --test-reporter=tap "tests/glossary-alignment/*.test.mjs"`; select `--test-name-pattern "<ids>"`
  - tag: test title starts with `[R29-01]` or `[R30-03]`
  - count: `# pass N` and `# fail N` TAP summary lines
  - assert: `^\s*(assert\.|test\()`
- **Gate:**
  - suite: `node --test --test-reporter=tap "tests/glossary-alignment/*.test.mjs" "tests/acceptance/*.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node --test --test-reporter=tap "tests/glossary-alignment/*.test.mjs" | node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/glossary-alignment/phase-01.md R29-01 R30-03`
  - lock: `git diff --exit-code <Tests locked> -- tests/glossary-alignment`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - Relax Glossary count and Session immutability assertions

- **Kind:** test-fix
- **Scope:** assertion
- **Goal:** `[R29-01]` and `[R30-03]` pass with the 35-term Glossary and the added `context-2026-11-25-1955.md` Session, and still fail on a missing added term, a merged `Slice Card`, more than 40 terms, or a modified or deleted prior Session.
- **Depends on:** none
- **Tier:** main - changes locked assertions
- **Review:** none
- **Restores:** R29-01, R30-03 (spec reconciled; the locked assertions `exactly 28 terms` and `no change under .workflow/sessions` contradict it)
- **Acceptance tests:** `tests/glossary-alignment/p01-s01.test.mjs`
- **Files:** none
- **Decisions:**
  - `[R29-01]`: drop the `names.length === 28` assertion and the `28` in the title; keep the `<= 40` cap, the 13 added terms present, no `Slice Card`, and the `Language Add-on` `Code:` check.
  - `[R30-03]`: `git diff --name-only 0344da1 -- .workflow/sessions` filtered to the four prior Session file names must be empty (covers modification and deletion); added files are ignored; the historical `language-skills/` check stays.
- **Do not:** change any other test or fixture
- **Done when:** `node --test --test-reporter=tap "tests/glossary-alignment/*.test.mjs"` exits 0 with 26 tests run
