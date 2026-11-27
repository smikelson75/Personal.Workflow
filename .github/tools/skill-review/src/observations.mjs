export const KINDS = ['rule adherence', 'Developer contribution', 'growth without payoff', 'token cost'];
export const LABELS = ['capture miss', 'decomposition miss', 'translation miss', 'requirements miss'];
export const OUTCOMES = ['part change', 'Developer note', 'no action'];
export const FIX_TYPES = ['check or script', 'clarified rule', 'removed rule', 'new prose'];
import { settleChances } from './lifecycle.mjs';

const DISMISSAL_CAUSES = ['model habit', 'harness limit'];
const ASKERS = ['brain-storm', 'incubate'];

const blank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

function invalid(n, message) {
  const err = new Error(`case ${n}: ${message}`);
  err.category = 'judgement-invalid';
  err.detail = `case ${n}: ${message}`;
  return err;
}

function idText(number) {
  return `O${String(number).padStart(2, '0')}`;
}

function inNewPosition(compact, conversation, line) {
  const [harness, ...rest] = String(conversation).split(':');
  const id = rest.join(':');
  const conv = compact.conversations.find((c) => c.harness === harness && c.id === id);
  if (!conv) return false;
  return (conv.uses ?? []).some((u) => line >= (u.from ?? u.start) && line <= u.end);
}

function validateNew(c, n) {
  if (blank(c.ref)) throw invalid(n, 'ref missing');
  if (blank(c.part)) throw invalid(n, 'part missing');
  const hasKind = !blank(c.kind);
  const hasLabel = !blank(c.label);
  if (hasKind === hasLabel) throw invalid(n, 'exactly one of kind or label is required');
  if (hasKind && !KINDS.includes(c.kind)) throw invalid(n, `unknown kind "${c.kind}"`);
  if (hasLabel && !LABELS.includes(c.label)) throw invalid(n, `unknown label "${c.label}"`);
  if (blank(c.outcome)) throw invalid(n, 'outcome missing');
  if (!OUTCOMES.includes(c.outcome)) throw invalid(n, `unknown outcome "${c.outcome}"`);
  if (blank(c.description)) throw invalid(n, 'description missing');
  if (c.outcome === 'part change' && (!FIX_TYPES.includes(c.fixType) || blank(c.fixReason))) {
    throw invalid(n, 'fix filter missing');
  }
  if (c.outcome === 'no action' && blank(c.cause)) throw invalid(n, 'cause missing');
}

function create(record, c) {
  const o = {
    id: idText(record.nextObservation),
    part: c.part,
    state: 'watching',
    kind: c.kind ?? null,
    label: c.label ?? null,
    side: c.side ?? null,
    area: c.area ?? null,
    outcome: c.outcome,
    cause: c.cause ?? null,
    model: c.model ?? null,
    fixType: c.fixType ?? null,
    fixReason: c.fixReason ?? null,
    description: c.description,
    cases: 0,
    chances: 0,
    changeCommit: null,
    follows: null,
  };
  record.nextObservation += 1;
  record.observations.push(o);
  return o;
}

// Records a matched case against an existing Observation, for the changed-lifecycle walk.
function note(hits, id, c) {
  if (!hits.has(id)) hits.set(id, []);
  hits.get(id).push({ key: String(c.conversation), line: c.line });
}

// A matched case on an improved Observation opens a new watching Observation that follows it.
function follow(record, prior) {
  const o = create(record, {
    part: prior.part,
    kind: prior.kind,
    label: prior.label,
    side: prior.side,
    area: prior.area,
    outcome: prior.outcome,
    fixType: prior.fixType,
    fixReason: prior.fixReason,
    description: prior.description,
  });
  o.follows = prior.id;
  return o;
}

