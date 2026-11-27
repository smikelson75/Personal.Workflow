import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { parseLine, splitLines } from './logs.mjs';
import { renderParts } from './records.mjs';
import { tokensOf } from './tokens.mjs';

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
  if (!conv) return false;
  return (Array.isArray(conv.uses) ? conv.uses : []).some((u) =>
    (Array.isArray(u?.flags) ? u.flags : []).some((f) => f?.line === line));
}

// Handoff ends (writing or using) that belong to the given Conversation ID.
function handoffEnds(record, convId) {
  const handoffs = Array.isArray(record?.handoffs) ? record.handoffs : [];
  const ends = [];
  for (const h of handoffs) {
    for (const end of [h?.writing, h?.using]) {
      if (end && end.conversation === convId) ends.push(end);
    }
  }
  return ends;
}

// args: [compact-record-file, Conversation ID, line]. Rewrites the record file's slices and tokens.depth2 on success.
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
  const ends = handoffEnds(record, convId);
  if (!conv && ends.length === 0) return fail('unknown-conversation', convId);

  const line = Number(lineText);
  const endAt = ends.find((e) => e.line === line);
  if (!/^\d+$/.test(lineText) || !(isFlagged(conv, line) || endAt)) {
    return fail('not-flagged', `${convId} line ${lineText}`);
  }
  const file = conv ? conv.file : endAt.file;

  let physical;
  try {
    physical = splitLines(readFileSync(file, 'utf8'));
  } catch {
    return fail('log-unreadable', file);
  }

  const body = [];
  for (let n = line - 1; n <= line + 1; n++) {
    if (n < 1 || n > physical.length) continue;
    const harness = conv ? conv.harness : endAt.harness;
    const { label, content } = renderParts(parseLine(physical[n - 1]), harness);
    body.push(`[${n}] ${label}: ${cap(content, n === line ? FLAGGED_CAP : NEIGHBOUR_CAP)}`);
  }

  const chars = body.join('\n').length;
  const prior = Array.isArray(record.slices) ? record.slices : [];
  const slices = [...prior];
  const at = slices.findIndex((s) => s?.id === convId && s?.line === line);
  const entry = { id: convId, line, chars };
  if (at === -1) slices.push(entry);
  else slices[at] = entry;
  const depth2 = tokensOf(slices.reduce((n, s) => n + (s.chars ?? 0), 0));
  const updated = { ...record, slices, tokens: { ...(record.tokens ?? {}), depth2 } };
  try {
    const temp = `${recordFile}.tmp`;
    writeFileSync(temp, JSON.stringify(updated, null, 2));
    renameSync(temp, recordFile);
  } catch {
    return fail('record-unwritable', recordFile);
  }

  return {
    lines: [`slice: ${convId} line ${line}`, ...body, `skill-review: model tokens: depth 2: ${depth2}`],
    code: 0,
  };
}
