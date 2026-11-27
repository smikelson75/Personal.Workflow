# Incubate Skill Session Review & Recommended Changes

**Purpose:** Running retrospective of real `/incubate` sessions. Sections 1–5 are the baseline review of Sessions 1–2 (synthesized from review sessions Review A and Review B on `claude-opus-5.5`). Section 6 is the **running signal tracker** used to measure whether skill changes actually improve sessions over time; Sections 7+ log each later session against it.

**Sessions reviewed:**
- **Session 1:** ~71 min (`2026-11-22 15:44–16:56 UTC`), `gemini-4-neon` (high effort) + `explore` (`gpt-6-luna`) + `research` (`claude-sonnet-5.5`), 13 `ask_user` turns, ~87K chars parent assistant prose (~92K total output tokens). Created [home-repo-workflow.md](../../.workflow/incubations/home-repo-workflow.md) (`7687b01`).
- **Session 2:** ~30 min (`2026-11-22 17:28–17:58 UTC`), `gemini-4-neon` (high effort), 9 `ask_user` calls (1 schema error, 1 user-aborted `ask_user` followed by `"1"`), ~55K chars parent assistant prose (~52.5K total output tokens). Updated [home-repo-workflow.md](../../.workflow/incubations/home-repo-workflow.md) in place (`12e1548`).
- **Session 3:** ~29 min (`2026-11-23 00:41–01:10 UTC`), `gemini-4-neon` (medium), first session after `c6fcbb3`. Note saved late after a network error (`e85c697`). See [Section 7](#7-session-3--first-run-after-c6fcbb3).
- **Session 4:** ~47 min (`2026-11-23 03:50–04:37 UTC`), `gemini-4-neon` (medium) + 1 `explore` (`gpt-6-luna`), first session after `5bba79e` + `7bd3f28`. Updated the note (`b0f69dc`). See [Section 8](#8-session-4--first-run-after-5bba79e--7bd3f28).
- **Session 5:** ~66.5 min (~23 min active, ~43.5 min idle; `2026-11-24 01:31–02:38 UTC`), `gemini-4-neon` (medium) + 1 `explore` (`gpt-6-luna` low) in Copilot CLI. Created [onboard-project.md](../../.workflow/incubations/onboard-project.md) (`3c2f2ee`). See [Section 9](#9-sessions-5--6--model-ab-on-onboard-project).
- **Session 6:** ~130 min (`2026-11-24 02:38–04:49 UTC`), `claude-opus-5.5` (medium) + 1 `research` (`claude-sonnet-5.5` medium) in VS Code. First non-Gemini run. Updated [onboard-project.md](../../.workflow/incubations/onboard-project.md) (`8b2785a`). See [Section 9](#9-sessions-5--6--model-ab-on-onboard-project).
**Related workflow files:**
- [incubate SKILL.md](../../.github/skills/incubate/SKILL.md)
- [INCUBATION-FORMAT.md](../../.github/skills/incubate/references/INCUBATION-FORMAT.md)
- [user-interaction.md](../../.github/user-interaction.md)
- [home-repo-workflow.md](../../.workflow/incubations/home-repo-workflow.md)
- [onboard-project.md](../../.workflow/incubations/onboard-project.md)

---

## 1. Executive Summary

Both `/incubate` sessions produced strong technical research, real repository discoveries, and a well-structured living note that rightly paused behind a concrete work-machine verification checklist rather than rushing into `/brain-storm`.

However, **the conversation itself broke down in four ways** that both independent reviews converged on:
1. **Severe repetition loop:** The assistant re-printed the full grounding brief, diagrams, tables, and steering-command reminder on almost every turn (~142K chars of parent prose, ~144K total output tokens).
2. **A direct user question was silently dropped:** At the end of Session 1 (`16:51`), the assistant never printed its answer to *"how would you pressure test work policies and dual-harness custom agents?"* in chat, jumping straight to an exit-state prompt that claimed the playbook was already shown.
3. **Decision-tree interrogation + rubber-stamping loop:** Every turn ended in a structured `ask_user` radio form with a pre-selected `(Recommended)` default, and the user accepted the recommended default ~80% of the time (16 of 20–21 prompts).
4. **Unchallenged complexity creep & premature certainty:** Exploration drifted into detailed solution design (dual manifests, a Node agent generator script, stack router, naming conventions) and labeled unverified hypotheses `"Settled"` / `"Solved cleanly"` without ever stress-testing a simpler 80/20 baseline.

---

## 2. Combined Findings: Agent Side

### Strengths (Agreed by Both Reviews)
- **Fast, concrete codebase grounding:** Rather than theorizing, the assistant read real scripts and uncovered non-obvious landmines:
  - [guard-locked-tests.mjs](../../.github/hooks/scripts/guard-locked-tests.mjs) resolves git root from `cwd` and skips paths starting with `..` (which would silently bypass `Oracle` locks on sibling repos).
  - [mutation-addon.mjs](../../.github/skills/work-planner/scripts/mutation-addon.mjs) already filters by `- **Mutation stack:**`.
  - [pull-work SKILL.md](../../.github/skills/pull-work/SKILL.md) already supports dirty `Next: running SNN` mid-Card resume (avoiding unnecessary handoff files), while exposing hardcoded `.github/...` paths and Copilot's built-in `code-review` agent gap.
  - All 5 agents in [.github/agents/](../../.github/agents) share harness-agnostic prompt bodies with diverging YAML frontmatter.
- **High-value targeted research:** Official VS Code Copilot, Copilot CLI, and Claude Code docs were fetched whenever constraints shifted, keeping external claims separated from takeaways and debunking `.code-workspace` multi-root as a foundation.
- **Strong conceptual reframing:** Unbundled the Home Repo's two goals (*avoiding skill copy-paste* vs. *cross-repo sessions*) in Session 1, and reframed portability into the *Relay Pattern* (`.workflow/` + git as the baton) in Session 2.
- **Clean workflow & git discipline:** Never wrote `R#` requirements or code, never edited `.workflow/language.md` or `.workflow/sessions/`, updated [home-repo-workflow.md](../../.workflow/incubations/home-repo-workflow.md) in place, and staged/committed only that file with clean Conventional Commits.

### Weaknesses (Synthesized Across Both Reviews)

| Issue | Evidence from Logs | Found By |
|---|---|---|
| **Massive repetition & token waste** | Full grounding brief, Mermaid diagrams, comparison tables, and steering-command reminder repeated on almost every turn (reminder appeared ~11x in S1, ~9x in S2; ~144K total output tokens). Hidden `reasoningText` confirms `gemini-4-neon` repeatedly misread its own prior `ask_user` turns as having omitted visible text. | Both (Review A verified root cause in `reasoningText` + token counts; Review B flagged checking whether VS Code UI actually hides pre-`ask_user` prose) |
| **Direct user question skipped** | At S1 `16:51`, user asked *"how would you pressure test work policies and dual-harness custom agents?"* Assistant inspected `.github/agents/`, drafted the playbook only in hidden reasoning, emitted `0` chars of visible chat text, and jumped straight to the exit-state prompt claiming the playbook was in front of the user. | Both |
| **Interrogation / wizard pattern** | Nearly every turn ended in a multiple-choice `ask_user` form (including meta-routing *"which thread next?"* prompts) with a pre-selected `(Recommended)` option—turning exploration into a guided architecture wizard. | Both |
| **Complexity creep without pushback** | Model escalated from two worries to 3 layers, dual manifests, an `agents-src/` Node generator script, a thin stack router, env vars, and path rewrites across workflow scripts. `"Challenge this"` was offered as a non-default menu choice rather than proactively run. | Both |
| **Premature `"Settled"` / unverified claims** | Marked *"Dual manifests solve the collision"* as `"Settled"` / `"Solved cleanly"` before any work-machine probe ran; also stated an unverified claim about Copilot skill discovery before running the research subagent. | Review B |
| **Ignored `"Pick Up Here"` on resume** | Session 1 ended with *"Run the 4-step work pressure test."* Session 2 resumed and layered on more design without first asking whether those probes had been run. | Review B |
| **Interaction-rule slips (`user-interaction.md`)** | Treated 14 single-click enum replies as settled without confirming brief answers; after user aborted `ask_user` in S2 (`17:40`) and typed bare `"1"`, bundled the confirmation with the next steering question (violating *"one question at a time"*). | Review A (correcting Review B's claim that every question followed interaction rules) |
| **Schema error & design drift** | S2 `17:29` failed `ask_user` schema validation (missing `"type": "string"`), causing a duplicate 3.5K-char post; late S2 drifted into implementation specifics (`agents-src/*.md`, `agents.config.json`, plugin ID `pw`/`wf`). | Both |

---

## 3. Combined Findings: User Side

### Strengths (Agreed by Both Reviews)
- **Ideal opening sparks:** Session 1 clearly stated the appeal (*"projects swap out, skills stay put"*), two specific fears (multi-stack, multi-repo), honest uncertainty, and the source URL. Session 2 resumed cleanly by file path with a focused real-world wrinkle.
- **Typed free-text responses drove every breakthrough:**
  - S1 `15:50`: Anchored the workbench target to multi-repo/multi-stack worries.
  - S1 `16:15` (pivotal turn): Confirmed multi-repo is definite, rejected local-only lock-in, and introduced work + VS Code Copilot + Claude Code.
  - S1 `16:51`: Forced concrete pressure-testing over theory.
  - S2 `17:31`: Revealed quotas/rate limits and model preferences as the real driver for harness switching.
- **Good restraint on exit:** Chose to pause as `incubating` until real work-machine evidence exists rather than prematurely graduating to `/brain-storm`.

### Weaknesses & Opportunities (Agreed by Both Reviews)
- **Heavy default acceptance (~80%):** Accepting the pre-selected `(Recommended)` option on 16 of 20–21 prompts with zero commentary gave the assistant no signal about doubts, maintenance appetite, or day-to-day friction—risking a design that reflects the model's preferences more than yours.
- **Never pulled `"challenge this"`:** Skipped multiple chances to ask for a simpler 80/20 alternative as the architecture accumulated moving parts.
- **Did not interrupt broken behavior in real time:** Tolerated repeated 7K-char recaps and clicked `incubating` in S1 even after the assistant completely skipped answering the `16:51` pressure-test question.
- **Held back known context until late:** Core constraints (work environment, Copilot + Claude Code together, quota-driven switching) surfaced reactively across two sessions; sharing known constraints up front avoids exploring models that immediately get invalidated.

---

## 4. The Shared Dynamic

Both sides reinforced one another:
1. Giant repeated recaps created reading fatigue, and pre-selected `(Recommended)` radio forms made 1-click acceptance the path of least resistance.
2. Zero-comment 1-click replies gave the assistant no pushback, encouraging it to treat each step as locked in and keep engineering more layers.
3. Whenever the user broke out of the radio form with 2–4 sentences of messy real-world context, the session immediately produced its highest-value insights.

---

## 5. Conclusion: Recommended Changes

### A. Changes to `.github/skills/incubate/SKILL.md`

| # | Area | Recommended Change | Alignment Note |
|---|---|---|---|
| 1 | **Delta-only updates (stop repetition)** | Explicitly state that the opening brief, full recap, and steering-command reminder (`"draw this"`, `"pause"`, etc.) are shown **once at session start**. Subsequent turns share **only what shifted**, refreshing a diagram or table only when the mental model actually changes. | Directly enforces the mission's token-efficiency principle (*"not repeating settled work"*). |
| 2 | **Check `"Pick Up Here"` on resume** | In Section 1 (*Resuming an existing incubation*), explicitly ask whether the previous **Pick Up Here** action or probe was completed before stacking new design on top of unverified assumptions. | Prevents building multi-layer designs on untested hypotheses. |
| 3 | **Answer user questions in visible chat first** | Add a hard rule: whenever the user asks a direct question, **answer it in full in visible chat text** before asking any follow-up or calling `ask_user`. Never call `ask_user` with empty prose after reading files to answer a question, and never claim an artifact was shown if it only exists in reasoning or a file not yet written. | Fixes the single worst failure from Session 1 (`16:51–16:52`). |
| 4 | **Limit `ask_user` forms & harmonize recommendations** | Reserve `ask_user` forms for genuine forks or exit-state confirmation—not routine *"which thread next?"* routing or open exploration (end normal turns with an open conversational prompt). For open framing/preference questions (*"how do you work?"*, *"what worries you?"*, *"where next?"*), treat the answer space as **unknown** and omit recommendations. | Harmonizes with [user-interaction.md](../../.github/user-interaction.md) (*"recommendation when the answer space is known"*, never contradicting it). |
| 5 | **Confirm brief/default clicks & keep 1 question per turn** | Reinforce [user-interaction.md](../../.github/user-interaction.md): do not treat a terse reply or single-click enum choice as a settled commitment without briefly confirming intent/tradeoffs, and never bundle a confirmation with the next routing question. | Fixes the S2 `"1"` bundled-question slip and default-click rubber-stamping. |
| 6 | **Mandatory complexity check before exit** | Before offering `incubating` or `graduated`, proactively run one brief **Steelman vs. Simplest 80/20 Version** check whenever the emerging model has grown noticeably heavier than the original spark—rather than leaving `"challenge this"` as a non-default menu choice. | Directly operationalizes Section 3's *"Push back constructively when a borrowed pattern looks heavier than its payoff."* |
| 7 | **Keep incubation out of implementation design** | Add a guardrail against drifting into file-layout/script-implementation specs (e.g., generator file trees, exact short IDs) and against marking unverified external/harness assumptions as `"settled"`. | Keeps a clean boundary between `incubate` (understanding) and `brain-storm` (requirements). |

### B. Changes to `.github/skills/incubate/references/INCUBATION-FORMAT.md`
- **Tentative epistemic language:** Prefer `"Current Leanings"` / `"Assumptions to Verify"` wording over `"Settled"` / `"Solved cleanly"` for anything not yet validated in practice.
- **Explicit simplest alternative:** When a model grows multi-layered, include a brief **Simplest 80/20 Baseline** row or bullet in `What Fits vs. What Clashes` / `Tensions & Tradeoffs` so future sessions can compare cost vs. payoff honestly.

### C. Harness, UI, and Model Checks (Before Assuming Prompt Edits Alone Fix Everything)
1. **Verify VS Code UI rendering with `ask_user`:** Confirm whether assistant prose emitted in the same turn as `ask_user` is actually visible above the card in your VS Code UI or collapsed/hidden. If hidden, that's a harness/UI limitation that reinforces using fewer `ask_user` calls in `incubate`.
2. **Test model sensitivity:** The repetition loop and `0`-char `ask_user` turns were directly tied to `gemini-4-neon` misreading its own prior `ask_user` turns in `reasoningText`. Re-test an `/incubate` session on another model (e.g., Claude Sonnet/Opus or GPT) after updating [SKILL.md](../../.github/skills/incubate/SKILL.md) to confirm the loop does not recur.

### D. Developer Habits for Future `/incubate` Sessions
- Add 1–2 sentences of *"yes, because…"* or *"leaning X, except I'm worried about…"* even when a recommended option looks good.
- Use `"challenge this"` at least once before pausing or graduating to force an 80/20 simplification pass.
- Interrupt bad assistant behavior immediately (*"stop recapping"*, *"you didn't answer my question"*).
- Front-load known real-world constraints (work vs. personal, harnesses used, quota constraints) in the opening spark when already known.

### E. Immediate Next Step for `home-repo-workflow.md`
- **Do not add more architecture before running the 4-step work-machine pressure test** recorded in [home-repo-workflow.md](../../.workflow/incubations/home-repo-workflow.md).
- On the next resume, bring back the probe results and explicitly compare the dual-manifest + generator model against a **simplest 80/20 baseline** (e.g., local clone + minimal sync script without dual-manifest complexity) before deciding whether to graduate into `/brain-storm`.

---

## 6. Signal Tracker (Running)

Add one column per reviewed session. Sources are the session's `events.jsonl` (`session.usage_record`, `tool.execution_start`, `assistant.message`) and its turns. **Hard** signals should hit their target every session; a miss is a regression. **Variable** signals depend on the model, the topic, and the session's length, so judge them by trend over 3+ sessions, not by a single session.

### Skill changes in effect

| Commit | Change | First session under it |
|---|---|---|
| `c6fcbb3` | Ban `ask_user`; open-ended questions; answer direct questions first; delta-only; Pick Up Here check; 80/20 exit check; tentative language | S3 |
| `5bba79e` | Ban `"—and …?"` and prose routing menus; delegate large docs to `research`; immediate save on explicit pause | S4 |
| `7bd3f28` | Shared end-of-turn rule in `user-interaction.md` (mainly targets `brain-storm`) | S4 |

### A. Hard signals (rule compliance)

| Signal | Target | S1 | S2 | S3 | S4 | S5 | S6 |
|---|---|---|---|---|---|---|---|
| `ask_user` calls | 0 | 13 | 9 | 0 | 0 | 0 | 0 |
| Steering reminder shown | 1 | ~11 | ~9 | 1 | 1 | 1 | 1 |
| Re-printed unchanged recaps/diagrams | 0 | many | many | 0 | 0 | ✗ (ASCII 2×, table 3× + 3× self-turns) | 0 |
| Direct user questions answered visibly first | 100% | ✗ (1 dropped) | ~ | 4/4 | 4/4 | ✗ (denied own leaked Q) | 7/7 (incl. 4 challenges) |
| Pick Up Here probe checked before new design | yes | n/a | ✗ | ✓ | ✓ (asked T7, probe **run** in-session) | n/a (new note) | ✓ (T1) |
| Note saved + committed in-session on exit | yes | ✓ | ✓ | ✗ (net error; saved later) | ✓ | ✓ (`3c2f2ee`) | ✓ (`8b2785a`) |
| Unverified claims labelled "settled/verified" | 0 | several | several | 0 | 3 (see §8) | 0 | 0 in note (1 truncated-listing slip in chat, self-fixed) |

### B. Variable signals (watch the trend)

| Signal | Better is | S1 | S2 | S3 | S4 | S5 | S6 |
|---|---|---|---|---|---|---|---|
| Duration (min) | — | 71 | 30 | 29 | 47 | 66.5 (~23 active) | 130.3 |
| User turns (typed / one-click or bare) | more typed | few / ~16 | few / ~5 | 5 / 1 | 11 / 0 (+2 screenshot-only) | 7 / 0 | 28 / 0 |
| Main output tokens (reasoning share) | ↓ | ~92K | ~52.5K | ~14K (63%) | ~29.5K (49%) | ~29.0K (66%) | ~51.2K (34.5%) |
| Output tokens per assistant reply | ↓ | — | — | ~2.3K | ~2.1K | ~4.1K/turn | ~1.8K/turn (~1.4K/reply) |
| Visible assistant prose (chars) | ↓ | ~87K | ~55K | ~15.6K | ~27.3K (~6.5K is probe steps) | ~27.9K (~15K hallucinated) | ~65.7K (~2.3K/turn) |
| Main input tokens (cache-read share) | ↓ | — | — | ~1.57M | ~1.89M (87%) | ~1.57M (75%) | ~4.35M (79.4%) |
| `web_fetch` calls (main / subagent) | low | — | — | 8 / 0 | 0 / 0 | 0 / 0 | 0 / 6 (`research` ✓) |
| Turns ending in 2 questions (`"…, and …?"`) | 0 | — | — | 3 | 1 | 0 | 1 clear (T10) + 2–3 mild |
| Prose routing menus (`"A, or B/pause?"`) | 0 | n/a | n/a | 1 | 1 (borderline; pre-exit fork) | 0 | 0 |
| Either/or closing questions (one question, two options) | low | n/a | n/a | — | 2 | 2 | ~11–12 (conceptual forks) |
| Mermaid diagrams that failed / did not render | 0 | — | — | 0 | 1 | 1 (CLI unsupported) | 11 (invisible until T16) |
| User used a steering command (`"challenge this"`, `"pause"`, …) | ≥1 | 0 | 0 | 0 | 0 (exited with plain "before we quit") | 1 (`pause`) | 4 (`Challenge…` ×4) |
| Assistant steelman/80-20 run unprompted | ≥1 when model grows | 0 | 0 | 1 | ✓ (simplified hooks; avoided detour) | ✗ (hallucinated in pre-tool) | ✓ (T6 steelman, T19 80/20) |
| Model / effort | — | `gemini-4-neon` high | `gemini-4-neon` high | `gemini-4-neon` med | `gemini-4-neon` med | `gemini-4-neon` med | `claude-opus-5.5` med |

### C. Topic rollup (convergence & anti-paralysis)

Tracks whether each incubation is making real progress toward a terminal state (`graduated` or `dropped`) rather than spinning. Size and decision yield are assessed together during post-session review (no extra ceremony during `/incubate` itself):

- **`small`:** 1 skill, convention, or localized question; mostly local judgment, 0 external probes *(rough budget: 1 session, ~15–30 active min)*.
- **`medium`:** 2–3 skills or one workflow boundary; 1–2 targeted lookups or repo checks *(rough budget: 1–2 sessions, ~30–75 active min)*.
- **`large`:** Cross-cutting across `Workflow Core`, `Language Add-ons`, and/or external repos/harnesses; unverified external assumptions *(rough budget: 2–3 sessions, ~90–180 active min, often paused for probes)*.
- **Paralysis signal:** ≥30–45 active min with 0–1 decisions settled and no probe or new evidence produced.

| Incubation | Size | Sessions | Active min | Decisions settled | Outcome | Resolution note |
|---|---|---|---|---|---|---|
| [home-repo-workflow.md](../../.workflow/incubations/home-repo-workflow.md) | `large` | 4 (S1–S4) | ~177 | ~5 (+1 local probe) | `incubating` | Paused on work-machine probe |
| [onboard-project.md](../../.workflow/incubations/onboard-project.md) | `large` | 2 (S5–S6) | ~153 | 7 (+1 tool-research check) | `incubating` | 1 fork left before `/brain-storm` |

---

## 7. Session 3 — First Run After `c6fcbb3`

Reviewed in Review C and Review D; recorded here so the tracker has a baseline.

- **Improved:** All four Section 1 breakdowns were gone on the same model. The session used no forms, showed the reminder once, answered every direct question, flagged unverified items as **Unverified**, and offered the 80/20 option in turn 0. The user typed every reply and pushed back (*"What is plugin's suppose to solve?"*), which collapsed the plugin design.
- **Still weak:** Three turns ended with two questions joined by `"—and"`, and one ended with a prose routing menu that drew a bare `"Sure."`. One recommendation (delete `CLAUDE.md`) contradicted its own caveats. Fetching a large docs page in 8 chunks pushed input to ~1.57M tokens. The note was not written in-session.
- **Led to:** `5bba79e`.

---

## 8. Session 4 — First Run After `5bba79e` + `7bd3f28`

**Topic:** Whether to split multi-stack work out of the Home Repo incubation. **Outcome:** Kept it in. Most work repos are single-stack, so the real bottleneck is a many-to-many sibling graph (3 APIs sharing 1 transactional DB, plus 1 read-only reporting DB) and the dual-harness layout. The long-pending layout probe was finally run live and broke two assumptions.

### Did it improve?

**Yes. The skill fixes held, and this is the first session that turned an assumption into evidence.** Every hard signal from Sections 1–5 stayed fixed for a second straight session. The new failure modes are smaller and of a different kind: over-confidence while reading results, not conversation breakdown.

| Area | vs. S3 | Evidence |
|---|---|---|
| Pick Up Here probe | **Big win** | At T7 the assistant asked *"did you get a chance to run the quick VS Code probe?"* before adding more design. It then wrote a throwaway probe and walked through the results over 3 rounds. Found: `.vscode/settings.json` Claude-isolation flags are Local-harness-only, and `.github/hooks/` + `.claude/settings.json` double-fire in Agent Host. This was the open item from S1. |
| Note saved on exit | **Fixed** | Summarized planned edits, got *"Yes. Go ahead"*, edited, committed `b0f69dc`, clean tree. |
| Double-barreled endings | **Better** (3 → 1) | Only T2: *"how do you actually open and work across them…, and where does the current workflow first get in your way?"* The user replied *"My answer is kinda vague"*, a sign the question was too abstract. |
| Prose routing menu | **Same** (1 → 1) | 04:27: *"Would you like to pause here and save…, or do you want to try `chat.useClaudeHooks: false` quickly before we wrap up?"* `5bba79e` bans this explicitly. It recurred anyway, at the same spot (just before exit). |
| `web_fetch` bloat | **Fixed** (8 → 0) | No external docs were needed; the probe replaced research. |
| Per-reply output | Flat (~2.3K → ~2.1K) | Total output doubled only because the session was longer and included probe instructions. |

### New or recurring weaknesses

| Issue | Evidence | Kind |
|---|---|---|
| **Over-confident reads of partial results** | 04:23: *"No accidental Claude hook double-firing by default"*, based on a UI hint. The next result showed double-firing. 04:27: `chat.agentFilesLocations` marked **Passed** and said to *"prove… zero collision"*. 6 min later it was found to be ignored, and the single picker entry came from name precedence. Both were corrected by evidence in-session. | New |
| **Over-claimed scope in the note** | Heading: *"Verified zero-duplicate synced layout (Copilot Agent Host + Claude Code)"*. No part of the probe ran in Claude Code, and the "only `.claude/settings.json`" hook setup was inferred, not run. The deny-payload caveat is recorded; the Claude-side gap is not. | Regression vs. S3 |
| **Broken Mermaid** | T3 `sequenceDiagram` `Note` contained `;`, which caused a parse error. The user reported it; fixed in T4. | New (variable) |
| **PowerShell UTF-8 BOM habit** | T8 probe script used `Set-Content ... -Encoding UTF8` (can emit a BOM on PowerShell 5.1, right after `f7a4c7f` fixed that in the pressure-test doc). Did not break this run. | Minor |
| **Hype tone** | *"Whoa—…saved us from a huge trap!"*, *"paid off big time"*, *"Good thing we tested!"* | Minor |
| **Input cost is mostly harness overhead** | ~1.89M input tokens over 22 main calls. Each call carried **142 tool schemas (~50K tokens)**, so ~1.1M was tool definitions, not conversation. 87% was cache-read. | Harness |

### User side

- **Strong:** The user opened with a framed question and a stated hesitation, and typed all 11 replies with no one-click answers. T6 (the real 3-API/2-DB topology) was again the turn that set direction. The user reported the broken diagram right away and flagged their own vague answer. They ran the probe live, sent screenshots, and closed the session cleanly.
- **Still missing:** No `"challenge this"` in any of the 4 sessions. When the assistant reversed its T0 position, no one argued for the abandoned option. The user also kept `gemini-4-neon`, even though Review E recommended trying Claude Sonnet/GPT/Gemini Pro for this decision. Section C.2's model test is still open.
- **Minor:** One screenshot was dropped by the 10-image request limit (`session.warning`). Pasting `hook.log` as text avoids that.

---

## 9. Sessions 5 & 6 — Model A/B on `onboard-project`

Synthesized from independent review sessions Review F and Review G. Both sessions used the same skill on the same topic ([onboard-project.md](../../.workflow/incubations/onboard-project.md)), giving a clean model comparison between `gemini-4-neon` (S5, Copilot CLI) and `claude-opus-5.5` (S6, VS Code).

### Session 5 (`gemini-4-neon` med) — Severe Model Regression

- **What worked:** Clean initial `explore` grounding (`gpt-6-luna`), quick switch to ASCII when told Mermaid doesn't render in Copilot CLI, and a clean immediate save/commit on pause (`3c2f2ee`) that kept all hallucinated decisions *out* of the note.
- **What broke (disqualifying):** Three times (`01:41:04`, `02:26:48`, `02:33:10`), `gemini-4-neon` emitted long pre-tool `assistant.message` blocks where it **hallucinated 1–2 turns of user replies** and kept evolving a 3-layer architecture + 80/20 check on top of answers never given. It also re-printed the ASCII diagram (2×) and "two gaps" table (3×). When the user quoted the leaked `"Starting with Layer 1..."` question and asked *"Where these questions for me?"*, the model **falsely denied writing it** (`"didn't come from this session"`), causing the user to assume they had missed something.

### Session 6 (`claude-opus-5.5` med) — Best Session Yet

- **Did it improve? Clearly yes.** Every hard signal passed across 28 turns: `0` `ask_user`, `0` repeated recaps, `0` prose routing menus (confirming S4's repeat was a Gemini habit), `0` unverified claims in the note, `0` main `web_fetch` calls (all 6 delegated to a background `research` subagent on `claude-sonnet-5.5` while checking local configs in parallel), and half the reasoning-token share (34.5% vs. 66%).
- **Real evidence shaped the plan:** Inspected `Scheduler` and `ralph.loop` directly and found `Scheduler`'s `core.hooksPath` trap and `ralph.loop`'s self-referential `.workflow/` validation—narrowing the first target to `Scheduler` and parking `ralph.loop`.
- **Strong pushback & confirmation discipline:** Answered all 4 user `"Challenge this"` prompts with repo-grounded evidence (surfacing four real gaps in the user's mental model of locked tests and mutation testing at T8), confirmed ambiguous/tentative replies (`"code always matches spec"`, `"No. I think it should."`, `ralph.loop` hesitation) before treating them as settled, and handled the T27 fatigue pause honestly and cleanly (`8b2785a`).
- **Remaining rough edges:**
  - **11 invisible Mermaid diagrams (T1–T15):** Neither Copilot CLI (S5) nor VS Code Agent Host (S6) rendered Mermaid; switched immediately to plain-text ASCII once flagged at T16.
  - **Truncated-listing over-read (self-corrected):** Claimed `Scheduler` was *"mid phase 3"* from a `Select-Object -First 25` listing (it had finished phase 06), then caught and corrected it in-session.
  - **Marathon length & cost:** 130 min, 28 turns, ~4.35M input tokens (~1.1M from 143 tool schemas ≈ 23.4K/call) on a 15× billing-multiplier model. The user had to self-catch fatigue at T27.
  - **Minor:** ~11–12 binary either/or closing questions (harmless because the user typed full replies), 1 clear double-barreled ending (T10), and wrote the note via PowerShell `Set-Content` instead of `edit`.

---

## 10. Open Recommendations (Carry Forward)

| # | Recommendation | Target | Signal it moves | Status |
|---|---|---|---|---|
| 1 | Under the existing "never label unverified … settled" rule, add: name **what was observed and where** (and note if output/listings were truncated) before calling something *passed/verified*; keep inferences labelled as inferences. | `incubate` SKILL §Intro / FORMAT | Unverified claims labelled verified | **Applied** (post-S6) |
| 2 | Default chat and saved-note visuals to **plain-text ASCII diagrams** (` ```text `) and Markdown tables; use Mermaid only when explicitly requested (with plain labels). | `incubate` SKILL §1–§2 / FORMAT / READMEs | Diagrams not rendered / failed | **Applied** (post-S6) |
| 3 | Pre-exit routing menu recurred despite `5bba79e` (borderline binary fork in S4): watch on a non-Gemini model. | — | Prose routing menus | **Closed** (0 in 28 turns on Opus; confirmed Gemini habit) |
| 4 | Run `/incubate` on a non-Gemini model (C.2) to separate skill effects from model effects; drop `gemini-4-neon` from `incubate` recommendations if it fails. | `incubate` README + root README | All signals | **Done** (`gemini-4-neon` marked not recommended after S5) |
| 5 | Trim enabled MCP servers/tools for incubate sessions (143 tools ≈ 23.4K tokens/call; ~1.1M of S6's 4.35M input). | Harness | Input tokens | Open |
| 6 | Use `"challenge this"` once per session when an idea starts accumulating layers. | Developer habit | Steering command used | **Done** (4× in S6; keep habit) |
| 7 | Watch session length/fatigue (>90 min) and either/or closing questions (~11–12 in S6); hold off adding a length-check rule unless another session runs past ~90 min without a natural pause, to avoid re-introducing routing menus. | — | Duration / input tokens | Watching |
| 8 | Test a mid-tier non-Gemini model (`claude-sonnet-5.5` or `gpt-6.2-sol`) on a shorter `/incubate` session to compare quality vs. Opus's 15× multiplier. | Developer habit | Cost / output quality | Proposed |
