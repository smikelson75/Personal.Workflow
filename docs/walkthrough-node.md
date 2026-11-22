# Node.js JavaScript Workflow Walkthrough

This guide walks through setting up a brand-new Node.js JavaScript repository with the Personal Workflow, configuring the Node.js language skills, and building a small CLI application from initial idea to finished, verified code.

---

## Simple CLI Ideas to Practice the Workflow

Each of these uses zero external runtime dependencies, has clear black-box CLI behavior for Vitest acceptance tests, and has pure logic modules that make StrykerJS mutation testing meaningful:

1. **`calc-repl`** *(used throughout this walkthrough)* — Interactive integer calculator REPL that reads expressions from stdin, evaluates `+`, `-`, `*`, and `/` with standard precedence (truncating integer division), and recovers from divide-by-zero and invalid input. Great for practicing black-box REPL testing, precedence and parser unit tests, and error-recovery behavior.
2. **`env-check`** — Validates a `.env` file against a `.env.example` template (reports missing keys, empty values, and optionally extra undocumented keys; supports `--strict` and `--json`; returns distinct exit codes). Great for practicing validation rules, exit codes, and pure parser/validator unit tests.
3. **`csv-stats`** — Reads a CSV file and prints row count plus `min`, `max`, and `avg` for a chosen numeric column (`--column`, `--delimiter`, `--json`). Great for seeing StrykerJS catch boundary-condition bugs (`<` vs `<=`, empty rows, non-numeric cells).
4. **`todo-cli`** — Local JSON-backed task list (`add`, `list`, `done`, `remove`, `--file`). Great for practicing multi-phase planning and corrupted-file error handling.
5. **`slug-rename`** — Batch-renames files in a folder to lowercase kebab-case (`--dry-run` default, `--apply` to rename, refuses on filename collisions). Great for practicing destructive-action escalations in [behavior-spec](../.github/skills/behavior-spec/SKILL.md) and `Review: required` cards in [work-planner](../.github/skills/work-planner/SKILL.md).

---

## Part 1: Set Up the New Repository (PowerShell)

Run these commands in **PowerShell** to create `C:\Projects\calc-repl`, initialize Git and Node.js (ESM + LTS), and copy the core workflow plus the Node.js JavaScript language skills.

### 1.1 Verify prerequisites (Node.js LTS 22.12+ or 24, and Git)

```powershell
node -v
git --version
```

> **Note:** Use an active Node.js LTS release (`22.12+` or `24`). Odd-numbered releases (`23`, `25`) fall outside Vitest's supported engines.

### 1.2 Create the project and initialize Git + `package.json`

```powershell
New-Item -ItemType Directory -Path C:\Projects\calc-repl | Out-Null
Set-Location C:\Projects\calc-repl

git init -b main
npm init -y
npm pkg set name="calc-repl" version="0.1.0" type="module" engines.node=">=22.12.0" bin.calc-repl="bin/calc-repl.js"
"22" | Set-Content -Path .nvmrc -NoNewline
```

### 1.3 Copy the core workflow and Node.js language skills

This copies the portable workflow pieces (`.github/agents`, `.github/hooks`, `.github/skills`, `.github/tools/workflow-check`, and `.github/user-interaction.md`) along with the Node.js JavaScript skills ([eslint-javascript](../language-skills/node-javascript/eslint-javascript/SKILL.md), [vitest-javascript](../language-skills/node-javascript/vitest-javascript/SKILL.md), [stryker-javascript](../language-skills/node-javascript/stryker-javascript/SKILL.md)) and the shared [mutation-testing](../language-skills/mutation-testing/protocol.md) protocol that `stryker-javascript` links to.

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

