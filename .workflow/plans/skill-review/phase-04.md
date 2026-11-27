# P04 - Executive Summary, Ledger, STE check, commit

- **Outcome:** `skill-review finish` also writes one Executive Summary and the Ledger in STE, checks the text it wrote, and refuses text that carries copied Conversation Log words or secrets. `skill-review commit <compact-record>` commits only the records in the Home Repo. Nothing in the run touches the network or the Project Repo.
- **Covers:** R52 (commit-failed, Reviewed line), R55 (pending Handoff count and Ledger listing only), R59 (Ledger wording), R60, R61 (Ledger rewritten from the Review Record), R62 (Model tokens line), R63, R64, R65 (Notices section), Q-readability, Q-ste, Q-privacy, Q-offline
- **Invariants:**
  - ES modules (`.mjs`), Node built-ins only, no dependencies, no network modules and no `fetch`.
  - Code in `.github/tools/skill-review/src/`; `cli.mjs` `main(argv, env, cwd)` returns `{lines, code}`. Failure is one stdout line `skill-review failed: <category>: <detail>`, exit 1, and nothing is written (except `commit-failed`).
  - Home layout means `WORKFLOW_HOME` is set to an existing folder (the Home Repo); otherwise `skill-review failed: home-layout-required: start the Harness with the Launch Script`.
  - Records live in `<Home Repo>\skill-review\`: `review-record.json`, `ledger.md`, `summaries\<YYYY-MM-DD-HHmm>-<project>.md`. Only `finish`, `mark-changed`, and `record-install` write them; `commit` only commits them.
  - Now is `env.SKILL_REVIEW_NOW` (an ISO time) when set, else the current time. Dates and times in records are formatted in local time; tests pass a time without an offset (`2026-11-26T14:05:00`).
  - `project` is `compact.project`, else the base name of the working folder.
  - Fixed text that code writes follows STE: sentences of at most 20 words in `## Next`, at most 25 elsewhere.
  - The model never opens a Conversation Log. `finish` reads a Log only for its first `timestamp` (P03) and for the privacy check (S06).
  - Tests read stable markers only: output lines, record files, `git status --porcelain`, `git log`.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" "tests/skill-review/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R60-01]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Known failures:**
  - `[R29-01] Glossary defines the 13 added terms with Slice and Card separate` - owner P06
  - `[Q-zero-workflow-check-errors] workflow-check passes on repo .workflow/ with zero errors and no Glossary findings` - owner P06
- **Not expressible:**
  - R60 "a run rewrites failing text until the STE check passes, at most 3 times" - the rewriting is the model's step; tests check that `finish` reports each failing sentence, writes nothing on attempts 1 and 2, and writes the records with a notice on attempt 3. The `skill-review` skill (P05) tells the model to loop.
  - R63 "reads only local Conversation Logs, the Workflow Folder, and git history" - a negative; Q-offline blocks every network call and S08 scans the source for network modules.
  - R66-R67 wording in skills and `README.md` - P05.
- **Gate:**
  - suite: `node --test --test-reporter=tap --test-skip-pattern="<node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/skill-review/phase-04.md --skip-pattern output>" "tests/**/*.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node --test --test-reporter=tap "tests/skill-review/*.test.mjs" | node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/skill-review/phase-04.md <scenario IDs of S01-S08>`
  - lock: `git diff --exit-code <Tests locked> -- tests/skill-review`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - R61-02 expects the new record files

- **Kind:** test-fix
- **Scope:** assertion
- **Goal:** the P03 test `[R61-02]` expects `finish` to write `ledger.md` and `summaries/` next to `review-record.json`.
- **Depends on:** none
- **Tier:** main - test-fix cards are never dispatched to `coder`
- **Review:** none
- **Restores:** R61-02 (owned by P03 S01). P04 changes what `finish` writes, so the old expectation of a lone `review-record.json` no longer holds.
- **Acceptance tests:** `tests/skill-review/p03-s01.test.mjs`
- **Files:** edit `tests/skill-review/p03-s01.test.mjs`
- **Decisions:** the new test title is `[R61-02] finish writes only record files in the skill-review folder`. Given a Review Record and no `summaries` folder and no `ledger.md`, when `finish` runs, then it exits 0 and `readdirSync(<home>/skill-review)` is `['ledger.md','review-record.json','summaries']`. Every other assertion in the file stays the same.
- **Done when:** `node --test --test-reporter=tap "tests/skill-review/p03-s01.test.mjs"` exits 0 after S02 and S04 are done; the rewritten test fails until then.

