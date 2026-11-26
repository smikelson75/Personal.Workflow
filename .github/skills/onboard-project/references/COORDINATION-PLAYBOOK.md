# Coordination Playbook

Project Pointers are entries in the Home Repo's `AGENTS.md` that name a Project Repo and its role: `co-changed`, `read-only reference`, or `peer-impact`. Use this playbook to order one change that spans an API Project Repo and a database Project Repo.

## Steps

1. In the API Project Repo, run `brain-storm` and then `behavior-spec` for the API need, covering limits, required fields, and relationships.
2. In the database Project Repo, run `brain-storm` from the API Behavior Spec path, then make a read-only check of the Project Repos holding a `peer-impact` Project Pointer for shared or cross-schema tables, with no edits and no commits in peer repos.
3. Run `work-planner` and `pull-work` separately in each Project Repo, each launched there with the Launch Script; the database Phase that delivers the needed schema completes before the API Phase that consumes it starts.

## Project Pointer Roles

- `co-changed` - changes in step 3 run in both repos, ordered needs-first: the Project Repo whose Phase delivers what the other needs goes first.
- `read-only reference` - read in step 2 for context; never planned or edited in any step.
- `peer-impact` - checked read-only in step 2; a finding means a new Behavior Spec requirement in that repo's own flow before step 3 starts.