# Copy Node.js JavaScript language skills + shared mutation-testing protocol
Copy-Item -Recurse "$workflowSrc\language-skills\node-javascript\eslint-javascript"  ".github\skills\eslint-javascript"
Copy-Item -Recurse "$workflowSrc\language-skills\node-javascript\vitest-javascript"  ".github\skills\vitest-javascript"
Copy-Item -Recurse "$workflowSrc\language-skills\node-javascript\stryker-javascript" ".github\skills\stryker-javascript"
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
git commit -m "chore: initialize calc-repl repository with personal workflow"
git status --short
```

### 1.5 Open the new repository in VS Code

```powershell
code C:\Projects\calc-repl
```

---

## Part 2: Configure the Node.js Language Skills (Copilot Chat)

Open Copilot Chat in the `C:\Projects\calc-repl` workspace. Configure the three Node.js language skills in order: **ESLint + Prettier** → **Vitest** → **StrykerJS**.

### 2.1 Configure ESLint + Prettier

Type in **Copilot Chat**:

```text
/eslint-javascript baseline
```

The skill will ask you to confirm 3 inputs:

1. Runtime environments → answer: `Node only`
2. Prettier defaults → answer: `keep defaults`
3. Enforcement level → answer: `all errors now`

It installs `eslint`, `@eslint/js`, `globals`, `prettier`, and `eslint-config-prettier`, writes `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, and `.gitattributes`, adds `lint`, `lint:fix`, `format`, and `format:check` scripts to `package.json`, runs `npm run lint` and `npm run format:check`, and verifies enforcement with a smoke test.

Commit the style setup cleanly in **Copilot Chat**:

```text
/conventional-commit add eslint and prettier baseline
```

*(Approve the proposed commit message when prompted.)*

### 2.2 Configure Vitest

Type in **Copilot Chat**:

```text
/vitest-javascript setup
```

The skill installs `vitest`, creates `vitest.config.js` and `vitest.unit.config.js`, adds `"test": "vitest run"` and `"test:unit": "vitest run --config vitest.unit.config.js"` to `package.json`, and verifies the `tests/unit` and `tests/acceptance` layout.

Commit the harness setup in **Copilot Chat**:

```text
/conventional-commit add vitest test harness configuration
```

### 2.3 Configure StrykerJS (Mutation Testing)

Per [stryker-javascript/SKILL.md](../language-skills/node-javascript/stryker-javascript/SKILL.md) and [protocol.md](../language-skills/mutation-testing/protocol.md), **wait to run `/stryker-javascript baseline` until at least one unit test exists** (during or right after Phase 1 setup). Running it before any unit tests exist will stop with *"no unit tests"*.

Once your first unit test exists, run in **Copilot Chat**:

```text
/stryker-javascript baseline
```

It installs `@stryker-mutator/core` and `@stryker-mutator/vitest-runner`, confirms measure-only thresholds (`high: 80`, `low: 60`, `break: null`), creates `stryker.config.json` pointing `vitest.configFile` at `vitest.unit.config.js`, and wires the phase Gate's mutation command:

```powershell
node .github\skills\stryker-javascript\scripts\mutation-gate.mjs --since <phase-start-ref>
```

> **Tip about `mutation-addon.mjs`:** [work-planner](../.github/skills/work-planner/SKILL.md) auto-detects mutation skills via [mutation-addon.mjs](../.github/skills/work-planner/scripts/mutation-addon.mjs), which looks for `- **Mutation stack:**` and `- **Mutation command:**` lines in `.github/skills/*/SKILL.md`. If you want `work-planner` to auto-populate the mutation gate line without copying it manually from [vitest-javascript/SKILL.md](../language-skills/node-javascript/vitest-javascript/SKILL.md), add these two lines to `.github/skills/stryker-javascript/SKILL.md` in your target repo:
>
> ```markdown
> - **Mutation stack:** node-javascript
> - **Mutation command:** node .github/skills/stryker-javascript/scripts/mutation-gate.mjs --since <phase-start-ref>
> ```

---

## Part 3: Build `calc-repl` End-to-End with the Workflow

Verify your working tree is clean before starting:

```powershell
git status --short
```

*(Should print nothing.)*

### Step 1 — Brainstorm Requirements (`/brain-storm`)

Type in **Copilot Chat**:

```text
/brain-storm I want to build an interactive integer calculator REPL called calc-repl in Node.js with zero external runtime dependencies. It reads arithmetic expressions from stdin, evaluates binary +, -, *, and / with standard operator precedence (* and / before + and -), uses truncating integer division toward zero (for example, 7 / 2 = 3), reports a clear error on divide-by-zero or invalid expressions and re-prompts without crashing the loop, and exits cleanly on exit, quit, or EOF.
```

**What happens:**

