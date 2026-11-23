# Incubation - Home Repo Workflow

Status: incubating
Started: 2026-11-22
Updated: 2026-11-22

## Spark
- Explored adopting Matt Pocock's Home Repo Pattern so `Workflow Core` skills and agents stay put in one place while project repositories swap in and out, without breaking multi-stack `Language Add-on` support or creating nested-repo git chaos.
- Added three real-world constraints during exploration: multi-repo sessions from one hub are a definite goal; the setup must stay portable across personal and work machines; and at work we actively **relay back and forth between Claude Code and VS Code Copilot on the same work** (primarily by role/phase due to quotas, rate limits, and model preferences, with occasional mid-Card or mid-conversation quota hits).

## Current Mental Model
- Separate the **reusable Workflow Engine** from **environment-specific Home Repos** and **sibling project repos** in a 3-layer architecture, using a **conservative 80/20 Home Repo Sync model** (no agent plugin loader) designed for **cross-harness relay**:
  1. **Layer 1 — `Personal.Workflow` (Single Local Clone + Lightweight Sync):**
     - Keep `Personal.Workflow` as one local clone per machine—the single source of truth for `Workflow Core` (`skills/`, harness-specific `agents/`, harness-specific `hooks/`, scripts, and on-demand `Language Add-on` packs).
     - Instead of packaging as an Agent Plugin, a small local sync script copies/links the right files into each Home Repo (`work-home` / `personal-home`) after `git pull`. This avoids plugin caching in VS Code, `/<plugin>:` command prefixes in Claude Code, and rewriting existing `.github/` script paths.
     - Keep the harness-agnostic agent prompt bodies once plus a small per-harness frontmatter config (`model`, `tools`, filename) so cheap-tier delegation works in both harnesses without prompt drift.
     - Keep `Language Add-on` stack packs outside the always-loaded `skills/` catalog and route to them via hybrid detection (marker files by default + explicit `AGENTS.md` override for greenfield or polyglot repos) plus a single thin router skill.
  2. **Layer 2 — Thin Environment Home Repos (`personal-home`, `work-home`):**
     - Separate small git repos holding sibling repo pointers in `AGENTS.md`, shared environment docs, and cross-repo ideation/contracts—keeping private work pointers completely separate from personal repos.
     - **Instruction files (`AGENTS.md` + 1-line `CLAUDE.md`):** Use `AGENTS.md` as the single source of truth plus a 1-line `CLAUDE.md` containing `@AGENTS.md`. Even though Claude Code v2.1.277+ natively reads `AGENTS.md` as a fallback, keeping the 1-line `CLAUDE.md` (`@AGENTS.md`) is deduplicated by Claude Code (never loaded twice), works with `--add-dir` + `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` (where native `AGENTS.md` does *not* load), and prevents `CLAUDE.local.md` from silently shadowing `AGENTS.md`. In VS Code, setting `"chat.useClaudeMdFile": false` in `.vscode/settings.json` keeps even that 1-line file out of Copilot context.
     - **Zero-duplicate synced layout (tentative, pending quick check):** Sync one shared `skills/` folder natively read by both harnesses (e.g., `.claude/skills/`), separate `agents/` (`.github/agents/` for Copilot, `.claude/agents/` for Claude) with `".claude/agents": false` in VS Code `chat.agentFilesLocations`, and separate hooks (`.github/hooks/` for Copilot, `.claude/settings.json` for Claude). Gitignore the synced workflow folders inside the Home Repo.
  3. **Layer 3 — Sibling Project Repos:** Normal independent git repositories sitting beside the Home Repo on disk (no nested `.git` folders inside the Home Repo). Each repo owns its own `Workflow Folder` (`.workflow/`), repo-specific `AGENTS.md`, git history, branches, and PRs.
