# Node.js TypeScript Workflow Walkthrough

This guide walks through setting up a brand-new Node.js TypeScript repository with the Personal Workflow, configuring the TypeScript language skills (`eslint-typescript`, `vitest-typescript`, `stryker-typescript`), and building a small CLI application from initial idea to finished, verified code.

---

## Simple CLI Ideas to Practice the Workflow

Each of these uses zero external runtime dependencies, has clear black-box CLI behavior for Vitest acceptance tests against `dist/`, and has pure logic modules that make strict TypeScript + StrykerJS mutation testing meaningful:

1. **`csv-stats`** *(used throughout this walkthrough)* — Reads a CSV file and prints row count plus `min`, `max`, and `avg` for a chosen numeric column (`--column`, `--delimiter`, `--json`). Great for seeing strict TypeScript types and StrykerJS catch boundary-condition bugs (`<` vs `<=`, empty rows, non-numeric cells).
2. **`env-check`** — Validates a `.env` file against a `.env.example` template (missing keys, empty values, extra keys, `--strict`, `--json`, distinct exit codes).
3. **`todo-cli`** — Local JSON-backed task list (`add`, `list`, `done`, `remove`, `--file`).
4. **`slug-rename`** — Batch-renames files in a folder to lowercase kebab-case (`--dry-run` default, `--apply` to rename, refuses on collisions).

---

## Part 1: Set Up the New Repository (PowerShell)

Run these commands in **PowerShell** to create `C:\Projects\csv-stats`, initialize Git and Node.js (ESM + LTS), and copy the core workflow plus the Node.js TypeScript language skills.

### 1.1 Verify prerequisites (Node.js LTS 22.12+ or 24, and Git)

```powershell
node -v
git --version
```

> **Note:** Use an active Node.js LTS release (`22.12+` or `24`). Odd-numbered releases (`23`, `25`) fall outside Vitest's supported engines.

### 1.2 Create the project and initialize Git + `package.json`

Acceptance tests in TypeScript drive the **built** output in `dist/`, so `bin` points to `dist/cli.js`:

```powershell
New-Item -ItemType Directory -Path C:\Projects\csv-stats | Out-Null
Set-Location C:\Projects\csv-stats

git init -b main
npm init -y
npm pkg set name="csv-stats" version="0.1.0" type="module" engines.node=">=22.12.0" bin.csv-stats="dist/cli.js"
"22" | Set-Content -Path .nvmrc -NoNewline
```

### 1.3 Copy the core workflow and TypeScript language skills

This copies the portable workflow pieces (`.github/agents`, `.github/hooks`, `.github/skills`, `.github/tools/workflow-check`, `.github/user-interaction.md`, and `AGENTS.md`) along with the TypeScript skills ([eslint-typescript](../language-skills/node-typescript/eslint-typescript/SKILL.md), [vitest-typescript](../language-skills/node-typescript/vitest-typescript/SKILL.md), [stryker-typescript](../language-skills/node-typescript/stryker-typescript/SKILL.md)) and the shared [mutation-testing](../language-skills/mutation-testing/protocol.md) protocol.

```powershell
$workflowSrc = "C:\Projects\Personal.Workflow"

# Create .github folders
New-Item -ItemType Directory -Path .github\tools, .github\skills -Force | Out-Null

# Copy core workflow
Copy-Item -Recurse "$workflowSrc\.github\agents"                ".github\agents"
Copy-Item -Recurse "$workflowSrc\.github\hooks"                 ".github\hooks"
Copy-Item -Recurse "$workflowSrc\.github\skills\*"              ".github\skills"
Copy-Item -Recurse "$workflowSrc\.github\tools\workflow-check"  ".github\tools\workflow-check"
Copy-Item          "$workflowSrc\.github\user-interaction.md"   ".github\user-interaction.md"
Copy-Item          "$workflowSrc\AGENTS.md"                     "AGENTS.md"

# Copy Node.js TypeScript language skills + shared mutation-testing protocol
Copy-Item -Recurse "$workflowSrc\language-skills\node-typescript\eslint-typescript"  ".github\skills\eslint-typescript"
Copy-Item -Recurse "$workflowSrc\language-skills\node-typescript\vitest-typescript"  ".github\skills\vitest-typescript"
Copy-Item -Recurse "$workflowSrc\language-skills\node-typescript\stryker-typescript" ".github\skills\stryker-typescript"
Copy-Item -Recurse "$workflowSrc\language-skills\mutation-testing"                   ".github\skills\mutation-testing"
```

