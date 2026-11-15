# Install log

The exact commands that worked, per candidate, in the order they were run, so a run can be repeated on a clean machine.
Write each entry while you do it, not afterwards. Include versions (`pip freeze | head`, commit hashes, model file names
and sizes). A failed attempt belongs here too, with the error message and what you changed.

<!-- Template, copy for each candidate:

## <candidate id> — <date>

- Folder: ~/tapestry-spikes/<name>/
- Environment: python 3.x in .venv, `pip install ...`
- Weights: <file name>, <size>, from <url>, licence terms read: <yes/no, summary>
- Commands that worked:

      <command>

- Did not work: <what, error text, fix>
- Settings that mattered: <resolution, steps, quantisation, ...>
-->

## Tooling — 2026-11-12

- System Python is 3.15.2; ML wheels (mlx, torch) target 3.11–3.13, so every venv uses Python 3.12 from uv.
- `brew install uv` → uv 0.13.7. Venvs: `uv venv --python 3.12 .venv`, installs: `uv pip install --python .venv/bin/python ...`.
- Hugging Face downloads go to `~/.cache/huggingface/hub` (outside the repository).
- Did not work: the first FLUX.2 klein download stalled and died after 3 h 23 min at 7.7 GB with
  `RuntimeError: ... CAS Client Error: ... error sending request for url (https://us.aws.cdn.hf.co/xorbs/...)`
  (Xet CDN). A plain re-run resumes; measured link speed right after was 34 MB/s. Pre-fetch weights with
  `.venv/bin/hf download <repo>` so the timed runs do not include the download.

## flux2-klein-mflux — 2026-11-12

- Folder: ~/tapestry-spikes/mflux/
- Environment: python 3.12 in .venv, `uv pip install --python .venv/bin/python mflux` → mflux 0.24.0, mlx 0.32.4,
  torch 2.15.0 (pulled in by mflux).
- Weights: `black-forest-labs/FLUX.2-klein-4B` (not gated), quantised to 4 bit at load time with `--quantize 4`.
  Licence read 2026-11-12: Apache-2.0.
- Commands:

      ~/tapestry-spikes/mflux/.venv/bin/hf download black-forest-labs/FLUX.2-klein-4B
      ~/tapestry-spikes/mflux/.venv/bin/mflux-generate-flux2 --model flux2-klein-4b --quantize 4 \
        --prompt "<brief>" --width 1024 --height 1024 --seed 1 --output <file>.png

## ltx23-mlx-q4 — 2026-11-12 (blocked, see ltx23-ltx2mlx-q4)

- `gajesh/ltx-2.3-mlx-q4` (37.2 GB, not gated) documents only `from mlx_ltx.pipeline import DistilledPipeline`.
  `mlx_ltx` is not on PyPI and no source repository could be found (a user on the model's discussion page reports the
  same). Not downloaded. The working MLX route for LTX-2.3 is `dgrauet/ltx-2-mlx` (MIT, commit 747b30e,
  2026-11-01) with its own packs `dgrauet/ltx-2.3-mlx-q4` (55.6 GB full repo; the distilled pipeline needs about
  20 GB of it: `transformer-distilled-1.1`, `connector`, VAE, `spatial_upscaler_x2_v1_1`, audio VAE, vocoder) plus
  `mlx-community/gemma-3-12b-it-4bit` as text encoder. ltx-2-mlx is not on PyPI; it installs from its git checkout.
- `Blaizzy/mlx-video` (MIT, commit 87db56a) supports LTX-2.3 but quantises only the text encoder, not the
  transformer, so it cannot load a 4-bit transformer.

- Result: 4 steps by default, 26 s per 1024 px image, peak 9.0 GB. The prompts were the `brief` fields of
  `spikes/draft-final/shots.json`, seed 1. Copies for plan 10b: `ffmpeg -i out/<id>.png -vf scale=768:-1 inputs/<id>.png`.

## kokoro-mlx — 2026-11-12

- Folder: ~/tapestry-spikes/mlx-audio/ (shared with other mlx-audio models)
- Environment: python 3.12 in .venv, `uv pip install --python .venv/bin/python mlx-audio "misaki[en]"` →
  mlx-audio 0.6.5, mlx 0.32.4. Without misaki: `Kokoro requires the optional 'misaki' package`. The first run
  downloads the spaCy model `en_core_web_sm` by itself.
