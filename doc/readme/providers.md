# Providers and models

## Provider interface (design intent; code is authoritative once plan 03 is done)

A provider declares `id`, `capabilities`, a config schema, terms/license URLs, and implements:

- `estimate(request) -> {cost?, seconds?, notes}` — pure, no network, so approval can show it.
- `submit(request) -> remoteJobRef` — starts work; must be safe to retry on transient errors.
- `poll(remoteJobRef) -> {status, progress?, artifacts?, error?}` — resumable after app restart.
- `cancel(remoteJobRef)`.
- `limits` — e.g. max reference images/videos/audio, max duration, resolutions. The composer uses these to pick references.

Requests are provider-neutral (`kind`, prompt text, references with roles, duration, seed, style params, audio inputs) and
adapters translate. Provider-specific escape hatches live in a namespaced `extras` bag, never in the core request.

## Model/hardware facts (research as of 2026-10; all UNVERIFIED unless marked)

- **MiniMax H3**: omni-modal video + native stereo audio, up to 15 s clips; open weights released 2026-08-03 under a
  community license reportedly excluding US/EU/UK/South Korea. ~33B-param dense transformer; quantised (INT8/FP8/GGUF)
  variants exist with ComfyUI-native workflows. Reference-to-video accepts up to 9 images, 3 videos, 3 audio clips (12
  files total). Open weights output 768p short edge by default; sources conflict on whether 2K ("Regenerate-2K") is
  local or hosted-only. Mac support: not documented.
- **Local alternatives**: Wan 2.2 (5B variant light), LTX 2.3 (has audio, fast), HunyuanVideo 1.5. Apple Silicon support
  for each is unknown; plan 10 measures it on the target MacBook.
- **Local feasibility for the target machine (MacBook Pro M4)**: expect short, low-res drafts taking minutes per clip
  and a hard dependence on unified memory (>=32 GB comfortable, 16 GB painful). Custom CUDA kernels may not run at all.
  This is why remote providers are first-class.
- **Draft vs final**: different models produce different films. Plan for *render once, enhance later* (upscale /
  low-strength refine of the accepted clip), not *draft locally, re-render remotely*.
- **Audio**: per-clip native audio will not keep a voice consistent across clips. Treat dialogue/music/SFX as separate
  tracks (speech and music providers) assembled on the timeline.
- **Music**: open candidates to evaluate in plan 14 — ACE-Step, MusicGen/AudioCraft (note: check weights license),
  hosted APIs (Suno/Udio-style services typically restrict API access and impose terms; check before building).

## Rules for adding a provider

1. Manifest includes license/terms URL; app shows it before first use.
2. Implement against the shared contract test-suite (`packages/providers/contract`), including mock-server replay.
3. Never hard-code prices; read from provider response or a user-editable pricing table, flag as estimate.
4. Keys go to the OS keychain; never logged, never stored in the project folder.
