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

## Retired
