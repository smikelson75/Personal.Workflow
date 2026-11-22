# workflow-check

A zero-dependency Node.js CLI tool that checks the `.workflow/` folder against deterministic Rules and reports Findings. It never modifies files.

## Prerequisites

- Node.js LTS (`22.12+` or `24`) on your `PATH`. No `npm install` is required.

## Usage

Run from anywhere inside a repository that contains a `.workflow/` folder:

```powershell
# Check the entire .workflow/ folder
node .github/tools/workflow-check/bin/workflow-check.mjs

# Check a single Session file or the Glossary
node .github/tools/workflow-check/bin/workflow-check.mjs .workflow/language.md
node .github/tools/workflow-check/bin/workflow-check.mjs .workflow/sessions/context-2026-11-21-1859.md
```

## Output and Exit Codes

Each Finding is printed on one line, sorted by file path, line number, and rule ID:

```text
<path>:<line>: <severity>: <ruleId>: <message>
workflow-check: <errors> errors, <warnings> warnings
```

| Exit Code | Meaning |
| --- | --- |
| `0` | Passed — zero `error` Findings (may still include `warning` Findings). |
| `1` | Failed — one or more `error` Findings were reported. |
| `2` | Usage or environment error (no `.workflow/` folder found, invalid arguments, or target file is not a Session or Glossary). |

## Rule Categories

| Category | What It Checks |
| --- | --- |
| `structure` | Required `.workflow/` layout, Session header fields, required Session sections, and Glossary term syntax. |
| `chain` | Session statuses (`draft` vs `final`), valid `Supersedes` links, and unique `R#` Requirement IDs across the Session Chain. |
| `vocabulary` | Conflicts in Glossary definitions, use of `Avoid:` terms, references to retired terms, and missing canonical terms. |
| `excess` | Document size limits and stage-boundary leakage (such as implementation details appearing in requirements). |

## Where It Runs in the Workflow

- `brain-storm` runs `workflow-check` before finalizing a Session.
- `pull-work` and `work-planner` rely on a clean Glossary and Session Chain before planning or dispatching Cards.
- You can run it manually at any time after hand-editing `.workflow/` files.
