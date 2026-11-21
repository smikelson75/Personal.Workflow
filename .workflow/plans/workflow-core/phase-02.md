# P02 - Gate and plan scripts

- **Outcome:** the Gate's traceability honors Known Failures, a completed phase leaves `plan.md` showing current truth (checked by a script), and Plan mode detects a missing mutation Language Add-on by script.
- **Covers:** R14, R15, R17
- **Invariants:**
  - `C` = `.github/tools/workflow-core`. ES modules (`.mjs`), no dependencies, Node built-ins only.
  - Scripts print problems to stderr, one per line, and exit 0 (ok), 1 (problem found), or 2 (usage error, usage line on stderr).
  - Tests read skill and agent text through markers only: paths, commands, line starts such as `- **Label:**` or `2. traceability`, and a token a card names. Never a whole sentence.
  - Edits to existing markdown files only add lines or replace the one line a card names; every other line stays unchanged.
  - Scripts that tests run live where the skill that runs them lives: `.github/skills/<skill>/scripts/`; the Gate's trace script stays at `C/scripts/trace.mjs`.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R14-01]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Not expressible (presented at Phase Review):**
  - R15: current-state lines describe the repository after the phase - the content is a judgment; only that the lines exist is checked
  - R15: the checks run in the commit that completes the phase - the script checks files, and pull-work text only instructs when to run it; no marker proves an agent runs it
  - R17: no Developer question mentions mutation - needs a live Developer conversation
- **Gate:**
  - suite: `node --test ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/workflow-core/phase-02.md <IDs owned by P02>`
  - lock: `git diff --exit-code <Tests locked> -- .github/tools/workflow-core/tests`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - Trace honors Known Failures

- **Kind:** build
- **Goal:** `trace.mjs` accepts a phase file and a captured TAP file, and fails only on unlisted failing tests and owned IDs without a passing test.
- **Depends on:** none
- **Tier:** delegate - extends an existing script; every behavior is pinned
- **Review:** required - test literal in product code
- **Scenarios:**
  - R14-01: Given phase file `phase-02.md` (title `# P02 - x`) listing `` `legacy import keeps BOM` - owner P04 `` and TAP with `ok 1 - [R3-01] a` and `not ok 2 - legacy import keeps BOM`, when `trace.mjs --tap t.tap --phase-file phase-02.md R3-01` runs, then exit 0
  - R14-02: Given the same files plus TAP line `not ok 3 - [R3-02] duplicate ID errors`, when run, then exit 1 and stderr contains `[R3-02] duplicate ID errors` (failure)
  - R14-03: Given phase file `# P04 - x` with the same Known Failure owned by P04 and TAP failing `legacy import keeps BOM`, when run, then exit 1 and stderr contains `legacy import keeps BOM` (failure)
  - R14-04: Given Known Failure `` `[R3-01] a` - owner P04 `` in `# P02` and TAP `not ok 1 - [R3-01] a`, when run with ID `R3-01`, then exit 1 and stderr contains `R3-01` (failure)
  - R14-05: Given Known Failure `legacy import keeps BOM` owned by P04 and TAP `ok 1 - legacy import keeps BOM` and `ok 2 - [R3-01] a`, when run with `R3-01`, then exit 0
  - R14-06: Given TAP `ok 1 - [R3-01] a` and no phase file, when run with `R3-01 R3-02`, then exit 1 and stderr contains `R3-02` (failure)
  - R14-07: Given a phase file `# P02` listing `` `a.b [x]` - owner P04 `` and `` `old` - owner P02 ``, when run with `--phase-file <file> --skip-pattern`, then stdout is exactly `a\.b \[x\]` plus a newline, exit 0
  - R14-08: Given TAP `not ok 1 - anything` and no phase file, when run with `--tap t.tap R3-01`, then exit 1 and stderr contains `anything` (failure)
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p02-s01.test.mjs`
- **Files:** edit `.github/tools/workflow-core/scripts/trace.mjs`
- **Patterns:** `.github/tools/workflow-core/scripts/trace.mjs:23 - TAP line loop and the exit-code rules`
- **Decisions:**
  - Usage: `node trace.mjs [--tap <file>] [--phase-file <path>] [--skip-pattern] <scenario-ID>...`. Arguments starting `--` are flags; `--tap` and `--phase-file` consume the next argument. Without `--tap`, the script runs the suite as it does now.
  - Gated phase = the `PNN` in the phase file's first line `# PNN - ...`. Known Failures are the lines after a line starting `- **Known failures` and before the next line starting `- **`, each matching ``^\s+- `(.+)` - owner (P\d+)\s*$``.
  - A Known Failure is excluded when its owner's number is greater than the gated phase's number. Others count like any test.
  - Per TAP line `not ok N - <title>`: when `<title>` is an excluded Known Failure it is ignored; otherwise stderr gets `unlisted failing test: <title>` and the exit is 1. `ok` lines with a leading `[ID]` mark that ID passing, for every title, Known Failure or not.
  - An ID with no passing line gets stderr `no passing test for: <ID>` (all missing IDs joined by `, `) and exit 1. A failing excluded Known Failure never marks an ID passing.
  - `--skip-pattern` prints the excluded titles, each with regex metacharacters escaped by `title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`, joined by `|`, then a newline, and exits 0 without reading TAP or needing IDs. With no excluded titles it prints nothing.
  - Without `--phase-file`, nothing is excluded. With no IDs and no `--skip-pattern`, usage (exit 2) as now.
