const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const MAX_MESSAGE = 160;

function clip(message) {
  const oneLine = message.replace(/[\r\n]+/g, ' ');
  return oneLine.length <= MAX_MESSAGE ? oneLine : oneLine.slice(0, MAX_MESSAGE - 3) + '...';
}

export function formatFindings(findings) {
  const sorted = findings
    .map((f, i) => ({ f, i }))
    .sort((a, b) => cmp(a.f.path, b.f.path) || a.f.line - b.f.line || cmp(a.f.ruleId, b.f.ruleId) || a.i - b.i)
    .map(({ f }) => f);
  const lines = sorted.map((f) => `${f.path}:${f.line}: ${f.severity}: ${f.ruleId}: ${clip(f.message)}`);
  const errors = sorted.filter((f) => f.severity === 'error').length;
  const warnings = sorted.length - errors;
  lines.push(`workflow-check: ${errors} errors, ${warnings} warnings`);
  return { text: lines.join('\n') + '\n', errors, warnings };
}
