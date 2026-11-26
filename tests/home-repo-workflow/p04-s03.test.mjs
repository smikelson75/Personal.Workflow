import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { files, repoRoot, tempRepo } from '../../.github/tools/workflow-core/support/harness.mjs';

const SPEC = '# demo spec\n\n- R1: the demo works\n';
const PLAN = '# demo plan\n\n- Spec: [demo-spec.md](../../specs/demo-spec.md)\n- Next: phase review P01\n';

// Workflow Core path in a skill or agent -> where the Core path rule points inside the Home Repo.
function mapCorePath(path) {
  if (path === '.github/user-interaction.md') return '.workflow-core/user-interaction.md';
  const m = /^\.github\/(skills|agents|tools|hooks)\/(.+)$/.exec(path);
  if (!m) return null;
  const base = { skills: '.claude/skills', agents: '.claude/agents', tools: '.workflow-core/tools', hooks: '.workflow-core/hooks' }[m[1]];
  return `${base}/${m[2]}`;
}

function corePathsIn(text) {
  const found = new Set();
  const re = /\.github\/(?:(?:skills|agents|tools|hooks)\/[^\s`'"<>()[\]|,;*]*\.[A-Za-z0-9]+|user-interaction\.md)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (text[m.index + m[0].length] === '<') continue;
    found.add(m[0]);
  }
  return found;
}

function homeRepo() {
  const repo = tempRepo();
  repo.write('AGENTS.md', '# Home\n\n- Pointer: see notes\n');
  repo.commit('init');
  const dir = realpathSync.native(repo.dir);
  const res = spawnSync(process.execPath, ['scripts/update-home.mjs', dir], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(res.status, 0, `${res.stdout}${res.stderr}`);
  repo.commit('install workflow');
  return { repo, dir };
}

function projectRepo() {
  const repo = tempRepo();
  repo.write('.workflow/language.md', readFileSync(join(repoRoot, '.workflow', 'language.md'), 'utf8'));
  repo.write('.workflow/specs/demo-spec.md', SPEC);
  repo.write('.workflow/plans/demo/plan.md', PLAN);
  repo.write(
    '.workflow/sessions/context-2026-11-20-1124.md',
    readFileSync(join(repoRoot, '.workflow', 'sessions', 'context-2026-11-20-1124.md'), 'utf8'),
  );
  repo.commit('project');
  return repo;
}

function status(dir) {
  const res = spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  return res.stdout;
}

function node(args, cwd) {
  const res = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

test('[R42-04] every Workflow Core path a skill or agent names exists in the Home Repo where the Core path rule maps it', () => {
  const home = homeRepo();
  try {
    const sources = [
      ...files('.github/skills'),
      ...files('.github/agents').filter((f) => f.endsWith('.agent.md')),
    ];
    assert.ok(sources.length > 0, 'no skill or agent files found');
    const missing = [];
    let checked = 0;
    for (const source of sources) {
      const text = readFileSync(join(repoRoot, source), 'utf8');
      for (const path of corePathsIn(text)) {
        const mapped = mapCorePath(path);
        assert.ok(mapped, `unmappable ${path}`);
        checked += 1;
        if (!existsSync(join(home.dir, mapped))) missing.push(`${source}: ${path} -> ${mapped}`);
      }
    }
    assert.ok(checked > 0, 'no Workflow Core paths were found');
    assert.deepEqual(missing, []);
  } finally {
    home.repo.cleanup();
  }
});

test('[R42-05] helpers run from the Home Repo operate on the Project Repo only and write nothing', () => {
  const home = homeRepo();
  const project = projectRepo();
  try {
    const projectDir = realpathSync.native(project.dir);
    assert.equal(status(home.dir), '');
    const projectBefore = status(projectDir);
    assert.equal(projectBefore, '');

    const glossary = node([join(home.dir, '.claude/skills/pull-work/scripts/glossary-check.mjs')], projectDir);
    assert.equal(glossary.status, 0, glossary.stderr);
    assert.equal(glossary.stdout, '');
    assert.equal(glossary.stderr, '');

    const reconcile = node([join(home.dir, '.claude/skills/pull-work/scripts/reconcile-check.mjs'), 'candidates'], projectDir);
    assert.equal(reconcile.status, 0, reconcile.stderr);
    assert.equal(reconcile.stdout, 'demo\topen\n');

    const check = node([join(home.dir, '.workflow-core/tools/workflow-check/bin/workflow-check.mjs')], projectDir);
    assert.equal(check.status, 0, `${check.stdout}${check.stderr}`);
    assert.equal(check.stderr, '');
    const lines = check.stdout.split('\n').filter((l) => l !== '');
    assert.match(lines[lines.length - 1], /^workflow-check: 0 errors, \d+ warnings$/);
    const findings = lines.slice(0, -1);
    assert.ok(findings.length > 0, 'expected Findings from the Project Repo Session');
    for (const line of findings) {
      assert.match(line, /^\.workflow\/(?:sessions\/[^:]+|language)\.md:\d+: /, line);
    }

    assert.equal(status(home.dir), '');
    assert.equal(status(projectDir), projectBefore);
    assert.equal(existsSync(join(home.dir, '.workflow')), false);
  } finally {
    home.repo.cleanup();
    project.cleanup();
  }
});
