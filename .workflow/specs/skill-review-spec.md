# Behavior Spec - Skill Review

## Sources
- Sessions: `context-2026-11-26-1519.md` (builds on `context-2026-11-26-1201.md`)
- Background: `.workflow/incubations/session-review.md` (graduated)
- Language: `.workflow/language.md`
- Companion specs: [home-repo-workflow-spec.md](home-repo-workflow-spec.md) (Home layout, Update Script, workflow version), [workflow-check-spec.md](workflow-check-spec.md), [workflow-core-spec.md](workflow-core-spec.md)

## Target Outcome
- once v1 is done, the Developer runs `/skill-review` in any Home-layout Project Repo after a Phase. It reviews every unreviewed skill use and Handoff from Copilot CLI and Claude Code Conversations, reads only flagged slices with the model, and writes an STE Executive Summary, the Ledger, and the Review Record into the Home Repo. In `Personal.Workflow`, `/apply-observation` applies the confirmed Observations the Developer picks, one commit each, installs them with the Update Script, and can undo one. Later runs report each applied Observation as improved or unchanged. `/review-incubate` and hand-kept reviews are gone.

## Terms Used Here
- **Home layout**: the run's Harness has `WORKFLOW_HOME` set (started by the Launch Script); otherwise the run is in the copy layout.
- **Part**: one workflow part that the Update Script installs: a skill, agent, hook, tool, instruction file, or Language Add-on.
- **Skill use**: the span of one Conversation from one skill's start to the next skill's start or the Conversation's end. Agents, hooks, and tools used inside the span belong to it.
- **Position**: a record's line number in its Conversation Log.
- **Case**: one occurrence, in one skill use or one Handoff, of the behavior an Observation describes.
- **Chance to recur**: one use of an Observation's part (a skill use, or a Handoff of the same writing and using skills) in a Conversation that started after the Observation's change was installed.
- **Install record**: one pair of workflow version (7 lowercase hex, per home-repo-workflow R36) and the `Personal.Workflow` source commit (7 lowercase hex) it was installed from, with the install time.
- **Records**: the Executive Summary files, the Ledger, and the Review Record in the Home Repo.

## Requirements

### R52 - Review every unreviewed skill use in the Project Repo
- Rules:
  - `/skill-review` with no argument, run in the Home layout, reads the Conversation Logs of both Harnesses whose working folder is the Project Repo root or a folder inside it. Conversations in other folders are never read.
  - It reviews every skill use not yet reviewed, for every skill, and every Handoff that has both ends (R55). Conversations that used no part are skipped and are not counted.
  - The first run in a Project Repo has no time limit: it reviews the full local history.
  - The Conversation that runs `/skill-review` is reviewed up to the record before `/skill-review` started. The remainder is its new part for a later run (R54).
  - Every Executive Summary names each skill reviewed in the run, in its `Reviewed:` line.
  - When nothing is unreviewed, the run prints `skill-review: nothing to review` and writes and commits nothing.
- Failure: one line `skill-review failed: <category>: <detail>`; the Project Repo and the records are unchanged.
  - `home-layout-required` - see R67.
  - `records-unreadable` - the Review Record exists but does not match its layout; names the file.
  - `commit-failed` - the Home Repo commit was rejected; the written records stay on disk, are named, and a later run continues from them.
- Examples:
  - Given `brain-storm` and `behavior-spec` Conversations in Copilot CLI and a `pull-work` Conversation in Claude Code, all unreviewed, when `/skill-review` runs, then one Executive Summary has `Reviewed:` naming `brain-storm`, `behavior-spec`, and `pull-work`.
  - Given a Copilot CLI Conversation in `C:\Projects\Scheduler` that used `pull-work`, when `/skill-review` runs in `C:\Projects\Personal.Workflow`, then that Conversation is not read.
  - Given a Conversation that used `pull-work` and then started `/skill-review`, when the run ends, then the `pull-work` use is reviewed and the `/skill-review` use is not. (boundary)

