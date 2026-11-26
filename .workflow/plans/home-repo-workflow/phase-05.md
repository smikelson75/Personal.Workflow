# P05 - Authoring skills, Coordination Playbook, README

- **Outcome:** a Developer can run `/agents-md` to write a Project Repo's `AGENTS.md` with its `Stack:` line (refused in the Home Repo), run `/addon-author` in a `Personal.Workflow` source to add a Language Add-on the Update Script and Launch Script pick up unedited, follow the Coordination Playbook for needs-first ordering across Project Repos, and set up and use both layouts from `README.md` alone.
- **Covers:** R44, R45, R46, R47, Q-offline (partial: the new scripts and documents need no network)
- **Invariants:**
  - Workflow Core source stays under `.github/`; the Update Script install map is unchanged (new skill folders and `references/` files install by the existing `.github/skills` -> `.claude/skills` rule; `language-addons/<id>/` installs by the existing rule).
  - Every new skill file starts with frontmatter `name`, quoted `description`, `argument-hint`, `user-invocable: true`, then a `# <Title>` line, then the line `Question rules: follow \`.github/user-interaction.md\`.`, then directly after it the exact `Core paths:` line that `.github/skills/pull-work/SKILL.md` carries (copy it byte for byte).
  - `AGENTS.md` may be named only by `.github/skills/agents-md/` and `.github/skills/onboard-project/` (workflow-core R22); `addon-author`, every other skill, every agent, and every hook and tool never name it.
  - Prose under `.github/skills/` uses Glossary terms (`.workflow/language.md`) and none of the phrases its `Avoid:` lists forbid (checked by `[R32-01]`).
  - Helper scripts are zero-dependency Node ES modules (`.mjs`), print to stdout/stderr only as pinned, run from the Project Repo root (`agents-md`) or the source root (`addon-author`), never use the network.
  - Test fixtures are temp folders only; the real Update Script and Launch Script run only against temp Home Repos.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" "tests/home-repo-workflow/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R44-01]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Not expressible:**
  - `/agents-md` and `/addon-author` running live in a Harness (reading the Session Chain, asking the Developer, committing `AGENTS.md`, the full `src/App.csproj` -> `Stack: csharp` -> `launch claude` flow) - needs a real Harness; tests cover the helper scripts directly and the skill text through stable markers; the main session live-probes both skills at Review and records the result in the plan's Current state.
  - R47's "the direct Claude Code command gives a session matching `launch claude`" - needs a real Claude Code session; tests cover the command text; the main session live-probes it at Review.
- **Gate:**
  - suite: `node --test --test-reporter=tap --test-skip-pattern="<node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/home-repo-workflow/phase-05.md --skip-pattern output>" "tests/home-repo-workflow/*.test.mjs" "tests/glossary-alignment/*.test.mjs" "tests/acceptance/*.test.mjs" "tests/mutation-addon.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node --test --test-reporter=tap "tests/home-repo-workflow/*.test.mjs" "tests/glossary-alignment/*.test.mjs" "tests/acceptance/*.test.mjs" "tests/mutation-addon.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs" > <tap-file>; then node .github/tools/workflow-core/scripts/trace.mjs --tap <tap-file> --phase-file .workflow/plans/home-repo-workflow/phase-05.md R44-01 R44-02 R44-03 R44-04 R44-05 R44-06 R44-07 R44-08 R44-09 R42-07 R45-01 R45-02 R45-03 R45-04 R45-05 R45-06 R45-07 R45-08 R45-09 R45-10 R42-08 R46-01 R46-02 R46-03 R46-04 R47-01 R47-02 R47-03 R47-04 R47-05 R47-06`
  - lock: `git diff --exit-code <Tests locked> -- tests/home-repo-workflow`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - `stack-check` helper proposes stacks and refuses the Home Repo

