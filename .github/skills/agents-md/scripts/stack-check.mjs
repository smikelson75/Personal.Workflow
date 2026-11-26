// Proposes the Stack IDs for the Project Repo at the current directory and reports the
// AGENTS.md Stack line and whether a competing instruction file exists.
// Prints one JSON line {"mode","stacks","stackLine","competing"} and exits 0.
// Exits 2 with a refusal on stderr when the current directory is the Home Repo.
// Reads files only; writes no files; never uses the network.
// Usage: node stack-check.mjs   (run from the Project Repo root)

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HOME_MANIFEST_GIT_PATH = 'personal-workflow';
const STACK_LINE = /^\s*(?:[-*]\s+)?stack:(.*)$/i;
const SKIP_FOLDERS = new Set(['node_modules', '.git', 'bin', 'obj']);
const MAX_DEPTH = 4;

function isHomeRepo() {
  let gitPath;
  try {
    gitPath = execFileSync('git', ['rev-parse', '--git-path', HOME_MANIFEST_GIT_PATH], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return false;
  }
  return existsSync(resolve(process.cwd(), gitPath, 'manifest.json'));
}

function hasDotnetProject(dir, depth) {
  if (depth > MAX_DEPTH) return false;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith('.csproj') || entry.name.endsWith('.sln'))) {
      return true;
    }
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !SKIP_FOLDERS.has(entry.name)) {
      if (hasDotnetProject(resolve(dir, entry.name), depth + 1)) return true;
    }
  }
  return false;
}

function stackLineOf(text) {
  for (const line of text.split(/\r?\n/)) {
    const match = STACK_LINE.exec(line);
    if (match) return match[1].trim();
  }
  return null;
}

if (isHomeRepo()) {
  console.error("the Home Repo's AGENTS.md holds only Project Pointers");
  process.exit(2);
}

const agentsExists = existsSync('AGENTS.md');
const mode = agentsExists ? 'amendment' : 'bootstrap';
const stackLine = agentsExists ? stackLineOf(readFileSync('AGENTS.md', 'utf8')) : null;
const competing = agentsExists && existsSync('.github/copilot-instructions.md');

const stacks = [];
if (hasDotnetProject(process.cwd(), 1)) stacks.push('csharp');
if (existsSync('package.json')) {
  stacks.push(existsSync('tsconfig.json') ? 'node-typescript' : 'node-javascript');
}

process.stdout.write(JSON.stringify({ mode, stacks, stackLine, competing }) + '\n');
process.exit(0);
