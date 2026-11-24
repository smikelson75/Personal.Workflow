# Personal Workflow

A portable, unified agentic development workflow—combining skills, custom agents, hooks, and deterministic checks—for taking software from an initial idea to verified, production-grade code.

## Purpose and Mission

This repository consolidates skills, agents, hooks, and tooling into a single repeatable workflow designed around five principles (see [AGENTS.md](./AGENTS.md)):

1. **Consistent delivery:** one structured process for building and evolving personal projects.
2. **Proportional rigor:** adapts automatically to the size and risk of a change (a lightweight `small` lane for 1–2 slice changes; a `standard` lane with locked tests and mutation gates for everything else).
3. **Token efficiency:** maximizes value delivered to production by spending tokens on decisions that land in kept artifacts, avoiding evidence no decision uses, and catching wrong decisions before they reach specs, tests, and code. Frontier-model reasoning goes to requirements, specs, and architecture; well-pinned implementation Slices go to cheaper (or local) models.
4. **Portability:** copy `.github/` (the **Workflow Core**) into any new or existing repository, and add only the stack-specific **Language Add-ons** you need.
5. **Agent autonomy with clear escalation:** agents advance the Plan on their own and stop only at planned Checkpoints or genuine Stalls, communicating state and reasoning transparently.

## Problems This Workflow Solves

| Common Failure Mode | How This Workflow Addresses It |
| --- | --- |
| **Requirement drift across sessions** | `/brain-storm` captures numbered `R#` Requirements in an append-only Session Chain and maintains a shared Glossary (`.workflow/language.md`) checked by `workflow-check`. |
| **Specs leaking implementation details** | `/behavior-spec` produces a black-box behavioral contract (rules, failure outcomes, examples, thresholds) with explicit boundary checks—leaving architecture to planning. |
| **Agents weakening tests to make code pass** | Acceptance tests are authored beforehand from Scenarios, committed, and locked. A pre-tool hook (`.github/hooks/locked-tests.json`) blocks edits to locked tests during implementation, and the Gate verifies the lock and Traceability. |
| **Expensive models wasted on routine coding** | `work-planner` breaks work into closed-world Cards. Routine `delegate` Cards run on the cheap `coder` agent against locked tests; only structural or judgment-heavy `main` Cards run in the main session. |
| **Constant "go ahead / run next" prompting** | `/pull-work` reads the Plan's `Next` state and executes planning, test authoring, coding, commits, Gates, and targeted code review continuously until a Checkpoint or Phase completion. |
| **Forgotten architectural reasoning** | Hard-to-reverse decisions are surfaced as ADR candidates during planning and recorded in `.workflow/adr/` via `adr-writer` so later Phases do not silently undo them. |
| **Inconsistent linting, testing, and mutation setups** | Optional Language Add-ons standardize code style, unit vs. black-box acceptance test layouts, and unit-only Stryker mutation gates per stack. |

## Quick Start

### 1. Prerequisites

- **Git**
- **Node.js LTS** (`22.12+` or `24`) on your `PATH` — required even for non-Node projects because the workflow's deterministic helper scripts (`workflow-check`, lock guard, traceability, and plan checks) run on Node.js with zero npm dependencies.

### 2. Copy the Workflow Core into Your Repository

From your target repository root (PowerShell):

```powershell
$workflowSrc = "C:\Projects\Personal.Workflow"

New-Item -ItemType Directory -Path .github\tools, .github\skills -Force | Out-Null

Copy-Item -Recurse "$workflowSrc\.github\agents"               ".github\agents"
Copy-Item -Recurse "$workflowSrc\.github\hooks"                ".github\hooks"
Copy-Item -Recurse "$workflowSrc\.github\skills\*"             ".github\skills"
Copy-Item -Recurse "$workflowSrc\.github\tools\workflow-check" ".github\tools\workflow-check"
Copy-Item          "$workflowSrc\.github\user-interaction.md"  ".github\user-interaction.md"
```

Optionally copy the **Language Add-ons** for your stack from [`language-addons/`](./language-addons/README.md) into `.github/skills/`.

### 3. Run the Workflow

