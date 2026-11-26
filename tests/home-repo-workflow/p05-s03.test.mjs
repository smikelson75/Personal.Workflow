import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { repoRoot, tempRepo } from '../../.github/tools/workflow-core/support/harness.mjs';

const WIN = process.platform === 'win32';
const SKIP_WIN = WIN ? false : 'needs Windows .cmd stubs';

const SCAFFOLD = '.github/skills/addon-author/scripts/scaffold.mjs';
const SQL_ARGS = ['--id', 'sql-schema', '--code-style', 'sqlfluff|sqlfluff lint .'];
const NA_ROW = (role) => `| ${role} | not applicable: not used by this stack | none |`;

function put(root, rel, text) {
  const target = join(root, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout;
}

// Temp source: copy of the real source folders (no tests, no .git), committed.
function makeSource() {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfsrc-')));
  for (const folder of ['.github', 'language-addons', 'home', 'scripts']) {
    cpSync(join(repoRoot, folder), join(dir, folder), {
      recursive: true,
      filter: (src) => {
        const parts = relative(repoRoot, src).split(sep);
        return !parts.includes('tests') && !parts.includes('.git') && !parts.includes('node_modules');
      },
    });
  }
  git(dir, 'init', '-b', 'main');
  git(dir, 'config', 'core.autocrlf', 'false');
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init');
  return dir;
}

function withSource(fn) {
  const dir = makeSource();
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function scaffold(cwd, args) {
  const res = spawnSync(process.execPath, [join(cwd, SCAFFOLD), ...args], { cwd, encoding: 'utf8' });
  const lines = (res.stdout ?? '').split(/\r?\n/);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '', lines };
}

function snapshot(root) {
  const out = {};
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === '.git') continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        out[relative(root, full) + '/'] = '';
        walk(full);
      } else {
        out[relative(root, full)] = readFileSync(full).toString('base64');
      }
    }
  };
  walk(root);
  return out;
}

const read = (root, rel) => readFileSync(join(root, rel), 'utf8');
const splitLines = (text) => text.split(/\r?\n/);

function assertFailure(res, status, line) {
  assert.equal(res.status, status, res.stdout + res.stderr);
  assert.deepEqual(res.lines, [line], res.stdout);
}

test('[R45-01] a code-style-only add-on writes one skill folder with name and Gate line', () => {
  withSource((dir) => {
    const res = scaffold(dir, SQL_ARGS);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const skill = 'language-addons/sql-schema/sqlfluff-sql-schema/SKILL.md';
    assert.ok(existsSync(join(dir, skill)), `${skill} missing`);
    const lines = splitLines(read(dir, skill));
    assert.ok(lines.includes('name: sqlfluff-sql-schema'), 'frontmatter name line missing');
    assert.ok(
      lines.some((l) => l.startsWith('Gate:') && l.includes('sqlfluff lint .')),
      'Gate line missing',
    );
    assert.deepEqual(readdirSync(join(dir, 'language-addons', 'sql-schema')), ['sqlfluff-sql-schema']);
  });
});

test('[R45-02] README lists the new stack with a skill row and two not-applicable rows', () => {
  withSource((dir) => {
    const res = scaffold(dir, SQL_ARGS);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const lines = splitLines(read(dir, 'language-addons/README.md'));
    const available = lines.indexOf('## Available Stacks');
    const heading = lines.indexOf('### sql-schema (`language-addons/sql-schema/`)');
    const next = lines.findIndex((l, i) => i > available && l.startsWith('## '));
    assert.ok(available >= 0, 'Available Stacks heading missing');
    assert.ok(heading > available, 'stack heading not under Available Stacks');
    assert.ok(next < 0 || heading < next, 'stack heading is outside the Available Stacks section');
    let i = heading + 1;
    while (lines[i] === '') i++;
    assert.equal(lines[i], '| Skill | Purpose | Key Outputs in Target Repo |');
    assert.equal(lines[i + 1], '| --- | --- | --- |');
    const rows = [];
    for (let j = i + 2; j < lines.length && lines[j].startsWith('|'); j++) rows.push(lines[j]);
    assert.equal(rows.length, 3, rows.join('\n'));
    assert.ok(
      rows.some((r) => r.includes('[sqlfluff-sql-schema](./sql-schema/sqlfluff-sql-schema/SKILL.md)')),
      rows.join('\n'),
    );
    assert.ok(rows.includes(NA_ROW('test harness')), rows.join('\n'));
    assert.ok(rows.includes(NA_ROW('mutation testing')), rows.join('\n'));
  });
});

