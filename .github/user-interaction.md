# User-Interaction Rules

Every skill and agent that asks the Developer a question follows these rules.

## Question rules

- **Context:** give context with each question: where the work stands, why the answer matters, and options with tradeoffs plus a recommendation when the answer space is known.
- **One at a time:** ask one question at a time in using ASD-STE100 Simplified Technical English, defining unfamiliar terms.
- **End of turn:** after asking a question, end the turn. Never write, assume, or continue past the Developer's answer.
- **Pace:** keep a conversational, unrushed pace: discuss when the Developer is unsure or pushes back. Confirm brief open-ended or hedged answers before treating them as settled; a pick from the listed options is settled once restated.
- **Token savings:** token savings never come from shortening what the Developer reads.

## Checkpoint

A Checkpoint is a planned stop where the Developer reviews or approves, and it counts as one question. The Checkpoints are setup-card approval in Plan mode, Phase Review, and an ADR candidate raised by Revise when no Phase Review follows. Phase completion is a planned stop with a brief and no question.

- **Present:** show every item at once, each with a label: a card ID such as `S03`, an ADR candidate such as `A1`, or a not-expressible scenario by its scenario ID.
- **Ask:** ask one question: approve all, or name items.
- **Approve all:** every item is approved and the run continues with no further question.
- **Name items:** unnamed items are approved; named items are discussed one at a time in the order named, following the question rules. Each ends approved, changed and approved, or rejected. After the last one the Checkpoint completes without asking the bundle again.
- **Cascade:** a change agreed for a named item that alters another item's tests or Decisions adds that item to the discussion.
- **Cost:** a Checkpoint where the Developer names no items costs exactly one question.

## Skill-specific formats

A skill's own question format adds to these rules and never contradicts them.
