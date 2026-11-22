# P02 - Workflow Core prose and Glossary contracts

- **Outcome:** Workflow Core prose under `.github/` uses canonical terms with no drift, `/pull-work` stops with a `/brain-storm` redirect when `.workflow/language.md` is missing, `test-author` and `test-reviewer` require the Glossary, `adr-writer` and `repo-scout` read it optionally, and `coder` stays closed-world.
- **Covers:** R32, R33, R34, Q-zero-vocabulary-drift, Q-suite-preservation
- **Invariants:**
  - Locked tests in `tests/glossary-alignment/p01-*.test.mjs`, `tests/acceptance/`, `.github/tools/workflow-check/tests/`, and `.github/tools/workflow-core/tests/` stay green.
  - Lowercase markers `setup-card approval` (`.github/user-interaction.md`) and `setup-card` (`.github/agents/planner.agent.md`) stay present (case-insensitive).
  - No file under `.github/` outside `.github/tools/` is named `language.md`, `glossary.md`, or `workflow-terms.md`; `.github/skills/brain-storm/references/LANGUAGE-FORMAT.md` stays.
  - Forbidden in `.github/skills/**`, `.github/agents/**`, `.github/user-interaction.md` prose (case-insensitive): `language skill(s)`, `core workflow`, `toolkit`, `approval step`, `validation step`, `design doc`, `language file`, `dictionary`, `flaky test`, `legacy failure`, `slice card(s)`, `Setup-Card Checkpoint`, `Phase Review Checkpoint`, `phase review approval`. Exempt: backticked `deferred-to-PRD`, `SPEC-FORMAT.md` `## Exclude` list, `.github/tools/`.
  - `.github/agents/coder.agent.md` never mentions `.workflow/language.md` or a Glossary read.
  - Prior Sessions in `.workflow/sessions/` are never modified.
- **Harness:**
  - run: `node --test --test-reporter=tap "tests/glossary-alignment/*.test.mjs"`; select `--test-name-pattern "<ids>"`; exclude `--test-skip-pattern "<ids>"`
  - tag: test title starts with `[R32-01]` or `[Q-suite-preservation]`
  - count: `# pass N` and `# fail N` TAP summary lines
  - assert: `^\s*(assert\.|test\()`
- **Not expressible:**
  - R34-03 and Q-suite-preservation hold before any card runs, so their tests pass from the start; they are regression guards and not failing-first tests.
  - Live agent conduct (whether `adr-writer` or `repo-scout` actually uses Glossary terms, or `test-author` actually stops at runtime) is verified only through the stable wording markers pinned in S03 and S04.
- **Gate:**
  - suite: `node --test --test-reporter=tap "tests/glossary-alignment/*.test.mjs" "tests/acceptance/*.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node --test --test-reporter=tap "tests/glossary-alignment/*.test.mjs" | node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/glossary-alignment/phase-02.md R32-01 R32-02 R32-03 Q-zero-vocabulary-drift R33-01 R33-02 R33-03 R33-04 R33-05 R33-06 R34-01 R34-02 R34-03 Q-suite-preservation`
  - lock: `git diff --exit-code <Tests locked> -- tests/glossary-alignment`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - Glossary presence check helper

- **Kind:** build
- **Goal:** `node .github/skills/pull-work/scripts/glossary-check.mjs` exits 0 silently when `.workflow/language.md` exists in the current directory and otherwise exits 2 with the redirect message on stderr.
- **Depends on:** none
- **Tier:** delegate - small script mirroring `parse-args.mjs`
- **Review:** none
- **Scenarios:**
  - R33-01: Given a temp directory containing `.workflow/language.md`, when `glossary-check.mjs` runs with that directory as cwd, then exit code is 0 and stdout and stderr are empty.
  - R33-02: Given a temp directory with no `.workflow/language.md`, when `glossary-check.mjs` runs there, then exit code is 2, stderr is exactly `Missing required Glossary at .workflow/language.md. Run /brain-storm to establish it before continuing with /pull-work.` plus a newline, stdout is empty, and the directory still has no files (failure).
- **Acceptance tests:** `tests/glossary-alignment/p02-s01.test.mjs`
- **Files:** create `.github/skills/pull-work/scripts/glossary-check.mjs`
- **Patterns:** `.github/skills/pull-work/scripts/parse-args.mjs:1 - header comment, stderr message, process.exit codes, ES module style`
- **Decisions:**
  - Check `existsSync('.workflow/language.md')` relative to the current working directory using `node:fs`; no arguments are read.
  - Missing: write the exact message from R33-02 to stderr with `console.error`, then `process.exit(2)`. Present: `process.exit(0)` with no output.
  - Header comment states purpose, output, exit codes, and usage in the same four-line style as `parse-args.mjs`.
  - The script writes no files.