- **Cross-repo & cross-harness execution model ("Coordinate in Home, Execute per Repo, Relay via `.workflow/`"):**
  - Use the Home Repo session to incubate, brain-storm, and agree cross-repo contracts; execute `Plan`, `Phase`, `Card`, `Oracle`, `Tests locked`, and `Gate` inside each target repo's own `.workflow/` so repos remain independently testable and mergeable.
  - Treat `.workflow/` + git commits as the **relay baton** between Claude Code and VS Code Copilot—no chat history needs to cross harnesses and **zero new handoff files** are needed.
  - For occasional mid-task quota hits: conversations already pause cleanly (`"pause"` in `incubate`, `draft` `Session` in `brain-storm`), and [pull-work](../../.github/skills/pull-work/SKILL.md) already supports interrupted mid-Card resume (`Next: running SNN` accepts dirty `plan.md` + that slice's `Files` and resumes Dispatch via `Done when`, or `git restore` gives a clean rerun).

```mermaid
flowchart TB
    subgraph Engine["Layer 1: Personal.Workflow (Single Local Clone)"]
        Src["skills/ + agents-src/ + hooks/<br/>+ on-demand Language Add-on packs"]
        Sync["Tiny local sync script<br/>(no plugin loader or cache)"]
        Src --> Sync
    end

    subgraph Home["Layer 2: work-home / personal-home"]
        Docs["AGENTS.md + CLAUDE.md (@AGENTS.md)"]
        SharedSkills[".claude/skills/ (1 shared copy)"]
        CopilotFiles[".github/agents/ + .github/hooks/<br/>.vscode/settings.json"]
        ClaudeFiles[".claude/agents/ + .claude/settings.json"]
    end

    subgraph Harnesses["Active Relay on Same Machine"]
        VSC["VS Code Copilot"]
        CC["Claude Code"]
    end

    Repo["Layer 3: Sibling Project Repo<br/>.git + .workflow/ baton"]

    Sync --> SharedSkills
    Sync --> CopilotFiles
    Sync --> ClaudeFiles
    VSC --> Home
    CC --> Home
    Home -. "sibling pointer" .-> Repo
```

```mermaid
flowchart LR
    A["Harness A (e.g. Claude Code)<br/>plan / spec / Card N"] --> Baton[".workflow/ + git commit<br/>(or Next: running SNN + git diff)"]
    Baton --> B["Harness B (e.g. VS Code Copilot)<br/>/pull-work -> next Card or resume"]
    B --> Gate["Per-repo Oracle + Gate<br/>hybrid stack pack"]
```

## What Fits vs. What Clashes

| Dimension | External / Initial Idea | Our Context & Take |
| --- | --- | --- |
| **Repo physical layout** | Home Repo holds `AGENTS.md` pointers to **sibling** repos on disk (cloning on demand if missing). | **Fits cleanly.** Sibling pointers eliminate nested-`.git` confusion and keep each project's branches, worktrees, and PRs intact. |
| **Where skills live & sync** | Shared skills live in the Home Repo; earlier explored dual-manifest Agent Plugins. | **Leaning conservative 80/20 sync (no plugins).** Pressure test showed VS Code collides on dual-manifest `agents/` and caches local plugins. With only two Home Repos (`work-home` / `personal-home`), a tiny sync script from one local `Personal.Workflow` clone gives live updates, zero `/pw:` prefixes, and keeps `.github/` script paths working. |
| **Dual-harness custom agents** | Single `.claude-plugin/plugin.json` risked frontmatter collisions; VS Code also loads `.claude/agents` by default. | **Separate harness folders + VS Code override (tentative).** Emit `.github/agents/` for Copilot and `.claude/agents/` for Claude from one prompt source, keep one shared `skills/` folder (`.claude/skills/`), and set `".claude/agents": false` in VS Code `chat.agentFilesLocations` (needs a quick verification check that Copilot Agent Host honors it). |
| **Instruction files (`AGENTS.md` / `CLAUDE.md`)** | Claude Code v2.1.277+ natively reads `AGENTS.md` as a fallback when no `CLAUDE.md` exists. | **Keep `AGENTS.md` + 1-line `CLAUDE.md` (`@AGENTS.md`).** Claude deduplicates it (never loads twice), it works with `--add-dir` sibling repos (where native `AGENTS.md` doesn't load) and older builds, and `"chat.useClaudeMdFile": false` keeps even that line out of VS Code context. |
| **Mid-task quota switches** | Considered adding a handoff scratchpad file for interrupted Cards. | **Zero new files needed.** [pull-work](../../.github/skills/pull-work/SKILL.md) already permits `Next: running SNN` with dirty `plan.md` + slice `Files` and resumes Dispatch from `Done when` (with `git restore` as an easy reset). Conversations already pause via `incubate` / `draft` `Session`. |
| **Multi-stack `Language Add-on`s** | Not addressed by Matt's pattern; `Personal.Workflow` currently copies only one stack's add-ons per repo. | **Reshaped.** Keep [language-addons/](../../language-addons) as on-demand stack packs outside auto-loaded `skills/`. [mutation-addon.mjs](../../.github/skills/work-planner/scripts/mutation-addon.mjs) already filters by `- **Mutation stack:**`, though it currently scans `.github/skills/` and `cwd`. |
| **Where `.workflow/` lives** | Shared docs live in the Home Repo; repo-specific docs stay in each child repo. | **Per-repo execution.** Keep `Plan`, `Oracle`, `Tests locked`, and `Gate` inside each sibling repo's `.workflow/`, using the Home Repo only to coordinate cross-repo thinking and contracts. |
| **Existing `cwd` & `.github/` assumptions** | Skills, hooks, and scripts assume `cwd` is the target project repo and `Workflow Core` is copied into `.github/`. | **Concrete clashes to adapt:** [guard-locked-tests.mjs](../../.github/hooks/scripts/guard-locked-tests.mjs) uses `cwd`'s git root and skips `..` paths (silently bypassing sibling `Oracle` locks!); [workspace.mjs](../../.github/tools/workflow-check/src/workspace.mjs) walks up from `cwd`; [pull-work](../../.github/skills/pull-work/SKILL.md) hardcodes `.github/skills/pull-work/scripts/...`, `.github/tools/workflow-core/scripts/trace.mjs`, `.github/agents/coder.agent.md`, and `.github/user-interaction.md`, and dispatches Copilot's built-in `code-review` agent. |
| **VS Code multi-root `.code-workspace`** | Considered as an alternative to Home Repo pointers. | **Weak foundation today.** Official VS Code docs do not guarantee cross-root skill/hook sharing, and the Agents window does not yet support multi-root sessions. |

## Tensions & Tradeoffs
- **Why we stepped back from Agent Plugins (80/20 tradeoff):** After the pressure test broke single-folder dual-manifest isolation and live uncached updates in VS Code, plugins mainly bought physical harness isolation and availability when opening standalone repos outside a Home Repo—at the cost of generating two plugin roots, `/pw:` slash-command prefixes, plugin-relative path rewrites, and VS Code cache refreshes. If we ever revisit plugins, VS Code's experimental `chat.pluginLocations` setting is worth checking for live uncached loading.
- **Assumptions to verify (80/20 zero-duplicate isolation):**
  - Confirm VS Code's Copilot Agent Host harness honors `chat.agentFilesLocations: { ".claude/agents": false }` so `.claude/agents/` is not loaded alongside `.github/agents/`. *(Note: `chat.agentSkillsLocations` is deprecated, which is why keeping only **one** shared `skills/` folder—e.g. `.claude/skills/`—is safer than maintaining two copies.)*
  - Confirm Copilot does not double-fire `.claude/settings.json` hooks alongside `.github/hooks/` when both exist in the Home Repo (official Copilot CLI docs note Copilot reads `.claude/settings.json` hooks).
- **Silent `Oracle` bypass on sibling edits:** [guard-locked-tests.mjs](../../.github/hooks/scripts/guard-locked-tests.mjs) currently resolves git root from `cwd` and ignores any edited path starting with `..`. Under a Home Repo, the hook must resolve the git root from the *edited file's directory* instead.
- **Sibling `AGENTS.md` loading:** Neither VS Code Copilot nor Claude Code's native `AGENTS.md` fallback auto-loads `AGENTS.md` from sibling repos outside `cwd` (unless a sibling has `CLAUDE.md` with `@AGENTS.md` and `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`). The Home Repo `AGENTS.md` / skills should instruct agents to read a sibling repo's `AGENTS.md` when entering it.
- **`code-review` agent parity:** `pull-work`'s `Review` step dispatches `code-review` (a built-in agent in Copilot CLI/VS Code). Claude Code needs either a 6th synced agent in `.claude/agents/` or a clean main-session review fallback so phase-end reviews stay identical across harnesses.
- **Harness-local & synced file hygiene:** Synced `.github/` and `.claude/` folders in the Home Repo must be gitignored cleanly, and any harness-local files (e.g. `.claude/settings.local.json`, `.vscode/` tweaks) should stay gitignored so switching harnesses never trips `pull-work`'s clean-tree check.
- **Cross-repo `Session Chain` -> per-repo `Plan` handoff:** Still needs a crisp convention for how a Home Repo `brain-storm` or contract links cleanly into two child repos' `.workflow/plans/` without confusing `workflow-check`.

## Sources
- [The Home Repo Pattern (Matt Pocock / AI Hero)](https://www.aihero.dev/the-home-repo-pattern) — Proposes one Home Repo holding shared skills, `AGENTS.md` sibling-repo pointers, and shared docs; validated keeping child repos as siblings rather than nested git repos and motivated git-versioned sharing over `~/.claude/skills`.
- [VS Code AI Settings Reference](https://code.visualstudio.com/docs/agents/reference/ai-settings) — Documents `chat.agentFilesLocations` (default includes `.claude/agents`), deprecated `chat.agentSkillsLocations`, `chat.useClaudeMdFile`, `chat.useClaudeHooks`, and experimental `chat.pluginLocations`.
- [VS Code Agent Plugins](https://code.visualstudio.com/docs/agent-customization/agent-plugins.md) & [Agent Plugin Reference](https://code.visualstudio.com/docs/agents/reference/agent-plugin-reference.md) — Confirms VS Code supports Git and local-folder plugin installs, prioritizes root `plugin.json` (Agent Plugins 1.0 `$schema`) over `.claude-plugin/plugin.json`, isolates Copilot-specific agents/hooks under `com.github.copilot/`, and supports `${PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_ROOT}`.
- [VS Code Agent Harnesses](https://code.visualstudio.com/docs/agents/run/agent-harnesses.md), [Hooks](https://code.visualstudio.com/docs/agent-customization/hooks), & [Agents Window](https://code.visualstudio.com/docs/agents/run/agents-window.md) — Confirms VS Code Copilot shares runtime/hook semantics with Copilot CLI, supports PascalCase `PreToolUse`, and does not yet support multi-root sessions in the Agents window.
- [GitHub Copilot CLI Hooks Reference](https://docs.github.com/en/copilot/reference/hooks-reference) & [CLI Command Reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) — Confirms Copilot CLI reads `.github/skills`, `.claude/skills`, and `.agents/skills`, supports `--add-dir`, reads repo `.claude/settings.json` hooks (duplicate-firing caveat), and supports Claude-style `PreToolUse` matcher/payload semantics.
- [Claude Code Plugin Manifest Reference](https://code.claude.com/docs/en/plugins-reference.md) & [Plugin Loading Reference](https://code.claude.com/docs/en/plugins/loading.md) — Confirms Claude Code reads `.claude-plugin/plugin.json`, namespaces components as `/<name>:<skill>` and `<name>:<agent>`, supports live uncached local folder loading via `CLAUDE_CODE_PLUGIN_DIRS` / `--plugin-dir`, provides `claude plugin validate`, and documents enterprise policy checks via `/status`.
- [Claude Code Skills](https://code.claude.com/docs/en/skills.md), [Memory / AGENTS.md](https://code.claude.com/docs/en/memory.md#agents-md), & [Permissions & Additional Directories](https://code.claude.com/docs/en/permissions.md) — Confirms Claude Code v2.1.277+ natively reads `AGENTS.md` as a fallback (configurable in `/config`), deduplicates `@AGENTS.md` inside `CLAUDE.md` without double-loading, does *not* load `AGENTS.md` from `--add-dir` directories (only `CLAUDE.md`), and grants sibling access via `--add-dir` / `permissions.additionalDirectories`.
- [Claude Code now supports AGENTS.md Natively (DEV Community / Valyu AI)](https://dev.to/valyuai/claude-code-now-supports-agentsmd-natively-heres-how-it-actually-works-5nl) — Practical walkthrough of Claude Code's four `/config` Project instructions modes and monorepo/fallback tradeoffs (cross-checked against official Claude Code Memory docs).

## Pressure Test Results (2026-11-22, Work Machine)
Ran [work-policy-dual-harness-pressure-test.md](../../docs/research/work-policy-dual-harness-pressure-test.md) across Claude Code and VS Code Copilot on the work machine:
- **Passed:**
  - **Org policy:** Local plugins are allowed in both Claude Code (`claude plugin validate` + `--plugin-dir`, no blocking enterprise restrictions observed) and VS Code Copilot (installed via `Chat: Install Plugin from Source` under User plugins, toggleable).
  - **Shared skill discovery:** `echo-check` worked in both (`pw-probe:echo-check` in Claude Code; `/echo-check` in VS Code Copilot, though VS Code didn't list it in `/` autocomplete).
  - **Sibling-repo editing & cross-harness relay:** Both harnesses read/edited `../dummy-sibling` (VS Code prompted `"Allow reading file outside of workspace"`) and relayed cleanly via the working tree with **zero** untracked config clutter (`git status --porcelain` stayed clean).
  - **Hooks:** `PreToolUse` fired in both harnesses.
- **Assumptions broken (design-changing findings):**
  1. **Dual-manifest agent collision in VS Code:** VS Code Copilot reads Claude's `agents/*.md` and chose `agents/probe-scout.md` *over* `com.github.copilot/agents/probe-scout.agent.md` when both lived in the same plugin folder. We cannot ship both `agents/` and `com.github.copilot/agents/` in one folder — we need either **one shared agent format** or **separate generated/dist plugin roots** per harness (or a simpler non-plugin layout).
  2. **VS Code caches local plugins:** Copilot runs local plugins from a **cached copy**, not live from the source folder. Hooks must use stdin payload paths / `process.cwd()` (never `import.meta.url`-relative paths to reach source/workspace files), and `Model A-Local`'s "zero cache drift on `git pull`" benefit applies to Claude Code (`--plugin-dir`), not VS Code Copilot.

## Open Threads
- **Verify zero-duplicate VS Code isolation (quick probe):** Confirm `chat.agentFilesLocations: { ".claude/agents": false }` prevents the Copilot Agent Host from loading `.claude/agents/` alongside `.github/agents/`, and confirm `.claude/settings.json` hooks do not double-fire in VS Code Copilot alongside `.github/hooks/`.
- **Sibling-aware scripts & `code-review` parity:** Adapt `guard-locked-tests.mjs` to resolve git root from the edited file's directory, check remaining `cwd` assumptions in `workflow-check` / `pull-work`, and decide how Claude Code handles `pull-work`'s `Review` step (`code-review` agent parity).
- **Cross-repo spec handoff:** Decide how a cross-repo `brain-storm` / contract in a Home Repo connects cleanly to per-repo `Plan`s without breaking `workflow-check` traceability.
- **Polyglot repo stack packs:** Confirm how a single repo containing multiple stacks (e.g., `api/` C# + `web/` TS) binds each stack pack to its subdirectory inside `work-planner` and `Gate`.

## Pick Up Here
- Resume `/incubate` on the **conservative 80/20 Home Repo Sync** model: first verify whether VS Code Copilot honors `chat.agentFilesLocations: { ".claude/agents": false }` and avoids double-firing `.claude/settings.json` hooks when `.github/` and `.claude/` coexist in a Home Repo; then resolve the remaining Open Threads (sibling-aware `guard-locked-tests.mjs` / `code-review` parity, cross-repo spec handoff, and polyglot stack packs) before deciding whether to graduate into `/brain-storm`.
