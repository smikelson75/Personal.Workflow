import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const REPO = resolve(import.meta.dirname, '..', '..');
const read = (rel) => readFileSync(join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');

const REQUIRED = 'Required input: `.workflow/language.md`';
const MESSAGE =
  'Missing required Glossary at .workflow/language.md. Run /brain-storm to establish it before continuing with /pull-work.';

// Text of the section that starts at a heading line, up to the next heading of the same or higher level.
function section(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  assert.notEqual(start, -1, `heading not found: ${heading}`);
  const level = /^#+/.exec(heading)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^(#+)\s/.exec(lines[i]);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n');
}

const requiredLine = (text) => text.split('\n').find((l) => l.startsWith(REQUIRED));

test('[R33-03] pull-work declares the Glossary as required input and checks it in Preflight order', () => {
  const text = read('.github/skills/pull-work/SKILL.md');
  const req = text.split('\n').findIndex((l) => l.startsWith(REQUIRED));
  assert.notEqual(req, -1, 'missing line: ' + REQUIRED);
  const preflightLine = text.split('\n').findIndex((l) => l.trim() === '## Preflight');
  assert.ok(req < preflightLine, 'Required input line must come before ## Preflight');

  const pre = section(text, '## Preflight');
  const a = pre.indexOf('parse-args.mjs');
  const b = pre.indexOf('glossary-check.mjs');
  const c = pre.indexOf('reconcile-check.mjs candidates');
  assert.ok(a !== -1, 'Preflight must mention parse-args.mjs');
  assert.ok(b !== -1, 'Preflight must mention glossary-check.mjs');
  assert.ok(c !== -1, 'Preflight must mention reconcile-check.mjs candidates');
  assert.ok(a < b, 'parse-args.mjs must come before glossary-check.mjs');
  assert.ok(b < c, 'glossary-check.mjs must come before reconcile-check.mjs candidates');

  assert.ok(pre.includes('node .github/skills/pull-work/scripts/glossary-check.mjs'));
  assert.ok(pre.includes(MESSAGE), 'Preflight must carry the redirect message naming /brain-storm');
});

for (const [name, tail] of [
  ['test-author', 'without writing tests'],
  ['test-reviewer', 'without approving'],
]) {
  test(`[R33-04] ${name} requires the Glossary and stops without it (${name})`, () => {
    const text = read(`.github/agents/${name}.agent.md`);
    assert.ok(requiredLine(text), 'missing line: ' + REQUIRED);
    const sentence = text
      .split('\n')
      .find((l) => /missing/i.test(l) && /stop and report/i.test(l) && /caller/i.test(l));
    assert.ok(sentence, 'missing a sentence with missing, stop and report, caller');
    assert.ok(sentence.includes(tail), `sentence must say "${tail}"`);
  });
}

test('[R33-05] pull-work Fixture Repair dispatches pass the Glossary path with the spec path', () => {
  const text = read('.github/skills/pull-work/SKILL.md');
  const fr = section(text, '## Fixture Repair (`Next: fixture repair SNN`)');
  const dispatches = fr
    .split('\n')
    .filter((l) => /^\d+\./.test(l) && /dispatch `test-(author|reviewer)`/i.test(l));
  assert.equal(dispatches.length, 2, 'expected test-author and test-reviewer dispatch steps');
  for (const l of dispatches) {
    const s = l.indexOf('the spec path');
    assert.ok(s !== -1, 'dispatch must name the spec path: ' + l);
    assert.ok(l.indexOf('`.workflow/language.md`', s) > s, 'dispatch must name `.workflow/language.md` after the spec path: ' + l);
  }
});

test('[R33-05] work-planner Phase Review passes the Glossary path with the spec path', () => {
  const text = read('.github/skills/work-planner/SKILL.md');
  const pr = section(text, '### Phase Review (`Next: phase review PNN`)');
  const lines = pr.split('\n').filter((l) => l.includes('spec path'));
  assert.ok(lines.length >= 1, 'Phase Review must pass the spec path');
  for (const l of lines) {
    const s = l.indexOf('spec path');
    assert.ok(l.indexOf('`.workflow/language.md`', s) > s, 'must name `.workflow/language.md` after the spec path: ' + l);
  }
});

test('[R33-06] parse-args.mjs bug: without a Glossary exits 2 with usage and changes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'r33-06-'));
  try {
    const script = join(REPO, '.github', 'skills', 'pull-work', 'scripts', 'parse-args.mjs');
    const r = spawnSync(process.execPath, [script, 'bug:'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.equal(r.stderr.trim(), '/pull-work [<slug>] bug: <description>');
    assert.equal(r.stdout, '');
    assert.deepEqual(readdirSync(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
