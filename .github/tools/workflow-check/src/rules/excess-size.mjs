import { parseGlossary } from '../glossary-model.mjs';
import { sectionBody } from '../scan.mjs';

const SESSION_LIMIT = 1500;
const REQUIREMENT_LIMIT = 60;
const GLOSSARY_LIMIT = 40;

const countWords = (text) => text.split(/\s+/).filter(Boolean).length;

export const excessSizeRules = [
  {
    id: 'excess/session-size',
    severity: 'warning',
    check: (folder) => {
      const out = [];
      for (const session of folder.sessions) {
        if (session.unreadable) continue;
        const words = session.lines.reduce((sum, text) => sum + countWords(text), 0);
        if (words <= SESSION_LIMIT) continue;
        out.push({
          path: session.path,
          line: 1,
          message: `Session has ${words} words; the limit is ${SESSION_LIMIT}`,
        });
      }
      return out;
    },
  },
  {
    id: 'excess/requirement-size',
    severity: 'warning',
    check: (folder) => {
      const out = [];
      for (const session of folder.sessions) {
        if (session.unreadable) continue;
        for (const { text, line } of sectionBody(session, 'Requirements') ?? []) {
          if (text.trim() === '') continue;
          const words = countWords(text.replace(/^- /, ''));
          if (words <= REQUIREMENT_LIMIT) continue;
          out.push({
            path: session.path,
            line,
            message: `Requirement has ${words} words; the limit is ${REQUIREMENT_LIMIT}`,
          });
        }
      }
      return out;
    },
  },
  {
    id: 'excess/glossary-size',
    severity: 'warning',
    check: (folder) => {
      if (!folder.glossary || folder.glossary.unreadable) return [];
      const { termsLine, terms } = parseGlossary(folder.glossary);
      if (terms.length <= GLOSSARY_LIMIT) return [];
      return [
        {
          path: folder.glossary.path,
          line: termsLine,
          message: `Glossary has ${terms.length} Terms; the limit is ${GLOSSARY_LIMIT}`,
        },
      ];
    },
  },
];
