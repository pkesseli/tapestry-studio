#!/bin/sh
# Makes one plan 10b clip through bench.mjs (suite draft-final), so every clip is timed and registered in the
# manifest with the names spikes/draft-final/README.md uses. Run from the repository root:
#
#   sh spikes/mac/scripts/draft-final.sh <step> <shot> [seed]
#
# Steps:
#   draft     D-<shot>-normal: LTX 2.3 stage 1 only (416x224, 97 frames, seed 1) plus its saved latent
#   draft-steps<n>, B-steps<n>   a draft with n (1-7) of the 8 stage-1 steps, and its final with 3 refine steps
#   edges     D-<shot>-edges: edges of the draft (also the control video for C and D)
#   blocks    D-<shot>-blocks: the draft as flat blocks of colour
#   A0 | A1   finals: 2x Lanczos | 2x Real-ESRGAN of the draft
#   B3|B2|B1  finals: LTX stage 2 resumed from the draft latent with 3, 2 or 1 refine steps; [seed] is the stage-2 seed
#   C         final: LTX IC-LoRA Union-Control from the draft edges, full resolution, [seed]
#   D         final: Wan 2.2 Fun 5B Control from the draft edges plus the shot's first reference image, [seed]
#
# B, C and D finals are named F-<shot>-<variant>-s<seed>.
set -e
step=$1; shot=$2; seed=${3:-1}
out=spikes/draft-final/results/out
ltx=$HOME/tapestry-spikes/ltx-2-mlx
comfy_py=$HOME/tapestry-spikes/comfyui/.venv/bin/python
draft=$out/D-$shot-normal.mp4
edges=$out/D-$shot-edges.mp4
mkdir -p "$out"

# bench <candidate> <clip-id> <role> <variant> <source or -> <out> [bench options...] -- <command...>
bench() {
  candidate=$1; clip=$2; role=$3; variant=$4; source=$5; file=$6; shift 6
  set -- --suite draft-final --candidate "$candidate" --shot "$shot" --label "$clip" --clip-id "$clip" \
    --role "$role" --variant "$variant" --out "$file" "$@"
  [ "$source" = - ] || set -- --source "$source" "$@"
  node spikes/bench.mjs "$@"
}

case $step in
  draft|draft-steps[1-7])
    # draft-steps<n>: a cheaper draft with n of the 8 stage-1 steps, D-<shot>-steps<n>; B-steps<n> finishes it.
    n=8; variant=normal
    [ "$step" = draft ] || { n=${step#draft-steps}; variant=steps$n; }
    file=$out/D-$shot-$variant.mp4
    bench ltx23-stage-split "D-$shot-$variant" draft "$variant" - "$file" \
      --meta resolution=416x224 --meta seconds=4 --meta frames=97 --meta steps="$n" --meta seed=1 --meta quant=q4 -- \
      caffeinate -i "$ltx/.venv/bin/python" spikes/mac/scripts/ltx_stage.py draft --seed 1 --stage1-steps "$n" \
      --prompt "$(node spikes/mac/scripts/shot-prompt.mjs "$shot")" --out "$file" ;;
  B-steps[1-7])
    variant=${step#B-}
    bench ltx23-stage-split "F-$shot-$step-s$seed" final "$step" "D-$shot-$variant" "$out/F-$shot-$step-s$seed.mp4" \
      --meta resolution=832x448 --meta stage2steps=3 --meta seed="$seed" -- \
      caffeinate -i "$ltx/.venv/bin/python" spikes/mac/scripts/ltx_stage.py final --draft "$out/D-$shot-$variant.mp4" \
      --stage2-steps 3 --seed "$seed" --out "$out/F-$shot-$step-s$seed.mp4" ;;
  edges)
    bench ffmpeg-structure "D-$shot-edges" draft edges "D-$shot-normal" "$edges" -- \
      ffmpeg -loglevel error -y -i "$draft" -vf "edgedetect=low=0.1:high=0.3,format=yuv420p" -an "$edges" ;;
  blocks)
    bench ffmpeg-structure "D-$shot-blocks" draft blocks "D-$shot-normal" "$out/D-$shot-blocks.mp4" -- \
      ffmpeg -loglevel error -y -i "$draft" -vf "scale=48:-2:flags=neighbor,scale=416:-2:flags=neighbor,format=yuv420p" \
      -c:a copy "$out/D-$shot-blocks.mp4" ;;
  A0)
    bench ffmpeg-lanczos "F-$shot-A0" final A0 "D-$shot-normal" "$out/F-$shot-A0.mp4" --meta resolution=832x448 -- \
      ffmpeg -loglevel error -y -i "$draft" -vf "scale=iw*2:ih*2:flags=lanczos" -c:v libx264 -crf 18 -pix_fmt yuv420p \
      -c:a copy "$out/F-$shot-A0.mp4" ;;
  A1)
    bench realesrgan-2x "F-$shot-A1" final A1 "D-$shot-normal" "$out/F-$shot-A1.mp4" --meta resolution=832x448 -- \
      caffeinate -i "$comfy_py" spikes/mac/scripts/realesrgan.py --in "$draft" --out "$out/F-$shot-A1.mp4" ;;
  B3|B2|B1)
    steps=${step#B}
    bench ltx23-stage-split "F-$shot-$step-s$seed" final "$step" "D-$shot-normal" "$out/F-$shot-$step-s$seed.mp4" \
      --meta resolution=832x448 --meta stage2steps="$steps" --meta seed="$seed" -- \
      caffeinate -i "$ltx/.venv/bin/python" spikes/mac/scripts/ltx_stage.py final --draft "$draft" \
      --stage2-steps "$steps" --seed "$seed" --out "$out/F-$shot-$step-s$seed.mp4" ;;
  C)
    bench ltx23-iclora-union "F-$shot-C-s$seed" final C "D-$shot-normal" "$out/F-$shot-C-s$seed.mp4" \
      --meta resolution=832x448 --meta control=edges --meta lora=unfused --meta seed="$seed" -- \
      env LTX2_LORA_MODE=unfused caffeinate -i "$ltx/.venv/bin/ltx-2-mlx" ic-lora --model "$ltx/models/ltx-2.3-mlx-q4" \
      --lora "$ltx/models/ic-lora-union/ltx-2.3-22b-ic-lora-union-control-ref0.5.safetensors" 1.0 \
      --video-conditioning "$edges" 1.0 -H 448 -W 832 -f 97 --frame-rate 24 --seed "$seed" \
      --prompt "$(node spikes/mac/scripts/shot-prompt.mjs "$shot")" -o "$out/F-$shot-C-s$seed.mp4" ;;
  D)
    ref=$(node -e 'const s=require("./spikes/draft-final/shots.json").shots.find((x)=>x.id===process.argv[1]);
      const r=s.uses[0]; if(r) console.log(`spikes/draft-final/inputs/${r}.png`)' "$shot")
    bench wan22-fun-5b-control "F-$shot-D-s$seed" final D "D-$shot-normal" "$out/F-$shot-D-s$seed.mp4" \
      --meta resolution=832x448 --meta control=edges --meta ref="${ref:-none}" --meta seed="$seed" -- \
      caffeinate -i node spikes/mac/scripts/comfy-wan.mjs --model wan22-fun-5b-control --shot "$shot" \
      --width 832 --height 448 --seed "$seed" --control "$edges" ${ref:+--ref "$ref"} \
      --out "$out/F-$shot-D-s$seed.mp4" ;;
  *) echo "unknown step: $step" >&2; exit 2 ;;
esac
