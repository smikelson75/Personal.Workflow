# C# / .NET Workflow Walkthrough

This guide walks through setting up a brand-new C# / .NET repository with the Personal Workflow, configuring the C# language skills (`dotnet-editorconfig` and `stryker-dotnet`), and building a small CLI application from initial idea to finished, verified code.

---

## Simple CLI Ideas to Practice the Workflow

Each of these cleanly separates a pure-logic class library (`*.Core`, targeted by unit tests and Stryker.NET) from a thin console host (`*.Cli`, targeted by black-box acceptance tests):

1. **`todo-cli`** *(used throughout this walkthrough)* — Local JSON-backed task manager (`add`, `list`, `done`, `remove`, `--file`, `--status`). Great for practicing clean Core/CLI separation, file persistence, corrupted-file error handling, and multi-phase growth.
2. **`env-check`** — Validates a `.env` file against a `.env.example` template (missing keys, empty values, extra keys, `--strict`, `--json`, distinct exit codes).
3. **`csv-stats`** — Reads a CSV file and computes row count plus `min`, `max`, and `avg` for a chosen numeric column (`--column`, `--delimiter`, `--json`).
4. **`slug-rename`** — Batch-renames files in a folder to lowercase kebab-case (`--dry-run` default, `--apply` to rename, refuses on collisions). Great for practicing destructive-action escalations in [behavior-spec](../.github/skills/behavior-spec/SKILL.md) and `Review: required` cards in [work-planner](../.github/skills/work-planner/SKILL.md).

---

## Part 1: Set Up the New Repository (PowerShell)

Run these commands in **PowerShell** to create `C:\Projects\todo-cli`, scaffold a clean `.NET` solution with separate `Core`, `Cli`, `UnitTests`, and `AcceptanceTests` projects, and copy the core workflow plus the C# language skills.

### 1.1 Verify prerequisites (.NET SDK, Node.js, and Git)

```powershell
dotnet --version
node -v
git --version
```

> **Why Node.js is also needed for a C# repo:** The workflow's own deterministic helper scripts (`workflow-check.mjs`, `guard-locked-tests.mjs`, `reconcile-check.mjs`, `plan-check.mjs`, `fixture-leak.mjs`) run on Node.js with zero npm dependencies. Your C# application itself stays 100% .NET.

### 1.2 Create the solution, projects, and local `dotnet-stryker` tool manifest

Keeping business logic in `TodoCli.Core` and thin argument/IO wiring in `TodoCli.Cli` matches [stryker-dotnet/SKILL.md](../language-skills/csharp/stryker-dotnet/SKILL.md): Stryker.NET mutates `TodoCli.Core` using `TodoCli.UnitTests`, while `TodoCli.AcceptanceTests` drives the compiled CLI binary as a black box.

```powershell
New-Item -ItemType Directory -Path C:\Projects\todo-cli | Out-Null
Set-Location C:\Projects\todo-cli

git init -b main
dotnet new gitignore
dotnet new sln -n TodoCli

# Production projects
dotnet new classlib -n TodoCli.Core -o src\TodoCli.Core
dotnet new console  -n TodoCli.Cli  -o src\TodoCli.Cli
dotnet add src\TodoCli.Cli\TodoCli.Cli.csproj reference src\TodoCli.Core\TodoCli.Core.csproj

# Test projects (xUnit)
dotnet new xunit -n TodoCli.UnitTests       -o tests\TodoCli.UnitTests
dotnet new xunit -n TodoCli.AcceptanceTests -o tests\TodoCli.AcceptanceTests
dotnet add tests\TodoCli.UnitTests\TodoCli.UnitTests.csproj reference src\TodoCli.Core\TodoCli.Core.csproj

# Register all projects in the solution
dotnet sln add src\TodoCli.Core\TodoCli.Core.csproj
dotnet sln add src\TodoCli.Cli\TodoCli.Cli.csproj
dotnet sln add tests\TodoCli.UnitTests\TodoCli.UnitTests.csproj
dotnet sln add tests\TodoCli.AcceptanceTests\TodoCli.AcceptanceTests.csproj

# Pin dotnet-stryker as a local .NET tool
dotnet new tool-manifest
dotnet tool install dotnet-stryker

# Verify the empty solution builds and runs tests
dotnet test
```

### 1.3 Copy the core workflow and C# language skills

This copies the portable workflow pieces (`.github/agents`, `.github/hooks`, `.github/skills`, `.github/tools/workflow-check`, `.github/user-interaction.md`, and `AGENTS.md`) along with the C# skills ([dotnet-editorconfig](../language-skills/csharp/dotnet-editorconfig/SKILL.md), [stryker-dotnet](../language-skills/csharp/stryker-dotnet/SKILL.md)) and the shared [mutation-testing](../language-skills/mutation-testing/protocol.md) protocol.

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

