import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseLine } from './logs.mjs';
import { classify } from './records.mjs';
import { segmentUses } from './uses.mjs';

const GRADUATED = /^[\s>*_-]*Status[\s*_]*:[\s*_]*graduated\b/im;
const FINAL = /^[\s>*_-]*Status[\s*_]*:[\s*_]*final\b/im;

function normPath(p, isFolder = false) {
  const s = resolve(p).replace(/\\/g, '/').toLowerCase();
  return isFolder && !s.endsWith('/') ? `${s}/` : s;
}

function listMdFiles(dir, suffix = '.md') {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(suffix))
    .map((e) => e.name);
}

function listSubdirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function collectArtifacts(projectRoot) {
  const out = [];
  for (const name of listMdFiles(join(projectRoot, '.workflow', 'incubations'))) {
    const rel = `.workflow/incubations/${name}`;
    if (GRADUATED.test(readFileSync(join(projectRoot, rel), 'utf8'))) {
      out.push({ writingSkill: 'incubate', usingSkill: 'brain-storm', artifact: rel, isFolder: false });
    }
  }
  for (const name of listMdFiles(join(projectRoot, '.workflow', 'sessions'))) {
    const rel = `.workflow/sessions/${name}`;
    if (FINAL.test(readFileSync(join(projectRoot, rel), 'utf8'))) {
      out.push({ writingSkill: 'brain-storm', usingSkill: 'behavior-spec', artifact: rel, isFolder: false });
    }
  }
  for (const name of listMdFiles(join(projectRoot, '.workflow', 'specs'), '-spec.md')) {
    out.push({ writingSkill: 'behavior-spec', usingSkill: 'work-planner', artifact: `.workflow/specs/${name}`, isFolder: false });
  }
  for (const slug of listSubdirs(join(projectRoot, '.workflow', 'plans'))) {
    out.push({ writingSkill: 'work-planner', usingSkill: 'pull-work', artifact: `.workflow/plans/${slug}/`, isFolder: true });
  }
  return out.map((a) => ({ ...a, target: normPath(join(projectRoot, a.artifact), a.isFolder) }));
}

function matchesArtifact(projectRoot, touchPath, artifact) {
  const normTouch = normPath(resolve(projectRoot, touchPath));
  return artifact.isFolder ? normTouch.startsWith(artifact.target) : normTouch === artifact.target;
}

function compareEnd(a, b) {
  const ta = Date.parse(a.timestamp);
  const tb = Date.parse(b.timestamp);
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb;
  if (a.timestamp !== b.timestamp) return a.timestamp < b.timestamp ? -1 : 1;
  if (a.harness !== b.harness) return a.harness < b.harness ? -1 : 1;
  return a.conversation < b.conversation ? -1 : a.conversation > b.conversation ? 1 : 0;
}

export function findHandoffs({ projectRoot, groups, skill = null }) {
  if (!projectRoot) return [];
  const artifacts = collectArtifacts(projectRoot);
  if (!artifacts.length) return [];

  const uses = [];
  for (const { convs, start } of groups) {
    for (const conv of convs) {
      for (const use of segmentUses(conv, start)) {
        if (use.skill !== 'skill-review') uses.push({ conv, use });
      }
    }
  }

  const entries = [];
  for (const art of artifacts) {
    const writes = [];
    for (const { conv, use } of uses) {
      if (use.skill !== art.writingSkill) continue;
      for (let line = use.start; line <= use.end; line++) {
        const rec = parseLine(conv.lines[line - 1]);
        if (!rec || typeof rec.timestamp !== 'string' || !rec.timestamp) continue;
        const { touches } = classify(rec, conv.harness);
        if (touches.some((t) => t.write && matchesArtifact(projectRoot, t.path, art))) {
          writes.push({
            timestamp: rec.timestamp,
            harness: conv.harness,
            conversation: conv.id,
            file: conv.file,
            line,
          });
        }
      }
    }
    if (!writes.length) continue;
    writes.sort(compareEnd);
    const w = writes[0];
    entries.push({
      id: `${art.writingSkill}:${art.artifact}`,
      writingSkill: art.writingSkill,
      usingSkill: art.usingSkill,
      artifact: art.artifact,
      state: 'pending',
      writtenAt: w.timestamp,
      writing: { harness: w.harness, conversation: w.conversation, file: w.file, line: w.line },
      using: null,
    });
  }

  entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return entries;
}
