import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { repoRoot, tempRepo } from '../../.github/tools/workflow-core/support/harness.mjs';

const SKILL = 'line one\nline two\n';

const SOURCE_FILES = {
  '.github/skills/demo/SKILL.md': SKILL,
  '.github/agents/demo.agent.md': '---\nname: demo\n---\nDemo agent\n',
  '.github/agents/README.md': '# agents readme (never installed)\n',
  '.github/hooks/h.mjs': 'export const hook = 1;\n',
  '.github/tools/t/run.mjs': 'export const run = 1;\n',
  '.github/tools/t/tests/x.test.mjs': "// never installed\n",
  '.github/user-interaction.md': '# user interaction\n',
  'language-addons/stk/ad/SKILL.md': '# add-on skill\n',
  'home/launch.mjs': 'export const launch = 1;\n',
};

const INSTALLED = {
  '.claude/skills/demo/SKILL.md': '.github/skills/demo/SKILL.md',
  '.claude/agents/demo.agent.md': '.github/agents/demo.agent.md',
  '.workflow-core/hooks/h.mjs': '.github/hooks/h.mjs',
  '.workflow-core/tools/t/run.mjs': '.github/tools/t/run.mjs',
  '.workflow-core/user-interaction.md': '.github/user-interaction.md',
  '.workflow-core/language-addons/stk/ad/SKILL.md': 'language-addons/stk/ad/SKILL.md',
  'launch.mjs': 'home/launch.mjs',
};

const AGENTS = '# Home\n\n- Pointer: see notes\n';

