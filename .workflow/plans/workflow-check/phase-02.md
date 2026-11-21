# P02 - Glossary structure, Chain, file argument

- **Outcome:** `workflow-check` also checks the Glossary's structure, computes the Session Chain, reports Chain Rules, supports warnings-only runs, and accepts a file argument that limits printed Findings to one file.
- **Covers:** R1 (no-final, superseded Sessions), R2 (Glossary Rules), R3, R6 (warnings and mixed runs), R8
- **Invariants:**
  - `R` = `.github/tools/workflow-check`. ES modules (`.mjs`), no dependencies, Node built-ins only.
  - Finding line: `<path>:<line>: <severity>: <rule-id>: <message>`; path repo-relative with `/`; line 1-based; message one line, at most 160 characters; LF endings. Last stdout line `workflow-check: <E> errors, <W> warnings`.
  - A Rule is `{id, severity, check(folder) -> [{path, line, message}]}` registered in `R/src/rules/index.mjs` (`RULES`). Severity is fixed per Rule. Rules skip Docs with `unreadable: true`.
  - Session header helper: `headerFields(doc)` in `R/src/rules/session-header.mjs` returns `{Field: {value, line}}`.
  - Missing sections and missing fields are anchored at line 1.
  - Exit 0 when no printed error, 1 when at least one, 2 when the run cannot start (one stderr line, empty stdout, no summary).
  - Never write, create, or delete anything.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R3-01]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Gate:**
  - suite: `node --test ".github/tools/workflow-check/tests/acceptance/*.test.mjs"`
  - traceability: `node .github/tools/workflow-check/scripts/trace.mjs <IDs owned by P01 and P02>`
  - lock: `git diff --exit-code <Tests locked> -- .github/tools/workflow-check/tests`
  - mutation: unsupported for node - no mutation tool is installed and the spec forbids an install step

## S01 - Glossary structure Rules