## S02 - Summary file with header, version, Reviewed, tokens, Notices

- **Kind:** build
- **Goal:** `finish` writes a new Executive Summary file with the header lines, the four empty sections, and the Notices section; `prepare` stores its notices in the compact record.
- **Depends on:** S01
- **Tier:** main - creates `summary.mjs` and reshapes the `finish` flow that S03-S07 extend
- **Review:** required - creates a shared structure; defines a persisted format; no mutation gate
- **Scenarios:** fixture: P03 S01's fixture (`<home>` and `<proj>` git repos, `WORKFLOW_HOME=<home>`, `SKILL_REVIEW_NOW=2026-11-26T14:05:00`); the compact record is `{"project":"Scheduler","conversations":[...],"tokens":{"depth1":120,"depth2":30},"notices":[]}`; the judgement is `{"cases":[]}`; `<summary>` is `<home>/skill-review/summaries/2026-11-26-1405-Scheduler.md`
  - R52-16: Given Copilot `c1` uses `brain-storm` and `behavior-spec`, and Claude `k1` uses `pull-work`, when `finish` runs, then `<summary>` has the line `Reviewed: 2 Conversations, 3 skill uses (behavior-spec, brain-storm, pull-work), 0 Handoffs; pending Handoffs: 0`
  - R60-01: Given one `pull-work` use, when it runs, then `<summary>` lines 1-4 are `# Skill Review - Scheduler - 2026-11-26 14:05`, a `Workflow version:` line, the `Reviewed:` line, a `Model tokens:` line, followed by `## Changed`, `## Improved`, `## Same`, `## Next` in that order, each followed by `None.`, and no `## Notices`
  - R60-02: Given `<home>/.git/personal-workflow/manifest.json` `{"version":"9f8e7d6"}` and installs holding `{"version":"9f8e7d6","source":"a1b2c3d","at":"2026-11-26T13:00:00.000Z","contains":[]}`, when it runs, then the line is `Workflow version: 9f8e7d6 (source a1b2c3d)`; with installs holding another version it is `Workflow version: 9f8e7d6 (source unknown)`; with no manifest it is `Workflow version: unknown (source unknown)`
  - R62-17: Given tokens `{"depth1":120,"depth2":30}`, when it runs, then the line is `Model tokens: 150 read (Depth 1: 120, Depth 2: 30)`; with no `tokens` key it is `Model tokens: 0 read (Depth 1: 0, Depth 2: 0)`
  - R65-03: Given `notices` `["notice: no-conversation-log: Claude Code","notice: unknown-record: Claude Code k1 line 12: type \"thinking_v9\""]`, when it runs, then `<summary>` ends with `## Notices` followed by those two strings as `- <notice>` lines; and given 12 notices, it lists the first 10 and then the line `2 more notices not shown.`
  - R65-04: Given `prepare` in a Project Repo with no Claude Conversation Log, when it runs, then the compact record has `notices` `["notice: no-conversation-log: Claude Code"]`; given logs for both Harnesses and no unknown records, `notices` is `[]`
  - R59-09: Given the manifest version `9f8e7d6` and no matching install, when `finish` runs, then `## Notices` has the line `- notice: unrecorded-install: 9f8e7d6` after the compact notices
  - R55-04: Given a Review Record with one Handoff `{"id":"h1","writingSkill":"brain-storm","usingSkill":"behavior-spec","artifact":".workflow/sessions/context-2026-11-20-1124.md","state":"pending","writtenAt":"2026-11-20T10:00:00"}` and one with `"state":"reviewed"`, when it runs, then the `Reviewed:` line ends with `pending Handoffs: 1`
  - R60-03: Given a run, when it ends, then a stdout line `skill-review: summary: <absolute path of the file>` comes right before the `reviewed` line, and a second run in the same minute writes `2026-11-26-1405-Scheduler-2.md` and leaves the first file unchanged (boundary)
  - R60-04: Given a compact record with no uses, when it runs, then no `summaries` folder and no `ledger.md` exist and the Review Record is written as before (boundary)
