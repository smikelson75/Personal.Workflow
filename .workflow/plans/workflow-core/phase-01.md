# P01 - Interaction rules and stage commits

- **Outcome:** the Workflow Core carries one user-interaction rules file that every asking skill and agent refers to, and `planner`, `brain-storm`, and `behavior-spec` commit their own output.
- **Covers:** R22, R23 (rules file and references), R13, R19
- **Invariants:**
  - `C` = `.github/tools/workflow-core`. ES modules (`.mjs`), no dependencies, Node built-ins only.
  - Tests read skill and agent text through markers only: paths, commands, commit templates, line starts such as `- **Label:**` or `Label:`, and headings. Never a whole sentence.
  - Edits to existing skill files only add lines or replace the one line a card names; every other line stays unchanged (workflow-check's locked tests read `brain-storm` and `behavior-spec`).
  - The rules file path is `.github/user-interaction.md`.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R13-01]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Not expressible (presented at Phase Review):**
  - R22-05: skill-specific question formats never contradict the rules file - no stable marker; contradiction is a judgment about prose
  - R13, R19 failure outcomes (hook rejection: fix and retry, or stop and show output) - the markers prove the instruction exists, not that an agent obeys it; running agents in tests spends tokens
  - R23 examples (the number of questions a Checkpoint costs) - needs a live Developer conversation; R23-01 to R23-04 prove the rules text exists
- **Gate:**
  - suite: `node --test ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node .github/tools/workflow-core/scripts/trace.mjs <IDs owned by P01>`
  - lock: `git diff --exit-code <Tests locked> -- .github/tools/workflow-core/tests`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - Core test harness and trace script

- **Kind:** setup
- **Goal:** `C/support/harness.mjs` and `C/scripts/trace.mjs` exist so acceptance tests can read repo files, build temporary git repositories, and run scripts, and the Gate can trace scenario IDs.
- **Depends on:** none
- **Tier:** main - creates the structure every later test and script builds on
- **Review:** required - creates a shared structure; no mutation gate
- **Files:** create `.github/tools/workflow-core/support/harness.mjs`; create `.github/tools/workflow-core/scripts/trace.mjs`
- **Patterns:** `.github/tools/workflow-check/tests/support/harness.mjs:11 - spawning a process in a temp directory`; `.github/tools/workflow-check/scripts/trace.mjs:1 - TAP trace of scenario IDs`
- **Decisions:**
  - `harness.mjs` exports: `repoRoot` (absolute path of this repository, resolved from `import.meta.url`); `read(rel)` returns the UTF-8 text of `repoRoot/rel`; `lines(rel)` returns `read(rel)` split on `\r?\n`; `files(relDir)` returns repo-relative `/` paths of every file under `repoRoot/relDir`, recursively, sorted; `tempRepo()` returns an object with `dir`, `write(rel, text)` (creates parent folders), `commit(message)` (stages everything, commits with `user.name=t`, `user.email=t@t`, and returns the full sha), `run(scriptRel, args = [], opts = {})` (spawns `node repoRoot/scriptRel ...args` with `cwd = dir` and optional `opts.input`, and returns `{ status, stdout, stderr }`), and `cleanup()`.
  - `tempRepo()` runs `git init -b main` in a new `os.tmpdir()` folder and sets `core.autocrlf` to `false`.
  - `trace.mjs` copies `workflow-check/scripts/trace.mjs` with the suite path changed to `C/tests/acceptance/*.test.mjs`; usage `node trace.mjs <scenario-ID>...`; exit 0 only when every ID has a passing test and none fail.
- **Do not:** add dependencies; edit any other file.
- **Done when:** `node -e "import('./.github/tools/workflow-core/support/harness.mjs').then(m=>{const r=m.tempRepo();r.write('a/b.txt','x');const sha=r.commit('chore: t');const out=r.run('.github/tools/workflow-core/scripts/trace.mjs');r.cleanup();process.exit(sha.length===40&&out.status===2&&m.read('.github/skills/pull-work/SKILL.md').length>0?0:1)})"` exits 0
- **Stop and report if:** a file outside Files must change; the same failure after 3 attempts.

## S02 - User-interaction rules file

