# P06 - /apply-observation

- **Outcome:** In `Personal.Workflow` under the Home layout, `/apply-observation` offers confirmed `part change` Observations, confirms edits in one STE Checkpoint, checks `workflow-check` and all suites before committing each pick, installs once via `scripts/update-home.mjs`, records the install and updates the Ledger in the Home Repo, and supports `/apply-observation undo O<n>`.
- **Covers:** R68, R69, R70, R71, R72, R73, Q-ste (R69/R72 statements)
- **Invariants:**
  - ES modules (`.mjs`), Node built-ins only, no dependencies, no network modules and no `fetch`.
  - Code in `.github/tools/skill-review/src/`; `cli.mjs` `main(argv, env, cwd)` returns `{lines, code}`. Failure for `apply-observation` subcommands is one stdout line `apply-observation failed: <category>: <detail>`, exit 1, nothing written in either repo.
  - Use `compareIds` / `idText` from `observations.mjs` for Observation IDs; use `readRecord` / `writeRecord` from `record.mjs` for the Review Record; use `writeLedger` from `ledger.mjs` for the Ledger.
  - `Personal.Workflow` root check: `cwd` holds both `scripts/update-home.mjs` and `language-addons/`.
  - `dirty-tree` check: `git status --porcelain` in `cwd` is empty.
  - Tests read stable markers only: output lines, record files, `git status --porcelain`, `git log`, and fixed text in `.github/skills/apply-observation/SKILL.md`.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" "tests/skill-review/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R68-01]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Not expressible:**
  - R68 interactive subset pick, R69 interactive Checkpoint, and R72 interactive undo approval: live model interaction and STE compliance of model-generated prose cannot be tested deterministically; S06 tests the stable markers in `.github/skills/apply-observation/SKILL.md`.
- **Gate:**
  - suite: `node --test --test-reporter=tap "tests/**/*.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node --test --test-reporter=tap "tests/skill-review/*.test.mjs" | node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/skill-review/phase-06.md <scenario IDs of S02-S06>`
  - lock: `git diff --exit-code <Tests locked> -- tests/skill-review`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - Fix glossary-size baseline

- **Kind:** setup
- **Goal:** Bring `.workflow/language.md` within the 40-term cap so `tests/glossary-alignment/p01-s01.test.mjs` and `workflow-check` pass with zero Glossary findings before P06 test authoring and `apply-check` run.
- **Depends on:** none
- **Tier:** main - setup card adjusting `.workflow/language.md`
- **Review:** required - no mutation gate
- **Files:** edit `.workflow/language.md`
- **Patterns:** `.workflow/language.md:1 - Glossary format (## Terms and ## Retired)`
- **Decisions:**
  - Move at least 7 secondary Terms (not required by `glossary-alignment` R29 or `home-repo-workflow` / `skill-review` specs) from `## Terms` to `## Retired` so `## Terms` has at most 40 entries.
  - Keep all 13 terms required by `tests/glossary-alignment/p01-s01.test.mjs` and `Language Add-on` with `Code: language-addons/`.
- **Do not:** edit `tests/glossary-alignment/**` or `.github/tools/workflow-check/**`; change any spec or session file.
- **Done when:** `node --test --test-reporter=tap tests/glossary-alignment/p01-s01.test.mjs` exits 0 with 7 passing tests.
- **Stop and report if:** fewer than 7 Terms can be retired without breaking another suite; the same failure after 3 attempts.

## S02 - Offer confirmed part changes (`apply-list`)

- **Kind:** build
- **Goal:** `skill-review apply-list` validates Home layout, `Personal.Workflow` root, clean git tree, and readable Review Record, then lists confirmed `part change` Observations in `## Next` wording or prints `apply-observation: nothing to apply`.
- **Depends on:** S01
- **Tier:** main - creates `apply.mjs` and the shared pre-flight and failure helpers that S03-S05 build on
- **Review:** required - creates a shared structure later cards build on; no mutation gate
- **Scenarios:** fixture: `<home>` and `<proj>` (`Personal.Workflow`-like git repo with `scripts/update-home.mjs` and `language-addons/`), `WORKFLOW_HOME=<home>`
  - R68-01: Given `O03` (`confirmed`, `part change`, `pull-work`, `fixType: clarified rule`) and `O04` (`watching`), when `apply-list` runs, then stdout lists `O03` formatted as `- O03 pull-work: <desc> Fix type: clarified rule.` and exits 0
  - R68-02: Given `changed`, `improved`, `dismissed` Observations and a `confirmed` `Developer note` Observation, when `apply-list` runs, then none of them appear in stdout
  - R68-03: Given no `confirmed` `part change` Observation, when `apply-list` runs, then stdout is `apply-observation: nothing to apply` and exit code is 0
  - R68-04: Given `WORKFLOW_HOME` unset or missing, when `apply-list` runs, then stdout is `apply-observation failed: home-layout-required: start the Harness with the Launch Script` and exit code is 1 (failure)
  - R68-05: Given uncommitted changes in `<proj>`, when `apply-list` runs, then stdout starts with `apply-observation failed: dirty-tree:` listing the dirty paths and exit code is 1 (failure)
  - R68-06: Given an unreadable `review-record.json`, when `apply-list` runs, then stdout starts with `apply-observation failed: records-unreadable:` naming the file and exit code is 1 (failure)
  - R73-01: Given `<proj>` lacks `scripts/update-home.mjs` or `language-addons/`, when `apply-list` runs, then stdout is `apply-observation failed: not-personal-workflow: run it in Personal.Workflow` and exit code is 1 (failure)
