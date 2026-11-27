const OTHER = { role: 'other', text: '', tools: [], toolError: false };

function str(v) {
  return typeof v === 'string' ? v : '';
}

function classifyCopilot(rec) {
  const data = rec.data ?? {};
  switch (rec.type) {
    case 'user.message':
      return { role: 'user', text: str(data.content), tools: [], toolError: false };
    case 'assistant.message':
      return { role: 'assistant', text: str(data.content), tools: [], toolError: false };
    case 'tool.execution_start':
      return { role: 'tool-start', text: '', tools: typeof data.toolName === 'string' ? [data.toolName] : [], toolError: false };
    case 'tool.execution_complete':
      return { role: 'tool-result', text: str(data.result?.content), tools: [], toolError: data.success === false };
    default:
      return OTHER;
  }
}

function classifyClaude(rec) {
  const content = rec.message?.content;
  if (rec.type === 'user') {
    if (typeof content === 'string') return { role: 'user', text: content, tools: [], toolError: false };
    if (Array.isArray(content)) {
      const results = content.filter((i) => i?.type === 'tool_result');
      if (results.length) {
        return {
          role: 'tool-result',
          text: str(results[0].content),
          tools: [],
          toolError: results.some((i) => i.is_error === true),
        };
      }
    }
    return OTHER;
  }
  if (rec.type === 'assistant') {
    const items = Array.isArray(content) ? content : [];
    return {
      role: 'assistant',
      text: items.filter((i) => i?.type === 'text').map((i) => str(i.text)).join(''),
      tools: items.filter((i) => i?.type === 'tool_use' && typeof i.name === 'string').map((i) => i.name),
      toolError: false,
    };
  }
  return OTHER;
}

export function classify(rec, harness) {
  if (rec === null || typeof rec !== 'object') return OTHER;
  return harness === 'Claude Code' ? classifyClaude(rec) : classifyCopilot(rec);
}