- **Kind:** build
- **Goal:** one file holds the question rules and the Checkpoint rules.
- **Depends on:** S01
- **Tier:** main - creates the shared structure every skill and agent refers to
- **Review:** required - creates a shared structure; no mutation gate
- **Scenarios:**
  - R22-01: Given `.github/user-interaction.md`, when its lines are read, then a `## Question rules` heading is followed by lines starting `- **Context:**`, `- **One at a time:**`, `- **Pace:**`, and `- **Token savings:**`
  - R23-01: Given the same file, when read, then a `## Checkpoint` heading is followed by lines starting `- **Present:**`, `- **Ask:**`, `- **Approve all:**`, `- **Name items:**`, and `- **Cascade:**`
  - R23-02: Given the same file, when the paragraph under `## Checkpoint` is read, then it contains `setup-card approval`, `Phase Review`, and `ADR candidate`
  - R23-03: Given the same file, when the `- **Present:**` line is read, then it contains `S03`, `A1`, and `scenario ID`; and the `- **Name items:**` line contains `unnamed items are approved`
  - R23-04: Given the same file, when read, then a `## Skill-specific formats` heading exists (failure: a file missing it fails)
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p01-s02.test.mjs`
- **Files:** create `.github/user-interaction.md`
- **Patterns:** `.github/skills/pull-work/SKILL.md:1 - plain markdown with `##` headings`
- **Decisions:** the file text, verbatim:

  ```
  # User-Interaction Rules

  Every skill and agent that asks the Developer a question follows these rules.

  ## Question rules

  - **Context:** give context with each question: where the work stands, why the answer matters, and options with tradeoffs plus a recommendation when the answer space is known.
  - **One at a time:** ask one question at a time in plain language, defining unfamiliar terms.
  - **Pace:** keep a conversational, unrushed pace: discuss when the Developer is unsure or pushes back, and confirm brief answers before treating them as settled.
  - **Token savings:** token savings never come from shortening what the Developer reads.

  ## Checkpoint

  A Checkpoint is a planned stop where the Developer reviews or approves, and it counts as one question. The Checkpoints are setup-card approval in Plan mode, Phase Review, and an ADR candidate raised by Revise when no Phase Review follows. Phase completion is a planned stop with a brief and no question.

  - **Present:** show every item at once, each with a label: a card ID such as `S03`, an ADR candidate such as `A1`, or a not-expressible scenario by its scenario ID.
  - **Ask:** ask one question: approve all, or name items.
  - **Approve all:** every item is approved and the run continues with no further question.
  - **Name items:** unnamed items are approved; named items are discussed one at a time in the order named, following the question rules. Each ends approved, changed and approved, or rejected. After the last one the Checkpoint completes without asking the bundle again.
  - **Cascade:** a change agreed for a named item that alters another item's tests or Decisions adds that item to the discussion.

  ## Skill-specific formats

  A skill's own question format adds to these rules and never contradicts them.
  ```
- **Do not:** edit any other file; edit `C/tests/**`.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R22-01, R23-01, R23-02, R23-03, R23-04; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S03 - Skills and agents refer to the rules file

- **Kind:** build
- **Goal:** every asking skill and agent names the rules file, no file under `.github/` names `AGENTS.md`, and the four non-asking agents say they never ask.
- **Depends on:** S02
- **Tier:** delegate - the same one-line insertion into eleven files
- **Review:** required - test literal in product code
- **Scenarios:**
  - R22-02: Given each of `.github/skills/{brain-storm,behavior-spec,work-planner,pull-work,adr-writer,conventional-commit}/SKILL.md` and `.github/agents/planner.agent.md`, when read, then each contains the line `Question rules: follow \`.github/user-interaction.md\`.`
  - R22-03: Given every file under `.github/skills`, `.github/agents`, and `.github/hooks`, when scanned, then none contains the text `AGENTS.md` (failure)
  - R22-04: Given each of `.github/agents/{coder,test-author,test-reviewer,repo-scout}.agent.md`, when read, then each contains the line `Asks the Developer: never - stop and report to the caller.`
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p01-s03.test.mjs`
- **Files:** edit the six `SKILL.md` files above and the five agent files `planner`, `coder`, `test-author`, `test-reviewer`, `repo-scout` under `.github/agents/` (suffix `.agent.md`)
- **Patterns:** `.github/skills/pull-work/SKILL.md:1 - H1 heading that the new line follows`
- **Decisions:**
  - In each `SKILL.md`, insert a blank line and the line from R22-02 directly after the H1 heading line, before the existing first paragraph. In `planner.agent.md`, insert that line followed by a blank line directly after the closing `---` of the front matter and its blank line, before `Load the`.
  - In `coder`, `test-author`, `test-reviewer`, and `repo-scout`, insert the line from R22-04 the same way after the front matter.
  - In `pull-work/SKILL.md`, replace the phrase `follow AGENTS.md's User Interaction rules` with `follow the rules in \`.github/user-interaction.md\``. This is the only replaced text.
- **Do not:** edit `C/tests/**`; edit any other file or line; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R22-02, R22-03, R22-04; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; a file has no H1 heading; the same failure after 3 attempts.

## S04 - Checkpoint references in work-planner and pull-work

- **Kind:** build
- **Goal:** `work-planner` and `pull-work` tie their Checkpoints to the rules file.
- **Depends on:** S03
- **Tier:** delegate - pinned line insertion into two files
- **Review:** required - test literal in product code
- **Scenarios:**
  - R23-05: Given `.github/skills/work-planner/SKILL.md`, when read, then a line contains both `.github/user-interaction.md` and `## Checkpoint` and `Phase Review`
  - R23-06: Given `.github/skills/pull-work/SKILL.md`, when read, then a line contains both `.github/user-interaction.md` and `## Checkpoint` and `Phase Review`
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p01-s04.test.mjs`
- **Files:** edit `.github/skills/work-planner/SKILL.md`; edit `.github/skills/pull-work/SKILL.md`
- **Patterns:** `.github/skills/work-planner/SKILL.md:68 - the Contract bullet list`
- **Decisions:**
  - In `work-planner/SKILL.md`, add as the last bullet of `## Contract`: ``- Checkpoints (setup-card approval, Phase Review, an ADR candidate from Revise with no Phase Review after it) are each one bundled question, run by the `## Checkpoint` rules in `.github/user-interaction.md`.``
  - In `pull-work/SKILL.md`, add as the last line of the `## Escalate Only` section, after its closing paragraph and a blank line: ``Setup-card approval, Phase Review, and an ADR candidate from Revise are Checkpoints: one bundled question, run by the `## Checkpoint` rules in `.github/user-interaction.md`.``
- **Do not:** edit `C/tests/**`; edit any other file or line.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R23-05, R23-06; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; `## Contract` or `## Escalate Only` is missing; the same failure after 3 attempts.

## S05 - planner commits and hands back

- **Kind:** build
- **Goal:** the `planner` agent can run `git`, commits its plan, and hands back to `/pull-work`.
- **Depends on:** S03
- **Tier:** delegate - pinned front matter and text edit of one file
- **Review:** required - test literal in product code
- **Scenarios:**
  - R13-01: Given `.github/agents/planner.agent.md`, when its `tools:` front-matter line is read, then it lists `execute` besides `read`, `search`, `edit`, `agent`, `todo`
  - R13-02: Given the same file, when read, then a line starts `- Commit:` and contains `docs(<slug>): plan PNN`, `plan.md`, and the active phase file, and a line starts `- Stage:` and contains `by path`
  - R13-03: Given the same file, when read, then a line starts `- Run ends:` and contains `Next` and `/pull-work` and `main session`
  - R13-04: Given the same file, when read, then a line starts `- Never:` and contains `Phase Review`, `Dispatch`, `acceptance tests`, and `--no-verify`
  - R13-05: Given the same file, when read, then a line starts `- On rejection:` (failure)
  - R13-06: Given the same file, when read, then a line starts `- Checkpoint:` and contains `setup-card`
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p01-s05.test.mjs`
- **Files:** edit `.github/agents/planner.agent.md`
- **Patterns:** `.github/agents/planner.agent.md:12 - the bullet list to extend`
- **Decisions:**
  - Change the `tools:` line to `tools: ['read', 'search', 'edit', 'execute', 'agent', 'todo']`.
  - Replace the last bullet (`When plan.md and the active phase are written, commit them...`) with these bullets, verbatim, and leave every other bullet unchanged:

    ```
    - Commit: when `plan.md` and the active phase file are written, commit them, with any ADR written in the same run, as one commit `docs(<slug>): plan PNN`.
    - Stage: only the files you wrote, by path.
    - Checkpoint: run the setup-card Checkpoint when the phase opens with setup cards; it is part of Plan mode.
    - Run ends: state the `Next` line and tell the Developer to continue with `/pull-work` in the main session.
    - Never: run Phase Review, Dispatch, or any later mode; write acceptance tests; push; use `--no-verify`.
    - On rejection: when a hook rejects the commit, fix the cause if it lies in your own message or files and retry; otherwise stop and show the rejection output, leaving the files on disk.
    ```
- **Do not:** edit `C/tests/**`; edit any other file or line.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R13-01 to R13-06; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S06 - brain-storm commits its output

- **Kind:** build
- **Goal:** `brain-storm` commits its Session and Glossary without asking, including draft Sessions and runs that stop on a prior-Session error.
- **Depends on:** S03
- **Tier:** delegate - pinned section insertion into one file
- **Review:** required - test literal in product code
- **Scenarios:**
  - R19-01: Given `.github/skills/brain-storm/SKILL.md`, when read, then a `### Commit` heading follows the `### Check` heading, and a line starts `- Commit:` and contains `docs(workflow): session <topic>`, `.workflow/language.md`, and `without asking`
  - R19-02: Given the same file, when the `- Commit:` line is read, then it contains `draft`
  - R19-03: Given the same file, when read, then a line starts `- On a prior-Session error:` and contains `still commit`
  - R19-04: Given the same file, when read, then a line starts `- Stage:` and contains `by path`, and a line starts `- Never:` and contains `git add -A`, `push`, and `--no-verify`
  - R19-05: Given the same file, when read, then a line starts `- On rejection:` (failure), and a line starts `- Messages:` and contains `conventional-commit`
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p01-s06.test.mjs`
- **Files:** edit `.github/skills/brain-storm/SKILL.md`
- **Patterns:** `.github/skills/brain-storm/SKILL.md - the ### Check section whose list style to follow`
- **Decisions:**
  - Insert this block, verbatim, directly after the last bullet of `### Check` and before the paragraph that begins `Finish with a brief`:

    ```
    ### Commit

    After the Check, commit what you wrote.

    - Commit: the Session file and, when changed, `.workflow/language.md`, in one commit `docs(workflow): session <topic>`, without asking. A `draft` Session from an early exit is committed the same way.
    - On a prior-Session error: still commit your own Session and Glossary, then report the error.
    - Stage: only the files you wrote, by path; other changes stay unstaged and unchanged.
    - Never: `git add -A`, push, or `--no-verify`.
    - On rejection: fix the cause if it lies in your own message or files and retry; otherwise stop and show the rejection output, leaving the files on disk.
    - Messages: follow the `conventional-commit` skill's Message Rules with type `docs`.
    ```
- **Do not:** edit `C/tests/**`; edit any other file or line; remove or reword the `### Check` text.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R19-01 to R19-05; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S07 - behavior-spec commits its output

- **Kind:** build
- **Goal:** `behavior-spec` commits every spec file it wrote in one commit, and commits nothing when it stops or redirects.
- **Depends on:** S03
- **Tier:** delegate - pinned section insertion into one file
- **Review:** required - test literal in product code
- **Scenarios:**
  - R19-06: Given `.github/skills/behavior-spec/SKILL.md`, when read, then a `## Commit` heading precedes `## Exit`, and a line starts `- Commit:` and contains `docs(<slug>): specify behavior` and `without asking`
  - R19-07: Given the same file, when read, then a line starts `- Stop or redirect:` and contains `commit nothing` (failure)
  - R19-08: Given the same file, when read, then a line starts `- Stage:` and contains `by path`, a line starts `- Never:` and contains `git add -A`, `push`, and `--no-verify`, a line starts `- On rejection:`, and a line starts `- Messages:` and contains `conventional-commit`
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p01-s07.test.mjs`
- **Files:** edit `.github/skills/behavior-spec/SKILL.md`
- **Patterns:** `.github/skills/behavior-spec/SKILL.md - the ## Exit section`
- **Decisions:** insert this block, verbatim, directly before the `## Exit` heading:

  ```
  ## Commit

  - Commit: every spec file you wrote or updated, in one commit `docs(<slug>): specify behavior`, without asking.
  - Stop or redirect: write and commit nothing.
  - Stage: only the files you wrote, by path; other changes stay unstaged and unchanged.
  - Never: `git add -A`, push, or `--no-verify`.
  - On rejection: fix the cause if it lies in your own message or files and retry; otherwise stop and show the rejection output, leaving the files on disk.
  - Messages: follow the `conventional-commit` skill's Message Rules with type `docs` and the artifact slug as scope.
  ```
- **Do not:** edit `C/tests/**`; edit any other file or line.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R19-06, R19-07, R19-08; each target test reports `ok`
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.
