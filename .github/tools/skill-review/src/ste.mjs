// Simplified Technical English limits for the sentences a run writes.
const ENTRY_MAX_SENTENCES = 3;
const PARAGRAPH_MAX_SENTENCES = 6;
const NEXT_MAX_WORDS = 20;
const OTHER_MAX_WORDS = 25;

// Splits text after each `.`, `!`, or `?` that is followed by whitespace or the end of the text.
export function sentences(text) {
  return String(text ?? '')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s !== '');
}

// Whitespace-separated tokens in a sentence.
export function wordCount(sentence) {
  return sentence.split(/\s+/).filter((w) => w !== '').length;
}

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Failure lines for the Observations this run created (`new` events), in ID order.
// An Observation listed in ## Next (confirmed, part change) has the lower word limit.
export function steFailures(record, observationLines) {
  const created = new Set();
  for (const line of observationLines ?? []) {
    const m = /^observation: (\S+) new$/.exec(line);
    if (m) created.add(m[1]);
  }
  const lines = [];
  const observations = (record.observations ?? []).filter((o) => created.has(o.id)).sort(byId);
  for (const o of observations) {
    const max = o.state === 'confirmed' && o.outcome === 'part change' ? NEXT_MAX_WORDS : OTHER_MAX_WORDS;
    const description = sentences(o.description);
    description.forEach((s, i) => {
      const words = wordCount(s);
      if (words > max) lines.push(`ste: ${o.id} sentence ${i + 1} has ${words} words (max ${max})`);
    });
    if (description.length > ENTRY_MAX_SENTENCES) {
      lines.push(`ste: ${o.id} entry has ${description.length} sentences (max ${ENTRY_MAX_SENTENCES})`);
    }
    if (description.length > PARAGRAPH_MAX_SENTENCES) {
      lines.push(`ste: ${o.id} paragraph has ${description.length} sentences (max ${PARAGRAPH_MAX_SENTENCES})`);
    }
    sentences(o.fixReason).forEach((s, i) => {
      const words = wordCount(s);
      if (words > max) lines.push(`ste: ${o.id} fix reason sentence ${i + 1} has ${words} words (max ${max})`);
    });
  }
  return lines;
}
