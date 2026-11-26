# P02 - Update Script fills a Home Repo offline

- **Outcome:** `node scripts/update-home.mjs <home-repo>` run from a clone or extracted zip installs Workflow Core, all Language Add-ons, and the Launch Script files into a Home Repo, prints the old and new Workflow version, mirrors on rerun, rejects unsafe targets before writing, and leaves `git status --porcelain` unchanged.
- **Covers:** R36, R37, Q-version-identity, Q-offline (update side; launch side is P03)
- **Invariants:**
  - ES modules (`.mjs`), Node built-ins only, no dependencies, no network modules (`http`, `https`, `net`, `dns`, `tls`, `dgram`) and no `fetch`.
  - The Update Script is `scripts/update-home.mjs` at the source root. It finds the source root from its own location (`import.meta.url`, parent of `scripts/`), never from the working folder, and never reads `.git` of the source.
  - Success output goes to stdout, exit 0. Failure is one stdout line `update failed: <category>: <detail>`, exit 1. Validation failures write nothing.
  - Tests read stable markers only: output lines, installed paths, `git status --porcelain`, manifest JSON keys.
  - Edits to existing files change only the lines a card names.
- **Install map** (source path -> Home Repo path; `/` separators in the manifest and fingerprint):
  - `.github/skills/**` -> `.claude/skills/**`
  - `.github/agents/*.agent.md` -> `.claude/agents/*.agent.md`
  - `.github/hooks/**`, `.github/tools/**`, `.github/user-interaction.md` -> `.workflow-core/hooks/**`, `.workflow-core/tools/**`, `.workflow-core/user-interaction.md`
  - `language-addons/**` -> `.workflow-core/language-addons/**`
  - `home/**` (Launch Script sources, created in P03; may be absent) -> Home Repo root, same relative path
  - Never installed: any folder named `tests`, `node_modules`, or `.git`, and `.github/agents/README.md`.
- **Manifest:** `<git-path>/personal-workflow/manifest.json` where `<git-path>` is `git -C <home> rev-parse --git-path personal-workflow` resolved against `<home>`. Shape: `{"version":"<7 hex>"|"none","status":"complete"|"incomplete","files":["<home-relative path>", ...]}` with `files` sorted. P03 reads this same file.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" "tests/home-repo-workflow/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R36-01]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Known failures:**
  - `[R22-03] no file under skills, agents, or hooks names AGENTS.md` - owner P05
  - `[R29-01] Glossary defines all 28 canonical terms with Slice and Card separate` - owner P05
  - `[R30-03] prior Session files in .workflow/sessions/ remain untouched` - owner P05
- **Not expressible:**
  - Q-offline with the network physically disabled - needs an OS-level sandbox; S05 tests unreachable proxy variables plus the absence of network modules and `fetch` in the script
  - R36 clone vs zip on two machines - S05 compares a git checkout with a copy that has no `.git` on one machine
- **Gate:**
  - suite: `node --test --test-reporter=tap --test-skip-pattern="<node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/home-repo-workflow/phase-02.md --skip-pattern output>" "tests/home-repo-workflow/*.test.mjs" "tests/glossary-alignment/*.test.mjs" "tests/acceptance/*.test.mjs" "tests/mutation-addon.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node --test --test-reporter=tap "tests/home-repo-workflow/*.test.mjs" "tests/glossary-alignment/*.test.mjs" "tests/acceptance/*.test.mjs" "tests/mutation-addon.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs" | node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/home-repo-workflow/phase-02.md R36-01 R36-02 R36-03 R36-04 R36-05 R36-06 R36-07 R36-08 R36-09 R36-10 R36-11 R36-12 R36-13 R36-14 R36-15 R36-16 R36-17 R36-18 R36-19 R36-20 R37-01 R37-02 R37-03 R37-04 R37-05 R37-06 Q-version-identity Q-offline`
  - lock: `git diff --exit-code <Tests locked> -- tests/home-repo-workflow`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - Update installs and mirrors Workflow Core with a content version

