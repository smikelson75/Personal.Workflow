# P05 - Handoffs, skill-review skill, cleanup

- **Outcome:** `skill-review prepare` finds Handoffs between the four skill pairs from Conversation Logs, the Workflow Folder, and git history, with no model tokens; `slice` serves Handoff evidence; `finish` records Handoffs and their Observations. The `skill-review` skill runs the whole review, `pull-work` suggests it in the Home layout, and `/review-incubate` is gone.
- **Covers:** R55, R56 (not expressible, see below), R62 (Workflow Folder and git signals), R66, R67 (removal and incubate), plus the R52-R54, R60 and R62 rules the skill text states
- **Invariants:**
  - ES modules (`.mjs`), Node built-ins only, no dependencies, no network modules and no `fetch`.
  - Code in `.github/tools/skill-review/src/`; `cli.mjs` `main(argv, env, cwd)` returns `{lines, code}`. Failure is one stdout line `skill-review failed: <category>: <detail>`, exit 1, nothing written.
  - The compact record is written only by `prepare`; the Review Record only by `finish`, `mark-changed`, `record-install`. The model never opens a Conversation Log.
  - A compact Handoff entry is `{id, writingSkill, usingSkill, artifact, state: "pending", writtenAt, writing: {harness, conversation, file, line}, using: null | {harness, conversation, file, line}}`. `id` is `<writingSkill>:<artifact>`. `artifact` is a repo-relative path with `/`; a folder artifact ends in `/`. The Review Record Handoff keeps its P04 shape `{id, writingSkill, usingSkill, artifact, state: "pending"|"reviewed", writtenAt}`.
  - Tests read stable markers only: output lines, record files, `git status --porcelain`, `git log`, and fixed text in skills.
  - Test files are self-contained and build their own fixtures (copy the `makeFixture` pattern of `tests/skill-review/p04-s02.test.mjs`).
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" "tests/skill-review/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R55-10]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Known failures:**
  - `[R29-01] Glossary defines the 13 added terms with Slice and Card separate` - owner P06
  - `[Q-zero-workflow-check-errors] workflow-check passes on repo .workflow/ with zero errors and no Glossary findings` - owner P06
- **Not expressible:**
  - R56 - the known agent-model-pin miss is found "unaided" from the real `home-repo-workflow` history; it needs the model's judgement over a real Conversation history, so no deterministic test exists. Tests cover the parts that feed it: Handoff detection (S01-S02), Depth 0 signals (S03), slices (S04), and decomposition-miss cases (S06). The Developer checks R56 by running `/skill-review` once the phase is done.
  - R55 "chance to recur" for a Handoff of the same writing and using skills - `settleChances` counts uses of the Observation's part only; a Handoff Observation is a skill-part Observation, so its uses count. A separate Handoff chance count is carried forward.
  - R66 "nothing starts a review automatically" - a negative; S08 checks that `pull-work` text names the review only in the suggestion line.
- **Gate:**
  - suite: `node --test --test-reporter=tap --test-skip-pattern="<node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/skill-review/phase-05.md --skip-pattern output>" "tests/**/*.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node --test --test-reporter=tap "tests/skill-review/*.test.mjs" | node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/skill-review/phase-05.md <scenario IDs of S01-S10>`
  - lock: `git diff --exit-code <Tests locked> -- tests/skill-review`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - Pending Handoffs in prepare

