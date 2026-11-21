#!/usr/bin/env node
// Reports whether an installed skill supplies a mutation command for a stack.
// Usage: node mutation-addon.mjs <stack>   (run from the repository root)

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
if (args.length < 1) {
  process.stderr.write('usage: node mutation-addon.mjs <stack>\n');
  process.exit(2);
}
const stack = args[0].trim();

const SKILLS_DIR = join('.github', 'skills');
const STACK_LINE = /^- \*\*Mutation stack:\*\*(.*)$/;
const COMMAND_LINE = /^- \*\*Mutation command:\*\*(.*)$/;

function skillFiles() {
  let entries;
  try {
    entries = readdirSync(SKILLS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => join(SKILLS_DIR, name, 'SKILL.md'));
}

function commandFor(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  let matchesStack = false;
  let command = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const stackMatch = STACK_LINE.exec(line);
    if (stackMatch && stackMatch[1].trim().toLowerCase() === stack.toLowerCase()) {
      matchesStack = true;
      continue;
    }
    const commandMatch = COMMAND_LINE.exec(line);
    if (commandMatch && command === null) {
      command = commandMatch[1].trim();
    }
  }
  return matchesStack && command ? command : null;
}

let result = null;
for (const file of skillFiles()) {
  result = commandFor(file);
  if (result !== null) break;
}

if (result !== null) {
  process.stdout.write(`mutation: ${result}\n`);
} else {
  process.stdout.write(`mutation: unsupported for ${stack} - no mutation Language Add-on installed\n`);
}
process.exit(0);
