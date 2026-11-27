import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { applyCases } from './observations.mjs';
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

// The Home Repo's manifest version when no install records it, else null. Unreadable manifests are ignored.
function unrecordedInstall(home, record) {
  const file = join(home, '.git', 'personal-workflow', 'manifest.json');
  if (!existsSync(file)) return null;
  const version = readJson(file)?.version;
  if (typeof version !== 'string' || version === 'none') return null;
  if ((record.installs ?? []).some((i) => i.version === version)) return null;
  return version;
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

  const notice = unrecordedInstall(home, record);
  const noticeLines = notice ? [`notice: unrecorded-install: ${notice}`] : [];

  let observationLines;
  try {
    observationLines = applyCases(record, compact, judgement.cases);
  } catch (err) {
    if (err.category) return fail(err.category, err.detail);
    throw err;
  }

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
  return {
    lines: [...noticeLines, ...observationLines, `skill-review: reviewed ${uses} skill uses in ${compact.conversations.length} Conversations`],
    code: 0,
  };
}
