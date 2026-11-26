import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readme() {
  return readFileSync(join(REPO, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
}

// Collapse line wrapping so prose regexes are tolerant of wrapping.
function flat(s) {
  return s.replace(/\s+/g, ' ');
}

// Text of the section whose heading line matches headingRe, up to the next heading of the same or higher level.
function section(text, headingRe) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && headingRe.test(l));
  assert.ok(start >= 0, `README has a heading matching ${headingRe}`);
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

const HOME = /^Home Repo\b|\bHome Repo\b/;

test('[R47-01] README Home Repo section: create a git repo, commit AGENTS.md with Project Pointers and CLAUDE.md (@AGENTS.md), run update-home.mjs', () => {
  const text = readme();
  const sec = section(text, /^##\s+Home Repo\b/);
  const f = flat(sec);

  assert.match(f, /git (repo|repository|init)/i, 'tells the Developer to create a git repo');
  assert.match(f, /AGENTS\.md/, 'names AGENTS.md');
  assert.match(f, /Project Pointers/, 'AGENTS.md holds Project Pointers');
  assert.match(f, /CLAUDE\.md/, 'names CLAUDE.md');
  assert.match(f, /@AGENTS\.md/, 'CLAUDE.md contains @AGENTS.md');
  assert.match(f, /node scripts[\\/]update-home\.mjs <home>/, 'runs node scripts/update-home.mjs <home>');

  const homeIdx = text.search(/^##\s+Home Repo\b/m);
  const quickIdx = text.search(/^##\s+Quick Start\b/m);
  assert.ok(quickIdx >= 0 && homeIdx < quickIdx, 'Home Repo section comes before Quick Start');
});

test('[R47-02] README shows the Update Script from a clone (git clone) and from a zip (Expand-Archive), each naming the Home Repo path', () => {
  const text = readme();

  const cloneAt = text.search(/git clone\b/);
  assert.ok(cloneAt >= 0, 'README shows git clone');
  const afterClone = text.slice(cloneAt, cloneAt + 700);
  assert.match(afterClone, /update-home\.mjs\s+\S*<home>|update-home\.mjs\s+["']?[A-Za-z]:\\/, 'clone path runs update-home.mjs with the Home Repo path');

  const zipAt = text.search(/Expand-Archive\b/);
  assert.ok(zipAt >= 0, 'README shows Expand-Archive');
  const afterZip = text.slice(zipAt, zipAt + 700);
  assert.match(afterZip, /update-home\.mjs\s+\S*<home>|update-home\.mjs\s+["']?[A-Za-z]:\\/, 'zip path runs update-home.mjs with the Home Repo path');
});

test('[R47-03] README shows launch by full path, launch version, and a wf PowerShell function forwarding all arguments by path', () => {
  const text = readme();

  assert.match(text, /<home>\\launch(?:\.cmd|\.ps1)?\s+claude/, 'shows <home>\\launch claude');
  assert.match(text, /\blaunch(?:\.cmd|\.ps1)?\s+version\b/, 'shows launch version');

  const blocks = [...text.matchAll(/```powershell\n([\s\S]*?)```/g)].map((m) => m[1]);
  const wf = blocks.find((b) => /function\s+wf\b/.test(b));
  assert.ok(wf, 'a powershell block defines function wf');
  assert.match(wf, /\$args|@args/, 'wf forwards all arguments');
  assert.match(wf, /launch/, 'wf calls the Launch Script');
  assert.match(wf, /\\launch|[\\/]launch/, 'wf calls the Launch Script by path');
});

test('[R47-04] README shows direct claude/copilot --add-dir commands with the --settings unguarded warning and the trusted-folder warning', () => {
  const text = readme();
  const f = flat(text);

  assert.match(text, /\bclaude\b[^\n]*--add-dir/, 'shows claude --add-dir');
  assert.match(text, /\bcopilot\b[^\n]*--add-dir/, 'shows copilot --add-dir');
  assert.match(text, /--settings/, 'mentions the --settings option');
  assert.match(
    f,
    /Claude Code[^.]{0,200}without[^.]{0,120}--settings[^.]{0,120}unguarded|without[^.]{0,120}--settings[^.]{0,200}Claude Code[^.]{0,120}unguarded|unguarded[^.]{0,200}--settings/i,
    'warns that Claude Code started without --settings is unguarded',
  );
  assert.match(f, /Copilot CLI[^.]{0,120}needs? a trusted folder/i, 'warns that Copilot CLI needs a trusted folder');
});

test('[R47-05] README keeps the copy-into-repository section, retitled (Alternative), with .claude\\skills, .claude\\agents and the trusted-folder sentence', () => {
  const sec = section(readme(), /Copy the Workflow Core into Your Repository \(Alternative\)/);
  const f = flat(sec);

  assert.match(sec, /\.claude\\skills/, 'section covers .claude\\skills');
  assert.match(sec, /\.claude\\agents/, 'section covers .claude\\agents');
  assert.match(f, /Copilot CLI runs the locked-tests guard only in a trusted folder/, 'keeps the trusted-folder sentence');
});

test('[R47-06] README links the Coordination Playbook, names /agents-md and /addon-author, and says a Stack: line in AGENTS.md selects the Language Add-on', () => {
  const text = readme();
  const f = flat(text);

  assert.ok(
    text.includes('.github/skills/onboard-project/references/COORDINATION-PLAYBOOK.md'),
    'links the Coordination Playbook path',
  );
  assert.match(text, /\/agents-md\b/, 'names /agents-md');
  assert.match(text, /\/addon-author\b/, 'names /addon-author');
  assert.match(
    f,
    /`?Stack:`? line[^.]{0,120}AGENTS\.md[^.]{0,160}(selects?|chooses?|picks?)[^.]{0,80}Language Add-on|AGENTS\.md[^.]{0,120}`?Stack:`?[^.]{0,160}(selects?|chooses?|picks?)[^.]{0,80}Language Add-on|`?Stack:`?[^.]{0,200}(selects?|chooses?|picks?)[^.]{0,80}Language Add-on/i,
    'states a Stack: line in AGENTS.md selects the Language Add-on',
  );
});
