# Project format

Status: **design draft**; the executable truth is the zod schemas in `packages/core` once plan 02 is done. After that
this file only keeps the *reasons* and invariants.

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
