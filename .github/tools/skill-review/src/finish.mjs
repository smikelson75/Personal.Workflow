import { readFileSync } from 'node:fs';
import { homeFor, readRecord, writeRecord } from './record.mjs';

const USAGE = 'skill-review finish <compact-record-file> <judgement-file>';

function fail(category, detail) {
  return { lines: [`skill-review failed: ${category}: ${detail}`], code: 1 };
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// args: [compact-record-file, judgement-file]. Writes the Review Record once, at the end.
export function finish(args, env) {
  if (args.length !== 2) return fail('usage', USAGE);
  const [compactFile, judgementFile] = args;

  const home = homeFor(env);
  if (!home) return fail('home-layout-required', 'start the Harness with the Launch Script');

  let record;
  try {
    record = readRecord(home);
  } catch (err) {
    if (err.category) return fail(err.category, err.detail);
    throw err;
  }

  const compact = readJson(compactFile);
  if (!Array.isArray(compact?.conversations)) return fail('record-unreadable', compactFile);

  const judgement = readJson(judgementFile);
  if (!Array.isArray(judgement?.cases)) return fail('judgement-unreadable', judgementFile);

  let uses = 0;
  record.conversations ??= {};
  for (const conv of compact.conversations) {
    const key = `${conv.harness}:${conv.id}`;
    const positions = (record.conversations[key] ??= {});
    for (const use of conv.uses ?? []) {
      uses++;
      positions[use.skill] = Math.max(positions[use.skill] ?? 0, use.end);
    }
  }

  writeRecord(home, record);
  return { lines: [`skill-review: reviewed ${uses} skill uses in ${compact.conversations.length} Conversations`], code: 0 };
}
