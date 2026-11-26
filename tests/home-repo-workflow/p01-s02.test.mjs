import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { lines, read, repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const GUARD_PATH = '.github/hooks/scripts/guard-locked-tests.mjs';

function claudeCommands() {
  const settings = JSON.parse(read('.claude/settings.json'));
  const entries = settings?.hooks?.PreToolUse;
  assert.ok(Array.isArray(entries), 'hooks.PreToolUse is an array');
  return entries
    .flatMap((entry) => (Array.isArray(entry.hooks) ? entry.hooks : []))
    .filter((hook) => hook.type === 'command' && typeof hook.command === 'string' && hook.command.includes(GUARD_PATH));
}

// A file tracked at a plan's Tests locked ref under that plan's Oracle, in a plan
// whose Next leaves the lock active.
function lockedFileInThisRepo() {
  const plansDir = join(repoRoot, '.workflow', 'plans');
  for (const slug of readdirSync(plansDir).sort()) {
    const planPath = join(plansDir, slug, 'plan.md');
    if (!existsSync(planPath)) continue;
    const plan = readFileSync(planPath, 'utf8');
    const ref = plan.match(/^- Tests locked: `([0-9a-f]{7,40})`/m)?.[1];
    const next = plan.match(/^- Next: (.*)$/m)?.[1] ?? '';
    const oracle = [...(plan.match(/^- Oracle: (.*)$/m)?.[1] ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (!ref || oracle.length === 0 || /^(phase review|fixture repair)\b/.test(next)) continue;
    const tracked = execFileSync('git', ['-C', repoRoot, 'ls-tree', '-r', '--name-only', ref, '--', ...oracle], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
    if (tracked.length > 0) return join(repoRoot, tracked[0]);
  }
  throw new Error('no plan in .workflow/plans/ locks a tracked file');
}

test('[R35-15] .claude/settings.json registers the guard as a Claude Code PreToolUse command', () => {
  assert.ok(existsSync(join(repoRoot, '.claude/settings.json')), '.claude/settings.json exists');
  assert.ok(claudeCommands().length > 0, `a PreToolUse command hook runs ${GUARD_PATH}`);
});

test('[R35-16] .github/hooks/locked-tests.json registers the guard for Copilot CLI', () => {
  const config = JSON.parse(read('.github/hooks/locked-tests.json'));
  const entries = config?.hooks?.preToolUse;
  assert.ok(Array.isArray(entries), 'hooks.preToolUse is an array');
  const match = entries.find(
    (entry) =>
      typeof entry.bash === 'string' &&
      entry.bash.includes(GUARD_PATH) &&
      typeof entry.powershell === 'string' &&
      entry.powershell.includes(GUARD_PATH),
  );
  assert.ok(match, `a preToolUse entry runs ${GUARD_PATH} in bash and powershell`);
});

test('[R35-17] the registered Claude Code command denies a locked file in this repository', () => {
  const [hook] = claudeCommands();
  assert.ok(hook, `a PreToolUse command hook runs ${GUARD_PATH}`);
  const root = realpathSync.native(repoRoot);
  const target = lockedFileInThisRepo();
  const res = spawnSync(hook.command, {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: target }, cwd: root }),
  });
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
});

test('[R35-18] README copy steps install the Claude Code hook and name the trusted-folder rule', () => {
  const all = lines('README.md');
  const start = all.findIndex((line) => line.startsWith('### 2. Copy the Workflow Core into Your Repository'));
  assert.ok(start >= 0, 'copy section heading exists');
  const rest = all.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('### '));
  const section = end >= 0 ? rest.slice(0, end) : rest;
  assert.ok(
    section.some((line) => line.includes('Copy-Item') && line.includes('.claude\\settings.json')),
    'a Copy-Item line copies .claude\\settings.json',
  );
  assert.ok(section.some((line) => line.includes('hooks.PreToolUse')), 'a line names hooks.PreToolUse');
  assert.ok(section.some((line) => line.includes('trusted')), 'a line names the trusted folder');
});
