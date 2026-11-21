# P01 - Run, report, Session structure

- **Outcome:** `node .github/tools/workflow-check/bin/workflow-check.mjs` finds the Workflow Folder, reports folder-level and Session structure Findings in the specified line shape, sorts them, prints the summary, and exits 0/1/2 without touching files.
- **Covers:** R1 (folder-level failures), R2 (Session Rules), R6 (exit codes 1 and 2), R7, R9, R10 (CRLF/BOM), Q-message-length
- **Invariants:**
  - `R` = `.github/tools/workflow-check`. All code is ES modules (`.mjs`), no dependencies, Node built-ins only.
  - Finding line: `<path>:<line>: <severity>: <rule-id>: <message>`; path repo-relative with `/` (relative to the directory containing `.workflow/`); line 1-based; message one line, at most 160 characters; LF endings.
  - Last stdout line: `workflow-check: <E> errors, <W> warnings`. Exit 0 no errors, 1 at least one error, 2 cannot run (one line on stderr, nothing on stdout).
  - Findings sorted by path, line, rule-id in ordinal (code-unit) order; ties keep generation order.
  - Documents are read as UTF-8; a leading BOM is dropped; lines split on `\r\n` or `\n`.
  - Never write, create, or delete anything.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" .github/tools/workflow-check/tests/acceptance/`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R2-01]`
  - count: the `# pass N` line of the tap output
- **Gate:**
  - suite: `node --test .github/tools/workflow-check/tests/acceptance/`
  - traceability: `node .github/tools/workflow-check/scripts/trace.mjs <IDs owned by the phase>`
  - lock: `git diff --exit-code <Tests locked> -- .github/tools/workflow-check/tests`
  - mutation: unsupported for node - no mutation tool is installed and the spec forbids an install step

## S01 - Initialize git repository

- **Kind:** setup
- **Goal:** the repo is a git repository with one commit so a test lock ref can exist.
- **Depends on:** none
- **Tier:** cloud - touches the whole repo
- **Files:** none (creates `.git/`)
- **Decisions:** run `git init -b main`, stage everything, commit `Initial workflow baseline`.
- **Do not:** add a remote; edit any file.
- **Done when:** `git rev-parse HEAD` exits 0
- **Stop and report if:** a `.git` already exists; commit needs a git identity that is not configured.

## S02 - Test harness and trace script

- **Kind:** setup
- **Goal:** acceptance tests can build a temp Workflow Folder, run the CLI, and prove which scenario IDs passed.
- **Depends on:** S01
- **Tier:** cloud - sets the shared harness every later card relies on
- **Files:** create `R/tests/support/harness.mjs`, `R/tests/support/fixtures.mjs`, `R/scripts/trace.mjs`
- **Patterns:** none exist in the repo; follow Decisions.
- **Decisions:**
  - `harness.mjs` exports `runCheck({files, cwd = '.', args = []})`: creates a temp directory, writes `files` (map of relative path -> string or Buffer), runs `process.execPath <abs R>/bin/workflow-check.mjs ...args` with `cwd` (relative to the temp directory) and stdin ignored, and returns `{code, stdout, stderr, dir}`. If the CLI file does not exist yet, the node failure is returned unchanged.
  - `harness.mjs` also exports `snapshotTree(dir)`: a Map of every file and directory relative path -> sha256 (files) or `dir`, for read-only assertions.
  - `fixtures.mjs` exports `validSession(overrides = {})` (a complete Session: all required sections, `Status: final`, `Relationship: new`, `Size: small`, title for 2026-11-20 11:24, requirement `- R1 - Users can run it. Accept: it runs.`), `validGlossary()` (`# Language`, `## Terms` with one term `Finding`, empty `## Retired`), `SESSION_NAME = 'context-2026-11-20-1124.md'`, and `cleanFolder()` (files map with `.workflow/sessions/<SESSION_NAME>` and `.workflow/language.md`).
  - `trace.mjs <ID>...` runs `node --test --test-reporter=tap` on `R/tests/acceptance/` and exits 0 only when every ID has at least one `ok` test whose title starts with `[ID]` and no `not ok` exists; otherwise prints the missing IDs and exits 1. No IDs: prints usage, exits 2. `--help`: prints usage, exits 0.
- **Do not:** write any acceptance test; create `R/bin` or `R/src`.
- **Done when:** `node -e "import('./.github/tools/workflow-check/tests/support/harness.mjs'); import('./.github/tools/workflow-check/tests/support/fixtures.mjs')"` exits 0, and `node .github/tools/workflow-check/scripts/trace.mjs --help` exits 0
- **Stop and report if:** the `node:test` tap reporter or `--test-skip-pattern` is unavailable.

## S03 - Locate folder and print summary

