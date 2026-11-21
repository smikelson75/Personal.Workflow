import { parseGlossary } from '../glossary-model.mjs';
import { matchWord, scanLines } from '../scan.mjs';

export const vocabularyAvoidRules = [
  {
    id: 'vocabulary/avoid-synonym',
    severity: 'warning',
    check: (folder) => {
      if (!folder.glossary || folder.glossary.unreadable) return [];
      const entries = [...new Set(parseGlossary(folder.glossary).terms.flatMap((t) => t.avoid))];
      const out = [];
      for (const session of folder.sessions) {
        if (session.unreadable) continue;
        for (const { text, line } of scanLines(session)) {
          const hits = entries.filter((entry) => matchWord(text, entry));
          if (hits.length === 0) continue;
          const message = `Avoid word(s): ${hits.join(', ')} - use the Glossary term`.slice(0, 160);
          out.push({ path: session.path, line, message });
        }
      }
      return out;
    },
  },
];
