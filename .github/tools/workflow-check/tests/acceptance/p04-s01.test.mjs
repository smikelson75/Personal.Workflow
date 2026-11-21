import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanFolder } from '../support/fixtures.mjs';

const TOOL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = join(TOOL_ROOT, 'bin', 'workflow-check.mjs');

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

test('[R10-02] a run on a valid Workflow Folder exits 0 on its own while stdin is never written or closed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfcheck-stdin-'));
  for (const [rel, content] of Object.entries(cleanFolder())) {
    const target = join(dir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  const child = spawn(process.execPath, [CLI], { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (d) => { stdout += d; });
  child.stdin.on('error', () => {});
  const outcome = await new Promise((resolveOutcome) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolveOutcome({ timedOut: true });
    }, 5000);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveOutcome({ timedOut: false, code });
    });
  });
  assert.equal(outcome.timedOut, false, 'process did not exit within 5 seconds');
  assert.equal(outcome.code, 0);
  assert.equal(stdout, 'workflow-check: 0 errors, 0 warnings\n');
});

test('[R10-03] bin and src files import no network, process, or readline module and never touch stdin or fetch', () => {
  const files = [...listFiles(join(TOOL_ROOT, 'bin')), ...listFiles(join(TOOL_ROOT, 'src'))];
  assert.ok(files.length > 0, 'no source files found');
  const banned = ['net', 'http', 'https', 'http2', 'tls', 'dgram', 'dns', 'child_process', 'readline'];
  const moduleRe = new RegExp(`['"\`](?:node:)?(?:${banned.join('|')})(?:/[\\w/]*)?['"\`]`);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      const where = `${file}:${i + 1}`;
      const importsModule =
        (/\bimport\b|\brequire\s*\(|\bfrom\b/.test(line) && moduleRe.test(line));
      assert.ok(!importsModule, `${where} imports a banned module: ${line.trim()}`);
      assert.ok(!/process\s*\.\s*stdin/.test(line), `${where} references process.stdin`);
      assert.ok(!/\bfetch\s*\(/.test(line), `${where} calls fetch(`);
    });
    assert.ok(!/node:(net|http|https|http2|tls|dgram|dns|child_process|readline)\b/.test(text), `${file} mentions a banned node: module`);
  }
});
