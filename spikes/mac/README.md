# Plan 10 procedure: what runs on this Mac

Goal: for every candidate in `candidates.json`, find out **does it run, how fast, how much memory, how good is it**.
Candidates are ordered by `priority` within each kind. The target machine is a MacBook Pro M4 Pro, 20-core GPU, 48 GB
(`results/system.json` shows what this one is).

Known from searching (UNVERIFIED, from blogs and model pages, 2026-11-11):

- ComfyUI on Apple Silicon uses PyTorch MPS, not MLX. **FP8 checkpoints fail on Metal**; use GGUF or fp16 builds.
- One report: a Wan 2.2 14B GGUF took about 82 minutes for a 2-second clip on an M1 Max 64 GB. Expect some candidates
  to be unusably slow; the timeout exists for that.
- The full LTX-2.3 is about 66 GB; the 4-bit build is listed for 32 GB machines. The M4 Pro has less memory bandwidth
  than the Max chips, so speeds from other people's machines are optimistic.
- The 4x Real-ESRGAN model is very slow (seconds per frame); 2x is not.

## Order of work

1. `node spikes/system-info.mjs` and read the output. Check free disk.
2. **Image model first** (`flux2-klein-mflux`): it also makes the three reference images for plan 10b
   (`../draft-final/inputs/`, see `../draft-final/shots.json`). Small images may be committed (under 1 MB each, resize
   with `ffmpeg -i in.png -vf scale=768:-1 out.png` if needed).
3. **Video candidates** in priority order. For each one:
   1. Read the licence and record its key terms in `findings.json`; ask the human only in the cases listed in
      `../README.md`.
   2. Install it in its own folder and virtual environment. Write each command that worked into `INSTALL-LOG.md`.
   3. Run the **smoke shots** (`S01`, `S02`, `S05` from `../draft-final/shots.json`) through `bench.mjs`.
   4. If they work, run all ten. If the first smoke shot fails twice for the same reason, stop and record the reason.
4. **Speech** (`kokoro-mlx`, then `f5tts-mlx`) and **music** (`ace-step-mlx`, then `musicgen`): one short test each.
   Listen to the result (or ask the human to) and write down if it is audible, clean, and in the right language.
5. **Upscale controls** (`ffmpeg-lanczos`, `realesrgan-2x`) on one video, to learn speed (these are used by plan 10b).
6. Fill `results/findings.json`, run `node spikes/report.mjs`, commit.

## Running something measured

```sh
node spikes/bench.mjs --candidate ltx23-mlx-q4 --shot S01 \
  --meta resolution=832x480 --meta seconds=4 --meta steps=8 --meta quant=q4 \
  --out spikes/mac/results/out/ltx23-S01.mp4 \
  -- <the command you would normally type, one argument per word>
```

- Everything after `--` is the command. Use absolute paths to the virtual environment's Python so no shell state is
  needed (`~/tapestry-spikes/ltx/.venv/bin/python -m ...`).
- `--out` is the file the command should create. A run that exits cleanly without it counts as `no-output`.
- Results land in `results/runs.jsonl`; the output video goes to `results/out/`, which git ignores.
- Default timeout is 45 minutes (`--timeout-min`). Raise it only for one deliberate long run, and say why in `--note`.
- Run the **same shot twice** for the best candidate (the first run includes loading the model from disk; the second
  shows the steady speed). Label them `--meta run=cold` and `--meta run=warm`.
- Do not run two heavy jobs at once: it ruins the memory and time numbers.

## What to look at in the output

Watch each video. For `findings.json` write down, per candidate, in plain words:

- Does the picture match the prompt (people, place, camera move)? Is motion smooth? Faces and hands?
- Any obvious artefacts (flicker, melting, text garbage)? Is there audio, and is it usable?
- Is 4 seconds enough, or does quality fall apart after 2?

## `results/findings.json`

An object keyed by candidate id. Every field is optional; the report uses what is there.

```json
{
  "ltx23-mlx-q4": {
    "runs": "yes",
    "blockers": "",
    "quality": "Good composition, faces soft; hands melt after 3 s.",
    "licence": "What the model card says in one sentence, and the date it was read.",
    "notes": "Cold start 90 s, warm 4 min for 4 s at 832x480."
  }
}
```

`runs` is `"yes"`, `"partly"`, `"no"` or `"not tried"`. If you leave it out the report decides from `runs.jsonl`.

## Done when (plan 10 acceptance)

- At least **three video candidates** have an honest verdict, and one candidate each of image, speech and music ran.
  `results.md` has an acceptance section that counts this for you.
- `INSTALL-LOG.md` lets someone repeat the best run from scratch.
- A short "recommended local defaults" paragraph in `results/findings.json` under the key `"summary"` (or "none yet;
  remote-only for video"), with the reason in two or three sentences. `results.md` prints it.