- **Acceptance tests:** `tests/skill-review/p04-s02.test.mjs`
- **Files:** create `.github/tools/skill-review/src/summary.mjs`; edit `.github/tools/skill-review/src/finish.mjs`; edit `.github/tools/skill-review/src/cli.mjs`
- **Patterns:** `.github/tools/skill-review/src/finish.mjs:1 - the finish flow, readJson, and unrecordedInstall`; `.github/tools/skill-review/src/record.mjs:1 - atomic writeRecord (temp file plus rename)`
- **Decisions:**
  - `summary.mjs` exports `renderSummary(ctx)` returning the file text, and `stamp(now)` returning `{title:'YYYY-MM-DD HH:mm', file:'YYYY-MM-DD-HHmm'}` in local time. `ctx` is `{project, now, version, source, compact, record, observationLines, notices}`.
  - `finish` runs the P03 steps unchanged, builds the text from the settled in-memory Review Record, and writes `summaries/<file>-<project>.md` (suffix `-2`, `-3`, ... before `.md` when the name exists) atomically, then the Review Record. It adds the line `skill-review: summary: <absolute path>` before the `reviewed` line.
  - Reviewed counts: Conversations and uses counted only for Conversations that have at least one use; skill names are unique, sorted, joined by `, `; Handoffs reviewed is the length of the optional `judgement.handoffs` array (0 when absent; P05 gives it meaning); pending Handoffs counts `record.handoffs` entries with `state` `pending`.
  - Version: the manifest `version` (a string other than `none`), else `unknown`; source is the `source` of the install with that version, else `unknown`.
  - Notices: `compact.notices` strings, then `notice: unrecorded-install: <v>` (S02 moves that line from stdout-only to also appear here; stdout is unchanged). At most 10 are listed, then `<n> more notices not shown.`. The section is omitted when there are none.
  - `prepare` writes `notices` (the same strings it prints) as the last key of the compact record. `slice` keeps the key when it rewrites the file.
  - The four section bodies are `None.` in this card; the text is `\n`-joined with a final newline.
- **Do not:** edit `tests/skill-review/**`; write sections' entries (S03) or the Ledger (S04); commit anything; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R52-16, R60-01 to R60-04, R62-17, R65-03, R65-04, R59-09, R55-04; 10 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S03 - Summary sections: Changed, Improved, Same, Next

- **Kind:** build
- **Goal:** each Observation entry lands in the right section, and the summary stays short.
- **Depends on:** S02
- **Tier:** delegate - fills pinned sections from the `observation:` output lines
- **Review:** required - changes a persisted format
- **Scenarios:** fixture: S02's fixture; compact has Copilot `c1` use `pull-work` `{start:2,end:20,from:2}`; case `K` is P03 S02's `K` (part `pull-work`, `fixType` `clarified rule`, `description` `The skill asked the same question twice.`)
  - R60-05: Given the judgement `{cases:[K]}`, when `finish` runs, then `## Changed` holds `- O01 pull-work: The skill asked the same question twice.` and `## Improved`, `## Same`, and `## Next` hold `None.`
  - R60-06: Given `{cases:[K, K at line 9]}` (O01 confirmed), when it runs, then `## Changed` lists O01 and `## Next` holds `- O01 pull-work: The skill asked the same question twice. Fix type: clarified rule.`
  - R60-07: Given the P03 S05 fixture (O03 `changed`, installed, `chances` 1) and one clean post-install `pull-work` use, when it runs, then `## Improved` lists O03 and `## Changed` and `## Same` hold `None.`; and given a case on that post-install use, then `## Same` lists O03, `## Changed` holds `None.`, and `## Next` lists O03 (it is confirmed again)
  - R60-08: Given `K` with `outcome` `no action`, `cause` `model habit`, `model` `gpt-5.5`, when it runs, then `## Changed` lists O01 and `## Next` holds `None.`
  - R60-09: Given `K` with `kind` `Developer contribution`, `outcome` `Developer note`, and a second Observation O02 that is confirmed with outcome `part change`, when it runs, then `## Next` lists O02 first and then `- O01 pull-work: Developer note. The skill asked the same question twice.`
  - R60-10: Given a Review Record with O04 `watching` and a run whose case matches O04 without changing its state, when it runs, then `## Changed` holds `None.` (boundary: a case alone is not a change)
  - R60-11: Given a Review Record with O05 confirmed with outcome `part change` and an empty judgement, when it runs, then `## Next` lists O05 and `## Changed` holds `None.`
  - Q-readability: Given 12 new Observations and 40 notices, when it runs, then every line of `<summary>` that does not start with `- O` holds at most 300 words in total, and each entry line has at most 3 sentences