- *(Optional)* **`/incubate`** — explore an early idea, external pattern, or hunch through conversation, web research, and plain-text ASCII visuals in a living note (`.workflow/incubations/<slug>.md`) before deciding whether it is worth building.
1. **`/brain-storm`** — refine your idea one question at a time into a finalized Session and Glossary in `.workflow/`.
2. **`/behavior-spec`** — turn the Session Chain into a black-box Behavior Spec at `.workflow/specs/<slug>-spec.md`.
3. **`/pull-work`** — plan the Phase, author failing acceptance tests, review once at the Phase Review Checkpoint, and let the workflow build, commit, gate, and review each Slice. Start a fresh session and run `/pull-work` again for the next Phase.

## Language Walkthroughs

Follow a complete, step-by-step setup and worked CLI build (`calc-repl`) for your stack:

- **C# / .NET:** [docs/walkthrough-csharp.md](./docs/walkthrough-csharp.md) — `.NET` solution layout (`Core`, `Cli`, `UnitTests`, `AcceptanceTests`), `dotnet-editorconfig`, and `stryker-dotnet`.
- **Node.js JavaScript:** [docs/walkthrough-node.md](./docs/walkthrough-node.md) — ESM Node.js setup, `eslint-javascript`, `vitest-javascript`, and `stryker-javascript`.
- **Node.js TypeScript:** [docs/walkthrough-typescript.md](./docs/walkthrough-typescript.md) — strict `tsc` (`~6.0.3`), `eslint-typescript`, `vitest-typescript` against `dist/`, and `stryker-typescript`.

## How the Workflow Flows

```text
Hunch ──▶ (optional) /incubate ──▶ /brain-storm ──▶ /behavior-spec ──▶ /pull-work (loads work-planner)
               │                        │                 │                  │
               ▼                        ▼                 ▼                  ├─ Plan & Setup Cards (optional: planner agent)
     .workflow/incubations/     .workflow/sessions/  .workflow/specs/        ├─ Write failing acceptance tests (test-author)
       (graduated only,         .workflow/language.md                        ├─ Phase Review Checkpoint (approve Cards & ADRs)
        explicit handoff)               │                                    ├─ Lock tests & write ADRs (adr-writer)
                                        └── checked by workflow-check        ├─ Build Slices (coder for delegate / main for main)
                                                                             ├─ Commit each Slice (conventional-commit rules)
                                                                             └─ Phase Gate (suite, traceability, lock, mutation)
                                                                                └─ code-review (Review: required Cards only)
```

## Recommended Models and Effort Settings

Every skill below lists recommended models from **Anthropic**, **OpenAI**, and **Google** along with its default reasoning effort. Click any skill name for detailed guidance on when to raise or lower effort.

### Core Skills

| Skill | Anthropic | OpenAI | Google | Default Effort | Raise Effort When |
| --- | --- | --- | --- | --- | --- |
| [`incubate`](./.github/skills/incubate/README.md) | `claude-opus-5.5` | `gpt-6.2-sol` | not recommended | `medium` | Cross-cutting architectural shifts or multi-stack workflow redesigns (`high`) |
| [`brain-storm`](./.github/skills/brain-storm/README.md) | `claude-opus-5.5` | `gpt-6.2-sol` | `gemini-4-neon` | `medium` | `large` ideas, deeper pushback, or conflict resolution (`high`) |
| [`behavior-spec`](./.github/skills/behavior-spec/README.md) | `claude-opus-5.5` | `gpt-6.2-sol` | `gemini-4-neon` | `medium` | Many requirements, security/destructive rules, or long Session Chains (`high`) |
| [`work-planner`](./.github/skills/work-planner/README.md) | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `medium` | Large or architecture-heavy first plan — use the `planner` agent (`claude-opus-5.5` / `gpt-6.1-sol` / `gemini-4-neon`) at `high` |
| [`pull-work`](./.github/skills/pull-work/README.md) | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `medium` | Complex `main`-tier Cards or multi-failure Gate triage (`high`) |
| [`adr-writer`](./.github/skills/adr-writer/README.md) | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `medium` | Inherits calling session during planning; use `high` for standalone high-impact architecture decisions |
| [`conventional-commit`](./.github/skills/conventional-commit/README.md) | `claude-haiku-5.5` | `gpt-6-luna` | `gemini-3.8-flash` | `low` | Large, mixed working trees that need careful commit splitting (`medium`) |

