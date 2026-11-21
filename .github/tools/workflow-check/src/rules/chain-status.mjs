const sessionPath = (name) => `.workflow/sessions/${name}`;

export const chainStatusRules = [
  {
    id: 'chain/no-final',
    severity: 'error',
    check: ({ sessions, chain }) => {
      if (sessions.length === 0 || [...chain.status.values()].includes('final')) return [];
      return [{ path: sessionPath(chain.newest), line: 1, message: 'no Session has Status: final' }];
    },
  },
  {
    id: 'chain/draft-newest',
    severity: 'error',
    check: ({ chain }) =>
      chain.newest !== null && chain.status.get(chain.newest) === 'draft'
        ? [{ path: sessionPath(chain.newest), line: 1, message: 'the newest Session is a draft' }]
        : [],
  },
  {
    id: 'chain/stale-draft',
    severity: 'warning',
    check: ({ sessions, chain }) =>
      sessions
        .filter((s) => chain.status.get(s.name) === 'draft' && s.name !== chain.newest && !chain.superseded.has(s.name))
        .map((s) => ({ path: s.path, line: 1, message: 'draft Session is not the newest' })),
  },
];