# Copy C# language skills + shared mutation-testing protocol
Copy-Item -Recurse "$workflowSrc\language-skills\csharp\dotnet-editorconfig" ".github\skills\dotnet-editorconfig"
Copy-Item -Recurse "$workflowSrc\language-skills\csharp\stryker-dotnet"      ".github\skills\stryker-dotnet"
Copy-Item -Recurse "$workflowSrc\language-skills\mutation-testing"           ".github\skills\mutation-testing"
```

### 1.4 Ignore Stryker output and make the initial commit

`/pull-work` enforces a clean Git working tree before every run, so add `StrykerOutput/` to `.gitignore` and commit the scaffold first:

```powershell
Add-Content -Path .gitignore -Value "`nStrykerOutput/"

git add .
git commit -m "chore: initialize todo-cli .NET solution with personal workflow"
git status --short
```

### 1.5 Open the new repository in VS Code

```powershell
code C:\Projects\todo-cli
```

---

## Part 2: Configure the C# Language Skills (Copilot Chat)

Open Copilot Chat in the `C:\Projects\todo-cli` workspace.

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

Per [stryker-dotnet/SKILL.md](../language-skills/csharp/stryker-dotnet/SKILL.md) and [protocol.md](../language-skills/mutation-testing/protocol.md), **wait to run `/stryker-dotnet baseline` until `TodoCli.UnitTests` has at least one real unit test covering `TodoCli.Core`** (during or right after Phase 1 setup).

Once your first unit test exists, run in **Copilot Chat**:

```text
/stryker-dotnet baseline
```

It confirms measure-only thresholds (`high: 80`, `low: 60`, `break: 0`) and writes `stryker-config.json` at the repository root targeting `TodoCli.Core.csproj`.

> **Most Important Stryker.NET Rule:** Always run `dotnet stryker` from the **unit-test project folder** (`tests\TodoCli.UnitTests`), **never** from the solution root. Running from the solution root triggers solution mode, which runs acceptance tests against mutants and invalidates the unit-test mutation score.
>
> Example command (PowerShell, from the repo root):
> ```powershell
> Push-Location tests\TodoCli.UnitTests
> dotnet stryker --config-file ..\..\stryker-config.json --configuration Release --since:<phase-start-ref> --output ..\..\StrykerOutput\p01 2>&1 | Tee-Object ..\..\StrykerOutput\p01-console.log
> Pop-Location
> ```

---

## Part 3: Build `todo-cli` End-to-End with the Workflow

Verify your working tree is clean before starting:

```powershell
git status --short
```

*(Should print nothing.)*

### Step 1 — Brainstorm Requirements (`/brain-storm`)

Type in **Copilot Chat**:

```text
/brain-storm I want to build a small C# .NET CLI called todo-cli that manages a local JSON task list. Users can run add, list, done, and remove commands, optionally passing --file to choose the task file path, with clear exit codes and safe handling of missing or corrupted task files.
```

**What happens:**

- The skill frames the work (`new`, `small`/`medium`) and walks the decision tree **one question at a time** (`Q1`, `Q2`, …).
- Answer in plain language; say `why?`, `example`, `park`, or `back to Q#` at any time.
- Confirm the readiness check when everything feels settled.

**Outputs created & auto-committed:**

- `.workflow/sessions/context-YYYY-MM-DD-HHmm.md` (`Status: final`)
- `.workflow/language.md` (canonical terms like *Task*, *Task File*, *Status*)
- Runs `node .github/tools/workflow-check/bin/workflow-check.mjs` automatically and commits `docs(workflow): session todo-cli`.

---

### Step 2 — Write the Black-Box Behavior Spec (`/behavior-spec`)

Start a **new Copilot Chat session** and type:

```text
/behavior-spec todo-cli
```

**What happens:**

- Runs `node .github/tools/workflow-check/bin/workflow-check.mjs` first.
- Expands every active requirement (`R1`, `R2`, …) into observable CLI rules, failure outcomes (e.g., corrupted JSON leaves the file untouched and exits non-zero), and `Given / When / Then` examples.
- Escalates only true user decisions (for example, destructive behavior of `remove` or behavior when `--file` points to a missing file); records defensible defaults in `Assumptions`.

**Outputs created & auto-committed:**

- `.workflow/specs/todo-cli-spec.md`
- Auto-commits `docs(todo-cli): specify behavior`.

