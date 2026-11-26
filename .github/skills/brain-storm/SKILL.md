---
name: brain-storm
description: "Turn an idea of any size into buildable requirements, grounded in the existing solution when one exists."
argument-hint: "Describe the idea you want to explore"
user-invocable: true
---

# Brain Storm

Question rules: follow `.github/user-interaction.md`.
Core paths: when the environment variable WORKFLOW_HOME is set (Home layout), read each Workflow Core path written here as follows: .github/skills/ is $WORKFLOW_HOME/.claude/skills/, .github/agents/ is $WORKFLOW_HOME/.claude/agents/, .github/tools/ is $WORKFLOW_HOME/.workflow-core/tools/, .github/hooks/ is $WORKFLOW_HOME/.workflow-core/hooks/, .github/user-interaction.md is $WORKFLOW_HOME/.workflow-core/user-interaction.md; run every command from the Project Repo root and never from $WORKFLOW_HOME. Without WORKFLOW_HOME (copy layout) read the paths as written.

Fill in the missing pieces of the user's idea until it is a workable set of requirements that planning/building can start from. Never design or build here.

## 1. Ground First

Before asking anything:

1. Read `.workflow/language.md` and the newest `.workflow/sessions/context-*.md` (if any). Note settled truth, parked items, and terms. If the user explicitly references a note in `.workflow/incubations/<slug>.md`, read it as background context (never auto-scan `.workflow/incubations/`—unrelated or abandoned incubations must stay out of scope).
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
- Hedged answers ("I guess", "probably", "not sure") are not settled; discuss them. How short answers settle depends on the question: see Anchor Questions and Keeping the User Engaged.
- Engage with the user's reasoning: build on it, point out what it implies, and say when you see it differently and why.
- Probe with examples, failures, fallbacks, and tradeoffs. Normalize domain terms toward stable canonical names (singular noun by default; split object vs behavior when rules differ), and explain why a name is proposed.
- The user may always say "why?", "explain", "example", "park", or "back to Q#". Remind them of this at the start of the session.

### Anchor Questions

Two answers steer everything after them: **Q1, the purpose** (who it is for, what problem it solves, what success looks like) and **the v1 scope** (what must be in the first version and what stays out). Every later recommendation is derived from them. The same idea, brain-stormed twice with different purpose answers, produced two different products: errors on stderr in one and stdout in the other, a prompt hidden when input is piped in one and always shown in the other. If the anchors are in the model's words rather than the user's, the model is designing the product.

- **Label them.** Tag each anchor question `· Anchor` in its heading. Before asking, tell the user that this answer steers the rest of the session, and why.
- **Q1 is in the user's own words.** Give no options, no recommendation, and no example answer the user could copy. If the user is stuck, offer 2-3 contrasting angles to think about (for example: "Is this for you or for other people? Is it a daily tool, a learning exercise, or a demo? What would make you call it a success?"). Never offer a ready-made answer.
- **For v1 scope, ask first, recommend second.** Ask what must be in v1 before offering your cut, then show options and your recommendation against what the user said.
- **A deferral does not settle an anchor.** A letter, "you pick", "sounds good", or text copied from your message does not settle it. Restate what the answer would commit to, name one thing it rules out, and ask the user to say it in their own words. If the user still defers, settle it, and record it under **Decided by default** (see Requirements Gate).
- **Show the link.** After an anchor settles, name the 2-3 later decisions it will steer.

### Keeping the User Engaged

The user may lean on your recommendations, especially when tired or rushed. Make deciding easy without making accepting automatic. Brain-storm is the start of the workflow: a decision nobody really made here becomes a spec, a plan, and code.

- **Plain chat only.** Never call `ask_user` in `/brain-storm`. Ask every question in plain chat, overriding any default tool preference for structured forms. A form with a pre-selected default makes accepting one click; typing an answer keeps the user in the decision.
- **End your turn after the question.** Never write, assume, or continue past the user's answer, and never ask the next question in the same message.
- **Option picks.** Outside the anchors, picking a listed option settles the node once you restate it in **What I heard**.
- **Notice drift.** Count product-shaping decisions (branch 1, branch 4, or anything that changes what v1 does) settled by accepting your recommendation with no reason from the user. After three in a row, pause once before the next question: list them, name the riskiest assumption among them and what breaks if it is wrong, and ask the user to confirm or challenge it in their own words. Pause again only after another three.
- **Invite a reason, don't demand one.** On a product-shaping question, end with a short prompt such as "a sentence on why helps me push back usefully". Never block on it.

### Question Format (every question)

Number each question (`Q1`, `Q2`, ...) so any answer can be revisited by number.

```md
**Q#. <short title>**  · Branch: <root branch / node>  [· Anchor]

**Where we are:** what is settled so far that leads here (1-3 lines).
**Why this matters:** what this decision shapes, and what changes depending on the answer.
**Question:** one clear question, in plain language.
**Options:** (when the space is known) 2-3 concrete options, each with a one-line example and its tradeoff. Mark a recommendation and say why. Always allow "something else".
```

Skip **Options** for Q1 and other open-ended discovery (e.g. "describe the problem in your words"). Offer 2-3 contrasting angles to think about instead, never a single example answer the user could copy.

### Feedback (every answer)

Reply in this shape before the next question:

- **What I heard:** the answer restated in your own words, with its node. Ask to confirm if it was hedged, or if it was an anchor answer not in the user's own words.
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

Never steer toward exit to save time; the user decides when the idea is ready. Then present a readiness check: requirements list, parked/rejected items, new or changed terms, and **Decided by default**: every product-shaping node settled by accepting your recommendation with no reason from the user, plus any anchor the user deferred. Give each item enough explanation to review without scrolling back. Ask the user to read **Decided by default** as an audit: these are the decisions they did not make themselves. Ask whether anything feels missing or wrong, and wait for confirmation before writing.

## 5. Output

All artifacts live in `.workflow/`:

- **Session file** `.workflow/sessions/context-YYYY-MM-DD-HHmm.md` (local time at session start). Every session creates a new file; never edit a prior session file. It is self-contained for this idea; if it builds on or supersedes a prior session, link it. Format: [references/CONTEXT-FORMAT.md](references/CONTEXT-FORMAT.md).
- **Glossary** `.workflow/language.md`: one durable glossary across sessions, holding current truth, not a change log. Add, update, or retire terms settled this session. Format: [references/LANGUAGE-FORMAT.md](references/LANGUAGE-FORMAT.md).

If the user ends early, still write the session file with `Status: draft` and the open nodes so the next session can resume from it.

### Check

After writing the Session and Glossary, run `node .github/tools/workflow-check/bin/workflow-check.mjs` from the repo root, so the whole Workflow Folder is checked.

- Fix every `error` Finding anchored at the new Session or the Glossary, and rerun until none remain there. If fixing a Finding changes an already-approved Glossary term or `Avoid` list, confirm the adjustment with the Developer before committing rather than editing approved vocabulary silently.
- Weigh each `warning` anchored at the new Session or the Glossary: fix it, or leave it deliberately and name it in the brief. Ignore warnings anchored at prior Sessions.
- Never edit a prior Session to clear a Finding. When an `error` Finding is anchored at a prior Session, once your own errors are cleared, show each such Finding line to the Developer instead of finishing.

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
