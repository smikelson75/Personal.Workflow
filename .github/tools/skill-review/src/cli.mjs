import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { CLAUDE_TYPES, COPILOT_TYPES, findClaudeConversations, findCopilotConversations } from './logs.mjs';
import { applyCheck, applyFinish, applyList, undo, undoCheck } from './apply.mjs';
import { commit } from './commit.mjs';
import { finish } from './finish.mjs';
import { findHandoffs } from './handoffs.mjs';
import { markChanged, recordInstall } from './installs.mjs';
import { readRecord } from './record.mjs';
import { classify } from './records.mjs';
import { slice } from './slice.mjs';
import { useSignals } from './signals.mjs';
import { tokensOf } from './tokens.mjs';
import { claudeSkillStart, copilotSkillStart, resumeUse, segmentUses, unknownRecords } from './uses.mjs';


const USAGE = 'skill-review prepare [<skill>] [--out <file>]';

function fail(category, detail) {
  return { lines: [`skill-review failed: ${category}: ${detail}`], code: 1 };
}

function skillFolders(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'SKILL.md')))
    .map((e) => e.name);
}

function subDirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(dir, e.name));
}

export function knownSkills(homePath) {
  const names = new Set(skillFolders(join(homePath, '.claude', 'skills')));
  for (const stack of subDirs(join(homePath, '.workflow-core', 'language-addons'))) {
    for (const role of subDirs(stack)) {
      if (existsSync(join(role, 'SKILL.md'))) names.add(role.split(/[\\/]/).pop());
    }
  }
  return [...names].sort();
}

function parsePrepareArgs(args) {
  const out = { skill: null, outFile: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') out.outFile = args[++i] ?? null;
    else if (!args[i].startsWith('--') && out.skill === null) out.skill = args[i];
  }
  return out;
}

function gitToplevel(cwd) {
  const res = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  return res.status === 0 ? resolve(res.stdout.trim()) : null;
}

function hasLog(dir) {
  return existsSync(dir) && statSync(dir).isDirectory() && readdirSync(dir).length > 0;
}

function byId(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function main(argv, env, cwd) {
  const [command, ...rest] = argv;
  if (command === 'slice') return slice(rest);
  if (command === 'finish') return finish(rest, env, cwd);
  if (command === 'commit') return commit(rest, env, cwd);
  if (command === 'mark-changed') return markChanged(rest, env);
  if (command === 'record-install') return recordInstall(rest, env, cwd);
  if (command === 'apply-list') return applyList(rest, env, cwd);
  if (command === 'apply-check') return applyCheck(rest, env, cwd);
  if (command === 'apply-finish') return applyFinish(rest, env, cwd);
  if (command === 'undo-check') return undoCheck(rest, env, cwd);
  if (command === 'undo') return undo(rest, env, cwd);
  if (command !== 'prepare') return fail('usage', USAGE);
  const args = parsePrepareArgs(rest);

  const home = env.WORKFLOW_HOME;
  if (!home || !existsSync(home) || !statSync(home).isDirectory()) {
    return fail('home-layout-required', 'start the Harness with the Launch Script');
  }

  const known = knownSkills(home);
  if (args.skill !== null && !known.includes(args.skill)) {
    return {
      lines: [`skill-review failed: unknown-skill: ${args.skill}`, `known skills: ${known.join(', ')}`],
      code: 1,
    };
  }

  let record;
  try {
    record = readRecord(home);
  } catch (err) {
    if (err.category) return fail(err.category, err.detail);
    throw err;
  }

  const copilotHome = env.SKILL_REVIEW_COPILOT_HOME || join(homedir(), '.copilot');
  const claudeHome = env.SKILL_REVIEW_CLAUDE_HOME || join(homedir(), '.claude');
  const projectRoot = gitToplevel(cwd);

  const copilot = projectRoot ? findCopilotConversations(copilotHome, projectRoot) : [];
  const claude = projectRoot ? findClaudeConversations(claudeHome, projectRoot) : [];
  const groups = [
    { convs: [...copilot].sort(byId), start: copilotSkillStart, types: COPILOT_TYPES },
    { convs: [...claude].sort(byId), start: claudeSkillStart, types: CLAUDE_TYPES },
  ];

  // kept: Conversations with at least one kept skill use, in notice order (Copilot then Claude, by ID).
  const kept = [];
  for (const { convs, start, types } of groups) {
    for (const conv of convs) {
      const reviewed = record.conversations?.[`${conv.harness}:${conv.id}`] ?? {};
      const uses = segmentUses(conv, start)
        .filter((u) => u.skill !== 'skill-review' && known.includes(u.skill))
        .filter((u) => args.skill === null || u.skill === args.skill)
        .map((u) => resumeUse(u, reviewed[u.skill]))
        .filter((u) => u !== null);
      if (uses.length) kept.push({ conv, uses, types });
    }
  }

  const lines = [];
  if (!copilot.length) lines.push('notice: no-conversation-log: Copilot CLI');
  if (!claude.length) lines.push('notice: no-conversation-log: Claude Code');
  for (const { conv, types } of kept) {
    for (const u of unknownRecords(conv, types)) {
      lines.push(`notice: unknown-record: ${conv.harness} ${conv.id} line ${u.line}: type "${u.type}"`);
    }
  }

  const conversations = kept.map(({ conv, uses }) => ({
    harness: conv.harness,
    id: conv.id,
    file: conv.file,
    uses: uses.map((u) => ({ ...u, ...useSignals(conv, u, classify) })),
  }));
  conversations.sort((a, b) => (a.harness === b.harness ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.harness < b.harness ? -1 : 1));
  const handoffs = findHandoffs({ projectRoot, groups, skill: args.skill, handoffs: record.handoffs });

  if (!conversations.length && !handoffs.some((h) => h.using !== null)) {
    lines.push('skill-review: nothing to review');
    return { lines, code: 0 };
  }

  const outFile = resolve(args.outFile ?? join(tmpdir(), `skill-review-${basename(projectRoot)}.json`));
  const project = basename(projectRoot);
  const depth1 = tokensOf(JSON.stringify(handoffs.length ? { project, conversations, handoffs } : { project, conversations }, null, 2).length);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify({ project, conversations, handoffs, tokens: { depth1, depth2: 0 }, notices: lines.filter((l) => l.startsWith('notice: ')) }, null, 2));
  const total = conversations.reduce((n, c) => n + c.uses.length, 0);
  lines.push(`skill-review: model tokens: depth 1: ${depth1}`);
  lines.push(`skill-review: prepared ${total} skill uses in ${conversations.length} Conversations`);
  lines.push(`compact-record: ${outFile}`);
  return { lines, code: 0 };
}
