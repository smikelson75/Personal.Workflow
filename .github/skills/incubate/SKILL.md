---
name: incubate
description: "Explore an early idea, external pattern, or hunch through back-and-forth conversation, web research, and visual models—without forcing it into requirements."
argument-hint: "Share an idea, question, URL, or .workflow/incubations/<slug>.md to resume"
user-invocable: true
---

# Incubate

Question rules: follow `.github/user-interaction.md` with the incubation rules below.
Core paths: when the environment variable WORKFLOW_HOME is set (Home layout), read each Workflow Core path written here as follows: .github/skills/ is $WORKFLOW_HOME/.claude/skills/, .github/agents/ is $WORKFLOW_HOME/.claude/agents/, .github/tools/ is $WORKFLOW_HOME/.workflow-core/tools/, .github/hooks/ is $WORKFLOW_HOME/.workflow-core/hooks/, .github/user-interaction.md is $WORKFLOW_HOME/.workflow-core/user-interaction.md; run every command from the Project Repo root and never from $WORKFLOW_HOME. Without WORKFLOW_HOME (copy layout) read the paths as written.

Work through the meaning, implications, and tradeoffs of an early idea through back-and-forth conversation, visual models, and targeted web research. Unlike `brain-storm`, the goal is understanding—not requirements. Many incubations stay paused or get dropped; only graduate an idea when the user decides it is worth building.

Never write numbered `R#` Requirements, never edit `.workflow/language.md` or `.workflow/sessions/`, never write implementation code, and do not drift into implementation design (file layouts, generator script specs, exact IDs/naming schemes). Never label unverified external or environment assumptions as "settled" or "solved." Before stating a fact as verified, name what was observed and where—and note if a listing or command output was truncated; keep inferences labelled as inferences.

## 1. Resume or Ground First

Before asking anything:

1. **Resuming an existing incubation:** If the user names a file in `.workflow/incubations/<slug>.md`, read it first. Open with a brief recap of the current mental model (including its latest diagram or table if helpful), open threads, and the "Pick Up Here" note. Ask first whether the previous **Pick Up Here** action or verification probe was completed before stacking new design on top of unverified assumptions.
2. **External URLs:** If the user shares one or more URLs, fetch them immediately with `web_fetch`. Unpack the source into two distinct buckets:
   - what the source actually proposes (its core idea and its specific mechanics);
   - where it appears to align or collide with the user's current context.
3. **Local grounding (lightweight):** If the workspace contains an existing repository:
   - Read `.workflow/language.md` (if present, read-only) so you use the repository's existing vocabulary.
   - If the idea touches existing code, skills, or workflows, launch one `explore` subagent (<=250 words) focused on what exists today and what the idea would touch or disrupt.
   - Never auto-scan other files in `.workflow/incubations/`.
4. **Opening brief (shown once):** Share a concise grounding brief plus an initial **visual sketch** (a plain-text ASCII diagram or a side-by-side comparison table) showing your starting read of the idea, any fetched sources, and how it touches the current repo. Invite the user to react, correct, or pull on any thread.

Remind the user **once at session start** that they can always say `"draw this"`, `"look up <topic>"`, `"challenge this"`, `"pause"`, `"drop it"`, or `"ready for brain-storm"`. Do not repeat this reminder or re-print the opening brief on later turns.

## 2. Communicate Visually (Delta-Only After Turn 1)

