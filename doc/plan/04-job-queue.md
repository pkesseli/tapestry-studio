# 04 — Job queue

## Goal
Persistent, restart-safe queue implementing the lifecycle in `doc/readme/architecture.md`, with budget enforcement.

## Steps
1. State machine (`packages/queue`): Draft, Approved, Queued, Running, Rendered, Accepted, Enhanced, Redo, Failed,
   Cancelled. Transition table in one file, with exhaustive tests including illegal transitions.
2. Persistence as `jobs/<id>.json` via `FsPort`; append-only history entries per transition (time, actor, note).
3. Scheduler: concurrency limits per provider (local = 1 by default), priority, retry with backoff for `retryable`
   errors, resume of Queued/Running jobs on startup by re-polling remote refs.
4. Budget: per-project cap and per-approval cap; `approve()` refuses if estimate exceeds remaining cap; spend recorded on
   completion. Enforced here, not in adapters (`doc/readme/testing.md`).
5. Accepted freeze: store content hash; any write attempt to an accepted artifact path throws.
6. Event stream (typed emitter) for UI/CLI progress.
7. CLI command `tapestry queue run <project>` using the mock provider.

## Acceptance
- Kill-and-restart test: jobs mid-run complete correctly after restart with the mock provider.
- Budget tests: over-cap approval rejected; cancelled job releases reserved budget.
- Property test: no sequence of operations can overwrite an Accepted artifact.

## On completion
State diagram and invariants into `architecture.md` if changed; the rest is code docs. Remove this file.