- **Kind:** build
- **Goal:** `prepare` writes a `handoffs` array into the compact record with one pending entry per artifact that a skill use of the writing skill wrote.
- **Depends on:** none
- **Tier:** main - creates `handoffs.mjs` and the touched-path extraction that S02-S05 build on
- **Review:** required - creates a shared structure; parses untrusted Conversation Logs; no mutation gate
- **Scenarios:** fixture: `<home>` and `<proj>` git repos, `WORKFLOW_HOME=<home>`, skills `incubate`, `brain-storm`, `behavior-spec`, `work-planner`, `pull-work` installed under `<home>/.claude/skills/`; artifact files exist in `<proj>`; one Copilot Conversation `c1` in `<proj>` with a skill start for the writing skill and then one `tool.execution_start` record `{toolName, arguments:{path}}` with a `timestamp`; "entry" means the item of compact `handoffs` with that `id`
  - R55-10: Given `incubate` in `c1` runs `create` on `<proj>\.workflow\incubations\idea.md` holding the line `Status: graduated`, when `prepare` runs, then the entry `incubate:.workflow/incubations/idea.md` has `usingSkill` `brain-storm`, `state` `pending`, `using` `null`, `writtenAt` equal to the record's `timestamp`, and `writing` `{harness:"Copilot CLI", conversation:"c1", file:<log path>, line:<line of that record>}`
  - R55-11: Given `brain-storm` runs `edit` on `.workflow/sessions/context-a.md` holding `- Status: final`, then the entry `brain-storm:.workflow/sessions/context-a.md` has `usingSkill` `behavior-spec`
  - R55-12: Given `behavior-spec` runs `create` on `.workflow/specs/x-spec.md` (no Status line), then the entry `behavior-spec:.workflow/specs/x-spec.md` has `usingSkill` `work-planner`
  - R55-13: Given `work-planner` runs `create` on `.workflow/plans/x/phase-01.md`, then the entry `work-planner:.workflow/plans/x/` has `artifact` `.workflow/plans/x/` and `usingSkill` `pull-work`
  - R55-14: Given a Claude Code Conversation where `brain-storm` runs a `Write` tool_use with `input.file_path` the absolute path of a `Status: final` session, then that entry exists with `writing.harness` `Claude Code`
  - R55-15: Given the session holds `- Status: draft` (or the incubation `Status: open`), then `handoffs` is `[]` (failure)
  - R55-16: Given the artifact exists but the log holds no skill start before the write, then `handoffs` is `[]` (failure)
  - R55-17: Given `incubate` writes a `Status: final` session, or `brain-storm` writes a `Status: graduated` incubation, then `handoffs` is `[]` (failure)
  - R55-18: Given an unreviewed `pull-work` use and no artifact written, then the compact record has `handoffs` `[]` and still has `notices` as its last key (boundary)