---

### Step 3 — Plan, Lock Tests, Build, Gate, and Review (`/pull-work`)

Start a **new Copilot Chat session** and type:

```text
/pull-work
```

From here on, `/pull-work` drives the workflow automatically until a **Checkpoint** or phase completion:

1. **Plan Mode (automatic):**
   - `repo-scout` surveys `TodoCli.sln`, `Directory.Build.props`, `src/`, and `tests/`.
   - Creates `.workflow/plans/todo-cli/plan.md` and `.workflow/plans/todo-cli/phase-01.md`.
   - Sets up the .NET test harness conventions (for example, xUnit `[Fact(DisplayName = "[R1-01] ...")]` with `dotnet test --filter "DisplayName~[R1-01]"` and `dotnet build -c Release && dotnet format --verify-no-changes && dotnet test -c Release` in the phase Gate).
   - Commits `docs(todo-cli): plan P01`.

2. **Setup-Card Checkpoint (if the phase needs a CLI process runner helper in `tests/TodoCli.AcceptanceTests/Support/`):**
   - Reply in **Copilot Chat**:

     ```text
     approve all
     ```

3. **Phase Review Checkpoint:**
   - Authors failing black-box acceptance tests in `tests/TodoCli.AcceptanceTests/` tagged with `[R1-01]`, `[R1-02]`, … that spawn the built `TodoCli.Cli` executable against isolated temp directories (never referencing `TodoCli.Core` internals).
   - Presents all cards, tests, `delegate`/`main` tiers, `Review: required` flags (cards touching file writes/deletes will be flagged `Review: required`), and any ADR candidates in one checkpoint.
   - Reply in **Copilot Chat**:

     ```text
     approve all
     ```

   - Commits and locks the acceptance tests (`test(todo-cli): lock P01 acceptance tests` + `docs(todo-cli): start P01`). From this point on, the pre-tool hook in [locked-tests.json](../.github/hooks/locked-tests.json) blocks edits to locked acceptance tests.

4. **Dispatch (automatic):**
   - `main` cards establish core domain types/storage abstractions in `TodoCli.Core`; `delegate` cards implement individual commands and behaviors (in parallel when files don't overlap).
   - Each completed slice is verified and committed (`feat(todo-cli): <slice name>`).

5. **Phase Gate & Critical-Code Review (automatic):**
   - Runs the phase Gate:
     1. **Suite & Style:** `dotnet build -c Release && dotnet format --verify-no-changes && dotnet test -c Release`
     2. **Traceability:** verifies every owned scenario ID has a passing tagged test
     3. **Lock check:** `git diff --exit-code <Tests locked> -- tests/TodoCli.AcceptanceTests`
     4. **Mutation gate:** runs `dotnet stryker` from `tests\TodoCli.UnitTests` against `TodoCli.Core.csproj` (once Stryker is configured)
   - Runs `code-review` once on `Review: required` cards and completes the phase.

6. **Next Phase (until `Next: done`):**
   - Open a **fresh Copilot Chat session** and type:

     ```text
     /pull-work
     ```

### Step 4 — Verify Your Finished CLI (PowerShell)

Once `Next: done` is reached, test the CLI directly in PowerShell:

```powershell
# Build in Release configuration
dotnet build -c Release

# Run the CLI against a temporary task file
$todoFile = Join-Path $env:TEMP "todo-demo.json"
dotnet run --project src\TodoCli.Cli -c Release -- add "Buy milk" --file $todoFile
dotnet run --project src\TodoCli.Cli -c Release -- add "Write docs" --file $todoFile
dotnet run --project src\TodoCli.Cli -c Release -- list --file $todoFile
dotnet run --project src\TodoCli.Cli -c Release -- done 1 --file $todoFile
dotnet run --project src\TodoCli.Cli -c Release -- list --file $todoFile

# Run the full local verification suite
dotnet format --verify-no-changes
dotnet test -c Release

# Clean up the temporary task file
Remove-Item $todoFile -ErrorAction SilentlyContinue
```

---

## Part 4: Day-2 Usage (Bugs & New Features)

- **Report a spec bug:** in a new Copilot Chat session, run:

  ```text
  /pull-work todo-cli bug: running done with a non-existent task ID exits 0 instead of non-zero
  ```

- **Add a new feature (e.g., `--priority`):**
  1. New chat: `/brain-storm Add optional task priorities (low, medium, high) to add and list`
  2. New chat: `/behavior-spec todo-cli`
  3. New chat: `/pull-work` *(auto-reconciles the updated spec into a new phase)*

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
