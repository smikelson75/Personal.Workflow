#!/usr/bin/env node
// Writes a Language Add-on folder (language-addons/<id>/) and its stack section in language-addons/README.md.
// Usage: node scaffold.mjs --id <id> [--code-style "<tool>|<command>"] [--test-harness "<tool>|<command>"]
//                          [--mutation "<tool>|<command>"] [--na "<role>=<reason>"]...
//   (run from a Personal.Workflow source root)
// Exit 0 when written. Exit 1 for a source or existence failure, 2 for a usage failure.
// Every failure prints one line on stdout and changes no file.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SOURCE_MARKERS = ['.github/skills/pull-work/SKILL.md', 'language-addons/README.md'];
const ADDONS_DIR = 'language-addons';
const README = join(ADDONS_DIR, 'README.md');
const STACKS_HEADING = '## Available Stacks';
const DEFAULT_REASON = 'not used by this stack';
const MUTATION_PROTOCOL = '../mutation-testing/protocol.md';

const ROLES = [
  { key: 'code-style', flag: '--code-style', label: 'code style', gateLine: 'suite' },
  { key: 'test-harness', flag: '--test-harness', label: 'test harness', gateLine: 'suite' },
  { key: 'mutation', flag: '--mutation', label: 'mutation testing', gateLine: 'mutation' },
];

const GATE_TEXT = {
  'code-style': (command) =>
    `add \`${command}\` in front of the test command in the phase Gate suite line`,
  'test-harness': (command) => `the phase Gate suite line is \`${command}\``,
  mutation: (command) => `the phase Gate mutation line is \`${command}\``,
};

const USAGE_FLAGS = ['--id', '--na', ...ROLES.map((role) => role.flag)];

function fail(code, message) {
  process.stdout.write(`addon-author failed: ${message}\n`);
  return code;
}

// Returns { id, roles, na } or { error }.
function parseArgs(argv) {
  const parsed = { id: undefined, roles: {}, na: {} };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!USAGE_FLAGS.includes(flag)) return { error: `unknown argument ${flag}` };
    if (value === undefined || value.startsWith('--')) return { error: `${flag} needs a value` };
    if (flag === '--id') {
      parsed.id = value;
    } else if (flag === '--na') {
      const eq = value.indexOf('=');
      const role = eq < 0 ? '' : value.slice(0, eq).trim();
      const reason = eq < 0 ? '' : value.slice(eq + 1).trim();
      if (!ROLES.some((r) => r.key === role) || !reason) {
        return { error: 'bad-na: --na needs "<role>=<reason>" with role code-style, test-harness, or mutation' };
      }
      parsed.na[role] = reason;
    } else {
      parsed.roles[ROLES.find((r) => r.flag === flag).key] = value;
    }
  }
  return parsed;
}

// Splits "<tool>|<command>" at the first '|'. Returns { tool, command } or null.
function splitRole(value) {
  const bar = value.indexOf('|');
  if (bar < 0) return null;
  const tool = value.slice(0, bar).trim();
  const command = value.slice(bar + 1).trim();
  if (!tool || !command) return null;
  return { tool, command };
}

