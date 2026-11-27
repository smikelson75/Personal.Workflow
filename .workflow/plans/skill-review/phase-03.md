# P03 - Finish: Observations, lifecycle, installs, Review Record

- **Outcome:** `skill-review finish <compact-record> <judgement-file>` turns the model's judged cases into Observations, runs the lifecycle, and writes the Review Record at the end. `skill-review mark-changed` and `skill-review record-install` keep the change commits and install records. No Executive Summary, Ledger, or commit yet (P04).
- **Covers:** R54 (write side), R57 (validation of kinds, outcomes, Fix Filter), R58, R59 (tracking and notice; the Ledger wording belongs to P04), R61
- **Invariants:**
  - ES modules (`.mjs`), Node built-ins only, no dependencies, no network modules and no `fetch`.
  - Code in `.github/tools/skill-review/src/`; `cli.mjs` `main(argv, env, cwd)` returns `{lines, code}`. Failure is one stdout line `skill-review failed: <category>: <detail>`, exit 1, and nothing is written.
  - Home layout means `WORKFLOW_HOME` is set to an existing folder (the Home Repo); otherwise `skill-review failed: home-layout-required: start the Harness with the Launch Script`.
  - The Review Record is `<Home Repo>\skill-review\review-record.json`, `format` 1, written only by `finish`, `mark-changed`, and `record-install`, atomically (temp file in the same folder, then rename), as `JSON.stringify(record, null, 2) + '\n'`.
  - Now is `env.SKILL_REVIEW_NOW` (an ISO time) when set, else the current time.
  - The model never opens a Conversation Log; `finish` reads a Log only for its first `timestamp`.
  - Tests read stable markers only: output lines, JSON files, `git status --porcelain`.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" "tests/skill-review/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R54-05]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Known failures:**
  - `[R29-01] Glossary defines the 13 added terms with Slice and Card separate` - owner P06
  - `[Q-zero-workflow-check-errors] workflow-check passes on repo .workflow/ with zero errors and no Glossary findings` - owner P06
- **Not expressible:**
  - R57 "each skill use is judged on four kinds" and R58 "the run matches a case to an Observation" - model judgements; the tests check that `finish` rejects an unknown kind, outcome, or Observation ID and that it applies the lifecycle to what the model decides. The `skill-review` skill (P05) tells the model how to judge.
  - R59 "the Ledger shows `changed, not yet installed`" - the Ledger is written in P04; P03 tests the install records it reads.
- **Gate:**
  - suite: `node --test --test-reporter=tap --test-skip-pattern="<node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/skill-review/phase-03.md --skip-pattern output>" "tests/**/*.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node --test --test-reporter=tap "tests/skill-review/*.test.mjs" | node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/skill-review/phase-03.md <scenario IDs of S01-S05>`
  - lock: `git diff --exit-code <Tests locked> -- tests/skill-review`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - finish writes the reviewed Positions

