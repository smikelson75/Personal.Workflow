# P02 - Depth 0 signals, flags, slices, tokens

- **Outcome:** `prepare` adds Depth 0 signals and flags to each skill use in the compact record, with no message text in it. `skill-review slice <compact-record> <Conversation ID> <line>` prints one flagged slice of at most 8,000 characters. Both commands report the model tokens they hand to the model, per Depth.
- **Covers:** R62 (Conversation Log signals, flags, slices, tokens; Workflow Folder and git signals belong to P05 Handoff review), Q-model-reading
- **Invariants:**
  - ES modules (`.mjs`), Node built-ins only, no dependencies, no network modules and no `fetch`.
  - Code in `.github/tools/skill-review/src/`; CLI entry `bin/skill-review.mjs` calls `main(argv, env, cwd)` in `src/cli.mjs`, which returns `{lines, code}`. Failure is one stdout line `skill-review failed: <category>: <detail>`, exit 1, nothing written.
  - A Position is a 1-based physical line number of a Conversation Log file.
  - The compact record never holds Conversation Log text: only IDs, Positions, skill names, counts, and flag kinds.
  - Tests read stable markers only: output lines, the compact-record JSON, `git status --porcelain`.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" "tests/skill-review/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R62-01]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Known failures:**
  - `[R29-01] Glossary defines the 13 added terms with Slice and Card separate` - owner P06
  - `[Q-zero-workflow-check-errors] workflow-check passes on repo .workflow/ with zero errors and no Glossary findings` - owner P06
- **Not expressible:**
  - R62 "the run's own Conversation Log shows no read of that Log file" - a model behavior; the tests check that the compact record holds no Log text and that `slice` is the only path to Log text. The `skill-review` skill (P05) tells the model to call `slice` and never open a Log file.
  - R62 "0 model tokens at Depth 0" and Q-offline - tested in P04 by absence of network and model modules in the tool sources
- **Gate:**
  - suite: `node --test --test-reporter=tap --test-skip-pattern="<node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/skill-review/phase-02.md --skip-pattern output>" "tests/**/*.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node --test --test-reporter=tap "tests/skill-review/*.test.mjs" | node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/skill-review/phase-02.md <scenario IDs of S01-S03>`
  - lock: `git diff --exit-code <Tests locked> -- tests/skill-review`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - Signals and flags in the compact record

- **Kind:** build
- **Goal:** each use in the compact record carries `signals` and `flags` computed from the Log records in `from`..`end`.
- **Depends on:** none
- **Tier:** main - creates `records.mjs` (record classification), which S02 extends
- **Review:** required - parses untrusted input; creates a shared structure; no mutation gate
- **Scenarios:** fixture: P01's fixture (Copilot logs: line is `{"type","data","id","timestamp","parentId"}`; Claude logs: line is `{"type","cwd","sessionId","message"}`); the use is `pull-work` unless stated
  - R62-01: Given Copilot `c1`: line 1 `session.start`, 2 `skill.invoked`, 3 `user.message` "go", 4 `assistant.message` with 4001 characters of content, 5 `tool.execution_start` toolName `ask_user`, 6 `tool.execution_complete` success false, 7 `user.message` "no, stop that", 8 `assistant.message` "ok"; when `prepare` runs, then the use `pull-work` 2-8 has `signals` `{records:7, userMessages:2, assistantMessages:2, toolCalls:1, questions:1, toolErrors:1, longestAssistantChars:4001}` and `flags` `[{kind:"long-message",line:4},{kind:"tool-error",line:6},{kind:"user-correction",line:7}]`
  - R62-02: Given R62-01's fixture, when `prepare` runs, then the compact-record file text contains neither the 4001-character content nor `no, stop that` (privacy)
  - R62-03: Given Claude `k1`: line 1 `user` "hi" with `cwd`, 2 `user` content `<command-name>/pull-work</command-name>`, 3 `assistant` content `[{"type":"tool_use","name":"AskUserQuestion","input":{}}]`, 4 `user` content `[{"type":"tool_result","is_error":true,"content":"boom"}]`, 5 `assistant` content `[{"type":"text","text":"done"}]`; when it runs, then the use 2-5 has `signals` `{records:4, userMessages:1, assistantMessages:2, toolCalls:1, questions:1, toolErrors:1, longestAssistantChars:4}` and `flags` `[{kind:"tool-error",line:4}]`
  - R62-04: Given Copilot `c1` with `skill.invoked` at line 2 and `tool.execution_start` `ask_user` on lines 3-8, when it runs, then `flags` is `[{kind:"many-questions",line:7}]` and `signals.questions` is 6
  - R62-05: Given the same with `ask_user` on lines 3-6 only (4 questions), when it runs, then `flags` is `[]` (boundary)
  - R62-06: Given `skill.invoked` at line 2 and `tool.execution_complete` with success false on lines 3-9, when it runs, then `flags` holds 5 entries, `tool-error` on lines 3-7 (cap)
  - R62-07: Given R62-01's fixture with a second long `assistant.message` (4001 characters) at line 7 and a review record `{"Copilot CLI:c1":{"pull-work":5}}`, when it runs, then `from` is 6, `signals.records` is 3 and `flags` is `[{kind:"long-message",line:7}]` (boundary)