function folderFor(tool, id) {
  const stem = tool.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return stem ? `${stem}-${id}` : '';
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function skillText(id, role, folder, tool, command) {
  const head = [
    '---',
    `name: ${folder}`,
    `description: "${capitalize(role.label)} for ${id} using ${tool}."`,
    `argument-hint: "Say 'run' to apply it"`,
    'user-invocable: true',
    '---',
    '',
    `# ${tool} for ${id}`,
    '',
    `This skill applies the ${role.label} role of the ${id} Language Add-on with ${tool}.`,
    '',
  ];
  const body =
    role.key === 'mutation'
      ? [
          `This is the ${id} adapter for [mutation-testing/protocol.md](${MUTATION_PROTOCOL}).`,
          '',
          `- **Mutation stack:** ${id}`,
          `- **Mutation command:** ${command}`,
          '',
        ]
      : [];
  const tail = [`Command: \`${command}\``, '', `Gate: ${GATE_TEXT[role.key](command)}`, ''];
  return [...head, ...body, ...tail].join('\n');
}

function readmeRow(id, role, skill) {
  const { folder, tool, command } = skill;
  return `| [${folder}](./${id}/${folder}/SKILL.md) | ${role.label} with ${tool}: \`${command}\`. | Gate ${role.gateLine} line |`;
}

function readmeSection(id, rows) {
  return [
    `### ${id} (\`${ADDONS_DIR}/${id}/\`)`,
    '',
    '| Skill | Purpose | Key Outputs in Target Repo |',
    '| --- | --- | --- |',
    ...rows,
  ];
}

// Inserts the stack section at the end of Available Stacks (before the next "## " heading or at end of file).
function insertSection(text, id, rows) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const available = lines.indexOf(STACKS_HEADING);
  const next = lines.findIndex((line, i) => i > available && line.startsWith('## '));
  const at = next >= 0 ? next : lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
  const lead = lines[at - 1] === '' ? [] : [''];
  const trail = next >= 0 ? [''] : [];
  const out = [...lines.slice(0, at), ...lead, ...readmeSection(id, rows), ...trail, ...lines.slice(at)];
  return out.join(eol);
}

function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.error) return fail(2, `usage: ${parsed.error}`);
  const { id } = parsed;
  if (id === undefined) return fail(2, 'usage: --id <id> is required');
  if (!ID_PATTERN.test(id)) return fail(2, `invalid-id: ${id} is not kebab-case`);

  if (!SOURCE_MARKERS.every((marker) => existsSync(marker))) {
    return fail(1, 'not-a-workflow-source: run it in a Personal.Workflow source (Workflow Core plus language-addons/)');
  }
  const addonDir = `${ADDONS_DIR}/${id}`;
  if (existsSync(addonDir)) return fail(1, `addon-exists: ${addonDir}/`);

  const present = ROLES.filter((role) => parsed.roles[role.key] !== undefined);
  if (present.length === 0) {
    return fail(2, 'no-roles: give at least one of --code-style, --test-harness, --mutation');
  }

  const skills = [];
  for (const role of present) {
    const split = splitRole(parsed.roles[role.key]);
    if (!split) return fail(2, `bad-role: ${role.flag} needs "<tool>|<command>"`);
    const folder = folderFor(split.tool, id);
    if (!folder) return fail(2, `bad-role: ${role.flag} tool has no usable name`);
    if (skills.some((s) => s.folder === folder)) return fail(2, `duplicate-folder: ${folder}`);
    skills.push({ role, folder, tool: split.tool, command: split.command });
  }

  const readme = readFileSync(README, 'utf8');
  const lines = readme.split(/\r?\n/);
  if (!lines.includes(STACKS_HEADING)) {
    return fail(1, `readme-shape: ${README} has no "${STACKS_HEADING}" heading`);
  }
  if (lines.includes(`### ${id} (\`${ADDONS_DIR}/${id}/\`)`)) {
    return fail(1, `readme-exists: ${README} already has a ${id} section`);
  }

  const rows = ROLES.map((role) => {
    const skill = skills.find((s) => s.role === role);
    if (skill) return readmeRow(id, role, skill);
    return `| ${role.label} | not applicable: ${parsed.na[role.key] ?? DEFAULT_REASON} | none |`;
  });

  for (const s of skills) {
    mkdirSync(join(addonDir, s.folder), { recursive: true });
    writeFileSync(join(addonDir, s.folder, 'SKILL.md'), skillText(id, s.role, s.folder, s.tool, s.command));
  }
  writeFileSync(README, insertSection(readme, id, rows));

  const folders = skills.map((s) => s.folder).join(', ');
  process.stdout.write(`addon-author: wrote ${addonDir}/ (${folders})\n`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
