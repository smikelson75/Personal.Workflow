# P04 - Workflow Core parity across layouts and Harnesses

- **Outcome:** in the Home layout every skill and agent finds the Workflow Core files it reads or runs (through `WORKFLOW_HOME`, set by the Launch Script) and operates on the Project Repo only; in both Harnesses and both layouts `coder`, `planner`, `repo-scout`, `test-author`, `test-reviewer`, and `code-review` can be dispatched by name with the same instructions.
- **Covers:** R42, R43
- **Invariants:**
  - Workflow Core source stays under `.github/`. The Update Script (P02) install map is unchanged: `.github/skills/` -> `.claude/skills/`, `.github/agents/*.agent.md` -> `.claude/agents/`, `.github/hooks/` -> `.workflow-core/hooks/`, `.github/tools/` -> `.workflow-core/tools/`, `.github/user-interaction.md` -> `.workflow-core/user-interaction.md`.
  - Core path rule (the one line each skill and the planner agent carries, S02): in the Home layout (environment variable `WORKFLOW_HOME` is set) a Workflow Core path written as `.github/<x>` means `$WORKFLOW_HOME/<mapped x>` by the install map above; commands always run from the Project Repo root, never from `$WORKFLOW_HOME`. In the copy layout the path is read as written.
  - Agent files keep one body and one frontmatter for both Harnesses. Claude Code refuses an agent whose `tools` resolve to nothing and only knows case-sensitive names; Copilot CLI accepts Claude Code names beside its own (live-probed, both Harnesses, `repo-scout` with `['Read','Grep','Glob','Bash','read','search','execute']`: dispatch worked and ran a shell in both). Unknown frontmatter keys (`model` lists, `reasoning-effort`, `user-invocable`) are ignored by Claude Code.
  - Test fixtures are temp folders only; no network; the real Update Script is run with `node scripts/update-home.mjs <empty git repo>`.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" "tests/home-repo-workflow/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R42-01]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Known failures:**
  - `[R22-03] no file under skills, agents, or hooks names AGENTS.md` - owner P05
  - `[R29-01] Glossary defines all 28 canonical terms with Slice and Card separate` - owner P05
  - `[R30-03] prior Session files in .workflow/sessions/ remain untouched` - owner P05
- **Not expressible:**
  - A real Claude Code or Copilot CLI session dispatching each agent by name, `code-review` running in Claude Code, Copilot CLI finding `.claude/agents` under `--add-dir`, `WORKFLOW_HOME` reaching the Harness's shell tool, and `/pull-work` completing a Card in the Home layout - needs the real Harnesses; the main session live-probes them at Review and records the result in the plan's Current state. Tests cover the env value, the rule text, the path mapping, the installed files, and the helpers run directly.
- **Gate:**
  - suite: `node --test --test-reporter=tap --test-skip-pattern="<node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/home-repo-workflow/phase-04.md --skip-pattern output>" "tests/home-repo-workflow/*.test.mjs" "tests/glossary-alignment/*.test.mjs" "tests/acceptance/*.test.mjs" "tests/mutation-addon.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node --test --test-reporter=tap "tests/home-repo-workflow/*.test.mjs" "tests/glossary-alignment/*.test.mjs" "tests/acceptance/*.test.mjs" "tests/mutation-addon.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs" > <tap-file>; then node .github/tools/workflow-core/scripts/trace.mjs --tap <tap-file> --phase-file .workflow/plans/home-repo-workflow/phase-04.md R42-01 R42-02 R42-03 R42-04 R42-05 R42-06 R43-01 R43-02 R43-03 R43-04 R43-05`
  - lock: `git diff --exit-code <Tests locked> -- tests/home-repo-workflow`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - Launch Script exports `WORKFLOW_HOME`