### R53 - Review one named skill
- Rules:
  - `/skill-review <skill>` reviews only that skill's unreviewed uses and the pending Handoffs where that skill is the writing or using end.
  - Uses of other skills in the same Conversations stay unreviewed, and their Handoffs stay pending.
  - `<skill>` must name a Workflow Core skill or an installed Language Add-on skill.
- Failure: an unknown name -> `skill-review failed: unknown-skill: <name>`, followed by the list of known skill names; nothing is written.
- Examples:
  - Given one Conversation that used `pull-work` and `conventional-commit`, when `/skill-review pull-work` runs and then `/skill-review` runs, then the second run reviews `conventional-commit` and not `pull-work`.
  - Given `/skill-review pul-work`, when it runs, then it prints `skill-review failed: unknown-skill: pul-work` and the records are unchanged. (failure)

### R54 - Nothing is reviewed or counted twice
- Rules:
  - The Review Record keeps, per Conversation, the last reviewed Position for each skill. A run reviews only records after it.
  - A resumed Conversation counts only its records after the last reviewed Position. A skill use that crosses that Position is reviewed only for its new records.
  - A run writes the records only when it ends. An interrupted run writes nothing, and the next run reviews the same uses.
  - An already-reviewed Conversation Log is read again only as flagged Handoff evidence (R55); its own Observations get no new cases from that read.
- Examples:
  - Given two runs in a row with no new Conversations, when the second runs, then it prints `skill-review: nothing to review` and no case count changes.
  - Given a Conversation reviewed through Position 400 and resumed to Position 520, when `/skill-review` runs, then only Positions 401-520 are reviewed.
  - Given a run stopped by the Developer before it ends, when `/skill-review` runs again, then it reviews the same uses and the Home Repo has no commit from the stopped run. (failure)

### R55 - Handoff review
- Rules:
  - Handoffs are reviewed between these writing and using skills:

    | Writing skill | Artifact | Using skill |
    |---|---|---|
    | `incubate` | incubation with `Status: graduated` | `brain-storm` |
    | `brain-storm` | `Status: final` Session | `behavior-spec` |
    | `behavior-spec` | Behavior Spec | `work-planner` |
    | `work-planner` | Plan and Phase files | `pull-work` |

  - The writing end is the skill use that wrote or committed the artifact. The using end is the first later use of the using skill, in either Harness, that read that artifact. An artifact written without a skill use has no Handoff.
  - A Handoff is pending while it has only its writing end. It has no time limit. The first run holding both ends reviews it, and it becomes reviewed.
  - Effectiveness Observations carry a Miss Label: capture miss and decomposition miss set the writing side; translation miss sets the using side; requirements miss follows R58.
  - Efficiency Observations carry a kind: `restated or re-verified` (the using skill repeated or re-checked what the artifact already settled) sets the using side; `section never used` (an artifact section no later step read or used) sets the writing side.
  - When the evidence cannot set a side, the Observation names both skills and stays watching.
  - The Executive Summary states the number of pending Handoffs. The Ledger lists each pending Handoff with its artifact and age in days.
- Examples:
  - Given a Behavior Spec that drops R7 from its Session, when the run reviews that Handoff, then it records a translation miss against `behavior-spec`.
  - Given a run after `brain-storm` alone wrote a final Session, when the run ends, then the Executive Summary shows `pending Handoffs: 1` and the Ledger lists that Session.
  - Given `/skill-review brain-storm` already reviewed the writing end, when a later run finds the `behavior-spec` use that read the Session, then the Handoff is reviewed once and becomes reviewed.

### R56 - The known agent-model-pin miss is found unaided
- Rules:
  - A run over the `home-repo-workflow` history, with no hint, records one Observation: decomposition miss, writing side, part `brain-storm` or `incubate`.
  - Its STE description states that the outcome "switch Harnesses seamlessly" in `context-2026-11-25-1955.md` was narrowed to R43 and was reopened as R48-R51 in `context-2026-11-26-1201.md`.