- **Kind:** build
- **Goal:** `finish` validates its inputs and records, per Conversation and skill, the last reviewed Position, writing the Review Record only at the end.
- **Depends on:** none
- **Tier:** main - creates `finish.mjs` and the Review Record writer that S02-S05 extend
- **Review:** required - creates a shared structure; defines a persisted format; no mutation gate
- **Scenarios:** fixture: `<home>` is a git repo with `.claude/skills/{pull-work,brain-storm,skill-review}/SKILL.md`; `<proj>` is a git repo; the CLI runs in `<proj>` with `WORKFLOW_HOME=<home>`; the compact record is a hand-written file `{"project","conversations":[{harness,id,file,uses:[{skill,start,end,from}]}]}`; the judgement file is `{"cases":[]}` unless stated
  - R54-05: Given Copilot `c1` use `pull-work` `{start:2,end:520,from:401}` and a Review Record with `"Copilot CLI:c1":{"pull-work":400}`, when `finish <compact> <judgement>` runs, then the last stdout line is `skill-review: reviewed 1 skill uses in 1 Conversations`, exit is 0, and the Review Record holds `"Copilot CLI:c1":{"pull-work":520}` and its other keys are unchanged
  - R54-06: Given no Review Record, Copilot `c1` uses `brain-storm` 2-9 and `pull-work` 10-20, and Claude `k1` use `pull-work` 2-6, when it runs, then the Review Record is `{"format":1,"conversations":{"Copilot CLI:c1":{"brain-storm":9,"pull-work":20},"Claude Code:k1":{"pull-work":6}},"handoffs":[],"observations":[],"installs":[],"nextObservation":1}`
  - R54-07: Given Copilot logs and `prepare` then `slice` run but `finish` not run, when `git status --porcelain` runs in `<home>`, then it is unchanged and `review-record.json` does not exist (failure: interrupted run)
  - R54-08: Given a Review Record with `pull-work` at 600 and a use ending at 520, when it runs, then the Position stays 600 (boundary)
  - R61-02: Given a Review Record and no `summaries` folder and no `ledger.md`, when it runs, then it exits 0 and `<home>/skill-review/` holds only `review-record.json`
  - R67-02: Given `WORKFLOW_HOME` unset, when it runs, then stdout is `skill-review failed: home-layout-required: start the Harness with the Launch Script`, exit is 1, and `<home>` is unchanged (failure)
  - R52-12: Given a Review Record `not json`, when it runs, then stdout is `skill-review failed: records-unreadable: <absolute path>` and the file is unchanged (failure)
  - R52-13: Given a missing compact record file, when it runs, then stdout is `skill-review failed: record-unreadable: <path as given>` (failure)
  - R52-14: Given a judgement file that is not JSON or has no `cases` array, when it runs, then stdout is `skill-review failed: judgement-unreadable: <path as given>` and nothing is written (failure)
  - R52-15: Given `finish` with one argument, when it runs, then stdout is `skill-review failed: usage: skill-review finish <compact-record-file> <judgement-file>` (failure)
- **Acceptance tests:** `tests/skill-review/p03-s01.test.mjs`
- **Files:** create `.github/tools/skill-review/src/finish.mjs`; edit `.github/tools/skill-review/src/record.mjs`; edit `.github/tools/skill-review/src/cli.mjs`
- **Patterns:** `.github/tools/skill-review/src/slice.mjs:1 - argument check, fail function, temp file plus rename`; `.github/tools/skill-review/src/cli.mjs:1 - home-layout check and readRecord use`
- **Decisions:**
  - `cli.mjs` routes `finish` to `finish(args, env, cwd)` in `finish.mjs`, which returns `{lines, code}`. Check order: usage, home layout, Review Record, compact record, judgement file.
  - `record.mjs` gains `writeRecord(homePath, record)` (atomic, creates `<home>/skill-review/`) and `homeFor(env)` (the `WORKFLOW_HOME` path when it is an existing folder, else `null`).
  - The compact record is read with `JSON.parse`; a missing or unparseable file, or one without a `conversations` array, is `record-unreadable`. The judgement is `{cases: [...]}`; anything else is `judgement-unreadable`. The detail is the path argument exactly as given.
  - For each use of each Conversation, the Position at `conversations["<harness>:<id>"][<skill>]` becomes `max(existing, use.end)`.
  - The output holds one line `skill-review: reviewed <uses> skill uses in <conversations> Conversations` (counts from the compact record). `finish` ignores `cases` in this card.
- **Do not:** edit `tests/skill-review/**`; write any file except `review-record.json`; read Conversation Logs; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R54-05 to R54-08, R61-02, R67-02, R52-12 to R52-15; 10 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S02 - Cases become Observations