- **Acceptance tests:** `tests/skill-review/p06-s02.test.mjs`
- **Files:** create `.github/tools/skill-review/src/apply.mjs`; edit `.github/tools/skill-review/src/cli.mjs`; edit `.github/tools/skill-review/src/summary.mjs`
- **Patterns:** `.github/tools/skill-review/src/installs.mjs:9 - fail() and loadRecord()`; `.github/tools/skill-review/src/summary.mjs:59 - ## Next part change formatting`
- **Decisions:**
  - Export `formatNextPartChange(o)` from `summary.mjs` returning `- ${o.id} ${o.part}: ${desc} Fix type: ${o.fixType}.` (matching `sectionBodies`).
  - `apply.mjs` exports `preflight(env, cwd)` returning `{home, record}` or `{failure}`: checks `homeFor(env)` -> `home-layout-required`; `existsSync(join(cwd, 'scripts', 'update-home.mjs')) && existsSync(join(cwd, 'language-addons'))` -> `not-personal-workflow`; `git status --porcelain` non-empty -> `dirty-tree: <comma-separated paths>`; `readRecord(home)` -> `records-unreadable`.
  - `cli.mjs` routes `apply-list` to `applyList(rest, env, cwd)`.
  - `applyList` sorts matching Observations with `compareIds`.
- **Do not:** edit `tests/skill-review/**`; add dependencies; modify any file in `cwd` or `home`.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R68-01 to R68-06, R73-01; 7 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S03 - Check and restore failed pick (`apply-check`)

- **Kind:** build
- **Goal:** `skill-review apply-check <O-id>` runs `workflow-check` and every acceptance and unit suite in `Personal.Workflow`, restoring the working tree and printing `check-failed: <O-id>: <reason>` on failure.
- **Depends on:** S02
- **Tier:** delegate - adds `applyCheck` in `apply.mjs` and routes it in `cli.mjs`
- **Review:** required - performs destructive work (restores working tree); spawns processes
- **Scenarios:** fixture: S02's `<proj>` with `workflow-check` script and `tests/sample.test.mjs`
  - R70-01: Given a clean edit to `<proj>` where `workflow-check` and all suites pass, when `apply-check O03` runs, then exit code is 0 and the edit remains on disk
  - R70-02: Given an edit that causes `workflow-check` to exit non-zero, when `apply-check O03` runs, then stdout starts with `check-failed: O03:`, exit code is 1, and `git status --porcelain` in `<proj>` is empty (failure)
  - R70-03: Given an edit that causes a suite test to fail, when `apply-check O03` runs, then stdout starts with `check-failed: O03:`, exit code is 1, and `git status --porcelain` in `<proj>` is empty (failure)
- **Acceptance tests:** `tests/skill-review/p06-s03.test.mjs`
- **Files:** edit `.github/tools/skill-review/src/apply.mjs`; edit `.github/tools/skill-review/src/cli.mjs`
- **Patterns:** `.github/tools/skill-review/src/cli.mjs:57 - spawnSync with cwd and encoding utf8`
- **Decisions:**
  - `applyCheck(args, env, cwd)` checks `preflight` excluding `dirty-tree` (since an edit is on disk), requires `<O-id>` argument.
  - Runs `node .github/tools/workflow-check/bin/workflow-check.mjs` in `cwd`.
  - Discovers all `*.test.mjs` files recursively under `tests/`, `.github/tools/workflow-check/tests/`, and `.github/tools/workflow-core/tests/` (skipping non-existent roots) and runs `node --test --test-reporter=tap <files>` in `cwd`. (Use `SKILL_REVIEW_CHECK_GLOB` override only if needed? No: real recursive discovery works in both `<proj>` fixtures and `Personal.Workflow`!)
  - On any non-zero status, runs `git checkout -- .` and `git clean -fd` in `cwd`, returns `{ lines: ['check-failed: <O-id>: <workflow-check failed | test suite failed>'], code: 1 }`.
