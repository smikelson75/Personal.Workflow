import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tempRepo } from '../../support/harness.mjs';

const SCRIPT = '.github/skills/pull-work/scripts/parse-args.mjs';
const USAGE = '/pull-work [<slug>] bug: <description>';

function parse(args) {
  const repo = tempRepo();
  try {
    repo.commit('docs(demo): fixture');
    const res = repo.run(SCRIPT, args);
    const errLines = res.stderr.split(/\r?\n/).filter((l) => l.trim() !== '');
    return { ...res, errLines };
  } finally {
    repo.cleanup();
  }
}

test('[R21-01] a slug and a bug description are parsed', () => {
  const res = parse(['workflow-check bug: superseded Sessions get vocabulary warnings']);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(
    res.stdout,
    '{"slug":"workflow-check","bug":"superseded Sessions get vocabulary warnings"}\n',
  );
});

test('[R21-02] the description keeps inner colon and spacing and is trimmed', () => {
  const res = parse(['bug: add a:b  c ']);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout, '{"slug":null,"bug":"add a:b  c"}\n');
});

test('[R21-03] an empty description gives the usage line and exit 2', () => {
  const res = parse(['bug:']);
  assert.equal(res.status, 2);
  assert.deepEqual(res.errLines, [USAGE]);
  assert.equal(res.stdout, '');
});

test('[R21-04] a slug with a blank description gives the usage line and exit 2', () => {
  const res = parse(['workflow-core bug:    ']);
  assert.equal(res.status, 2);
  assert.deepEqual(res.errLines, [USAGE]);
  assert.equal(res.stdout, '');
});

test('[R21-05] a slug alone has no bug', () => {
  const res = parse(['workflow-core']);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout, '{"slug":"workflow-core","bug":null}\n');
});

test('[R21-06] no arguments give a null slug and no bug', () => {
  const res = parse([]);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout, '{"slug":null,"bug":null}\n');
});

test('[R21-07] bug: needs no space before the description', () => {
  const res = parse(['bug:fix it']);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout, '{"slug":null,"bug":"fix it"}\n');
});