- **Kind:** build
- **Goal:** each judged case adds to a new or existing Observation; Observations confirm at 2 cases; kind, outcome, and Fix Filter are checked.
- **Depends on:** S01
- **Tier:** main - creates `observations.mjs` (the Observation data model and case rules) that S03-S05 extend
- **Review:** required - creates a shared structure; defines a persisted format; no mutation gate
- **Scenarios:** fixture: S01's fixture; the compact record holds Copilot `c1` use `pull-work` `{start:2,end:20,from:2}`. Case `K`: `{"ref":"a","match":null,"conversation":"Copilot CLI:c1","line":5,"part":"pull-work","kind":"rule adherence","label":null,"side":null,"area":null,"outcome":"part change","cause":null,"model":null,"fixType":"clarified rule","fixReason":"A check cannot find this.","description":"The skill asked the same question twice."}`
  - R58-01: Given the judgement `{cases:[K]}`, when `finish` runs, then stdout has `observation: O01 new`, and the Review Record has one Observation `{id:"O01", part:"pull-work", state:"watching", kind:"rule adherence", cases:1, chances:0, outcome:"part change", fixType:"clarified rule"}` and `nextObservation` is 2
  - R58-02: Given `{cases:[K, K with line 9]}` (same `ref`), when it runs, then one Observation `O01` is `confirmed` with `cases` 2, and the lines `observation: O01 new` then `observation: O01 confirmed` appear in that order
  - R58-03: Given a Review Record from R58-01, and `{cases:[M, M]}` where `M` is `{"match":"O01","conversation":"Copilot CLI:c1","line":6}` and `{"match":"O01","conversation":"Copilot CLI:c1","line":7}`, when it runs, then O01 is `confirmed` with `cases` 3; and a single run of `{cases:[K, K, K]}` with lines 5, 6, 7 gives an Observation with the same `state`, `cases`, `kind`, and `part` (order independence)
  - R58-04: Given `{cases:[{"match":"O09","conversation":"Copilot CLI:c1","line":5}]}`, when it runs, then stdout is `skill-review failed: judgement-invalid: case 1: unknown observation O09` and the Review Record is unchanged (failure)
  - R58-05: Given a Review Record with `nextObservation` 5 and `{cases:[K]}`, when it runs, then the new Observation is `O05` and `nextObservation` is 6 (boundary)
  - R57-01: Given `K` with `kind` `boring`, when it runs, then stdout is `skill-review failed: judgement-invalid: case 1: unknown kind "boring"` (failure)
  - R57-02: Given `K` with `fixType` null, and given `K` with `fixType` `new prose` and `fixReason` empty, when it runs, then each stdout is `skill-review failed: judgement-invalid: case 1: fix filter missing` (failure)
  - R57-03: Given `K` with `kind` `Developer contribution`, `outcome` `Developer note`, and no `fixType`, when it runs, then the Observation has `outcome` `Developer note`
  - R57-04: Given `K` with `outcome` `no action` and `cause` null, when it runs, then stdout is `skill-review failed: judgement-invalid: case 1: cause missing` (failure)
  - R57-05: Given `K` with `outcome` `maybe`, when it runs, then stdout is `skill-review failed: judgement-invalid: case 1: unknown outcome "maybe"` (failure)
  - R54-10: Given the compact use `{start:2,end:20,from:11}` and `K` at line 5, when it runs, then stdout is `skill-review failed: judgement-invalid: case 1: line 5 is not in a new Position` and the Review Record is unchanged (failure)
- **Acceptance tests:** `tests/skill-review/p03-s02.test.mjs`
- **Files:** create `.github/tools/skill-review/src/observations.mjs`; edit `.github/tools/skill-review/src/finish.mjs`
- **Patterns:** `.github/tools/skill-review/src/finish.mjs:1 - the S01 finish flow and its fail function`
- **Decisions:**
  - Case fields: `ref`, `match`, `conversation` (`<Harness>:<id>`), `line`, `part`, `kind`, `label`, `side`, `area`, `outcome`, `cause`, `model`, `fixType`, `fixReason`, `description`. A case with `match` set needs only `conversation` and `line`; a case with `match` null needs `ref`, `part`, `outcome`, `description`, and exactly one of `kind` or `label`.
  - Kinds: `rule adherence`, `Developer contribution`, `growth without payoff`, `token cost`. Labels: `capture miss`, `decomposition miss`, `translation miss`, `requirements miss`. Outcomes: `part change`, `Developer note`, `no action`. Fix types: `check or script`, `clarified rule`, `removed rule`, `new prose`.
  - Check order for case `n` (1-based): `conversation` is in the compact record, `line` is in `from..end` of one of its uses (else `line <line> is not in a new Position`), then for `match` null: `ref` and `part` present, `kind` or `label` known, outcome known, `fix filter missing` (outcome `part change` with a `fixType` not in the list or an empty `fixReason`), `cause missing` (outcome `no action` with an empty `cause`); for `match` set: the ID exists in the Review Record (`unknown observation <id>`). Any failure stops the run and writes nothing.
  - Cases with the same `ref` and `match` null make one Observation, whose fields come from the first of them. An Observation is `{id, part, state, kind, label, side, area, outcome, cause, model, fixType, fixReason, description, cases, chances, changeCommit, follows}`; absent fields are `null`, `chances` starts at 0. IDs are `O` plus the number from `nextObservation`, at least 2 digits; the counter then increases by 1.
  - Every case adds 1 to `cases`. A `watching` Observation becomes `confirmed` when `cases` reaches 2. Stdout lines `observation: <id> <event>`, events `new`, `case` (a case on an existing Observation), `confirmed`, in Observation ID order and event order, before the `reviewed` line.
