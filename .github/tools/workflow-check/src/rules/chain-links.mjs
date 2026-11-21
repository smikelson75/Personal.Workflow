const FIELDS = [
  ['buildsOn', 'Builds on'],
  ['supersedes', 'Supersedes'],
];

const sessionPath = (name) => `.workflow/sessions/${name}`;

// True when `from` reaches `to` by following buildsOn and supersedes links of existing Sessions.
function reaches(from, to, links, names) {
  const seen = new Set();
  const queue = [from];
  while (queue.length) {
    const current = queue.shift();
    if (current === to) return true;
    if (seen.has(current) || !names.has(current)) continue;
    seen.add(current);
    const entry = links.get(current);
    if (!entry) continue;
    for (const { target } of [...entry.buildsOn, ...entry.supersedes]) queue.push(target);
  }
  return false;
}

export const chainLinkRules = [
  {
    id: 'chain/broken-link',
    severity: 'error',
    check: ({ sessions, chain }) => {
      const names = new Set(sessions.map((s) => s.name));
      const findings = [];
      for (const s of sessions) {
        const entry = chain.links.get(s.name);
        if (!entry) continue;
        for (const [key, label] of FIELDS) {
          for (const { target, line } of entry[key]) {
            let problem = null;
            if (!names.has(target)) problem = 'file is missing';
            else if (target === s.name) problem = 'names itself';
            else if (reaches(target, s.name, chain.links, names)) problem = 'forms a cycle';
            if (problem) {
              findings.push({
                path: s.path ?? sessionPath(s.name),
                line,
                message: `${label} names ${target}: ${problem}`,
              });
            }
          }
        }
      }
      return findings;
    },
  },
];
