import { buildChain } from './chain.mjs';
import { formatFindings } from './finding.mjs';
import { RULES } from './rules/index.mjs';
import { findWorkflowRoot, loadFolder } from './workspace.mjs';

export function run({ cwd, args }) {
  const root = findWorkflowRoot(cwd);
  if (root === null) {
    return {
      stdout: '',
      stderr: `workflow-check: no .workflow folder found in ${cwd} or any parent directory\n`,
      code: 2,
    };
  }
  const folder = loadFolder(root);
  folder.chain = buildChain(folder);
  const findings = [];
  for (const rule of RULES) {
    for (const hit of rule.check(folder)) {
      findings.push({ ruleId: rule.id, severity: rule.severity, ...hit });
    }
  }
  const { text, errors } = formatFindings(findings);
  return { stdout: text, stderr: '', code: errors > 0 ? 1 : 0 };
}