- **Do not:** edit `tests/skill-review/**`; handle dismissal, requirements miss, or changed Observations (S03-S05); add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R58-01 to R58-05, R57-01 to R57-05, R54-10; 11 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S03 - Dismissal, requirements miss, question gap

- **Kind:** build
- **Goal:** an Observation is dismissed only for a model habit or a Harness limit; a requirements miss stays watching under its area; two cases in one area make one confirmed `question gap` Observation.
- **Depends on:** S02
- **Tier:** delegate - extends the S02 case rules; every state change is pinned
- **Review:** required - test literal in product code
- **Scenarios:** fixture: S02's fixture and case `K`
  - R58-06: Given `K` with `outcome` `no action`, `cause` `model habit`, `model` `gpt-5.5`, when `finish` runs, then the Observation is `dismissed` with `cause` `model habit` and `model` `gpt-5.5`, and stdout has `observation: O01 new` then `observation: O01 dismissed`
  - R58-07: Given a Review Record with O01 `dismissed` and `cases` 1, and a case `{"match":"O01","conversation":"Copilot CLI:c1","line":6}`, when it runs, then O01 has `cases` 2 and state `dismissed`, and stdout has `observation: O01 case` and no `confirmed` line
  - R58-08: Given `K` with `outcome` `no action` and `cause` `Developer was in a hurry`, when it runs, then the Observation is `watching` and `cause` is that text (boundary: not a model habit or Harness limit)
  - R58-09: Given `K` with `outcome` `no action`, `cause` `harness limit`, and `model` empty, when it runs, then stdout is `skill-review failed: judgement-invalid: case 1: model missing` (failure)
  - R58-10: Given case `R` = `{"match":null,"ref":"r","conversation":"Copilot CLI:c1","line":5,"part":"behavior-spec","label":"requirements miss","area":"auth","asker":"brain-storm","outcome":"no action","cause":"area open","description":"The Session left login open."}`, when it runs, then the Review Record has one Observation: `state` `watching`, `cases` 1, `label` `requirements miss`, `area` `auth`
  - R58-11: Given a run with `R` at line 5 and `R` at line 9 carrying `"fixType":"clarified rule","fixReason":"Asking is cheaper."`, when it runs, then O01 is `watching` with `cases` 2, and O02 is `{part:"brain-storm", kind:"question gap", state:"confirmed", cases:2, outcome:"part change", fixType:"clarified rule"}`, stdout has `observation: O02 new` then `observation: O02 confirmed`, and `nextObservation` is 3
  - R58-12: Given that Review Record and a third `R` case, when it runs, then O01 has `cases` 3, O02 is unchanged, and no O03 exists
  - R58-13: Given `R` with `cause` `model habit` and `model` `gpt-5.5`, when it runs, then stdout is `skill-review failed: judgement-invalid: case 1: requirements miss cannot be dismissed` (failure)
  - R58-14: Given two `R` cases in one run where the second has no `fixType`, when it runs, then stdout is `skill-review failed: judgement-invalid: case 2: fix filter missing` and nothing is written (failure)
  - R58-15: Given `R` with area `auth` and `R` with area `billing`, when it runs, then two requirements-miss Observations exist, both `watching` with 1 case, and no `question gap` Observation exists (boundary)
