# Refactoring in the Unified Workflow

**Purpose:** Background research and design framing for adding refactoring to the workflow. Intended for review and as input to a future `brain-storm` session.

**Related workflow files:**
- [pull-work SKILL.md](../../.github/skills/pull-work/SKILL.md)
- [work-planner SKILL.md](../../.github/skills/work-planner/SKILL.md)
- [PHASE-FORMAT.md](../../.github/skills/work-planner/references/PHASE-FORMAT.md)

---

## 1. What Refactoring Means Here (and What It Does Not)

Refactoring looks at **code structure over time**—both forward-looking (shaping code before new work lands) and backward-looking (cleaning up drift after behaviors are added, changed, or removed). It is distinct from both **optimization** and **bug fixing**:

| Concern | What changes | Trigger | How the workflow treats it |
|---|---|---|---|
| **Optimization** | Measurable runtime/resource behavior (e.g., API latency 700ms → 200ms, memory, throughput) | Observed performance bottleneck or regression | A **spec-level quality threshold (`Q-*`)** or a **Defect** when a threshold regresses. Proven by a benchmark or measurement. |
| **Bug fix** | Broken observable behavior | Failing test, user report, or `Review` finding | A **`fix` card** (or `Defect` mode in `work-planner`) with a reproducing scenario. |
| **Refactoring** | **Internal structure only** — zero change to observable behavior | Structural friction over time: duplication, drift across slices, dead code after changes/removals, or code shaped wrong for upcoming work | A **structure-only pass** where the locked acceptance tests stay unchanged and green before and after. |

### Key distinction: broken logic vs. structural drift
Adding, changing, or removing behaviors can introduce both:
- **Broken logic** — a defect, which should be caught by tests or a missing scenario.
- **Structural drift** — duplicated helpers across parallel slices, stale abstractions, dead code left behind after `Reconcile` changes or removes a requirement, or growing files that make future cards exceed ~60 lines or fall out of `delegate` into `main`.

**Working definition for this workflow:**
> Reshaping existing code—without changing any locked acceptance test—so the codebase stays cheap to understand, cheap to change, and easy to delegate to `coder` in small, closed-world cards.

---

## 2. Built-In Advantage of This Workflow

Refactoring requires a reliable behavioral safety net. This workflow already enforces one:
- **Locked black-box acceptance tests** (`Tests locked` + guard hook) verify observable behavior at the product boundary.
- **Mutation testing** (where supported by the stack) catches dead code and weakly tested branches.

Because of this, a refactor does not need new scenarios. Its proof of correctness is:
1. The full acceptance suite still passes (zero behavior change).
2. Locked oracle files are unchanged (`git diff --exit-code <Tests locked> -- <Oracle>`).

---

## 3. When Refactoring Should Happen

Because refactoring operates on code *over time*, there are three natural insertion points in the existing lifecycle, plus one place it should explicitly avoid.

### A. Forward-Looking (Preparatory) — during `Plan` and `Reconcile`, before `build` cards
- Principle: *"Make the change easy, then make the easy change."*
- When `repo-scout` surveys files touched by upcoming requirements (or when `Reconcile` processes a spec change), if the current structure would force workarounds, oversized cards, or escalating `delegate` work to `main`, schedule a `refactor` card first, then build the new slices on top of the clean shape.
- **Payoff:** Highest ROI—every token spent pays off immediately in the very next slices.

### B. Backward-Looking (Consolidation) — at phase boundaries or after `Reconcile` removals/changes
- As slices land (especially parallel `delegate` slices), local decisions can accumulate duplication, inconsistent patterns, or orphaned code left behind by changed/removed requirements.
- Right after a phase's `Gate` and `Review` pass—while `Phase base..HEAD` naturally bounds the diff—is a clean point to check whether anything touched in that phase warrants consolidation before the next phase is planned.
- **Guardrail:** Should be **signal-gated**, not run unconditionally on every phase.

### C. On-Demand (Intentional Debt Paydown) — explicit developer trigger
- Analogous to `/pull-work [<slug>] bug: <description>` for `Defect` mode.
- Lets the developer initiate a targeted refactor when they notice structural debt outside of an active feature change.

### Where Refactoring Should *Not* Happen
- **Mixed inside a `build` card.** Combining structural reshaping with new behavior bloats diffs, pushes cards past the ~60-line target in `PHASE-FORMAT.md`, and makes test failures ambiguous (feature bug vs. broken invariant). Dedicated cards and commits (`refactor(<slug>): ...`) keep changes isolated and reversible.

---

## 4. Additional Costs and Risks

