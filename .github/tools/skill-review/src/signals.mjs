import { parseLine } from './logs.mjs';

const QUESTION_TOOLS = new Set(['ask_user', 'AskUserQuestion']);
const CORRECTION = /^(no|stop|wrong|don't|do not|that's not|that is not)\b/i;
const LONG_MESSAGE = 4000;
const MANY_QUESTIONS = 5;
const MAX_FLAGS = 5;

export function useSignals(conversation, use, classifyFn) {
  const signals = {
    records: 0,
    userMessages: 0,
    assistantMessages: 0,
    toolCalls: 0,
    questions: 0,
    toolErrors: 0,
    longestAssistantChars: 0,
  };
  const flags = [];
  for (let line = use.from; line <= use.end; line++) {
    const raw = conversation.lines[line - 1];
    if (raw === undefined) continue;
    signals.records++;
    const rec = parseLine(raw);
    if (!rec) continue;
    const { role, text, tools, toolError } = classifyFn(rec, conversation.harness);
    signals.toolCalls += tools.length;
    for (const t of tools) {
      if (QUESTION_TOOLS.has(t) && ++signals.questions === MANY_QUESTIONS) flags.push({ kind: 'many-questions', line });
    }
    if (toolError) {
      signals.toolErrors++;
      flags.push({ kind: 'tool-error', line });
    }
    if (role === 'user') {
      signals.userMessages++;
      if (CORRECTION.test(text.trim())) flags.push({ kind: 'user-correction', line });
    } else if (role === 'assistant') {
      signals.assistantMessages++;
      signals.longestAssistantChars = Math.max(signals.longestAssistantChars, text.length);
      if (text.length > LONG_MESSAGE) flags.push({ kind: 'long-message', line });
    }
  }
  flags.sort((a, b) => a.line - b.line || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
  return { signals, flags: flags.slice(0, MAX_FLAGS) };
}
