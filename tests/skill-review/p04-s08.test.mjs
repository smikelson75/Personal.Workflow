import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { repoRoot } from '../../.github/tools/workflow-core/support/harness.mjs';

const CLI = join(repoRoot, '.github', 'tools', 'skill-review', 'bin', 'skill-review.mjs');
const TOOL_DIR = join(repoRoot, '.github', 'tools', 'skill-review');
const PRELOAD = join(repoRoot, 'tests', 'skill-review', 'fixtures', 'block-network.mjs');

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, `git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout.trim();
}

function put(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function observation(id, fields) {
  return {
    id,
    part: 'pull-work',
    state: 'confirmed',
    kind: 'rule adherence',
    label: null,
    side: null,
    area: null,
    outcome: 'part change',
    cause: null,
    model: null,
    fixType: 'clarified rule',
    fixReason: 'A check cannot find this.',
    description: 'The skill asked the same question twice.',
    cases: 2,
    chances: 0,
    changeCommit: null,
    follows: null,
    ...fields,
  };
}

function makeFixture() {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'sr-p04s08-')));
  const home = join(root, 'home');
  const proj = join(root, 'proj');
  const copilot = join(root, 'copilot');
  const claude = join(root, 'claude');
  for (const dir of [home, proj]) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'core.autocrlf', 'false');
  }
  for (const skill of ['pull-work', 'brain-storm', 'skill-review']) {
    put(join(home, '.claude', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  mkdirSync(claude, { recursive: true });
  const commit = (file, text) => {
    put(join(proj, file), text);
    git(proj, 'add', '-A');
    git(proj, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', file);
    return git(proj, 'rev-parse', '--short=7', 'HEAD');
  };
  const c1 = commit('one.txt', 'one\n');
  const c2 = commit('two.txt', 'two\n');
  assert.notEqual(c1, c2);

  const rows = [
    ['session.start', { sessionId: 'c1', context: { cwd: proj } }],
    ['skill.invoked', { name: 'pull-work' }],
    ['user.message', { content: 'go' }],
    ['assistant.message', { content: 'x'.repeat(4001) }],
    ['tool.execution_start', { toolName: 'ask_user' }],
    ['tool.execution_complete', { success: false }],
    ['user.message', { content: 'no, stop that' }],
    ['assistant.message', { content: 'ok' }],
  ];
  put(
    join(copilot, 'session-state', 'c1', 'events.jsonl'),
    rows
      .map(([type, data], i) => JSON.stringify({ type, data, id: `e${i + 1}`, timestamp: '2026-11-01T00:00:00Z', parentId: null }))
      .join('\n') + '\n',
  );

  const record = {
    format: 1,
    conversations: {},
    handoffs: [],
    observations: [observation('O03', {})],
    installs: [],
    nextObservation: 5,
  };
  put(join(home, 'skill-review', 'review-record.json'), JSON.stringify(record, null, 2) + '\n');
  git(home, 'add', '-A');
  git(home, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');

  const marker = join(root, 'network-marker.txt');
  const nodeOptions = `--import ${pathToFileURL(PRELOAD).href}`;
  const exec = (args) => {
    const env = {
      ...process.env,
      WORKFLOW_HOME: home,
      SKILL_REVIEW_NOW: '2026-11-26T14:05:00',
      SKILL_REVIEW_COPILOT_HOME: copilot,
      SKILL_REVIEW_CLAUDE_HOME: claude,
      SKILL_REVIEW_BLOCK_MARKER: marker,
      NODE_OPTIONS: nodeOptions,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    };
    const res = spawnSync(process.execPath, [CLI, ...args], { cwd: proj, encoding: 'utf8', env });
    return { status: res.status, stdout: res.stdout + res.stderr };
  };
  return {
    root, home, proj, c1, c2, marker, exec,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

test('[Q-offline] every command completes with all network access blocked', () => {
  const fx = makeFixture();
  try {
    const compact = join(fx.root, 'out', 'compact.json');
    const judgement = join(fx.root, 'judgement.json');
    put(judgement, JSON.stringify({ cases: [] }));
    const steps = [
      ['prepare', ['prepare', '--out', compact]],
      ['slice', ['slice', compact, 'c1', '4']],
      ['finish', ['finish', compact, judgement]],
      ['mark-changed', ['mark-changed', 'O03', fx.c1]],
      ['record-install', ['record-install', '1a2b3c4', fx.c2]],
      ['commit', ['commit', compact]],
    ];
    for (const [name, args] of steps) {
      const res = fx.exec(args);
      assert.equal(res.status, 0, `${name}: ${res.stdout}`);
      assert.ok(!existsSync(fx.marker), `${name}: network marker exists: ${existsSync(fx.marker) ? readFileSync(fx.marker, 'utf8') : ''}`);
    }
  } finally {
    fx.cleanup();
  }
});

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

test('[R63-05] no skill-review file imports a network module or calls fetch', () => {
  const files = listFiles(TOOL_DIR);
  assert.ok(files.length > 0, 'skill-review files exist');
  const importRe = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"](?:node:)?(?:http|https|net|tls|dns|dgram)(?:\/[\w]+)?['"]/;
  const fetchRe = /\bfetch\s*\(/;
  const offenders = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (importRe.test(text)) offenders.push(`${file}: network import`);
    if (fetchRe.test(text)) offenders.push(`${file}: fetch(`);
  }
  assert.deepEqual(offenders, []);
});
