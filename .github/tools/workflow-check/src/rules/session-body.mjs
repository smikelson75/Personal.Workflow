import { headerFields } from './session-header.mjs';

const REQUIRED = ['Problem', 'Users', 'Workflow', 'Requirements', 'Scope Guardrails', 'Constraints', 'Success', 'Decisions', 'Language'];
const REQUIREMENT_FORMS = [/^- R\d+ - .+\. Accept: .+\.$/, /^- R\d+ - retired, superseded by R\d+\.$/, /^- R\d+ - retired\.$/];
const LINK_NAME = '`context-\\d{4}-\\d{2}-\\d{2}-\\d{4}\\.md`';
const LINKS = new RegExp(`^${LINK_NAME}(, ${LINK_NAME})*$`);

const sessions = (folder) => folder.sessions.filter((s) => !s.unreadable);

// Section name -> {line, bodyStart, bodyEnd} (0-based line indexes for the body).
function sectionMap(doc) {
  const map = new Map();
  let last = null;
  doc.lines.forEach((text, i) => {
    const match = /^## (.+)$/.exec(text);
    if (!match) return;
    if (last) last.bodyEnd = i;
    last = { line: i + 1, bodyStart: i + 1, bodyEnd: doc.lines.length };
    if (!map.has(match[1])) map.set(match[1], last);
  });
  return map;
}

function sectionLines(doc, section) {
  const out = [];
  if (!section) return out;
  for (let i = section.bodyStart; i < section.bodyEnd; i++) out.push({ text: doc.lines[i], line: i + 1 });
  return out;
}

export const sessionBodyRules = [
  {
    id: 'structure/session-section',
    severity: 'error',
    check: (folder) =>
      sessions(folder).flatMap((s) => {
        const map = sectionMap(s);
        const relationship = headerFields(s).Relationship?.value;
        const required = relationship === 'extend' || relationship === 'amend' ? ['Existing Solution', ...REQUIRED] : REQUIRED;
        return required
          .filter((name) => !map.has(name))
          .map((name) => ({ path: s.path, line: 1, message: `missing required section: ## ${name}` }));
      }),
  },
  {
    id: 'structure/requirement-format',
    severity: 'error',
    check: (folder) =>
      sessions(folder).flatMap((s) =>
        sectionLines(s, sectionMap(s).get('Requirements'))
          .filter(({ text }) => text.trim() !== '' && !REQUIREMENT_FORMS.some((re) => re.test(text)))
          .map(({ line }) => ({
            path: s.path,
            line,
            message: 'requirement must read "- R<n> - <behavior>. Accept: <signal>." or be retired',
          })),
      ),
  },
  {
    id: 'structure/link-format',
    severity: 'error',
    check: (folder) =>
      sessions(folder).flatMap((s) => {
        const fields = headerFields(s);
        return ['Builds on', 'Supersedes']
          .filter((name) => fields[name] && !LINKS.test(fields[name].value))
          .map((name) => ({
            path: s.path,
            line: fields[name].line,
            message: `${name} must list backticked context-YYYY-MM-DD-HHmm.md names separated by ", "`,
          }));
      }),
  },
  {
    id: 'structure/final-open',
    severity: 'error',
    check: (folder) =>
      sessions(folder).flatMap((s) => {
        if (headerFields(s).Status?.value !== 'final') return [];
        return sectionLines(s, sectionMap(s).get('Decisions'))
          .filter(({ text }) => /^- open\b/.test(text))
          .map(({ line }) => ({ path: s.path, line, message: 'a final Session must not carry an open Decision' }));
      }),
  },
];
