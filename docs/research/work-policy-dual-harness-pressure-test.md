# Work Policy & Dual-Harness 4-Step Pressure Test

**Purpose:** A self-contained, 15–20 minute hands-on test to run on your **work machine** (with both **VS Code Copilot** and **Claude Code**) before committing to any Home Repo / dual-manifest plugin design in [.workflow/incubations/home-repo-workflow.md](../../.workflow/incubations/home-repo-workflow.md).

Everything runs inside a disposable temp folder (`$env:TEMP\pw-pressure-test`). It never touches your real work repos or `Personal.Workflow`.

---

## What This Test Answers

1. **Enterprise policy & dual-manifest loading:** Does your work org allow local plugin folders, and do VS Code Copilot and Claude Code each load *only* their own agents/hooks while sharing one `skills/` folder?
2. **Sibling-repo editing & git hygiene:** Can both harnesses smoothly read/edit a sibling repo outside `cwd` without leaving untracked config files that break `git status --porcelain`?
3. **Sibling `PreToolUse` hook firing:** Does a plugin-hosted `PreToolUse` hook fire **exactly once** (not 0 times, not 2 times) in each harness when editing a file in a sibling repo?
4. **Delegation, blocking, and relay:** Does cheap-tier subagent delegation work in both harnesses, does the hook actually **block** a protected file edit, and does stopping mid-edit in one harness resume cleanly in the other?

---

## Setup: Create the Disposable Sandbox (2 minutes)

Run this PowerShell block once. It creates three sibling directories under `$env:TEMP\pw-pressure-test`:

- `dummy-plugin\` — a minimal dual-manifest plugin (`plugin.json` + `com.github.copilot\` for VS Code Copilot, `.claude-plugin\plugin.json` + `agents\` + `hooks\` for Claude Code, one shared skill, and one logging/blocking Node hook script)
- `dummy-work-home\` — a thin Home Repo with `AGENTS.md` pointing to `../dummy-sibling` and `CLAUDE.md` importing `@AGENTS.md`
- `dummy-sibling\` — a tiny git repo with an editable file (`app.txt`) and a protected file (`locked.test.txt`)

```powershell
$root = Join-Path $env:TEMP "pw-pressure-test"
if (Test-Path $root) { Remove-Item -Recurse -Force $root }

$plugin  = Join-Path $root "dummy-plugin"
$homeDir = Join-Path $root "dummy-work-home"
$sibling = Join-Path $root "dummy-sibling"

$dirs = @(
  "$plugin\.claude-plugin",
  "$plugin\agents",
  "$plugin\hooks",
  "$plugin\com.github.copilot\agents",
  "$plugin\com.github.copilot\hooks",
  "$plugin\skills\echo-check",
  "$plugin\scripts",
  $homeDir,
  $sibling
)
$dirs | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }

# 1. Shared Node hook: logs every PreToolUse call to probe-hook.log and blocks edits to locked.test.txt
@'
import fs from "node:fs";
import path from "node:path";

const logFile = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..", "probe-hook.log");
const raw = fs.readFileSync(0, "utf8").trim();
let payload = {};
try { payload = JSON.parse(raw || "{}"); } catch {}

const target = JSON.stringify(payload);
const entry = `[${new Date().toISOString()}] cwd=${process.cwd()} payload=${target.slice(0, 300)}\n`;
fs.appendFileSync(logFile, entry, "utf8");

if (target.includes("locked.test.txt")) {
  // Deny format understood by Claude Code and Copilot PreToolUse hooks
  process.stdout.write(JSON.stringify({
    permissionDecision: "deny",
    permissionDecisionReason: "Pressure-test lock: locked.test.txt is protected.",
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Pressure-test lock: locked.test.txt is protected."
    }
  }));
  process.exit(0);
}

process.stdout.write("{}");
'@ | Set-Content -Encoding utf8 "$plugin\scripts\probe-hook.mjs"