- **Do not:** edit `.github/tools/workflow-core/tests/**`; add dependencies; change `support/harness.mjs`.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R14-01 to R14-08; 8 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S02 - Gate text names Known Failures

- **Kind:** build
- **Goal:** the Phase Format and the pull-work Gate tell planners and the Gate how Known Failures are written and excluded.
- **Depends on:** S01
- **Tier:** delegate - adds lines to two markdown files
- **Review:** required - test literal in product code
- **Scenarios:**
  - R14-09: Given `.github/skills/work-planner/references/PHASE-FORMAT.md`, when the line starting `- **Known failures` is read, then it contains `owner PNN` and `<test title>`
  - R14-10: Given `.github/skills/pull-work/SKILL.md`, when the line starting `2. traceability` is read, then it contains `Known failures`
  - R14-11: Given the same file, when its lines are read, then one line contains `trace.mjs --phase-file` and `--skip-pattern`
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p02-s02.test.mjs`
- **Files:** edit `.github/skills/work-planner/references/PHASE-FORMAT.md`; edit `.github/skills/pull-work/SKILL.md`
- **Patterns:** `.github/skills/pull-work/SKILL.md:93 - the numbered Gate steps`; `.github/skills/work-planner/references/PHASE-FORMAT.md:17 - the Known failures header line`
- **Decisions:**
  - Replace PHASE-FORMAT line 17 with: ``- **Known failures** (optional): pre-existing failing tests, each written as a sub-bullet `<test title>` - owner PNN, where `<test title>` is the title as the harness reports it and `PNN` is a later phase. Excluded only from the gates of phases before `PNN`.``, with each sub-bullet written as ``  - `<test title>` - owner PNN``.
  - Replace pull-work line 94 with `2. traceability: every scenario ID owned by this phase's cards has a tagged test that ran and passed; every failing test is a `Known failures` entry of this phase whose owner is a later phase`.
  - Add one line after line 96 (after step 4): `` For this repository's Gate, `node .github/tools/workflow-core/scripts/trace.mjs --phase-file <phase file> --skip-pattern` prints the pattern for the suite step's `--test-skip-pattern`, so steps 1 and 2 exclude the same tests. ``
- **Do not:** edit `.github/tools/workflow-core/tests/**`; change other lines; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R14-09 to R14-11; 3 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S03 - Plan check script