- Examples:
  - Given the local Conversations and Workflow Folder of `home-repo-workflow`, when `/skill-review` runs, then the Executive Summary lists that Observation with `decomposition miss` and its side.

### R57 - Health judgement and the Fix Filter
- Rules:
  - Each skill use is judged on four kinds: `rule adherence`, `Developer contribution`, `growth without payoff`, `token cost`. Each health Observation carries one kind.
  - Each Observation has one outcome: `part change`, `Developer note`, or `no action` (cause recorded).
  - Each `part change` Observation states the Fix Filter answer before it is confirmed: `Fix type: check or script`, `clarified rule`, `removed rule`, or `new prose`, and one STE sentence that says why the cheaper types do not apply.
- Examples:
  - Given a confirmed `part change` Observation, when the Ledger is written, then its entry shows a `Fix type:` line and a reason sentence.
  - Given a skill use where the Developer only picked default options for 12 questions, when it is judged, then the run can record a `Developer contribution` Observation with outcome `Developer note`.

### R58 - Observation lifecycle
- Rules:
  - States: watching -> confirmed -> changed -> improved | unchanged; watching | confirmed -> dismissed.
  - New Observations start watching with 1 case. They become confirmed at 2 cases. Cases add up across Conversations and runs, so the run order does not change the result.
  - dismissed applies only when the cause is a model habit or a Harness limit. The cause and the model or Harness are recorded. Later cases add to the count but do not change the state.
  - A requirements miss is never dismissed. It stays watching under its area. At 2 cases in the same area, a confirmed `question gap` Observation is recorded against the skill that asked the questions (`brain-storm` or `incubate`).
  - changed -> improved after 2 chances to recur with no case. changed -> unchanged at the first case in a chance to recur. In that run the Executive Summary reports it as unchanged, and its state then returns to confirmed.
  - A case in a Conversation that started before the change was installed adds to the count but is not a chance to recur and does not make it unchanged.
  - A case that matches an improved Observation starts a new watching Observation that names the improved one.
- Examples:
  - Given one run with 3 cases of the same Observation, and a separate history with 1 case in each of 3 runs, when both finish, then both show the Observation confirmed with 3 cases.
  - Given O03 changed and installed, when the next 2 `pull-work` uses after the install show no case, then O03 is improved.
  - Given O03 changed and installed, when the first `pull-work` use after the install shows a case, then the Executive Summary lists O03 under `## Same` and the Ledger shows O03 confirmed.
  - Given a repeated recap seen only on one model, when the run judges it a model habit, then the Observation is dismissed with that model named. (failure)

### R59 - Installed version and change tracking
- Rules:
  - The Review Record holds the install records and, for each changed Observation, its change commit.
  - A change is installed when an install record's source commit contains that change commit. The install time of the earliest such record starts its chances to recur.
  - The Ledger shows a changed Observation as `changed, not yet installed` until then, and as `changed, installed <version>` after.
  - Each `/skill-review` run reads the Home Repo's current workflow version. When it matches no install record, the run prints `notice: unrecorded-install: <version>` and no installation state changes.
- Examples:
  - Given O05 committed in `Personal.Workflow` but the Update Script not run, when the Ledger is written, then O05 shows `changed, not yet installed`.
  - Given O05 installed at 14:00, when a case appears in a Conversation that started at 13:30, then O05 stays changed and its case count grows by 1. (boundary)

