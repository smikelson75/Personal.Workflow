# Incubation - Onboard Project Skill

Status: incubating
Started: 2026-11-23
Updated: 2026-11-23

## Spark
- An untracked `.github/skills/onboard-project/` skill from an earlier workflow generation was added to the repo. We want to understand whether to convert it into an onboarding coordinator for the current `Workflow Core` and `Language Add-ons`, reshape its scope, or scrap it and solve the underlying problems elsewhere.

## Current Mental Model
- The core job to be done is getting any repository (`empty`, `scaffold`, or `mature` with older workflow artifacts) ready for development quickly without forgetting setup steps.
- Switching sessions between `/brain-storm`, `/behavior-spec`, and `/pull-work` is not a major pain point, so an all-in-one coordinator that runs product skills inline in one conversation is likely heavier than needed and works against how `Workflow Core` splits sessions and model effort.
- The real pain points split into two distinct problems:
  1. **Empty repos forgetting lint & mutation after scaffolding:** Upfront onboarding cannot configure lint or Stryker before a manifest/project exists. Tentatively, this gap belongs in `work-planner` (creating `Setup Card`s for installed lint, test-harness, and mutation `Language Add-ons` right after scaffolding).
  2. **Scaffolded and mature repos with older workflow artifacts:** This is the dominant real-world case (e.g., `C:\Projects\Scheduler` and `C:\Projects\ralph.loop`, which already have `.editorconfig`, `Directory.Build.props`, `stryker-config.json`, `AGENTS.md`, `docs/`, and legacy `.workflow/` files: `CONTEXT.md`, `UBIQUITOUS-LANGUAGE.md`, `prd/`, `plans/`). Nothing in `Workflow Core` currently owns auditing/repairing `Language Add-ons` and bridging legacy `.workflow/` or `docs/` files into the current format.

```text
Target Repo (empty / scaffold / mature)
  │
  ▼
1. Assess (stack, Git, Node, .workflow/ state)
  │
  ▼
2. Repo & Tool Readiness (Language Add-ons, lint, test harness, mutation, legacy .workflow/)
  │
  ▼
Who drives product artifacts?
  ├── All-in-one coordinator ──▶ Drives /brain-storm -> /behavior-spec -> /pull-work in one session
  └── Readiness + Handoff    ──▶ Gets repo clean, then hands off the exact next command for a fresh session
```

## What Fits vs. What Clashes

| Dimension | Draft `onboard-project` | Current `Workflow Core` & Take |
| --- | --- | --- |
| **Discovery & Spec** | Routes `brain-storm` (`CONTEXT.md`, `UBIQUITOUS-LANGUAGE.md`) -> `prd-writer` (`PRD.md`) | Replaced by `/brain-storm` (`Session Chain` + `.workflow/language.md` `Glossary`) -> `/behavior-spec` (`Behavior Spec`). |
| **Planning & Execution** | Routes `work-planner` (`PLAN.md`) -> `Engineer` -> `Review`, including empty-repo scaffolding | `/pull-work` already orchestrates `work-planner`, `Setup Card`s, `test-author`, `coder`, `adr-writer`, `Gate`, and `code-review`. |
| **Stack Tooling** | Routes `code-style` & `mutation-testing` protocols (`ts-eslint`, `stryker-js`, etc.) | Optional `Language Add-ons` (`dotnet-editorconfig`, `stryker-*`, `eslint-*`, `vitest-*`); test-harness add-ons are missing from the draft, and add-ons may not yet be copied into the target repo. |
| **Repo Instructions** | Normalizes `AGENT.md`/`AGENTS.md`/`copilot-instructions.md` and routes to `agent-instructions` | No `agent-instructions` skill exists in `Workflow Core`; root `AGENTS.md` is not part of `Workflow Core`. |
| **Verification Setup** | Routes to `deterministic-verification` (`jq`, Git Bash) | Tooling check is now Git + Node.js LTS (`22.12+`) running `workflow-check` and `.github/hooks/locked-tests.json`. |
| **Legacy `.workflow/` Triage** | Checks presence/currency of old files only | Biggest genuine gap: mature repos from older workflow versions have `docs/` and old `.workflow/` files (`CONTEXT.md`, `UBIQUITOUS-LANGUAGE.md`, `prd/`, `plans/`) that conflict with the current structure. |

## Tensions & Tradeoffs
- **Framing A (Focused `onboard-project` for Readiness + Migration)** vs. **Framing B (Scrap `onboard-project`)**:
  - Under **A**, `onboard-project` becomes a repo-readiness and migration entry point (prerequisites, installed `Language Add-ons`, instruction cleanup, legacy `.workflow/` triage) and hands off to `/brain-storm`, while `work-planner` owns post-scaffold lint/harness/mutation `Setup Card`s for empty repos.
  - Under **B**, `onboard-project` is removed; `work-planner` owns post-scaffold `Setup Card`s, developers invoke `Language Add-ons` directly, and legacy `.workflow/` handling is either manual or a dedicated migration step.
- **Simplest 80/20 baseline:** Fix the empty-repo gap in `work-planner` via automatic post-scaffold `Setup Card`s for installed `Language Add-ons`, and keep any onboarding skill strictly to mechanical readiness + legacy `.workflow/` triage with a clean handoff—no inline execution of `/brain-storm`, `/behavior-spec`, or `/pull-work`.
- **Assumptions to verify:**
  - Desired fate of legacy `.workflow/` and `docs/` files in repos like `Scheduler` and `ralph.loop`.
  - Whether copying/syncing `Workflow Core` and `Language Add-ons` into target repos (and updating them later) is in scope or stays outside the skill.
  - Whether `AGENTS.md` normalization is still needed in target repos.

## Sources
- none (grounded locally on `.github/skills/onboard-project/`, `README.md`, `.github/skills/work-planner/`, `language-addons/README.md`, and top-level directory inspection of `C:\Projects\Scheduler` and `C:\Projects\ralph.loop`).

## Open Threads
- What should happen to legacy `.workflow/` and `docs/` files (`CONTEXT.md`, `UBIQUITOUS-LANGUAGE.md`, old PRDs, old plans) when bringing a mature repo like `Scheduler` or `ralph.loop` onto the new workflow?
- How should `Workflow Core` and `Language Add-ons` be installed into a new repo and updated later when `Workflow Core` evolves?
- Should `work-planner` automatically add lint, test-harness, and mutation `Setup Card`s whenever Phase 1 scaffolds an empty repo?
- Should `onboard-project` still normalize competing instruction files (`AGENT.md`, `AGENTS.md`, `.github/copilot-instructions.md`), or drop that responsibility?

## Pick Up Here
- Answer what should happen to legacy `.workflow/` and `docs/` files (`CONTEXT.md`, `UBIQUITOUS-LANGUAGE.md`, old PRDs, old plans) when bringing an existing repo like `C:\Projects\Scheduler` or `C:\Projects\ralph.loop` onto the current `Workflow Core`—that decision will determine whether `onboard-project` becomes a focused readiness + migration skill or gets scrapped.