- **Acceptance tests:** `tests/skill-review/p05-s01.test.mjs`
- **Files:** create `.github/tools/skill-review/src/handoffs.mjs`; edit `.github/tools/skill-review/src/records.mjs`; edit `.github/tools/skill-review/src/cli.mjs`
- **Patterns:** `.github/tools/skill-review/src/records.mjs:7 - classifyCopilot and classifyClaude return {role, text, tools, toolError}`; `.github/tools/skill-review/src/uses.mjs:4 - segmentUses(conv, startFn)`; `.github/tools/skill-review/src/cli.mjs:106 - groups of Conversations with their start function`
- **Decisions:**
  - `classify` also returns `touches`: `[{path, write}]` for each tool call whose input holds a path. Copilot: `data.arguments.path` (string) of `tool.execution_start`; `write` is true for `create`, `edit`. Claude: `input.file_path` of an assistant `tool_use`; `write` is true for `Write`, `Edit`, `MultiEdit`. Every other `classify` result gets `touches: []`. Existing return fields stay the same.
  - `handoffs.mjs` exports `findHandoffs({projectRoot, groups, skill})` returning the entries. `groups` is the `groups` array `prepare` builds, scanned over every Conversation with `segmentUses(conv, start)`, ignoring reviewed Positions and the `skill-review` skill. `skill` is the named skill or `null` (S02 uses it).
  - Pairs: `incubate -> brain-storm`: files `.workflow/incubations/*.md` with a line matching `/^[\s>*_-]*Status[\s*_]*:[\s*_]*graduated\b/im`. `brain-storm -> behavior-spec`: `.workflow/sessions/*.md` with the same pattern for `final`. `behavior-spec -> work-planner`: `.workflow/specs/*-spec.md`, no Status check. `work-planner -> pull-work`: one folder artifact `.workflow/plans/<slug>/` for each immediate subfolder; a write to any file inside it counts. Files are read from `<projectRoot>` at `prepare` time; a missing file or folder gives no entry.
  - A touch matches an artifact when its path, resolved against `projectRoot`, with `\` replaced by `/` and lower-cased, equals the artifact path (or starts with it for a folder).
  - A write touch belongs to the use whose `start..end` holds its line. The writing end is the earliest write touch (by record `timestamp`, then harness, then Conversation ID) inside a use of the writing skill. A touch whose record has no `timestamp` is ignored. `writtenAt` is that timestamp string as written. `writing.line` is that record's line number.
  - Entries sort by `id`. The key `handoffs` sits after `conversations` and before `tokens`; `notices` stays last. `using` is always `null` in this card.
  - `prepare` still prints `skill-review: nothing to review` and writes no compact record when it has no unreviewed use (S02 changes this for Handoffs).
- **Do not:** edit `tests/skill-review/**`; add dependencies; change `finish`, `slice`, or the summary; read message text into the record.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R55-10 to R55-18; 9 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; an earlier test compares the whole compact record by deep equality and fails on the new key; the same failure after 3 attempts.

## S02 - Using end, named skill, Handoff-only run

- **Kind:** build
- **Goal:** `prepare` finds the first later use of the using skill that read each artifact, filters Handoffs by a named skill, and treats a Handoff with both ends as reviewable work.
- **Depends on:** S01
- **Tier:** delegate - extends `findHandoffs` and one `if` in `prepare` using the pinned rules
- **Review:** required - parses untrusted Conversation Logs
- **Scenarios:** fixture: S01's fixture; the artifact is `.workflow/plans/x/` written by `work-planner` in Copilot `c1` at `2026-11-20T10:00:00.000Z`, unless stated
  - R55-19: Given a Claude Code Conversation `k1` where `pull-work` runs a `Read` of `<proj>\.workflow\plans\x\plan.md` at `2026-11-21T09:00:00.000Z` (line 7), when `prepare` runs, then the entry has `using` `{harness:"Claude Code", conversation:"k1", file:<log path>, line:7}` and `state` still `pending`
  - R55-20: Given the only read is by `behavior-spec`, or by `pull-work` at `2026-11-19T09:00:00.000Z` (before the write), then `using` is `null` (failure)
  - R55-21: Given `pull-work` reads the folder in `k1` at 2026-11-23 and in `c2` (Copilot, `view` of `plan.md`) at 2026-11-21, then `using.conversation` is `c2` (boundary)
  - R55-22: Given the Review Record holds Positions for `c1` and `k1` at their last lines, so neither has an unreviewed use, and the Handoff has both ends, then `prepare` still lists the entry and writes the compact record with `conversations` `[]` and prints `skill-review: prepared 0 skill uses in 0 Conversations` (R54 Handoff evidence)
  - R55-23: Given a pending Handoff (no using end) and no unreviewed use, when `prepare` runs, then it prints `skill-review: nothing to review` and writes no compact record (boundary)
  - R55-24: Given a Review Record Handoff `{id:"work-planner:.workflow/plans/x/", ..., "state":"reviewed"}`, then `prepare` omits that entry (boundary)
  - R53-03: Given the three Handoffs `incubate -> brain-storm`, `brain-storm -> behavior-spec`, `behavior-spec -> work-planner` all written, when `prepare brain-storm` runs, then `handoffs` holds the first two and no third; `prepare work-planner` holds the last two
- **Acceptance tests:** `tests/skill-review/p05-s02.test.mjs`
- **Files:** edit `.github/tools/skill-review/src/handoffs.mjs`; edit `.github/tools/skill-review/src/cli.mjs`
- **Patterns:** `.github/tools/skill-review/src/handoffs.mjs:1 - findHandoffs and the touch matching from S01`; `.github/tools/skill-review/src/cli.mjs:142 - the nothing-to-review check`
- **Decisions:**
  - The using end is the earliest read touch (`write` false, same matching as S01) by record `timestamp`, then harness, then Conversation ID, inside a use of the using skill, with a `timestamp` after `writtenAt`. `using` is `{harness, conversation, file, line}` of that record. Any harness.
  - `findHandoffs` receives the Review Record's `handoffs`; it drops an entry whose `id` is `reviewed` there.
  - With a named `skill`, keep an entry only when `skill` is its `writingSkill` or `usingSkill`.
  - `prepare` prints `nothing to review` and writes nothing only when it has no unreviewed use and no entry with `using` not `null`. Otherwise it writes the compact record; `tokens.depth1` counts the whole record as today.
- **Do not:** edit `tests/skill-review/**`; touch `finish`, `slice`, or the summary; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R55-19 to R55-24, R53-03; 7 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S03 - Workflow Folder and git signals

- **Kind:** build
- **Goal:** each compact Handoff entry carries signals from its artifact and git history, and two flags.
- **Depends on:** S02
- **Tier:** delegate - adds pinned fields to the entry
- **Review:** required - spawns git processes
- **Scenarios:** fixture: S02's fixture with `using` set (a `pull-work` `Read` of `plan.md`), the folder `.workflow/plans/x/` holding `plan.md` (3 lines starting `## `, 120 bytes) and `phase-01.md` (1 line starting `## `, 30 bytes), committed in `<proj>`
  - R62-18: Given that fixture, when `prepare` runs, then the entry has `signals` `{bytes:150, sections:4, revisionsAfterWrite:0, readsInUse:1}` and `flags` `[]`
  - R62-19: Given a commit touching `phase-01.md` with committer date `2026-11-22T00:00:00Z` and `writtenAt` `2026-11-20T10:00:00.000Z`, then `revisionsAfterWrite` is 1 and `flags` is `[{kind:"artifact-revised"}]`; with the commit dated `2026-11-19T00:00:00Z` it is 0 and no flag
  - R62-20: Given the using use reads the folder 3 times (`Read` of `plan.md` twice and `view` of `phase-01.md` once), then `readsInUse` is 3 and `flags` is `[{kind:"artifact-reread"}]`; given 2 reads, no flag
  - R62-21: Given a Handoff with `using` `null`, then `readsInUse` is 0 and the other signals are still set (boundary)
  - R62-22: Given `git status --porcelain` in `<proj>` before `prepare`, when it ends, then the output is identical, and every entry lists only paths, ids, numbers, and timestamps (R63, R64)
- **Acceptance tests:** `tests/skill-review/p05-s03.test.mjs`
- **Files:** edit `.github/tools/skill-review/src/handoffs.mjs`
- **Patterns:** `.github/tools/skill-review/src/cli.mjs:57 - spawnSync git with cwd and encoding utf8`; `.github/tools/skill-review/src/signals.mjs:9 - signals and flags objects`
- **Decisions:**
  - `bytes` is the sum of file sizes, and `sections` the count of lines starting `## `, of the artifact file, or of the `.md` files directly inside a folder artifact.
  - `revisionsAfterWrite` is the count of `git log --format=%cI -- <artifact>` lines (run in `projectRoot` with `spawnSync`, no shell) whose date is after `writtenAt`; 0 when git fails.
  - `readsInUse` is the count of read touches of the artifact (S01 matching) inside the using use's `start..end`; 0 when `using` is `null`. The using use is the one holding `using.line` in `using.conversation`.
  - `flags` is `artifact-revised` when `revisionsAfterWrite >= 1`, then `artifact-reread` when `readsInUse >= 3`, each as `{kind}`.
  - Keys of the entry after this card: `id, writingSkill, usingSkill, artifact, state, writtenAt, writing, using, signals, flags`.
- **Do not:** edit `tests/skill-review/**`; use a shell string for git; call the network; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R62-18 to R62-22; 5 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S04 - Slice serves Handoff ends

- **Kind:** build
- **Goal:** `slice` serves the record at a Handoff end line with its neighbours, capped at 8,000 characters, even when that Conversation has no unreviewed use.
- **Depends on:** S02
- **Tier:** delegate - extends one lookup in `slice.mjs`
- **Review:** none
- **Scenarios:** fixture: the compact record from `prepare` in S02's R55-22 fixture (Handoff with both ends, `conversations` `[]`); `c1` log has a 9,000-character `assistant` message at the writing line
  - R62-23: Given `slice <record> c1 <writing.line>`, when it runs, then it prints `slice: c1 line <n>`, the record with its neighbours as `[n] label: text` lines (flagged record cut to 5,800 characters with `...[truncated]`), and `skill-review: model tokens: depth 2: <n>`, and the compact record gains `slices` and `tokens.depth2`
  - R62-24: Given `slice <record> k1 <using.line>`, then the Claude record is served the same way
  - R62-25: Given a line that is neither a flagged use line nor a Handoff end line, then `skill-review failed: not-flagged: c1 line 3` and the record is unchanged (failure)
- **Acceptance tests:** `tests/skill-review/p05-s04.test.mjs`
- **Files:** edit `.github/tools/skill-review/src/slice.mjs`
- **Patterns:** `.github/tools/skill-review/src/slice.mjs:21 - isFlagged and the Conversation lookup`
- **Decisions:**
  - A line is servable when it is a use flag line (as today) or equals `writing.line` or `using.line` of a Handoff in `record.handoffs` whose `conversation` is the given ID. The log file is that end's `file`. A Conversation found in `conversations` keeps its own `file`.
  - `unknown-conversation` stays for an ID found in neither `conversations` nor a Handoff end.
- **Do not:** edit `tests/skill-review/**`; change the caps or output lines; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R62-23 to R62-25; 3 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S05 - Finish records Handoffs

- **Kind:** build
- **Goal:** `finish` stores each compact Handoff in the Review Record as reviewed (judged) or pending, and counts both in the summary and Ledger.
- **Depends on:** S02
- **Tier:** main - reshapes the `finish` flow that S06 extends
- **Review:** required - changes a persisted format; no mutation gate
- **Scenarios:** fixture: P04 S02's fixture; compact record `{project:"Scheduler",conversations:[...],handoffs:[H],...}` with `H` `{id:"behavior-spec:.workflow/specs/x-spec.md",writingSkill:"behavior-spec",usingSkill:"work-planner",artifact:".workflow/specs/x-spec.md",state:"pending",writtenAt:"2026-11-20T10:00:00.000Z",writing:{...},using:{...}}`; `SKILL_REVIEW_NOW=2026-11-26T14:05:00`
  - R55-25: Given one `pull-work` use and the judgement `{cases:[],handoffs:[{id:"behavior-spec:.workflow/specs/x-spec.md"}]}`, when `finish` runs, then the Review Record `handoffs` holds `{id, writingSkill, usingSkill, artifact, state:"reviewed", writtenAt}` for `H`, and the summary `Reviewed:` line ends `1 Handoffs; pending Handoffs: 0`
  - R55-26: Given `H` with `using` `null` and judgement `{cases:[]}`, then the Review Record holds `H` with `state` `pending`, the `Reviewed:` line ends `0 Handoffs; pending Handoffs: 1`, and `ledger.md` lists `.workflow/specs/x-spec.md` with its age in days
  - R55-27: Given `finish` ran with `H` reviewed, when `prepare` runs again with no new uses, then it prints `skill-review: nothing to review`
  - R55-28: Given the judgement names a Handoff `id` that is not in the compact record, or one whose `using` is `null`, then `skill-review failed: judgement-invalid: handoff <id>` and no file changes (failure)
  - R55-29: Given the Review Record already holds `H` pending with `writtenAt` `2026-11-19T00:00:00.000Z` and the compact `H` has a later `writtenAt`, when `finish` runs without a judgement entry for it, then the stored `writtenAt` stays `2026-11-19T00:00:00.000Z` (boundary)
  - R55-30: Given no unreviewed use (`conversations` `[]`) and `H` judged, when `finish` runs, then a summary and `ledger.md` are written, `Reviewed:` is `0 Conversations, 0 skill uses (none), 1 Handoffs; pending Handoffs: 0`, and the stdout line is `skill-review: reviewed 0 skill uses in 0 Conversations` (boundary)
- **Acceptance tests:** `tests/skill-review/p05-s05.test.mjs`
- **Files:** edit `.github/tools/skill-review/src/finish.mjs`; edit `.github/tools/skill-review/src/summary.mjs`
- **Patterns:** `.github/tools/skill-review/src/finish.mjs:79 - the finish flow and Review Record write order`; `.github/tools/skill-review/src/summary.mjs:77 - the Reviewed line`
- **Decisions:**
  - `judgement.handoffs` is an array of `{id}`. Each `id` must match a compact Handoff with `using` not `null`; any other gives `judgement-invalid` with detail `handoff <id>`, found before any write.
  - After the cases are applied, every compact Handoff is upserted into `record.handoffs` by `id`: judged -> `state` `reviewed`; not judged -> `pending`. An existing entry keeps its `writtenAt` when its state is `pending`. Only the six P04 keys are stored.
  - The summary and Ledger are written when `uses > 0` or at least one Handoff was judged. The Reviewed line shows `(none)` for no skill names. `handoffsReviewed` is the count of judged Handoffs.
  - The Review Record is still written first.
- **Do not:** edit `tests/skill-review/**`; change case validation (S06); add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R55-25 to R55-30; 6 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S06 - Handoff cases and sides

- **Kind:** build
- **Goal:** a judgement case can name a Handoff, and its Miss Label or kind sets which skill the Observation is against.
- **Depends on:** S05
- **Tier:** delegate - extends `applyCases` with pinned rules
- **Review:** required - changes a persisted format
- **Scenarios:** fixture: S05's fixture with the judgement `handoffs` `[{id:"behavior-spec:.workflow/specs/x-spec.md"}]`; a Handoff case is `{handoff:"<that id>", ref:"A", label:"translation miss", outcome:"part change", fixType:"clarified rule", fixReason:"A check cannot find a dropped rule.", description:"The spec dropped rule R7 of the Session."}`
  - R55-31: Given that case, when `finish` runs, then `observation: O01 new` is printed and O01 has `part` `work-planner`, `side` `using`, `label` `translation miss`, `cases` 1
  - R55-32: Given `label` `capture miss`, and then `decomposition miss`, then `part` is `behavior-spec` and `side` `writing`
  - R55-33: Given `kind` `restated or re-verified` (no label) then `part` is `work-planner`, `side` `using`; given `section never used`, `part` is `behavior-spec`, `side` `writing`
  - R55-34: Given `side` `both`, then `part` is `behavior-spec + work-planner`, `side` `both`, and after two cases O01 stays `watching` (boundary)
  - R55-35: Given a case with `handoff` not listed in `judgement.handoffs`, or with both `handoff` and `conversation`, or with `label` `requirements miss`, then `skill-review failed: judgement-invalid: case <n>: <reason>` and no file changes (failure)
  - R55-36: Given O01 exists watching with 1 case and a Handoff case with `match` `O01`, then O01 has 2 cases and is `confirmed`
  - R55-37: Given a Conversation case with `kind` `restated or re-verified`, then `judgement-invalid` for that case (failure)
  - R55-38: Given a Handoff case with `outcome` `part change` and no `fixType`, then `judgement-invalid: case <n>: fix filter missing` (failure)
- **Acceptance tests:** `tests/skill-review/p05-s06.test.mjs`
- **Files:** edit `.github/tools/skill-review/src/observations.mjs`; edit `.github/tools/skill-review/src/finish.mjs`
- **Patterns:** `.github/tools/skill-review/src/observations.mjs:148 - applyCases validation and the per-case flow`
- **Decisions:**
  - `applyCases(record, compact, cases, handoffIds)` gets the judged Handoff IDs as a fourth argument; `finish` passes them. Existing callers' results stay the same.
  - A case with a string `handoff` skips the Position check. It is invalid when it also has `conversation`, when `handoff` is not in `handoffIds`, or when `label` is `requirements miss`. The writing and using skills come from the compact Handoff.
  - Side: `capture miss`, `decomposition miss`, `section never used` -> `writing`; `translation miss`, `restated or re-verified` -> `using`; `side: "both"` overrides to `both`. `part` is the writing skill, the using skill, or `<writing> + <using>`; a given `part` is ignored. The new Observation stores `side`.
  - `KINDS` stays as it is for Conversation cases. A Handoff case also accepts `restated or re-verified` and `section never used`; a Conversation case with them is invalid. A Handoff case with `kind` still needs exactly one of `kind` or `label`, as for any case.
  - An Observation with `side` `both` never leaves `watching`; its cases still add up.
  - Handoff cases add nothing to `hits` (no Conversation Position).
- **Do not:** edit `tests/skill-review/**`; change the requirements-miss flow; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R55-31 to R55-38; 8 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S07 - The skill-review skill

- **Kind:** build
- **Goal:** `/skill-review` exists as a skill that runs `prepare`, `slice`, `finish`, and `commit` in order, and is documented.
- **Depends on:** S04, S06
- **Tier:** main - the skill text is a public interface that judgement-writing depends on
- **Review:** required - changes a public interface; no mutation gate
- **Scenarios:** fixture: the repository files; `skill = read('.github/skills/skill-review/SKILL.md')`
  - R52-21: Given `SKILL.md`, then its frontmatter has `name: skill-review`, a `description`, and `user-invocable: true`
  - R52-22: Given the body, then it holds the four lines starting with `node "$WORKFLOW_HOME/.workflow-core/tools/skill-review/bin/skill-review.mjs"` and ending `prepare`, `slice`, `finish`, and `commit` (each with its arguments), in that order
  - R53-05: Given the body, then it says the optional `<skill>` argument goes to `prepare` and nothing else
  - R54-11: Given the body, then it says `finish` and `commit` are the only steps that write records, and that a stopped run writes nothing
  - R62-26: Given the body, then it says the model never opens a Conversation Log and reads only `prepare` output and `slice` output
  - R60-08: Given the body, then it says to run `finish --attempt 1`, then `--attempt 2`, then `--attempt 3` on `ste-check` or `privacy-check` failures, and to stop after attempt 3
  - R67-06: Given the body, then it says that when `prepare` prints `skill-review failed: home-layout-required`, the skill shows that line and stops
  - R67-07: Given `README.md`, then it links `./.github/skills/skill-review/README.md` in both the model table and the deep-dive list, and the skill folder holds `README.md`
- **Acceptance tests:** `tests/skill-review/p05-s07.test.mjs`
- **Files:** create `.github/skills/skill-review/SKILL.md`; create `.github/skills/skill-review/README.md`; edit `README.md`
- **Patterns:** `.github/skills/onboard-project/SKILL.md:1 - frontmatter`; `.github/skills/pull-work/README.md:1 - skill README layout and model table`; `README.md:178 - table row and deep-dive bullet`
- **Decisions:**
  - Body sections: Inputs, Steps, Judgement file, Failures. Steps: 1 `prepare [<skill>] --out <compact-record>`; 2 for each flagged line and each Handoff end the model wants, `slice <compact-record> <Conversation ID> <line>`; 3 the model writes the judgement file `{cases:[...], handoffs:[{id}]}` with the case keys of P03 and S06; 4 `finish <compact-record> <judgement> --attempt <n>`; 5 `commit <compact-record>`.
  - The skill states the Handoff pairs of R55 and that a Handoff artifact may be read by the model with its own tools (it is not a Conversation Log).
  - Every sentence is STE: at most 20 words in lists of steps, 25 elsewhere.
  - README model row: `claude-sonnet-5.5`, `gpt-6.1-terra`, `gemini-4-neon`, `medium`, raise to `high` for Phases with many flagged slices or Handoffs.
- **Do not:** edit `tests/skill-review/**`; change the CLI; edit other skills.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R52-21, R52-22, R53-05, R54-11, R62-26, R60-08, R67-06, R67-07; 8 target tests run; `node .github/tools/workflow-check/bin/workflow-check.mjs` adds no error beyond the baseline
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; `workflow-check` reports a new error for the skill; the same failure after 3 attempts.

## S08 - pull-work suggests a review

- **Kind:** build
- **Goal:** the `pull-work` Phase-completion brief ends with the review suggestion in the Home layout only.
- **Depends on:** none
- **Tier:** delegate - one pinned edit in one section
- **Review:** none
- **Scenarios:** fixture: `brief = section(read('.github/skills/pull-work/SKILL.md'), '## Brief')`
  - R66-01: Given `brief`, then it has a line exactly `Next: run /skill-review to review this Phase's Conversations.`
  - R66-02: Given `brief`, then the sentence before that line says to end the brief with it when a Phase completes and `WORKFLOW_HOME` is set, and says the line is not printed in the copy layout
  - R66-03: Given the whole `SKILL.md`, then no other line holds `/skill-review` or `skill-review.mjs` (boundary)
- **Acceptance tests:** `tests/skill-review/p05-s08.test.mjs`
- **Files:** edit `.github/skills/pull-work/SKILL.md`
- **Patterns:** `.github/skills/pull-work/SKILL.md:164 - the Brief section`
- **Decisions:** append to `## Brief` one paragraph: `In the Home layout (WORKFLOW_HOME is set), end the brief of a completed Phase with this line: ` followed on its own line by the suggestion line. `In the copy layout, do not print it.` The `section` helper is copied from `tests/glossary-alignment/p02-s03.test.mjs:14`.
- **Do not:** edit `tests/skill-review/**`; edit other sections; add a command that starts a review.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R66-01 to R66-03; 3 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S09 - /review-incubate removed

- **Kind:** build
- **Goal:** the hand-run review prompt is gone and nothing in Workflow Core names it.
- **Depends on:** none
- **Tier:** delegate - one file removal
- **Review:** none
- **Scenarios:** fixture: the repository files
  - R67-03: Given the repository, then `.github/prompts/review-incubate.prompt.md` does not exist
  - R67-04: Given every file under `.github/`, `home/`, `scripts/`, `language-addons/`, plus `README.md`, then none contains `review-incubate`
- **Acceptance tests:** `tests/skill-review/p05-s09.test.mjs`
- **Files:** delete `.github/prompts/review-incubate.prompt.md`
- **Patterns:** none - a removal; the test walks folders with `readdirSync` as in `tests/glossary-alignment/p02-s03.test.mjs:1`
- **Decisions:** `docs/research/incubate-session-review.md` stays; it is not Workflow Core and names no prompt.
- **Do not:** edit `tests/skill-review/**`; delete other files.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R67-03, R67-04; 2 target tests run
- **Stop and report if:** another file must change; a locked test looks wrong; the same failure after 3 attempts.

## S10 - incubate is reviewed like any skill

- **Kind:** verify
- **Goal:** an unreviewed `incubate` Conversation is reviewed by the existing flow.
- **Depends on:** none
- **Tier:** delegate - a check on existing code
- **Review:** none
- **Scenarios:** fixture: S01's fixture
  - R67-05: Given an unreviewed Copilot `incubate` Conversation and a judgement `{cases:[]}`, when `prepare` and `finish` run, then the compact record lists the `incubate` use and the summary `Reviewed:` line names `incubate`
- **Acceptance tests:** `tests/skill-review/p05-s10.test.mjs`
- **Files:** none
- **Patterns:** none - no new files
- **Decisions:** none; the test is expected to pass on the current code. A failure sets the slice `blocked`.
- **Do not:** edit any file.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; target R67-05; 1 target test runs
- **Stop and report if:** the target test fails.
