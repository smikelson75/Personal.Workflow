---
name: vitest-typescript
description: "Set up and use Vitest as the test harness for Node.js TypeScript projects: unit and locked acceptance tests, scenario-ID tagging, selection and exclusion, type checking in the gate, and the work-planner Harness and Gate lines. Use when: adding a test harness, writing acceptance or unit tests, or filling a phase's Harness for a TypeScript repo."
argument-hint: "Say 'setup' to add the harness, or 'harness' to get the phase Harness and Gate lines"
user-invocable: true
disable-model-invocation: false
---

# Vitest Harness for Node.js TypeScript

The test-harness adapter for TypeScript on Node.js. It gives `work-planner` the phase `Harness` and `Gate` lines, gives `test-author` the conventions for locked acceptance tests, and gives `stryker-typescript` the unit-only config it mutates against.

**Opinion:** Vitest is the default because it is the most widely used test runner for TypeScript today, runs `.ts` files with no `ts-jest` or Babel setup, and has the most-used StrykerJS runner. Do not add Jest, Mocha, or `node:test` beside it. A repository that already uses another runner keeps it; this skill does not migrate.

**Vitest does not type-check.** It strips types and runs the code. A test can pass while `src/` has type errors. The `typecheck` script (`tsc`, owned by `eslint-typescript`) is part of every Harness `run` and Gate `suite` line below for that reason.

This skill owns, in the target repository:

1. `vitest.config.ts` (every test) and `vitest.unit.config.ts` (unit tests only).
2. The `test` and `test:unit` scripts in `package.json`.
3. The test layout under `tests/`.

## 1. Before You Start

- Node.js is an active LTS line (22.12+ or 24). Odd-numbered releases (23, 25) are outside Vitest's supported engines; npm then quietly installs an older Vitest major. Record the Node line in `package.json` `engines` and in `.nvmrc`.
- `package.json` has `"type": "module"`.
- `eslint-typescript` has written `tsconfig.json` (type-checks `src`, `tests`, and root `*.ts` files, no emit) and `tsconfig.build.json` (emits `src` to `dist`). If it has not, run it first.
- Install: `npm install --save-dev vitest @types/node`. Commit `package-lock.json`.

## 2. Layout

| Path | Holds | Rules |
| --- | --- | --- |
| `tests/unit/**/*.test.ts` | Unit tests, mirroring `src/` paths | Import the module under test. Fast, no network, no child processes, no real clock. These are the only tests mutation testing uses. |
| `tests/acceptance/<phase>-<card>.test.ts` | Locked acceptance tests, one file per card (`p02-s01.test.ts`) | Drive the product boundary only: the built output in `dist/`. Never import from `src/`. |
| `tests/acceptance/fixtures/<phase>-<card>/` | Fixtures owned by one card | No card reads another card's fixtures. |
| `tests/support/` | Shared helpers (spawn the CLI, start the server, make a temp dir) | Created by a `setup` card. Changes here are harness changes: `test-author` stops and reports instead of editing. |

Relative imports use the `.js` extension of the emitted file (`import { total } from "../../src/cart/total.js";`), as `"module": "nodenext"` requires. Vite resolves it to the `.ts` source.

## 3. Configuration

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

`vitest.unit.config.ts` (used by `npm run test:unit` and by `stryker-typescript`):

```ts
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.js";

export default mergeConfig(
  base,
  defineConfig({
    test: { include: ["tests/unit/**/*.test.ts"] },
  }),
);
```

`package.json` scripts (`typecheck` and `build` come from `eslint-typescript`):

```json
{
  "scripts": {
    "typecheck": "tsc",
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "test:unit": "vitest run --config vitest.unit.config.ts"
  }
}
```

Always use `vitest run`. Bare `vitest` starts watch mode and never exits, which hangs an agent or CI.

## 4. Scenario IDs: Tag, Select, Exclude, Count

**Tag:** the test title starts with the scenario ID in brackets, then the scenario text.

```ts
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

**Traceability:** [`scripts/trace.mjs`](scripts/trace.mjs) runs the suite once with the JSON reporter. It exits 0 only when every given ID has a passing test and no test failed. It does not build; run `npm run build` first when acceptance tests drive `dist/`. Copy it into the target repository's `scripts/` folder when this skill is installed outside `.github/skills/`.

## 5. Harness and Gate Lines for work-planner

Paste into the phase header, then edit paths if the layout differs:

```md
- **Harness:**
  - run: `npm run typecheck && npm run build && npx vitest run`; select `-t "\[(<ids>)\]"`; exclude `-t "^(?!.*\[(<ids>)\])"`
  - tag: test title starts with `[R3-01]`
  - count: `Tests  N passed` summary line
  - assert: `^\s*(expect|assert)\b|\b(test|it)\(`
