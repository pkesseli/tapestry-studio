#!/bin/sh
# Renders one shot with MiniMax H3 (unsloth Q8_0 GGUF, Q4_K_M text encoder) through stable-diffusion.cpp's sd-cli on
# Metal, timed by bench.mjs (suite mac). Run from the repository root:
#
#   sh spikes/mac/scripts/h3-shot.sh <t2v|r2v> <turbo|full> <shot> [seed]
#
# t2v uses the FL2VA model with text only; r2v uses the Ref2VA model with the shot's reference images from
# spikes/draft-final/inputs (the identity test), named <Picture n> in the prompt. full = 20 steps (sd-cli's default);
# turbo = MiniMax's distilled LoRA with 6 (t2v) or 4 (r2v) steps, as in ComfyUI's MiniMax H3 templates. Output:
# spikes/mac/results/out/minimax-h3-<mode>-<speed>-<shot>-s<seed>.webm as timed, plus an .mp4 copy (git ignores out/).
set -e
mode=$1; speed=$2; shot=$3; seed=${4:-1}
h3=$HOME/tapestry-spikes/comfyui/src/models
label=minimax-h3-$mode-$speed-$shot-s$seed
out=spikes/mac/results/out/$label.mp4
prompt=$(node spikes/mac/scripts/shot-prompt.mjs "$shot")
set --
if [ "$mode" = r2v ]; then
  unet=minimax_h3_ref2va_pruned-Q8_0.gguf; lora=minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16; turbo_steps=4
  i=1
  for ref in $(node -e 'console.log(require("./spikes/draft-final/shots.json").shots.find((s)=>s.id===process.argv[1]).uses.join(" "))' "$shot"); do
    name=$(node -e 'const r=process.argv[1]; console.log(r==="ferry-deck"?"the ferry deck":r[0].toUpperCase()+r.slice(1))' "$ref")
    prompt="$prompt <Picture $i> is $name."
    set -- "$@" -r "spikes/draft-final/inputs/$ref.png"
    i=$((i + 1))
  done
  [ $i -gt 1 ] || { echo "$shot has no reference images" >&2; exit 2; }
else
  unet=minimax_h3_fl2va_pruned-Q8_0.gguf; lora=minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16; turbo_steps=6
fi
steps=20
[ "$speed" = turbo ] && { steps=$turbo_steps; prompt="$prompt <lora:$lora:1>"; }
webm=spikes/mac/results/out/$label.webm
node spikes/bench.mjs --suite mac --candidate minimax-h3-gguf --shot "$shot" --label "$label" --timeout-min 240 \
  --meta mode="$mode" --meta speed="$speed" --meta steps="$steps" --meta quant=Q8_0 --meta textEncoder=Q4_K_M \
  --meta resolution=832x480 --meta frames=107 --meta seed="$seed" --meta runtime=stable-diffusion.cpp --out "$webm" -- \
  caffeinate -i "$HOME/tapestry-spikes/sdcpp/build/bin/sd-cli" -M vid_gen --diffusion-model "$h3/unet/$unet" \
  --vae "$h3/vae/minimax_h3_video_vae_fp16.safetensors" --audio-vae "$h3/vae/minimax_h3_audio_vae_fp32.safetensors" \
  --llm "$h3/text_encoders/qwen3vl_32b_minimax_h3-Q4_K_M.gguf" --lora-model-dir "$h3/loras" \
  -p "$prompt" "$@" --cfg-scale 1.0 -W 832 -H 480 --fps 24 --video-frames 107 --steps "$steps" -s "$seed" \
  --rng cpu --params-backend disk --mmap --vae-tiling -v -o "$webm"
# Timed above is sd-cli alone, so bench records its memory; the mp4 copy is for the rating page and contact sheets.
ffmpeg -loglevel error -y -i "$webm" -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k "$out"
