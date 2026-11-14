#!/bin/sh
# Renders one shot with LTX-2.3 int4 (ltx-2-mlx, distilled pipeline) through bench.mjs, kept awake by caffeinate.
# Usage, from the repository root: sh spikes/mac/scripts/ltx-shot.sh <shot> <run label: cold|warm> [extra bench args]
# Settings match the plan 10 smoke runs: 832x480 requested (the model rounds the height to 448), 97 frames, seed 1.
set -e
shot=$1; run=$2; shift 2
ltx=$HOME/tapestry-spikes/ltx-2-mlx
out=spikes/mac/results/out/ltx23-q4-$shot-$run.mp4
node spikes/bench.mjs --candidate ltx23-ltx2mlx-q4 --label "ltx23-q4-$shot-$run" --shot "$shot" \
  --meta resolution=832x448 --meta seconds=4 --meta frames=97 --meta pipeline=distilled --meta steps=8+3 \
  --meta quant=q4 --meta seed=1 --meta run="$run" --out "$out" "$@" -- \
  caffeinate -i "$ltx/.venv/bin/ltx-2-mlx" generate --distilled --model "$ltx/models/ltx-2.3-mlx-q4" \
  -H 480 -W 832 -f 97 --frame-rate 24 --seed 1 --prompt "$(node spikes/mac/scripts/shot-prompt.mjs "$shot")" -o "$out"
