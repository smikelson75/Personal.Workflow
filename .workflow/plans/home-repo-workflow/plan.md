# home-repo-workflow plan

- Spec: [home-repo-workflow-spec.md](../../specs/home-repo-workflow-spec.md)
- Lane: standard
- Next: P06 S02
- Tests locked: `39a80fb`
- Oracle: `tests/home-repo-workflow`
- Phase base: `16d8d09`
- Reconciled: `7ede1a4f0724923dcf7efbbc8d2c9e3727e92a83`

## Current state
- stack: Node ES modules (`.mjs`, built-in `node:test`, zero dependencies, ADR 0001); the product is Workflow Core under `.github/`, `language-addons/`, `README.md`, and small Node scripts.
- harness: `node --test --test-reporter=tap "tests/home-repo-workflow/*.test.mjs"` - drives scripts through `.github/tools/workflow-core/support/harness.mjs` (`tempRepo().run`) and reads files through its `read`/`lines`; runs
- suite baseline: green (313 tests, 0 fail)
- mutation: unsupported for node - no mutation Language Add-on installed
- in place: locked-tests guard `.github/hooks/scripts/guard-locked-tests.mjs` finds the repository from the edited file (on-disk spelling) and denies with top-level and `hookSpecificOutput` fields; registered for Copilot CLI (`.github/hooks/locked-tests.json`) and Claude Code (`.claude/settings.json`, command `node .github/hooks/scripts/guard-locked-tests.mjs`, no matcher); `README.md` copy steps install both and note the trusted-folder rule; live-probed in both Harnesses (copy layout); Update Script `scripts/update-home.mjs` (install map, `manifest.json` under `git rev-parse --git-path personal-workflow`, `.git/info/exclude` managed block, no network); Launch Script `home/launch.mjs` + `home/launch.cmd` (session plugin `workflow-stack` with add-on skills and the guard hook, passed via `--add-dir`/`--plugin-dir`); Home layout parity (P04): the Launch Script sets `WORKFLOW_HOME`; seven skills and `planner` carry a `Core paths:` line mapping `.github/...` to the Home install (ADR 0002); all six agents (`coder`, `planner`, `repo-scout`, `test-author`, `test-reviewer`, `code-review`) list Copilot and Claude Code tool names and install to `.claude/agents/`; README copy block also fills `.claude\skills` and `.claude\agents` (Claude Code sees only `.claude/`); live-probed in Home layout: Claude Code dispatches `repo-scout` and `code-review` by name
- not live-probed: /agents-md and /addon-author running in a Harness; the README's direct Claude Code command (--add-dir, --settings; both flags confirmed present in claude --help)
- gap to spec: R48, R49, R50, R51
- probed (Copilot CLI 1.0.116, Claude Code 2.1.332, `--add-dir`): Claude Code loads agents only from `<home>/.claude/agents` and accepts a list-form `model`; Copilot CLI loads both `<home>/.github/agents` and `<home>/.claude/agents` and, for the same agent name, uses the `.github/agents` file
- live-probed in both Harnesses (`-p` mode, Claude Code and Copilot CLI 1.0.116): `--add-dir <home>` lists the Home Repo's `.claude/skills` unprefixed; `--plugin-dir <dir>` (Claude plugin layout) lists plugin skills; Claude Code runs plugin `hooks/hooks.json` hooks; Copilot CLI runs plugin `hooks/hooks.json` hooks only in a trusted folder (`--trust-folder`; the guard denied a locked-test edit, and an untrusted folder skipped it); `WORKFLOW_HOME` is visible in the shell tool of both; Copilot CLI finds the Home Repo's `.claude/agents` under `--add-dir`; `/pull-work` completed a Card end to end in the Home layout (Launch Script, `delegate` Card, Gate, completion)

## Decisions pinned by the plan
- acceptance tests live in `tests/home-repo-workflow/` so the Oracle is disjoint from every other plan and nothing under it is installed into a Home Repo.
- P01 alone delivers R35, before any other requirement (Q-ordering).
- Update and Launch Script sources live outside `.github/` (planned in P02/P03), so Workflow Core stays free of `AGENTS.md` reads except where a spec amendment allows them.

## Phases

| # | Phase | Status | Covers | Detail |
|---|-------|--------|--------|--------|
| P01 | Guard both Harnesses in the copy layout | completed | R35, Q-ordering | [phase-01](phase-01.md) |
| P02 | Update Script fills a Home Repo offline | completed | R36, R37, Q-version-identity, Q-offline (update) | [phase-02](phase-02.md) |
| P03 | Launch Script with stack add-ons and Home-layout guard | completed | R38, R39, R40, R41, Q-offline (launch), Q-seamless-relay | [phase-03](phase-03.md) |
| P04 | Workflow Core parity across layouts and Harnesses | completed | R42, R43 | [phase-04](phase-04.md) |
| P05 | Authoring skills, Coordination Playbook, README | completed | R44, R45, R46, R47, Q-offline | [phase-05](phase-05.md) |
| P06 | Claude Code agent pins from one edit | in progress | R48, R49, R50, R51 | [phase-06](phase-06.md) |

## P06 slices

| # | Slice | Status |
|---|-------|--------|
| S01 | Update Script tests expect the two agent forms | completed |
| S02 | Update Script installs the Copilot form and the Claude form | ready |
| S03 | Update Script names skipped Claude entries | ready |
| S04 | Update Script applies and names the shipped default | ready |
| S05 | Update Script rejects an unparsable agent file | ready |
| S06 | README explains agent pins and the effort limitation | ready |
| S07 | Pins stay in one place and Core skills never override them | ready |
| S08 | Agent install test expects the Claude form, not a copy | completed |

