# AGENTS.md — start here

**Tapestry Studio** (repo: `tapestry-studio`; CLI: `tapestry`). Not affiliated with the Apache Tapestry web framework.

Tapestry Studio is a free, Apache-2.0, open-source desktop studio that lets anyone turn an idea into a film or a piece of music:
write a script, create characters/places/voices/instruments on the fly, queue generations, review and approve them
later, and assemble the result. Local models and remote provider APIs are interchangeable plug-ins.

## Orientation for a new agent session

1. Read this file.
2. Read `doc/readme/vision.md` and `doc/readme/architecture.md` (short).
3. Read the other `doc/readme/*.md` only when the task touches their topic (see index below).
4. Open `doc/plan/` and take the **lowest-numbered file**. That is the next unit of work.

## Documentation system

Two folders, two jobs:

| Folder | Purpose | Lifetime |
|---|---|---|
| `doc/readme/` | Permanent context for agents and humans: why, how it fits together, hard-won facts. | Lives as long as it is true. |
| `doc/plan/` | The TODO list. One markdown file per actionable work item, ordered by filename prefix (`01-`, `02-`, ...). | **Deleted when done.** |

### Readme index (keep this list short; do not add files lightly)

- `doc/readme/vision.md` — mission, audience, principles, non-goals, licensing and clean-room policy.
- `doc/readme/architecture.md` — stack, modules, plugin boundaries, job lifecycle.
- `doc/readme/project-format.md` — on-disk project format (film and music entities).
- `doc/readme/providers.md` — provider interface, model/hardware facts, model-license cautions.
- `doc/readme/testing.md` — test layers, mock provider, spend caps, how to run agent loops safely.

### Plan-file rules

- A plan file must be **actionable now**: goal, scope, concrete steps, acceptance criteria. If it is not, it is not ready to
  be a plan file; leave it in `doc/plan/90-backlog.md` (the only deliberately non-actionable file).
- Number = implementation order. Do not start file N+1 while file N is open unless N is blocked (say so in N).
- Plan files may depend on earlier plan files; they must not depend on later ones.
- Keep plan files small enough to finish in one focused session or one agent loop. Split if larger.

### Completion procedure (do this in the same commit that finishes the work)

1. All acceptance criteria met, tests green, CI green.
2. **Detail that explains code belongs in the code**: module/type/function docs next to the implementation. Prefer this
   by far. Most plan content ends up here, not in readmes.
3. **Only cross-cutting, non-obvious facts** go to `doc/readme/*.md`: decisions and their reasons, invariants,
   external-world facts (model limits, license terms). Edit an existing readme; create a new one only if no existing
   file fits *and* the topic will be referenced from several places. Target: fewer than ~8 readme files in total.
4. Update the readme index above if a readme was added or removed.
5. **Delete the plan file** (`git rm`). History keeps it.
6. Commit message: what changed and why; mention the plan file name that was completed.

### Writing rules for docs

- State facts with their source and date when they are about the outside world (models, licenses, hardware).
  Mark anything not personally verified as `UNVERIFIED`.
- No restating what the code says. Explain *why*, constraints, and gotchas.
- Short beats complete. If a doc passes ~150 lines, split by topic or push detail into code docs.

## Working agreements for agents

- **Clean-room rule.** Never copy code, structure or distinctive text from AGPL/GPL projects (notably AI Movie Studio 2).
  Ideas and feature lists are fine. See `doc/readme/vision.md`.
- **Spend rule.** Never run a loop that calls a paid provider without a hard budget cap configured. Default to the mock
  provider. See `doc/readme/testing.md`.
- **Size rule.** Source files stay under 400 lines (CI enforces from plan 01). Split by responsibility, not arbitrarily.
- **Contracts first.** Cross-module boundaries (project format, provider interface, job states) are typed schemas with
  tests. Change a schema -> update its tests and migration in the same commit.
- **Everything the app stores is plain files in the project folder.** No hidden database as the source of truth.
- **Frozen clips.** Once a clip is Accepted, no code path may regenerate or overwrite it without an explicit user action.
- **Small commits**, each leaving `main` green. Do not push or open PRs unless asked.
- **Code style.** TypeScript strict mode; public functions and types carry TSDoc explaining parameters and
  invariants. Any Python (local-model sidecar, if it exists) uses type hints, docstrings on every class and function
  documenting all parameters, and a comment on every constant.
- When a human decision is required (naming, product direction, spending money, hardware tests), stop and ask; list the
  decision at the top of the relevant plan file under `## Needs human`.