- **Acceptance tests:** `tests/skill-review/p04-s03.test.mjs`
- **Files:** edit `.github/tools/skill-review/src/summary.mjs`
- **Patterns:** `.github/tools/skill-review/src/summary.mjs:1 - renderSummary and its section bodies`
- **Decisions:**
  - Events come from the `observation: <id> <event>` lines that `applyCases` returns. Changed: IDs with `new`, `confirmed`, or `dismissed`, without `improved` or `unchanged`. Improved: IDs with `improved`. Same: IDs with `unchanged`. Each section lists IDs in ID order, once.
  - Entry line: `- <id> <part>: <description>`; without a description, `- <id> <part>`.
  - Next: first every Observation with state `confirmed` and outcome `part change`, in ID order, as `- <id> <part>: <description> Fix type: <fixType>.`; then every Observation with outcome `Developer note`, state `watching` or `confirmed`, and an event in this run, as `- <id> <part>: Developer note. <description>`.
  - A section with no entries holds `None.`.
  - An Observation entry never wraps onto a second line: newlines in descriptions become spaces.
- **Do not:** edit `tests/skill-review/**`; edit `finish.mjs`, `observations.mjs`, or `lifecycle.mjs`; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R60-05 to R60-11, Q-readability; 8 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S04 - Ledger

- **Kind:** build
- **Goal:** every `finish` rewrites the whole Ledger from the Review Record, including install state and pending Handoffs.
- **Depends on:** S02
- **Tier:** delegate - one pinned renderer over the Review Record
- **Review:** required - changes a persisted format
- **Scenarios:** fixture: S02's fixture; `<ledger>` is `<home>/skill-review/ledger.md`; Review Record Observations are listed per scenario
  - R60-12: Given O03 `{part:"pull-work", state:"confirmed", side:"using", label:"translation miss", cases:3, chances:0, outcome:"part change", fixType:"clarified rule", fixReason:"A check cannot find this.", description:"The skill asked twice."}`, when `finish` runs, then `<ledger>` has `### O03 pull-work` followed by the lines `State: confirmed`, `Side: using`, `Miss label: translation miss`, `Cases: 3`, `Chances to recur: 0`, `Outcome: part change`, `Fix type: clarified rule`, `Fix reason: A check cannot find this.`, and `The skill asked twice.`
  - R60-13: Given Observations in states confirmed, changed, watching, improved, dismissed (one each), when it runs, then the headings `## confirmed`, `## changed`, `## watching`, `## improved`, `## dismissed` appear in that order, an empty state holds `None.`, and `## Pending Handoffs` comes last
  - R59-10: Given O05 `changed` with `changeCommit` `a1b2c3d` and no install containing it, when it runs, then its entry has `State: changed, not yet installed` and `Change commit: a1b2c3d`; given an install `{"version":"1a2b3c4","contains":["a1b2c3d"],...}`, it has `State: changed, installed 1a2b3c4`
  - R61-03: Given the Review Record only (no Ledger, no summaries), when it runs, then `<ledger>` holds every Observation of the record in full
  - R60-14: Given a `<ledger>` that holds `hand edit`, when it runs, then `<ledger>` no longer holds `hand edit`
  - R55-05: Given the two Handoffs of R55-04 and `SKILL_REVIEW_NOW` `2026-11-26T14:05:00`, when it runs, then `## Pending Handoffs` holds `- .workflow/sessions/context-2026-11-20-1124.md (brain-storm -> behavior-spec), 6 days` and no line for the reviewed Handoff; with none pending it holds `None.`
  - R58-27: Given O06 `dismissed` with `cause` `model habit` and `model` `gpt-5.5`, when it runs, then its entry has `Cause: model habit (gpt-5.5)`
  - R60-15: Given O07 `watching` with kind `token cost`, `side` null, and no description, when it runs, then its entry has `Kind: token cost` and `Side: none` and no description line (boundary)
