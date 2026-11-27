import { compareIds } from './observations.mjs';
import { installOf } from './installs.mjs';

const STATES = ['confirmed', 'changed', 'watching', 'improved', 'dismissed'];
const DAY_MS = 86400000;

function sortById(list) {
  return [...list].sort((a, b) => compareIds(a.id, b.id));
}

function stateLine(record, o) {
  if (o.state !== 'changed') return `State: ${o.state}`;
  const install = installOf(record, o);
  return `State: changed, ${install ? `installed ${install.version}` : 'not yet installed'}`;
}

// Field lines for one Observation, then its description after a blank line when present.
function entryLines(record, o) {
  const lines = [`### ${o.id} ${o.part}`, stateLine(record, o), `Side: ${o.side ?? 'none'}`];
  if (o.kind) lines.push(`Kind: ${o.kind}`);
  if (o.label) lines.push(`Miss label: ${o.label}`);
  lines.push(`Cases: ${o.cases}`, `Chances to recur: ${o.chances}`);
  if (o.outcome) lines.push(`Outcome: ${o.outcome}`);
  if (o.state === 'confirmed' && o.outcome === 'part change') {
    lines.push(`Fix type: ${o.fixType}`, `Fix reason: ${o.fixReason}`);
  }
  if (o.state === 'changed' && o.changeCommit) lines.push(`Change commit: ${o.changeCommit}`);
  if (o.cause) lines.push(`Cause: ${o.cause}${o.model ? ` (${o.model})` : ''}`);
  const desc = o.description == null ? '' : String(o.description).trim();
  if (desc) lines.push('', desc);
  return lines;
}

// Whole-file text of the Ledger, built from the Review Record alone.
export function renderLedger({ record, now }) {
  const observations = record.observations ?? [];
  const lines = ['# Skill Ledger', ''];
  for (const state of STATES) {
    lines.push(`## ${state}`, '');
    const items = sortById(observations.filter((o) => o.state === state));
    if (!items.length) lines.push('None.', '');
    for (const o of items) lines.push(...entryLines(record, o), '');
  }

  lines.push('## Pending Handoffs', '');
  const pending = (record.handoffs ?? []).filter((h) => h.state === 'pending');
  if (!pending.length) lines.push('None.');
  const nowMs = new Date(now).getTime();
  for (const h of pending) {
    const days = Math.floor((nowMs - new Date(h.writtenAt).getTime()) / DAY_MS);
    lines.push(`- ${h.artifact} (${h.writingSkill} -> ${h.usingSkill}), ${days} days`);
  }
  return lines.join('\n') + '\n';
}
