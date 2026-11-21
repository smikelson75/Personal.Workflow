import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function findWorkflowRoot(cwd) {
  let current = cwd;
  for (;;) {
    const candidate = join(current, '.workflow');
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function loadDoc(root, relPath) {
  const name = relPath.split('/').pop();
  try {
    let text = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(join(root, relPath)));
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return { path: relPath, name, lines: text.split(/\r?\n/), unreadable: false };
  } catch {
    return { path: relPath, name, lines: [], unreadable: true };
  }
}

export function loadFolder(root) {
  const sessionsDir = join(root, '.workflow', 'sessions');
  const names = existsSync(sessionsDir)
    ? readdirSync(sessionsDir).filter((n) => n.endsWith('.md')).sort(cmp)
    : [];
  const glossaryPath = '.workflow/language.md';
  return {
    root,
    glossary: existsSync(join(root, glossaryPath)) ? loadDoc(root, glossaryPath) : null,
    sessions: names.map((n) => loadDoc(root, `.workflow/sessions/${n}`)),
  };
}
