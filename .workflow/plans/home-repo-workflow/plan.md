# home-repo-workflow plan

- Spec: [home-repo-workflow-spec.md](../../specs/home-repo-workflow-spec.md)
- Lane: standard
- Next: P02 S04
- Tests locked: `fd4ab6e`
- Oracle: `tests/home-repo-workflow`
- Phase base: `d6846dd`
- Reconciled: `96cf5699d5c914ca684a96621759c3aaf1eed4bb`

## Current state
- stack: Node ES modules (`.mjs`, built-in `node:test`, zero dependencies, ADR 0001); the product is Workflow Core under `.github/`, `language-addons/`, `README.md`, and small Node scripts.
- harness: `node --test --test-reporter=tap "tests/home-repo-workflow/*.test.mjs"` - drives scripts through `.github/tools/workflow-core/support/harness.mjs` (`tempRepo().run`) and reads files through its `read`/`lines`; runs
- suite baseline: failing: `[R22-03] no file under skills, agents, or hooks names AGENTS.md` (`onboard-project` names it), `[R29-01] Glossary defines all 28 canonical terms with Slice and Card separate` (Glossary now has 35), `[R30-03] prior Session files in .workflow/sessions/ remain untouched` (`context-2026-11-25-1955.md` changed) - all locked by other completed plans
- mutation: unsupported for node - no mutation Language Add-on installed
- in place: locked-tests guard `.github/hooks/scripts/guard-locked-tests.mjs` finds the repository from the edited file (on-disk spelling) and denies with top-level and `hookSpecificOutput` fields; registered for Copilot CLI (`.github/hooks/locked-tests.json`) and Claude Code (`.claude/settings.json`, command `node .github/hooks/scripts/guard-locked-tests.mjs`, no matcher); `README.md` copy steps install both and note the trusted-folder rule; live-probed in both Harnesses (copy layout); no Update or Launch Script, no `code-review` agent; skills reference Workflow Core as `.github/...` relative to the working folder
- gap to spec: R36, R37, R38, R39, R40, R41, R42, R43, R44, R45, R46, R47, Q-seamless-relay, Q-version-identity, Q-offline

## Decisions pinned by the plan
- acceptance tests live in `tests/home-repo-workflow/` so the Oracle is disjoint from every other plan and nothing under it is installed into a Home Repo.
- P01 alone delivers R35, before any other requirement (Q-ordering).
- Update and Launch Script sources live outside `.github/` (planned in P02/P03), so Workflow Core stays free of `AGENTS.md` reads except where a spec amendment allows them.

## Phases

| # | Phase | Status | Covers | Detail |
|---|-------|--------|--------|--------|
| P01 | Guard both Harnesses in the copy layout | completed | R35, Q-ordering | [phase-01](phase-01.md) |
| P02 | Update Script fills a Home Repo offline | in progress | R36, R37, Q-version-identity, Q-offline (update) | [phase-02](phase-02.md) |
| P03 | Launch Script with stack add-ons and Home-layout guard | planned | R38, R39, R40, R41, Q-offline (launch), Q-seamless-relay | |
| P04 | Workflow Core parity across layouts and Harnesses | planned | R42, R43 | |
| P05 | Authoring skills, Coordination Playbook, README | planned | R44, R45, R46, R47 | |

## P02 slices

| # | Slice | Status |
|---|-------|--------|
| S01 | Update installs and mirrors Workflow Core with a content version | completed |
| S02 | Update rejects unsafe or invalid targets before writing | completed |
| S03 | A failed write leaves an incomplete marker | completed |
| S04 | Installed files stay out of git status | ready |
| S05 | Version identity and offline operation hold on this repository | ready |
| S06 | R37-03 fixture keeps a tracked file under .claude/skills | completed |

## Carry-forward
- P03: `.claude/settings.json` runs `node .github/hooks/scripts/guard-locked-tests.mjs` relative to the session folder (Claude Code resets Bash to the project root, so the copy layout is safe); in the Home layout the Project Repo has no guard script, so the Home-layout registration must resolve the guard from the Home Repo.
- P05: R44's `agents-md` skill (and the existing `onboard-project` skill) must name `AGENTS.md`, contradicting workflow-core R22 ("No file under `.github/` refers to `AGENTS.md`"); route to `behavior-spec` to amend R22 before planning P05. `[R22-03]` is a Known failure owned by P05.
- P05: `[R29-01]` (Glossary term count 28) and `[R30-03]` (prior Sessions untouched) are stale against the grown Glossary and Session Chain; route the glossary-alignment spec to `behavior-spec` so its plan reconciles before P05's gate. Both are Known failures owned by P05.
