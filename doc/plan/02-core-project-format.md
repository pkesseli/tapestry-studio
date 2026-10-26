# 02 — Core: project format

## Goal
Typed, versioned, validated read/write of a project folder as described in `doc/readme/project-format.md`, covering
both film and music entities.

## Steps
1. zod schemas (`packages/core`) for: Project, Entity (Character, Location, Prop, Voice, Instrument), Scene, Section,
   Shot/Segment, Job, Artifact, Timeline. Export TS types from the schemas.
2. Stable id generation (ULID-like, sortable) and an alias index (name/alias -> entity id, case/diacritic-insensitive).
3. Filesystem port interface (`FsPort`) with Node and in-memory implementations; all load/save goes through it.
4. `loadProject` / `saveProject` with atomic writes (temp file + rename), tolerant of missing optional folders.
5. `schemaVersion` + migration registry; first migration is a no-op with a test harness for future ones.
6. Deterministic JSON serialisation (stable key order, 2-space indent) so git diffs stay small.
7. A sample project fixture under `fixtures/sample-film` and `fixtures/sample-song`.

## Acceptance
- Round-trip test: load -> save -> byte-identical output for both fixtures.
- Invalid files produce errors naming file path and field.
- 100% of schemas documented via TSDoc; `core` has zero internal imports.

## On completion
Schemas are the documentation. Trim `project-format.md` to reasons and invariants; remove this file.
