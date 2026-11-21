# Behavior Spec - workflow-check

## Sources
- Sessions: `context-2026-11-20-1124.md`, `context-2026-11-21-1442.md` (R2, R11, R18)
- Language: `.workflow/language.md`
- Companion spec: [workflow-core-spec.md](workflow-core-spec.md) holds the Workflow Core requirements from `context-2026-11-21-1442.md`.

## Target Outcome
- once v1 is done, `workflow-check` reports every Rule break in a repo's Sessions and Glossary as a one-line Finding, fails only on errors, never touches a file, requires Session sections by Size in step with the Session format, and is wired into brain-storm and behavior-spec through checks that survive rewording.

## Requirements

### R1 - Read the Workflow Folder and report Findings
- Rules:
  - The Workflow Folder is `.workflow/` in the nearest ancestor directory of the working directory that contains one. Sessions are `.workflow/sessions/*.md`; the Glossary is `.workflow/language.md`. Other files are ignored.
  - The Session Chain is every Session with `Status: final` that no other final Session lists in `Supersedes`, ordered by file name. Draft Sessions are never in the chain, and a draft's `Supersedes` has no effect.
  - A run reports Findings for every Session and the Glossary, whether or not a Session is in the chain. A superseded Session gets only `structure` Findings and `chain/broken-link`.
  - Matching of words and terms is whole-word and case-insensitive. Headings, backticked spans, and the `## Language` section of a Session are never scanned for `vocabulary` or `excess` word matches.
  - Findings are anchored to one file and line (line 1 when no specific line applies). A rule that involves two files anchors at the later Session (by file name), or at the linking Session for links.
- Failure:
  - no Workflow Folder found -> exit code 2, one line on stderr, no summary line.
  - Workflow Folder with no Session files -> Finding `structure/no-session` (error) at `.workflow/sessions:1`.
  - no `.workflow/language.md` -> Finding `structure/glossary-missing` (error) at `.workflow/language.md:1`.
  - a file that cannot be read or is not UTF-8 text -> Finding `structure/unreadable` (error) at that file, line 1; the run continues with the other files.
  - Sessions exist but none is final -> Finding `chain/no-final` (error) at the newest Session.
- Examples:
  - Given a Workflow Folder where one Session has no Status and one Session reuses R3, when run, then both break Findings appear in one report.
  - Given an empty `.workflow/sessions/`, when run, then `.workflow/sessions:1: error: structure/no-session: ...` and exit code 1.
  - Given no `.workflow/` anywhere above the working directory, when run, then exit code 2 and stderr names the missing folder (failure).

### R2 - Structure Rules
- Rules (all `structure` Category):

| Rule ID | Severity | Breaks when |
|---|---|---|
| `structure/session-name` | error | Session file name is not `context-YYYY-MM-DD-HHmm.md` |
| `structure/session-title` | error | first line is not `# Context - YYYY-MM-DD HH:mm` matching the file name |
| `structure/session-status` | error | `Status`, `Relationship`, or `Size` line missing or has a value outside `final\|draft`, `new\|extend\|amend`, `small\|medium\|large` |
| `structure/session-section` | error | a section the Session's Size requires is missing (Required sections table below) |
| `structure/requirement-format` | error | a line under Requirements is not `- R<n> - <behavior>. Accept: <signal>.` or `- R<n> - retired, superseded by R<m>.` or `- R<n> - retired.` |
| `structure/link-format` | error | `Builds on` or `Supersedes` is not one or more backticked `context-....md` names |
| `structure/final-open` | error | a `Status: final` Session has an `open:` Decision |
| `structure/glossary-section` | error | Glossary lacks `## Terms` or `## Retired` |
| `structure/glossary-term-format` | error | a line under Terms is not `` - `Term` - meaning `` (optional `Avoid:`, `States:`, `Code:` parts), or a line under Retired is not `` - `Old` -> `New` - reason `` |

- Required sections by Size:

| Section | small | medium | large |
|---|---|---|---|
| Problem, Requirements | required | required | required |
| Existing Solution | required when Relationship is `extend` or `amend` | same | same |
| Users, Workflow, Scope Guardrails, Constraints, Success, Decisions | optional | required | required |
| Language | optional | optional | optional |