- **Kind:** build
- **Goal:** the Harness started by `launch claude|copilot` has the environment variable `WORKFLOW_HOME` set to the Home Repo's real path.
- **Depends on:** none
- **Tier:** delegate - one environment option on the two existing `spawn` calls
- **Review:** none
- **Scenarios:** fixture: the P03 Home fixture, both Harness stubs; the stub also records `process.env.WORKFLOW_HOME` as `home` in its JSON
  - R42-01: Given `claude` and then `copilot` on PATH, when `node <home>/launch.mjs <harness>` runs in a Project folder, then the stub's recorded `home` equals the Home Repo's real path (`realpathSync.native`)
  - R42-02: Given the caller's environment already has `WORKFLOW_HOME=C:\elsewhere`, when `launch claude` runs, then the stub's recorded `home` is the Home Repo's real path (the Launch Script's value wins) (failure)
- **Acceptance tests:** `tests/home-repo-workflow/p04-s01.test.mjs`
- **Files:** edit `home/launch.mjs`
- **Patterns:** `home/launch.mjs:185 - startHarness spawns through cmd.exe for .cmd/.bat and directly otherwise; both calls need the option`
- **Decisions:**
  - Both `spawn` calls in `startHarness` get `env: { ...process.env, WORKFLOW_HOME: home }`, where `home` is the existing module constant (the real path of the folder holding `launch.mjs`).
  - Nothing else changes: argv, output lines, failure categories, cwd, and exit code stay as P03 locked them.
- **Do not:** edit `tests/home-repo-workflow/**`; write any file; add dependencies; import network modules.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R42-01, R42-02; 2 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S02 - Core path rule in every skill and the planner agent

- **Kind:** build
- **Goal:** each skill that names a Workflow Core path, and the `planner` agent, carry the Core path rule so a Home-layout session resolves those paths.
- **Depends on:** none
- **Tier:** delegate - the same one-line insertion in 8 files
- **Review:** none
- **Scenarios:**
  - R42-03: Given the seven skills `adr-writer`, `behavior-spec`, `brain-storm`, `conventional-commit`, `incubate`, `pull-work`, `work-planner` and the agent `planner`, when each file is read, then it has exactly one line starting `Core paths:` that contains `WORKFLOW_HOME`, the five mappings (`.github/skills/` `.claude/skills/`, `.github/agents/` `.claude/agents/`, `.github/tools/` `.workflow-core/tools/`, `.github/hooks/` `.workflow-core/hooks/`, `.github/user-interaction.md` `.workflow-core/user-interaction.md`), and the words `Project Repo root`; and that line directly follows the file's `Question rules:` line
- **Acceptance tests:** `tests/home-repo-workflow/p04-s02.test.mjs`
- **Files:** edit `.github/skills/adr-writer/SKILL.md`; edit `.github/skills/behavior-spec/SKILL.md`; edit `.github/skills/brain-storm/SKILL.md`; edit `.github/skills/conventional-commit/SKILL.md`; edit `.github/skills/incubate/SKILL.md`; edit `.github/skills/pull-work/SKILL.md`; edit `.github/skills/work-planner/SKILL.md`; edit `.github/agents/planner.agent.md`
- **Patterns:** `.github/skills/pull-work/SKILL.md:10 - the Question rules: line the new line follows`
- **Decisions:**
  - Insert this exact line directly after each file's `Question rules:` line (no blank line between, so it is the next line):
    `Core paths: when the environment variable WORKFLOW_HOME is set (Home layout), read each Workflow Core path written here as follows: .github/skills/ is $WORKFLOW_HOME/.claude/skills/, .github/agents/ is $WORKFLOW_HOME/.claude/agents/, .github/tools/ is $WORKFLOW_HOME/.workflow-core/tools/, .github/hooks/ is $WORKFLOW_HOME/.workflow-core/hooks/, .github/user-interaction.md is $WORKFLOW_HOME/.workflow-core/user-interaction.md; run every command from the Project Repo root and never from $WORKFLOW_HOME. Without WORKFLOW_HOME (copy layout) read the paths as written.`
  - `onboard-project` is not edited: it names no Workflow Core path (its only `.github/` mention is the Project's `copilot-instructions.md`).
  - No other line of any file changes.
- **Do not:** edit `tests/**`; edit any file outside Files; reword existing lines; name `AGENTS.md`.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R42-03; 1 target test runs
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S03 - Home layout resolves every Core path and leaves the Home Repo alone

- **Kind:** verify
- **Goal:** with the real source installed as a Home Repo, every Workflow Core path a skill or agent names exists where the Core path rule points, and the helpers run from there operate on the Project Repo only.
- **Depends on:** S02
- **Tier:** main - no product change; runs the verification and, on a failure, hands the finding to Triage
- **Review:** none
- **Scenarios:** fixture: a temp empty git repo as Home Repo, filled by `node scripts/update-home.mjs <home>`; a temp Project Repo with `.workflow/language.md` (a valid Glossary) and a committed plan
  - R42-04: Given the installed Home Repo, when each Workflow Core path written in a skill or agent (a `.github/` path ending in a file extension under `skills/`, `agents/`, `tools/`, `hooks/`, or `.github/user-interaction.md`; placeholders in `<...>` excluded) is mapped by the Core path rule, then the file exists under the Home Repo
  - R42-05: Given the Project Repo as working folder, when `node <home>/.claude/skills/pull-work/scripts/glossary-check.mjs`, `node <home>/.claude/skills/pull-work/scripts/reconcile-check.mjs candidates`, and `node <home>/.workflow-core/tools/workflow-check/bin/workflow-check.mjs` run, then each result concerns the Project Repo's `.workflow/` (a Finding path is under the Project's `.workflow/`), and `git status --porcelain` is empty in the Home Repo and unchanged in the Project Repo
