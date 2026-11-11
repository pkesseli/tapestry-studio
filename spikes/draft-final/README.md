# Plan 10b procedure: cheap drafts, then conditioned finals

Question: can a quick, low-quality **draft** that a person approves be turned into a **final** that keeps what was
approved (framing, movement, who is in it)? Read `doc/plan/10b-draft-final-spike.md` for the reasoning and the decision
rule; `lib/summary.mjs` implements that rule so the verdict is computed, not guessed.

Do plan 10 first (`../mac/README.md`): you need to know which local video model is usable as the draft model.

## The inputs are fixed

- `shots.json` — ten test shots (`S01`..`S10`) with fixed prompts. Use them exactly; the comparison is only meaningful
  if every model and path got the same prompts. `smoke` lists the three used in plan 10.
- `inputs/maria.png`, `tom.png`, `ferry-deck.png` — reference images (made with the image model in plan 10 from the
  briefs in `shots.json`). Shots list which ones they use in `uses`.

## Clips and names

Every video that takes part is registered in `results/manifest.json`, by passing the clip flags to `bench.mjs`. Naming:

| Clip id | Meaning |
|---|---|
| `D-S01-normal` | Draft of shot S01, a normal low-fidelity render from the draft model |
| `D-S01-edges` | Same draft reduced to its structure (edges) |
| `D-S01-blocks` | Same draft reduced to flat blocks of colour |
| `F-S01-A0` | Final: plain 2x Lanczos resize of the draft (control) |
| `F-S01-A1` | Final: Real-ESRGAN 2x |
| `F-S01-B-s1` | Final: refine started from the draft video (seed 1) |
| `F-S01-C-s1` | Final: re-render conditioned on structure taken from the draft plus reference images (seed 1) |
| `F-S01-D-s1` | Final: a different model than the draft, conditioned the same way as C |

A final always has `--source <its draft clip id>`.

## Steps

All commands are run from the repository root. Output videos go under `spikes/draft-final/results/out/` (git ignores it).

1. **Drafts.** For each of the ten shots, with the draft model from plan 10 at its cheapest sensible setting (smallest
   resolution, fewest steps, 4 seconds):

   ```sh
   node spikes/bench.mjs --suite draft-final --candidate ltx23-mlx-q4 --shot S01 \
     --clip-id D-S01-normal --role draft --variant normal \
     --meta resolution=832x480 --meta seconds=4 --meta steps=8 --meta seed=1 \
     --out spikes/draft-final/results/out/D-S01-normal.mp4 \
     -- <command that makes it>
   ```

   Replace the candidate and command with what worked in plan 10.

2. **Structure-only drafts** (free, for the legibility question) for at least five shots:

   ```sh
   node spikes/bench.mjs --suite draft-final --candidate ffmpeg-structure --shot S01 \
     --clip-id D-S01-edges --role draft --variant edges --source D-S01-normal \
     --out spikes/draft-final/results/out/D-S01-edges.mp4 \
     -- ffmpeg -y -i spikes/draft-final/results/out/D-S01-normal.mp4 -vf "edgedetect=low=0.1:high=0.3,format=yuv420p" spikes/draft-final/results/out/D-S01-edges.mp4
   ```

   For blocks use `-vf "scale=48:-2:flags=neighbor,scale=832:-2:flags=neighbor,format=yuv420p"`.
   (`--source` on a draft is allowed and records where it came from.)

3. **Finals, path A (controls).** `ffmpeg-lanczos` (`A0`) and `realesrgan-2x` (`A1`) on every normal draft. The timing
   is the time of the upscale step only.
4. **Finals, paths B, C, D.** Find a workflow that works (this is the discovery part: write what you tried and what
   failed in `../mac/INSTALL-LOG.md`). Make them for all ten shots if one works; if it only works for some, say so.
   B starts from the draft video at low to medium strength (try 0.3 and 0.6 and keep the better as variant `B`).
   C and D take structure (depth, edges or pose) extracted from the draft plus the reference images from `inputs/`.
5. **Seeds.** For shots `S02`, `S05`, `S08` make three seeds (`-s1`, `-s2`, `-s3`) of each of B, C (and D if it works):
   do they stay faithful yet differ enough to choose between?
6. **Measure.** `node spikes/measure.mjs measures` then `node spikes/measure.mjs previews`. Needs `ffmpeg`.
7. **Rating session** (human): `node spikes/rate/serve.mjs`, open <http://localhost:4173>. Two people should rate if
   possible, the human and the non-technical reviewer, each with their own name. About 30 to 45 minutes. Answers are
   saved as they click. Versions are shown in a mixed order with neutral names; nobody sees how a clip was made.
8. **Summary.** `node spikes/summarize.mjs` writes `results/summary.md` with the verdict by the proposed rule.
   Add two paragraphs of your own at the top: what surprised you, and what you would try next.

## Notes on judging

- Looking at the draft first, then the versions, is the natural way; the page does that.
- The `smooth` and `identity` scores matter most for the target user: a final that keeps the framing but changes the
  face is a failure for a film with recurring characters.
- Record anything odd in `--note` when running, for example "needed 40 GB, everything else closed".

## Done when

- Drafts for all ten shots, finals for paths A and at least one of B, C or D for all ten shots, and the legibility check
  (`edges` or `blocks` drafts rated) are in the manifest.
- `results/summary.md` exists with at least one rater, and `measures.json` and `previews/` are committed.
- The verdict (adopt the staged model, adopt for some shots, or keep "render once, enhance later") is written at the
  top of `summary.md` in plain words.
