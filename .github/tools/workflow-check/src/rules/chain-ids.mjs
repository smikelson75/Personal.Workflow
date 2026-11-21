import { headerFields } from './session-header.mjs';

const DEFINITION = /^- R(\d+) - /;
const RETIREMENT = /^- R(\d+) - retired(, superseded by R(\d+))?\.$/;

// Lines under `## Requirements` until the next `## ` heading, with 1-based line numbers.
function requirementLines(doc) {
  const out = [];
  let inside = false;
  doc.lines.forEach((text, i) => {
    if (/^## /.test(text)) {
      inside = text === '## Requirements';
      return;
    }
    if (inside) out.push({ text, line: i + 1 });
  });
  return out;
}

function parseRequirements(doc) {
  const definitions = [];
  const retirements = [];
  for (const { text, line } of requirementLines(doc)) {
    const retired = RETIREMENT.exec(text);
    if (retired) {
      retirements.push({ id: retired[1], by: retired[3], line });
      continue;
    }
    const defined = DEFINITION.exec(text);
    if (defined) definitions.push({ id: defined[1], line });
  }
  return { definitions, retirements };
}

// Names reachable from `name` through buildsOn links of existing Sessions, excluding `name`.
function ancestry(name, links, names) {
  const seen = new Set();
  const queue = (links.get(name)?.buildsOn ?? []).map((l) => l.target);
  while (queue.length) {
    const current = queue.shift();
    if (current === name || seen.has(current) || !names.has(current)) continue;
    seen.add(current);
    for (const { target } of links.get(current)?.buildsOn ?? []) queue.push(target);
  }
  return seen;
}

function model({ sessions, chain }) {
  const names = new Set(sessions.map((s) => s.name));
  const checked = sessions.filter((s) => !s.unreadable && !chain.superseded.has(s.name));
  const defined = new Map();
  for (const s of sessions.filter((d) => !d.unreadable)) {
    const parsed = parseRequirements(s);
    defined.set(s.name, { ...parsed, ids: new Set(parsed.definitions.map((d) => d.id)) });
  }
  return { names, checked, defined };
}

export const chainIdRules = [
  {
    id: 'chain/duplicate-id',
    severity: 'error',
    check: (folder) => {
      const { names, checked, defined } = model(folder);
      const findings = [];
      for (const s of checked) {
        const isAmend = headerFields(s).Relationship?.value === 'amend';
        const ancestors = isAmend ? ancestry(s.name, folder.chain.links, names) : new Set();
        const seenHere = new Set();
        for (const { id, line } of defined.get(s.name).definitions) {
          let earlier = null;
          if (seenHere.has(id)) earlier = s.name;
          else {
            earlier = checked.find(
              (o) => o.name < s.name && defined.get(o.name).ids.has(id) && !(isAmend && ancestors.has(o.name)),
            )?.name;
          }
          seenHere.add(id);
          if (earlier) findings.push({ path: s.path, line, message: `R${id} is already defined in ${earlier}` });
        }
      }
      return findings;
    },
  },
  {
    id: 'chain/unknown-retirement',
    severity: 'error',
    check: (folder) => {
      const { names, checked, defined } = model(folder);
      const chainIds = new Set();
      for (const name of folder.chain.chain) for (const id of defined.get(name)?.ids ?? []) chainIds.add(id);
      const findings = [];
      for (const s of checked) {
        const ancestors = ancestry(s.name, folder.chain.links, names);
        const own = defined.get(s.name);
        for (const { id, by, line } of own.retirements) {
          const known = [...ancestors].some((a) => defined.get(a)?.ids.has(id));
          if (!known) {
            findings.push({ path: s.path, line, message: `R${id} is retired but no earlier Session in its ancestry defines it` });
          } else if (by !== undefined && !chainIds.has(by) && !own.ids.has(by)) {
            findings.push({ path: s.path, line, message: `R${id} is superseded by R${by}, which no Session in the chain defines` });
          }
        }
      }
      return findings;
    },
  },
];