- The Session format (`brain-storm/references/CONTEXT-FORMAT.md`) states the same required set per Size: a Session holding exactly the sections the format marks required for its Size gets no `structure/session-section` Finding.
- Failure: each break is reported at the offending line (line 1 for a missing section or field).
- Examples:
  - Given a Session with no `- Status:` line, when run, then `structure/session-status` error at that Session, line 1.
  - Given `- R4 - Users can export.` with no `Accept:`, when run, then `structure/requirement-format` error at that line (failure).
  - Given a `small` `extend` Session with Existing Solution, Problem, and Requirements only, when run, then no `structure/session-section` Finding.
  - Given a `large` Session missing `## Constraints`, when run, then `structure/session-section` error at that Session, line 1 (failure).
  - Given a `medium` Session with no `## Language`, when run, then no `structure/session-section` Finding.

### R3 - Chain Rules
- Rules (all `chain` Category, all error unless stated):
  - `chain/duplicate-id`: an R# is defined twice in one Session; or defined again in a later Session that is not `amend` building on (directly or through other Sessions) the earlier one. Anchored at the later definition. Restating an ID in a qualifying `amend` Session is allowed.
  - `chain/unknown-retirement`: a retirement names an R# no earlier Session in its ancestry defines, or its `superseded by R<m>` names an R# not defined in the chain.
  - `chain/broken-link`: `Builds on` or `Supersedes` names a file that does not exist, names itself, or forms a cycle.
  - `chain/no-final`: see R1.
  - `chain/draft-newest`: the newest Session (by file name) is a draft.
  - `chain/stale-draft` (warning): a draft Session that is not the newest.
  - A superseded Session (R1) never carries `chain/duplicate-id`, `chain/unknown-retirement`, `chain/draft-newest`, or `chain/stale-draft`; only `chain/broken-link` applies to it among `chain` Rules.
- Examples:
  - Given `context-A` (final, `Supersedes` `context-B`) and a newer draft `context-B`, when run, then no `chain/draft-newest` Finding and exit code 0.
  - Given `context-A` and a later `context-B` (relationship `extend`) both defining R3, when run, then `chain/duplicate-id` error at `context-B`'s R3 line, none at A.
  - Given `context-B` (`amend`, Builds on `context-A`) restating R3, when run, then no `chain/duplicate-id`.
  - Given `R9 - retired.` where no earlier Session defines R9, when run, then `chain/unknown-retirement` error (failure).

### R4 - Vocabulary Rules
- Rules (all `vocabulary` Category):
  - `vocabulary/avoid-synonym` (warning): a Session uses a word listed in some Glossary term's `Avoid:`. Avoid entries carrying a parenthetical qualifier (e.g. `check (as a noun)`) are not matched.
  - `vocabulary/retired-term` (warning): a Session uses a Glossary `Retired` old term.
  - `vocabulary/missing-term` (error): a backticked term opening a bullet in a Session's `## Language` section has no Glossary Term (case-insensitive).
  - `vocabulary/glossary-conflict` (error): a canonical term appears twice in the Glossary, or is also listed in an `Avoid:` or as a Retired old term.
- Rationale for severities: ambiguous English words can be legitimate, so word matches warn; a missing or conflicting Glossary entry is objectively wrong, so it fails.
- Examples:
  - Given Glossary `` `Finding` ... Avoid: issue `` and a Session body line "each issue is reported", when run, then `vocabulary/avoid-synonym` warning at that line.
  - Given a Session Language bullet `` `Widget` - ... `` and no Glossary term `Widget`, when run, then `vocabulary/missing-term` error (failure).

### R5 - Excess Rules
- Rules (all `excess` Category, all warning):
  - `excess/session-size`: a Session exceeds 1,500 words.
  - `excess/requirement-size`: a requirement line exceeds 60 words.
  - `excess/glossary-size`: the Glossary has more than 40 Terms.
  - `excess/out-of-stage`: a Session or the Glossary contains one of: schema, table, column, endpoint, controller, microservice, ORM, SQL, database, library, framework, npm, NuGet, pip, Docker, Kubernetes. Sessions' `Existing Solution`, `Constraints`, and `Decisions` sections are exempt, since they may name existing or imposed things.
- Examples:
  - Given a Requirements line "R5 - stores rows in a database table. Accept: ...", when run, then `excess/out-of-stage` warning at that line.
  - Given a Constraints line "imposed format: SQL export - owner: finance", when run, then no `excess/out-of-stage` Finding.

### R6 - Severity and exit code
- Rules: Severity is `error` or `warning`, fixed per Rule (tables above). Exit code 0 when zero errors (warnings allowed); 1 when at least one error; 2 when the run cannot start (no Workflow Folder, bad arguments).
- Examples:
  - Given only warnings, when run, then findings printed and exit code 0.
  - Given one error and three warnings, when run, then exit code 1.

