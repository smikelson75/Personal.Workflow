import { existsSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { buildChain } from './chain.mjs';
import { formatFindings } from './finding.mjs';
import { RULES } from './rules/index.mjs';
import { findWorkflowRoot, loadFolder } from './workspace.mjs';

const fail = (message) => ({ stdout: '', stderr: `workflow-check: ${message}\n`, code: 2 });

// Repo-relative path of the file argument, or a failure result when it is not a Session or the Glossary.
function resolveTarget(arg, cwd, folder) {
  const absolute = resolve(cwd, arg);
  if (!existsSync(absolute)) return { error: fail(`${arg} does not exist`) };
  const rel = relative(folder.root, absolute).split(sep).join('/');
  const isGlossary = rel === '.workflow/language.md' && folder.glossary !== null;
  const isSession = folder.sessions.some((s) => s.path === rel);
  if (!isGlossary && !isSession) return { error: fail(`${arg} is not a Session or the Glossary of the Workflow Folder`) };
  return { path: rel };
}

export function run({ cwd, args }) {
  if (args.length > 1) return fail('expected at most one file argument');
  const root = findWorkflowRoot(cwd);
  if (root === null) {
    return {
      stdout: '',
      stderr: `workflow-check: no .workflow folder found in ${cwd} or any parent directory\n`,
      code: 2,
    };
  }
  const folder = loadFolder(root);
  let target = null;
  if (args.length === 1) {
    const resolved = resolveTarget(args[0], cwd, folder);
    if (resolved.error) return resolved.error;
    target = resolved.path;
  }
  folder.chain = buildChain(folder);
  const findings = [];
  for (const rule of RULES) {
    for (const hit of rule.check(folder)) {
      findings.push({ ruleId: rule.id, severity: rule.severity, ...hit });
    }
  }
  const shown = target === null ? findings : findings.filter((f) => f.path === target);
  const { text, errors } = formatFindings(shown);
  return { stdout: text, stderr: '', code: errors > 0 ? 1 : 0 };
}
