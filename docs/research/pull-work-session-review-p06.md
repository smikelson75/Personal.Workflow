# Pull-Work Session Review: home-repo-workflow P06 (Reconcile → Plan → Phase Review → S02 stop)

**Purpose:** a retrospective review of one real `/pull-work` session: rule slips, wasted or expensive tokens, delegation choices, compaction, and tuning opportunities. Its style follows `docs/research/incubate-session-review.md`.

**Rules in effect:** commit `7ede1a4`: `.github/skills/pull-work/SKILL.md`, `.github/skills/work-planner/SKILL.md` and `references/PHASE-FORMAT.md` (loaded mid-run), `.github/agents/coder.agent.md` (the contract for `main` cards), `.github/agents/test-author.agent.md`, `.github/user-interaction.md`, the `guard-locked-tests` hook, and the `AGENTS.md` mission.

**Evidence:** the Copilot CLI session log (`events.jsonl`) (1,032 events), read in order with node scripts. Session commits: `026d516`, `21b086a`, `16d8d09`, `2fd69a3`, `125ad53`. Follow-up commits from the next session (`39a80fb` … `4bbc37d`) are used only to confirm what the rework cost later.

**Units:** all times are UTC (commit times shown by git are UTC-6). The cost unit is the Copilot **AI credit**. It is reported as `totalNanoAiu` / 1e9, written "AIU" below. Rates read from the log for `claude-sonnet-5.5` are, per 1M tokens: uncached input 200, cache read 10, cache write 250, output (including reasoning) 1,000. The session also counted **2 premium requests**, one per typed `/pull-work`.

---

## 1. Executive Summary

The session did a lot of real work in about 14 minutes of activity:
- It reconciled a changed spec (R48–R51).
- It live-probed **both** Harnesses to ground a hard design question, and recorded the answer in ADR 0003.
- It wrote a 7-card phase.
- It ran 7 `test-author` agents in parallel. Their reports caught two of its own planning errors before the lock.
- It locked the tests, implemented S02 itself, and stopped at a locked P04 test that the new design contradicts.

The Developer was asked 3 questions, all inside the one Phase Review Checkpoint.

The weaknesses cluster in three places:

1. **Planning misses turned into rework (expensive tokens).** Two facts were already visible in the main chat's own reads at 19:06–19:07, but the plan ignored them:
   - `p04-s04.test.mjs` R43-03 asserts that `.claude/agents/*` is byte-equal to the source.
   - The P02 tests copy only `update-home.mjs` into their temp sources.

   Each became a mid-Dispatch surprise:
   - A card deviation: `agent-pins.mjs` was inlined.
   - A blocked slice with a new S08 test-fix card and a second Phase Review.
   - A follow-up `revise S03-S05 files` commit in the next session.

   The skipped `repo-scout` step was the planned guard against exactly this.
2. **Context bloat, then background compaction, then rule slips.** The main chat grew from 42k to 163k tokens:
   - +78k during Reconcile/Plan.
   - The 7 test-author reports.

   It compacted at 161k. The summary was taken from a snapshot 40 s before it was applied, so it described a file the agent had already deleted. In the 47 s after compaction the agent made its only two hard rule slips of the session:
   - It tried to edit a locked test. The hook denied it.
   - It ran `git add -A`, which committed partial S02 product code under a `docs(...)` revise commit.
3. **The run stopped one step short.** It set `Next: phase review P06` and then told the Developer to "Run `/pull-work` again" instead of writing the S08 diff and asking the Checkpoint question in the same run. This broke "never wait for go-ahead between steps".

**Cost: 273.4 AIU in total.**

| Part | AIU | Share | Context |
|---|---|---|---|
| Main chat | 163.8 | 60% | 58 calls; average context about 105k tokens |
| 7 `test-author` agents | 102.5 | 37.5% | 60 calls |
| Compaction | 7.1 | 2.6% | |

By token type:

| Token type | AIU | Share |
|---|---|---|
| Output | 103 | 38% |
| Cache writes | 99 | 36% |
| Cache reads | 72 | 26% |

**On the specific question:** moving the main chat's own card work (S02) to a Sonnet-tier `coder` subagent would have been roughly **break-even** (about −3 to +2 AIU). An Opus-tier coder would have been **more expensive** (about +5 to +10 AIU, estimated). Neither would have avoided compaction:
- The context was already at 154.4k when S02 started, against a 160k trigger.
- S02 itself added only about 9k.

The compaction driver was doing Plan mode and Phase Review in the same main context. Section 6 has the numbers.

---

## 2. Session Facts

