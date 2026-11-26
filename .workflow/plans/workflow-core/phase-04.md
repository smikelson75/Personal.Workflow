# P04 - AGENTS.md allow-list (spec reconcile)

- **Outcome:** the locked check for R22 accepts `AGENTS.md` mentions in `onboard-project` and `agents-md` and rejects them everywhere else under `.github/`.
- **Covers:** R22 (allow-list amendment only)
- **Invariants:**
  - `C` = `.github/tools/workflow-core`. ES modules (`.mjs`), no dependencies, Node built-ins only.
  - Tests read skill, agent, and hook text through markers only: paths and a token a card names. Never a whole sentence.
  - Product files under `.github/skills`, `.github/agents`, and `.github/hooks` are not edited in this phase.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R22-03]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Not expressible (presented at Phase Review):**
  - R22: no Workflow Core skill or agent requires `AGENTS.md` to exist in order to run - runtime behavior of agents; the allow-list test keeps every other file from naming it
  - R22: `/agents-md` creates `AGENTS.md` when absent - the `agents-md` skill belongs to the home-repo-workflow plan (R44), not this plan
- **Gate:**
  - suite: `node --test ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/workflow-core/phase-04.md R22-03`
  - lock: `git diff --exit-code <Tests locked> -- .github/tools/workflow-core/tests`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - Allow-list test for AGENTS.md

- **Kind:** test-fix
- **Scope:** assertion
- **Goal:** the `[R22-03]` test passes when every file under `.github/skills`, `.github/agents`, and `.github/hooks` that contains `AGENTS.md` lies under `.github/skills/onboard-project/` or `.github/skills/agents-md/`.
- **Depends on:** none
- **Tier:** main - test-fix cards are never dispatched to `coder`
- **Review:** none
- **Restores:** R22-03 (failing since the spec amendment: `onboard-project` legitimately names `AGENTS.md`)
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p01-s03.test.mjs`
- **Files:** none
- **Patterns:** `.github/tools/workflow-core/tests/acceptance/p01-s03.test.mjs:28 - the scan being changed`
- **Decisions:**
  - Keep the title `[R22-03] ...` prefix; retitle to `[R22-03] only onboard-project and agents-md name AGENTS.md`.
  - Allowed prefixes: `.github/skills/onboard-project/` and `.github/skills/agents-md/`; scanned directories and the non-empty-scan assertion stay.
  - Offenders are matching files outside the allowed prefixes; the test asserts `offenders` is `[]`.
  - `[R22-02]` and `[R22-04]` are unchanged.
- **Do not:** edit any other test; edit product files; add dependencies.
- **Done when:** `node --test --test-reporter=tap ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; target R22-03; the suite reports 0 failures
- **Stop and report if:** a product file must change; the same failure after 3 attempts.
