# Session Review

## Problem

- Workflow skill reviews are done by hand, one skill at a time, in documents that grow without bound and ar hard to read.
- Desired outcome: a formal, cleaner, more efficient review that uses how skills were actually used in past sessions to drive continuous improvement of the workflow and its skills, and says on which side each improvement belongs.

## Users
- `Developer` - Reads the per-skill Executive Summary to decide what to improve.
- the agent that edits workflow skills - uses prior review records to make evidence-based changes.

## Workflow

- trigger: open (Q4 owned)
- key step: a review of one skill's session judges whether the skill did what it was intended to do, efficiently, with valuable outcomes, through the four lenses (Token & Context Economy, Human-Agent Dynamic, Rule Adherence, Trend Over Time) plus the Fix Filter.
- key step: each review looks backwards and records "handoff received" signals about its upstream skill (backfill), so handoff value accrues to the upstream skill over time.
- alternative path: a finding the Developer caused lands on the Developer side only when no skill change could reasonably have nudged a better interaction; otherwise it is a workflow-side finding.
- successful outcome: open.

## Requirements 
- R46 - A review classifies every finding as workflow side (skill, agent, prompt, hook, check) or Developer side, and a Developer-side finding states why no workflow change could have nudged a better outcome. Accept: in a review each finding carries one side, and every Developer-side finding carries that reasoning.
- R47 - A review uses only session logs on this machine, the repository's Workflow Folder artifacts, and its local git history as evidence. Accept: a review completes with no network access and cites only those sources.
- R48 - A Review of a skill's session records handoff signals about the upstream skill whose output that session consumed. Accept: after a downstream session is reviewed, the upstream skill's records show a handoff signal from it.

## Scope Guardrails
- in: per-skill reviews; in-session value plus the next handoff; workflow-side and Developer-side findings.
- out: whole-workflow rollup; Github-hosted data (PRs, issues, CI runs); production signals; logs from other machines; target-repository `retro`-style tune-ups (separate future skill).

## Constraints
- evidence boundary: session logs on this machine, the repository's Workflow Folder, and local git history only.
- order of fixes: workflow-side fixes first; Developer-side is the last resort.
- imposed format: harness session-log formats - owners: Github (Copilot CLI, VS Code Copilot Chat), Anthropic (Claude Code)

## Success
- open: the Developer's success signal for v1 (branch 6).

## Decisions
- parked: Github, CI, and production evidence - too much complexity and scope for v1 (Q3)
- deferred-to-spec: R48 - the rules that link a downstream session to the upstream output it consumed (artifact path or product slug).
- open: (draft only): Q4 - which harness v1 must read (Copilot CLI, VS Code Copilot Chat, Claude Code) session logs; backfill across harnesses depends on it.
- open: (draft only): branch 3 - trigger, where the review runs (target repository vs `Personal.Workflow`), failure paths.
- open: (draft only): branch 4 - v1 scope anchor (ask the Developer first, then recommend).
- open: (draft only): branch 5 - central store location, Executive Summary shape and depth of proof, rubric presentation.
- open: (draft only): branch 6 - success measure.
- open: (draft only): branch 7 - writes outside the workspace, read-only until approved, packaging outside the Workflow Core and Claude copy.
- open: (draft only): branch 8 - Vocabulary; `Session` in the Glossary means a brain-storm session file, which clashes with "session" as an agent conversation log.
- open: (draft only): R46-R48 are drafts, pending confirmation at the Requirement Gate.
- settled: Q1 purpose (Developer's own words), Q2 sides, Q3 evidence boundry and backfill.