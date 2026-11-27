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

// A string, or the joined text items of a content array.
function contentText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((i) => i?.type === 'text').map((i) => str(i.text)).join('');
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
          text: contentText(results[0].content),
          tools: [],
          toolError: results.some((i) => i.is_error === true),
        };
      }
      return { role: 'user', text: contentText(content), tools: [], toolError: false };
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

function flat(text) {
  return text.replace(/\r\n|\r|\n/g, ' ');
}

// Splits a rendered record into its label and content; `rec` is null for an unparseable line.
export function renderParts(rec, harness) {
  if (rec === null) return { label: 'other', content: 'unparseable' };
  const { role, text, tools, toolError } = classify(rec, harness);
  const type = typeof rec.type === 'string' ? rec.type : '';
  switch (role) {
    case 'user':
      return { label: 'user', content: flat(text) };
    case 'assistant':
      if (text === '' && tools.length) return { label: 'tool', content: tools.join(', ') };
      return { label: 'assistant', content: flat(text) + (tools.length ? ` [tools: ${tools.join(', ')}]` : '') };
    case 'tool-start':
      return { label: 'tool', content: tools.join(', ') };
    case 'tool-result':
      return { label: 'tool-result', content: `${toolError ? 'ERROR ' : ''}${flat(text)}` };
    default:
      return { label: 'other', content: type };
  }
}

export function renderRecord(rec, harness) {
  const { label, content } = renderParts(rec, harness);
  return `${label}: ${content}`;
}
