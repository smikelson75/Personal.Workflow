const FIELD = /^- (Status|Relationship|Size|Builds on|Supersedes): (.*)$/;
const ALLOWED = {
  Status: ['final', 'draft'],
  Relationship: ['new', 'extend', 'amend'],
  Size: ['small', 'medium', 'large'],
};
const NAME = /^context-(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})\.md$/;

// Header fields (lines before the first `## ` heading) as {Field: {value, line}}.
export function headerFields(doc) {
  const fields = {};
  for (let i = 0; i < doc.lines.length; i++) {
    if (doc.lines[i].startsWith('## ')) break;
    const match = FIELD.exec(doc.lines[i]);
    if (match && !(match[1] in fields)) fields[match[1]] = { value: match[2], line: i + 1 };
  }
  return fields;
}

const sessions = (folder) => folder.sessions.filter((s) => !s.unreadable);

export const sessionHeaderRules = [
  {
    id: 'structure/session-name',
    severity: 'error',
    check: (folder) =>
      sessions(folder)
        .filter((s) => !NAME.test(s.name))
        .map((s) => ({ path: s.path, line: 1, message: `Session file name must be context-YYYY-MM-DD-HHmm.md: ${s.name}` })),
  },
  {
    id: 'structure/session-title',
    severity: 'error',
    check: (folder) =>
      sessions(folder).flatMap((s) => {
        const named = NAME.exec(s.name);
        const title = s.lines[0] ?? '';
        const ok = named
          ? title === `# Context - ${named[1]} ${named[2]}:${named[3]}`
          : /^# Context - \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(title);
        return ok ? [] : [{ path: s.path, line: 1, message: 'first line must be "# Context - YYYY-MM-DD HH:mm" matching the file name' }];
      }),
  },
  {
    id: 'structure/session-status',
    severity: 'error',
    check: (folder) =>
      sessions(folder).flatMap((s) => {
        const fields = headerFields(s);
        return Object.entries(ALLOWED).flatMap(([name, values]) => {
          const field = fields[name];
          if (!field) return [{ path: s.path, line: 1, message: `missing "- ${name}:" line` }];
          return values.includes(field.value)
            ? []
            : [{ path: s.path, line: field.line, message: `${name} must be one of ${values.join('|')}` }];
        });
      }),
  },
];
