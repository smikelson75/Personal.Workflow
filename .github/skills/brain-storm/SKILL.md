---
name: brain-storm
description: "Turn an idea of any size into buildable requirements, grounded in the existing solution when one exists."
argument-hint: "Describe the idea you want to explore"
user-invocable: true
---

# Brain Storm

Question rules: follow `.github/user-interaction.md`.

Fill in the missing pieces of the user's idea until it is a workable set of requirements that planning/building can start from. Never design or build here.

## 1. Ground First

Before asking anything:

1. Read `.workflow/language.md` and the newest `.workflow/sessions/context-*.md` (if any). Note settled truth, parked items, and terms.
2. If the workspace contains an existing solution (source code, manifests, docs), launch one `explore` subagent before discussion. Ask it to return a summary (<=300 words) of:
   - purpose and users the code implies
   - languages, frameworks, and project structure
   - domain terms as named in code (entities, actions, states)
   - current state: working, partial, stubbed/TODO, broken
   - areas the idea is likely to touch (use the user's idea as the focus)
3. Open with a grounding brief: what exists, its current state, its vocabulary, and how the idea appears to fit. Explain how this shapes the conversation, and ask the user to correct or add to anything before starting questions.

Do not ask the user what the code or prior sessions already answer; confirm it instead. Use the solution's existing terms unless the user decides to rename them.

## 2. Frame

- Relationship: `new` (greenfield or separate product), `extend` (adds to the existing solution), or `amend` (changes a prior session's decisions). Ask if unclear; explicit user choice wins.
- Size: `small` (one change/feature in an existing workflow), `medium` (new workflow or feature set), `large` (new product or multiple workflows). Tell the user the size and expected depth; re-size if answers reveal more.

## 3. Work the Decision Tree

Build a decision tree from the idea. Root branches (always cover 1-4; cover 5-8 when relevant to the size and idea):

1. Problem, user, desired outcome.
2. User context and constraints.
3. Trigger, workflow, alternate paths, failure/fallback paths, speed/friction goals.
4. Minimum v1, must-haves, non-goals, product-changing choices.
5. Inputs, outputs, rules, edge cases, integrations, permissions/trust.
6. Fixed constraints and success measure.
7. Visibility, mutation, approval, triggers, security consequences and assumptions.
8. Actors, objects, steps, states, outcomes, actions, canonical terms, banned synonyms.

Every answer may open child branches (e.g. an alternate path, an edge case, a permission rule). Add them to the tree. Walk the current branch to its leaves before moving to the next. A node is `settled`, `parked` (deferred, with reason), `rejected`, `deferred-to-spec` (behavioral detail such as exact limits, rules, or error outcomes), or `open`. Grounded facts confirmed by the user count as settled. For `small` ideas, open only nodes the change actually touches.

### Conversation, Not Interrogation

This is a working conversation. The user must never feel rushed or unsure what is being asked. Save tokens by not re-asking settled things, never by shortening what the user reads.

- One question at a time. Never batch questions to go faster.
- Write in plain, full sentences. Define any term, acronym, or concept the user may not share the first time it appears.
- Ask about the problem before solutions.
- If the user answers with a question, says "not sure", or pushes back, stop and discuss: explain, give examples, share what you know from the code or similar products, and work it through together. Resume the tree only when the user is ready.
- Short, hedged, or one-word answers are not settled. Restate what you understood in the user's own terms and confirm before marking a node settled.
- Engage with the user's reasoning: build on it, point out what it implies, and say when you see it differently and why.
- Probe with examples, failures, fallbacks, and tradeoffs. Normalize domain terms toward stable canonical names (singular noun by default; split object vs behavior when rules differ), and explain why a name is proposed.
- The user may always say "why?", "explain", "example", "park", or "back to Q#". Remind them of this at the start of the session.

### Question Format (every question)

Number each question (`Q1`, `Q2`, ...) so any answer can be revisited by number.

```md
**Q#. <short title>**  · Branch: <root branch / node>

**Where we are:** what is settled so far that leads here (1-3 lines).
**Why this matters:** what this decision shapes, and what changes depending on the answer.
**Question:** one clear question, in plain language.
**Options:** (when the space is known) 2-3 concrete options, each with a one-line example and its tradeoff. Mark a recommendation and say why. Always allow "something else".
```

Skip **Options** only for open-ended discovery (e.g. "describe the problem in your words"); give an example answer instead.

### Feedback (every answer)

Reply in this shape before the next question:

- **What I heard:** the answer restated in your own words, with its node. Ask to confirm if it was brief or uncertain.
- **What it means:** consequences for scope, workflow, or later decisions; new branches opened; risks or gaps. Push back here if the answer is weak, contradictory, over-scoped, or risky (say why and suggest an alternative).
- **Next:** where the conversation goes and why, then the next question in the format above.

After each root branch completes, when the user asks, or every ~5 questions, show the branch map: each node with status and the `Q#` that settled it, plus remaining open count. Ask whether anything feels unresolved before moving on.

### Conflicts

If an answer conflicts with a settled answer, grounded code fact, prior session, or `.workflow/language.md`: stop, restate old vs new with sources, confirm which stands, then re-check every settled node and written term that depended on the old answer.

## 4. Requirements Gate

Go deep on decisions affecting product, v1, workflow, security, or planning order. Mark detailed behavioral rules (exact limits, error outcomes, examples) `deferred-to-spec` for `behavior-spec`. Do not settle or record implementation detail (architecture, schema, libraries); tell the user it belongs to planning or coding and move on.

Number requirements continuing from the highest ID in the session chain; never reuse or renumber. When amending, restate the changed requirement under its existing ID or retire it with its replacement.

Exit only when:

- problem, user, workflow, scope, constraints, success, and core vocabulary are each answerable in 1-2 sentences;
- every v1 requirement is numbered and has an observable acceptance signal;
- no `open` nodes remain that block product decisions (parked items have a reason).

Never steer toward exit to save time; the user decides when the idea is ready. Then present a readiness check: requirements list, parked/rejected items, and new or changed terms, each with enough explanation to review without scrolling back. Ask whether anything feels missing or wrong, and wait for confirmation before writing.

## 5. Output

All artifacts live in `.workflow/`:

- **Session file** `.workflow/sessions/context-YYYY-MM-DD-HHmm.md` (local time at session start). Every session creates a new file; never edit a prior session file. It is self-contained for this idea; if it builds on or supersedes a prior session, link it. Format: [references/CONTEXT-FORMAT.md](references/CONTEXT-FORMAT.md).
- **Glossary** `.workflow/language.md`: one durable glossary across sessions, holding current truth, not a change log. Add, update, or retire terms settled this session. Format: [references/LANGUAGE-FORMAT.md](references/LANGUAGE-FORMAT.md).

If the user ends early, still write the session file with `Status: draft` and the open nodes so the next session can resume from it.

### Check

After writing the Session and Glossary, run `node .github/tools/workflow-check/bin/workflow-check.mjs .workflow/sessions/<new session file>` from the repo root.

- Fix every `error` Finding and rerun until the summary reads `0 errors`.
- Weigh each `warning`: fix it, or leave it deliberately and name it in the brief.
- Never edit a prior Session to clear a Finding. When an `error` Finding is anchored at a prior Session, stop and report it to the user instead of finishing.

### Commit

After the Check, commit what you wrote.

- Commit: the Session file and, when changed, `.workflow/language.md`, in one commit `docs(workflow): session <topic>`, without asking. A `draft` Session from an early exit is committed the same way.
- On a prior-Session error: still commit your own Session and Glossary, then report the error.
- Stage: only the files you wrote, by path; other changes stay unstaged and unchanged.
- Never: `git add -A`, push, or `--no-verify`.
- Clean handoff: when you finish, `git status --porcelain` lists only changes you did not make.
- On rejection: fix the cause if it lies in your own message or files and retry; otherwise stop and show the rejection output, leaving the files on disk.
- Messages: follow the `conventional-commit` skill's Message Rules with type `docs`.

Finish with a brief: finalized requirements, branch map summary, new/changed terms, and architecture-shaping security concerns. Offer the next step (plan, spec, or implementation).
