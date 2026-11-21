# Work Planner

Turns the behavior spec into a plan of thin vertical slices. Each slice closes when acceptance tests, written beforehand by a strong model, pass. It writes `.workflow/plans/<artifact-slug>/plan.md` (routing and status) and one `phase-NN.md` per phase (invariants, gate, and slice cards) beside it. See [SKILL.md](./SKILL.md) for the behavior and [references/](./references/) for the formats.

## How a Phase Runs

Run `/work-planner` in your main session and type `run next` at each step. You never switch agents.

1. The main session asks `repo-scout` for facts, checks existing ADRs in `.workflow/adr/`, picks the lane, then writes the phase and its cards. Hard-to-reverse decisions become ADR candidates in `plan.md`. Setup cards (harness, suite repair) run first if needed.
2. Failing acceptance tests get written per card: by the main session for small phases, by `test-author` in parallel otherwise.
3. You review the cards, tests, tiers, and ADR candidates once per phase. Approval locks the tests (`standard` lane), and the main session writes the approved ADRs with [adr-writer](../adr-writer/README.md).
4. The main session checks each `ready` card. `local` cards go to `coder`, in parallel where dependencies and files allow; the main session implements `cloud` cards itself. It confirms the tests pass by rerunning them.
5. The phase gate runs: full suite, traceability, locked-test check, and mutation testing (`small` lane: full suite only). Triage turns failures into fix cards, which return to step 2.

To resume in a new session, read the `Next` line in the plan.

## Lanes

- `small`: at most 2 slices, no new product interface, no ADR candidate. The main session writes the tests, nothing is locked, and the gate is the full suite.
- `standard`: everything else.

## Agents and Models

The main session runs on whatever model you pick; a Sonnet-class model on `medium` is the recommended default. Subagents exist only where they cost less than doing the work in place, because every subagent start reloads its instructions and re-reads its inputs. Each is a custom agent in [.github/agents/](../../agents/) with its model list in frontmatter. The first available model is used. To change a pin, edit that agent's `model:` list.

| Agent | Tier | Effort | Why |
|---|---|---|---|
| `repo-scout` | cheap | `low` | High-volume reading kept out of the main context; it decides nothing. |
| `coder` | cheap or local | `medium` | `local` cards only. A closed-world card plus locked tests act as the oracle; no design work. |
| `test-author` | mid | `medium` | Writing and running tests is volume work; the card's scenarios already hold the judgment. Skipped for small phases. |
| `planner` | strongest | `high` | Optional. Pick it yourself for a large or architecture-heavy first plan, where slice boundaries matter most. |

### Notes

- If coders often stop on the same kind of card, the cards are under-pinned. Fix the cards; don't upgrade the coder's model.
- A card needing judgment gets `cloud` tier, which keeps it in the main session instead of paying for a premium subagent and its handoff.
- Model names in frontmatter are host-specific. Hover or use completions in the agent file to confirm each one is available.