- **Do not:** edit `tests/glossary-alignment/**`; edit any other file; add dependencies
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern "{regression-exclude}" "tests/glossary-alignment/*.test.mjs"` exits 0; targets R33-01, R33-02; 2 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts

## S02 - Remove vocabulary drift from Workflow Core prose

- **Kind:** build
- **Goal:** Workflow Core prose under `.github/` contains no avoided synonyms, variant Checkpoint labels, or duplicate glossary file, and the existing marker tests stay green.
- **Depends on:** none
- **Tier:** delegate - every occurrence is pinned below
- **Review:** none
- **Scenarios:**
  - R32-01: Given `.github/skills/**`, `.github/agents/**`, and `.github/user-interaction.md` (excluding `.github/tools/`, backticked `deferred-to-PRD`, and `SPEC-FORMAT.md`'s `## Exclude` list), when searched case-insensitively for every forbidden phrase in Invariants, then zero matches exist.
  - R32-02: Given `.github/`, when listing files outside `.github/tools/` named `language.md`, `glossary.md`, or `workflow-terms.md`, then none exist and `.github/skills/brain-storm/references/LANGUAGE-FORMAT.md` exists (failure guard for duplicates).
  - R32-03: Given `.github/user-interaction.md` and `.github/agents/planner.agent.md`, when searched case-insensitively, then they contain `setup-card approval` and `setup-card` respectively, and `.github/skills/work-planner/SKILL.md`, `.github/skills/pull-work/SKILL.md`, and `.github/agents/coder.agent.md` each contain the word `Card` and zero `slice card`.
  - Q-zero-vocabulary-drift: Given `docs/walkthrough-*.md`, `.github/skills/**`, `.github/agents/**`, and `.github/user-interaction.md` with the same exemptions, when searched for the forbidden phrases plus `language-skills`, then zero matches exist.
- **Acceptance tests:** `tests/glossary-alignment/p02-s02.test.mjs`
- **Files:** edit `.github/agents/planner.agent.md`, `.github/agents/coder.agent.md`, `.github/agents/test-author.agent.md`, `.github/skills/work-planner/SKILL.md`, `.github/skills/work-planner/README.md`, `.github/skills/work-planner/references/PHASE-FORMAT.md`, `.github/skills/work-planner/references/PLAN-FORMAT.md`, `.github/skills/pull-work/SKILL.md`
- **Patterns:** `.workflow/language.md:14 - canonical spelling of Card, Slice, Setup-Card Approval, Phase Review`
- **Decisions:**
  - `planner.agent.md:23`: `run the setup-card Checkpoint when` becomes `run Setup-Card Approval when`.
  - `coder.agent.md:3,4,16` and `test-author.agent.md:3,15`: every `slice card` becomes `Card` (`one delegate-tier Card`, `Paste one Card.`, `You receive one Card.`, `for one Card`, `one Card, the phase's`).
  - `work-planner/SKILL.md:115`: `at the Phase Review Checkpoint` becomes `at Phase Review`.
  - `pull-work/SKILL.md:149`: `setup-card approval and phase review approval:` becomes `Setup-Card Approval and Phase Review:`.
  - `work-planner/README.md:3`: `slice cards` becomes `Cards`. `PHASE-FORMAT.md:3`: `every slice card for the phase` becomes `every Card for the phase`. `PLAN-FORMAT.md:56`: `At each phase review approval,` becomes `At each approved Phase Review,`.
  - Do not touch `.github/user-interaction.md`; it already carries `setup-card approval`.
  - Do not create any glossary file.
- **Do not:** edit `tests/**`; edit `.workflow/**`; edit `.github/tools/**`; edit other files; add dependencies
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern "{regression-exclude}" "tests/glossary-alignment/*.test.mjs"` exits 0; targets R32-01, R32-02, R32-03, Q-zero-vocabulary-drift; 4 target tests run; then `node --test ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the workflow-core suite fails; same failure after 3 attempts

## S03 - Glossary required input for pull-work, test-author, test-reviewer

- **Kind:** build
- **Goal:** `pull-work`, `test-author`, and `test-reviewer` declare `.workflow/language.md` as a required input, `pull-work` Preflight runs the missing-Glossary check after argument parsing and before routing, and both dispatchers pass the Glossary path alongside the spec path.
- **Depends on:** S01, S02
- **Tier:** delegate - prose edits with pinned literal wording
- **Review:** none
- **Scenarios:**
  - R33-03: Given `.github/skills/pull-work/SKILL.md`, when read, then it contains the line `Required input: \`.workflow/language.md\`` and its `## Preflight` section mentions `parse-args.mjs`, then `glossary-check.mjs`, then `reconcile-check.mjs candidates` in that order, with `/brain-storm` named in the redirect sentence.
  - R33-04: Given `.github/agents/test-author.agent.md` and `.github/agents/test-reviewer.agent.md`, when read, then each contains the line `Required input: \`.workflow/language.md\`` and a sentence matching `missing` and `stop and report` and `caller`; test-author's says `without writing tests` and test-reviewer's says `without approving`.
  - R33-05: Given `.github/skills/pull-work/SKILL.md` Fixture Repair and `.github/skills/work-planner/SKILL.md` Phase Review, when read, then each dispatch of `test-author` or `test-reviewer` names `.workflow/language.md` alongside the spec path.
  - R33-06: Given a temp directory with no `.workflow/language.md`, when `parse-args.mjs bug:` runs there, then exit code is 2, stderr is `/pull-work [<slug>] bug: <description>`, and stdout is empty (failure).
- **Acceptance tests:** `tests/glossary-alignment/p02-s03.test.mjs`
- **Files:** edit `.github/skills/pull-work/SKILL.md`, `.github/skills/work-planner/SKILL.md`, `.github/agents/test-author.agent.md`, `.github/agents/test-reviewer.agent.md`
- **Patterns:** `.github/agents/test-reviewer.agent.md:13 - "Asks the Developer: never - stop and report to the caller." contract line`
- **Decisions:**
  - `pull-work/SKILL.md`: add `Required input: \`.workflow/language.md\` (product vocabulary).` as a line under the first heading intro, before `## Preflight`.
  - `pull-work/SKILL.md` Preflight: insert a step after the argument-parsing sentence and before step 1's plan search: `Run \`node .github/skills/pull-work/scripts/glossary-check.mjs\`. Exit 2 stops with its message, \`Missing required Glossary at .workflow/language.md. Run /brain-storm to establish it before continuing with /pull-work.\`, and changes nothing.` Because Preflight prose currently places `parse-args.mjs` after step 2, move the sentence about `parse-args.mjs` to precede the glossary step so order is `parse-args.mjs`, `glossary-check.mjs`, `reconcile-check.mjs candidates`.
  - `pull-work/SKILL.md` Fixture Repair steps 1 and 3: add `and \`.workflow/language.md\`` after `the spec path`.
  - `work-planner/SKILL.md` Phase Review step 1: after `pass the spec path with each card` add `and \`.workflow/language.md\``.
  - `test-author.agent.md` and `test-reviewer.agent.md`: add after the `Asks the Developer` line `Required input: \`.workflow/language.md\` (product vocabulary).` and `If it is missing, stop and report that to the caller without writing tests.` (test-reviewer: `without approving.`). In the receive sentences add `the \`.workflow/language.md\` path` next to `the spec path`.
- **Do not:** edit `tests/**`; edit `.workflow/**`; edit `.github/agents/coder.agent.md`; add dependencies
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern "{regression-exclude}" "tests/glossary-alignment/*.test.mjs"` exits 0; targets R33-03, R33-04, R33-05, R33-06; 4 target tests run; then `node --test ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the workflow-core suite fails; same failure after 3 attempts

## S04 - Optional Glossary for adr-writer and repo-scout; coder stays closed-world

- **Kind:** build
- **Goal:** `adr-writer` and `repo-scout` list `.workflow/language.md` as an optional input that never blocks them, `coder` stays closed-world, and every existing suite still passes.
- **Depends on:** S03
- **Tier:** delegate - two pinned prose additions
- **Review:** none
- **Scenarios:**
  - R34-01: Given `.github/skills/adr-writer/SKILL.md`, when its `## Inputs` section is read, then it lists `.workflow/language.md` with the words `Optional` and `proceed without` and `skip Glossary grounding`.
  - R34-02: Given `.github/agents/repo-scout.agent.md`, when read, then it contains the line `Optional input: \`.workflow/language.md\`` and a sentence with `proceed without` and `skip Glossary grounding`.
  - R34-03: Given `.github/agents/coder.agent.md`, when searched case-insensitively for `language.md` and `glossary`, then zero matches exist (failure guard).
  - Q-suite-preservation: Given the three existing acceptance suites, when run together, then exit code is 0.
- **Acceptance tests:** `tests/glossary-alignment/p02-s04.test.mjs`
- **Files:** edit `.github/skills/adr-writer/SKILL.md`, `.github/agents/repo-scout.agent.md`
- **Patterns:** `.github/skills/adr-writer/SKILL.md:44 - numbered Inputs list`
- **Decisions:**
  - `adr-writer/SKILL.md` `## Inputs`: append item 3 `Optional: \`.workflow/language.md\`; when present, read it and use its canonical terms; when absent, proceed without it and skip Glossary grounding.`
  - `repo-scout.agent.md`: after the `Asks the Developer` line add `Optional input: \`.workflow/language.md\`. When present, read it and use its canonical terms; when absent, proceed without it and skip Glossary grounding.`
- **Do not:** edit `tests/**`; edit `.github/agents/coder.agent.md`; edit other files; add dependencies
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern "{regression-exclude}" "tests/glossary-alignment/*.test.mjs"` exits 0; targets R34-01, R34-02, R34-03, Q-suite-preservation; 4 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; same failure after 3 attempts
