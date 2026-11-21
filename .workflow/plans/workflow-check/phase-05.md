# P05 - Size-based sections and reword-proof skill checks

- **Outcome:** `structure/session-section` requires sections by the Session's Size, `CONTEXT-FORMAT.md` states the same set, `brain-storm` runs the whole-folder check, and the suite checks the two skills only through the backticked command.
- **Covers:** R2 (required sections by Size), R11 (command), R12 (command), R18
- **Invariants:**
  - `R` = `.github/tools/workflow-check`. ES modules (`.mjs`), no dependencies, Node built-ins only.
  - The command is `node .github/tools/workflow-check/bin/workflow-check.mjs`, run from the repo root, with no file argument in either skill.
  - Required sections: Problem and Requirements for every Size; Existing Solution when Relationship is `extend` or `amend`; Users, Workflow, Scope Guardrails, Constraints, Success, Decisions for `medium` and `large`; Language never.
  - A missing section is a `structure/session-section` error at line 1.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R2-15]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Not expressible:**
  - R11 and R12 conduct (fix, weigh, stop, redirect): R18 forbids text matching and running the skills spends tokens; the scenarios R11-02, R11-03, R12-02, R12-03 are retired and only the command is checked.
- **Gate:**
  - suite: `node --test ".github/tools/workflow-check/tests/acceptance/*.test.mjs"`
  - traceability: `node .github/tools/workflow-check/scripts/trace.mjs <IDs owned by P01 to P05, without the retired R11-02, R11-03, R12-02, R12-03>`
  - lock: `git diff --exit-code <Tests locked> -- .github/tools/workflow-check/tests`
  - mutation: unsupported for node - no mutation tool is installed and the spec forbids an install step

## S01 - Required sections follow Size

- **Kind:** build
- **Goal:** `structure/session-section` requires only the sections the Session's Size requires.
- **Depends on:** none
- **Tier:** delegate - one table replaces a constant in one Rule
- **Review:** none
- **Scenarios:**
  - R2-15: Given a `small` `extend` Session with only Existing Solution, Problem, and Requirements, when run, then no `structure/session-section` Finding
  - R2-16: Given a `large` Session missing `## Constraints`, when run, then `structure/session-section` error at that Session, line 1 (failure)
  - R2-17: Given a `medium` Session with no `## Language`, when run, then no `structure/session-section` Finding
  - R2-18: Given a `medium` Session missing `## Users`, when run, then `structure/session-section` error at line 1 (failure)
  - R2-19: Given a `small` Session missing `## Requirements`, when run, then `structure/session-section` error at line 1 (failure)
- **Acceptance tests:** written at Phase Review
- **Files:** edit `R/src/rules/session-body.mjs`
- **Patterns:** `R/src/rules/session-body.mjs:3 - the REQUIRED constant and the session-section Rule to change`
- **Decisions:**
  - Replace `REQUIRED` with `CORE = ['Problem', 'Requirements']` and `FULL = ['Users', 'Workflow', 'Scope Guardrails', 'Constraints', 'Success', 'Decisions']`.
  - Required list: `Existing Solution` when Relationship is `extend` or `amend`, then `CORE`, then `FULL` when Size is `medium` or `large`.
  - When the Size line is missing or invalid, require `CORE` and `FULL` (the Size Finding is reported elsewhere); `Language` is never required.
  - Message text stays `missing required section: ## <name>`.
- **Do not:** edit `R/tests/**`; add dependencies; change any other Rule.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R2-15, R2-16, R2-17, R2-18, R2-19; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S02 - Repair the R2-05 expectation