- **Do not:** edit `tests/skill-review/**`; commit anything; use shell strings for git or node.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R70-01 to R70-03; 3 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S04 - Mark changed, install, and commit Home Repo (`apply-finish`)

- **Kind:** build
- **Goal:** `skill-review apply-finish <O-id>:<commit>...` marks each pick `changed`, runs `scripts/update-home.mjs` once (when >= 1 pick), records the install, rewrites `ledger.md`, and commits `skill-review/` in the Home Repo.
- **Depends on:** S02
- **Tier:** delegate - reuses `markChanged`, `recordInstall`, `writeLedger`, and `commit`
- **Review:** required - runs git operations and spawns `scripts/update-home.mjs`
- **Scenarios:** fixture: S02's `<home>` (git repo) and `<proj>` with committed picks and `scripts/update-home.mjs`
  - R70-04: Given picks `O03:<c1>` and `O05:<c2>` committed in `<proj>`, when `apply-finish O03:<c1> O05:<c2>` runs, then `O03` and `O05` are `changed` with their commits, `ledger.md` is rewritten, and `<home>` has a new commit with message `docs(skill-review): apply O03, O05`
  - R71-01: Given `scripts/update-home.mjs` prints `Workflow version: 3f9a2c1 -> 7e8d9f0`, when `apply-finish O03:<c1>` runs, then the newest install record in `review-record.json` has `version: "7e8d9f0"` and `source` equal to `<proj>` `HEAD` (7-char), and full Update Script output is printed
  - R71-02: Given `apply-finish` with 0 picks, when it runs, then `scripts/update-home.mjs` does not run and nothing is committed in `<home>` (boundary)
  - R71-03: Given `scripts/update-home.mjs` exits 1, when `apply-finish O03:<c1>` runs, then its output is printed, `O03` stays `changed` (`changed, not yet installed` in `ledger.md`), no install record is added, and `<home>` still commits `docs(skill-review): apply O03` (failure)
- **Acceptance tests:** `tests/skill-review/p06-s04.test.mjs`
- **Files:** edit `.github/tools/skill-review/src/apply.mjs`; edit `.github/tools/skill-review/src/cli.mjs`
- **Patterns:** `.github/tools/skill-review/src/installs.mjs:30 - markChanged and recordInstall`; `.github/tools/skill-review/src/commit.mjs:38 - staging and committing skill-review/ in Home Repo`
- **Decisions:**
  - `applyFinish(args, env, cwd)` checks `preflight` (clean tree). If `args.length === 0`, prints `apply-observation: nothing to apply` and exits 0.
  - Parses `<O-id>:<commit>` pairs, sorts by `compareIds`, calls `markChanged([id, commit], env)` for each.
  - Runs `node scripts/update-home.mjs <home>` in `cwd`, captures and prints all stdout/stderr lines.
  - If Update Script exits 0 and stdout matches `/Workflow version:\s+\S+\s+->\s+([0-9a-f]{7})/m`, reads `<proj>` `HEAD` (`git rev-parse --short=7 HEAD`) and calls `recordInstall([newVersion, head], env, cwd)`.
  - Rewrites `<home>/skill-review/ledger.md` using `renderLedger(readRecord(home))`, stages `skill-review/` in `home`, and commits with `docs(skill-review): apply <sorted IDs joined by ', '>`.
- **Do not:** edit `tests/skill-review/**`; modify `<proj>` files or git history.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R70-04, R71-01 to R71-03; 4 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S05 - Undo applied Observation (`undo-check` and `undo`)