### 1.4 Add `.gitignore` and make the initial commit

`/pull-work` enforces a clean Git working tree before every run, so commit the initial scaffold first:

```powershell
@'
node_modules/
dist/
coverage/
reports/
.stryker-tmp/
'@ | Set-Content -Path .gitignore

git add .
git commit -m "chore: initialize csv-stats repository with personal workflow"
git status --short
```

### 1.5 Open the new repository in VS Code

```powershell
code C:\Projects\csv-stats
```

---

## Part 2: Configure the TypeScript Language Skills (Copilot Chat)

Open Copilot Chat in the `C:\Projects\csv-stats` workspace. Configure the skills in order: **TypeScript + ESLint + Prettier** → **Vitest** → **StrykerJS**.

### 2.1 Configure TypeScript + typescript-eslint + Prettier

Run `eslint-typescript` **first** because `vitest-typescript` expects `tsconfig.json` and `tsconfig.build.json` to exist already.

Type in **Copilot Chat**:

```text
/eslint-typescript baseline
```

The skill will ask you to confirm 3 inputs:

1. Node LTS line (sets `@types/node`) → answer: `Node 22` *(or `Node 24`, matching your `node -v`)*
2. Prettier defaults → answer: `keep defaults`
3. Enforcement level → answer: `all errors now`

