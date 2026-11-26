# Behavior Spec - Home Repo Workflow

## Sources
- Sessions: `context-2026-11-25-1955.md` (builds on `context-2026-11-21-1859.md`), `context-2026-11-26-1201.md` (R48-R51)
- Background: `.workflow/incubations/home-repo-workflow.md` (probe results)
- Language: `.workflow/language.md`
- Companion specs: [workflow-core-spec.md](workflow-core-spec.md), [workflow-check-spec.md](workflow-check-spec.md), [glossary-alignment-spec.md](glossary-alignment-spec.md), [calc-repl-walkthroughs-spec.md](calc-repl-walkthroughs-spec.md)

## Target Outcome
- once v1 is done, each machine has one Home Repo filled by one Update Script run from a `Personal.Workflow` clone or zip. The Launch Script starts Claude Code or Copilot CLI in any Project Repo with Workflow Core, the locked-tests guard, and only that repository's Language Add-on, and prints one visible workflow version. Both Harnesses deny edits to locked Oracle paths in both layouts. New `AGENTS.md` and add-on authoring skills, the Coordination Playbook, and `README.md` cover setup, stacks, and cross-repo ordering. In the Home layout, each Workflow Core agent runs in Claude Code on the Claude family and effort pinned in its one agent file, while Copilot CLI keeps reading the same pins as written.

## Terms Used Here
- **Home layout**: Workflow Core attached from a Home Repo while the Harness runs in a Project Repo.
- **Copy layout**: Workflow Core copied into the Project Repo (the backup path).
- **Installed file**: a file a previous Update Script run wrote into the Home Repo. Only installed files are workflow-owned.
- **Workflow version**: a 7-character lowercase hex fingerprint of the content the Update Script installs (see R36).

## Requirements