- **Kind:** build
- **Goal:** the Update Script installs the mapped files into a git Home Repo, prints the three success lines, computes the Workflow version, and mirrors on rerun without touching other files.
- **Depends on:** none
- **Tier:** main - creates the script structure (install map, fingerprint, manifest) later cards extend
- **Review:** required - destructive file overwrite and delete; creates a shared structure
- **Scenarios:** fixture: a source tree (the real script copied to `<src>/scripts/update-home.mjs`, plus `.github/{skills/demo/SKILL.md, agents/demo.agent.md, agents/README.md, hooks/h.mjs, tools/t/run.mjs, tools/t/tests/x.test.mjs, user-interaction.md}`, `language-addons/stk/ad/SKILL.md`, `home/launch.mjs`) and an empty git repo `<home>` with a committed `AGENTS.md`
  - R36-01: Given the fixture, when `node <src>/scripts/update-home.mjs <home>` runs, then exit is 0 and stdout lines are exactly `Home Repo: <absolute home>`, `Workflow version: none -> <V>`, `Files: 7 installed, 0 replaced, 0 removed`, where `<V>` is 7 lowercase hex characters
  - R36-02: Given the fixture, when it runs, then these files exist with the source content: `.claude/skills/demo/SKILL.md`, `.claude/agents/demo.agent.md`, `.workflow-core/hooks/h.mjs`, `.workflow-core/tools/t/run.mjs`, `.workflow-core/user-interaction.md`, `.workflow-core/language-addons/stk/ad/SKILL.md`, `launch.mjs`; and `.claude/agents/README.md`, `.workflow-core/tools/t/tests/x.test.mjs` do not exist
  - R36-03: Given the fixture, when it runs, then `AGENTS.md` is byte-identical, `CLAUDE.md` and `.gitignore` do not exist
  - R36-04: Given the fixture, when `<V>` is recomputed as the first 7 hex of SHA-256 over, for each installed file sorted by Home path, the UTF-8 Home path, a 0x00 byte, the content with CRLF replaced by LF, and a 0x00 byte, then it equals the printed `<V>`
  - R36-05: Given R36-01 has run, when it runs again with the same source, then stdout shows `Workflow version: <V> -> <V>` and `Files: 0 installed, 0 replaced, 0 removed`
  - R36-06: Given R36-01 has run, when `.github/skills/demo/SKILL.md` content changes in the source and it runs, then `Workflow version: <V> -> <W>` with `<W>` different from `<V>`, `Files: 0 installed, 1 replaced, 0 removed`, and the installed file has the new content
  - R36-07: Given R36-01 has run and the source drops `.github/agents/demo.agent.md`, and `<home>/.claude/skills/my-own/SKILL.md` exists, when it runs, then `.claude/agents/demo.agent.md` is deleted, `Files:` ends with `1 removed`, and `my-own/SKILL.md` is byte-identical
  - R36-08: Given two sources whose only difference is CRLF vs LF line endings in `.github/skills/demo/SKILL.md`, when each runs against its own fresh Home Repo, then both print the same `<V>`
  - R36-09: Given the fixture, when it runs from `<other>` as the working folder, then the result equals R36-01 (the script locates its source itself)
- **Acceptance tests:** `tests/home-repo-workflow/p02-s01.test.mjs`
- **Files:** create `scripts/update-home.mjs`
- **Patterns:** `.github/hooks/scripts/guard-locked-tests.mjs:1 - Node ES-module script style, built-ins only`; `.github/skills/pull-work/scripts/glossary-check.mjs:1 - small CLI script that prints lines and sets the exit code`
- **Decisions:**
  - Source root is the parent of the script's folder. Install map, never-installed rules, and manifest shape are the phase header's.
  - Counts: `installed` = Home path not in the previous manifest and not an existing file; `replaced` = previously installed path whose content differs from the source; `removed` = previously installed path the new plan lacks. Unchanged files are rewritten but not counted. An existing unmanaged file at an installed path is overwritten and counts as `installed`.
  - Removing a file also removes its parent folders when they become empty, never above the Home Repo root.
  - `old` is the previous manifest's `version`, or `none` without a manifest. The manifest is written after copying with `status: complete` and the new version.
  - Copy order: sorted by Home path. Content is copied byte-for-byte; only the fingerprint normalizes CRLF.
  - Home path argument: `process.argv[2]`; the Home Repo is `resolve(arg)`. Validation categories are added by a later card; this card assumes a valid git Home Repo.
- **Do not:** edit `tests/home-repo-workflow/**`; run `git add` or `git commit` in the Home Repo; create or modify `AGENTS.md`, `CLAUDE.md`, or `.gitignore`; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R36-01 to R36-09; 9 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S02 - Update rejects unsafe or invalid targets before writing