- **Acceptance tests:** `tests/skill-review/p02-s01.test.mjs`
- **Files:** create `.github/tools/skill-review/src/records.mjs`; create `.github/tools/skill-review/src/signals.mjs`; edit `.github/tools/skill-review/src/cli.mjs`
- **Patterns:** `.github/tools/skill-review/src/uses.mjs:30 - claudeSkillStart and the Claude record shapes`; `.github/tools/skill-review/src/uses.mjs:26 - copilotSkillStart`
- **Decisions:**
  - `records.mjs` exports `classify(rec, harness)` returning `{role, text, tools, toolError}`; `role` is `user`, `assistant`, `tool-start`, `tool-result`, or `other`; `text` is a string (`''` when none); `tools` is an array of tool names; `toolError` is a boolean.
  - Copilot: `user.message` is `user` with `data.content`; `assistant.message` is `assistant` with `data.content`, `tools` `[]`; `tool.execution_start` is `tool-start` with `tools` `[data.toolName]`; `tool.execution_complete` is `tool-result` with `text` = `data.result.content` when a string, `toolError` = `data.success === false`; every other type, and a missing field, is `other` or `''`.
  - Claude: a `user` record with string `message.content` is `user`; with an array holding a `tool_result` item it is `tool-result`, `text` = that item's string `content`, `toolError` = any such item has `is_error === true`; an `assistant` record is `assistant`, `text` = the joined `text` items, `tools` = the `name` of each `tool_use` item; a `tool_use` item counts as a tool call.
  - `signals.mjs` exports `useSignals(conversation, use, classifyFn)` returning `{signals, flags}`; it reads physical lines `use.from`..`use.end`; an unparseable line counts in `records` only.
  - `signals` keys, in this order: `records` (lines read), `userMessages` (`user` role), `assistantMessages`, `toolCalls` (sum of `tools.length`), `questions` (tool names `ask_user` or `AskUserQuestion`), `toolErrors` (`toolError` true), `longestAssistantChars` (max `text.length` of `assistant` records, 0 when none).
  - Flag kinds: `long-message` (`assistant` text longer than 4000 characters, at that line); `tool-error` (`toolError` true, at that line); `many-questions` (5 or more questions, one flag at the line of the fifth); `user-correction` (`user` text, trimmed, matches `/^(no|stop|wrong|don't|do not|that's not|that is not)\b/i`, at that line). Flags are sorted by line, then kind, and cut to the first 5.
  - `cli.mjs` adds `signals` and `flags` to each kept use in the compact record; the existing keys and the stdout lines do not change.
- **Do not:** edit `tests/skill-review/**`; write message text into the compact record; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R62-01 to R62-07; 7 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S02 - Flagged slices

- **Kind:** build
- **Goal:** `slice` prints the flagged record with the record before and after it, at most 8,000 characters, and refuses any line that is not flagged.
- **Depends on:** S01
- **Tier:** delegate - one new command built on `classify`; sizes and formats are pinned
- **Review:** required - parses untrusted input; the only path from Log text to the model
- **Scenarios:** fixture: S01's fixture and a compact record written by `prepare --out <file>`
  - R62-08: Given R62-01's compact record, when `slice <record> c1 4` runs, then stdout is `slice: c1 line 4`, then `[3] user: go`, `[4] assistant: ` followed by the 4001 characters, `[5] tool: ask_user`, then a last line `skill-review: model tokens: depth 2: <n>`, and exit is 0
  - R62-09: Given a Copilot `c1` of 3 lines with `skill.invoked` at line 2 and a failing `tool.execution_complete` at line 3 (the last line), when `slice <record> c1 3` runs, then the body has 2 lines, `[2]` and `[3]` (boundary)
  - R62-10: Given R62-01's record, when `slice <record> c1 3` runs, then stdout is `skill-review failed: not-flagged: c1 line 3`, exit is 1 (failure)
  - R62-11: Given R62-01's record, when `slice <record> zz 4` runs, then stdout is `skill-review failed: unknown-conversation: zz`, exit is 1 (failure)
  - R62-12: Given R62-03's Claude record, when `slice <record> k1 4` runs, then the body line `[4]` is `[4] tool-result: ERROR boom`
  - Q-model-reading: Given a `long-message` flag on line 4 with 50,000 characters of content, line 3 a `user.message` of 3,000 characters, and line 5 a `tool.execution_start` of `view`, when `slice <record> c1 4` runs, then the body (lines joined with `\n`) is at most 8,000 characters, line `[3]` text is at most 1,000 characters, line `[4]` ends with `...[truncated]`, and the compact-record file holds no run of 100 identical content characters
