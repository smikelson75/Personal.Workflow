// Live probe (not part of the test suite): needs real `claude` and `copilot` sessions.
// usage: node scripts/probe-agent-pins.mjs [agent ...]   (default: repo-scout planner)
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const agents = process.argv.slice(2).length ? process.argv.slice(2) : ['repo-scout', 'planner'];
const home = mkdtempSync(join(tmpdir(), 'pins-home-'));
const run = (cmd, args, cwd) =>
  spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', timeout: 180000 });
const quote = (s) => (process.platform === 'win32' ? `"${s}"` : s);
const field = (name, file) =>
  readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}:`)) ?? `${name}: (none)`;

run('git', ['init', '-q', home]);
const upd = run('node', [join(root, 'scripts', 'update-home.mjs'), home], root);
if (upd.status !== 0) { console.log(upd.stdout, upd.stderr); process.exit(1); }

const ask = quote('Reply with one line: the exact model name or id you are running as.');
const results = [];

for (const agent of agents) {
  const claudeFile = join(home, '.claude', 'agents', `${agent}.agent.md`);
  const copilotFile = join(home, '.github', 'agents', `${agent}.agent.md`);
  const expectModel = field('model', claudeFile).replace('model: ', '');
  const expectEffort = field('effort', claudeFile).replace('effort: ', '');
  const firstListed = readFileSync(copilotFile, 'utf8').match(/^model:\s*\r?\n\s*-\s+(.+)$/m)?.[1]?.trim();

  // Claude Code: init event reports the session model; stream-json also carries the agent's own answer.
  const c = run('claude', ['--add-dir', quote(home), '--agent', agent, '-p', ask,
    '--output-format', 'stream-json', '--verbose'], home);
  const events = (c.stdout || '').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init') ?? {};
  const answer = events.findLast?.((e) => e.type === 'result')?.result ?? '(no result)';
  const effortSeen = JSON.stringify(init).match(/"effort[^"]*":"?([a-z]+)/i)?.[1] ?? 'not reported in init';
  results.push({ probe: 'claude model+effort', agent, expect: `${expectModel}/${expectEffort}`,
    model: init.model ?? '(none)', effort: effortSeen, answer: String(answer).slice(0, 120) });

  // Copilot CLI: first listed model should be the one in use.
  const p = run('copilot', ['--add-dir', quote(home), '--agent', agent, '-p', ask, '--allow-all-tools', '--trust-folder'], home);
  results.push({ probe: 'copilot first listed model', agent, expect: firstListed,
    answer: (p.stdout || p.stderr || '').trim().split(/\r?\n/)[0]?.slice(0, 160) });
}

// Per-agent effort: compare what each agent's Claude session reports; differing pins should differ.
const efforts = results.filter((r) => r.probe === 'claude model+effort');
console.log(JSON.stringify(results, null, 2));
console.log(`\nper-agent effort honored: ${new Set(efforts.map((r) => r.expect.split('/')[1])).size > 1 &&
  new Set(efforts.map((r) => r.effort)).size > 1 ? 'yes (reported efforts differ)' : 'UNVERIFIED (compare manually; reported efforts: ' + efforts.map((r) => r.effort).join(', ') + ')'}`);
