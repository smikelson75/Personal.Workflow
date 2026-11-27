import { readFileSync } from 'node:fs';
import { parseLine, splitLines } from './logs.mjs';
import { renderParts } from './records.mjs';

const USAGE = 'skill-review slice <compact-record-file> <Conversation ID> <line>';
const NEIGHBOUR_CAP = 1000;
const FLAGGED_CAP = 5800;
const MARK = '...[truncated]';

function fail(category, detail) {
  return { lines: [`skill-review failed: ${category}: ${detail}`], code: 1 };
}

function cap(text, max) {
  if (text.length <= max) return text;
  return text.slice(0, max - MARK.length) + MARK;
}

function isFlagged(conv, line) {
  return (Array.isArray(conv.uses) ? conv.uses : []).some((u) =>
    (Array.isArray(u?.flags) ? u.flags : []).some((f) => f?.line === line));
}

// args: [compact-record-file, Conversation ID, line]. Writes nothing.
export function slice(args) {
  if (args.length !== 3) return fail('usage', USAGE);
  const [recordFile, convId, lineText] = args;

  let record;
  try {
    record = JSON.parse(readFileSync(recordFile, 'utf8'));
  } catch {
    return fail('record-unreadable', recordFile);
  }

  const conversations = Array.isArray(record?.conversations) ? record.conversations : [];
  const conv = conversations.find((c) => c?.id === convId);
  if (!conv) return fail('unknown-conversation', convId);

  const line = Number(lineText);
  if (!/^\d+$/.test(lineText) || !isFlagged(conv, line)) return fail('not-flagged', `${convId} line ${lineText}`);

  let physical;
  try {
    physical = splitLines(readFileSync(conv.file, 'utf8'));
  } catch {
    return fail('log-unreadable', conv.file);
  }

  const body = [];
  for (let n = line - 1; n <= line + 1; n++) {
    if (n < 1 || n > physical.length) continue;
    const { label, content } = renderParts(parseLine(physical[n - 1]), conv.harness);
    body.push(`[${n}] ${label}: ${cap(content, n === line ? FLAGGED_CAP : NEIGHBOUR_CAP)}`);
  }

  return {
    lines: [`slice: ${convId} line ${line}`, ...body, 'skill-review: model tokens: depth 2: 0'],
    code: 0,
  };
}
