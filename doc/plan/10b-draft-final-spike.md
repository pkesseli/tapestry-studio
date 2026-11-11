# 10b — Spike: cheap drafts, then conditioned finals (human-run)

Numbered 10b because it needs the results of plan 10 (what runs on the Mac) and must come before plans 17 and 09's
staged review. Do not start it before plan 10 has a results table.

## Needs human
Runs on the target MacBook Pro (M4 Pro, 20-core GPU, 48 GB). The agent prepares scripts and the report template; the
human runs them and rates clips. The non-technical reviewer rates drafts in step 5. Budget: local only. A remote variant
needs an explicit hard budget cap in config first (spend rule); skip it by default.

## Prepared
Procedure and fixed inputs are in `spikes/draft-final/` (`README.md`, `shots.json` with the ten test shots). Clips are
registered with `spikes/bench.mjs`, measured with `spikes/measure.mjs`, rated on a local page (`spikes/rate/serve.mjs`) and
summarised by `spikes/summarize.mjs`, which applies the decision rule below from the ratings.

## Why
`providers.md` currently says "render once, enhance later; not draft locally, re-render remotely", because different models
produce different films. The idea to test: a **cheap draft** a person can pre-review, then **finals conditioned on the
accepted draft** (its depth, edges or pose, plus reference images), so the final keeps composition, motion and
identity. Plain super-resolution only sharpens what exists; it cannot fix a wrong face or jittery motion.
If the idea fails, `providers.md` stays as it is and plan 17 is only a plain upscaler.

## Design to validate (not to build yet)
- A shot has **stages** (draft, final). Each stage has any number of **candidates**; at most one is accepted per stage.
- Accepting a draft means "make this shot like this", not "this is the footage". Accepting a final freezes it, as today.
- A final records its source draft, seed and settings. Making `n` finals multiplies the cost by `n`, shown before it
  runs and counted against the budget cap. On the Mac they queue one after another.
- Redoing a draft marks existing finals "made from an older draft" and keeps them. Accepted finals stay frozen.

## Steps
1. Using plan 10's results, pick the fastest local model that is acceptable as a draft generator, and any local
   upscaler / video-to-video / control-conditioned workflow that runs (ComfyUI on MPS, mlx-video). Record versions.
2. Make 10 drafts from the Demo Film shots (a mix: static, camera move, two people, a spoken line).
3. For every draft, run each available final path and record seconds, peak memory and failures:
   - A. plain 2x upscale (Real-ESRGAN-style), as the control;
   - B. same-model refine with the draft as the starting video, low to medium strength;
   - C. re-render conditioned on structure extracted from the draft (depth, edges or pose) plus reference images;
   - D. a different model, conditioned the same way (tests the "different models make different films" claim).
4. Make 3 finals per path with different seeds for 3 of the shots: do they stay faithful but differ enough to choose from?
5. Draft legibility: show the human and the non-technical reviewer the same shots as (i) a normal low-fidelity draft and
   (ii) a structure-only draft (wireframe or flat colour). Can they judge acting, mood and framing?
6. Human fills `spikes/draft-final/results.md`: per clip and path, a 1-5 rating for composition kept, motion kept,
   identity kept and flicker; plus time and memory. Agent adds simple measurements where cheap (frame difference at low
   resolution, face-embedding similarity).
7. Agent writes the findings into `providers.md` ("Measured on M4 Pro 48 GB", dated) and replaces the draft-versus-final
   sentence with the result.

## Decision rule (proposal; the human confirms the thresholds)
Adopt the staged model if some path keeps composition, motion and identity at 4 or more out of 5 for at least 8 of 10
shots, a final takes at most about 10 minutes locally, and the reviewer can judge the draft. Otherwise keep "render once,
enhance later". Mixed results: adopt for shots where it works and say so in the app.

## Acceptance
- Results table complete for at least 10 shots across paths A to C, and the legibility check done.
- `providers.md` updated with measured facts; the decision recorded.
- If adopted: a new plan describes the stage and candidate model in `project-format.md` (schema, migration, tests), the
  shot panel's Draft to Final strip, and the "Make n finals" cost estimate. If not: plan 17 is narrowed to upscaling.

## On completion
Keep `spikes/draft-final/` scripts if re-runnable. Delete this plan file.