### R7 - Output shape
- Rules:
  - One line per Finding: `path:line: severity: rule-id: message`. `path` is repo-relative with `/` separators; `line` is 1-based; `rule-id` is the ID in R2-R5; `message` is one line of at most 160 characters.
  - Findings are sorted by path, then line, then rule-id (ordinal order).
  - The last line is always the summary `workflow-check: <E> errors, <W> warnings`, including `0 errors, 0 warnings`. Nothing else is printed to stdout. Output uses LF line endings.
- Examples:
  - Given one `structure/session-status` error, when run, then stdout is `.workflow/sessions/context-2026-11-20-1124.md:1: error: structure/session-status: ...` then `workflow-check: 1 errors, 0 warnings`.
  - Given no Findings, when run, then stdout is exactly `workflow-check: 0 errors, 0 warnings` and exit code 0.

### R8 - File argument
- Rules:
  - `workflow-check <file>` reads the whole Workflow Folder but prints only Findings anchored at `<file>`; the summary counts only printed Findings; exit code follows the printed Findings.
  - `<file>` is a path relative to the working directory or absolute, and must be a Session or the Glossary of the Workflow Folder.
- Failure: a file that does not exist, is outside the Workflow Folder, or is not a Session or the Glossary -> exit code 2, one line on stderr, no summary line.
- Examples:
  - Given Sessions A and B that both define R3 (B later), when run on B, then the `chain/duplicate-id` Finding appears; when run on A, then `workflow-check: 0 errors, 0 warnings`.

### R9 - Read-only
- Rules: no file or directory in the repo is created, modified, or deleted by any run, including failed runs.

### R10 - Offline, non-interactive, cross-platform
- Rules:
  - Never prompts, never reads stdin, never uses the network, and needs no installation beyond the copied workflow folder and the one runtime it requires.
  - The same Workflow Folder contents produce byte-identical stdout and the same exit code on Windows and Linux. File and heading names are matched case-sensitively; CRLF and LF line endings and a leading BOM are accepted without changing line numbers or Findings.
- Examples:
  - Given the same Workflow Folder checked out with CRLF on Windows and LF on Linux, when run on each, then stdout is identical.

### R11 - brain-storm integration
- Rules:
  - After writing its Session and Glossary, brain-storm runs `node .github/tools/workflow-check/bin/workflow-check.mjs` with no file argument, so the whole Workflow Folder is checked.
  - It fixes every error Finding anchored at its new Session or the Glossary and reruns until none remain there.
  - It weighs each warning anchored at its new Session or the Glossary: fixes it, or leaves it deliberately and names it in the brief. Warnings anchored at prior Sessions are ignored.
  - It never edits a prior Session to clear a Finding.
- Failure: an error Finding anchored at a prior Session -> once its own errors are cleared, brain-storm stops and shows each such Finding line to the Developer instead of finishing; the prior Session stays unchanged. Committing its own output on this stop is workflow-core R19.
- Examples:
  - Given its new Session has a `structure/session-section` error, when brain-storm finishes, then the error is fixed and no error Finding is anchored at the new Session.
  - Given a prior Session carries a `chain/duplicate-id` error, when brain-storm runs the check, then it shows that Finding line to the Developer and stops (failure).
  - Given only a warning anchored at a prior Session, when brain-storm runs the check, then it finishes normally.

### R12 - behavior-spec integration
- Rules: while validating inputs, behavior-spec runs `workflow-check` on the whole Workflow Folder. Any error Finding, or exit code 2, makes it stop and redirect to brain-storm, showing the error Findings. Warnings do not stop it.
- Examples:
  - Given a `chain/duplicate-id` error, when behavior-spec starts, then it stops and redirects to brain-storm.
  - Given only warnings, when behavior-spec starts, then it proceeds.

### R18 - Skill rewording keeps the acceptance suite passing
- Rules:
  - The workflow-check acceptance suite's checks of brain-storm and behavior-spec depend only on each `SKILL.md` containing the backticked command `node .github/tools/workflow-check/bin/workflow-check.mjs` with no file argument; never on headings, section order, sentence wording, or other text.
  - The conduct R11 and R12 describe (fix, weigh, stop, redirect) is not checked by text matching.
- Failure: removing the command, or adding a file argument to it, fails the suite.
- Examples:
  - Given brain-storm's instructions reworded and its sections renamed while keeping the command, when the suite runs, then it passes.
  - Given the command removed from behavior-spec's `SKILL.md`, when the suite runs, then it fails (failure).
  - Given brain-storm's command followed by `.workflow/sessions/<new session file>`, when the suite runs, then it fails (failure).