### R35 - Both Harnesses guard locked paths in the copy layout
- Rules:
  - With Workflow Core copied into a Project Repo per `README.md`, Claude Code and Copilot CLI (in a trusted folder) both deny a file edit, create, or write to a path under a plan's `Oracle` that is tracked at its `Tests locked` reference.
  - Existing guard semantics are preserved: Phase Review (`Next: phase review ...`) allows all Oracle edits; Fixture Repair `S##` allows only that Card's `Acceptance tests` paths; plans without `Tests locked` or `Oracle` lock nothing; paths outside the Oracle, untracked at the lock reference, or outside the repository are allowed.
  - The repository whose plans are consulted is the one containing the edited file, regardless of the working folder the Harness reports.
  - A denied edit leaves the file byte-identical, and the Harness shows a reason naming the path, the plan slug, the `Tests locked` reference, and which mode may change it.
  - An internal guard error allows the edit (the Gate's lock verification is the backstop).
  - Shell commands that write files are not guarded.
- Failure: Copilot CLI in an untrusted folder skips repository hooks and the edit succeeds. This is the accepted risk; the Gate's lock verification catches it.
- Examples:
  - Given plan `calc` with `Tests locked: abc1234` and Oracle `tests/acceptance/`, and `tests/acceptance/add.test.mjs` tracked at `abc1234`, when Claude Code's `Edit` tool targets that file, then the edit is denied and the file is unchanged. (failure)
  - Given the same plan, when Copilot CLI in a trusted folder edits that file, then it is denied with the same reason. (failure)
  - Given the same plan, when either Harness edits `src/add.mjs`, then the edit is allowed.
  - Given `Next: fixture repair S03` and S03's `Acceptance tests` list only `tests/acceptance/s03.test.mjs`, when either Harness edits `tests/acceptance/s04.test.mjs`, then it is denied with "Fixture Repair S03 may change only its own Acceptance tests." (failure)

### R36 - Update Script fills a Home Repo offline
- Rules:
  - Run from a `Personal.Workflow` clone or an extracted zip with the Home Repo path as its one required argument. It installs Workflow Core in the discovery locations both Harnesses read, all Language Add-ons, the Launch Script, and the version record.
  - Mirror: every installed file is overwritten with the source content. Installed files the new version no longer ships are deleted. A file the Update Script did not install is never created, modified, or deleted, even inside the same folders.
  - Needs no network access, and never creates, modifies, or deletes `AGENTS.md`, `CLAUDE.md`, `.gitignore`, or any committed Home Repo file.
  - Workflow version: the first 7 lowercase hex characters of a fingerprint over the relative paths and line-ending-normalized content of every file it installs. The same source content gives the same version from a clone or a zip, and any change to shipped content gives a different version.
  - Re-running with the same source succeeds, prints the same old and new version, and reports 0 installed and 0 removed.
- Output on success (exit 0), in this order:
  - `Home Repo: <absolute path>`
  - `Workflow version: <old> -> <new>`, where `<old>` is `none` on first install
  - `Files: <n> installed, <n> replaced, <n> removed`
  - then any agent pin notices from R48 and R50, sorted by agent name
- Failure: one line `update failed: <category>: <detail>` and a non-zero exit. In every case except `copy-failed`, no file is changed.
  - `missing-home-path` - no argument; also prints the usage line.
  - `home-not-found` - the path does not exist or is not a folder.
  - `home-not-git` - the path is not the root of a git repository.
  - `home-is-source` - the path is the `Personal.Workflow` source, or is inside it.
  - `home-is-project` - the path's `AGENTS.md` has a `Stack:` line (it is a Project Repo).
  - `incomplete-source` - the source lacks Workflow Core or `language-addons/`.
  - `invalid-agent` - a Workflow Core agent file has no frontmatter or frontmatter that does not parse; names the file.
  - `tracked-workflow-files` - files at installed-file paths are committed in the Home Repo; lists them.
  - `copy-failed` - a write failed; names the path. The version record is marked incomplete, so the Launch Script refuses (R38) until a rerun succeeds.
- Examples:
  - Given an empty git repo `C:\work-home` with a committed `AGENTS.md`, when the Update Script runs against it, then output shows `Workflow version: none -> 3f9a2c1`, `AGENTS.md` is byte-identical, and exit is 0.
  - Given `C:\work-home` at `3f9a2c1`, where skill `old-skill` shipped then but not now, when the Update Script runs from a newer source, then `old-skill` is deleted, `Files:` reports it among removed, and `C:\work-home\.claude\skills\my-own\SKILL.md` (not installed) is untouched.
  - Given a clone and a zip of the same commit, when each is run against a separate Home Repo, then both print the same new version.
  - Given `C:\nope` does not exist, when the Update Script runs against it, then it prints `update failed: home-not-found: C:\nope` and nothing is written. (failure)
  - Given the path is `C:\Projects\Personal.Workflow`, when the Update Script runs, then it fails with `home-is-source` and nothing is written. (failure)

### R37 - Installed files stay out of Home Repo history
- Rules:
  - After any Update Script run, `git status --porcelain` in the Home Repo is identical to its output before the run.
  - Installed files are hidden from git without creating or modifying any committed or new tracked file; `.gitignore` is never created or changed.
  - Only Project Pointers in `AGENTS.md`, `CLAUDE.md`, and environment notes are meant to be committed; the Update Script does not commit.
- Failure: see `tracked-workflow-files` in R36.
- Examples:
  - Given a Home Repo with no `.gitignore` and a clean tree, when the Update Script runs, then `git status --porcelain` is empty and no `.gitignore` exists.

### R38 - Launch Script starts a Harness with the stack's add-on
- Rules:
  - Invoked as `<Launch Script> <harness> [harness arguments...]`, with `<harness>` being `claude` or `copilot` (case-insensitive), from the Project Repo folder. The Launch Script lives in the Home Repo and finds the Home Repo from its own location.
  - Starts the Harness in the current folder with Workflow Core from the Home Repo, the locked-tests guard active, and only the Language Add-ons named by the stack statement (R44). Other add-ons' skills are not listed in either Harness.
  - Any arguments after `<harness>` are passed to the Harness unchanged (for example `--continue`), and the Harness's exit code is returned.
  - Stack statement: in the current folder's `AGENTS.md`, the first line matching `Stack: <ids>` (an optional leading `- ` is allowed, key case-insensitive). `<ids>` is a comma-separated list of kebab-case stack IDs. A stack has an add-on when `language-addons/<id>/` was installed (today `csharp`, `node-javascript`, `node-typescript`).
  - Several stack IDs: every ID with an add-on loads; each ID without one gets the R39 warning for that ID.
  - Shared add-on references (for example `mutation-testing/protocol.md` for Stryker add-ons) resolve whenever an add-on that links them is loaded.
  - Guard in the Home layout: locked-path edits in the Project Repo are denied in both Harnesses with R35 semantics, even though Copilot CLI reports the Home Repo as its working folder.
  - Writes no file in the Project Repo or Home Repo. `git status --porcelain` in both is unchanged by a launch.
  - Current folder is the Home Repo: starts Workflow Core only with no add-on and no R39 warning; prints `Stack: none (Home Repo)`.
- Output before the Harness starts, in this order:
  - `Home Repo: <absolute path>`
  - `Workflow version: <version>`
  - `Stack: <ids as written>` or `Stack: none`
  - `Language Add-on: <id> (<skill>, <skill>)` per loaded add-on, or `Language Add-on: none`
  - `copilot` only: `note: Copilot CLI skips the locked-tests guard in untrusted folders; trust this folder when asked. The Gate still verifies locked tests.`
- Failure: one line `launch failed: <category>: <detail>`, non-zero exit, no Harness starts, nothing written.
  - `missing-harness` - no argument; also prints usage `<Launch Script> claude|copilot [args...] | version`.
  - `unknown-harness` - any other word; prints usage.
  - `harness-not-installed` - the Harness command is not on `PATH`; names it.
  - `workflow-not-installed` - no version record in the Home Repo; says to run the Update Script.
  - `update-incomplete` - the last Update Script run failed; says to rerun it.
- Examples:
  - Given a Project Repo whose `AGENTS.md` contains `- Stack: csharp`, when `launch claude` runs, then output shows `Stack: csharp` and `Language Add-on: csharp (dotnet-editorconfig, stryker-dotnet)`, Claude Code lists `dotnet-editorconfig` but not `eslint-javascript`, and a locked-path edit is denied.
  - Given the same repo, when `launch copilot` runs, then the same stack and add-on lines print, the trust note prints, and Copilot CLI lists only the C# add-on skills.
  - Given `Stack: node-typescript, powershell`, when `launch claude` runs, then the `node-typescript` add-on loads and a warning names `powershell`.
  - Given `launch gemini`, then it prints `launch failed: unknown-harness: gemini` plus usage, and no Harness starts. (failure)
  - Given a Home Repo where the Update Script never ran, when `launch claude` runs, then it fails with `workflow-not-installed`. (failure)

### R39 - Workflow Core only, with a warning, when no add-on applies
- Rules:
  - The session still starts with Workflow Core only. The warning prints after the R38 output lines and before the Harness starts.
  - Warnings (wording fixed):
    - no `AGENTS.md`: `warning: no AGENTS.md in this folder; starting Workflow Core only. Run /agents-md to create one with a Stack line.`
    - `AGENTS.md` with no `Stack:` line or an empty one: `warning: AGENTS.md names no stack; starting Workflow Core only. Run /agents-md to add a Stack line.`
    - stack with no add-on: `warning: no Language Add-on for stack '<id>'; available: <installed ids, comma-separated>.` When no named stack has an add-on, `Workflow Core only.` is appended.
- Examples:
  - Given a folder with no `AGENTS.md`, when `launch copilot` runs, then the first warning prints, `Stack: none` and `Language Add-on: none` print, and Copilot CLI starts.
  - Given `Stack: powershell`, when `launch claude` runs, then `warning: no Language Add-on for stack 'powershell'; available: csharp, node-javascript, node-typescript. Workflow Core only.` prints and Claude Code starts.

### R40 - Version option
- Rules: `<Launch Script> version` prints `Workflow version: <version>` and `Home Repo: <absolute path>`, exits 0, and starts no Harness. It needs no `AGENTS.md` and can run from any folder.
- Failure: no version record -> `launch failed: workflow-not-installed: ...`, non-zero exit; `update-incomplete` as in R38.
- Examples:
  - Given a Home Repo at `3f9a2c1`, when `launch version` runs from `C:\`, then it prints `Workflow version: 3f9a2c1` and no Harness process starts.

### R41 - By path with no setup; optional short command
- Rules:
  - Calling the Launch Script by its full path works on a machine with only Git, Node.js, and the Harnesses installed. It needs no profile change, execution-policy change, administrator rights, or `PATH` change.
  - `README.md` gives an optional per-machine short command `wf` that forwards all arguments to the Launch Script by path. `wf <args>` and `<path> <args>` print the same output and start the same session.
- Examples:
  - Given a fresh PowerShell with no profile, when `C:\work-home\launch claude` runs in a Project Repo, then the session starts exactly as under R38.
  - Given `wf` defined per `README.md`, when `wf version` runs, then its output equals that of `<path> version`.

### R42 - Same behavior in both layouts
- Rules:
  - Every Workflow Core file a skill or agent reads or runs (helper scripts, agent definitions, references, `user-interaction.md`) resolves in both the copy layout and the Home layout.
  - Every helper reads and writes the Project Repo's `.workflow/`, git history, and files, never the Home Repo's.
  - A skill run in a Project Repo leaves the Home Repo's files and `git status` unchanged.
- Examples:
  - Given the Home layout and a Project Repo with a planned Card, when `/pull-work` runs, then it completes the Card, committing in the Project Repo only. In the copy layout, the same Card completes the same way.
  - Given the Home layout, when `brain-storm` runs `workflow-check`, then Findings refer to files under the Project Repo's `.workflow/`.

### R43 - Same agent names in both Harnesses
- Rules:
  - `coder`, `planner`, `repo-scout`, `test-author`, and `test-reviewer` can be dispatched by those names in Copilot CLI and Claude Code, in both layouts, and follow the same agent instructions.
  - `pull-work`'s critical-code review dispatches `code-review` in both Harnesses. In Copilot CLI this is Copilot's built-in `code-review`. In Claude Code it is Workflow Core's `code-review` agent, which returns only high-confidence defects as `pull-work` asks.
- Examples:
  - Given Claude Code in the Home layout, when `pull-work` reaches the review step, then a `code-review` agent runs and returns findings or none.

### R44 - `agents-md` skill writes the stack statement
- Rules:
  - Skill name `agents-md`. Bootstrap mode when the Project Repo has no root `AGENTS.md`, amendment mode otherwise. Amendment preserves all content it does not change and replaces stale guidance.
  - Reads `.workflow/language.md`, the Session Chain, and Behavior Specs where they exist, in place of `agent-instructions`' `CONTEXT.md`/PRD sources. Unsettled product matters redirect to `brain-storm`, and unsettled behavior redirects to `behavior-spec`.
  - Always writes exactly one `Stack:` line in R38's format. Stack IDs are proposed from repository manifests (`*.csproj`/`*.sln` -> `csharp`; `package.json` with `tsconfig.json` -> `node-typescript`; `package.json` alone -> `node-javascript`). When nothing matches, the skill asks the Developer. Any kebab-case ID is accepted, even one without an add-on.
  - Changes to an existing `Stack:` line happen only with the Developer's agreement.
  - Writes no other file, and commits only `AGENTS.md` with a Conventional Commit of type `docs`.
- Failure:
  - Run in the Home Repo -> stops with "the Home Repo's AGENTS.md holds only Project Pointers"; nothing changes.
  - Both `AGENTS.md` and `.github/copilot-instructions.md` present -> asks which is canonical before writing.
- Examples:
  - Given a repo with `src/App.csproj` and no `AGENTS.md`, when `/agents-md` runs, then `AGENTS.md` is created containing `Stack: csharp`, and `launch claude` then prints `Language Add-on: csharp (...)`.
  - Given the current folder is the Home Repo, when `/agents-md` runs, then nothing is written. (failure)

### R45 - `addon-author` skill builds a Language Add-on
- Rules:
  - Skill name `addon-author`. Runs only in a `Personal.Workflow` source (Workflow Core plus `language-addons/` present), and writes only under `language-addons/<id>/` and the `Available Stacks` section of `language-addons/README.md`.
  - The Developer answers only what cannot be derived: the stack ID (kebab-case), which roles apply (code style, test harness, mutation testing), and the tool and commands per role. Everything else follows the shape of the existing add-ons: one skill folder per role with `SKILL.md`, a Gate step line, and links to `mutation-testing/protocol.md` for mutation roles.
  - Non-code stacks such as database schemas or PowerShell may skip roles. At least one role is required. Each skipped role appears in the README row as `not applicable: <reason>`.
  - The produced add-on needs no hand edit to be installed by the Update Script (R36) and loaded by the Launch Script for `Stack: <id>` (R38).
- Failure:
  - Not in a `Personal.Workflow` source -> stops, says where it must run; nothing written.
  - `language-addons/<id>/` already exists -> stops, names it; nothing written.
  - ID not kebab-case -> asks again.
- Examples:
  - Given a new `sql-schema` add-on with only a code-style role, when the Update Script runs and then `launch claude` runs in a repo with `Stack: sql-schema`, then `Language Add-on: sql-schema (<its skill>)` prints, and the README row lists test harness and mutation testing as `not applicable`.

### R46 - Coordination Playbook
- Rules: one Workflow Core document, installed with Workflow Core. It describes, in this order:
  1. In the API Project Repo, `brain-storm` then `behavior-spec` for the API need (limits, required fields, relationships).
  2. In the database Project Repo, `brain-storm` from the API Behavior Spec path, plus a read-only check of `peer-impact` Project Repos for shared or cross-schema tables. The check makes no edits and no commits in peer repos.
  3. `work-planner` and `pull-work` run separately in each Project Repo, each launched there with the Launch Script. The database Phase delivering the needed schema completes before the API Phase that consumes it starts.
  - It names the Project Pointer roles (`co-changed`, `read-only reference`, `peer-impact`) and what each means for steps 2 and 3. It uses only existing skills.

### R47 - `README.md` documents both layouts
- Rules: `README.md` contains each of:
  - Home Repo setup: create a git repo, commit `AGENTS.md` with Project Pointers and a one-line `CLAUDE.md` (`@AGENTS.md`), then run the Update Script.
  - The Update Script from a clone and from a downloaded zip.
  - The Launch Script by path, `version`, and the `wf` short command.
  - Equivalent direct Harness commands for both Harnesses, including a warning that Claude Code started without the Home Repo settings option is unguarded, and that Copilot CLI needs a trusted folder.
  - The copy-into-repository path, with steps that make R35 hold in both Harnesses.
- Examples:
  - Given only the README, when the Developer follows the direct Claude Code command, then the session matches `launch claude`, minus the printed lines and warnings.

### R48 - Claude Code runs each agent at its pinned family and effort
- Rules:
  - Applies in the Home layout only. In the copy layout, Claude Code agent pins are out of scope.
  - A **Claude entry** is a `model` list entry whose text begins with the word `Claude` (case-insensitive). A `model` written as a single string counts as a one-entry list. Non-Claude entries do not affect Claude Code.
  - The first Claude entry whose next word is a known family (`Opus`, `Sonnet`, `Haiku`, `Fable`) decides the model: Claude Code runs that family's alias (`opus`, `sonnet`, `haiku`, `fable`). Version numbers and suffixes in the entry are ignored, so `Claude Opus 4.8 Fast (copilot)` runs `opus`.
  - A Claude entry with an unknown family word is skipped, and the search continues with the next Claude entry. Each skip prints `Agent pin: <agent>: skipped "<entry>" (not a Claude Code model family)`.
  - `reasoning-effort` sets Claude Code's effort for that agent: `low`, `medium`, `high`, `xhigh`, and `max` are used as written; `none` and `minimal` become `low`. Any other value counts as missing (R50).
  - The pin applies whatever model and effort the main session uses. Workflow Core skills never ask for a per-dispatch model or effort when they dispatch a Workflow Core agent.
  - Claude Code's `/tasks` row for a running agent shows the pinned model, and the pinned effort when that model supports effort. When a model does not support effort, `README.md` states this as a known limitation of R48.
- Failure: an unparsable agent file rejects the whole Update Script run as `invalid-agent` (R36); no file changes and the previous agents stay installed.
- Examples:
  - Given the main session on Opus and `repo-scout` listing `Claude Haiku 5.5 (copilot)` with `reasoning-effort: low`, when Claude Code dispatches `repo-scout`, then `/tasks` shows Haiku at `low`.
  - Given the same session, when Claude Code dispatches `planner` (`Claude Opus 5.5 (copilot)`, `high`), then it runs on Opus at `high`.
  - Given `coder` lists `GPT-6 Luna (copilot)`, `Claude Nova 1 (copilot)`, `Claude Sonnet 5 (copilot)`, when the Update Script runs, then it prints `Agent pin: coder: skipped "Claude Nova 1 (copilot)" (not a Claude Code model family)`, and Claude Code runs `coder` on `sonnet`.
  - Given `test-author.agent.md` has a frontmatter line that is not valid YAML, when the Update Script runs, then it prints `update failed: invalid-agent: .github/agents/test-author.agent.md`, exits non-zero, and the Home Repo is unchanged. (failure)

### R49 - Copilot CLI pins stay as written
- Rules:
  - Each source agent file carries exactly two pins: the Copilot `model` list and `reasoning-effort`. The Developer maintains no other pin field and runs no sync step.
  - In the copy layout and in the Home layout, Copilot CLI sees each agent's `model` list (same entries, same order) and `reasoning-effort` exactly as in the source file, and runs the agent on the first available listed model at that effort.
  - Copilot CLI never sees a Claude Code alias or `effort` value in place of its own pins.
- Examples:
  - Given `code-review` lists `Claude Sonnet 5.5 (copilot)`, `GPT-6.1 Terra (copilot)`, `Gemini 4 Neon (copilot)` at `medium`, when Copilot CLI runs it in the Home layout with Sonnet 5.5 unavailable, then it runs on GPT-6.1 Terra at `medium`, as in the copy layout.

### R50 - Shipped default, named in Update Script output
- Rules:
  - The shipped default is model `sonnet` and effort `medium`. Each half applies on its own: a missing model pin does not change a valid effort, and the reverse.
  - Claude Code uses the default model when the `model` list is missing, has no Claude entry, or has only skipped Claude entries (R48). It uses the default effort when `reasoning-effort` is missing or not a recognized value.
  - Each defaulted half prints one line after `Files:`, sorted by agent name, then model before effort:
    - `Agent default: <agent>: model sonnet (no Claude model in list)`
    - `Agent default: <agent>: effort medium (no reasoning-effort)` or `(unrecognized reasoning-effort "<value>")`
  - Notices from R48 and R50 do not change the exit code (0). They print again on every run while the cause remains, including a rerun of the same source.
- Examples:
  - Given `coder` with its Claude entries removed and `reasoning-effort: medium`, when the Update Script runs, then output includes `Agent default: coder: model sonnet (no Claude model in list)`, no effort line for `coder`, and Claude Code runs `coder` on `sonnet` at `medium`.
  - Given `repo-scout` with `reasoning-effort: fast`, when the Update Script runs, then output includes `Agent default: repo-scout: effort medium (unrecognized reasoning-effort "fast")`, and Claude Code still runs it on `haiku`.
  - Given every agent has a known Claude entry and a recognized effort, when the Update Script runs, then no `Agent default:` or `Agent pin:` line prints.

### R51 - One edit, one Update Script run, both Harnesses
- Rules:
  - Editing an agent's `model` list or `reasoning-effort` in `Personal.Workflow`, then one Update Script run, changes that agent in every Harness session started afterwards. No other file is edited by hand.
  - Sessions already running keep the pins they started with until the Harness restarts.
  - Claude Code changes only when the first known Claude entry's family, or the effort, changes. Copilot CLI changes whenever its list or effort changes.
- Examples:
  - Given `coder`'s Claude entry changes from `Claude Haiku 5.5 (copilot)` to `Claude Sonnet 5.5 (copilot)` and the Update Script runs, when a new Claude Code session dispatches `coder`, then it runs on `sonnet`.
  - Given `Gemini 4 Neon (copilot)` is moved to the top of `coder`'s list and the Update Script runs, when new sessions dispatch `coder`, then Copilot CLI runs it on Gemini 4 Neon and Claude Code still runs it on `haiku`.
  - Given `coder`'s entry changes from `Claude Haiku 5.5 (copilot)` to `Claude Haiku 6 (copilot)`, when the Update Script runs, then Claude Code still runs `coder` on `haiku`.

## Quality Thresholds
- Ordering -> R35 holds before any other requirement in this spec is delivered, so Claude Code is guarded while v1 is built.
- Seamless relay -> switching Harness mid-Card takes exactly one Launch Script call with the other Harness name. No handoff file is written, and `git status --porcelain` in the Project Repo is unchanged by the switch.
- Version identity -> the same `Personal.Workflow` content yields the same workflow version on both machines (clone vs zip), 100% of runs.
- Offline -> the Update Script and the Launch Script succeed with network access disabled (Harness sign-in excluded).

## External Constraints
- Harness hook payloads, deny formats, and skill and agent discovery locations - Anthropic and GitHub. Probed on Claude Code 2.1.330 and Copilot CLI 1.0.116:
  - Claude Code denies only via `hookSpecificOutput`.
  - Both Harnesses send Claude-shaped payloads.
  - Claude Code loads Home Repo hooks only with its settings option.
  - Copilot CLI reports the Home Repo as `cwd` under `--add-dir`.
  - Copilot CLI prefers `.github/agents` over `.claude/agents` and its built-in `code-review` over ours.
  - Copilot CLI skips repository hooks in untrusted folders.
- Work machine: the only update path is a downloaded zip plus the Update Script against a Home Repo the Developer names, with no network, touching only workflow-owned files - the Developer's employer.
- Prerequisites stay Git, Node.js LTS (`22.12+` or `24`), and the two Harnesses - existing `README.md`.
- `agents-md` adapts `agent-instructions` from the Developer's `AI.Workflows` repository (`.github/skills/agent-instructions/SKILL.md`) - the Developer.
- Targets are Claude Code and Copilot CLI only; VS Code is an optional viewer - the Developer.
- Claude Code agent fields - Anthropic, per the subagent documentation for Claude Code 2.1.332:
  - `model` accepts an alias (`opus`, `sonnet`, `haiku`, `fable`), a full model ID, or `inherit`. `effort` accepts `low`, `medium`, `high`, `xhigh`, `max`, and the levels available depend on the model.
  - Unknown frontmatter fields are silently ignored, which is why `reasoning-effort` and a list-form `model` have no effect today.
  - A model passed at dispatch overrides the file's `model`. `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` and `CLAUDE_CODE_EFFORT_LEVEL`, when the Developer sets them, override the pins.
  - Agents under `--add-dir` load at session start only.
  - `/tasks` shows each running agent's model and effort.
- Copilot CLI agent fields: a `model` list of display names tried in order, and `reasoning-effort` - GitHub.

## Product Interfaces
- Update Script CLI: argument, output lines, and failure categories in R36, and agent pin notices in R48 and R50.
- Launch Script CLI: `claude|copilot [args...]`, `version`, output lines, warnings, and failure categories in R38-R40.
- `AGENTS.md` stack statement: `Stack: <id>[, <id>...]` in R38, written by R44.

## Left To Planning
- Script runtime and file names for the Update Script and Launch Script, within R41's no-setup constraint.
- How only the stack's add-ons are exposed to each Harness, and the folder layout of installed files in the Home Repo.
- How installed files are recorded for mirroring and hidden from git without a committed change.
- Fingerprint algorithm behind the workflow version.
- Where the guard is registered for each Harness and layout, and how it finds the edited file's repository.
- How skills and agents resolve Workflow Core paths in both layouts.
- How installed agent files carry Copilot's list and effort alongside Claude Code's alias and effort, so each Harness reads only its own pins in the Home layout (R48, R49).
- Path of the Coordination Playbook.

## Assumptions
- R36: Workflow version is a 7-character content fingerprint, not a hand-bumped number. Reason: the Users line asks for no manual upkeep, and a zip has no git history to derive one from.
- R36: `home-is-source`, `home-is-project`, and `tracked-workflow-files` reject without changing anything. Reason: the Session rejects `Personal.Workflow` as Home Repo and copies in Project Repos, and committed files must stay unchanged.
- R36: `copy-failed` leaves an incomplete marker that blocks launches until a rerun. Reason: a half-copied Home Repo would mix versions silently.
- R38: several stack IDs load every matching add-on. Reason: polyglot repos stay usable; the R39 pattern already prefers starting over refusing.
- R38: launching in the Home Repo itself starts Workflow Core with no warning. Reason: the Home Repo's `AGENTS.md` holds only Project Pointers by design, so the warning would be noise.
- R38: Harness arguments pass through, and the Harness exit code is returned. Reason: relay often needs Harness resume options.
- R38: the Copilot trust note prints on every `copilot` launch. Reason: the Session rules out trust detection, so a fixed note is the only way to surface it.
- R38/R39/R40: output and warning wording as written above. Reason: deferred to spec; the wording names the folder, stack, or skill to act on.
- R35: shell-command writes stay unguarded. Reason: this preserves the existing guard's scope; the Gate is the backstop.
- R41: the short command is named `wf`. Reason: short and unused by either Harness.
- R44: the skill is named `agents-md`, stacks are proposed from manifests, and it commits only `AGENTS.md`. Reason: workflow stages start from a clean tree.
- R44: it refuses to run in the Home Repo. Reason: the Home Repo's `AGENTS.md` holds only Project Pointers.
- R45: the skill is named `addon-author`; an existing stack folder stops it; non-code stacks may skip roles if at least one remains. Reason: deferred depth for non-code stacks; extending an existing add-on is not in scope.
- R46: the database Phase completes before the consuming API Phase starts. Reason: needs-first ordering was the Session's root-cause fix.
- R50: the shipped default is `sonnet` at `medium`. Reason: it is the median of the six shipped agents' pins (three use Sonnet, four use `medium`).
- R48: unknown-family Claude entries are skipped with a notice rather than failing the run. Reason: the Session rejects refusing an install over a pin and prefers a named notice.
- R36/R48: an unparsable agent file fails the whole run as `invalid-agent`. Reason: such a file loads in neither Harness, and R36 already validates the source before any write.
- R48: `xhigh` and `max` pass through, and `none`/`minimal` map to `low`. Reason: these are the nearest supported Claude Code levels; Workflow Core itself uses only `low`, `medium`, `high`.
- R48/R50: notice wording as written above. Reason: deferred to spec; each line names the agent, the value used, and the cause to fix.
- R48: Workflow Core skills never request a per-dispatch model or effort, and Developer-set Claude Code environment overrides win without a warning. Reason: a dispatch-time model silently defeats the pin; environment overrides are a deliberate Developer choice.
- R48: `README.md` states the effort limitation for models without effort support. Reason: the Session's accepted risk says it is reported as a limitation, and `README.md` already documents Harness caveats (R47).
- R51: changes reach sessions started after the run, not running ones. Reason: Claude Code loads `--add-dir` agents only at session start.
