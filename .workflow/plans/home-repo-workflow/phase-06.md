# P06 - Claude Code agent pins from one edit

- **Outcome:** after one Update Script run, Copilot CLI reads every Workflow Core agent's `model` list and `reasoning-effort` exactly as written, and Claude Code runs each agent on the family and effort derived from the same two fields; the run names every agent that fell back to a default or skipped an entry; an unparsable agent file rejects the run.
- **Covers:** R48, R49, R50, R51 (and R36's `invalid-agent` failure and agent pin notice lines)
- **Invariants:**
  - Source agent files under `.github/agents/*.agent.md` carry only the two pin fields `model` (Copilot display names) and `reasoning-effort`; the source is never rewritten.
  - The Home Repo holds two forms of each agent: the source byte for byte at `.github/agents/<n>.agent.md` (Copilot CLI prefers `.github/agents` over `.claude/agents`, probed) and the Claude form at `.claude/agents/<n>.agent.md` (Claude Code reads only `.claude/`, probed). Both are installed by the Update Script and listed in the manifest and the exclude block.
  - Claude form = the source frontmatter without the `model` block and the `reasoning-effort` line, then the lines `model: <alias>` and `effort: <level>` directly before the closing `---`; the body after the closing `---` is unchanged byte for byte.
  - Update Script success output stays `Home Repo:`, `Workflow version:`, `Files:` lines, then pin notices; exit 0 with notices.
  - Zero-dependency Node ES modules; no network; tests use temp source folders and temp Home Repos only.
- **Harness:**
  - run: `node --test --test-reporter=tap --test-name-pattern="<regex of IDs>" "tests/home-repo-workflow/*.test.mjs"`; exclude with `--test-skip-pattern="<regex>"`
  - tag: test title starts with `[R48-01]`
  - count: the `# pass N` line of the tap output
  - assert: `^\s*assert|\btest\(`
- **Not expressible:**
  - Claude Code's `/tasks` showing the pinned model and effort, Claude Code honoring a per-agent effort (accepted risk in the Session), and Copilot CLI running on its first available listed model - need real Harness sessions; tests cover the installed file contents; the main session live-probes both Harnesses at Review and records the result in the plan's Current state.
- **Gate:**
  - suite: `node --test --test-reporter=tap --test-skip-pattern="<node .github/tools/workflow-core/scripts/trace.mjs --phase-file .workflow/plans/home-repo-workflow/phase-06.md --skip-pattern output>" "tests/home-repo-workflow/*.test.mjs" "tests/glossary-alignment/*.test.mjs" "tests/acceptance/*.test.mjs" "tests/mutation-addon.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs"`
  - traceability: `node --test --test-reporter=tap "tests/home-repo-workflow/*.test.mjs" "tests/glossary-alignment/*.test.mjs" "tests/acceptance/*.test.mjs" "tests/mutation-addon.test.mjs" ".github/tools/workflow-check/tests/acceptance/*.test.mjs" ".github/tools/workflow-core/tests/acceptance/*.test.mjs" > <tap-file>; then node .github/tools/workflow-core/scripts/trace.mjs --tap <tap-file> --phase-file .workflow/plans/home-repo-workflow/phase-06.md R49-01 R48-01 R48-02 R48-03 R48-04 R48-05 R48-06 R51-01 R51-02 R51-03 R48-07 R48-08 R48-09 R48-10 R50-01 R50-02 R50-03 R50-04 R50-05 R50-06 R50-07 R48-11 R48-12 R48-13 R48-14 R48-15 R48-16 R51-04 R48-17 R49-02 R49-03 R50-08`
  - lock: `git diff --exit-code <Tests locked> -- tests/home-repo-workflow`
  - mutation: unsupported for node - no mutation Language Add-on installed

## S01 - Update Script tests expect the two agent forms

- **Kind:** test-fix
- **Scope:** assertion
- **Goal:** the P02 Update Script tests expect what the spec now requires of an install that contains agent files: two installed forms per agent, agent files that parse, and pin notice lines.
- **Depends on:** none
- **Tier:** main - judgment about which expectations change
- **Review:** none - writes tests only, no product code
- **Restores:** R36-01 through R36-20 and R37-01 through R37-06 (only those whose test fails once S02 through S05 are done); finding: install behavior changed by R48-R50
- **Acceptance tests:** `tests/home-repo-workflow/p02-s01.test.mjs`, `tests/home-repo-workflow/p02-s02.test.mjs`, `tests/home-repo-workflow/p02-s03.test.mjs`, `tests/home-repo-workflow/p02-s04.test.mjs`
- **Files:** none
- **Decisions:**
  - Fixture agent files that read `# demo agent\n` become `---\nname: demo\n---\nDemo agent\n` (valid frontmatter); this repairs fixtures only.
  - A demo agent with no `model` and no `reasoning-effort` installs as `.github/agents/demo.agent.md` (byte-equal to the source) and `.claude/agents/demo.agent.md` equal to `---\nname: demo\nmodel: sonnet\neffort: medium\n---\nDemo agent\n`.
  - Expected install lists, `Files:` installed/replaced/removed counts, and manifest and exclude-block path lists gain `.github/agents/demo.agent.md` per demo agent.
  - A run with a demo agent prints, after `Files:`, `Agent default: demo: model sonnet (no Claude model in list)` then `Agent default: demo: effort medium (no reasoning-effort)`; tests that compare whole output include them.
  - Expectations about files and categories other than agents stay as they are.
- **Do not:** change what any non-agent expectation checks; weaken an assertion.
- **Stop and report if:** an expectation outside the four files must change.

## S02 - Update Script installs the Copilot form and the Claude form

- **Kind:** build
- **Goal:** one Update Script run installs every agent twice: verbatim for Copilot CLI and with Claude Code's `model` alias and `effort` derived from the first known Claude family and the effort, so one edit and one run change both Harnesses.
- **Depends on:** S01
- **Tier:** main - creates the agent-form module and changes the install map later cards extend
- **Review:** required - creates a shared structure and changes a persisted install format
- **Scenarios:** fixture: temp source folders plus a temp Home Repo; agents are written with frontmatter `---\nname: <n>\ndescription: "x"\nmodel:\n  - <entries>\nreasoning-effort: <v>\n---\n<body>\n`
  - R49-01: Given a `coder` agent listing `GPT-6 Luna (copilot)`, `Claude Haiku 5.5 (copilot)`, `Gemini 3.8 Flash (copilot)` at `medium`, when the Update Script runs, then Home `.github/agents/coder.agent.md` equals the source byte for byte
  - R48-01: Given `repo-scout` listing `Claude Haiku 5.5 (copilot)`, `GPT-6 Luna (copilot)` at `low`, when it runs, then Home `.claude/agents/repo-scout.agent.md` has the lines `model: haiku` and `effort: low`, no `reasoning-effort` line, no `Claude Haiku` text, the other frontmatter lines, and the body unchanged
  - R48-02: Given `planner` listing `Claude Opus 5.5 (copilot)` at `high`, when it runs, then the Claude form has `model: opus` and `effort: high`
  - R48-03: Given `Claude Opus 4.8 Fast (copilot)`, `claude sonnet 5` in lower case, and a single-string `model: Claude Fable 5`, when it runs, then the Claude forms have `opus`, `sonnet`, `fable`
  - R48-04: Given `GPT-6 Luna (copilot)`, `Claude Haiku 5.5 (copilot)`, `Claude Opus 5.5 (copilot)` in that order, when it runs, then the Claude form has `model: haiku`
  - R48-05: Given `reasoning-effort: none` and `reasoning-effort: minimal`, when it runs, then both Claude forms have `effort: low`
  - R48-06: Given `reasoning-effort: xhigh` and `reasoning-effort: max`, when it runs, then the Claude forms have `effort: xhigh` and `effort: max`
  - R51-01: Given an installed `coder` listing `Claude Haiku 5.5 (copilot)` and a source edit to `Claude Sonnet 5.5 (copilot)`, when it runs again, then the Claude form has `model: sonnet` and the output line is `Files: 0 installed, 2 replaced, 0 removed` (the Copilot form and the Claude form)
  - R51-02: Given the same installed `coder` and a source edit that moves `Gemini 4 Neon (copilot)` to the top of the list, when it runs again, then the Claude form is byte-identical to before, the Copilot form equals the edited source, and the output line is `Files: 0 installed, 1 replaced, 0 removed`
  - R51-03: Given the same installed `coder` and a source edit from `Claude Haiku 5.5 (copilot)` to `Claude Haiku 6 (copilot)`, when it runs again, then the Claude form still has `model: haiku` and is byte-identical to before
- **Acceptance tests:** `tests/home-repo-workflow/p06-s02.test.mjs`
- **Files:** edit `scripts/update-home.mjs`
- **Patterns:** `scripts/update-home.mjs:30 - install map and walk helpers; scripts/update-home.mjs:200 - the write loop and the replaced/installed counting`
- **Decisions:**
  - `renderClaudeForm(text)` lives inside `scripts/update-home.mjs` (the P02 tests copy only that file into temp sources) and is not exported; it returning `{ text, notices: [] }`; it never throws in this card. A source without an opening `---` line or a closing `---` line is returned unchanged with no notices.
  - Parse: the frontmatter is the lines between the first line `---` and the next line `---`. Line ending of the output is the first line's ending (`\r\n` or `\n`). `model` is the top-level `model:` key. An inline value starting `[` is a flow list split on `,`; another inline value is a one-entry list; an empty inline value takes the following lines of the form `^\s*-\s+(.+)$` until the next top-level key, and comment and blank lines are skipped. Quotes around an entry are removed. `reasoning-effort` is the trimmed inline value with quotes removed.
  - A Claude entry matches `/^claude\b/i`; its family is the lowercase next word; known families are `opus`, `sonnet`, `haiku`, `fable`. The first Claude entry with a known family sets `model`.
  - Effort: lowercase the value; `low`, `medium`, `high`, `xhigh`, `max` as written; `none` and `minimal` become `low`.
  - When a half cannot be resolved, its line is omitted from the Claude form (card S04 adds the default).
  - Remove the `model` block (the key line and every following line up to the next top-level key, including comments) and the `reasoning-effort` line; append `model: <alias>` then `effort: <level>` before the closing `---`.
  - `update-home.mjs`: `planInstall` also maps `.github/agents/<n>.agent.md` to the same Home path; the content written for `.claude/agents/<n>.agent.md` is `renderClaudeForm(source).text`. `replaced` compares the target with the content to be written. `fingerprint` hashes the content to be written for every installed path (the spec's "content the Update Script installs"), so the Claude form and the new Copilot paths are included.
  - Agent name for later notices is the file name without `.agent.md`.
- **Do not:** edit `tests/**`; add dependencies; change any file under `.github/agents/`; print notices (S03 and S04 add them).
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0, where the exclusion also lists S01's Restores IDs; targets R49-01, R48-01, R48-02, R48-03, R48-04, R48-05, R48-06, R51-01, R51-02, R51-03; 10 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S03 - Update Script names skipped Claude entries

- **Kind:** build
- **Goal:** a Claude entry whose family Claude Code does not know is skipped with a printed notice, and the search continues with the next Claude entry.
- **Depends on:** S02
- **Tier:** delegate - extends one function and one output step with every string pinned
- **Review:** required - test literal in product code
- **Scenarios:** fixture: as S02
  - R48-07: Given `coder` listing `GPT-6 Luna (copilot)`, `Claude Nova 1 (copilot)`, `Claude Sonnet 5 (copilot)`, when the Update Script runs, then it exits 0, the fourth output line is `Agent pin: coder: skipped "Claude Nova 1 (copilot)" (not a Claude Code model family)`, and the Claude form has `model: sonnet`
  - R48-08: Given `repo-scout` skipping two entries and `coder` skipping one, when it runs, then the notice lines follow `Files:` sorted by agent name (`coder` first), and an agent's lines follow its list order
  - R48-09: Given the same source run twice against the same Home Repo, when the second run finishes, then it prints the same notice lines again and exits 0
  - R48-10: Given entries `GPT-6 Luna (copilot)`, `Claudette 1`, `Claude Haiku 5.5 (copilot)`, when it runs, then no `Agent pin:` line prints and the Claude form has `model: haiku`
- **Acceptance tests:** `tests/home-repo-workflow/p06-s03.test.mjs`
- **Files:** edit `scripts/update-home.mjs`
- **Patterns:** `scripts/update-home.mjs:78 - renderClaudeForm and its notices array; scripts/update-home.mjs:334 - the success output lines`
- **Decisions:**
  - A Claude entry (`/^claude\b/i`) whose next word is not a known family, or that has no next word, adds the notice string `Agent pin: <agent>: skipped "<entry>" (not a Claude Code model family)` with `<entry>` the entry text after quotes are removed.
  - `renderClaudeForm` returns notices in list order; `update-home.mjs` collects them per agent and prints them after the `Files:` line, agents sorted by name (plain code-unit order).
  - A skipped entry never decides the model; only the next Claude entry with a known family does.
- **Do not:** edit `tests/**`; change the output lines before `Files:`; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0, where the exclusion also lists S01's Restores IDs; targets R48-07, R48-08, R48-09, R48-10; 4 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S04 - Update Script applies and names the shipped default

- **Kind:** build
- **Goal:** a missing or unusable model or effort pin falls back to `sonnet` and `medium`, each fallback named in the output.
- **Depends on:** S03
- **Tier:** delegate - extends the same function with pinned strings
- **Review:** none
- **Scenarios:** fixture: as S02
  - R50-01: Given `coder` with no Claude entry and `reasoning-effort: medium`, when the Update Script runs, then output includes `Agent default: coder: model sonnet (no Claude model in list)`, no effort line for `coder`, and the Claude form has `model: sonnet` and `effort: medium`
  - R50-02: Given `repo-scout` listing `Claude Haiku 5.5 (copilot)` with `reasoning-effort: fast`, when it runs, then output includes `Agent default: repo-scout: effort medium (unrecognized reasoning-effort "fast")` and the Claude form has `model: haiku` and `effort: medium`
  - R50-03: Given every agent has a known Claude entry and a recognized effort, when it runs, then no `Agent default:` and no `Agent pin:` line prints
  - R50-04: Given agent `b` with neither `model` nor `reasoning-effort` and agent `a` with `reasoning-effort: fast` and no Claude entry, when it runs, then the lines after `Files:` are, in order, the model line of `a`, the effort line of `a`, the model line of `b`, then `Agent default: b: effort medium (no reasoning-effort)`
  - R50-05: Given `coder` listing only `Claude Nova 1 (copilot)` at `low`, when it runs, then the `Agent pin:` skip line precedes `Agent default: coder: model sonnet (no Claude model in list)` and the Claude form has `effort: low`
  - R50-06: Given a valid Claude entry and no `reasoning-effort`, when it runs, then output includes `Agent default: <agent>: effort medium (no reasoning-effort)` and the model line is not printed
  - R50-07: Given a source with a defaulted agent run twice, when the second run finishes, then it prints the same `Agent default:` lines and exits 0
- **Acceptance tests:** `tests/home-repo-workflow/p06-s04.test.mjs`
- **Files:** edit `scripts/update-home.mjs`
- **Patterns:** `scripts/update-home.mjs:78 - renderClaudeForm notices; scripts/update-home.mjs:334 - notice printing`
- **Decisions:**
  - Default model alias `sonnet`, default effort `medium`; each half applies alone.
  - Model notice text is `Agent default: <agent>: model sonnet (no Claude model in list)` whenever no Claude entry resolved (no `model`, no Claude entry, or only skipped entries).
  - Effort notice is `Agent default: <agent>: effort medium (no reasoning-effort)` when the field is missing or empty, else `Agent default: <agent>: effort medium (unrecognized reasoning-effort "<value>")` with the value as read after quotes are removed.
  - Per agent the printed order is skip notices, model default, effort default; agents sorted by name. The Claude form always gets both `model:` and `effort:` lines.
- **Do not:** edit `tests/**`; change an exit code; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0, where the exclusion also lists S01's Restores IDs; targets R50-01, R50-02, R50-03, R50-04, R50-05, R50-06, R50-07; 7 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S05 - Update Script rejects an unparsable agent file

- **Kind:** build
- **Goal:** an agent file with missing or invalid frontmatter rejects the whole run as `invalid-agent` before any file changes.
- **Depends on:** S04
- **Tier:** delegate - one validation step ordered by an existing list
- **Review:** required - validation that guards an all-or-nothing install
- **Scenarios:** fixture: as S02
  - R48-11: Given `test-author.agent.md` has the frontmatter line `this line is not yaml`, when the Update Script runs, then stdout is exactly `update failed: invalid-agent: .github/agents/test-author.agent.md`, exit is 1, and the Home Repo has no new file
  - R48-12: Given an agent file `# demo agent\n` with no frontmatter, when it runs, then the same failure names that file
  - R48-13: Given an agent whose frontmatter has no closing `---`, when it runs, then the same failure names that file
  - R48-14: Given an earlier successful install and a source agent edited to be unparsable, when it runs again, then it fails as `invalid-agent`, every installed file and the manifest are byte-identical to before
  - R48-15: Given an unparsable agent and a committed file at an installed-file path in the Home Repo, when it runs, then the failure is `invalid-agent`, not `tracked-workflow-files`
- **Acceptance tests:** `tests/home-repo-workflow/p06-s05.test.mjs`
- **Files:** edit `scripts/update-home.mjs`
- **Patterns:** `scripts/update-home.mjs:226 - checkHome ordered checks returning { category, detail }`
- **Decisions:**
  - `scripts/update-home.mjs` defines `validateAgent(text)` (not exported; the P02 tests copy only that file) returning `null` or a reason string. Invalid when: the first line is not `---`; no later line is `---`; a frontmatter line is not blank, not a comment (`^\s*#`), not a top-level key (`^[A-Za-z][A-Za-z0-9_-]*:(\s.*)?$`), not an indented line (`^\s+\S`), and not a list item (`^-\s`); or a line's inline value starts with `[` and has no `]`, or starts with `"` or `'` and has no matching closing quote.
  - `checkHome` runs the check after `incomplete-source` and before `tracked-workflow-files`; it validates every `.github/agents/*.agent.md` in path order and returns `{ category: 'invalid-agent', detail: '.github/agents/<n>.agent.md' }` for the first failure.
  - `renderClaudeForm` no longer needs its unchanged-return path for invalid files; keep it for safety.
- **Do not:** edit `tests/**`; write any file before the check passes; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R48-11, R48-12, R48-13, R48-14, R48-15; 5 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S06 - README explains agent pins and the effort limitation

- **Kind:** build
- **Goal:** `README.md` states how to change an agent's model and effort for both Harnesses and the known limitation for models without effort support.
- **Depends on:** S05
- **Tier:** delegate - one README section with pinned markers
- **Review:** none
- **Scenarios:** fixture: the real `README.md`
  - R48-16: Given `README.md`, when the section `### Agent models and effort` is read, then it names `/tasks`, says Claude Code shows the pinned effort only when the model supports effort, and calls this a `known limitation`
  - R51-04: Given the same section, when read, then it names `reasoning-effort`, the command `node scripts\update-home.mjs <home>`, the `Agent pin:` and `Agent default:` notice lines, and says sessions already running keep their pins until the Harness restarts
- **Acceptance tests:** `tests/home-repo-workflow/p06-s06.test.mjs`
- **Files:** edit `README.md`
- **Patterns:** `README.md:37 - the Run the Update Script subsection style`
- **Decisions:**
  - Add the section `### Agent models and effort` directly after the `### Run the Update Script` subsection and before `### Launch a Harness`, under `## Home Repo (Recommended)`.
  - Content: edit `model` or `reasoning-effort` in `.github/agents/<n>.agent.md` of the `Personal.Workflow` source, then run the Update Script; Copilot uses the list as written; Claude Code uses the first Claude entry whose family is `Opus`, `Sonnet`, `Haiku`, or `Fable`; the default is `sonnet` at `medium`; the notices appear after `Files:`; the copy layout does not pin Claude Code agents.
- **Do not:** edit `tests/**`; touch other README sections; add dependencies.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R48-16, R51-04; 2 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S07 - Pins stay in one place and Core skills never override them

- **Kind:** build
- **Goal:** the shipped source keeps exactly the two pin fields, no skill line that dispatches a Workflow Core agent mentions a model or effort, and a real install prints no agent notice.
- **Depends on:** S06
- **Tier:** delegate - one wording edit; the other scenarios are expected to pass on the finished code
- **Review:** none
- **Scenarios:** fixture: the real source folder and a temp Home Repo
  - R48-17: Given every `.github/skills/**/*.md` and `.github/agents/*.agent.md`, when scanned for lines that contain `dispatch` and the name of a Workflow Core agent, then no such line contains the word `model` or `effort`
  - R49-02: Given each `.github/agents/*.agent.md`, when its frontmatter is read, then it has a `model` list and a `reasoning-effort` line and no `effort`, `claude-model`, or `tier` key
  - R49-03: Given the real Update Script run into a temp Home Repo, when it finishes, then every Home `.github/agents/*.agent.md` equals its source byte for byte
  - R50-08: Given the same run, when output is read, then no `Agent default:` and no `Agent pin:` line prints
- **Acceptance tests:** `tests/home-repo-workflow/p06-s07.test.mjs`
- **Files:** edit `.github/skills/pull-work/README.md`
- **Patterns:** `.github/skills/pull-work/README.md:19 - the paragraph to split`
- **Decisions:**
  - In `.github/skills/pull-work/README.md` the paragraph under `## Recommended Models` has one line that both says `/pull-work` dispatches `coder` and `test-author` and says `model` and `effort`. Move the sentence beginning `A strong mid-tier model at` onto its own line, separated by a blank line, keeping every word of it.
  - The real Update Script runs only against a temp Home Repo (`git init`, `AGENTS.md` with no `Stack:` line).
- **Do not:** edit other files; edit `tests/**`.
- **Done when:** `node --test --test-reporter=tap --test-skip-pattern="{regression-exclude}" "tests/home-repo-workflow/*.test.mjs"` exits 0; targets R48-17, R49-02, R49-03, R50-08; 4 target tests run
- **Stop and report if:** a file outside Files must change; a locked test looks wrong; the same failure after 3 attempts.

## S08 - Agent install test expects the Claude form, not a copy

- **Kind:** test-fix
- **Scope:** assertion
- **Goal:** the P04 install test expects what R48 and R49 now require: the Copilot form equals the source and the Claude form keeps the body with a Claude model alias.
- **Depends on:** none
- **Tier:** main - judgment about which expectation changes
- **Review:** none - writes tests only
- **Restores:** R43-03; finding: install behavior changed by R48-R49
- **Acceptance tests:** `tests/home-repo-workflow/p04-s04.test.mjs`
- **Files:** none
- **Decisions:** in R43-03, per agent: Home `.github/agents/<n>.agent.md` equals the source; Home `.claude/agents/<n>.agent.md` has the same body after the frontmatter and a `model: opus|sonnet|haiku|fable` line; the six-file list check stays.
- **Do not:** weaken any other R43 assertion.
- **Stop and report if:** another P04 expectation must change.