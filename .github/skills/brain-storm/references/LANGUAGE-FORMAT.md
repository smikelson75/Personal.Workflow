# Language Format

Purpose: the single durable glossary at `.workflow/language.md`, shared by every session and later skill. It holds current truth; it is not a change log.

## Rules
- one line per term when possible: canonical term, meaning, avoid-synonyms
- default canonical term shape: singular domain noun (`Page`, `Invoice`, `Session`) unless another form carries different rules
- prefer one word when it preserves meaning; multi-word only for a distinct domain concept, not a process step label
- when both object and behavior matter, keep separate terms (`Page` object, `Paging` behavior); avoid hybrids like `Page Walk` unless truly a named business concept
- prefer user vocabulary unless ambiguous; in an existing solution, prefer the code's names unless the user renames them
- when the code name differs from the canonical term, record it as `Code:` so discussion and code stay aligned
- merge synonyms; split only when rules or lifecycle differ
- ban generic drift terms like `item`, `thing`, `data`, `process`, `service` when a domain term exists
- only stable v1-shaping concepts; if a term is unresolved, ask; do not invent
- capture only domain meaning; no field names, types, or mappings (user-visible fields go to `behavior-spec`, physical schema to `work-planner`)
- retired terms move to `Retired` with their replacement; delete them once no session or code uses them

## Skeleton

```md
# Language

## Terms
- `Term` - meaning. Avoid: synonym, synonym. Code: `ClassName` (optional)
- `Term` - meaning. States: a -> b -> c (optional)

## Retired
- `OldTerm` -> `Term` - reason
```
