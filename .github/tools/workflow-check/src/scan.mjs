export function sectionBody(doc, name) {
  const start = doc.lines.findIndex((text) => text === `## ${name}`);
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < doc.lines.length && !/^## /.test(doc.lines[i]); i++) {
    out.push({ text: doc.lines[i], line: i + 1 });
  }
  return out;
}

export function scanLines(doc, { skip = [] } = {}) {
  const hidden = new Set(['Language', ...skip]);
  const out = [];
  let inHidden = false;
  doc.lines.forEach((text, i) => {
    const heading = /^## (.+)$/.exec(text);
    if (heading) inHidden = hidden.has(heading[1]);
    if (inHidden || text.startsWith('#')) return;
    out.push({ text: text.replace(/`[^`]*`/g, (span) => ' '.repeat(span.length)), line: i + 1 });
  });
  return out;
}

export function matchWord(text, phrase) {
  const body = phrase
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`, 'iu').test(text);
}
