# Incubation - Skill Review Design Miss

Status: incubating
Started: 2026-11-27
Updated: 2026-11-27

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
| 1 | **No probe before build.** The main assumption, "flagged slices find what the hand review found", was never back-tested against the S1-S6 sessions the hand review had already scored. | No probe in either incubate or in brain-storm | Missing gate |
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
- **Simplest 80/20 baseline:** do not add new mechanisms. Add one habit: **before graduating or building, back-test the core mechanism on the known cases that motivated it.** A heavier version would add source tags on constraints, planner gates for untestable success requirements, and a check against the "expensive token" line.
- **Assumptions to verify:**
  - The S1-S6 hand-review findings mostly fall *outside* the lines that today's four flags would mark. This is not yet probed. It is the cheapest test of cause #1 and would turn "inference" into "observed".
  - Cause #4 is a unit error. The S6 log size was not checked, and S6 ran in VS Code, so its log may not be on this machine.
  - The 12 build Conversations were all skill-review work. Each one references the skill-review spec or plan (13 to 469 hits). `c489c2bd` and `9effcf37` also touch home-repo-workflow.
  - "AIU" from `copilotUsage.totalNanoAiu / 1e9`, and `cost` as the premium multiplier, are our readings of undocumented fields.

## Sources
- none external. Local evidence: Copilot logs `~\.copilot\session-state\{8b3edef2,120ba52f,d77825a6,d7ee59fd,c489c2bd,92aa24cf,49319eab,6a266b1e,d3159008,e7bee401,56a9216a,a0eb4fa6,812474c4,e0ce6323,9effcf37}*\events.jsonl` (user messages read in full for the three design Conversations; agent turns read only around incubate#1 U4, incubate#2 U12/U19/U20 and brain-storm U9/U19/U21/U22). Hand-review Conversations 9cc1e41f, 5a8b0a63, e7e1fa49, 34823f6d, 582f5cbe, 21f7cfe1, 3110b358, 3eebcd79, 6ba45d9e and abac3064 were read for usage totals only. Also read: `docs/research/session-review.md` (commit 5edfe11, original "four lenses" draft), `.workflow/incubations/session-review.md`, `.workflow/sessions/context-2026-11-26-1519.md`, `.workflow/specs/skill-review-spec.md`, `.workflow/plans/skill-review/phase-02.md` and `phase-05.md`, and `workflow-home/skill-review/ledger.md` with its 2 summaries.

## Open Threads
- **Lost lenses:** the original draft's four *lenses* (Token Economy, Human-Agent Dynamic, Rule Adherence, Trend) became four cost *tiers* by the end of incubate#1. Were the lenses the real design, swapped out by a similar-sounding name?
- **Agent-invented framing.** How many other "settled" items in recent sessions began as an agent's answer to a question the Developer asked more broadly?
- **Brain-storm menus.** Did the lettered menus speed up agreement on the wrong things? Compare the share of turns on plumbing with the share on core value.
- **Where the back-test habit lives:** incubate exit, brain-storm Success, or the planner's handling of "not expressible". This is a hunch to explore, not a design.
- **Reconcile with skill-review-depth.md** before more design happens there.

## Pick Up Here
- Run the cheapest probe of cause #1. Take 3-4 findings from `docs/research/incubate-session-review.md` that the hand review scored, find their source lines in the matching logs, and check whether today's `prepare` flags (tool-error, long-message, many-questions, user-correction, ±1 line) would have shown those lines to the reviewer. If most fall outside the flags, the root cause is confirmed as "untested core mechanism". Then ask the Developer which workflow part should own the back-test habit.