- **Acceptance tests:** `tests/skill-review/p04-s04.test.mjs`
- **Files:** create `.github/tools/skill-review/src/ledger.mjs`; edit `.github/tools/skill-review/src/finish.mjs`
- **Patterns:** `.github/tools/skill-review/src/summary.mjs:1 - a renderer returning file text`; `.github/tools/skill-review/src/installs.mjs:1 - installOf`
- **Decisions:**
  - `ledger.mjs` exports `renderLedger({record, now})`; `finish` writes `ledger.md` atomically after the summary and before the Review Record, only when the run had at least one use.
  - File layout: `# Skill Ledger`, a blank line, then each state heading `## <state>` in the order confirmed, changed, watching, improved, dismissed, each followed by its entries (ID order) or `None.`, then `## Pending Handoffs`. Entries are `### <id> <part>` followed by one line per field, then a blank line and the description when present.
  - Field lines in order, each only when it applies: `State:` (for `changed`: `changed, not yet installed` or `changed, installed <version>`, from `installOf`), `Side:` (`none` when null), `Kind:` or `Miss label:` (whichever is set), `Cases:`, `Chances to recur:`, `Outcome:`, `Fix type:` and `Fix reason:` (state `confirmed` with outcome `part change`), `Change commit:` (state `changed`), `Cause:` (`<cause> (<model>)`, or `<cause>` when `model` is null; when `cause` is set).
  - A pending Handoff is a `record.handoffs` entry `{id, writingSkill, usingSkill, artifact, state, writtenAt}` with `state` `pending`, listed as `- <artifact> (<writingSkill> -> <usingSkill>), <n> days`, `n` being `floor((now - writtenAt) / 86400000)`.
- **Do not:** edit `tests/skill-review/**`; change the summary; read Conversation Logs; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R60-12 to R60-15, R59-10, R61-03, R55-05, R58-27; 8 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S05 - STE check

- **Kind:** build
- **Goal:** `finish` measures the sentences it wrote, reports each failing one, writes nothing on attempts 1 and 2, and on attempt 3 writes the records with a notice and a watching Observation against `skill-review`.
- **Depends on:** S03, S04
- **Tier:** delegate - a pinned counter and one flag
- **Review:** none
- **Scenarios:** fixture: S03's fixture; `S27` is a sentence of 27 words, `S25` of 25 words, `S22` of 22 words; `K(d)` is `K` with `description` `d`
  - R60-16: Given `{cases:[K(S27)]}`, when `finish` runs, then stdout is `ste: O01 sentence 1 has 27 words (max 25)` then `skill-review failed: ste-check: 1 sentences`, exit is 1, and no summary, no ledger, and no change to the Review Record exist
  - R60-17: Given `K(S25)`, when it runs, then exit is 0 (boundary)
  - R60-18: Given two cases that make O01 confirmed with `description` `S22`, when it runs, then stdout has `ste: O01 sentence 1 has 22 words (max 20)`; and given one case (O01 watching, not in `## Next`), exit is 0 (boundary)
  - R60-19: Given `K` with a description of 4 sentences of 3 words each, when it runs, then stdout has `ste: O01 entry has 4 sentences (max 3)`; and a description of 7 such sentences also has `ste: O01 paragraph has 7 sentences (max 6)`
  - R60-20: Given `K` with `fixReason` `S27`, when it runs, then stdout has `ste: O01 fix reason sentence 1 has 27 words (max 25)`
  - R60-21: Given `K(S27)` and `finish ... --attempt 3`, when it runs, then exit is 0, `## Notices` in the summary holds `- STE check failed: 1 sentences`, and the Review Record has an Observation `{part:"skill-review", state:"watching", kind:"rule adherence", cases:1, outcome:"part change", fixType:"clarified rule"}` listed in `## Changed`; with `--attempt 2` it fails as in R60-16
  - R60-22: Given `--attempt 4` and `--attempt x`, when it runs, then stdout is `skill-review failed: usage: skill-review finish <compact-record-file> <judgement-file>` (failure)
  - Q-ste: Given a run with 10 well-formed Observations (5 confirmed with `## Next` entries), when it ends, then the test's own count finds no sentence above 20 words in `## Next`, none above 25 elsewhere in the summary and the ledger, and no paragraph above 6 sentences
