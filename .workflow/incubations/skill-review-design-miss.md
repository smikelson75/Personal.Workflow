# Incubation - Skill Review Design Miss

Status: incubating
Started: 2026-11-27
Updated: 2026-11-28 (third session: Assumption Rule hand probe reviewed)

## Spark
- `skill-review` was built to replace the hand-run reviews, and it is nearly blind ([skill-review-depth.md](skill-review-depth.md)). Instead of fixing the review again, look back at the `incubate` and `brain-storm` Conversations and the artifacts that designed it. How did we commit so many tokens to the wrong design, and what in the workflow let that happen?

## Current Mental Model
- **The miss was one early rule that nobody tested and that got more locked in at every step.** In the first incubate, the agent invented "never read beyond a flag" to answer a cost question. The second incubate made it the mission. Brain-storm recorded it as a constraint, the spec as R62, and the plan enforced it with 26 tests. Every later skill trusted the earlier one. No skill re-asked whether flags can find what the hand review found.

```text
 8b3edef2 incubate#1 U4   Developer: "relevant? missing? token-efficient, maximizing value"
   |  agent answers only the cost half; invents Tier 0-3
   |  justification: "a full read of S6 would be millions of tokens"
   v
 120ba52f incubate#2 U12  Developer: "needs more grounding data ... stick with this for now"
   |  80/20 check: "the 80/20 version still would have produced today's summary" (asserted)
   v                U19-20 Four Tiers promoted: mechanism -> "mission and escalation rule"
 d77825a6 brain-storm U9  bundled as constraint 5 of 5 ("already known, confirm rather than ask")
   |  "That is my understanding as well." -> "token cost is a hard limit"
   v
 spec R62 ---------> plan P02/P05: 26 R62 tests, slice REFUSES unflagged lines
 spec R56 (value) -> plan P05: "not expressible", 0 tests, "the Developer checks"
   v
 real runs: no pin/decomposition Observation in Ledger or summaries -> R56 failed silently
```

- **Seven contributing causes (current read, ranked by how much each one cost):**