It pins `typescript` to `~6.0.3` (required so typed linting and the Stryker TypeScript checker have the classic compiler API), installs `eslint`, `@eslint/js`, `typescript-eslint`, `prettier`, `eslint-config-prettier`, `globals`, and `@types/node`, writes `tsconfig.json`, `tsconfig.build.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, and `.gitattributes`, adds `typecheck`, `build`, `lint`, `lint:fix`, `format`, and `format:check` scripts to `package.json`, and verifies enforcement with a floating-promise smoke test.

Commit the setup cleanly in **Copilot Chat**:

```text
/conventional-commit add typescript, eslint, and prettier baseline
```

*(Approve the proposed commit message when prompted.)*

### 2.2 Configure Vitest

Type in **Copilot Chat**:

```text
/vitest-typescript setup
```

The skill installs `vitest`, creates `vitest.config.ts` and `vitest.unit.config.ts`, adds `"test": "vitest run"` and `"test:unit": "vitest run --config vitest.unit.config.ts"` to `package.json`, and verifies that `npm run typecheck`, `npx vitest run`, and `npm run test:unit` all pass.

> **Important:** Vitest strips types without type-checking them. That is why `vitest-typescript` puts `npm run typecheck && npm run build` in front of `npx vitest run` in the phase `Harness` and `Gate` lines, and why relative imports inside `.ts` files use the `.js` extension (`import { stats } from "../src/stats.js";`) required by `"module": "nodenext"`.

Commit the harness setup in **Copilot Chat**:

```text
/conventional-commit add vitest typescript test harness
```

### 2.3 Configure StrykerJS with the TypeScript Checker

Per [stryker-typescript/SKILL.md](../language-skills/node-typescript/stryker-typescript/SKILL.md) and [protocol.md](../language-skills/mutation-testing/protocol.md), **wait to run `/stryker-typescript baseline` until at least one unit test exists** (during or right after Phase 1 setup).

Once your first unit test exists and `npm run typecheck` passes, run in **Copilot Chat**:

```text
/stryker-typescript baseline
```

It installs `@stryker-mutator/core`, `@stryker-mutator/vitest-runner`, and `@stryker-mutator/typescript-checker`, confirms measure-only thresholds (`high: 80`, `low: 60`, `break: null`), creates `stryker.config.json` with `"checkers": ["typescript"]`, `"tsconfigFile": "tsconfig.json"`, and `"vitest": { "configFile": "vitest.unit.config.ts" }`, and wires the phase Gate's mutation command:

```powershell
node .github\skills\stryker-typescript\scripts\mutation-gate.mjs --since <phase-start-ref>
```

> **Tip about `mutation-addon.mjs`:** [work-planner](../.github/skills/work-planner/SKILL.md) auto-detects mutation skills via [mutation-addon.mjs](../.github/skills/work-planner/scripts/mutation-addon.mjs), which looks for `- **Mutation stack:**` and `- **Mutation command:**` lines in `.github/skills/*/SKILL.md`. To have `work-planner` auto-populate the mutation gate line, add these two lines to `.github/skills/stryker-typescript/SKILL.md` in your target repo:
>
> ```markdown
> - **Mutation stack:** node-typescript
> - **Mutation command:** node .github/skills/stryker-typescript/scripts/mutation-gate.mjs --since <phase-start-ref>
> ```

---

## Part 3: Build `csv-stats` End-to-End with the Workflow

Verify your working tree is clean before starting:

```powershell
git status --short
```

*(Should print nothing.)*

### Step 1 — Brainstorm Requirements (`/brain-storm`)

Type in **Copilot Chat**:

```text
/brain-storm I want to build a small Node.js TypeScript CLI called csv-stats that reads a CSV file and prints the row count plus min, max, and average for a chosen numeric column. It should support --column, --delimiter, and --json output, and exit non-zero on missing files, unknown columns, or non-numeric values.
```

**What happens:**

- The skill frames the work (`new`, `small`/`medium`) and walks the decision tree **one question at a time** (`Q1`, `Q2`, …).
- Answer in plain language; say `why?`, `example`, `park`, or `back to Q#` whenever you want to pause or revisit a choice.
- Confirm the readiness check when everything looks settled.

**Outputs created & auto-committed:**

- `.workflow/sessions/context-YYYY-MM-DD-HHmm.md` (`Status: final`)
- `.workflow/language.md`
- Runs `node .github/tools/workflow-check/bin/workflow-check.mjs` automatically and commits `docs(workflow): session csv-stats`.

---

### Step 2 — Write the Black-Box Behavior Spec (`/behavior-spec`)

Start a **new Copilot Chat session** and type:

```text
/behavior-spec csv-stats
```

**What happens:**

- Runs `node .github/tools/workflow-check/bin/workflow-check.mjs` first.
- Expands every active requirement (`R1`, `R2`, …) into observable CLI rules, failure outcomes, exact exit codes, and `Given / When / Then` examples.
- Records experience-based defaults in `Assumptions`, escalates only true user decisions, and leaves internal architecture/types in `Left To Planning`.

**Outputs created & auto-committed:**

- `.workflow/specs/csv-stats-spec.md`
- Auto-commits `docs(csv-stats): specify behavior`.

---

### Step 3 — Plan, Lock Tests, Build, Gate, and Review (`/pull-work`)

Start a **new Copilot Chat session** and type:

```text
/pull-work
```

From here on, `/pull-work` drives the workflow automatically until a **Checkpoint** or phase completion:

1. **Plan Mode (automatic):**
   - `repo-scout` inspects `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, and `eslint.config.js`.
   - Creates `.workflow/plans/csv-stats/plan.md` and `.workflow/plans/csv-stats/phase-01.md`.
   - Commits `docs(csv-stats): plan P01`.

2. **Setup-Card Checkpoint (if the phase needs harness setup, e.g., `tests/support/cli.ts` spawning `dist/cli.js`):**
   - Reply in **Copilot Chat**:

     ```text
     approve all
     ```

3. **Phase Review Checkpoint:**
   - Authors failing acceptance tests (`tests/acceptance/p01-s02.test.ts`, etc.) with `[R1-01]` scenario tags that spawn `node dist/cli.js` (never importing `src/`).
   - Presents cards, tests, `delegate`/`main` tiers, `Review: required` flags, and any ADR candidates in one checkpoint.
   - Reply in **Copilot Chat**:

     ```text
     approve all
     ```

   - Commits and locks the acceptance tests (`test(csv-stats): lock P01 acceptance tests` + `docs(csv-stats): start P01`). The pre-tool hook in [locked-tests.json](../.github/hooks/locked-tests.json) now blocks edits to locked acceptance tests.

4. **Dispatch (automatic):**
   - `main` cards build core structure/types in the main session; `delegate` cards run in parallel on the `coder` subagent.
   - Each slice runs `npm run typecheck && npm run build && npx vitest run -t "\[(...)\]"`, runs [fixture-leak.mjs](../.github/skills/pull-work/scripts/fixture-leak.mjs) on `delegate` cards, and commits (`feat(csv-stats): <slice name>`).

5. **Phase Gate & Critical-Code Review (automatic):**
   - Runs all 4 gate checks:
     1. **Suite:** `npm run typecheck && npm run lint && npm run format:check && npm run build && npx vitest run`
     2. **Traceability:** `npm run build && node .github/skills/vitest-typescript/scripts/trace.mjs <scenario-IDs>`
     3. **Lock check:** `git diff --exit-code <Tests locked> -- tests/acceptance`
     4. **Mutation gate:** `node .github/skills/stryker-typescript/scripts/mutation-gate.mjs --since <phase-start-ref>` *(note: `TypeRejected` mutants are reported as a sign of strong types, not failures)*
   - Runs `code-review` once on `Review: required` cards and completes the phase.

6. **Next Phase (until `Next: done`):**
   - Open a **fresh Copilot Chat session** and type:

     ```text
     /pull-work
     ```

### Step 4 — Verify Your Finished CLI (PowerShell)

Once `Next: done` is reached, build and run the CLI directly in PowerShell:

```powershell
# Build dist/
npm run build

# Create a sample CSV file
@"
item,price,qty
apple,1.50,4
banana,0.75,10
cherry,3.25,2
"@ | Set-Content -Path sample.csv

# Run the built CLI
node dist\cli.js sample.csv --column price
node dist\cli.js sample.csv --column price --json
Write-Host "Exit code: $LASTEXITCODE"

# Run the full local verification suite
npm run typecheck
npm run lint
npm run format:check
npx vitest run
npm run test:unit
```

Clean up your scratch CSV file when done:

```powershell
Remove-Item sample.csv
```

---

## Part 4: Day-2 Usage (Bugs & New Features)

- **Report a spec bug:** in a new Copilot Chat session, run:

  ```text
  /pull-work csv-stats bug: negative numbers in the target column are rejected as non-numeric
  ```

- **Add a new feature (e.g., `--median`):**
  1. New chat: `/brain-storm Add a --median flag to include the median in csv-stats output`
  2. New chat: `/behavior-spec csv-stats`
  3. New chat: `/pull-work` *(auto-reconciles the updated spec into a new phase)*

---

## Quick Reference: What You Type Where

| Stage | Where | Command |
| --- | --- | --- |
| Repo + workflow copy | PowerShell | Commands in Part 1 (`git init`, `npm init`, `Copy-Item`, initial `git commit`) |
| TypeScript + ESLint + Prettier | Copilot Chat | `/eslint-typescript baseline` → `/conventional-commit ...` |
| Test harness | Copilot Chat | `/vitest-typescript setup` → `/conventional-commit ...` |
| Requirements | Copilot Chat | `/brain-storm <idea>` |
| Behavior spec | Copilot Chat *(fresh)* | `/behavior-spec <slug>` |
| Plan + build + gate | Copilot Chat *(fresh per phase)* | `/pull-work` (reply `approve all` at checkpoints) |
| Mutation testing | Copilot Chat *(once unit tests exist)* | `/stryker-typescript baseline` |
| Report a bug | Copilot Chat | `/pull-work <slug> bug: <description>` |
