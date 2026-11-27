import { compareIds } from './observations.mjs';
const MAX_NOTICES = 10;
const SECTIONS = ['Changed', 'Improved', 'Same', 'Next'];

const pad = (n) => String(n).padStart(2, '0');

// Local-time stamp of an ISO time: title 'YYYY-MM-DD HH:mm', file 'YYYY-MM-DD-HHmm'.
export function stamp(now) {
  const d = new Date(now);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return { title: `${date} ${hh}:${mm}`, file: `${date}-${hh}${mm}` };
}

function reviewedCounts(compact) {
  const convs = (compact.conversations ?? []).filter((c) => (c.uses ?? []).length > 0);
  const uses = convs.reduce((n, c) => n + c.uses.length, 0);
  const skills = [...new Set(convs.flatMap((c) => c.uses.map((u) => u.skill)))].sort();
  return { convs: convs.length, uses, skills };
}

// Observation text on one line: newlines become spaces.
function oneLine(text) {
  return String(text).replace(/\s*\r?\n\s*/g, ' ').trim();
}

// `- <id> <part>: <description>`; without a description, `- <id> <part>`.
function entryHead(o) {
  const desc = o.description == null || String(o.description).trim() === '' ? '' : oneLine(o.description);
  return desc ? `- ${o.id} ${o.part}: ${desc}` : `- ${o.id} ${o.part}`;
}

// Map of Observation ID -> Set of event names, from `observation: <id> <event>` lines.
function eventsById(observationLines) {
  const byId = new Map();
  for (const line of observationLines ?? []) {
    const m = /^observation: (\S+) (\S+)$/.exec(line);
    if (!m) continue;
    if (!byId.has(m[1])) byId.set(m[1], new Set());
    byId.get(m[1]).add(m[2]);
  }
  return byId;
}

function sortById(list) {
  return [...list].sort((a, b) => compareIds(a.id, b.id));
}

// Changed, Improved, Same, Next bodies, keyed by section name.
function sectionBodies(record, observationLines) {
  const events = eventsById(observationLines);
  const observations = record.observations ?? [];
  const has = (id, ...names) => names.some((n) => events.get(id)?.has(n));
  const byEvent = (pred) => sortById(observations.filter((o) => pred(o.id))).map((o) => entryHead(o));

  const changed = byEvent((id) => has(id, 'new', 'confirmed', 'dismissed') && !has(id, 'improved', 'unchanged'));
  const improved = byEvent((id) => has(id, 'improved'));
  const same = byEvent((id) => has(id, 'unchanged'));

  const partChanges = sortById(
    observations.filter((o) => o.state === 'confirmed' && o.outcome === 'part change'),
  ).map((o) => `${entryHead(o)} Fix type: ${o.fixType}.`);
  const devNotes = sortById(
    observations.filter(
      (o) => o.outcome === 'Developer note' && (o.state === 'watching' || o.state === 'confirmed') && events.has(o.id),
    ),
  ).map((o) => {
    const desc = o.description == null || String(o.description).trim() === '' ? '' : ` ${oneLine(o.description)}`;
    return `- ${o.id} ${o.part}: Developer note.${desc}`;
  });

  return { Changed: changed, Improved: improved, Same: same, Next: [...partChanges, ...devNotes] };
}

// ctx: {project, now, version, source, compact, record, observationLines, notices, handoffsReviewed}
export function renderSummary(ctx) {
  const { project, now, version, source, compact, record, notices } = ctx;
  const bodies = sectionBodies(record, ctx.observationLines);
  const { convs, uses, skills } = reviewedCounts(compact);
  const pending = (record.handoffs ?? []).filter((h) => h.state === 'pending').length;
  const depth1 = compact.tokens?.depth1 ?? 0;
  const depth2 = compact.tokens?.depth2 ?? 0;

  const lines = [
    `# Skill Review - ${project} - ${stamp(now).title}`,
    `Workflow version: ${version} (source ${source})`,
    `Reviewed: ${convs} Conversations, ${uses} skill uses (${skills.join(', ')}), ${ctx.handoffsReviewed ?? 0} Handoffs; pending Handoffs: ${pending}`,
    `Model tokens: ${depth1 + depth2} read (Depth 1: ${depth1}, Depth 2: ${depth2})`,
  ];
  for (const name of SECTIONS) lines.push(`## ${name}`, ...(bodies[name].length ? bodies[name] : ['None.']));
  if (notices.length) {
    lines.push('## Notices', ...notices.slice(0, MAX_NOTICES).map((n) => `- ${n}`));
    if (notices.length > MAX_NOTICES) lines.push(`${notices.length - MAX_NOTICES} more notices not shown.`);
  }
  return lines.join('\n') + '\n';
}