| # | Cause | Where observed | Kind |
| --- | --- | --- | --- |
| 1 | **No probe before build.** The main assumption, "flagged slices find what the hand review found", was never back-tested against the S1-S6 sessions the hand review had already scored. **Now observed (2026-11-27):** the first real run reviewed all six and found none of the ~10 hand findings (see "The back-test came last" below). | No probe in either incubate or in brain-storm | Missing gate |
| 2 | **Cost rule promoted to mission.** Once it was "mission", downstream skills treated it as a given and never revisited it. | 120ba52f, agent turn before U20 | Framing |
| 3 | **Mission definition inverted.** AGENTS.md says a useful token is one that changes a decision, and an expensive one is rework. The agent quoted it to justify "read less". | 8b3edef2 after U4; 120ba52f before U20 | Misreading |
| 4 | **Likely unit error (inference).** "Millions of tokens" for a full read of S6 matches S6's *cumulative* input (4.35M over all calls, per `incubate-session-review.md` line 257), not the cost of one read. The P06 deep read cost about 268K. | 8b3edef2 after U4 | Bad evidence |
| 5 | **Output readability mixed up with reading depth.** "I can't understand incubate-session-review.md" (8b3edef2 U5) was about what the Developer reads. The answer cut what the model reads. | 8b3edef2 U5 | Framing |
| 6 | **80/20 check asserted, not tested.** The worked example (model-pin miss) came from a full trace of session files, incubation lines, a commit and a log. That is the very kind of reading the 80/20 version forbids. The claim that it "still would have produced today's summary" was never checked. | 120ba52f before U19 | Rule slip (incubate's "name what was observed") |
| 7 | **Testable beats important.** The plan could test cost, so it tested cost 26 times. It could not test value, so it deferred value to the Developer. The only success criterion about discovery failed without anyone being told. | `plans/skill-review/phase-05.md` line 21; R62-10, R62-25 | Planning bias |

- **Brain-storm's 40 turns went mostly to plumbing.** The user turns answer lettered menus about record location, naming, STE, apply/undo and the installed version (R59-R61, R68-R73). About 12 replies are a bare "A" or "agree". No question asked what a reviewer must read to find a capture or translation miss. The Developer twice pointed toward value: U19, "better aligns with maximizing value than just token cost", and U21, "This must improve on what I have today". Neither turned into a back-test requirement.
- **What it cost (observed, Copilot `session.usage_record`, summed per Conversation):**

| Chain | Conversations | Input tokens | Output tokens | AIU (totalNanoAiu / 1e9) |
| --- | --- | --- | --- | --- |
| Design: incubate x2 + brain-storm | 8b3edef2, 120ba52f, d77825a6 | ~8.9M | ~0.11M | ~669 |
| Build: behavior-spec, work-planner x6, pull-work x5, fix | d7ee59fd ... 9effcf37 (12) | ~55.3M | ~0.84M | ~1,805 |
| **Total skill-review chain** | 15 | **~64.2M** | ~0.95M | **~2,474** |
| All 10 old hand-run review Conversations | 9cc1e41f ... abac3064 | ~27.5M | ~0.23M | ~1,832 |

- **The irony (inference):** the design optimized run cost (a run reads about 98K tokens over 92 Conversations, and one deep read costs about 268K). The *build* cost about 2.3 times all the hand reviews combined. A back-test probe would have cost a few K to a few hundred K tokens. Rework, the mission's "expensive token", sat at the planning end of the chain, and no gate faced it.

- **The back-test came last (observed).** S1-S6 (the six hand-reviewed `/incubate` sessions in `docs/research/incubate-session-review.md`: bc4d62d8, 8dcf5bf8, 8a1dfca9, 303d1328, 1e67d797, aded70fc) are all listed in `workflow-home/skill-review/review-record.json` and were reviewed by the 2026-11-26 20:51 run. That run's only incubate Observation is O10 (a Developer contribution). None of the hand findings appear: repetition loop, dropped question, wizard and rubber-stamping, complexity creep, "Settled" claims, ignored Pick Up Here, hallucinated user replies, invisible Mermaid, truncated-listing over-read. Even the S2 `ask_user` schema error, a tool error that should have been flagged, is missing. The Developer's own runs were the first back-test, and they came after ~64M tokens.

```text
 hand review S1-S6:  ~10 weaknesses  --->  skill-review run 1 on the same six:  0 of them
```

- **Why no one probed: trust anchored on the example (Developer, confirmed).** The Developer "took the agent at its word" and "didn't question it." The Developer's doubt switches on for *new* ideas (home-repo-workflow: probed twice, beliefs broke). Skill-review felt known, because hand reviews already existed as a worked example, so the Developer expected incubate to stay faithful to the example and challenge drift. The agent drifted (4 lenses became 4 cost tiers; full reading became flagged slices) and then *asserted* faithfulness (cause #6) instead of replaying the example.

```text
 new idea (home-repo)            known example (skill-review)
 Developer doubts                Developer trusts: "it has the example"
   -> probes run                   -> agent drifts from the example
   -> beliefs break                -> agent asserts it still works (not run)
                                   -> nobody replays the example
```

- **The example proved the output, not the new mechanism.** The hand reviews showed the findings were worth having. They said nothing about whether reading only flagged lines could produce them.
- **What the Developer needed at the swap: the true cost and what was given up.** The agent showed only the saving, and it inflated even that (cause #4). Our reading of the trade (an inference; findings not mapped to lenses line by line):

| | What the agent said | What was given away |
| --- | --- | --- |
| Saves | "Millions of tokens" for a full read of S6 | About 268K per deep read vs. about 98K for a whole flagged run: a few hundred K per session |
| Token Economy lens | Kept, via the long-message flag | Cause of the repetition loop (hidden reasoning) is not flaggable |
| Human-Agent Dynamic lens | Silently dropped | Rubber-stamping, wizard pattern, Developer habits |
| Rule Adherence lens | Narrowed to tool errors | Dropped questions, routing menus, "settled" claims: the problem is what's missing from a turn, so no flag fires |
| Trend lens | Silently dropped | Signal tracker across sessions, model A/B |

- **Lesson (current leaning, n=1):** when the agent reshapes an example the Developer gave it, it shows (a) what the change saves, with real numbers, (b) which parts of the example the new design can no longer produce, and (c) the example replayed through the new design, rather than a claim that it still works.
- **Incubate's probe rule covers only one kind of assumption.** It targets "external or environment assumptions". Design-efficacy claims about our own mechanism slipped past it.

### The Assumption Rule (current leaning, 2026-11-27, not yet in any skill)
- **Developer's spark:** test every assumption where feasible. The agent and the Developer decide feasibility together. Proof of concept stays small and does not try to solve everything at once. Break assumptions down and prove them one at a time. Assumptions are (1) called out for probing, and (2) when not probed, the Developer signs off directly, knowing they are taking a risk.
- **Am I using incubate right? (answered).** Mostly yes. Incubate's goal is understanding, and its rule "do not drift into implementation design" was added in `c6fcbb3` (2026-11-22), four days before incubate#1 (8b3edef2 started 2026-11-26T20:01Z). Not checked: whether the installed workflow-home copy matched on that date. Incubate#1 broke that rule by inventing Tier 0-3. What no skill does today is *run* a small probe and record the result. Incubate only asks on resume whether one "was completed".
- **Where it lives (Developer):** incubate first. Incubate is where the Developer plays with ideas and proves them out. Brain-storm is for when the Developer is confident unknowns won't crop up and is truly ready to build. Exit gate: no load-bearing piece leaves incubate unobserved without signoff. Under that split, the brain-storm gap mostly closes.
- **The model should not create something out of thin air** that it cannot prove leaves what we are doing unchanged (Developer). Any departure from an example needs proof that it still produces the example's results, or it is flagged as a change.

```text
 assumption ─> split into pieces ─> each piece: observed / inferred / not run
                                        |
                       decision about to rest on a non-observed piece?
                                        |
   STOP (own turn): piece | status + evidence | risk if wrong | cheapest probe
            |                                         |
   "probe it" ─> smallest check, re-label    signoff: why + risk in own words + approve
                                                      ─> Accepted Risk, carried forward
```

- **Signoff format (Developer):** a why, the risk restated in the Developer's own words, then approval. A bare "yes", "A" or "agree" does not count. The Developer's why: "especially during an incubate session where I expect to bring ideas and play with them ... we do everything possible to catch issues before they become expensive. Sometimes that means building small. In this case it means being explicit when you're accepting risk that an idea depends on. That shouldn't be taken lightly." Precedent: brain-storm's "Notice drift" already asks for the riskiest assumption "in their own words" (`brain-storm/SKILL.md:80`), but triggers on accept rate, not on assumption status. Not checked: whether that rule existed or fired in d77825a6.
- **Trust over time (Developer):** deep skill-reviews never stop. As trust grows, the Developer's behavior changes: faster, terser back-and-forth. That is when the stop matters most, so labels never shrink to match the pace. Expensive screw-ups reset trust ("I start digging and trusting less"). This incubation is one. Trust corrects itself only after the cost, so the rule moves the check to before.
- **Live evidence: remote-control brain-storm (Copilot `3a726106`, read 2026-11-27).** The Developer asked for a probe of `pwf claude` plus Remote Control. Observed in the log:
  - Real CLI runs: `claude --version` = 2.1.332; `remote-control --help`; `claude remote-control --add-dir .` and `--plugin-dir .` both returned `Unknown argument`.
  - Probe A (`--add-dir` *before* `remote-control`) failed on a flag the agent made up (`--no-create-session-in-dir`), yet the reply said the subcommand rejects the flags "both before and after".
  - Route 1 ("already passes through `pwf claude --remote-control`") was inferred from code (`home/launch.mjs:232` appends `process.argv.slice(3)`), not run, but it appeared under "Probe Results".
  - The absence of a `pluginDirs` key came from three 15K chunks of a paginated docs page, with the end never confirmed.
  - A lettered A-D menu followed, and option A ("It works") would have been signoff on something nobody ran.
  - Best move: it handed the Developer the cheapest decisive test. The Developer ran `pwf claude --remote-control`, connected, "looks good", and chose to keep it simple: "only allow what proved out". Still unproven: whether Home skills behave the same in the remote view.
- **Steelman vs. 80/20 (2026-11-27).** The steelman is one shared rule across all skills, with skill-review auditing labels. The 80/20 is incubate only. Reasoned through both cases (inferred; neither transcript was re-run against the rule). Incubate-only would catch incubate#1 ("never read beyond a flag" labelled not run, which forces either a replay of S1-S6 or a signoff) and miss `3a726106` (brain-storm). The Developer chose incubate first.
- **Self-correction under the rule.** This session's agent first said it had "replayed" both cases through each version. That was reasoning, so it was relabelled as inferred. Even while discussing the rule, an agent over-claimed. That is why the rule is being hand-probed before any skill edit.

### Hand probe of the Assumption Rule (observed, 2026-11-28)
- **Session:** Claude Code `e92e2ca2` (`/incubate from skill-review-depth.md` plus the rule), 04:27Z to 06:32Z, read in full by this session as it ran. Its log moved mid-session to `~/.claude/projects/C--Projects-Personal-Workflow--claude-worktrees-incubate-skill-review-depth-triage/`. It parked the depth note at `df637ea` on `worktree-incubate-skill-review-depth-triage` (not merged).
- **What the probe found about triage (the depth question):**
  - Turn 1 was a paper replay, honestly labelled "inferred". Real probes followed: logs found (P1), fields present (P2), and counts checked against the hand counts (P3, which found 3 counting bugs: 0 typed turns, wrong main model, a whole-log window).
  - A blind test ran 9 fresh pickers on shuffled tables, with the pass rule and column sets fixed in advance. **0 of 9 passed.** S1 and S2 beat every decoy, and S5 came 3rd (6th or 7th with the conversation or token columns dropped). A confusion-phrase scan, also fixed in advance, found 0 hits in S5.
  - Developer's conclusion: counts catch loud failures (forms, volume, errors). A hallucination needs what was said to be read. The Developer proposed two top-3 lists (triage and tokens, with reviewed sessions removed), then a pick or a random draw.
- **Confounds this session spotted (not in the depth note except the first):**
  - **Skill version** (recorded at depth note line 63). `ask_user` was legal before `c6fcbb3`, so the form count measured which version ran.
  - **The picker brief named "avoid multiple-choice forms (`ask_user`)" as an incubate rule** (observed, all 9 briefs). It was the only rule that lined up with a column, and every top-1 and top-2 reason cites it. The brief was written after the agent saw S5's row. The leak cut *against* S5, so the 0/9 result is partly caused by the brief. A neutral-brief re-run of the all-columns set was suggested but not run.
  - The agent's post-hoc "top 3 = all three bad sessions, 1 in 120" treats 9 overlapping sets as if they were independent, and the brief handed it S1 and S2. It is weaker than stated.
- **Against the three criteria:**

| Criterion | Result | Evidence |
| --- | --- | --- |
| (a) Labels match tool output | **Held**, with one slip | Every observed claim checked against the log matched. The slip: piece 3 (the `8b3edef2` decoy) was grepped but never re-labelled, and the grep didn't settle it |
| (b) Stops: how many, did they carry weight | **They carried weight, but came too wide.** About 6 stops. Each caught something real (20% luck odds, its own lost blindness, the multiple-comparison trap, rules broken after the fixer ran) | Several were bundled with reports or asked 2-3 decisions at once. The Developer's "Wow! I'm lost" (05:13) and "not understanding what I'm being ask" (05:39) both followed stops pitched at script internals |
| (c) Signoffs carry a why and the risk in own words | **None given, and the rule held** | The Developer refused a signoff they couldn't explain ("I can't signoff on p4 if I don't understand", 05:01) and chose a probe every time. The agent never accepted a terse reply as a signoff |

- **The Developer's skepticism did most of the steering (observed).** Refusing the signoff, "you have more than just S5", restating the test in their own words, the column-dropping idea, "were these the same skill?" (which surfaced the version confound), and "counts can't catch a hallucination". The rule gave that skepticism a place to land. It did not create it.
- **The agent still changed one thing without asking (observed):** it added a second scoring ("2 clean decoys") after promising the decoy question as its own stop. That is small, but it is the same class of move as cause #2.
- **Cost (observed from task notifications):** fixer 63.9K and 9 pickers about 41K each, so about 434K subagent tokens, plus the main session. That is cheap next to the ~64M build chain, and it answered the depth question with evidence rather than assertion.
- **Verdict (current leaning):** criterion (a) holds, so per the earlier plan an incubate edit is justified. Criterion (b) says to tune the stop before shipping it: one decision per stop, stated in the Developer's terms (what it means for the result), never in script internals. The "I'm lost" feeling is the cost of getting this wrong, and the Developer named it as one that "sucks and irritates".

## What Fits vs. What Clashes

| Workflow part | What it did here | What would have caught it (a hunch, not a design) |
| --- | --- | --- |
| `incubate` 80/20 check | Fires when the model grows heavier and is framed around cutting weight, so it cut the essential part | Also ask: "Does the simplest version still produce the evidence case that convinced us?" and show it |
| `incubate` "name what was observed" | Not applied to the agent's own claims about the design | Treat design claims like environment claims: unverified until probed |
| `incubate` exit | Graduated with "Claude Code logs" as an assumption to verify, but not "flags are enough" | List the load-bearing assumption and its probe before graduating |
| `brain-storm` constraints | Agent-sourced constraint bundled in with Developer facts; confirmed in one line | Mark where each constraint came from (Developer said it vs. agent proposed it); ask agent-proposed constraints one at a time |
| `brain-storm` menus | A/B/C with "(recommended)" across 40 turns; most energy on plumbing | Spend the anchor question (Q16) on "how will we know it finds things?" |
| `behavior-spec` / `work-planner` | Value requirement "not expressible", so deferred; cost requirement heavily tested | An untestable success requirement becomes a probe or back-test gate before later phases, not a later check by the Developer |
| AGENTS.md mission | Its useful/wasted/expensive split was quoted on one side only | Unchanged, but skills may need to quote the "expensive token" line too |

## Tensions & Tradeoffs
- **Hindsight bias.** Each step looked reasonable at the time, and the Developer agreed at each step. Some of this is a normal requirements miss, not a workflow fault. The test is whether a cheap probe *existed* at the time, and one did: the S1-S6 sessions and their hand-scored findings were on disk.
- **Developer side vs. workflow side.** The Developer said "Yes. Yes this feels good" (120ba52f U20) and "That is my understanding as well" (d77825a6 U9). Under session-review's own outcome rule, a finding goes to the Developer side only when no part could have nudged a better result. Here parts could have: the incubate 80/20 check, brain-storm's constraint confirmation, and the planner's handling of untestable requirements.
- **Is the depth incubation repeating the pattern?** [skill-review-depth.md](skill-review-depth.md) now leans toward "triage + deep read ~270K per session". That is again a design built on one well-chosen case (P06), picked by judgement and "biased toward interesting". A back-test probe is the same cure for both notes.
- **Simplest 80/20 baseline (current leaning):** no skill changes yet. Keep the two-sided-trade lesson in this note and test it by hand on `skill-review-depth`. A heavier version (incubate exit probe gate, source tags on brain-storm constraints, planner stop on "not expressible", an "expensive token" check) would catch more, but it means editing several skills on one data point, which repeats the mistake under study. The 80/20 version misses a design the agent invents with no example behind it.
- **Small population.** Incubate is new, and home-repo has not yet run on Scheduler, so there is little history. "How many other settled items were agent-invented" cannot be answered yet.
- **Tentative agreement (2026-11-27).** The Developer said "sure" to four points but then said they were unsure about part of it and had more questions. Point 1 was later superseded (see the Assumption Rule):
  1. ~~No skill changes yet.~~ Now: no change to incubate until the hand probe of the Assumption Rule passes.
  2. Record the two-sided-trade lesson in this note (done).
  3. Test it by hand on `skill-review-depth`: before more design there, replay S1-S6 and P06 (`docs/research/pull-work-session-review-p06.md`) through the proposed triage step and see which hand findings it would drop.
  4. Decide later: the lesson becomes a candidate incubate rule only if that test catches a real problem or a similar miss recurs.
- **Assumptions to verify:**
  - ~~The S1-S6 hand-review findings fall outside today's flags.~~ Replaced by the observed run result above. The per-line flag check was not done, and which Conversation O10 came from was not checked.
  - Run 1 notices list `model.message`, `model.response` and others as unknown record types (5,282+ notices). If `prepare` skips those records in newer Copilot logs, some agent turns were never readable at all: parser blindness on top of the flag design. Not checked.
  - Cause #4 is a unit error. The S6 log size was not checked, and S6 ran in VS Code, so its log may not be on this machine.
  - The 12 build Conversations were all skill-review work. Each one references the skill-review spec or plan (13 to 469 hits). `c489c2bd` and `9effcf37` also touch home-repo-workflow.
  - "AIU" from `copilotUsage.totalNanoAiu / 1e9`, and `cost` as the premium multiplier, are our readings of undocumented fields.

## Sources
- none external. Local evidence: Copilot logs `~\.copilot\session-state\{8b3edef2,120ba52f,d77825a6,d7ee59fd,c489c2bd,92aa24cf,49319eab,6a266b1e,d3159008,e7bee401,56a9216a,a0eb4fa6,812474c4,e0ce6323,9effcf37}*\events.jsonl` (user messages read in full for the three design Conversations; agent turns read only around incubate#1 U4, incubate#2 U12/U19/U20 and brain-storm U9/U19/U21/U22). Hand-review Conversations 9cc1e41f, 5a8b0a63, e7e1fa49, 34823f6d, 582f5cbe, 21f7cfe1, 3110b358, 3eebcd79, 6ba45d9e and abac3064 were read for usage totals only. Also read: `docs/research/session-review.md` (commit 5edfe11, original "four lenses" draft), `.workflow/incubations/session-review.md`, `.workflow/sessions/context-2026-11-26-1519.md`, `.workflow/specs/skill-review-spec.md`, `.workflow/plans/skill-review/phase-02.md` and `phase-05.md`, and `workflow-home/skill-review/ledger.md` with its 2 summaries. Session 2026-11-27 also read: `docs/research/incubate-session-review.md` in full, `workflow-home/skill-review/review-record.json` (incubate Conversation list), first-event timestamps of 10 incubate Conversations in `~\.copilot\session-state\`, and `.workflow/incubations/home-repo-workflow.md` (from the Tensions section to the end). Second 2026-11-27 session: Copilot `3a726106` `events.jsonl` (all user messages, tool calls and results from 03:41Z on, final assistant reply), `home/launch.mjs` (grep for arg handling), `git log -S` for incubate's "drift into implementation design" rule, and grep of `incubate/SKILL.md`, `INCUBATION-FORMAT.md` and `brain-storm/SKILL.md` for assumption and probe rules.

## Open Threads
- **Lost lenses:** the original draft's four *lenses* (Token Economy, Human-Agent Dynamic, Rule Adherence, Trend) became four cost *tiers* by the end of incubate#1. Were the lenses the real design, swapped out by a similar-sounding name?
- **Agent-invented framing.** How many other "settled" items began as an agent's answer to a broader Developer question? Parked: too few sessions to answer yet.
- **Brain-storm menus.** Did the lettered menus speed up agreement on the wrong things? Lower priority now that the Developer places the gap in incubate.
- **Where the back-test habit lives.** The Developer places it in incubate, since by brain-storm the design already feels settled. Whether it should also cover ideas with no example is still open.
- **How would the agent spot its own drift?** It saw the swap only as a saving, not as a tradeoff.
- **Reconcile with skill-review-depth.md** before more design happens there (see step 3 of the tentative agreement).
- **Parser blindness** (unknown `model.*` records): a separate defect or part of the same miss?
- **Assumption Rule open pieces:** whether agents follow it honestly (not run; being probed); whether stops become too frequent (not run); whether a shared rule later extends to brain-storm (parked: Developer chose incubate first); how the skill edit is installed once the probe passes (inferred: Personal.Workflow source, then `scripts/update-home.mjs`; not checked).
- **"Probe" means two things.** Brain-storm's "Probe with examples" (`brain-storm/SKILL.md:60`) means asking questions, while the Developer means testing. `.workflow/language.md` has no "probe" entry (grep found no hits).

## Pick Up Here
- The hand probe ran (`e92e2ca2`, see "Hand probe of the Assumption Rule"). (a) held, (b) showed the stops are too wide and too technical, and (c) held with no signoffs.
- Next, in this note: draft the Assumption Rule as incubate skill text, with one change from the probe version. **A stop asks one decision, in plain terms of what it changes in the result, with no script internals unless asked.** Show the draft to the Developer before any edit to `incubate/SKILL.md`.
- Open check before relying on the depth result: a neutral-brief re-run of the all-columns picker (no rule list in the brief). It separates "counts can't see S5" from "the brief steered away from S5". It is cheap: one picker, about 41K tokens. That work belongs to `skill-review-depth.md`, not here.
- Merge pending: `worktree-incubate-skill-review-depth-triage` (`df637ea`) has not been merged to `main`.