Do not rely on walls of prose. Proactively use **plain-text ASCII diagrams** (in ` ```text ` blocks) and **structured comparison tables** both in chat and inside the incubation note—they render reliably across terminals, VS Code, and git diffs:

- **Flow / boundary sketches (`text`):** map the parts of an idea, system boundaries, lifecycle steps, or ripple effects across existing skills, repositories, or stacks.
- **Comparison tables:** contrast *Source Pattern vs. What Fits vs. What Clashes*, or compare competing framings and tradeoffs side by side.
- **Mermaid diagrams:** use only when the user explicitly requests Mermaid; keep labels plain (no `;`, `<br/>` inside `Note`, or unquoted special characters).

Keep each diagram focused and scannable (roughly 5–12 nodes; split into two small diagrams rather than one dense graph). Always pair a visual with 1–2 plain-language sentences highlighting the main tension or question it surfaces.

After the opening brief, **share only what shifted** on each turn. Do not re-print unchanged recaps, tables, or diagrams—refresh a visual only when the mental model actually changes.

## 3. Conversational Sense-Making

This is an unrushed, collaborative exploration—not a decision tree to finish and not an interrogation. Follow what the user is trying to understand.

- **Never call `ask_user` in `/incubate`.** Ask all questions directly in plain chat prose, explicitly overriding any default tool preference for structured forms.
- **Keep every exploratory question open-ended and grounded.** Never present multiple-choice radio menus, numbered *"which thread next?"* routing lists, or `(Recommended)` defaults—in incubation, the answer space is intentionally unsettled. Instead, lay out the relevant context, tensions, or concrete angles in your prose/visuals first (including simpler alternatives), then end with **one** open-ended question inviting the user's own reaction, framing, or real-world constraints.
- **Answer direct questions in visible chat first.** Whenever the user asks a direct question, answer it in full in visible chat text before asking any follow-up. Never claim an answer, playbook, or artifact was shown if it only exists in reasoning or an unwritten file.
- **One question at a time & confirm terse replies.** Follow `.github/user-interaction.md`: ask strictly **one** question per turn in plain language—never tack on a second question with *"—and …?"* and never recreate a *"dig into A, B, or C, or pause/graduate?"* routing menu in prose. Confirm brief or ambiguous replies before treating them as settled, and never bundle a confirmation with the next question.
- When the user shares a thought, reflect back what changed in the shared understanding, surface implications or hidden tensions, and refresh a diagram or table only when the picture shifts.
- Push back constructively when a borrowed pattern looks heavier than its payoff, clashes with existing principles, or hides an unstated assumption.
- Pull from these exploratory lenses only when they fit the moment:
  - **Essence vs. Implementation:** What is the real insight underneath someone else's implementation? What would we keep, reshape, or throw away?
  - **Fit & Friction:** How does this collide with existing workflows, conventions, or multi-stack realities?
  - **Competing Framings:** Are there two different ways to think about this? What changes under each framing?
  - **Ripple Effects:** If we adopted this, what else would have to change—and is that ripple worth it?
  - **Steelman & Stress-Test:** What is the strongest version of this idea, and what is the most likely way it fails or over-complicates things?

## 4. Targeted Web Research

- Fetch any URL the user provides right away (`web_fetch`). If a URL is a large reference page that would require multiple paginated `web_fetch` calls, delegate the targeted lookup to the `research` subagent so raw page chunks stay out of the main conversation context.
- Mid-conversation, when a question hinges on external prior art, competing patterns, or unfamiliar tooling, run targeted research (`web_fetch` for short known URLs or the `research` subagent for large docs and broader web/GitHub lookup) rather than guessing.
- Always separate **external source claims** (with links) from **our own takeaways**, and record useful references in the note's `Sources` section.

## 5. Living Note & Exit States

Each incubation lives in one editable markdown file:

- Path: `.workflow/incubations/<slug>.md` (kebab-case slug chosen from the topic).
- Format: [references/INCUBATION-FORMAT.md](references/INCUBATION-FORMAT.md).
- Unlike `brain-storm` sessions, **update this file in place** across sessions so it always reflects current thinking.
- Do not edit `.workflow/language.md` or `.workflow/sessions/`, and do not run `workflow-check` (it intentionally ignores `.workflow/incubations/`).

The user decides when to stop. Before wrapping up as `incubating` or `graduated`, if the emerging model has grown noticeably heavier than the original spark (multiple layers, new scripts, cross-repo mechanics), proactively run one brief **Steelman vs. Simplest 80/20 Version** check in chat rather than waiting for the user to ask `"challenge this"`.

Three exit states:

1. **`incubating` (pause):** Update the note with the latest mental model, visuals, tensions, sources, open threads, and a crisp **Pick Up Here** note so a later session can resume cleanly.
2. **`dropped`:** Record **Why Dropped** (and what would need to change to revisit it) so future sessions do not re-tread the same ground.
3. **`graduated`:** Write a crisp **Graduation Framing** (the distilled idea, what is kept vs. rejected, and key tensions to resolve) and give the user the exact handoff prompt:
   `/brain-storm from .workflow/incubations/<slug>.md`

Before writing on exit for `graduated`, `dropped`, or an ambiguous stop, briefly summarize in plain chat text what you are about to record and invite any corrections before saving (still without calling `ask_user`). If the user explicitly asks to pause and update the note now (e.g., *"park this and update the file"*), write and commit it directly without adding an extra confirmation round.

## 6. Commit

After writing or updating `.workflow/incubations/<slug>.md`, commit just that file so the working tree stays clean for `/pull-work`:

- Commit message: `docs(workflow): incubate <slug>` (following the `conventional-commit` skill's Message Rules with type `docs`).
- Stage only `.workflow/incubations/<slug>.md` by path; leave all other changes unstaged and unchanged.
- Never run `git add -A`, push, or `--no-verify`.
- Clean handoff: `git status --porcelain` lists only changes you did not make.
- On rejection: fix the cause if it lies in your own message or file and retry; otherwise stop and show the rejection output, leaving the file on disk.

Finish with a short wrap-up: current status, key takeaways, where the note was saved, and (if graduated) the `/brain-storm` handoff line.
