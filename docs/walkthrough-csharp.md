# C# / .NET Workflow Walkthrough

This guide walks through setting up a brand-new C# / .NET repository with the Personal Workflow, configuring the C# Language Add-ons (`dotnet-editorconfig` and `stryker-dotnet`), and building a small CLI application from initial idea to finished, verified code.

---

## Simple CLI Ideas to Practice the Workflow

Each of these cleanly separates a pure-logic class library (`*.Core`, targeted by unit tests and Stryker.NET) from a thin console host (`*.Cli`, targeted by black-box acceptance tests):

1. **`calc-repl`** *(used throughout this walkthrough)* — Interactive integer calculator REPL that reads arithmetic expressions from stdin, evaluates `+`, `-`, `*`, and `/` with standard precedence, and reports clear errors without crashing. Great for practicing clean Core/CLI separation, black-box REPL testing, and multi-phase growth.
2. **`env-check`** — Validates a `.env` file against a `.env.example` template (missing keys, empty values, extra keys, `--strict`, `--json`, distinct exit codes).
3. **`csv-stats`** — Reads a CSV file and computes row count plus `min`, `max`, and `avg` for a chosen numeric column (`--column`, `--delimiter`, `--json`).
4. **`todo-cli`** — Local JSON-backed task manager (`add`, `list`, `done`, `remove`, `--file`, `--status`). Great for practicing clean Core/CLI separation, file persistence, corrupted-file error handling, and multi-phase growth.
5. **`slug-rename`** — Batch-renames files in a folder to lowercase kebab-case (`--dry-run` default, `--apply` to rename, refuses on collisions). Great for practicing destructive-action escalations in [behavior-spec](../.github/skills/behavior-spec/SKILL.md) and `Review: required` cards in [work-planner](../.github/skills/work-planner/SKILL.md).

---

## Part 1: Set Up the New Repository (PowerShell)

Run these commands in **PowerShell** to create `C:\Projects\calc-repl`, scaffold a clean `.NET` solution with separate `Core`, `Cli`, `UnitTests`, and `AcceptanceTests` projects, and copy the Workflow Core plus the C# Language Add-ons.

### 1.1 Verify prerequisites (.NET SDK, Node.js, and Git)

```powershell
dotnet --version
node -v
git --version
```

> **Why Node.js is also needed for a C# repo:** The workflow's own deterministic helper scripts (`workflow-check.mjs`, `guard-locked-tests.mjs`, `reconcile-check.mjs`, `plan-check.mjs`, `fixture-leak.mjs`) run on Node.js with zero npm dependencies. Your C# application itself stays 100% .NET.

### 1.2 Create the solution, projects, and local `dotnet-stryker` tool manifest

Keeping business logic in `CalcRepl.Core` and thin read-eval-print wiring in `CalcRepl.Cli` matches [stryker-dotnet/SKILL.md](../language-addons/csharp/stryker-dotnet/SKILL.md): Stryker.NET mutates `CalcRepl.Core` using `CalcRepl.UnitTests`, while `CalcRepl.AcceptanceTests` drives the compiled REPL binary as a black box.

```powershell
New-Item -ItemType Directory -Path C:\Projects\calc-repl | Out-Null
Set-Location C:\Projects\calc-repl

git init -b main
dotnet new gitignore
dotnet new sln -n CalcRepl

# Production projects
dotnet new classlib -n CalcRepl.Core -o src\CalcRepl.Core
dotnet new console  -n CalcRepl.Cli  -o src\CalcRepl.Cli
dotnet add src\CalcRepl.Cli\CalcRepl.Cli.csproj reference src\CalcRepl.Core\CalcRepl.Core.csproj

# Test projects (xUnit)
dotnet new xunit -n CalcRepl.UnitTests       -o tests\CalcRepl.UnitTests
dotnet new xunit -n CalcRepl.AcceptanceTests -o tests\CalcRepl.AcceptanceTests
dotnet add tests\CalcRepl.UnitTests\CalcRepl.UnitTests.csproj reference src\CalcRepl.Core\CalcRepl.Core.csproj

# Register all projects in the solution
dotnet sln add src\CalcRepl.Core\CalcRepl.Core.csproj
dotnet sln add src\CalcRepl.Cli\CalcRepl.Cli.csproj
dotnet sln add tests\CalcRepl.UnitTests\CalcRepl.UnitTests.csproj
dotnet sln add tests\CalcRepl.AcceptanceTests\CalcRepl.AcceptanceTests.csproj

# Pin dotnet-stryker as a local .NET tool
dotnet new tool-manifest
dotnet tool install dotnet-stryker

# Verify the empty solution builds and runs tests
dotnet test
```