function put(root, rel, text) {
  const target = join(root, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

function makeSource(overrides = {}) {
  const src = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfsrc-')));
  const realScript = join(repoRoot, 'scripts', 'update-home.mjs');
  if (existsSync(realScript)) {
    mkdirSync(join(src, 'scripts'), { recursive: true });
    copyFileSync(realScript, join(src, 'scripts', 'update-home.mjs'));
  }
  for (const [rel, text] of Object.entries({ ...SOURCE_FILES, ...overrides })) put(src, rel, text);
  return src;
}

function makeHome() {
  const repo = tempRepo();
  repo.write('AGENTS.md', AGENTS);
  repo.commit('init');
  return { repo, dir: realpathSync.native(repo.dir) };
}

function update(src, home, cwd) {
  const res = spawnSync(process.execPath, [join(src, 'scripts', 'update-home.mjs'), home], {
    cwd: cwd ?? src,
    encoding: 'utf8',
  });
  const out = (res.stdout ?? '').split(/\r?\n/);
  while (out.length && out[out.length - 1] === '') out.pop();
  return { status: res.status, lines: out, stdout: res.stdout ?? '' };
}

function scenario(fn, srcOverrides) {
  const src = makeSource(srcOverrides);
  const { repo, dir } = makeHome();
  const other = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfother-')));
  try {
    fn({ src, home: dir, other });
  } finally {
    repo.cleanup();
    rmSync(src, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  }
}

function version(res) {
  const m = /^Workflow version: (\S+) -> (\S+)$/.exec(res.lines[1] ?? '');
  assert.ok(m, `no version line in: ${res.stdout}`);
  return { old: m[1], next: m[2] };
}

test('[R36-01] update prints the Home Repo, the version change, and the file counts', () => {
  scenario(({ src, home }) => {
    const res = update(src, home);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.lines.length, 3, res.stdout);
    assert.equal(res.lines[0], `Home Repo: ${home}`);
    assert.match(res.lines[1], /^Workflow version: none -> [0-9a-f]{7}$/);
    assert.equal(res.lines[2], 'Files: 7 installed, 0 replaced, 0 removed');
  });
});

test('[R36-02] update installs the mapped files with source content and skips excluded ones', () => {
  scenario(({ src, home }) => {
    const res = update(src, home);
    assert.equal(res.status, 0, res.stdout);
    for (const [homeRel, srcRel] of Object.entries(INSTALLED)) {
      const target = join(home, homeRel);
      assert.ok(existsSync(target), `${homeRel} missing`);
      assert.equal(readFileSync(target, 'utf8'), SOURCE_FILES[srcRel], homeRel);
    }
    assert.equal(existsSync(join(home, '.claude/agents/README.md')), false);
    assert.equal(existsSync(join(home, '.workflow-core/tools/t/tests/x.test.mjs')), false);
  });
});

test('[R36-03] update leaves AGENTS.md identical and creates no CLAUDE.md or .gitignore', () => {
  scenario(({ src, home }) => {
    const before = readFileSync(join(home, 'AGENTS.md'));
    const res = update(src, home);
    assert.equal(res.status, 0, res.stdout);
    assert.ok(readFileSync(join(home, 'AGENTS.md')).equals(before));
    assert.equal(existsSync(join(home, 'CLAUDE.md')), false);
    assert.equal(existsSync(join(home, '.gitignore')), false);
  });
});

test('[R36-04] the printed version is the first 7 hex of the SHA-256 content fingerprint', () => {
  scenario(({ src, home }) => {
    const res = update(src, home);
    assert.equal(res.status, 0, res.stdout);
    const hash = createHash('sha256');
    for (const homeRel of Object.keys(INSTALLED).sort()) {
      const content = SOURCE_FILES[INSTALLED[homeRel]].replace(/\r\n/g, '\n');
      hash.update(Buffer.concat([Buffer.from(homeRel, 'utf8'), Buffer.from([0]), Buffer.from(content, 'utf8'), Buffer.from([0])]));
    }
    const expected = hash.digest('hex').slice(0, 7);
    assert.equal(version(res).next, expected);
  });
});

test('[R36-05] a rerun with the same source reports the same version and no changes', () => {
  scenario(({ src, home }) => {
    const first = update(src, home);
    assert.equal(first.status, 0, first.stdout);
    const v = version(first).next;
    assert.match(v, /^[0-9a-f]{7}$/);
    const second = update(src, home);
    assert.equal(second.status, 0, second.stdout);
    assert.equal(second.lines[1], `Workflow version: ${v} -> ${v}`);
    assert.equal(second.lines[2], 'Files: 0 installed, 0 replaced, 0 removed');
  });
});

test('[R36-06] a changed source file is replaced and changes the version', () => {
  scenario(({ src, home }) => {
    const first = update(src, home);
    assert.equal(first.status, 0, first.stdout);
    const v = version(first).next;
    assert.match(v, /^[0-9a-f]{7}$/);
    put(src, '.github/skills/demo/SKILL.md', 'changed content\n');
    const second = update(src, home);
    assert.equal(second.status, 0, second.stdout);
    const w = version(second);
    assert.equal(w.old, v);
    assert.match(w.next, /^[0-9a-f]{7}$/);
    assert.notEqual(w.next, v);
    assert.equal(second.lines[2], 'Files: 0 installed, 1 replaced, 0 removed');
    assert.equal(readFileSync(join(home, '.claude/skills/demo/SKILL.md'), 'utf8'), 'changed content\n');
  });
});

test('[R36-07] a file the source dropped is deleted and a user file stays', () => {
  scenario(({ src, home }) => {
    const first = update(src, home);
    assert.equal(first.status, 0, first.stdout);
    const mine = '# my own skill\n';
    put(home, '.claude/skills/my-own/SKILL.md', mine);
    rmSync(join(src, '.github/agents/demo.agent.md'));
    const second = update(src, home);
    assert.equal(second.status, 0, second.stdout);
    assert.equal(existsSync(join(home, '.claude/agents/demo.agent.md')), false);
    assert.match(second.lines[2], /^Files: .*, 1 removed$/);
    assert.equal(readFileSync(join(home, '.claude/skills/my-own/SKILL.md'), 'utf8'), mine);
  });
});

test('[R36-08] CRLF and LF sources print the same version', () => {
  const crlf = makeSource({ '.github/skills/demo/SKILL.md': SKILL.replace(/\n/g, '\r\n') });
  const lf = makeSource({ '.github/skills/demo/SKILL.md': SKILL });
  const a = makeHome();
  const b = makeHome();
  try {
    const ra = update(crlf, a.dir);
    const rb = update(lf, b.dir);
    assert.equal(ra.status, 0, ra.stdout);
    assert.equal(rb.status, 0, rb.stdout);
    const va = version(ra).next;
    assert.match(va, /^[0-9a-f]{7}$/);
    assert.equal(va, version(rb).next);
  } finally {
    a.repo.cleanup();
    b.repo.cleanup();
    rmSync(crlf, { recursive: true, force: true });
    rmSync(lf, { recursive: true, force: true });
  }
});

test('[R36-09] the script finds its source itself when run from another working folder', () => {
  scenario(({ src, home, other }) => {
    const res = update(src, home, other);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.lines.length, 3, res.stdout);
    assert.equal(res.lines[0], `Home Repo: ${home}`);
    assert.match(res.lines[1], /^Workflow version: none -> [0-9a-f]{7}$/);
    assert.equal(res.lines[2], 'Files: 7 installed, 0 replaced, 0 removed');
    for (const [homeRel, srcRel] of Object.entries(INSTALLED)) {
      assert.equal(readFileSync(join(home, homeRel), 'utf8'), SOURCE_FILES[srcRel], homeRel);
    }
  });
});
