# Providers and models

## Provider interface (implemented in `packages/providers`; the code is authoritative)

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
- **Local feasibility**: see "Measured on M4 Pro" below, which replaces the earlier guesses. Memory is the hard limit
  (about 15 to 30 GB per video model); custom CUDA kernels often do not run, and FP8 weights fail on Metal (use GGUF
  or 4-bit). Remote providers stay first-class, above all for recurring characters.
- **Draft vs final** (measured 2026-11, plan 10b, one rater): *direct render is the default.* A cheap draft is a
  preview of framing and movement only. Refining a draft with the same model keeps both but changes faces and hands
  (6 of 10 shots kept); structure-conditioned re-renders lose who is in the shot; a plain 2x enlargement of the draft
  loses to a direct render (7 of 10 shots, the rest tied). Different models make different films, so a final from
  another model cannot be trusted to match an approved draft. UNVERIFIED: whether a cloud model that accepts reference
  video can follow a local draft; test before designing for it.
- **Audio**: per-clip native audio will not keep a voice consistent across clips. Treat dialogue/music/SFX as separate
  tracks (speech and music providers) assembled on the timeline.
- **Music**: open candidates to evaluate in plan 14 — ACE-Step, MusicGen/AudioCraft (note: check weights license),
  hosted APIs (Suno/Udio-style services typically restrict API access and impose terms; check before building).

## Measured on M4 Pro (20-core GPU, 48 GB, macOS 15.7.2), 2026-11-12 to 2026-11-17

Source: `spikes/mac/results/` (runs, logs, findings) and `spikes/draft-final/`. One 4 s clip at about 832x448 or 832x480
and 24 fps unless noted. Quality was judged by the agent from frames and, for the plan 10b clips, by one person.

| Model (runtime) | Time per clip | Peak memory | Notes |
|---|---|---|---|
| LTX 2.3 distilled int4 (ltx-2-mlx) | about 168 s | 15 to 18 GB | In-sync audio, good camera moves. Identity not controlled by text. Best choice for a local queue. |
| MiniMax H3 Q8 GGUF, turbo LoRA (stable-diffusion.cpp) | 15 to 18 min | about 22 GB | Best pictures. With reference images (r2v) Maria and Tom stay recognisable across shots, two-person shots included. Audio unusable (random languages, static). Full 20 steps: 47 to 53 min, not clearly better. About 69 GB of weights. |
| Wan 2.2 5B Q8 GGUF (ComfyUI, MPS) | about 21 min | about 30 GB | No audio; mostly ignores camera directions. |
| Wan 2.1 1.3B fp16 (ComfyUI, MPS) | about 59 min | about 34 GB | Worst pictures; not worth it. |
| FLUX.2 klein 4B 4-bit (mflux), image | 26 s per 1024 px image | 12.5 GB | Reference images and looks. |
| Kokoro 82M (mlx-audio), speech | about 3 s per line | under 7 GB | Clean and accurate. |
| F5-TTS (MLX), voice cloning | 17 to 26 s per line | about 2.6 GB | Recognisable, not identical; weights non-commercial. Needs mlx below 0.23. |
| ACE-Step 1.5 (MIT), music | 34 to 46 s per 30 s piece (1.7B planner); xl 110 to 124 s | 46 to 48 GB footprint, mostly MLX's buffer cache (xl 58 GB); the cache can be limited | Rated 3.7 of 5 with the 1.7B planner, 2.6 without it; the slower sft and large xl variants were not clearly better. The tense cue often missed its mood. |
| MusicGen small and medium, music | 82 s for 30 s | 5.9 GB | Rated 2.5 to 2.8, no vocals, non-commercial weights: not recommended. |
| Real-ESRGAN 2x (MPS) | about 18 s | 2.6 GB | Sharpens only; visibly softer than a direct render. |

- **Plan 10b numbers** (LTX 2.3 distilled): a half-resolution draft takes about 70 s (4 steps 42 s, 2 steps 28 s); the
  refine stage about 107 s, so draft plus refine (about 177 s) is no faster than a direct render. 2-step drafts were
  unreadable; edge-only drafts show framing but not acting; flat-colour blocks show nothing useful.
- **Seeds matter**: the same shot at three seeds varied from 2 to 5 out of 5 on identity, so "make several, pick one" is
  worth supporting. The same seed keeps the draft's framing and movement.
- **Licences**: MiniMax H3 terms are disputed between sources (region limits); a human read and approved them for
  testing only. Check again before shipping or recommending it. F5-TTS and MusicGen weights are non-commercial.

## Rules for adding a provider

1. Manifest includes license/terms URL; app shows it before first use.
2. Implement against the shared contract test-suite (`packages/providers/contract`), including mock-server replay.
3. Never hard-code prices; read from provider response or a user-editable pricing table, flag as estimate.
4. Keys go to the OS keychain; never logged, never stored in the project folder.

## Implementation notes (plan 03)

- **Where things live:** `Capability`, `GenerationRequest` and `Estimate` are schemas in `core` (jobs persist them); the
  `Provider` interface, limits, registry, plug-in loader and mock live in `packages/providers`. Reference-budgeting is
  `selectReferences` (role priority: face, body, outfit, place, prop, style, mood, samples; ties keep caller order) and
  `checkRequestLimits`, which `estimate` uses so over-limit requests fail before any network call.
- **Idempotent submit:** the queue passes the job id as `idempotencyKey`; submitting twice returns the same remote ref.
  `poll` must work for refs from an earlier app run. Errors are `ProviderError(message, retryable)`.
- **Manifest** has `paid` and `local` flags; the queue uses `paid` to demand a budget cap. Secrets are config fields of
  type `secret`, resolved from the keychain by the app, never stored in the project.
- **Plug-ins** (`loadPlugins`): a folder with `plugin.json` (manifest + `entry`) and a JS module whose default export is
  `(config) => Provider`. They run with the app's permissions, so they load only from a folder the user placed them in;
  one broken plug-in is reported in `failures` and never blocks the others. Entry paths cannot leave their folder.
- **Contract suite:** `describeProviderContract` (import from `@tapestry/providers/testing`) runs every `CONTRACT_CHECKS`
  rule against an adapter fixture; a meta-test proves a deliberately broken adapter fails it. New adapters must call it.
- **Mock provider:** deterministic by request (same request, same bytes), configurable `pollsUntilDone` and `failure`
  (`transient`/`permanent`), state in an injectable `MockStore` (share one to simulate an app restart). Output is real
  media: a gradient PNG, a sine-tone WAV, and an embedded 1-second 128x72 H.264 MP4 test pattern (6.5 KB, generated once
  with ffmpeg; the command is in `mock/placeholder-video.ts`), so review screens and e2e tests can play it.
- **Outputs are in-memory bytes** (`ProviderOutput.bytes`); fine for the mock. Large real videos may need a streaming or
  temp-file variant when the first real adapter (plan 11) shows what is needed.
- `FsPort` also has `readBytes`/`writeBytes` for binary media.
