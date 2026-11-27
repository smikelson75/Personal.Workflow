import { readFileSync } from 'node:fs';
import { splitLines } from './logs.mjs';

const FIELDS = ['description', 'fixReason', 'cause', 'area', 'model'];
const WINDOW = 8;
const SECRET_SHAPE = /^[A-Za-z0-9_-]{12,}$/;
const HEX_ID = /^[0-9a-f]{7,40}$/;

function words(text) {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function stripTrailing(token) {
  return token.replace(/[.,;]+$/, '');
}

// Every string value at any depth of a parsed JSON value.
function collectStrings(value, out) {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}

// The strings of one Conversation Log file; a line that is not JSON counts as one string. Unreadable files add nothing.
function logStrings(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const out = [];
  for (const line of splitLines(text)) {
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      out.push(line);
      continue;
    }
    collectStrings(value, out);
  }
  return out;
}

// Indexes the log text of every Conversation in the compact record.
function logIndex(compact) {
  const windows = new Set();
  const tokens = new Set();
  const ids = new Set();
  for (const conv of compact.conversations) {
    if (conv?.id !== undefined && conv?.id !== null) ids.add(String(conv.id));
    if (typeof conv?.file !== 'string') continue;
    for (const text of logStrings(conv.file)) {
      const w = words(text);
      for (let i = 0; i + WINDOW <= w.length; i++) windows.add(w.slice(i, i + WINDOW).join(' '));
      for (const raw of text.split(/\s+/)) {
        const token = stripTrailing(raw);
        if (token !== '') tokens.add(token);
      }
    }
  }
  return { windows, tokens, ids };
}

function copiesWords(text, windows) {
  const w = words(text);
  for (let i = 0; i + WINDOW <= w.length; i++) {
    if (windows.has(w.slice(i, i + WINDOW).join(' '))) return true;
  }
  return false;
}

function holdsSecret(text, tokens, ids) {
  for (const raw of text.split(/\s+/)) {
    const token = stripTrailing(raw);
    if (!SECRET_SHAPE.test(token)) continue;
    if (!/[A-Za-z]/.test(token) || !/[0-9]/.test(token)) continue;
    if (HEX_ID.test(token) || ids.has(token)) continue;
    if (tokens.has(token)) return true;
  }
  return false;
}

// Returns null, or {case, field} for the first judged field (1-based case index) that copies Conversation Log text.
export function checkPrivacy(cases, compact) {
  const { windows, tokens, ids } = logIndex(compact);
  for (let i = 0; i < cases.length; i++) {
    for (const field of FIELDS) {
      const text = cases[i]?.[field];
      if (typeof text !== 'string') continue;
      if (copiesWords(text, windows) || holdsSecret(text, tokens, ids)) {
        return { case: i + 1, field };
      }
    }
  }
  return null;
}
