import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..', '..');

const CANONICAL_TERMS = [
  'Workflow Core',
  'Language Add-on',
  'Setup-Card Approval',
  'Phase Review',
  'Gate',
  'Card',
  'Slice',
  'Scenario',
  'Tier',
  'Behavior Spec',
];

const FORBIDDEN_PATTERNS = [
  { label: 'language skill(s)', re: /\blanguage skills?\b/i },
  { label: 'core workflow', re: /\bcore workflow\b/i },
  { label: 'toolkit', re: /\btoolkit\b/i },
  { label: 'approval step', re: /\bapproval step\b/i },
  { label: 'validation step', re: /\bvalidation step\b/i },
  { label: 'PRD', re: /\bPRD\b/ },
  { label: 'design doc', re: /\bdesign doc\b/i },
  { label: 'language file', re: /\blanguage file\b/i },
  { label: 'dictionary', re: /\bdictionary\b/i },
  { label: 'flaky test', re: /\bflaky test\b/i },
  { label: 'legacy failure', re: /\blegacy failure\b/i },
  { label: 'slice card(s)', re: /\bslice cards?\b/i },
  { label: 'adapter', re: /\badapter\b/i },
  { label: 'Setup-Card Checkpoint', re: /Setup-Card Checkpoint/i },
  { label: 'Phase Review Checkpoint', re: /Phase Review Checkpoint/i },
  { label: 'phase review approval', re: /phase review approval/i },
];

function checkWalkthrough(relPath) {
  const text = readFileSync(join(REPO, ...relPath.split('/')), 'utf8');
  for (const term of CANONICAL_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(text, new RegExp(escaped, 'i'), `${relPath}: missing canonical term "${term}"`);
  }
  for (const { label, re } of FORBIDDEN_PATTERNS) {
    assert.doesNotMatch(text, re, `${relPath}: contains forbidden phrase "${label}"`);
  }
  return text;
}

test('[R31-01] docs/walkthrough-node.md uses canonical vocabulary with no avoided synonyms or variant labels', () => {
  checkWalkthrough('docs/walkthrough-node.md');
});

test('[R31-02] docs/walkthrough-typescript.md uses canonical vocabulary with no avoided synonyms or variant labels', () => {
  checkWalkthrough('docs/walkthrough-typescript.md');
});

test('[R31-03] docs/walkthrough-csharp.md uses canonical vocabulary and removes the stale file-write Review remark', () => {
  const text = checkWalkthrough('docs/walkthrough-csharp.md');
  assert.doesNotMatch(
    text,
    /file writes\/deletes/i,
    'docs/walkthrough-csharp.md: stale file writes/deletes Review: required remark must be removed',
  );
});