- **Kind:** build
- **Goal:** the CLI finds the nearest Workflow Folder and prints only the summary line for a clean folder.
- **Depends on:** S02
- **Tier:** cloud - creates the module layout every later card extends
- **Scenarios:**
  - R1-01: Given a directory tree with no `.workflow/` anywhere above the working directory, when run, then exit 2, stdout empty, stderr one line naming `.workflow`, no summary line (failure)
  - R1-02: Given a clean folder at the temp root and working directory `a/b`, when run, then stdout is exactly `workflow-check: 0 errors, 0 warnings\n` and exit 0
  - R1-03: Given a clean `proj/.workflow` and an outer `.workflow` with no `language.md`, when run from `proj/src`, then stdout is exactly the 0-errors summary (the nearest folder is used)
  - R9-01: Given a clean folder, when run, then the tree snapshot is identical before and after
- **Acceptance tests:** `R/tests/acceptance/p01-s03.test.mjs`
- **Files:** create `R/bin/workflow-check.mjs`, `R/src/run.mjs`, `R/src/workspace.mjs`, `R/src/finding.mjs`
- **Patterns:** none exist; follow Decisions.
- **Decisions:**
  - `bin/workflow-check.mjs` calls `run({cwd: process.cwd(), args: process.argv.slice(2)})`, writes `stdout`/`stderr`, sets `process.exitCode`. Never reads stdin.
  - `src/run.mjs` exports `run({cwd, args}) -> {stdout, stderr, code}`.
  - `src/workspace.mjs` exports `findWorkflowRoot(cwd)` (walks up; returns the directory containing `.workflow`, or `null`) and `loadFolder(root)` returning `{root, glossary: Doc|null, sessions: Doc[]}` with `Doc = {path, name, lines, unreadable}`; sessions are `.workflow/sessions/*.md` sorted by name in ordinal order.
  - `src/finding.mjs` exports `formatFindings(findings)` producing sorted lines plus the summary; a Finding is `{ruleId, severity, path, line, message}`.
  - No `.workflow` found: stderr `workflow-check: no .workflow folder found in <cwd> or any parent directory\n`, code 2.
- **Do not:** edit `R/tests/**`; add dependencies; implement any Rule.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" .github/tools/workflow-check/tests/acceptance/` exits 0; targets R1-01, R1-02, R1-03, R9-01; 4 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S04 - Folder-level Findings and output rules

- **Kind:** build
- **Goal:** folder-level Findings print in the specified shape, exit code follows errors, and nothing is written.
- **Depends on:** S03
- **Tier:** cloud - creates the Rule framework the remaining cards plug into
- **Scenarios:**
  - R1-04: Given `language.md` and an empty `.workflow/sessions/`, when run, then stdout is `.workflow/sessions:1: error: structure/no-session: <message>` then `workflow-check: 1 errors, 0 warnings`, exit 1
  - R1-05: Given a valid Session and no `.workflow/language.md`, when run, then `.workflow/language.md:1: error: structure/glossary-missing: ...`, exit 1
  - R1-06: Given a Session with invalid UTF-8 bytes `C3 28` and no `language.md`, when run, then a `structure/unreadable` error at that Session line 1 and the `structure/glossary-missing` error both appear, exit 1 (failure)
  - Q-message-length: Given an unreadable Session whose file name is 200 characters, when run, then every Finding message is at most 160 characters
  - R9-02: Given the R1-04 folder and the R1-01 no-folder case, when run, then the tree snapshot is unchanged after each run
- **Acceptance tests:** `R/tests/acceptance/p01-s04.test.mjs`
- **Files:** create `R/src/rules/index.mjs`, `R/src/rules/folder.mjs`; edit `R/src/run.mjs`, `R/src/finding.mjs`, `R/src/workspace.mjs`
- **Patterns:** `R/src/run.mjs:1 - run() and output assembly`; `R/src/workspace.mjs:1 - Doc loading`
- **Decisions:**
  - `rules/index.mjs` exports `RULES`: array of `{id, severity, check(folder) -> [{path, line, message}]}`; the engine adds `ruleId` and `severity`. Severity is fixed per rule here.
  - `rules/folder.mjs` holds `structure/no-session` (path `.workflow/sessions`), `structure/glossary-missing` (path `.workflow/language.md`), `structure/unreadable` (the file), all `error`, line 1.
  - A file failing `new TextDecoder('utf-8', {fatal: true})` gets `Doc.unreadable = true`, `lines = []`; other Rules skip unreadable Docs.
  - `formatFindings` truncates messages to 160 characters (last three replaced with `...`).
  - Exit code 1 if any error Finding, else 0.
- **Do not:** edit `R/tests/**`; add dependencies; implement Session-content Rules.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" .github/tools/workflow-check/tests/acceptance/` exits 0; targets R1-04, R1-05, R1-06, Q-message-length, R9-02; 5 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S05 - Session header Rules

