# 05 — Script engine (film screenplay + song structure)

## Goal
Parse writing into structure and *detect entities as the user types*, for both screenplays and songs.

## Steps
1. `packages/script`: Fountain parser (scene headings, action, character cues, dialogue, parentheticals, transitions).
   Write independently from the spec (fountain.io); do not copy any AGPL implementation.
2. Song format `*.song.md`: sections with headings (`## Verse 1 [8 bars, 90 bpm, Am]`), lyric lines, instrument notes in
   brackets. Parser yields Sections.
3. Entity detection: uppercase character cues, locations from scene headings, capitalised nouns/props via configurable
   heuristics; resolve against the alias index from `core`; return `unresolved mentions` with positions and a suggested
   kind. No LLM required; an optional LLM-assisted detector is a later plug-in.
4. Incremental API: given text + cursor, return diagnostics/suggestions in < 20 ms for a 120-page script.
5. Import: `.fountain`, `.txt`; Final Draft `.fdx` (XML) as a second step in this file if time allows.
6. Scene/Section derivation: produce `units/*` drafts from the text, preserving user-edited fields on re-parse (merge by
   stable unit ids stored in script comments/boilerplate).

## Acceptance
- Golden-file tests over 5+ sample scripts and 2 sample songs.
- Re-parse after edits keeps unit ids and user-chosen fields.
- Performance test meets the 20 ms target.

## On completion
Parser behaviour is in code docs/tests; note only the unit-id merge rule in `project-format.md`. Remove this file.