- **Kind:** build
- **Goal:** `plan-check.mjs` verifies that a completed phase left `plan.md` showing current truth.
- **Depends on:** none
- **Tier:** delegate - one new script; format and messages are pinned
- **Review:** required - test literal in product code
- **Scenarios:**
  - R15-01: Given a spec with `### R1 - a`, `### R2 - b`, `### R3 - c` and a Quality Thresholds bullet `- Latency -> x`, and a plan whose table has P01 `completed` covering `R1, R2` and P02 `planned` covering `R3, Q-latency`, gap line `R3, Q-latency`, `Next: plan P02`, state lines `harness`, `suite baseline`, `in place`, when `plan-check.mjs demo P01` runs, then exit 0
  - R15-02: Given the same plan plus a heading `## P01 slices`, when run, then exit 1 and stderr contains `slice table P01 present` (failure)
  - R15-03: Given the same plan with gap line `R1, R3, Q-latency`, when run, then exit 1 and stderr contains `gap mismatch` (failure)
  - R15-04: Given P01 covering `R1, R2 (failure handling only)` and gap line `R2 partial, R3, Q-latency`, when run, then exit 0; with gap line `R2, R3, Q-latency` then exit 1 and stderr contains `gap mismatch` (failure)
  - R15-05: Given the base plan plus a line `- Review pending: S02`, when run, then exit 1 and stderr contains `Review pending present` (failure)
  - R15-06: Given P01 with status `in progress`, when run, then exit 1 and stderr contains `phase P01 not completed` (failure)
  - R15-07: Given P01 and P02 `completed` covering all IDs, `Next: done`, and gap `none`, when `plan-check.mjs demo P02` runs, then exit 0; with gap `R3` then exit 1 and stderr contains `gap mismatch` (failure)
  - R15-08: Given the base plan without a `- harness:` line, when run, then exit 1 and stderr contains `missing current state line: harness` (failure)
  - R15-09: Given no arguments, when run, then exit 2 and stderr contains `usage: node plan-check.mjs <slug> <PNN>` (failure)
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p02-s03.test.mjs`
- **Files:** create `.github/skills/pull-work/scripts/plan-check.mjs`
- **Patterns:** `.github/tools/workflow-core/scripts/trace.mjs:5 - usage constant, `--help`, exit 2 on bad arguments`
- **Decisions:**
  - Usage: `node plan-check.mjs <slug> <PNN>`, run from the repository root. Reads `.workflow/plans/<slug>/plan.md` and `.workflow/specs/<slug>-spec.md`.
  - Spec IDs: each `### R<n> - ...` heading gives `R<n>`; each bullet under `## Quality Thresholds` matching `^- (.+?) -> ` gives `Q-` plus the name lowercased with runs of non-alphanumerics replaced by `-`.
  - Phase rows: table lines starting `| P<nn> |`, cells split on `|` and trimmed: phase, name, status, covers. Covers is split on commas outside parentheses; an item's ID is its leading `R\d+` or `Q-[A-Za-z0-9-]+`, and it is partial when text remains after the ID.
  - Expected gap: spec IDs, in spec order, not fully covered (listed without remaining text) by a `completed` phase; written `<ID> partial` when a `completed` phase lists it with remaining text, otherwise `<ID>`. Empty means `none`.
  - Found gap: the text after `- gap to spec:` in the plan, `none` or items split on `,` and trimmed. Compared as sets. Mismatch message: `gap mismatch: expected <items joined ", " or none> but found <same>`.
  - Checks, each its own stderr line: `phase <PNN> not completed`; `slice table <PNN> present` for a heading `## <PNN> slices`; `Review pending present` for a line starting `- Review pending` or `Review pending:`; `missing current state line: <harness|suite baseline|in place>` for a missing line starting `- <name>:`; the gap mismatch. When the `- Next:` line's value is `done` and expected is not empty, also `Next is done with uncovered IDs: <expected>`.
  - Unknown `<PNN>` (no row): `phase <PNN> not found`, exit 1.
- **Do not:** edit `.github/tools/workflow-core/tests/**`; add dependencies; write any file.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R15-01 to R15-09; 9 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S04 - Phase completion runs the plan check

- **Kind:** build
- **Goal:** pull-work's Review step runs the plan check before the completion commit, and the plan format shows the gap in the checked shape.
- **Depends on:** S02, S03
- **Tier:** delegate - adds lines to two markdown files
- **Review:** required - test literal in product code
- **Scenarios:**
  - R15-10: Given `.github/skills/pull-work/SKILL.md`, when its lines are read, then one line contains `node .github/skills/pull-work/scripts/plan-check.mjs <slug> PNN`
  - R15-11: Given `.github/skills/work-planner/references/PLAN-FORMAT.md`, when the line starting `- gap to spec:` is read, then it contains `R2 partial` and not `absent`
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p02-s04.test.mjs`
- **Files:** edit `.github/skills/pull-work/SKILL.md`; edit `.github/skills/work-planner/references/PLAN-FORMAT.md`
- **Patterns:** `.github/skills/pull-work/SKILL.md:104 - the Review step that completes the phase`; `.github/skills/work-planner/references/PLAN-FORMAT.md:89 - the skeleton gap line`
- **Decisions:**
  - In pull-work, append to the last paragraph of Review (the one starting `After classifying`) this sentence: `` Before the completion commit, run `node .github/skills/pull-work/scripts/plan-check.mjs <slug> PNN` and fix every line it prints; it checks that `plan.md` shows PNN completed, has no PNN slice table or `Review pending` line, and lists exactly the uncovered IDs in its gap (`none` when `Next: done`). ``
  - Replace PLAN-FORMAT line 89 with `- gap to spec: R4, R6, R2 partial`. Add one rule at the end of PLAN-FORMAT's `## Rules` list: ``- the gap line lists IDs separated by `, `, adds ` partial` to a partly covered ID, and reads `none` when `Next: done` ``.