- **Acceptance tests:** `tests/skill-review/p04-s05.test.mjs`
- **Files:** create `.github/tools/skill-review/src/ste.mjs`; edit `.github/tools/skill-review/src/finish.mjs`
- **Patterns:** `.github/tools/skill-review/src/finish.mjs:1 - flag-free argument check and fail function`
- **Decisions:**
  - `ste.mjs` exports `sentences(text)` (split after `.`, `!`, or `?` followed by whitespace or the end) and `wordCount(sentence)` (whitespace-separated tokens).
  - Checked text is what this run's model wrote: for every Observation with a `new` event, its `description` and `fixReason`. Limit per sentence is 20 when the Observation is listed in `## Next` at the end of the run, else 25. A description of more than 3 sentences fails `entry has <n> sentences (max 3)`; more than 6 fails `paragraph has <n> sentences (max 6)`; both are listed when both apply.
  - Failure lines, in ID order then text order: `ste: <id> sentence <k> has <w> words (max <m>)`, `ste: <id> fix reason sentence <k> has <w> words (max <m>)`, `ste: <id> entry has <n> sentences (max 3)`, `ste: <id> paragraph has <n> sentences (max 6)`. The count in `skill-review failed: ste-check: <n> sentences` is the number of ste lines.
  - `--attempt <n>` (default 1, allowed 1, 2, or 3, anywhere after the two paths) sets the attempt. On attempts 1 and 2 a failing check returns the ste lines and the failure line, exit 1, nothing written. On attempt 3 the run continues: it adds one new Observation (next ID, `part` `skill-review`, `state` `watching`, `kind` `rule adherence`, `outcome` `part change`, `fixType` `clarified rule`, `fixReason` `The text rules need a clearer example.`, `description` `The Executive Summary failed the STE check three times.`, `cases` 1) and prints `observation: <id> new`, and `## Notices` gets `- STE check failed: <n> sentences`. The added Observation is not checked.
  - A bad `--attempt` value returns the usage line of `finish` unchanged.
- **Do not:** edit `tests/skill-review/**`; change what the summary or ledger renderers print except through the added Observation and notice; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R60-16 to R60-22, Q-ste; 8 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S06 - No copied Conversation Log text or secrets in records

- **Kind:** build
- **Goal:** `finish` refuses model-written text that copies 8 words in a row from a Conversation Log or holds a secret-like string found in one.
- **Depends on:** S05
- **Tier:** delegate - one pinned check over the judgement cases
- **Review:** required - touches secrets
- **Scenarios:** fixture: S03's fixture; the Copilot log `c1` holds the message `Please never print the deploy token sk-test-9f8e7d6c5b4a when you run the release step` (as a JSON string value of one record)
  - R64-01: Given `K` with `description` `The skill printed sk-test-9f8e7d6c5b4a once.`, when `finish` runs, then stdout is `skill-review failed: privacy-check: case 1 description`, exit is 1, and no record, ledger, or summary exists or changed
  - R64-02: Given `K` with `description` `The skill wrote please never print the deploy token sk in a note.` (7 words in a row from the log), when it runs, then exit is 0; and given `description` `The skill wrote please never print the deploy token sk test in a note.` (8 words), then stdout is `skill-review failed: privacy-check: case 1 description` (boundary)
  - R64-03: Given `K` with `outcome` `no action`, `cause` `please never print the deploy token sk test`, when it runs, then stdout is `skill-review failed: privacy-check: case 1 cause`
  - R64-04: Given the compact Conversation ID `8d1c2f3e-1111-2222-3333-444455556666` that the log also holds in a `sessionId` field, and `K` with `description` `The skill kept 8d1c2f3e-1111-2222-3333-444455556666 and 3f9a2c1d5e at .workflow/plans/a.md.`, when it runs, then exit is 0 (boundary: Conversation IDs, commit IDs, and paths are allowed)
  - Q-privacy: Given three Conversation Logs with long messages and a judgement that passes, when it ends, then no run of 8 consecutive words from any log message appears in any file under `<home>/skill-review/`
