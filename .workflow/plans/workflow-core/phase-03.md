# P03 - Reconcile, defects, pair coverage

- **Outcome:** `/pull-work` detects a changed spec and routes it to planning (R20), takes `bug:` reports (R21), tracks rule-by-capability pair coverage so `done` needs every pair (R16), and the Clean-handoff and Checkpoint-cost thresholds are written into the skills.
- **Covers:** R20, R21, R16, Q-clean-handoff, Q-checkpoint-cost
- **Invariants:**
  - `C` = `.github/tools/workflow-core`. ES modules (`.mjs`), no dependencies, Node built-ins only.
  - Scripts print problems to stderr, one per line, and exit 0 (ok), 1 (problem found), or 2 (usage error, usage line on stderr). They run from the repository root.
  - Tests read skill, agent, and format text through markers only: paths, commands, line starts such as `- **Label:**`, `- Label:`, `### Heading`, and a token a card names. Never a whole sentence.
  - Edits to existing markdown files only add lines or replace the one line a card names; every other line stays unchanged.
  - Scripts that tests run live in `.github/skills/<skill>/scripts/`.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R20-01]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Not expressible (presented at Phase Review):**
  - R20: `/pull-work` loads work-planner and maps changed rules to cards - agent behavior; the comparison script and the instruction lines are tested
  - R21: classification into fix, behavior-spec redirect, or brain-storm redirect - agent judgment; the instruction lines are tested
  - R21: no plan for the slug is reported and nothing changes - no stable marker beyond the instruction line
  - Q-clean-handoff: an empty `git status --porcelain` at every stop - a runtime property; the instruction lines are tested
  - Q-checkpoint-cost: exactly one Developer question when no item is named - needs a live conversation; the rule line is tested
  - R16: planning derives one scenario per pair - planning judgment; the rule line and the plan-check pair gate are tested
- **Gate:**
  - suite: `node --test --test-skip-pattern="<node scripts/trace.mjs --skip-pattern output>" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/workflow-core/phase-03.md R20-01 R20-02 R20-03 R20-04 R20-05 R20-06 R20-07 R20-08 R20-09 R20-10 R21-01 R21-02 R21-03 R21-04 R21-05 R21-06 R21-07 R21-08 R21-09 R21-10 R21-11 R16-01 R16-02 R16-03 R16-04 R16-05 R16-06 R16-07 Q-clean-handoff Q-checkpoint-cost`
  - lock: `git diff --exit-code <Tests locked> -- .github/tools/workflow-core/tests`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - Spec change detection script

