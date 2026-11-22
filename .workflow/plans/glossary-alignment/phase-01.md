# P01 - Glossary, language-addons rename, and walkthrough alignment

- **Outcome:** `language-addons/` replaces `language-skills/` across all active files and suites with prior Sessions untouched, `.workflow/language.md` is verified against `workflow-check` with all 28 canonical terms, and all three stack walkthroughs use canonical vocabulary with no stale remarks.
- **Covers:** R29, R30, R31, Q-zero-workflow-check-errors, Q-zero-stale-language-skills-references
- **Invariants:**
  - Prior Session files in `.workflow/sessions/` are never modified.
  - Existing acceptance suites (`tests/acceptance/*.test.mjs`, `.github/tools/workflow-check/tests/acceptance/*.test.mjs`, `.github/tools/workflow-core/tests/acceptance/*.test.mjs`) must remain green.
  - All three walkthroughs preserve `calc-repl-walkthroughs-spec.md` R24–R28 and PowerShell backslash-path conventions.
- **Harness:**
  - run: `node --test --test-reporter=tap "tests/glossary-alignment/*.test.mjs"`; select `--test-name-pattern "<ids>"`; exclude `--test-skip-pattern "<ids>"`
  - tag: test title starts with `[R29-01]` or `[Q-zero-workflow-check-errors]`
  - count: `# pass N` and `# fail N` TAP summary lines
  - assert: `^\s*(assert\.|test\()`
- **Gate:**
  - suite: `node --test --test-reporter=tap "tests/glossary-alignment/*.test.mjs" "tests/acceptance/*.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node --test --test-reporter=tap "tests/glossary-alignment/*.test.mjs" | node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/glossary-alignment/phase-01.md R29-01 R29-02 Q-zero-workflow-check-errors R30-01 R30-02 R30-03 Q-zero-stale-language-skills-references R31-01 R31-02 R31-03`
  - lock: `git diff --exit-code <Tests locked> -- tests/glossary-alignment`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - Rename language-skills to language-addons and verify Glossary

- **Kind:** build
- **Goal:** Rename `language-skills/` to `language-addons/`, update all active `language-skills/` references while keeping prior Sessions immutable, and verify `.workflow/language.md` passes `workflow-check` with all 28 canonical terms.
- **Depends on:** none
- **Tier:** main - runs `git mv` on `language-skills/` and updates `tests/acceptance/p01-s03.test.mjs` (locked by completed plan `calc-repl-walkthroughs`)
- **Review:** required - destructive git rename, cross-plan test update, and no mutation gate
- **Scenarios:**
  - R29-01: Given `.workflow/language.md`, when parsed for `## Terms` and `## Retired`, then all 28 canonical terms (including the 13 added workflow terms) are present, `Slice` and `Card` are separate entries with no `Slice Card`, `Language Add-on` has `Code: language-addons/`, and term count is <= 40.
  - R29-02: Given a temporary Workflow Folder whose `.workflow/language.md` has invalid term syntax or duplicate Glossary terms, when `workflow-check` runs on it, then exit code is non-zero (failure).
  - Q-zero-workflow-check-errors: Given the repository's `.workflow/`, when `node .github/tools/workflow-check/bin/workflow-check.mjs` runs, then exit code is 0, stdout ends with `workflow-check: 0 errors,`, and zero Glossary error Findings appear on `.workflow/language.md`.
  - R30-01: Given the repository root, when inspected, then `language-addons/` exists with all 17 migrated files (including `language-addons/mutation-testing/protocol.md`, `node-typescript/`, `node-javascript/`, and `csharp/` add-ons) and `language-skills/` does not exist.
  - R30-02: Given `.workflow/language.md`, `docs/walkthrough-node.md`, `docs/walkthrough-typescript.md`, `docs/walkthrough-csharp.md`, and `tests/acceptance/p01-s03.test.mjs`, when inspected, then all links, PowerShell `Copy-Item` paths, and the forward-slash guard reference `language-addons`, and `node --test "tests/acceptance/*.test.mjs"` exits 0.
  - R30-03: Given `.workflow/sessions/`, when compared against commit `0344da1`, then zero Session files are modified and historical `language-skills/` references in `.workflow/sessions/context-2026-11-21-1442.md` remain untouched.
  - Q-zero-stale-language-skills-references: Given `.workflow/language.md`, `docs/walkthrough-*.md`, `language-addons/**`, `.github/**`, and `tests/acceptance/*.test.mjs`, when searched for `language-skills`, then zero occurrences exist.
- **Acceptance tests:** `tests/glossary-alignment/p01-s01.test.mjs`
- **Files:** move `language-skills/` to `language-addons/`; edit `docs/walkthrough-node.md`, `docs/walkthrough-typescript.md`, `docs/walkthrough-csharp.md`, `tests/acceptance/p01-s03.test.mjs`
- **Patterns:** `tests/acceptance/p01-s03.test.mjs:433 - forwardSlashPath regex listing top-level folders`
- **Decisions:**
  - Run `git mv language-skills language-addons` so all 17 files preserve their relative paths and git history.
  - In `docs/walkthrough-node.md` (lines 46, 62–65, 140, 154, 264), `docs/walkthrough-typescript.md` (lines 49, 65–68, 147), and `docs/walkthrough-csharp.md` (lines 35, 71, 87–89, 147), replace every `language-skills` path segment with `language-addons`, keeping backslash separators in PowerShell blocks.
  - In `tests/acceptance/p01-s03.test.mjs:433`, replace `language-skills` with `language-addons` inside `forwardSlashPath`, then verify `node --test "tests/acceptance/*.test.mjs"` exits 0.
  - Leave `.workflow/language.md` (already at 28 terms with `Code: language-addons/`) and all files in `.workflow/sessions/` untouched.