### R60 - Executive Summary and Ledger in STE
- Rules:
  - Each run that reviewed something writes one new Executive Summary and rewrites the Ledger from the Review Record. Hand edits to the Ledger are replaced; git history keeps them.
  - Executive Summary layout, in this order:
    - `# Skill Review - <Project Repo folder name> - <YYYY-MM-DD HH:mm>`
    - `Workflow version: <version> (source <commit>)`, or `(source unknown)` when no install record matches
    - `Reviewed: <n> Conversations, <n> skill uses (<skill names>), <n> Handoffs; pending Handoffs: <n>`
    - `Model tokens: <total> read (Depth 1: <n>, Depth 2: <n>)` (R62)
    - `## Changed` - Observations that are new or changed state in this run, except improved and unchanged
    - `## Improved` - Observations that became improved
    - `## Same` - Observations reported unchanged
    - `## Next` - every confirmed `part change` Observation as `/apply-observation` offers it (R68), then Developer notes
    - `## Notices` - only when there is a notice (R59, R65)
  - A section with nothing in it holds `None.`
  - Each Observation entry starts with its ID (`O01`, `O02`, ...; IDs never repeat) and the part, then at most 3 STE sentences.
  - The Ledger lists every Observation grouped by state in this order: confirmed, changed, watching, improved, dismissed. Each entry shows ID, part, state, side, Miss Label or kind, cases, chances to recur, outcome, the `Fix type:` line when confirmed, the change commit when changed, and an STE description. Pending Handoffs follow the Observations.
  - The STE check measures: each sentence in `## Next` has at most 20 words; every other sentence has at most 25 words; each paragraph has at most 6 sentences.
  - A run rewrites failing text until the STE check passes, at most 3 times. When it still fails, it writes and commits the records, puts `STE check failed: <n> sentences` under `## Notices`, and records a watching Observation against `skill-review`.
- Examples:
  - Given a run that confirmed O04 and found nothing improved, when the Executive Summary is written, then `## Improved` and `## Same` hold `None.` and `## Next` holds O04.
  - Given a draft sentence of 27 words in `## Changed`, when the STE check runs, then it fails and the run rewrites that sentence. (failure)

### R61 - Review Record
- Rules:
  - One Review Record in the Home Repo, in a fixed layout for agents (not STE), holds reviewed Positions, Handoffs and their states, Observations with cases and chances, install records, and change commits.
  - A run needs only the Review Record, not earlier Executive Summaries or the Ledger, to continue all counts and states.
- Failure: see `records-unreadable` in R52.
- Examples:
  - Given the Ledger and every Executive Summary deleted, when `/skill-review` runs, then case counts continue from the Review Record and the Ledger is written again in full.

### R62 - Depth 0 and token cost
- Rules:
  - Depth 0 extracts signals and flags from Conversation Logs, Workflow Folder artifacts, and git history with no model tokens.
  - The model reads only the compact record (Depth 1) and flagged slices (Depth 2). A deeper Depth runs only where the Depth above flagged it.
  - A flagged slice is the flagged record with the record before and after it, at most 8,000 characters. The model never reads a Conversation Log file directly.
  - `Model tokens` in the Executive Summary is the characters of the compact record and slices given to the model, divided by 4 and rounded up, per Depth.
- Examples:
  - Given a 879 KB Conversation Log with one flagged turn, when the run ends, then the run's own Conversation Log shows no read of that Log file and one slice read of at most 8,000 characters.
  - Given any run that reviewed something, when the Executive Summary is written, then it has a `Model tokens:` line.

### R63 - Local, read-only for the Project Repo
- Rules:
  - `/skill-review` reads only local Conversation Logs, the Project Repo's Workflow Folder, and its git history.
  - Its tools make no network calls; only the Harness's own model traffic uses the network.
  - It writes only the records in the Home Repo, and it commits only those paths there with `docs(skill-review): review <Project Repo folder name>`.
  - It never changes the Project Repo, any Part, or any other Home Repo file.
- Examples:
  - Given network access off for everything except the Harness's model traffic, when `/skill-review` runs, then it completes.
  - Given `git status --porcelain` in the Project Repo before a run, when the run ends, then the output is identical, and the Home Repo's new commit holds only record paths.

### R64 - No copied Conversation Log text
- Rules:
  - The records hold Conversation IDs, Positions, Harness names, skill and part names, file paths, commit IDs, and STE descriptions only.
  - No record holds 8 or more consecutive words from a Conversation Log message, or any string that appears only in a Conversation Log.
- Examples:
  - Given a fixture Conversation Log that holds `sk-test-9f8e7d6c5b4a`, when `/skill-review` runs, then that string is in no record and no Home Repo commit. (failure)

