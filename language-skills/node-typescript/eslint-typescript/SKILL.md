---
name: eslint-typescript
description: "Set up strict TypeScript type checking plus typed ESLint and Prettier as the enforced code style for Node.js TypeScript projects, using a baseline or per-rule walkthrough. Use when: adding tsconfig, linting, or formatting, amending an existing setup, choosing the TypeScript version, or wiring typecheck and style checks into the phase gate."
argument-hint: "Say 'baseline' to accept industry defaults, or 'walkthrough' to choose rules one at a time"
user-invocable: true
disable-model-invocation: false
---

# TypeScript + typescript-eslint + Prettier for Node.js

The code-style and type-check adapter for TypeScript on Node.js. `tsc` proves the types, typescript-eslint finds bugs that type-check fine, and Prettier owns formatting. They never overlap: `eslint-config-prettier` turns off every ESLint rule Prettier would fight.

**Opinion:** strict `tsc`, ESLint (flat config) with typescript-eslint's type-aware rules, and Prettier are the default, because they are what most TypeScript developers already know and what editors, CI templates, and frameworks assume. Do not add Biome, Standard, or XO beside them. A repository that already uses one of those keeps it; this skill does not migrate.

Owns these durable outputs in the target repository, per [references/BASELINE.md](references/BASELINE.md):

- `tsconfig.json` (type-check everything, no emit) and `tsconfig.build.json` (emit `src` to `dist`)
- the pinned `typescript` version in `package.json`
- `eslint.config.js`
- `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.gitattributes`
- the `typecheck`, `build`, `lint`, `lint:fix`, `format`, and `format:check` scripts in `package.json`

## Mode

- No `tsconfig.json` or ESLint config => new.
- Existing files => amendment: read them, keep settings the user still wants, and report conflicts with the baseline before editing. For `tsconfig.json`, list each strictness flag that is off and how many errors turning it on produces (`npx tsc --noEmit --<flag>`), so the user decides with numbers.
- A legacy `.eslintrc.*` => ESLint 9 and later ignore it. Report it, migrate its rules into `eslint.config.js` (`npx @eslint/migrate-config .eslintrc.json` gives a starting point), and delete the old file only after the user confirms.
- `typescript` 7.x installed => report the conflict (references/BASELINE.md, "Why TypeScript 6.0"), and pin `~6.0.3` after the user confirms.
- Ask which mode the user wants when both apply; an explicit `baseline` or `walkthrough` answer wins.

## Path A: Baseline

Chosen when the user accepts industry best practices.

1. Confirm three inputs only: the Node LTS line (sets `@types/node`), whether to keep Prettier defaults, and the enforcement level (all errors now, or a legacy ramp; see Enforcement).
2. Install and write the files from [references/BASELINE.md](references/BASELINE.md).
3. Run `npm run format` once. Commit that formatting alone, separate from any behavior change (a `style:` commit).
4. Verify and report.

## Path B: Walkthrough

Chosen when the user wants control. Ask one focused group at a time; number each question (`Q1`, `Q2`, ...) so answers can be revisited. Offer the baseline value as the default for every question so the user can accept it in one word.

Cover in order, stopping as soon as the user says "baseline for the rest":

1. TypeScript version: the 6.0 pin and why (typed linting and the mutation checker need the classic compiler API).
2. Strictness beyond `strict`: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. For existing code, show the error count per flag.
3. Module system and output: `nodenext` ES modules (baseline), or a bundler (`"moduleResolution": "bundler"`) when a bundler ships the code. `dist/` layout, declarations, source maps.
4. Formatting: Prettier defaults, or overrides (`singleQuote`, `printWidth`, `semi`). Every override is a taste choice with no bug-catching value.
5. Lint level: `recommendedTypeChecked` (baseline), or `strictTypeChecked` plus `stylisticTypeChecked`. Explain the extra findings on existing code.
6. File scope: which globs get which globals, and what is ignored (build output, generated code, vendored files).
7. Plugins, only if the code needs them: `eslint-plugin-n` (Node API misuse), `@vitest/eslint-plugin` (test mistakes), framework plugins. Each adds a dependency to maintain.
8. Severities: every rule is `error` or `off`. `warn` is allowed only during a legacy ramp.
9. Enforcement: where the checks run (gate suite, CI, pre-commit hook).

Record every deviation from the baseline as a comment in the generated file (`eslint.config.js`, or a sibling note for `tsconfig.json`, since JSON comments confuse some tools) so a future reader sees the intent.

## Enforcement

- One `tsconfig.json` and one `eslint.config.js`, both at the repository root. ESLint does not merge flat configs: a nested `eslint.config.js` replaces the root one for every file under it. A nested `tsconfig.json` must `extends` the root one.
- Every `.ts` file is inside `tsconfig.json`'s `include`. A file outside it fails typed linting ("not found by the project service") and is never type-checked. New folders under `src/` and `tests/` are covered automatically.
- Type escapes need a reason in the same line: `// @ts-expect-error -- <why>` (never `@ts-ignore`), `// eslint-disable-next-line <rule> -- <why>`. A bare suppression or an unexplained `as` cast to silence an error is a review finding.
- Prettier is the only formatter. Remove ESLint stylistic plugins (`@stylistic/*`) and formatting rules when amending.
- Gate: the phase Gate `suite` line runs `npm run typecheck && npm run lint && npm run format:check` before the tests (`vitest-typescript` shows the full line). Vitest does not type-check, so without `typecheck` in the gate a type error can ship with green tests.
- Legacy ramp instead of all errors: turn individual strictness flags off with a dated comment in the sibling note, set noisy lint rules to `warn`, and drop `--max-warnings 0` for the ramp only. Never ramp new code: new files meet the full baseline from day one.

## Verification

Run and report all three:

- `npm run typecheck`: proves the types hold under the agreed strictness.
- `npm run lint`: proves typed lint rules run and violations fail.
- `npm run format:check`: proves the tree already matches Prettier.

Then prove enforcement with a smoke test: add `export async function smoke(): Promise<void> { Promise.resolve(1); }` to any source file, confirm `npm run lint` reports `@typescript-eslint/no-floating-promises` (which proves type information reaches the linter), and remove the line.

If a check fails, report the top diagnostic codes or rule IDs and counts, and ask whether to fix the code or change the standard. Do not silently turn off a flag or a rule to make the check pass.

## Exit Conditions

Done when the baseline files exist at the root, TypeScript is pinned, all three verification commands and the smoke test were run, their results were reported, and the gate `suite` line includes `typecheck`, `lint`, and `format:check`. Return a short brief: files written, TypeScript version and why, deviations from baseline, verification output, unresolved violations.