- Weights: `mlx-community/Kokoro-82M-bf16` (Apache-2.0, not gated).
- Commands:

      .venv/bin/python -m mlx_audio.tts.generate --model mlx-community/Kokoro-82M-bf16 \
        --text "Is anyone there?" --voice af_heart --lang_code a --output_path <dir> --file_prefix <name>
      # long text: add --join_audio; the file is then <dir>/<name>.wav (no _000 suffix)

- `--lang_code a` = US English, `b` = British English (voices bm_*/bf_*).
- Check without listening: `python -m mlx_audio.stt.generate --model mlx-community/whisper-large-v3-turbo-asr-fp16
  --audio <wav> --output-path <base> --format txt` (the plain `mlx-community/whisper-large-v3-turbo` fails with
  `Processor not found`).

## musicgen — 2026-11-12

- Folder: ~/tapestry-spikes/musicgen/
- Environment: python 3.12 in .venv, `uv pip install --python .venv/bin/python torch transformers scipy numpy` →
  torch 2.15.0, transformers 5.22.2. audiocraft was not used: it pins torch 2.1, which has no Python 3.12 wheels.
- Weights: `facebook/musicgen-small` (CC-BY-NC-4.0, not gated), `.venv/bin/hf download facebook/musicgen-small`.
- Command (from the repository root; the script is ours, not downloaded):

      ~/tapestry-spikes/musicgen/.venv/bin/python spikes/mac/scripts/musicgen.py \
        --prompt "Calm, melancholic folk instrumental for a film score: solo acoustic guitar and soft cello, slow tempo, sea at dawn" \
        --seconds 30 --seed 1 --out spikes/mac/results/out/musicgen-30s.wav

## ace-step-mlx — 2026-11-12 (not run yet)

- The listed source (`mlx-serve`) is not a music tool: the PyPI `mlx-serve` 0.3.0 is an LLM/TTS server.
- `mlx-audio` 0.6.5's `mlx_audio.music.generate` supports only MiniMax Music 3 (licence concerns, see
  `minimax-h3-gguf`), not ACE-Step.
- `ace-step` 0.1.0 on PyPI is ACE-Step v1 (3.5B, Apache-2.0), source-only with old pins (transformers 4.50,
  gradio 5.23). ACE-Step 1.5 (MIT per the Hugging Face card) installs from its git repository.

## Memory measurement — 2026-11-12

- `spikes/lib/runs.mjs` now takes `peak memory footprint` from `/usr/bin/time -l` instead of `maximum resident set
  size`: on Apple Silicon the resident size misses Metal buffers (FLUX: 9.0 GB resident, 12.5 GiB footprint).
  Earlier records in `runs.jsonl` were recomputed from their logs; `rssBytes` keeps the resident size.

## ltx23-ltx2mlx-q4 — 2026-11-14

- Folder: ~/tapestry-spikes/ltx-2-mlx/ (checkout in `src/`, weights in `models/`)
- Code: `git clone --depth 1 https://github.com/dgrauet/ltx-2-mlx.git src` → commit 747b30e (2026-11-01), MIT.
- Environment (run by the human, because auto mode blocks installing from a git checkout):

      cd ~/tapestry-spikes/ltx-2-mlx
      uv venv --python 3.12 .venv
      uv pip install --python .venv/bin/python ./src/packages/ltx-core-mlx ./src/packages/ltx-pipelines-mlx

  → ltx-core-mlx 0.18.0, ltx-pipelines-mlx 0.18.0, mlx 0.32.4, mlx-lm 0.32.2, transformers 5.23.0.
- Weights: only the files the distilled pipeline needs. A repo id as `--model` downloads the whole 55.6 GB pack, so
  pass a local folder instead. `--include "*.json"` together with file names fetched no JSON files; name them:

      .venv/bin/hf download dgrauet/ltx-2.3-mlx-q4 --local-dir models/ltx-2.3-mlx-q4 \
        transformer-distilled-1.1.safetensors connector.safetensors audio_vae.safetensors vocoder.safetensors \
        vae_decoder.safetensors vae_encoder.safetensors spatial_upscaler_x2_v1_1.safetensors \
        spatial_upscaler_x2_v1_1_config.json config.json embedded_config.json quantize_config.json split_model.json \
        LICENSE README.md
      .venv/bin/hf download mlx-community/gemma-3-12b-it-4bit

  → 19 GB pack folder + 7.5 GiB Gemma (text encoder, the CLI default `--gemma`).