- **Kind:** build
- **Goal:** `reconcile-check.mjs` reports whether a plan's spec changed since its reconcile point and lists the plans `/pull-work` can pull.
- **Depends on:** none
- **Tier:** delegate - one new script; behavior and messages are pinned
- **Review:** required - spawns git processes
- **Scenarios:**
  - R20-01: Given a repo where `.workflow/specs/demo-spec.md` was committed as `v1`, `plan.md` has the line ``- Reconciled: `<that commit>` ``, and a later commit changed the spec to `v2`, when `reconcile-check.mjs status demo` runs, then stdout is `changed` and exit 0
  - R20-02: Given the same plan and a later commit that changes only another file, when `status demo` runs, then stdout is `unchanged` and exit 0
  - R20-03: Given the same plan and an uncommitted edit to the spec, when `status demo` runs, then stdout is `unchanged` and exit 0
  - R20-04: Given a `plan.md` with no `Reconciled` line, when `status demo` runs, then stdout is `changed` and exit 0
  - R20-05: Given specs `a-spec.md`, `b-spec.md`, `c-spec.md`, `d-spec.md`, plan `a` with `- Next: P01 S01`, plan `b` with `- Next: done` and a changed spec, plan `c` with `- Next: done` and an unchanged spec, and no plan for `d`, when `candidates` runs, then stdout is exactly the lines `a<TAB>open`, `b<TAB>spec changed`, `d<TAB>no plan` and exit 0
  - R20-06: Given no spec file for slug `ghost`, when `status ghost` runs, then exit 1 and stderr is `missing spec: .workflow/specs/ghost-spec.md` (failure)
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p03-s01.test.mjs`
- **Files:** create `.github/skills/pull-work/scripts/reconcile-check.mjs`
- **Patterns:** `.github/skills/pull-work/scripts/plan-check.mjs:10 - usage text, argument checks, stderr problems, exit codes`
- **Decisions:**
  - Usage: `node reconcile-check.mjs status <slug>` or `node reconcile-check.mjs candidates`; anything else prints `usage: node reconcile-check.mjs status <slug> | candidates` to stderr and exits 2.
  - Paths: spec `.workflow/specs/<slug>-spec.md`, plan `.workflow/plans/<slug>/plan.md`, both relative to the working directory, which is the repository root.
  - Reconcile point: the first plan line matching ``^- Reconciled:\s*`([0-9a-f]{7,40})` ``. Spec text at a ref comes from `git show <ref>:<path>` run with `child_process.spawnSync('git', [...])` and `encoding: 'utf8'`; a failing command means the spec is absent at that ref.
  - `status`: spec absent at `HEAD` is the `missing spec` failure. Otherwise `changed` when there is no reconcile point, the spec is absent at the reconcile point, or the two texts differ; else `unchanged`. The working tree file is never read.
  - `candidates`: slugs are every `<slug>` from `.workflow/specs/*-spec.md` plus every directory under `.workflow/plans/`, sorted. Per slug: no `plan.md` gives `no plan`; a `- Next:` line whose trimmed value is not `done` gives `open`; a `done` plan whose `status` is `changed` gives `spec changed`; any other slug prints nothing. Each printed line is `<slug>`, a TAB, the reason.
  - The spec is the only file compared; the plan file is read only for its `Reconciled` and `Next` lines.
- **Do not:** edit `.github/tools/workflow-core/tests/**`; add dependencies; run git commands that write.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R20-01 to R20-06; 6 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S02 - Reconcile text

- **Kind:** build
- **Goal:** pull-work routes a changed spec to work-planner's Reconcile mode before `Next`, and work-planner and the plan format describe the reconcile point.
- **Depends on:** S01
- **Tier:** delegate - adds lines to three markdown files at pinned places
- **Review:** required - changes a persisted format
- **Scenarios:**
  - R20-07: Given `.github/skills/pull-work/SKILL.md`, when its lines are read, then one line contains `reconcile-check.mjs candidates`, `reconcile-check.mjs status`, and `Reconcile`
  - R20-08: Given the same file, when its lines are read, then a line starting `| Reconcile` contains ``docs(<slug>): reconcile spec``
  - R20-09: Given `.github/skills/work-planner/SKILL.md`, when its lines are read, then a line starts `### Reconcile` and lines start `- Trigger:`, `- Plan:`, `- Done plan:`, `- Mid-phase:`, `- No new work:`, `- Redirect:`, and `- Record:`; the `- Done plan:` line contains `PNN+1`; the `- Record:` line contains ``docs(<slug>): reconcile spec``; the `- Plan:` line contains `Reconciled`
  - R20-10: Given `.github/skills/work-planner/references/PLAN-FORMAT.md`, when its lines are read, then a line starts ``- `Reconciled` line`` and a line starts ``- Reconciled: ` ``
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p03-s02.test.mjs`
- **Files:** edit `.github/skills/pull-work/SKILL.md`; edit `.github/skills/work-planner/SKILL.md`; edit `.github/skills/work-planner/references/PLAN-FORMAT.md`
- **Patterns:** `.github/skills/pull-work/SKILL.md:50 - Commits table rows`; `.github/skills/work-planner/SKILL.md:90 - a mode section made of labelled lines`
- **Decisions:**
  - pull-work: add this line after the numbered step `2.` block of Preflight (before `## Route`): ``Plan candidates come from `node .github/skills/pull-work/scripts/reconcile-check.mjs candidates`: open plans, `done` plans whose spec changed, and specs with no plan. After selecting a plan, run `node .github/skills/pull-work/scripts/reconcile-check.mjs status <slug>`; on `changed`, load `work-planner` and run Reconcile mode before routing on `Next`.``
  - pull-work: add this row after the `Plan, Revise, ...` row of the Commits table: ``| Reconcile spec | none | `docs(<slug>): reconcile spec` |``
  - work-planner: add a section `### Reconcile (spec changed since the plan's reconcile point)` before `## Slicing` with these lines, each starting as written: `- Trigger:` pull-work's `reconcile-check.mjs status <slug>` prints `changed`; `- Plan:` Plan mode also writes the `Reconciled` header line; `- Done plan:` add a new phase `PNN+1` for the change, completed phases stay `completed`; `- Mid-phase:` revise unstarted cards, and completed slices the change invalidates get `fix` or `test-fix` cards; `- No new work:` move only the `Reconciled` line and leave `Next` unchanged; `- Redirect:` a missing spec file, or a changed requirement with a blocking `Open Decision`, redirects to `behavior-spec` and leaves the plan unchanged; `- Record:` set `Reconciled` to ``git log -1 --format=%H -- <spec>``, update gap, phases, and cards, and commit ``docs(<slug>): reconcile spec``.
  - PLAN-FORMAT: add after the `Phase base` bullet of Include Always: ``- `Reconciled` line: the commit that last changed the spec when the plan was last reconciled with it; `/pull-work` compares the spec at `HEAD` with that commit``. Add `- Reconciled: ` followed by a backticked short sha after the skeleton's `- Phase base:` line.
- **Do not:** edit `.github/tools/workflow-core/tests/**`; change other lines; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R20-07 to R20-10; 4 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S03 - Argument parser script

- **Kind:** build
- **Goal:** `parse-args.mjs` turns `/pull-work` arguments into a slug and a bug description, or a usage error.
- **Depends on:** none
- **Tier:** delegate - one new script; behavior and messages are pinned
- **Review:** required - parses free text from the Developer
- **Scenarios:**
  - R21-01: Given arguments `workflow-check bug: superseded Sessions get vocabulary warnings`, when `parse-args.mjs` runs with them as one argument, then stdout is `{"slug":"workflow-check","bug":"superseded Sessions get vocabulary warnings"}` and exit 0
  - R21-02: Given arguments `bug: add a:b  c ` (inner colon, double space, trailing space), when run, then stdout is `{"slug":null,"bug":"add a:b  c"}` and exit 0
  - R21-03: Given arguments `bug:`, when run, then exit 2 and stderr is `/pull-work [<slug>] bug: <description>` (failure)
  - R21-04: Given arguments `workflow-core bug:    `, when run, then exit 2 and stderr is the same usage line (failure)
  - R21-05: Given arguments `workflow-core`, when run, then stdout is `{"slug":"workflow-core","bug":null}` and exit 0
  - R21-06: Given no arguments, when run, then stdout is `{"slug":null,"bug":null}` and exit 0
  - R21-07: Given arguments `bug:fix it`, when run, then stdout is `{"slug":null,"bug":"fix it"}` and exit 0
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p03-s03.test.mjs`
- **Files:** create `.github/skills/pull-work/scripts/parse-args.mjs`
- **Patterns:** `.github/skills/pull-work/scripts/plan-check.mjs:10 - argument checks, stderr, exit codes`
- **Decisions:**
  - Usage: `node parse-args.mjs [<argument text>...]`. The argument text is all command-line arguments joined with one space, then trimmed.
  - Match the text against ``/^(?:(\S+?)\s+)?bug:([\s\S]*)$/`` first, where a first token ending in `:` cannot be the slug. When it matches: the slug is group 1 or `null`; the description is group 2 trimmed; an empty description prints the usage line (exactly `/pull-work [<slug>] bug: <description>`) to stderr and exits 2.
  - When it does not match: empty text gives `{"slug":null,"bug":null}`; any other text is the slug with `bug` `null`.
  - Output is `JSON.stringify({ slug, bug })` plus a newline. The description is never altered beyond the trim.
- **Do not:** edit `.github/tools/workflow-core/tests/**`; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R21-01 to R21-07; 7 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S04 - Defect report text

- **Kind:** build
- **Goal:** pull-work parses `bug:` arguments and routes defects to work-planner's Defect mode, which classifies and plans them.
- **Depends on:** S02, S03
- **Tier:** delegate - adds lines to two markdown files at pinned places
- **Review:** none
- **Scenarios:**
  - R21-08: Given `.github/skills/pull-work/SKILL.md`, when its lines are read, then one line contains `parse-args.mjs`, `/pull-work [<slug>] bug: <description>`, and `Defect`
  - R21-09: Given the same file, when its lines are read, then one line contains `bug` and `no plan`
  - R21-10: Given the same file, when its lines are read, then a line starting `| Defect` contains ``docs(<slug>): plan fix PNN``
  - R21-11: Given `.github/skills/work-planner/SKILL.md`, when its lines are read, then a line starts `### Defect` and lines start `- Classify:`, `- Scenario:`, `- Place:`, `- Next:`, `- Card:`, and `- Commit:`; `- Classify:` contains `behavior-spec` and `brain-storm`; `- Place:` contains `PNN+1`; `- Next:` contains `phase review PNN`; `- Card:` contains `Defect:` and `verbatim`
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p03-s04.test.mjs`
- **Files:** edit `.github/skills/pull-work/SKILL.md`; edit `.github/skills/work-planner/SKILL.md`
- **Patterns:** `.github/skills/pull-work/SKILL.md:20 - Preflight lines`; `.github/skills/work-planner/SKILL.md:90 - a mode section made of labelled lines`
- **Decisions:**
  - pull-work: add this line directly after the line starting `Plan candidates come from` (added by the reconcile card): ``Arguments are parsed by `node .github/skills/pull-work/scripts/parse-args.mjs <arguments>`, which prints JSON with `slug` and `bug`; exit 2 shows the usage line `/pull-work [<slug>] bug: <description>` and stops with no question and no change. With `bug` set, Preflight and the spec reconcile run first, then load `work-planner` and run Defect mode.``
  - pull-work: add this line after it: ``With `bug` set and no plan for the slug, or no plan at all, report that and change nothing.``
  - pull-work: add this row after the `Reconcile spec` row of the Commits table: ``| Defect planned | none | `docs(<slug>): plan fix PNN` |``
  - work-planner: add a section ``### Defect (`/pull-work [<slug>] bug: <description>`)`` after the Reconcile section, with lines starting as written: `- Classify:` built behavior that breaks the spec becomes fix work; spec silent or wrong redirects to `behavior-spec`; new behavior redirects to `brain-storm`; a redirect leaves the plan unchanged; `- Scenario:` the fix card's scenario reproduces the defect and fails before the fix; `- Place:` a `done` plan gets a new phase `PNN+1`, otherwise the fix goes into the active phase; `- Next:` set `Next: phase review PNN` so the reproducing tests reach the Developer at the Phase Review Checkpoint; `- Card:` a `build` card owns the scenario and its Goal is `Defect: <description>` with the description verbatim; `- Commit:` ``docs(<slug>): plan fix PNN``.
- **Do not:** edit `.github/tools/workflow-core/tests/**`; change other lines; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R21-08 to R21-11; 4 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S05 - Pair gate in plan-check

- **Kind:** build
- **Goal:** `plan-check.mjs` accepts rule-by-capability pairs in the gap line and fails a `done` plan that still lists any.
- **Depends on:** none
- **Tier:** delegate - extends one script; behavior and messages are pinned
- **Review:** none
- **Scenarios:**
  - R16-01: Given the spec and plan shapes of `p02-s03.test.mjs` with P01 `completed` covering `R1, R2`, P02 `planned` covering `R3, Q-latency`, and gap line `R3, Q-latency, R2 @ check`, when `plan-check.mjs demo P01` runs, then exit 0
  - R16-02: Given P01 covering `R1, R2`, P02 `completed` covering `R3, Q-latency`, gap line `R2 @ check`, and `Next: done`, when `plan-check.mjs demo P02` runs, then exit 1 and stderr contains `uncovered pair: R2 @ check` (failure)
  - R16-03: Given the same plan with gap line `R2 @ check, R2 @ lint`, when run, then exit 1 and stderr contains both `uncovered pair: R2 @ check` and `uncovered pair: R2 @ lint` (failure)
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p03-s05.test.mjs`
- **Files:** edit `.github/skills/pull-work/scripts/plan-check.mjs`
- **Patterns:** `.github/skills/pull-work/scripts/plan-check.mjs:121 - found gap parsing and the Next done check`
- **Decisions:**
  - A pair is a gap item containing ` @ `, written `<ID> @ <capability>`. Pairs are removed from `found` before the gap comparison, so they never cause `gap mismatch`.
  - When the `Next` value is `done`, each pair prints `uncovered pair: <item>` to stderr and counts as a problem. Otherwise pairs are allowed.
  - Every other check and message stays as it is.
- **Do not:** edit `.github/tools/workflow-core/tests/**`; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R16-01 to R16-03; 3 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S06 - Pair coverage text

- **Kind:** build
- **Goal:** work-planner and the plan and phase formats require one scenario per rule-by-capability pair, record not-expressible pairs, and keep `done` for plans with no open pair.
- **Depends on:** S04, S05
- **Tier:** delegate - adds lines to three markdown files at pinned places
- **Review:** required - changes persisted formats
- **Scenarios:**
  - R16-04: Given `.github/skills/work-planner/SKILL.md`, when its lines are read, then a line starts `- Pair coverage:` and contains `capability`, `stable markers`, and `Not expressible`
  - R16-05: Given `.github/skills/work-planner/references/PHASE-FORMAT.md`, when its lines are read, then a line starts `- **Not expressible**` and contains `Phase Review`
  - R16-06: Given `.github/skills/work-planner/references/PLAN-FORMAT.md`, when its lines are read, then the line starting ``- `done` means`` contains `pair`
  - R16-07: Given the same file, when its lines are read, then the line starting `- the gap line` contains `<ID> @ <capability>`
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p03-s06.test.mjs`
- **Files:** edit `.github/skills/work-planner/SKILL.md`; edit `.github/skills/work-planner/references/PHASE-FORMAT.md`; edit `.github/skills/work-planner/references/PLAN-FORMAT.md`
- **Patterns:** `.github/skills/work-planner/SKILL.md:103 - Slicing bullets`; `.github/skills/work-planner/references/PLAN-FORMAT.md:70 - the gap line rule`
- **Decisions:**
  - work-planner: add after the Slicing bullet starting `- Every scenario has exactly one owning card`: ``- Pair coverage: derive at least one scenario for every pair of a spec rule and a capability it governs (a Rule ID, command, skill, agent, or product interface; a class rule governs each enumerated member). The card that adds a capability owns the scenarios for every earlier rule that governs it. A rule about skill or agent behavior is tested through stable markers (commands, commit templates, file paths, labels); a pair with no stable marker and no other black-box test is presented at Phase Review and listed in the phase file's `Not expressible` line, never dropped.``
  - PHASE-FORMAT: add after the `Known failures` sub-bullet block, before `- **Gate:**`: ``- **Not expressible** (optional): pairs and scenarios no black-box test can express, one sub-bullet each, presented at Phase Review for approval.``
  - PLAN-FORMAT: replace the line starting ``- `done` means`` with ``- `done` means every requirement and quality threshold has a passing scenario, and every rule-by-capability pair has a passing scenario or an approved not-expressible entry.``
  - PLAN-FORMAT: replace the line starting `- the gap line` with: ``- the gap line lists IDs separated by `, `, adds ` partial` to a partly covered ID, adds `<ID> @ <capability>` for each pair with neither a passing scenario nor an approved not-expressible entry, and reads `none` when `Next: done`.``
- **Do not:** edit `.github/tools/workflow-core/tests/**`; change other lines; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R16-04 to R16-07; 4 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S07 - Clean handoff and Checkpoint cost text

- **Kind:** build
- **Goal:** each stage states its clean-handoff rule and the Checkpoint rules state the cost of an unnamed Checkpoint.
- **Depends on:** S04
- **Tier:** delegate - adds one line to each of five markdown files
- **Review:** none
- **Scenarios:**
  - Q-clean-handoff: Given `.github/skills/brain-storm/SKILL.md`, `.github/skills/behavior-spec/SKILL.md`, `.github/agents/planner.agent.md`, and `.github/skills/pull-work/SKILL.md`, when their lines are read, then each has a line starting `- Clean handoff:` (pull-work: starting `Clean handoff:`) containing `git status --porcelain`, and the pull-work line also contains `Phase Review`
  - Q-checkpoint-cost: Given `.github/user-interaction.md`, when its lines are read, then a line starts `- **Cost:**` and contains `names no items` and `exactly one question`
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p03-s07.test.mjs`
- **Files:** edit `.github/skills/brain-storm/SKILL.md`; edit `.github/skills/behavior-spec/SKILL.md`; edit `.github/agents/planner.agent.md`; edit `.github/skills/pull-work/SKILL.md`; edit `.github/user-interaction.md`
- **Patterns:** `.github/skills/brain-storm/SKILL.md:129 - the Never line that ends the Commit rules`; `.github/user-interaction.md:19 - labelled Checkpoint lines`
- **Decisions:**
  - brain-storm: add after the `- Never:` line (129): ``- Clean handoff: when you finish, `git status --porcelain` lists only changes you did not make.``
  - behavior-spec: add the same line after its `- Never:` line (107). planner: add the same line after its `- Never:` line (25).
  - pull-work: add after the paragraph starting `Moving the lock takes two commits` (before `## Dispatch`): ``Clean handoff: every stop leaves `git status --porcelain` empty, except the tests awaiting approval at Phase Review (Preflight).``
  - user-interaction.md: add after the `- **Cascade:**` line: ``- **Cost:** a Checkpoint where the Developer names no items costs exactly one question.``
- **Do not:** edit `.github/tools/workflow-core/tests/**`; change other lines; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets Q-clean-handoff, Q-checkpoint-cost; 2 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S08 - Reject malformed arguments in parse-args

- **Kind:** fix
- **Goal:** `parse-args.mjs` prints the usage line and exits 2 for argument text that is neither empty, a single slug, nor `[<slug>] bug: <description>`, instead of treating it as a slug.
- **Depends on:** S03
- **Tier:** delegate - one small edit to one script; the rule is pinned
- **Review:** none
- **Restores:** review - `parse-args.mjs` treats text such as `workflow-core fix the login bug: crashes` as a slug with `bug` null and exit 0, so a defect report whose `bug:` is not the first or second token is silently dropped
- **Files:** edit `.github/skills/pull-work/scripts/parse-args.mjs`
- **Patterns:** `.github/skills/pull-work/scripts/parse-args.mjs:21 - the non-bug branch and the usage exit`
- **Decisions:**
  - In the branch where the text does not match the `bug:` pattern, non-empty text must match `^[a-z0-9][a-z0-9-]*$`; otherwise print the usage line `/pull-work [<slug>] bug: <description>` to stderr and exit 2.
  - Every other behavior and output stays as it is.
- **Do not:** edit `.github/tools/workflow-core/tests/**`; add dependencies.
- **Done when:** `node --test --test-reporter=tap ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0, and `node .github/skills/pull-work/scripts/parse-args.mjs "workflow-core fix the login bug: crashes"` exits 2 with the usage line on stderr
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S09 - Validate the slug in the bug branch of parse-args

- **Kind:** fix
- **Goal:** `parse-args.mjs` rejects a slug that fails the slug rule when it precedes `bug:`, the same as it does without `bug:`.
- **Depends on:** S08
- **Tier:** delegate - one small edit to one script; the rule is pinned
- **Review:** none
- **Restores:** review - `parse-args.mjs "../../x bug: y"` prints slug `../../x` with exit 0, so a path-like slug reaches `.workflow/plans/<slug>/`
- **Files:** edit `.github/skills/pull-work/scripts/parse-args.mjs`
- **Patterns:** `.github/skills/pull-work/scripts/parse-args.mjs:21 - the existing slug check and usage exit`
- **Decisions:**
  - When the `bug:` pattern matches and group 1 is not null, group 1 must match `^[a-z0-9][a-z0-9-]*$`; otherwise print the usage line `/pull-work [<slug>] bug: <description>` to stderr and exit 2.
  - Every other behavior and output stays as it is.
- **Do not:** edit `.github/tools/workflow-core/tests/**`; add dependencies.
- **Done when:** `node --test --test-reporter=tap ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0, and `node .github/skills/pull-work/scripts/parse-args.mjs "../../x bug: y"` exits 2 with the usage line on stderr
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.