- The skill frames the work (`new`, `small`/`medium`) and walks the decision tree **one question at a time** (`Q1`, `Q2`, …).
- You can answer in plain English, or say `why?`, `example`, `park`, or `back to Q#` at any time.
- Implementation details (libraries, internal file layout) stay out of brainstorming; behavioral details (exact CLI flags, exact exit codes) are marked `deferred-to-spec`.
- When the readiness check looks right, confirm it.

**Outputs created & auto-committed:**

- `.workflow/sessions/context-YYYY-MM-DD-HHmm.md` (`Status: final`)
- `.workflow/language.md` (canonical domain terms)
- Runs `node .github/tools/workflow-check/bin/workflow-check.mjs` automatically and commits `docs(workflow): session calc-repl`.

---

### Step 2 — Write the Black-Box Behavior Spec (`/behavior-spec`)

Start a **new Copilot Chat session** (keeps token usage low) and type:

```text
/behavior-spec calc-repl
```

**What happens:**

- Runs `node .github/tools/workflow-check/bin/workflow-check.mjs` first to verify the session and glossary.
- Expands every settled requirement (`R1`, `R2`, …) into observable rules, failure outcomes, exact CLI output/exit codes, and `Given / When / Then` examples.
- Decides experience-based defaults itself (listing them under `Assumptions`) and **only asks you** about true escalations (contradictions, destructive/security behavior, ungrounded UX forks, or uncalibrated thresholds).
- Places internal design choices under `Left To Planning`.

**Outputs created & auto-committed:**

- `.workflow/specs/calc-repl-spec.md`
- Auto-commits `docs(calc-repl): specify behavior`.

---

### Step 3 — Plan, Lock Tests, Build, Gate, and Review (`/pull-work`)

**Black-box REPL testing:** the acceptance tests treat `calc-repl` as a black box. Each test runs the REPL with multi-line input piped over `stdin` (or by spawning `node bin/calc-repl.js` with redirected `stdin`, `stdout`, and `stderr`) and asserts only on what comes out of `stdout`, `stderr`, and the exit code. Setup cards and Phase Review examples follow the same pattern, for example a `tests/support/repl.js` helper that spawns `node bin/calc-repl.js`.

Start a **new Copilot Chat session** and type:

```text
/pull-work
```

From here on, `/pull-work` is the **only command you need**. It Reads `Next:` in `.workflow/plans/calc-repl/plan.md` and advances automatically until it hits a **Checkpoint** or finishes the phase:

1. **Plan Mode (automatic):**
   - Dispatches `repo-scout` to inspect your repo (`package.json`, Vitest config, ESLint config).
   - Creates `.workflow/plans/calc-repl/plan.md` and `.workflow/plans/calc-repl/phase-01.md` with thin vertical slice cards (`S01`, `S02`, …).
   - Commits `docs(calc-repl): plan P01`.

2. **Setup-Card Checkpoint (if the phase needs harness setup, e.g., `tests/support/cli.js`):**
   - Shows the setup card(s) and any ADR candidates in one bundled question.
   - Reply in **Copilot Chat**:

     ```text
     approve all
     ```

     *(Or name a specific card ID like `S01` to discuss or adjust it first.)*

3. **Phase Review Checkpoint:**
   - Authors failing black-box acceptance tests (`tests/acceptance/p01-s02.test.js`, etc.) with `[R1-01]` scenario tags—leaving them uncommitted so you can inspect the diff.
   - Presents all cards, tests, `delegate`/`main` tiers, `Review: required` flags, and any ADR candidates in one bundled checkpoint.
   - Reply in **Copilot Chat**:

     ```text
     approve all
     ```

   - `/pull-work` commits and **locks** the acceptance tests (`test(calc-repl): lock P01 acceptance tests` + `docs(calc-repl): start P01`). From this point on, the pre-tool hook in [locked-tests.json](../.github/hooks/locked-tests.json) blocks any agent from editing locked acceptance tests.

4. **Dispatch (automatic, no prompts unless blocked):**
   - `main` cards (e.g., core parser/module structure) are built in the main session.
   - `delegate` cards (independent slices following an established pattern) are dispatched to the `coder` subagent—in parallel when their `Files` don't overlap.
   - After each card passes its `Done when` command, `/pull-work` runs [fixture-leak.mjs](../.github/skills/pull-work/scripts/fixture-leak.mjs) on `delegate` cards and commits the slice (`feat(calc-repl): <slice name>`).

