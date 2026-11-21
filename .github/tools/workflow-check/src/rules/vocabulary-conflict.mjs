import { parseGlossary } from '../glossary-model.mjs';

export const vocabularyConflictRules = [
  {
    id: 'vocabulary/glossary-conflict',
    severity: 'error',
    check: (folder) => {
      const doc = folder.glossary;
      if (!doc || doc.unreadable) return [];
      const { terms, retired } = parseGlossary(doc);
      const lower = (s) => s.toLowerCase();
      const out = [];
      const seen = new Set();
      for (const term of terms) {
        if (seen.has(lower(term.name))) {
          out.push({ path: doc.path, line: term.line, message: `Term ${term.name} is defined twice in the Glossary` });
        }
        seen.add(lower(term.name));
      }
      for (const holder of terms) {
        for (const word of holder.avoid) {
          const hit = terms.find((t) => t !== holder && lower(t.name) === lower(word));
          if (hit) {
            out.push({ path: doc.path, line: holder.line, message: `Term ${hit.name} is also listed in Avoid of ${holder.name}` });
          }
        }
      }
      for (const item of retired) {
        if (terms.some((t) => lower(t.name) === lower(item.old))) {
          out.push({ path: doc.path, line: item.line, message: `Retired term ${item.old} is also a Glossary Term` });
        }
      }
      return out;
    },
  },
];