- **Kind:** build
- **Goal:** a Glossary missing `## Terms` or `## Retired`, or holding a malformed Term or Retired line, yields `structure` errors.
- **Depends on:** none
- **Tier:** main - implemented in the main session before tiers were renamed
- **Review:** required - no mutation gate
- **Scenarios:**
  - R2-11: Given a Glossary with `# Language` and `## Terms` (one valid Term) but no `## Retired`, when run, then `structure/glossary-section` error at `.workflow/language.md:1`
  - R2-12: Given Terms line 4 `- Finding - a reported break` (no backticks), when run, then `structure/glossary-term-format` error at `.workflow/language.md:4` (failure)
  - R2-13: Given Retired line `` - `Old` -> `New` `` (no reason), when run, then `structure/glossary-term-format` error at that line (failure)
  - R2-14: Given Terms line `` - `Finding` - a reported break. Avoid: issue. States: open -> closed. Code: `.workflow/` `` and Retired line `` - `Old` -> `New` - renamed ``, when run, then no Finding
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p02-s01.test.mjs`
- **Files:** create `R/src/rules/glossary.mjs`; edit `R/src/rules/index.mjs`
- **Patterns:** `R/src/rules/session-body.mjs:11 - sectionMap (private; write an equivalent in glossary.mjs, do not edit or export the original)`; `R/src/rules/folder.mjs:1 - Rule object shape`
- **Decisions:**
  - Export `glossaryRules` with `structure/glossary-section` and `structure/glossary-term-format`, both `error`; append to `RULES`.
  - Applies only when `folder.glossary` exists and is not unreadable. Sections are lines matching `^## (.+)$`, case-sensitive. A missing `Terms` or `Retired` yields one Finding each, line 1, message `Glossary is missing required section: ## <name>`.
  - Lines of a section are the lines after its heading until the next `## ` heading. Blank lines are ignored.
  - Term line regex: `` ^- `[^`]+` - \S.*$ ``. Retired line regex: `` ^- `[^`]+` -> `[^`]+` - \S.*$ ``. Any other non-blank line in those sections is a `structure/glossary-term-format` Finding at that line.
- **Do not:** edit `R/tests/**`; add dependencies; check vocabulary or sizes.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R2-11, R2-12, R2-13, R2-14; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S02 - Chain model and Session status Rules

- **Kind:** build
- **Goal:** the Session Chain is computed, and no-final, newest-draft and stale-draft Sessions are reported; warnings-only runs pass.
- **Depends on:** S01
- **Tier:** main - creates the Chain model the other Chain cards use
- **Review:** required - creates the Chain model later cards build on
- **Scenarios:**
  - R1-07: Given two draft Sessions A (older) and B (newer), when run, then `chain/no-final` error at B line 1
  - R3-04: Given final A and draft B (newer), when run, then `chain/draft-newest` error at B line 1 and no other `chain/` Finding
  - R3-05: Given draft A (older) and final B, when run, then `chain/stale-draft` warning at A line 1 and nothing else
  - R6-01: Given the R3-05 folder, when run, then exit 0 and stdout ends `workflow-check: 0 errors, 1 warnings`
  - R6-02: Given drafts A, B, C (older) and final D whose `- Size:` line is missing, when run, then exit 1 and stdout ends `workflow-check: 1 errors, 3 warnings`
  - R1-08: Given draft A and final C where C has `- Supersedes: ` + backticked A's name, and A is not the newest, when run, then no `chain/stale-draft` Finding at A
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p02-s02.test.mjs`
- **Files:** create `R/src/chain.mjs`, `R/src/rules/chain-status.mjs`; edit `R/src/run.mjs`, `R/src/rules/index.mjs`
- **Patterns:** `R/src/rules/session-header.mjs:11 - headerFields usage`; `R/src/run.mjs:16 - rule loop`
- **Decisions:**
  - `chain.mjs` exports `buildChain(folder)` returning `{status, links, superseded, chain, newest}`: `status` Map name -> `'final'|'draft'|undefined` (from `headerFields(doc).Status.value`; unreadable Sessions are undefined); `links` Map name -> `{buildsOn: [{target, line}], supersedes: [{target, line}]}` where targets are every backticked `context-...md` name in the field value, one entry each; `superseded` Set of names listed by a `final` Session's `supersedes` that exist in `folder.sessions` and differ from the lister; `chain` names of final Sessions not in `superseded`, in name order; `newest` name of the last Session in `folder.sessions`, or `null`.
  - `run.mjs` sets `folder.chain = buildChain(folder)` before running Rules.
  - `chain-status.mjs` exports `chainStatusRules`: `chain/no-final` (`error`; when `folder.sessions` is non-empty and no Session has status `final`, one Finding at the newest Session, line 1), `chain/draft-newest` (`error`; newest Session has status `draft`, line 1), `chain/stale-draft` (`warning`; each Session with status `draft`, not newest, not in `superseded`, line 1). Append to `RULES`.
  - Messages: `no final Session exists`, `the newest Session is a draft`, `draft Session is not the newest`.
- **Do not:** edit `R/tests/**`; add dependencies; implement link or ID Rules.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R1-07, R3-04, R3-05, R6-01, R6-02, R1-08; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S03 - Link Rules

- **Kind:** build
- **Goal:** `Builds on` and `Supersedes` links that name a missing file, themselves, or form a cycle are reported.
- **Depends on:** S02
- **Tier:** delegate - adds Rules to the registry following the S02 Chain model
- **Review:** none
- **Scenarios:**
  - R3-01: Given Session B with `` - Builds on: `context-2026-11-19-0900.md` `` and no such file, when run, then `chain/broken-link` error at B's `Builds on` line
  - R3-02: Given Session B whose `Supersedes` names B's own file name, when run, then `chain/broken-link` error at that line
  - R3-03: Given A with `Builds on` B and B with `Builds on` A, when run, then one `chain/broken-link` error at each of A and B, each at its link line (failure)
  - R1-09: Given final C that supersedes A, and A has `Builds on` naming a missing file, when run, then the `chain/broken-link` error at A is still reported
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p02-s03.test.mjs`
- **Files:** create `R/src/rules/chain-links.mjs`; edit `R/src/rules/index.mjs`
- **Patterns:** `R/src/rules/chain-status.mjs:1 - Rule shape using folder.chain`
- **Decisions:**
  - Export `chainLinkRules` with `chain/broken-link` (`error`); append to `RULES`.
  - For each link entry in `folder.chain.links` (both fields), emit one Finding at the Session and the link's line when: the target is not a name in `folder.sessions`; or the target equals the Session; or the target reaches the Session by following `buildsOn` and `supersedes` links of existing Sessions (cycle).
  - Message: `<Field> names <target>: file is missing`, `... : names itself`, or `... : forms a cycle`.
  - Targets that are not backticked names are not links and are ignored here (they are `structure/link-format`).
- **Do not:** edit `R/tests/**`; add dependencies; change `chain.mjs` behavior.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R3-01, R3-02, R3-03, R1-09; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S04 - Requirement ID Rules

- **Kind:** build
- **Goal:** reused or unknown requirement IDs are reported, with amend Sessions allowed to restate IDs.
- **Depends on:** S03
- **Tier:** main - ancestry and chain semantics need judgment
- **Review:** required - no mutation gate
- **Scenarios:**
  - R3-06: Given `context-A` and later `context-B` (`extend`) that both define R3, when run, then `chain/duplicate-id` error at B's R3 line and none at A
  - R3-07: Given B (`amend`, `Builds on` A) restating R3, when run, then no `chain/duplicate-id`
  - R3-08: Given one Session defining R3 twice, when run, then `chain/duplicate-id` error at the second definition's line
  - R3-09: Given `- R9 - retired.` where no earlier Session in its ancestry defines R9, when run, then `chain/unknown-retirement` error at that line (failure)
  - R3-10: Given `- R1 - retired, superseded by R7.` and no Session in the chain defines R7, when run, then `chain/unknown-retirement` error at that line (failure)
  - R3-11: Given A defines R3, B (`extend`, `Builds on` A) defines only R4, and C (`amend`, `Builds on` B) restates R3, when run, then no `chain/duplicate-id` at C (ancestry is transitive)
  - R1-10: Given final C that supersedes A, and A defines R1 twice, when run, then no `chain/duplicate-id` at A
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p02-s04.test.mjs`
- **Files:** create `R/src/rules/chain-ids.mjs`; edit `R/src/rules/index.mjs`
- **Patterns:** `R/src/rules/session-body.mjs:24 - sectionLines (private; write an equivalent in chain-ids.mjs, do not edit or export the original)`; `R/src/rules/chain-links.mjs:1 - using folder.chain.links`
- **Decisions:**
  - Export `chainIdRules` with `chain/duplicate-id` and `chain/unknown-retirement`, both `error`; append to `RULES`. Both skip Sessions in `folder.chain.superseded` and unreadable Sessions.
  - Requirement lines are the lines under `## Requirements`. A definition is a line matching `^- R(\d+) - ` that is not a retirement; a retirement matches `^- R(\d+) - retired(, superseded by R(\d+))?\.$`. Retirements are not definitions.
  - Ancestry of a Session: every existing Session reachable through `buildsOn` links, transitively, excluding itself.
  - `chain/duplicate-id`: at a definition of R<n> when the same Session defined R<n> earlier, or an earlier-named Session (any status) defines R<n> and this Session is not `amend` with that earlier Session in its ancestry. Anchored at the later definition's line. Message `R<n> is already defined in <earlier file name>`.
  - `chain/unknown-retirement`: at a retirement of R<n> when no Session in its ancestry defines R<n>; and, when `superseded by R<m>` is present, when R<m> is defined by no Session in `folder.chain.chain` and not by this Session. Message names the ID.
- **Do not:** edit `R/tests/**`; add dependencies; change `chain.mjs` behavior.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R3-06, R3-07, R3-08, R3-09, R3-10, R3-11, R1-10; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S05 - File argument

- **Kind:** build
- **Goal:** `workflow-check <file>` prints only Findings anchored at that Session or the Glossary, and rejects unusable arguments with exit 2.
- **Depends on:** S04
- **Tier:** main - changes the run flow and exit handling
- **Review:** required - changes the CLI interface
- **Scenarios:**
  - R8-01: Given Sessions A and B (B later, `extend`) that both define R3, when run with B's path, then stdout holds the `chain/duplicate-id` Finding and a summary counting it, exit 1
  - R8-02: Given the R8-01 folder, when run with A's path, then stdout is exactly `workflow-check: 0 errors, 0 warnings` and exit 0
  - R8-03: Given a path to a file that does not exist, when run, then exit 2, empty stdout, one stderr line (failure)
  - R8-04: Given a path outside the Workflow Folder (`../elsewhere.md`), when run, then exit 2, empty stdout, one stderr line (failure)
  - R8-05: Given `.workflow/notes.md` that exists but is neither a Session nor the Glossary, when run with it, then exit 2, empty stdout, one stderr line (failure)
  - R8-06: Given a Glossary with a `structure/glossary-section` error, when run with its absolute path from a subdirectory, then that Finding is printed and exit 1
  - R8-07: Given two file arguments, when run, then exit 2, empty stdout, one stderr line (failure)
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p02-s05.test.mjs`
- **Files:** edit `R/src/run.mjs`
- **Patterns:** `R/src/run.mjs:6 - exit 2 handling for a missing folder`
- **Decisions:**
  - `args` has zero or one entries. Two or more: stderr `workflow-check: expected at most one file argument\n`, code 2.
  - The argument is resolved against `cwd` (`path.resolve`); its path relative to the Workflow Folder root, with `/` separators, must equal `.workflow/language.md` (and `folder.glossary` exists) or `.workflow/sessions/<name>` where `<name>` is in `folder.sessions`. Comparison is case-sensitive.
  - Otherwise stderr `workflow-check: <arg> is not a Session or the Glossary of the Workflow Folder\n` (or `... does not exist` when the file is absent), code 2.
  - After running all Rules, keep only Findings whose `path` equals the target path; the summary and exit code count only those.
- **Do not:** edit `R/tests/**`; add dependencies; change Rule files.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R8-01, R8-02, R8-03, R8-04, R8-05, R8-06, R8-07; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S06 - Repair P01 fixtures for Chain Rules

- **Kind:** test-fix
- **Scope:** fixture
- **Goal:** locked P01 tests whose fixtures hold no final Session, or only a draft, pass unchanged against the Chain Rules because each fixture again breaks only its own scenario's rule.
- **Depends on:** none
- **Tier:** main - edits locked oracle files through Fixture Repair
- **Review:** none
- **Restores:** R1-06, Q-message-length, R2-03, R10-01, R2-10 (owned by P01 cards); gate finding: S02's `chain/no-final` and `chain/draft-newest` Rules add Findings to these five, because their fixtures also break R1 and R3 (no final Session, or a draft as the newest)
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p01-s04.test.mjs`, `.github/tools/workflow-check/tests/acceptance/p01-s05.test.mjs`, `.github/tools/workflow-check/tests/acceptance/p01-s06.test.mjs`
- **Decisions:**
  - Start from the files at `Tests locked`; the earlier uncommitted assertion edits are discarded.
  - R1-06, Q-message-length, R2-03, R10-01: add one spec-valid final Session to the fixture, named so it sorts before the Session under test, and defining no requirement ID that the Session under test defines.
  - R2-10 draft case: add a newer final Session whose `- Supersedes:` names the draft, defining no requirement ID the draft defines, so the run stays clean.
  - Every assertion and test title stays byte-identical to `Tests locked`.
- **Do not:** edit assertions, test titles, `R/tests/support/**`, or any product file.

## S07 - Repair R2-09 fixture for Link Rules

- **Kind:** test-fix
- **Scope:** fixture
- **Goal:** the locked R2-09 test passes unchanged against `chain/broken-link` because its valid-link fixture again breaks no spec rule.
- **Depends on:** none
- **Tier:** main - edits a locked oracle file through Fixture Repair
- **Review:** none
- **Restores:** R2-09 (owned by a P01 card); dispatch stop on S03: the `good` fixture's `Builds on` names `context-2026-11-19-0900.md` and `context-2026-11-18-1000.md`, which do not exist, so S03's `chain/broken-link` Rule adds two Findings
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p01-s06.test.mjs`
- **Decisions:**
  - Start from the file at `Tests locked`.
  - In R2-09's `good` run only, add the two named Sessions to the fixture as spec-valid final Sessions, each defining one requirement ID that no other Session in that fixture defines, with no `Builds on` or `Supersedes` line.
  - The `bad` run and its fixture stay unchanged.
  - Every assertion and test title stays byte-identical to `Tests locked`.
- **Do not:** edit assertions, test titles, `R/tests/support/**`, or any product file.