- **Kind:** build
- **Goal:** each rejection category prints `update failed: <category>: <detail>`, exits 1, and changes nothing.
- **Depends on:** S01
- **Tier:** delegate - validation checks run before the S01 install code; categories and details are pinned
- **Review:** required - validates untrusted paths and guards against overwriting committed files
- **Scenarios:** fixture: the S01 fixture; "nothing changes" means `git status --porcelain` in `<home>` is unchanged, no manifest exists, and no installed path exists
  - R36-10: Given no argument, when it runs, then stdout starts with `update failed: missing-home-path:` and a later line starts with `usage: node scripts/update-home.mjs <home-repo-path>`, exit is 1 (failure)
  - R36-11: Given `<tmp>\nope` does not exist, when it runs against it, then stdout is `update failed: home-not-found: <tmp>\nope` and exit is 1; a path to a file gives the same category (failure)
  - R36-12: Given `<tmp>\plain` is an existing folder that is not a git repository, when it runs, then stdout is `update failed: home-not-git: <absolute path>`; given a sub-folder of a git repo, the same category (failure)
  - R36-13: Given the argument is the source root, or a folder inside it, when it runs, then stdout is `update failed: home-is-source: <absolute path>` and nothing is written (failure)
  - R36-14: Given `<home>/AGENTS.md` contains a line `- Stack: csharp`, when it runs, then stdout is `update failed: home-is-project: <home>/AGENTS.md` and nothing is written; a Home `AGENTS.md` without a `Stack:` line installs normally (failure)
  - R36-15: Given a source with no `language-addons/` folder, when it runs, then stdout is `update failed: incomplete-source: language-addons` and nothing is written; likewise for a missing `.github/skills` (failure)
  - R36-16: Given `<home>` has `.claude/skills/demo/SKILL.md` committed, when it runs, then stdout is `update failed: tracked-workflow-files: .claude/skills/demo/SKILL.md` (several paths joined by `, `, sorted) and nothing is written (failure)
- **Acceptance tests:** `tests/home-repo-workflow/p02-s02.test.mjs`
- **Files:** edit `scripts/update-home.mjs`
- **Patterns:** `scripts/update-home.mjs:1 - S01's entry point; add a validate step before any write`
- **Decisions:**
  - Check order: `missing-home-path`, `home-not-found`, `home-is-source` (compare `realpathSync` of both, case-insensitive on `win32`; equal or inside), `home-not-git` (`git -C <path> rev-parse --show-toplevel` must resolve to the same real path), `home-is-project` (a line matching `/^\s*(?:[-*]\s+)?Stack:/m` in `<home>/AGENTS.md`), `incomplete-source` (any of `.github/skills`, `.github/agents`, `.github/hooks`, `.github/tools`, `language-addons` missing; detail names the first missing path), `tracked-workflow-files`.
  - `tracked-workflow-files`: `git -C <home> ls-files -z` filtered to the planned Home paths (previous manifest paths included); detail is the sorted list joined by `, `.
  - `home-not-found` detail is the argument as given; the other details are absolute paths. Failure lines go to stdout; exit code 1.
  - Failure is a function that returns `{category, detail}`; the CLI prints it and exits 1 before any write.
- **Do not:** edit `tests/home-repo-workflow/**`; change the success output lines; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R36-10 to R36-16; 7 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S03 - A failed write leaves an incomplete marker

- **Kind:** build
- **Goal:** a write failure prints `copy-failed` naming the path and marks the manifest incomplete until a rerun succeeds.
- **Depends on:** S02
- **Tier:** delegate - one error path in the S01 copy loop; manifest shape is pinned
- **Review:** required - destructive file operations and recovery state
- **Scenarios:** fixture: the S01 fixture where `<home>/.workflow-core/user-interaction.md` is an existing non-empty folder (a write there fails)
  - R36-17: Given the fixture, when it runs, then stdout's last line is `update failed: copy-failed: .workflow-core/user-interaction.md`, exit is 1 (failure)
  - R36-18: Given the R36-17 run, when `manifest.json` is read, then `status` is `incomplete` (failure)
  - R36-19: Given the R36-17 run and the blocking folder removed, when it runs again, then exit is 0, `status` is `complete`, and `version` equals `<V>` from a clean install of the same source
  - R36-20: Given a complete install at `<V>` and a later run that fails with `copy-failed`, when `manifest.json` is read, then `version` is still `<V>` and the next successful run prints `Workflow version: <V> -> <new>`
