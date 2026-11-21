function sectionLines(doc, name) {
  const start = doc.lines.findIndex((text) => text === `## ${name}`);
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < doc.lines.length && !/^## /.test(doc.lines[i]); i++) {
    if (doc.lines[i].trim() !== '') out.push({ text: doc.lines[i], line: i + 1 });
  }
  return out;
}

const TERM = /^- `[^`]+` - \S.*$/;
const RETIRED = /^- `[^`]+` -> `[^`]+` - \S.*$/;

const usable = (folder) => (folder.glossary && !folder.glossary.unreadable ? folder.glossary : null);

export const glossaryRules = [
  {
    id: 'structure/glossary-section',
    severity: 'error',
    check: (folder) => {
      const doc = usable(folder);
      if (!doc) return [];
      return ['Terms', 'Retired']
        .filter((name) => sectionLines(doc, name) === null)
        .map((name) => ({ path: doc.path, line: 1, message: `Glossary is missing required section: ## ${name}` }));
    },
  },
  {
    id: 'structure/glossary-term-format',
    severity: 'error',
    check: (folder) => {
      const doc = usable(folder);
      if (!doc) return [];
      const bad = (name, re, shape) =>
        (sectionLines(doc, name) ?? [])
          .filter(({ text }) => !re.test(text))
          .map(({ line }) => ({ path: doc.path, line, message: `${name} line must read ${shape}` }));
      return [
        ...bad('Terms', TERM, '"- `Term` - meaning"'),
        ...bad('Retired', RETIRED, '"- `Old` -> `New` - reason"'),
      ];
    },
  },
];
