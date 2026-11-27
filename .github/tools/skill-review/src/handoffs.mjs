import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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

// Touches of `art` inside uses of `skill`: write true for writes, false for reads.
function touchesIn({ projectRoot, uses, skill, art, write }) {
  const found = [];
  for (const { conv, use } of uses) {
    if (use.skill !== skill) continue;
    for (let line = use.start; line <= use.end; line++) {
      const rec = parseLine(conv.lines[line - 1]);
      if (!rec || typeof rec.timestamp !== 'string' || !rec.timestamp) continue;
      const { touches } = classify(rec, conv.harness);
      if (touches.some((t) => Boolean(t.write) === write && matchesArtifact(projectRoot, t.path, art))) {
        found.push({
          timestamp: rec.timestamp,
          harness: conv.harness,
          conversation: conv.id,
          file: conv.file,
          line,
        });
      }
    }
  }
  return found;
}

// Files whose bytes and sections make up the artifact: the file itself, or the .md files directly inside a folder.
function artifactFiles(projectRoot, art) {
  const abs = join(projectRoot, art.artifact);
  if (!art.isFolder) return [abs];
  return listMdFiles(abs).map((name) => join(abs, name));
}

function artifactSize(projectRoot, art) {
  let bytes = 0;
  let sections = 0;
  for (const file of artifactFiles(projectRoot, art)) {
    bytes += statSync(file).size;
    sections += (readFileSync(file, 'utf8').match(/^## /gm) ?? []).length;
  }
  return { bytes, sections };
}

// Commits touching the artifact whose committer date is after writtenAt; 0 when git fails.
function revisionsAfter(projectRoot, artifact, writtenAt) {
  const res = spawnSync('git', ['log', '--format=%cI', '--', artifact], { cwd: projectRoot, encoding: 'utf8' });
  if (res.status !== 0) return 0;
  const written = Date.parse(writtenAt);
  return res.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && Date.parse(l) > written).length;
}

// Read touches of the artifact inside the using use (the use holding using.line); 0 when there is no using.
function readsInUse({ projectRoot, uses, art, using }) {
  if (!using) return 0;
  const hit = uses.find(
    ({ conv, use }) =>
      conv.harness === using.harness && conv.id === using.conversation && use.start <= using.line && using.line <= use.end,
  );
  if (!hit) return 0;
  let n = 0;
  for (let line = hit.use.start; line <= hit.use.end; line++) {
    const rec = parseLine(hit.conv.lines[line - 1]);
    if (!rec || typeof rec.timestamp !== 'string' || !rec.timestamp) continue;
    const { touches } = classify(rec, hit.conv.harness);
    if (touches.some((t) => !t.write && matchesArtifact(projectRoot, t.path, art))) n++;
  }
  return n;
}

export function findHandoffs({ projectRoot, groups, skill = null, handoffs = [] }) {
  if (!projectRoot) return [];
  const artifacts = collectArtifacts(projectRoot);
  if (!artifacts.length) return [];

  const reviewed = new Set((handoffs ?? []).filter((h) => h?.state === 'reviewed').map((h) => h.id));

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
    const id = `${art.writingSkill}:${art.artifact}`;
    if (reviewed.has(id)) continue;
    if (skill !== null && art.writingSkill !== skill && art.usingSkill !== skill) continue;

    const writes = touchesIn({ projectRoot, uses, skill: art.writingSkill, art, write: true });
    if (!writes.length) continue;
    writes.sort(compareEnd);
    const w = writes[0];

    const writtenMs = Date.parse(w.timestamp);
    const reads = touchesIn({ projectRoot, uses, skill: art.usingSkill, art, write: false })
      .filter((r) => Date.parse(r.timestamp) > writtenMs);
    reads.sort(compareEnd);
    const r = reads[0];

    const using = r ? { harness: r.harness, conversation: r.conversation, file: r.file, line: r.line } : null;
    const { bytes, sections } = artifactSize(projectRoot, art);
    const revisionsAfterWrite = revisionsAfter(projectRoot, art.artifact, w.timestamp);
    const inUse = readsInUse({ projectRoot, uses, art, using });
    const flags = [];
    if (revisionsAfterWrite >= 1) flags.push({ kind: 'artifact-revised' });
    if (inUse >= 3) flags.push({ kind: 'artifact-reread' });

    entries.push({
      id,
      writingSkill: art.writingSkill,
      usingSkill: art.usingSkill,
      artifact: art.artifact,
      state: 'pending',
      writtenAt: w.timestamp,
      writing: { harness: w.harness, conversation: w.conversation, file: w.file, line: w.line },
      using,
      signals: { bytes, sections, revisionsAfterWrite, readsInUse: inUse },
      flags,
    });
  }

  entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return entries;
}
