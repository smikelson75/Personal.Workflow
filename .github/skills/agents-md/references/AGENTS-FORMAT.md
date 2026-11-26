# AGENTS.md Format

`AGENTS.md` is a compact operating guide for one repository. Keep it short; link to authoritative documentation instead of repeating it.

## Skeleton

Include only sections with verified, project-specific value, in this order:

1. **Stack**: exactly one line, `Stack: <id>[, <id>...]`, kebab-case IDs. Keep it first so it is easy to find.
2. **Purpose**: one or two sentences on what the repository is for.
3. **Code style**: formatter and linter, and the commands that check them.
4. **Architecture boundaries**: layers, dependency directions, and folders that must not import each other.
5. **Build, test, and validation commands**: exact commands, copied from configuration or CI.
6. **Conventions that differ from defaults**: naming, error handling, file layout.
7. **Required practices**: documentation, security, or data handling the repository enforces.
8. **Links**: pointers to detailed documentation (`.workflow/language.md`, Behavior Specs, README).

## Exclude

- Requirements already owned by a Behavior Spec or the Glossary.
- Phases, Cards, task lists, readiness, or completion status.
- Temporary workarounds and one-off instructions.
- Speculative future architecture.
- Text duplicated from the README or contribution guide.
- Generic advice an agent already follows.

## Stability

Update `AGENTS.md` when a project-wide convention, hard constraint, command, architecture boundary, or documentation location changes. Do not update it because a task finished or a phase advanced.
