import { parseGlossary } from '../glossary-model.mjs';
import { sectionBody } from '../scan.mjs';

const LANGUAGE_BULLET = /^- `([^`]+)`/;

export const vocabularyMissingRules = [
  {
    id: 'vocabulary/missing-term',
    severity: 'error',
    check: (folder) => {
      if (!folder.glossary || folder.glossary.unreadable) return [];
      const names = new Set(parseGlossary(folder.glossary).terms.map((t) => t.name.toLowerCase()));
      const out = [];
      for (const session of folder.sessions) {
        if (session.unreadable) continue;
        for (const { text, line } of sectionBody(session, 'Language') ?? []) {
          const match = LANGUAGE_BULLET.exec(text);
          if (!match) continue;
          const term = match[1];
          if (names.has(term.toLowerCase())) continue;
          out.push({ path: session.path, line, message: `Language term ${term} has no Glossary Term` });
        }
      }
      return out;
    },
  },
];
