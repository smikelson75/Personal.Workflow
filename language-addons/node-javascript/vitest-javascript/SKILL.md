---
name: vitest-javascript
description: "Set up and use Vitest as the test harness for Node.js JavaScript projects: unit and locked acceptance tests, scenario-ID tagging, selection and exclusion, and the work-planner Harness and Gate lines. Use when: adding a test harness, writing acceptance or unit tests, or filling a phase's Harness for a JavaScript repo."
argument-hint: "Say 'setup' to add the harness, or 'harness' to get the phase Harness and Gate lines"
user-invocable: true
disable-model-invocation: false
---

# Vitest Harness for Node.js JavaScript

The test-harness adapter for JavaScript on Node.js. It gives `work-planner` the phase `Harness` and `Gate` lines, gives `test-author` the conventions for locked acceptance tests, and gives `stryker-javascript` the unit-only config it mutates against.

**Opinion:** Vitest is the default because it is the most widely used JavaScript test runner today, runs ES modules natively with no transform setup, and has the most-used StrykerJS runner. Do not add Jest, Mocha, or `node:test` beside it. A repository that already uses another runner keeps it; this skill does not migrate.

This skill owns, in the target repository:

1. `vitest.config.js` (every test) and `vitest.unit.config.js` (unit tests only).
2. The `test` and `test:unit` scripts in `package.json`.
3. The test layout under `tests/`.

## 1. Before You Start

- Node.js is an active LTS line (22.12+ or 24). Odd-numbered releases (23, 25) are outside Vitest's supported engines; npm then quietly installs an older Vitest major. Record the Node line in `package.json` `engines` and in `.nvmrc`.
- `package.json` has `"type": "module"`. ES modules are the default for new code; CommonJS projects keep `.cjs` only where a tool demands it.
- Install: `npm install --save-dev vitest`. Commit `package-lock.json`.

## 2. Layout

| Path | Holds | Rules |
| --- | --- | --- |
| `tests/unit/**/*.test.js` | Unit tests, mirroring `src/` paths | Import the module under test. Fast, no network, no child processes, no real clock. These are the only tests mutation testing uses. |
| `tests/acceptance/<phase>-<card>.test.js` | Locked acceptance tests, one file per card (`p02-s01.test.js`) | Drive the product boundary only. Never import from `src/`. |
| `tests/acceptance/fixtures/<phase>-<card>/` | Fixtures owned by one card | No card reads another card's fixtures. |
| `tests/support/` | Shared helpers (spawn the CLI, start the server, make a temp dir) | Created by a `setup` card. Changes here are harness changes: `test-author` stops and reports instead of editing. |

## 3. Configuration

`vitest.config.js`:

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
  },
});
```

`vitest.unit.config.js` (used by `npm run test:unit` and by `stryker-javascript`):

```js
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.js";

export default mergeConfig(
  base,
  defineConfig({
    test: { include: ["tests/unit/**/*.test.js"] },
  }),
);
```

`package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run --config vitest.unit.config.js"
  }
}
```

Always use `vitest run`. Bare `vitest` starts watch mode and never exits, which hangs an agent or CI.

## 4. Scenario IDs: Tag, Select, Exclude, Count

**Tag:** the test title starts with the scenario ID in brackets, then the scenario text.

```js
test("[R3-01] Given an empty cart, when checking out, then exits 2 with 'cart is empty'", () => { ... });
```

**Select** with `-t` (a regular expression matched against the full name, `describe` titles included):

```text
npx vitest run -t "\[(R3-01|R3-02)\]"
```

**Exclude:** Vitest has no inverted name filter. Use a negative lookahead. It runs every test whose name does not contain any of the listed tags:

```text
npx vitest run -t "^(?!.*\[(R3-01|R3-02)\])"
```

Run these from PowerShell or bash. In `cmd.exe`, `^` is an escape character and breaks the pattern.

**Count:** the summary line `Tests  N passed | M skipped (T)`. `N` is the number that ran and passed. Tests removed by `-t` show as skipped, not as missing.

**Traceability:** [`scripts/trace.mjs`](scripts/trace.mjs) runs the suite once with the JSON reporter. It exits 0 only when every given ID has a passing test and no test failed. Copy it into the target repository's `scripts/` folder when this skill is installed outside `.github/skills/`.

## 5. Harness and Gate Lines for work-planner

Paste into the phase header, then edit paths if the layout differs:

```md
- **Harness:**
  - run: `npx vitest run`; select `-t "\[(<ids>)\]"`; exclude `-t "^(?!.*\[(<ids>)\])"`
  - tag: test title starts with `[R3-01]`
  - count: `Tests  N passed` summary line
  - assert: `^\s*(expect|assert)\b|\b(test|it)\(`