# 2. Shared skill (both harnesses should discover this)
@'
---
name: echo-check
description: "Pressure-test skill. Replies with a fixed token so we can verify shared skill discovery."
user-invocable: true
---
Reply with exactly: `ECHO-CHECK-OK` followed by the harness name you are running in.
'@ | Set-Content -Encoding utf8 "$plugin\skills\echo-check\SKILL.md"

# 3. Root plugin.json (VS Code Copilot Agent Plugins 1.0)
@'
{
  "$schema": "https://aka.ms/agent-plugin-schema",
  "name": "pw-probe",
  "version": "0.0.1",
  "description": "Disposable dual-manifest pressure test"
}
'@ | Set-Content -Encoding utf8 "$plugin\plugin.json"

# 4. Copilot-only agent & hook (under com.github.copilot/)
@'
---
name: probe-scout
description: "Read-only pressure-test scout (Copilot)"
tools: ['read', 'search']
model:
  - Claude Haiku 5.5 (copilot)
  - GPT-6 Luna (copilot)
---
Read the file the caller names and reply in one line starting with `[COPILOT-SCOUT]`. Never edit files.
'@ | Set-Content -Encoding utf8 "$plugin\com.github.copilot\agents\probe-scout.agent.md"

@'
{
  "version": 1,
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "node \"${PLUGIN_ROOT}/scripts/probe-hook.mjs\""
      }
    ]
  }
}
'@ | Set-Content -Encoding utf8 "$plugin\com.github.copilot\hooks\hooks.json"

# 5. Claude-only manifest, agent & hook (under .claude-plugin/, agents/, hooks/)
@'
{
  "name": "pw-probe",
  "version": "0.0.1",
  "description": "Disposable dual-manifest pressure test"
}
'@ | Set-Content -Encoding utf8 "$plugin\.claude-plugin\plugin.json"

@'
---
name: probe-scout
description: "Read-only pressure-test scout (Claude Code)"
tools: Read, Grep, Glob
model: haiku
---
Read the file the caller names and reply in one line starting with `[CLAUDE-SCOUT]`. Never edit files.
'@ | Set-Content -Encoding utf8 "$plugin\agents\probe-scout.md"

@'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/probe-hook.mjs\""
          }
        ]
      }
    ]
  }
}
'@ | Set-Content -Encoding utf8 "$plugin\hooks\hooks.json"

# 6. Thin dummy-work-home
@'
# Dummy Work Home

Sibling project repo:
- `../dummy-sibling` — sample project repo with `app.txt` (editable) and `locked.test.txt` (protected).
'@ | Set-Content -Encoding utf8 "$homeDir\AGENTS.md"

'@AGENTS.md' | Set-Content -Encoding utf8 "$homeDir\CLAUDE.md"

# 7. Disposable sibling git repo
"line 1: initial`n" | Set-Content -Encoding utf8 "$sibling\app.txt"
"DO NOT EDIT THIS FILE`n" | Set-Content -Encoding utf8 "$sibling\locked.test.txt"

git -C $sibling init -q
git -C $sibling add .
git -C $sibling commit -q -m "chore: initial pressure test files"