- **Kind:** build
- **Goal:** Session file name, title, and Status/Relationship/Size lines are checked.
- **Depends on:** S04
- **Tier:** local - adds Rules to an existing registry
- **Scenarios:**
  - R2-01: Given a Session file named `notes.md`, when run, then `structure/session-name` error at `.workflow/sessions/notes.md:1`
  - R2-02: Given `context-2026-11-20-1124.md` whose line 1 is `# Context - 2026-11-20 11:25`, when run, then `structure/session-title` error at line 1
  - R2-03: Given a Session with no `- Status:` line, when run, then `structure/session-status` error at line 1
  - R2-04: Given a Session whose line 4 is `- Relationship: replace`, when run, then `structure/session-status` error at line 4 (failure)
  - R7-02: Given `notes.md` with a wrong title and no Status line, plus a second valid-named Session missing its Size line, when run, then Findings are sorted by path, line, rule-id (`session-name`, `session-status`, `session-title` at one line), then the summary
  - R10-01: Given the R2-03 Session saved with CRLF endings and a leading BOM, when run, then stdout equals the LF, no-BOM output
- **Acceptance tests:** `R/tests/acceptance/p01-s05.test.mjs`
- **Files:** create `R/src/rules/session-header.mjs`; edit `R/src/rules/index.mjs`
- **Patterns:** `R/src/rules/folder.mjs:1 - Rule object shape and check() return`
- **Decisions:**
  - Rules `structure/session-name`, `structure/session-title`, `structure/session-status`, all `error`.
  - Name regex `^context-\d{4}-\d{2}-\d{2}-\d{4}\.md$`. Title must equal `# Context - YYYY-MM-DD HH:mm` derived from the name; with an invalid name it only has to match `^# Context - \d{4}-\d{2}-\d{2} \d{2}:\d{2}$`.
  - Header fields are lines before the first `## ` heading matching `^- (Status|Relationship|Size|Builds on|Supersedes): (.*)$`. Allowed: Status `final|draft`; Relationship `new|extend|amend`; Size `small|medium|large`. Missing field: line 1. Bad value: that line.
- **Do not:** edit `R/tests/**`; add dependencies; implement body Rules.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" .github/tools/workflow-check/tests/acceptance/` exits 0; targets R2-01, R2-02, R2-03, R2-04, R7-02, R10-01; 6 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S06 - Session body Rules

- **Kind:** build
- **Goal:** required sections, requirement lines, links, and final-open Decisions are checked.
- **Depends on:** S05
- **Tier:** local - adds Rules to an existing registry
- **Scenarios:**
  - R2-05: Given a Session without `## Scope Guardrails`, when run, then `structure/session-section` error at line 1
  - R2-06: Given `Relationship: extend` and no `## Existing Solution`, when run, then a `structure/session-section` error; with `Relationship: new` and the same omission, no Finding
  - R2-07: Given the Requirements line `- R4 - Users can export.` with no Accept, when run, then `structure/requirement-format` error at that line (failure)
  - R2-08: Given Requirements holding one bad line, `- R4 - retired.`, and `- R5 - retired, superseded by R4.`, when run, then exactly one Finding
  - R2-09: Given `- Builds on: context-2026-11-19-0900.md` without backticks, when run, then `structure/link-format` error at that line
  - R2-10: Given a `Status: final` Session with `- open: confirm limit` under Decisions, when run, then `structure/final-open` error at that line; the same line in a `Status: draft` Session yields no Finding
- **Acceptance tests:** `R/tests/acceptance/p01-s06.test.mjs`
- **Files:** create `R/src/rules/session-body.mjs`; edit `R/src/rules/index.mjs`
- **Patterns:** `R/src/rules/session-header.mjs:1 - header field parsing and Rule shape`
- **Decisions:**
  - Rules `structure/session-section`, `structure/requirement-format`, `structure/link-format`, `structure/final-open`, all `error`.
  - Sections are lines matching `^## (.+)$`, matched case-sensitively. Required: Problem, Users, Workflow, Requirements, Scope Guardrails, Constraints, Success, Decisions, Language; plus Existing Solution when Relationship is `extend` or `amend`.
  - Requirement lines are non-blank lines between `## Requirements` and the next `## `; each must match `^- R\d+ - .+\. Accept: .+\.$`, `^- R\d+ - retired, superseded by R\d+\.$`, or `^- R\d+ - retired\.$`.
  - Link values: one or more backticked `context-YYYY-MM-DD-HHmm.md` names separated by `, `.
  - final-open: a line matching `^- open\b` under `## Decisions` in a Session with `Status: final`.
- **Do not:** edit `R/tests/**`; add dependencies; check Glossary content.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" .github/tools/workflow-check/tests/acceptance/` exits 0; targets R2-05, R2-06, R2-07, R2-08, R2-09, R2-10; 6 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.
