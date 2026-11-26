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

const HEADING = /^###\s+Agent models and effort\s*$/;

test('[R48-16] README "Agent models and effort" names /tasks, says Claude Code shows the pinned effort only when the model supports effort, and calls it a known limitation', () => {
  const sec = section(readme(), HEADING);
  const f = flat(sec);

  assert.match(sec, /\/tasks\b/, 'names /tasks');
  assert.match(
    f,
    /Claude Code[^.]{0,200}(shows?|displays?)[^.]{0,120}(pinned )?effort[^.]{0,120}only when[^.]{0,120}model supports effort|Claude Code[^.]{0,200}only (shows?|displays?)[^.]{0,120}effort[^.]{0,120}(when|if)[^.]{0,120}model supports effort/i,
    'says Claude Code shows the pinned effort only when the model supports effort',
  );
  assert.match(f, /known limitation/i, 'calls this a known limitation');
});

test('[R51-04] README "Agent models and effort" names reasoning-effort, the update command, the Agent pin:/Agent default: notice lines, and that running sessions keep their pins until the Harness restarts', () => {
  const sec = section(readme(), HEADING);
  const f = flat(sec);

  assert.match(sec, /reasoning-effort/, 'names reasoning-effort');
  assert.ok(
    /node scripts[\\/]update-home\.mjs <home>/.test(sec),
    'names the command node scripts\\update-home.mjs <home>',
  );
  assert.ok(sec.includes('Agent pin:'), 'names the Agent pin: notice line');
  assert.ok(sec.includes('Agent default:'), 'names the Agent default: notice line');
  assert.match(
    f,
    /sessions? (that are )?already running[^.]{0,120}keep[^.]{0,80}pins?[^.]{0,120}until[^.]{0,80}(Harness|harness)[^.]{0,40}restart/i,
    'says sessions already running keep their pins until the Harness restarts',
  );
});