- **Acceptance tests:** `tests/skill-review/p03-s03.test.mjs`
- **Files:** edit `.github/tools/skill-review/src/observations.mjs`; edit `.github/tools/skill-review/src/finish.mjs`
- **Patterns:** `.github/tools/skill-review/src/observations.mjs:1 - the S02 case-to-Observation flow`
- **Decisions:**
  - Dismissal: a case that makes or matches an Observation with `outcome` `no action` and `cause` `model habit` or `harness limit` needs a non-empty `model` (else `model missing`), then the state is `dismissed` and `cause` and `model` are stored. It applies to a `watching` or `confirmed` Observation; a `dismissed` Observation only gains `cases`. Any other cause leaves the state as S02 sets it.
  - Requirements miss: a case with `label` `requirements miss` needs `area` and `asker` (`brain-storm` or `incubate`, else `asker missing` or `unknown asker "<x>"`), joins the existing Observation with that label and `area` (ignoring `match`) or creates one, and never changes state from `watching`. A dismissal cause on it fails with `requirements miss cannot be dismissed`. Its `part` is the case's `part`.
  - Question gap: when a requirements-miss Observation's `cases` rises from 1 to 2 or more in one run and no `question gap` Observation holds that `area`, create one: `part` = `asker`, `kind` `question gap`, `state` `confirmed`, `area`, `cases` = the requirements miss `cases` at that moment, `outcome` `part change`, and `fixType`, `fixReason`, `description` from the case that made `cases` reach 2; those need `fix filter missing` checks on that case. Later cases in the area only grow the requirements-miss `cases`.
  - Dismissed Observations print `observation: <id> dismissed` once, when the state becomes `dismissed`.
- **Do not:** edit `tests/skill-review/**`; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R58-06 to R58-15; 10 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S04 - Change commits, install records, version notice

- **Kind:** build
- **Goal:** `mark-changed` and `record-install` keep the change commits and install records, and `finish` names an install that no record matches.
- **Depends on:** S02
- **Tier:** delegate - two small commands over the Review Record; formats are pinned
- **Review:** required - spawns `git`; changes a persisted format
- **Scenarios:** fixture: S01's `<home>`; `<src>` is a git repo with commits `C1` then `C2` (abbreviated to 7 hex); a Review Record with O03 `confirmed` (outcome `part change`) and O04 `watching`; `SKILL_REVIEW_NOW` is `2026-11-26T14:00:00.000Z`; the CLI runs in `<src>` for `record-install`
  - R59-01: Given the fixture, when `mark-changed O03 <C1>` runs, then O03 has `state` `changed` and `changeCommit` `<C1>`, and stdout is `skill-review: O03 changed (<C1>)`
  - R59-02: Given `mark-changed O99 <C1>`, `mark-changed O04 <C1>`, and `mark-changed O03 xyz`, when each runs, then stdout is `skill-review failed: unknown-observation: O99`, `skill-review failed: not-confirmed: O04`, and `skill-review failed: bad-commit: xyz`, and the Review Record is unchanged (failure)
  - R59-03: Given O03 `changed` with `changeCommit` `<C1>`, when `record-install 1a2b3c4 <C2>` runs, then `installs` is `[{"version":"1a2b3c4","source":"<C2>","at":"2026-11-26T14:00:00.000Z","contains":["<C1>"]}]` and stdout is `skill-review: install recorded 1a2b3c4 (1 changes contained)`
  - R59-04: Given O03 `changed` with `changeCommit` `<C2>`, when `record-install 1a2b3c4 <C1>` runs, then `contains` is `[]` (boundary)
  - R59-05: Given R59-03's result, when the same `record-install` runs again at a later `SKILL_REVIEW_NOW`, then `installs` holds one entry with the first `at`, and stdout is `skill-review: install already recorded 1a2b3c4`
  - R59-06: Given `record-install abc <C2>` and `record-install 1a2b3c4 ffffff0`, when each runs, then stdout is `skill-review failed: bad-version: abc` and `skill-review failed: unknown-commit: ffffff0`, and the Review Record is unchanged (failure)
  - R59-07: Given `<home>/.git/personal-workflow/manifest.json` `{"version":"9f8e7d6","status":"complete"}` and installs holding only version `1a2b3c4`, when `finish` runs, then a stdout line is `notice: unrecorded-install: 9f8e7d6` and `installs` is unchanged; and given an install with version `9f8e7d6`, or no manifest file, or manifest version `none`, then no `unrecorded-install` line appears