- Prompt for every shot: `node spikes/mac/scripts/shot-prompt.mjs <shot>` (the shot's prompt plus its direction).
- Command (from the repository root):

      ~/tapestry-spikes/ltx-2-mlx/.venv/bin/ltx-2-mlx generate --distilled \
        --model ~/tapestry-spikes/ltx-2-mlx/models/ltx-2.3-mlx-q4 -H 480 -W 832 -f 97 --frame-rate 24 --seed 1 \
        --prompt "$(node spikes/mac/scripts/shot-prompt.mjs S01)" -o spikes/mac/results/out/ltx23-q4-S01.mp4

## wan22-5b-comfyui-gguf — 2026-11-14

- Folder: ~/tapestry-spikes/comfyui/ (checkout in `src/`, venv in `.venv/`, models in `src/models/`)
- Code: `git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git src` → commit eee5918 (2026-11-13),
  GPL-3.0 (only run as a separate program, nothing copied); `git clone --depth 1
  https://github.com/city96/ComfyUI-GGUF.git src/custom_nodes/ComfyUI-GGUF` → commit 6ea2651, Apache-2.0.
- Environment (PyPI only; ComfyUI itself is not installed, it is started with `python main.py`):

      uv venv --python 3.12 .venv
      uv pip install --python .venv/bin/python -r src/requirements.txt -r src/custom_nodes/ComfyUI-GGUF/requirements.txt

  → torch 2.15.0, transformers 5.23.0, gguf 0.19.0. ComfyUI logs `comfy-aimdo unsupported operating system: Darwin`
  (harmless) and runs on `Device: mps`, `vram state SHARED`; the text encoder runs on the CPU (ComfyUI's default).
- Weights (12.3 GB, all Apache-2.0, not gated), from `src/models`:

      hf download QuantStack/Wan2.2-TI2V-5B-GGUF Wan2.2-TI2V-5B-Q8_0.gguf --local-dir unet
      hf download city96/umt5-xxl-encoder-gguf umt5-xxl-encoder-Q8_0.gguf --local-dir text_encoders
      hf download Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/vae/wan2.2_vae.safetensors --local-dir vae

  The original `Wan-AI/Wan2.2-TI2V-5B` is 31.9 GB (fp32 transformer, `.pth` text encoder); GGUF avoids it and the FP8
  files that fail on Metal.
- Command (from the repository root): `node spikes/mac/scripts/comfy-wan.mjs --shot S01 --out <file.mp4>`. It
  starts ComfyUI on port 8199, sends the workflow (UnetLoaderGGUF, CLIPLoaderGGUF type wan, ModelSamplingSD3 shift 8,
  Wan22ImageToVideoLatent 832x480x97, KSampler 20 steps cfg 5 uni_pc/simple, VAEDecode, SaveImage), encodes the PNG
  frames at 24 fps and stops the server. Settings follow the Wan 2.2 TI2V-5B reference values.
- Result: all ten shots ran, 1234–1267 s each (about 48 s per sampling step), peak footprint 27.7–29.7 GiB. A VS
  Code crash stopped the first chain during S06; S06–S10 were re-run.
- Gotcha (fixed 2026-11-14): the driver first started ComfyUI in its own process group. When bench.mjs stopped a run
  at its time limit (SIGKILL to its group), ComfyUI survived, kept rendering and held bench's output pipe open, so the
  run never ended and no record was written. The server now shares the driver's group and is stopped with
  `pkill -INT -P <time's pid>`.

## f5tts-mlx — 2026-11-14

- Folder: ~/tapestry-spikes/f5tts/ (venv in `.venv/`; the human's recording and all outputs stay here, never in the
  repository)
- Environment (PyPI only):

      uv venv --python 3.12 .venv
      uv pip install --python .venv/bin/python f5-tts-mlx==0.2.6 "mlx<0.23"

  → mlx 0.22.1 (mlx-metal 0.32.4 is left over and does no harm). With the current mlx 0.32,
  `mx.random.normal` raises `TypeError: normal(): incompatible function arguments`.
- Weights: `lucasnewman/f5-tts-mlx` and `lucasnewman/vocos-mel-24khz`, fetched on first run (about 1.4 GB).
- Reference: the human's QuickTime recording, converted with
  `ffmpeg -i my-voice.m4a -ss 1.5 -to 7.3 -af loudnorm=I=-20 -ac 1 -ar 24000 ref.wav`, and the text exactly as spoken
  (checked with Whisper, which caught "in the morning" against the script's "every morning").
- Command:

      .venv/bin/python -m f5_tts_mlx.generate --ref-audio ref.wav --ref-text "<what the reference says>" \
        --text "Is anyone there?" --duration 7.2 --seed 1 --output out/line1-paced.wav

  `--duration` is the length of reference plus new speech (here 5.8 + 1.4 s). Without it the model guesses too short.

## wan21-1.3b-comfyui — 2026-11-14

- Same ComfyUI install and text encoder as wan22-5b-comfyui-gguf. Weights (3.1 GB, Apache-2.0 on both
  Wan-AI/Wan2.1-T2V-1.3B and the Comfy-Org repackage, not gated), from `src/models`:

      hf download Comfy-Org/Wan_2.1_ComfyUI_repackaged split_files/diffusion_models/wan2.1_t2v_1.3B_fp16.safetensors --local-dir unet
      hf download Comfy-Org/Wan_2.1_ComfyUI_repackaged split_files/vae/wan_2.1_vae.safetensors --local-dir vae

- Command: `node spikes/mac/scripts/comfy-wan.mjs --model wan21-1.3b --shot S01 --out <file.mp4>` (832x480,
  65 frames at 16 fps, 30 steps, cfg 6: the Wan 2.1 reference settings).
- Result: S01 took 3564 s (115 s per sampling step), peak footprint 33.8 GB, with `--timeout-min 120`. Not run
  for the other shots: too slow for its quality (see findings.json).

## realesrgan-2x — 2026-11-14

- Folder: ~/tapestry-spikes/realesrgan/. Weights: the official release file
  `https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth` (67 MB, BSD-3-Clause,
  sha256 49fafd45…6abb). No new environment: spandrel 0.4.2 and torch 2.15 come with the ComfyUI venv.
- Command: `~/tapestry-spikes/comfyui/.venv/bin/python spikes/mac/scripts/realesrgan.py --in <draft.mp4> --out
  <final.mp4>`. The checkpoint is loaded with `torch.load(weights_only=True)`, so no pickled code runs.
- Result: one 4 s LTX clip (97 frames, 832x448 to 1664x896) in 68 s, of which 66 s upscaling (about 0.7 s per
  frame on MPS), peak footprint 2.6 GB. A plain Lanczos 2x of the same clip takes under a second.

## Plan 10b workflows — 2026-11-14

All clips are made with `sh spikes/mac/scripts/draft-final.sh <step> <shot> [seed]`, which calls bench.mjs with the
clip names of spikes/draft-final/README.md.

- **Draft and path B (`ltx23-stage-split`)**: `spikes/mac/scripts/ltx_stage.py` (ltx-2-mlx venv Python). `draft`
  runs only stage 1 of the distilled pipeline (416x224 for an 832x448 final, 8 steps) and saves the latent next to
  the mp4; `final` resumes stage 2 from it (`DistilledPipeline.generate_two_stage(stage1=...)`, a documented
  ltx-2-mlx feature). Checked on S01: a resumed final with 3 stage-2 steps is identical to the uninterrupted plan 10
  render (ffmpeg PSNR infinite on every frame). Draft 70 s, final 107 s, against 167 s for one render.
  The README's "refine from the draft at strength 0.3 / 0.6" maps to fewer stage-2 steps: 3 / 2 / 1 steps start the
  refine at sigma 0.909 / 0.725 / 0.422 (variants B3, B2, B1).
- **Path C (`ltx23-iclora-union`)**: `ltx-2-mlx ic-lora` with Lightricks/LTX-2.3-22b-IC-LoRA-Union-Control and the
  draft's edges (ffmpeg `edgedetect`) as control video. The LoRA expects the control at half the output size, which
  is the draft size; ltx-2-mlx resizes it anyway. Gotcha: by default the LoRA is fused into the int4 weights and
  re-quantisation loses most of it (ltx-2-mlx says so in `ltx_core_mlx/loader/lora_adapters.py`); the output then
  ignores the edges. `LTX2_LORA_MODE=unfused` applies it at run time and the output follows the draft's layout and
  camera move (checked on S07). `--upsample-only --refine-steps 3` made no visible difference with the fused LoRA.
  LTX 2.3 has no identity-reference input (`--image` anchors frames), so C gets edges and text only.
- **Path D (`wan22-fun-5b-control`)**: `comfy-wan.mjs --model wan22-fun-5b-control --control <edges.mp4> [--ref
  <image>]`, ComfyUI's core `Wan22FunControlToVideo` node fed through `LoadVideo` and `GetVideoComponents`. Weights:
  `hf download QuantStack/Wan2.2-Fun-5B-Control-GGUF Wan2.2-Fun-5B-Control-Q8_0.gguf --local-dir unet` (5.4 GB,
  Apache-2.0), with the Wan 2.2 VAE and text encoder already there. The reference image is the shot's first `uses`
  entry from shots.json.

### Overnight run, all ten shots — 2026-11-15

All 117 runs ended `ok`; times are per 4 s clip (97 frames), peak memory as bench records it.

| Step | Time | Peak memory | Faithful to the draft (mean SSIM / motion correlation) |
|---|---|---|---|
| Draft (stage 1, 416x224) | 69–70 s | 19.3 GB | — |
| A0 Lanczos 2x | < 1 s | 0.1 GB | 0.997 / 0.999 |
| A1 Real-ESRGAN 2x | 18 s | 1.5 GB | 0.988 / 0.998 |
| B3 (3 refine steps) | 107–110 s | 16 GB | 0.813 / 0.877 |
| B2 / B1 | 78 s / 49 s | 16 GB | 0.920 / 0.954, 0.958 / 0.972 |
| C IC-LoRA, unfused | 181–188 s | 24.8 GB | 0.525 / 0.741 |
| D Wan Fun Control | 1178–1234 s | 28–35 GB | 0.676 / 0.864 |

- B2 and B1 come out softer than Real-ESRGAN of the draft (checked on face crops of S05): starting the refine that
  late leaves no room to add detail. Only B3 adds detail; it keeps framing, motion and the person, with small drift
  in face details (eye colour, brows). B3 is rated as variant `B`; B1 and B2 are kept in
  `spikes/draft-final/results/manifest-unrated.json` and left out of rating to keep the session near 40 minutes.
- C and D keep the layout and camera move but re-invent people and materials: on S05 the face is a different
  person, on S08 the costume changes. D with the reference image washed S02 (night pier) out to grey fog.
- D takes about 20 minutes per clip, more than a full LTX render (167 s), so it is not a cheap "finish" step.

### Cheaper drafts: fewer stage-1 steps — 2026-11-15

`draft-final.sh draft-steps<n>` runs stage 1 with n of its 8 steps (ltx-2-mlx keeps the schedule's start and tail,
`shorten_schedule(keep="start")`); `B-steps<n>` finishes it with 3 refine steps. All ten shots, seed 1.

| Draft steps | Draft time | Final time | Final vs its own draft (SSIM / motion corr.) | Final motion |
|---|---|---|---|---|
| 8 (normal) | 70 s | 107 s | 0.805 / 0.857 | 4.2 |
| 4 | 42 s | 109 s | 0.756 / 0.780 | 2.7 |
| 2 | 28 s | 108 s | 0.711 / 0.608 | 1.9 |
| 1 | 20 s | 108 s | 0.687 / 0.388 | 2.0 |

- About 13 s of every draft is fixed: Python start, loading (4 s), prompt encoding (5.5 s) and decoding (3 s). A
  denoising step costs 7.1 s at draft size and 29 s at final size, so keeping the model loaded saves only about 5 s.
- 4-step drafts are legible, but a different picture from the 8-step draft with the same seed; their finals follow
  them, with less motion.
- 2- and 1-step drafts are mostly noise (the distilled model is not trained for so few steps), so they cannot be
  judged. Their finals still come out clean, but they show content the draft never showed: it is a cheaper full
  render, not a draft.