- **Kind:** build
- **Goal:** `skill-review undo-check <O-id>` validates an undo target, and `skill-review undo <O-id>` reverts its commit, sets it `confirmed`, runs the Update Script, updates records, and commits the Home Repo.
- **Depends on:** S02
- **Tier:** delegate - adds `undoCheck` and `undo` in `apply.mjs` and routes them in `cli.mjs`
- **Review:** required - performs destructive work (`git revert`) and spawns `scripts/update-home.mjs`
- **Scenarios:** fixture: S04's `<home>` and `<proj>` with `O03` (`changed`, `changeCommit: <c1>`) and `O05` (`changed`, `changeCommit: <c2>`)
  - R72-01: Given `O03` and `O05` applied on disjoint files, when `undo O03` runs, then `<proj>` has a new commit `revert(<part>): undo O03`, `O03` is `confirmed` with `changeCommit: null`, `O05` is untouched, Update Script ran and added an install record, and `<home>` has commit `docs(skill-review): undo O03`
  - R72-02: Given `O99` does not exist, when `undo-check O99` or `undo O99` runs, then stdout is `apply-observation failed: unknown-observation: O99` and exit code is 1 (failure)
  - R72-03: Given `O04` has `changeCommit: null`, when `undo-check O04` or `undo O04` runs, then stdout is `apply-observation failed: not-applied: O04` and exit code is 1 (failure)
  - R72-04: Given a later commit edited the same lines as `<c1>`, when `undo O03` runs, then stdout starts with `apply-observation failed: revert-conflict:` naming the conflicting files, exit code is 1, and both `<proj>` and `<home>` are unchanged (failure)
  - R72-05: Given uncommitted changes in `<proj>`, when `undo-check O03` or `undo O03` runs, then stdout starts with `apply-observation failed: dirty-tree:` and both repos are unchanged (failure)
- **Acceptance tests:** `tests/skill-review/p06-s05.test.mjs`
- **Files:** edit `.github/tools/skill-review/src/apply.mjs`; edit `.github/tools/skill-review/src/cli.mjs`
- **Patterns:** `.github/tools/skill-review/src/apply.mjs:1 - preflight and fail helpers`
- **Decisions:**
  - Both `undoCheck` and `undo` run `preflight(env, cwd)`, then look up `obs` by `id`: missing -> `unknown-observation: <id>`; `!obs.changeCommit` -> `not-applied: <id>`. `undoCheck` prints `undo-ready: <id> <obs.part> <obs.changeCommit>` and exits 0.
  - `undo` runs `git revert --no-commit <obs.changeCommit>` in `cwd`. If status !== 0, reads conflicted files from `git diff --name-only --diff-filter=U`, runs `git revert --abort` (or `git reset --hard HEAD`), and fails `revert-conflict: <files>`.
  - On clean revert, commits in `cwd` with `revert(${obs.part}): undo ${obs.id}`.
  - Sets `obs.state = 'confirmed'`, `obs.chances = 0`, `obs.changeCommit = null`, writes `review-record.json`.
  - Runs `node scripts/update-home.mjs <home>`, records install if exit 0, rewrites `ledger.md`, commits `skill-review/` in `home` with `docs(skill-review): undo ${obs.id}`.
- **Do not:** edit `tests/skill-review/**`; touch other Observations or commits.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R72-01 to R72-05; 5 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S06 - `/apply-observation` skill

- **Kind:** build
- **Goal:** Create `.github/skills/apply-observation/SKILL.md` so `/apply-observation` orchestrates pre-flight, one STE Checkpoint before any edit, ID-order apply/check/commit, single Update Script install, and `/apply-observation undo O<n>`.
- **Depends on:** S02, S03, S04, S05
- **Tier:** main - authors the Workflow Core skill prose and STE/Checkpoint contract
- **Review:** required - no mutation gate
- **Scenarios:** fixture: `.github/skills/apply-observation/SKILL.md`
  - R69-01: Given `SKILL.md`, when inspected, then it has `Question rules: follow .github/user-interaction.md.`, the `Core paths:` line, calls `apply-list`, and requires one `## Checkpoint` before any edit showing per pick in STE: part, change summary, and Observation
  - R70-05: Given `SKILL.md`, when inspected, then it instructs applying approved picks in ID order, running `apply-check`, committing each pick with `conventional-commit` scope `<part>` and subject ending `(O<n>)`, and finishing with `apply-finish`
  - R72-06: Given `SKILL.md`, when inspected, then it documents `undo O<n>` calling `undo-check`, stating in STE the part, commit, and Observation and waiting for approval, then calling `undo`
  - Q-ste-apply: Given `SKILL.md`, when inspected, then it states STE limits (at most 25 words per sentence, at most 6 sentences per paragraph) for R69 and R72 statements
- **Acceptance tests:** `tests/skill-review/p06-s06.test.mjs`
- **Files:** create `.github/skills/apply-observation/SKILL.md`
- **Patterns:** `.github/skills/conventional-commit/SKILL.md:1 - frontmatter, Question rules, Core paths`; `.github/skills/skill-review/SKILL.md:1 - CLI steps and Failures`
- **Decisions:**
  - Frontmatter: `name: apply-observation`, `argument-hint: "[undo O<n>]"`, `user-invocable: true`.
  - Runs `node "$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs" <subcommand>`.
- **Do not:** edit `tests/skill-review/**`; edit `skill-review/SKILL.md`; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R69-01, R70-05, R72-06, Q-ste-apply; 4 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.
