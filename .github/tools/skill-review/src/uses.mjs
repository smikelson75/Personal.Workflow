import { parseLine } from './logs.mjs';

// isStart(record) returns the skill name when the record starts a skill use, else null.
export function segmentUses(conversation, isStart) {
  const starts = [];
  conversation.lines.forEach((line, i) => {
    const rec = parseLine(line);
    const skill = rec ? isStart(rec) : null;
    if (skill) starts.push({ skill, start: i + 1 });
  });
  return starts.map((s, i) => ({
    skill: s.skill,
    start: s.start,
    end: i + 1 < starts.length ? starts[i + 1].start - 1 : conversation.lines.length,
  }));
}

export function copilotSkillStart(rec) {
  return rec.type === 'skill.invoked' && typeof rec.data?.name === 'string' ? rec.data.name : null;
}
