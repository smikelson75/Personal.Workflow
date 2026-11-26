# P03 - Launch Script with stack add-ons and Home-layout guard

- **Outcome:** `<home>\launch claude|copilot [args...]` run in a Project Repo starts that Harness there with the Home Repo's Workflow Core skills, only the Language Add-ons named by the folder's `Stack:` line, and the locked-tests guard; `launch version` prints the Workflow version; nothing is written to either repository.
- **Covers:** R38, R39, R40, R41, Q-offline (launch side), Q-seamless-relay
- **Invariants:**
  - Sources: `home/launch.mjs` and `home/launch.cmd` at the source root. The Update Script (P02) already installs `home/**` to the Home Repo root, so they run as `<home>\launch.mjs` and `<home>\launch.cmd`. `launch.cmd` is exactly `@node "%~dp0launch.mjs" %*`.
  - ES module, Node built-ins only, no dependencies, no network modules (`http`, `https`, `net`, `dns`, `tls`, `dgram`) and no `fetch`. Writes nothing in the Project Repo or the Home Repo; its only writes are one temp folder under `os.tmpdir()` (S04).
  - Home Repo = `realpathSync.native` of the folder holding `launch.mjs` (never the working folder). The Project folder is `process.cwd()`.
  - Version record: `<git-path>/personal-workflow/manifest.json`, where `<git-path>` is `git -C <home> rev-parse --git-path personal-workflow` resolved against `<home>` (the same file `scripts/update-home.mjs` writes: `{"version","status","files"}`).
  - Every output line and every failure goes to stdout. A failure is one line `launch failed: <category>: <detail>` and exit 1; usage failures add the line `usage: launch claude|copilot [args...] | version`.
  - Check order for `launch <harness>`: `missing-harness`, `unknown-harness`, `workflow-not-installed`, `update-incomplete`, `harness-not-installed`. `launch version` runs only the two install-state checks.
  - Test fixture contract (tests only; all temp, no network):
    - Home fixture: a temp git repo holding `launch.mjs` and `launch.cmd` (copies of `home/`), `.git/personal-workflow/manifest.json` = `{"version":"3f9a2c1","status":"complete","files":[]}`, `.workflow-core/language-addons/<id>/<skill>/SKILL.md` (add-ons: `csharp/{dotnet-editorconfig,stryker-dotnet}`, `node-javascript/{eslint-javascript,stryker-javascript,vitest-javascript}`, `node-typescript/{eslint-typescript,stryker-typescript,vitest-typescript}`, plus `mutation-testing/protocol.md`), and `.workflow-core/hooks/scripts/guard-locked-tests.mjs` (a copy of `.github/hooks/scripts/guard-locked-tests.mjs`). A `stryker-*` `SKILL.md` contains the link `(../mutation-testing/protocol.md)`.
    - Harness stubs: a temp `bin/` folder with `claude.cmd` and `copilot.cmd`, each `@node "%~dp0stub.mjs" %*`. `stub.mjs` writes JSON `{name, argv, cwd, plugin}` to the file named by env `WF_STUB_OUT` (`plugin` maps each relative file under the folder after `--plugin-dir` to its content, or is `null`), then exits with env `WF_STUB_EXIT` (default 0). Tests prepend `bin/` to `PATH`. Tests that need the stubs or PowerShell are skipped when `process.platform !== 'win32'`.
    - Tests read stable markers only: output lines, argv, the recorded JSON, `git status --porcelain`.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" "tests/home-repo-workflow/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R38-01]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Known failures:**
  - `[R22-03] no file under skills, agents, or hooks names AGENTS.md` - owner P05
  - `[R29-01] Glossary defines all 28 canonical terms with Slice and Card separate` - owner P05
  - `[R30-03] prior Session files in .workflow/sessions/ remain untouched` - owner P05
- **Not expressible:**
  - Real Claude Code and Copilot CLI listing the add-on skills, loading the guard from the session plugin, and denying a live edit - needs the real Harnesses (Copilot also needs a trusted folder); the main session live-probes both at Review and records the result in the plan's Current state. Tests cover the argv, the plugin folder, and the guard command run directly.
  - Q-offline with the network physically disabled - needs an OS-level sandbox; S05 tests unreachable proxy variables plus the absence of network modules and `fetch`.
