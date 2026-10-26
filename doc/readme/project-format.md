# Project format

Status: **implemented** in `packages/core` (zod schemas in `src/schema/`; they are the executable truth). This file
keeps the *reasons*, invariants and conventions.

## Layout

```
my-film/
  project.json            name, schemaVersion, settings (default providers, budget caps, aspect, fps)
  script/                 *.fountain (film)  |  *.song.md (lyrics/structure for music)  — plain text
  entities/<kind>/<id>/   entity.json + reference media (characters, locations, props, voices, instruments)
  units/                  scenes/*.json (film)  sections/*.json (music): resolved entity refs + shot/segment list
  jobs/<id>.json          queue records (state, request, estimate, provider job id, history)
  artifacts/<id>/         media files + artifact.json (provenance, content hash, accepted flag)
  timeline/*.json         ordered clips/tracks referencing accepted artifacts
  exports/                rendered outputs (git-ignored by default)
```

Text and JSON are git-friendly; large media in `artifacts/` and `entities/**/ref` is git-ignored by default with an
optional LFS recommendation.

## Entities

Common fields: `id` (stable, never reused), `kind`, `name`, `aliases` (how the script refers to it), `description`,
`references[]` (images/audio/video files with role: face, full-body, outfit, mood...), `canonicalSheet` (the approved
reference set injected into every generation), `notes`.

Kind-specific:
- Character: appearance, wardrobe variants, linked `voiceId`.
- Location: time-of-day variants, mood, lighting.
- Prop: simple.
- Voice: speaker sample audio, language, style description, or provider voice id. Used for dialogue *and* sung vocals.
- Instrument: name, family, timbre description, optional sample/reference audio, role in arrangement (lead, pad, bass...).

## Units

- Scene (film): heading, entity ids present, description, shots[] (each: action text, dialogue lines with speaker ->
  voiceId, camera hint, duration target, chosen references).
- Section (music): name (verse/chorus/...), bars or seconds, tempo/key, chord/lyric text, instrument tracks with
  arrangement notes, vocal voiceId.

## Why these choices

- Aliases + stable ids let the script editor auto-link names without brittle string matching.
- `canonicalSheet` is the main defence against character drift: one approved set, reused everywhere.
- Jobs and artifacts are separate: redo creates a new artifact; old ones stay for comparison until the user purges.

## Conventions and invariants (implemented in plan 02)

- **Ids** are `<prefix>_<26-char ULID>` (`chr_`, `loc_`, `voc_`, ...): sortable by creation time, strictly increasing in a
  process, never reused. The prefix says what the id points at, and schemas check it.
- **Strict schemas.** Unknown fields are an error, never silently dropped, so an older app cannot lose data from a newer
  project (a newer `schemaVersion` is refused outright). Every defaulted field is written explicitly.
- **A file must live where its kind and id say** (`entities/characters/<id>/entity.json`, `jobs/<id>.json`, ...);
  loading fails otherwise.
- **Migrations run on the raw parsed JSON of the whole project** (`RawFiles`), one version step at a time, before
  validation. `MIGRATIONS` is empty at version 1.
- **Serialisation is deterministic** (sorted keys, 2 spaces, trailing newline). Save validates everything first and
  writes nothing if any value is invalid. Save removes managed JSON of deleted items but never deletes scripts or media.
- **Two layers of validation:** per-file schemas (`loadProject`/`saveProject`) and cross-file consistency
  (`validateProject`: dangling ids, alias conflicts, timeline clips must reference *accepted* artifacts).
- **I/O is behind `FsPort`.** `core` has an in-memory implementation; `@tapestry/fs-node` has the disk one (atomic
  temp-file-and-rename writes, refuses paths escaping the project folder).
- `GenerationRequest`, `Capability` and `JobState` are defined in `core` (not `providers`) because jobs persist them.
- **Fixtures** in `fixtures/` are generated from `@tapestry/core/testing` builders. After changing a schema, run
  `UPDATE_FIXTURES=1 pnpm test` and review the diff; the normal test run fails if fixtures drift from the code.
- Still open for plan 05: how the script editor keeps scene/shot ids stable when text is re-parsed.
