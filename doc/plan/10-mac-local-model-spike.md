# 10 — Spike: what actually runs on the target MacBook (human-run)

## Needs human
This must be executed on the target MacBook Pro (M4 Pro, 20-core GPU, 48 GB; record the exact figures). An agent prepares scripts and the report template; the
human runs them. Budget: free (local only).

## Prepared
Everything the Mac session needs is in `spikes/`: start at `spikes/README.md`, procedure in `spikes/mac/README.md`,
candidates (with sources, all UNVERIFIED) in `spikes/mac/candidates.json`. Runs are recorded by `spikes/bench.mjs`;
`node spikes/report.mjs` builds the results table. Steps 1 to 4 below are done by following those files.

## Goal
Replace guesses in `doc/readme/providers.md` with measurements, and decide the local-model strategy.

## Steps
1. Agent writes `spikes/mac/README.md` with install steps for ComfyUI on macOS (Apple Silicon, PyTorch MPS) and a script
   that records chip, RAM, macOS version, ComfyUI version.
2. Candidates, in order: LTX 2.3 (small/quantised), Wan 2.2 5B, HunyuanVideo 1.5, MiniMax H3 INT8/GGUF (check its license
   text first), one image model for character looks, one speech model, one music model (ACE-Step / MusicGen).
3. For each: does it run at all? seconds to first clip at 480p/720p, 3-5 s length, peak memory, visible quality, notes on
   failures (unsupported ops, CUDA-only kernels).
4. Human fills `spikes/mac/results.md` (table) and shares it.
5. Agent summarises into `providers.md` under a dated "Measured on M4 (RAM)" section, and writes the recommended local
   defaults (or "none yet; remote-only for video").

## Acceptance
- Results table complete for at least 3 video candidates and 1 each of image/speech/music.
- `providers.md` updated with measured facts, replacing the corresponding UNVERIFIED claims.

Plan 10b (draft and final stages) builds on this table.

## On completion
Keep `spikes/mac/` scripts if re-runnable; delete this plan file.