- **Acceptance tests:** `tests/skill-review/p04-s06.test.mjs`
- **Files:** create `.github/tools/skill-review/src/privacy.mjs`; edit `.github/tools/skill-review/src/finish.mjs`
- **Patterns:** `.github/tools/skill-review/src/logs.mjs:1 - splitLines and parseLine`
- **Decisions:**
  - `privacy.mjs` exports `checkPrivacy(cases, compact)` returning `null` or `{case, field}` for the first failure, in case order then field order `description`, `fixReason`, `cause`, `area`, `model`. `finish` runs it after reading the judgement and before `applyCases`; a failure is `skill-review failed: privacy-check: case <n> <field>` and never echoes the text.
  - Log text: for every Conversation in the compact record, read its `file`, parse each line as JSON, and collect every string value at any depth; a line that is not JSON counts as one string. A missing or unreadable file adds nothing. Each string is lowercased and split into words with `/[a-z0-9']+/g`, separately.
  - Window rule: a field fails when any 8 consecutive words of it (same split) appear as 8 consecutive words in one log string.
  - Secret rule: a whitespace-separated token of a field fails when it matches `^[A-Za-z0-9_-]{12,}$`, holds a letter and a digit, is not `^[0-9a-f]{7,40}$`, is not a Conversation `id` of the compact record, and appears as a whole token in a log string. Trailing `.`, `,`, `;` are stripped from the token first.
  - Judged fields are `description`, `fixReason`, `cause`, `area`, `model` of each case (a field that is missing or not a string is skipped).
- **Do not:** edit `tests/skill-review/**`; add dependencies; print judged text.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R64-01 to R64-04, Q-privacy; 5 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S07 - Commit the records in the Home Repo

- **Kind:** build
- **Goal:** `skill-review commit <compact-record>` commits only the `skill-review` folder of the Home Repo and never touches the Project Repo.
- **Depends on:** S06
- **Tier:** delegate - one command around two pinned git calls
- **Review:** required - runs git operations; spawns processes
- **Scenarios:** fixture: S02's fixture after `finish` ran, with the git identity in the environment (`GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL`); `<compact>` has `project` `Scheduler`
  - R63-01: Given `<home>/notes.md` untracked, when `commit <compact>` runs, then stdout's last line matches `^skill-review: committed [0-9a-f]{7}$`, the new `HEAD` subject is `docs(skill-review): review Scheduler`, the files of that commit are exactly `skill-review/ledger.md`, `skill-review/review-record.json`, and `skill-review/summaries/2026-11-26-1405-Scheduler.md`, and `notes.md` is still untracked
  - R63-02: Given `git status --porcelain` in `<proj>` before `finish` and `commit`, when both end, then the output is identical
  - R52-18: Given a `<home>/.git/hooks/pre-commit` that exits 1, when `commit` runs, then stdout starts `skill-review failed: commit-failed: `, followed by one line `record: <absolute path>` per file under `<home>/skill-review/`, exit is 1, and those files still exist; and given the hook removed and `commit` run again, then they are all in the new commit (failure)
  - R52-19: Given nothing changed under `<home>/skill-review/` since the last commit, when `commit` runs, then stdout is `skill-review: nothing to commit`, exit is 0, and `HEAD` is unchanged (boundary)
  - R52-20: Given `commit` with no argument, with `WORKFLOW_HOME` unset, and with a missing compact file, when each runs, then stdout is `skill-review failed: usage: skill-review commit <compact-record-file>`, `skill-review failed: home-layout-required: start the Harness with the Launch Script`, and `skill-review failed: record-unreadable: <path as given>`, and nothing changes (failure)
