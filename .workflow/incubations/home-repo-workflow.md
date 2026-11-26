# Incubation - Home Repo Workflow

Status: graduated
Started: 2026-11-22
Updated: 2026-11-25

## Spark
- Explored adopting Matt Pocock's Home Repo Pattern so `Workflow Core` skills, agents, and hooks live in one place while project repositories swap in and out, without nested-repo git chaos or breaking `Language Add-on` support.
- Real-world constraints: multi-repo work from one hub is a definite goal; the setup must stay portable across personal and work machines; and at work we relay the same work back and forth between Claude Code and Copilot (mostly by role/phase due to quotas and model preferences, occasionally mid-Card).
- Most work repos are single-stack; the real pressure is a many-to-many sibling graph (3 API repos sharing 1 writable transactional DB repo, plus an API reading a read-only reporting DB repo).

## Current Mental Model
- **Three layers, CLIs only.** Targets are Claude Code CLI and Copilot CLI. VS Code is only an optional viewer (`/diff` in either CLI covers "see what changed"); the VS Code Agent Host is out of scope.
  1. **`Personal.Workflow`** — one local clone per machine; source of truth for `Workflow Core` and `Language Add-on` packs. A small sync script copies the right files into each Home Repo (no Agent Plugins).
  2. **Home Repos (`work-home`, `personal-home`)** — thin git repos holding `AGENTS.md` (+ 1-line `CLAUDE.md` with `@AGENTS.md`), sibling pointers with roles (co-changed, read-only reference, peer-impact), shared environment docs including the coordination playbook, and the synced (gitignored) workflow files.
  3. **Sibling project repos** — normal independent repos beside the Home Repo. Each writable repo owns its `.workflow/`, `Plan`, `Oracle`, `Tests locked`, and `Gate`. Every `Card` runs inside its own repo.
- **Execution shape (verified in both CLIs on the personal machine):** launch the CLI *in the sibling repo* with the Home Repo attached, so existing `cwd` assumptions keep working while skills, agents, and the hook come from Home.
- **Relay baton:** `.workflow/` + git commits; no new handoff files. `pull-work` already resumes an interrupted `Card`.
- **Coordination is a playbook, not tooling:** needs-first ordering using existing skills (API `brain-storm` -> `behavior-spec` -> DB `brain-storm` from the API spec + a targeted read-only grep of peer APIs for shared/cross-schema tables -> per-repo `work-planner`/`pull-work`). Confirmed: DB changes at work are always driven by an API need.
- **Oracle backstop:** the `Gate`'s lock verification is the accepted backstop when the hook does not run (e.g. an untrusted Copilot folder). No trust detection.

```text
 cd <sibling repo>
   claude  --add-dir <home> --settings <home>\.claude\settings.json
   copilot --add-dir <home>                 (folder must be trusted)

 <home>\.claude\skills\        shared by both CLIs
 <home>\.claude\settings.json  one shared PreToolUse hook
                               - deny = top-level fields + hookSpecificOutput
                               - git root from the edited file, not cwd
 <home>\.github\agents\        Copilot copy (wins on same name)
 <home>\.claude\agents\        Claude copy (+ code-review, Claude only)
 <sibling>\.workflow\          Plan / Oracle / Gate per repo
```

```text
 Needs-first playbook (existing skills, no new tooling)
 API repo  /brain-storm -> /behavior-spec   (limits, required, relationships)
     |
     v
 DB repo   /brain-storm from ../api/.workflow/specs/<slug>-spec.md
           + grep peer APIs (read-only) for shared / cross-schema tables
     |
     v
 DB repo -> API repo(s): /work-planner -> /pull-work  (each in its own repo)
```

## What Fits vs. What Clashes

| Dimension | External / Initial Idea | Our Context & Take |
| --- | --- | --- |
| **Repo layout** | Home Repo with `AGENTS.md` pointers to sibling repos | **Fits.** Siblings, never nested; each repo keeps its own history, branches, and PRs. |
| **Distribution** | Agent Plugins (dual manifest) | **Rejected.** VS Code collided on dual-manifest agents and cached plugins; a tiny sync script from one clone is simpler. |
| **Where sessions run** | Sessions run in the Home Repo | **Run in the sibling, Home attached.** Verified skills, agents, and hook load in both CLIs via `--add-dir` (Claude also needs `--settings`). |
| **Hook** | `.github/hooks/` (Copilot) only | **One `.claude/settings.json`.** Both CLIs run it with Claude-shaped payloads. Deny output must carry both formats; Copilot reports the *Home* dir as `cwd` under `--add-dir`. |
| **Agents** | One agent format | **Ship both formats per name.** Copilot runs `.github/agents` over `.claude/agents`; Claude-only names leak into Copilot; Copilot's built-in `code-review` beats `.claude/agents/code-review.md`, which Claude runs. |
| **Cross-repo coordination** | Home Repo coordinates specs and plans | **Playbook only (Level 1).** Root cause of past DB fixes was ordering (schema before consumer needs), not tooling. Contract files / cross-repo traceability deferred. |
| **Editor** | VS Code multi-root / Agent Host | **Out of scope.** Single-repo VS Code use only as a viewer; CLIs have `/diff`. |