### R65 - Unrecognized or missing Conversation Logs are named
- Rules:
  - Each Conversation Log record the Depth 0 script does not recognize prints `notice: unknown-record: <Harness> <Conversation ID> line <n>: type "<type>"` and is listed under `## Notices`. The run continues.
  - When a Harness has no Conversation Log for the Project Repo, the run prints `notice: no-conversation-log: <Harness>` and continues with the other Harness.
- Examples:
  - Given a fixture Claude Code Conversation Log with a record of type `thinking_v9` at line 12, when `/skill-review` runs, then it prints `notice: unknown-record: Claude Code <id> line 12: type "thinking_v9"`.
  - Given no Claude Code Conversation Log for the Project Repo, when `/skill-review` runs, then it prints `notice: no-conversation-log: Claude Code` and reviews the Copilot CLI Conversations.

### R66 - pull-work suggests a review
- Rules:
  - In the Home layout, `pull-work`'s Phase-completion brief ends with the line `Next: run /skill-review to review this Phase's Conversations.`
  - In the copy layout, the line is not printed.
  - Nothing starts a review automatically.
- Examples:
  - Given a Home-layout Project Repo, when `pull-work` completes P02, then the brief's last line is the suggestion and no review runs.

### R67 - `/review-incubate` removed; Home layout only
- Rules:
  - `.github/prompts/review-incubate.prompt.md` does not exist, and no Workflow Core file or `README.md` names `/review-incubate`.
  - `incubate` uses are reviewed like any other skill use.
  - In the copy layout, `/skill-review` stops.
- Failure: copy layout -> `skill-review failed: home-layout-required: start the Harness with the Launch Script`; nothing is written.
- Examples:
  - Given an unreviewed `incubate` Conversation, when `/skill-review` runs, then `Reviewed:` names `incubate`.
  - Given a Harness started without the Launch Script, when `/skill-review` runs, then it prints the `home-layout-required` line and no file changes anywhere. (failure)

### R68 - `/apply-observation` offers confirmed part changes
- Rules:
  - `/apply-observation` in `Personal.Workflow`, in the Home layout, reads the Home Repo's Review Record and lists every confirmed `part change` Observation, worded as in `## Next`.
  - Watching, changed, improved, and dismissed Observations, and Developer notes, are never offered.
  - The Developer picks any subset; only picks are applied.
  - When nothing is offered, it prints `apply-observation: nothing to apply` and writes nothing.
- Failure: `apply-observation failed: <category>: <detail>`; nothing is written.
  - `home-layout-required` - no Home Repo is attached.
  - `dirty-tree` - `Personal.Workflow` has uncommitted changes; lists them.
  - `records-unreadable` - as in R52.
- Examples:
  - Given O03 confirmed and O04 watching, when `/apply-observation` runs, then only O03 is offered.

### R69 - One Checkpoint before any change
- Rules:
  - Before any file changes, one Checkpoint shows, per pick and in STE: the part, a summary of the change, and the Observation it should fix. It follows the Checkpoint rules in `.github/user-interaction.md`.
  - A pick the Developer rejects is not applied and stays confirmed.
- Examples:
  - Given picks O03 and O07, when the Checkpoint shows, then no file in `Personal.Workflow` has changed.
  - Given the Developer rejects O07 at the Checkpoint, when the run ends, then only O03 is applied and O07 is confirmed. (failure)

### R70 - Apply, check, and commit each pick
- Rules:
  - For each approved pick, in ID order: write the edit, run `workflow-check` and every acceptance and unit suite in `Personal.Workflow`, then commit only the edited paths.
  - The commit follows the `conventional-commit` skill with the part name as scope and a subject ending in `(O<n>)`.
  - After the commit, the Observation is changed and records that commit.
  - The Home Repo records are rewritten and committed once at the end with `docs(skill-review): apply O<n>[, O<n>...]`.
