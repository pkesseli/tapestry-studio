# 15 — Timeline and export

## Goal
Assemble accepted clips and audio into a finished film; reliable ffmpeg integration.

## Steps
1. `packages/media`: wrapper for an **external ffmpeg binary** (bundled per-platform in packaging, plan 19; located via
   setting/PATH in dev). Operations: probe, thumbnail, frame extraction (first/last), concat, trim, mux, loudness
   normalise, waveform data.
2. Timeline model (`timeline/*.json`): tracks (video, dialogue, music, sfx), clips referencing accepted/enhanced
   artifacts only, in/out points, fades, volume.
3. Timeline UI: drag to reorder, trim handles, snap, audio tracks with waveforms, scene markers. Keep it simple; no
   effects beyond cut, crossfade and fade.
4. Auto-assemble: default timeline from scene order and accepted shots; unfilled shots show placeholders with a
   "queue this" action.
5. Render export: mp4 (H.264/AAC) with presets (YouTube 1080p, vertical, preview), progress via the job event stream.
6. Frame-extraction helper (last/first frame of a clip) exposed for plan 16 chaining; render accepted music sections into a single audio track (assembly list from plan 13).
7. OTIO and FCPXML export of the timeline for DaVinci/Premiere/Final Cut.

## Acceptance
- A sample project with the mock provider exports a playable mp4 with video, dialogue, and music tracks in sync.
- Export is deterministic for identical inputs (same hash in tests with fixed ffmpeg flags).
- OTIO file opens in an OTIO-aware tool (human spot check).

## On completion
ffmpeg invocation notes and licensing (LGPL build only, external process) into `architecture.md`. Remove this file.

## Milestone
**M2 reached after this file**: a stitched short film/song with real providers from plans 11/12/14. Human checkpoint.
