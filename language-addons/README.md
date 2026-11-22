# Language Add-ons

Language Add-ons are optional, stack-specific skills that plug code-style enforcement, test harnesses, and mutation testing into the Workflow Core. Copy only the add-ons for the stack your target repository uses into its `.github/skills/` directory.

For end-to-end setup and a complete worked example in each language, see the walkthroughs:

- **C# / .NET:** [docs/walkthrough-csharp.md](../docs/walkthrough-csharp.md)
- **Node.js JavaScript:** [docs/walkthrough-node.md](../docs/walkthrough-node.md)
- **Node.js TypeScript:** [docs/walkthrough-typescript.md](../docs/walkthrough-typescript.md)

## Available Stacks

### C# / .NET (`language-addons/csharp/`)

| Skill | Purpose | Key Outputs in Target Repo |
| --- | --- | --- |
| [dotnet-editorconfig](./csharp/dotnet-editorconfig/SKILL.md) | Sets up a root, build-enforced `.editorconfig` and analyzer baseline (`baseline` or `walkthrough` mode). | `.editorconfig`, `Directory.Build.props` |
| [stryker-dotnet](./csharp/stryker-dotnet/SKILL.md) | Configures and runs Stryker.NET mutation testing scoped strictly to unit-test projects. | `stryker-config.json`, Phase Gate mutation step |

### Node.js JavaScript (`language-addons/node-javascript/`)

| Skill | Purpose | Key Outputs in Target Repo |
| --- | --- | --- |
| [eslint-javascript](./node-javascript/eslint-javascript/SKILL.md) | Sets up ESLint (flat config) and Prettier with non-overlapping rules. | `eslint.config.js`, `.prettierrc.json`, `.editorconfig`, `package.json` scripts |
| [vitest-javascript](./node-javascript/vitest-javascript/SKILL.md) | Sets up Vitest with separate unit and locked acceptance test configs, plus `work-planner` Harness/Gate lines. | `vitest.config.js`, `vitest.unit.config.js`, `tests/` layout |
| [stryker-javascript](./node-javascript/stryker-javascript/SKILL.md) | Configures and runs StrykerJS mutation testing with the Vitest runner against unit tests only. | `stryker.config.json`, Phase Gate mutation step |

### Node.js TypeScript (`language-addons/node-typescript/`)

| Skill | Purpose | Key Outputs in Target Repo |
| --- | --- | --- |
| [eslint-typescript](./node-typescript/eslint-typescript/SKILL.md) | Sets up strict `tsc` (`~6.0.3`), typed `typescript-eslint` (flat config), and Prettier. | `tsconfig.json`, `tsconfig.build.json`, `eslint.config.js`, Prettier config, scripts |
| [vitest-typescript](./node-typescript/vitest-typescript/SKILL.md) | Sets up Vitest for TypeScript with `tsc` type-checking wired into Harness/Gate lines and black-box tests against `dist/`. | `vitest.config.ts`, `vitest.unit.config.ts`, `tests/` layout |
| [stryker-typescript](./node-typescript/stryker-typescript/SKILL.md) | Configures and runs StrykerJS with the Vitest runner and TypeScript checker against unit tests only. | `stryker.config.json`, Phase Gate mutation step |

## Shared Mutation Testing Protocol

All three Stryker add-ons follow [mutation-testing/protocol.md](./mutation-testing/protocol.md). When copying a Stryker add-on into a target repository, copy `mutation-testing/protocol.md` alongside it (to `.github/skills/mutation-testing/protocol.md`) so the relative protocol link resolves.

Core rules shared across stacks:

- Run mutation testing once per Phase at the Gate, scoped to changes since Phase start.
- Use **unit tests only** to kill mutants; never widen scope to integration or acceptance tests.
- First run is measure-only; enable a blocking `break` threshold only after the initial survivor backlog is triaged and cleared.

## Recommended Models

Code-style and test-harness add-ons mostly apply deterministic baselines and verify commands, so a mid-tier model at `low` effort is fast and reliable. Mutation-testing add-ons require reading survivor reports and distinguishing real test gaps from equivalent mutants, so they benefit from `medium` effort.

| Skill | Anthropic | OpenAI | Google | Default Effort | Raise Effort When |
| --- | --- | --- | --- | --- | --- |
| `dotnet-editorconfig` | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `low` | Amending a complex existing `.editorconfig` or running `walkthrough` mode (`medium`) |
| `stryker-dotnet` | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `medium` | Triaging large survivor backlogs or diagnosing compile-error mutants (`high`) |
| `eslint-javascript` | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `low` | Migrating legacy `.eslintrc.*` configs or running `walkthrough` mode (`medium`) |
| `vitest-javascript` | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `low` | Custom multi-process or server test harnesses (`medium`) |
| `stryker-javascript` | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `medium` | Triaging large survivor backlogs or debugging incomplete runs (`high`) |
| `eslint-typescript` | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `low` | Amending existing `tsconfig.json` strictness flags or legacy ESLint migrations (`medium`) |
| `vitest-typescript` | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `low` | Custom build-output or server test harnesses (`medium`) |
| `stryker-typescript` | `claude-sonnet-5.5` | `gpt-6.1-terra` | `gemini-4-neon` | `medium` | Triaging survivor backlogs or type-rejected mutants (`high`) |
