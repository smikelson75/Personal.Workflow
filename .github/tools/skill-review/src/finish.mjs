import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { applyCases, idText } from './observations.mjs';
import { renderLedger } from './ledger.mjs';
import { homeFor, readRecord, writeRecord } from './record.mjs';
import { renderSummary, stamp } from './summary.mjs';
import { steFailures } from './ste.mjs';
import { checkPrivacy } from './privacy.mjs';

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

function manifestVersion(home) {
  const version = readJson(join(home, '.git', 'personal-workflow', 'manifest.json'))?.version;
  return typeof version === 'string' && version !== 'none' ? version : null;
}

// Writes the summary under the first free name (suffix -2, -3, ...) and returns its path.
function writeSummary(home, project, now, text) {
  const dir = join(home, 'skill-review', 'summaries');
  mkdirSync(dir, { recursive: true });
  const base = `${stamp(now).file}-${project.replace(/[\\/:*?"<>|]/g, '-')}`;
  let file = join(dir, `${base}.md`);
  for (let n = 2; existsSync(file); n++) file = join(dir, `${base}-${n}.md`);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, text);
  renameSync(temp, file);
  return resolve(file);
}

// Replaces the whole Ledger file: temp file, then rename.
function writeLedger(home, text) {
  const dir = join(home, 'skill-review');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'ledger.md');
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, text);
  renameSync(temp, file);
}

// Positional paths plus an optional `--attempt <1|2|3>` anywhere after them; null when the arguments are invalid.
function parseArgs(args) {
  const paths = [];
  let attempt = 1;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--attempt') {
      const value = args[++i];
      if (!['1', '2', '3'].includes(value)) return null;
      attempt = Number(value);
    } else {
      paths.push(args[i]);
    }
  }
  return paths.length === 2 ? { paths, attempt } : null;
}

// args: [compact-record-file, judgement-file, --attempt <n>?]. Writes the summary and Ledger, then the Review Record.
export function finish(args, env, cwd = process.cwd()) {
  const parsed = parseArgs(args);
  if (!parsed) return fail('usage', USAGE);
  const [compactFile, judgementFile] = parsed.paths;

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
  const judgedHandoffs = judgement.handoffs ?? [];
  if (!Array.isArray(judgedHandoffs)) return fail('judgement-unreadable', judgementFile);

  const compactHandoffs = Array.isArray(compact.handoffs) ? compact.handoffs : [];
  const compactById = new Map(compactHandoffs.map((h) => [h.id, h]));
  const judgedIds = new Set();
  for (const entry of judgedHandoffs) {
    const id = typeof entry?.id === 'string' ? entry.id : '';
    const ch = compactById.get(id);
    if (!ch || ch.using == null) return fail('judgement-invalid', `handoff ${id}`);
    judgedIds.add(id);
  }

  const privacy = checkPrivacy(judgement.cases, compact);
  if (privacy) return fail('privacy-check', `case ${privacy.case} ${privacy.field}`);

  const notice = unrecordedInstall(home, record);
  const noticeLines = notice ? [`notice: unrecorded-install: ${notice}`] : [];

  let observationLines;
  try {
    observationLines = applyCases(record, compact, judgement.cases);
  } catch (err) {
    if (err.category) return fail(err.category, err.detail);
    throw err;
  }

  const failures = steFailures(record, observationLines);
  let steNotices = [];
  if (failures.length) {
    if (parsed.attempt < 3) {
      return { lines: [...failures, `skill-review failed: ste-check: ${failures.length} sentences`], code: 1 };
    }
    const id = idText(record.nextObservation);
    record.observations.push({
      id,
      part: 'skill-review',
      state: 'watching',
      kind: 'rule adherence',
      label: null,
      side: null,
      area: null,
      outcome: 'part change',
      cause: null,
      model: null,
      fixType: 'clarified rule',
      fixReason: 'The text rules need a clearer example.',
      description: 'The Executive Summary failed the STE check three times.',
      cases: 1,
      chances: 0,
      changeCommit: null,
      follows: null,
    });
    record.nextObservation += 1;
    observationLines.push(`observation: ${id} new`);
    steNotices = [`STE check failed: ${failures.length} sentences`];
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

  record.handoffs ??= [];
  const existingById = new Map(record.handoffs.map((h) => [h.id, h]));
  for (const ch of compactHandoffs) {
    const isJudged = judgedIds.has(ch.id);
    const existing = existingById.get(ch.id);
    const state = isJudged ? 'reviewed' : 'pending';
    const writtenAt = !isJudged && existing?.state === 'pending' && existing.writtenAt ? existing.writtenAt : ch.writtenAt;
    const next = {
      id: ch.id,
      writingSkill: ch.writingSkill,
      usingSkill: ch.usingSkill,
      artifact: ch.artifact,
      state,
      writtenAt,
    };
    if (existing) Object.assign(existing, next);
    else {
      record.handoffs.push(next);
      existingById.set(ch.id, next);
    }
  }

  const now = env.SKILL_REVIEW_NOW ? new Date(env.SKILL_REVIEW_NOW) : new Date();
  let summaryLines = [];
  let summaryText = null;
  let ledgerText = null;
  let summaryProject = null;
  const handoffsReviewed = judgedIds.size;
  if (uses > 0 || handoffsReviewed > 0) {
    const version = manifestVersion(home);
    const source = (record.installs ?? []).find((i) => i.version === version)?.source ?? 'unknown';
    const project = compact.project || basename(cwd);
    const text = renderSummary({
      project,
      now,
      version: version ?? 'unknown',
      source,
      compact,
      record,
      observationLines,
      notices: [...(compact.notices ?? []), ...noticeLines, ...steNotices],
      handoffsReviewed,
    });
    ledgerText = renderLedger({ record, now });
    summaryText = text;
    summaryProject = project;
  }

  // The Review Record is the source of truth, so it is written first.
  writeRecord(home, record);
  if (summaryText !== null) {
    summaryLines = [`skill-review: summary: ${writeSummary(home, summaryProject, now, summaryText)}`];
    writeLedger(home, ledgerText);
  }
  return {
    lines: [...noticeLines, ...observationLines, ...summaryLines, `skill-review: reviewed ${uses} skill uses in ${compact.conversations.length} Conversations`],
    code: 0,
  };
}
