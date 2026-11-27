import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readRecord } from './record.mjs';

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

function hasLog(dir) {
  return existsSync(dir) && statSync(dir).isDirectory() && readdirSync(dir).length > 0;
}

export function main(argv, env, cwd) {
  const [command, ...rest] = argv;
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

  try {
    readRecord(home);
  } catch (err) {
    if (err.category) return fail(err.category, err.detail);
    throw err;
  }

  const copilotHome = env.SKILL_REVIEW_COPILOT_HOME || join(homedir(), '.copilot');
  const claudeHome = env.SKILL_REVIEW_CLAUDE_HOME || join(homedir(), '.claude');
  const lines = [];
  if (!hasLog(join(copilotHome, 'session-state'))) lines.push('notice: no-conversation-log: Copilot CLI');
  if (!hasLog(join(claudeHome, 'projects'))) lines.push('notice: no-conversation-log: Claude Code');
  lines.push('skill-review: nothing to review');
  return { lines, code: 0 };
}