// A requirements-miss case joins the Observation with its label and area (ignoring match),
// never leaves `watching`, and opens one confirmed question gap when its area reaches two cases.
function applyRequirementsMiss(record, c, n, events, hits) {
  validateNew(c, n);
  if (blank(c.area)) throw invalid(n, 'area missing');
  if (blank(c.asker)) throw invalid(n, 'asker missing');
  if (!ASKERS.includes(c.asker)) throw invalid(n, `unknown asker "${c.asker}"`);
  if (c.outcome === 'no action' && DISMISSAL_CAUSES.includes(c.cause)) {
    throw invalid(n, 'requirements miss cannot be dismissed');
  }

  let obs = record.observations.find((o) => o.label === 'requirements miss' && o.area === c.area);
  const gapExists = record.observations.some((o) => o.kind === 'question gap' && o.area === c.area);
  const opensGap = obs !== undefined && obs.cases === 1 && !gapExists;
  if (opensGap && (!FIX_TYPES.includes(c.fixType) || blank(c.fixReason))) {
    throw invalid(n, 'fix filter missing');
  }

  let isNew = false;
  if (!obs) {
    obs = create(record, c);
    isNew = true;
  } else {
    note(hits, obs.id, c);
  }
  obs.cases += 1;
  events.push({ id: obs.id, event: isNew ? 'new' : 'case' });

  if (opensGap) {
    const gap = create(record, {
      part: c.asker,
      kind: 'question gap',
      label: null,
      area: c.area,
      outcome: 'part change',
      fixType: c.fixType,
      fixReason: c.fixReason,
      description: c.description,
    });
    gap.state = 'confirmed';
    gap.cases = obs.cases;
    events.push({ id: gap.id, event: 'new' }, { id: gap.id, event: 'confirmed' });
  }
}

// Mutates `record`; throws an error with category `judgement-invalid` before any change is kept by the caller.
// Returns the `observation: <id> <event>` lines, in Observation ID order and event order.
export function applyCases(record, compact, cases) {
  record.observations ??= [];
  record.nextObservation ??= 1;
  const refs = new Map();
  const followers = new Map();
  const events = [];
  const hits = new Map();

  cases.forEach((c, index) => {
    const n = index + 1;
    if (c === null || typeof c !== 'object') throw invalid(n, 'not an object');
    if (!inNewPosition(compact, c.conversation, c.line)) {
      const [harness, ...rest] = String(c.conversation).split(':');
      const known = compact.conversations.some((x) => x.harness === harness && x.id === rest.join(':'));
      throw invalid(n, known ? `line ${c.line} is not in a new Position` : `unknown conversation ${c.conversation}`);
    }

    if (c.label === 'requirements miss') {
      applyRequirementsMiss(record, c, n, events, hits);
      return;
    }

    const dismisses = c.outcome === 'no action' && DISMISSAL_CAUSES.includes(c.cause);
    let obs;
    let isNew = false;
    if (!blank(c.match)) {
      obs = record.observations.find((o) => o.id === c.match);
      if (!obs) throw invalid(n, `unknown observation ${c.match}`);
      if (obs.state === 'improved') {
        if (followers.has(obs.id)) {
          obs = followers.get(obs.id);
        } else {
          obs = follow(record, obs);
          followers.set(c.match, obs);
          isNew = true;
        }
      } else {
        note(hits, obs.id, c);
      }
    } else {
      validateNew(c, n);
      obs = refs.get(c.ref);
      if (!obs) {
        obs = create(record, c);
        refs.set(c.ref, obs);
        isNew = true;
      }
    }
    if (dismisses && blank(c.model)) throw invalid(n, 'model missing');
    if (dismisses && obs.label === 'requirements miss') {
      throw invalid(n, 'requirements miss cannot be dismissed');
    }

    obs.cases += 1;
    events.push({ id: obs.id, event: isNew ? 'new' : 'case' });
    if (obs.state === 'dismissed') return;
    if (dismisses) {
      obs.state = 'dismissed';
      obs.cause = c.cause;
      obs.model = c.model;
      events.push({ id: obs.id, event: 'dismissed' });
      return;
    }
    if (obs.state === 'watching' && obs.cases >= 2) {
      obs.state = 'confirmed';
      events.push({ id: obs.id, event: 'confirmed' });
    }
  });

  settleChances(record, compact, hits, events);

  const order = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return events
    .map((e, i) => ({ ...e, i }))
    .sort((a, b) => order(a, b) || a.i - b.i)
    .map((e) => `observation: ${e.id} ${e.event}`);
}