- **Kind:** build
- **Goal:** `node .github/skills/agents-md/scripts/stack-check.mjs`, run from a Project Repo root, prints the mode, proposed stack IDs, current `Stack:` value, and whether a competing instruction file exists; in the Home Repo it refuses.
- **Depends on:** none
- **Tier:** delegate - one small read-only script mirroring `glossary-check.mjs`
- **Review:** required - spawns a git process and decides a refusal for a destructive skill
- **Scenarios:** fixture: a temp git repo as the Project Repo (the script runs with it as cwd); the Home Repo fixture is a temp git repo holding `.git/personal-workflow/manifest.json`
  - R44-01: Given a Project Repo whose only manifest is `src/App.csproj` and with no `AGENTS.md`, when the script runs, then stdout is one JSON line `{"mode":"bootstrap","stacks":["csharp"],"stackLine":null,"competing":false}` and exit is 0
  - R44-02: Given `package.json` and `tsconfig.json` at the root, when the script runs, then `stacks` is `["node-typescript"]`
  - R44-03: Given `package.json` at the root and no `tsconfig.json`, when the script runs, then `stacks` is `["node-javascript"]`
  - R44-04: Given a Project Repo with no manifest anywhere, when the script runs, then `stacks` is `[]` and exit is 0 (the skill then asks the Developer)
  - R44-05: Given the cwd is a Home Repo (git path `personal-workflow/manifest.json` exists), when the script runs, then exit is 2, stderr is `the Home Repo's AGENTS.md holds only Project Pointers`, stdout is empty, and no file is created or changed (failure)
  - R44-06: Given `AGENTS.md` containing `- Stack: csharp` and also `.github/copilot-instructions.md`, when the script runs, then `mode` is `amendment`, `stackLine` is `csharp`, `competing` is `true`
- **Acceptance tests:** (written at Phase Review)
- **Files:** create `.github/skills/agents-md/scripts/stack-check.mjs`
- **Patterns:** `.github/skills/pull-work/scripts/glossary-check.mjs:1 - header comment, exit codes, stderr message; scripts/update-home.mjs:11 - the Stack line pattern`
- **Decisions:**
  - Output: `JSON.stringify({ mode, stacks, stackLine, competing })` plus newline, exit 0. `mode` is `amendment` when `./AGENTS.md` exists, else `bootstrap`.
  - `stackLine`: the trimmed text after `Stack:` of the first line of `AGENTS.md` matching `/^\s*(?:[-*]\s+)?stack:(.*)$/i`, else `null`.
  - `competing`: `true` when both `./AGENTS.md` and `./.github/copilot-instructions.md` exist, else `false`.
  - `stacks`, in this order and without duplicates: `csharp` when any `*.csproj` or `*.sln` exists within 4 folder levels below the cwd (skip folders `node_modules`, `.git`, `bin`, `obj`); then `node-typescript` when `./package.json` and `./tsconfig.json` exist; else `node-javascript` when only `./package.json` exists.
  - Home Repo test, before anything else: run `git rev-parse --git-path personal-workflow` (execFileSync, cwd = process.cwd(), errors ignored); the cwd is a Home Repo when `<that path resolved against the cwd>/manifest.json` exists.
  - The script writes no file.
- **Do not:** edit `tests/home-repo-workflow/**`; add dependencies; read `.workflow/`; write any file.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R44-01, R44-02, R44-03, R44-04, R44-05, R44-06; 6 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S02 - `agents-md` skill

- **Kind:** build
- **Goal:** the skill tells an agent to write or amend a Project Repo's root `AGENTS.md` from the Glossary, Session Chain, Behavior Specs, and repository manifests, always with one `Stack:` line, and to stop in the Home Repo.
- **Depends on:** S01
- **Tier:** main - adapts judgment-heavy guidance from the Developer's external `agent-instructions` skill (not in this repository)
- **Review:** required - no mutation gate
- **Scenarios:**
  - R44-07: Given `.github/skills/agents-md/SKILL.md`, when read, then its frontmatter `name` is `agents-md` and it names bootstrap and amendment modes, reads `.workflow/language.md`, `.workflow/sessions/`, and `.workflow/specs/`, redirects unsettled product matters to `brain-storm` and unsettled behavior to `behavior-spec`, and says amendment preserves unchanged content and replaces stale guidance
  - R44-08: Given the same file, when read, then it runs `node .github/skills/agents-md/scripts/stack-check.mjs`, says to write exactly one `Stack:` line (`Stack: <id>[, <id>...]`, kebab-case IDs), proposes IDs from the script's `stacks`, asks the Developer when `stacks` is empty and accepts any kebab-case ID, and changes an existing `Stack:` line only with the Developer's agreement
  - R44-09: Given the same file, when read, then it stops with `the Home Repo's AGENTS.md holds only Project Pointers` when the script exits 2, asks which file is canonical when `competing` is true, writes no file but `AGENTS.md`, and commits only `AGENTS.md` with a Conventional Commit of type `docs` (`git add AGENTS.md`)
  - R42-07: Given the same file, when read, then it has the `Question rules:` line directly followed by exactly one `Core paths:` line identical to the one in `.github/skills/pull-work/SKILL.md`, and every `.github/` path it writes exists