- **Gate:**
  - suite: `node --test --test-reporter=tap --test-skip-pattern="<node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/home-repo-workflow/phase-03.md --skip-pattern output>" "tests/home-repo-workflow/*.test.mjs" "tests/glossary-alignment/*.test.mjs" "tests/acceptance/*.test.mjs" "tests/mutation-addon.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node --test --test-reporter=tap "tests/home-repo-workflow/*.test.mjs" "tests/glossary-alignment/*.test.mjs" "tests/acceptance/*.test.mjs" "tests/mutation-addon.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs" > <tap-file>; then node .github/tools/workflow-core/scripts/trace.mjs --tap <tap-file> --phase-file .workflow/plans/home-repo-workflow/phase-03.md R38-01 R38-02 R38-03 R38-04 R38-05 R38-06 R38-07 R38-08 R38-09 R38-10 R38-11 R38-12 R38-13 R38-14 R38-15 R38-16 R38-17 R38-18 R39-01 R39-02 R39-03 R39-04 R40-01 R40-02 R40-03 R41-01 R41-02 R41-03 Q-offline Q-seamless-relay`
  - lock: `git diff --exit-code <Tests locked> -- tests/home-repo-workflow`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - Launch Script by path: version option and install-state checks

- **Kind:** build
- **Goal:** `launch version` prints the Workflow version and Home Repo from any folder, refuses when the Update Script has not completed, and works by path in a fresh PowerShell; the Update Script installs both launcher files.
- **Depends on:** none
- **Tier:** main - creates the script structure (Home lookup, manifest reading, failure printing) later cards extend
- **Review:** required - creates a shared structure; reads a persisted format
- **Scenarios:** fixture: the Home fixture from the phase header (no stubs needed)
  - R40-01: Given a complete manifest with version `3f9a2c1` and a working folder that is neither repository and has no `AGENTS.md`, when `node <home>/launch.mjs version` runs, then stdout lines are exactly `Workflow version: 3f9a2c1` and `Home Repo: <real home path>`, exit is 0
  - R40-02: Given no manifest file, when `version` runs, then stdout starts `launch failed: workflow-not-installed:`, the detail names `scripts/update-home.mjs`, exit is 1 (failure)
  - R40-03: Given a manifest with `"status":"incomplete"`, when `version` runs, then stdout starts `launch failed: update-incomplete:`, the detail says to rerun the Update Script, exit is 1 (failure)
  - R41-01: Given a PowerShell started with `-NoProfile -NonInteractive` and its default execution policy, when `& '<home>\launch' version` runs, then stdout equals R40-01's and exit is 0
  - R41-02: Given that PowerShell defines `function wf { & '<home>\launch' @args }`, when `wf version` runs, then its stdout equals the output of `& '<home>\launch' version`
  - R41-03: Given an empty git repo as Home Repo and the real source, when `node scripts/update-home.mjs <home>` runs, then `<home>/launch.mjs` and `<home>/launch.cmd` exist and `node <home>/launch.mjs version` prints `Workflow version: <V>` with the `<V>` the Update Script printed
- **Acceptance tests:** `tests/home-repo-workflow/p03-s01.test.mjs`
- **Files:** create `home/launch.mjs`; create `home/launch.cmd`
- **Patterns:** `scripts/update-home.mjs:7 - locate the script's own folder from import.meta.url`; `scripts/update-home.mjs:88 - manifestPathFor: git rev-parse --git-path personal-workflow resolved against home`; `scripts/update-home.mjs:69 - readManifest tolerant JSON read`
- **Decisions:**
  - `argv[2]` selects the mode. `version` prints `Workflow version: <version>` then `Home Repo: <home>`. Any other value is handled by later cards; until then, treat it as missing-harness territory (print nothing, exit 0 is not allowed - print `launch failed: unknown-harness: <word>` plus the usage line).
  - Install-state check: no manifest file, or unparseable JSON, or `version` not a string -> `workflow-not-installed`, detail `run scripts/update-home.mjs from a Personal.Workflow clone`. `status` other than `complete` -> `update-incomplete`, detail `rerun scripts/update-home.mjs`.
  - Put the install-state check, the failure printer (`fail(category, detail, usage)`), and the Home lookup in small named functions; later cards call them.
  - `launch.cmd` text is exactly the line in the phase header.
