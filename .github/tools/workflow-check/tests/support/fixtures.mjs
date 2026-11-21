export const SESSION_NAME = 'context-2026-11-20-1124.md';

const DEFAULT_SECTIONS = {
  'Existing Solution': '- nothing yet.',
  Problem: '- users need a tool.',
  Users: '- `Developer` - runs it.',
  Workflow: '- run it -> see output.',
  Requirements: '- R1 - Users can run it. Accept: it runs.',
  'Scope Guardrails': '- in: running.\n- out: nothing.',
  Constraints: '- none.',
  Success: '- v1 succeeds when it runs.',
  Decisions: '- parked: extras - later.',
  Language: '- `Finding` - a reported break.',
};

// overrides: { status, relationship, size, title, header (extra header lines), sections: {Name: body | null} }
export function validSession(overrides = {}) {
  const {
    status = 'final',
    relationship = 'new',
    size = 'small',
    title = '# Context - 2026-11-20 11:24',
    header = [],
    sections = {},
  } = overrides;
  const merged = { ...DEFAULT_SECTIONS, ...sections };
  if (relationship === 'new' && !('Existing Solution' in sections)) delete merged['Existing Solution'];
  const lines = [title, '', `- Status: ${status}`, `- Relationship: ${relationship}`, `- Size: ${size}`, ...header];
  for (const [name, body] of Object.entries(merged)) {
    if (body === null) continue;
    lines.push('', `## ${name}`, body);
  }
  return lines.join('\n') + '\n';
}

export function validGlossary() {
  return '# Language\n\n## Terms\n- `Finding` - a reported break.\n\n## Retired\n';
}

export function cleanFolder() {
  return {
    [`.workflow/sessions/${SESSION_NAME}`]: validSession(),
    '.workflow/language.md': validGlossary(),
  };
}
