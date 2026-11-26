import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, tempRepo } from '../../.github/tools/workflow-core/support/harness.mjs';

const SKILL_DIR = join(repoRoot, '.github', 'skills', 'onboard-project');
const PLAYBOOK = join(SKILL_DIR, 'references', 'COORDINATION-PLAYBOOK.md');

function readText(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

function playbook() {
  assert.ok(existsSync(PLAYBOOK), 'COORDINATION-PLAYBOOK.md missing');
  return readText(PLAYBOOK);
}

function section(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  assert.ok(start >= 0, `no "${heading}" heading`);
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

// Numbered steps: a line starting `N.`; continuation lines belong to the step.
function stepsOf(text) {
  const body = section(text, '## Steps').split('\n');
  const steps = [];
  for (const line of body) {
    const m = /^\s*(\d+)\.\s+(.*)$/.exec(line);
    if (m) steps.push({ n: Number(m[1]), text: m[2] });
    else if (steps.length && line.trim()) steps[steps.length - 1].text += ` ${line.trim()}`;
  }
  return steps;
}

function bulletsOf(text) {
  const body = section(text, '## Project Pointer Roles').split('\n');
  const bullets = [];
  for (const line of body) {
    if (/^\s*[-*]\s+/.test(line)) bullets.push(line.replace(/^\s*[-*]\s+/, ''));
    else if (bullets.length && line.trim()) bullets[bullets.length - 1] += ` ${line.trim()}`;
  }
  return bullets;
}

const flat = (s) => s.replace(/\s+/g, ' ');

test('[R46-01] the Coordination Playbook has three numbered steps in the pinned order', () => {
  const text = playbook();
  assert.match(text, /^# Coordination Playbook$/m);
  const steps = stepsOf(text);
  assert.deepEqual(steps.map((s) => s.n), [1, 2, 3], 'steps must be numbered 1, 2, 3');

  const s1 = flat(steps[0].text);
  assert.match(s1, /API Project Repo/);
  const bs = s1.indexOf('`brain-storm`');
  const bh = s1.indexOf('`behavior-spec`');
  assert.ok(bs >= 0, 'step 1 lacks `brain-storm`');
  assert.ok(bh > bs, 'step 1 must name `brain-storm` then `behavior-spec`');
  assert.match(s1, /limits/);
  assert.match(s1, /required fields/);
  assert.match(s1, /relationships/);

  const s2 = flat(steps[1].text);
  assert.match(s2, /database Project Repo/);
  assert.match(s2, /`brain-storm`/);
  assert.match(s2, /API Behavior Spec path/);
  assert.match(s2, /read-only/);
  assert.match(s2, /`peer-impact`/);
  assert.match(s2, /shared/);
  assert.match(s2, /cross-schema/);
  assert.match(s2, /no edits/);
  assert.match(s2, /no commits/);
  assert.match(s2, /peer/);

  const s3 = flat(steps[2].text);
  assert.match(s3, /`work-planner`/);
  assert.match(s3, /`pull-work`/);
  assert.match(s3, /separately/);
  assert.match(s3, /each Project Repo/);
  assert.match(s3, /Launch Script/);
  assert.match(
    s3,
    /database Phase[^.]*completes before the API Phase[^.]*starts/,
    'step 3 must order the database Phase before the API Phase',
  );
});

test('[R46-02] the Coordination Playbook names the three Project Pointer roles and what each means for steps 2 and 3', () => {
  const text = playbook();
  assert.match(flat(text), /Project Pointers?[^.]*`AGENTS\.md`|`AGENTS\.md`[^.]*Project Pointers?/);
  const bullets = bulletsOf(text);
  const find = (role) => {
    const b = bullets.find((x) => x.startsWith(`\`${role}\``));
    assert.ok(b, `no bullet for role \`${role}\``);
    return flat(b);
  };

  const co = find('co-changed');
  assert.match(co, /step 3/i);
  assert.match(co, /both/);
  assert.match(co, /needs-first/);

  const ro = find('read-only reference');
  assert.match(ro, /step 2/i);
  assert.match(ro, /context/);
  assert.match(ro, /never planned or edited/);

  const peer = find('peer-impact');
  assert.match(peer, /step 2/i);
  assert.match(peer, /read-only/);
  assert.match(peer, /Behavior Spec requirement/);
  assert.match(peer, /step 3/i);
});

test('[R46-03] every skill the Coordination Playbook names is a real skill folder, and it names nothing else', () => {
  const text = playbook();
  const skills = readdirSync(join(repoRoot, '.github', 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const roles = ['co-changed', 'read-only reference', 'peer-impact'];
  const allowed = new Set([...skills, 'launch', 'workflow-check', ...roles]);

  const tokens = [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim());
  // Skill- or command-shaped tokens: lowercase kebab words, no dots, slashes, or spaces.
  const shaped = tokens.filter((t) => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(t));
  const unknown = [...new Set(shaped.filter((t) => !allowed.has(t)))];
  assert.deepEqual(unknown, [], `names skills or commands that are not folders: ${unknown.join(', ')}`);

  for (const name of ['brain-storm', 'behavior-spec', 'work-planner', 'pull-work']) {
    assert.ok(skills.includes(name), `${name} is not a folder under .github/skills`);
    assert.ok(tokens.includes(name), `playbook does not name \`${name}\``);
  }
});

test('[R46-04] the Update Script installs the Coordination Playbook and onboard-project links it', () => {
  const repo = tempRepo();
  try {
    const home = realpathSync.native(repo.dir);
    const res = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'update-home.mjs'), home], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    const dir = join(home, '.claude', 'skills', 'onboard-project', 'references');
    assert.ok(existsSync(dir), '.claude/skills/onboard-project/references missing');
    assert.ok(readdirSync(dir).includes('COORDINATION-PLAYBOOK.md'), 'COORDINATION-PLAYBOOK.md not installed');
    assert.equal(readText(join(dir, 'COORDINATION-PLAYBOOK.md')), playbook(), 'installed playbook differs from source');

    const link = '[references/COORDINATION-PLAYBOOK.md](./references/COORDINATION-PLAYBOOK.md)';
    assert.ok(readText(join(SKILL_DIR, 'SKILL.md')).includes(link), 'source SKILL.md lacks the playbook link');
    const installedSkill = join(home, '.claude', 'skills', 'onboard-project', 'SKILL.md');
    assert.ok(readText(installedSkill).includes(link), 'installed SKILL.md lacks the playbook link');
  } finally {
    repo.cleanup();
  }
});