- **Do not:** edit `tests/home-repo-workflow/**`, `scripts/update-home.mjs`; write any file; add dependencies; import network modules.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R40-01, R40-02, R40-03, R41-01, R41-02, R41-03; 6 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S02 - Harness selection, argument passthrough, and exit code

- **Kind:** build
- **Goal:** `launch claude|copilot [args...]` validates the Harness name and install state, starts the Harness in the current folder with the arguments unchanged, and returns its exit code.
- **Depends on:** S01
- **Tier:** main - process spawning and Windows `.cmd` resolution are subtle and later cards build on them
- **Review:** required - spawns processes with user-supplied arguments
- **Scenarios:** fixture: the Home fixture and both stubs; `WF_STUB_OUT` names the record file
  - R38-01: Given `claude` on PATH and `WF_STUB_EXIT=7`, when `node <home>/launch.mjs claude --continue --model "a b"` runs in a Project folder, then the stub's `argv` ends with `--continue`, `--model`, `a b` in that order, its `cwd` is the Project folder, and the launcher's exit code is 7
  - R38-02: Given both stubs, when the first argument is `CLAUDE` and then `Copilot`, then the `claude` stub and then the `copilot` stub run (the stub `name` is lower case)
  - R38-03: Given no argument, when `launch.mjs` runs, then stdout is `launch failed: missing-harness: ...` and the usage line, exit is 1, and no stub ran (failure)
  - R38-04: Given `gemini`, when it runs, then stdout is `launch failed: unknown-harness: gemini` and the usage line, exit is 1, and no stub ran (failure)
  - R38-05: Given PATH holds no `claude`, when `launch.mjs claude` runs, then stdout is `launch failed: harness-not-installed: claude`, exit is 1 (failure)
  - R38-06: Given no manifest and `claude` on PATH, when `launch.mjs claude` runs, then stdout starts `launch failed: workflow-not-installed:` and no stub ran (failure)
  - R38-07: Given a manifest with `"status":"incomplete"`, when `launch.mjs copilot` runs, then stdout starts `launch failed: update-incomplete:` and no stub ran (failure)
- **Acceptance tests:** `tests/home-repo-workflow/p03-s02.test.mjs`
- **Files:** edit `home/launch.mjs`
- **Patterns:** `home/launch.mjs:1 - S01's fail(), install-state check, and Home lookup; call them, do not duplicate`
- **Decisions:**
  - Mode dispatch: no `argv[2]` -> `missing-harness` (detail `no Harness given`); lower-cased `argv[2]` is `claude` or `copilot` -> launch; `version` -> S01; anything else -> `unknown-harness` with the word as typed.
  - Resolve the Harness command by scanning `process.env.PATH` entries in order. On Windows try each extension of `process.env.PATHEXT` (default `.COM;.EXE;.BAT;.CMD`) for every entry; elsewhere the bare name. The first existing file wins. None found -> `harness-not-installed` with the lowercase name.
  - Spawn with `stdio: 'inherit'`, `cwd` unchanged, `shell: false`. A resolved `.cmd` or `.bat` file runs as `spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', '"' + [file, ...args].map(q).join(' ') + '"'], { stdio: 'inherit', windowsVerbatimArguments: true })` with `q(s)` = `"` + s with each `"` doubled + `"`; any other file runs directly.
  - Child args = launcher-added flags first (none in this card; S04 adds them), then the user's arguments exactly as received.
  - Exit code: the child's exit code; a child killed by a signal or a spawn error gives 1.
- **Do not:** edit `tests/home-repo-workflow/**`; use `shell: true`; print anything on success; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R38-01 to R38-07; 7 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S03 - Stack statement, add-on selection, output lines, and warnings

