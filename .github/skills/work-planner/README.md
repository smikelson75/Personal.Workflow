# Work Planner

Turns the behavior spec into a plan of thin vertical slices. Each slice closes when acceptance tests, written beforehand by a strong model, pass. It writes `.workflow/plans/<artifact-slug>/plan.md` (routing and status) and one `phase-NN.md` per phase (invariants, gate, and Cards) beside it. See [SKILL.md](./SKILL.md) for the behavior and [references/](./references/) for the formats.

## How a Phase Runs

Type `/pull-work` in your main session. It checks that the working tree is clean, reads the plan's `Next` line, and keeps going until it needs you or the phase is done. It loads this skill for the planning steps. You never switch agents or type "run next".

1. The main session asks `repo-scout` for facts, checks existing ADRs in `.workflow/adr/`, picks the lane, then writes the phase and its cards. Hard-to-reverse decisions become ADR candidates in `plan.md`. Setup cards (harness, suite repair) run first if needed.
2. Failing acceptance tests get written per card: by the main session for small phases, by `test-author` in parallel otherwise.
3. You review the cards, tests, tiers, `Review` flags, and ADR candidates once per phase. Your approval is the permission to commit: the tests are committed and locked (`standard` lane) without a second question, and the main session writes the approved ADRs with [adr-writer](../adr-writer/README.md).
4. Coding starts right away. `delegate` cards go to the cheap `coder` agent, in parallel where files allow; the main session implements `main` cards itself. Each slice is committed as it completes.
5. The phase gate runs: full suite, traceability, locked-test check, and mutation testing (`small` lane: full suite only). Then `code-review` checks only the cards marked `Review: required`. Triage turns failures and real findings into fix cards.

When new, spec-correct code makes an older locked test fail only because that test's fixture had a second, unchecked fault, a fixture repair runs without you. `test-author` fixes only the fixture, a command confirms no assertion changed, and `test-reviewer` approves the change before the tests are re-locked. Any change to what a test expects comes to you at phase review. A hook ([locked-tests.json](../../hooks/locked-tests.json)) denies edits to locked tests at every other time. The full list of times you are asked is in [pull-work](../pull-work/SKILL.md)'s `Escalate Only`.

To resume in a new session, run `/pull-work`.

## Tiers and Review

- `delegate` (the default): the cheap `coder` agent builds the card. It fits cards that follow an existing pattern with every decision pinned.
- `main`: the main session builds the card. It's reserved for cards that create structure later cards build on, or that need judgment a card can't pin.
- `Review: required`: the card's code gets one `code-review` pass after the phase gate. This applies to security, destructive operations, trust boundaries, shared structures, and public interfaces or stored formats, plus every `main` card when mutation testing is unavailable. Everything else relies on its locked tests.

## Lanes

- `small`: at most 2 slices, no new product interface, no ADR candidate. The main session writes the tests, nothing is locked, and the gate is the full suite.
- `standard`: everything else.

## Recommended Models

The main session runs `work-planner` for day-to-day planning, revisions, and triage; a mid-tier model at `medium` effort is the default. For a large or architecture-heavy first plan where Slice boundaries matter most, invoke the optional `planner` agent on a frontier model at `high` effort.

| Provider  | Model               | Default effort | Raise to `high` (or use `planner` agent) when                        |
| --------- | ------------------- | -------------- | -------------------------------------------------------------------- |
| Anthropic | `claude-sonnet-5.5` | `medium`       | Large or architecture-heavy first plan (`claude-opus-5.5` at `high`) |
| OpenAI    | `gpt-6.1-terra`     | `medium`       | Large or architecture-heavy first plan (`gpt-6.1-sol` at `high`)     |
| Google    | `gemini-4-neon`     | `medium`       | Large or architecture-heavy first plan (`gemini-4-neon` at `high`)   |

### Effort Guidance

- **`low`**: not recommended. Cards end up under-pinned, causing `coder` to stop and report back repeatedly.
- **`medium`** (default): handles standard phases, revisions, and Gate triage reliably.
- **`high`**: use for a large first plan, complex sequencing, or cross-cutting refactors.
- **`xhigh` / `max`**: rarely needed; prefer pinning cleaner specs and ADRs over burning extra reasoning tokens.

## Agents and Models

Subagents exist only where they cost less than doing the work in place, because every subagent start reloads its instructions and re-reads its inputs. Each is a custom agent in [.github/agents/](../../agents/README.md) with its model list in frontmatter. The first available model is used. To change a pin, edit that agent's `model:` list.

| Agent | Tier | Effort | Why |
|---|---|---|---|
| `repo-scout` | cheap | `low` | High-volume reading kept out of the main context; it decides nothing. |
| `coder` | cheap (local once configured) | `medium` | `delegate` cards only. A closed-world card plus locked tests act as the oracle; no design work. |
| `test-author` | mid | `medium` | Writing and running tests is volume work; the card's scenarios already hold the judgment. Skipped for small phases. |
| `test-reviewer` | mid | `medium` | Approves fixture repairs to locked tests, so the agent that changes a test never approves its own change. |
| `code-review` | built-in | default | Reviews only `Review: required` cards, once per phase, after the gate. |
| `planner` | strongest | `high` | Optional. Pick it yourself for a large or architecture-heavy first plan, where slice boundaries matter most. |

### Notes

- If coders often stop on the same kind of card, the cards are under-pinned. Fix the cards; don't upgrade the coder's model.
- A card needing judgment gets `main` tier, which keeps it in the main session instead of paying for a premium subagent and its handoff.
- Model names in frontmatter are host-specific. Hover or use completions in the agent file to confirm each one is available.