- **Kind:** test-fix
- **Scope:** assertion
- **Goal:** the locked test `[R2-05]` uses a `medium` Session, because a `small` Session no longer requires Scope Guardrails.
- **Depends on:** none
- **Tier:** main - test-fix cards are never delegated
- **Review:** none
- **Restores:** R2-05 (fails once S01 lands: its `small` fixture now passes)
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p01-s06.test.mjs`
- **Files:** none
- **Decisions:** only the fixture line `validSession({ sections: { 'Scope Guardrails': null } })` gains `size: 'medium'`; the expected Finding stays the same. Approved at Phase Review as an assertion-scope change because the spec changed the rule.

## S03 - CONTEXT-FORMAT states required sections by Size

- **Kind:** build
- **Goal:** `CONTEXT-FORMAT.md` holds a table of required sections per Size that matches the Rule.
- **Depends on:** S01
- **Tier:** delegate - pinned text insertion into one file
- **Review:** required - changes a persisted format
- **Scenarios:**
  - R2-20: Given the table in `CONTEXT-FORMAT.md`, when a Session is built per Size holding exactly the sections the table marks `required` (plus Existing Solution for `extend`), then run reports no `structure/session-section` Finding for each Size, and dropping any one required section yields that Finding
- **Acceptance tests:** written at Phase Review
- **Files:** edit `.github/skills/brain-storm/references/CONTEXT-FORMAT.md`
- **Patterns:** `.github/skills/brain-storm/references/CONTEXT-FORMAT.md:3 - bullet style`
- **Decisions:**
  - Add a `## Required Sections` heading directly before `## Skeleton`, holding exactly this table and no other table:

    ```
    | Section | small | medium | large |
    |---|---|---|---|
    | Problem | required | required | required |
    | Requirements | required | required | required |
    | Existing Solution | if extend or amend | if extend or amend | if extend or amend |
    | Users | optional | required | required |
    | Workflow | optional | required | required |
    | Scope Guardrails | optional | required | required |
    | Constraints | optional | required | required |
    | Success | optional | required | required |
    | Decisions | optional | required | required |
    | Language | optional | optional | optional |
    ```
  - Under the table add the line `- Cut any optional section that does not change planning or naming.`
  - Every other line stays unchanged.
- **Do not:** edit `R/tests/**`; edit any other file.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R2-20; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S04 - The suite checks skills only by command

- **Kind:** build
- **Goal:** a shared test helper accepts a skill text only when it holds the backticked command with no file argument.
- **Depends on:** none
- **Tier:** main - the helper is test-side and judgment-bearing
- **Review:** none
- **Scenarios:**
  - R18-01: Given brain-storm's text reworded and its headings renamed while keeping the command, when the helper checks it, then it accepts
  - R18-02: Given the command removed from behavior-spec's text, when the helper checks it, then it rejects (failure)
  - R18-03: Given brain-storm's command followed by `.workflow/sessions/<new session file>`, when the helper checks it, then it rejects (failure)
- **Acceptance tests:** written at Phase Review
- **Files:** none expected; the helper lives with the tests
- **Decisions:** the helper is `R/tests/support/skill-command.mjs`, exporting `skillRunsCheck(text)`; it returns true when some line holds the backticked command and no occurrence of `workflow-check.mjs` is followed by a space and a non-backtick character.
- **Do not:** add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R18-01, R18-02, R18-03; each target test reports `ok`
- **Stop and report if:** a locked test looks wrong; same failure after 3 attempts.

## S05 - Skill tests drop wording checks

- **Kind:** test-fix
- **Scope:** assertion
- **Goal:** `p04-s03` and `p04-s04` check only the command through the helper; the wording scenarios are retired.
- **Depends on:** S04
- **Tier:** main - test-fix cards are never delegated
- **Review:** none
- **Restores:** R11-01 (command now has no file argument), R12-01 (same helper); retires R11-02, R11-03, R12-02, R12-03
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p04-s03.test.mjs`, `.github/tools/workflow-check/tests/acceptance/p04-s04.test.mjs`
- **Files:** none
- **Decisions:** `[R11-01]` and `[R12-01]` call `skillRunsCheck` on the matching `SKILL.md`; the other four tests are deleted.

## S06 - brain-storm checks the whole folder

- **Kind:** fix
- **Goal:** `brain-storm` runs the command with no file argument and states R11's conduct.
- **Depends on:** S05
- **Tier:** delegate - pinned text replacement in one file
- **Review:** none
- **Restores:** R11-01
- **Acceptance tests:** none new; `p04-s03.test.mjs` as rewritten by S05
- **Files:** edit `.github/skills/brain-storm/SKILL.md`
- **Patterns:** `.github/skills/brain-storm/SKILL.md:114 - the Check section to replace`
- **Decisions:** replace the body of `### Check` (the paragraph and three bullets) with this, verbatim, and change nothing else:

  ```
  After writing the Session and Glossary, run `node .github/tools/workflow-check/bin/workflow-check.mjs` from the repo root, so the whole Workflow Folder is checked.

  - Fix every `error` Finding anchored at the new Session or the Glossary, and rerun until none remain there.
  - Weigh each `warning` anchored at the new Session or the Glossary: fix it, or leave it deliberately and name it in the brief. Ignore warnings anchored at prior Sessions.
  - Never edit a prior Session to clear a Finding. When an `error` Finding is anchored at a prior Session, once your own errors are cleared, show each such Finding line to the Developer instead of finishing.
  ```
- **Do not:** edit `R/tests/**`; edit any other file.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R11-01; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.
