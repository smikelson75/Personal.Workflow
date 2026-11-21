const COMMAND = '`node .github/tools/workflow-check/bin/workflow-check.mjs`';
const WITH_ARGUMENT = /workflow-check\.mjs[ \t]+[^\s`]/;

export function skillRunsCheck(text) {
  const normalized = String(text).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const hasCommand = normalized.split('\n').some((line) => line.includes(COMMAND));
  return hasCommand && !WITH_ARGUMENT.test(normalized);
}
