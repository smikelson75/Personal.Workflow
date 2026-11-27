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
