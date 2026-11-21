# P04 - Skill integration and qualities

- **Outcome:** `workflow-check` is proven offline, non-interactive, deterministic and fast, and `brain-storm` and `behavior-spec` run it as the spec requires.
- **Covers:** R10 (no stdin, no network), R11, R12, Q-speed, Q-determinism
- **Invariants:**
  - `R` = `.github/tools/workflow-check`. ES modules (`.mjs`), no dependencies, Node built-ins only.
  - The command is `node .github/tools/workflow-check/bin/workflow-check.mjs [file]`, run from the repo root.
  - Skill files are `.github/skills/brain-storm/SKILL.md` and `.github/skills/behavior-spec/SKILL.md`; edits there add text only and leave every existing line unchanged.
  - Never write, create, or delete anything from the tool at run time.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R11-01]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Gate:**
  - suite: `node --test ".github/tools/workflow-check/tests/acceptance/*.test.mjs"`
  - traceability: `node .github/tools/workflow-check/scripts/trace.mjs <IDs owned by P01 to P04>`
  - lock: `git diff --exit-code <Tests locked> -- .github/tools/workflow-check/tests`
  - mutation: unsupported for node - no mutation tool is installed and the spec forbids an install step

## S01 - Offline and non-interactive run

- **Kind:** build
- **Goal:** a run never waits on stdin and the tool source has no network or stdin access.
- **Depends on:** none
- **Tier:** main - the scenario may already hold, so the card is a verification that needs judgment if it fails
- **Review:** required - crosses a trust boundary (network, process, stdin); no mutation gate
- **Scenarios:**
  - R10-02: Given a valid Workflow Folder and a stdin pipe that is never written to or closed, when run, then the process exits on its own within 5 seconds with code 0
  - R10-03: Given the files under `R/bin` and `R/src`, when their text is scanned, then none imports `node:net`, `node:http`, `node:https`, `node:http2`, `node:tls`, `node:dgram`, `node:dns`, `node:child_process`, or `node:readline`, none references `process.stdin`, and none calls `fetch(`
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p04-s01.test.mjs`
- **Files:** none expected; edit only the `R/bin` or `R/src` file the failing scenario names
- **Patterns:** `R/tests/support/harness.mjs:12 - spawning the CLI in a temp Workflow Folder`
- **Decisions:**
  - These scenarios may pass before any code changes; the card then completes with no `Files` edited.
  - A failing scenario is fixed by removing the offending import or call, never by weakening the test.
- **Do not:** edit `R/tests/**`; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R10-02, R10-03; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S02 - Determinism and speed

- **Kind:** build
- **Goal:** unchanged files give byte-identical output regardless of location, and a folder of 10 Sessions is checked within 2 seconds.
- **Depends on:** none
- **Tier:** main - the scenarios may already hold, so the card is a verification that needs judgment if it fails
- **Review:** none
- **Scenarios:**
  - Q-determinism: Given a Workflow Folder with at least one error and one warning Finding, when run twice in place and once on a copy in a different directory, then the three stdout texts and exit codes are identical
  - Q-speed: Given a Workflow Folder of 10 valid final Sessions of about 1,000 words each and a Glossary of 40 Terms, when run, then the process ends within 2,000 ms measured from spawn to exit
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p04-s02.test.mjs`
- **Files:** none expected; edit only the `R/src` file the failing scenario names
- **Patterns:** `R/tests/support/harness.mjs:12 - spawning the CLI in a temp Workflow Folder`
- **Decisions:**
  - Findings are already sorted by path, line, then rule-id; a nondeterminism fix keeps that order and ordinal comparison.
  - A speed fix targets the slow Rule, never a skipped Rule.
- **Do not:** edit `R/tests/**`; add dependencies; remove or skip a Rule.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets Q-determinism, Q-speed; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S03 - brain-storm runs the check

- **Kind:** build
- **Goal:** `brain-storm` tells the agent to run `workflow-check` on its new Session, fix errors, weigh warnings, and never edit a prior Session.
- **Depends on:** none
- **Tier:** delegate - pinned text insertion into one file
- **Review:** none
- **Scenarios:**
  - R11-01: Given `.github/skills/brain-storm/SKILL.md`, when read, then it contains the exact line `node .github/tools/workflow-check/bin/workflow-check.mjs .workflow/sessions/<new session file>` after the `## 5. Output` heading
  - R11-02: Given the same file, when read, then it contains the lines "Fix every `error` Finding and rerun until the summary reads `0 errors`." and "Weigh each `warning`: fix it, or leave it deliberately and name it in the brief."
  - R11-03: Given the same file, when read, then it contains the sentence "Never edit a prior Session to clear a Finding. When an `error` Finding is anchored at a prior Session, stop and report it to the user instead of finishing." (failure)
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p04-s03.test.mjs`
- **Files:** edit `.github/skills/brain-storm/SKILL.md`
- **Patterns:** `.github/skills/brain-storm/SKILL.md:103 - the Output section whose list style to follow`
- **Decisions:**
  - Insert after the paragraph that begins "If the user ends early" and before the paragraph that begins "Finish with a brief", this block, verbatim:

    ```
    ### Check

    After writing the Session and Glossary, run `node .github/tools/workflow-check/bin/workflow-check.mjs .workflow/sessions/<new session file>` from the repo root.

    - Fix every `error` Finding and rerun until the summary reads `0 errors`.
    - Weigh each `warning`: fix it, or leave it deliberately and name it in the brief.
    - Never edit a prior Session to clear a Finding. When an `error` Finding is anchored at a prior Session, stop and report it to the user instead of finishing.
    ```
  - Every other line of the file stays unchanged.
- **Do not:** edit `R/tests/**`; edit any other file; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R11-01, R11-02, R11-03; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.

## S04 - behavior-spec runs the check

- **Kind:** build
- **Goal:** `behavior-spec` runs `workflow-check` on the whole Workflow Folder before reading its inputs, and redirects to `brain-storm` on any error or exit code 2.
- **Depends on:** none
- **Tier:** delegate - pinned text insertion into one file
- **Review:** none
- **Scenarios:**
  - R12-01: Given `.github/skills/behavior-spec/SKILL.md`, when read, then it contains the exact line `node .github/tools/workflow-check/bin/workflow-check.mjs` followed by no file argument, after the `## Inputs` heading
  - R12-02: Given the same file, when read, then it contains the sentence "When any `error` Finding appears or the exit code is 2, stop, show the `error` Findings, and redirect to `brain-storm`." (failure)
  - R12-03: Given the same file, when read, then it contains the sentence "`warning` Findings do not stop it."
- **Acceptance tests:** `.github/tools/workflow-check/tests/acceptance/p04-s04.test.mjs`
- **Files:** edit `.github/skills/behavior-spec/SKILL.md`
- **Patterns:** `.github/skills/behavior-spec/SKILL.md:16 - the Inputs section whose style to follow`
- **Decisions:**
  - Insert after the paragraph that begins "Stop and redirect to `brain-storm` when" and before the paragraph that begins "Do not read `.workflow/plans/`", this paragraph, verbatim:

    ```
    Before reading the inputs, run `node .github/tools/workflow-check/bin/workflow-check.mjs` from the repo root. When any `error` Finding appears or the exit code is 2, stop, show the `error` Findings, and redirect to `brain-storm`. `warning` Findings do not stop it.
    ```
  - The exact-line scenario R12-01 is satisfied by the command appearing in backticks with nothing after `.mjs`.
  - Every other line of the file stays unchanged.
- **Do not:** edit `R/tests/**`; edit any other file; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs"` exits 0; targets R12-01, R12-02, R12-03; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts.