- **Gate:**
  - suite: `npm run lint && npm run format:check && npx vitest run`
  - traceability: `node .github/skills/vitest-javascript/scripts/trace.mjs <IDs owned by this and earlier phases>`
  - lock: `git diff --exit-code <Tests locked> -- tests/acceptance`
  - mutation: `node .github/skills/stryker-javascript/scripts/mutation-gate.mjs --since <phase-start-ref>`
```

`<ids>` is `|`-separated, for example `R3-01|R3-02`. Drop the `lint` and `format:check` steps from `suite` when `eslint-javascript` is not installed.

## 6. Writing Acceptance Tests

These rules add to the `test-author` agent's rules; they do not replace them.

- **CLI boundary:** spawn the real entry point with the current Node binary, never a shell:

  ```js
  import { spawnSync } from "node:child_process";
  const run = (...args) => spawnSync(process.execPath, ["bin/app.js", ...args], { encoding: "utf8", cwd: workDir });
  ```

  Assert `status`, `stdout`, and `stderr` exactly as the scenario states.
- **HTTP boundary:** start the server as a child process on port `0` or a free port, wait for its ready line, call it with `fetch`, and kill it in `afterEach`.
- **Files:** create every fixture in a fresh `fs.mkdtempSync(path.join(os.tmpdir(), "p02-s01-"))` directory and remove it in `afterEach`. Assert what is unchanged after a failure by comparing file contents before and after.
- Use exact matchers (`toBe`, `toEqual`, `toStrictEqual`). Use `toMatch` only for text the scenario leaves open.
- No snapshots in acceptance tests. A snapshot hides the expectation, so a reviewer cannot see what "done" means.
- No `test.only` or `test.skip` in committed files. Vitest refuses `.only` when `CI` is set, but nothing refuses it locally.
- Keep acceptance files sequential (the default). Do not use `test.concurrent` with shared ports or directories.

## 7. Writing Unit Tests

- One file per module, mirroring `src/` (`src/cart/total.js` → `tests/unit/cart/total.test.js`).
- Import the module directly by relative path. Stryker's `related` mode finds the tests to run through these imports.
- Test boundaries with the exact boundary value (`>=` versus `>`), every branch, and the exact error type and message. These are what mutation testing checks.
- Prefer real collaborators. Use `vi.fn()` and `vi.mock()` only for slow or external dependencies (network, clock, randomness). Use `vi.useFakeTimers()` for time.

## 8. Problems

| Signal | Meaning | Action |
| --- | --- | --- |
| The command never exits | Watch mode | Use `vitest run`. |
| `No test files found` | `include` does not match the layout | Fix `include` in `vitest.config.js`. |
| `-t` selects 0 tests | The tag is not at the start of the title, or a regex special character is unescaped | Check the title; IDs hold only letters, digits, and `-`. |
| The installed Vitest is an older major than npm `latest` | Node is an odd-numbered release outside Vitest's engines | Switch to an LTS Node line. |
| `Error: Vitest cannot be imported in a CommonJS module` | A `.cjs` test, or `"type"` is missing | Use ES modules for tests. |

## 9. Exit Conditions

Done when:

- `vitest.config.js`, `vitest.unit.config.js`, and the `test` and `test:unit` scripts exist.
- `npx vitest run` and `npm run test:unit` both exit 0 with at least one test, and `test:unit` runs only `tests/unit`.
- A select and an exclude command were run on a real tag and selected the expected counts.
- The phase `Harness` and `Gate` lines were handed to `work-planner`.