### 1.3 Copy the Workflow Core and C# Language Add-ons

This copies the portable workflow pieces (`.github/agents`, `.github/hooks`, `.github/skills`, `.github/tools/workflow-check`, and `.github/user-interaction.md`) along with the C# skills ([dotnet-editorconfig](../language-addons/csharp/dotnet-editorconfig/SKILL.md), [stryker-dotnet](../language-addons/csharp/stryker-dotnet/SKILL.md)) and the shared [mutation-testing](../language-addons/mutation-testing/protocol.md) protocol.

```powershell
$workflowSrc = "C:\Projects\Personal.Workflow"

# Create .github folders
New-Item -ItemType Directory -Path .github\tools, .github\skills -Force | Out-Null

# Copy Workflow Core
Copy-Item -Recurse "$workflowSrc\.github\agents"                ".github\agents"
Copy-Item -Recurse "$workflowSrc\.github\hooks"                 ".github\hooks"
Copy-Item -Recurse "$workflowSrc\.github\skills\*"              ".github\skills"
Copy-Item -Recurse "$workflowSrc\.github\tools\workflow-check"  ".github\tools\workflow-check"
Copy-Item          "$workflowSrc\.github\user-interaction.md"   ".github\user-interaction.md"

# Copy C# Language Add-ons + shared mutation-testing protocol
Copy-Item -Recurse "$workflowSrc\language-addons\csharp\dotnet-editorconfig" ".github\skills\dotnet-editorconfig"
Copy-Item -Recurse "$workflowSrc\language-addons\csharp\stryker-dotnet"      ".github\skills\stryker-dotnet"
Copy-Item -Recurse "$workflowSrc\language-addons\mutation-testing"           ".github\skills\mutation-testing"
```

### 1.4 Ignore Stryker output and make the initial commit

`/pull-work` enforces a clean Git working tree before every run, so add `StrykerOutput/` to `.gitignore` and commit the scaffold first:

```powershell
Add-Content -Path .gitignore -Value "`nStrykerOutput/"