- **Acceptance tests:** `tests/home-repo-workflow/p02-s03.test.mjs`
- **Files:** edit `scripts/update-home.mjs`
- **Patterns:** `scripts/update-home.mjs:1 - S01's copy loop and manifest write`
- **Decisions:**
  - Before the first write, write the manifest with `status: incomplete`, the previous `version`, and `files` = sorted union of previous and planned paths. After the last write and deletion, write the final manifest (`complete`, new version, planned paths).
  - A thrown error in copy or delete prints `update failed: copy-failed: <home-relative path with / separators>` and exits 1; the incomplete manifest stays.
- **Do not:** edit `tests/home-repo-workflow/**`; change validation order or success output; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R36-17 to R36-20; 4 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S04 - Installed files stay out of git status

- **Kind:** build
- **Goal:** installed files are hidden through `.git/info/exclude`, so `git status --porcelain` is identical before and after any run.
- **Depends on:** S03
- **Tier:** delegate - one managed block in one file; its format is pinned
- **Review:** required - edits repository git metadata
- **Scenarios:** fixture: the S01 fixture
  - R37-01: Given a clean Home Repo with no `.gitignore`, when it runs, then `git status --porcelain` is empty and `.gitignore` does not exist
  - R37-02: Given a Home Repo with an untracked `notes.txt` and a modified `AGENTS.md`, when it runs, then `git status --porcelain` output before and after is identical
  - R37-03: Given `<home>/.claude/skills/my-own/SKILL.md` untracked, when it runs twice, then `git status --porcelain` lists `my-own` both times (only installed files are hidden)
  - R37-04: Given `.git/info/exclude` with a user line `*.log`, when it runs twice, then `*.log` stays and `.git/info/exclude` holds exactly one begin/end block
  - R37-05: Given a later source dropping a file, when it runs, then the dropped path no longer appears in `.git/info/exclude`
  - R37-06: Given it runs, when `git ls-files` in the Home Repo is read, then it is unchanged and no commit exists beyond the original (the Update Script does not commit)
- **Acceptance tests:** `tests/home-repo-workflow/p02-s04.test.mjs`
- **Files:** edit `scripts/update-home.mjs`
- **Patterns:** `scripts/update-home.mjs:1 - S01's final manifest write; add the exclude write next to it`
- **Decisions:**
  - Exclude file path: `git -C <home> rev-parse --git-path info/exclude`, resolved against the Home Repo; create `info/` if missing.
  - Managed block: a line `# personal-workflow:begin`, one line `/<home-relative path>` per installed file (sorted, no wildcards), a line `# personal-workflow:end`. Replace an existing block; otherwise append after a newline. Lines outside the block are preserved byte-for-byte.
  - The block is written after copying, in the same step as the final manifest.
- **Do not:** edit `tests/home-repo-workflow/**`; create or edit `.gitignore`; run any git command that stages or commits; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R37-01 to R37-06; 6 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S05 - Version identity and offline operation hold on this repository

- **Kind:** verify
- **Goal:** the real source yields the same Workflow version from a git checkout and a git-free copy, and the script needs no network.
- **Depends on:** S04
- **Tier:** delegate - verification only; no product change expected
- **Review:** none
- **Scenarios:**
  - Q-version-identity: Given this repository and a copy of its tracked files (`git ls-files`) in a temp folder with no `.git` and CRLF line endings in every text file, when the Update Script of each runs against its own fresh Home Repo, then both print the same `Workflow version: none -> <V>` and `Files:` line
  - Q-offline: Given `HTTP_PROXY`, `HTTPS_PROXY`, and `ALL_PROXY` set to `http://127.0.0.1:9`, `GIT_TERMINAL_PROMPT=0`, when the Update Script runs on this repository, then exit is 0 and the three success lines print; and `scripts/update-home.mjs` contains no import of `node:http`, `node:https`, `node:net`, `node:dns`, `node:tls`, `node:dgram` (also without the `node:` prefix) and no `fetch(`
- **Acceptance tests:** `tests/home-repo-workflow/p02-s05.test.mjs`
- **Files:** none
- **Patterns:** `tests/home-repo-workflow/p02-s01.test.mjs:1 - fixture helpers for a Home Repo`
- **Decisions:** a failure here means S01-S04 produced an unstable version or a network dependency; the fix is a `fix` card from Triage.
- **Do not:** edit any file; edit `tests/home-repo-workflow/**`.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets Q-version-identity, Q-offline; 2 target tests run
- **Stop and report if:** the targets fail on first run; a locked test looks wrong.
