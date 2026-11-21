# JavaScript Style Baseline

Write these files at the repository root. They were verified together on ESLint 10, Prettier 3, and Node.js 22+.

Install:

```text
npm install --save-dev eslint @eslint/js globals prettier eslint-config-prettier
```

## `eslint.config.js`

```js
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";

export default defineConfig([
  globalIgnores(["dist/", "coverage/", "reports/", ".stryker-tmp/", ".github/skills/"]),
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
  prettier,
]);
```

Why each choice:

| Choice | Reason |
| --- | --- |
| `js.configs.recommended` | The rule set almost every JavaScript project starts from: catches real bugs, no taste rules. |
| `eqeqeq: smart` | `==` coercion bugs are the most common JavaScript surprise. `smart` still allows `== null`. |
| `no-var`, `prefer-const`, `object-shorthand` | Modern syntax with one obvious form. All auto-fixable. |
| `no-unused-vars` with `^_` | Dead code fails the lint; a deliberate unused argument is named `_arg`. |
| `reportUnusedDisableDirectives` | A stale `eslint-disable` comment fails, so suppressions cannot pile up silently. |
| `prettier` last | Turns off every rule that conflicts with Prettier. Formatting belongs to Prettier only. |
| `globals.node` | Node.js globals. Add `globals.browser` in a block scoped to browser files only. |

## `.prettierrc.json`

```json
{}
```

Prettier defaults (double quotes, semicolons, 80 columns, trailing commas). The empty file tells editors the project uses Prettier. Every override is a walkthrough decision recorded in the brief.

## `.prettierignore`

```text
dist/
coverage/
reports/
.stryker-tmp/
.github/skills/
package-lock.json
```

`.github/skills/` holds the installed workflow skills and their scripts. They follow the workflow's own style, not the project's.

## `.editorconfig`

Prettier reads `indent_style`, `indent_size`, `end_of_line`, and `max_line_length` from here; editors apply the rest before Prettier runs.

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

## `.gitattributes`

Without this, Git on Windows checks files out with CRLF and `prettier --check` fails on every file.

```text
* text=auto eol=lf
```

## `package.json` scripts

```json
{
  "scripts": {
    "lint": "eslint --max-warnings 0 .",
    "lint:fix": "eslint --fix .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

`--max-warnings 0` makes a warning fail like an error, so `warn` cannot be used to park a problem.