Write-Host "Sandbox ready at: $root" -ForegroundColor Green
```

---

## Step 1 — Enterprise Policy & Dual-Manifest Load Probe

**Goal:** Check whether org policies block local plugins and confirm each harness loads only its own agents/hooks while sharing `echo-check`.

### A. In Claude Code
1. Open a terminal in `$env:TEMP\pw-pressure-test\dummy-work-home`.
2. Validate the plugin manifest:
   ```powershell
   claude plugin validate ..\dummy-plugin
   ```
3. Start Claude Code with the local plugin folder:
   ```powershell
   claude --plugin-dir ..\dummy-plugin
   ```
4. Inside Claude Code, run:
   - `/status` → Look for **`Enterprise managed settings`** (note any restrictions like `strictPluginOnlyCustomization`, `allowManagedHooksOnly`, or blocked `--plugin-dir`).
   - `/pw-probe:echo-check` (or type `/echo` to see what slash command autocomplete shows) → Confirm it replies `ECHO-CHECK-OK`.
   - Check `/agents` (or ask *"What custom agents are loaded?"*) → Confirm you see **`probe-scout`** (Claude version, not duplicate Copilot agents).

### B. In VS Code Copilot
1. Open `$env:TEMP\pw-pressure-test\dummy-work-home` in VS Code.
2. Point VS Code Copilot at the local plugin folder (`$env:TEMP\pw-pressure-test\dummy-plugin`) via **Agent Plugins / local plugin folder** setting (note if your work VS Code policy disables or grays out local plugins).
3. In Copilot Chat, invoke `/echo-check` → Confirm it replies `ECHO-CHECK-OK`.
4. Check available custom agents → Confirm you see **`probe-scout`** once (Copilot version, no parse errors from Claude's `agents/probe-scout.md`).

**What to record:**
- Did Claude Code `/status` show any blocking enterprise policies?
- Did `claude plugin validate` pass cleanly?
- Did **both** harnesses see `echo-check` and load *only* their own `probe-scout` without errors?
- What exact command/agent prefix did Claude Code use (e.g., `/pw-probe:echo-check`, `pw-probe:probe-scout`)?

---

## Step 2 — Sibling-Repo Access & Clean-Tree Hygiene Probe

**Goal:** Verify both harnesses can read and edit `../dummy-sibling/app.txt` from `dummy-work-home` without leaving untracked clutter.

### A. In Claude Code (running in `dummy-work-home`)
1. Run `/add-dir ..\dummy-sibling`.
2. Ask: *"Read `../dummy-sibling/app.txt` and append `line 2: claude edit` to it."*
3. Note whether it needed extra permission prompts and whether it created `.claude/settings.local.json` in `dummy-work-home` or `dummy-sibling`.

### B. In VS Code Copilot (open on `dummy-work-home`)
1. Ask: *"Read `../dummy-sibling/app.txt` and append `line 3: copilot edit` to it."*
2. Note whether VS Code prompts for outside-workspace access once or on every turn.

### C. Check Git Hygiene
Run:
```powershell
git -C "$env:TEMP\pw-pressure-test\dummy-sibling" status --porcelain
Get-ChildItem -Force "$env:TEMP\pw-pressure-test\dummy-work-home"
```

**What to record:**
- Did both harnesses read and edit `../dummy-sibling/app.txt` cleanly?
- Did either harness drop local config files (`.claude/`, `.vscode/`, etc.) inside `dummy-sibling` or `dummy-work-home`?
- Did VS Code remember sibling-folder approval across turns?

---

## Step 3 — Sibling `PreToolUse` Hook Probe (Once, Not Twice, Not Zero)

**Goal:** Confirm `probe-hook.mjs` fired **exactly once** per edit in each harness—even though the edited file lives in `../dummy-sibling`, outside `cwd`.

Run:
```powershell
Get-Content "$env:TEMP\pw-pressure-test\probe-hook.log"
```

**What to look for:**
- **Ideal:** Exactly **1 log line** for Claude Code's edit in Step 2A and **1 log line** for VS Code Copilot's edit in Step 2B, both showing `dummy-sibling` / `app.txt` in the payload.
- **0 lines for a harness:** That harness either blocked plugin hooks (`allowManagedHooksOnly`) or did not fire `PreToolUse` for edits outside `cwd` (or the `${PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_ROOT}` variable didn't expand).
- **2 lines for a single edit:** Duplicate hook discovery is firing both hook configs.

---

## Step 4 — Delegation, Lock Enforcement & Cross-Harness Relay Smoke Test

**Goal:** Prove the three real workflows you care about actually work end to end.

### 4a. Cheap-Tier Subagent Delegation
- In **Claude Code**: *"Use the `probe-scout` subagent to read `../dummy-sibling/app.txt` and report what's in it."*
  - Check that it delegates to `probe-scout`, returns `[CLAUDE-SCOUT] ...`, and runs on `haiku` (check `/cost` or subagent indicator).
- In **VS Code Copilot**: *"Use the `probe-scout` subagent to read `../dummy-sibling/app.txt` and report what's in it."*
  - Check that it delegates to `probe-scout` and returns `[COPILOT-SCOUT] ...`.

### 4b. Lock Enforcement on a Sibling Repo
- In **Claude Code**: *"Edit `../dummy-sibling/locked.test.txt` and add `should fail`."*
- In **VS Code Copilot**: *"Edit `../dummy-sibling/locked.test.txt` and add `should fail`."*
- Verify `locked.test.txt` is **unchanged** (`Get-Content "$env:TEMP\pw-pressure-test\dummy-sibling\locked.test.txt"` still shows only `DO NOT EDIT THIS FILE`).

### 4c. Mid-Task Cross-Harness Relay
1. In **Claude Code**, say: *"Add `line 4: started in claude (TODO finish)` to `../dummy-sibling/app.txt` and stop—do not commit."*
2. Switch to **VS Code Copilot** (no copy-paste of chat history) and say: *"Check `git diff` in `../dummy-sibling`, see what's in progress in `app.txt`, and replace the `(TODO finish)` marker with `(finished in copilot)`."*
3. Check `git -C "$env:TEMP\pw-pressure-test\dummy-sibling" diff` — confirm Copilot picked up cleanly from the dirty working tree alone.

---

## Results Scorecard (Bring Back to `/incubate`)

Fill this out and paste it when resuming `.workflow/incubations/home-repo-workflow.md`:

| Step | Probe | Claude Code | VS Code Copilot | Notes / Exact Error |
| --- | --- | --- | --- | --- |
| **1** | Org policy allows local plugin | Pass / Fail | Pass / Fail | |
| **1** | Shared `echo-check` skill works | Pass / Fail | Pass / Fail | Prefix seen: |
| **1** | Harness loads *only* its own `probe-scout` | Pass / Fail | Pass / Fail | |
| **2** | Reads & edits `../dummy-sibling/app.txt` | Pass / Fail | Pass / Fail | Prompt friction: |
| **2** | `dummy-sibling` has no extra untracked config | Pass / Fail | Pass / Fail | Files created: |
| **3** | `PreToolUse` fired **once** on sibling edit | 0 / 1 / 2+ | 0 / 1 / 2+ | |
| **4a** | Cheap-tier `probe-scout` delegation works | Pass / Fail | Pass / Fail | |
| **4b** | Hook blocked edit to `locked.test.txt` | Pass / Fail | Pass / Fail | |
| **4c** | Mid-edit relay from Claude → Copilot worked | Pass / Fail | Pass / Fail | |

### How the Results Steer the Design

- **All Pass:** Dual-manifest local clone (`Model A-Local`) is viable—next step in `/incubate` is comparing it honestly against a **simplest 80/20 baseline** (e.g., local clone + minimal sync script) to see if the dual-manifest + generator machinery is actually worth its upkeep.
- **Step 1 fails on either harness (org blocks local plugins):** Drop the plugin-loader approach and evaluate **Model B** (direct Home Repo + `--add-dir` or lightweight sync script).
- **Step 3 or 4b fails (hook doesn't fire or doesn't block across siblings):** Live pre-edit `Oracle` locks cannot be relied on from a Home Repo—either run `/pull-work` inside each target repo directly, or treat the `Gate` as the enforcement backstop.
- **Step 4a fails (namespacing/delegation breaks):** Rethink shared subagent names or whether cheap-tier delegation belongs in the plugin at all.

---

## Cleanup

When you're done, delete the disposable sandbox (and remove `dummy-plugin` from VS Code's local plugin setting if you added it):

```powershell
Remove-Item -Recurse -Force "$env:TEMP\pw-pressure-test"
```