- **Kind:** build
- **Goal:** before the Harness starts, the launcher prints the Home Repo, version, stack, loaded add-ons, the Copilot trust note, and the warnings for missing stacks or add-ons.
- **Depends on:** S02
- **Tier:** delegate - pure parsing and printing; S02's structure and every line format are pinned below
- **Review:** required - parses an untrusted file (`AGENTS.md`)
- **Scenarios:** fixture: the Home fixture and both stubs; the Project folder holds the `AGENTS.md` each scenario names
  - R38-08: Given `AGENTS.md` contains `- Stack: csharp`, when `launch.mjs claude` runs, then stdout lines are exactly `Home Repo: <home>`, `Workflow version: 3f9a2c1`, `Stack: csharp`, `Language Add-on: csharp (dotnet-editorconfig, stryker-dotnet)` and the claude stub ran
  - R38-09: Given the same folder, when `launch.mjs copilot` runs, then the same four lines print followed by `note: Copilot CLI skips the locked-tests guard in untrusted folders; trust this folder when asked. The Gate still verifies locked tests.` and the copilot stub ran
  - R38-10: Given `Stack: node-typescript, powershell`, when `launch.mjs claude` runs, then stdout has `Stack: node-typescript, powershell`, `Language Add-on: node-typescript (eslint-typescript, stryker-typescript, vitest-typescript)` and `warning: no Language Add-on for stack 'powershell'; available: csharp, node-javascript, node-typescript.` with no `Workflow Core only.`, and the stub ran
  - R38-11: Given `Stack: node-javascript,csharp`, when `launch.mjs claude` runs, then two `Language Add-on:` lines print in that order (`node-javascript (eslint-javascript, stryker-javascript, vitest-javascript)`, then `csharp (dotnet-editorconfig, stryker-dotnet)`) and no `warning:` line
  - R38-12: Given `AGENTS.md` holds `# x`, then `STACK:  csharp  `, then `Stack: node-javascript`, when `launch.mjs claude` runs, then the stack is `Stack: csharp` (case-insensitive key, first match wins, value trimmed)
  - R38-13: Given the working folder is the Home Repo itself and its `AGENTS.md` has no `Stack:` line, when `node launch.mjs claude` runs, then stdout has `Stack: none (Home Repo)` and `Language Add-on: none`, no `warning:` line, and the stub ran
  - R39-01: Given no `AGENTS.md`, when `launch.mjs copilot` runs, then stdout has `Stack: none`, `Language Add-on: none`, then the note, then `warning: no AGENTS.md in this folder; starting Workflow Core only. Run /agents-md to create one with a Stack line.`, and the stub ran
  - R39-02: Given `AGENTS.md` without a `Stack:` line, and again with the line `Stack:` empty, when `launch.mjs claude` runs, then each prints `warning: AGENTS.md names no stack; starting Workflow Core only. Run /agents-md to add a Stack line.` after `Stack: none` and `Language Add-on: none`
  - R39-03: Given `Stack: powershell`, when `launch.mjs claude` runs, then stdout has `Stack: powershell`, `Language Add-on: none`, `warning: no Language Add-on for stack 'powershell'; available: csharp, node-javascript, node-typescript. Workflow Core only.`, and the stub ran
  - R39-04: Given `Stack: powershell, go`, when `launch.mjs claude` runs, then one such warning prints per ID (`'powershell'` then `'go'`), each ending `Workflow Core only.`
- **Acceptance tests:** `tests/home-repo-workflow/p03-s03.test.mjs`
- **Files:** edit `home/launch.mjs`
- **Patterns:** `home/launch.mjs:1 - S02's launch path; print the lines after the install-state check and before spawning`
- **Decisions:**
  - Stack line: the first line of `<cwd>/AGENTS.md` matching `/^\s*(?:-\s+)?stack:(.*)$/i`; the value is the captured text trimmed. IDs are the value split on `,`, each trimmed, empties dropped. A value with no IDs is "no stack".
  - Available add-on IDs: the sorted names of folders under `<home>/.workflow-core/language-addons/` that contain at least one subfolder holding a `SKILL.md` (so `mutation-testing` and `README.md` are excluded). An add-on's skills: those subfolder names, sorted. An ID loads when it is in that list.
  - Lines in order: `Home Repo: <home>`, `Workflow version: <version>`, `Stack: <value as written>` or `Stack: none`, one `Language Add-on: <id> (<skills joined by ", ">)` per loaded ID in the order written (or one `Language Add-on: none`), the note (copilot only), then warnings.
  - Warnings: no `AGENTS.md` -> warning 1; file without a stack or with no IDs -> warning 2; per unknown ID, `warning: no Language Add-on for stack '<id>'; available: <available IDs joined by ", ">.`, with ` Workflow Core only.` appended when no ID loaded.
  - Home Repo case: the working folder's real path equals the Home Repo (compare lower-cased on Windows) -> `Stack: none (Home Repo)`, `Language Add-on: none`, no warnings; `AGENTS.md` is not read.
  - The exact note text is the one in R38-09. Put the parsing in functions `readStack(cwd)` and `listAddons(home)` that S04 calls.
