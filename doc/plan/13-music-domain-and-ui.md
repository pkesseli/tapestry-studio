# 13 — Music studio: domain and UI

## Goal
Make songs and film scores with the same workflow as films: write, create voices/instruments inline, queue, review.

## Steps
1. Song editor mode (uses plan 05 song parser): sections with tempo/key/bars, lyrics, per-section instrument notes.
2. **Voices** (shared with film dialogue): singer entities with sample audio or provider voice id, style description
   (range, timbre), language. Lyric lines link to a voice.
3. **Instruments & arrangement**: instrument entities; an arrangement grid (sections x instruments) where each cell holds
   a short natural-language direction and on/off. Role presets (lead, pad, bass, drums, percussion).
4. Music request composition: per section produce requests such as *full-mix section*, *stem per instrument* (if the
   provider supports stems), or *vocal-only*; respect provider limits (max length; conditioning inputs).
5. Score mode data model only: a music Section may reference a scene or time range (placement UI comes in plan 15).
6. Review UI for audio: waveform player, A/B compare, loop section, accept = freeze (same rules as video).
7. Song-level assembly: define the ordered list of accepted sections that make up a track (data only); rendering to wav/mp3 is done in plan 15.

## Acceptance
- With the mock provider: write a 3-section song, define two instruments and one voice, queue all sections, review,
  accept, and see the ordered assembly list.
- A character's voice entity can be reused for film dialogue and for a sung line.

## On completion
Add music-specific invariants (if any) to `project-format.md`. Remove this file.
