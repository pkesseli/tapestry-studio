#!/bin/sh
# Renders one cue from spikes/music/cues.json through bench.mjs, so every music run is timed and recorded.
# Run from the repository root:
#
#   sh spikes/mac/scripts/music-cue.sh acestep <turbo|sft|xl-turbo> <none|0.6B|1.7B|4B> <cue> [seed]
#   sh spikes/mac/scripts/music-cue.sh musicgen <small|medium> - <cue> [seed]
#
# MusicGen has no lyrics input and is trained on 30 s, so it renders every cue as at most 30 s from the caption.
set -e
tool=$1; model=$2; lm=$3; cue=$4; seed=${5:-1}
out=spikes/mac/results/out/music
mkdir -p "$out"
field() { node -e 'const c=require("./spikes/music/cues.json").cues.find((x)=>x.id===process.argv[1]);
  console.log(c[process.argv[2]] ?? "")' "$cue" "$1"; }
seconds=$(field seconds)
case $tool in
  acestep)
    label=acestep-$model-lm$lm-$cue-s$seed
    node spikes/bench.mjs --candidate ace-step-mlx --label "$label" --out "$out/$label.wav" \
      --meta dit="$model" --meta lm="$lm" --meta cue="$cue" --meta seconds="$seconds" --meta seed="$seed" -- \
      caffeinate -i "$HOME/tapestry-spikes/ace-step/src/.venv/bin/python" spikes/mac/scripts/acestep_cue.py \
      --cue "$cue" --dit "$model" --lm "$lm" --seed "$seed" --out "$out/$label.wav" ;;
  musicgen)
    label=musicgen-$model-$cue-s$seed
    [ "$seconds" -gt 30 ] && seconds=30
    node spikes/bench.mjs --candidate musicgen --label "$label" --out "$out/$label.wav" \
      --meta model="musicgen-$model" --meta cue="$cue" --meta seconds="$seconds" --meta seed="$seed" -- \
      caffeinate -i "$HOME/tapestry-spikes/musicgen/.venv/bin/python" spikes/mac/scripts/musicgen.py \
      --model "facebook/musicgen-$model" --prompt "$(field caption)" --seconds "$seconds" --seed "$seed" \
      --out "$out/$label.wav" ;;
  *) echo "unknown tool: $tool" >&2; exit 2 ;;
esac