- **Do not:** edit `.github/tools/workflow-core/tests/**`; change other lines; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R15-10, R15-11; 2 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S05 - Mutation add-on detection script

- **Kind:** build
- **Goal:** `mutation-addon.mjs` reports whether an installed skill supplies a mutation command for a stack.
- **Depends on:** none
- **Tier:** delegate - one new script; format and messages are pinned
- **Review:** required - test literal in product code
- **Scenarios:**
  - R17-01: Given a repository whose `.github/skills/` holds a skill with no mutation lines, when `mutation-addon.mjs node` runs there, then stdout is `mutation: unsupported for node - no mutation Language Add-on installed` and exit 0
  - R17-02: Given `.github/skills/stryker-x/SKILL.md` with lines `- **Mutation stack:** node` and `- **Mutation command:** npx stryker run`, when run with `node`, then stdout is `mutation: npx stryker run` and exit 0
  - R17-03: Given the same skill, when run with `csharp`, then stdout is `mutation: unsupported for csharp - no mutation Language Add-on installed` (failure)
  - R17-04: Given R17-01's repository, when the skill of R17-02 is added and the script runs again, then stdout is `mutation: npx stryker run`
  - R17-05: Given no arguments, when run, then exit 2 and stderr contains `usage: node mutation-addon.mjs <stack>` (failure)
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p02-s05.test.mjs`
- **Files:** create `.github/skills/work-planner/scripts/mutation-addon.mjs`
- **Patterns:** `.github/tools/workflow-core/support/harness.mjs:17 - walking a folder with readdirSync`
- **Decisions:**
  - Usage: `node mutation-addon.mjs <stack>`, run from the repository root. Scans `.github/skills/*/SKILL.md` (one folder level), sorted by folder name. A missing `.github/skills/` counts as no skills.
  - A skill supplies a mutation command for the stack when its `SKILL.md` has a line `- **Mutation stack:** <value>` whose trimmed value equals `<stack>` ignoring case, and a line `- **Mutation command:** <command>`. The first such skill wins; stdout is `mutation: <command>` with the command trimmed.
  - Otherwise stdout is `mutation: unsupported for <stack> - no mutation Language Add-on installed`. Exit 0 in both cases; nothing is cached or written.
- **Do not:** edit `.github/tools/workflow-core/tests/**`; add dependencies; write any file.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R17-01 to R17-05; 5 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S06 - Plan mode and Gate use mutation detection

- **Kind:** build
- **Goal:** work-planner's Plan mode runs the detection script instead of asking about mutation, and the Gate treats an unsupported mutation line as passed.
- **Depends on:** S04, S05
- **Tier:** delegate - adds and replaces lines in two markdown files
- **Review:** required - test literal in product code
- **Scenarios:**
  - R17-06: Given `.github/skills/work-planner/SKILL.md`, when its lines are read, then one line contains `node .github/skills/work-planner/scripts/mutation-addon.mjs <stack>`
  - R17-07: Given the same file, when its lines are read, then no line contains `supported mutation tool` (failure: the repo-scout question is gone)
  - R17-08: Given the same file, when its lines are read, then one line contains both `**Mutation stack:**` and `**Mutation command:**`
  - R17-09: Given `.github/skills/pull-work/SKILL.md`, when the line starting `4. mutation` is read, then it contains `unsupported for`
- **Acceptance tests:** `.github/tools/workflow-core/tests/acceptance/p02-s06.test.mjs`
- **Files:** edit `.github/skills/work-planner/SKILL.md`; edit `.github/skills/pull-work/SKILL.md`
- **Patterns:** `.github/skills/work-planner/SKILL.md:73 - the repo-scout questions in Plan mode`; `.github/skills/pull-work/SKILL.md:96 - the mutation Gate step`
- **Decisions:**
  - In work-planner line 73, delete the clause `supported mutation tool; `.
  - Add a new Plan step after step 2: `` 2a. Run `node .github/skills/work-planner/scripts/mutation-addon.mjs <stack>` and copy its output line into Current state and each phase Gate's mutation line; ask the Developer nothing about mutation. A mutation Language Add-on is a skill under `.github/skills/` whose `SKILL.md` has the lines `- **Mutation stack:** <stack>` and `- **Mutation command:** <command>`; one installed later takes effect at the next Plan mode. ``
  - Replace pull-work's step 4 line with `4. mutation testing, scoped to files the phase changed; a mutation line `unsupported for <stack>` is skipped and counts as passed`.
- **Do not:** edit `.github/tools/workflow-core/tests/**`; change other lines; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"` exits 0; targets R17-06 to R17-09; 4 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.