- **Do not:** edit `tests/home-repo-workflow/**`; read any file other than `AGENTS.md` and the add-on folders; write any file; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R38-08 to R38-13 and R39-01 to R39-04; 11 target tests run (R39-02 has two cases)
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S04 - Session plugin: add-on skills and the locked-tests guard in the Home layout

- **Kind:** build
- **Goal:** each launch hands the Harness the Home Repo's core skills (`--add-dir`) and a temporary plugin that carries only the loaded add-on skills and the guard hook, removes the plugin afterwards, and writes nothing in either repository.
- **Depends on:** S03
- **Tier:** main - creates the attachment mechanism (plugin layout, hook command) that the Harnesses consume
- **Review:** required - recursive delete of a temp folder; builds a command line from paths; guard registration
- **Scenarios:** fixture: the Home fixture and both stubs; a Project repo with a plan whose `Tests locked` ref tracks `tests/acceptance/add.test.mjs` under Oracle `tests/acceptance/` (the P01 guard fixture shape)
  - R38-14: Given `Stack: csharp`, when `launch.mjs claude` runs, then the stub's argv holds `--add-dir <home>` and `--plugin-dir <P>` before the user's arguments, `<P>` is outside both repositories, and during the run `<P>` holds `.claude-plugin/plugin.json` (valid JSON with `name` `workflow-stack`), `skills/dotnet-editorconfig/SKILL.md`, `skills/dotnet-editorconfig/references/BASELINE.md`, and `skills/stryker-dotnet/SKILL.md`, and no `skills/eslint-javascript`
  - R38-15: Given the same folder, when `launch.mjs copilot` runs, then argv and the plugin folder match R38-14 (same flags, same files)
  - R38-16: Given `Stack: csharp`, then `<P>/skills/mutation-testing/protocol.md` exists; given `Stack: powershell` (no add-on), then `<P>/skills/` holds no skill folder
  - R38-17: Given the plugin's `hooks/hooks.json` has one `PreToolUse` command, when it runs through the shell with the working folder set to the Home Repo and stdin `{"tool_name":"Edit","tool_input":{"file_path":"<project>/tests/acceptance/add.test.mjs"}}`, then stdout is a deny (`permissionDecision` `deny`, naming the plan slug, the `Tests locked` ref, and the path); with stdin `{"toolName":"edit","toolArgs":"{\"path\":\"<project>/tests/acceptance/add.test.mjs\"}","cwd":"<home>"}` (Copilot shape, `toolArgs` a JSON string) the same file is also denied; with `src/add.mjs` stdout is `{}`
  - R38-18: Given a launch of `claude` and then of `copilot` in the same Project, when each returns, then `<P>` no longer exists, `git status --porcelain` in the Project and in the Home is unchanged, and no file in the Project folder or the Home folder was created or modified (tree snapshot equal)
- **Acceptance tests:** `tests/home-repo-workflow/p03-s04.test.mjs`
- **Files:** edit `home/launch.mjs`
- **Patterns:** `home/launch.mjs:1 - S03's readStack() and listAddons(); S02's spawn call, where the launcher-added flags go first`; `.claude/settings.json:1 - Claude-format PreToolUse hook entry shape`
- **Decisions:**
  - Create `<P>` with `mkdtempSync(join(tmpdir(), 'workflow-stack-'))`. Delete only `<P>` itself after the child exits, on `SIGINT`, and on `SIGTERM`, using `rmSync(P, { recursive: true, force: true })`, and only when its name starts with `workflow-stack-` and it lies directly in `tmpdir()`.
  - Plugin files: `.claude-plugin/plugin.json` = `{"name":"workflow-stack","version":"<workflow version>","description":"Language Add-ons and locked-tests guard for this session"}`; for each loaded ID, copy every add-on skill folder to `skills/<skill>/` with `cpSync(..., { recursive: true })`; when any copied `SKILL.md` contains `mutation-testing/protocol.md`, copy `<home>/.workflow-core/language-addons/mutation-testing/` to `skills/mutation-testing/`.
  - `hooks/hooks.json` = `{"hooks":{"PreToolUse":[{"hooks":[{"type":"command","command":"node \"<G>\"","timeout":10}]}]}}` where `<G>` is `<home>/.workflow-core/hooks/scripts/guard-locked-tests.mjs` written with `/` separators. The same plugin serves both Harnesses (Copilot CLI reads Claude-format plugins).
  - Child args = `--add-dir`, `<home>`, `--plugin-dir`, `<P>`, then the user's arguments, for both Harnesses. In the Home Repo case (R38-13) the plugin still carries the guard and no skills.
  - The plugin is built after all S03 output lines print and before the spawn.