### Language Add-on Skills

See [`language-addons/README.md`](./language-addons/README.md) for stack details, outputs, and the shared mutation-testing protocol.

| Skill | Stack | Anthropic | OpenAI | Google | Default Effort | Raise Effort When |
| --- | --- | --- | --- | --- | --- | --- |
| [`dotnet-editorconfig`](./language-addons/csharp/dotnet-editorconfig/SKILL.md) | C# / .NET | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `low` | Amending a complex existing `.editorconfig` or `walkthrough` mode (`medium`) |
| [`stryker-dotnet`](./language-addons/csharp/stryker-dotnet/SKILL.md) | C# / .NET | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `medium` | Large survivor backlogs or compile-error mutants (`high`) |
| [`eslint-javascript`](./language-addons/node-javascript/eslint-javascript/SKILL.md) | Node.js JS | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `low` | Migrating legacy `.eslintrc.*` configs or `walkthrough` mode (`medium`) |
| [`vitest-javascript`](./language-addons/node-javascript/vitest-javascript/SKILL.md) | Node.js JS | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `low` | Custom multi-process or server test harnesses (`medium`) |
| [`stryker-javascript`](./language-addons/node-javascript/stryker-javascript/SKILL.md) | Node.js JS | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `medium` | Large survivor backlogs or debugging incomplete runs (`high`) |
| [`eslint-typescript`](./language-addons/node-typescript/eslint-typescript/SKILL.md) | Node.js TS | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `low` | Amending `tsconfig.json` strictness flags or legacy ESLint migrations (`medium`) |
| [`vitest-typescript`](./language-addons/node-typescript/vitest-typescript/SKILL.md) | Node.js TS | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `low` | Custom build-output or server test harnesses (`medium`) |
| [`stryker-typescript`](./language-addons/node-typescript/stryker-typescript/SKILL.md) | Node.js TS | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `medium` | Survivor backlogs or type-rejected mutants (`high`) |

## Deep-Dive Documentation

### Core Skills

- **[Incubate](./.github/skills/incubate/README.md)** — exploratory sense-making with plain-text ASCII visuals, comparison tables, web research, and living notes.
- **[Brain Storm](./.github/skills/brain-storm/README.md)** — guided requirements discovery, Session Chain, and Glossary maintenance.
- **[Behavior Spec](./.github/skills/behavior-spec/README.md)** — black-box behavioral contract generation and assumption review.
- **[Work Planner](./.github/skills/work-planner/README.md)** — Phase planning, vertical Slices, Cards, Tiers, Lanes, and Gate structure.
- **[Pull Work](./.github/skills/pull-work/README.md)** — single-command execution loop, automated commits, and locked-test safety nets.
- **[ADR Writer](./.github/skills/adr-writer/README.md)** — capturing approved, hard-to-reverse architecture decisions.
- **[Conventional Commit](./.github/skills/conventional-commit/README.md)** — commitlint-compatible Conventional Commits 1.0.0.

### Supporting Components

- **[Workflow Agents](./.github/agents/README.md)** — custom subagents (`repo-scout`, `coder`, `test-author`, `test-reviewer`, `planner`), model pins, and local-model configuration.
- **[workflow-check](./.github/tools/workflow-check/README.md)** — zero-dependency CLI for checking `.workflow/` structure, chains, vocabulary, and boundaries.
- **[Language Add-ons](./language-addons/README.md)** — stack-specific style, test harness, and Stryker mutation-testing skills.

### Core Reference Files

- **[AGENTS.md](./AGENTS.md)** — repository Purpose, Development Contract, and Mission.
- **[.workflow/language.md](./.workflow/language.md)** — canonical Glossary of workflow terms.
- **[.github/user-interaction.md](./.github/user-interaction.md)** — user-interaction rules: question formatting, turn discipline, and Checkpoint bundling.
