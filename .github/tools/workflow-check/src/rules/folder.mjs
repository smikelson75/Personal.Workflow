export const folderRules = [
  {
    id: 'structure/no-session',
    severity: 'error',
    check: (folder) =>
      folder.sessions.length === 0
        ? [{ path: '.workflow/sessions', line: 1, message: 'no Session files found in .workflow/sessions' }]
        : [],
  },
  {
    id: 'structure/glossary-missing',
    severity: 'error',
    check: (folder) =>
      folder.glossary === null
        ? [{ path: '.workflow/language.md', line: 1, message: 'Glossary file .workflow/language.md is missing' }]
        : [],
  },
  {
    id: 'structure/unreadable',
    severity: 'error',
    check: (folder) =>
      [...folder.sessions, ...(folder.glossary ? [folder.glossary] : [])]
        .filter((doc) => doc.unreadable)
        .map((doc) => ({ path: doc.path, line: 1, message: `file is not readable UTF-8 text: ${doc.name}` })),
  },
];
