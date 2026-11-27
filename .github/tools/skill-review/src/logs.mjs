import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

function norm(p) {
  const s = resolve(p).replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? s.toLowerCase() : s;
}

export function isInside(folder, projectRoot) {
  const f = norm(folder);
  const r = norm(projectRoot);
  return f === r || f.startsWith(`${r}/`);
}

export function splitLines(text) {
  const parts = text.split(/\r?\n/);
  if (parts.length && parts[parts.length - 1] === '') parts.pop();
  return parts;
}

export function parseLine(line) {
  try {
    const value = JSON.parse(line);
    return value !== null && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

export function findCopilotConversations(copilotHome, projectRoot) {
  const base = join(copilotHome, 'session-state');
  if (!existsSync(base)) return [];
  const found = [];
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(base, entry.name, 'events.jsonl');
    if (!existsSync(file)) continue;
    const lines = splitLines(readFileSync(file, 'utf8'));
    let cwd = null;
    for (const line of lines) {
      const rec = parseLine(line);
      if (rec && rec.type === 'session.start') {
        cwd = rec.data?.context?.cwd ?? null;
        break;
      }
    }
    if (typeof cwd === 'string' && isInside(cwd, projectRoot)) {
      found.push({ harness: 'Copilot CLI', id: entry.name, file, lines });
    }
  }
  return found;
}

export function findClaudeConversations(claudeHome, projectRoot) {
  const base = join(claudeHome, 'projects');
  if (!existsSync(base)) return [];
  const found = [];
  for (const dir of readdirSync(base, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const folder = join(base, dir.name);
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
      const file = join(folder, entry.name);
      const lines = splitLines(readFileSync(file, 'utf8'));
      let cwd = null;
      for (const line of lines) {
        const rec = parseLine(line);
        if (rec && typeof rec.cwd === 'string') {
          cwd = rec.cwd;
          break;
        }
      }
      if (cwd !== null && isInside(cwd, projectRoot)) {
        found.push({ harness: 'Claude Code', id: entry.name.slice(0, -'.jsonl'.length), file, lines });
      }
    }
  }
  return found;
}

export const COPILOT_TYPES = new Set([
  'session.start',
  'session.info',
  'session.model_change',
  'session.permissions_changed',
  'session.tool_baseline',
  'session.context_changed',
  'session.usage_record',
  'session.error',
  'session.shutdown',
  'skill.invoked',
  'user.message',
  'assistant.message',
  'assistant.turn_start',
  'assistant.turn_end',
  'system.message',
  'instruction.update',
  'hook.start',
  'hook.end',
  'tool.execution_start',
  'tool.execution_complete',
  'subagent.selected',
  'subagent.configured',
  'subagent.started',
  'subagent.completed',
  'subagent.failed',
]);

export const CLAUDE_TYPES = new Set([
  'user',
  'assistant',
  'system',
  'summary',
  'file-history-snapshot',
  'last-prompt',
  'mode',
  'permission-mode',
  'session-owner',
  'cost-state',
  'data-flow-records',
  'attachment',
  'queue-operation',
]);