- **Acceptance tests:** `tests/skill-review/p03-s04.test.mjs`
- **Files:** create `.github/tools/skill-review/src/installs.mjs`; edit `.github/tools/skill-review/src/finish.mjs`; edit `.github/tools/skill-review/src/cli.mjs`
- **Patterns:** `.github/tools/skill-review/src/cli.mjs:1 - gitToplevel and the spawnSync git call`; `scripts/update-home.mjs:229 - manifest location under the Home Repo git folder`
- **Decisions:**
  - Commands: `skill-review mark-changed <O-id> <commit>` and `skill-review record-install <version> <source-commit>`; any other argument count is `skill-review failed: usage: skill-review mark-changed <O-id> <commit>` or `... record-install <version> <source-commit>`. Both need the Home layout and a readable Review Record, in that order, before their own checks.
  - `mark-changed` checks: the ID exists (`unknown-observation`), the state is `confirmed` with outcome `part change` (`not-confirmed`), the commit matches `/^[0-9a-f]{7,40}$/` (`bad-commit`). It sets `state` `changed` and `changeCommit`.
  - `record-install` checks: `version` matches `/^[0-9a-f]{7}$/` (`bad-version`); the source commit matches `/^[0-9a-f]{7,40}$/` and `git cat-file -e <commit>^{commit}` succeeds in the working folder (`unknown-commit`). `contains` lists the `changeCommit` of every Observation in state `changed` for which `git merge-base --is-ancestor <changeCommit> <source>` exits 0 in the working folder, sorted. An install with the same `version` and `source` already present is not added again.
  - `installs.mjs` also exports `installOf(record, observation)`, returning `null` or `{version, at}` of the earliest install whose `contains` holds the Observation's `changeCommit` (S05 uses it).
  - Notice: `finish` reads `<home>/.git/personal-workflow/manifest.json` (a `.git` folder, not a file); when it exists, has a string `version` other than `none`, and no install has that `version`, it prints `notice: unrecorded-install: <version>` before the Observation lines. An unreadable manifest is ignored.
- **Do not:** edit `tests/skill-review/**`; run `git` with a write command; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R59-01 to R59-07; 7 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S05 - Changed Observations: improved or unchanged

- **Kind:** build
- **Goal:** `finish` counts chances to recur for installed, changed Observations and moves each to `improved` after 2 clean chances or back to `confirmed` at the first case in a chance.
- **Depends on:** S03, S04
- **Tier:** delegate - one pinned algorithm over the Review Record and compact record
- **Review:** required - parses untrusted input (Conversation Log timestamps)
- **Scenarios:** fixture: S04's fixture; Review Record O03 `{part:"pull-work", state:"changed", changeCommit:"<C1>", cases:1, chances:0}` with `installs` `[{"version":"1a2b3c4","source":"<C2>","at":"2026-11-26T14:00:00.000Z","contains":["<C1>"]}]`; Copilot Logs whose first line is `{"type":"session.start","timestamp":"<ISO>",...}`; `u` is a `pull-work` use 2-10; case `H` is `{"match":"O03","conversation":"<key>","line":5}`
  - R58-16: Given `c2` started `2026-11-26T15:00:00.000Z` with use `u` and no case, when `finish` runs, then O03 is `changed` with `chances` 1, and no `observation: O03` line appears
  - R58-17: Given O03 with `chances` 1 and the same `c2`, when it runs, then O03 is `improved` with `chances` 2 and stdout has `observation: O03 improved`
  - R58-18: Given `c2` as in R58-16 and `H` for `c2`, when it runs, then O03 is `confirmed` with `cases` 2, `chances` 0, and `changeCommit` null, and stdout has `observation: O03 case` then `observation: O03 unchanged`
  - R58-19: Given `c1` started `2026-11-26T13:30:00.000Z` and `H` for `c1`, when it runs, then O03 stays `changed` with `cases` 2 and `chances` 0, and no `unchanged` line appears (boundary: before the install)
  - R58-20: Given `c2` started 15:00 with use `u` and `c3` started 16:00 with use `u` and `H` for `c3`, when it runs, then O03 is `confirmed` with `chances` 0 (clean chance, then a case)
  - R58-24: Given the same fixture with `H` for `c2` instead, when it runs, then O03 is `confirmed` and `chances` is 0 (the later clean use is not counted)
  - R58-21: Given `installs` empty and `c2` with use `u`, when it runs, then O03 is `changed` with `chances` 0 (not installed, no chance)
  - R58-22: Given O03 `improved` and `H`, when it runs, then O04 exists with `state` `watching`, `cases` 1, `follows` `O03`, `part` `pull-work`, O03 stays `improved`, and stdout has `observation: O04 new`
  - R58-23: Given `c2` whose first line has no `timestamp`, and given `c2` started exactly `2026-11-26T14:00:00.000Z`, when it runs, then `chances` is 0 for each (boundary)
  - R59-08: Given O03 `changed` with a `changeCommit` that no install contains (installs hold `contains` `[]`), when it runs, then the result equals R58-21's