## Quality Thresholds
- Speed -> a run on a Workflow Folder of up to 10 Sessions and one Glossary finishes within 2 seconds on a normal dev machine or CI runner.
- Agent-readable output -> each Finding line is at most 160 message characters; no output beyond Findings and one summary line.
- Determinism -> two runs on unchanged files produce byte-identical stdout.

## External Constraints
- Session format - owner: brain-storm skill (`brain-storm/references/CONTEXT-FORMAT.md`); its per-Size required sections must match R2.
- Glossary format - owner: brain-storm skill (`brain-storm/references/LANGUAGE-FORMAT.md`).
- Runs on Windows and Linux; no macOS - session constraint.
- Travels inside the workflow folder with the skills; one runtime common to dev machines and CI; no separate install step - session constraint.
- Rule-based only; zero tokens spent - session constraint.

## Product Interfaces
- Command: `workflow-check [file]`.
  - Input: optional file argument (R8); working directory locates the Workflow Folder (R1).
  - Output: stdout per R7; stderr only for exit code 2 conditions.
  - Exit codes: 0 no errors; 1 at least one error; 2 could not run.

## Left To Planning
- Runtime, language, and how the command is packaged and invoked inside the workflow folder.
- Parsing approach and internal structure of Rules.
- Wording of Finding messages (within the 160-character limit).
- Where the skills' text invokes the command.
- How CONTEXT-FORMAT marks each section's required Sizes.

## Assumptions
- R1: Workflow Folder is found by walking up from the working directory - the session says it runs from within a copied folder, with no path argument.
- R1: missing Workflow Folder is exit 2, not a Finding - there is no file to anchor it to.
- R1: findings with no specific line use line 1 - keeps the line field always present.
- R1: unreadable files yield a Finding and the run continues - one bad file should not hide others.
- R18: the suite checks only the command, so R11 and R12 conduct (fix, weigh, stop, redirect) has no automated test and is approved at Phase Review as not expressible (workflow-core R16) - R18's Accept passes any rewording that keeps the command, and running the skills in a test would spend tokens.
- R2: core sections for every Size are Problem and Requirements (plus Existing Solution for `extend`/`amend`); medium and large also require Users, Workflow, Scope Guardrails, Constraints, Success, and Decisions; Language is never required - R2's Accept needs a small Session to pass without non-core sections and a large one to fail without Constraints; a small change rarely reshapes users or scope; Language only exists when terms change.
- R2: a missing section is anchored at line 1 - a missing section has no heading line; matches the plan's pinned and built behavior.
- R2: field values and formats derive from CONTEXT-FORMAT and LANGUAGE-FORMAT; `final` Sessions may not carry `open:` - format says `open (draft only)`.
- R3: a later Session may restate an ID only as an `amend` building on the earlier one - format says amend sessions restate changed requirements, while R3's Accept demands duplicates otherwise error.
- R3: a draft Session is an error only when newest; older drafts warn - behavior-spec redirects on a newest draft but older drafts do not block.
- R3: a superseded newest draft gets no `chain/draft-newest` - R1 already limits a superseded Session to `structure` and `chain/broken-link` Findings, and the same exemption already applies to `chain/stale-draft`, `chain/duplicate-id`, and `chain/unknown-retirement`.
- R4: word matches are warnings and missing/conflicting Glossary terms are errors - English words can be legitimate; Glossary gaps are objective. Applied to every vocabulary Rule.
- R4: parenthetical Avoid entries are not matched - cannot be matched by rule (e.g. `check (as a noun)`).
- R4: headings, backticks, and the Language section are not scanned - the current Session's `## Problem` heading would otherwise hit the Avoid word `problem`.
- R5: Session limit 1,500 words - the current Session is 1,001 words.
- R5: requirement line limit 60 words - the longest current requirement is 35 words.
- R5: Glossary limit 40 Terms - the current Glossary has 10.
- R5: out-of-stage word list and exempt sections as listed - detail belonging to behavior-spec or work-planner; Constraints and Decisions may legitimately name imposed things.
- R6: exit codes 0/1/2 - common convention.
- R7: Finding message limit 160 characters, sorted output, always-printed summary - makes output cheap and deterministic for agents and CI.
- R8: Findings anchored only at the later Session in two-file conflicts - needed for R8's "run on B reports only B's Finding".
- R11: brain-storm stops rather than edits when an error is anchored at a prior Session - the session rejects editing prior Sessions.
- R11: brain-storm fixes errors and weighs warnings at the Glossary as well as its new Session, and ignores prior-Session warnings - it writes the Glossary; prior Sessions are never edited, so their warnings cannot be acted on.
- R12: exit code 2 also triggers redirect - the run could not verify the inputs.
