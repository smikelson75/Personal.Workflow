# Incubate Skill Session Review & Recommended Changes

**Purpose:** Combined retrospective of the first two real `/incubate` sessions, synthesizing independent reviews from two review sessions (`9cc1e41f` and `39449498` on `claude-opus-5.5`), with concrete conclusions for refining the `incubate` skill, its format, harness usage, and developer habits.

**Sessions reviewed:**
- **Session 1 (`bc4d62d8`):** ~71 min (`2026-11-22 15:44–16:56 UTC`), `gemini-4-neon` (high effort) + `explore` (`gpt-6-luna`) + `research` (`claude-sonnet-5.5`), 13 `ask_user` turns, ~87K chars parent assistant prose (~92K total output tokens). Created [home-repo-workflow.md](../../.workflow/incubations/home-repo-workflow.md) (`7687b01`).
- **Session 2 (`8dcf5bf8`):** ~30 min (`2026-11-22 17:28–17:58 UTC`), `gemini-4-neon` (high effort), 9 `ask_user` calls (1 schema error, 1 user-aborted `ask_user` followed by `"1"`), ~55K chars parent assistant prose (~52.5K total output tokens). Updated [home-repo-workflow.md](../../.workflow/incubations/home-repo-workflow.md) in place (`12e1548`).

**Related workflow files:**
- [incubate SKILL.md](../../.github/skills/incubate/SKILL.md)
- [INCUBATION-FORMAT.md](../../.github/skills/incubate/references/INCUBATION-FORMAT.md)
- [user-interaction.md](../../.github/user-interaction.md)
- [home-repo-workflow.md](../../.workflow/incubations/home-repo-workflow.md)

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
| **Massive repetition & token waste** | Full grounding brief, Mermaid diagrams, comparison tables, and steering-command reminder repeated on almost every turn (reminder appeared ~11x in S1, ~9x in S2; ~144K total output tokens). Hidden `reasoningText` confirms `gemini-4-neon` repeatedly misread its own prior `ask_user` turns as having omitted visible text. | Both (`9cc1e41f` verified root cause in `reasoningText` + token counts; `39449498` flagged checking whether VS Code UI actually hides pre-`ask_user` prose) |
| **Direct user question skipped** | At S1 `16:51`, user asked *"how would you pressure test work policies and dual-harness custom agents?"* Assistant inspected `.github/agents/`, drafted the playbook only in hidden reasoning, emitted `0` chars of visible chat text, and jumped straight to the exit-state prompt claiming the playbook was in front of the user. | Both |
| **Interrogation / wizard pattern** | Nearly every turn ended in a multiple-choice `ask_user` form (including meta-routing *"which thread next?"* prompts) with a pre-selected `(Recommended)` option—turning exploration into a guided architecture wizard. | Both |
| **Complexity creep without pushback** | Model escalated from two worries to 3 layers, dual manifests, an `agents-src/` Node generator script, a thin stack router, env vars, and path rewrites across workflow scripts. `"Challenge this"` was offered as a non-default menu choice rather than proactively run. | Both |
| **Premature `"Settled"` / unverified claims** | Marked *"Dual manifests solve the collision"* as `"Settled"` / `"Solved cleanly"` before any work-machine probe ran; also stated an unverified claim about Copilot skill discovery before running the research subagent. | `39449498` |
| **Ignored `"Pick Up Here"` on resume** | Session 1 ended with *"Run the 4-step work pressure test."* Session 2 resumed and layered on more design without first asking whether those probes had been run. | `39449498` |
| **Interaction-rule slips (`user-interaction.md`)** | Treated 14 single-click enum replies as settled without confirming brief answers; after user aborted `ask_user` in S2 (`17:40`) and typed bare `"1"`, bundled the confirmation with the next steering question (violating *"one question at a time"*). | `9cc1e41f` (correcting `39449498`'s claim that every question followed interaction rules) |
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
