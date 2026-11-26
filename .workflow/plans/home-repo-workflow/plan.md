# home-repo-workflow plan

- Spec: [home-repo-workflow-spec.md](../../specs/home-repo-workflow-spec.md)
- Lane: standard
- Next: P04 S03, S04
- Tests locked: `4dbd17a`
- Oracle: `tests/home-repo-workflow`
- Phase base: `4dbd17a`
- Reconciled: `96cf5699d5c914ca684a96621759c3aaf1eed4bb`

## Current state
- stack: Node ES modules (`.mjs`, built-in `node:test`, zero dependencies, ADR 0001); the product is Workflow Core under `.github/`, `language-addons/`, `README.md`, and small Node scripts.
- harness: `node --test --test-reporter=tap "tests/home-repo-workflow/*.test.mjs"` - drives scripts through `.github/tools/workflow-core/support/harness.mjs` (`tempRepo().run`) and reads files through its `read`/`lines`; runs
- suite baseline: failing: `[R22-03] no file under skills, agents, or hooks names AGENTS.md` (`onboard-project` names it), `[R29-01] Glossary defines all 28 canonical terms with Slice and Card separate` (Glossary now has 35), `[R30-03] prior Session files in .workflow/sessions/ remain untouched` (`context-2026-11-25-1955.md` changed) - all locked by other completed plans
- mutation: unsupported for node - no mutation Language Add-on installed
- in place: locked-tests guard `.github/hooks/scripts/guard-locked-tests.mjs` finds the repository from the edited file (on-disk spelling) and denies with top-level and `hookSpecificOutput` fields; registered for Copilot CLI (`.github/hooks/locked-tests.json`) and Claude Code (`.claude/settings.json`, command `node .github/hooks/scripts/guard-locked-tests.mjs`, no matcher); `README.md` copy steps install both and note the trusted-folder rule; live-probed in both Harnesses (copy layout); Update Script `scripts/update-home.mjs` (install map, `manifest.json` under `git rev-parse --git-path personal-workflow`, `.git/info/exclude` managed block, no network); Launch Script `home/launch.mjs` + `home/launch.cmd` (session plugin `workflow-stack` with add-on skills and the guard hook, passed via `--add-dir`/`--plugin-dir`); no `code-review` agent; Claude Code sees skills and agents only under `.claude/` (live-probed: `.github/skills` and `.github/agents` are invisible) and refuses an agent whose `tools` resolve to no Claude Code name (the five agents list only Copilot names); skills reference Workflow Core as `.github/...` relative to the working folder
- gap to spec: R42, R43, R44, R45, R46, R47, Q-offline partial
- live-probed in both Harnesses (`-p` mode, Claude Code and Copilot CLI 1.0.116): `--add-dir <home>` lists the Home Repo's `.claude/skills` unprefixed; `--plugin-dir <dir>` (Claude plugin layout) lists plugin skills; Claude Code runs plugin `hooks/hooks.json` hooks; Copilot CLI plugin hooks and trusted-folder behavior are unconfirmed (untrusted folders skip repository hooks)

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
| P04 | Workflow Core parity across layouts and Harnesses | in progress | R42, R43 | [phase-04](phase-04.md) |
| P05 | Authoring skills, Coordination Playbook, README | planned | R44, R45, R46, R47, Q-offline partial | |

## Carry-forward
- P05: R44's `agents-md` skill (and the existing `onboard-project` skill) must name `AGENTS.md`, contradicting workflow-core R22 ("No file under `.github/` refers to `AGENTS.md`"); route to `behavior-spec` to amend R22 before planning P05. `[R22-03]` is a Known failure owned by P05.
- P05: `[R29-01]` (Glossary term count 28) and `[R30-03]` (prior Sessions untouched) are stale against the grown Glossary and Session Chain; route the glossary-alignment spec to `behavior-spec` so its plan reconciles before P05's gate. Both are Known failures owned by P05.
- P04/P05: the Copilot CLI loading plugin `hooks/hooks.json` hooks (guard in the Home layout) is unconfirmed; verify in a trusted folder.
- P05: README's copy block gains `.claude\skills` and `.claude\agents` copies in P04 (S05); P05's README rewrite keeps them.

## P04 slices

| # | Slice | Status |
|---|-------|--------|
| S01 | Launch Script exports `WORKFLOW_HOME` | completed |
| S02 | Core path rule in every skill and the planner agent | completed |
| S03 | Home layout resolves every Core path and leaves the Home Repo alone | ready |
| S04 | Agents dispatchable by name in both Harnesses; `code-review` agent | ready |
| S05 | README copy steps give Claude Code the skills and agents | ready |