- **Do not:** edit `tests/glossary-alignment/**`; edit `.workflow/sessions/**`; edit `.github/**`; add dependencies
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern "{regression-exclude}" "tests/glossary-alignment/*.test.mjs"` exits 0; targets R29-01, R29-02, Q-zero-workflow-check-errors, R30-01, R30-02, R30-03, Q-zero-stale-language-skills-references; 7 target tests run
- **Stop and report if:** a file outside Files must change; a locked test in `tests/glossary-alignment/**` looks wrong; same failure after 3 attempts

## S02 - Align walkthroughs to canonical vocabulary

- **Kind:** build
- **Goal:** Update `docs/walkthrough-node.md`, `docs/walkthrough-typescript.md`, and `docs/walkthrough-csharp.md` to use canonical Glossary terms with zero avoided workflow synonyms, zero variant Checkpoint labels, and no stale file-write remark in `docs/walkthrough-csharp.md`.
- **Depends on:** S01
- **Tier:** delegate - straightforward prose replacements across three markdown docs with every occurrence pinned
- **Review:** none
- **Scenarios:**
  - R31-01: Given `docs/walkthrough-node.md`, when scanned for canonical terms and forbidden phrases, then all 10 canonical terms (`Workflow Core`, `Language Add-on`, `Setup-Card Approval`, `Phase Review`, `Gate`, `Card`, `Slice`, `Scenario`, `Tier`, `Behavior Spec`) appear (case-insensitive) and zero avoided workflow synonyms or variant Checkpoint labels appear.
  - R31-02: Given `docs/walkthrough-typescript.md`, when scanned for canonical terms and forbidden phrases, then all 10 canonical terms appear (case-insensitive) and zero avoided workflow synonyms or variant Checkpoint labels appear.
  - R31-03: Given `docs/walkthrough-csharp.md`, when scanned for canonical terms and forbidden phrases, then all 10 canonical terms appear (case-insensitive), zero avoided workflow synonyms or variant Checkpoint labels appear, and the stale `file writes/deletes` `Review: required` remark in Part 3 Step 3 is absent.
- **Acceptance tests:** `tests/glossary-alignment/p01-s02.test.mjs`
- **Files:** edit `docs/walkthrough-node.md`, `docs/walkthrough-typescript.md`, `docs/walkthrough-csharp.md`
- **Patterns:** `.workflow/language.md:14-28 - canonical spelling of Workflow Core, Language Add-on, Setup-Card Approval, Phase Review, Slice, Card`
- **Decisions:**
  - Replace `language skills` / `Language Skills` with `Language Add-ons` (`language skill` -> `Language Add-on`) in `docs/walkthrough-node.md` (lines 3, 21, 44, 61, 94, 96), `docs/walkthrough-typescript.md` (lines 3, 21, 47, 57, 64, 97), and `docs/walkthrough-csharp.md` (lines 3, 21, 69, 79, 86, 112).
  - Replace `core workflow` with `Workflow Core` in `docs/walkthrough-node.md` (lines 21, 44, 54), `docs/walkthrough-typescript.md` (lines 21, 47, 57), and `docs/walkthrough-csharp.md` (lines 21, 69, 79).
  - Replace `Setup-Card Checkpoint` with `Setup-Card Approval` (`docs/walkthrough-node.md:235`, `docs/walkthrough-typescript.md:240`, `docs/walkthrough-csharp.md:239`).
  - Replace `Phase Review Checkpoint` with `Phase Review` (`docs/walkthrough-node.md:245`, `docs/walkthrough-typescript.md:247`, `docs/walkthrough-csharp.md:246`).
  - In `docs/walkthrough-node.md:232`, replace `thin vertical slice cards` with `thin vertical Slices and their Cards` so both `Slice` and `Card` appear without `slice card`.
  - In `docs/walkthrough-csharp.md:248`, remove `(cards touching file writes/deletes will be flagged \`Review: required\`)` so the bullet matches `docs/walkthrough-node.md` and `docs/walkthrough-typescript.md`.
  - Preserve all `calc-repl-walkthroughs-spec.md` prompts, PowerShell blocks, and Part 1–5 structure (`node --test "tests/acceptance/*.test.mjs"` must still pass).
- **Do not:** edit `tests/glossary-alignment/**`; edit `tests/acceptance/**`; edit `.github/**`; edit `.workflow/**`; add dependencies
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern "{regression-exclude}" "tests/glossary-alignment/*.test.mjs"` exits 0; targets R31-01, R31-02, R31-03; 3 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; `tests/acceptance/*.test.mjs` regresses; same failure after 3 attempts

## S03 - Repair S01 fixture for executable paths with spaces

- **Kind:** test-fix
- **Scope:** fixture
- **Goal:** `[R30-02]` runs the acceptance suite when the node executable path contains spaces.
- **Depends on:** none
- **Tier:** main - fixture-only repair applied by Fixture Repair
- **Review:** none
- **Restores:** R30-02; gate finding: `process.execPath` is passed unquoted with `shell: true`, so a spaced path (`C:\Users\smmik\AppData\Local\Author Software\...`) is split by the shell
- **Acceptance tests:** `tests/glossary-alignment/p01-s01.test.mjs`
- **Files:** edit `tests/glossary-alignment/p01-s01.test.mjs`
- **Patterns:** `tests/glossary-alignment/p01-s01.test.mjs:180 - spawnSync call in R30-02`
- **Decisions:**
  - Quote the executable in the spawnSync call at line 180 only; no assertion or expectation changes.
- **Do not:** change any assertion; edit other tests or product files
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern "R31-01|R31-02|R31-03" "tests/glossary-alignment/*.test.mjs"` exits 0; targets R30-02
- **Stop and report if:** an expectation would need to change