## Tensions & Tradeoffs
- **Simplest 80/20 baseline:** instead of attaching Home, the sync script copies `Workflow Core` into every sibling (hidden via `.git/info/exclude`) and the CLIs launch plainly. Buys: no launch flags, probably no hook-`cwd` quirk. Costs: N copies per machine and local-only files inside team repos. Current leaning is Home-attached; `brain-storm` should weigh both explicitly.
- **Silent launch mistakes:** Claude with `--add-dir` but without `--settings` loads skills but no hook. A launch wrapper should make the correct launch the easy one; the `Gate` remains the backstop.
- **Existing bug outside this idea:** `guard-locked-tests.mjs` emits only top-level `permissionDecision`, which Claude Code ignores (verified: file overwritten). Claude Code is unguarded today; worth a small fix ahead of the Home Repo work.
- **Hardcoded paths:** `pull-work` references `.github/skills/...`, `.github/tools/...`, `.github/agents/coder.agent.md`, and `.github/user-interaction.md` relative to `cwd`; these break when cwd is a sibling and Workflow Core lives in Home.
- **Assumptions to verify:**
  - All probes ran on the personal machine (Claude Code 2.1.330, Copilot CLI 1.0.116); `--add-dir` / `--settings` behavior on the work machine is untested.
  - The Claude `code-review` result covers explicit Agent-tool delegation; a prompt saying "run `/code-review`" would hit Claude's bundled skill instead.
  - Payload `cwd` when Workflow Core is copied into the sibling (80/20 baseline) is untested.

## Sources
- [The Home Repo Pattern (Matt Pocock / AI Hero)](https://www.aihero.dev/the-home-repo-pattern) — one Home Repo holding shared skills, `AGENTS.md` sibling pointers, and shared docs; motivated siblings over nested repos.
- [VS Code AI Settings Reference](https://code.visualstudio.com/docs/agents/reference/ai-settings) — `chat.agentFilesLocations`, `chat.useClaudeMdFile`, `chat.useClaudeHooks` are Local-harness-only; no longer relevant after scoping out VS Code.
- [VS Code Agent Plugins](https://code.visualstudio.com/docs/agent-customization/agent-plugins.md) — plugin installs and manifest precedence; informed rejecting plugins.
- [GitHub Copilot CLI Hooks Reference](https://docs.github.com/en/copilot/reference/hooks-reference) & [CLI Command Reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) — Copilot reads `.claude/skills` and `.claude/settings.json` hooks; `--add-dir`; `/diff`.
- [Claude Code Skills](https://code.claude.com/docs/en/skills.md) — skills load from `--add-dir` directories; bundled `/code-review` skill.
- [Claude Code Commands](https://code.claude.com/docs/en/commands.md) — `/diff`, `/add-dir` ("most `.claude/` configuration isn't discovered" — contradicted for agents by our probe), `/code-review`.
- [Claude Code Memory / AGENTS.md](https://code.claude.com/docs/en/memory.md#agents-md) — native `AGENTS.md` fallback; `@AGENTS.md` in `CLAUDE.md` is deduplicated.

## Probe Results
- **2026-11-22, work machine:** local plugins allowed in both harnesses; sibling read/edit and cross-harness relay worked with a clean tree; VS Code collided on dual-manifest agents and cached local plugins (led to rejecting plugins).
- **2026-11-25, personal machine, `C:\Temp\hook-parity-probe`** (guard registered only in `.claude/settings.json`):
  - Copilot CLI, untrusted folder: repository hooks skipped (stderr warning only), locked file edited.
  - Copilot CLI, trusted: denied with top-level format and with combined format.
  - Claude Code: hook fired but top-level deny ignored, locked file overwritten; combined format (`hookSpecificOutput`) denied.
  - Both CLIs send Claude-shaped payloads (`tool_name`, `tool_input`, tool names like `Edit`/`Write`).
- **2026-11-25, personal machine, `C:\Temp\home-probe`** (`home` + sibling `api1`):
  - cwd = sibling without `--add-dir`: no Home skills, agents, or hook in either CLI.
  - Copilot `--add-dir <home>`: skills, agents, hook all load; hook payload `cwd` = Home dir.
  - Claude `--add-dir <home>`: skills and agents load (agent invocation confirmed by marker + logged `Agent` call), hook does not; adding `--settings <home>\.claude\settings.json` loads it with payload `cwd` = sibling.
  - Same-name agents: Copilot ran `.github/agents` copy; Claude ran `.claude/agents` copy.
  - Claude-only agent name: listed and runnable in Copilot.
  - `code-review`: Copilot ran its built-in over `.claude/agents/code-review.md`; Claude ran ours via the Agent tool.

## Open Threads
- none

## Graduation Framing
- **Distilled idea:** a thin Home Repo per environment holds `Workflow Core` (synced from one `Personal.Workflow` clone), sibling pointers, and a needs-first coordination playbook; Claude Code and Copilot CLIs launch in a sibling repo with Home attached; each repo plans and gates in its own `.workflow/`, and `.workflow/` + commits are the relay baton.
- **Keep:** sibling layout; CLIs only; shared `.claude/skills/` and one `.claude/settings.json` hook (combined deny, git root from edited file); agents in both formats per name, `code-review` Claude-only; per-repo execution; Level 1 playbook; `Gate` as `Oracle` backstop.
- **Reject:** Agent Plugins; VS Code Agent Host and its settings; trust detection; contract files and cross-repo traceability (revisit only if the playbook keeps missing peer impact).
- **Questions for `brain-storm`:** Home-attached vs. copy-into-sibling; launch wrapper ergonomics and failure visibility; fixing `pull-work`'s hardcoded `.github/` paths; ordering the existing guard deny-format fix; rerunning the probes on the work machine as an early slice; polyglot single-repo stack binding (secondary).
- Handoff: `/brain-storm from .workflow/incubations/home-repo-workflow.md`
