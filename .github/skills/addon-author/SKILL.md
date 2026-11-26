---
name: addon-author
description: "Add a Language Add-on to a Personal.Workflow source by asking the Developer for its stack ID, roles, and each role's tool and command, then running the scaffold helper."
argument-hint: "Name the stack ID, or say what stack you want an add-on for"
user-invocable: true
---

# Addon Author

Question rules: follow `.github/user-interaction.md`.
Core paths: when the environment variable WORKFLOW_HOME is set (Home layout), read each Workflow Core path written here as follows: .github/skills/ is $WORKFLOW_HOME/.claude/skills/, .github/agents/ is $WORKFLOW_HOME/.claude/agents/, .github/tools/ is $WORKFLOW_HOME/.workflow-core/tools/, .github/hooks/ is $WORKFLOW_HOME/.workflow-core/hooks/, .github/user-interaction.md is $WORKFLOW_HOME/.workflow-core/user-interaction.md; run every command from the Project Repo root and never from $WORKFLOW_HOME. Without WORKFLOW_HOME (copy layout) read the paths as written.

Scaffold a Language Add-on: a stack-specific folder under `language-addons/<id>/` that the Update Script and Launch Script pick up unedited.

## Purpose

Give a Developer a new Language Add-on for one stack. The helper writes the folder, its skill files, and the stack's row in the catalog. You only collect answers and run the helper.

## Where It Runs

Run it in a Personal.Workflow source: the repository that holds Workflow Core under `.github/` and the Language Add-ons under `language-addons/`. Run every command from that source root. Do not run it in a Home Repo or a Project Repo.

## Questions

Ask the Developer only for the stack ID, the roles (code style, test harness, mutation testing), and each role's tool and command. Ask nothing else.

1. One grouped question: the stack ID and which roles the stack has.
2. One question per role the Developer keeps: its tool and its command.

- The stack ID must be kebab-case. If the ID is not kebab-case, ask again for the ID.
- Non-code stacks may skip roles, but at least one role is required.
- A skipped role is recorded with a reason; never invent a tool or command for it.

## Run

Run the helper from the source root:

`node .github/skills/addon-author/scripts/scaffold.mjs --id <id> [--code-style "<tool>|<command>"] [--test-harness "<tool>|<command>"] [--mutation "<tool>|<command>"] [--na "<role>=<reason>"]...`

Pass one role flag for each role the Developer keeps, and one `--na "<role>=<reason>"` for each role skipped. The helper writes only under `language-addons/<id>/` and the `Available Stacks` section of `language-addons/README.md`.

## Failure Outcomes

The helper prints one `addon-author failed:` line and exits non-zero. Relay the category and act on it:

- `not-a-workflow-source`: stop and say where to run it: in a Personal.Workflow source, from its root. Write nothing.
- `addon-exists`: stop and name the folder that already exists. Ask the Developer whether to choose another ID or edit that folder by hand. Write nothing.
- `invalid-id`: ask again for a kebab-case ID, then rerun.
- `no-roles`: ask the Developer for at least one role's tool and command, then rerun.

## Exit

Return a brief: the files written under `language-addons/<id>/`, the row added to the `Available Stacks` section of `language-addons/README.md`, and the next steps. Tell the Developer to run the Update Script, then run `launch` in a repo with `Stack: <id>`.