- Failure: a `workflow-check` error or a failing suite -> the edit is restored, nothing is committed for that pick, it stays confirmed, and the run prints `check-failed: O<n>: <reason>`. The other picks continue.
- Examples:
  - Given three approved picks, when all pass, then `Personal.Workflow` has three new commits whose subjects end in `(O03)`, `(O05)`, `(O07)`.
  - Given O05's edit makes a suite fail, when the run ends, then O05 is confirmed, its files are unchanged from before the run, and O03 and O07 are committed. (failure)

### R71 - Install once after the last commit
- Rules:
  - After the last pick, `/apply-observation` runs the Update Script against the Home Repo once and shows its full output.
  - On success it adds an install record of the printed new workflow version and the `Personal.Workflow` `HEAD` commit.
  - When no pick was committed, the Update Script does not run.
- Failure: the Update Script fails -> its output is shown, the commits stay, the Observations stay changed and show `changed, not yet installed`, and no install record is added.
- Examples:
  - Given O03 committed at `HEAD` `a1b2c3d` and the Update Script printing `Workflow version: 3f9a2c1 -> 7e8d9f0`, when the run ends, then the newest install record is `7e8d9f0` from `a1b2c3d`.

### R72 - Undo one applied Observation
- Rules:
  - `/apply-observation undo O<n>` applies to an Observation whose latest change commit is not yet reverted, in any state.
  - It first states in STE the part, the commit it will revert, and the Observation, then waits for the Developer's approval.
  - On approval it reverts that commit with a commit whose subject is `revert(<part>): undo O<n>`, sets the Observation confirmed, runs the Update Script once, adds the install record, and commits the Home Repo records with `docs(skill-review): undo O<n>`.
  - Other Observations and their commits are untouched.
- Failure: `apply-observation failed: <category>: <detail>`; nothing changes in either repo.
  - `unknown-observation` - no such ID.
  - `not-applied` - the Observation has no unreverted change commit.
  - `revert-conflict` - a later commit changed the same lines; names the files.
  - `dirty-tree` - as in R68.
  - The Developer declines -> nothing changes.
- Examples:
  - Given O03 and O05 applied, when `undo O03` is approved, then O03 is confirmed, O05 is unchanged, and `Personal.Workflow` has one new `revert(...)` commit.
  - Given a later commit edited the same lines as O03's commit, when `undo O03` is approved, then it prints `apply-observation failed: revert-conflict: <files>` and both repos are unchanged. (failure)

### R73 - `/apply-observation` only in `Personal.Workflow`
- Rules:
  - `/apply-observation` runs only when the repository root is the `Personal.Workflow` source (it holds the Update Script and `language-addons/`).
- Failure: elsewhere -> `apply-observation failed: not-personal-workflow: run it in Personal.Workflow`; nothing is written.
- Examples:
  - Given a Project Repo `C:\Projects\Scheduler`, when `/apply-observation` runs there, then it prints the `not-personal-workflow` line and no file changes. (failure)

## Quality Thresholds
- Model reading -> 0 model tokens at Depth 0; each flagged slice at most 8,000 characters; no direct model read of a Conversation Log file, in 100% of runs.
- Readability -> the Executive Summary has at most 300 words outside its Observation entries, and each Observation entry has at most 3 sentences.
- STE -> sentences at most 20 words in `## Next`, at most 25 words elsewhere, paragraphs at most 6 sentences, in the Executive Summary, the Ledger, and the R69 and R72 statements.
- Privacy -> 0 runs of 8 or more consecutive words from a Conversation Log message in any record.
- Offline -> `/skill-review` completes with all network access off except the Harness's model traffic.