| Item | Value |
|---|---|
| Session | Copilot CLI 1.0.116, `allowAllPermissions: true` |
| Wall clock | 19:03:43 → shutdown 19:58:30 (54.8 min). **Active: 19:04:05 → 19:17:59 (14.3 min).** Then 40.5 min idle until shutdown. |
| API time | 675 s in total: main 420 s, test-authors 256 s, compaction 33 s |
| Models | Started on `claude-opus-5.5` (medium). At 19:03:55 the Developer switched to `claude-sonnet-5.5` (medium) with `/model`, 10 s before the first prompt. The main chat, all subagents and the compaction summarizer ran on Sonnet 5.5 at medium effort. |
| Model-change events | 9: 1 startup, 1 `/model`, and 7 `source: agent` events at 19:10:25, one per test-author start (selection was `agent_definition_default`, the first entry in `test-author`'s `model` list) |
| Typed user turns | **2**: `/pull-work` at 19:04:05 and at 19:05:02 |
| Injected `user.message` | 9: 2 empty `source: memory` messages (session start, and right after compaction at 19:17:12) and 7 subagent task prompts. There were also 6 `system.notification` agent-idle notices (none for tests-s02, which the main chat waited on with `read_agent wait:true`). |
| Questions to the Developer | 3 `ask_user` calls, all inside the Phase Review Checkpoint: the bundle (named S06 and S07), S06 ("This ok."), and S07 (picked option b). Response times were 1m42s, 45s and 1m23s. |
| Main chat | 58 model calls, 81 tool calls (powershell 36, edit 16, view 7, task 7, read_agent 7, create 3, ask_user 3, skill 2) |
| Subagents | 7 × `test-author` (Sonnet 5.5 medium, background, parallel) |
| Token totals (session) | Input 7.38M, of which 6.99M cache read, 0.394M cache write and 264 uncached. Output 97.9k, of which reasoning 27.7k (accounting tokenDetails: output 103.1k, cache read 7.15M, cache write 395k). |
| Main totals | Input 6.11M (cache read 5.92M, cache write 192k), output 56.6k, reasoning 23.3k → **163.8 AIU** |
| Fixed preamble per main call | 41.8k tokens: system prompt 12.9k (of which tool instructions 8.7k) + tool definitions 20.7k (89 tools, 28 non-deferred) + the pull-work skill and instructions |
| Fixed preamble per subagent | about 8.7k tokens on the first call (tools 3.4k) |
| Compaction | 1, at 19:16:33 → 19:17:12 (background). Details in §2.2. |
| Hooks | 53 `preToolUse` runs, **all in the main chat**: 0 of 100 subagent tool calls logged a hook (see §7). 1 denial at 19:17:40. |
| Code changes (harness count) | 15 files, +1,351/−33 lines |
| Hidden cost outside this log | 4 nested Harness runs inside the probes (2 × `copilot -p`, 2 × `claude -p`, 19:05:58–19:06:24). One printed `AI Credits 6.83`. The other three cost unknown amounts (the Claude Code runs bill elsewhere). |

### 2.1 Subagent runs

| Agent (card) | Tool calls | Model calls | Total tokens | Duration | AIU | Max context |
|---|---|---|---|---|---|---|
| tests-s01 (test-fix, 4 P02 files) | 27 | 11 | 296,167 | 53.3 s | 20.61 | 45.4k |
| tests-s02 | 14 | 10 | 223,336 | 68.9 s | 17.12 | 30.1k |
| tests-s04 | 14 | 7 | 160,565 | 48.5 s | 16.58 | 34.6k |
| tests-s03 | 16 | 12 | 281,625 | 44.9 s | 15.55 | 30.1k |
| tests-s05 | 10 | 7 | 143,323 | 39.5 s | 14.77 | 32.9k |
| tests-s07 (verify) | 12 | 8 | 140,932 | 34.8 s | 11.17 | 22.2k |
| tests-s06 (README markers) | 7 | 5 | 65,433 | 17.2 s | 6.66 | 15.7k |
| **Total** | **100** | **60** | **1,311,381** | | **102.46** | |

Subagent spend breaks down as: cache writes 201.6k tokens = **50.4 AIU (49%)**, output 41.4k = 41.4 AIU, and cache reads 1.07M = 10.7 AIU. Each subagent pays for its whole working context once, as a cache write.

### 2.2 Compaction

| Item | Value |
|---|---|
| Trigger | `threshold` (0.8 × 200k). `currentTokens` 161,047: system 12.9k + tools 20.7k + conversation 127.4k. |
| Mode | **Background**: the summarizer ran from 19:16:33 to 19:17:12 (39 s) while the main chat kept working (3 more model calls and 2 tool runs) |
| Result | 164,426 → 49,643 tokens. 134 of 144 messages removed (10 kept). Summary 12.1k chars. |
| Cost | 7.14 AIU (162k input, mostly cache read; 5.1k output). The first call after compaction re-wrote 16.7k of cache (+4.2 AIU). |
| In context when it fired | The full spec diff, PHASE-FORMAT + PLAN-FORMAT, phase-05 (90 lines), update-home.mjs (244 lines), the latest Session file, the 24k-char phase-06 write, 7 test-author reports (about 15k chars), the Checkpoint text (twice: in the `ask_user` arguments and echoed in the response), and the S02 test file (140 lines). |
| What the summary kept well | Card list and test IDs, commit hashes, the lock ref, the `Done when` materialization note, the gate recipe, the commit-trailer rule, "stage only the transition's paths", and "tests … Never edit them". |
| What it got wrong (stale snapshot) | It described `scripts/agent-pins.mjs` as "Uncommitted (new) … exports renderClaudeForm", and said "Tests copy `scripts/*.mjs` into temp source folders, so agent-pins.mjs must be imported as `./agent-pins.mjs`". At 19:16:43, 10 s after the snapshot, the agent had already **inlined and deleted** that module because the P02 tests copy only `update-home.mjs`. The "scripts/*.mjs" claim generalized one agent's report (tests-s04) to all tests. |
| What it lost | The rule that the **whole Oracle** (`tests/home-repo-workflow`) is locked; the summary lists only `p06-s02..s07` and `p02-s01..s04` as locked. The fact that R43-03 / `p04-s04` exists was never in context before compaction, so that was not a loss. |
| Behavior after compaction | At 19:17:39 the reasoning noticed the conflict ("my summary claimed the tests copy scripts/*.mjs, which doesn't fit") and resolved it correctly, keeping the inlined code. In the next 20 s it then **tried to edit locked `p04-s04.test.mjs`**, which the hook denied, and **used `git add -A`**. Both were first occurrences: every commit before compaction staged explicit paths, and at 19:16:43 the agent had reasoned "I'm leaving the locked tests alone". The link to compaction is an inference (§8). There was a 2.1k-token re-read of the phase-06 card format (19:17:30) to recover state. |
| Did it save money? | About neutral. Calls after compaction cost 0.9–2.8 AIU against 2.2–3.9 before, saving roughly 1 AIU per call over 8 calls. That about equals the 7.1 + 4.2 AIU compaction overhead. |

---

## 3. Rule-Compliance Table

Each rule is turned into a signal that can be checked in the log. Statuses: ✅ pass · ⚠️ partial or judgment · ❌ fail.

### 3.1 pull-work Preflight, Route, Commits, Dispatch, Escalate, Brief

| # | Rule (source) | Signal | Status | Evidence |
|---|---|---|---|---|
| P1 | Parse args with `parse-args.mjs` first | Command run before anything else | ✅ | 19:04:07 `parse-args.mjs ""` → `{"slug":null,"bug":null}` |
| P2 | Run `glossary-check.mjs` as a command | Exit code checked | ✅ | 19:04:07 "glossary exit 0" |
| P3 | Find plans whose `Next` ≠ `done`, using `reconcile-check.mjs candidates` | Candidates script used | ⚠️ | 19:04:11 the first `Select-String '^\**Next'` printed blank Next values. A third call (19:04:14) was spent re-grepping: 2 calls (~1.3 AIU) for what a script could print. |
| P4 | Dirty tree at Preflight: stop, show files grouped by folder, recommend `/conventional-commit` or `git stash`, never commit or stash | Stop message and no git write | ✅ | 19:04:19: "Untracked file: `docs/research/session-review.md` is in `docs/research/` … run `/conventional-commit` … `git stash -u`" |
| P5 | After selecting a plan, `reconcile-check.mjs status <slug>`; on `changed`, Reconcile before routing | `status` then work-planner | ✅ | 19:05:08 `status home-repo-workflow` → `changed`; 19:05:17 loads `work-planner` |
| R1 | After each step, re-read `Next` and route again; never wait for "go ahead" | No stop between routable steps | ❌ | 19:17:59 sets `Next: phase review P06`, then stops with "Run `/pull-work` again to review and approve the S08 test change." Phase Review should have run next: write the S08 diff (at most 2 cards, so main writes it) and ask the Checkpoint. The hook allows that edit once `Next` is `phase review`. |
| C1 | Commit at every transition without asking | Commits after each transition | ✅ | `026d516` reconcile, `21b086a` plan, `16d8d09` lock, `2fd69a3` start, `125ad53` revise; no asking |
| C2 | Stage only the transition's paths, **never `git add -A`** | `git add` arguments | ❌ | 19:17:55 `git add -A; git commit … "docs(home-repo-workflow): revise P06 for R43-03"`. Every earlier commit staged explicit paths (19:10:04, 19:11:37, 19:16:00, 19:16:09). |
| C3 | The commit table's paths: Revise carries only `.workflow/` | Files in the Revise commit | ❌ | `125ad53` includes `scripts/update-home.mjs` (+99 lines, the partial S02 product code) under `docs(...)` |
| C4 | Lock commits hold `plan.md` back; then `docs(<slug>): start PNN` records `Tests locked` | Two-commit lock | ✅ | `16d8d09` = tests + ADR (no plan.md); `2fd69a3` sets `Tests locked`/`Phase base` = `16d8d09` |
| C5 | Reconcile → `docs(<slug>): reconcile spec`; Plan → `docs(<slug>): plan PNN` | Messages | ⚠️ | `026d516` "reconcile spec" also held the whole P06 plan (body "Plan P06 for R48-R51"). `21b086a` "plan P06" held only the card fixes made after test authoring. Defensible, but the plan was not a separate commit. |
| C6 | Clean handoff: every stop leaves `git status --porcelain` empty | Status after the last commit | ✅ | 19:17:56 `git status --short` prints nothing. It was achieved through C2/C3. |
| D1 | Dispatch step 2: run the Pre-Dispatch Check (edit and Patterns paths exist, create paths absent, oracle unchanged, materialized command runs and fails only on targets) | Commands before implementation | ❌ | Only `Test-Path scripts\agent-pins.mjs` (19:16:13). The materialized command was never run before coding. Had it run, the S01-pool failures (R36-01/02/04/09) would have shown "fails on non-target IDs", meaning blocked or a planning gap. |
| D2 | Dispatch step 3: set the slice `in progress` | plan.md status | ❌ | S02 stays `ready` throughout (`2fd69a3`, `125ad53`). |
| D3 | `main` card follows `coder.agent.md`: change only `Files`, follow `Decisions` exactly | Files and Decisions honored | ❌ | The card said "create `scripts/agent-pins.mjs`… exports `renderClaudeForm`". At 19:16:43 the agent inlined it into `update-home.mjs` and deleted the module ("That departs from the card's Files list, so I'll note it in the Outcome"). The card was then rewritten to match the code at 19:17:51, not routed as a stop or Revise first. |
| D4 | coder rule: never edit locked tests; a denial is always a stop | No edit attempt on oracle paths | ❌, caught | 19:17:39 `edit tests/home-repo-workflow/p04-s04.test.mjs` → 19:17:40 "Denied by preToolUse hook … Stop and report". The agent did stop and report. |
| D5 | Materialize `{regression-exclude}` (IDs of not-completed cards except this card's own); the card added "also lists S01's Restores IDs" | Pattern used | ⚠️ | 19:16:53 pattern `R48-0[7-9]\|R48-1[0-7]\|R50-0\|R51-04\|R49-0[23]\|R50-08` left out S01's pool, so the run had 5 failures (4 expected R36 + R43-03), not exit 0. The agent sorted them by reasoning (19:17:16). |
| D6 | Step 5: rerun the command (exit 0, expected count) and `git diff --exit-code <Tests locked> -- <Oracle>`; any failure is a stop | Both run | ✅ | 19:16:53 both run; "lock exit 0". The R43-03 failure was treated as a stop. |
| D7 | Stop ladder: a stop at a locked test of a completed slice whose fix changes an assertion → `test-fix` `Scope: assertion` card, `Next: phase review` | Revise outcome | ✅ | S08 added `Scope: assertion` with `Restores: R43-03`; S02 `Depends on: S01, S08`; `Next: phase review P06` |
| D8 | Revise: edit **all** affected cards | Cascade | ❌ | Only S02's Files were changed to drop `agent-pins.mjs`. S03–S05 still said `edit scripts/agent-pins.mjs`. The next session had to commit `e566a0a docs(home-repo-workflow): revise S03-S05 files`. |
| E1 | Escalate Only: ask only for the listed reasons | Every question maps to the list | ✅ | 3 questions, all Phase Review / ADR. The live probes replaced a "planning assumption that cannot be grounded" question, which was good autonomy. |
| E2 | Brief at every stop: slices completed with commits, review findings, blocked slices with reasons, Next; define terms | Final message | ⚠️ | Commit, Next and blocked reason are present. It never says S01 was completed, and uses "S01's Restores pool" and "test-fix card" without defining them. |

### 3.2 work-planner (Reconcile, Plan, Phase Review, Slicing, ADR Gate)

| # | Rule | Signal | Status | Evidence |
|---|---|---|---|---|
| W1 | Reconcile on a done plan: add phase `PNN+1`, set `Reconciled` to `git log -1 --format=%H -- <spec>` | Hash and new phase | ✅ | 19:08:46 `git log -1 …` → `7ede1a4…`; P06 added; 19:10:04 `status` → `unchanged` |
| W2 | Plan step 2: **dispatch `repo-scout`** with concrete questions; "the main session never reads the repo broadly" | `task repo-scout` | ❌ | 19:05:40 reasoning: "Rather than dispatch repo-scout, I'll look directly". The main chat then read about 95k chars of repo evidence itself (§5.3). |
| W3 | Plan step 2a: run `mutation-addon.mjs <stack>` and copy its line | Command run | ❌ | Never run. The Gate line "unsupported for node - no mutation Language Add-on installed" was written from memory. |
| W4 | Inputs: ADR titles and Status only; open a body only if relevant | ADR reads | ✅ | 19:05:40 `ls .workflow\adr`; 19:05:44 reads the first 30 lines of ADR 0002 (relevant to the Home layout) |
| W5 | Reconcile on changed requirements: completed slices the change invalidates get `fix`/`test-fix` cards | All invalidated locked tests found | ❌ | P02 (S01) was found; **P04 R43-03 was missed**. The 19:06:31 grep output already showed `p04-s04.test.mjs:98: assert.ok(existsSync(dir), '.claude/agents missing')`. Reasoning at 19:07:47 checked byte equality only for the P02 demo agent. |
| W6 | Pin every decision a weaker model would otherwise make; a card with an open design choice is not ready | Decisions survive contact with the tests | ❌ | (a) "`fingerprint` still hashes source files only" was wrong per spec line 40; tests-s01 exposed it and it was fixed at 19:11:27. (b) "create `scripts/agent-pins.mjs`" conflicted with P02 tests that copy only `update-home.mjs` (visible at 19:07:10, lines 15–40 of p02-s01); it was inlined at 19:16:43. |
| W7 | Cards under ~60 lines | Card line counts | ✅ | 14–34 lines (S02 is the largest at 34) |
| W8 | Tier: `main` only for shared structure or judgment | Tier reasons | ✅ | S02 main ("creates the agent-form module"); S03–S07 delegate |
| W9 | Mutation unsupported → every `main` card is also `Review: required - no mutation gate` | Review flags | ⚠️ | S01 and S08 (main, test-fix) are `Review: none - writes tests only`. The rule's literal reading fails; its intent (product code) is met. The rule text should say so. |
| W10 | Phase Review: more than 2 cards → dispatch `test-author` once per card, in parallel, with its own test paths, spec path and glossary | 7 parallel tasks | ✅ | 19:10:24, 7 `task` calls in one turn |
| W11 | Phase Review step 2: commit plan and phase (tests stay uncommitted), then present | Commit before `ask_user` | ✅ | 19:11:37 `21b086a`, then `ask_user` at 19:11:46 |
| W12 | Present "the cards, **the tests** (or the test diff for test-fix cards), tiers, Review flags with one-line reasons, ADR candidates, not-expressible scenarios" | Checkpoint content | ⚠️ | Cards, tiers, flags, A1 and not-expressible items are all present. **Tests are not shown**: "run `git diff` and open the p06-*.test.mjs files". The test-author reports with per-scenario failing assertions were already in context. This also breaks user-interaction "token savings never come from shortening what the Developer reads". |
| W13 | Define `delegate`, `main`, `Review: required` the first time | Terms | ✅ | "Terms: `delegate` = the cheap coder agent implements the card; …" |
| W14 | ADR Gate: approved candidate → `adr-writer`, write the ADR, drop the candidate | ADR and plan | ✅ | 19:15:45 skill loaded; `0003-two-agent-forms-in-the-home-repo.md` (Accepted); 19:16:09 candidates section removed |
| W15 | On approval: assertion test-fix → `completed`; others → `ready`; phase `in progress`; lock ref and `Phase base` → lock commit | plan.md | ✅ | `2fd69a3` |

### 3.3 user-interaction.md (Checkpoint and question rules)

| # | Rule | Status | Evidence |
|---|---|---|---|
| U1 | One bundled question: approve all, or name items | ✅ | 19:11:46 schema `["Approve all","Name items to discuss"]` |
| U2 | Label every item, including not-expressible scenarios by scenario ID | ⚠️ | Cards and A1 are labelled. The not-expressible items have no IDs ("Not expressible (live-probed by me at Review): Claude Code `/tasks` …"). |
| U3 | Named items discussed one at a time, in order; no re-ask of the bundle | ✅ | S06 (19:13:31), then S07 (19:14:20), then proceed |
| U4 | Context, options with tradeoffs and a recommendation when the answer space is known | ⚠️ | S07: ✅ (a)/(b) with a recommendation. S06: ❌ open "What would you like changed about S06 (placement, content, wording checks, tier)?" with no options or recommendation. |
| U5 | Confirm brief or hedged answers; a pick is settled "once restated" | ❌ (minor) | "This ok." was not confirmed or restated. The S07 pick "(b)" was not restated before 19:15:45 (`skill adr-writer`). |
| U6 | End the turn after asking | ✅ | Every `ask_user` was the last action of its turn |

### 3.4 test-author contract (checked on the 7 reports)

| # | Rule | Status | Evidence |
|---|---|---|---|
| T1 | One test per scenario, tagged by ID; edit only the assigned paths | ✅ | All 7 reports; tests-s03 even flagged "`p06-s06`… `p06-s07` as untracked. I did not create or touch them." |
| T2 | Report **the failing assertion line per scenario** and prove a `build` test fails because the behavior is missing | ⚠️ | 3 agents admit gaps. S05 R48-15: "I take this to be the current `tracked-workflow-files` failure, but I did not print the actual output". S03 R48-10: "I did not capture which line it trips on". S07 R50-08: "the notice-line assertions aren't separately shown to fail". The main chat did not follow up on any of them. |
| T3 | Report anything that cannot be expressed; never weaken | ✅ | S07: "The test follows the spec literally, so I didn't weaken it… a decision for the caller". This found the real README hit. |
| T4 | Black-box only (CLI), no internal imports | ✅ | S02: "They do not import `scripts/agent-pins.mjs`" |

---

## 4. Agent-Side Findings

### Strengths

| Strength | Evidence |
|---|---|
| **It grounded a hard design question with live probes instead of asking** | 19:05:54–19:06:24: built temp Home folders and ran `claude -p` and `copilot -p` with `--add-dir`. It established that Claude Code reads only `.claude/agents` and that Copilot prefers `.github/agents` for a duplicate name. The decision landed in the plan's Current state and ADR 0003. These were the most useful tokens of the session (about 3.4 AIU of main calls, plus at least 6.83 external credits). |
| **It held Preflight discipline** | 19:04:19 clean stop on an untracked file; changed nothing; precise recommendations |
| **It parallelized test authoring correctly** | 7 tasks in one turn (19:10:24), so authoring took 69 s of wall time for 7 cards |
| **It treated test-author reports as review, not rubber stamps** | Changed the S02 fingerprint decision after tests-s01 (19:11:27: "the spec says the fingerprint covers the content of every installed file, so the test is correct and my earlier S02 decision was wrong"). Turned S07 into a `build` card after tests-s07 found `.github/skills/pull-work/README.md:19`. Both were cheap catches before the lock. |
| **Its commit hygiene was correct up to the stop** | Explicit staging, the two-commit lock, the ADR in the lock commit, the Co-authored-by trailer, and a lock-diff check after implementation |
| **The hook-backed stop was handled per the Revise rules** | Correct classification (assertion test-fix, `Next: phase review`); clean tree; honest brief ("The pre-edit hook blocked my attempt to edit the test, as it should") |
| **Reasoning was terse** | Visible assistant prose was only 2.5k chars across the session. Answers stayed short, which matches the Developer's preference for little interaction. |

### Weaknesses

| Weakness | Evidence | Cost |
|---|---|---|
| **Planning missed a locked test the design contradicts** (R43-03) | Seen in the 19:06:31 grep and never inspected. Surfaced at 19:17:12 after S02 was implemented. | Expensive: the post-compaction segment (16.4 AIU), a second Phase Review round and relock in the next session (`39a80fb`, `b50faa8`), and one more Developer interaction |
| **Card Decision broke on a visible test constraint** (`agent-pins.mjs`) | P02 `makeSource` copies only `update-home.mjs` (visible at 19:07:10). Inlined at 19:16:43. S03–S05 were not revised. | Expensive: inline call 2.9 AIU + Revise, and the next session's `e566a0a` |
| **`repo-scout` skipped; main read the repo broadly** | 19:05:40 "Rather than dispatch repo-scout, I'll look directly"; about 95k chars of tool output in the Plan phase | About 17 AIU of carried context (§5.3); and the miss above |
| **`mutation-addon.mjs` not run** | No invocation in 81 main tool calls | Rule slip; no cost |
| **Pre-Dispatch Check skipped; slice never `in progress`** | 19:16:13 → 19:16:23: straight from reading tests to `create agent-pins.mjs` | Lost the early signal that `Done when` could not exit 0 |
| **Main card deviated from Decisions without a stop** | 19:16:43 "That departs from the card's Files list, so I'll note it in the Outcome" | Silent card rewrite; cascade miss |
| **Locked-test edit attempt and `git add -A` right after compaction** | 19:17:39 and 19:17:55 | Partial product code in a `docs` commit; slices and commits no longer map 1:1 |
| **Stopped instead of running Phase Review** | 19:17:59 "Run `/pull-work` again" | One more typed turn and a new premium request for the Developer |
| **Checkpoint pushed reading onto the Developer** | "run `git diff` and open the p06-*.test.mjs files" | The Developer named S06 and then said "This ok.": a 2-question detour (about 3.8 AIU, 45 s), plausibly caused by the missing test summary (inference) |
| **Idle "waiting" turns** | 19:10:26 "Waiting on the seven…", 19:10:44 "Waiting for the other six.", 19:11:17 "Waiting for S01 and S02." | 3 calls with no work at about 130k context: 6.3 AIU |
| **Re-reads** | work-planner's Reconcile section read 3 times (19:05:08 grep ctx 25, 19:05:11 grep ctx 30, then the full skill load at 19:05:18); p02 test greps 4 times (19:06:31, 19:07:02, 19:07:10, 19:16:37); plan.md 3 times; phase-06 re-read after compaction | About 5k tokens redundant, carried for 40+ calls (about 2–3 AIU) |
| **Sloppy plan edit** | The S02 Decision after the 19:17:51 `.Replace` reads "…and is not exported; it returning `{ text, notices: [] }`" (broken grammar left in the committed card) | Minor; a weaker coder reads it |

---

## 5. Token Picture

### 5.1 Where the 273.4 AIU went

| Bucket | AIU | % | Notes |
|---|---|---|---|
| Main: Run 1 Preflight (calls 1–4) | 12.8 | 4.7% | 10.65 of it is the first-call cache write of the 41.8k preamble. The stop was caused by a dirty tree. |
| Main: Reconcile + Plan (calls 5–25) | **73.9** | **27.0%** | 35.4k output (19.2k reasoning), 84.7k cache write; context 49k → 127k |
| Main: Phase Review dispatch + collect (26–35) | 24.0 | 8.8% | 7 `task` + 7 `read_agent` + 3 idle turns (6.3) + 2 card fixes |
| Main: Checkpoint Q&A (36–38) | 7.0 | 2.6% | |
| Main: ADR + lock + start (39–44) | 13.0 | 4.7% | |
| Main: S02 card before compaction (45–50) | 16.7 | 6.1% | at about 155–163k context |
| Main: after compaction, verify + Revise + stop (51–58) | 16.4 | 6.0% | rework caused by the R43-03 miss |
| test-author × 7 | **102.5** | **37.5%** | 49% cache write, 40% output |
| Compaction summarizer | 7.1 | 2.6% | |
| **Total** | **273.4** | | |

Main by token type:

| Token type | Tokens | AIU | Share of main |
|---|---|---|---|
| Cache read | 5.92M | 59.2 | 36% |
| Cache write | 192k | 48.0 | 29% |
| Output | 56.6k | 56.6 | 35% |

Reasoning inside output: 23.3k (about 23 AIU). The heaviest reasoning calls were 17, 19, 20 and 21 (3.4k–4.2k each, 19:07–19:08), spent deliberating the two-form design, the fingerprint and test-fix scoping.

### 5.2 Useful, wasted and expensive tokens (estimates)

| Class | AIU (estimate) | What |
|---|---|---|
| **Useful** | about 200 | Probes and design (→ ADR 0003), phase-06 (the single costliest call, #22: 9.7k output = 11.7 AIU), 7 locked test files, S02 code (kept, as inlined), the Checkpoint |
| **Wasted** | about 35–45 | Run 1 for the dirty tree (12.8; Developer-caused, but each restart re-writes the preamble cache unless within the 5-minute TTL); 3 idle waiting turns (6.3); the Next-grep retry (1.3); repo evidence carried that no decision used (about 8 of the 17 in §5.3); re-reads (2–3); test-authors locating their card (about 8–11, §5.4); tool definitions never used (§5.5, about 8) |
| **Expensive (rework)** | about 25 in this log, plus the next session | After-compaction stop and revise (16.4), the inline detour (2.9), card fixes for the fingerprint and S07 (about 5, cheap catches), part of the compaction (about 4). The next session paid for the S08 diff, Checkpoint, relock and the S03–S05 Files revision (not in this log). |

### 5.3 Large tool outputs carried in the main context

The main chat's tool results came to 149k chars (about 37–40k tokens). Tool arguments it wrote came to 81k chars (about 20k tokens), and the phase-06 `create` alone was 24k chars. The largest results:

| Chars | When | What | Used by a decision? |
|---|---|---|---|
| 14,647 | 19:05:22 | PHASE-FORMAT + PLAN-FORMAT | Yes (format of what it wrote) |
| 14,438 | 19:05:15 | Full spec diff since `96cf5699` | Yes. It overlaps the 6.2k Session read at 19:05:44. |
| 13,893 | 19:05:22 | phase-05.md, first 90 lines, as an example | Mostly no: PHASE-FORMAT already holds the skeleton. Wasted, about 3.5k tokens. |
| 9,323 | 19:05:12 | Reconcile section (2nd read) + plan.md | Partly (re-read) |
| 9,893 | 19:07:48 | update-home.mjs, all 244 lines | Yes (pinning Decisions) |
| 8,515 | 19:17:30 | phase-06 lines 20–78, after compaction | Recovery re-read |
| 7,364 | 19:07:02 | grep of p02–p05 tests | Yes. It also held the R43 hint that was **not** used. |
| 6,197 | 19:05:44 | Latest Session + ADR 0002 | Partly |
| 5,705 | 19:16:14 | p06-s02 test (140 lines) | Yes (S02 implementation) |

Carry cost: the Plan phase's roughly 25k tokens of evidence were written once (about 6 AIU) and then re-read by every later call (about 33 calls × 25k × 10/M ≈ 8 AIU before compaction): **about 14–17 AIU**. A Haiku `repo-scout` fact sheet of about 3k tokens would replace most of the survey reads, though update-home.mjs and the format files would still be read in main.

### 5.4 Subagent reading overhead

The main chat passed each test-author a **pointer** ("Plan: … phase-06.md, card S03") instead of the card text plus the Harness lines that `test-author.agent.md` expects.
- 5 of 7 agents began with `glob .workflow/**/*` (1.5k chars).
- 5 of 7 got **"File too large to read at once (23.2 KB)"** on `view phase-06.md`: Copilot's `view` refuses files over about 20 KB, and phase-06 was 23.8–25 KB.
- They then re-located their card with grep and `view_range`.

Total phase-06 reading across the 7 agents was about 91k chars (about 23k tokens), against about 12k tokens if each card had been pasted. Five agents read all of `p02-s01.test.mjs` (9.1k chars each) as a pattern, and spec reads came to about 47k chars. Estimated avoidable cost: **8–11 AIU (8–11% of test-author spend)**: about 2 extra calls per agent at 0.6–0.8 AIU, plus the larger cache writes.

tests-s01 made 13 single-replacement `edit` calls against 4 files at 30–45k context. It was the costliest agent (20.6 AIU).

### 5.5 Harness overhead

- **Preamble paid on every main call:** 20.7k tokens of tool definitions + 8.7k of tool instructions.
  - On 58 calls: 1.71M cached-read tokens = 17.1 AIU, plus 7.4 AIU of first write.
  - That is **about 24 AIU, 15% of main spend**.
- **Tools never called this session** include `store_memory`/`vote_memory` (which `AGENTS.md` forbids), `web_fetch`, `image_generation`, `manage_schedule`, `sql`, `session_store_sql`, dynamic workflows, `semantic_code_search`, `search_code_subagent`, `list_agents`/`write_agent`, and the powershell helpers.
- **Deferred tools** (60, including Azure DevOps and git MCP servers) are listed by name only and are cheap.
- **Subagents** carried only 3.4k of tool definitions. That is one reason their per-call cost is low.

### 5.6 What the main chat did that a subagent could have done, and the reverse

| Work | Who did it | Better owner? |
|---|---|---|
| Repo survey for Plan (about 95k chars) | main | `repo-scout` (Haiku, low), per W2. Fact-sheet questions would include "which locked tests assert on `.claude/agents` or on `update-home.mjs`'s install map or copy pattern", which would have caught both planning misses (inference). |
| Live Harness probes | main | main is right: the design judgment happened in the same place |
| S01 test-fix diff | test-author (card tier `main`) | Correct: Phase Review authors test diffs |
| S02 implementation | main (`main` tier) | See §6: a cost wash on Sonnet; a cleaner rule boundary in a subagent |
| S08 diff | nobody (the run stopped) | main (at most 2 cards) or test-author, in the same run |

---

## 6. Tuning Opportunities (ranked by expected payoff)

### 6.0 The specific question: move `main` card work to a dedicated stronger-model `coder` subagent?

**The cost model, measured from this log:**
- A main call at context C tokens costs at least C × 10/M (cache read) plus new-token writes and output.
  - At the 155k seen during S02 that is at least **1.55 AIU per call before any work**.
- A fresh Sonnet subagent pays about 8.7k of preamble, plus its reads, all as cache writes at 250/M.
  - The test-authors averaged **29k context, about 7 AIU of cache writes**, at 1.7 AIU per call overall.

**What S02 cost in the main chat:**
- Calls 45–50: 16.7 AIU (6 calls, 4.7k output, 947k cache read = 9.5 AIU of pure context tax).
- Plus verification calls 51–52 after compaction: 6.5 AIU.
- About **23 AIU**, or about 17 AIU without the compaction distortion.

**Sonnet-tier `coder` for S02 (estimate):**
- Benchmarks: tests-s02 at 17.1 AIU, 10 calls; tests-s04 at 16.6 AIU.
- The coder would need the card (about 2.5k), p06-s02 (140 lines), update-home.mjs (244 lines), and about 10–12 calls with about 5–8k output.
- Subagent ≈ 15–18 AIU, plus main dispatch and report ingestion ≈ 2 calls × about 1.8 = 3.6 AIU.
- Total about **19–22 AIU**, roughly **break-even** with the main chat (−3 to +2).

**Opus-tier `coder`:**
- Copilot's Opus AIU rates are not in this log. Assuming Anthropic list-price ratios (Opus about 1.67× Sonnet per token, an inference), the subagent part is about 25–30 AIU.
- That is **+5 to +10 AIU worse** than main.

**Haiku-tier (`delegate`) `coder`:**
- At about one third of Sonnet rates (inference), about 5–6 AIU + 3.6, or about **9–10 AIU**.
- That is **about 7–13 AIU cheaper**, but S02 was tiered `main` for judgment, and that judgment is exactly what the inline decision needed.

**Break-even rule of thumb from these numbers:**
- Delegating a 6–10-call card to a same-price subagent pays only when the main context is above about 150k.
- Below about 100k the main chat is cheaper, because cache reads at 10/M are cheaper than a subagent's fresh writes at 250/M.

**Does it avoid compaction? No.**
- Context was 154.4k at 19:16:13, before S02. The trigger was 160k.
- A coder dispatch plus report would have added about 4–5k, against about 9k for S02 done in main.
- Compaction would still have fired within the next 1–3 calls (S02 verify and commit, S03 dispatch).
- The growth came from Plan (+78k) and Phase Review (+18k), not from card work.

**Real but non-monetary upside:** in a subagent, the S02 deviation (dropping `agent-pins.mjs`) would have been a `coder` stop, sent to Revise in main, instead of a silent card rewrite. That would probably have revised S03–S05 too (inference).

**Verdict:** do not move `main` cards to a stronger-model coder for cost reasons. Fix the context-growth source instead (6.1–6.3). If `main` cards move to a subagent for rule hygiene, use a Sonnet-tier coder and accept roughly zero cost change.

### Ranked list

| Rank | Change | Kind | Expected payoff | Evidence |
|---|---|---|---|---|
| 1 | **Planning must sweep every locked test that asserts on a path or output the phase changes.** In Reconcile/Plan (work-planner), add an Inputs step: grep the Oracle for each installed path, output line or file the new requirements touch, and list every hit under a card's `Restores` or as "unaffected because …". Make it a `repo-scout` question, or better a deterministic script such as `oracle-impact.mjs <paths…>`. | Skill text + script | **High**: avoids expensive rework. In this session the after-compaction segment (16.4), the next session's S08 round and relock, and the S03–S05 revise all trace to two misses. | W5, W6; 19:06:31 grep already showed the R43 file |
| 2 | **Split the session at "start PNN".** pull-work already says to start a fresh session after a phase completes. Extend that to after Phase Review approval and the lock commits, when Plan or Phase Review ran in this session: "stop with the brief; `/pull-work` in a fresh session dispatches". With the 5-minute cache TTL, a quick restart re-uses the preamble cache (run 2's first call read 42.7k from cache, 2.1 AIU, against 10.65 cold). | Skill text | **High**: the Dispatch phase would start at about 50k instead of 154k. Calls 45–58 would save about 1 AIU each in cache reads (about 12–14 AIU), the 7.1 + 4.2 AIU compaction would be avoided, and the post-compaction slips would be avoided. | §2.2; calls 45–58 |
| 3 | **Enforce `repo-scout` for Plan and Reconcile**, or make the skip explicit: "skip only when the change touches ≤ N files you already have in context". Give it pre-written questions, including the oracle-impact question from #1. | Skill text / agent use | Medium-high: about 8–14 AIU less carried evidence; plausibly catches both planning misses | W2; §5.3 |
| 4 | **Pass the card text verbatim to `test-author`** (as Dispatch already does for `coder`): card + Harness lines + paths. Keep `phase-NN.md` under about 20 KB, or tell agents to use `grep`/`view_range`. Copilot's `view` refused 23.2 KB for 5 of 7 agents. | Skill text (Phase Review step 1) + PHASE-FORMAT size rule | Medium: about 8–11 AIU per 7-card phase, and less variance | §5.4 |
| 5 | **Close the rule gap that forced informal failure triage.** PHASE-FORMAT "Materializing Done When" excludes only IDs owned by not-completed cards. An assertion test-fix (S01) is `completed` at approval while its Restores fail until later build cards land, so no later card's `Done when` can exit 0. Either (a) the Restores IDs of an assertion test-fix stay in `{regression-exclude}` until every card it `Depends on`/waits for is completed, or (b) fold the assertion change into the build card that makes it pass. | Skill text (PHASE-FORMAT, work-planner Phase Review step 3) | Medium: removes a recurring judgment call that a weaker model will get wrong | D5; the S02 card's ad hoc "where the exclusion also lists S01's Restores IDs" |
| 6 | **Define what happens to partial slice code at a Revise stop.** The rules allow uncommitted `Files` only with `Next: running SNN`, but Revise sets `Next: phase review`. Add: "a stop during Dispatch that routes to Revise either reverts the slice's `Files` to `HEAD`, or commits them as `wip(<slug>): <slice> (blocked)` with the slice `blocked`". Never use `git add -A`; consider making `git add -A`/`git add .` a hook denial. | Skill text + hook | Medium: prevents the C2/C3 slip and keeps commits mapping to slices | 19:17:55 |
| 7 | **Main-card deviation is a stop.** In Dispatch step 4 `main`, add: "if a `Files` or `Decisions` entry cannot hold, stop and Revise every card that names the same path or Decision before continuing". | Skill text | Medium: avoids the S03–S05 cascade miss | D3, D8; `e566a0a` |
| 8 | **Phase Review presentation:** require the per-scenario failing-assertion table from the test-author reports in the Checkpoint, and fail the Checkpoint input if a report admits an unverified failure (T2). | Skill text | Medium-low cost, high trust. It may remove "name items" detours like S06. | W12, U4, T2 |
| 9 | **After Revise sets `Next: phase review`, continue in the same run.** Add an explicit line under Route: "Revise → Phase Review runs immediately; only the Checkpoint question stops". | Skill text | Low-medium: one fewer typed turn and premium request per stop | R1 |
| 10 | **Waiting for parallel subagents:** after dispatch, use one blocking `read_agent wait:true` per agent in sequence (as done for tests-s02) instead of ending the turn and being woken by each notification. | Skill text (Copilot note) | Low: about 6 AIU per 7-agent fan-out at high context | 3 idle turns |
| 11 | **Preflight as one script:** `preflight.mjs` runs parse-args + glossary + `git status --porcelain` + candidates + each plan's `Next`, and prints one block. Optionally run it from a session-start hook so a dirty tree is reported before the model spends 10.65 AIU on a cold cache. | Script / harness hook | Low-medium: 1–3 calls per run; the whole of Run 1 (12.8 AIU) when the tree is dirty | P3, Run 1 |
| 12 | **Trim the main preamble:** launch pull-work sessions with unused built-in tools disabled (memory, image, schedule, SQL, web_fetch, dynamic workflows) where Copilot CLI allows it (check its tool allow/deny flags; not verified here). | Harness setting | Low-medium: up to about 24 AIU per 58-call session is preamble; removing half the tools saves about 6–10 AIU | §5.5 |
| 13 | **Run `mutation-addon.mjs` in Reconcile too** (or make Reconcile reuse Plan's step list verbatim) | Skill text | Low (correctness) | W3 |
| 14 | **Clarify W9:** "every `main` card **with product `Files`** is `Review: required - no mutation gate`" | Skill text | Low (removes ambiguity) | S01/S08 |
| 15 | **Compaction setting:** if the harness offers it, prefer **blocking** compaction, or forbid tool calls while it runs. Background compaction summarized a 40-second-stale state. Failing that, make the first action after compaction a scripted re-sync: `git status`, plan `Next`, current slice card. | Harness setting / skill text | Low-medium (correctness after compaction) | §2.2 |
| 16 | **Model and effort:** keep Sonnet medium for the main chat (README advice; it held up). The Developer's switch from Opus at startup saved real money, since Plan alone was 73.9 AIU on Sonnet. Consider the opt-in `planner` only when items 1 and 3 are not enough. On Opus, planning output (35k tokens) would cost about 1.67× (inference). | Model choice | Info | §2 |

---

## 7. User-Side Observations

- **The Developer launched on Opus and switched to Sonnet medium in 10 seconds** (19:03:44 → 19:03:55), before the first prompt. This matches the pull-work README recommendation and probably saved about 40% on this session's main spend (inference based on list-price ratios).
- **A dirty tree cost a full run.** `docs/research/session-review.md` was untracked. Run 1 spent 12.8 AIU (4.7% of the session), mostly the cold preamble cache write, only to stop. The Developer committed it in 43 s (`5edfe11` at 19:04:52) and re-ran within the cache TTL, so run 2 started warm (2.1 AIU). Habit: run `git status` before `/pull-work`, or adopt item 11 above.
- **Fast, decisive Checkpoint answers** (1m42s, 45s, 1m23s). The Developer named S06 and S07, then approved S06 unchanged ("This ok."). That suggests S06 was named to see it, not to change it, which is a symptom of W12 (tests not shown).
- **The Developer chose the agent's recommendation every time** (S06 unchanged, S07 (b), A1 approved). That fits the low-interaction expectation, and puts more weight on the plan being right the first time (items 1 and 3).
- **The Developer did not continue in this session after the stop.** It sat idle for 40.5 min until shutdown. The next session's commits (`39a80fb` at 19:20:02 UTC) show that P06 was finished there.

---

## 8. Things I Am Unsure About (inferences)

1. **That compaction caused the two slips.** Timing and summary contents support it: first occurrences, within 47 s, and the summary narrowed "locked" to specific files. The deny-first edit could equally be a sequencing error: the agent wrote the S08 diff before setting `Next: phase review`, which the hook would then have allowed.
2. **Opus and Haiku AIU rates.** Only Sonnet rates appear in this log. The Opus (about 1.67×) and Haiku (about 0.33×) comparisons assume Anthropic list-price ratios.
3. **Hooks in subagents.** 53 `preToolUse` events were logged, all for main-chat turns. None was logged for 100 subagent tool calls (15 `edit`, 6 `create`, 15 `powershell`). This may only mean the parent log omits subagent hooks. If Copilot CLI really does not run `preToolUse` for custom-agent tool calls, then `coder`'s "a denied locked-test edit is a stop" protection is inactive in Copilot, and only Dispatch step 5's `git diff` catches it. **Verify with a probe:** dispatch a coder that tries to edit a locked test.
4. **Reasoning retention.** Context grew about 121k tokens, against about 60k of tool I/O plus about 23k of reasoning. I assume prior-turn reasoning (`reasoningOpaque`) stays in context. That would make reasoning an even larger share of carried cost.
5. **Whether `repo-scout` would have caught R43-03.** It depends on the question asked. Item 1 (a deterministic oracle-impact sweep) is the safer fix.
6. **Wasted and useful split (§5.2).** These are judgment estimates, not log-derived classifications.
7. **The test-author card-finding overhead (8–11 AIU).** Estimated from call counts and average per-call cost, not measured by counterfactual.