git add .
git commit -m "chore(calc-repl): initialize CalcRepl .NET solution with personal workflow"
git status --short
```

### 1.5 Open the new repository in VS Code

```powershell
code C:\Projects\calc-repl
```

---

## Part 2: Configure the C# Language Add-ons (Copilot Chat)

Open Copilot Chat in the `C:\Projects\calc-repl` workspace.

### 2.1 Configure `.editorconfig` and `Directory.Build.props`

Type in **Copilot Chat**:

```text
/dotnet-editorconfig baseline
```

The skill will ask you to confirm 3 inputs:

1. Target framework(s) → answer: `net10.0` *(or `net8.0` / `net9.0`, matching your `dotnet --version`)*
2. Indent size → answer: `default (4 for C#, 2 for markup)`
3. Enforcement level → answer: `all errors now`

It creates `.editorconfig` and `Directory.Build.props` at the repository root (enforcing `EnforceCodeStyleInBuild`, `EnableNETAnalyzers`, `AnalysisLevel`, `Nullable`, and `TreatWarningsAsErrors` across every project), strips conflicting properties from individual `.csproj` files, and verifies with:

```powershell
dotnet build -c Release
dotnet format --verify-no-changes
```

Commit the code-style setup in **Copilot Chat**:

```text
/conventional-commit add root editorconfig and Directory.Build.props enforcement
```

*(Approve the proposed commit message when prompted.)*

### 2.2 Configure Stryker.NET (Mutation Testing)

Per [stryker-dotnet/SKILL.md](../language-addons/csharp/stryker-dotnet/SKILL.md) and [protocol.md](../language-addons/mutation-testing/protocol.md), **wait to run `/stryker-dotnet baseline` until `CalcRepl.UnitTests` has at least one real unit test covering `CalcRepl.Core`** (during or right after Phase 1 setup).

Once your first unit test exists, run in **Copilot Chat**:

```text
/stryker-dotnet baseline
```

It confirms measure-only thresholds (`high: 80`, `low: 60`, `break: 0`) and writes `stryker-config.json` at the repository root targeting `CalcRepl.Core.csproj`.

> **Most Important Stryker.NET Rule:** Always run `dotnet stryker` from the **unit-test project folder** (`tests\CalcRepl.UnitTests`), **never** from the solution root. Running from the solution root triggers solution mode, which runs acceptance tests against mutants and invalidates the unit-test mutation score.
>
> Example command (PowerShell, from the repo root):
> ```powershell
> Push-Location tests\CalcRepl.UnitTests
> dotnet stryker --config-file ..\..\stryker-config.json --configuration Release --since:<phase-start-ref> --output ..\..\StrykerOutput\p01 2>&1 | Tee-Object ..\..\StrykerOutput\p01-console.log
> Pop-Location
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
/brain-storm I want to build an interactive integer calculator REPL called calc-repl in C# .NET with zero external runtime dependencies. It reads arithmetic expressions from stdin, evaluates binary +, -, *, and / with standard operator precedence (* and / before + and -), uses truncating integer division toward zero (for example, 7 / 2 = 3), reports a clear error on divide-by-zero or invalid expressions and re-prompts without crashing the loop, and exits cleanly on exit, quit, or EOF.
```

**What happens:**

- The skill frames the work (`new`, `small`/`medium`) and walks the decision tree **one question at a time** (`Q1`, `Q2`, …).
- Answer in plain language; say `why?`, `example`, `park`, or `back to Q#` at any time.
- Confirm the readiness check when everything feels settled.

**Outputs created & auto-committed:**

- `.workflow/sessions/context-YYYY-MM-DD-HHmm.md` (`Status: final`)
- `.workflow/language.md` (canonical terms like *Expression*, *Operand*, *Operator*, *Result*)
- Runs `node .github/tools/workflow-check/bin/workflow-check.mjs` automatically and commits `docs(workflow): session calc-repl`.

---

### Step 2 — Write the Black-Box Behavior Spec (`/behavior-spec`)

Start a **new Copilot Chat session** and type:

```text
/behavior-spec calc-repl
```

**What happens:**

- Runs `node .github/tools/workflow-check/bin/workflow-check.mjs` first.
- Expands every active requirement (`R1`, `R2`, …) into observable REPL rules, failure outcomes (e.g., divide-by-zero prints an error, the prompt returns, and the loop keeps running), and `Given / When / Then` examples.
- Escalates only true user decisions (for example, what a blank line prints or how EOF is reported); records defensible defaults in `Assumptions`.

**Outputs created & auto-committed:**

- `.workflow/specs/calc-repl-spec.md`
- Auto-commits `docs(calc-repl): specify behavior`.

---

### Step 3 — Plan, Lock Tests, Build, Gate, and Review (`/pull-work`)

Start a **new Copilot Chat session** and type:

```text
/pull-work
```

From here on, `/pull-work` drives the workflow automatically until a **Checkpoint** or phase completion.

**Black-box REPL testing:** acceptance tests never import `CalcRepl.Core` internals. Each test drives the REPL from the outside by piping multi-line input over `stdin` (or spawning the built `CalcRepl.Cli` executable with redirected `stdin`/`stdout`/`stderr`) and then asserts on `stdout`, `stderr`, and the process exit code.

1. **Plan Mode (automatic):**
   - `repo-scout` surveys `CalcRepl.sln`, `Directory.Build.props`, `src\`, and `tests\`.
   - Creates `.workflow/plans/calc-repl/plan.md` and `.workflow/plans/calc-repl/phase-01.md`.
   - Sets up the .NET test harness conventions (for example, xUnit `[Fact(DisplayName = "[R1-01] ...")]` with `dotnet test --filter "DisplayName~[R1-01]"` and `dotnet build -c Release && dotnet format --verify-no-changes && dotnet test -c Release` in the phase Gate).
   - Commits `docs(calc-repl): plan P01`.

2. **Setup-Card Approval (if the phase needs a REPL process-runner helper in `tests/CalcRepl.AcceptanceTests/Support/`):**
   - Reply in **Copilot Chat**:

     ```text
     approve all
     ```

3. **Phase Review:**
   - Authors failing black-box acceptance tests in `tests/CalcRepl.AcceptanceTests/` tagged with `[R1-01]`, `[R1-02]`, … that pipe expressions into the built `CalcRepl.Cli` executable (spawned with redirected stdin/stdout/stderr) and assert on its output and exit code (never referencing `CalcRepl.Core` internals).
   - Presents all cards, tests, `delegate`/`main` tiers, `Review: required` flags, and any ADR candidates in one checkpoint.
   - Reply in **Copilot Chat**:

     ```text
     approve all
     ```

   - Commits and locks the acceptance tests (`test(calc-repl): lock P01 acceptance tests` + `docs(calc-repl): start P01`). From this point on, the pre-tool hook in [locked-tests.json](../.github/hooks/locked-tests.json) blocks edits to locked acceptance tests.

4. **Dispatch (automatic):**
   - `main` cards establish core domain types (tokens, parser, evaluator) in `CalcRepl.Core`; `delegate` cards implement individual behaviors (in parallel when files don't overlap).
   - Each completed slice is verified and committed (`feat(calc-repl): <slice name>`).

5. **Phase Gate & Critical-Code Review (automatic):**
   - Runs the phase Gate:
     1. **Suite & Style:** `dotnet build -c Release && dotnet format --verify-no-changes && dotnet test -c Release`
     2. **Traceability:** verifies every owned scenario ID has a passing tagged test
     3. **Lock check:** `git diff --exit-code <Tests locked> -- tests/CalcRepl.AcceptanceTests`
     4. **Mutation gate:** runs `dotnet stryker` from `tests\CalcRepl.UnitTests` against `CalcRepl.Core.csproj` (once Stryker is configured)
   - Runs `code-review` once on `Review: required` cards and completes the phase.

6. **Next Phase (until `Next: done`):**
   - Open a **fresh Copilot Chat session** and type:

     ```text
     /pull-work
     ```

### Step 4 — Verify Your Finished CLI (PowerShell)

Once `Next: done` is reached, pipe a multi-line session into the REPL in PowerShell. Expected output: `14`, `3`, a divide-by-zero error, an invalid-expression error, then a clean exit.

```powershell
# Build in Release configuration
dotnet build -c Release

# Pipe a multi-line session into the REPL (no scratch files needed)
$expressions = @'
2 + 3 * 4
7 / 2
10 / 0
2 + * 3
exit
'@
$expressions | dotnet run --project src\CalcRepl.Cli -c Release
if ($LASTEXITCODE -ne 0) { throw "calc-repl exited with code $LASTEXITCODE" }

# Run the full local verification suite
dotnet format --verify-no-changes
dotnet test -c Release
```

Running `dotnet run --project src\CalcRepl.Cli -c Release` without piped input starts an interactive session: type one expression per line and type `exit` (or `quit`, or press Ctrl+Z then Enter) to leave it.

---

## Part 4: Day-2 Usage (Bugs & New Features)

- **Report a spec bug:** in a new Copilot Chat session, run:

  ```text
  /pull-work calc-repl bug: chained subtraction like 10 - 3 - 2 returns 9 instead of 5
  ```

- **Add the v1 evolution features (unary negatives, parentheses, and `^` exponents):** run one combined pass:
  1. New chat: run the brainstorm prompt below:

     ```text
     /brain-storm Add unary negative numbers (for example, -5 + 2 = -3), parentheses for grouping (for example, (2 + 3) * 4 = 20), and integer exponents using ^ (for example, 2 ^ 3 = 8), reporting negative exponents like 2 ^ -3 as an unsupported error and re-prompting without crashing.
     ```

  2. New chat: `/behavior-spec calc-repl`
  3. New chat: `/pull-work` *(auto-reconciles the updated spec into a new phase)*

  Note: these three features can alternatively be split into separate smaller passes (one feature per brainstorm → behavior-spec → pull-work cycle) if you prefer smaller phases.

---

## Quick Reference: What You Type Where

| Stage | Where | Command |
| --- | --- | --- |
| Solution + workflow copy | PowerShell | Commands in Part 1 (`git init`, `dotnet new`, `Copy-Item`, initial `git commit`) |
| Code style & analyzers | Copilot Chat | `/dotnet-editorconfig baseline` → `/conventional-commit ...` |
| Requirements | Copilot Chat | `/brain-storm <idea>` |
| Behavior spec | Copilot Chat *(fresh)* | `/behavior-spec <slug>` |
| Plan + build + gate | Copilot Chat *(fresh per phase)* | `/pull-work` (reply `approve all` at checkpoints) |
| Mutation testing | Copilot Chat *(once unit tests exist)* | `/stryker-dotnet baseline` |
| Report a bug | Copilot Chat | `/pull-work <slug> bug: <description>` |