## External Constraints
- Copilot CLI Conversation Log (`~\.copilot\session-state\<id>\events.jsonl`, typed records such as `user.message`, `skill.invoked`, `subagent.*`, `session.usage_record`) - GitHub.
- Claude Code Conversation Log (`~\.claude\projects\<encoded folder>\*.jsonl`), undocumented and changing by version - Anthropic.
- ASD-STE100 Simplified Technical English: sentence and paragraph limits; the approved word list is copyrighted and is not shipped or checked - ASD.
- Personal machine only; no evidence from the work machine and no GitHub-hosted evidence - the Developer.
- The Home Repo has no remote; records live in its git history - the Developer.
- Reuse: `workflow-check` (R70), the Update Script and its workflow version (home-repo-workflow R36), and the Home-layout signal `WORKFLOW_HOME` (ADR 0002) - existing Workflow Core.

## Product Interfaces
- `/skill-review [<skill>]`: output lines, notices, and failure categories in R52-R54, R59, R65, R67.
- `/apply-observation [undo O<n>]`: offer list, Checkpoint, output lines, failure categories, and commit subjects in R68-R73.
- Executive Summary files: `<Home Repo>\skill-review\summaries\<YYYY-MM-DD-HHmm>-<Project Repo folder name>.md`, layout in R60.
- Ledger: `<Home Repo>\skill-review\ledger.md`, layout in R60.
- Review Record: one file under `<Home Repo>\skill-review\`; its layout is left to planning.

## Left To Planning
- Review Record layout and file name.
- Depth 0 signal set, flag rules, compact record layout, and how a Conversation's working folder is found per Harness.
- How cases are matched to an existing Observation, and how a Handoff's using end is found to have read its artifact.
- How the STE check is built and run, and how slices are served to the model.
- How `/apply-observation` finds which acceptance and unit suites to run.

## Assumptions
- R58: confirm at 2 cases, improved after 2 clean chances to recur - the hand-kept `incubate` signal table (`docs/research/incubate-session-review.md` row 7) held a change until "another session" showed the same case, and judged improvement from the next 1-2 sessions.
- R60: the STE check fails a run's text only by rewriting, never by losing the run; after 3 failed rewrites the records are still committed with a notice and an Observation against `skill-review` - unlike R70, refusing would discard a whole run's reviewed state, and the session names an unreadable summary as an Observation against `skill-review`.
- R62/R64: slice cap 8,000 characters - the hand-kept review found single recap messages of about 7,000 characters, so one slice must hold one such message with its neighbours.
- R60: Executive Summary at most 300 words outside Observation entries - the hand-kept review's own Executive Summary is 201 words and readable, while its per-session sections (139-732 words) grew unreadable.
- R52: the running Conversation is reviewed up to `/skill-review`'s start - the R66 suggestion invites a run in the same Conversation as `pull-work`, so that `pull-work` use must not wait a whole run.
- R52/R54: a run with nothing to review writes and commits nothing - the R54 Accept requires no change, and an empty summary adds noise.
- R55: the four Handoff pairs follow the workflow's skill order; only graduated incubations and final Sessions are handed off; pending Handoffs never expire - a draft is not handed off, and an expiry number has nothing to calibrate against.
- R59: an install made outside `/apply-observation` only prints `unrecorded-install` - the Update Script's version record holds no source commit, so the change commit cannot be matched.
- R60: one Executive Summary file per run, named by time and Project Repo; the Ledger is rewritten each run - runs in two Project Repos must not overwrite each other, and the Ledger is a view of the Review Record.
- R62: `Model tokens` is characters ÷ 4 - Harness usage for the running Conversation is not available in the same way in both Harnesses during the run.
- R63: "no network" excludes the Harness's model traffic - the model cannot run offline, so the literal Accept could never pass.
- R66: the suggestion prints only in the Home layout - in the copy layout `/skill-review` stops (R67).
- R68/R72: `/apply-observation` stops on a dirty `Personal.Workflow` tree; on a failed check it restores the edit - a clean start means only the skill's own edit is discarded, and later picks need a clean tree to commit only their paths.
- R72: undo reverts the latest unreverted change commit in any state - an unchanged Observation returns to confirmed with its commit still in place.
- R70/R72: commit subjects end in `(O<n>)` or read `revert(<part>): undo O<n>` - `git log --grep O<n>` then finds every commit for an Observation.
