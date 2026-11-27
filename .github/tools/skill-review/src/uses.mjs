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

export function claudeSkillStart(rec) {
  if (rec.type === 'user' && typeof rec.message?.content === 'string') {
    const m = /<command-name>\/([^<]+)<\/command-name>/.exec(rec.message.content);
    return m ? m[1] : null;
  }
  if (rec.type === 'assistant' && Array.isArray(rec.message?.content)) {
    for (const item of rec.message.content) {
      if (item?.type === 'tool_use' && item.name === 'Skill' && typeof item.input?.skill === 'string') {
        return item.input.skill;
      }
    }
  }
  return null;
}

// Returns [{line, type}] for each line that is not valid JSON or whose type is not in knownTypes.
export function unknownRecords(conversation, knownTypes) {
  const out = [];
  conversation.lines.forEach((line, i) => {
    const rec = parseLine(line);
    const type = rec && typeof rec.type === 'string' ? rec.type : null;
    if (type === null) out.push({ line: i + 1, type: 'unparseable' });
    else if (!knownTypes.has(type)) out.push({ line: i + 1, type });
  });
  return out;
}
