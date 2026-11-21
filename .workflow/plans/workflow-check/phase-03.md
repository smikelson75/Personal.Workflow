# P03 - Vocabulary and Excess

- **Outcome:** `workflow-check` also reports vocabulary breaks (avoided words, retired terms, missing or conflicting Glossary terms) and excess (oversized Sessions, requirements and Glossary, out-of-stage words).
- **Covers:** R4, R5, R1 (word-matching scope: whole-word, case-insensitive, headings/backticks/Language section skipped)
- **Invariants:**
  - `R` = `.github/tools/workflow-check`. ES modules (`.mjs`), no dependencies, Node built-ins only.
  - Finding line: `<path>:<line>: <severity>: <rule-id>: <message>`; path repo-relative with `/`; line 1-based; message one line, at most 160 characters; LF endings. Last stdout line `workflow-check: <E> errors, <W> warnings`.
  - A Rule is `{id, severity, check(folder) -> [{path, line, message}]}` registered in `R/src/rules/index.mjs` (`RULES`). Severity is fixed per Rule. Rules skip Docs with `unreadable: true`.
  - A Doc is `{path, name, lines, unreadable}`; `folder` is `{root, glossary (Doc or null), sessions: Doc[], chain}`. `lines` are already BOM-free and LF-split.
  - Word matches are whole-word and case-insensitive. Headings (lines starting `#`), backticked spans, and the `## Language` section of a Session are never scanned for word matches.
  - Never write, create, or delete anything.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R4-01]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Gate:**
  - suite: `node --test ".github/tools/workflow-check/tests/acceptance/*.test.mjs"`
  - traceability: `node .github/tools/workflow-check/scripts/trace.mjs <IDs owned by P01, P02 and P03>`
  - lock: `git diff --exit-code <Tests locked> -- .github/tools/workflow-check/tests`
  - mutation: unsupported for node - no mutation tool is installed and the spec forbids an install step

## S01 - Glossary model and conflict Rule

