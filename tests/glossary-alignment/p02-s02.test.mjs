import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, relative, basename, sep } from 'node:path';

const REPO = resolve(import.meta.dirname, '..', '..');
const GITHUB = join(REPO, '.github');
const TOOLS = join(GITHUB, 'tools');

const FORBIDDEN_PATTERNS = [
  { label: 'language skill(s)', re: /\blanguage skills?\b/i },
  { label: 'core workflow', re: /\bcore workflow\b/i },
  { label: 'toolkit', re: /\btoolkit\b/i },
  { label: 'approval step', re: /\bapproval step\b/i },
  { label: 'validation step', re: /\bvalidation step\b/i },
  { label: 'design doc', re: /\bdesign doc\b/i },
  { label: 'language file', re: /\blanguage file\b/i },
  { label: 'dictionary', re: /\bdictionary\b/i },
  { label: 'flaky test', re: /\bflaky test\b/i },
  { label: 'legacy failure', re: /\blegacy failure\b/i },
  { label: 'slice card(s)', re: /\bslice cards?\b/i },
  { label: 'Setup-Card Checkpoint', re: /Setup-Card Checkpoint/i },
  { label: 'Phase Review Checkpoint', re: /Phase Review Checkpoint/i },
  { label: 'phase review approval', re: /phase review approval/i },
];

const Q_PATTERNS = [
  ...FORBIDDEN_PATTERNS,
  { label: 'language-skills', re: /language-skills/i },
];

function walk(dir, skipDir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (skipDir && full === skipDir) continue;
    if (entry.isDirectory()) out.push(...walk(full, skipDir));
    else out.push(full);
  }
  return out;
}

function rel(p) {
  return relative(REPO, p).split(sep).join('/');
}

// Files in scope: skills/**, agents/**, user-interaction.md (never .github/tools).
function proseFiles() {
  const files = walk(GITHUB, TOOLS).filter((f) => {
    const r = rel(f);
    return (
      r.startsWith('.github/skills/') ||
      r.startsWith('.github/agents/') ||
      r === '.github/user-interaction.md'
    );
  });
  return files;
}

// Apply exemptions: backticked `deferred-to-PRD`; SPEC-FORMAT.md `## Exclude` list.
function exemptedText(file) {
  let text = readFileSync(file, 'utf8');
  if (basename(file) === 'SPEC-FORMAT.md') {
    const lines = text.split(/\r?\n/);
    const kept = [];
    let inExclude = false;
    for (const line of lines) {
      if (/^## /.test(line)) inExclude = /^## Exclude\s*$/.test(line);
      if (!inExclude) kept.push(line);
    }
    text = kept.join('\n');
  }
  return text.replace(/`deferred-to-PRD`/g, '');
}

function scan(files, patterns) {
  const hits = [];
  for (const file of files) {
    const text = exemptedText(file);
    const lines = text.split('\n');
    for (const { label, re } of patterns) {
      lines.forEach((line, i) => {
        if (re.test(line)) hits.push(`${rel(file)}:${i + 1} "${label}"`);
      });
    }
  }
  return hits;
}

function read(relPath) {
  return readFileSync(join(REPO, ...relPath.split('/')), 'utf8');
}

test('[R32-01] Workflow Core prose under .github contains none of the forbidden phrases', () => {
  const files = proseFiles();
  assert.ok(files.length > 0, 'expected prose files under .github/skills and .github/agents');
  const hits = scan(files, FORBIDDEN_PATTERNS);
  assert.deepEqual(hits, [], `forbidden phrases found:\n${hits.join('\n')}`);
});

test('[R32-02] no duplicate glossary file under .github and LANGUAGE-FORMAT.md remains', () => {
  const banned = new Set(['language.md', 'glossary.md', 'workflow-terms.md']);
  const dupes = walk(GITHUB, TOOLS)
    .filter((f) => banned.has(basename(f).toLowerCase()))
    .map(rel);
  assert.deepEqual(dupes, [], `duplicate glossary files: ${dupes.join(', ')}`);
  assert.ok(
    existsSync(join(GITHUB, 'skills', 'brain-storm', 'references', 'LANGUAGE-FORMAT.md')),
    '.github/skills/brain-storm/references/LANGUAGE-FORMAT.md must exist',
  );
});

test('[R32-03] setup-card markers stay and Card terminology replaces slice card in key files', () => {
  assert.match(read('.github/user-interaction.md'), /setup-card approval/i, 'user-interaction.md: missing setup-card approval');
  assert.match(read('.github/agents/planner.agent.md'), /setup-card/i, 'planner.agent.md: missing setup-card');
  for (const f of [
    '.github/skills/work-planner/SKILL.md',
    '.github/skills/pull-work/SKILL.md',
    '.github/agents/coder.agent.md',
  ]) {
    const text = read(f);
    assert.match(text, /\bCard\b/, `${f}: must contain the word Card`);
    assert.doesNotMatch(text, /slice card/i, `${f}: must not contain "slice card"`);
  }
});

test('[Q-zero-vocabulary-drift] walkthroughs and Workflow Core prose contain no forbidden phrases or language-skills', () => {
  const walkthroughs = readdirSync(join(REPO, 'docs'))
    .filter((n) => /^walkthrough-.*\.md$/.test(n))
    .map((n) => join(REPO, 'docs', n));
  assert.ok(walkthroughs.length > 0, 'expected docs/walkthrough-*.md files');
  const hits = scan([...walkthroughs, ...proseFiles()], Q_PATTERNS);
  assert.deepEqual(hits, [], `vocabulary drift found:\n${hits.join('\n')}`);
});
