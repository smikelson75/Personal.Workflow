import { matchWord, scanLines } from '../scan.mjs';

const OUT_OF_STAGE_WORDS = [
  'schema',
  'table',
  'column',
  'endpoint',
  'controller',
  'microservice',
  'ORM',
  'SQL',
  'database',
  'library',
  'framework',
  'npm',
  'NuGet',
  'pip',
  'Docker',
  'Kubernetes',
];

const SESSION_SKIP = ['Existing Solution', 'Constraints', 'Decisions'];

function outOfStageFindings(doc, options) {
  const out = [];
  for (const { text, line } of scanLines(doc, options)) {
    const hits = OUT_OF_STAGE_WORDS.filter((word) => matchWord(text, word));
    if (hits.length === 0) continue;
    const message = `Out-of-stage word(s): ${hits.join(', ')} - belongs to later stages`.slice(0, 160);
    out.push({ path: doc.path, line, message });
  }
  return out;
}

export const excessStageRules = [
  {
    id: 'excess/out-of-stage',
    severity: 'warning',
    check: (folder) => {
      const out = [];
      for (const session of folder.sessions) {
        if (session.unreadable) continue;
        out.push(...outOfStageFindings(session, { skip: SESSION_SKIP }));
      }
      if (folder.glossary && !folder.glossary.unreadable) {
        out.push(...outOfStageFindings(folder.glossary));
      }
      return out;
    },
  },
];