- **Kind:** build
- **Goal:** the Glossary is parsed into Terms and Retired entries, and a canonical term that is duplicated, avoided, or retired is reported.
- **Depends on:** none
- **Tier:** main - creates the Glossary model the vocabulary cards build on
- **Review:** required - creates a shared structure later cards build on; no mutation gate
- **Scenarios:**
  - R4-07: Given Terms lines 4 `` - `Finding` - a break `` and 5 `` - `finding` - again ``, when run, then `vocabulary/glossary-conflict` error at `.workflow/language.md:5`
  - R4-08: Given Term `Rule` on line 4 and Term `Finding` on line 5 with `` Avoid: rule ``, when run, then `vocabulary/glossary-conflict` error at line 5 (failure)
  - R4-09: Given Term `Finding` and a Retired line `` - `finding` -> `Report` - renamed ``, when run, then `vocabulary/glossary-conflict` error at that Retired line (failure)
  - R4-10: Given unique Terms, an `Avoid:` that names no Term and no Retired old term, and a Retired line, when run, then no Finding
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p03-s01.test.mjs`
- **Files:** create `R/src/glossary-model.mjs`, `R/src/rules/vocabulary-conflict.mjs`; edit `R/src/rules/index.mjs`
- **Patterns:** `R/src/rules/glossary.mjs:11 - TERM and RETIRED regexes (copy them; do not edit or export from the original)`; `R/src/rules/chain-ids.mjs:1 - Rule object shape and registration`
- **Decisions:**
  - `glossary-model.mjs` exports `parseGlossary(doc)` returning `{termsLine, terms, retired}`. `doc` may be `null` or unreadable: return `{termsLine: 1, terms: [], retired: []}`.
  - Sections are `## Terms` and `## Retired` (case-sensitive); section lines run to the next `## ` heading. `termsLine` is the 1-based line of `## Terms`, or 1.
  - `terms` is `[{name, line, avoid}]` for each line matching `` ^- `[^`]+` - \S.*$ ``: `name` is the first backticked span; `line` is 1-based; `avoid` is a string array. Avoid text: after the first `Avoid: ` in the line up to the first `. States:`, `. Code:`, or end of line, with one trailing `.` removed; split on commas that are not inside parentheses (`/,(?![^(]*\))/`); trim each; drop empty entries and entries containing `(`.
  - `retired` is `[{old, line}]` for each line matching `` ^- `[^`]+` -> `[^`]+` - \S.*$ ``: `old` is the first backticked span.
  - Lines that match neither regex are ignored here.
  - `vocabulary-conflict.mjs` exports `vocabularyConflictRules` with `vocabulary/glossary-conflict` (`error`); append to `RULES`. Skipped when `folder.glossary` is null or unreadable. All comparisons are case-insensitive.
  - Findings, all at `folder.glossary.path`: a Term whose name equals an earlier Term's name, at the later Term's line, message `Term <name> is defined twice in the Glossary`; a Term whose name equals an `avoid` entry of any other Term, at the line of the Term holding that Avoid, message `Term <name> is also listed in Avoid of <holder>`; a Retired `old` equal to any Term name, at the Retired line, message `Retired term <old> is also a Glossary Term`.
- **Do not:** edit `R/tests/**`; add dependencies; edit `R/src/rules/glossary.mjs`; scan Sessions.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R4-07, R4-08, R4-09, R4-10; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S02 - Text scan helper and avoid-synonym Rule

- **Kind:** build
- **Goal:** Session words listed in a Term's `Avoid:` are reported as warnings, with the shared scan helper that the other word-matching cards reuse.
- **Depends on:** S01
- **Tier:** main - creates the scan helper later cards build on
- **Review:** required - creates a shared structure later cards build on; no mutation gate
- **Scenarios:**
  - R4-01: Given Glossary Term `` `Finding` - ... Avoid: issue `` and Session Workflow line "each issue is reported", when run, then `vocabulary/avoid-synonym` warning at that line, exit 0, stdout ends `workflow-check: 0 errors, 1 warnings`
  - R4-02: Given Avoid `` check (as a noun), test `` and a Session line "run the check", when run, then no Finding
  - R1-11: Given Avoid `problem`, a Session whose `## Problem` heading, a backticked `problem`, and a `## Language` bullet summary containing the word problem are the only uses, when run, then no Finding
  - R1-12: Given Avoid `issue`, a Session line "the issues" and another line "an ISSUE here", when run, then one `vocabulary/avoid-synonym` warning at the second line only
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p03-s02.test.mjs`
- **Files:** create `R/src/scan.mjs`, `R/src/rules/vocabulary-avoid.mjs`; edit `R/src/rules/index.mjs`
- **Patterns:** `R/src/rules/session-body.mjs:11 - sectionMap (private; write an equivalent in scan.mjs, do not edit or export the original)`; `R/src/rules/vocabulary-conflict.mjs:1 - Rule shape using parseGlossary`
- **Decisions:**
  - `scan.mjs` exports `sectionBody(doc, name)` returning `[{text, line}]` for the lines after the `## <name>` heading up to the next `## ` heading (blank lines included), or `null` when the heading is missing.
  - `scan.mjs` exports `scanLines(doc, {skip = []} = {})` returning `[{text, line}]` for every line of `doc` except: lines starting with `#`, lines inside `## Language`, and lines inside any section named in `skip`. In each returned `text`, every backticked span (including the backticks) is replaced by the same number of spaces.
  - `scan.mjs` exports `matchWord(text, phrase)` returning true when `phrase` occurs in `text` as a whole word, case-insensitively: build a regex from the escaped phrase with each run of whitespace as `\s+`, flags `iu`, bounded by `(?<![\p{L}\p{N}_])` and `(?![\p{L}\p{N}_])`.
  - `vocabulary-avoid.mjs` exports `vocabularyAvoidRules` with `vocabulary/avoid-synonym` (`warning`); append to `RULES`. Skipped when the Glossary is null or unreadable. For each readable Session, each `scanLines(session)` line, and each distinct `avoid` entry from `parseGlossary(folder.glossary).terms`, in Glossary order: when `matchWord` is true, record the entry. One Finding per line listing the recorded entries, at that line: `Avoid word(s): <entry>, <entry> - use the Glossary term`, kept to 160 characters.
- **Do not:** edit `R/tests/**`; add dependencies; scan the Glossary; check retired terms.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R4-01, R4-02, R1-11, R1-12; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S03 - Retired-term Rule

- **Kind:** build
- **Goal:** Session words that are a Glossary Retired old term are reported as warnings.
- **Depends on:** S02
- **Tier:** delegate - mirrors the avoid-synonym Rule with the retired list
- **Review:** none
- **Scenarios:**
  - R4-03: Given Retired line `` - `Old` -> `New` - renamed `` and a Session line "the Old way", when run, then `vocabulary/retired-term` warning at that line
  - R4-04: Given the same Retired line and a Session line "the Older way", when run, then no Finding
  - R4-11: Given the same Retired line and a Session whose only use of Old is backticked, when run, then no Finding
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p03-s03.test.mjs`
- **Files:** create `R/src/rules/vocabulary-retired.mjs`; edit `R/src/rules/index.mjs`
- **Patterns:** `R/src/rules/vocabulary-avoid.mjs:1 - scanLines/matchWord loop and one Finding per line`
- **Decisions:**
  - Export `vocabularyRetiredRules` with `vocabulary/retired-term` (`warning`); append to `RULES`.
  - Same loop as `vocabulary/avoid-synonym`, with the entries being `old` of each item in `parseGlossary(folder.glossary).retired`. Message: `Retired term(s): <old>, <old> - see Glossary Retired`, kept to 160 characters.
- **Do not:** edit `R/tests/**`; add dependencies; edit `scan.mjs` or `glossary-model.mjs`.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R4-03, R4-04, R4-11; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S04 - Missing-term Rule

- **Kind:** build
- **Goal:** a Session `## Language` bullet whose backticked term is not a Glossary Term is an error.
- **Depends on:** S02
- **Tier:** delegate - small Rule over the Glossary model
- **Review:** none
- **Scenarios:**
  - R4-05: Given a Session Language bullet `` - `Widget` - a thing `` and no Glossary Term `Widget`, when run, then `vocabulary/missing-term` error at that bullet's line (failure)
  - R4-06: Given bullet `` - `finding` - a break `` and Glossary Term `Finding`, when run, then no Finding
  - R4-12: Given the R4-05 Session and no `.workflow/language.md`, when run, then only `structure/glossary-missing` is reported (failure)
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p03-s04.test.mjs`
- **Files:** create `R/src/rules/vocabulary-missing.mjs`; edit `R/src/rules/index.mjs`
- **Patterns:** `R/src/rules/vocabulary-conflict.mjs:1 - Rule shape using parseGlossary`
- **Decisions:**
  - Export `vocabularyMissingRules` with `vocabulary/missing-term` (`error`); append to `RULES`. Skipped when the Glossary is null or unreadable.
  - For each readable Session, each line from `sectionBody(session, 'Language')` (treat `null` as empty) matching `` ^- `([^`]+)` `` yields the first backticked span; when its lowercase form equals no lowercase `name` in `parseGlossary(folder.glossary).terms`, emit a Finding at that line. Message: `Language term <term> has no Glossary Term`.
- **Do not:** edit `R/tests/**`; add dependencies; edit `scan.mjs` or `glossary-model.mjs`.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R4-05, R4-06, R4-12; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S05 - Size Rules

- **Kind:** build
- **Goal:** oversized Sessions, requirement lines, and Glossaries are reported as warnings.
- **Depends on:** S02
- **Tier:** delegate - counting Rules over existing helpers
- **Review:** none
- **Scenarios:**
  - R5-01: Given a Session of 1,501 words, when run, then `excess/session-size` warning at that Session, line 1
  - R5-02: Given a Session of exactly 1,500 words, when run, then no Finding
  - R5-03: Given a requirement line of 61 words, when run, then `excess/requirement-size` warning at that line
  - R5-04: Given a requirement line of exactly 60 words, when run, then no Finding
  - R5-05: Given a Glossary with 41 Terms, when run, then `excess/glossary-size` warning at `.workflow/language.md` on the `## Terms` line
  - R5-06: Given a Glossary with exactly 40 Terms, when run, then no Finding
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p03-s05.test.mjs`
- **Files:** create `R/src/rules/excess-size.mjs`; edit `R/src/rules/index.mjs`
- **Patterns:** `R/src/rules/vocabulary-missing.mjs:1 - Rule shape using sectionBody and parseGlossary`
- **Decisions:**
  - Export `excessSizeRules` with `excess/session-size`, `excess/requirement-size`, `excess/glossary-size`, all `warning`; append to `RULES`.
  - A word is a maximal run of non-whitespace characters. Session words are counted over every line of the Session (`doc.lines`); more than 1500 yields one Finding at line 1, message `Session has <n> words; the limit is 1500`.
  - A requirement line is a non-blank line from `sectionBody(session, 'Requirements')`; its words are counted over the line text with a leading `- ` removed; more than 60 yields a Finding at that line, message `Requirement has <n> words; the limit is 60`.
  - Glossary Terms are `parseGlossary(folder.glossary).terms`; more than 40 yields one Finding at `termsLine`, message `Glossary has <n> Terms; the limit is 40`.
  - Skip unreadable Docs and a null Glossary.
- **Do not:** edit `R/tests/**`; add dependencies; edit `scan.mjs` or `glossary-model.mjs`.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R5-01 to R5-06; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S06 - Out-of-stage Rule

- **Kind:** build
- **Goal:** implementation words in Sessions and the Glossary are reported as warnings, except where a section may name imposed things.
- **Depends on:** S05
- **Tier:** delegate - mirrors the avoid-synonym scan with a fixed word list
- **Review:** none
- **Scenarios:**
  - R5-07: Given Requirements line "R5 - stores rows in a database table. Accept: rows persist.", when run, then `excess/out-of-stage` warning at that line
  - R5-08: Given a Constraints line "imposed format: SQL export - owner: finance", when run, then no Finding
  - R5-09: Given the word `endpoint` in an Existing Solution line and in a Decisions line, when run, then no Finding
  - R5-10: Given a Glossary Term line whose meaning contains "endpoint", when run, then `excess/out-of-stage` warning at that Glossary line
  - R5-11: Given a Session using "tables" (plural), a backticked `database`, and a `## Database` heading as the only uses, when run, then no Finding
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p03-s06.test.mjs`
- **Files:** create `R/src/rules/excess-stage.mjs`; edit `R/src/rules/index.mjs`
- **Patterns:** `R/src/rules/vocabulary-avoid.mjs:1 - scanLines/matchWord loop and one Finding per line`
- **Decisions:**
  - Export `excessStageRules` with `excess/out-of-stage` (`warning`); append to `RULES`.
  - Words, in this order: schema, table, column, endpoint, controller, microservice, ORM, SQL, database, library, framework, npm, NuGet, pip, Docker, Kubernetes.
  - Sessions: `scanLines(session, {skip: ['Existing Solution', 'Constraints', 'Decisions']})`. Glossary (when readable): `scanLines(folder.glossary)`.
  - One Finding per line listing matched words in list order: `Out-of-stage word(s): <word>, <word> - belongs to later stages`, kept to 160 characters.
- **Do not:** edit `R/tests/**`; add dependencies; edit `scan.mjs`.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R5-07 to R5-11; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S07 - Repair R2-12 fixture for the missing-term Rule

- **Kind:** test-fix
- **Scope:** fixture
- **Goal:** the R2-12 fixture keeps `Finding` as a valid Glossary Term, so its only Finding stays `structure/glossary-term-format` once `vocabulary/missing-term` exists.
- **Depends on:** none
- **Tier:** main - Fixture Repair is applied by `test-author` and checked by `test-reviewer`
- **Review:** none
- **Restores:** R2-12 (its fixture's Session `## Language` bullet `Finding` has no Glossary Term, so `vocabulary/missing-term` adds a second Finding)
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p02-s01.test.mjs`
- **Files:** edit `.github/tools/workflow-check/tests/acceptance/p02-s01.test.mjs`
- **Decisions:** only the R2-12 fixture changes: its Glossary gains one valid Term line `` - `Finding` - a reported break. `` after the malformed line, so the malformed line stays on line 4. No expectation changes.
- **Done when:** the R2-12 test passes together with the full suite, excluding scenarios owned by cards that are not `completed`.

