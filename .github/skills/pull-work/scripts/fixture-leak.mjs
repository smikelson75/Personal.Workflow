// Flags string literals from a card's acceptance tests that reappear verbatim in
// the product files it changed but not in the spec: the signature of code
// special-cased to pass a test. Exit 1 when any are found, 0 otherwise.
// Usage: node fixture-leak.mjs --spec <spec.md> --tests <paths...> --src <paths...>
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const MIN_LENGTH = 8;
const CODE_EXT = /^\.(c|cc|cpp|cs|go|java|js|jsx|kt|mjs|cjs|php|ps1|py|rb|rs|swift|ts|tsx)$/i;

function parseArgs(argv) {
  const out = { spec: [], tests: [], src: [] };
  let key = null;
  for (const a of argv) {
    if (a.startsWith('--')) key = a.slice(2);
    else if (key in out) out[key].push(a);
  }
  return out;
}

function files(paths) {
  const result = [];
  const walk = (p) => {
    if (!existsSync(p)) return;
    if (statSync(p).isDirectory()) readdirSync(p).forEach((n) => walk(join(p, n)));
    else result.push(p);
  };
  paths.forEach(walk);
  return result;
}

const IMPORT_LINE = /^\s*(import|export\s.*\sfrom|using|#include|from\s\S+\simport)\b|\brequire\(/;

function literals(path) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const found = new Set();
  if (CODE_EXT.test(extname(path))) {
    for (const line of lines) {
      if (IMPORT_LINE.test(line)) continue;
      for (const m of line.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) found.add(m[2]);
    }
  } else {
    for (const line of lines) found.add(line.trim());
  }
  return [...found].filter((s) => s.trim().length >= MIN_LENGTH && !s.includes('${'));
}

const args = parseArgs(process.argv.slice(2));
const spec = files(args.spec).map((f) => readFileSync(f, 'utf8')).join('\n');
const candidates = new Set(files(args.tests).flatMap(literals).filter((s) => !spec.includes(s)));

let hits = 0;
for (const src of files(args.src)) {
  readFileSync(src, 'utf8').split(/\r?\n/).forEach((line, i) => {
    for (const lit of candidates) {
      if (line.includes(lit)) {
        hits += 1;
        console.log(`${src.split('\\').join('/')}:${i + 1}: test literal ${JSON.stringify(lit)}`);
      }
    }
  });
}
console.log(`fixture-leak: ${hits} hits`);
process.exit(hits ? 1 : 0);
