const TERM = /^- `[^`]+` - \S.*$/;
const RETIRED = /^- `[^`]+` -> `[^`]+` - \S.*$/;
const FIRST_TICK = /`([^`]+)`/;

function sectionLines(doc, name) {
  const start = doc.lines.findIndex((text) => text === `## ${name}`);
  if (start === -1) return { heading: 1, lines: [] };
  const lines = [];
  for (let i = start + 1; i < doc.lines.length && !/^## /.test(doc.lines[i]); i++) {
    lines.push({ text: doc.lines[i], line: i + 1 });
  }
  return { heading: start + 1, lines };
}

function avoidEntries(text) {
  const at = text.indexOf('Avoid: ');
  if (at === -1) return [];
  let rest = text.slice(at + 'Avoid: '.length);
  const stop = rest.search(/\. (States|Code):/);
  if (stop !== -1) rest = rest.slice(0, stop);
  rest = rest.replace(/\.$/, '');
  return rest
    .split(/,(?![^(]*\))/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '' && !entry.includes('('));
}

export function parseGlossary(doc) {
  if (!doc || doc.unreadable) return { termsLine: 1, terms: [], retired: [] };
  const terms = sectionLines(doc, 'Terms');
  const retired = sectionLines(doc, 'Retired');
  return {
    termsLine: terms.heading,
    terms: terms.lines
      .filter(({ text }) => TERM.test(text))
      .map(({ text, line }) => ({ name: FIRST_TICK.exec(text)[1], line, avoid: avoidEntries(text) })),
    retired: retired.lines
      .filter(({ text }) => RETIRED.test(text))
      .map(({ text, line }) => ({ old: FIRST_TICK.exec(text)[1], line })),
  };
}
