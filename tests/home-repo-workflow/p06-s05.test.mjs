import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { repoRoot, tempRepo } from '../../.github/tools/workflow-core/support/harness.mjs';

const VALID_CODER = '---\nname: coder\ndescription: "x"\nmodel:\n  - Claude Haiku 5.5 (copilot)\nreasoning-effort: low\n---\nCoder body\n';
const VALID_AUTHOR = '---\nname: test-author\ndescription: "x"\nmodel:\n  - Claude Sonnet 5.5 (copilot)\nreasoning-effort: medium\n---\nAuthor body\n';

function put(root, rel, text) {
  const target = join(root, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

// Every agent in the source is valid unless the scenario overrides one file.
function makeSource(overrides = {}) {
  const src = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfsrc-')));
  const realDir = join(repoRoot, 'scripts');
  mkdirSync(join(src, 'scripts'), { recursive: true });
  for (const name of ['update-home.mjs', 'agent-pins.mjs']) {
    if (existsSync(join(realDir, name))) copyFileSync(join(realDir, name), join(src, 'scripts', name));
  }
  const content = {
    '.github/skills/demo/SKILL.md': '# demo skill\n',
    '.github/agents/coder.agent.md': VALID_CODER,
    '.github/agents/test-author.agent.md': VALID_AUTHOR,
    '.github/agents/README.md': '# agents readme\n',
    '.github/hooks/h.mjs': 'export const h = 1;\n',
    '.github/tools/t/run.mjs': 'export const run = 1;\n',
    '.github/user-interaction.md': '# user interaction\n',
    'language-addons/stk/ad/SKILL.md': '# addon\n',
    'home/launch.mjs': 'export const launch = 1;\n',
    ...overrides,
  };
  for (const [rel, text] of Object.entries(content)) put(src, rel, text);
  return src;
}

function makeHome() {
  const repo = tempRepo();
  repo.write('AGENTS.md', '# Home\n');
  repo.commit('home');
  return { repo, dir: realpathSync.native(repo.dir) };
}

function update(src, home) {
  const res = spawnSync(process.execPath, [join(src, 'scripts', 'update-home.mjs'), home], {
    cwd: home,
    encoding: 'utf8',
  });
  return { status: res.status, stdout: res.stdout ?? '' };
}

function outLines(res) {
  return res.stdout.split(/\r?\n/).filter((l) => l.length > 0);
}

// All files outside .git with content, plus the manifest and exclude file under .git.
function snapshot(dir) {
  const out = {};
  const walk = (abs, rel) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (rel === '' && entry.name === '.git') continue;
      const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        out[`${childRel}/`] = 'dir';
        walk(join(abs, entry.name), childRel);
      } else {
        out[childRel] = readFileSync(join(abs, entry.name)).toString('base64');
      }
    }
  };
  walk(dir, '');
  const git = join(dir, '.git');
  out['.git/personal-workflow'] = existsSync(join(git, 'personal-workflow'));
  for (const rel of ['personal-workflow/manifest.json', 'info/exclude']) {
    const p = join(git, rel);
    out[`.git/${rel}`] = existsSync(p) ? readFileSync(p).toString('base64') : null;
  }
  return out;
}

function porcelain(dir) {
  return spawnSync('git', ['-C', dir, 'status', '--porcelain'], { encoding: 'utf8' }).stdout;
}

function assertInvalid(res, name) {
  assert.equal(res.status, 1, res.stdout);
  assert.deepEqual(outLines(res), [`update failed: invalid-agent: .github/agents/${name}.agent.md`]);
}

function scenario(fn, overrides) {
  const src = makeSource(overrides);
  const { repo, dir } = makeHome();
  try {
    fn({ src, home: dir, repo });
  } finally {
    repo.cleanup();
    rmSync(src, { recursive: true, force: true });
  }
}

test('[R48-11] a frontmatter line that is not YAML prints invalid-agent naming the file and adds nothing', () => {
  scenario(
    ({ src, home }) => {
      const before = snapshot(home);
      const status = porcelain(home);
      assertInvalid(update(src, home), 'test-author');
      assert.deepEqual(snapshot(home), before);
      assert.equal(porcelain(home), status);
      assert.equal(existsSync(join(home, '.claude')), false);
      assert.equal(existsSync(join(home, '.workflow-core')), false);
      assert.equal(existsSync(join(home, '.github')), false);
      assert.equal(existsSync(join(home, 'launch.mjs')), false);
    },
    { '.github/agents/test-author.agent.md': '---\nname: test-author\nthis line is not yaml\n---\nAuthor body\n' },
  );
});

test('[R48-12] an agent file with no frontmatter prints invalid-agent naming that file', () => {
  scenario(
    ({ src, home }) => {
      const before = snapshot(home);
      assertInvalid(update(src, home), 'coder');
      assert.deepEqual(snapshot(home), before);
      assert.equal(existsSync(join(home, '.claude')), false);
      assert.equal(existsSync(join(home, '.workflow-core')), false);
    },
    { '.github/agents/coder.agent.md': '# demo agent\n' },
  );
});

test('[R48-13] an agent whose frontmatter has no closing --- prints invalid-agent naming that file', () => {
  scenario(
    ({ src, home }) => {
      const before = snapshot(home);
      assertInvalid(update(src, home), 'test-author');
      assert.deepEqual(snapshot(home), before);
      assert.equal(existsSync(join(home, '.claude')), false);
      assert.equal(existsSync(join(home, '.workflow-core')), false);
    },
    { '.github/agents/test-author.agent.md': '---\nname: test-author\ndescription: "x"\nAuthor body\n' },
  );
});

test('[R48-14] a source agent edited to be unparsable fails invalid-agent and leaves every installed file and the manifest unchanged', () => {
  scenario(({ src, home }) => {
    const first = update(src, home);
    assert.equal(first.status, 0, first.stdout);
    const before = snapshot(home);
    assert.ok(before['.git/personal-workflow/manifest.json'], 'manifest must exist after the first run');
    const status = porcelain(home);

    put(src, '.github/agents/coder.agent.md', '---\nname: coder\nthis line is not yaml\n---\nCoder body\n');
    assertInvalid(update(src, home), 'coder');
    assert.deepEqual(snapshot(home), before);
    assert.equal(porcelain(home), status);
  });
});

test('[R48-15] an unparsable agent plus a committed installed-file path fails invalid-agent, not tracked-workflow-files', () => {
  scenario(
    ({ src, home, repo }) => {
      repo.write('.claude/skills/demo/SKILL.md', '# mine\n');
      repo.commit('tracked');
      const before = snapshot(home);
      const status = porcelain(home);
      assertInvalid(update(src, home), 'test-author');
      assert.deepEqual(snapshot(home), before);
      assert.equal(porcelain(home), status);
      assert.equal(existsSync(join(home, '.workflow-core')), false);
    },
    { '.github/agents/test-author.agent.md': '---\nname: test-author\nthis line is not yaml\n---\nAuthor body\n' },
  );
});