- **Acceptance tests:** `tests/skill-review/p03-s05.test.mjs`
- **Files:** create `.github/tools/skill-review/src/lifecycle.mjs`; edit `.github/tools/skill-review/src/finish.mjs`; edit `.github/tools/skill-review/src/observations.mjs`
- **Patterns:** `.github/tools/skill-review/src/logs.mjs:1 - splitLines and parseLine`; `.github/tools/skill-review/src/installs.mjs:1 - installOf`
- **Decisions:**
  - A matched case on an `improved` Observation does not add to it: it creates a new Observation `{state:"watching", cases:1, follows:<improved id>}` with `part`, `kind`, `label`, `side`, `area`, `outcome`, `fixType`, `fixReason`, `description` copied from the improved one, and prints `observation: <new id> new`.
  - Conversation start: the `timestamp` string of the first parseable line of the Conversation's `file` that has one; none or an unreadable file means no start. A Conversation is post-install when its start is after the install `at` (`Date.parse`, strictly greater).
  - For each `changed` Observation with `installOf` non-null, walk the compact record's uses where `skill` equals the Observation's `part` and the Conversation is post-install, ordered by start time, then Conversation key, then use `start`. A use that holds a case for the Observation (same Conversation key, `line` within `from..end`) makes the Observation `confirmed`, sets `chances` 0 and `changeCommit` null, prints `observation: <id> unchanged`, and stops the walk; any other use adds 1 to `chances`, and at `chances` 2 the state becomes `improved`, prints `observation: <id> improved`, and the walk stops. A case in a post-install Conversation that is in no such use also makes the Observation `unchanged`.
  - A case in a Conversation that is not post-install only adds to `cases`.
  - The case line `observation: <id> case` is printed for every matched case, once per Observation per run, before its `unchanged` or `improved` line.
- **Do not:** edit `tests/skill-review/**`; count Handoffs or non-skill parts (P05); add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R58-16 to R58-24, R59-08; 10 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S06 - One follower per improved Observation per run

- **Kind:** build
- **Goal:** cases on the same improved Observation in one run share one new follower Observation.
- **Depends on:** S05
- **Tier:** delegate - a pinned fix to one function; follows the S02 `refs` pattern
- **Review:** none
- **Scenarios:** fixture: O03 `improved` (`part` `pull-work`), `nextObservation` 4, Copilot `c2` with a `pull-work` use 2-10; case `H(n)` is `{"match":"O03","conversation":"Copilot CLI:c2","line":n}`
  - R58-25: Given `{cases:[H(5), H(6)]}`, when `finish` runs, then the Observations are O03 (still `improved`) and O04 `{follows:"O03", cases:2, state:"confirmed"}`, `nextObservation` is 5, and stdout has `observation: O04 new` then `observation: O04 confirmed`
  - R58-26: Given a run with `H(5)` and then a later run with `H(6)`, when both ran, then O04 and O05 both exist with `follows` `O03` and `cases` 1 (boundary: the follower is per run)
- **Acceptance tests:** `tests/skill-review/p03-s06.test.mjs`
- **Files:** edit `.github/tools/skill-review/src/observations.mjs`
- **Patterns:** `.github/tools/skill-review/src/observations.mjs:1 - the per-run refs map for new Observations`
- **Decisions:**
  - Keep a per-run map from the improved Observation ID to its follower. A matched case on an `improved` Observation reuses the follower when the map has one; otherwise it creates the follower (as S05) and stores it. The normal case counting and the `confirmed` transition then apply to the follower.
- **Do not:** edit `tests/skill-review/**`; change output order rules; add dependencies.
- **Done when:** `node --test --test-reporter=tap "tests/skill-review/*.test.mjs"` exits 0; targets R58-25, R58-26; 2 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.