- **Acceptance tests:** `tests/home-repo-workflow/p04-s03.test.mjs`
- **Files:** none
- **Patterns:** `tests/home-repo-workflow/p02-s01.test.mjs:1 - running the real Update Script into a temp Home`
- **Decisions:** expected to pass on existing code once S02 is complete; a failure sets the slice `blocked` and Revise adds a `fix` card.
- **Do not:** edit `tests/home-repo-workflow/**`.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R42-04, R42-05; 2 target tests run
- **Stop and report if:** a locked test looks wrong; the same failure after 3 attempts.

## S04 - Agents dispatchable by name in both Harnesses; `code-review` agent

- **Kind:** build
- **Goal:** the five agent files list tool names both Harnesses accept, a Workflow Core `code-review` agent exists for Claude Code, and the Update Script installs all six into the Home Repo's `.claude/agents/`.
- **Depends on:** none
- **Tier:** delegate - frontmatter edits plus one new agent file copying an existing one's shape
- **Review:** none
- **Scenarios:**
  - R43-01: Given `coder`, `planner`, `repo-scout`, `test-author`, `test-reviewer`, and `code-review` in `.github/agents/<name>.agent.md`, when their frontmatter is read, then `name` equals the file name stem and `tools` contains, for each Copilot name the agent lists (`read`, `search`, `edit`, `execute`, `agent`, `todo`) kept as before, the Claude Code names mapped from it (`read`->`Read`; `search`->`Grep`,`Glob`; `edit`->`Edit`,`Write`; `execute`->`Bash`; `agent`->`Agent`; `todo`->`TodoWrite`)
  - R43-02: Given `.github/agents/code-review.agent.md`, when read, then its `tools` has no `edit`, `Edit`, or `Write` entry, and its body names the four finding classes (bugs, security and trust-boundary flaws, resource or data loss, shared structures later cards will misuse), says to report only high-confidence defects, and says to report `none` when there are none
  - R43-03: Given the real source installed into a temp Home Repo by `node scripts/update-home.mjs <home>`, when `.claude/agents/` is listed, then it holds exactly the six `<name>.agent.md` files, each equal to its source after `\r\n` -> `\n`
  - R43-04: Given `.github/agents/README.md`, when read, then its roster table has a `code-review` row linking `./code-review.agent.md`, and the text says Copilot CLI runs its built-in `code-review` in preference while Claude Code runs this file