test('[R45-03] three roles write three folders and the mutation skill is found by mutation-addon', () => {
  withSource((dir) => {
    const res = scaffold(dir, [
      '--id', 'fake-stack',
      '--code-style', 'lintx|lintx .',
      '--test-harness', 'testx|testx run',
      '--mutation', 'mutx|mutx run --since <phase-base>',
    ]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const addon = join(dir, 'language-addons', 'fake-stack');
    assert.deepEqual(readdirSync(addon).sort(), ['lintx-fake-stack', 'mutx-fake-stack', 'testx-fake-stack']);
    const mutation = splitLines(read(dir, 'language-addons/fake-stack/mutx-fake-stack/SKILL.md'));
    assert.ok(mutation.includes('- **Mutation stack:** fake-stack'), mutation.join('\n'));
    assert.ok(mutation.includes('- **Mutation command:** mutx run --since <phase-base>'), mutation.join('\n'));
    assert.ok(mutation.join('\n').includes('../mutation-testing/protocol.md'), 'protocol link missing');

    cpSync(addon, join(dir, '.github', 'skills'), { recursive: true });
    const found = spawnSync(
      process.execPath,
      [join(dir, '.github/skills/work-planner/scripts/mutation-addon.mjs'), 'fake-stack'],
      { cwd: dir, encoding: 'utf8' },
    );
    assert.equal(found.status, 0, found.stdout + found.stderr);
    assert.equal(found.stdout.trim(), 'mutation: mutx run --since <phase-base>');
  });
});

function makeBin() {
  const bin = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfbin-')));
  put(
    bin,
    'stub.mjs',
    [
      "import { writeFileSync } from 'node:fs';",
      'writeFileSync(process.env.WF_STUB_OUT, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));',
      'process.exit(0);',
      '',
    ].join('\n'),
  );
  put(bin, 'claude.cmd', '@node "%~dp0stub.mjs" %*\r\n');
  return bin;
}

test('[R45-04] the Update Script installs the new add-on and the Launch Script loads it', { skip: SKIP_WIN }, () => {
  withSource((dir) => {
    const res = scaffold(dir, SQL_ARGS);
    assert.equal(res.status, 0, res.stdout + res.stderr);

    const homeRepo = tempRepo();
    const home = realpathSync.native(homeRepo.dir);
    const bin = makeBin();
    const project = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfproj-')));
    try {
      homeRepo.write('AGENTS.md', '# Home\n');
      homeRepo.commit('init');
      const upd = spawnSync(process.execPath, [join(dir, 'scripts', 'update-home.mjs'), home], {
        cwd: dir,
        encoding: 'utf8',
      });
      assert.equal(upd.status, 0, (upd.stdout ?? '') + (upd.stderr ?? ''));

      put(project, 'AGENTS.md', '# Project\n\n- Stack: sql-schema\n');
      const outFile = join(bin, 'out.json');
      const env = { ...process.env, WF_STUB_OUT: outFile };
      const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
      env[key] = `${bin};${env[key] ?? ''}`;
      const run = spawnSync(process.execPath, [join(home, 'launch.mjs'), 'claude'], {
        cwd: project,
        env,
        encoding: 'utf8',
      });
      assert.equal(run.status, 0, (run.stdout ?? '') + (run.stderr ?? ''));
      assert.ok(
        splitLines(run.stdout ?? '').includes('Language Add-on: sql-schema (sqlfluff-sql-schema)'),
        run.stdout,
      );
      assert.ok(existsSync(outFile), 'claude stub did not run');
    } finally {
      homeRepo.cleanup();
      rmSync(bin, { recursive: true, force: true });
      rmSync(project, { recursive: true, force: true });
    }
  });
});

const NOT_SOURCE =
  'addon-author failed: not-a-workflow-source: run it in a Personal.Workflow source (Workflow Core plus language-addons/)';

test('[R45-05] a cwd without the source markers fails with not-a-workflow-source and writes nothing', () => {
  for (const missing of ['.github/skills/pull-work/SKILL.md', 'language-addons/README.md']) {
    withSource((dir) => {
      const script = join(dir, SCAFFOLD);
      // Run the script from a copy-safe location: keep the script, remove the marker under test.
      rmSync(join(dir, missing));
      const before = snapshot(dir);
      const res = spawnSync(process.execPath, [script, ...SQL_ARGS], { cwd: dir, encoding: 'utf8' });
      const lines = (res.stdout ?? '').split(/\r?\n/).filter((l, i, a) => !(l === '' && i === a.length - 1));
      assert.equal(res.status, 1, `${missing}: ${res.stdout}${res.stderr}`);
      assert.deepEqual(lines, [NOT_SOURCE], missing);
      assert.deepEqual(snapshot(dir), before, `${missing}: files changed`);
    });
  }
});

test('[R45-06] an existing stack folder fails with addon-exists and changes no file', () => {
  withSource((dir) => {
    const before = snapshot(dir);
    const res = scaffold(dir, ['--id', 'csharp', '--code-style', 'x|y']);
    assertFailure(res, 1, 'addon-author failed: addon-exists: language-addons/csharp/');
    assert.deepEqual(snapshot(dir), before);
    assert.equal(git(dir, 'status', '--porcelain').trim(), '');
  });
});

test('[R45-07] a non-kebab-case id fails with invalid-id and writes nothing', () => {
  withSource((dir) => {
    const before = snapshot(dir);
    const res = scaffold(dir, ['--id', 'Sql_Schema', '--code-style', 'sqlfluff|sqlfluff lint .']);
    assertFailure(res, 2, 'addon-author failed: invalid-id: Sql_Schema is not kebab-case');
    assert.deepEqual(snapshot(dir), before);
    assert.equal(git(dir, 'status', '--porcelain').trim(), '');
  });
});

test('[R45-08] no role flag fails with no-roles and writes nothing', () => {
  withSource((dir) => {
    const before = snapshot(dir);
    const res = scaffold(dir, ['--id', 'sql-schema']);
    assertFailure(
      res,
      2,
      'addon-author failed: no-roles: give at least one of --code-style, --test-harness, --mutation',
    );
    assert.deepEqual(snapshot(dir), before);
    assert.equal(git(dir, 'status', '--porcelain').trim(), '');
  });
});

test('[R45-09] only the new folder and the README change, and other README lines are unchanged', () => {
  withSource((dir) => {
    const originalLines = splitLines(read(dir, 'language-addons/README.md'));
    const res = scaffold(dir, SQL_ARGS);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const status = git(dir, 'status', '--porcelain')
      .split(/\r?\n/)
      .filter(Boolean)
      .sort();
    assert.deepEqual(status, [' M language-addons/README.md', '?? language-addons/sql-schema/']);

    const lines = splitLines(read(dir, 'language-addons/README.md'));
    const heading = lines.indexOf('### sql-schema (`language-addons/sql-schema/`)');
    assert.ok(heading >= 0, 'new section missing');
    let end = heading + 1;
    while (end < lines.length && (lines[end] === '' || lines[end].startsWith('|'))) end++;
    const rest = [...lines.slice(0, heading), ...lines.slice(end)];
    const nonBlank = (arr) => arr.filter((l) => l !== '');
    assert.deepEqual(nonBlank(rest), nonBlank(originalLines));
  });
});