- **Gate:**
  - suite: `npm run typecheck && npm run lint && npm run format:check && npm run build && npx vitest run`
  - traceability: `npm run build && node .github/skills/vitest-typescript/scripts/trace.mjs <IDs owned by this and earlier phases>`
  - lock: `git diff --exit-code <Tests locked> -- tests/acceptance`
  - mutation: `node .github/skills/stryker-typescript/scripts/mutation-gate.mjs --since <phase-start-ref>`
```

`<ids>` is `|`-separated, for example `R3-01|R3-02`. The `-t` option goes at the end, after `npx vitest run`. Drop `npm run build` from both lines when no acceptance test drives `dist/` (for example, a library whose boundary is its exported API imported from the package name). Drop the `lint` and `format:check` steps when `eslint-typescript`'s lint baseline is not installed.

## 6. Writing Acceptance Tests

These rules add to the `test-author` agent's rules; they do not replace them.

- **CLI boundary:** spawn the built entry point with the current Node binary, never a shell, and never a TypeScript loader:

  ```ts
  import { spawnSync } from "node:child_process";
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["dist/cli.js", ...args], { encoding: "utf8", cwd: workDir });
  ```

  Assert `status`, `stdout`, and `stderr` exactly as the scenario states. The test runs what users run.
- **HTTP boundary:** start `dist/server.js` as a child process on port `0` or a free port, wait for its ready line, call it with `fetch`, and kill it in `afterEach`.
- **Library boundary:** import from the package name (`import { parse } from "my-lib";`, resolved through `package.json` `exports` and a self-reference), never from `src/`.
- **Files:** create every fixture in a fresh `fs.mkdtempSync(path.join(os.tmpdir(), "p02-s01-"))` directory and remove it in `afterEach`. Assert what is unchanged after a failure by comparing file contents before and after.
- Use exact matchers (`toBe`, `toEqual`, `toStrictEqual`). Use `toMatch` only for text the scenario leaves open.
- No snapshots in acceptance tests. A snapshot hides the expectation, so a reviewer cannot see what "done" means.
- No `test.only` or `test.skip` in committed files. Vitest refuses `.only` when `CI` is set, but nothing refuses it locally.
- No `any`, `as` casts, or `@ts-expect-error` to reach into results. Type the helper's return value instead.
- Keep acceptance files sequential (the default). Do not use `test.concurrent` with shared ports or directories.

## 7. Writing Unit Tests

- One file per module, mirroring `src/` (`src/cart/total.ts` → `tests/unit/cart/total.test.ts`).
- Import the module directly by relative path. Stryker's `related` mode finds the tests to run through these imports.
- Test boundaries with the exact boundary value (`>=` versus `>`), every branch, and the exact error type and message. These are what mutation testing checks.
- Do not unit-test what the compiler already guarantees (that a function rejects a wrong argument type). Test runtime behavior.
- Prefer real collaborators. Use `vi.fn()` and `vi.mock()` only for slow or external dependencies (network, clock, randomness). Use `vi.useFakeTimers()` for time. Type mocks with `vi.fn<typeof realFn>()`.

## 8. Problems

| Signal | Meaning | Action |
| --- | --- | --- |
| The command never exits | Watch mode | Use `vitest run`. |
| Tests pass but `npm run typecheck` fails | Vitest strips types without checking | Expected. The gate runs `typecheck`; fix the type error. |
| Acceptance test runs old behavior | `dist/` is stale | The Harness `run` line builds first; never run acceptance tests without it. |
| `No test files found` | `include` does not match the layout | Fix `include` in `vitest.config.ts`. |
| `-t` selects 0 tests | The tag is not at the start of the title, or a regex special character is unescaped | Check the title; IDs hold only letters, digits, and `-`. |
| `Cannot find module '../src/x'` from `tsc` | Missing `.js` extension under `nodenext` | Import `../src/x.js`. |
| The installed Vitest is an older major than npm `latest` | Node is an odd-numbered release outside Vitest's engines | Switch to an LTS Node line. |

## 9. Exit Conditions

Done when:

- `vitest.config.ts`, `vitest.unit.config.ts`, and the `test` and `test:unit` scripts exist.
- `npm run typecheck`, `npx vitest run`, and `npm run test:unit` all exit 0 with at least one test, and `test:unit` runs only `tests/unit`.
- A select and an exclude command were run on a real tag and selected the expected counts.
- The phase `Harness` and `Gate` lines were handed to `work-planner`.