- **Acceptance tests:** `tests/home-repo-workflow/p04-s04.test.mjs`
- **Files:** edit `.github/agents/coder.agent.md`; edit `.github/agents/planner.agent.md`; edit `.github/agents/repo-scout.agent.md`; edit `.github/agents/test-author.agent.md`; edit `.github/agents/test-reviewer.agent.md`; create `.github/agents/code-review.agent.md`; edit `.github/agents/README.md`
- **Patterns:** `.github/agents/test-reviewer.agent.md:1 - read-only agent: frontmatter, "Asks the Developer: never", numbered checks, Report list`
- **Decisions:**
  - Each existing agent's `tools:` line keeps its current items first and appends the mapped Claude names, no duplicates. Example for `coder`: `tools: ['read', 'search', 'edit', 'execute', 'Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash']`. `planner` also gets `Agent` and `TodoWrite`. The planner's `tools` keeps `read`, `search`, `edit`, `execute`, `agent`, `todo`.
  - `code-review.agent.md` frontmatter: `name: code-review`, `description: "Review the critical code of one Phase and return only high-confidence defects."`, `tools: ['read', 'search', 'execute', 'Read', 'Grep', 'Glob', 'Bash']`, `user-invocable: false`, the same `model:` list as `test-author` and `reasoning-effort: medium`.
  - `code-review.agent.md` body: starts `Asks the Developer: never - stop and report to the caller.`; says it receives a diff, the spec path, and each Card's `Decisions`; runs only `git diff`, `git show`, and reads files, never modifies a file; reports only high-confidence defects in four classes: bugs, security and trust-boundary flaws, resource or data loss, shared structures that later cards will misuse; skips style, naming, and preference; ends with a Report list: `findings` as `path:line - class - what is wrong and why`, or `none`.
  - README: add the roster row `code-review`, replace the sentence `Built-in \`code-review\` is also invoked ...` with one saying `pull-work` invokes `code-review` once per Phase after the Gate passes, only for Cards marked `Review: required`; Copilot CLI uses its built-in `code-review` in preference to this file, and Claude Code runs this file.
  - Do not touch any body text of the five existing agents.
- **Do not:** edit `tests/**`; touch the install map (`scripts/update-home.mjs`); add a `.claude/` folder to the source; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R43-01, R43-02, R43-03, R43-04; 4 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S05 - README copy steps give Claude Code the skills and agents

- **Kind:** build
- **Goal:** the README's copy-into-repository steps also place the skills and agents where Claude Code looks (`.claude\skills`, `.claude\agents`), so both Harnesses see them in the copy layout.
- **Depends on:** S04
- **Tier:** delegate - a few lines in one existing code block
- **Review:** none
- **Scenarios:**
  - R42-06: Given `README.md`, when the copy-into-repository PowerShell block is read, then it creates `.claude\skills` and copies the source skills (`.github\skills\*`) into it, and a prose line says Claude Code reads skills and agents only from `.claude\`
  - R43-05: Given the same block, when read, then it creates `.claude\agents` and copies `.github\agents\*.agent.md` into it, and the block still copies `.github\agents` and `.github\skills\*` into `.github\`
- **Acceptance tests:** `tests/home-repo-workflow/p04-s05.test.mjs`
- **Files:** edit `README.md`
- **Patterns:** `README.md:41 - New-Item and Copy-Item lines of the copy block`
- **Decisions:**
  - In the block, extend the `New-Item` line to `.github\tools, .github\skills, .claude\skills, .claude\agents` and add `Copy-Item -Recurse "$workflowSrc\.github\skills\*" ".claude\skills"` and `Copy-Item "$workflowSrc\.github\agents\*.agent.md" ".claude\agents"` after the existing `.github\` copies.
  - Add, directly after the block, one sentence: Claude Code reads skills and agents only from `.claude\`, Copilot CLI prefers `.github\agents` over `.claude\agents`, and the skills keep their `.github\` copy because the skills' helper commands name `.github\` paths.
  - No other README text changes; sections for P05 (stack, Update Script, Launch Script, Home setup) are untouched.
- **Do not:** edit `tests/**`; edit any file but `README.md`.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R42-06, R43-05; 2 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.