Adding refactoring introduces four costs that must be weighed against the workflow's token-efficiency mission:

1. **Discovery cost (largest token risk):** Broadly asking an LLM to scan a repository for refactoring ideas consumes large context windows and tends to produce low-value style churn.
2. **Execution and verification cost:** Planning the card, running `coder` or `main`, re-running the full test suite, committing, and potentially running `code-review` on critical files.
3. **Churn and regression risk:** Refactoring cold, stable code that is neither changing nor causing friction introduces regression risk for zero immediate return—especially on stacks without a mutation gate.
4. **Human attention cost:** Extra checkpoints or noisy proposals slow down `pull-work`.

---

## 5. Cost-Effective Targeting: A Two-Stage Funnel

Consistent with the workflow's rule that *"anything deterministic goes to commands that spend no tokens,"* refactoring discovery should use a **two-stage funnel** instead of broad LLM review.

### Stage 1: Zero-Token Targeting (Mechanical Narrowing)
Never scan the whole repo. Restrict attention to **hot / recently-changed code** and let deterministic scripts and existing workflow artifacts surface candidates:

- **Touch-set scoping:** Only inspect files in:
  - `git diff <Phase base>..HEAD` (backward-looking),
  - files affected by a `Reconcile` change or removal, or
  - files `repo-scout` already identified as touched by the next phase's requirements (forward-looking).
  - Cold, untouched code is ignored.
- **Mechanical signals (script, 0 tokens):**
  - *Churn:* files modified repeatedly across slices or phases in `git log`.
  - *Growth:* files or functions that crossed a size/length threshold during the phase.
  - *Dead / orphaned code:* unused exports, unreferenced helpers, or surviving mutants in uncovered branches surfaced by the `Gate`.
- **Workflow friction signals (free from existing artifacts):**
  - Cards forced to `Tier: main` because the existing code lacked a clean pattern for `delegate`.
  - Repeated `blocked`, `Revise`, or `fix` cards hitting the same files.
  - `code-review` findings flagging *"misleading shared structures that later cards will misuse"* (already a `Review` criterion in `pull-work`).

### Stage 2: High-Bar LLM Judgment (Flagged Subset Only)
Only when Stage 1 produces candidates does an agent inspect *just those files* against an explicit value bar—never "could this look nicer?", only:
1. Does this remove dead code or active duplication across files currently under churn?
2. Does this fix a structural mismatch that makes upcoming slices smaller or `delegate`-able?
3. Does this resolve a shared-structure risk flagged by `Review` or repeated `blocked` slices?

If none of these hold, **do nothing** (zero planning/execution tokens spent).

---

## 6. Possible Fit With Existing Workflow Mechanics

Refactoring can likely reuse most of the existing machinery rather than adding a parallel process:

- **Card kind:** Add `Kind: refactor` in `PHASE-FORMAT.md`:
  - Owns no scenarios (`Scenarios` omitted).
  - `Done when`: full acceptance suite passes (excluding only `Known failures` / unfinished slices) + locked oracle unchanged.
  - Commit type: `refactor(<slug>): <description>`.
- **Tiering & Review:** Follows the same `delegate` vs. `main` and `Review: required` rules (e.g., critical-file refactors still get `Review: required`).
- **Integration points:**
  - `Plan` / `Reconcile`: emit preparatory `refactor` cards before dependent `build` cards when `repo-scout` flags structural friction.
  - Post-`Gate` / `Review` (or pre-next-phase): run a zero-token signal check on `Phase base..HEAD`; only propose/plan cleanup when signals fire.
  - Optional explicit command (e.g., `/pull-work [<slug>] refactor: <scope>`), mirroring `Defect` mode.

---

## 7. Open Questions for the Brain-Storm Session

1. **Which triggers should v1 support?** Forward-looking (`Plan`/`Reconcile`), backward-looking (post-phase), on-demand, or a subset first?
2. **Approval model:** Should `refactor` cards always go through a user Checkpoint (Phase Review), or can small, signal-triggered refactors run under existing approval rules?
3. **Stage 1 signals:** Which zero-token signals are portable across stacks (TypeScript, Node, C#, etc.) vs. language-addon specific?
4. **Scope & budget guardrails:** What caps prevent refactoring from turning into unbounded churn (e.g., max refactor cards per phase, strict file-list bounds, never touching cold files unless explicitly requested)?
5. **Interaction with `Review`:** Should `code-review` stay focused strictly on high-confidence defects, or should its "misleading shared structure" findings feed directly into `refactor` cards instead of `fix` cards?
6. **Interaction with `small` lane:** Should `small` lane skip automatic refactor checks altogether to stay lightweight?
