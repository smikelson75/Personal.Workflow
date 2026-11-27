const MAX_NOTICES = 10;
const SECTIONS = ['Changed', 'Improved', 'Same', 'Next'];

const pad = (n) => String(n).padStart(2, '0');

// Local-time stamp of an ISO time: title 'YYYY-MM-DD HH:mm', file 'YYYY-MM-DD-HHmm'.
export function stamp(now) {
  const d = new Date(now);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return { title: `${date} ${hh}:${mm}`, file: `${date}-${hh}${mm}` };
}

function reviewedCounts(compact) {
  const convs = (compact.conversations ?? []).filter((c) => (c.uses ?? []).length > 0);
  const uses = convs.reduce((n, c) => n + c.uses.length, 0);
  const skills = [...new Set(convs.flatMap((c) => c.uses.map((u) => u.skill)))].sort();
  return { convs: convs.length, uses, skills };
}

// ctx: {project, now, version, source, compact, record, observationLines, notices, handoffsReviewed}
export function renderSummary(ctx) {
  const { project, now, version, source, compact, record, notices } = ctx;
  const { convs, uses, skills } = reviewedCounts(compact);
  const pending = (record.handoffs ?? []).filter((h) => h.state === 'pending').length;
  const depth1 = compact.tokens?.depth1 ?? 0;
  const depth2 = compact.tokens?.depth2 ?? 0;

  const lines = [
    `# Skill Review - ${project} - ${stamp(now).title}`,
    `Workflow version: ${version} (source ${source})`,
    `Reviewed: ${convs} Conversations, ${uses} skill uses (${skills.join(', ')}), ${ctx.handoffsReviewed ?? 0} Handoffs; pending Handoffs: ${pending}`,
    `Model tokens: ${depth1 + depth2} read (Depth 1: ${depth1}, Depth 2: ${depth2})`,
  ];
  for (const name of SECTIONS) lines.push(`## ${name}`, 'None.');
  if (notices.length) {
    lines.push('## Notices', ...notices.slice(0, MAX_NOTICES).map((n) => `- ${n}`));
    if (notices.length > MAX_NOTICES) lines.push(`${notices.length - MAX_NOTICES} more notices not shown.`);
  }
  return lines.join('\n') + '\n';
}
