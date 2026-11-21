# Language

## Terms
- `workflow-check` - command-line tool that checks the Workflow Folder against Rules and reports Findings; never modifies files. Avoid: linter, validator.
- `Rule` - one named check with a stable rule ID, a Category, and a Severity. Avoid: check (as a noun), test.
- `Finding` - one reported Rule break at a file and line. Avoid: issue, problem, violation, diagnostic.
- `Severity` - how serious a Finding is: `error` fails the run; `warning` is reported but passes. Avoid: level, priority.
- `Category` - a group of Rules: `structure`, `chain`, `vocabulary`, `excess`.
- `Session` - one brain-storm session file in `.workflow/sessions/`. States: draft -> final.
- `Session Chain` - the final, non-superseded Sessions that together hold current truth for a product.
- `Requirement` - a numbered `R#` observable behavior with an Accept signal; ID unique across the Session Chain. States: active -> retired.
- `Glossary` - the single shared list of canonical terms. Avoid: dictionary, language file. Code: `.workflow/language.md`
- `Workflow Folder` - the `.workflow/` directory a run reads. Code: `.workflow/`
- `Workflow Core` - the `.github/` skills, agents, hooks, and tools copied into a target repository; workflow-check is one tool inside it. Excludes this repository's AGENTS.md and Language Add-ons. Avoid: toolkit. Code: `.github/`
- `Language Add-on` - an optional stack-specific skill (harness, lint, mutation) the Developer copies into `.github/skills/` per project. Avoid: language skill, adapter. Code: `language-skills/`
- `Stall` - an unplanned stop that needs a hand fix to workflow files before the run can continue. Avoid: blocker, hang.
- `Checkpoint` - a planned stop where the Developer reviews or approves, answered as one bundled question; distinct from the Gate, which runs without the Developer. Avoid: approval step.
- `Known Failure` - a pre-existing failing test listed with an owning later phase; excluded from the Gate. Avoid: flaky test, legacy failure.

## Retired