- **Acceptance tests:** (written at Phase Review)
- **Files:** create `.github/skills/agents-md/SKILL.md`; create `.github/skills/agents-md/references/AGENTS-FORMAT.md`
- **Patterns:** `.github/skills/adr-writer/SKILL.md:1 - frontmatter, Question rules and Core paths lines, section style`
- **Decisions:**
  - Sections of `SKILL.md`: Purpose, Mode, Source Order (existing `AGENTS.md`; `.workflow/language.md`; Session Chain in `.workflow/sessions/`; Behavior Specs in `.workflow/specs/`; manifests, formatter and lint config, CI workflows, representative source), Stack Line, Workflow, Required Boundaries, Content Rules, Exit.
  - `AGENTS-FORMAT.md` holds the section skeleton of an `AGENTS.md` (code style, architecture boundaries, build/test/lint commands, conventions that differ from defaults, links) and the exclusions (status, phases, one-off instructions).
  - The skill does not read `.workflow/CONTEXT.md`, a PRD, or `prd-writer`.
- **Do not:** edit the other skills; add `agents-md` to any test allow-list.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs" "tests/glossary-alignment/*.test.mjs"` exits 0; targets R44-07, R44-08, R44-09, R42-07; 4 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S03 - `scaffold` helper writes a Language Add-on

- **Kind:** build
- **Goal:** `node .github/skills/addon-author/scripts/scaffold.mjs`, run from a `Personal.Workflow` source root, writes `language-addons/<id>/` and the stack's README table, so the Update Script installs it and the Launch Script loads it unedited.
- **Depends on:** none
- **Tier:** delegate - deterministic file generation, every format pinned below
- **Review:** required - writes files and edits `language-addons/README.md`; shared structure for add-ons
- **Scenarios:** fixture: a temp copy of the source folders `.github/`, `language-addons/`, `home/`, `scripts/` (the script runs there as cwd)
  - R45-01: Given `--id sql-schema --code-style "sqlfluff|sqlfluff lint ."`, when the script runs, then exit is 0, `language-addons/sql-schema/sqlfluff-sql-schema/SKILL.md` exists with frontmatter `name: sqlfluff-sql-schema` and a line starting `Gate:` containing `sqlfluff lint .`, and no other skill folder exists under `language-addons/sql-schema/`
  - R45-02: Given the same run, when `language-addons/README.md` is read, then under `## Available Stacks` a heading `### sql-schema (\`language-addons/sql-schema/\`)` is followed by a table with a skill row linking `./sql-schema/sqlfluff-sql-schema/SKILL.md` and two rows `test harness` and `mutation testing`, each reading `not applicable: not used by this stack`
  - R45-03: Given `--id fake-stack --code-style "lintx|lintx ." --test-harness "testx|testx run" --mutation "mutx|mutx run --since <phase-base>"`, when the script runs, then three skill folders exist, the mutation `SKILL.md` has the lines `- **Mutation stack:** fake-stack` and `- **Mutation command:** mutx run --since <phase-base>` and a link to `../mutation-testing/protocol.md`, and `node .github/skills/work-planner/scripts/mutation-addon.mjs fake-stack` run after copying `language-addons/fake-stack/*` into `.github/skills/` of the temp copy reports that command
  - R45-04: Given `--id sql-schema --code-style "sqlfluff|sqlfluff lint ."` in the temp source, when `node scripts/update-home.mjs <empty temp Home git repo>` runs and then `node <home>/launch.mjs claude` runs with a stub `claude` on PATH in a temp Project Repo whose `AGENTS.md` has `- Stack: sql-schema`, then output includes `Language Add-on: sql-schema (sqlfluff-sql-schema)`
  - R45-05: Given a cwd that has no `.github/skills/pull-work/SKILL.md` or no `language-addons/README.md`, when the script runs, then exit is 1, stdout is `addon-author failed: not-a-workflow-source: run it in a Personal.Workflow source (Workflow Core plus language-addons/)`, and nothing is written (failure)
  - R45-06: Given `language-addons/csharp/` exists, when the script runs with `--id csharp --code-style "x|y"`, then exit is 1, stdout is `addon-author failed: addon-exists: language-addons/csharp/`, and no file changes (failure)
  - R45-07: Given `--id Sql_Schema`, when the script runs, then exit is 2, stdout is `addon-author failed: invalid-id: Sql_Schema is not kebab-case`, and nothing is written (failure)
  - R45-08: Given `--id sql-schema` with no role flag, when the script runs, then exit is 2, stdout is `addon-author failed: no-roles: give at least one of --code-style, --test-harness, --mutation`, and nothing is written (failure)
  - R45-09: Given `--id sql-schema --code-style "sqlfluff|sqlfluff lint ."`, when the script finishes, then `git status --porcelain` in the temp copy lists only `language-addons/README.md` and `language-addons/sql-schema/`, and every README line outside the new `### sql-schema` section is unchanged
- **Acceptance tests:** (written at Phase Review)
- **Files:** create `.github/skills/addon-author/scripts/scaffold.mjs`
- **Patterns:** `.github/skills/work-planner/scripts/mutation-addon.mjs:1 - argument parsing and exit codes; language-addons/node-javascript/stryker-javascript/SKILL.md:1 - add-on skill shape and the Mutation lines; language-addons/README.md:11 - the Available Stacks tables`
- **Decisions:**
  - CLI: `--id <id>` plus any of `--code-style "<tool>|<command>"`, `--test-harness "<tool>|<command>"`, `--mutation "<tool>|<command>"`, and repeatable `--na "<role>=<reason>"` (roles `code-style`, `test-harness`, `mutation`). A skipped role's reason is its `--na` value, else `not used by this stack`. Split each role value at its first `|`.
  - Check order, each failure printing its one stdout line and changing nothing: id kebab-case (`/^[a-z0-9]+(-[a-z0-9]+)*$/`) -> `invalid-id` exit 2; source markers (`.github/skills/pull-work/SKILL.md`, `language-addons/README.md`) -> `not-a-workflow-source` exit 1; `language-addons/<id>/` exists -> `addon-exists` exit 1; at least one role -> `no-roles` exit 2.
  - Skill folder name `<tool>-<id>` where `<tool>` is lower-cased with non-alphanumerics replaced by `-`. Success prints one line `addon-author: wrote language-addons/<id>/ (<folder>, ...)` and exits 0.
  - `SKILL.md` text for every role: frontmatter `name: <folder>`, `description: "<Role label> for <id> using <tool>."`, `argument-hint: "Say 'run' to apply it"`, `user-invocable: true`; `# <tool> for <id>`; a paragraph naming the role and tool; a line `Command: \`<command>\``; and `Gate: <instruction>` where code-style is `add \`<command>\` in front of the test command in the phase Gate suite line`, test-harness is `the phase Gate suite line is \`<command>\``, mutation is `the phase Gate mutation line is \`<command>\``.
  - Mutation `SKILL.md` additionally: `This is the <id> adapter for [mutation-testing/protocol.md](../mutation-testing/protocol.md).`, then `- **Mutation stack:** <id>` and `- **Mutation command:** <command>` as lines of their own.
  - README edit: insert, before the first `## ` heading after `## Available Stacks` (or at end of file), a blank line, `### <id> (\`language-addons/<id>/\`)`, a blank line, the header `| Skill | Purpose | Key Outputs in Target Repo |` with its `| --- | --- | --- |` row, one row per present role `| [<folder>](./<id>/<folder>/SKILL.md) | <role label> with <tool>: \`<command>\`. | Gate <suite|mutation> line |`, one row per skipped role `| <role label> | not applicable: <reason> | none |`. Role labels: `code style`, `test harness`, `mutation testing`. Keep CRLF if the file uses it.
  - Writes only `language-addons/<id>/**` and `language-addons/README.md`.
- **Do not:** edit `tests/home-repo-workflow/**`; add dependencies; name `AGENTS.md`; touch any other file; use the network.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R45-01 through R45-09; 9 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S04 - `addon-author` skill

- **Kind:** build
- **Goal:** the skill tells an agent to ask the Developer only for the stack ID, the roles, and each role's tool and command, then run `scaffold.mjs`.
- **Depends on:** S03
- **Tier:** delegate - mirrors the S02 skill's shape
- **Review:** none
- **Scenarios:**
  - R45-10: Given `.github/skills/addon-author/SKILL.md`, when read, then its frontmatter `name` is `addon-author`, it runs `node .github/skills/addon-author/scripts/scaffold.mjs`, asks only for the stack ID, the roles (code style, test harness, mutation testing), and each role's tool and command, says non-code stacks may skip roles but at least one is required, asks again when the ID is not kebab-case, stops and says where to run it when `not-a-workflow-source`, stops naming the folder when `addon-exists`, and says it writes only under `language-addons/<id>/` and the `Available Stacks` section of `language-addons/README.md`
  - R42-08: Given the same file, when read, then it has the `Question rules:` line directly followed by exactly one `Core paths:` line identical to the one in `.github/skills/pull-work/SKILL.md`, and it does not contain `AGENTS.md`
- **Acceptance tests:** (written at Phase Review)
- **Files:** create `.github/skills/addon-author/SKILL.md`
- **Patterns:** `.github/skills/adr-writer/SKILL.md:1 - frontmatter, Question rules and Core paths lines`
- **Decisions:** sections Purpose, Where It Runs, Questions (one grouped question for ID and roles, then one per role for tool and command, following `.github/user-interaction.md`), Run, Failure outcomes (the four `addon-author failed:` categories and what to tell the Developer), Exit (brief: files written, README rows; tells the Developer to run the Update Script and then `launch` in a repo with `Stack: <id>`). Frontmatter `argument-hint`: `Name the stack ID, or say what stack you want an add-on for`.
- **Do not:** edit `tests/home-repo-workflow/**`; name `AGENTS.md`; edit any other file.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs" "tests/glossary-alignment/*.test.mjs"` exits 0; targets R45-10, R42-08; 2 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S05 - Coordination Playbook

- **Kind:** build
- **Goal:** one Workflow Core document orders a change across an API Project Repo and a database Project Repo using only existing skills, and says what each Project Pointer role means for that ordering.
- **Depends on:** none
- **Tier:** delegate - one prose file whose outline is pinned
- **Review:** none
- **Scenarios:**
  - R46-01: Given `.github/skills/onboard-project/references/COORDINATION-PLAYBOOK.md`, when read, then it has three numbered steps in this order: (1) in the API Project Repo run `brain-storm` then `behavior-spec` for the API need (limits, required fields, relationships); (2) in the database Project Repo run `brain-storm` from the API Behavior Spec path and make a read-only check of `peer-impact` Project Repos for shared or cross-schema tables, with no edits and no commits in peer repos; (3) run `work-planner` and `pull-work` separately in each Project Repo, each launched there with the Launch Script, and the database Phase that delivers the needed schema completes before the API Phase that consumes it starts
  - R46-02: Given the same file, when read, then it names the roles `co-changed`, `read-only reference`, and `peer-impact` and says what each means for step 2 and for step 3
  - R46-03: Given the same file, when every backticked word matching a skill name is compared with the folders under `.github/skills/`, then each one it names (`brain-storm`, `behavior-spec`, `work-planner`, `pull-work`) exists, and it names no skill or command that is not a folder there, `launch`, or `workflow-check`
  - R46-04: Given the real source installed into a temp Home Repo by `node scripts/update-home.mjs <home>`, when `.claude/skills/onboard-project/references/` is listed, then `COORDINATION-PLAYBOOK.md` is there and equal to its source after `\r\n` -> `\n`, and `.github/skills/onboard-project/SKILL.md` links `./references/COORDINATION-PLAYBOOK.md`
- **Acceptance tests:** (written at Phase Review)
- **Files:** create `.github/skills/onboard-project/references/COORDINATION-PLAYBOOK.md`; edit `.github/skills/onboard-project/SKILL.md`
- **Patterns:** `.github/skills/onboard-project/SKILL.md:1 - tone and heading style; .github/skills/onboard-project/references/DISCOVERY-CHECKLIST.md:1 - a references file`
- **Decisions:**
  - Title `# Coordination Playbook`; one intro sentence defining Project Pointers (entries in the Home Repo's `AGENTS.md` naming a Project Repo and its role); `## Steps` with the three numbered steps of R46-01; `## Project Pointer Roles` with one bullet per role: `co-changed` (changes in step 3 run in both repos, ordered needs-first), `read-only reference` (read in step 2 for context, never planned or edited), `peer-impact` (checked read-only in step 2; a finding means a new Behavior Spec requirement in that repo's own flow before step 3 starts).
  - In `SKILL.md`, add one sentence in the section listing references, `For ordering changes across Project Repos see [references/COORDINATION-PLAYBOOK.md](./references/COORDINATION-PLAYBOOK.md).`, with no other line changed.
  - The playbook uses only Glossary terms and no `Avoid:` word from `.workflow/language.md`; it may name `AGENTS.md` (allowed under `onboard-project`).
- **Do not:** edit `tests/home-repo-workflow/**`; add any other file; name a skill that does not exist.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs" "tests/glossary-alignment/*.test.mjs"` exits 0; targets R46-01, R46-02, R46-03, R46-04; 4 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S06 - README documents both layouts

- **Kind:** build
- **Goal:** `README.md` documents Home Repo setup, the Update Script from a clone and from a zip, the Launch Script and `wf`, direct Harness commands with their warnings, the copy-into-repository path, and the new skills and Playbook.
- **Depends on:** S02, S04, S05
- **Tier:** main - the direct Harness commands need quoting and flags the main session probes live
- **Review:** required - no mutation gate
- **Scenarios:**
  - R47-01: Given `README.md`, when read, then a Home Repo section tells the Developer to create a git repo, commit an `AGENTS.md` with Project Pointers and a one-line `CLAUDE.md` containing `@AGENTS.md`, then run `node scripts/update-home.mjs <home>`
  - R47-02: Given the same file, when read, then the Update Script is shown run from a clone (`git clone`) and from a downloaded zip (`Expand-Archive`), each with the command that names the Home Repo path
  - R47-03: Given the same file, when read, then the Launch Script is shown by full path (`<home>\launch claude`), as `launch version`, and a per-machine `wf` PowerShell function that forwards all arguments to the Launch Script by path
  - R47-04: Given the same file, when read, then equivalent direct commands for Claude Code (`claude --add-dir`) and Copilot CLI (`copilot --add-dir`) are shown, with a warning that Claude Code started without the Home Repo settings option (`--settings`) is unguarded and that Copilot CLI needs a trusted folder
  - R47-05: Given the same file, when read, then it keeps the copy-into-repository section, including the `.claude\skills` and `.claude\agents` copies and the trusted-folder sentence
  - R47-06: Given the same file, when read, then it links `.github/skills/onboard-project/references/COORDINATION-PLAYBOOK.md`, names `/agents-md` and `/addon-author`, and states that a `Stack:` line in `AGENTS.md` selects the Language Add-on
- **Acceptance tests:** (written at Phase Review)
- **Files:** edit `README.md`
- **Patterns:** `README.md:34 - the copy block and its prose; README.md:93 - the Core Skills list`
- **Decisions:**
  - New `## Home Repo (Recommended)` section placed before `## Quick Start`; the copy path stays as Quick Start step 2, retitled `Copy the Workflow Core into Your Repository (Alternative)`.
  - The direct-command forms are the ones the main session confirms by live probe (`--add-dir <home>`, `--settings` carrying the guard hook for Claude Code); if a flag cannot be confirmed, the README says so and the card records the gap under Outcome.
  - Add `agents-md` to Core Skills and `addon-author` to a new sentence in Language Add-on Skills; where the README shows a Node test command for `/pull-work` Harness lines, it uses a glob (`node --test "tests/**/*.test.js"`) because `node --test tests/` fails on Node 25; no other README sections change.
- **Do not:** edit `tests/home-repo-workflow/**`; edit any file but `README.md`.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs" "tests/glossary-alignment/*.test.mjs"` exits 0; targets R47-01 through R47-06; 6 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; a direct command cannot be confirmed live.