- **Acceptance tests:** `tests/skill-review/p02-s02.test.mjs`
- **Files:** create `.github/tools/skill-review/src/slice.mjs`; edit `.github/tools/skill-review/src/records.mjs`; edit `.github/tools/skill-review/src/cli.mjs`
- **Patterns:** `.github/tools/skill-review/src/signals.mjs:1 - reading a use's lines through classify`; `.github/tools/skill-review/src/cli.mjs:1 - main and the fail function`
- **Decisions:**
  - Command: `skill-review slice <compact-record-file> <Conversation ID> <line>`; any other shape is `skill-review failed: usage: skill-review slice <compact-record-file> <Conversation ID> <line>`. An unreadable record file is `skill-review failed: record-unreadable: <path>`.
  - The Conversation is the first in the compact record whose `id` matches. A line is flagged when some `flags` entry of some use of that Conversation has that `line`. Check order: record file, Conversation, flagged.
  - `records.mjs` gains `renderRecord(rec, harness)`: `user` -> `user: <text>`; `assistant` -> `assistant: <text>`; `tool-start` -> `tool: <tools joined by ", ">`; `tool-result` -> `tool-result: ` plus `ERROR ` when `toolError`, then the text; anything else (and an unparseable line) -> `other: <type>` or `other: unparseable`. Newlines in the text become single spaces.
  - Slice body: for each existing physical line in `line-1`..`line+1`, one body line `[<n>] <rendered>`. Text caps, counted inside the cap with the marker: 1,000 characters for a neighbour, 5,800 for the flagged line; a longer text is cut and ends with `...[truncated]`. With the prefixes the body stays under 8,000 characters.
  - Stdout: `slice: <id> line <n>`, the body lines, then `skill-review: model tokens: depth 2: <n>` (S03 defines `<n>`; in this card print `0`).
  - `slice` reads the Log file named by the compact record's `file`; it writes nothing.
- **Do not:** edit `tests/skill-review/**`; write any file; change the compact-record shape; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R62-08 to R62-12, Q-model-reading; 6 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S03 - Model tokens per Depth

- **Kind:** build
- **Goal:** `prepare` and `slice` report the characters given to the model divided by 4, rounded up, per Depth, and keep the running totals in the compact record.
- **Depends on:** S02
- **Tier:** delegate - arithmetic and one record update, fully pinned
- **Review:** none
- **Scenarios:** fixture: S02's fixture
  - R62-13: Given R62-01's fixture, when `prepare` runs, then the stdout line just before `skill-review: prepared ...` is `skill-review: model tokens: depth 1: <n>`, where `<n>` is `ceil(L/4)` and `L` is the length of `JSON.stringify({project, conversations}, null, 2)` rebuilt from the record file; and the record file has `tokens` `{depth1:<n>, depth2:0}`
  - R62-14: Given that record, when `slice <record> c1 4` runs, then the last line is `skill-review: model tokens: depth 2: <m>`, `<m>` is `ceil(C/4)` with `C` the length of the body lines joined with `\n`, and the record file has `tokens` `{depth1:<n>, depth2:<m>}` and `slices` `[{id:"c1",line:4,chars:C}]`
  - R62-15: Given R62-14's state, when `slice <record> c1 7` runs and then `slice <record> c1 4` runs again, then `slices` holds the two entries once each and `tokens.depth2` is `ceil((C4 + C7)/4)`
  - R62-16: Given nothing to review, when `prepare` runs, then no stdout line contains `model tokens` and no record file is written (boundary)
- **Acceptance tests:** `tests/skill-review/p02-s03.test.mjs`
- **Files:** create `.github/tools/skill-review/src/tokens.mjs`; edit `.github/tools/skill-review/src/slice.mjs`; edit `.github/tools/skill-review/src/cli.mjs`
- **Patterns:** `.github/tools/skill-review/src/cli.mjs:1 - where prepare writes the compact record`
- **Decisions:**
  - `tokens.mjs` exports `tokensOf(chars)` returning `Math.ceil(chars / 4)`.
  - `prepare` writes the record file as `JSON.stringify({project, conversations, tokens: {depth1, depth2: 0}}, null, 2)`; `depth1` is `tokensOf(length of JSON.stringify({project, conversations}, null, 2))`.
  - `slice` rewrites the record file with `slices` (array of `{id, line, chars}`, one entry per `id` and `line`, in the order first sliced) and `tokens.depth2` = `tokensOf(sum of chars)`; it keeps every other key. `chars` is the length of the body lines joined with `\n`.
  - `slice` is the only command that rewrites the record file; its failure lines write nothing.
- **Do not:** edit `tests/skill-review/**`; count anything but `prepare`'s record and slice bodies; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/skill-review/*.test.mjs"` exits 0; targets R62-13 to R62-16; 4 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.