5. **Phase Gate & Critical-Code Review (automatic):**
   - Runs all 4 gate checks:
     1. **Suite:** `npm run lint && npm run format:check && npx vitest run`
     2. **Traceability:** `node .github/skills/vitest-javascript/scripts/trace.mjs <scenario-IDs>` (from [trace.mjs](../language-skills/node-javascript/vitest-javascript/scripts/trace.mjs))
     3. **Lock check:** `git diff --exit-code <Tests locked> -- tests/acceptance`
     4. **Mutation gate:** `node .github/skills/stryker-javascript/scripts/mutation-gate.mjs --since <phase-start-ref>` (or skipped if not yet enabled)
   - Runs the `code-review` agent once on any cards marked `Review: required`.
   - Marks Phase 1 `completed` and stops with a phase brief.

6. **Next Phase (until `Next: done`):**
   - Open a **fresh Copilot Chat session** and type:

     ```text
     /pull-work
     ```

   - Repeat until `/pull-work` reports that `Next` is `done`.

### Step 4 — Verify Your Finished CLI (PowerShell)

Once `Next: done` is reached, test the REPL directly in PowerShell. Pipe a multi-line here-string into `node bin\calc-repl.js`:

```powershell
@'
2 + 3 * 4
7 / 2
10 / 0
2 + * 3
exit
'@ | node bin\calc-repl.js
Write-Host "Exit code: $LASTEXITCODE"

# Run the full local verification suite
npm run lint
npm run format:check
npx vitest run
npm run test:unit
```

Expected output: `14`, `3`, a divide-by-zero error, an invalid-expression error (the REPL re-prompts after each error without crashing), then a clean exit with code `0`.

> **Note:** Running `node bin\calc-repl.js` without piped input starts an interactive session that waits for you to type expressions. Type `exit` or `quit` (or press Ctrl+Z then Enter) to leave it.

---

## Part 4: Day-2 Usage (Bugs & New Features)

- **Found a bug that violates the spec?** In a new Copilot Chat session, run:

  ```text
  /pull-work calc-repl bug: chained subtraction like 10 - 3 - 2 returns 9 instead of 5
  ```

  `/pull-work` routes to Defect mode, creates a reproducing acceptance test, pauses at Phase Review for your `approve all`, fixes it, runs the gate, and commits.

- **Want to add new features (unary negatives, parentheses, and `^` exponents)?** Use one combined pass:
  1. New chat:

     ```text
     /brain-storm Add unary negative numbers (for example, -5 + 2 = -3), parentheses for grouping (for example, (2 + 3) * 4 = 20), and integer exponents using ^ (for example, 2 ^ 3 = 8), reporting negative exponents like 2 ^ -3 as an unsupported error and re-prompting without crashing.
     ```

  2. New chat: `/behavior-spec calc-repl`
  3. New chat: `/pull-work` *(automatically detects the spec changed via `reconcile-check.mjs`, reconciles the plan into a new phase, and executes it)*

  > **Note:** You can alternatively split these three features into separate smaller passes (one `/brain-storm` → `/behavior-spec calc-repl` → `/pull-work` cycle per feature) if you want smaller reviews.

---

## Quick Reference: What You Type Where

| Stage | Where | Command |
| --- | --- | --- |
| Repo + workflow copy | PowerShell | Commands in Part 1 (`git init`, `npm init`, `Copy-Item`, initial `git commit`) |
| Linting & formatting | Copilot Chat | `/eslint-javascript baseline` → `/conventional-commit ...` |
| Test harness | Copilot Chat | `/vitest-javascript setup` → `/conventional-commit ...` |
| Requirements | Copilot Chat | `/brain-storm <idea>` |
| Behavior spec | Copilot Chat *(fresh)* | `/behavior-spec <slug>` |
| Plan + build + gate | Copilot Chat *(fresh per phase)* | `/pull-work` (reply `approve all` at checkpoints) |
| Mutation testing | Copilot Chat *(once unit tests exist)* | `/stryker-javascript baseline` |
| Report a bug | Copilot Chat | `/pull-work <slug> bug: <description>` |