- **Acceptance tests:** `tests/skill-review/p04-s07.test.mjs`
- **Files:** create `.github/tools/skill-review/src/commit.mjs`; edit `.github/tools/skill-review/src/cli.mjs`
- **Patterns:** `.github/tools/skill-review/src/installs.mjs:1 - the git() helper over spawnSync`; `.github/tools/skill-review/src/cli.mjs:1 - command routing and fail function`
- **Decisions:**
  - `cli.mjs` routes `commit` to `commit(args, env, cwd)` in `commit.mjs`, which returns `{lines, code}`. Check order: usage, home layout, compact record (`record-unreadable` as in `finish`).
  - Project name: `compact.project` when a non-empty string, else the base name of `cwd`.
  - Steps, all with `git -C <home>`: `status --porcelain -- skill-review`; when empty print `skill-review: nothing to commit`; else `add -A -- skill-review`, then `commit -m "docs(skill-review): review <project>" -- skill-review`. The message has no trailer. On a non-zero exit, `commit-failed` detail is the first non-empty line of git's stderr, then the `record:` lines (absolute paths of every file under `<home>/skill-review/`, sorted). On success print `skill-review: committed <git rev-parse --short=7 HEAD>`.
  - `commit` never runs git in the Project Repo and never runs any git command other than those above.
- **Do not:** edit `tests/skill-review/**`; edit `finish.mjs`; commit paths outside `skill-review`; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R63-01, R63-02, R52-18 to R52-20; 5 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S08 - Offline

- **Kind:** verify
- **Goal:** every `skill-review` command completes with all network access blocked, and no source file uses a network module.
- **Depends on:** S07
- **Tier:** delegate - runs on existing code; nothing to implement unless it fails
- **Review:** none
- **Scenarios:**
  - Q-offline: Given a preload module (`NODE_OPTIONS=--import <file URL>`) that makes `net.Socket.prototype.connect`, `dns.lookup`, `dns.promises.lookup`, `http.request`, `https.request`, and `globalThis.fetch` throw and write a marker file, when `prepare`, `slice`, `finish`, `mark-changed`, `record-install`, and `commit` each run on the S02 fixture, then every exit is 0 and the marker file does not exist
  - R63-05: Given the files in `.github/tools/skill-review/`, when they are scanned, then none imports `node:http`, `node:https`, `node:net`, `node:tls`, `node:dns`, or `node:dgram`, and none calls `fetch(`
- **Acceptance tests:** `tests/skill-review/p04-s08.test.mjs`, `tests/skill-review/fixtures/block-network.mjs`
- **Files:** none
- **Patterns:** none (verify card)
- **Decisions:** the test file builds its own fixtures as the other P04 test files do.
- **Do not:** edit `tests/skill-review/**`; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets Q-offline, R63-05; 2 target tests run
- **Stop and report if:** the scenarios fail (Revise adds a `fix` card); a locked test looks wrong; the same failure after 3 attempts.

## S09 - Review fix: write the Review Record before the summary and ledger

- **Kind:** fix
- **Tier:** main
- **Review:** required
- **Restores:** review - a failed Review Record write left a summary and ledger that disagreed with it
- **Files:** edit `.github/tools/skill-review/src/finish.mjs`
- **Done when:** the full suite passes (512 pass, 0 fail excluding Known failures)

## S10 - Review fix: order Observation IDs by number

- **Kind:** fix
- **Tier:** main
- **Review:** required
- **Restores:** review - IDs of 100 or more sorted before O11 in the ledger, summary, and STE check
- **Files:** edit `.github/tools/skill-review/src/observations.mjs`, `ledger.mjs`, `summary.mjs`, `ste.mjs`, `finish.mjs` under `.github/tools/skill-review/src/`
- **Done when:** the full suite passes (512 pass, 0 fail excluding Known failures)
