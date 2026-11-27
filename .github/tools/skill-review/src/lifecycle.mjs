import { readFileSync } from 'node:fs';
import { installOf } from './installs.mjs';
import { parseLine, splitLines } from './logs.mjs';

// The `timestamp` of the first parseable line of a Conversation's file that has one; null when none or unreadable.
export function conversationStart(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  for (const line of splitLines(text)) {
    const rec = parseLine(line);
    if (typeof rec?.timestamp === 'string') return rec.timestamp;
  }
  return null;
}

function loadConversations(compact) {
  return (compact.conversations ?? []).map((conv) => {
    const started = conversationStart(conv.file);
    return { key: `${conv.harness}:${conv.id}`, conv, at: started === null ? NaN : Date.parse(started) };
  });
}

const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Walks the post-install uses (and stray post-install cases) of one changed Observation in time order.
function settle(obs, install, convs, cases, events) {
  const installAt = Date.parse(install.at);
  const post = convs.filter((c) => c.at > installAt);
  const items = [];
  for (const c of post) {
    for (const u of c.conv.uses ?? []) {
      if (u.skill !== obs.part) continue;
      const from = u.from ?? u.start;
      const hit = cases.some((h) => h.key === c.key && h.line >= from && h.line <= u.end);
      items.push({ at: c.at, key: c.key, pos: from, use: true, hit });
    }
  }
  for (const h of cases) {
    const c = post.find((p) => p.key === h.key);
    if (!c) continue;
    const covered = items.some((i) => i.use && i.key === h.key && h.line >= i.from && h.line <= i.end);
    if (!covered) items.push({ at: c.at, key: c.key, pos: h.line, use: false });
  }
  items.sort((a, b) => a.at - b.at || byKey(a.key, b.key) || a.pos - b.pos);

  let chances = obs.chances ?? 0;
  let result = null;
  for (const item of items) {
    if (!item.use || item.hit) {
      result = 'unchanged';
      break;
    }
    chances += 1;
    if (chances >= 2) {
      result = 'improved';
      break;
    }
  }

  if (result === 'unchanged') {
    obs.state = 'confirmed';
    obs.chances = 0;
    obs.changeCommit = null;
    events.push({ id: obs.id, event: 'unchanged' });
  } else if (result === 'improved') {
    obs.state = 'improved';
    obs.chances = chances;
    events.push({ id: obs.id, event: 'improved' });
  } else {
    obs.chances = chances;
  }
}

// Settles every changed Observation that has an install: clean post-install uses count chances; a case
// in a post-install use or stray post-install case returns it to confirmed. Mutates `record`; appends to `events`.
export function settleChances(record, compact, hits, events) {
  let convs = null;
  for (const obs of record.observations ?? []) {
    if (obs.state !== 'changed') continue;
    const install = installOf(record, obs);
    if (!install) continue;
    convs ??= loadConversations(compact);
    settle(obs, install, convs, hits.get(obs.id) ?? [], events);
  }
}
