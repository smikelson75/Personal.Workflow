# 0003. The Home Repo holds two forms of each agent

Status: Accepted

## Context
- Copilot CLI pins an agent with a `model` list of display names and `reasoning-effort`. Claude Code pins it with a single `model` alias and `effort`, and ignores a list-form `model`. Both Harnesses read the Home Repo's `.claude/agents/` under `--add-dir`; Claude Code reads nothing else, Copilot CLI also reads `.github/agents/` and prefers it for a duplicate agent name (probed with Copilot CLI 1.0.116 and Claude Code 2.1.332).

## Decision
- The Update Script installs each agent twice: the source byte for byte at `.github/agents/<name>.agent.md` for Copilot CLI, and a Claude form at `.claude/agents/<name>.agent.md` for Claude Code. The Claude form replaces the `model` list and `reasoning-effort` with `model: <alias>` and `effort: <level>` derived from the source; the body is unchanged.

## Alternatives Considered
- `One shared file` - a list-form `model` serves only Copilot CLI and an alias only Claude Code, so one Harness loses its pins.
- `Launch Script injection of Claude pins` - the README's direct Claude Code command and any session started without the Launch Script lose the pins.
- `Separate hand-written pins per Harness` - two values per agent drift (rejected in the Session).

## Consequences
- One edit to the source plus one Update Script run changes both Harnesses.
- The Home Repo holds twice as many agent files, and the Workflow version covers both.
- Correctness of Copilot CLI's pins depends on its preference for `.github/agents/`; a Copilot CLI release that changes the precedence needs a new probe and possibly a new ADR.