- **Do not:** edit `tests/home-repo-workflow/**`; write inside the Project Repo or the Home Repo; delete anything other than `<P>`; use `shell: true`; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R38-14 to R38-18; 5 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S05 - Offline and seamless relay across the whole launcher

- **Kind:** verify
- **Goal:** the finished Launch Script needs no network and lets the Developer switch Harness mid-Card with one call and no handoff file.
- **Depends on:** S04
- **Tier:** main - runs existing code; Files is none
- **Review:** none
- **Scenarios:** fixture: the S04 fixture
  - Q-offline: Given `HTTP_PROXY`, `HTTPS_PROXY`, and `ALL_PROXY` set to `http://127.0.0.1:9`, when `launch.mjs claude` and `launch.mjs version` run, then both succeed, and `home/launch.mjs` contains no import of `http`, `https`, `net`, `dns`, `tls`, or `dgram` (with or without `node:`) and no `fetch(`
  - Q-seamless-relay: Given a Project with a clean `git status --porcelain`, when `launch.mjs claude` runs and then `launch.mjs copilot` runs, then each is one launcher call whose stub `cwd` is the Project, the Project and Home tree snapshots (file list and content hashes, excluding `.git`) are identical before and after, and `git status --porcelain` is still empty
- **Acceptance tests:** `tests/home-repo-workflow/p03-s05.test.mjs`
- **Files:** none
- **Patterns:** `tests/home-repo-workflow/p02-s05.test.mjs:1 - offline checks (proxy variables, no network modules)`
- **Decisions:** tests only; the product is S01-S04's.
- **Do not:** edit `tests/home-repo-workflow/**` other than this card's file; change product code.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets Q-offline, Q-seamless-relay; 2 target tests run
- **Stop and report if:** a target test fails (set blocked so Revise adds a `fix` card); a locked test looks wrong.

## S06 - Repair S04 fixture: add-on SKILL.md content

- **Kind:** test-fix
- **Scope:** fixture
- **Goal:** the S04 Home fixture writes each non-stryker add-on `SKILL.md` as `# <skill>` followed by a blank line (`# <skill>\n\n`), so the unchanged expectation `skills/dotnet-editorconfig/SKILL.md` equals `# dotnet-editorconfig\n\n` holds when the launcher copies the file byte for byte.
- **Depends on:** none
- **Tier:** main - Fixture Repair
- **Review:** none
- **Restores:** R38-14, R38-15 (the fixture wrote one trailing newline where the expectation has two; the launcher is correct)
- **Acceptance tests:** `tests/home-repo-workflow/p03-s04.test.mjs`
- **Files:** none
- **Do not:** change any line matching the Harness `assert` regex; change what any test expects.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="Q-offline|Q-seamless-relay" "tests/home-repo-workflow/*.test.mjs"` exits 0


## S07 - Review fix: launcher signal handling and plugin build failure

- **Kind:** fix
- **Goal:** Ctrl+C does not kill the launcher or delete the session plugin while the Harness runs (cleanup only on the child's close; SIGTERM is forwarded to the child); a failure while building the plugin removes the temp folder and prints `launch failed: launch-failed: <message>` with exit 1.
- **Depends on:** S04
- **Tier:** main - small review-driven fix
- **Review:** required - process spawn and recursive delete
- **Restores:** review - SIGINT killed launcher and removed plugin under a live Harness; review - plugin temp folder leaked when buildPlugin threw
- **Acceptance tests:** none (defect no black-box test expresses)
- **Files:** `home/launch.mjs`
- **Done when:** `node --test "tests/home-repo-workflow/*.test.mjs"` exits 0
