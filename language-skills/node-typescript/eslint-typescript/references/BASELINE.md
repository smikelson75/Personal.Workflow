# TypeScript Style and Type-Check Baseline

Write these files at the repository root. They were verified together on TypeScript 6.0, typescript-eslint 8, ESLint 10, Prettier 3, and Node.js 22+.

Install:

```text
npm install --save-dev typescript@~6.0.3 @types/node eslint @eslint/js typescript-eslint globals prettier eslint-config-prettier
```

Match the `@types/node` major to the Node line in `engines` (for example `@types/node@^24` for Node 24).

## Why TypeScript 6.0, Not 7

TypeScript 7 is the native (Go) compiler. Its npm package no longer exports the JavaScript compiler API. typescript-eslint's typed rules and Stryker's TypeScript checker both load that API: typescript-eslint 8 declares `typescript >=4.8.4 <6.1.0`. Pin `~6.0.3` and move to 7 only when both tools state support. Record the pin and its reason in the brief.

## `tsconfig.json` (type-check everything, emit nothing)

```json
{
  "compilerOptions": {
    "target": "es2023",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src", "tests", "*.ts"]
}
```

## `tsconfig.build.json` (emit `src` only)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"]
}
```

Why each choice:

| Choice | Reason |
| --- | --- |
| `strict` | The setting almost every TypeScript project uses. Without it, `null` and implicit `any` slip through. |
| `noUncheckedIndexedAccess` | `arr[i]` and `record[key]` may be `undefined`, so the type says so. The most common runtime crash `strict` misses. |
| `exactOptionalPropertyTypes` | `{ a?: string }` means "absent", not "present and `undefined`". Prevents a class of serialization bugs. |
| `noImplicitOverride`, `noFallthroughCasesInSwitch` | Cheap, catch real mistakes, rarely fire on good code. |
| `module`/`moduleResolution: nodenext` | Matches how Node.js resolves ES modules. Relative imports need the `.js` extension. |
| `verbatimModuleSyntax`, `isolatedModules` | Type-only imports must say `import type`, so any per-file transpiler (Vitest, esbuild, Node type stripping) gives the same result as `tsc`. |
| `types: ["node"]` | Only `@types/node` adds globals. A stray `@types` package pulled in by another dependency cannot add globals (for example a browser or test-framework one). |
| Two configs | `tsconfig.json` type-checks tests and config files too; `tsconfig.build.json` ships only `src`. |

## `eslint.config.js`

```js
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";
import tseslint from "typescript-eslint";

const shared = {
  eqeqeq: ["error", "smart"],
  "no-var": "error",
  "prefer-const": "error",
  "object-shorthand": "error",
};

export default defineConfig([
  globalIgnores(["dist/", "coverage/", "reports/", ".stryker-tmp/", ".github/skills/"]),
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      ...shared,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "@typescript-eslint/switch-exhaustiveness-check": ["error", { considerDefaultExhaustiveForUnions: true }],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended],
    rules: {
      ...shared,
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
  prettier,
]);
```

Why each choice:

| Choice | Reason |
| --- | --- |
| `recommendedTypeChecked` | Rules that need type information catch what no syntax rule can: floating promises, `await` on non-promises, unsafe `any` flowing into typed code. These are the bugs that pass `tsc`. |
| `projectService: true` | typescript-eslint finds the right `tsconfig.json` per file. Every linted `.ts` file must be in a tsconfig `include`, or the lint fails with "not found by the project service". |
| `switch-exhaustiveness-check` | A `switch` on a union that misses a member fails, unless it has a `default`. Keeps unions and their handlers in step. |
| Shared JavaScript rules | Same modern-syntax rules as `eslint-javascript`, so mixed files read alike. |
| JavaScript block without type rules | `eslint.config.js` and any `.mjs` scripts are not in a tsconfig; typed rules would fail on them. |
| `prettier` last | Turns off every rule that conflicts with Prettier. Formatting belongs to Prettier only. |

Strict variant, only when the user chose it: replace `recommendedTypeChecked` with `strictTypeChecked` and add `stylisticTypeChecked`. Expect more findings on existing code.

## `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.gitattributes`

`.prettierrc.json`:

```json
{}
```

`.prettierignore`:

```text
dist/
coverage/
reports/
.stryker-tmp/
.github/skills/
package-lock.json
```

`.github/skills/` holds the installed workflow skills and their scripts. They follow the workflow's own style, not the project's.

`.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

`.gitattributes` (without it, Git on Windows checks out CRLF and `prettier --check` fails on every file):

```text
* text=auto eol=lf
```

## `package.json` scripts

```json
{
  "scripts": {
    "typecheck": "tsc",
    "build": "tsc -p tsconfig.build.json",
    "lint": "eslint --max-warnings 0 .",
    "lint:fix": "eslint --fix .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

Add `dist/` to `.gitignore`.
