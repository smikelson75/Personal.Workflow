---
name: eslint-javascript
description: "Set up ESLint and Prettier as the enforced code style for Node.js JavaScript projects using a baseline or per-rule walkthrough. Use when: adding linting or formatting, amending an existing ESLint or Prettier setup, or wiring style checks into the phase gate."
argument-hint: "Say 'baseline' to accept industry defaults, or 'walkthrough' to choose rules one at a time"
user-invocable: true
disable-model-invocation: false
---

# ESLint + Prettier for Node.js JavaScript

The code-style adapter for JavaScript on Node.js. ESLint finds bugs; Prettier owns formatting. They never overlap: `eslint-config-prettier` turns off every ESLint rule Prettier would fight.

**Opinion:** ESLint (flat config) plus Prettier is the default, because it is what most JavaScript developers already know and what editors, CI templates, and frameworks assume. Do not add Biome, Standard, or XO beside it. A repository that already uses one of those keeps it; this skill does not migrate.

Owns these durable outputs in the target repository, per [references/BASELINE.md](references/BASELINE.md):

- `eslint.config.js`
- `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.gitattributes`
- the `lint`, `lint:fix`, `format`, and `format:check` scripts in `package.json`

## Mode

- No ESLint config => new.
- An existing `eslint.config.*` => amendment: read it, keep settings the user still wants, and report conflicts with the baseline before editing.
- A legacy `.eslintrc.*` => ESLint 9 and later ignore it. Report it, migrate its rules into `eslint.config.js` (`npx @eslint/migrate-config .eslintrc.json` gives a starting point), and delete the old file only after the user confirms.
- Ask which mode the user wants when both apply; an explicit `baseline` or `walkthrough` answer wins.

## Path A: Baseline

Chosen when the user accepts industry best practices.

1. Confirm three inputs only: runtime environments (Node only, or Node plus browser files), whether to keep Prettier defaults, and the enforcement level (all errors now, or a legacy ramp; see Enforcement).
2. Install and write the files from [references/BASELINE.md](references/BASELINE.md).
3. Run `npm run format` once. Commit that formatting alone, separate from any behavior change (a `style:` commit).
4. Verify and report.

## Path B: Walkthrough

Chosen when the user wants control. Ask one focused group at a time; number each question (`Q1`, `Q2`, ...) so answers can be revisited. Offer the baseline value as the default for every question so the user can accept it in one word.

Cover in order, stopping as soon as the user says "baseline for the rest":

1. Formatting: Prettier defaults, or overrides (`singleQuote`, `printWidth`, `semi`). Explain that every override is a taste choice with no bug-catching value.
2. File scope: which globs get which globals (`src/**` Node, `public/**` browser), and what is ignored (build output, generated code, vendored files).
3. Module system: ES modules (`"type": "module"`) or CommonJS.
4. Rules beyond `recommended`: the baseline's five, then any the user wants (`no-console` for libraries, `curly`, `prefer-template`).
5. Plugins, only if the code needs them: `eslint-plugin-n` (Node API misuse), `@vitest/eslint-plugin` (test mistakes), framework plugins. Each adds a dependency to maintain.
6. Severities: every rule is `error` or `off`. `warn` is allowed only during a legacy ramp.
7. Enforcement: where the checks run (gate suite, CI, pre-commit hook).

Record every deviation from the baseline as a comment in the generated `eslint.config.js` so a future reader sees the intent.

## Enforcement

- `eslint.config.js` lives only at the repository root. ESLint does not merge flat configs: a nested `eslint.config.js` replaces the root one for every file under it, and those files silently lose the shared rules.
- Prettier is the only formatter. Remove ESLint stylistic plugins (`@stylistic/*`) and formatting rules (`indent`, `quotes`, `semi`) when amending.
- New files and folders are covered automatically: the `files` globs match by extension, not by listed folder. Never list folders one by one.
- `eslint-disable` comments must name the rule and give a reason: `// eslint-disable-next-line no-await-in-loop -- sequential by design`. A bare `eslint-disable` is a review finding.
- Gate: add `npm run lint && npm run format:check` in front of the test command in the phase Gate `suite` line (`vitest-javascript` shows the full line).
- Legacy ramp instead of all errors: set noisy rules to `warn`, drop `--max-warnings 0` from `lint` for the ramp only, and write the end date as a comment in `eslint.config.js`. Never ramp new code: new files use the full baseline from day one.

## Verification

Run and report both:

- `npm run lint`: proves rule violations fail.
- `npm run format:check`: proves the tree already matches Prettier.

Then prove enforcement with a smoke test: add `var x = 1; if (x == 2) {}` to any source file, confirm `npm run lint` reports `no-var` and `eqeqeq`, and remove the line.

If either check fails, report the top rule IDs and counts, and ask whether to fix the code or change the standard. Do not silently downgrade a rule to make the check pass.

## Exit Conditions

Done when the baseline files exist at the root, both verification commands and the smoke test were run, their results were reported, and the gate `suite` line includes the lint and format checks. Return a short brief: files written, deviations from baseline, verification output, unresolved violations.
