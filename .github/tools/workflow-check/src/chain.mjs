import { headerFields } from './rules/session-header.mjs';

const LINK_NAME = /`(context-[^`]*\.md)`/g;

function parseLinks(fields, name) {
  const field = fields[name];
  if (!field) return [];
  return [...field.value.matchAll(LINK_NAME)].map((m) => ({ target: m[1], line: field.line }));
}

export function buildChain(folder) {
  const status = new Map();
  const links = new Map();
  for (const doc of folder.sessions) {
    if (doc.unreadable) {
      status.set(doc.name, undefined);
      links.set(doc.name, { buildsOn: [], supersedes: [] });
      continue;
    }
    const fields = headerFields(doc);
    status.set(doc.name, fields.Status?.value);
    links.set(doc.name, { buildsOn: parseLinks(fields, 'Builds on'), supersedes: parseLinks(fields, 'Supersedes') });
  }
  const names = new Set(folder.sessions.map((s) => s.name));
  const superseded = new Set();
  for (const [name, entry] of links) {
    if (status.get(name) !== 'final') continue;
    for (const { target } of entry.supersedes) {
      if (target !== name && names.has(target)) superseded.add(target);
    }
  }
  const chain = folder.sessions
    .map((s) => s.name)
    .filter((name) => status.get(name) === 'final' && !superseded.has(name));
  const newest = folder.sessions.length ? folder.sessions[folder.sessions.length - 1].name : null;
  return { status, links, superseded, chain, newest };
}
